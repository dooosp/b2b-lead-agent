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

export const LEVEL1_MANUAL_REVIEW_NOTES_SCHEMA_METADATA_REQUIRED_KEYS = Object.freeze(
  [...LEVEL1_MANUAL_REVIEW_NOTES_SCHEMA_METADATA_KEYS]
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
  'manualNote',
  'manualReviewNotes',
  'manual_review_notes',
  'manualReviewNotesAuthorLabel',
  'manual_review_notes_author_label',
  'manualReviewNotesHistoryEventCount',
  'manual_review_notes_history_event_count',
  'manualReviewNotesHistoryLastAuthorLabel',
  'manual_review_notes_history_last_author_label',
  'manualReviewNotesProvenance',
  'manual_review_notes_provenance',
  'manualReviewNotesUpdatedAt',
  'manual_review_notes_updated_at',
  'manualNoteBodyText',
  'notes',
  'noteBody',
  'privateLeadPersonFields',
  'privateUrl',
  'providerInput',
  'rawAuth',
  'raw_auth',
  'rawSessionClaims',
  'rawCommandContext',
  'reviewNoteSuggestion',
  'reviewNoteTemplates',
  'rowCount',
  'rowData',
  'secret',
  'sessionClaim',
  'token',
  'userIdentity',
  'destructiveDataActionApproved',
  'rollbackExecutionApproved',
  'productionActionApproved',
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
  /^notes$/i,
  /^manual[_-]?note$/i,
  /manual[_-]?review[_-]?notes/i,
  /manual.*note.*author/i,
  /manual.*note.*body/i,
  /manual.*note.*history/i,
  /manual.*note.*provenance/i,
  /manual.*note.*updated/i,
  /note.*body/i,
  /private/i,
  /provider.*input/i,
  /raw[_-]?auth/i,
  /raw.*command/i,
  /raw.*session.*claim/i,
  /review.*note.*suggestion/i,
  /review.*note.*template/i,
  /secret/i,
  /session.*claim/i,
  /token/i,
  /user.*identity/i,
  /destructive.*approved/i,
  /rollback.*execution.*approved/i,
  /production.*action.*approved/i,
];

const FORBIDDEN_EVIDENCE_TEXT_PATTERNS = Object.freeze([
  /\b(?:authorization|proxy-authorization)\s*[:=]\s*[^\s,;]+/i,
  /\bbearer\s+[a-z0-9._~+/-]+=*/i,
  /\b(?:cookie|set-cookie)\s*[:=]\s*[^\r\n;]+/i,
  /\b(?:token|secret|api[_-]?key|password|jwt|session)\s*[:=]\s*[^\s,;]+/i,
  /\bmanual\s+note\b/i,
  /\bmanual[_-]?review[_-]?notes?\b/i,
  /\bnote\s+body\b/i,
  /\bgenerated\s+(?:suggestion|helper)\b/i,
  /\b(?:drop\s+table|delete\s+from|truncate\s+table|drop\s+index|update\s+[\w".]+\s+set|insert\s+into|replace\s+into|merge\s+into|alter\s+table)\b/i,
  /https?:\/\/(?:localhost|127\.0\.0\.1|10\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.|internal\.|[^/\s]+\.workers\.dev|[^/\s]+\.cloudflareworkers\.com)[^\s]*/i,
]);

export const LEVEL1_FUTURE_PRODUCTION_PROOF_EVIDENCE_REQUIRED_FIELDS = Object.freeze([
  'schemaVersion',
  'documentStatus',
  'evidenceType',
  'generatedAt',
  'boundary',
  'notProductionEvidence',
  'productionReady',
  'productionReviewerWorkflowReady',
  'approvalStatus',
  'sourcePacketPath',
  'repo',
  'issueRefs',
  'prerequisites',
  'ownerChecklist',
  'evidenceRequirements',
  'abortConditions',
  'redactionRules',
  'operatorDryRun',
  'nonClaims',
]);

export const LEVEL1_FUTURE_PRODUCTION_PROOF_EVIDENCE_BOUNDARY =
  'NOT_PRODUCTION_EVIDENCE';

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function isForbiddenEvidenceField(field) {
  if (FORBIDDEN_EVIDENCE_FIELDS.has(field)) return true;
  return FORBIDDEN_EVIDENCE_FIELD_PATTERNS.some((pattern) => pattern.test(field));
}

function formatFieldPath(path) {
  return path.map((part) => String(part)).join('.');
}

function collectForbiddenEvidenceFieldPaths(value, path = []) {
  if (path.length > 0 && isForbiddenEvidenceField(String(path[path.length - 1]))) {
    return [formatFieldPath(path)];
  }
  if (!value || typeof value !== 'object') return [];
  const entries = Array.isArray(value)
    ? value.map((item, index) => [index, item])
    : Object.entries(value);
  return entries.flatMap(([field, item]) => (
    collectForbiddenEvidenceFieldPaths(item, path.concat(field))
  ));
}

function isIsoTimestamp(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

function normalizeStatus(status) {
  const normalized = String(status || 'BLOCKED').trim().toUpperCase();
  return ['PASS', 'BLOCKED', 'HOLD'].includes(normalized) ? normalized : 'BLOCKED';
}

function level1SchemaMetadataKey(record = {}) {
  return `${record.tableName || ''}:${record.columnName || record.indexName || ''}`;
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
  if (typeof value === 'string' && FORBIDDEN_EVIDENCE_TEXT_PATTERNS.some((pattern) => pattern.test(value))) {
    return '[REDACTED]';
  }
  return value;
}

export function validateLevel1ManualReviewNotesSchemaMetadata(record = {}) {
  const result = validateLevel1D1ObservationEvidence(record);
  const key = level1SchemaMetadataKey(record);
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
  const observedKeys = new Set(evidence.map(level1SchemaMetadataKey));
  const missingRecordKeys = LEVEL1_MANUAL_REVIEW_NOTES_SCHEMA_METADATA_REQUIRED_KEYS
    .filter((key) => !observedKeys.has(key));
  const invalidRecords = evidence
    .map((record, index) => ({ index, ...validateLevel1ManualReviewNotesSchemaMetadata(record) }))
    .filter((result) => !result.ok);
  const ok = invalidRecords.length === 0 && missingRecordKeys.length === 0;

  return {
    status: ok ? 'PASS_LOCAL' : 'HOLD',
    source: 'local_fixture_metadata_only',
    productionD1Observed: false,
    productionReady: false,
    evidenceBoundary: 'NOT_PRODUCTION_EVIDENCE',
    records: evidence,
    missingRecordKeys,
    invalidRecords,
    nextAction: ok ? 'LOCAL_ONLY_NO_PRODUCTION_ACTION' : 'HOLD_FOR_OWNER_APPROVAL',
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

const DESTRUCTIVE_ROLLBACK_ACTION_PATTERNS = Object.freeze([
  /\bdelete\b/i,
  /\bdrop\b/i,
  /\btruncate\b/i,
  /\bdestroy\b/i,
  /\bwipe\b/i,
  /\bpurge\b/i,
  /\bupdate\s+[\w".]+\s+set\b/i,
  /\binsert\s+into\b/i,
  /\breplace\s+into\b/i,
  /\bmerge\s+into\b/i,
  /\balter\s+table\b/i,
  /\bcreate\s+(?:table|index|trigger)\b/i,
  /\bremove\s+rows?\b/i,
  /\bdelete\s+rows?\b/i,
  /\brollback\s+execution\b/i,
]);

export function evaluateLevel1RollbackGate({
  trigger = 'unspecified',
  stopWrites = false,
  requestedAction = '',
} = {}) {
  const action = String(requestedAction || '');
  const blockers = [];

  if (stopWrites !== true) {
    blockers.push({
      reason: 'stop_write_not_enabled',
      status: 'HOLD',
      detail: 'Level 1 rollback/backout must stop writes before repair, rollback, or evidence capture.',
    });
  }

  if (DESTRUCTIVE_ROLLBACK_ACTION_PATTERNS.some((pattern) => pattern.test(action))) {
    blockers.push({
      reason: 'destructive_rollback_request_refused',
      status: 'HOLD',
      detail: 'Destructive or mutating rollback, cleanup, SQL change, purge, delete, drop, truncate, or row removal is not approved.',
    });
  }

  return {
    status: blockers.length === 0 ? 'PASS_LOCAL' : 'HOLD',
    productionReady: false,
    productionActionApproved: false,
    rollbackExecutionApproved: false,
    destructiveDataActionApproved: false,
    blockers,
    rollbackGuard: buildLevel1RollbackStopWriteGuard(trigger),
    nonClaims: [
      'This is a local-only rollback gate evaluation.',
      'This does not execute rollback, cleanup, repair, migration, D1 access, endpoint calls, deploy, or destructive data action.',
      'Owner approval remains required before any rollback execution.',
    ],
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

export function buildLevel1FutureProductionProofEvidenceArtifact(overrides = {}) {
  return {
    schemaVersion: 'level1.future_production_proof_evidence.v1',
    documentStatus: 'LEVEL1_FUTURE_PRODUCTION_PROOF_EVIDENCE_SCHEMA_NON_PRODUCTION',
    evidenceType: 'REDACTED_FUTURE_PROOF_SCHEMA_ONLY',
    generatedAt: new Date().toISOString(),
    boundary: LEVEL1_FUTURE_PRODUCTION_PROOF_EVIDENCE_BOUNDARY,
    notProductionEvidence: true,
    productionReady: false,
    productionReviewerWorkflowReady: false,
    approvalStatus: 'HOLD_PENDING_SEPARATE_EXPLICIT_FUTURE_PROOF_GOAL',
    sourcePacketPath: 'docs/roadmap/b2b-lead-agent-level-1-production-proof-approval-packet-non-production.md',
    repo: 'dooosp/b2b-lead-agent',
    issueRefs: {
      privacy: 'https://github.com/dooosp/b2b-lead-agent/issues/154',
      authProviderSession: 'https://github.com/dooosp/b2b-lead-agent/issues/162',
      productionD1Observation: 'https://github.com/dooosp/b2b-lead-agent/issues/163',
      rollbackStopWrite: 'https://github.com/dooosp/b2b-lead-agent/issues/164',
      finalProofApproval: 'https://github.com/dooosp/b2b-lead-agent/issues/165',
      reviewerFeedback: 'https://github.com/dooosp/b2b-lead-agent/issues/144',
    },
    prerequisites: [
      'Separate explicit future production proof goal is present.',
      'Exact command, endpoint, D1, fixture, evidence, rollback, and stop-condition boundary is approved.',
      'Local approval packet dry-run passes without production/staging/D1/secret/provider blockers.',
    ],
    ownerChecklist: {
      productOwner: '@dooosp / Taeho Jang',
      opsOwner: '@dooosp / Taeho Jang',
      securityOwner: '@dooosp / Taeho Jang',
      privacyOwner: '@dooosp / Taeho Jang',
      dbOwner: '@dooosp / Taeho Jang',
      rollbackOwner: '@dooosp / Taeho Jang',
    },
    evidenceRequirements: [
      'Use redacted non-secret pass/fail outcomes only.',
      'Use synthetic fixtures or approved non-customer metadata only.',
      'Keep manual note body text, generated suggestion text, provider inputs, raw auth/session material, logs, secrets, and customer/private data out of evidence.',
    ],
    abortConditions: [
      'Abort if production/staging access is requested without a separate explicit future proof goal.',
      'Abort if generated suggestions persist, export, enter history, receive attribution, or appear in evidence.',
      'Abort if protected manual note fields leak to manager, API client, missing, unknown, expired, wrong-audience, or provider-error roles.',
      'Abort if redaction cannot be guaranteed before capture.',
    ],
    redactionRules: [
      'Redact secrets, tokens, cookies, auth headers, JWT/session claims, account IDs, database IDs, private URLs, names, emails, user IDs, customer payloads, manual note body text, generated suggestion text, CRM/outreach data, logs, and private lead/person fields.',
    ],
    operatorDryRun: {
      required: true,
      command: 'npm run proof:level1:approval-dry-run',
      allowedBoundary: 'local_only_non_production',
    },
    nonClaims: [
      'This schema is not production proof.',
      'This schema does not approve production/staging D1, endpoints, logs, secrets, customer/private data, CRM, outreach, LLM, automation, deploy, or production readiness.',
      'productionReady remains false.',
    ],
    ...overrides,
  };
}

export function validateLevel1FutureProductionProofEvidenceArtifact(artifact = {}) {
  const missingFields = LEVEL1_FUTURE_PRODUCTION_PROOF_EVIDENCE_REQUIRED_FIELDS
    .filter((field) => !hasOwn(artifact, field));
  const invalidFields = [];

  if (hasOwn(artifact, 'generatedAt') && !isIsoTimestamp(artifact.generatedAt)) {
    invalidFields.push('generatedAt');
  }
  if (hasOwn(artifact, 'boundary') && artifact.boundary !== LEVEL1_FUTURE_PRODUCTION_PROOF_EVIDENCE_BOUNDARY) {
    invalidFields.push('boundary');
  }
  if (hasOwn(artifact, 'notProductionEvidence') && artifact.notProductionEvidence !== true) {
    invalidFields.push('notProductionEvidence');
  }
  if (hasOwn(artifact, 'productionReady') && artifact.productionReady !== false) {
    invalidFields.push('productionReady');
  }
  if (hasOwn(artifact, 'productionReviewerWorkflowReady') && artifact.productionReviewerWorkflowReady !== false) {
    invalidFields.push('productionReviewerWorkflowReady');
  }
  if (
    hasOwn(artifact, 'approvalStatus')
    && !/HOLD|NO_NOT_UNTIL_SEPARATE_EXPLICIT_FUTURE_PROOF_GOAL/.test(String(artifact.approvalStatus))
  ) {
    invalidFields.push('approvalStatus');
  }

  const forbiddenFieldPaths = collectForbiddenEvidenceFieldPaths(artifact);

  return {
    ok: missingFields.length === 0
      && invalidFields.length === 0
      && forbiddenFieldPaths.length === 0,
    missingFields,
    invalidFields,
    forbiddenFieldPaths,
  };
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
