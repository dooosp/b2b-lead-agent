import { jsonResponse } from '../lib/utils.js';
import {
  JOB_TARGETS,
  JOB_STATES,
  getJobRunByRequestId,
  updateJobRunState
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
  return Number.isFinite(num) ? num : null;
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

  const body = await request.json().catch(() => ({}));
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

  const updated = await updateJobRunState(env.DB, requestId, {
    state,
    startedAt: normalizeNullableString(body.startedAt),
    completedAt: normalizeNullableString(body.completedAt),
    lastError: normalizeNullableString(body.lastError),
    githubRunId: normalizeInteger(body.githubRunId),
    githubRunAttempt: normalizeInteger(body.githubRunAttempt),
    githubRunUrl: normalizeNullableString(body.githubRunUrl),
    githubWorkflow: normalizeNullableString(body.githubWorkflow),
    githubSha: normalizeNullableString(body.githubSha),
    cloudRunOperation: normalizeNullableString(body.cloudRunOperation),
    cloudRunExecution: normalizeNullableString(body.cloudRunExecution)
  });

  return jsonResponse({ success: true, job: updated });
}
