import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { LOCAL_E2E_TOKEN, createLocalE2EHarness, createLocalSmokeEnv, installLocalOnlyFetchGuard } from '../tests/helpers/local-e2e-harness.mjs';

test('detail feedback preserves the latest human draft across explicit mutations', async (t) => {
  const guard = installLocalOnlyFetchGuard();
  const harness = await createLocalE2EHarness({ env: createLocalSmokeEnv() });
  const browser = await chromium.launch({ headless: true });
  t.after(async () => {
    await browser.close();
    await harness.close();
    guard.restore();
    assert.deepEqual(guard.blockedUrls, []);
  });
  const headers = { Authorization: `Bearer ${LOCAL_E2E_TOKEN}`, 'Content-Type': 'application/json' };

  for (const scenario of ['save-new-edit', 'save-reverted-edit', 'clear-reverted-edit']) {
    await t.test(scenario, { timeout: 15000 }, async () => {
      const context = await browser.newContext({ serviceWorkers: 'block', extraHTTPHeaders: headers });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await context.addInitScript(token => sessionStorage.setItem('b2b_token', token), LOCAL_E2E_TOKEN);
      await context.route('**/*', route => {
        assert.equal(new URL(route.request().url()).origin, harness.origin);
        return route.continue();
      });
      const list = await fetch(`${harness.origin}/api/leads?profile=danfoss`, { headers }).then(res => res.json());
      const lead = list.leads.find(item => item.id === 'local-lead-review');
      const seeded = await fetch(`${harness.origin}/api/leads/${lead.id}`, { method: 'PATCH', headers,
        body: JSON.stringify({ expectedVersion: lead.version, reviewerFeedback: { feedbackText: '저장된 합성 피드백' } }) }).then(res => res.json());
      assert.equal(seeded.success, true);
      await page.goto(`${harness.origin}/leads/${lead.id}`);
      const feedback = page.getByRole('textbox', { name: '피드백', exact: true });
      const original = await feedback.inputValue();
      let release;
      const paused = new Promise(resolve => { release = resolve; });
      try {
        await page.route(`**/api/leads/${lead.id}`, async route => {
          if (route.request().method() === 'PATCH') await paused;
          await route.continue();
        });
        const sent = page.waitForRequest(request => request.method() === 'PATCH', { timeout: 1500 });
        const completed = page.waitForResponse(response => response.request().method() === 'PATCH', { timeout: 5000 });
        // Attach a rejection handler immediately, including when the button is broken.
        completed.catch(() => {});
        if (scenario.startsWith('clear')) {
          page.once('dialog', dialog => dialog.accept());
          await page.getByRole('button', { name: '피드백 지우기', exact: true }).click();
        } else {
          await feedback.fill('전송할 합성 피드백');
          await page.getByRole('button', { name: '피드백 저장', exact: true }).click();
        }
        const request = await sent;
        assert.equal(request.postDataJSON().expectedVersion, seeded.lead.version);
        await feedback.fill('응답 대기 중 새로 쓴 문장');
        const latest = scenario.endsWith('reverted-edit') ? original : '응답 대기 중 새로 쓴 문장';
        if (scenario.endsWith('reverted-edit')) await feedback.fill(original);
        const previousField = await feedback.elementHandle();
        release();
        const result = await (await completed).json();
        assert.equal(result.success, true);
        await page.waitForFunction(field => !field.isConnected, previousField);
        assert.equal(await feedback.inputValue(), latest, 'an earlier response must not replace a newer draft');
        assert.match(await page.locator('[data-feedback-draft-state]').textContent(), /저장 전/);
        assert.deepEqual(errors, []);
        assert.equal(result.lead.reviewerFeedback.feedbackText, scenario.startsWith('clear') ? '' : '전송할 합성 피드백');
        // A second explicit save sends the retained draft using the accepted version.
        const nextRequest = page.waitForRequest(request => request.method() === 'PATCH');
        const nextResponse = page.waitForResponse(response => response.request().method() === 'PATCH');
        const newerField = await feedback.elementHandle();
        await page.getByRole('button', { name: '피드백 저장', exact: true }).click();
        const nextPayload = (await nextRequest).postDataJSON();
        assert.equal(nextPayload.expectedVersion, result.lead.version);
        assert.equal(nextPayload.reviewerFeedback.feedbackText, latest);
        assert.deepEqual(Object.keys(nextPayload).sort(), ['expectedVersion', 'reviewerFeedback']);
        assert.deepEqual(Object.keys(nextPayload.reviewerFeedback).sort(), [
          'actionUsefulness', 'dataGapPriority', 'evidenceConfidenceAdjustment',
          'feedbackText', 'nextReviewerAction', 'outcomeLabel'
        ]);
        assert.equal((await (await nextResponse).json()).success, true);
        await page.waitForFunction(field => !field.isConnected, newerField);
        assert.equal(await feedback.inputValue(), latest);
        assert.equal(await page.locator('[data-feedback-draft-state]').textContent(), '');
      } finally {
        release();
        await context.close();
      }
    });
  }
});

test('denied-role guidance stays absent while list and detail browser controls execute', async (t) => {
  const guard = installLocalOnlyFetchGuard();
  const harness = await createLocalE2EHarness({ env: createLocalSmokeEnv({ MANUAL_REVIEW_NOTES_LOCAL_TEST_ROLE_STUB: 'enabled' }) });
  const browser = await chromium.launch({ headless: true });
  t.after(async () => { await browser.close(); await harness.close(); guard.restore(); assert.deepEqual(guard.blockedUrls, []); });
  const context = await browser.newContext({ serviceWorkers: 'block', extraHTTPHeaders: {
    Authorization: `Bearer ${LOCAL_E2E_TOKEN}`, 'X-Manual-Review-Notes-Local-Test-Role': 'manager'
  } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.addInitScript(token => sessionStorage.setItem('b2b_token', token), LOCAL_E2E_TOKEN);
  await context.route('**/*', route => { assert.equal(new URL(route.request().url()).origin, harness.origin); return route.continue(); });
  await page.goto(`${harness.origin}/leads?profile=danfoss`);
  await page.locator('.lead-card[data-lead-id="local-lead-review"]').waitFor();
  await page.getByRole('combobox', { name: '검토 상태', exact: true }).selectOption('NEEDS_REVIEW');
  await page.getByRole('tab', { name: '칸반 보드' }).click();
  assert.equal(await page.locator('#kanbanView .kanban-card').count(), 1);
  await page.getByRole('tab', { name: '리스트' }).click();
  assert.equal(await page.locator('[data-review-note-text], [data-reviewer-feedback-form]').count(), 0);
  assert.doesNotMatch(await page.content(), /reviewNoteSuggestion|reviewNoteTemplates|Follow-up check:|생성된 검토 메모 제안/);
  await page.goto(`${harness.origin}/leads/local-lead-review`);
  await page.locator('[data-reviewer-feedback-protected]').waitFor();
  assert.equal(await page.locator('[data-workbench-note-copy-action], [data-reviewer-feedback-form]').count(), 0);
  assert.deepEqual(errors, []);
});
