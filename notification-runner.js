const crypto = require('crypto');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const {
  completePipelineRun,
  failPipelineRun,
  readPipelineRunResult,
  reopenPipelineRun,
  transitionPipelineRun,
  writePipelineRunResult,
} = require('./pipeline-run-state');
const {
  createNotificationKey,
  normalizeRecipients,
  sendPublicationNotification,
} = require('./email-sender');
const {
  assertGitPublicationPaths,
  readPublicationFromCommit,
  runGit,
  verifyCommitReachableAtRemote,
} = require('./git-publication');

const NOTIFICATION_LOCK_STALE_MS = 15 * 60 * 1000;

function notificationLockCanRecover(lockPath) {
  try {
    const owner = JSON.parse(fs.readFileSync(path.join(lockPath, 'owner.json'), 'utf8'));
    if (Number.isSafeInteger(owner.pid) && owner.pid > 0) {
      try {
        process.kill(owner.pid, 0);
        return false;
      } catch (error) {
        return Boolean(error && error.code === 'ESRCH');
      }
    }
  } catch {
    // A malformed owner is recoverable only after the stale-time bound.
  }
  try {
    return Date.now() - fs.statSync(lockPath).mtimeMs >= NOTIFICATION_LOCK_STALE_MS;
  } catch {
    return false;
  }
}

function createNotificationLockedError() {
  return Object.assign(new Error('Another notification attempt holds the result lock.'), {
    code: 'ERR_NOTIFICATION_LOCKED',
    retryable: true,
  });
}

function notificationRecoveryClaimCanRecover(claimPath) {
  try {
    const claim = JSON.parse(fs.readFileSync(claimPath, 'utf8'));
    if (Number.isSafeInteger(claim.pid) && claim.pid > 0) {
      try {
        process.kill(claim.pid, 0);
        return false;
      } catch (error) {
        return Boolean(error && error.code === 'ESRCH');
      }
    }
  } catch {
    // A malformed claim is recoverable only after the stale-time bound.
  }
  try {
    return Date.now() - fs.statSync(claimPath).mtimeMs >= NOTIFICATION_LOCK_STALE_MS;
  } catch {
    return false;
  }
}

function createNotificationRecoveryClaim(claimPath, ownerId) {
  const payload = JSON.stringify({
    pid: process.pid,
    ownerId,
    createdAt: new Date().toISOString(),
  });
  try {
    fs.writeFileSync(claimPath, payload, { flag: 'wx', mode: 0o600 });
    return;
  } catch (error) {
    if (!error || error.code !== 'EEXIST' || !notificationRecoveryClaimCanRecover(claimPath)) {
      throw createNotificationLockedError();
    }
  }
  try {
    fs.rmSync(claimPath);
    fs.writeFileSync(claimPath, payload, { flag: 'wx', mode: 0o600 });
  } catch {
    throw createNotificationLockedError();
  }
}

function acquireNotificationLock(resultFile, {
  lockPath: explicitLockPath,
  recoveryAttempted = false,
} = {}) {
  const lockPath = explicitLockPath
    ? path.resolve(explicitLockPath)
    : `${path.resolve(resultFile)}.notification-lock`;
  const ownerId = crypto.randomBytes(16).toString('hex');
  let created = false;
  try {
    fs.mkdirSync(lockPath);
    created = true;
    fs.writeFileSync(path.join(lockPath, 'owner.json'), JSON.stringify({
      pid: process.pid,
      ownerId,
      createdAt: new Date().toISOString(),
    }), { mode: 0o600 });
  } catch (error) {
    if (error && error.code === 'EEXIST') {
      if (recoveryAttempted || !notificationLockCanRecover(lockPath)) {
        throw createNotificationLockedError();
      }
      const claimPath = path.join(lockPath, '.recovery-claim');
      try {
        createNotificationRecoveryClaim(claimPath, ownerId);
      } catch {
        throw createNotificationLockedError();
      }
      try {
        if (!notificationLockCanRecover(lockPath)) throw createNotificationLockedError();
        const quarantinePath = `${lockPath}.stale-${process.pid}-${ownerId}`;
        fs.renameSync(lockPath, quarantinePath);
        fs.rmSync(quarantinePath, { recursive: true, force: true });
      } catch (recoveryError) {
        try {
          fs.rmSync(claimPath, { force: true });
        } catch {
          // Preserve the lock recovery result.
        }
        throw recoveryError;
      }
      return acquireNotificationLock(resultFile, {
        lockPath,
        recoveryAttempted: true,
      });
    }
    if (created) {
      try {
        fs.rmSync(lockPath, { recursive: true, force: true });
      } catch {
        // Preserve the lock-owner persistence error.
      }
    }
    throw error;
  }
  return { lockPath, ownerId };
}

function resolveNotificationIdentityRoot(cwd) {
  const repositoryRoot = path.resolve(cwd || process.cwd());
  try {
    const gitCommonDirOutput = execFileSync('git', [
      'rev-parse',
      '--path-format=absolute',
      '--git-common-dir',
    ], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const gitCommonDir = fs.realpathSync(gitCommonDirOutput.trim());
    if (!fs.statSync(gitCommonDir).isDirectory()) {
      throw new Error('Git common directory is not a directory');
    }
    return path.join(gitCommonDir, 'b2b-lead-notification-locks');
  } catch (error) {
    throw Object.assign(new Error('Notification requires one canonical Git repository identity.'), {
      code: 'ERR_NOTIFICATION_REPOSITORY_IDENTITY_INVALID',
      cause: error,
    });
  }
}

function notificationIdentity(result) {
  const identity = {
    runId: result.runId,
    profileId: result.profileId,
    publicationId: result.publication.publicationId,
    commitSha: result.publication.commitSha,
  };
  const identityHash = crypto.createHash('sha256')
    .update(JSON.stringify(identity))
    .digest('hex');
  return { identity, identityHash };
}

function notificationIdentityPaths(result, cwd) {
  const { identity, identityHash } = notificationIdentity(result);
  const root = resolveNotificationIdentityRoot(cwd);
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  return {
    identity,
    identityHash,
    lockPath: path.join(root, `${identityHash}.lock`),
    acceptedPath: path.join(root, `${identityHash}.accepted.json`),
  };
}

function hasNotificationAcceptanceMarker(paths) {
  let marker;
  try {
    marker = JSON.parse(fs.readFileSync(paths.acceptedPath, 'utf8'));
  } catch (error) {
    if (error && error.code === 'ENOENT') return false;
    throw Object.assign(new Error('Notification acceptance marker is invalid.'), {
      code: 'ERR_NOTIFICATION_ACCEPTANCE_MARKER_INVALID',
    });
  }
  if (
    !marker
    || marker.schemaVersion !== 1
    || marker.identityHash !== paths.identityHash
    || marker.accepted !== true
    || JSON.stringify(marker.identity) !== JSON.stringify(paths.identity)
  ) {
    throw Object.assign(new Error('Notification acceptance marker is invalid.'), {
      code: 'ERR_NOTIFICATION_ACCEPTANCE_MARKER_INVALID',
    });
  }
  return true;
}

function writeNotificationAcceptanceMarker(paths) {
  if (hasNotificationAcceptanceMarker(paths)) return;
  const temporaryPath = `${paths.acceptedPath}.tmp-${process.pid}-${crypto.randomBytes(6).toString('hex')}`;
  const marker = {
    schemaVersion: 1,
    identityHash: paths.identityHash,
    identity: paths.identity,
    accepted: true,
    acceptedAt: new Date().toISOString(),
  };
  try {
    fs.writeFileSync(temporaryPath, `${JSON.stringify(marker, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
      flag: 'wx',
    });
    fs.renameSync(temporaryPath, paths.acceptedPath);
  } finally {
    fs.rmSync(temporaryPath, { force: true });
  }
}

function releaseNotificationLock(lockHandle) {
  if (!lockHandle) return;
  try {
    const owner = JSON.parse(fs.readFileSync(path.join(lockHandle.lockPath, 'owner.json'), 'utf8'));
    if (owner.ownerId !== lockHandle.ownerId) return;
    fs.rmSync(lockHandle.lockPath, { recursive: true, force: true });
  } catch {
    // The persisted notification result is authoritative over lock cleanup.
  }
}

function canonicalNotificationResultFile(resultFile) {
  try {
    const canonicalPath = fs.realpathSync(path.resolve(resultFile));
    const stat = fs.statSync(canonicalPath);
    if (!stat.isFile() || stat.nlink !== 1) throw new Error('aliased result file');
    return canonicalPath;
  } catch {
    throw Object.assign(new Error('Notification pipeline result file must be one unaliased regular file.'), {
      code: 'ERR_NOTIFICATION_RESULT_ALIASED',
    });
  }
}

function notificationOutcome(error) {
  if (error && error.acceptance === 'PARTIAL') return 'NOTIFICATION_PARTIAL';
  if (error && error.acceptance === 'UNKNOWN') return 'NOTIFICATION_UNKNOWN';
  return 'NOTIFICATION_FAILED';
}

function recordNotificationPreflightFailure(result, resultFile, error) {
  const code = /^ERR_[A-Z0-9_]+$/.test(error && error.code)
    ? error.code
    : 'ERR_NOTIFICATION_PREFLIGHT_FAILED';
  const preservePriorAcceptance = ['UNKNOWN', 'PARTIAL'].includes(result.notification.state)
    || result.notification.state === 'PENDING'
    && result.notification.attempts > 0;
  if (preservePriorAcceptance) {
    result.notification.lastPreflightFailureCode = code;
    result.notification.lastPreflightFailureAt = new Date().toISOString();
    writePipelineRunResult(resultFile, result);
    return Object.assign(new Error('Notification preflight validation failed.'), { code });
  }
  failPipelineRun(result, {
    code,
    stage: 'notification',
    retryable: false,
    safeMessage: 'Notification preflight validation failed.',
    outcome: 'NOTIFICATION_FAILED',
    deliveryUnknown: false,
    notificationPatch: {
      state: 'FAILED',
      acceptance: 'NOT_ATTEMPTED',
      retryable: false,
      recipientDeliveryConfirmed: false,
    },
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

async function verifyPublicationMatchesCommit(result, publication, { cwd, execFileImpl } = {}) {
  const artifactPaths = assertGitPublicationPaths(result, publication);
  for (const artifactPath of artifactPaths) {
    let stat;
    try {
      stat = fs.lstatSync(path.join(cwd, ...artifactPath.split('/')));
    } catch {
      return false;
    }
    if (!stat.isFile() || stat.isSymbolicLink()) return false;
    const tree = await runGit([
      'ls-tree',
      result.publication.commitSha,
      '--',
      artifactPath,
    ], { cwd, execFileImpl });
    const match = tree.stdout.trim().match(/^100\d{3} blob ([a-f0-9]+)\t/);
    if (!match) return false;
    const working = await runGit([
      'hash-object',
      '--no-filters',
      '--',
      artifactPath,
    ], { cwd, execFileImpl });
    if (working.stdout.trim() !== match[1]) return false;
  }
  return true;
}

async function notifyPublishedPipelineRunLocked({
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
  if (
    result.state === 'NOTIFIED'
    && result.outcome === 'NOTIFIED'
    && result.notification.state === 'ACCEPTED'
  ) {
    return { result, skipped: true, reason: 'ALREADY_NOTIFIED' };
  }
  if (
    !result.notification.requested
    || ['NO_ARTICLES', 'NO_CANDIDATES', 'NO_ARTIFACT_CHANGE', 'NO_CHANGE'].includes(result.outcome)
  ) {
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
    publication = await readPublicationFromCommit(result, { cwd, execFileImpl });
  } catch (error) {
    throw recordNotificationPreflightFailure(result, resultFile, {
      code: error && error.code === 'ERR_REMOTE_PUBLICATION_COMMIT_MISMATCH'
        ? 'ERR_NOTIFICATION_COMMIT_CONTENT_MISMATCH'
        : 'ERR_NOTIFICATION_PUBLICATION_INVALID',
    });
  }

  if (
    !profile
    || profile.id !== result.profileId
    || publication.manifest.profileId !== result.profileId
  ) {
    throw recordNotificationPreflightFailure(result, resultFile, {
      code: 'ERR_NOTIFICATION_PROFILE_MISMATCH',
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
  if (
    retryNotification
    && result.notification.notificationKey
    && result.notification.notificationKey !== notificationKey
  ) {
    throw recordNotificationPreflightFailure(result, resultFile, {
      code: 'ERR_NOTIFICATION_RECIPIENT_SET_CHANGED',
    });
  }
  const messageId = `<lead-report-${notificationKey.slice(0, 40)}@b2b-lead-agent.local>`;
  if (retryNotification) result.operation = 'NOTIFICATION_RETRY';
  reopenPipelineRun(result, {
    notificationAttempt: {
      notificationKey,
      messageId,
      intendedRecipientCount: recipients.length,
    },
  });
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
    const notificationState = error && error.acceptance === 'PARTIAL'
      ? 'PARTIAL'
      : error && error.acceptance === 'UNKNOWN'
        ? 'UNKNOWN'
        : 'FAILED';
    const acceptedRecipientCount = Number(error && error.acceptedRecipientCount) || 0;
    const rejectedRecipientCount = Number(error && error.rejectedRecipientCount) || 0;
    const retryable = error && Object.hasOwn(error, 'retryable') ? error.retryable : false;
    failPipelineRun(result, {
      code: /^ERR_NOTIFICATION_[A-Z0-9_]+$/.test(error && error.code)
        ? error.code
        : 'ERR_NOTIFICATION_FAILED',
      stage: 'notification',
      retryable,
      safeMessage: error && error.safeMessage || 'Notification provider did not confirm acceptance.',
      outcome,
      deliveryUnknown: outcome === 'NOTIFICATION_UNKNOWN',
      notificationPatch: {
        state: notificationState,
        acceptance: error && error.acceptance || 'NOT_ACCEPTED',
        acceptedRecipientCount,
        rejectedRecipientCount,
        retryable,
        recipientDeliveryConfirmed: false,
      },
    });
    writePipelineRunResult(resultFile, result);
    throw Object.assign(new Error(result.failure.safeMessage), { code: result.failure.code });
  }
  if (typeof faultInjector === 'function') faultInjector('notification:provider-accepted');
  transitionPipelineRun(result, 'NOTIFIED', {
    notificationPatch: {
      ...notification,
      state: 'ACCEPTED',
    },
  });
  completePipelineRun(result, 'NOTIFIED');
  writePipelineRunResult(resultFile, result);
  return { result, skipped: false };
}

async function notifyPublishedPipelineRun(options = {}) {
  if (!options.resultFile) {
    throw Object.assign(new Error('Notification requires a pipeline result file.'), {
      code: 'ERR_NOTIFICATION_RESULT_REQUIRED',
    });
  }
  const canonicalResultFile = canonicalNotificationResultFile(options.resultFile);
  const initialResult = readPipelineRunResult(canonicalResultFile);
  const identityPaths = notificationIdentityPaths(initialResult, options.cwd);
  const identityLock = acquireNotificationLock(canonicalResultFile, {
    lockPath: identityPaths.lockPath,
  });
  let pathLock = null;
  try {
    if (hasNotificationAcceptanceMarker(identityPaths)) {
      return { result: initialResult, skipped: true, reason: 'ALREADY_NOTIFIED' };
    }
    const recanonicalizedResultFile = canonicalNotificationResultFile(options.resultFile);
    pathLock = acquireNotificationLock(recanonicalizedResultFile);
    const canonicalOptions = { ...options, resultFile: recanonicalizedResultFile };
    const currentResult = readPipelineRunResult(recanonicalizedResultFile);
    const currentIdentityPaths = notificationIdentityPaths(currentResult, options.cwd);
    if (currentIdentityPaths.identityHash !== identityPaths.identityHash) {
      throw Object.assign(new Error('Notification result identity changed while acquiring its lock.'), {
        code: 'ERR_NOTIFICATION_RESULT_IDENTITY_CHANGED',
      });
    }
    const outcome = await notifyPublishedPipelineRunLocked(canonicalOptions);
    if (
      outcome.result.state === 'NOTIFIED'
      && outcome.result.outcome === 'NOTIFIED'
      && outcome.result.notification.state === 'ACCEPTED'
    ) {
      writeNotificationAcceptanceMarker(identityPaths);
    }
    return outcome;
  } finally {
    releaseNotificationLock(pathLock);
    releaseNotificationLock(identityLock);
  }
}

module.exports = {
  notificationOutcome,
  notifyPublishedPipelineRun,
  recordNotificationPreflightFailure,
  verifyPublicationMatchesCommit,
  verifyPublishedRemote,
};
