import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { LOCAL_E2E_TOKEN, createLocalE2EHarness, createLocalSmokeEnv, installLocalOnlyFetchGuard } from '../tests/helpers/local-e2e-harness.mjs';

const headers = { Authorization: `Bearer ${LOCAL_E2E_TOKEN}`, 'Content-Type': 'application/json' };

async function setup(t, overrides = {}) {
  const guard = installLocalOnlyFetchGuard();
  const harness = await createLocalE2EHarness({ env: createLocalSmokeEnv(overrides) });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ serviceWorkers: 'block', extraHTTPHeaders: headers });
  await context.addInitScript(token => sessionStorage.setItem('b2b_token', token), LOCAL_E2E_TOKEN);
  await context.route('**/*', route => { assert.equal(new URL(route.request().url()).origin, harness.origin); return route.continue(); });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  t.after(async () => { await browser.close(); await harness.close(); guard.restore(); assert.deepEqual(guard.blockedUrls, []); assert.deepEqual(errors, []); });
  return { page, context, harness };
}

async function openNotes(page, harness, surface) {
  await page.goto(harness.origin + (surface === 'detail' ? '/leads/local-lead-review' : '/leads?profile=danfoss'));
  if (surface === 'list') {
    const card = page.locator('.lead-card[data-lead-id="local-lead-review"]');
    await card.locator('.notes-section summary').click();
    return card.getByRole('textbox', { name: '수동 리뷰 메모 입력' });
  }
  return page.getByRole('textbox', { name: '수동 리뷰 메모 입력' });
}

for (const surface of ['detail', 'list']) for (const failure of ['server', 'network', 'conflict']) {
  test(`${surface} retains manual draft after ${failure} and saves only on deliberate retry`, async t => {
    const { page, harness } = await setup(t);
    const note = await openNotes(page, harness, surface);
    let attempts = 0;
    await page.route('**/api/leads/local-lead-review', async route => {
      if (route.request().method() !== 'PATCH') return route.continue();
      attempts++;
      if (attempts > 1) return route.continue();
      if (failure === 'network') return route.abort('failed');
      if (failure === 'conflict') {
        const data = await fetch(`${harness.origin}/api/leads?profile=danfoss`, { headers }).then(res => res.json());
        const current = data.leads.find(item => item.id === 'local-lead-review');
        const accepted = await fetch(`${harness.origin}/api/leads/${current.id}`, { method: 'PATCH', headers, body: JSON.stringify({ expectedVersion: current.version, reviewStatus: 'DEFERRED' }) }).then(res => res.json());
        assert.equal(accepted.success, true);
        return route.continue();
      }
      return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'synthetic unavailable' }) });
    });
    await note.fill('실패 후에도 남아야 할 수동 합성 초안');
    await page.waitForFunction(() => [...document.querySelectorAll('[data-manual-note-notice]')].some(el => /실패|충돌/.test(el.textContent)), null, { timeout: 5000 });
    assert.equal(await note.inputValue(), '실패 후에도 남아야 할 수동 합성 초안');
    const notice = surface === 'detail' ? page.locator('[data-manual-note-notice]') : page.locator('.lead-card[data-lead-id="local-lead-review"] [data-manual-note-notice]');
    assert.match(await notice.textContent(), /다시/);
    assert.equal(await page.evaluate(() => !window.dispatchEvent(new Event('beforeunload', { cancelable: true }))), true);
    // A blur/queued debounce must not implicitly retry an unsuccessful mutation.
    await note.blur();
    await page.waitForTimeout(1000);
    assert.equal(attempts, 1);
    const saved = page.waitForResponse(response => response.request().method() === 'PATCH');
    const retry = surface === 'detail' ? page.getByRole('button', { name: '수동 리뷰 메모 저장', exact: true }) : page.locator('.lead-card[data-lead-id="local-lead-review"]').getByRole('button', { name: '수동 리뷰 메모 저장', exact: true });
    await retry.click();
    assert.equal((await (await saved).json()).success, true);
    await page.waitForFunction(() => [...document.querySelectorAll('[data-manual-note-notice]')].some(el => el.textContent === '저장됨'));
    assert.equal(await note.inputValue(), '실패 후에도 남아야 할 수동 합성 초안');
    assert.equal(await page.evaluate(() => !window.dispatchEvent(new Event('beforeunload', { cancelable: true }))), false);
  });
}

test('detail preserves a pending note and feedback during status refresh', async t => {
  const { page, harness } = await setup(t);
  const note = await openNotes(page, harness, 'detail');
  await note.fill('아직 전송하지 않은 메모');
  await page.getByRole('textbox', { name: '피드백', exact: true }).fill('아직 전송하지 않은 피드백');
  const previous = await note.elementHandle();
  await page.getByRole('combobox', { name: '사람 검토 상태 변경' }).selectOption('APPROVED');
  await page.waitForFunction(field => !field.isConnected, previous);
  assert.equal(await note.inputValue(), '아직 전송하지 않은 메모');
  assert.equal(await page.getByRole('textbox', { name: '피드백', exact: true }).inputValue(), '아직 전송하지 않은 피드백');
});


for (const surface of ['detail', 'list']) for (const operation of ['save', 'clear']) {
  test(`${surface} ${operation} response keeps a newer reversed draft unsaved`, async t => {
    const { page, harness } = await setup(t);
    const leadList = await fetch(`${harness.origin}/api/leads?profile=danfoss`, { headers }).then(res => res.json());
    const lead = leadList.leads.find(item => item.id === 'local-lead-review');
    const seeded = await fetch(`${harness.origin}/api/leads/${lead.id}`, { method: 'PATCH', headers,
      body: JSON.stringify({ expectedVersion: lead.version, manualReviewNotes: '이미 저장된 합성 메모' }) }).then(res => res.json());
    assert.equal(seeded.success, true);
    const note = await openNotes(page, harness, surface);
    let release;
    const paused = new Promise(resolve => { release = resolve; });
    await page.route('**/api/leads/local-lead-review', async route => {
      if (route.request().method() === 'PATCH') await paused;
      await route.continue();
    });
    try {
      const sent = page.waitForRequest(request => request.method() === 'PATCH');
      const done = page.waitForResponse(response => response.request().method() === 'PATCH');
      if (operation === 'clear') {
        page.once('dialog', dialog => dialog.accept());
        const clearButton = surface === 'detail' ? page.getByRole('button', { name: '저장된 수동 리뷰 메모 지우기' }) : page.locator('.lead-card[data-lead-id="local-lead-review"]').getByRole('button', { name: '저장된 수동 리뷰 메모 지우기' });
        await clearButton.click();
        assert.equal(await note.inputValue(), '', 'confirmed clear updates the draft immediately');
      } else {
        await note.fill('전송할 합성 메모');
        // Both surfaces offer the same deliberate save control in addition to debounce.
        const saveButton = surface === 'detail' ? page.getByRole('button', { name: '수동 리뷰 메모 저장', exact: true }) : page.locator('.lead-card[data-lead-id="local-lead-review"]').getByRole('button', { name: '수동 리뷰 메모 저장', exact: true });
        await saveButton.click();
      }
      await sent;
      await note.fill('대기 중 변경');
      await note.fill('이미 저장된 합성 메모');
      release();
      assert.equal((await (await done).json()).success, true);
      const notice = surface === 'detail' ? page.locator('[data-manual-note-notice]') : page.locator('.lead-card[data-lead-id="local-lead-review"] [data-manual-note-notice]');
      await page.waitForFunction(() => [...document.querySelectorAll('[data-manual-note-notice]')].some(el => /저장 전/.test(el.textContent) && !/저장 중/.test(el.textContent)));
      assert.equal(await note.inputValue(), '이미 저장된 합성 메모');
      assert.match(await notice.textContent(), /저장 전/);
    } finally { release(); }
  });
}

test('detail discards protected drafts after denied or unrelated refresh responses', async t => {
  for (const scenario of ['denied-role', 'http-denied', 'unrelated-lead']) await t.test(scenario, async t => {
    const { page, harness } = await setup(t, { MANUAL_REVIEW_NOTES_LOCAL_TEST_ROLE_STUB: 'enabled' });
    await page.context().setExtraHTTPHeaders({ ...headers, 'X-Manual-Review-Notes-Local-Test-Role': 'reviewer' });
    const note = await openNotes(page, harness, 'detail');
    const savedNote = await note.inputValue();
    await note.fill('보호된 메모 초안');
    await page.getByRole('textbox', { name: '피드백', exact: true }).fill('보호된 피드백 초안');
    await page.route(`${harness.origin}/leads/local-lead-review`, async route => {
      if (scenario === 'http-denied') return route.fulfill({ status: 403, contentType: 'text/html', body: 'denied' });
      const replacement = await fetch(`${harness.origin}/leads/${scenario === 'unrelated-lead' ? 'local-lead-approved' : 'local-lead-review'}`, {
        headers: { ...headers, 'X-Manual-Review-Notes-Local-Test-Role': scenario === 'denied-role' ? 'manager' : 'reviewer' }
      });
      assert.equal(replacement.status, 200);
      return route.fulfill({ status: 200, contentType: 'text/html', body: await replacement.text() });
    });
    const previous = await note.elementHandle();
    await page.getByRole('combobox', { name: '사람 검토 상태 변경' }).selectOption('APPROVED');
    await page.waitForFunction(field => !field.isConnected, previous);
    assert.equal(await page.locator('[data-feedback-field], #notesArea').count(), 0);
    assert.doesNotMatch(await page.content(), /보호된 메모 초안|보호된 피드백 초안/);
    assert.equal((await page.content()).includes(savedNote), false, 'denied refresh must remove the old protected serialized snapshot');
    assert.equal(await page.evaluate(() => !window.dispatchEvent(new Event('beforeunload', { cancelable: true }))), false);
  });
});

test('detail navigation warns before discarding a feedback draft and never transfers it to another lead', async t => {
  const { page, harness } = await setup(t);
  await page.goto(`${harness.origin}/leads/local-lead-review`);
  await page.getByRole('textbox', { name: '피드백', exact: true }).fill('다른 리드에 표시하면 안 되는 초안');
  const warning = page.waitForEvent('dialog');
  const navigation = page.goto(`${harness.origin}/leads/local-lead-approved`).catch(() => null);
  const dialog = await warning;
  assert.equal(dialog.type(), 'beforeunload');
  await dialog.dismiss();
  await navigation;
  assert.equal(new URL(page.url()).pathname, '/leads/local-lead-review');
  assert.equal(await page.getByRole('textbox', { name: '피드백', exact: true }).inputValue(), '다른 리드에 표시하면 안 되는 초안');
  page.once('dialog', event => event.accept());
  await page.goto(`${harness.origin}/leads/local-lead-approved`);
  assert.notEqual(await page.getByRole('textbox', { name: '피드백', exact: true }).inputValue(), '다른 리드에 표시하면 안 되는 초안');
  assert.equal(await page.evaluate(() => !window.dispatchEvent(new Event('beforeunload', { cancelable: true }))), false);
});

test('a delayed detail refresh cannot restore protected fields after a newer denied refresh', async t => {
  const { page, harness } = await setup(t, { MANUAL_REVIEW_NOTES_LOCAL_TEST_ROLE_STUB: 'enabled' });
  const reviewerHeaders = { ...headers, 'X-Manual-Review-Notes-Local-Test-Role': 'reviewer' };
  await page.context().setExtraHTTPHeaders(reviewerHeaders);
  await page.goto(`${harness.origin}/leads/local-lead-review`);
  let release;
  let arrived;
  const firstArrived = new Promise(resolve => { arrived = resolve; });
  const held = new Promise(resolve => { release = resolve; });
  let reads = 0;
  await page.route(`${harness.origin}/leads/local-lead-review`, async route => {
    reads++;
    const first = reads === 1;
    if (first) { arrived(); await held; }
    const response = await fetch(`${harness.origin}/leads/local-lead-review`, {
      headers: first ? reviewerHeaders : { ...headers, 'X-Manual-Review-Notes-Local-Test-Role': 'manager' }
    });
    await route.fulfill({ status: response.status, contentType: 'text/html', body: await response.text() });
  });
  try {
    const first = page.evaluate(() => window.updateField('reviewStatus', 'APPROVED'));
    await firstArrived;
    await page.evaluate(() => window.updateField('reviewStatus', 'DEFERRED'));
    assert.equal(await page.locator('[data-feedback-field], #notesArea').count(), 0);
    release();
    await first;
    assert.equal(await page.locator('[data-feedback-field], #notesArea').count(), 0);
  } finally { release(); }
});

test('list ignores an older authorized fetch after a note write denies access', async t => {
  const { page, harness } = await setup(t);
  const note = await openNotes(page, harness, 'list');
  let release;
  let arrived;
  const requested = new Promise(resolve => { arrived = resolve; });
  const hold = new Promise(resolve => { release = resolve; });
  await page.route('**/api/leads?profile=danfoss', async route => {
    const response = await fetch(route.request().url(), { headers });
    const body = await response.text();
    arrived();
    await hold;
    await route.fulfill({ status: 200, contentType: 'application/json', body });
  });
  await page.route('**/api/leads/local-lead-review', route => route.request().method() === 'PATCH'
    ? route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'synthetic denial' }) }) : route.continue());
  try {
    const refresh = page.evaluate(() => loadLeads());
    await requested;
    await note.fill('권한 상실 시 버릴 합성 초안');
    await page.waitForFunction(() => document.querySelectorAll('.notes-textarea, [data-feedback-field]').length === 0);
    release();
    await refresh;
    assert.equal(await page.locator('.notes-textarea, [data-feedback-field]').count(), 0);
    assert.doesNotMatch(await page.content(), /권한 상실 시 버릴 합성 초안/);
    assert.equal(await page.evaluate(() => !window.dispatchEvent(new Event('beforeunload', { cancelable: true }))), false);
  } finally { release(); }
});
