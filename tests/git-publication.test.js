const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFile, execFileSync, spawnSync } = require('node:child_process');

const { runLeadPipeline } = require('../main');
const {
  publishPipelineRunToGit,
  recoverVerifiedRemotePublication,
} = require('../git-publication');
const {
  notifyPublishedPipelineRun,
  verifyPublicationMatchesCommit,
} = require('../notification-runner');
const { readPipelineRunResult } = require('../pipeline-run-state');
const { readCommittedPublication } = require('../lead-report-publisher');
const { createRootLead, createRootProfile } = require('./helpers/root-fixtures');

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function createGitFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'git-publication-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const remote = path.join(root, 'remote.git');
  const local = path.join(root, 'local');
  fs.mkdirSync(local);
  git(root, 'init', '--bare', remote);
  git(local, 'init', '-b', 'master');
  git(local, 'config', 'user.name', 'Fixture Publisher');
  git(local, 'config', 'user.email', 'publisher@example.test');
  fs.writeFileSync(path.join(local, 'README.md'), 'fixture\n', 'utf8');
  git(local, 'add', 'README.md');
  git(local, 'commit', '-m', 'fixture baseline');
  git(local, 'remote', 'add', 'origin', remote);
  git(local, 'push', '-u', 'origin', 'master');
  return { root, remote, local };
}

function silentObs() {
  return {
    log() {},
    time() { return { end() {} }; },
    count() {},
    summary() {},
  };
}

async function prepareRun(fixture, resultName = 'result.json', options = {}) {
  const resultFile = path.join(fixture.root, resultName);
  const profile = createRootProfile({ emailRecipients: '' });
  const result = await runLeadPipeline({
    profile,
    reportsRoot: path.join(fixture.local, 'reports'),
    resultFile,
    notificationRequested: true,
    deps: {
      articleCollector: { async fetchIndustryNews() { return [{}]; } },
      leadQualifier: {
        async qualifyLeads() {
          return [createRootLead({
            generationMode: 'llm',
            verificationStatus: 'needs_review',
            confidence: 'LOW',
            ...(options.lead || {}),
          })];
        },
      },
      clock: () => new Date('2026-07-15T04:00:00.000Z'),
      runIdFactory: () => options.runId || `run-${resultName.replace(/\W/g, '-')}`,
      obs: silentObs(),
    },
  });
  assert.equal(result.outcome, 'READY_FOR_REMOTE_PUBLICATION');
  return { resultFile, profile, result };
}

test('real bare Git publication verifies the remote SHA before notification', async (t) => {
  const fixture = createGitFixture(t);
  const prepared = await prepareRun(fixture);
  const published = await publishPipelineRunToGit({
    resultFile: prepared.resultFile,
    cwd: fixture.local,
    remote: 'origin',
    branch: 'master',
  });
  const remoteTip = git(fixture.local, 'ls-remote', 'origin', 'refs/heads/master').split(/\s+/)[0];
  assert.equal(published.result.state, 'PUBLISHED');
  assert.equal(published.result.outcome, 'PUBLISHED');
  assert.equal(published.result.publication.remotePublished, true);
  assert.equal(published.result.publication.commitSha, remoteTip);
  assert.equal(published.result.notification.state, 'PENDING');

  let sendCount = 0;
  const notified = await notifyPublishedPipelineRun({
    resultFile: prepared.resultFile,
    profile: prepared.profile,
    cwd: fixture.local,
    remote: 'origin',
    transporter: {
      async sendMail(options) {
        sendCount += 1;
        return { accepted: ['reviewer@example.com'], rejected: [], messageId: options.messageId };
      },
    },
    config: { user: 'sender@example.com', recipients: 'reviewer@example.com' },
  });
  assert.equal(sendCount, 1);
  assert.equal(notified.result.state, 'NOTIFIED');
  assert.equal(notified.result.outcome, 'NOTIFIED');
  assert.equal(notified.result.notification.deliveryGuarantee, 'PROVIDER_ACCEPTANCE_ONLY');

  const duplicate = await notifyPublishedPipelineRun({
    resultFile: prepared.resultFile,
    profile: prepared.profile,
    cwd: fixture.local,
    transporter: { async sendMail() { throw new Error('must not be called'); } },
    config: { user: 'sender@example.com', recipients: 'reviewer@example.com' },
  });
  assert.equal(duplicate.skipped, true);
  assert.equal(duplicate.reason, 'ALREADY_NOTIFIED');
  assert.equal(sendCount, 1);
});

test('notification rejects a caller profile that does not own the published result', async (t) => {
  const fixture = createGitFixture(t);
  const prepared = await prepareRun(fixture, 'cross-profile-notification.json');
  await publishPipelineRunToGit({
    resultFile: prepared.resultFile,
    cwd: fixture.local,
    remote: 'origin',
    branch: 'master',
  });
  let sendCount = 0;
  const wrongProfile = createRootProfile({
    id: 'other-profile',
    name: 'Other Profile',
    emailRecipients: 'other@example.com',
  });

  await assert.rejects(
    () => notifyPublishedPipelineRun({
      resultFile: prepared.resultFile,
      profile: wrongProfile,
      cwd: fixture.local,
      remote: 'origin',
      transporter: {
        async sendMail() {
          sendCount += 1;
          return { accepted: ['other@example.com'], rejected: [] };
        },
      },
      config: { user: 'sender@example.com' },
    }),
    (error) => error.code === 'ERR_NOTIFICATION_PROFILE_MISMATCH',
  );
  assert.equal(sendCount, 0);
  const persisted = readPipelineRunResult(prepared.resultFile);
  assert.equal(persisted.outcome, 'NOTIFICATION_FAILED');
  assert.equal(persisted.failure.code, 'ERR_NOTIFICATION_PROFILE_MISMATCH');
});

test('post-commit validation blocks a Git add race from reaching the remote', async (t) => {
  const fixture = createGitFixture(t);
  const prepared = await prepareRun(fixture, 'git-add-race.json');
  const committed = readCommittedPublication(prepared.profile, {
    reportsRoot: path.join(fixture.local, 'reports'),
  });
  const canonicalLatest = path.join(
    committed.reportsDir,
    committed.manifest.artifacts.latest.canonicalPath,
  );
  const remoteBefore = git(fixture.local, 'ls-remote', 'origin', 'refs/heads/master').split(/\s+/)[0];
  let mutated = false;
  const execFileImpl = (file, args, options, callback) => {
    if (!mutated && file === 'git' && args[0] === 'add') {
      mutated = true;
      fs.writeFileSync(canonicalLatest, '[{"company":"Raced bytes"}]', 'utf8');
    }
    execFile(file, args, options, callback);
  };

  await assert.rejects(
    () => publishPipelineRunToGit({
      resultFile: prepared.resultFile,
      cwd: fixture.local,
      execFileImpl,
    }),
    (error) => error.code === 'ERR_REMOTE_PUBLICATION_STAGED_CHANGES',
  );
  assert.equal(mutated, true);
  assert.equal(
    git(fixture.local, 'ls-remote', 'origin', 'refs/heads/master').split(/\s+/)[0],
    remoteBefore,
  );
  const failed = readPipelineRunResult(prepared.resultFile);
  assert.equal(failed.outcome, 'FAILED');
  assert.equal(failed.publication.remotePublished, false);
});

test('commit-boundary staging cannot add an unrelated path to the pushed publication', async (t) => {
  const fixture = createGitFixture(t);
  const prepared = await prepareRun(fixture, 'commit-boundary-path.json');
  const unrelatedPath = path.join(fixture.local, 'unrelated-secret.txt');
  let injected = false;
  const execFileImpl = (file, args, options, callback) => {
    if (!injected && file === 'git' && args[0] === 'commit') {
      injected = true;
      fs.writeFileSync(unrelatedPath, 'must not publish\n', 'utf8');
      git(fixture.local, 'add', 'unrelated-secret.txt');
    }
    execFile(file, args, options, callback);
  };

  const published = await publishPipelineRunToGit({
    resultFile: prepared.resultFile,
    cwd: fixture.local,
    execFileImpl,
  });
  assert.equal(injected, true);
  assert.equal(published.result.state, 'PUBLISHED');
  assert.throws(
    () => git(fixture.local, 'show', 'origin/master:unrelated-secret.txt'),
    /exists on disk, but not in|does not exist in|invalid object name|path .* not exist/i,
  );
  assert.equal(git(fixture.local, 'diff', '--cached', '--name-only'), 'unrelated-secret.txt');
});

test('publication pushes the validated commit instead of a later unrelated HEAD', async (t) => {
  const fixture = createGitFixture(t);
  const prepared = await prepareRun(fixture, 'pre-push-head-race.json');
  const unrelatedPath = path.join(fixture.local, 'unrelated-after-validation.txt');
  let injected = false;
  const execFileImpl = (file, args, options, callback) => {
    if (!injected && file === 'git' && args[0] === 'push') {
      injected = true;
      fs.writeFileSync(unrelatedPath, 'must remain local\n', 'utf8');
      git(fixture.local, 'add', 'unrelated-after-validation.txt');
      git(fixture.local, 'commit', '-m', 'unrelated commit after publication validation');
    }
    execFile(file, args, options, callback);
  };

  const published = await publishPipelineRunToGit({
    resultFile: prepared.resultFile,
    cwd: fixture.local,
    execFileImpl,
  });
  const remoteTip = git(
    fixture.local,
    'ls-remote',
    'origin',
    'refs/heads/master',
  ).split(/\s+/)[0];

  assert.equal(injected, true);
  assert.equal(published.result.state, 'PUBLISHED');
  assert.equal(published.result.publication.commitSha, remoteTip);
  assert.notEqual(git(fixture.local, 'rev-parse', 'HEAD'), remoteTip);
  assert.throws(
    () => git(fixture.local, 'show', 'origin/master:unrelated-after-validation.txt'),
    /exists on disk, but not in|does not exist in|invalid object name|path .* not exist/i,
  );
});

test('a pushed commit recovers after transient remote verification failure', async (t) => {
  const fixture = createGitFixture(t);
  const prepared = await prepareRun(fixture, 'verify-transient.json');
  let remoteReadCount = 0;
  const execFileImpl = (file, args, options, callback) => {
    if (file === 'git' && args[0] === 'ls-remote') remoteReadCount += 1;
    if (remoteReadCount === 2 && file === 'git' && args[0] === 'ls-remote') {
      const error = Object.assign(new Error('synthetic transient ls-remote failure'), { code: 128 });
      callback(error, '', 'synthetic transient failure');
      return;
    }
    execFile(file, args, options, callback);
  };

  await assert.rejects(
    () => publishPipelineRunToGit({
      resultFile: prepared.resultFile,
      cwd: fixture.local,
      execFileImpl,
    }),
    (error) => error.code === 'ERR_REMOTE_PUBLICATION_VERIFY_FAILED',
  );
  const failed = readPipelineRunResult(prepared.resultFile);
  assert.equal(failed.outcome, 'FAILED');
  assert.equal(failed.failure.code, 'ERR_REMOTE_PUBLICATION_VERIFY_FAILED');
  assert.equal(
    git(fixture.local, 'ls-remote', 'origin', 'refs/heads/master').split(/\s+/)[0],
    failed.publication.commitSha,
  );

  const recovered = await recoverVerifiedRemotePublication({
    resultFile: prepared.resultFile,
    cwd: fixture.local,
  });
  assert.equal(recovered.recovered, true);
  assert.equal(recovered.result.outcome, 'PUBLISHED');
  assert.equal(recovered.result.publication.remotePublished, true);
});

test('fresh process recovers a verified push after publisher termination before result persistence', async (t) => {
  const fixture = createGitFixture(t);
  const prepared = await prepareRun(fixture, 'post-push-crash.json');
  const childScript = `
    const { publishPipelineRunToGit } = require(process.argv[1]);
    publishPipelineRunToGit({
      resultFile: process.argv[2],
      cwd: process.argv[3],
      faultInjector(operation) {
        if (operation === 'remote:verified') process.exit(87);
      }
    }).catch(() => process.exit(89));
  `;
  const crashed = spawnSync(process.execPath, [
    '-e',
    childScript,
    require.resolve('../git-publication'),
    prepared.resultFile,
    fixture.local,
  ], { encoding: 'utf8' });
  assert.equal(crashed.status, 87, crashed.stderr);

  const interrupted = readPipelineRunResult(prepared.resultFile);
  const remoteTip = git(fixture.local, 'ls-remote', 'origin', 'refs/heads/master').split(/\s+/)[0];
  assert.equal(interrupted.state, 'VALIDATED');
  assert.equal(interrupted.outcome, 'READY_FOR_REMOTE_PUBLICATION');
  assert.equal(interrupted.publication.commitSha, remoteTip);
  assert.equal(interrupted.publication.remotePublished, false);

  const recovered = await recoverVerifiedRemotePublication({
    resultFile: prepared.resultFile,
    cwd: fixture.local,
  });
  assert.equal(recovered.recovered, true);
  assert.equal(recovered.result.state, 'PUBLISHED');
  assert.equal(recovered.result.publication.remotePublished, true);
  assert.equal(recovered.result.publication.commitSha, remoteTip);
});

test('fresh process resumes from a local publication commit created before result persistence', async (t) => {
  const fixture = createGitFixture(t);
  const prepared = await prepareRun(fixture, 'post-commit-crash.json');
  const childScript = `
    const { publishPipelineRunToGit } = require(process.argv[1]);
    publishPipelineRunToGit({
      resultFile: process.argv[2],
      cwd: process.argv[3],
      faultInjector(operation) {
        if (operation === 'local:committed') process.exit(86);
      }
    }).catch(() => process.exit(89));
  `;
  const crashed = spawnSync(process.execPath, [
    '-e',
    childScript,
    require.resolve('../git-publication'),
    prepared.resultFile,
    fixture.local,
  ], { encoding: 'utf8' });
  assert.equal(crashed.status, 86, crashed.stderr);
  const interrupted = readPipelineRunResult(prepared.resultFile);
  assert.equal(interrupted.publication.commitSha, null);
  assert.equal(interrupted.outcome, 'READY_FOR_REMOTE_PUBLICATION');

  const resumed = await publishPipelineRunToGit({
    resultFile: prepared.resultFile,
    cwd: fixture.local,
  });
  const remoteTip = git(fixture.local, 'ls-remote', 'origin', 'refs/heads/master').split(/\s+/)[0];
  assert.equal(resumed.result.state, 'PUBLISHED');
  assert.equal(resumed.result.publication.commitSha, remoteTip);
  assert.equal(git(fixture.local, 'log', '--oneline', '--all', '--grep', `Publish ${prepared.profile.id}`).split('\n').filter(Boolean).length, 1);
});

test('post-commit recovery refuses a publication commit built on an unrelated local ancestor', async (t) => {
  const fixture = createGitFixture(t);
  const prepared = await prepareRun(fixture, 'post-commit-unrelated-ancestor.json');
  const remoteBefore = git(fixture.local, 'ls-remote', 'origin', 'refs/heads/master').split(/\s+/)[0];
  const childScript = `
    const fs = require('fs');
    const path = require('path');
    const { execFile, execFileSync } = require('child_process');
    const { publishPipelineRunToGit } = require(process.argv[1]);
    let injected = false;
    const execFileImpl = (file, args, options, callback) => {
      if (!injected && file === 'git' && args[0] === 'commit') {
        injected = true;
        fs.writeFileSync(path.join(process.argv[3], 'unrelated-ancestor.txt'), 'must stay local\\n');
        execFileSync('git', ['add', 'unrelated-ancestor.txt'], { cwd: process.argv[3] });
        execFileSync('git', [
          'commit', '--only', '-m', 'unrelated local ancestor', '--', 'unrelated-ancestor.txt'
        ], { cwd: process.argv[3] });
      }
      execFile(file, args, options, callback);
    };
    publishPipelineRunToGit({
      resultFile: process.argv[2],
      cwd: process.argv[3],
      execFileImpl,
      faultInjector(operation) {
        if (operation === 'local:committed') process.exit(86);
      }
    }).catch(() => process.exit(89));
  `;
  const crashed = spawnSync(process.execPath, [
    '-e',
    childScript,
    require.resolve('../git-publication'),
    prepared.resultFile,
    fixture.local,
  ], { encoding: 'utf8' });
  assert.equal(crashed.status, 86, crashed.stderr);
  assert.equal(readPipelineRunResult(prepared.resultFile).publication.commitSha, null);

  await assert.rejects(
    () => publishPipelineRunToGit({
      resultFile: prepared.resultFile,
      cwd: fixture.local,
    }),
    (error) => error.code === 'ERR_REMOTE_PUBLICATION_COMMIT_MISMATCH',
  );
  assert.equal(
    git(fixture.local, 'ls-remote', 'origin', 'refs/heads/master').split(/\s+/)[0],
    remoteBefore,
  );
  assert.throws(
    () => git(fixture.local, 'show', 'origin/master:unrelated-ancestor.txt'),
    /exists on disk, but not in|does not exist in|invalid object name|path .* not exist/i,
  );
});

test('post-commit recovery converges when a transient read races an exact remote push', async (t) => {
  const fixture = createGitFixture(t);
  const prepared = await prepareRun(fixture, 'post-commit-converged-remote.json');
  const childScript = `
    const { publishPipelineRunToGit } = require(process.argv[1]);
    publishPipelineRunToGit({
      resultFile: process.argv[2],
      cwd: process.argv[3],
      faultInjector(operation) {
        if (operation === 'local:committed') process.exit(86);
      }
    }).catch(() => process.exit(89));
  `;
  const crashed = spawnSync(process.execPath, [
    '-e',
    childScript,
    require.resolve('../git-publication'),
    prepared.resultFile,
    fixture.local,
  ], { encoding: 'utf8' });
  assert.equal(crashed.status, 86, crashed.stderr);
  const publicationHead = git(fixture.local, 'rev-parse', 'HEAD');
  let injected = false;
  const execFileImpl = (file, args, options, callback) => {
    if (!injected && file === 'git' && args[0] === 'ls-remote') {
      injected = true;
      git(fixture.local, 'push', 'origin', 'HEAD:refs/heads/master');
      callback(Object.assign(new Error('synthetic transient remote read'), { code: 128 }), '', '');
      return;
    }
    execFile(file, args, options, callback);
  };

  const recovered = await publishPipelineRunToGit({
    resultFile: prepared.resultFile,
    cwd: fixture.local,
    execFileImpl,
  });
  assert.equal(injected, true);
  assert.equal(recovered.result.state, 'PUBLISHED');
  assert.equal(recovered.result.publication.commitSha, publicationHead);
  assert.equal(
    git(fixture.local, 'ls-remote', 'origin', 'refs/heads/master').split(/\s+/)[0],
    publicationHead,
  );
});

test('fresh process resumes an exact publication index left after git add', async (t) => {
  const fixture = createGitFixture(t);
  const prepared = await prepareRun(fixture, 'post-stage-crash.json');
  const childScript = `
    const { publishPipelineRunToGit } = require(process.argv[1]);
    publishPipelineRunToGit({
      resultFile: process.argv[2],
      cwd: process.argv[3],
      faultInjector(operation) {
        if (operation === 'local:staged') process.exit(85);
      }
    }).catch(() => process.exit(89));
  `;
  const crashed = spawnSync(process.execPath, [
    '-e',
    childScript,
    require.resolve('../git-publication'),
    prepared.resultFile,
    fixture.local,
  ], { encoding: 'utf8' });
  assert.equal(crashed.status, 85, crashed.stderr);
  const interrupted = readPipelineRunResult(prepared.resultFile);
  assert.equal(interrupted.publication.commitSha, null);
  assert.equal(interrupted.outcome, 'READY_FOR_REMOTE_PUBLICATION');
  assert.ok(git(fixture.local, 'diff', '--cached', '--name-only').split('\n').filter(Boolean).length > 0);

  const resumed = await publishPipelineRunToGit({
    resultFile: prepared.resultFile,
    cwd: fixture.local,
  });
  const remoteTip = git(fixture.local, 'ls-remote', 'origin', 'refs/heads/master').split(/\s+/)[0];
  assert.equal(resumed.result.state, 'PUBLISHED');
  assert.equal(resumed.result.publication.commitSha, remoteTip);
  assert.equal(git(fixture.local, 'diff', '--cached', '--name-only'), '');
});

test('fresh process pushes a validated recorded commit left before push', async (t) => {
  const fixture = createGitFixture(t);
  const prepared = await prepareRun(fixture, 'pre-push-crash.json');
  const remoteBefore = git(fixture.local, 'ls-remote', 'origin', 'refs/heads/master').split(/\s+/)[0];
  const childScript = `
    const { publishPipelineRunToGit } = require(process.argv[1]);
    publishPipelineRunToGit({
      resultFile: process.argv[2],
      cwd: process.argv[3],
      faultInjector(operation) {
        if (operation === 'local:recorded') process.exit(86);
      }
    }).catch(() => process.exit(89));
  `;
  const crashed = spawnSync(process.execPath, [
    '-e',
    childScript,
    require.resolve('../git-publication'),
    prepared.resultFile,
    fixture.local,
  ], { encoding: 'utf8' });
  assert.equal(crashed.status, 86, crashed.stderr);
  const interrupted = readPipelineRunResult(prepared.resultFile);
  assert.match(interrupted.publication.commitSha, /^[a-f0-9]{40}$/);
  assert.equal(interrupted.publication.commitSha, git(fixture.local, 'rev-parse', 'HEAD'));
  assert.equal(
    git(fixture.local, 'ls-remote', 'origin', 'refs/heads/master').split(/\s+/)[0],
    remoteBefore,
  );

  const recovered = await recoverVerifiedRemotePublication({
    resultFile: prepared.resultFile,
    cwd: fixture.local,
  });
  assert.equal(recovered.recovered, true);
  assert.equal(recovered.result.state, 'PUBLISHED');
  assert.equal(
    git(fixture.local, 'ls-remote', 'origin', 'refs/heads/master').split(/\s+/)[0],
    interrupted.publication.commitSha,
  );
});

test('owned partial publication staging resumes but unrelated staging remains refused', async (t) => {
  const resumable = createGitFixture(t);
  const prepared = await prepareRun(resumable, 'partial-stage.json');
  const result = readPipelineRunResult(prepared.resultFile);
  git(resumable.local, 'add', '--', result.publication.artifactPaths[0]);
  const published = await publishPipelineRunToGit({
    resultFile: prepared.resultFile,
    cwd: resumable.local,
  });
  assert.equal(published.result.state, 'PUBLISHED');

  const refused = createGitFixture(t);
  const refusedPrepared = await prepareRun(refused, 'unrelated-stage.json');
  fs.writeFileSync(path.join(refused.local, 'user-staged.txt'), 'preserve me\n', 'utf8');
  git(refused.local, 'add', 'user-staged.txt');
  const remoteBefore = git(refused.local, 'ls-remote', 'origin', 'refs/heads/master').split(/\s+/)[0];
  await assert.rejects(
    () => publishPipelineRunToGit({
      resultFile: refusedPrepared.resultFile,
      cwd: refused.local,
    }),
    (error) => error.code === 'ERR_REMOTE_PUBLICATION_STAGED_CHANGES',
  );
  assert.equal(git(refused.local, 'diff', '--cached', '--name-only'), 'user-staged.txt');
  assert.equal(
    git(refused.local, 'ls-remote', 'origin', 'refs/heads/master').split(/\s+/)[0],
    remoteBefore,
  );
});

test('poisoned extra report path is rejected before Git staging', async (t) => {
  const fixture = createGitFixture(t);
  const prepared = await prepareRun(fixture, 'extra-path.json');
  const poisoned = readPipelineRunResult(prepared.resultFile);
  const extraRelative = `reports/${poisoned.profileId}/unrelated.json`;
  poisoned.publication.artifactPaths.push(extraRelative);
  fs.writeFileSync(path.join(fixture.local, extraRelative), '{}\n', 'utf8');
  fs.writeFileSync(prepared.resultFile, `${JSON.stringify(poisoned, null, 2)}\n`, 'utf8');

  await assert.rejects(
    () => publishPipelineRunToGit({
      resultFile: prepared.resultFile,
      cwd: fixture.local,
    }),
    (error) => error.code === 'ERR_REMOTE_PUBLICATION_PATHS_INVALID',
  );
  assert.equal(git(fixture.local, 'diff', '--cached', '--name-only'), '');
});

test('mixed compatibility mirrors are never pushed to fixed-path remote consumers', async (t) => {
  const fixture = createGitFixture(t);
  const prepared = await prepareRun(fixture, 'mixed-mirrors.json');
  const committed = readCommittedPublication(prepared.profile, {
    reportsRoot: path.join(fixture.local, 'reports'),
  });
  const baselineTip = git(fixture.local, 'ls-remote', 'origin', 'refs/heads/master').split(/\s+/)[0];
  fs.writeFileSync(
    path.join(committed.reportsDir, committed.manifest.artifacts.latest.canonicalPath),
    '[{"company":"MIXED"}]',
    'utf8',
  );

  await assert.rejects(
    () => publishPipelineRunToGit({
      resultFile: prepared.resultFile,
      cwd: fixture.local,
    }),
    (error) => error.code === 'ERR_REMOTE_PUBLICATION_MANIFEST_MISMATCH',
  );
  const remoteTip = git(fixture.local, 'ls-remote', 'origin', 'refs/heads/master').split(/\s+/)[0];
  assert.equal(remoteTip, baselineTip);
  assert.equal(git(fixture.local, 'diff', '--cached', '--name-only'), '');
});

test('non-fast-forward push failure leaves VALIDATED and prevents notification transport calls', async (t) => {
  const fixture = createGitFixture(t);
  const prepared = await prepareRun(fixture, 'push-failure.json');

  const other = path.join(fixture.root, 'other');
  git(fixture.root, 'clone', '-b', 'master', fixture.remote, other);
  git(other, 'config', 'user.name', 'Concurrent Writer');
  git(other, 'config', 'user.email', 'concurrent@example.test');
  fs.writeFileSync(path.join(other, 'concurrent.txt'), 'advance remote\n', 'utf8');
  git(other, 'add', 'concurrent.txt');
  git(other, 'commit', '-m', 'advance remote');
  git(other, 'push', 'origin', 'master');

  await assert.rejects(
    () => publishPipelineRunToGit({
      resultFile: prepared.resultFile,
      cwd: fixture.local,
      remote: 'origin',
      branch: 'master',
    }),
    (error) => error.code === 'ERR_REMOTE_PUBLICATION_PUSH_FAILED',
  );
  const failed = readPipelineRunResult(prepared.resultFile);
  assert.equal(failed.state, 'VALIDATED');
  assert.equal(failed.outcome, 'FAILED');
  assert.equal(failed.publication.remotePublished, false);
  assert.equal(failed.notification.state, 'BLOCKED');

  let sendCount = 0;
  await assert.rejects(
    () => notifyPublishedPipelineRun({
      resultFile: prepared.resultFile,
      profile: prepared.profile,
      cwd: fixture.local,
      transporter: { async sendMail() { sendCount += 1; } },
      config: { user: 'sender@example.com', recipients: 'reviewer@example.com' },
    }),
    (error) => error.code === 'ERR_NOTIFICATION_PUBLICATION_NOT_VERIFIED',
  );
  assert.equal(sendCount, 0);
});

test('working-tree immutable tampering cannot alter commit-bound notification content', async (t) => {
  const fixture = createGitFixture(t);
  const prepared = await prepareRun(fixture, 'tamper.json');
  await publishPipelineRunToGit({
    resultFile: prepared.resultFile,
    cwd: fixture.local,
  });
  const committed = readCommittedPublication(prepared.profile, {
    reportsRoot: path.join(fixture.local, 'reports'),
  });
  const latestPath = path.join(committed.reportsDir, ...committed.manifest.artifacts.latest.path.split('/'));
  fs.appendFileSync(latestPath, '\nTAMPER', 'utf8');
  let sendCount = 0;
  const notified = await notifyPublishedPipelineRun({
    resultFile: prepared.resultFile,
    profile: prepared.profile,
    cwd: fixture.local,
    transporter: {
      async sendMail() {
        sendCount += 1;
        return { accepted: ['reviewer@example.com'], rejected: [] };
      },
    },
    config: { user: 'sender@example.com', recipients: 'reviewer@example.com' },
  });
  assert.equal(notified.result.outcome, 'NOTIFIED');
  assert.equal(sendCount, 1);
});

test('working mirror drift cannot replace verified commit bytes in a notification', async (t) => {
  const fixture = createGitFixture(t);
  const prepared = await prepareRun(fixture, 'commit-content-mismatch.json');
  await publishPipelineRunToGit({
    resultFile: prepared.resultFile,
    cwd: fixture.local,
  });
  const committed = readCommittedPublication(prepared.profile, {
    reportsRoot: path.join(fixture.local, 'reports'),
  });
  fs.writeFileSync(
    path.join(committed.reportsDir, committed.manifest.artifacts.latest.canonicalPath),
    JSON.stringify([{ company: 'Different but parseable local mirror' }]),
    'utf8',
  );
  let sendCount = 0;
  let sentText = '';
  const notified = await notifyPublishedPipelineRun({
    resultFile: prepared.resultFile,
    profile: prepared.profile,
    cwd: fixture.local,
    transporter: {
      async sendMail(message) {
        sendCount += 1;
        sentText = message.text;
        return { accepted: ['reviewer@example.com'], rejected: [] };
      },
    },
    config: { user: 'sender@example.com', recipients: 'reviewer@example.com' },
  });
  assert.equal(notified.result.outcome, 'NOTIFIED');
  assert.match(sentText, /LG전자/);
  assert.doesNotMatch(sentText, /Different but parseable local mirror/);
  assert.equal(sendCount, 1);
});

test('commit-byte verification rejects selected files absent from the recorded commit', async (t) => {
  const fixture = createGitFixture(t);
  const prepared = await prepareRun(fixture, 'commit-absent-path.json');
  const publication = readCommittedPublication(prepared.profile, {
    reportsRoot: path.join(fixture.local, 'reports'),
  });
  const result = readPipelineRunResult(prepared.resultFile);
  result.publication.commitSha = git(fixture.local, 'rev-parse', 'HEAD');
  assert.equal(await verifyPublicationMatchesCommit(result, publication, {
    cwd: fixture.local,
  }), false);
});

test('a result-file notification lock permits only one concurrent provider call', async (t) => {
  const fixture = createGitFixture(t);
  const prepared = await prepareRun(fixture, 'notification-lock.json');
  await publishPipelineRunToGit({ resultFile: prepared.resultFile, cwd: fixture.local });
  const resultAlias = path.join(fixture.root, 'notification-result-alias.json');
  fs.symlinkSync(prepared.resultFile, resultAlias);

  let releaseProvider;
  let sendCount = 0;
  const providerBarrier = new Promise((resolve) => { releaseProvider = resolve; });
  const first = notifyPublishedPipelineRun({
    resultFile: prepared.resultFile,
    profile: prepared.profile,
    cwd: fixture.local,
    transporter: {
      async sendMail(options) {
        sendCount += 1;
        await providerBarrier;
        return { accepted: ['reviewer@example.com'], rejected: [], messageId: options.messageId };
      },
    },
    config: { user: 'sender@example.com', recipients: 'reviewer@example.com' },
  });
  await assert.rejects(
    () => notifyPublishedPipelineRun({
      resultFile: resultAlias,
      profile: prepared.profile,
      cwd: fixture.local,
      transporter: { async sendMail() { sendCount += 1; } },
      config: { user: 'sender@example.com', recipients: 'reviewer@example.com' },
    }),
    (error) => error.code === 'ERR_NOTIFICATION_LOCKED' && error.retryable === true,
  );
  releaseProvider();
  const completed = await first;
  assert.equal(completed.result.state, 'NOTIFIED');
  assert.equal(sendCount, 1);
  assert.equal(fs.existsSync(`${prepared.resultFile}.notification-lock`), false);
  assert.equal(fs.lstatSync(resultAlias).isSymbolicLink(), true);
  assert.equal(fs.realpathSync(resultAlias), fs.realpathSync(prepared.resultFile));
});

test('notification identity lock survives an in-flight result-file rename', async (t) => {
  const fixture = createGitFixture(t);
  const prepared = await prepareRun(fixture, 'notification-rename.json');
  await publishPipelineRunToGit({ resultFile: prepared.resultFile, cwd: fixture.local });
  const movedResultFile = path.join(fixture.root, 'notification-renamed-result.json');
  let releaseRemoteVerification;
  let remoteVerificationStarted;
  const remoteVerificationBarrier = new Promise((resolve) => {
    releaseRemoteVerification = resolve;
  });
  const remoteVerificationSignal = new Promise((resolve) => {
    remoteVerificationStarted = resolve;
  });
  let intercepted = false;
  const execFileImpl = (file, args, options, callback) => {
    if (!intercepted && file === 'git' && args[0] === 'ls-remote') {
      intercepted = true;
      remoteVerificationStarted();
      remoteVerificationBarrier.then(() => execFile(file, args, options, callback));
      return;
    }
    execFile(file, args, options, callback);
  };
  let sendCount = 0;
  const transporter = {
    async sendMail(options) {
      sendCount += 1;
      return { accepted: ['reviewer@example.com'], rejected: [], messageId: options.messageId };
    },
  };
  const config = { user: 'sender@example.com', recipients: 'reviewer@example.com' };
  const first = notifyPublishedPipelineRun({
    resultFile: prepared.resultFile,
    profile: prepared.profile,
    cwd: fixture.local,
    execFileImpl,
    transporter,
    config,
  });
  await remoteVerificationSignal;
  fs.renameSync(prepared.resultFile, movedResultFile);
  const repositorySubdirectory = path.join(fixture.local, 'reports');

  await assert.rejects(
    () => notifyPublishedPipelineRun({
      resultFile: movedResultFile,
      profile: prepared.profile,
      cwd: repositorySubdirectory,
      transporter,
      config,
    }),
    (error) => error.code === 'ERR_NOTIFICATION_LOCKED' && error.retryable === true,
  );
  releaseRemoteVerification();
  const completed = await first;
  assert.equal(completed.result.state, 'NOTIFIED');
  assert.equal(sendCount, 1);
  assert.equal(fs.existsSync(prepared.resultFile), true);
  assert.equal(readPipelineRunResult(movedResultFile).state, 'PUBLISHED');

  const staleRetry = await notifyPublishedPipelineRun({
    resultFile: movedResultFile,
    profile: prepared.profile,
    cwd: repositorySubdirectory,
    transporter,
    config,
  });
  assert.equal(staleRetry.skipped, true);
  assert.equal(staleRetry.reason, 'ALREADY_NOTIFIED');
  assert.equal(sendCount, 1);
});

test('notification identity lock is shared across linked Git worktrees', async (t) => {
  const fixture = createGitFixture(t);
  const prepared = await prepareRun(fixture, 'notification-cross-worktree.json');
  await publishPipelineRunToGit({ resultFile: prepared.resultFile, cwd: fixture.local });
  const secondaryWorktree = path.join(fixture.root, 'secondary-worktree');
  git(fixture.local, 'worktree', 'add', '-b', 'secondary-notification-test', secondaryWorktree, 'HEAD');
  const movedResultFile = path.join(fixture.root, 'notification-cross-worktree-moved.json');
  let releaseRemoteVerification;
  let remoteVerificationStarted;
  const remoteVerificationBarrier = new Promise((resolve) => {
    releaseRemoteVerification = resolve;
  });
  const remoteVerificationSignal = new Promise((resolve) => {
    remoteVerificationStarted = resolve;
  });
  let intercepted = false;
  const execFileImpl = (file, args, options, callback) => {
    if (!intercepted && file === 'git' && args[0] === 'ls-remote') {
      intercepted = true;
      remoteVerificationStarted();
      remoteVerificationBarrier.then(() => execFile(file, args, options, callback));
      return;
    }
    execFile(file, args, options, callback);
  };
  let sendCount = 0;
  const transporter = {
    async sendMail(options) {
      sendCount += 1;
      return { accepted: ['reviewer@example.com'], rejected: [], messageId: options.messageId };
    },
  };
  const config = { user: 'sender@example.com', recipients: 'reviewer@example.com' };
  const first = notifyPublishedPipelineRun({
    resultFile: prepared.resultFile,
    profile: prepared.profile,
    cwd: fixture.local,
    execFileImpl,
    transporter,
    config,
  });
  await remoteVerificationSignal;
  fs.renameSync(prepared.resultFile, movedResultFile);

  await assert.rejects(
    () => notifyPublishedPipelineRun({
      resultFile: movedResultFile,
      profile: prepared.profile,
      cwd: secondaryWorktree,
      transporter,
      config,
    }),
    (error) => error.code === 'ERR_NOTIFICATION_LOCKED' && error.retryable === true,
  );
  releaseRemoteVerification();
  const completed = await first;
  assert.equal(completed.result.state, 'NOTIFIED');
  assert.equal(sendCount, 1);

  const staleRetry = await notifyPublishedPipelineRun({
    resultFile: movedResultFile,
    profile: prepared.profile,
    cwd: secondaryWorktree,
    transporter,
    config,
  });
  assert.equal(staleRetry.skipped, true);
  assert.equal(staleRetry.reason, 'ALREADY_NOTIFIED');
  assert.equal(sendCount, 1);
});

test('hardlink result aliases are rejected before any provider call', async (t) => {
  const fixture = createGitFixture(t);
  const prepared = await prepareRun(fixture, 'notification-hardlink.json');
  await publishPipelineRunToGit({ resultFile: prepared.resultFile, cwd: fixture.local });
  const hardlinkAlias = path.join(fixture.root, 'notification-result-hardlink.json');
  fs.linkSync(prepared.resultFile, hardlinkAlias);
  assert.equal(fs.statSync(prepared.resultFile).ino, fs.statSync(hardlinkAlias).ino);
  let sendCount = 0;
  const attempts = await Promise.allSettled([prepared.resultFile, hardlinkAlias].map((resultFile) => (
    notifyPublishedPipelineRun({
      resultFile,
      profile: prepared.profile,
      cwd: fixture.local,
      transporter: { async sendMail() { sendCount += 1; } },
      config: { user: 'sender@example.com', recipients: 'reviewer@example.com' },
    })
  )));
  assert.equal(sendCount, 0);
  assert.equal(attempts.every((attempt) => (
    attempt.status === 'rejected' && attempt.reason.code === 'ERR_NOTIFICATION_RESULT_ALIASED'
  )), true);

  fs.unlinkSync(hardlinkAlias);
  const notified = await notifyPublishedPipelineRun({
    resultFile: prepared.resultFile,
    profile: prepared.profile,
    cwd: fixture.local,
    transporter: {
      async sendMail() {
        sendCount += 1;
        return { accepted: ['reviewer@example.com'], rejected: [] };
      },
    },
    config: { user: 'sender@example.com', recipients: 'reviewer@example.com' },
  });
  assert.equal(notified.result.state, 'NOTIFIED');
  assert.equal(sendCount, 1);
});

test('an abandoned stale recovery claim does not permanently wedge notification', async (t) => {
  const fixture = createGitFixture(t);
  const prepared = await prepareRun(fixture, 'notification-abandoned-claim.json');
  await publishPipelineRunToGit({ resultFile: prepared.resultFile, cwd: fixture.local });
  const lockPath = `${path.resolve(prepared.resultFile)}.notification-lock`;
  fs.mkdirSync(lockPath);
  fs.writeFileSync(path.join(lockPath, 'owner.json'), JSON.stringify({ pid: 2147483646, ownerId: 'dead-owner' }));
  fs.writeFileSync(path.join(lockPath, '.recovery-claim'), JSON.stringify({ pid: 2147483645, ownerId: 'dead-claim' }));
  let sends = 0;
  const notified = await notifyPublishedPipelineRun({
    resultFile: prepared.resultFile,
    profile: prepared.profile,
    cwd: fixture.local,
    transporter: {
      async sendMail() {
        sends += 1;
        return { accepted: ['reviewer@example.com'], rejected: [] };
      },
    },
    config: { user: 'sender@example.com', recipients: 'reviewer@example.com' },
  });
  assert.equal(notified.result.outcome, 'NOTIFIED');
  assert.equal(sends, 1);
  assert.equal(fs.existsSync(lockPath), false);
});

test('retained publication A can be retried after publication B advances the pointer', async (t) => {
  const fixture = createGitFixture(t);
  const publicationA = await prepareRun(fixture, 'retained-a.json', {
    runId: 'retained-run-a',
    lead: { company: 'Retained Company A', summary: 'Retained publication A' },
  });
  await publishPipelineRunToGit({ resultFile: publicationA.resultFile, cwd: fixture.local });
  await assert.rejects(
    () => notifyPublishedPipelineRun({
      resultFile: publicationA.resultFile,
      profile: publicationA.profile,
      cwd: fixture.local,
      transporter: {
        async sendMail() {
          throw Object.assign(new Error('synthetic auth failure'), { code: 'EAUTH' });
        },
      },
      config: { user: 'sender@example.com', recipients: 'reviewer@example.com' },
    }),
    (error) => error.code === 'ERR_NOTIFICATION_AUTH_FAILED',
  );

  const publicationB = await prepareRun(fixture, 'retained-b.json', {
    runId: 'retained-run-b',
    lead: { company: 'Current Company B', summary: 'Current publication B' },
  });
  await publishPipelineRunToGit({ resultFile: publicationB.resultFile, cwd: fixture.local });
  let sentText = '';
  const retried = await notifyPublishedPipelineRun({
    resultFile: publicationA.resultFile,
    profile: publicationA.profile,
    cwd: fixture.local,
    retryNotification: true,
    transporter: {
      async sendMail(message) {
        sentText = message.text;
        return { accepted: ['reviewer@example.com'], rejected: [] };
      },
    },
    config: { user: 'sender@example.com', recipients: 'reviewer@example.com' },
  });
  assert.equal(retried.result.outcome, 'NOTIFIED');
  assert.match(sentText, /Retained Company A/);
  assert.doesNotMatch(sentText, /Current Company B/);
});

test('notification failure preserves PUBLISHED and retry is explicit with stable correlation identity', async (t) => {
  const fixture = createGitFixture(t);
  const prepared = await prepareRun(fixture, 'notification-retry.json');
  await publishPipelineRunToGit({
    resultFile: prepared.resultFile,
    cwd: fixture.local,
  });
  let failedSendCount = 0;
  await assert.rejects(
    () => notifyPublishedPipelineRun({
      resultFile: prepared.resultFile,
      profile: prepared.profile,
      cwd: fixture.local,
      transporter: {
        async sendMail() {
          failedSendCount += 1;
          throw Object.assign(new Error('synthetic auth failure'), { code: 'EAUTH' });
        },
      },
      config: { user: 'sender@example.com', recipients: 'reviewer@example.com' },
    }),
    (error) => error.code === 'ERR_NOTIFICATION_AUTH_FAILED',
  );
  const failed = readPipelineRunResult(prepared.resultFile);
  assert.equal(failedSendCount, 1);
  assert.equal(failed.state, 'PUBLISHED');
  assert.equal(failed.outcome, 'NOTIFICATION_FAILED');
  assert.equal(failed.publication.remotePublished, true);
  assert.equal(failed.notification.state, 'FAILED');
  const firstKey = failed.notification.notificationKey;
  const firstMessageId = failed.notification.messageId;

  let implicitRetryCalls = 0;
  await assert.rejects(
    () => notifyPublishedPipelineRun({
      resultFile: prepared.resultFile,
      profile: prepared.profile,
      cwd: fixture.local,
      transporter: { async sendMail() { implicitRetryCalls += 1; } },
      config: { user: 'sender@example.com', recipients: 'reviewer@example.com' },
    }),
    (error) => error.code === 'ERR_NOTIFICATION_RETRY_EXPLICIT_REQUIRED',
  );
  assert.equal(implicitRetryCalls, 0);

  const retried = await notifyPublishedPipelineRun({
    resultFile: prepared.resultFile,
    profile: prepared.profile,
    cwd: fixture.local,
    retryNotification: true,
    transporter: {
      async sendMail(options) {
        return { accepted: ['reviewer@example.com'], rejected: [], messageId: options.messageId };
      },
    },
    config: { user: 'sender@example.com', recipients: 'reviewer@example.com' },
  });
  assert.equal(retried.result.state, 'NOTIFIED');
  assert.equal(retried.result.operation, 'NOTIFICATION_RETRY');
  assert.equal(retried.result.notification.notificationKey, firstKey);
  assert.equal(retried.result.notification.messageId, firstMessageId);
  assert.equal(retried.result.notification.attempts, 2);
});

test('notification retry rejects recipient-set drift before a provider call', async (t) => {
  const fixture = createGitFixture(t);
  const prepared = await prepareRun(fixture, 'notification-recipient-drift.json');
  await publishPipelineRunToGit({ resultFile: prepared.resultFile, cwd: fixture.local });
  await assert.rejects(
    () => notifyPublishedPipelineRun({
      resultFile: prepared.resultFile,
      profile: prepared.profile,
      cwd: fixture.local,
      transporter: {
        async sendMail() {
          throw Object.assign(new Error('synthetic auth failure'), { code: 'EAUTH' });
        },
      },
      config: { user: 'sender@example.com', recipients: 'reviewer@example.com' },
    }),
    (error) => error.code === 'ERR_NOTIFICATION_AUTH_FAILED',
  );

  let retryCalls = 0;
  await assert.rejects(
    () => notifyPublishedPipelineRun({
      resultFile: prepared.resultFile,
      profile: prepared.profile,
      cwd: fixture.local,
      retryNotification: true,
      transporter: { async sendMail() { retryCalls += 1; } },
      config: { user: 'sender@example.com', recipients: 'other-reviewer@example.com' },
    }),
    (error) => error.code === 'ERR_NOTIFICATION_RECIPIENT_SET_CHANGED',
  );
  assert.equal(retryCalls, 0);
  assert.doesNotMatch(
    fs.readFileSync(prepared.resultFile, 'utf8'),
    /reviewer@example\.com|other-reviewer@example\.com/,
  );
});

test('retry preflight refusal preserves prior unknown acceptance evidence', async (t) => {
  const fixture = createGitFixture(t);
  const prepared = await prepareRun(fixture, 'notification-unknown-drift.json');
  await publishPipelineRunToGit({ resultFile: prepared.resultFile, cwd: fixture.local });
  await assert.rejects(
    () => notifyPublishedPipelineRun({
      resultFile: prepared.resultFile,
      profile: prepared.profile,
      cwd: fixture.local,
      transporter: {
        async sendMail() {
          throw Object.assign(new Error('synthetic timeout'), {
            code: 'ETIMEDOUT',
            command: 'DATA',
          });
        },
      },
      config: { user: 'sender@example.com', recipients: 'reviewer@example.com' },
    }),
    (error) => error.code === 'ERR_NOTIFICATION_ACCEPTANCE_UNKNOWN',
  );
  const before = readPipelineRunResult(prepared.resultFile);
  assert.equal(before.outcome, 'NOTIFICATION_UNKNOWN');
  assert.equal(before.notification.state, 'UNKNOWN');
  assert.equal(before.failure.deliveryUnknown, true);

  await assert.rejects(
    () => notifyPublishedPipelineRun({
      resultFile: prepared.resultFile,
      profile: prepared.profile,
      cwd: fixture.local,
      retryNotification: true,
      transporter: { async sendMail() { throw new Error('must not be called'); } },
      config: { user: 'sender@example.com', recipients: 'other-reviewer@example.com' },
    }),
    (error) => error.code === 'ERR_NOTIFICATION_RECIPIENT_SET_CHANGED',
  );
  const after = readPipelineRunResult(prepared.resultFile);
  assert.equal(after.outcome, 'NOTIFICATION_UNKNOWN');
  assert.equal(after.notification.state, 'UNKNOWN');
  assert.equal(after.failure.code, 'ERR_NOTIFICATION_ACCEPTANCE_UNKNOWN');
  assert.equal(after.failure.deliveryUnknown, true);
  assert.equal(after.notification.lastPreflightFailureCode, 'ERR_NOTIFICATION_RECIPIENT_SET_CHANGED');
  assert.match(after.notification.lastPreflightFailureAt, /^2026-|^2027-/);
});

test('a no-change compatibility repair is committed and pushed for fixed-path consumers', async (t) => {
  const fixture = createGitFixture(t);
  const prepared = await prepareRun(fixture, 'repair-seed.json');
  await publishPipelineRunToGit({ resultFile: prepared.resultFile, cwd: fixture.local });
  const committed = readCommittedPublication(prepared.profile, {
    reportsRoot: path.join(fixture.local, 'reports'),
  });
  const canonicalRelative = `reports/${prepared.profile.id}/${committed.manifest.artifacts.latest.canonicalPath}`;
  const generationRelative = `reports/${prepared.profile.id}/${committed.manifest.artifacts.latest.path}`;
  fs.writeFileSync(path.join(fixture.local, canonicalRelative), '[{"company":"MIXED REMOTE"}]', 'utf8');
  git(fixture.local, 'add', canonicalRelative);
  git(fixture.local, 'commit', '-m', 'synthetic broken compatibility mirror');
  git(fixture.local, 'push', 'origin', 'master');

  const repairResultFile = path.join(fixture.root, 'repair-result.json');
  const repaired = await runLeadPipeline({
    profile: prepared.profile,
    requestId: 'repair-request',
    reportsRoot: path.join(fixture.local, 'reports'),
    resultFile: repairResultFile,
    notificationRequested: true,
    deps: {
      articleCollector: { async fetchIndustryNews() { return [{}]; } },
      leadQualifier: {
        async qualifyLeads() {
          return [createRootLead({
            generationMode: 'llm',
            verificationStatus: 'needs_review',
            confidence: 'LOW',
          })];
        },
      },
      clock: () => new Date('2026-07-15T04:00:00.000Z'),
      runIdFactory: () => 'run-repair-request',
      obs: silentObs(),
    },
  });
  assert.equal(repaired.outcome, 'READY_FOR_REMOTE_PUBLICATION');
  assert.equal(repaired.operation, 'PUBLICATION_REPAIR');
  assert.equal(repaired.notification.requested, false);
  assert.equal(repaired.publication.artifactPaths.length, 8);

  const published = await publishPipelineRunToGit({
    resultFile: repairResultFile,
    cwd: fixture.local,
  });
  assert.equal(published.result.state, 'PUBLISHED');
  const remoteTip = git(fixture.local, 'ls-remote', 'origin', 'refs/heads/master').split(/\s+/)[0];
  assert.equal(
    git(fixture.local, 'show', `${remoteTip}:${canonicalRelative}`),
    git(fixture.local, 'show', `${remoteTip}:${generationRelative}`),
  );
});

test('different-run identical content creates no commit, push, or notification', async (t) => {
  const fixture = createGitFixture(t);
  const prepared = await prepareRun(fixture, 'no-artifact-change-seed.json');
  await publishPipelineRunToGit({ resultFile: prepared.resultFile, cwd: fixture.local });
  const beforeTip = git(fixture.local, 'ls-remote', 'origin', 'refs/heads/master').split(/\s+/)[0];

  const resultFile = path.join(fixture.root, 'no-artifact-change.json');
  const noChange = await runLeadPipeline({
    profile: prepared.profile,
    requestId: 'different-request',
    reportsRoot: path.join(fixture.local, 'reports'),
    resultFile,
    notificationRequested: true,
    deps: {
      articleCollector: { async fetchIndustryNews() { return [{}]; } },
      leadQualifier: {
        async qualifyLeads() {
          return [createRootLead({
            generationMode: 'llm',
            verificationStatus: 'needs_review',
            confidence: 'LOW',
          })];
        },
      },
      clock: () => new Date('2026-07-15T04:00:00.000Z'),
      runIdFactory: () => 'run-different-request',
      obs: silentObs(),
    },
  });
  assert.equal(noChange.outcome, 'NO_ARTIFACT_CHANGE');
  assert.equal((await publishPipelineRunToGit({ resultFile, cwd: fixture.local })).skipped, true);
  let sendCount = 0;
  const notification = await notifyPublishedPipelineRun({
    resultFile,
    profile: prepared.profile,
    cwd: fixture.local,
    transporter: { async sendMail() { sendCount += 1; } },
    config: { user: 'sender@example.com', recipients: 'reviewer@example.com' },
  });
  assert.equal(notification.skipped, true);
  assert.equal(sendCount, 0);
  assert.equal(
    git(fixture.local, 'ls-remote', 'origin', 'refs/heads/master').split(/\s+/)[0],
    beforeTip,
  );
});

test('provider-acceptance process crash remains PENDING and requires explicit duplicate-risk retry', async (t) => {
  const fixture = createGitFixture(t);
  const prepared = await prepareRun(fixture, 'notification-acceptance-crash.json');
  await publishPipelineRunToGit({
    resultFile: prepared.resultFile,
    cwd: fixture.local,
  });
  const before = readCommittedPublication(prepared.profile, {
    reportsRoot: path.join(fixture.local, 'reports'),
  });
  const childScript = `
    const { notifyPublishedPipelineRun } = require(process.argv[1]);
    const profile = JSON.parse(process.argv[4]);
    notifyPublishedPipelineRun({
      resultFile: process.argv[2],
      cwd: process.argv[3],
      profile,
      transporter: {
        async sendMail(options) {
          return { accepted: ['reviewer@example.com'], rejected: [], messageId: options.messageId };
        }
      },
      config: { user: 'sender@example.com', recipients: 'reviewer@example.com' },
      faultInjector(operation) {
        if (operation === 'notification:provider-accepted') process.exit(88);
      }
    }).catch(() => process.exit(89));
  `;
  const crashed = spawnSync(process.execPath, [
    '-e',
    childScript,
    require.resolve('../notification-runner'),
    prepared.resultFile,
    fixture.local,
    JSON.stringify(prepared.profile),
  ], { encoding: 'utf8' });
  assert.equal(crashed.status, 88, crashed.stderr);

  const pending = readPipelineRunResult(prepared.resultFile);
  assert.equal(pending.state, 'PUBLISHED');
  assert.equal(pending.outcome, 'IN_PROGRESS');
  assert.equal(pending.notification.state, 'PENDING');
  assert.equal(pending.notification.attempts, 1);
  const firstKey = pending.notification.notificationKey;
  const firstMessageId = pending.notification.messageId;

  await assert.rejects(
    () => notifyPublishedPipelineRun({
      resultFile: prepared.resultFile,
      profile: prepared.profile,
      cwd: fixture.local,
      transporter: { async sendMail() { throw new Error('must not be called'); } },
      config: { user: 'sender@example.com', recipients: 'reviewer@example.com' },
    }),
    (error) => error.code === 'ERR_NOTIFICATION_RETRY_EXPLICIT_REQUIRED',
  );

  const retried = await notifyPublishedPipelineRun({
    resultFile: prepared.resultFile,
    profile: prepared.profile,
    cwd: fixture.local,
    retryNotification: true,
    transporter: {
      async sendMail(options) {
        return { accepted: ['reviewer@example.com'], rejected: [], messageId: options.messageId };
      },
    },
    config: { user: 'sender@example.com', recipients: 'reviewer@example.com' },
  });
  assert.equal(retried.result.state, 'NOTIFIED');
  assert.equal(retried.result.notification.attempts, 2);
  assert.equal(retried.result.notification.notificationKey, firstKey);
  assert.equal(retried.result.notification.messageId, firstMessageId);
  const after = readCommittedPublication(prepared.profile, {
    reportsRoot: path.join(fixture.local, 'reports'),
  });
  assert.deepEqual(after.history, before.history);
  assert.equal(after.manifest.publicationId, before.manifest.publicationId);
});

test('ambiguous SMTP acceptance is recorded as UNKNOWN without regressing PUBLISHED', async (t) => {
  const fixture = createGitFixture(t);
  const prepared = await prepareRun(fixture, 'notification-unknown.json');
  await publishPipelineRunToGit({
    resultFile: prepared.resultFile,
    cwd: fixture.local,
  });
  await assert.rejects(
    () => notifyPublishedPipelineRun({
      resultFile: prepared.resultFile,
      profile: prepared.profile,
      cwd: fixture.local,
      transporter: {
        async sendMail() {
          throw Object.assign(new Error('synthetic timeout after DATA'), {
            code: 'ETIMEDOUT',
            command: 'DATA',
          });
        },
      },
      config: { user: 'sender@example.com', recipients: 'reviewer@example.com' },
    }),
    (error) => error.code === 'ERR_NOTIFICATION_ACCEPTANCE_UNKNOWN',
  );
  const unknown = readPipelineRunResult(prepared.resultFile);
  assert.equal(unknown.state, 'PUBLISHED');
  assert.equal(unknown.outcome, 'NOTIFICATION_UNKNOWN');
  assert.equal(unknown.notification.state, 'UNKNOWN');
  assert.equal(unknown.notification.retryable, null);
  assert.equal(unknown.failure.deliveryUnknown, true);
  assert.equal(unknown.publication.remotePublished, true);
});
