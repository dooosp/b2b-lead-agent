import { timingSafeCompare, verifyAuth } from './auth.js';
import {
  JOB_TARGETS,
  createAcceptedJobRun,
  markJobRunDispatchFailed
} from '../db/job-runs.js';

export const TRIGGER_EVENT_TYPE = 'generate-report';

const BODY_PASSWORD_DEPRECATION = 'Body password auth for /trigger is deprecated; use Authorization: Bearer.';
const DEFAULT_ACTIVE_RUN_TTL_SEC = 60 * 60;
const BODY_PASSWORD_TRANSITION_HINT = 'Body password auth for /trigger is disabled after API_TOKEN rollout. Set ALLOW_TRIGGER_BODY_PASSWORD=true temporarily or send Authorization: Bearer.';

export function createRequestId() {
  return `req_${crypto.randomUUID().replace(/-/g, '')}`;
}

export function normalizeIdempotencyKey(request) {
  const value = request.headers.get('Idempotency-Key');
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 200) : null;
}

export function shouldAllowBodyPasswordFallback(env) {
  if (typeof env.ALLOW_TRIGGER_BODY_PASSWORD === 'string' && env.ALLOW_TRIGGER_BODY_PASSWORD.trim()) {
    return env.ALLOW_TRIGGER_BODY_PASSWORD === 'true';
  }
  return !env.API_TOKEN;
}

export function getActiveRunTtlMs(env) {
  const raw = Number(env.ACTIVE_RUN_TTL_SEC);
  const seconds = Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_ACTIVE_RUN_TTL_SEC;
  return seconds * 1000;
}

function getJobCallbackSecret(env) {
  return env.JOB_STATUS_CALLBACK_SECRET || env.GITHUB_TOKEN || '';
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function createJobCallbackToken(env, requestId) {
  const secret = getJobCallbackSecret(env);
  if (!secret) {
    throw new Error('Missing callback signing secret.');
  }
  return sha256Hex(`${secret}:${requestId}`);
}

export async function verifyJobCallbackRequest(request, env, requestId) {
  const provided = (request.headers.get('X-Job-Callback-Token') || '').trim();
  if (!provided) {
    return { ok: false, status: 401, message: '작업 콜백 토큰이 필요합니다.' };
  }

  try {
    const expected = await createJobCallbackToken(env, requestId);
    const match = await timingSafeCompare(provided, expected);
    if (!match) {
      return { ok: false, status: 401, message: '작업 콜백 인증 실패' };
    }
    return { ok: true };
  } catch {
    return { ok: false, status: 503, message: '작업 콜백 인증 설정이 필요합니다.' };
  }
}

export async function authenticateTriggerRequest(request, env, body = {}) {
  const bearerError = await verifyAuth(request, env, { allowQueryToken: false });
  if (!bearerError) {
    return { ok: true, authMode: 'bearer', warning: null };
  }

  const bodyPassword = typeof body.password === 'string' ? body.password.trim() : '';
  const legacyBearer = request.headers.get('Authorization') || '';
  const legacyBearerToken = legacyBearer.startsWith('Bearer ') ? legacyBearer.slice(7).trim() : '';
  if (legacyBearerToken && env.TRIGGER_PASSWORD && await timingSafeCompare(legacyBearerToken, env.TRIGGER_PASSWORD)) {
    return { ok: true, authMode: 'bearer', warning: null };
  }
  if (
    shouldAllowBodyPasswordFallback(env) &&
    bodyPassword &&
    env.TRIGGER_PASSWORD &&
    await timingSafeCompare(bodyPassword, env.TRIGGER_PASSWORD)
  ) {
    return {
      ok: true,
      authMode: 'body-password',
      warning: BODY_PASSWORD_DEPRECATION
    };
  }

  if (bodyPassword && env.TRIGGER_PASSWORD && await timingSafeCompare(bodyPassword, env.TRIGGER_PASSWORD)) {
    return {
      ok: false,
      response: new Response(JSON.stringify({
        success: false,
        message: BODY_PASSWORD_TRANSITION_HINT
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      })
    };
  }

  return { ok: false, response: bearerError };
}

export function buildJobStatusUrl(request, requestId) {
  return new URL(`/api/jobs/${encodeURIComponent(requestId)}`, request.url).toString();
}

export function buildJobEventUrl(request, requestId) {
  return new URL(`/api/jobs/${encodeURIComponent(requestId)}/events`, request.url).toString();
}

export async function createOrReuseAcceptedTriggerRun(request, env, {
  profile,
  target = JOB_TARGETS.GITHUB_ACTIONS
}) {
  const requestId = createRequestId();
  const idempotencyKey = normalizeIdempotencyKey(request);
  return createAcceptedJobRun(env.DB, {
    requestId,
    profileId: profile,
    target,
    idempotencyKey,
    githubEventType: TRIGGER_EVENT_TYPE,
    activeTtlMs: getActiveRunTtlMs(env)
  });
}

export async function dispatchGitHubTrigger(request, env, job) {
  const statusUrl = buildJobStatusUrl(request, job.requestId);
  const eventUrl = buildJobEventUrl(request, job.requestId);
  const callbackToken = await createJobCallbackToken(env, job.requestId);

  const response = await fetch(
    `https://api.github.com/repos/${env.GITHUB_REPO}/dispatches`,
    {
      method: 'POST',
      headers: {
        'Authorization': `token ${env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'B2B-Lead-Worker'
      },
      body: JSON.stringify({
        event_type: TRIGGER_EVENT_TYPE,
        client_payload: {
          profile: job.profile,
          requestId: job.requestId,
          statusUrl,
          statusEventUrl: eventUrl,
          callbackToken
        }
      })
    }
  );

  if (response.status === 204) {
    return { ok: true, statusUrl };
  }

  const failure = `GitHub dispatch failed with status ${response.status}`;
  await markJobRunDispatchFailed(env.DB, job.requestId, failure);
  return { ok: false, statusUrl, error: failure, response };
}

export function buildTriggerAcceptedBody(job, {
  deduplicated = false,
  authMode = 'bearer',
  warning = null,
  statusUrl
} = {}) {
  const message = deduplicated
    ? `[${job.profile}] 이미 진행 중인 실행이 있어 기존 requestId를 반환합니다.`
    : `[${job.profile}] 보고서 생성이 접수되었습니다. 상태 엔드포인트에서 진행 상황을 확인하세요.`;

  const body = {
    success: true,
    status: 'accepted',
    requestId: job.requestId,
    profile: job.profile,
    state: job.state,
    target: job.target,
    deduplicated,
    statusUrl,
    message
  };

  if (warning) {
    body.warning = warning;
    body.authMode = authMode;
  }

  return body;
}
