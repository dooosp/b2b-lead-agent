const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  DRIFT_CRITICAL_COLUMNS,
  EXPECTED_MANUAL_REVIEW_NOTE_EVENT_COLUMNS,
  EXPECTED_LEADS_COLUMNS,
  validateSchemaSources,
} = require('../scripts/check-d1-schema-consistency.js');

const repoRoot = path.resolve(__dirname, '..');
const schemaSql = fs.readFileSync(path.join(repoRoot, 'worker/schema.sql'), 'utf8');
const schemaJs = fs.readFileSync(path.join(repoRoot, 'worker/db/schema.js'), 'utf8');

function assertSameMembers(actual, expected) {
  assert.deepEqual([...actual].sort(), [...expected].sort());
}

test('D1 schema sources cover the full expected leads column set', () => {
  const result = validateSchemaSources({ schemaSql, schemaJs });

  assert.deepEqual(result.errors, []);
  assertSameMembers(result.sources.schemaSqlCreateColumns, EXPECTED_LEADS_COLUMNS);
  assertSameMembers(result.sources.schemaJsCreateColumns, EXPECTED_LEADS_COLUMNS);
  assertSameMembers(result.sources.schemaSqlManualReviewNoteEventColumns, EXPECTED_MANUAL_REVIEW_NOTE_EVENT_COLUMNS);
  assertSameMembers(result.sources.schemaJsManualReviewNoteEventColumns, EXPECTED_MANUAL_REVIEW_NOTE_EVENT_COLUMNS);
  for (const column of DRIFT_CRITICAL_COLUMNS) {
    assert.ok(result.sources.schemaJsLazyAlterColumns.includes(column), `${column} missing from lazy DDL`);
  }
});

test('checker reports manual review note event table drift', () => {
  const driftedSql = schemaSql.replace(/CREATE TABLE IF NOT EXISTS manual_review_note_events \([\s\S]*?\);\nCREATE INDEX IF NOT EXISTS idx_manual_review_note_events_lead[\s\S]*?;\n/, '');
  const result = validateSchemaSources({ schemaSql: driftedSql, schemaJs });

  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((error) => error.includes('worker/schema.sql CREATE TABLE manual_review_note_events')),
    result.errors.join('\n')
  );
});

test('checker reports a critical column missing from worker/schema.sql CREATE TABLE', () => {
  const driftedSql = schemaSql.replace("\n  data_gaps TEXT DEFAULT '[]',", '');
  const result = validateSchemaSources({ schemaSql: driftedSql, schemaJs });

  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((error) => error.includes('worker/schema.sql CREATE TABLE leads missing expected columns: data_gaps')),
    result.errors.join('\n')
  );
});

test('checker reports a critical column missing from lazy ALTER DDL', () => {
  const driftedJs = schemaJs.replace('        "ALTER TABLE leads ADD COLUMN data_gaps TEXT DEFAULT \'[]\'",\n', '');
  const result = validateSchemaSources({ schemaSql, schemaJs: driftedJs });

  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((error) => error.includes('worker/db/schema.js lazy ALTER leads missing expected columns: data_gaps')),
    result.errors.join('\n')
  );
});

test('checker reports mismatched column definitions between SQL and JS CREATE TABLE sources', () => {
  const driftedJs = schemaJs.replace(
    "review_status TEXT NOT NULL DEFAULT 'NEEDS_REVIEW'",
    "review_status TEXT DEFAULT 'NEEDS_REVIEW'"
  );
  const result = validateSchemaSources({ schemaSql, schemaJs: driftedJs });

  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((error) => error.includes('review_status definition mismatch')),
    result.errors.join('\n')
  );
});

test('checker reports lazy ALTER definitions that drift from CREATE TABLE definitions', () => {
  const driftedJs = schemaJs.replace(
    "ALTER TABLE leads ADD COLUMN generation_mode TEXT DEFAULT 'llm'",
    "ALTER TABLE leads ADD COLUMN generation_mode TEXT DEFAULT 'heuristic'"
  );
  const result = validateSchemaSources({ schemaSql, schemaJs: driftedJs });

  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((error) => error.includes('generation_mode lazy ALTER definition mismatch')),
    result.errors.join('\n')
  );
});
