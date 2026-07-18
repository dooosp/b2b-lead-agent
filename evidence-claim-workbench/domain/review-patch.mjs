import {
  assertSafeArtifact,
  canonicalStringify,
  normalizeEvidenceUrl,
  sha256
} from '../../knowledge/claim-registry/index.mjs';
import {
  validateCandidate
} from './candidates.mjs';
import {
  computeSourceDocumentId,
  createSourceDocumentCatalog
} from './document-bundle.mjs';
import {
  computePageEvidenceAnchorId,
  validatePageEvidenceAnchor
} from './evidence-anchor.mjs';
import {
  EVIDENCE_DOCUMENT_LIMITS,
  PAGE_EVIDENCE_ANCHOR_SCHEMA_VERSION,
  PAGE_TEXT_NORMALIZATION_VERSION,
  SOURCE_DOCUMENT_BUNDLE_SCHEMA_VERSION
} from './constants.mjs';
import {
  REVIEW_REASON_CODES,
  createReviewDecision,
  validateReviewDecision
} from './review-decisions.mjs';
import {
  analyzeCandidateRelationships,
  analyzeProjectedCandidateRelationships
} from './relationships.mjs';

export const REVIEW_PATCH_SCHEMA_VERSION = 'claim-registry-review-patch-v0';
export const REVIEW_PATCH_LIMITS = Object.freeze({
  maxQuoteCodePoints: 500,
  maxAggregateQuoteCodePoints: 1_500,
  maxSerializedBytes: 256_000,
  maxApprovedCandidates: 100
});

const COMMIT_SHA = /^[a-f0-9]{40}$/;
const SHA256_HEX = /^[a-f0-9]{64}$/;
const CANDIDATE_ID = /^cand_[a-f0-9]{64}$/;
const DECISION_ID = /^dec_[a-f0-9]{64}$/;
const SAFE_REGISTRY_PATH = /^knowledge\/claim-registry\/[a-z0-9][a-z0-9._/-]*\.json$/;
const ABSOLUTE_LOCAL_PATH = /(?:\bfile:(?:\/{1,3}|\\+)|(?:^|[\s"'(=:\[\{])(?:\/(?!\/)|[A-Za-z]:[\\/]|\\\\)|(?:^|[\s"'(=\[\{])\/\/[^/\s])/iu;
const PRIVATE_TEXT = /(?:\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|(?:\+?82[- .]?)?0\d{1,2}[- .]\d{3,4}[- .]\d{4})/iu;
const FORBIDDEN_PATCH_KEY = /^(?:pageText|pages|sourceBinary|binary|buffer|bytes|filePath|absolutePath|localPath|reviewerName|reviewerEmail|reviewerUserId|userId|recipient|token|cookie|environment|customerData|privateData|freeform|notes?)$/i;

export class ReviewPatchValidationError extends Error {
  constructor(code, path = '$') {
    super(`${code} at ${path}`);
    this.name = 'ReviewPatchValidationError';
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

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

function countCodePoints(value) {
  return [...value].length;
}

function assertExactKeys(value, allowed, path) {
  if (!isPlainObject(value)) throw new ReviewPatchValidationError('OBJECT_REQUIRED', path);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new ReviewPatchValidationError('UNKNOWN_FIELD_REFUSED', `${path}.${key}`);
  }
}

function assertPatchSafe(value, path = '$') {
  if (typeof value === 'string') {
    const representations = [];
    let representation = value;
    for (let depth = 0; ; depth += 1) {
      for (const form of [representation, representation.normalize('NFKC')]) {
        if (!representations.includes(form)) representations.push(form);
      }
      if (!/%[0-9a-f]{2}/iu.test(representation)) break;
      if (depth === 4) throw new ReviewPatchValidationError('PERCENT_ENCODING_DEPTH_REFUSED', path);
      try {
        const decoded = decodeURIComponent(representation);
        if (decoded === representation) break;
        representation = decoded;
      } catch {
        throw new ReviewPatchValidationError('MALFORMED_PERCENT_ENCODING_REFUSED', path);
      }
    }
    if (representations.some((representation) => ABSOLUTE_LOCAL_PATH.test(representation))) {
      throw new ReviewPatchValidationError('LOCAL_ABSOLUTE_PATH_REFUSED', path);
    }
    if (representations.some((representation) => PRIVATE_TEXT.test(representation))) {
      throw new ReviewPatchValidationError('IDENTITY_OR_PRIVATE_TEXT_REFUSED', path);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertPatchSafe(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (FORBIDDEN_PATCH_KEY.test(key)) throw new ReviewPatchValidationError('PROTECTED_PATCH_FIELD_REFUSED', `${path}.${key}`);
      assertPatchSafe(child, `${path}.${key}`);
    }
  }
}

function validateGeneratedAt(value, path = '$.generatedAt') {
  if (typeof value !== 'string') throw new ReviewPatchValidationError('GENERATED_AT_REQUIRED', path);
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) throw new ReviewPatchValidationError('INVALID_GENERATED_AT', path);
  return value;
}

function validateBase(base) {
  assertExactKeys(base, new Set(['commitSha', 'registryPath']), '$.base');
  if (!COMMIT_SHA.test(base.commitSha)) throw new ReviewPatchValidationError('INVALID_BASE_COMMIT_SHA', '$.base.commitSha');
  if (typeof base.registryPath !== 'string'
    || !SAFE_REGISTRY_PATH.test(base.registryPath)
    || base.registryPath.includes('..')
    || base.registryPath.includes('//')) {
    throw new ReviewPatchValidationError('REGISTRY_PATH_REFUSED', '$.base.registryPath');
  }
  return { commitSha: base.commitSha, registryPath: base.registryPath };
}

function toCatalogInput(document) {
  if (!isPlainObject(document)) return document;
  return {
    schemaVersion: document.schemaVersion,
    boundary: document.boundary,
    productionReady: document.productionReady,
    synthetic: document.synthetic,
    source: document.source,
    revision: document.revision,
    file: document.file,
    extraction: document.extraction,
    pages: Array.isArray(document.pages)
      ? document.pages.map((page) => ({
        pageNumber: page.pageNumber,
        locator: page.locator,
        text: page.text,
        textSha256: page.textSha256
      }))
      : document.pages,
    ...(document.documentId ? { documentId: document.documentId } : {})
  };
}

function validateDocuments(documents, asOf) {
  if (!Array.isArray(documents) || documents.length === 0) throw new ReviewPatchValidationError('DOCUMENTS_REQUIRED', '$.documents');
  try {
    return createSourceDocumentCatalog(documents.map(toCatalogInput), { asOf }).documents;
  } catch (error) {
    throw new ReviewPatchValidationError(error.code || 'INVALID_DOCUMENT_CATALOG', error.path || '$.documents');
  }
}

function validateCandidates(candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) throw new ReviewPatchValidationError('CANDIDATES_REQUIRED', '$.candidates');
  const byId = new Map();
  for (const [index, rawCandidate] of candidates.entries()) {
    let candidate;
    try {
      candidate = validateCandidate(rawCandidate);
    } catch (error) {
      throw new ReviewPatchValidationError(error.code || 'INVALID_CANDIDATE', `$.candidates[${index}]`);
    }
    const prior = byId.get(candidate.candidateId);
    if (prior && canonicalStringify(prior) !== canonicalStringify(candidate)) {
      throw new ReviewPatchValidationError('CANDIDATE_ID_CONTENT_CONFLICT', `$.candidates[${index}].candidateId`);
    }
    if (prior) throw new ReviewPatchValidationError('DUPLICATE_CANDIDATE_ID', `$.candidates[${index}].candidateId`);
    byId.set(candidate.candidateId, candidate);
  }
  return byId;
}

function expectedDecisionSnapshot(candidate) {
  return {
    claimType: candidate.claimType,
    productFamily: candidate.subject.id,
    capabilityKey: candidate.value.key,
    value: candidate.value,
    applicability: candidate.applicability,
    validity: candidate.validity
  };
}

function assertCandidateSourceScope(candidate, document, path) {
  const productFamilies = document?.source?.productFamilies ?? document?.productFamilies;
  if (candidate.synthetic !== document?.synthetic) {
    throw new ReviewPatchValidationError('CANDIDATE_SOURCE_SYNTHETIC_MISMATCH', `${path}.synthetic`);
  }
  if (!Array.isArray(productFamilies) || !productFamilies.includes(candidate.subject.id)) {
    throw new ReviewPatchValidationError('CANDIDATE_SOURCE_PRODUCT_FAMILY_MISMATCH', `${path}.subject.id`);
  }
}

function assertApprovedCandidateTemporalScope(candidate, document, generatedAt, path) {
  if (candidate.validity.type === 'VALID_UNTIL' && candidate.validity.validUntil <= generatedAt) {
    throw new ReviewPatchValidationError('APPROVED_CANDIDATE_EXPIRED', `${path}.validity.validUntil`);
  }
  const sourceValidUntil = document?.revision?.validUntil;
  if (sourceValidUntil && (candidate.validity.type !== 'VALID_UNTIL' || candidate.validity.validUntil > sourceValidUntil)) {
    throw new ReviewPatchValidationError('CANDIDATE_VALIDITY_EXCEEDS_SOURCE', `${path}.validity`);
  }
}

function validateDecisions(decisions, candidatesById) {
  if (!Array.isArray(decisions)) throw new ReviewPatchValidationError('DECISIONS_ARRAY_REQUIRED', '$.decisions');
  const byCandidateId = new Map();
  for (const [index, rawDecision] of decisions.entries()) {
    let decision;
    try {
      decision = validateReviewDecision(rawDecision);
    } catch (error) {
      throw new ReviewPatchValidationError(error.code || 'INVALID_DECISION', `$.decisions[${index}]`);
    }
    const candidate = candidatesById.get(decision.candidateId);
    if (!candidate) throw new ReviewPatchValidationError('DECISION_CANDIDATE_UNKNOWN', `$.decisions[${index}].candidateId`);
    if (decision.documentId !== candidate.documentId
      || decision.evidenceAnchorId !== candidate.evidenceAnchorId
      || canonicalStringify(decision.candidateSnapshot) !== canonicalStringify(expectedDecisionSnapshot(candidate))) {
      throw new ReviewPatchValidationError('DECISION_CANDIDATE_BINDING_MISMATCH', `$.decisions[${index}]`);
    }
    if (byCandidateId.has(decision.candidateId)) throw new ReviewPatchValidationError('MULTIPLE_DECISIONS_FOR_CANDIDATE', `$.decisions[${index}].candidateId`);
    byCandidateId.set(decision.candidateId, decision);
  }
  return byCandidateId;
}

function validateAnchors(anchors, documentById) {
  if (!Array.isArray(anchors)) throw new ReviewPatchValidationError('ANCHORS_ARRAY_REQUIRED', '$.anchors');
  const byId = new Map();
  for (const [index, rawAnchor] of anchors.entries()) {
    const document = documentById.get(rawAnchor?.documentId);
    if (!document) throw new ReviewPatchValidationError('ANCHOR_DOCUMENT_UNKNOWN', `$.anchors[${index}].documentId`);
    let anchor;
    try {
      anchor = validatePageEvidenceAnchor(document, rawAnchor);
    } catch (error) {
      throw new ReviewPatchValidationError(error.code || 'INVALID_ANCHOR', error.path || `$.anchors[${index}]`);
    }
    const page = document.pages.find((candidate) => candidate.pageNumber === anchor.page.extractedPageOrdinal);
    if (page && anchor.selection.quote === page.text) {
      throw new ReviewPatchValidationError('FULL_PAGE_EXCERPT_REFUSED', `$.anchors[${index}]`);
    }
    if (byId.has(anchor.anchorId)) throw new ReviewPatchValidationError('DUPLICATE_ANCHOR_ID', `$.anchors[${index}].anchorId`);
    byId.set(anchor.anchorId, anchor);
  }
  return byId;
}

function requireDecision(decisionsByCandidateId, candidateId, relationship) {
  const decision = decisionsByCandidateId.get(candidateId);
  if (!decision) throw new ReviewPatchValidationError('RELATIONSHIP_DISPOSITION_REQUIRED', `$.relationships.${relationship.relationshipId}`);
  return decision;
}

function resolveRelationshipDispositions(report, decisionsByCandidateId) {
  return report.relationships.map((relationship) => {
    const decisions = relationship.candidateIds.map((candidateId) => requireDecision(decisionsByCandidateId, candidateId, relationship));
    let disposition;
    if (relationship.type === 'EXACT_DUPLICATE_EVIDENCE') {
      const approvals = decisions.filter((decision) => decision.decision === 'APPROVE_FOR_REPOSITORY_REVIEW');
      const rejectedDuplicates = decisions.filter((decision) => decision.decision === 'REJECT' && decision.reasonCodes.includes('DUPLICATE_CANDIDATE'));
      if (approvals.length > 1 || approvals.length + rejectedDuplicates.length !== decisions.length) {
        throw new ReviewPatchValidationError('DUPLICATE_RELATIONSHIP_UNRESOLVED', `$.relationships.${relationship.relationshipId}`);
      }
      disposition = 'EXPLICIT_DUPLICATE_DISPOSITION';
    } else if (relationship.type === 'MATERIAL_CONFLICT') {
      const approvals = decisions.filter((decision) => decision.decision === 'APPROVE_FOR_REPOSITORY_REVIEW');
      const rejections = decisions.filter((decision) => decision.decision === 'REJECT');
      if (approvals.length > 1 || approvals.length + rejections.length !== decisions.length) {
        throw new ReviewPatchValidationError('MATERIAL_CONFLICT_UNRESOLVED', `$.relationships.${relationship.relationshipId}`);
      }
      disposition = 'EXPLICIT_CONFLICT_DISPOSITION';
    } else if (relationship.type === 'SUPERSEDES') {
      const supersededDecision = decisionsByCandidateId.get(relationship.supersededCandidateId);
      const successorDecision = decisionsByCandidateId.get(relationship.successorCandidateId);
      if (supersededDecision?.decision !== 'FLAG_SUPERSEDED'
        || !supersededDecision.reasonCodes.includes('SUPERSEDED_DOCUMENT')
        || !supersededDecision.relatedCandidateIds.includes(relationship.successorCandidateId)
        || !['APPROVE_FOR_REPOSITORY_REVIEW', 'REJECT'].includes(successorDecision?.decision)) {
        throw new ReviewPatchValidationError('SUPERSESSION_UNRESOLVED', `$.relationships.${relationship.relationshipId}`);
      }
      disposition = 'EXPLICIT_SUPERSESSION_DISPOSITION';
    } else {
      if (!decisions.every((decision) => ['APPROVE_FOR_REPOSITORY_REVIEW', 'REJECT'].includes(decision.decision))) {
        throw new ReviewPatchValidationError('CONDITION_RESOLUTION_DISPOSITION_REQUIRED', `$.relationships.${relationship.relationshipId}`);
      }
      disposition = 'CONDITIONS_DISTINGUISH_CLAIMS';
    }
    return {
      relationshipId: relationship.relationshipId,
      type: relationship.type,
      candidateIds: relationship.candidateIds,
      ...(relationship.type === 'SUPERSEDES' ? {
        supersededCandidateId: relationship.supersededCandidateId,
        successorCandidateId: relationship.successorCandidateId
      } : {}),
      decisionIds: decisions.map((decision) => decision.decisionId).sort(compareAscii),
      candidateDispositions: decisions.map((decision) => ({
        candidateId: decision.candidateId,
        documentId: decision.documentId,
        evidenceAnchorId: decision.evidenceAnchorId,
        decisionId: decision.decisionId,
        decision: decision.decision,
        reasonCodes: decision.reasonCodes
      })).sort((left, right) => compareAscii(left.candidateId, right.candidateId)),
      disposition
    };
  }).sort((left, right) => compareAscii(left.relationshipId, right.relationshipId));
}

function projectSourceDocument(document) {
  const revision = {
    seriesId: document.revision.seriesId,
    revisionId: document.revision.revisionId,
    sequence: document.revision.sequence,
    publishedAt: document.revision.publishedAt,
    effectiveAt: document.revision.effectiveAt,
    retrievedAt: document.revision.retrievedAt
  };
  if (document.revision.validUntil) revision.validUntil = document.revision.validUntil;
  if (document.revision.supersedesDocumentId) revision.supersedesDocumentId = document.revision.supersedesDocumentId;
  return {
    documentId: document.documentId,
    documentNumber: document.source.documentNumber,
    documentSha256: document.file.sha256,
    synthetic: document.synthetic,
    sourceClass: document.source.sourceClass,
    publisher: document.source.publisher,
    title: document.source.title,
    sourceUrl: document.source.sourceUrl,
    documentType: document.source.documentType,
    mimeType: document.source.mimeType,
    language: document.source.language,
    jurisdiction: document.source.jurisdiction,
    domain: document.source.domain,
    productFamilies: document.source.productFamilies,
    authenticityStatus: document.source.authenticityStatus,
    redistributionStatus: document.source.redistributionStatus,
    documentByteLength: document.file.byteLength,
    normalizedContentSha256: document.file.contentSha256,
    revision
  };
}

function addRevisionSeriesContext(documentIds, documentById) {
  const included = new Set(documentIds);
  const seriesIds = new Set([...included].map((documentId) => {
    const document = documentById.get(documentId);
    if (!document) throw new ReviewPatchValidationError('CANDIDATE_DOCUMENT_UNKNOWN', `$.documents.${documentId}`);
    return document.revision.seriesId;
  }));
  for (const [documentId, document] of documentById.entries()) {
    if (seriesIds.has(document.revision.seriesId)) included.add(documentId);
  }
  return included;
}

function projectAnchor(anchor) {
  return {
    evidenceAnchorId: anchor.anchorId,
    documentId: anchor.documentId,
    documentNumber: anchor.documentNumber,
    documentSha256: anchor.sourceFileSha256,
    revision: anchor.revision,
    pageLocator: {
      type: anchor.page.locator.type,
      value: anchor.page.locator.value
    },
    extractedPageOrdinal: anchor.page.extractedPageOrdinal,
    pageTextSha256: anchor.page.textSha256,
    pageCodePointLength: anchor.page.textCodePoints,
    selection: {
      normalizationVersion: anchor.selection.normalizationVersion,
      startCodePoint: anchor.selection.startCodePoint,
      endCodePoint: anchor.selection.endCodePoint,
      directQuote: anchor.selection.quote,
      quoteSha256: anchor.selection.quoteSha256,
      occurrenceIndex: anchor.selection.occurrenceIndex,
      occurrenceCount: anchor.selection.occurrenceCount,
      prefixContextCodePoints: anchor.selection.prefixContextCodePoints,
      prefixContextSha256: anchor.selection.prefixContextSha256,
      suffixContextCodePoints: anchor.selection.suffixContextCodePoints,
      suffixContextSha256: anchor.selection.suffixContextSha256
    }
  };
}

function projectApprovedCandidate(candidate, decision, relationshipReport) {
  return {
    candidate,
    decision: {
      decisionId: decision.decisionId,
      decision: 'APPROVE_FOR_REPOSITORY_REVIEW',
      reasonCodes: decision.reasonCodes,
      acknowledgements: decision.acknowledgements
    },
    relationshipIds: relationshipReport.relationships
      .filter((relationship) => relationship.candidateIds.includes(candidate.candidateId))
      .map((relationship) => relationship.relationshipId)
      .sort(compareAscii)
  };
}

function projectRelationshipReview(candidate, decision, relationshipReport) {
  return {
    candidate,
    decision,
    relationshipIds: relationshipReport.relationships
      .filter((relationship) => relationship.candidateIds.includes(candidate.candidateId))
      .map((relationship) => relationship.relationshipId)
      .sort(compareAscii)
  };
}

function createSourceSuggestion(candidate, registryPath) {
  return {
    candidateId: candidate.candidateId,
    registryPath,
    sourceField: `claims.workbench_${candidate.candidateId.slice('cand_'.length, 'cand_'.length + 24)}`
  };
}

function assertQuoteBudget(projectedAnchors) {
  let aggregate = 0;
  for (const [index, anchor] of projectedAnchors.entries()) {
    const length = countCodePoints(anchor.selection.directQuote);
    if (length > REVIEW_PATCH_LIMITS.maxQuoteCodePoints) throw new ReviewPatchValidationError('PATCH_QUOTE_TOO_LONG', `$.evidenceAnchors[${index}]`);
    aggregate += length;
  }
  if (aggregate > REVIEW_PATCH_LIMITS.maxAggregateQuoteCodePoints) {
    throw new ReviewPatchValidationError('PATCH_AGGREGATE_QUOTE_BUDGET_EXCEEDED', '$.evidenceAnchors');
  }
  return aggregate;
}

function patchIdentityPayload(patch) {
  return Object.fromEntries(Object.entries(patch).filter(([key]) => key !== 'patchId'));
}

export function createReviewPatch({
  baseCommitSha,
  registryPath,
  generatedAt,
  documents,
  anchors,
  candidates,
  decisions,
  relationshipReport
}, { clock, inject = {} } = {}) {
  inject.beforeReviewPatch?.({ baseCommitSha, registryPath, generatedAt });
  const base = validateBase({ commitSha: baseCommitSha, registryPath });
  const fixedGeneratedAt = validateGeneratedAt(generatedAt ?? clock?.());
  const validatedDocuments = validateDocuments(documents, fixedGeneratedAt);
  const documentById = new Map(validatedDocuments.map((document) => [document.documentId, document]));
  const supersededSourceDocumentIds = new Set(validatedDocuments
    .map((document) => document.revision.supersedesDocumentId)
    .filter(Boolean));
  const candidatesById = validateCandidates(candidates);
  const decisionsByCandidateId = validateDecisions(decisions, candidatesById);
  const anchorsById = validateAnchors(anchors, documentById);
  for (const candidate of candidatesById.values()) {
    const document = documentById.get(candidate.documentId);
    if (!document) throw new ReviewPatchValidationError('CANDIDATE_DOCUMENT_UNKNOWN', `$.candidates.${candidate.candidateId}`);
    const anchor = anchorsById.get(candidate.evidenceAnchorId);
    if (!anchor || anchor.documentId !== candidate.documentId) throw new ReviewPatchValidationError('CANDIDATE_ANCHOR_UNKNOWN', `$.candidates.${candidate.candidateId}`);
    assertCandidateSourceScope(candidate, document, `$.candidates.${candidate.candidateId}`);
    if (decisionsByCandidateId.get(candidate.candidateId)?.decision === 'APPROVE_FOR_REPOSITORY_REVIEW') {
      if (supersededSourceDocumentIds.has(candidate.documentId)) {
        throw new ReviewPatchValidationError('APPROVED_SOURCE_SUPERSEDED', `$.candidates.${candidate.candidateId}.documentId`);
      }
      assertApprovedCandidateTemporalScope(candidate, document, fixedGeneratedAt, `$.candidates.${candidate.candidateId}`);
    }
  }
  const computedRelationships = analyzeCandidateRelationships([...candidatesById.values()], { documents: validatedDocuments, inject });
  if (relationshipReport && canonicalStringify(relationshipReport) !== canonicalStringify(computedRelationships)) {
    throw new ReviewPatchValidationError('RELATIONSHIP_REPORT_MISMATCH', '$.relationshipReport');
  }
  const relationshipDispositions = resolveRelationshipDispositions(computedRelationships, decisionsByCandidateId);
  const approved = [...decisionsByCandidateId.values()]
    .filter((decision) => decision.decision === 'APPROVE_FOR_REPOSITORY_REVIEW')
    .map((decision) => candidatesById.get(decision.candidateId))
    .sort((left, right) => compareAscii(left.candidateId, right.candidateId));
  if (approved.length === 0) throw new ReviewPatchValidationError('NO_APPROVED_CANDIDATES', '$.decisions');
  if (approved.length > REVIEW_PATCH_LIMITS.maxApprovedCandidates) throw new ReviewPatchValidationError('TOO_MANY_APPROVED_CANDIDATES', '$.decisions');

  const includedCandidateIds = new Set([
    ...approved.map((candidate) => candidate.candidateId),
    ...computedRelationships.relationships.flatMap((relationship) => relationship.candidateIds)
  ]);
  const includedCandidates = [...includedCandidateIds].map((candidateId) => candidatesById.get(candidateId));
  const includedDocumentIds = addRevisionSeriesContext(
    includedCandidates.map((candidate) => candidate.documentId),
    documentById
  );
  const includedAnchorIds = new Set(includedCandidates.map((candidate) => candidate.evidenceAnchorId));
  const sourceDocuments = [...includedDocumentIds].map((documentId) => projectSourceDocument(documentById.get(documentId)))
    .sort((left, right) => compareAscii(left.documentId, right.documentId));
  const evidenceAnchors = [...includedAnchorIds].map((anchorId) => projectAnchor(anchorsById.get(anchorId)))
    .sort((left, right) => compareAscii(left.evidenceAnchorId, right.evidenceAnchorId));
  const aggregateQuoteCodePoints = assertQuoteBudget(evidenceAnchors);
  const approvedCandidates = approved.map((candidate) => projectApprovedCandidate(candidate, decisionsByCandidateId.get(candidate.candidateId), computedRelationships));
  const relationshipCandidateIds = [...new Set(computedRelationships.relationships
    .flatMap((relationship) => relationship.candidateIds))].sort(compareAscii);
  const relationshipReviews = relationshipCandidateIds.map((candidateId) => projectRelationshipReview(
    candidatesById.get(candidateId),
    decisionsByCandidateId.get(candidateId),
    computedRelationships
  ));
  const sourceFileSuggestions = approved.map((candidate) => createSourceSuggestion(candidate, registryPath));

  const withoutId = {
    schemaVersion: REVIEW_PATCH_SCHEMA_VERSION,
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    productionReady: false,
    productionReviewerWorkflowReady: false,
    issue165Status: 'HOLD',
    repositoryReviewRequired: true,
    automaticVerification: false,
    customerUseAllowed: false,
    proofExecutionApproved: false,
    reviewerIdentity: 'NOT_COLLECTED',
    generatedAt: fixedGeneratedAt,
    base,
    scope: {
      vertical: 'datacenter',
      domain: 'electrical_power',
      jurisdiction: 'KR',
      productFamilies: ['medium_voltage_switchgear', 'transformer']
    },
    sourceDocuments,
    evidenceAnchors,
    approvedCandidates,
    relationshipReviews,
    relationshipDispositions,
    sourceFileSuggestions,
    metrics: {
      approvedCandidateCount: approvedCandidates.length,
      sourceDocumentCount: sourceDocuments.length,
      evidenceAnchorCount: evidenceAnchors.length,
      relationshipReviewCount: relationshipReviews.length,
      relationshipDispositionCount: relationshipDispositions.length,
      sourceFileSuggestionCount: sourceFileSuggestions.length,
      aggregateQuoteCodePoints
    }
  };
  const patch = { ...withoutId, patchId: `patch_${sha256(withoutId)}` };
  assertSafeArtifact(patch);
  assertPatchSafe(patch);
  inject.beforePatchSerialization?.(patch);
  const bytes = Buffer.byteLength(canonicalStringify(patch), 'utf8');
  if (bytes > REVIEW_PATCH_LIMITS.maxSerializedBytes) throw new ReviewPatchValidationError('PATCH_TOO_LARGE');
  const validatedPatch = validateReviewPatch(patch);
  inject.afterReviewPatch?.(validatedPatch);
  return validatedPatch;
}

function assertSorted(values, key, path) {
  const actual = values.map((value) => value[key]);
  const expected = [...actual].sort(compareAscii);
  if (canonicalStringify(actual) !== canonicalStringify(expected)) throw new ReviewPatchValidationError('NONCANONICAL_ORDER', path);
  if (new Set(actual).size !== actual.length) throw new ReviewPatchValidationError('DUPLICATE_ID', path);
}

function assertIsoTimestamp(value, path, { atOrBefore } = {}) {
  if (typeof value !== 'string') throw new ReviewPatchValidationError('INVALID_DATE', path);
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) throw new ReviewPatchValidationError('INVALID_DATE', path);
  if (atOrBefore && value > atOrBefore) throw new ReviewPatchValidationError('FUTURE_DOCUMENT_DATE', path);
  return value;
}

function validateProjectedSourceDocuments(sourceDocuments, generatedAt) {
  const byId = new Map();
  for (const [index, document] of sourceDocuments.entries()) {
    const path = `$.sourceDocuments[${index}]`;
    assertExactKeys(document, new Set([
      'documentId', 'documentNumber', 'documentSha256', 'synthetic', 'sourceClass', 'publisher', 'title',
      'sourceUrl', 'documentType', 'mimeType', 'language', 'jurisdiction', 'domain', 'productFamilies',
      'authenticityStatus', 'redistributionStatus', 'documentByteLength', 'normalizedContentSha256', 'revision'
    ]), path);
    if (!/^doc_[a-f0-9]{64}$/.test(document.documentId)) throw new ReviewPatchValidationError('INVALID_DOCUMENT_ID', `${path}.documentId`);
    if (!SHA256_HEX.test(document.documentSha256) || !SHA256_HEX.test(document.normalizedContentSha256)) {
      throw new ReviewPatchValidationError('INVALID_DOCUMENT_HASH', path);
    }
    if (!Number.isInteger(document.documentByteLength) || document.documentByteLength < 1 || document.documentByteLength > 25_000_000) {
      throw new ReviewPatchValidationError('INVALID_DOCUMENT_BYTE_LENGTH', `${path}.documentByteLength`);
    }
    for (const key of ['documentNumber', 'publisher', 'title']) {
      if (typeof document[key] !== 'string' || !document[key].trim()) throw new ReviewPatchValidationError('DOCUMENT_METADATA_REQUIRED', `${path}.${key}`);
    }
    if (typeof document.synthetic !== 'boolean') throw new ReviewPatchValidationError('SYNTHETIC_BOOLEAN_REQUIRED', `${path}.synthetic`);
    if (document.documentType !== 'NORMALIZED_PAGE_TEXT_JSON' || document.mimeType !== 'application/json') {
      throw new ReviewPatchValidationError('UNSUPPORTED_DOCUMENT_TYPE', path);
    }
    if (!['en', 'ko'].includes(document.language) || document.jurisdiction !== 'KR' || document.domain !== 'electrical_power') {
      throw new ReviewPatchValidationError('DOCUMENT_SCOPE_INVALID', path);
    }
    if (!Array.isArray(document.productFamilies)
      || document.productFamilies.length === 0
      || document.productFamilies.some((family) => !['medium_voltage_switchgear', 'transformer'].includes(family))) {
      throw new ReviewPatchValidationError('DOCUMENT_PRODUCT_FAMILY_INVALID', `${path}.productFamilies`);
    }
    if (document.authenticityStatus !== 'UNREVIEWED') throw new ReviewPatchValidationError('SOURCE_AUTHENTICITY_MUST_BE_UNREVIEWED', `${path}.authenticityStatus`);
    const expectedRedistribution = document.synthetic
      ? 'SYNTHETIC_FIXTURE_REDISTRIBUTION_PERMITTED'
      : 'METADATA_AND_BOUNDED_EXCERPTS_ONLY';
    if (document.redistributionStatus !== expectedRedistribution) throw new ReviewPatchValidationError('REDISTRIBUTION_STATUS_MODE_MISMATCH', `${path}.redistributionStatus`);
    if (document.synthetic !== (document.sourceClass === 'SYNTHETIC_FIXTURE')) throw new ReviewPatchValidationError('SOURCE_CLASS_MODE_MISMATCH', `${path}.sourceClass`);
    if (!['OFFICIAL_MANUFACTURER', 'OFFICIAL_REGULATOR', 'OFFICIAL_STANDARDS_BODY', 'SYNTHETIC_FIXTURE'].includes(document.sourceClass)) {
      throw new ReviewPatchValidationError('UNSUPPORTED_SOURCE_CLASS', `${path}.sourceClass`);
    }
    let normalizedUrl;
    try {
      normalizedUrl = normalizeEvidenceUrl(document.sourceUrl, { synthetic: document.synthetic, path: `${path}.sourceUrl` });
    } catch (error) {
      throw new ReviewPatchValidationError(error.code || 'INVALID_SOURCE_URL', error.path || `${path}.sourceUrl`);
    }
    if (normalizedUrl !== document.sourceUrl) throw new ReviewPatchValidationError('NONCANONICAL_SOURCE_URL', `${path}.sourceUrl`);
    assertExactKeys(document.revision, new Set([
      'seriesId', 'revisionId', 'sequence', 'publishedAt', 'effectiveAt', 'retrievedAt', 'validUntil', 'supersedesDocumentId'
    ]), `${path}.revision`);
    if (typeof document.revision.seriesId !== 'string' || !document.revision.seriesId
      || typeof document.revision.revisionId !== 'string' || !document.revision.revisionId
      || !Number.isInteger(document.revision.sequence) || document.revision.sequence < 1) {
      throw new ReviewPatchValidationError('INVALID_REVISION', `${path}.revision`);
    }
    const publishedAt = assertIsoTimestamp(document.revision.publishedAt, `${path}.revision.publishedAt`, { atOrBefore: generatedAt });
    const effectiveAt = assertIsoTimestamp(document.revision.effectiveAt, `${path}.revision.effectiveAt`, { atOrBefore: generatedAt });
    const retrievedAt = assertIsoTimestamp(document.revision.retrievedAt, `${path}.revision.retrievedAt`, { atOrBefore: generatedAt });
    if (publishedAt > effectiveAt || effectiveAt > retrievedAt) throw new ReviewPatchValidationError('INVALID_REVISION_CHRONOLOGY', `${path}.revision`);
    if (document.revision.validUntil !== undefined) {
      const validUntil = assertIsoTimestamp(document.revision.validUntil, `${path}.revision.validUntil`);
      if (validUntil < effectiveAt) throw new ReviewPatchValidationError('INVALID_REVISION_CHRONOLOGY', `${path}.revision.validUntil`);
    }
    if (document.revision.supersedesDocumentId !== undefined && !/^doc_[a-f0-9]{64}$/.test(document.revision.supersedesDocumentId)) {
      throw new ReviewPatchValidationError('INVALID_SUPERSESSION_REFERENCE', `${path}.revision.supersedesDocumentId`);
    }
    const expectedDocumentId = computeSourceDocumentId({
      schemaVersion: SOURCE_DOCUMENT_BUNDLE_SCHEMA_VERSION,
      synthetic: document.synthetic,
      source: {
        sourceClass: document.sourceClass,
        publisher: document.publisher,
        title: document.title,
        documentNumber: document.documentNumber,
        sourceUrl: document.sourceUrl,
        documentType: document.documentType,
        mimeType: document.mimeType,
        language: document.language,
        vertical: 'datacenter',
        jurisdiction: document.jurisdiction,
        domain: document.domain,
        productFamilies: document.productFamilies,
        authenticityStatus: document.authenticityStatus,
        redistributionStatus: document.redistributionStatus
      },
      revision: document.revision,
      file: {
        sha256: document.documentSha256,
        byteLength: document.documentByteLength,
        contentSha256: document.normalizedContentSha256
      }
    });
    if (document.documentId !== expectedDocumentId) throw new ReviewPatchValidationError('DOCUMENT_ID_MISMATCH', `${path}.documentId`);
    byId.set(document.documentId, document);
  }
  const seenRevisionIds = new Set();
  const seenSeriesSequence = new Set();
  const successorByTarget = new Map();
  const metadataBySourceFileSha = new Map();
  const seriesGroups = new Map();
  for (const document of byId.values()) {
    const path = `$.sourceDocuments.${document.documentId}`;
    const sourceFileMetadata = canonicalStringify({
      source: {
        sourceClass: document.sourceClass,
        publisher: document.publisher,
        title: document.title,
        documentNumber: document.documentNumber,
        sourceUrl: document.sourceUrl,
        documentType: document.documentType,
        mimeType: document.mimeType,
        language: document.language,
        vertical: 'datacenter',
        jurisdiction: document.jurisdiction,
        domain: document.domain,
        productFamilies: document.productFamilies,
        authenticityStatus: document.authenticityStatus,
        redistributionStatus: document.redistributionStatus
      },
      revision: document.revision,
      byteLength: document.documentByteLength,
      contentSha256: document.normalizedContentSha256
    });
    const priorFileMetadata = metadataBySourceFileSha.get(document.documentSha256);
    if (priorFileMetadata !== undefined && priorFileMetadata !== sourceFileMetadata) {
      throw new ReviewPatchValidationError('SOURCE_FILE_METADATA_CONFLICT', `${path}.documentSha256`);
    }
    metadataBySourceFileSha.set(document.documentSha256, sourceFileMetadata);
    const revisionIdentity = `${document.revision.seriesId}\0${document.revision.revisionId}`;
    if (seenRevisionIds.has(revisionIdentity)) throw new ReviewPatchValidationError('DUPLICATE_REVISION_ID', path);
    seenRevisionIds.add(revisionIdentity);
    const sequenceIdentity = `${document.revision.seriesId}\0${document.revision.sequence}`;
    if (seenSeriesSequence.has(sequenceIdentity)) throw new ReviewPatchValidationError('DUPLICATE_REVISION_SEQUENCE', path);
    seenSeriesSequence.add(sequenceIdentity);
    const group = seriesGroups.get(document.revision.seriesId) || [];
    group.push(document);
    seriesGroups.set(document.revision.seriesId, group);

    const targetId = document.revision.supersedesDocumentId;
    if (!targetId) continue;
    const target = byId.get(targetId);
    if (!target
      || document.revision.sequence < 2
      || target.revision.seriesId !== document.revision.seriesId
      || target.revision.sequence + 1 !== document.revision.sequence
      || target.revision.publishedAt >= document.revision.publishedAt) {
      throw new ReviewPatchValidationError('INVALID_SUPERSESSION_REFERENCE', `${path}.revision.supersedesDocumentId`);
    }
    if (successorByTarget.has(targetId)) {
      throw new ReviewPatchValidationError('SUPERSESSION_FORK_REFUSED', `${path}.revision.supersedesDocumentId`);
    }
    successorByTarget.set(targetId, document.documentId);
  }
  for (const group of seriesGroups.values()) {
    group.sort((left, right) => left.revision.sequence - right.revision.sequence || compareAscii(left.documentId, right.documentId));
    for (let index = 1; index < group.length; index += 1) {
      if (group[index].revision.supersedesDocumentId !== group[index - 1].documentId) {
        throw new ReviewPatchValidationError('SUPERSESSION_LINK_REQUIRED', `$.sourceDocuments.${group[index].documentId}.revision.supersedesDocumentId`);
      }
    }
  }
  return byId;
}

function validateSerializedCandidate(rawCandidate, path) {
  if (!isPlainObject(rawCandidate) || typeof rawCandidate.candidateId !== 'string') {
    throw new ReviewPatchValidationError('SERIALIZED_CANDIDATE_ID_REQUIRED', `${path}.candidateId`);
  }
  let candidate;
  try {
    candidate = validateCandidate(rawCandidate);
  } catch (error) {
    throw new ReviewPatchValidationError(error.code || 'INVALID_CANDIDATE', error.path ? `${path}:${error.path}` : path);
  }
  if (canonicalStringify(rawCandidate) !== canonicalStringify(candidate)) {
    throw new ReviewPatchValidationError('NONCANONICAL_SERIALIZED_CANDIDATE', path);
  }
  return candidate;
}

function validateProjectedApprovalDecision(candidate, rawDecision, path) {
  assertExactKeys(rawDecision, new Set(['decisionId', 'decision', 'reasonCodes', 'acknowledgements']), path);
  if (rawDecision.decision !== 'APPROVE_FOR_REPOSITORY_REVIEW') {
    throw new ReviewPatchValidationError('APPROVED_RECORD_DECISION_INVALID', `${path}.decision`);
  }
  let decision;
  try {
    decision = createReviewDecision({
      candidate,
      decision: rawDecision.decision,
      reasonCodes: rawDecision.reasonCodes,
      relatedCandidateIds: []
    });
  } catch (error) {
    throw new ReviewPatchValidationError(error.code || 'INVALID_APPROVAL_DECISION', error.path ? `${path}:${error.path}` : path);
  }
  const expectedProjection = {
    decisionId: decision.decisionId,
    decision: decision.decision,
    reasonCodes: decision.reasonCodes,
    acknowledgements: decision.acknowledgements
  };
  if (canonicalStringify(rawDecision) !== canonicalStringify(expectedProjection)) {
    throw new ReviewPatchValidationError('NONCANONICAL_APPROVAL_DECISION', path);
  }
  return decision;
}

export function validateReviewPatch(rawPatch) {
  if (!isPlainObject(rawPatch)) throw new ReviewPatchValidationError('PATCH_OBJECT_REQUIRED');
  assertSafeArtifact(rawPatch);
  assertPatchSafe(rawPatch);
  assertExactKeys(rawPatch, new Set([
    'schemaVersion', 'patchId', 'boundary', 'productionReady', 'productionReviewerWorkflowReady', 'issue165Status',
    'repositoryReviewRequired', 'automaticVerification', 'customerUseAllowed', 'proofExecutionApproved', 'reviewerIdentity',
    'generatedAt', 'base', 'scope', 'sourceDocuments', 'evidenceAnchors', 'approvedCandidates',
    'relationshipReviews', 'relationshipDispositions', 'sourceFileSuggestions', 'metrics'
  ]), '$');
  if (rawPatch.schemaVersion !== REVIEW_PATCH_SCHEMA_VERSION) throw new ReviewPatchValidationError('UNSUPPORTED_PATCH_SCHEMA', '$.schemaVersion');
  if (rawPatch.boundary !== 'NOT_PRODUCTION_EVIDENCE'
    || rawPatch.productionReady !== false
    || rawPatch.productionReviewerWorkflowReady !== false
    || rawPatch.issue165Status !== 'HOLD'
    || rawPatch.repositoryReviewRequired !== true
    || rawPatch.automaticVerification !== false
    || rawPatch.customerUseAllowed !== false
    || rawPatch.proofExecutionApproved !== false
    || rawPatch.reviewerIdentity !== 'NOT_COLLECTED') {
    throw new ReviewPatchValidationError('PATCH_BOUNDARY_INVALID');
  }
  validateGeneratedAt(rawPatch.generatedAt);
  validateBase(rawPatch.base);
  assertExactKeys(rawPatch.scope, new Set(['vertical', 'domain', 'jurisdiction', 'productFamilies']), '$.scope');
  if (canonicalStringify(rawPatch.scope) !== canonicalStringify({
    vertical: 'datacenter',
    domain: 'electrical_power',
    jurisdiction: 'KR',
    productFamilies: ['medium_voltage_switchgear', 'transformer']
  })) throw new ReviewPatchValidationError('PATCH_SCOPE_INVALID', '$.scope');
  for (const key of ['sourceDocuments', 'evidenceAnchors', 'approvedCandidates', 'relationshipReviews', 'relationshipDispositions', 'sourceFileSuggestions']) {
    if (!Array.isArray(rawPatch[key])) throw new ReviewPatchValidationError('ARRAY_REQUIRED', `$.${key}`);
  }
  if (rawPatch.approvedCandidates.length === 0 || rawPatch.approvedCandidates.length > REVIEW_PATCH_LIMITS.maxApprovedCandidates) {
    throw new ReviewPatchValidationError('APPROVED_CANDIDATE_COUNT_INVALID', '$.approvedCandidates');
  }
  assertSorted(rawPatch.sourceDocuments, 'documentId', '$.sourceDocuments');
  assertSorted(rawPatch.evidenceAnchors, 'evidenceAnchorId', '$.evidenceAnchors');
  assertSorted(rawPatch.approvedCandidates.map((record) => record.candidate), 'candidateId', '$.approvedCandidates');
  assertSorted(rawPatch.relationshipReviews.map((record) => record.candidate), 'candidateId', '$.relationshipReviews');
  assertSorted(rawPatch.relationshipDispositions, 'relationshipId', '$.relationshipDispositions');
  assertSorted(rawPatch.sourceFileSuggestions, 'candidateId', '$.sourceFileSuggestions');
  const sourceDocumentById = validateProjectedSourceDocuments(rawPatch.sourceDocuments, rawPatch.generatedAt);
  const sourceDocumentIds = new Set(sourceDocumentById.keys());
  const anchorById = new Map();
  let aggregateQuoteCodePoints = 0;
  for (const [index, anchor] of rawPatch.evidenceAnchors.entries()) {
    assertExactKeys(anchor, new Set([
      'evidenceAnchorId', 'documentId', 'documentNumber', 'documentSha256', 'revision', 'pageLocator',
      'extractedPageOrdinal', 'pageTextSha256', 'pageCodePointLength', 'selection'
    ]), `$.evidenceAnchors[${index}]`);
    const sourceDocument = sourceDocumentById.get(anchor.documentId);
    if (!sourceDocument) throw new ReviewPatchValidationError('ANCHOR_DOCUMENT_UNKNOWN', `$.evidenceAnchors[${index}]`);
    if (!SHA256_HEX.test(anchor.documentSha256) || !SHA256_HEX.test(anchor.pageTextSha256)) throw new ReviewPatchValidationError('INVALID_ANCHOR_HASH', `$.evidenceAnchors[${index}]`);
    if (anchor.documentSha256 !== sourceDocument.documentSha256 || anchor.documentNumber !== sourceDocument.documentNumber) {
      throw new ReviewPatchValidationError('ANCHOR_DOCUMENT_BINDING_MISMATCH', `$.evidenceAnchors[${index}]`);
    }
    assertExactKeys(anchor.revision, new Set(['seriesId', 'revisionId', 'sequence', 'publishedAt']), `$.evidenceAnchors[${index}].revision`);
    if (anchor.revision?.seriesId !== sourceDocument.revision.seriesId
      || anchor.revision?.revisionId !== sourceDocument.revision.revisionId
      || anchor.revision?.sequence !== sourceDocument.revision.sequence
      || anchor.revision?.publishedAt !== sourceDocument.revision.publishedAt) {
      throw new ReviewPatchValidationError('ANCHOR_REVISION_BINDING_MISMATCH', `$.evidenceAnchors[${index}].revision`);
    }
    assertExactKeys(anchor.pageLocator, new Set(['type', 'value']), `$.evidenceAnchors[${index}].pageLocator`);
    const locatorValue = typeof anchor.pageLocator.value === 'string'
      ? anchor.pageLocator.value.normalize('NFC').replace(/\s+/gu, ' ').trim()
      : '';
    if (!['DOCUMENT_PAGE', 'PRINTED_PAGE', 'SECTION'].includes(anchor.pageLocator.type)
      || !locatorValue
      || locatorValue !== anchor.pageLocator.value
      || countCodePoints(locatorValue) > EVIDENCE_DOCUMENT_LIMITS.maxIdentifierCodePoints) {
      throw new ReviewPatchValidationError('INVALID_PAGE_LOCATOR', `$.evidenceAnchors[${index}].pageLocator`);
    }
    if (!Number.isInteger(anchor.extractedPageOrdinal)
      || anchor.extractedPageOrdinal < 1
      || anchor.extractedPageOrdinal > EVIDENCE_DOCUMENT_LIMITS.maxPagesPerDocument) {
      throw new ReviewPatchValidationError('INVALID_PAGE_ORDINAL', `$.evidenceAnchors[${index}].extractedPageOrdinal`);
    }
    if (!Number.isInteger(anchor.pageCodePointLength)
      || anchor.pageCodePointLength < 1
      || anchor.pageCodePointLength > EVIDENCE_DOCUMENT_LIMITS.maxPageCodePoints) {
      throw new ReviewPatchValidationError('INVALID_PAGE_LENGTH', `$.evidenceAnchors[${index}].pageCodePointLength`);
    }
    if (anchor.pageLocator.type === 'DOCUMENT_PAGE' && anchor.pageLocator.value !== String(anchor.extractedPageOrdinal)) {
      throw new ReviewPatchValidationError('PAGE_LOCATOR_ORDINAL_MISMATCH', `$.evidenceAnchors[${index}].pageLocator.value`);
    }
    assertExactKeys(anchor.selection, new Set([
      'normalizationVersion', 'startCodePoint', 'endCodePoint', 'directQuote', 'quoteSha256',
      'occurrenceIndex', 'occurrenceCount', 'prefixContextCodePoints', 'prefixContextSha256',
      'suffixContextCodePoints', 'suffixContextSha256'
    ]), `$.evidenceAnchors[${index}].selection`);
    if (anchor.selection.normalizationVersion !== PAGE_TEXT_NORMALIZATION_VERSION) {
      throw new ReviewPatchValidationError('UNSUPPORTED_ANCHOR_NORMALIZATION', `$.evidenceAnchors[${index}].selection.normalizationVersion`);
    }
    if (sha256(anchor.selection.directQuote) !== anchor.selection.quoteSha256) throw new ReviewPatchValidationError('QUOTE_HASH_MISMATCH', `$.evidenceAnchors[${index}].selection`);
    const length = countCodePoints(anchor.selection.directQuote);
    if (length === 0 || length > REVIEW_PATCH_LIMITS.maxQuoteCodePoints) throw new ReviewPatchValidationError('PATCH_QUOTE_LENGTH_INVALID', `$.evidenceAnchors[${index}].selection`);
    if (!Number.isInteger(anchor.selection.startCodePoint)
      || !Number.isInteger(anchor.selection.endCodePoint)
      || anchor.selection.startCodePoint < 0
      || anchor.selection.endCodePoint <= anchor.selection.startCodePoint
      || anchor.selection.endCodePoint > anchor.pageCodePointLength
      || anchor.selection.endCodePoint - anchor.selection.startCodePoint !== length
      || !Number.isInteger(anchor.selection.occurrenceIndex)
      || !Number.isInteger(anchor.selection.occurrenceCount)
      || anchor.selection.occurrenceIndex < 1
      || anchor.selection.occurrenceIndex > anchor.selection.occurrenceCount
      || anchor.selection.occurrenceCount > anchor.pageCodePointLength - length + 1) {
      throw new ReviewPatchValidationError('INVALID_QUOTE_SELECTION', `$.evidenceAnchors[${index}].selection`);
    }
    for (const key of ['prefixContextSha256', 'suffixContextSha256']) {
      if (!SHA256_HEX.test(anchor.selection[key])) throw new ReviewPatchValidationError('INVALID_CONTEXT_HASH', `$.evidenceAnchors[${index}].selection.${key}`);
    }
    const emptyContextSha256 = sha256('');
    if ((anchor.selection.prefixContextCodePoints === 0) !== (anchor.selection.prefixContextSha256 === emptyContextSha256)
      || (anchor.selection.suffixContextCodePoints === 0) !== (anchor.selection.suffixContextSha256 === emptyContextSha256)) {
      throw new ReviewPatchValidationError('CONTEXT_HASH_LENGTH_MISMATCH', `$.evidenceAnchors[${index}].selection`);
    }
    for (const key of ['prefixContextCodePoints', 'suffixContextCodePoints']) {
      if (!Number.isInteger(anchor.selection[key])
        || anchor.selection[key] < 0
        || anchor.selection[key] > EVIDENCE_DOCUMENT_LIMITS.contextCodePoints) {
        throw new ReviewPatchValidationError('INVALID_CONTEXT_LENGTH', `$.evidenceAnchors[${index}].selection.${key}`);
      }
    }
    if (anchor.selection.prefixContextCodePoints !== Math.min(
      EVIDENCE_DOCUMENT_LIMITS.contextCodePoints,
      anchor.selection.startCodePoint
    ) || anchor.selection.suffixContextCodePoints !== Math.min(
      EVIDENCE_DOCUMENT_LIMITS.contextCodePoints,
      anchor.pageCodePointLength - anchor.selection.endCodePoint
    )) {
      throw new ReviewPatchValidationError('INVALID_CONTEXT_LENGTH', `$.evidenceAnchors[${index}].selection`);
    }
    if (anchor.selection.startCodePoint === 0 && anchor.selection.endCodePoint === anchor.pageCodePointLength) {
      throw new ReviewPatchValidationError('FULL_PAGE_EXCERPT_REFUSED', `$.evidenceAnchors[${index}].selection`);
    }
    const expectedAnchorId = computePageEvidenceAnchorId({
      schemaVersion: PAGE_EVIDENCE_ANCHOR_SCHEMA_VERSION,
      documentId: anchor.documentId,
      documentNumber: anchor.documentNumber,
      sourceFileSha256: anchor.documentSha256,
      revision: anchor.revision,
      page: {
        extractedPageOrdinal: anchor.extractedPageOrdinal,
        locator: anchor.pageLocator,
        textSha256: anchor.pageTextSha256,
        textCodePoints: anchor.pageCodePointLength
      },
      selection: {
        normalizationVersion: anchor.selection.normalizationVersion,
        startCodePoint: anchor.selection.startCodePoint,
        endCodePoint: anchor.selection.endCodePoint,
        quote: anchor.selection.directQuote,
        quoteSha256: anchor.selection.quoteSha256,
        occurrenceIndex: anchor.selection.occurrenceIndex,
        occurrenceCount: anchor.selection.occurrenceCount,
        prefixContextCodePoints: anchor.selection.prefixContextCodePoints,
        prefixContextSha256: anchor.selection.prefixContextSha256,
        suffixContextCodePoints: anchor.selection.suffixContextCodePoints,
        suffixContextSha256: anchor.selection.suffixContextSha256
      }
    });
    if (anchor.evidenceAnchorId !== expectedAnchorId) {
      throw new ReviewPatchValidationError('ANCHOR_ID_MISMATCH', `$.evidenceAnchors[${index}].evidenceAnchorId`);
    }
    aggregateQuoteCodePoints += length;
    anchorById.set(anchor.evidenceAnchorId, anchor);
  }
  if (aggregateQuoteCodePoints > REVIEW_PATCH_LIMITS.maxAggregateQuoteCodePoints) throw new ReviewPatchValidationError('PATCH_AGGREGATE_QUOTE_BUDGET_EXCEEDED');
  const relationshipReviewByCandidateId = new Map();
  for (const [index, record] of rawPatch.relationshipReviews.entries()) {
    const path = `$.relationshipReviews[${index}]`;
    assertExactKeys(record, new Set(['candidate', 'decision', 'relationshipIds']), path);
    let candidate;
    let decision;
    try {
      candidate = validateSerializedCandidate(record.candidate, `${path}.candidate`);
      decision = validateReviewDecision(record.decision);
    } catch (error) {
      throw new ReviewPatchValidationError(error.code || 'INVALID_RELATIONSHIP_REVIEW', error.path ? `${path}:${error.path}` : path);
    }
    const anchor = anchorById.get(candidate.evidenceAnchorId);
    const sourceDocument = sourceDocumentById.get(candidate.documentId);
    if (!sourceDocument || !anchor || anchor.documentId !== candidate.documentId) {
      throw new ReviewPatchValidationError('RELATIONSHIP_REVIEW_EVIDENCE_MISMATCH', path);
    }
    assertCandidateSourceScope(candidate, sourceDocument, path);
    if (decision.candidateId !== candidate.candidateId
      || decision.documentId !== candidate.documentId
      || decision.evidenceAnchorId !== candidate.evidenceAnchorId
      || canonicalStringify(decision.candidateSnapshot) !== canonicalStringify(expectedDecisionSnapshot(candidate))) {
      throw new ReviewPatchValidationError('RELATIONSHIP_REVIEW_DECISION_MISMATCH', path);
    }
    if (!Array.isArray(record.relationshipIds)
      || canonicalStringify(record.relationshipIds) !== canonicalStringify([...new Set(record.relationshipIds)].sort(compareAscii))
      || record.relationshipIds.some((relationshipId) => !/^rel_[a-f0-9]{64}$/.test(relationshipId))) {
      throw new ReviewPatchValidationError('RELATIONSHIP_REVIEW_LINKS_INVALID', `${path}.relationshipIds`);
    }
    relationshipReviewByCandidateId.set(candidate.candidateId, { candidate, decision, relationshipIds: record.relationshipIds });
  }
  const approvedIds = new Set();
  const approvedRecordById = new Map();
  for (const [index, record] of rawPatch.approvedCandidates.entries()) {
    assertExactKeys(record, new Set(['candidate', 'decision', 'relationshipIds']), `$.approvedCandidates[${index}]`);
    const candidate = validateSerializedCandidate(record.candidate, `$.approvedCandidates[${index}].candidate`);
    const candidateAnchor = anchorById.get(candidate.evidenceAnchorId);
    if (!candidateAnchor || candidateAnchor.documentId !== candidate.documentId) throw new ReviewPatchValidationError('CANDIDATE_ANCHOR_UNKNOWN', `$.approvedCandidates[${index}]`);
    assertCandidateSourceScope(candidate, sourceDocumentById.get(candidate.documentId), `$.approvedCandidates[${index}].candidate`);
    if (rawPatch.sourceDocuments.some((document) => document.revision.supersedesDocumentId === candidate.documentId)) {
      throw new ReviewPatchValidationError('APPROVED_SOURCE_SUPERSEDED', `$.approvedCandidates[${index}].candidate.documentId`);
    }
    assertApprovedCandidateTemporalScope(
      candidate,
      sourceDocumentById.get(candidate.documentId),
      rawPatch.generatedAt,
      `$.approvedCandidates[${index}].candidate`
    );
    validateProjectedApprovalDecision(candidate, record.decision, `$.approvedCandidates[${index}].decision`);
    if (!Array.isArray(record.relationshipIds) || canonicalStringify(record.relationshipIds) !== canonicalStringify([...new Set(record.relationshipIds)].sort(compareAscii))) {
      throw new ReviewPatchValidationError('NONCANONICAL_RELATIONSHIP_LINKS', `$.approvedCandidates[${index}].relationshipIds`);
    }
    approvedIds.add(candidate.candidateId);
    approvedRecordById.set(candidate.candidateId, record);
  }
  const relationshipCandidateUniverse = new Map([...relationshipReviewByCandidateId.entries()]
    .map(([candidateId, { candidate }]) => [candidateId, candidate]));
  for (const [candidateId, record] of approvedRecordById.entries()) {
    const prior = relationshipCandidateUniverse.get(candidateId);
    if (prior && canonicalStringify(prior) !== canonicalStringify(record.candidate)) {
      throw new ReviewPatchValidationError('RELATIONSHIP_CANDIDATE_CONTENT_MISMATCH', `$.approvedCandidates.${candidateId}`);
    }
    relationshipCandidateUniverse.set(candidateId, record.candidate);
  }
  let recomputedRelationshipReport;
  try {
    recomputedRelationshipReport = analyzeProjectedCandidateRelationships(
      [...relationshipCandidateUniverse.values()],
      { documents: rawPatch.sourceDocuments }
    );
  } catch (error) {
    throw new ReviewPatchValidationError(error.code || 'RELATIONSHIP_RECOMPUTATION_FAILED', error.path || '$.relationshipReviews');
  }
  const recomputedRelationshipById = new Map(recomputedRelationshipReport.relationships
    .map((relationship) => [relationship.relationshipId, relationship]));
  if (recomputedRelationshipById.size !== rawPatch.relationshipDispositions.length) {
    throw new ReviewPatchValidationError('RELATIONSHIP_SET_MISMATCH', '$.relationshipDispositions');
  }
  const recomputedParticipantIds = new Set(recomputedRelationshipReport.relationships.flatMap((relationship) => relationship.candidateIds));
  if (recomputedParticipantIds.size !== relationshipReviewByCandidateId.size
    || [...relationshipReviewByCandidateId.keys()].some((candidateId) => !recomputedParticipantIds.has(candidateId))) {
    throw new ReviewPatchValidationError('RELATIONSHIP_REVIEW_SET_MISMATCH', '$.relationshipReviews');
  }
  for (const [candidateId, review] of relationshipReviewByCandidateId.entries()) {
    const expectedRelationshipIds = recomputedRelationshipReport.relationships
      .filter((relationship) => relationship.candidateIds.includes(candidateId))
      .map((relationship) => relationship.relationshipId)
      .sort(compareAscii);
    if (canonicalStringify(review.relationshipIds) !== canonicalStringify(expectedRelationshipIds)) {
      throw new ReviewPatchValidationError('RELATIONSHIP_REVIEW_LINK_SET_MISMATCH', `$.relationshipReviews.${candidateId}.relationshipIds`);
    }
  }
  const relationshipIds = new Set();
  const relationshipById = new Map();
  const allowedDisposition = {
    EXACT_DUPLICATE_EVIDENCE: 'EXPLICIT_DUPLICATE_DISPOSITION',
    MATERIAL_CONFLICT: 'EXPLICIT_CONFLICT_DISPOSITION',
    CONDITION_RESOLVED: 'CONDITIONS_DISTINGUISH_CLAIMS',
    SUPERSEDES: 'EXPLICIT_SUPERSESSION_DISPOSITION'
  };
  for (const [index, relationship] of rawPatch.relationshipDispositions.entries()) {
    const path = `$.relationshipDispositions[${index}]`;
    assertExactKeys(relationship, new Set([
      'relationshipId', 'type', 'candidateIds', 'supersededCandidateId', 'successorCandidateId',
      'decisionIds', 'candidateDispositions', 'disposition'
    ]), path);
    if (!/^rel_[a-f0-9]{64}$/.test(relationship.relationshipId) || relationshipIds.has(relationship.relationshipId)) throw new ReviewPatchValidationError('INVALID_RELATIONSHIP_ID', `${path}.relationshipId`);
    const expectedRelationship = recomputedRelationshipById.get(relationship.relationshipId);
    if (!expectedRelationship
      || relationship.type !== expectedRelationship.type
      || canonicalStringify(relationship.candidateIds) !== canonicalStringify(expectedRelationship.candidateIds)
      || relationship.supersededCandidateId !== expectedRelationship.supersededCandidateId
      || relationship.successorCandidateId !== expectedRelationship.successorCandidateId) {
      throw new ReviewPatchValidationError('RELATIONSHIP_IDENTITY_MISMATCH', path);
    }
    relationshipIds.add(relationship.relationshipId);
    relationshipById.set(relationship.relationshipId, relationship);
    if (allowedDisposition[relationship.type] !== relationship.disposition) throw new ReviewPatchValidationError('RELATIONSHIP_DISPOSITION_INVALID', path);
    if (!Array.isArray(relationship.candidateIds) || relationship.candidateIds.length < 2
      || relationship.candidateIds.some((candidateId) => !CANDIDATE_ID.test(candidateId))
      || canonicalStringify(relationship.candidateIds) !== canonicalStringify([...new Set(relationship.candidateIds)].sort(compareAscii))) {
      throw new ReviewPatchValidationError('RELATIONSHIP_CANDIDATES_INVALID', `${path}.candidateIds`);
    }
    if (!Array.isArray(relationship.candidateDispositions)
      || canonicalStringify(relationship.candidateDispositions.map((item) => item.candidateId)) !== canonicalStringify(relationship.candidateIds)) {
      throw new ReviewPatchValidationError('RELATIONSHIP_CANDIDATE_DISPOSITIONS_INVALID', `${path}.candidateDispositions`);
    }
    const dispositionDecisionIds = [];
    for (const [dispositionIndex, item] of relationship.candidateDispositions.entries()) {
      const itemPath = `${path}.candidateDispositions[${dispositionIndex}]`;
      assertExactKeys(item, new Set(['candidateId', 'documentId', 'evidenceAnchorId', 'decisionId', 'decision', 'reasonCodes']), itemPath);
      if (!CANDIDATE_ID.test(item.candidateId) || !DECISION_ID.test(item.decisionId)) {
        throw new ReviewPatchValidationError('RELATIONSHIP_DECISION_IDENTITY_INVALID', itemPath);
      }
      const anchor = anchorById.get(item.evidenceAnchorId);
      if (!sourceDocumentById.has(item.documentId) || !anchor || anchor.documentId !== item.documentId) {
        throw new ReviewPatchValidationError('RELATIONSHIP_EVIDENCE_BINDING_INVALID', itemPath);
      }
      if (!['APPROVE_FOR_REPOSITORY_REVIEW', 'REJECT', 'FLAG_SUPERSEDED'].includes(item.decision)
        || !Array.isArray(item.reasonCodes)
        || item.reasonCodes.some((reasonCode) => !REVIEW_REASON_CODES.includes(reasonCode))) {
        throw new ReviewPatchValidationError('RELATIONSHIP_DECISION_INVALID', itemPath);
      }
      const approvedRecord = approvedRecordById.get(item.candidateId);
      const relationshipReview = relationshipReviewByCandidateId.get(item.candidateId);
      if (!relationshipReview
        || relationshipReview.candidate.documentId !== item.documentId
        || relationshipReview.candidate.evidenceAnchorId !== item.evidenceAnchorId
        || relationshipReview.decision.decisionId !== item.decisionId
        || relationshipReview.decision.decision !== item.decision
        || canonicalStringify(relationshipReview.decision.reasonCodes) !== canonicalStringify(item.reasonCodes)) {
        throw new ReviewPatchValidationError('RELATIONSHIP_REVIEW_BINDING_INVALID', itemPath);
      }
      if (approvedRecord && (item.decision !== 'APPROVE_FOR_REPOSITORY_REVIEW' || item.decisionId !== approvedRecord.decision.decisionId)) {
        throw new ReviewPatchValidationError('RELATIONSHIP_APPROVAL_BINDING_INVALID', itemPath);
      }
      if (approvedRecord && (approvedRecord.candidate.documentId !== item.documentId
        || approvedRecord.candidate.evidenceAnchorId !== item.evidenceAnchorId)) {
        throw new ReviewPatchValidationError('RELATIONSHIP_APPROVAL_EVIDENCE_MISMATCH', itemPath);
      }
      dispositionDecisionIds.push(item.decisionId);
    }
    const decisions = relationship.candidateDispositions;
    const approvals = decisions.filter((item) => item.decision === 'APPROVE_FOR_REPOSITORY_REVIEW');
    const rejections = decisions.filter((item) => item.decision === 'REJECT');
    const superseded = decisions.filter((item) => item.decision === 'FLAG_SUPERSEDED');
    if (relationship.type === 'EXACT_DUPLICATE_EVIDENCE'
      && (approvals.length > 1
        || approvals.length + rejections.length !== decisions.length
        || rejections.some((item) => !item.reasonCodes.includes('DUPLICATE_CANDIDATE')))) {
      throw new ReviewPatchValidationError('DUPLICATE_RELATIONSHIP_UNRESOLVED', path);
    }
    if (relationship.type === 'MATERIAL_CONFLICT'
      && (approvals.length > 1 || approvals.length + rejections.length !== decisions.length)) {
      throw new ReviewPatchValidationError('MATERIAL_CONFLICT_UNRESOLVED', path);
    }
    if (relationship.type === 'CONDITION_RESOLVED'
      && approvals.length + rejections.length !== decisions.length) {
      throw new ReviewPatchValidationError('CONDITION_RESOLUTION_DISPOSITION_REQUIRED', path);
    }
    if (relationship.type === 'SUPERSEDES'
      && (superseded.length !== 1
        || !superseded[0].reasonCodes.includes('SUPERSEDED_DOCUMENT')
        || superseded[0].candidateId !== expectedRelationship.supersededCandidateId
        || !relationshipReviewByCandidateId.get(expectedRelationship.supersededCandidateId)?.decision.relatedCandidateIds.includes(expectedRelationship.successorCandidateId)
        || decisions.length !== 2
        || approvals.length + rejections.length !== 1)) {
      throw new ReviewPatchValidationError('SUPERSESSION_UNRESOLVED', path);
    }
    if (canonicalStringify(relationship.decisionIds) !== canonicalStringify(dispositionDecisionIds.sort(compareAscii))) {
      throw new ReviewPatchValidationError('RELATIONSHIP_DECISION_IDS_MISMATCH', `${path}.decisionIds`);
    }
  }
  for (const [candidateId, review] of relationshipReviewByCandidateId.entries()) {
    const approvedRecord = approvedRecordById.get(candidateId);
    if (review.decision.decision === 'APPROVE_FOR_REPOSITORY_REVIEW') {
      if (!approvedRecord
        || canonicalStringify(approvedRecord.candidate) !== canonicalStringify(review.candidate)
        || approvedRecord.decision.decisionId !== review.decision.decisionId) {
        throw new ReviewPatchValidationError('RELATIONSHIP_APPROVED_CANDIDATE_MISMATCH', `$.relationshipReviews.${candidateId}`);
      }
    } else if (approvedRecord) {
      throw new ReviewPatchValidationError('RELATIONSHIP_NONAPPROVAL_INCLUDED_AS_APPROVED', `$.relationshipReviews.${candidateId}`);
    }
  }
  const closureCandidates = new Map();
  for (const record of rawPatch.approvedCandidates) closureCandidates.set(record.candidate.candidateId, record.candidate);
  for (const { candidate } of relationshipReviewByCandidateId.values()) closureCandidates.set(candidate.candidateId, candidate);
  const referencedDocumentIds = addRevisionSeriesContext(
    [...closureCandidates.values()].map((candidate) => candidate.documentId),
    sourceDocumentById
  );
  const referencedAnchorIds = new Set([...closureCandidates.values()].map((candidate) => candidate.evidenceAnchorId));
  if (referencedDocumentIds.size !== sourceDocumentById.size
    || [...sourceDocumentById.keys()].some((documentId) => !referencedDocumentIds.has(documentId))) {
    throw new ReviewPatchValidationError('PATCH_DOCUMENT_CLOSURE_MISMATCH', '$.sourceDocuments');
  }
  if (referencedAnchorIds.size !== anchorById.size
    || [...anchorById.keys()].some((anchorId) => !referencedAnchorIds.has(anchorId))) {
    throw new ReviewPatchValidationError('PATCH_ANCHOR_CLOSURE_MISMATCH', '$.evidenceAnchors');
  }
  for (const [candidateId, record] of approvedRecordById.entries()) {
    const expectedRelationshipIds = [...relationshipById.values()]
      .filter((relationship) => relationship.candidateIds.includes(candidateId))
      .map((relationship) => relationship.relationshipId)
      .sort(compareAscii);
    if (canonicalStringify(record.relationshipIds) !== canonicalStringify(expectedRelationshipIds)) {
      throw new ReviewPatchValidationError('RELATIONSHIP_LINK_SET_MISMATCH', `$.approvedCandidates.${candidateId}.relationshipIds`);
    }
    for (const relationshipId of record.relationshipIds) {
      if (!relationshipIds.has(relationshipId)) throw new ReviewPatchValidationError('UNKNOWN_RELATIONSHIP_LINK', `$.approvedCandidates.${candidateId}.relationshipIds`);
      const relationship = rawPatch.relationshipDispositions.find((item) => item.relationshipId === relationshipId);
      if (!relationship.candidateIds.includes(candidateId)) throw new ReviewPatchValidationError('RELATIONSHIP_LINK_BINDING_INVALID', `$.approvedCandidates.${candidateId}.relationshipIds`);
    }
  }
  for (const [index, suggestion] of rawPatch.sourceFileSuggestions.entries()) {
    assertExactKeys(suggestion, new Set(['candidateId', 'registryPath', 'sourceField']), `$.sourceFileSuggestions[${index}]`);
    if (!approvedIds.has(suggestion.candidateId) || suggestion.registryPath !== rawPatch.base.registryPath) {
      throw new ReviewPatchValidationError('SOURCE_SUGGESTION_BINDING_INVALID', `$.sourceFileSuggestions[${index}]`);
    }
    const expectedField = `claims.workbench_${suggestion.candidateId.slice('cand_'.length, 'cand_'.length + 24)}`;
    if (suggestion.sourceField !== expectedField) throw new ReviewPatchValidationError('SOURCE_SUGGESTION_FIELD_INVALID', `$.sourceFileSuggestions[${index}].sourceField`);
  }
  if (rawPatch.sourceFileSuggestions.length !== approvedIds.size
    || [...approvedIds].some((candidateId) => !rawPatch.sourceFileSuggestions.some((suggestion) => suggestion.candidateId === candidateId))) {
    throw new ReviewPatchValidationError('SOURCE_SUGGESTION_SET_MISMATCH', '$.sourceFileSuggestions');
  }
  assertExactKeys(rawPatch.metrics, new Set([
    'approvedCandidateCount', 'sourceDocumentCount', 'evidenceAnchorCount',
    'relationshipReviewCount', 'relationshipDispositionCount', 'sourceFileSuggestionCount', 'aggregateQuoteCodePoints'
  ]), '$.metrics');
  if (rawPatch.metrics?.aggregateQuoteCodePoints !== aggregateQuoteCodePoints
    || rawPatch.metrics?.approvedCandidateCount !== rawPatch.approvedCandidates.length
    || rawPatch.metrics?.sourceDocumentCount !== rawPatch.sourceDocuments.length
    || rawPatch.metrics?.evidenceAnchorCount !== rawPatch.evidenceAnchors.length
    || rawPatch.metrics?.relationshipReviewCount !== rawPatch.relationshipReviews.length
    || rawPatch.metrics?.relationshipDispositionCount !== rawPatch.relationshipDispositions.length
    || rawPatch.metrics?.sourceFileSuggestionCount !== rawPatch.sourceFileSuggestions.length) {
    throw new ReviewPatchValidationError('PATCH_METRICS_MISMATCH', '$.metrics');
  }
  const expectedPatchId = `patch_${sha256(patchIdentityPayload(rawPatch))}`;
  if (rawPatch.patchId !== expectedPatchId) throw new ReviewPatchValidationError('PATCH_ID_MISMATCH', '$.patchId');
  const bytes = Buffer.byteLength(canonicalStringify(rawPatch), 'utf8');
  if (bytes > REVIEW_PATCH_LIMITS.maxSerializedBytes) throw new ReviewPatchValidationError('PATCH_TOO_LARGE');
  return deepFreeze(structuredClone(rawPatch));
}

export function serializeReviewPatch(patch, { inject = {} } = {}) {
  const validated = validateReviewPatch(patch);
  inject.beforePatchSerialization?.(validated);
  const serialized = `${canonicalStringify(validated)}\n`;
  if (Buffer.byteLength(serialized, 'utf8') > REVIEW_PATCH_LIMITS.maxSerializedBytes) {
    throw new ReviewPatchValidationError('PATCH_TOO_LARGE');
  }
  inject.afterPatchSerialization?.(serialized);
  return serialized;
}
