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

  async batch(statements) {
    const update = statements.find((statement) => normalizeSql(statement.sql).startsWith('update job_runs set'));
    if (update) {
      const state = update.args[0];
      if (state === 'running' && !this.hasBlockedRunningWrite) {
        this.hasBlockedRunningWrite = true;
        this.runningWriteBlocked.resolve();
        await this.releaseRunningWrite.promise;
      }
      this.jobWriteOrder.push(state);
    }
    return super.batch(statements);
  }
}

class ConcurrentCallbackKeyDatabase extends FakeD1Database {
  constructor(options) {
    super(options);
    this.callbackEventReadBarrier = createBarrier(2);
    this.callbackEventReads = 0;
  }

  async executeFirst(sql, args) {
    if (
      normalizeSql(sql) === 'select * from job_callback_events where request_id = ? and idempotency_key = ? limit 1'
      && this.callbackEventReads < 2
    ) {
      const row = await super.executeFirst(sql, args);
      this.callbackEventReads += 1;
      await this.callbackEventReadBarrier.wait();
      return row;
    }
    return super.executeFirst(sql, args);
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
    provider_attempt: 0,
    last_callback_event_id: '',
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
    json: { manualReviewNotes: note, expectedVersion: 1 },
  }), env, {});
}

async function sendJobEvent(env, requestId, body, { idempotencyKey } = {}) {
  const callbackToken = await createJobCallbackToken(env, requestId);
  return worker.fetch(createWorkerRequest(`/api/jobs/${requestId}/events`, {
    method: 'POST',
    headers: {
      'X-Job-Callback-Token': callbackToken,
      'Idempotency-Key': idempotencyKey || `synthetic-${requestId}-${body.state}-${body.githubRunAttempt}`,
    },
    json: body,
  }), env, {});
}

async function getJobStatus(env, requestId) {
  return worker.fetch(createWorkerRequest(`/api/jobs/${requestId}`, {
    headers: { Authorization: `Bearer ${SYNTHETIC_API_TOKEN}` },
  }), env, {});
}

test('concurrent PATCH requests allow one CAS winner and reject the stale manual-note writer', async () => {
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
  assert.equal(firstResponse.status, 409);
  assert.equal(secondResponse.status, 200);
  assert.equal(firstPayload.success, false);
  assert.equal(firstPayload.code, 'LEAD_VERSION_CONFLICT');
  assert.equal(firstPayload.currentVersion, 2);
  assert.equal('lead' in firstPayload, false);
  assert.equal(secondPayload.success, true);
  assert.deepEqual(secondPayload.changedFields, ['manualReviewNotes']);
  assert.equal(secondPayload.lead.manualReviewNotes, SECOND_NOTE);
  assert.deepEqual(db.writeOrder, [SECOND_NOTE, FIRST_NOTE]);
  assert.equal(db.leads.get('lead-concurrency-characterization').notes, SECOND_NOTE);
  assert.equal(db.leads.get('lead-concurrency-characterization').version, 2);
  assert.deepEqual(db.manualReviewNoteEvents.map((event) => event.event_type), ['create']);
});

test('a stale job callback cannot overwrite a newer terminal update when writes race', async () => {
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

  assert.deepEqual(db.jobWriteOrder, ['succeeded', 'running']);
  assert.equal(staleResponse.status, 409);
  assert.equal(stalePayload.success, false);
  assert.equal(stalePayload.code, 'JOB_CALLBACK_STALE_OR_NON_MONOTONIC');
  assert.equal(finalStatus.job.state, 'succeeded');
  assert.equal(finalStatus.job.run.id, 202);
  assert.equal(finalStatus.job.providerAttempt, 2);
  assert.ok(finalStatus.job.completedAt);
});

test('repeated terminal callbacks with the same key and payload are replayed without mutation', async () => {
  const requestId = 'req_synthetic_repeated_callback';
  const db = new FakeD1Database({ jobRuns: [createJobRow({ request_id: requestId })] });
  const env = createConcurrencyEnv(db);
  const idempotencyKey = 'synthetic-repeated-callback-key';

  const terminalEvent = {
    state: 'succeeded',
    githubRunId: 301,
    githubRunAttempt: 1,
    githubSha: 'synthetic-first-terminal-sha',
  };
  const firstResponse = await sendJobEvent(env, requestId, terminalEvent, { idempotencyKey });
  const firstPayload = await readJson(firstResponse);
  const repeatedResponse = await sendJobEvent(env, requestId, terminalEvent, { idempotencyKey });
  const repeatedPayload = await readJson(repeatedResponse);

  assert.equal(firstResponse.status, 200);
  assert.equal(firstPayload.job.state, 'succeeded');
  assert.equal(firstPayload.job.run.id, 301);
  assert.equal(repeatedResponse.status, 200);
  assert.equal(repeatedPayload.outcome, 'replayed');
  assert.equal(repeatedPayload.job.state, 'succeeded');
  assert.equal(repeatedPayload.job.run.id, 301);
  assert.equal(repeatedPayload.job.run.attempt, 1);
  assert.equal(repeatedPayload.job.run.sha, 'synthetic-first-terminal-sha');
  assert.equal(db.jobCallbackEvents.length, 1);
});

test('desired contract: lead PATCH requires a validated expectedVersion precondition', async () => {
  const db = new FakeD1Database({ leads: [createLeadRow()] });
  const env = createConcurrencyEnv(db);
  const missing = await worker.fetch(createWorkerRequest('/api/leads/lead-1', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${SYNTHETIC_API_TOKEN}` },
    json: { reviewStatus: 'APPROVED' },
  }), env, {});
  const missingPayload = await readJson(missing);
  const malformed = await worker.fetch(createWorkerRequest('/api/leads/lead-1', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${SYNTHETIC_API_TOKEN}` },
    json: { reviewStatus: 'APPROVED', expectedVersion: '1' },
  }), env, {});
  const malformedPayload = await readJson(malformed);
  const invalidJson = await worker.fetch(createWorkerRequest('/api/leads/lead-1', {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${SYNTHETIC_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: '{"expectedVersion":',
  }), env, {});
  const invalidJsonPayload = await readJson(invalidJson);
  const nullBody = await worker.fetch(createWorkerRequest('/api/leads/lead-1', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${SYNTHETIC_API_TOKEN}` },
    json: null,
  }), env, {});
  const nullBodyPayload = await readJson(nullBody);

  assert.equal(missing.status, 428);
  assert.equal(missingPayload.code, 'LEAD_VERSION_REQUIRED');
  assert.equal(malformed.status, 400);
  assert.equal(malformedPayload.code, 'LEAD_VERSION_INVALID');
  assert.equal(invalidJson.status, 400);
  assert.equal(invalidJsonPayload.code, 'LEAD_VERSION_INVALID');
  assert.equal(nullBody.status, 400);
  assert.equal(nullBodyPayload.code, 'LEAD_VERSION_INVALID');
  assert.equal(db.leads.get('lead-1').version, 1);
});

test('matching lead PATCH no-op linearizes without incrementing version or writing events', async () => {
  const db = new FakeD1Database({ leads: [createLeadRow()] });
  const env = createConcurrencyEnv(db);
  const response = await worker.fetch(createWorkerRequest('/api/leads/lead-1', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${SYNTHETIC_API_TOKEN}` },
    json: { reviewStatus: 'NEEDS_REVIEW', expectedVersion: 1 },
  }), env, {});
  const payload = await readJson(response);

  assert.equal(response.status, 200);
  assert.equal(payload.lead.version, 1);
  assert.deepEqual(payload.changedFields, []);
  assert.equal(db.statusLog.length, 0);
  assert.equal(db.manualReviewNoteEvents.length, 0);
  assert.equal(db.reviewerFeedbackEvents.length, 0);
});

test('desired contract: a stale lead PATCH conflicts without side effects', async () => {
  const db = new FakeD1Database({ leads: [createLeadRow()] });
  const env = createConcurrencyEnv(db);
  const accepted = await worker.fetch(createWorkerRequest('/api/leads/lead-1', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${SYNTHETIC_API_TOKEN}` },
    json: { status: 'CONTACTED', expectedVersion: 1 },
  }), env, {});
  const stale = await worker.fetch(createWorkerRequest('/api/leads/lead-1', {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${SYNTHETIC_API_TOKEN}`,
      [REVIEWER_ROLE_HEADER]: 'reviewer',
    },
    json: { manualReviewNotes: FIRST_NOTE, expectedVersion: 1 },
  }), env, {});
  const stalePayload = await readJson(stale);

  assert.equal(accepted.status, 200);
  assert.equal(stale.status, 409);
  assert.equal(stalePayload.code, 'LEAD_VERSION_CONFLICT');
  assert.equal(db.statusLog.length, 1);
  assert.equal(db.manualReviewNoteEvents.length, 0);
  assert.equal(db.leads.get('lead-1').notes, '');
});

test('desired contract: stale job callbacks are rejected after a newer provider attempt', async () => {
  const requestId = 'req_stale_provider_attempt';
  const db = new FakeD1Database({ jobRuns: [createJobRow({ request_id: requestId })] });
  const env = createConcurrencyEnv(db);
  const newer = await sendJobEvent(env, requestId, {
    state: 'running', githubRunId: 900, githubRunAttempt: 2,
  }, { idempotencyKey: 'provider-attempt-2' });
  const mismatchedIdentity = await sendJobEvent(env, requestId, {
    state: 'succeeded', githubRunId: 901, githubRunAttempt: 2,
  }, { idempotencyKey: 'provider-attempt-2-wrong-run' });
  const stale = await sendJobEvent(env, requestId, {
    state: 'succeeded', githubRunId: 800, githubRunAttempt: 1,
  }, { idempotencyKey: 'provider-attempt-1' });
  const stalePayload = await readJson(stale);
  const staleReplay = await sendJobEvent(env, requestId, {
    state: 'succeeded', githubRunId: 800, githubRunAttempt: 1,
  }, { idempotencyKey: 'provider-attempt-1' });
  const staleMismatch = await sendJobEvent(env, requestId, {
    state: 'failed', githubRunId: 800, githubRunAttempt: 1,
  }, { idempotencyKey: 'provider-attempt-1' });
  const staleMismatchPayload = await readJson(staleMismatch);

  assert.equal(newer.status, 200);
  assert.equal(mismatchedIdentity.status, 409);
  assert.equal(stale.status, 409);
  assert.equal(stalePayload.code, 'JOB_CALLBACK_STALE_OR_NON_MONOTONIC');
  assert.equal(staleReplay.status, 409);
  assert.equal(staleMismatch.status, 409);
  assert.equal(staleMismatchPayload.code, 'JOB_CALLBACK_IDEMPOTENCY_MISMATCH');
  assert.equal(db.jobRuns.get(requestId).state, 'running');
  assert.equal(db.jobRuns.get(requestId).github_run_id, 900);
  assert.deepEqual(db.jobCallbackEvents.map((event) => event.outcome), [
    'applied', 'rejected', 'rejected',
  ]);
});

test('higher provider attempts do not retain omitted correlation metadata from older attempts', async () => {
  const requestId = 'req_provider_metadata_reset';
  const db = new FakeD1Database({ jobRuns: [createJobRow({ request_id: requestId })] });
  const env = createConcurrencyEnv(db);
  const first = await sendJobEvent(env, requestId, {
    state: 'running',
    githubRunId: 1100,
    githubRunAttempt: 1,
    githubRunUrl: 'https://github.example/runs/1100',
    githubWorkflow: 'Synthetic old workflow',
    githubSha: 'old-sha',
  }, { idempotencyKey: 'provider-metadata-attempt-1' });
  const higher = await sendJobEvent(env, requestId, {
    state: 'running',
    githubRunId: 2200,
    githubRunAttempt: 2,
  }, { idempotencyKey: 'provider-metadata-attempt-2' });
  const higherPayload = await readJson(higher);

  assert.equal(first.status, 200);
  assert.equal(higher.status, 200);
  assert.equal(higherPayload.job.run.id, 2200);
  assert.equal(higherPayload.job.run.attempt, 2);
  assert.equal(higherPayload.job.run.url, null);
  assert.equal(higherPayload.job.run.workflow, null);
  assert.equal(higherPayload.job.run.sha, null);
});

test('desired contract: callback idempotency compares payloads and keeps one event', async () => {
  const requestId = 'req_payload_mismatch';
  const db = new FakeD1Database({ jobRuns: [createJobRow({ request_id: requestId })] });
  const env = createConcurrencyEnv(db);
  const key = 'same-key-different-payload';
  const callbackToken = await createJobCallbackToken(env, requestId);
  const invalidJson = await worker.fetch(createWorkerRequest(`/api/jobs/${requestId}/events`, {
    method: 'POST',
    headers: {
      'X-Job-Callback-Token': callbackToken,
      'Idempotency-Key': 'invalid-json-callback',
      'Content-Type': 'application/json',
    },
    body: '{"state":',
  }), env, {});
  const invalidJsonPayload = await readJson(invalidJson);
  const missingKey = await worker.fetch(createWorkerRequest(`/api/jobs/${requestId}/events`, {
    method: 'POST',
    headers: { 'X-Job-Callback-Token': callbackToken },
    json: { state: 'running', githubRunId: 501, githubRunAttempt: 1 },
  }), env, {});
  const first = await sendJobEvent(env, requestId, {
    state: 'running', githubRunId: 501, githubRunAttempt: 1,
  }, { idempotencyKey: key });
  const mismatch = await sendJobEvent(env, requestId, {
    state: 'succeeded', githubRunId: 501, githubRunAttempt: 1,
  }, { idempotencyKey: key });
  const mismatchPayload = await readJson(mismatch);

  assert.equal(invalidJson.status, 400);
  assert.equal(invalidJsonPayload.code, 'JOB_CALLBACK_PAYLOAD_INVALID');
  assert.equal(missingKey.status, 428);
  assert.equal(first.status, 200);
  assert.equal(mismatch.status, 409);
  assert.equal(mismatchPayload.code, 'JOB_CALLBACK_IDEMPOTENCY_MISMATCH');
  assert.equal(db.jobRuns.get(requestId).state, 'running');
  assert.deepEqual(db.jobCallbackEvents.map((event) => event.outcome), ['applied']);
});

test('concurrent callbacks cannot reuse one key for two payloads', async () => {
  const requestId = 'req_concurrent_payload_mismatch';
  const db = new ConcurrentCallbackKeyDatabase({
    jobRuns: [createJobRow({ request_id: requestId })],
  });
  const env = createConcurrencyEnv(db);
  const key = 'concurrent-same-key';
  const [runningResponse, terminalResponse] = await Promise.all([
    sendJobEvent(env, requestId, {
      state: 'running', githubRunId: 710, githubRunAttempt: 1,
    }, { idempotencyKey: key }),
    sendJobEvent(env, requestId, {
      state: 'succeeded', githubRunId: 710, githubRunAttempt: 1,
    }, { idempotencyKey: key }),
  ]);
  const responses = await Promise.all([runningResponse, terminalResponse].map(async (response) => ({
    status: response.status,
    payload: await readJson(response),
  })));
  const applied = responses.find(({ status }) => status === 200);
  const mismatch = responses.find(({ payload }) => payload.code === 'JOB_CALLBACK_IDEMPOTENCY_MISMATCH');

  assert.ok(applied);
  assert.ok(mismatch);
  assert.equal(db.jobCallbackEvents.length, 1);
  assert.equal(db.jobCallbackEvents[0].outcome, 'applied');
  assert.equal(db.jobRuns.get(requestId).state, applied.payload.job.state);
});

test('Cloud Run callbacks use explicit attempts and execution identity', async () => {
  const requestId = 'req_cloud_callback_ordering';
  const db = new FakeD1Database({
    jobRuns: [createJobRow({ request_id: requestId, target: 'cloud-run' })],
  });
  const env = createConcurrencyEnv(db);
  const running = await sendJobEvent(env, requestId, {
    state: 'running',
    providerAttempt: 3,
    cloudRunOperation: 'operations/3',
    cloudRunExecution: 'executions/3',
  }, { idempotencyKey: 'cloud-attempt-3-running' });
  const wrongExecution = await sendJobEvent(env, requestId, {
    state: 'succeeded',
    providerAttempt: 3,
    cloudRunOperation: 'operations/other',
    cloudRunExecution: 'executions/other',
  }, { idempotencyKey: 'cloud-attempt-3-wrong-execution' });

  assert.equal(running.status, 200);
  assert.equal(wrongExecution.status, 409);
  assert.equal(db.jobRuns.get(requestId).state, 'running');
  assert.equal(db.jobRuns.get(requestId).provider_attempt, 3);
  assert.equal(db.jobRuns.get(requestId).cloud_run_execution, 'executions/3');
});

test('desired contract: concurrent callbacks preserve terminal monotonicity', async () => {
  const requestId = 'req_terminal_monotonicity';
  const db = new StaleJobCallbackDatabase({ jobRuns: [createJobRow({ request_id: requestId })] });
  const env = createConcurrencyEnv(db);
  const staleRunning = sendJobEvent(env, requestId, {
    state: 'running', githubRunId: 601, githubRunAttempt: 1,
  }, { idempotencyKey: 'monotonic-running' });
  await db.runningWriteBlocked.promise;
  const terminal = await sendJobEvent(env, requestId, {
    state: 'failed', githubRunId: 602, githubRunAttempt: 2, lastError: 'synthetic failure',
  }, { idempotencyKey: 'monotonic-terminal' });
  db.releaseRunningWrite.resolve();
  const stale = await staleRunning;

  assert.equal(terminal.status, 200);
  assert.equal(stale.status, 409);
  assert.equal(db.jobRuns.get(requestId).state, 'failed');
  assert.equal(db.jobRuns.get(requestId).provider_attempt, 2);
  assert.deepEqual(db.jobCallbackEvents.map((event) => event.outcome).sort(), ['applied', 'rejected']);
});
