import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  LEVEL1_READINESS_CLOSURE_DASHBOARD_STATUS,
  LEVEL1_READINESS_CLOSURE_DASHBOARD_TIMESTAMP,
  REQUIRED_LEVEL1_CLOSURE_GATE_IDS,
  buildLevel1ReadinessClosureDashboard,
  renderLevel1ReadinessClosureMarkdown,
  validateLevel1ReadinessClosureDashboard,
} from '../../scripts/level1-readiness-closure-dashboard.mjs';

const EXPECTED_MERGED_PRS = Object.freeze([
  171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183,
]);

const EXPECTED_ISSUES = Object.freeze([154, 162, 163, 164, 165, 144]);

const REQUIRED_COMMANDS = Object.freeze([
  'npm run proof:level1:preflight',
  'npm run proof:level1:approval-dry-run',
  'npm run proof:level1:change-control-manifest',
  'npm run proof:level1:operator-rehearsal',
  'npm run proof:level1:closure-dashboard',
  'npm run proof:level1:approval-intake',
  'npm run security:audit-triage',
  'npm run check:enrichment-boundary',
  'npm run check:enrichment-replay',
  'npm run check:lead-pipeline-replay',
  'npm run check:level1',
]);

const REQUIRED_ARTIFACTS = Object.freeze([
  'tmp/codex/level1-proof-preflight-automation-non-production-evidence.json',
  'tmp/codex/level1-production-proof-approval-dry-run-non-production-evidence.json',
  'tmp/codex/level1-production-proof-change-control-manifest-non-production-plan.json',
  'tmp/codex/level1-operator-rehearsal-non-production-runbook.json',
  'tmp/codex/level1-readiness-closure-dashboard-non-production.json',
  'tmp/codex/level1-production-proof-approval-intake-gate-non-production.json',
  'docs/roadmap/b2b-lead-agent-level-1-production-proof-approval-intake-template-non-production.json',
  'tmp/codex/security-dependency-audit-triage-non-production.json',
  'tmp/codex/outbound-http-enrichment-boundary-guards-non-production.json',
  'tmp/codex/enrichment-fixture-replay-output-contract-non-production.json',
  'tmp/codex/lead-pipeline-fixture-replay-artifact-contract-non-production.json',
]);

const FORBIDDEN_DASHBOARD_MARKERS = Object.freeze([
  'productionReady":true',
  'PRODUCTION_READY',
  'APPROVED_FOR_PRODUCTION_PROOF_EXECUTION',
  'production proof executed',
  'staging proof executed',
  'wrangler d1 execute --remote',
  'curl https://',
  'DATABASE_ID',
  'CLOUDFLARE_API_TOKEN',
  'Authorization: Bearer',
  'manual note body',
  'Generated suggestion text',
  'customer payload',
]);

function assertNoForbiddenMarkers(value) {
  const serialized = JSON.stringify(value);
  for (const marker of FORBIDDEN_DASHBOARD_MARKERS) {
    assert.equal(serialized.includes(marker), false, `dashboard leaked forbidden marker: ${marker}`);
  }
}

test('Level 1 closure dashboard inventories every merged local-only gate and keeps production on HOLD', () => {
  const dashboard = buildLevel1ReadinessClosureDashboard();
  const validation = validateLevel1ReadinessClosureDashboard(dashboard);

  assert.equal(validation.ok, true);
  assert.deepEqual(validation.blockers, []);
  assert.equal(dashboard.documentStatus, LEVEL1_READINESS_CLOSURE_DASHBOARD_STATUS);
  assert.equal(dashboard.generatedAt, LEVEL1_READINESS_CLOSURE_DASHBOARD_TIMESTAMP);
  assert.equal(dashboard.repo, 'dooosp/b2b-lead-agent');
  assert.equal(dashboard.boundary, 'NOT_PRODUCTION_EVIDENCE');
  assert.equal(dashboard.notProductionEvidence, true);
  assert.equal(dashboard.productionReady, false);
  assert.equal(dashboard.productionReviewerWorkflowReady, false);
  assert.equal(dashboard.approvalStatus, 'HOLD_PENDING_SEPARATE_EXPLICIT_FUTURE_PROOF_GOAL');
  assert.deepEqual(dashboard.statusLegend, ['PASS', 'BLOCKED', 'HOLD']);
  assert.equal(dashboard.productionReviewerWorkflow.status, 'BLOCKED');
  assert.equal(dashboard.productionReviewerWorkflow.blockedByIssue, 165);
  assert.equal(dashboard.issue165Blocker.status, 'HOLD');
  assert.equal(dashboard.issue165Blocker.issue, 165);
  assert.match(dashboard.issue165Blocker.remainingBlocker, /separate explicit future production proof goal/i);

  assert.deepEqual(dashboard.baseline, {
    branch: 'master',
    headSha: '808dde2b19a450207499672d05a9ed5d4215ad66',
    mergedPrs: EXPECTED_MERGED_PRS,
    mergedPrRange: '#171-#183',
  });

  assert.deepEqual(dashboard.gates.map((gate) => gate.id), REQUIRED_LEVEL1_CLOSURE_GATE_IDS);
  assert.equal(dashboard.gates.length, 14);
  assert.deepEqual(dashboard.gates.slice(0, 13).map((gate) => gate.sourcePr), EXPECTED_MERGED_PRS);
  assert.equal(dashboard.gates[13].sourcePr, null);
  assert.ok(dashboard.gates.every((gate) => gate.boundary === 'NOT_PRODUCTION_EVIDENCE'));
  assert.ok(dashboard.gates.every((gate) => gate.productionReady === false));
  assert.ok(dashboard.gates.every((gate) => ['PASS', 'HOLD'].includes(gate.status)));
  assert.deepEqual(dashboard.issue165Blocker.remainingApprovalFields, [
    'target',
    'command_allowlist',
    'endpoint_boundary',
    'd1_boundary',
    'fixture_non_customer_data_policy',
    'evidence_redaction',
    'rollback_owner',
    'stop_conditions',
    'approver',
    'expires_at',
  ]);

  for (const command of REQUIRED_COMMANDS) {
    assert.ok(dashboard.commandList.includes(command), `missing command ${command}`);
  }
  for (const artifact of REQUIRED_ARTIFACTS) {
    assert.ok(dashboard.artifactList.includes(artifact), `missing artifact ${artifact}`);
  }
  for (const issue of EXPECTED_ISSUES) {
    assert.equal(dashboard.issueMap.some((entry) => entry.issue === issue), true, `missing issue #${issue}`);
  }

  assert.deepEqual(dashboard.futureProductionProofPrerequisites.map((item) => item.status), [
    'HOLD',
    'HOLD',
    'HOLD',
    'HOLD',
    'HOLD',
    'HOLD',
  ]);
  assert.equal(dashboard.futureProductionProofPrerequisites.every((item) => item.blockedByIssue === 165), true);
  assertNoForbiddenMarkers(dashboard);
});

test('Level 1 closure dashboard validation refuses missing gates and production-ready claims', () => {
  const complete = buildLevel1ReadinessClosureDashboard();
  const missingGate = {
    ...complete,
    gates: complete.gates.filter((gate) => gate.id !== 'lead_pipeline_fixture_replay_artifact_contract'),
  };
  const productionClaim = {
    ...complete,
    productionReady: true,
    productionReviewerWorkflowReady: true,
    gates: complete.gates.map((gate) => (
      gate.id === 'production_proof_approval_dry_run'
        ? { ...gate, productionReady: true, status: 'PASS' }
        : gate
    )),
  };

  const missingGateValidation = validateLevel1ReadinessClosureDashboard(missingGate);
  const productionClaimValidation = validateLevel1ReadinessClosureDashboard(productionClaim);

  assert.equal(missingGateValidation.ok, false);
  assert.equal(
    missingGateValidation.blockers.some((blocker) => blocker.reason === 'missing_required_gate'),
    true,
  );
  assert.equal(productionClaimValidation.ok, false);
  assert.equal(
    productionClaimValidation.blockers.some((blocker) => blocker.reason === 'production_ready_claim_refused'),
    true,
  );
  assert.equal(
    productionClaimValidation.blockers.some((blocker) => blocker.reason === 'gate_production_ready_claim_refused'),
    true,
  );
});

test('Level 1 closure dashboard markdown is reviewer-readable and anti-overclaiming', () => {
  const dashboard = buildLevel1ReadinessClosureDashboard();
  const markdown = renderLevel1ReadinessClosureMarkdown(dashboard);

  assert.match(markdown, /^# Level 1 Readiness Closure Dashboard \(Non-Production\)/);
  assert.match(markdown, /Document Status: `LEVEL1_READINESS_CLOSURE_DASHBOARD_NON_PRODUCTION`/);
  assert.match(markdown, /Boundary: `NOT_PRODUCTION_EVIDENCE`/);
  assert.match(markdown, /productionReady: `false`/);
  assert.match(markdown, /Merged PR Range: `#171-#183`/);
  assert.match(markdown, /production_proof_approval_intake_gate/);
  assert.match(markdown, /target/);
  assert.match(markdown, /expires_at/);
  assert.match(markdown, /Issue #165/);
  assert.match(markdown, /HOLD_PENDING_SEPARATE_EXPLICIT_FUTURE_PROOF_GOAL/);
  assert.match(markdown, /npm run check:lead-pipeline-replay/);
  assert.match(markdown, /tmp\/codex\/lead-pipeline-fixture-replay-artifact-contract-non-production\.json/);
  assert.doesNotMatch(markdown, /productionReady: `true`/);
  assert.doesNotMatch(markdown, /production proof executed/i);
});

test('Level 1 closure dashboard CLI writes JSON and Markdown artifacts', () => {
  const dir = mkdtempSync(join(tmpdir(), 'level1-closure-dashboard-'));
  const jsonPath = join(dir, 'dashboard.json');
  const markdownPath = join(dir, 'dashboard.md');

  try {
    const result = spawnSync(process.execPath, [
      'scripts/level1-readiness-closure-dashboard.mjs',
      '--json',
      '--output',
      jsonPath,
      '--markdown-output',
      markdownPath,
    ], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, new RegExp(LEVEL1_READINESS_CLOSURE_DASHBOARD_STATUS));

    const dashboard = JSON.parse(readFileSync(jsonPath, 'utf8'));
    const markdown = readFileSync(markdownPath, 'utf8');

    assert.equal(dashboard.documentStatus, LEVEL1_READINESS_CLOSURE_DASHBOARD_STATUS);
    assert.equal(dashboard.boundary, 'NOT_PRODUCTION_EVIDENCE');
    assert.equal(dashboard.productionReady, false);
    assert.match(markdown, /Level 1 Readiness Closure Dashboard/);
    assertNoForbiddenMarkers(dashboard);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
