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
const { pathToFileURL } = require('node:url');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(process.cwd(), relativePath), 'utf8'));
}

async function loadModules() {
  const [repositoryModule, claimModule] = await Promise.all([
    import(pathToFileURL(join(process.cwd(), 'scripts/lib/repository-golden-dataset.mjs'))),
    import(pathToFileURL(join(process.cwd(), 'knowledge/claim-registry/index.mjs'))),
  ]);
  return { repositoryModule, claimModule };
}

function writeTemporaryJson(value, name) {
  const directory = mkdtempSync(join(tmpdir(), 'golden-lineage-v1-'));
  const path = join(directory, name);
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return {
    path,
    cleanup: () => rmSync(directory, { recursive: true, force: true }),
  };
}

test('v1 composes additive candidates and approved adjudications without changing the v0 projection', async () => {
  const { repositoryModule } = await loadModules();
  const result = await repositoryModule.loadRepositoryGoldenDatasetV1();

  assert.equal(result.rawCandidateAdditions.documents.length, 2);
  assert.equal(result.rawCandidateAdditions.projects.length, 2);
  assert.deepEqual(result.rawCandidateAdditions.capabilityClaims, []);
  assert.deepEqual(result.rawCandidateAdditions.requirementCapabilityPairs, []);
  assert.deepEqual(
    result.rawCandidateAdditions.projects.map((project) => ({
      projectKey: project.projectKey,
      stage: project.stageObservation.stage,
    })).sort((left, right) => left.projectKey.localeCompare(right.projectKey)),
    [
      { projectKey: 'ulsan_underwater_data_center_model', stage: 'DESIGN' },
      { projectKey: 'wanju_ai_data_center', stage: 'FEASIBILITY' },
    ],
  );
  assert.ok(result.rawCandidateAdditions.documents.every((document) => (
    document.sourceClass === 'PROJECT'
      && document.documentKind === 'PRESS_RELEASE'
      && document.documentStored === false
      && document.remoteContentSha256Candidate === null
  )));

  const projectedV0 = {
    ...result.rawCandidates,
    documents: result.rawCandidates.documents.slice(
      0,
      result.rawBaseCandidates.documents.length,
    ),
    projects: result.rawCandidates.projects.slice(
      0,
      result.rawBaseCandidates.projects.length,
    ),
    capabilityClaims: result.rawCandidates.capabilityClaims.slice(
      0,
      result.rawBaseCandidates.capabilityClaims.length,
    ),
    requirementCapabilityPairs: result.rawCandidates.requirementCapabilityPairs.slice(
      0,
      result.rawBaseCandidates.requirementCapabilityPairs.length,
    ),
  };
  assert.deepEqual(projectedV0, result.rawBaseCandidates);
  assert.deepEqual(
    result.rawAdjudications.projectAdjudications.slice(
      0,
      result.rawBaseAdjudications.projectAdjudications.length,
    ),
    result.rawBaseAdjudications.projectAdjudications,
  );
  assert.deepEqual(
    result.rawAdjudications.projectAdjudications.slice(
      result.rawBaseAdjudications.projectAdjudications.length,
    ),
    result.rawAdjudicationAdditions.projectAdjudications,
  );
  assert.deepEqual(
    result.rawAdjudications.capabilityAdjudications,
    result.rawBaseAdjudications.capabilityAdjudications,
  );
  assert.deepEqual(
    result.rawAdjudications.pairAdjudications,
    result.rawBaseAdjudications.pairAdjudications,
  );
  assert.deepEqual(
    result.rawAdjudications.revisionAdjudications,
    result.rawBaseAdjudications.revisionAdjudications,
  );
  assert.equal(
    result.rawAdjudicationAdditions.schemaVersion,
    'pursuit-golden-human-adjudication-additions-v1',
  );
  assert.equal(
    result.rawAdjudicationAdditions.boundary,
    'HUMAN_ADJUDICATION_ADDITIONS_NOT_PRODUCTION_EVIDENCE',
  );
  assert.equal(result.rawAdjudicationAdditions.productionReady, false);
  assert.equal(result.rawAdjudicationAdditions.projectAdjudications.length, 7);
  assert.deepEqual(result.rawAdjudicationAdditions.capabilityAdjudications, []);
  assert.deepEqual(result.rawAdjudicationAdditions.pairAdjudications, []);
  assert.deepEqual(result.rawAdjudicationAdditions.revisionAdjudications, []);
  assert.ok(result.rawAdjudicationAdditions.projectAdjudications.every((item) => (
    item.reviewAuthority === 'HUMAN_DOMAIN_REVIEW'
      && item.reviewReceipt === result.rawBatch02ApprovalReceipt.reviewReceipt
      && item.reviewedAt === result.rawBatch02ApprovalReceipt.reviewedAt
  )));
});

test('v1 loader preserves Batch 01 pins and reports the exact Batch 02 approved state', async () => {
  const { repositoryModule, claimModule } = await loadModules();
  const first = await repositoryModule.loadRepositoryGoldenDatasetV1();
  const current = await repositoryModule.loadRepositoryCurrentGoldenDataset();

  assert.equal(
    claimModule.sha256(claimModule.canonicalStringify(first.rawBaseCandidates)),
    repositoryModule.GOLDEN_V0_CANDIDATES_CANONICAL_SHA256,
  );
  assert.equal(
    claimModule.sha256(claimModule.canonicalStringify(first.rawBaseAdjudications)),
    repositoryModule.GOLDEN_V0_ADJUDICATIONS_CANONICAL_SHA256,
  );
  assert.equal(
    first.baseDataset.canonicalSha256,
    repositoryModule.GOLDEN_V0_POST_ADJUDICATION_DATASET_CANONICAL_SHA256,
  );
  assert.equal(
    first.rawBatch01ApprovalReceipt.canonicalSha256,
    repositoryModule.GOLDEN_BATCH_01_APPROVAL_RECEIPT_CANONICAL_SHA256,
  );
  assert.equal(current.dataset.canonicalSha256, first.dataset.canonicalSha256);
  assert.equal(first.dataset.datasetState, 'HUMAN_CONFIRMED');
  assert.equal(first.dataset.goldenReady, true);
  assert.equal(first.dataset.candidates.productionReady, false);
  assert.equal(first.dataset.adjudications.productionReady, false);
  assert.equal(first.dataset.summary.publicSourceDocumentCandidateCount, 39);
  assert.equal(first.dataset.summary.projectCandidateCount, 17);
  assert.equal(first.dataset.summary.candidateStageCount, 5);
  assert.equal(first.dataset.summary.humanConfirmedProjectCount, 17);
  assert.equal(first.dataset.summary.humanConfirmedCapabilityClaimCount, 30);
  assert.equal(first.dataset.summary.humanConfirmedPairCount, 10);
  assert.equal(first.dataset.summary.humanConfirmedRevisionLinkCount, 1);
  assert.equal(first.dataset.summary.humanConfirmedStageCount, 5);
  assert.equal(first.dataset.summary.pendingProjectCount, 0);
  assert.deepEqual(first.dataset.summary.thresholdGaps, []);
  assert.equal(
    first.rawBatch02ApprovalReceipt.postAdjudicationDatasetCanonicalSha256,
    first.dataset.canonicalSha256,
  );
});

test('v1 loader refuses a tampered and rehashed lineage artifact', async (context) => {
  const { repositoryModule, claimModule } = await loadModules();
  const lineage = clone(readJson(repositoryModule.GOLDEN_V1_LINEAGE_PATH));
  lineage.base.postAdjudicationDatasetCanonicalSha256 = '0'.repeat(64);
  delete lineage.canonicalSha256;
  lineage.canonicalSha256 = claimModule.sha256(claimModule.canonicalStringify(lineage));
  const temporary = writeTemporaryJson(lineage, 'lineage.json');
  context.after(temporary.cleanup);

  await assert.rejects(
    () => repositoryModule.loadRepositoryGoldenDatasetV1({ lineagePath: temporary.path }),
    (error) => error instanceof repositoryModule.RepositoryGoldenDatasetLineageError
      && error.code === 'GOLDEN_V1_LINEAGE_HASH_PIN_MISMATCH',
  );
});

test('v1 loader refuses a tampered v0 base even when the candidate remains structurally valid', async (context) => {
  const { repositoryModule } = await loadModules();
  const candidates = clone(readJson(repositoryModule.GOLDEN_CANDIDATES_PATH));
  candidates.projects[0].limitations.push('Structurally valid but not part of the immutable base.');
  const temporary = writeTemporaryJson(candidates, 'public-source-candidates.json');
  context.after(temporary.cleanup);

  await assert.rejects(
    () => repositoryModule.loadRepositoryGoldenDatasetV1({
      baseCandidatesPath: temporary.path,
    }),
    (error) => error instanceof repositoryModule.RepositoryGoldenDatasetLineageError
      && error.code === 'GOLDEN_V0_CANDIDATE_BASE_HASH_MISMATCH',
  );
});

test('v1 loader refuses tampered candidate or adjudication additions', async (context) => {
  const { repositoryModule } = await loadModules();
  const candidates = clone(readJson(repositoryModule.GOLDEN_V1_CANDIDATE_ADDITIONS_PATH));
  candidates.documents[0].excerpts[0].text = 'A different, still structurally valid paraphrase.';
  const candidateTemporary = writeTemporaryJson(candidates, 'candidate-additions.json');
  context.after(candidateTemporary.cleanup);

  await assert.rejects(
    () => repositoryModule.loadRepositoryGoldenDatasetV1({
      candidateAdditionsPath: candidateTemporary.path,
    }),
    (error) => error instanceof repositoryModule.RepositoryGoldenDatasetLineageError
      && error.code === 'GOLDEN_V1_CANDIDATE_ADDITIONS_HASH_MISMATCH',
  );

  const adjudications = clone(readJson(repositoryModule.GOLDEN_V1_ADJUDICATION_ADDITIONS_PATH));
  adjudications.projectAdjudications.push({ projectKey: 'unreviewed_record' });
  const adjudicationTemporary = writeTemporaryJson(adjudications, 'adjudication-additions.json');
  context.after(adjudicationTemporary.cleanup);

  await assert.rejects(
    () => repositoryModule.loadRepositoryGoldenDatasetV1({
      adjudicationAdditionsPath: adjudicationTemporary.path,
    }),
    (error) => error instanceof repositoryModule.RepositoryGoldenDatasetLineageError
      && error.code
        === 'GOLDEN_V1_PROJECT_ADJUDICATION_ADDITIONS_MUST_BE_EMPTY_OR_COMPLETE_BATCH_02',
  );
});

test('v1 loader refuses a structurally valid complete Batch 02 without its bound approval artifacts', async (context) => {
  const { repositoryModule } = await loadModules();
  const proposal = readJson(
    'tmp/codex/pursuit-golden-human-review-batch-02-proposal.json',
  );
  const additions = clone(readJson(repositoryModule.GOLDEN_V1_ADJUDICATION_ADDITIONS_PATH));
  additions.projectAdjudications = proposal.projectProposals.map(({ suggestedAdjudication }) => {
    const { projectKey, ...decision } = suggestedAdjudication;
    return {
      projectKey,
      reviewAuthority: 'HUMAN_DOMAIN_REVIEW',
      reviewReceipt: 'golden-batch02-test-receipt-0001',
      reviewedAt: '2026-07-26T04:00:00.000Z',
      ...decision,
    };
  });
  const temporary = writeTemporaryJson(additions, 'adjudication-additions.json');
  context.after(temporary.cleanup);

  await assert.rejects(
    () => repositoryModule.loadRepositoryGoldenDatasetV1({
      adjudicationAdditionsPath: temporary.path,
      batch02ApprovalReceiptPath: join(temporary.path, 'missing-receipt.json'),
    }),
    (error) => error instanceof repositoryModule.RepositoryGoldenDatasetLineageError
      && error.code === 'GOLDEN_BATCH_02_APPROVAL_ARTIFACT_SET_REQUIRED',
  );
});
