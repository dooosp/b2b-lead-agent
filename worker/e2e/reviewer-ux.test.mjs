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
      await page.locator('[data-lead-id="local-lead-review"]').waitFor();
      await page.getByRole('combobox', { name: '검토 상태', exact: true }).selectOption('NEEDS_REVIEW');
      await page.locator('[data-lead-id="local-lead-review"]').getByRole('link', { name: label, exact: true }).click();
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
});
