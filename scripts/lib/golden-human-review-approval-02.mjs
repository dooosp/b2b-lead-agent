import {
  GOLDEN_ADJUDICATION_BOUNDARY,
  GOLDEN_ADJUDICATION_SCHEMA_VERSION,
  createValidatedGoldenDataset,
} from '../../knowledge/golden-dataset/index.mjs';
import {
  ClaimValidationError,
  assertSafeArtifact,
  canonicalStringify,
  sha256,
} from '../../knowledge/claim-registry/index.mjs';
import { validateGoldenHumanReviewBatch02 } from './golden-human-review-batch-02.mjs';
import { validateGoldenHumanReviewProposal02 } from './golden-human-review-proposal-02.mjs';

export const GOLDEN_HUMAN_REVIEW_APPROVAL_02_SCHEMA_VERSION =
  'pursuit-golden-human-review-approval-receipt-02-v0';
export const GOLDEN_HUMAN_REVIEW_APPROVAL_02_BOUNDARY =
  'REPOSITORY_APPROVAL_ASSERTION_NOT_AUTHENTICATED_IDENTITY';
export const GOLDEN_HUMAN_REVIEW_APPROVAL_02_CONFIRMATION =
  'GOLDEN_BATCH_02_APPROVAL';
export const GOLDEN_HUMAN_REVIEW_APPROVAL_02_DISPOSITION =
  'APPROVE_AS_WRITTEN';
export const GOLDEN_HUMAN_REVIEW_APPROVAL_02_ATTESTATION =
  '나는 연결된 출처, 근거, 한계를 직접 검토했고 이 제안들을 내 도메인 판단으로 채택합니다.';
export const GOLDEN_HUMAN_ADJUDICATION_ADDITIONS_02_SCHEMA_VERSION =
  'pursuit-golden-human-adjudication-additions-v1';
export const GOLDEN_HUMAN_ADJUDICATION_ADDITIONS_02_BOUNDARY =
  'HUMAN_ADJUDICATION_ADDITIONS_NOT_PRODUCTION_EVIDENCE';

export const GOLDEN_BATCH_01_MATERIALIZED_ADJUDICATIONS_CANONICAL_SHA256 =
  '24f872c06f9fd633acc18f799c4ff73a7df047058ea4b78a9a0f02f42bdd672b';
export const GOLDEN_BATCH_01_APPROVAL_RECEIPT_CANONICAL_SHA256 =
  '0fcb020494f3f4f5f63fc810df50bbb3f5b08b232614d6e3b26d261eae41af58';
export const GOLDEN_BATCH_01_POST_DATASET_CANONICAL_SHA256 =
  'f9a1c447c13a60f20ed7d166b12aab8fcbd6fbc059a318533aa20d370a724c50';

const PRIOR_COUNTS = Object.freeze({
  projectCount: 10,
  capabilityCount: 30,
  pairCount: 10,
  revisionCount: 1,
});

const EXPECTED_COUNTS = Object.freeze({
  projectCount: 7,
  capabilityCount: 0,
  pairCount: 0,
  revisionCount: 0,
});

const EMPTY_COUNTS = Object.freeze({
  projectCount: 0,
  capabilityCount: 0,
  pairCount: 0,
  revisionCount: 0,
});

const POST_COUNTS = Object.freeze({
  projectCount: 17,
  capabilityCount: 30,
  pairCount: 10,
  revisionCount: 1,
  stageCount: 5,
});

const BASE_ADJUDICATION_KEYS = Object.freeze([
  'schemaVersion',
  'boundary',
  'productionReady',
  'evaluationAsOf',
  'projectAdjudications',
  'capabilityAdjudications',
  'pairAdjudications',
  'revisionAdjudications',
]);

const ADDITION_ADJUDICATION_KEYS = Object.freeze([
  ...BASE_ADJUDICATION_KEYS,
  'baseDatasetVersion',
]);

const PRIOR_RECEIPT_KEYS = Object.freeze([
  'documentStatus',
  'schemaVersion',
  'boundary',
  'productionReady',
  'goldenReady',
  'humanAdjudicationRecorded',
  'approvalStatus',
  'reviewerIdentityStatus',
  'evaluationAsOf',
  'reviewer',
  'reviewReceipt',
  'reviewedAt',
  'disposition',
  'attestation',
  'changes',
  'preAdjudicationDatasetCanonicalSha256',
  'reviewBatchCanonicalSha256',
  'proposalCanonicalSha256',
  'materializedAdjudicationsCanonicalSha256',
  'postAdjudicationDatasetCanonicalSha256',
  'postAdjudicationDatasetState',
  'scope',
  'nonClaims',
  'canonicalSha256',
]);

const APPROVAL_NON_CLAIMS = Object.freeze([
  'This receipt records a repository assertion supplied through the explicit approval command; it does not authenticate reviewer identity or prove who operated the repository.',
  'HUMAN_DOMAIN_REVIEW denotes the supplied adjudication authority for this batch only; it is not an identity-verification mechanism.',
  'Golden readiness here means only that the offline dataset thresholds are met; it is not production readiness, customer evidence, or permission to act.',
  'The materialized adjudication additions remain non-production evidence and do not authorize production access, customer use, outreach, CRM mutation, or automated final decisions.',
]);

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const REVIEW_RECEIPT_PATTERN = /^[a-z0-9][a-z0-9._:-]{7,127}$/;

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

function assertPlainObject(value, path) {
  const prototype = value && typeof value === 'object'
    ? Object.getPrototypeOf(value)
    : null;
  if (
    !value
    || typeof value !== 'object'
    || Array.isArray(value)
    || (prototype !== Object.prototype && prototype !== null)
  ) {
    fail('PLAIN_OBJECT_REQUIRED', path);
  }
}

function assertExactKeys(value, keys, path) {
  assertPlainObject(value, path);
  if (!same(Object.keys(value).sort(compareAscii), [...keys].sort(compareAscii))) {
    fail('APPROVAL_OBJECT_KEYS_MISMATCH', path);
  }
}

function assertHash(value, path) {
  if (typeof value !== 'string' || !HASH_PATTERN.test(value)) {
    fail('CANONICAL_SHA256_REQUIRED', path);
  }
}

function assertIsoTimestamp(value, path) {
  if (typeof value !== 'string') fail('ISO_TIMESTAMP_REQUIRED', path);
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    fail('INVALID_ISO_TIMESTAMP', path);
  }
  return value;
}

function rawAdjudicationCounts(
  rawAdjudications,
  path,
  keys = BASE_ADJUDICATION_KEYS,
) {
  assertExactKeys(rawAdjudications, keys, path);
  for (const field of [
    'projectAdjudications',
    'capabilityAdjudications',
    'pairAdjudications',
    'revisionAdjudications',
  ]) {
    if (!Array.isArray(rawAdjudications[field])) {
      fail('ADJUDICATION_ARRAY_REQUIRED', `${path}.${field}`);
    }
  }
  return {
    projectCount: rawAdjudications.projectAdjudications.length,
    capabilityCount: rawAdjudications.capabilityAdjudications.length,
    pairCount: rawAdjudications.pairAdjudications.length,
    revisionCount: rawAdjudications.revisionAdjudications.length,
  };
}

function assertEmptyAdditions(rawAdditions, evaluationAsOf) {
  assertSafeArtifact(rawAdditions, '$.rawAdditions');
  const counts = rawAdjudicationCounts(
    rawAdditions,
    '$.rawAdditions',
    ADDITION_ADJUDICATION_KEYS,
  );
  if (!same(counts, EMPTY_COUNTS)) {
    fail('NONEMPTY_EXISTING_BATCH_02_ADDITIONS_REFUSED', '$.rawAdditions');
  }
  if (
    rawAdditions.schemaVersion
      !== GOLDEN_HUMAN_ADJUDICATION_ADDITIONS_02_SCHEMA_VERSION
    || rawAdditions.boundary
      !== GOLDEN_HUMAN_ADJUDICATION_ADDITIONS_02_BOUNDARY
    || rawAdditions.productionReady !== false
    || rawAdditions.evaluationAsOf !== evaluationAsOf
    || rawAdditions.baseDatasetVersion !== 'datacenter-kr-v0'
  ) {
    fail('INVALID_BATCH_02_ADDITIONS_ENVELOPE', '$.rawAdditions');
  }
}

function assertPriorApprovalReceipt(priorApprovalReceipt, rawPriorAdjudications) {
  assertSafeArtifact(priorApprovalReceipt, '$.priorApprovalReceipt');
  assertExactKeys(priorApprovalReceipt, PRIOR_RECEIPT_KEYS, '$.priorApprovalReceipt');
  assertHash(priorApprovalReceipt.canonicalSha256, '$.priorApprovalReceipt.canonicalSha256');
  const { canonicalSha256, ...withoutHash } = priorApprovalReceipt;
  if (sha256(canonicalStringify(withoutHash)) !== canonicalSha256) {
    fail('PRIOR_APPROVAL_RECEIPT_HASH_MISMATCH', '$.priorApprovalReceipt.canonicalSha256');
  }
  if (canonicalSha256 !== GOLDEN_BATCH_01_APPROVAL_RECEIPT_CANONICAL_SHA256) {
    fail('IMMUTABLE_BATCH_01_RECEIPT_PIN_MISMATCH', '$.priorApprovalReceipt.canonicalSha256');
  }
  const adjudicationsSha = sha256(canonicalStringify(rawPriorAdjudications));
  if (
    adjudicationsSha !== GOLDEN_BATCH_01_MATERIALIZED_ADJUDICATIONS_CANONICAL_SHA256
    || priorApprovalReceipt.materializedAdjudicationsCanonicalSha256 !== adjudicationsSha
  ) {
    fail(
      'IMMUTABLE_BATCH_01_ADJUDICATIONS_PIN_MISMATCH',
      '$.priorApprovalReceipt.materializedAdjudicationsCanonicalSha256',
    );
  }
  if (
    priorApprovalReceipt.postAdjudicationDatasetCanonicalSha256
      !== GOLDEN_BATCH_01_POST_DATASET_CANONICAL_SHA256
    || priorApprovalReceipt.productionReady !== false
    || priorApprovalReceipt.goldenReady !== false
    || priorApprovalReceipt.humanAdjudicationRecorded !== true
    || priorApprovalReceipt.reviewerIdentityStatus
      !== 'UNAUTHENTICATED_REPOSITORY_ASSERTION'
    || !same(priorApprovalReceipt.scope, PRIOR_COUNTS)
  ) {
    fail('INVALID_IMMUTABLE_BATCH_01_RECEIPT', '$.priorApprovalReceipt');
  }
  return { adjudicationsSha, receiptSha: canonicalSha256 };
}

function normalizeReviewer(value) {
  if (typeof value !== 'string') fail('REVIEWER_REQUIRED', '$.approval.reviewer');
  const normalized = value.normalize('NFKC').replace(/\s+/gu, ' ').trim();
  if (!normalized || normalized.length > 120 || normalized !== value) {
    fail('INVALID_REVIEWER', '$.approval.reviewer');
  }
  return normalized;
}

function validateApproval(approval, evaluationAsOf, now) {
  assertSafeArtifact(approval, '$.approval');
  assertExactKeys(approval, [
    'confirmation',
    'reviewer',
    'reviewReceipt',
    'reviewedAt',
    'disposition',
    'attestation',
    'changes',
    'datasetCanonicalSha256',
    'priorMaterializedAdjudicationsCanonicalSha256',
    'priorApprovalReceiptCanonicalSha256',
    'reviewBatchCanonicalSha256',
    'proposalCanonicalSha256',
  ], '$.approval');
  const reviewer = normalizeReviewer(approval.reviewer);
  if (approval.confirmation !== GOLDEN_HUMAN_REVIEW_APPROVAL_02_CONFIRMATION) {
    fail('EXPLICIT_HUMAN_REVIEW_CONFIRMATION_REQUIRED', '$.approval.confirmation');
  }
  if (
    typeof approval.reviewReceipt !== 'string'
    || !REVIEW_RECEIPT_PATTERN.test(approval.reviewReceipt)
  ) {
    fail('INVALID_REVIEW_RECEIPT', '$.approval.reviewReceipt');
  }
  const reviewedAt = assertIsoTimestamp(approval.reviewedAt, '$.approval.reviewedAt');
  const currentTime = assertIsoTimestamp(now, '$.now');
  if (reviewedAt < evaluationAsOf) {
    fail('BACKDATED_REVIEW_TIMESTAMP_REFUSED', '$.approval.reviewedAt');
  }
  if (reviewedAt > currentTime) {
    fail('FUTURE_REVIEW_TIMESTAMP_REFUSED', '$.approval.reviewedAt');
  }
  if (approval.disposition !== GOLDEN_HUMAN_REVIEW_APPROVAL_02_DISPOSITION) {
    fail('APPROVE_AS_WRITTEN_REQUIRED', '$.approval.disposition');
  }
  if (approval.attestation !== GOLDEN_HUMAN_REVIEW_APPROVAL_02_ATTESTATION) {
    fail('EXACT_HUMAN_ATTESTATION_REQUIRED', '$.approval.attestation');
  }
  if (!Array.isArray(approval.changes) || approval.changes.length !== 0) {
    fail('APPROVAL_CHANGES_MUST_BE_EMPTY', '$.approval.changes');
  }
  for (const field of [
    'datasetCanonicalSha256',
    'priorMaterializedAdjudicationsCanonicalSha256',
    'priorApprovalReceiptCanonicalSha256',
    'reviewBatchCanonicalSha256',
    'proposalCanonicalSha256',
  ]) {
    assertHash(approval[field], `$.approval.${field}`);
  }
  return {
    confirmation: GOLDEN_HUMAN_REVIEW_APPROVAL_02_CONFIRMATION,
    reviewer,
    reviewReceipt: approval.reviewReceipt,
    reviewedAt,
    disposition: GOLDEN_HUMAN_REVIEW_APPROVAL_02_DISPOSITION,
    attestation: GOLDEN_HUMAN_REVIEW_APPROVAL_02_ATTESTATION,
    changes: [],
    datasetCanonicalSha256: approval.datasetCanonicalSha256,
    priorMaterializedAdjudicationsCanonicalSha256:
      approval.priorMaterializedAdjudicationsCanonicalSha256,
    priorApprovalReceiptCanonicalSha256:
      approval.priorApprovalReceiptCanonicalSha256,
    reviewBatchCanonicalSha256: approval.reviewBatchCanonicalSha256,
    proposalCanonicalSha256: approval.proposalCanonicalSha256,
  };
}

function assertExactProposalScope(proposal) {
  const counts = {
    projectCount: proposal.projectProposals.length,
    capabilityCount: proposal.capabilityProposals.length,
    pairCount: proposal.pairProposals.length,
    revisionCount: proposal.revisionProposals.length,
  };
  if (!same(counts, EXPECTED_COUNTS)) {
    fail('GOLDEN_BATCH_02_SCOPE_MISMATCH', '$.proposal');
  }
  return counts;
}

function assertExactPendingProjectsAndStages(dataset, proposal) {
  const priorKeys = new Set(
    dataset.adjudications.projectAdjudications.map((item) => item.projectKey),
  );
  const pendingProjects = dataset.candidates.projects
    .filter((project) => !priorKeys.has(project.projectKey))
    .sort((left, right) => compareAscii(left.projectKey, right.projectKey));
  const proposals = [...proposal.projectProposals]
    .sort((left, right) => compareAscii(left.projectKey, right.projectKey));
  if (!same(
    proposals.map((item) => item.projectKey),
    pendingProjects.map((item) => item.projectKey),
  )) {
    fail('BATCH_02_PENDING_PROJECT_SET_MISMATCH', '$.proposal.projectProposals');
  }
  proposals.forEach((item, index) => {
    const candidate = pendingProjects[index];
    if (
      item.suggestedAdjudication?.projectKey !== candidate.projectKey
      || item.suggestedAdjudication?.currentStage !== candidate.stageObservation.stage
    ) {
      fail(
        'BATCH_02_STAGE_MUST_EXACT_CANDIDATE_EVIDENCE',
        `$.proposal.projectProposals[${index}].suggestedAdjudication.currentStage`,
      );
    }
  });
}

function prepareApprovalContext({
  rawCandidates,
  rawPriorAdjudications,
  rawAdditions,
  priorApprovalReceipt,
  reviewBatch,
  proposal,
  approval,
  now = new Date().toISOString(),
}) {
  const priorCounts = rawAdjudicationCounts(
    rawPriorAdjudications,
    '$.rawPriorAdjudications',
  );
  if (!same(priorCounts, PRIOR_COUNTS)) {
    fail('IMMUTABLE_BATCH_01_SCOPE_MISMATCH', '$.rawPriorAdjudications');
  }
  const priorPins = assertPriorApprovalReceipt(
    priorApprovalReceipt,
    rawPriorAdjudications,
  );
  const preAdjudicationDataset = createValidatedGoldenDataset(
    rawCandidates,
    rawPriorAdjudications,
  );
  if (
    preAdjudicationDataset.datasetState !== 'PARTIALLY_ADJUDICATED'
    || preAdjudicationDataset.goldenReady !== false
    || preAdjudicationDataset.summary.projectCandidateCount !== 17
    || preAdjudicationDataset.summary.humanConfirmedProjectCount !== 10
    || preAdjudicationDataset.summary.humanConfirmedStageCount !== 3
    || preAdjudicationDataset.summary.pendingProjectCount !== 7
  ) {
    fail('BATCH_02_PARTIAL_DATASET_REQUIRED', '$.rawPriorAdjudications');
  }
  assertEmptyAdditions(
    rawAdditions,
    preAdjudicationDataset.candidates.evaluationAsOf,
  );
  validateGoldenHumanReviewBatch02(reviewBatch, preAdjudicationDataset);
  validateGoldenHumanReviewProposal02(
    proposal,
    reviewBatch,
    preAdjudicationDataset,
  );
  const counts = assertExactProposalScope(proposal);
  assertExactPendingProjectsAndStages(preAdjudicationDataset, proposal);
  const normalizedApproval = validateApproval(
    approval,
    preAdjudicationDataset.candidates.evaluationAsOf,
    now,
  );
  if (normalizedApproval.reviewReceipt === priorApprovalReceipt.reviewReceipt) {
    fail('BATCH_02_REVIEW_RECEIPT_MUST_BE_UNIQUE', '$.approval.reviewReceipt');
  }
  if (normalizedApproval.reviewedAt < priorApprovalReceipt.reviewedAt) {
    fail('BATCH_02_REVIEW_MUST_FOLLOW_BATCH_01', '$.approval.reviewedAt');
  }
  const pins = {
    datasetCanonicalSha256: preAdjudicationDataset.canonicalSha256,
    priorMaterializedAdjudicationsCanonicalSha256: priorPins.adjudicationsSha,
    priorApprovalReceiptCanonicalSha256: priorPins.receiptSha,
    reviewBatchCanonicalSha256: reviewBatch.canonicalSha256,
    proposalCanonicalSha256: proposal.canonicalSha256,
  };
  for (const [field, expected] of Object.entries(pins)) {
    if (normalizedApproval[field] !== expected) {
      fail('BATCH_02_APPROVAL_PIN_MISMATCH', `$.approval.${field}`);
    }
  }
  if (
    reviewBatch.datasetCanonicalSha256 !== pins.datasetCanonicalSha256
    || proposal.datasetCanonicalSha256 !== pins.datasetCanonicalSha256
    || reviewBatch.priorMaterializedAdjudicationsCanonicalSha256
      !== pins.priorMaterializedAdjudicationsCanonicalSha256
    || proposal.priorMaterializedAdjudicationsCanonicalSha256
      !== pins.priorMaterializedAdjudicationsCanonicalSha256
    || proposal.reviewBatchCanonicalSha256 !== pins.reviewBatchCanonicalSha256
  ) {
    fail('BATCH_02_PACKET_PIN_MISMATCH', '$.proposal');
  }
  return {
    preAdjudicationDataset,
    normalizedApproval,
    counts,
    pins,
  };
}

function materializeProject(item, approval) {
  const { projectKey, ...decision } = item.suggestedAdjudication;
  return {
    projectKey,
    reviewAuthority: 'HUMAN_DOMAIN_REVIEW',
    reviewReceipt: approval.reviewReceipt,
    reviewedAt: approval.reviewedAt,
    ...decision,
  };
}

function deriveMaterializedAdditions(rawAdditions, proposal, approval) {
  return {
    schemaVersion: GOLDEN_HUMAN_ADJUDICATION_ADDITIONS_02_SCHEMA_VERSION,
    boundary: GOLDEN_HUMAN_ADJUDICATION_ADDITIONS_02_BOUNDARY,
    productionReady: false,
    evaluationAsOf: rawAdditions.evaluationAsOf,
    baseDatasetVersion: 'datacenter-kr-v0',
    projectAdjudications: proposal.projectProposals.map((item) => (
      materializeProject(item, approval)
    )),
    capabilityAdjudications: [],
    pairAdjudications: [],
    revisionAdjudications: [],
  };
}

function composeAdjudications(rawPriorAdjudications, additions) {
  return {
    schemaVersion: GOLDEN_ADJUDICATION_SCHEMA_VERSION,
    boundary: GOLDEN_ADJUDICATION_BOUNDARY,
    productionReady: false,
    evaluationAsOf: rawPriorAdjudications.evaluationAsOf,
    projectAdjudications: [
      ...rawPriorAdjudications.projectAdjudications,
      ...additions.projectAdjudications,
    ],
    capabilityAdjudications: [
      ...rawPriorAdjudications.capabilityAdjudications,
      ...additions.capabilityAdjudications,
    ],
    pairAdjudications: [
      ...rawPriorAdjudications.pairAdjudications,
      ...additions.pairAdjudications,
    ],
    revisionAdjudications: [
      ...rawPriorAdjudications.revisionAdjudications,
      ...additions.revisionAdjudications,
    ],
  };
}

function assertPostAdjudicationDataset(dataset) {
  const actualCounts = {
    projectCount: dataset.summary.humanConfirmedProjectCount,
    capabilityCount: dataset.summary.humanConfirmedCapabilityClaimCount,
    pairCount: dataset.summary.humanConfirmedPairCount,
    revisionCount: dataset.summary.humanConfirmedRevisionLinkCount,
    stageCount: dataset.summary.humanConfirmedStageCount,
  };
  if (!same(actualCounts, POST_COUNTS)) {
    fail('BATCH_02_POST_ADJUDICATION_COUNT_MISMATCH', '$.materializedAdditions');
  }
  if (
    dataset.datasetState !== 'HUMAN_CONFIRMED'
    || dataset.goldenReady !== true
    || dataset.candidates.productionReady !== false
    || dataset.adjudications.productionReady !== false
  ) {
    fail('GOLDEN_NON_PRODUCTION_DATASET_REQUIRED', '$.postAdjudicationDataset');
  }
}

function receiptWithoutHash({
  reviewBatch,
  proposal,
  approval,
  counts,
  materializedAdditions,
  composedAdjudications,
  postAdjudicationDataset,
}) {
  return {
    documentStatus: 'PURSUIT_GOLDEN_HUMAN_REVIEW_BATCH_02_APPROVAL_MATERIALIZED',
    schemaVersion: GOLDEN_HUMAN_REVIEW_APPROVAL_02_SCHEMA_VERSION,
    boundary: GOLDEN_HUMAN_REVIEW_APPROVAL_02_BOUNDARY,
    productionReady: false,
    goldenReady: true,
    humanAdjudicationRecorded: true,
    approvalStatus: 'APPROVED_AS_WRITTEN_AND_MATERIALIZED',
    reviewerIdentityStatus: 'UNAUTHENTICATED_REPOSITORY_ASSERTION',
    evaluationAsOf: proposal.evaluationAsOf,
    reviewer: approval.reviewer,
    reviewReceipt: approval.reviewReceipt,
    reviewedAt: approval.reviewedAt,
    confirmation: approval.confirmation,
    disposition: approval.disposition,
    attestation: approval.attestation,
    changes: [],
    preAdjudicationDatasetCanonicalSha256: approval.datasetCanonicalSha256,
    priorMaterializedAdjudicationsCanonicalSha256:
      approval.priorMaterializedAdjudicationsCanonicalSha256,
    priorApprovalReceiptCanonicalSha256:
      approval.priorApprovalReceiptCanonicalSha256,
    reviewBatchCanonicalSha256: reviewBatch.canonicalSha256,
    proposalCanonicalSha256: proposal.canonicalSha256,
    materializedAdjudicationAdditionsCanonicalSha256: sha256(
      canonicalStringify(materializedAdditions),
    ),
    composedAdjudicationsCanonicalSha256: sha256(
      canonicalStringify(composedAdjudications),
    ),
    postAdjudicationDatasetCanonicalSha256: postAdjudicationDataset.canonicalSha256,
    postAdjudicationDatasetState: 'HUMAN_CONFIRMED',
    scope: { ...counts },
    nonClaims: [...APPROVAL_NON_CLAIMS],
  };
}

function buildReceipt(context) {
  const withoutHash = receiptWithoutHash(context);
  return deepFreeze({
    ...withoutHash,
    canonicalSha256: sha256(canonicalStringify(withoutHash)),
  });
}

export function validateGoldenHumanReviewApprovalInput02(options) {
  return prepareApprovalContext(options);
}

export function validateMaterializedGoldenHumanAdjudicationAdditions02(
  materializedAdditions,
  options,
) {
  const prepared = prepareApprovalContext(options);
  const expected = deriveMaterializedAdditions(
    options.rawAdditions,
    options.proposal,
    prepared.normalizedApproval,
  );
  assertSafeArtifact(materializedAdditions, '$.materializedAdditions');
  if (!same(materializedAdditions, expected)) {
    fail('MATERIALIZED_BATCH_02_ADDITIONS_PROPOSAL_MISMATCH', '$.materializedAdditions');
  }
  const composedAdjudications = composeAdjudications(
    options.rawPriorAdjudications,
    materializedAdditions,
  );
  const dataset = createValidatedGoldenDataset(
    options.rawCandidates,
    composedAdjudications,
  );
  assertPostAdjudicationDataset(dataset);
  return { dataset, composedAdjudications };
}

export function validateGoldenHumanReviewApprovalReceipt02(receipt, {
  materializedAdditions,
  ...options
}) {
  assertSafeArtifact(receipt, '$.approvalReceipt');
  const { dataset, composedAdjudications } =
    validateMaterializedGoldenHumanAdjudicationAdditions02(
      materializedAdditions,
      options,
    );
  const prepared = prepareApprovalContext(options);
  const expected = buildReceipt({
    reviewBatch: options.reviewBatch,
    proposal: options.proposal,
    approval: prepared.normalizedApproval,
    counts: prepared.counts,
    materializedAdditions,
    composedAdjudications,
    postAdjudicationDataset: dataset,
  });
  const { canonicalSha256, ...withoutHash } = receipt || {};
  assertHash(canonicalSha256, '$.approvalReceipt.canonicalSha256');
  if (sha256(canonicalStringify(withoutHash)) !== canonicalSha256) {
    fail('GOLDEN_BATCH_02_APPROVAL_RECEIPT_HASH_MISMATCH', '$.approvalReceipt.canonicalSha256');
  }
  if (!same(receipt, expected)) {
    fail('GOLDEN_BATCH_02_APPROVAL_RECEIPT_CONTENT_MISMATCH', '$.approvalReceipt');
  }
  return receipt;
}

export function materializeGoldenHumanReviewApproval02(options) {
  const prepared = prepareApprovalContext(options);
  const adjudicationAdditions = deepFreeze(deriveMaterializedAdditions(
    options.rawAdditions,
    options.proposal,
    prepared.normalizedApproval,
  ));
  const { dataset, composedAdjudications } =
    validateMaterializedGoldenHumanAdjudicationAdditions02(
      adjudicationAdditions,
      options,
    );
  const approvalReceipt = buildReceipt({
    reviewBatch: options.reviewBatch,
    proposal: options.proposal,
    approval: prepared.normalizedApproval,
    counts: prepared.counts,
    materializedAdditions: adjudicationAdditions,
    composedAdjudications,
    postAdjudicationDataset: dataset,
  });
  validateGoldenHumanReviewApprovalReceipt02(approvalReceipt, {
    ...options,
    materializedAdditions: adjudicationAdditions,
  });
  return deepFreeze({
    adjudicationAdditions,
    approvalReceipt,
    dataset,
    composedAdjudications,
  });
}

export const GOLDEN_HUMAN_REVIEW_APPROVAL_02_EXPECTED_COUNTS = EXPECTED_COUNTS;
