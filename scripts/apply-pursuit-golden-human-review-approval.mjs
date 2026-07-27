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
import {
  GOLDEN_HUMAN_REVIEW_APPROVAL_ATTESTATION,
  GOLDEN_HUMAN_REVIEW_APPROVAL_CONFIRMATION,
  GOLDEN_HUMAN_REVIEW_APPROVAL_DISPOSITION,
  materializeGoldenHumanReviewApproval,
} from './lib/golden-human-review-approval.mjs';
import { buildGoldenHumanReviewBatch } from './lib/golden-human-review-batch.mjs';
import { REPO_ROOT } from './lib/repository-claim-registry.mjs';
import {
  GOLDEN_ADJUDICATIONS_PATH,
  loadRepositoryGoldenDataset,
} from './lib/repository-golden-dataset.mjs';

const VALUE_OPTIONS = new Set([
  '--confirm-human-reviewed',
  '--reviewer',
  '--review-receipt',
  '--reviewed-at',
  '--dataset-sha',
  '--proposal-sha',
  '--proposal',
  '--disposition',
  '--attestation',
  '--changes',
  '--adjudications-output',
  '--receipt-output',
]);
const BOOLEAN_OPTIONS = new Set(['--quiet']);
export const GOLDEN_APPROVAL_RECEIPT_PATH =
  'tmp/codex/pursuit-golden-human-review-batch-01-approval-receipt-non-production.json';
const FILE_SYSTEM = Object.freeze({ lstat, mkdir, rename, unlink, writeFile });

function cliError(code, detail = '') {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  throw error;
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
    if (!value || value.startsWith('--')) cliError('CLI_OPTION_VALUE_REQUIRED', token);
    options.set(token, value);
    index += 1;
  }
  for (const name of VALUE_OPTIONS) {
    if (!options.has(name)) cliError('REQUIRED_CLI_OPTION_MISSING', name);
  }
  return { options, quiet };
}

async function readJson(path) {
  const resolved = resolve(REPO_ROOT, path);
  let source;
  try {
    source = await readFile(resolved, 'utf8');
  } catch (cause) {
    const error = new Error(`APPROVAL_INPUT_READ_FAILED:${path}`, { cause });
    error.code = 'APPROVAL_INPUT_READ_FAILED';
    throw error;
  }
  try {
    return JSON.parse(source);
  } catch (cause) {
    const error = new Error(`APPROVAL_INPUT_JSON_INVALID:${path}`, { cause });
    error.code = 'APPROVAL_INPUT_JSON_INVALID';
    throw error;
  }
}

function resolveOutputPath(path, kind) {
  if (isAbsolute(path)) cliError('ABSOLUTE_APPROVAL_OUTPUT_REFUSED', path);
  const resolved = resolve(REPO_ROOT, path);
  const repoRelative = relative(REPO_ROOT, resolved);
  if (!repoRelative || repoRelative.startsWith('..') || isAbsolute(repoRelative)) {
    cliError('APPROVAL_OUTPUT_OUTSIDE_REPOSITORY_REFUSED', path);
  }
  const expected = kind === 'adjudications'
    ? GOLDEN_ADJUDICATIONS_PATH
    : GOLDEN_APPROVAL_RECEIPT_PATH;
  if (repoRelative !== expected) {
    cliError('APPROVAL_OUTPUT_PATH_NOT_ALLOWLISTED', path);
  }
  return resolved;
}

async function existingRegularFile(path, fileSystem) {
  try {
    const stats = await fileSystem.lstat(path);
    if (!stats.isFile() || stats.isSymbolicLink()) {
      cliError('APPROVAL_OUTPUT_TARGET_MUST_BE_REGULAR_FILE', path);
    }
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
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

async function writeJsonPair(outputs, {
  fileSystem = FILE_SYSTEM,
  transactionId = `${process.pid}-${randomUUID()}`,
} = {}) {
  const entries = outputs.map(({ path, value }) => ({
    path,
    value,
    stage: `${path}.approval-stage-${transactionId}`,
    backup: `${path}.approval-backup-${transactionId}`,
    existed: false,
    backedUp: false,
    committed: false,
  }));
  await Promise.all(entries.map(async (entry) => {
    await fileSystem.mkdir(dirname(entry.path), { recursive: true });
    entry.existed = await existingRegularFile(entry.path, fileSystem);
  }));
  try {
    await Promise.all(entries.map((entry) => fileSystem.writeFile(
      entry.stage,
      `${JSON.stringify(entry.value, null, 2)}\n`,
      { encoding: 'utf8', flag: 'wx' },
    )));
    for (const entry of entries) {
      if (entry.existed) {
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
    entry.backedUp ? unlinkIfPresent(entry.backup, fileSystem) : Promise.resolve()
  )));
}

export async function commitGoldenApprovalOutputPair({
  adjudicationsOutput,
  receiptOutput,
  adjudications,
  approvalReceipt,
}, options = {}) {
  const expectedAdjudications = resolve(REPO_ROOT, GOLDEN_ADJUDICATIONS_PATH);
  const expectedReceipt = resolve(REPO_ROOT, GOLDEN_APPROVAL_RECEIPT_PATH);
  if (
    adjudicationsOutput !== expectedAdjudications
    || receiptOutput !== expectedReceipt
  ) {
    cliError('APPROVAL_OUTPUT_PATH_NOT_ALLOWLISTED');
  }
  await writeJsonPair([
    { path: adjudicationsOutput, value: adjudications },
    { path: receiptOutput, value: approvalReceipt },
  ], options);
}

async function main() {
  const { options, quiet } = parseArgs(process.argv.slice(2));
  if (
    options.get('--confirm-human-reviewed')
    !== GOLDEN_HUMAN_REVIEW_APPROVAL_CONFIRMATION
  ) {
    cliError('EXPLICIT_HUMAN_REVIEW_CONFIRMATION_REQUIRED');
  }
  if (options.get('--disposition') !== GOLDEN_HUMAN_REVIEW_APPROVAL_DISPOSITION) {
    cliError('APPROVE_AS_WRITTEN_REQUIRED');
  }
  if (options.get('--attestation') !== GOLDEN_HUMAN_REVIEW_APPROVAL_ATTESTATION) {
    cliError('EXACT_HUMAN_ATTESTATION_REQUIRED');
  }
  if (options.get('--changes') !== 'NONE') {
    cliError('APPROVAL_CHANGES_MUST_BE_NONE');
  }

  const adjudicationsOutput = resolveOutputPath(
    options.get('--adjudications-output'),
    'adjudications',
  );
  const receiptOutput = resolveOutputPath(
    options.get('--receipt-output'),
    'receipt',
  );
  if (adjudicationsOutput === receiptOutput) {
    cliError('APPROVAL_OUTPUT_PATHS_MUST_DIFFER');
  }

  const [{ rawCandidates, rawAdjudications, dataset }, proposal] = await Promise.all([
    loadRepositoryGoldenDataset(),
    readJson(options.get('--proposal')),
  ]);
  const reviewBatch = buildGoldenHumanReviewBatch(dataset);
  const result = materializeGoldenHumanReviewApproval({
    rawCandidates,
    rawAdjudications,
    reviewBatch,
    proposal,
    approval: {
      reviewer: options.get('--reviewer'),
      reviewReceipt: options.get('--review-receipt'),
      reviewedAt: options.get('--reviewed-at'),
      disposition: options.get('--disposition'),
      attestation: options.get('--attestation'),
      changes: [],
      datasetCanonicalSha256: options.get('--dataset-sha'),
      proposalCanonicalSha256: options.get('--proposal-sha'),
    },
  });

  await commitGoldenApprovalOutputPair({
    adjudicationsOutput,
    receiptOutput,
    adjudications: result.adjudications,
    approvalReceipt: result.approvalReceipt,
  });
  if (!quiet) {
    process.stdout.write(`${JSON.stringify(result.approvalReceipt, null, 2)}\n`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error?.code || 'GOLDEN_APPROVAL_APPLY_FAILED'}: ${error.message}\n`);
    process.exitCode = 1;
  });
}
