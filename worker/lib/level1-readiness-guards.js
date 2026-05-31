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

export const LEVEL1_MANUAL_REVIEW_NOTES_SCHEMA_METADATA_FIXTURE = Object.freeze([
  Object.freeze({
    tableName: 'leads',
    columnName: 'notes',
    columnType: 'TEXT',
    notNull: false,
    defaultValue: "''",
    primaryKey: false,
  }),
  Object.freeze({
    tableName: 'leads',
    columnName: 'manual_review_notes_author_label',
    columnType: 'TEXT',
    notNull: false,
    defaultValue: null,
    primaryKey: false,
  }),
  Object.freeze({
    tableName: 'leads',
    columnName: 'manual_review_notes_updated_at',
    columnType: 'TEXT',
    notNull: false,
    defaultValue: null,
    primaryKey: false,
  }),
  Object.freeze({
    tableName: 'manual_review_note_events',
    columnName: 'lead_id',
    columnType: 'TEXT',
    notNull: true,
    defaultValue: null,
    primaryKey: false,
  }),
  Object.freeze({
    tableName: 'manual_review_note_events',
    columnName: 'event_type',
    columnType: 'TEXT',
    notNull: true,
    defaultValue: null,
    primaryKey: false,
  }),
  Object.freeze({
    tableName: 'manual_review_note_events',
    columnName: 'changed_at',
    columnType: 'TEXT',
    notNull: true,
    defaultValue: null,
    primaryKey: false,
  }),
  Object.freeze({
    tableName: 'manual_review_note_events',
    columnName: 'author_label',
    columnType: 'TEXT',
    notNull: true,
    defaultValue: "'manual_reviewer'",
    primaryKey: false,
  }),
  Object.freeze({
    tableName: 'manual_review_note_events',
    indexName: 'idx_manual_review_note_events_lead',
    unique: false,
    origin: 'c',
    partial: false,
  }),
]);

const LEVEL1_MANUAL_REVIEW_NOTES_SCHEMA_METADATA_KEYS = new Set(
  LEVEL1_MANUAL_REVIEW_NOTES_SCHEMA_METADATA_FIXTURE.map((record) => (
    `${record.tableName}:${record.columnName || record.indexName || ''}`
  ))
);

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
  'noteBody',
  'privateLeadPersonFields',
  'privateUrl',
  'providerInput',
  'rawSessionClaims',
  'rawCommandContext',
  'rowCount',
  'rowData',
  'secret',
  'sessionClaim',
  'token',
  'userIdentity',
]);

const FORBIDDEN_EVIDENCE_FIELD_PATTERNS = [
  /account[_-]?id/i,
  /auth[_-]?header/i,
  /cookie/i,
  /customer/i,
  /database[_-]?id/i,
  /generated.*suggestion/i,
  /generated.*helper/i,
  /jwt/i,
  /manual.*note.*body/i,
  /note.*body/i,
  /private/i,
  /provider.*input/i,
  /raw.*command/i,
  /raw.*session.*claim/i,
  /secret/i,
  /session.*claim/i,
  /token/i,
  /user.*identity/i,
];

function isForbiddenEvidenceField(field) {
  if (FORBIDDEN_EVIDENCE_FIELDS.has(field)) return true;
  return FORBIDDEN_EVIDENCE_FIELD_PATTERNS.some((pattern) => pattern.test(field));
}

function normalizeStatus(status) {
  const normalized = String(status || 'BLOCKED').trim().toUpperCase();
  return ['PASS', 'BLOCKED', 'HOLD'].includes(normalized) ? normalized : 'BLOCKED';
}

export function validateLevel1D1ObservationEvidence(record = {}) {
  const forbiddenFields = Object.keys(record).filter((field) => {
    const value = record[field];
    const isNestedValue = value !== null && typeof value === 'object';
    return isForbiddenEvidenceField(field)
      || !LEVEL1_D1_OBSERVATION_ALLOWED_METADATA_FIELDS.includes(field)
      || isNestedValue;
  });
  return {
    ok: forbiddenFields.length === 0,
    forbiddenFields,
  };
}

function redactValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }
  if (value && typeof value === 'object') {
    return redactLevel1EvidenceRecord(value);
  }
  return value;
}

export function validateLevel1ManualReviewNotesSchemaMetadata(record = {}) {
  const result = validateLevel1D1ObservationEvidence(record);
  const key = `${record.tableName || ''}:${record.columnName || record.indexName || ''}`;
  const forbiddenFields = [...result.forbiddenFields];
  if (!LEVEL1_MANUAL_REVIEW_NOTES_SCHEMA_METADATA_KEYS.has(key)) {
    forbiddenFields.push('tableName');
  }
  return {
    ok: forbiddenFields.length === 0,
    forbiddenFields,
  };
}

export function buildLevel1LocalD1ObservationMetadata(records = LEVEL1_MANUAL_REVIEW_NOTES_SCHEMA_METADATA_FIXTURE) {
  const evidence = records.map((record) => ({ ...record }));
  const invalidRecords = evidence
    .map((record, index) => ({ index, ...validateLevel1ManualReviewNotesSchemaMetadata(record) }))
    .filter((result) => !result.ok);

  return {
    source: 'local_fixture_metadata_only',
    productionD1Observed: false,
    productionReady: false,
    evidenceBoundary: 'NOT_PRODUCTION_EVIDENCE',
    records: evidence,
    invalidRecords,
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
    if (isForbiddenEvidenceField(field)) {
      return [field, '[REDACTED]'];
    }
    return [field, redactValue(value)];
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
