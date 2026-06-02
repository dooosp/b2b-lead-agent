import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJsonPath = path.resolve(__dirname, '../../package.json');
const workflowPath = path.resolve(__dirname, '../../.github/workflows/generate-report.yml');
const ciWorkflowPath = path.resolve(__dirname, '../../.github/workflows/ci.yml');
const validateNamingWorkflowPath = path.resolve(__dirname, '../../.github/workflows/validate-naming.yml');

test('generate-report workflow keeps requestId callback contract fields', async () => {
  const workflow = await readFile(workflowPath, 'utf8');

  assert.match(workflow, /run-name:\s+Generate report/i);
  assert.match(workflow, /REQUEST_ID:\s+\$\{\{\s*github\.event\.client_payload\.requestId/i);
  assert.match(workflow, /STATUS_EVENT_URL:\s+\$\{\{\s*github\.event\.client_payload\.statusEventUrl/i);
  assert.match(workflow, /CALLBACK_TOKEN:\s+\$\{\{\s*github\.event\.client_payload\.callbackToken/i);
  assert.match(workflow, /"state":"running"/);
  assert.match(workflow, /"state":"\$JOB_STATE"/);
  assert.match(workflow, /X-Job-Callback-Token: \$CALLBACK_TOKEN/);
});

test('workflows use Node 24 compatible GitHub Actions runtime versions', async () => {
  const [generateWorkflow, ciWorkflow, validateNamingWorkflow] = await Promise.all([
    readFile(workflowPath, 'utf8'),
    readFile(ciWorkflowPath, 'utf8'),
    readFile(validateNamingWorkflowPath, 'utf8')
  ]);

  for (const workflow of [generateWorkflow, ciWorkflow, validateNamingWorkflow]) {
    assert.doesNotMatch(workflow, /actions\/checkout@v4/);
    assert.doesNotMatch(workflow, /actions\/setup-node@v4/);
    assert.match(workflow, /actions\/checkout@v5/);
    assert.match(workflow, /actions\/setup-node@v5/);
  }
});

test('non-production check workflows use lockfile-backed npm ci installs', async () => {
  const [ciWorkflow, validateNamingWorkflow] = await Promise.all([
    readFile(ciWorkflowPath, 'utf8'),
    readFile(validateNamingWorkflowPath, 'utf8')
  ]);

  for (const workflow of [ciWorkflow, validateNamingWorkflow]) {
    assert.match(workflow, /run:\s+npm ci/);
    assert.doesNotMatch(workflow, /run:\s+npm install/);
  }
});

test('CI workflow runs the synthetic lead-quality evaluator before full tests', async () => {
  const workflow = await readFile(ciWorkflowPath, 'utf8');

  assert.match(workflow, /name:\s+Run synthetic lead-quality evaluation\s+run:\s+npm run eval:lead-quality/);
  assert.match(workflow, /run:\s+npm run check:schema[\s\S]*run:\s+npm run eval:lead-quality[\s\S]*run:\s+npm test/);
});

test('CI workflow runs the local-only Worker E2E smoke after full tests', async () => {
  const workflow = await readFile(ciWorkflowPath, 'utf8');

  assert.match(workflow, /name:\s+Run local-only Worker E2E smoke\s+run:\s+npm run test:e2e:local/);
  assert.match(workflow, /name:\s+Install Playwright Chromium\s+run:\s+npx playwright install --with-deps chromium/);
  assert.match(workflow, /run:\s+npm test[\s\S]*run:\s+npm run test:e2e:local/);
  assert.match(workflow, /run:\s+npx playwright install --with-deps chromium[\s\S]*run:\s+npm run test:e2e:local/);
});

test('package exposes a local-only Level 1 regression gate', async () => {
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
  const script = packageJson.scripts['check:level1'] || '';
  const manifestScript = packageJson.scripts['proof:level1:change-control-manifest'] || '';
  const rehearsalScript = packageJson.scripts['proof:level1:operator-rehearsal'] || '';

  assert.match(script, /node --test/);
  assert.match(script, /worker\/tests\/local-test-auth-adapter\.test\.mjs/);
  assert.match(script, /worker\/tests\/auth-provider-session-scaffold\.test\.mjs/);
  assert.match(script, /worker\/tests\/level1-readiness-guards\.test\.mjs/);
  assert.match(script, /worker\/tests\/level1-local-proof-simulation\.test\.mjs/);
  assert.match(script, /worker\/tests\/level1-auth-route-audit\.test\.mjs/);
  assert.match(script, /worker\/tests\/manual-review-notes\.test\.mjs/);
  assert.match(script, /worker\/tests\/level1-proof-preflight\.test\.mjs/);
  assert.match(script, /worker\/tests\/level1-production-proof-approval\.test\.mjs/);
  assert.match(script, /worker\/tests\/level1-production-proof-change-control-manifest\.test\.mjs/);
  assert.match(script, /worker\/tests\/level1-operator-rehearsal\.test\.mjs/);
  assert.match(script, /npm run test:evidence/);
  assert.match(script, /npm run proof:level1:preflight/);
  assert.match(script, /npm run proof:level1:approval-dry-run/);
  assert.match(script, /npm run proof:level1:change-control-manifest/);
  assert.match(script, /npm run proof:level1:operator-rehearsal/);
  assert.doesNotMatch(script, /wrangler|curl|deploy|main\.js|D1_DATABASE|DATABASE_ID|CLOUDFLARE|GEMINI|GMAIL|https?:\/\//i);
  assert.match(manifestScript, /node scripts\/level1-production-proof-change-control-manifest\.mjs --json --output tmp\/codex\/level1-production-proof-change-control-manifest-non-production-plan\.json/);
  assert.doesNotMatch(manifestScript, /wrangler|curl|deploy|main\.js|D1_DATABASE|DATABASE_ID|CLOUDFLARE|GEMINI|GMAIL|https?:\/\//i);
  assert.match(rehearsalScript, /node scripts\/level1-operator-rehearsal\.mjs --json --output tmp\/codex\/level1-operator-rehearsal-non-production-runbook\.json/);
  assert.doesNotMatch(rehearsalScript, /wrangler|curl|deploy|main\.js|D1_DATABASE|DATABASE_ID|CLOUDFLARE|GEMINI|GMAIL|https?:\/\//i);
});

test('CI workflow runs the safe Level 1 regression gate before full tests', async () => {
  const workflow = await readFile(ciWorkflowPath, 'utf8');

  assert.match(workflow, /name:\s+Run Level 1 non-production regression gate\s+run:\s+npm run check:level1/);
  assert.match(workflow, /run:\s+npm run eval:lead-quality[\s\S]*run:\s+npm run check:level1[\s\S]*run:\s+npm test/);
  assert.doesNotMatch(workflow, /secrets\./);
  assert.doesNotMatch(workflow, /wrangler|curl|deploy|D1_DATABASE|DATABASE_ID|CLOUDFLARE|GEMINI|GMAIL/i);
});
