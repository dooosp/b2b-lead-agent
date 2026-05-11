import test from 'node:test';
import assert from 'node:assert/strict';

import worker from '../index.js';
import { createJobCallbackToken } from '../lib/job-trigger.js';
import { createWorkerEnv } from './helpers/fixtures.mjs';
import { createWorkerRequest, readJson } from './helpers/http.mjs';

async function callbackHeaders(env, requestId, extra = {}) {
  return {
    'Content-Type': 'application/json',
    'X-Job-Callback-Token': await createJobCallbackToken(env, requestId),
    ...extra
  };
}

test('POST /trigger returns 202 and dispatches requestId correlation metadata', async () => {
  const env = createWorkerEnv();
  const originalFetch = globalThis.fetch;
  const fetchCalls = [];
  globalThis.fetch = async (url, init) => {
    fetchCalls.push({ url, init });
    return new Response(null, { status: 204 });
  };

  try {
    const response = await worker.fetch(createWorkerRequest('/trigger', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer api-secret',
        'Origin': env.WORKER_ORIGIN
      },
      body: JSON.stringify({ profile: 'danfoss' })
    }), env, {});

    const payload = await readJson(response);
    assert.equal(response.status, 202);
    assert.equal(payload.success, true);
    assert.equal(payload.status, 'accepted');
    assert.match(payload.requestId, /^req_/);
    assert.equal(payload.profile, 'danfoss');
    assert.equal(payload.state, 'accepted');
    assert.equal('completedAt' in payload, false);
    assert.equal('completion' in payload, false);
    assert.equal(payload.message.includes('완료되었습니다'), false);
    assert.equal(fetchCalls.length, 1);

    const dispatchPayload = JSON.parse(fetchCalls[0].init.body);
    assert.equal(dispatchPayload.client_payload.profile, 'danfoss');
    assert.equal(dispatchPayload.client_payload.requestId, payload.requestId);
    assert.equal(dispatchPayload.client_payload.statusEventUrl, `${env.WORKER_ORIGIN}/api/jobs/${payload.requestId}/events`);
    assert.equal(response.headers.get('Location'), `${env.WORKER_ORIGIN}/api/jobs/${payload.requestId}`);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('duplicate active /trigger requests coalesce to the existing requestId', async () => {
  const env = createWorkerEnv();
  const originalFetch = globalThis.fetch;
  let dispatchCount = 0;
  globalThis.fetch = async () => {
    dispatchCount += 1;
    return new Response(null, { status: 204 });
  };

  try {
    const first = await worker.fetch(createWorkerRequest('/trigger', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer api-secret'
      },
      body: JSON.stringify({ profile: 'danfoss' })
    }), env, {});
    const firstPayload = await readJson(first);

    const second = await worker.fetch(createWorkerRequest('/trigger', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer api-secret'
      },
      body: JSON.stringify({ profile: 'danfoss' })
    }), env, {});
    const secondPayload = await readJson(second);

    assert.equal(first.status, 202);
    assert.equal(second.status, 202);
    assert.equal(secondPayload.requestId, firstPayload.requestId);
    assert.equal(secondPayload.deduplicated, true);
    assert.equal(dispatchCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('stale active runs are retired so a no-callback profile can recover', async () => {
  const env = createWorkerEnv({ ACTIVE_RUN_TTL_SEC: '0' });
  const originalFetch = globalThis.fetch;
  let dispatchCount = 0;
  globalThis.fetch = async () => {
    dispatchCount += 1;
    return new Response(null, { status: 204 });
  };

  try {
    const first = await worker.fetch(createWorkerRequest('/trigger', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer api-secret'
      },
      body: JSON.stringify({ profile: 'danfoss' })
    }), env, {});
    const firstPayload = await readJson(first);

    const second = await worker.fetch(createWorkerRequest('/trigger', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer api-secret'
      },
      body: JSON.stringify({ profile: 'danfoss' })
    }), env, {});
    const secondPayload = await readJson(second);

    assert.equal(first.status, 202);
    assert.equal(second.status, 202);
    assert.notEqual(secondPayload.requestId, firstPayload.requestId);
    assert.equal(secondPayload.deduplicated, false);
    assert.equal(dispatchCount, 2);

    const staleStatus = await worker.fetch(createWorkerRequest(`/api/jobs/${firstPayload.requestId}`, {
      headers: { 'Authorization': 'Bearer api-secret' }
    }), env, {});
    const stalePayload = await readJson(staleStatus);
    assert.equal(stalePayload.job.state, 'failed');
    assert.match(stalePayload.job.lastError || '', /expired/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('status endpoint shows honest accepted -> running -> succeeded transitions', async () => {
  const env = createWorkerEnv();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 204 });

  try {
    const trigger = await worker.fetch(createWorkerRequest('/trigger', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer api-secret'
      },
      body: JSON.stringify({ profile: 'ls-electric' })
    }), env, {});
    const triggerPayload = await readJson(trigger);

    const accepted = await worker.fetch(createWorkerRequest(`/api/jobs/${triggerPayload.requestId}`, {
      headers: { 'Authorization': 'Bearer api-secret' }
    }), env, {});
    const acceptedPayload = await readJson(accepted);
    assert.equal(acceptedPayload.job.state, 'accepted');
    assert.equal(acceptedPayload.job.startedAt, null);

    const running = await worker.fetch(createWorkerRequest(`/api/jobs/${triggerPayload.requestId}/events`, {
      method: 'POST',
      headers: await callbackHeaders(env, triggerPayload.requestId),
      body: JSON.stringify({
        state: 'running',
        githubRunId: 101,
        githubRunAttempt: 1,
        githubRunUrl: 'https://github.example/runs/101',
        githubWorkflow: 'Generate B2B Lead Report',
        githubSha: 'deadbeef'
      })
    }), env, {});
    const runningPayload = await readJson(running);
    assert.equal(runningPayload.job.state, 'running');
    assert.equal(runningPayload.job.run.id, 101);
    assert.ok(runningPayload.job.startedAt);

    const forged = await worker.fetch(createWorkerRequest(`/api/jobs/${triggerPayload.requestId}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer api-secret'
      },
      body: JSON.stringify({ state: 'failed', lastError: 'forged' })
    }), env, {});
    assert.equal(forged.status, 401);

    const succeeded = await worker.fetch(createWorkerRequest(`/api/jobs/${triggerPayload.requestId}/events`, {
      method: 'POST',
      headers: await callbackHeaders(env, triggerPayload.requestId),
      body: JSON.stringify({ state: 'succeeded' })
    }), env, {});
    const succeededPayload = await readJson(succeeded);
    assert.equal(succeededPayload.job.state, 'succeeded');
    assert.ok(succeededPayload.job.completedAt);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('trigger auth is bearer-first and only allows body password fallback when enabled', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 204 });

  try {
    const strictEnv = createWorkerEnv({ ALLOW_TRIGGER_BODY_PASSWORD: 'false' });
    const strictResponse = await worker.fetch(createWorkerRequest('/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: 'danfoss', password: 'legacy-secret' })
    }), strictEnv, {});
    assert.equal(strictResponse.status, 401);

    const legacyBearerResponse = await worker.fetch(createWorkerRequest('/trigger', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer legacy-secret'
      },
      body: JSON.stringify({ profile: 'danfoss' })
    }), strictEnv, {});
    assert.equal(legacyBearerResponse.status, 202);

    const fallbackEnv = createWorkerEnv({
      API_TOKEN: '',
      ALLOW_TRIGGER_BODY_PASSWORD: 'true'
    });
    const fallbackResponse = await worker.fetch(createWorkerRequest('/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: 'danfoss', password: 'legacy-secret' })
    }), fallbackEnv, {});
    const fallbackPayload = await readJson(fallbackResponse);

    assert.equal(fallbackResponse.status, 202);
    assert.equal(fallbackPayload.authMode, 'body-password');
    assert.match(fallbackPayload.warning, /deprecated/i);
    assert.match(fallbackResponse.headers.get('Warning') || '', /deprecated/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('late running callbacks do not move a completed job backward', async () => {
  const env = createWorkerEnv();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 204 });

  try {
    const trigger = await worker.fetch(createWorkerRequest('/trigger', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer api-secret'
      },
      body: JSON.stringify({ profile: 'danfoss' })
    }), env, {});
    const { requestId } = await readJson(trigger);

    await worker.fetch(createWorkerRequest(`/api/jobs/${requestId}/events`, {
      method: 'POST',
      headers: await callbackHeaders(env, requestId),
      body: JSON.stringify({ state: 'succeeded' })
    }), env, {});

    const stale = await worker.fetch(createWorkerRequest(`/api/jobs/${requestId}/events`, {
      method: 'POST',
      headers: await callbackHeaders(env, requestId),
      body: JSON.stringify({ state: 'running', githubRunId: 777 })
    }), env, {});
    const stalePayload = await readJson(stale);

    assert.equal(stale.status, 200);
    assert.equal(stalePayload.job.state, 'succeeded');
    assert.equal(stalePayload.job.run.id, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('dispatch failure returns 502 and persists failed job status', async () => {
  const env = createWorkerEnv();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 503 });

  try {
    const trigger = await worker.fetch(createWorkerRequest('/trigger', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer api-secret'
      },
      body: JSON.stringify({ profile: 'danfoss' })
    }), env, {});
    const triggerPayload = await readJson(trigger);

    assert.equal(trigger.status, 502);
    assert.equal(triggerPayload.success, false);
    assert.match(triggerPayload.requestId, /^req_/);
    assert.equal('status' in triggerPayload, false);

    const statusResponse = await worker.fetch(createWorkerRequest(`/api/jobs/${triggerPayload.requestId}`, {
      headers: { 'Authorization': 'Bearer api-secret' }
    }), env, {});
    const statusPayload = await readJson(statusResponse);

    assert.equal(statusPayload.job.state, 'failed');
    assert.match(statusPayload.job.lastError || '', /dispatch failed/i);
    assert.ok(statusPayload.job.completedAt);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('job event endpoint accepts failed and cancelled terminal states', async () => {
  const env = createWorkerEnv();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 204 });

  try {
    const failedTrigger = await worker.fetch(createWorkerRequest('/trigger', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer api-secret'
      },
      body: JSON.stringify({ profile: 'danfoss' })
    }), env, {});
    const failedJob = await readJson(failedTrigger);
    const failedEvent = await worker.fetch(createWorkerRequest(`/api/jobs/${failedJob.requestId}/events`, {
      method: 'POST',
      headers: await callbackHeaders(env, failedJob.requestId),
      body: JSON.stringify({ state: 'failed', lastError: 'GitHub job failed.' })
    }), env, {});
    const failedPayload = await readJson(failedEvent);
    assert.equal(failedPayload.job.state, 'failed');
    assert.equal(failedPayload.job.lastError, 'GitHub job failed.');

    const cancelledTrigger = await worker.fetch(createWorkerRequest('/trigger', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer legacy-secret'
      },
      body: JSON.stringify({ profile: 'ls-electric' })
    }), env, {});
    const cancelledJob = await readJson(cancelledTrigger);
    const cancelledEvent = await worker.fetch(createWorkerRequest(`/api/jobs/${cancelledJob.requestId}/events`, {
      method: 'POST',
      headers: await callbackHeaders(env, cancelledJob.requestId),
      body: JSON.stringify({ state: 'cancelled', lastError: 'GitHub job was cancelled.' })
    }), env, {});
    const cancelledPayload = await readJson(cancelledEvent);
    assert.equal(cancelledPayload.job.state, 'cancelled');
    assert.equal(cancelledPayload.job.lastError, 'GitHub job was cancelled.');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('job events reject foreign-target metadata', async () => {
  const env = createWorkerEnv();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 204 });

  try {
    const trigger = await worker.fetch(createWorkerRequest('/trigger', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer api-secret'
      },
      body: JSON.stringify({ profile: 'danfoss' })
    }), env, {});
    const { requestId } = await readJson(trigger);

    const response = await worker.fetch(createWorkerRequest(`/api/jobs/${requestId}/events`, {
      method: 'POST',
      headers: await callbackHeaders(env, requestId),
      body: JSON.stringify({ state: 'running', cloudRunOperation: 'operations/123' })
    }), env, {});
    const payload = await readJson(response);

    assert.equal(response.status, 400);
    assert.match(payload.message, /cloud run/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
