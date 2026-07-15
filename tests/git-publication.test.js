const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const { runLeadPipeline } = require('../main');
const {
  publishPipelineRunToGit,
  recoverVerifiedRemotePublication,
} = require('../git-publication');
const { notifyPublishedPipelineRun } = require('../notification-runner');
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

async function prepareRun(fixture, resultName = 'result.json') {
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
          })];
        },
      },
      clock: () => new Date('2026-07-15T04:00:00.000Z'),
      runIdFactory: () => `run-${resultName.replace(/\W/g, '-')}`,
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

test('checksum tampering blocks notification before the transport is called', async (t) => {
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
  await assert.rejects(
    () => notifyPublishedPipelineRun({
      resultFile: prepared.resultFile,
      profile: prepared.profile,
      cwd: fixture.local,
      transporter: { async sendMail() { sendCount += 1; } },
      config: { user: 'sender@example.com', recipients: 'reviewer@example.com' },
    }),
    (error) => error.code === 'ERR_PUBLICATION_ARTIFACT_INVALID',
  );
  assert.equal(sendCount, 0);
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
