const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const LOCK_STALE_MS = 15 * 60 * 1000;

function ownerCanRecover(ownerPath, stalePath) {
  try {
    const owner = JSON.parse(fs.readFileSync(ownerPath, 'utf8'));
    if (Number.isSafeInteger(owner.pid) && owner.pid > 0) {
      try {
        process.kill(owner.pid, 0);
        return false;
      } catch (error) {
        return Boolean(error && error.code === 'ESRCH');
      }
    }
  } catch {
    // Missing or malformed ownership is recoverable only after the stale bound.
  }
  try {
    return Date.now() - fs.statSync(stalePath).mtimeMs >= LOCK_STALE_MS;
  } catch {
    return false;
  }
}

function lockCanRecover(lockPath) {
  return ownerCanRecover(path.join(lockPath, 'owner.json'), lockPath);
}

function createRecoveryClaim(claimPath, ownerId, createLockedError) {
  const payload = JSON.stringify({
    pid: process.pid,
    ownerId,
    createdAt: new Date().toISOString(),
  });
  try {
    fs.writeFileSync(claimPath, payload, { flag: 'wx', mode: 0o600 });
    return;
  } catch (error) {
    if (!error || error.code !== 'EEXIST' || !ownerCanRecover(claimPath, claimPath)) {
      throw createLockedError();
    }
  }
  try {
    fs.rmSync(claimPath);
    fs.writeFileSync(claimPath, payload, { flag: 'wx', mode: 0o600 });
  } catch {
    throw createLockedError();
  }
}

function acquireOwnedDirectoryLock(lockPath, {
  createLockedError,
  onRecoveryClaimed,
  recoveryAttempted = false,
}) {
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
      if (recoveryAttempted || !lockCanRecover(lockPath)) {
        throw createLockedError();
      }
      const claimPath = path.join(lockPath, '.recovery-claim');
      try {
        createRecoveryClaim(claimPath, ownerId, createLockedError);
      } catch {
        throw createLockedError();
      }
      try {
        if (onRecoveryClaimed) onRecoveryClaimed();
        if (!lockCanRecover(lockPath)) throw createLockedError();
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
      return acquireOwnedDirectoryLock(lockPath, {
        createLockedError,
        onRecoveryClaimed,
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

function releaseOwnedDirectoryLock(lockHandle) {
  if (!lockHandle) return;
  try {
    const owner = JSON.parse(fs.readFileSync(path.join(lockHandle.lockPath, 'owner.json'), 'utf8'));
    if (owner.ownerId !== lockHandle.ownerId) return;
    fs.rmSync(lockHandle.lockPath, { recursive: true, force: true });
  } catch {
    // The caller's result must not be reversed by best-effort lock cleanup.
  }
}

module.exports = { acquireOwnedDirectoryLock, releaseOwnedDirectoryLock };
