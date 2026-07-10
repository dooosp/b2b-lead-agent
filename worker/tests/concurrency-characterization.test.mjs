import test from 'node:test';
import assert from 'node:assert/strict';

import worker from '../index.js';
import { createJobCallbackToken } from '../lib/job-trigger.js';
import { FakeD1Database, normalizeSql } from './helpers/fake-d1.mjs';
import { createLeadRow, createWorkerEnv } from './helpers/fixtures.mjs';
import { createWorkerRequest, readJson } from './helpers/http.mjs';

const SYNTHETIC_API_TOKEN = 'synthetic-concurrency-api-token';
const SYNTHETIC_CALLBACK_SECRET = 'synthetic-concurrency-callback-secret';
const REVIEWER_ROLE_HEADER = 'X-Manual-Review-Notes-Local-Test-Role';
const ORIGINAL_UPDATED_AT = '2026-07-10T00:00:00.000Z';
const FIRST_NOTE = 'Synthetic first concurrent reviewer note.';
const SECOND_NOTE = 'Synthetic second concurrent reviewer note.';

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

function createBarrier(parties) {
  const open = createDeferred();
  let arrivals = 0;
  return {
    async wait() {
      arrivals += 1;
      if (arrivals === parties) open.resolve();
      await open.promise;
    },
  };
}

class ConcurrentPatchDatabase extends FakeD1Database {
  constructor(options) {
    super(options);
    this.initialReadBarrier = createBarrier(2);
    this.initialLeadReads = [];
    this.firstWriteBlocked = createDeferred();
    this.releaseFirstWrite = createDeferred();
    this.writeOrder = [];
  }

  async executeFirst(sql, args) {
    const normalized = normalizeSql(sql);
    if (normalized === 'select * from leads where id = ?' && this.initialLeadReads.length < 2) {
      const row = await super.executeFirst(sql, args);
      this.initialLeadReads.push({
        id: row?.id,
        notes: row?.notes,
        updatedAt: row?.updated_at,
      });
      await this.initialReadBarrier.wait();
      return row;
    }
    return super.executeFirst(sql, args);
  }

  async batch(statements) {
    const update = statements.find((statement) => normalizeSql(statement.sql).startsWith('update leads set '));
    if (!update) return super.batch(statements);

    const normalized = normalizeSql(update.sql);
    const setClause = normalized.slice('update leads set '.length, normalized.lastIndexOf(' where id = ?'));
    const columns = setClause.split(',').map((part) => part.trim().split(' = ')[0]);
    const notesIndex = columns.indexOf('notes');
    const nextNotes = notesIndex >= 0 ? update.args[notesIndex] : undefined;

    if (nextNotes === FIRST_NOTE) {
      this.firstWriteBlocked.resolve();
      await this.releaseFirstWrite.promise;
      this.writeOrder.push(FIRST_NOTE);
    } else if (nextNotes === SECOND_NOTE) {
      this.writeOrder.push(SECOND_NOTE);
    }

    return super.batch(statements);
  }
}

class StaleJobCallbackDatabase extends FakeD1Database {
  constructor(options) {
    super(options);
    this.runningWriteBlocked = createDeferred();
    this.releaseRunningWrite = createDeferred();
    this.observedJobReads = [];
    this.jobWriteOrder = [];
    this.hasBlockedRunningWrite = false;
  }

  async executeFirst(sql, args) {
    const row = await super.executeFirst(sql, args);
    if (normalizeSql(sql) === 'select * from job_runs where request_id = ? limit 1') {
      this.observedJobReads.push({ requestId: args[0], state: row?.state || null });
    }
    return row;
  }

  async executeRun(sql, args) {
    if (normalizeSql(sql).startsWith('update job_runs set')) {
      const state = args[0];
      if (state === 'running' && !this.hasBlockedRunningWrite) {
        this.hasBlockedRunningWrite = true;
        this.runningWriteBlocked.resolve();
        await this.releaseRunningWrite.promise;
      }
      this.jobWriteOrder.push(state);
    }
    return super.executeRun(sql, args);
  }
}

function createJobRow(overrides = {}) {
  return {
    request_id: 'req_synthetic_concurrency',
    profile_id: 'danfoss',
    target: 'github-actions',
    state: 'accepted',
    idempotency_key: null,
    github_event_type: 'generate-report',
    github_run_id: null,
    github_run_attempt: null,
    github_run_url: '',
    github_workflow: '',
    github_sha: '',
    cloud_run_operation: '',
    cloud_run_execution: '',
    accepted_at: ORIGINAL_UPDATED_AT,
    started_at: null,
    completed_at: null,
    last_error: '',
    updated_at: ORIGINAL_UPDATED_AT,
    ...overrides,
  };
}

function createConcurrencyEnv(db) {
  return createWorkerEnv({
    API_TOKEN: SYNTHETIC_API_TOKEN,
    JOB_STATUS_CALLBACK_SECRET: SYNTHETIC_CALLBACK_SECRET,
    DB: db,
    MANUAL_REVIEW_NOTES_LOCAL_TEST_ROLE_STUB: 'enabled',
  });
}

function patchManualReviewNotes(env, note) {
  return worker.fetch(createWorkerRequest('/api/leads/lead-concurrency-characterization', {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${SYNTHETIC_API_TOKEN}`,
      [REVIEWER_ROLE_HEADER]: 'reviewer',
    },
    json: { manualReviewNotes: note },
  }), env, {});
}

async function sendJobEvent(env, requestId, body, { idempotencyKey } = {}) {
  const callbackToken = await createJobCallbackToken(env, requestId);
  return worker.fetch(createWorkerRequest(`/api/jobs/${requestId}/events`, {
    method: 'POST',
    headers: {
      'X-Job-Callback-Token': callbackToken,
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    json: body,
  }), env, {});
}

async function getJobStatus(env, requestId) {
  return worker.fetch(createWorkerRequest(`/api/jobs/${requestId}`, {
    headers: { Authorization: `Bearer ${SYNTHETIC_API_TOKEN}` },
  }), env, {});
}

test('characterization: concurrent PATCH requests read the same version and last write wins, losing one manual note', async () => {
  const db = new ConcurrentPatchDatabase({
    leads: [createLeadRow({
      id: 'lead-concurrency-characterization',
      notes: '',
      updated_at: ORIGINAL_UPDATED_AT,
    })],
  });
  const env = createConcurrencyEnv(db);

  const firstResponsePromise = patchManualReviewNotes(env, FIRST_NOTE);
  const secondResponsePromise = patchManualReviewNotes(env, SECOND_NOTE);

  await db.firstWriteBlocked.promise;
  const secondResponse = await secondResponsePromise;
  const secondPayload = await readJson(secondResponse);
  db.releaseFirstWrite.resolve();
  const firstResponse = await firstResponsePromise;
  const firstPayload = await readJson(firstResponse);

  assert.deepEqual(db.initialLeadReads, [
    { id: 'lead-concurrency-characterization', notes: '', updatedAt: ORIGINAL_UPDATED_AT },
    { id: 'lead-concurrency-characterization', notes: '', updatedAt: ORIGINAL_UPDATED_AT },
  ]);
  assert.equal(firstResponse.status, 200);
  assert.equal(secondResponse.status, 200);
  assert.equal(firstPayload.success, true);
  assert.equal(secondPayload.success, true);
  assert.deepEqual(firstPayload.changedFields, ['manualReviewNotes']);
  assert.deepEqual(secondPayload.changedFields, ['manualReviewNotes']);
  assert.equal(secondPayload.lead.manualReviewNotes, SECOND_NOTE);
  assert.deepEqual(db.writeOrder, [SECOND_NOTE, FIRST_NOTE]);

  // These assertions record the current audited behavior. They are not the desired
  // concurrency contract and are expected to change in the remediation PR.
  assert.equal(db.leads.get('lead-concurrency-characterization').notes, FIRST_NOTE);
  assert.deepEqual(db.manualReviewNoteEvents.map((event) => event.event_type), ['create', 'create']);
});

test('characterization: a stale job callback can overwrite a newer terminal update when writes race', async () => {
  const requestId = 'req_synthetic_stale_callback';
  const db = new StaleJobCallbackDatabase({ jobRuns: [createJobRow({ request_id: requestId })] });
  const env = createConcurrencyEnv(db);

  const staleResponsePromise = sendJobEvent(env, requestId, {
    state: 'running',
    githubRunId: 101,
    githubRunAttempt: 1,
    githubSha: 'synthetic-stale-sha',
  });
  await db.runningWriteBlocked.promise;

  const newerResponse = await sendJobEvent(env, requestId, {
    state: 'succeeded',
    githubRunId: 202,
    githubRunAttempt: 2,
    githubSha: 'synthetic-newer-sha',
  });
  const newerPayload = await readJson(newerResponse);
  assert.equal(newerResponse.status, 200);
  assert.equal(newerPayload.job.state, 'succeeded');
  assert.equal(newerPayload.job.run.id, 202);

  db.releaseRunningWrite.resolve();
  const staleResponse = await staleResponsePromise;
  const stalePayload = await readJson(staleResponse);
  const finalStatusResponse = await getJobStatus(env, requestId);
  const finalStatus = await readJson(finalStatusResponse);

  assert.deepEqual(db.observedJobReads.slice(0, 4).map((read) => read.state), [
    'accepted',
    'accepted',
    'accepted',
    'accepted',
  ]);
  assert.deepEqual(db.jobWriteOrder, ['succeeded', 'running']);
  assert.equal(staleResponse.status, 200);
  assert.equal(stalePayload.success, true);

  // These assertions record the current audited behavior. They are not the desired
  // concurrency contract and are expected to change in the remediation PR.
  assert.equal(finalStatus.job.state, 'running');
  assert.equal(finalStatus.job.run.id, 101);
  assert.equal(finalStatus.job.completedAt, null);
});

test('characterization: repeated terminal callbacks are accepted and can mutate completed job metadata', async () => {
  const requestId = 'req_synthetic_repeated_callback';
  const db = new FakeD1Database({ jobRuns: [createJobRow({ request_id: requestId })] });
  const env = createConcurrencyEnv(db);
  const idempotencyKey = 'synthetic-repeated-callback-key';

  const firstResponse = await sendJobEvent(env, requestId, {
    state: 'succeeded',
    githubRunId: 301,
    githubRunAttempt: 1,
    githubSha: 'synthetic-first-terminal-sha',
  }, { idempotencyKey });
  const firstPayload = await readJson(firstResponse);
  const repeatedResponse = await sendJobEvent(env, requestId, {
    state: 'succeeded',
    githubRunId: 302,
    githubRunAttempt: 2,
    githubSha: 'synthetic-repeated-terminal-sha',
  }, { idempotencyKey });
  const repeatedPayload = await readJson(repeatedResponse);

  assert.equal(firstResponse.status, 200);
  assert.equal(firstPayload.job.state, 'succeeded');
  assert.equal(firstPayload.job.run.id, 301);
  assert.equal(repeatedResponse.status, 200);

  // These assertions record the current audited behavior. They are not the desired
  // idempotency contract and are expected to change in the remediation PR.
  assert.equal(repeatedPayload.job.state, 'succeeded');
  assert.equal(repeatedPayload.job.run.id, 302);
  assert.equal(repeatedPayload.job.run.attempt, 2);
  assert.equal(repeatedPayload.job.run.sha, 'synthetic-repeated-terminal-sha');
});

test.todo('desired contract: lead PATCH requires a version or updated_at compare-and-swap precondition');
test.todo('desired contract: a stale lead PATCH receives a conflict response instead of overwriting newer state');
test.todo('desired contract: stale job callbacks are rejected after a newer state update');
test.todo('desired contract: repeated job callbacks are idempotent');
test.todo('desired contract: job-state transitions remain monotonic under concurrent callbacks');
