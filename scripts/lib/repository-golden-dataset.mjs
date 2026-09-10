import { readRepositoryJson } from './repository-claim-registry.mjs';
import {
  assertSafeArtifact,
  canonicalStringify,
  sha256,
} from '../../knowledge/claim-registry/index.mjs';
import {
  GOLDEN_ADJUDICATION_BOUNDARY,
  GOLDEN_ADJUDICATION_SCHEMA_VERSION,
  createValidatedGoldenDataset,
} from '../../knowledge/golden-dataset/index.mjs';
import {
  GOLDEN_HUMAN_REVIEW_BATCH_02_ARTIFACT_PATH,
  validateGoldenHumanReviewBatch02,
} from './golden-human-review-batch-02.mjs';
import {
  GOLDEN_HUMAN_REVIEW_PROPOSAL_02_ARTIFACT_PATH,
  validateGoldenHumanReviewProposal02,
} from './golden-human-review-proposal-02.mjs';

export const GOLDEN_CANDIDATES_PATH =
  'knowledge/golden-dataset/datacenter-kr-v0/public-source-candidates.json';
export const GOLDEN_ADJUDICATIONS_PATH =
  'knowledge/golden-dataset/datacenter-kr-v0/human-adjudications.json';
export const GOLDEN_V1_LINEAGE_PATH =
  'knowledge/golden-dataset/datacenter-kr-v1/lineage.json';
export const GOLDEN_V1_CANDIDATE_ADDITIONS_PATH =
  'knowledge/golden-dataset/datacenter-kr-v1/public-source-candidate-additions.json';
export const GOLDEN_V1_ADJUDICATION_ADDITIONS_PATH =
  'knowledge/golden-dataset/datacenter-kr-v1/human-adjudication-additions.json';
export const GOLDEN_BATCH_01_APPROVAL_RECEIPT_PATH =
  'tmp/codex/pursuit-golden-human-review-batch-01-approval-receipt-non-production.json';
export const GOLDEN_BATCH_02_APPROVAL_RECEIPT_PATH =
  'tmp/codex/pursuit-golden-human-review-batch-02-approval-receipt-non-production.json';

export const GOLDEN_V0_CANDIDATES_CANONICAL_SHA256 =
  '98f435028d7fbdb1c01f4da70e4cdf28d16c4a8fe353e1e5105dc6ed93fa746f';
export const GOLDEN_V0_ADJUDICATIONS_CANONICAL_SHA256 =
  '24f872c06f9fd633acc18f799c4ff73a7df047058ea4b78a9a0f02f42bdd672b';
export const GOLDEN_V0_POST_ADJUDICATION_DATASET_CANONICAL_SHA256 =
  'f9a1c447c13a60f20ed7d166b12aab8fcbd6fbc059a318533aa20d370a724c50';
export const GOLDEN_BATCH_01_APPROVAL_RECEIPT_CANONICAL_SHA256 =
  '0fcb020494f3f4f5f63fc810df50bbb3f5b08b232614d6e3b26d261eae41af58';
export const GOLDEN_V1_CANDIDATE_ADDITIONS_CANONICAL_SHA256 =
  '3e16d95cba3f6130146044d0a2be8542ad08c18b93bf410214161f3b9622edaa';
export const GOLDEN_V1_LINEAGE_CANONICAL_SHA256 =
  'a249deccd0a2cadda6cdc1f5fef8fcffe42ee393c5c17e058e852dea2b4554ae';

const LINEAGE_SCHEMA_VERSION = 'pursuit-golden-dataset-lineage-v1';
const LINEAGE_BOUNDARY = 'IMMUTABLE_ADDITIVE_LINEAGE_NOT_PRODUCTION_EVIDENCE';
const CANDIDATE_ADDITIONS_SCHEMA_VERSION = 'pursuit-golden-source-candidate-additions-v1';
const CANDIDATE_ADDITIONS_BOUNDARY =
  'PUBLIC_SOURCE_REVIEW_SET_ADDITIONS_NOT_PRODUCTION_EVIDENCE';
const ADJUDICATION_ADDITIONS_SCHEMA_VERSION =
  'pursuit-golden-human-adjudication-additions-v1';
const ADJUDICATION_ADDITIONS_BOUNDARY =
  'HUMAN_ADJUDICATION_ADDITIONS_NOT_PRODUCTION_EVIDENCE';

export class RepositoryGoldenDatasetLineageError extends Error {
  constructor(code, path = '$') {
    super(`${code} at ${path}`);
    this.name = 'RepositoryGoldenDatasetLineageError';
    this.code = code;
    this.path = path;
  }
}

function fail(code, path) {
  throw new RepositoryGoldenDatasetLineageError(code, path);
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertObject(value, path) {
  if (!isPlainObject(value)) fail('PLAIN_OBJECT_REQUIRED', path);
}

function assertExactKeys(value, expectedKeys, path) {
  assertObject(value, path);
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (canonicalStringify(actual) !== canonicalStringify(expected)) {
    fail('EXACT_FIELDS_REQUIRED', path);
  }
}

function assertExactValue(actual, expected, code, path) {
  if (actual !== expected) fail(code, path);
}

function assertCanonicalArtifactHash(value, expected, code, path) {
  if (sha256(canonicalStringify(value)) !== expected) fail(code, path);
}

function validateLineage(lineage) {
  assertSafeArtifact(lineage, '$.lineage');
  assertExactKeys(lineage, [
    'documentStatus',
    'schemaVersion',
    'boundary',
    'productionReady',
    'datasetVersion',
    'evaluationAsOf',
    'base',
    'batch01ApprovalReceipt',
    'additions',
    'nonClaims',
    'canonicalSha256',
  ], '$.lineage');
  assertExactValue(
    lineage.canonicalSha256,
    GOLDEN_V1_LINEAGE_CANONICAL_SHA256,
    'GOLDEN_V1_LINEAGE_HASH_PIN_MISMATCH',
    '$.lineage.canonicalSha256',
  );
  const { canonicalSha256, ...withoutHash } = lineage;
  assertCanonicalArtifactHash(
    withoutHash,
    canonicalSha256,
    'GOLDEN_V1_LINEAGE_HASH_MISMATCH',
    '$.lineage.canonicalSha256',
  );
  assertExactValue(
    lineage.documentStatus,
    'PURSUIT_GOLDEN_DATASET_V1_LINEAGE',
    'INVALID_GOLDEN_V1_LINEAGE_STATUS',
    '$.lineage.documentStatus',
  );
  assertExactValue(
    lineage.schemaVersion,
    LINEAGE_SCHEMA_VERSION,
    'UNSUPPORTED_GOLDEN_V1_LINEAGE_SCHEMA',
    '$.lineage.schemaVersion',
  );
  assertExactValue(
    lineage.boundary,
    LINEAGE_BOUNDARY,
    'INVALID_GOLDEN_V1_LINEAGE_BOUNDARY',
    '$.lineage.boundary',
  );
  assertExactValue(
    lineage.productionReady,
    false,
    'PRODUCTION_READY_MUST_BE_FALSE',
    '$.lineage.productionReady',
  );
  assertExactValue(
    lineage.datasetVersion,
    'datacenter-kr-v1',
    'INVALID_GOLDEN_V1_DATASET_VERSION',
    '$.lineage.datasetVersion',
  );
  assertExactValue(
    lineage.evaluationAsOf,
    '2026-07-26T00:00:00.000Z',
    'GOLDEN_V1_EVALUATION_AS_OF_MISMATCH',
    '$.lineage.evaluationAsOf',
  );
  assertExactKeys(lineage.base, [
    'datasetVersion',
    'candidatesPath',
    'adjudicationsPath',
    'candidatesCanonicalSha256',
    'adjudicationsCanonicalSha256',
    'postAdjudicationDatasetCanonicalSha256',
  ], '$.lineage.base');
  const expectedBase = {
    datasetVersion: 'datacenter-kr-v0',
    candidatesPath: GOLDEN_CANDIDATES_PATH,
    adjudicationsPath: GOLDEN_ADJUDICATIONS_PATH,
    candidatesCanonicalSha256: GOLDEN_V0_CANDIDATES_CANONICAL_SHA256,
    adjudicationsCanonicalSha256: GOLDEN_V0_ADJUDICATIONS_CANONICAL_SHA256,
    postAdjudicationDatasetCanonicalSha256:
      GOLDEN_V0_POST_ADJUDICATION_DATASET_CANONICAL_SHA256,
  };
  if (canonicalStringify(lineage.base) !== canonicalStringify(expectedBase)) {
    fail('GOLDEN_V0_LINEAGE_PIN_MISMATCH', '$.lineage.base');
  }
  assertExactKeys(lineage.batch01ApprovalReceipt, [
    'path',
    'canonicalSha256',
  ], '$.lineage.batch01ApprovalReceipt');
  if (canonicalStringify(lineage.batch01ApprovalReceipt) !== canonicalStringify({
    path: GOLDEN_BATCH_01_APPROVAL_RECEIPT_PATH,
    canonicalSha256: GOLDEN_BATCH_01_APPROVAL_RECEIPT_CANONICAL_SHA256,
  })) {
    fail('GOLDEN_BATCH_01_RECEIPT_LINEAGE_PIN_MISMATCH', '$.lineage.batch01ApprovalReceipt');
  }
  assertExactKeys(lineage.additions, [
    'candidatesPath',
    'candidatesCanonicalSha256',
    'adjudicationsPath',
  ], '$.lineage.additions');
  const expectedAdditions = {
    candidatesPath: GOLDEN_V1_CANDIDATE_ADDITIONS_PATH,
    candidatesCanonicalSha256: GOLDEN_V1_CANDIDATE_ADDITIONS_CANONICAL_SHA256,
    adjudicationsPath: GOLDEN_V1_ADJUDICATION_ADDITIONS_PATH,
  };
  if (canonicalStringify(lineage.additions) !== canonicalStringify(expectedAdditions)) {
    fail('GOLDEN_V1_ADDITION_LINEAGE_PIN_MISMATCH', '$.lineage.additions');
  }
  if (!Array.isArray(lineage.nonClaims) || lineage.nonClaims.length !== 3) {
    fail('GOLDEN_V1_LINEAGE_NON_CLAIMS_REQUIRED', '$.lineage.nonClaims');
  }
}

function validateCandidateAdditions(additions, evaluationAsOf) {
  assertSafeArtifact(additions, '$.candidateAdditions');
  assertExactKeys(additions, [
    'schemaVersion',
    'boundary',
    'productionReady',
    'evaluationAsOf',
    'baseDatasetVersion',
    'documents',
    'projects',
    'capabilityClaims',
    'requirementCapabilityPairs',
  ], '$.candidateAdditions');
  assertExactValue(
    additions.schemaVersion,
    CANDIDATE_ADDITIONS_SCHEMA_VERSION,
    'UNSUPPORTED_GOLDEN_V1_CANDIDATE_ADDITIONS_SCHEMA',
    '$.candidateAdditions.schemaVersion',
  );
  assertExactValue(
    additions.boundary,
    CANDIDATE_ADDITIONS_BOUNDARY,
    'INVALID_GOLDEN_V1_CANDIDATE_ADDITIONS_BOUNDARY',
    '$.candidateAdditions.boundary',
  );
  assertExactValue(
    additions.productionReady,
    false,
    'PRODUCTION_READY_MUST_BE_FALSE',
    '$.candidateAdditions.productionReady',
  );
  assertExactValue(
    additions.evaluationAsOf,
    evaluationAsOf,
    'GOLDEN_V1_EVALUATION_AS_OF_MISMATCH',
    '$.candidateAdditions.evaluationAsOf',
  );
  assertExactValue(
    additions.baseDatasetVersion,
    'datacenter-kr-v0',
    'INVALID_GOLDEN_V1_BASE_DATASET_VERSION',
    '$.candidateAdditions.baseDatasetVersion',
  );
  if (!Array.isArray(additions.documents) || additions.documents.length !== 2) {
    fail('EXACT_TWO_GOLDEN_V1_DOCUMENT_ADDITIONS_REQUIRED', '$.candidateAdditions.documents');
  }
  if (!Array.isArray(additions.projects) || additions.projects.length !== 2) {
    fail('EXACT_TWO_GOLDEN_V1_PROJECT_ADDITIONS_REQUIRED', '$.candidateAdditions.projects');
  }
  if (!Array.isArray(additions.capabilityClaims) || additions.capabilityClaims.length !== 0) {
    fail('GOLDEN_V1_CAPABILITY_ADDITIONS_REFUSED', '$.candidateAdditions.capabilityClaims');
  }
  if (
    !Array.isArray(additions.requirementCapabilityPairs)
    || additions.requirementCapabilityPairs.length !== 0
  ) {
    fail(
      'GOLDEN_V1_PAIR_ADDITIONS_REFUSED',
      '$.candidateAdditions.requirementCapabilityPairs',
    );
  }
}

function validateAdjudicationAdditions(additions, evaluationAsOf) {
  assertSafeArtifact(additions, '$.adjudicationAdditions');
  assertExactKeys(additions, [
    'schemaVersion',
    'boundary',
    'productionReady',
    'evaluationAsOf',
    'baseDatasetVersion',
    'projectAdjudications',
    'capabilityAdjudications',
    'pairAdjudications',
    'revisionAdjudications',
  ], '$.adjudicationAdditions');
  assertExactValue(
    additions.schemaVersion,
    ADJUDICATION_ADDITIONS_SCHEMA_VERSION,
    'UNSUPPORTED_GOLDEN_V1_ADJUDICATION_ADDITIONS_SCHEMA',
    '$.adjudicationAdditions.schemaVersion',
  );
  assertExactValue(
    additions.boundary,
    ADJUDICATION_ADDITIONS_BOUNDARY,
    'INVALID_GOLDEN_V1_ADJUDICATION_ADDITIONS_BOUNDARY',
    '$.adjudicationAdditions.boundary',
  );
  assertExactValue(
    additions.productionReady,
    false,
    'PRODUCTION_READY_MUST_BE_FALSE',
    '$.adjudicationAdditions.productionReady',
  );
  assertExactValue(
    additions.evaluationAsOf,
    evaluationAsOf,
    'GOLDEN_V1_EVALUATION_AS_OF_MISMATCH',
    '$.adjudicationAdditions.evaluationAsOf',
  );
  assertExactValue(
    additions.baseDatasetVersion,
    'datacenter-kr-v0',
    'INVALID_GOLDEN_V1_BASE_DATASET_VERSION',
    '$.adjudicationAdditions.baseDatasetVersion',
  );
  if (
    !Array.isArray(additions.projectAdjudications)
    || ![0, 7].includes(additions.projectAdjudications.length)
  ) {
    fail(
      'GOLDEN_V1_PROJECT_ADJUDICATION_ADDITIONS_MUST_BE_EMPTY_OR_COMPLETE_BATCH_02',
      '$.adjudicationAdditions.projectAdjudications',
    );
  }
  for (const field of [
    'capabilityAdjudications',
    'pairAdjudications',
    'revisionAdjudications',
  ]) {
    if (!Array.isArray(additions[field]) || additions[field].length !== 0) {
      fail('GOLDEN_V1_HUMAN_ADJUDICATION_ADDITIONS_MUST_BE_EMPTY', `$.adjudicationAdditions.${field}`);
    }
  }
  return additions.projectAdjudications.length;
}

function validateBatch01ApprovalReceipt(receipt) {
  assertSafeArtifact(receipt, '$.batch01ApprovalReceipt');
  assertExactValue(
    receipt.canonicalSha256,
    GOLDEN_BATCH_01_APPROVAL_RECEIPT_CANONICAL_SHA256,
    'GOLDEN_BATCH_01_RECEIPT_HASH_PIN_MISMATCH',
    '$.batch01ApprovalReceipt.canonicalSha256',
  );
  const { canonicalSha256, ...withoutHash } = receipt;
  assertCanonicalArtifactHash(
    withoutHash,
    canonicalSha256,
    'GOLDEN_BATCH_01_RECEIPT_HASH_MISMATCH',
    '$.batch01ApprovalReceipt.canonicalSha256',
  );
  assertExactValue(
    receipt.materializedAdjudicationsCanonicalSha256,
    GOLDEN_V0_ADJUDICATIONS_CANONICAL_SHA256,
    'GOLDEN_BATCH_01_RECEIPT_ADJUDICATION_HASH_MISMATCH',
    '$.batch01ApprovalReceipt.materializedAdjudicationsCanonicalSha256',
  );
  assertExactValue(
    receipt.postAdjudicationDatasetCanonicalSha256,
    GOLDEN_V0_POST_ADJUDICATION_DATASET_CANONICAL_SHA256,
    'GOLDEN_BATCH_01_RECEIPT_DATASET_HASH_MISMATCH',
    '$.batch01ApprovalReceipt.postAdjudicationDatasetCanonicalSha256',
  );
}

function validateBatch02ApprovalReceipt({
  receipt,
  reviewBatch,
  proposal,
  rawAdjudicationAdditions,
  rawAdjudications,
  rawCandidates,
  rawBaseAdjudications,
  preAdjudicationDataset,
  postAdjudicationDataset,
}) {
  assertSafeArtifact(receipt, '$.batch02ApprovalReceipt');
  assertExactKeys(receipt, [
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
    'confirmation',
    'disposition',
    'attestation',
    'changes',
    'preAdjudicationDatasetCanonicalSha256',
    'priorMaterializedAdjudicationsCanonicalSha256',
    'priorApprovalReceiptCanonicalSha256',
    'reviewBatchCanonicalSha256',
    'proposalCanonicalSha256',
    'materializedAdjudicationAdditionsCanonicalSha256',
    'composedAdjudicationsCanonicalSha256',
    'postAdjudicationDatasetCanonicalSha256',
    'postAdjudicationDatasetState',
    'scope',
    'nonClaims',
    'canonicalSha256',
  ], '$.batch02ApprovalReceipt');
  const { canonicalSha256, ...withoutHash } = receipt;
  assertCanonicalArtifactHash(
    withoutHash,
    canonicalSha256,
    'GOLDEN_BATCH_02_RECEIPT_HASH_MISMATCH',
    '$.batch02ApprovalReceipt.canonicalSha256',
  );
  const exactFields = [
    ['documentStatus', 'PURSUIT_GOLDEN_HUMAN_REVIEW_BATCH_02_APPROVAL_MATERIALIZED'],
    ['schemaVersion', 'pursuit-golden-human-review-approval-receipt-02-v0'],
    ['boundary', 'REPOSITORY_APPROVAL_ASSERTION_NOT_AUTHENTICATED_IDENTITY'],
    ['productionReady', false],
    ['goldenReady', true],
    ['humanAdjudicationRecorded', true],
    ['approvalStatus', 'APPROVED_AS_WRITTEN_AND_MATERIALIZED'],
    ['reviewerIdentityStatus', 'UNAUTHENTICATED_REPOSITORY_ASSERTION'],
    ['evaluationAsOf', '2026-07-26T00:00:00.000Z'],
    ['confirmation', 'GOLDEN_BATCH_02_APPROVAL'],
    ['disposition', 'APPROVE_AS_WRITTEN'],
    [
      'attestation',
      '나는 연결된 출처, 근거, 한계를 직접 검토했고 이 제안들을 내 도메인 판단으로 채택합니다.',
    ],
    ['priorApprovalReceiptCanonicalSha256', GOLDEN_BATCH_01_APPROVAL_RECEIPT_CANONICAL_SHA256],
    ['priorMaterializedAdjudicationsCanonicalSha256', GOLDEN_V0_ADJUDICATIONS_CANONICAL_SHA256],
    ['preAdjudicationDatasetCanonicalSha256', preAdjudicationDataset.canonicalSha256],
    ['reviewBatchCanonicalSha256', reviewBatch.canonicalSha256],
    ['proposalCanonicalSha256', proposal.canonicalSha256],
    [
      'composedAdjudicationsCanonicalSha256',
      sha256(canonicalStringify(rawAdjudications)),
    ],
    ['postAdjudicationDatasetCanonicalSha256', postAdjudicationDataset.canonicalSha256],
    ['postAdjudicationDatasetState', 'HUMAN_CONFIRMED'],
  ];
  for (const [field, expected] of exactFields) {
    assertExactValue(
      receipt[field],
      expected,
      'GOLDEN_BATCH_02_RECEIPT_BINDING_MISMATCH',
      `$.batch02ApprovalReceipt.${field}`,
    );
  }
  assertExactValue(
    receipt.materializedAdjudicationAdditionsCanonicalSha256,
    sha256(canonicalStringify(rawAdjudicationAdditions)),
    'GOLDEN_BATCH_02_RECEIPT_ADDITION_HASH_MISMATCH',
    '$.batch02ApprovalReceipt.materializedAdjudicationAdditionsCanonicalSha256',
  );
  if (canonicalStringify(receipt.scope) !== canonicalStringify({
    projectCount: 7,
    capabilityCount: 0,
    pairCount: 0,
    revisionCount: 0,
  })) {
    fail('GOLDEN_BATCH_02_RECEIPT_SCOPE_MISMATCH', '$.batch02ApprovalReceipt.scope');
  }
  if (!Array.isArray(receipt.changes) || receipt.changes.length !== 0) {
    fail('GOLDEN_BATCH_02_RECEIPT_CHANGES_REFUSED', '$.batch02ApprovalReceipt.changes');
  }
  if (
    typeof receipt.reviewer !== 'string'
    || receipt.reviewer.trim().length === 0
    || typeof receipt.reviewReceipt !== 'string'
    || receipt.reviewReceipt.trim().length === 0
    || typeof receipt.reviewedAt !== 'string'
    || typeof receipt.attestation !== 'string'
    || receipt.attestation.trim().length === 0
  ) {
    fail('GOLDEN_BATCH_02_RECEIPT_REVIEW_IDENTITY_FIELDS_REQUIRED', '$.batch02ApprovalReceipt');
  }
  const additions = rawAdjudicationAdditions.projectAdjudications;
  const reviewedAt = new Date(receipt.reviewedAt);
  if (
    !Number.isFinite(reviewedAt.getTime())
    || reviewedAt.toISOString() !== receipt.reviewedAt
    || receipt.reviewedAt < preAdjudicationDataset.candidates.evaluationAsOf
    || receipt.reviewedAt > new Date().toISOString()
  ) {
    fail('GOLDEN_BATCH_02_RECEIPT_REVIEW_TIMESTAMP_INVALID', '$.batch02ApprovalReceipt.reviewedAt');
  }
  if (!additions.every((adjudication) => (
    adjudication.reviewReceipt === receipt.reviewReceipt
      && adjudication.reviewedAt === receipt.reviewedAt
  ))) {
    fail('GOLDEN_BATCH_02_RECEIPT_REVIEW_ENVELOPE_MISMATCH', '$.batch02ApprovalReceipt');
  }
  const alreadyAdjudicatedKeys = new Set(
    rawBaseAdjudications.projectAdjudications.map((adjudication) => adjudication.projectKey),
  );
  const pendingProjects = rawCandidates.projects
    .filter((project) => !alreadyAdjudicatedKeys.has(project.projectKey));
  const stageByProjectKey = new Map(
    pendingProjects.map((project) => [project.projectKey, project.stageObservation.stage]),
  );
  const actualProjectKeys = additions.map((adjudication) => adjudication.projectKey).sort();
  const expectedProjectKeys = pendingProjects.map((project) => project.projectKey).sort();
  if (canonicalStringify(actualProjectKeys) !== canonicalStringify(expectedProjectKeys)) {
    fail('GOLDEN_BATCH_02_PROJECT_SCOPE_MISMATCH', '$.adjudicationAdditions.projectAdjudications');
  }
  if (!additions.every((adjudication) => (
    adjudication.currentStage === stageByProjectKey.get(adjudication.projectKey)
  ))) {
    fail('GOLDEN_BATCH_02_PROJECT_STAGE_MISMATCH', '$.adjudicationAdditions.projectAdjudications');
  }
  const expectedAdjudicationAdditions = {
    schemaVersion: rawAdjudicationAdditions.schemaVersion,
    boundary: rawAdjudicationAdditions.boundary,
    productionReady: false,
    evaluationAsOf: proposal.evaluationAsOf,
    baseDatasetVersion: 'datacenter-kr-v0',
    projectAdjudications: proposal.projectProposals.map(({ suggestedAdjudication }) => {
      const { projectKey, ...decision } = suggestedAdjudication;
      return {
        projectKey,
        reviewAuthority: 'HUMAN_DOMAIN_REVIEW',
        reviewReceipt: receipt.reviewReceipt,
        reviewedAt: receipt.reviewedAt,
        ...decision,
      };
    }),
    capabilityAdjudications: [],
    pairAdjudications: [],
    revisionAdjudications: [],
  };
  if (
    canonicalStringify(rawAdjudicationAdditions)
    !== canonicalStringify(expectedAdjudicationAdditions)
  ) {
    fail(
      'GOLDEN_BATCH_02_ADJUDICATIONS_DO_NOT_MATCH_PROPOSAL',
      '$.adjudicationAdditions',
    );
  }
}

function composeCandidates(base, additions) {
  return {
    ...base,
    documents: [...base.documents, ...additions.documents],
    projects: [...base.projects, ...additions.projects],
    capabilityClaims: [...base.capabilityClaims, ...additions.capabilityClaims],
    requirementCapabilityPairs: [
      ...base.requirementCapabilityPairs,
      ...additions.requirementCapabilityPairs,
    ],
  };
}

function composeAdjudications(base, additions) {
  return {
    ...base,
    projectAdjudications: [
      ...base.projectAdjudications,
      ...additions.projectAdjudications,
    ],
    capabilityAdjudications: [
      ...base.capabilityAdjudications,
      ...additions.capabilityAdjudications,
    ],
    pairAdjudications: [...base.pairAdjudications, ...additions.pairAdjudications],
    revisionAdjudications: [
      ...base.revisionAdjudications,
      ...additions.revisionAdjudications,
    ],
  };
}

export function buildEmptyGoldenAdjudicationInput(evaluationAsOf) {
  return {
    schemaVersion: GOLDEN_ADJUDICATION_SCHEMA_VERSION,
    boundary: GOLDEN_ADJUDICATION_BOUNDARY,
    productionReady: false,
    evaluationAsOf,
    projectAdjudications: [],
    capabilityAdjudications: [],
    pairAdjudications: [],
    revisionAdjudications: [],
  };
}

export async function loadRepositoryGoldenCandidateIntakeDataset({
  candidatesPath = GOLDEN_CANDIDATES_PATH,
} = {}) {
  const rawCandidates = await readRepositoryJson(candidatesPath);
  const rawAdjudications = buildEmptyGoldenAdjudicationInput(rawCandidates.evaluationAsOf);
  return {
    rawCandidates,
    rawAdjudications,
    dataset: createValidatedGoldenDataset(rawCandidates, rawAdjudications),
  };
}

export async function loadRepositoryGoldenDataset({
  candidatesPath = GOLDEN_CANDIDATES_PATH,
  adjudicationsPath = GOLDEN_ADJUDICATIONS_PATH,
} = {}) {
  const [rawCandidates, rawAdjudications] = await Promise.all([
    readRepositoryJson(candidatesPath),
    readRepositoryJson(adjudicationsPath),
  ]);
  return {
    rawCandidates,
    rawAdjudications,
    dataset: createValidatedGoldenDataset(rawCandidates, rawAdjudications),
  };
}

export async function loadRepositoryGoldenDatasetV1({
  lineagePath = GOLDEN_V1_LINEAGE_PATH,
  baseCandidatesPath = GOLDEN_CANDIDATES_PATH,
  baseAdjudicationsPath = GOLDEN_ADJUDICATIONS_PATH,
  candidateAdditionsPath = GOLDEN_V1_CANDIDATE_ADDITIONS_PATH,
  adjudicationAdditionsPath = GOLDEN_V1_ADJUDICATION_ADDITIONS_PATH,
  approvalReceiptPath = GOLDEN_BATCH_01_APPROVAL_RECEIPT_PATH,
  batch02ApprovalReceiptPath = GOLDEN_BATCH_02_APPROVAL_RECEIPT_PATH,
  batch02ReviewBatchPath = GOLDEN_HUMAN_REVIEW_BATCH_02_ARTIFACT_PATH,
  batch02ProposalPath = GOLDEN_HUMAN_REVIEW_PROPOSAL_02_ARTIFACT_PATH,
} = {}) {
  const [
    lineage,
    rawBaseCandidates,
    rawBaseAdjudications,
    rawCandidateAdditions,
    rawAdjudicationAdditions,
    rawBatch01ApprovalReceipt,
  ] = await Promise.all([
    readRepositoryJson(lineagePath),
    readRepositoryJson(baseCandidatesPath),
    readRepositoryJson(baseAdjudicationsPath),
    readRepositoryJson(candidateAdditionsPath),
    readRepositoryJson(adjudicationAdditionsPath),
    readRepositoryJson(approvalReceiptPath),
  ]);

  validateLineage(lineage);
  assertCanonicalArtifactHash(
    rawBaseCandidates,
    GOLDEN_V0_CANDIDATES_CANONICAL_SHA256,
    'GOLDEN_V0_CANDIDATE_BASE_HASH_MISMATCH',
    '$.baseCandidates',
  );
  assertCanonicalArtifactHash(
    rawBaseAdjudications,
    GOLDEN_V0_ADJUDICATIONS_CANONICAL_SHA256,
    'GOLDEN_V0_ADJUDICATION_BASE_HASH_MISMATCH',
    '$.baseAdjudications',
  );
  assertCanonicalArtifactHash(
    rawCandidateAdditions,
    GOLDEN_V1_CANDIDATE_ADDITIONS_CANONICAL_SHA256,
    'GOLDEN_V1_CANDIDATE_ADDITIONS_HASH_MISMATCH',
    '$.candidateAdditions',
  );
  validateCandidateAdditions(rawCandidateAdditions, rawBaseCandidates.evaluationAsOf);
  const batch02ProjectCount = validateAdjudicationAdditions(
    rawAdjudicationAdditions,
    rawBaseCandidates.evaluationAsOf,
  );
  validateBatch01ApprovalReceipt(rawBatch01ApprovalReceipt);

  const baseDataset = createValidatedGoldenDataset(
    rawBaseCandidates,
    rawBaseAdjudications,
  );
  assertExactValue(
    baseDataset.canonicalSha256,
    GOLDEN_V0_POST_ADJUDICATION_DATASET_CANONICAL_SHA256,
    'GOLDEN_V0_POST_ADJUDICATION_DATASET_HASH_MISMATCH',
    '$.baseDataset.canonicalSha256',
  );

  const rawCandidates = composeCandidates(rawBaseCandidates, rawCandidateAdditions);
  const preAdjudicationDataset = createValidatedGoldenDataset(
    rawCandidates,
    rawBaseAdjudications,
  );
  const rawAdjudications = composeAdjudications(
    rawBaseAdjudications,
    rawAdjudicationAdditions,
  );
  const dataset = createValidatedGoldenDataset(rawCandidates, rawAdjudications);
  let rawBatch02ApprovalReceipt = null;
  let rawBatch02ReviewBatch = null;
  let rawBatch02Proposal = null;
  if (batch02ProjectCount === 7) {
    try {
      [
        rawBatch02ApprovalReceipt,
        rawBatch02ReviewBatch,
        rawBatch02Proposal,
      ] = await Promise.all([
        readRepositoryJson(batch02ApprovalReceiptPath),
        readRepositoryJson(batch02ReviewBatchPath),
        readRepositoryJson(batch02ProposalPath),
      ]);
    } catch {
      fail(
        'GOLDEN_BATCH_02_APPROVAL_ARTIFACT_SET_REQUIRED',
        '$.batch02ApprovalArtifacts',
      );
    }
    validateGoldenHumanReviewBatch02(rawBatch02ReviewBatch, preAdjudicationDataset);
    validateGoldenHumanReviewProposal02(
      rawBatch02Proposal,
      rawBatch02ReviewBatch,
      preAdjudicationDataset,
    );
    validateBatch02ApprovalReceipt({
      receipt: rawBatch02ApprovalReceipt,
      reviewBatch: rawBatch02ReviewBatch,
      proposal: rawBatch02Proposal,
      rawAdjudicationAdditions,
      rawAdjudications,
      rawCandidates,
      rawBaseAdjudications,
      preAdjudicationDataset,
      postAdjudicationDataset: dataset,
    });
  }
  return {
    lineage,
    rawBaseCandidates,
    rawBaseAdjudications,
    rawCandidateAdditions,
    rawAdjudicationAdditions,
    rawBatch01ApprovalReceipt,
    rawBatch02ApprovalReceipt,
    rawBatch02ReviewBatch,
    rawBatch02Proposal,
    baseDataset,
    preAdjudicationDataset,
    rawCandidates,
    rawAdjudications,
    dataset,
  };
}

export async function loadRepositoryCurrentGoldenDataset(options = {}) {
  return loadRepositoryGoldenDatasetV1(options);
}
