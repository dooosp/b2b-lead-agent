#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildGoldenDatasetAuditReport,
  createValidatedGoldenDataset,
} from '../knowledge/golden-dataset/index.mjs';
import {
  assertSafeArtifact,
  canonicalStringify,
  sha256,
} from '../knowledge/claim-registry/index.mjs';
import {
  GOLDEN_HUMAN_REVIEW_APPROVAL_ATTESTATION,
  GOLDEN_HUMAN_REVIEW_APPROVAL_DISPOSITION,
  materializeGoldenHumanReviewApproval,
  validateGoldenHumanReviewApprovalReceipt,
} from './lib/golden-human-review-approval.mjs';
import {
  GOLDEN_HUMAN_REVIEW_APPROVAL_02_ATTESTATION,
  GOLDEN_HUMAN_REVIEW_APPROVAL_02_CONFIRMATION,
  GOLDEN_HUMAN_REVIEW_APPROVAL_02_DISPOSITION,
  materializeGoldenHumanReviewApproval02,
  validateGoldenHumanReviewApprovalReceipt02,
} from './lib/golden-human-review-approval-02.mjs';
import {
  buildGoldenHumanReviewBatch02,
  validateGoldenHumanReviewBatch02,
} from './lib/golden-human-review-batch-02.mjs';
import {
  buildGoldenHumanReviewBatch,
  validateGoldenHumanReviewBatch,
} from './lib/golden-human-review-batch.mjs';
import {
  buildGoldenHumanReviewProposal02,
  renderGoldenHumanReviewProposal02Markdown,
  validateGoldenHumanReviewProposal02,
} from './lib/golden-human-review-proposal-02.mjs';
import {
  buildGoldenHumanReviewProposal,
  renderGoldenHumanReviewProposalMarkdown,
  validateGoldenHumanReviewProposal,
} from './lib/golden-human-review-proposal.mjs';
import { validateGoldenDatasetAuditReport } from './lib/golden-dataset-report-validation.mjs';
import {
  readRepositoryJson,
  REPO_ROOT,
} from './lib/repository-claim-registry.mjs';
import {
  GOLDEN_V1_CANDIDATE_ADDITIONS_CANONICAL_SHA256,
  GOLDEN_V1_ADJUDICATION_ADDITIONS_PATH,
  GOLDEN_V1_CANDIDATE_ADDITIONS_PATH,
  loadRepositoryGoldenCandidateIntakeDataset,
  loadRepositoryGoldenDataset,
} from './lib/repository-golden-dataset.mjs';

export const GOLDEN_GENERATED_ARTIFACT_PATHS = Object.freeze([
  'tmp/codex/pursuit-golden-dataset-audit-non-production.json',
  'tmp/codex/pursuit-golden-human-review-batch-01.json',
  'tmp/codex/pursuit-golden-human-review-batch-01-proposal.json',
  'docs/roadmap/pursuit-golden-human-review-batch-01-proposal.md',
  'tmp/codex/pursuit-golden-human-review-batch-01-approval-receipt-non-production.json',
  'tmp/codex/pursuit-golden-human-review-batch-02.json',
  'tmp/codex/pursuit-golden-human-review-batch-02-proposal.json',
  'docs/roadmap/pursuit-golden-human-review-batch-02-proposal.md',
  'tmp/codex/pursuit-golden-human-review-batch-02-approval-receipt-non-production.json',
]);

const [
  AUDIT_PATH,
  BATCH_01_PATH,
  PROPOSAL_01_PATH,
  PROPOSAL_01_MARKDOWN_PATH,
  APPROVAL_RECEIPT_01_PATH,
  BATCH_02_PATH,
  PROPOSAL_02_PATH,
  PROPOSAL_02_MARKDOWN_PATH,
  APPROVAL_RECEIPT_02_PATH,
] = GOLDEN_GENERATED_ARTIFACT_PATHS;

const PINNED_APPROVAL_ASSERTIONS = Object.freeze({
  batch01: Object.freeze({
    reviewer: 'Jang tae ho',
    reviewReceipt: 'golden-batch01-jang-tae-ho-20260726t034810z-101802f83365',
    reviewedAt: '2026-07-26T03:48:10.000Z',
  }),
  batch02: Object.freeze({
    reviewer: 'Jang tae ho',
    reviewReceipt:
      'golden-batch02-20260726t045706252z-72500e3c4a75-4876e32ee2b14721995a82eb9952f9b7',
    reviewedAt: '2026-07-26T04:57:06.252Z',
  }),
});

const CANDIDATE_ADDITIONS_KEYS = Object.freeze([
  'schemaVersion',
  'boundary',
  'productionReady',
  'evaluationAsOf',
  'baseDatasetVersion',
  'documents',
  'projects',
  'capabilityClaims',
  'requirementCapabilityPairs',
]);

export class GoldenGeneratedArtifactError extends Error {
  constructor(code, relativePath, cause) {
    super(`${code}:${relativePath}`, cause ? { cause } : undefined);
    this.name = 'GoldenGeneratedArtifactError';
    this.code = code;
    this.relativePath = relativePath;
    this.path = relativePath;
  }
}

function fail(code, relativePath, cause) {
  throw new GoldenGeneratedArtifactError(code, relativePath, cause);
}

function serializeJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function buildAtPath(relativePath, operation) {
  try {
    return await operation();
  } catch (cause) {
    if (cause instanceof GoldenGeneratedArtifactError) throw cause;
    fail('GOLDEN_GENERATED_ARTIFACT_EXPECTED_INVALID', relativePath, cause);
  }
}

function expectedEntry(relativePath, format, value, validateActual) {
  return Object.freeze({
    relativePath,
    format,
    expectedContent: format === 'json' ? serializeJson(value) : value,
    validateActual,
  });
}

function composeCandidates(base, additions) {
  return {
    ...base,
    documents: [...base.documents, ...additions.documents],
    projects: [...base.projects, ...additions.projects],
    capabilityClaims: [
      ...base.capabilityClaims,
      ...additions.capabilityClaims,
    ],
    requirementCapabilityPairs: [
      ...base.requirementCapabilityPairs,
      ...additions.requirementCapabilityPairs,
    ],
  };
}

function emptyAdjudicationAdditions(storedAdditions) {
  return {
    ...storedAdditions,
    projectAdjudications: [],
    capabilityAdjudications: [],
    pairAdjudications: [],
    revisionAdjudications: [],
  };
}

function assertSameCanonical(left, right, code) {
  if (canonicalStringify(left) !== canonicalStringify(right)) {
    const error = new Error(code);
    error.code = code;
    throw error;
  }
}

function validatePinnedCandidateAdditions(additions, evaluationAsOf) {
  assertSafeArtifact(additions, '$.candidateAdditions');
  if (
    !additions
    || typeof additions !== 'object'
    || Array.isArray(additions)
    || canonicalStringify(Object.keys(additions).sort())
      !== canonicalStringify([...CANDIDATE_ADDITIONS_KEYS].sort())
  ) {
    const error = new Error('GOLDEN_V1_CANDIDATE_ADDITIONS_FIELDS_INVALID');
    error.code = 'GOLDEN_V1_CANDIDATE_ADDITIONS_FIELDS_INVALID';
    throw error;
  }
  if (
    sha256(canonicalStringify(additions))
      !== GOLDEN_V1_CANDIDATE_ADDITIONS_CANONICAL_SHA256
  ) {
    const error = new Error('GOLDEN_V1_CANDIDATE_ADDITIONS_HASH_MISMATCH');
    error.code = 'GOLDEN_V1_CANDIDATE_ADDITIONS_HASH_MISMATCH';
    throw error;
  }
  if (
    additions.schemaVersion !== 'pursuit-golden-source-candidate-additions-v1'
    || additions.boundary
      !== 'PUBLIC_SOURCE_REVIEW_SET_ADDITIONS_NOT_PRODUCTION_EVIDENCE'
    || additions.productionReady !== false
    || additions.evaluationAsOf !== evaluationAsOf
    || additions.baseDatasetVersion !== 'datacenter-kr-v0'
    || !Array.isArray(additions.documents)
    || additions.documents.length !== 2
    || !Array.isArray(additions.projects)
    || additions.projects.length !== 2
    || !Array.isArray(additions.capabilityClaims)
    || additions.capabilityClaims.length !== 0
    || !Array.isArray(additions.requirementCapabilityPairs)
    || additions.requirementCapabilityPairs.length !== 0
  ) {
    const error = new Error('GOLDEN_V1_CANDIDATE_ADDITIONS_ENVELOPE_INVALID');
    error.code = 'GOLDEN_V1_CANDIDATE_ADDITIONS_ENVELOPE_INVALID';
    throw error;
  }
  return additions;
}

export async function buildExpectedGoldenGeneratedArtifacts({
  readGoldenJson = readRepositoryJson,
} = {}) {
  const [
    batch01Intake,
    storedBatch01,
    candidateAdditions,
    storedBatch02Additions,
  ] = await Promise.all([
    buildAtPath(BATCH_01_PATH, () => loadRepositoryGoldenCandidateIntakeDataset()),
    buildAtPath(APPROVAL_RECEIPT_01_PATH, () => loadRepositoryGoldenDataset()),
    buildAtPath(
      BATCH_02_PATH,
      () => readGoldenJson(GOLDEN_V1_CANDIDATE_ADDITIONS_PATH),
    ),
    buildAtPath(
      APPROVAL_RECEIPT_02_PATH,
      () => readGoldenJson(GOLDEN_V1_ADJUDICATION_ADDITIONS_PATH),
    ),
  ]);
  const batch01 = await buildAtPath(BATCH_01_PATH, () => {
    const batch = buildGoldenHumanReviewBatch(batch01Intake.dataset);
    validateGoldenHumanReviewBatch(batch);
    return batch;
  });
  const proposal01 = await buildAtPath(PROPOSAL_01_PATH, () => {
    const proposal = buildGoldenHumanReviewProposal(batch01);
    validateGoldenHumanReviewProposal(proposal, batch01);
    return proposal;
  });
  const proposal01Markdown = await buildAtPath(
    PROPOSAL_01_MARKDOWN_PATH,
    () => renderGoldenHumanReviewProposalMarkdown(proposal01, batch01),
  );

  const batch01ApprovalOptions = {
    rawCandidates: batch01Intake.rawCandidates,
    rawAdjudications: batch01Intake.rawAdjudications,
    reviewBatch: batch01,
    proposal: proposal01,
    approval: {
      ...PINNED_APPROVAL_ASSERTIONS.batch01,
      disposition: GOLDEN_HUMAN_REVIEW_APPROVAL_DISPOSITION,
      attestation: GOLDEN_HUMAN_REVIEW_APPROVAL_ATTESTATION,
      changes: [],
      datasetCanonicalSha256: batch01Intake.dataset.canonicalSha256,
      proposalCanonicalSha256: proposal01.canonicalSha256,
    },
    now: PINNED_APPROVAL_ASSERTIONS.batch01.reviewedAt,
  };
  const batch01Approval = await buildAtPath(APPROVAL_RECEIPT_01_PATH, () => {
    const result = materializeGoldenHumanReviewApproval(batch01ApprovalOptions);
    assertSameCanonical(
      result.adjudications,
      storedBatch01.rawAdjudications,
      'GOLDEN_BATCH_01_MATERIALIZED_DATA_DRIFT',
    );
    return result;
  });

  const combinedCandidates = await buildAtPath(BATCH_02_PATH, () => (
    composeCandidates(
      storedBatch01.rawCandidates,
      validatePinnedCandidateAdditions(
        candidateAdditions,
        storedBatch01.rawCandidates.evaluationAsOf,
      ),
    )
  ));
  const batch02Dataset = await buildAtPath(BATCH_02_PATH, () => (
    createValidatedGoldenDataset(
      combinedCandidates,
      storedBatch01.rawAdjudications,
    )
  ));

  const batch02 = await buildAtPath(BATCH_02_PATH, () => {
    const batch = buildGoldenHumanReviewBatch02(batch02Dataset);
    validateGoldenHumanReviewBatch02(batch, batch02Dataset);
    return batch;
  });
  const proposal02 = await buildAtPath(PROPOSAL_02_PATH, () => {
    const proposal = buildGoldenHumanReviewProposal02(batch02, batch02Dataset);
    validateGoldenHumanReviewProposal02(proposal, batch02, batch02Dataset);
    return proposal;
  });
  const proposal02Markdown = await buildAtPath(
    PROPOSAL_02_MARKDOWN_PATH,
    () => renderGoldenHumanReviewProposal02Markdown(
      proposal02,
      batch02,
      batch02Dataset,
    ),
  );

  const batch02ApprovalOptions = {
    rawCandidates: combinedCandidates,
    rawPriorAdjudications: storedBatch01.rawAdjudications,
    rawAdditions: emptyAdjudicationAdditions(storedBatch02Additions),
    priorApprovalReceipt: batch01Approval.approvalReceipt,
    reviewBatch: batch02,
    proposal: proposal02,
    approval: {
      confirmation: GOLDEN_HUMAN_REVIEW_APPROVAL_02_CONFIRMATION,
      ...PINNED_APPROVAL_ASSERTIONS.batch02,
      disposition: GOLDEN_HUMAN_REVIEW_APPROVAL_02_DISPOSITION,
      attestation: GOLDEN_HUMAN_REVIEW_APPROVAL_02_ATTESTATION,
      changes: [],
      datasetCanonicalSha256: batch02Dataset.canonicalSha256,
      priorMaterializedAdjudicationsCanonicalSha256:
        batch01Approval.approvalReceipt.materializedAdjudicationsCanonicalSha256,
      priorApprovalReceiptCanonicalSha256:
        batch01Approval.approvalReceipt.canonicalSha256,
      reviewBatchCanonicalSha256: batch02.canonicalSha256,
      proposalCanonicalSha256: proposal02.canonicalSha256,
    },
    now: PINNED_APPROVAL_ASSERTIONS.batch02.reviewedAt,
  };
  const batch02Approval = await buildAtPath(APPROVAL_RECEIPT_02_PATH, () => {
    const result = materializeGoldenHumanReviewApproval02(batch02ApprovalOptions);
    assertSameCanonical(
      result.adjudicationAdditions,
      storedBatch02Additions,
      'GOLDEN_BATCH_02_MATERIALIZED_DATA_DRIFT',
    );
    return result;
  });

  const audit = await buildAtPath(AUDIT_PATH, () => {
    const report = buildGoldenDatasetAuditReport(batch02Approval.dataset);
    validateGoldenDatasetAuditReport(report);
    return report;
  });

  return Object.freeze([
    expectedEntry(AUDIT_PATH, 'json', audit, (actual) => {
      validateGoldenDatasetAuditReport(actual);
    }),
    expectedEntry(BATCH_01_PATH, 'json', batch01, (actual) => {
      validateGoldenHumanReviewBatch(actual);
    }),
    expectedEntry(PROPOSAL_01_PATH, 'json', proposal01, (actual, parsed) => {
      validateGoldenHumanReviewProposal(actual, parsed.get(BATCH_01_PATH));
    }),
    expectedEntry(PROPOSAL_01_MARKDOWN_PATH, 'markdown', proposal01Markdown),
    expectedEntry(
      APPROVAL_RECEIPT_01_PATH,
      'json',
      batch01Approval.approvalReceipt,
      (actual) => validateGoldenHumanReviewApprovalReceipt(actual, {
        ...batch01ApprovalOptions,
        materializedAdjudications: batch01Approval.adjudications,
      }),
    ),
    expectedEntry(BATCH_02_PATH, 'json', batch02, (actual) => {
      validateGoldenHumanReviewBatch02(actual, batch02Dataset);
    }),
    expectedEntry(PROPOSAL_02_PATH, 'json', proposal02, (actual, parsed) => {
      validateGoldenHumanReviewProposal02(
        actual,
        parsed.get(BATCH_02_PATH),
        batch02Dataset,
      );
    }),
    expectedEntry(PROPOSAL_02_MARKDOWN_PATH, 'markdown', proposal02Markdown),
    expectedEntry(
      APPROVAL_RECEIPT_02_PATH,
      'json',
      batch02Approval.approvalReceipt,
      (actual) => validateGoldenHumanReviewApprovalReceipt02(actual, {
        ...batch02ApprovalOptions,
        materializedAdditions: batch02Approval.adjudicationAdditions,
      }),
    ),
  ]);
}

async function readStoredArtifact(entry, { repoRoot, readArtifact }) {
  const absolutePath = resolve(repoRoot, entry.relativePath);
  let content;
  try {
    content = await readArtifact({
      relativePath: entry.relativePath,
      absolutePath,
      encoding: 'utf8',
    });
  } catch (cause) {
    fail(
      cause?.code === 'ENOENT'
        ? 'GOLDEN_GENERATED_ARTIFACT_MISSING'
        : 'GOLDEN_GENERATED_ARTIFACT_READ_FAILED',
      entry.relativePath,
      cause,
    );
  }
  if (typeof content !== 'string') {
    fail('GOLDEN_GENERATED_ARTIFACT_INVALID', entry.relativePath);
  }
  return content;
}

function parseAndValidateStoredJson(entry, content, parsed) {
  let actual;
  try {
    actual = JSON.parse(content);
    entry.validateActual(actual, parsed);
  } catch (cause) {
    fail('GOLDEN_GENERATED_ARTIFACT_INVALID', entry.relativePath, cause);
  }
  parsed.set(entry.relativePath, actual);
}

export async function checkPursuitGoldenGeneratedArtifacts({
  repoRoot = REPO_ROOT,
  readArtifact = ({ absolutePath, encoding }) => readFile(absolutePath, encoding),
} = {}) {
  const expectedArtifacts = await buildExpectedGoldenGeneratedArtifacts();
  const parsed = new Map();

  for (const entry of expectedArtifacts) {
    const actualContent = await readStoredArtifact(entry, { repoRoot, readArtifact });
    if (entry.format === 'json') {
      parseAndValidateStoredJson(entry, actualContent, parsed);
    }
    if (actualContent !== entry.expectedContent) {
      fail('GOLDEN_GENERATED_ARTIFACT_DRIFT', entry.relativePath);
    }
  }

  return Object.freeze({
    documentStatus: 'PURSUIT_GOLDEN_GENERATED_ARTIFACT_DRIFT_CHECK_PASS',
    productionReady: false,
    checkedArtifactCount: GOLDEN_GENERATED_ARTIFACT_PATHS.length,
    checkedPaths: [...GOLDEN_GENERATED_ARTIFACT_PATHS],
  });
}

function isMainModule() {
  return Boolean(process.argv[1])
    && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isMainModule()) {
  try {
    const result = await checkPursuitGoldenGeneratedArtifacts();
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    const failure = {
      documentStatus: 'PURSUIT_GOLDEN_GENERATED_ARTIFACT_DRIFT_CHECK_FAIL',
      productionReady: false,
      reasonCode: error?.code || 'GOLDEN_GENERATED_ARTIFACT_CHECK_FAILED',
      path: error?.relativePath || '$',
    };
    process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
    process.exitCode = 1;
  }
}
