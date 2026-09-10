import {
  buildGoldenDatasetAuditReport,
} from '../../knowledge/golden-dataset/index.mjs';
import {
  ClaimValidationError,
  assertSafeArtifact,
  canonicalStringify,
  sha256,
} from '../../knowledge/claim-registry/index.mjs';

export const GOLDEN_HUMAN_REVIEW_BATCH_02_SCHEMA_VERSION =
  'pursuit-golden-human-review-batch-02-v0';
export const GOLDEN_HUMAN_REVIEW_BATCH_02_BOUNDARY =
  'DRAFT_PENDING_ONLY_HUMAN_REVIEW_INPUT_NOT_ADJUDICATION';
export const GOLDEN_HUMAN_REVIEW_BATCH_02_PROJECT_COUNT = 7;
export const GOLDEN_HUMAN_REVIEW_BATCH_02_PRIOR_PROJECT_COUNT = 10;
export const GOLDEN_HUMAN_REVIEW_BATCH_02_ARTIFACT_PATH =
  'tmp/codex/pursuit-golden-human-review-batch-02.json';
export const GOLDEN_HUMAN_REVIEW_BATCH_02_PRIOR_ADJUDICATIONS_CANONICAL_SHA256 =
  '24f872c06f9fd633acc18f799c4ff73a7df047058ea4b78a9a0f02f42bdd672b';

export const GOLDEN_HUMAN_REVIEW_BATCH_02_PROJECT_KEYS = Object.freeze([
  'empyrion_kr1_gangnam',
  'kakao_data_center_ansan',
  'lguplus_pyeongchon2',
  'nhn_gwangju_national_ai',
  'samsungsds_dongtan',
  'ulsan_underwater_data_center_model',
  'wanju_ai_data_center',
]);

const PROJECT_SPECIFICATION_DOCUMENT_KINDS = new Set([
  'ADDENDUM',
  'BASIS_OF_DESIGN',
  'FACILITY_SPECIFICATION',
  'SINGLE_LINE_DIAGRAM',
  'TECHNICAL_SPECIFICATION',
  'TENDER_DOCUMENT',
]);

const PACKET_KEYS = Object.freeze([
  'documentStatus',
  'schemaVersion',
  'boundary',
  'productionReady',
  'goldenReady',
  'humanAdjudicationRecorded',
  'reviewStatus',
  'evaluationAsOf',
  'datasetStateAtPreparation',
  'datasetCanonicalSha256',
  'priorMaterializedAdjudicationsCanonicalSha256',
  'selectionPolicy',
  'priorAdjudicationSummary',
  'summary',
  'projectReviews',
  'capabilityReviews',
  'pairReviews',
  'revisionReviews',
  'nonClaims',
  'canonicalSha256',
]);

const NON_CLAIMS = Object.freeze([
  'This packet contains only the seven currently unadjudicated projects; it does not reopen, alter, or re-approve prior materialized adjudications.',
  'This packet is AI-prepared review input, not a human adjudication or a claim that human review occurred.',
  'Review authority, receipt, timestamp, identity, stage, fit, blocker, influence-window, and final-decision fields are intentionally blank.',
  'Capability, requirement-capability pair, and revision scopes are empty because those candidate sets are already fully adjudicated in the pinned dataset.',
  'Officiality, reachability, currentness, and project interpretation of remote sources still require direct human review.',
  'This packet is not production evidence and does not authorize customer use, production access, D1 access, CRM, outreach, or automated decisions.',
]);

function fail(code, path) {
  throw new ClaimValidationError(code, path);
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

function same(left, right) {
  return canonicalStringify(left) === canonicalStringify(right);
}

function assertExactKeys(value, expected, path) {
  if (
    !value
    || typeof value !== 'object'
    || Array.isArray(value)
    || !same(Object.keys(value).sort(compareAscii), [...expected].sort(compareAscii))
  ) {
    fail('GOLDEN_HUMAN_REVIEW_BATCH_02_OBJECT_KEYS_MISMATCH', path);
  }
}

function documentProjection(document) {
  return {
    documentKey: document.documentKey,
    documentId: document.documentId,
    sourceClass: document.sourceClass,
    publisher: document.publisher,
    title: document.title,
    authorityTypeCandidate: document.authorityTypeCandidate,
    officialDomainCandidate: document.officialDomainCandidate,
    sourceUrl: document.sourceUrl,
    documentKind: document.documentKind,
    publishedAt: document.publishedAt,
    publishedAtPrecision: document.publishedAtPrecision,
    retrievedAt: document.retrievedAt,
    remoteContentSha256Candidate: document.remoteContentSha256Candidate,
    revision: document.revision,
    excerpts: document.excerpts,
  };
}

function priorAdjudicationSummary(dataset) {
  return {
    projectAdjudicationCount: dataset.adjudications.projectAdjudications.length,
    capabilityAdjudicationCount: dataset.adjudications.capabilityAdjudications.length,
    pairAdjudicationCount: dataset.adjudications.pairAdjudications.length,
    revisionAdjudicationCount: dataset.adjudications.revisionAdjudications.length,
  };
}

function assertDatasetPrerequisites(dataset) {
  const auditReport = buildGoldenDatasetAuditReport(dataset);
  const { candidates, adjudications } = dataset;
  const adjudicatedProjectKeys = new Set(
    adjudications.projectAdjudications.map((item) => item.projectKey),
  );
  const pendingProjectKeys = candidates.projects
    .filter((project) => !adjudicatedProjectKeys.has(project.projectKey))
    .map((project) => project.projectKey)
    .sort(compareAscii);
  const revisionCandidateCount = candidates.documents.filter(
    (document) => document.revision.supersedesDocumentKey !== null,
  ).length;

  if (
    dataset.datasetState !== 'PARTIALLY_ADJUDICATED'
    || dataset.goldenReady !== false
    || adjudications.projectAdjudications.length
      !== GOLDEN_HUMAN_REVIEW_BATCH_02_PRIOR_PROJECT_COUNT
    || candidates.projects.length
      !== GOLDEN_HUMAN_REVIEW_BATCH_02_PRIOR_PROJECT_COUNT
        + GOLDEN_HUMAN_REVIEW_BATCH_02_PROJECT_COUNT
  ) {
    fail('GOLDEN_HUMAN_REVIEW_BATCH_02_DATASET_STATE_INVALID', '$.dataset');
  }
  if (!same(pendingProjectKeys, GOLDEN_HUMAN_REVIEW_BATCH_02_PROJECT_KEYS)) {
    fail('GOLDEN_HUMAN_REVIEW_BATCH_02_PENDING_PROJECT_SET_MISMATCH', '$.dataset.candidates.projects');
  }
  if (
    adjudications.capabilityAdjudications.length !== candidates.capabilityClaims.length
    || adjudications.pairAdjudications.length !== candidates.requirementCapabilityPairs.length
    || adjudications.revisionAdjudications.length !== revisionCandidateCount
  ) {
    fail('GOLDEN_HUMAN_REVIEW_BATCH_02_NON_PROJECT_SCOPE_PENDING', '$.dataset.adjudications');
  }
  return {
    auditReport,
    pendingProjects: candidates.projects
      .filter((project) => !adjudicatedProjectKeys.has(project.projectKey))
      .sort((left, right) => compareAscii(left.projectKey, right.projectKey)),
  };
}

function buildProjectReview(project, documentById, productFamilyIds) {
  const sourceDocuments = project.documentIds
    .map((documentId) => documentById.get(documentId))
    .sort((left, right) => compareAscii(left.documentKey, right.documentKey))
    .map(documentProjection);
  const stageDocument = documentById.get(project.stageObservation.documentId);
  return {
    itemType: 'PROJECT',
    candidate: {
      projectKey: project.projectKey,
      projectId: project.projectId,
      name: project.name,
      location: project.location,
      stageObservationCandidate: {
        stage: project.stageObservation.stage,
        observedAt: project.stageObservation.observedAt,
        forwardLooking: project.stageObservation.forwardLooking,
        documentKey: stageDocument.documentKey,
        documentId: stageDocument.documentId,
      },
      annotationOrigin: project.annotationOrigin,
      limitations: project.limitations,
      eligibleAppliedSpecificationDocumentKeys: sourceDocuments
        .filter((document) => PROJECT_SPECIFICATION_DOCUMENT_KINDS.has(document.documentKind))
        .map((document) => document.documentKey),
    },
    sourceDocuments,
    humanInputTemplate: {
      projectKey: project.projectKey,
      reviewAuthority: null,
      reviewReceipt: null,
      reviewedAt: null,
      identityStatus: null,
      currentStage: null,
      appliedSpecificationDocumentKeys: [],
      productFitByFamily: productFamilyIds.map((productFamilyId) => ({
        productFamilyId,
        fitResult: null,
      })),
      blockingEvidence: [],
      specificationWindow: {
        state: null,
        rationale: null,
      },
      finalPursuitDecision: null,
    },
  };
}

function assertBlankProjectTemplate(template, path) {
  assertExactKeys(template, [
    'projectKey',
    'reviewAuthority',
    'reviewReceipt',
    'reviewedAt',
    'identityStatus',
    'currentStage',
    'appliedSpecificationDocumentKeys',
    'productFitByFamily',
    'blockingEvidence',
    'specificationWindow',
    'finalPursuitDecision',
  ], path);
  for (const field of [
    'reviewAuthority',
    'reviewReceipt',
    'reviewedAt',
    'identityStatus',
    'currentStage',
    'finalPursuitDecision',
  ]) {
    if (template[field] !== null) {
      fail('GOLDEN_HUMAN_REVIEW_BATCH_02_HUMAN_FIELD_MUST_REMAIN_NULL', `${path}.${field}`);
    }
  }
  if (
    !Array.isArray(template.appliedSpecificationDocumentKeys)
    || template.appliedSpecificationDocumentKeys.length !== 0
    || !Array.isArray(template.blockingEvidence)
    || template.blockingEvidence.length !== 0
    || !Array.isArray(template.productFitByFamily)
    || template.productFitByFamily.some((fit) => fit?.fitResult !== null)
    || template.specificationWindow?.state !== null
    || template.specificationWindow?.rationale !== null
  ) {
    fail('GOLDEN_HUMAN_REVIEW_BATCH_02_HUMAN_FIELD_MUST_REMAIN_BLANK', path);
  }
}

function composeBatch(dataset) {
  const { auditReport, pendingProjects } = assertDatasetPrerequisites(dataset);
  const documentById = new Map(
    dataset.candidates.documents.map((document) => [document.documentId, document]),
  );
  const projectReviews = pendingProjects.map((project) => buildProjectReview(
    project,
    documentById,
    dataset.candidates.scope.productFamilyIds,
  ));
  const withoutHash = {
    documentStatus: 'PURSUIT_GOLDEN_HUMAN_REVIEW_BATCH_02_DRAFT',
    schemaVersion: GOLDEN_HUMAN_REVIEW_BATCH_02_SCHEMA_VERSION,
    boundary: GOLDEN_HUMAN_REVIEW_BATCH_02_BOUNDARY,
    productionReady: false,
    goldenReady: false,
    humanAdjudicationRecorded: false,
    reviewStatus: 'AWAITING_HUMAN_DOMAIN_REVIEW',
    evaluationAsOf: dataset.candidates.evaluationAsOf,
    datasetStateAtPreparation: 'PARTIALLY_ADJUDICATED',
    datasetCanonicalSha256: auditReport.datasetCanonicalSha256,
    priorMaterializedAdjudicationsCanonicalSha256:
      GOLDEN_HUMAN_REVIEW_BATCH_02_PRIOR_ADJUDICATIONS_CANONICAL_SHA256,
    selectionPolicy: {
      projectScope: 'ALL_CURRENTLY_UNADJUDICATED_PROJECTS',
      projectItemCount: GOLDEN_HUMAN_REVIEW_BATCH_02_PROJECT_COUNT,
      order: 'PROJECT_KEY_ASCENDING',
      excludePriorAdjudications: true,
      capabilityScope: 'NONE_ALREADY_FULLY_ADJUDICATED',
      pairScope: 'NONE_ALREADY_FULLY_ADJUDICATED',
      revisionScope: 'NONE_ALREADY_FULLY_ADJUDICATED',
    },
    priorAdjudicationSummary: priorAdjudicationSummary(dataset),
    summary: {
      projectReviewItemCount: projectReviews.length,
      capabilityReviewItemCount: 0,
      pairReviewItemCount: 0,
      revisionReviewItemCount: 0,
    },
    projectReviews,
    capabilityReviews: [],
    pairReviews: [],
    revisionReviews: [],
    nonClaims: [...NON_CLAIMS],
  };
  return {
    ...withoutHash,
    canonicalSha256: sha256(canonicalStringify(withoutHash)),
  };
}

export function validateGoldenHumanReviewBatch02(packet, dataset) {
  assertSafeArtifact(packet, '$.goldenHumanReviewBatch02');
  assertExactKeys(packet, PACKET_KEYS, '$.goldenHumanReviewBatch02');
  const { canonicalSha256, ...withoutHash } = packet;
  if (
    packet.documentStatus !== 'PURSUIT_GOLDEN_HUMAN_REVIEW_BATCH_02_DRAFT'
    || packet.schemaVersion !== GOLDEN_HUMAN_REVIEW_BATCH_02_SCHEMA_VERSION
    || packet.boundary !== GOLDEN_HUMAN_REVIEW_BATCH_02_BOUNDARY
    || packet.productionReady !== false
    || packet.goldenReady !== false
    || packet.humanAdjudicationRecorded !== false
    || packet.reviewStatus !== 'AWAITING_HUMAN_DOMAIN_REVIEW'
    || packet.datasetStateAtPreparation !== 'PARTIALLY_ADJUDICATED'
    || !/^[a-f0-9]{64}$/.test(packet.datasetCanonicalSha256 || '')
    || !/^[a-f0-9]{64}$/.test(packet.priorMaterializedAdjudicationsCanonicalSha256 || '')
    || !Array.isArray(packet.projectReviews)
    || packet.projectReviews.length !== GOLDEN_HUMAN_REVIEW_BATCH_02_PROJECT_COUNT
    || !Array.isArray(packet.capabilityReviews)
    || packet.capabilityReviews.length !== 0
    || !Array.isArray(packet.pairReviews)
    || packet.pairReviews.length !== 0
    || !Array.isArray(packet.revisionReviews)
    || packet.revisionReviews.length !== 0
  ) {
    fail('GOLDEN_HUMAN_REVIEW_BATCH_02_INVALID', '$.goldenHumanReviewBatch02');
  }
  packet.projectReviews.forEach((item, index) => assertBlankProjectTemplate(
    item?.humanInputTemplate,
    `$.goldenHumanReviewBatch02.projectReviews[${index}].humanInputTemplate`,
  ));
  if (sha256(canonicalStringify(withoutHash)) !== canonicalSha256) {
    fail('GOLDEN_HUMAN_REVIEW_BATCH_02_HASH_MISMATCH', '$.goldenHumanReviewBatch02.canonicalSha256');
  }
  const expected = composeBatch(dataset);
  if (!same(packet, expected)) {
    fail('GOLDEN_HUMAN_REVIEW_BATCH_02_CONTENT_MISMATCH', '$.goldenHumanReviewBatch02');
  }
  return packet;
}

export function buildGoldenHumanReviewBatch02(dataset) {
  const packet = deepFreeze(composeBatch(dataset));
  validateGoldenHumanReviewBatch02(packet, dataset);
  return packet;
}
