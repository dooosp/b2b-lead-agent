import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAcceptedTriggerPayload, submitGenerateReport } from '../lib/job-trigger.js';

test('buildAcceptedTriggerPayload stays intake-only and does not synthesize completion fields', () => {
  const payload = buildAcceptedTriggerPayload('danfoss');

  assert.deepEqual(payload, {
    success: true,
    status: 'accepted',
    message: '[danfoss] 보고서 생성 요청이 접수되었습니다. 실행이 완료되면 이메일이 전송됩니다.'
  });
  assert.equal('execution' in payload, false);
  assert.equal('completedAt' in payload, false);
  assert.equal('completion' in payload, false);
});

test('submitGenerateReport dispatches to GitHub and keeps submission separate from completion', async () => {
  const calls = [];
  const fetchMock = async (url, init) => {
    calls.push({ url, init });
    return { status: 204 };
  };

  const result = await submitGenerateReport('danfoss', {
    GITHUB_REPO: 'owner/repo',
    GITHUB_TOKEN: 'secret-token'
  }, fetchMock);

  assert.deepEqual(result, { accepted: true, responseStatus: 204 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.github.com/repos/owner/repo/dispatches');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers.Authorization, 'token secret-token');

  const body = JSON.parse(calls[0].init.body);
  assert.deepEqual(body, {
    event_type: 'generate-report',
    client_payload: { profile: 'danfoss' }
  });
});

test('submitGenerateReport does not report acceptance when upstream dispatch is rejected', async () => {
  const result = await submitGenerateReport('danfoss', {
    GITHUB_REPO: 'owner/repo',
    GITHUB_TOKEN: 'secret-token'
  }, async () => ({ status: 503 }));

  assert.deepEqual(result, { accepted: false, responseStatus: 503 });
});
