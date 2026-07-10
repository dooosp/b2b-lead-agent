import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

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

  if (result.error) {
    throw new Error(`Unable to execute ${SQLITE_COMMAND}: ${result.error.message}`);
  }
  return result;
}

function assertSqliteAvailable() {
  const result = sqliteInvocation(['-version']);
  assert.equal(result.status, 0, `${SQLITE_COMMAND} must be available for local SQLite migration characterization`);
}

class LocalSqliteD1Database {
  constructor(databasePath, { failRun } = {}) {
    this.databasePath = databasePath;
    this.failRun = failRun;
    this.batchStatements = [];
    this.runStatements = [];
    this.errors = [];
  }

  prepare(sql) {
    return {
      sql,
      run: async () => {
        this.runStatements.push(sql);
        const injected = this.failRun ? this.failRun(sql) : null;
        if (injected) {
          const error = injected instanceof Error ? injected : new Error(String(injected));
          this.errors.push({ phase: 'run', sql, message: error.message });
          throw error;
        }
        this.execute(sql, { phase: 'run' });
        return { success: true };
      },
    };
  }

  async batch(statements) {
    this.batchStatements = statements.map((statement) => statement.sql);
    const transaction = [
      '.bail on',
      'BEGIN IMMEDIATE;',
      ...this.batchStatements.map((sql) => `${sql};`),
      'COMMIT;',
      '',
    ].join('\n');
    const result = sqliteInvocation([this.databasePath], transaction);
    if (result.status !== 0) {
      const message = (result.stderr || result.stdout || 'SQLite batch failed').trim();
      this.errors.push({ phase: 'batch', sql: this.batchStatements.join('\n'), message });
      throw new Error(message);
    }
    return statements.map(() => ({ success: true }));
  }

  execute(sql, { phase = 'fixture' } = {}) {
    const result = sqliteInvocation([this.databasePath], `.bail on\n${sql}\n`);
    if (result.status !== 0) {
      const message = (result.stderr || result.stdout || 'SQLite statement failed').trim();
      this.errors.push({ phase, sql, message });
      throw new Error(message);
    }
  }

  all(sql) {
    const result = sqliteInvocation(['-json', this.databasePath, sql]);
    if (result.status !== 0) {
      const message = (result.stderr || result.stdout || 'SQLite query failed').trim();
      throw new Error(message);
    }
    return result.stdout.trim() ? JSON.parse(result.stdout) : [];
  }
}

function createLegacyDatabase(t, fixtureName, options = {}) {
  assertSqliteAvailable();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'b2b-lead-d1-characterization-'));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));
  const database = new LocalSqliteD1Database(path.join(tempDir, 'legacy.sqlite3'), options);
  database.execute(fs.readFileSync(path.join(fixturesDir, fixtureName), 'utf8'));
  return database;
}

async function loadFreshEnsureD1Schema(label) {
  const moduleUrl = new URL(`../db/schema.js?characterization=${encodeURIComponent(label)}`, import.meta.url);
  return (await import(moduleUrl)).ensureD1Schema;
}

function columnNames(database, table = 'leads') {
  return database.all(`PRAGMA table_info('${table}')`).map((column) => column.name);
}

function indexNames(database, table = 'leads') {
  return database.all(`PRAGMA index_list('${table}')`).map((index) => index.name);
}

test('characterization: current behavior aborts old-schema migration when an index precedes its column', async (t) => {
  const database = createLegacyDatabase(t, 'legacy-leads-v1.sql');
  const ensureD1Schema = await loadFreshEnsureD1Schema('pre-trust-columns');

  await assert.rejects(() => ensureD1Schema(database), /no such column: identity_key/i);

  const columns = columnNames(database);
  const indexes = indexNames(database);

  // This assertion records the current audited behavior. It is not the desired
  // migration contract and is expected to change in the remediation PR.
  assert.equal(columns.includes('identity_key'), false);
  assert.equal(columns.includes('review_status'), false);
  assert.equal(columns.includes('manual_review_notes_updated_at'), false);
  assert.equal(indexes.includes('idx_leads_identity_key'), false);
  assert.equal(indexes.includes('idx_leads_review_status'), false);
  assert.ok(indexes.includes('idx_leads_profile'));
  assert.equal(database.runStatements.some((sql) => /ALTER TABLE leads ADD COLUMN identity_key/i.test(sql)), false);
  assert.match(database.batchStatements[1], /CREATE INDEX IF NOT EXISTS idx_leads_identity_key ON leads\(identity_key\)/i);
});

test('characterization: current behavior reaches the expected schema while swallowing duplicate-column errors', async (t) => {
  const database = createLegacyDatabase(t, 'legacy-leads-leadbrief.sql');
  const ensureD1Schema = await loadFreshEnsureD1Schema('leadbrief-era');

  await ensureD1Schema(database);

  const columns = columnNames(database);
  const indexes = indexNames(database);
  const duplicateErrors = database.errors.filter(({ phase, message }) => phase === 'run' && /duplicate column name/i.test(message));

  assert.deepEqual([...columns].sort(), [...EXPECTED_LEADS_COLUMNS].sort());
  assert.ok(indexes.includes('idx_leads_identity_key'));
  assert.ok(indexes.includes('idx_leads_review_status'));
  assert.ok(indexes.includes('idx_leads_created'));
  assert.ok(duplicateErrors.some(({ message }) => /identity_key/i.test(message)));
  assert.ok(duplicateErrors.some(({ message }) => /review_status/i.test(message)));
});

test('characterization: current behavior ignores an unrelated ALTER failure and leaves partial schema', async (t) => {
  const injectedMessage = 'SQLITE_IOERR_SYNTHETIC_NON_DUPLICATE';
  const database = createLegacyDatabase(t, 'legacy-leads-leadbrief.sql', {
    failRun(sql) {
      if (/ALTER TABLE leads ADD COLUMN manual_review_notes_updated_at TEXT/i.test(sql)) {
        return new Error(injectedMessage);
      }
      return null;
    },
  });
  const ensureD1Schema = await loadFreshEnsureD1Schema('unrelated-alter-error');

  await ensureD1Schema(database);

  const columns = columnNames(database);
  const referenceIndexes = indexNames(database, 'reference_library');

  // This assertion records the current audited behavior. It is not the desired
  // migration contract and is expected to change in the remediation PR.
  assert.equal(columns.includes('manual_review_notes_updated_at'), false);
  assert.ok(columns.includes('manual_review_notes_author_label'));
  assert.ok(columns.includes('event_type'));
  assert.ok(referenceIndexes.includes('idx_ref_profile_cat'));
  assert.ok(database.errors.some(({ message }) => message === injectedMessage));
});

test.todo('desired contract: explicit versioned D1 migrations replace opportunistic request-path migration');
test.todo('desired contract: ALTER columns before creating indexes that reference them');
test.todo('desired contract: ignore only narrowly recognized duplicate-column migration errors');
test.todo('desired contract: surface every unrelated migration failure');
test.todo('desired contract: remove request-path DDL after explicit migrations are established');
