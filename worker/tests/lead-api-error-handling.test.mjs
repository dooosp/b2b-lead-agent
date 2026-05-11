import test from 'node:test';
import assert from 'node:assert/strict';

import { fetchLeads } from '../api/leads.js';
import { FakeD1Database } from './helpers/fake-d1.mjs';
import { createWorkerEnv } from './helpers/fixtures.mjs';

test('fetchLeads returns a bounded JSON error when the D1 lead lookup fails', async () => {
  const env = createWorkerEnv({
    DB: new FakeD1Database({
      failOnSql: (sql) => /FROM leads/i.test(sql),
    }),
  });

  const response = await fetchLeads(env, 'danfoss');
  const payload = await response.json();

  assert.equal(response.status, 500);
  assert.equal(payload.success, false);
  assert.deepEqual(payload.leads, []);
  assert.match(payload.message, /리드 데이터를 불러오는 중 오류/);
  assert.doesNotMatch(JSON.stringify(payload), /fake D1 forced failure/);
});
