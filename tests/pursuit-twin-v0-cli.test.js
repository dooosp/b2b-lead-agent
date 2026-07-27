const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const {
  mkdtempSync,
  readFileSync,
  rmSync,
} = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const script = 'scripts/evaluate-pursuit-twin-v0.mjs';

function run(args) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.stderr, '');
  return JSON.parse(result.stdout);
}

test('Pursuit Twin v0 CLI emits a deterministic strict non-production report', () => {
  const first = run(['--json', '--repeat', '2']);
  const second = run(['--json', '--repeat', '2']);

  assert.equal(first.documentStatus, 'PURSUIT_TWIN_V0_EVALUATION_PASS');
  assert.equal(first.canonicalSha256, second.canonicalSha256);
  assert.deepEqual(first.summary, second.summary);
  assert.equal(first.boundary, 'NOT_PRODUCTION_EVIDENCE');
  assert.equal(first.productionReady, false);
  assert.equal(first.issue165Status, 'HOLD');
  assert.equal(first.summary.scenarioCount, 4);
  assert.equal(first.summary.passed, 4);
  assert.equal(first.summary.failed, 0);
  for (const metric of [
    'strictScenarioAccuracyBasisPoints',
    'specDeltaAccuracyBasisPoints',
    'decisionInvalidationAccuracyBasisPoints',
    'minimumEvidenceAccuracyBasisPoints',
    'repeatHashEqualityBasisPoints',
  ]) assert.equal(first.summary[metric], 10_000, metric);
  for (const metric of [
    'automaticDecisionChanges',
    'fitGuaranteeClaims',
    'productionReadyClaims',
    'counterfactualExecutions',
    'secretLeakage',
    'externalCalls',
  ]) assert.equal(first.summary[metric], 0, metric);
  assert.equal(Object.hasOwn(first, 'fixtureReviewPacket'), false);
});

test('Pursuit Twin v0 CLI writes stable report and review-packet artifacts on request', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'pursuit-twin-v0-'));
  const reportPath = path.join(directory, 'report.json');
  const packetJsonPath = path.join(directory, 'packet.json');
  const packetMarkdownPath = path.join(directory, 'packet.md');
  try {
    const report = run([
      '--repeat', '2',
      '--output', reportPath,
      '--packet-json', packetJsonPath,
      '--packet-markdown', packetMarkdownPath,
    ]);
    assert.deepEqual(JSON.parse(readFileSync(reportPath, 'utf8')), report);
    const packet = JSON.parse(readFileSync(packetJsonPath, 'utf8'));
    const markdown = readFileSync(packetMarkdownPath, 'utf8');
    assert.equal(packet.schemaVersion, 'pursuit-twin-review-packet-v0');
    assert.equal(packet.productionReady, false);
    assert.equal(packet.finalHumanDecision, 'NOT_MADE');
    assert.equal(packet.specificationDelta.decisionReview.state, 'REVIEW_REQUIRED');
    assert.equal(packet.minimumEvidenceToAdvance.fitGuarantee, false);
    assert.match(markdown, /# Pursuit Twin v0 Review Packet/);
    assert.match(markdown, /FIT guarantee: false/);
    assert.match(markdown, /Human decision review: REVIEW\\_REQUIRED/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
