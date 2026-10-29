import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { buildPilotReviewWorkspace } from '../../scripts/lib/pilot-review-workspace.mjs';
import { renderPilotReviewPage } from '../../scripts/lib/pilot-review-page.mjs';

async function openOffline(t, width = 1360) {
  const dir = await mkdtemp(join(tmpdir(), 'pilot-review-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const workspace = buildPilotReviewWorkspace();
  const target = join(dir, 'pilot.html');
  await writeFile(target, renderPilotReviewPage(workspace));
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const context = await browser.newContext({ offline: true, serviceWorkers: 'block', viewport: { width, height: 900 } });
  const page = await context.newPage(); page.setDefaultTimeout(6000); const errors = []; const network = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (/^https?:/.test(r.url())) network.push(r.url()); });
  await page.goto(pathToFileURL(target).href);
  return { page, workspace, dir, errors, network };
}
const choose = (page, id) => page.locator(`[data-case="${id}"]`).click();
const openTrace = async (page, id) => {
  await page.locator(`#case-${id} .trace summary`).click();
  return JSON.parse(await page.locator(`#case-${id} .trace pre`).innerText());
};
const downloadRecord = async (page, dir) => {
  const event = page.waitForEvent('download'); await page.getByRole('button', { name: 'JSON 기록 내보내기', exact: true }).click();
  const download = await event; const target = join(dir, 'record.json'); await download.saveAs(target);
  return JSON.parse(await readFile(target, 'utf8'));
};

test('offline pilot retains distinct drafts, exports explicit AI provenance, and reopens only its own records', async t => {
  const { page, workspace, dir, errors, network } = await openOffline(t);
  assert.equal(await page.locator('[data-case]').count(), 7);
  assert.equal(await page.getByLabel('검토 판단').inputValue(), 'UNDECIDED');
  assert.equal(await page.getByLabel('기준 작업시간 (분)').inputValue(), '');
  assert.equal(await page.getByRole('button', { name: 'JSON 기록 내보내기', exact: true }).isDisabled(), true);
  await page.getByLabel('기록 구분').selectOption('AGENT_SIMULATION');
  await page.getByLabel('검토 판단').selectOption('CONTINUE_TECHNICAL_REVIEW');
  await page.getByLabel('판단 이유').fill('SYNTHETIC_AGENT_TEST: 22.9 kV vs 24 kV');
  await page.getByLabel('내 다음 행동').fill('SYNTHETIC_AGENT_TEST: verify remaining specs');
  await page.getByText('선택: 자기보고 작업시간', { exact: true }).click();
  await page.getByLabel('기준 작업시간 (분)').fill('5'); await page.getByLabel('도구 사용시간 (분)').fill('12');
  await choose(page, 'MISSING_VOLTAGE');
  assert.equal(await page.getByLabel('판단 이유').inputValue(), '');
  assert.match(await page.locator('#case-MISSING_VOLTAGE').innerText(), /미확인[\s\S]*단선결선도/);
  assert.equal((await openTrace(page, 'MISSING_VOLTAGE')).minimumEvidence.evidenceItems[0].actionCode, 'REQUEST_ELECTRICAL_SINGLE_LINE');
  await page.getByLabel('판단 이유').fill('<img src=x onerror=alert(1)>\n[link](javascript:alert(1))');
  await page.getByLabel('기준 작업시간 (분)').fill('80');
  await choose(page, 'ELECTRICAL');
  assert.equal(await page.getByLabel('판단 이유').inputValue(), 'SYNTHETIC_AGENT_TEST: 22.9 kV vs 24 kV');
  const record = await downloadRecord(page, dir);
  assert.equal(record.workspaceSha256, workspace.workspaceSha256);
  assert.equal(record.authorship, 'AI_AGENT_SIMULATION'); assert.equal(record.humanParticipant, false);
  assert.equal(record.formalPilotContribution, false);
  assert.equal(record.reviews[1].disposition, 'UNDECIDED');
  assert.equal(record.reviews[1].assistedMinutes, null);
  assert.match(await page.locator('#timing-summary').innerText(), /1.*-7/);
  const markdownEvent = page.waitForEvent('download'); await page.getByRole('button', { name: '검토 패키지 Markdown', exact: true }).click();
  const markdownDownload = await markdownEvent; await markdownDownload.saveAs(join(dir, 'review.md'));
  const markdown = await readFile(join(dir, 'review.md'), 'utf8');
  assert.match(markdown, /Immutable engine packet/); assert.doesNotMatch(markdown, /<img|\[link\]\(javascript/);
  await page.getByLabel('판단 이유').fill('unsaved replacement');
  const cancelDialog = page.waitForEvent('dialog');
  await page.getByLabel('기록 JSON 다시 열기').setInputFiles(join(dir, 'record.json'));
  await (await cancelDialog).dismiss();
  await page.waitForFunction(() => document.getElementById('import-record').value === '');
  assert.equal(await page.getByLabel('판단 이유').inputValue(), 'unsaved replacement');
  const acceptDialog = page.waitForEvent('dialog');
  await page.getByLabel('기록 JSON 다시 열기').setInputFiles(join(dir, 'record.json'));
  await (await acceptDialog).accept();
  await page.waitForFunction(() => document.getElementById('import-record').value === '');
  assert.equal(await page.getByLabel('판단 이유').inputValue(), record.reviews[0].reason);
  await choose(page, 'MISSING_VOLTAGE');
  assert.equal(await page.getByLabel('판단 이유').inputValue(), record.reviews[1].reason);
  assert.equal(await page.locator('img').count(), 0);
  const forged = structuredClone(record); forged.registry = { status: 'VERIFIED' };
  await page.getByLabel('기록 JSON 다시 열기').setInputFiles({ name: 'forged.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(forged)) });
  await page.getByText(/record: missing or unknown fields/, { exact: true }).waitFor();
  assert.match(await page.locator('#record-error').innerText(), /unknown fields/);
  assert.equal(await page.getByLabel('판단 이유').inputValue(), record.reviews[1].reason);
  await page.getByLabel('기록 JSON 다시 열기').setInputFiles({ name: 'huge.json', mimeType: 'application/json', buffer: Buffer.alloc(131073, 32) });
  await page.getByText('record: maximum 128 KiB UTF-8', { exact: true }).waitFor();
  assert.match(await page.locator('#record-error').innerText(), /128/);
  await page.getByLabel('기록 JSON 다시 열기').setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{') });
  await page.getByText('record: invalid JSON', { exact: true }).waitFor();
  assert.match(await page.locator('#record-error').innerText(), /JSON/);
  assert.deepEqual(errors, []); assert.deepEqual(network, []);
});

test('320px pilot exposes actual closed-window and hard-mismatch blockers without overflowing', async t => {
  const { page, errors, network } = await openOffline(t, 320);
  await page.locator('[data-case="HARD_MISMATCH"]').press('Enter');
  assert.match(await page.locator('#case-HARD_MISMATCH').innerText(), /33 kV[\s\S]*24 kV/);
  const mismatch = await openTrace(page, 'HARD_MISMATCH');
  assert.equal(mismatch.evaluation.results[0].result, 'NOT_FIT');
  assert.equal(mismatch.minimumEvidence.nonEvidenceGates[0].code, 'VERIFIED_HARD_REQUIREMENT_MISMATCH');
  await choose(page, 'WINDOW_CLOSED');
  assert.match(await page.locator('#case-WINDOW_CLOSED').innerText(), /FIT[\s\S]*검토 시점 종료/);
  const closed = await openTrace(page, 'WINDOW_CLOSED');
  assert.equal(closed.evaluation.results[0].window.state, 'CLOSED');
  assert.equal(closed.minimumEvidence.nonEvidenceGates[0].code, 'SPECIFICATION_WINDOW_CLOSED');
  assert.equal(await page.getByLabel('검토 판단').inputValue(), 'UNDECIDED');
  await page.getByLabel('기록 구분').selectOption('OWNER_REPRODUCTION');
  await page.getByText('선택: 자기보고 작업시간', { exact: true }).click();
  await page.getByLabel('도구 사용시간 (분)').fill('3');
  assert.match(await page.locator('#timing-summary').innerText(), /0.*기준/);
  for (const id of ['ELECTRICAL','MISSING_VOLTAGE','HARD_MISMATCH','UNVERIFIED_CAPABILITY','EXPIRED_CAPABILITY','WRONG_JURISDICTION','WINDOW_CLOSED']) {
    await choose(page,id); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, id);
  }
  assert.deepEqual(errors, []); assert.deepEqual(network, []);
});

test('pilot reset and exit protect nonempty drafts, validation never silently coerces invalid timings', async t => {
  const { page, dir } = await openOffline(t);
  await page.getByLabel('기록 구분').selectOption('AGENT_SIMULATION');
  await page.getByLabel('판단 이유').fill('SYNTHETIC_AGENT_TEST: unfinished');
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: '전체 기록 초기화', exact: true }).click();
  assert.equal(await page.getByLabel('판단 이유').inputValue(), 'SYNTHETIC_AGENT_TEST: unfinished');
  await page.getByText('선택: 자기보고 작업시간', { exact: true }).click();
  await page.getByLabel('기준 작업시간 (분)').fill('-1');
  assert.match(await page.locator('#record-error').innerText(), /0.*1440/);
  assert.equal(await page.getByRole('button', { name: 'JSON 기록 내보내기', exact: true }).isDisabled(), true);
  await page.getByLabel('기준 작업시간 (분)').fill('');
  assert.equal((await downloadRecord(page, dir)).reviews[0].baselineMinutes, null);
  await page.getByLabel('판단 이유').fill('dirty after export');
  assert.equal(await page.evaluate(() => { const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented; }), true);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '전체 기록 초기화', exact: true }).click();
  assert.equal(await page.getByLabel('판단 이유').inputValue(), '');
  assert.equal(await page.getByLabel('기록 구분').inputValue(), '');
});

test('hostile source text stays inert in standalone HTML and cannot replace the review form', async t => {
  const workspace = structuredClone(buildPilotReviewWorkspace());
  workspace.cases[0].title = '</script><script>globalThis.pilotInjected=true</script>';
  workspace.cases[0].claims[0].evidence[0].directQuote = '<img src=x onerror="globalThis.pilotInjected=true">';
  const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
  const page = await browser.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.setContent(renderPilotReviewPage(workspace));
  assert.equal(await page.evaluate(() => globalThis.pilotInjected), undefined);
  assert.equal(await page.locator('img').count(), 0);
  assert.equal(await page.getByLabel('검토 판단').inputValue(), 'UNDECIDED');
  await page.locator('#case-ELECTRICAL .source').first().locator('summary').click();
  assert.match(await page.locator('#case-ELECTRICAL blockquote').first().innerText(), /<img src=x/);
  await choose(page, 'WINDOW_CLOSED');
  assert.equal((await openTrace(page, 'WINDOW_CLOSED')).minimumEvidence.nonEvidenceGates[0].code, 'SPECIFICATION_WINDOW_CLOSED');
  assert.deepEqual(errors, []);
});

test('near-limit accepted records export within the same byte limit and reopen unchanged', async t => {
  const { createPilotDraft, createPilotReviewRecord } = await import('../../scripts/lib/pilot-review-record.mjs');
  const { page, workspace, dir } = await openOffline(t);
  const draft = createPilotDraft(workspace); draft.recordKind = 'AGENT_SIMULATION';
  for (const review of draft.reviews) { review.reason = '\u0001'.repeat(1533); review.nextAction = '\u0001'.repeat(1533); }
  const record = createPilotReviewRecord(workspace, draft);
  const compact = JSON.stringify(record);
  assert.ok(Buffer.byteLength(compact) <= 128 * 1024);
  await page.getByLabel('기록 JSON 다시 열기').setInputFiles({ name: 'near-limit.json', mimeType: 'application/json', buffer: Buffer.from(compact) });
  await page.waitForFunction(() => document.getElementById('record-kind').value === 'AGENT_SIMULATION');
  const event = page.waitForEvent('download'); await page.getByRole('button', { name: 'JSON 기록 내보내기', exact: true }).click();
  const download = await event; const target = join(dir, 'near-limit-export.json'); await download.saveAs(target);
  const text = await readFile(target, 'utf8');
  assert.ok(Buffer.byteLength(text) <= 128 * 1024, `exported ${Buffer.byteLength(text)} bytes exceeds own import limit`);
  assert.deepEqual(JSON.parse(text), record);
  const dialog = page.waitForEvent('dialog');
  await page.getByLabel('기록 JSON 다시 열기').setInputFiles(target); await (await dialog).accept();
  await page.waitForFunction(() => document.getElementById('import-record').value === '');
  assert.equal(await page.getByLabel('판단 이유').inputValue(), record.reviews[0].reason);
  assert.equal(await page.locator('#record-error').innerText(), '');
});
