import {
  assertSafeArtifact,
  CLAIM_LIMITS,
  ClaimValidationError,
  canonicalStringify,
  deriveCustomerUse,
  renderMarkdownCell,
  sha256
} from '../../knowledge/claim-registry/index.mjs';

export const FIT_RESULTS = Object.freeze(['FIT', 'CONDITIONAL_FIT', 'NOT_FIT', 'INSUFFICIENT_EVIDENCE', 'NOT_EVALUATED']);
export const WINDOW_STATES = Object.freeze(['UNKNOWN', 'NOT_OPEN_YET', 'OPEN', 'CLOSING', 'CLOSED', 'RETROFIT_OPEN', 'BLOCKED_CANCELLED']);
export const DATACENTER_LIMITS = Object.freeze({
  maxProductFamiliesPerOpportunity: 20,
  maxRequirementsPerOpportunity: 100,
  maxEvidenceRefsPerRequirement: 10,
  maxConditionsPerOpportunity: 20,
  maxDossierBytes: 1_000_000
});

const REQUIREMENT_PRIORITIES = new Set(['HARD', 'SOFT']);
const REQUIREMENT_VALUE_STATES = new Set(['KNOWN', 'UNKNOWN', 'CONFLICTED', 'NOT_APPLICABLE']);
const REQUIREMENT_OPERATORS = new Set(['EQ', 'GTE', 'LTE', 'IN', 'CONTAINS_ALL', 'BETWEEN']);
const REQUIREMENT_CATEGORIES = new Set(['electrical_power', 'cooling', 'controls_bms', 'energy_management', 'fire_detection', 'physical_security', 'commissioning']);

const REASON_ORDER = Object.freeze([
  'PROJECT_CANCELLED',
  'HARD_REQUIREMENT_MISMATCH',
  'HARD_DISQUALIFIER_TRIGGERED',
  'CLAIM_CONFLICT',
  'CAPABILITY_CLAIM_RETRACTED',
  'REQUIRED_PROJECT_FACT_MISSING',
  'PROJECT_FACT_UNVERIFIED',
  'CAPABILITY_CLAIM_MISSING',
  'CAPABILITY_CLAIM_UNVERIFIED',
  'CAPABILITY_CLAIM_EXPIRED',
  'JURISDICTION_MISMATCH',
  'CONDITION_MISMATCH',
  'UNIT_INCOMPATIBLE',
  'HARD_REQUIREMENT_MATCH',
  'SOFT_REQUIREMENT_MATCH',
  'SOFT_REQUIREMENT_MISMATCH',
  'SOFT_REQUIREMENT_UNKNOWN',
  'UNIT_CONVERTED',
  'NO_EVALUABLE_REQUIREMENTS',
  'PROJECT_STAGE_UNKNOWN',
  'PROJECT_STAGE_CONFLICTED',
  'SPEC_WINDOW_NOT_OPEN_YET',
  'SPEC_WINDOW_OPEN',
  'SPEC_WINDOW_CLOSING',
  'SPEC_WINDOW_CLOSED',
  'RETROFIT_PATH_AVAILABLE',
  'RETROFIT_PATH_REQUIRES_EVIDENCE'
]);

const REASON_RANK = new Map(REASON_ORDER.map((code, index) => [code, index]));
const UNIT_TABLE = Object.freeze({
  V: { kind: 'voltage', factor: 1 },
  kV: { kind: 'voltage', factor: 1_000 },
  kW: { kind: 'active_power', factor: 1 },
  MW: { kind: 'active_power', factor: 1_000 },
  kVA: { kind: 'apparent_power', factor: 1 },
  MVA: { kind: 'apparent_power', factor: 1_000 },
  kWh: { kind: 'energy', factor: 1 },
  MWh: { kind: 'energy', factor: 1_000 },
  kW_th: { kind: 'thermal_power', factor: 1 },
  MW_th: { kind: 'thermal_power', factor: 1_000 },
  min: { kind: 'duration', factor: 1 },
  h: { kind: 'duration', factor: 60 },
  d: { kind: 'duration', factor: 1_440 },
  degC: { kind: 'temperature', factor: 1 },
  percent: { kind: 'percentage', factor: 1 },
  ratio: { kind: 'ratio', factor: 1 },
  count: { kind: 'count', factor: 1 }
});

function compareAscii(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertStringArray(value, path, maximum, { allowEmpty = true } = {}) {
  if (!Array.isArray(value) || value.length > maximum || (!allowEmpty && value.length === 0)) {
    throw new ClaimValidationError('INVALID_STRING_ARRAY', path);
  }
  if (value.some((item) => typeof item !== 'string' || !item.trim())) throw new ClaimValidationError('INVALID_STRING_ARRAY', path);
}

export function validateProjectOpportunity(opportunity, verticalPack) {
  assertSafeArtifact(opportunity, '$.opportunity');
  if (!isPlainObject(opportunity)) throw new ClaimValidationError('INVALID_OPPORTUNITY', '$.opportunity');
  for (const field of ['fitResult', 'verificationStatus', 'customerUse', 'finalDecision']) {
    if (Object.hasOwn(opportunity, field)) throw new ClaimValidationError('MODEL_AUTHORITY_FIELD_REFUSED', `$.opportunity.${field}`);
  }
  if (opportunity.schemaVersion !== 'project-opportunity-v0') throw new ClaimValidationError('UNSUPPORTED_OPPORTUNITY_SCHEMA', '$.opportunity.schemaVersion');
  if (opportunity.synthetic !== true) throw new ClaimValidationError('SYNTHETIC_OPPORTUNITY_REQUIRED', '$.opportunity.synthetic');
  if (typeof opportunity.opportunityId !== 'string' || !opportunity.opportunityId.trim()) throw new ClaimValidationError('OPPORTUNITY_ID_REQUIRED', '$.opportunity.opportunityId');
  if (opportunity.verticalId !== verticalPack?.verticalId) throw new ClaimValidationError('VERTICAL_MISMATCH', '$.opportunity.verticalId');
  if (typeof opportunity.jurisdiction !== 'string' || !opportunity.jurisdiction.trim()) throw new ClaimValidationError('JURISDICTION_REQUIRED', '$.opportunity.jurisdiction');
  if (!isPlainObject(opportunity.identity)) throw new ClaimValidationError('OPPORTUNITY_IDENTITY_REQUIRED', '$.opportunity.identity');
  for (const field of ['opportunityId', 'accountDisplayName', 'projectDisplayName', 'facilityDisplayName', 'verticalId', 'jurisdiction']) {
    if (typeof opportunity.identity[field] !== 'string' || !opportunity.identity[field].trim()) {
      throw new ClaimValidationError('OPPORTUNITY_IDENTITY_FIELD_REQUIRED', `$.opportunity.identity.${field}`);
    }
  }
  if (opportunity.identity.opportunityId !== opportunity.opportunityId || opportunity.identity.verticalId !== opportunity.verticalId || opportunity.identity.jurisdiction !== opportunity.jurisdiction) {
    throw new ClaimValidationError('OPPORTUNITY_IDENTITY_MISMATCH', '$.opportunity.identity');
  }
  if (!isPlainObject(opportunity.stage) || !verticalPack.projectStages.includes(opportunity.stage.value)) {
    throw new ClaimValidationError('INVALID_PROJECT_STAGE', '$.opportunity.stage');
  }
  assertStringArray(opportunity.stage.evidenceClaimRefs || [], '$.opportunity.stage.evidenceClaimRefs', DATACENTER_LIMITS.maxEvidenceRefsPerRequirement);
  assertStringArray(opportunity.candidateProductFamilyIds, '$.opportunity.candidateProductFamilyIds', DATACENTER_LIMITS.maxProductFamiliesPerOpportunity);
  if (new Set(opportunity.candidateProductFamilyIds).size !== opportunity.candidateProductFamilyIds.length) {
    throw new ClaimValidationError('DUPLICATE_PRODUCT_FAMILY', '$.opportunity.candidateProductFamilyIds');
  }
  if (!Array.isArray(opportunity.requirements) || opportunity.requirements.length > DATACENTER_LIMITS.maxRequirementsPerOpportunity) {
    throw new ClaimValidationError('INVALID_REQUIREMENTS', '$.opportunity.requirements');
  }
  if (!isPlainObject(opportunity.conditions || {}) || Object.keys(opportunity.conditions || {}).length > DATACENTER_LIMITS.maxConditionsPerOpportunity) {
    throw new ClaimValidationError('INVALID_OPPORTUNITY_CONDITIONS', '$.opportunity.conditions');
  }
  const requirementIds = new Set();
  opportunity.requirements.forEach((requirement, index) => {
    const path = `$.opportunity.requirements[${index}]`;
    if (!isPlainObject(requirement) || typeof requirement.requirementId !== 'string' || !requirement.requirementId.trim()) {
      throw new ClaimValidationError('INVALID_REQUIREMENT', path);
    }
    if (requirementIds.has(requirement.requirementId)) throw new ClaimValidationError('DUPLICATE_REQUIREMENT_ID', `${path}.requirementId`);
    requirementIds.add(requirement.requirementId);
    if (!REQUIREMENT_CATEGORIES.has(requirement.category)) throw new ClaimValidationError('INVALID_REQUIREMENT_CATEGORY', `${path}.category`);
    if (typeof requirement.key !== 'string' || !requirement.key.trim()) throw new ClaimValidationError('REQUIREMENT_KEY_REQUIRED', `${path}.key`);
    assertStringArray(requirement.productFamilyIds, `${path}.productFamilyIds`, DATACENTER_LIMITS.maxProductFamiliesPerOpportunity, { allowEmpty: false });
    if (requirement.productFamilyIds.some((id) => !opportunity.candidateProductFamilyIds.includes(id))) {
      throw new ClaimValidationError('REQUIREMENT_PRODUCT_FAMILY_NOT_CANDIDATE', `${path}.productFamilyIds`);
    }
    if (!REQUIREMENT_PRIORITIES.has(requirement.priority)) throw new ClaimValidationError('INVALID_REQUIREMENT_PRIORITY', `${path}.priority`);
    if (!REQUIREMENT_VALUE_STATES.has(requirement.valueState)) throw new ClaimValidationError('INVALID_REQUIREMENT_VALUE_STATE', `${path}.valueState`);
    if (!REQUIREMENT_OPERATORS.has(requirement.operator)) throw new ClaimValidationError('INVALID_REQUIREMENT_OPERATOR', `${path}.operator`);
    if (!isPlainObject(requirement.value) || typeof requirement.value.type !== 'string' || typeof requirement.value.key !== 'string' || requirement.value.key !== requirement.key) {
      throw new ClaimValidationError('INVALID_REQUIREMENT_VALUE', `${path}.value`);
    }
    assertStringArray(requirement.evidenceClaimRefs || [], `${path}.evidenceClaimRefs`, DATACENTER_LIMITS.maxEvidenceRefsPerRequirement);
  });
  return opportunity;
}

function normalizeAlias(value) {
  return String(value || '').normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
}

function reason(code, requirementId, side, projectClaimIds = [], capabilityClaimIds = []) {
  return {
    code,
    requirementId: requirementId || null,
    side: side || null,
    projectClaimIds: [...projectClaimIds].sort(compareAscii),
    capabilityClaimIds: [...capabilityClaimIds].sort(compareAscii)
  };
}

function sortReasons(reasons) {
  return reasons.sort((left, right) => {
    const rank = (REASON_RANK.get(left.code) ?? 999) - (REASON_RANK.get(right.code) ?? 999);
    if (rank !== 0) return rank;
    return compareAscii(
      `${left.requirementId || ''}\0${left.projectClaimIds.join(',')}\0${left.capabilityClaimIds.join(',')}`,
      `${right.requirementId || ''}\0${right.projectClaimIds.join(',')}\0${right.capabilityClaimIds.join(',')}`
    );
  });
}

function getClaim(registry, reference) {
  return registry.byKey.get(reference) || registry.byId.get(reference) || null;
}

function getClaims(registry, references = []) {
  const claims = [...new Set(references)].map((reference) => getClaim(registry, reference)).filter(Boolean);
  return [...new Map(claims.map((claim) => [claim.claimId, claim])).values()];
}

function convertQuantity(value, unit, quantityKind) {
  const definition = UNIT_TABLE[unit];
  if (!definition || definition.kind !== quantityKind || !Number.isFinite(value)) return null;
  return value * definition.factor;
}

function compareScalar(capability, requirement, operator) {
  if (operator === 'EQ') {
    if ((Array.isArray(capability) || isPlainObject(capability)) && (Array.isArray(requirement) || isPlainObject(requirement))) {
      return canonicalStringify(capability) === canonicalStringify(requirement);
    }
    return capability === requirement;
  }
  if (operator === 'GTE') return capability >= requirement;
  if (operator === 'LTE') return capability <= requirement;
  if (operator === 'IN') return Array.isArray(requirement) && requirement.includes(capability);
  if (operator === 'CONTAINS_ALL') {
    return Array.isArray(capability) && Array.isArray(requirement) && requirement.every((item) => capability.includes(item));
  }
  return false;
}

function compareValues(capabilityValue, requirementValue, operator) {
  const capabilityUnit = capabilityValue.unit || '';
  const requirementUnit = requirementValue.unit || '';
  if (capabilityUnit || requirementUnit) {
    if (!capabilityUnit || !requirementUnit || capabilityValue.quantityKind !== requirementValue.quantityKind) {
      return { evaluable: false, reasonCode: 'UNIT_INCOMPATIBLE' };
    }
    const capability = convertQuantity(capabilityValue.value, capabilityUnit, capabilityValue.quantityKind);
    const requirement = convertQuantity(requirementValue.value, requirementUnit, requirementValue.quantityKind);
    if (capability === null || requirement === null) return { evaluable: false, reasonCode: 'UNIT_INCOMPATIBLE' };
    return { evaluable: true, matched: compareScalar(capability, requirement, operator), converted: capabilityUnit !== requirementUnit };
  }
  if (operator === 'BETWEEN') {
    const capabilityMinimum = capabilityValue.minimum;
    const capabilityMaximum = capabilityValue.maximum;
    const requirementMinimum = requirementValue.minimum;
    const requirementMaximum = requirementValue.maximum;
    if (![capabilityMinimum, capabilityMaximum, requirementMinimum, requirementMaximum].every(Number.isFinite)) {
      return { evaluable: false, reasonCode: 'UNIT_INCOMPATIBLE' };
    }
    return { evaluable: true, matched: capabilityMinimum <= requirementMinimum && capabilityMaximum >= requirementMaximum, converted: false };
  }
  return { evaluable: true, matched: compareScalar(capabilityValue.value, requirementValue.value, operator), converted: false };
}

function claimApplicability(claim, opportunity, productFamilyId) {
  if (claim.synthetic !== (opportunity.synthetic === true)) return { matched: false, code: 'CONDITION_MISMATCH' };
  if (claim.applicability.verticalId !== opportunity.verticalId) return { matched: false, code: 'CONDITION_MISMATCH' };
  if (claim.applicability.jurisdictions.length === 0 || !claim.applicability.jurisdictions.includes(opportunity.jurisdiction)) {
    return { matched: false, code: 'JURISDICTION_MISMATCH' };
  }
  if (claim.applicability.productFamilyIds.length > 0 && !claim.applicability.productFamilyIds.includes(productFamilyId)) {
    return { matched: false, code: 'CONDITION_MISMATCH' };
  }
  if (claim.applicability.projectStages.length > 0 && !claim.applicability.projectStages.includes(opportunity.stage.value)) {
    return { matched: false, code: 'CONDITION_MISMATCH' };
  }
  const contextConditions = opportunity.conditions || {};
  if (!claim.applicability.conditions.every((condition) => contextConditions[condition.id] === condition.value)) {
    return { matched: false, code: 'CONDITION_MISMATCH' };
  }
  return { matched: true };
}

function evaluateRequirement(requirement, productFamilyId, opportunity, registry) {
  const reasons = [];
  const projectClaims = getClaims(registry, requirement.evidenceClaimRefs || []);
  const projectClaimIds = projectClaims.map((claim) => claim.claimId);
  if (requirement.valueState === 'NOT_APPLICABLE') return { state: 'NOT_APPLICABLE', reasons, projectClaimIds, capabilityClaimIds: [] };
  if (requirement.valueState === 'UNKNOWN' || projectClaims.length === 0) {
    reasons.push(reason(requirement.priority === 'HARD' ? 'REQUIRED_PROJECT_FACT_MISSING' : 'SOFT_REQUIREMENT_UNKNOWN', requirement.requirementId, 'PROJECT', projectClaimIds));
    return { state: 'UNKNOWN', reasons, projectClaimIds, capabilityClaimIds: [] };
  }
  if (requirement.valueState === 'CONFLICTED' || projectClaims.some((claim) => claim.status === 'CONFLICTED' || claim.status === 'RETRACTED')) {
    reasons.push(reason('CLAIM_CONFLICT', requirement.requirementId, 'PROJECT', projectClaimIds));
    return { state: 'CONFLICTED', reasons, projectClaimIds, capabilityClaimIds: [] };
  }
  if (projectClaims.some((claim) => claim.status !== 'VERIFIED')) {
    reasons.push(reason('PROJECT_FACT_UNVERIFIED', requirement.requirementId, 'PROJECT', projectClaimIds));
    return { state: 'UNKNOWN', reasons, projectClaimIds, capabilityClaimIds: [] };
  }
  for (const claim of projectClaims) {
    const applicability = claimApplicability(claim, opportunity, productFamilyId);
    if (!applicability.matched) {
      reasons.push(reason(applicability.code, requirement.requirementId, 'PROJECT', [claim.claimId]));
      return { state: 'UNKNOWN', reasons, projectClaimIds, capabilityClaimIds: [] };
    }
    const projectValueMatch = claim.value.key === requirement.key && compareValues(claim.value, requirement.value, requirement.operator);
    if (!projectValueMatch.evaluable || !projectValueMatch.matched) {
      reasons.push(reason('PROJECT_FACT_UNVERIFIED', requirement.requirementId, 'PROJECT', [claim.claimId]));
      return { state: 'UNKNOWN', reasons, projectClaimIds, capabilityClaimIds: [] };
    }
  }
  const capabilities = registry.claims.filter((claim) => (
    claim.claimType === 'PRODUCT_CAPABILITY'
    && claim.subject.id === productFamilyId
    && claim.value.key === requirement.key
  ));
  if (capabilities.length === 0) {
    reasons.push(reason('CAPABILITY_CLAIM_MISSING', requirement.requirementId, 'PRODUCT', projectClaimIds));
    return { state: 'UNKNOWN', reasons, projectClaimIds, capabilityClaimIds: [] };
  }
  const applicable = [];
  for (const claim of capabilities) {
    const applicability = claimApplicability(claim, opportunity, productFamilyId);
    if (!applicability.matched) {
      reasons.push(reason(applicability.code, requirement.requirementId, 'PRODUCT', projectClaimIds, [claim.claimId]));
    } else {
      applicable.push(claim);
    }
  }
  if (applicable.length === 0) return { state: 'UNKNOWN', reasons, projectClaimIds, capabilityClaimIds: capabilities.map((claim) => claim.claimId) };
  const conflicted = applicable.filter((claim) => claim.status === 'CONFLICTED' || claim.status === 'RETRACTED');
  if (conflicted.length > 0) {
    const code = conflicted.some((claim) => claim.status === 'RETRACTED') ? 'CAPABILITY_CLAIM_RETRACTED' : 'CLAIM_CONFLICT';
    reasons.push(reason(code, requirement.requirementId, 'PRODUCT', projectClaimIds, conflicted.map((claim) => claim.claimId)));
    return { state: 'CONFLICTED', reasons, projectClaimIds, capabilityClaimIds: applicable.map((claim) => claim.claimId) };
  }
  const verified = applicable.filter((claim) => claim.status === 'VERIFIED');
  if (verified.length > 0) {
    const comparisons = verified.map((claim) => ({ claim, comparison: compareValues(claim.value, requirement.value, requirement.operator) }));
    const unevaluable = comparisons.filter((item) => !item.comparison.evaluable);
    if (unevaluable.length > 0) {
      for (const item of unevaluable) reasons.push(reason(item.comparison.reasonCode, requirement.requirementId, 'BOTH', projectClaimIds, [item.claim.claimId]));
      return { state: 'UNKNOWN', reasons, projectClaimIds, capabilityClaimIds: verified.map((claim) => claim.claimId) };
    }
    const matched = comparisons.filter((item) => item.comparison.matched);
    const mismatched = comparisons.filter((item) => !item.comparison.matched);
    for (const item of comparisons.filter((entry) => entry.comparison.converted)) {
      reasons.push(reason('UNIT_CONVERTED', requirement.requirementId, 'BOTH', projectClaimIds, [item.claim.claimId]));
    }
    if (matched.length > 0 && mismatched.length > 0) {
      reasons.push(reason('CLAIM_CONFLICT', requirement.requirementId, 'PRODUCT', projectClaimIds, verified.map((claim) => claim.claimId)));
      return { state: 'CONFLICTED', reasons, projectClaimIds, capabilityClaimIds: verified.map((claim) => claim.claimId) };
    }
    const didMatch = matched.length > 0;
    const code = didMatch
      ? requirement.priority === 'HARD' ? 'HARD_REQUIREMENT_MATCH' : 'SOFT_REQUIREMENT_MATCH'
      : requirement.priority === 'HARD' ? 'HARD_REQUIREMENT_MISMATCH' : 'SOFT_REQUIREMENT_MISMATCH';
    reasons.push(reason(code, requirement.requirementId, 'BOTH', projectClaimIds, verified.map((claim) => claim.claimId)));
    return { state: didMatch ? 'VERIFIED_MATCH' : 'VERIFIED_MISMATCH', reasons, projectClaimIds, capabilityClaimIds: verified.map((claim) => claim.claimId) };
  }
  const expired = applicable.filter((claim) => claim.status === 'EXPIRED');
  if (expired.length > 0) {
    reasons.push(reason('CAPABILITY_CLAIM_EXPIRED', requirement.requirementId, 'PRODUCT', projectClaimIds, expired.map((claim) => claim.claimId)));
    return { state: 'POTENTIAL_MATCH', reasons, projectClaimIds, capabilityClaimIds: expired.map((claim) => claim.claimId) };
  }
  const unverified = applicable.filter((claim) => claim.status === 'UNVERIFIED' || claim.status === 'ASSUMPTION');
  if (unverified.length > 0) {
    const structuralMatch = unverified.some((claim) => compareValues(claim.value, requirement.value, requirement.operator).matched === true);
    reasons.push(reason('CAPABILITY_CLAIM_UNVERIFIED', requirement.requirementId, 'PRODUCT', projectClaimIds, unverified.map((claim) => claim.claimId)));
    return { state: structuralMatch ? 'POTENTIAL_MATCH' : 'UNKNOWN', reasons, projectClaimIds, capabilityClaimIds: unverified.map((claim) => claim.claimId) };
  }
  return { state: 'UNKNOWN', reasons, projectClaimIds, capabilityClaimIds: applicable.map((claim) => claim.claimId) };
}

export function evaluateSpecificationWindow(opportunity, productFamilyId, registry, verticalPack) {
  const policy = verticalPack.specificationWindows?.[productFamilyId];
  if (!policy) return { state: 'UNKNOWN', reasonCodes: ['PROJECT_STAGE_UNKNOWN'], stageClaimIds: [], policyId: null };
  const stageClaims = getClaims(registry, opportunity.stage?.evidenceClaimRefs || []);
  const stageClaimIds = stageClaims.map((claim) => claim.claimId).sort(compareAscii);
  if (!opportunity.stage || opportunity.stage.value === 'UNKNOWN' || stageClaims.length === 0) {
    return { state: 'UNKNOWN', reasonCodes: ['PROJECT_STAGE_UNKNOWN'], stageClaimIds, policyId: `${productFamilyId}_window_v0` };
  }
  if (stageClaims.some((claim) => claim.status === 'CONFLICTED' || claim.status === 'RETRACTED')) {
    return { state: 'UNKNOWN', reasonCodes: ['PROJECT_STAGE_CONFLICTED'], stageClaimIds, policyId: `${productFamilyId}_window_v0` };
  }
  if (stageClaims.some((claim) => claim.status !== 'VERIFIED')) {
    return { state: 'UNKNOWN', reasonCodes: ['PROJECT_STAGE_UNKNOWN'], stageClaimIds, policyId: `${productFamilyId}_window_v0` };
  }
  const stage = opportunity.stage.value;
  if (stageClaims.some((claim) => claim.claimType !== 'PROJECT_STAGE' || claim.value.key !== 'project_stage' || claim.value.value !== stage)) {
    return { state: 'UNKNOWN', reasonCodes: ['PROJECT_STAGE_CONFLICTED'], stageClaimIds, policyId: `${productFamilyId}_window_v0` };
  }
  if (stageClaims.some((claim) => !claimApplicability(claim, opportunity, productFamilyId).matched)) {
    return { state: 'UNKNOWN', reasonCodes: ['PROJECT_STAGE_UNKNOWN'], stageClaimIds, policyId: `${productFamilyId}_window_v0` };
  }
  if (stage === 'CANCELLED') return { state: 'BLOCKED_CANCELLED', reasonCodes: ['PROJECT_CANCELLED'], stageClaimIds, policyId: `${productFamilyId}_window_v0` };
  if (stage === 'RETROFIT') {
    return policy.retrofitApplicable
      ? { state: 'RETROFIT_OPEN', reasonCodes: ['RETROFIT_PATH_AVAILABLE'], stageClaimIds, policyId: `${productFamilyId}_window_v0` }
      : { state: 'CLOSED', reasonCodes: ['SPEC_WINDOW_CLOSED'], stageClaimIds, policyId: `${productFamilyId}_window_v0` };
  }
  const stages = verticalPack.projectStages;
  const position = stages.indexOf(stage);
  const first = stages.indexOf(policy.firstInfluenceStage);
  const finalOpen = stages.indexOf(policy.finalOpenStage);
  const closing = stages.indexOf(policy.closingStage);
  if (position < 0) return { state: 'UNKNOWN', reasonCodes: ['PROJECT_STAGE_UNKNOWN'], stageClaimIds, policyId: `${productFamilyId}_window_v0` };
  if (position < first) return { state: 'NOT_OPEN_YET', reasonCodes: ['SPEC_WINDOW_NOT_OPEN_YET'], stageClaimIds, policyId: `${productFamilyId}_window_v0` };
  if (position <= finalOpen) return { state: 'OPEN', reasonCodes: ['SPEC_WINDOW_OPEN'], stageClaimIds, policyId: `${productFamilyId}_window_v0` };
  if (position === closing) return { state: 'CLOSING', reasonCodes: ['SPEC_WINDOW_CLOSING'], stageClaimIds, policyId: `${productFamilyId}_window_v0` };
  return { state: 'CLOSED', reasonCodes: ['SPEC_WINDOW_CLOSED'], stageClaimIds, policyId: `${productFamilyId}_window_v0` };
}

export function evaluateSpecificationFit(opportunity, registry, verticalPack) {
  validateProjectOpportunity(opportunity, verticalPack);
  const results = [];
  for (const productFamilyId of [...new Set(opportunity.candidateProductFamilyIds)].sort(compareAscii)) {
    const requirements = opportunity.requirements
      .filter((requirement) => (requirement.productFamilyIds || []).includes(productFamilyId))
      .sort((left, right) => compareAscii(left.requirementId, right.requirementId));
    const window = evaluateSpecificationWindow(opportunity, productFamilyId, registry, verticalPack);
    if (opportunity.stage?.value === 'CANCELLED') {
      results.push({ productFamilyId, result: 'NOT_EVALUATED', reasons: [reason('PROJECT_CANCELLED')], requirementResults: [], window });
      continue;
    }
    if (requirements.length === 0) {
      results.push({ productFamilyId, result: 'NOT_EVALUATED', reasons: [reason('NO_EVALUABLE_REQUIREMENTS')], requirementResults: [], window });
      continue;
    }
    const requirementResults = requirements.map((requirement) => ({
      requirementId: requirement.requirementId,
      priority: requirement.priority,
      key: requirement.key,
      ...evaluateRequirement(requirement, productFamilyId, opportunity, registry)
    }));
    const allReasons = sortReasons(requirementResults.flatMap((item) => item.reasons));
    const hardResults = requirementResults.filter((item) => item.priority === 'HARD' && item.state !== 'NOT_APPLICABLE');
    let result;
    if (hardResults.length === 0) result = 'NOT_EVALUATED';
    else if (hardResults.some((item) => item.state === 'VERIFIED_MISMATCH')) result = 'NOT_FIT';
    else if (hardResults.some((item) => item.state === 'CONFLICTED' || item.state === 'UNKNOWN')) result = 'INSUFFICIENT_EVIDENCE';
    else if (hardResults.some((item) => item.state === 'POTENTIAL_MATCH')) result = 'CONDITIONAL_FIT';
    else if (hardResults.every((item) => item.state === 'VERIFIED_MATCH')) result = 'FIT';
    else result = 'INSUFFICIENT_EVIDENCE';
    const matchedRequirementIds = requirementResults.filter((item) => item.state === 'VERIFIED_MATCH').map((item) => item.requirementId);
    const missingRequirementIds = requirementResults.filter((item) => item.state === 'UNKNOWN' || item.state === 'CONFLICTED').map((item) => item.requirementId);
    const projectClaimIds = [...new Set(requirementResults.flatMap((item) => item.projectClaimIds))].sort(compareAscii);
    const capabilityClaimIds = [...new Set(requirementResults.flatMap((item) => item.capabilityClaimIds))].sort(compareAscii);
    results.push({ productFamilyId, result, reasons: allReasons, matchedRequirementIds, missingRequirementIds, projectClaimIds, capabilityClaimIds, requirementResults, window });
  }
  const evaluation = {
    schemaVersion: 'specification-fit-evaluation-v0',
    synthetic: opportunity.synthetic === true,
    opportunityId: opportunity.opportunityId,
    verticalId: opportunity.verticalId,
    asOf: registry.asOf,
    results,
    advisoryRank: results.map((item) => ({
      productFamilyId: item.productFamilyId,
      vector: [
        { FIT: 5, CONDITIONAL_FIT: 4, INSUFFICIENT_EVIDENCE: 3, NOT_EVALUATED: 2, NOT_FIT: 1 }[item.result],
        { OPEN: 5, CLOSING: 4, RETROFIT_OPEN: 3, NOT_OPEN_YET: 2, UNKNOWN: 1, CLOSED: 0, BLOCKED_CANCELLED: 0 }[item.window.state],
        item.matchedRequirementIds?.length || 0,
        item.capabilityClaimIds?.length || 0
      ]
    })).sort((left, right) => {
      for (let index = 0; index < left.vector.length; index += 1) {
        if (left.vector[index] !== right.vector[index]) return right.vector[index] - left.vector[index];
      }
      return compareAscii(left.productFamilyId, right.productFamilyId);
    })
  };
  return JSON.parse(canonicalStringify(evaluation));
}

export function resolveTechnicalAlias(input, aliasPack) {
  const aliasCount = (aliasPack.aliases || []).reduce((count, entry) => count + (entry.terms || []).length, 0);
  if (aliasCount > CLAIM_LIMITS.maxAliases) throw new ClaimValidationError('TOO_MANY_ALIASES', '$.aliasPack.aliases');
  const term = normalizeAlias(input);
  const explicitAmbiguity = aliasPack.ambiguousTerms?.find((item) => normalizeAlias(item.term) === term);
  if (explicitAmbiguity) return { state: 'AMBIGUOUS', conceptId: null, reason: explicitAmbiguity.reason };
  const matches = (aliasPack.aliases || []).filter((entry) => entry.terms.some((alias) => normalizeAlias(alias) === term));
  if (matches.length === 0) return { state: 'NOT_FOUND', conceptId: null, reason: 'NO_EXACT_ALIAS' };
  if (matches.length > 1) return { state: 'AMBIGUOUS', conceptId: null, reason: 'MULTIPLE_EXACT_CONCEPTS' };
  return { state: 'RESOLVED', conceptId: matches[0].conceptId, reason: 'EXACT_BILINGUAL_ALIAS' };
}

function referencedClaims(opportunity, evaluation, registry) {
  const references = [
    ...(opportunity.stage?.evidenceClaimRefs || []),
    ...opportunity.requirements.flatMap((requirement) => requirement.evidenceClaimRefs || []),
    ...evaluation.results.flatMap((result) => [...(result.capabilityClaimIds || []), ...(result.projectClaimIds || [])])
  ];
  return getClaims(registry, references).sort((left, right) => compareAscii(left.claimId, right.claimId));
}

function buildDecision(evaluation) {
  const pursue = evaluation.results.filter((result) => result.result === 'FIT' && ['OPEN', 'CLOSING', 'RETROFIT_OPEN'].includes(result.window.state));
  const hold = evaluation.results.filter((result) => !pursue.includes(result) && result.result !== 'NOT_FIT');
  const noGo = evaluation.results.filter((result) => result.result === 'NOT_FIT' || result.window.state === 'BLOCKED_CANCELLED');
  let technicalPursuitState = 'HOLD';
  if (pursue.length > 0) technicalPursuitState = 'PURSUE';
  else if (noGo.length === evaluation.results.length && evaluation.results.length > 0) technicalPursuitState = 'NO_GO';
  return {
    decisionScope: 'TECHNICAL_FIT_AND_SPEC_WINDOW_ONLY',
    technicalPursuitState,
    pursueProductFamilyIds: pursue.map((result) => result.productFamilyId).sort(compareAscii),
    holdProductFamilyIds: hold.map((result) => result.productFamilyId).sort(compareAscii),
    noGoProductFamilyIds: noGo.map((result) => result.productFamilyId).sort(compareAscii),
    finalHumanPursuitDecision: 'NOT_MADE'
  };
}

export function buildPursuitDossier(opportunity, evaluation, registry, verticalPack) {
  const claims = referencedClaims(opportunity, evaluation, registry);
  const projectFacts = claims.filter((claim) => ['PROJECT_FACT', 'TECHNICAL_REQUIREMENT', 'PROJECT_STAGE'].includes(claim.claimType) && claim.status === 'VERIFIED')
    .map((claim) => ({ claimId: claim.claimId, statement: claim.statement }));
  const assumptions = claims.filter((claim) => claim.status === 'ASSUMPTION')
    .map((claim) => ({ claimId: claim.claimId, statement: claim.statement, usedForFit: false }));
  const conflictingClaims = claims.filter((claim) => claim.status === 'CONFLICTED')
    .map((claim) => ({ claimId: claim.claimId, conflictClaimIds: claim.verification.conflictClaimIds }));
  const allowed = [];
  const blocked = [];
  for (const claim of claims) {
    const productFamilyId = claim.applicability.productFamilyIds[0] || evaluation.results[0]?.productFamilyId;
    const customerUse = deriveCustomerUse(claim, {
      synthetic: opportunity.synthetic,
      verticalId: opportunity.verticalId,
      jurisdiction: opportunity.jurisdiction,
      projectStage: opportunity.stage?.value,
      productFamilyId,
      conditions: opportunity.conditions || {}
    });
    if (customerUse.state === 'ALLOWED') {
      allowed.push({
        claimId: claim.claimId,
        statement: claim.statement,
        sourceTitle: claim.evidence[0].sourceTitle,
        sourceUrl: claim.evidence[0].sourceUrl,
        directQuote: claim.evidence[0].directQuote,
        verifiedAt: claim.verification.verifiedAt,
        applicability: `${claim.applicability.verticalId} / ${claim.applicability.productFamilyIds.join(',') || 'project'}`
      });
    } else {
      blocked.push({
        claimId: claim.claimId,
        reasonCodes: customerUse.reasonCodes,
        sourceLocation: `${claim.provenance.sourcePath}:${claim.provenance.sourceField}`,
        remediation: 'Bind complete applicable evidence and complete repository review.'
      });
    }
  }
  const missingRequirements = [];
  for (const result of evaluation.results) {
    for (const requirementId of result.missingRequirementIds || []) {
      const requirement = opportunity.requirements.find((item) => item.requirementId === requirementId);
      if (!requirement) continue;
      missingRequirements.push({
        requirementId,
        productFamilyIds: [result.productFamilyId],
        domain: requirement.category,
        criticality: requirement.priority === 'HARD' ? 'BLOCKING' : 'ADVISORY',
        state: requirement.valueState,
        expectedValue: requirement.value,
        decisionImpact: requirement.priority === 'HARD' ? 'HOLD_PRODUCT_FAMILY' : 'ADVISORY_ONLY'
      });
    }
  }
  const uniqueMissing = [...new Map(missingRequirements.map((item) => [`${item.requirementId}:${item.productFamilyIds[0]}`, item])).values()]
    .sort((left, right) => compareAscii(`${left.requirementId}:${left.productFamilyIds[0]}`, `${right.requirementId}:${right.productFamilyIds[0]}`));
  const questions = uniqueMissing.map((item) => {
    const requirement = opportunity.requirements.find((entry) => entry.requirementId === item.requirementId);
    const policy = verticalPack.questionPolicies?.[requirement.key];
    return policy ? { ...policy, requirementId: item.requirementId } : {
      questionId: `q_${item.requirementId}`,
      requirementId: item.requirementId,
      text: `What verified technical value is required for ${item.requirementId}?`,
      requestedArtifact: 'technical_specification',
      ownerRole: 'application_engineering',
      actionCode: 'VERIFY_CERTIFICATION_REQUIREMENT'
    };
  }).sort((left, right) => compareAscii(left.questionId, right.questionId));
  const decision = buildDecision(evaluation);
  const dossier = {
    schemaVersion: 'pursuit-dossier-v0',
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    productionReady: false,
    issue165Status: 'HOLD',
    synthetic: opportunity.synthetic === true,
    opportunity: opportunity.identity,
    decision,
    projectStage: {
      value: opportunity.stage?.value || 'UNKNOWN',
      claimIds: getClaims(registry, opportunity.stage?.evidenceClaimRefs || []).map((claim) => claim.claimId).sort(compareAscii)
    },
    projectFacts,
    assumptions,
    conflictingClaims,
    candidateProductFamilyIds: [...opportunity.candidateProductFamilyIds].sort(compareAscii),
    specificationFitMatrix: evaluation.results.map((result) => ({
      productFamilyId: result.productFamilyId,
      result: result.result,
      matchedRequirementIds: result.matchedRequirementIds || [],
      missingRequirementIds: result.missingRequirementIds || [],
      projectClaimIds: result.projectClaimIds || [],
      capabilityClaimIds: result.capabilityClaimIds || [],
      reasonCodes: result.reasons.map((item) => item.code),
      specificationWindow: result.window
    })),
    missingTechnicalRequirements: uniqueMissing,
    recommendedTechnicalQuestions: questions,
    customerUsableClaims: allowed.sort((left, right) => compareAscii(left.claimId, right.claimId)),
    blockedClaims: blocked.sort((left, right) => compareAscii(left.claimId, right.claimId)),
    reviewerNextAction: {
      primary: decision.technicalPursuitState === 'PURSUE' ? 'READY_FOR_TECHNICAL_REVIEW' : questions[0]?.actionCode || 'HOLD_NO_VERIFIED_CAPABILITY',
      scopedActions: questions.map((question) => ({ requirementId: question.requirementId, action: question.actionCode }))
    },
    explicitNonClaims: [
      'No final commercial pursuit decision was made.',
      'Pricing, availability, delivery lead time, budget, procurement access, competitive position, and win probability were not evaluated.',
      'No outreach, deployment, production access, or automatic approval was performed.'
    ]
  };
  const canonical = canonicalStringify(dossier);
  if (Buffer.byteLength(canonical, 'utf8') > DATACENTER_LIMITS.maxDossierBytes) throw new ClaimValidationError('DOSSIER_TOO_LARGE', '$.dossier');
  assertSafeArtifact(dossier, '$.dossier');
  return JSON.parse(canonical);
}

export function renderPursuitDossierJson(dossier) {
  assertSafeArtifact(dossier, '$.dossier');
  return `${JSON.stringify(JSON.parse(canonicalStringify(dossier)), null, 2)}\n`;
}

export function renderPursuitDossierMarkdown(dossier) {
  assertSafeArtifact(dossier, '$.dossier');
  const lines = [
    '# Pursuit Dossier v0',
    '',
    `- Opportunity: ${renderMarkdownCell(dossier.opportunity.projectDisplayName)}`,
    `- Decision scope: ${dossier.decision.decisionScope}`,
    `- Technical pursuit state: ${dossier.decision.technicalPursuitState}`,
    `- Final human decision: ${dossier.decision.finalHumanPursuitDecision}`,
    '',
    '## Current project stage',
    '',
    `- ${dossier.projectStage.value}`,
    '',
    '## Evidence-backed project facts',
    '',
    ...(dossier.projectFacts.length ? dossier.projectFacts.map((item) => `- ${renderMarkdownCell(item.statement)} (${item.claimId})`) : ['- None']),
    '',
    '## Assumptions',
    '',
    ...(dossier.assumptions.length ? dossier.assumptions.map((item) => `- ${renderMarkdownCell(item.statement)} (not used for fit)`) : ['- None']),
    '',
    '## Conflicting claims',
    '',
    ...(dossier.conflictingClaims.length ? dossier.conflictingClaims.map((item) => `- ${item.claimId}`) : ['- None']),
    '',
    '## Candidate product families',
    '',
    ...dossier.candidateProductFamilyIds.map((id) => `- ${id}`),
    '',
    '## Specification Fit Matrix',
    '',
    '| Product family | Result | Window | Reasons |',
    '| --- | --- | --- | --- |',
    ...dossier.specificationFitMatrix.map((item) => `| ${item.productFamilyId} | ${item.result} | ${item.specificationWindow.state} | ${item.reasonCodes.join(', ')} |`),
    '',
    '## Missing technical requirements',
    '',
    ...(dossier.missingTechnicalRequirements.length ? dossier.missingTechnicalRequirements.map((item) => `- ${item.requirementId}: ${item.criticality}`) : ['- None']),
    '',
    '## Recommended technical questions',
    '',
    ...(dossier.recommendedTechnicalQuestions.length ? dossier.recommendedTechnicalQuestions.map((item) => `- ${renderMarkdownCell(item.text)} [${item.actionCode}]`) : ['- None']),
    '',
    '## Customer-usable claims',
    '',
    ...(dossier.customerUsableClaims.length ? dossier.customerUsableClaims.map((item) => `- ${renderMarkdownCell(item.statement)} — ${renderMarkdownCell(item.sourceTitle)} — ${renderMarkdownCell(item.sourceUrl)} — ${renderMarkdownCell(item.directQuote)} (${item.claimId})`) : ['- None']),
    '',
    '## Blocked claims',
    '',
    ...(dossier.blockedClaims.length ? dossier.blockedClaims.map((item) => `- ${item.claimId}: ${item.reasonCodes.join(', ')} — ${renderMarkdownCell(item.remediation)}`) : ['- None']),
    '',
    '## Reviewer next action',
    '',
    `- ${dossier.reviewerNextAction.primary}`,
    '',
    '## Explicit non-claims',
    '',
    ...dossier.explicitNonClaims.map((item) => `- ${renderMarkdownCell(item)}`),
    ''
  ];
  return lines.join('\n');
}

export function dossierHashes(dossier) {
  return {
    jsonSha256: sha256(renderPursuitDossierJson(dossier)),
    markdownSha256: sha256(renderPursuitDossierMarkdown(dossier))
  };
}
