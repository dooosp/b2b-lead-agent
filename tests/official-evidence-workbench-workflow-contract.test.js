const test = require('node:test');
const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

test('package exposes bounded local-only official-evidence Workbench commands', async () => {
  const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const expected = {
    'audit:evidence-documents': 'node scripts/audit-evidence-documents.mjs --json',
    'eval:evidence-claim-workbench': 'node scripts/evaluate-evidence-claim-workbench.mjs --json --repeat 2',
    'measure:evidence-claim-workbench': 'node scripts/measure-evidence-claim-workbench.mjs',
    'test:evidence-claim-workbench:sensitivity': 'node scripts/test-evidence-claim-workbench-sensitivity.mjs',
    'test:evidence-claim-workbench:e2e': 'node --test tests/official-evidence-workbench-e2e.test.mjs',
    'demo:evidence-claim-workbench': 'node evidence-claim-workbench/server.mjs',
    'demo:evidence-claim-workbench:real': 'npm run test:evidence-claim-workbench && node evidence-claim-workbench/server.mjs --real-intake',
    'export:evidence-claim-review': 'node scripts/export-evidence-claim-review.mjs'
  };

  for (const [name, command] of Object.entries(expected)) {
    assert.equal(packageJson.scripts[name], command);
    assert.doesNotMatch(command, /wrangler|curl|deploy|D1_DATABASE|CLOUDFLARE|GEMINI|GMAIL|https?:\/\//i);
  }
  assert.match(packageJson.scripts['test:evidence-claim-workbench'], /official-evidence-document-bundle\.test\.mjs/);
  assert.match(packageJson.scripts['test:evidence-claim-workbench'], /official-evidence-review-patch\.test\.mjs/);
  assert.match(packageJson.scripts['test:evidence-claim-workbench'], /official-evidence-workbench-server\.test\.mjs/);
  assert.match(packageJson.scripts['test:evidence-claim-workbench'], /official-evidence-failure-injection\.test\.mjs/);
  assert.match(packageJson.scripts['test:evidence-claim-workbench'], /official-evidence-sensitivity\.test\.mjs/);
  assert.match(packageJson.scripts['demo:evidence-claim-workbench:real'], /^npm run test:evidence-claim-workbench && /);
  assert.doesNotMatch(packageJson.scripts['demo:evidence-claim-workbench:real'], /--intake-dir|--workspace|\/Users\//);
});

test('package exposes fixed local/test-only Candidate Review v2 commands', async () => {
  const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const expected = {
    'test:candidate-review-v2': 'node --test tests/official-evidence-candidate-review-v2-*.test.mjs',
    'eval:candidate-review-v2': 'node scripts/evaluate-candidate-review-v2.mjs --json --repeat 2',
    'check:candidate-review-v2': 'npm run test:candidate-review-v2 && npm run eval:candidate-review-v2',
    'prepare:candidate-review-v2:local': 'node scripts/prepare-candidate-review-v2.mjs',
    'validate:candidate-review-v2:local': 'node scripts/validate-candidate-review-v2.mjs',
    'verify:candidate-review-v2:aggregate-receipt': 'node scripts/verify-candidate-review-v2-aggregate-receipt.mjs'
  };

  for (const [name, command] of Object.entries(expected)) {
    assert.equal(packageJson.scripts[name], command);
    assert.doesNotMatch(
      command,
      /wrangler|curl|deploy|D1_DATABASE|CLOUDFLARE|GEMINI|GMAIL|https?:\/\/|--input|--output|--workspace|--root/i
    );
  }
});

test('CI runs network-free Workbench gates before full tests and browser E2E after Chromium install', async () => {
  const workflow = await readFile(path.join(root, '.github/workflows/ci.yml'), 'utf8');

  assert.match(
    workflow,
    /run:\s+npm run test:claim-spec-fit[\s\S]*run:\s+npm run audit:evidence-documents[\s\S]*run:\s+npm run eval:evidence-claim-workbench[\s\S]*run:\s+npm run check:candidate-review-v2[\s\S]*run:\s+npm run test:evidence-claim-workbench[\s\S]*run:\s+npm run measure:evidence-claim-workbench[\s\S]*run:\s+npm test/
  );
  assert.match(
    workflow,
    /run:\s+npx playwright install --with-deps chromium[\s\S]*run:\s+npm run test:e2e:local[\s\S]*run:\s+npm run test:evidence-claim-workbench:e2e/
  );
  assert.doesNotMatch(
    workflow,
    /evidence-inbox|REAL_DOCUMENT|--workspace|prepare:candidate-review-v2|validate:candidate-review-v2|verify:candidate-review-v2|aggregate-receipt|human-validation/i
  );
});

test('official-document inbox and mutable Workbench output stay ignored', async () => {
  const ignore = await readFile(path.join(root, '.gitignore'), 'utf8');
  assert.match(ignore, /^evidence-inbox\/$/m);
  assert.match(ignore, /^tmp\/evidence-claim-workbench\/$/m);
});

test('optional real-document intake template is exact-scope, non-production, and placeholder-only', async () => {
  const template = JSON.parse(await readFile(path.join(
    root,
    'docs/product/official-evidence-intake-manifest-template-v0.json'
  ), 'utf8'));
  assert.deepEqual(Object.keys(template), ['schemaVersion', 'boundary', 'productionReady', 'documents']);
  assert.equal(template.schemaVersion, 'official-evidence-intake-manifest-v0');
  assert.equal(template.boundary, 'NOT_PRODUCTION_EVIDENCE');
  assert.equal(template.productionReady, false);
  assert.equal(template.documents.length, 1);
  const [entry] = template.documents;
  assert.equal(entry.vertical, 'datacenter');
  assert.equal(entry.domain, 'electrical_power');
  assert.equal(entry.jurisdiction, 'KR');
  assert.ok(['ko', 'en'].includes(entry.language));
  assert.deepEqual(entry.productFamilies, ['medium_voltage_switchgear']);
  assert.equal(new URL(entry.sourceUrl).hostname.endsWith('.invalid'), true);
  assert.match(entry.publisher, /^REPLACE_/);
  assert.equal(Object.hasOwn(entry, 'expectedSha256'), false);
});
