import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workflowPath = path.resolve(__dirname, '../../.github/workflows/generate-report.yml');

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
