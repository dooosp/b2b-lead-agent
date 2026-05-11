import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

import { FakeD1Database } from '../tests/helpers/fake-d1.mjs';
import {
  LOCAL_E2E_TOKEN,
  createLocalE2EHarness,
  createLocalSmokeEnv,
  installLocalOnlyFetchGuard,
} from '../tests/helpers/local-e2e-harness.mjs';

function authHeaders(overrides = {}) {
  return {
    Authorization: `Bearer ${LOCAL_E2E_TOKEN}`,
    ...overrides,
  };
}

async function readJson(response) {
  return response.json();
}

test('local-only fake D1 Worker smoke covers core lead routes and browser rendering', async (t) => {
  const fetchGuard = installLocalOnlyFetchGuard();
  const env = createLocalSmokeEnv();
  const harness = await createLocalE2EHarness({ env });
  let browser;
  let failingHarness;

  t.after(async () => {
    if (browser) await browser.close();
    if (failingHarness) await failingHarness.close();
    await harness.close();
    fetchGuard.restore();
  });

  const localFetch = (path, init = {}) => {
    const headers = new Headers(init.headers || {});
    for (const [key, value] of Object.entries(authHeaders())) {
      if (!headers.has(key)) headers.set(key, value);
    }
    return fetch(`${harness.origin}${path}`, { ...init, headers });
  };

  const manifestResponse = await fetch(`${harness.origin}/manifest.json`);
  const manifest = await readJson(manifestResponse);
  assert.equal(manifestResponse.status, 200);
  assert.match(manifestResponse.headers.get('content-type') || '', /application\/json/);
  assert.equal(manifest.name, 'B2B Sales Intelligence');
  assert.equal(manifest.start_url, '/');

  const leadsResponse = await localFetch('/api/leads?profile=danfoss');
  const leadsPayload = await readJson(leadsResponse);
  assert.equal(leadsResponse.status, 200);
  assert.equal(leadsPayload.source, 'd1');
  assert.equal(leadsPayload.leads.length, 2);
  const approvedLead = leadsPayload.leads.find((lead) => lead.id === 'local-lead-approved');
  assert.equal(approvedLead.reviewStatus, 'APPROVED');

  const detailResponse = await localFetch('/leads/local-lead-approved');
  const detailHtml = await detailResponse.text();
  assert.equal(detailResponse.status, 200);
  assert.match(detailHtml, /사람 검토/);
  assert.match(detailHtml, /"reviewStatus":"APPROVED"/);
  assert.match(detailHtml, /신뢰도 HIGH/);
  assert.match(detailHtml, /Local evidence quote/);

  const dashboardResponse = await localFetch('/api/dashboard?profile=all');
  const dashboardPayload = await readJson(dashboardResponse);
  assert.equal(dashboardResponse.status, 200);
  assert.equal(dashboardPayload.success, true);
  assert.equal(dashboardPayload.metrics.total, 3);
  assert.equal(dashboardPayload.metrics.gradeA, 2);
  assert.equal(dashboardPayload.metrics.statusDistribution.NEW, 1);

  const csvResponse = await localFetch('/api/export/csv?profile=all');
  const csvBytes = new Uint8Array(await csvResponse.arrayBuffer());
  const csvText = new TextDecoder('utf-8').decode(csvBytes);
  assert.equal(csvResponse.status, 200);
  assert.match(csvResponse.headers.get('content-type') || '', /text\/csv/);
  assert.deepEqual([...csvBytes.slice(0, 3)], [0xef, 0xbb, 0xbf]);
  assert.match(csvText, /회사명,프로젝트,추천제품/);
  assert.match(csvText, /Local Factory Automation/);
  assert.match(csvText, /APPROVED/);

  const notFoundResponse = await localFetch('/api/not-a-real-route');
  const notFoundPayload = await readJson(notFoundResponse);
  assert.equal(notFoundResponse.status, 404);
  assert.equal(notFoundPayload.success, false);

  const methodResponse = await localFetch('/api/leads', { method: 'POST' });
  const methodPayload = await readJson(methodResponse);
  assert.equal(methodResponse.status, 405);
  assert.equal(methodResponse.headers.get('allow'), 'GET');
  assert.equal(methodPayload.success, false);

  const invalidProfileResponse = await localFetch('/api/dashboard?profile=prod-like-unknown');
  const invalidProfilePayload = await readJson(invalidProfileResponse);
  assert.equal(invalidProfileResponse.status, 400);
  assert.equal(invalidProfilePayload.success, false);

  const missingLeadResponse = await localFetch('/leads/not-found-local-lead');
  assert.equal(missingLeadResponse.status, 404);
  assert.match(await missingLeadResponse.text(), /리드를 찾을 수 없습니다/);

  failingHarness = await createLocalE2EHarness({
    env: createLocalSmokeEnv({
      DB: new FakeD1Database({ failOnSql: [/SELECT \* FROM leads WHERE profile_id/i] }),
    }),
  });
  const failingResponse = await fetch(`${failingHarness.origin}/api/leads?profile=danfoss`, {
    headers: authHeaders(),
  });
  const failingPayload = await readJson(failingResponse);
  assert.equal(failingResponse.status, 500);
  assert.equal(failingPayload.success, false);
  assert.match(failingPayload.message, /리드 데이터를 불러오는 중 오류/);
  assert.doesNotMatch(JSON.stringify(failingPayload), /fake D1 forced failure/);

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addInitScript((token) => {
    window.sessionStorage.setItem('b2b_token', token);
  }, LOCAL_E2E_TOKEN);
  const page = await context.newPage();

  await page.goto(`${harness.origin}/leads?profile=danfoss`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const el = document.querySelector('#leadsList');
    return !!el && !String(el.textContent || '').includes('로딩 중');
  });

  await assertRenderedText(page, [
    'Local Factory Automation',
    '검토 승인',
    '신뢰도 HIGH',
    '검증됨',
    '근거 1개',
    '데이터 공백',
  ]);

  assert.equal(await page.locator('#leadsList .lead-card').count(), 2);
  await page.locator('[data-filter-key="reviewStatus"]').selectOption('NEEDS_REVIEW');
  assert.equal(await page.locator('#leadsList .lead-card').count(), 1);
  await assertRenderedText(page, ['Local Data Center Cooling', '전체 2건 중 표시']);
  assert.equal(await page.getByRole('link', { name: 'Local Factory Automation' }).count(), 0);

  await page.locator('[data-filter-key="confidence"]').selectOption('LOW');
  await assertRenderedText(page, ['필터 결과가 없습니다']);
  assert.equal(await page.locator('#leadsList .lead-card').count(), 0);

  await page.getByRole('button', { name: '초기화' }).click();
  assert.equal(await page.locator('#leadsList .lead-card').count(), 2);

  await page.getByRole('link', { name: 'Local Factory Automation' }).click();
  await page.waitForSelector('#detailContent .detail-section');
  assert.match(page.url(), /\/leads\/local-lead-approved$/);
  await assertRenderedText(page, [
    '사람 검토',
    '검토 승인',
    '신뢰도 HIGH',
    '솔루션 번역',
    'Turbocor compressor',
    'Approved and verified context',
    'Local evidence quote',
    'Follow up with operations director',
  ]);

  await page.goto(`${harness.origin}/dashboard?profile=all`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const el = document.querySelector('#dashContent');
    return !!el && !String(el.textContent || '').includes('로딩 중');
  });
  await assertRenderedText(page, [
    '대시보드',
    '총 리드',
    'A등급',
    '전환율',
    '활성 리드',
  ]);

  assert.deepEqual(fetchGuard.blockedUrls, []);
});

async function assertRenderedText(page, expectedTexts) {
  const bodyText = await page.locator('body').innerText();
  for (const text of expectedTexts) {
    assert.match(bodyText, new RegExp(escapeRegExp(text)));
  }
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
