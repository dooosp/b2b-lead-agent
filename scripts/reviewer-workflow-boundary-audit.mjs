#!/usr/bin/env node

import { createRequire } from 'node:module';

import {
  buildDataGapPrioritization,
  buildReviewerWorkflowSummary,
} from '../worker/lib/lead-action-intelligence.js';
import {
  filterManualReviewNotesForExport,
  filterManualReviewNotesLeadCollection,
} from '../worker/lib/manual-review-notes-access.js';
import { serializeLeadsCsv } from '../worker/api/serializers/lead-csv.js';
import { isDirectCliRun, optionValue, writeJsonArtifact } from './lib/cli-utils.mjs';

const require = createRequire(import.meta.url);
const { prepareLeadSnapshotRecords } = require('../lead-report-publisher');
const { REDACTION_LABELS, redactEvidence } = require('./release-evidence-redactor');

export const REVIEWER_WORKFLOW_BOUNDARY_AUDIT_STATUS =
  'REVIEWER_WORKFLOW_BOUNDARY_AUDIT_NON_PRODUCTION';

export const REVIEWER_WORKFLOW_BOUNDARY_AUDIT_OUTPUT_PATH =
  'tmp/codex/reviewer-workflow-boundary-audit-non-production.json';

export const REVIEWER_WORKFLOW_BOUNDARY_AUDIT_TIMESTAMP = '2026-07-06T00:00:00.000Z';

export const REVIEWER_WORKFLOW_FORBIDDEN_MARKERS = Object.freeze([
  'RWI_PROTECTED_REVIEWER_FEEDBACK_TEXT_DO_NOT_LEAK',
  'RWI_PROTECTED_NEXT_REVIEWER_ACTION_DO_NOT_LEAK',
  'RWI_PROTECTED_MANUAL_NOTE_DO_NOT_LEAK',
  'RWI_GENERATED_REVIEWER_SUGGESTION_DO_NOT_LEAK',
  'RWI_RAW_PROVIDER_SESSION_DO_NOT_LEAK',
  'Authorization: Bearer rwi-secret-token',
]);

const DENIED_ACCESS = Object.freeze({
  enabled: true,
  role: 'manager',
  manualNotesRead: false,
  manualNotesWrite: false,
  metadataHistorySummaryRead: false,
});

function syntheticLead(overrides = {}) {
  return {
    id: 'rwi-boundary-lead-1',
    company: 'RWI Boundary Synthetic Co',
    summary: 'Synthetic local/test reviewer workflow boundary signal.',
    product: 'Synthetic audit product',
    score: 77,
    grade: 'B',
    roi: '',
    status: 'NEW',
    reviewStatus: 'NEEDS_REVIEW',
    confidence: 'LOW',
    verificationStatus: 'needs_review',
    generationMode: 'llm',
    sources: [],
    evidence: [],
    dataGaps: ['Synthetic source evidence requires human review.'],
    manualReviewNotes: 'RWI_PROTECTED_MANUAL_NOTE_DO_NOT_LEAK',
    reviewerFeedback: {
      hasFeedback: true,
      actionUsefulness: 'partially_useful',
      outcomeLabel: 'needs_more_research',
      dataGapPriority: 'blocking',
      evidenceConfidenceAdjustment: 'decrease',
      feedbackText: 'RWI_PROTECTED_REVIEWER_FEEDBACK_TEXT_DO_NOT_LEAK',
      nextReviewerAction: 'RWI_PROTECTED_NEXT_REVIEWER_ACTION_DO_NOT_LEAK',
      authorLabel: 'manual_reviewer',
      updatedAt: REVIEWER_WORKFLOW_BOUNDARY_AUDIT_TIMESTAMP,
    },
    createdAt: REVIEWER_WORKFLOW_BOUNDARY_AUDIT_TIMESTAMP,
    updatedAt: REVIEWER_WORKFLOW_BOUNDARY_AUDIT_TIMESTAMP,
    ...overrides,
  };
}

function hasForbiddenMarker(value) {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  return REVIEWER_WORKFLOW_FORBIDDEN_MARKERS.some((marker) => serialized.includes(marker));
}

function addCheck(checks, id, pass, details = {}) {
  checks.push({
    id,
    status: pass ? 'PASS' : 'FAIL',
    ...details,
  });
}

function addBlocker(blockers, reason, path, detail = '') {
  if (blockers.some((blocker) => blocker.reason === reason && blocker.path === path)) return;
  blockers.push({ reason, path, detail, status: 'HOLD' });
}

function buildReleaseEvidenceSample() {
  return {
    reviewerFeedback: {
      feedbackText: 'RWI_PROTECTED_REVIEWER_FEEDBACK_TEXT_DO_NOT_LEAK',
      nextReviewerAction: 'RWI_PROTECTED_NEXT_REVIEWER_ACTION_DO_NOT_LEAK',
      authorLabel: 'manual_reviewer',
    },
    feedbackText: 'RWI_PROTECTED_REVIEWER_FEEDBACK_TEXT_DO_NOT_LEAK',
    nextReviewerAction: 'RWI_PROTECTED_NEXT_REVIEWER_ACTION_DO_NOT_LEAK',
    manualReviewNotes: 'RWI_PROTECTED_MANUAL_NOTE_DO_NOT_LEAK',
    reviewNoteSuggestion: {
      text: 'RWI_GENERATED_REVIEWER_SUGGESTION_DO_NOT_LEAK',
    },
    rawSessionClaims: {
      token: 'RWI_RAW_PROVIDER_SESSION_DO_NOT_LEAK',
    },
    operatorSummary: 'Authorization: Bearer rwi-secret-token',
    safeBoundary: 'NOT_PRODUCTION_EVIDENCE',
  };
}

export function buildReviewerWorkflowBoundaryAudit(input = {}) {
  const generatedAt = input.generatedAt || REVIEWER_WORKFLOW_BOUNDARY_AUDIT_TIMESTAMP;
  const lead = syntheticLead(input.lead || {});
  const leads = [lead];
  const checks = [];

  const summary = buildReviewerWorkflowSummary(leads);
  const prioritization = buildDataGapPrioritization(leads);
  addCheck(checks, 'reviewer_summary_boundary_flags', (
    summary.contract === 'REVIEWER_WORKFLOW_INTELLIGENCE_V1'
    && summary.boundary?.evidenceKind === 'NOT_PRODUCTION_EVIDENCE'
    && summary.boundary?.productionReady === false
    && summary.boundary?.generatedSuggestionPersistence === false
    && summary.withReviewerFeedback === 1
    && summary.dataGapPriorityCounts.blocking === 1
  ), {
    contract: summary.contract,
    evidenceKind: summary.boundary?.evidenceKind,
    productionReady: summary.boundary?.productionReady,
    withReviewerFeedback: summary.withReviewerFeedback,
    blockingDataGapCount: summary.dataGapPriorityCounts.blocking,
  });

  addCheck(checks, 'data_gap_prioritization_boundary_flags', (
    prioritization.contract === 'DATA_GAP_PRIORITIZATION_V1'
    && prioritization.boundary?.evidenceKind === 'NOT_PRODUCTION_EVIDENCE'
    && prioritization.boundary?.productionReady === false
    && prioritization.bucketCounts.blocking_data_gap === 1
    && prioritization.items[0]?.bucket === 'blocking_data_gap'
  ), {
    contract: prioritization.contract,
    evidenceKind: prioritization.boundary?.evidenceKind,
    productionReady: prioritization.boundary?.productionReady,
    firstBucket: prioritization.items[0]?.bucket || null,
  });

  const deniedLeads = filterManualReviewNotesLeadCollection(leads, DENIED_ACCESS);
  const deniedSummary = buildReviewerWorkflowSummary(deniedLeads);
  const deniedPrioritization = buildDataGapPrioritization(deniedLeads);
  addCheck(checks, 'denied_role_omits_feedback_from_summary_and_queue_metadata', (
    !hasForbiddenMarker(deniedLeads)
    && deniedSummary.withReviewerFeedback === 0
    && deniedSummary.dataGapPriorityCounts.blocking === 0
    && deniedPrioritization.items.every((item) => item.hasReviewerFeedback === false)
    && !hasForbiddenMarker(deniedPrioritization)
  ), {
    deniedRole: DENIED_ACCESS.role,
    deniedSummaryWithReviewerFeedback: deniedSummary.withReviewerFeedback,
    deniedBlockingDataGapCount: deniedSummary.dataGapPriorityCounts.blocking,
  });

  const csv = serializeLeadsCsv(filterManualReviewNotesForExport(leads));
  addCheck(checks, 'csv_export_omits_feedback_notes_and_generated_suggestions', (
    !hasForbiddenMarker(csv)
    && !/reviewerFeedback|reviewer_feedback|feedbackText|nextReviewerAction|reviewNoteSuggestion/.test(csv)
  ), {
    csvHeaderColumnCount: csv.split('\n')[0].split(',').length,
    exportExpandedReviewerFeedback: /reviewerFeedback|reviewer_feedback/.test(csv),
  });

  const [publishedRecord] = prepareLeadSnapshotRecords([{
    ...lead,
    reviewNoteSuggestion: { text: 'RWI_GENERATED_REVIEWER_SUGGESTION_DO_NOT_LEAK' },
    rawSessionClaims: { token: 'RWI_RAW_PROVIDER_SESSION_DO_NOT_LEAK' },
    authHeader: 'Authorization: Bearer rwi-secret-token',
  }], {
    now: generatedAt,
    profileId: 'danfoss',
    idFactory: () => 'rwi-boundary-published-lead',
  });
  addCheck(checks, 'published_snapshot_omits_reviewer_feedback_and_private_runtime_fields', (
    !hasForbiddenMarker(publishedRecord)
    && !Object.hasOwn(publishedRecord, 'reviewerFeedback')
    && !Object.hasOwn(publishedRecord, 'reviewNoteSuggestion')
    && !Object.hasOwn(publishedRecord, 'rawSessionClaims')
    && !Object.hasOwn(publishedRecord, 'authHeader')
  ), {
    hasReviewerFeedback: Object.hasOwn(publishedRecord, 'reviewerFeedback'),
    hasGeneratedSuggestion: Object.hasOwn(publishedRecord, 'reviewNoteSuggestion'),
  });

  const redactedEvidence = redactEvidence(buildReleaseEvidenceSample());
  addCheck(checks, 'release_evidence_redacts_reviewer_feedback_freeform_text', (
    !hasForbiddenMarker(redactedEvidence)
    && redactedEvidence.reviewerFeedback === REDACTION_LABELS.protectedText
    && redactedEvidence.feedbackText === REDACTION_LABELS.protectedText
    && redactedEvidence.nextReviewerAction === REDACTION_LABELS.protectedText
  ), {
    reviewerFeedbackRedacted: redactedEvidence.reviewerFeedback === REDACTION_LABELS.protectedText,
    feedbackTextRedacted: redactedEvidence.feedbackText === REDACTION_LABELS.protectedText,
    nextReviewerActionRedacted: redactedEvidence.nextReviewerAction === REDACTION_LABELS.protectedText,
  });

  const artifact = {
    documentStatus: REVIEWER_WORKFLOW_BOUNDARY_AUDIT_STATUS,
    generatedAt,
    repo: 'dooosp/b2b-lead-agent',
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    notProductionEvidence: true,
    productionReady: false,
    productionReviewerWorkflowReady: false,
    localTestOnly: true,
    sourceFeature: 'Reviewer Workflow Intelligence v1',
    sourcePr: 191,
    priorSourceSyncPr: 192,
    scope: {
      checksReviewerFeedbackFreeformLeakage: true,
      checksGeneratedSuggestionPersistenceOrExport: true,
      checksReleaseEvidenceRedaction: true,
      executesProductionProof: false,
      touchesProductionD1: false,
      touchesStagingD1: false,
      callsProductionOrStagingEndpoints: false,
      implementsRealAuthSession: false,
      implementsRetentionEnforcement: false,
    },
    checks,
    surfaceSummary: {
      reviewerOnlySignalsRemainAvailableLocally: summary.withReviewerFeedback === 1,
      deniedRolesOmitReviewerFeedbackSignals: deniedSummary.withReviewerFeedback === 0,
      csvExportIncludesReviewerFeedbackColumns: /reviewerFeedback|reviewer_feedback|feedbackText|nextReviewerAction/.test(csv),
      publishedSnapshotIncludesReviewerFeedback: Object.hasOwn(publishedRecord, 'reviewerFeedback'),
      releaseEvidenceUsesProtectedTextRedaction: redactedEvidence.reviewerFeedback === REDACTION_LABELS.protectedText,
    },
    validationCommands: [
      'npm run check:reviewer-workflow-boundary',
      'npm run check:naming',
      'npm run check:schema',
      'npm test',
    ],
    remainingBlockers: [
      { issue: 154, status: 'OPEN', reason: 'privacy_retention_enforcement_not_implemented' },
      { issue: 162, status: 'OPEN', reason: 'real_auth_session_not_implemented' },
      { issue: 163, status: 'OPEN', reason: 'production_d1_observation_not_approved' },
      { issue: 164, status: 'OPEN', reason: 'production_rollback_execution_not_approved' },
      { issue: 165, status: 'OPEN', reason: 'production_proof_execution_not_approved' },
    ],
  };
  const validation = validateReviewerWorkflowBoundaryAudit(artifact);
  return {
    ...artifact,
    validation,
    blockers: validation.blockers,
  };
}

export function validateReviewerWorkflowBoundaryAudit(artifact = {}) {
  const blockers = [];
  if (artifact.documentStatus !== REVIEWER_WORKFLOW_BOUNDARY_AUDIT_STATUS) {
    addBlocker(blockers, 'invalid_document_status', 'documentStatus', String(artifact.documentStatus || ''));
  }
  if (artifact.boundary !== 'NOT_PRODUCTION_EVIDENCE' || artifact.notProductionEvidence !== true) {
    addBlocker(blockers, 'invalid_non_production_boundary', 'boundary', String(artifact.boundary || ''));
  }
  if (artifact.productionReady !== false || artifact.productionReviewerWorkflowReady !== false) {
    addBlocker(blockers, 'production_ready_claim_refused', 'productionReady', 'Reviewer workflow boundary audit cannot approve production readiness.');
  }
  if (!Array.isArray(artifact.checks) || artifact.checks.length < 5) {
    addBlocker(blockers, 'missing_required_checks', 'checks', 'Expected reviewer summary, prioritization, denied role, CSV, publication, and release-evidence checks.');
  }
  for (const check of artifact.checks || []) {
    if (check.status !== 'PASS') {
      addBlocker(blockers, 'failed_boundary_check', `checks.${check.id || 'unknown'}`, check.status || 'missing status');
    }
  }
  if (hasForbiddenMarker(artifact)) {
    addBlocker(blockers, 'protected_reviewer_workflow_text_leak', 'artifact', 'Audit artifact contains protected reviewer workflow fixture text.');
  }
  return {
    ok: blockers.length === 0,
    blockers,
  };
}

function runCli() {
  const artifact = buildReviewerWorkflowBoundaryAudit();
  const outputPath = optionValue('--output') || REVIEWER_WORKFLOW_BOUNDARY_AUDIT_OUTPUT_PATH;
  writeJsonArtifact(outputPath, artifact);

  const output = process.argv.includes('--json')
    ? JSON.stringify(artifact, null, 2)
    : [
      `${artifact.documentStatus}: ${artifact.validation.ok ? 'PASS_LOCAL_ONLY' : 'HOLD'}`,
      `boundary: ${artifact.boundary}`,
      `productionReady: ${artifact.productionReady}`,
      `checks: ${artifact.checks.filter((check) => check.status === 'PASS').length}/${artifact.checks.length}`,
      `output: ${outputPath}`,
    ].join('\n');
  console.log(output);

  if (!artifact.validation.ok) {
    process.exitCode = 1;
  }
}

if (isDirectCliRun(import.meta.url)) {
  runCli();
}
