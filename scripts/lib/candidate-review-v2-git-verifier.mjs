import { createHash } from 'node:crypto';
import { execFile as execFileCallback } from 'node:child_process';
import { lstat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import {
  CANDIDATE_REVIEW_V2_PATHS,
  assertCandidateReviewLeakageSafe,
  parseStrictCandidateReviewJson
} from './candidate-review-v2-files.mjs';

const execFile = promisify(execFileCallback);
const NOT_PRODUCTION_EVIDENCE = 'NOT_PRODUCTION_EVIDENCE';
const GIT_VERIFIER_SCHEMA_VERSION = 'pr207-candidate-review-v2-git-verifier-v1';
const RECEIPT_SCHEMA_VERSION = 'pr207-candidate-review-v2-aggregate-receipt-v1';
const AGGREGATE_SCHEMA_VERSION = 'pr207-candidate-review-v2-aggregate-v1';
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;
const RECEIPT_KEYS = Object.freeze([
  'schemaVersion',
  'boundary',
  'productionReady',
  'controlBranch',
  'controlBase',
  'aggregatePath',
  'aggregateCommit',
  'aggregateGitBlobObjectId',
  'aggregateByteSha256'
]);
const HEX_SHA_PATTERN = /^[a-f0-9]{40,64}$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const SAFE_BRANCH_PATTERN = /^(?!\/)(?!.*(?:\/\.|\.\/|\/\/|\.\.))[A-Za-z0-9._/-]{1,200}$/u;
const AGGREGATE_KEYS = Object.freeze([
  'schemaVersion',
  'boundary',
  'productionReady',
  'productionReviewerWorkflowReady',
  'repositoryReviewRequired',
  'automaticVerification',
  'customerUseAllowed',
  'proofExecutionApproved',
  'issue165',
  'control',
  'evaluated',
  'hashes',
  'restackCommitments',
  'counts',
  'metrics',
  'gateResult',
  'nonClaims'
]);

function deepFreeze(value, seen = new Set()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function asciiCompare(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function canonicalStringify(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('NON_FINITE_OBSERVATION_NUMBER');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(',')}]`;
  }
  assertPlainObject(value, 'OBSERVATION_OBJECT_REQUIRED');
  return `{${Object.keys(value)
    .sort(asciiCompare)
    .map((key) => `${JSON.stringify(key)}:${canonicalStringify(value[key])}`)
    .join(',')}}`;
}

export class CandidateReviewV2GitVerificationError extends Error {
  constructor(code, details = {}) {
    super(code);
    this.name = 'CandidateReviewV2GitVerificationError';
    this.code = code;
    this.status = 'HOLD';
    this.boundary = NOT_PRODUCTION_EVIDENCE;
    this.details = deepFreeze({ ...details });
  }
}

function fail(code, details) {
  throw new CandidateReviewV2GitVerificationError(code, details);
}

function assertPlainObject(value, code = 'PLAIN_OBJECT_REQUIRED') {
  if (value === null
    || typeof value !== 'object'
    || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype) {
    fail(code);
  }
}

function assertExactKeys(value, expectedKeys, code) {
  assertPlainObject(value, code);
  const actual = Object.keys(value).sort(asciiCompare);
  const expected = [...expectedKeys].sort(asciiCompare);
  if (actual.length !== expected.length
    || actual.some((key, index) => key !== expected[index])) {
    fail(code, { expectedKeys: expected, actualKeys: actual });
  }
}

function deepEqualExact(actual, expected, pathLabel = '$') {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) {
      fail('FROZEN_OBSERVATION_DRIFT', { path: pathLabel });
    }
    for (let index = 0; index < expected.length; index += 1) {
      deepEqualExact(actual[index], expected[index], `${pathLabel}[${index}]`);
    }
    return;
  }
  if (expected && typeof expected === 'object') {
    assertPlainObject(expected, 'EXPECTED_OBSERVATION_OBJECT_REQUIRED');
    assertPlainObject(actual, 'FROZEN_OBSERVATION_DRIFT');
    const actualKeys = Object.keys(actual).sort(asciiCompare);
    const expectedKeys = Object.keys(expected).sort(asciiCompare);
    if (actualKeys.length !== expectedKeys.length
      || actualKeys.some((key, index) => key !== expectedKeys[index])) {
      fail('FROZEN_OBSERVATION_DRIFT', { path: pathLabel });
    }
    for (const key of expectedKeys) {
      deepEqualExact(actual[key], expected[key], `${pathLabel}.${key}`);
    }
    return;
  }
  if (!Object.is(actual, expected)) {
    fail('FROZEN_OBSERVATION_DRIFT', { path: pathLabel });
  }
}

export function validateCandidateReviewFrozenObservation(observation, expected) {
  assertPlainObject(observation, 'OBSERVATION_OBJECT_REQUIRED');
  assertPlainObject(expected, 'EXPECTED_OBSERVATION_OBJECT_REQUIRED');
  try {
    assertCandidateReviewLeakageSafe(observation);
  } catch (error) {
    fail('FROZEN_OBSERVATION_LEAKAGE_REFUSED', {
      causeCode: typeof error?.code === 'string' ? error.code : 'UNKNOWN'
    });
  }
  deepEqualExact(observation, expected);
  const serialized = canonicalStringify(observation);
  return deepFreeze({
    schemaVersion: GIT_VERIFIER_SCHEMA_VERSION,
    boundary: NOT_PRODUCTION_EVIDENCE,
    gate: 'PASS',
    status: 'FROZEN_STATE_MATCH',
    productionReady: false,
    productionReviewerWorkflowReady: false,
    mergeApproved: false,
    issue165: 'HOLD',
    observationSha256: sha256(Buffer.from(serialized, 'utf8')),
    observation: deepFreeze(structuredClone(observation))
  });
}

export async function observeCandidateReviewLiveState({
  observer,
  expected
}) {
  if (typeof observer !== 'function') fail('INJECTED_LIVE_OBSERVER_REQUIRED');
  let observation;
  try {
    observation = await observer(deepFreeze({
      boundary: NOT_PRODUCTION_EVIDENCE,
      networkImplementationProvided: false,
      requiredState:
        'EXACT_PR_HEAD_BASE_DRAFT_MERGE_CHECKS_POLICY_EXPIRY_AND_CONTROL_BINDINGS'
    }));
  } catch (error) {
    if (error instanceof CandidateReviewV2GitVerificationError) throw error;
    fail('INJECTED_LIVE_OBSERVER_FAILED');
  }
  if (expected === undefined) {
    fail('EXPECTED_FROZEN_STATE_REQUIRED');
  }
  return validateCandidateReviewFrozenObservation(observation, expected);
}

function gitExitCode(error) {
  return typeof error?.code === 'number' ? error.code : null;
}

async function runGit(repositoryRoot, args, {
  allowExitCodes = [0],
  encoding = 'utf8',
  maximumBytes = 2 * 1024 * 1024
} = {}) {
  try {
    return await execFile('git', args, {
      cwd: repositoryRoot,
      encoding: encoding === 'buffer' ? null : encoding,
      maxBuffer: maximumBytes,
      windowsHide: true
    });
  } catch (error) {
    if (allowExitCodes.includes(gitExitCode(error))) {
      return {
        stdout: error.stdout ?? (encoding === 'buffer' ? Buffer.alloc(0) : ''),
        stderr: error.stderr ?? (encoding === 'buffer' ? Buffer.alloc(0) : ''),
        exitCode: gitExitCode(error)
      };
    }
    fail('RAW_GIT_COMMAND_FAILED', { args });
  }
}

async function resolveRepositoryRoot(repositoryRoot) {
  if (typeof repositoryRoot !== 'string' || !path.isAbsolute(repositoryRoot)) {
    fail('ABSOLUTE_REPOSITORY_ROOT_REQUIRED');
  }
  let metadata;
  let canonicalRoot;
  try {
    metadata = await lstat(repositoryRoot);
    canonicalRoot = await realpath(repositoryRoot);
  } catch {
    fail('REPOSITORY_ROOT_NOT_FOUND');
  }
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    fail('REPOSITORY_ROOT_UNSAFE');
  }
  const topLevel = (await runGit(canonicalRoot, ['rev-parse', '--show-toplevel'])).stdout.trim();
  let canonicalGitRoot;
  try {
    canonicalGitRoot = await realpath(topLevel);
  } catch {
    fail('GIT_ROOT_NOT_FOUND');
  }
  if (canonicalGitRoot !== canonicalRoot) fail('GIT_ROOT_MISMATCH');
  return canonicalRoot;
}

function assertObjectId(value, label) {
  if (typeof value !== 'string' || !HEX_SHA_PATTERN.test(value)) {
    fail('GIT_OBJECT_ID_INVALID', { label });
  }
}

async function assertCommit(repositoryRoot, commit, label) {
  assertObjectId(commit, label);
  const result = await runGit(
    repositoryRoot,
    ['cat-file', '-t', commit],
    { allowExitCodes: [0, 128] }
  );
  if (result.exitCode === 128 || result.stdout.trim() !== 'commit') {
    fail('GIT_COMMIT_REQUIRED', { label });
  }
}

async function commitParents(repositoryRoot, commit) {
  const result = await runGit(repositoryRoot, ['rev-list', '--parents', '-n', '1', commit]);
  const fields = result.stdout.trim().split(' ');
  if (fields[0] !== commit) fail('GIT_COMMIT_RESOLUTION_DRIFT');
  return fields.slice(1);
}

function parseRawDiff(buffer) {
  const fields = buffer.toString('utf8').split('\0');
  if (fields.at(-1) === '') fields.pop();
  if (fields.length % 2 !== 0) fail('RAW_GIT_DIFF_INVALID');
  const entries = [];
  for (let index = 0; index < fields.length; index += 2) {
    const header = fields[index];
    const pathValue = fields[index + 1];
    const match = header.match(
      /^:([0-7]{6}) ([0-7]{6}) ([a-f0-9]{40,64}) ([a-f0-9]{40,64}) ([A-Z])$/u
    );
    if (!match || !pathValue || pathValue.includes('\n') || pathValue.includes('\0')) {
      fail('RAW_GIT_DIFF_INVALID');
    }
    entries.push({
      oldMode: match[1],
      newMode: match[2],
      oldObjectId: match[3],
      newObjectId: match[4],
      status: match[5],
      path: pathValue
    });
  }
  return entries;
}

async function rawDiff(repositoryRoot, fromCommit, toCommit) {
  const result = await runGit(
    repositoryRoot,
    [
      'diff-tree',
      '--no-commit-id',
      '-r',
      '--raw',
      '-z',
      '--no-renames',
      fromCommit,
      toCommit
    ],
    { encoding: 'buffer' }
  );
  return parseRawDiff(result.stdout);
}

function assertAggregateDiff(entries, aggregatePath) {
  if (entries.length !== 1 || entries[0].path !== aggregatePath) {
    fail('AGGREGATE_COMMIT_PATH_DIFF_INVALID');
  }
  const entry = entries[0];
  const added = entry.status === 'A'
    && entry.oldMode === '000000'
    && entry.newMode === '100644';
  const modified = entry.status === 'M'
    && entry.oldMode === '100644'
    && entry.newMode === '100644';
  if (!added && !modified) fail('AGGREGATE_COMMIT_RAW_DIFF_INVALID');
}

function assertReceiptDiff(entries, receiptPath) {
  if (entries.length !== 1
    || entries[0].path !== receiptPath
    || entries[0].status !== 'A'
    || entries[0].oldMode !== '000000'
    || entries[0].newMode !== '100644') {
    fail('RECEIPT_COMMIT_RAW_DIFF_INVALID');
  }
}

async function pathAbsentAtCommit(repositoryRoot, commit, relativePath) {
  const result = await runGit(
    repositoryRoot,
    ['cat-file', '-e', `${commit}:${relativePath}`],
    { allowExitCodes: [0, 128] }
  );
  return result.exitCode === 128;
}

async function readTreeBlob(repositoryRoot, commit, relativePath) {
  const tree = await runGit(
    repositoryRoot,
    ['ls-tree', '-z', commit, '--', relativePath],
    { encoding: 'buffer' }
  );
  const text = tree.stdout.toString('utf8');
  const match = text.match(
    /^([0-7]{6}) blob ([a-f0-9]{40,64})\t([^\0]+)\0$/u
  );
  if (!match || match[3] !== relativePath || match[1] !== '100644') {
    fail('EXPECTED_REGULAR_GIT_BLOB_REQUIRED', { relativePath, commit });
  }
  const bytesResult = await runGit(
    repositoryRoot,
    ['cat-file', 'blob', match[2]],
    { encoding: 'buffer', maximumBytes: 1024 * 1024 }
  );
  return {
    mode: match[1],
    objectId: match[2],
    bytes: bytesResult.stdout,
    byteSha256: sha256(bytesResult.stdout)
  };
}

function assertInteger(value, minimum, maximum, label) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    fail('AGGREGATE_INTEGER_OUT_OF_BOUNDS', { label });
  }
}

function assertNullableRate(value, label) {
  if (value !== null) assertInteger(value, 0, 10_000, label);
}

function assertNullableMedian(value, minimum, maximum, label) {
  if (value === null) return;
  if (typeof value !== 'number'
    || !Number.isFinite(value)
    || value < minimum
    || value > maximum
    || value * 2 !== Math.trunc(value * 2)) {
    fail('AGGREGATE_MEDIAN_OUT_OF_BOUNDS', { label });
  }
}

function assertHash(value, label) {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) {
    fail('AGGREGATE_HASH_INVALID', { label });
  }
}

function validateFamilyCounts(value, label) {
  assertExactKeys(
    value,
    ['medium_voltage_switchgear', 'transformer'],
    'AGGREGATE_FAMILY_COUNT_KEYS_INVALID'
  );
  assertInteger(value.medium_voltage_switchgear, 0, 35, `${label}.medium_voltage_switchgear`);
  assertInteger(value.transformer, 0, 35, `${label}.transformer`);
}

function validateAggregateMetrics(metrics) {
  assertExactKeys(metrics, [
    'reviewedSuggestionPrecisionBasisPoints',
    'populationApprovalRateBasisPoints',
    'decisionAgreementRateBasisPoints',
    'patchSuitabilityRateBasisPoints',
    'primaryMedianReviewDurationSeconds',
    'secondaryMedianReviewDurationSeconds',
    'primaryMedianEvidenceTraceabilityUsefulness',
    'secondaryMedianEvidenceTraceabilityUsefulness',
    'primaryMedianStructuredDecisionUsefulness',
    'secondaryMedianStructuredDecisionUsefulness',
    'secondaryMedianPatchAssessmentUsefulness',
    'byFamily'
  ], 'AGGREGATE_METRIC_KEYS_INVALID');
  for (const key of [
    'reviewedSuggestionPrecisionBasisPoints',
    'populationApprovalRateBasisPoints',
    'decisionAgreementRateBasisPoints',
    'patchSuitabilityRateBasisPoints'
  ]) {
    assertNullableRate(metrics[key], `metrics.${key}`);
  }
  for (const key of [
    'primaryMedianReviewDurationSeconds',
    'secondaryMedianReviewDurationSeconds'
  ]) {
    assertNullableMedian(metrics[key], 1, 7_200, `metrics.${key}`);
  }
  for (const key of [
    'primaryMedianEvidenceTraceabilityUsefulness',
    'secondaryMedianEvidenceTraceabilityUsefulness',
    'primaryMedianStructuredDecisionUsefulness',
    'secondaryMedianStructuredDecisionUsefulness',
    'secondaryMedianPatchAssessmentUsefulness'
  ]) {
    assertNullableMedian(metrics[key], 1, 5, `metrics.${key}`);
  }
  assertExactKeys(
    metrics.byFamily,
    ['medium_voltage_switchgear', 'transformer'],
    'AGGREGATE_FAMILY_METRIC_KEYS_INVALID'
  );
  for (const family of ['medium_voltage_switchgear', 'transformer']) {
    assertExactKeys(
      metrics.byFamily[family],
      [
        'reviewedSuggestionPrecisionBasisPoints',
        'populationApprovalRateBasisPoints'
      ],
      'AGGREGATE_FAMILY_METRIC_KEYS_INVALID'
    );
    assertNullableRate(
      metrics.byFamily[family].reviewedSuggestionPrecisionBasisPoints,
      `metrics.byFamily.${family}.reviewedSuggestionPrecisionBasisPoints`
    );
    assertNullableRate(
      metrics.byFamily[family].populationApprovalRateBasisPoints,
      `metrics.byFamily.${family}.populationApprovalRateBasisPoints`
    );
  }
}

export function validateCandidateReviewAggregate(value) {
  assertExactKeys(value, AGGREGATE_KEYS, 'AGGREGATE_KEYS_INVALID');
  try {
    assertCandidateReviewLeakageSafe(value);
  } catch (error) {
    fail('AGGREGATE_LEAKAGE_REFUSED', {
      causeCode: typeof error?.code === 'string' ? error.code : 'UNKNOWN'
    });
  }
  if (value.schemaVersion !== AGGREGATE_SCHEMA_VERSION
    || value.boundary !== NOT_PRODUCTION_EVIDENCE
    || value.productionReady !== false
    || value.productionReviewerWorkflowReady !== false
    || value.repositoryReviewRequired !== true
    || value.automaticVerification !== false
    || value.customerUseAllowed !== false
    || value.proofExecutionApproved !== false
    || value.issue165 !== 'HOLD'
    || !['PASS', 'HOLD', 'INCOMPLETE'].includes(value.gateResult)) {
    fail('AGGREGATE_NON_PRODUCTION_BOUNDARY_REQUIRED');
  }
  assertExactKeys(
    value.control,
    ['branch', 'baseCommit', 'aggregatePath', 'evaluatedOn'],
    'AGGREGATE_CONTROL_KEYS_INVALID'
  );
  if (!SAFE_BRANCH_PATTERN.test(value.control.branch)
    || !HEX_SHA_PATTERN.test(value.control.baseCommit)
    || value.control.aggregatePath !== CANDIDATE_REVIEW_V2_PATHS.aggregate
    || !ISO_DATE_PATTERN.test(value.control.evaluatedOn)
    || Number.isNaN(Date.parse(`${value.control.evaluatedOn}T00:00:00Z`))) {
    fail('AGGREGATE_CONTROL_BINDING_INVALID');
  }
  assertExactKeys(value.evaluated, [
    'pr206Head',
    'pr207Base',
    'pr207Head',
    'policyMarker',
    'policyExpiresAt'
  ], 'AGGREGATE_EVALUATED_KEYS_INVALID');
  for (const key of ['pr206Head', 'pr207Base', 'pr207Head']) {
    assertObjectId(value.evaluated[key], `evaluated.${key}`);
  }
  if (value.evaluated.policyMarker !== 'LOCAL_OPERATOR_DISPLAY_ONLY'
    || !ISO_TIMESTAMP_PATTERN.test(value.evaluated.policyExpiresAt)
    || !Number.isFinite(Date.parse(value.evaluated.policyExpiresAt))) {
    fail('AGGREGATE_POLICY_BINDING_INVALID');
  }
  const hashKeys = [
    'sourceManifestSha256',
    'documentDecisionSha256',
    'fidelityDecisionSha256',
    'populationSha256',
    'primaryRoleLedgerSha256',
    'secondaryRoleLedgerSha256',
    'finalLedgerSha256',
    'patchSetSha256',
    'roundManifestSha256'
  ];
  assertExactKeys(value.hashes, hashKeys, 'AGGREGATE_HASH_KEYS_INVALID');
  for (const key of hashKeys) assertHash(value.hashes[key], `hashes.${key}`);
  if (value.restackCommitments !== null) {
    assertExactKeys(value.restackCommitments, [
      'proposedRestackSha256',
      'equivalenceVerifierSha256',
      'ownerRebindSha256'
    ], 'AGGREGATE_RESTACK_KEYS_INVALID');
    for (const [key, digest] of Object.entries(value.restackCommitments)) {
      assertHash(digest, `restackCommitments.${key}`);
    }
  }

  assertExactKeys(value.counts, [
    'populationTotal',
    'populationByFamily',
    'approvedByFamily',
    'outcomes',
    'provisionalTechnicalApprovals',
    'humanRejectedFalsePositiveCount',
    'policyRestrictedRejectCount',
    'decisionAgreementCount',
    'patchSuitableCount',
    'leakageCount',
    'unresolvedP0P1FindingCount'
  ], 'AGGREGATE_COUNT_KEYS_INVALID');
  const counts = value.counts;
  assertInteger(counts.populationTotal, 30, 35, 'counts.populationTotal');
  validateFamilyCounts(counts.populationByFamily, 'counts.populationByFamily');
  validateFamilyCounts(counts.approvedByFamily, 'counts.approvedByFamily');
  if (counts.populationByFamily.medium_voltage_switchgear
      + counts.populationByFamily.transformer !== counts.populationTotal) {
    fail('AGGREGATE_FAMILY_POPULATION_SUM_INVALID');
  }
  for (const family of ['medium_voltage_switchgear', 'transformer']) {
    if (counts.approvedByFamily[family] > counts.populationByFamily[family]) {
      fail('AGGREGATE_FAMILY_APPROVAL_COUNT_INVALID');
    }
  }
  assertExactKeys(
    counts.outcomes,
    ['approved', 'rejected', 'held', 'conflicted', 'terminologyGapHeld'],
    'AGGREGATE_OUTCOME_KEYS_INVALID'
  );
  for (const [key, count] of Object.entries(counts.outcomes)) {
    assertInteger(count, 0, counts.populationTotal, `counts.outcomes.${key}`);
  }
  if (counts.outcomes.approved
      + counts.outcomes.rejected
      + counts.outcomes.held
      + counts.outcomes.conflicted !== counts.populationTotal
    || counts.outcomes.terminologyGapHeld > counts.outcomes.held
    || counts.approvedByFamily.medium_voltage_switchgear
      + counts.approvedByFamily.transformer !== counts.outcomes.approved) {
    fail('AGGREGATE_OUTCOME_SUM_INVALID');
  }
  for (const key of [
    'provisionalTechnicalApprovals',
    'humanRejectedFalsePositiveCount',
    'policyRestrictedRejectCount',
    'decisionAgreementCount',
    'patchSuitableCount'
  ]) {
    assertInteger(counts[key], 0, counts.populationTotal, `counts.${key}`);
  }
  if (counts.humanRejectedFalsePositiveCount
      + counts.policyRestrictedRejectCount !== counts.outcomes.rejected
    || counts.patchSuitableCount !== counts.outcomes.approved
    || counts.patchSuitableCount > counts.provisionalTechnicalApprovals) {
    fail('AGGREGATE_DERIVED_COUNT_INVALID');
  }
  assertInteger(counts.leakageCount, 0, 10_000, 'counts.leakageCount');
  assertInteger(
    counts.unresolvedP0P1FindingCount,
    0,
    10_000,
    'counts.unresolvedP0P1FindingCount'
  );
  validateAggregateMetrics(value.metrics);
  const precisionDenominator = counts.provisionalTechnicalApprovals
    + counts.humanRejectedFalsePositiveCount;
  const expectedPrecision = precisionDenominator === 0
    ? null
    : Math.floor(
      10_000 * counts.provisionalTechnicalApprovals / precisionDenominator
    );
  const expectedApprovalRate = Math.floor(
    10_000 * counts.outcomes.approved / counts.populationTotal
  );
  const expectedAgreementRate = Math.floor(
    10_000 * counts.decisionAgreementCount / counts.populationTotal
  );
  const expectedPatchRate = counts.provisionalTechnicalApprovals === 0
    ? null
    : Math.floor(
      10_000 * counts.patchSuitableCount
        / counts.provisionalTechnicalApprovals
    );
  if (value.metrics.reviewedSuggestionPrecisionBasisPoints !== expectedPrecision
    || value.metrics.populationApprovalRateBasisPoints !== expectedApprovalRate
    || (value.metrics.decisionAgreementRateBasisPoints !== null
      && value.metrics.decisionAgreementRateBasisPoints !== expectedAgreementRate)
    || value.metrics.patchSuitabilityRateBasisPoints !== expectedPatchRate) {
    fail('AGGREGATE_METRIC_ARITHMETIC_INVALID');
  }
  for (const family of ['medium_voltage_switchgear', 'transformer']) {
    const expectedFamilyApprovalRate = Math.floor(
      10_000 * counts.approvedByFamily[family]
        / counts.populationByFamily[family]
    );
    if (value.metrics.byFamily[family].populationApprovalRateBasisPoints
      !== expectedFamilyApprovalRate) {
      fail('AGGREGATE_FAMILY_METRIC_ARITHMETIC_INVALID', { family });
    }
  }
  if (value.gateResult === 'PASS'
    && (
      counts.outcomes.approved < 25
      || counts.approvedByFamily.medium_voltage_switchgear < 10
      || counts.approvedByFamily.transformer < 10
      || expectedPrecision === null
      || expectedPrecision < 8_000
      || counts.outcomes.conflicted !== 0
      || counts.outcomes.terminologyGapHeld !== 0
      || counts.patchSuitableCount !== counts.outcomes.approved
      || counts.leakageCount !== 0
      || counts.unresolvedP0P1FindingCount !== 0
      || value.metrics.decisionAgreementRateBasisPoints !== expectedAgreementRate
    )) {
    fail('AGGREGATE_PASS_GATE_INCONSISTENT');
  }
  assertExactKeys(value.nonClaims, [
    'mergeApproved',
    'canonicalClaimApproved',
    'customerUseAllowed',
    'tenderMatrixReady',
    'productionProofApproved'
  ], 'AGGREGATE_NON_CLAIM_KEYS_INVALID');
  if (Object.values(value.nonClaims).some((entry) => entry !== false)) {
    fail('AGGREGATE_NON_CLAIM_MUST_BE_FALSE');
  }
  return deepFreeze(structuredClone(value));
}

function validateAggregate(
  value,
  aggregateBytes,
  {
    aggregateCommit,
    controlBase,
    aggregatePath,
    receiptPath
  }
) {
  validateCandidateReviewAggregate(value);
  if (value.control.baseCommit !== controlBase
    || value.control.aggregatePath !== aggregatePath) {
    fail('AGGREGATE_CONTROL_BINDING_INVALID');
  }
  const text = aggregateBytes.toString('utf8');
  if (text.includes(aggregateCommit) || text.includes(receiptPath)) {
    fail('AGGREGATE_SELF_OR_RECEIPT_REFERENCE_REFUSED');
  }
}

function validateReceipt(
  receipt,
  receiptBytes,
  {
    controlBase,
    aggregateCommit,
    receiptCommit,
    aggregatePath,
    aggregateBlob,
    aggregate
  }
) {
  assertExactKeys(receipt, RECEIPT_KEYS, 'AGGREGATE_RECEIPT_KEYS_INVALID');
  if (receipt.schemaVersion !== RECEIPT_SCHEMA_VERSION
    || receipt.boundary !== NOT_PRODUCTION_EVIDENCE
    || receipt.productionReady !== false
    || typeof receipt.controlBranch !== 'string'
    || !SAFE_BRANCH_PATTERN.test(receipt.controlBranch)
    || receipt.controlBranch !== aggregate.control.branch
    || receipt.controlBase !== controlBase
    || receipt.aggregatePath !== aggregatePath
    || receipt.aggregateCommit !== aggregateCommit
    || receipt.aggregateGitBlobObjectId !== aggregateBlob.objectId
    || receipt.aggregateByteSha256 !== aggregateBlob.byteSha256) {
    fail('AGGREGATE_RECEIPT_BINDING_INVALID');
  }
  if (receiptBytes.toString('utf8').includes(receiptCommit)) {
    fail('RECEIPT_COMMIT_B_SELF_REFERENCE_REFUSED');
  }
}

export async function observeCandidateReviewGitStateRaw({
  repositoryRoot,
  commits = []
}) {
  const canonicalRoot = await resolveRepositoryRoot(repositoryRoot);
  if (!Array.isArray(commits) || commits.length > 16) {
    fail('RAW_GIT_COMMIT_SET_INVALID');
  }
  const observations = [];
  for (const [index, commit] of commits.entries()) {
    await assertCommit(canonicalRoot, commit, `commits[${index}]`);
    observations.push({
      commit,
      parents: await commitParents(canonicalRoot, commit)
    });
  }
  const head = (await runGit(canonicalRoot, ['rev-parse', 'HEAD'])).stdout.trim();
  return deepFreeze({
    schemaVersion: GIT_VERIFIER_SCHEMA_VERSION,
    boundary: NOT_PRODUCTION_EVIDENCE,
    gate: 'READ_ONLY_LOCAL_GIT_OBSERVATION',
    productionReady: false,
    repositoryRoot: canonicalRoot,
    head,
    commits: observations
  });
}

export async function verifyAggregateReceiptChain({
  repositoryRoot,
  controlBase,
  aggregateCommit,
  receiptCommit,
  evaluatedTip,
  aggregatePath = CANDIDATE_REVIEW_V2_PATHS.aggregate,
  receiptPath = CANDIDATE_REVIEW_V2_PATHS.aggregateReceipt
}) {
  if (aggregatePath !== CANDIDATE_REVIEW_V2_PATHS.aggregate
    || receiptPath !== CANDIDATE_REVIEW_V2_PATHS.aggregateReceipt) {
    fail('AGGREGATE_FIXED_PATH_REQUIRED');
  }
  const canonicalRoot = await resolveRepositoryRoot(repositoryRoot);
  for (const [label, commit] of Object.entries({
    controlBase,
    aggregateCommit,
    receiptCommit,
    evaluatedTip
  })) {
    await assertCommit(canonicalRoot, commit, label);
  }

  const aggregateParents = await commitParents(canonicalRoot, aggregateCommit);
  const receiptParents = await commitParents(canonicalRoot, receiptCommit);
  if (aggregateParents.length !== 1 || aggregateParents[0] !== controlBase) {
    fail('AGGREGATE_COMMIT_PARENT_INVALID');
  }
  if (receiptParents.length !== 1 || receiptParents[0] !== aggregateCommit) {
    fail('RECEIPT_COMMIT_PARENT_INVALID');
  }

  const aggregateDiff = await rawDiff(canonicalRoot, controlBase, aggregateCommit);
  const receiptDiff = await rawDiff(canonicalRoot, aggregateCommit, receiptCommit);
  assertAggregateDiff(aggregateDiff, aggregatePath);
  assertReceiptDiff(receiptDiff, receiptPath);
  if (!await pathAbsentAtCommit(canonicalRoot, aggregateCommit, receiptPath)) {
    fail('RECEIPT_PATH_PRESENT_IN_AGGREGATE_COMMIT');
  }

  const ancestor = await runGit(
    canonicalRoot,
    ['merge-base', '--is-ancestor', receiptCommit, evaluatedTip],
    { allowExitCodes: [0, 1] }
  );
  if (ancestor.exitCode === 1) fail('RECEIPT_COMMIT_NOT_ANCESTOR_OF_TIP');

  const aggregateAtA = await readTreeBlob(canonicalRoot, aggregateCommit, aggregatePath);
  const aggregateAtB = await readTreeBlob(canonicalRoot, receiptCommit, aggregatePath);
  const receiptAtB = await readTreeBlob(canonicalRoot, receiptCommit, receiptPath);
  const aggregateAtTip = await readTreeBlob(canonicalRoot, evaluatedTip, aggregatePath);
  const receiptAtTip = await readTreeBlob(canonicalRoot, evaluatedTip, receiptPath);
  if (aggregateAtA.objectId !== aggregateAtB.objectId
    || aggregateAtA.byteSha256 !== aggregateAtB.byteSha256
    || aggregateAtB.objectId !== aggregateAtTip.objectId
    || aggregateAtB.byteSha256 !== aggregateAtTip.byteSha256
    || receiptAtB.objectId !== receiptAtTip.objectId
    || receiptAtB.byteSha256 !== receiptAtTip.byteSha256) {
    fail('AGGREGATE_OR_RECEIPT_TIP_BLOB_DRIFT');
  }

  let aggregate;
  let receipt;
  try {
    aggregate = parseStrictCandidateReviewJson(
      new TextDecoder('utf-8', { fatal: true }).decode(aggregateAtA.bytes)
    );
    receipt = parseStrictCandidateReviewJson(
      new TextDecoder('utf-8', { fatal: true }).decode(receiptAtB.bytes)
    );
  } catch (error) {
    if (error instanceof CandidateReviewV2GitVerificationError) throw error;
    fail('AGGREGATE_OR_RECEIPT_JSON_INVALID');
  }
  validateAggregate(
    aggregate,
    aggregateAtA.bytes,
    {
      aggregateCommit,
      controlBase,
      aggregatePath,
      receiptPath
    }
  );
  validateReceipt(receipt, receiptAtB.bytes, {
    controlBase,
    aggregateCommit,
    receiptCommit,
    aggregatePath,
    aggregateBlob: aggregateAtA,
    aggregate
  });
  const branchTip = await runGit(
    canonicalRoot,
    ['rev-parse', '--verify', `refs/heads/${receipt.controlBranch}`],
    { allowExitCodes: [0, 128] }
  );
  if (branchTip.exitCode === 128 || branchTip.stdout.trim() !== evaluatedTip) {
    fail('EVALUATED_CONTROL_BRANCH_TIP_MISMATCH');
  }

  return deepFreeze({
    schemaVersion: GIT_VERIFIER_SCHEMA_VERSION,
    boundary: NOT_PRODUCTION_EVIDENCE,
    gate: 'PASS',
    status: 'AGGREGATE_RECEIPT_CHAIN_VERIFIED',
    productionReady: false,
    productionReviewerWorkflowReady: false,
    proofExecutionApproved: false,
    mergeApproved: false,
    issue165: 'HOLD',
    repositoryRoot: canonicalRoot,
    controlBase,
    aggregateCommit,
    receiptCommit,
    evaluatedTip,
    controlBranch: receipt.controlBranch,
    aggregate: {
      path: aggregatePath,
      mode: aggregateAtA.mode,
      gitBlobObjectId: aggregateAtA.objectId,
      byteSha256: aggregateAtA.byteSha256
    },
    receipt: {
      path: receiptPath,
      mode: receiptAtB.mode,
      gitBlobObjectId: receiptAtB.objectId,
      byteSha256: receiptAtB.byteSha256
    },
    exactParentChain: true,
    exactRawPathDiffs: true,
    tipBlobIdentity: true,
    preRestackRebindVerified: false,
    preRestackRebindStatus: 'SEPARATE_EVIDENCE_REQUIRED'
  });
}

const PRE_RESTACK_REQUIRED_TRUE_FIELDS = Object.freeze([
  'oldBaseIsMergeBase',
  'oldBaseAncestorOfOldHead',
  'orderedCommitListComplete',
  'proposedLinearReplay',
  'firstReplayParentEqualsMergedBase',
  'mergeCommitsAbsent',
  'addedCommitsAbsent',
  'omittedCommitsAbsent',
  'mergedBaseAncestorOfProposedTip',
  'mergeBaseEqualsMergedBase',
  'rangeDiffOneToOne',
  'pathManifestsMatch',
  'outsideOldRangePathsAbsent',
  'expectedTreeMatchesProposedTree',
  'fullTreeDiffEmpty',
  'ledgerCanonicalEquivalent',
  'ownerRebindExactValuesMatch',
  'liveHeadStillOldHead',
  'readOnlyVerification'
]);

export function validateCandidateReviewPreRestackRebind({
  observation,
  expected
} = {}) {
  if (observation === undefined) {
    fail('PRE_RESTACK_EQUIVALENCE_UNSUPPORTED_HOLD');
  }
  assertPlainObject(observation, 'PRE_RESTACK_OBSERVATION_REQUIRED');
  if (expected === undefined) fail('PRE_RESTACK_EXPECTED_BINDINGS_REQUIRED');
  validateCandidateReviewFrozenObservation(observation, expected);
  for (const key of ['oldBase', 'oldHead', 'mergedBase', 'proposedTip', 'expectedTreeCommit']) {
    assertObjectId(observation[key], key);
  }
  for (const key of PRE_RESTACK_REQUIRED_TRUE_FIELDS) {
    if (observation[key] !== true) {
      fail('PRE_RESTACK_EQUIVALENCE_HOLD', { key });
    }
  }
  if (!Array.isArray(observation.conflictAllowlist)
    || observation.conflictAllowlist.some((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return true;
      return typeof entry.path !== 'string'
        || path.posix.isAbsolute(entry.path)
        || path.posix.normalize(entry.path) !== entry.path
        || entry.path.split('/').some((segment) =>
          !segment || segment === '.' || segment === '..');
    })) {
    fail('PRE_RESTACK_CONFLICT_ALLOWLIST_INVALID');
  }
  return deepFreeze({
    schemaVersion: GIT_VERIFIER_SCHEMA_VERSION,
    boundary: NOT_PRODUCTION_EVIDENCE,
    gate: 'HOLD',
    status: 'STRUCTURED_OBSERVATION_MATCH_ONLY',
    productionReady: false,
    mergeApproved: false,
    liveHeadMoveApproved: false,
    preRestackRebindVerified: false,
    rawGitRangeTreePathEvidenceVerified: false,
    issue165: 'HOLD',
    observationSha256: sha256(
      Buffer.from(canonicalStringify(observation), 'utf8')
    )
  });
}

export const CANDIDATE_REVIEW_V2_AGGREGATE_RECEIPT_KEYS = RECEIPT_KEYS;
export const CANDIDATE_REVIEW_V2_AGGREGATE_RECEIPT_SCHEMA_VERSION =
  RECEIPT_SCHEMA_VERSION;
export const CANDIDATE_REVIEW_V2_AGGREGATE_KEYS = AGGREGATE_KEYS;
export const CANDIDATE_REVIEW_V2_AGGREGATE_SCHEMA_VERSION =
  AGGREGATE_SCHEMA_VERSION;
