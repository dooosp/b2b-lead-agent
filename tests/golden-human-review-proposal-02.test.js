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

const SCRIPT = 'scripts/prepare-pursuit-golden-human-review-proposal-02.mjs';

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
  const [repositoryModule, batchModule, proposalModule, claimModule] = await Promise.all([
    import(moduleUrl('scripts/lib/repository-golden-dataset.mjs')),
    import(moduleUrl('scripts/lib/golden-human-review-batch-02.mjs')),
    import(moduleUrl('scripts/lib/golden-human-review-proposal-02.mjs')),
    import(moduleUrl('knowledge/claim-registry/index.mjs')),
  ]);
  const loaded = await repositoryModule.loadRepositoryCurrentGoldenDataset();
  const dataset = loaded.preAdjudicationDataset || loaded.dataset;
  const batch = batchModule.buildGoldenHumanReviewBatch02(dataset);
  const proposal = proposalModule.buildGoldenHumanReviewProposal02(batch, dataset);
  return { batch, batchModule, claimModule, dataset, proposal, proposalModule };
}

function rehash(artifact, claimModule) {
  delete artifact.canonicalSha256;
  artifact.canonicalSha256 = claimModule.sha256(
    claimModule.canonicalStringify(artifact),
  );
  return artifact;
}

test('Batch 02 proposal is exact, conservative, pending-only, and unapproved', async () => {
  const { batch, proposal, proposalModule, dataset } = await fixture();
  const stages = new Set();

  assert.equal(
    proposal.boundary,
    'AI_ASSISTED_PENDING_PROJECT_DECISIONS_NOT_HUMAN_ADJUDICATION',
  );
  assert.equal(proposal.productionReady, false);
  assert.equal(proposal.goldenReady, false);
  assert.equal(proposal.humanAdjudicationRecorded, false);
  assert.equal(proposal.approvalStatus, 'AWAITING_EXPLICIT_HUMAN_APPROVAL');
  assert.equal(proposal.datasetCanonicalSha256, batch.datasetCanonicalSha256);
  assert.equal(
    proposal.priorMaterializedAdjudicationsCanonicalSha256,
    batch.priorMaterializedAdjudicationsCanonicalSha256,
  );
  assert.equal(proposal.reviewBatchCanonicalSha256, batch.canonicalSha256);
  assert.deepEqual(proposal.summary, {
    projectProposalCount: 7,
    capabilityProposalCount: 0,
    pairProposalCount: 0,
    revisionProposalCount: 0,
  });
  assert.deepEqual(proposal.capabilityProposals, []);
  assert.deepEqual(proposal.pairProposals, []);
  assert.deepEqual(proposal.revisionProposals, []);
  assert.deepEqual(proposal.humanApproval, {
    reviewer: null,
    reviewReceipt: null,
    reviewedAt: null,
    disposition: null,
    attestation: null,
    changes: [],
  });

  for (const item of proposal.projectProposals) {
    const decision = item.suggestedAdjudication;
    stages.add(decision.currentStage);
    assert.equal(decision.identityStatus, 'CONFIRMED');
    assert.equal(decision.currentStage, item.stageObservationCandidate.stage);
    assert.deepEqual(decision.appliedSpecificationDocumentKeys, []);
    assert.deepEqual(
      decision.productFitByFamily.map((fit) => fit.fitResult),
      ['INSUFFICIENT_EVIDENCE', 'INSUFFICIENT_EVIDENCE'],
    );
    assert.ok(decision.blockingEvidence.length > 0);
    assert.equal(decision.specificationWindow.state, 'UNKNOWN');
    assert.ok(decision.specificationWindow.rationale.length > 0);
    assert.equal(decision.finalPursuitDecision, 'HOLD');
    assert.ok(item.stageRationale.length > 0);
    assert.ok(item.candidateLimitations.length > 0);
  }
  assert.deepEqual([...stages].sort(), ['DESIGN', 'FEASIBILITY', 'OPERATION']);
  assert.equal(
    proposalModule.validateGoldenHumanReviewProposal02(proposal, batch, dataset),
    proposal,
  );
});

test('Batch 02 proposal carries tailored early-stage and operating-facility blockers', async () => {
  const { proposal } = await fixture();
  const projects = new Map(
    proposal.projectProposals.map((item) => [item.projectKey, item]),
  );

  assert.match(
    projects.get('wanju_ai_data_center').stageRationale,
    /memorandum.*grid-impact assessment.*does not show.*design.*FEASIBILITY/i,
  );
  assert.match(
    projects.get('wanju_ai_data_center').suggestedAdjudication.blockingEvidence.join(' '),
    /construction commencement.*issued tender/i,
  );
  assert.match(
    projects.get('ulsan_underwater_data_center_model').stageRationale,
    /site analysis.*basic design.*DESIGN/i,
  );
  assert.match(
    projects.get('ulsan_underwater_data_center_model')
      .suggestedAdjudication.blockingEvidence.join(' '),
    /research standard model.*not.*commercial/i,
  );
  assert.match(
    projects.get('kakao_data_center_ansan').suggestedAdjudication.blockingEvidence.join(' '),
    /opening release.*no applicable.*specification/i,
  );
  assert.match(
    projects.get('empyrion_kr1_gangnam').suggestedAdjudication.specificationWindow.rationale,
    /initial-build window has passed/i,
  );
});

test('Batch 02 proposal Markdown includes source links, limitations, hashes, and a blank explicit approval block', async () => {
  const { batch, dataset, proposal, proposalModule } = await fixture();
  const markdown = proposalModule.renderGoldenHumanReviewProposal02Markdown(
    proposal,
    batch,
    dataset,
  );

  assert.match(markdown, /^# Golden Dataset 인간 판정 2차 배치/m);
  assert.match(markdown, /GOLDEN_BATCH_02_APPROVAL/);
  assert.match(markdown, new RegExp(proposal.datasetCanonicalSha256));
  assert.match(markdown, new RegExp(proposal.priorMaterializedAdjudicationsCanonicalSha256));
  assert.match(markdown, new RegExp(proposal.reviewBatchCanonicalSha256));
  assert.match(markdown, new RegExp(proposal.canonicalSha256));
  assert.match(markdown, /scope: PROJECTS_7_CAPABILITIES_0_PAIRS_0_REVISIONS_0/);
  assert.match(markdown, /reviewer: <실제 이름 또는 이니셜>/);
  assert.doesNotMatch(markdown, /^reviewReceipt:/m);
  assert.doesNotMatch(markdown, /^reviewedAt:/m);
  assert.match(markdown, /guarded materialization.*최초 승인 후 시스템 기록/);
  assert.match(markdown, /후보 데이터 자체의 한계/);
  assert.match(markdown, /명시적 비주장/);
  for (const item of proposal.projectProposals) {
    for (const document of item.sourceDocuments) {
      assert.ok(markdown.includes(document.sourceUrl));
    }
  }
});

test('Batch 02 proposal is deterministic across library and CLI JSON/Markdown writes', async () => {
  const { batch, dataset, proposal, proposalModule } = await fixture();
  assert.deepEqual(
    proposalModule.buildGoldenHumanReviewProposal02(batch, dataset),
    proposalModule.buildGoldenHumanReviewProposal02(batch, dataset),
  );

  const directory = mkdtempSync(join(tmpdir(), 'pursuit-golden-proposal-02-'));
  const output = join(directory, 'proposal-02.json');
  const markdownOutput = join(directory, 'proposal-02.md');
  try {
    const first = run(['--output', output, '--markdown-output', markdownOutput]);
    assert.equal(first.status, 0, first.stderr || first.stdout);
    assert.equal(first.stdout, `${JSON.stringify(proposal, null, 2)}\n`);
    assert.equal(readFileSync(output, 'utf8'), first.stdout);
    assert.equal(
      readFileSync(markdownOutput, 'utf8'),
      proposalModule.renderGoldenHumanReviewProposal02Markdown(proposal, batch, dataset),
    );

    const second = run(['--quiet', '--output', output, '--markdown-output', markdownOutput]);
    assert.equal(second.status, 0, second.stderr || second.stdout);
    assert.equal(second.stdout, '');
    assert.equal(readFileSync(output, 'utf8'), first.stdout);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('Batch 02 proposal validator rejects approval, stage, blocker, and scope tampering after rehashing', async () => {
  const { batch, claimModule, dataset, proposal, proposalModule } = await fixture();

  const forgedApproval = structuredClone(proposal);
  forgedApproval.humanApproval.reviewer = 'JT';
  rehash(forgedApproval, claimModule);
  assert.throws(
    () => proposalModule.validateGoldenHumanReviewProposal02(
      forgedApproval,
      batch,
      dataset,
    ),
    (error) => error?.code
      === 'GOLDEN_HUMAN_REVIEW_PROPOSAL_02_HUMAN_APPROVAL_MUST_REMAIN_NULL',
  );

  const forgedStage = structuredClone(proposal);
  forgedStage.projectProposals[5].suggestedAdjudication.currentStage = 'OPERATION';
  rehash(forgedStage, claimModule);
  assert.throws(
    () => proposalModule.validateGoldenHumanReviewProposal02(forgedStage, batch, dataset),
    (error) => error?.code === 'GOLDEN_HUMAN_REVIEW_PROPOSAL_02_CONTENT_MISMATCH',
  );

  const forgedBlocker = structuredClone(proposal);
  forgedBlocker.projectProposals[0].suggestedAdjudication.blockingEvidence = ['forged'];
  rehash(forgedBlocker, claimModule);
  assert.throws(
    () => proposalModule.validateGoldenHumanReviewProposal02(forgedBlocker, batch, dataset),
    (error) => error?.code === 'GOLDEN_HUMAN_REVIEW_PROPOSAL_02_CONTENT_MISMATCH',
  );

  const forgedScope = structuredClone(proposal);
  forgedScope.capabilityProposals.push({ claimKey: 'forged' });
  forgedScope.summary.capabilityProposalCount = 1;
  rehash(forgedScope, claimModule);
  assert.throws(
    () => proposalModule.validateGoldenHumanReviewProposal02(forgedScope, batch, dataset),
    (error) => error?.code === 'GOLDEN_HUMAN_REVIEW_PROPOSAL_02_INVALID',
  );
});

test('Batch 02 proposal validator rejects a rehashed batch whose candidate stage diverges from the dataset', async () => {
  const {
    batch,
    batchModule,
    claimModule,
    dataset,
    proposal,
    proposalModule,
  } = await fixture();
  const forgedBatch = structuredClone(batch);
  forgedBatch.projectReviews[6].candidate.stageObservationCandidate.stage = 'OPERATION';
  rehash(forgedBatch, claimModule);

  assert.throws(
    () => proposalModule.validateGoldenHumanReviewProposal02(
      proposal,
      forgedBatch,
      dataset,
    ),
    (error) => error?.code === 'GOLDEN_HUMAN_REVIEW_BATCH_02_CONTENT_MISMATCH',
  );
  assert.throws(
    () => batchModule.validateGoldenHumanReviewBatch02(forgedBatch, dataset),
    (error) => error?.code === 'GOLDEN_HUMAN_REVIEW_BATCH_02_CONTENT_MISMATCH',
  );
});
