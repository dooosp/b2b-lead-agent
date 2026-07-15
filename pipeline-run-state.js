const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PIPELINE_STATES = Object.freeze([
  'STARTED',
  'GENERATED',
  'VALIDATED',
  'PUBLISHED',
  'NOTIFIED',
]);

const PIPELINE_OUTCOMES = Object.freeze([
  'IN_PROGRESS',
  'NO_ARTICLES',
  'NO_CANDIDATES',
  'NO_VALID_LEADS',
  'NO_CHANGE',
  'READY_FOR_REMOTE_PUBLICATION',
  'PUBLISHED',
  'NOTIFIED',
  'NOTIFICATION_FAILED',
  'NOTIFICATION_PARTIAL',
  'NOTIFICATION_UNKNOWN',
  'FAILED',
]);

const STATE_RANK = new Map(PIPELINE_STATES.map((state, index) => [state, index]));

function isoNow(clock = () => new Date()) {
  const value = clock();
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function normalizeCorrelationId(value) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(normalized) ? normalized : null;
}

function createPipelineRun({
  profileId,
  requestId = null,
  attempt = null,
  operation = 'PIPELINE',
  notificationRequested = false,
  clock,
  runIdFactory = () => crypto.randomUUID(),
} = {}) {
  const now = isoNow(clock);
  return {
    schemaVersion: 1,
    runId: normalizeCorrelationId(runIdFactory()) || crypto.randomUUID(),
    requestId: normalizeCorrelationId(requestId),
    attempt: Number.isSafeInteger(attempt) && attempt > 0 ? attempt : null,
    profileId,
    operation,
    state: 'STARTED',
    outcome: 'IN_PROGRESS',
    terminal: false,
    startedAt: now,
    updatedAt: now,
    completedAt: null,
    counts: {
      articlesCollected: 0,
      candidatesGenerated: 0,
      leadsValidated: 0,
      leadsRejected: 0,
      artifactsPrepared: 0,
      artifactsPublished: 0,
    },
    publication: {
      requested: true,
      disposition: 'NONE',
      publicationId: null,
      inputDigest: null,
      previousPublicationId: null,
      localCommitted: false,
      manifestPath: null,
      artifactPaths: [],
      artifactCount: 0,
      commitSha: null,
      remoteRef: null,
      remotePublished: false,
      remoteVerifiedAt: null,
      publishedByThisRun: false,
    },
    notification: {
      requested: Boolean(notificationRequested),
      state: notificationRequested ? 'BLOCKED' : 'NOT_REQUESTED',
      notificationKey: null,
      messageId: null,
      intendedRecipientCount: 0,
      acceptedRecipientCount: 0,
      rejectedRecipientCount: 0,
      attempts: 0,
      retryable: null,
      retryRequiresExplicitCommand: true,
      deliveryGuarantee: 'PROVIDER_ACCEPTANCE_ONLY',
    },
    failure: null,
  };
}

function assertPipelineRun(result) {
  if (!result || result.schemaVersion !== 1 || !STATE_RANK.has(result.state)) {
    throw Object.assign(new Error('Pipeline run result is invalid.'), {
      code: 'ERR_PIPELINE_RESULT_INVALID',
    });
  }
  if (!PIPELINE_OUTCOMES.includes(result.outcome)) {
    throw Object.assign(new Error('Pipeline run outcome is invalid.'), {
      code: 'ERR_PIPELINE_RESULT_INVALID',
    });
  }
  return result;
}

function transitionPipelineRun(result, nextState, { clock } = {}) {
  assertPipelineRun(result);
  if (!STATE_RANK.has(nextState)) {
    throw Object.assign(new Error('Pipeline state transition is invalid.'), {
      code: 'ERR_PIPELINE_STATE_INVALID',
    });
  }
  const currentRank = STATE_RANK.get(result.state);
  const nextRank = STATE_RANK.get(nextState);
  if (nextRank !== currentRank + 1) {
    throw Object.assign(new Error('Pipeline state transition is not monotonic.'), {
      code: 'ERR_PIPELINE_STATE_TRANSITION',
    });
  }
  result.state = nextState;
  result.updatedAt = isoNow(clock);
  return result;
}

function completePipelineRun(result, outcome, { clock } = {}) {
  assertPipelineRun(result);
  if (outcome === 'IN_PROGRESS' || !PIPELINE_OUTCOMES.includes(outcome)) {
    throw Object.assign(new Error('Pipeline terminal outcome is invalid.'), {
      code: 'ERR_PIPELINE_OUTCOME_INVALID',
    });
  }
  const now = isoNow(clock);
  result.outcome = outcome;
  result.terminal = true;
  result.updatedAt = now;
  result.completedAt = now;
  return result;
}

function reopenPipelineRun(result, { clock } = {}) {
  assertPipelineRun(result);
  result.outcome = 'IN_PROGRESS';
  result.terminal = false;
  result.completedAt = null;
  result.updatedAt = isoNow(clock);
  result.failure = null;
  return result;
}

function failPipelineRun(result, {
  code = 'ERR_PIPELINE_FAILED',
  stage = 'pipeline',
  retryable = false,
  safeMessage = 'Pipeline execution failed.',
  outcome = 'FAILED',
  deliveryUnknown = false,
} = {}, { clock } = {}) {
  result.failure = {
    code,
    stage,
    retryable: retryable === null ? null : Boolean(retryable),
    safeMessage,
    deliveryUnknown: Boolean(deliveryUnknown),
  };
  return completePipelineRun(result, outcome, { clock });
}

function writePipelineRunResult(filePath, result, { fsImpl = fs } = {}) {
  assertPipelineRun(result);
  if (!filePath || typeof filePath !== 'string') return;
  const resolvedPath = path.resolve(filePath);
  fsImpl.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  const temporaryPath = `${resolvedPath}.tmp-${process.pid}-${crypto.randomBytes(6).toString('hex')}`;
  const payload = `${JSON.stringify(result, null, 2)}\n`;
  try {
    fsImpl.writeFileSync(temporaryPath, payload, { encoding: 'utf8', mode: 0o600 });
    fsImpl.renameSync(temporaryPath, resolvedPath);
  } catch (error) {
    try {
      fsImpl.rmSync(temporaryPath, { force: true });
    } catch {
      // Preserve the original result-write failure.
    }
    throw error;
  }
}

function readPipelineRunResult(filePath, { fsImpl = fs } = {}) {
  let result;
  try {
    result = JSON.parse(fsImpl.readFileSync(path.resolve(filePath), 'utf8'));
  } catch {
    throw Object.assign(new Error('Pipeline run result could not be read.'), {
      code: 'ERR_PIPELINE_RESULT_INVALID',
    });
  }
  return assertPipelineRun(result);
}

function exitCodeForPipelineRun(result) {
  assertPipelineRun(result);
  if (['FAILED', 'NO_VALID_LEADS', 'NOTIFICATION_FAILED', 'NOTIFICATION_PARTIAL', 'NOTIFICATION_UNKNOWN'].includes(result.outcome)) {
    return 1;
  }
  return 0;
}

module.exports = {
  PIPELINE_OUTCOMES,
  PIPELINE_STATES,
  assertPipelineRun,
  completePipelineRun,
  createPipelineRun,
  exitCodeForPipelineRun,
  failPipelineRun,
  normalizeCorrelationId,
  readPipelineRunResult,
  reopenPipelineRun,
  transitionPipelineRun,
  writePipelineRunResult,
};
