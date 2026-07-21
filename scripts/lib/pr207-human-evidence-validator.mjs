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

export const PR207_RIGHTS_RETENTION_POLICY_EXPECTATION = Object.freeze({
  commentId: 5031954760,
  apiUrl:
    'https://api.github.com/repos/dooosp/b2b-lead-agent/issues/comments/5031954760',
  commentUrl:
    'https://github.com/dooosp/b2b-lead-agent/pull/207#issuecomment-5031954760',
  issueUrl: 'https://api.github.com/repos/dooosp/b2b-lead-agent/issues/207',
  authorLogin: 'dooosp',
  authorType: 'User',
  authorAssociation: 'OWNER',
  createdAt: '2026-07-21T08:48:13Z',
  updatedAt: '2026-07-21T08:48:13Z',
  marker: 'PR207_PAGE_REVIEW_RIGHTS_RETENTION_POLICY_V1',
  rawBodySha256:
    '13a7d5809bf10df1383219dac9f9ebe59e92c83e01e054ccbada539aa1b6b760',
  lfBodySha256:
    '22e9a051d2a9a81620a5fb1465be1b4e07dc7eb3cd0f1f33344c55300346b885',
  evaluatedPr: 207,
  evaluatedHead: EXPECTED_PR207_HEAD,
  documentDecisionFileSha256: EXPECTED_DOCUMENT_DECISION_FILE_SHA256,
  expirationOrReviewDate: '2026-08-21T23:59:59Z',
});

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
const GIT_SHA_PATTERN = /^[a-f0-9]{40}$/;
const DOCUMENT_ID_PATTERN = /^doc_[a-f0-9]{64}$/;
const SAFE_INPUT_STATUS = 'SAFE_IGNORED_UNTRACKED_REGULAR_0600_SINGLE_LINK';
const MAX_POLICY_COMMENT_BODY_BYTES = 16 * 1024;

const RIGHTS_RETENTION_POLICY_KEYS = [
  'BOUNDED_EXCERPT_INTERNAL_REVIEW_ALLOWED',
  'DOCUMENT_DECISION_FILE_SHA256',
  'EVALUATED_HEAD',
  'EVALUATED_PR',
  'EXPIRATION_OR_REVIEW_DATE',
  'FULL_PAGE_EXPORT_ALLOWED',
  'FULL_PAGE_GIT_COMMIT_ALLOWED',
  'FULL_PAGE_REVIEW_MODE',
  'FULL_PAGE_TRANSMISSION_ALLOWED',
  'FULL_SOURCE_BINARY_RETAINED',
  'MERGE_APPROVED_BY_THIS_COMMENT',
  'OWNER_AUTHORITY',
  'POLICY_DECISION',
  'PRODUCTION_APPROVED',
  'PUBLIC_REPOSITORY_EXCERPT_ALLOWED_DURING_PILOT',
  'REAL_DOCUMENT_ALLOWED_CLAIMS_CREATED',
  'REAL_DOCUMENT_VERIFIED_CLAIMS_CREATED',
  'REVIEWER_IDENTITY_RETAINED',
  'REVIEW_RECORD_RETENTION_LOCATION',
  'REVIEW_RECORD_RETENTION_MODE',
  'RIGHTS_RETENTION_OWNER_GITHUB_LOGIN',
  'STOP_CONDITIONS',
];

const EXPECTED_RIGHTS_RETENTION_POLICY_FIELDS = Object.freeze({
  POLICY_DECISION: 'APPROVE',
  FULL_PAGE_REVIEW_MODE: 'LOCAL_OPERATOR_DISPLAY_ONLY',
  FULL_PAGE_TRANSMISSION_ALLOWED: 'NO',
  FULL_PAGE_GIT_COMMIT_ALLOWED: 'NO',
  FULL_PAGE_EXPORT_ALLOWED: 'NO',
  BOUNDED_EXCERPT_INTERNAL_REVIEW_ALLOWED: 'YES',
  PUBLIC_REPOSITORY_EXCERPT_ALLOWED_DURING_PILOT: 'NO',
  REVIEW_RECORD_RETENTION_MODE:
    'BOUNDED_REVIEW_METADATA_AND_EXCERPTS_ONLY',
  REVIEW_RECORD_RETENTION_LOCATION:
    'LOCAL_IGNORED_HUMAN_APPROVAL_PATH_AND_CONTROL_BRANCH_ANONYMIZED_HASH_AGGREGATES_ONLY',
  REVIEWER_IDENTITY_RETAINED: 'NOT_COLLECTED',
  FULL_SOURCE_BINARY_RETAINED:
    'LOCAL_IGNORED_OPERATOR_CONTROLLED_ONLY; NEVER_GIT_COMMITTED_OR_TRANSMITTED',
  REAL_DOCUMENT_VERIFIED_CLAIMS_CREATED: '0',
  REAL_DOCUMENT_ALLOWED_CLAIMS_CREATED: '0',
  PRODUCTION_APPROVED: 'NO',
  MERGE_APPROVED_BY_THIS_COMMENT: 'NO',
});

const RIGHTS_RETENTION_STOP_CONDITION_PATTERNS = Object.freeze({
  EVALUATED_HEAD_DRIFT: /evaluated-head drift/i,
  DOCUMENT_DECISION_OR_SOURCE_HASH_DRIFT:
    /document-decision or source hash drift/i,
  UNAUTHORIZED_FULL_PAGE_TRANSMISSION_EXPORT_OR_GIT_COMMIT:
    /unauthorized full-page transmission, export, or git commit/i,
  FULL_PAGE_OR_SOURCE_BINARY_LEAKAGE: /full-page or source-binary\s+leakage/i,
  PRIVATE_OR_SECRET_LEAKAGE: /private or secret leakage/i,
  EXPIRY_OR_REVIEW_DATE_ARRIVAL: /expiry\/review-date arrival/i,
  INCOMPLETE_VAGUE_OR_CONTRADICTORY_HUMAN_DECISION:
    /incomplete,\s+vague, or contradictory human decision/i,
});

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
  'allowedDecisionReasonCodes',
  'allowedPageTextFidelityDecisions',
  'allowedSemanticPreservationDecisions',
  'allowedTableStructureFidelityDecisions',
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
  'pageNumberNamespace',
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
const REVISION_PAGE_CHECKED_KEYS = [
  'documentIdentityStatus',
  'documentNumberStatus',
  'locatorType',
  'locatorValue',
  'revisionStatus',
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
const EXPECTED_TABLE_STRUCTURE_FIDELITY_DECISIONS = [
  ...EXPECTED_FIDELITY_DECISIONS,
  'NOT_APPLICABLE',
];
const EXPECTED_SEMANTIC_PRESERVATION_DECISIONS = [
  'PRESERVED',
  'NOT_PRESERVED',
  'NOT_APPLICABLE',
];
const EXPECTED_FIDELITY_DECISION_REASON_CODES = [
  'EXACT_FIDELITY_CONFIRMED',
  'ACCEPTABLE_LIMITATION_IDENTIFIED',
  'UNSAFE_FIDELITY_IDENTIFIED',
  'SOURCE_PAGE_UNAVAILABLE',
  'NO_CANDIDATE_CONTENT',
];
const EXPECTED_REVISION_PAGE_LOCATOR_TYPES = [
  'DOCUMENT_PAGE',
  'SECTION',
  'UNAVAILABLE',
];
const EXPECTED_REVISION_PAGE_STATUSES = [
  'MATCH',
  'MISMATCH',
  'UNCONFIRMED',
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

function parseIsoTimestamp(value, code) {
  assertCondition(
    typeof value === 'string'
      && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value),
    code,
  );
  const epochMilliseconds = Date.parse(value);
  assertCondition(Number.isFinite(epochMilliseconds), code);
  return epochMilliseconds;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function parseRightsRetentionPolicyBody(body) {
  assertCondition(
    typeof body === 'string'
      && Buffer.byteLength(body) > 0
      && Buffer.byteLength(body) <= MAX_POLICY_COMMENT_BODY_BYTES
      && !body.includes('\0'),
    'RIGHTS_POLICY_COMMENT_BODY_INVALID',
  );
  const lfBody = body.replace(/\r\n?/g, '\n');
  const lines = lfBody.split('\n');
  const marker = lines.shift();
  assertBoundedString(marker, 'RIGHTS_POLICY_MARKER_INVALID', 128);

  const fieldParts = new Map();
  let activeKey = null;
  for (const line of lines) {
    if (line.length === 0) {
      activeKey = null;
      continue;
    }
    const fieldMatch = /^([A-Z][A-Z0-9_]*):(.*)$/.exec(line);
    if (fieldMatch) {
      const [, key, rawValue] = fieldMatch;
      assertCondition(!fieldParts.has(key), 'RIGHTS_POLICY_BODY_SCHEMA_DRIFT');
      const value = rawValue.startsWith(' ') ? rawValue.slice(1) : rawValue;
      assertCondition(rawValue.length === 0 || rawValue.startsWith(' '), 'RIGHTS_POLICY_BODY_INVALID');
      fieldParts.set(key, value.length > 0 ? [value] : []);
      activeKey = key;
      continue;
    }
    assertCondition(
      activeKey !== null && line.startsWith('  ') && line.trim().length > 0,
      'RIGHTS_POLICY_BODY_INVALID',
    );
    fieldParts.get(activeKey).push(line.trim());
  }

  assertCondition(
    isDeepStrictEqual([...fieldParts.keys()].sort(), [...RIGHTS_RETENTION_POLICY_KEYS].sort()),
    'RIGHTS_POLICY_BODY_SCHEMA_DRIFT',
  );
  const fields = Object.fromEntries(
    [...fieldParts].map(([key, parts]) => {
      assertCondition(parts.length > 0, 'RIGHTS_POLICY_BODY_INVALID');
      const value = parts.join(' ');
      assertBoundedString(value, 'RIGHTS_POLICY_BODY_INVALID', 2_048);
      return [key, value];
    }),
  );
  return { fields, lfBody, marker };
}

function validatePolicyExpectation(expectation) {
  assertCondition(isPlainObject(expectation), 'RIGHTS_POLICY_EXPECTATION_INVALID');
  for (const key of [
    'apiUrl',
    'commentUrl',
    'issueUrl',
    'authorLogin',
    'authorType',
    'authorAssociation',
    'createdAt',
    'updatedAt',
    'marker',
    'evaluatedHead',
    'documentDecisionFileSha256',
    'expirationOrReviewDate',
  ]) {
    assertBoundedString(expectation[key], 'RIGHTS_POLICY_EXPECTATION_INVALID');
  }
  assertCondition(
    Number.isSafeInteger(expectation.commentId) && expectation.commentId > 0,
    'RIGHTS_POLICY_EXPECTATION_INVALID',
  );
  assertCondition(
    expectation.evaluatedPr === 207 && isPlainObject(expectation.policyFields),
    'RIGHTS_POLICY_EXPECTATION_INVALID',
  );
  assertSha256(expectation.rawBodySha256, 'RIGHTS_POLICY_EXPECTATION_INVALID');
  assertSha256(expectation.lfBodySha256, 'RIGHTS_POLICY_EXPECTATION_INVALID');
  assertCondition(
    GIT_SHA_PATTERN.test(expectation.evaluatedHead),
    'RIGHTS_POLICY_EXPECTATION_INVALID',
  );
  assertSha256(
    expectation.documentDecisionFileSha256,
    'RIGHTS_POLICY_EXPECTATION_INVALID',
  );
  assertCondition(
    isDeepStrictEqual(
      Object.keys(expectation.policyFields).sort(),
      Object.keys(EXPECTED_RIGHTS_RETENTION_POLICY_FIELDS).sort(),
    ),
    'RIGHTS_POLICY_EXPECTATION_INVALID',
  );
  parseIsoTimestamp(expectation.createdAt, 'RIGHTS_POLICY_EXPECTATION_INVALID');
  parseIsoTimestamp(expectation.updatedAt, 'RIGHTS_POLICY_EXPECTATION_INVALID');
  parseIsoTimestamp(
    expectation.expirationOrReviewDate,
    'RIGHTS_POLICY_EXPECTATION_INVALID',
  );
}

function assertPolicyIsNotContradictory(fields) {
  assertCondition(
    fields.POLICY_DECISION === 'APPROVE'
      && fields.FULL_PAGE_REVIEW_MODE === 'LOCAL_OPERATOR_DISPLAY_ONLY'
      && fields.FULL_PAGE_TRANSMISSION_ALLOWED === 'NO'
      && fields.FULL_PAGE_GIT_COMMIT_ALLOWED === 'NO'
      && fields.FULL_PAGE_EXPORT_ALLOWED === 'NO'
      && fields.BOUNDED_EXCERPT_INTERNAL_REVIEW_ALLOWED === 'YES'
      && fields.PUBLIC_REPOSITORY_EXCERPT_ALLOWED_DURING_PILOT === 'NO'
      && fields.REAL_DOCUMENT_VERIFIED_CLAIMS_CREATED === '0'
      && fields.REAL_DOCUMENT_ALLOWED_CLAIMS_CREATED === '0'
      && fields.PRODUCTION_APPROVED === 'NO'
      && fields.MERGE_APPROVED_BY_THIS_COMMENT === 'NO',
    'RIGHTS_POLICY_CONTRADICTION',
  );
}

export function validateRightsRetentionPolicyCommentAgainstExpectation({
  comment,
  asOf,
  expectation,
}) {
  validatePolicyExpectation(expectation);
  assertCondition(
    isPlainObject(comment)
      && isPlainObject(comment.user)
      && comment.id === expectation.commentId
      && comment.url === expectation.apiUrl
      && comment.html_url === expectation.commentUrl
      && comment.issue_url === expectation.issueUrl
      && comment.user.login === expectation.authorLogin
      && comment.user.type === expectation.authorType
      && comment.author_association === expectation.authorAssociation
      && comment.created_at === expectation.createdAt
      && comment.updated_at === expectation.updatedAt
      && comment.created_at === comment.updated_at,
    'RIGHTS_POLICY_COMMENT_METADATA_DRIFT',
  );

  const { fields, lfBody, marker } = parseRightsRetentionPolicyBody(comment.body);
  assertCondition(marker === expectation.marker, 'RIGHTS_POLICY_MARKER_DRIFT');
  assertCondition(
    fields.RIGHTS_RETENTION_OWNER_GITHUB_LOGIN === expectation.authorLogin
      && fields.RIGHTS_RETENTION_OWNER_GITHUB_LOGIN === comment.user.login,
    'RIGHTS_POLICY_OWNER_BINDING_DRIFT',
  );
  assertCondition(
    /\battest\b/i.test(fields.OWNER_AUTHORITY)
      && /\bauthorized\b/i.test(fields.OWNER_AUTHORITY)
      && /page-review rights/i.test(fields.OWNER_AUTHORITY)
      && /review-record retention policy/i.test(fields.OWNER_AUTHORITY)
      && /bounded pilot/i.test(fields.OWNER_AUTHORITY),
    'RIGHTS_POLICY_OWNER_AUTHORITY_INCOMPLETE',
  );
  assertCondition(
    fields.EVALUATED_PR === String(expectation.evaluatedPr),
    'RIGHTS_POLICY_PR_DRIFT',
  );
  assertCondition(
    fields.EVALUATED_HEAD === expectation.evaluatedHead,
    'RIGHTS_POLICY_HEAD_DRIFT',
  );
  assertCondition(
    fields.DOCUMENT_DECISION_FILE_SHA256 === expectation.documentDecisionFileSha256,
    'RIGHTS_POLICY_DOCUMENT_DECISION_HASH_DRIFT',
  );

  assertPolicyIsNotContradictory(fields);
  for (const [key, expectedValue] of Object.entries(expectation.policyFields)) {
    assertCondition(fields[key] === expectedValue, 'RIGHTS_POLICY_FIELD_DRIFT');
  }
  assertCondition(
    fields.EXPIRATION_OR_REVIEW_DATE === expectation.expirationOrReviewDate,
    'RIGHTS_POLICY_EXPIRATION_DRIFT',
  );

  const stopConditionCoverage = [];
  for (const [coverageCode, pattern] of Object.entries(
    RIGHTS_RETENTION_STOP_CONDITION_PATTERNS,
  )) {
    assertCondition(
      pattern.test(fields.STOP_CONDITIONS),
      'RIGHTS_POLICY_STOP_CONDITIONS_INCOMPLETE',
    );
    stopConditionCoverage.push(coverageCode);
  }

  const createdAtEpoch = parseIsoTimestamp(
    expectation.createdAt,
    'RIGHTS_POLICY_COMMENT_METADATA_DRIFT',
  );
  const asOfEpoch = parseIsoTimestamp(asOf, 'RIGHTS_POLICY_AS_OF_INVALID');
  const expiresAtEpoch = parseIsoTimestamp(
    fields.EXPIRATION_OR_REVIEW_DATE,
    'RIGHTS_POLICY_EXPIRATION_DRIFT',
  );
  assertCondition(asOfEpoch >= createdAtEpoch, 'RIGHTS_POLICY_NOT_YET_ACTIVE');
  assertCondition(asOfEpoch < expiresAtEpoch, 'RIGHTS_POLICY_EXPIRED');

  const rawBodySha256 = sha256(comment.body);
  const lfBodySha256 = sha256(lfBody);
  assertCondition(
    rawBodySha256 === expectation.rawBodySha256,
    'RIGHTS_POLICY_RAW_BODY_HASH_DRIFT',
  );
  assertCondition(
    lfBodySha256 === expectation.lfBodySha256,
    'RIGHTS_POLICY_LF_BODY_HASH_DRIFT',
  );

  return {
    recordType: 'PR207_PAGE_REVIEW_RIGHTS_RETENTION_POLICY',
    marker,
    validationStatus: 'VALID_ACTIVE_BOUNDED_POLICY_LOCAL_DISPLAY_ONLY',
    commentId: comment.id,
    commentUrl: comment.html_url,
    authorLogin: comment.user.login,
    authorAssociation: comment.author_association,
    createdAt: comment.created_at,
    updatedAt: comment.updated_at,
    rawBodySha256,
    lfNormalizedBodySha256: lfBodySha256,
    rawBodyByteLength: Buffer.byteLength(comment.body),
    rawBodyRetained: false,
    evaluatedAsOf: asOf,
    evaluatedPr: Number(fields.EVALUATED_PR),
    evaluatedHead: fields.EVALUATED_HEAD,
    documentDecisionFileSha256: fields.DOCUMENT_DECISION_FILE_SHA256,
    policyDecision: fields.POLICY_DECISION,
    fullPageReviewMode: fields.FULL_PAGE_REVIEW_MODE,
    fullPageTransmissionAllowed: fields.FULL_PAGE_TRANSMISSION_ALLOWED,
    fullPageGitCommitAllowed: fields.FULL_PAGE_GIT_COMMIT_ALLOWED,
    fullPageExportAllowed: fields.FULL_PAGE_EXPORT_ALLOWED,
    boundedExcerptInternalReviewAllowed:
      fields.BOUNDED_EXCERPT_INTERNAL_REVIEW_ALLOWED,
    publicRepositoryExcerptAllowedDuringPilot:
      fields.PUBLIC_REPOSITORY_EXCERPT_ALLOWED_DURING_PILOT,
    reviewRecordRetentionMode: fields.REVIEW_RECORD_RETENTION_MODE,
    reviewRecordRetentionLocation: fields.REVIEW_RECORD_RETENTION_LOCATION,
    reviewerIdentityRetained: fields.REVIEWER_IDENTITY_RETAINED,
    fullSourceBinaryRetained: fields.FULL_SOURCE_BINARY_RETAINED,
    expirationOrReviewDate: fields.EXPIRATION_OR_REVIEW_DATE,
    activeAtEvaluation: true,
    stopConditionCoverage,
    realDocumentVerifiedClaimsCreated:
      Number(fields.REAL_DOCUMENT_VERIFIED_CLAIMS_CREATED),
    realDocumentAllowedClaimsCreated:
      Number(fields.REAL_DOCUMENT_ALLOWED_CLAIMS_CREATED),
    productionApproved: fields.PRODUCTION_APPROVED,
    mergeApprovedByThisComment: fields.MERGE_APPROVED_BY_THIS_COMMENT,
  };
}

export function validatePr207RightsRetentionPolicyComment({ comment, asOf }) {
  return validateRightsRetentionPolicyCommentAgainstExpectation({
    comment,
    asOf,
    expectation: {
      ...PR207_RIGHTS_RETENTION_POLICY_EXPECTATION,
      policyFields: EXPECTED_RIGHTS_RETENTION_POLICY_FIELDS,
    },
  });
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
  const pageNamespacesByDocumentId = new Map();
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
    const pageNumbers = bundle.pages.map((page) => {
      assertCondition(
        isPlainObject(page)
          && Number.isSafeInteger(page.pageNumber)
          && page.pageNumber >= 1,
        'NORMALIZED_INPUT_PAGE_NAMESPACE_INVALID',
      );
      return page.pageNumber;
    });
    const normalizedPageNumbers = [...new Set(pageNumbers)].sort((left, right) =>
      left - right);
    const expectedNormalizedPageNumbers = Array.from(
      { length: pageNumbers.length },
      (_, index) => index + 1,
    );
    assertCondition(
      normalizedPageNumbers.length === pageNumbers.length
        && isDeepStrictEqual(pageNumbers, expectedNormalizedPageNumbers),
      'NORMALIZED_INPUT_PAGE_NAMESPACE_INVALID',
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
    assertCondition(
      !pageNamespacesByDocumentId.has(bundle.documentId),
      'NORMALIZED_INPUT_PAGE_NAMESPACE_DUPLICATE',
    );
    pageNamespacesByDocumentId.set(bundle.documentId, normalizedPageNumbers);
    seenPaths.add(entry.relativePath);
    totalByteLength += entry.input.byteLength;
    totalPageCount += bundle.pages.length;
  }

  assertCondition(
    seenPaths.size === manifestByRelativePath.size
      && [...manifestByRelativePath.keys()].every((relativePath) => seenPaths.has(relativePath)),
    'NORMALIZED_INPUT_COVERAGE_DRIFT',
  );
  return {
    pageNamespacesByDocumentId,
    totalByteLength,
    totalPageCount,
  };
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

function assertSortedUniquePageNumbers(value, code) {
  assertCondition(Array.isArray(value), code);
  let previous = null;
  for (const pageNumber of value) {
    assertCondition(
      Number.isSafeInteger(pageNumber)
        && pageNumber >= 1
        && (previous === null || pageNumber > previous),
      code,
    );
    previous = pageNumber;
  }
}

function pageNumbersAreSubset(candidatePageNumbers, pageNumbers) {
  const pageNumberSet = new Set(pageNumbers);
  return candidatePageNumbers.every((pageNumber) => pageNumberSet.has(pageNumber));
}

function validateCompletedFidelityRow(document, normalizedPageNumbers) {
  assertCondition(
    Array.isArray(document.pagesChecked)
      && Array.isArray(document.candidateBearingPagesChecked)
      && isPlainObject(document.revisionPageChecked)
      && typeof document.pageTextFidelity === 'string'
      && typeof document.tableStructureFidelity === 'string'
      && typeof document.variantSemanticsPreserved === 'string'
      && typeof document.unitSemanticsPreserved === 'string'
      && typeof document.minMaxRangeSemanticsPreserved === 'string'
      && typeof document.footnoteSemanticsPreserved === 'string'
      && Array.isArray(document.eligiblePageNumbers)
      && Array.isArray(document.ineligiblePageNumbers)
      && Array.isArray(document.decisionReasonCodes)
      && document.decisionReasonCodes.length > 0,
    'FIDELITY_ROW_PARTIAL',
  );

  for (const pageNumbers of [
    document.pagesChecked,
    document.candidateBearingPagesChecked,
    document.eligiblePageNumbers,
    document.ineligiblePageNumbers,
  ]) {
    assertSortedUniquePageNumbers(pageNumbers, 'FIDELITY_PAGE_NAMESPACE_INVALID');
  }
  assertCondition(
    isDeepStrictEqual(document.pagesChecked, normalizedPageNumbers),
    'FIDELITY_PAGES_CHECKED_DRIFT',
  );
  assertCondition(
    pageNumbersAreSubset(
      document.candidateBearingPagesChecked,
      document.pagesChecked,
    )
      && pageNumbersAreSubset(document.eligiblePageNumbers, document.pagesChecked)
      && pageNumbersAreSubset(document.ineligiblePageNumbers, document.pagesChecked),
    'FIDELITY_PAGE_NAMESPACE_DRIFT',
  );

  const eligiblePageNumberSet = new Set(document.eligiblePageNumbers);
  const ineligiblePageNumberSet = new Set(document.ineligiblePageNumbers);
  assertCondition(
    document.eligiblePageNumbers.every(
      (pageNumber) => !ineligiblePageNumberSet.has(pageNumber),
    )
      && document.pagesChecked.every(
        (pageNumber) =>
          eligiblePageNumberSet.has(pageNumber)
            || ineligiblePageNumberSet.has(pageNumber),
      )
      && document.eligiblePageNumbers.length
        + document.ineligiblePageNumbers.length === document.pagesChecked.length,
    'FIDELITY_ELIGIBILITY_PARTITION_INVALID',
  );
  assertCondition(
    pageNumbersAreSubset(
      document.eligiblePageNumbers,
      document.candidateBearingPagesChecked,
    ),
    'FIDELITY_ELIGIBLE_PAGE_NOT_CANDIDATE_BEARING',
  );

  assertCondition(
    EXPECTED_FIDELITY_DECISIONS.includes(document.pageTextFidelity),
    'FIDELITY_PAGE_TEXT_DECISION_INVALID',
  );
  assertCondition(
    EXPECTED_TABLE_STRUCTURE_FIDELITY_DECISIONS.includes(
      document.tableStructureFidelity,
    ),
    'FIDELITY_TABLE_STRUCTURE_DECISION_INVALID',
  );
  const semanticDecisions = [
    document.variantSemanticsPreserved,
    document.unitSemanticsPreserved,
    document.minMaxRangeSemanticsPreserved,
    document.footnoteSemanticsPreserved,
  ];
  assertCondition(
    semanticDecisions.every((decision) =>
      EXPECTED_SEMANTIC_PRESERVATION_DECISIONS.includes(decision)),
    'FIDELITY_SEMANTIC_DECISION_INVALID',
  );

  assertExactKeys(
    document.revisionPageChecked,
    REVISION_PAGE_CHECKED_KEYS,
    'FIDELITY_REVISION_PAGE_SCHEMA_DRIFT',
  );
  assertCondition(
    EXPECTED_REVISION_PAGE_LOCATOR_TYPES.includes(
      document.revisionPageChecked.locatorType,
    ),
    'FIDELITY_REVISION_PAGE_LOCATOR_INVALID',
  );
  assertBoundedString(
    document.revisionPageChecked.locatorValue,
    'FIDELITY_REVISION_PAGE_LOCATOR_INVALID',
    256,
  );
  const revisionStatuses = [
    document.revisionPageChecked.documentIdentityStatus,
    document.revisionPageChecked.documentNumberStatus,
    document.revisionPageChecked.revisionStatus,
  ];
  assertCondition(
    revisionStatuses.every((status) =>
      EXPECTED_REVISION_PAGE_STATUSES.includes(status)),
    'FIDELITY_REVISION_PAGE_STATUS_INVALID',
  );

  assertCondition(
    document.decisionReasonCodes.length
      <= EXPECTED_FIDELITY_DECISION_REASON_CODES.length
      && new Set(document.decisionReasonCodes).size
        === document.decisionReasonCodes.length
      && document.decisionReasonCodes.every((reasonCode) =>
        EXPECTED_FIDELITY_DECISION_REASON_CODES.includes(reasonCode)),
    'FIDELITY_DECISION_REASON_INVALID',
  );
  const noCandidateContent = document.decisionReasonCodes.includes(
    'NO_CANDIDATE_CONTENT',
  );
  assertCondition(
    !noCandidateContent
      || document.candidateBearingPagesChecked.length === 0,
    'FIDELITY_NO_CANDIDATE_REASON_CONTRADICTION',
  );

  const allRevisionStatusesMatch = revisionStatuses.every(
    (status) => status === 'MATCH',
  );
  const hasNotPreservedSemantic = semanticDecisions.includes('NOT_PRESERVED');
  const hasLimitationReason = document.decisionReasonCodes.includes(
    'ACCEPTABLE_LIMITATION_IDENTIFIED',
  );
  const hasUnsafeReason = document.decisionReasonCodes.some((reasonCode) =>
    reasonCode === 'UNSAFE_FIDELITY_IDENTIFIED'
      || reasonCode === 'SOURCE_PAGE_UNAVAILABLE');
  const sourcePageUnavailable =
    document.revisionPageChecked.locatorType === 'UNAVAILABLE';
  const sourcePageUnavailableReason = document.decisionReasonCodes.includes(
    'SOURCE_PAGE_UNAVAILABLE',
  );
  assertCondition(
    sourcePageUnavailable === sourcePageUnavailableReason
      && (!sourcePageUnavailable
        || revisionStatuses.every((status) => status === 'UNCONFIRMED')),
    'FIDELITY_SOURCE_PAGE_AVAILABILITY_CONTRADICTION',
  );

  if (document.pageTextFidelity === 'EXACT') {
    assertCondition(
      allRevisionStatusesMatch
        && !sourcePageUnavailable
        && !hasNotPreservedSemantic
        && document.tableStructureFidelity !== 'UNSAFE_FOR_CANDIDATE_REVIEW'
        && document.decisionReasonCodes.includes('EXACT_FIDELITY_CONFIRMED')
        && !hasLimitationReason
        && !hasUnsafeReason,
      'FIDELITY_EXACT_CONTRADICTION',
    );
  } else if (document.pageTextFidelity === 'ACCEPTABLE_WITH_LIMITATIONS') {
    const hasLimitationSignal = hasLimitationReason
      || hasNotPreservedSemantic
      || document.tableStructureFidelity === 'ACCEPTABLE_WITH_LIMITATIONS';
    assertCondition(
      allRevisionStatusesMatch
        && !sourcePageUnavailable
        && document.eligiblePageNumbers.length > 0
        && document.ineligiblePageNumbers.length > 0
        && hasLimitationSignal
        && document.tableStructureFidelity !== 'UNSAFE_FOR_CANDIDATE_REVIEW'
        && !document.decisionReasonCodes.includes('EXACT_FIDELITY_CONFIRMED')
        && !hasUnsafeReason,
      'FIDELITY_ACCEPTABLE_CONTRADICTION',
    );
  } else {
    const hasUnsafeSignal = hasUnsafeReason
      || hasNotPreservedSemantic
      || !allRevisionStatusesMatch
      || document.tableStructureFidelity === 'UNSAFE_FOR_CANDIDATE_REVIEW';
    assertCondition(
      document.eligiblePageNumbers.length === 0
        && isDeepStrictEqual(
          document.ineligiblePageNumbers,
          document.pagesChecked,
        )
        && hasUnsafeReason
        && hasUnsafeSignal
        && !document.decisionReasonCodes.includes('EXACT_FIDELITY_CONFIRMED')
        && !hasLimitationReason,
      'FIDELITY_UNSAFE_CONTRADICTION',
    );
  }

  if (document.pageTextFidelity !== 'UNSAFE_FOR_CANDIDATE_REVIEW') {
    assertCondition(
      allRevisionStatusesMatch,
      'FIDELITY_REVISION_STATUS_REQUIRES_UNSAFE_DECISION',
    );
    assertCondition(
      document.candidateBearingPagesChecked.length > 0 || noCandidateContent,
      'FIDELITY_ZERO_CANDIDATE_PAGES_REASON_REQUIRED',
    );
  }
}

function validateFidelityDecisions(
  input,
  documentsById,
  pageNamespacesByDocumentId,
) {
  validateSafeInputDescriptor(input, 'FIDELITY_INPUT_DESCRIPTOR_INVALID');
  const fidelity = input.value;
  assertExactKeys(fidelity, FIDELITY_DECISION_KEYS, 'FIDELITY_SCHEMA_DRIFT');
  assertCondition(
    fidelity.schemaVersion === 'pr207-document-fidelity-decisions-v2'
      && fidelity.boundary === 'NOT_PRODUCTION_EVIDENCE'
      && fidelity.pageNumberNamespace === 'NORMALIZED_BUNDLE_PAGE_NUMBER'
      && (
        fidelity.preparedBy === 'CODEX_MACHINE_TEMPLATE_NO_HUMAN_DECISIONS'
          || fidelity.preparedBy
            === 'LOCAL_OPERATOR_STRUCTURED_HUMAN_DECISIONS_NO_IDENTITY'
      )
      && fidelity.evaluatedPr === 207
      && fidelity.evaluatedHead === EXPECTED_PR207_HEAD
      && fidelity.documentDecisionFileSha256
        === EXPECTED_DOCUMENT_DECISION_FILE_SHA256
      && fidelity.intakeManifestSha256 === EXPECTED_INTAKE_MANIFEST_SHA256
      && fidelity.documentTupleFingerprintSha256
        === EXPECTED_DOCUMENT_TUPLE_FINGERPRINT_SHA256
      && fidelity.documentCount === 8
      && typeof fidelity.humanFieldsAreBlank === 'boolean'
      && isDeepStrictEqual(
        fidelity.allowedPageTextFidelityDecisions,
        EXPECTED_FIDELITY_DECISIONS,
      )
      && isDeepStrictEqual(
        fidelity.allowedTableStructureFidelityDecisions,
        EXPECTED_TABLE_STRUCTURE_FIDELITY_DECISIONS,
      )
      && isDeepStrictEqual(
        fidelity.allowedSemanticPreservationDecisions,
        EXPECTED_SEMANTIC_PRESERVATION_DECISIONS,
      )
      && isDeepStrictEqual(
        fidelity.allowedDecisionReasonCodes,
        EXPECTED_FIDELITY_DECISION_REASON_CODES,
      )
      && Array.isArray(fidelity.documents)
      && fidelity.documents.length === 8,
    'FIDELITY_CONTRACT_DRIFT',
  );
  assertNonClaims(fidelity.nonClaims, 'FIDELITY_NONCLAIMS_INVALID');

  const seenIds = new Set();
  let blankRowCount = 0;
  const decisionDistribution = {
    exactRowCount: 0,
    acceptableWithLimitationsRowCount: 0,
    unsafeForCandidateReviewRowCount: 0,
  };
  let candidateBearingPageCount = 0;
  let eligiblePageCount = 0;
  let ineligiblePageCount = 0;
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
    const normalizedPageNumbers = pageNamespacesByDocumentId.get(
      document.documentId,
    );
    assertCondition(
      Array.isArray(normalizedPageNumbers),
      'FIDELITY_PAGE_NAMESPACE_BINDING_DRIFT',
    );
    seenIds.add(document.documentId);
    if (fidelityRowIsBlank(document)) {
      blankRowCount += 1;
      continue;
    }
    validateCompletedFidelityRow(document, normalizedPageNumbers);
    candidateBearingPageCount += document.candidateBearingPagesChecked.length;
    eligiblePageCount += document.eligiblePageNumbers.length;
    ineligiblePageCount += document.ineligiblePageNumbers.length;
    if (document.pageTextFidelity === 'EXACT') {
      decisionDistribution.exactRowCount += 1;
    } else if (document.pageTextFidelity === 'ACCEPTABLE_WITH_LIMITATIONS') {
      decisionDistribution.acceptableWithLimitationsRowCount += 1;
    } else {
      decisionDistribution.unsafeForCandidateReviewRowCount += 1;
    }
  }
  assertCondition(seenIds.size === documentsById.size, 'FIDELITY_DOCUMENT_COVERAGE_DRIFT');
  const completedRowCount = fidelity.documents.length - blankRowCount;
  assertCondition(
    fidelity.humanFieldsAreBlank === (completedRowCount === 0),
    'FIDELITY_HUMAN_FIELDS_BLANK_CONTRADICTION',
  );
  assertCondition(
    fidelity.preparedBy === (
      completedRowCount === 0
        ? 'CODEX_MACHINE_TEMPLATE_NO_HUMAN_DECISIONS'
        : 'LOCAL_OPERATOR_STRUCTURED_HUMAN_DECISIONS_NO_IDENTITY'
    ),
    'FIDELITY_PREPARED_BY_CONTRADICTION',
  );
  return {
    blankRowCount,
    candidateBearingPageCount,
    completedRowCount,
    decisionDistribution,
    eligiblePageCount,
    fidelity,
    ineligiblePageCount,
  };
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
  rightsRetentionPolicyComment,
  asOf,
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
  const {
    blankRowCount,
    candidateBearingPageCount,
    completedRowCount,
    decisionDistribution,
    eligiblePageCount,
    fidelity,
    ineligiblePageCount,
  } = validateFidelityDecisions(
    fidelityDecisions,
    documentsById,
    normalized.pageNamespacesByDocumentId,
  );
  const candidate = validateCandidateDecisions(candidateDecisions);
  const rightsRetentionDecisionRecord = rightsRetentionPolicyComment === undefined
    ? null
    : validatePr207RightsRetentionPolicyComment({
      comment: rightsRetentionPolicyComment,
      asOf,
    });
  const humanFidelityEvidence = completedRowCount === 0
    ? 'INCOMPLETE_0_OF_8'
    : completedRowCount === fidelity.documents.length
      ? 'COMPLETE_8_OF_8'
      : `PARTIAL_${completedRowCount}_OF_8`;
  const fidelityDecisionCompletion = completedRowCount === 0
    ? 'BLANK_0_OF_8'
    : completedRowCount === fidelity.documents.length
      ? 'COMPLETE_8_OF_8'
      : `PARTIAL_${completedRowCount}_OF_8`;
  const rightsRetentionDecisionSummary = rightsRetentionDecisionRecord === null
    ? null
    : {
      activeAtEvaluation: rightsRetentionDecisionRecord.activeAtEvaluation,
      mergeApprovedByThisComment:
        rightsRetentionDecisionRecord.mergeApprovedByThisComment,
      productionApproved: rightsRetentionDecisionRecord.productionApproved,
      rawBodyRetained: rightsRetentionDecisionRecord.rawBodyRetained,
      realDocumentAllowedClaimsCreated:
        rightsRetentionDecisionRecord.realDocumentAllowedClaimsCreated,
      realDocumentVerifiedClaimsCreated:
        rightsRetentionDecisionRecord.realDocumentVerifiedClaimsCreated,
      validationStatus: rightsRetentionDecisionRecord.validationStatus,
    };

  return {
    schemaVersion: 'pr207-human-evidence-input-validation-v3',
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    validationStatus: 'STRUCTURALLY_VALID',
    evidenceStatus: 'INCOMPLETE',
    operatorOutcome: 'AWAITING_HUMAN_INPUT',
    evaluatedPr: 207,
    evaluatedHead: EXPECTED_PR207_HEAD,
    evaluatedAsOf: asOf ?? null,
    hashes: {
      intakeManifestSha256: intakeManifest.sha256,
      documentDecisionFileSha256: documentDecisions.sha256,
      fidelityDecisionFileSha256: fidelityDecisions.sha256,
      candidateDecisionFileSha256: candidateDecisions.sha256,
      documentTupleFingerprintSha256: decision.documentTupleFingerprintSha256,
      rightsRetentionPolicyRawBodySha256:
        rightsRetentionDecisionRecord?.rawBodySha256 ?? null,
      rightsRetentionPolicyLfNormalizedBodySha256:
        rightsRetentionDecisionRecord?.lfNormalizedBodySha256 ?? null,
    },
    counts: {
      safeIgnoredInputFileCount: 4 + normalizedDocuments.length,
      intakeManifestDocumentCount: manifest.documents.length,
      normalizedDocumentInputCount: normalizedDocuments.length,
      normalizedDocumentPageCount: normalized.totalPageCount,
      documentDecisionRowCount: decision.documents.length,
      fidelityDecisionRowCount: fidelity.documents.length,
      blankFidelityDecisionRowCount: blankRowCount,
      partialFidelityDecisionRowCount: 0,
      completedFidelityDecisionRowCount: completedRowCount,
      partialFidelityDecisionFileCount:
        completedRowCount > 0 && completedRowCount < fidelity.documents.length
          ? 1
          : 0,
      completeFidelityDecisionFileCount:
        completedRowCount === fidelity.documents.length ? 1 : 0,
      fidelityDecisionDistribution: decisionDistribution,
      fidelityCandidateBearingPageCount: candidateBearingPageCount,
      fidelityEligiblePageCount: eligiblePageCount,
      fidelityIneligiblePageCount: ineligiblePageCount,
      candidateDecisionRowCount: candidate.candidates.length,
      approvedCandidateDecisionRowCount: 0,
      intakeManifestByteCount: intakeManifest.byteLength,
      documentDecisionFileByteCount: documentDecisions.byteLength,
      fidelityDecisionFileByteCount: fidelityDecisions.byteLength,
      candidateDecisionFileByteCount: candidateDecisions.byteLength,
      normalizedDocumentInputByteCount: normalized.totalByteLength,
      rightsRetentionPolicyCommentCount: rightsRetentionDecisionRecord ? 1 : 0,
      realDocumentVerifiedClaimsCreated:
        rightsRetentionDecisionRecord?.realDocumentVerifiedClaimsCreated ?? 0,
      realDocumentAllowedClaimsCreated:
        rightsRetentionDecisionRecord?.realDocumentAllowedClaimsCreated ?? 0,
    },
    statuses: {
      localInputSafety: 'PASS',
      structuralAndLineageValidation: 'PASS',
      humanFidelityEvidence,
      fidelityDecisionCompletion,
      fidelityCompletionContract: 'SUPPORTED_FAIL_CLOSED_V2',
      rightsAndRetentionAuthority:
        rightsRetentionDecisionRecord?.validationStatus
          ?? 'NOT_VALIDATED_REQUIRES_CANONICAL_GITHUB_DECISION',
      candidatePopulation: 'EMPTY',
      candidateCompletionContract: 'NOT_APPROVED_NONEMPTY_V1_REFUSED',
      candidateReviewEvidence: 'INCOMPLETE_0_OF_25',
      candidateFamilyThresholds:
        'INCOMPLETE_SWITCHGEAR_0_OF_10_TRANSFORMER_0_OF_10',
      mergeApproval: 'NOT_GRANTED',
      productionApproval: 'NOT_GRANTED',
    },
    rightsRetentionDecisionRecord: rightsRetentionDecisionSummary,
    nonClaims: [
      'Structural validation does not create or infer a human fidelity decision.',
      'An empty candidate set does not satisfy the PR207 real-evidence pilot threshold.',
      rightsRetentionDecisionRecord
        ? 'The active bounded policy permits local operator display and bounded internal-review excerpts only; it does not permit full-page transmission, export, Git commit, public-repository excerpts, merge, or production.'
        : 'This report does not establish source rights, retention approval, claim correctness, merge approval, or production approval.',
      'This report does not establish human fidelity, claim correctness, candidate approval, merge approval, or production approval.',
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
