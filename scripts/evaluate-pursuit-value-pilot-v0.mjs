#!/usr/bin/env node

import {
  closeSync,
  constants,
  fchmodSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, relative, resolve, sep } from 'node:path';

import {
  buildPursuitValuePilotAggregate,
  hashPursuitValuePilotCanonical,
  serializePursuitValuePilotCanonical,
  validatePursuitValuePilotAggregate,
  validatePursuitValuePilotSession,
  validatePursuitValuePilotTeamWeek,
} from '../verticals/datacenter/pursuit-value-pilot-v0.mjs';
import {
  buildRepositoryPursuitValuePilotContext,
} from './lib/pursuit-value-pilot-files.mjs';
import { REPO_ROOT } from './lib/repository-claim-registry.mjs';

const WRITE_FLAG = '--write-canonical-artifacts';
const PROTOCOL_ARTIFACT = 'tmp/codex/pursuit-value-pilot-v0-protocol.json';
const READINESS_ARTIFACT = 'tmp/codex/pursuit-value-pilot-v0-readiness-non-production.json';

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function failureCode(error) {
  return typeof error?.code === 'string' && /^[A-Z0-9_]+$/.test(error.code)
    ? error.code
    : 'PILOT_EVALUATION_FAILED';
}

function withNewline(value) {
  const serialized = serializePursuitValuePilotCanonical(value);
  return serialized.endsWith('\n') ? serialized : `${serialized}\n`;
}

function fixedArtifactPath(relativePath) {
  const destination = resolve(REPO_ROOT, relativePath);
  const fromRoot = relative(REPO_ROOT, destination);
  if (
    fromRoot === ''
    || fromRoot === '..'
    || fromRoot.startsWith(`..${sep}`)
    || resolve(REPO_ROOT, fromRoot) !== destination
  ) fail('PILOT_CANONICAL_ARTIFACT_PATH_UNSAFE');
  return destination;
}

function currentUid() {
  return typeof process.getuid === 'function' ? process.getuid() : null;
}

function assertOwned(stat, code) {
  const uid = currentUid();
  if (uid !== null && stat.uid !== uid) fail(code);
}

function requireNoFollow() {
  if (!Number.isInteger(constants.O_NOFOLLOW)) fail('PILOT_NOFOLLOW_UNAVAILABLE');
  return constants.O_NOFOLLOW;
}

function requireDirectoryOnly() {
  if (!Number.isInteger(constants.O_DIRECTORY)) fail('PILOT_DIRECTORY_FLAG_UNAVAILABLE');
  return constants.O_DIRECTORY;
}

function inspectSafeDirectory(path, codePrefix) {
  let stat;
  try { stat = lstatSync(path); } catch { fail(`${codePrefix}_MISSING`); }
  if (stat.isSymbolicLink() || !stat.isDirectory()) fail(`${codePrefix}_UNSAFE`);
  assertOwned(stat, `${codePrefix}_OWNER_UNSAFE`);
  if ((stat.mode & 0o022) !== 0) fail(`${codePrefix}_PERMISSIONS_UNSAFE`);
  return stat;
}

function fsyncDirectory(path) {
  let descriptor;
  try {
    descriptor = openSync(
      path,
      constants.O_RDONLY | requireNoFollow() | requireDirectoryOnly(),
    );
    if (!fstatSync(descriptor).isDirectory()) fail('PILOT_CANONICAL_ARTIFACT_DIRECTORY_UNSAFE');
    fsyncSync(descriptor);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function ensureSafeArtifactDirectory() {
  const tmpPath = resolve(REPO_ROOT, 'tmp');
  const codexPath = resolve(tmpPath, 'codex');
  inspectSafeDirectory(tmpPath, 'PILOT_CANONICAL_TMP_DIRECTORY');
  let created = false;
  try {
    lstatSync(codexPath);
  } catch (error) {
    if (error?.code !== 'ENOENT') fail('PILOT_CANONICAL_ARTIFACT_DIRECTORY_UNSAFE');
    mkdirSync(codexPath, { mode: 0o755 });
    created = true;
  }
  inspectSafeDirectory(codexPath, 'PILOT_CANONICAL_ARTIFACT_DIRECTORY');
  const canonicalRoot = realpathSync(REPO_ROOT);
  if (realpathSync(codexPath) !== resolve(canonicalRoot, 'tmp', 'codex')) {
    fail('PILOT_CANONICAL_ARTIFACT_DIRECTORY_UNSAFE');
  }
  if (created) fsyncDirectory(tmpPath);
  return codexPath;
}

function assertSafeExistingArtifact(path) {
  let stat;
  try { stat = lstatSync(path); } catch (error) {
    if (error?.code === 'ENOENT') return;
    fail('PILOT_CANONICAL_ARTIFACT_INSPECTION_FAILED');
  }
  if (stat.isSymbolicLink()) fail('PILOT_CANONICAL_ARTIFACT_SYMLINK_REFUSED');
  if (!stat.isFile()) fail('PILOT_CANONICAL_ARTIFACT_NON_REGULAR');
  if (stat.nlink !== 1) fail('PILOT_CANONICAL_ARTIFACT_LINK_COUNT_UNSAFE');
  assertOwned(stat, 'PILOT_CANONICAL_ARTIFACT_OWNER_UNSAFE');
  if ((stat.mode & 0o022) !== 0) fail('PILOT_CANONICAL_ARTIFACT_PERMISSIONS_UNSAFE');
}

function writeCanonicalArtifact(relativePath, value) {
  const destination = fixedArtifactPath(relativePath);
  const artifactDirectory = ensureSafeArtifactDirectory();
  if (dirname(destination) !== artifactDirectory) fail('PILOT_CANONICAL_ARTIFACT_PATH_UNSAFE');
  assertSafeExistingArtifact(destination);
  const temporary = resolve(
    artifactDirectory,
    `.${basename(destination)}.${process.pid}.tmp`,
  );
  let descriptor;
  let created = false;
  try {
    descriptor = openSync(
      temporary,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | requireNoFollow(),
      0o600,
    );
    created = true;
    fchmodSync(descriptor, 0o644);
    const opened = fstatSync(descriptor);
    if (!opened.isFile() || opened.nlink !== 1) fail('PILOT_CANONICAL_ARTIFACT_TEMP_UNSAFE');
    assertOwned(opened, 'PILOT_CANONICAL_ARTIFACT_OWNER_UNSAFE');
    writeFileSync(descriptor, withNewline(value), 'utf8');
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    assertSafeExistingArtifact(destination);
    renameSync(temporary, destination);
    created = false;
    fsyncDirectory(artifactDirectory);
  } finally {
    if (descriptor !== undefined) {
      try { closeSync(descriptor); } catch {}
    }
    if (created) {
      try { unlinkSync(temporary); } catch {}
    }
  }
}

async function buildBlankRun() {
  const context = await buildRepositoryPursuitValuePilotContext();
  const sessions = context.sessions.map((session) => (
    validatePursuitValuePilotSession(session, context.protocol)
  ));
  const teamWeeks = [validatePursuitValuePilotTeamWeek(context.teamWeek, context.protocol)];
  const aggregate = buildPursuitValuePilotAggregate(context.protocol, sessions, teamWeeks);
  validatePursuitValuePilotAggregate(aggregate, context.protocol, sessions, teamWeeks);
  return { ...context, sessions, teamWeeks, aggregate };
}

function caseCount(caseCatalog) {
  if (!Array.isArray(caseCatalog?.cases)) fail('PILOT_CASE_CATALOG_SHAPE_INVALID');
  return caseCatalog.cases.length;
}

function buildReadinessReport(run, repeatEquality) {
  const counts = run.aggregate?.counts || {};
  const report = {
    schemaVersion: 'pursuit-value-pilot-v0-readiness-report-v0',
    documentStatus: 'READY_FOR_HUMAN_SESSIONS',
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    executionBoundary: 'LOCAL_TEST_SYNTHETIC_ONLY',
    productionReady: false,
    productionReviewerWorkflowReady: false,
    issue165Status: 'HOLD',
    humanEvidenceStatus: 'INCOMPLETE',
    systemFinalDecisionAcceptance: 'NOT_MEASURABLE_NO_SYSTEM_FINAL_DECISION',
    automaticPilotDecision: false,
    pilotDisposition: 'NOT_MADE',
    readiness: {
      protocolValid: true,
      blankSkeletonAggregateValid: true,
      repeatEquality,
      readyForHumanSessions: true,
      humanSessionsExecuted: false,
      privateIntakeTouched: false,
      externalCalls: 0,
    },
    counts: {
      syntheticCaseCount: caseCount(run.cases),
      reviewerTemplateCount: run.sessions.length,
      teamWeekTemplateCount: run.teamWeeks.length,
      eligibleCompletedReviewerCount: counts.eligibleCompletedReviewerCount ?? 0,
      completedTeamWeekCount: counts.completedTeamWeekCount ?? 0,
    },
    hashes: {
      caseCatalogCanonicalSha256: run.cases.canonicalSha256,
      protocolCanonicalSha256: run.protocol.canonicalSha256,
      blankAggregateCanonicalSha256: run.aggregate.canonicalSha256,
    },
  };
  return {
    ...report,
    canonicalSha256: hashPursuitValuePilotCanonical(report),
  };
}

try {
  const args = process.argv.slice(2);
  if (
    args.length > 1
    || (args.length === 1 && args[0] !== WRITE_FLAG)
  ) fail('PILOT_CLI_ARGUMENT_REFUSED');

  const first = await buildBlankRun();
  const second = await buildBlankRun();
  const firstMaterial = serializePursuitValuePilotCanonical({
    cases: first.cases,
    protocol: first.protocol,
    sessions: first.sessions,
    teamWeeks: first.teamWeeks,
    aggregate: first.aggregate,
  });
  const secondMaterial = serializePursuitValuePilotCanonical({
    cases: second.cases,
    protocol: second.protocol,
    sessions: second.sessions,
    teamWeeks: second.teamWeeks,
    aggregate: second.aggregate,
  });
  if (firstMaterial !== secondMaterial) fail('PILOT_EVALUATION_NONDETERMINISTIC');

  const report = buildReadinessReport(first, true);
  if (args[0] === WRITE_FLAG) {
    writeCanonicalArtifact(PROTOCOL_ARTIFACT, first.protocol);
    writeCanonicalArtifact(READINESS_ARTIFACT, report);
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} catch (error) {
  process.stdout.write(`${JSON.stringify({
    schemaVersion: 'pursuit-value-pilot-v0-readiness-report-v0',
    documentStatus: 'INVALID',
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    executionBoundary: 'LOCAL_TEST_SYNTHETIC_ONLY',
    productionReady: false,
    productionReviewerWorkflowReady: false,
    issue165Status: 'HOLD',
    humanEvidenceStatus: 'INCOMPLETE',
    systemFinalDecisionAcceptance: 'NOT_MEASURABLE_NO_SYSTEM_FINAL_DECISION',
    automaticPilotDecision: false,
    pilotDisposition: 'NOT_MADE',
    failureCodes: [failureCode(error)],
  }, null, 2)}\n`);
  process.exitCode = 1;
}
