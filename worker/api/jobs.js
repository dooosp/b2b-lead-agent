import { jsonResponse } from '../lib/utils.js';
import {
  JOB_TARGETS,
  JOB_STATES,
  applyJobCallbackEvent,
  getJobRunByRequestId,
} from '../db/job-runs.js';
import { verifyJobCallbackRequest } from '../lib/job-trigger.js';

const JOB_EVENT_STATES = new Set([
  JOB_STATES.RUNNING,
  JOB_STATES.SUCCEEDED,
  JOB_STATES.FAILED,
  JOB_STATES.CANCELLED
]);

function normalizeNullableString(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeInteger(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isSafeInteger(num) ? num : null;
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function callbackError(code, message, status) {
  return jsonResponse({ success: false, code, message }, status);
}

export async function handleGetJob(requestId, env) {
  if (!env.DB) {
    return jsonResponse({ success: false, message: '시스템 설정이 필요합니다. 관리자에게 문의하세요.' }, 503);
  }

  const job = await getJobRunByRequestId(env.DB, requestId);
  if (!job) {
    return jsonResponse({ success: false, message: '요청한 작업을 찾을 수 없습니다.' }, 404);
  }

  return jsonResponse({ success: true, job });
}

export async function handleJobEvent(request, env, requestId) {
  if (!env.DB) {
    return jsonResponse({ success: false, message: '시스템 설정이 필요합니다. 관리자에게 문의하세요.' }, 503);
  }
  const auth = await verifyJobCallbackRequest(request, env, requestId);
  if (!auth.ok) {
    return jsonResponse({ success: false, message: auth.message }, auth.status);
  }

  const current = await getJobRunByRequestId(env.DB, requestId);
  if (!current) {
    return jsonResponse({ success: false, message: '요청한 작업을 찾을 수 없습니다.' }, 404);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return callbackError('JOB_CALLBACK_PAYLOAD_INVALID', '콜백 본문은 올바른 JSON 객체여야 합니다.', 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return callbackError('JOB_CALLBACK_PAYLOAD_INVALID', '콜백 본문은 JSON 객체여야 합니다.', 400);
  }
  const allowedBodyFields = new Set([
    'state', 'startedAt', 'completedAt', 'lastError',
    'githubRunId', 'githubRunAttempt', 'githubRunUrl', 'githubWorkflow', 'githubSha',
    'cloudRunOperation', 'cloudRunExecution', 'providerAttempt',
  ]);
  const unknownField = Object.keys(body).find((field) => !allowedBodyFields.has(field));
  if (unknownField) {
    return callbackError(
      'JOB_CALLBACK_PAYLOAD_INVALID',
      `지원하지 않는 콜백 필드입니다: ${unknownField}`,
      400
    );
  }
  const idempotencyKey = String(request.headers.get('Idempotency-Key') || '').trim();
  if (!idempotencyKey) {
    return callbackError(
      'JOB_CALLBACK_IDEMPOTENCY_REQUIRED',
      '작업 콜백에는 Idempotency-Key가 필요합니다.',
      428
    );
  }
  if (idempotencyKey.length > 200 || !/^[A-Za-z0-9._:-]+$/.test(idempotencyKey)) {
    return callbackError(
      'JOB_CALLBACK_IDEMPOTENCY_INVALID',
      'Idempotency-Key 형식이 올바르지 않습니다.',
      400
    );
  }
  const state = typeof body.state === 'string' ? body.state.trim() : '';
  if (!JOB_EVENT_STATES.has(state)) {
    return jsonResponse({ success: false, message: '유효하지 않은 작업 상태입니다.' }, 400);
  }

  const hasGitHubMetadata = body.githubRunId !== undefined
    || body.githubRunAttempt !== undefined
    || body.githubRunUrl !== undefined
    || body.githubWorkflow !== undefined
    || body.githubSha !== undefined;
  const hasCloudRunMetadata = body.cloudRunOperation !== undefined
    || body.cloudRunExecution !== undefined;

  if (current.target === JOB_TARGETS.GITHUB_ACTIONS && hasCloudRunMetadata) {
    return jsonResponse({ success: false, message: 'GitHub 작업에는 Cloud Run 메타데이터를 기록할 수 없습니다.' }, 400);
  }
  if (current.target === JOB_TARGETS.CLOUD_RUN && hasGitHubMetadata) {
    return jsonResponse({ success: false, message: 'Cloud Run 작업에는 GitHub 메타데이터를 기록할 수 없습니다.' }, 400);
  }
  if (current.target === JOB_TARGETS.GITHUB_ACTIONS && body.providerAttempt !== undefined) {
    return callbackError(
      'JOB_CALLBACK_PROVIDER_ATTEMPT_INVALID',
      'GitHub 콜백의 provider attempt는 githubRunAttempt로 지정해야 합니다.',
      400
    );
  }

  const githubRunId = normalizeInteger(body.githubRunId);
  const githubRunAttempt = normalizeInteger(body.githubRunAttempt);
  const cloudRunExecution = normalizeNullableString(body.cloudRunExecution);
  const providerAttempt = current.target === JOB_TARGETS.GITHUB_ACTIONS
    ? githubRunAttempt
    : normalizeInteger(body.providerAttempt);
  if (!providerAttempt || providerAttempt < 1) {
    return callbackError(
      'JOB_CALLBACK_PROVIDER_ATTEMPT_INVALID',
      '콜백에는 1 이상의 provider attempt가 필요합니다.',
      400
    );
  }
  if (current.target === JOB_TARGETS.GITHUB_ACTIONS && (!githubRunId || githubRunId < 1)) {
    return callbackError(
      'JOB_CALLBACK_PROVIDER_IDENTITY_INVALID',
      'GitHub 콜백에는 유효한 githubRunId가 필요합니다.',
      400
    );
  }
  if (current.target === JOB_TARGETS.CLOUD_RUN && !cloudRunExecution) {
    return callbackError(
      'JOB_CALLBACK_PROVIDER_IDENTITY_INVALID',
      'Cloud Run 콜백에는 cloudRunExecution이 필요합니다.',
      400
    );
  }

  const normalizedEvent = {
    state,
    providerAttempt,
    startedAt: normalizeNullableString(body.startedAt),
    completedAt: normalizeNullableString(body.completedAt),
    lastError: normalizeNullableString(body.lastError),
    githubRunId,
    githubRunAttempt,
    githubRunUrl: normalizeNullableString(body.githubRunUrl),
    githubWorkflow: normalizeNullableString(body.githubWorkflow),
    githubSha: normalizeNullableString(body.githubSha),
    cloudRunOperation: normalizeNullableString(body.cloudRunOperation),
    cloudRunExecution,
  };
  const payloadHash = await sha256Hex(JSON.stringify(normalizedEvent));
  const eventId = `job_callback_${await sha256Hex(`${requestId}\u0000${idempotencyKey}`)}`;

  const result = await applyJobCallbackEvent(env.DB, requestId, {
    eventId,
    idempotencyKey,
    payloadHash,
    target: current.target,
    ...normalizedEvent,
  });

  if (result.outcome === 'idempotency-mismatch') {
    return callbackError(
      'JOB_CALLBACK_IDEMPOTENCY_MISMATCH',
      '같은 Idempotency-Key가 다른 콜백 페이로드에 사용되었습니다.',
      409
    );
  }
  if (result.outcome === 'rejected') {
    return jsonResponse({
      success: false,
      code: 'JOB_CALLBACK_STALE_OR_NON_MONOTONIC',
      message: '오래되었거나 단조 상태 전이를 위반한 콜백입니다.',
      job: result.job,
    }, 409);
  }
  return jsonResponse({ success: true, outcome: result.outcome, job: result.job });
}
