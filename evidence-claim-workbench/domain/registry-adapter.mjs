import {
  canonicalStringify,
  createValidatedClaimRegistry,
  deriveCustomerUse,
  sha256
} from '../../knowledge/claim-registry/index.mjs';
import { CLAIM_REGISTRY_VERTICAL_ID } from './constants.mjs';
import { validateCandidate } from './candidates.mjs';
import { validateReviewPatch } from './review-patch.mjs';

export const DRAFT_REGISTRY_PREVIEW_SCHEMA_VERSION = 'claim-registry-draft-preview-v0';
export const WORKBENCH_DRAFT_PROVENANCE_ORIGIN = 'WORKBENCH_REVIEW_PATCH';

const SAFE_REGISTRY_PATH = /^knowledge\/claim-registry\/[a-z0-9][a-z0-9._/-]*\.json$/;

export class RegistryAdapterError extends Error {
  constructor(code, path = '$') {
    super(`${code} at ${path}`);
    this.name = 'RegistryAdapterError';
    this.code = code;
    this.path = path;
  }
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertExactKeys(value, allowed, path) {
  if (!isPlainObject(value)) throw new RegistryAdapterError('OBJECT_REQUIRED', path);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new RegistryAdapterError('ADAPTER_FIELD_REFUSED', `${path}.${key}`);
  }
}

function assertTimestamp(value, path) {
  if (typeof value !== 'string') throw new RegistryAdapterError('INVALID_DATE', path);
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) throw new RegistryAdapterError('INVALID_DATE', path);
  return value;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) deepFreeze(nested);
  return value;
}

function sourceFieldFor(candidate) {
  return `claims.workbench_${candidate.candidateId.slice('cand_'.length, 'cand_'.length + 24)}`;
}

export function candidateToRegistryClaim(input) {
  assertExactKeys(input, new Set(['candidate', 'sourceDocument', 'evidenceAnchor', 'registryPath']), '$.adapterInput');
  const candidate = validateCandidate(input.candidate);
  const sourceDocument = input.sourceDocument;
  const evidenceAnchor = input.evidenceAnchor;
  if (!isPlainObject(sourceDocument) || sourceDocument.documentId !== candidate.documentId) {
    throw new RegistryAdapterError('CANDIDATE_DOCUMENT_BINDING_MISMATCH', '$.sourceDocument');
  }
  if (!isPlainObject(evidenceAnchor)
    || evidenceAnchor.evidenceAnchorId !== candidate.evidenceAnchorId
    || evidenceAnchor.documentId !== candidate.documentId) {
    throw new RegistryAdapterError('CANDIDATE_ANCHOR_BINDING_MISMATCH', '$.evidenceAnchor');
  }
  if (typeof input.registryPath !== 'string'
    || !SAFE_REGISTRY_PATH.test(input.registryPath)
    || input.registryPath.includes('..')
    || input.registryPath.includes('//')) {
    throw new RegistryAdapterError('REGISTRY_PATH_REFUSED', '$.registryPath');
  }
  if (sourceDocument.synthetic !== candidate.synthetic) throw new RegistryAdapterError('SYNTHETIC_BOUNDARY_MISMATCH', '$.sourceDocument.synthetic');
  if (!Array.isArray(sourceDocument.productFamilies)
    || !sourceDocument.productFamilies.includes(candidate.subject.id)) {
    throw new RegistryAdapterError('PRODUCT_FAMILY_BOUNDARY_MISMATCH', '$.sourceDocument.productFamilies');
  }
  const directQuote = evidenceAnchor.selection?.directQuote;
  if (typeof directQuote !== 'string' || directQuote.length === 0 || [...directQuote].length > 500) {
    throw new RegistryAdapterError('DIRECT_QUOTE_INVALID', '$.evidenceAnchor.selection.directQuote');
  }
  const validUntil = candidate.validity.type === 'VALID_UNTIL' ? candidate.validity.validUntil : '';
  return {
    schemaVersion: 'evidence-claim-v1',
    claimKey: `workbench_${candidate.candidateId.slice('cand_'.length, 'cand_'.length + 24)}`,
    claimType: candidate.claimType,
    synthetic: candidate.synthetic,
    subject: candidate.subject,
    statement: candidate.statement,
    value: candidate.value,
    applicability: {
      verticalId: CLAIM_REGISTRY_VERTICAL_ID,
      productFamilyIds: [candidate.applicability.productFamily],
      projectStages: candidate.applicability.projectStages,
      jurisdictions: [candidate.applicability.jurisdiction],
      conditions: candidate.applicability.conditions
    },
    evidence: [{
      sourceTitle: sourceDocument.title,
      sourceUrl: sourceDocument.sourceUrl,
      directQuote,
      publishedAt: assertTimestamp(sourceDocument.revision?.publishedAt, '$.sourceDocument.revision.publishedAt'),
      effectiveAt: assertTimestamp(sourceDocument.revision?.effectiveAt, '$.sourceDocument.revision.effectiveAt'),
      retrievedAt: assertTimestamp(sourceDocument.revision?.retrievedAt, '$.sourceDocument.revision.retrievedAt')
    }],
    verification: {
      reviewed: false,
      verifiedAt: '',
      validUntil,
      conflictClaimKeys: [],
      retracted: false,
      retractionReason: ''
    },
    provenance: {
      origin: WORKBENCH_DRAFT_PROVENANCE_ORIGIN,
      profileId: '',
      sourcePath: input.registryPath,
      sourceField: sourceFieldFor(candidate)
    }
  };
}

export function adaptReviewPatchToDraftClaims(rawPatch) {
  const patch = validateReviewPatch(rawPatch);
  const documentById = new Map(patch.sourceDocuments.map((document) => [document.documentId, document]));
  const anchorById = new Map(patch.evidenceAnchors.map((anchor) => [anchor.evidenceAnchorId, anchor]));
  return patch.approvedCandidates.map((record) => candidateToRegistryClaim({
    candidate: record.candidate,
    sourceDocument: documentById.get(record.candidate.documentId),
    evidenceAnchor: anchorById.get(record.candidate.evidenceAnchorId),
    registryPath: patch.base.registryPath
  }));
}

function normalizeAsOf(value) {
  return assertTimestamp(value, '$.asOf');
}

export function createDraftRegistryPreview(rawPatch, { asOf, inject = {} } = {}) {
  inject.beforeRegistryPreview?.(rawPatch);
  const patch = validateReviewPatch(rawPatch);
  const fixedAsOf = normalizeAsOf(asOf ?? patch.generatedAt);
  const rawClaims = adaptReviewPatchToDraftClaims(patch);
  let registry;
  try {
    registry = createValidatedClaimRegistry({ claims: rawClaims }, { asOf: fixedAsOf });
  } catch (error) {
    throw new RegistryAdapterError(error.code || 'REGISTRY_VALIDATION_FAILED', error.path || '$.registry');
  }
  const claims = registry.claims.map((claim) => {
    const context = {
      synthetic: claim.synthetic,
      verticalId: CLAIM_REGISTRY_VERTICAL_ID,
      jurisdiction: 'KR',
      productFamilyId: claim.applicability.productFamilyIds[0],
      projectStage: claim.applicability.projectStages[0],
      conditions: Object.fromEntries(claim.applicability.conditions.map((condition) => [condition.id, condition.value]))
    };
    const customerUse = deriveCustomerUse(claim, context);
    if (claim.status !== 'UNVERIFIED' || customerUse.state !== 'BLOCKED') {
      throw new RegistryAdapterError('DRAFT_TRUST_BOUNDARY_VIOLATION', `$.claims.${claim.claimId}`);
    }
    return { claim, customerUse };
  });
  const previewWithoutId = {
    schemaVersion: DRAFT_REGISTRY_PREVIEW_SCHEMA_VERSION,
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    productionReady: false,
    productionReviewerWorkflowReady: false,
    issue165Status: 'HOLD',
    repositoryReviewRequired: true,
    automaticVerification: false,
    customerUseAllowed: false,
    proofExecutionApproved: false,
    reviewerIdentity: 'NOT_COLLECTED',
    workbenchVertical: 'datacenter',
    claimRegistryVerticalId: CLAIM_REGISTRY_VERTICAL_ID,
    asOf: fixedAsOf,
    patchId: patch.patchId,
    claims,
    metrics: {
      claimCount: claims.length,
      unverifiedCount: claims.length,
      customerUseBlockedCount: claims.length,
      verifiedCount: 0,
      customerUseAllowedCount: 0
    }
  };
  const preview = {
    ...previewWithoutId,
    previewFingerprint: `preview_${sha256(previewWithoutId)}`
  };
  const frozenPreview = deepFreeze(preview);
  inject.afterRegistryPreview?.(frozenPreview);
  return frozenPreview;
}
