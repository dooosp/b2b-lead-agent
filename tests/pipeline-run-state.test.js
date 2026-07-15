const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  completePipelineRun,
  createPipelineRun,
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
  completePipelineRun(result, 'READY_FOR_REMOTE_PUBLICATION');
  assert.equal(result.state, 'VALIDATED');
  assert.equal(result.terminal, true);
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
  });
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

test('local publication stops at VALIDATED and an identical rerun is NO_CHANGE', async (t) => {
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
  const before = fs.statSync(manifestPath).mtimeMs;
  const second = await runLeadPipeline({
    profile,
    requestId: 'request-b',
    reportsRoot,
    resultFile: path.join(root, 'second.json'),
    notificationRequested: true,
    deps: fixedDeps(),
  });
  assert.equal(second.state, 'VALIDATED');
  assert.equal(second.outcome, 'NO_CHANGE');
  assert.equal(second.publication.publicationId, first.publication.publicationId);
  assert.deepEqual(second.publication.artifactPaths, []);
  assert.equal(fs.statSync(manifestPath).mtimeMs, before);

  const changed = await runLeadPipeline({
    profile,
    requestId: 'request-a',
    reportsRoot,
    resultFile: path.join(root, 'changed.json'),
    deps: fixedDeps({ leads: [createRootLead({ summary: 'Changed logical lead content' })] }),
  });
  assert.equal(changed.outcome, 'READY_FOR_REMOTE_PUBLICATION');
  assert.notEqual(changed.publication.publicationId, first.publication.publicationId);
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
