const test = require('node:test');
const assert = require('node:assert/strict');
const {
  mkdtempSync,
  readFileSync,
  rmSync,
} = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const SCRIPT = 'scripts/prepare-pursuit-golden-human-review.mjs';

function moduleUrl(relativePath) {
  return pathToFileURL(join(process.cwd(), relativePath));
}

function run(args = []) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
}

test('human review batch pins ten projects and all current review candidates', async () => {
  const [{ loadRepositoryGoldenCandidateIntakeDataset }, batchModule] = await Promise.all([
    import(moduleUrl('scripts/lib/repository-golden-dataset.mjs')),
    import(moduleUrl('scripts/lib/golden-human-review-batch.mjs')),
  ]);
  const { dataset } = await loadRepositoryGoldenCandidateIntakeDataset();
  const packet = batchModule.buildGoldenHumanReviewBatch(dataset);
  const revisionCandidateCount = dataset.candidates.documents.filter(
    (document) => document.revision.supersedesDocumentKey !== null,
  ).length;

  assert.equal(packet.boundary, 'DRAFT_HUMAN_REVIEW_INPUT_NOT_ADJUDICATION');
  assert.equal(packet.productionReady, false);
  assert.equal(packet.goldenReady, false);
  assert.equal(packet.humanAdjudicationRecorded, false);
  assert.equal(packet.datasetCanonicalSha256, dataset.canonicalSha256);
  assert.equal(packet.projectReviews.length, 10);
  assert.equal(
    new Set(packet.projectReviews.map((item) => item.candidate.projectKey)).size,
    10,
  );
  assert.equal(packet.capabilityReviews.length, dataset.candidates.capabilityClaims.length);
  assert.equal(packet.pairReviews.length, dataset.candidates.requirementCapabilityPairs.length);
  assert.equal(packet.revisionReviews.length, revisionCandidateCount);
  assert.equal(batchModule.validateGoldenHumanReviewBatch(packet), packet);
});

test('human review batch leaves every authority, receipt, timestamp, and decision blank', async () => {
  const [{ loadRepositoryGoldenCandidateIntakeDataset }, batchModule] = await Promise.all([
    import(moduleUrl('scripts/lib/repository-golden-dataset.mjs')),
    import(moduleUrl('scripts/lib/golden-human-review-batch.mjs')),
  ]);
  const { dataset } = await loadRepositoryGoldenCandidateIntakeDataset();
  const packet = batchModule.buildGoldenHumanReviewBatch(dataset);

  for (const item of packet.projectReviews) {
    const input = item.humanInputTemplate;
    assert.equal(input.reviewAuthority, null);
    assert.equal(input.reviewReceipt, null);
    assert.equal(input.reviewedAt, null);
    assert.equal(input.identityStatus, null);
    assert.equal(input.currentStage, null);
    assert.equal(input.finalPursuitDecision, null);
    assert.deepEqual(input.appliedSpecificationDocumentKeys, []);
    assert.deepEqual(input.blockingEvidence, []);
    assert.ok(input.productFitByFamily.every((fit) => fit.fitResult === null));
    assert.deepEqual(input.specificationWindow, { state: null, rationale: null });
  }
  for (const item of [...packet.capabilityReviews, ...packet.pairReviews]) {
    const input = item.humanInputTemplate;
    assert.equal(input.reviewAuthority, null);
    assert.equal(input.reviewReceipt, null);
    assert.equal(input.reviewedAt, null);
    assert.equal(input.label, null);
    assert.deepEqual(input.reasonCodes, []);
  }
  for (const item of packet.revisionReviews) {
    const input = item.humanInputTemplate;
    assert.equal(input.reviewAuthority, null);
    assert.equal(input.reviewReceipt, null);
    assert.equal(input.reviewedAt, null);
    assert.equal(input.relationshipStatus, null);
    assert.deepEqual(input.reasonCodes, []);
  }
});

test('human review batch is deterministic across library and CLI writes', async () => {
  const [{ loadRepositoryGoldenCandidateIntakeDataset }, batchModule] = await Promise.all([
    import(moduleUrl('scripts/lib/repository-golden-dataset.mjs')),
    import(moduleUrl('scripts/lib/golden-human-review-batch.mjs')),
  ]);
  const { dataset } = await loadRepositoryGoldenCandidateIntakeDataset();
  assert.deepEqual(
    batchModule.buildGoldenHumanReviewBatch(dataset),
    batchModule.buildGoldenHumanReviewBatch(dataset),
  );

  const dir = mkdtempSync(join(tmpdir(), 'pursuit-golden-human-review-'));
  const output = join(dir, 'batch.json');
  try {
    const first = run(['--json', '--output', output]);
    assert.equal(first.status, 0, first.stderr || first.stdout);
    const firstWrite = readFileSync(output, 'utf8');
    assert.equal(first.stdout, firstWrite);

    const second = run(['--json', '--output', output]);
    assert.equal(second.status, 0, second.stderr || second.stdout);
    assert.equal(second.stdout, first.stdout);
    assert.equal(readFileSync(output, 'utf8'), firstWrite);

    const quiet = run(['--json', '--quiet', '--output', output]);
    assert.equal(quiet.status, 0, quiet.stderr || quiet.stdout);
    assert.equal(quiet.stdout, '');
    assert.equal(readFileSync(output, 'utf8'), firstWrite);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('human review batch validator refuses a prefilled human decision even with a forged hash', async () => {
  const [{ loadRepositoryGoldenCandidateIntakeDataset }, batchModule, claimModule] = await Promise.all([
    import(moduleUrl('scripts/lib/repository-golden-dataset.mjs')),
    import(moduleUrl('scripts/lib/golden-human-review-batch.mjs')),
    import(moduleUrl('knowledge/claim-registry/index.mjs')),
  ]);
  const { dataset } = await loadRepositoryGoldenCandidateIntakeDataset();
  const forged = structuredClone(batchModule.buildGoldenHumanReviewBatch(dataset));
  forged.projectReviews[0].humanInputTemplate.finalPursuitDecision = 'PURSUE';
  const { canonicalSha256: ignored, ...withoutHash } = forged;
  void ignored;
  forged.canonicalSha256 = claimModule.sha256(claimModule.canonicalStringify(withoutHash));

  assert.throws(
    () => batchModule.validateGoldenHumanReviewBatch(forged),
    (error) => error?.code === 'HUMAN_DECISION_MUST_REMAIN_NULL',
  );
});
