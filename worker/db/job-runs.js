import { ensureD1Schema } from './schema.js';

export const JOB_STATES = Object.freeze({
  ACCEPTED: 'accepted',
  RUNNING: 'running',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
});

export const JOB_TARGETS = Object.freeze({
  GITHUB_ACTIONS: 'github-actions',
  CLOUD_RUN: 'cloud-run'
});

const TERMINAL_STATES = new Set([
  JOB_STATES.SUCCEEDED,
  JOB_STATES.FAILED,
  JOB_STATES.CANCELLED
]);
const ACTIVE_STATES = new Set([JOB_STATES.ACCEPTED, JOB_STATES.RUNNING]);

function isStateTransitionAllowed(currentState, nextState) {
  if (currentState === nextState) return true;
  if (!currentState) return true;
  if (currentState === JOB_STATES.ACCEPTED) {
    return nextState === JOB_STATES.RUNNING || TERMINAL_STATES.has(nextState);
  }
  if (currentState === JOB_STATES.RUNNING) {
    return TERMINAL_STATES.has(nextState);
  }
  return false;
}

function getActiveTimestamp(job) {
  return job?.startedAt || job?.acceptedAt || null;
}

function isJobStale(job, staleAfterMs, nowIso = new Date().toISOString()) {
  if (!job || !Number.isFinite(staleAfterMs) || staleAfterMs < 0) return false;
  const activeTimestamp = getActiveTimestamp(job);
  const activeAtMs = activeTimestamp ? Date.parse(activeTimestamp) : NaN;
  const nowMs = Date.parse(nowIso);
  if (!Number.isFinite(activeAtMs) || !Number.isFinite(nowMs)) return false;
  return (nowMs - activeAtMs) >= staleAfterMs;
}

function normalizeNullableString(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toJobRecord(row) {
  if (!row) return null;
  return {
    requestId: row.request_id,
    profile: row.profile_id,
    target: row.target,
    state: row.state,
    idempotencyKey: normalizeNullableString(row.idempotency_key),
    acceptedAt: row.accepted_at,
    startedAt: row.started_at || null,
    completedAt: row.completed_at || null,
    operation: row.cloud_run_operation || null,
    execution: row.cloud_run_execution || null,
    run: {
      id: row.github_run_id ?? null,
      attempt: row.github_run_attempt ?? null,
      url: row.github_run_url || null,
      workflow: row.github_workflow || null,
      sha: row.github_sha || null,
      eventType: row.github_event_type || null
    },
    providerAttempt: Number(row.provider_attempt || 0),
    lastError: row.last_error || null
  };
}

function isUniqueConstraintError(error) {
  return /unique/i.test(String(error?.message || ''));
}

async function firstRow(statement) {
  if (typeof statement.first === 'function') {
    return statement.first();
  }
  if (typeof statement.all === 'function') {
    const result = await statement.all();
    return result?.results?.[0] ?? null;
  }
  throw new Error('D1 statement does not support first() or all().');
}

async function getJobRunByColumn(db, column, value) {
  await ensureD1Schema(db);
  const row = await firstRow(
    db.prepare(`SELECT * FROM job_runs WHERE ${column} = ? LIMIT 1`).bind(value)
  );
  return toJobRecord(row);
}

export async function getJobRunByRequestId(db, requestId) {
  return getJobRunByColumn(db, 'request_id', requestId);
}

export async function getJobRunByIdempotencyKey(db, idempotencyKey) {
  const normalized = normalizeNullableString(idempotencyKey);
  if (!normalized) return null;
  return getJobRunByColumn(db, 'idempotency_key', normalized);
}

export async function getActiveJobRunByProfile(db, profileId) {
  await ensureD1Schema(db);
  const row = await firstRow(
    db.prepare(
      "SELECT * FROM job_runs WHERE profile_id = ? AND state IN ('accepted', 'running') ORDER BY accepted_at ASC LIMIT 1"
    ).bind(profileId)
  );
  return toJobRecord(row);
}

export async function createAcceptedJobRun(db, {
  requestId,
  profileId,
  target = JOB_TARGETS.GITHUB_ACTIONS,
  idempotencyKey = null,
  githubEventType = '',
  acceptedAt = new Date().toISOString(),
  activeTtlMs = null,
  retryOnStale = true
}) {
  await ensureD1Schema(db);

  const normalizedKey = normalizeNullableString(idempotencyKey);

  try {
    await db.prepare(`
      INSERT INTO job_runs (
        request_id,
        profile_id,
        target,
        state,
        idempotency_key,
        github_event_type,
        accepted_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      requestId,
      profileId,
      target,
      JOB_STATES.ACCEPTED,
      normalizedKey,
      githubEventType,
      acceptedAt,
      acceptedAt
    ).run();

    return {
      outcome: 'created',
      job: await getJobRunByRequestId(db, requestId)
    };
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;

    if (normalizedKey) {
      const existingByKey = await getJobRunByIdempotencyKey(db, normalizedKey);
      if (existingByKey) {
        return { outcome: 'existing-idempotency', job: existingByKey };
      }
    }

    const existingActive = await getActiveJobRunByProfile(db, profileId);
    if (existingActive) {
      if (retryOnStale && isJobStale(existingActive, activeTtlMs, acceptedAt)) {
        await updateJobRunState(db, existingActive.requestId, {
          state: JOB_STATES.FAILED,
          completedAt: acceptedAt,
          lastError: 'Active run lock expired before a terminal callback arrived.'
        });
        return createAcceptedJobRun(db, {
          requestId,
          profileId,
          target,
          idempotencyKey: normalizedKey,
          githubEventType,
          acceptedAt,
          activeTtlMs,
          retryOnStale: false
        });
      }
      return { outcome: 'existing-active', job: existingActive };
    }

    throw error;
  }
}

export async function updateJobRunState(db, requestId, {
  state,
  startedAt,
  completedAt,
  lastError,
  githubRunId,
  githubRunAttempt,
  githubRunUrl,
  githubWorkflow,
  githubSha,
  cloudRunOperation,
  cloudRunExecution
} = {}) {
  await ensureD1Schema(db);

  const current = await getJobRunByRequestId(db, requestId);
  if (!current) {
    return null;
  }
  if (!isStateTransitionAllowed(current.state, state)) {
    return current;
  }

  const now = new Date().toISOString();
  const nextStartedAt = state === JOB_STATES.RUNNING ? (startedAt || now) : (startedAt || null);
  const nextCompletedAt = TERMINAL_STATES.has(state) ? (completedAt || now) : null;
  const normalizedError = normalizeNullableString(lastError);

  const result = await db.prepare(`
    UPDATE job_runs
    SET
      state = ?,
      started_at = COALESCE(?, started_at),
      completed_at = ?,
      last_error = ?,
      github_run_id = COALESCE(?, github_run_id),
      github_run_attempt = COALESCE(?, github_run_attempt),
      github_run_url = COALESCE(NULLIF(?, ''), github_run_url),
      github_workflow = COALESCE(NULLIF(?, ''), github_workflow),
      github_sha = COALESCE(NULLIF(?, ''), github_sha),
      cloud_run_operation = COALESCE(NULLIF(?, ''), cloud_run_operation),
      cloud_run_execution = COALESCE(NULLIF(?, ''), cloud_run_execution),
      updated_at = ?
    WHERE request_id = ?
      AND state IN ('accepted', 'running')
  `).bind(
    state,
    nextStartedAt,
    nextCompletedAt,
    normalizedError || '',
    githubRunId ?? null,
    githubRunAttempt ?? null,
    githubRunUrl || '',
    githubWorkflow || '',
    githubSha || '',
    cloudRunOperation || '',
    cloudRunExecution || '',
    now,
    requestId
  ).run();

  if ((result?.meta?.changes ?? 0) === 0) {
    return current;
  }

  return getJobRunByRequestId(db, requestId);
}

async function getJobCallbackEvent(db, requestId, idempotencyKey) {
  return firstRow(
    db.prepare(
      'SELECT * FROM job_callback_events WHERE request_id = ? AND idempotency_key = ? LIMIT 1'
    ).bind(requestId, idempotencyKey)
  );
}

export async function applyJobCallbackEvent(db, requestId, {
  eventId,
  idempotencyKey,
  payloadHash,
  target,
  providerAttempt,
  state,
  receivedAt = new Date().toISOString(),
  startedAt,
  completedAt,
  lastError,
  githubRunId,
  githubRunAttempt,
  githubRunUrl,
  githubWorkflow,
  githubSha,
  cloudRunOperation,
  cloudRunExecution,
} = {}) {
  await ensureD1Schema(db);

  const existingEvent = await getJobCallbackEvent(db, requestId, idempotencyKey);
  if (existingEvent) {
    return {
      outcome: existingEvent.payload_hash !== payloadHash
        ? 'idempotency-mismatch'
        : (existingEvent.outcome === 'rejected' ? 'rejected' : 'replayed'),
      job: await getJobRunByRequestId(db, requestId),
    };
  }

  const now = receivedAt;
  const nextStartedAt = state === JOB_STATES.RUNNING ? (startedAt || now) : (startedAt || null);
  const nextCompletedAt = TERMINAL_STATES.has(state) ? (completedAt || now) : null;
  const normalizedError = normalizeNullableString(lastError);

  const [updateResult] = await db.batch([
    db.prepare(`
      UPDATE job_runs
      SET
        state = ?,
        started_at = CASE
          WHEN ? > provider_attempt THEN COALESCE(?, started_at)
          ELSE COALESCE(?, started_at)
        END,
        completed_at = ?,
        last_error = ?,
        github_run_id = COALESCE(?, github_run_id),
        github_run_attempt = COALESCE(?, github_run_attempt),
        github_run_url = CASE
          WHEN ? > provider_attempt THEN NULLIF(?, '')
          ELSE COALESCE(NULLIF(?, ''), github_run_url)
        END,
        github_workflow = CASE
          WHEN ? > provider_attempt THEN NULLIF(?, '')
          ELSE COALESCE(NULLIF(?, ''), github_workflow)
        END,
        github_sha = CASE
          WHEN ? > provider_attempt THEN NULLIF(?, '')
          ELSE COALESCE(NULLIF(?, ''), github_sha)
        END,
        cloud_run_operation = CASE
          WHEN ? > provider_attempt THEN NULLIF(?, '')
          ELSE COALESCE(NULLIF(?, ''), cloud_run_operation)
        END,
        cloud_run_execution = COALESCE(NULLIF(?, ''), cloud_run_execution),
        provider_attempt = ?,
        last_callback_event_id = ?,
        updated_at = ?
      WHERE request_id = ?
        AND state IN ('accepted', 'running')
        AND last_callback_event_id <> ?
        AND NOT EXISTS (
          SELECT 1 FROM job_callback_events
          WHERE request_id = ? AND idempotency_key = ?
        )
        AND (
          ? > provider_attempt
          OR (
            ? = provider_attempt
            AND (target <> 'github-actions' OR github_run_id IS NULL OR github_run_id = ?)
            AND (target <> 'cloud-run' OR cloud_run_execution = '' OR cloud_run_execution = ?)
            AND (
              state = 'accepted'
              OR (state = 'running' AND ? IN ('succeeded', 'failed', 'cancelled'))
            )
          )
        )
    `).bind(
      state,
      providerAttempt,
      nextStartedAt,
      nextStartedAt,
      nextCompletedAt,
      normalizedError || '',
      githubRunId ?? null,
      githubRunAttempt ?? null,
      providerAttempt,
      githubRunUrl || '',
      githubRunUrl || '',
      providerAttempt,
      githubWorkflow || '',
      githubWorkflow || '',
      providerAttempt,
      githubSha || '',
      githubSha || '',
      providerAttempt,
      cloudRunOperation || '',
      cloudRunOperation || '',
      cloudRunExecution || '',
      providerAttempt,
      eventId,
      now,
      requestId,
      eventId,
      requestId,
      idempotencyKey,
      providerAttempt,
      providerAttempt,
      githubRunId ?? null,
      cloudRunExecution || '',
      state
    ),
    db.prepare(`
      INSERT INTO job_callback_events (
        event_id, request_id, idempotency_key, payload_hash, target,
        provider_attempt, state, outcome, received_at
      )
      SELECT ?, ?, ?, ?, ?, ?, ?,
        CASE WHEN EXISTS (
          SELECT 1 FROM job_runs
          WHERE request_id = ? AND last_callback_event_id = ?
        ) THEN 'applied' ELSE 'rejected' END,
        ?
      ON CONFLICT DO NOTHING
    `).bind(
      eventId,
      requestId,
      idempotencyKey,
      payloadHash,
      target,
      providerAttempt,
      state,
      requestId,
      eventId,
      now
    ),
  ]);

  const storedEvent = await getJobCallbackEvent(db, requestId, idempotencyKey);
  const job = await getJobRunByRequestId(db, requestId);
  if (storedEvent) {
    return {
      outcome: storedEvent.payload_hash !== payloadHash
        ? 'idempotency-mismatch'
        : (storedEvent.outcome === 'rejected'
          ? 'rejected'
          : ((updateResult?.meta?.changes ?? 0) > 0 ? 'applied' : 'replayed')),
      job,
    };
  }
  return {
    outcome: (updateResult?.meta?.changes ?? 0) > 0 ? 'applied' : 'rejected',
    job,
  };
}

export async function markJobRunDispatchFailed(db, requestId, lastError) {
  return updateJobRunState(db, requestId, {
    state: JOB_STATES.FAILED,
    completedAt: new Date().toISOString(),
    lastError
  });
}
