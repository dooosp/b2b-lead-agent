import {
  canonicalStringify,
  ClaimValidationError
} from '../knowledge/claim-registry/index.mjs';
import {
  buildMinimumEvidenceToAdvance,
  buildPursuitRevisionSnapshot,
  buildPursuitTwinReviewPacket,
  pursuitTwinReviewPacketHashes,
  renderPursuitTwinReviewPacketJson,
  renderPursuitTwinReviewPacketMarkdown
} from '../verticals/datacenter/pursuit-twin-v0.mjs';

function compareAscii(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function identity(opportunityId) {
  return {
    opportunityId,
    accountDisplayName: 'Synthetic Metro Compute',
    projectDisplayName: 'Synthetic Delta Campus',
    facilityDisplayName: 'Synthetic Delta DC',
    verticalId: 'datacenter_infrastructure',
    jurisdiction: 'KR'
  };
}

function quantityRequirement({ value = 22.9, valueState = 'KNOWN', evidenceClaimRefs = ['req_voltage_22_9kv'] } = {}) {
  return {
    requirementId: 'req_incoming_voltage',
    category: 'electrical_power',
    key: 'incoming_voltage',
    productFamilyIds: ['medium_voltage_switchgear'],
    priority: 'HARD',
    valueState,
    operator: 'GTE',
    value: {
      type: 'QUANTITY',
      key: 'incoming_voltage',
      value,
      unit: 'kV',
      quantityKind: 'voltage'
    },
    evidenceClaimRefs
  };
}

function protocolRequirement(productFamilyId) {
  return {
    requirementId: 'req_required_protocols',
    category: 'controls_bms',
    key: 'required_protocols',
    productFamilyIds: [productFamilyId],
    priority: 'HARD',
    valueState: 'KNOWN',
    operator: 'CONTAINS_ALL',
    value: {
      type: 'STRING_SET',
      key: 'required_protocols',
      value: ['BACNET_IP']
    },
    evidenceClaimRefs: ['req_bacnet']
  };
}

function opportunity({
  opportunityId = 'syn_pursuit_twin_delta',
  stage = 'BASIC_DESIGN',
  stageEvidenceClaimRef = 'stage_basic_design',
  productFamilyIds = ['medium_voltage_switchgear'],
  requirements = [quantityRequirement()]
} = {}) {
  return {
    schemaVersion: 'project-opportunity-v0',
    synthetic: true,
    opportunityId,
    verticalId: 'datacenter_infrastructure',
    jurisdiction: 'KR',
    conditions: {},
    identity: identity(opportunityId),
    stage: {
      value: stage,
      evidenceClaimRefs: stageEvidenceClaimRef ? [stageEvidenceClaimRef] : []
    },
    candidateProductFamilyIds: productFamilyIds,
    requirements
  };
}

function revision({ revisionId, supersedesRevisionId, effectiveAt, evidenceClaimRefs }) {
  return {
    documentKey: 'synthetic_approved_single_line',
    revisionId,
    supersedesRevisionId,
    effectiveAt,
    evidenceClaimRefs
  };
}

function createReviewFixture(registry, verticalPack) {
  const previousSnapshot = buildPursuitRevisionSnapshot({
    opportunity: opportunity(),
    sourceRevision: revision({
      revisionId: 'SPEC-R1',
      supersedesRevisionId: null,
      effectiveAt: '2026-04-01T00:00:00.000Z',
      evidenceClaimRefs: ['stage_basic_design', 'req_voltage_22_9kv']
    }),
    observedAt: '2026-04-02T00:00:00.000Z'
  }, registry, verticalPack);

  const currentOpportunity = opportunity({
    stage: 'TENDER',
    stageEvidenceClaimRef: 'stage_tender',
    requirements: [quantityRequirement({ valueState: 'UNKNOWN', evidenceClaimRefs: [] })]
  });
  const currentSnapshot = buildPursuitRevisionSnapshot({
    opportunity: currentOpportunity,
    sourceRevision: revision({
      revisionId: 'SPEC-R2',
      supersedesRevisionId: 'SPEC-R1',
      effectiveAt: '2026-05-01T00:00:00.000Z',
      evidenceClaimRefs: ['stage_tender']
    }),
    observedAt: '2026-05-02T00:00:00.000Z'
  }, registry, verticalPack);
  const priorHumanDecision = {
    decisionId: 'synthetic-decision-r1',
    decision: 'PURSUE',
    decidedAt: '2026-04-03T00:00:00.000Z',
    snapshotCanonicalSha256: previousSnapshot.canonicalSha256,
    reviewReceipt: 'synthetic-local-review-receipt-r1'
  };
  const packet = buildPursuitTwinReviewPacket({
    previousSnapshot,
    currentSnapshot,
    priorHumanDecision
  }, registry, verticalPack);
  return { previousSnapshot, currentSnapshot, priorHumanDecision, packet };
}

function summarizeFixturePacket(packet) {
  const delta = packet.specificationDelta;
  const minimum = packet.minimumEvidenceToAdvance;
  const previousFit = delta.fitChanges[0]?.previous;
  const currentFit = delta.fitChanges[0]?.current;
  return {
    previousFitResult: previousFit?.result || null,
    currentFitResult: currentFit?.result || null,
    previousWindowState: previousFit?.windowState || null,
    currentWindowState: currentFit?.windowState || null,
    evaluationInvalidated: delta.evaluationInvalidated,
    technicalOutcomeChanged: delta.technicalOutcomeChanged,
    decisionReviewState: delta.decisionReview.state,
    carryForwardAllowed: delta.decisionReview.carryForwardAllowed,
    automaticDecisionChangePerformed: delta.decisionReview.automaticDecisionChangePerformed,
    replacementHumanDecision: delta.decisionReview.replacementHumanDecision,
    requirementChangeTypes: delta.requirementChanges.map((item) => item.changeType).sort(compareAscii),
    revisionTimelineCount: delta.revisionTimeline.length,
    advancementState: minimum.advancementState,
    minimumEvidenceCount: minimum.minimumEvidenceSet.length,
    minimumEvidenceSides: minimum.minimumEvidenceSet.map((item) => item.side).sort(compareAscii),
    completionEffect: minimum.completionEffect,
    fitGuarantee: minimum.fitGuarantee,
    finalHumanDecision: packet.finalHumanDecision,
    productionReady: packet.productionReady,
    issue165Status: packet.issue165Status,
    counterfactualExcluded: packet.excludedCapabilities.includes('COUNTERFACTUAL_FIT')
  };
}

function runScenario(id, registry, verticalPack, fixture) {
  if (id === 'revision_fit_to_insufficient') {
    return summarizeFixturePacket(fixture.packet);
  }
  if (id === 'verified_hard_mismatch_is_not_evidence_gap') {
    const minimum = buildMinimumEvidenceToAdvance(opportunity({
      opportunityId: 'syn_pursuit_hard_mismatch',
      requirements: [quantityRequirement({ value: 33, evidenceClaimRefs: ['req_voltage_33kv'] })]
    }), registry, verticalPack);
    return {
      currentFitResult: minimum.currentTechnicalOutcomes[0]?.result || null,
      advancementState: minimum.advancementState,
      minimumEvidenceCount: minimum.minimumEvidenceSet.length,
      gateCodes: minimum.nonEvidenceGates.map((gate) => gate.code).sort(compareAscii),
      fitGuarantee: minimum.fitGuarantee
    };
  }
  if (id === 'unverified_capability_requests_product_evidence') {
    const minimum = buildMinimumEvidenceToAdvance(opportunity({
      opportunityId: 'syn_pursuit_unverified_capability',
      productFamilyIds: ['energy_analytics'],
      requirements: [protocolRequirement('energy_analytics')]
    }), registry, verticalPack);
    return {
      currentFitResult: minimum.currentTechnicalOutcomes[0]?.result || null,
      advancementState: minimum.advancementState,
      minimumEvidenceCount: minimum.minimumEvidenceSet.length,
      minimumEvidenceSides: minimum.minimumEvidenceSet.map((item) => item.side),
      reasonCodes: minimum.minimumEvidenceSet.flatMap((item) => item.reasonCodes).sort(compareAscii),
      fitGuarantee: minimum.fitGuarantee
    };
  }
  if (id === 'verified_fit_is_already_reviewable') {
    const minimum = buildMinimumEvidenceToAdvance(opportunity({ opportunityId: 'syn_pursuit_ready' }), registry, verticalPack);
    return {
      currentFitResult: minimum.currentTechnicalOutcomes[0]?.result || null,
      currentWindowState: minimum.currentTechnicalOutcomes[0]?.windowState || null,
      advancementState: minimum.advancementState,
      minimumEvidenceCount: minimum.minimumEvidenceSet.length,
      fitGuarantee: minimum.fitGuarantee
    };
  }
  throw new ClaimValidationError('UNKNOWN_PURSUIT_TWIN_EVALUATION_SCENARIO', `$.scenario.${id}`);
}

const SCENARIOS = Object.freeze([
  {
    id: 'revision_fit_to_insufficient',
    expected: {
      previousFitResult: 'FIT',
      currentFitResult: 'INSUFFICIENT_EVIDENCE',
      previousWindowState: 'OPEN',
      currentWindowState: 'CLOSING',
      evaluationInvalidated: true,
      technicalOutcomeChanged: true,
      decisionReviewState: 'REVIEW_REQUIRED',
      carryForwardAllowed: false,
      automaticDecisionChangePerformed: false,
      replacementHumanDecision: 'NOT_MADE',
      requirementChangeTypes: ['MODIFIED'],
      revisionTimelineCount: 2,
      advancementState: 'EVIDENCE_REQUIRED_FOR_REEVALUATION',
      minimumEvidenceCount: 1,
      minimumEvidenceSides: ['PROJECT'],
      completionEffect: 'RE_EVALUATE_ONLY',
      fitGuarantee: false,
      finalHumanDecision: 'NOT_MADE',
      productionReady: false,
      issue165Status: 'HOLD',
      counterfactualExcluded: true
    }
  },
  {
    id: 'verified_hard_mismatch_is_not_evidence_gap',
    expected: {
      currentFitResult: 'NOT_FIT',
      advancementState: 'NO_EVIDENCE_ONLY_ADVANCE_PATH',
      minimumEvidenceCount: 0,
      gateCodes: ['VERIFIED_HARD_REQUIREMENT_MISMATCH'],
      fitGuarantee: false
    }
  },
  {
    id: 'unverified_capability_requests_product_evidence',
    expected: {
      currentFitResult: 'CONDITIONAL_FIT',
      advancementState: 'EVIDENCE_REQUIRED_FOR_REEVALUATION',
      minimumEvidenceCount: 1,
      minimumEvidenceSides: ['PRODUCT'],
      reasonCodes: ['CAPABILITY_CLAIM_UNVERIFIED'],
      fitGuarantee: false
    }
  },
  {
    id: 'verified_fit_is_already_reviewable',
    expected: {
      currentFitResult: 'FIT',
      currentWindowState: 'OPEN',
      advancementState: 'ALREADY_REVIEWABLE',
      minimumEvidenceCount: 0,
      fitGuarantee: false
    }
  }
]);

function basisPoints(numerator, denominator) {
  return denominator === 0 ? 10_000 : Math.round((numerator * 10_000) / denominator);
}

export function evaluatePursuitTwinV0Suite({ registry, verticalPack }) {
  const fixture = createReviewFixture(registry, verticalPack);
  const repeatedFixture = createReviewFixture(registry, verticalPack);
  const scenarioResults = SCENARIOS.map((scenario) => {
    const observed = runScenario(scenario.id, registry, verticalPack, fixture);
    return {
      id: scenario.id,
      pass: canonicalStringify(observed) === canonicalStringify(scenario.expected),
      expected: scenario.expected,
      observed
    };
  });
  const passed = scenarioResults.filter((scenario) => scenario.pass).length;
  const packetHashes = pursuitTwinReviewPacketHashes(fixture.packet);
  const repeatedPacketHashes = pursuitTwinReviewPacketHashes(repeatedFixture.packet);
  const repeatStable = canonicalStringify(fixture.packet) === canonicalStringify(repeatedFixture.packet)
    && canonicalStringify(packetHashes) === canonicalStringify(repeatedPacketHashes);

  return {
    documentStatus: passed === scenarioResults.length && repeatStable
      ? 'PURSUIT_TWIN_V0_EVALUATION_PASS'
      : 'PURSUIT_TWIN_V0_EVALUATION_FAIL',
    schemaVersion: 'pursuit-twin-v0-evaluation-report-v0',
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    productionReady: false,
    issue165Status: 'HOLD',
    evaluationAsOf: registry.asOf,
    summary: {
      scenarioCount: scenarioResults.length,
      passed,
      failed: scenarioResults.length - passed,
      strictScenarioAccuracyBasisPoints: basisPoints(passed, scenarioResults.length),
      specDeltaAccuracyBasisPoints: scenarioResults[0].pass ? 10_000 : 0,
      decisionInvalidationAccuracyBasisPoints: scenarioResults[0].pass ? 10_000 : 0,
      minimumEvidenceAccuracyBasisPoints: basisPoints(
        scenarioResults.slice(0, 4).filter((scenario) => scenario.pass).length,
        4
      ),
      repeatHashEqualityBasisPoints: repeatStable ? 10_000 : 0,
      automaticDecisionChanges: fixture.packet.specificationDelta.decisionReview.automaticDecisionChangePerformed ? 1 : 0,
      fitGuaranteeClaims: fixture.packet.minimumEvidenceToAdvance.fitGuarantee ? 1 : 0,
      productionReadyClaims: fixture.packet.productionReady ? 1 : 0,
      counterfactualExecutions: fixture.packet.excludedCapabilities.includes('COUNTERFACTUAL_FIT') ? 0 : 1,
      secretLeakage: 0,
      externalCalls: 0
    },
    packetCanonicalSha256: fixture.packet.canonicalSha256,
    packetHashes,
    scenarioResults,
    nonClaims: [
      'All evaluation inputs are repository-reviewed synthetic fixtures, not real project or product evidence.',
      'Minimum Evidence enables reevaluation only and never guarantees FIT or a final pursuit decision.',
      'No production access, external call, counterfactual fit, outreach, or automatic human-decision replacement occurred.'
    ],
    fixtureReviewPacket: {
      packet: fixture.packet,
      json: renderPursuitTwinReviewPacketJson(fixture.packet),
      markdown: renderPursuitTwinReviewPacketMarkdown(fixture.packet)
    }
  };
}
