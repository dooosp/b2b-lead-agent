const { execFile } = require('child_process');
const path = require('path');
const {
  failPipelineRun,
  readPipelineRunResult,
  reopenPipelineRun,
  transitionPipelineRun,
  writePipelineRunResult,
} = require('./pipeline-run-state');
const { readCommittedPublication } = require('./lead-report-publisher');

function runGit(args, { cwd, execFileImpl = execFile, allowExitCodeOne = false } = {}) {
  return new Promise((resolve, reject) => {
    execFileImpl('git', args, { cwd, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
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
    ...['report', 'latest', 'history'].map((kind) => `${prefix}${committed.manifest.artifacts[kind].path}`),
    ...['report', 'latest', 'history'].map((kind) => `${prefix}${committed.manifest.artifacts[kind].canonicalPath}`),
  ];
}

function assertGitPublicationPaths(result, committed) {
  const prefix = `reports/${result.profileId}/`;
  const paths = result.publication && result.publication.artifactPaths;
  if (!Array.isArray(paths) || paths.length !== 7 || new Set(paths).size !== paths.length) {
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
  const expected = manifestGitPublicationPaths(result, committed).sort();
  const actual = [...paths].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
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

async function assertPublicationCommit(result, committed, { cwd, execFileImpl = execFile } = {}) {
  const head = (await runGit(['rev-parse', 'HEAD'], { cwd, execFileImpl })).stdout.trim();
  if (head !== result.publication.commitSha) {
    throw Object.assign(new Error('Local publication commit does not match the recoverable result.'), {
      code: 'ERR_REMOTE_PUBLICATION_COMMIT_MISMATCH',
    });
  }
  const manifestPath = `reports/${result.profileId}/publication-manifest.json`;
  let manifest;
  try {
    manifest = JSON.parse((await runGit([
      'show',
      `${result.publication.commitSha}:${manifestPath}`,
    ], { cwd, execFileImpl })).stdout);
  } catch {
    throw Object.assign(new Error('Publication manifest is unavailable at the recorded commit.'), {
      code: 'ERR_REMOTE_PUBLICATION_COMMIT_MISMATCH',
    });
  }
  if (
    manifest.publicationId !== committed.manifest.publicationId
    || manifest.inputDigest !== committed.manifest.inputDigest
  ) {
    throw Object.assign(new Error('Publication commit manifest does not match local committed data.'), {
      code: 'ERR_REMOTE_PUBLICATION_COMMIT_MISMATCH',
    });
  }
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
  if (result.state === 'PUBLISHED' || result.state === 'NOTIFIED') {
    return { result, skipped: true, recovered: false };
  }
  if (
    result.state !== 'VALIDATED'
    || result.outcome !== 'READY_FOR_REMOTE_PUBLICATION'
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
  const verified = await verifyCommitReachableAtRemote({
    cwd,
    remote,
    remoteRef: result.publication.remoteRef,
    commitSha: result.publication.commitSha,
    execFileImpl,
  });
  if (!verified) {
    throw Object.assign(new Error('Recorded publication commit is not reachable from the remote ref.'), {
      code: 'ERR_REMOTE_PUBLICATION_VERIFY_FAILED',
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
  if (['NO_ARTICLES', 'NO_CANDIDATES', 'NO_CHANGE'].includes(result.outcome)) {
    return { result, skipped: true };
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
  if (!/^[A-Za-z0-9._-]+$/.test(remote) || !/^[A-Za-z0-9._/-]+$/.test(branch) || branch.includes('..')) {
    throw Object.assign(new Error('Remote publication target is invalid.'), {
      code: 'ERR_REMOTE_PUBLICATION_TARGET_INVALID',
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

    const stagedBefore = await runGit(['diff', '--cached', '--name-only'], { cwd, execFileImpl });
    if (stagedBefore.stdout.trim()) {
      throw Object.assign(new Error('Refusing to include pre-staged changes in publication commit.'), {
        code: 'ERR_REMOTE_PUBLICATION_STAGED_CHANGES',
      });
    }

    await runGit(['add', '--', ...paths], { cwd, execFileImpl });
    const diff = await runGit(['diff', '--cached', '--quiet'], {
      cwd,
      execFileImpl,
      allowExitCodeOne: true,
    });
    let commitSha;
    if (diff.exitCode === 0) {
      commitSha = (await runGit(['rev-parse', 'HEAD'], { cwd, execFileImpl })).stdout.trim();
      result.publication.commitSha = commitSha;
      result.publication.remoteRef = `refs/heads/${branch}`;
      await assertPublicationCommit(result, committed, { cwd, execFileImpl });
    } else {
      await runGit([
        'commit',
        '-m',
        `Publish ${result.profileId} leads ${result.publication.publicationId}`,
      ], { cwd, execFileImpl });
      commitSha = (await runGit(['rev-parse', 'HEAD'], { cwd, execFileImpl })).stdout.trim();
      if (typeof faultInjector === 'function') faultInjector('local:committed');
    }
    if (!/^[a-f0-9]{40}$/.test(commitSha)) {
      throw Object.assign(new Error('Publication commit SHA is invalid.'), {
        code: 'ERR_REMOTE_PUBLICATION_COMMIT_INVALID',
      });
    }

    result.publication.commitSha = commitSha;
    result.publication.remoteRef = `refs/heads/${branch}`;
    writePipelineRunResult(resultFile, result);

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
  recoverVerifiedRemotePublication,
  publishPipelineRunToGit,
  runGit,
  verifyCommitReachableAtRemote,
};
