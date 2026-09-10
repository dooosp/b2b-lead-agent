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
import { validateGoldenHumanReviewBatch } from './golden-human-review-batch.mjs';
import { validateGoldenHumanReviewProposal } from './golden-human-review-proposal.mjs';

export const GOLDEN_HUMAN_REVIEW_APPROVAL_SCHEMA_VERSION =
  'pursuit-golden-human-review-approval-receipt-v0';
export const GOLDEN_HUMAN_REVIEW_APPROVAL_BOUNDARY =
  'REPOSITORY_APPROVAL_ASSERTION_NOT_AUTHENTICATED_IDENTITY';
export const GOLDEN_HUMAN_REVIEW_APPROVAL_CONFIRMATION =
  'GOLDEN_BATCH_01_APPROVAL';
export const GOLDEN_HUMAN_REVIEW_APPROVAL_DISPOSITION =
  'APPROVE_AS_WRITTEN';
export const GOLDEN_HUMAN_REVIEW_APPROVAL_ATTESTATION =
  '나는 연결된 출처, 근거, 한계를 직접 검토했고 이 제안들을 내 도메인 판단으로 채택합니다.';

const EXPECTED_COUNTS = Object.freeze({
  projectCount: 10,
  capabilityCount: 30,
  pairCount: 10,
  revisionCount: 1,
});

const APPROVAL_NON_CLAIMS = Object.freeze([
  'This receipt records a repository assertion supplied through the explicit approval command; it does not authenticate reviewer identity or prove who operated the repository.',
  'HUMAN_DOMAIN_REVIEW denotes the supplied adjudication authority for this batch only; it is not an identity-verification mechanism.',
  'The materialized adjudications remain non-production evidence and do not authorize production access, customer use, outreach, CRM mutation, or automated final decisions.',
  'This first batch leaves five project candidates unadjudicated and does not satisfy the five-stage diversity threshold, so goldenReady remains false.',
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

function assertEmptyExistingAdjudications(rawAdjudications) {
  assertPlainObject(rawAdjudications, '$.rawAdjudications');
  for (const field of [
    'projectAdjudications',
    'capabilityAdjudications',
    'pairAdjudications',
    'revisionAdjudications',
  ]) {
    if (!Array.isArray(rawAdjudications[field])) {
      fail('ADJUDICATION_ARRAY_REQUIRED', `$.rawAdjudications.${field}`);
    }
    if (rawAdjudications[field].length !== 0) {
      fail('NONEMPTY_EXISTING_ADJUDICATIONS_REFUSED', `$.rawAdjudications.${field}`);
    }
  }
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
    'reviewer',
    'reviewReceipt',
    'reviewedAt',
    'disposition',
    'attestation',
    'changes',
    'datasetCanonicalSha256',
    'proposalCanonicalSha256',
  ], '$.approval');
  const reviewer = normalizeReviewer(approval.reviewer);
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
  if (approval.disposition !== GOLDEN_HUMAN_REVIEW_APPROVAL_DISPOSITION) {
    fail('APPROVE_AS_WRITTEN_REQUIRED', '$.approval.disposition');
  }
  if (approval.attestation !== GOLDEN_HUMAN_REVIEW_APPROVAL_ATTESTATION) {
    fail('EXACT_HUMAN_ATTESTATION_REQUIRED', '$.approval.attestation');
  }
  if (!Array.isArray(approval.changes) || approval.changes.length !== 0) {
    fail('APPROVAL_CHANGES_MUST_BE_EMPTY', '$.approval.changes');
  }
  assertHash(approval.datasetCanonicalSha256, '$.approval.datasetCanonicalSha256');
  assertHash(approval.proposalCanonicalSha256, '$.approval.proposalCanonicalSha256');
  return {
    reviewer,
    reviewReceipt: approval.reviewReceipt,
    reviewedAt,
    disposition: GOLDEN_HUMAN_REVIEW_APPROVAL_DISPOSITION,
    attestation: GOLDEN_HUMAN_REVIEW_APPROVAL_ATTESTATION,
    changes: [],
    datasetCanonicalSha256: approval.datasetCanonicalSha256,
    proposalCanonicalSha256: approval.proposalCanonicalSha256,
  };
}

function assertExactScope(proposal) {
  const counts = {
    projectCount: proposal.projectProposals.length,
    capabilityCount: proposal.capabilityProposals.length,
    pairCount: proposal.pairProposals.length,
    revisionCount: proposal.revisionProposals.length,
  };
  if (!same(counts, EXPECTED_COUNTS)) {
    fail('GOLDEN_BATCH_01_SCOPE_MISMATCH', '$.proposal');
  }
  return counts;
}

function prepareApprovalContext({
  rawCandidates,
  rawAdjudications,
  reviewBatch,
  proposal,
  approval,
  now = new Date().toISOString(),
}) {
  assertEmptyExistingAdjudications(rawAdjudications);
  const preAdjudicationDataset = createValidatedGoldenDataset(
    rawCandidates,
    rawAdjudications,
  );
  if (
    preAdjudicationDataset.datasetState !== 'CANDIDATE_INTAKE'
    || preAdjudicationDataset.goldenReady !== false
  ) {
    fail('CANDIDATE_INTAKE_DATASET_REQUIRED', '$.rawAdjudications');
  }
  validateGoldenHumanReviewBatch(reviewBatch);
  if (
    reviewBatch.datasetCanonicalSha256 !== preAdjudicationDataset.canonicalSha256
    || reviewBatch.evaluationAsOf !== preAdjudicationDataset.candidates.evaluationAsOf
  ) {
    fail('REVIEW_BATCH_DATASET_PIN_MISMATCH', '$.reviewBatch');
  }
  validateGoldenHumanReviewProposal(proposal, reviewBatch);
  const counts = assertExactScope(proposal);
  const normalizedApproval = validateApproval(
    approval,
    preAdjudicationDataset.candidates.evaluationAsOf,
    now,
  );
  if (
    normalizedApproval.datasetCanonicalSha256 !== preAdjudicationDataset.canonicalSha256
    || normalizedApproval.datasetCanonicalSha256 !== proposal.datasetCanonicalSha256
  ) {
    fail('APPROVAL_DATASET_HASH_MISMATCH', '$.approval.datasetCanonicalSha256');
  }
  if (normalizedApproval.proposalCanonicalSha256 !== proposal.canonicalSha256) {
    fail('APPROVAL_PROPOSAL_HASH_MISMATCH', '$.approval.proposalCanonicalSha256');
  }
  return {
    preAdjudicationDataset,
    normalizedApproval,
    counts,
  };
}

function reviewEnvelope(approval) {
  return {
    reviewAuthority: 'HUMAN_DOMAIN_REVIEW',
    reviewReceipt: approval.reviewReceipt,
    reviewedAt: approval.reviewedAt,
  };
}

function materializeProject(item, approval) {
  const { projectKey, ...decision } = item.suggestedAdjudication;
  return { projectKey, ...reviewEnvelope(approval), ...decision };
}

function materializeCapability(item, approval) {
  const { claimKey, ...decision } = item.suggestedAdjudication;
  return { claimKey, ...reviewEnvelope(approval), ...decision };
}

function materializePair(item, approval) {
  const { pairKey, ...decision } = item.suggestedAdjudication;
  return { pairKey, ...reviewEnvelope(approval), ...decision };
}

function materializeRevision(item, approval) {
  const {
    documentKey,
    supersedesDocumentKey,
    ...decision
  } = item.suggestedAdjudication;
  return {
    documentKey,
    supersedesDocumentKey,
    ...reviewEnvelope(approval),
    ...decision,
  };
}

function deriveMaterializedAdjudications(rawAdjudications, proposal, approval) {
  return {
    schemaVersion: GOLDEN_ADJUDICATION_SCHEMA_VERSION,
    boundary: GOLDEN_ADJUDICATION_BOUNDARY,
    productionReady: false,
    evaluationAsOf: rawAdjudications.evaluationAsOf,
    projectAdjudications: proposal.projectProposals.map((item) => (
      materializeProject(item, approval)
    )),
    capabilityAdjudications: proposal.capabilityProposals.map((item) => (
      materializeCapability(item, approval)
    )),
    pairAdjudications: proposal.pairProposals.map((item) => (
      materializePair(item, approval)
    )),
    revisionAdjudications: proposal.revisionProposals.map((item) => (
      materializeRevision(item, approval)
    )),
  };
}

function assertPostAdjudicationDataset(dataset) {
  const actualCounts = {
    projectCount: dataset.summary.humanConfirmedProjectCount,
    capabilityCount: dataset.summary.humanConfirmedCapabilityClaimCount,
    pairCount: dataset.summary.humanConfirmedPairCount,
    revisionCount: dataset.summary.humanConfirmedRevisionLinkCount,
  };
  if (!same(actualCounts, EXPECTED_COUNTS)) {
    fail('MATERIALIZED_ADJUDICATION_COUNT_MISMATCH', '$.materializedAdjudications');
  }
  if (dataset.datasetState !== 'PARTIALLY_ADJUDICATED' || dataset.goldenReady !== false) {
    fail('PARTIAL_NON_GOLDEN_DATASET_REQUIRED', '$.postAdjudicationDataset');
  }
}

function receiptWithoutHash({
  reviewBatch,
  proposal,
  approval,
  counts,
  materializedAdjudications,
  postAdjudicationDataset,
}) {
  return {
    documentStatus: 'PURSUIT_GOLDEN_HUMAN_REVIEW_APPROVAL_MATERIALIZED',
    schemaVersion: GOLDEN_HUMAN_REVIEW_APPROVAL_SCHEMA_VERSION,
    boundary: GOLDEN_HUMAN_REVIEW_APPROVAL_BOUNDARY,
    productionReady: false,
    goldenReady: false,
    humanAdjudicationRecorded: true,
    approvalStatus: 'APPROVED_AS_WRITTEN_AND_MATERIALIZED',
    reviewerIdentityStatus: 'UNAUTHENTICATED_REPOSITORY_ASSERTION',
    evaluationAsOf: proposal.evaluationAsOf,
    reviewer: approval.reviewer,
    reviewReceipt: approval.reviewReceipt,
    reviewedAt: approval.reviewedAt,
    disposition: approval.disposition,
    attestation: approval.attestation,
    changes: [],
    preAdjudicationDatasetCanonicalSha256: approval.datasetCanonicalSha256,
    reviewBatchCanonicalSha256: reviewBatch.canonicalSha256,
    proposalCanonicalSha256: approval.proposalCanonicalSha256,
    materializedAdjudicationsCanonicalSha256: sha256(
      canonicalStringify(materializedAdjudications),
    ),
    postAdjudicationDatasetCanonicalSha256: postAdjudicationDataset.canonicalSha256,
    postAdjudicationDatasetState: 'PARTIALLY_ADJUDICATED',
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

export function validateGoldenHumanReviewApprovalInput(options) {
  return prepareApprovalContext(options);
}

export function validateMaterializedGoldenHumanAdjudications(
  materializedAdjudications,
  options,
) {
  const prepared = prepareApprovalContext(options);
  const expected = deriveMaterializedAdjudications(
    options.rawAdjudications,
    options.proposal,
    prepared.normalizedApproval,
  );
  assertSafeArtifact(materializedAdjudications, '$.materializedAdjudications');
  if (!same(materializedAdjudications, expected)) {
    fail('MATERIALIZED_ADJUDICATIONS_PROPOSAL_MISMATCH', '$.materializedAdjudications');
  }
  const dataset = createValidatedGoldenDataset(
    options.rawCandidates,
    materializedAdjudications,
  );
  assertPostAdjudicationDataset(dataset);
  return dataset;
}

export function validateGoldenHumanReviewApprovalReceipt(receipt, {
  materializedAdjudications,
  ...options
}) {
  assertSafeArtifact(receipt, '$.approvalReceipt');
  const postAdjudicationDataset = validateMaterializedGoldenHumanAdjudications(
    materializedAdjudications,
    options,
  );
  const prepared = prepareApprovalContext(options);
  const expected = buildReceipt({
    reviewBatch: options.reviewBatch,
    proposal: options.proposal,
    approval: prepared.normalizedApproval,
    counts: prepared.counts,
    materializedAdjudications,
    postAdjudicationDataset,
  });
  const { canonicalSha256, ...withoutHash } = receipt || {};
  assertHash(canonicalSha256, '$.approvalReceipt.canonicalSha256');
  if (sha256(canonicalStringify(withoutHash)) !== canonicalSha256) {
    fail('GOLDEN_APPROVAL_RECEIPT_HASH_MISMATCH', '$.approvalReceipt.canonicalSha256');
  }
  if (!same(receipt, expected)) {
    fail('GOLDEN_APPROVAL_RECEIPT_CONTENT_MISMATCH', '$.approvalReceipt');
  }
  return receipt;
}

export function materializeGoldenHumanReviewApproval(options) {
  const prepared = prepareApprovalContext(options);
  const adjudications = deepFreeze(deriveMaterializedAdjudications(
    options.rawAdjudications,
    options.proposal,
    prepared.normalizedApproval,
  ));
  const dataset = validateMaterializedGoldenHumanAdjudications(adjudications, options);
  const approvalReceipt = buildReceipt({
    reviewBatch: options.reviewBatch,
    proposal: options.proposal,
    approval: prepared.normalizedApproval,
    counts: prepared.counts,
    materializedAdjudications: adjudications,
    postAdjudicationDataset: dataset,
  });
  validateGoldenHumanReviewApprovalReceipt(approvalReceipt, {
    ...options,
    materializedAdjudications: adjudications,
  });
  return deepFreeze({ adjudications, approvalReceipt, dataset });
}

export const GOLDEN_HUMAN_REVIEW_APPROVAL_EXPECTED_COUNTS = EXPECTED_COUNTS;
