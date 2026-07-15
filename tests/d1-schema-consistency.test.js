const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  DRIFT_CRITICAL_COLUMNS,
  EXPECTED_LEADS_COLUMNS,
  EXPECTED_ANALYTICS_COLUMNS,
  EXPECTED_STATUS_LOG_COLUMNS,
  EXPECTED_JOB_RUN_COLUMNS,
  EXPECTED_CANONICAL_INDEXES,
  EXPECTED_MANUAL_REVIEW_NOTE_EVENT_COLUMNS,
  EXPECTED_REVIEWER_FEEDBACK_COLUMNS,
  EXPECTED_REVIEWER_FEEDBACK_EVENT_COLUMNS,
  EXPECTED_REFERENCE_LIBRARY_COLUMNS,
  EXPECTED_SNAPSHOT_HEAD_COLUMNS,
  EXPECTED_SNAPSHOT_ENTRY_COLUMNS,
  EXPECTED_SNAPSHOT_INDEXES,
  validateSchemaSources,
} = require('../scripts/check-d1-schema-consistency.js');

const repoRoot = path.resolve(__dirname, '..');
const schemaSql = fs.readFileSync(path.join(repoRoot, 'worker/schema.sql'), 'utf8');
const migrationManifest = fs.readFileSync(
  path.join(repoRoot, 'worker/db/migration-manifest.js'),
  'utf8'
);

function assertSameMembers(actual, expected) {
  assert.deepEqual([...actual].sort(), [...expected].sort());
}

function assertSameIndexes(actual, expected) {
  const byName = (left, right) => left.name.localeCompare(right.name);
  assert.deepEqual([...actual].sort(byName), [...expected].sort(byName));
}

test('canonical SQL and explicit migration manifest cover the complete D1 schema', () => {
  const result = validateSchemaSources({ schemaSql, migrationManifest });

  assert.deepEqual(result.errors, []);
  assertSameMembers(result.sources.schemaSqlCreateColumns, EXPECTED_LEADS_COLUMNS);
  assertSameMembers(result.sources.migrationManifestCreateColumns, EXPECTED_LEADS_COLUMNS);
  assertSameMembers(result.sources.migrationLeadColumns, EXPECTED_LEADS_COLUMNS);
  assertSameMembers(
    result.sources.schemaSqlTables.analytics.map(({ name }) => name),
    EXPECTED_ANALYTICS_COLUMNS
  );
  assertSameMembers(
    result.sources.migrationManifestTables.analytics.map(({ name }) => name),
    EXPECTED_ANALYTICS_COLUMNS
  );
  assertSameMembers(
    result.sources.schemaSqlTables.status_log.map(({ name }) => name),
    EXPECTED_STATUS_LOG_COLUMNS
  );
  assertSameMembers(
    result.sources.migrationManifestTables.status_log.map(({ name }) => name),
    EXPECTED_STATUS_LOG_COLUMNS
  );
  assertSameMembers(
    result.sources.schemaSqlTables.job_runs.map(({ name }) => name),
    EXPECTED_JOB_RUN_COLUMNS
  );
  assertSameMembers(
    result.sources.migrationManifestTables.job_runs.map(({ name }) => name),
    EXPECTED_JOB_RUN_COLUMNS
  );
  assertSameMembers(
    result.sources.schemaSqlManualReviewNoteEventColumns,
    EXPECTED_MANUAL_REVIEW_NOTE_EVENT_COLUMNS
  );
  assertSameMembers(
    result.sources.migrationManifestManualReviewNoteEventColumns,
    EXPECTED_MANUAL_REVIEW_NOTE_EVENT_COLUMNS
  );
  assertSameMembers(result.sources.schemaSqlReviewerFeedbackColumns, EXPECTED_REVIEWER_FEEDBACK_COLUMNS);
  assertSameMembers(
    result.sources.migrationManifestReviewerFeedbackColumns,
    EXPECTED_REVIEWER_FEEDBACK_COLUMNS
  );
  assertSameMembers(
    result.sources.schemaSqlReviewerFeedbackEventColumns,
    EXPECTED_REVIEWER_FEEDBACK_EVENT_COLUMNS
  );
  assertSameMembers(
    result.sources.migrationManifestReviewerFeedbackEventColumns,
    EXPECTED_REVIEWER_FEEDBACK_EVENT_COLUMNS
  );
  assertSameMembers(
    result.sources.schemaSqlTables.reference_library.map(({ name }) => name),
    EXPECTED_REFERENCE_LIBRARY_COLUMNS
  );
  assertSameMembers(
    result.sources.schemaSqlTables.published_snapshot_heads.map(({ name }) => name),
    EXPECTED_SNAPSHOT_HEAD_COLUMNS
  );
  assertSameMembers(
    result.sources.schemaSqlTables.published_snapshot_entries.map(({ name }) => name),
    EXPECTED_SNAPSHOT_ENTRY_COLUMNS
  );
  assert.deepEqual(
    result.sources.schemaSqlIndexes.filter(({ table }) => table === 'published_snapshot_entries'),
    EXPECTED_SNAPSHOT_INDEXES
  );
  assert.deepEqual(
    result.sources.migrationManifestIndexes.filter(({ table }) => table === 'published_snapshot_entries'),
    EXPECTED_SNAPSHOT_INDEXES
  );
  assertSameIndexes(result.sources.schemaSqlIndexes, EXPECTED_CANONICAL_INDEXES);
  assertSameIndexes(result.sources.migrationManifestIndexes, EXPECTED_CANONICAL_INDEXES);
  for (const column of DRIFT_CRITICAL_COLUMNS) {
    assert.ok(result.sources.migrationLeadColumns.includes(column));
  }
});

test('checker reports snapshot table and index drift', () => {
  const missingTable = schemaSql.replace(
    /CREATE TABLE IF NOT EXISTS published_snapshot_heads \([\s\S]*?\);\n\n/,
    ''
  );
  const tableResult = validateSchemaSources({ schemaSql: missingTable, migrationManifest });
  assert.equal(tableResult.ok, false);
  assert.ok(
    tableResult.errors.some((error) => error.includes('CREATE TABLE published_snapshot_heads parse failed')),
    tableResult.errors.join('\n')
  );

  const missingIndex = schemaSql.replace(
    /CREATE INDEX IF NOT EXISTS idx_published_snapshot_entries_lookup[\s\S]*?;\n/,
    ''
  );
  const indexResult = validateSchemaSources({ schemaSql: missingIndex, migrationManifest });
  assert.equal(indexResult.ok, false);
  assert.ok(
    indexResult.errors.some((error) => error.includes('missing expected index idx_published_snapshot_entries_lookup')),
    indexResult.errors.join('\n')
  );
});

test('checker reports review metadata and reference-library drift', () => {
  for (const table of [
    'analytics',
    'status_log',
    'manual_review_note_events',
    'reviewer_feedback',
    'reviewer_feedback_events',
    'job_runs',
    'reference_library',
  ]) {
    const drifted = schemaSql.replace(
      new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\([\\s\\S]*?\\);\\n`),
      ''
    );
    const result = validateSchemaSources({ schemaSql: drifted, migrationManifest });
    assert.equal(result.ok, false, table);
    assert.ok(
      result.errors.some((error) => error.includes(`CREATE TABLE ${table} parse failed`)),
      `${table}:\n${result.errors.join('\n')}`
    );
  }
});

test('checker reports core lead, analytics, status, and job index drift', () => {
  for (const indexName of [
    'idx_leads_identity_key',
    'idx_analytics_created',
    'idx_status_log_lead',
    'idx_job_runs_active_profile',
  ]) {
    const drifted = schemaSql.replace(
      new RegExp(`CREATE (?:UNIQUE )?INDEX IF NOT EXISTS ${indexName}[\\s\\S]*?;\\n`),
      ''
    );
    const result = validateSchemaSources({ schemaSql: drifted, migrationManifest });
    assert.equal(result.ok, false, indexName);
    assert.ok(
      result.errors.some((error) => error.includes(`missing expected index ${indexName}`)),
      `${indexName}:\n${result.errors.join('\n')}`
    );
  }
});

test('checker reports partial job-run index predicate drift in either source', () => {
  const driftedSql = schemaSql.replace(
    "WHERE state IN ('accepted', 'running')",
    "WHERE state = 'running'"
  );
  const sqlResult = validateSchemaSources({ schemaSql: driftedSql, migrationManifest });
  assert.equal(sqlResult.ok, false);
  assert.ok(
    sqlResult.errors.some((error) => error.includes('idx_job_runs_active_profile WHERE mismatch')),
    sqlResult.errors.join('\n')
  );

  const driftedManifest = migrationManifest.replace(
    "WHERE idempotency_key IS NOT NULL AND idempotency_key != ''",
    'WHERE idempotency_key IS NOT NULL'
  );
  const manifestResult = validateSchemaSources({ schemaSql, migrationManifest: driftedManifest });
  assert.equal(manifestResult.ok, false);
  assert.ok(
    manifestResult.errors.some((error) => error.includes('idx_job_runs_idempotency WHERE mismatch')),
    manifestResult.errors.join('\n')
  );
});

test('checker reports critical lead-column and definition drift in either source', () => {
  const missingSqlColumn = schemaSql.replace("\n  data_gaps TEXT DEFAULT '[]',", '');
  const missingResult = validateSchemaSources({ schemaSql: missingSqlColumn, migrationManifest });
  assert.equal(missingResult.ok, false);
  assert.ok(
    missingResult.errors.some((error) => error.includes('CREATE TABLE leads missing expected columns: data_gaps')),
    missingResult.errors.join('\n')
  );

  const driftedManifest = migrationManifest.replaceAll(
    "Object.freeze({ name: 'generation_mode', definition: \"TEXT DEFAULT 'llm'\" })",
    "Object.freeze({ name: 'generation_mode', definition: \"TEXT DEFAULT 'heuristic'\" })"
  );
  const definitionResult = validateSchemaSources({ schemaSql, migrationManifest: driftedManifest });
  assert.equal(definitionResult.ok, false);
  assert.ok(
    definitionResult.errors.some((error) => error.includes('generation_mode definition mismatch')),
    definitionResult.errors.join('\n')
  );
});

test('checker requires every explicit migration version in fresh SQL and manifest', () => {
  const missingSqlVersion = schemaSql.replace(
    /INSERT OR IGNORE INTO d1_schema_migrations \(version, name, applied_at\)\n  VALUES \(2,[\s\S]*?;\n/,
    ''
  );
  const sqlResult = validateSchemaSources({ schemaSql: missingSqlVersion, migrationManifest });
  assert.equal(sqlResult.ok, false);
  assert.ok(sqlResult.errors.includes(
    'worker/schema.sql missing migration ledger version 2 name separate_published_snapshot_artifacts'
  ));

  const missingManifestVersion = migrationManifest.replace('    version: 2,', '    schemaVersion: 2,');
  const manifestResult = validateSchemaSources({ schemaSql, migrationManifest: missingManifestVersion });
  assert.equal(manifestResult.ok, false);
  assert.ok(manifestResult.errors.includes(
    'worker/db/migration-manifest.js missing migration version 2 name separate_published_snapshot_artifacts'
  ));

  const missingSqlVersionThree = schemaSql.replace(
    /INSERT OR IGNORE INTO d1_schema_migrations \(version, name, applied_at\)\n  VALUES \(3,[\s\S]*?;\n/,
    ''
  );
  const sqlVersionThreeResult = validateSchemaSources({
    schemaSql: missingSqlVersionThree,
    migrationManifest,
  });
  assert.equal(sqlVersionThreeResult.ok, false);
  assert.ok(sqlVersionThreeResult.errors.includes(
    'worker/schema.sql missing migration ledger version 3 name lead_cas_and_job_callback_idempotency'
  ));

  const missingManifestVersionThree = migrationManifest.replace('    version: 3,', '    schemaVersion: 3,');
  const manifestVersionThreeResult = validateSchemaSources({
    schemaSql,
    migrationManifest: missingManifestVersionThree,
  });
  assert.equal(manifestVersionThreeResult.ok, false);
  assert.ok(manifestVersionThreeResult.errors.includes(
    'worker/db/migration-manifest.js missing migration version 3 name lead_cas_and_job_callback_idempotency'
  ));
});

test('checker pins deployed migration meaning even when both schema sources drift together', () => {
  const driftedSchema = schemaSql.replace(
    'leads_count INTEGER DEFAULT 0',
    'leads_count INTEGER DEFAULT 7'
  );
  const driftedManifest = migrationManifest.replace(
    'leads_count INTEGER DEFAULT 0',
    'leads_count INTEGER DEFAULT 7'
  );
  const result = validateSchemaSources({
    schemaSql: driftedSchema,
    migrationManifest: driftedManifest,
  });

  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((error) => error.includes('deployed migration 1 fingerprint mismatch')),
    result.errors.join('\n')
  );

  const strictPattern = /(CREATE TABLE IF NOT EXISTS analytics \([\s\S]*?\n\s*\))([`;])/;
  const strictSchema = schemaSql.replace(strictPattern, '$1 STRICT$2');
  const strictManifest = migrationManifest.replace(strictPattern, '$1 STRICT$2');
  const strictResult = validateSchemaSources({
    schemaSql: strictSchema,
    migrationManifest: strictManifest,
  });
  assert.equal(strictResult.ok, false);
  assert.ok(
    strictResult.errors.some((error) => error.includes('deployed migration 1 fingerprint mismatch')),
    strictResult.errors.join('\n')
  );

  const profileIndex = 'CREATE INDEX IF NOT EXISTS idx_leads_profile ON leads(profile_id)';
  const partialProfileIndex = `${profileIndex} WHERE profile_id != ''`;
  const partialResult = validateSchemaSources({
    schemaSql: schemaSql.replace(profileIndex, partialProfileIndex),
    migrationManifest: migrationManifest.replace(profileIndex, partialProfileIndex),
  });
  assert.equal(partialResult.ok, false);
  assert.ok(
    partialResult.errors.some((error) => error.includes('deployed migration 1 fingerprint mismatch')),
    partialResult.errors.join('\n')
  );
});

test('checker rejects every extra statement in immutable migration arrays', () => {
  const injectedLedgerNameManifest = migrationManifest.replace(
    "export const D1_SCHEMA_MIGRATION_TABLE = 'd1_schema_migrations';",
    "export const D1_SCHEMA_MIGRATION_TABLE = 'd1_schema_migrations; DROP TABLE leads; --';"
  );
  const injectedLedgerNameResult = validateSchemaSources({
    schemaSql,
    migrationManifest: injectedLedgerNameManifest,
  });
  assert.equal(injectedLedgerNameResult.ok, false);
  assert.ok(
    injectedLedgerNameResult.errors.some((error) => error.includes(
      'deployed migration 1 statement contract mismatch'
    )),
    injectedLedgerNameResult.errors.join('\n')
  );

  const destructiveLedgerManifest = migrationManifest.replace(
    ')`;\n\nexport const CREATE_LEADS_TABLE_SQL',
    ")` + '; DROP TABLE leads';\n\nexport const CREATE_LEADS_TABLE_SQL"
  );
  const destructiveLedgerResult = validateSchemaSources({
    schemaSql,
    migrationManifest: destructiveLedgerManifest,
  });
  assert.equal(destructiveLedgerResult.ok, false);
  assert.ok(
    destructiveLedgerResult.errors.some((error) => error.includes(
      'CREATE_MIGRATION_LEDGER_SQL must end after its static string literal'
    )),
    destructiveLedgerResult.errors.join('\n')
  );

  const destructiveManifest = migrationManifest.replace(
    'export const V1_CREATE_TABLE_STATEMENTS = Object.freeze([',
    "export const V1_CREATE_TABLE_STATEMENTS = Object.freeze([\n  'DROP TABLE leads',"
  );
  const destructiveResult = validateSchemaSources({
    schemaSql,
    migrationManifest: destructiveManifest,
  });
  assert.equal(destructiveResult.ok, false);
  assert.ok(
    destructiveResult.errors.some((error) => error.includes(
      'deployed migration 1 statement contract mismatch'
    )),
    destructiveResult.errors.join('\n')
  );

  const destructiveAliasManifest = migrationManifest.replace(
    ')`;\n\nexport const V1_CREATE_TABLE_STATEMENTS',
    '); DROP TABLE leads`;\n\nexport const V1_CREATE_TABLE_STATEMENTS'
  );
  const destructiveAliasResult = validateSchemaSources({
    schemaSql,
    migrationManifest: destructiveAliasManifest,
  });
  assert.equal(destructiveAliasResult.ok, false);
  assert.ok(
    destructiveAliasResult.errors.some((error) => error.includes(
      'deployed migration 1 statement contract mismatch'
    )),
    destructiveAliasResult.errors.join('\n')
  );

  const constantTailManifest = migrationManifest.replace(
    ')`;\n\nexport const V1_CREATE_TABLE_STATEMENTS',
    ")` + '; DROP TABLE leads';\n\nexport const V1_CREATE_TABLE_STATEMENTS"
  );
  const constantTailResult = validateSchemaSources({
    schemaSql,
    migrationManifest: constantTailManifest,
  });
  assert.equal(constantTailResult.ok, false);
  assert.ok(
    constantTailResult.errors.some((error) => error.includes(
      'CREATE_LEADS_TABLE_SQL must end after its static string literal'
    )),
    constantTailResult.errors.join('\n')
  );

  const wrapperTailManifest = migrationManifest.replace(
    '\n]);\n\nexport const V1_INDEX_STATEMENTS',
    "\n]).concat(['DROP TABLE leads']);\n\nexport const V1_INDEX_STATEMENTS"
  );
  const wrapperTailResult = validateSchemaSources({
    schemaSql,
    migrationManifest: wrapperTailManifest,
  });
  assert.equal(wrapperTailResult.ok, false);
  assert.ok(
    wrapperTailResult.errors.some((error) => error.includes(
      'V1_CREATE_TABLE_STATEMENTS must end after Object.freeze([...])'
    )),
    wrapperTailResult.errors.join('\n')
  );

  const extraReadManifest = migrationManifest.replace(
    'export const V2_INDEX_STATEMENTS = Object.freeze([',
    "export const V2_INDEX_STATEMENTS = Object.freeze([\n  'SELECT 1',"
  );
  const extraReadResult = validateSchemaSources({
    schemaSql,
    migrationManifest: extraReadManifest,
  });
  assert.equal(extraReadResult.ok, false);
  assert.ok(
    extraReadResult.errors.some((error) => error.includes(
      'deployed migration 2 statement contract mismatch'
    )),
    extraReadResult.errors.join('\n')
  );

  const rewiredManifest = migrationManifest.replace(
    'createTables: V1_CREATE_TABLE_STATEMENTS,',
    "createTables: Object.freeze([...V1_CREATE_TABLE_STATEMENTS, 'DROP TABLE leads']),"
  );
  const rewiredResult = validateSchemaSources({
    schemaSql,
    migrationManifest: rewiredManifest,
  });
  assert.equal(rewiredResult.ok, false);
  assert.ok(
    rewiredResult.errors.some((error) => error.includes(
      'immutable migration binding contract mismatch'
    )),
    rewiredResult.errors.join('\n')
  );
});

test('checker compares full table constraints and rejects unexpected fresh-schema objects', () => {
  const missingUnique = schemaSql.replace(
    ',\n  UNIQUE (profile_id, artifact_kind, snapshot_id, lead_id)',
    ''
  );
  const uniqueResult = validateSchemaSources({ schemaSql: missingUnique, migrationManifest });
  assert.equal(uniqueResult.ok, false);
  assert.ok(
    uniqueResult.errors.some((error) => error.includes(
      'published_snapshot_entries full CREATE TABLE mismatch'
    )),
    uniqueResult.errors.join('\n')
  );

  const addedConstraint = schemaSql.replace(
    'state TEXT NOT NULL,',
    "state TEXT NOT NULL CHECK (state <> 'forbidden'),"
  );
  const constraintResult = validateSchemaSources({
    schemaSql: addedConstraint,
    migrationManifest,
  });
  assert.equal(constraintResult.ok, false);
  assert.ok(
    constraintResult.errors.some((error) => error.includes('job_runs full CREATE TABLE mismatch')),
    constraintResult.errors.join('\n')
  );

  const extraTable = `${schemaSql}\nCREATE TABLE IF NOT EXISTS unexpected_table (id TEXT);\n`;
  const extraResult = validateSchemaSources({ schemaSql: extraTable, migrationManifest });
  assert.equal(extraResult.ok, false);
  assert.ok(
    extraResult.errors.some((error) => error.includes('table:unexpected_table')),
    extraResult.errors.join('\n')
  );

  const extraManifestObject = migrationManifest.replace(
    "export const V1_INDEX_STATEMENTS = Object.freeze([",
    "export const V1_INDEX_STATEMENTS = Object.freeze([\n  `CREATE TABLE IF NOT EXISTS surprise_store (id TEXT)`,"
  );
  const extraManifestResult = validateSchemaSources({
    schemaSql,
    migrationManifest: extraManifestObject,
  });
  assert.equal(extraManifestResult.ok, false);
  assert.ok(
    extraManifestResult.errors.some((error) => error.includes('table:surprise_store')),
    extraManifestResult.errors.join('\n')
  );
});
