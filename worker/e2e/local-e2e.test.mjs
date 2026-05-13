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
  let reviewFailureHarness;

  t.after(async () => {
    if (browser) await browser.close();
    if (failingHarness) await failingHarness.close();
    if (reviewFailureHarness) await reviewFailureHarness.close();
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
  assert.equal(leadsPayload.reviewerActionQueue.totalCount, 2);
  assert.deepEqual(leadsPayload.reviewerActionQueue.items.map((item) => item.leadId), [
    'local-lead-approved',
    'local-lead-review',
  ]);
  assert.equal(leadsPayload.reviewerActionQueue.summary.approvalCandidates, 1);
  assert.equal(leadsPayload.reviewerActionQueue.summary.needsEvidence, 1);
  assert.equal(leadsPayload.leadReviewSession.totalLeads, 2);
  assert.equal(leadsPayload.leadReviewSession.visibleLeads, 2);
  assert.equal(leadsPayload.leadReviewSession.approvedCount, 1);
  assert.equal(leadsPayload.leadReviewSession.needsReviewCount, 1);
  assert.equal(leadsPayload.leadReviewSession.remainingByLane.approval_candidates, 1);
  assert.equal(leadsPayload.leadReviewSession.remainingByLane.needs_evidence, 1);
  assert.equal(leadsPayload.leadReviewSession.nextLead.leadId, 'local-lead-approved');
  assert.equal(leadsPayload.leadReviewSession.nextLead.reviewNoteSuggestion.state, 'APPROVED');
  assert.match(leadsPayload.leadReviewSession.nextLead.reviewNoteSuggestion.text, /Decision: APPROVED/);
  assert.equal(leadsPayload.reviewerActionQueue.items[0].reviewNoteSuggestion.state, 'APPROVED');
  assert.equal(leadsPayload.reviewerActionQueue.items[0].reviewNoteTemplates.length, 3);
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
    '목록 품질 게이트',
    '목록 게이트 통과',
    '목록 게이트 보강 필요',
    'Lead Action Intelligence',
    'Prepare reviewed follow-up',
    'Enrich before review',
    'Priority high',
    'Risk flags 0',
    'Missing info 0',
    'Reviewer Action Queue',
    '승인 후보 1건',
    '보강 필요 1건',
    '리스크 확인 0건',
    '낮은 우선순위 0건',
    'Risk flags 5',
    'Missing info 6',
    'Lead Review Session',
    '리뷰 노트 제안',
    '승인 노트',
    'Decision: APPROVED',
    '검토 필요 노트',
    '리스크 확인 노트',
    'read-only reviewer note suggestion',
    '현재 큐',
    '다음 검토 리드: Local Factory Automation',
    '승인 / 검토 필요',
    '영업 신규',
    '목록 게이트 요약',
    '게이트 통과 1건',
    '보강 필요 1건',
    '데이터 공백',
    '검토 리스크',
    '근거 누락 1건',
    '데이터 공백 리드 1건',
    '검토 가능 1건',
  ]);

  assert.equal(await page.locator('#leadsList .lead-card').count(), 2);
  await page.getByRole('button', { name: '다음 검토 리드' }).click();
  assert.equal(await page.locator('#leadsList .lead-card.review-session-focus').count(), 1);

  await page.locator('[data-filter-key="gateStatus"]').selectOption('ready');
  assert.equal(await page.locator('#leadsList .lead-card').count(), 1);
  await assertRenderedText(page, ['Local Factory Automation', '목록 게이트 통과', 'Prepare reviewed follow-up', '전체 2건 중 표시', '게이트 통과 1건', '보강 필요 0건']);
  assert.equal(await page.getByRole('link', { name: 'Local Data Center Cooling' }).count(), 0);

  await page.getByRole('button', { name: '초기화' }).click();
  await page.locator('[data-filter-key="queueLane"]').selectOption('approval_candidates');
  assert.equal(await page.locator('#leadsList .lead-card').count(), 1);
  await assertRenderedText(page, ['Local Factory Automation', '승인 후보 1건', '보강 필요 0건']);
  assert.equal(await page.getByRole('link', { name: 'Local Data Center Cooling' }).count(), 0);

  await page.getByRole('button', { name: '초기화' }).click();
  await page.locator('[data-filter-key="nextReviewAction"]').selectOption('enrich_before_review');
  assert.equal(await page.locator('#leadsList .lead-card').count(), 1);
  await assertRenderedText(page, ['Local Data Center Cooling', 'Enrich before review', 'Risk flags 5', 'Missing info 6']);
  assert.equal(await page.getByRole('link', { name: 'Local Factory Automation' }).count(), 0);

  await page.getByRole('button', { name: '초기화' }).click();
  await page.locator('[data-filter-key="riskFlag"]').selectOption('has');
  assert.equal(await page.locator('#leadsList .lead-card').count(), 1);
  await assertRenderedText(page, ['Local Data Center Cooling', '리스크 플래그', '보강 필요 1건']);
  assert.equal(await page.getByRole('link', { name: 'Local Factory Automation' }).count(), 0);

  await page.getByRole('button', { name: '초기화' }).click();
  await page.locator('[data-filter-key="missingInfo"]').selectOption('none');
  assert.equal(await page.locator('#leadsList .lead-card').count(), 1);
  await assertRenderedText(page, ['Local Factory Automation', 'Missing info 0', '승인 후보 1건']);
  assert.equal(await page.getByRole('link', { name: 'Local Data Center Cooling' }).count(), 0);

  await page.getByRole('button', { name: '초기화' }).click();
  await page.locator('[data-filter-key="gateStatus"]').selectOption('review');
  assert.equal(await page.locator('#leadsList .lead-card').count(), 1);
  await assertRenderedText(page, ['Local Data Center Cooling', '목록 게이트 보강 필요', 'Enrich before review', '게이트 통과 0건', '보강 필요 1건']);
  assert.equal(await page.getByRole('link', { name: 'Local Factory Automation' }).count(), 0);

  await page.getByRole('button', { name: '초기화' }).click();
  await page.locator('[data-filter-key="reviewStatus"]').selectOption('NEEDS_REVIEW');
  assert.equal(await page.locator('#leadsList .lead-card').count(), 1);
  await assertRenderedText(page, ['Local Data Center Cooling', '전체 2건 중 표시']);
  assert.equal(await page.getByRole('link', { name: 'Local Factory Automation' }).count(), 0);

  await page.locator('[data-filter-key="confidence"]').selectOption('LOW');
  await assertRenderedText(page, ['필터 결과가 없습니다']);
  assert.equal(await page.locator('#leadsList .lead-card').count(), 0);
  await page.locator('#leadsList .filter-empty-state button').click();
  assert.equal(await page.locator('#leadsList .lead-card').count(), 2);

  await page.getByText('칸반 보드').click();
  assert.equal(await page.locator('#kanbanView .kanban-card').count(), 2);
  assert.equal(await page.locator('#kanbanView .k-gate.gate-ready').count(), 1);
  assert.equal(await page.locator('#kanbanView .k-gate.gate-review').count(), 1);
  await assertRenderedText(page, ['Local Factory Automation', '목록 게이트 통과', '목록 게이트 보강 필요', 'Action: Prepare reviewed follow-up', 'Action: Enrich before review']);

  await page.locator('[data-filter-key="confidence"]').selectOption('LOW');
  assert.equal(await page.locator('#kanbanView .kanban-card').count(), 0);
  await assertRenderedText(page, ['필터 결과가 없습니다']);
  assert.equal(await page.locator('#kanbanView .filter-empty-state').count(), 1);
  await page.locator('#kanbanView .filter-empty-state button').click();
  assert.equal(await page.locator('#kanbanView .kanban-card').count(), 2);

  await page.getByText('리스트').click();
  await page.locator('[data-filter-key="nextReviewAction"]').selectOption('enrich_before_review');
  await page.getByRole('button', { name: '승인' }).click();
  await page.waitForFunction(() => {
    const status = document.querySelector('#reviewSessionStatus');
    return !!status && String(status.textContent || '').includes('영업 상태는 접촉 완료 유지');
  });
  await assertRenderedText(page, ['검토 상태만 승인', '영업 상태는 접촉 완료 유지', '필터 결과가 없습니다']);
  await page.locator('#leadsList .filter-empty-state button').click();
  await page.waitForFunction(() => {
    const cards = [...document.querySelectorAll('#leadsList .lead-card')];
    const card = cards.find((candidate) => String(candidate.textContent || '').includes('Local Data Center Cooling'));
    return !!card
      && String(card.textContent || '').includes('검토 승인')
      && String(card.textContent || '').includes('Reconcile review conflict');
  });
  await assertRenderedText(page, ['리스크 확인 1건', '보강 필요 0건', 'Risk flags', 'Missing info']);

  const updatedLeadsResponse = await localFetch('/api/leads?profile=danfoss');
  const updatedLeadsPayload = await readJson(updatedLeadsResponse);
  const updatedReviewLead = updatedLeadsPayload.leads.find((lead) => lead.id === 'local-lead-review');
  assert.equal(updatedReviewLead.reviewStatus, 'APPROVED');
  assert.equal(updatedReviewLead.status, 'CONTACTED');
  const updatedReviewQueueItem = updatedLeadsPayload.reviewerActionQueue.items.find((item) => item.leadId === 'local-lead-review');
  assert.equal(updatedReviewQueueItem.nextReviewAction, 'reconcile_review_conflict');
  assert.equal(updatedReviewQueueItem.queueLane, 'risk_review');
  assert.equal(updatedReviewQueueItem.reviewNoteSuggestion.state, 'DATA_GAP');
  assert.match(updatedReviewQueueItem.reviewNoteSuggestion.text, /Follow-up check: DATA_GAP/);
  assert.match(updatedReviewQueueItem.reviewNoteSuggestion.text, /Reconcile review conflict/);

  await page.locator('[data-filter-key="reviewStatus"]').selectOption('NEEDS_REVIEW');
  assert.equal(await page.locator('#leadsList .lead-card').count(), 0);
  await assertRenderedText(page, ['필터 결과가 없습니다']);
  await page.locator('#leadsList .filter-empty-state button').click();
  assert.equal(await page.locator('#leadsList .lead-card').count(), 2);

  await page.goto(`${harness.origin}/roleplay?profile=danfoss&lead=0`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const select = document.querySelector('#leadSelect');
    return !!select && !String(select.textContent || '').includes('로딩 중');
  });
  await assertRenderedText(page, [
    '영업 역량 시뮬레이션',
    '이해관계자 맥락은 연습 보조입니다',
    '아웃리치 승인',
    'CRM 배정',
    'Local Factory Automation',
  ]);

  await page.goto(`${harness.origin}/leads?profile=danfoss`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const el = document.querySelector('#leadsList');
    return !!el && !String(el.textContent || '').includes('로딩 중');
  });
  await page.getByRole('link', { name: 'Local Factory Automation' }).click();
  await page.waitForSelector('#detailContent .detail-section');
  assert.match(page.url(), /\/leads\/local-lead-approved$/);
  await assertRenderedText(page, [
    '사람 검토',
    '품질 게이트',
    '품질 게이트 통과',
    'LEAD ACTION INTELLIGENCE',
    'Prepare reviewed follow-up',
    'Priority high / Confidence high',
    '리뷰 노트 제안',
    'Decision: APPROVED',
    '승인 노트',
    '검토 필요 노트',
    'Suggested follow-up',
    '검토 승인',
    '신뢰도 HIGH',
    '솔루션 번역',
    'Turbocor compressor',
    'Approved and verified context',
    '제품/신호 맥락',
    'Vendor shortlist',
    'Cooling energy cost',
    '이해관계자 준비',
    'Primary role: Operations Director',
    'Economic buyer',
    'Technical evaluator',
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

  const reviewFailureEnv = createLocalSmokeEnv();
  reviewFailureEnv.DB.failOnSql = [/UPDATE leads SET/i];
  reviewFailureHarness = await createLocalE2EHarness({ env: reviewFailureEnv });
  await page.goto(`${reviewFailureHarness.origin}/leads?profile=danfoss`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const el = document.querySelector('#leadsList');
    return !!el && !String(el.textContent || '').includes('로딩 중');
  });
  await page.locator('[data-filter-key="nextReviewAction"]').selectOption('enrich_before_review');
  await page.getByRole('button', { name: '승인' }).click();
  await page.waitForSelector('#reviewSessionStatus.is-error');
  const reviewFailureText = await page.locator('#reviewSessionStatus').textContent();
  assert.match(reviewFailureText || '', /검토 상태를 저장하지 못했습니다/);
  assert.doesNotMatch(reviewFailureText || '', /fake D1 forced failure/);
  await assertRenderedText(page, ['Local Data Center Cooling', '검토 필요', 'Enrich before review']);

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
