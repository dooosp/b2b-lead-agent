import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  CANDIDATE_REVIEW_SUBMISSION_AUTHORITY_STATUSES,
  validateCandidateReviewPatchSet
} from '../evidence-claim-workbench/domain/candidate-review-v2.mjs';
import {
  createSyntheticCandidateReviewV2Fixture
} from '../evidence-claim-workbench/fixtures/synthetic-candidate-review-v2.mjs';
import {
  createSyntheticCandidateReviewV2Scenario,
  evaluateCandidateReviewV2,
  parseCandidateReviewV2EvaluationArguments
} from '../scripts/evaluate-candidate-review-v2.mjs';
import {
  parseCandidateReviewV2PrepareArguments,
  runCandidateReviewV2Prepare
} from '../scripts/prepare-candidate-review-v2.mjs';
import {
  parseCandidateReviewV2ValidateArguments,
  runCandidateReviewV2Validate
} from '../scripts/validate-candidate-review-v2.mjs';
import {
  parseCandidateReviewV2AggregateReceiptArguments
} from '../scripts/verify-candidate-review-v2-aggregate-receipt.mjs';

const REPOSITORY_ROOT = fileURLToPath(new URL('..', import.meta.url));
const EVALUATOR = fileURLToPath(
  new URL('../scripts/evaluate-candidate-review-v2.mjs', import.meta.url)
);
const OPERATOR_CLIS = Object.freeze([
  {
    script: fileURLToPath(
      new URL('../scripts/prepare-candidate-review-v2.mjs', import.meta.url)
    ),
    errorCode: 'CANDIDATE_REVIEW_V2_PREPARE_FAILED'
  },
  {
    script: fileURLToPath(
      new URL('../scripts/validate-candidate-review-v2.mjs', import.meta.url)
    ),
    errorCode: 'CANDIDATE_REVIEW_V2_VALIDATE_FAILED'
  },
  {
    script: fileURLToPath(
      new URL(
        '../scripts/verify-candidate-review-v2-aggregate-receipt.mjs',
        import.meta.url
      )
    ),
    errorCode: 'CANDIDATE_REVIEW_V2_RECEIPT_VERIFICATION_FAILED'
  }
]);
const FIXTURE_SEMANTIC_SHA256 =
  '41c5a6f522d031b5c3a85643bcd035e4b846914a4908b74dda5bd70379741276';
const EVALUATION_CANONICAL_SHA256 =
  'dde45063ef9ac7cb2e46043852172b4416bb3ba5319f2719e856c977d4cba533';

async function createTemporaryRepository(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'candidate-review-v2-cli-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const init = spawnSync('git', ['init', '--initial-branch=control', root], {
    encoding: 'utf8'
  });
  assert.equal(init.status, 0, init.stderr);
  await writeFile(
    path.join(root, '.gitignore'),
    'tmp/evidence-claim-workbench/human-approval/\n',
    { encoding: 'utf8', mode: 0o600 }
  );
  return root;
}

test('synthetic Candidate Review v2 fixture is deterministic, bounded, and explicit about provenance', () => {
  const first = createSyntheticCandidateReviewV2Fixture();
  const second = createSyntheticCandidateReviewV2Fixture();

  assert.deepEqual(first, second);
  assert.equal(first.semanticSha256, FIXTURE_SEMANTIC_SHA256);
  assert.equal(first.boundary, 'NOT_PRODUCTION_EVIDENCE');
  assert.equal(first.productionReady, false);
  assert.equal(first.productionReviewerWorkflowReady, false);
  assert.equal(first.issue165Status, 'HOLD');
  assert.equal(first.humanReviewExecuted, false);
  assert.equal(first.humanReviewStatus, 'INCOMPLETE');
  assert.equal(first.externalHumanProvenanceVerified, false);
  assert.equal(first.externalCustodyVerified, false);
  assert.deepEqual(first.candidateReviewMethodBlockers, [
    'EXTERNAL_HUMAN_PROVENANCE_AND_CUSTODY_UNVERIFIED',
    'SYNTHETIC_FIXTURE_NOT_HUMAN_EVIDENCE'
  ]);
  assert.equal(first.candidateReviewMethodGatePassed, false);
  assert.equal(first.candidates.length, 32);
  assert.deepEqual(
    first.relationshipCaseTypes,
    [
      'CONDITION_RESOLVED',
      'EXACT_DUPLICATE_EVIDENCE',
      'MATERIAL_CONFLICT',
      'SUPERSEDES'
    ]
  );
  assert.ok(first.candidates.every((candidate) => candidate.synthetic === true));
  assert.ok(first.candidates.every(
    (candidate) => candidate.extractionMethod === 'DETERMINISTIC_RULE'
      && candidate.extractionRuleId
        === 'OECRW0-PC-SYNTHETIC-CANDIDATE-REVIEW-V2'
      && !candidate.extractionReasons.includes('HUMAN_SELECTED_EXACT_EVIDENCE')
  ));
});

test('threshold-pass simulation validates patches but cannot satisfy the human method gate', () => {
  const scenario = createSyntheticCandidateReviewV2Scenario('THRESHOLD_PASS');

  assert.equal(scenario.syntheticDecisionSimulation, true);
  assert.equal(scenario.humanReviewExecuted, false);
  assert.equal(scenario.candidateReviewV2HumanGateStatus, 'INCOMPLETE');
  assert.equal(scenario.externalHumanProvenanceVerified, false);
  assert.equal(scenario.externalCustodyVerified, false);
  assert.deepEqual(scenario.candidateReviewMethodBlockers, [
    'EXTERNAL_HUMAN_PROVENANCE_AND_CUSTODY_UNVERIFIED',
    'SYNTHETIC_FIXTURE_NOT_HUMAN_EVIDENCE'
  ]);
  assert.equal(scenario.candidateReviewMethodGatePassed, false);
  assert.equal(
    scenario.primarySubmission.submissionAuthorityStatus,
    CANDIDATE_REVIEW_SUBMISSION_AUTHORITY_STATUSES.synthetic
  );
  assert.equal(
    scenario.secondarySubmission.submissionAuthorityStatus,
    CANDIDATE_REVIEW_SUBMISSION_AUTHORITY_STATUSES.synthetic
  );
  assert.equal(
    scenario.primarySubmission.externalHumanProvenanceVerified,
    false
  );
  assert.equal(scenario.primarySubmission.externalCustodyVerified, false);
  assert.equal(
    scenario.secondarySubmission.externalHumanProvenanceVerified,
    false
  );
  assert.equal(scenario.secondarySubmission.externalCustodyVerified, false);
  assert.deepEqual(scenario.metrics.outcomeCounts, {
    approved: 29,
    rejected: 2,
    held: 1,
    conflicted: 0
  });
  assert.equal(scenario.metrics.reviewedSuggestionPrecisionBasisPoints, 9_354);
  assert.equal(scenario.metrics.patchSuitabilityRateBasisPoints, 10_000);
  assert.deepEqual(
    scenario.metrics.qualityFindingCounts,
    { p0: 0, p1: 0, synthetic: true }
  );
  assert.equal(scenario.metrics.unresolvedP0P1FindingCount, 0);
  assert.equal(scenario.metrics.gates.candidateReviewThresholdsPassed, true);
  assert.equal(scenario.metrics.gates.candidateReviewMethodGatePassed, false);
  assert.ok(scenario.patchSet);
  assert.equal(scenario.patchSet.prerequisiteMode, 'SYNTHETIC_FIXTURE_ONLY');
  assert.equal(scenario.patchSet.syntheticFixtureOnly, true);
  assert.equal(
    scenario.patchSet.realReviewPatchValidation,
    'NOT_APPLICABLE_SYNTHETIC_FIXTURE'
  );
  assert.deepEqual(scenario.patchSet.validatedReviewPatches, []);
  assert.deepEqual(scenario.patchSet.validatedReviewPatchBindings, []);
  assert.deepEqual(
    validateCandidateReviewPatchSet(
      scenario.patchSet,
      { population: scenario.population }
    ),
    scenario.patchSet
  );

  const tampered = structuredClone(scenario.patchSet);
  tampered.patchSetHash = '0'.repeat(64);
  assert.throws(
    () => validateCandidateReviewPatchSet(
      tampered,
      { population: scenario.population }
    ),
    (error) => error.code === 'PATCH_SET_HASH_MISMATCH'
  );
});

test('synthetic reconciliation exercises all four outcomes and conflict fail-closed behavior', () => {
  const scenario = createSyntheticCandidateReviewV2Scenario(
    'FOUR_OUTCOME_COVERAGE'
  );

  assert.deepEqual(scenario.metrics.outcomeCounts, {
    approved: 28,
    rejected: 2,
    held: 1,
    conflicted: 1
  });
  assert.equal(scenario.metrics.gates.noConflictsPassed, false);
  assert.equal(scenario.metrics.gates.candidateReviewThresholdsPassed, false);
  assert.equal(
    scenario.reconciliation.relationshipClosureReport.unresolvedCandidateIds.length,
    0
  );
  assert.deepEqual(
    [...new Set(
      scenario.reconciliation.finalOutcomes.map(({ outcome }) => outcome)
    )].sort(),
    ['APPROVED', 'CONFLICTED', 'HELD', 'REJECTED']
  );
});

test('precision uses inclusive floor-basis-point threshold and null denominators', () => {
  const exactBoundary = createSyntheticCandidateReviewV2Scenario(
    'PRECISION_AT_8000_BASIS_POINTS'
  );
  assert.equal(exactBoundary.metrics.provisionalTechnicalApprovalCount, 24);
  assert.equal(exactBoundary.metrics.humanRejectedFalsePositiveCount, 6);
  assert.equal(exactBoundary.metrics.precisionResolvedCount, 30);
  assert.equal(exactBoundary.metrics.reviewedSuggestionPrecisionBasisPoints, 8_000);
  assert.equal(exactBoundary.metrics.gates.precisionPassed, true);
  assert.equal(exactBoundary.metrics.gates.approvalCountPassed, false);

  const nullDenominators = createSyntheticCandidateReviewV2Scenario(
    'NULL_DENOMINATORS'
  );
  assert.equal(nullDenominators.metrics.provisionalTechnicalApprovalCount, 0);
  assert.equal(nullDenominators.metrics.precisionResolvedCount, 0);
  assert.equal(nullDenominators.metrics.reviewedSuggestionPrecisionBasisPoints, null);
  assert.equal(nullDenominators.metrics.patchSuitabilityRateBasisPoints, null);
  assert.equal(nullDenominators.metrics.gates.precisionPassed, false);
  assert.equal(nullDenominators.patchSet, null);
});

test('evaluator repeats canonically while human results stay absent', async () => {
  const report = await evaluateCandidateReviewV2({ repeat: 2 });

  assert.equal(report.syntheticEvaluationStatus, 'PASS');
  assert.equal(report.repeatedRunHashEquality, true);
  assert.equal(report.candidateReviewV2HumanGateStatus, 'INCOMPLETE');
  assert.equal(report.externalHumanProvenanceVerified, false);
  assert.equal(report.externalCustodyVerified, false);
  assert.deepEqual(report.candidateReviewMethodBlockers, [
    'EXTERNAL_HUMAN_PROVENANCE_AND_CUSTODY_UNVERIFIED',
    'SYNTHETIC_FIXTURE_NOT_HUMAN_EVIDENCE'
  ]);
  assert.equal(report.candidateReviewMethodGatePassed, false);
  assert.equal(report.population.prerequisiteMode, 'SYNTHETIC_FIXTURE_ONLY');
  assert.equal(report.population.realFidelityPrerequisitesSatisfied, false);
  assert.equal(report.population.section5BindingsComplete, false);
  assert.equal(report.population.externalHumanProvenanceVerified, false);
  assert.equal(report.population.externalCustodyVerified, false);
  assert.ok(report.blankRoleEnvelopes.every((entry) => (
    entry.submissionAuthorityStatus
      === CANDIDATE_REVIEW_SUBMISSION_AUTHORITY_STATUSES.pending
    && entry.externalHumanProvenanceVerified === false
    && entry.externalCustodyVerified === false
  )));
  assert.ok(Object.values(report.syntheticScenarioChecks).every((scenario) => (
    scenario.primarySubmissionAuthorityStatus
      === CANDIDATE_REVIEW_SUBMISSION_AUTHORITY_STATUSES.synthetic
    && scenario.secondarySubmissionAuthorityStatus
      === CANDIDATE_REVIEW_SUBMISSION_AUTHORITY_STATUSES.synthetic
    && scenario.externalHumanProvenanceVerified === false
    && scenario.externalCustodyVerified === false
    && scenario.candidateReviewMethodGatePassed === false
  )));
  assert.equal(report.blockedHumanOperations.humanResultRecorded, false);
  assert.equal(report.blockedHumanOperations.finalOutcomeCount, 0);
  assert.deepEqual(report.scenarioOutcomeCoverage, [
    'APPROVED',
    'CONFLICTED',
    'HELD',
    'REJECTED'
  ]);
  assert.deepEqual(report.zeroSideEffectObservations, {
    externalRequestCount: 0,
    persistenceWriteCount: 0,
    sourcePageTransmissionCount: 0,
    realInputReadCount: 0
  });
  assert.equal(report.canonicalSha256, EVALUATION_CANONICAL_SHA256);
});

test('all Candidate Review v2 CLIs reject arbitrary paths and operator inputs', () => {
  assert.deepEqual(
    parseCandidateReviewV2EvaluationArguments(['--json', '--repeat', '2']),
    { json: true, repeat: 2 }
  );
  for (const argv of [
    [],
    ['--json'],
    ['--repeat', '2'],
    ['--json', '--repeat', '1'],
    ['--json', '--repeat', '11'],
    ['--json', '--repeat', 'NaN'],
    ['--json', '--json', '--repeat', '2'],
    ['--json', '--repeat', '2', '--input', '/tmp/private.json']
  ]) {
    assert.throws(() => parseCandidateReviewV2EvaluationArguments(argv));
  }
  for (const parser of [
    parseCandidateReviewV2PrepareArguments,
    parseCandidateReviewV2ValidateArguments,
    parseCandidateReviewV2AggregateReceiptArguments
  ]) {
    assert.deepEqual(parser([]), {});
    assert.throws(() => parser(['/tmp/private.json']));
    assert.throws(() => parser(['--workspace', '/tmp/private']));
  }
});

test('fixed-path prepare and validate wrappers create only blank synthetic HOLD state', async (t) => {
  const repositoryRoot = await createTemporaryRepository(t);
  const prepared = await runCandidateReviewV2Prepare({ repositoryRoot });

  assert.equal(prepared.status, 'HOLD');
  assert.equal(prepared.reason, 'SYNTHETIC_BLANK_SKELETON_ONLY');
  assert.equal(prepared.candidateReviewV2HumanGateStatus, 'INCOMPLETE');
  assert.equal(prepared.humanReviewExecuted, false);
  assert.equal(prepared.humanDecisionRowCount, 0);
  assert.equal(prepared.accessIsolation, 'UNVERIFIED');
  assert.equal(prepared.roots.length, 3);
  assert.equal(prepared.files.length, 3);
  assert.ok(prepared.roots.every(({ mode }) => mode === '0700'));
  assert.ok(prepared.files.every(({ mode }) => mode === '0600'));

  const validated = await runCandidateReviewV2Validate({ repositoryRoot });
  assert.equal(validated.status, 'INCOMPLETE');
  assert.equal(validated.reason, 'BLANK_ROLE_ENVELOPES_NO_HUMAN_RESULTS');
  assert.equal(validated.candidateReviewV2HumanGateStatus, 'INCOMPLETE');
  assert.equal(validated.humanReviewExecuted, false);
  assert.equal(validated.humanDecisionRowCount, 0);
  assert.equal(validated.blankRoleEnvelopeCount, 2);
  assert.equal(validated.accessIsolation, 'UNVERIFIED');
  assert.equal(validated.packageStatus, 'BLOCKED_ACCESS_PROBE_REQUIRED');
  assert.equal(validated.accessBlockCode, 'ACCESS_PROBE_REQUIRED');
});

test('operator CLIs refuse all arguments before filesystem or Git work without leakage', () => {
  for (const { script, errorCode } of OPERATOR_CLIS) {
    const refusal = spawnSync(
      process.execPath,
      [script, '/tmp/private.json'],
      {
        cwd: REPOSITORY_ROOT,
        encoding: 'utf8',
        timeout: 10_000,
        maxBuffer: 64 * 1024
      }
    );
    assert.notEqual(refusal.status, 0);
    assert.equal(refusal.stderr, '');
    const report = JSON.parse(refusal.stdout);
    assert.equal(report.boundary, 'NOT_PRODUCTION_EVIDENCE');
    assert.equal(report.productionReady, false);
    assert.equal(report.issue165Status, 'HOLD');
    assert.equal(report.errorCode, errorCode);
    assert.doesNotMatch(
      refusal.stdout,
      /(?:\/tmp\/private|file:|at\s+\S+:\d+)/u
    );
  }
});

test('evaluator CLI emits bounded typed JSON and never leaks paths or stacks on refusal', () => {
  const success = spawnSync(
    process.execPath,
    [EVALUATOR, '--json', '--repeat', '2'],
    {
      cwd: REPOSITORY_ROOT,
      encoding: 'utf8',
      timeout: 30_000,
      maxBuffer: 512 * 1024
    }
  );
  assert.equal(success.status, 0, success.stderr);
  const report = JSON.parse(success.stdout);
  assert.equal(report.syntheticEvaluationStatus, 'PASS');
  assert.equal(report.candidateReviewV2HumanGateStatus, 'INCOMPLETE');

  const refusal = spawnSync(
    process.execPath,
    [EVALUATOR, '--json', '--repeat', '2', '--input', '/tmp/private.json'],
    {
      cwd: REPOSITORY_ROOT,
      encoding: 'utf8',
      timeout: 30_000,
      maxBuffer: 64 * 1024
    }
  );
  assert.notEqual(refusal.status, 0);
  assert.equal(refusal.stdout, '');
  const errorReport = JSON.parse(refusal.stderr);
  assert.deepEqual(errorReport, {
    schemaVersion: 'pr207-candidate-review-v2-synthetic-evaluation-v1',
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    productionReady: false,
    productionReviewerWorkflowReady: false,
    issue165Status: 'HOLD',
    syntheticEvaluationStatus: 'REFUSED',
    candidateReviewV2HumanGateStatus: 'INCOMPLETE',
    errorCode: 'CANDIDATE_REVIEW_V2_EVALUATION_FAILED'
  });
  assert.doesNotMatch(refusal.stderr, /(?:\/tmp\/|file:|at\s+\S+:\d+)/u);
});
