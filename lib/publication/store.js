// Filesystem boundary: legacy writes, authoritative reads, locks and atomic recovery.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { acquireOwnedDirectoryLock, releaseOwnedDirectoryLock } = require('../owned-directory-lock');
const {
  ARTIFACT_NAMES, LEGACY_PUBLICATION_SCHEMA_VERSION, PUBLICATION_SCHEMA_VERSION,
  PUBLICATION_ARTIFACT_KINDS, PUBLICATION_LOCK_NAME, normalizeProfileId, sha256,
} = require('./contract');
const {
  createInvalidHistoryError, assertLegacyHistoryRecord, prepareLeadSnapshotRecords, mergeLeadHistory,
} = require('./lead-records');
const { assertPublicationManifest } = require('./manifest');

// Preserve the canonical entrypoint's repository-relative default after extraction.
const DEFAULT_REPORTS_ROOT = path.join(__dirname, '..', '..', 'reports');
function getProfileReportsDir(profile, { reportsRoot = DEFAULT_REPORTS_ROOT } = {}) {
  const dir = path.join(reportsRoot, normalizeProfileId(profile));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function saveLeadReport(report, profile, options = {}) {
  const reportsDir = getProfileReportsDir(profile, options);
  assertLegacyPublicationWriterAllowed(reportsDir);
  const canonicalPath = path.join(reportsDir, ARTIFACT_NAMES.markdownCanonical(report.dateStr));

  fs.writeFileSync(canonicalPath, report.content, 'utf-8');

  console.log(`  리포트 저장: ${canonicalPath}`);
  console.log('');

  return canonicalPath;
}

function readLeadHistoryOrThrow(historyPath) {
  let serializedHistory;
  try {
    serializedHistory = fs.readFileSync(historyPath, 'utf-8');
  } catch (error) {
    if (error && error.code === 'ENOENT') return [];
    throw error;
  }

  let history;
  try {
    history = JSON.parse(serializedHistory);
  } catch {
    throw createInvalidHistoryError();
  }
  if (!Array.isArray(history)) throw createInvalidHistoryError();
  return history.map(assertLegacyHistoryRecord);
}

function saveLeadSnapshot(leads, profile, options = {}) {
  const reportsDir = getProfileReportsDir(profile, options);
  assertLegacyPublicationWriterAllowed(reportsDir);
  const now = options.now || new Date().toISOString();
  const historyCanonicalPath = path.join(reportsDir, ARTIFACT_NAMES.historyCanonical);
  const history = Object.hasOwn(options, 'history')
    ? options.history
    : readLeadHistoryOrThrow(historyCanonicalPath);
  if (!Array.isArray(history)) throw createInvalidHistoryError();

  // 각 리드에 ID, 상태, 생성일 추가
  const enrichedLeads = prepareLeadSnapshotRecords(leads, {
    now,
    profileId: profile && profile.id,
    staleAfterDays: options.staleAfterDays,
  });

  const mergedHistory = mergeLeadHistory(history, leads, {
    now,
    profileId: profile && profile.id,
    staleAfterDays: options.staleAfterDays,
  });

  // 최신 리드 저장
  const latestCanonicalPath = path.join(reportsDir, ARTIFACT_NAMES.latestCanonical);
  const latestPayload = JSON.stringify(enrichedLeads, null, 2);
  const historyPayload = JSON.stringify(mergedHistory, null, 2);
  fs.writeFileSync(latestCanonicalPath, latestPayload, 'utf-8');
  console.log(`  리드 JSON 저장: ${latestCanonicalPath}`);

  // 히스토리에 추가 (기존 데이터 유지)
  fs.writeFileSync(historyCanonicalPath, historyPayload, 'utf-8');
  console.log(`  히스토리 저장: ${historyCanonicalPath} (총 ${mergedHistory.length}개 리드)`);
  console.log('');

  return latestCanonicalPath;
}

function assertLegacyPublicationWriterAllowed(reportsDir) {
  if (fs.existsSync(path.join(reportsDir, ARTIFACT_NAMES.manifestCanonical))) {
    throw Object.assign(new Error('Manifest-backed publications require the atomic publication transaction.'), {
      code: 'ERR_PUBLICATION_MANAGED_WRITER_REQUIRED',
    });
  }
}

function readManifestOrNull(manifestPath, profile) {
  let serialized;
  try {
    serialized = fs.readFileSync(manifestPath, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') return null;
    throw error;
  }
  if (Buffer.byteLength(serialized, 'utf8') > 64 * 1024) {
    throw Object.assign(new Error('Publication manifest exceeds its size limit.'), {
      code: 'ERR_PUBLICATION_MANIFEST_INVALID',
    });
  }
  try {
    return assertPublicationManifest(JSON.parse(serialized), profile);
  } catch (error) {
    if (error && error.code === 'ERR_PUBLICATION_MANIFEST_INVALID') throw error;
    throw Object.assign(new Error('Publication manifest is invalid.'), {
      code: 'ERR_PUBLICATION_MANIFEST_INVALID',
    });
  }
}

function readCommittedPublication(profile, options = {}) {
  const reportsRoot = options.reportsRoot || DEFAULT_REPORTS_ROOT;
  const reportsDir = path.join(reportsRoot, normalizeProfileId(profile));
  const manifestPath = path.join(reportsDir, ARTIFACT_NAMES.manifestCanonical);
  const manifest = readManifestOrNull(manifestPath, profile);
  if (!manifest) return null;
  if (manifest.schemaVersion === PUBLICATION_SCHEMA_VERSION) {
    try {
      const pointerPayload = fs.readFileSync(manifestPath);
      const generationManifestPayload = fs.readFileSync(path.join(
        reportsDir,
        'publications',
        manifest.publicationId,
        ARTIFACT_NAMES.manifestCanonical,
      ));
      if (!pointerPayload.equals(generationManifestPayload)) throw new Error('manifest copies differ');
    } catch {
      throw Object.assign(new Error('Publication generation manifest is unavailable or inconsistent.'), {
        code: 'ERR_PUBLICATION_MANIFEST_INVALID',
      });
    }
  }

  const buffers = {};
  for (const kind of PUBLICATION_ARTIFACT_KINDS) {
    const descriptor = manifest.artifacts[kind];
    const artifactPath = path.join(reportsDir, ...descriptor.path.split('/'));
    let buffer;
    try {
      const stat = fs.lstatSync(artifactPath);
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('not a regular file');
      buffer = fs.readFileSync(artifactPath);
    } catch {
      throw Object.assign(new Error('Committed publication artifact is unavailable.'), {
        code: 'ERR_PUBLICATION_ARTIFACT_INVALID',
      });
    }
    if (buffer.byteLength !== descriptor.bytes || sha256(buffer) !== descriptor.sha256) {
      throw Object.assign(new Error('Committed publication artifact checksum failed.'), {
        code: 'ERR_PUBLICATION_ARTIFACT_INVALID',
      });
    }
    buffers[kind] = buffer;
  }

  let latest;
  let history;
  try {
    latest = JSON.parse(buffers.latest.toString('utf8'));
    history = JSON.parse(buffers.history.toString('utf8'));
  } catch {
    throw Object.assign(new Error('Committed publication JSON is invalid.'), {
      code: 'ERR_PUBLICATION_ARTIFACT_INVALID',
    });
  }
  if (!Array.isArray(latest) || !Array.isArray(history)) {
    throw Object.assign(new Error('Committed publication JSON shape is invalid.'), {
      code: 'ERR_PUBLICATION_ARTIFACT_INVALID',
    });
  }

  const compatibilityIntact = PUBLICATION_ARTIFACT_KINDS.every((kind) => {
    const descriptor = manifest.artifacts[kind];
    try {
      const canonical = fs.readFileSync(path.join(reportsDir, descriptor.canonicalPath));
      return canonical.byteLength === descriptor.bytes && sha256(canonical) === descriptor.sha256;
    } catch {
      return false;
    }
  });

  return {
    manifest,
    manifestPath,
    reportsDir,
    buffers,
    latest,
    history,
    report: buffers.report.toString('utf8'),
    compatibilityIntact,
  };
}

function findHistoricalRunManifest(committed, runId) {
  if (!committed) return null;
  const seen = new Set();
  let manifest = committed.manifest;
  for (let depth = 0; manifest && depth < 10000; depth += 1) {
    if (seen.has(manifest.publicationId)) {
      throw Object.assign(new Error('Publication manifest history contains a cycle.'), {
        code: 'ERR_PUBLICATION_MANIFEST_INVALID',
      });
    }
    seen.add(manifest.publicationId);
    if (manifest.schemaVersion === PUBLICATION_SCHEMA_VERSION) {
      if (manifest.runId === runId) return manifest;
      if (manifest.previousPublicationId === null) return null;
      if (manifest.previousManifestSchemaVersion === LEGACY_PUBLICATION_SCHEMA_VERSION) return null;
      const previousPath = path.join(
        committed.reportsDir,
        'publications',
        manifest.previousPublicationId,
        ARTIFACT_NAMES.manifestCanonical,
      );
      const previous = readManifestOrNull(previousPath, { id: manifest.profileId });
      if (!previous || previous.publicationId !== manifest.previousPublicationId) {
        throw Object.assign(new Error('Publication manifest history is incomplete.'), {
          code: 'ERR_PUBLICATION_MANIFEST_INVALID',
        });
      }
      manifest = previous;
      continue;
    }
    return null;
  }
  if (manifest) {
    throw Object.assign(new Error('Publication manifest history exceeds its traversal limit.'), {
      code: 'ERR_PUBLICATION_MANIFEST_INVALID',
    });
  }
  return null;
}

function callPublicationFault(faultInjector, operation) {
  if (typeof faultInjector === 'function') faultInjector(operation);
}

function syncFile(filePath) {
  const fd = fs.openSync(filePath, 'r');
  try {
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

function syncDirectory(dirPath) {
  let fd;
  try {
    fd = fs.openSync(dirPath, 'r');
    fs.fsyncSync(fd);
  } catch (error) {
    if (!['EINVAL', 'ENOTSUP', 'EISDIR'].includes(error && error.code)) throw error;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

function writeStagedFile(filePath, payload, operation, faultInjector) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, payload, { mode: 0o600 });
  callPublicationFault(faultInjector, `${operation}:write`);
  syncFile(filePath);
  callPublicationFault(faultInjector, `${operation}:sync`);
}

function atomicReplaceFile(filePath, payload, operation, faultInjector, { onRename = null } = {}) {
  const temporaryPath = `${filePath}.tmp-${process.pid}-${crypto.randomBytes(6).toString('hex')}`;
  try {
    fs.writeFileSync(temporaryPath, payload, { mode: 0o600 });
    callPublicationFault(faultInjector, `${operation}:write`);
    syncFile(temporaryPath);
    callPublicationFault(faultInjector, `${operation}:sync`);
    callPublicationFault(faultInjector, `${operation}:before-rename`);
    fs.renameSync(temporaryPath, filePath);
    if (typeof onRename === 'function') onRename();
    callPublicationFault(faultInjector, `${operation}:rename`);
    syncDirectory(path.dirname(filePath));
    callPublicationFault(faultInjector, `${operation}:sync-directory`);
  } catch (error) {
    try {
      fs.rmSync(temporaryPath, { force: true });
    } catch {
      // Preserve the original atomic-replacement error.
    }
    throw error;
  }
}

function snapshotFiles(paths) {
  return new Map(paths.map((filePath) => {
    try {
      return [filePath, { exists: true, payload: fs.readFileSync(filePath) }];
    } catch (error) {
      if (error && error.code === 'ENOENT') return [filePath, { exists: false, payload: null }];
      throw error;
    }
  }));
}

function restoreFileSnapshots(snapshots) {
  for (const [filePath, snapshot] of snapshots) {
    if (snapshot.exists) {
      atomicReplaceFile(filePath, snapshot.payload, 'rollback', null);
    } else {
      fs.rmSync(filePath, { force: true });
    }
  }
}

function authoritativeCompatibilitySnapshots(reportsDir, targetManifest, committed) {
  return new Map(PUBLICATION_ARTIFACT_KINDS.map((kind) => {
    const targetPath = path.join(reportsDir, targetManifest.artifacts[kind].canonicalPath);
    if (
      committed
      && committed.manifest.artifacts[kind].canonicalPath === targetManifest.artifacts[kind].canonicalPath
    ) {
      return [targetPath, { exists: true, payload: committed.buffers[kind] }];
    }
    try {
      return [targetPath, { exists: true, payload: fs.readFileSync(targetPath) }];
    } catch (error) {
      if (error && error.code === 'ENOENT') return [targetPath, { exists: false, payload: null }];
      throw error;
    }
  }));
}

function createPublicationLockedError() {
  return Object.assign(new Error('Another local publication holds the profile lock.'), {
    code: 'ERR_PUBLICATION_LOCKED',
    retryable: true,
  });
}

function acquirePublicationLock(reportsDir, { faultInjector } = {}) {
  return acquireOwnedDirectoryLock(path.join(reportsDir, PUBLICATION_LOCK_NAME), {
    createLockedError: createPublicationLockedError,
    onRecoveryClaimed: () => callPublicationFault(faultInjector, 'lock:recovery-claimed'),
  });
}

function generationMatchesPrepared(generationDir, prepared) {
  try {
    const artifactsMatch = PUBLICATION_ARTIFACT_KINDS.every((kind) => {
      const descriptor = prepared.manifest.artifacts[kind];
      const artifactPath = path.join(generationDir, path.basename(descriptor.path));
      const stat = fs.lstatSync(artifactPath);
      if (!stat.isFile() || stat.isSymbolicLink()) return false;
      const buffer = fs.readFileSync(artifactPath);
      return buffer.byteLength === descriptor.bytes && sha256(buffer) === descriptor.sha256;
    });
    if (!artifactsMatch) return false;
    const generationManifest = fs.readFileSync(
      path.join(generationDir, ARTIFACT_NAMES.manifestCanonical),
    );
    return generationManifest.equals(prepared.manifestPayload);
  } catch {
    return false;
  }
}

function releasePublicationLock(lockHandle) {
  if (!lockHandle || !lockHandle.lockPath || !lockHandle.ownerId) return;
  releaseOwnedDirectoryLock(lockHandle);
}

function cleanupAbandonedPublicationTransactions(reportsDir) {
  for (const entry of fs.readdirSync(reportsDir, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name.startsWith('.publication-txn-')) {
      fs.rmSync(path.join(reportsDir, entry.name), { recursive: true, force: true });
    }
  }
}

function repairPublicationCompatibilityMirrors(profile, options = {}) {
  const reportsRoot = options.reportsRoot || DEFAULT_REPORTS_ROOT;
  const reportsDir = path.join(reportsRoot, normalizeProfileId(profile));
  const lockHandle = acquirePublicationLock(reportsDir, { faultInjector: options.faultInjector });
  try {
    const committed = readCommittedPublication(profile, options);
    if (!committed || committed.compatibilityIntact) return false;
    for (const kind of PUBLICATION_ARTIFACT_KINDS) {
      atomicReplaceFile(
        path.join(committed.reportsDir, committed.manifest.artifacts[kind].canonicalPath),
        committed.buffers[kind],
        `repair:${kind}`,
        options.faultInjector,
      );
    }
    const repaired = readCommittedPublication(profile, options);
    if (!repaired || !repaired.compatibilityIntact) {
      throw Object.assign(new Error('Compatibility mirror repair could not be verified.'), {
        code: 'ERR_PUBLICATION_REPAIR_FAILED',
      });
    }
    return true;
  } finally {
    releasePublicationLock(lockHandle);
  }
}

function localPublicationCommitResult(prepared, reportsDir) {
  return {
    reportsDir,
    reportPath: path.join(reportsDir, prepared.manifest.artifacts.report.canonicalPath),
    latestLeadsPath: path.join(reportsDir, ARTIFACT_NAMES.latestCanonical),
    historyPath: path.join(reportsDir, ARTIFACT_NAMES.historyCanonical),
    manifestPath: path.join(reportsDir, ARTIFACT_NAMES.manifestCanonical),
    publicationId: prepared.publicationId,
    inputDigest: prepared.inputDigest,
    artifactCount: prepared.artifactCount,
    artifactPaths: prepared.artifactPaths,
    localCommitted: true,
  };
}

function commitLeadPublication(prepared, profile, options = {}) {
  if (!prepared || prepared.noChange || !prepared.manifest || !prepared.payloads) {
    throw Object.assign(new Error('Prepared publication is not commit-ready.'), {
      code: 'ERR_PUBLICATION_NOT_PREPARED',
    });
  }
  const reportsDir = prepared.reportsDir;
  fs.mkdirSync(reportsDir, { recursive: true });
  fs.mkdirSync(path.join(reportsDir, 'publications'), { recursive: true });
  const lockHandle = acquirePublicationLock(reportsDir, { faultInjector: options.faultInjector });
  let transactionDir = null;
  let generationStageDir = null;
  const generationFinalDir = path.join(reportsDir, 'publications', prepared.publicationId);
  let generationCreated = false;
  let pointerCommitted = false;
  let snapshots = null;

  try {
    cleanupAbandonedPublicationTransactions(reportsDir);
    transactionDir = fs.mkdtempSync(path.join(reportsDir, '.publication-txn-'));
    generationStageDir = path.join(transactionDir, prepared.publicationId);
    callPublicationFault(options.faultInjector, 'lock:acquired');
    const currentManifest = readManifestOrNull(
      path.join(reportsDir, ARTIFACT_NAMES.manifestCanonical),
      profile,
    );
    if ((currentManifest && currentManifest.publicationId) !== prepared.previousPublicationId) {
      throw Object.assign(new Error('Publication base changed before local commit.'), {
        code: 'ERR_PUBLICATION_BASE_CHANGED',
        retryable: true,
      });
    }
    const currentCommitted = currentManifest
      ? readCommittedPublication(profile, { reportsRoot: path.dirname(reportsDir) })
      : null;
    snapshots = authoritativeCompatibilitySnapshots(reportsDir, prepared.manifest, currentCommitted);

    fs.mkdirSync(generationStageDir, { recursive: true });
    callPublicationFault(options.faultInjector, 'generation:mkdir');
    for (const kind of PUBLICATION_ARTIFACT_KINDS) {
      const descriptor = prepared.manifest.artifacts[kind];
      writeStagedFile(
        path.join(generationStageDir, path.basename(descriptor.path)),
        prepared.payloads[kind],
        `generation:${kind}`,
        options.faultInjector,
      );
    }
    writeStagedFile(
      path.join(generationStageDir, ARTIFACT_NAMES.manifestCanonical),
      prepared.manifestPayload,
      'generation:manifest',
      options.faultInjector,
    );
    syncDirectory(generationStageDir);
    callPublicationFault(options.faultInjector, 'generation:sync-directory');
    if (fs.existsSync(generationFinalDir)) {
      if (!generationMatchesPrepared(generationFinalDir, prepared)) {
        throw Object.assign(new Error('Publication id collision detected.'), {
          code: 'ERR_PUBLICATION_ID_COLLISION',
        });
      }
      fs.rmSync(generationStageDir, { recursive: true, force: true });
    } else {
      fs.renameSync(generationStageDir, generationFinalDir);
      generationCreated = true;
      callPublicationFault(options.faultInjector, 'generation:rename');
      syncDirectory(path.dirname(generationFinalDir));
    }

    for (const kind of PUBLICATION_ARTIFACT_KINDS) {
      atomicReplaceFile(
        path.join(reportsDir, prepared.manifest.artifacts[kind].canonicalPath),
        prepared.payloads[kind],
        `compatibility:${kind}`,
        options.faultInjector,
      );
    }

    atomicReplaceFile(
      path.join(reportsDir, ARTIFACT_NAMES.manifestCanonical),
      prepared.manifestPayload,
      'pointer',
      options.faultInjector,
      { onRename() { pointerCommitted = true; } },
    );

    const verified = readCommittedPublication(profile, {
      reportsRoot: path.dirname(reportsDir),
    });
    if (!verified || verified.manifest.publicationId !== prepared.publicationId || !verified.compatibilityIntact) {
      throw Object.assign(new Error('Publication commit could not be verified.'), {
        code: 'ERR_PUBLICATION_COMMIT_UNKNOWN',
      });
    }

    return localPublicationCommitResult(prepared, reportsDir);
  } catch (error) {
    if (pointerCommitted) {
      try {
        const reconciled = readCommittedPublication(profile, {
          reportsRoot: path.dirname(reportsDir),
        });
        if (
          reconciled
          && reconciled.manifest.publicationId === prepared.publicationId
          && reconciled.compatibilityIntact
        ) {
          return localPublicationCommitResult(prepared, reportsDir);
        }
      } catch {
        // The pointer remains authoritative; surface an unknown local commit.
      }
      throw Object.assign(new Error('Publication commit point was reached but could not be reconciled.'), {
        code: 'ERR_PUBLICATION_COMMIT_UNKNOWN',
        cause: error,
      });
    }
    if (!pointerCommitted && snapshots) {
      try {
        restoreFileSnapshots(snapshots);
        if (generationCreated) fs.rmSync(generationFinalDir, { recursive: true, force: true });
      } catch {
        throw Object.assign(new Error('Publication rollback failed; manifest remains authoritative.'), {
          code: 'ERR_PUBLICATION_ROLLBACK_FAILED',
          cause: error,
        });
      }
    }
    throw error;
  } finally {
    if (transactionDir) {
      try {
        fs.rmSync(transactionDir, { recursive: true, force: true });
      } catch {
        // Transaction directories are non-authoritative cleanup state.
      }
    }
    releasePublicationLock(lockHandle);
  }
}

module.exports = {
  DEFAULT_REPORTS_ROOT,
  saveLeadReport,
  saveLeadSnapshot,
  readLeadHistoryOrThrow,
  readCommittedPublication,
  findHistoricalRunManifest,
  repairPublicationCompatibilityMirrors,
  commitLeadPublication,
};
