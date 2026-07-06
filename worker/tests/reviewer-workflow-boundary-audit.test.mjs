import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  REVIEWER_WORKFLOW_BOUNDARY_AUDIT_STATUS,
  REVIEWER_WORKFLOW_BOUNDARY_AUDIT_TIMESTAMP,
  REVIEWER_WORKFLOW_FORBIDDEN_MARKERS,
  buildReviewerWorkflowBoundaryAudit,
  validateReviewerWorkflowBoundaryAudit,
} from '../../scripts/reviewer-workflow-boundary-audit.mjs';

function assertNoForbiddenMarkers(value) {
  const serialized = JSON.stringify(value);
  for (const marker of REVIEWER_WORKFLOW_FORBIDDEN_MARKERS) {
    assert.equal(serialized.includes(marker), false, `artifact leaked protected marker: ${marker}`);
  }
}

test('reviewer workflow boundary audit passes local-only privacy and export checks', () => {
  const artifact = buildReviewerWorkflowBoundaryAudit();

  assert.equal(artifact.documentStatus, REVIEWER_WORKFLOW_BOUNDARY_AUDIT_STATUS);
  assert.equal(artifact.generatedAt, REVIEWER_WORKFLOW_BOUNDARY_AUDIT_TIMESTAMP);
  assert.equal(artifact.boundary, 'NOT_PRODUCTION_EVIDENCE');
  assert.equal(artifact.notProductionEvidence, true);
  assert.equal(artifact.productionReady, false);
  assert.equal(artifact.productionReviewerWorkflowReady, false);
  assert.equal(artifact.validation.ok, true);
  assert.deepEqual(artifact.blockers, []);
  assert.deepEqual(artifact.checks.map((check) => check.id), [
    'reviewer_summary_boundary_flags',
    'data_gap_prioritization_boundary_flags',
    'denied_role_omits_feedback_from_summary_and_queue_metadata',
    'csv_export_omits_feedback_notes_and_generated_suggestions',
    'published_snapshot_omits_reviewer_feedback_and_private_runtime_fields',
    'release_evidence_redacts_reviewer_feedback_freeform_text',
  ]);
  assert.ok(artifact.checks.every((check) => check.status === 'PASS'));
  assert.equal(artifact.surfaceSummary.reviewerOnlySignalsRemainAvailableLocally, true);
  assert.equal(artifact.surfaceSummary.deniedRolesOmitReviewerFeedbackSignals, true);
  assert.equal(artifact.surfaceSummary.csvExportIncludesReviewerFeedbackColumns, false);
  assert.equal(artifact.surfaceSummary.publishedSnapshotIncludesReviewerFeedback, false);
  assert.equal(artifact.surfaceSummary.releaseEvidenceUsesProtectedTextRedaction, true);
  assertNoForbiddenMarkers(artifact);
});

test('reviewer workflow boundary audit validation refuses production-ready claims and protected text leaks', () => {
  const complete = buildReviewerWorkflowBoundaryAudit();
  const productionClaim = {
    ...complete,
    productionReady: true,
    productionReviewerWorkflowReady: true,
  };
  const leaked = {
    ...complete,
    leakedProbe: 'RWI_PROTECTED_REVIEWER_FEEDBACK_TEXT_DO_NOT_LEAK',
  };
  const failedCheck = {
    ...complete,
    checks: complete.checks.map((check) => (
      check.id === 'csv_export_omits_feedback_notes_and_generated_suggestions'
        ? { ...check, status: 'FAIL' }
        : check
    )),
  };

  const productionValidation = validateReviewerWorkflowBoundaryAudit(productionClaim);
  const leakedValidation = validateReviewerWorkflowBoundaryAudit(leaked);
  const failedValidation = validateReviewerWorkflowBoundaryAudit(failedCheck);

  assert.equal(productionValidation.ok, false);
  assert.equal(
    productionValidation.blockers.some((blocker) => blocker.reason === 'production_ready_claim_refused'),
    true
  );
  assert.equal(leakedValidation.ok, false);
  assert.equal(
    leakedValidation.blockers.some((blocker) => blocker.reason === 'protected_reviewer_workflow_text_leak'),
    true
  );
  assert.equal(failedValidation.ok, false);
  assert.equal(
    failedValidation.blockers.some((blocker) => blocker.reason === 'failed_boundary_check'),
    true
  );
});

test('reviewer workflow boundary audit CLI writes redacted NOT_PRODUCTION_EVIDENCE artifact', () => {
  const dir = mkdtempSync(join(tmpdir(), 'reviewer-workflow-boundary-audit-'));
  const jsonPath = join(dir, 'audit.json');

  try {
    const result = spawnSync(process.execPath, [
      'scripts/reviewer-workflow-boundary-audit.mjs',
      '--json',
      '--output',
      jsonPath,
    ], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, new RegExp(REVIEWER_WORKFLOW_BOUNDARY_AUDIT_STATUS));

    const artifact = JSON.parse(readFileSync(jsonPath, 'utf8'));
    assert.equal(artifact.boundary, 'NOT_PRODUCTION_EVIDENCE');
    assert.equal(artifact.productionReady, false);
    assert.equal(artifact.validation.ok, true);
    assertNoForbiddenMarkers(artifact);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
