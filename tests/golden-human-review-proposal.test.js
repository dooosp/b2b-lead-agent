const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const SCRIPT = 'scripts/prepare-pursuit-golden-human-review-proposal.mjs';
const OUTPUT_PATH = 'tmp/codex/pursuit-golden-human-review-batch-01-proposal.json';
const MARKDOWN_OUTPUT_PATH =
  'docs/roadmap/pursuit-golden-human-review-batch-01-proposal.md';

function moduleUrl(relativePath) {
  return pathToFileURL(join(process.cwd(), relativePath));
}

function run(args = []) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
}

async function buildProposal() {
  const [repositoryModule, batchModule, proposalModule] = await Promise.all([
    import(moduleUrl('scripts/lib/repository-golden-dataset.mjs')),
    import(moduleUrl('scripts/lib/golden-human-review-batch.mjs')),
    import(moduleUrl('scripts/lib/golden-human-review-proposal.mjs')),
  ]);
  const { dataset } = await repositoryModule.loadRepositoryGoldenCandidateIntakeDataset();
  const batch = batchModule.buildGoldenHumanReviewBatch(dataset);
  const proposal = proposalModule.buildGoldenHumanReviewProposal(batch);
  return { batch, proposal, proposalModule };
}

test('proposal writes every Batch 01 recommendation without recording human approval', async () => {
  const { batch, proposal, proposalModule } = await buildProposal();

  assert.equal(
    proposal.boundary,
    'AI_ASSISTED_PROPOSED_DECISIONS_NOT_HUMAN_ADJUDICATION',
  );
  assert.equal(proposal.productionReady, false);
  assert.equal(proposal.goldenReady, false);
  assert.equal(proposal.humanAdjudicationRecorded, false);
  assert.equal(proposal.approvalStatus, 'AWAITING_EXPLICIT_HUMAN_APPROVAL');
  assert.equal(proposal.datasetCanonicalSha256, batch.datasetCanonicalSha256);
  assert.equal(proposal.reviewBatchCanonicalSha256, batch.canonicalSha256);
  assert.deepEqual(proposal.summary, {
    projectProposalCount: 10,
    capabilityProposalCount: 30,
    pairProposalCount: 10,
    revisionProposalCount: 1,
  });
  assert.deepEqual(proposal.humanApproval, {
    reviewer: null,
    reviewReceipt: null,
    reviewedAt: null,
    disposition: null,
    attestation: null,
    changes: [],
  });
  assert.equal(JSON.stringify(proposal).includes('HUMAN_DOMAIN_REVIEW'), false);
  assert.equal(proposalModule.validateGoldenHumanReviewProposal(proposal, batch), proposal);
});

test('project, capability, pair, and revision recommendations are conservative and scope-bound', async () => {
  const { proposal } = await buildProposal();
  const projects = new Map(proposal.projectProposals.map((item) => [item.projectKey, item]));
  const capabilities = new Map(proposal.capabilityProposals.map((item) => [item.claimKey, item]));

  assert.equal(projects.get('skaws_ulsan_aidc').suggestedAdjudication.finalPursuitDecision, 'NO_BID');
  assert.equal(projects.get('skaws_ulsan_aidc').suggestedAdjudication.specificationWindow.state, 'CLOSED');
  assert.match(
    projects.get('skaws_ulsan_aidc').suggestedAdjudication.blockingEvidence.join(' '),
    /initial-build package.*future expansion/i,
  );
  assert.equal(projects.get('lguplus_paju_aidc').suggestedAdjudication.specificationWindow.state, 'CLOSING');
  assert.deepEqual(
    projects.get('stt_seoul1').suggestedAdjudication.appliedSpecificationDocumentKeys,
    ['project_stt_seoul1_facility_spec_2026'],
  );
  assert.ok(proposal.projectProposals.every((item) => (
    item.suggestedAdjudication.identityStatus === 'CONFIRMED'
      && item.suggestedAdjudication.productFitByFamily.every(
        (fit) => fit.fitResult === 'INSUFFICIENT_EVIDENCE',
      )
  )));

  assert.equal(capabilities.get('mv_si_001_rated_voltage').suggestedAdjudication.label, 'SUPPORTED');
  assert.equal(capabilities.get('mv_abb_001_rated_voltage').suggestedAdjudication.label, 'SUPPORTED_CONDITIONAL');
  assert.equal(capabilities.get('tr_he_002_partial_discharge').suggestedAdjudication.label, 'INSUFFICIENT_EVIDENCE');
  assert.ok(proposal.capabilityProposals.every((item) => (
    item.suggestedAdjudication.reasonCodes.length > 0
      && item.suggestedAdjudication.sourceSpans.length > 0
  )));

  const sel2Pairs = proposal.pairProposals.filter((item) => item.projectKey === 'digitaledge_sel2');
  const sttPairs = proposal.pairProposals.filter((item) => item.projectKey === 'stt_seoul1');
  assert.equal(sel2Pairs.length, 4);
  assert.ok(sel2Pairs.every((item) => item.suggestedAdjudication.label === 'NOT_APPLICABLE'));
  assert.equal(sttPairs.length, 6);
  assert.ok(sttPairs.every((item) => item.suggestedAdjudication.label === 'INSUFFICIENT_EVIDENCE'));
  assert.equal(
    proposal.revisionProposals[0].suggestedAdjudication.relationshipStatus,
    'CONFIRMED_SUPERSESSION',
  );
});

test('proposal is deterministic across library and CLI JSON/Markdown writes', async () => {
  const { batch, proposal, proposalModule } = await buildProposal();
  const adjudicationsPath = join(
    process.cwd(),
    'knowledge/golden-dataset/datacenter-kr-v0/human-adjudications.json',
  );
  const adjudicationsBefore = readFileSync(adjudicationsPath, 'utf8');
  const output = join(process.cwd(), OUTPUT_PATH);
  const markdownOutput = join(process.cwd(), MARKDOWN_OUTPUT_PATH);
  const checkedInOutput = readFileSync(output, 'utf8');
  const checkedInMarkdown = readFileSync(markdownOutput, 'utf8');
  const first = run([
    '--output', OUTPUT_PATH,
    '--markdown-output', MARKDOWN_OUTPUT_PATH,
  ]);
  assert.equal(first.status, 0, first.stderr || first.stdout);
  assert.equal(first.stdout, `${JSON.stringify(proposal, null, 2)}\n`);
  assert.equal(readFileSync(output, 'utf8'), checkedInOutput);
  assert.equal(readFileSync(output, 'utf8'), first.stdout);
  assert.equal(readFileSync(markdownOutput, 'utf8'), checkedInMarkdown);
  assert.equal(
    readFileSync(markdownOutput, 'utf8'),
    proposalModule.renderGoldenHumanReviewProposalMarkdown(proposal, batch),
  );

  const second = run([
    '--quiet',
    '--output', OUTPUT_PATH,
    '--markdown-output', MARKDOWN_OUTPUT_PATH,
  ]);
  assert.equal(second.status, 0, second.stderr || second.stdout);
  assert.equal(second.stdout, '');
  assert.equal(readFileSync(output, 'utf8'), first.stdout);
  assert.equal(readFileSync(adjudicationsPath, 'utf8'), adjudicationsBefore);
});

test('validator rejects approval or source-span tampering even after hash recomputation', async () => {
  const { batch, proposal, proposalModule } = await buildProposal();
  const claimModule = await import(moduleUrl('knowledge/claim-registry/index.mjs'));

  const forgedApproval = structuredClone(proposal);
  forgedApproval.humanApproval.reviewer = 'JT';
  delete forgedApproval.canonicalSha256;
  forgedApproval.canonicalSha256 = claimModule.sha256(
    claimModule.canonicalStringify(forgedApproval),
  );
  assert.throws(
    () => proposalModule.validateGoldenHumanReviewProposal(forgedApproval, batch),
    (error) => error?.code === 'HUMAN_APPROVAL_MUST_REMAIN_NULL',
  );

  const forgedSpan = structuredClone(proposal);
  forgedSpan.pairProposals[0].suggestedAdjudication.sourceSpans = ['forged-span'];
  delete forgedSpan.canonicalSha256;
  forgedSpan.canonicalSha256 = claimModule.sha256(
    claimModule.canonicalStringify(forgedSpan),
  );
  assert.throws(
    () => proposalModule.validateGoldenHumanReviewProposal(forgedSpan, batch),
    (error) => error?.code === 'PAIR_PROPOSAL_CONTENT_MISMATCH',
  );

  const forgedLabel = structuredClone(proposal);
  forgedLabel.capabilityProposals[0].suggestedAdjudication.label = 'SUPPORTED';
  delete forgedLabel.canonicalSha256;
  forgedLabel.canonicalSha256 = claimModule.sha256(
    claimModule.canonicalStringify(forgedLabel),
  );
  assert.throws(
    () => proposalModule.validateGoldenHumanReviewProposal(forgedLabel, batch),
    (error) => error?.code === 'CAPABILITY_PROPOSAL_CONTENT_MISMATCH',
  );

  const forgedApprovalFlag = structuredClone(proposal);
  forgedApprovalFlag.humanApproval.approved = true;
  delete forgedApprovalFlag.canonicalSha256;
  forgedApprovalFlag.canonicalSha256 = claimModule.sha256(
    claimModule.canonicalStringify(forgedApprovalFlag),
  );
  assert.throws(
    () => proposalModule.validateGoldenHumanReviewProposal(forgedApprovalFlag, batch),
    (error) => error?.code === 'PROPOSAL_OBJECT_KEYS_MISMATCH',
  );
});
