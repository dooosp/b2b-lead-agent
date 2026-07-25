import test from 'node:test';
import assert from 'node:assert/strict';

import {
  sha256
} from '../knowledge/claim-registry/index.mjs';
import {
  createCandidate,
  formatCandidateStatement
} from '../evidence-claim-workbench/domain/candidates.mjs';
import { createReviewDecision } from '../evidence-claim-workbench/domain/review-decisions.mjs';
import {
  CANDIDATE_REVIEW_FROZEN_HEAD_SHA,
  CANDIDATE_REVIEW_SUBMISSION_AUTHORITY_STATUSES,
  CANDIDATE_REVIEW_SYNTHETIC_PREREQUISITE_BYPASS,
  computeCandidateReviewAssignmentHash,
  computeCandidateReviewDecisionSetHash,
  computeCandidateReviewMetrics,
  createBlankCandidateReviewRoleSubmission,
  createCandidateReviewPatchSet,
  reconcileCandidateReviewRound,
  selectCandidateReviewPopulation,
  validateCandidateReviewRoleSubmission
} from '../evidence-claim-workbench/domain/candidate-review-v2.mjs';

const CLAIM_TYPES = [
  'PRODUCT_CAPABILITY',
  'PERFORMANCE',
  'CERTIFICATION',
  'TECHNICAL_REQUIREMENT'
];
const FAMILY_VALUES = {
  medium_voltage_switchgear: [
    ['rated_voltage', 'voltage', 'kV'],
    ['rated_current', 'current', 'A'],
    ['short_circuit_rating', 'current', 'kA'],
    ['frequency', 'frequency', 'Hz']
  ],
  transformer: [
    ['transformer_capacity', 'apparent_power', 'kVA'],
    ['primary_voltage', 'voltage', 'kV'],
    ['secondary_voltage', 'voltage', 'V'],
    ['frequency', 'frequency', 'Hz']
  ]
};

function syntheticCandidate(index, family, semanticIndex = index) {
  const combinations = FAMILY_VALUES[family].flatMap((value, valueIndex) => (
    CLAIM_TYPES.map((claimType, claimIndex) => ({
      value,
      claimType,
      ordinal: valueIndex * CLAIM_TYPES.length + claimIndex
    }))
  ));
  const combination = combinations[semanticIndex % combinations.length];
  const [key, quantityKind, unit] = combination.value;
  const value = {
    type: 'QUANTITY',
    key,
    value: 30 + combination.ordinal,
    unit,
    quantityKind
  };
  return createCandidate({
    schemaVersion: 'evidence-claim-candidate-v0',
    synthetic: true,
    documentId: `doc_${(index + 1).toString(16).padStart(64, '0')}`,
    evidenceAnchorId: `anc_${(index + 30_001).toString(16).padStart(64, '0')}`,
    claimType: combination.claimType,
    subject: {
      type: 'PRODUCT_FAMILY',
      id: family,
      displayName: family === 'transformer' ? 'Transformer' : 'Medium-voltage Switchgear'
    },
    statement: formatCandidateStatement(family, value),
    value,
    applicability: {
      vertical: 'datacenter',
      domain: 'electrical_power',
      productFamily: family,
      jurisdiction: 'KR',
      projectStages: ['SPECIFICATION'],
      conditions: []
    },
    validity: { type: 'NOT_STATED', validUntil: null },
    extractionMethod: 'MANUAL_EXACT_QUOTE',
    extractionRuleId: 'OECRW0-MANUAL-STRUCTURED-ENTRY',
    extractionReasons: ['HUMAN_SELECTED_EXACT_EVIDENCE'],
    reviewState: 'REVIEW_REQUIRED'
  });
}

function population(count = 31) {
  const mediumVoltageCount = Math.ceil(count / 2);
  return selectCandidateReviewPopulation({
    candidates: [
      ...Array.from({ length: mediumVoltageCount }, (_, index) => (
        syntheticCandidate(index, 'medium_voltage_switchgear')
      )),
      ...Array.from({ length: count - mediumVoltageCount }, (_, index) => (
        syntheticCandidate(100 + index, 'transformer')
      ))
    ],
    syntheticPrerequisiteBypass: CANDIDATE_REVIEW_SYNTHETIC_PREREQUISITE_BYPASS
  });
}

function completeSubmission(populationValue, role, specs = {}, { outerAll = false } = {}) {
  const assignmentHash = computeCandidateReviewAssignmentHash({
    roundId: populationValue.roundId,
    populationHash: populationValue.populationHash,
    candidateIds: populationValue.candidates.map(({ candidateId }) => candidateId)
  });
  const result = structuredClone(createBlankCandidateReviewRoleSubmission({
    roundId: populationValue.roundId,
    populationHash: populationValue.populationHash,
    assignmentHash,
    role
  }));
  result.roleQualificationAttested = true;
  result.sealed = true;
  result.submissionAuthorityStatus = populationValue.prerequisiteMode
    === CANDIDATE_REVIEW_SYNTHETIC_PREREQUISITE_BYPASS
    ? CANDIDATE_REVIEW_SUBMISSION_AUTHORITY_STATUSES.synthetic
    : CANDIDATE_REVIEW_SUBMISSION_AUTHORITY_STATUSES.structural;
  result.rows = populationValue.candidates.map((candidate, index) => {
    const spec = specs[candidate.candidateId] ?? {
      decision: 'APPROVE_FOR_REPOSITORY_REVIEW',
      reasonCodes: ['EVIDENCE_QUOTE_CONFIRMED', 'STRUCTURED_MEANING_CONFIRMED']
    };
    return {
      candidateId: candidate.candidateId,
      limitationSafetyAcknowledgement: 'NOT_APPLICABLE',
      decisionForm: outerAll
        ? {
          type: 'OUTER_HOLD_TERMINOLOGY_GAP',
          reasonCode: 'OUTER_V2_TERMINOLOGY_GAP'
        }
        : {
          type: 'INNER_DECISION',
          decision: createReviewDecision({
            candidate,
            decision: spec.decision,
            reasonCodes: spec.reasonCodes,
            relatedCandidateIds: spec.relatedCandidateIds ?? []
          })
        },
      reviewDurationSeconds: (role === 'PRIMARY_TECHNICAL_REVIEWER' ? 1 : 101) + index,
      evidenceTraceabilityUsefulness: 1 + (index % 5),
      structuredDecisionUsefulness: 4,
      patchAssessmentUsefulness: role === 'PRIMARY_TECHNICAL_REVIEWER' ? null : 5
    };
  });
  return validateCandidateReviewRoleSubmission(result, { population: populationValue });
}

function patchSet(populationValue, primary, secondary, approvedCandidateIds) {
  return createCandidateReviewPatchSet({
    population: populationValue,
    decisionSetHash: computeCandidateReviewDecisionSetHash({
      population: populationValue,
      primarySubmission: primary,
      secondarySubmission: secondary
    }),
    approvedCandidateIds,
    excerptsByCandidateId: Object.fromEntries(approvedCandidateIds.map((candidateId) => [
      candidateId,
      `Synthetic metric excerpt ${candidateId.slice(-10)}.`
    ])),
    sourceReopenByCandidateId: Object.fromEntries(approvedCandidateIds.map((candidateId) => [
      candidateId,
      true
    ])),
    baseCommitSha: CANDIDATE_REVIEW_FROZEN_HEAD_SHA,
    registryPath: 'knowledge/claim-registry/candidate-review-v2-metrics.json'
  });
}

test('metrics count unique candidates, floor basis points, report families/medians, and keep synthetic method authority false', () => {
  const populationValue = population(31);
  const mediumVoltageIds = populationValue.candidates
    .filter(({ subject }) => subject.id === 'medium_voltage_switchgear')
    .map(({ candidateId }) => candidateId);
  const transformerIds = populationValue.candidates
    .filter(({ subject }) => subject.id === 'transformer')
    .map(({ candidateId }) => candidateId);
  const approvedCandidateIds = [...mediumVoltageIds.slice(0, 13), ...transformerIds.slice(0, 12)].sort();
  const rejectedCandidateIds = populationValue.candidates
    .map(({ candidateId }) => candidateId)
    .filter((candidateId) => !approvedCandidateIds.includes(candidateId));
  const rejectionSpecs = Object.fromEntries(rejectedCandidateIds.map((candidateId) => [
    candidateId,
    { decision: 'REJECT', reasonCodes: ['NOT_A_CAPABILITY'] }
  ]));
  const primary = completeSubmission(populationValue, 'PRIMARY_TECHNICAL_REVIEWER', rejectionSpecs);
  const secondary = completeSubmission(populationValue, 'SECONDARY_EVIDENCE_REVIEWER', rejectionSpecs);
  const suitablePatchSet = patchSet(populationValue, primary, secondary, approvedCandidateIds);
  const reconciliation = reconcileCandidateReviewRound({
    population: populationValue,
    primarySubmission: primary,
    secondarySubmission: secondary,
    patchSuitabilityByCandidateId: Object.fromEntries(populationValue.candidates.map(({ candidateId }) => [
      candidateId,
      approvedCandidateIds.includes(candidateId)
        ? 'SUITABLE_FOR_REPOSITORY_REVIEW'
        : 'NOT_APPLICABLE_NO_APPROVED_PATCH'
    ])),
    roleSeparationAttested: true,
    patchSet: suitablePatchSet
  });
  const metrics = computeCandidateReviewMetrics({
    population: populationValue,
    finalOutcomes: reconciliation,
    primarySubmission: primary,
    secondarySubmission: secondary,
    qualityFindingCounts: { p0: 0, p1: 0, synthetic: true }
  });

  assert.deepEqual(metrics.outcomeCounts, {
    approved: 25,
    rejected: 6,
    held: 0,
    conflicted: 0
  });
  assert.equal(metrics.candidateCount, 31);
  assert.equal(metrics.roleRowCount, 62);
  assert.equal(metrics.provisionalTechnicalApprovalCount, 25);
  assert.equal(metrics.humanRejectedFalsePositiveCount, 6);
  assert.equal(metrics.precisionResolvedCount, 31);
  assert.equal(metrics.reviewedSuggestionPrecisionBasisPoints, 8064);
  assert.equal(metrics.populationApprovalRateBasisPoints, 8064);
  assert.equal(metrics.decisionAgreementCount, 31);
  assert.equal(metrics.decisionAgreementRateBasisPoints, 10_000);
  assert.deepEqual(metrics.patchSuitabilityCounts, {
    suitable: 25,
    notSuitable: 0,
    incomplete: 0,
    notApplicable: 6
  });
  assert.equal(metrics.patchSuitabilityRateBasisPoints, 10_000);
  assert.equal(metrics.familyCounts.medium_voltage_switchgear.populationCount, 16);
  assert.equal(metrics.familyCounts.medium_voltage_switchgear.approvedCount, 13);
  assert.equal(metrics.familyCounts.medium_voltage_switchgear.reviewedSuggestionPrecisionBasisPoints, 8125);
  assert.equal(metrics.familyCounts.transformer.populationCount, 15);
  assert.equal(metrics.familyCounts.transformer.approvedCount, 12);
  assert.equal(metrics.familyCounts.transformer.reviewedSuggestionPrecisionBasisPoints, 8000);
  assert.equal(metrics.medians.primary.reviewDurationSeconds, 16);
  assert.equal(metrics.medians.secondary.reviewDurationSeconds, 116);
  assert.equal(metrics.medians.primary.structuredDecisionUsefulness, 4);
  assert.equal(metrics.medians.secondary.patchAssessmentUsefulness, 5);
  assert.equal(metrics.automaticVerifiedLeakageCount, 0);
  assert.equal(metrics.automaticCustomerUseAllowedLeakageCount, 0);
  assert.equal(metrics.protectedContentLeakageCount, 0);
  assert.equal(metrics.unresolvedP0P1FindingCount, 0);
  assert.equal(metrics.gates.candidateReviewThresholdsPassed, true);
  assert.equal(metrics.gates.candidateReviewMethodGatePassed, false);
  assert.equal(metrics.externalHumanProvenanceVerified, false);
  assert.equal(metrics.externalCustodyVerified, false);
  assert.deepEqual(metrics.candidateReviewMethodBlockers, [
    'EXTERNAL_HUMAN_PROVENANCE_AND_CUSTODY_UNVERIFIED',
    'SYNTHETIC_FIXTURE_NOT_HUMAN_EVIDENCE'
  ]);
  assert.equal(metrics.productionReady, false);
  assert.ok(Object.isFrozen(metrics));

  const withoutFindingReview = computeCandidateReviewMetrics({
    population: populationValue,
    finalOutcomes: reconciliation,
    primarySubmission: primary,
    secondarySubmission: secondary
  });
  assert.equal(withoutFindingReview.unresolvedP0P1FindingCount, null);
  assert.equal(withoutFindingReview.gates.noUnresolvedP0P1FindingsPassed, false);
  assert.equal(withoutFindingReview.gates.candidateReviewThresholdsPassed, false);
});

test('zero technical and patch denominators are null while held volume remains visible', () => {
  const populationValue = population(30);
  const primary = completeSubmission(
    populationValue,
    'PRIMARY_TECHNICAL_REVIEWER',
    {},
    { outerAll: true }
  );
  const secondary = completeSubmission(
    populationValue,
    'SECONDARY_EVIDENCE_REVIEWER',
    {},
    { outerAll: true }
  );
  const reconciliation = reconcileCandidateReviewRound({
    population: populationValue,
    primarySubmission: primary,
    secondarySubmission: secondary,
    patchSuitabilityByCandidateId: Object.fromEntries(populationValue.candidates.map(({ candidateId }) => [
      candidateId,
      'NOT_APPLICABLE_NO_APPROVED_PATCH'
    ])),
    roleSeparationAttested: true
  });
  const metrics = computeCandidateReviewMetrics({
    population: populationValue,
    finalOutcomes: reconciliation,
    primarySubmission: primary,
    secondarySubmission: secondary
  });
  assert.equal(metrics.reviewedSuggestionPrecisionBasisPoints, null);
  assert.equal(metrics.patchSuitabilityRateBasisPoints, null);
  assert.equal(metrics.populationApprovalRateBasisPoints, 0);
  assert.equal(metrics.outcomeCounts.held, 30);
  assert.equal(metrics.unresolvedOrHeldCount, 30);
  assert.equal(metrics.terminologyGapCount, 30);
  assert.equal(metrics.decisionAgreementRateBasisPoints, 10_000);
  assert.equal(metrics.medians.primary.reviewDurationSeconds, 15.5);
  assert.equal(metrics.medians.secondary.reviewDurationSeconds, 115.5);
  assert.equal(metrics.gates.candidateReviewThresholdsPassed, false);
  assert.equal(metrics.gates.candidateReviewMethodGatePassed, false);
});

test('metrics recompute reconciliation and reject forged approvals even after attacker-updated hashes', () => {
  const populationValue = population(30);
  const rejectionSpecs = Object.fromEntries(populationValue.candidates.map(({ candidateId }) => [
    candidateId,
    { decision: 'REJECT', reasonCodes: ['NOT_A_CAPABILITY'] }
  ]));
  const primary = completeSubmission(populationValue, 'PRIMARY_TECHNICAL_REVIEWER', rejectionSpecs);
  const secondary = completeSubmission(populationValue, 'SECONDARY_EVIDENCE_REVIEWER', rejectionSpecs);
  const reconciliation = reconcileCandidateReviewRound({
    population: populationValue,
    primarySubmission: primary,
    secondarySubmission: secondary,
    patchSuitabilityByCandidateId: Object.fromEntries(populationValue.candidates.map(({ candidateId }) => [
      candidateId,
      'NOT_APPLICABLE_NO_APPROVED_PATCH'
    ])),
    roleSeparationAttested: true
  });
  const forged = structuredClone(reconciliation);
  const target = forged.finalOutcomes[0];
  target.outcome = 'APPROVED';
  target.provisionalTechnicalApproval = true;
  target.patchSuitability = 'SUITABLE_FOR_REPOSITORY_REVIEW';
  const outcomeBase = Object.fromEntries(Object.entries(target).filter(([key]) => key !== 'finalOutcomeId'));
  target.finalOutcomeId = `finaloutcome_${sha256(outcomeBase)}`;
  forged.finalDecisionSetHash = sha256(forged.finalOutcomes);
  const reconciliationBase = Object.fromEntries(
    Object.entries(forged).filter(([key]) => key !== 'reconciliationHash')
  );
  forged.reconciliationHash = sha256(reconciliationBase);

  assert.throws(
    () => computeCandidateReviewMetrics({
      population: populationValue,
      finalOutcomes: forged,
      primarySubmission: primary,
      secondarySubmission: secondary
    }),
    (error) => error.code === 'RECONCILIATION_CONTENT_MISMATCH'
  );
  assert.throws(
    () => computeCandidateReviewMetrics({
      population: populationValue,
      finalOutcomes: reconciliation.finalOutcomes,
      primarySubmission: primary,
      secondarySubmission: secondary
    }),
    (error) => error.code === 'VALIDATED_RECONCILIATION_REQUIRED'
  );

  const encodedPath = structuredClone(reconciliation);
  encodedPath.finalOutcomes[0].reasonCodes = ['%2FUsers%2Freviewer%2Fdecision.txt'];
  assert.throws(
    () => computeCandidateReviewMetrics({
      population: populationValue,
      finalOutcomes: encodedPath,
      primarySubmission: primary,
      secondarySubmission: secondary
    }),
    (error) => error.code === 'LOCAL_ABSOLUTE_PATH_REFUSED'
  );
});
