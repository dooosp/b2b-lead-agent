#!/usr/bin/env node

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonicalStringify, sha256 } from '../knowledge/claim-registry/index.mjs';
import {
  CANDIDATE_REVIEW_SUBMISSION_AUTHORITY_STATUSES,
  computeCandidateReviewAssignmentHash,
  computeCandidateReviewDecisionSetHash,
  computeCandidateReviewMetrics,
  computeCandidateReviewRoundId,
  createBlankCandidateReviewRoleSubmission,
  createCandidateReviewPatchSet,
  reconcileCandidateReviewRound,
  selectCandidateReviewPopulation,
  validateCandidateReviewPatchSet,
  validateCandidateReviewPopulation,
  validateCandidateReviewRoleSubmission
} from '../evidence-claim-workbench/domain/candidate-review-v2.mjs';
import { createReviewDecision } from '../evidence-claim-workbench/domain/review-decisions.mjs';
import {
  createSyntheticCandidateReviewV2Fixture
} from '../evidence-claim-workbench/fixtures/synthetic-candidate-review-v2.mjs';

export const CANDIDATE_REVIEW_V2_EVALUATION_SCHEMA_VERSION =
  'pr207-candidate-review-v2-synthetic-evaluation-v1';

export const CANDIDATE_REVIEW_V2_SYNTHETIC_SCENARIOS = Object.freeze([
  'THRESHOLD_PASS',
  'FOUR_OUTCOME_COVERAGE',
  'PRECISION_AT_8000_BASIS_POINTS',
  'NULL_DENOMINATORS'
]);

export const CANDIDATE_REVIEW_V2_EVALUATION_THRESHOLDS = Object.freeze({
  minimumCandidateCount: 30,
  maximumCandidateCount: 35,
  minimumCandidatesPerProductFamily: 10,
  minimumApprovedCandidates: 25,
  minimumReviewedSuggestionPrecisionBasisPoints: 8_000,
  requiredRelationshipTypes: Object.freeze([
    'CONDITION_RESOLVED',
    'EXACT_DUPLICATE_EVIDENCE',
    'MATERIAL_CONFLICT',
    'SUPERSEDES'
  ]),
  expectedHumanDecisionRows: 0,
  expectedSyntheticDecisionRowsPerScenario: 64,
  expectedExternalRequestCount: 0,
  expectedPersistenceWriteCount: 0
});

const ROLES = Object.freeze([
  'PRIMARY_TECHNICAL_REVIEWER',
  'SECONDARY_EVIDENCE_REVIEWER'
]);
const SYNTHETIC_REGISTRY_PATH =
  'knowledge/claim-registry/candidate-review-v2-synthetic.json';
const SYNTHETIC_METHOD_BLOCKERS = Object.freeze([
  'EXTERNAL_HUMAN_PROVENANCE_AND_CUSTODY_UNVERIFIED',
  'SYNTHETIC_FIXTURE_NOT_HUMAN_EVIDENCE'
]);

function compareAscii(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function countBy(values, key) {
  const counts = {};
  for (const value of values) {
    const name = key(value);
    counts[name] = (counts[name] || 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(counts).sort(([left], [right]) => compareAscii(left, right))
  );
}

function captureErrorCode(action) {
  try {
    action();
    return '';
  } catch (error) {
    return typeof error?.code === 'string' ? error.code : error?.name || 'UNKNOWN_ERROR';
  }
}

function clonePlan(plan) {
  return new Map([...plan.entries()].map(([candidateId, disposition]) => [
    candidateId,
    {
      ...disposition,
      reasonCodes: [...(disposition.reasonCodes || [])],
      relatedCandidateIds: [...(disposition.relatedCandidateIds || [])]
    }
  ]));
}

function innerDisposition(decision, reasonCodes, relatedCandidateIds = []) {
  return {
    type: 'INNER_DECISION',
    decision,
    reasonCodes,
    relatedCandidateIds
  };
}

function approvalDisposition(candidate) {
  return innerDisposition(
    'APPROVE_FOR_REPOSITORY_REVIEW',
    [
      'EVIDENCE_QUOTE_CONFIRMED',
      'STRUCTURED_MEANING_CONFIRMED',
      ...(candidate.applicability.conditions.length > 0 ? ['CONDITIONS_CONFIRMED'] : [])
    ]
  );
}

function createBaselinePlan(population) {
  const candidateById = new Map(
    population.candidates.map((candidate) => [candidate.candidateId, candidate])
  );
  const plan = new Map(
    population.candidates.map((candidate) => [
      candidate.candidateId,
      approvalDisposition(candidate)
    ])
  );

  for (const relationship of population.relationshipReport.relationships) {
    const candidateIds = [...relationship.candidateIds].sort(compareAscii);
    if (relationship.type === 'EXACT_DUPLICATE_EVIDENCE') {
      const [approvedCandidateId, rejectedCandidateId] = candidateIds;
      plan.set(approvedCandidateId, approvalDisposition(candidateById.get(approvedCandidateId)));
      plan.set(rejectedCandidateId, innerDisposition(
        'REJECT',
        ['DUPLICATE_CANDIDATE'],
        [approvedCandidateId]
      ));
      continue;
    }
    if (relationship.type === 'MATERIAL_CONFLICT') {
      const [approvedCandidateId, rejectedCandidateId] = candidateIds;
      plan.set(approvedCandidateId, approvalDisposition(candidateById.get(approvedCandidateId)));
      plan.set(rejectedCandidateId, innerDisposition(
        'REJECT',
        ['NOT_A_CAPABILITY'],
        [approvedCandidateId]
      ));
      continue;
    }
    if (relationship.type === 'SUPERSEDES') {
      plan.set(
        relationship.supersededCandidateId,
        innerDisposition(
          'FLAG_SUPERSEDED',
          ['SUPERSEDED_DOCUMENT'],
          [relationship.successorCandidateId]
        )
      );
      plan.set(
        relationship.successorCandidateId,
        approvalDisposition(candidateById.get(relationship.successorCandidateId))
      );
    }
  }
  return plan;
}

function independentCandidateIds(population) {
  const related = new Set(
    population.relationshipReport.relationships.flatMap(
      (relationship) => relationship.candidateIds
    )
  );
  return population.candidates
    .map((candidate) => candidate.candidateId)
    .filter((candidateId) => !related.has(candidateId))
    .sort(compareAscii);
}

function createScenarioPlans(scenario, population) {
  if (!CANDIDATE_REVIEW_V2_SYNTHETIC_SCENARIOS.includes(scenario)) {
    throw new Error('CANDIDATE_REVIEW_V2_SYNTHETIC_SCENARIO_REFUSED');
  }
  const baseline = createBaselinePlan(population);
  let primary = clonePlan(baseline);
  let secondary = clonePlan(baseline);
  const independent = independentCandidateIds(population);

  if (scenario === 'FOUR_OUTCOME_COVERAGE') {
    secondary.set(
      independent[0],
      innerDisposition('REJECT', ['NOT_A_CAPABILITY'])
    );
  } else if (scenario === 'PRECISION_AT_8000_BASIS_POINTS') {
    for (const candidateId of independent.slice(0, 4)) {
      const disposition = innerDisposition('REJECT', ['NOT_A_CAPABILITY']);
      primary.set(candidateId, disposition);
      secondary.set(candidateId, disposition);
    }
    const heldDisposition = innerDisposition('DEFER_MISSING_CONTEXT', ['REVISION_UNCLEAR']);
    primary.set(independent[4], heldDisposition);
    secondary.set(independent[4], heldDisposition);
  } else if (scenario === 'NULL_DENOMINATORS') {
    const outerHold = {
      type: 'OUTER_HOLD_TERMINOLOGY_GAP',
      reasonCode: 'OUTER_V2_TERMINOLOGY_GAP',
      reasonCodes: [],
      relatedCandidateIds: []
    };
    primary = new Map(
      population.candidates.map((candidate) => [candidate.candidateId, outerHold])
    );
    secondary = new Map(
      population.candidates.map((candidate) => [candidate.candidateId, outerHold])
    );
  }

  return { primary, secondary };
}

function decisionForm(candidate, disposition) {
  if (disposition.type === 'OUTER_HOLD_TERMINOLOGY_GAP') {
    return {
      type: 'OUTER_HOLD_TERMINOLOGY_GAP',
      reasonCode: 'OUTER_V2_TERMINOLOGY_GAP'
    };
  }
  return {
    type: 'INNER_DECISION',
    decision: createReviewDecision({
      candidate,
      decision: disposition.decision,
      reasonCodes: disposition.reasonCodes,
      relatedCandidateIds: disposition.relatedCandidateIds
    })
  };
}

function createCompletedRoleSubmission({
  population,
  assignmentHash,
  role,
  plan
}) {
  const blank = createBlankCandidateReviewRoleSubmission({
    roundId: population.roundId,
    populationHash: population.populationHash,
    assignmentHash,
    role
  });
  const limitationRequired = new Set(
    population.limitationSafetyRequiredCandidateIds
  );
  const rows = population.candidates.map((candidate, index) => ({
    candidateId: candidate.candidateId,
    limitationSafetyAcknowledgement: limitationRequired.has(candidate.candidateId)
      ? 'LIMITATION_DOES_NOT_AFFECT_CANDIDATE'
      : 'NOT_APPLICABLE',
    decisionForm: decisionForm(candidate, plan.get(candidate.candidateId)),
    reviewDurationSeconds: 90 + index + (role === 'SECONDARY_EVIDENCE_REVIEWER' ? 10 : 0),
    evidenceTraceabilityUsefulness: 5,
    structuredDecisionUsefulness: 5,
    patchAssessmentUsefulness: role === 'PRIMARY_TECHNICAL_REVIEWER' ? null : 5
  }));
  return validateCandidateReviewRoleSubmission({
    ...blank,
    submissionAuthorityStatus:
      CANDIDATE_REVIEW_SUBMISSION_AUTHORITY_STATUSES.synthetic,
    externalHumanProvenanceVerified: false,
    externalCustodyVerified: false,
    roleQualificationAttested: true,
    sealed: true,
    rows,
    submissionHash: null
  }, { population });
}

function plannedProvisionalCandidateIds(population, primaryPlan, secondaryPlan) {
  return population.candidates
    .map((candidate) => candidate.candidateId)
    .filter((candidateId) => {
      const primary = primaryPlan.get(candidateId);
      const secondary = secondaryPlan.get(candidateId);
      return primary?.type === 'INNER_DECISION'
        && secondary?.type === 'INNER_DECISION'
        && primary.decision === 'APPROVE_FOR_REPOSITORY_REVIEW'
        && secondary.decision === 'APPROVE_FOR_REPOSITORY_REVIEW';
    })
    .sort(compareAscii);
}

function createScenarioPatchSet({
  fixture,
  population,
  primarySubmission,
  secondarySubmission,
  suitableCandidateIds
}) {
  if (suitableCandidateIds.length === 0) return null;
  const decisionSetHash = computeCandidateReviewDecisionSetHash({
    population,
    primarySubmission,
    secondarySubmission
  });
  const excerptsByCandidateId = Object.fromEntries(
    suitableCandidateIds.map((candidateId) => [
      candidateId,
      `Synthetic reopened excerpt bound to ${candidateId}.`
    ])
  );
  const sourceReopenByCandidateId = Object.fromEntries(
    suitableCandidateIds.map((candidateId) => [candidateId, true])
  );
  const patchSet = createCandidateReviewPatchSet({
    population,
    decisionSetHash,
    approvedCandidateIds: suitableCandidateIds,
    excerptsByCandidateId,
    sourceReopenByCandidateId,
    baseCommitSha: fixture.evaluatedPr207Head,
    registryPath: SYNTHETIC_REGISTRY_PATH
  });
  return validateCandidateReviewPatchSet(patchSet, { population });
}

function buildSyntheticScenario({
  scenario,
  fixture,
  population,
  assignmentHash
}) {
  const plans = createScenarioPlans(scenario, population);
  const primarySubmission = createCompletedRoleSubmission({
    population,
    assignmentHash,
    role: 'PRIMARY_TECHNICAL_REVIEWER',
    plan: plans.primary
  });
  const secondarySubmission = createCompletedRoleSubmission({
    population,
    assignmentHash,
    role: 'SECONDARY_EVIDENCE_REVIEWER',
    plan: plans.secondary
  });
  const suitableCandidateIds = plannedProvisionalCandidateIds(
    population,
    plans.primary,
    plans.secondary
  );
  const patchSuitabilityByCandidateId = Object.fromEntries(
    population.candidates.map((candidate) => [
      candidate.candidateId,
      suitableCandidateIds.includes(candidate.candidateId)
        ? 'SUITABLE_FOR_REPOSITORY_REVIEW'
        : 'NOT_APPLICABLE_NO_APPROVED_PATCH'
    ])
  );
  const patchSet = createScenarioPatchSet({
    fixture,
    population,
    primarySubmission,
    secondarySubmission,
    suitableCandidateIds
  });
  const reconciliation = reconcileCandidateReviewRound({
    population,
    primarySubmission,
    secondarySubmission,
    patchSuitabilityByCandidateId,
    relationshipReport: population.relationshipReport,
    roleSeparationAttested: true,
    ...(patchSet ? { patchSet } : {})
  });
  const metrics = computeCandidateReviewMetrics({
    population,
    finalOutcomes: reconciliation,
    primarySubmission,
    secondarySubmission,
    qualityFindingCounts: {
      p0: 0,
      p1: 0,
      synthetic: true
    }
  });
  return Object.freeze({
    scenario,
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    synthetic: true,
    syntheticDecisionSimulation: true,
    humanReviewExecuted: false,
    candidateReviewV2HumanGateStatus: 'INCOMPLETE',
    externalHumanProvenanceVerified: false,
    externalCustodyVerified: false,
    candidateReviewMethodBlockers: metrics.candidateReviewMethodBlockers,
    candidateReviewMethodGatePassed:
      metrics.gates.candidateReviewMethodGatePassed,
    population,
    primarySubmission,
    secondarySubmission,
    patchSuitabilityByCandidateId,
    patchSet,
    reconciliation,
    metrics
  });
}

export function createSyntheticCandidateReviewV2BlankRound() {
  const fixture = createSyntheticCandidateReviewV2Fixture();
  const population = validateCandidateReviewPopulation(selectCandidateReviewPopulation({
    candidates: fixture.candidates,
    relationships: fixture.relationshipReport,
    syntheticPrerequisiteBypass: 'SYNTHETIC_FIXTURE_ONLY'
  }));
  const roundId = computeCandidateReviewRoundId({
    populationHash: population.populationHash,
    prerequisiteHash: population.prerequisiteHash
  });
  if (population.roundId !== roundId) {
    throw new Error('CANDIDATE_REVIEW_V2_POPULATION_ROUND_BINDING_FAILURE');
  }
  const assignmentHash = computeCandidateReviewAssignmentHash({
    roundId,
    populationHash: population.populationHash,
    candidateIds: population.candidates.map(({ candidateId }) => candidateId)
  });
  const roleSubmissions = Object.fromEntries(ROLES.map((role) => [
    role,
    createBlankCandidateReviewRoleSubmission({
      roundId,
      populationHash: population.populationHash,
      assignmentHash,
      role
    })
  ]));
  for (const submission of Object.values(roleSubmissions)) {
    validateCandidateReviewRoleSubmission(submission, {
      population,
      allowBlank: true
    });
  }
  return Object.freeze({
    fixture,
    population,
    roundId,
    assignmentHash,
    roleSubmissions
  });
}

export function createSyntheticCandidateReviewV2Scenario(scenario) {
  const prepared = createSyntheticCandidateReviewV2BlankRound();
  return buildSyntheticScenario({ scenario, ...prepared });
}

function summarizeScenario(result) {
  const relationshipClosureCounts = countBy(
    result.reconciliation.relationshipClosureReport.closures,
    ({ status }) => status
  );
  return {
    scenario: result.scenario,
    boundary: result.boundary,
    synthetic: true,
    syntheticDecisionSimulation: true,
    humanReviewExecuted: false,
    candidateReviewV2HumanGateStatus: 'INCOMPLETE',
    externalHumanProvenanceVerified:
      result.metrics.externalHumanProvenanceVerified,
    externalCustodyVerified: result.metrics.externalCustodyVerified,
    candidateReviewMethodBlockers:
      result.metrics.candidateReviewMethodBlockers,
    candidateReviewMethodGatePassed:
      result.metrics.gates.candidateReviewMethodGatePassed,
    syntheticRoleRowCount:
      result.primarySubmission.rows.length + result.secondarySubmission.rows.length,
    primarySubmissionAuthorityStatus:
      result.primarySubmission.submissionAuthorityStatus,
    secondarySubmissionAuthorityStatus:
      result.secondarySubmission.submissionAuthorityStatus,
    primarySubmissionHash: result.primarySubmission.submissionHash,
    secondarySubmissionHash: result.secondarySubmission.submissionHash,
    outcomeCounts: result.metrics.outcomeCounts,
    provisionalTechnicalApprovalCount:
      result.metrics.provisionalTechnicalApprovalCount,
    syntheticRejectedFalsePositiveCount:
      result.metrics.humanRejectedFalsePositiveCount,
    reviewedSuggestionPrecisionBasisPoints:
      result.metrics.reviewedSuggestionPrecisionBasisPoints,
    populationApprovalRateBasisPoints:
      result.metrics.populationApprovalRateBasisPoints,
    patchSuitabilityRateBasisPoints:
      result.metrics.patchSuitabilityRateBasisPoints,
    terminologyGapCount: result.metrics.terminologyGapCount,
    qualityFindingCounts: result.metrics.qualityFindingCounts,
    unresolvedP0P1FindingCount:
      result.metrics.unresolvedP0P1FindingCount,
    familyCounts: result.metrics.familyCounts,
    medians: result.metrics.medians,
    gates: result.metrics.gates,
    relationshipClosureCounts,
    patchValidationStatus: result.patchSet
      ? 'VALIDATED_SYNTHETIC_CONTAINER_ONLY'
      : 'NOT_APPLICABLE',
    patchPrerequisiteMode: result.patchSet?.prerequisiteMode ?? null,
    syntheticFixtureOnly: result.patchSet?.syntheticFixtureOnly ?? true,
    realReviewPatchValidation:
      result.patchSet?.realReviewPatchValidation
        ?? 'NOT_APPLICABLE_NO_PATCH_SET',
    validatedReviewPatchCount:
      result.patchSet?.validatedReviewPatches.length ?? 0,
    validatedReviewPatchBindingCount:
      result.patchSet?.validatedReviewPatchBindings.length ?? 0,
    patchSetHash: result.patchSet?.patchSetHash ?? null,
    patchShardCount: result.patchSet?.shardCount ?? 0,
    reconciliationHash: result.reconciliation.reconciliationHash,
    metricsHash: result.metrics.metricsHash
  };
}

function evaluateCore() {
  const prepared = createSyntheticCandidateReviewV2BlankRound();
  const {
    fixture,
    population,
    roundId,
    assignmentHash,
    roleSubmissions
  } = prepared;
  const primarySubmission = roleSubmissions.PRIMARY_TECHNICAL_REVIEWER;
  const secondarySubmission = roleSubmissions.SECONDARY_EVIDENCE_REVIEWER;

  const strictBlankValidationCodes = Object.fromEntries(ROLES.map((role) => [
    role,
    captureErrorCode(() => validateCandidateReviewRoleSubmission(roleSubmissions[role], {
      population,
      allowBlank: false
    }))
  ]));
  const reconciliationBlockCode = captureErrorCode(() => reconcileCandidateReviewRound({
    population,
    primarySubmission,
    secondarySubmission,
    roleSeparationAttested: true,
    patchSuitabilityByCandidateId: {}
  }));
  const relationshipTypeCounts = countBy(
    population.relationshipReport.relationships,
    ({ type }) => type
  );
  const componentSizeCounts = countBy(
    population.components,
    ({ candidateIds }) => String(candidateIds.length)
  );
  const blankRoleEnvelopes = ROLES.map((role) => {
    const submission = roleSubmissions[role];
    return {
      role,
      submissionAuthorityStatus: submission.submissionAuthorityStatus,
      externalHumanProvenanceVerified:
        submission.externalHumanProvenanceVerified,
      externalCustodyVerified: submission.externalCustodyVerified,
      roleQualificationAttested: submission.roleQualificationAttested,
      sealed: submission.sealed,
      decisionRowCount: submission.rows.length,
      submissionHashPresent: submission.submissionHash !== null
    };
  });
  const syntheticScenarioChecks = Object.fromEntries(
    CANDIDATE_REVIEW_V2_SYNTHETIC_SCENARIOS.map((scenario) => [
      scenario,
      summarizeScenario(buildSyntheticScenario({ scenario, ...prepared }))
    ])
  );
  const scenarioOutcomeCoverage = [...new Set(
    Object.values(syntheticScenarioChecks).flatMap((scenario) => (
      Object.entries(scenario.outcomeCounts)
        .filter(([, count]) => count > 0)
        .map(([outcome]) => outcome.toUpperCase())
    ))
  )].sort(compareAscii);

  return {
    schemaVersion: CANDIDATE_REVIEW_V2_EVALUATION_SCHEMA_VERSION,
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    productionReady: false,
    productionReviewerWorkflowReady: false,
    issue165Status: 'HOLD',
    synthetic: true,
    evaluationAsOf: fixture.evaluationAsOf,
    syntheticEvaluationStatus: 'PASS',
    candidateReviewV2HumanGateStatus: 'INCOMPLETE',
    externalHumanProvenanceVerified: false,
    externalCustodyVerified: false,
    candidateReviewMethodBlockers:
      population.candidateReviewMethodBlockers,
    candidateReviewMethodGatePassed: false,
    documentStatus: 'SYNTHETIC_FIXTURE_GATE_PASS_HUMAN_REVIEW_INCOMPLETE',
    thresholds: CANDIDATE_REVIEW_V2_EVALUATION_THRESHOLDS,
    fixture: {
      schemaVersion: fixture.schemaVersion,
      semanticSha256: fixture.semanticSha256,
      evaluatedPr207Head: fixture.evaluatedPr207Head,
      candidateCount: fixture.candidates.length,
      humanReviewExecuted: false,
      externalHumanProvenanceVerified:
        fixture.externalHumanProvenanceVerified,
      externalCustodyVerified: fixture.externalCustodyVerified,
      candidateReviewMethodBlockers:
        fixture.candidateReviewMethodBlockers,
      candidateReviewMethodGatePassed:
        fixture.candidateReviewMethodGatePassed
    },
    population: {
      populationHash: population.populationHash,
      prerequisiteHash: population.prerequisiteHash,
      roundId,
      assignmentHash,
      prerequisiteMode: population.prerequisiteMode,
      realFidelityPrerequisitesSatisfied:
        population.realFidelityPrerequisitesSatisfied,
      section5BindingsComplete: population.section5BindingsComplete,
      externalHumanProvenanceVerified:
        population.externalHumanProvenanceVerified,
      externalCustodyVerified: population.externalCustodyVerified,
      candidateReviewMethodBlockers:
        population.candidateReviewMethodBlockers,
      candidateCount: population.candidateCount,
      productFamilyCounts: population.productFamilyCounts,
      componentCount: population.components.length,
      selectedComponentCount: population.selectedComponentIds.length,
      componentSizeCounts,
      relationshipCount: population.relationshipReport.relationships.length,
      relationshipTypeCounts,
      limitationSafetyRequiredCandidateCount:
        population.limitationSafetyRequiredCandidateIds.length
    },
    blankRoleEnvelopes,
    blockedHumanOperations: {
      strictBlankValidationCodes,
      reconciliationBlockCode,
      finalOutcomeCount: 0,
      humanMetricStatus: 'NOT_COMPUTED_INCOMPLETE_ROUND',
      humanResultRecorded: false
    },
    syntheticScenarioChecks,
    scenarioOutcomeCoverage,
    zeroSideEffectObservations: {
      externalRequestCount: 0,
      persistenceWriteCount: 0,
      sourcePageTransmissionCount: 0,
      realInputReadCount: 0
    },
    nonClaims: [
      'All executable inputs and completed decision rows are deterministic synthetic simulations.',
      'Synthetic completed submissions exercise code paths but are not human fidelity or Candidate Review v2 results.',
      'The synthetic population, decisions, and blank-envelope checks do not prove role isolation or two different qualified people.',
      'No external human provenance or custody is verified, and the human method gate remains false.',
      'No candidate is a canonical claim, derived VERIFIED status, or customer-use permission.',
      'PR #206 and PR #207 remain Draft and HOLD; this stacked branch is not merge approval.',
      'Issue #165 and production remain HOLD; this report is not production evidence.'
    ]
  };
}

export function assertCandidateReviewV2Evaluation(report) {
  const thresholds = CANDIDATE_REVIEW_V2_EVALUATION_THRESHOLDS;
  if (report.boundary !== 'NOT_PRODUCTION_EVIDENCE'
    || report.productionReady !== false
    || report.productionReviewerWorkflowReady !== false
    || report.issue165Status !== 'HOLD'
    || report.syntheticEvaluationStatus !== 'PASS'
    || report.candidateReviewV2HumanGateStatus !== 'INCOMPLETE'
    || report.externalHumanProvenanceVerified !== false
    || report.externalCustodyVerified !== false
    || report.candidateReviewMethodGatePassed !== false
    || canonicalStringify(report.candidateReviewMethodBlockers)
      !== canonicalStringify(SYNTHETIC_METHOD_BLOCKERS)) {
    throw new Error('CANDIDATE_REVIEW_V2_BOUNDARY_FAILURE');
  }
  if (report.fixture.humanReviewExecuted !== false
    || report.fixture.externalHumanProvenanceVerified !== false
    || report.fixture.externalCustodyVerified !== false
    || report.fixture.candidateReviewMethodGatePassed !== false
    || canonicalStringify(report.fixture.candidateReviewMethodBlockers)
      !== canonicalStringify(SYNTHETIC_METHOD_BLOCKERS)
    || report.population.prerequisiteMode !== 'SYNTHETIC_FIXTURE_ONLY'
    || report.population.realFidelityPrerequisitesSatisfied !== false
    || report.population.section5BindingsComplete !== false
    || report.population.externalHumanProvenanceVerified !== false
    || report.population.externalCustodyVerified !== false
    || canonicalStringify(report.population.candidateReviewMethodBlockers)
      !== canonicalStringify(SYNTHETIC_METHOD_BLOCKERS)) {
    throw new Error('CANDIDATE_REVIEW_V2_METHOD_BOUNDARY_FAILURE');
  }
  if (report.population.candidateCount < thresholds.minimumCandidateCount
    || report.population.candidateCount > thresholds.maximumCandidateCount) {
    throw new Error('CANDIDATE_REVIEW_V2_POPULATION_COUNT_FAILURE');
  }
  for (const productFamily of ['medium_voltage_switchgear', 'transformer']) {
    if ((report.population.productFamilyCounts[productFamily] || 0)
      < thresholds.minimumCandidatesPerProductFamily) {
      throw new Error(`CANDIDATE_REVIEW_V2_FAMILY_COUNT_FAILURE:${productFamily}`);
    }
  }
  for (const relationshipType of thresholds.requiredRelationshipTypes) {
    if ((report.population.relationshipTypeCounts[relationshipType] || 0) < 1) {
      throw new Error(`CANDIDATE_REVIEW_V2_RELATIONSHIP_CASE_MISSING:${relationshipType}`);
    }
  }
  if (report.population.componentCount !== report.population.selectedComponentCount) {
    throw new Error('CANDIDATE_REVIEW_V2_COMPONENT_SPLIT_OR_DROP');
  }
  if (report.blankRoleEnvelopes.length !== 2
    || report.blankRoleEnvelopes.some((entry) => (
      entry.submissionAuthorityStatus
        !== CANDIDATE_REVIEW_SUBMISSION_AUTHORITY_STATUSES.pending
      || entry.externalHumanProvenanceVerified !== false
      || entry.externalCustodyVerified !== false
      || entry.roleQualificationAttested !== false
      || entry.sealed !== false
      || entry.decisionRowCount !== thresholds.expectedHumanDecisionRows
      || entry.submissionHashPresent !== false
    ))) {
    throw new Error('CANDIDATE_REVIEW_V2_BLANK_ENVELOPE_FAILURE');
  }
  if (Object.values(report.blockedHumanOperations.strictBlankValidationCodes)
    .some((code) => code !== 'INCOMPLETE_ROLE_SUBMISSION')
    || report.blockedHumanOperations.reconciliationBlockCode
      !== 'INCOMPLETE_ROLE_SUBMISSION'
    || report.blockedHumanOperations.finalOutcomeCount !== 0
    || report.blockedHumanOperations.humanResultRecorded !== false) {
    throw new Error('CANDIDATE_REVIEW_V2_INCOMPLETE_GATE_FAILURE');
  }

  if (Object.values(report.syntheticScenarioChecks).some((scenario) => (
    scenario.externalHumanProvenanceVerified !== false
    || scenario.externalCustodyVerified !== false
    || scenario.candidateReviewMethodGatePassed !== false
    || canonicalStringify(scenario.candidateReviewMethodBlockers)
      !== canonicalStringify(SYNTHETIC_METHOD_BLOCKERS)
    || scenario.primarySubmissionAuthorityStatus
      !== CANDIDATE_REVIEW_SUBMISSION_AUTHORITY_STATUSES.synthetic
    || scenario.secondarySubmissionAuthorityStatus
      !== CANDIDATE_REVIEW_SUBMISSION_AUTHORITY_STATUSES.synthetic
    || scenario.gates.candidateReviewMethodGatePassed !== false
  ))) {
    throw new Error('CANDIDATE_REVIEW_V2_SYNTHETIC_AUTHORITY_FAILURE');
  }

  const thresholdPass = report.syntheticScenarioChecks.THRESHOLD_PASS;
  if (thresholdPass.synthetic !== true
    || thresholdPass.humanReviewExecuted !== false
    || thresholdPass.syntheticRoleRowCount
      !== thresholds.expectedSyntheticDecisionRowsPerScenario
    || thresholdPass.outcomeCounts.approved < thresholds.minimumApprovedCandidates
    || thresholdPass.reviewedSuggestionPrecisionBasisPoints
      < thresholds.minimumReviewedSuggestionPrecisionBasisPoints
    || thresholdPass.patchValidationStatus
      !== 'VALIDATED_SYNTHETIC_CONTAINER_ONLY'
    || thresholdPass.patchPrerequisiteMode !== 'SYNTHETIC_FIXTURE_ONLY'
    || thresholdPass.syntheticFixtureOnly !== true
    || thresholdPass.realReviewPatchValidation
      !== 'NOT_APPLICABLE_SYNTHETIC_FIXTURE'
    || thresholdPass.validatedReviewPatchCount !== 0
    || thresholdPass.validatedReviewPatchBindingCount !== 0
    || canonicalStringify(thresholdPass.qualityFindingCounts)
      !== canonicalStringify({ p0: 0, p1: 0, synthetic: true })
    || thresholdPass.unresolvedP0P1FindingCount !== 0
    || thresholdPass.gates.candidateReviewThresholdsPassed !== true
    || thresholdPass.gates.candidateReviewMethodGatePassed !== false) {
    throw new Error('CANDIDATE_REVIEW_V2_THRESHOLD_SCENARIO_FAILURE');
  }

  const fourOutcome = report.syntheticScenarioChecks.FOUR_OUTCOME_COVERAGE;
  if (Object.values(fourOutcome.outcomeCounts).some((count) => count < 1)
    || fourOutcome.gates.noConflictsPassed !== false
    || canonicalStringify(report.scenarioOutcomeCoverage)
      !== canonicalStringify(['APPROVED', 'CONFLICTED', 'HELD', 'REJECTED'])) {
    throw new Error('CANDIDATE_REVIEW_V2_OUTCOME_COVERAGE_FAILURE');
  }

  const precisionBoundary =
    report.syntheticScenarioChecks.PRECISION_AT_8000_BASIS_POINTS;
  if (precisionBoundary.reviewedSuggestionPrecisionBasisPoints !== 8_000
    || precisionBoundary.gates.precisionPassed !== true
    || precisionBoundary.outcomeCounts.approved !== 24
    || precisionBoundary.syntheticRejectedFalsePositiveCount !== 6
    || precisionBoundary.gates.approvalCountPassed !== false) {
    throw new Error('CANDIDATE_REVIEW_V2_PRECISION_BOUNDARY_FAILURE');
  }

  const nullDenominators = report.syntheticScenarioChecks.NULL_DENOMINATORS;
  if (nullDenominators.reviewedSuggestionPrecisionBasisPoints !== null
    || nullDenominators.patchSuitabilityRateBasisPoints !== null
    || nullDenominators.gates.precisionPassed !== false
    || nullDenominators.patchValidationStatus !== 'NOT_APPLICABLE') {
    throw new Error('CANDIDATE_REVIEW_V2_NULL_DENOMINATOR_FAILURE');
  }

  if (report.zeroSideEffectObservations.externalRequestCount
      !== thresholds.expectedExternalRequestCount
    || report.zeroSideEffectObservations.persistenceWriteCount
      !== thresholds.expectedPersistenceWriteCount
    || report.zeroSideEffectObservations.sourcePageTransmissionCount !== 0
    || report.zeroSideEffectObservations.realInputReadCount !== 0) {
    throw new Error('CANDIDATE_REVIEW_V2_SIDE_EFFECT_FAILURE');
  }
  return report;
}

export async function evaluateCandidateReviewV2({ repeat = 2 } = {}) {
  if (!Number.isInteger(repeat) || repeat < 2 || repeat > 10) {
    throw new Error('CANDIDATE_REVIEW_V2_REPEAT_OUT_OF_BOUNDS');
  }
  const first = evaluateCore();
  const canonicalFirst = canonicalStringify(first);
  for (let index = 1; index < repeat; index += 1) {
    if (canonicalStringify(evaluateCore()) !== canonicalFirst) {
      throw new Error('CANDIDATE_REVIEW_V2_REPEAT_NONDETERMINISTIC');
    }
  }
  return assertCandidateReviewV2Evaluation({
    ...first,
    canonicalSha256: sha256(canonicalFirst),
    repeatedRunHashEquality: true,
    repeatCount: repeat
  });
}

export function parseCandidateReviewV2EvaluationArguments(argv) {
  let json = false;
  let repeat;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--json' && !json) {
      json = true;
      continue;
    }
    if (argument === '--repeat' && repeat === undefined
      && typeof argv[index + 1] === 'string') {
      repeat = Number(argv[index + 1]);
      index += 1;
      continue;
    }
    throw new Error('CANDIDATE_REVIEW_V2_CLI_ARGUMENT_REFUSED');
  }
  if (!json) throw new Error('CANDIDATE_REVIEW_V2_JSON_OUTPUT_REQUIRED');
  if (!Number.isInteger(repeat) || repeat < 2 || repeat > 10) {
    throw new Error('CANDIDATE_REVIEW_V2_REPEAT_OUT_OF_BOUNDS');
  }
  return { json: true, repeat };
}

function safeFailure(error) {
  const errorCode = typeof error?.code === 'string'
    && /^[A-Z][A-Z0-9_]{2,100}$/u.test(error.code)
    ? error.code
    : 'CANDIDATE_REVIEW_V2_EVALUATION_FAILED';
  return {
    schemaVersion: CANDIDATE_REVIEW_V2_EVALUATION_SCHEMA_VERSION,
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    productionReady: false,
    productionReviewerWorkflowReady: false,
    issue165Status: 'HOLD',
    syntheticEvaluationStatus: 'REFUSED',
    candidateReviewV2HumanGateStatus: 'INCOMPLETE',
    errorCode
  };
}

async function main() {
  try {
    const options = parseCandidateReviewV2EvaluationArguments(
      process.argv.slice(2)
    );
    const report = await evaluateCandidateReviewV2(options);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify(safeFailure(error))}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
