import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import {
  LOCAL_TEST_D1_MIGRATION_TARGET,
  applyLocalTestD1Migrations,
} from '../db/migrations.js';
import { D1_SCHEMA_NOT_READY_CODE, ensureD1Schema } from '../db/schema.js';

const require = createRequire(import.meta.url);
const { EXPECTED_LEADS_COLUMNS } = require('../../scripts/check-d1-schema-consistency.js');
const testDir = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(testDir, 'fixtures');
const SQLITE_COMMAND = process.env.SQLITE3_BIN || 'sqlite3';

function sqliteInvocation(args, input = '') {
  const result = spawnSync(SQLITE_COMMAND, args, {
    input,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
  });
  if (result.error) throw new Error(`Unable to execute ${SQLITE_COMMAND}: ${result.error.message}`);
  return result;
}

function assertSqliteAvailable() {
  const result = sqliteInvocation(['-version']);
  assert.equal(result.status, 0, `${SQLITE_COMMAND} must be available for local SQLite migration tests`);
}

class LocalSqliteD1Database {
  constructor(databasePath, { beforeBatch, failRun } = {}) {
    this.databasePath = databasePath;
    this.beforeBatch = beforeBatch;
    this.failRun = failRun;
    this.batchAttempts = [];
    this.runStatements = [];
    this.queryStatements = [];
    this.localTestMigrationTarget = LOCAL_TEST_D1_MIGRATION_TARGET;
  }

  prepare(sql) {
    const statement = {
      sql,
      args: [],
      bind: (...args) => {
        statement.args = args;
        return statement;
      },
      run: async () => {
        this.runStatements.push(sql);
        const injected = this.failRun ? this.failRun(sql) : null;
        if (injected) throw injected instanceof Error ? injected : new Error(String(injected));
        this.execute(sql, { phase: 'run' });
        return { success: true };
      },
      all: async () => ({ results: this.all(sql) }),
      first: async () => this.all(sql)[0] || null,
    };
    return statement;
  }

  async batch(statements) {
    const sqlStatements = statements.map((statement) => statement.sql);
    this.batchAttempts.push(sqlStatements);
    if (this.beforeBatch) await this.beforeBatch(this, sqlStatements, this.batchAttempts.length);
    const transaction = [
      '.bail on',
      'BEGIN IMMEDIATE;',
      ...sqlStatements.map((sql) => `${sql};`),
      'COMMIT;',
      '',
    ].join('\n');
    const result = sqliteInvocation([this.databasePath], transaction);
    if (result.status !== 0) {
      throw new Error((result.stderr || result.stdout || 'SQLite batch failed').trim());
    }
    return statements.map(() => ({ success: true }));
  }

  execute(sql, { phase = 'fixture' } = {}) {
    const result = sqliteInvocation([this.databasePath], `.bail on\n${sql};\n`);
    if (result.status !== 0) {
      throw new Error(`${phase}: ${(result.stderr || result.stdout || 'SQLite statement failed').trim()}`);
    }
  }

  all(sql) {
    this.queryStatements.push(sql);
    const result = sqliteInvocation(['-json', this.databasePath, sql]);
    if (result.status !== 0) {
      throw new Error((result.stderr || result.stdout || 'SQLite query failed').trim());
    }
    return result.stdout.trim() ? JSON.parse(result.stdout) : [];
  }
}

function createLegacyDatabase(t, fixtureName, options = {}) {
  return createDatabaseFromSql(
    t,
    fs.readFileSync(path.join(fixturesDir, fixtureName), 'utf8'),
    options
  );
}

function createDatabaseFromSql(t, sql = '', options = {}) {
  assertSqliteAvailable();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'b2b-lead-d1-migration-'));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));
  const database = new LocalSqliteD1Database(path.join(tempDir, 'legacy.sqlite3'), options);
  if (sql.trim()) database.execute(sql);
  database.queryStatements = [];
  return database;
}

function columnNames(database, table = 'leads') {
  return database.all(`PRAGMA table_info('${table}')`).map((column) => column.name);
}

function indexNames(database, table = 'leads') {
  return database.all(`PRAGMA index_list('${table}')`).map((index) => index.name);
}

function migrationVersions(database) {
  return database
    .all('SELECT version FROM d1_schema_migrations ORDER BY version ASC')
    .map(({ version }) => Number(version));
}

test('explicit versioned migrations replace opportunistic request-path migration', async (t) => {
  const database = createLegacyDatabase(t, 'legacy-leads-v1.sql');
  database.execute(`INSERT INTO leads
    (id, profile_id, source, status, company, notes, created_at, updated_at)
    VALUES
    ('legacy-sentinel', 'danfoss', 'managed', 'CONTACTED', 'Legacy Sentinel',
     'preserve this human note', '2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z')`);

  await assert.rejects(
    ensureD1Schema(database),
    (error) => error.code === D1_SCHEMA_NOT_READY_CODE
  );
  assert.deepEqual(database.runStatements, []);
  assert.deepEqual(database.batchAttempts, []);

  const result = await applyLocalTestD1Migrations(database);
  assert.deepEqual(result.appliedVersions, [1, 2, 3]);
  assert.deepEqual(migrationVersions(database), [1, 2, 3]);
  await ensureD1Schema(database);
  assert.deepEqual([...columnNames(database)].sort(), [...EXPECTED_LEADS_COLUMNS].sort());
  assert.deepEqual(columnNames(database, 'reference_library'), [
    'id', 'profile_id', 'category', 'client', 'project', 'result',
    'source_url', 'region', 'verified_at', 'created_at',
  ]);
  assert.deepEqual(columnNames(database, 'published_snapshot_heads'), [
    'profile_id', 'artifact_kind', 'snapshot_id', 'fetched_at',
  ]);

  assert.deepEqual(database.all(
    "SELECT id, status, notes, created_at, updated_at FROM leads WHERE id = 'legacy-sentinel'"
  ), [{
    id: 'legacy-sentinel',
    status: 'CONTACTED',
    notes: 'preserve this human note',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
  }]);

  const batchCount = database.batchAttempts.length;
  const repeated = await applyLocalTestD1Migrations(database);
  assert.deepEqual(repeated.appliedVersions, []);
  assert.equal(database.batchAttempts.length, batchCount);
});

test('migration adds missing columns before indexes and records its version last', async (t) => {
  const database = createLegacyDatabase(t, 'legacy-leads-v1.sql');
  await applyLocalTestD1Migrations(database);

  const versionOneBatch = database.batchAttempts[0];
  const identityAlter = versionOneBatch.findIndex((sql) => (
    /ALTER TABLE leads ADD COLUMN identity_key TEXT DEFAULT ''/i.test(sql)
  ));
  const identityIndex = versionOneBatch.findIndex((sql) => (
    /CREATE INDEX IF NOT EXISTS idx_leads_identity_key ON leads\(identity_key\)/i.test(sql)
  ));
  const reviewAlter = versionOneBatch.findIndex((sql) => (
    /ALTER TABLE leads ADD COLUMN review_status/i.test(sql)
  ));
  const reviewIndex = versionOneBatch.findIndex((sql) => (
    /CREATE INDEX IF NOT EXISTS idx_leads_review_status ON leads\(review_status\)/i.test(sql)
  ));

  assert.ok(identityAlter >= 0 && identityIndex > identityAlter);
  assert.ok(reviewAlter >= 0 && reviewIndex > reviewAlter);
  assert.match(versionOneBatch.at(-1), /INSERT INTO d1_schema_migrations .*VALUES \(1,/i);
  assert.match(database.batchAttempts[1].at(-1), /INSERT INTO d1_schema_migrations .*VALUES \(2,/i);
  assert.ok(indexNames(database).includes('idx_leads_identity_key'));
  assert.ok(indexNames(database).includes('idx_leads_review_status'));
});

test('migration retries one narrowly recognized concurrent duplicate-column race only', async (t) => {
  let raced = false;
  const targetAlter = /ALTER TABLE leads ADD COLUMN manual_review_notes_updated_at TEXT/i;
  const database = createLegacyDatabase(t, 'legacy-leads-leadbrief.sql', {
    beforeBatch(db, statements) {
      const sql = statements.find((statement) => targetAlter.test(statement));
      if (!raced && sql) {
        raced = true;
        db.execute(sql, { phase: 'concurrent migration' });
        throw new Error('D1_ERROR: SQLITE_ERROR: duplicate column name: manual_review_notes_updated_at');
      }
      return null;
    },
  });

  await applyLocalTestD1Migrations(database);
  assert.equal(raced, true);
  assert.equal(database.batchAttempts.length, 4);
  assert.ok(database.batchAttempts[0].some((sql) => targetAlter.test(sql)));
  assert.equal(database.batchAttempts[1].some((sql) => targetAlter.test(sql)), false);
  assert.deepEqual(migrationVersions(database), [1, 2, 3]);

  let attempts = 0;
  const retryOnceDatabase = createLegacyDatabase(t, 'legacy-leads-leadbrief.sql', {
    beforeBatch(db, statements) {
      attempts += 1;
      const sql = statements.find((statement) => targetAlter.test(statement));
      if (attempts === 1 && sql) db.execute(sql, { phase: 'concurrent migration' });
      throw new Error('SQLITE_ERROR: duplicate column name: manual_review_notes_updated_at');
    },
  });
  await assert.rejects(
    applyLocalTestD1Migrations(retryOnceDatabase),
    /duplicate column name: manual_review_notes_updated_at/i
  );
  assert.equal(attempts, 2);

  let lookalikeAttempts = 0;
  const lookalikeDatabase = createLegacyDatabase(t, 'legacy-leads-leadbrief.sql', {
    beforeBatch() {
      lookalikeAttempts += 1;
      throw new Error('SQLITE_ERROR: duplicate column policy rejected the request');
    },
  });
  await assert.rejects(applyLocalTestD1Migrations(lookalikeDatabase), /duplicate column policy/);
  assert.equal(lookalikeAttempts, 1);
});

test('migration surfaces unrelated failures without recording a partial version', async (t) => {
  const injectedMessage = 'SQLITE_IOERR_SYNTHETIC_NON_DUPLICATE';
  let attempts = 0;
  const database = createLegacyDatabase(t, 'legacy-leads-leadbrief.sql', {
    beforeBatch() {
      attempts += 1;
      throw new Error(injectedMessage);
    },
  });

  await assert.rejects(applyLocalTestD1Migrations(database), new RegExp(injectedMessage));
  assert.equal(attempts, 1);
  assert.deepEqual(migrationVersions(database), []);
  assert.equal(columnNames(database).includes('manual_review_notes_updated_at'), false);
});

test('request-path readiness is read-only, cached per DB, and rejects future schema versions', async (t) => {
  const database = createLegacyDatabase(t, 'legacy-leads-v1.sql');
  await applyLocalTestD1Migrations(database);
  database.runStatements = [];
  database.batchAttempts = [];
  database.queryStatements = [];

  await ensureD1Schema(database);
  await ensureD1Schema(database);
  assert.deepEqual(database.runStatements, []);
  assert.deepEqual(database.batchAttempts, []);
  assert.equal(
    database.queryStatements.filter((sql) => /SELECT version, name FROM d1_schema_migrations/i.test(sql)).length,
    1
  );
  assert.equal(
    database.queryStatements.filter((sql) => /FROM pragma_table_info\('leads'\)/i.test(sql)).length,
    1
  );
  assert.equal(
    database.queryStatements.filter((sql) => /FROM sqlite_schema/i.test(sql)).length,
    1
  );

  const schemaSource = fs.readFileSync(new URL('../db/schema.js', import.meta.url), 'utf8');
  assert.doesNotMatch(schemaSource, /CREATE\s+TABLE|ALTER\s+TABLE|CREATE\s+INDEX|INSERT\s+INTO/i);

  const futureDatabase = createLegacyDatabase(t, 'legacy-leads-v1.sql');
  await applyLocalTestD1Migrations(futureDatabase);
  futureDatabase.execute(
    "INSERT INTO d1_schema_migrations (version, name, applied_at) VALUES (4, 'future', CURRENT_TIMESTAMP)"
  );
  await assert.rejects(
    ensureD1Schema(futureDatabase),
    (error) => error.code === D1_SCHEMA_NOT_READY_CODE && /unsupported version 4/.test(error.message)
  );
});

test('readiness rejects an exact-looking ledger without canonical tables', async (t) => {
  const database = createDatabaseFromSql(t, `
    CREATE TABLE d1_schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
    INSERT INTO d1_schema_migrations VALUES
      (1, 'adopt_canonical_lead_schema', CURRENT_TIMESTAMP),
      (2, 'separate_published_snapshot_artifacts', CURRENT_TIMESTAMP),
      (3, 'lead_cas_and_job_callback_idempotency', CURRENT_TIMESTAMP);
  `);

  await assert.rejects(
    ensureD1Schema(database),
    (error) => error.code === D1_SCHEMA_NOT_READY_CODE && /leads table is missing/.test(error.message)
  );
  assert.deepEqual(database.runStatements, []);
  assert.deepEqual(database.batchAttempts, []);
});

test('readiness requires the exact contiguous migration version and name chain', async (t) => {
  const missingV1 = createDatabaseFromSql(t);
  await applyLocalTestD1Migrations(missingV1);
  missingV1.execute('DELETE FROM d1_schema_migrations WHERE version = 1');
  await assert.rejects(
    ensureD1Schema(missingV1),
    (error) => error.code === D1_SCHEMA_NOT_READY_CODE
      && /entry 1 version mismatch: 2 !== 1/.test(error.message)
  );

  const wrongName = createDatabaseFromSql(t);
  await applyLocalTestD1Migrations(wrongName);
  wrongName.execute("UPDATE d1_schema_migrations SET name = 'wrong_name' WHERE version = 2");
  await assert.rejects(
    ensureD1Schema(wrongName),
    (error) => error.code === D1_SCHEMA_NOT_READY_CODE
      && /version 2 name mismatch/.test(error.message)
  );
});

test('migration refuses partial existing job, review, and snapshot tables before version recording', async (t) => {
  const legacySql = fs.readFileSync(path.join(fixturesDir, 'legacy-leads-v1.sql'), 'utf8');
  for (const fixture of [
    {
      label: 'job_runs',
      sql: `${legacySql}\nCREATE TABLE job_runs (request_id TEXT PRIMARY KEY);`,
      versions: [],
    },
    {
      label: 'reviewer_feedback',
      sql: `${legacySql}\nCREATE TABLE reviewer_feedback (lead_id TEXT PRIMARY KEY);`,
      versions: [],
    },
    {
      label: 'published_snapshot_heads',
      sql: `${legacySql}\nCREATE TABLE published_snapshot_heads (profile_id TEXT NOT NULL);`,
      versions: [1],
    },
    {
      label: 'published_snapshot_heads',
      sql: `${legacySql}
        CREATE TABLE published_snapshot_heads (
          profile_id TEXT NOT NULL,
          artifact_kind TEXT NOT NULL CHECK (artifact_kind IN ('LATEST', 'HISTORY')),
          snapshot_id TEXT NOT NULL,
          fetched_at TEXT NOT NULL,
          PRIMARY KEY (profile_id, artifact_kind)
        );`,
      versions: [1],
    },
    {
      label: 'published_snapshot_entries',
      sql: `${legacySql}
        CREATE TABLE published_snapshot_entries (
          profile_id TEXT NOT NULL,
          artifact_kind TEXT NOT NULL CHECK (artifact_kind IN ('latest', 'history')),
          snapshot_id TEXT NOT NULL,
          ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
          lead_id TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          PRIMARY KEY (profile_id, artifact_kind, snapshot_id, ordinal)
        );`,
      versions: [1],
    },
  ]) {
    const database = createDatabaseFromSql(t, fixture.sql);
    await assert.rejects(
      applyLocalTestD1Migrations(database),
      (error) => error.code === 'ERR_D1_SCHEMA_INCOMPATIBLE'
        && error.message.includes(fixture.label)
    );
    assert.deepEqual(migrationVersions(database), fixture.versions, fixture.label);
  }
});

test('migration refuses malformed shared lead definitions and a legacy table without id', async (t) => {
  const legacySql = fs.readFileSync(path.join(fixturesDir, 'legacy-leads-v1.sql'), 'utf8');
  const malformedFixtures = [
    legacySql.replace('id TEXT PRIMARY KEY', 'id INTEGER PRIMARY KEY'),
    legacySql.replace('id TEXT PRIMARY KEY', 'id TEXT'),
    legacySql.replace("status TEXT NOT NULL DEFAULT 'NEW'", "status TEXT NOT NULL DEFAULT 'OPEN'"),
    legacySql.replace('id TEXT PRIMARY KEY,\n', ''),
  ];

  for (const sql of malformedFixtures) {
    const database = createDatabaseFromSql(t, sql);
    await assert.rejects(
      applyLocalTestD1Migrations(database),
      (error) => error.code === 'ERR_D1_SCHEMA_INCOMPATIBLE'
    );
    assert.deepEqual(migrationVersions(database), []);
  }
});

test('readiness and adoption reject non-lead column and constraint drift', async (t) => {
  const canonicalSchema = fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
  const mutations = [
    {
      label: 'job_runs.idempotency_key',
      sql: canonicalSchema.replace('idempotency_key TEXT,', 'idempotency_key TEXT NOT NULL,'),
    },
    {
      label: 'analytics.profile_id',
      sql: canonicalSchema.replace('profile_id TEXT,\n  company TEXT,', 'profile_id INTEGER NOT NULL DEFAULT 99,\n  company TEXT,'),
    },
    {
      label: 'published_snapshot_heads',
      sql: canonicalSchema.replace(
        'fetched_at TEXT NOT NULL,\n  PRIMARY KEY (profile_id, artifact_kind)',
        "fetched_at TEXT NOT NULL,\n  CHECK (artifact_kind = 'latest'),\n  PRIMARY KEY (profile_id, artifact_kind)"
      ),
    },
    {
      label: 'published_snapshot_entries',
      sql: canonicalSchema.replace(
        'PRIMARY KEY (profile_id, artifact_kind, snapshot_id, ordinal),\n  UNIQUE (profile_id, artifact_kind, snapshot_id, lead_id)',
        'PRIMARY KEY (profile_id, artifact_kind, snapshot_id, ordinal)\n  -- UNIQUE (profile_id, artifact_kind, snapshot_id, lead_id)'
      ),
    },
    {
      label: 'job_runs',
      sql: canonicalSchema.replace(
        "last_callback_event_id TEXT NOT NULL DEFAULT ''\n);",
        "last_callback_event_id TEXT NOT NULL DEFAULT '',\n  CHECK (state = 'accepted')\n);"
      ),
    },
    {
      label: 'leads',
      sql: canonicalSchema.replace(
        "status TEXT NOT NULL DEFAULT 'NEW',",
        "status TEXT NOT NULL DEFAULT 'NEW' CHECK (status = 'NEW'),"
      ),
    },
    {
      label: 'unexpected_unique_company',
      sql: `${canonicalSchema}\nCREATE UNIQUE INDEX unexpected_unique_company ON leads(company);`,
    },
    {
      label: 'unexpected_leads_trigger',
      sql: `${canonicalSchema}
        CREATE TRIGGER unexpected_leads_trigger BEFORE INSERT ON leads
        BEGIN SELECT RAISE(ABORT, 'blocked'); END;`,
    },
    {
      label: 'd1_schema_migrations',
      sql: canonicalSchema.replace(
        'applied_at TEXT NOT NULL\n);',
        'applied_at TEXT NOT NULL,\n  CHECK (version > 0)\n);'
      ),
    },
  ];

  for (const mutation of mutations) {
    const database = createDatabaseFromSql(t, mutation.sql);
    await assert.rejects(
      ensureD1Schema(database),
      (error) => error.code === D1_SCHEMA_NOT_READY_CODE
        && error.message.includes(mutation.label),
      mutation.label
    );
    await assert.rejects(
      applyLocalTestD1Migrations(database),
      (error) => error.code === 'ERR_D1_SCHEMA_INCOMPATIBLE'
        && error.message.includes(mutation.label),
      mutation.label
    );
    assert.deepEqual(migrationVersions(database), [1, 2, 3]);
  }
});

test('fresh, v1, and LeadBrief-era databases all reach the canonical ready state', async (t) => {
  const databases = [
    createDatabaseFromSql(t),
    createLegacyDatabase(t, 'legacy-leads-v1.sql'),
    createLegacyDatabase(t, 'legacy-leads-leadbrief.sql'),
  ];
  for (const database of databases) {
    const result = await applyLocalTestD1Migrations(database);
    assert.deepEqual(result.appliedVersions, [1, 2, 3]);
    await ensureD1Schema(database);
    assert.deepEqual(migrationVersions(database), [1, 2, 3]);
  }
});

test('v3 migration deterministically adopts an exact partial local schema and rejects malformed callback storage', async (t) => {
  const canonicalSchema = fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
  const partial = createDatabaseFromSql(t, canonicalSchema);
  partial.execute(`
    DELETE FROM d1_schema_migrations WHERE version = 3;
    DROP TABLE job_callback_events;
    ALTER TABLE leads DROP COLUMN last_patch_mutation_id;
    ALTER TABLE job_runs DROP COLUMN last_callback_event_id;
  `);

  const result = await applyLocalTestD1Migrations(partial);
  assert.deepEqual(result.appliedVersions, [3]);
  assert.deepEqual(migrationVersions(partial), [1, 2, 3]);
  assert.ok(columnNames(partial).includes('last_patch_mutation_id'));
  assert.ok(columnNames(partial, 'job_runs').includes('last_callback_event_id'));
  assert.deepEqual(columnNames(partial, 'job_callback_events'), [
    'event_id', 'request_id', 'idempotency_key', 'payload_hash', 'target',
    'provider_attempt', 'state', 'outcome', 'received_at',
  ]);
  await ensureD1Schema(partial);

  const malformed = createDatabaseFromSql(t, canonicalSchema);
  malformed.execute(`
    DELETE FROM d1_schema_migrations WHERE version = 3;
    DROP TABLE job_callback_events;
    CREATE TABLE job_callback_events (event_id TEXT PRIMARY KEY);
  `);
  await assert.rejects(
    applyLocalTestD1Migrations(malformed),
    (error) => error.code === 'ERR_D1_SCHEMA_INCOMPATIBLE'
      && error.message.includes('job_callback_events')
  );
  assert.deepEqual(migrationVersions(malformed), [1, 2]);
});

test('readiness and applied-migration adoption reject missing or altered canonical indexes', async (t) => {
  const mutations = [
    {
      label: 'idx_job_runs_idempotency',
      sql: 'DROP INDEX idx_job_runs_idempotency',
    },
    {
      label: 'idx_job_runs_active_profile',
      sql: `DROP INDEX idx_job_runs_active_profile;
        CREATE UNIQUE INDEX idx_job_runs_active_profile ON job_runs(profile_id)
        WHERE state = 'running'`,
    },
    {
      label: 'idx_job_runs_active_profile',
      sql: `DROP INDEX idx_job_runs_active_profile;
        CREATE UNIQUE INDEX idx_job_runs_active_profile ON job_runs(profile_id)
        WHERE state IN ('ACCEPTED', 'RUNNING')`,
    },
    {
      label: 'idx_published_snapshot_entries_lookup',
      sql: `DROP INDEX idx_published_snapshot_entries_lookup;
        CREATE INDEX idx_published_snapshot_entries_lookup
        ON published_snapshot_entries(profile_id, artifact_kind, snapshot_id)`,
    },
  ];

  for (const mutation of mutations) {
    const database = createDatabaseFromSql(t);
    await applyLocalTestD1Migrations(database);
    database.execute(mutation.sql);

    const coldReadinessBinding = new LocalSqliteD1Database(database.databasePath);
    await assert.rejects(
      ensureD1Schema(coldReadinessBinding),
      (error) => error.code === D1_SCHEMA_NOT_READY_CODE
        && error.message.includes(mutation.label)
    );
    await assert.rejects(
      applyLocalTestD1Migrations(database),
      (error) => error.code === 'ERR_D1_SCHEMA_INCOMPATIBLE'
        && error.message.includes(mutation.label)
    );
    assert.deepEqual(migrationVersions(database), [1, 2, 3]);
  }
});

test('migration helper is local/test-only and records its over-50-query legacy bound', async (t) => {
  const refused = createDatabaseFromSql(t);
  delete refused.localTestMigrationTarget;
  await assert.rejects(
    applyLocalTestD1Migrations(refused),
    (error) => error.code === 'ERR_D1_MIGRATION_LOCAL_TEST_ONLY'
  );
  assert.deepEqual(refused.runStatements, []);
  assert.deepEqual(refused.batchAttempts, []);
  assert.deepEqual(refused.queryStatements, []);

  const legacy = createLegacyDatabase(t, 'legacy-leads-v1.sql');
  await applyLocalTestD1Migrations(legacy);
  const statementCount = legacy.runStatements.length
    + legacy.queryStatements.length
    + legacy.batchAttempts.reduce((total, statements) => total + statements.length, 0);
  assert.equal(statementCount, 69);
  assert.ok(statementCount > 50);
});

test('Worker runtime does not import the local/test migration helper', () => {
  const workerRoot = path.resolve(testDir, '..');
  const runtimeSources = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === 'tests') continue;
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
      } else if (/\.(?:js|mjs)$/.test(entry.name) && entry.name !== 'migrations.js') {
        runtimeSources.push(absolutePath);
      }
    }
  };
  visit(workerRoot);

  for (const sourcePath of runtimeSources) {
    assert.doesNotMatch(
      fs.readFileSync(sourcePath, 'utf8'),
      /applyLocalTestD1Migrations|LOCAL_TEST_D1_MIGRATION_TARGET/,
      sourcePath
    );
  }
});

test('readiness rejects exact-shape leads DDL with altered primary-key clauses or comments', async (t) => {
  const canonicalSql = fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
  const scenarios = [
    {
      label: 'descending primary key',
      sql: canonicalSql.replace('id TEXT PRIMARY KEY,', 'id TEXT PRIMARY KEY DESC,'),
    },
    {
      label: 'comment-obscured conflict policy',
      sql: canonicalSql.replace(
        'id TEXT PRIMARY KEY,',
        'id TEXT PRIMARY KEY ON/*audit*/CONFLICT REPLACE,'
      ),
    },
    {
      label: 'named primary-key constraint',
      sql: canonicalSql.replace(
        'id TEXT PRIMARY KEY,',
        'id TEXT CONSTRAINT leads_pk PRIMARY KEY,'
      ),
    },
  ];

  for (const scenario of scenarios) {
    const database = createDatabaseFromSql(t, scenario.sql);
    await assert.rejects(
      ensureD1Schema(database),
      (error) => (
        error.code === D1_SCHEMA_NOT_READY_CODE
        && /leads canonical per-column CREATE TABLE SQL mismatch/.test(error.message)
      ),
      scenario.label
    );
  }
});

test('migration-ledger readiness reads only the expected chain plus one excess sentinel', async (t) => {
  const canonicalSql = fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
  const database = createDatabaseFromSql(t, canonicalSql);
  database.execute(`INSERT INTO d1_schema_migrations (version, name, applied_at) VALUES
    (4, 'unexpected-four', CURRENT_TIMESTAMP),
    (5, 'unexpected-five', CURRENT_TIMESTAMP),
    (6, 'unexpected-six', CURRENT_TIMESTAMP)`);
  database.queryStatements = [];

  await assert.rejects(
    ensureD1Schema(database),
    (error) => error.code === D1_SCHEMA_NOT_READY_CODE
  );
  const ledgerQuery = database.queryStatements.find((sql) => (
    /FROM d1_schema_migrations ORDER BY version ASC/i.test(sql)
  ));
  assert.match(ledgerQuery, /LIMIT 4$/i);
});
