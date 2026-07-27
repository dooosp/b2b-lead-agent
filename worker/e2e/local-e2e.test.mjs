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

function assertParseableIsoTimestamp(value) {
  assert.equal(typeof value, 'string');
  assert.ok(value.length > 0);
  assert.equal(new Date(value).toISOString(), value);
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
  assert.equal(manifest.name, 'Pursuit Twin KR');
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
  assert.equal(approvedLead.manualReviewNotes, 'Seeded local smoke note');
  assert.equal(approvedLead.manualReviewNotesProvenance, 'human_entered');
  assert.equal(approvedLead.manualReviewNotesUpdatedAt, '2026-05-01T10:05:00.000Z');
  assert.equal(approvedLead.reviewNoteSuggestion, undefined);

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
      DB: new FakeD1Database({
        failOnSql: [/SELECT\s+h\.snapshot_id\s+AS\s+snapshot_head_id/i],
      }),
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
    window.__copiedReviewNotes = [];
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.__copiedReviewNotes.push(String(text));
        },
      },
    });
  }, LOCAL_E2E_TOKEN);
  const page = await context.newPage();

  await page.goto(`${harness.origin}/`, { waitUntil: 'domcontentloaded' });
  await assertRenderedText(page, [
    'Pursuit Twin v0 — Spec Delta + Minimum Evidence to Advance',
    'PURSUE → REVIEW_REQUIRED',
    'carry-forward: false',
    'Minimum Evidence to Advance',
    'SYNTHETIC · NOT_PRODUCTION_EVIDENCE',
    'Issue #165 production proof: HOLD',
    'final decision: NOT_MADE',
  ]);
  assert.equal(await page.locator('[data-testid="spec-delta-summary"]').count(), 1);
  assert.equal(await page.locator('[data-testid="minimum-evidence-summary"]').count(), 1);
  assert.equal(await page.locator('[data-testid="pursuit-twin-boundary"][data-boundary="NOT_PRODUCTION_EVIDENCE"]').count(), 1);

  await page.goto(`${harness.origin}/leads?profile=danfoss`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const el = document.querySelector('#leadsList');
    return !!el && !String(el.textContent || '').includes('로딩 중');
  });

  await assertRenderedText(page, [
    '프로젝트 신호 검토 큐',
    'Local Factory Automation',
    '사람 검토: 승인',
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
    '다음 리뷰',
    'Local Factory Automation',
    '세션 보기',
    'Lead Review Session',
    '생성된 검토 메모 제안',
    '검토 메모 제안 요약',
    '생성된 제안은 복사 전용이며 자동 저장/전송되지 않습니다',
    '사람이 저장한 메모가 아닙니다',
    '복사 후 사람이 직접 검토해 사용하세요',
    '승인 노트',
    'Decision: APPROVED',
    '검토 필요 노트',
    '리스크 확인 노트',
    '현재 큐',
    '다음 검토 리드: Local Factory Automation',
    '승인 / 검토 필요',
    '영업 신규',
    '리뷰 요약',
    '현재 필터 기준',
    '큐 상태',
    '주요 병목',
    '다음 리뷰 포커스',
    '승인 1건 / 검토 필요 1건 / 대기 0건',
    '준비 1건 / 보강 필요 1건',
    '주의: 이 요약은 리뷰 보조용이며 CRM 할당/아웃리치 승인이 아닙니다.',
    '프로덕션 관측 근거가 아닙니다',
    '목록 게이트 요약',
    '게이트 통과 1건',
    '보강 필요 1건',
    '데이터 공백',
    '검토 리스크',
    '근거 누락 1건',
    '데이터 공백 리드 1건',
    '검토 가능 1건',
    'Reviewer Productivity Toolkit',
    '노트 복사 0건',
    '상태 변경 0건',
    '포커스 이동 0건',
  ]);
  assert.doesNotMatch(await page.locator('body').innerText(), /검토 검토 필요/);
  assert.equal(await page.evaluate(() => {
    const strip = document.querySelector('#nextReviewStrip');
    const filters = document.querySelector('#reviewQueueFilters');
    return !!strip && !!filters && !!(strip.compareDocumentPosition(filters) & Node.DOCUMENT_POSITION_FOLLOWING);
  }), true);
  assert.equal(await page.evaluate(() => {
    const root = document.querySelector('.review-session-panel .review-note-suggestion');
    const summary = root?.querySelector('.review-note-summary');
    const payload = root?.querySelector('[data-review-note-text]');
    return !!summary && !!payload && !!(summary.compareDocumentPosition(payload) & Node.DOCUMENT_POSITION_FOLLOWING);
  }), true);
  assert.equal(await page.evaluate(() => (
    document.querySelectorAll('.review-session-panel .review-note-variant[open]').length
  )), 0);
  assert.equal(await page.getByRole('tab', { name: '리스트' }).getAttribute('aria-selected'), 'true');
  assert.equal(await page.getByRole('tab', { name: '칸반 보드' }).getAttribute('aria-selected'), 'false');
  assert.deepEqual(await captureListReviewerSemanticSnapshot(page), {
    tablist: {
      label: '리드 보기 전환',
      orientation: 'vertical',
      tabs: [
        { id: 'listViewTab', name: '리스트', controls: 'leadsList', selected: 'true', tabIndex: 0 },
        { id: 'kanbanViewTab', name: '칸반 보드', controls: 'kanbanView', selected: 'false', tabIndex: -1 },
      ],
      panels: [
        { id: 'leadsList', role: 'tabpanel', labelledBy: 'listViewTab', hidden: false },
        { id: 'kanbanView', role: 'tabpanel', labelledBy: 'kanbanViewTab', hidden: true },
      ],
    },
    regions: {
      nextReviewStrip: { label: '다음 리뷰' },
      managerReviewerSummary: { label: '리뷰 요약' },
      reviewerActionQueue: { label: 'Reviewer Action Queue', focusable: true },
      leadReviewSession: { label: 'Lead Review Session', focusable: true },
      productivity: { label: 'Reviewer Productivity Toolkit' },
      shortcutHelp: { role: 'region', label: '단축키 도움말', hidden: true },
      liveStatus: { role: 'status', live: 'polite', atomic: 'true' },
    },
    copyControls: ['현재 노트 복사', '승인 노트 복사', '검토 필요 노트 복사', '리스크 확인 노트 복사'],
  });

  await page.getByRole('tab', { name: '리스트' }).focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'kanbanViewTab');
  assert.equal(await page.getByRole('tab', { name: '칸반 보드' }).getAttribute('aria-selected'), 'false');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !document.getElementById('kanbanView')?.hidden);
  assert.equal(await page.getByRole('tab', { name: '칸반 보드' }).getAttribute('aria-selected'), 'true');
  assert.equal(await page.getByRole('tab', { name: '칸반 보드' }).evaluate((element) => element.tabIndex), 0);
  assert.equal(await page.locator('#kanbanView .kanban-card').count(), 2);

  await page.keyboard.press('Home');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'listViewTab');
  await page.keyboard.press('End');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'kanbanViewTab');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'listViewTab');
  assert.equal(await page.getByRole('tab', { name: '리스트' }).getAttribute('aria-selected'), 'false');
  await page.keyboard.press('Space');
  await page.waitForFunction(() => !document.getElementById('leadsList')?.hidden);
  assert.equal(await page.getByRole('tab', { name: '리스트' }).getAttribute('aria-selected'), 'true');

  await page.getByRole('tab', { name: '리스트' }).focus();
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'kanbanViewTab');
  await page.keyboard.press('ArrowUp');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'listViewTab');
  await page.locator('[data-filter-key="reviewStatus"]').focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(() => document.activeElement?.dataset?.filterKey), 'reviewStatus');
  assert.equal(await page.getByRole('tab', { name: '리스트' }).getAttribute('aria-selected'), 'true');
  await page.locator('[data-filter-key="reviewStatus"]').selectOption('all');
  await page.waitForFunction(() => document.querySelectorAll('#leadsList .lead-card').length === 2);

  const rovingLeadsResponse = await localFetch('/api/leads?profile=danfoss');
  const rovingLeadsPayload = await readJson(rovingLeadsResponse);
  assert.equal(rovingLeadsPayload.leads.find((lead) => lead.id === 'local-lead-approved').reviewStatus, 'APPROVED');
  assert.equal(rovingLeadsPayload.leads.find((lead) => lead.id === 'local-lead-review').reviewStatus, 'NEEDS_REVIEW');

  await assertNoHorizontalOverflow(page, [
    'main.container',
    '#reviewQueueFilters',
    '#nextReviewStrip',
    '.review-session-panel',
    '#reviewProductivityToolkit',
    '#managerReviewerSummary',
    '#reviewerActionQueue',
    '#leadsList .lead-card',
  ]);
  await page.setViewportSize({ width: 390, height: 844 });
  await assertRenderedText(page, ['Reviewer Productivity Toolkit', 'Lead Review Session', 'Reviewer Action Queue', '리뷰 요약']);
  await assertNoHorizontalOverflow(page, [
    'main.container',
    '#reviewQueueFilters',
    '#nextReviewStrip',
    '.review-session-panel',
    '#reviewProductivityToolkit',
    '#managerReviewerSummary',
    '#reviewerActionQueue',
    '#leadsList .lead-card',
    '.review-note-suggestion',
  ]);
  await page.setViewportSize({ width: 1280, height: 720 });

  assert.equal(await page.locator('#leadsList .lead-card').count(), 2);
  await page.getByRole('button', { name: '현재 노트 복사' }).click();
  await page.waitForFunction(() => {
    const status = document.querySelector('#reviewSessionStatus');
    return !!status && String(status.textContent || '').includes('노트를 복사했습니다');
  });
  assert.deepEqual(await page.evaluate(() => window.__copiedReviewNotes), [
    await page.locator('.review-session-panel [data-review-note-text]').first().innerText(),
  ]);
  assert.doesNotMatch((await page.evaluate(() => window.__copiedReviewNotes[0])) || '', /검토 메모 제안 요약|생성된 제안은 복사 전용/);
  await assertRenderedText(page, ['노트 복사 1건', '마지막 작업']);

  await page.locator('#leadsList .lead-card').first().focus();
  await page.keyboard.press('Shift+/');
  await assertRenderedText(page, ['단축키 도움말', 'n', 'j', 'q', 'c', 'Shortcut keys do not change reviewStatus']);
  await page.keyboard.press('j');
  await page.waitForFunction(() => document.querySelectorAll('#leadsList .lead-card.review-session-focus').length === 1);
  await assertRenderedText(page, ['포커스 이동 1건']);

  await page.keyboard.press('q');
  await page.waitForFunction(() => document.activeElement && document.activeElement.id === 'reviewerActionQueue');
  await assertRenderedText(page, ['Reviewer Action Queue', '포커스 이동 2건']);

  await page.keyboard.press('c');
  await page.waitForFunction(() => {
    const status = document.querySelector('#reviewSessionStatus');
    return !!status && String(status.textContent || '').includes('노트를 복사했습니다');
  });
  assert.equal(await page.evaluate(() => window.__copiedReviewNotes.length), 2);
  await assertRenderedText(page, ['노트 복사 2건']);
  await page.getByRole('button', { name: '단축키 도움말' }).focus();
  await page.keyboard.press('j');
  await page.keyboard.press('c');
  assert.equal(await page.evaluate(() => window.__copiedReviewNotes.length), 2);
  await assertRenderedText(page, ['포커스 이동 2건', '노트 복사 2건']);

  await page.locator('.notes-section details').first().click();
  await assertRenderedText(page, ['수동 리뷰 메모 마지막 변경']);
  await page.locator('.notes-textarea').first().focus();
  const manualReviewNoteText = 'Human-entered local E2E manual review note';
  await page.locator('.notes-textarea').first().fill(manualReviewNoteText);
  await page.waitForFunction(() => !!document.querySelector('.notes-saved.show'));
  const manualNotesResponse = await localFetch('/api/leads?profile=danfoss');
  const manualNotesPayload = await readJson(manualNotesResponse);
  const manualNotesLead = manualNotesPayload.leads.find((lead) => lead.id === 'local-lead-approved');
  assert.equal(manualNotesLead.manualReviewNotes, manualReviewNoteText);
  assert.equal(manualNotesLead.manualReviewNotesProvenance, 'human_entered');
  assertParseableIsoTimestamp(manualNotesLead.manualReviewNotesUpdatedAt);
  assert.notEqual(manualNotesLead.manualReviewNotesUpdatedAt, '2026-05-01T10:05:00.000Z');
  assert.equal(manualNotesLead.reviewNoteSuggestion, undefined);
  await page.waitForFunction(() => !document.querySelector('.notes-saved.show'));
  const editedManualReviewNoteText = 'Edited human-entered local E2E manual review note';
  await page.locator('.notes-textarea').first().fill(editedManualReviewNoteText);
  await page.waitForFunction(() => !!document.querySelector('.notes-saved.show'));
  const editedManualNotesResponse = await localFetch('/api/leads?profile=danfoss');
  const editedManualNotesPayload = await readJson(editedManualNotesResponse);
  const editedManualNotesLead = editedManualNotesPayload.leads.find((lead) => lead.id === 'local-lead-approved');
  assert.equal(editedManualNotesLead.manualReviewNotes, editedManualReviewNoteText);
  assert.equal(editedManualNotesLead.manualReviewNotesProvenance, 'human_entered');
  assertParseableIsoTimestamp(editedManualNotesLead.manualReviewNotesUpdatedAt);
  assert.notEqual(editedManualNotesLead.manualReviewNotesUpdatedAt, manualNotesLead.manualReviewNotesUpdatedAt);
  assert.equal(editedManualNotesLead.reviewNoteSuggestion, undefined);
  await page.keyboard.press('j');
  await page.keyboard.press('c');
  assert.equal(await page.evaluate(() => window.__copiedReviewNotes.length), 2);
  await assertRenderedText(page, ['포커스 이동 2건', '노트 복사 2건']);
  await page.waitForFunction(() => !document.querySelector('.notes-saved.show'));
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('.notes-clear-btn').first().click();
  await page.waitForFunction(() => {
    const textarea = document.querySelector('.notes-textarea');
    const indicator = document.querySelector('.notes-saved.show');
    return !!textarea && textarea.value === '' && !!indicator;
  });
  const clearedManualNotesResponse = await localFetch('/api/leads?profile=danfoss');
  const clearedManualNotesPayload = await readJson(clearedManualNotesResponse);
  const clearedManualNotesLead = clearedManualNotesPayload.leads.find((lead) => lead.id === 'local-lead-approved');
  assert.equal(clearedManualNotesLead.manualReviewNotes, '');
  assert.equal(clearedManualNotesLead.manualReviewNotesProvenance, '');
  assertParseableIsoTimestamp(clearedManualNotesLead.manualReviewNotesUpdatedAt);
  assert.notEqual(clearedManualNotesLead.manualReviewNotesUpdatedAt, editedManualNotesLead.manualReviewNotesUpdatedAt);
  assert.equal(clearedManualNotesLead.reviewNoteSuggestion, undefined);
  await assertRenderedText(page, ['수동 리뷰 메모가 마지막으로 비워짐/변경됨']);

  const shortcutLeadsResponse = await localFetch('/api/leads?profile=danfoss');
  const shortcutLeadsPayload = await readJson(shortcutLeadsResponse);
  assert.equal(shortcutLeadsPayload.leads.find((lead) => lead.id === 'local-lead-approved').reviewStatus, 'APPROVED');
  assert.equal(shortcutLeadsPayload.leads.find((lead) => lead.id === 'local-lead-review').reviewStatus, 'NEEDS_REVIEW');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const el = document.querySelector('#leadsList');
    return !!el && !String(el.textContent || '').includes('로딩 중');
  });
  await assertRenderedText(page, ['노트 복사 0건', '상태 변경 0건', '포커스 이동 0건']);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
  });
  await page.getByRole('button', { name: '현재 노트 복사' }).click();
  await page.waitForFunction(() => {
    const status = document.querySelector('#reviewSessionStatus');
    return !!status && String(status.textContent || '').includes('직접 복사');
  });
  await assertRenderedText(page, ['Clipboard API를 사용할 수 없어', '노트 복사 0건']);

  await page.getByRole('button', { name: '다음 검토 리드' }).click();
  assert.equal(await page.locator('#leadsList .lead-card.review-session-focus').count(), 1);

  await page.locator('[data-filter-key="gateStatus"]').selectOption('ready');
  assert.equal(await page.locator('#leadsList .lead-card').count(), 1);
  await assertRenderedText(page, ['Local Factory Automation', '목록 게이트 통과', 'Prepare reviewed follow-up', '전체 2건 중 표시', '게이트 통과 1건', '보강 필요 0건', '승인 1건 / 검토 필요 0건 / 대기 0건', '준비 1건 / 보강 필요 0건']);
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
  assert.deepEqual(await captureZeroResultResetSnapshot(page, '#leadsList'), {
    role: 'status',
    live: 'polite',
    atomic: 'true',
    resetButtonName: '검토 필터 초기화',
  });
  await page.locator('#leadsList .filter-empty-state button').click();
  assert.equal(await page.locator('#leadsList .lead-card').count(), 2);

  await page.getByRole('tab', { name: '칸반 보드' }).click();
  assert.equal(await page.getByRole('tab', { name: '칸반 보드' }).getAttribute('aria-selected'), 'true');
  assert.equal(await page.locator('#kanbanView .kanban-card').count(), 2);
  assert.equal(await page.locator('#kanbanView .k-gate.gate-ready').count(), 1);
  assert.equal(await page.locator('#kanbanView .k-gate.gate-review').count(), 1);
  await assertRenderedText(page, ['Local Factory Automation', '목록 게이트 통과', '목록 게이트 보강 필요', 'Action: Prepare reviewed follow-up', 'Action: Enrich before review']);

  await page.locator('[data-filter-key="confidence"]').selectOption('LOW');
  assert.equal(await page.locator('#kanbanView .kanban-card').count(), 0);
  await assertRenderedText(page, ['필터 결과가 없습니다']);
  assert.equal(await page.locator('#kanbanView .filter-empty-state').count(), 1);
  assert.deepEqual(await captureZeroResultResetSnapshot(page, '#kanbanView'), {
    role: 'status',
    live: 'polite',
    atomic: 'true',
    resetButtonName: '검토 필터 초기화',
  });
  await page.locator('#kanbanView .filter-empty-state button').click();
  assert.equal(await page.locator('#kanbanView .kanban-card').count(), 2);

  await page.getByRole('tab', { name: '리스트' }).click();
  assert.equal(await page.getByRole('tab', { name: '리스트' }).getAttribute('aria-selected'), 'true');
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
      && String(card.textContent || '').includes('사람 검토: 승인')
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
    '생성된 검토 메모 제안',
    '검토 메모 제안 요약',
    '생성된 제안은 복사 전용이며 자동 저장/전송되지 않습니다',
    '사람이 저장한 메모가 아닙니다',
    '복사 후 사람이 직접 검토해 사용하세요',
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
  assert.deepEqual(await captureDetailWorkbenchSemanticSnapshot(page), {
    workbench: { label: 'Opportunity Workbench', tabIndex: -1 },
    productivity: { label: 'Workbench Productivity Toolkit' },
    shortcutHelp: { role: 'region', label: '단축키 도움말', hidden: true },
    liveStatus: { role: 'status', live: 'polite', atomic: 'true' },
    copyControls: ['현재 Workbench 리뷰 노트 복사', '승인 노트 복사', '검토 필요 노트 복사', '리스크 확인 노트 복사'],
    reviewControls: ['영업 상태 변경', '사람 검토 상태 변경'],
  });
  assert.equal(await page.evaluate(() => {
    const root = document.querySelector('#opportunity-workbench .opportunity-workbench-review-note');
    const summary = root?.querySelector('.opportunity-workbench-note-summary');
    const payload = root?.querySelector('[data-workbench-note-text]');
    return !!summary && !!payload && !!(summary.compareDocumentPosition(payload) & Node.DOCUMENT_POSITION_FOLLOWING);
  }), true);
  assert.equal(await page.evaluate(() => (
    document.querySelectorAll('#opportunity-workbench .opportunity-workbench-note-variant[open]').length
  )), 0);
  await page.setViewportSize({ width: 390, height: 844 });
  await assertRenderedText(page, ['Workbench Productivity Toolkit', 'OPPORTUNITY WORKBENCH', '사람 검토']);
  await assertNoHorizontalOverflow(page, [
    'main.container',
    '#opportunity-workbench',
    '#detailProductivityToolkit',
    '.opportunity-workbench-review-note',
    '.opportunity-workbench-note-summary',
    '.opportunity-workbench-note-copy-head',
    '.field-group',
  ]);
  await page.setViewportSize({ width: 1280, height: 720 });

  await page.evaluate(() => {
    window.__copiedReviewNotes = [];
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.__copiedReviewNotes.push(String(text));
        },
      },
    });
  });
  const visibleDetailNote = await page.locator('#opportunity-workbench [data-workbench-note-text]').first().innerText();
  await page.getByRole('button', { name: '현재 Workbench 리뷰 노트 복사' }).click();
  await page.waitForFunction(() => {
    const status = document.querySelector('#detailProductivityStatus');
    return !!status && String(status.textContent || '').includes('노트를 복사했습니다');
  });
  assert.deepEqual(await page.evaluate(() => window.__copiedReviewNotes), [visibleDetailNote]);
  assert.doesNotMatch((await page.evaluate(() => window.__copiedReviewNotes[0])) || '', /검토 메모 제안 요약|생성된 제안은 복사 전용/);
  await assertRenderedText(page, ['Workbench Productivity Toolkit', '노트 복사 1건', '수동 복사 0건']);

  await page.locator('#opportunity-workbench').focus();
  await page.keyboard.press('Shift+/');
  await assertRenderedText(page, ['단축키 도움말', 'w', 'n', 'j', 'c', 'Shortcut keys do not change reviewStatus']);
  await page.keyboard.press('w');
  await page.waitForFunction(() => document.activeElement && document.activeElement.id === 'opportunity-workbench');
  await assertRenderedText(page, ['포커스 이동 1건']);

  await page.keyboard.press('j');
  await page.waitForFunction(() => {
    const active = document.activeElement;
    return !!active && active.classList.contains('detail-section') && active.id !== 'opportunity-workbench';
  });
  await assertRenderedText(page, ['포커스 이동 2건']);

  await page.keyboard.press('c');
  await page.waitForFunction(() => {
    const status = document.querySelector('#detailProductivityStatus');
    return !!status && String(status.textContent || '').includes('노트를 복사했습니다');
  });
  assert.equal(await page.evaluate(() => window.__copiedReviewNotes.length), 2);
  await assertRenderedText(page, ['노트 복사 2건']);
  await page.getByRole('button', { name: '현재 Workbench 리뷰 노트 복사' }).focus();
  await page.keyboard.press('c');
  await page.keyboard.press('j');
  assert.equal(await page.evaluate(() => window.__copiedReviewNotes.length), 2);
  await assertRenderedText(page, ['포커스 이동 2건', '노트 복사 2건']);

  await page.locator('#notesArea').focus();
  await page.keyboard.press('j');
  await page.keyboard.press('c');
  assert.equal(await page.evaluate(() => window.__copiedReviewNotes.length), 2);
  await assertRenderedText(page, ['포커스 이동 2건', '노트 복사 2건']);

  const detailShortcutLeadsResponse = await localFetch('/api/leads?profile=danfoss');
  const detailShortcutLeadsPayload = await readJson(detailShortcutLeadsResponse);
  assert.equal(detailShortcutLeadsPayload.leads.find((lead) => lead.id === 'local-lead-approved').reviewStatus, 'APPROVED');

  await page.setExtraHTTPHeaders(authHeaders());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#detailContent .detail-section');
  await assertRenderedText(page, ['노트 복사 0건', '수동 복사 0건', '포커스 이동 0건']);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
  });
  await page.getByRole('button', { name: '현재 Workbench 리뷰 노트 복사' }).click();
  await page.waitForFunction(() => {
    const status = document.querySelector('#detailProductivityStatus');
    return !!status && String(status.textContent || '').includes('직접 복사');
  });
  await assertRenderedText(page, ['수동 복사 1건', '노트 복사 0건']);

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

async function assertNoHorizontalOverflow(page, selectors) {
  const overflowing = await page.evaluate((items) => {
    return items.flatMap((selector) => {
      return [...document.querySelectorAll(selector)].map((element, index) => {
        const overflow = element.scrollWidth - element.clientWidth;
        return overflow > 1
          ? { selector, index, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth, overflow }
          : null;
      }).filter(Boolean);
    });
  }, selectors);
  assert.deepEqual(overflowing, []);
}

async function captureListReviewerSemanticSnapshot(page) {
  return page.evaluate(() => {
    const attr = (element, name) => element?.getAttribute(name) || '';
    const text = (element) => String(element?.textContent || '').replace(/\s+/g, ' ').trim();
    const isHidden = (element) => !element || element.hidden || window.getComputedStyle(element).display === 'none';
    const names = (selector) => [...document.querySelectorAll(selector)]
      .map((element) => attr(element, 'aria-label') || text(element))
      .filter(Boolean);
    const semanticRegion = (selector) => {
      const element = document.querySelector(selector);
      return {
        label: attr(element, 'aria-label'),
        ...(element?.hasAttribute('tabindex') ? { focusable: element.tabIndex >= -1 } : {}),
      };
    };
    const tablist = document.querySelector('[role="tablist"][aria-label="리드 보기 전환"]');
    const tabs = [...document.querySelectorAll('[role="tab"]')].map((tab) => ({
      id: tab.id,
      name: text(tab),
      controls: attr(tab, 'aria-controls'),
      selected: attr(tab, 'aria-selected'),
      tabIndex: tab.tabIndex,
    }));

    return {
      tablist: {
        label: attr(tablist, 'aria-label'),
        orientation: attr(tablist, 'aria-orientation'),
        tabs,
        panels: ['leadsList', 'kanbanView'].map((id) => {
          const panel = document.getElementById(id);
          return {
            id,
            role: attr(panel, 'role'),
            labelledBy: attr(panel, 'aria-labelledby'),
            hidden: isHidden(panel),
          };
        }),
      },
      regions: {
        nextReviewStrip: semanticRegion('#nextReviewStrip'),
        managerReviewerSummary: semanticRegion('#managerReviewerSummary'),
        reviewerActionQueue: semanticRegion('#reviewerActionQueue'),
        leadReviewSession: semanticRegion('.review-session-panel'),
        productivity: semanticRegion('#reviewProductivityToolkit'),
        shortcutHelp: {
          role: attr(document.getElementById('reviewShortcutHelp'), 'role'),
          label: attr(document.getElementById('reviewShortcutHelp'), 'aria-label'),
          hidden: isHidden(document.getElementById('reviewShortcutHelp')),
        },
        liveStatus: {
          role: attr(document.getElementById('reviewSessionStatus'), 'role'),
          live: attr(document.getElementById('reviewSessionStatus'), 'aria-live'),
          atomic: attr(document.getElementById('reviewSessionStatus'), 'aria-atomic'),
        },
      },
      copyControls: names('[data-note-copy-action]'),
    };
  });
}

async function captureZeroResultResetSnapshot(page, scopeSelector) {
  return page.evaluate((selector) => {
    const root = document.querySelector(selector);
    const emptyState = root?.querySelector('.filter-empty-state');
    const reset = emptyState?.querySelector('button');
    return {
      role: emptyState?.getAttribute('role') || '',
      live: emptyState?.getAttribute('aria-live') || '',
      atomic: emptyState?.getAttribute('aria-atomic') || '',
      resetButtonName: reset?.getAttribute('aria-label') || String(reset?.textContent || '').replace(/\s+/g, ' ').trim(),
    };
  }, scopeSelector);
}

async function captureDetailWorkbenchSemanticSnapshot(page) {
  return page.evaluate(() => {
    const attr = (element, name) => element?.getAttribute(name) || '';
    const text = (element) => String(element?.textContent || '').replace(/\s+/g, ' ').trim();
    const isHidden = (element) => !element || element.hidden || window.getComputedStyle(element).display === 'none';
    const names = (selector) => [...document.querySelectorAll(selector)]
      .map((element) => attr(element, 'aria-label') || text(element))
      .filter(Boolean);
    const workbench = document.getElementById('opportunity-workbench');
    const productivity = document.getElementById('detailProductivityToolkit');
    const shortcutHelp = document.getElementById('detailShortcutHelp');
    const liveStatus = document.getElementById('detailProductivityStatus');

    return {
      workbench: {
        label: attr(workbench, 'aria-label'),
        tabIndex: workbench?.tabIndex ?? null,
      },
      productivity: {
        label: attr(productivity, 'aria-label'),
      },
      shortcutHelp: {
        role: attr(shortcutHelp, 'role'),
        label: attr(shortcutHelp, 'aria-label'),
        hidden: isHidden(shortcutHelp),
      },
      liveStatus: {
        role: attr(liveStatus, 'role'),
        live: attr(liveStatus, 'aria-live'),
        atomic: attr(liveStatus, 'aria-atomic'),
      },
      copyControls: names('[data-workbench-note-copy-action]'),
      reviewControls: names('.review-select-lg, .status-select-lg'),
    };
  });
}
