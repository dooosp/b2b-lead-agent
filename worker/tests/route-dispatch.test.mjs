import test from 'node:test';
import assert from 'node:assert/strict';

import worker from '../index.js';
import { matchApiRoute } from '../routes/api.js';
import { ROUTE_CLASS, ROUTE_INVENTORY } from '../routes/metadata.js';
import { matchPageRoute } from '../routes/pages.js';
import { matchStaticRoute } from '../routes/static.js';

function createRequest(path, { method = 'GET', headers = {}, body } = {}) {
  return new Request(`https://b2b-lead-trigger.example.workers.dev${path}`, {
    method,
    headers,
    body
  });
}

function createEnv(overrides = {}) {
  return {
    API_TOKEN: 'api-secret',
    TRIGGER_PASSWORD: 'legacy-secret',
    PROFILES: JSON.stringify([{ id: 'danfoss', name: 'Danfoss' }]),
    WORKER_ORIGIN: 'https://b2b-lead-trigger.example.workers.dev',
    ...overrides
  };
}

function createThrowingDbAccessTracker() {
  const accesses = [];
  return {
    accesses,
    db: new Proxy({}, {
      get(_target, prop) {
        accesses.push(String(prop));
        throw new Error(`DB should not be touched by this route: ${String(prop)}`);
      }
    })
  };
}

async function readJson(response) {
  return response.json();
}

test('route inventory classifies every Worker route boundary', () => {
  assert.deepEqual(ROUTE_INVENTORY.map((route) => route.id), [
    'cors.options',
    'static.manifest',
    'static.serviceWorker',
    'page.leadDetail',
    'page.leads',
    'page.ppt',
    'page.roleplay',
    'page.history',
    'page.dashboard',
    'page.proposal',
    'page.cpa',
    'page.homeFallback',
    'api.selfServiceAnalyze',
    'job.trigger',
    'api.jobStatus',
    'job.event',
    'api.leads.list',
    'api.ppt',
    'api.proposal',
    'api.cpa',
    'api.roleplay',
    'api.history',
    'api.internalLatestPublished',
    'api.leads.batchEnrich',
    'api.leads.enrich',
    'api.leads.patch',
    'api.dashboard',
    'api.exportCsv',
    'api.references.list',
    'api.references.create',
    'api.references.delete'
  ]);

  const manifest = ROUTE_INVENTORY.find((route) => route.id === 'static.manifest');
  assert.deepEqual(manifest.methods, ['GET']);
  assert.equal(manifest.dbAccess, 'none');
  assert.equal(manifest.writes, false);
  assert.ok(manifest.classifications.includes(ROUTE_CLASS.STATIC_NO_DB));

  const leadPatch = ROUTE_INVENTORY.find((route) => route.id === 'api.leads.patch');
  assert.deepEqual(leadPatch.methods, ['PATCH']);
  assert.ok(leadPatch.classifications.includes(ROUTE_CLASS.API));
  assert.ok(leadPatch.classifications.includes(ROUTE_CLASS.D1_WRITE));

  const trigger = ROUTE_INVENTORY.find((route) => route.id === 'job.trigger');
  assert.deepEqual(trigger.methods, ['POST']);
  assert.ok(trigger.classifications.includes(ROUTE_CLASS.JOB_TRIGGER));
  assert.ok(trigger.classifications.includes(ROUTE_CLASS.D1_WRITE));

  const fallback = ROUTE_INVENTORY.find((route) => route.id === 'page.homeFallback');
  assert.ok(fallback.classifications.includes(ROUTE_CLASS.PAGE));
  assert.ok(fallback.classifications.includes(ROUTE_CLASS.UNSAFE_AMBIGUOUS));
});

test('dispatch matchers keep static, page, and API routes separate', () => {
  assert.equal(matchStaticRoute('/manifest.json')?.route.id, 'static.manifest');
  assert.equal(matchStaticRoute('/api/leads'), null);

  assert.equal(matchApiRoute('/api/leads')?.route.id, 'api.leads.list');
  assert.equal(matchApiRoute('/api/leads/lead-1')?.route.id, 'api.leads.patch');
  assert.equal(matchApiRoute('/api/references', 'GET')?.route.id, 'api.references.list');
  assert.equal(matchApiRoute('/api/references', 'POST')?.route.id, 'api.references.create');
  assert.equal(matchApiRoute('/leads/lead-1'), null);

  assert.equal(matchPageRoute('/leads/lead-1')?.route.id, 'page.leadDetail');
  assert.equal(matchPageRoute('/api/leads'), null);
});

test('/manifest.json is a GET-only no-DB static route', async () => {
  const tracker = createThrowingDbAccessTracker();
  const env = createEnv({ DB: tracker.db });

  const response = await worker.fetch(createRequest('/manifest.json'), env, {});
  const payload = await readJson(response);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'application/json; charset=utf-8');
  assert.equal(payload.name, 'Pursuit Twin KR');
  assert.deepEqual(tracker.accesses, []);

  const rejectedWrite = await worker.fetch(createRequest('/manifest.json', { method: 'POST' }), env, {});
  const rejectedPayload = await readJson(rejectedWrite);

  assert.equal(rejectedWrite.status, 405);
  assert.equal(rejectedWrite.headers.get('Allow'), 'GET');
  assert.equal(rejectedPayload.success, false);
  assert.deepEqual(tracker.accesses, []);
});

test('API routes return JSON 405 for unsupported methods after bearer auth', async () => {
  const env = createEnv();
  const response = await worker.fetch(
    createRequest('/api/leads', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer api-secret',
        Origin: env.WORKER_ORIGIN
      }
    }),
    env,
    {}
  );
  const payload = await readJson(response);

  assert.equal(response.status, 405);
  assert.equal(response.headers.get('Allow'), 'GET');
  assert.equal(response.headers.get('Content-Type'), 'application/json; charset=utf-8');
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), env.WORKER_ORIGIN);
  assert.equal(payload.success, false);
  assert.match(payload.message, /Method Not Allowed/);
});

test('unknown API paths return JSON 404 instead of falling through to the home page', async () => {
  const response = await worker.fetch(
    createRequest('/api/not-a-route', {
      headers: { Authorization: 'Bearer api-secret' }
    }),
    createEnv(),
    {}
  );
  const payload = await readJson(response);

  assert.equal(response.status, 404);
  assert.equal(response.headers.get('Content-Type'), 'application/json; charset=utf-8');
  assert.equal(payload.success, false);
  assert.match(payload.message, /Not Found/);
});

test('D1-backed API routes stay separate from no-DB static routes', async () => {
  const env = createEnv();

  const staticResponse = await worker.fetch(createRequest('/manifest.json'), env, {});
  assert.equal(staticResponse.status, 200);

  const d1BackedResponse = await worker.fetch(
    createRequest('/api/dashboard', {
      headers: { Authorization: 'Bearer api-secret' }
    }),
    env,
    {}
  );
  const payload = await readJson(d1BackedResponse);

  assert.equal(d1BackedResponse.status, 503);
  assert.equal(payload.success, false);
  assert.match(payload.message, /시스템 설정/);
});
