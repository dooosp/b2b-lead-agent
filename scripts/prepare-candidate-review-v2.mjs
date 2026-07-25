#!/usr/bin/env node

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { prepareBlankCandidateReviewRoots } from './lib/candidate-review-v2-files.mjs';
import {
  createSyntheticCandidateReviewV2BlankRound
} from './evaluate-candidate-review-v2.mjs';

const REPOSITORY_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
export const CANDIDATE_REVIEW_V2_PREPARE_SCHEMA_VERSION =
  'pr207-candidate-review-v2-blank-prepare-v1';

export function parseCandidateReviewV2PrepareArguments(argv) {
  if (!Array.isArray(argv) || argv.length !== 0) {
    throw new Error('CANDIDATE_REVIEW_V2_PREPARE_ARGUMENT_REFUSED');
  }
  return Object.freeze({});
}

export function buildSyntheticCandidateReviewV2BlankRoundRecord(blankRound) {
  const { fixture, population, roundId, assignmentHash } = blankRound;
  return Object.freeze({
    schemaVersion: 'pr207-candidate-review-v2-blank-round-v1',
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    productionReady: false,
    productionReviewerWorkflowReady: false,
    repositoryReviewRequired: true,
    automaticVerification: false,
    customerUseAllowed: false,
    proofExecutionApproved: false,
    issue165Status: 'HOLD',
    status: 'INCOMPLETE',
    synthetic: true,
    syntheticPrerequisiteBypass: 'SYNTHETIC_FIXTURE_ONLY',
    evaluatedPr207Head: fixture.evaluatedPr207Head,
    fixtureSemanticSha256: fixture.semanticSha256,
    roundId,
    populationHash: population.populationHash,
    prerequisiteHash: population.prerequisiteHash,
    assignmentHash,
    candidateCount: population.candidateCount,
    productFamilyCounts: population.productFamilyCounts,
    componentCount: population.components.length,
    relationshipCount: population.relationshipReport.relationships.length,
    roleSeparationAttested: false,
    primaryDecisions: [],
    secondaryDecisions: [],
    finalDecisions: [],
    patchAssessments: [],
    humanReviewExecuted: false,
    nonClaims: [
      'This fixed ignored record binds a synthetic population and blank role envelopes only.',
      'It is not a role-isolation result, human review result, merge approval, or production evidence.'
    ]
  });
}

export async function runCandidateReviewV2Prepare({
  repositoryRoot = REPOSITORY_ROOT
} = {}) {
  const blankRound = createSyntheticCandidateReviewV2BlankRound();
  const round = buildSyntheticCandidateReviewV2BlankRoundRecord(blankRound);
  const prepared = await prepareBlankCandidateReviewRoots({
    repositoryRoot,
    round
  });
  return Object.freeze({
    schemaVersion: CANDIDATE_REVIEW_V2_PREPARE_SCHEMA_VERSION,
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    productionReady: false,
    productionReviewerWorkflowReady: false,
    issue165Status: 'HOLD',
    status: 'HOLD',
    reason: 'SYNTHETIC_BLANK_SKELETON_ONLY',
    candidateReviewV2HumanGateStatus: 'INCOMPLETE',
    candidateCount: blankRound.population.candidateCount,
    humanReviewExecuted: false,
    humanDecisionRowCount: 0,
    accessIsolation: prepared.accessIsolation,
    roots: prepared.roots,
    files: prepared.files,
    nonClaims: [
      'Preparing blank files does not prove role isolation or create human review evidence.',
      'No real input, network request, PR mutation, merge, or production action occurred.'
    ]
  });
}

function safeFailure(error) {
  const errorCode = typeof error?.code === 'string'
    && /^[A-Z][A-Z0-9_]{2,100}$/u.test(error.code)
    ? error.code
    : 'CANDIDATE_REVIEW_V2_PREPARE_FAILED';
  return {
    schemaVersion: CANDIDATE_REVIEW_V2_PREPARE_SCHEMA_VERSION,
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    productionReady: false,
    productionReviewerWorkflowReady: false,
    issue165Status: 'HOLD',
    status: 'HOLD',
    candidateReviewV2HumanGateStatus: 'INCOMPLETE',
    humanReviewExecuted: false,
    errorCode
  };
}

async function main() {
  try {
    parseCandidateReviewV2PrepareArguments(process.argv.slice(2));
    const result = await runCandidateReviewV2Prepare();
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify(safeFailure(error))}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
