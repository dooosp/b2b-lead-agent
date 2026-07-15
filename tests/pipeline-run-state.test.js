const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  completePipelineRun,
  createPipelineRun,
  exitCodeForPipelineRun,
  readPipelineRunResult,
  transitionPipelineRun,
} = require('../pipeline-run-state');
const { parseCliArgs, runCli, runLeadPipeline } = require('../main');
const { createRootLead, createRootProfile } = require('./helpers/root-fixtures');

const FIXED_NOW = '2026-07-15T02:00:00.000Z';

function silentObs() {
  return {
    log() {},
    time() { return { end() {} }; },
    count() {},
    summary() {},
  };
}

function fixedDeps({ articles = [{}], leads = [createRootLead()] } = {}) {
  return {
    articleCollector: { async fetchIndustryNews() { return articles; } },
    leadQualifier: { async qualifyLeads() { return leads; } },
    clock: () => new Date(FIXED_NOW),
    runIdFactory: () => 'run-fixture-1',
    idFactory: () => 'lead-fixture-1',
    obs: silentObs(),
  };
}

function tempRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-run-state-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

test('pipeline lifecycle rejects skipped and regressing transitions', () => {
  const result = createPipelineRun({
    profileId: 'fixture-profile',
    clock: () => new Date(FIXED_NOW),
    runIdFactory: () => 'run-state-test',
  });
  assert.throws(() => transitionPipelineRun(result, 'VALIDATED'), /transition/i);
  transitionPipelineRun(result, 'GENERATED');
  assert.throws(() => transitionPipelineRun(result, 'STARTED'), /transition/i);
  transitionPipelineRun(result, 'VALIDATED');
  result.publication.localCommitted = true;
  result.publication.publicationId = 'pub-0123456789abcdef0123456789abcdef';
  completePipelineRun(result, 'READY_FOR_REMOTE_PUBLICATION');
  assert.equal(result.state, 'VALIDATED');
  assert.equal(result.terminal, true);
});

test('serialized results reject impossible state/outcome and remote-evidence combinations', (t) => {
  const root = tempRoot(t);
  const resultPath = path.join(root, 'impossible.json');
  const impossible = createPipelineRun({
    profileId: 'fixture-profile',
    clock: () => new Date(FIXED_NOW),
    runIdFactory: () => 'run-impossible',
  });
  impossible.state = 'NOTIFIED';
  impossible.outcome = 'NO_ARTICLES';
  impossible.terminal = true;
  impossible.completedAt = FIXED_NOW;
  fs.writeFileSync(resultPath, JSON.stringify(impossible), 'utf8');
  assert.throws(
    () => readPipelineRunResult(resultPath),
    (error) => error.code === 'ERR_PIPELINE_RESULT_INVALID',
  );

  impossible.state = 'PUBLISHED';
  impossible.outcome = 'PUBLISHED';
  impossible.publication.remotePublished = false;
  fs.writeFileSync(resultPath, JSON.stringify(impossible), 'utf8');
  assert.throws(
    () => readPipelineRunResult(resultPath),
    (error) => error.code === 'ERR_PIPELINE_RESULT_INVALID',
  );

  const terminal = createPipelineRun({
    profileId: 'fixture-profile',
    clock: () => new Date(FIXED_NOW),
    runIdFactory: () => 'run-terminal-type',
  });
  terminal.outcome = 'NO_ARTICLES';
  terminal.terminal = true;
  terminal.completedAt = FIXED_NOW;
  fs.writeFileSync(resultPath, JSON.stringify(terminal), 'utf8');
  assert.equal(readPipelineRunResult(resultPath).outcome, 'NO_ARTICLES');
  for (const invalidTerminal of [null, 'true', 1]) {
    const forged = structuredClone(terminal);
    forged.terminal = invalidTerminal;
    fs.writeFileSync(resultPath, JSON.stringify(forged), 'utf8');
    assert.throws(
      () => readPipelineRunResult(resultPath),
      (error) => error.code === 'ERR_PIPELINE_RESULT_INVALID',
    );
  }
});

test('CLI parses typed-result flags and refuses legacy pre-publication email', async () => {
  assert.deepEqual(parseCliArgs([
    '--profile', 'danfoss',
    '--notification-requested',
    '--result-file', '/tmp/result.json',
    '--attempt', '2',
  ]), {
    profileId: 'danfoss',
    resultFile: '/tmp/result.json',
    notificationRequested: true,
    legacyEmailRequested: false,
    attempt: 2,
    runId: null,
  });
  assert.equal(parseCliArgs(['--profile', 'danfoss', '--run-id', 'github-123']).runId, 'github-123');
  assert.equal(await runCli(['--profile', 'danfoss', '--email']), 2);
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  assert.match(packageJson.scripts.email, /notify-lead-publication\.mjs/);
  assert.doesNotMatch(packageJson.scripts.email, /main\.js|--email/);
});

test('zero articles and zero candidates produce durable typed no-change outcomes', async (t) => {
  const root = tempRoot(t);
  const profile = createRootProfile();
  const noArticlesPath = path.join(root, 'no-articles.json');
  const noArticles = await runLeadPipeline({
    profile,
    reportsRoot: path.join(root, 'reports'),
    resultFile: noArticlesPath,
    deps: fixedDeps({ articles: [], leads: [] }),
  });
  assert.equal(noArticles.state, 'STARTED');
  assert.equal(noArticles.outcome, 'NO_ARTICLES');
  assert.equal(JSON.parse(fs.readFileSync(noArticlesPath, 'utf8')).outcome, 'NO_ARTICLES');

  const noCandidatesPath = path.join(root, 'no-candidates.json');
  const noCandidates = await runLeadPipeline({
    profile,
    reportsRoot: path.join(root, 'reports'),
    resultFile: noCandidatesPath,
    deps: fixedDeps({ articles: [{}], leads: [] }),
  });
  assert.equal(noCandidates.state, 'GENERATED');
  assert.equal(noCandidates.outcome, 'NO_CANDIDATES');
  assert.equal(noCandidates.publication.remotePublished, false);
});

test('collection and generation failures are typed, retryable, and safely serialized', async (t) => {
  const root = tempRoot(t);
  const collectionPath = path.join(root, 'collection-failure.json');
  const collection = await runLeadPipeline({
    profile: createRootProfile(),
    resultFile: collectionPath,
    deps: {
      ...fixedDeps(),
      articleCollector: {
        async fetchIndustryNews() {
          throw new Error('Authorization: Bearer SYNTHETIC_COLLECTION_SECRET');
        },
      },
    },
  });
  assert.equal(collection.state, 'STARTED');
  assert.equal(collection.outcome, 'FAILED');
  assert.equal(collection.failure.code, 'ERR_COLLECTION_FAILED');
  assert.equal(collection.failure.stage, 'collection');
  assert.equal(collection.failure.retryable, true);
  assert.equal(exitCodeForPipelineRun(collection), 1);
  assert.doesNotMatch(fs.readFileSync(collectionPath, 'utf8'), /SYNTHETIC_COLLECTION_SECRET/);

  const generationPath = path.join(root, 'generation-failure.json');
  const generation = await runLeadPipeline({
    profile: createRootProfile(),
    resultFile: generationPath,
    deps: {
      ...fixedDeps(),
      leadQualifier: {
        async qualifyLeadsWithDiagnostics() {
          throw new Error('api_key=SYNTHETIC_GENERATION_SECRET');
        },
      },
    },
  });
  assert.equal(generation.state, 'STARTED');
  assert.equal(generation.outcome, 'FAILED');
  assert.equal(generation.failure.code, 'ERR_GENERATION_FAILED');
  assert.equal(generation.failure.stage, 'generation');
  assert.equal(generation.failure.retryable, true);
  assert.doesNotMatch(fs.readFileSync(generationPath, 'utf8'), /SYNTHETIC_GENERATION_SECRET/);

  const malformedCollection = await runLeadPipeline({
    profile: createRootProfile(),
    resultFile: path.join(root, 'malformed-collection.json'),
    deps: {
      ...fixedDeps(),
      articleCollector: {
        async fetchIndustryNews() { return { unavailable: true }; },
      },
    },
  });
  assert.equal(malformedCollection.outcome, 'FAILED');
  assert.equal(malformedCollection.failure.code, 'ERR_COLLECTION_FAILED');
  assert.equal(malformedCollection.failure.stage, 'collection');
  assert.equal(malformedCollection.failure.retryable, true);
});

test('raw generation diagnostics preserve all-invalid candidate counts', async (t) => {
  const root = tempRoot(t);
  const result = await runLeadPipeline({
    profile: createRootProfile(),
    reportsRoot: path.join(root, 'reports'),
    resultFile: path.join(root, 'all-generation-rejected.json'),
    deps: {
      ...fixedDeps(),
      leadQualifier: {
        async qualifyLeadsWithDiagnostics() {
          return {
            leads: [],
            candidatesGenerated: 2,
            candidatesRejected: 2,
          };
        },
      },
    },
  });
  assert.equal(result.state, 'VALIDATED');
  assert.equal(result.outcome, 'NO_VALID_LEADS');
  assert.equal(result.counts.candidatesGenerated, 2);
  assert.equal(result.counts.leadsRejected, 2);
  assert.equal(result.counts.leadsValidated, 0);
  assert.equal(fs.existsSync(path.join(root, 'reports')), false);
});

test('all rejected candidates fail closed as NO_VALID_LEADS before artifact mutation', async (t) => {
  const root = tempRoot(t);
  const reportsRoot = path.join(root, 'reports');
  const result = await runLeadPipeline({
    profile: createRootProfile(),
    reportsRoot,
    resultFile: path.join(root, 'result.json'),
    deps: fixedDeps({
      leads: [createRootLead({ score: 999 })],
    }),
  });
  assert.equal(result.state, 'VALIDATED');
  assert.equal(result.outcome, 'NO_VALID_LEADS');
  assert.equal(result.counts.leadsValidated, 0);
  assert.equal(result.counts.leadsRejected, 1);
  assert.equal(result.failure.code, 'ERR_NO_VALID_LEADS');
  assert.equal(fs.existsSync(reportsRoot), false);
});

test('secret-shaped public values are rejected before any artifact mutation', async (t) => {
  const root = tempRoot(t);
  const reportsRoot = path.join(root, 'reports');
  const result = await runLeadPipeline({
    profile: createRootProfile(),
    reportsRoot,
    resultFile: path.join(root, 'secret-shaped.json'),
    deps: fixedDeps({
      leads: [createRootLead({
        salesPitch: 'Authorization: Bearer FAKE_SECRET_TOKEN_VALUE',
        sources: [{
          title: 'Synthetic unsafe source',
          url: 'http://127.0.0.1/private?api_key=FAKE_KEY_VALUE',
        }],
      })],
    }),
  });
  assert.equal(result.outcome, 'NO_VALID_LEADS');
  assert.equal(result.failure.code, 'ERR_NO_VALID_LEADS');
  assert.equal(fs.existsSync(reportsRoot), false);
  assert.doesNotMatch(JSON.stringify(result), /FAKE_SECRET|FAKE_KEY|127\.0\.0\.1/);
});

test('ordinary public hostnames beginning with fc or fd remain valid', async (t) => {
  const root = tempRoot(t);
  const reportsRoot = path.join(root, 'reports');
  const result = await runLeadPipeline({
    profile: createRootProfile(),
    reportsRoot,
    resultFile: path.join(root, 'public-fc-host.json'),
    deps: fixedDeps({
      leads: [createRootLead({
        sources: [{
          title: 'Synthetic public source',
          url: 'https://fcdomain.example/news',
        }],
      })],
    }),
  });

  assert.equal(result.outcome, 'READY_FOR_REMOTE_PUBLICATION');
  assert.equal(result.counts.leadsValidated, 1);
  assert.equal(result.counts.leadsRejected, 0);
});

test('mixed candidates publish only validated public leads and count each rejection', async (t) => {
  const root = tempRoot(t);
  const reportsRoot = path.join(root, 'reports');
  const profile = createRootProfile();
  const result = await runLeadPipeline({
    profile,
    reportsRoot,
    resultFile: path.join(root, 'mixed.json'),
    deps: fixedDeps({
      leads: [createRootLead(), createRootLead({ company: 'Invalid Score', score: -1 })],
    }),
  });
  assert.equal(result.outcome, 'READY_FOR_REMOTE_PUBLICATION');
  assert.equal(result.counts.candidatesGenerated, 2);
  assert.equal(result.counts.leadsValidated, 1);
  assert.equal(result.counts.leadsRejected, 1);
  const latest = JSON.parse(fs.readFileSync(
    path.join(reportsRoot, profile.id, 'latest-leads.json'),
    'utf8',
  ));
  assert.equal(latest.length, 1);
  assert.equal(latest[0].company, 'LG전자');
});

test('publication replay distinguishes run resume, run conflict, and different-run no-change', async (t) => {
  const root = tempRoot(t);
  const reportsRoot = path.join(root, 'reports');
  const profile = createRootProfile();
  const first = await runLeadPipeline({
    profile,
    requestId: 'request-a',
    reportsRoot,
    resultFile: path.join(root, 'first.json'),
    notificationRequested: true,
    deps: fixedDeps(),
  });
  assert.equal(first.state, 'VALIDATED');
  assert.equal(first.outcome, 'READY_FOR_REMOTE_PUBLICATION');
  assert.equal(first.publication.localCommitted, true);
  assert.equal(first.publication.remotePublished, false);
  assert.equal(first.notification.state, 'BLOCKED');
  assert.equal(first.counts.candidatesGenerated, first.counts.leadsValidated + first.counts.leadsRejected);

  const manifestPath = path.join(reportsRoot, profile.id, 'publication-manifest.json');
  const firstManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(firstManifest.schemaVersion, 2);
  assert.equal(firstManifest.runId, first.runId);
  const before = fs.statSync(manifestPath).mtimeMs;
  const replay = await runLeadPipeline({
    profile,
    requestId: 'request-a',
    reportsRoot,
    resultFile: path.join(root, 'replay.json'),
    notificationRequested: true,
    deps: fixedDeps(),
  });
  assert.equal(replay.state, 'VALIDATED');
  assert.equal(replay.outcome, 'RUN_REPLAY_REQUIRES_RESUME');
  assert.equal(replay.failure.code, 'ERR_RUN_REPLAY_REQUIRES_RESUME');
  assert.equal(replay.publication.publicationId, first.publication.publicationId);
  assert.deepEqual(replay.publication.artifactPaths, []);
  assert.equal(fs.statSync(manifestPath).mtimeMs, before);

  const conflict = await runLeadPipeline({
    profile,
    requestId: 'request-a',
    reportsRoot,
    resultFile: path.join(root, 'conflict.json'),
    deps: fixedDeps({ leads: [createRootLead({ summary: 'Changed logical lead content' })] }),
  });
  assert.equal(conflict.outcome, 'FAILED');
  assert.equal(conflict.failure.code, 'ERR_RUN_ID_CONFLICT');
  assert.equal(conflict.failure.stage, 'replay');
  assert.equal(fs.statSync(manifestPath).mtimeMs, before);

  const second = await runLeadPipeline({
    profile,
    requestId: 'request-b',
    reportsRoot,
    resultFile: path.join(root, 'second.json'),
    notificationRequested: true,
    deps: {
      ...fixedDeps(),
      runIdFactory: () => 'run-fixture-2',
    },
  });
  assert.equal(second.state, 'VALIDATED');
  assert.equal(second.outcome, 'NO_ARTIFACT_CHANGE');
  assert.equal(second.publication.publicationId, first.publication.publicationId);
  assert.deepEqual(second.publication.artifactPaths, []);
  assert.equal(fs.statSync(manifestPath).mtimeMs, before);
});

test('valid REQUEST_ID values derive a stable profile-scoped run identity', async (t) => {
  const root = tempRoot(t);
  const profile = createRootProfile();
  const baseDeps = fixedDeps({ articles: [], leads: [] });
  delete baseDeps.runIdFactory;
  const first = await runLeadPipeline({
    profile,
    requestId: 'dispatch-42',
    resultFile: path.join(root, 'derived-first.json'),
    deps: baseDeps,
  });
  const second = await runLeadPipeline({
    profile,
    requestId: 'dispatch-42',
    resultFile: path.join(root, 'derived-second.json'),
    deps: baseDeps,
  });
  assert.equal(first.runId, second.runId);
  assert.match(first.runId, /^run-[a-f0-9]{32}$/);
});

test('run identity remains claimed across intervening publications', async (t) => {
  const root = tempRoot(t);
  const reportsRoot = path.join(root, 'reports');
  const profile = createRootProfile();
  const run = async (name, runId, lead) => runLeadPipeline({
    profile,
    runId,
    reportsRoot,
    resultFile: path.join(root, `${name}.json`),
    notificationRequested: true,
    deps: fixedDeps({ leads: [lead] }),
  });

  const first = await run('first-a', 'stable-run-a', createRootLead());
  assert.equal(first.outcome, 'READY_FOR_REMOTE_PUBLICATION');
  const second = await run(
    'second-b',
    'stable-run-b',
    createRootLead({ company: 'Intervening B', summary: 'Intervening logical content B' }),
  );
  assert.equal(second.outcome, 'READY_FOR_REMOTE_PUBLICATION');

  const replay = await run('replay-a', 'stable-run-a', createRootLead());
  assert.equal(replay.outcome, 'RUN_REPLAY_REQUIRES_RESUME');
  assert.equal(replay.failure.code, 'ERR_RUN_REPLAY_REQUIRES_RESUME');
  assert.equal(replay.publication.publicationId, first.publication.publicationId);
  const pointerAfterReplay = JSON.parse(fs.readFileSync(
    path.join(reportsRoot, profile.id, 'publication-manifest.json'),
    'utf8',
  ));
  assert.equal(pointerAfterReplay.publicationId, second.publication.publicationId);

  const conflict = await run(
    'conflict-a',
    'stable-run-a',
    createRootLead({ company: 'Conflicting A', summary: 'Reused run identity with different input' }),
  );
  assert.equal(conflict.outcome, 'FAILED');
  assert.equal(conflict.failure.code, 'ERR_RUN_ID_CONFLICT');
  const pointerAfterConflict = JSON.parse(fs.readFileSync(
    path.join(reportsRoot, profile.id, 'publication-manifest.json'),
    'utf8',
  ));
  assert.equal(pointerAfterConflict.publicationId, second.publication.publicationId);
});

test('notification outcome fields cannot contradict notification state or recipient counts', (t) => {
  const root = tempRoot(t);
  const resultPath = path.join(root, 'forged-notification.json');
  const result = createPipelineRun({
    profileId: 'fixture-profile',
    notificationRequested: true,
    clock: () => new Date(FIXED_NOW),
    runIdFactory: () => 'run-forged-notification',
  });
  result.state = 'PUBLISHED';
  result.outcome = 'NOTIFICATION_UNKNOWN';
  result.terminal = true;
  result.completedAt = FIXED_NOW;
  result.publication.remotePublished = true;
  result.publication.commitSha = 'a'.repeat(40);
  result.publication.remoteRef = 'refs/heads/master';
  result.notification.state = 'PENDING';
  result.notification.notificationKey = 'b'.repeat(64);
  result.notification.messageId = `<lead-report-${'b'.repeat(40)}@b2b-lead-agent.local>`;
  result.notification.intendedRecipientCount = 1;
  result.notification.attempts = 1;
  result.failure = {
    code: 'ERR_NOTIFICATION_ACCEPTANCE_UNKNOWN',
    stage: 'notification',
    retryable: null,
    safeMessage: 'Acceptance is unknown.',
    deliveryUnknown: true,
  };
  fs.writeFileSync(resultPath, JSON.stringify(result), 'utf8');
  assert.throws(
    () => readPipelineRunResult(resultPath),
    (error) => error.code === 'ERR_PIPELINE_RESULT_INVALID',
  );

  result.notification.state = 'UNKNOWN';
  result.notification.acceptedRecipientCount = 2;
  fs.writeFileSync(resultPath, JSON.stringify(result), 'utf8');
  assert.throws(
    () => readPipelineRunResult(resultPath),
    (error) => error.code === 'ERR_PIPELINE_RESULT_INVALID',
  );

  const accepted = createPipelineRun({
    profileId: 'fixture-profile',
    notificationRequested: true,
    clock: () => new Date(FIXED_NOW),
    runIdFactory: () => 'run-forged-accepted-notification',
  });
  accepted.state = 'NOTIFIED';
  accepted.outcome = 'NOTIFIED';
  accepted.terminal = true;
  accepted.completedAt = FIXED_NOW;
  accepted.publication.remotePublished = true;
  accepted.publication.commitSha = 'a'.repeat(40);
  accepted.publication.remoteRef = 'refs/heads/master';
  accepted.notification.state = 'ACCEPTED';
  accepted.notification.notificationKey = 'c'.repeat(64);
  accepted.notification.messageId = `<lead-report-${'c'.repeat(40)}@b2b-lead-agent.local>`;
  accepted.notification.intendedRecipientCount = 1;
  accepted.notification.acceptedRecipientCount = 1;
  accepted.notification.attempts = 1;
  accepted.notification.acceptance = 'ACCEPTED';
  accepted.notification.retryable = false;
  accepted.notification.recipientDeliveryConfirmed = false;
  fs.writeFileSync(resultPath, JSON.stringify(accepted), 'utf8');
  assert.equal(readPipelineRunResult(resultPath).outcome, 'NOTIFIED');

  for (const mutation of [
    (value) => { value.notification.acceptance = 'UNKNOWN'; },
    (value) => { value.notification.messageId = `<lead-report-${'d'.repeat(40)}@b2b-lead-agent.local>`; },
    (value) => { value.notification.retryable = true; },
    (value) => { value.notification.recipientDeliveryConfirmed = true; },
  ]) {
    const forged = structuredClone(accepted);
    mutation(forged);
    fs.writeFileSync(resultPath, JSON.stringify(forged), 'utf8');
    assert.throws(
      () => readPipelineRunResult(resultPath),
      (error) => error.code === 'ERR_PIPELINE_RESULT_INVALID',
    );
  }

  const failed = createPipelineRun({
    profileId: 'fixture-profile',
    notificationRequested: true,
    clock: () => new Date(FIXED_NOW),
    runIdFactory: () => 'run-forged-failed-notification',
  });
  failed.state = 'PUBLISHED';
  failed.outcome = 'NOTIFICATION_FAILED';
  failed.terminal = true;
  failed.completedAt = FIXED_NOW;
  failed.publication.remotePublished = true;
  failed.publication.commitSha = 'a'.repeat(40);
  failed.publication.remoteRef = 'refs/heads/master';
  failed.notification.state = 'FAILED';
  failed.notification.notificationKey = 'e'.repeat(64);
  failed.notification.messageId = `<lead-report-${'e'.repeat(40)}@b2b-lead-agent.local>`;
  failed.notification.intendedRecipientCount = 1;
  failed.notification.attempts = 1;
  failed.notification.acceptance = 'NOT_ACCEPTED';
  failed.notification.retryable = true;
  failed.failure = {
    code: 'ERR_NOTIFICATION_TRANSIENT',
    stage: 'notification',
    retryable: true,
    safeMessage: 'Notification transport failed.',
    deliveryUnknown: false,
  };
  fs.writeFileSync(resultPath, JSON.stringify(failed), 'utf8');
  assert.equal(readPipelineRunResult(resultPath).outcome, 'NOTIFICATION_FAILED');
  for (const mutation of [
    (value) => { value.failure.retryable = false; },
    (value) => { value.failure.stage = 'collection'; },
    (value) => { value.notification.retryRequiresExplicitCommand = false; },
    (value) => { value.notification.deliveryGuarantee = 'EXACTLY_ONCE'; },
  ]) {
    const forged = structuredClone(failed);
    mutation(forged);
    fs.writeFileSync(resultPath, JSON.stringify(forged), 'utf8');
    assert.throws(
      () => readPipelineRunResult(resultPath),
      (error) => error.code === 'ERR_PIPELINE_RESULT_INVALID',
    );
  }
});

test('post-pointer local fault is reconciled as READY instead of false FAILED', async (t) => {
  const root = tempRoot(t);
  const reportsRoot = path.join(root, 'reports');
  const profile = createRootProfile();
  const result = await runLeadPipeline({
    profile,
    reportsRoot,
    resultFile: path.join(root, 'post-pointer.json'),
    deps: {
      ...fixedDeps(),
      publicationFaultInjector(operation) {
        if (operation === 'pointer:rename') {
          throw Object.assign(new Error('synthetic post-pointer fault'), { code: 'ERR_TEST_FAULT' });
        }
      },
    },
  });

  assert.equal(result.state, 'VALIDATED');
  assert.equal(result.outcome, 'READY_FOR_REMOTE_PUBLICATION');
  assert.equal(result.publication.localCommitted, true);
  assert.equal(result.failure, null);
  const manifest = JSON.parse(fs.readFileSync(
    path.join(reportsRoot, profile.id, 'publication-manifest.json'),
    'utf8',
  ));
  assert.equal(manifest.publicationId, result.publication.publicationId);
});
