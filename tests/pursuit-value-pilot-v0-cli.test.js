const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const PRIVATE_RELATIVE_ROOT = 'tmp/pursuit-value-pilot-v0';
const PROTOCOL_ARTIFACT = 'tmp/codex/pursuit-value-pilot-v0-protocol.json';
const READINESS_ARTIFACT = 'tmp/codex/pursuit-value-pilot-v0-readiness-non-production.json';

const COPY_PATHS = [
  'knowledge/claim-registry',
  'verticals/datacenter',
  'eval/fixtures/spec-fit/datacenter-v0-scenarios.json',
  'scripts/lib/repository-claim-registry.mjs',
  'scripts/lib/pursuit-value-pilot-offline-html.mjs',
  'scripts/lib/pursuit-value-pilot-files.mjs',
  'scripts/evaluate-pursuit-value-pilot-v0.mjs',
];

function createHarness(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pursuit-value-pilot-cli-'));
  for (const relativePath of COPY_PATHS) {
    const source = path.join(REPO_ROOT, relativePath);
    const destination = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.cpSync(source, destination, { recursive: true });
  }
  fs.mkdirSync(path.join(root, 'tmp'), { recursive: true, mode: 0o755 });
  fs.chmodSync(path.join(root, 'tmp'), 0o755);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function run(root, args = []) {
  return spawnSync(
    process.execPath,
    [path.join(root, 'scripts/evaluate-pursuit-value-pilot-v0.mjs'), ...args],
    {
      cwd: root,
      encoding: 'utf8',
      env: { PATH: process.env.PATH || '' },
    },
  );
}

function successfulReport(root, args = []) {
  const result = run(root, args);
  assert.equal(result.status, 0, result.stdout || result.stderr);
  assert.equal(result.stderr, '');
  return JSON.parse(result.stdout);
}

test('evaluate emits a deterministic readiness report without touching private human intake', (t) => {
  const root = createHarness(t);
  const first = successfulReport(root);
  const second = successfulReport(root);
  assert.deepEqual(first, second);
  assert.equal(first.documentStatus, 'READY_FOR_HUMAN_SESSIONS');
  assert.equal(first.boundary, 'NOT_PRODUCTION_EVIDENCE');
  assert.equal(first.productionReady, false);
  assert.equal(first.productionReviewerWorkflowReady, false);
  assert.equal(first.issue165Status, 'HOLD');
  assert.equal(first.humanEvidenceStatus, 'INCOMPLETE');
  assert.equal(first.systemFinalDecisionAcceptance, 'NOT_MEASURABLE_NO_SYSTEM_FINAL_DECISION');
  assert.equal(first.automaticPilotDecision, false);
  assert.equal(first.pilotDisposition, 'NOT_MADE');
  assert.equal(first.readiness.protocolValid, true);
  assert.equal(first.readiness.blankSkeletonAggregateValid, true);
  assert.equal(first.readiness.repeatEquality, true);
  assert.equal(first.readiness.readyForHumanSessions, true);
  assert.equal(first.readiness.humanSessionsExecuted, false);
  assert.equal(first.readiness.privateIntakeTouched, false);
  assert.equal(first.readiness.externalCalls, 0);
  assert.equal(first.counts.syntheticCaseCount, 5);
  assert.equal(first.counts.reviewerTemplateCount, 5);
  assert.equal(first.counts.teamWeekTemplateCount, 1);
  assert.equal(first.counts.eligibleCompletedReviewerCount, 0);
  assert.equal(first.counts.completedTeamWeekCount, 0);
  assert.match(first.canonicalSha256, /^[a-f0-9]{64}$/);
  for (const digest of Object.values(first.hashes)) assert.match(digest, /^[a-f0-9]{64}$/);
  assert.equal(fs.existsSync(path.join(root, PRIVATE_RELATIVE_ROOT)), false);
  assert.equal(fs.existsSync(path.join(root, PROTOCOL_ARTIFACT)), false);
  assert.equal(fs.existsSync(path.join(root, READINESS_ARTIFACT)), false);
});

test('the one fixed write flag writes only canonical protocol and readiness artifacts', (t) => {
  const firstRoot = createHarness(t);
  const secondRoot = createHarness(t);
  const first = successfulReport(firstRoot, ['--write-canonical-artifacts']);
  const second = successfulReport(secondRoot, ['--write-canonical-artifacts']);
  assert.deepEqual(first, second);
  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(firstRoot, READINESS_ARTIFACT), 'utf8')),
    first,
  );
  assert.deepEqual(
    fs.readFileSync(path.join(firstRoot, PROTOCOL_ARTIFACT)),
    fs.readFileSync(path.join(secondRoot, PROTOCOL_ARTIFACT)),
  );
  const protocol = JSON.parse(fs.readFileSync(
    path.join(firstRoot, PROTOCOL_ARTIFACT),
    'utf8',
  ));
  assert.equal(first.hashes.protocolCanonicalSha256, protocol.canonicalSha256);
  assert.deepEqual(
    fs.readdirSync(path.join(firstRoot, 'tmp/codex')).sort(),
    [path.basename(PROTOCOL_ARTIFACT), path.basename(READINESS_ARTIFACT)].sort(),
  );
  assert.equal(fs.existsSync(path.join(firstRoot, PRIVATE_RELATIVE_ROOT)), false);
});

test('unknown, output, duplicate, and traversal-like arguments are refused without writes', async (t) => {
  for (const args of [
    ['--json'],
    ['--output', 'tmp/out.json'],
    ['--output', '../../escaped.json'],
    ['--write-canonical-artifacts', '--write-canonical-artifacts'],
    ['../outside'],
  ]) {
    await t.test(args.join(' '), () => {
      const root = createHarness(t);
      const result = run(root, args);
      assert.equal(result.status, 1, result.stdout || result.stderr);
      assert.equal(result.stderr, '');
      const report = JSON.parse(result.stdout);
      assert.equal(report.documentStatus, 'INVALID');
      assert.deepEqual(report.failureCodes, ['PILOT_CLI_ARGUMENT_REFUSED']);
      assert.equal(report.productionReady, false);
      assert.equal(report.pilotDisposition, 'NOT_MADE');
      assert.equal(fs.existsSync(path.join(root, PRIVATE_RELATIVE_ROOT)), false);
      assert.equal(fs.existsSync(path.join(root, 'tmp/codex')), false);
      assert.equal(fs.existsSync(path.resolve(root, '../../escaped.json')), false);
    });
  }
});

test('fixed canonical writes refuse symlinked parents and artifact targets', async (t) => {
  await t.test('symlinked tmp/codex parent', () => {
    const root = createHarness(t);
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'pursuit-value-pilot-output-'));
    t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
    fs.symlinkSync(outside, path.join(root, 'tmp/codex'));
    const result = run(root, ['--write-canonical-artifacts']);
    assert.equal(result.status, 1, result.stdout || result.stderr);
    assert.deepEqual(
      JSON.parse(result.stdout).failureCodes,
      ['PILOT_CANONICAL_ARTIFACT_DIRECTORY_UNSAFE'],
    );
    assert.deepEqual(fs.readdirSync(outside), []);
  });

  await t.test('symlinked fixed artifact target', () => {
    const root = createHarness(t);
    fs.mkdirSync(path.join(root, 'tmp/codex'), { mode: 0o755 });
    const outside = path.join(root, 'outside.json');
    fs.writeFileSync(outside, 'preserve');
    fs.symlinkSync(outside, path.join(root, PROTOCOL_ARTIFACT));
    const result = run(root, ['--write-canonical-artifacts']);
    assert.equal(result.status, 1, result.stdout || result.stderr);
    assert.deepEqual(
      JSON.parse(result.stdout).failureCodes,
      ['PILOT_CANONICAL_ARTIFACT_SYMLINK_REFUSED'],
    );
    assert.equal(fs.readFileSync(outside, 'utf8'), 'preserve');
    assert.equal(fs.existsSync(path.join(root, READINESS_ARTIFACT)), false);
  });
});
