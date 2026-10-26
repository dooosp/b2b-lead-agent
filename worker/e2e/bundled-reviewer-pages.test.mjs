import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { LOCAL_E2E_TOKEN, createLocalE2EHarness, createLocalSmokeEnv, installLocalOnlyFetchGuard } from '../tests/helpers/local-e2e-harness.mjs';

test('bundled Worker emits executable reviewer pages for allowed and denied roles', async (t) => {
  const guard = installLocalOnlyFetchGuard();
  const directory = await mkdtemp(join(tmpdir(), 'b2b-bundled-reviewer-'));
  const harness = await createLocalE2EHarness();
  let browser;
  t.after(async () => {
    try {
      if (browser) await browser.close();
      await harness.close();
      await rm(directory, { recursive: true, force: true });
      assert.deepEqual(guard.blockedUrls, []);
    } finally { guard.restore(); }
  });
  // Wrangler defaults to keepNames:true. Executing only source-import pages
  // misses helpers inserted into function bodies by the Worker bundler.
  const bundle = await build({
    entryPoints: [fileURLToPath(new URL('../index.js', import.meta.url))],
    bundle: true, format: 'esm', platform: 'neutral', target: 'es2022',
    keepNames: true, external: ['node:*'], write: false,
  });
  const bundlePath = join(directory, 'worker.mjs');
  await writeFile(bundlePath, bundle.outputFiles[0].text);
  const { default: worker } = await import(pathToFileURL(bundlePath).href);
  browser = await chromium.launch({ headless: true });

  for (const role of ['reviewer', 'manager']) {
    const context = await browser.newContext({ serviceWorkers: 'block', extraHTTPHeaders: {
      Authorization: `Bearer ${LOCAL_E2E_TOKEN}`, 'X-Manual-Review-Notes-Local-Test-Role': role,
    } });
    t.after(() => context.close());
    await context.addInitScript(token => sessionStorage.setItem('b2b_token', token), LOCAL_E2E_TOKEN);
    const env = createLocalSmokeEnv({ MANUAL_REVIEW_NOTES_LOCAL_TEST_ROLE_STUB: 'enabled', WORKER_ORIGIN: harness.origin });
    // Every browser request goes through the actual bundled Worker and fake D1.
    // The loopback harness supplies an origin; no source Worker response is used.
    await context.route('**/*', async route => {
      const request = route.request();
      assert.equal(new URL(request.url()).origin, harness.origin);
      const tasks = [];
      const response = await worker.fetch(new Request(request.url(), {
        method: request.method(), headers: await request.allHeaders(),
        ...(request.postDataBuffer() ? { body: request.postDataBuffer() } : {}),
      }), env, { waitUntil: task => tasks.push(task) });
      await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) });
      await Promise.all(tasks);
    });

    for (const kind of ['list', 'detail']) {
      await t.test(`${role} ${kind} bootstraps after Worker bundling`, async () => {
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        try {
          await page.goto(`${harness.origin}${kind === 'list' ? '/leads?profile=danfoss' : '/leads/local-lead-review'}`);
          assert.deepEqual(errors, [], 'the emitted browser script must execute without Worker-only helpers');
          if (kind === 'list') {
            await page.locator('.lead-card[data-lead-id="local-lead-review"]').waitFor({ timeout: 3000 });
            await page.getByRole('combobox', { name: '검토 상태', exact: true }).selectOption('NEEDS_REVIEW');
            await page.getByRole('tab', { name: '칸반 보드' }).click();
            assert.equal(await page.locator('#kanbanView .kanban-card').count(), 1);
            if (role === 'manager') {
              assert.equal(await page.locator('[data-review-note-text], [data-reviewer-feedback-form]').count(), 0);
              assert.doesNotMatch(await page.content(), /reviewNoteSuggestion|reviewNoteTemplates|Follow-up check:|생성된 검토 메모 제안/);
            } else assert.ok(await page.locator('[data-reviewer-feedback-form]').count() > 0);
          } else {
            await page.getByRole('heading', { name: 'Local Data Center Cooling', exact: true }).waitFor({ timeout: 3000 });
            if (role === 'manager') {
              await page.locator('[data-reviewer-feedback-protected]').waitFor();
              assert.equal(await page.locator('[data-workbench-note-copy-action], [data-reviewer-feedback-form]').count(), 0);
            } else {
              await page.getByRole('textbox', { name: '피드백', exact: true }).fill('번들 실행 합성 피드백');
              const saved = page.waitForResponse(response => response.request().method() === 'PATCH');
              await page.getByRole('button', { name: '피드백 저장', exact: true }).click();
              assert.equal((await (await saved).json()).lead.reviewerFeedback.feedbackText, '번들 실행 합성 피드백');
              await page.locator('[data-reviewer-feedback-state="saved"]').waitFor();
            }
          }
          assert.deepEqual(errors, []);
        } finally { await page.close(); }
      });
    }
  }
});
