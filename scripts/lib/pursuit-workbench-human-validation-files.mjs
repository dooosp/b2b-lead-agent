import { createHash } from 'node:crypto';
import {
  closeSync,
  constants,
  fchmodSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  rmdirSync,
  unlinkSync,
  writeFileSync
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  HUMAN_VALIDATION_ARTIFACT_HASHES,
  HUMAN_VALIDATION_LIMITS,
  HUMAN_VALIDATION_REVIEWER_ROSTER,
  HUMAN_VALIDATION_SESSION_DIRECTORY,
  HUMAN_VALIDATION_SESSION_FILES,
  HumanValidationError,
  aggregateHumanValidationSessions,
  createHumanValidationSessionSkeleton,
  parseHumanValidationSessionJson,
  serializeHumanValidationSession,
  validateHumanValidationSession
} from '../../pursuit-workbench/domain/human-validation.mjs';

export const HUMAN_VALIDATION_REPOSITORY_ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const HUMAN_VALIDATION_SESSION_DIRECTORY_PATH = resolve(
  HUMAN_VALIDATION_REPOSITORY_ROOT,
  HUMAN_VALIDATION_SESSION_DIRECTORY
);

function fail(code) {
  throw new HumanValidationError(code);
}

function currentUid() {
  return typeof process.getuid === 'function' ? process.getuid() : null;
}

function assertOwned(stat, code) {
  const uid = currentUid();
  if (uid !== null && stat.uid !== uid) fail(code);
}

function assertTrackedArtifact(path) {
  let stat;
  try { stat = lstatSync(path); } catch { fail('FROZEN_ARTIFACT_MISSING'); }
  if (stat.isSymbolicLink() || !stat.isFile() || stat.nlink !== 1) fail('FROZEN_ARTIFACT_UNSAFE');
  return readFileSync(path);
}

export function verifyFrozenHumanValidationArtifacts() {
  for (const [relativePath, expectedDigest] of Object.entries(HUMAN_VALIDATION_ARTIFACT_HASHES)) {
    const bytes = assertTrackedArtifact(resolve(HUMAN_VALIDATION_REPOSITORY_ROOT, relativePath));
    if (createHash('sha256').update(bytes).digest('hex') !== expectedDigest) fail('FROZEN_ARTIFACT_HASH_MISMATCH');
  }
}

function assertSafeParentDirectory() {
  const parent = dirname(HUMAN_VALIDATION_SESSION_DIRECTORY_PATH);
  let stat;
  try { stat = lstatSync(parent); } catch { fail('SESSION_PARENT_DIRECTORY_MISSING'); }
  if (stat.isSymbolicLink() || !stat.isDirectory()) fail('SESSION_PARENT_DIRECTORY_UNSAFE');
  assertOwned(stat, 'SESSION_PARENT_DIRECTORY_OWNER_UNSAFE');
}

function assertSafeSessionDirectory() {
  let stat;
  try { stat = lstatSync(HUMAN_VALIDATION_SESSION_DIRECTORY_PATH); } catch { fail('SESSION_DIRECTORY_MISSING'); }
  if (stat.isSymbolicLink() || !stat.isDirectory()) fail('SESSION_DIRECTORY_UNSAFE');
  assertOwned(stat, 'SESSION_DIRECTORY_OWNER_UNSAFE');
  if ((stat.mode & 0o777) !== 0o700) fail('SESSION_DIRECTORY_PERMISSIONS_UNSAFE');
}

function writeExclusivePrivateFile(path, contents) {
  const noFollow = constants.O_NOFOLLOW || 0;
  const descriptor = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | noFollow, 0o600);
  try {
    writeFileSync(descriptor, contents, { encoding: 'utf8' });
    fchmodSync(descriptor, 0o600);
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

export function prepareHumanValidationSessionFiles() {
  verifyFrozenHumanValidationArtifacts();
  assertSafeParentDirectory();
  let directoryCreated = false;
  try {
    mkdirSync(HUMAN_VALIDATION_SESSION_DIRECTORY_PATH, { mode: 0o700 });
    directoryCreated = true;
  } catch (error) {
    if (error?.code !== 'EEXIST') fail('SESSION_DIRECTORY_CREATE_FAILED');
  }
  assertSafeSessionDirectory();
  if (readdirSync(HUMAN_VALIDATION_SESSION_DIRECTORY_PATH).length !== 0) fail('SESSION_PREPARE_REFUSES_OVERWRITE');

  const created = [];
  try {
    for (const reviewerId of Object.keys(HUMAN_VALIDATION_REVIEWER_ROSTER)) {
      const path = resolve(HUMAN_VALIDATION_SESSION_DIRECTORY_PATH, HUMAN_VALIDATION_SESSION_FILES[reviewerId]);
      writeExclusivePrivateFile(path, serializeHumanValidationSession(createHumanValidationSessionSkeleton(reviewerId)));
      created.push(path);
    }
  } catch (error) {
    for (const path of created) {
      try { unlinkSync(path); } catch {}
    }
    if (directoryCreated) {
      try { rmdirSync(HUMAN_VALIDATION_SESSION_DIRECTORY_PATH); } catch {}
    }
    if (error instanceof HumanValidationError) throw error;
    fail(error?.code === 'EEXIST' ? 'SESSION_PREPARE_REFUSES_OVERWRITE' : 'SESSION_FILE_CREATE_FAILED');
  }
  return Object.keys(HUMAN_VALIDATION_REVIEWER_ROSTER);
}

function readPrivateRegularFile(path, afterOpen) {
  let before;
  try { before = lstatSync(path); } catch { fail('SESSION_FILE_MISSING'); }
  if (before.isSymbolicLink()) fail('SESSION_FILE_SYMLINK_REFUSED');
  if (!before.isFile()) fail('SESSION_FILE_NON_REGULAR');
  if (before.nlink !== 1) fail('SESSION_FILE_LINK_COUNT_UNSAFE');
  assertOwned(before, 'SESSION_FILE_OWNER_UNSAFE');
  if ((before.mode & 0o777) !== 0o600) fail('SESSION_FILE_PERMISSIONS_UNSAFE');
  if (before.size <= 0 || before.size > HUMAN_VALIDATION_LIMITS.maxFileBytes) fail('SESSION_FILE_SIZE_INVALID');

  const noFollow = constants.O_NOFOLLOW || 0;
  let descriptor;
  try { descriptor = openSync(path, constants.O_RDONLY | noFollow); } catch { fail('SESSION_FILE_OPEN_REFUSED'); }
  try {
    const opened = fstatSync(descriptor);
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino
      || opened.size !== before.size || opened.nlink !== before.nlink
      || opened.mtimeMs !== before.mtimeMs || opened.ctimeMs !== before.ctimeMs) {
      fail('SESSION_FILE_RACE_REFUSED');
    }
    if (afterOpen) afterOpen(path);
    const bytes = readFileSync(descriptor);
    const after = fstatSync(descriptor);
    if (!after.isFile() || after.dev !== opened.dev || after.ino !== opened.ino
      || after.size !== opened.size || after.nlink !== opened.nlink
      || after.mtimeMs !== opened.mtimeMs || after.ctimeMs !== opened.ctimeMs
      || bytes.byteLength !== opened.size) fail('SESSION_FILE_RACE_REFUSED');
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      fail('SESSION_FILE_UTF8_INVALID');
    }
  } finally {
    closeSync(descriptor);
  }
}

export function loadAndAggregateHumanValidationSessionFiles({ afterFileOpenForTest } = {}) {
  verifyFrozenHumanValidationArtifacts();
  assertSafeSessionDirectory();
  const expectedNames = Object.values(HUMAN_VALIDATION_SESSION_FILES).sort();
  const entries = readdirSync(HUMAN_VALIDATION_SESSION_DIRECTORY_PATH, { withFileTypes: true });
  const actualNames = entries.map((entry) => entry.name).sort();
  if (actualNames.length !== expectedNames.length
    || actualNames.some((name, index) => name !== expectedNames[index])) fail('SESSION_FILE_SET_INVALID');

  const records = [];
  for (const [reviewerId, filename] of Object.entries(HUMAN_VALIDATION_SESSION_FILES)) {
    const text = readPrivateRegularFile(
      resolve(HUMAN_VALIDATION_SESSION_DIRECTORY_PATH, filename),
      afterFileOpenForTest
    );
    const record = parseHumanValidationSessionJson(text);
    records.push(validateHumanValidationSession(record, { expectedReviewerId: reviewerId }));
  }
  return aggregateHumanValidationSessions(records);
}
