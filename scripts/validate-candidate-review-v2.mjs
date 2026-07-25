#!/usr/bin/env node

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonicalStringify } from '../knowledge/claim-registry/index.mjs';
import {
  validateCandidateReviewRoleSubmission
} from '../evidence-claim-workbench/domain/candidate-review-v2.mjs';
import {
  CANDIDATE_REVIEW_V2_PATHS,
  assertCandidateReviewPathsIgnored,
  loadCandidateReviewPackage,
  readBoundedCandidateReviewJson
} from './lib/candidate-review-v2-files.mjs';
import {
  createSyntheticCandidateReviewV2BlankRound
} from './evaluate-candidate-review-v2.mjs';
import {
  buildSyntheticCandidateReviewV2BlankRoundRecord
} from './prepare-candidate-review-v2.mjs';

const REPOSITORY_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
export const CANDIDATE_REVIEW_V2_VALIDATE_SCHEMA_VERSION =
  'pr207-candidate-review-v2-blank-validate-v1';

export function parseCandidateReviewV2ValidateArguments(argv) {
  if (!Array.isArray(argv) || argv.length !== 0) {
    throw new Error('CANDIDATE_REVIEW_V2_VALIDATE_ARGUMENT_REFUSED');
  }
  return Object.freeze({});
}

function assertCanonicalEqual(actual, expected, code) {
  if (canonicalStringify(actual) !== canonicalStringify(expected)) {
    const error = new Error(code);
    error.code = code;
    throw error;
  }
}

export async function runCandidateReviewV2Validate({
  repositoryRoot = REPOSITORY_ROOT,
  accessProbe
} = {}) {
  const blankRound = createSyntheticCandidateReviewV2BlankRound();
  const expectedRound = buildSyntheticCandidateReviewV2BlankRoundRecord(blankRound);
  await assertCandidateReviewPathsIgnored({ repositoryRoot });
  const [roundFile, primaryFile, secondaryFile] = await Promise.all([
    readBoundedCandidateReviewJson({
      repositoryRoot,
      relativePath: CANDIDATE_REVIEW_V2_PATHS.round,
      expectedMode: 0o600
    }),
    readBoundedCandidateReviewJson({
      repositoryRoot,
      relativePath: CANDIDATE_REVIEW_V2_PATHS.primarySubmission,
      expectedMode: 0o600
    }),
    readBoundedCandidateReviewJson({
      repositoryRoot,
      relativePath: CANDIDATE_REVIEW_V2_PATHS.secondarySubmission,
      expectedMode: 0o600
    })
  ]);
  assertCanonicalEqual(
    roundFile.value,
    expectedRound,
    'CANDIDATE_REVIEW_V2_ROUND_BINDING_MISMATCH'
  );

  const roleFiles = {
    PRIMARY_TECHNICAL_REVIEWER: primaryFile,
    SECONDARY_EVIDENCE_REVIEWER: secondaryFile
  };
  for (const [role, file] of Object.entries(roleFiles)) {
    const validated = validateCandidateReviewRoleSubmission(file.value, {
      population: blankRound.population,
      allowBlank: true
    });
    assertCanonicalEqual(
      validated,
      blankRound.roleSubmissions[role],
      `CANDIDATE_REVIEW_V2_${role}_BLANK_BINDING_MISMATCH`
    );
  }

  let packageObservation = null;
  let accessBlockCode = '';
  try {
    packageObservation = await loadCandidateReviewPackage({
      repositoryRoot,
      accessProbe
    });
  } catch (error) {
    accessBlockCode = typeof error?.code === 'string' ? error.code : 'PACKAGE_LOAD_REFUSED';
    if (accessBlockCode !== 'ACCESS_PROBE_REQUIRED'
      && accessBlockCode !== 'ACCESS_ISOLATION_HOLD') {
      throw error;
    }
  }

  return Object.freeze({
    schemaVersion: CANDIDATE_REVIEW_V2_VALIDATE_SCHEMA_VERSION,
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    productionReady: false,
    productionReviewerWorkflowReady: false,
    issue165Status: 'HOLD',
    status: 'INCOMPLETE',
    reason: 'BLANK_ROLE_ENVELOPES_NO_HUMAN_RESULTS',
    candidateReviewV2HumanGateStatus: 'INCOMPLETE',
    fixedFileCount: 3,
    candidateCount: blankRound.population.candidateCount,
    blankRoleEnvelopeCount: 2,
    humanDecisionRowCount: 0,
    humanReviewExecuted: false,
    accessIsolation: packageObservation?.accessIsolation || 'UNVERIFIED',
    packageStatus: packageObservation?.status || 'BLOCKED_ACCESS_PROBE_REQUIRED',
    accessBlockCode,
    nonClaims: [
      'Valid synthetic bindings and blank envelopes are not human review evidence.',
      'This command does not prove role separation, seal a submission, reconcile outcomes, or compute human metrics.',
      'No real input, network request, PR mutation, merge, or production action occurred.'
    ]
  });
}

function safeFailure(error) {
  const errorCode = typeof error?.code === 'string'
    && /^[A-Z][A-Z0-9_]{2,100}$/u.test(error.code)
    ? error.code
    : 'CANDIDATE_REVIEW_V2_VALIDATE_FAILED';
  return {
    schemaVersion: CANDIDATE_REVIEW_V2_VALIDATE_SCHEMA_VERSION,
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    productionReady: false,
    productionReviewerWorkflowReady: false,
    issue165Status: 'HOLD',
    status: 'INCOMPLETE',
    candidateReviewV2HumanGateStatus: 'INCOMPLETE',
    humanReviewExecuted: false,
    errorCode
  };
}

async function main() {
  try {
    parseCandidateReviewV2ValidateArguments(process.argv.slice(2));
    const result = await runCandidateReviewV2Validate();
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify(safeFailure(error))}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
