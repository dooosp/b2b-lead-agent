const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function run(script, args) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.stderr, '');
  return JSON.parse(result.stdout);
}

test('claim audit CLI scans current sources and emits stable strict metrics', () => {
  const one = run('scripts/audit-evidence-claims.mjs', ['--json', '--fail-on-violations']);
  const two = run('scripts/audit-evidence-claims.mjs', ['--json', '--fail-on-violations']);
  assert.equal(one.documentStatus, 'EVIDENCE_CLAIM_AUDIT_PASS');
  assert.equal(one.canonicalSha256, two.canonicalSha256);
  assert.deepEqual(one.summary, two.summary);
  assert.equal(one.summary.totalClaimCandidates, 179);
  assert.equal(one.summary.legacyClaimCandidates, 160);
  assert.equal(one.summary.registryClaims, 19);
  assert.equal(one.summary.verified, 13);
  assert.equal(one.summary.conflicted, 2);
  assert.equal(one.summary.customerUseBlocked, 166);
  assert.equal(one.summary.violations, 0);
  assert.equal(one.productionReady, false);
});

test('spec-fit evaluation CLI is deterministic and enforces every strict gate', () => {
  const one = run('scripts/evaluate-spec-fit.mjs', ['--fixtures', '--json', '--repeat', '2']);
  const two = run('scripts/evaluate-spec-fit.mjs', ['--fixtures', '--json', '--repeat', '2']);
  assert.equal(one.documentStatus, 'SPECIFICATION_FIT_EVALUATION_PASS');
  assert.equal(one.canonicalSha256, two.canonicalSha256);
  assert.equal(one.summary.scenarioCount, 30);
  assert.equal(one.summary.passed, 30);
  assert.equal(one.summary.failed, 0);
  assert.equal(one.summary.unverifiedCustomerClaimLeakage, 0);
  assert.equal(one.summary.secretLeakage, 0);
  for (const metric of ['expectedResultAccuracyBasisPoints', 'fitTraceabilityBasisPoints', 'hardMismatchAccuracyBasisPoints', 'missingRequirementRecallBasisPoints', 'conflictDetectionBasisPoints', 'stageWindowAccuracyBasisPoints', 'repeatHashEqualityBasisPoints']) {
    assert.equal(one.summary[metric], 10_000, metric);
  }
});
