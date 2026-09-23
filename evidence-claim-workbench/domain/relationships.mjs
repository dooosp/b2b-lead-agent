import {
  assertSafeArtifact,
  canonicalStringify,
  sha256
} from '../../knowledge/claim-registry/index.mjs';
import { validateCandidate } from './candidates.mjs';
import { assertValidatedSourceDocument } from './document-bundle.mjs';

export const RELATIONSHIP_REPORT_SCHEMA_VERSION = 'evidence-claim-relationship-report-v0';
export const RELATIONSHIP_TYPES = Object.freeze([
  'EXACT_DUPLICATE_EVIDENCE',
  'MATERIAL_CONFLICT',
  'CONDITION_RESOLVED',
  'SUPERSEDES'
]);
export const RELATIONSHIP_LIMITS = Object.freeze({
  maxCandidates: 1_000,
  maxRelationships: 5_000
});

export class CandidateRelationshipError extends Error {
  constructor(code, path = '$') {
    super(`${code} at ${path}`);
    this.name = 'CandidateRelationshipError';
    this.code = code;
    this.path = path;
  }
}

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

function normalizeDocuments(documents, documentById) {
  const values = Array.isArray(documents)
    ? documents
    : documentById instanceof Map
      ? [...documentById.values()]
      : isPlainObject(documentById)
        ? Object.values(documentById)
        : [];
  if (values.length === 0) return new Map();
  const byId = new Map();
  for (const [index, document] of values.entries()) {
    try {
      assertValidatedSourceDocument(document);
    } catch (error) {
      throw new CandidateRelationshipError(error.code || 'UNTRUSTED_SOURCE_DOCUMENT', `$.documents[${index}]`);
    }
    if (!isPlainObject(document) || typeof document.documentId !== 'string') {
      throw new CandidateRelationshipError('INVALID_DOCUMENT', `$.documents[${index}]`);
    }
    if (byId.has(document.documentId)) throw new CandidateRelationshipError('DUPLICATE_DOCUMENT_ID', `$.documents[${index}].documentId`);
    byId.set(document.documentId, document);
  }
  return byId;
}

function normalizeProjectedDocuments(documents) {
  if (!Array.isArray(documents)) throw new CandidateRelationshipError('DOCUMENT_ARRAY_REQUIRED', '$.documents');
  const byId = new Map();
  for (const [index, document] of documents.entries()) {
    const path = `$.documents[${index}]`;
    if (!isPlainObject(document)
      || !/^doc_[a-f0-9]{64}$/.test(document.documentId)
      || !isPlainObject(document.revision)
      || typeof document.revision.seriesId !== 'string'
      || !document.revision.seriesId
      || typeof document.revision.revisionId !== 'string'
      || !document.revision.revisionId
      || !Number.isInteger(document.revision.sequence)
      || document.revision.sequence < 1) {
      throw new CandidateRelationshipError('INVALID_PROJECTED_DOCUMENT', path);
    }
    if (document.revision.supersedesDocumentId !== undefined
      && !/^doc_[a-f0-9]{64}$/.test(document.revision.supersedesDocumentId)) {
      throw new CandidateRelationshipError('INVALID_PROJECTED_SUPERSESSION', `${path}.revision.supersedesDocumentId`);
    }
    if (byId.has(document.documentId)) throw new CandidateRelationshipError('DUPLICATE_DOCUMENT_ID', `${path}.documentId`);
    byId.set(document.documentId, document);
  }
  return byId;
}

function normalizeCandidates(rawCandidates) {
  if (!Array.isArray(rawCandidates)) throw new CandidateRelationshipError('CANDIDATE_ARRAY_REQUIRED', '$.candidates');
  if (rawCandidates.length > RELATIONSHIP_LIMITS.maxCandidates) {
    throw new CandidateRelationshipError('RELATIONSHIP_CANDIDATE_LIMIT_EXCEEDED', '$.candidates');
  }
  const byId = new Map();
  for (const [index, rawCandidate] of rawCandidates.entries()) {
    let candidate;
    try {
      candidate = validateCandidate(rawCandidate);
    } catch (error) {
      throw new CandidateRelationshipError(error.code || 'INVALID_CANDIDATE', `$.candidates[${index}]${error.path ? `:${error.path}` : ''}`);
    }
    const prior = byId.get(candidate.candidateId);
    if (prior && canonicalStringify(prior) !== canonicalStringify(candidate)) {
      throw new CandidateRelationshipError('CANDIDATE_ID_CONTENT_CONFLICT', `$.candidates[${index}].candidateId`);
    }
    byId.set(candidate.candidateId, candidate);
  }
  return [...byId.values()].sort((left, right) => compareAscii(left.candidateId, right.candidateId));
}

function stagesOverlap(left, right) {
  if (left.applicability.projectStages.includes('UNKNOWN')
    || right.applicability.projectStages.includes('UNKNOWN')) return true;
  const rightSet = new Set(right.applicability.projectStages);
  return left.applicability.projectStages.some((stage) => rightSet.has(stage));
}

function sharesSemanticScope(left, right) {
  return left.claimType === right.claimType
    && left.subject.id === right.subject.id
    && left.value.key === right.value.key
    && left.applicability.jurisdiction === right.applicability.jurisdiction
    && stagesOverlap(left, right);
}

function sharesSupersessionSubject(left, right) {
  return left.subject.id === right.subject.id
    && left.value.key === right.value.key
    && left.applicability.jurisdiction === right.applicability.jurisdiction;
}

function conditionsAreMutuallyExclusive(leftConditions, rightConditions) {
  const rightById = new Map(rightConditions.map((condition) => [condition.id, condition.value]));
  return leftConditions.some((condition) => {
    if (!rightById.has(condition.id)) return false;
    if (condition.id === 'product_variant') {
      return condition.value !== rightById.get(condition.id);
    }
    if (condition.id !== 'installation_condition') return false;
    const pair = new Set([condition.value, rightById.get(condition.id)]);
    return pair.size === 2 && pair.has('indoor_only') && pair.has('outdoor_only');
  });
}

function canonicalEngineeringValue(value) {
  const scaleByUnit = {
    V: ['V', 1],
    kV: ['V', 1_000],
    A: ['A', 1],
    kA: ['A', 1_000],
    VA: ['VA', 1],
    kVA: ['VA', 1_000],
    MVA: ['VA', 1_000_000]
  };
  if (value.type === 'QUANTITY' && scaleByUnit[value.unit]) {
    const [unit, scale] = scaleByUnit[value.unit];
    return { ...value, value: value.value * scale, unit };
  }
  if (value.type === 'RANGE' && scaleByUnit[value.unit]) {
    const [unit, scale] = scaleByUnit[value.unit];
    return { ...value, minimum: value.minimum * scale, maximum: value.maximum * scale, unit };
  }
  return value;
}

function valuesEqual(left, right) {
  return canonicalStringify(canonicalEngineeringValue(left.value)) === canonicalStringify(canonicalEngineeringValue(right.value));
}

function findSupersession(left, right, documentById) {
  const leftDocument = documentById.get(left.documentId);
  const rightDocument = documentById.get(right.documentId);
  if (!leftDocument || !rightDocument) return null;
  if (leftDocument.revision?.supersedesDocumentId === right.documentId) {
    return { superseded: right, successor: left };
  }
  if (rightDocument.revision?.supersedesDocumentId === left.documentId) {
    return { superseded: left, successor: right };
  }
  return null;
}

function createRelationship(type, candidates, extra = {}) {
  const candidateIds = candidates.map((candidate) => candidate.candidateId).sort(compareAscii);
  const documentIds = [...new Set(candidates.map((candidate) => candidate.documentId))].sort(compareAscii);
  const base = {
    schemaVersion: 'evidence-claim-relationship-v0',
    type,
    candidateIds,
    documentIds,
    blocking: type === 'EXACT_DUPLICATE_EVIDENCE' || type === 'MATERIAL_CONFLICT' || type === 'SUPERSEDES',
    requiresHumanDisposition: type !== 'CONDITION_RESOLVED',
    reasonCodes: type === 'EXACT_DUPLICATE_EVIDENCE'
      ? ['DUPLICATE_CANDIDATE']
      : type === 'MATERIAL_CONFLICT'
        ? ['CONFLICTING_DOCUMENT']
        : type === 'SUPERSEDES'
          ? ['SUPERSEDED_DOCUMENT']
          : ['CONDITIONS_DISTINGUISH_CLAIMS'],
    ...extra
  };
  return Object.freeze({ relationshipId: `rel_${sha256(base)}`, ...base });
}

function buildRelationshipReport(candidates, documentsIndex) {
  const relationships = [];
  const addRelationship = (relationship) => {
    if (relationships.length >= RELATIONSHIP_LIMITS.maxRelationships) {
      throw new CandidateRelationshipError('TOO_MANY_RELATIONSHIPS', '$.relationships');
    }
    relationships.push(relationship);
  };

  for (let leftIndex = 0; leftIndex < candidates.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < candidates.length; rightIndex += 1) {
      const left = candidates[leftIndex];
      const right = candidates[rightIndex];
      const supersession = findSupersession(left, right, documentsIndex);
      if (supersession && sharesSupersessionSubject(left, right)) {
        addRelationship(createRelationship('SUPERSEDES', [left, right], {
          supersededCandidateId: supersession.superseded.candidateId,
          successorCandidateId: supersession.successor.candidateId
        }));
        continue;
      }

      if (!sharesSemanticScope(left, right)) continue;

      if (conditionsAreMutuallyExclusive(left.applicability.conditions, right.applicability.conditions)) {
        addRelationship(createRelationship('CONDITION_RESOLVED', [left, right]));
        continue;
      }

      if (valuesEqual(left, right)) {
        addRelationship(createRelationship('EXACT_DUPLICATE_EVIDENCE', [left, right]));
        continue;
      }

      addRelationship(createRelationship('MATERIAL_CONFLICT', [left, right]));
    }
  }

  relationships.sort((left, right) => compareAscii(left.relationshipId, right.relationshipId));
  const blockingCandidateIds = [...new Set(relationships
    .filter((relationship) => relationship.blocking)
    .flatMap((relationship) => relationship.candidateIds))].sort(compareAscii);
  const reportBase = {
    schemaVersion: RELATIONSHIP_REPORT_SCHEMA_VERSION,
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    productionReady: false,
    productionReviewerWorkflowReady: false,
    automaticResolution: false,
    favorableClaimAutomaticallySelected: false,
    relationships,
    blockingCandidateIds,
    metrics: {
      candidateCount: candidates.length,
      relationshipCount: relationships.length,
      exactDuplicateCount: relationships.filter((relationship) => relationship.type === 'EXACT_DUPLICATE_EVIDENCE').length,
      materialConflictCount: relationships.filter((relationship) => relationship.type === 'MATERIAL_CONFLICT').length,
      conditionResolvedCount: relationships.filter((relationship) => relationship.type === 'CONDITION_RESOLVED').length,
      supersededCount: relationships.filter((relationship) => relationship.type === 'SUPERSEDES').length
    }
  };
  return deepFreeze({ ...reportBase, reportId: `relreport_${sha256(reportBase)}` });
}

export function analyzeCandidateRelationships(rawCandidates, { documents = [], documentById, inject = {} } = {}) {
  inject.beforeRelationshipDetection?.({ candidates: rawCandidates, documents });
  assertSafeArtifact(rawCandidates);
  const candidates = normalizeCandidates(rawCandidates);
  const documentsIndex = normalizeDocuments(documents, documentById);
  const report = buildRelationshipReport(candidates, documentsIndex);
  inject.afterRelationshipDetection?.(report);
  return report;
}

export function analyzeProjectedCandidateRelationships(rawCandidates, { documents = [] } = {}) {
  assertSafeArtifact(rawCandidates);
  assertSafeArtifact(documents);
  const candidates = normalizeCandidates(rawCandidates);
  const documentsIndex = normalizeProjectedDocuments(documents);
  return buildRelationshipReport(candidates, documentsIndex);
}

export const analyzeRelationships = analyzeCandidateRelationships;
