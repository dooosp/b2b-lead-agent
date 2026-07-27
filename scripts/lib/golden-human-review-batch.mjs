import {
  buildGoldenDatasetAuditReport,
} from '../../knowledge/golden-dataset/index.mjs';
import {
  ClaimValidationError,
  assertSafeArtifact,
  canonicalStringify,
  sha256,
} from '../../knowledge/claim-registry/index.mjs';

export const GOLDEN_HUMAN_REVIEW_BATCH_SCHEMA_VERSION =
  'pursuit-golden-human-review-batch-v0';
export const GOLDEN_HUMAN_REVIEW_BATCH_BOUNDARY =
  'DRAFT_HUMAN_REVIEW_INPUT_NOT_ADJUDICATION';
export const GOLDEN_HUMAN_REVIEW_BATCH_PROJECT_COUNT = 10;

const PROJECT_SPECIFICATION_DOCUMENT_KINDS = new Set([
  'ADDENDUM',
  'BASIS_OF_DESIGN',
  'FACILITY_SPECIFICATION',
  'SINGLE_LINE_DIAGRAM',
  'TECHNICAL_SPECIFICATION',
  'TENDER_DOCUMENT',
]);

const STAGE_REVIEW_PRIORITY = new Map([
  ['PROCUREMENT', 0],
  ['DESIGN', 1],
  ['CONSTRUCTION', 2],
  ['COMMISSIONING', 3],
  ['FEASIBILITY', 4],
  ['ANNOUNCED', 5],
  ['OPERATION', 6],
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

function selectProjectReviewCandidates(candidates) {
  if (candidates.projects.length < GOLDEN_HUMAN_REVIEW_BATCH_PROJECT_COUNT) {
    fail(
      'GOLDEN_HUMAN_REVIEW_BATCH_REQUIRES_TEN_PROJECTS',
      '$.dataset.candidates.projects',
    );
  }
  const pairedProjectIds = new Set(
    candidates.requirementCapabilityPairs.map((pair) => pair.projectId),
  );
  return [...candidates.projects]
    .sort((left, right) => {
      const pairPriority = Number(pairedProjectIds.has(right.projectId))
        - Number(pairedProjectIds.has(left.projectId));
      if (pairPriority !== 0) return pairPriority;
      const forwardPriority = Number(right.stageObservation.forwardLooking)
        - Number(left.stageObservation.forwardLooking);
      if (forwardPriority !== 0) return forwardPriority;
      const stagePriority = (STAGE_REVIEW_PRIORITY.get(left.stageObservation.stage) ?? 99)
        - (STAGE_REVIEW_PRIORITY.get(right.stageObservation.stage) ?? 99);
      if (stagePriority !== 0) return stagePriority;
      const observedAtPriority = compareAscii(
        right.stageObservation.observedAt,
        left.stageObservation.observedAt,
      );
      return observedAtPriority || compareAscii(left.projectKey, right.projectKey);
    })
    .slice(0, GOLDEN_HUMAN_REVIEW_BATCH_PROJECT_COUNT);
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

function buildCapabilityReview(claim, documentById) {
  const evidenceDocument = documentById.get(claim.documentId);
  return {
    itemType: 'CAPABILITY',
    candidate: {
      claimKey: claim.claimKey,
      capabilityClaimId: claim.capabilityClaimId,
      productFamilyId: claim.productFamilyId,
      documentKey: evidenceDocument.documentKey,
      documentId: evidenceDocument.documentId,
      sourceSpan: claim.sourceSpan,
      field: claim.field,
      operator: claim.operator,
      value: claim.value,
      unit: claim.unit,
      conditions: claim.conditions,
      sourceSupportState: claim.sourceSupportState,
      projectApplicability: claim.projectApplicability,
      annotationOrigin: claim.annotationOrigin,
      limitations: claim.limitations,
    },
    evidenceDocument: documentProjection(evidenceDocument),
    humanInputTemplate: {
      claimKey: claim.claimKey,
      reviewAuthority: null,
      reviewReceipt: null,
      reviewedAt: null,
      label: null,
      reasonCodes: [],
      sourceSpans: [
        `${claim.documentId}#excerpt:${claim.sourceSpan.excerptIndex}`,
      ],
    },
  };
}

function buildPairReview(pair, projectById, claimById, documentById) {
  const project = projectById.get(pair.projectId);
  const claim = claimById.get(pair.capabilityClaimId);
  const requirementDocument = documentById.get(pair.requirementEvidence.documentId);
  const capabilityDocument = documentById.get(claim.documentId);
  return {
    itemType: 'REQUIREMENT_CAPABILITY_PAIR',
    candidate: {
      pairKey: pair.pairKey,
      pairId: pair.pairId,
      projectKey: project.projectKey,
      projectId: project.projectId,
      capabilityClaimKey: claim.claimKey,
      capabilityClaimId: claim.capabilityClaimId,
      productFamilyId: pair.productFamilyId,
      requirementEvidence: {
        ...pair.requirementEvidence,
        documentKey: requirementDocument.documentKey,
      },
      capabilityCandidate: {
        field: claim.field,
        operator: claim.operator,
        value: claim.value,
        unit: claim.unit,
        conditions: claim.conditions,
      },
      sourceSpanRefs: pair.sourceSpanRefs,
      annotationOrigin: pair.annotationOrigin,
      limitations: pair.limitations,
    },
    evidenceDocuments: {
      projectRequirement: documentProjection(requirementDocument),
      productCapability: documentProjection(capabilityDocument),
    },
    humanInputTemplate: {
      pairKey: pair.pairKey,
      reviewAuthority: null,
      reviewReceipt: null,
      reviewedAt: null,
      label: null,
      reasonCodes: [],
      sourceSpans: pair.sourceSpanRefs,
    },
  };
}

function buildRevisionReview(document, documentByKey) {
  const supersededDocument = documentByKey.get(document.revision.supersedesDocumentKey);
  return {
    itemType: 'REVISION',
    candidate: {
      documentKey: document.documentKey,
      documentId: document.documentId,
      supersedesDocumentKey: supersededDocument.documentKey,
      supersedesDocumentId: supersededDocument.documentId,
      seriesKey: document.revision.seriesKey,
    },
    evidenceDocuments: {
      newer: documentProjection(document),
      superseded: documentProjection(supersededDocument),
    },
    humanInputTemplate: {
      documentKey: document.documentKey,
      supersedesDocumentKey: supersededDocument.documentKey,
      reviewAuthority: null,
      reviewReceipt: null,
      reviewedAt: null,
      relationshipStatus: null,
      reasonCodes: [],
      sourceSpans: [
        `${document.documentId}#excerpt:0`,
        `${supersededDocument.documentId}#excerpt:0`,
      ].sort(compareAscii),
    },
  };
}

function assertBlankReviewEnvelope(template, path) {
  for (const field of ['reviewAuthority', 'reviewReceipt', 'reviewedAt']) {
    if (template?.[field] !== null) fail('HUMAN_REVIEW_FIELD_MUST_REMAIN_NULL', `${path}.${field}`);
  }
}

function assertEmptyArray(value, path) {
  if (!Array.isArray(value) || value.length !== 0) {
    fail('HUMAN_REVIEW_FIELD_MUST_REMAIN_EMPTY', path);
  }
}

function assertProjectTemplate(template, path) {
  assertBlankReviewEnvelope(template, path);
  for (const field of ['identityStatus', 'currentStage', 'finalPursuitDecision']) {
    if (template?.[field] !== null) fail('HUMAN_DECISION_MUST_REMAIN_NULL', `${path}.${field}`);
  }
  assertEmptyArray(template?.appliedSpecificationDocumentKeys, `${path}.appliedSpecificationDocumentKeys`);
  assertEmptyArray(template?.blockingEvidence, `${path}.blockingEvidence`);
  if (
    !Array.isArray(template?.productFitByFamily)
    || template.productFitByFamily.some((fit) => fit?.fitResult !== null)
  ) {
    fail('HUMAN_DECISION_MUST_REMAIN_NULL', `${path}.productFitByFamily`);
  }
  if (
    template?.specificationWindow?.state !== null
    || template?.specificationWindow?.rationale !== null
  ) {
    fail('HUMAN_DECISION_MUST_REMAIN_NULL', `${path}.specificationWindow`);
  }
}

function assertLabelTemplate(template, path) {
  assertBlankReviewEnvelope(template, path);
  if (template?.label !== null) fail('HUMAN_DECISION_MUST_REMAIN_NULL', `${path}.label`);
  assertEmptyArray(template?.reasonCodes, `${path}.reasonCodes`);
}

function assertRevisionTemplate(template, path) {
  assertBlankReviewEnvelope(template, path);
  if (template?.relationshipStatus !== null) {
    fail('HUMAN_DECISION_MUST_REMAIN_NULL', `${path}.relationshipStatus`);
  }
  assertEmptyArray(template?.reasonCodes, `${path}.reasonCodes`);
}

export function validateGoldenHumanReviewBatch(packet) {
  assertSafeArtifact(packet, '$.goldenHumanReviewBatch');
  const { canonicalSha256, ...withoutHash } = packet || {};
  if (
    packet?.documentStatus !== 'PURSUIT_GOLDEN_HUMAN_REVIEW_BATCH_DRAFT'
    || packet?.schemaVersion !== GOLDEN_HUMAN_REVIEW_BATCH_SCHEMA_VERSION
    || packet?.boundary !== GOLDEN_HUMAN_REVIEW_BATCH_BOUNDARY
    || packet?.productionReady !== false
    || packet?.goldenReady !== false
    || packet?.humanAdjudicationRecorded !== false
    || packet?.reviewStatus !== 'AWAITING_HUMAN_DOMAIN_REVIEW'
    || !/^[a-f0-9]{64}$/.test(packet?.datasetCanonicalSha256 || '')
    || !Array.isArray(packet?.projectReviews)
    || packet.projectReviews.length !== GOLDEN_HUMAN_REVIEW_BATCH_PROJECT_COUNT
    || !Array.isArray(packet?.capabilityReviews)
    || !Array.isArray(packet?.pairReviews)
    || !Array.isArray(packet?.revisionReviews)
    || !Array.isArray(packet?.nonClaims)
  ) {
    fail('GOLDEN_HUMAN_REVIEW_BATCH_INVALID', '$.goldenHumanReviewBatch');
  }
  const expectedCounts = {
    projectReviewItemCount: packet.projectReviews.length,
    capabilityReviewItemCount: packet.capabilityReviews.length,
    pairReviewItemCount: packet.pairReviews.length,
    revisionReviewItemCount: packet.revisionReviews.length,
  };
  if (canonicalStringify(packet.summary) !== canonicalStringify(expectedCounts)) {
    fail('GOLDEN_HUMAN_REVIEW_BATCH_COUNT_MISMATCH', '$.goldenHumanReviewBatch.summary');
  }
  packet.projectReviews.forEach((item, index) => assertProjectTemplate(
    item?.humanInputTemplate,
    `$.goldenHumanReviewBatch.projectReviews[${index}].humanInputTemplate`,
  ));
  packet.capabilityReviews.forEach((item, index) => assertLabelTemplate(
    item?.humanInputTemplate,
    `$.goldenHumanReviewBatch.capabilityReviews[${index}].humanInputTemplate`,
  ));
  packet.pairReviews.forEach((item, index) => assertLabelTemplate(
    item?.humanInputTemplate,
    `$.goldenHumanReviewBatch.pairReviews[${index}].humanInputTemplate`,
  ));
  packet.revisionReviews.forEach((item, index) => assertRevisionTemplate(
    item?.humanInputTemplate,
    `$.goldenHumanReviewBatch.revisionReviews[${index}].humanInputTemplate`,
  ));
  if (sha256(canonicalStringify(withoutHash)) !== canonicalSha256) {
    fail('GOLDEN_HUMAN_REVIEW_BATCH_HASH_MISMATCH', '$.goldenHumanReviewBatch.canonicalSha256');
  }
  return packet;
}

export function buildGoldenHumanReviewBatch(dataset) {
  const auditReport = buildGoldenDatasetAuditReport(dataset);
  const { candidates } = dataset;
  const documentById = new Map(
    candidates.documents.map((document) => [document.documentId, document]),
  );
  const documentByKey = new Map(
    candidates.documents.map((document) => [document.documentKey, document]),
  );
  const projectById = new Map(
    candidates.projects.map((project) => [project.projectId, project]),
  );
  const claimById = new Map(
    candidates.capabilityClaims.map((claim) => [claim.capabilityClaimId, claim]),
  );
  const selectedProjects = selectProjectReviewCandidates(candidates);
  const projectReviews = selectedProjects.map((project) => buildProjectReview(
    project,
    documentById,
    candidates.scope.productFamilyIds,
  ));
  const capabilityReviews = candidates.capabilityClaims.map((claim) => (
    buildCapabilityReview(claim, documentById)
  ));
  const pairReviews = candidates.requirementCapabilityPairs.map((pair) => (
    buildPairReview(pair, projectById, claimById, documentById)
  ));
  const revisionReviews = candidates.documents
    .filter((document) => document.revision.supersedesDocumentKey !== null)
    .map((document) => buildRevisionReview(document, documentByKey));
  const packetWithoutHash = {
    documentStatus: 'PURSUIT_GOLDEN_HUMAN_REVIEW_BATCH_DRAFT',
    schemaVersion: GOLDEN_HUMAN_REVIEW_BATCH_SCHEMA_VERSION,
    boundary: GOLDEN_HUMAN_REVIEW_BATCH_BOUNDARY,
    productionReady: false,
    goldenReady: false,
    humanAdjudicationRecorded: false,
    reviewStatus: 'AWAITING_HUMAN_DOMAIN_REVIEW',
    evaluationAsOf: candidates.evaluationAsOf,
    datasetStateAtPreparation: dataset.datasetState,
    datasetCanonicalSha256: auditReport.datasetCanonicalSha256,
    selectionPolicy: {
      projectItemCount: GOLDEN_HUMAN_REVIEW_BATCH_PROJECT_COUNT,
      order: [
        'PROJECT_REFERENCED_BY_PAIR_FIRST',
        'FORWARD_LOOKING_FIRST',
        'STAGE_REVIEW_PRIORITY',
        'LATEST_STAGE_OBSERVATION',
        'PROJECT_KEY_ASCENDING',
      ],
      capabilityScope: 'ALL_CURRENT_CANDIDATES',
      pairScope: 'ALL_CURRENT_CANDIDATES',
      revisionScope: 'ALL_CURRENT_SUPERSESSION_CANDIDATES',
    },
    summary: {
      projectReviewItemCount: projectReviews.length,
      capabilityReviewItemCount: capabilityReviews.length,
      pairReviewItemCount: pairReviews.length,
      revisionReviewItemCount: revisionReviews.length,
    },
    projectReviews,
    capabilityReviews,
    pairReviews,
    revisionReviews,
    nonClaims: [
      'This packet is AI-prepared review input, not a human adjudication or a claim that human review occurred.',
      'Candidate stages, extracted capabilities, requirement-capability pairs, and revision links remain unconfirmed until a domain reviewer supplies every required decision.',
      'Review authority, receipt, timestamp, labels, fit decisions, blockers, influence windows, and final pursuit decisions are intentionally blank.',
      'Review receipts are repository assertions and do not authenticate reviewer identity or prove human participation.',
      'This packet is not production evidence and does not authorize customer use, production access, D1 access, CRM, outreach, or automated decisions.',
    ],
  };
  const packet = deepFreeze({
    ...packetWithoutHash,
    canonicalSha256: sha256(canonicalStringify(packetWithoutHash)),
  });
  validateGoldenHumanReviewBatch(packet);
  return packet;
}
