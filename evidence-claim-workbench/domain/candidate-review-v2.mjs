import {
  assertSafeArtifact,
  canonicalStringify,
  sha256
} from '../../knowledge/claim-registry/index.mjs';
import {
  PRODUCT_FAMILIES,
  validateCandidate
} from './candidates.mjs';
import {
  createReviewDecision,
  validateReviewDecision
} from './review-decisions.mjs';
import {
  RELATIONSHIP_TYPES,
  analyzeCandidateRelationships
} from './relationships.mjs';
import { validateReviewPatch } from './review-patch.mjs';

export const CANDIDATE_REVIEW_PR_NUMBER = 207;
export const CANDIDATE_REVIEW_FROZEN_HEAD_SHA = 'c6a5469338999097acd5de7c5a12c827d27d4540';
export const CANDIDATE_REVIEW_BOUNDARY = 'NOT_PRODUCTION_EVIDENCE';
export const CANDIDATE_REVIEW_SYNTHETIC_PREREQUISITE_BYPASS = 'SYNTHETIC_FIXTURE_ONLY';
export const CANDIDATE_REVIEW_PREREQUISITE_SCHEMA_VERSION = 'pr207-candidate-review-prerequisites-v2';
export const CANDIDATE_REVIEW_COMPONENT_SCHEMA_VERSION = 'pr207-candidate-review-components-v2';
export const CANDIDATE_REVIEW_POPULATION_SCHEMA_VERSION = 'pr207-candidate-review-population-v2';
export const CANDIDATE_REVIEW_ROLE_SUBMISSION_SCHEMA_VERSION = 'pr207-candidate-review-role-submission-v2';
export const CANDIDATE_REVIEW_RECONCILIATION_SCHEMA_VERSION = 'pr207-candidate-review-reconciliation-v2';
export const CANDIDATE_REVIEW_METRICS_SCHEMA_VERSION = 'pr207-candidate-review-metrics-v2';
export const CANDIDATE_REVIEW_PATCH_SET_SCHEMA_VERSION = 'pr207-candidate-review-patch-set-v2';
export const CANDIDATE_REVIEW_PATCH_SHARD_SCHEMA_VERSION = 'pr207-candidate-review-patch-shard-v2';

export const CANDIDATE_REVIEW_ROLES = Object.freeze([
  'PRIMARY_TECHNICAL_REVIEWER',
  'SECONDARY_EVIDENCE_REVIEWER'
]);
export const CANDIDATE_REVIEW_DECISION_FORMS = Object.freeze([
  'INNER_DECISION',
  'OUTER_HOLD_TERMINOLOGY_GAP'
]);
export const CANDIDATE_REVIEW_LIMITATION_ACKNOWLEDGEMENTS = Object.freeze([
  'NOT_APPLICABLE',
  'LIMITATION_DOES_NOT_AFFECT_CANDIDATE',
  'NOT_ATTESTED'
]);
export const CANDIDATE_REVIEW_FINAL_OUTCOMES = Object.freeze([
  'APPROVED',
  'REJECTED',
  'HELD',
  'CONFLICTED'
]);
export const CANDIDATE_REVIEW_PATCH_SUITABILITY = Object.freeze([
  'SUITABLE_FOR_REPOSITORY_REVIEW',
  'NOT_SUITABLE_FOR_REPOSITORY_REVIEW',
  'HOLD_PATCH_REVIEW_INCOMPLETE',
  'NOT_APPLICABLE_NO_APPROVED_PATCH'
]);
export const CANDIDATE_REVIEW_FIDELITY_DECISIONS = Object.freeze([
  'ACCEPTABLE_FOR_CANDIDATE_REVIEW',
  'ACCEPTABLE_WITH_LIMITATIONS',
  'UNSAFE_FOR_CANDIDATE_REVIEW'
]);
export const CANDIDATE_REVIEW_SEMANTIC_FIELDS = Object.freeze([
  'value',
  'unit',
  'operator',
  'variant',
  'condition',
  'footnote',
  'locator'
]);

export const CANDIDATE_REVIEW_LIMITS = Object.freeze({
  minPopulationCandidates: 30,
  maxPopulationCandidates: 35,
  minPopulationCandidatesPerFamily: 10,
  requiredFidelityRows: 8,
  maxRoleRows: 70,
  minReviewDurationSeconds: 1,
  maxReviewDurationSeconds: 7_200,
  minUsefulness: 1,
  maxUsefulness: 5,
  maxExcerptCodePoints: 500,
  maxShardExcerptCodePoints: 1_500,
  maxShardSerializedBytes: 128 * 1024,
  maxApprovedCandidatesPerShard: 100,
  maxPackageSerializedBytes: 1024 * 1024
});

const SHA256_HEX = /^[a-f0-9]{64}$/;
const COMMIT_SHA = /^[a-f0-9]{40}$/;
const ROUND_ID = /^round_[a-f0-9]{64}$/;
const CANDIDATE_ID = /^cand_[a-f0-9]{64}$/;
const RELATIONSHIP_ID = /^rel_[a-f0-9]{64}$/;
const SAFE_REGISTRY_PATH = /^knowledge\/claim-registry\/[a-z0-9][a-z0-9._/-]*\.json$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const ABSOLUTE_LOCAL_PATH = /(?:\bfile:(?:\/{1,3}|\\+)|(?:^|[\s"'(=:\[\{])(?:\/(?!\/)|[A-Za-z]:[\\/]|\\\\)|(?:^|[\s"'(=\[\{])\/\/[^/\s])/iu;
const PRIVATE_TEXT = /(?:\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|(?:\+?82[- .]?)?0\d{1,2}[- .]\d{3,4}[- .]\d{4})/iu;
const SECRET_TEXT = /(?:bearer\s+[a-z0-9._~+\/-]{16,}|gh[oprsu]_[a-z0-9]{20,}|sk-[a-z0-9_-]{20,}|AIza[a-z0-9_-]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:password|passwd|token|api[_-]?key|secret)\s*[:=]\s*[^\s]{8,})/iu;
const PROTECTED_KEY = /^(?:pageText|pages|sourceBinary|binary|buffer|bytes|filePath|absolutePath|localPath|reviewerName|reviewerEmail|reviewerUserId|userId|recipient|freeform|notes?|customerData|privateData|token|cookie|password|secret|sourceUrl|publisherExcerpt|fullPage|screenshot|ocr)$/i;
const FALSE_POSITIVE_REASONS = Object.freeze([
  'NOT_A_CAPABILITY',
  'MARKETING_LANGUAGE_ONLY',
  'DUPLICATE_CANDIDATE'
]);
const BOUNDARY_KEYS = Object.freeze([
  'boundary',
  'productionReady',
  'productionReviewerWorkflowReady',
  'repositoryReviewRequired',
  'automaticVerification',
  'customerUseAllowed',
  'proofExecutionApproved'
]);
const BOUNDARY = Object.freeze({
  boundary: CANDIDATE_REVIEW_BOUNDARY,
  productionReady: false,
  productionReviewerWorkflowReady: false,
  repositoryReviewRequired: true,
  automaticVerification: false,
  customerUseAllowed: false,
  proofExecutionApproved: false
});

export class CandidateReviewV2ValidationError extends Error {
  constructor(code, path = '$') {
    super(`${code} at ${path}`);
    this.name = 'CandidateReviewV2ValidationError';
    this.code = code;
    this.path = path;
  }
}

function fail(code, path = '$') {
  throw new CandidateReviewV2ValidationError(code, path);
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function compareAscii(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareAsciiVectors(left, right) {
  const count = Math.min(left.length, right.length);
  for (let index = 0; index < count; index += 1) {
    const comparison = compareAscii(left[index], right[index]);
    if (comparison !== 0) return comparison;
  }
  return left.length - right.length;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function cloneFrozen(value) {
  return deepFreeze(structuredClone(value));
}

function assertExactKeys(value, { required = [], optional = [] } = {}, path = '$') {
  if (!isPlainObject(value)) fail('OBJECT_REQUIRED', path);
  const permitted = new Set([...required, ...optional]);
  for (const key of Object.keys(value)) {
    if (key === '__proto__' || key === 'prototype' || key === 'constructor') {
      fail('PROTOTYPE_KEY_REFUSED', `${path}.${key}`);
    }
    if (!permitted.has(key)) fail('UNEXPECTED_FIELD', `${path}.${key}`);
  }
  for (const key of required) {
    if (!Object.hasOwn(value, key)) fail('REQUIRED_FIELD_MISSING', `${path}.${key}`);
  }
}

function assertBoundary(value, path = '$') {
  for (const key of BOUNDARY_KEYS) {
    if (value[key] !== BOUNDARY[key]) fail('NON_AUTHORITY_BOUNDARY_REQUIRED', `${path}.${key}`);
  }
}

function assertReviewSafe(value, path = '$', depth = 0) {
  if (depth > 18) fail('MAX_DEPTH_EXCEEDED', path);
  if (typeof value === 'string') {
    if (value.length > 12_000) fail('STRING_TOO_LONG', path);
    const representations = [];
    let representation = value;
    for (let decodeDepth = 0; ; decodeDepth += 1) {
      for (const form of [representation, representation.normalize('NFKC')]) {
        if (!representations.includes(form)) representations.push(form);
      }
      if (!/%[0-9a-f]{2}/iu.test(representation)) break;
      if (decodeDepth === 4) fail('PERCENT_ENCODING_DEPTH_REFUSED', path);
      try {
        const decoded = decodeURIComponent(representation);
        if (decoded === representation) break;
        representation = decoded;
      } catch {
        fail('MALFORMED_PERCENT_ENCODING_REFUSED', path);
      }
    }
    if (representations.some((item) => ABSOLUTE_LOCAL_PATH.test(item))) {
      fail('LOCAL_ABSOLUTE_PATH_REFUSED', path);
    }
    if (representations.some((item) => PRIVATE_TEXT.test(item))) {
      fail('IDENTITY_OR_PRIVATE_TEXT_REFUSED', path);
    }
    if (representations.some((item) => SECRET_TEXT.test(item))) {
      fail('SECRET_SHAPED_VALUE_REFUSED', path);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertReviewSafe(item, `${path}[${index}]`, depth + 1));
    return;
  }
  if (value && typeof value === 'object') {
    if (!isPlainObject(value)) fail('NON_PLAIN_OBJECT', path);
    for (const [key, child] of Object.entries(value)) {
      if (PROTECTED_KEY.test(key)) fail('PROTECTED_FIELD_REFUSED', `${path}.${key}`);
      assertReviewSafe(child, `${path}.${key}`, depth + 1);
    }
  }
}

function assertSafeInput(value, path = '$') {
  try {
    assertSafeArtifact(value, path);
  } catch (error) {
    fail(error?.code || 'UNSAFE_ARTIFACT_REFUSED', error?.path || path);
  }
  assertReviewSafe(value, path);
}

function assertSha256(value, path) {
  if (typeof value !== 'string' || !SHA256_HEX.test(value)) fail('SHA256_REQUIRED', path);
  return value;
}

function assertCommitSha(value, path) {
  if (typeof value !== 'string' || !COMMIT_SHA.test(value)) fail('COMMIT_SHA_REQUIRED', path);
  return value;
}

function assertRoundId(value, path = '$.roundId') {
  if (typeof value !== 'string' || !ROUND_ID.test(value)) fail('ROUND_ID_REQUIRED', path);
  return value;
}

function assertIntegerInRange(value, minimum, maximum, path, code = 'BOUNDED_INTEGER_REQUIRED') {
  if (!Number.isInteger(value) || value < minimum || value > maximum) fail(code, path);
  return value;
}

function normalizeSortedUnique(values, path, {
  pattern,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  code = 'INVALID_SORTED_SET'
} = {}) {
  if (!Array.isArray(values) || values.length < min || values.length > max) fail(code, path);
  const normalized = [...new Set(values.map((value, index) => {
    if (typeof value !== 'string' || (pattern && !pattern.test(value))) fail(code, `${path}[${index}]`);
    return value;
  }))].sort(compareAscii);
  if (normalized.length !== values.length) fail('DUPLICATE_SET_VALUE', path);
  return normalized;
}

function normalizePageNumberSet(values, path, { min = 0 } = {}) {
  if (!Array.isArray(values) || values.length < min || values.length > 100) {
    fail('INVALID_PAGE_NUMBER_SET', path);
  }
  const normalized = [...new Set(values.map((value, index) => {
    if (!Number.isInteger(value) || value < 1 || value > 100) {
      fail('INVALID_PAGE_NUMBER_SET', `${path}[${index}]`);
    }
    return value;
  }))].sort((left, right) => left - right);
  if (normalized.length !== values.length) fail('DUPLICATE_SET_VALUE', path);
  return normalized;
}

function expectedCandidateSnapshot(candidate) {
  return {
    claimType: candidate.claimType,
    productFamily: candidate.subject.id,
    capabilityKey: candidate.value.key,
    value: candidate.value,
    applicability: candidate.applicability,
    validity: candidate.validity
  };
}

function normalizeCandidates(rawCandidates, path = '$.candidates') {
  if (!Array.isArray(rawCandidates)) fail('CANDIDATE_ARRAY_REQUIRED', path);
  if (rawCandidates.length === 0 || rawCandidates.length > 1_000) fail('CANDIDATE_COUNT_OUT_OF_RANGE', path);
  const byId = new Map();
  for (const [index, rawCandidate] of rawCandidates.entries()) {
    let candidate;
    try {
      candidate = validateCandidate(rawCandidate);
    } catch (error) {
      fail(error?.code || 'INVALID_CANDIDATE', `${path}[${index}]${error?.path ? `:${error.path}` : ''}`);
    }
    if (byId.has(candidate.candidateId)) fail('DUPLICATE_CANDIDATE_ID', `${path}[${index}].candidateId`);
    byId.set(candidate.candidateId, candidate);
  }
  return [...byId.values()].sort((left, right) => compareAscii(left.candidateId, right.candidateId));
}

function relationshipSignature(relationship) {
  return canonicalStringify({
    type: relationship.type,
    candidateIds: relationship.candidateIds,
    ...(relationship.type === 'SUPERSEDES' ? {
      supersededCandidateId: relationship.supersededCandidateId,
      successorCandidateId: relationship.successorCandidateId
    } : {})
  });
}

function normalizeDeclaredRelationships(rawRelationships, candidates, path = '$.relationships') {
  const computedReport = analyzeCandidateRelationships(candidates);
  if (rawRelationships === undefined) {
    return computedReport.relationships.map((relationship) => ({
      relationshipId: relationship.relationshipId,
      type: relationship.type,
      candidateIds: relationship.candidateIds,
      ...(relationship.type === 'SUPERSEDES' ? {
        supersededCandidateId: relationship.supersededCandidateId,
        successorCandidateId: relationship.successorCandidateId
      } : {})
    }));
  }
  const source = Array.isArray(rawRelationships)
    ? rawRelationships
    : isPlainObject(rawRelationships) && Array.isArray(rawRelationships.relationships)
      ? rawRelationships.relationships
      : null;
  if (!source) fail('RELATIONSHIP_ARRAY_OR_REPORT_REQUIRED', path);
  const candidateIds = new Set(candidates.map((candidate) => candidate.candidateId));
  const byId = new Map();
  const normalized = source.map((rawRelationship, index) => {
    const itemPath = `${path}[${index}]`;
    assertExactKeys(rawRelationship, {
      required: ['relationshipId', 'type', 'candidateIds'],
      optional: [
        'schemaVersion', 'documentIds', 'blocking', 'requiresHumanDisposition',
        'reasonCodes', 'supersededCandidateId', 'successorCandidateId'
      ]
    }, itemPath);
    if (typeof rawRelationship.relationshipId !== 'string' || !RELATIONSHIP_ID.test(rawRelationship.relationshipId)) {
      fail('INVALID_RELATIONSHIP_ID', `${itemPath}.relationshipId`);
    }
    if (!RELATIONSHIP_TYPES.includes(rawRelationship.type)) fail('UNSUPPORTED_RELATIONSHIP_TYPE', `${itemPath}.type`);
    const members = normalizeSortedUnique(rawRelationship.candidateIds, `${itemPath}.candidateIds`, {
      pattern: CANDIDATE_ID,
      min: 2,
      max: CANDIDATE_REVIEW_LIMITS.maxPopulationCandidates,
      code: 'INVALID_RELATIONSHIP_MEMBERS'
    });
    for (const member of members) {
      if (!candidateIds.has(member)) fail('DANGLING_RELATIONSHIP_ENDPOINT', `${itemPath}.candidateIds`);
    }
    const result = {
      relationshipId: rawRelationship.relationshipId,
      type: rawRelationship.type,
      candidateIds: members
    };
    if (rawRelationship.type === 'SUPERSEDES') {
      if (!members.includes(rawRelationship.supersededCandidateId)
        || !members.includes(rawRelationship.successorCandidateId)
        || rawRelationship.supersededCandidateId === rawRelationship.successorCandidateId) {
        fail('INVALID_SUPERSESSION_ENDPOINTS', itemPath);
      }
      result.supersededCandidateId = rawRelationship.supersededCandidateId;
      result.successorCandidateId = rawRelationship.successorCandidateId;
    } else if (rawRelationship.supersededCandidateId !== undefined
      || rawRelationship.successorCandidateId !== undefined) {
      fail('UNEXPECTED_SUPERSESSION_ENDPOINT', itemPath);
    }
    if (byId.has(result.relationshipId)) fail('DUPLICATE_RELATIONSHIP_ID', `${itemPath}.relationshipId`);
    byId.set(result.relationshipId, result);
    return result;
  }).sort((left, right) => compareAscii(left.relationshipId, right.relationshipId));

  // An explicit report may have been authoritatively derived with validated
  // revision documents. Recomputing it here without those documents can turn a
  // real SUPERSEDES edge into a document-free MATERIAL_CONFLICT. Treat the
  // supplied, endpoint-complete report as the declared graph; the omitted-input
  // path above remains the deterministic document-free analyzer path.
  return normalized;
}

function componentIdFor(candidateIds, relationshipIds) {
  return `component_${sha256({ candidateIds, relationshipIds })}`;
}

export function buildCandidateReviewComponents({ candidates: rawCandidates, relationships } = {}) {
  assertExactKeys(arguments[0] ?? {}, {
    required: ['candidates'],
    optional: ['relationships']
  }, '$');
  assertSafeInput(arguments[0], '$');
  const candidates = normalizeCandidates(rawCandidates);
  const candidateById = new Map(candidates.map((candidate) => [candidate.candidateId, candidate]));
  const normalizedRelationships = normalizeDeclaredRelationships(relationships, candidates);
  const parent = new Map(candidates.map((candidate) => [candidate.candidateId, candidate.candidateId]));

  const find = (candidateId) => {
    let root = candidateId;
    while (parent.get(root) !== root) root = parent.get(root);
    let cursor = candidateId;
    while (parent.get(cursor) !== cursor) {
      const next = parent.get(cursor);
      parent.set(cursor, root);
      cursor = next;
    }
    return root;
  };
  const union = (left, right) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot === rightRoot) return;
    const [first, second] = [leftRoot, rightRoot].sort(compareAscii);
    parent.set(second, first);
  };
  for (const relationship of normalizedRelationships) {
    for (let index = 1; index < relationship.candidateIds.length; index += 1) {
      union(relationship.candidateIds[0], relationship.candidateIds[index]);
    }
  }

  const memberGroups = new Map();
  for (const candidate of candidates) {
    const root = find(candidate.candidateId);
    if (!memberGroups.has(root)) memberGroups.set(root, []);
    memberGroups.get(root).push(candidate.candidateId);
  }
  const components = [...memberGroups.values()].map((members) => {
    const candidateIds = members.sort(compareAscii);
    const memberSet = new Set(candidateIds);
    const relationshipIds = normalizedRelationships
      .filter((relationship) => relationship.candidateIds.some((candidateId) => memberSet.has(candidateId)))
      .map((relationship) => relationship.relationshipId)
      .sort(compareAscii);
    for (const relationship of normalizedRelationships.filter((item) => relationshipIds.includes(item.relationshipId))) {
      if (relationship.candidateIds.some((candidateId) => !memberSet.has(candidateId))) {
        fail('SPLIT_RELATIONSHIP_COMPONENT', `$.relationships.${relationship.relationshipId}`);
      }
    }
    const productFamilyCounts = Object.fromEntries(PRODUCT_FAMILIES.map((family) => [
      family,
      candidateIds.filter((candidateId) => candidateById.get(candidateId).subject.id === family).length
    ]));
    const componentKey = candidateIds[0];
    return {
      componentId: componentIdFor(candidateIds, relationshipIds),
      componentKey,
      candidateIds,
      relationshipIds,
      candidateCount: candidateIds.length,
      productFamilyCounts
    };
  }).sort((left, right) => compareAscii(left.componentKey, right.componentKey));

  const base = {
    schemaVersion: CANDIDATE_REVIEW_COMPONENT_SCHEMA_VERSION,
    ...BOUNDARY,
    candidateCount: candidates.length,
    relationshipCount: normalizedRelationships.length,
    relationshipReportHash: sha256(normalizedRelationships),
    components
  };
  return cloneFrozen({
    ...base,
    componentSetHash: sha256(base)
  });
}

function validateFidelityRow(rawRow, index) {
  const path = `$.fidelityRows[${index}]`;
  assertExactKeys(rawRow, {
    required: [
      'documentId',
      'documentIdentityCheck',
      'documentNumberCheck',
      'revisionCheck',
      'candidateBearingPagesChecked',
      'eligiblePageNumbers',
      'fidelityDecision',
      'semanticPreservation'
    ]
  }, path);
  if (typeof rawRow.documentId !== 'string' || !/^doc_[a-f0-9]{64}$/.test(rawRow.documentId)) {
    fail('INVALID_FIDELITY_DOCUMENT_ID', `${path}.documentId`);
  }
  for (const key of ['documentIdentityCheck', 'documentNumberCheck', 'revisionCheck']) {
    if (rawRow[key] !== 'MATCH') fail('FIDELITY_MATCH_REQUIRED', `${path}.${key}`);
  }
  const checked = normalizePageNumberSet(
    rawRow.candidateBearingPagesChecked,
    `${path}.candidateBearingPagesChecked`,
    { min: 1 }
  );
  const eligible = normalizePageNumberSet(rawRow.eligiblePageNumbers, `${path}.eligiblePageNumbers`);
  if (eligible.some((pageNumber) => !checked.includes(pageNumber))) fail('ELIGIBLE_PAGE_NOT_CHECKED', `${path}.eligiblePageNumbers`);
  if (!CANDIDATE_REVIEW_FIDELITY_DECISIONS.includes(rawRow.fidelityDecision)) {
    fail('UNSUPPORTED_FIDELITY_DECISION', `${path}.fidelityDecision`);
  }
  if (rawRow.fidelityDecision === 'UNSAFE_FOR_CANDIDATE_REVIEW' && eligible.length !== 0) {
    fail('UNSAFE_FIDELITY_ROW_HAS_ELIGIBLE_PAGE', `${path}.eligiblePageNumbers`);
  }
  assertExactKeys(rawRow.semanticPreservation, {
    required: CANDIDATE_REVIEW_SEMANTIC_FIELDS
  }, `${path}.semanticPreservation`);
  const semanticPreservation = {};
  for (const field of CANDIDATE_REVIEW_SEMANTIC_FIELDS) {
    if (!['PRESERVED', 'NOT_PRESERVED'].includes(rawRow.semanticPreservation[field])) {
      fail('INVALID_SEMANTIC_PRESERVATION', `${path}.semanticPreservation.${field}`);
    }
    semanticPreservation[field] = rawRow.semanticPreservation[field];
  }
  return {
    documentId: rawRow.documentId,
    documentIdentityCheck: 'MATCH',
    documentNumberCheck: 'MATCH',
    revisionCheck: 'MATCH',
    candidateBearingPagesChecked: checked,
    eligiblePageNumbers: eligible,
    fidelityDecision: rawRow.fidelityDecision,
    semanticPreservation
  };
}

export function validateCandidateReviewPrerequisites(rawPrerequisites) {
  assertSafeInput(rawPrerequisites, '$');
  assertExactKeys(rawPrerequisites, {
    required: [
      'schemaVersion',
      'evaluatedPrNumber',
      'evaluatedPrHeadSha',
      'manifestSha256',
      'documentDecisionSha256',
      'fidelityDecisionSha256',
      'policy',
      'evaluationDate',
      'fidelityRows'
    ],
    optional: [...BOUNDARY_KEYS, 'prerequisiteHash']
  }, '$');
  const hasBoundary = BOUNDARY_KEYS.some((key) => Object.hasOwn(rawPrerequisites, key));
  if (hasBoundary) assertBoundary(rawPrerequisites);
  if (rawPrerequisites.schemaVersion !== CANDIDATE_REVIEW_PREREQUISITE_SCHEMA_VERSION) {
    fail('UNSUPPORTED_PREREQUISITE_SCHEMA', '$.schemaVersion');
  }
  if (rawPrerequisites.evaluatedPrNumber !== CANDIDATE_REVIEW_PR_NUMBER) fail('PR_NUMBER_MISMATCH', '$.evaluatedPrNumber');
  if (rawPrerequisites.evaluatedPrHeadSha !== CANDIDATE_REVIEW_FROZEN_HEAD_SHA) fail('PR_HEAD_MISMATCH', '$.evaluatedPrHeadSha');
  assertSha256(rawPrerequisites.manifestSha256, '$.manifestSha256');
  assertSha256(rawPrerequisites.documentDecisionSha256, '$.documentDecisionSha256');
  assertSha256(rawPrerequisites.fidelityDecisionSha256, '$.fidelityDecisionSha256');
  if (typeof rawPrerequisites.evaluationDate !== 'string' || !ISO_DATE.test(rawPrerequisites.evaluationDate)) {
    fail('INVALID_EVALUATION_DATE', '$.evaluationDate');
  }
  const evaluationInstant = new Date(`${rawPrerequisites.evaluationDate}T00:00:00.000Z`);
  if (!Number.isFinite(evaluationInstant.getTime())) fail('INVALID_EVALUATION_DATE', '$.evaluationDate');
  assertExactKeys(rawPrerequisites.policy, {
    required: ['marker', 'active', 'expiresAt', 'retentionMethod']
  }, '$.policy');
  if (rawPrerequisites.policy.marker !== 'PR207_PAGE_REVIEW_RIGHTS_RETENTION_POLICY_V1'
    || rawPrerequisites.policy.active !== true
    || rawPrerequisites.policy.retentionMethod !== 'IGNORE_VERIFIED_LOCAL_LEDGER_PLUS_POLICY_BOUNDED_HASH_AGGREGATE') {
    fail('ACTIVE_OWNER_POLICY_REQUIRED', '$.policy');
  }
  if (typeof rawPrerequisites.policy.expiresAt !== 'string' || !ISO_TIMESTAMP.test(rawPrerequisites.policy.expiresAt)) {
    fail('INVALID_POLICY_EXPIRY', '$.policy.expiresAt');
  }
  const expiry = new Date(rawPrerequisites.policy.expiresAt);
  if (!Number.isFinite(expiry.getTime()) || expiry.toISOString() !== rawPrerequisites.policy.expiresAt) {
    fail('INVALID_POLICY_EXPIRY', '$.policy.expiresAt');
  }
  if (evaluationInstant.getTime() >= expiry.getTime()) fail('OWNER_POLICY_EXPIRED', '$.policy.expiresAt');
  if (!Array.isArray(rawPrerequisites.fidelityRows)
    || rawPrerequisites.fidelityRows.length !== CANDIDATE_REVIEW_LIMITS.requiredFidelityRows) {
    fail('EXACT_FIDELITY_ROW_COUNT_REQUIRED', '$.fidelityRows');
  }
  const rows = rawPrerequisites.fidelityRows.map(validateFidelityRow)
    .sort((left, right) => compareAscii(left.documentId, right.documentId));
  if (new Set(rows.map((row) => row.documentId)).size !== rows.length) fail('DUPLICATE_FIDELITY_DOCUMENT', '$.fidelityRows');
  const normalized = {
    schemaVersion: CANDIDATE_REVIEW_PREREQUISITE_SCHEMA_VERSION,
    ...BOUNDARY,
    evaluatedPrNumber: CANDIDATE_REVIEW_PR_NUMBER,
    evaluatedPrHeadSha: CANDIDATE_REVIEW_FROZEN_HEAD_SHA,
    manifestSha256: rawPrerequisites.manifestSha256,
    documentDecisionSha256: rawPrerequisites.documentDecisionSha256,
    fidelityDecisionSha256: rawPrerequisites.fidelityDecisionSha256,
    policy: {
      marker: rawPrerequisites.policy.marker,
      active: true,
      expiresAt: rawPrerequisites.policy.expiresAt,
      retentionMethod: rawPrerequisites.policy.retentionMethod
    },
    evaluationDate: rawPrerequisites.evaluationDate,
    fidelityRows: rows
  };
  const output = {
    ...normalized,
    prerequisiteHash: sha256(normalized)
  };
  if (rawPrerequisites.prerequisiteHash !== undefined
    && rawPrerequisites.prerequisiteHash !== output.prerequisiteHash) {
    fail('PREREQUISITE_HASH_MISMATCH', '$.prerequisiteHash');
  }
  return cloneFrozen(output);
}

function validateDocumentBinding(rawDocument, candidate, path) {
  assertExactKeys(rawDocument, {
    required: [
      'documentId',
      'sourceFileSha256',
      'normalizedContentSha256',
      'documentNumber',
      'revisionSeriesId',
      'revisionId',
      'revisionSequence'
    ]
  }, path);
  if (rawDocument.documentId !== candidate.documentId) fail('CANDIDATE_DOCUMENT_BINDING_MISMATCH', `${path}.documentId`);
  assertSha256(rawDocument.sourceFileSha256, `${path}.sourceFileSha256`);
  assertSha256(rawDocument.normalizedContentSha256, `${path}.normalizedContentSha256`);
  for (const key of ['documentNumber', 'revisionSeriesId', 'revisionId']) {
    if (typeof rawDocument[key] !== 'string' || rawDocument[key].length < 1 || rawDocument[key].length > 120) {
      fail('INVALID_DOCUMENT_BINDING_VALUE', `${path}.${key}`);
    }
  }
  if (!Number.isInteger(rawDocument.revisionSequence) || rawDocument.revisionSequence < 1) {
    fail('INVALID_REVISION_SEQUENCE', `${path}.revisionSequence`);
  }
  return structuredClone(rawDocument);
}

function validatePageBinding(rawPage, fidelityRow, path) {
  assertExactKeys(rawPage, {
    required: [
      'namespace',
      'extractedPageOrdinal',
      'locator',
      'pageTextSha256',
      'pageCodePointLength'
    ]
  }, path);
  if (rawPage.namespace !== 'NORMALIZED_BUNDLE_PAGE_NUMBER') fail('PAGE_NAMESPACE_MISMATCH', `${path}.namespace`);
  if (!Number.isInteger(rawPage.extractedPageOrdinal) || rawPage.extractedPageOrdinal < 1 || rawPage.extractedPageOrdinal > 100) {
    fail('INVALID_EXTRACTED_PAGE_ORDINAL', `${path}.extractedPageOrdinal`);
  }
  if (!fidelityRow.eligiblePageNumbers.includes(rawPage.extractedPageOrdinal)) fail('PAGE_NOT_FIDELITY_ELIGIBLE', `${path}.extractedPageOrdinal`);
  if (typeof rawPage.locator !== 'string' || rawPage.locator.length < 1 || rawPage.locator.length > 300) {
    fail('INVALID_PAGE_LOCATOR', `${path}.locator`);
  }
  assertSha256(rawPage.pageTextSha256, `${path}.pageTextSha256`);
  assertIntegerInRange(rawPage.pageCodePointLength, 1, 20_000, `${path}.pageCodePointLength`);
  return structuredClone(rawPage);
}

function validateAnchorBinding(rawAnchor, candidate, page, path) {
  assertExactKeys(rawAnchor, {
    required: [
      'evidenceAnchorId',
      'normalizationVersion',
      'startCodePoint',
      'endCodePoint',
      'quoteSha256',
      'occurrenceIndex',
      'occurrenceCount',
      'contextBeforeSha256',
      'contextAfterSha256'
    ]
  }, path);
  if (rawAnchor.evidenceAnchorId !== candidate.evidenceAnchorId) fail('CANDIDATE_ANCHOR_BINDING_MISMATCH', `${path}.evidenceAnchorId`);
  if (rawAnchor.normalizationVersion !== 'page-text-nfc-lf-codepoint-v1') fail('ANCHOR_NORMALIZATION_MISMATCH', `${path}.normalizationVersion`);
  if (!Number.isInteger(rawAnchor.startCodePoint) || rawAnchor.startCodePoint < 0
    || !Number.isInteger(rawAnchor.endCodePoint) || rawAnchor.endCodePoint <= rawAnchor.startCodePoint
    || rawAnchor.endCodePoint > page.pageCodePointLength
    || rawAnchor.endCodePoint - rawAnchor.startCodePoint > CANDIDATE_REVIEW_LIMITS.maxExcerptCodePoints) {
    fail('INVALID_ANCHOR_OFFSETS', path);
  }
  for (const key of ['quoteSha256', 'contextBeforeSha256', 'contextAfterSha256']) {
    assertSha256(rawAnchor[key], `${path}.${key}`);
  }
  if (!Number.isInteger(rawAnchor.occurrenceIndex) || rawAnchor.occurrenceIndex < 0
    || !Number.isInteger(rawAnchor.occurrenceCount) || rawAnchor.occurrenceCount < 1
    || rawAnchor.occurrenceIndex >= rawAnchor.occurrenceCount) {
    fail('INVALID_ANCHOR_OCCURRENCE', path);
  }
  return structuredClone(rawAnchor);
}

function normalizeCandidateRecord(rawRecord, index, prerequisites, relationshipsByCandidateId) {
  const path = `$.candidateRecords[${index}]`;
  assertExactKeys(rawRecord, {
    required: [
      'evaluatedPrNumber',
      'evaluatedPrHeadSha',
      'manifestSha256',
      'documentDecisionSha256',
      'fidelityDecisionSha256',
      'candidate',
      'candidateSnapshot',
      'productFamily',
      'claimType',
      'document',
      'page',
      'anchor',
      'relationshipIds',
      'relatedCandidateIds'
    ]
  }, path);
  let candidate;
  try {
    candidate = validateCandidate(rawRecord.candidate);
  } catch (error) {
    fail(error?.code || 'INVALID_CANDIDATE', `${path}.candidate${error?.path ? `:${error.path}` : ''}`);
  }
  if (candidate.synthetic) fail('REAL_BINDING_REFUSES_SYNTHETIC_CANDIDATE', `${path}.candidate.synthetic`);
  if (rawRecord.evaluatedPrNumber !== prerequisites.evaluatedPrNumber
    || rawRecord.evaluatedPrHeadSha !== prerequisites.evaluatedPrHeadSha
    || rawRecord.manifestSha256 !== prerequisites.manifestSha256
    || rawRecord.documentDecisionSha256 !== prerequisites.documentDecisionSha256
    || rawRecord.fidelityDecisionSha256 !== prerequisites.fidelityDecisionSha256) {
    fail('CONTROLLING_INPUT_BINDING_MISMATCH', path);
  }
  if (rawRecord.productFamily !== candidate.subject.id || rawRecord.claimType !== candidate.claimType) {
    fail('CANDIDATE_SEMANTIC_BINDING_MISMATCH', path);
  }
  if (canonicalStringify(rawRecord.candidateSnapshot) !== canonicalStringify(expectedCandidateSnapshot(candidate))) {
    fail('CANDIDATE_SNAPSHOT_BINDING_MISMATCH', `${path}.candidateSnapshot`);
  }
  const fidelityRow = prerequisites.fidelityRows.find((row) => row.documentId === candidate.documentId);
  if (!fidelityRow || fidelityRow.fidelityDecision === 'UNSAFE_FOR_CANDIDATE_REVIEW') {
    fail('FIDELITY_DOCUMENT_NOT_ADMISSIBLE', `${path}.document.documentId`);
  }
  const document = validateDocumentBinding(rawRecord.document, candidate, `${path}.document`);
  const page = validatePageBinding(rawRecord.page, fidelityRow, `${path}.page`);
  const anchor = validateAnchorBinding(rawRecord.anchor, candidate, page, `${path}.anchor`);
  const expectedRelationships = relationshipsByCandidateId.get(candidate.candidateId) ?? {
    relationshipIds: [],
    relatedCandidateIds: []
  };
  const relationshipIds = normalizeSortedUnique(rawRecord.relationshipIds, `${path}.relationshipIds`, {
    pattern: RELATIONSHIP_ID,
    max: 5_000
  });
  const relatedCandidateIds = normalizeSortedUnique(rawRecord.relatedCandidateIds, `${path}.relatedCandidateIds`, {
    pattern: CANDIDATE_ID,
    max: 1_000
  });
  if (canonicalStringify(relationshipIds) !== canonicalStringify(expectedRelationships.relationshipIds)
    || canonicalStringify(relatedCandidateIds) !== canonicalStringify(expectedRelationships.relatedCandidateIds)) {
    fail('RELATIONSHIP_BINDING_MISMATCH', path);
  }
  const limitationSafetyRequired = fidelityRow.fidelityDecision === 'ACCEPTABLE_WITH_LIMITATIONS'
    || Object.values(fidelityRow.semanticPreservation).includes('NOT_PRESERVED');
  return {
    evaluatedPrNumber: prerequisites.evaluatedPrNumber,
    evaluatedPrHeadSha: prerequisites.evaluatedPrHeadSha,
    manifestSha256: prerequisites.manifestSha256,
    documentDecisionSha256: prerequisites.documentDecisionSha256,
    fidelityDecisionSha256: prerequisites.fidelityDecisionSha256,
    candidate,
    candidateSnapshot: expectedCandidateSnapshot(candidate),
    productFamily: candidate.subject.id,
    claimType: candidate.claimType,
    document,
    page,
    anchor,
    relationshipIds,
    relatedCandidateIds,
    limitationSafetyRequired
  };
}

function relationshipBindingsByCandidate(relationships, candidates) {
  const byCandidate = new Map(candidates.map((candidate) => [
    candidate.candidateId,
    { relationshipIds: [], relatedCandidateIds: [] }
  ]));
  for (const relationship of relationships) {
    for (const candidateId of relationship.candidateIds) {
      const binding = byCandidate.get(candidateId);
      if (!binding) fail('DANGLING_RELATIONSHIP_ENDPOINT', '$.relationships');
      binding.relationshipIds.push(relationship.relationshipId);
      binding.relatedCandidateIds.push(...relationship.candidateIds.filter((id) => id !== candidateId));
    }
  }
  for (const binding of byCandidate.values()) {
    binding.relationshipIds = [...new Set(binding.relationshipIds)].sort(compareAscii);
    binding.relatedCandidateIds = [...new Set(binding.relatedCandidateIds)].sort(compareAscii);
  }
  return byCandidate;
}

function selectComponents(components) {
  const totalCount = components.reduce((sum, component) => sum + component.candidateCount, 0);
  const totalFamilies = Object.fromEntries(PRODUCT_FAMILIES.map((family) => [
    family,
    components.reduce((sum, component) => sum + component.productFamilyCounts[family], 0)
  ]));
  if (totalCount >= CANDIDATE_REVIEW_LIMITS.minPopulationCandidates
    && totalCount <= CANDIDATE_REVIEW_LIMITS.maxPopulationCandidates
    && PRODUCT_FAMILIES.every((family) => totalFamilies[family] >= CANDIDATE_REVIEW_LIMITS.minPopulationCandidatesPerFamily)) {
    return components;
  }

  let states = new Map([['0:0:0', {
    count: 0,
    families: Object.fromEntries(PRODUCT_FAMILIES.map((family) => [family, 0])),
    components: [],
    candidateIds: []
  }]]);
  for (const component of components) {
    const next = new Map(states);
    for (const state of states.values()) {
      const count = state.count + component.candidateCount;
      if (count > CANDIDATE_REVIEW_LIMITS.maxPopulationCandidates) continue;
      const families = Object.fromEntries(PRODUCT_FAMILIES.map((family) => [
        family,
        state.families[family] + component.productFamilyCounts[family]
      ]));
      const candidateIds = [...state.candidateIds, ...component.candidateIds].sort(compareAscii);
      const candidate = {
        count,
        families,
        components: [...state.components, component],
        candidateIds
      };
      const key = `${count}:${families[PRODUCT_FAMILIES[0]]}:${families[PRODUCT_FAMILIES[1]]}`;
      const prior = next.get(key);
      if (!prior || compareAsciiVectors(candidateIds, prior.candidateIds) < 0) next.set(key, candidate);
    }
    states = next;
  }
  const feasible = [...states.values()].filter((state) => (
    state.count >= CANDIDATE_REVIEW_LIMITS.minPopulationCandidates
    && state.count <= CANDIDATE_REVIEW_LIMITS.maxPopulationCandidates
    && PRODUCT_FAMILIES.every((family) => state.families[family] >= CANDIDATE_REVIEW_LIMITS.minPopulationCandidatesPerFamily)
  )).sort((left, right) => right.count - left.count || compareAsciiVectors(left.candidateIds, right.candidateIds));
  if (feasible.length === 0) fail('NO_FEASIBLE_WHOLE_COMPONENT_POPULATION', '$.candidates');
  return feasible[0].components.sort((left, right) => compareAscii(left.componentKey, right.componentKey));
}

function syntheticPrerequisiteRecord(candidates) {
  const base = {
    mode: CANDIDATE_REVIEW_SYNTHETIC_PREREQUISITE_BYPASS,
    boundary: CANDIDATE_REVIEW_BOUNDARY,
    realFidelityPrerequisitesSatisfied: false,
    section5BindingsComplete: false,
    humanReviewEvidence: false,
    candidateSetHash: sha256(candidates)
  };
  return {
    ...base,
    prerequisiteHash: sha256(base)
  };
}

export function computeCandidateReviewRoundId({ populationHash, prerequisiteHash } = {}) {
  assertExactKeys(arguments[0] ?? {}, {
    required: ['populationHash', 'prerequisiteHash']
  }, '$');
  assertSha256(populationHash, '$.populationHash');
  assertSha256(prerequisiteHash, '$.prerequisiteHash');
  return `round_${sha256({
    schemaVersion: CANDIDATE_REVIEW_POPULATION_SCHEMA_VERSION,
    populationHash,
    prerequisiteHash
  })}`;
}

export function computeCandidateReviewAssignmentHash({ roundId, populationHash, candidateIds } = {}) {
  assertExactKeys(arguments[0] ?? {}, {
    required: ['roundId', 'populationHash', 'candidateIds']
  }, '$');
  assertRoundId(roundId);
  assertSha256(populationHash, '$.populationHash');
  const normalizedCandidateIds = normalizeSortedUnique(candidateIds, '$.candidateIds', {
    pattern: CANDIDATE_ID,
    min: CANDIDATE_REVIEW_LIMITS.minPopulationCandidates,
    max: CANDIDATE_REVIEW_LIMITS.maxPopulationCandidates
  });
  return sha256({
    schemaVersion: CANDIDATE_REVIEW_ROLE_SUBMISSION_SCHEMA_VERSION,
    roundId,
    populationHash,
    candidateIds: normalizedCandidateIds
  });
}

export function selectCandidateReviewPopulation(input = {}) {
  assertExactKeys(input, {
    optional: [
      'candidates',
      'candidateRecords',
      'relationships',
      'prerequisites',
      'syntheticPrerequisiteBypass',
      'limitationSafetyRequiredCandidateIds'
    ]
  }, '$');
  assertSafeInput(input, '$');
  const hasRawCandidates = Object.hasOwn(input, 'candidates');
  const hasCandidateRecords = Object.hasOwn(input, 'candidateRecords');
  if (hasRawCandidates === hasCandidateRecords) fail('EXACTLY_ONE_CANDIDATE_INPUT_FORM_REQUIRED', '$');

  let candidates;
  let prerequisites;
  let candidateRecords = [];
  let prerequisiteMode;
  if (hasRawCandidates) {
    candidates = normalizeCandidates(input.candidates);
    if (input.syntheticPrerequisiteBypass !== CANDIDATE_REVIEW_SYNTHETIC_PREREQUISITE_BYPASS) {
      fail('EXPLICIT_SYNTHETIC_PREREQUISITE_BYPASS_REQUIRED', '$.syntheticPrerequisiteBypass');
    }
    if (input.prerequisites !== undefined) fail('SYNTHETIC_BYPASS_PREREQUISITES_CONFLICT', '$.prerequisites');
    if (candidates.some((candidate) => candidate.synthetic !== true)) {
      fail('SYNTHETIC_BYPASS_REFUSES_NON_SYNTHETIC_CANDIDATE', '$.candidates');
    }
    prerequisites = syntheticPrerequisiteRecord(candidates);
    prerequisiteMode = CANDIDATE_REVIEW_SYNTHETIC_PREREQUISITE_BYPASS;
  } else {
    if (input.syntheticPrerequisiteBypass !== undefined) {
      fail('REAL_BINDING_REFUSES_SYNTHETIC_BYPASS', '$.syntheticPrerequisiteBypass');
    }
    prerequisites = validateCandidateReviewPrerequisites(input.prerequisites);
    if (!Array.isArray(input.candidateRecords) || input.candidateRecords.length === 0) {
      fail('CANDIDATE_RECORD_ARRAY_REQUIRED', '$.candidateRecords');
    }
    candidates = normalizeCandidates(input.candidateRecords.map((record) => record?.candidate), '$.candidateRecords.candidate');
    prerequisiteMode = 'FULL_FIDELITY_AND_SECTION5_BINDINGS';
  }

  const componentSet = buildCandidateReviewComponents({
    candidates,
    ...(input.relationships === undefined ? {} : { relationships: input.relationships })
  });
  const relationships = normalizeDeclaredRelationships(input.relationships, candidates);
  const relationshipBindings = relationshipBindingsByCandidate(relationships, candidates);
  if (hasCandidateRecords) {
    candidateRecords = input.candidateRecords.map((record, index) => (
      normalizeCandidateRecord(record, index, prerequisites, relationshipBindings)
    )).sort((left, right) => compareAscii(left.candidate.candidateId, right.candidate.candidateId));
    if (new Set(candidateRecords.map((record) => record.candidate.candidateId)).size !== candidates.length) {
      fail('CANDIDATE_RECORD_SET_MISMATCH', '$.candidateRecords');
    }
  }

  const selectedComponents = selectComponents(componentSet.components);
  const selectedCandidateIds = selectedComponents.flatMap((component) => component.candidateIds).sort(compareAscii);
  const selectedSet = new Set(selectedCandidateIds);
  const selectedCandidates = candidates.filter((candidate) => selectedSet.has(candidate.candidateId));
  const selectedRelationships = relationships.filter((relationship) => (
    relationship.candidateIds.some((candidateId) => selectedSet.has(candidateId))
  ));
  for (const relationship of selectedRelationships) {
    if (relationship.candidateIds.some((candidateId) => !selectedSet.has(candidateId))) {
      fail('POPULATION_SPLITS_RELATIONSHIP_COMPONENT', `$.relationships.${relationship.relationshipId}`);
    }
  }
  const selectedRecords = candidateRecords.filter((record) => selectedSet.has(record.candidate.candidateId));
  const derivedLimitationIds = hasCandidateRecords
    ? selectedRecords.filter((record) => record.limitationSafetyRequired).map((record) => record.candidate.candidateId).sort(compareAscii)
    : normalizeSortedUnique(input.limitationSafetyRequiredCandidateIds ?? [], '$.limitationSafetyRequiredCandidateIds', {
      pattern: CANDIDATE_ID,
      max: CANDIDATE_REVIEW_LIMITS.maxPopulationCandidates
    });
  if (derivedLimitationIds.some((candidateId) => !selectedSet.has(candidateId))) {
    fail('LIMITATION_REQUIREMENT_CANDIDATE_NOT_SELECTED', '$.limitationSafetyRequiredCandidateIds');
  }
  const productFamilyCounts = Object.fromEntries(PRODUCT_FAMILIES.map((family) => [
    family,
    selectedCandidates.filter((candidate) => candidate.subject.id === family).length
  ]));
  const relationshipReportBase = {
    schemaVersion: 'pr207-candidate-review-relationship-report-v2',
    ...BOUNDARY,
    relationships: selectedRelationships
  };
  const relationshipReport = {
    ...relationshipReportBase,
    reportHash: sha256(relationshipReportBase)
  };
  const core = {
    schemaVersion: CANDIDATE_REVIEW_POPULATION_SCHEMA_VERSION,
    ...BOUNDARY,
    prerequisiteMode,
    prerequisiteHash: prerequisites.prerequisiteHash,
    syntheticPrerequisiteBypass: prerequisiteMode === CANDIDATE_REVIEW_SYNTHETIC_PREREQUISITE_BYPASS
      ? CANDIDATE_REVIEW_SYNTHETIC_PREREQUISITE_BYPASS
      : null,
    realFidelityPrerequisitesSatisfied: prerequisiteMode === 'FULL_FIDELITY_AND_SECTION5_BINDINGS',
    section5BindingsComplete: prerequisiteMode === 'FULL_FIDELITY_AND_SECTION5_BINDINGS',
    humanReviewEvidence: false,
    prerequisites: prerequisiteMode === 'FULL_FIDELITY_AND_SECTION5_BINDINGS'
      ? prerequisites
      : null,
    candidateCount: selectedCandidates.length,
    productFamilyCounts,
    candidates: selectedCandidates,
    candidateRecordCores: selectedRecords,
    relationshipReport,
    components: selectedComponents,
    selectedComponentIds: selectedComponents.map((component) => component.componentId),
    limitationSafetyRequiredCandidateIds: derivedLimitationIds
  };
  const populationHash = sha256(core);
  const roundId = computeCandidateReviewRoundId({
    populationHash,
    prerequisiteHash: prerequisites.prerequisiteHash
  });
  const boundCandidateRecords = selectedRecords.map((record) => ({
    evaluatedPrNumber: record.evaluatedPrNumber,
    evaluatedPrHeadSha: record.evaluatedPrHeadSha,
    manifestSha256: record.manifestSha256,
    documentDecisionSha256: record.documentDecisionSha256,
    fidelityDecisionSha256: record.fidelityDecisionSha256,
    populationHash,
    roundId,
    candidate: record.candidate,
    candidateSnapshot: record.candidateSnapshot,
    productFamily: record.productFamily,
    claimType: record.claimType,
    document: record.document,
    page: record.page,
    anchor: record.anchor,
    relationshipIds: record.relationshipIds,
    relatedCandidateIds: record.relatedCandidateIds,
    limitationSafetyRequired: record.limitationSafetyRequired
  }));
  const output = {
    schemaVersion: CANDIDATE_REVIEW_POPULATION_SCHEMA_VERSION,
    ...BOUNDARY,
    populationHash,
    roundId,
    prerequisiteMode,
    prerequisiteHash: prerequisites.prerequisiteHash,
    syntheticPrerequisiteBypass: core.syntheticPrerequisiteBypass,
    realFidelityPrerequisitesSatisfied: core.realFidelityPrerequisitesSatisfied,
    section5BindingsComplete: core.section5BindingsComplete,
    humanReviewEvidence: false,
    prerequisites: core.prerequisites,
    candidateCount: selectedCandidates.length,
    productFamilyCounts,
    candidates: selectedCandidates,
    candidateRecords: boundCandidateRecords,
    relationshipReport,
    components: selectedComponents,
    selectedComponentIds: core.selectedComponentIds,
    limitationSafetyRequiredCandidateIds: derivedLimitationIds
  };
  return cloneFrozen(output);
}

function populationCoreForHash(population) {
  const candidateRecordCores = population.candidateRecords.map((record) => ({
    evaluatedPrNumber: record.evaluatedPrNumber,
    evaluatedPrHeadSha: record.evaluatedPrHeadSha,
    manifestSha256: record.manifestSha256,
    documentDecisionSha256: record.documentDecisionSha256,
    fidelityDecisionSha256: record.fidelityDecisionSha256,
    candidate: record.candidate,
    candidateSnapshot: record.candidateSnapshot,
    productFamily: record.productFamily,
    claimType: record.claimType,
    document: record.document,
    page: record.page,
    anchor: record.anchor,
    relationshipIds: record.relationshipIds,
    relatedCandidateIds: record.relatedCandidateIds,
    limitationSafetyRequired: record.limitationSafetyRequired
  }));
  return {
    schemaVersion: CANDIDATE_REVIEW_POPULATION_SCHEMA_VERSION,
    ...BOUNDARY,
    prerequisiteMode: population.prerequisiteMode,
    prerequisiteHash: population.prerequisiteHash,
    syntheticPrerequisiteBypass: population.syntheticPrerequisiteBypass,
    realFidelityPrerequisitesSatisfied: population.realFidelityPrerequisitesSatisfied,
    section5BindingsComplete: population.section5BindingsComplete,
    humanReviewEvidence: false,
    prerequisites: population.prerequisites,
    candidateCount: population.candidateCount,
    productFamilyCounts: population.productFamilyCounts,
    candidates: population.candidates,
    candidateRecordCores,
    relationshipReport: population.relationshipReport,
    components: population.components,
    selectedComponentIds: population.selectedComponentIds,
    limitationSafetyRequiredCandidateIds: population.limitationSafetyRequiredCandidateIds
  };
}

export function validateCandidateReviewPopulation(rawPopulation) {
  assertSafeInput(rawPopulation, '$');
  assertExactKeys(rawPopulation, {
    required: [
      'schemaVersion',
      ...BOUNDARY_KEYS,
      'populationHash',
      'roundId',
      'prerequisiteMode',
      'prerequisiteHash',
      'syntheticPrerequisiteBypass',
      'realFidelityPrerequisitesSatisfied',
      'section5BindingsComplete',
      'humanReviewEvidence',
      'prerequisites',
      'candidateCount',
      'productFamilyCounts',
      'candidates',
      'candidateRecords',
      'relationshipReport',
      'components',
      'selectedComponentIds',
      'limitationSafetyRequiredCandidateIds'
    ]
  }, '$');
  if (rawPopulation.schemaVersion !== CANDIDATE_REVIEW_POPULATION_SCHEMA_VERSION) fail('UNSUPPORTED_POPULATION_SCHEMA', '$.schemaVersion');
  assertBoundary(rawPopulation);
  assertSha256(rawPopulation.populationHash, '$.populationHash');
  assertRoundId(rawPopulation.roundId);
  assertSha256(rawPopulation.prerequisiteHash, '$.prerequisiteHash');
  if (rawPopulation.humanReviewEvidence !== false) fail('HUMAN_REVIEW_EVIDENCE_CLAIM_REFUSED', '$.humanReviewEvidence');
  const candidates = normalizeCandidates(rawPopulation.candidates);
  if (candidates.length < CANDIDATE_REVIEW_LIMITS.minPopulationCandidates
    || candidates.length > CANDIDATE_REVIEW_LIMITS.maxPopulationCandidates
    || rawPopulation.candidateCount !== candidates.length) {
    fail('POPULATION_COUNT_OUT_OF_RANGE', '$.candidateCount');
  }
  if (canonicalStringify(candidates) !== canonicalStringify(rawPopulation.candidates)) {
    fail('CANDIDATE_ORDER_NOT_CANONICAL', '$.candidates');
  }
  assertExactKeys(rawPopulation.productFamilyCounts, { required: PRODUCT_FAMILIES }, '$.productFamilyCounts');
  for (const family of PRODUCT_FAMILIES) {
    const expected = candidates.filter((candidate) => candidate.subject.id === family).length;
    if (rawPopulation.productFamilyCounts[family] !== expected
      || expected < CANDIDATE_REVIEW_LIMITS.minPopulationCandidatesPerFamily) {
      fail('PRODUCT_FAMILY_QUOTA_NOT_MET', `$.productFamilyCounts.${family}`);
    }
  }
  const syntheticMode = rawPopulation.prerequisiteMode === CANDIDATE_REVIEW_SYNTHETIC_PREREQUISITE_BYPASS;
  if (syntheticMode) {
    if (rawPopulation.syntheticPrerequisiteBypass !== CANDIDATE_REVIEW_SYNTHETIC_PREREQUISITE_BYPASS
      || rawPopulation.realFidelityPrerequisitesSatisfied !== false
      || rawPopulation.section5BindingsComplete !== false
      || rawPopulation.prerequisites !== null
      || rawPopulation.candidateRecords.length !== 0
      || candidates.some((candidate) => candidate.synthetic !== true)) {
      fail('INVALID_SYNTHETIC_PREREQUISITE_BYPASS', '$');
    }
  } else if (rawPopulation.prerequisiteMode === 'FULL_FIDELITY_AND_SECTION5_BINDINGS') {
    if (rawPopulation.syntheticPrerequisiteBypass !== null
      || rawPopulation.realFidelityPrerequisitesSatisfied !== true
      || rawPopulation.section5BindingsComplete !== true
      || !isPlainObject(rawPopulation.prerequisites)
      || rawPopulation.candidateRecords.length !== candidates.length
      || candidates.some((candidate) => candidate.synthetic !== false)) {
      fail('INCOMPLETE_REAL_POPULATION_BINDINGS', '$');
    }
  } else {
    fail('UNSUPPORTED_PREREQUISITE_MODE', '$.prerequisiteMode');
  }
  assertExactKeys(rawPopulation.relationshipReport, {
    required: ['schemaVersion', ...BOUNDARY_KEYS, 'relationships', 'reportHash']
  }, '$.relationshipReport');
  assertBoundary(rawPopulation.relationshipReport, '$.relationshipReport');
  if (rawPopulation.relationshipReport.schemaVersion !== 'pr207-candidate-review-relationship-report-v2') {
    fail('UNSUPPORTED_RELATIONSHIP_REPORT_SCHEMA', '$.relationshipReport.schemaVersion');
  }
  const relationshipReportBase = {
    schemaVersion: rawPopulation.relationshipReport.schemaVersion,
    ...BOUNDARY,
    relationships: rawPopulation.relationshipReport.relationships
  };
  if (rawPopulation.relationshipReport.reportHash !== sha256(relationshipReportBase)) {
    fail('RELATIONSHIP_REPORT_HASH_MISMATCH', '$.relationshipReport.reportHash');
  }
  const componentSet = buildCandidateReviewComponents({
    candidates,
    relationships: rawPopulation.relationshipReport.relationships
  });
  if (canonicalStringify(rawPopulation.components) !== canonicalStringify(componentSet.components)
    || canonicalStringify(rawPopulation.selectedComponentIds) !== canonicalStringify(componentSet.components.map((item) => item.componentId))) {
    fail('POPULATION_COMPONENT_SET_MISMATCH', '$.components');
  }
  const limitationIds = normalizeSortedUnique(
    rawPopulation.limitationSafetyRequiredCandidateIds,
    '$.limitationSafetyRequiredCandidateIds',
    { pattern: CANDIDATE_ID, max: candidates.length }
  );
  if (limitationIds.some((candidateId) => !candidates.some((candidate) => candidate.candidateId === candidateId))) {
    fail('LIMITATION_REQUIREMENT_CANDIDATE_UNKNOWN', '$.limitationSafetyRequiredCandidateIds');
  }
  if (!syntheticMode) {
    const prerequisites = validateCandidateReviewPrerequisites(rawPopulation.prerequisites);
    if (prerequisites.prerequisiteHash !== rawPopulation.prerequisiteHash) {
      fail('POPULATION_PREREQUISITE_BINDING_MISMATCH', '$.prerequisites');
    }
    const relationshipBindings = relationshipBindingsByCandidate(
      rawPopulation.relationshipReport.relationships,
      candidates
    );
    const recordIds = rawPopulation.candidateRecords.map((record) => record?.candidate?.candidateId);
    if (canonicalStringify(recordIds) !== canonicalStringify(candidates.map((candidate) => candidate.candidateId))) {
      fail('CANDIDATE_RECORD_ORDER_OR_SET_MISMATCH', '$.candidateRecords');
    }
    for (const [index, record] of rawPopulation.candidateRecords.entries()) {
      const path = `$.candidateRecords[${index}]`;
      assertExactKeys(record, {
        required: [
          'evaluatedPrNumber', 'evaluatedPrHeadSha', 'manifestSha256',
          'documentDecisionSha256', 'fidelityDecisionSha256', 'populationHash',
          'roundId', 'candidate', 'candidateSnapshot', 'productFamily', 'claimType',
          'document', 'page', 'anchor', 'relationshipIds', 'relatedCandidateIds',
          'limitationSafetyRequired'
        ]
      }, path);
      if (record.populationHash !== rawPopulation.populationHash || record.roundId !== rawPopulation.roundId) {
        fail('CANDIDATE_RECORD_ROUND_BINDING_MISMATCH', path);
      }
      const recordCoreInput = Object.fromEntries(Object.entries(record).filter(([key]) => (
        !['populationHash', 'roundId', 'limitationSafetyRequired'].includes(key)
      )));
      const normalizedRecord = normalizeCandidateRecord(
        recordCoreInput,
        index,
        prerequisites,
        relationshipBindings
      );
      const expectedRecord = {
        ...normalizedRecord,
        populationHash: rawPopulation.populationHash,
        roundId: rawPopulation.roundId
      };
      const actualComparable = {
        ...record,
        populationHash: rawPopulation.populationHash,
        roundId: rawPopulation.roundId
      };
      if (canonicalStringify(actualComparable) !== canonicalStringify(expectedRecord)) {
        fail('CANDIDATE_RECORD_BINDING_MISMATCH', path);
      }
      if (record.limitationSafetyRequired !== limitationIds.includes(candidates[index].candidateId)) {
        fail('CANDIDATE_LIMITATION_BINDING_MISMATCH', `${path}.limitationSafetyRequired`);
      }
    }
  }
  const core = populationCoreForHash(rawPopulation);
  if (rawPopulation.populationHash !== sha256(core)) fail('POPULATION_HASH_MISMATCH', '$.populationHash');
  const expectedRoundId = computeCandidateReviewRoundId({
    populationHash: rawPopulation.populationHash,
    prerequisiteHash: rawPopulation.prerequisiteHash
  });
  if (rawPopulation.roundId !== expectedRoundId) fail('ROUND_ID_MISMATCH', '$.roundId');
  return cloneFrozen(rawPopulation);
}

export function createBlankCandidateReviewRoleSubmission({
  roundId,
  populationHash,
  assignmentHash,
  role
} = {}) {
  assertExactKeys(arguments[0] ?? {}, {
    required: ['roundId', 'populationHash', 'assignmentHash', 'role']
  }, '$');
  assertRoundId(roundId);
  assertSha256(populationHash, '$.populationHash');
  assertSha256(assignmentHash, '$.assignmentHash');
  if (!CANDIDATE_REVIEW_ROLES.includes(role)) fail('UNSUPPORTED_REVIEW_ROLE', '$.role');
  return cloneFrozen({
    schemaVersion: CANDIDATE_REVIEW_ROLE_SUBMISSION_SCHEMA_VERSION,
    ...BOUNDARY,
    roundId,
    populationHash,
    assignmentHash,
    role,
    roleQualificationAttested: false,
    sealed: false,
    rows: [],
    submissionHash: null
  });
}

function normalizeDecisionForm(rawForm, candidate, relatedCandidateIds, path) {
  if (!isPlainObject(rawForm)) fail('DECISION_FORM_REQUIRED', path);
  if (rawForm.type === 'INNER_DECISION') {
    assertExactKeys(rawForm, {
      required: ['type', 'decision']
    }, path);
    let decision;
    try {
      decision = validateReviewDecision(rawForm.decision);
    } catch (error) {
      fail(error?.code || 'INVALID_INNER_DECISION', `${path}.decision${error?.path ? `:${error.path}` : ''}`);
    }
    if (decision.candidateId !== candidate.candidateId
      || decision.documentId !== candidate.documentId
      || decision.evidenceAnchorId !== candidate.evidenceAnchorId
      || canonicalStringify(decision.candidateSnapshot) !== canonicalStringify(expectedCandidateSnapshot(candidate))) {
      fail('INNER_DECISION_CANDIDATE_BINDING_MISMATCH', `${path}.decision`);
    }
    if (decision.relatedCandidateIds.some((candidateId) => !relatedCandidateIds.includes(candidateId))) {
      fail('INNER_DECISION_RELATIONSHIP_LINK_UNKNOWN', `${path}.decision.relatedCandidateIds`);
    }
    return { type: 'INNER_DECISION', decision };
  }
  if (rawForm.type === 'OUTER_HOLD_TERMINOLOGY_GAP') {
    assertExactKeys(rawForm, {
      required: ['type', 'reasonCode']
    }, path);
    if (rawForm.reasonCode !== 'OUTER_V2_TERMINOLOGY_GAP') {
      fail('OUTER_TERMINOLOGY_REASON_MISMATCH', `${path}.reasonCode`);
    }
    return {
      type: 'OUTER_HOLD_TERMINOLOGY_GAP',
      reasonCode: 'OUTER_V2_TERMINOLOGY_GAP'
    };
  }
  fail('UNSUPPORTED_DECISION_FORM', `${path}.type`);
}

function computeReviewRowId(row, submission) {
  return `reviewrow_${sha256({
    schemaVersion: CANDIDATE_REVIEW_ROLE_SUBMISSION_SCHEMA_VERSION,
    roundId: submission.roundId,
    populationHash: submission.populationHash,
    assignmentHash: submission.assignmentHash,
    candidateId: row.candidateId,
    role: submission.role,
    limitationSafetyAcknowledgement: row.limitationSafetyAcknowledgement,
    decisionForm: row.decisionForm,
    reviewDurationSeconds: row.reviewDurationSeconds,
    evidenceTraceabilityUsefulness: row.evidenceTraceabilityUsefulness,
    structuredDecisionUsefulness: row.structuredDecisionUsefulness,
    patchAssessmentUsefulness: row.patchAssessmentUsefulness
  })}`;
}

export function validateCandidateReviewRoleSubmission(rawSubmission, {
  population: rawPopulation,
  allowBlank = false
} = {}) {
  assertSafeInput(rawSubmission, '$');
  assertExactKeys(rawSubmission, {
    required: [
      'schemaVersion',
      ...BOUNDARY_KEYS,
      'roundId',
      'populationHash',
      'assignmentHash',
      'role',
      'roleQualificationAttested',
      'sealed',
      'rows',
      'submissionHash'
    ]
  }, '$');
  if (rawSubmission.schemaVersion !== CANDIDATE_REVIEW_ROLE_SUBMISSION_SCHEMA_VERSION) {
    fail('UNSUPPORTED_ROLE_SUBMISSION_SCHEMA', '$.schemaVersion');
  }
  assertBoundary(rawSubmission);
  assertRoundId(rawSubmission.roundId);
  assertSha256(rawSubmission.populationHash, '$.populationHash');
  assertSha256(rawSubmission.assignmentHash, '$.assignmentHash');
  if (!CANDIDATE_REVIEW_ROLES.includes(rawSubmission.role)) fail('UNSUPPORTED_REVIEW_ROLE', '$.role');
  if (!Array.isArray(rawSubmission.rows) || rawSubmission.rows.length > CANDIDATE_REVIEW_LIMITS.maxPopulationCandidates) {
    fail('ROLE_ROW_COUNT_OUT_OF_RANGE', '$.rows');
  }
  const population = rawPopulation ? validateCandidateReviewPopulation(rawPopulation) : null;
  if (population) {
    if (rawSubmission.roundId !== population.roundId || rawSubmission.populationHash !== population.populationHash) {
      fail('SUBMISSION_POPULATION_BINDING_MISMATCH', '$');
    }
    const expectedAssignmentHash = computeCandidateReviewAssignmentHash({
      roundId: population.roundId,
      populationHash: population.populationHash,
      candidateIds: population.candidates.map((candidate) => candidate.candidateId)
    });
    if (rawSubmission.assignmentHash !== expectedAssignmentHash) fail('ASSIGNMENT_HASH_MISMATCH', '$.assignmentHash');
  }
  if (rawSubmission.rows.length === 0) {
    if (!allowBlank) fail('INCOMPLETE_ROLE_SUBMISSION', '$.rows');
    if (rawSubmission.roleQualificationAttested !== false
      || rawSubmission.sealed !== false
      || rawSubmission.submissionHash !== null) {
      fail('NONCANONICAL_BLANK_SUBMISSION', '$');
    }
    return cloneFrozen(rawSubmission);
  }
  if (!population) fail('POPULATION_REQUIRED_FOR_COMPLETED_SUBMISSION', '$.population');
  if (rawSubmission.roleQualificationAttested !== true) fail('ROLE_QUALIFICATION_ATTESTATION_REQUIRED', '$.roleQualificationAttested');
  if (rawSubmission.sealed !== true) fail('SEALED_SUBMISSION_REQUIRED', '$.sealed');
  if (rawSubmission.rows.length !== population.candidates.length) fail('EXACT_ROLE_ROW_COUNT_REQUIRED', '$.rows');

  const candidateById = new Map(population.candidates.map((candidate) => [candidate.candidateId, candidate]));
  const relationshipBindings = relationshipBindingsByCandidate(
    population.relationshipReport.relationships,
    population.candidates
  );
  const limitationRequired = new Set(population.limitationSafetyRequiredCandidateIds);
  const rows = rawSubmission.rows.map((rawRow, index) => {
    const path = `$.rows[${index}]`;
    assertExactKeys(rawRow, {
      required: [
        'candidateId',
        'limitationSafetyAcknowledgement',
        'decisionForm',
        'reviewDurationSeconds',
        'evidenceTraceabilityUsefulness',
        'structuredDecisionUsefulness',
        'patchAssessmentUsefulness'
      ],
      optional: ['reviewRowId']
    }, path);
    if (typeof rawRow.candidateId !== 'string' || !CANDIDATE_ID.test(rawRow.candidateId)) {
      fail('INVALID_CANDIDATE_ID', `${path}.candidateId`);
    }
    const candidate = candidateById.get(rawRow.candidateId);
    if (!candidate) fail('ROLE_ROW_CANDIDATE_UNKNOWN', `${path}.candidateId`);
    if (!CANDIDATE_REVIEW_LIMITATION_ACKNOWLEDGEMENTS.includes(rawRow.limitationSafetyAcknowledgement)) {
      fail('INVALID_LIMITATION_ACKNOWLEDGEMENT', `${path}.limitationSafetyAcknowledgement`);
    }
    if (limitationRequired.has(candidate.candidateId)) {
      if (!['LIMITATION_DOES_NOT_AFFECT_CANDIDATE', 'NOT_ATTESTED'].includes(rawRow.limitationSafetyAcknowledgement)) {
        fail('LIMITATION_ACKNOWLEDGEMENT_NOT_APPLICABLE_REFUSED', `${path}.limitationSafetyAcknowledgement`);
      }
    } else if (!['NOT_APPLICABLE', 'NOT_ATTESTED'].includes(rawRow.limitationSafetyAcknowledgement)) {
      fail('UNNEEDED_LIMITATION_ACKNOWLEDGEMENT_REFUSED', `${path}.limitationSafetyAcknowledgement`);
    }
    const relatedCandidateIds = relationshipBindings.get(candidate.candidateId).relatedCandidateIds;
    const decisionForm = normalizeDecisionForm(rawRow.decisionForm, candidate, relatedCandidateIds, `${path}.decisionForm`);
    const normalized = {
      candidateId: candidate.candidateId,
      limitationSafetyAcknowledgement: rawRow.limitationSafetyAcknowledgement,
      decisionForm,
      reviewDurationSeconds: assertIntegerInRange(
        rawRow.reviewDurationSeconds,
        CANDIDATE_REVIEW_LIMITS.minReviewDurationSeconds,
        CANDIDATE_REVIEW_LIMITS.maxReviewDurationSeconds,
        `${path}.reviewDurationSeconds`
      ),
      evidenceTraceabilityUsefulness: assertIntegerInRange(
        rawRow.evidenceTraceabilityUsefulness,
        CANDIDATE_REVIEW_LIMITS.minUsefulness,
        CANDIDATE_REVIEW_LIMITS.maxUsefulness,
        `${path}.evidenceTraceabilityUsefulness`
      ),
      structuredDecisionUsefulness: assertIntegerInRange(
        rawRow.structuredDecisionUsefulness,
        CANDIDATE_REVIEW_LIMITS.minUsefulness,
        CANDIDATE_REVIEW_LIMITS.maxUsefulness,
        `${path}.structuredDecisionUsefulness`
      ),
      patchAssessmentUsefulness: rawSubmission.role === 'PRIMARY_TECHNICAL_REVIEWER'
        ? rawRow.patchAssessmentUsefulness
        : assertIntegerInRange(
          rawRow.patchAssessmentUsefulness,
          CANDIDATE_REVIEW_LIMITS.minUsefulness,
          CANDIDATE_REVIEW_LIMITS.maxUsefulness,
          `${path}.patchAssessmentUsefulness`
        )
    };
    if (rawSubmission.role === 'PRIMARY_TECHNICAL_REVIEWER' && normalized.patchAssessmentUsefulness !== null) {
      fail('PRIMARY_PATCH_ASSESSMENT_USEFULNESS_REFUSED', `${path}.patchAssessmentUsefulness`);
    }
    const reviewRowId = computeReviewRowId(normalized, rawSubmission);
    if (rawRow.reviewRowId !== undefined && rawRow.reviewRowId !== reviewRowId) {
      fail('REVIEW_ROW_ID_MISMATCH', `${path}.reviewRowId`);
    }
    return { reviewRowId, ...normalized };
  }).sort((left, right) => compareAscii(left.candidateId, right.candidateId));
  if (new Set(rows.map((row) => row.candidateId)).size !== rows.length
    || canonicalStringify(rows.map((row) => row.candidateId)) !== canonicalStringify(population.candidates.map((candidate) => candidate.candidateId))) {
    fail('ROLE_ROW_CANDIDATE_SET_MISMATCH', '$.rows');
  }
  const base = {
    schemaVersion: CANDIDATE_REVIEW_ROLE_SUBMISSION_SCHEMA_VERSION,
    ...BOUNDARY,
    roundId: rawSubmission.roundId,
    populationHash: rawSubmission.populationHash,
    assignmentHash: rawSubmission.assignmentHash,
    role: rawSubmission.role,
    roleQualificationAttested: true,
    sealed: true,
    rows
  };
  const submissionHash = sha256(base);
  if (rawSubmission.submissionHash !== null
    && rawSubmission.submissionHash !== undefined
    && rawSubmission.submissionHash !== submissionHash) {
    fail('SUBMISSION_HASH_MISMATCH', '$.submissionHash');
  }
  return cloneFrozen({ ...base, submissionHash });
}

function reasonIntersection(left, right) {
  const rightSet = new Set(right);
  return left.filter((reason) => rightSet.has(reason)).sort(compareAscii);
}

function requiredApprovalReasons(candidate) {
  return [
    'EVIDENCE_QUOTE_CONFIRMED',
    'STRUCTURED_MEANING_CONFIRMED',
    ...(candidate.applicability.conditions.length > 0 ? ['CONDITIONS_CONFIRMED'] : [])
  ].sort(compareAscii);
}

function reconcileRolePair(candidate, primaryRow, secondaryRow, limitationRequired) {
  const left = primaryRow.decisionForm;
  const right = secondaryRow.decisionForm;
  if (left.type === 'OUTER_HOLD_TERMINOLOGY_GAP' || right.type === 'OUTER_HOLD_TERMINOLOGY_GAP') {
    return {
      baseOutcome: 'HELD',
      reasonCodes: ['OUTER_V2_TERMINOLOGY_GAP'],
      relatedCandidateIds: [],
      provisionalTechnicalApproval: false,
      decisionAgreement: left.type === right.type,
      canonicalDecision: null
    };
  }
  const leftDecision = left.decision;
  const rightDecision = right.decision;
  const commonReasons = reasonIntersection(leftDecision.reasonCodes, rightDecision.reasonCodes);
  const requiredLinksMatch = canonicalStringify(leftDecision.relatedCandidateIds)
    === canonicalStringify(rightDecision.relatedCandidateIds);
  if (leftDecision.decision === 'FLAG_CONFLICT'
    || rightDecision.decision === 'FLAG_CONFLICT'
    || leftDecision.decision !== rightDecision.decision
    || commonReasons.length === 0
    || !requiredLinksMatch) {
    return {
      baseOutcome: 'CONFLICTED',
      reasonCodes: ['ROLE_DECISIONS_CONFLICT'],
      relatedCandidateIds: [],
      provisionalTechnicalApproval: false,
      decisionAgreement: false,
      canonicalDecision: null
    };
  }
  const decisionAgreement = true;
  if (leftDecision.decision === 'APPROVE_FOR_REPOSITORY_REVIEW') {
    const reasons = requiredApprovalReasons(candidate);
    const acknowledgementOkay = limitationRequired
      ? primaryRow.limitationSafetyAcknowledgement === 'LIMITATION_DOES_NOT_AFFECT_CANDIDATE'
        && secondaryRow.limitationSafetyAcknowledgement === 'LIMITATION_DOES_NOT_AFFECT_CANDIDATE'
      : primaryRow.limitationSafetyAcknowledgement === 'NOT_APPLICABLE'
        && secondaryRow.limitationSafetyAcknowledgement === 'NOT_APPLICABLE';
    if (!acknowledgementOkay) {
      return {
        baseOutcome: 'HELD',
        reasonCodes: ['LIMITATION_SAFETY_NOT_ATTESTED'],
        relatedCandidateIds: [],
        provisionalTechnicalApproval: false,
        decisionAgreement,
        canonicalDecision: null
      };
    }
    const canonicalDecision = createReviewDecision({
      candidate,
      decision: 'APPROVE_FOR_REPOSITORY_REVIEW',
      reasonCodes: reasons,
      relatedCandidateIds: []
    });
    return {
      baseOutcome: 'PROVISIONAL_APPROVAL',
      reasonCodes: reasons,
      relatedCandidateIds: [],
      provisionalTechnicalApproval: true,
      decisionAgreement,
      canonicalDecision
    };
  }
  const canonicalDecision = createReviewDecision({
    candidate,
    decision: leftDecision.decision,
    reasonCodes: commonReasons,
    relatedCandidateIds: leftDecision.relatedCandidateIds
  });
  if (leftDecision.decision === 'REJECT') {
    return {
      baseOutcome: 'REJECTED',
      reasonCodes: commonReasons,
      relatedCandidateIds: leftDecision.relatedCandidateIds,
      provisionalTechnicalApproval: false,
      decisionAgreement,
      canonicalDecision
    };
  }
  return {
    baseOutcome: 'HELD',
    reasonCodes: commonReasons,
    relatedCandidateIds: leftDecision.relatedCandidateIds,
    provisionalTechnicalApproval: false,
    decisionAgreement,
    canonicalDecision
  };
}

function relationshipClosure(relationship, pairByCandidateId) {
  const pairs = relationship.candidateIds.map((candidateId) => pairByCandidateId.get(candidateId));
  const approved = pairs.filter((pair) => pair.provisionalTechnicalApproval);
  const rejected = pairs.filter((pair) => pair.canonicalDecision?.decision === 'REJECT');
  let closed = false;
  let reasonCode;
  if (relationship.type === 'EXACT_DUPLICATE_EVIDENCE') {
    const duplicateRejections = rejected.filter((pair) => pair.reasonCodes.includes('DUPLICATE_CANDIDATE'));
    closed = approved.length <= 1 && approved.length + duplicateRejections.length === pairs.length;
    reasonCode = closed ? 'EXPLICIT_DUPLICATE_DISPOSITION' : 'DUPLICATE_RELATIONSHIP_UNRESOLVED';
  } else if (relationship.type === 'MATERIAL_CONFLICT') {
    closed = approved.length <= 1 && approved.length + rejected.length === pairs.length;
    reasonCode = closed ? 'EXPLICIT_CONFLICT_DISPOSITION' : 'MATERIAL_CONFLICT_UNRESOLVED';
  } else if (relationship.type === 'SUPERSEDES') {
    const superseded = pairByCandidateId.get(relationship.supersededCandidateId);
    const successor = pairByCandidateId.get(relationship.successorCandidateId);
    closed = superseded?.canonicalDecision?.decision === 'FLAG_SUPERSEDED'
      && superseded.reasonCodes.includes('SUPERSEDED_DOCUMENT')
      && superseded.relatedCandidateIds.includes(relationship.successorCandidateId)
      && (successor?.provisionalTechnicalApproval || successor?.canonicalDecision?.decision === 'REJECT');
    reasonCode = closed ? 'EXPLICIT_SUPERSESSION_DISPOSITION' : 'SUPERSESSION_UNRESOLVED';
  } else {
    closed = pairs.every((pair) => (
      pair.provisionalTechnicalApproval || pair.canonicalDecision?.decision === 'REJECT'
    ));
    reasonCode = closed ? 'EXPLICIT_CONDITION_DISPOSITION' : 'CONDITION_RESOLUTION_UNRESOLVED';
  }
  return {
    relationshipId: relationship.relationshipId,
    type: relationship.type,
    candidateIds: relationship.candidateIds,
    status: closed ? 'CLOSED' : 'UNRESOLVED',
    reasonCode
  };
}

function normalizePatchSuitabilityMap(rawMap, population) {
  if (!isPlainObject(rawMap)) fail('PATCH_SUITABILITY_MAP_REQUIRED', '$.patchSuitabilityByCandidateId');
  const candidateIds = population.candidates.map((candidate) => candidate.candidateId);
  const keys = Object.keys(rawMap).sort(compareAscii);
  if (canonicalStringify(keys) !== canonicalStringify(candidateIds)) {
    fail('PATCH_SUITABILITY_CANDIDATE_SET_MISMATCH', '$.patchSuitabilityByCandidateId');
  }
  return Object.fromEntries(candidateIds.map((candidateId) => {
    const value = rawMap[candidateId];
    if (!CANDIDATE_REVIEW_PATCH_SUITABILITY.includes(value)) {
      fail('INVALID_PATCH_SUITABILITY', `$.patchSuitabilityByCandidateId.${candidateId}`);
    }
    return [candidateId, value];
  }));
}

function normalizedPairDecisionPayload(population, primary, secondary) {
  return population.candidates.map((candidate) => {
    const primaryRow = primary.rows.find((row) => row.candidateId === candidate.candidateId);
    const secondaryRow = secondary.rows.find((row) => row.candidateId === candidate.candidateId);
    return {
      candidateId: candidate.candidateId,
      primaryReviewRowId: primaryRow.reviewRowId,
      secondaryReviewRowId: secondaryRow.reviewRowId,
      rolePairHash: sha256({
        primaryDecisionForm: primaryRow.decisionForm,
        secondaryDecisionForm: secondaryRow.decisionForm,
        primaryLimitationSafetyAcknowledgement: primaryRow.limitationSafetyAcknowledgement,
        secondaryLimitationSafetyAcknowledgement: secondaryRow.limitationSafetyAcknowledgement
      })
    };
  });
}

export function computeCandidateReviewDecisionSetHash({
  population: rawPopulation,
  primarySubmission: rawPrimary,
  secondarySubmission: rawSecondary
} = {}) {
  const population = validateCandidateReviewPopulation(rawPopulation);
  const primary = validateCandidateReviewRoleSubmission(rawPrimary, { population });
  const secondary = validateCandidateReviewRoleSubmission(rawSecondary, { population });
  if (primary.role !== 'PRIMARY_TECHNICAL_REVIEWER'
    || secondary.role !== 'SECONDARY_EVIDENCE_REVIEWER'
    || primary.assignmentHash !== secondary.assignmentHash) {
    fail('EXACT_ROLE_PAIR_REQUIRED', '$');
  }
  return sha256({
    roundId: population.roundId,
    populationHash: population.populationHash,
    primarySubmissionHash: primary.submissionHash,
    secondarySubmissionHash: secondary.submissionHash,
    rolePairs: normalizedPairDecisionPayload(population, primary, secondary)
  });
}

function countCodePoints(value) {
  return [...value].length;
}

function normalizeValidatedReviewPatches(
  rawPatches,
  population,
  approvedCandidateIds,
  baseCommitSha,
  registryPath
) {
  if (population.prerequisiteMode === CANDIDATE_REVIEW_SYNTHETIC_PREREQUISITE_BYPASS) {
    if (rawPatches !== undefined
      && (!Array.isArray(rawPatches) || rawPatches.length !== 0)) {
      fail('SYNTHETIC_FIXTURE_REVIEW_PATCH_INPUT_REFUSED', '$.validatedReviewPatches');
    }
    return { patches: [], bindings: [] };
  }
  if (!Array.isArray(rawPatches) || rawPatches.length === 0) {
    fail('VALIDATED_REVIEW_PATCHES_REQUIRED_FOR_REAL_SUITABILITY', '$.validatedReviewPatches');
  }
  const populationById = new Map(population.candidates.map((candidate) => [candidate.candidateId, candidate]));
  const approvedSet = new Set(approvedCandidateIds);
  const seenPatchIds = new Set();
  const seenApprovedIds = new Set();
  const records = rawPatches.map((rawPatch, index) => {
    let patch;
    try {
      patch = validateReviewPatch(rawPatch);
    } catch (error) {
      fail(error?.code || 'INVALID_REVIEW_PATCH', `$.validatedReviewPatches[${index}]${error?.path ? `:${error.path}` : ''}`);
    }
    if (seenPatchIds.has(patch.patchId)) fail('DUPLICATE_REVIEW_PATCH_ID', `$.validatedReviewPatches[${index}].patchId`);
    seenPatchIds.add(patch.patchId);
    if (patch.base.commitSha !== baseCommitSha || patch.base.registryPath !== registryPath) {
      fail('REVIEW_PATCH_DESTINATION_BINDING_MISMATCH', `$.validatedReviewPatches[${index}].base`);
    }
    const serializedBytes = Buffer.byteLength(canonicalStringify(patch), 'utf8');
    if (serializedBytes > CANDIDATE_REVIEW_LIMITS.maxShardSerializedBytes) {
      fail('REVIEW_PATCH_EXCEEDS_DETAILED_LEDGER_FILE_CAP', `$.validatedReviewPatches[${index}]`);
    }
    const patchApprovedIds = patch.approvedCandidates
      .map((record) => record.candidate.candidateId)
      .sort(compareAscii);
    for (const candidateId of patchApprovedIds) {
      if (!approvedSet.has(candidateId)) {
        fail('REVIEW_PATCH_APPROVAL_NOT_DECLARED_SUITABLE', `$.validatedReviewPatches[${index}].approvedCandidates`);
      }
      if (seenApprovedIds.has(candidateId)) {
        fail('REVIEW_PATCH_APPROVAL_DUPLICATED', `$.validatedReviewPatches[${index}].approvedCandidates`);
      }
      const expectedCandidate = populationById.get(candidateId);
      const actualCandidate = patch.approvedCandidates.find((record) => (
        record.candidate.candidateId === candidateId
      )).candidate;
      if (!expectedCandidate || canonicalStringify(actualCandidate) !== canonicalStringify(expectedCandidate)) {
        fail('REVIEW_PATCH_CANDIDATE_BINDING_MISMATCH', `$.validatedReviewPatches[${index}].approvedCandidates`);
      }
      seenApprovedIds.add(candidateId);
    }
    const candidateIds = [...new Set([
      ...patchApprovedIds,
      ...patch.relationshipReviews.map((record) => record.candidate.candidateId)
    ])].sort(compareAscii);
    return {
      patch,
      binding: {
        patchId: patch.patchId,
        patchHash: sha256(patch),
        approvedCandidateIds: patchApprovedIds,
        candidateIds,
        serializedBytes
      }
    };
  }).sort((left, right) => compareAscii(left.patch.patchId, right.patch.patchId));
  if (canonicalStringify([...seenApprovedIds].sort(compareAscii))
    !== canonicalStringify(approvedCandidateIds)) {
    fail('REVIEW_PATCH_APPROVAL_SET_MISMATCH', '$.validatedReviewPatches');
  }
  for (const component of population.components) {
    const componentApprovedIds = component.candidateIds.filter((candidateId) => approvedSet.has(candidateId));
    if (componentApprovedIds.length === 0) continue;
    const owning = records.filter(({ binding }) => (
      componentApprovedIds.some((candidateId) => binding.approvedCandidateIds.includes(candidateId))
    ));
    if (owning.length !== 1
      || component.candidateIds.some((candidateId) => !owning[0].binding.candidateIds.includes(candidateId))) {
      fail('REVIEW_PATCH_SPLITS_RELATIONSHIP_COMPONENT', `$.components.${component.componentId}`);
    }
  }
  return {
    patches: records.map(({ patch }) => patch),
    bindings: records.map(({ binding }) => binding)
  };
}

function patchShardBase({
  index,
  population,
  decisionSetHash,
  baseCommitSha,
  registryPath,
  components,
  approvedSet,
  excerptsByCandidateId
}) {
  const candidateIds = components.flatMap((component) => component.candidateIds).sort(compareAscii);
  const candidateSet = new Set(candidateIds);
  const approvedCandidateIds = candidateIds.filter((candidateId) => approvedSet.has(candidateId));
  const relationshipIds = population.relationshipReport.relationships
    .filter((relationship) => relationship.candidateIds.some((candidateId) => candidateSet.has(candidateId)))
    .map((relationship) => relationship.relationshipId)
    .sort(compareAscii);
  const excerpts = approvedCandidateIds.map((candidateId) => ({
    candidateId,
    excerpt: excerptsByCandidateId[candidateId],
    sourceReopenConfirmed: true
  }));
  const excerptCodePoints = excerpts.reduce((sum, item) => sum + countCodePoints(item.excerpt), 0);
  return {
    schemaVersion: CANDIDATE_REVIEW_PATCH_SHARD_SCHEMA_VERSION,
    ...BOUNDARY,
    shardNumber: index,
    populationHash: population.populationHash,
    roundId: population.roundId,
    decisionSetHash,
    baseCommitSha,
    registryPath,
    sourceReopenRequired: true,
    candidateIds,
    approvedCandidateIds,
    relationshipIds,
    excerpts,
    excerptCodePoints
  };
}

function finalizePatchShard(base) {
  const shardHash = sha256(base);
  const withHash = {
    ...base,
    shardId: `patchshard_${shardHash}`,
    shardHash
  };
  const serializedBytes = Buffer.byteLength(canonicalStringify(withHash), 'utf8');
  return { ...withHash, serializedBytes };
}

export function createCandidateReviewPatchSet({
  population: rawPopulation,
  decisionSetHash,
  approvedCandidateIds: rawApprovedCandidateIds,
  excerptsByCandidateId,
  sourceReopenByCandidateId,
  baseCommitSha,
  registryPath,
  validatedReviewPatches
} = {}) {
  assertExactKeys(arguments[0] ?? {}, {
    required: [
      'population',
      'decisionSetHash',
      'approvedCandidateIds',
      'excerptsByCandidateId',
      'sourceReopenByCandidateId',
      'baseCommitSha',
      'registryPath'
    ],
    optional: ['validatedReviewPatches']
  }, '$');
  assertSafeInput({
    decisionSetHash,
    approvedCandidateIds: rawApprovedCandidateIds,
    excerptsByCandidateId,
    sourceReopenByCandidateId,
    baseCommitSha,
    registryPath
  }, '$');
  const population = validateCandidateReviewPopulation(rawPopulation);
  assertSha256(decisionSetHash, '$.decisionSetHash');
  assertCommitSha(baseCommitSha, '$.baseCommitSha');
  if (typeof registryPath !== 'string'
    || !SAFE_REGISTRY_PATH.test(registryPath)
    || registryPath.includes('..')
    || registryPath.includes('//')) {
    fail('REGISTRY_PATH_REFUSED', '$.registryPath');
  }
  const approvedCandidateIds = normalizeSortedUnique(rawApprovedCandidateIds, '$.approvedCandidateIds', {
    pattern: CANDIDATE_ID,
    min: 1,
    max: CANDIDATE_REVIEW_LIMITS.maxPopulationCandidates
  });
  const populationIds = new Set(population.candidates.map((candidate) => candidate.candidateId));
  if (approvedCandidateIds.some((candidateId) => !populationIds.has(candidateId))) {
    fail('PATCH_CANDIDATE_NOT_IN_POPULATION', '$.approvedCandidateIds');
  }
  if (!isPlainObject(excerptsByCandidateId) || !isPlainObject(sourceReopenByCandidateId)
    || canonicalStringify(Object.keys(excerptsByCandidateId).sort(compareAscii)) !== canonicalStringify(approvedCandidateIds)
    || canonicalStringify(Object.keys(sourceReopenByCandidateId).sort(compareAscii)) !== canonicalStringify(approvedCandidateIds)) {
    fail('PATCH_ENTRY_SET_MISMATCH', '$');
  }
  for (const candidateId of approvedCandidateIds) {
    const excerpt = excerptsByCandidateId[candidateId];
    if (typeof excerpt !== 'string' || excerpt.length === 0
      || countCodePoints(excerpt) > CANDIDATE_REVIEW_LIMITS.maxExcerptCodePoints) {
      fail('PATCH_EXCERPT_OUT_OF_RANGE', `$.excerptsByCandidateId.${candidateId}`);
    }
    assertReviewSafe(excerpt, `$.excerptsByCandidateId.${candidateId}`);
    if (sourceReopenByCandidateId[candidateId] !== true) {
      fail('SOURCE_REOPEN_CONFIRMATION_REQUIRED', `$.sourceReopenByCandidateId.${candidateId}`);
    }
    if (population.prerequisiteMode === 'FULL_FIDELITY_AND_SECTION5_BINDINGS') {
      const record = population.candidateRecords.find((item) => item.candidate.candidateId === candidateId);
      if (!record || sha256(excerpt) !== record.anchor.quoteSha256) {
        fail('PATCH_EXCERPT_ANCHOR_HASH_MISMATCH', `$.excerptsByCandidateId.${candidateId}`);
      }
      if (countCodePoints(excerpt) === record.page.pageCodePointLength) {
        fail('FULL_PAGE_EXCERPT_REFUSED', `$.excerptsByCandidateId.${candidateId}`);
      }
    }
  }

  const approvedSet = new Set(approvedCandidateIds);
  const reviewPatchRecords = normalizeValidatedReviewPatches(
    validatedReviewPatches,
    population,
    approvedCandidateIds,
    baseCommitSha,
    registryPath
  );
  const owningComponents = population.components.filter((component) => (
    component.candidateIds.some((candidateId) => approvedSet.has(candidateId))
  ));
  const shardComponentGroups = [];
  let current = [];
  for (const component of owningComponents) {
    const attempt = [...current, component];
    const attemptBase = patchShardBase({
      index: shardComponentGroups.length + 1,
      population,
      decisionSetHash,
      baseCommitSha,
      registryPath,
      components: attempt,
      approvedSet,
      excerptsByCandidateId
    });
    const attemptShard = finalizePatchShard(attemptBase);
    const exceeds = attemptShard.excerptCodePoints > CANDIDATE_REVIEW_LIMITS.maxShardExcerptCodePoints
      || attemptShard.approvedCandidateIds.length > CANDIDATE_REVIEW_LIMITS.maxApprovedCandidatesPerShard
      || attemptShard.serializedBytes > CANDIDATE_REVIEW_LIMITS.maxShardSerializedBytes;
    if (!exceeds) {
      current = attempt;
      continue;
    }
    if (current.length === 0) fail('RELATIONSHIP_COMPONENT_EXCEEDS_PATCH_SHARD_LIMIT', `$.components.${component.componentId}`);
    shardComponentGroups.push(current);
    current = [component];
    const single = finalizePatchShard(patchShardBase({
      index: shardComponentGroups.length + 1,
      population,
      decisionSetHash,
      baseCommitSha,
      registryPath,
      components: current,
      approvedSet,
      excerptsByCandidateId
    }));
    if (single.excerptCodePoints > CANDIDATE_REVIEW_LIMITS.maxShardExcerptCodePoints
      || single.approvedCandidateIds.length > CANDIDATE_REVIEW_LIMITS.maxApprovedCandidatesPerShard
      || single.serializedBytes > CANDIDATE_REVIEW_LIMITS.maxShardSerializedBytes) {
      fail('RELATIONSHIP_COMPONENT_EXCEEDS_PATCH_SHARD_LIMIT', `$.components.${component.componentId}`);
    }
  }
  if (current.length > 0) shardComponentGroups.push(current);
  const shards = shardComponentGroups.map((components, index) => finalizePatchShard(patchShardBase({
    index: index + 1,
    population,
    decisionSetHash,
    baseCommitSha,
    registryPath,
    components,
    approvedSet,
    excerptsByCandidateId
  })));
  const manifestBase = {
    schemaVersion: CANDIDATE_REVIEW_PATCH_SET_SCHEMA_VERSION,
    ...BOUNDARY,
    populationHash: population.populationHash,
    roundId: population.roundId,
    decisionSetHash,
    baseCommitSha,
    registryPath,
    sourceReopenRequired: true,
    prerequisiteMode: population.prerequisiteMode,
    syntheticFixtureOnly: population.prerequisiteMode === CANDIDATE_REVIEW_SYNTHETIC_PREREQUISITE_BYPASS,
    realReviewPatchValidation: population.prerequisiteMode === CANDIDATE_REVIEW_SYNTHETIC_PREREQUISITE_BYPASS
      ? 'NOT_APPLICABLE_SYNTHETIC_FIXTURE'
      : 'VALIDATED_CLAIM_REGISTRY_REVIEW_PATCH_V0',
    approvedCandidateIds,
    validatedReviewPatches: reviewPatchRecords.patches,
    validatedReviewPatchBindings: reviewPatchRecords.bindings,
    shardCount: shards.length,
    shards
  };
  const output = {
    ...manifestBase,
    patchSetHash: sha256(manifestBase)
  };
  if (Buffer.byteLength(canonicalStringify(output), 'utf8') > CANDIDATE_REVIEW_LIMITS.maxPackageSerializedBytes) {
    fail('PATCH_SET_PACKAGE_LIMIT_EXCEEDED', '$');
  }
  return validateCandidateReviewPatchSet(output, { population });
}

export function validateCandidateReviewPatchSet(rawPatchSet, { population: rawPopulation } = {}) {
  if (!isPlainObject(rawPatchSet)) fail('OBJECT_REQUIRED', '$');
  try {
    assertSafeArtifact(rawPatchSet, '$');
  } catch (error) {
    fail(error?.code || 'UNSAFE_ARTIFACT_REFUSED', error?.path || '$');
  }
  const patchSafetyProjection = {
    ...rawPatchSet,
    validatedReviewPatches: Array.isArray(rawPatchSet.validatedReviewPatches)
      ? rawPatchSet.validatedReviewPatches.map((patch) => ({ patchId: patch?.patchId }))
      : rawPatchSet.validatedReviewPatches
  };
  assertReviewSafe(patchSafetyProjection, '$');
  assertExactKeys(rawPatchSet, {
    required: [
      'schemaVersion',
      ...BOUNDARY_KEYS,
      'populationHash',
      'roundId',
      'decisionSetHash',
      'baseCommitSha',
      'registryPath',
      'sourceReopenRequired',
      'prerequisiteMode',
      'syntheticFixtureOnly',
      'realReviewPatchValidation',
      'approvedCandidateIds',
      'validatedReviewPatches',
      'validatedReviewPatchBindings',
      'shardCount',
      'shards',
      'patchSetHash'
    ]
  }, '$');
  if (rawPatchSet.schemaVersion !== CANDIDATE_REVIEW_PATCH_SET_SCHEMA_VERSION) fail('UNSUPPORTED_PATCH_SET_SCHEMA', '$.schemaVersion');
  assertBoundary(rawPatchSet);
  const population = validateCandidateReviewPopulation(rawPopulation);
  if (rawPatchSet.populationHash !== population.populationHash || rawPatchSet.roundId !== population.roundId) {
    fail('PATCH_SET_POPULATION_BINDING_MISMATCH', '$');
  }
  assertSha256(rawPatchSet.decisionSetHash, '$.decisionSetHash');
  assertCommitSha(rawPatchSet.baseCommitSha, '$.baseCommitSha');
  if (typeof rawPatchSet.registryPath !== 'string'
    || !SAFE_REGISTRY_PATH.test(rawPatchSet.registryPath)
    || rawPatchSet.registryPath.includes('..')
    || rawPatchSet.registryPath.includes('//')) {
    fail('REGISTRY_PATH_REFUSED', '$.registryPath');
  }
  if (rawPatchSet.sourceReopenRequired !== true) fail('SOURCE_REOPEN_REQUIREMENT_REQUIRED', '$.sourceReopenRequired');
  if (rawPatchSet.prerequisiteMode !== population.prerequisiteMode
    || rawPatchSet.syntheticFixtureOnly !== (
      population.prerequisiteMode === CANDIDATE_REVIEW_SYNTHETIC_PREREQUISITE_BYPASS
    )
    || rawPatchSet.realReviewPatchValidation !== (
      population.prerequisiteMode === CANDIDATE_REVIEW_SYNTHETIC_PREREQUISITE_BYPASS
        ? 'NOT_APPLICABLE_SYNTHETIC_FIXTURE'
        : 'VALIDATED_CLAIM_REGISTRY_REVIEW_PATCH_V0'
    )) {
    fail('PATCH_SET_PREREQUISITE_MODE_MISMATCH', '$');
  }
  const approvedCandidateIds = normalizeSortedUnique(rawPatchSet.approvedCandidateIds, '$.approvedCandidateIds', {
    pattern: CANDIDATE_ID,
    min: 1,
    max: CANDIDATE_REVIEW_LIMITS.maxPopulationCandidates
  });
  const reviewPatchRecords = normalizeValidatedReviewPatches(
    rawPatchSet.validatedReviewPatches,
    population,
    approvedCandidateIds,
    rawPatchSet.baseCommitSha,
    rawPatchSet.registryPath
  );
  if (canonicalStringify(rawPatchSet.validatedReviewPatchBindings)
    !== canonicalStringify(reviewPatchRecords.bindings)) {
    fail('VALIDATED_REVIEW_PATCH_BINDING_MISMATCH', '$.validatedReviewPatchBindings');
  }
  if (!Array.isArray(rawPatchSet.shards)
    || rawPatchSet.shards.length === 0
    || rawPatchSet.shardCount !== rawPatchSet.shards.length) {
    fail('INVALID_PATCH_SHARD_COUNT', '$.shards');
  }
  const componentByCandidateId = new Map();
  for (const component of population.components) {
    for (const candidateId of component.candidateIds) componentByCandidateId.set(candidateId, component.componentId);
  }
  const shardByComponent = new Map();
  const seenApproved = [];
  let priorShardId = '';
  for (const [index, shard] of rawPatchSet.shards.entries()) {
    const path = `$.shards[${index}]`;
    assertExactKeys(shard, {
      required: [
        'schemaVersion',
        ...BOUNDARY_KEYS,
        'shardNumber',
        'populationHash',
        'roundId',
        'decisionSetHash',
        'baseCommitSha',
        'registryPath',
        'sourceReopenRequired',
        'candidateIds',
        'approvedCandidateIds',
        'relationshipIds',
        'excerpts',
        'excerptCodePoints',
        'shardId',
        'shardHash',
        'serializedBytes'
      ]
    }, path);
    if (shard.schemaVersion !== CANDIDATE_REVIEW_PATCH_SHARD_SCHEMA_VERSION) fail('UNSUPPORTED_PATCH_SHARD_SCHEMA', `${path}.schemaVersion`);
    assertBoundary(shard, path);
    if (shard.shardNumber !== index + 1
      || shard.populationHash !== population.populationHash
      || shard.roundId !== population.roundId
      || shard.decisionSetHash !== rawPatchSet.decisionSetHash
      || shard.baseCommitSha !== rawPatchSet.baseCommitSha
      || shard.registryPath !== rawPatchSet.registryPath
      || shard.sourceReopenRequired !== true) {
      fail('PATCH_SHARD_BINDING_MISMATCH', path);
    }
    const candidateIds = normalizeSortedUnique(shard.candidateIds, `${path}.candidateIds`, {
      pattern: CANDIDATE_ID,
      min: 1,
      max: population.candidateCount
    });
    const shardApproved = normalizeSortedUnique(shard.approvedCandidateIds, `${path}.approvedCandidateIds`, {
      pattern: CANDIDATE_ID,
      min: 1,
      max: population.candidateCount
    });
    if (shardApproved.some((candidateId) => !candidateIds.includes(candidateId))) {
      fail('PATCH_SHARD_APPROVAL_NOT_MEMBER', `${path}.approvedCandidateIds`);
    }
    for (const candidateId of candidateIds) {
      const componentId = componentByCandidateId.get(candidateId);
      if (!componentId) fail('PATCH_SHARD_CANDIDATE_UNKNOWN', `${path}.candidateIds`);
      const component = population.components.find((item) => item.componentId === componentId);
      if (component.candidateIds.some((member) => !candidateIds.includes(member))) {
        fail('PATCH_SHARD_SPLITS_RELATIONSHIP_COMPONENT', `${path}.candidateIds`);
      }
      const prior = shardByComponent.get(componentId);
      if (prior !== undefined && prior !== index) fail('PATCH_COMPONENT_DUPLICATED_ACROSS_SHARDS', `${path}.candidateIds`);
      shardByComponent.set(componentId, index);
    }
    const expectedRelationshipIds = population.relationshipReport.relationships
      .filter((relationship) => relationship.candidateIds.some((candidateId) => candidateIds.includes(candidateId)))
      .map((relationship) => relationship.relationshipId)
      .sort(compareAscii);
    if (canonicalStringify(shard.relationshipIds) !== canonicalStringify(expectedRelationshipIds)) {
      fail('PATCH_SHARD_RELATIONSHIP_SET_MISMATCH', `${path}.relationshipIds`);
    }
    if (!Array.isArray(shard.excerpts)
      || canonicalStringify(shard.excerpts.map((item) => item.candidateId)) !== canonicalStringify(shardApproved)) {
      fail('PATCH_SHARD_EXCERPT_SET_MISMATCH', `${path}.excerpts`);
    }
    let excerptCodePoints = 0;
    for (const [entryIndex, entry] of shard.excerpts.entries()) {
      const entryPath = `${path}.excerpts[${entryIndex}]`;
      assertExactKeys(entry, {
        required: ['candidateId', 'excerpt', 'sourceReopenConfirmed']
      }, entryPath);
      if (typeof entry.excerpt !== 'string' || entry.excerpt.length === 0
        || countCodePoints(entry.excerpt) > CANDIDATE_REVIEW_LIMITS.maxExcerptCodePoints
        || entry.sourceReopenConfirmed !== true) {
        fail('INVALID_PATCH_EXCERPT', entryPath);
      }
      assertReviewSafe(entry.excerpt, `${entryPath}.excerpt`);
      if (population.prerequisiteMode === 'FULL_FIDELITY_AND_SECTION5_BINDINGS') {
        const record = population.candidateRecords.find((item) => (
          item.candidate.candidateId === entry.candidateId
        ));
        if (!record || sha256(entry.excerpt) !== record.anchor.quoteSha256) {
          fail('PATCH_EXCERPT_ANCHOR_HASH_MISMATCH', `${entryPath}.excerpt`);
        }
        if (countCodePoints(entry.excerpt) === record.page.pageCodePointLength) {
          fail('FULL_PAGE_EXCERPT_REFUSED', `${entryPath}.excerpt`);
        }
      }
      excerptCodePoints += countCodePoints(entry.excerpt);
    }
    if (excerptCodePoints !== shard.excerptCodePoints
      || excerptCodePoints > CANDIDATE_REVIEW_LIMITS.maxShardExcerptCodePoints
      || shardApproved.length > CANDIDATE_REVIEW_LIMITS.maxApprovedCandidatesPerShard) {
      fail('PATCH_SHARD_LIMIT_EXCEEDED', path);
    }
    const base = Object.fromEntries(Object.entries(shard).filter(([key]) => !['shardId', 'shardHash', 'serializedBytes'].includes(key)));
    const expectedHash = sha256(base);
    const withoutBytes = { ...base, shardId: `patchshard_${expectedHash}`, shardHash: expectedHash };
    const expectedBytes = Buffer.byteLength(canonicalStringify(withoutBytes), 'utf8');
    if (shard.shardHash !== expectedHash
      || shard.shardId !== `patchshard_${expectedHash}`
      || shard.serializedBytes !== expectedBytes
      || shard.serializedBytes > CANDIDATE_REVIEW_LIMITS.maxShardSerializedBytes) {
      fail('PATCH_SHARD_HASH_OR_SIZE_MISMATCH', path);
    }
    if (priorShardId && compareAscii(priorShardId, shard.shardId) >= 0) {
      // Shards are numbered by deterministic component packing. Their IDs need
      // not sort by hash; the manifest order is the canonical shard number.
    }
    priorShardId = shard.shardId;
    seenApproved.push(...shardApproved);
  }
  if (canonicalStringify(seenApproved.sort(compareAscii)) !== canonicalStringify(approvedCandidateIds)) {
    fail('PATCH_SET_APPROVED_MEMBERSHIP_MISMATCH', '$.shards');
  }
  for (const relationship of population.relationshipReport.relationships) {
    const approvedParticipants = relationship.candidateIds.filter((candidateId) => approvedCandidateIds.includes(candidateId));
    if (approvedParticipants.length === 0) continue;
    const shardIndexes = new Set(relationship.candidateIds.map((candidateId) => (
      shardByComponent.get(componentByCandidateId.get(candidateId))
    )));
    if (shardIndexes.size !== 1 || shardIndexes.has(undefined)) {
      fail('CROSS_SHARD_RELATIONSHIP_LOSS', `$.relationships.${relationship.relationshipId}`);
    }
  }
  const base = Object.fromEntries(Object.entries(rawPatchSet).filter(([key]) => key !== 'patchSetHash'));
  if (rawPatchSet.patchSetHash !== sha256(base)) fail('PATCH_SET_HASH_MISMATCH', '$.patchSetHash');
  if (Buffer.byteLength(canonicalStringify(rawPatchSet), 'utf8') > CANDIDATE_REVIEW_LIMITS.maxPackageSerializedBytes) {
    fail('PATCH_SET_PACKAGE_LIMIT_EXCEEDED', '$');
  }
  return cloneFrozen(rawPatchSet);
}

export function reconcileCandidateReviewRound({
  population: rawPopulation,
  primarySubmission: rawPrimary,
  secondarySubmission: rawSecondary,
  patchSuitabilityByCandidateId,
  relationshipReport,
  roleSeparationAttested,
  patchSet: rawPatchSet
} = {}) {
  assertExactKeys(arguments[0] ?? {}, {
    required: [
      'population',
      'primarySubmission',
      'secondarySubmission',
      'patchSuitabilityByCandidateId',
      'roleSeparationAttested'
    ],
    optional: ['relationshipReport', 'patchSet']
  }, '$');
  assertSafeInput(arguments[0], '$');
  const population = validateCandidateReviewPopulation(rawPopulation);
  if (roleSeparationAttested !== true) fail('ROLE_SEPARATION_ATTESTATION_REQUIRED', '$.roleSeparationAttested');
  const primary = validateCandidateReviewRoleSubmission(rawPrimary, { population });
  const secondary = validateCandidateReviewRoleSubmission(rawSecondary, { population });
  if (primary.role !== 'PRIMARY_TECHNICAL_REVIEWER'
    || secondary.role !== 'SECONDARY_EVIDENCE_REVIEWER'
    || primary.assignmentHash !== secondary.assignmentHash) {
    fail('EXACT_ROLE_PAIR_REQUIRED', '$');
  }
  if (primary.rows.length + secondary.rows.length !== population.candidateCount * 2
    || primary.rows.length + secondary.rows.length > CANDIDATE_REVIEW_LIMITS.maxRoleRows) {
    fail('EXACT_TWO_ROLE_ROWS_PER_CANDIDATE_REQUIRED', '$');
  }
  if (relationshipReport !== undefined
    && canonicalStringify(relationshipReport) !== canonicalStringify(population.relationshipReport)) {
    fail('RELATIONSHIP_REPORT_MISMATCH', '$.relationshipReport');
  }
  const suitability = normalizePatchSuitabilityMap(patchSuitabilityByCandidateId, population);
  const primaryById = new Map(primary.rows.map((row) => [row.candidateId, row]));
  const secondaryById = new Map(secondary.rows.map((row) => [row.candidateId, row]));
  const limitationRequired = new Set(population.limitationSafetyRequiredCandidateIds);
  const pairByCandidateId = new Map(population.candidates.map((candidate) => [
    candidate.candidateId,
    {
      candidate,
      primaryRow: primaryById.get(candidate.candidateId),
      secondaryRow: secondaryById.get(candidate.candidateId),
      ...reconcileRolePair(
        candidate,
        primaryById.get(candidate.candidateId),
        secondaryById.get(candidate.candidateId),
        limitationRequired.has(candidate.candidateId)
      )
    }
  ]));
  const relationshipClosures = population.relationshipReport.relationships
    .map((relationship) => relationshipClosure(relationship, pairByCandidateId))
    .sort((left, right) => compareAscii(left.relationshipId, right.relationshipId));
  const unresolvedCandidateIds = new Set(relationshipClosures
    .filter((closure) => closure.status === 'UNRESOLVED')
    .flatMap((closure) => closure.candidateIds));
  for (const candidateId of unresolvedCandidateIds) {
    const component = population.components.find((item) => item.candidateIds.includes(candidateId));
    component.candidateIds.forEach((member) => unresolvedCandidateIds.add(member));
  }
  const relationshipClosureBase = {
    schemaVersion: 'pr207-candidate-review-relationship-closure-v2',
    ...BOUNDARY,
    populationHash: population.populationHash,
    closures: relationshipClosures,
    unresolvedCandidateIds: [...unresolvedCandidateIds].sort(compareAscii)
  };
  const relationshipClosureReport = {
    ...relationshipClosureBase,
    reportHash: sha256(relationshipClosureBase)
  };
  const decisionSetHash = computeCandidateReviewDecisionSetHash({
    population,
    primarySubmission: primary,
    secondarySubmission: secondary
  });
  const provisionalCandidateIds = [...pairByCandidateId.values()]
    .filter((pair) => pair.provisionalTechnicalApproval && !unresolvedCandidateIds.has(pair.candidate.candidateId))
    .map((pair) => pair.candidate.candidateId)
    .sort(compareAscii);
  for (const candidate of population.candidates) {
    const isProvisional = provisionalCandidateIds.includes(candidate.candidateId);
    if (isProvisional && suitability[candidate.candidateId] === 'NOT_APPLICABLE_NO_APPROVED_PATCH') {
      fail('PROVISIONAL_APPROVAL_REQUIRES_PATCH_ASSESSMENT', `$.patchSuitabilityByCandidateId.${candidate.candidateId}`);
    }
    if (!isProvisional && suitability[candidate.candidateId] !== 'NOT_APPLICABLE_NO_APPROVED_PATCH') {
      fail('NONPROVISIONAL_PATCH_ASSESSMENT_REFUSED', `$.patchSuitabilityByCandidateId.${candidate.candidateId}`);
    }
  }
  const suitableCandidateIds = provisionalCandidateIds.filter((candidateId) => (
    suitability[candidateId] === 'SUITABLE_FOR_REPOSITORY_REVIEW'
  ));
  let patchSet = null;
  if (suitableCandidateIds.length > 0) {
    if (!rawPatchSet) fail('VALIDATED_PATCH_SET_REQUIRED_FOR_SUITABLE_OUTCOME', '$.patchSet');
    patchSet = validateCandidateReviewPatchSet(rawPatchSet, { population });
    if (patchSet.decisionSetHash !== decisionSetHash
      || canonicalStringify(patchSet.approvedCandidateIds) !== canonicalStringify(suitableCandidateIds)) {
      fail('PATCH_SET_SUITABILITY_BINDING_MISMATCH', '$.patchSet');
    }
  } else if (rawPatchSet !== undefined && rawPatchSet !== null) {
    fail('PATCH_SET_WITHOUT_SUITABLE_CANDIDATE_REFUSED', '$.patchSet');
  }

  const finalOutcomes = population.candidates.map((candidate) => {
    const pair = pairByCandidateId.get(candidate.candidateId);
    let outcome;
    let reasonCodes = pair.reasonCodes;
    let canonicalDecision = pair.canonicalDecision;
    let provisionalTechnicalApproval = pair.provisionalTechnicalApproval;
    if (unresolvedCandidateIds.has(candidate.candidateId)) {
      outcome = 'CONFLICTED';
      reasonCodes = ['RELATIONSHIP_CLOSURE_UNRESOLVED'];
      canonicalDecision = null;
      provisionalTechnicalApproval = false;
    } else if (pair.baseOutcome === 'CONFLICTED') {
      outcome = 'CONFLICTED';
    } else if (pair.baseOutcome === 'REJECTED') {
      outcome = 'REJECTED';
    } else if (pair.baseOutcome === 'HELD') {
      outcome = 'HELD';
    } else if (suitability[candidate.candidateId] === 'SUITABLE_FOR_REPOSITORY_REVIEW') {
      outcome = 'APPROVED';
    } else {
      outcome = 'HELD';
      reasonCodes = suitability[candidate.candidateId] === 'NOT_SUITABLE_FOR_REPOSITORY_REVIEW'
        ? ['PATCH_NOT_SUITABLE_FOR_REPOSITORY_REVIEW']
        : ['PATCH_REVIEW_INCOMPLETE'];
    }
    const component = population.components.find((item) => item.candidateIds.includes(candidate.candidateId));
    const componentClosures = relationshipClosures.filter((closure) => (
      closure.candidateIds.some((candidateId) => component.candidateIds.includes(candidateId))
    ));
    const componentRelationshipClosureHash = sha256({
      componentId: component.componentId,
      closures: componentClosures
    });
    const patchSuitability = provisionalTechnicalApproval
      ? suitability[candidate.candidateId]
      : 'NOT_APPLICABLE_NO_APPROVED_PATCH';
    const base = {
      candidateId: candidate.candidateId,
      productFamily: candidate.subject.id,
      primaryReviewRowId: pair.primaryRow.reviewRowId,
      secondaryReviewRowId: pair.secondaryRow.reviewRowId,
      outcome,
      reasonCodes,
      relatedCandidateIds: pair.relatedCandidateIds,
      provisionalTechnicalApproval,
      patchSuitability,
      decisionAgreement: pair.decisionAgreement,
      componentId: component.componentId,
      componentRelationshipClosureHash,
      canonicalDecision
    };
    return {
      finalOutcomeId: `finaloutcome_${sha256(base)}`,
      ...base
    };
  });
  const finalDecisionSetHash = sha256(finalOutcomes);
  const base = {
    schemaVersion: CANDIDATE_REVIEW_RECONCILIATION_SCHEMA_VERSION,
    ...BOUNDARY,
    roundId: population.roundId,
    populationHash: population.populationHash,
    assignmentHash: primary.assignmentHash,
    roleSeparationAttested: true,
    primarySubmissionHash: primary.submissionHash,
    secondarySubmissionHash: secondary.submissionHash,
    decisionSetHash,
    relationshipClosureReport,
    patchSuitabilityByCandidateId: suitability,
    patchSet,
    patchSetHash: patchSet?.patchSetHash ?? null,
    finalOutcomes,
    finalDecisionSetHash
  };
  return cloneFrozen({
    ...base,
    reconciliationHash: sha256(base)
  });
}

export function validateCandidateReviewReconciliation(rawReconciliation, {
  population,
  primarySubmission,
  secondarySubmission
} = {}) {
  assertSafeInput(rawReconciliation, '$');
  assertExactKeys(rawReconciliation, {
    required: [
      'schemaVersion',
      ...BOUNDARY_KEYS,
      'roundId',
      'populationHash',
      'assignmentHash',
      'roleSeparationAttested',
      'primarySubmissionHash',
      'secondarySubmissionHash',
      'decisionSetHash',
      'relationshipClosureReport',
      'patchSuitabilityByCandidateId',
      'patchSet',
      'patchSetHash',
      'finalOutcomes',
      'finalDecisionSetHash',
      'reconciliationHash'
    ]
  }, '$');
  if (rawReconciliation.schemaVersion !== CANDIDATE_REVIEW_RECONCILIATION_SCHEMA_VERSION) {
    fail('UNSUPPORTED_RECONCILIATION_SCHEMA', '$.schemaVersion');
  }
  assertBoundary(rawReconciliation);
  const recomputed = reconcileCandidateReviewRound({
    population,
    primarySubmission,
    secondarySubmission,
    patchSuitabilityByCandidateId: rawReconciliation.patchSuitabilityByCandidateId,
    relationshipReport: validateCandidateReviewPopulation(population).relationshipReport,
    roleSeparationAttested: rawReconciliation.roleSeparationAttested,
    ...(rawReconciliation.patchSet === null ? {} : { patchSet: rawReconciliation.patchSet })
  });
  if (canonicalStringify(rawReconciliation) !== canonicalStringify(recomputed)) {
    fail('RECONCILIATION_CONTENT_MISMATCH', '$');
  }
  return recomputed;
}

function basisPoints(numerator, denominator) {
  return denominator > 0 ? Math.floor(10_000 * numerator / denominator) : null;
}

function median(values) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function normalizeFinalOutcomes(rawFinalOutcomes, population, primary, secondary) {
  const source = isPlainObject(rawFinalOutcomes) && Array.isArray(rawFinalOutcomes.finalOutcomes)
    ? rawFinalOutcomes.finalOutcomes
    : null;
  if (!source || source.length !== population.candidateCount) fail('EXACT_FINAL_OUTCOME_SET_REQUIRED', '$.finalOutcomes');
  const primaryById = new Map(primary.rows.map((row) => [row.candidateId, row]));
  const secondaryById = new Map(secondary.rows.map((row) => [row.candidateId, row]));
  const candidateById = new Map(population.candidates.map((candidate) => [candidate.candidateId, candidate]));
  const outcomes = source.map((outcome, index) => {
    const path = `$.finalOutcomes[${index}]`;
    assertExactKeys(outcome, {
      required: [
        'finalOutcomeId',
        'candidateId',
        'productFamily',
        'primaryReviewRowId',
        'secondaryReviewRowId',
        'outcome',
        'reasonCodes',
        'relatedCandidateIds',
        'provisionalTechnicalApproval',
        'patchSuitability',
        'decisionAgreement',
        'componentId',
        'componentRelationshipClosureHash',
        'canonicalDecision'
      ]
    }, path);
    const candidate = candidateById.get(outcome.candidateId);
    if (!candidate || outcome.productFamily !== candidate.subject.id) fail('FINAL_OUTCOME_CANDIDATE_BINDING_MISMATCH', path);
    if (!CANDIDATE_REVIEW_FINAL_OUTCOMES.includes(outcome.outcome)
      || !CANDIDATE_REVIEW_PATCH_SUITABILITY.includes(outcome.patchSuitability)
      || typeof outcome.provisionalTechnicalApproval !== 'boolean'
      || typeof outcome.decisionAgreement !== 'boolean') {
      fail('INVALID_FINAL_OUTCOME', path);
    }
    const primaryRow = primaryById.get(outcome.candidateId);
    const secondaryRow = secondaryById.get(outcome.candidateId);
    if (outcome.primaryReviewRowId !== primaryRow.reviewRowId
      || outcome.secondaryReviewRowId !== secondaryRow.reviewRowId) {
      fail('FINAL_OUTCOME_ROLE_BINDING_MISMATCH', path);
    }
    const base = Object.fromEntries(Object.entries(outcome).filter(([key]) => key !== 'finalOutcomeId'));
    if (outcome.finalOutcomeId !== `finaloutcome_${sha256(base)}`) fail('FINAL_OUTCOME_ID_MISMATCH', `${path}.finalOutcomeId`);
    if (outcome.canonicalDecision !== null) {
      try {
        validateReviewDecision(outcome.canonicalDecision);
      } catch (error) {
        fail(error?.code || 'INVALID_CANONICAL_DECISION', `${path}.canonicalDecision`);
      }
    }
    return outcome;
  }).sort((left, right) => compareAscii(left.candidateId, right.candidateId));
  if (canonicalStringify(outcomes.map((outcome) => outcome.candidateId))
    !== canonicalStringify(population.candidates.map((candidate) => candidate.candidateId))) {
    fail('FINAL_OUTCOME_ORDER_OR_SET_MISMATCH', '$.finalOutcomes');
  }
  return outcomes;
}

function familyMetric(family, candidates, outcomes) {
  const ids = new Set(candidates.filter((candidate) => candidate.subject.id === family).map((candidate) => candidate.candidateId));
  const rows = outcomes.filter((outcome) => ids.has(outcome.candidateId));
  const approvedCount = rows.filter((outcome) => outcome.outcome === 'APPROVED').length;
  const rejected = rows.filter((outcome) => outcome.outcome === 'REJECTED');
  const provisionalTechnicalApprovalCount = rows.filter((outcome) => outcome.provisionalTechnicalApproval).length;
  const falsePositiveCount = rejected.filter((outcome) => (
    outcome.reasonCodes.some((reason) => FALSE_POSITIVE_REASONS.includes(reason))
  )).length;
  const policyRestrictedRejectCount = rejected.filter((outcome) => (
    !outcome.reasonCodes.some((reason) => FALSE_POSITIVE_REASONS.includes(reason))
    && canonicalStringify(outcome.reasonCodes) === canonicalStringify(['COPYRIGHT_OR_USE_RESTRICTED'])
  )).length;
  const precisionResolvedCount = provisionalTechnicalApprovalCount + falsePositiveCount;
  return {
    populationCount: rows.length,
    approvedCount,
    rejectedCount: rejected.length,
    heldCount: rows.filter((outcome) => outcome.outcome === 'HELD').length,
    conflictedCount: rows.filter((outcome) => outcome.outcome === 'CONFLICTED').length,
    provisionalTechnicalApprovalCount,
    falsePositiveCount,
    policyRestrictedRejectCount,
    precisionResolvedCount,
    reviewedSuggestionPrecisionBasisPoints: basisPoints(provisionalTechnicalApprovalCount, precisionResolvedCount),
    populationApprovalRateBasisPoints: basisPoints(approvedCount, rows.length)
  };
}

export function computeCandidateReviewMetrics({
  population: rawPopulation,
  finalOutcomes: rawFinalOutcomes,
  primarySubmission: rawPrimary,
  secondarySubmission: rawSecondary,
  qualityFindingCounts: rawQualityFindingCounts
} = {}) {
  assertExactKeys(arguments[0] ?? {}, {
    required: ['population', 'finalOutcomes', 'primarySubmission', 'secondarySubmission'],
    optional: ['qualityFindingCounts']
  }, '$');
  assertSafeInput(arguments[0], '$');
  const population = validateCandidateReviewPopulation(rawPopulation);
  const primary = validateCandidateReviewRoleSubmission(rawPrimary, { population });
  const secondary = validateCandidateReviewRoleSubmission(rawSecondary, { population });
  if (primary.role !== 'PRIMARY_TECHNICAL_REVIEWER'
    || secondary.role !== 'SECONDARY_EVIDENCE_REVIEWER'
    || primary.assignmentHash !== secondary.assignmentHash) {
    fail('EXACT_ROLE_PAIR_REQUIRED', '$');
  }
  if (!isPlainObject(rawFinalOutcomes)) fail('VALIDATED_RECONCILIATION_REQUIRED', '$.finalOutcomes');
  const reconciliation = validateCandidateReviewReconciliation(rawFinalOutcomes, {
    population,
    primarySubmission: primary,
    secondarySubmission: secondary
  });
  const outcomes = normalizeFinalOutcomes(reconciliation, population, primary, secondary);
  const approved = outcomes.filter((outcome) => outcome.outcome === 'APPROVED');
  const rejected = outcomes.filter((outcome) => outcome.outcome === 'REJECTED');
  const held = outcomes.filter((outcome) => outcome.outcome === 'HELD');
  const conflicted = outcomes.filter((outcome) => outcome.outcome === 'CONFLICTED');
  const provisional = outcomes.filter((outcome) => outcome.provisionalTechnicalApproval);
  const falsePositive = rejected.filter((outcome) => (
    outcome.reasonCodes.some((reason) => FALSE_POSITIVE_REASONS.includes(reason))
  ));
  const policyRestricted = rejected.filter((outcome) => (
    !outcome.reasonCodes.some((reason) => FALSE_POSITIVE_REASONS.includes(reason))
    && canonicalStringify(outcome.reasonCodes) === canonicalStringify(['COPYRIGHT_OR_USE_RESTRICTED'])
  ));
  if (falsePositive.length + policyRestricted.length !== rejected.length) {
    fail('REJECTION_CLASSIFICATION_INCOMPLETE', '$.finalOutcomes');
  }
  const precisionResolvedCount = provisional.length + falsePositive.length;
  const terminologyGapCount = held.filter((outcome) => (
    outcome.reasonCodes.includes('OUTER_V2_TERMINOLOGY_GAP')
  )).length;
  const patchSuitabilityCounts = {
    suitable: outcomes.filter((outcome) => outcome.patchSuitability === 'SUITABLE_FOR_REPOSITORY_REVIEW').length,
    notSuitable: outcomes.filter((outcome) => outcome.patchSuitability === 'NOT_SUITABLE_FOR_REPOSITORY_REVIEW').length,
    incomplete: outcomes.filter((outcome) => outcome.patchSuitability === 'HOLD_PATCH_REVIEW_INCOMPLETE').length,
    notApplicable: outcomes.filter((outcome) => outcome.patchSuitability === 'NOT_APPLICABLE_NO_APPROVED_PATCH').length
  };
  if (patchSuitabilityCounts.suitable + patchSuitabilityCounts.notSuitable + patchSuitabilityCounts.incomplete !== provisional.length
    || patchSuitabilityCounts.suitable !== approved.length) {
    fail('PATCH_SUITABILITY_METRIC_INVARIANT_FAILED', '$.finalOutcomes');
  }
  const familyCounts = Object.fromEntries(PRODUCT_FAMILIES.map((family) => [
    family,
    familyMetric(family, population.candidates, outcomes)
  ]));
  const decisionAgreementCount = outcomes.filter((outcome) => outcome.decisionAgreement).length;
  const reviewedSuggestionPrecisionBasisPoints = basisPoints(provisional.length, precisionResolvedCount);
  const patchSuitabilityRateBasisPoints = basisPoints(patchSuitabilityCounts.suitable, provisional.length);
  let qualityFindingCounts = null;
  if (rawQualityFindingCounts !== undefined) {
    assertExactKeys(rawQualityFindingCounts, {
      required: ['p0', 'p1', 'synthetic']
    }, '$.qualityFindingCounts');
    qualityFindingCounts = {
      p0: assertIntegerInRange(rawQualityFindingCounts.p0, 0, 100, '$.qualityFindingCounts.p0'),
      p1: assertIntegerInRange(rawQualityFindingCounts.p1, 0, 100, '$.qualityFindingCounts.p1'),
      synthetic: rawQualityFindingCounts.synthetic
    };
    if (typeof qualityFindingCounts.synthetic !== 'boolean'
      || qualityFindingCounts.synthetic !== (
        population.prerequisiteMode === CANDIDATE_REVIEW_SYNTHETIC_PREREQUISITE_BYPASS
      )) {
      fail('QUALITY_FINDING_SCOPE_MISMATCH', '$.qualityFindingCounts.synthetic');
    }
  }
  const unresolvedP0P1FindingCount = qualityFindingCounts
    ? qualityFindingCounts.p0 + qualityFindingCounts.p1
    : null;
  const gates = {
    populationSizePassed: population.candidateCount >= CANDIDATE_REVIEW_LIMITS.minPopulationCandidates
      && population.candidateCount <= CANDIDATE_REVIEW_LIMITS.maxPopulationCandidates,
    approvalCountPassed: approved.length >= 25,
    familyApprovalCountsPassed: PRODUCT_FAMILIES.every((family) => familyCounts[family].approvedCount >= 10),
    precisionPassed: reviewedSuggestionPrecisionBasisPoints !== null
      && reviewedSuggestionPrecisionBasisPoints >= 8_000,
    noConflictsPassed: conflicted.length === 0,
    noTerminologyGapsPassed: terminologyGapCount === 0,
    patchSuitabilityPassed: approved.length === patchSuitabilityCounts.suitable
  };
  const base = {
    schemaVersion: CANDIDATE_REVIEW_METRICS_SCHEMA_VERSION,
    ...BOUNDARY,
    roundId: population.roundId,
    populationHash: population.populationHash,
    candidateCount: population.candidateCount,
    roleRowCount: primary.rows.length + secondary.rows.length,
    outcomeCounts: {
      approved: approved.length,
      rejected: rejected.length,
      held: held.length,
      conflicted: conflicted.length
    },
    provisionalTechnicalApprovalCount: provisional.length,
    precisionResolvedCount,
    reviewedSuggestionPrecisionBasisPoints,
    populationApprovalRateBasisPoints: basisPoints(approved.length, population.candidateCount),
    humanRejectedFalsePositiveCount: falsePositive.length,
    policyRestrictedRejectCount: policyRestricted.length,
    unresolvedOrHeldCount: held.length + conflicted.length,
    terminologyGapCount,
    familyCounts,
    decisionAgreementCount,
    decisionAgreementRateBasisPoints: basisPoints(decisionAgreementCount, population.candidateCount),
    patchSuitabilityCounts,
    patchSuitabilityRateBasisPoints,
    automaticVerifiedLeakageCount: 0,
    automaticCustomerUseAllowedLeakageCount: 0,
    protectedContentLeakageCount: 0,
    qualityFindingCounts,
    unresolvedP0P1FindingCount,
    medians: {
      primary: {
        reviewDurationSeconds: median(primary.rows.map((row) => row.reviewDurationSeconds)),
        evidenceTraceabilityUsefulness: median(primary.rows.map((row) => row.evidenceTraceabilityUsefulness)),
        structuredDecisionUsefulness: median(primary.rows.map((row) => row.structuredDecisionUsefulness)),
        patchAssessmentUsefulness: null
      },
      secondary: {
        reviewDurationSeconds: median(secondary.rows.map((row) => row.reviewDurationSeconds)),
        evidenceTraceabilityUsefulness: median(secondary.rows.map((row) => row.evidenceTraceabilityUsefulness)),
        structuredDecisionUsefulness: median(secondary.rows.map((row) => row.structuredDecisionUsefulness)),
        patchAssessmentUsefulness: median(secondary.rows.map((row) => row.patchAssessmentUsefulness))
      }
    },
    gates: (() => {
      const safetyGates = {
        noAutomaticVerifiedLeakagePassed: true,
        noAutomaticCustomerUseAllowedLeakagePassed: true,
        noProtectedContentLeakagePassed: true,
        noUnresolvedP0P1FindingsPassed: unresolvedP0P1FindingCount === 0
      };
      const candidateReviewThresholdsPassed = [
        ...Object.values(gates),
        ...Object.values(safetyGates)
      ].every(Boolean);
      return {
        ...gates,
        ...safetyGates,
        candidateReviewThresholdsPassed,
        candidateReviewMethodGatePassed: candidateReviewThresholdsPassed
          && population.prerequisiteMode === 'FULL_FIDELITY_AND_SECTION5_BINDINGS'
      };
    })()
  };
  return cloneFrozen({
    ...base,
    metricsHash: sha256(base)
  });
}
