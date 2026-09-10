const test = require('node:test');
const assert = require('node:assert/strict');
const {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const SCRIPT = 'scripts/audit-pursuit-golden-dataset.mjs';
const CANDIDATES_PATH =
  'knowledge/golden-dataset/datacenter-kr-v0/public-source-candidates.json';
const AUDIT_OUTPUT_PATH =
  'tmp/codex/pursuit-golden-dataset-audit-non-production.json';

function run(args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
}

async function loadReportValidator() {
  return import(pathToFileURL(join(
    process.cwd(),
    'scripts/lib/golden-dataset-report-validation.mjs',
  )));
}

test('Golden Dataset CLI writes the deterministic additive-v1 human-confirmed audit', () => {
  const output = join(process.cwd(), AUDIT_OUTPUT_PATH);
  const checkedIn = readFileSync(output, 'utf8');
  const first = run(['--json', '--output', AUDIT_OUTPUT_PATH, '--fail-on-violations']);
  assert.equal(first.status, 0, first.stderr || first.stdout);
  const firstWrite = readFileSync(output, 'utf8');
  assert.equal(firstWrite, checkedIn);
  const report = JSON.parse(firstWrite);
  assert.equal(report.documentStatus, 'PURSUIT_GOLDEN_DATASET_AUDIT_PASS');
  assert.equal(report.datasetState, 'HUMAN_CONFIRMED');
  assert.equal(report.goldenReady, true);
  assert.equal(report.productionReady, false);
  assert.equal(report.summary.projectCandidateCount, 17);
  assert.equal(report.summary.publicSourceDocumentCandidateCount, 39);
  assert.equal(report.summary.candidateStageCount, 5);
  assert.equal(report.summary.humanConfirmedProjectCount, 17);
  assert.equal(report.summary.humanConfirmedCapabilityClaimCount, 30);
  assert.equal(report.summary.humanConfirmedPairCount, 10);
  assert.equal(report.summary.humanConfirmedRevisionLinkCount, 1);
  assert.equal(report.summary.humanConfirmedStageCount, 5);
  assert.equal(report.summary.pendingProjectCount, 0);
  assert.deepEqual(report.summary.thresholdGaps, []);
  assert.deepEqual(report.violations, []);

  const second = run(['--json', '--output', AUDIT_OUTPUT_PATH, '--fail-on-violations']);
  assert.equal(second.status, 0, second.stderr || second.stdout);
  assert.equal(readFileSync(output, 'utf8'), firstWrite);
  assert.deepEqual(JSON.parse(second.stdout), report);
});

test('Golden Dataset CLI accepts checked-in Golden readiness while preserving production hold', () => {
  const result = run(['--json', '--require-golden-ready']);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.documentStatus, 'PURSUIT_GOLDEN_DATASET_AUDIT_PASS');
  assert.equal(report.datasetState, 'HUMAN_CONFIRMED');
  assert.equal(report.goldenReady, true);
  assert.equal(report.productionReady, false);
  assert.deepEqual(report.summary.thresholdGaps, []);
});

test('Golden Dataset CLI emits a bounded failure artifact for invalid candidate input', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pursuit-golden-invalid-'));
  const candidatesPath = join(dir, 'candidates.json');
  try {
    const candidates = JSON.parse(readFileSync(CANDIDATES_PATH, 'utf8'));
    candidates.projects[0].fitResult = 'FIT';
    writeFileSync(candidatesPath, `${JSON.stringify(candidates, null, 2)}\n`);
    const result = run([
      '--json',
      '--candidates',
      candidatesPath,
      '--fail-on-violations',
    ]);
    assert.equal(result.status, 1, result.stderr || result.stdout);
    const report = JSON.parse(result.stdout);
    assert.equal(report.documentStatus, 'PURSUIT_GOLDEN_DATASET_AUDIT_FAIL');
    assert.equal(report.datasetState, 'INVALID');
    assert.equal(report.goldenReady, false);
    assert.deepEqual(report.violations, [{
      reasonCode: 'HUMAN_AUTHORITY_FIELD_REFUSED_IN_CANDIDATE_INPUT',
      path: '$.candidates.projects[0].fitResult',
    }]);
    assert.equal(JSON.stringify(report).includes('FIT'), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Golden Dataset report validation rejects a tampered canonical hash', async () => {
  const { validateGoldenDatasetAuditReport } = await loadReportValidator();
  const {
    canonicalStringify,
    sha256,
  } = await import(pathToFileURL(join(
    process.cwd(),
    'knowledge/claim-registry/index.mjs',
  )));
  const result = run(['--json']);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  report.summary.projectCandidateCount += 1;
  assert.throws(
    () => validateGoldenDatasetAuditReport(report),
    (error) => error?.code === 'GOLDEN_DATASET_AUDIT_HASH_MISMATCH',
  );

  const forgedDatasetHash = JSON.parse(result.stdout);
  forgedDatasetHash.datasetCanonicalSha256 = 'not-a-canonical-hash';
  const { canonicalSha256: ignored, ...withoutHash } = forgedDatasetHash;
  void ignored;
  forgedDatasetHash.canonicalSha256 = sha256(canonicalStringify(withoutHash));
  assert.throws(
    () => validateGoldenDatasetAuditReport(forgedDatasetHash),
    (error) => error?.code === 'GOLDEN_DATASET_CANONICAL_HASH_INVALID',
  );
});
