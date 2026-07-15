const path = require('path');
const {
  completePipelineRun,
  failPipelineRun,
  readPipelineRunResult,
  reopenPipelineRun,
  transitionPipelineRun,
  writePipelineRunResult,
} = require('./pipeline-run-state');
const { readCommittedPublication } = require('./lead-report-publisher');
const {
  createNotificationKey,
  normalizeRecipients,
  sendPublicationNotification,
} = require('./email-sender');
const { verifyCommitReachableAtRemote } = require('./git-publication');

function notificationOutcome(error) {
  if (error && error.acceptance === 'PARTIAL') return 'NOTIFICATION_PARTIAL';
  if (error && error.acceptance === 'UNKNOWN') return 'NOTIFICATION_UNKNOWN';
  return 'NOTIFICATION_FAILED';
}

function recordNotificationPreflightFailure(result, resultFile, error) {
  const code = /^ERR_[A-Z0-9_]+$/.test(error && error.code)
    ? error.code
    : 'ERR_NOTIFICATION_PREFLIGHT_FAILED';
  const priorAcceptanceUnknown = result.notification.state === 'PENDING'
    && result.notification.attempts > 0;
  result.notification.state = priorAcceptanceUnknown ? 'UNKNOWN' : 'FAILED';
  result.notification.retryable = priorAcceptanceUnknown ? null : false;
  failPipelineRun(result, {
    code,
    stage: 'notification',
    retryable: result.notification.retryable,
    safeMessage: 'Notification preflight validation failed.',
    outcome: priorAcceptanceUnknown ? 'NOTIFICATION_UNKNOWN' : 'NOTIFICATION_FAILED',
    deliveryUnknown: priorAcceptanceUnknown,
  });
  writePipelineRunResult(resultFile, result);
  return Object.assign(new Error(result.failure.safeMessage), { code });
}

async function verifyPublishedRemote(result, { cwd, remote = 'origin', execFileImpl } = {}) {
  if (
    !result.publication.remotePublished
    || !/^[a-f0-9]{40}$/.test(result.publication.commitSha || '')
    || !/^refs\/heads\/[A-Za-z0-9._/-]+$/.test(result.publication.remoteRef || '')
  ) {
    return false;
  }
  return verifyCommitReachableAtRemote({
    cwd,
    remote,
    remoteRef: result.publication.remoteRef,
    commitSha: result.publication.commitSha,
    execFileImpl,
  });
}

async function notifyPublishedPipelineRun({
  resultFile,
  profile,
  cwd = process.cwd(),
  remote = 'origin',
  reportsRoot,
  config = {},
  transporter = null,
  retryNotification = false,
  execFileImpl,
  faultInjector,
} = {}) {
  const result = readPipelineRunResult(resultFile);
  if (!result.notification.requested || ['NO_ARTICLES', 'NO_CANDIDATES', 'NO_CHANGE'].includes(result.outcome)) {
    return { result, skipped: true };
  }
  const retryOutcomes = new Set([
    'NOTIFICATION_FAILED',
    'NOTIFICATION_PARTIAL',
    'NOTIFICATION_UNKNOWN',
  ]);
  const pendingAcceptanceUnknown = result.state === 'PUBLISHED'
    && result.outcome === 'IN_PROGRESS'
    && result.notification.state === 'PENDING'
    && result.notification.attempts > 0
    && Boolean(result.notification.notificationKey)
    && Boolean(result.notification.messageId);
  if ((retryOutcomes.has(result.outcome) || pendingAcceptanceUnknown) && !retryNotification) {
    throw Object.assign(new Error('Notification retry requires an explicit retry command.'), {
      code: 'ERR_NOTIFICATION_RETRY_EXPLICIT_REQUIRED',
    });
  }
  if (
    result.state !== 'PUBLISHED'
    || (
      result.outcome !== 'PUBLISHED'
      && !retryOutcomes.has(result.outcome)
      && !pendingAcceptanceUnknown
    )
  ) {
    throw Object.assign(new Error('Notification is blocked until remote publication is verified.'), {
      code: 'ERR_NOTIFICATION_PUBLICATION_NOT_VERIFIED',
    });
  }
  let remoteVerified = false;
  try {
    remoteVerified = await verifyPublishedRemote(result, { cwd, remote, execFileImpl });
  } catch {
    remoteVerified = false;
  }
  if (!remoteVerified) {
    throw recordNotificationPreflightFailure(result, resultFile, {
      code: 'ERR_NOTIFICATION_REMOTE_VERIFY_FAILED',
    });
  }

  let publication;
  try {
    publication = readCommittedPublication(
      profile,
      { reportsRoot: reportsRoot || path.join(cwd, 'reports') },
    );
  } catch (error) {
    throw recordNotificationPreflightFailure(result, resultFile, error);
  }
  if (!publication || publication.manifest.publicationId !== result.publication.publicationId) {
    throw recordNotificationPreflightFailure(result, resultFile, {
      code: 'ERR_NOTIFICATION_PUBLICATION_INVALID',
    });
  }

  let recipients;
  try {
    recipients = normalizeRecipients(
      config.recipients || (profile && profile.emailRecipients) || process.env.GMAIL_RECIPIENT
    );
  } catch (error) {
    throw recordNotificationPreflightFailure(result, resultFile, error);
  }
  const notificationKey = createNotificationKey(publication.manifest.publicationId, recipients);
  const messageId = `<lead-report-${notificationKey.slice(0, 40)}@b2b-lead-agent.local>`;
  reopenPipelineRun(result);
  if (retryNotification) result.operation = 'NOTIFICATION_RETRY';
  result.notification.state = 'PENDING';
  result.notification.notificationKey = notificationKey;
  result.notification.messageId = messageId;
  result.notification.intendedRecipientCount = recipients.length;
  result.notification.acceptedRecipientCount = 0;
  result.notification.rejectedRecipientCount = 0;
  result.notification.attempts += 1;
  result.notification.retryable = null;
  writePipelineRunResult(resultFile, result);

  let notification;
  try {
    notification = await sendPublicationNotification({
      publication,
      profile,
      config: { ...config, recipients },
      transporter,
    });
  } catch (error) {
    const outcome = notificationOutcome(error);
    result.notification.state = error && error.acceptance === 'PARTIAL'
      ? 'PARTIAL'
      : error && error.acceptance === 'UNKNOWN'
        ? 'UNKNOWN'
        : 'FAILED';
    result.notification.acceptedRecipientCount = Number(error && error.acceptedRecipientCount) || 0;
    result.notification.rejectedRecipientCount = Number(error && error.rejectedRecipientCount) || 0;
    result.notification.retryable = error && Object.hasOwn(error, 'retryable') ? error.retryable : false;
    failPipelineRun(result, {
      code: /^ERR_NOTIFICATION_[A-Z0-9_]+$/.test(error && error.code)
        ? error.code
        : 'ERR_NOTIFICATION_FAILED',
      stage: 'notification',
      retryable: result.notification.retryable,
      safeMessage: error && error.safeMessage || 'Notification provider did not confirm acceptance.',
      outcome,
      deliveryUnknown: outcome === 'NOTIFICATION_UNKNOWN',
    });
    writePipelineRunResult(resultFile, result);
    throw Object.assign(new Error(result.failure.safeMessage), { code: result.failure.code });
  }
  if (typeof faultInjector === 'function') faultInjector('notification:provider-accepted');
  result.notification = {
    ...result.notification,
    ...notification,
    state: 'ACCEPTED',
  };
  transitionPipelineRun(result, 'NOTIFIED');
  completePipelineRun(result, 'NOTIFIED');
  writePipelineRunResult(resultFile, result);
  return { result, skipped: false };
}

module.exports = {
  notificationOutcome,
  notifyPublishedPipelineRun,
  recordNotificationPreflightFailure,
  verifyPublishedRemote,
};
