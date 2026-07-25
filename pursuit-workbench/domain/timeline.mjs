import {
  assertSafeArtifact,
  assertValidatedClaimRegistry,
  CLAIM_STATUSES,
  ClaimValidationError,
  canonicalStringify,
  sha256
} from '../../knowledge/claim-registry/index.mjs';
import {
  buildPursuitDossier,
  dossierHashes,
  validateProjectOpportunity
} from '../../verticals/datacenter/index.mjs';

export const TIMELINE_SCHEMA_VERSION = 'project-signal-timeline-v0';
export const TIMELINE_EVENT_SCHEMA_VERSION = 'project-signal-event-v0';
export const TIMELINE_LIMITS = Object.freeze({
  maxEvents: 100,
  maxBytes: 256 * 1024,
  maxTitleLength: 160,
  maxSummaryLength: 500,
  maxClaimRefs: 20,
  maxEvidenceRefs: 5,
  maxRequirementRefs: 100,
  maxProductFamilyRefs: 20,
  maxReasonCodes: 40
});

export const EVIDENCE_EVENT_TYPES = Object.freeze([
  'PROJECT_SIGNAL_EVIDENCE',
  'PROJECT_STAGE_EVIDENCE',
  'TECHNICAL_REQUIREMENT_IDENTIFIED',
  'PRODUCT_CAPABILITY_EVIDENCE'
]);

export const DERIVED_EVENT_TYPES = Object.freeze([
  'CLAIM_CONFLICT_RECOGNIZED',
  'CLAIM_RETRACTION_RECOGNIZED',
  'PROJECT_STAGE_CHANGED',
  'SPECIFICATION_FIT_EVALUATED',
  'SPECIFICATION_FIT_CHANGED',
  'SPECIFICATION_WINDOW_EVALUATED',
  'SPECIFICATION_WINDOW_CHANGED',
  'DOSSIER_RECOMPUTED'
]);

const EVENT_TYPE_ORDER = Object.freeze([...EVIDENCE_EVENT_TYPES, ...DERIVED_EVENT_TYPES]);
const EVENT_TYPE_RANK = new Map(EVENT_TYPE_ORDER.map((type, index) => [type, index]));
const EVIDENCE_TYPES = new Set(EVIDENCE_EVENT_TYPES);
const DERIVED_TYPES = new Set(DERIVED_EVENT_TYPES);
const SOURCE_STATES = new Set(CLAIM_STATUSES);
const EVIDENCE_USES = new Set(['ACTIVE_FOR_CURRENT_OPPORTUNITY', 'BLOCKED']);
const TIME_BASES = new Set(['EVIDENCE_EFFECTIVE_AT', 'EVIDENCE_PUBLISHED_AT', 'REGISTRY_AS_OF']);
const STATE_DIMENSIONS = new Set(['PROJECT_STAGE', 'FIT_RESULT', 'SPECIFICATION_WINDOW']);
const VALIDATED_TIMELINES = new WeakSet();

const EVENT_KEYS = new Set([
  'schemaVersion', 'eventId', 'eventClass', 'eventType', 'opportunityId',
  'occurredAt', 'observedAt', 'timeBasis', 'title', 'summary', 'claimIds',
  'evidenceIds', 'requirementIds', 'productFamilyIds', 'sourceState',
  'evidenceUse', 'reasonCodes', 'state'
]);

function compareAscii(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
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

function assertExactIso(value, path) {
  if (typeof value !== 'string' || !value || Number.isNaN(Date.parse(value)) || new Date(value).toISOString() !== value) {
    throw new ClaimValidationError('TIMELINE_TIMESTAMP_INVALID', path);
  }
}

function normalizeText(value, path, maximum) {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) {
    throw new ClaimValidationError('TIMELINE_TEXT_INVALID', path);
  }
  return value.trim();
}

function normalizeRefs(value, path, maximum) {
  if (!Array.isArray(value) || value.length > maximum || value.some((item) => typeof item !== 'string' || !item || item.length > 128)) {
    throw new ClaimValidationError('TIMELINE_REFS_INVALID', path);
  }
  if (new Set(value).size !== value.length) throw new ClaimValidationError('TIMELINE_REFS_DUPLICATE', path);
  return [...value].sort(compareAscii);
}

function eventPayload(event) {
  const { eventId: _eventId, ...payload } = event;
  return payload;
}

function expectedEventId(event) {
  return `evt_${sha256(eventPayload(event))}`;
}

function validateState(state, eventType, verticalPack, path) {
  if (state === null) return null;
  if (!isPlainObject(state) || !STATE_DIMENSIONS.has(state.dimension) || typeof state.after !== 'string' || !state.after) {
    throw new ClaimValidationError('TIMELINE_STATE_INVALID', path);
  }
  const before = state.before === null ? null : state.before;
  if (before !== null && (typeof before !== 'string' || !before)) throw new ClaimValidationError('TIMELINE_STATE_INVALID', `${path}.before`);
  if (eventType.endsWith('_EVALUATED') && before !== null) throw new ClaimValidationError('TIMELINE_EVALUATION_HAS_PRIOR_STATE', path);
  if (eventType.endsWith('_CHANGED') && (before === null || before === state.after)) throw new ClaimValidationError('TIMELINE_CHANGE_REQUIRES_TRANSITION', path);
  if (state.dimension === 'PROJECT_STAGE') {
    if (!verticalPack.projectStages.includes(state.after) || (before && !verticalPack.projectStages.includes(before))) {
      throw new ClaimValidationError('TIMELINE_STAGE_INVALID', path);
    }
    if (before) {
      const beforeRank = verticalPack.projectStages.indexOf(before);
      const afterRank = verticalPack.projectStages.indexOf(state.after);
      if (afterRank < beforeRank) throw new ClaimValidationError('TIMELINE_STAGE_REGRESSION', path);
    }
  }
  return { dimension: state.dimension, before, after: state.after };
}

function normalizeEvent(rawEvent, context, index) {
  const path = `$.timeline.events[${index}]`;
  if (!isPlainObject(rawEvent)) throw new ClaimValidationError('TIMELINE_EVENT_INVALID', path);
  for (const key of Object.keys(rawEvent)) {
    if (!EVENT_KEYS.has(key)) throw new ClaimValidationError('TIMELINE_EVENT_FIELD_REFUSED', `${path}.${key}`);
  }
  if (rawEvent.schemaVersion !== TIMELINE_EVENT_SCHEMA_VERSION) throw new ClaimValidationError('TIMELINE_EVENT_SCHEMA_INVALID', `${path}.schemaVersion`);
  if (!['EVIDENCE', 'DERIVED'].includes(rawEvent.eventClass)) throw new ClaimValidationError('TIMELINE_EVENT_CLASS_INVALID', `${path}.eventClass`);
  if (!EVENT_TYPE_RANK.has(rawEvent.eventType)) throw new ClaimValidationError('TIMELINE_EVENT_TYPE_INVALID', `${path}.eventType`);
  if ((rawEvent.eventClass === 'EVIDENCE') !== EVIDENCE_TYPES.has(rawEvent.eventType)
    || (rawEvent.eventClass === 'DERIVED') !== DERIVED_TYPES.has(rawEvent.eventType)) {
    throw new ClaimValidationError('TIMELINE_EVENT_CLASS_MISMATCH', path);
  }
  if (rawEvent.opportunityId !== context.opportunity.opportunityId) throw new ClaimValidationError('TIMELINE_FOREIGN_OPPORTUNITY', `${path}.opportunityId`);
  assertExactIso(rawEvent.occurredAt, `${path}.occurredAt`);
  if (rawEvent.occurredAt > context.asOf) throw new ClaimValidationError('TIMELINE_FUTURE_EVENT', `${path}.occurredAt`);
  if (!TIME_BASES.has(rawEvent.timeBasis)) throw new ClaimValidationError('TIMELINE_TIME_BASIS_INVALID', `${path}.timeBasis`);
  const observedAt = rawEvent.observedAt === null ? null : rawEvent.observedAt;
  if (observedAt !== null) assertExactIso(observedAt, `${path}.observedAt`);
  const claimIds = normalizeRefs(rawEvent.claimIds, `${path}.claimIds`, TIMELINE_LIMITS.maxClaimRefs);
  const evidenceIds = normalizeRefs(rawEvent.evidenceIds, `${path}.evidenceIds`, TIMELINE_LIMITS.maxEvidenceRefs);
  const requirementIds = normalizeRefs(rawEvent.requirementIds, `${path}.requirementIds`, TIMELINE_LIMITS.maxRequirementRefs);
  const productFamilyIds = normalizeRefs(rawEvent.productFamilyIds, `${path}.productFamilyIds`, TIMELINE_LIMITS.maxProductFamilyRefs);
  const reasonCodes = normalizeRefs(rawEvent.reasonCodes, `${path}.reasonCodes`, TIMELINE_LIMITS.maxReasonCodes);
  for (const claimId of claimIds) {
    if (!context.registry.byId.has(claimId)) throw new ClaimValidationError('TIMELINE_CLAIM_UNKNOWN', `${path}.claimIds`);
  }
  const referencedClaims = claimIds.map((claimId) => context.registry.byId.get(claimId));
  for (const evidenceId of evidenceIds) {
    if (!referencedClaims.some((claim) => claim.evidence.some((evidence) => evidence.evidenceId === evidenceId))) {
      throw new ClaimValidationError('TIMELINE_EVIDENCE_UNKNOWN', `${path}.evidenceIds`);
    }
  }
  for (const requirementId of requirementIds) {
    if (!context.requirementIds.has(requirementId)) throw new ClaimValidationError('TIMELINE_REQUIREMENT_UNKNOWN', `${path}.requirementIds`);
  }
  for (const productFamilyId of productFamilyIds) {
    if (!context.productFamilyIds.has(productFamilyId) || !context.verticalPack.specificationWindows?.[productFamilyId]) {
      throw new ClaimValidationError('TIMELINE_PRODUCT_FAMILY_UNKNOWN', `${path}.productFamilyIds`);
    }
  }
  let sourceState = rawEvent.sourceState === null ? null : rawEvent.sourceState;
  let evidenceUse = rawEvent.evidenceUse === null ? null : rawEvent.evidenceUse;
  if (rawEvent.eventClass === 'EVIDENCE') {
    if (claimIds.length === 0 || evidenceIds.length === 0 || observedAt === null) throw new ClaimValidationError('TIMELINE_EVIDENCE_TRACE_REQUIRED', path);
    if (!SOURCE_STATES.has(sourceState) || !EVIDENCE_USES.has(evidenceUse)) throw new ClaimValidationError('TIMELINE_EVIDENCE_STATE_INVALID', path);
    if (referencedClaims.some((claim) => claim.status !== sourceState)) throw new ClaimValidationError('TIMELINE_SOURCE_STATE_MISMATCH', path);
    if (referencedClaims.some((claim) => claim.status === 'RETRACTED') && evidenceUse !== 'BLOCKED') {
      throw new ClaimValidationError('TIMELINE_RETRACTED_EVIDENCE_ACTIVE', path);
    }
  } else {
    if (observedAt !== null || sourceState !== null || evidenceUse !== null || evidenceIds.length !== 0 || rawEvent.timeBasis !== 'REGISTRY_AS_OF') {
      throw new ClaimValidationError('TIMELINE_DERIVED_SOURCE_FIELDS_REFUSED', path);
    }
  }
  const normalized = {
    schemaVersion: TIMELINE_EVENT_SCHEMA_VERSION,
    eventId: rawEvent.eventId || '',
    eventClass: rawEvent.eventClass,
    eventType: rawEvent.eventType,
    opportunityId: rawEvent.opportunityId,
    occurredAt: rawEvent.occurredAt,
    observedAt,
    timeBasis: rawEvent.timeBasis,
    title: normalizeText(rawEvent.title, `${path}.title`, TIMELINE_LIMITS.maxTitleLength),
    summary: normalizeText(rawEvent.summary, `${path}.summary`, TIMELINE_LIMITS.maxSummaryLength),
    claimIds,
    evidenceIds,
    requirementIds,
    productFamilyIds,
    sourceState,
    evidenceUse,
    reasonCodes,
    state: validateState(rawEvent.state, rawEvent.eventType, context.verticalPack, `${path}.state`)
  };
  const computedId = expectedEventId(normalized);
  if (normalized.eventId && normalized.eventId !== computedId) throw new ClaimValidationError('TIMELINE_EVENT_ID_MISMATCH', `${path}.eventId`);
  normalized.eventId = computedId;
  return normalized;
}

function compareEvents(left, right) {
  return compareAscii(left.occurredAt, right.occurredAt)
    || (left.eventClass === right.eventClass ? 0 : left.eventClass === 'EVIDENCE' ? -1 : 1)
    || (EVENT_TYPE_RANK.get(left.eventType) - EVENT_TYPE_RANK.get(right.eventType))
    || compareAscii(left.eventId, right.eventId);
}

export function createValidatedProjectSignalTimeline(rawTimeline, { registry, opportunity, verticalPack }) {
  assertValidatedClaimRegistry(registry);
  validateProjectOpportunity(opportunity, verticalPack);
  assertSafeArtifact(rawTimeline, '$.timeline');
  if (!isPlainObject(rawTimeline)
    || rawTimeline.schemaVersion !== TIMELINE_SCHEMA_VERSION
    || rawTimeline.boundary !== 'NOT_PRODUCTION_EVIDENCE'
    || rawTimeline.productionReady !== false
    || rawTimeline.issue165Status !== 'HOLD'
    || rawTimeline.synthetic !== true
    || rawTimeline.opportunityId !== opportunity.opportunityId
    || rawTimeline.asOf !== registry.asOf
    || !isPlainObject(rawTimeline.sourceHashes)
    || !Array.isArray(rawTimeline.events)
    || rawTimeline.events.length > TIMELINE_LIMITS.maxEvents) {
    throw new ClaimValidationError('TIMELINE_CONTRACT_INVALID', '$.timeline');
  }
  assertExactIso(rawTimeline.asOf, '$.timeline.asOf');
  for (const [name, hash] of Object.entries(rawTimeline.sourceHashes)) {
    if (!['opportunitySha256', 'evaluationSha256', 'dossierJsonSha256'].includes(name) || !/^[a-f0-9]{64}$/.test(hash)) {
      throw new ClaimValidationError('TIMELINE_SOURCE_HASH_INVALID', `$.timeline.sourceHashes.${name}`);
    }
  }
  if (Object.keys(rawTimeline.sourceHashes).length !== 3) throw new ClaimValidationError('TIMELINE_SOURCE_HASH_INVALID', '$.timeline.sourceHashes');
  const context = {
    asOf: rawTimeline.asOf,
    registry,
    opportunity,
    verticalPack,
    requirementIds: new Set(opportunity.requirements.map((item) => item.requirementId)),
    productFamilyIds: new Set(opportunity.candidateProductFamilyIds)
  };
  const events = rawTimeline.events.map((event, index) => normalizeEvent(event, context, index)).sort(compareEvents);
  if (new Set(events.map((event) => event.eventId)).size !== events.length) throw new ClaimValidationError('TIMELINE_EVENT_ID_DUPLICATE', '$.timeline.events');
  const timeline = canonicalClone({
    schemaVersion: TIMELINE_SCHEMA_VERSION,
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    productionReady: false,
    issue165Status: 'HOLD',
    synthetic: true,
    opportunityId: opportunity.opportunityId,
    asOf: rawTimeline.asOf,
    sourceHashes: rawTimeline.sourceHashes,
    events
  });
  if (Buffer.byteLength(canonicalStringify(timeline), 'utf8') > TIMELINE_LIMITS.maxBytes) {
    throw new ClaimValidationError('TIMELINE_TOO_LARGE', '$.timeline');
  }
  deepFreeze(timeline);
  VALIDATED_TIMELINES.add(timeline);
  return timeline;
}

export function assertValidatedProjectSignalTimeline(timeline, path = '$.timeline') {
  if (!VALIDATED_TIMELINES.has(timeline)) throw new ClaimValidationError('UNVALIDATED_TIMELINE', path);
  return true;
}

function resolveClaim(registry, reference, path) {
  const claim = registry.byId.get(reference) || registry.byKey.get(reference);
  if (!claim) throw new ClaimValidationError('TIMELINE_CLAIM_UNKNOWN', path);
  return claim;
}

function derivedEvent({ eventType, opportunityId, asOf, title, summary, claimIds = [], requirementIds = [], productFamilyIds = [], reasonCodes = [], state = null }) {
  return {
    schemaVersion: TIMELINE_EVENT_SCHEMA_VERSION,
    eventClass: 'DERIVED',
    eventType,
    opportunityId,
    occurredAt: asOf,
    observedAt: null,
    timeBasis: 'REGISTRY_AS_OF',
    title,
    summary,
    claimIds,
    evidenceIds: [],
    requirementIds,
    productFamilyIds,
    sourceState: null,
    evidenceUse: null,
    reasonCodes,
    state
  };
}

export function buildProjectSignalTimeline(opportunity, evaluation, registry, verticalPack) {
  assertValidatedClaimRegistry(registry);
  validateProjectOpportunity(opportunity, verticalPack);
  const dossier = buildPursuitDossier(opportunity, evaluation, registry, verticalPack);
  const hashes = dossierHashes(dossier);
  const associations = new Map();
  const register = (claim, eventType, requirementIds = [], productFamilyIds = []) => {
    const current = associations.get(claim.claimId) || { claim, eventType, requirementIds: new Set(), productFamilyIds: new Set() };
    if (current.eventType === 'PROJECT_SIGNAL_EVIDENCE' || eventType !== 'PROJECT_SIGNAL_EVIDENCE') current.eventType = eventType;
    requirementIds.forEach((id) => current.requirementIds.add(id));
    productFamilyIds.forEach((id) => current.productFamilyIds.add(id));
    associations.set(claim.claimId, current);
  };
  for (const reference of opportunity.stage?.evidenceClaimRefs || []) register(resolveClaim(registry, reference, '$.opportunity.stage.evidenceClaimRefs'), 'PROJECT_STAGE_EVIDENCE');
  for (const requirement of opportunity.requirements) {
    for (const reference of requirement.evidenceClaimRefs || []) {
      register(resolveClaim(registry, reference, `$.opportunity.requirements.${requirement.requirementId}`), 'TECHNICAL_REQUIREMENT_IDENTIFIED', [requirement.requirementId], requirement.productFamilyIds);
    }
  }
  for (const result of evaluation.results) {
    for (const requirementResult of result.requirementResults) {
      for (const claimId of requirementResult.projectClaimIds) register(resolveClaim(registry, claimId, '$.evaluation'), 'TECHNICAL_REQUIREMENT_IDENTIFIED', [requirementResult.requirementId], [result.productFamilyId]);
      for (const claimId of requirementResult.capabilityClaimIds) register(resolveClaim(registry, claimId, '$.evaluation'), 'PRODUCT_CAPABILITY_EVIDENCE', [requirementResult.requirementId], [result.productFamilyId]);
    }
    for (const claimId of result.window.stageClaimIds) register(resolveClaim(registry, claimId, '$.evaluation'), 'PROJECT_STAGE_EVIDENCE', [], [result.productFamilyId]);
  }
  for (const claim of [...dossier.customerUsableClaims, ...dossier.blockedClaims, ...dossier.conflictingClaims]) {
    register(resolveClaim(registry, claim.claimId, '$.dossier'), 'PROJECT_SIGNAL_EVIDENCE');
  }
  const allowedIds = new Set(dossier.customerUsableClaims.map((claim) => claim.claimId));
  const blockedById = new Map(dossier.blockedClaims.map((claim) => [claim.claimId, claim]));
  const rawEvents = [];
  for (const association of associations.values()) {
    const { claim } = association;
    for (const evidence of claim.evidence) {
      const allowed = allowedIds.has(claim.claimId);
      rawEvents.push({
        schemaVersion: TIMELINE_EVENT_SCHEMA_VERSION,
        eventClass: 'EVIDENCE',
        eventType: association.eventType,
        opportunityId: opportunity.opportunityId,
        occurredAt: evidence.effectiveAt || evidence.publishedAt,
        observedAt: evidence.retrievedAt,
        timeBasis: evidence.effectiveAt ? 'EVIDENCE_EFFECTIVE_AT' : 'EVIDENCE_PUBLISHED_AT',
        title: allowed ? `${claim.claimType.replaceAll('_', ' ')} evidence` : `${claim.claimType.replaceAll('_', ' ')} blocked metadata`,
        summary: allowed ? claim.statement : `Claim ${claim.claimId} is blocked for customer use; source content is intentionally withheld.`,
        claimIds: [claim.claimId],
        evidenceIds: [evidence.evidenceId],
        requirementIds: [...association.requirementIds],
        productFamilyIds: [...association.productFamilyIds],
        sourceState: claim.status,
        evidenceUse: allowed ? 'ACTIVE_FOR_CURRENT_OPPORTUNITY' : 'BLOCKED',
        reasonCodes: blockedById.get(claim.claimId)?.reasonCodes || [],
        state: claim.claimType === 'PROJECT_STAGE'
          ? { dimension: 'PROJECT_STAGE', before: null, after: claim.value.value }
          : null
      });
    }
  }
  const conflictPairs = new Set();
  for (const conflict of dossier.conflictingClaims) {
    const pair = [conflict.claimId, ...conflict.conflictClaimIds].sort(compareAscii);
    const pairKey = pair.join(':');
    if (conflictPairs.has(pairKey)) continue;
    conflictPairs.add(pairKey);
    const requirementIds = [...new Set(pair.flatMap((claimId) => [...(associations.get(claimId)?.requirementIds || [])]))].sort(compareAscii);
    const productFamilyIds = [...new Set(pair.flatMap((claimId) => [...(associations.get(claimId)?.productFamilyIds || [])]))].sort(compareAscii);
    rawEvents.push(derivedEvent({
      eventType: 'CLAIM_CONFLICT_RECOGNIZED', opportunityId: opportunity.opportunityId, asOf: registry.asOf,
      title: 'Claim conflict recognized', summary: 'Conflicting claim IDs remain unresolved and neither side is selected.',
      claimIds: pair, requirementIds, productFamilyIds, reasonCodes: ['CLAIM_CONFLICT']
    }));
  }
  for (const blocked of dossier.blockedClaims) {
    const claim = registry.byId.get(blocked.claimId);
    if (claim?.status !== 'RETRACTED') continue;
    const association = associations.get(claim.claimId);
    rawEvents.push(derivedEvent({
      eventType: 'CLAIM_RETRACTION_RECOGNIZED', opportunityId: opportunity.opportunityId, asOf: registry.asOf,
      title: 'Claim retraction recognized', summary: `Retracted claim ${claim.claimId} is blocked; source content is intentionally withheld.`,
      claimIds: [claim.claimId],
      requirementIds: [...(association?.requirementIds || [])],
      productFamilyIds: [...(association?.productFamilyIds || [])],
      reasonCodes: blocked.reasonCodes
    }));
  }
  for (const result of evaluation.results) {
    const claimIds = [...new Set([...(result.projectClaimIds || []), ...(result.capabilityClaimIds || [])])].sort(compareAscii);
    const requirementIds = result.requirementResults.map((item) => item.requirementId).sort(compareAscii);
    const reasonCodes = [...new Set(result.reasons.map((reason) => reason.code))].sort(compareAscii);
    rawEvents.push(derivedEvent({
      eventType: 'SPECIFICATION_FIT_EVALUATED', opportunityId: opportunity.opportunityId, asOf: registry.asOf,
      title: `${result.productFamilyId} specification fit evaluated`,
      summary: `Recomputed fit result: ${result.result}. This is a derived conclusion, not source evidence.`,
      claimIds, requirementIds, productFamilyIds: [result.productFamilyId], reasonCodes,
      state: { dimension: 'FIT_RESULT', before: null, after: result.result }
    }));
    rawEvents.push(derivedEvent({
      eventType: 'SPECIFICATION_WINDOW_EVALUATED', opportunityId: opportunity.opportunityId, asOf: registry.asOf,
      title: `${result.productFamilyId} specification window evaluated`,
      summary: `Recomputed specification window: ${result.window.state}. This is a derived conclusion, not source evidence.`,
      claimIds: result.window.stageClaimIds, productFamilyIds: [result.productFamilyId], reasonCodes: result.window.reasonCodes,
      state: { dimension: 'SPECIFICATION_WINDOW', before: null, after: result.window.state }
    }));
  }
  rawEvents.push(derivedEvent({
    eventType: 'DOSSIER_RECOMPUTED', opportunityId: opportunity.opportunityId, asOf: registry.asOf,
    title: 'Pursuit dossier recomputed',
    summary: `The synthetic pursuit dossier was recomputed with deterministic hash ${hashes.jsonSha256.slice(0, 12)}.`,
    productFamilyIds: opportunity.candidateProductFamilyIds
  }));
  const timeline = createValidatedProjectSignalTimeline({
    schemaVersion: TIMELINE_SCHEMA_VERSION,
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    productionReady: false,
    issue165Status: 'HOLD',
    synthetic: true,
    opportunityId: opportunity.opportunityId,
    asOf: registry.asOf,
    sourceHashes: {
      opportunitySha256: sha256(opportunity),
      evaluationSha256: sha256(evaluation),
      dossierJsonSha256: hashes.jsonSha256
    },
    events: rawEvents
  }, { registry, opportunity, verticalPack });
  return { timeline, timelineSha256: sha256(timeline), dossier, dossierHashes: hashes };
}
