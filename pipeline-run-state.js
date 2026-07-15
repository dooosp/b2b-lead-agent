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
  'NO_ARTIFACT_CHANGE',
  // Accepted only so retained schema-v1 results from the first release remain readable.
  'NO_CHANGE',
  'RUN_REPLAY_REQUIRES_RESUME',
  'READY_FOR_REMOTE_PUBLICATION',
  'PUBLISHED',
  'NOTIFIED',
  'NOTIFICATION_FAILED',
  'NOTIFICATION_PARTIAL',
  'NOTIFICATION_UNKNOWN',
  'FAILED',
]);

const STATE_RANK = new Map(PIPELINE_STATES.map((state, index) => [state, index]));
const STATE_OUTCOMES = Object.freeze({
  STARTED: new Set(['IN_PROGRESS', 'NO_ARTICLES', 'FAILED']),
  GENERATED: new Set(['IN_PROGRESS', 'NO_CANDIDATES', 'FAILED']),
  VALIDATED: new Set([
    'IN_PROGRESS',
    'NO_VALID_LEADS',
    'NO_ARTIFACT_CHANGE',
    'NO_CHANGE',
    'RUN_REPLAY_REQUIRES_RESUME',
    'READY_FOR_REMOTE_PUBLICATION',
    'FAILED',
  ]),
  PUBLISHED: new Set([
    'IN_PROGRESS',
    'PUBLISHED',
    'NOTIFICATION_FAILED',
    'NOTIFICATION_PARTIAL',
    'NOTIFICATION_UNKNOWN',
  ]),
  // NOTIFIED/IN_PROGRESS exists only between the state transition and receipt completion.
  NOTIFIED: new Set(['IN_PROGRESS', 'NOTIFIED']),
});
const FAILURE_OUTCOMES = new Set([
  'FAILED',
  'NO_VALID_LEADS',
  'RUN_REPLAY_REQUIRES_RESUME',
  'NOTIFICATION_FAILED',
  'NOTIFICATION_PARTIAL',
  'NOTIFICATION_UNKNOWN',
]);

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
      acceptance: 'NOT_ATTEMPTED',
      retryable: null,
      recipientDeliveryConfirmed: false,
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
  const isInProgress = result.outcome === 'IN_PROGRESS';
  const hasValidFailure = Boolean(
    result.failure
    && /^ERR_[A-Z0-9_]+$/.test(result.failure.code || '')
    && typeof result.failure.stage === 'string'
    && typeof result.failure.safeMessage === 'string'
    && (typeof result.failure.retryable === 'boolean' || result.failure.retryable === null)
    && typeof result.failure.deliveryUnknown === 'boolean'
  );
  const stateRequiresRemote = result.state === 'PUBLISHED' || result.state === 'NOTIFIED';
  const remoteEvidenceValid = Boolean(
    result.publication
    && result.publication.remotePublished === true
    && /^[a-f0-9]{40}$/.test(result.publication.commitSha || '')
    && /^refs\/heads\/[A-Za-z0-9._/-]+$/.test(result.publication.remoteRef || '')
  );
  const notification = result.notification;
  const notificationCountsValid = Boolean(
    notification
    && ['intendedRecipientCount', 'acceptedRecipientCount', 'rejectedRecipientCount']
      .every((field) => Number.isSafeInteger(notification[field]) && notification[field] >= 0)
    && notification.acceptedRecipientCount + notification.rejectedRecipientCount
      <= notification.intendedRecipientCount
    && Number.isSafeInteger(notification.attempts)
    && notification.attempts >= 0
    && notification.retryRequiresExplicitCommand === true
    && notification.deliveryGuarantee === 'PROVIDER_ACCEPTANCE_ONLY'
    && notification.recipientDeliveryConfirmed === false
  );
  const hasNotificationAttemptIdentity = Boolean(
    notification
    && notification.attempts > 0
    && /^[a-f0-9]{64}$/.test(notification.notificationKey || '')
    && /^<lead-report-[a-f0-9]{40}@b2b-lead-agent\.local>$/.test(notification.messageId || '')
    && notification.messageId
      === `<lead-report-${notification.notificationKey.slice(0, 40)}@b2b-lead-agent.local>`
    && notification.intendedRecipientCount > 0
  );
  const hasNoNotificationAttempt = Boolean(
    notification
    && notification.attempts === 0
    && notification.notificationKey === null
    && notification.messageId === null
    && notification.intendedRecipientCount === 0
    && notification.acceptedRecipientCount === 0
    && notification.rejectedRecipientCount === 0
  );
  let notificationStateConsistent = notificationCountsValid;
  if (notificationStateConsistent && notification.requested === false) {
    notificationStateConsistent = notification.state === 'NOT_REQUESTED'
      && hasNoNotificationAttempt
      && notification.acceptance === 'NOT_ATTEMPTED'
      && notification.retryable === null
      && notification.recipientDeliveryConfirmed === false;
  } else if (notificationStateConsistent && notification.requested === true) {
    if (result.state === 'PUBLISHED') {
      const expectedState = {
        PUBLISHED: 'PENDING',
        IN_PROGRESS: 'PENDING',
        NOTIFICATION_FAILED: 'FAILED',
        NOTIFICATION_PARTIAL: 'PARTIAL',
        NOTIFICATION_UNKNOWN: 'UNKNOWN',
      }[result.outcome];
      notificationStateConsistent = notification.state === expectedState;
      if (result.outcome === 'PUBLISHED') {
        notificationStateConsistent = notificationStateConsistent
          && hasNoNotificationAttempt
          && notification.acceptance === 'NOT_ATTEMPTED'
          && notification.retryable === null
          && notification.recipientDeliveryConfirmed === false;
      } else if (result.outcome === 'IN_PROGRESS') {
        notificationStateConsistent = notificationStateConsistent
          && hasNotificationAttemptIdentity
          && notification.acceptance === 'UNKNOWN'
          && notification.retryable === null
          && notification.recipientDeliveryConfirmed === false;
      } else if (result.outcome === 'NOTIFICATION_FAILED') {
        notificationStateConsistent = notificationStateConsistent
          && (hasNoNotificationAttempt || hasNotificationAttemptIdentity)
          && ['NOT_ATTEMPTED', 'NOT_ACCEPTED'].includes(notification.acceptance)
          && typeof notification.retryable === 'boolean'
          && notification.recipientDeliveryConfirmed === false;
      } else if (result.outcome === 'NOTIFICATION_PARTIAL') {
        notificationStateConsistent = notificationStateConsistent
          && hasNotificationAttemptIdentity
          && notification.acceptance === 'PARTIAL'
          && notification.retryable === false
          && notification.recipientDeliveryConfirmed === false
          && notification.acceptedRecipientCount + notification.rejectedRecipientCount
            === notification.intendedRecipientCount;
      } else if (result.outcome === 'NOTIFICATION_UNKNOWN') {
        notificationStateConsistent = notificationStateConsistent
          && hasNotificationAttemptIdentity
          && notification.acceptance === 'UNKNOWN'
          && notification.retryable === null
          && notification.recipientDeliveryConfirmed === false;
      }
    } else if (result.state === 'NOTIFIED') {
      notificationStateConsistent = ['IN_PROGRESS', 'NOTIFIED'].includes(result.outcome)
        && notification.state === 'ACCEPTED'
        && hasNotificationAttemptIdentity
        && notification.acceptance === 'ACCEPTED'
        && notification.acceptedRecipientCount === notification.intendedRecipientCount
        && notification.rejectedRecipientCount === 0
        && notification.retryable === false
        && notification.recipientDeliveryConfirmed === false
        && notification.deliveryGuarantee === 'PROVIDER_ACCEPTANCE_ONLY';
    } else {
      notificationStateConsistent = notification.state === 'BLOCKED'
        && hasNoNotificationAttempt
        && notification.acceptance === 'NOT_ATTEMPTED'
        && notification.retryable === null
        && notification.recipientDeliveryConfirmed === false;
    }
  } else {
    notificationStateConsistent = false;
  }
  if (notificationStateConsistent && result.outcome === 'NOTIFICATION_UNKNOWN') {
    notificationStateConsistent = notification.retryable === null
      && hasValidFailure
      && result.failure.deliveryUnknown === true;
  }
  if (
    notificationStateConsistent
    && ['NOTIFICATION_FAILED', 'NOTIFICATION_PARTIAL'].includes(result.outcome)
  ) {
    notificationStateConsistent = hasValidFailure && result.failure.deliveryUnknown === false;
  }
  if (notificationStateConsistent && FAILURE_OUTCOMES.has(result.outcome) && result.outcome.startsWith('NOTIFICATION_')) {
    notificationStateConsistent = hasValidFailure
      && result.failure.stage === 'notification'
      && result.failure.retryable === notification.retryable;
  }
  if (
    !STATE_OUTCOMES[result.state].has(result.outcome)
    || typeof result.terminal !== 'boolean'
    || result.terminal !== !isInProgress
    || (isInProgress ? result.completedAt !== null : !isValidIsoTimestamp(result.completedAt))
    || (FAILURE_OUTCOMES.has(result.outcome) ? !hasValidFailure : result.failure !== null)
    || (stateRequiresRemote ? !remoteEvidenceValid : Boolean(result.publication && result.publication.remotePublished))
    || !notificationStateConsistent
    || (
      ['READY_FOR_REMOTE_PUBLICATION', 'NO_ARTIFACT_CHANGE', 'NO_CHANGE', 'RUN_REPLAY_REQUIRES_RESUME'].includes(result.outcome)
      && (!result.publication.localCommitted || !/^pub-[a-f0-9]{32}$/.test(result.publication.publicationId || ''))
    )
    || (
      result.state === 'NOTIFIED'
      && result.outcome === 'NOTIFIED'
      && (!result.notification || result.notification.state !== 'ACCEPTED')
    )
  ) {
    throw Object.assign(new Error('Pipeline run state and outcome are inconsistent.'), {
      code: 'ERR_PIPELINE_RESULT_INVALID',
    });
  }
  return result;
}

function isValidIsoTimestamp(value) {
  return typeof value === 'string'
    && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString() === value;
}

function transitionPipelineRun(result, nextState, { clock, notificationPatch = null } = {}) {
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
  if (notificationPatch) Object.assign(result.notification, notificationPatch);
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
  return assertPipelineRun(result);
}

function reopenPipelineRun(result, { clock, notificationAttempt = null } = {}) {
  assertPipelineRun(result);
  result.outcome = 'IN_PROGRESS';
  result.terminal = false;
  result.completedAt = null;
  result.updatedAt = isoNow(clock);
  result.failure = null;
  if (notificationAttempt) {
    result.notification.state = 'PENDING';
    result.notification.notificationKey = notificationAttempt.notificationKey;
    result.notification.messageId = notificationAttempt.messageId;
    result.notification.intendedRecipientCount = notificationAttempt.intendedRecipientCount;
    result.notification.acceptedRecipientCount = 0;
    result.notification.rejectedRecipientCount = 0;
    result.notification.attempts += 1;
    result.notification.acceptance = 'UNKNOWN';
    result.notification.retryable = null;
    result.notification.recipientDeliveryConfirmed = false;
  }
  return assertPipelineRun(result);
}

function failPipelineRun(result, {
  code = 'ERR_PIPELINE_FAILED',
  stage = 'pipeline',
  retryable = false,
  safeMessage = 'Pipeline execution failed.',
  outcome = 'FAILED',
  deliveryUnknown = false,
  notificationPatch = null,
} = {}, { clock } = {}) {
  assertPipelineRun(result);
  result.failure = {
    code,
    stage,
    retryable: retryable === null ? null : Boolean(retryable),
    safeMessage,
    deliveryUnknown: Boolean(deliveryUnknown),
  };
  if (notificationPatch) Object.assign(result.notification, notificationPatch);
  const now = isoNow(clock);
  result.outcome = outcome;
  result.terminal = true;
  result.updatedAt = now;
  result.completedAt = now;
  return assertPipelineRun(result);
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
  if (['FAILED', 'NO_VALID_LEADS', 'RUN_REPLAY_REQUIRES_RESUME', 'NOTIFICATION_FAILED', 'NOTIFICATION_PARTIAL', 'NOTIFICATION_UNKNOWN'].includes(result.outcome)) {
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
