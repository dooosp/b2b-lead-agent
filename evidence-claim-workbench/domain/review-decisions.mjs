import {
  assertSafeArtifact,
  canonicalStringify,
  sha256
} from '../../knowledge/claim-registry/index.mjs';
import {
  CandidateValidationError,
  CONDITION_IDS,
  PROJECT_STAGES,
  SUPPORTED_CLAIM_TYPES,
  WORKBENCH_DOMAIN,
  WORKBENCH_JURISDICTION,
  WORKBENCH_VERTICAL,
  normalizeCandidateValue,
  validateCandidate
} from './candidates.mjs';

export const REVIEW_DECISION_SCHEMA_VERSION = 'evidence-claim-review-decision-v0';
export const REVIEW_DECISIONS = Object.freeze([
  'APPROVE_FOR_REPOSITORY_REVIEW',
  'REJECT',
  'DEFER_MISSING_CONTEXT',
  'FLAG_CONFLICT',
  'FLAG_SUPERSEDED',
  'FLAG_SOURCE_AUTHENTICITY'
]);

export const REVIEW_REASON_CODES = Object.freeze([
  'EVIDENCE_QUOTE_CONFIRMED',
  'STRUCTURED_MEANING_CONFIRMED',
  'CONDITIONS_CONFIRMED',
  'NOT_A_CAPABILITY',
  'MARKETING_LANGUAGE_ONLY',
  'VALUE_MISSING',
  'UNIT_AMBIGUOUS',
  'PRODUCT_SCOPE_AMBIGUOUS',
  'CONDITION_MISSING',
  'REVISION_UNCLEAR',
  'DUPLICATE_CANDIDATE',
  'SUPERSEDED_DOCUMENT',
  'CONFLICTING_DOCUMENT',
  'COPYRIGHT_OR_USE_RESTRICTED',
  'SOURCE_AUTHENTICITY_UNCLEAR'
]);

const COMPATIBLE_REASON_CODES = Object.freeze({
  APPROVE_FOR_REPOSITORY_REVIEW: Object.freeze([
    'EVIDENCE_QUOTE_CONFIRMED',
    'STRUCTURED_MEANING_CONFIRMED',
    'CONDITIONS_CONFIRMED'
  ]),
  REJECT: Object.freeze([
    'NOT_A_CAPABILITY',
    'MARKETING_LANGUAGE_ONLY',
    'DUPLICATE_CANDIDATE',
    'COPYRIGHT_OR_USE_RESTRICTED'
  ]),
  DEFER_MISSING_CONTEXT: Object.freeze([
    'VALUE_MISSING',
    'UNIT_AMBIGUOUS',
    'PRODUCT_SCOPE_AMBIGUOUS',
    'CONDITION_MISSING',
    'REVISION_UNCLEAR',
    'COPYRIGHT_OR_USE_RESTRICTED'
  ]),
  FLAG_CONFLICT: Object.freeze(['CONFLICTING_DOCUMENT']),
  FLAG_SUPERSEDED: Object.freeze(['SUPERSEDED_DOCUMENT']),
  FLAG_SOURCE_AUTHENTICITY: Object.freeze(['SOURCE_AUTHENTICITY_UNCLEAR'])
});

export { COMPATIBLE_REASON_CODES };

const OUTPUT_KEYS = new Set([
  'schemaVersion',
  'decisionId',
  'candidateId',
  'documentId',
  'evidenceAnchorId',
  'decision',
  'reasonCodes',
  'relatedCandidateIds',
  'candidateSnapshot',
  'acknowledgements',
  'reviewerIdentity',
  'reviewerLabel'
]);
const SAFE_ID = /^[a-z0-9][a-z0-9._:-]{0,127}$/;

export class ReviewDecisionValidationError extends Error {
  constructor(code, path = '$') {
    super(`${code} at ${path}`);
    this.name = 'ReviewDecisionValidationError';
    this.code = code;
    this.path = path;
  }
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function compareAscii(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assertExactKeys(value, allowed, path) {
  if (!isPlainObject(value)) throw new ReviewDecisionValidationError('OBJECT_REQUIRED', path);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new ReviewDecisionValidationError('UNKNOWN_FIELD_REFUSED', `${path}.${key}`);
  }
}

function normalizeId(value, path) {
  if (typeof value !== 'string' || !SAFE_ID.test(value)) throw new ReviewDecisionValidationError('INVALID_ID', path);
  return value;
}

function normalizeStringSet(values, path, { allowed, nonempty = false } = {}) {
  if (!Array.isArray(values)) throw new ReviewDecisionValidationError('ARRAY_REQUIRED', path);
  const normalized = [...new Set(values)].sort(compareAscii);
  if (normalized.some((value) => typeof value !== 'string' || !value)) {
    throw new ReviewDecisionValidationError('NONEMPTY_STRING_REQUIRED', path);
  }
  if (allowed && normalized.some((value) => !allowed.includes(value))) {
    throw new ReviewDecisionValidationError('UNSUPPORTED_SET_VALUE', path);
  }
  if (nonempty && normalized.length === 0) throw new ReviewDecisionValidationError('NONEMPTY_ARRAY_REQUIRED', path);
  return normalized;
}

function normalizeSnapshot(snapshot, path = '$.candidateSnapshot') {
  assertExactKeys(snapshot, new Set(['claimType', 'productFamily', 'capabilityKey', 'value', 'applicability', 'validity']), path);
  if (!SUPPORTED_CLAIM_TYPES.includes(snapshot.claimType)) throw new ReviewDecisionValidationError('UNSUPPORTED_CLAIM_TYPE', `${path}.claimType`);
  if (!isPlainObject(snapshot.applicability)) throw new ReviewDecisionValidationError('INVALID_APPLICABILITY', `${path}.applicability`);
  assertExactKeys(snapshot.applicability, new Set(['vertical', 'domain', 'productFamily', 'jurisdiction', 'projectStages', 'conditions']), `${path}.applicability`);
  if (snapshot.applicability.vertical !== WORKBENCH_VERTICAL) throw new ReviewDecisionValidationError('VERTICAL_OUT_OF_SCOPE', `${path}.applicability.vertical`);
  if (snapshot.applicability.domain !== WORKBENCH_DOMAIN) throw new ReviewDecisionValidationError('DOMAIN_OUT_OF_SCOPE', `${path}.applicability.domain`);
  if (snapshot.applicability.productFamily !== snapshot.productFamily) throw new ReviewDecisionValidationError('PRODUCT_FAMILY_MISMATCH', `${path}.applicability.productFamily`);
  if (snapshot.applicability.jurisdiction !== WORKBENCH_JURISDICTION) throw new ReviewDecisionValidationError('JURISDICTION_OUT_OF_SCOPE', `${path}.applicability.jurisdiction`);
  const projectStages = normalizeStringSet(snapshot.applicability.projectStages, `${path}.applicability.projectStages`, { allowed: PROJECT_STAGES, nonempty: true });
  if (!Array.isArray(snapshot.applicability.conditions)) throw new ReviewDecisionValidationError('ARRAY_REQUIRED', `${path}.applicability.conditions`);
  const conditions = snapshot.applicability.conditions.map((condition, index) => {
    assertExactKeys(condition, new Set(['id', 'value']), `${path}.applicability.conditions[${index}]`);
    if (typeof condition.id !== 'string' || !condition.id || typeof condition.value !== 'string' || !condition.value) {
      throw new ReviewDecisionValidationError('INVALID_CONDITION', `${path}.applicability.conditions[${index}]`);
    }
    if (!CONDITION_IDS.includes(condition.id)) throw new ReviewDecisionValidationError('UNSUPPORTED_CONDITION_ID', `${path}.applicability.conditions[${index}].id`);
    return { id: condition.id, value: condition.value };
  }).sort((left, right) => compareAscii(`${left.id}\0${left.value}`, `${right.id}\0${right.value}`));
  if (new Set(conditions.map((condition) => condition.id)).size !== conditions.length) {
    throw new ReviewDecisionValidationError('DUPLICATE_CONDITION_ID', `${path}.applicability.conditions`);
  }
  let value;
  try {
    value = normalizeCandidateValue(snapshot.value, snapshot.productFamily, `${path}.value`);
  } catch (error) {
    if (error instanceof CandidateValidationError) {
      throw new ReviewDecisionValidationError(error.code, error.path);
    }
    throw error;
  }
  if (value.key !== snapshot.capabilityKey) throw new ReviewDecisionValidationError('CAPABILITY_KEY_MISMATCH', `${path}.capabilityKey`);
  const validUntilIsExactIso = typeof snapshot.validity?.validUntil === 'string'
    && Number.isFinite(new Date(snapshot.validity.validUntil).getTime())
    && new Date(snapshot.validity.validUntil).toISOString() === snapshot.validity.validUntil;
  if (!isPlainObject(snapshot.validity)
    || !['NOT_STATED', 'VALID_UNTIL'].includes(snapshot.validity.type)
    || (snapshot.validity.type === 'NOT_STATED' && snapshot.validity.validUntil !== null)
    || (snapshot.validity.type === 'VALID_UNTIL' && !validUntilIsExactIso)) {
    throw new ReviewDecisionValidationError('INVALID_VALIDITY', `${path}.validity`);
  }
  return {
    claimType: snapshot.claimType,
    productFamily: snapshot.productFamily,
    capabilityKey: snapshot.capabilityKey,
    value,
    applicability: {
      vertical: WORKBENCH_VERTICAL,
      domain: WORKBENCH_DOMAIN,
      productFamily: snapshot.productFamily,
      jurisdiction: WORKBENCH_JURISDICTION,
      projectStages,
      conditions
    },
    validity: { type: snapshot.validity.type, validUntil: snapshot.validity.validUntil }
  };
}

function assertReasonCompatibility(decision, reasonCodes, relatedCandidateIds, snapshot) {
  const compatible = COMPATIBLE_REASON_CODES[decision];
  if (reasonCodes.some((reasonCode) => !compatible.includes(reasonCode))) {
    throw new ReviewDecisionValidationError('REASON_DECISION_INCOMPATIBLE', '$.reasonCodes');
  }
  if (decision === 'APPROVE_FOR_REPOSITORY_REVIEW') {
    for (const required of ['EVIDENCE_QUOTE_CONFIRMED', 'STRUCTURED_MEANING_CONFIRMED']) {
      if (!reasonCodes.includes(required)) throw new ReviewDecisionValidationError('APPROVAL_ACKNOWLEDGEMENT_REASON_REQUIRED', '$.reasonCodes');
    }
    if (snapshot.applicability.conditions.length > 0 && !reasonCodes.includes('CONDITIONS_CONFIRMED')) {
      throw new ReviewDecisionValidationError('CONDITIONS_CONFIRMATION_REQUIRED', '$.reasonCodes');
    }
    if (relatedCandidateIds.length > 0) throw new ReviewDecisionValidationError('APPROVAL_RELATION_LINK_REFUSED', '$.relatedCandidateIds');
  } else if (reasonCodes.length === 0) {
    throw new ReviewDecisionValidationError('DECISION_REASON_REQUIRED', '$.reasonCodes');
  }
  if (['FLAG_CONFLICT', 'FLAG_SUPERSEDED'].includes(decision) && relatedCandidateIds.length === 0) {
    throw new ReviewDecisionValidationError('RELATED_CANDIDATE_REQUIRED', '$.relatedCandidateIds');
  }
}

function decisionIdentityPayload(decision) {
  return {
    schemaVersion: decision.schemaVersion,
    candidateId: decision.candidateId,
    documentId: decision.documentId,
    evidenceAnchorId: decision.evidenceAnchorId,
    decision: decision.decision,
    reasonCodes: decision.reasonCodes,
    relatedCandidateIds: decision.relatedCandidateIds,
    candidateSnapshot: decision.candidateSnapshot,
    acknowledgements: decision.acknowledgements
  };
}

export function computeReviewDecisionId(decision) {
  return `dec_${sha256(decisionIdentityPayload(decision))}`;
}

function normalizeDecision(rawDecision) {
  if (!isPlainObject(rawDecision)) throw new ReviewDecisionValidationError('DECISION_OBJECT_REQUIRED');
  assertSafeArtifact(rawDecision);
  assertExactKeys(rawDecision, OUTPUT_KEYS, '$');
  if (rawDecision.schemaVersion !== REVIEW_DECISION_SCHEMA_VERSION) throw new ReviewDecisionValidationError('UNSUPPORTED_DECISION_SCHEMA', '$.schemaVersion');
  if (!REVIEW_DECISIONS.includes(rawDecision.decision)) throw new ReviewDecisionValidationError('UNSUPPORTED_DECISION', '$.decision');
  const candidateId = normalizeId(rawDecision.candidateId, '$.candidateId');
  const relatedCandidateIds = normalizeStringSet(rawDecision.relatedCandidateIds, '$.relatedCandidateIds');
  if (relatedCandidateIds.includes(candidateId)) throw new ReviewDecisionValidationError('SELF_RELATION_REFUSED', '$.relatedCandidateIds');
  const reasonCodes = normalizeStringSet(rawDecision.reasonCodes, '$.reasonCodes', { allowed: REVIEW_REASON_CODES });
  const candidateSnapshot = normalizeSnapshot(rawDecision.candidateSnapshot);
  assertReasonCompatibility(rawDecision.decision, reasonCodes, relatedCandidateIds, candidateSnapshot);
  assertExactKeys(rawDecision.acknowledgements, new Set(['notVerified', 'repositoryReviewRequired', 'customerUseNotAllowed']), '$.acknowledgements');
  if (rawDecision.acknowledgements.notVerified !== true
    || rawDecision.acknowledgements.repositoryReviewRequired !== true
    || rawDecision.acknowledgements.customerUseNotAllowed !== true) {
    throw new ReviewDecisionValidationError('ACKNOWLEDGEMENTS_REQUIRED', '$.acknowledgements');
  }
  if (rawDecision.reviewerIdentity !== 'NOT_COLLECTED' || rawDecision.reviewerLabel !== 'repository_reviewer_pending') {
    throw new ReviewDecisionValidationError('REVIEWER_IDENTITY_REFUSED', '$.reviewerIdentity');
  }
  const normalized = {
    schemaVersion: REVIEW_DECISION_SCHEMA_VERSION,
    candidateId,
    documentId: normalizeId(rawDecision.documentId, '$.documentId'),
    evidenceAnchorId: normalizeId(rawDecision.evidenceAnchorId, '$.evidenceAnchorId'),
    decision: rawDecision.decision,
    reasonCodes: [...new Set(reasonCodes)].sort(compareAscii),
    relatedCandidateIds: [...new Set(relatedCandidateIds)].sort(compareAscii),
    candidateSnapshot,
    acknowledgements: {
      notVerified: true,
      repositoryReviewRequired: true,
      customerUseNotAllowed: true
    },
    reviewerIdentity: 'NOT_COLLECTED',
    reviewerLabel: 'repository_reviewer_pending'
  };
  const decisionId = computeReviewDecisionId(normalized);
  if (rawDecision.decisionId !== decisionId) throw new ReviewDecisionValidationError('DECISION_ID_MISMATCH', '$.decisionId');
  return Object.freeze({ schemaVersion: REVIEW_DECISION_SCHEMA_VERSION, decisionId, ...Object.fromEntries(Object.entries(normalized).filter(([key]) => key !== 'schemaVersion')) });
}

export function validateReviewDecision(decision) {
  return normalizeDecision(decision);
}

export function createReviewDecision(input, { inject = {} } = {}) {
  assertExactKeys(input, new Set(['candidate', 'decision', 'reasonCodes', 'relatedCandidateIds']), '$.reviewDecisionInput');
  const {
    candidate: rawCandidate,
    decision,
    reasonCodes = [],
    relatedCandidateIds = []
  } = input;
  inject.beforeReviewDecision?.({ candidate: rawCandidate, decision, reasonCodes, relatedCandidateIds });
  const candidate = validateCandidate(rawCandidate);
  const raw = {
    schemaVersion: REVIEW_DECISION_SCHEMA_VERSION,
    candidateId: candidate.candidateId,
    documentId: candidate.documentId,
    evidenceAnchorId: candidate.evidenceAnchorId,
    decision,
    reasonCodes: [...new Set(reasonCodes)].sort(compareAscii),
    relatedCandidateIds: [...new Set(relatedCandidateIds)].sort(compareAscii),
    candidateSnapshot: {
      claimType: candidate.claimType,
      productFamily: candidate.subject.id,
      capabilityKey: candidate.value.key,
      value: candidate.value,
      applicability: candidate.applicability,
      validity: candidate.validity
    },
    acknowledgements: {
      notVerified: true,
      repositoryReviewRequired: true,
      customerUseNotAllowed: true
    },
    reviewerIdentity: 'NOT_COLLECTED',
    reviewerLabel: 'repository_reviewer_pending'
  };
  raw.decisionId = computeReviewDecisionId(raw);
  const result = normalizeDecision(raw);
  inject.afterReviewDecision?.(result);
  return result;
}

export function decisionsEqual(left, right) {
  return canonicalStringify(validateReviewDecision(left)) === canonicalStringify(validateReviewDecision(right));
}
