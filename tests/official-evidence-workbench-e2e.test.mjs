import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import {
  createWorkbenchServer,
  loadDefaultWorkbenchCatalog
} from '../evidence-claim-workbench/server.mjs';

async function openMonitoredPage(context, origin) {
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const externalRequests = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => failedRequests.push(`${request.url()} ${request.failure()?.errorText || ''}`));
  page.on('request', (request) => {
    const url = request.url();
    if (!url.startsWith(origin) && !url.startsWith('blob:') && !url.startsWith('data:')) externalRequests.push(url);
  });
  return { page, consoleErrors, pageErrors, failedRequests, externalRequests };
}

async function chooseDecision(page, value, reason) {
  await page.locator(`input[name="review-decision"][value="${value}"]`).check();
  await page.locator('#review-reason').selectOption(reason);
  await page.locator('#review-acknowledgement').check();
}

async function selectDocumentByText(page, text) {
  const card = page.locator('#document-list .document-card').filter({ hasText: text }).first();
  await card.click();
  await page.locator('#evidence-heading').waitFor({ state: 'visible' });
  return card;
}

test('Playwright core flow exports a bounded patch, invalidates stale edits, resets state, and writes no persistent browser data', { timeout: 90_000 }, async () => {
  const started = await createWorkbenchServer();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    acceptDownloads: true,
    permissions: ['clipboard-read', 'clipboard-write'],
    viewport: { width: 1440, height: 1000 }
  });
  const monitored = await openMonitoredPage(context, started.origin);
  const { page } = monitored;
  let downloadCount = 0;
  page.on('download', () => { downloadCount += 1; });
  try {
    await page.goto(started.origin, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('h1').count(), 1);
    assert.ok(await page.locator('#document-list .document-card').count() >= 13);

    await selectDocumentByText(page, 'Synthetic evidence document certification');
    assert.match(await page.locator('#source-metadata').innerText(), /SYNTH-CERTIFICATION/);
    assert.match(await page.locator('#page-text').innerText(), /Certification: IEC 62271-200/);
    const candidate = page.locator('#candidate-list .candidate-card').first();
    await candidate.click();
    assert.match(await page.locator('#rail-quote').innerText(), /Certification: IEC 62271-200/);
    assert.match(await page.locator('#rail-locator').innerText(), /DOCUMENT_PAGE/);
    assert.match(await page.locator('#rail-context-before').innerText(), /Synthetic certification evidence/);
    assert.match(await page.locator('#rail-context-after').innerText(), /End of synthetic evidence/);
    assert.match(await page.locator('#rail-offsets').innerText(), /^\d+–\d+$/);
    assert.equal(await page.locator('#rail-occurrence').innerText(), '1 / 1');
    assert.equal(await page.locator('#capability-key').inputValue(), 'certification');

    await page.locator('#project-stage').selectOption('DETAILED_DESIGN');
    await chooseDecision(page, 'APPROVE_FOR_REPOSITORY_REVIEW', 'EVIDENCE_QUOTE_CONFIRMED');
    assert.equal(await page.locator('#record-review').isEnabled(), true);
    await page.locator('#record-review').click();
    await page.waitForFunction(() => document.querySelector('#patch-id')?.textContent?.startsWith('patch_'));
    assert.equal(await page.locator('#trust-registry').innerText(), 'UNVERIFIED');
    assert.equal(await page.locator('#trust-customer').innerText(), 'BLOCKED');
    assert.equal(await page.locator('#trust-readiness').innerText(), 'READY_FOR_CODE_REVIEW');
    let patch = JSON.parse(await page.locator('#patch-preview').inputValue());
    assert.equal(patch.schemaVersion, 'claim-registry-review-patch-v0');
    assert.equal(patch.productionReady, false);
    assert.equal(patch.automaticVerification, false);
    assert.equal(patch.customerUseAllowed, false);
    assert.equal(patch.reviewerIdentity, 'NOT_COLLECTED');
    assert.equal(patch.issue165Status, 'HOLD');
    assert.equal(Object.hasOwn(patch, 'pages'), false);
    assert.notEqual(patch.evidenceAnchors[0].selection.directQuote, await page.locator('#page-text').innerText());

    await page.locator('#candidate-value').fill('IEC 62271-200, KS C IEC 62271-200');
    assert.equal(await page.locator('#patch-preview').inputValue(), '');
    assert.equal(await page.locator('#copy-patch').isDisabled(), true);
    await page.waitForFunction(() => document.querySelector('#workbench-status')?.textContent?.includes('무효화'));
    assert.match(await page.locator('#workbench-status').innerText(), /무효화/);
    await page.locator('#record-review').click();
    await page.waitForFunction(() => document.querySelector('#patch-id')?.textContent?.startsWith('patch_'));
    patch = JSON.parse(await page.locator('#patch-preview').inputValue());
    assert.deepEqual(patch.approvedCandidates[0].candidate.value.value, ['IEC 62271-200', 'KS C IEC 62271-200']);

    await selectDocumentByText(page, 'Synthetic MV switchgear technical schedule');
    await selectDocumentByText(page, 'Synthetic evidence document certification');
    await page.locator('#candidate-list .candidate-card').first().click();
    assert.equal(await page.locator('#candidate-value').inputValue(), 'IEC 62271-200, KS C IEC 62271-200');
    assert.equal(await page.locator('input[name="review-decision"][value="APPROVE_FOR_REPOSITORY_REVIEW"]').isChecked(), true);
    assert.equal(await page.locator('#review-reason').inputValue(), 'EVIDENCE_QUOTE_CONFIRMED');
    assert.equal(await page.locator('#review-acknowledgement').isChecked(), true);
    assert.equal(await page.locator('#trust-readiness').innerText(), 'READY_FOR_CODE_REVIEW');
    assert.deepEqual(JSON.parse(await page.locator('#patch-preview').inputValue()).approvedCandidates[0].candidate.value.value, patch.approvedCandidates[0].candidate.value.value);

    const recordedPatchId = await page.locator('#patch-id').innerText();
    await page.locator('#reset-review').click();
    assert.equal(await page.locator('#candidate-value').inputValue(), 'IEC 62271-200, KS C IEC 62271-200');
    assert.equal(await page.locator('input[name="review-decision"][value="APPROVE_FOR_REPOSITORY_REVIEW"]').isChecked(), true);
    assert.equal(await page.locator('#review-reason').inputValue(), 'EVIDENCE_QUOTE_CONFIRMED');
    assert.equal(await page.locator('#review-acknowledgement').isChecked(), true);
    assert.equal(await page.locator('#patch-id').innerText(), recordedPatchId);
    assert.equal(await page.locator('#trust-readiness').innerText(), 'READY_FOR_CODE_REVIEW');
    assert.deepEqual(JSON.parse(await page.locator('#patch-preview').inputValue()).approvedCandidates[0].candidate.value.value, patch.approvedCandidates[0].candidate.value.value);

    await page.locator('#copy-patch').click();
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    assert.equal(JSON.parse(clipboard).patchId, patch.patchId);

    const downloadPromise = page.waitForEvent('download');
    await page.locator('#download-patch').click();
    const download = await downloadPromise;
    assert.match(download.suggestedFilename(), /^official-evidence-review-patch_[a-f0-9]+\.json$/);
    const downloadedPath = await download.path();
    assert.ok(downloadedPath);
    const downloaded = JSON.parse(await readFile(downloadedPath, 'utf8'));
    assert.equal(downloaded.patchId, patch.patchId);
    assert.equal(downloaded.customerUseAllowed, false);

    await selectDocumentByText(page, 'Synthetic MV switchgear technical schedule');
    assert.equal(await page.locator('input[name="review-decision"]:checked').count(), 0);
    assert.equal(await page.locator('#review-acknowledgement').isChecked(), false);
    assert.equal(await page.locator('#rail-quote').innerText(), '선택 안 됨');
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('#patch-preview').inputValue(), '');
    assert.equal(await page.locator('input[name="review-decision"]:checked').count(), 0);

    await page.setViewportSize({ width: 375, height: 812 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 1, `mobile horizontal overflow: ${overflow}`);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true);

    const persistence = await page.evaluate(async () => ({
      localKeys: Object.keys(localStorage),
      sessionKeys: Object.keys(sessionStorage),
      databases: indexedDB.databases ? (await indexedDB.databases()).map(({ name }) => name) : [],
      cacheKeys: await caches.keys(),
      serviceWorkerCount: (await navigator.serviceWorker.getRegistrations()).length
    }));
    assert.deepEqual(persistence, { localKeys: [], sessionKeys: [], databases: [], cacheKeys: [], serviceWorkerCount: 0 });
    assert.deepEqual(await context.cookies(), []);
    assert.equal((await context.request.get(`${started.origin}/unknown`)).status(), 404);
    assert.equal(downloadCount, 1);
    assert.deepEqual(monitored.externalRequests, []);
    assert.deepEqual(monitored.consoleErrors, []);
    assert.deepEqual(monitored.pageErrors, []);
    assert.deepEqual(monitored.failedRequests, []);
  } finally {
    await context.close();
    await browser.close();
    await started.close();
  }
});

test('Playwright keeps readiness blocked when canonical patch construction refuses an approval', { timeout: 90_000 }, async () => {
  const started = await createWorkbenchServer({
    handlerOptions: {
      buildPatch() {
        throw Object.assign(new Error('canonical refusal'), { code: 'CANONICAL_PATCH_REFUSED' });
      }
    }
  });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const monitored = await openMonitoredPage(context, started.origin);
  const { page } = monitored;
  try {
    await page.goto(started.origin, { waitUntil: 'networkidle' });
    await selectDocumentByText(page, 'Synthetic evidence document certification');
    await page.locator('#candidate-list .candidate-card').first().click();
    await chooseDecision(page, 'APPROVE_FOR_REPOSITORY_REVIEW', 'EVIDENCE_QUOTE_CONFIRMED');
    await page.locator('#record-review').click();
    await page.locator('#review-errors').waitFor({ state: 'visible' });
    assert.match(await page.locator('#review-errors').innerText(), /CANONICAL_PATCH_REFUSED/);
    assert.equal(await page.locator('#trust-readiness').innerText(), 'BLOCKED_OR_REVIEW_DECISION_REQUIRED');
    assert.equal(await page.locator('#patch-id').innerText(), '아직 없음');
    assert.equal(await page.locator('#patch-preview').inputValue(), '');
    assert.equal(await page.locator('#copy-patch').isDisabled(), true);
    assert.deepEqual(monitored.externalRequests, []);
    assert.deepEqual(monitored.pageErrors, []);
  } finally {
    await context.close();
    await browser.close();
    await started.close();
  }
});

test('Playwright exposes reject, conflict, supersession, condition comparison, full-page refusal, keyboard flow, and clear-session controls', { timeout: 90_000 }, async () => {
  const started = await createWorkbenchServer();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const monitored = await openMonitoredPage(context, started.origin);
  const { page } = monitored;
  try {
    await page.goto(started.origin, { waitUntil: 'networkidle' });
    await selectDocumentByText(page, 'Synthetic evidence document certification');
    const certificationCandidate = page.locator('#candidate-list .candidate-card').first();
    await certificationCandidate.focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'review-heading');
    await chooseDecision(page, 'REJECT', 'NOT_A_CAPABILITY');
    await page.locator('#record-review').click();
    await page.locator('#review-errors').waitFor({ state: 'visible' });
    assert.match(await page.locator('#review-errors').innerText(), /NO_APPROVED_CANDIDATES/);
    await page.locator('#clear-decisions').click();
    assert.equal(await page.locator('#review-errors').isHidden(), true);

    await selectDocumentByText(page, 'conflict-a');
    await page.locator('#candidate-list .candidate-card').first().click();
    assert.match(await page.locator('#related-claims').innerText(), /값이 실질적으로 충돌|MATERIAL_CONFLICT/);
    assert.match(await page.locator('#related-claims').innerText(), /출처/);
    assert.match(await page.locator('#related-claims').innerText(), /페이지\/\uC139션/);
    await chooseDecision(page, 'FLAG_CONFLICT', 'CONFLICTING_DOCUMENT');
    await page.locator('#record-review').click();
    await page.locator('#review-errors').waitFor({ state: 'visible' });
    assert.match(await page.locator('#review-errors').innerText(), /RELATIONSHIP_REVIEW_REQUIRED/);
    await page.locator('#clear-decisions').click();

    await selectDocumentByText(page, 'supersession-old');
    await page.locator('#candidate-list .candidate-card').first().click();
    assert.match(await page.locator('#related-claims').innerText(), /신규 개정본|SUPERSEDES/);
    await chooseDecision(page, 'FLAG_SUPERSEDED', 'SUPERSEDED_DOCUMENT');
    assert.equal(await page.locator('#record-review').isEnabled(), true);
    await page.locator('#record-review').click();
    await page.locator('#review-errors').waitFor({ state: 'visible' });
    assert.match(await page.locator('#review-errors').innerText(), /RELATIONSHIP_REVIEW_REQUIRED/);
    await page.locator('#clear-decisions').click();

    await selectDocumentByText(page, 'condition-resolved-indoor');
    await page.locator('#candidate-list .candidate-card').first().click();
    assert.match(await page.locator('#related-claims').innerText(), /적용 조건이 달라 충돌 아님|CONDITION_RESOLVED/);

    await selectDocumentByText(page, 'same-quote-different-pages');
    await page.locator('#candidate-list .candidate-card').first().click();
    assert.match(await page.locator('#trust-binding').innerText(), /BLOCKED_INVALID_OR_FULL_PAGE_QUOTE/);
    await chooseDecision(page, 'REJECT', 'NOT_A_CAPABILITY');
    assert.equal(await page.locator('#record-review').isDisabled(), true);

    const firstDocument = page.locator('#document-list .document-card').first();
    await firstDocument.focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'evidence-heading');
    assert.deepEqual(monitored.externalRequests, []);
    assert.deepEqual(monitored.consoleErrors, []);
    assert.deepEqual(monitored.pageErrors, []);
  } finally {
    await context.close();
    await browser.close();
    await started.close();
  }
});

test('Playwright renders hostile catalog values as text and provides clipboard-denial fallback without external loads', { timeout: 90_000 }, async () => {
  const defaultCatalog = await loadDefaultWorkbenchCatalog();
  const catalog = JSON.parse(JSON.stringify(defaultCatalog));
  const target = catalog.documents.find((document) => document.title.includes('certification'));
  const targetPage = target.pages[0];
  const targetCandidate = targetPage.candidates[0];
  const hostile = '<svg onload="globalThis.__workbenchPwned=1"><script>globalThis.__workbenchPwned=2</script>';
  target.title = hostile;
  target.publisher = hostile;
  targetPage.text = `Synthetic header\n${hostile}\n${targetCandidate.exactQuote}\nSynthetic footer`;
  targetCandidate.statement = hostile;
  const fixedPatch = {
    schemaVersion: 'claim-registry-review-patch-v0',
    patchId: `patch_${'e'.repeat(64)}`,
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    productionReady: false,
    productionReviewerWorkflowReady: false,
    automaticVerification: false,
    customerUseAllowed: false,
    reviewerIdentity: 'NOT_COLLECTED',
    issue165Status: 'HOLD',
    approvedCandidates: [{}],
    sourceDocuments: [{}],
    metrics: { approvedCandidateCount: 1, sourceDocumentCount: 1 }
  };
  const started = await createWorkbenchServer({ handlerOptions: { catalog, buildPatch: () => fixedPatch } });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new Error('denied')) } });
  });
  const monitored = await openMonitoredPage(context, started.origin);
  const { page } = monitored;
  try {
    await page.goto(started.origin, { waitUntil: 'networkidle' });
    await selectDocumentByText(page, '<svg onload=');
    assert.equal(await page.locator('svg').count(), 0);
    assert.equal(await page.locator('script:not([src])').count(), 0);
    assert.equal(await page.evaluate(() => globalThis.__workbenchPwned), undefined);
    assert.match(await page.locator('#source-metadata').innerText(), /<svg onload=/);
    await page.locator('#candidate-list .candidate-card').first().click();
    await chooseDecision(page, 'APPROVE_FOR_REPOSITORY_REVIEW', 'EVIDENCE_QUOTE_CONFIRMED');
    await page.locator('#record-review').click();
    await page.waitForFunction(() => document.querySelector('#patch-id')?.textContent?.startsWith('patch_'));
    await page.locator('#copy-patch').click();
    assert.equal(await page.locator('#copy-fallback').isVisible(), true);
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'patch-preview');
    assert.deepEqual(monitored.externalRequests, []);
    assert.deepEqual(monitored.consoleErrors, []);
    assert.deepEqual(monitored.pageErrors, []);
  } finally {
    await context.close();
    await browser.close();
    await started.close();
  }
});
