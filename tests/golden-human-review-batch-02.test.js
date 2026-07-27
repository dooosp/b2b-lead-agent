const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const SCRIPT = 'scripts/prepare-pursuit-golden-human-review-batch-02.mjs';
const OUTPUT_PATH = 'tmp/codex/pursuit-golden-human-review-batch-02.json';

function moduleUrl(relativePath) {
  return pathToFileURL(join(process.cwd(), relativePath));
}

function run(args = []) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
}

async function fixture() {
  const [repositoryModule, batchModule, claimModule] = await Promise.all([
    import(moduleUrl('scripts/lib/repository-golden-dataset.mjs')),
    import(moduleUrl('scripts/lib/golden-human-review-batch-02.mjs')),
    import(moduleUrl('knowledge/claim-registry/index.mjs')),
  ]);
  const loaded = await repositoryModule.loadRepositoryCurrentGoldenDataset();
  const dataset = loaded.preAdjudicationDataset || loaded.dataset;
  const packet = batchModule.buildGoldenHumanReviewBatch02(dataset);
  return { batchModule, claimModule, dataset, packet };
}

function rehash(artifact, claimModule) {
  delete artifact.canonicalSha256;
  artifact.canonicalSha256 = claimModule.sha256(
    claimModule.canonicalStringify(artifact),
  );
  return artifact;
}

test('Batch 02 selects exactly all seven pending projects and no previously adjudicated project', async () => {
  const { batchModule, dataset, packet } = await fixture();
  const repositoryModule = await import(
    moduleUrl('scripts/lib/repository-golden-dataset.mjs')
  );
  const adjudicated = new Set(
    dataset.adjudications.projectAdjudications.map((item) => item.projectKey),
  );
  const expectedPendingKeys = dataset.candidates.projects
    .filter((project) => !adjudicated.has(project.projectKey))
    .map((project) => project.projectKey)
    .sort();
  const actualKeys = packet.projectReviews.map((item) => item.candidate.projectKey);

  assert.equal(dataset.datasetState, 'PARTIALLY_ADJUDICATED');
  assert.equal(packet.datasetStateAtPreparation, 'PARTIALLY_ADJUDICATED');
  assert.equal(packet.datasetCanonicalSha256, dataset.canonicalSha256);
  assert.equal(
    packet.priorMaterializedAdjudicationsCanonicalSha256,
    repositoryModule.GOLDEN_V0_ADJUDICATIONS_CANONICAL_SHA256,
  );
  assert.deepEqual(actualKeys, batchModule.GOLDEN_HUMAN_REVIEW_BATCH_02_PROJECT_KEYS);
  assert.deepEqual(actualKeys, expectedPendingKeys);
  assert.ok(actualKeys.every((projectKey) => !adjudicated.has(projectKey)));
  assert.deepEqual(packet.summary, {
    projectReviewItemCount: 7,
    capabilityReviewItemCount: 0,
    pairReviewItemCount: 0,
    revisionReviewItemCount: 0,
  });
  assert.deepEqual(packet.capabilityReviews, []);
  assert.deepEqual(packet.pairReviews, []);
  assert.deepEqual(packet.revisionReviews, []);
  assert.equal(batchModule.validateGoldenHumanReviewBatch02(packet, dataset), packet);
});

test('Batch 02 leaves every human envelope and decision field blank', async () => {
  const { packet } = await fixture();

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
});

test('Batch 02 is deterministic across library and CLI writes', async () => {
  const { batchModule, dataset, packet } = await fixture();
  assert.deepEqual(
    batchModule.buildGoldenHumanReviewBatch02(dataset),
    batchModule.buildGoldenHumanReviewBatch02(dataset),
  );

  const output = join(process.cwd(), OUTPUT_PATH);
  const checkedIn = readFileSync(output, 'utf8');
  const first = run(['--output', OUTPUT_PATH]);
  assert.equal(first.status, 0, first.stderr || first.stdout);
  assert.equal(first.stdout, `${JSON.stringify(packet, null, 2)}\n`);
  assert.equal(readFileSync(output, 'utf8'), checkedIn);
  assert.equal(readFileSync(output, 'utf8'), first.stdout);

  const second = run(['--quiet', '--output', OUTPUT_PATH]);
  assert.equal(second.status, 0, second.stderr || second.stdout);
  assert.equal(second.stdout, '');
  assert.equal(readFileSync(output, 'utf8'), first.stdout);
});

test('Batch 02 validator rejects human-prefill and stage divergence after rehashing', async () => {
  const { batchModule, claimModule, dataset, packet } = await fixture();

  const prefilled = rehash(structuredClone(packet), claimModule);
  prefilled.projectReviews[0].humanInputTemplate.currentStage = 'OPERATION';
  rehash(prefilled, claimModule);
  assert.throws(
    () => batchModule.validateGoldenHumanReviewBatch02(prefilled, dataset),
    (error) => error?.code
      === 'GOLDEN_HUMAN_REVIEW_BATCH_02_HUMAN_FIELD_MUST_REMAIN_NULL',
  );

  const divergentStage = structuredClone(packet);
  divergentStage.projectReviews[5].candidate.stageObservationCandidate.stage = 'OPERATION';
  rehash(divergentStage, claimModule);
  assert.throws(
    () => batchModule.validateGoldenHumanReviewBatch02(divergentStage, dataset),
    (error) => error?.code === 'GOLDEN_HUMAN_REVIEW_BATCH_02_CONTENT_MISMATCH',
  );
});

test('Batch 02 validator rejects overlap and non-project scope after rehashing', async () => {
  const { batchModule, claimModule, dataset, packet } = await fixture();

  const overlap = structuredClone(packet);
  overlap.projectReviews[0].candidate.projectKey =
    dataset.adjudications.projectAdjudications[0].projectKey;
  overlap.projectReviews[0].humanInputTemplate.projectKey =
    dataset.adjudications.projectAdjudications[0].projectKey;
  rehash(overlap, claimModule);
  assert.throws(
    () => batchModule.validateGoldenHumanReviewBatch02(overlap, dataset),
    (error) => error?.code === 'GOLDEN_HUMAN_REVIEW_BATCH_02_CONTENT_MISMATCH',
  );

  const expandedScope = structuredClone(packet);
  expandedScope.capabilityReviews.push({ itemType: 'CAPABILITY' });
  expandedScope.summary.capabilityReviewItemCount = 1;
  rehash(expandedScope, claimModule);
  assert.throws(
    () => batchModule.validateGoldenHumanReviewBatch02(expandedScope, dataset),
    (error) => error?.code === 'GOLDEN_HUMAN_REVIEW_BATCH_02_INVALID',
  );
});

test('Batch 02 refuses the immutable Batch 01 dataset because it does not contain the exact seven-item scope', async () => {
  const [repositoryModule, batchModule] = await Promise.all([
    import(moduleUrl('scripts/lib/repository-golden-dataset.mjs')),
    import(moduleUrl('scripts/lib/golden-human-review-batch-02.mjs')),
  ]);
  const { dataset } = await repositoryModule.loadRepositoryGoldenDataset();

  assert.throws(
    () => batchModule.buildGoldenHumanReviewBatch02(dataset),
    (error) => error?.code === 'GOLDEN_HUMAN_REVIEW_BATCH_02_DATASET_STATE_INVALID',
  );
});
