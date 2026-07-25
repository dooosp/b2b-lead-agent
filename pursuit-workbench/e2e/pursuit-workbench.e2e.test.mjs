import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { startPursuitWorkbenchServer } from '../server.mjs';

async function withWorkbenchBrowser(options, callback) {
  const started = await startPursuitWorkbenchServer();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: options.viewport || { width: 1280, height: 900 },
    reducedMotion: options.reducedMotion || 'reduce'
  });
  const externalRequests = [];
  const consoleErrors = [];
  const pageErrors = [];
  const failedResources = [];
  const serviceWorkers = [];
  await context.addInitScript(({ clipboardMode }) => {
    globalThis.__workbenchInstrumentation = { clipboardWrites: [], persistenceWrites: [] };
    const record = (kind) => globalThis.__workbenchInstrumentation.persistenceWrites.push(kind);
    for (const name of ['localStorage', 'sessionStorage']) {
      try {
        const storage = globalThis[name];
        const original = storage.setItem.bind(storage);
        storage.setItem = (...args) => { record(`${name}.setItem`); return original(...args); };
      } catch {}
    }
    if (globalThis.indexedDB?.open) {
      const original = globalThis.indexedDB.open.bind(globalThis.indexedDB);
      globalThis.indexedDB.open = (...args) => { record('indexedDB.open'); return original(...args); };
    }
    if (globalThis.caches?.open) {
      const original = globalThis.caches.open.bind(globalThis.caches);
      globalThis.caches.open = (...args) => { record('caches.open'); return original(...args); };
    }
    if (navigator.serviceWorker?.register) {
      const original = navigator.serviceWorker.register.bind(navigator.serviceWorker);
      navigator.serviceWorker.register = (...args) => { record('serviceWorker.register'); return original(...args); };
    }
    try {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (text) => {
            if (clipboardMode === 'reject') throw new Error('clipboard refused by test');
            globalThis.__workbenchInstrumentation.clipboardWrites.push(text);
          }
        }
      });
    } catch {}
  }, { clipboardMode: options.clipboardMode || 'capture' });
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== started.origin) {
      externalRequests.push(url.href);
      await route.abort('blockedbyclient');
      return;
    }
    await route.continue();
  });
  context.on('serviceworker', (worker) => serviceWorkers.push(worker.url()));
  const page = await context.newPage();
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => failedResources.push(`${request.url()}: ${request.failure()?.errorText || 'failed'}`));
  try {
    await callback({ page, context, started, externalRequests, consoleErrors, pageErrors, failedResources, serviceWorkers });
  } finally {
    await context.close();
    await browser.close();
    await started.close();
  }
}

async function assertNoPersistence(page, context) {
  const state = await page.evaluate(async () => ({
    local: localStorage.length,
    session: sessionStorage.length,
    databases: typeof indexedDB.databases === 'function' ? (await indexedDB.databases()).length : 0,
    caches: 'caches' in globalThis ? (await caches.keys()).length : 0,
    registrations: navigator.serviceWorker ? (await navigator.serviceWorker.getRegistrations()).length : 0,
    instrumentation: globalThis.__workbenchInstrumentation
  }));
  assert.equal(state.local, 0);
  assert.equal(state.session, 0);
  assert.equal(state.databases, 0);
  assert.equal(state.caches, 0);
  assert.equal(state.registrations, 0);
  assert.deepEqual(state.instrumentation.persistenceWrites, []);
  assert.deepEqual(await context.cookies(), []);
}

test('keyboard reviewer flow switches scenario, creates/copies/downloads a valid packet, and resets on refresh', async () => {
  await withWorkbenchBrowser({}, async ({ page, context, started, externalRequests, consoleErrors, pageErrors, failedResources, serviceWorkers }) => {
    await page.goto(started.origin, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('h1').count(), 1);
    await assert.doesNotReject(page.getByText('LOCAL / SYNTHETIC / NOT PRODUCTION EVIDENCE').waitFor());
    assert.ok(await page.locator('ol.timeline-list > li').count() >= 1);
    assert.equal(await page.getByRole('table', { name: /Specification Fit Matrix/ }).count(), 1);
    assert.equal(await page.getByRole('main', { name: /Campus Alpha Phase 1/ }).count(), 1);

    await page.locator('input[name="disposition"][value="READY_FOR_TECHNICAL_REVIEW"]').check();
    await page.locator('input[name="reason"][value="VERIFIED_FIT_TRACE"]').check();
    await page.locator('#review-acknowledgement').check();

    await page.locator('#scenario-select').focus();
    await page.keyboard.type('Missing project requirement');
    assert.equal(await page.locator('#scenario-select').inputValue(), 'missing_incoming_voltage');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'scenario-load');
    await Promise.all([
      page.waitForURL('**/scenario/missing_incoming_voltage#scenario-heading'),
      page.keyboard.press('Enter')
    ]);
    await page.waitForFunction(() => document.activeElement?.id === 'scenario-heading');
    assert.match(await page.locator('#workbench-status').textContent(), /Scenario changed to Missing project requirement/);
    assert.equal(await page.locator('#packet-section').isHidden(), true);
    assert.equal(await page.locator('input[name="disposition"]:checked').count(), 0);
    assert.equal(await page.locator('input[name="reason"]:checked').count(), 0);
    assert.equal(await page.locator('input[name="question"]:checked').count(), 0);
    assert.equal(await page.locator('#review-acknowledgement').isChecked(), false);

    await page.locator('input[name="question"]').focus();
    await page.keyboard.press('Space');
    await page.locator('input[name="disposition"][value="HOLD_FOR_TECHNICAL_REQUIREMENTS"]').focus();
    await page.keyboard.press('Space');
    await page.locator('input[name="reason"][value="REQUIRED_TECHNICAL_INPUT_MISSING"]').focus();
    await page.keyboard.press('Space');
    await page.locator('#review-acknowledgement').focus();
    await page.keyboard.press('Space');
    await page.locator('#packet-create').focus();
    await page.keyboard.press('Enter');
    await page.locator('#packet-section').waitFor({ state: 'visible' });
    const preview = await page.locator('#packet-preview').inputValue();
    const parsedPreview = JSON.parse(preview);
    assert.equal(parsedPreview.disposition, 'HOLD_FOR_TECHNICAL_REQUIREMENTS');
    assert.deepEqual(parsedPreview.reasonCodes, ['REQUIRED_TECHNICAL_INPUT_MISSING']);
    assert.equal(parsedPreview.selectedQuestionIds.length, 1);
    assert.equal(parsedPreview.reviewerIdentity, 'NOT_COLLECTED');
    assert.equal(parsedPreview.persistence, 'NONE');

    await page.locator('#packet-copy').focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => globalThis.__workbenchInstrumentation.clipboardWrites.length === 1);
    assert.equal(await page.evaluate(() => globalThis.__workbenchInstrumentation.clipboardWrites[0]), preview);

    const downloadPromise = page.waitForEvent('download');
    await page.locator('#packet-download').focus();
    await page.keyboard.press('Enter');
    const download = await downloadPromise;
    assert.match(download.suggestedFilename(), /^pursuit-review-missing_incoming_voltage-[a-f0-9]{12}\.json$/);
    const downloadText = await readFile(await download.path(), 'utf8');
    assert.equal(downloadText, preview);
    assert.deepEqual(JSON.parse(downloadText), parsedPreview);

    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('input[name="disposition"]:checked').count(), 0);
    assert.equal(await page.locator('input[name="reason"]:checked').count(), 0);
    assert.equal(await page.locator('input[name="question"]:checked').count(), 0);
    assert.equal(await page.locator('#review-acknowledgement').isChecked(), false);
    assert.equal(await page.locator('#packet-section').isHidden(), true);
    await assertNoPersistence(page, context);
    assert.deepEqual(externalRequests, []);
    assert.deepEqual(serviceWorkers, []);
    assert.deepEqual(consoleErrors, []);
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(failedResources, []);
  });
});

test('only supported controls are shown, while a tampered invalid disposition still fails closed', async () => {
  await withWorkbenchBrowser({}, async ({ page, context, started, externalRequests, consoleErrors, pageErrors, failedResources }) => {
    await page.goto(`${started.origin}/scenario/missing_incoming_voltage`, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('input[name="disposition"][value="REJECT_TECHNICAL_MISMATCH"]').count(), 0);
    assert.deepEqual(await page.locator('input[name="disposition"]').evaluateAll((inputs) => inputs.map((input) => input.value).sort()), [
      'HOLD_FOR_PROJECT_EVIDENCE', 'HOLD_FOR_TECHNICAL_REQUIREMENTS'
    ]);
    await page.evaluate(() => {
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'disposition';
      input.value = 'REJECT_TECHNICAL_MISMATCH';
      input.checked = true;
      input.hidden = true;
      document.querySelector('#review-form').append(input);
      const reason = document.createElement('input');
      reason.type = 'checkbox';
      reason.name = 'reason';
      reason.value = 'REQUIRED_PROJECT_FACT_MISSING';
      reason.checked = true;
      reason.hidden = true;
      document.querySelector('#review-form').append(reason);
    });
    await page.locator('#review-acknowledgement').focus();
    await page.keyboard.press('Space');
    await page.locator('#packet-create').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'review-errors');
    assert.match(await page.locator('#review-errors').textContent(), /not supported by the recomputed dossier/i);
    assert.equal(await page.locator('input[name="disposition"][value="REJECT_TECHNICAL_MISMATCH"]').isChecked(), true);
    assert.equal(await page.locator('#packet-section').isHidden(), true);
    assert.equal(await page.locator('#disposition-fieldset').getAttribute('aria-invalid'), 'true');
    await assertNoPersistence(page, context);
    assert.deepEqual(externalRequests, []);
    assert.deepEqual(consoleErrors, []);
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(failedResources, []);
  });
});

test('changing product family clears and re-scopes disposition and reason controls', async () => {
  await withWorkbenchBrowser({}, async ({ page, context, started, externalRequests, consoleErrors, pageErrors, failedResources }) => {
    await page.goto(`${started.origin}/scenario/multi_family_datacenter_opportunity`, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('input[name="productFamily"]:checked').inputValue(), 'building_management');
    assert.equal(await page.locator('[data-review-family="building_management"]:not([hidden]) input[name="disposition"]').count(), 1);
    await page.locator('[data-review-family="building_management"] input[name="disposition"][value="READY_FOR_TECHNICAL_REVIEW"]').check();
    assert.equal(await page.locator('[data-review-family="building_management"][data-review-disposition="READY_FOR_TECHNICAL_REVIEW"]:not([hidden]) input[name="reason"]').count(), 2);
    await page.locator('input[name="reason"][value="VERIFIED_FIT_TRACE"]:not([disabled])').check();
    await page.locator('input[name="productFamily"][value="medium_voltage_switchgear"]').check();
    assert.equal(await page.locator('input[name="disposition"]:checked').count(), 0);
    assert.equal(await page.locator('input[name="reason"]:checked').count(), 0);
    assert.equal(await page.locator('[data-review-family="building_management"]:not([hidden])').count(), 0);
    assert.equal(await page.locator('[data-review-family="medium_voltage_switchgear"]:not([hidden]) input[name="disposition"]').count(), 1);
    assert.equal(await page.locator('#reason-empty').isVisible(), true);
    await assertNoPersistence(page, context);
    assert.deepEqual(externalRequests, []);
    assert.deepEqual(consoleErrors, []);
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(failedResources, []);
  });
});

test('clipboard rejection uses a focused plain-text selection fallback', async () => {
  await withWorkbenchBrowser({ clipboardMode: 'reject' }, async ({ page, started, externalRequests, consoleErrors, pageErrors, failedResources }) => {
    await page.goto(started.origin, { waitUntil: 'networkidle' });
    await page.locator('input[name="disposition"][value="READY_FOR_TECHNICAL_REVIEW"]').check();
    await page.locator('input[name="reason"][value="VERIFIED_FIT_TRACE"]').check();
    await page.locator('#review-acknowledgement').check();
    await page.locator('#packet-create').click();
    await page.locator('#packet-copy').click();
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'packet-preview');
    const selected = await page.locator('#packet-preview').evaluate((element) => element.value.slice(element.selectionStart, element.selectionEnd));
    assert.equal(selected, await page.locator('#packet-preview').inputValue());
    assert.match(await page.locator('#workbench-status').textContent(), /Control\+C or Command\+C/);
    assert.deepEqual(externalRequests, []);
    assert.deepEqual(consoleErrors, []);
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(failedResources, []);
  });
});

test('mobile and reduced-motion layout retain all critical content without page-level overflow', async () => {
  await withWorkbenchBrowser({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' }, async ({ page, context, started, externalRequests, consoleErrors, pageErrors, failedResources }) => {
    await page.goto(`${started.origin}/scenario/hard_voltage_mismatch`, { waitUntil: 'networkidle' });
    const overflow = await page.evaluate(() => ({
      body: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      table: document.querySelector('.table-scroll').scrollWidth - document.querySelector('.table-scroll').clientWidth,
      motion: getComputedStyle(document.querySelector('button')).transitionDuration
    }));
    assert.ok(overflow.body <= 1, `page overflow ${overflow.body}`);
    assert.ok(overflow.table > 0, 'fit matrix remains horizontally scrollable inside its wrapper');
    assert.ok(Number.parseFloat(overflow.motion) <= 0.001, overflow.motion);
    assert.equal(await page.getByText('HARD_REQUIREMENT_MISMATCH').count() > 0, true);
    assert.equal(await page.locator('h1').count(), 1);
    const controlsInViewport = await page.locator('button, select').evaluateAll((elements) => elements.every((element) => {
      const rect = element.getBoundingClientRect();
      return rect.left >= -1 && rect.right <= document.documentElement.clientWidth + 1;
    }));
    assert.equal(controlsInViewport, true);
    await assertNoPersistence(page, context);
    assert.deepEqual(externalRequests, []);
    assert.deepEqual(consoleErrors, []);
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(failedResources, []);
  });
});
