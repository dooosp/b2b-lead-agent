import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile as execFileCallback } from 'node:child_process';
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

import {
  CANDIDATE_REVIEW_V2_PATHS
} from '../scripts/lib/candidate-review-v2-files.mjs';
import {
  CANDIDATE_REVIEW_V2_AGGREGATE_RECEIPT_KEYS,
  CANDIDATE_REVIEW_V2_AGGREGATE_SCHEMA_VERSION,
  CandidateReviewV2GitVerificationError,
  observeCandidateReviewGitStateRaw,
  observeCandidateReviewLiveState,
  validateCandidateReviewAggregate,
  validateCandidateReviewFrozenObservation,
  validateCandidateReviewPreRestackRebind,
  verifyAggregateReceiptChain
} from '../scripts/lib/candidate-review-v2-git-verifier.mjs';

const execFile = promisify(execFileCallback);
const CONTROL_BRANCH = 'codex/candidate-review-v2-control';
const HASHES = Object.freeze({
  sourceManifestSha256: '1'.repeat(64),
  documentDecisionSha256: '2'.repeat(64),
  fidelityDecisionSha256: '3'.repeat(64),
  populationSha256: '4'.repeat(64),
  primaryRoleLedgerSha256: '5'.repeat(64),
  secondaryRoleLedgerSha256: '6'.repeat(64),
  finalLedgerSha256: '7'.repeat(64),
  patchSetSha256: '8'.repeat(64),
  roundManifestSha256: '9'.repeat(64)
});

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function git(root, args) {
  return (await execFile('git', args, {
    cwd: root,
    encoding: 'utf8'
  })).stdout.trim();
}

async function commitAll(root, message) {
  await git(root, ['add', '-A']);
  await git(root, ['commit', '-q', '-m', message]);
  return git(root, ['rev-parse', 'HEAD']);
}

function validAggregate(controlBase) {
  return {
    schemaVersion: CANDIDATE_REVIEW_V2_AGGREGATE_SCHEMA_VERSION,
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    productionReady: false,
    productionReviewerWorkflowReady: false,
    repositoryReviewRequired: true,
    automaticVerification: false,
    customerUseAllowed: false,
    proofExecutionApproved: false,
    issue165: 'HOLD',
    control: {
      branch: CONTROL_BRANCH,
      baseCommit: controlBase,
      aggregatePath: CANDIDATE_REVIEW_V2_PATHS.aggregate,
      evaluatedOn: '2026-07-25'
    },
    evaluated: {
      pr206Head: 'a'.repeat(40),
      pr207Base: 'b'.repeat(40),
      pr207Head: 'c'.repeat(40),
      policyMarker: 'LOCAL_OPERATOR_DISPLAY_ONLY',
      policyExpiresAt: '2026-08-21T23:59:59Z'
    },
    hashes: { ...HASHES },
    restackCommitments: null,
    counts: {
      populationTotal: 30,
      populationByFamily: {
        medium_voltage_switchgear: 15,
        transformer: 15
      },
      approvedByFamily: {
        medium_voltage_switchgear: 13,
        transformer: 12
      },
      outcomes: {
        approved: 25,
        rejected: 5,
        held: 0,
        conflicted: 0,
        terminologyGapHeld: 0
      },
      provisionalTechnicalApprovals: 25,
      humanRejectedFalsePositiveCount: 5,
      policyRestrictedRejectCount: 0,
      decisionAgreementCount: 30,
      patchSuitableCount: 25,
      leakageCount: 0,
      unresolvedP0P1FindingCount: 0
    },
    metrics: {
      reviewedSuggestionPrecisionBasisPoints: 8333,
      populationApprovalRateBasisPoints: 8333,
      decisionAgreementRateBasisPoints: 10_000,
      patchSuitabilityRateBasisPoints: 10_000,
      primaryMedianReviewDurationSeconds: 60,
      secondaryMedianReviewDurationSeconds: 90,
      primaryMedianEvidenceTraceabilityUsefulness: 4,
      secondaryMedianEvidenceTraceabilityUsefulness: 4,
      primaryMedianStructuredDecisionUsefulness: 4,
      secondaryMedianStructuredDecisionUsefulness: 4,
      secondaryMedianPatchAssessmentUsefulness: 4,
      byFamily: {
        medium_voltage_switchgear: {
          reviewedSuggestionPrecisionBasisPoints: 8500,
          populationApprovalRateBasisPoints: 8666
        },
        transformer: {
          reviewedSuggestionPrecisionBasisPoints: 8125,
          populationApprovalRateBasisPoints: 8000
        }
      }
    },
    gateResult: 'PASS',
    nonClaims: {
      mergeApproved: false,
      canonicalClaimApproved: false,
      customerUseAllowed: false,
      tenderMatrixReady: false,
      productionProofApproved: false
    }
  };
}

async function createRepository(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'candidate-review-v2-git-'));
  t.after(async () => {
    await rm(root, { recursive: true, force: true });
  });
  await execFile('git', ['init', '-q', '-b', CONTROL_BRANCH], { cwd: root });
  await git(root, ['config', 'user.name', 'Synthetic Test']);
  await git(root, ['config', 'user.email', 'synthetic@example.invalid']);
  await writeFile(path.join(root, 'README.md'), 'control\n');
  const controlBase = await commitAll(root, 'control base');
  return { root, controlBase };
}

async function createValidChain(t, {
  mutateAggregate,
  mutateReceipt,
  aggregateMode = 0o644,
  extraAggregatePath = false,
  extraReceiptPath = false,
  tipDrift = false,
  tipCommit = true,
  duplicateReceiptKey = false
} = {}) {
  const { root, controlBase } = await createRepository(t);
  const aggregate = validAggregate(controlBase);
  mutateAggregate?.(aggregate);
  const aggregateAbsolute = path.join(root, CANDIDATE_REVIEW_V2_PATHS.aggregate);
  await mkdir(path.dirname(aggregateAbsolute), { recursive: true });
  await writeFile(aggregateAbsolute, `${JSON.stringify(aggregate, null, 2)}\n`);
  await chmod(aggregateAbsolute, aggregateMode);
  if (extraAggregatePath) {
    await writeFile(path.join(root, 'unexpected-a.txt'), 'unexpected\n');
  }
  const aggregateCommit = await commitAll(root, 'aggregate A');
  const aggregateGitBlobObjectId = await git(root, [
    'rev-parse',
    `${aggregateCommit}:${CANDIDATE_REVIEW_V2_PATHS.aggregate}`
  ]);
  const aggregateBytes = await readFile(aggregateAbsolute);

  const receipt = {
    schemaVersion: 'pr207-candidate-review-v2-aggregate-receipt-v1',
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    productionReady: false,
    controlBranch: CONTROL_BRANCH,
    controlBase,
    aggregatePath: CANDIDATE_REVIEW_V2_PATHS.aggregate,
    aggregateCommit,
    aggregateGitBlobObjectId,
    aggregateByteSha256: sha256(aggregateBytes)
  };
  mutateReceipt?.(receipt);
  const receiptAbsolute = path.join(root, CANDIDATE_REVIEW_V2_PATHS.aggregateReceipt);
  const receiptText = duplicateReceiptKey
    ? `${JSON.stringify(receipt).replace(
      '"boundary":"NOT_PRODUCTION_EVIDENCE"',
      '"boundary":"NOT_PRODUCTION_EVIDENCE","boundary":"HOLD"'
    )}\n`
    : `${JSON.stringify(receipt, null, 2)}\n`;
  await writeFile(receiptAbsolute, receiptText);
  if (extraReceiptPath) {
    await writeFile(path.join(root, 'unexpected-b.txt'), 'unexpected\n');
  }
  const receiptCommit = await commitAll(root, 'aggregate receipt B');

  let evaluatedTip = receiptCommit;
  if (tipDrift) {
    const drifted = {
      ...aggregate,
      gateResult: 'HOLD'
    };
    await writeFile(aggregateAbsolute, `${JSON.stringify(drifted, null, 2)}\n`);
    evaluatedTip = await commitAll(root, 'drift aggregate after receipt');
  } else if (tipCommit) {
    await writeFile(path.join(root, 'README.md'), 'control\ntip\n');
    evaluatedTip = await commitAll(root, 'later unrelated tip');
  }
  return {
    root,
    controlBase,
    aggregateCommit,
    receiptCommit,
    evaluatedTip,
    aggregate,
    receipt
  };
}

async function expectCode(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof CandidateReviewV2GitVerificationError);
    assert.equal(error.code, code);
    assert.equal(error.status, 'HOLD');
    return true;
  });
}

test('aggregate schema and receipt key allowlists are exact and frozen', () => {
  assert.equal(CANDIDATE_REVIEW_V2_AGGREGATE_RECEIPT_KEYS.length, 9);
  assert.deepEqual([...CANDIDATE_REVIEW_V2_AGGREGATE_RECEIPT_KEYS].sort(), [
    'aggregateByteSha256',
    'aggregateCommit',
    'aggregateGitBlobObjectId',
    'aggregatePath',
    'boundary',
    'controlBase',
    'controlBranch',
    'productionReady',
    'schemaVersion'
  ]);
  assert.ok(Object.isFrozen(CANDIDATE_REVIEW_V2_AGGREGATE_RECEIPT_KEYS));
});

test('exact C -> A_aggregate -> B_aggregate chain verifies at a later branch tip', async (t) => {
  const chain = await createValidChain(t);
  const result = await verifyAggregateReceiptChain({
    repositoryRoot: chain.root,
    controlBase: chain.controlBase,
    aggregateCommit: chain.aggregateCommit,
    receiptCommit: chain.receiptCommit,
    evaluatedTip: chain.evaluatedTip
  });
  assert.equal(result.gate, 'PASS');
  assert.equal(result.exactParentChain, true);
  assert.equal(result.exactRawPathDiffs, true);
  assert.equal(result.tipBlobIdentity, true);
  assert.equal(result.preRestackRebindVerified, false);
  assert.equal(result.issue165, 'HOLD');
  assert.match(result.aggregate.gitBlobObjectId, /^[a-f0-9]{40,64}$/u);
  assert.match(result.aggregate.byteSha256, /^[a-f0-9]{64}$/u);
});

test('raw verifier refuses extra paths and raw mode drift in aggregate commit', async (t) => {
  await t.test('extra A path', async (t) => {
    const chain = await createValidChain(t, { extraAggregatePath: true });
    await expectCode(
      verifyAggregateReceiptChain({
        repositoryRoot: chain.root,
        controlBase: chain.controlBase,
        aggregateCommit: chain.aggregateCommit,
        receiptCommit: chain.receiptCommit,
        evaluatedTip: chain.evaluatedTip
      }),
      'AGGREGATE_COMMIT_PATH_DIFF_INVALID'
    );
  });
  await t.test('executable aggregate', async (t) => {
    const chain = await createValidChain(t, { aggregateMode: 0o755 });
    await expectCode(
      verifyAggregateReceiptChain({
        repositoryRoot: chain.root,
        controlBase: chain.controlBase,
        aggregateCommit: chain.aggregateCommit,
        receiptCommit: chain.receiptCommit,
        evaluatedTip: chain.evaluatedTip
      }),
      'AGGREGATE_COMMIT_RAW_DIFF_INVALID'
    );
  });
  await t.test('extra B path', async (t) => {
    const chain = await createValidChain(t, { extraReceiptPath: true });
    await expectCode(
      verifyAggregateReceiptChain({
        repositoryRoot: chain.root,
        controlBase: chain.controlBase,
        aggregateCommit: chain.aggregateCommit,
        receiptCommit: chain.receiptCommit,
        evaluatedTip: chain.evaluatedTip
      }),
      'RECEIPT_COMMIT_RAW_DIFF_INVALID'
    );
  });
});

test('receipt exact keys, duplicate-key parsing, and aggregate bindings fail closed', async (t) => {
  await t.test('extra receipt key', async (t) => {
    const chain = await createValidChain(t, {
      mutateReceipt(receipt) {
        receipt.candidateId = `cand_${'a'.repeat(64)}`;
      }
    });
    await expectCode(
      verifyAggregateReceiptChain({
        repositoryRoot: chain.root,
        controlBase: chain.controlBase,
        aggregateCommit: chain.aggregateCommit,
        receiptCommit: chain.receiptCommit,
        evaluatedTip: chain.evaluatedTip
      }),
      'AGGREGATE_RECEIPT_KEYS_INVALID'
    );
  });
  await t.test('duplicate receipt key', async (t) => {
    const chain = await createValidChain(t, { duplicateReceiptKey: true });
    await expectCode(
      verifyAggregateReceiptChain({
        repositoryRoot: chain.root,
        controlBase: chain.controlBase,
        aggregateCommit: chain.aggregateCommit,
        receiptCommit: chain.receiptCommit,
        evaluatedTip: chain.evaluatedTip
      }),
      'AGGREGATE_OR_RECEIPT_JSON_INVALID'
    );
  });
  await t.test('wrong byte hash', async (t) => {
    const chain = await createValidChain(t, {
      mutateReceipt(receipt) {
        receipt.aggregateByteSha256 = 'f'.repeat(64);
      }
    });
    await expectCode(
      verifyAggregateReceiptChain({
        repositoryRoot: chain.root,
        controlBase: chain.controlBase,
        aggregateCommit: chain.aggregateCommit,
        receiptCommit: chain.receiptCommit,
        evaluatedTip: chain.evaluatedTip
      }),
      'AGGREGATE_RECEIPT_BINDING_INVALID'
    );
  });
});

test('B ancestry is insufficient when aggregate or receipt blobs drift at tip', async (t) => {
  const chain = await createValidChain(t, { tipDrift: true });
  await expectCode(
    verifyAggregateReceiptChain({
      repositoryRoot: chain.root,
      controlBase: chain.controlBase,
      aggregateCommit: chain.aggregateCommit,
      receiptCommit: chain.receiptCommit,
      evaluatedTip: chain.evaluatedTip
    }),
    'AGGREGATE_OR_RECEIPT_TIP_BLOB_DRIFT'
  );
});
test('evaluated tip must be the exact local control-branch tip', async (t) => {
  const chain = await createValidChain(t);
  await expectCode(
    verifyAggregateReceiptChain({
      repositoryRoot: chain.root,
      controlBase: chain.controlBase,
      aggregateCommit: chain.aggregateCommit,
      receiptCommit: chain.receiptCommit,
      evaluatedTip: chain.receiptCommit
    }),
    'EVALUATED_CONTROL_BRANCH_TIP_MISMATCH'
  );
});

test('aggregate exact schema enforces count arithmetic, rate bounds, and value-aware leakage', () => {
  const aggregate = validAggregate('d'.repeat(40));
  assert.deepEqual(validateCandidateReviewAggregate(aggregate), aggregate);

  const extra = structuredClone(aggregate);
  extra.candidateIds = [`cand_${'a'.repeat(64)}`];
  assert.throws(
    () => validateCandidateReviewAggregate(extra),
    (error) => error.code === 'AGGREGATE_KEYS_INVALID'
  );

  for (const poison of [
    'token=super-secret-value',
    '%2FUsers%2Freviewer%2Fledger.json',
    'https%3A%2F%2F127.0.0.1%2Freview',
    'owner@example.com'
  ]) {
    const poisoned = structuredClone(aggregate);
    poisoned.control.branch = poison;
    assert.throws(
      () => validateCandidateReviewAggregate(poisoned),
      (error) => error.code === 'AGGREGATE_LEAKAGE_REFUSED'
    );
  }

  const wrongSum = structuredClone(aggregate);
  wrongSum.counts.outcomes.approved = 24;
  assert.throws(
    () => validateCandidateReviewAggregate(wrongSum),
    (error) => error.code === 'AGGREGATE_OUTCOME_SUM_INVALID'
  );
  const badRate = structuredClone(aggregate);
  badRate.metrics.populationApprovalRateBasisPoints = 10_001;
  assert.throws(
    () => validateCandidateReviewAggregate(badRate),
    (error) => error.code === 'AGGREGATE_INTEGER_OUT_OF_BOUNDS'
  );
});

test('live-state observation requires an injected observer and exact frozen equality', async () => {
  const expected = {
    pr206: { head: 'a'.repeat(40), draft: true },
    pr207: { head: 'b'.repeat(40), draft: true },
    issue165: 'HOLD'
  };
  const result = await observeCandidateReviewLiveState({
    observer: async () => structuredClone(expected),
    expected
  });
  assert.equal(result.gate, 'PASS');
  assert.equal(result.status, 'FROZEN_STATE_MATCH');
  assert.equal(result.productionReady, false);
  assert.throws(
    () => validateCandidateReviewFrozenObservation(
      { ...expected, issue165: 'READY' },
      expected
    ),
    (error) => error.code === 'FROZEN_OBSERVATION_DRIFT'
  );
  await expectCode(
    observeCandidateReviewLiveState({ expected }),
    'INJECTED_LIVE_OBSERVER_REQUIRED'
  );
});

test('raw local Git observation is read-only and returns exact parent vectors', async (t) => {
  const chain = await createValidChain(t, { tipCommit: false });
  const before = await git(chain.root, ['status', '--porcelain=v1', '--untracked-files=all']);
  const result = await observeCandidateReviewGitStateRaw({
    repositoryRoot: chain.root,
    commits: [
      chain.controlBase,
      chain.aggregateCommit,
      chain.receiptCommit
    ]
  });
  const after = await git(chain.root, ['status', '--porcelain=v1', '--untracked-files=all']);
  assert.equal(result.gate, 'READ_ONLY_LOCAL_GIT_OBSERVATION');
  assert.deepEqual(result.commits[1].parents, [chain.controlBase]);
  assert.deepEqual(result.commits[2].parents, [chain.aggregateCommit]);
  assert.equal(after, before);
});

function validPreRestackObservation() {
  const objectId = (character) => character.repeat(40);
  return {
    oldBase: objectId('1'),
    oldHead: objectId('2'),
    mergedBase: objectId('3'),
    proposedTip: objectId('4'),
    expectedTreeCommit: objectId('5'),
    oldBaseIsMergeBase: true,
    oldBaseAncestorOfOldHead: true,
    orderedCommitListComplete: true,
    proposedLinearReplay: true,
    firstReplayParentEqualsMergedBase: true,
    mergeCommitsAbsent: true,
    addedCommitsAbsent: true,
    omittedCommitsAbsent: true,
    mergedBaseAncestorOfProposedTip: true,
    mergeBaseEqualsMergedBase: true,
    rangeDiffOneToOne: true,
    pathManifestsMatch: true,
    outsideOldRangePathsAbsent: true,
    expectedTreeMatchesProposedTree: true,
    fullTreeDiffEmpty: true,
    ledgerCanonicalEquivalent: true,
    ownerRebindExactValuesMatch: true,
    liveHeadStillOldHead: true,
    readOnlyVerification: true,
    conflictAllowlist: []
  };
}

test('synthetic pre-restack observation matching remains HOLD without raw range/tree proof', () => {
  const observation = validPreRestackObservation();
  const result = validateCandidateReviewPreRestackRebind({
    observation,
    expected: structuredClone(observation)
  });
  assert.equal(result.gate, 'HOLD');
  assert.equal(result.status, 'STRUCTURED_OBSERVATION_MATCH_ONLY');
  assert.equal(result.preRestackRebindVerified, false);
  assert.equal(result.liveHeadMoveApproved, false);
  assert.throws(
    () => validateCandidateReviewPreRestackRebind(),
    (error) => error.code === 'PRE_RESTACK_EQUIVALENCE_UNSUPPORTED_HOLD'
  );
});
