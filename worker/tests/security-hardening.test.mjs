import test from 'node:test';
import assert from 'node:assert/strict';

import worker from '../index.js';
import { verifyAuth } from '../lib/auth.js';
import { checkSelfServiceRateLimit } from '../self-service/rate-limit.js';
import { getLeadsPage } from '../pages/leads.js';
import { getDashboardPage } from '../pages/dashboard.js';
import { getSafeUrlScript } from '../pages/script-snippets.js';
import { createRateLimitStore, createWorkerEnv } from './helpers/fixtures.mjs';
import { createWorkerRequest } from './helpers/http.mjs';

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
