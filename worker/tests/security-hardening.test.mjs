import test from 'node:test';
import assert from 'node:assert/strict';

import worker from '../index.js';
import { verifyAuth } from '../lib/auth.js';
import { checkSelfServiceRateLimit } from '../self-service/rate-limit.js';
import { getLeadsPage } from '../pages/leads.js';
import { getDashboardPage } from '../pages/dashboard.js';
import { getSafeUrlScript } from '../pages/script-snippets.js';
import { createRateLimitStore, createWorkerEnv } from './helpers/fixtures.mjs';
import { createWorkerRequest, readJson, withMockedFetch, WORKER_ORIGIN } from './helpers/http.mjs';

test('verifyAuth rejects query token authentication and keeps Bearer auth working', async () => {
  const queryOnly = await verifyAuth(
    createWorkerRequest('/api/leads?token=api-secret'),
    createWorkerEnv()
  );
  assert.equal(queryOnly.status, 401);

  const bearer = await verifyAuth(
    createWorkerRequest('/api/leads', {
      headers: { Authorization: 'Bearer api-secret' }
    }),
    createWorkerEnv()
  );
  assert.equal(bearer, null);
});

test('lead detail page route rejects query token authentication', async () => {
  const response = await worker.fetch(
    createWorkerRequest('/leads/lead-1?token=api-secret'),
    createWorkerEnv(),
    {}
  );

  assert.equal(response.status, 401);
  assert.match(await response.text(), /인증이 필요합니다/);
});

test('self-service analyze requires Bearer auth by default', async () => {
  const response = await worker.fetch(
    createWorkerRequest('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company: 'Danfoss' })
    }),
    createWorkerEnv(),
    {}
  );
  const payload = await response.json();

  assert.equal(response.status, 401);
  assert.equal(payload.success, false);
  assert.match(payload.message, /인증이 필요합니다/);
});

test('self-service analyze rate limit is enabled by default and fails closed without storage after auth', async () => {
  const response = await worker.fetch(
    createWorkerRequest('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer api-secret' },
      body: JSON.stringify({ company: 'Danfoss' })
    }),
    createWorkerEnv(),
    {}
  );
  const payload = await response.json();

  assert.equal(response.status, 503);
  assert.equal(payload.success, false);
  assert.match(payload.message, /사용량 제한 설정/);
});

test('self-service rate limiter throttles by default when storage is configured', async () => {
  const env = createWorkerEnv({
    RATE_LIMIT: createRateLimitStore(),
    SELF_SERVICE_RATE_LIMIT_MAX: '1',
    SELF_SERVICE_RATE_LIMIT_WINDOW_SEC: '60'
  });
  const first = await checkSelfServiceRateLimit(
    createWorkerRequest('/api/analyze', { method: 'POST', headers: { 'CF-Connecting-IP': '203.0.113.10' } }),
    env
  );
  const second = await checkSelfServiceRateLimit(
    createWorkerRequest('/api/analyze', { method: 'POST', headers: { 'CF-Connecting-IP': '203.0.113.10' } }),
    env
  );

  assert.equal(first, null);
  assert.equal(second.status, 429);
});

test('self-service analyze route throttles authenticated callers before expensive work', async () => {
  const env = createWorkerEnv({
    RATE_LIMIT: createRateLimitStore(),
    SELF_SERVICE_RATE_LIMIT_MAX: '1',
    SELF_SERVICE_RATE_LIMIT_WINDOW_SEC: '60'
  });
  const init = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer api-secret',
      'CF-Connecting-IP': '203.0.113.20'
    },
    body: JSON.stringify({ company: 'Danfoss', industry: 'HVAC' })
  };

  const first = await worker.fetch(createWorkerRequest('/api/analyze', init), env, {});
  const second = await worker.fetch(createWorkerRequest('/api/analyze', init), env, {});

  assert.equal(first.status, 503);
  assert.equal(second.status, 429);
});

test('lead list evidence links use safeUrl with noopener and do not propagate tokens in detail links', () => {
  const html = getLeadsPage();

  assert.match(html, /href="\$\{safeUrl\(e\.sourceUrl\)\}"/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.doesNotMatch(html, /href="\$\{esc\(e\.sourceUrl\)\}"/);
  assert.doesNotMatch(html, /\?token=/);
  assert.match(html, /onclick="openLeadDetail/);
  assert.match(html, /fetch\(href, \{ headers: authHeaders\(\) \}\)/);
});

test('safeUrl allows only well-formed http and https URLs', () => {
  const safeUrl = Function('esc', `${getSafeUrlScript()}; return safeUrl;`)((value) => String(value));

  assert.equal(safeUrl('https://example.com/news?a=1'), 'https://example.com/news?a=1');
  assert.equal(safeUrl('http://example.com/news'), 'http://example.com/news');
  assert.equal(safeUrl('javascript:alert(1)'), '#');
  assert.equal(safeUrl('data:text/html,<script>alert(1)</script>'), '#');
  assert.equal(safeUrl('https://['), '#');
  assert.equal(safeUrl('//example.com/news'), '#');
});

test('dashboard detail links do not propagate tokens in URLs', () => {
  const html = getDashboardPage(createWorkerEnv());

  assert.doesNotMatch(html, /\?token=/);
  assert.match(html, /onclick="openLeadDetail/);
  assert.match(html, /fetch\(href, \{ headers: authHeaders\(\) \}\)/);
});

test('protected API route method mismatches authenticate before returning 405', async () => {
  const missing = await worker.fetch(
    createWorkerRequest('/api/leads', { method: 'POST' }),
    createWorkerEnv(),
    {}
  );
  const missingPayload = await readJson(missing);

  assert.equal(missing.status, 401);
  assert.equal(missingPayload.success, false);
  assert.match(missingPayload.message, /인증이 필요합니다/);
  assert.equal(missing.headers.get('Allow'), null);

  const wrong = await worker.fetch(
    createWorkerRequest('/api/leads', {
      method: 'POST',
      headers: { Authorization: 'Bearer wrong-token' }
    }),
    createWorkerEnv(),
    {}
  );
  const wrongPayload = await readJson(wrong);

  assert.equal(wrong.status, 401);
  assert.equal(wrongPayload.success, false);
  assert.match(wrongPayload.message, /인증 실패/);
  assert.equal(wrong.headers.get('Allow'), null);

  const authorized = await worker.fetch(
    createWorkerRequest('/api/leads', {
      method: 'POST',
      headers: { Authorization: 'Bearer api-secret' }
    }),
    createWorkerEnv(),
    {}
  );
  const authorizedPayload = await readJson(authorized);

  assert.equal(authorized.status, 405);
  assert.equal(authorized.headers.get('Allow'), 'GET');
  assert.equal(authorizedPayload.success, false);
});

test('internal report route requires the internal API token when configured', async () => {
  const env = createWorkerEnv({
    INTERNAL_API_TOKEN: 'internal-secret'
  });

  await withMockedFetch(
    async () => {
      throw new Error('internal route should not fetch before internal auth succeeds');
    },
    async () => {
      const missing = await worker.fetch(
        createWorkerRequest('/api/internal/profiles/danfoss/latest-published'),
        env,
        {}
      );
      const missingPayload = await readJson(missing);

      assert.equal(missing.status, 401);
      assert.match(missingPayload.message, /인증이 필요합니다/);

      const apiToken = await worker.fetch(
        createWorkerRequest('/api/internal/profiles/danfoss/latest-published', {
          headers: { Authorization: 'Bearer api-secret' }
        }),
        env,
        {}
      );
      const apiTokenPayload = await readJson(apiToken);

      assert.equal(apiToken.status, 401);
      assert.match(apiTokenPayload.message, /인증 실패/);
    }
  );

  await withMockedFetch(
    async () => new Response(null, { status: 404 }),
    async () => {
      const internalToken = await worker.fetch(
        createWorkerRequest('/api/internal/profiles/danfoss/latest-published', {
          headers: { Authorization: 'Bearer internal-secret' }
        }),
        env,
        {}
      );
      const internalPayload = await readJson(internalToken);

      assert.equal(internalToken.status, 404);
      assert.equal(internalPayload.schemaVersion, 'crm.published-report.v1');
      assert.equal(internalPayload.error.code, 'report_not_found');
    }
  );
});

test('API token remains a compatibility fallback for internal routes until an internal token is configured', async () => {
  await withMockedFetch(
    async () => new Response(null, { status: 404 }),
    async () => {
      const response = await worker.fetch(
        createWorkerRequest('/api/internal/profiles/danfoss/latest-published', {
          headers: { Authorization: 'Bearer api-secret' }
        }),
        createWorkerEnv(),
        {}
      );
      const payload = await readJson(response);

      assert.equal(response.status, 404);
      assert.equal(payload.error.code, 'report_not_found');
    }
  );
});

test('auth failures include CORS only for allowed origins', async () => {
  const allowed = await worker.fetch(
    createWorkerRequest('/api/leads', {
      headers: { Origin: WORKER_ORIGIN }
    }),
    createWorkerEnv(),
    {}
  );

  assert.equal(allowed.status, 401);
  assert.equal(allowed.headers.get('Access-Control-Allow-Origin'), WORKER_ORIGIN);
  assert.equal(allowed.headers.get('Vary'), 'Origin');

  const disallowed = await worker.fetch(
    createWorkerRequest('/api/leads', {
      headers: { Origin: 'https://evil.example' }
    }),
    createWorkerEnv(),
    {}
  );

  assert.equal(disallowed.status, 401);
  assert.equal(disallowed.headers.get('Access-Control-Allow-Origin'), null);
});

test('CSV export and reference-library routes reject missing and wrong bearer tokens', async () => {
  const cases = [
    createWorkerRequest('/api/export/csv'),
    createWorkerRequest('/api/export/csv', { headers: { Authorization: 'Bearer wrong-token' } }),
    createWorkerRequest('/api/references?profile=danfoss'),
    createWorkerRequest('/api/references?profile=danfoss', { headers: { Authorization: 'Bearer wrong-token' } }),
    createWorkerRequest('/api/references', { method: 'POST', json: { profileId: 'danfoss' } }),
    createWorkerRequest('/api/references/1', { method: 'DELETE', headers: { Authorization: 'Bearer wrong-token' } })
  ];

  for (const request of cases) {
    const response = await worker.fetch(request, createWorkerEnv(), {});
    const payload = await readJson(response);

    assert.equal(response.status, 401);
    assert.equal(payload.success, false);
  }
});

test('lead collection errors do not echo secret-like upstream failure details', async () => {
  const env = createWorkerEnv({ DB: null });
  await withMockedFetch(
    async () => {
      throw new Error('upstream failed with api-secret github-secret OPENAI_API_KEY=sk-live secret-token');
    },
    async () => {
      const response = await worker.fetch(
        createWorkerRequest('/api/leads?profile=danfoss', {
          headers: { Authorization: 'Bearer api-secret' }
        }),
        env,
        {}
      );
      const payload = await readJson(response);
      const body = JSON.stringify(payload);

      assert.equal(response.status, 500);
      assert.equal(payload.success, false);
      assert.doesNotMatch(body, /api-secret|github-secret|sk-live|secret-token|OPENAI_API_KEY/i);
    }
  );
});

test('unexpected API route exceptions return safe JSON errors without secret leakage', async () => {
  const secretDb = {
    prepare() {
      throw new Error('DB exploded with api-secret and INTERNAL_API_TOKEN=internal-secret');
    }
  };
  const response = await worker.fetch(
    createWorkerRequest('/api/dashboard?profile=danfoss', {
      headers: { Authorization: 'Bearer api-secret' }
    }),
    createWorkerEnv({ DB: secretDb }),
    {}
  );
  const payload = await readJson(response);
  const body = JSON.stringify(payload);

  assert.equal(response.status, 500);
  assert.equal(payload.success, false);
  assert.doesNotMatch(body, /api-secret|internal-secret|INTERNAL_API_TOKEN/i);
});

test('model-backed API error responses hide provider bodies and configured secrets', async () => {
  const env = createWorkerEnv({
    GEMINI_API_KEY: 'gemini-secret-value'
  });
  await withMockedFetch(
    async () => new Response('provider rejected gemini-secret-value and stack=secret-token', { status: 500 }),
    async () => {
      const response = await worker.fetch(
        createWorkerRequest('/api/ppt', {
          method: 'POST',
          headers: { Authorization: 'Bearer api-secret' },
          json: {
            lead: {
              company: 'Danfoss',
              summary: 'Factory modernization',
              product: 'Drive',
              roi: 'TBD',
              globalContext: 'Energy efficiency'
            }
          }
        }),
        env,
        {}
      );
      const payload = await readJson(response);
      const body = JSON.stringify(payload);

      assert.equal(response.status, 500);
      assert.equal(payload.success, false);
      assert.doesNotMatch(body, /gemini-secret-value|secret-token|provider rejected/i);
    }
  );
});
