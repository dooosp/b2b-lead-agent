import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import {
  LOCAL_E2E_TOKEN,
  createLocalE2EHarness,
  createLocalSmokeEnv,
  installLocalOnlyFetchGuard,
} from '../tests/helpers/local-e2e-harness.mjs';

test('reviewer UX regressions use local synthetic leads only', async (t) => {
  const guard = installLocalOnlyFetchGuard();
  const harness = await createLocalE2EHarness({ env: createLocalSmokeEnv() });
  let browser;
  t.after(async () => {
    try {
      if (browser) await browser.close();
      await harness.close();
      assert.deepEqual(guard.blockedUrls, [], 'Worker must not attempt external requests');
    } finally {
      guard.restore();
    }
  });
  browser = await chromium.launch({ headless: true });

  async function createPage({ authenticated = true } = {}) {
    const context = await browser.newContext();
    await context.route('**/*', (route) => {
      assert.equal(new URL(route.request().url()).origin, harness.origin);
      return route.continue();
    });
    if (authenticated) {
      await context.addInitScript((token) => sessionStorage.setItem('b2b_token', token), LOCAL_E2E_TOKEN);
    }
    t.after(() => context.close());
    return context.newPage();
  }

  for (const [label, path] of [['PPT 생성', '/ppt'], ['영업 연습', '/roleplay']]) {
    await t.test(`filtered lead identity survives navigation to ${path}`, async () => {
      const page = await createPage();
      await page.goto(`${harness.origin}/leads?profile=danfoss`);
      await page.locator('.lead-card[data-lead-id="local-lead-review"]').waitFor();
      await page.getByRole('combobox', { name: '검토 상태', exact: true }).selectOption('NEEDS_REVIEW');
      await page.locator('.lead-card[data-lead-id="local-lead-review"]').getByRole('link', { name: label, exact: true }).click();
      await page.waitForURL(`**${path}?**`);
      await page.waitForFunction(() => document.querySelector('#leadSelect option:checked')?.textContent.includes('Local'));
      assert.match(await page.locator('#leadSelect option:checked').textContent(), /Local Data Center Cooling/);

      await page.goto(`${harness.origin}${path}?profile=danfoss&leadId=missing-local-lead`);
      await page.waitForFunction(() => document.querySelectorAll('#leadSelect option').length > 1);
      assert.equal(await page.locator('#leadSelect').inputValue(), '', 'missing targets require explicit reselection');
      await page.goto(`${harness.origin}${path}?profile=danfoss&lead=0`);
      await page.waitForFunction(() => document.querySelectorAll('#leadSelect option').length > 1);
      assert.equal(await page.locator('#leadSelect').inputValue(), '', 'ambiguous legacy indexes must not select another company');
    });
  }

  await t.test('a fresh reviewer can open existing leads without generating a report', async () => {
    const page = await createPage({ authenticated: false });
    const mutations = [];
    page.on('request', (request) => { if (request.method() !== 'GET') mutations.push(request.url()); });
    await page.goto(harness.origin);
    await page.getByRole('tab', { name: '관리 프로필' }).click();
    await page.getByRole('textbox', { name: '비밀번호 입력', exact: true }).fill(LOCAL_E2E_TOKEN);
    const response = page.waitForResponse((res) => res.url().includes('/api/leads?'));
    await page.getByRole('link', { name: /리드 (상세 보기|리뷰 큐)/ }).click();
    assert.equal((await response).status(), 200);
    await page.locator('.lead-card[data-lead-id="local-lead-review"]').waitFor();
    assert.deepEqual(mutations, []);
  });

  await t.test('unauthenticated lead lists show an actionable sign-in state instead of empty data', async () => {
    const page = await createPage({ authenticated: false });
    const response = page.waitForResponse((res) => res.url().includes('/api/leads?'));
    await page.goto(`${harness.origin}/leads?profile=danfoss`);
    assert.equal((await response).status(), 401);
    await page.waitForFunction(() => !document.querySelector('#leadsList').textContent.includes('로딩 중'));
    assert.match(await page.locator('#leadsList').textContent(), /인증/);
    assert.doesNotMatch(await page.locator('#leadsList').textContent(), /아직 생성된 리드가 없습니다/);
    await page.getByRole('link', { name: '인증하고 다시 보기' }).click();
    await page.getByRole('textbox', { name: '비밀번호 입력', exact: true }).fill(LOCAL_E2E_TOKEN);
    await page.getByRole('button', { name: '인증하고 돌아가기' }).click();
    await page.locator('.lead-card[data-lead-id="local-lead-review"]').waitFor();
  });

  await t.test('detail reload restores an existing browser token without weakening server auth', async () => {
    const page = await createPage();
    await page.goto(`${harness.origin}/leads?profile=danfoss`);
    await page.getByRole('link', { name: 'Local Factory Automation', exact: true }).click();
    await page.waitForURL('**/leads/local-lead-approved?**');
    await page.reload();
    await page.waitForFunction(() => document.body.textContent.includes('Local Factory Automation'), null, { timeout: 1500 });
    assert.match(await page.locator('body').textContent(), /Local Factory Automation/);

    const anonymous = await createPage({ authenticated: false });
    const response = await anonymous.goto(`${harness.origin}/leads/local-lead-approved`);
    assert.equal(response.status(), 401);
    assert.doesNotMatch(await anonymous.locator('body').textContent(), /Local Factory Automation|Seeded local smoke note/);
    await anonymous.getByRole('link', { name: '인증하고 다시 보기' }).click();
    await anonymous.getByRole('textbox', { name: '비밀번호 입력', exact: true }).fill(LOCAL_E2E_TOKEN);
    await anonymous.getByRole('button', { name: '인증하고 돌아가기' }).click();
    await anonymous.waitForFunction(() => document.body.textContent.includes('Local Factory Automation'));
    assert.match(await anonymous.locator('body').textContent(), /Local Factory Automation/);
  });

  await t.test('unsaved feedback survives filter changes and saves only on explicit submission', async () => {
    const page = await createPage();
    await page.goto(`${harness.origin}/leads?profile=danfoss`);
    const card = page.locator('.lead-card[data-lead-id="local-lead-approved"]');
    await card.locator('.reviewer-feedback-section summary').click();
    await card.getByRole('textbox', { name: '피드백', exact: true }).fill('사용성 점검: 예산과 일정 확인');
    await page.getByRole('combobox', { name: '검토 상태', exact: true }).selectOption('NEEDS_REVIEW');
    await page.getByRole('combobox', { name: '검토 상태', exact: true }).selectOption('all');
    await card.locator('.reviewer-feedback-section summary').click();
    assert.equal(await card.getByRole('textbox', { name: '피드백', exact: true }).inputValue(), '사용성 점검: 예산과 일정 확인');
    assert.match(await card.locator('.reviewer-feedback-section').textContent(), /저장 전/);
    const beforeSave = await fetch(`${harness.origin}/api/leads?profile=danfoss`, { headers: authHeaders() }).then((res) => res.json());
    assert.doesNotMatch(JSON.stringify(beforeSave), /사용성 점검: 예산과 일정 확인/);
    await card.getByRole('button', { name: '피드백 저장', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[data-lead-id="local-lead-approved"] .reviewer-feedback-section')?.textContent.includes('저장됨'));
    await page.reload();
    await card.locator('.reviewer-feedback-section summary').click();
    assert.equal(await card.getByRole('textbox', { name: '피드백', exact: true }).inputValue(), '사용성 점검: 예산과 일정 확인');
  });

  await t.test('a delayed feedback save does not erase edits typed while it is pending', async () => {
    const page = await createPage();
    await page.goto(`${harness.origin}/leads?profile=danfoss`);
    const card = page.locator('.lead-card[data-lead-id="local-lead-approved"]');
    await card.locator('.reviewer-feedback-section summary').click();
    await card.getByRole('textbox', { name: '피드백', exact: true }).fill('첫 번째 저장');
    let release;
    let started;
    const paused = new Promise((resolve) => { release = resolve; });
    const requested = new Promise((resolve) => { started = resolve; });
    await page.route('**/api/leads/local-lead-approved', async (route) => {
      if (route.request().method() === 'PATCH') { started(); await paused; }
      await route.continue();
    });
    await card.getByRole('button', { name: '피드백 저장', exact: true }).click();
    await requested;
    await card.getByRole('textbox', { name: '피드백', exact: true }).fill('저장 응답을 기다리며 추가한 문장');
    const saved = page.waitForResponse((res) => res.request().method() === 'PATCH');
    release();
    await saved;
    await card.locator('.reviewer-feedback-section details:not([open])').waitFor();
    await card.locator('.reviewer-feedback-section summary').click();
    assert.equal(await card.getByRole('textbox', { name: '피드백', exact: true }).inputValue(), '저장 응답을 기다리며 추가한 문장');
    assert.match(await card.locator('[data-feedback-draft-state]').textContent(), /저장 전/);
  });

  await t.test('next review prioritizes pending work and reports completion for an approved queue', async () => {
    const page = await createPage();
    await page.goto(`${harness.origin}/leads?profile=danfoss`);
    await page.locator('.lead-card[data-lead-id="local-lead-review"]').waitFor();
    assert.match(await page.locator('#nextReviewStrip').textContent(), /Local Data Center Cooling/);
    assert.doesNotMatch(await page.locator('#nextReviewStrip').textContent(), /Local Factory Automation/);
    await page.getByRole('combobox', { name: '검토 상태', exact: true }).selectOption('APPROVED');
    assert.match(await page.locator('#nextReviewStrip').textContent(), /검토가 완료/);
    assert.equal(await page.locator('#nextReviewStrip [data-session-action="focus-next"]').count(), 0);
  });

  await t.test('returning from tools and detail restores filters and the selected view', async () => {
    const page = await createPage();
    await page.goto(`${harness.origin}/leads?profile=danfoss`);
    const card = page.locator('.lead-card[data-lead-id="local-lead-review"]');
    await card.waitFor();
    await page.getByRole('combobox', { name: '검토 상태', exact: true }).selectOption('NEEDS_REVIEW');
    await card.getByRole('link', { name: 'PPT 생성', exact: true }).click();
    await page.getByRole('link', { name: '리드 목록' }).click();
    await card.waitFor();
    assert.equal(await page.getByRole('combobox', { name: '검토 상태', exact: true }).inputValue(), 'NEEDS_REVIEW');
    assert.equal(await page.locator('#leadsList .lead-card').count(), 1);
    await page.getByRole('tab', { name: '칸반 보드' }).click();
    await page.locator('#kanbanView .kanban-card').filter({ hasText: 'Local Data Center Cooling' }).click();
    await page.getByRole('link', { name: '리드 목록' }).click();
    await page.locator('#kanbanView .kanban-card').waitFor();
    assert.equal(await page.getByRole('combobox', { name: '검토 상태', exact: true }).inputValue(), 'NEEDS_REVIEW');
    assert.equal(await page.getByRole('tab', { name: '칸반 보드' }).getAttribute('aria-selected'), 'true');
    assert.equal(await page.locator('#kanbanView .kanban-card').count(), 1);
    await page.reload();
    await page.locator('#kanbanView .kanban-card').waitFor();
    assert.equal(await page.getByRole('combobox', { name: '검토 상태', exact: true }).inputValue(), 'NEEDS_REVIEW');
  });
});

function authHeaders() {
  return { Authorization: `Bearer ${LOCAL_E2E_TOKEN}` };
}
