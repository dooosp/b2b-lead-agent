export const LEVEL1_D1_OBSERVATION_ALLOWED_METADATA_FIELDS = Object.freeze([
  'tableName',
  'columnName',
  'columnType',
  'notNull',
  'defaultValue',
  'primaryKey',
  'indexName',
  'unique',
  'origin',
  'partial',
]);

const FORBIDDEN_EVIDENCE_FIELDS = new Set([
  'accountId',
  'authHeader',
  'cookie',
  'customerData',
  'customerPayload',
  'databaseId',
  'generatedSuggestionText',
  'jwt',
  'logs',
  'manualNoteBodyText',
  'privateLeadPersonFields',
  'privateUrl',
  'rawCommandContext',
  'rowCount',
  'rowData',
  'secret',
  'sessionClaim',
  'token',
  'userIdentity',
]);

function normalizeStatus(status) {
  const normalized = String(status || 'BLOCKED').trim().toUpperCase();
  return ['PASS', 'BLOCKED', 'HOLD'].includes(normalized) ? normalized : 'BLOCKED';
}

export function validateLevel1D1ObservationEvidence(record = {}) {
  const forbiddenFields = Object.keys(record).filter((field) => {
    return FORBIDDEN_EVIDENCE_FIELDS.has(field) || !LEVEL1_D1_OBSERVATION_ALLOWED_METADATA_FIELDS.includes(field);
  });
  return {
    ok: forbiddenFields.length === 0,
    forbiddenFields,
  };
}

export function buildLevel1RollbackStopWriteGuard(trigger = 'unspecified') {
  return {
    trigger,
    stopWrites: true,
    nonDestructiveBackoutFirst: true,
    preserveExistingData: true,
    preserveRedactedEvidenceOnly: true,
    productionActionApproved: false,
    destructiveDataActionApproved: false,
    rollbackExecutionApproved: false,
    nextAction: 'HOLD_FOR_OWNER_APPROVAL',
  };
}

export function redactLevel1EvidenceRecord(record = {}) {
  return Object.fromEntries(Object.entries(record).map(([field, value]) => {
    if (FORBIDDEN_EVIDENCE_FIELDS.has(field)) {
      return [field, '[REDACTED]'];
    }
    return [field, value];
  }));
}

export function buildLevel1ReadinessScorecard(statuses = {}) {
  const items = [
    {
      id: 'auth_provider_session_scaffold_non_production',
      status: normalizeStatus(statuses.authProviderSessionScaffold),
      boundary: 'local_test_only',
    },
    {
      id: 'local_proof_simulation_fake_d1',
      status: normalizeStatus(statuses.localProofSimulation),
      boundary: 'fake_d1_only',
    },
    {
      id: 'd1_schema_guard_local_only',
      status: normalizeStatus(statuses.d1SchemaGuard),
      boundary: 'no_production_d1_observation',
    },
    {
      id: 'rollback_stop_write_guard_local_only',
      status: normalizeStatus(statuses.rollbackGuard),
      boundary: 'no_rollback_execution',
    },
    {
      id: 'privacy_generated_suggestion_guard_local_only',
      status: normalizeStatus(statuses.privacyGuard),
      boundary: 'no_note_body_history_no_generated_suggestion_persistence',
    },
    {
      id: 'production_proof_approval',
      status: normalizeStatus(statuses.productionProofApproval || 'HOLD'),
      boundary: 'separate_explicit_future_goal_required',
    },
  ];
  const allPassed = items.every((item) => item.status === 'PASS');
  const proofPassed = items.find((item) => item.id === 'production_proof_approval')?.status === 'PASS';

  return {
    overallStatus: allPassed && proofPassed ? 'PASS' : 'BLOCKED',
    productionReviewerWorkflowReady: allPassed && proofPassed,
    boundaryConfirmation: 'NON_PRODUCTION_ONLY',
    items,
    nonClaims: [
      'This scorecard does not claim production reviewer workflow readiness.',
      'This scorecard does not claim production D1 observation, production proof, deploy, endpoint, logs, secrets, customer data, CRM, outreach, LLM, or automation evidence.',
    ],
  };
}
