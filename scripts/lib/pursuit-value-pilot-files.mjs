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
  realpathSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';

import {
  buildBlankPursuitValuePilotSession,
  buildBlankPursuitValuePilotTeamWeek,
  buildBlankPursuitValuePilotTeamWeekResponseEnvelope,
  buildPursuitValuePilotAggregate,
  buildPursuitValuePilotCaseCatalog,
  buildPursuitValuePilotProtocol,
  materializePursuitValuePilotSessionResponse,
  materializePursuitValuePilotTeamWeekResponse,
  parsePursuitValuePilotJsonStrict,
  serializePursuitValuePilotCanonical,
  validatePursuitValuePilotAggregate,
  validatePursuitValuePilotCaseCatalog,
  validatePursuitValuePilotProtocol,
  validatePursuitValuePilotSession,
  validatePursuitValuePilotTeamWeek,
} from '../../verticals/datacenter/pursuit-value-pilot-v0.mjs';
import { loadEvidenceDomainInputs, REPO_ROOT } from './repository-claim-registry.mjs';
import {
  PURSUIT_VALUE_PILOT_RESPONSE_SCHEMA_VERSION,
  renderPursuitValuePilotOfflineHtml,
} from './pursuit-value-pilot-offline-html.mjs';

export const PURSUIT_VALUE_PILOT_PRIVATE_DIRECTORY = 'tmp/pursuit-value-pilot-v0';
export const PURSUIT_VALUE_PILOT_PRIVATE_DIRECTORY_PATH = resolve(
  REPO_ROOT,
  PURSUIT_VALUE_PILOT_PRIVATE_DIRECTORY,
);
export const PURSUIT_VALUE_PILOT_REVIEWER_IDS = Object.freeze([
  'PV-R1',
  'PV-R2',
  'PV-R3',
  'PV-R4',
  'PV-R5',
]);
export const PURSUIT_VALUE_PILOT_TEAM_WEEK_ID = 'PV-WEEK-1';
export const PURSUIT_VALUE_PILOT_TEAM_WEEK_FILENAME = 'team-week-team-1.json';
export const PURSUIT_VALUE_PILOT_TEAM_WEEK_RESPONSE_SCHEMA_VERSION =
  'pursuit-value-pilot-team-week-response-v0';
export const PURSUIT_VALUE_PILOT_SESSION_FILES = Object.freeze(Object.fromEntries(
  PURSUIT_VALUE_PILOT_REVIEWER_IDS.map((reviewerId, index) => [
    reviewerId,
    `session-pv-r${index + 1}.json`,
  ]),
));
export const PURSUIT_VALUE_PILOT_HTML_FILES = Object.freeze(Object.fromEntries(
  PURSUIT_VALUE_PILOT_REVIEWER_IDS.map((reviewerId, index) => [
    reviewerId,
    `reviewer-pv-r${index + 1}.html`,
  ]),
));
export const PURSUIT_VALUE_PILOT_EXPECTED_FILES = Object.freeze([
  ...Object.values(PURSUIT_VALUE_PILOT_HTML_FILES),
  ...Object.values(PURSUIT_VALUE_PILOT_SESSION_FILES),
  PURSUIT_VALUE_PILOT_TEAM_WEEK_FILENAME,
].sort());

const MAX_JSON_BYTES = 512 * 1024;
const MAX_HTML_BYTES = 2 * 1024 * 1024;
const PRIVATE_DIRECTORY_MODE = 0o700;
const PRIVATE_FILE_MODE = 0o600;
const PRIVATE_PARENT_PATH = dirname(PURSUIT_VALUE_PILOT_PRIVATE_DIRECTORY_PATH);
const MAX_REDACTED_AGGREGATE_BYTES = 128 * 1024;
const RAW_AGGREGATE_KEYS = new Set([
  'caseCatalog',
  'cases',
  'reviewerId',
  'reviewerIds',
  'sessionId',
  'sessionIds',
  'teamWeekId',
  'teamWeekIds',
  'humanInput',
  'role',
  'experienceBand',
  'eligibilityConfirmed',
  'syntheticOnlyConfirmed',
  'baseline',
  'twin',
  'humanDecision',
  'evidenceTraceAttestation',
  'selectedDecisionTraceRefs',
  'gapAssessments',
  'technicalStateDisposition',
  'unsupportedCustomerUseClaimObserved',
  'unsupportedCustomerUseClaimCount',
  'wouldUseAgain',
  'weeklyUseIntent',
  'willingnessToPay',
  'decisionImpact',
  'finalDisposition',
  'caseId',
  'raw',
]);

export class PursuitValuePilotFileError extends Error {
  constructor(code) {
    super(code);
    this.name = 'PursuitValuePilotFileError';
    this.code = code;
  }
}

function fail(code) {
  throw new PursuitValuePilotFileError(code);
}

function noFollowFlag() {
  if (!Number.isInteger(constants.O_NOFOLLOW)) fail('PILOT_NOFOLLOW_UNAVAILABLE');
  return constants.O_NOFOLLOW;
}

function directoryOnlyFlag() {
  if (!Number.isInteger(constants.O_DIRECTORY)) fail('PILOT_DIRECTORY_FLAG_UNAVAILABLE');
  return constants.O_DIRECTORY;
}

function currentUid() {
  return typeof process.getuid === 'function' ? process.getuid() : null;
}

function assertOwned(stat, code) {
  const uid = currentUid();
  if (uid !== null && stat.uid !== uid) fail(code);
}

function statFingerprint(stat) {
  return [
    stat.dev,
    stat.ino,
    stat.size,
    stat.nlink,
    stat.mode,
    stat.uid,
    stat.mtimeMs,
    stat.ctimeMs,
  ].join(':');
}

function assertPrivateRootIsConfined() {
  const pathFromRepository = relative(REPO_ROOT, PURSUIT_VALUE_PILOT_PRIVATE_DIRECTORY_PATH);
  if (
    pathFromRepository === ''
    || pathFromRepository === '..'
    || pathFromRepository.startsWith(`..${sep}`)
    || resolve(REPO_ROOT, pathFromRepository) !== PURSUIT_VALUE_PILOT_PRIVATE_DIRECTORY_PATH
  ) fail('PILOT_PRIVATE_PATH_UNSAFE');
}

function assertSafeParentDirectory() {
  assertPrivateRootIsConfined();
  const parentPath = PRIVATE_PARENT_PATH;
  let stat;
  try {
    stat = lstatSync(parentPath);
  } catch {
    fail('PILOT_PARENT_DIRECTORY_MISSING');
  }
  if (stat.isSymbolicLink() || !stat.isDirectory()) fail('PILOT_PARENT_DIRECTORY_UNSAFE');
  assertOwned(stat, 'PILOT_PARENT_DIRECTORY_OWNER_UNSAFE');
  if ((stat.mode & 0o022) !== 0) fail('PILOT_PARENT_DIRECTORY_PERMISSIONS_UNSAFE');
  try {
    const canonicalRepositoryRoot = realpathSync(REPO_ROOT);
    if (realpathSync(parentPath) !== resolve(canonicalRepositoryRoot, 'tmp')) {
      fail('PILOT_PARENT_DIRECTORY_UNSAFE');
    }
  } catch (error) {
    if (error instanceof PursuitValuePilotFileError) throw error;
    fail('PILOT_PARENT_DIRECTORY_UNSAFE');
  }
}

function inspectExistingRoot() {
  let stat;
  try {
    stat = lstatSync(PURSUIT_VALUE_PILOT_PRIVATE_DIRECTORY_PATH);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    fail('PILOT_DIRECTORY_INSPECTION_FAILED');
  }
  if (stat.isSymbolicLink()) fail('PILOT_DIRECTORY_SYMLINK_REFUSED');
  if (!stat.isDirectory()) {
    if (stat.nlink !== 1) fail('PILOT_DIRECTORY_LINK_COUNT_UNSAFE');
    fail('PILOT_DIRECTORY_NON_DIRECTORY');
  }
  assertOwned(stat, 'PILOT_DIRECTORY_OWNER_UNSAFE');
  if ((stat.mode & 0o777) !== PRIVATE_DIRECTORY_MODE) fail('PILOT_DIRECTORY_PERMISSIONS_UNSAFE');
  return stat;
}

function assertSafePrivateRoot() {
  const stat = inspectExistingRoot();
  if (!stat) fail('PILOT_DIRECTORY_MISSING');
  return stat;
}

function assertExactPrivateFileSet() {
  let entries;
  try {
    entries = readdirSync(PURSUIT_VALUE_PILOT_PRIVATE_DIRECTORY_PATH, { withFileTypes: true });
  } catch {
    fail('PILOT_FILE_SET_READ_FAILED');
  }
  const actualNames = entries.map((entry) => entry.name).sort();
  if (
    actualNames.length !== PURSUIT_VALUE_PILOT_EXPECTED_FILES.length
    || actualNames.some((name, index) => name !== PURSUIT_VALUE_PILOT_EXPECTED_FILES[index])
  ) fail('PILOT_FILE_SET_INVALID');
}

function assertDescriptorIsPrivateFile(stat, codePrefix) {
  if (!stat.isFile()) fail(`${codePrefix}_NON_REGULAR`);
  if (stat.nlink !== 1) fail(`${codePrefix}_LINK_COUNT_UNSAFE`);
  assertOwned(stat, `${codePrefix}_OWNER_UNSAFE`);
  if ((stat.mode & 0o777) !== PRIVATE_FILE_MODE) fail(`${codePrefix}_PERMISSIONS_UNSAFE`);
}

function writeExclusivePrivateFile(path, contents, maxBytes) {
  const bytes = Buffer.from(contents, 'utf8');
  if (bytes.byteLength <= 0 || bytes.byteLength > maxBytes) fail('PILOT_FILE_SIZE_INVALID');
  const noFollow = noFollowFlag();
  let descriptor;
  let created = false;
  try {
    descriptor = openSync(
      path,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | noFollow,
      PRIVATE_FILE_MODE,
    );
    created = true;
  } catch (error) {
    fail(error?.code === 'EEXIST' ? 'PILOT_PREPARE_REFUSES_OVERWRITE' : 'PILOT_FILE_CREATE_FAILED');
  }
  try {
    fchmodSync(descriptor, PRIVATE_FILE_MODE);
    const opened = fstatSync(descriptor);
    assertDescriptorIsPrivateFile(opened, 'PILOT_FILE');
    writeFileSync(descriptor, bytes);
    fsyncSync(descriptor);
    const after = fstatSync(descriptor);
    assertDescriptorIsPrivateFile(after, 'PILOT_FILE');
    if (after.size !== bytes.byteLength) fail('PILOT_FILE_WRITE_INCOMPLETE');
  } catch (error) {
    try { closeSync(descriptor); } catch {}
    if (created) {
      try { unlinkSync(path); } catch {}
    }
    if (error?.code) throw error;
    fail('PILOT_FILE_CREATE_FAILED');
  }
  closeSync(descriptor);
}

function fsyncDirectory(path, failureCode) {
  const noFollow = noFollowFlag();
  const directoryOnly = directoryOnlyFlag();
  let descriptor;
  try {
    descriptor = openSync(
      path,
      constants.O_RDONLY | directoryOnly | noFollow,
    );
    const stat = fstatSync(descriptor);
    if (!stat.isDirectory()) fail('PILOT_DIRECTORY_RACE_REFUSED');
    fsyncSync(descriptor);
  } catch (error) {
    if (error instanceof PursuitValuePilotFileError) throw error;
    fail(failureCode);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function fsyncPrivateRoot() {
  fsyncDirectory(PURSUIT_VALUE_PILOT_PRIVATE_DIRECTORY_PATH, 'PILOT_DIRECTORY_SYNC_FAILED');
}

function fsyncPrivateParent() {
  fsyncDirectory(PRIVATE_PARENT_PATH, 'PILOT_PARENT_DIRECTORY_SYNC_FAILED');
}

function serializePrivateJson(value) {
  const serialized = serializePursuitValuePilotCanonical(value);
  if (typeof serialized !== 'string' || serialized.length === 0) fail('PILOT_SERIALIZATION_FAILED');
  return serialized.endsWith('\n') ? serialized : `${serialized}\n`;
}

function safeRecordId(record) {
  return record?.reviewerId || record?.reviewer?.reviewerId || record?.reviewer?.reviewerSlotId;
}

export async function buildRepositoryPursuitValuePilotContext() {
  const { registry, verticalPack } = await loadEvidenceDomainInputs();
  const cases = buildPursuitValuePilotCaseCatalog(registry, verticalPack);
  validatePursuitValuePilotCaseCatalog(cases, registry, verticalPack);
  const protocol = buildPursuitValuePilotProtocol(registry, verticalPack, { caseCatalog: cases });
  validatePursuitValuePilotProtocol(protocol, registry, verticalPack);
  const sessions = PURSUIT_VALUE_PILOT_REVIEWER_IDS.map((reviewerId) => (
    buildBlankPursuitValuePilotSession(protocol, reviewerId)
  ));
  const teamWeek = buildBlankPursuitValuePilotTeamWeek(protocol, PURSUIT_VALUE_PILOT_TEAM_WEEK_ID);
  const teamWeekResponse = buildBlankPursuitValuePilotTeamWeekResponseEnvelope(
    protocol,
    teamWeek,
  );
  return { registry, verticalPack, cases, protocol, sessions, teamWeek, teamWeekResponse };
}

export async function preparePursuitValuePilotPrivateFiles({
  afterFileCreateForTest,
} = {}) {
  const context = await buildRepositoryPursuitValuePilotContext();
  assertSafeParentDirectory();
  if (inspectExistingRoot()) fail('PILOT_PREPARE_REFUSES_OVERWRITE');

  let directoryCreated = false;
  const created = [];
  try {
    try {
      mkdirSync(PURSUIT_VALUE_PILOT_PRIVATE_DIRECTORY_PATH, { mode: PRIVATE_DIRECTORY_MODE });
    } catch (error) {
      if (error?.code === 'EEXIST') fail('PILOT_PREPARE_REFUSES_OVERWRITE');
      fail('PILOT_DIRECTORY_CREATE_FAILED');
    }
    directoryCreated = true;
    fsyncPrivateParent();
    const rootStat = assertSafePrivateRoot();
    if (readdirSync(PURSUIT_VALUE_PILOT_PRIVATE_DIRECTORY_PATH).length !== 0) {
      fail('PILOT_PREPARE_REFUSES_OVERWRITE');
    }

    for (const [index, reviewerId] of PURSUIT_VALUE_PILOT_REVIEWER_IDS.entries()) {
      const session = context.sessions[index];
      if (safeRecordId(session) && safeRecordId(session) !== reviewerId) {
        fail('PILOT_SESSION_REVIEWER_MISMATCH');
      }
      const sessionPath = resolve(
        PURSUIT_VALUE_PILOT_PRIVATE_DIRECTORY_PATH,
        PURSUIT_VALUE_PILOT_SESSION_FILES[reviewerId],
      );
      writeExclusivePrivateFile(sessionPath, serializePrivateJson(session), MAX_JSON_BYTES);
      created.push(sessionPath);
      afterFileCreateForTest?.(sessionPath, created.length);

      const htmlPath = resolve(
        PURSUIT_VALUE_PILOT_PRIVATE_DIRECTORY_PATH,
        PURSUIT_VALUE_PILOT_HTML_FILES[reviewerId],
      );
      const html = renderPursuitValuePilotOfflineHtml(context.protocol, session, context.cases);
      if (typeof html !== 'string' || html.length === 0) fail('PILOT_HTML_RENDER_FAILED');
      writeExclusivePrivateFile(htmlPath, html, MAX_HTML_BYTES);
      created.push(htmlPath);
      afterFileCreateForTest?.(htmlPath, created.length);
    }

    const teamPath = resolve(
      PURSUIT_VALUE_PILOT_PRIVATE_DIRECTORY_PATH,
      PURSUIT_VALUE_PILOT_TEAM_WEEK_FILENAME,
    );
    writeExclusivePrivateFile(
      teamPath,
      serializePrivateJson(context.teamWeekResponse),
      MAX_JSON_BYTES,
    );
    created.push(teamPath);
    afterFileCreateForTest?.(teamPath, created.length);
    fsyncPrivateRoot();
    fsyncPrivateParent();

    const after = assertSafePrivateRoot();
    if (statFingerprint(rootStat) !== statFingerprint(after)) {
      // Directory size/timestamps necessarily change while files are created. Identity,
      // ownership, and permissions are checked separately below.
      if (rootStat.dev !== after.dev || rootStat.ino !== after.ino) fail('PILOT_DIRECTORY_RACE_REFUSED');
    }
    assertExactPrivateFileSet();
    return {
      protocol: context.protocol,
      sessions: context.sessions,
      teamWeek: context.teamWeek,
      files: [...PURSUIT_VALUE_PILOT_EXPECTED_FILES],
    };
  } catch (error) {
    for (const path of created.reverse()) {
      try { unlinkSync(path); } catch {}
    }
    if (directoryCreated) {
      try { rmdirSync(PURSUIT_VALUE_PILOT_PRIVATE_DIRECTORY_PATH); } catch {}
      try { fsyncPrivateParent(); } catch {}
    }
    if (error?.code) throw error;
    fail('PILOT_PREPARE_FAILED');
  }
}

function readPrivateRegularFile(path, {
  kind,
  afterFileOpenForTest,
} = {}) {
  const codePrefix = kind === 'HTML' ? 'PILOT_HTML_FILE' : 'PILOT_JSON_FILE';
  const maxBytes = kind === 'HTML' ? MAX_HTML_BYTES : MAX_JSON_BYTES;
  let before;
  try {
    before = lstatSync(path);
  } catch {
    fail(`${codePrefix}_MISSING`);
  }
  if (before.isSymbolicLink()) fail(`${codePrefix}_SYMLINK_REFUSED`);
  assertDescriptorIsPrivateFile(before, codePrefix);
  if (before.size <= 0 || before.size > maxBytes) fail(`${codePrefix}_SIZE_INVALID`);

  const noFollow = noFollowFlag();
  let descriptor;
  try {
    descriptor = openSync(path, constants.O_RDONLY | noFollow);
  } catch {
    fail(`${codePrefix}_OPEN_REFUSED`);
  }
  try {
    const opened = fstatSync(descriptor);
    assertDescriptorIsPrivateFile(opened, codePrefix);
    if (statFingerprint(opened) !== statFingerprint(before)) fail(`${codePrefix}_RACE_REFUSED`);
    afterFileOpenForTest?.(path, kind);
    const bytes = readFileSync(descriptor);
    const after = fstatSync(descriptor);
    if (
      statFingerprint(after) !== statFingerprint(opened)
      || bytes.byteLength !== opened.size
    ) fail(`${codePrefix}_RACE_REFUSED`);
    try {
      return {
        bytes,
        text: new TextDecoder('utf-8', { fatal: true }).decode(bytes),
        fingerprint: statFingerprint(opened),
      };
    } catch {
      fail(`${codePrefix}_UTF8_INVALID`);
    }
  } finally {
    closeSync(descriptor);
  }
}

function parsePrivateJson(text) {
  try {
    return parsePursuitValuePilotJsonStrict(text);
  } catch (error) {
    if (error?.code) throw error;
    fail('PILOT_JSON_INVALID');
  }
}

function materializeSessionRecord(record, protocol, blankSession, expectedReviewerId) {
  if (record?.schemaVersion !== PURSUIT_VALUE_PILOT_RESPONSE_SCHEMA_VERSION) {
    const validated = validatePursuitValuePilotSession(record, protocol);
    if (validated.reviewerId !== expectedReviewerId) fail('PILOT_SESSION_REVIEWER_MISMATCH');
    if (validated.humanEvidenceStatus !== 'INCOMPLETE') {
      fail('PILOT_COMPLETED_CANONICAL_SESSION_REFUSED');
    }
    if (validated.canonicalSha256 !== blankSession.canonicalSha256) {
      fail('PILOT_CANONICAL_SESSION_BINDING_INVALID');
    }
    return validated;
  }
  if (blankSession.reviewerId !== expectedReviewerId) fail('PILOT_SESSION_REVIEWER_MISMATCH');
  return materializePursuitValuePilotSessionResponse(record, blankSession, protocol);
}

function materializeTeamWeekRecord(record, protocol, blankTeamWeek) {
  if (record?.schemaVersion !== PURSUIT_VALUE_PILOT_TEAM_WEEK_RESPONSE_SCHEMA_VERSION) {
    const validated = validatePursuitValuePilotTeamWeek(record, protocol);
    if (validated.humanEvidenceStatus !== 'INCOMPLETE') {
      fail('PILOT_COMPLETED_CANONICAL_TEAM_WEEK_REFUSED');
    }
    if (validated.canonicalSha256 !== blankTeamWeek.canonicalSha256) {
      fail('PILOT_CANONICAL_TEAM_WEEK_BINDING_INVALID');
    }
    return validated;
  }
  return materializePursuitValuePilotTeamWeekResponse(record, blankTeamWeek, protocol);
}

function assertRedactedAggregateNode(value, path = '$', depth = 0) {
  if (depth > 16) fail('PILOT_AGGREGATE_OUTPUT_DEPTH_UNSAFE');
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('PILOT_AGGREGATE_OUTPUT_VALUE_UNSAFE');
    return;
  }
  if (typeof value === 'string') {
    if (
      value.length > 512
      || /(?:authorization\s*:|bearer\s+|api[_-]?key|client[_-]?secret|private[_-]?key)/i.test(value)
      || /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(value)
      || /https?:\/\//i.test(value)
      || /(?:^|\s)(?:\/Users\/|\/home\/|[A-Za-z]:\\)/.test(value)
    ) fail('PILOT_AGGREGATE_OUTPUT_PROTECTED_CONTENT_REFUSED');
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > 200) fail('PILOT_AGGREGATE_OUTPUT_ARRAY_UNSAFE');
    value.forEach((item, index) => assertRedactedAggregateNode(item, `${path}[${index}]`, depth + 1));
    return;
  }
  if (!value || typeof value !== 'object') fail('PILOT_AGGREGATE_OUTPUT_VALUE_UNSAFE');
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    fail('PILOT_AGGREGATE_OUTPUT_OBJECT_UNSAFE');
  }
  for (const [key, child] of Object.entries(value)) {
    if (RAW_AGGREGATE_KEYS.has(key)) fail('PILOT_AGGREGATE_OUTPUT_RAW_FIELD_REFUSED');
    assertRedactedAggregateNode(child, `${path}.${key}`, depth + 1);
  }
}

export function redactPursuitValuePilotAggregateForOutput(aggregate) {
  assertRedactedAggregateNode(aggregate);
  const serialized = serializePursuitValuePilotCanonical(aggregate);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_REDACTED_AGGREGATE_BYTES) {
    fail('PILOT_AGGREGATE_OUTPUT_SIZE_UNSAFE');
  }
  return JSON.parse(serialized);
}

export async function loadAndAggregatePursuitValuePilotPrivateFiles({
  afterFileOpenForTest,
} = {}) {
  const context = await buildRepositoryPursuitValuePilotContext();
  assertSafeParentDirectory();
  const rootBefore = assertSafePrivateRoot();
  assertExactPrivateFileSet();

  const sessions = [];
  const readFingerprints = [];
  for (const reviewerId of PURSUIT_VALUE_PILOT_REVIEWER_IDS) {
    const sessionPath = resolve(
      PURSUIT_VALUE_PILOT_PRIVATE_DIRECTORY_PATH,
      PURSUIT_VALUE_PILOT_SESSION_FILES[reviewerId],
    );
    const sessionRead = readPrivateRegularFile(sessionPath, {
      kind: 'JSON',
      afterFileOpenForTest,
    });
    readFingerprints.push([sessionPath, sessionRead.fingerprint, 'PILOT_JSON_FILE_RACE_REFUSED']);
    const blankSession = context.sessions[PURSUIT_VALUE_PILOT_REVIEWER_IDS.indexOf(reviewerId)];
    const session = parsePrivateJson(sessionRead.text);
    sessions.push(materializeSessionRecord(
      session,
      context.protocol,
      blankSession,
      reviewerId,
    ));

    const expectedHtml = renderPursuitValuePilotOfflineHtml(
      context.protocol,
      blankSession,
      context.cases,
    );
    const htmlPath = resolve(
      PURSUIT_VALUE_PILOT_PRIVATE_DIRECTORY_PATH,
      PURSUIT_VALUE_PILOT_HTML_FILES[reviewerId],
    );
    const htmlRead = readPrivateRegularFile(htmlPath, {
      kind: 'HTML',
      afterFileOpenForTest,
    });
    readFingerprints.push([htmlPath, htmlRead.fingerprint, 'PILOT_HTML_FILE_RACE_REFUSED']);
    if (!htmlRead.bytes.equals(Buffer.from(expectedHtml, 'utf8'))) fail('PILOT_HTML_CONTENT_MISMATCH');
  }

  const teamRead = readPrivateRegularFile(
    resolve(PURSUIT_VALUE_PILOT_PRIVATE_DIRECTORY_PATH, PURSUIT_VALUE_PILOT_TEAM_WEEK_FILENAME),
    { kind: 'JSON', afterFileOpenForTest },
  );
  const teamPath = resolve(
    PURSUIT_VALUE_PILOT_PRIVATE_DIRECTORY_PATH,
    PURSUIT_VALUE_PILOT_TEAM_WEEK_FILENAME,
  );
  readFingerprints.push([teamPath, teamRead.fingerprint, 'PILOT_JSON_FILE_RACE_REFUSED']);
  const teamWeek = materializeTeamWeekRecord(
    parsePrivateJson(teamRead.text),
    context.protocol,
    context.teamWeek,
  );

  const rootAfter = assertSafePrivateRoot();
  if (
    rootBefore.dev !== rootAfter.dev
    || rootBefore.ino !== rootAfter.ino
    || rootBefore.uid !== rootAfter.uid
    || rootBefore.mode !== rootAfter.mode
  ) fail('PILOT_DIRECTORY_RACE_REFUSED');
  assertExactPrivateFileSet();
  for (const [path, expectedFingerprint, raceCode] of readFingerprints) {
    let current;
    try { current = lstatSync(path); } catch { fail(raceCode); }
    if (current.isSymbolicLink() || statFingerprint(current) !== expectedFingerprint) fail(raceCode);
  }

  const aggregate = buildPursuitValuePilotAggregate(
    context.protocol,
    sessions,
    [teamWeek],
  );
  const validated = validatePursuitValuePilotAggregate(
    aggregate,
    context.protocol,
    sessions,
    [teamWeek],
  );
  return redactPursuitValuePilotAggregateForOutput(validated);
}
