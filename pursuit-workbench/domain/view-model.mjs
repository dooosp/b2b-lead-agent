import {
  assertSafeArtifact,
  assertValidatedClaimRegistry,
  ClaimValidationError,
  canonicalStringify,
  sha256
} from '../../knowledge/claim-registry/index.mjs';
import {
  buildPursuitDossier,
  dossierHashes,
  validateProjectOpportunity
} from '../../verticals/datacenter/index.mjs';
import {
  assertValidatedProjectSignalTimeline
} from './timeline.mjs';
import {
  REVIEW_ACKNOWLEDGEMENT_POLICY_ID,
  REVIEW_ACKNOWLEDGEMENT_TEXT,
  REVIEW_DISPOSITIONS,
  REVIEW_POLICY_SCHEMA_VERSION
} from './review-packet.mjs';

export const WORKBENCH_VIEW_MODEL_SCHEMA_VERSION = 'datacenter-pursuit-workbench-v0';
export const WORKBENCH_VIEW_MODEL_LIMITS = Object.freeze({
  maxBytes: 512 * 1024,
  maxAllowedClaims: 100,
  maxBlockedClaims: 100,
  maxQuestions: 100,
  maxProductFamilies: 20
});

const VALIDATED_VIEW_MODELS = new WeakSet();
const ACTIVE_WINDOWS = new Set(['OPEN', 'CLOSING', 'RETROFIT_OPEN']);
const PROJECT_EVIDENCE_CODES = new Set(['REQUIRED_PROJECT_FACT_MISSING', 'PROJECT_FACT_UNVERIFIED']);
const PRODUCT_EVIDENCE_CODES = new Set(['CAPABILITY_CLAIM_MISSING', 'CAPABILITY_CLAIM_UNVERIFIED', 'CAPABILITY_CLAIM_EXPIRED', 'CAPABILITY_CLAIM_RETRACTED']);
const ESCALATION_CODES = new Set(['CLAIM_CONFLICT', 'PROJECT_STAGE_CONFLICTED', 'UNIT_INCOMPATIBLE', 'JURISDICTION_MISMATCH', 'CONDITION_MISMATCH']);
const NEXT_DISPOSITION_PRIORITY = Object.freeze([
  'REJECT_TECHNICAL_MISMATCH',
  'ESCALATE_DOMAIN_EXPERT',
  'HOLD_FOR_PROJECT_EVIDENCE',
  'HOLD_FOR_PRODUCT_EVIDENCE',
  'HOLD_FOR_TECHNICAL_REQUIREMENTS',
  'DEFER_FOR_PROJECT_STAGE',
  'READY_FOR_TECHNICAL_REVIEW'
]);

function compareAscii(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) deepFreeze(nested);
  return value;
}

function canonicalClone(value) {
  return JSON.parse(canonicalStringify(value));
}

function formatTechnicalValue(value) {
  if (!value || typeof value !== 'object') return 'UNKNOWN';
  if (Object.hasOwn(value, 'minimum') || Object.hasOwn(value, 'maximum')) {
    return `${value.minimum ?? '?'}–${value.maximum ?? '?'}${value.unit ? ` ${value.unit}` : ''}`;
  }
  const rendered = Array.isArray(value.value) ? value.value.join(', ') : String(value.value ?? 'UNKNOWN');
  return `${rendered}${value.unit ? ` ${value.unit}` : ''}`;
}

function assertProductFamilyMap(productFamilyMap, verticalPack) {
  if (!productFamilyMap
    || productFamilyMap.schemaVersion !== 'datacenter-product-family-map-v0'
    || productFamilyMap.verticalId !== verticalPack.verticalId
    || productFamilyMap.mappingsAreVerifiedCapabilities !== false
    || !Array.isArray(productFamilyMap.families)
    || productFamilyMap.families.length > WORKBENCH_VIEW_MODEL_LIMITS.maxProductFamilies) {
    throw new ClaimValidationError('WORKBENCH_PRODUCT_MAP_INVALID', '$.productFamilyMap');
  }
  const ids = productFamilyMap.families.map((family) => family?.id);
  if (new Set(ids).size !== ids.length || ids.some((id) => typeof id !== 'string' || !verticalPack.specificationWindows?.[id])) {
    throw new ClaimValidationError('WORKBENCH_PRODUCT_MAP_INVALID', '$.productFamilyMap.families');
  }
  if (productFamilyMap.families.some((family) => typeof family.displayNameKo !== 'string'
    || typeof family.displayNameEn !== 'string'
    || !family.displayNameKo.trim()
    || !family.displayNameEn.trim()
    || family.displayNameKo.length > 160
    || family.displayNameEn.length > 160)) {
    throw new ClaimValidationError('WORKBENCH_PRODUCT_MAP_INVALID', '$.productFamilyMap.families');
  }
}

function buildRequirementDetail(requirementResult, opportunity, registry) {
  const requirement = opportunity.requirements.find((item) => item.requirementId === requirementResult.requirementId);
  if (!requirement) throw new ClaimValidationError('WORKBENCH_REQUIREMENT_UNKNOWN', `$.evaluation.${requirementResult.requirementId}`);
  const projectValues = requirementResult.projectClaimIds.map((claimId) => registry.byId.get(claimId)).filter(Boolean).map((claim) => formatTechnicalValue(claim.value));
  const capabilityValues = requirementResult.capabilityClaimIds.map((claimId) => registry.byId.get(claimId)).filter(Boolean).map((claim) => formatTechnicalValue(claim.value));
  return {
    requirementId: requirement.requirementId,
    category: requirement.category,
    key: requirement.key,
    priority: requirement.priority,
    valueState: requirement.valueState,
    operator: requirement.operator,
    requiredValue: formatTechnicalValue(requirement.value),
    projectValues: [...new Set(projectValues)].sort(compareAscii),
    capabilityValues: [...new Set(capabilityValues)].sort(compareAscii),
    state: requirementResult.state,
    reasonCodes: [...new Set(requirementResult.reasons.map((reason) => reason.code))].sort(compareAscii),
    projectClaimIds: requirementResult.projectClaimIds,
    capabilityClaimIds: requirementResult.capabilityClaimIds
  };
}

function supportedDisposition(value, supported, reasonCodes) {
  return {
    value,
    supported,
    reasonCodes: supported ? [...new Set(reasonCodes)].sort(compareAscii) : []
  };
}

function buildReviewPolicy(fitMatrix, projectStage, blockedClaims, conflicts, technicalQuestions) {
  const blockedIds = new Set(blockedClaims.map((claim) => claim.claimId));
  const conflictIds = new Set(conflicts.flatMap((conflict) => [conflict.claimId, ...conflict.conflictClaimIds]));
  const families = fitMatrix.map((row) => {
    const reasons = new Set([...row.reasonCodes, ...row.specificationWindow.reasonCodes]);
    const traceIds = [...row.projectClaimIds, ...row.capabilityClaimIds, ...row.specificationWindow.stageClaimIds];
    const completeTrace = row.hardMatches.length > 0 && row.projectClaimIds.length > 0 && row.capabilityClaimIds.length > 0
      && traceIds.every((claimId) => !blockedIds.has(claimId) && !conflictIds.has(claimId));
    const blockingMissing = row.missingRequirements.some((item) => item.criticality === 'BLOCKING');
    const ready = row.result === 'FIT' && ACTIVE_WINDOWS.has(row.specificationWindow.state) && !blockingMissing && completeTrace;
    const projectReasons = [...reasons].filter((code) => PROJECT_EVIDENCE_CODES.has(code));
    const productReasons = [...reasons].filter((code) => PRODUCT_EVIDENCE_CODES.has(code));
    const escalationReasons = [...reasons].filter((code) => ESCALATION_CODES.has(code));
    const technicalHold = blockingMissing || reasons.has('NO_EVALUABLE_REQUIREMENTS');
    const defer = row.result !== 'NOT_FIT' && (
      ['NOT_OPEN_YET', 'CLOSED'].includes(row.specificationWindow.state)
      || (row.specificationWindow.state === 'UNKNOWN' && reasons.has('PROJECT_STAGE_UNKNOWN'))
    );
    const rejectReasons = [...reasons].filter((code) => ['HARD_REQUIREMENT_MISMATCH', 'HARD_DISQUALIFIER_TRIGGERED'].includes(code));
    const dispositions = REVIEW_DISPOSITIONS.map((value) => {
      if (value === 'READY_FOR_TECHNICAL_REVIEW') return supportedDisposition(value, ready, ['VERIFIED_FIT_TRACE', ...row.specificationWindow.reasonCodes]);
      if (value === 'HOLD_FOR_PROJECT_EVIDENCE') return supportedDisposition(value, projectReasons.length > 0, projectReasons);
      if (value === 'HOLD_FOR_PRODUCT_EVIDENCE') return supportedDisposition(value, productReasons.length > 0, productReasons);
      if (value === 'HOLD_FOR_TECHNICAL_REQUIREMENTS') return supportedDisposition(value, technicalHold, ['REQUIRED_TECHNICAL_INPUT_MISSING', ...row.missingRequirements.flatMap((item) => item.reasonCodes)]);
      if (value === 'DEFER_FOR_PROJECT_STAGE') return supportedDisposition(value, defer, row.specificationWindow.reasonCodes);
      if (value === 'REJECT_TECHNICAL_MISMATCH') return supportedDisposition(value, row.result === 'NOT_FIT' && rejectReasons.length > 0, rejectReasons);
      if (value === 'ESCALATE_DOMAIN_EXPERT') return supportedDisposition(value, escalationReasons.length > 0, [...escalationReasons, 'DOMAIN_EXPERT_REQUIRED']);
      throw new ClaimValidationError('WORKBENCH_REVIEW_DISPOSITION_UNKNOWN', '$.reviewPolicy');
    });
    return {
      productFamilyId: row.productFamily.id,
      dispositions,
      questionIds: technicalQuestions.filter((question) => question.productFamilyIds.includes(row.productFamily.id)).map((question) => question.questionId).sort(compareAscii)
    };
  });
  return {
    schemaVersion: REVIEW_POLICY_SCHEMA_VERSION,
    acknowledgement: {
      policyId: REVIEW_ACKNOWLEDGEMENT_POLICY_ID,
      text: REVIEW_ACKNOWLEDGEMENT_TEXT
    },
    families
  };
}

function nextSupportedDisposition(reviewPolicy) {
  const supported = new Set(reviewPolicy.families.flatMap((family) => family.dispositions.filter((item) => item.supported).map((item) => item.value)));
  return NEXT_DISPOSITION_PRIORITY.find((value) => supported.has(value)) || 'NO_SUPPORTED_TECHNICAL_DISPOSITION';
}

export function buildPursuitWorkbenchViewModel({
  scenario,
  opportunity,
  evaluation,
  dossier,
  suppliedDossierHashes,
  timeline,
  timelineSha256,
  registry,
  verticalPack,
  productFamilyMap
}) {
  assertValidatedClaimRegistry(registry);
  validateProjectOpportunity(opportunity, verticalPack);
  assertValidatedProjectSignalTimeline(timeline);
  assertProductFamilyMap(productFamilyMap, verticalPack);
  if (!scenario || typeof scenario.id !== 'string' || !/^[a-z0-9_]{1,64}$/.test(scenario.id)
    || typeof scenario.title !== 'string' || scenario.title.length > 160
    || typeof scenario.description !== 'string' || scenario.description.length > 500) {
    throw new ClaimValidationError('WORKBENCH_SCENARIO_INVALID', '$.scenario');
  }
  const recomputedDossier = buildPursuitDossier(opportunity, evaluation, registry, verticalPack);
  if (canonicalStringify(recomputedDossier) !== canonicalStringify(dossier)) throw new ClaimValidationError('WORKBENCH_DOSSIER_FORGED', '$.dossier');
  const recomputedHashes = dossierHashes(recomputedDossier);
  if (canonicalStringify(recomputedHashes) !== canonicalStringify(suppliedDossierHashes)) throw new ClaimValidationError('WORKBENCH_DOSSIER_HASH_MISMATCH', '$.dossierHashes');
  if (timelineSha256 !== sha256(timeline) || timeline.sourceHashes.dossierJsonSha256 !== recomputedHashes.jsonSha256) {
    throw new ClaimValidationError('WORKBENCH_TIMELINE_HASH_MISMATCH', '$.timeline');
  }
  const familyById = new Map(productFamilyMap.families.map((family) => [family.id, family]));
  const missingByFamily = new Map();
  for (const item of recomputedDossier.missingTechnicalRequirements) {
    for (const productFamilyId of item.productFamilyIds) {
      const list = missingByFamily.get(productFamilyId) || [];
      const evaluationRow = evaluation.results.find((result) => result.productFamilyId === productFamilyId);
      const reasonCodes = evaluationRow?.requirementResults.find((result) => result.requirementId === item.requirementId)?.reasons.map((reason) => reason.code) || [];
      list.push({ ...item, expectedValue: formatTechnicalValue(item.expectedValue), reasonCodes: [...new Set(reasonCodes)].sort(compareAscii) });
      missingByFamily.set(productFamilyId, list);
    }
  }
  const fitMatrix = evaluation.results.map((result) => {
    const family = familyById.get(result.productFamilyId);
    if (!family) throw new ClaimValidationError('WORKBENCH_PRODUCT_FAMILY_UNKNOWN', `$.evaluation.${result.productFamilyId}`);
    const details = result.requirementResults.map((requirementResult) => buildRequirementDetail(requirementResult, opportunity, registry));
    return {
      productFamily: { id: family.id, displayNameKo: family.displayNameKo, displayNameEn: family.displayNameEn },
      result: result.result,
      specificationWindow: result.window,
      hardMatches: details.filter((item) => item.priority === 'HARD' && item.state === 'VERIFIED_MATCH'),
      hardMismatches: details.filter((item) => item.priority === 'HARD' && item.state === 'VERIFIED_MISMATCH'),
      missingRequirements: missingByFamily.get(result.productFamilyId) || [],
      reasonCodes: [...new Set(result.reasons.map((reason) => reason.code))].sort(compareAscii),
      projectClaimIds: result.projectClaimIds || [],
      capabilityClaimIds: result.capabilityClaimIds || [],
      projectClaimCount: (result.projectClaimIds || []).length,
      capabilityClaimCount: (result.capabilityClaimIds || []).length
    };
  });
  const technicalQuestions = recomputedDossier.recommendedTechnicalQuestions.map((question) => {
    const missing = recomputedDossier.missingTechnicalRequirements.filter((item) => item.requirementId === question.requirementId);
    return {
      ...question,
      productFamilyIds: [...new Set(missing.flatMap((item) => item.productFamilyIds))].sort(compareAscii),
      blockingState: missing.some((item) => item.criticality === 'BLOCKING') ? 'BLOCKING' : 'ADVISORY'
    };
  });
  if (technicalQuestions.length > WORKBENCH_VIEW_MODEL_LIMITS.maxQuestions
    || recomputedDossier.customerUsableClaims.length > WORKBENCH_VIEW_MODEL_LIMITS.maxAllowedClaims
    || recomputedDossier.blockedClaims.length > WORKBENCH_VIEW_MODEL_LIMITS.maxBlockedClaims) {
    throw new ClaimValidationError('WORKBENCH_COLLECTION_LIMIT_EXCEEDED', '$.viewModel');
  }
  const projectStage = recomputedDossier.projectStage;
  const reviewPolicy = buildReviewPolicy(fitMatrix, projectStage, recomputedDossier.blockedClaims, recomputedDossier.conflictingClaims, technicalQuestions);
  const viewModel = canonicalClone({
    schemaVersion: WORKBENCH_VIEW_MODEL_SCHEMA_VERSION,
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    productionReady: false,
    productionReviewerWorkflowReady: false,
    issue165Status: 'HOLD',
    synthetic: true,
    persistence: 'NONE',
    reviewerIdentity: 'NOT_COLLECTED',
    scenario: { id: scenario.id, title: scenario.title, description: scenario.description },
    asOf: registry.asOf,
    project: {
      opportunityId: opportunity.opportunityId,
      accountDisplayName: opportunity.identity.accountDisplayName,
      projectDisplayName: opportunity.identity.projectDisplayName,
      facilityDisplayName: opportunity.identity.facilityDisplayName,
      jurisdiction: opportunity.jurisdiction,
      verticalId: opportunity.verticalId
    },
    projectStage,
    technicalPursuitSummary: {
      technicalPursuitState: recomputedDossier.decision.technicalPursuitState,
      overallEvaluationState: fitMatrix.length === 0 ? 'NOT_EVALUATED' : 'EVALUATED',
      fitFamilyCount: fitMatrix.filter((row) => row.result === 'FIT').length,
      conditionalFitFamilyCount: fitMatrix.filter((row) => row.result === 'CONDITIONAL_FIT').length,
      notFitFamilyCount: fitMatrix.filter((row) => row.result === 'NOT_FIT').length,
      insufficientEvidenceFamilyCount: fitMatrix.filter((row) => row.result === 'INSUFFICIENT_EVIDENCE').length,
      notEvaluatedFamilyCount: fitMatrix.filter((row) => row.result === 'NOT_EVALUATED').length,
      missingBlockingRequirementCount: recomputedDossier.missingTechnicalRequirements.filter((item) => item.criticality === 'BLOCKING').length,
      conflictedClaimCount: recomputedDossier.conflictingClaims.length,
      overallSpecificationWindow: fitMatrix.length === 0 ? 'UNKNOWN' : new Set(fitMatrix.map((row) => row.specificationWindow.state)).size === 1 ? fitMatrix[0].specificationWindow.state : 'MIXED',
      nextTechnicalAction: nextSupportedDisposition(reviewPolicy)
    },
    timeline: timeline.events,
    fitMatrix,
    hardMatches: fitMatrix.flatMap((row) => row.hardMatches.map((item) => ({ productFamilyId: row.productFamily.id, ...item }))),
    hardMismatches: fitMatrix.flatMap((row) => row.hardMismatches.map((item) => ({ productFamilyId: row.productFamily.id, ...item }))),
    missingRequirements: recomputedDossier.missingTechnicalRequirements.map((item) => ({ ...item, expectedValue: formatTechnicalValue(item.expectedValue) })),
    conflicts: recomputedDossier.conflictingClaims,
    allowedClaims: recomputedDossier.customerUsableClaims,
    blockedClaims: recomputedDossier.blockedClaims,
    technicalQuestions,
    explicitNonClaims: recomputedDossier.explicitNonClaims,
    productMappingDisclaimer: 'Product-family labels are taxonomy only; mappings are not verified capability evidence.',
    artifactHashes: {
      dossierJsonSha256: recomputedHashes.jsonSha256,
      dossierMarkdownSha256: recomputedHashes.markdownSha256,
      timelineSha256
    }
  });
  viewModel.reviewPolicy = reviewPolicy;
  const finalized = canonicalClone(viewModel);
  assertSafeArtifact(finalized, '$.viewModel');
  if (Buffer.byteLength(canonicalStringify(finalized), 'utf8') > WORKBENCH_VIEW_MODEL_LIMITS.maxBytes) {
    throw new ClaimValidationError('WORKBENCH_VIEW_MODEL_TOO_LARGE', '$.viewModel');
  }
  deepFreeze(finalized);
  VALIDATED_VIEW_MODELS.add(finalized);
  return finalized;
}

export function assertValidatedPursuitWorkbenchViewModel(viewModel, path = '$.viewModel') {
  if (!VALIDATED_VIEW_MODELS.has(viewModel)) throw new ClaimValidationError('UNVALIDATED_WORKBENCH_VIEW_MODEL', path);
  return true;
}
