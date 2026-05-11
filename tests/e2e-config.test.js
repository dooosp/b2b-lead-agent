const assert = require('node:assert/strict');
const test = require('node:test');

let e2eConfigModule;
async function loadE2EConfigModule() {
  if (!e2eConfigModule) {
    e2eConfigModule = await import('../e2e-config.mjs');
  }
  return e2eConfigModule;
}

test('resolveE2EConfig defaults to a local base URL', async () => {
  const { resolveE2EConfig } = await loadE2EConfigModule();
  const config = resolveE2EConfig({});

  assert.equal(config.baseUrl, 'http://127.0.0.1:8787');
  assert.equal(config.token, '');
  assert.equal(config.allowProduction, false);
});

test('resolveE2EConfig accepts an explicit local URL and token', async () => {
  const { resolveE2EConfig } = await loadE2EConfigModule();
  const config = resolveE2EConfig({
    E2E_BASE_URL: 'http://localhost:8787/',
    API_TOKEN: 'local-token'
  });

  assert.equal(config.baseUrl, 'http://localhost:8787');
  assert.equal(config.token, 'local-token');
});

test('resolveE2EConfig rejects workers.dev URLs without explicit approval', async () => {
  const { resolveE2EConfig } = await loadE2EConfigModule();
  assert.throws(
    () => resolveE2EConfig({ E2E_BASE_URL: 'https://b2b-lead-trigger.example.workers.dev' }),
    /Refusing to run E2E against a workers\.dev URL/
  );
});

test('resolveE2EConfig allows workers.dev URLs only with explicit approval', async () => {
  const { resolveE2EConfig } = await loadE2EConfigModule();
  const config = resolveE2EConfig({
    E2E_BASE_URL: 'https://b2b-lead-trigger.example.workers.dev/',
    ALLOW_PRODUCTION_E2E: 'yes',
    B2B_TOKEN: 'approved-token'
  });

  assert.equal(config.baseUrl, 'https://b2b-lead-trigger.example.workers.dev');
  assert.equal(config.token, 'approved-token');
  assert.equal(config.allowProduction, true);
});

test('production approval parsing is explicit', async () => {
  const { hasProductionE2EApproval } = await loadE2EConfigModule();
  assert.equal(hasProductionE2EApproval({ ALLOW_PRODUCTION_E2E: 'YES' }), true);
  assert.equal(hasProductionE2EApproval({ ALLOW_PRODUCTION_E2E: 'no' }), false);
});

test('URL helpers reject unsupported protocols', async () => {
  const { isProductionWorkerUrl, normalizeBaseUrl } = await loadE2EConfigModule();
  assert.throws(() => normalizeBaseUrl('file:///tmp/test.html'), /must use http or https/);
  assert.equal(isProductionWorkerUrl('https://service.example.workers.dev'), true);
  assert.equal(isProductionWorkerUrl('http://127.0.0.1:8787'), false);
});
