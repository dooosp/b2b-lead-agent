import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LEVEL1_D1_OBSERVATION_ALLOWED_METADATA_FIELDS,
  LEVEL1_MANUAL_REVIEW_NOTES_SCHEMA_METADATA_FIXTURE,
  buildLevel1LocalD1ObservationMetadata,
  buildLevel1ReadinessScorecard,
  buildLevel1RollbackStopWriteGuard,
  evaluateLevel1RollbackGate,
  redactLevel1EvidenceRecord,
  validateLevel1ManualReviewNotesSchemaMetadata,
  validateLevel1D1ObservationEvidence
} from '../lib/level1-readiness-guards.js';

test('Level 1 D1 observation guard allows schema metadata fields only', () => {
  assert.deepEqual(LEVEL1_D1_OBSERVATION_ALLOWED_METADATA_FIELDS, [
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

  const safeResult = validateLevel1D1ObservationEvidence({
    tableName: 'leads',
    columnName: 'manual_review_notes_updated_at',
    columnType: 'TEXT',
    notNull: false,
    defaultValue: null,
    primaryKey: false,
    indexName: 'idx_manual_review_note_events_lead',
    unique: false,
    origin: 'c',
    partial: false,
  });

  assert.deepEqual(safeResult, { ok: true, forbiddenFields: [] });

  const unsafeResult = validateLevel1D1ObservationEvidence({
    tableName: 'leads',
    columnName: 'notes',
    rowData: [{ notes: 'real note body must not appear' }],
    rowCount: 1,
    databaseId: 'private-db-id',
    authHeader: 'Bearer secret',
    generatedSuggestionText: 'generated text',
    defaultValue: { nestedSecret: 'not allowed' },
  });

  assert.equal(unsafeResult.ok, false);
  assert.deepEqual(unsafeResult.forbiddenFields, [
    'rowData',
    'rowCount',
    'databaseId',
    'authHeader',
    'generatedSuggestionText',
    'defaultValue',
  ]);
});

test('Level 1 local D1 observation metadata fixture covers manual-note schema without row data', () => {
  const observation = buildLevel1LocalD1ObservationMetadata();
  const fixtureKeys = LEVEL1_MANUAL_REVIEW_NOTES_SCHEMA_METADATA_FIXTURE.map((record) => [
    record.tableName,
    record.columnName || record.indexName,
  ]);

  assert.equal(observation.source, 'local_fixture_metadata_only');
  assert.equal(observation.productionD1Observed, false);
  assert.equal(observation.productionReady, false);
  assert.equal(observation.evidenceBoundary, 'NOT_PRODUCTION_EVIDENCE');
  assert.deepEqual(observation.invalidRecords, []);
  assert.deepEqual(fixtureKeys, [
    ['leads', 'notes'],
    ['leads', 'manual_review_notes_author_label'],
    ['leads', 'manual_review_notes_updated_at'],
    ['manual_review_note_events', 'lead_id'],
    ['manual_review_note_events', 'event_type'],
    ['manual_review_note_events', 'changed_at'],
    ['manual_review_note_events', 'author_label'],
    ['manual_review_note_events', 'idx_manual_review_note_events_lead'],
  ]);
  assert.equal(JSON.stringify(observation).includes('manualNoteBodyText'), false);
  assert.equal(JSON.stringify(observation).includes('rowData'), false);
  assert.equal(JSON.stringify(observation).includes('rowCount'), false);
});

test('Level 1 local D1 observation metadata fails closed on missing columns or index drift', () => {
  const driftedRecords = LEVEL1_MANUAL_REVIEW_NOTES_SCHEMA_METADATA_FIXTURE
    .filter((record) => (
      record.columnName !== 'manual_review_notes_updated_at'
        && record.indexName !== 'idx_manual_review_note_events_lead'
    ));

  const observation = buildLevel1LocalD1ObservationMetadata(driftedRecords);

  assert.equal(observation.status, 'HOLD');
  assert.equal(observation.productionD1Observed, false);
  assert.equal(observation.productionReady, false);
  assert.equal(observation.evidenceBoundary, 'NOT_PRODUCTION_EVIDENCE');
  assert.deepEqual(observation.invalidRecords, []);
  assert.ok(observation.missingRecordKeys.includes('leads:manual_review_notes_updated_at'));
  assert.ok(observation.missingRecordKeys.includes('manual_review_note_events:idx_manual_review_note_events_lead'));
  assert.equal(observation.nextAction, 'HOLD_FOR_OWNER_APPROVAL');
});

test('Level 1 manual-note schema metadata rejects non-manual-note table or index combinations', () => {
  assert.deepEqual(
    validateLevel1ManualReviewNotesSchemaMetadata({
      tableName: 'leads',
      columnName: 'manual_review_notes_updated_at',
      columnType: 'TEXT',
      notNull: false,
      defaultValue: null,
      primaryKey: false,
    }),
    { ok: true, forbiddenFields: [] }
  );

  const invalidColumn = validateLevel1ManualReviewNotesSchemaMetadata({
    tableName: 'leads',
    columnName: 'article_body',
    columnType: 'TEXT',
    notNull: false,
    defaultValue: null,
    primaryKey: false,
  });
  const invalidIndex = validateLevel1ManualReviewNotesSchemaMetadata({
    tableName: 'manual_review_note_events',
    indexName: 'idx_private_customer_rows',
    unique: false,
    origin: 'c',
    partial: false,
  });

  assert.equal(invalidColumn.ok, false);
  assert.equal(invalidIndex.ok, false);
  assert.deepEqual(invalidColumn.forbiddenFields, ['tableName']);
  assert.deepEqual(invalidIndex.forbiddenFields, ['tableName']);
});

test('Level 1 rollback guard is stop-write and non-destructive first', () => {
  const guard = buildLevel1RollbackStopWriteGuard('generated_suggestion_boundary_failure');

  assert.deepEqual(guard, {
    trigger: 'generated_suggestion_boundary_failure',
    stopWrites: true,
    nonDestructiveBackoutFirst: true,
    preserveExistingData: true,
    preserveRedactedEvidenceOnly: true,
    productionActionApproved: false,
    destructiveDataActionApproved: false,
    rollbackExecutionApproved: false,
    nextAction: 'HOLD_FOR_OWNER_APPROVAL',
  });
});

test('Level 1 rollback gate blocks stop-write disabled and destructive rollback requests', () => {
  const missingStopWrite = evaluateLevel1RollbackGate({
    trigger: 'fault_injection_stop_write_disabled',
    stopWrites: false,
    requestedAction: 'repair metadata only',
  });
  const destructiveRequest = evaluateLevel1RollbackGate({
    trigger: 'fault_injection_destructive_rollback',
    stopWrites: true,
    requestedAction: 'DROP TABLE manual_review_note_events',
  });
  const mutatingSqlRequest = evaluateLevel1RollbackGate({
    trigger: 'fault_injection_mutating_sql_rollback',
    stopWrites: true,
    requestedAction: "UPDATE leads SET notes = ''",
  });
  const localSafe = evaluateLevel1RollbackGate({
    trigger: 'fault_injection_non_destructive_backout',
    stopWrites: true,
    requestedAction: 'preserve existing data and capture redacted evidence only',
  });

  assert.equal(missingStopWrite.status, 'HOLD');
  assert.deepEqual(missingStopWrite.blockers.map((blocker) => blocker.reason), ['stop_write_not_enabled']);
  assert.equal(missingStopWrite.productionReady, false);
  assert.equal(missingStopWrite.rollbackGuard.stopWrites, true);
  assert.equal(destructiveRequest.status, 'HOLD');
  assert.deepEqual(destructiveRequest.blockers.map((blocker) => blocker.reason), ['destructive_rollback_request_refused']);
  assert.equal(destructiveRequest.rollbackGuard.destructiveDataActionApproved, false);
  assert.equal(mutatingSqlRequest.status, 'HOLD');
  assert.deepEqual(mutatingSqlRequest.blockers.map((blocker) => blocker.reason), ['destructive_rollback_request_refused']);
  assert.equal(mutatingSqlRequest.destructiveDataActionApproved, false);
  assert.equal(localSafe.status, 'PASS_LOCAL');
  assert.deepEqual(localSafe.blockers, []);
  assert.equal(localSafe.productionReady, false);
  assert.equal(localSafe.rollbackExecutionApproved, false);
});

test('Level 1 evidence redaction drops forbidden evidence fields without mutating the input record', () => {
  const original = {
    status: 'PASS',
    route: '/api/leads',
    manualNoteBodyText: 'human note body',
    generatedSuggestionText: 'generated helper',
    token: 'secret-token',
    cookie: 'secret-cookie',
    authHeader: 'Bearer secret',
    customerPayload: { company: 'private customer' },
    databaseId: 'private-db-id',
  };

  const redacted = redactLevel1EvidenceRecord(original);

  assert.deepEqual(redacted, {
    status: 'PASS',
    route: '/api/leads',
    manualNoteBodyText: '[REDACTED]',
    generatedSuggestionText: '[REDACTED]',
    token: '[REDACTED]',
    cookie: '[REDACTED]',
    authHeader: '[REDACTED]',
    customerPayload: '[REDACTED]',
    databaseId: '[REDACTED]',
  });
  assert.equal(original.manualNoteBodyText, 'human note body');
});

test('Level 1 evidence redaction is recursive and pattern-based for nested proof records', () => {
  const original = {
    status: 'PASS',
    nested: {
      providerToken: 'nested-token',
      reviewer: {
        manualNoteBodyText: 'nested manual body',
        generatedReviewSuggestionText: 'nested generated helper',
      },
    },
    events: [
      {
        route: '/api/leads',
        cookieValue: 'nested-cookie',
        safeLabel: 'local-fixture',
      },
    ],
  };

  const redacted = redactLevel1EvidenceRecord(original);

  assert.deepEqual(redacted, {
    status: 'PASS',
    nested: {
      providerToken: '[REDACTED]',
      reviewer: {
        manualNoteBodyText: '[REDACTED]',
        generatedReviewSuggestionText: '[REDACTED]',
      },
    },
    events: [
      {
        route: '/api/leads',
        cookieValue: '[REDACTED]',
        safeLabel: 'local-fixture',
      },
    ],
  });
  assert.equal(original.nested.providerToken, 'nested-token');
});

test('Level 1 readiness scorecard stays blocked without production proof approval', () => {
  const scorecard = buildLevel1ReadinessScorecard({
    authProviderSessionScaffold: 'PASS',
    localProofSimulation: 'PASS',
    d1SchemaGuard: 'PASS',
    rollbackGuard: 'PASS',
    privacyGuard: 'PASS',
    productionProofApproval: 'HOLD',
  });

  assert.equal(scorecard.overallStatus, 'BLOCKED');
  assert.equal(scorecard.productionReviewerWorkflowReady, false);
  assert.equal(scorecard.boundaryConfirmation, 'NON_PRODUCTION_ONLY');
  assert.deepEqual(scorecard.items.map((item) => [item.id, item.status]), [
    ['auth_provider_session_scaffold_non_production', 'PASS'],
    ['local_proof_simulation_fake_d1', 'PASS'],
    ['d1_schema_guard_local_only', 'PASS'],
    ['rollback_stop_write_guard_local_only', 'PASS'],
    ['privacy_generated_suggestion_guard_local_only', 'PASS'],
    ['production_proof_approval', 'HOLD'],
  ]);
  assert.match(scorecard.nonClaims.join('\n'), /production reviewer workflow readiness/);
});
