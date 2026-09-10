const test = require('node:test');
const assert = require('node:assert/strict');
const {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} = require('node:fs');
const fsPromises = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const SCRIPT = 'scripts/apply-pursuit-golden-human-review-approval-02.mjs';
const REVIEWED_AT = '2026-07-26T04:10:00.000Z';
const VALIDATION_NOW = '2026-07-26T04:11:00.000Z';
const REVIEWER = 'Batch 02 test reviewer';
const REVIEW_RECEIPT =
  'golden-batch02-test-reviewer-20260726t041000z';
const ATTESTATION =
  '나는 연결된 출처, 근거, 한계를 직접 검토했고 이 제안들을 내 도메인 판단으로 채택합니다.';

function moduleUrl(relativePath) {
  return pathToFileURL(join(process.cwd(), relativePath));
}

function run(args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeTemporaryJson(value, name) {
  const directory = mkdtempSync(join(tmpdir(), 'golden-batch02-preapproval-'));
  const path = join(directory, name);
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return {
    path,
    cleanup: () => rmSync(directory, { recursive: true, force: true }),
  };
}

async function buildContext() {
  const [repositoryModule, batchModule, proposalModule, approvalModule] =
    await Promise.all([
      import(moduleUrl('scripts/lib/repository-golden-dataset.mjs')),
      import(moduleUrl('scripts/lib/golden-human-review-batch-02.mjs')),
      import(moduleUrl('scripts/lib/golden-human-review-proposal-02.mjs')),
      import(moduleUrl('scripts/lib/golden-human-review-approval-02.mjs')),
    ]);
  const emptyAdditions = {
    schemaVersion: 'pursuit-golden-human-adjudication-additions-v1',
    boundary: 'HUMAN_ADJUDICATION_ADDITIONS_NOT_PRODUCTION_EVIDENCE',
    productionReady: false,
    evaluationAsOf: '2026-07-26T00:00:00.000Z',
    baseDatasetVersion: 'datacenter-kr-v0',
    projectAdjudications: [],
    capabilityAdjudications: [],
    pairAdjudications: [],
    revisionAdjudications: [],
  };
  const preApprovalInput = writeTemporaryJson(
    emptyAdditions,
    'human-adjudication-additions.json',
  );
  let repository;
  try {
    repository = await repositoryModule.loadRepositoryGoldenDatasetV1({
      adjudicationAdditionsPath: preApprovalInput.path,
      batch02ApprovalReceiptPath:
        `${preApprovalInput.path}.absent-approval-receipt.json`,
    });
  } finally {
    preApprovalInput.cleanup();
  }
  const reviewBatch = batchModule.buildGoldenHumanReviewBatch02(repository.dataset);
  const proposal = proposalModule.buildGoldenHumanReviewProposal02(
    reviewBatch,
    repository.dataset,
  );
  const approval = {
    confirmation: 'GOLDEN_BATCH_02_APPROVAL',
    reviewer: REVIEWER,
    reviewReceipt: REVIEW_RECEIPT,
    reviewedAt: REVIEWED_AT,
    disposition: 'APPROVE_AS_WRITTEN',
    attestation: ATTESTATION,
    changes: [],
    datasetCanonicalSha256: repository.dataset.canonicalSha256,
    priorMaterializedAdjudicationsCanonicalSha256:
      reviewBatch.priorMaterializedAdjudicationsCanonicalSha256,
    priorApprovalReceiptCanonicalSha256:
      repository.rawBatch01ApprovalReceipt.canonicalSha256,
    reviewBatchCanonicalSha256: reviewBatch.canonicalSha256,
    proposalCanonicalSha256: proposal.canonicalSha256,
  };
  return {
    rawCandidates: repository.rawCandidates,
    rawPriorAdjudications: repository.rawBaseAdjudications,
    rawAdditions: repository.rawAdjudicationAdditions,
    priorApprovalReceipt: repository.rawBatch01ApprovalReceipt,
    dataset: repository.dataset,
    reviewBatch,
    proposal,
    approval,
    now: VALIDATION_NOW,
    approvalModule,
  };
}

function optionsOnly(context) {
  const {
    approvalModule,
    dataset,
    ...options
  } = context;
  return structuredClone(options);
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

test('valid synthetic Batch 02 approval adds exactly seven projects and reaches non-production golden readiness', async () => {
  const context = await buildContext();
  const result = context.approvalModule.materializeGoldenHumanReviewApproval02(
    optionsOnly(context),
  );

  assert.equal(result.adjudicationAdditions.projectAdjudications.length, 7);
  assert.equal(result.adjudicationAdditions.capabilityAdjudications.length, 0);
  assert.equal(result.adjudicationAdditions.pairAdjudications.length, 0);
  assert.equal(result.adjudicationAdditions.revisionAdjudications.length, 0);
  assert.equal(
    result.adjudicationAdditions.boundary,
    'HUMAN_ADJUDICATION_ADDITIONS_NOT_PRODUCTION_EVIDENCE',
  );
  assert.ok(result.adjudicationAdditions.projectAdjudications.every((item) => (
    item.reviewAuthority === 'HUMAN_DOMAIN_REVIEW'
      && item.reviewReceipt === REVIEW_RECEIPT
      && item.reviewedAt === REVIEWED_AT
  )));

  assert.equal(result.dataset.datasetState, 'HUMAN_CONFIRMED');
  assert.equal(result.dataset.goldenReady, true);
  assert.equal(result.dataset.candidates.productionReady, false);
  assert.equal(result.dataset.adjudications.productionReady, false);
  assert.equal(result.dataset.summary.humanConfirmedProjectCount, 17);
  assert.equal(result.dataset.summary.humanConfirmedCapabilityClaimCount, 30);
  assert.equal(result.dataset.summary.humanConfirmedPairCount, 10);
  assert.equal(result.dataset.summary.humanConfirmedRevisionLinkCount, 1);
  assert.equal(result.dataset.summary.humanConfirmedStageCount, 5);
  assert.deepEqual(result.dataset.summary.thresholdGaps, []);

  assert.equal(result.approvalReceipt.confirmation, 'GOLDEN_BATCH_02_APPROVAL');
  assert.equal(result.approvalReceipt.productionReady, false);
  assert.equal(result.approvalReceipt.goldenReady, true);
  assert.equal(
    result.approvalReceipt.reviewerIdentityStatus,
    'UNAUTHENTICATED_REPOSITORY_ASSERTION',
  );
  assert.deepEqual(result.approvalReceipt.scope, {
    projectCount: 7,
    capabilityCount: 0,
    pairCount: 0,
    revisionCount: 0,
  });
  assert.equal(
    context.approvalModule.validateGoldenHumanReviewApprovalReceipt02(
      result.approvalReceipt,
      {
        ...optionsOnly(context),
        materializedAdditions: result.adjudicationAdditions,
      },
    ),
    result.approvalReceipt,
  );
});

test('approval input refuses stale pins, altered human assertion, prior drift, and replay additions', async (t) => {
  const context = await buildContext();
  const cases = [
    ['confirmation', 'EXPLICIT_HUMAN_REVIEW_CONFIRMATION_REQUIRED', (options) => {
      options.approval.confirmation = 'GOLDEN_BATCH_01_APPROVAL';
    }],
    ['dataset pin', 'BATCH_02_APPROVAL_PIN_MISMATCH', (options) => {
      options.approval.datasetCanonicalSha256 = '0'.repeat(64);
    }],
    ['prior adjudications pin', 'BATCH_02_APPROVAL_PIN_MISMATCH', (options) => {
      options.approval.priorMaterializedAdjudicationsCanonicalSha256 = '1'.repeat(64);
    }],
    ['prior receipt pin', 'BATCH_02_APPROVAL_PIN_MISMATCH', (options) => {
      options.approval.priorApprovalReceiptCanonicalSha256 = '2'.repeat(64);
    }],
    ['review batch pin', 'BATCH_02_APPROVAL_PIN_MISMATCH', (options) => {
      options.approval.reviewBatchCanonicalSha256 = '3'.repeat(64);
    }],
    ['proposal pin', 'BATCH_02_APPROVAL_PIN_MISMATCH', (options) => {
      options.approval.proposalCanonicalSha256 = '4'.repeat(64);
    }],
    ['disposition', 'APPROVE_AS_WRITTEN_REQUIRED', (options) => {
      options.approval.disposition = 'APPROVE_WITH_CHANGES';
    }],
    ['attestation', 'EXACT_HUMAN_ATTESTATION_REQUIRED', (options) => {
      options.approval.attestation = `${ATTESTATION} changed`;
    }],
    ['changes', 'APPROVAL_CHANGES_MUST_BE_EMPTY', (options) => {
      options.approval.changes.push('change');
    }],
    ['backdated', 'BACKDATED_REVIEW_TIMESTAMP_REFUSED', (options) => {
      options.approval.reviewedAt = '2026-07-25T23:59:59.999Z';
    }],
    ['future', 'FUTURE_REVIEW_TIMESTAMP_REFUSED', (options) => {
      options.approval.reviewedAt = '2026-07-26T04:11:00.001Z';
    }],
    ['reused Batch 01 receipt', 'BATCH_02_REVIEW_RECEIPT_MUST_BE_UNIQUE', (options) => {
      options.approval.reviewReceipt = options.priorApprovalReceipt.reviewReceipt;
    }],
    ['review predates Batch 01', 'BATCH_02_REVIEW_MUST_FOLLOW_BATCH_01', (options) => {
      options.approval.reviewedAt = '2026-07-26T03:00:00.000Z';
    }],
    ['prior adjudication drift', 'IMMUTABLE_BATCH_01_ADJUDICATIONS_PIN_MISMATCH', (options) => {
      options.rawPriorAdjudications.projectAdjudications[0]
        .finalPursuitDecision = 'PURSUE';
    }],
    ['existing addition/replay', 'NONEMPTY_EXISTING_BATCH_02_ADDITIONS_REFUSED', (options) => {
      options.rawAdditions.projectAdjudications.push(
        structuredClone(options.rawPriorAdjudications.projectAdjudications[0]),
      );
    }],
  ];
  for (const [name, code, mutate] of cases) {
    await t.test(name, () => {
      const options = optionsOnly(context);
      mutate(options);
      expectCode(
        () => context.approvalModule.materializeGoldenHumanReviewApproval02(options),
        code,
      );
    });
  }
});

test('forged project stage and proposal content are refused even after canonical rehash', async () => {
  const context = await buildContext();
  const claimModule = await import(moduleUrl('knowledge/claim-registry/index.mjs'));

  const forgedStage = optionsOnly(context);
  forgedStage.proposal.projectProposals[0]
    .suggestedAdjudication.currentStage = 'PROCUREMENT';
  rehash(forgedStage.proposal, claimModule);
  forgedStage.approval.proposalCanonicalSha256 =
    forgedStage.proposal.canonicalSha256;
  assert.throws(
    () => context.approvalModule.materializeGoldenHumanReviewApproval02(forgedStage),
    (error) => [
      'GOLDEN_HUMAN_REVIEW_PROPOSAL_02_CONTENT_MISMATCH',
      'BATCH_02_STAGE_MUST_EXACT_CANDIDATE_EVIDENCE',
    ].includes(error?.code),
  );

  const removedProject = optionsOnly(context);
  removedProject.proposal.projectProposals.pop();
  removedProject.proposal.summary.projectProposalCount -= 1;
  rehash(removedProject.proposal, claimModule);
  removedProject.approval.proposalCanonicalSha256 =
    removedProject.proposal.canonicalSha256;
  assert.throws(
    () => context.approvalModule.materializeGoldenHumanReviewApproval02(removedProject),
    (error) => /GOLDEN_HUMAN_REVIEW_PROPOSAL_02|GOLDEN_BATCH_02_SCOPE/.test(
      error?.code || '',
    ),
  );
});

test('materialized additions and approval receipt must exact-match proposal and pins', async () => {
  const context = await buildContext();
  const claimModule = await import(moduleUrl('knowledge/claim-registry/index.mjs'));
  const options = optionsOnly(context);
  const result = context.approvalModule.materializeGoldenHumanReviewApproval02(options);

  const additionsTamper = structuredClone(result.adjudicationAdditions);
  additionsTamper.projectAdjudications[0].currentStage = 'PROCUREMENT';
  expectCode(
    () => context.approvalModule
      .validateMaterializedGoldenHumanAdjudicationAdditions02(
        additionsTamper,
        options,
      ),
    'MATERIALIZED_BATCH_02_ADDITIONS_PROPOSAL_MISMATCH',
  );

  const receiptTamper = structuredClone(result.approvalReceipt);
  receiptTamper.reviewer = 'Forged reviewer';
  rehash(receiptTamper, claimModule);
  expectCode(
    () => context.approvalModule.validateGoldenHumanReviewApprovalReceipt02(
      receiptTamper,
      { ...options, materializedAdditions: result.adjudicationAdditions },
    ),
    'GOLDEN_BATCH_02_APPROVAL_RECEIPT_CONTENT_MISMATCH',
  );
});

test('paired commit succeeds only on injected temporary allowlisted paths and refuses replay', async (t) => {
  const context = await buildContext();
  const cliModule = await import(moduleUrl(
    'scripts/apply-pursuit-golden-human-review-approval-02.mjs',
  ));
  const result = context.approvalModule.materializeGoldenHumanReviewApproval02(
    optionsOnly(context),
  );
  const directory = mkdtempSync(join(tmpdir(), 'golden-batch02-approval-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const additionsOutput = join(directory, 'human-adjudication-additions.json');
  const receiptOutput = join(directory, 'approval-receipt.json');
  writeFileSync(
    additionsOutput,
    `${JSON.stringify(context.rawAdditions, null, 2)}\n`,
  );
  const allowedOutputs = { additionsOutput, receiptOutput };

  await cliModule.commitGoldenApprovalOutputPair02({
    additionsOutput,
    receiptOutput,
    expectedExistingAdditions: context.rawAdditions,
    adjudicationAdditions: result.adjudicationAdditions,
    approvalReceipt: result.approvalReceipt,
  }, { allowedOutputs, transactionId: 'valid-temp' });

  assert.deepEqual(readJson(additionsOutput), result.adjudicationAdditions);
  assert.deepEqual(readJson(receiptOutput), result.approvalReceipt);
  const repositoryModule = await import(moduleUrl(
    'scripts/lib/repository-golden-dataset.mjs',
  ));
  const approvedRepository = await repositoryModule.loadRepositoryGoldenDatasetV1({
    adjudicationAdditionsPath: additionsOutput,
    batch02ApprovalReceiptPath: receiptOutput,
  });
  assert.equal(approvedRepository.dataset.datasetState, 'HUMAN_CONFIRMED');
  assert.equal(approvedRepository.dataset.goldenReady, true);
  assert.equal(approvedRepository.dataset.summary.humanConfirmedProjectCount, 17);
  assert.equal(
    approvedRepository.dataset.summary.humanConfirmedCapabilityClaimCount,
    30,
  );
  assert.equal(approvedRepository.dataset.summary.humanConfirmedPairCount, 10);
  assert.equal(
    approvedRepository.dataset.summary.humanConfirmedRevisionLinkCount,
    1,
  );
  assert.equal(approvedRepository.dataset.summary.humanConfirmedStageCount, 5);
  assert.equal(approvedRepository.dataset.candidates.productionReady, false);
  assert.equal(approvedRepository.dataset.adjudications.productionReady, false);
  await assert.rejects(
    cliModule.commitGoldenApprovalOutputPair02({
      additionsOutput,
      receiptOutput,
      expectedExistingAdditions: context.rawAdditions,
      adjudicationAdditions: result.adjudicationAdditions,
      approvalReceipt: result.approvalReceipt,
    }, { allowedOutputs, transactionId: 'replay-temp' }),
    (error) => error?.code === 'BATCH_02_ADDITIONS_CHANGED_BEFORE_COMMIT',
  );
});

test('paired commit refuses an existing receipt without changing the empty additions file', async (t) => {
  const context = await buildContext();
  const cliModule = await import(moduleUrl(
    'scripts/apply-pursuit-golden-human-review-approval-02.mjs',
  ));
  const result = context.approvalModule.materializeGoldenHumanReviewApproval02(
    optionsOnly(context),
  );
  const directory = mkdtempSync(join(tmpdir(), 'golden-batch02-existing-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const additionsOutput = join(directory, 'human-adjudication-additions.json');
  const receiptOutput = join(directory, 'approval-receipt.json');
  const additionsBefore = `${JSON.stringify(context.rawAdditions, null, 2)}\n`;
  writeFileSync(additionsOutput, additionsBefore);
  writeFileSync(receiptOutput, '{"existing":true}\n');

  await assert.rejects(
    cliModule.commitGoldenApprovalOutputPair02({
      additionsOutput,
      receiptOutput,
      expectedExistingAdditions: context.rawAdditions,
      adjudicationAdditions: result.adjudicationAdditions,
      approvalReceipt: result.approvalReceipt,
    }, {
      allowedOutputs: { additionsOutput, receiptOutput },
      transactionId: 'existing-receipt',
    }),
    (error) => error?.code === 'BATCH_02_APPROVAL_RECEIPT_ALREADY_EXISTS',
  );
  assert.equal(readFileSync(additionsOutput, 'utf8'), additionsBefore);
  assert.equal(readFileSync(receiptOutput, 'utf8'), '{"existing":true}\n');
});

test('paired transaction rolls back the additions file when receipt commit fails', async (t) => {
  const context = await buildContext();
  const cliModule = await import(moduleUrl(
    'scripts/apply-pursuit-golden-human-review-approval-02.mjs',
  ));
  const result = context.approvalModule.materializeGoldenHumanReviewApproval02(
    optionsOnly(context),
  );
  const directory = mkdtempSync(join(tmpdir(), 'golden-batch02-rollback-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const additionsOutput = join(directory, 'human-adjudication-additions.json');
  const receiptOutput = join(directory, 'approval-receipt.json');
  const additionsBefore = `${JSON.stringify(context.rawAdditions, null, 2)}\n`;
  writeFileSync(additionsOutput, additionsBefore);
  let injected = false;
  const fileSystem = {
    ...fsPromises,
    async rename(source, target) {
      if (
        !injected
        && source.includes('.approval-stage-rollback-test')
        && target === receiptOutput
      ) {
        injected = true;
        const error = new Error('injected receipt commit failure');
        error.code = 'EIO';
        throw error;
      }
      return fsPromises.rename(source, target);
    },
  };

  await assert.rejects(
    cliModule.commitGoldenApprovalOutputPair02({
      additionsOutput,
      receiptOutput,
      expectedExistingAdditions: context.rawAdditions,
      adjudicationAdditions: result.adjudicationAdditions,
      approvalReceipt: result.approvalReceipt,
    }, {
      fileSystem,
      allowedOutputs: { additionsOutput, receiptOutput },
      transactionId: 'rollback-test',
    }),
    /injected receipt commit failure/,
  );
  assert.equal(readFileSync(additionsOutput, 'utf8'), additionsBefore);
  assert.equal(
    readdirSync(directory).some((name) => (
      name.includes('.approval-stage-') || name.includes('.approval-backup-')
    )),
    false,
  );
  assert.throws(() => readFileSync(receiptOutput), /ENOENT/);
});

test('CLI requires exact confirmation and confines both outputs to canonical paths', async () => {
  const context = await buildContext();
  const common = [
    '--reviewer', REVIEWER,
    '--dataset-sha', context.approval.datasetCanonicalSha256,
    '--prior-adjudications-sha',
    context.approval.priorMaterializedAdjudicationsCanonicalSha256,
    '--prior-approval-receipt-sha',
    context.approval.priorApprovalReceiptCanonicalSha256,
    '--review-batch-sha', context.approval.reviewBatchCanonicalSha256,
    '--proposal-sha', context.approval.proposalCanonicalSha256,
    '--proposal', 'tmp/codex/pursuit-golden-human-review-batch-02-proposal.json',
    '--disposition', 'APPROVE_AS_WRITTEN',
    '--attestation', ATTESTATION,
    '--changes', 'NONE',
  ];
  const missing = run(common);
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /REQUIRED_CLI_OPTION_MISSING/);

  const wrong = run([
    '--confirm-human-reviewed', 'GOLDEN_BATCH_01_APPROVAL',
    ...common,
    '--additions-output',
    'knowledge/golden-dataset/datacenter-kr-v1/human-adjudication-additions.json',
    '--receipt-output',
    'tmp/codex/pursuit-golden-human-review-batch-02-approval-receipt-non-production.json',
  ]);
  assert.notEqual(wrong.status, 0);
  assert.match(wrong.stderr, /EXPLICIT_HUMAN_REVIEW_CONFIRMATION_REQUIRED/);

  const absolute = run([
    '--confirm-human-reviewed', 'GOLDEN_BATCH_02_APPROVAL',
    ...common,
    '--additions-output', '/tmp/forged-batch02-additions.json',
    '--receipt-output',
    'tmp/codex/pursuit-golden-human-review-batch-02-approval-receipt-non-production.json',
  ]);
  assert.notEqual(absolute.status, 0);
  assert.match(absolute.stderr, /ABSOLUTE_APPROVAL_OUTPUT_REFUSED/);

  const nonAllowlisted = run([
    '--confirm-human-reviewed', 'GOLDEN_BATCH_02_APPROVAL',
    ...common,
    '--additions-output',
    'knowledge/golden-dataset/datacenter-kr-v1/human-adjudication-additions.json',
    '--receipt-output', 'tmp/codex/forged-batch02-receipt.json',
  ]);
  assert.notEqual(nonAllowlisted.status, 0);
  assert.match(nonAllowlisted.stderr, /APPROVAL_OUTPUT_PATH_NOT_ALLOWLISTED/);
});

test('CLI owns review receipt and timestamp generation and rejects legacy caller metadata flags', async () => {
  const context = await buildContext();
  const cliModule = await import(moduleUrl(
    'scripts/apply-pursuit-golden-human-review-approval-02.mjs',
  ));
  const firstNonce = '123e4567-e89b-42d3-a456-426614174000';
  const secondNonce = '123e4567-e89b-42d3-a456-426614174001';
  const first = cliModule.createGoldenApprovalMetadata02({
    proposalCanonicalSha256: context.proposal.canonicalSha256,
    now: () => new Date(REVIEWED_AT),
    nonce: () => firstNonce,
  });
  const second = cliModule.createGoldenApprovalMetadata02({
    proposalCanonicalSha256: context.proposal.canonicalSha256,
    now: REVIEWED_AT,
    nonce: secondNonce,
  });
  assert.equal(first.reviewedAt, REVIEWED_AT);
  assert.match(
    first.reviewReceipt,
    /^golden-batch02-20260726t041000000z-[a-f0-9]{12}-[a-f0-9]{32}$/,
  );
  assert.ok(first.reviewReceipt.length <= 128);
  assert.ok(first.reviewReceipt.includes(context.proposal.canonicalSha256.slice(0, 12)));
  assert.ok(!first.reviewReceipt.includes(REVIEWER.toLowerCase().replaceAll(' ', '-')));
  assert.notEqual(first.reviewReceipt, second.reviewReceipt);
  assert.ok(Object.isFrozen(first));

  assert.throws(
    () => cliModule.createGoldenApprovalMetadata02({
      proposalCanonicalSha256: '0'.repeat(63),
      now: REVIEWED_AT,
      nonce: firstNonce,
    }),
    (error) => error?.code === 'APPROVAL_METADATA_PROPOSAL_SHA_INVALID',
  );
  assert.throws(
    () => cliModule.createGoldenApprovalMetadata02({
      proposalCanonicalSha256: context.proposal.canonicalSha256,
      now: '2026-07-26',
      nonce: firstNonce,
    }),
    (error) => error?.code === 'APPROVAL_METADATA_NOW_INVALID',
  );
  assert.throws(
    () => cliModule.createGoldenApprovalMetadata02({
      proposalCanonicalSha256: context.proposal.canonicalSha256,
      now: REVIEWED_AT,
      nonce: 'reviewer-controlled-value',
    }),
    (error) => error?.code === 'APPROVAL_METADATA_NONCE_INVALID',
  );

  const baseArgs = [
    '--confirm-human-reviewed', 'GOLDEN_BATCH_02_APPROVAL',
    '--reviewer', REVIEWER,
    '--dataset-sha', context.approval.datasetCanonicalSha256,
    '--prior-adjudications-sha',
    context.approval.priorMaterializedAdjudicationsCanonicalSha256,
    '--prior-approval-receipt-sha',
    context.approval.priorApprovalReceiptCanonicalSha256,
    '--review-batch-sha', context.approval.reviewBatchCanonicalSha256,
    '--proposal-sha', context.approval.proposalCanonicalSha256,
    '--proposal', 'tmp/codex/pursuit-golden-human-review-batch-02-proposal.json',
    '--disposition', 'APPROVE_AS_WRITTEN',
    '--attestation', ATTESTATION,
    '--changes', 'NONE',
    '--additions-output',
    'knowledge/golden-dataset/datacenter-kr-v1/human-adjudication-additions.json',
    '--receipt-output',
    'tmp/codex/pursuit-golden-human-review-batch-02-approval-receipt-non-production.json',
  ];
  for (const [flag, value] of [
    ['--review-receipt', REVIEW_RECEIPT],
    ['--reviewed-at', REVIEWED_AT],
  ]) {
    const refused = run([...baseArgs, flag, value]);
    assert.notEqual(refused.status, 0);
    assert.match(refused.stderr, new RegExp(`UNKNOWN_CLI_OPTION.*${flag}`));
  }
});

test('Batch 02 approval Markdown truthfully delegates receipt and timestamp to guarded materialization', async () => {
  const context = await buildContext();
  const proposalModule = await import(moduleUrl(
    'scripts/lib/golden-human-review-proposal-02.mjs',
  ));
  const markdown = proposalModule.renderGoldenHumanReviewProposal02Markdown(
    context.proposal,
    context.reviewBatch,
    context.dataset,
  );
  assert.match(
    markdown,
    /고유 영수증과 검토 시각은 명시적 승인 뒤 guarded materialization이 최초 승인 후 시스템 기록으로 결합합니다\./,
  );
  const approvalBlock = markdown.match(/```text\n([\s\S]*?)\n```/)?.[1] || '';
  assert.match(approvalBlock, /^GOLDEN_BATCH_02_APPROVAL$/m);
  assert.doesNotMatch(approvalBlock, /^reviewReceipt:/m);
  assert.doesNotMatch(approvalBlock, /^reviewedAt:/m);
});
