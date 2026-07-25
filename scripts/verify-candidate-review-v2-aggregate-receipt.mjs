#!/usr/bin/env node

import { execFile as execFileCallback } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import {
  CANDIDATE_REVIEW_V2_PATHS,
  parseStrictCandidateReviewJson
} from './lib/candidate-review-v2-files.mjs';
import {
  CANDIDATE_REVIEW_V2_AGGREGATE_RECEIPT_SCHEMA_VERSION,
  verifyAggregateReceiptChain
} from './lib/candidate-review-v2-git-verifier.mjs';

const execFile = promisify(execFileCallback);
const REPOSITORY_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const GIT_SHA = /^[a-f0-9]{40,64}$/u;
export const CANDIDATE_REVIEW_V2_RECEIPT_CLI_SCHEMA_VERSION =
  'pr207-candidate-review-v2-aggregate-receipt-cli-v1';

export function parseCandidateReviewV2AggregateReceiptArguments(argv) {
  if (!Array.isArray(argv) || argv.length !== 0) {
    throw new Error('CANDIDATE_REVIEW_V2_RECEIPT_ARGUMENT_REFUSED');
  }
  return Object.freeze({});
}

async function runFixedGit(repositoryRoot, args, maximumBytes = 256 * 1024) {
  try {
    return await execFile('git', args, {
      cwd: repositoryRoot,
      encoding: 'utf8',
      maxBuffer: maximumBytes,
      windowsHide: true
    });
  } catch {
    const error = new Error('CANDIDATE_REVIEW_V2_LOCAL_GIT_OBSERVATION_FAILED');
    error.code = 'CANDIDATE_REVIEW_V2_LOCAL_GIT_OBSERVATION_FAILED';
    throw error;
  }
}

async function deriveFixedReceiptChain(repositoryRoot) {
  const evaluatedTip = (await runFixedGit(
    repositoryRoot,
    ['rev-parse', '--verify', 'HEAD^{commit}']
  )).stdout.trim();
  if (!GIT_SHA.test(evaluatedTip)) {
    const error = new Error('CANDIDATE_REVIEW_V2_EVALUATED_TIP_INVALID');
    error.code = 'CANDIDATE_REVIEW_V2_EVALUATED_TIP_INVALID';
    throw error;
  }
  const receiptCommits = (await runFixedGit(repositoryRoot, [
    'log',
    '--format=%H',
    '--diff-filter=A',
    evaluatedTip,
    '--',
    CANDIDATE_REVIEW_V2_PATHS.aggregateReceipt
  ])).stdout.trim().split('\n').filter(Boolean);
  if (receiptCommits.length !== 1 || !GIT_SHA.test(receiptCommits[0])) {
    const error = new Error('CANDIDATE_REVIEW_V2_RECEIPT_COMMIT_NOT_UNIQUE');
    error.code = 'CANDIDATE_REVIEW_V2_RECEIPT_COMMIT_NOT_UNIQUE';
    throw error;
  }
  const [receiptCommit] = receiptCommits;
  const receiptText = (await runFixedGit(repositoryRoot, [
    'show',
    `${receiptCommit}:${CANDIDATE_REVIEW_V2_PATHS.aggregateReceipt}`
  ])).stdout;
  const receipt = parseStrictCandidateReviewJson(receiptText);
  if (receipt.schemaVersion !== CANDIDATE_REVIEW_V2_AGGREGATE_RECEIPT_SCHEMA_VERSION
    || receipt.boundary !== 'NOT_PRODUCTION_EVIDENCE'
    || receipt.productionReady !== false
    || receipt.aggregatePath !== CANDIDATE_REVIEW_V2_PATHS.aggregate
    || !GIT_SHA.test(receipt.controlBase)
    || !GIT_SHA.test(receipt.aggregateCommit)) {
    const error = new Error('CANDIDATE_REVIEW_V2_RECEIPT_BINDING_INVALID');
    error.code = 'CANDIDATE_REVIEW_V2_RECEIPT_BINDING_INVALID';
    throw error;
  }
  return {
    controlBase: receipt.controlBase,
    aggregateCommit: receipt.aggregateCommit,
    receiptCommit,
    evaluatedTip
  };
}

export async function runCandidateReviewV2AggregateReceiptVerification({
  repositoryRoot = REPOSITORY_ROOT
} = {}) {
  const chain = await deriveFixedReceiptChain(repositoryRoot);
  const verified = await verifyAggregateReceiptChain({
    repositoryRoot,
    ...chain
  });
  return Object.freeze({
    schemaVersion: CANDIDATE_REVIEW_V2_RECEIPT_CLI_SCHEMA_VERSION,
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    productionReady: false,
    productionReviewerWorkflowReady: false,
    proofExecutionApproved: false,
    mergeApproved: false,
    issue165Status: 'HOLD',
    status: verified.status,
    controlBase: verified.controlBase,
    aggregateCommit: verified.aggregateCommit,
    receiptCommit: verified.receiptCommit,
    evaluatedTip: verified.evaluatedTip,
    aggregateGitBlobObjectId: verified.aggregate.gitBlobObjectId,
    aggregateByteSha256: verified.aggregate.byteSha256,
    receiptGitBlobObjectId: verified.receipt.gitBlobObjectId,
    receiptByteSha256: verified.receipt.byteSha256,
    exactParentChain: verified.exactParentChain,
    exactRawPathDiffs: verified.exactRawPathDiffs,
    tipBlobIdentity: verified.tipBlobIdentity,
    restackEvidence: false,
    humanReviewResultEvaluated: false,
    nonClaims: [
      'Receipt-chain verification does not prove role isolation, human review quality, or human execution.',
      'The aggregate receipt is not PR restack equivalence, merge approval, canonical claim promotion, or production evidence.'
    ]
  });
}

function safeFailure(error) {
  const errorCode = typeof error?.code === 'string'
    && /^[A-Z][A-Z0-9_]{2,100}$/u.test(error.code)
    ? error.code
    : 'CANDIDATE_REVIEW_V2_RECEIPT_VERIFICATION_FAILED';
  return {
    schemaVersion: CANDIDATE_REVIEW_V2_RECEIPT_CLI_SCHEMA_VERSION,
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    productionReady: false,
    productionReviewerWorkflowReady: false,
    proofExecutionApproved: false,
    mergeApproved: false,
    issue165Status: 'HOLD',
    status: 'HOLD',
    restackEvidence: false,
    humanReviewResultEvaluated: false,
    errorCode
  };
}

async function main() {
  try {
    parseCandidateReviewV2AggregateReceiptArguments(process.argv.slice(2));
    const result = await runCandidateReviewV2AggregateReceiptVerification();
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify(safeFailure(error))}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
