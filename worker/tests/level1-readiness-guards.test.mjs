import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LEVEL1_D1_OBSERVATION_ALLOWED_METADATA_FIELDS,
  buildLevel1ReadinessScorecard,
  buildLevel1RollbackStopWriteGuard,
  redactLevel1EvidenceRecord,
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
  });

  assert.equal(unsafeResult.ok, false);
  assert.deepEqual(unsafeResult.forbiddenFields, [
    'rowData',
    'rowCount',
    'databaseId',
    'authHeader',
    'generatedSuggestionText',
  ]);
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
