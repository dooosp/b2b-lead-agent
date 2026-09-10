import {
  assertSafeArtifact,
  assertValidatedClaimRegistry,
  canonicalStringify,
  ClaimValidationError,
  renderMarkdownCell,
  sha256
} from '../../knowledge/claim-registry/index.mjs';
import {
  buildPursuitDossier,
  DATACENTER_LIMITS,
  evaluateSpecificationFit,
  validateProjectOpportunity
} from './index.mjs';

export const PURSUIT_TWIN_BOUNDARY = 'LOCAL_TEST_SYNTHETIC_ONLY';
export const PURSUIT_TWIN_EVIDENCE_BOUNDARY = 'NOT_PRODUCTION_EVIDENCE';

const SNAPSHOT_SCHEMA_VERSION = 'project-opportunity-snapshot-v0';
const DELTA_SCHEMA_VERSION = 'specification-delta-v0';
const MINIMUM_EVIDENCE_SCHEMA_VERSION = 'minimum-evidence-to-advance-v0';
const REVIEW_PACKET_SCHEMA_VERSION = 'pursuit-twin-review-packet-v0';
const MAX_PACKET_BYTES = DATACENTER_LIMITS.maxDossierBytes;
const HUMAN_DECISIONS = new Set(['PURSUE', 'HOLD', 'NO_GO', 'NO_BID']);
const UNRESOLVED_REQUIREMENT_STATES = new Set(['UNKNOWN', 'CONFLICTED', 'POTENTIAL_MATCH']);
const REVIEWABLE_WINDOWS = new Set(['OPEN', 'CLOSING', 'RETROFIT_OPEN']);
const EVIDENCE_SIDE_RANK = new Map([
  ['STAGE', 0],
  ['PROJECT', 1],
  ['PRODUCT', 2],
  ['BOTH', 3]
]);

const REQUIREMENT_FIELDS = Object.freeze([
  'category',
  'key',
  'operator',
  'priority',
  'valueState',
  'value',
  'productFamilyIds',
  'evidenceClaimRefs'
]);

const EVIDENCE_REASON_CODES = new Set([
  'REQUIRED_PROJECT_FACT_MISSING',
  'PROJECT_FACT_UNVERIFIED',
  'CLAIM_CONFLICT',
  'CAPABILITY_CLAIM_MISSING',
  'CAPABILITY_CLAIM_UNVERIFIED',
  'CAPABILITY_CLAIM_EXPIRED',
  'CAPABILITY_CLAIM_RETRACTED'
]);

const NON_EVIDENCE_REASON_CODES = new Map([
  ['PROJECT_CANCELLED', 'PROJECT_CANCELLED'],
  ['HARD_REQUIREMENT_MISMATCH', 'VERIFIED_HARD_REQUIREMENT_MISMATCH'],
  ['HARD_DISQUALIFIER_TRIGGERED', 'VERIFIED_HARD_DISQUALIFIER'],
  ['JURISDICTION_MISMATCH', 'APPLICABILITY_MISMATCH'],
  ['CONDITION_MISMATCH', 'APPLICABILITY_MISMATCH'],
  ['UNIT_INCOMPATIBLE', 'UNIT_SCHEMA_INCOMPATIBLE'],
  ['NO_EVALUABLE_REQUIREMENTS', 'NO_EVALUABLE_REQUIREMENTS'],
  ['SPEC_WINDOW_NOT_OPEN_YET', 'SPECIFICATION_WINDOW_NOT_OPEN_YET'],
  ['SPEC_WINDOW_CLOSED', 'SPECIFICATION_WINDOW_CLOSED']
]);

const INFORMATIONAL_REASON_CODES = new Set([
  'HARD_REQUIREMENT_MATCH',
  'SOFT_REQUIREMENT_MATCH',
  'SOFT_REQUIREMENT_MISMATCH',
  'SOFT_REQUIREMENT_UNKNOWN',
  'UNIT_CONVERTED',
  'SPEC_WINDOW_OPEN',
  'SPEC_WINDOW_CLOSING',
  'RETROFIT_PATH_AVAILABLE',
  'RETROFIT_PATH_REQUIRES_EVIDENCE'
]);

function compareAscii(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function cloneCanonical(value) {
  return JSON.parse(canonicalStringify(value));
}

function assertPlainObject(value, path, code = 'INVALID_OBJECT') {
  if (!isPlainObject(value)) throw new ClaimValidationError(code, path);
  return value;
}

function assertNonEmptyString(value, path, code = 'STRING_REQUIRED') {
  if (typeof value !== 'string' || !value.trim()) throw new ClaimValidationError(code, path);
  return value;
}

function assertIsoTimestamp(value, path) {
  if (typeof value !== 'string') throw new ClaimValidationError('INVALID_DATE', path);
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new ClaimValidationError('INVALID_DATE', path);
  }
  return value;
}

function uniqueSorted(values) {
  return [...new Set(values)].sort(compareAscii);
}

function canonicalHashPayload(value, hashField = 'canonicalSha256') {
  const copy = cloneCanonical(value);
  delete copy[hashField];
  return copy;
}

function withCanonicalHash(value) {
  const canonical = cloneCanonical(value);
  return cloneCanonical({ ...canonical, canonicalSha256: sha256(canonical) });
}

function assertBoundedArtifact(value, path) {
  assertSafeArtifact(value, path);
  if (Buffer.byteLength(canonicalStringify(value), 'utf8') > MAX_PACKET_BYTES) {
    throw new ClaimValidationError('PURSUIT_TWIN_ARTIFACT_TOO_LARGE', path);
  }
  return value;
}

function assertVerticalPack(verticalPack) {
  assertSafeArtifact(verticalPack, '$.verticalPack');
  assertPlainObject(verticalPack, '$.verticalPack', 'INVALID_VERTICAL_PACK');
  if (verticalPack.schemaVersion !== 'datacenter-vertical-pack-v0') {
    throw new ClaimValidationError('UNSUPPORTED_VERTICAL_PACK_SCHEMA', '$.verticalPack.schemaVersion');
  }
  if (verticalPack.verticalId !== 'datacenter_infrastructure') {
    throw new ClaimValidationError('VERTICAL_PACK_ID_MISMATCH', '$.verticalPack.verticalId');
  }
  if (verticalPack.productionReady !== false || verticalPack.localTestOnly !== true
    || Object.hasOwn(verticalPack, 'finalDecision')) {
    throw new ClaimValidationError('VERTICAL_PACK_AUTHORITY_FIELD_REFUSED', '$.verticalPack');
  }
  if (!Array.isArray(verticalPack.projectStages) || verticalPack.projectStages.length === 0
    || verticalPack.projectStages.some((stage) => typeof stage !== 'string' || !stage.trim())
    || new Set(verticalPack.projectStages).size !== verticalPack.projectStages.length) {
    throw new ClaimValidationError('INVALID_PROJECT_STAGES', '$.verticalPack.projectStages');
  }
  assertPlainObject(verticalPack.specificationWindows, '$.verticalPack.specificationWindows', 'INVALID_SPECIFICATION_WINDOWS');
  assertPlainObject(verticalPack.questionPolicies, '$.verticalPack.questionPolicies', 'INVALID_QUESTION_POLICIES');
  return verticalPack;
}

function resolveClaimId(registry, reference, path) {
  const claim = registry.byKey.get(reference) || registry.byId.get(reference);
  if (!claim) throw new ClaimValidationError('UNKNOWN_EVIDENCE_CLAIM', path);
  return claim.claimId;
}

function normalizeEvidenceRefs(references, registry, path, { allowEmpty = true } = {}) {
  if (!Array.isArray(references) || (!allowEmpty && references.length === 0)
    || references.length > DATACENTER_LIMITS.maxRequirementsPerOpportunity * DATACENTER_LIMITS.maxEvidenceRefsPerRequirement) {
    throw new ClaimValidationError('INVALID_EVIDENCE_CLAIM_REFS', path);
  }
  return uniqueSorted(references.map((reference, index) => {
    assertNonEmptyString(reference, `${path}[${index}]`, 'INVALID_EVIDENCE_CLAIM_REF');
    return resolveClaimId(registry, reference, `${path}[${index}]`);
  }));
}

function normalizeRequirementValue(value) {
  const normalized = cloneCanonical(value);
  if (Array.isArray(normalized.value)) normalized.value = uniqueSorted(normalized.value);
  return cloneCanonical(normalized);
}

function normalizeOpportunity(opportunity, registry, verticalPack) {
  validateProjectOpportunity(opportunity, verticalPack);
  const normalized = cloneCanonical(opportunity);
  normalized.candidateProductFamilyIds = uniqueSorted(normalized.candidateProductFamilyIds);
  normalized.stage.evidenceClaimRefs = normalizeEvidenceRefs(
    normalized.stage.evidenceClaimRefs || [],
    registry,
    '$.opportunity.stage.evidenceClaimRefs'
  );
  normalized.requirements = normalized.requirements.map((requirement, index) => ({
    ...requirement,
    productFamilyIds: uniqueSorted(requirement.productFamilyIds),
    value: normalizeRequirementValue(requirement.value),
    evidenceClaimRefs: normalizeEvidenceRefs(
      requirement.evidenceClaimRefs || [],
      registry,
      `$.opportunity.requirements[${index}].evidenceClaimRefs`
    )
  })).sort((left, right) => compareAscii(left.requirementId, right.requirementId));
  validateProjectOpportunity(normalized, verticalPack);
  return cloneCanonical(normalized);
}

function normalizeSourceRevision(sourceRevision, registry, observedAt) {
  assertSafeArtifact(sourceRevision, '$.sourceRevision');
  assertPlainObject(sourceRevision, '$.sourceRevision', 'INVALID_SOURCE_REVISION');
  const documentKey = assertNonEmptyString(sourceRevision.documentKey, '$.sourceRevision.documentKey', 'DOCUMENT_KEY_REQUIRED');
  const revisionId = assertNonEmptyString(sourceRevision.revisionId, '$.sourceRevision.revisionId', 'REVISION_ID_REQUIRED');
  const supersedesRevisionId = sourceRevision.supersedesRevisionId === null
    ? null
    : assertNonEmptyString(sourceRevision.supersedesRevisionId, '$.sourceRevision.supersedesRevisionId', 'INVALID_SUPERSEDES_REVISION_ID');
  if (supersedesRevisionId === revisionId) {
    throw new ClaimValidationError('SELF_SUPERSEDING_REVISION', '$.sourceRevision.supersedesRevisionId');
  }
  const effectiveAt = assertIsoTimestamp(sourceRevision.effectiveAt, '$.sourceRevision.effectiveAt');
  if (effectiveAt > observedAt) throw new ClaimValidationError('REVISION_EFFECTIVE_AFTER_OBSERVATION', '$.sourceRevision.effectiveAt');
  const evidenceClaimRefs = normalizeEvidenceRefs(
    sourceRevision.evidenceClaimRefs,
    registry,
    '$.sourceRevision.evidenceClaimRefs',
    { allowEmpty: false }
  );
  return cloneCanonical({ documentKey, revisionId, supersedesRevisionId, effectiveAt, evidenceClaimRefs });
}

function materializedRegistryPayload(registry) {
  return {
    schemaVersion: registry.schemaVersion,
    asOf: registry.asOf,
    claims: registry.claims
  };
}

function evaluationSummary(result) {
  if (!result) return null;
  return {
    productFamilyId: result.productFamilyId,
    result: result.result,
    windowState: result.window?.state || 'UNKNOWN',
    windowPolicyId: result.window?.policyId || null,
    reasonCodes: uniqueSorted((result.reasons || []).map((reason) => reason.code)),
    matchedRequirementIds: uniqueSorted(result.matchedRequirementIds || []),
    missingRequirementIds: uniqueSorted(result.missingRequirementIds || []),
    projectClaimIds: uniqueSorted(result.projectClaimIds || []),
    capabilityClaimIds: uniqueSorted(result.capabilityClaimIds || [])
  };
}

function summarizeSnapshot(snapshot) {
  return {
    observedAt: snapshot.observedAt,
    documentKey: snapshot.sourceRevision.documentKey,
    revisionId: snapshot.sourceRevision.revisionId,
    supersedesRevisionId: snapshot.sourceRevision.supersedesRevisionId,
    sourceEffectiveAt: snapshot.sourceRevision.effectiveAt,
    snapshotCanonicalSha256: snapshot.canonicalSha256,
    opportunityCanonicalSha256: snapshot.opportunityCanonicalSha256,
    evaluationCanonicalSha256: snapshot.evaluationCanonicalSha256,
    stage: snapshot.opportunity.stage.value,
    technicalOutcomes: snapshot.evaluation.results.map(evaluationSummary)
  };
}

export function buildPursuitRevisionSnapshot({ opportunity, sourceRevision, observedAt } = {}, registry, verticalPack) {
  assertValidatedClaimRegistry(registry);
  assertVerticalPack(verticalPack);
  const normalizedObservedAt = assertIsoTimestamp(observedAt, '$.observedAt');
  if (normalizedObservedAt > registry.asOf) {
    throw new ClaimValidationError('OBSERVATION_AFTER_REGISTRY_AS_OF', '$.observedAt');
  }
  const normalizedOpportunity = normalizeOpportunity(opportunity, registry, verticalPack);
  if (normalizedOpportunity.synthetic !== true) {
    throw new ClaimValidationError('SYNTHETIC_OPPORTUNITY_REQUIRED', '$.opportunity.synthetic');
  }
  const normalizedSourceRevision = normalizeSourceRevision(sourceRevision, registry, normalizedObservedAt);
  const evaluation = evaluateSpecificationFit(normalizedOpportunity, registry, verticalPack);
  const registryPayload = materializedRegistryPayload(registry);
  const snapshot = {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    boundary: PURSUIT_TWIN_BOUNDARY,
    evidenceBoundary: PURSUIT_TWIN_EVIDENCE_BOUNDARY,
    productionReady: false,
    issue165Status: 'HOLD',
    synthetic: true,
    observedAt: normalizedObservedAt,
    sourceRevision: normalizedSourceRevision,
    opportunity: normalizedOpportunity,
    registrySchemaVersion: registry.schemaVersion,
    registryAsOf: registry.asOf,
    materializedRegistryCanonicalSha256: sha256(registryPayload),
    verticalPackSchemaVersion: verticalPack.schemaVersion,
    verticalPackCanonicalSha256: sha256(verticalPack),
    opportunityCanonicalSha256: sha256(normalizedOpportunity),
    evaluation,
    evaluationCanonicalSha256: sha256(evaluation)
  };
  const result = withCanonicalHash(snapshot);
  assertBoundedArtifact(result, '$.snapshot');
  return result;
}

export function validatePursuitRevisionSnapshot(snapshot, registry, verticalPack) {
  assertValidatedClaimRegistry(registry);
  assertVerticalPack(verticalPack);
  assertBoundedArtifact(snapshot, '$.snapshot');
  if (!isPlainObject(snapshot)
    || snapshot.schemaVersion !== SNAPSHOT_SCHEMA_VERSION
    || snapshot.boundary !== PURSUIT_TWIN_BOUNDARY
    || snapshot.evidenceBoundary !== PURSUIT_TWIN_EVIDENCE_BOUNDARY
    || snapshot.productionReady !== false
    || snapshot.issue165Status !== 'HOLD'
    || snapshot.synthetic !== true) {
    throw new ClaimValidationError('INVALID_PURSUIT_REVISION_SNAPSHOT', '$.snapshot');
  }
  if (snapshot.canonicalSha256 !== sha256(canonicalHashPayload(snapshot))) {
    throw new ClaimValidationError('SNAPSHOT_HASH_MISMATCH', '$.snapshot.canonicalSha256');
  }
  const rebuilt = buildPursuitRevisionSnapshot({
    opportunity: snapshot.opportunity,
    sourceRevision: snapshot.sourceRevision,
    observedAt: snapshot.observedAt
  }, registry, verticalPack);
  if (canonicalStringify(rebuilt) !== canonicalStringify(snapshot)) {
    throw new ClaimValidationError('SNAPSHOT_RECOMPUTATION_MISMATCH', '$.snapshot');
  }
  return rebuilt;
}

function changedFields(previous, current, fields) {
  return fields.filter((field) => canonicalStringify(previous?.[field]) !== canonicalStringify(current?.[field]));
}

function setDelta(previous = [], current = []) {
  const previousSet = new Set(previous);
  const currentSet = new Set(current);
  return {
    added: uniqueSorted(current.filter((value) => !previousSet.has(value))),
    removed: uniqueSorted(previous.filter((value) => !currentSet.has(value)))
  };
}

function buildRequirementChanges(previousOpportunity, currentOpportunity) {
  const previousById = new Map(previousOpportunity.requirements.map((item) => [item.requirementId, item]));
  const currentById = new Map(currentOpportunity.requirements.map((item) => [item.requirementId, item]));
  const requirementIds = uniqueSorted([...previousById.keys(), ...currentById.keys()]);
  return requirementIds.flatMap((requirementId) => {
    const before = previousById.get(requirementId);
    const after = currentById.get(requirementId);
    if (!before) {
      return [{
        requirementId,
        changeType: 'ADDED',
        changedFields: [...REQUIREMENT_FIELDS],
        previous: null,
        current: after,
        evidenceClaimDelta: setDelta([], after.evidenceClaimRefs)
      }];
    }
    if (!after) {
      return [{
        requirementId,
        changeType: 'REMOVED',
        changedFields: [...REQUIREMENT_FIELDS],
        previous: before,
        current: null,
        evidenceClaimDelta: setDelta(before.evidenceClaimRefs, [])
      }];
    }
    const fields = changedFields(before, after, REQUIREMENT_FIELDS);
    if (fields.length === 0) return [];
    return [{
      requirementId,
      changeType: 'MODIFIED',
      changedFields: fields,
      previous: before,
      current: after,
      evidenceClaimDelta: setDelta(before.evidenceClaimRefs, after.evidenceClaimRefs)
    }];
  });
}

function buildFitChanges(previousEvaluation, currentEvaluation) {
  const previousByFamily = new Map(previousEvaluation.results.map((item) => [item.productFamilyId, evaluationSummary(item)]));
  const currentByFamily = new Map(currentEvaluation.results.map((item) => [item.productFamilyId, evaluationSummary(item)]));
  return uniqueSorted([...previousByFamily.keys(), ...currentByFamily.keys()]).flatMap((productFamilyId) => {
    const previous = previousByFamily.get(productFamilyId) || null;
    const current = currentByFamily.get(productFamilyId) || null;
    if (!previous) return [{ productFamilyId, changeType: 'ADDED', changedFields: ['productFamilyId'], previous, current }];
    if (!current) return [{ productFamilyId, changeType: 'REMOVED', changedFields: ['productFamilyId'], previous, current }];
    const fields = changedFields(previous, current, [
      'result',
      'windowState',
      'windowPolicyId',
      'reasonCodes',
      'matchedRequirementIds',
      'missingRequirementIds',
      'projectClaimIds',
      'capabilityClaimIds'
    ]);
    if (fields.length === 0) return [];
    return [{ productFamilyId, changeType: 'MODIFIED', changedFields: fields, previous, current }];
  });
}

function validatePriorHumanDecision(priorHumanDecision, previousSnapshot, currentSnapshot) {
  assertSafeArtifact(priorHumanDecision, '$.priorHumanDecision');
  assertPlainObject(priorHumanDecision, '$.priorHumanDecision', 'INVALID_PRIOR_HUMAN_DECISION');
  assertNonEmptyString(priorHumanDecision.decisionId, '$.priorHumanDecision.decisionId', 'DECISION_ID_REQUIRED');
  if (!HUMAN_DECISIONS.has(priorHumanDecision.decision)) {
    throw new ClaimValidationError('INVALID_HUMAN_DECISION', '$.priorHumanDecision.decision');
  }
  const decidedAt = assertIsoTimestamp(priorHumanDecision.decidedAt, '$.priorHumanDecision.decidedAt');
  if (decidedAt < previousSnapshot.observedAt || decidedAt > currentSnapshot.observedAt) {
    throw new ClaimValidationError('DECISION_TIMESTAMP_OUTSIDE_REVISION_WINDOW', '$.priorHumanDecision.decidedAt');
  }
  if (priorHumanDecision.snapshotCanonicalSha256 !== previousSnapshot.canonicalSha256) {
    throw new ClaimValidationError('PRIOR_DECISION_SNAPSHOT_MISMATCH', '$.priorHumanDecision.snapshotCanonicalSha256');
  }
  assertNonEmptyString(priorHumanDecision.reviewReceipt, '$.priorHumanDecision.reviewReceipt', 'REVIEW_RECEIPT_REQUIRED');
  return cloneCanonical(priorHumanDecision);
}

export function evaluateSpecificationDelta(
  previousSnapshot,
  currentSnapshot,
  registry,
  verticalPack,
  { priorHumanDecision = null } = {}
) {
  const previous = validatePursuitRevisionSnapshot(previousSnapshot, registry, verticalPack);
  const current = validatePursuitRevisionSnapshot(currentSnapshot, registry, verticalPack);
  if (canonicalStringify(previous.opportunity.identity) !== canonicalStringify(current.opportunity.identity)
    || previous.opportunity.opportunityId !== current.opportunity.opportunityId
    || previous.opportunity.verticalId !== current.opportunity.verticalId
    || previous.opportunity.jurisdiction !== current.opportunity.jurisdiction) {
    throw new ClaimValidationError('SNAPSHOT_IDENTITY_MISMATCH', '$.currentSnapshot.opportunity.identity');
  }
  if (previous.sourceRevision.documentKey !== current.sourceRevision.documentKey) {
    throw new ClaimValidationError('DOCUMENT_LINEAGE_MISMATCH', '$.currentSnapshot.sourceRevision.documentKey');
  }
  if (current.sourceRevision.supersedesRevisionId !== previous.sourceRevision.revisionId) {
    throw new ClaimValidationError('REVISION_LINEAGE_MISMATCH', '$.currentSnapshot.sourceRevision.supersedesRevisionId');
  }
  if (current.observedAt <= previous.observedAt || current.sourceRevision.effectiveAt <= previous.sourceRevision.effectiveAt) {
    throw new ClaimValidationError('NON_MONOTONIC_REVISION_TIME', '$.currentSnapshot.observedAt');
  }

  const requirementChanges = buildRequirementChanges(previous.opportunity, current.opportunity);
  const fitChanges = buildFitChanges(previous.evaluation, current.evaluation);
  const stageChangedFields = changedFields(previous.opportunity.stage, current.opportunity.stage, ['value', 'evidenceClaimRefs']);
  const stageChange = {
    changed: stageChangedFields.length > 0,
    changedFields: stageChangedFields,
    previous: previous.opportunity.stage,
    current: current.opportunity.stage,
    evidenceClaimDelta: setDelta(previous.opportunity.stage.evidenceClaimRefs, current.opportunity.stage.evidenceClaimRefs)
  };
  const productFamilyDelta = setDelta(
    previous.opportunity.candidateProductFamilyIds,
    current.opportunity.candidateProductFamilyIds
  );
  const sourceEvidenceClaimDelta = setDelta(
    previous.sourceRevision.evidenceClaimRefs,
    current.sourceRevision.evidenceClaimRefs
  );
  const conditionsChanged = canonicalStringify(previous.opportunity.conditions) !== canonicalStringify(current.opportunity.conditions);
  const conditionsChange = {
    changed: conditionsChanged,
    previous: previous.opportunity.conditions,
    current: current.opportunity.conditions
  };
  const technicalOutcomeChanged = fitChanges.some((change) => change.changedFields.some((field) => [
    'result', 'windowState', 'reasonCodes', 'matchedRequirementIds', 'missingRequirementIds'
  ].includes(field))) || fitChanges.some((change) => change.changeType !== 'MODIFIED');
  const semanticInputChanged = stageChange.changed
    || requirementChanges.length > 0
    || productFamilyDelta.added.length > 0
    || productFamilyDelta.removed.length > 0
    || sourceEvidenceClaimDelta.added.length > 0
    || sourceEvidenceClaimDelta.removed.length > 0
    || conditionsChanged;
  // A new source revision invalidates the prior materialized evaluation even when
  // its normalized technical content happens to be unchanged. This does not claim
  // that the technical outcome changed.
  const evaluationInvalidated = previous.sourceRevision.revisionId !== current.sourceRevision.revisionId
    || semanticInputChanged
    || previous.materializedRegistryCanonicalSha256 !== current.materializedRegistryCanonicalSha256
    || previous.verticalPackCanonicalSha256 !== current.verticalPackCanonicalSha256;

  const normalizedPriorDecision = priorHumanDecision
    ? validatePriorHumanDecision(priorHumanDecision, previous, current)
    : null;
  const decisionReview = normalizedPriorDecision
    ? {
        state: evaluationInvalidated ? 'REVIEW_REQUIRED' : 'UNCHANGED_REVIEW_CURRENT',
        priorHumanDecision: normalizedPriorDecision,
        carryForwardAllowed: !evaluationInvalidated,
        replacementHumanDecision: 'NOT_MADE',
        automaticDecisionChangePerformed: false
      }
    : {
        state: 'NO_PRIOR_HUMAN_DECISION',
        priorHumanDecision: null,
        carryForwardAllowed: false,
        replacementHumanDecision: 'NOT_MADE',
        automaticDecisionChangePerformed: false
      };

  const delta = {
    schemaVersion: DELTA_SCHEMA_VERSION,
    boundary: PURSUIT_TWIN_BOUNDARY,
    evidenceBoundary: PURSUIT_TWIN_EVIDENCE_BOUNDARY,
    productionReady: false,
    issue165Status: 'HOLD',
    synthetic: true,
    opportunityId: current.opportunity.opportunityId,
    documentRevisionChange: {
      documentKey: current.sourceRevision.documentKey,
      previousRevisionId: previous.sourceRevision.revisionId,
      currentRevisionId: current.sourceRevision.revisionId,
      currentSupersedesRevisionId: current.sourceRevision.supersedesRevisionId,
      previousEffectiveAt: previous.sourceRevision.effectiveAt,
      currentEffectiveAt: current.sourceRevision.effectiveAt,
      evidenceClaimDelta: sourceEvidenceClaimDelta
    },
    stageChange,
    productFamilyDelta,
    conditionsChanged,
    conditionsChange,
    requirementChanges,
    fitChanges,
    semanticInputChanged,
    evaluationInvalidated,
    technicalOutcomeChanged,
    decisionReview,
    revisionTimeline: [summarizeSnapshot(previous), summarizeSnapshot(current)],
    explicitNonClaims: [
      'The prior human pursuit decision was not automatically changed.',
      'No counterfactual fit, pricing, win probability, outreach, production access, or deployment was performed.',
      'A changed revision requires human review before any replacement pursuit decision.'
    ]
  };
  const result = withCanonicalHash(delta);
  assertBoundedArtifact(result, '$.specificationDelta');
  return result;
}

function gateMaterial({ code, productFamilyId = null, requirementId = null, reasonCodes = [], detail }) {
  return {
    code,
    productFamilyId,
    requirementId,
    reasonCodes: uniqueSorted(reasonCodes),
    detail,
    resolvableByAdditionalEvidenceAlone: false
  };
}

function evidenceTemplate(side, requirement, verticalPack) {
  if (side === 'PROJECT') {
    const policy = verticalPack.questionPolicies?.[requirement.key];
    if (!policy) return null;
    return {
      questionId: policy.questionId,
      text: policy.text,
      requestedArtifacts: [policy.requestedArtifact],
      ownerRole: policy.ownerRole,
      actionCode: policy.actionCode
    };
  }
  if (side === 'PRODUCT') {
    return {
      questionId: `q_verified_product_capability_${requirement.key}`,
      text: `What current repository-reviewed product capability evidence resolves ${requirement.requirementId}?`,
      requestedArtifacts: ['verified_product_capability_record'],
      ownerRole: 'product_application_engineering',
      actionCode: 'VERIFY_PRODUCT_CAPABILITY'
    };
  }
  if (side === 'BOTH') {
    return {
      questionId: `q_verified_alignment_${requirement.key}`,
      text: `What verified project requirement and product capability evidence resolves ${requirement.requirementId}?`,
      requestedArtifacts: ['approved_technical_requirement', 'verified_product_capability_record'],
      ownerRole: 'application_engineering',
      actionCode: 'VERIFY_REQUIREMENT_CAPABILITY_ALIGNMENT'
    };
  }
  throw new ClaimValidationError('UNKNOWN_EVIDENCE_SIDE', '$.minimumEvidence.side');
}

function stageEvidenceTemplate() {
  return {
    questionId: 'q_verified_project_stage',
    text: 'What current approved project-stage evidence fixes the specification influence window?',
    requestedArtifacts: ['approved_project_stage_record'],
    ownerRole: 'project_management',
    actionCode: 'VERIFY_PROJECT_STAGE'
  };
}

function mergeEvidenceSide(reasons) {
  const sides = new Set(reasons.map((reason) => reason.side).filter(Boolean));
  if (sides.has('BOTH') || (sides.has('PROJECT') && sides.has('PRODUCT'))) return 'BOTH';
  if (sides.has('PRODUCT')) return 'PRODUCT';
  if (sides.has('PROJECT')) return 'PROJECT';
  throw new ClaimValidationError('UNMAPPED_MINIMUM_EVIDENCE_SIDE', '$.evaluation.results.reasons');
}

function windowPriority(state) {
  return ({ CLOSING: 0, OPEN: 1, RETROFIT_OPEN: 2, UNKNOWN: 3 }[state] ?? 9);
}

function addGate(gatesByMaterial, familyGateKeys, gate) {
  const material = gateMaterial(gate);
  const key = canonicalStringify(material);
  gatesByMaterial.set(key, material);
  if (material.productFamilyId) {
    if (!familyGateKeys.has(material.productFamilyId)) familyGateKeys.set(material.productFamilyId, new Set());
    familyGateKeys.get(material.productFamilyId).add(key);
  }
}

function addEvidenceDraft(drafts, draft) {
  const key = canonicalStringify({
    side: draft.side,
    requirementKey: draft.requirementKey,
    questionId: draft.questionId,
    actionCode: draft.actionCode,
    requestedArtifacts: draft.requestedArtifacts,
    ownerRole: draft.ownerRole
  });
  const existing = drafts.get(key) || {
    ...draft,
    affectedProductFamilyIds: [],
    requirementIds: [],
    reasonCodes: []
  };
  existing.affectedProductFamilyIds = uniqueSorted([...existing.affectedProductFamilyIds, ...draft.affectedProductFamilyIds]);
  existing.requirementIds = uniqueSorted([...existing.requirementIds, ...draft.requirementIds]);
  existing.reasonCodes = uniqueSorted([...existing.reasonCodes, ...draft.reasonCodes]);
  existing.priorityRank = Math.min(existing.priorityRank, draft.priorityRank);
  drafts.set(key, existing);
}

function finalizeEvidenceItem(draft) {
  const material = cloneCanonical({
    side: draft.side,
    requirementKey: draft.requirementKey,
    affectedProductFamilyIds: draft.affectedProductFamilyIds,
    requirementIds: draft.requirementIds,
    reasonCodes: draft.reasonCodes,
    questionId: draft.questionId,
    text: draft.text,
    requestedArtifacts: draft.requestedArtifacts,
    ownerRole: draft.ownerRole,
    actionCode: draft.actionCode,
    priorityRank: draft.priorityRank,
    completionEffect: 'RE_EVALUATE_ONLY',
    fitGuarantee: false
  });
  return cloneCanonical({ evidenceItemId: `mei_${sha256(material)}`, ...material });
}

function finalizeGate(material) {
  return cloneCanonical({ nonEvidenceGateId: `neg_${sha256(material)}`, ...material });
}

export function buildMinimumEvidenceToAdvance(opportunity, registry, verticalPack) {
  assertValidatedClaimRegistry(registry);
  assertVerticalPack(verticalPack);
  const normalizedOpportunity = normalizeOpportunity(opportunity, registry, verticalPack);
  const evaluation = evaluateSpecificationFit(normalizedOpportunity, registry, verticalPack);
  const requirementsById = new Map(normalizedOpportunity.requirements.map((item) => [item.requirementId, item]));
  const drafts = new Map();
  const gatesByMaterial = new Map();
  const familyGateKeys = new Map();

  if (normalizedOpportunity.candidateProductFamilyIds.length === 0) {
    addGate(gatesByMaterial, familyGateKeys, {
      code: 'NO_EVALUABLE_PRODUCT_SCOPE',
      detail: 'No candidate product family exists; evidence collection cannot select a technical reevaluation path.'
    });
  }

  for (const result of evaluation.results) {
    const productFamilyId = result.productFamilyId;
    if ((result.reasons || []).some((reason) => reason.code === 'PROJECT_CANCELLED')) {
      addGate(gatesByMaterial, familyGateKeys, {
        code: 'PROJECT_CANCELLED',
        productFamilyId,
        reasonCodes: ['PROJECT_CANCELLED'],
        detail: 'The project is cancelled; additional evidence is not an advancement path.'
      });
      continue;
    }
    if (!result.window?.policyId) {
      addGate(gatesByMaterial, familyGateKeys, {
        code: 'MISSING_SPECIFICATION_WINDOW_POLICY',
        productFamilyId,
        reasonCodes: result.window?.reasonCodes || [],
        detail: 'The product family has no bounded specification-window policy.'
      });
    } else if (result.window.state === 'UNKNOWN') {
      const unknownWindowReasons = result.window.reasonCodes || [];
      if (unknownWindowReasons.some((code) => !['PROJECT_STAGE_UNKNOWN', 'PROJECT_STAGE_CONFLICTED'].includes(code))) {
        throw new ClaimValidationError('UNMAPPED_MINIMUM_EVIDENCE_REASON', '$.evaluation.results.window.reasonCodes');
      }
      const template = stageEvidenceTemplate();
      addEvidenceDraft(drafts, {
        side: 'STAGE',
        requirementKey: 'project_stage',
        affectedProductFamilyIds: [productFamilyId],
        requirementIds: [],
        reasonCodes: unknownWindowReasons,
        ...template,
        priorityRank: windowPriority(result.window.state)
      });
    } else if (result.window.state === 'NOT_OPEN_YET') {
      addGate(gatesByMaterial, familyGateKeys, {
        code: 'SPECIFICATION_WINDOW_NOT_OPEN_YET',
        productFamilyId,
        reasonCodes: result.window.reasonCodes,
        detail: 'The current verified stage precedes this product family specification window.'
      });
    } else if (result.window.state === 'CLOSED') {
      addGate(gatesByMaterial, familyGateKeys, {
        code: 'SPECIFICATION_WINDOW_CLOSED',
        productFamilyId,
        reasonCodes: result.window.reasonCodes,
        detail: 'The current verified stage is outside this product family specification window.'
      });
    } else if (result.window.state === 'BLOCKED_CANCELLED') {
      addGate(gatesByMaterial, familyGateKeys, {
        code: 'PROJECT_CANCELLED',
        productFamilyId,
        reasonCodes: result.window.reasonCodes,
        detail: 'The project is cancelled; additional evidence is not an advancement path.'
      });
    }

    if ((result.requirementResults || []).length === 0) {
      addGate(gatesByMaterial, familyGateKeys, {
        code: 'NO_EVALUABLE_REQUIREMENTS',
        productFamilyId,
        reasonCodes: (result.reasons || []).map((reason) => reason.code),
        detail: 'No requirement is in scope for this product family.'
      });
      continue;
    }

    const hardRequirementResults = result.requirementResults.filter((item) => item.priority === 'HARD' && item.state !== 'NOT_APPLICABLE');
    if (hardRequirementResults.length === 0) {
      addGate(gatesByMaterial, familyGateKeys, {
        code: 'NO_HARD_ADVANCEMENT_REQUIREMENT',
        productFamilyId,
        detail: 'No hard technical requirement defines an evidence-only advancement path.'
      });
      continue;
    }

    for (const requirementResult of hardRequirementResults) {
      const requirement = requirementsById.get(requirementResult.requirementId);
      if (!requirement) throw new ClaimValidationError('EVALUATION_REQUIREMENT_MISSING', '$.evaluation.results.requirementResults');
      if (requirementResult.state === 'VERIFIED_MISMATCH') {
        addGate(gatesByMaterial, familyGateKeys, {
          code: 'VERIFIED_HARD_REQUIREMENT_MISMATCH',
          productFamilyId,
          requirementId: requirementResult.requirementId,
          reasonCodes: requirementResult.reasons.map((reason) => reason.code),
          detail: 'Verified project and product values do not satisfy the hard requirement.'
        });
        continue;
      }
      if (!UNRESOLVED_REQUIREMENT_STATES.has(requirementResult.state)) continue;
      const evidenceReasons = requirementResult.reasons.filter((reason) => EVIDENCE_REASON_CODES.has(reason.code));
      const nonEvidenceReasons = requirementResult.reasons.filter((reason) => NON_EVIDENCE_REASON_CODES.has(reason.code));
      const unknownReasons = requirementResult.reasons.filter((reason) => (
        !EVIDENCE_REASON_CODES.has(reason.code)
        && !NON_EVIDENCE_REASON_CODES.has(reason.code)
        && !INFORMATIONAL_REASON_CODES.has(reason.code)
      ));
      if (unknownReasons.length > 0) {
        throw new ClaimValidationError('UNMAPPED_MINIMUM_EVIDENCE_REASON', '$.evaluation.results.requirementResults.reasons');
      }
      for (const reason of nonEvidenceReasons) {
        // An UNKNOWN stage can make an otherwise applicable claim appear as a
        // condition mismatch. The stage-evidence item already captures the
        // smallest fact needed to reevaluate that applicability; do not turn the
        // same unresolved stage into a contradictory non-evidence gate.
        if (reason.code === 'CONDITION_MISMATCH' && normalizedOpportunity.stage.value === 'UNKNOWN') continue;
        addGate(gatesByMaterial, familyGateKeys, {
          code: NON_EVIDENCE_REASON_CODES.get(reason.code),
          productFamilyId,
          requirementId: requirementResult.requirementId,
          reasonCodes: [reason.code],
          detail: 'The evaluated state requires a policy, applicability, unit, or technical change rather than more evidence alone.'
        });
      }
      if (evidenceReasons.length === 0) continue;
      const side = mergeEvidenceSide(evidenceReasons);
      const template = evidenceTemplate(side, requirement, verticalPack);
      if (!template) {
        addGate(gatesByMaterial, familyGateKeys, {
          code: 'MISSING_QUESTION_POLICY',
          productFamilyId,
          requirementId: requirementResult.requirementId,
          reasonCodes: evidenceReasons.map((reason) => reason.code),
          detail: 'No bounded project-evidence question policy exists for this requirement key.'
        });
        continue;
      }
      addEvidenceDraft(drafts, {
        side,
        requirementKey: requirement.key,
        affectedProductFamilyIds: [productFamilyId],
        requirementIds: [requirementResult.requirementId],
        reasonCodes: evidenceReasons.map((reason) => reason.code),
        ...template,
        priorityRank: windowPriority(result.window.state)
      });
    }
  }

  const evidenceItems = [...drafts.values()].map(finalizeEvidenceItem).sort((left, right) => (
    left.priorityRank - right.priorityRank
    || (EVIDENCE_SIDE_RANK.get(left.side) ?? 99) - (EVIDENCE_SIDE_RANK.get(right.side) ?? 99)
    || compareAscii(left.requirementKey, right.requirementKey)
    || compareAscii(left.evidenceItemId, right.evidenceItemId)
  )).map((item, index) => ({ ...item, priority: index + 1 }));
  const nonEvidenceGates = [...gatesByMaterial.values()].map(finalizeGate).sort((left, right) => compareAscii(left.nonEvidenceGateId, right.nonEvidenceGateId));
  const gateIdByKey = new Map(nonEvidenceGates.map((gate) => [canonicalStringify(gateMaterial(gate)), gate.nonEvidenceGateId]));
  const candidatePaths = evaluation.results.map((result) => {
    const evidenceItemIds = evidenceItems
      .filter((item) => item.affectedProductFamilyIds.includes(result.productFamilyId))
      .map((item) => item.evidenceItemId);
    const nonEvidenceGateIds = [...(familyGateKeys.get(result.productFamilyId) || [])]
      .map((key) => gateIdByKey.get(key))
      .filter(Boolean)
      .sort(compareAscii);
    return {
      productFamilyId: result.productFamilyId,
      currentFitResult: result.result,
      currentWindowState: result.window.state,
      evidenceItemIds,
      evidenceItemCount: evidenceItemIds.length,
      nonEvidenceGateIds,
      eligibleForEvidenceOnlyReevaluation: evidenceItemIds.length > 0 && nonEvidenceGateIds.length === 0,
      completionEffect: 'RE_EVALUATE_ONLY',
      fitGuarantee: false
    };
  }).sort((left, right) => (
    Number(right.eligibleForEvidenceOnlyReevaluation) - Number(left.eligibleForEvidenceOnlyReevaluation)
    || left.evidenceItemCount - right.evidenceItemCount
    || windowPriority(left.currentWindowState) - windowPriority(right.currentWindowState)
    || compareAscii(left.productFamilyId, right.productFamilyId)
  ));

  const alreadyReviewable = evaluation.results.some((result) => result.result === 'FIT' && REVIEWABLE_WINDOWS.has(result.window.state));
  const selectedPath = alreadyReviewable
    ? null
    : candidatePaths.find((path) => path.eligibleForEvidenceOnlyReevaluation) || null;
  const minimumEvidenceSet = selectedPath
    ? selectedPath.evidenceItemIds.map((id) => evidenceItems.find((item) => item.evidenceItemId === id))
    : [];
  const allNotFit = evaluation.results.length > 0 && evaluation.results.every((result) => result.result === 'NOT_FIT');
  let advancementState = 'NON_EVIDENCE_GATE_BLOCKED';
  if (alreadyReviewable) advancementState = 'ALREADY_REVIEWABLE';
  else if (selectedPath) advancementState = 'EVIDENCE_REQUIRED_FOR_REEVALUATION';
  else if (allNotFit) advancementState = 'NO_EVIDENCE_ONLY_ADVANCE_PATH';
  else if (evaluation.results.length === 0) advancementState = 'NO_EVALUABLE_PRODUCT_SCOPE';

  const artifact = {
    schemaVersion: MINIMUM_EVIDENCE_SCHEMA_VERSION,
    boundary: PURSUIT_TWIN_BOUNDARY,
    evidenceBoundary: PURSUIT_TWIN_EVIDENCE_BOUNDARY,
    productionReady: false,
    issue165Status: 'HOLD',
    synthetic: true,
    opportunityId: normalizedOpportunity.opportunityId,
    opportunityCanonicalSha256: sha256(normalizedOpportunity),
    evaluationCanonicalSha256: sha256(evaluation),
    materializedRegistryCanonicalSha256: sha256(materializedRegistryPayload(registry)),
    verticalPackCanonicalSha256: sha256(verticalPack),
    objective: 'RE_EVALUATE_AT_LEAST_ONE_PRODUCT_FAMILY',
    advancementState,
    currentTechnicalOutcomes: evaluation.results.map(evaluationSummary),
    evidenceItems,
    nonEvidenceGates,
    candidatePaths,
    selectedProductFamilyId: selectedPath?.productFamilyId || null,
    minimumEvidenceSet,
    nextEvidenceItem: minimumEvidenceSet[0] || null,
    completionEffect: 'RE_EVALUATE_ONLY',
    fitGuarantee: false,
    finalHumanDecision: 'NOT_MADE',
    explicitNonClaims: [
      'Completing the evidence set does not guarantee FIT, pursuit approval, or commercial success.',
      'Verified hard mismatches, closed or not-yet-open windows, cancellation, and missing policies are not represented as evidence gaps.',
      'No counterfactual fit, outreach, production access, deployment, or automatic decision was performed.'
    ]
  };
  const result = withCanonicalHash(artifact);
  assertBoundedArtifact(result, '$.minimumEvidenceToAdvance');
  return result;
}

export function buildPursuitTwinReviewPacket(
  { previousSnapshot, currentSnapshot, priorHumanDecision = null } = {},
  registry,
  verticalPack
) {
  const previous = validatePursuitRevisionSnapshot(previousSnapshot, registry, verticalPack);
  const current = validatePursuitRevisionSnapshot(currentSnapshot, registry, verticalPack);
  const specificationDelta = evaluateSpecificationDelta(previous, current, registry, verticalPack, { priorHumanDecision });
  const currentEvaluation = evaluateSpecificationFit(current.opportunity, registry, verticalPack);
  const currentPursuitDossier = buildPursuitDossier(current.opportunity, currentEvaluation, registry, verticalPack);
  const minimumEvidenceToAdvance = buildMinimumEvidenceToAdvance(current.opportunity, registry, verticalPack);
  const packet = {
    schemaVersion: REVIEW_PACKET_SCHEMA_VERSION,
    boundary: PURSUIT_TWIN_BOUNDARY,
    evidenceBoundary: PURSUIT_TWIN_EVIDENCE_BOUNDARY,
    productionReady: false,
    issue165Status: 'HOLD',
    synthetic: true,
    opportunityId: current.opportunity.opportunityId,
    previousSnapshotCanonicalSha256: previous.canonicalSha256,
    currentSnapshotCanonicalSha256: current.canonicalSha256,
    specificationDelta,
    currentPursuitDossier,
    currentPursuitDossierCanonicalSha256: sha256(currentPursuitDossier),
    minimumEvidenceToAdvance,
    excludedCapabilities: ['COUNTERFACTUAL_FIT'],
    finalHumanDecision: 'NOT_MADE',
    explicitNonClaims: [
      'This local/test review packet is not production evidence or production readiness approval.',
      'The packet does not make or replace a human pursuit decision.',
      'Counterfactual fit is excluded and no assumption namespace was created.'
    ]
  };
  const result = withCanonicalHash(packet);
  assertBoundedArtifact(result, '$.pursuitTwinReviewPacket');
  return result;
}

function assertNestedCanonicalArtifact(value, path, schemaVersion) {
  assertPlainObject(value, path, 'INVALID_PURSUIT_TWIN_NESTED_ARTIFACT');
  if (value.schemaVersion !== schemaVersion
    || value.boundary !== PURSUIT_TWIN_BOUNDARY
    || value.evidenceBoundary !== PURSUIT_TWIN_EVIDENCE_BOUNDARY
    || value.productionReady !== false
    || value.issue165Status !== 'HOLD'
    || value.synthetic !== true) {
    throw new ClaimValidationError('INVALID_PURSUIT_TWIN_NESTED_ARTIFACT', path);
  }
  if (value.canonicalSha256 !== sha256(canonicalHashPayload(value))) {
    throw new ClaimValidationError('PURSUIT_TWIN_NESTED_HASH_MISMATCH', `${path}.canonicalSha256`);
  }
}

function assertSha256(value, path) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) {
    throw new ClaimValidationError('INVALID_SHA256', path);
  }
}

function assertPursuitTwinReviewPacket(packet) {
  assertBoundedArtifact(packet, '$.pursuitTwinReviewPacket');
  assertPlainObject(packet, '$.pursuitTwinReviewPacket', 'INVALID_PURSUIT_TWIN_REVIEW_PACKET');
  if (packet.schemaVersion !== REVIEW_PACKET_SCHEMA_VERSION
    || packet.boundary !== PURSUIT_TWIN_BOUNDARY
    || packet.evidenceBoundary !== PURSUIT_TWIN_EVIDENCE_BOUNDARY
    || packet.productionReady !== false
    || packet.issue165Status !== 'HOLD'
    || packet.synthetic !== true
    || packet.finalHumanDecision !== 'NOT_MADE'
    || canonicalStringify(packet.excludedCapabilities) !== canonicalStringify(['COUNTERFACTUAL_FIT'])) {
    throw new ClaimValidationError('INVALID_PURSUIT_TWIN_REVIEW_PACKET', '$.pursuitTwinReviewPacket');
  }
  assertSha256(packet.previousSnapshotCanonicalSha256, '$.pursuitTwinReviewPacket.previousSnapshotCanonicalSha256');
  assertSha256(packet.currentSnapshotCanonicalSha256, '$.pursuitTwinReviewPacket.currentSnapshotCanonicalSha256');
  assertSha256(packet.currentPursuitDossierCanonicalSha256, '$.pursuitTwinReviewPacket.currentPursuitDossierCanonicalSha256');
  if (packet.canonicalSha256 !== sha256(canonicalHashPayload(packet))) {
    throw new ClaimValidationError('PURSUIT_TWIN_REVIEW_PACKET_HASH_MISMATCH', '$.pursuitTwinReviewPacket.canonicalSha256');
  }
  assertNestedCanonicalArtifact(packet.specificationDelta, '$.pursuitTwinReviewPacket.specificationDelta', DELTA_SCHEMA_VERSION);
  assertNestedCanonicalArtifact(packet.minimumEvidenceToAdvance, '$.pursuitTwinReviewPacket.minimumEvidenceToAdvance', MINIMUM_EVIDENCE_SCHEMA_VERSION);
  const delta = packet.specificationDelta;
  const minimum = packet.minimumEvidenceToAdvance;
  const dossier = packet.currentPursuitDossier;
  if (!Array.isArray(delta.revisionTimeline) || delta.revisionTimeline.length !== 2
    || delta.revisionTimeline[0].snapshotCanonicalSha256 !== packet.previousSnapshotCanonicalSha256
    || delta.revisionTimeline[1].snapshotCanonicalSha256 !== packet.currentSnapshotCanonicalSha256
    || delta.revisionTimeline[1].opportunityCanonicalSha256 !== minimum.opportunityCanonicalSha256
    || delta.opportunityId !== packet.opportunityId
    || minimum.opportunityId !== packet.opportunityId) {
    throw new ClaimValidationError('PURSUIT_TWIN_PACKET_LINEAGE_MISMATCH', '$.pursuitTwinReviewPacket');
  }
  if (delta.decisionReview?.replacementHumanDecision !== 'NOT_MADE'
    || delta.decisionReview?.automaticDecisionChangePerformed !== false
    || minimum.finalHumanDecision !== 'NOT_MADE'
    || minimum.fitGuarantee !== false
    || minimum.completionEffect !== 'RE_EVALUATE_ONLY') {
    throw new ClaimValidationError('PURSUIT_TWIN_AUTHORITY_BOUNDARY_MISMATCH', '$.pursuitTwinReviewPacket');
  }
  if (packet.currentPursuitDossierCanonicalSha256 !== sha256(dossier)) {
    throw new ClaimValidationError('PURSUIT_TWIN_DOSSIER_HASH_MISMATCH', '$.pursuitTwinReviewPacket.currentPursuitDossierCanonicalSha256');
  }
  if (!isPlainObject(dossier)
    || dossier.schemaVersion !== 'pursuit-dossier-v0'
    || dossier.boundary !== PURSUIT_TWIN_EVIDENCE_BOUNDARY
    || dossier.productionReady !== false
    || dossier.issue165Status !== 'HOLD'
    || dossier.synthetic !== true
    || dossier.opportunity?.opportunityId !== packet.opportunityId
    || dossier.decision?.finalHumanPursuitDecision !== 'NOT_MADE') {
    throw new ClaimValidationError('PURSUIT_TWIN_DOSSIER_BOUNDARY_MISMATCH', '$.pursuitTwinReviewPacket.currentPursuitDossier');
  }
  const priorDecision = delta.decisionReview?.priorHumanDecision;
  if (priorDecision && priorDecision.snapshotCanonicalSha256 !== packet.previousSnapshotCanonicalSha256) {
    throw new ClaimValidationError('PURSUIT_TWIN_PRIOR_DECISION_LINEAGE_MISMATCH', '$.pursuitTwinReviewPacket.specificationDelta.decisionReview');
  }
  return packet;
}

export function renderPursuitTwinReviewPacketJson(packet) {
  assertPursuitTwinReviewPacket(packet);
  const output = `${JSON.stringify(cloneCanonical(packet), null, 2)}\n`;
  if (Buffer.byteLength(output, 'utf8') > MAX_PACKET_BYTES) {
    throw new ClaimValidationError('PURSUIT_TWIN_ARTIFACT_TOO_LARGE', '$.pursuitTwinReviewPacket');
  }
  return output;
}

function markdownValue(value) {
  return renderMarkdownCell(typeof value === 'string' ? value : canonicalStringify(value));
}

export function renderPursuitTwinReviewPacketMarkdown(packet) {
  assertPursuitTwinReviewPacket(packet);
  const delta = packet.specificationDelta;
  const evidence = packet.minimumEvidenceToAdvance;
  const dossier = packet.currentPursuitDossier;
  const lines = [
    '# Pursuit Twin v0 Review Packet',
    '',
    `- Boundary: ${markdownValue(packet.boundary)}`,
    `- Opportunity: ${markdownValue(packet.opportunityId)}`,
    `- Production ready: ${markdownValue(packet.productionReady)}`,
    `- Issue #165: ${markdownValue(packet.issue165Status)}`,
    `- Final human decision: ${markdownValue(packet.finalHumanDecision)}`,
    '',
    '## Spec Delta',
    '',
    `- Document: ${markdownValue(delta.documentRevisionChange.documentKey)}`,
    `- Revision: ${markdownValue(delta.documentRevisionChange.previousRevisionId)} → ${markdownValue(delta.documentRevisionChange.currentRevisionId)}`,
    `- Evaluation invalidated: ${markdownValue(delta.evaluationInvalidated)}`,
    `- Technical outcome changed: ${markdownValue(delta.technicalOutcomeChanged)}`,
    `- Human decision review: ${markdownValue(delta.decisionReview.state)}`,
    '',
    '| Product family | Change | Fields | Previous result/window | Current result/window |',
    '| --- | --- | --- | --- | --- |',
    ...(delta.fitChanges.length ? delta.fitChanges.map((change) => (
      `| ${markdownValue(change.productFamilyId)} | ${markdownValue(change.changeType)} | ${markdownValue(change.changedFields.join(', '))} | ${markdownValue(change.previous ? `${change.previous.result}/${change.previous.windowState}` : 'None')} | ${markdownValue(change.current ? `${change.current.result}/${change.current.windowState}` : 'None')} |`
    )) : ['| None | UNCHANGED | None | None | None |']),
    '',
    '### Requirement changes',
    '',
    ...(delta.requirementChanges.length ? delta.requirementChanges.map((change) => (
      `- ${markdownValue(change.requirementId)}: ${markdownValue(change.changeType)} (${markdownValue(change.changedFields.join(', '))})`
    )) : ['- None']),
    '',
    '## Minimum Evidence to Advance',
    '',
    `- State: ${markdownValue(evidence.advancementState)}`,
    `- Objective: ${markdownValue(evidence.objective)}`,
    `- Selected product family: ${markdownValue(evidence.selectedProductFamilyId || 'None')}`,
    `- Completion effect: ${markdownValue(evidence.completionEffect)}`,
    `- FIT guarantee: ${markdownValue(evidence.fitGuarantee)}`,
    '',
    ...(evidence.minimumEvidenceSet.length ? evidence.minimumEvidenceSet.map((item) => (
      `- ${markdownValue(item.evidenceItemId)} — ${markdownValue(item.text)} [${markdownValue(item.actionCode)}]`
    )) : ['- No evidence-only minimum set']),
    '',
    '### Non-evidence gates',
    '',
    ...(evidence.nonEvidenceGates.length ? evidence.nonEvidenceGates.map((gate) => (
      `- ${markdownValue(gate.code)}${gate.productFamilyId ? ` — ${markdownValue(gate.productFamilyId)}` : ''}: ${markdownValue(gate.detail)}`
    )) : ['- None']),
    '',
    '## Current Technical Fit',
    '',
    '| Product family | Result | Window | Reasons |',
    '| --- | --- | --- | --- |',
    ...dossier.specificationFitMatrix.map((item) => (
      `| ${markdownValue(item.productFamilyId)} | ${markdownValue(item.result)} | ${markdownValue(item.specificationWindow.state)} | ${markdownValue(item.reasonCodes.join(', '))} |`
    )),
    '',
    '## Explicit non-claims',
    '',
    ...packet.explicitNonClaims.map((item) => `- ${markdownValue(item)}`),
    ...delta.explicitNonClaims.map((item) => `- ${markdownValue(item)}`),
    ...evidence.explicitNonClaims.map((item) => `- ${markdownValue(item)}`),
    ''
  ];
  const output = lines.join('\n');
  if (Buffer.byteLength(output, 'utf8') > MAX_PACKET_BYTES) {
    throw new ClaimValidationError('PURSUIT_TWIN_ARTIFACT_TOO_LARGE', '$.pursuitTwinReviewPacket');
  }
  return output;
}

export function pursuitTwinReviewPacketHashes(packet) {
  return {
    jsonSha256: sha256(renderPursuitTwinReviewPacketJson(packet)),
    markdownSha256: sha256(renderPursuitTwinReviewPacketMarkdown(packet))
  };
}
