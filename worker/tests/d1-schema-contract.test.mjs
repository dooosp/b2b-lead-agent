import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import {
  CANONICAL_D1_CRITICAL_COLUMN_SPECS,
  CANONICAL_D1_INDEX_SPECS,
  CANONICAL_D1_TABLE_COLUMN_NAMES,
  CREATE_MIGRATION_LEDGER_SQL,
  CREATE_LEADS_TABLE_SQL,
  D1_MIGRATION_MANIFEST,
  LEADS_COLUMN_DEFINITIONS,
  LATEST_D1_SCHEMA_VERSION,
  V1_LEADS_COLUMN_DEFINITIONS,
  V1_CREATE_TABLE_STATEMENTS,
  V1_INDEX_STATEMENTS,
  V2_CREATE_TABLE_STATEMENTS,
  V2_INDEX_STATEMENTS,
  V3_CREATE_TABLE_STATEMENTS,
  V3_INDEX_STATEMENTS,
  buildD1SchemaIntrospectionQuery,
  buildD1SchemaObjectIntrospectionQuery,
} from '../db/migration-manifest.js';
import { D1_SCHEMA_NOT_READY_CODE, ensureD1Schema } from '../db/schema.js';
import { FakeD1Database } from './helpers/fake-d1.mjs';

const DEPLOYED_RUNTIME_MIGRATION_FINGERPRINTS = Object.freeze({
  1: '168d82f3d640db2d1a74e3450060ef56840efc777f1cdbf4078abd4c07eb58c1',
  2: '5f606cbb454cb8ff1786edd1a6408ec4bd5e219a55de3f4b96628bb6993c0783',
  3: '6585dccd70d7686795bdc6203ad4e260e1ea99713d3927a5ae36c04f62e92737',
});

function runtimeMigrationFingerprint(migration) {
  const contract = {
    version: migration.version,
    name: migration.name,
    tables: migration.tables,
    introspectLeads: migration.introspectLeads,
    createTables: migration.createTables,
    indexes: migration.indexes,
    ledgerSql: migration.version === 1 ? CREATE_MIGRATION_LEDGER_SQL : null,
    leadColumnDefinitions: migration.version === 1 ? V1_LEADS_COLUMN_DEFINITIONS : null,
    ...(migration.version === 3 ? {
      addLeadColumns: migration.addLeadColumns,
      addJobRunColumns: migration.addJobRunColumns,
    } : {}),
  };
  return createHash('sha256').update(JSON.stringify(contract)).digest('hex');
}

test('deployed runtime migration payloads have immutable semantic fingerprints', () => {
  assert.deepEqual(
    D1_MIGRATION_MANIFEST.map(({ version }) => version),
    Array.from({ length: LATEST_D1_SCHEMA_VERSION }, (_, index) => index + 1)
  );
  assert.deepEqual(
    Object.fromEntries(D1_MIGRATION_MANIFEST.map((migration) => [
      migration.version,
      runtimeMigrationFingerprint(migration),
    ])),
    DEPLOYED_RUNTIME_MIGRATION_FINGERPRINTS
  );
});

test('explicit D1 manifest preserves conservative lead, review, and snapshot contracts', async () => {
  for (const [tableName, columnNames] of Object.entries(CANONICAL_D1_TABLE_COLUMN_NAMES)) {
    assert.deepEqual(
      Object.keys(CANONICAL_D1_CRITICAL_COLUMN_SPECS[tableName] || {}).sort(),
      [...columnNames].sort(),
      `${tableName} must validate every canonical column definition`
    );
  }

  const ddl = [
    ...V1_CREATE_TABLE_STATEMENTS,
    ...V1_INDEX_STATEMENTS,
    ...V2_CREATE_TABLE_STATEMENTS,
    ...V2_INDEX_STATEMENTS,
    ...V3_CREATE_TABLE_STATEMENTS,
    ...V3_INDEX_STATEMENTS,
  ].join('\n');

  assert.match(CREATE_LEADS_TABLE_SQL, /identity_key TEXT DEFAULT ''/);
  assert.match(CREATE_LEADS_TABLE_SQL, /status TEXT NOT NULL DEFAULT 'NEW'/);
  assert.match(CREATE_LEADS_TABLE_SQL, /review_status TEXT NOT NULL DEFAULT 'NEEDS_REVIEW'/);
  assert.match(CREATE_LEADS_TABLE_SQL, /sources TEXT DEFAULT '\[\]'/);
  assert.match(CREATE_LEADS_TABLE_SQL, /manual_review_notes_author_label TEXT/);
  assert.match(CREATE_LEADS_TABLE_SQL, /manual_review_notes_updated_at TEXT/);
  assert.match(CREATE_LEADS_TABLE_SQL, /generation_mode TEXT DEFAULT 'llm'/);
  assert.match(CREATE_LEADS_TABLE_SQL, /verification_status TEXT DEFAULT 'needs_review'/);
  assert.match(CREATE_LEADS_TABLE_SQL, /data_gaps TEXT DEFAULT '\[\]'/);
  assert.match(ddl, /CREATE TABLE IF NOT EXISTS manual_review_note_events/);
  assert.match(ddl, /event_type TEXT NOT NULL CHECK \(event_type IN \('create', 'edit', 'clear'\)\)/);
  assert.match(ddl, /author_label TEXT NOT NULL DEFAULT 'manual_reviewer' CHECK \(author_label = 'manual_reviewer'\)/);
  assert.match(ddl, /idx_manual_review_note_events_lead/);
  assert.match(ddl, /CREATE TABLE IF NOT EXISTS reviewer_feedback/);
  assert.match(ddl, /action_usefulness TEXT NOT NULL DEFAULT 'unclear'/);
  assert.match(ddl, /outcome_label TEXT NOT NULL DEFAULT 'unknown'/);
  assert.match(ddl, /data_gap_priority TEXT NOT NULL DEFAULT 'none'/);
  assert.match(ddl, /evidence_confidence_adjustment TEXT NOT NULL DEFAULT 'unknown'/);
  assert.match(ddl, /CREATE TABLE IF NOT EXISTS reviewer_feedback_events/);
  assert.match(ddl, /changed_fields TEXT NOT NULL DEFAULT '\[\]'/);
  assert.match(ddl, /CREATE TABLE IF NOT EXISTS reference_library/);
  assert.match(ddl, /target TEXT NOT NULL DEFAULT 'github-actions'/);
  assert.match(ddl, /last_error TEXT DEFAULT ''/);
  assert.match(ddl, /CREATE TABLE IF NOT EXISTS published_snapshot_heads/);
  assert.match(ddl, /artifact_kind TEXT NOT NULL CHECK \(artifact_kind IN \('latest', 'history'\)\)/);
  assert.match(ddl, /PRIMARY KEY \(profile_id, artifact_kind\)/);
  assert.match(ddl, /CREATE TABLE IF NOT EXISTS published_snapshot_entries/);
  assert.match(ddl, /ordinal INTEGER NOT NULL CHECK \(ordinal >= 0\)/);
  assert.match(ddl, /payload_json TEXT NOT NULL/);
  assert.match(ddl, /PRIMARY KEY \(profile_id, artifact_kind, snapshot_id, ordinal\)/);
  assert.match(ddl, /UNIQUE \(profile_id, artifact_kind, snapshot_id, lead_id\)/);
  assert.match(ddl, /idx_published_snapshot_entries_lookup/);
  assert.doesNotMatch(ddl, /old_feedback|new_feedback|feedback_body|previous_feedback|next_feedback/i);
  assert.doesNotMatch(ddl, /old_note|new_note|note_text|note_body|previous_value|next_value/i);

  assert.deepEqual(CANONICAL_D1_TABLE_COLUMN_NAMES.published_snapshot_heads, [
    'profile_id', 'artifact_kind', 'snapshot_id', 'fetched_at',
  ]);
  assert.equal(CANONICAL_D1_CRITICAL_COLUMN_SPECS.leads.id.type, 'TEXT');
  assert.equal(CANONICAL_D1_CRITICAL_COLUMN_SPECS.leads.id.pk, 1);
  assert.equal(CANONICAL_D1_CRITICAL_COLUMN_SPECS.leads.status.defaultValue, "'NEW'");
  assert.equal(CANONICAL_D1_CRITICAL_COLUMN_SPECS.published_snapshot_entries.ordinal.pk, 4);

  const introspectionSql = buildD1SchemaIntrospectionQuery();
  assert.equal((introspectionSql.match(/FROM pragma_table_info\('/g) || []).length, 12);
  assert.equal((introspectionSql.match(/ UNION ALL /g) || []).length, 11);
  assert.match(introspectionSql, /table_name, cid, name, type/);
  assert.match(introspectionSql, /LIMIT \d+$/);
  assert.doesNotMatch(introspectionSql, /CREATE|ALTER|INSERT|UPDATE|DELETE/i);

  const schemaObjectSql = buildD1SchemaObjectIntrospectionQuery();
  assert.match(schemaObjectSql, /FROM sqlite_schema/i);
  assert.match(schemaObjectSql, /type = 'index' AND name IN \(/i);
  assert.match(schemaObjectSql, /LIMIT 28$/i);
  assert.doesNotMatch(schemaObjectSql, /type = 'index'\s+OR/i);
  for (const index of CANONICAL_D1_INDEX_SPECS) {
    assert.match(schemaObjectSql, new RegExp(`'${index.name}'`));
  }
  assert.match(
    CANONICAL_D1_INDEX_SPECS.find(({ name }) => name === 'idx_job_runs_active_profile').normalizedSql,
    /WHERE state IN\('accepted','running'\)$/i
  );
});

test('request-path D1 readiness check is read-only and fails closed by exact version', async () => {
  const db = new FakeD1Database();

  await ensureD1Schema(db);
  await ensureD1Schema(db);
  assert.equal(db.schemaVersion, LATEST_D1_SCHEMA_VERSION);
  assert.deepEqual(db.schemaStatements, []);
  assert.deepEqual(db.batches, []);
  assert.equal(
    db.executedQueries.filter(({ sql }) => (
      sql === 'select version, name from d1_schema_migrations order by version asc limit 4'
    )).length,
    1
  );

  const invalidLedgers = [
    [],
    [{ version: 1, name: 'adopt_canonical_lead_schema' }],
    [
      { version: 1, name: 'adopt_canonical_lead_schema' },
      { version: 2, name: 'separate_published_snapshot_artifacts' },
      { version: 3, name: 'lead_cas_and_job_callback_idempotency' },
      { version: 4, name: 'future' },
    ],
  ];
  for (const migrationLedgerRows of invalidLedgers) {
    await assert.rejects(
      ensureD1Schema(new FakeD1Database({ migrationLedgerRows })),
      (error) => error.code === D1_SCHEMA_NOT_READY_CODE
    );
  }

  await assert.rejects(
    ensureD1Schema(new FakeD1Database({ schemaIntrospectionRows: [] })),
    (error) => error.code === D1_SCHEMA_NOT_READY_CODE && /leads table is missing/.test(error.message)
  );
});

test('fake D1 enforces manual note event metadata-only constraints', async () => {
  const db = new FakeD1Database();

  await db.prepare(
    'INSERT INTO manual_review_note_events (lead_id, event_type, changed_at, author_label) VALUES (?, ?, ?, ?)'
  ).bind('lead-1', 'create', '2026-05-31T00:00:00.000Z', 'manual_reviewer').run();

  assert.throws(
    () => new FakeD1Database({
      manualReviewNoteEvents: [
        {
          lead_id: 'lead-1',
          event_type: 'restore',
          changed_at: '2026-05-31T00:00:00.000Z',
          author_label: 'manual_reviewer',
        },
      ],
    }),
    /manual_review_note_events\.event_type/
  );
  await assert.rejects(
    db.prepare(
      'INSERT INTO manual_review_note_events (lead_id, event_type, changed_at, author_label) VALUES (?, ?, ?, ?)'
    ).bind('lead-1', 'edit', '2026-05-31T00:00:01.000Z', 'named_reviewer').run(),
    /manual_review_note_events\.author_label/
  );
});

test('fake D1 enforces reviewer feedback event metadata-only constraints', async () => {
  const db = new FakeD1Database();

  await db.prepare(
    'INSERT INTO reviewer_feedback_events (lead_id, event_type, changed_at, author_label, changed_fields) VALUES (?, ?, ?, ?, ?)'
  ).bind('lead-1', 'create', '2026-05-31T00:00:00.000Z', 'manual_reviewer', JSON.stringify(['feedbackText'])).run();

  assert.throws(
    () => new FakeD1Database({
      reviewerFeedbackEvents: [
        {
          lead_id: 'lead-1',
          event_type: 'restore',
          changed_at: '2026-05-31T00:00:00.000Z',
          author_label: 'manual_reviewer',
          changed_fields: '["feedbackText"]',
        },
      ],
    }),
    /reviewer_feedback_events\.event_type/
  );
  await assert.rejects(
    db.prepare(
      'INSERT INTO reviewer_feedback_events (lead_id, event_type, changed_at, author_label, changed_fields) VALUES (?, ?, ?, ?, ?)'
    ).bind('lead-1', 'edit', '2026-05-31T00:00:01.000Z', 'named_reviewer', JSON.stringify(['outcomeLabel'])).run(),
    /reviewer_feedback_events\.author_label/
  );
});
