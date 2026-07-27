import test from 'node:test';
import assert from 'node:assert/strict';

import worker from '../index.js';
import { createWorkerEnv } from './helpers/fixtures.mjs';
import { createWorkerRequest, readJson } from './helpers/http.mjs';

test('manifest route returns public JSON without API authentication', async () => {
  const response = await worker.fetch(
    createWorkerRequest('/manifest.json?token=ignored'),
    createWorkerEnv({ API_TOKEN: 'api-secret' }),
    {}
  );
  const payload = await readJson(response);

  assert.equal(response.status, 200);
  assert.match(response.headers.get('Content-Type') || '', /application\/json/);
  assert.equal(payload.name, 'Pursuit Twin KR');
  assert.equal(payload.start_url, '/');
  assert.equal(payload.display, 'standalone');
});

test('unknown API routes stay inside the JSON API boundary', async () => {
  const response = await worker.fetch(
    createWorkerRequest('/api/not-a-real-route', {
      headers: { Authorization: 'Bearer api-secret' },
    }),
    createWorkerEnv(),
    {}
  );
  const payload = await readJson(response);

  assert.equal(response.status, 404);
  assert.equal(payload.success, false);
  assert.equal(payload.message, 'Not Found');
});

test('unsupported methods on known API routes return JSON 405 after auth succeeds', async () => {
  const response = await worker.fetch(
    createWorkerRequest('/api/leads', {
      method: 'POST',
      headers: { Authorization: 'Bearer api-secret' },
    }),
    createWorkerEnv(),
    {}
  );
  const payload = await readJson(response);

  assert.equal(response.status, 405);
  assert.equal(response.headers.get('Allow'), 'GET');
  assert.equal(payload.success, false);
  assert.match(payload.message, /Method Not Allowed/);
});
