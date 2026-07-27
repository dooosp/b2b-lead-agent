#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import {
  lstat,
  mkdir,
  readFile,
  rename,
  unlink,
  writeFile,
} from 'node:fs/promises';
import {
  dirname,
  isAbsolute,
  relative,
  resolve,
} from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalStringify } from '../knowledge/claim-registry/index.mjs';
import {
  GOLDEN_HUMAN_REVIEW_APPROVAL_02_ATTESTATION,
  GOLDEN_HUMAN_REVIEW_APPROVAL_02_CONFIRMATION,
  GOLDEN_HUMAN_REVIEW_APPROVAL_02_DISPOSITION,
  materializeGoldenHumanReviewApproval02,
} from './lib/golden-human-review-approval-02.mjs';
import { buildGoldenHumanReviewBatch02 } from './lib/golden-human-review-batch-02.mjs';
import { REPO_ROOT } from './lib/repository-claim-registry.mjs';
import { loadRepositoryGoldenDatasetV1 } from './lib/repository-golden-dataset.mjs';

const VALUE_OPTIONS = new Set([
  '--confirm-human-reviewed',
  '--reviewer',
  '--dataset-sha',
  '--prior-adjudications-sha',
  '--prior-approval-receipt-sha',
  '--review-batch-sha',
  '--proposal-sha',
  '--proposal',
  '--disposition',
  '--attestation',
  '--changes',
  '--additions-output',
  '--receipt-output',
]);
const BOOLEAN_OPTIONS = new Set(['--quiet']);
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const REVIEW_RECEIPT_PATTERN = /^[a-z0-9][a-z0-9._:-]{7,127}$/;

export const GOLDEN_ADJUDICATION_ADDITIONS_02_PATH =
  'knowledge/golden-dataset/datacenter-kr-v1/human-adjudication-additions.json';
export const GOLDEN_APPROVAL_02_RECEIPT_PATH =
  'tmp/codex/pursuit-golden-human-review-batch-02-approval-receipt-non-production.json';
export const GOLDEN_PROPOSAL_02_PATH =
  'tmp/codex/pursuit-golden-human-review-batch-02-proposal.json';
export const GOLDEN_BATCH_01_APPROVAL_RECEIPT_PATH =
  'tmp/codex/pursuit-golden-human-review-batch-01-approval-receipt-non-production.json';

const FILE_SYSTEM = Object.freeze({
  lstat,
  mkdir,
  readFile,
  rename,
  unlink,
  writeFile,
});

function cliError(code, detail = '') {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  throw error;
}

function same(left, right) {
  return canonicalStringify(left) === canonicalStringify(right);
}

function exactIsoTimestamp(value) {
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) cliError('APPROVAL_METADATA_NOW_INVALID');
    return value.toISOString();
  }
  if (typeof value !== 'string') cliError('APPROVAL_METADATA_NOW_INVALID');
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    cliError('APPROVAL_METADATA_NOW_INVALID');
  }
  return value;
}

export function createGoldenApprovalMetadata02({
  proposalCanonicalSha256,
  now = () => new Date(),
  nonce = randomUUID,
} = {}) {
  if (
    typeof proposalCanonicalSha256 !== 'string'
    || !HASH_PATTERN.test(proposalCanonicalSha256)
  ) {
    cliError('APPROVAL_METADATA_PROPOSAL_SHA_INVALID');
  }
  const reviewedAt = exactIsoTimestamp(
    typeof now === 'function' ? now() : now,
  );
  const nonceValue = typeof nonce === 'function' ? nonce() : nonce;
  if (typeof nonceValue !== 'string' || !UUID_PATTERN.test(nonceValue)) {
    cliError('APPROVAL_METADATA_NONCE_INVALID');
  }
  const compactTimestamp = reviewedAt
    .toLowerCase()
    .replace(/[-:.]/gu, '');
  const compactNonce = nonceValue.toLowerCase().replaceAll('-', '');
  const reviewReceipt = [
    'golden-batch02',
    compactTimestamp,
    proposalCanonicalSha256.slice(0, 12),
    compactNonce,
  ].join('-');
  if (
    reviewReceipt.length > 128
    || !REVIEW_RECEIPT_PATTERN.test(reviewReceipt)
  ) {
    cliError('GENERATED_APPROVAL_REVIEW_RECEIPT_INVALID');
  }
  return Object.freeze({ reviewedAt, reviewReceipt });
}

function parseArgs(argv) {
  const options = new Map();
  let quiet = false;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (BOOLEAN_OPTIONS.has(token)) {
      if (quiet) cliError('DUPLICATE_CLI_OPTION', token);
      quiet = true;
      continue;
    }
    if (!VALUE_OPTIONS.has(token)) cliError('UNKNOWN_CLI_OPTION', token);
    if (options.has(token)) cliError('DUPLICATE_CLI_OPTION', token);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      cliError('CLI_OPTION_VALUE_REQUIRED', token);
    }
    options.set(token, value);
    index += 1;
  }
  for (const name of VALUE_OPTIONS) {
    if (!options.has(name)) cliError('REQUIRED_CLI_OPTION_MISSING', name);
  }
  return { options, quiet };
}

async function readJson(relativePath) {
  const resolved = resolve(REPO_ROOT, relativePath);
  let source;
  try {
    source = await readFile(resolved, 'utf8');
  } catch (cause) {
    const error = new Error(`APPROVAL_INPUT_READ_FAILED:${relativePath}`, { cause });
    error.code = 'APPROVAL_INPUT_READ_FAILED';
    throw error;
  }
  try {
    return JSON.parse(source);
  } catch (cause) {
    const error = new Error(`APPROVAL_INPUT_JSON_INVALID:${relativePath}`, { cause });
    error.code = 'APPROVAL_INPUT_JSON_INVALID';
    throw error;
  }
}

function resolveRepositoryPath(path, expected, kind) {
  if (isAbsolute(path)) cliError(`ABSOLUTE_APPROVAL_${kind}_REFUSED`, path);
  const resolved = resolve(REPO_ROOT, path);
  const repoRelative = relative(REPO_ROOT, resolved);
  if (!repoRelative || repoRelative.startsWith('..') || isAbsolute(repoRelative)) {
    cliError(`APPROVAL_${kind}_OUTSIDE_REPOSITORY_REFUSED`, path);
  }
  if (repoRelative !== expected) {
    cliError(`APPROVAL_${kind}_PATH_NOT_ALLOWLISTED`, path);
  }
  return resolved;
}

async function fileState(path, fileSystem) {
  try {
    const stats = await fileSystem.lstat(path);
    if (!stats.isFile() || stats.isSymbolicLink()) {
      cliError('APPROVAL_OUTPUT_TARGET_MUST_BE_REGULAR_FILE', path);
    }
    return 'REGULAR_FILE';
  } catch (error) {
    if (error?.code === 'ENOENT') return 'MISSING';
    throw error;
  }
}

async function unlinkIfPresent(path, fileSystem) {
  try {
    await fileSystem.unlink(path);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

async function assertCurrentAdditionsExact(path, expected, fileSystem) {
  if (await fileState(path, fileSystem) !== 'REGULAR_FILE') {
    cliError('BATCH_02_ADDITIONS_BASELINE_REQUIRED', path);
  }
  let actual;
  try {
    actual = JSON.parse(await fileSystem.readFile(path, 'utf8'));
  } catch (cause) {
    const error = new Error('BATCH_02_ADDITIONS_BASELINE_INVALID', { cause });
    error.code = 'BATCH_02_ADDITIONS_BASELINE_INVALID';
    throw error;
  }
  if (!same(actual, expected)) {
    cliError('BATCH_02_ADDITIONS_CHANGED_BEFORE_COMMIT', path);
  }
}

async function writeJsonPair(outputs, {
  fileSystem = FILE_SYSTEM,
  transactionId = `${process.pid}-${randomUUID()}`,
} = {}) {
  const entries = outputs.map(({ path, value, mustExist }) => ({
    path,
    value,
    mustExist,
    stage: `${path}.approval-stage-${transactionId}`,
    backup: `${path}.approval-backup-${transactionId}`,
    backedUp: false,
    committed: false,
  }));
  await Promise.all(entries.map((entry) => (
    fileSystem.mkdir(dirname(entry.path), { recursive: true })
  )));
  try {
    await Promise.all(entries.map((entry) => fileSystem.writeFile(
      entry.stage,
      `${JSON.stringify(entry.value, null, 2)}\n`,
      { encoding: 'utf8', flag: 'wx' },
    )));
    for (const entry of entries) {
      if (entry.mustExist) {
        await fileSystem.rename(entry.path, entry.backup);
        entry.backedUp = true;
      }
    }
    for (const entry of entries) {
      await fileSystem.rename(entry.stage, entry.path);
      entry.committed = true;
    }
  } catch (error) {
    for (const entry of [...entries].reverse()) {
      if (entry.committed) await unlinkIfPresent(entry.path, fileSystem);
      if (entry.backedUp) await fileSystem.rename(entry.backup, entry.path);
      await unlinkIfPresent(entry.stage, fileSystem);
    }
    throw error;
  }
  await Promise.all(entries.map((entry) => (
    entry.backedUp
      ? unlinkIfPresent(entry.backup, fileSystem)
      : Promise.resolve()
  )));
}

export async function commitGoldenApprovalOutputPair02({
  additionsOutput,
  receiptOutput,
  expectedExistingAdditions,
  adjudicationAdditions,
  approvalReceipt,
}, {
  fileSystem = FILE_SYSTEM,
  transactionId,
  allowedOutputs = {
    additionsOutput: resolve(REPO_ROOT, GOLDEN_ADJUDICATION_ADDITIONS_02_PATH),
    receiptOutput: resolve(REPO_ROOT, GOLDEN_APPROVAL_02_RECEIPT_PATH),
  },
} = {}) {
  if (
    additionsOutput !== allowedOutputs.additionsOutput
    || receiptOutput !== allowedOutputs.receiptOutput
    || additionsOutput === receiptOutput
  ) {
    cliError('APPROVAL_OUTPUT_PATH_NOT_ALLOWLISTED');
  }
  await assertCurrentAdditionsExact(
    additionsOutput,
    expectedExistingAdditions,
    fileSystem,
  );
  if (await fileState(receiptOutput, fileSystem) !== 'MISSING') {
    cliError('BATCH_02_APPROVAL_RECEIPT_ALREADY_EXISTS', receiptOutput);
  }
  await writeJsonPair([
    { path: additionsOutput, value: adjudicationAdditions, mustExist: true },
    { path: receiptOutput, value: approvalReceipt, mustExist: false },
  ], { fileSystem, transactionId });
}

async function main() {
  const { options, quiet } = parseArgs(process.argv.slice(2));
  if (
    options.get('--confirm-human-reviewed')
      !== GOLDEN_HUMAN_REVIEW_APPROVAL_02_CONFIRMATION
  ) {
    cliError('EXPLICIT_HUMAN_REVIEW_CONFIRMATION_REQUIRED');
  }
  if (
    options.get('--disposition')
      !== GOLDEN_HUMAN_REVIEW_APPROVAL_02_DISPOSITION
  ) {
    cliError('APPROVE_AS_WRITTEN_REQUIRED');
  }
  if (
    options.get('--attestation')
      !== GOLDEN_HUMAN_REVIEW_APPROVAL_02_ATTESTATION
  ) {
    cliError('EXACT_HUMAN_ATTESTATION_REQUIRED');
  }
  if (options.get('--changes') !== 'NONE') {
    cliError('APPROVAL_CHANGES_MUST_BE_NONE');
  }

  const proposalPath = relative(
    REPO_ROOT,
    resolveRepositoryPath(
      options.get('--proposal'),
      GOLDEN_PROPOSAL_02_PATH,
      'INPUT',
    ),
  );
  const additionsOutput = resolveRepositoryPath(
    options.get('--additions-output'),
    GOLDEN_ADJUDICATION_ADDITIONS_02_PATH,
    'OUTPUT',
  );
  const receiptOutput = resolveRepositoryPath(
    options.get('--receipt-output'),
    GOLDEN_APPROVAL_02_RECEIPT_PATH,
    'OUTPUT',
  );

  const [repository, proposal, priorApprovalReceipt] = await Promise.all([
    loadRepositoryGoldenDatasetV1(),
    readJson(proposalPath),
    readJson(GOLDEN_BATCH_01_APPROVAL_RECEIPT_PATH),
  ]);
  const reviewBatch = buildGoldenHumanReviewBatch02(repository.dataset);
  const generatedApprovalMetadata = createGoldenApprovalMetadata02({
    proposalCanonicalSha256: proposal.canonicalSha256,
  });
  const result = materializeGoldenHumanReviewApproval02({
    rawCandidates: repository.rawCandidates,
    rawPriorAdjudications: repository.rawBaseAdjudications,
    rawAdditions: repository.rawAdjudicationAdditions,
    priorApprovalReceipt,
    reviewBatch,
    proposal,
    approval: {
      confirmation: options.get('--confirm-human-reviewed'),
      reviewer: options.get('--reviewer'),
      reviewReceipt: generatedApprovalMetadata.reviewReceipt,
      reviewedAt: generatedApprovalMetadata.reviewedAt,
      disposition: options.get('--disposition'),
      attestation: options.get('--attestation'),
      changes: [],
      datasetCanonicalSha256: options.get('--dataset-sha'),
      priorMaterializedAdjudicationsCanonicalSha256:
        options.get('--prior-adjudications-sha'),
      priorApprovalReceiptCanonicalSha256:
        options.get('--prior-approval-receipt-sha'),
      reviewBatchCanonicalSha256: options.get('--review-batch-sha'),
      proposalCanonicalSha256: options.get('--proposal-sha'),
    },
    now: generatedApprovalMetadata.reviewedAt,
  });

  await commitGoldenApprovalOutputPair02({
    additionsOutput,
    receiptOutput,
    expectedExistingAdditions: repository.rawAdjudicationAdditions,
    adjudicationAdditions: result.adjudicationAdditions,
    approvalReceipt: result.approvalReceipt,
  });
  if (!quiet) {
    process.stdout.write(`${JSON.stringify(result.approvalReceipt, null, 2)}\n`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error?.code || 'GOLDEN_APPROVAL_02_APPLY_FAILED'}: ${error.message}\n`);
    process.exitCode = 1;
  });
}
