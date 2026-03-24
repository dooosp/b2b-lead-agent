import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';

import {
  buildCloudRunArgs,
  dispatchReportJob,
  resolveTriggerTarget,
} from '../lib/job-trigger.js';

function makeJsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('resolveTriggerTarget defaults to github-actions and recognizes cloud run aliases', () => {
  assert.equal(resolveTriggerTarget({}), 'github-actions');
  assert.equal(resolveTriggerTarget({ REPORT_TRIGGER_TARGET: 'cloud-run-job' }), 'cloud-run-job');
  assert.equal(resolveTriggerTarget({ REPORT_TRIGGER_TARGET: 'gcp-cloud-run-job' }), 'cloud-run-job');
});

test('buildCloudRunArgs preserves the existing CLI contract', () => {
  assert.deepEqual(buildCloudRunArgs({}, 'danfoss'), ['--profile', 'danfoss', '--email']);
  assert.deepEqual(buildCloudRunArgs({ CLOUD_RUN_JOB_SEND_EMAIL: 'false' }, 'siemens'), ['--profile', 'siemens']);
});

test('dispatchReportJob uses GitHub Actions by default', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];

  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, init });
    return new Response(null, { status: 204 });
  };

  try {
    const result = await dispatchReportJob({
      GITHUB_REPO: 'dooosp/b2b-lead-agent',
      GITHUB_TOKEN: 'test-token',
    }, 'danfoss');

    assert.equal(result.target, 'github-actions');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.github.com/repos/dooosp/b2b-lead-agent/dispatches');
    assert.equal(JSON.parse(calls[0].init.body).client_payload.profile, 'danfoss');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('dispatchReportJob can execute a Cloud Run Job with CLI args overrides', async () => {
  const originalFetch = globalThis.fetch;
  const { privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  const calls = [];

  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, init });

    if (url === 'https://oauth2.googleapis.com/token') {
      return makeJsonResponse({ access_token: 'gcp-token' });
    }

    if (url === 'https://run.googleapis.com/v2/projects/my-project/locations/asia-northeast3/jobs/lead-agent:run') {
      return makeJsonResponse({ name: 'projects/my-project/locations/asia-northeast3/operations/123' });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  };

  try {
    const result = await dispatchReportJob({
      REPORT_TRIGGER_TARGET: 'cloud-run-job',
      GCP_PROJECT_ID: 'my-project',
      GCP_REGION: 'asia-northeast3',
      CLOUD_RUN_JOB_NAME: 'lead-agent',
      GCP_CLIENT_EMAIL: 'job-trigger@my-project.iam.gserviceaccount.com',
      GCP_PRIVATE_KEY: privateKey,
    }, 'siemens');

    assert.equal(result.target, 'cloud-run-job');
    assert.equal(calls.length, 2);
    const requestBody = JSON.parse(calls[1].init.body);
    assert.deepEqual(requestBody.overrides.containerOverrides[0].args, ['--profile', 'siemens', '--email']);
    assert.deepEqual(requestBody.overrides.containerOverrides[0].env, [{ name: 'B2B_LOAD_DOTENV', value: '0' }]);
    assert.match(result.execution, /operations\/123$/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
