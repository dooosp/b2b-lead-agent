import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual, TextDecoder } from 'node:util';

export const EXPECTED_PR207_HEAD =
  'c6a5469338999097acd5de7c5a12c827d27d4540';
export const EXPECTED_INTAKE_MANIFEST_SHA256 =
  '0e62b5b258a90395b4f7a95bf2e5288e0781d768aa0990b07c0916a67c16c953';
export const EXPECTED_DOCUMENT_DECISION_FILE_SHA256 =
  '2748e31856100d2f00259f32b1e351d6b7fe4386884e593ba1dc7997c6cab8fb';
export const EXPECTED_DOCUMENT_TUPLE_FINGERPRINT_SHA256 =
  '59c292b30801208853cbd6cb902d1eb4d0064001b72c1317001c849d48ecabb7';

export const INPUT_PATHS = Object.freeze({
  intakeManifest: 'evidence-inbox/manifest.json',
  documentDecisions:
    'tmp/evidence-claim-workbench/human-approval/pr207-document-decisions.json',
  fidelityDecisions:
    'tmp/evidence-claim-workbench/human-approval/pr207-document-fidelity-decisions.json',
  candidateDecisions:
    'tmp/evidence-claim-workbench/human-approval/pr207-candidate-decisions.json',
});

const MAX_INPUT_BYTES = 128 * 1024;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const DOCUMENT_ID_PATTERN = /^doc_[a-f0-9]{64}$/;
const SAFE_INPUT_STATUS = 'SAFE_IGNORED_UNTRACKED_REGULAR_0600_SINGLE_LINK';

const MANIFEST_KEYS = [
  'boundary',
  'documents',
  'productionReady',
  'schemaVersion',
];
const MANIFEST_DOCUMENT_KEYS = [
  'byteLength',
  'documentNumber',
  'documentType',
  'domain',
  'expectedSha256',
  'jurisdiction',
  'language',
  'mediaType',
  'productFamilies',
  'publisher',
  'redistributionStatus',
  'relativePath',
  'revision',
  'sourceUrl',
  'title',
  'vertical',
];
const MANIFEST_REVISION_KEYS = ['revisionId', 'sequence', 'seriesId'];
const DOCUMENT_DECISION_KEYS = [
  'allowedDecisions',
  'boundary',
  'documentCount',
  'documentTupleFingerprintSha256',
  'documents',
  'evaluatedHead',
  'evaluatedPr',
  'humanFieldsAreBlank',
  'intakeAsOf',
  'intakeManifestSha256',
  'nonClaims',
  'schemaVersion',
];
const DOCUMENT_DECISION_ROW_KEYS = [
  'binaryCommitDecision',
  'boundedExcerptUseDecision',
  'currentnessDecision',
  'decisionReasonCode',
  'documentId',
  'documentNumber',
  'fileSha256',
  'language',
  'normalizedContentSha256',
  'normalizedIntakeFileSha256',
  'officialSourceUrl',
  'officialityDecision',
  'productFamily',
  'publisher',
  'revision',
  'technicalScopeDecision',
];
const FIDELITY_DECISION_KEYS = [
  'allowedPageTextFidelityDecisions',
  'boundary',
  'documentCount',
  'documentDecisionFileSha256',
  'documentTupleFingerprintSha256',
  'documents',
  'evaluatedHead',
  'evaluatedPr',
  'humanFieldsAreBlank',
  'intakeManifestSha256',
  'nonClaims',
  'preparedBy',
  'schemaVersion',
];
const FIDELITY_ROW_KEYS = [
  'candidateBearingPagesChecked',
  'decisionReasonCodes',
  'documentId',
  'eligiblePageNumbers',
  'fileSha256',
  'footnoteSemanticsPreserved',
  'ineligiblePageNumbers',
  'minMaxRangeSemanticsPreserved',
  'normalizedContentSha256',
  'pageTextFidelity',
  'pagesChecked',
  'revisionPageChecked',
  'tableStructureFidelity',
  'unitSemanticsPreserved',
  'variantSemanticsPreserved',
];
const CANDIDATE_DECISION_KEYS = [
  'allowedHumanDecisions',
  'blockers',
  'boundary',
  'candidateCount',
  'candidateCountsByFamily',
  'candidateSource',
  'candidates',
  'evaluatedHead',
  'evaluatedPr',
  'humanFieldsAreBlank',
  'intakeAsOf',
  'intakeManifestSha256',
  'nonClaims',
  'schemaVersion',
  'variantTableAbstentionCount',
  'variantTablePropositionCount',
];

const EXPECTED_DOCUMENT_ALLOWED_DECISIONS = {
  officialityDecision: [
    'OWNER_ATTESTED_OFFICIAL_SOURCE',
    'REJECTED_NOT_OFFICIAL',
    'UNCERTAIN',
  ],
  currentnessDecision: ['CURRENT_REVISION', 'SUPERSEDED', 'UNKNOWN'],
  technicalScopeDecision: ['IN_SCOPE', 'OUT_OF_SCOPE', 'UNKNOWN'],
  boundedExcerptUseDecision: [
    'APPROVED_FOR_INTERNAL_REPOSITORY_REVIEW',
    'REJECTED',
    'UNKNOWN',
  ],
  binaryCommitDecision: ['DO_NOT_COMMIT_BINARY'],
};
const EXPECTED_FIDELITY_DECISIONS = [
  'EXACT',
  'ACCEPTABLE_WITH_LIMITATIONS',
  'UNSAFE_FOR_CANDIDATE_REVIEW',
];
const EXPECTED_CANDIDATE_DECISIONS = [
  'APPROVE_FOR_REPOSITORY_REVIEW',
  'REJECT',
  'DEFER_MISSING_CONTEXT',
  'FLAG_CONFLICT',
  'FLAG_SUPERSEDED',
  'FLAG_SOURCE_AUTHENTICITY',
];
const EXPECTED_CANDIDATE_BLOCKERS = [
  'CURRENT_CANDIDATE_ID_SET_IS_EMPTY',
  'TRACK_B_MINIMUM_25_CANDIDATES_CANNOT_BE_SATISFIED_FROM_CURRENT_OUTPUT',
];

export class Pr207HumanEvidenceValidationError extends Error {
  constructor(code) {
    super(code);
    this.name = 'Pr207HumanEvidenceValidationError';
    this.code = code;
  }
}

function fail(code) {
  throw new Pr207HumanEvidenceValidationError(code);
}

function assertCondition(condition, code) {
  if (!condition) fail(code);
}

function isPlainObject(value) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function assertExactKeys(value, expectedKeys, code) {
  assertCondition(isPlainObject(value), code);
  const actualKeys = Object.keys(value).sort();
  const sortedExpectedKeys = [...expectedKeys].sort();
  assertCondition(isDeepStrictEqual(actualKeys, sortedExpectedKeys), code);
}

function assertBoundedString(value, code, maximumLength = 2_048) {
  assertCondition(
    typeof value === 'string' && value.length > 0 && value.length <= maximumLength,
    code,
  );
}

function assertSha256(value, code) {
  assertCondition(typeof value === 'string' && SHA256_PATTERN.test(value), code);
}

function assertNonClaims(value, code) {
  assertCondition(Array.isArray(value) && value.length > 0 && value.length <= 8, code);
  for (const nonClaim of value) assertBoundedString(nonClaim, code, 512);
}

function validateSafeInputDescriptor(input, code) {
  assertCondition(isPlainObject(input), code);
  assertCondition(input.safetyStatus === SAFE_INPUT_STATUS, code);
  assertSha256(input.sha256, code);
  assertCondition(
    Number.isInteger(input.byteLength)
      && input.byteLength > 0
      && input.byteLength <= MAX_INPUT_BYTES,
    code,
  );
  assertCondition(isPlainObject(input.value), code);
}

function validateManifest(input) {
  validateSafeInputDescriptor(input, 'MANIFEST_INPUT_DESCRIPTOR_INVALID');
  assertCondition(
    input.sha256 === EXPECTED_INTAKE_MANIFEST_SHA256,
    'MANIFEST_HASH_DRIFT',
  );
  const manifest = input.value;
  assertExactKeys(manifest, MANIFEST_KEYS, 'MANIFEST_SCHEMA_DRIFT');
  assertCondition(
    manifest.schemaVersion === 'official-evidence-intake-manifest-v0'
      && manifest.boundary === 'NOT_PRODUCTION_EVIDENCE'
      && manifest.productionReady === false
      && Array.isArray(manifest.documents)
      && manifest.documents.length === 8,
    'MANIFEST_CONTRACT_DRIFT',
  );

  const relativePaths = new Set();
  const normalizedInputHashes = new Set();
  for (const document of manifest.documents) {
    assertExactKeys(document, MANIFEST_DOCUMENT_KEYS, 'MANIFEST_DOCUMENT_SCHEMA_DRIFT');
    assertBoundedString(document.relativePath, 'MANIFEST_DOCUMENT_VALUE_INVALID', 128);
    assertCondition(
      path.posix.basename(document.relativePath) === document.relativePath
        && document.relativePath.endsWith('.json'),
      'MANIFEST_DOCUMENT_PATH_INVALID',
    );
    assertCondition(
      Number.isInteger(document.byteLength)
        && document.byteLength > 0
        && document.byteLength <= 1024 * 1024,
      'MANIFEST_DOCUMENT_VALUE_INVALID',
    );
    for (const key of [
      'mediaType',
      'sourceUrl',
      'publisher',
      'title',
      'documentNumber',
      'documentType',
      'language',
      'vertical',
      'jurisdiction',
      'domain',
      'redistributionStatus',
    ]) {
      assertBoundedString(document[key], 'MANIFEST_DOCUMENT_VALUE_INVALID');
    }
    assertCondition(document.mediaType === 'application/json', 'MANIFEST_DOCUMENT_VALUE_INVALID');
    assertSha256(document.expectedSha256, 'MANIFEST_DOCUMENT_HASH_INVALID');
    assertExactKeys(document.revision, MANIFEST_REVISION_KEYS, 'MANIFEST_REVISION_SCHEMA_DRIFT');
    assertBoundedString(document.revision.seriesId, 'MANIFEST_REVISION_VALUE_INVALID');
    assertBoundedString(document.revision.revisionId, 'MANIFEST_REVISION_VALUE_INVALID');
    assertCondition(
      Number.isInteger(document.revision.sequence) && document.revision.sequence >= 1,
      'MANIFEST_REVISION_VALUE_INVALID',
    );
    assertCondition(
      Array.isArray(document.productFamilies) && document.productFamilies.length === 1,
      'MANIFEST_PRODUCT_FAMILY_INVALID',
    );
    assertBoundedString(document.productFamilies[0], 'MANIFEST_PRODUCT_FAMILY_INVALID');
    assertCondition(!relativePaths.has(document.relativePath), 'MANIFEST_PATH_DUPLICATE');
    assertCondition(
      !normalizedInputHashes.has(document.expectedSha256),
      'MANIFEST_HASH_DUPLICATE',
    );
    relativePaths.add(document.relativePath);
    normalizedInputHashes.add(document.expectedSha256);
  }
  return manifest;
}

export function listPr207NormalizedInputPaths(intakeManifest) {
  return validateManifest(intakeManifest).documents.map(
    (document) => path.posix.join('evidence-inbox', document.relativePath),
  );
}

function validateDocumentDecisions(input, manifest) {
  validateSafeInputDescriptor(input, 'DOCUMENT_DECISION_INPUT_DESCRIPTOR_INVALID');
  assertCondition(
    input.sha256 === EXPECTED_DOCUMENT_DECISION_FILE_SHA256,
    'DOCUMENT_DECISION_HASH_DRIFT',
  );
  const decision = input.value;
  assertExactKeys(decision, DOCUMENT_DECISION_KEYS, 'DOCUMENT_DECISION_SCHEMA_DRIFT');
  assertCondition(
    decision.schemaVersion === 'pr207-document-decisions-v1'
      && decision.boundary === 'LOCAL_IGNORED_HUMAN_INPUT_TEMPLATE'
      && decision.evaluatedPr === 207
      && decision.evaluatedHead === EXPECTED_PR207_HEAD
      && decision.intakeAsOf === '2026-07-18T13:01:00.000Z'
      && decision.intakeManifestSha256 === EXPECTED_INTAKE_MANIFEST_SHA256
      && decision.documentTupleFingerprintSha256
        === EXPECTED_DOCUMENT_TUPLE_FINGERPRINT_SHA256
      && decision.documentCount === 8
      && decision.humanFieldsAreBlank === false
      && isDeepStrictEqual(
        decision.allowedDecisions,
        EXPECTED_DOCUMENT_ALLOWED_DECISIONS,
      )
      && Array.isArray(decision.documents)
      && decision.documents.length === 8,
    'DOCUMENT_DECISION_CONTRACT_DRIFT',
  );
  assertNonClaims(decision.nonClaims, 'DOCUMENT_DECISION_NONCLAIMS_INVALID');

  const manifestByNormalizedInputHash = new Map(
    manifest.documents.map((document) => [document.expectedSha256, document]),
  );
  const documentsById = new Map();
  for (const document of decision.documents) {
    assertExactKeys(
      document,
      DOCUMENT_DECISION_ROW_KEYS,
      'DOCUMENT_DECISION_ROW_SCHEMA_DRIFT',
    );
    assertCondition(
      typeof document.documentId === 'string'
        && DOCUMENT_ID_PATTERN.test(document.documentId),
      'DOCUMENT_DECISION_ROW_ID_INVALID',
    );
    for (const key of [
      'normalizedIntakeFileSha256',
      'fileSha256',
      'normalizedContentSha256',
    ]) {
      assertSha256(document[key], 'DOCUMENT_DECISION_ROW_HASH_INVALID');
    }
    for (const key of [
      'publisher',
      'officialSourceUrl',
      'documentNumber',
      'revision',
      'language',
      'productFamily',
    ]) {
      assertBoundedString(document[key], 'DOCUMENT_DECISION_ROW_VALUE_INVALID');
    }
    assertCondition(
      document.officialityDecision === 'OWNER_ATTESTED_OFFICIAL_SOURCE'
        && document.currentnessDecision === 'CURRENT_REVISION'
        && document.technicalScopeDecision === 'IN_SCOPE'
        && document.boundedExcerptUseDecision
          === 'APPROVED_FOR_INTERNAL_REPOSITORY_REVIEW'
        && document.binaryCommitDecision === 'DO_NOT_COMMIT_BINARY'
        && document.decisionReasonCode === 'AUTHORIZED_OWNER_REVIEW_CONFIRMED',
      'DOCUMENT_DECISION_ROW_DECISION_DRIFT',
    );
    assertCondition(!documentsById.has(document.documentId), 'DOCUMENT_DECISION_ROW_DUPLICATE');

    const manifestDocument = manifestByNormalizedInputHash.get(
      document.normalizedIntakeFileSha256,
    );
    assertCondition(Boolean(manifestDocument), 'DOCUMENT_DECISION_MANIFEST_BINDING_DRIFT');
    assertCondition(
      manifestDocument.sourceUrl === document.officialSourceUrl
        && manifestDocument.publisher === document.publisher
        && manifestDocument.documentNumber === document.documentNumber
        && manifestDocument.revision.revisionId === document.revision
        && manifestDocument.language === document.language
        && isDeepStrictEqual(manifestDocument.productFamilies, [document.productFamily]),
      'DOCUMENT_DECISION_MANIFEST_BINDING_DRIFT',
    );
    documentsById.set(document.documentId, document);
  }
  assertCondition(
    documentsById.size === 8
      && manifestByNormalizedInputHash.size === 8
      && [...documentsById.values()].every((document) =>
        manifestByNormalizedInputHash.has(document.normalizedIntakeFileSha256)),
    'DOCUMENT_DECISION_MANIFEST_COVERAGE_DRIFT',
  );
  return { decision, documentsById };
}

function validateNormalizedDocuments(inputs, manifest, documentsById) {
  assertCondition(
    Array.isArray(inputs) && inputs.length === manifest.documents.length,
    'NORMALIZED_INPUT_COUNT_DRIFT',
  );
  const decisionByNormalizedInputHash = new Map(
    [...documentsById.values()].map((document) => [
      document.normalizedIntakeFileSha256,
      document,
    ]),
  );
  const manifestByRelativePath = new Map(
    manifest.documents.map((document) => [
      path.posix.join('evidence-inbox', document.relativePath),
      document,
    ]),
  );
  const seenPaths = new Set();
  let totalByteLength = 0;
  let totalPageCount = 0;

  for (const entry of inputs) {
    assertExactKeys(entry, ['input', 'relativePath'], 'NORMALIZED_INPUT_ENTRY_INVALID');
    assertBoundedString(entry.relativePath, 'NORMALIZED_INPUT_PATH_INVALID', 160);
    assertCondition(!seenPaths.has(entry.relativePath), 'NORMALIZED_INPUT_PATH_DUPLICATE');
    const manifestDocument = manifestByRelativePath.get(entry.relativePath);
    assertCondition(Boolean(manifestDocument), 'NORMALIZED_INPUT_PATH_DRIFT');
    validateSafeInputDescriptor(entry.input, 'NORMALIZED_INPUT_DESCRIPTOR_INVALID');
    assertCondition(
      entry.input.sha256 === manifestDocument.expectedSha256,
      'NORMALIZED_INPUT_HASH_DRIFT',
    );
    assertCondition(
      entry.input.byteLength === manifestDocument.byteLength,
      'NORMALIZED_INPUT_BYTE_LENGTH_DRIFT',
    );

    const bundle = entry.input.value;
    assertCondition(
      bundle.schemaVersion === 'source-document-bundle-v0'
        && bundle.boundary === 'NOT_PRODUCTION_EVIDENCE'
        && bundle.productionReady === false
        && bundle.synthetic === false
        && typeof bundle.documentId === 'string'
        && DOCUMENT_ID_PATTERN.test(bundle.documentId)
        && isPlainObject(bundle.file)
        && isPlainObject(bundle.source)
        && isPlainObject(bundle.revision)
        && Array.isArray(bundle.pages)
        && bundle.pages.length > 0,
      'NORMALIZED_INPUT_CONTRACT_DRIFT',
    );
    assertSha256(bundle.file.sha256, 'NORMALIZED_INPUT_SOURCE_HASH_INVALID');
    assertSha256(bundle.file.contentSha256, 'NORMALIZED_INPUT_CONTENT_HASH_INVALID');
    const decision = decisionByNormalizedInputHash.get(entry.input.sha256);
    assertCondition(Boolean(decision), 'NORMALIZED_INPUT_DECISION_BINDING_DRIFT');
    assertCondition(
      bundle.documentId === decision.documentId
        && bundle.file.sha256 === decision.fileSha256
        && bundle.file.contentSha256 === decision.normalizedContentSha256
        && bundle.source.sourceUrl === manifestDocument.sourceUrl
        && bundle.source.publisher === manifestDocument.publisher
        && bundle.source.documentNumber === manifestDocument.documentNumber
        && bundle.source.language === manifestDocument.language
        && isDeepStrictEqual(bundle.source.productFamilies, manifestDocument.productFamilies)
        && bundle.source.redistributionStatus === manifestDocument.redistributionStatus
        && bundle.revision.revisionId === manifestDocument.revision.revisionId,
      'NORMALIZED_INPUT_DECISION_BINDING_DRIFT',
    );
    seenPaths.add(entry.relativePath);
    totalByteLength += entry.input.byteLength;
    totalPageCount += bundle.pages.length;
  }

  assertCondition(
    seenPaths.size === manifestByRelativePath.size
      && [...manifestByRelativePath.keys()].every((relativePath) => seenPaths.has(relativePath)),
    'NORMALIZED_INPUT_COVERAGE_DRIFT',
  );
  return { totalByteLength, totalPageCount };
}

function fidelityRowIsBlank(document) {
  return isDeepStrictEqual(document.pagesChecked, [])
    && isDeepStrictEqual(document.candidateBearingPagesChecked, [])
    && document.revisionPageChecked === null
    && document.pageTextFidelity === null
    && document.tableStructureFidelity === null
    && document.variantSemanticsPreserved === null
    && document.unitSemanticsPreserved === null
    && document.minMaxRangeSemanticsPreserved === null
    && document.footnoteSemanticsPreserved === null
    && isDeepStrictEqual(document.eligiblePageNumbers, [])
    && isDeepStrictEqual(document.ineligiblePageNumbers, [])
    && isDeepStrictEqual(document.decisionReasonCodes, []);
}

function validateFidelityDecisions(input, documentsById) {
  validateSafeInputDescriptor(input, 'FIDELITY_INPUT_DESCRIPTOR_INVALID');
  const fidelity = input.value;
  assertExactKeys(fidelity, FIDELITY_DECISION_KEYS, 'FIDELITY_SCHEMA_DRIFT');
  assertCondition(
    fidelity.schemaVersion === 'pr207-document-fidelity-decisions-v1'
      && fidelity.boundary === 'NOT_PRODUCTION_EVIDENCE'
      && fidelity.preparedBy === 'CODEX_MACHINE_TEMPLATE_NO_HUMAN_DECISIONS'
      && fidelity.evaluatedPr === 207
      && fidelity.evaluatedHead === EXPECTED_PR207_HEAD
      && fidelity.documentDecisionFileSha256
        === EXPECTED_DOCUMENT_DECISION_FILE_SHA256
      && fidelity.intakeManifestSha256 === EXPECTED_INTAKE_MANIFEST_SHA256
      && fidelity.documentTupleFingerprintSha256
        === EXPECTED_DOCUMENT_TUPLE_FINGERPRINT_SHA256
      && fidelity.documentCount === 8
      && fidelity.humanFieldsAreBlank === true
      && isDeepStrictEqual(
        fidelity.allowedPageTextFidelityDecisions,
        EXPECTED_FIDELITY_DECISIONS,
      )
      && Array.isArray(fidelity.documents)
      && fidelity.documents.length === 8,
    'FIDELITY_CONTRACT_DRIFT',
  );
  assertNonClaims(fidelity.nonClaims, 'FIDELITY_NONCLAIMS_INVALID');

  const seenIds = new Set();
  let blankRowCount = 0;
  for (const document of fidelity.documents) {
    assertExactKeys(document, FIDELITY_ROW_KEYS, 'FIDELITY_ROW_SCHEMA_DRIFT');
    assertCondition(
      typeof document.documentId === 'string'
        && DOCUMENT_ID_PATTERN.test(document.documentId),
      'FIDELITY_ROW_ID_INVALID',
    );
    assertSha256(document.fileSha256, 'FIDELITY_ROW_HASH_INVALID');
    assertSha256(document.normalizedContentSha256, 'FIDELITY_ROW_HASH_INVALID');
    assertCondition(!seenIds.has(document.documentId), 'FIDELITY_ROW_DUPLICATE');
    const sourceDecision = documentsById.get(document.documentId);
    assertCondition(Boolean(sourceDecision), 'FIDELITY_DOCUMENT_BINDING_DRIFT');
    assertCondition(
      sourceDecision.fileSha256 === document.fileSha256
        && sourceDecision.normalizedContentSha256 === document.normalizedContentSha256,
      'FIDELITY_DOCUMENT_BINDING_DRIFT',
    );
    seenIds.add(document.documentId);
    if (fidelityRowIsBlank(document)) blankRowCount += 1;
  }
  assertCondition(seenIds.size === documentsById.size, 'FIDELITY_DOCUMENT_COVERAGE_DRIFT');
  assertCondition(
    blankRowCount === fidelity.documents.length,
    'FIDELITY_COMPLETION_CONTRACT_UNSUPPORTED',
  );
  return { fidelity, blankRowCount };
}

function validateCandidateDecisions(input) {
  validateSafeInputDescriptor(input, 'CANDIDATE_INPUT_DESCRIPTOR_INVALID');
  const candidate = input.value;
  assertExactKeys(candidate, CANDIDATE_DECISION_KEYS, 'CANDIDATE_SCHEMA_DRIFT');
  assertCondition(
    candidate.schemaVersion === 'pr207-candidate-decisions-v1'
      && candidate.boundary === 'LOCAL_IGNORED_HUMAN_INPUT_TEMPLATE'
      && candidate.evaluatedPr === 207
      && candidate.evaluatedHead === EXPECTED_PR207_HEAD
      && candidate.intakeAsOf === '2026-07-18T13:01:00.000Z'
      && candidate.intakeManifestSha256 === EXPECTED_INTAKE_MANIFEST_SHA256
      && candidate.candidateSource === 'CURRENT_REAL_WORKBENCH_PLUS_VARIANT_TABLE_SPIKE'
      && candidate.variantTablePropositionCount === 0
      && candidate.variantTableAbstentionCount === 2
      && candidate.humanFieldsAreBlank === true
      && isDeepStrictEqual(candidate.allowedHumanDecisions, EXPECTED_CANDIDATE_DECISIONS)
      && isDeepStrictEqual(candidate.blockers, EXPECTED_CANDIDATE_BLOCKERS),
    'CANDIDATE_CONTRACT_DRIFT',
  );
  assertExactKeys(
    candidate.candidateCountsByFamily,
    ['medium_voltage_switchgear', 'transformer'],
    'CANDIDATE_FAMILY_COUNTS_SCHEMA_DRIFT',
  );
  assertNonClaims(candidate.nonClaims, 'CANDIDATE_NONCLAIMS_INVALID');
  assertCondition(
    candidate.candidateCount === 0
      && candidate.candidateCountsByFamily.medium_voltage_switchgear === 0
      && candidate.candidateCountsByFamily.transformer === 0
      && Array.isArray(candidate.candidates)
      && candidate.candidates.length === 0,
    'CANDIDATE_POPULATION_CONTRACT_UNSUPPORTED',
  );
  return candidate;
}

export function validatePr207HumanEvidenceInputs({
  intakeManifest,
  normalizedDocuments,
  documentDecisions,
  fidelityDecisions,
  candidateDecisions,
}) {
  const manifest = validateManifest(intakeManifest);
  const { decision, documentsById } = validateDocumentDecisions(
    documentDecisions,
    manifest,
  );
  const normalized = validateNormalizedDocuments(
    normalizedDocuments,
    manifest,
    documentsById,
  );
  const { fidelity, blankRowCount } = validateFidelityDecisions(
    fidelityDecisions,
    documentsById,
  );
  const candidate = validateCandidateDecisions(candidateDecisions);

  return {
    schemaVersion: 'pr207-human-evidence-input-validation-v1',
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    validationStatus: 'STRUCTURALLY_VALID',
    evidenceStatus: 'INCOMPLETE',
    operatorOutcome: 'AWAITING_HUMAN_INPUT',
    evaluatedPr: 207,
    evaluatedHead: EXPECTED_PR207_HEAD,
    hashes: {
      intakeManifestSha256: intakeManifest.sha256,
      documentDecisionFileSha256: documentDecisions.sha256,
      fidelityDecisionFileSha256: fidelityDecisions.sha256,
      candidateDecisionFileSha256: candidateDecisions.sha256,
      documentTupleFingerprintSha256: decision.documentTupleFingerprintSha256,
    },
    counts: {
      safeIgnoredInputFileCount: 4 + normalizedDocuments.length,
      intakeManifestDocumentCount: manifest.documents.length,
      normalizedDocumentInputCount: normalizedDocuments.length,
      normalizedDocumentPageCount: normalized.totalPageCount,
      documentDecisionRowCount: decision.documents.length,
      fidelityDecisionRowCount: fidelity.documents.length,
      blankFidelityDecisionRowCount: blankRowCount,
      completedFidelityDecisionRowCount: fidelity.documents.length - blankRowCount,
      candidateDecisionRowCount: candidate.candidates.length,
      approvedCandidateDecisionRowCount: 0,
      intakeManifestByteCount: intakeManifest.byteLength,
      documentDecisionFileByteCount: documentDecisions.byteLength,
      fidelityDecisionFileByteCount: fidelityDecisions.byteLength,
      candidateDecisionFileByteCount: candidateDecisions.byteLength,
      normalizedDocumentInputByteCount: normalized.totalByteLength,
    },
    statuses: {
      localInputSafety: 'PASS',
      structuralAndLineageValidation: 'PASS',
      humanFidelityEvidence: 'INCOMPLETE_0_OF_8',
      fidelityCompletionContract:
        'UNSUPPORTED_PENDING_EXPLICIT_PAGE_NAMESPACE_AND_HUMAN_CONTRACT',
      rightsAndRetentionAuthority:
        'NOT_VALIDATED_REQUIRES_CANONICAL_GITHUB_DECISION',
      candidatePopulation: 'EMPTY',
      candidateCompletionContract: 'NOT_APPROVED_NONEMPTY_V1_REFUSED',
      candidateReviewEvidence: 'INCOMPLETE_0_OF_25',
      candidateFamilyThresholds:
        'INCOMPLETE_SWITCHGEAR_0_OF_10_TRANSFORMER_0_OF_10',
      mergeApproval: 'NOT_GRANTED',
      productionApproval: 'NOT_GRANTED',
    },
    nonClaims: [
      'Structural validation does not create or infer a human fidelity decision.',
      'An empty candidate set does not satisfy the PR207 real-evidence pilot threshold.',
      'This report does not establish source rights, retention approval, claim correctness, merge approval, or production approval.',
    ],
  };
}

function gitPathIsIgnored(root, relativePath) {
  try {
    execFileSync('git', ['-C', root, 'check-ignore', '--quiet', '--', relativePath], {
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

function gitPathIsTracked(root, relativePath) {
  try {
    execFileSync('git', ['-C', root, 'ls-files', '--error-unmatch', '--', relativePath], {
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

async function assertParentChainIsSafe(root, relativePath) {
  const segments = relativePath.split('/');
  let current = root;
  for (const segment of segments.slice(0, -1)) {
    current = path.join(current, segment);
    const stat = await lstat(current).catch(() => fail('INPUT_PARENT_UNSAFE'));
    assertCondition(stat.isDirectory() && !stat.isSymbolicLink(), 'INPUT_PARENT_UNSAFE');
  }
}

export async function readSafeIgnoredJsonInput({
  pr207Root,
  relativePath,
}) {
  assertCondition(Number.isInteger(constants.O_NOFOLLOW), 'RUNTIME_NOFOLLOW_UNAVAILABLE');
  assertCondition(
    typeof relativePath === 'string'
      && relativePath.length > 0
      && path.posix.normalize(relativePath) === relativePath
      && !relativePath.startsWith('/')
      && !relativePath.startsWith('../'),
    'INPUT_PATH_INVALID',
  );
  const root = path.resolve(pr207Root);
  const canonicalRoot = await realpath(root).catch(() => fail('PR207_ROOT_INVALID'));
  assertCondition(canonicalRoot === root, 'PR207_ROOT_SYMLINK_REFUSED');
  const rootStat = await lstat(root).catch(() => fail('PR207_ROOT_INVALID'));
  assertCondition(rootStat.isDirectory() && !rootStat.isSymbolicLink(), 'PR207_ROOT_INVALID');
  await assertParentChainIsSafe(root, relativePath);
  assertCondition(gitPathIsIgnored(root, relativePath), 'INPUT_NOT_IGNORED');
  assertCondition(!gitPathIsTracked(root, relativePath), 'INPUT_TRACKED_REFUSED');

  const inputPath = path.join(root, ...relativePath.split('/'));
  let handle;
  try {
    handle = await open(inputPath, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch {
    fail('INPUT_UNSAFE_OR_MISSING');
  }
  try {
    const before = await handle.stat();
    assertCondition(before.isFile(), 'INPUT_NON_REGULAR_REFUSED');
    assertCondition(before.nlink === 1, 'INPUT_MULTI_LINK_REFUSED');
    assertCondition((before.mode & 0o777) === 0o600, 'INPUT_MODE_MUST_BE_0600');
    assertCondition(
      before.size > 0 && before.size <= MAX_INPUT_BYTES,
      'INPUT_BYTE_BOUND_EXCEEDED',
    );
    const raw = await handle.readFile();
    const after = await handle.stat();
    assertCondition(
      before.dev === after.dev
        && before.ino === after.ino
        && before.size === after.size
        && before.mtimeMs === after.mtimeMs
        && raw.length === after.size,
      'INPUT_CHANGED_DURING_READ',
    );
    const pathStat = await lstat(inputPath).catch(() => fail('INPUT_CHANGED_DURING_READ'));
    assertCondition(
      pathStat.isFile()
        && !pathStat.isSymbolicLink()
        && pathStat.dev === after.dev
        && pathStat.ino === after.ino
        && pathStat.nlink === 1
        && (pathStat.mode & 0o777) === 0o600,
      'INPUT_CHANGED_DURING_READ',
    );
    assertCondition(gitPathIsIgnored(root, relativePath), 'INPUT_NOT_IGNORED');
    assertCondition(!gitPathIsTracked(root, relativePath), 'INPUT_TRACKED_REFUSED');
    let value;
    try {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(raw);
      value = JSON.parse(text);
    } catch {
      fail('INPUT_JSON_INVALID');
    }
    return {
      safetyStatus: SAFE_INPUT_STATUS,
      sha256: createHash('sha256').update(raw).digest('hex'),
      byteLength: raw.length,
      value,
    };
  } finally {
    await handle.close();
  }
}
