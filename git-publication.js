const { execFile } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  failPipelineRun,
  readPipelineRunResult,
  reopenPipelineRun,
  transitionPipelineRun,
  writePipelineRunResult,
} = require('./pipeline-run-state');
const {
  PUBLICATION_SCHEMA_VERSION,
  assertPublicationManifest,
  readCommittedPublication,
} = require('./lead-report-publisher');

function runGit(args, { cwd, execFileImpl = execFile, allowExitCodeOne = false } = {}) {
  return new Promise((resolve, reject) => {
    execFileImpl('git', args, { cwd, encoding: 'utf8', maxBuffer: 24 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error && !(allowExitCodeOne && error.code === 1)) {
        reject(error);
        return;
      }
      resolve({
        exitCode: error ? Number(error.code) : 0,
        stdout: String(stdout || ''),
        stderr: String(stderr || ''),
      });
    });
  });
}

function manifestGitPublicationPaths(result, committed) {
  const prefix = `reports/${result.profileId}/`;
  return [
    `${prefix}publication-manifest.json`,
    ...(committed.manifest.schemaVersion === PUBLICATION_SCHEMA_VERSION
      ? [`${prefix}publications/${committed.manifest.publicationId}/publication-manifest.json`]
      : []),
    ...['report', 'latest', 'history'].map((kind) => `${prefix}${committed.manifest.artifacts[kind].path}`),
    ...['report', 'latest', 'history'].map((kind) => `${prefix}${committed.manifest.artifacts[kind].canonicalPath}`),
  ];
}

function assertGitPublicationPaths(result, committed) {
  const prefix = `reports/${result.profileId}/`;
  const paths = result.publication && result.publication.artifactPaths;
  const expected = manifestGitPublicationPaths(result, committed);
  if (!Array.isArray(paths) || paths.length !== expected.length || new Set(paths).size !== paths.length) {
    throw Object.assign(new Error('Publication artifact path set is invalid.'), {
      code: 'ERR_REMOTE_PUBLICATION_PATHS_INVALID',
    });
  }
  for (const artifactPath of paths) {
    if (
      typeof artifactPath !== 'string'
      || artifactPath.includes('\\')
      || path.posix.isAbsolute(artifactPath)
      || path.posix.normalize(artifactPath) !== artifactPath
      || artifactPath.includes('..')
      || !artifactPath.startsWith(prefix)
    ) {
      throw Object.assign(new Error('Publication artifact path is outside the selected profile.'), {
        code: 'ERR_REMOTE_PUBLICATION_PATHS_INVALID',
      });
    }
  }
  const expectedSorted = [...expected].sort();
  const actual = [...paths].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expectedSorted)) {
    throw Object.assign(new Error('Publication artifact paths do not match the committed manifest.'), {
      code: 'ERR_REMOTE_PUBLICATION_PATHS_INVALID',
    });
  }
  return paths;
}

async function verifyCommitReachableAtRemote({
  cwd,
  remote,
  remoteRef,
  commitSha,
  execFileImpl = execFile,
} = {}) {
  if (
    !/^[A-Za-z0-9._-]+$/.test(remote || '')
    || !/^refs\/heads\/[A-Za-z0-9._/-]+$/.test(remoteRef || '')
    || !/^[a-f0-9]{40}$/.test(commitSha || '')
  ) {
    return false;
  }
  const remoteResult = await runGit(['ls-remote', remote, remoteRef], { cwd, execFileImpl });
  const remoteTip = remoteResult.stdout.trim().split(/\s+/)[0] || '';
  if (!/^[a-f0-9]{40}$/.test(remoteTip)) return false;
  if (remoteTip === commitSha) return true;

  await runGit(['fetch', '--no-tags', remote, remoteRef], { cwd, execFileImpl });
  const ancestor = await runGit(['merge-base', '--is-ancestor', commitSha, 'FETCH_HEAD'], {
    cwd,
    execFileImpl,
    allowExitCodeOne: true,
  });
  return ancestor.exitCode === 0;
}

async function readRemoteRefTip({ cwd, remote, remoteRef, execFileImpl = execFile } = {}) {
  let remoteResult;
  try {
    remoteResult = await runGit(['ls-remote', remote, remoteRef], { cwd, execFileImpl });
  } catch {
    throw Object.assign(new Error('Remote publication ref tip could not be read.'), {
      code: 'ERR_REMOTE_PUBLICATION_PUSH_FAILED',
    });
  }
  const remoteTip = remoteResult.stdout.trim().split(/\s+/)[0] || '';
  if (!/^[a-f0-9]{40}$/.test(remoteTip)) {
    throw Object.assign(new Error('Remote publication ref tip is unavailable.'), {
      code: 'ERR_REMOTE_PUBLICATION_PUSH_FAILED',
    });
  }
  return remoteTip;
}

async function readCommitFile(commitSha, repositoryPath, { cwd, execFileImpl = execFile } = {}) {
  const shown = await runGit(['show', `${commitSha}:${repositoryPath}`], { cwd, execFileImpl });
  return Buffer.from(shown.stdout, 'utf8');
}

function publicationPathPayloads(result, committed) {
  const prefix = `reports/${result.profileId}/`;
  const manifestPayload = fs.readFileSync(committed.manifestPath);
  const payloads = new Map([[`${prefix}publication-manifest.json`, manifestPayload]]);
  if (committed.manifest.schemaVersion === PUBLICATION_SCHEMA_VERSION) {
    payloads.set(
      `${prefix}publications/${committed.manifest.publicationId}/publication-manifest.json`,
      manifestPayload,
    );
  }
  for (const kind of ['report', 'latest', 'history']) {
    const descriptor = committed.manifest.artifacts[kind];
    payloads.set(`${prefix}${descriptor.path}`, committed.buffers[kind]);
    payloads.set(`${prefix}${descriptor.canonicalPath}`, committed.buffers[kind]);
  }
  return payloads;
}

async function readGitObjectOrNull(revision, repositoryPath, { cwd, execFileImpl = execFile } = {}) {
  try {
    return await readCommitFile(revision, repositoryPath, { cwd, execFileImpl });
  } catch {
    return null;
  }
}

async function assertPublicationIndex({
  result,
  committed,
  cwd,
  execFileImpl = execFile,
  allowOwnedSubset = false,
} = {}) {
  const paths = assertGitPublicationPaths(result, committed);
  const payloads = publicationPathPayloads(result, committed);
  const expectedChangedPaths = [];
  for (const repositoryPath of paths) {
    const atHead = await readGitObjectOrNull('HEAD', repositoryPath, { cwd, execFileImpl });
    if (!atHead || !atHead.equals(payloads.get(repositoryPath))) {
      expectedChangedPaths.push(repositoryPath);
    }
  }
  const stagedResult = await runGit(['diff', '--cached', '--name-only'], { cwd, execFileImpl });
  const stagedPaths = stagedResult.stdout.split('\n').filter(Boolean);
  const expectedSet = new Set(expectedChangedPaths);
  if (
    stagedPaths.some((repositoryPath) => !expectedSet.has(repositoryPath))
    || (!allowOwnedSubset
      && JSON.stringify([...stagedPaths].sort()) !== JSON.stringify([...expectedChangedPaths].sort()))
  ) {
    throw Object.assign(new Error('Refusing to include pre-staged changes in publication commit.'), {
      code: 'ERR_REMOTE_PUBLICATION_STAGED_CHANGES',
    });
  }
  for (const repositoryPath of stagedPaths) {
    const stageEntry = await runGit(['ls-files', '--stage', '--', repositoryPath], {
      cwd,
      execFileImpl,
    });
    const indexPayload = await readGitObjectOrNull('', repositoryPath, { cwd, execFileImpl });
    if (
      !/^100644 [a-f0-9]+ 0\t/.test(stageEntry.stdout.trim())
      || !indexPayload
      || !indexPayload.equals(payloads.get(repositoryPath))
    ) {
      throw Object.assign(new Error('Staged publication bytes do not match the selected manifest.'), {
        code: 'ERR_REMOTE_PUBLICATION_STAGED_CHANGES',
      });
    }
  }
  return { expectedChangedPaths, stagedPaths };
}

async function assertPublicationCommitBoundary({
  commitSha,
  baseCommitSha,
  expectedChangedPaths,
  cwd,
  execFileImpl = execFile,
} = {}) {
  const parent = (await runGit(['rev-parse', `${commitSha}^`], { cwd, execFileImpl })).stdout.trim();
  const changed = (await runGit([
    'diff-tree',
    '--no-commit-id',
    '--name-only',
    '-r',
    commitSha,
  ], { cwd, execFileImpl })).stdout.split('\n').filter(Boolean);
  if (
    parent !== baseCommitSha
    || JSON.stringify([...changed].sort()) !== JSON.stringify([...expectedChangedPaths].sort())
  ) {
    throw Object.assign(new Error('Publication commit contains paths outside the validated index.'), {
      code: 'ERR_REMOTE_PUBLICATION_COMMIT_MISMATCH',
    });
  }
}

async function assertRecoveredPublicationCommitBoundary({
  commitSha,
  remoteTip,
  ownedPaths,
  cwd,
  execFileImpl = execFile,
} = {}) {
  const parent = (await runGit(['rev-parse', `${commitSha}^`], { cwd, execFileImpl })).stdout.trim();
  const changed = (await runGit([
    'diff-tree',
    '--no-commit-id',
    '--name-only',
    '-r',
    commitSha,
  ], { cwd, execFileImpl })).stdout.split('\n').filter(Boolean);
  const owned = new Set(ownedPaths);
  if (
    parent !== remoteTip
    || changed.length === 0
    || changed.some((repositoryPath) => !owned.has(repositoryPath))
  ) {
    throw Object.assign(new Error('Recovered publication commit has an unverified local ancestor or path.'), {
      code: 'ERR_REMOTE_PUBLICATION_COMMIT_MISMATCH',
    });
  }
}

function assertCommitArtifact(buffer, descriptor) {
  const digest = crypto.createHash('sha256').update(buffer).digest('hex');
  if (buffer.byteLength !== descriptor.bytes || digest !== descriptor.sha256) {
    throw Object.assign(new Error('Publication commit artifact does not match its manifest.'), {
      code: 'ERR_REMOTE_PUBLICATION_COMMIT_MISMATCH',
    });
  }
}

async function readPublicationFromCommit(result, { cwd, execFileImpl = execFile } = {}) {
  if (!result || !result.publication || !/^[a-f0-9]{40}$/.test(result.publication.commitSha || '')) {
    throw Object.assign(new Error('Publication commit identity is invalid.'), {
      code: 'ERR_REMOTE_PUBLICATION_COMMIT_MISMATCH',
    });
  }
  const manifestPath = `reports/${result.profileId}/publication-manifest.json`;
  let manifestPayload;
  let manifest;
  try {
    manifestPayload = await readCommitFile(result.publication.commitSha, manifestPath, { cwd, execFileImpl });
    manifest = assertPublicationManifest(JSON.parse(manifestPayload.toString('utf8')), {
      id: result.profileId,
    });
  } catch {
    throw Object.assign(new Error('Publication manifest is unavailable at the recorded commit.'), {
      code: 'ERR_REMOTE_PUBLICATION_COMMIT_MISMATCH',
    });
  }
  if (
    manifest.publicationId !== result.publication.publicationId
    || manifest.inputDigest !== result.publication.inputDigest
  ) {
    throw Object.assign(new Error('Publication commit manifest does not match local committed data.'), {
      code: 'ERR_REMOTE_PUBLICATION_COMMIT_MISMATCH',
    });
  }
  assertGitPublicationPaths(result, { manifest });

  if (manifest.schemaVersion === PUBLICATION_SCHEMA_VERSION) {
    const generationManifestPath = `reports/${result.profileId}/publications/${manifest.publicationId}/publication-manifest.json`;
    let generationManifestPayload;
    try {
      generationManifestPayload = await readCommitFile(
        result.publication.commitSha,
        generationManifestPath,
        { cwd, execFileImpl },
      );
    } catch {
      throw Object.assign(new Error('Publication generation manifest is unavailable at the recorded commit.'), {
        code: 'ERR_REMOTE_PUBLICATION_COMMIT_MISMATCH',
      });
    }
    if (!generationManifestPayload.equals(manifestPayload)) {
      throw Object.assign(new Error('Publication manifest copies differ at the recorded commit.'), {
        code: 'ERR_REMOTE_PUBLICATION_COMMIT_MISMATCH',
      });
    }
  }

  const buffers = {};
  for (const kind of ['report', 'latest', 'history']) {
    const descriptor = manifest.artifacts[kind];
    const immutablePath = `reports/${result.profileId}/${descriptor.path}`;
    const canonicalPath = `reports/${result.profileId}/${descriptor.canonicalPath}`;
    let immutable;
    let canonical;
    try {
      immutable = await readCommitFile(result.publication.commitSha, immutablePath, { cwd, execFileImpl });
      canonical = await readCommitFile(result.publication.commitSha, canonicalPath, { cwd, execFileImpl });
    } catch {
      throw Object.assign(new Error('Publication artifact is unavailable at the recorded commit.'), {
        code: 'ERR_REMOTE_PUBLICATION_COMMIT_MISMATCH',
      });
    }
    assertCommitArtifact(immutable, descriptor);
    assertCommitArtifact(canonical, descriptor);
    if (!canonical.equals(immutable)) {
      throw Object.assign(new Error('Canonical and immutable publication artifacts differ in the commit.'), {
        code: 'ERR_REMOTE_PUBLICATION_COMMIT_MISMATCH',
      });
    }
    buffers[kind] = immutable;
  }

  let latest;
  let history;
  try {
    latest = JSON.parse(buffers.latest.toString('utf8'));
    history = JSON.parse(buffers.history.toString('utf8'));
  } catch {
    throw Object.assign(new Error('Publication JSON is invalid at the recorded commit.'), {
      code: 'ERR_REMOTE_PUBLICATION_COMMIT_MISMATCH',
    });
  }
  if (!Array.isArray(latest) || !Array.isArray(history)) {
    throw Object.assign(new Error('Publication JSON shape is invalid at the recorded commit.'), {
      code: 'ERR_REMOTE_PUBLICATION_COMMIT_MISMATCH',
    });
  }
  return {
    manifest,
    buffers,
    latest,
    history,
    report: buffers.report.toString('utf8'),
    compatibilityIntact: true,
  };
}

async function assertPublicationCommit(result, committed, { cwd, execFileImpl = execFile } = {}) {
  const head = (await runGit(['rev-parse', 'HEAD'], { cwd, execFileImpl })).stdout.trim();
  if (head !== result.publication.commitSha) {
    throw Object.assign(new Error('Local publication commit does not match the recoverable result.'), {
      code: 'ERR_REMOTE_PUBLICATION_COMMIT_MISMATCH',
    });
  }
  const publication = await readPublicationFromCommit(result, { cwd, execFileImpl });
  if (
    publication.manifest.publicationId !== committed.manifest.publicationId
    || publication.manifest.inputDigest !== committed.manifest.inputDigest
  ) {
    throw Object.assign(new Error('Publication commit manifest does not match local committed data.'), {
      code: 'ERR_REMOTE_PUBLICATION_COMMIT_MISMATCH',
    });
  }
  return publication;
}

function finalizeRemotePublication(result, resultFile, { commitSha, branch }) {
  reopenPipelineRun(result);
  transitionPipelineRun(result, 'PUBLISHED');
  result.publication.disposition = 'CREATED';
  result.publication.commitSha = commitSha;
  result.publication.remoteRef = `refs/heads/${branch}`;
  result.publication.remotePublished = true;
  result.publication.remoteVerifiedAt = new Date().toISOString();
  result.publication.publishedByThisRun = true;
  result.counts.artifactsPublished = result.publication.artifactCount;
  result.outcome = 'PUBLISHED';
  result.terminal = true;
  result.completedAt = result.updatedAt = result.publication.remoteVerifiedAt;
  result.notification.state = result.notification.requested ? 'PENDING' : 'NOT_REQUESTED';
  result.failure = null;
  writePipelineRunResult(resultFile, result);
  return { result, skipped: false, commitSha };
}

async function recoverVerifiedRemotePublication({
  resultFile,
  cwd = process.cwd(),
  remote = 'origin',
  branch = 'master',
  execFileImpl = execFile,
  reportsRoot,
} = {}) {
  const result = readPipelineRunResult(resultFile);
  if (!/^[A-Za-z0-9._-]+$/.test(remote) || !/^[A-Za-z0-9._/-]+$/.test(branch) || branch.includes('..')) {
    throw Object.assign(new Error('Remote publication target is invalid.'), {
      code: 'ERR_REMOTE_PUBLICATION_TARGET_INVALID',
    });
  }
  if (result.state === 'PUBLISHED' || result.state === 'NOTIFIED') {
    return { result, skipped: true, recovered: false };
  }
  const recoverableRemoteFailure = result.state === 'VALIDATED'
    && result.outcome === 'FAILED'
    && result.failure
    && result.failure.stage === 'remote_publication'
    && ['ERR_REMOTE_PUBLICATION_PUSH_FAILED', 'ERR_REMOTE_PUBLICATION_VERIFY_FAILED']
      .includes(result.failure.code);
  if (
    result.state !== 'VALIDATED'
    || (result.outcome !== 'READY_FOR_REMOTE_PUBLICATION' && !recoverableRemoteFailure)
    || !result.publication.localCommitted
    || !/^[a-f0-9]{40}$/.test(result.publication.commitSha || '')
    || result.publication.remoteRef !== `refs/heads/${branch}`
  ) {
    return { result, skipped: true, recovered: false };
  }

  const committed = readCommittedPublication(
    { id: result.profileId },
    { reportsRoot: reportsRoot || path.join(cwd, 'reports') },
  );
  if (
    !committed
    || committed.manifest.publicationId !== result.publication.publicationId
    || !committed.compatibilityIntact
  ) {
    throw Object.assign(new Error('Recoverable publication manifest does not match the run result.'), {
      code: 'ERR_REMOTE_PUBLICATION_MANIFEST_MISMATCH',
    });
  }
  assertGitPublicationPaths(result, committed);
  await assertPublicationCommit(result, committed, { cwd, execFileImpl });
  let verified = false;
  try {
    verified = await verifyCommitReachableAtRemote({
      cwd,
      remote,
      remoteRef: result.publication.remoteRef,
      commitSha: result.publication.commitSha,
      execFileImpl,
    });
  } catch {
    verified = false;
  }
  let pushError = null;
  if (!verified) {
    try {
      await runGit([
        'push',
        remote,
        `${result.publication.commitSha}:refs/heads/${branch}`,
      ], { cwd, execFileImpl });
    } catch (error) {
      pushError = error;
    }
    try {
      verified = await verifyCommitReachableAtRemote({
        cwd,
        remote,
        remoteRef: result.publication.remoteRef,
        commitSha: result.publication.commitSha,
        execFileImpl,
      });
    } catch {
      verified = false;
    }
  }
  if (!verified) {
    throw Object.assign(new Error('Recorded publication commit is not reachable from the remote ref.'), {
      code: pushError
        ? 'ERR_REMOTE_PUBLICATION_PUSH_FAILED'
        : 'ERR_REMOTE_PUBLICATION_VERIFY_FAILED',
    });
  }
  return {
    ...finalizeRemotePublication(result, resultFile, {
      commitSha: result.publication.commitSha,
      branch,
    }),
    recovered: true,
  };
}

function remotePublicationFailure(result, resultFile, code = 'ERR_REMOTE_PUBLICATION_FAILED') {
  result.notification.state = result.notification.requested ? 'BLOCKED' : 'NOT_REQUESTED';
  result.publication.remotePublished = false;
  result.publication.publishedByThisRun = false;
  failPipelineRun(result, {
    code,
    stage: 'remote_publication',
    retryable: true,
    safeMessage: 'Remote Git publication was not verified.',
  });
  writePipelineRunResult(resultFile, result);
}

async function publishPipelineRunToGit({
  resultFile,
  cwd = process.cwd(),
  remote = 'origin',
  branch = 'master',
  execFileImpl = execFile,
  reportsRoot,
  faultInjector,
} = {}) {
  const result = readPipelineRunResult(resultFile);
  if (['NO_ARTICLES', 'NO_CANDIDATES', 'NO_ARTIFACT_CHANGE', 'NO_CHANGE'].includes(result.outcome)) {
    return { result, skipped: true };
  }
  if (!/^[A-Za-z0-9._-]+$/.test(remote) || !/^[A-Za-z0-9._/-]+$/.test(branch) || branch.includes('..')) {
    throw Object.assign(new Error('Remote publication target is invalid.'), {
      code: 'ERR_REMOTE_PUBLICATION_TARGET_INVALID',
    });
  }
  const recoverableRemoteFailure = result.state === 'VALIDATED'
    && result.outcome === 'FAILED'
    && result.failure
    && result.failure.stage === 'remote_publication'
    && ['ERR_REMOTE_PUBLICATION_PUSH_FAILED', 'ERR_REMOTE_PUBLICATION_VERIFY_FAILED']
      .includes(result.failure.code)
    && Boolean(result.publication.commitSha);
  if (recoverableRemoteFailure) {
    return recoverVerifiedRemotePublication({
      resultFile,
      cwd,
      remote,
      branch,
      execFileImpl,
      reportsRoot,
    });
  }
  if (
    result.state !== 'VALIDATED'
    || result.outcome !== 'READY_FOR_REMOTE_PUBLICATION'
    || !result.publication.localCommitted
    || result.publication.remotePublished
  ) {
    throw Object.assign(new Error('Pipeline run is not ready for remote publication.'), {
      code: 'ERR_REMOTE_PUBLICATION_NOT_READY',
    });
  }
  try {
    if (result.publication.commitSha) {
      return recoverVerifiedRemotePublication({
        resultFile,
        cwd,
        remote,
        branch,
        execFileImpl,
        reportsRoot,
      });
    }
    const committed = readCommittedPublication(
      { id: result.profileId },
      { reportsRoot: reportsRoot || path.join(cwd, 'reports') },
    );
    if (
      !committed
      || committed.manifest.publicationId !== result.publication.publicationId
      || !committed.compatibilityIntact
    ) {
      throw Object.assign(new Error('Local publication manifest does not match the run result.'), {
        code: 'ERR_REMOTE_PUBLICATION_MANIFEST_MISMATCH',
      });
    }
    const paths = assertGitPublicationPaths(result, committed);
    const baseCommitSha = (await runGit(['rev-parse', 'HEAD'], { cwd, execFileImpl })).stdout.trim();

    await assertPublicationIndex({
      result,
      committed,
      cwd,
      execFileImpl,
      allowOwnedSubset: true,
    });

    await runGit(['add', '--', ...paths], { cwd, execFileImpl });
    if (typeof faultInjector === 'function') faultInjector('local:staged');
    const validatedIndex = await assertPublicationIndex({ result, committed, cwd, execFileImpl });
    const diff = await runGit(['diff', '--cached', '--quiet'], {
      cwd,
      execFileImpl,
      allowExitCodeOne: true,
    });
    let commitSha;
    let committedThisAttempt = false;
    if (diff.exitCode === 0) {
      commitSha = (await runGit(['rev-parse', 'HEAD'], { cwd, execFileImpl })).stdout.trim();
      result.publication.commitSha = commitSha;
      result.publication.remoteRef = `refs/heads/${branch}`;
      await assertPublicationCommit(result, committed, { cwd, execFileImpl });
      let alreadyReachable = false;
      try {
        alreadyReachable = await verifyCommitReachableAtRemote({
          cwd,
          remote,
          remoteRef: `refs/heads/${branch}`,
          commitSha,
          execFileImpl,
        });
      } catch {
        alreadyReachable = false;
      }
      if (!alreadyReachable) {
        const remoteTip = await readRemoteRefTip({
          cwd,
          remote,
          remoteRef: `refs/heads/${branch}`,
          execFileImpl,
        });
        let reachableAfterTipRead = remoteTip === commitSha;
        if (!reachableAfterTipRead) {
          try {
            reachableAfterTipRead = await verifyCommitReachableAtRemote({
              cwd,
              remote,
              remoteRef: `refs/heads/${branch}`,
              commitSha,
              execFileImpl,
            });
          } catch {
            reachableAfterTipRead = false;
          }
        }
        if (!reachableAfterTipRead) {
          await assertRecoveredPublicationCommitBoundary({
            commitSha,
            remoteTip,
            ownedPaths: paths,
            cwd,
            execFileImpl,
          });
        }
      }
    } else {
      const remoteTip = await readRemoteRefTip({
        cwd,
        remote,
        remoteRef: `refs/heads/${branch}`,
        execFileImpl,
      });
      if (remoteTip !== baseCommitSha) {
        throw Object.assign(new Error('Local publication base is not the current remote tip.'), {
          code: 'ERR_REMOTE_PUBLICATION_PUSH_FAILED',
        });
      }
      await runGit([
        'commit',
        '--only',
        '-m',
        `Publish ${result.profileId} leads ${result.publication.publicationId}`,
        '--',
        ...paths,
      ], { cwd, execFileImpl });
      commitSha = (await runGit(['rev-parse', 'HEAD'], { cwd, execFileImpl })).stdout.trim();
      committedThisAttempt = true;
      if (typeof faultInjector === 'function') faultInjector('local:committed');
    }
    if (!/^[a-f0-9]{40}$/.test(commitSha)) {
      throw Object.assign(new Error('Publication commit SHA is invalid.'), {
        code: 'ERR_REMOTE_PUBLICATION_COMMIT_INVALID',
      });
    }

    result.publication.commitSha = commitSha;
    result.publication.remoteRef = `refs/heads/${branch}`;
    if (committedThisAttempt) {
      await assertPublicationCommitBoundary({
        commitSha,
        baseCommitSha,
        expectedChangedPaths: validatedIndex.expectedChangedPaths,
        cwd,
        execFileImpl,
      });
    }
    await assertPublicationCommit(result, committed, { cwd, execFileImpl });
    writePipelineRunResult(resultFile, result);
    if (typeof faultInjector === 'function') faultInjector('local:recorded');

    let pushError = null;
    try {
      await runGit(['push', remote, `HEAD:refs/heads/${branch}`], { cwd, execFileImpl });
    } catch (error) {
      pushError = error;
    }
    let remoteVerified = false;
    try {
      remoteVerified = await verifyCommitReachableAtRemote({
        cwd,
        remote,
        remoteRef: `refs/heads/${branch}`,
        commitSha,
        execFileImpl,
      });
    } catch {
      remoteVerified = false;
    }
    if (!remoteVerified) {
      const error = Object.assign(new Error('Remote ref did not verify the publication commit.'), {
        code: pushError ? 'ERR_REMOTE_PUBLICATION_PUSH_FAILED' : 'ERR_REMOTE_PUBLICATION_VERIFY_FAILED',
      });
      throw error;
    }
    if (typeof faultInjector === 'function') faultInjector('remote:verified');
    return finalizeRemotePublication(result, resultFile, { commitSha, branch });
  } catch (error) {
    remotePublicationFailure(
      result,
      resultFile,
      /^ERR_[A-Z0-9_]+$/.test(error && error.code) ? error.code : 'ERR_REMOTE_PUBLICATION_FAILED',
    );
    throw Object.assign(new Error('Remote Git publication failed.'), {
      code: result.failure.code,
    });
  }
}

module.exports = {
  assertGitPublicationPaths,
  assertPublicationCommit,
  readPublicationFromCommit,
  recoverVerifiedRemotePublication,
  publishPipelineRunToGit,
  runGit,
  verifyCommitReachableAtRemote,
};
