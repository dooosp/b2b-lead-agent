#!/usr/bin/env node

import { constants as fsConstants } from 'node:fs';
import {
  lstat,
  open
} from 'node:fs/promises';
import path, { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSyntheticApprovedReviewPatchFixture } from '../evidence-claim-workbench/fixtures/synthetic-approved-review-patch-v0.mjs';
import {
  REVIEW_PATCH_LIMITS,
  serializeReviewPatch,
  validateReviewPatch
} from '../evidence-claim-workbench/domain/review-patch.mjs';

function optionValue(flag, argv) {
  const matches = argv.reduce((indices, value, index) => value === flag ? [...indices, index] : indices, []);
  if (matches.length > 1) throw new Error(`DUPLICATE_OPTION:${flag}`);
  if (matches.length === 0) return '';
  const value = argv[matches[0] + 1];
  if (!value || value.startsWith('--')) throw new Error(`OPTION_VALUE_REQUIRED:${flag}`);
  return value;
}

function resolveSafeJsonPath(cwd, value, label) {
  if (typeof value !== 'string'
    || !value
    || value.includes('\\')
    || value.includes('\0')
    || value.includes('%')
    || path.isAbsolute(value)
    || path.posix.normalize(value) !== value
    || value.startsWith('./')
    || value.split('/').some((segment) => !segment || segment === '.' || segment === '..')
    || path.posix.extname(value).toLowerCase() !== '.json') {
    throw new Error(`${label}_PATH_REFUSED`);
  }
  const target = path.resolve(cwd, ...value.split('/'));
  const relative = path.relative(cwd, target);
  if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`${label}_PATH_REFUSED`);
  }
  return target;
}

async function readPatch(cwd, relativePath, { inject = {} } = {}) {
  const target = resolveSafeJsonPath(cwd, relativePath, 'INPUT');
  const metadata = await lstat(target).catch(() => null);
  if (!metadata || metadata.isSymbolicLink() || !metadata.isFile() || metadata.nlink !== 1) {
    throw new Error('INPUT_FILE_REFUSED');
  }
  if (metadata.size < 1 || metadata.size > REVIEW_PATCH_LIMITS.maxSerializedBytes) {
    throw new Error('INPUT_SIZE_REFUSED');
  }
  const handle = await open(target, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW || 0));
  try {
    const opened = await handle.stat();
    if (!opened.isFile()
      || opened.nlink !== 1
      || opened.dev !== metadata.dev
      || opened.ino !== metadata.ino
      || opened.size !== metadata.size
      || opened.mtimeMs !== metadata.mtimeMs
      || opened.ctimeMs !== metadata.ctimeMs) {
      throw new Error('INPUT_CHANGED_DURING_READ');
    }
    await inject.beforeInputRead?.({ target, maximumBytes: REVIEW_PATCH_LIMITS.maxSerializedBytes });
    const chunks = [];
    let total = 0;
    while (total <= REVIEW_PATCH_LIMITS.maxSerializedBytes) {
      const remaining = REVIEW_PATCH_LIMITS.maxSerializedBytes + 1 - total;
      const buffer = Buffer.allocUnsafe(Math.min(64 * 1024, remaining));
      const { bytesRead } = await handle.read(buffer, 0, buffer.byteLength, null);
      if (bytesRead === 0) break;
      chunks.push(buffer.subarray(0, bytesRead));
      total += bytesRead;
    }
    if (total > REVIEW_PATCH_LIMITS.maxSerializedBytes) throw new Error('INPUT_SIZE_REFUSED');
    const bytes = Buffer.concat(chunks, total);
    const after = await handle.stat();
    if (bytes.byteLength !== metadata.size
      || after.nlink !== 1
      || after.dev !== metadata.dev
      || after.ino !== metadata.ino
      || after.size !== metadata.size
      || after.mtimeMs !== metadata.mtimeMs
      || after.ctimeMs !== metadata.ctimeMs) {
      throw new Error('INPUT_CHANGED_DURING_READ');
    }
    let parsed;
    try {
      parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    } catch {
      throw new Error('INPUT_JSON_REFUSED');
    }
    return validateReviewPatch(parsed);
  } finally {
    await handle.close();
  }
}

export async function exportEvidenceClaimReview({ argv = [], cwd = process.cwd(), inject = {} } = {}) {
  const allowed = new Set(['--input']);
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (typeof value !== 'string' || !value.startsWith('--')) throw new Error('UNEXPECTED_POSITIONAL_ARGUMENT');
    if (!allowed.has(value)) throw new Error(`UNKNOWN_OPTION:${value}`);
    if (index + 1 >= argv.length || argv[index + 1].startsWith('--')) {
      throw new Error(`OPTION_VALUE_REQUIRED:${value}`);
    }
    index += 1;
  }
  const input = optionValue('--input', argv);
  const patch = input
    ? await readPatch(cwd, input, { inject })
    : createSyntheticApprovedReviewPatchFixture();
  const serialized = serializeReviewPatch(patch);
  return { patch, serialized, outputPath: '' };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await exportEvidenceClaimReview({ argv: process.argv.slice(2) });
    process.stdout.write(result.serialized);
  } catch (error) {
    const candidate = typeof error?.code === 'string' ? error.code : String(error?.message || 'UNKNOWN_REFUSAL');
    const code = candidate.match(/^[A-Z][A-Z0-9_]{2,80}/u)?.[0] || 'UNKNOWN_REFUSAL';
    process.stderr.write(`EXPORT_EVIDENCE_CLAIM_REVIEW_REFUSED:${code}\n`);
    process.exitCode = 1;
  }
}
