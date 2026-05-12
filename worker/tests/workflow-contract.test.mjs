import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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
