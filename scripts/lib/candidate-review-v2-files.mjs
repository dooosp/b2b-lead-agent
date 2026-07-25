import { createHash, randomBytes } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import {
  chmod,
  lstat,
  mkdir,
  open,
  readdir,
  realpath,
  rename,
  unlink
} from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { execFile as execFileCallback } from 'node:child_process';

const execFile = promisify(execFileCallback);
const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const ROUND_ID_PATTERN = /^round_[a-f0-9]{64}$/u;
const NOT_PRODUCTION_EVIDENCE = 'NOT_PRODUCTION_EVIDENCE';
const FILE_SCHEMA_VERSION = 'pr207-candidate-review-v2-files-v1';
const ROUND_MANIFEST_SCHEMA_VERSION = 'pr207-candidate-review-v2-round-manifest-v1';
const CLOSE_PLAN_SCHEMA_VERSION = 'pr207-candidate-review-v2-close-plan-v1';

const BASE_DIRECTORY = 'tmp/evidence-claim-workbench/human-approval';
const CUSTODIAN_ROOT = `${BASE_DIRECTORY}/pr207-candidate-review-v2-custodian`;
const PRIMARY_ROOT = `${BASE_DIRECTORY}/pr207-candidate-review-v2-primary-submission`;
const SECONDARY_ROOT = `${BASE_DIRECTORY}/pr207-candidate-review-v2-secondary-submission`;
const ROUND_FILENAME = 'pr207-candidate-review-v2-round.json';
const PRIMARY_SUBMISSION_FILENAME = 'pr207-candidate-review-v2-primary-submission.json';
const SECONDARY_SUBMISSION_FILENAME = 'pr207-candidate-review-v2-secondary-submission.json';
const SECONDARY_PATCH_FILENAME = 'pr207-candidate-review-v2-secondary-patch-assessments.json';

function deepFreeze(value, seen = new Set()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function asciiCompare(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function createNumberedNames(prefix, maximum) {
  return Array.from(
    { length: maximum },
    (_, index) => `${prefix}${String(index + 1).padStart(2, '0')}.json`
  );
}

const CANDIDATE_FILENAMES = createNumberedNames(
  'pr207-candidate-review-v2-candidates-',
  4
);
const PATCH_FILENAMES = createNumberedNames(
  'pr207-candidate-review-v2-patch-',
  35
);
const CUSTODIAN_FIXED_FILENAMES = [
  ROUND_FILENAME,
  ...CANDIDATE_FILENAMES,
  'pr207-candidate-review-v2-primary-decisions.json',
  'pr207-candidate-review-v2-secondary-decisions.json',
  SECONDARY_PATCH_FILENAME,
  'pr207-candidate-review-v2-final-decisions.json',
  'pr207-candidate-review-v2-patch-set.json'
];

export const CANDIDATE_REVIEW_V2_PATHS = deepFreeze({
  baseDirectory: BASE_DIRECTORY,
  roots: {
    custodian: CUSTODIAN_ROOT,
    primary: PRIMARY_ROOT,
    secondary: SECONDARY_ROOT
  },
  round: `${CUSTODIAN_ROOT}/${ROUND_FILENAME}`,
  primarySubmission: `${PRIMARY_ROOT}/${PRIMARY_SUBMISSION_FILENAME}`,
  secondarySubmission: `${SECONDARY_ROOT}/${SECONDARY_SUBMISSION_FILENAME}`,
  secondaryPatchAssessments: `${SECONDARY_ROOT}/${SECONDARY_PATCH_FILENAME}`,
  aggregate: 'docs/product/validation/pr207-candidate-review-v2-aggregate.json',
  aggregateReceipt:
    'docs/product/validation/pr207-candidate-review-v2-aggregate-receipt.json'
});

export const CANDIDATE_REVIEW_V2_LIMITS = deepFreeze({
  minimumCandidates: 30,
  maximumCandidates: 35,
  maximumCandidateRowsPerShard: 10,
  maximumRoleDecisionRows: 70,
  maximumRowsPerRole: 35,
  maximumPatchShards: 35,
  maximumDirectQuoteCodePoints: 500,
  maximumAggregateExcerptCodePoints: 17_500,
  maximumFileBytes: 128 * 1024,
  maximumPackageBytes: 1024 * 1024,
  maximumJsonDepth: 64,
  maximumJsonNodes: 100_000,
  rootMode: 0o700,
  draftFileMode: 0o600,
  sealedFileMode: 0o400
});

export const CANDIDATE_REVIEW_V2_ALLOWLISTS = deepFreeze({
  custodian: [
    ...CUSTODIAN_FIXED_FILENAMES,
    ...PATCH_FILENAMES
  ].sort(asciiCompare),
  primary: [PRIMARY_SUBMISSION_FILENAME],
  secondary: [
    SECONDARY_SUBMISSION_FILENAME,
    SECONDARY_PATCH_FILENAME
  ].sort(asciiCompare),
  candidateShards: [...CANDIDATE_FILENAMES],
  patchShards: [...PATCH_FILENAMES]
});

const ROOT_ENTRIES = deepFreeze([
  { label: 'CUSTODIAN', relativePath: CUSTODIAN_ROOT },
  { label: 'PRIMARY_TECHNICAL_REVIEWER', relativePath: PRIMARY_ROOT },
  { label: 'SECONDARY_EVIDENCE_REVIEWER', relativePath: SECONDARY_ROOT }
]);

const ALLOWED_RELATIVE_FILES = deepFreeze([
  ...CANDIDATE_REVIEW_V2_ALLOWLISTS.custodian.map((name) => `${CUSTODIAN_ROOT}/${name}`),
  ...CANDIDATE_REVIEW_V2_ALLOWLISTS.primary.map((name) => `${PRIMARY_ROOT}/${name}`),
  ...CANDIDATE_REVIEW_V2_ALLOWLISTS.secondary.map((name) => `${SECONDARY_ROOT}/${name}`)
].sort(asciiCompare));
const ALLOWED_RELATIVE_FILE_SET = new Set(ALLOWED_RELATIVE_FILES);

const FORBIDDEN_LEDGER_KEY = /^(?:pageText|pages|fullPage|pageContent|sourceBinary|binary|buffer|bytes|screenshot|ocr(?:Text|Asset)?|filePath|absolutePath|localPath|reviewerName|reviewerEmail|reviewerUserId|userId|humanName|email|phone|phoneNumber|employer|accountId|recipient|authorization|password|passwd|token|apiKey|api_key|cookie|secret|credentials?|environment|customerData|privateData|freeform|freeText|notes?)$/iu;
const SECRET_SHAPED_VALUE = /(?:bearer\s+[a-z0-9._~+\/-]{16,}|gh[oprsu]_[a-z0-9]{20,}|sk-[a-z0-9_-]{20,}|AIza[a-z0-9_-]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:password|passwd|token|api[_-]?key|secret)\s*[:=]\s*[^\s]{8,})/iu;
const PRIVATE_DATA_SHAPED_VALUE = /(?:\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b|(?:\+?82[- .]?)?0\d{1,2}[- .]\d{3,4}[- .]\d{4}|\+[1-9]\d{0,2}[- .(]+\d{2,4}[- .)]+\d{3,4}[- .]+\d{4})/iu;
const ABSOLUTE_LOCAL_PATH = /(?:\bfile:(?:\/{1,3}|\\+)|(?:^|[\s"'(=:\[\{])(?:\/(?!\/)|[A-Za-z]:[\\/]|\\\\)|(?:^|[\s"'(=\[\{])\/\/[^/\s])/iu;
const UNSAFE_CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069]/u;
const FORBIDDEN_AUTHORITY_VALUE = /(?:^|[^A-Z0-9])(?:VERIFIED|CUSTOMER_USE_ALLOWED|PRODUCTION_APPROVED|PRODUCTION_READY_TRUE|PROOF_EXECUTION_APPROVED)(?=$|[^A-Z0-9])/iu;

export class CandidateReviewV2FilesError extends Error {
  constructor(code, details = {}) {
    super(code);
    this.name = 'CandidateReviewV2FilesError';
    this.code = code;
    this.status = 'HOLD';
    this.boundary = NOT_PRODUCTION_EVIDENCE;
    this.details = deepFreeze({ ...details });
  }
}

function fail(code, details) {
  throw new CandidateReviewV2FilesError(code, details);
}

function assertPlainObject(value, code = 'PLAIN_OBJECT_REQUIRED') {
  if (value === null
    || typeof value !== 'object'
    || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype) {
    fail(code);
  }
}

function assertExactKeys(value, keys, code) {
  assertPlainObject(value, code);
  const actual = Object.keys(value).sort(asciiCompare);
  const expected = [...keys].sort(asciiCompare);
  if (actual.length !== expected.length
    || actual.some((key, index) => key !== expected[index])) {
    fail(code, { expectedKeys: expected, actualKeys: actual });
  }
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function canonicalStringify(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('NON_FINITE_JSON_NUMBER_REFUSED');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalStringify(entry)).join(',')}]`;
  }
  assertPlainObject(value, 'CANONICAL_JSON_OBJECT_REQUIRED');
  return `{${Object.keys(value)
    .sort(asciiCompare)
    .map((key) => `${JSON.stringify(key)}:${canonicalStringify(value[key])}`)
    .join(',')}}`;
}

function parseJsonString(text, cursor) {
  const start = cursor.index;
  cursor.index += 1;
  while (cursor.index < text.length) {
    const code = text.charCodeAt(cursor.index);
    if (code === 0x22) {
      cursor.index += 1;
      try {
        return JSON.parse(text.slice(start, cursor.index));
      } catch {
        fail('INVALID_JSON_STRING');
      }
    }
    if (code < 0x20) fail('INVALID_JSON_CONTROL_CHARACTER');
    if (code === 0x5c) {
      cursor.index += 1;
      if (cursor.index >= text.length) fail('INVALID_JSON_ESCAPE');
      const escaped = text[cursor.index];
      if (escaped === 'u') {
        const digits = text.slice(cursor.index + 1, cursor.index + 5);
        if (!/^[a-fA-F0-9]{4}$/u.test(digits)) fail('INVALID_JSON_UNICODE_ESCAPE');
        cursor.index += 5;
        continue;
      }
      if (!'"\\/bfnrt'.includes(escaped)) fail('INVALID_JSON_ESCAPE');
    }
    cursor.index += 1;
  }
  fail('UNTERMINATED_JSON_STRING');
}

function skipJsonWhitespace(text, cursor) {
  while (cursor.index < text.length
    && (text[cursor.index] === ' '
      || text[cursor.index] === '\t'
      || text[cursor.index] === '\r'
      || text[cursor.index] === '\n')) {
    cursor.index += 1;
  }
}

function parseJsonValue(text, cursor, depth) {
  if (depth > CANDIDATE_REVIEW_V2_LIMITS.maximumJsonDepth) {
    fail('JSON_DEPTH_LIMIT_EXCEEDED');
  }
  cursor.nodes += 1;
  if (cursor.nodes > CANDIDATE_REVIEW_V2_LIMITS.maximumJsonNodes) {
    fail('JSON_NODE_LIMIT_EXCEEDED');
  }
  skipJsonWhitespace(text, cursor);
  const token = text[cursor.index];
  if (token === '"') return parseJsonString(text, cursor);
  if (token === '{') {
    cursor.index += 1;
    const output = {};
    const keys = new Set();
    skipJsonWhitespace(text, cursor);
    if (text[cursor.index] === '}') {
      cursor.index += 1;
      return output;
    }
    while (cursor.index < text.length) {
      skipJsonWhitespace(text, cursor);
      if (text[cursor.index] !== '"') fail('JSON_OBJECT_KEY_REQUIRED');
      const key = parseJsonString(text, cursor);
      if (keys.has(key)) fail('DUPLICATE_JSON_KEY', { key });
      keys.add(key);
      skipJsonWhitespace(text, cursor);
      if (text[cursor.index] !== ':') fail('JSON_OBJECT_COLON_REQUIRED');
      cursor.index += 1;
      const value = parseJsonValue(text, cursor, depth + 1);
      Object.defineProperty(output, key, {
        configurable: true,
        enumerable: true,
        value,
        writable: true
      });
      skipJsonWhitespace(text, cursor);
      if (text[cursor.index] === '}') {
        cursor.index += 1;
        return output;
      }
      if (text[cursor.index] !== ',') fail('JSON_OBJECT_SEPARATOR_REQUIRED');
      cursor.index += 1;
    }
    fail('UNTERMINATED_JSON_OBJECT');
  }
  if (token === '[') {
    cursor.index += 1;
    const output = [];
    skipJsonWhitespace(text, cursor);
    if (text[cursor.index] === ']') {
      cursor.index += 1;
      return output;
    }
    while (cursor.index < text.length) {
      output.push(parseJsonValue(text, cursor, depth + 1));
      skipJsonWhitespace(text, cursor);
      if (text[cursor.index] === ']') {
        cursor.index += 1;
        return output;
      }
      if (text[cursor.index] !== ',') fail('JSON_ARRAY_SEPARATOR_REQUIRED');
      cursor.index += 1;
    }
    fail('UNTERMINATED_JSON_ARRAY');
  }
  const remainder = text.slice(cursor.index);
  for (const [literal, value] of [
    ['true', true],
    ['false', false],
    ['null', null]
  ]) {
    if (remainder.startsWith(literal)) {
      cursor.index += literal.length;
      return value;
    }
  }
  const match = remainder.match(/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/u);
  if (!match) fail('INVALID_JSON_VALUE');
  cursor.index += match[0].length;
  const number = Number(match[0]);
  if (!Number.isFinite(number)) fail('NON_FINITE_JSON_NUMBER_REFUSED');
  return number;
}

export function parseStrictCandidateReviewJson(text) {
  if (typeof text !== 'string' || text.length === 0) fail('JSON_TEXT_REQUIRED');
  const cursor = { index: 0, nodes: 0 };
  const value = parseJsonValue(text, cursor, 0);
  skipJsonWhitespace(text, cursor);
  if (cursor.index !== text.length) fail('TRAILING_JSON_CONTENT_REFUSED');
  return deepFreeze(value);
}

function normalizeRelativePath(relativePath, { requireAllowlisted = true } = {}) {
  if (typeof relativePath !== 'string'
    || relativePath.length === 0
    || relativePath.includes('\\')
    || relativePath.includes('\0')
    || relativePath.includes('%')
    || path.posix.isAbsolute(relativePath)
    || path.posix.normalize(relativePath) !== relativePath
    || relativePath.startsWith('./')
    || relativePath.split('/').some((segment) =>
      !segment || segment === '.' || segment === '..' || segment.startsWith('.'))) {
    fail('CANDIDATE_REVIEW_PATH_REFUSED');
  }
  if (requireAllowlisted && !ALLOWED_RELATIVE_FILE_SET.has(relativePath)) {
    fail('CANDIDATE_REVIEW_PATH_NOT_ALLOWLISTED', { relativePath });
  }
  return relativePath;
}

async function resolveRepositoryRoot(repositoryRoot) {
  if (typeof repositoryRoot !== 'string' || !path.isAbsolute(repositoryRoot)) {
    fail('ABSOLUTE_REPOSITORY_ROOT_REQUIRED');
  }
  let rootStats;
  let canonicalRoot;
  try {
    rootStats = await lstat(repositoryRoot);
    canonicalRoot = await realpath(repositoryRoot);
  } catch {
    fail('REPOSITORY_ROOT_NOT_FOUND');
  }
  if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) {
    fail('REPOSITORY_ROOT_UNSAFE');
  }
  return canonicalRoot;
}

function modeOf(metadata) {
  return Number(metadata.mode & 0o777n);
}

function currentUid() {
  return typeof process.getuid === 'function' ? BigInt(process.getuid()) : null;
}

function assertOwned(metadata, code) {
  const uid = currentUid();
  if (uid !== null && metadata.uid !== uid) fail(code);
}

async function inspectDirectory(absolutePath, expectedMode, codePrefix) {
  let metadata;
  try {
    metadata = await lstat(absolutePath, { bigint: true });
  } catch {
    fail(`${codePrefix}_MISSING`);
  }
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    fail(`${codePrefix}_UNSAFE`);
  }
  if (modeOf(metadata) !== expectedMode) fail(`${codePrefix}_MODE_UNSAFE`);
  assertOwned(metadata, `${codePrefix}_OWNER_UNSAFE`);
  return metadata;
}

async function ensurePrivateDirectoryChain(canonicalRoot, relativePath) {
  let current = canonicalRoot;
  for (const segment of relativePath.split('/')) {
    current = path.join(current, segment);
    try {
      const metadata = await lstat(current, { bigint: true });
      if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
        fail('CANDIDATE_REVIEW_DIRECTORY_COMPONENT_UNSAFE', { relativePath });
      }
    } catch (error) {
      if (error instanceof CandidateReviewV2FilesError) throw error;
      try {
        await mkdir(current, { mode: CANDIDATE_REVIEW_V2_LIMITS.rootMode });
        await chmod(current, CANDIDATE_REVIEW_V2_LIMITS.rootMode);
      } catch {
        fail('CANDIDATE_REVIEW_DIRECTORY_CREATE_FAILED', { relativePath });
      }
    }
  }
}

function gitFailureCode(error) {
  return typeof error?.code === 'number' ? error.code : null;
}

async function runGit(repositoryRoot, args, { allowExitCodes = [0], encoding = 'utf8' } = {}) {
  try {
    const result = await execFile('git', args, {
      cwd: repositoryRoot,
      encoding,
      maxBuffer: 2 * 1024 * 1024,
      windowsHide: true
    });
    return result;
  } catch (error) {
    if (allowExitCodes.includes(gitFailureCode(error))) {
      return {
        stdout: error.stdout ?? (encoding === 'buffer' ? Buffer.alloc(0) : ''),
        stderr: error.stderr ?? (encoding === 'buffer' ? Buffer.alloc(0) : ''),
        exitCode: gitFailureCode(error)
      };
    }
    fail('GIT_OBSERVATION_FAILED', { args });
  }
}

export async function assertCandidateReviewPathsIgnored({
  repositoryRoot,
  relativePaths = ALLOWED_RELATIVE_FILES
}) {
  const canonicalRoot = await resolveRepositoryRoot(repositoryRoot);
  if (!Array.isArray(relativePaths) || relativePaths.length === 0) {
    fail('IGNORE_PATH_SET_REQUIRED');
  }
  const paths = [...new Set(relativePaths.map((entry) => normalizeRelativePath(entry)))]
    .sort(asciiCompare);
  if (paths.length !== relativePaths.length) fail('DUPLICATE_IGNORE_PATH_REFUSED');

  const topLevel = (await runGit(canonicalRoot, ['rev-parse', '--show-toplevel'])).stdout.trim();
  let canonicalGitRoot;
  try {
    canonicalGitRoot = await realpath(topLevel);
  } catch {
    fail('GIT_ROOT_NOT_FOUND');
  }
  if (canonicalGitRoot !== canonicalRoot) fail('GIT_ROOT_MISMATCH');

  const evidence = [];
  for (const relativePath of paths) {
    const ignored = await runGit(
      canonicalRoot,
      ['check-ignore', '-v', '--no-index', '--', relativePath],
      { allowExitCodes: [0, 1] }
    );
    if (ignored.exitCode === 1 || !ignored.stdout) {
      fail('CANDIDATE_REVIEW_PATH_NOT_IGNORED', { relativePath });
    }
    const tabIndex = ignored.stdout.indexOf('\t');
    const rule = tabIndex === -1 ? '' : ignored.stdout.slice(0, tabIndex);
    const source = rule.split(':')[0];
    const sourcePath = path.isAbsolute(source)
      ? path.resolve(source)
      : path.resolve(canonicalRoot, source);
    if (sourcePath !== path.join(canonicalRoot, '.gitignore')) {
      fail('REPOSITORY_GITIGNORE_RULE_REQUIRED', { relativePath });
    }
    const tracked = await runGit(canonicalRoot, ['ls-files', '--stage', '--', relativePath]);
    if (tracked.stdout !== '') fail('TRACKED_CANDIDATE_REVIEW_PATH_REFUSED', { relativePath });
    const untracked = await runGit(
      canonicalRoot,
      ['ls-files', '--others', '--exclude-standard', '--', relativePath]
    );
    if (untracked.stdout !== '') {
      fail('UNIGNORED_UNTRACKED_CANDIDATE_REVIEW_PATH', { relativePath });
    }
    evidence.push({
      relativePath,
      ignoreSource: '.gitignore',
      tracked: false,
      visibleAsUntracked: false
    });
  }
  return deepFreeze({
    schemaVersion: FILE_SCHEMA_VERSION,
    boundary: NOT_PRODUCTION_EVIDENCE,
    gate: 'PASS',
    productionReady: false,
    repositoryRoot: canonicalRoot,
    paths: evidence
  });
}

function assertAccessResult(result) {
  assertExactKeys(
    result,
    ['available', 'samePrincipal', 'primary', 'secondary'],
    'ACCESS_PROBE_RESULT_INVALID'
  );
  if (result.available !== true || result.samePrincipal !== false) {
    fail('ACCESS_ISOLATION_HOLD');
  }
  for (const role of ['primary', 'secondary']) {
    assertExactKeys(
      result[role],
      ['ownRoot', 'otherRoleRoot', 'custodianRoot'],
      'ACCESS_PROBE_RESULT_INVALID'
    );
    for (const rootLabel of ['ownRoot', 'otherRoleRoot', 'custodianRoot']) {
      assertExactKeys(
        result[role][rootLabel],
        ['list', 'read', 'write'],
        'ACCESS_PROBE_RESULT_INVALID'
      );
    }
    if (Object.values(result[role].ownRoot).some((value) => value !== true)
      || Object.values(result[role].otherRoleRoot).some((value) => value !== false)
      || Object.values(result[role].custodianRoot).some((value) => value !== false)) {
      fail('ACCESS_ISOLATION_HOLD');
    }
  }
}

async function requireAccessProbe(accessProbe, canonicalRoot) {
  if (typeof accessProbe !== 'function') fail('ACCESS_PROBE_REQUIRED');
  let result;
  try {
    result = await accessProbe(deepFreeze({
      boundary: NOT_PRODUCTION_EVIDENCE,
      repositoryRoot: canonicalRoot,
      roots: {
        custodian: path.join(canonicalRoot, CUSTODIAN_ROOT),
        primary: path.join(canonicalRoot, PRIMARY_ROOT),
        secondary: path.join(canonicalRoot, SECONDARY_ROOT)
      },
      requiredEvidence:
        'DISTINCT_PRINCIPALS_AND_CROSS_ROOT_LIST_READ_WRITE_DENIALS'
    }));
  } catch (error) {
    if (error instanceof CandidateReviewV2FilesError) throw error;
    fail('ACCESS_PROBE_FAILED');
  }
  assertAccessResult(result);
  return 'PASS';
}

async function writeExclusivePrivateJson({
  canonicalRoot,
  relativePath,
  value,
  inject = {}
}) {
  const normalized = normalizeRelativePath(relativePath);
  const absolutePath = path.join(canonicalRoot, ...normalized.split('/'));
  const directoryGuard = await captureSafeDirectoryChain(canonicalRoot, normalized);
  const serialized = `${canonicalStringify(value)}\n`;
  const bytes = Buffer.from(serialized, 'utf8');
  if (bytes.byteLength === 0
    || bytes.byteLength > CANDIDATE_REVIEW_V2_LIMITS.maximumFileBytes) {
    fail('CANDIDATE_REVIEW_FILE_SIZE_OUT_OF_BOUNDS');
  }
  if (!Number.isInteger(fsConstants.O_NOFOLLOW)) fail('O_NOFOLLOW_UNAVAILABLE');
  let handle;
  let afterWrite;
  try {
    await inject.beforePrivateCreate?.({
      relativePath: normalized,
      absolutePath
    });
    await assertDirectoryChainUnchanged(directoryGuard);
    handle = await open(
      absolutePath,
      fsConstants.O_WRONLY
        | fsConstants.O_CREAT
        | fsConstants.O_EXCL
        | fsConstants.O_NOFOLLOW,
      CANDIDATE_REVIEW_V2_LIMITS.draftFileMode
    );
    const opened = await handle.stat({ bigint: true });
    let pathAfterOpen;
    try {
      pathAfterOpen = await lstat(absolutePath, { bigint: true });
    } catch {
      fail('CANDIDATE_REVIEW_DIRECTORY_RACE_REFUSED');
    }
    await assertDirectoryChainUnchanged(directoryGuard);
    if (!sameFileState(opened, pathAfterOpen)) {
      fail('CANDIDATE_REVIEW_DIRECTORY_RACE_REFUSED');
    }
    await handle.writeFile(bytes);
    await handle.chmod(CANDIDATE_REVIEW_V2_LIMITS.draftFileMode);
    await handle.sync();
    afterWrite = await handle.stat({ bigint: true });
    let pathAfterWrite;
    try {
      pathAfterWrite = await lstat(absolutePath, { bigint: true });
    } catch {
      fail('CANDIDATE_REVIEW_DIRECTORY_RACE_REFUSED');
    }
    await assertDirectoryChainUnchanged(directoryGuard);
    if (!sameFileState(afterWrite, pathAfterWrite)) {
      fail('CANDIDATE_REVIEW_DIRECTORY_RACE_REFUSED');
    }
  } catch (error) {
    if (error?.code === 'EEXIST') fail('CANDIDATE_REVIEW_PREPARE_REFUSES_OVERWRITE');
    if (error instanceof CandidateReviewV2FilesError) throw error;
    fail('CANDIDATE_REVIEW_FILE_CREATE_FAILED');
  } finally {
    await handle?.close().catch(() => {});
  }
  let metadata;
  try {
    await inject.afterPrivateCreate?.({
      relativePath: normalized,
      absolutePath
    });
    await assertDirectoryChainUnchanged(directoryGuard);
    metadata = await lstat(absolutePath, { bigint: true });
  } catch (error) {
    if (error instanceof CandidateReviewV2FilesError) throw error;
    fail('CANDIDATE_REVIEW_FILE_CREATE_FAILED');
  }
  if (metadata.isSymbolicLink()
    || !metadata.isFile()
    || metadata.nlink !== 1n
    || modeOf(metadata) !== CANDIDATE_REVIEW_V2_LIMITS.draftFileMode
    || metadata.size !== BigInt(bytes.byteLength)) {
    fail('CANDIDATE_REVIEW_CREATED_FILE_UNSAFE');
  }
  if (!afterWrite || !sameFileState(afterWrite, metadata)) {
    fail('CANDIDATE_REVIEW_DIRECTORY_RACE_REFUSED');
  }
  assertOwned(metadata, 'CANDIDATE_REVIEW_FILE_OWNER_UNSAFE');
  return {
    byteLength: bytes.byteLength,
    sha256: sha256(bytes),
    serialized
  };
}

function assertBlankRound(round) {
  assertPlainObject(round, 'ROUND_OBJECT_REQUIRED');
  if (round.boundary !== NOT_PRODUCTION_EVIDENCE || round.productionReady !== false) {
    fail('ROUND_NON_PRODUCTION_BOUNDARY_REQUIRED');
  }
  for (const key of [
    'primaryDecisions',
    'secondaryDecisions',
    'finalDecisions',
    'patchAssessments',
    'reviewRows'
  ]) {
    if (Array.isArray(round[key]) && round[key].length !== 0) {
      fail('PREPARE_BLANK_SKELETON_ONLY', { key });
    }
  }
  for (const key of ['roundId', 'populationHash', 'assignmentHash']) {
    if (typeof round[key] !== 'string' || round[key].length === 0) {
      fail('ROUND_BINDING_REQUIRED', { key });
    }
  }
  if (!ROUND_ID_PATTERN.test(round.roundId)
    || !SHA256_PATTERN.test(round.populationHash)
    || !SHA256_PATTERN.test(round.assignmentHash)) {
    fail('ROUND_HASH_BINDING_INVALID');
  }
}

async function loadCoreBlankSubmissionFactory() {
  try {
    const module = await import('../../evidence-claim-workbench/domain/candidate-review-v2.mjs');
    if (typeof module.createBlankCandidateReviewRoleSubmission !== 'function') {
      fail('CORE_BLANK_SUBMISSION_FACTORY_REQUIRED');
    }
    return module.createBlankCandidateReviewRoleSubmission;
  } catch (error) {
    if (error instanceof CandidateReviewV2FilesError) throw error;
    fail('CORE_BLANK_SUBMISSION_FACTORY_REQUIRED');
  }
}

export async function prepareBlankCandidateReviewRoots({
  repositoryRoot,
  round,
  accessProbe,
  inject = {}
}) {
  assertBlankRound(round);
  const canonicalRoot = await resolveRepositoryRoot(repositoryRoot);
  await assertCandidateReviewPathsIgnored({ repositoryRoot: canonicalRoot });

  await ensurePrivateDirectoryChain(canonicalRoot, BASE_DIRECTORY);
  for (const root of ROOT_ENTRIES) {
    const absoluteRoot = path.join(canonicalRoot, root.relativePath);
    try {
      await mkdir(absoluteRoot, { mode: CANDIDATE_REVIEW_V2_LIMITS.rootMode });
      await chmod(absoluteRoot, CANDIDATE_REVIEW_V2_LIMITS.rootMode);
    } catch (error) {
      if (error?.code !== 'EEXIST') fail('CANDIDATE_REVIEW_ROOT_CREATE_FAILED');
    }
    await inspectDirectory(
      absoluteRoot,
      CANDIDATE_REVIEW_V2_LIMITS.rootMode,
      'CANDIDATE_REVIEW_ROOT'
    );
    const entries = await readdir(absoluteRoot);
    if (entries.length !== 0) fail('CANDIDATE_REVIEW_PREPARE_REFUSES_OVERWRITE');
  }

  const createBlankSubmission = await loadCoreBlankSubmissionFactory();
  const submissions = [
    {
      role: 'PRIMARY_TECHNICAL_REVIEWER',
      relativePath: CANDIDATE_REVIEW_V2_PATHS.primarySubmission
    },
    {
      role: 'SECONDARY_EVIDENCE_REVIEWER',
      relativePath: CANDIDATE_REVIEW_V2_PATHS.secondarySubmission
    }
  ].map(({ role, relativePath }) => ({
    role,
    relativePath,
    value: createBlankSubmission({
      roundId: round.roundId,
      populationHash: round.populationHash,
      assignmentHash: round.assignmentHash,
      role
    })
  }));

  const preparedFiles = [];
  inspectBoundedContent(round, CANDIDATE_REVIEW_V2_PATHS.round);
  const roundWrite = await writeExclusivePrivateJson({
    canonicalRoot,
    relativePath: CANDIDATE_REVIEW_V2_PATHS.round,
    value: round,
    inject
  });
  preparedFiles.push({
    role: 'CUSTODIAN',
    relativePath: CANDIDATE_REVIEW_V2_PATHS.round,
    mode: '0600',
    byteLength: roundWrite.byteLength,
    sha256: roundWrite.sha256
  });
  for (const submission of submissions) {
    inspectBoundedContent(submission.value, submission.relativePath);
    const written = await writeExclusivePrivateJson({
      canonicalRoot,
      relativePath: submission.relativePath,
      value: submission.value,
      inject
    });
    preparedFiles.push({
      role: submission.role,
      relativePath: submission.relativePath,
      mode: '0600',
      byteLength: written.byteLength,
      sha256: written.sha256
    });
  }

  const isolation = accessProbe
    ? await requireAccessProbe(accessProbe, canonicalRoot)
    : 'UNVERIFIED';
  return deepFreeze({
    schemaVersion: FILE_SCHEMA_VERSION,
    boundary: NOT_PRODUCTION_EVIDENCE,
    status: 'HOLD',
    reason: 'BLANK_SKELETON_ONLY',
    productionReady: false,
    productionReviewerWorkflowReady: false,
    humanReviewEvidenceCreated: false,
    accessIsolation: isolation,
    roots: ROOT_ENTRIES.map((entry) => ({
      ...entry,
      mode: '0700'
    })),
    files: preparedFiles.sort((left, right) =>
      asciiCompare(left.relativePath, right.relativePath))
  });
}

function directoryIdentity(metadata) {
  return {
    dev: metadata.dev.toString(),
    ino: metadata.ino.toString(),
    uid: metadata.uid.toString(),
    mode: metadata.mode.toString()
  };
}

function sameDirectoryIdentity(left, right) {
  return canonicalStringify(left) === canonicalStringify(right);
}

async function captureSafeDirectoryChain(canonicalRoot, relativePath) {
  const segments = relativePath.split('/');
  let current = canonicalRoot;
  const directories = [];
  for (let index = -1; index < segments.length - 1; index += 1) {
    if (index >= 0) current = path.join(current, segments[index]);
    let metadata;
    try {
      metadata = await lstat(current, { bigint: true });
    } catch {
      fail('CANDIDATE_REVIEW_PATH_COMPONENT_MISSING', { relativePath });
    }
    if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
      fail('CANDIDATE_REVIEW_PATH_COMPONENT_UNSAFE', { relativePath });
    }
    assertOwned(metadata, 'CANDIDATE_REVIEW_DIRECTORY_OWNER_UNSAFE');
    directories.push({
      absolutePath: current,
      identity: directoryIdentity(metadata)
    });
  }
  return directories;
}

async function assertDirectoryChainUnchanged(directories) {
  for (const directory of directories) {
    let metadata;
    try {
      metadata = await lstat(directory.absolutePath, { bigint: true });
    } catch {
      fail('CANDIDATE_REVIEW_DIRECTORY_RACE_REFUSED');
    }
    if (metadata.isSymbolicLink()
      || !metadata.isDirectory()
      || !sameDirectoryIdentity(directory.identity, directoryIdentity(metadata))) {
      fail('CANDIDATE_REVIEW_DIRECTORY_RACE_REFUSED');
    }
    assertOwned(metadata, 'CANDIDATE_REVIEW_DIRECTORY_OWNER_UNSAFE');
  }
}

function sameFileState(left, right) {
  return left.isFile()
    && right.isFile()
    && left.nlink === 1n
    && right.nlink === 1n
    && left.dev === right.dev
    && left.ino === right.ino
    && left.size === right.size
    && left.mode === right.mode
    && left.uid === right.uid
    && left.mtimeNs === right.mtimeNs
    && left.ctimeNs === right.ctimeNs;
}

function fileIdentity(metadata) {
  return {
    dev: metadata.dev.toString(),
    ino: metadata.ino.toString(),
    nlink: metadata.nlink.toString(),
    mode: metadata.mode.toString(),
    uid: metadata.uid.toString(),
    size: metadata.size.toString(),
    mtimeNs: metadata.mtimeNs.toString(),
    ctimeNs: metadata.ctimeNs.toString()
  };
}

function sameFileIdentity(left, right) {
  return canonicalStringify(left) === canonicalStringify(right);
}

function expectedModesForPath(relativePath, expectedMode) {
  if (expectedMode !== undefined) {
    if (![0o600, 0o400].includes(expectedMode)) fail('EXPECTED_MODE_INVALID');
    return [expectedMode];
  }
  if (relativePath.startsWith(`${CUSTODIAN_ROOT}/`)) return [0o600];
  return [0o600, 0o400];
}

function safetyRepresentations(value, pathLabel) {
  const representations = [];
  let representation = value;
  for (let depth = 0; ; depth += 1) {
    for (const form of [representation, representation.normalize('NFKC')]) {
      if (!representations.includes(form)) representations.push(form);
    }
    if (!/%[a-f0-9]{2}/iu.test(representation)) break;
    if (depth === 4) fail('PERCENT_ENCODING_DEPTH_REFUSED', { path: pathLabel });
    try {
      const decoded = decodeURIComponent(representation);
      if (decoded === representation) break;
      representation = decoded;
    } catch {
      fail('MALFORMED_PERCENT_ENCODING_REFUSED', { path: pathLabel });
    }
  }
  return representations;
}

function containsPrivateUrl(value) {
  const candidates = value.match(/\bhttps?:\/\/[^\s"'<>]+/giu) || [];
  return candidates.some((candidate) => {
    try {
      const parsed = new URL(candidate);
      const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/gu, '');
      const privateIpv4 = /^(?:10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2[0-9]|3[01])\.)/u;
      const privateIpv6 = /^(?:::1|fc|fd|fe80:)/u;
      const sensitiveQuery = [...parsed.searchParams.keys()].some((key) =>
        /^(?:token|key|secret|password|auth|cookie|signature)$/iu.test(key));
      return Boolean(
        parsed.username
        || parsed.password
        || hostname === 'localhost'
        || hostname.endsWith('.localhost')
        || hostname.endsWith('.local')
        || hostname.endsWith('.internal')
        || hostname.endsWith('.private')
        || privateIpv4.test(hostname)
        || privateIpv6.test(hostname)
        || sensitiveQuery
      );
    } catch {
      return true;
    }
  });
}

export function assertCandidateReviewLeakageSafe(value, pathLabel = '$') {
  if (typeof value === 'string') {
    const representations = safetyRepresentations(value, pathLabel);
    if (representations.some((entry) => UNSAFE_CONTROL.test(entry))) {
      fail('UNSAFE_CONTROL_CHARACTER_REFUSED', { path: pathLabel });
    }
    if (representations.some((entry) => SECRET_SHAPED_VALUE.test(entry))) {
      fail('SECRET_SHAPED_VALUE_REFUSED', { path: pathLabel });
    }
    if (representations.some((entry) => PRIVATE_DATA_SHAPED_VALUE.test(entry))) {
      fail('IDENTITY_OR_PRIVATE_DATA_REFUSED', { path: pathLabel });
    }
    if (representations.some((entry) => ABSOLUTE_LOCAL_PATH.test(entry))) {
      fail('LOCAL_ABSOLUTE_PATH_REFUSED', { path: pathLabel });
    }
    if (representations.some(containsPrivateUrl)) {
      fail('PRIVATE_URL_REFUSED', { path: pathLabel });
    }
    if (representations.some((entry) => FORBIDDEN_AUTHORITY_VALUE.test(entry))) {
      fail('AUTOMATIC_AUTHORITY_VALUE_REFUSED', { path: pathLabel });
    }
    return true;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      assertCandidateReviewLeakageSafe(entry, `${pathLabel}[${index}]`));
    return true;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      const childPath = `${pathLabel}.${key}`;
      if (key === 'reviewerIdentity') {
        if (child !== 'NOT_COLLECTED') {
          fail('REVIEWER_IDENTITY_REFUSED', { path: childPath });
        }
      } else if (key === 'reviewerLabel') {
        if (child !== 'repository_reviewer_pending') {
          fail('REVIEWER_LABEL_REFUSED', { path: childPath });
        }
      } else if (FORBIDDEN_LEDGER_KEY.test(key)) {
        fail('PROTECTED_LEDGER_FIELD_REFUSED', { path: childPath });
      }
      assertCandidateReviewLeakageSafe(child, childPath);
    }
  }
  return true;
}

function inspectBoundedContent(value, relativePath) {
  assertCandidateReviewLeakageSafe(value);
  let excerptCodePoints = 0;
  let candidateRows = 0;
  let roleRows = 0;
  const excerptCandidateCounts = new Map();
  const visit = (entry, key = '', depth = 0, candidateId = '') => {
    if (depth > CANDIDATE_REVIEW_V2_LIMITS.maximumJsonDepth) {
      fail('JSON_DEPTH_LIMIT_EXCEEDED', { relativePath });
    }
    if (typeof entry === 'string') {
      if (/(?:directQuote|excerpt)$/u.test(key)) {
        const points = [...entry].length;
        if (points > CANDIDATE_REVIEW_V2_LIMITS.maximumDirectQuoteCodePoints) {
          fail('DIRECT_QUOTE_CODE_POINT_LIMIT_EXCEEDED', { relativePath });
        }
        excerptCodePoints += points;
        const binding = candidateId || 'UNBOUND';
        excerptCandidateCounts.set(
          binding,
          (excerptCandidateCounts.get(binding) || 0) + 1
        );
      }
      return;
    }
    if (Array.isArray(entry)) {
      if (key === 'candidates') {
        candidateRows += entry.length;
        const shardMatch = relativePath.match(/candidates-[0-9]{2}\.json$/u);
        const maximum = shardMatch
          ? CANDIDATE_REVIEW_V2_LIMITS.maximumCandidateRowsPerShard
          : CANDIDATE_REVIEW_V2_LIMITS.maximumCandidates;
        if (entry.length > maximum) fail('CANDIDATE_ROW_LIMIT_EXCEEDED', { relativePath });
      }
      if (key === 'rows' || /decisions$/u.test(key)) {
        roleRows += entry.length;
        const maximum = relativePath.includes('-submission/')
          ? CANDIDATE_REVIEW_V2_LIMITS.maximumRowsPerRole
          : CANDIDATE_REVIEW_V2_LIMITS.maximumRoleDecisionRows;
        if (entry.length > maximum) fail('ROLE_DECISION_ROW_LIMIT_EXCEEDED', { relativePath });
      }
      for (const child of entry) visit(child, key, depth + 1, candidateId);
      return;
    }
    if (entry && typeof entry === 'object') {
      const nestedCandidateId = typeof entry.candidateId === 'string'
        ? entry.candidateId
        : candidateId;
      for (const [childKey, child] of Object.entries(entry)) {
        visit(child, childKey, depth + 1, nestedCandidateId);
      }
    }
  };
  visit(value);
  for (const [candidateId, count] of excerptCandidateCounts) {
    if (count > 1) {
      fail('MULTIPLE_DIRECT_EXCERPTS_PER_CANDIDATE_REFUSED', {
        relativePath,
        candidateId
      });
    }
  }
  return {
    excerptCodePoints,
    candidateRows,
    roleRows,
    excerptCandidateCounts: Object.fromEntries(excerptCandidateCounts)
  };
}

export async function readBoundedCandidateReviewJson({
  repositoryRoot,
  relativePath,
  expectedMode,
  expectedSha256,
  inject = {}
}) {
  const normalized = normalizeRelativePath(relativePath);
  if (expectedSha256 !== undefined && !SHA256_PATTERN.test(expectedSha256)) {
    fail('EXPECTED_SHA256_INVALID');
  }
  const canonicalRoot = await resolveRepositoryRoot(repositoryRoot);
  const directoryGuard = await captureSafeDirectoryChain(canonicalRoot, normalized);
  const absolutePath = path.join(canonicalRoot, ...normalized.split('/'));
  let before;
  try {
    before = await lstat(absolutePath, { bigint: true });
  } catch {
    fail('CANDIDATE_REVIEW_FILE_MISSING', { relativePath: normalized });
  }
  if (before.isSymbolicLink() || !before.isFile() || before.nlink !== 1n) {
    fail('CANDIDATE_REVIEW_FILE_UNSAFE', { relativePath: normalized });
  }
  assertOwned(before, 'CANDIDATE_REVIEW_FILE_OWNER_UNSAFE');
  const allowedModes = expectedModesForPath(normalized, expectedMode);
  if (!allowedModes.includes(modeOf(before))) {
    fail('CANDIDATE_REVIEW_FILE_MODE_UNSAFE', { relativePath: normalized });
  }
  if (before.size < 1n
    || before.size > BigInt(CANDIDATE_REVIEW_V2_LIMITS.maximumFileBytes)) {
    fail('CANDIDATE_REVIEW_FILE_SIZE_OUT_OF_BOUNDS', { relativePath: normalized });
  }
  if (!Number.isInteger(fsConstants.O_NOFOLLOW)) fail('O_NOFOLLOW_UNAVAILABLE');

  let handle;
  try {
    await inject.afterPathInspection?.({ relativePath: normalized, absolutePath });
    await assertDirectoryChainUnchanged(directoryGuard);
    handle = await open(absolutePath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
    const opened = await handle.stat({ bigint: true });
    if (!sameFileState(before, opened)) {
      fail('CANDIDATE_REVIEW_FILE_RACE_REFUSED', { relativePath: normalized });
    }
    await inject.beforeRead?.({ relativePath: normalized, absolutePath });
    const chunks = [];
    let total = 0;
    while (total <= CANDIDATE_REVIEW_V2_LIMITS.maximumFileBytes) {
      const remaining = CANDIDATE_REVIEW_V2_LIMITS.maximumFileBytes + 1 - total;
      const buffer = Buffer.allocUnsafe(Math.min(64 * 1024, remaining));
      const { bytesRead } = await handle.read(buffer, 0, buffer.byteLength, null);
      if (bytesRead === 0) break;
      chunks.push(buffer.subarray(0, bytesRead));
      total += bytesRead;
    }
    if (total > CANDIDATE_REVIEW_V2_LIMITS.maximumFileBytes) {
      fail('CANDIDATE_REVIEW_FILE_SIZE_OUT_OF_BOUNDS', { relativePath: normalized });
    }
    const bytes = Buffer.concat(chunks, total);
    await inject.afterRead?.({ relativePath: normalized, absolutePath });
    const after = await handle.stat({ bigint: true });
    await assertDirectoryChainUnchanged(directoryGuard);
    let pathAfter;
    try {
      pathAfter = await lstat(absolutePath, { bigint: true });
    } catch {
      fail('CANDIDATE_REVIEW_FILE_RACE_REFUSED', { relativePath: normalized });
    }
    await assertDirectoryChainUnchanged(directoryGuard);
    if (!sameFileState(opened, after)
      || !sameFileState(opened, pathAfter)
      || BigInt(bytes.byteLength) !== opened.size) {
      fail('CANDIDATE_REVIEW_FILE_RACE_REFUSED', { relativePath: normalized });
    }
    let text;
    try {
      text = UTF8_DECODER.decode(bytes);
    } catch {
      fail('CANDIDATE_REVIEW_FILE_UTF8_INVALID', { relativePath: normalized });
    }
    const value = parseStrictCandidateReviewJson(text);
    const digest = sha256(bytes);
    if (expectedSha256 !== undefined && digest !== expectedSha256) {
      fail('CANDIDATE_REVIEW_FILE_SHA256_MISMATCH', { relativePath: normalized });
    }
    const counts = inspectBoundedContent(value, normalized);
    return deepFreeze({
      schemaVersion: FILE_SCHEMA_VERSION,
      boundary: NOT_PRODUCTION_EVIDENCE,
      relativePath: normalized,
      mode: modeOf(opened),
      byteLength: bytes.byteLength,
      sha256: digest,
      fileIdentity: fileIdentity(opened),
      value,
      ...counts
    });
  } catch (error) {
    if (error instanceof CandidateReviewV2FilesError) throw error;
    fail('CANDIDATE_REVIEW_FILE_READ_REFUSED', { relativePath: normalized });
  } finally {
    await handle?.close().catch(() => {});
  }
}

function normalizeRole(role) {
  if (role === 'primary' || role === 'PRIMARY_TECHNICAL_REVIEWER') {
    return {
      label: 'PRIMARY_TECHNICAL_REVIEWER',
      relativePath: CANDIDATE_REVIEW_V2_PATHS.primarySubmission
    };
  }
  if (role === 'secondary' || role === 'SECONDARY_EVIDENCE_REVIEWER') {
    return {
      label: 'SECONDARY_EVIDENCE_REVIEWER',
      relativePath: CANDIDATE_REVIEW_V2_PATHS.secondarySubmission
    };
  }
  fail('CANDIDATE_REVIEW_ROLE_INVALID');
}

function validateDraftSubmissionEnvelope(value, role) {
  assertPlainObject(value, 'ROLE_SUBMISSION_OBJECT_REQUIRED');
  const requiredKeys = [
    'schemaVersion',
    'boundary',
    'productionReady',
    'productionReviewerWorkflowReady',
    'repositoryReviewRequired',
    'automaticVerification',
    'customerUseAllowed',
    'proofExecutionApproved',
    'roundId',
    'populationHash',
    'assignmentHash',
    'role',
    'submissionAuthorityStatus',
    'externalHumanProvenanceVerified',
    'externalCustodyVerified',
    'roleQualificationAttested',
    'sealed',
    'rows',
    'submissionHash'
  ];
  assertExactKeys(value, requiredKeys, 'ROLE_SUBMISSION_KEYS_INVALID');
  if (value.boundary !== NOT_PRODUCTION_EVIDENCE
    || value.productionReady !== false
    || value.productionReviewerWorkflowReady !== false
    || value.repositoryReviewRequired !== true
    || value.automaticVerification !== false
    || value.customerUseAllowed !== false
    || value.proofExecutionApproved !== false
    || value.role !== role
    || typeof value.submissionAuthorityStatus !== 'string'
    || value.externalHumanProvenanceVerified !== false
    || value.externalCustodyVerified !== false
    || value.roleQualificationAttested !== true
    || value.sealed !== false
    || value.submissionHash !== null
    || !SHA256_PATTERN.test(value.populationHash)
    || !SHA256_PATTERN.test(value.assignmentHash)
    || !Array.isArray(value.rows)
    || value.rows.length < CANDIDATE_REVIEW_V2_LIMITS.minimumCandidates
    || value.rows.length > CANDIDATE_REVIEW_V2_LIMITS.maximumRowsPerRole) {
    fail('ROLE_SUBMISSION_INCOMPLETE_OR_INVALID');
  }
}

export async function validateAndSealRoleSubmission({
  repositoryRoot,
  role,
  population,
  sourcePath,
  accessProbe,
  inject = {}
}) {
  const normalizedRole = normalizeRole(role);
  if (sourcePath !== undefined
    && normalizeRelativePath(sourcePath) !== normalizedRole.relativePath) {
    fail('ALTERNATE_ROLE_SUBMISSION_PATH_REFUSED');
  }
  const canonicalRoot = await resolveRepositoryRoot(repositoryRoot);
  await requireAccessProbe(accessProbe, canonicalRoot);
  const directoryGuard = await captureSafeDirectoryChain(
    canonicalRoot,
    normalizedRole.relativePath
  );
  const read = await readBoundedCandidateReviewJson({
    repositoryRoot: canonicalRoot,
    relativePath: normalizedRole.relativePath,
    expectedMode: CANDIDATE_REVIEW_V2_LIMITS.draftFileMode,
    inject
  });
  validateDraftSubmissionEnvelope(read.value, normalizedRole.label);
  let sealedValue;
  try {
    const { validateCandidateReviewRoleSubmission } =
      await import('../../evidence-claim-workbench/domain/candidate-review-v2.mjs');
    sealedValue = validateCandidateReviewRoleSubmission({
      ...read.value,
      sealed: true,
      submissionHash: null
    }, {
      population,
      allowBlank: false
    });
  } catch (error) {
    fail('CORE_ROLE_SUBMISSION_INVALID', {
      causeCode: typeof error?.code === 'string' ? error.code : 'UNKNOWN'
    });
  }
  inspectBoundedContent(sealedValue, normalizedRole.relativePath);
  const sealedBytes = Buffer.from(`${canonicalStringify(sealedValue)}\n`, 'utf8');
  if (sealedBytes.byteLength > CANDIDATE_REVIEW_V2_LIMITS.maximumFileBytes) {
    fail('CANDIDATE_REVIEW_FILE_SIZE_OUT_OF_BOUNDS');
  }
  const absolutePath = path.join(canonicalRoot, normalizedRole.relativePath);
  const temporaryPath = `${absolutePath}.seal-${randomBytes(12).toString('hex')}`;
  let temporaryHandle;
  let renamed = false;
  try {
    temporaryHandle = await open(
      temporaryPath,
      fsConstants.O_WRONLY
        | fsConstants.O_CREAT
        | fsConstants.O_EXCL
        | fsConstants.O_NOFOLLOW,
      CANDIDATE_REVIEW_V2_LIMITS.sealedFileMode
    );
    await temporaryHandle.writeFile(sealedBytes);
    await temporaryHandle.chmod(CANDIDATE_REVIEW_V2_LIMITS.sealedFileMode);
    await temporaryHandle.sync();
    const temporaryStat = await temporaryHandle.stat({ bigint: true });
    if (!temporaryStat.isFile()
      || temporaryStat.nlink !== 1n
      || modeOf(temporaryStat) !== CANDIDATE_REVIEW_V2_LIMITS.sealedFileMode) {
      fail('SEALED_TEMPORARY_FILE_UNSAFE');
    }
    await temporaryHandle.close();
    temporaryHandle = null;
    await inject.beforeAtomicSeal?.({
      role: normalizedRole.label,
      sourcePath: absolutePath,
      temporaryPath
    });
    const current = await lstat(absolutePath, { bigint: true });
    if (!sameFileIdentity(fileIdentity(current), read.fileIdentity)) {
      fail('CANDIDATE_REVIEW_FILE_RACE_REFUSED');
    }
    const currentRead = await readBoundedCandidateReviewJson({
      repositoryRoot: canonicalRoot,
      relativePath: normalizedRole.relativePath,
      expectedMode: CANDIDATE_REVIEW_V2_LIMITS.draftFileMode,
      expectedSha256: read.sha256
    });
    if (currentRead.sha256 !== read.sha256
      || !sameFileIdentity(currentRead.fileIdentity, read.fileIdentity)) {
      fail('CANDIDATE_REVIEW_FILE_RACE_REFUSED');
    }
    await inject.beforeSealRename?.({
      role: normalizedRole.label,
      sourcePath: absolutePath,
      temporaryPath
    });
    await assertDirectoryChainUnchanged(directoryGuard);
    const immediatelyBeforeRename = await lstat(absolutePath, { bigint: true });
    if (!sameFileIdentity(
      fileIdentity(immediatelyBeforeRename),
      read.fileIdentity
    )) {
      fail('CANDIDATE_REVIEW_FILE_RACE_REFUSED');
    }
    await rename(temporaryPath, absolutePath);
    renamed = true;
    await assertDirectoryChainUnchanged(directoryGuard);
    const sealed = await readBoundedCandidateReviewJson({
      repositoryRoot: canonicalRoot,
      relativePath: normalizedRole.relativePath,
      expectedMode: CANDIDATE_REVIEW_V2_LIMITS.sealedFileMode,
      expectedSha256: sha256(sealedBytes)
    });
    return deepFreeze({
      schemaVersion: FILE_SCHEMA_VERSION,
      boundary: NOT_PRODUCTION_EVIDENCE,
      gate: 'PASS',
      productionReady: false,
      productionReviewerWorkflowReady: false,
      role: normalizedRole.label,
      relativePath: normalizedRole.relativePath,
      mode: '0400',
      byteLength: sealed.byteLength,
      sha256: sealed.sha256,
      submissionHash: sealedValue.submissionHash,
      accessIsolation: 'PASS',
      humanReviewAuthenticityInferred: false
    });
  } catch (error) {
    if (error instanceof CandidateReviewV2FilesError) throw error;
    fail('ROLE_SUBMISSION_SEAL_FAILED');
  } finally {
    await temporaryHandle?.close().catch(() => {});
    if (!renamed) await unlink(temporaryPath).catch(() => {});
  }
}

function allowedNamesForRoot(label) {
  if (label === 'CUSTODIAN') return CANDIDATE_REVIEW_V2_ALLOWLISTS.custodian;
  if (label === 'PRIMARY_TECHNICAL_REVIEWER') return CANDIDATE_REVIEW_V2_ALLOWLISTS.primary;
  return CANDIDATE_REVIEW_V2_ALLOWLISTS.secondary;
}

function assertContiguousNumberedFiles(names, prefix, maximum) {
  const matching = names
    .filter((name) => name.startsWith(prefix))
    .sort(asciiCompare);
  for (let index = 0; index < matching.length; index += 1) {
    const expected = `${prefix}${String(index + 1).padStart(2, '0')}.json`;
    if (matching[index] !== expected || index >= maximum) {
      fail('NUMBERED_FILE_PREFIX_NOT_CONTIGUOUS', { prefix });
    }
  }
}

function containsRoundManifestSelfReference(value) {
  if (typeof value === 'string') return value === CANDIDATE_REVIEW_V2_PATHS.round;
  if (Array.isArray(value)) return value.some(containsRoundManifestSelfReference);
  if (!value || typeof value !== 'object') return false;
  if (Object.hasOwn(value, 'roundManifestSha256')
    || Object.hasOwn(value, 'roundManifestHash')
    || Object.hasOwn(value, 'selfHash')) {
    return true;
  }
  return Object.values(value).some(containsRoundManifestSelfReference);
}

export async function loadCandidateReviewPackage({
  repositoryRoot,
  population,
  accessProbe,
  inject = {}
}) {
  const canonicalRoot = await resolveRepositoryRoot(repositoryRoot);
  await requireAccessProbe(accessProbe, canonicalRoot);
  await assertCandidateReviewPathsIgnored({ repositoryRoot: canonicalRoot });

  const baseParent = path.join(canonicalRoot, BASE_DIRECTORY);
  const parentEntries = await readdir(baseParent, { withFileTypes: true }).catch(() => []);
  const exactRoots = new Set(ROOT_ENTRIES.map((entry) => path.basename(entry.relativePath)));
  for (const entry of parentEntries) {
    if (entry.name.startsWith('pr207-candidate-review-v2-')
      && !exactRoots.has(entry.name)) {
      fail('ALTERNATE_CANDIDATE_REVIEW_ROOT_REFUSED', { name: entry.name });
    }
  }

  const loaded = [];
  for (const root of ROOT_ENTRIES) {
    const absoluteRoot = path.join(canonicalRoot, root.relativePath);
    await inspectDirectory(
      absoluteRoot,
      CANDIDATE_REVIEW_V2_LIMITS.rootMode,
      'CANDIDATE_REVIEW_ROOT'
    );
    const allowed = new Set(allowedNamesForRoot(root.label));
    const entries = await readdir(absoluteRoot, { withFileTypes: true });
    const names = entries.map((entry) => entry.name).sort(asciiCompare);
    for (const entry of entries) {
      if (!entry.isFile() || !allowed.has(entry.name)) {
        fail('CANDIDATE_REVIEW_FILE_SET_INVALID', {
          rootLabel: root.label,
          name: entry.name
        });
      }
    }
    if (root.label === 'CUSTODIAN') {
      assertContiguousNumberedFiles(
        names,
        'pr207-candidate-review-v2-candidates-',
        4
      );
      assertContiguousNumberedFiles(
        names,
        'pr207-candidate-review-v2-patch-',
        CANDIDATE_REVIEW_V2_LIMITS.maximumPatchShards
      );
    }
    for (const name of names) {
      const relativePath = `${root.relativePath}/${name}`;
      const read = await readBoundedCandidateReviewJson({
        repositoryRoot: canonicalRoot,
        relativePath,
        inject
      });
      loaded.push({
        rootLabel: root.label,
        relativePath,
        mode: String(read.mode).padStart(4, '0'),
        sealState: read.mode === CANDIDATE_REVIEW_V2_LIMITS.sealedFileMode
          ? 'SEALED'
          : 'DRAFT_OR_CENTRAL',
        byteLength: read.byteLength,
        sha256: read.sha256,
        value: read.value,
        excerptCodePoints: read.excerptCodePoints,
        candidateRows: read.candidateRows,
        roleRows: read.roleRows,
        excerptCandidateCounts: read.excerptCandidateCounts
      });
    }
  }
  const totalBytes = loaded.reduce((sum, entry) => sum + entry.byteLength, 0);
  const totalExcerptCodePoints = loaded.reduce(
    (sum, entry) => sum + entry.excerptCodePoints,
    0
  );
  if (totalBytes > CANDIDATE_REVIEW_V2_LIMITS.maximumPackageBytes) {
    fail('CANDIDATE_REVIEW_PACKAGE_SIZE_OUT_OF_BOUNDS');
  }
  if (totalExcerptCodePoints
    > CANDIDATE_REVIEW_V2_LIMITS.maximumAggregateExcerptCodePoints) {
    fail('CANDIDATE_REVIEW_PACKAGE_EXCERPT_LIMIT_EXCEEDED');
  }
  const packageExcerptCounts = new Map();
  for (const file of loaded) {
    for (const [candidateId, count] of Object.entries(file.excerptCandidateCounts)) {
      packageExcerptCounts.set(
        candidateId,
        (packageExcerptCounts.get(candidateId) || 0) + count
      );
    }
  }
  if ([...packageExcerptCounts.values()].some((count) => count > 1)) {
    fail('MULTIPLE_DIRECT_EXCERPTS_PER_CANDIDATE_REFUSED');
  }
  const roundEntry = loaded.find((entry) =>
    entry.relativePath === CANDIDATE_REVIEW_V2_PATHS.round);
  if (!roundEntry) fail('ROUND_MANIFEST_MISSING');
  if (containsRoundManifestSelfReference(roundEntry.value)) {
    fail('ROUND_MANIFEST_SELF_REFERENCE_REFUSED');
  }

  const primary = loaded.find((entry) =>
    entry.relativePath === CANDIDATE_REVIEW_V2_PATHS.primarySubmission);
  const secondary = loaded.find((entry) =>
    entry.relativePath === CANDIDATE_REVIEW_V2_PATHS.secondarySubmission);
  let complete = false;
  if (primary && secondary) {
    try {
      const { validateCandidateReviewRoleSubmission } =
        await import('../../evidence-claim-workbench/domain/candidate-review-v2.mjs');
      const primaryValidated = validateCandidateReviewRoleSubmission(
        primary.value,
        {
          population,
          allowBlank: primary.value.rows?.length === 0
        }
      );
      const secondaryValidated = validateCandidateReviewRoleSubmission(
        secondary.value,
        {
          population,
          allowBlank: secondary.value.rows?.length === 0
        }
      );
      const modeStateValid = (
        primaryValidated.sealed
          ? primary.sealState === 'SEALED'
          : primary.sealState === 'DRAFT_OR_CENTRAL'
      ) && (
        secondaryValidated.sealed
          ? secondary.sealState === 'SEALED'
          : secondary.sealState === 'DRAFT_OR_CENTRAL'
      );
      if (!modeStateValid) fail('ROLE_SUBMISSION_SEAL_STATE_MISMATCH');
      complete = Boolean(
        primaryValidated.sealed
        && secondaryValidated.sealed
        && primaryValidated.role === 'PRIMARY_TECHNICAL_REVIEWER'
        && secondaryValidated.role === 'SECONDARY_EVIDENCE_REVIEWER'
        && primaryValidated.roundId === secondaryValidated.roundId
        && primaryValidated.populationHash === secondaryValidated.populationHash
        && primaryValidated.assignmentHash === secondaryValidated.assignmentHash
        && primaryValidated.rows.length >= CANDIDATE_REVIEW_V2_LIMITS.minimumCandidates
        && secondaryValidated.rows.length === primaryValidated.rows.length
      );
    } catch (error) {
      if (error instanceof CandidateReviewV2FilesError) throw error;
      fail('CORE_ROLE_SUBMISSION_INVALID', {
        causeCode: typeof error?.code === 'string' ? error.code : 'UNKNOWN'
      });
    }
  }

  return deepFreeze({
    schemaVersion: FILE_SCHEMA_VERSION,
    boundary: NOT_PRODUCTION_EVIDENCE,
    status: complete ? 'COMPLETE' : 'INCOMPLETE',
    productionReady: false,
    productionReviewerWorkflowReady: false,
    repositoryReviewRequired: true,
    automaticVerification: false,
    accessIsolation: 'PASS',
    totalBytes,
    totalExcerptCodePoints,
    files: loaded.sort((left, right) =>
      asciiCompare(left.relativePath, right.relativePath))
  });
}

function manifestEntryFromFile(file) {
  assertPlainObject(file, 'ROUND_MANIFEST_FILE_ENTRY_INVALID');
  const relativePath = normalizeRelativePath(file.relativePath);
  if (relativePath === CANDIDATE_REVIEW_V2_PATHS.round) {
    fail('ROUND_MANIFEST_SELF_REFERENCE_REFUSED');
  }
  if (!ROOT_ENTRIES.some((root) =>
    root.label === file.rootLabel
      && relativePath.startsWith(`${root.relativePath}/`))) {
    fail('ROUND_MANIFEST_ROOT_LABEL_INVALID');
  }
  if (!['SEALED', 'DRAFT_OR_CENTRAL'].includes(file.sealState)
    || !SHA256_PATTERN.test(file.sha256)
    || !Number.isInteger(file.byteLength)
    || file.byteLength < 1
    || file.byteLength > CANDIDATE_REVIEW_V2_LIMITS.maximumFileBytes) {
    fail('ROUND_MANIFEST_FILE_ENTRY_INVALID');
  }
  return {
    rootLabel: file.rootLabel,
    relativePath,
    sealState: file.sealState,
    sha256: file.sha256
  };
}

export function buildCandidateReviewRoundManifest({
  files,
  rootLabels = ROOT_ENTRIES.map((entry) => entry.label)
}) {
  if (!Array.isArray(files)) fail('ROUND_MANIFEST_FILES_REQUIRED');
  const entries = files
    .filter((file) => file.relativePath !== CANDIDATE_REVIEW_V2_PATHS.round)
    .map(manifestEntryFromFile)
    .sort((left, right) => asciiCompare(left.relativePath, right.relativePath));
  if (new Set(entries.map((entry) => entry.relativePath)).size !== entries.length) {
    fail('ROUND_MANIFEST_DUPLICATE_PATH');
  }
  const expectedLabels = ROOT_ENTRIES.map((entry) => entry.label).sort(asciiCompare);
  const actualLabels = [...rootLabels].sort(asciiCompare);
  if (actualLabels.length !== expectedLabels.length
    || actualLabels.some((label, index) => label !== expectedLabels[index])) {
    fail('ROUND_MANIFEST_ROOT_SET_INVALID');
  }
  const manifest = deepFreeze({
    schemaVersion: ROUND_MANIFEST_SCHEMA_VERSION,
    boundary: NOT_PRODUCTION_EVIDENCE,
    productionReady: false,
    rootLabels: expectedLabels,
    files: entries
  });
  const serialized = `${canonicalStringify(manifest)}\n`;
  const digest = sha256(Buffer.from(serialized, 'utf8'));
  return deepFreeze({
    manifest,
    serialized,
    roundManifestSha256: digest,
    fileCount: entries.length
  });
}

const CLOSE_REASONS = deepFreeze({
  ORDINARY: 'ORDINARY_REVIEW_LIFECYCLE_COMPLETE',
  OWNER_REVOCATION: 'OWNER_POLICY_REVOKED',
  INVALIDATED: 'ROUND_INVALIDATED',
  EXPIRED: 'RETENTION_EXPIRED'
});

export function planCandidateReviewClose({
  closeKind,
  closeReason,
  roundManifestSha256,
  aggregateVerified = false,
  aggregateReceiptVerified = false,
  restackHandoffComplete = false,
  promotionDispositionRecorded = false
}) {
  if (!['ORDINARY', 'EXCEPTIONAL'].includes(closeKind)
    || !Object.values(CLOSE_REASONS).includes(closeReason)
    || !SHA256_PATTERN.test(roundManifestSha256)) {
    fail('CLOSE_PLAN_INPUT_INVALID');
  }
  if (closeKind === 'ORDINARY') {
    if (closeReason !== CLOSE_REASONS.ORDINARY
      || aggregateVerified !== true
      || aggregateReceiptVerified !== true
      || restackHandoffComplete !== true
      || promotionDispositionRecorded !== true) {
      fail('ORDINARY_CLOSE_PRECONDITIONS_NOT_MET');
    }
  } else if (closeReason === CLOSE_REASONS.ORDINARY) {
    fail('EXCEPTIONAL_CLOSE_REASON_REQUIRED');
  }
  const aggregateState = aggregateVerified && aggregateReceiptVerified
    ? 'VERIFIED_AGGREGATE_AVAILABLE'
    : 'AGGREGATE_UNAVAILABLE_AT_FORCED_CLOSE';
  const plan = {
    schemaVersion: CLOSE_PLAN_SCHEMA_VERSION,
    boundary: NOT_PRODUCTION_EVIDENCE,
    status: 'PLAN_ONLY_HOLD_FOR_EXPLICIT_LOCAL_CUSTODIAN_ACTION',
    productionReady: false,
    destructiveActionPerformed: false,
    executionAuthorized: false,
    closeKind,
    closeReason,
    roundManifestSha256,
    aggregateState,
    filesToClear: [...ALLOWED_RELATIVE_FILES],
    rootsToRemoveAfterEmpty: ROOT_ENTRIES
      .map((entry) => entry.relativePath)
      .sort(asciiCompare)
  };
  validateCandidateReviewClosePlan(plan);
  return deepFreeze(plan);
}

export function validateCandidateReviewClosePlan(plan) {
  assertExactKeys(plan, [
    'schemaVersion',
    'boundary',
    'status',
    'productionReady',
    'destructiveActionPerformed',
    'executionAuthorized',
    'closeKind',
    'closeReason',
    'roundManifestSha256',
    'aggregateState',
    'filesToClear',
    'rootsToRemoveAfterEmpty'
  ], 'CLOSE_PLAN_KEYS_INVALID');
  if (plan.schemaVersion !== CLOSE_PLAN_SCHEMA_VERSION
    || plan.boundary !== NOT_PRODUCTION_EVIDENCE
    || plan.status !== 'PLAN_ONLY_HOLD_FOR_EXPLICIT_LOCAL_CUSTODIAN_ACTION'
    || plan.productionReady !== false
    || plan.destructiveActionPerformed !== false
    || plan.executionAuthorized !== false
    || !['ORDINARY', 'EXCEPTIONAL'].includes(plan.closeKind)
    || !Object.values(CLOSE_REASONS).includes(plan.closeReason)
    || !SHA256_PATTERN.test(plan.roundManifestSha256)
    || ![
      'VERIFIED_AGGREGATE_AVAILABLE',
      'AGGREGATE_UNAVAILABLE_AT_FORCED_CLOSE'
    ].includes(plan.aggregateState)) {
    fail('CLOSE_PLAN_INVALID');
  }
  const paths = plan.filesToClear.map((entry) => normalizeRelativePath(entry));
  if (paths.length !== ALLOWED_RELATIVE_FILES.length
    || paths.some((entry, index) => entry !== ALLOWED_RELATIVE_FILES[index])) {
    fail('CLOSE_PLAN_FILE_ALLOWLIST_INVALID');
  }
  const expectedRoots = ROOT_ENTRIES
    .map((entry) => entry.relativePath)
    .sort(asciiCompare);
  if (!Array.isArray(plan.rootsToRemoveAfterEmpty)
    || plan.rootsToRemoveAfterEmpty.length !== expectedRoots.length
    || plan.rootsToRemoveAfterEmpty.some((entry, index) =>
      entry !== expectedRoots[index])) {
    fail('CLOSE_PLAN_ROOT_ALLOWLIST_INVALID');
  }
  return deepFreeze({
    schemaVersion: CLOSE_PLAN_SCHEMA_VERSION,
    boundary: NOT_PRODUCTION_EVIDENCE,
    gate: 'PASS',
    planOnly: true,
    destructiveActionPerformed: false
  });
}

export const CANDIDATE_REVIEW_V2_CLOSE_REASONS = CLOSE_REASONS;
