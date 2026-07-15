import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { getLeadById, updateLeadPatchAtomic } from '../db/leads.js';
import { applyJobCallbackEvent, getJobRunByRequestId } from '../db/job-runs.js';
import { ensureD1Schema } from '../db/schema.js';

const SQLITE_COMMAND = process.env.SQLITE3_BIN || 'sqlite3';
const SCHEMA_SQL = fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');

function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Non-finite SQLite bind value');
    return String(value);
  }
  return `'${String(value).replaceAll("'", "''")}'`;
}

function bindSql(sql, args) {
  let index = 0;
  const rendered = sql.replace(/\?/g, () => {
    if (index >= args.length) throw new Error('Missing SQLite bind value');
    const value = sqlLiteral(args[index]);
    index += 1;
    return value;
  });
  if (index !== args.length) throw new Error('Unused SQLite bind value');
  return rendered;
}

function sqlite(databasePath, input, args = []) {
  const result = spawnSync(SQLITE_COMMAND, [...args, databasePath], {
    input,
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'SQLite execution failed').trim());
  }
  return result.stdout;
}

class SqliteStatement {
  constructor(db, sql, args = []) {
    this.db = db;
    this.sql = sql;
    this.args = args;
  }

  bind(...args) {
    return new SqliteStatement(this.db, this.sql, args);
  }

  run() {
    return this.db.run(this.sql, this.args);
  }

  all() {
    return { results: this.db.all(this.sql, this.args) };
  }

  first() {
    return this.db.all(this.sql, this.args)[0] || null;
  }
}

class SqliteD1Database {
  constructor(databasePath) {
    this.databasePath = databasePath;
  }

  prepare(sql) {
    return new SqliteStatement(this, sql);
  }

  run(sql, args = []) {
    const rendered = bindSql(sql, args).replace(/;\s*$/, '');
    const output = sqlite(
      this.databasePath,
      `.bail on\n${rendered};\nSELECT '__D1_CHANGE__' || changes();\n`
    );
    const changes = Number(/__D1_CHANGE__(\d+)/.exec(output)?.[1] || 0);
    return { success: true, meta: { changes } };
  }

  all(sql, args = []) {
    const rendered = bindSql(sql, args);
    const result = spawnSync(SQLITE_COMMAND, ['-json', this.databasePath, rendered], {
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error((result.stderr || result.stdout).trim());
    return result.stdout.trim() ? JSON.parse(result.stdout) : [];
  }

  batch(statements) {
    const rendered = statements.map((statement, index) => {
      const sql = bindSql(statement.sql, statement.args).replace(/;\s*$/, '');
      return `${sql};\nSELECT '__D1_CHANGE_${index}__' || changes();`;
    }).join('\n');
    const output = sqlite(
      this.databasePath,
      `.bail on\nBEGIN IMMEDIATE;\n${rendered}\nCOMMIT;\n`
    );
    return statements.map((_, index) => ({
      success: true,
      meta: {
        changes: Number(new RegExp(`__D1_CHANGE_${index}__(\\d+)`).exec(output)?.[1] || 0),
      },
    }));
  }

  execute(sql) {
    sqlite(this.databasePath, `.bail on\n${sql}\n`);
  }
}

function createDatabase(t) {
  const available = spawnSync(SQLITE_COMMAND, ['-version'], { encoding: 'utf8' });
  assert.equal(available.status, 0, `${SQLITE_COMMAND} is required for realistic concurrency tests`);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'b2b-lead-concurrency-sqlite-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const db = new SqliteD1Database(path.join(directory, 'concurrency.sqlite3'));
  db.execute(SCHEMA_SQL);
  return db;
}

function seedLead(db, id = 'lead-sqlite') {
  db.execute(`
    INSERT INTO leads (
      id, profile_id, source, status, review_status, company, notes,
      created_at, updated_at
    ) VALUES (
      '${id}', 'danfoss', 'managed', 'NEW', 'NEEDS_REVIEW', 'Synthetic SQLite Lead', '',
      '2026-07-10T00:00:00.000Z', '2026-07-10T00:00:00.000Z'
    );
  `);
}

function seedJob(db, requestId = 'req_sqlite') {
  db.execute(`
    INSERT INTO job_runs (
      request_id, profile_id, target, state, accepted_at, updated_at
    ) VALUES (
      '${requestId}', 'danfoss', 'github-actions', 'accepted',
      '2026-07-10T00:00:00.000Z', '2026-07-10T00:00:00.000Z'
    );
  `);
}

test('real SQLite proves lead CAS gates side effects and rolls the row back on event failure', async (t) => {
  const db = createDatabase(t);
  seedLead(db);
  const original = await getLeadById(db, 'lead-sqlite');

  const accepted = await updateLeadPatchAtomic(db, original, {
    manualReviewNotes: 'SQLite winner note',
    status: 'CONTACTED',
    reviewerFeedback: {
      actionUsefulness: 'useful',
      feedbackText: 'Synthetic SQLite feedback.',
    },
  }, { expectedVersion: 1 });
  assert.equal(accepted.lead.version, 2);
  assert.equal(accepted.lead.manualReviewNotes, 'SQLite winner note');
  assert.equal(accepted.lead.status, 'CONTACTED');
  assert.equal(accepted.lead.reviewerFeedback.actionUsefulness, 'useful');

  await assert.rejects(
    updateLeadPatchAtomic(db, original, { manualReviewNotes: 'SQLite stale note' }, { expectedVersion: 1 }),
    (error) => error.code === 'LEAD_VERSION_CONFLICT' && error.currentVersion === 2
  );
  assert.deepEqual(db.all(
    'SELECT version, notes FROM leads WHERE id = ?',
    ['lead-sqlite']
  ), [{ version: 2, notes: 'SQLite winner note' }]);
  assert.equal(db.all(
    'SELECT event_type FROM manual_review_note_events WHERE lead_id = ?',
    ['lead-sqlite']
  ).length, 1);
  assert.equal(db.all(
    'SELECT id FROM status_log WHERE lead_id = ?',
    ['lead-sqlite']
  ).length, 1);
  assert.equal(db.all(
    'SELECT lead_id FROM reviewer_feedback WHERE lead_id = ?',
    ['lead-sqlite']
  ).length, 1);
  assert.equal(db.all(
    'SELECT id FROM reviewer_feedback_events WHERE lead_id = ?',
    ['lead-sqlite']
  ).length, 1);

  const rollbackDb = createDatabase(t);
  seedLead(rollbackDb, 'lead-rollback');
  await ensureD1Schema(rollbackDb);
  const rollbackLead = await getLeadById(rollbackDb, 'lead-rollback');
  rollbackDb.execute(`
    CREATE TRIGGER fail_manual_note_event
    BEFORE INSERT ON manual_review_note_events
    BEGIN
      SELECT RAISE(ABORT, 'synthetic side-effect failure');
    END;
  `);
  await assert.rejects(
    updateLeadPatchAtomic(
      rollbackDb,
      rollbackLead,
      { manualReviewNotes: 'must roll back', status: 'CONTACTED' },
      { expectedVersion: 1 }
    ),
    /synthetic side-effect failure/
  );
  assert.deepEqual(rollbackDb.all(
    'SELECT version, notes, status FROM leads WHERE id = ?',
    ['lead-rollback']
  ), [{ version: 1, notes: '', status: 'NEW' }]);
  assert.equal(rollbackDb.all(
    'SELECT id FROM status_log WHERE lead_id = ?',
    ['lead-rollback']
  ).length, 0);
});

test('real SQLite proves callback idempotency, attempt ordering, and terminal absorption', async (t) => {
  const db = createDatabase(t);
  const requestId = 'req_sqlite_callback';
  seedJob(db, requestId);
  const oldAttempt = await applyJobCallbackEvent(db, requestId, {
    eventId: 'event-attempt-1-running',
    idempotencyKey: 'attempt-1-running',
    payloadHash: '0'.repeat(64),
    target: 'github-actions',
    providerAttempt: 1,
    state: 'running',
    githubRunId: 1001,
    githubRunAttempt: 1,
    githubRunUrl: 'https://github.example/runs/1001',
    githubWorkflow: 'Synthetic old workflow',
    githubSha: 'old-sha',
  });
  const event = {
    eventId: 'event-attempt-2-running',
    idempotencyKey: 'attempt-2-running',
    payloadHash: 'a'.repeat(64),
    target: 'github-actions',
    providerAttempt: 2,
    state: 'running',
    githubRunId: 2002,
    githubRunAttempt: 2,
  };

  const applied = await applyJobCallbackEvent(db, requestId, event);
  const afterHigherAttempt = await getJobRunByRequestId(db, requestId);
  const replayed = await applyJobCallbackEvent(db, requestId, event);
  const mismatch = await applyJobCallbackEvent(db, requestId, {
    ...event,
    payloadHash: 'b'.repeat(64),
  });
  const stale = await applyJobCallbackEvent(db, requestId, {
    eventId: 'event-attempt-1-terminal',
    idempotencyKey: 'attempt-1-terminal',
    payloadHash: 'c'.repeat(64),
    target: 'github-actions',
    providerAttempt: 1,
    state: 'succeeded',
    githubRunId: 1001,
    githubRunAttempt: 1,
  });
  const staleReplay = await applyJobCallbackEvent(db, requestId, {
    eventId: 'event-attempt-1-terminal',
    idempotencyKey: 'attempt-1-terminal',
    payloadHash: 'c'.repeat(64),
    target: 'github-actions',
    providerAttempt: 1,
    state: 'succeeded',
    githubRunId: 1001,
    githubRunAttempt: 1,
  });
  const staleMismatch = await applyJobCallbackEvent(db, requestId, {
    eventId: 'event-attempt-1-terminal',
    idempotencyKey: 'attempt-1-terminal',
    payloadHash: '9'.repeat(64),
    target: 'github-actions',
    providerAttempt: 1,
    state: 'failed',
    githubRunId: 1001,
    githubRunAttempt: 1,
  });
  const terminal = await applyJobCallbackEvent(db, requestId, {
    eventId: 'event-attempt-2-terminal',
    idempotencyKey: 'attempt-2-terminal',
    payloadHash: 'd'.repeat(64),
    target: 'github-actions',
    providerAttempt: 2,
    state: 'succeeded',
    githubRunId: 2002,
    githubRunAttempt: 2,
  });
  const lateHigherAttempt = await applyJobCallbackEvent(db, requestId, {
    eventId: 'event-attempt-3-running',
    idempotencyKey: 'attempt-3-running',
    payloadHash: 'e'.repeat(64),
    target: 'github-actions',
    providerAttempt: 3,
    state: 'running',
    githubRunId: 3003,
    githubRunAttempt: 3,
  });

  assert.equal(oldAttempt.outcome, 'applied');
  assert.equal(applied.outcome, 'applied');
  assert.equal(afterHigherAttempt.run.url, null);
  assert.equal(afterHigherAttempt.run.workflow, null);
  assert.equal(afterHigherAttempt.run.sha, null);
  assert.equal(replayed.outcome, 'replayed');
  assert.equal(mismatch.outcome, 'idempotency-mismatch');
  assert.equal(stale.outcome, 'rejected');
  assert.equal(staleReplay.outcome, 'rejected');
  assert.equal(staleMismatch.outcome, 'idempotency-mismatch');
  assert.equal(terminal.outcome, 'applied');
  assert.equal(lateHigherAttempt.outcome, 'rejected');
  const job = await getJobRunByRequestId(db, requestId);
  assert.equal(job.state, 'succeeded');
  assert.equal(job.providerAttempt, 2);
  assert.equal(job.run.id, 2002);
  assert.deepEqual(db.all(
    `SELECT outcome, COUNT(*) AS count
     FROM job_callback_events WHERE request_id = ?
     GROUP BY outcome ORDER BY outcome`,
    [requestId]
  ), [
    { outcome: 'applied', count: 3 },
    { outcome: 'rejected', count: 2 },
  ]);

  const rollbackDb = createDatabase(t);
  const rollbackRequestId = 'req_sqlite_callback_rollback';
  seedJob(rollbackDb, rollbackRequestId);
  await ensureD1Schema(rollbackDb);
  rollbackDb.execute(`
    CREATE TRIGGER fail_callback_event
    BEFORE INSERT ON job_callback_events
    BEGIN
      SELECT RAISE(ABORT, 'synthetic callback-event failure');
    END;
  `);
  await assert.rejects(
    applyJobCallbackEvent(rollbackDb, rollbackRequestId, {
      eventId: 'event-must-roll-back',
      idempotencyKey: 'event-must-roll-back',
      payloadHash: 'f'.repeat(64),
      target: 'github-actions',
      providerAttempt: 1,
      state: 'running',
      githubRunId: 4004,
      githubRunAttempt: 1,
    }),
    /synthetic callback-event failure/
  );
  assert.deepEqual(rollbackDb.all(
    'SELECT state, provider_attempt, last_callback_event_id FROM job_runs WHERE request_id = ?',
    [rollbackRequestId]
  ), [{ state: 'accepted', provider_attempt: 0, last_callback_event_id: '' }]);
});
