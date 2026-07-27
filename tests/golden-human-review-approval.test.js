const test = require('node:test');
const assert = require('node:assert/strict');
const {
  readFileSync,
} = require('node:fs');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const SCRIPT = 'scripts/apply-pursuit-golden-human-review-approval.mjs';
const REVIEWED_AT = '2026-07-26T03:48:10.000Z';
const VALIDATION_NOW = '2026-07-26T03:49:10.000Z';
const REVIEWER = 'Jang tae ho';
const REVIEW_RECEIPT =
  'golden-batch01-jang-tae-ho-20260726t034810z-101802f83365';
const ATTESTATION =
  '나는 연결된 출처, 근거, 한계를 직접 검토했고 이 제안들을 내 도메인 판단으로 채택합니다.';

function moduleUrl(relativePath) {
  return pathToFileURL(join(process.cwd(), relativePath));
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(process.cwd(), relativePath), 'utf8'));
}

function run(args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
}

async function buildContext() {
  const [repositoryModule, batchModule, proposalModule, approvalModule] = await Promise.all([
    import(moduleUrl('scripts/lib/repository-golden-dataset.mjs')),
    import(moduleUrl('scripts/lib/golden-human-review-batch.mjs')),
    import(moduleUrl('scripts/lib/golden-human-review-proposal.mjs')),
    import(moduleUrl('scripts/lib/golden-human-review-approval.mjs')),
  ]);
  const { rawCandidates, rawAdjudications, dataset } =
    await repositoryModule.loadRepositoryGoldenCandidateIntakeDataset();
  const reviewBatch = batchModule.buildGoldenHumanReviewBatch(dataset);
  const proposal = proposalModule.buildGoldenHumanReviewProposal(reviewBatch);
  const approval = {
    reviewer: REVIEWER,
    reviewReceipt: REVIEW_RECEIPT,
    reviewedAt: REVIEWED_AT,
    disposition: 'APPROVE_AS_WRITTEN',
    attestation: ATTESTATION,
    changes: [],
    datasetCanonicalSha256: proposal.datasetCanonicalSha256,
    proposalCanonicalSha256: proposal.canonicalSha256,
  };
  const options = {
    rawCandidates,
    rawAdjudications,
    reviewBatch,
    proposal,
    approval,
    now: VALIDATION_NOW,
  };
  return {
    ...options,
    approvalModule,
  };
}

function expectCode(fn, code) {
  assert.throws(fn, (error) => error?.code === code);
}

function rehash(value, claimModule) {
  delete value.canonicalSha256;
  value.canonicalSha256 = claimModule.sha256(
    claimModule.canonicalStringify(value),
  );
  return value;
}

test('explicit approval materializes the exact 10/30/10/1 proposal and remains non-golden', async () => {
  const context = await buildContext();
  const result = context.approvalModule.materializeGoldenHumanReviewApproval(context);
  const allAdjudications = [
    ...result.adjudications.projectAdjudications,
    ...result.adjudications.capabilityAdjudications,
    ...result.adjudications.pairAdjudications,
    ...result.adjudications.revisionAdjudications,
  ];

  assert.equal(result.adjudications.projectAdjudications.length, 10);
  assert.equal(result.adjudications.capabilityAdjudications.length, 30);
  assert.equal(result.adjudications.pairAdjudications.length, 10);
  assert.equal(result.adjudications.revisionAdjudications.length, 1);
  assert.ok(allAdjudications.every((item) => (
    item.reviewAuthority === 'HUMAN_DOMAIN_REVIEW'
      && item.reviewReceipt === REVIEW_RECEIPT
      && item.reviewedAt === REVIEWED_AT
  )));
  assert.deepEqual(
    result.adjudications.projectAdjudications
      .find((item) => item.projectKey === 'stt_seoul1')
      .appliedSpecificationDocumentKeys,
    ['project_stt_seoul1_facility_spec_2026'],
  );
  assert.equal(result.dataset.datasetState, 'PARTIALLY_ADJUDICATED');
  assert.equal(result.dataset.goldenReady, false);
  assert.equal(result.dataset.summary.humanConfirmedProjectCount, 10);
  assert.equal(result.dataset.summary.humanConfirmedCapabilityClaimCount, 30);
  assert.equal(result.dataset.summary.humanConfirmedPairCount, 10);
  assert.equal(result.dataset.summary.humanConfirmedRevisionLinkCount, 1);

  assert.equal(
    result.approvalReceipt.boundary,
    'REPOSITORY_APPROVAL_ASSERTION_NOT_AUTHENTICATED_IDENTITY',
  );
  assert.equal(
    result.approvalReceipt.reviewerIdentityStatus,
    'UNAUTHENTICATED_REPOSITORY_ASSERTION',
  );
  assert.equal(result.approvalReceipt.reviewer, REVIEWER);
  assert.equal(result.approvalReceipt.goldenReady, false);
  assert.deepEqual(result.approvalReceipt.scope, {
    projectCount: 10,
    capabilityCount: 30,
    pairCount: 10,
    revisionCount: 1,
  });
  assert.equal(
    context.approvalModule.validateGoldenHumanReviewApprovalReceipt(
      result.approvalReceipt,
      { ...context, materializedAdjudications: result.adjudications },
    ),
    result.approvalReceipt,
  );
});

test('approval input fails closed for stale pins, existing decisions, altered approval, and invalid time', async (t) => {
  const context = await buildContext();
  const cases = [
    ['dataset hash', 'APPROVAL_DATASET_HASH_MISMATCH', (options) => {
      options.approval.datasetCanonicalSha256 = '0'.repeat(64);
    }],
    ['proposal hash', 'APPROVAL_PROPOSAL_HASH_MISMATCH', (options) => {
      options.approval.proposalCanonicalSha256 = '1'.repeat(64);
    }],
    ['existing adjudication', 'NONEMPTY_EXISTING_ADJUDICATIONS_REFUSED', (options) => {
      options.rawAdjudications.projectAdjudications.push({});
    }],
    ['disposition', 'APPROVE_AS_WRITTEN_REQUIRED', (options) => {
      options.approval.disposition = 'APPROVE_WITH_CHANGES';
    }],
    ['attestation', 'EXACT_HUMAN_ATTESTATION_REQUIRED', (options) => {
      options.approval.attestation = `${ATTESTATION} altered`;
    }],
    ['changes', 'APPROVAL_CHANGES_MUST_BE_EMPTY', (options) => {
      options.approval.changes.push('project change');
    }],
    ['backdated review', 'BACKDATED_REVIEW_TIMESTAMP_REFUSED', (options) => {
      options.approval.reviewedAt = '2026-07-25T23:59:59.999Z';
    }],
    ['future review', 'FUTURE_REVIEW_TIMESTAMP_REFUSED', (options) => {
      options.approval.reviewedAt = '2026-07-26T03:49:10.001Z';
    }],
  ];
  for (const [name, code, mutate] of cases) {
    await t.test(name, () => {
      const options = structuredClone({
        rawCandidates: context.rawCandidates,
        rawAdjudications: context.rawAdjudications,
        reviewBatch: context.reviewBatch,
        proposal: context.proposal,
        approval: context.approval,
        now: context.now,
      });
      mutate(options);
      expectCode(
        () => context.approvalModule.materializeGoldenHumanReviewApproval(options),
        code,
      );
    });
  }
});

test('partial or source-tampered proposals are rejected even after canonical rehash', async () => {
  const context = await buildContext();
  const claimModule = await import(moduleUrl('knowledge/claim-registry/index.mjs'));

  const partial = structuredClone(context.proposal);
  partial.pairProposals.pop();
  partial.summary.pairProposalCount -= 1;
  rehash(partial, claimModule);
  expectCode(
    () => context.approvalModule.materializeGoldenHumanReviewApproval({
      ...context,
      proposal: partial,
      approval: {
        ...context.approval,
        proposalCanonicalSha256: partial.canonicalSha256,
      },
    }),
    'PROPOSAL_REVIEW_KEY_MISMATCH',
  );

  const sourceTamper = structuredClone(context.proposal);
  sourceTamper.capabilityProposals[0].suggestedAdjudication.sourceSpans = [
    'forged-source-span',
  ];
  rehash(sourceTamper, claimModule);
  expectCode(
    () => context.approvalModule.materializeGoldenHumanReviewApproval({
      ...context,
      proposal: sourceTamper,
      approval: {
        ...context.approval,
        proposalCanonicalSha256: sourceTamper.canonicalSha256,
      },
    }),
    'CAPABILITY_PROPOSAL_CONTENT_MISMATCH',
  );
});

test('materialized records and approval receipt must exact-match the validated proposal', async () => {
  const context = await buildContext();
  const claimModule = await import(moduleUrl('knowledge/claim-registry/index.mjs'));
  const result = context.approvalModule.materializeGoldenHumanReviewApproval(context);

  const adjudicationTamper = structuredClone(result.adjudications);
  adjudicationTamper.pairAdjudications[0].sourceSpans = ['forged-source-span'];
  expectCode(
    () => context.approvalModule.validateMaterializedGoldenHumanAdjudications(
      adjudicationTamper,
      context,
    ),
    'MATERIALIZED_ADJUDICATIONS_PROPOSAL_MISMATCH',
  );

  const forgedReceipt = structuredClone(result.approvalReceipt);
  forgedReceipt.reviewer = 'Different reviewer';
  rehash(forgedReceipt, claimModule);
  expectCode(
    () => context.approvalModule.validateGoldenHumanReviewApprovalReceipt(
      forgedReceipt,
      { ...context, materializedAdjudications: result.adjudications },
    ),
    'GOLDEN_APPROVAL_RECEIPT_CONTENT_MISMATCH',
  );
});

test('CLI requires exact confirmation and refuses replay without changing protected outputs', async () => {
  const context = await buildContext();
  const proposalPath = 'tmp/codex/pursuit-golden-human-review-batch-01-proposal.json';
  const adjudicationsOutput =
    'knowledge/golden-dataset/datacenter-kr-v0/human-adjudications.json';
  const receiptOutput =
    'tmp/codex/pursuit-golden-human-review-batch-01-approval-receipt-non-production.json';
  const adjudicationsBefore = readFileSync(adjudicationsOutput, 'utf8');
  const receiptBefore = readFileSync(receiptOutput, 'utf8');
  const baseArgs = [
    '--reviewer', REVIEWER,
    '--review-receipt', REVIEW_RECEIPT,
    '--reviewed-at', REVIEWED_AT,
    '--dataset-sha', context.proposal.datasetCanonicalSha256,
    '--proposal-sha', context.proposal.canonicalSha256,
    '--proposal', proposalPath,
    '--disposition', 'APPROVE_AS_WRITTEN',
    '--attestation', ATTESTATION,
    '--changes', 'NONE',
    '--adjudications-output', adjudicationsOutput,
    '--receipt-output', receiptOutput,
  ];
  const refused = run(baseArgs);
  assert.notEqual(refused.status, 0);
  assert.match(refused.stderr, /REQUIRED_CLI_OPTION_MISSING/);

  const wrongConfirmation = run([
    '--confirm-human-reviewed', 'NOT_AN_APPROVAL',
    ...baseArgs,
  ]);
  assert.notEqual(wrongConfirmation.status, 0);
  assert.match(
    wrongConfirmation.stderr,
    /EXPLICIT_HUMAN_REVIEW_CONFIRMATION_REQUIRED/,
  );

  const replay = run([
    '--confirm-human-reviewed', 'GOLDEN_BATCH_01_APPROVAL',
    '--quiet',
    ...baseArgs,
  ]);
  assert.notEqual(replay.status, 0);
  assert.match(replay.stderr, /NONEMPTY_EXISTING_ADJUDICATIONS_REFUSED/);
  assert.equal(readFileSync(adjudicationsOutput, 'utf8'), adjudicationsBefore);
  assert.equal(readFileSync(receiptOutput, 'utf8'), receiptBefore);
});

test('repository materialization and receipt exact-match the pinned proposal', async () => {
  const context = await buildContext();
  const materializedAdjudications = readJson(
    'knowledge/golden-dataset/datacenter-kr-v0/human-adjudications.json',
  );
  const receipt = readJson(
    'tmp/codex/pursuit-golden-human-review-batch-01-approval-receipt-non-production.json',
  );
  const approval = {
    reviewer: receipt.reviewer,
    reviewReceipt: receipt.reviewReceipt,
    reviewedAt: receipt.reviewedAt,
    disposition: receipt.disposition,
    attestation: receipt.attestation,
    changes: receipt.changes,
    datasetCanonicalSha256: receipt.preAdjudicationDatasetCanonicalSha256,
    proposalCanonicalSha256: receipt.proposalCanonicalSha256,
  };
  const options = { ...context, approval, now: new Date().toISOString() };
  const dataset = context.approvalModule.validateMaterializedGoldenHumanAdjudications(
    materializedAdjudications,
    options,
  );
  assert.equal(dataset.datasetState, 'PARTIALLY_ADJUDICATED');
  assert.equal(dataset.goldenReady, false);
  assert.equal(
    context.approvalModule.validateGoldenHumanReviewApprovalReceipt(
      receipt,
      { ...options, materializedAdjudications },
    ),
    receipt,
  );
});

test('CLI confines outputs to the two explicit repository paths', async () => {
  const context = await buildContext();
  const common = [
    '--confirm-human-reviewed', 'GOLDEN_BATCH_01_APPROVAL',
    '--reviewer', REVIEWER,
    '--review-receipt', REVIEW_RECEIPT,
    '--reviewed-at', REVIEWED_AT,
    '--dataset-sha', context.proposal.datasetCanonicalSha256,
    '--proposal-sha', context.proposal.canonicalSha256,
    '--proposal', 'tmp/codex/pursuit-golden-human-review-batch-01-proposal.json',
    '--disposition', 'APPROVE_AS_WRITTEN',
    '--attestation', ATTESTATION,
    '--changes', 'NONE',
  ];
  const absoluteRefusal = run([
    ...common,
    '--adjudications-output', '/tmp/adjudications.json',
    '--receipt-output',
    'tmp/codex/pursuit-golden-human-review-batch-01-approval-receipt-non-production.json',
  ]);
  assert.notEqual(absoluteRefusal.status, 0);
  assert.match(absoluteRefusal.stderr, /ABSOLUTE_APPROVAL_OUTPUT_REFUSED/);

  const traversalRefusal = run([
    ...common,
    '--adjudications-output', '../outside-adjudications.json',
    '--receipt-output',
    'tmp/codex/pursuit-golden-human-review-batch-01-approval-receipt-non-production.json',
  ]);
  assert.notEqual(traversalRefusal.status, 0);
  assert.match(
    traversalRefusal.stderr,
    /APPROVAL_OUTPUT_OUTSIDE_REPOSITORY_REFUSED/,
  );

  const nonAllowlisted = run([
    ...common,
    '--adjudications-output', 'tmp/codex/unapproved-adjudications.json',
    '--receipt-output',
    'tmp/codex/pursuit-golden-human-review-batch-01-approval-receipt-non-production.json',
  ]);
  assert.notEqual(nonAllowlisted.status, 0);
  assert.match(nonAllowlisted.stderr, /APPROVAL_OUTPUT_PATH_NOT_ALLOWLISTED/);
});

test('paired output transaction restores both protected files when the second commit fails', async () => {
  const cliModule = await import(moduleUrl(
    'scripts/apply-pursuit-golden-human-review-approval.mjs',
  ));
  const adjudicationsOutput = join(
    process.cwd(),
    'knowledge/golden-dataset/datacenter-kr-v0/human-adjudications.json',
  );
  const receiptOutput = join(
    process.cwd(),
    cliModule.GOLDEN_APPROVAL_RECEIPT_PATH,
  );
  const files = new Map([
    [adjudicationsOutput, 'old-adjudications'],
    [receiptOutput, 'old-receipt'],
  ]);
  let injected = false;
  function missing(path) {
    const error = new Error(`ENOENT:${path}`);
    error.code = 'ENOENT';
    return error;
  }
  const fileSystem = {
    async mkdir() {},
    async lstat(path) {
      if (!files.has(path)) throw missing(path);
      return { isFile: () => true, isSymbolicLink: () => false };
    },
    async writeFile(path, value) {
      if (files.has(path)) throw new Error(`EEXIST:${path}`);
      files.set(path, value);
    },
    async rename(source, target) {
      if (
        !injected
        && source.includes('.approval-stage-test-transaction')
        && target === receiptOutput
      ) {
        injected = true;
        const error = new Error('injected second commit failure');
        error.code = 'EIO';
        throw error;
      }
      if (!files.has(source)) throw missing(source);
      files.set(target, files.get(source));
      files.delete(source);
    },
    async unlink(path) {
      if (!files.delete(path)) throw missing(path);
    },
  };
  await assert.rejects(
    cliModule.commitGoldenApprovalOutputPair({
      adjudicationsOutput,
      receiptOutput,
      adjudications: { replacement: 'adjudications' },
      approvalReceipt: { replacement: 'receipt' },
    }, { fileSystem, transactionId: 'test-transaction' }),
    /injected second commit failure/,
  );
  assert.equal(files.get(adjudicationsOutput), 'old-adjudications');
  assert.equal(files.get(receiptOutput), 'old-receipt');
  assert.equal(
    [...files.keys()].some((path) => (
      path.includes('.approval-stage-') || path.includes('.approval-backup-')
    )),
    false,
  );
});
