import {
  ClaimValidationError,
  assertSafeArtifact,
  canonicalStringify,
  normalizeEvidenceUrl,
  sha256,
} from '../claim-registry/index.mjs';

export const GOLDEN_CANDIDATE_SCHEMA_VERSION = 'pursuit-golden-source-candidates-v0';
export const GOLDEN_ADJUDICATION_SCHEMA_VERSION = 'pursuit-golden-human-adjudications-v0';
export const GOLDEN_AUDIT_SCHEMA_VERSION = 'pursuit-golden-dataset-audit-v0';
export const GOLDEN_CANDIDATE_BOUNDARY = 'PUBLIC_SOURCE_REVIEW_SET_NOT_PRODUCTION_EVIDENCE';
export const GOLDEN_ADJUDICATION_BOUNDARY = 'HUMAN_ADJUDICATIONS_NOT_PRODUCTION_EVIDENCE';
export const GOLDEN_AUDIT_BOUNDARY = 'NOT_PRODUCTION_EVIDENCE';

export const GOLDEN_PRODUCT_FAMILY_IDS = Object.freeze([
  'medium_voltage_switchgear',
  'transformer',
]);

export const GOLDEN_PROJECT_STAGES = Object.freeze([
  'ANNOUNCED',
  'FEASIBILITY',
  'DESIGN',
  'PROCUREMENT',
  'CONSTRUCTION',
  'COMMISSIONING',
  'OPERATION',
]);

export const GOLDEN_READINESS_THRESHOLDS = Object.freeze({
  humanConfirmedProjects: 10,
  publicSourceDocuments: 30,
  capabilityClaims: 30,
  humanConfirmedCapabilityClaims: 30,
  requirementCapabilityPairs: 10,
  productFamilies: 2,
  humanConfirmedStages: 5,
  revisionLinks: 1,
});

const CANDIDATE_AUTHORITY_FIELDS = new Set([
  'verificationStatus',
  'customerUse',
  'fitResult',
  'finalDecision',
  'finalPursuitDecision',
  'humanConfirmed',
  'goldenReady',
  'reviewAuthority',
  'reviewReceipt',
  'reviewedAt',
  'humanDecision',
  'engineExpectation',
  'label',
  'reviewers',
  'reviewerIdentity',
  'identityStatus',
  'approved',
  'humanReviewed',
  'isHumanReviewed',
]);

const ANNOTATION_ORIGINS = new Set(['AI_ASSISTED', 'RULE_ASSISTED', 'MANUAL_UNREVIEWED']);
const SOURCE_CLASSES = new Set(['PROJECT', 'CAPABILITY', 'REFERENCE']);
const PUBLICATION_PRECISIONS = new Set(['DAY', 'MONTH', 'YEAR', 'UNKNOWN']);
const SUPPORT_STATES = new Set([
  'SOURCE_SUPPORTED',
  'SOURCE_SUPPORTED_CONDITIONAL',
  'HOLD_MISSING_CONTEXT',
]);
const OPERATORS = new Set(['EQ', 'LT', 'LTE', 'IN', 'BETWEEN_INCLUSIVE', 'CONFORMS_TO']);
const PROJECT_FIT_RESULTS = new Set(['FIT', 'CONDITIONAL_FIT', 'NOT_FIT', 'INSUFFICIENT_EVIDENCE']);
const FINAL_PURSUIT_DECISIONS = new Set(['PURSUE', 'HOLD', 'NO_BID']);
const SPECIFICATION_WINDOW_STATES = new Set(['OPEN', 'CLOSING', 'CLOSED', 'UNKNOWN']);
const CAPABILITY_LABELS = new Set([
  'SUPPORTED',
  'SUPPORTED_CONDITIONAL',
  'INSUFFICIENT_EVIDENCE',
  'REJECTED',
]);
const PAIR_LABELS = new Set(['MATCH', 'MISMATCH', 'INSUFFICIENT_EVIDENCE', 'NOT_APPLICABLE']);
const REASON_CODE_PATTERN = /^[A-Z][A-Z0-9_]{2,63}$/;
const REVIEW_RECEIPT_PATTERN = /^[a-z0-9][a-z0-9._:-]{7,127}$/;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const KEY_PATTERN = /^[a-z0-9][a-z0-9._-]{2,127}$/;
const CONDITION_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9._-]{1,127}$/;
const MAX_EXCERPT_WORDS_PER_DOCUMENT = 24;
const SECRET_QUERY_KEY = /(?:sig(?:nature)?|x-amz-|x-goog-|auth|credential|session|jwt|sas|key|token|secret|password|expires?)/i;
const PROJECT_SPECIFICATION_DOCUMENT_KINDS = new Set([
  'ADDENDUM',
  'BASIS_OF_DESIGN',
  'FACILITY_SPECIFICATION',
  'SINGLE_LINE_DIAGRAM',
  'TECHNICAL_SPECIFICATION',
  'TENDER_DOCUMENT',
]);
const PUBLIC_SUFFIX_ONLY_DOMAINS = new Set([
  'com',
  'net',
  'org',
  'kr',
  'co.kr',
  'go.kr',
  'or.kr',
]);
const VALIDATED_GOLDEN_DATASETS = new WeakSet();

export class GoldenDatasetValidationError extends ClaimValidationError {
  constructor(code, path = '$') {
    super(code, path);
    this.name = 'GoldenDatasetValidationError';
  }
}

function fail(code, path) {
  throw new GoldenDatasetValidationError(code, path);
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function compareAscii(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function text(value, path) {
  if (typeof value !== 'string') fail('NONEMPTY_STRING_REQUIRED', path);
  const normalized = value.normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (!normalized) fail('NONEMPTY_STRING_REQUIRED', path);
  return normalized;
}

function optionalText(value, path) {
  if (value === null || value === undefined || value === '') return null;
  return text(value, path);
}

function key(value, path) {
  const normalized = text(value, path);
  if (!KEY_PATTERN.test(normalized)) fail('INVALID_STABLE_KEY', path);
  return normalized;
}

function assertObject(value, path) {
  if (!isPlainObject(value)) fail('PLAIN_OBJECT_REQUIRED', path);
  return value;
}

function assertOnlyKeys(value, allowed, path) {
  for (const field of Object.keys(value)) {
    if (!allowed.has(field)) fail('UNEXPECTED_FIELD_REFUSED', `${path}.${field}`);
  }
}

function assertArray(value, path, { allowEmpty = true } = {}) {
  if (!Array.isArray(value)) fail('ARRAY_REQUIRED', path);
  if (!allowEmpty && value.length === 0) fail('NONEMPTY_ARRAY_REQUIRED', path);
  return value;
}

function boolean(value, path) {
  if (typeof value !== 'boolean') fail('BOOLEAN_REQUIRED', path);
  return value;
}

function isoTimestamp(value, path, { nullable = false, asOf = null } = {}) {
  if (nullable && value === null) return null;
  if (typeof value !== 'string') fail('ISO_TIMESTAMP_REQUIRED', path);
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    fail('INVALID_ISO_TIMESTAMP', path);
  }
  if (asOf && value > asOf) fail('FUTURE_DATE_REFUSED', path);
  return value;
}

function uniqueSortedStrings(values, path, { allowEmpty = true } = {}) {
  const normalized = assertArray(values, path, { allowEmpty }).map((value, index) => (
    text(value, `${path}[${index}]`)
  ));
  if (new Set(normalized).size !== normalized.length) fail('DUPLICATE_VALUE', path);
  return normalized.sort(compareAscii);
}

function assertExactProductFamilies(values, path) {
  const normalized = uniqueSortedStrings(values, path, { allowEmpty: false });
  const expected = [...GOLDEN_PRODUCT_FAMILY_IDS].sort(compareAscii);
  if (canonicalStringify(normalized) !== canonicalStringify(expected)) {
    fail('EXACT_TWO_PRODUCT_FAMILIES_REQUIRED', path);
  }
  return normalized;
}

function assertCandidateAuthoritySeparation(value, path = '$.candidates') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertCandidateAuthoritySeparation(item, `${path}[${index}]`));
    return;
  }
  if (!isPlainObject(value)) return;
  for (const [field, child] of Object.entries(value)) {
    if (CANDIDATE_AUTHORITY_FIELDS.has(field)) {
      fail('HUMAN_AUTHORITY_FIELD_REFUSED_IN_CANDIDATE_INPUT', `${path}.${field}`);
    }
    assertCandidateAuthoritySeparation(child, `${path}.${field}`);
  }
}

function assertHumanOriginSeparation(value, path = '$.adjudications') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertHumanOriginSeparation(item, `${path}[${index}]`));
    return;
  }
  if (!isPlainObject(value)) return;
  for (const [field, child] of Object.entries(value)) {
    if (field === 'annotationOrigin') {
      fail('PROVISIONAL_ORIGIN_REFUSED_IN_HUMAN_ADJUDICATION', `${path}.${field}`);
    }
    assertHumanOriginSeparation(child, `${path}.${field}`);
  }
}

function deriveId(prefix, payload, suppliedId, path) {
  const expected = `${prefix}_${sha256(payload)}`;
  if (suppliedId !== undefined && suppliedId !== expected) fail('CANONICAL_ID_MISMATCH', path);
  return expected;
}

function normalizeHttpsUrl(value, domainCandidate, path) {
  let normalized;
  try {
    normalized = normalizeEvidenceUrl(value, { synthetic: false, path });
  } catch (error) {
    if (error instanceof ClaimValidationError) {
      throw new GoldenDatasetValidationError(error.code, error.path);
    }
    throw error;
  }
  const parsed = new URL(normalized);
  if (parsed.protocol !== 'https:') fail('HTTPS_SOURCE_REQUIRED', path);
  const domain = text(domainCandidate, path.replace(/sourceUrl$/, 'officialDomainCandidate')).toLowerCase();
  if (
    !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(domain)
    || !domain.includes('.')
    || PUBLIC_SUFFIX_ONLY_DOMAINS.has(domain)
  ) {
    fail('INVALID_OFFICIAL_DOMAIN_CANDIDATE', path.replace(/sourceUrl$/, 'officialDomainCandidate'));
  }
  if (parsed.hostname !== domain && !parsed.hostname.endsWith(`.${domain}`)) {
    fail('OFFICIAL_DOMAIN_CANDIDATE_MISMATCH', path);
  }
  for (const [queryKey, queryValue] of parsed.searchParams) {
    if (SECRET_QUERY_KEY.test(queryKey) || queryValue.length > 128) {
      fail('SIGNED_OR_SECRET_SOURCE_QUERY_REFUSED', path);
    }
  }
  return normalized;
}

function normalizeExcerpts(excerpts, path) {
  const normalized = assertArray(excerpts, path, { allowEmpty: false }).map((excerpt, index) => {
    const itemPath = `${path}[${index}]`;
    assertObject(excerpt, itemPath);
    assertOnlyKeys(excerpt, new Set(['locator', 'text']), itemPath);
    return {
      locator: text(excerpt.locator, `${itemPath}.locator`),
      text: text(excerpt.text, `${itemPath}.text`),
    };
  });
  const wordCount = normalized
    .flatMap((excerpt) => excerpt.text.split(/\s+/u))
    .filter(Boolean)
    .length;
  if (wordCount > MAX_EXCERPT_WORDS_PER_DOCUMENT) fail('DOCUMENT_EXCERPT_WORD_LIMIT_EXCEEDED', path);
  return normalized;
}

function normalizeDocument(raw, index, asOf) {
  const path = `$.candidates.documents[${index}]`;
  assertObject(raw, path);
  assertOnlyKeys(raw, new Set([
    'documentId',
    'documentKey',
    'sourceClass',
    'publisher',
    'title',
    'authorityTypeCandidate',
    'officialDomainCandidate',
    'sourceUrl',
    'documentKind',
    'publishedAt',
    'publishedAtPrecision',
    'retrievedAt',
    'documentStored',
    'remoteContentSha256Candidate',
    'revision',
    'excerpts',
  ]), path);
  const documentKey = key(raw.documentKey, `${path}.documentKey`);
  const sourceClass = text(raw.sourceClass, `${path}.sourceClass`);
  if (!SOURCE_CLASSES.has(sourceClass)) fail('INVALID_SOURCE_CLASS', `${path}.sourceClass`);
  const authorityTypeCandidate = text(raw.authorityTypeCandidate, `${path}.authorityTypeCandidate`);
  if (authorityTypeCandidate !== 'OFFICIAL_PRIMARY_SOURCE_CANDIDATE') {
    fail('INVALID_AUTHORITY_TYPE_CANDIDATE', `${path}.authorityTypeCandidate`);
  }
  const officialDomainCandidate = text(raw.officialDomainCandidate, `${path}.officialDomainCandidate`).toLowerCase();
  const publishedAt = isoTimestamp(raw.publishedAt, `${path}.publishedAt`, { nullable: true, asOf });
  const publishedAtPrecision = text(raw.publishedAtPrecision, `${path}.publishedAtPrecision`);
  if (!PUBLICATION_PRECISIONS.has(publishedAtPrecision)) {
    fail('INVALID_PUBLICATION_PRECISION', `${path}.publishedAtPrecision`);
  }
  if ((publishedAt === null) !== (publishedAtPrecision === 'UNKNOWN')) {
    fail('PUBLICATION_DATE_PRECISION_MISMATCH', `${path}.publishedAtPrecision`);
  }
  const retrievedAt = isoTimestamp(raw.retrievedAt, `${path}.retrievedAt`, { asOf });
  if (publishedAt && publishedAt > retrievedAt) fail('DOCUMENT_CHRONOLOGY_INVALID', path);
  if (raw.documentStored !== false) fail('REMOTE_DOCUMENT_STORAGE_REFUSED', `${path}.documentStored`);
  const remoteContentSha256Candidate = optionalText(
    raw.remoteContentSha256Candidate,
    `${path}.remoteContentSha256Candidate`,
  );
  if (remoteContentSha256Candidate && !HASH_PATTERN.test(remoteContentSha256Candidate)) {
    fail('INVALID_REMOTE_CONTENT_HASH_CANDIDATE', `${path}.remoteContentSha256Candidate`);
  }
  assertObject(raw.revision, `${path}.revision`);
  assertOnlyKeys(
    raw.revision,
    new Set(['seriesKey', 'revisionKey', 'supersedesDocumentKey']),
    `${path}.revision`,
  );
  const normalized = {
    documentKey,
    sourceClass,
    publisher: text(raw.publisher, `${path}.publisher`),
    title: text(raw.title, `${path}.title`),
    authorityTypeCandidate,
    officialDomainCandidate,
    sourceUrl: normalizeHttpsUrl(raw.sourceUrl, officialDomainCandidate, `${path}.sourceUrl`),
    documentKind: text(raw.documentKind, `${path}.documentKind`),
    publishedAt,
    publishedAtPrecision,
    retrievedAt,
    documentStored: false,
    remoteContentSha256Candidate,
    revision: {
      seriesKey: key(raw.revision.seriesKey, `${path}.revision.seriesKey`),
      revisionKey: key(raw.revision.revisionKey, `${path}.revision.revisionKey`),
      supersedesDocumentKey: raw.revision.supersedesDocumentKey === null
        ? null
        : key(raw.revision.supersedesDocumentKey, `${path}.revision.supersedesDocumentKey`),
    },
    excerpts: normalizeExcerpts(raw.excerpts, `${path}.excerpts`),
  };
  return {
    documentId: deriveId('doc', normalized, raw.documentId, `${path}.documentId`),
    ...normalized,
  };
}

function assertUniqueBy(items, field, path) {
  const seen = new Set();
  for (const [index, item] of items.entries()) {
    if (seen.has(item[field])) fail('DUPLICATE_KEY', `${path}[${index}].${field}`);
    seen.add(item[field]);
  }
}

function assertRevisionGraph(documents) {
  const byKey = new Map(documents.map((document) => [document.documentKey, document]));
  const revisionIds = new Set();
  for (const [index, document] of documents.entries()) {
    const revisionId = `${document.revision.seriesKey}\0${document.revision.revisionKey}`;
    if (revisionIds.has(revisionId)) {
      fail('DUPLICATE_REVISION_ID', `$.candidates.documents[${index}].revision`);
    }
    revisionIds.add(revisionId);
    const supersedes = document.revision.supersedesDocumentKey;
    if (!supersedes) continue;
    const previous = byKey.get(supersedes);
    if (!previous) fail('DANGLING_SUPERSESSION_REFERENCE', `$.candidates.documents[${index}].revision.supersedesDocumentKey`);
    if (supersedes === document.documentKey) fail('SELF_SUPERSESSION_REFUSED', `$.candidates.documents[${index}].revision.supersedesDocumentKey`);
    if (previous.revision.seriesKey !== document.revision.seriesKey) {
      fail('CROSS_SERIES_SUPERSESSION_REFUSED', `$.candidates.documents[${index}].revision.supersedesDocumentKey`);
    }
    if (document.publishedAt && previous.publishedAt && document.publishedAt < previous.publishedAt) {
      fail('REVISION_CHRONOLOGY_INVALID', `$.candidates.documents[${index}].revision.supersedesDocumentKey`);
    }
  }
  for (const document of documents) {
    const visited = new Set();
    let cursor = document;
    while (cursor?.revision.supersedesDocumentKey) {
      if (visited.has(cursor.documentKey)) fail('REVISION_CYCLE_REFUSED', '$.candidates.documents');
      visited.add(cursor.documentKey);
      cursor = byKey.get(cursor.revision.supersedesDocumentKey);
    }
  }
}

function resolveKeys(keys, lookup, path, { allowEmpty = false } = {}) {
  return uniqueSortedStrings(keys, path, { allowEmpty }).map((value, index) => {
    const record = lookup.get(value);
    if (!record) fail('DANGLING_REFERENCE', `${path}[${index}]`);
    return record;
  });
}

function normalizeProject(raw, index, asOf, documentByKey, supersededDocumentIds) {
  const path = `$.candidates.projects[${index}]`;
  assertObject(raw, path);
  assertOnlyKeys(raw, new Set([
    'projectId',
    'projectKey',
    'name',
    'location',
    'documentKeys',
    'stageObservation',
    'annotationOrigin',
    'limitations',
  ]), path);
  const projectKey = key(raw.projectKey, `${path}.projectKey`);
  assertObject(raw.location, `${path}.location`);
  assertOnlyKeys(raw.location, new Set(['countryCode', 'region', 'locality']), `${path}.location`);
  assertObject(raw.stageObservation, `${path}.stageObservation`);
  assertOnlyKeys(
    raw.stageObservation,
    new Set(['stage', 'observedAt', 'documentKey', 'forwardLooking']),
    `${path}.stageObservation`,
  );
  const stage = text(raw.stageObservation.stage, `${path}.stageObservation.stage`);
  if (!GOLDEN_PROJECT_STAGES.includes(stage)) fail('INVALID_PROJECT_STAGE', `${path}.stageObservation.stage`);
  const documents = resolveKeys(raw.documentKeys, documentByKey, `${path}.documentKeys`);
  if (documents.some((document) => document.sourceClass !== 'PROJECT')) {
    fail('PROJECT_DOCUMENT_REFERENCE_REQUIRED', `${path}.documentKeys`);
  }
  const stageDocument = documentByKey.get(text(
    raw.stageObservation.documentKey,
    `${path}.stageObservation.documentKey`,
  ));
  if (!stageDocument || !documents.includes(stageDocument)) {
    fail('STAGE_DOCUMENT_MUST_BE_PROJECT_REFERENCE', `${path}.stageObservation.documentKey`);
  }
  if (stageDocument.sourceClass !== 'PROJECT') {
    fail('STAGE_DOCUMENT_MUST_BE_PROJECT_SOURCE', `${path}.stageObservation.documentKey`);
  }
  if (supersededDocumentIds.has(stageDocument.documentId)) {
    fail('SUPERSEDED_STAGE_DOCUMENT_REFUSED', `${path}.stageObservation.documentKey`);
  }
  const annotationOrigin = text(raw.annotationOrigin, `${path}.annotationOrigin`);
  if (!ANNOTATION_ORIGINS.has(annotationOrigin)) fail('INVALID_ANNOTATION_ORIGIN', `${path}.annotationOrigin`);
  const normalized = {
    projectKey,
    name: text(raw.name, `${path}.name`),
    location: {
      countryCode: text(raw.location.countryCode, `${path}.location.countryCode`),
      region: text(raw.location.region, `${path}.location.region`),
      locality: text(raw.location.locality, `${path}.location.locality`),
    },
    documentIds: documents.map((document) => document.documentId).sort(compareAscii),
    stageObservation: {
      stage,
      observedAt: isoTimestamp(raw.stageObservation.observedAt, `${path}.stageObservation.observedAt`, { asOf }),
      documentId: stageDocument.documentId,
      forwardLooking: boolean(raw.stageObservation.forwardLooking, `${path}.stageObservation.forwardLooking`),
    },
    annotationOrigin,
    limitations: uniqueSortedStrings(raw.limitations, `${path}.limitations`, { allowEmpty: false }),
  };
  if (normalized.location.countryCode !== 'KR') fail('KR_PROJECT_REQUIRED', `${path}.location.countryCode`);
  return {
    projectId: deriveId('prj', normalized, raw.projectId, `${path}.projectId`),
    ...normalized,
  };
}

function normalizeCandidateValue(value, path) {
  if (value === null) return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('NONFINITE_VALUE_REFUSED', path);
    return value;
  }
  if (typeof value === 'string') return text(value, path);
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    if (value.length === 0) fail('NONEMPTY_VALUE_ARRAY_REQUIRED', path);
    return value.map((item, index) => normalizeCandidateValue(item, `${path}[${index}]`));
  }
  fail('INVALID_CANDIDATE_VALUE', path);
}

function assertOperatorValue(operator, value, path) {
  if (operator === 'IN') {
    if (!Array.isArray(value) || value.length === 0) fail('IN_VALUE_ARRAY_REQUIRED', path);
    if (new Set(value.map((item) => canonicalStringify(item))).size !== value.length) {
      fail('DUPLICATE_IN_VALUE', path);
    }
    return;
  }
  if (operator === 'BETWEEN_INCLUSIVE') {
    if (
      !Array.isArray(value)
      || value.length !== 2
      || !value.every(Number.isFinite)
      || value[0] > value[1]
    ) {
      fail('ORDERED_NUMERIC_RANGE_REQUIRED', path);
    }
    return;
  }
  if (operator === 'LT' || operator === 'LTE') {
    if (!Number.isFinite(value)) fail('NUMERIC_THRESHOLD_REQUIRED', path);
    return;
  }
  if (operator === 'CONFORMS_TO') {
    if (typeof value !== 'string' || !value) fail('STANDARD_STRING_REQUIRED', path);
    return;
  }
  if (operator === 'EQ' && Array.isArray(value)) fail('EQ_SCALAR_REQUIRED', path);
}

function normalizeConditions(value, path) {
  assertObject(value, path);
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => compareAscii(left, right))
      .map(([conditionKey, conditionValue]) => {
        if (!CONDITION_KEY_PATTERN.test(conditionKey)) {
          fail('INVALID_CONDITION_KEY', `${path}.${conditionKey}`);
        }
        return [
          conditionKey,
          normalizeCandidateValue(conditionValue, `${path}.${conditionKey}`),
        ];
      }),
  );
}

function normalizeCapabilityClaim(raw, index, documentByKey) {
  const path = `$.candidates.capabilityClaims[${index}]`;
  assertObject(raw, path);
  assertOnlyKeys(raw, new Set([
    'capabilityClaimId',
    'claimKey',
    'productFamilyId',
    'documentKey',
    'sourceSpan',
    'field',
    'operator',
    'value',
    'unit',
    'conditions',
    'sourceSupportState',
    'projectApplicability',
    'annotationOrigin',
    'limitations',
  ]), path);
  const claimKey = key(raw.claimKey, `${path}.claimKey`);
  const productFamilyId = text(raw.productFamilyId, `${path}.productFamilyId`);
  if (!GOLDEN_PRODUCT_FAMILY_IDS.includes(productFamilyId)) {
    fail('INVALID_PRODUCT_FAMILY', `${path}.productFamilyId`);
  }
  const document = documentByKey.get(text(raw.documentKey, `${path}.documentKey`));
  if (!document) fail('DANGLING_REFERENCE', `${path}.documentKey`);
  if (document.sourceClass !== 'CAPABILITY') fail('CAPABILITY_SOURCE_REQUIRED', `${path}.documentKey`);
  assertObject(raw.sourceSpan, `${path}.sourceSpan`);
  assertOnlyKeys(raw.sourceSpan, new Set(['excerptIndex', 'locator']), `${path}.sourceSpan`);
  const excerptIndex = raw.sourceSpan.excerptIndex;
  if (!Number.isInteger(excerptIndex) || excerptIndex < 0 || excerptIndex >= document.excerpts.length) {
    fail('INVALID_EXCERPT_INDEX', `${path}.sourceSpan.excerptIndex`);
  }
  const locator = text(raw.sourceSpan.locator, `${path}.sourceSpan.locator`);
  if (locator !== document.excerpts[excerptIndex].locator) {
    fail('SOURCE_SPAN_LOCATOR_MISMATCH', `${path}.sourceSpan.locator`);
  }
  const operator = text(raw.operator, `${path}.operator`);
  if (!OPERATORS.has(operator)) fail('INVALID_OPERATOR', `${path}.operator`);
  const sourceSupportState = text(raw.sourceSupportState, `${path}.sourceSupportState`);
  if (!SUPPORT_STATES.has(sourceSupportState)) fail('INVALID_SOURCE_SUPPORT_STATE', `${path}.sourceSupportState`);
  if (raw.projectApplicability !== 'UNVERIFIED_FOR_KR_PROJECT') {
    fail('PROJECT_APPLICABILITY_MUST_REMAIN_UNVERIFIED', `${path}.projectApplicability`);
  }
  const annotationOrigin = text(raw.annotationOrigin, `${path}.annotationOrigin`);
  if (!ANNOTATION_ORIGINS.has(annotationOrigin)) fail('INVALID_ANNOTATION_ORIGIN', `${path}.annotationOrigin`);
  const value = normalizeCandidateValue(raw.value, `${path}.value`);
  assertOperatorValue(operator, value, `${path}.value`);
  const normalized = {
    claimKey,
    productFamilyId,
    documentId: document.documentId,
    sourceSpan: { excerptIndex, locator },
    field: key(raw.field, `${path}.field`),
    operator,
    value,
    unit: optionalText(raw.unit, `${path}.unit`),
    conditions: normalizeConditions(raw.conditions, `${path}.conditions`),
    sourceSupportState,
    projectApplicability: 'UNVERIFIED_FOR_KR_PROJECT',
    annotationOrigin,
    limitations: uniqueSortedStrings(raw.limitations, `${path}.limitations`, { allowEmpty: false }),
  };
  return {
    capabilityClaimId: deriveId('cap', normalized, raw.capabilityClaimId, `${path}.capabilityClaimId`),
    ...normalized,
  };
}

function normalizePair(
  raw,
  index,
  projectByKey,
  claimByKey,
  documentByKey,
  supersededDocumentIds,
) {
  const path = `$.candidates.requirementCapabilityPairs[${index}]`;
  assertObject(raw, path);
  assertOnlyKeys(raw, new Set([
    'pairId',
    'pairKey',
    'projectKey',
    'capabilityClaimKey',
    'productFamilyId',
    'requirementEvidence',
    'annotationOrigin',
    'limitations',
  ]), path);
  const pairKey = key(raw.pairKey, `${path}.pairKey`);
  const project = projectByKey.get(text(raw.projectKey, `${path}.projectKey`));
  const claim = claimByKey.get(text(raw.capabilityClaimKey, `${path}.capabilityClaimKey`));
  if (!project) fail('DANGLING_REFERENCE', `${path}.projectKey`);
  if (!claim) fail('DANGLING_REFERENCE', `${path}.capabilityClaimKey`);
  const productFamilyId = text(raw.productFamilyId, `${path}.productFamilyId`);
  if (productFamilyId !== claim.productFamilyId) fail('PAIR_PRODUCT_FAMILY_MISMATCH', `${path}.productFamilyId`);
  assertObject(raw.requirementEvidence, `${path}.requirementEvidence`);
  assertOnlyKeys(raw.requirementEvidence, new Set([
    'documentKey',
    'excerptIndex',
    'locator',
    'field',
    'operator',
    'value',
    'unit',
    'conditions',
  ]), `${path}.requirementEvidence`);
  const documentKey = text(raw.requirementEvidence.documentKey, `${path}.requirementEvidence.documentKey`);
  const requirementDocument = documentByKey.get(documentKey);
  if (!requirementDocument) fail('DANGLING_REFERENCE', `${path}.requirementEvidence.documentKey`);
  if (
    requirementDocument.sourceClass !== 'PROJECT'
    || !project.documentIds.includes(requirementDocument.documentId)
  ) {
    fail('PAIR_REQUIREMENT_DOCUMENT_MUST_BELONG_TO_PROJECT', `${path}.requirementEvidence.documentKey`);
  }
  if (!PROJECT_SPECIFICATION_DOCUMENT_KINDS.has(requirementDocument.documentKind)) {
    fail('PAIR_REQUIREMENT_SPECIFICATION_DOCUMENT_REQUIRED', `${path}.requirementEvidence.documentKey`);
  }
  if (
    supersededDocumentIds.has(requirementDocument.documentId)
    || supersededDocumentIds.has(claim.documentId)
  ) {
    fail('SUPERSEDED_PAIR_EVIDENCE_REFUSED', path);
  }
  const excerptIndex = raw.requirementEvidence.excerptIndex;
  if (
    !Number.isInteger(excerptIndex)
    || excerptIndex < 0
    || excerptIndex >= requirementDocument.excerpts.length
  ) {
    fail('INVALID_EXCERPT_INDEX', `${path}.requirementEvidence.excerptIndex`);
  }
  const requirementLocator = text(
    raw.requirementEvidence.locator,
    `${path}.requirementEvidence.locator`,
  );
  if (requirementLocator !== requirementDocument.excerpts[excerptIndex].locator) {
    fail('SOURCE_SPAN_LOCATOR_MISMATCH', `${path}.requirementEvidence.locator`);
  }
  const requirementOperator = text(
    raw.requirementEvidence.operator,
    `${path}.requirementEvidence.operator`,
  );
  if (!OPERATORS.has(requirementOperator)) {
    fail('INVALID_OPERATOR', `${path}.requirementEvidence.operator`);
  }
  const requirementValue = normalizeCandidateValue(
    raw.requirementEvidence.value,
    `${path}.requirementEvidence.value`,
  );
  assertOperatorValue(
    requirementOperator,
    requirementValue,
    `${path}.requirementEvidence.value`,
  );
  const annotationOrigin = text(raw.annotationOrigin, `${path}.annotationOrigin`);
  if (!ANNOTATION_ORIGINS.has(annotationOrigin)) fail('INVALID_ANNOTATION_ORIGIN', `${path}.annotationOrigin`);
  const normalized = {
    pairKey,
    projectId: project.projectId,
    capabilityClaimId: claim.capabilityClaimId,
    productFamilyId,
    requirementEvidence: {
      documentId: requirementDocument.documentId,
      excerptIndex,
      locator: requirementLocator,
      field: key(raw.requirementEvidence.field, `${path}.requirementEvidence.field`),
      operator: requirementOperator,
      value: requirementValue,
      unit: optionalText(raw.requirementEvidence.unit, `${path}.requirementEvidence.unit`),
      conditions: normalizeConditions(raw.requirementEvidence.conditions, `${path}.requirementEvidence.conditions`),
    },
    sourceSpanRefs: [
      `${requirementDocument.documentId}#excerpt:${excerptIndex}`,
      `${claim.documentId}#excerpt:${claim.sourceSpan.excerptIndex}`,
    ].sort(compareAscii),
    annotationOrigin,
    limitations: uniqueSortedStrings(raw.limitations, `${path}.limitations`, { allowEmpty: false }),
  };
  return {
    pairId: deriveId('pair', normalized, raw.pairId, `${path}.pairId`),
    ...normalized,
  };
}

function normalizeCandidates(raw) {
  assertObject(raw, '$.candidates');
  assertSafeArtifact(raw, '$.candidates');
  assertCandidateAuthoritySeparation(raw);
  assertOnlyKeys(raw, new Set([
    'schemaVersion',
    'boundary',
    'productionReady',
    'evaluationAsOf',
    'scope',
    'documents',
    'projects',
    'capabilityClaims',
    'requirementCapabilityPairs',
  ]), '$.candidates');
  if (raw.schemaVersion !== GOLDEN_CANDIDATE_SCHEMA_VERSION) fail('UNSUPPORTED_CANDIDATE_SCHEMA', '$.candidates.schemaVersion');
  if (raw.boundary !== GOLDEN_CANDIDATE_BOUNDARY) fail('INVALID_CANDIDATE_BOUNDARY', '$.candidates.boundary');
  if (raw.productionReady !== false) fail('PRODUCTION_READY_MUST_BE_FALSE', '$.candidates.productionReady');
  const evaluationAsOf = isoTimestamp(raw.evaluationAsOf, '$.candidates.evaluationAsOf');
  assertObject(raw.scope, '$.candidates.scope');
  assertOnlyKeys(
    raw.scope,
    new Set(['verticalId', 'jurisdiction', 'productFamilyIds']),
    '$.candidates.scope',
  );
  const scope = {
    verticalId: text(raw.scope.verticalId, '$.candidates.scope.verticalId'),
    jurisdiction: text(raw.scope.jurisdiction, '$.candidates.scope.jurisdiction'),
    productFamilyIds: assertExactProductFamilies(
      raw.scope.productFamilyIds,
      '$.candidates.scope.productFamilyIds',
    ),
  };
  if (scope.verticalId !== 'datacenter_infrastructure') fail('INVALID_VERTICAL', '$.candidates.scope.verticalId');
  if (scope.jurisdiction !== 'KR') fail('INVALID_JURISDICTION', '$.candidates.scope.jurisdiction');

  const documents = assertArray(raw.documents, '$.candidates.documents', { allowEmpty: false })
    .map((document, index) => normalizeDocument(document, index, evaluationAsOf));
  assertUniqueBy(documents, 'documentKey', '$.candidates.documents');
  assertUniqueBy(documents, 'documentId', '$.candidates.documents');
  assertRevisionGraph(documents);
  const documentByKey = new Map(documents.map((document) => [document.documentKey, document]));
  const supersededDocumentIds = new Set(
    documents
      .map((document) => document.revision.supersedesDocumentKey)
      .filter(Boolean)
      .map((documentKey) => documentByKey.get(documentKey).documentId),
  );

  const projects = assertArray(raw.projects, '$.candidates.projects', { allowEmpty: false })
    .map((project, index) => normalizeProject(
      project,
      index,
      evaluationAsOf,
      documentByKey,
      supersededDocumentIds,
    ));
  assertUniqueBy(projects, 'projectKey', '$.candidates.projects');
  assertUniqueBy(projects, 'projectId', '$.candidates.projects');
  const projectByKey = new Map(projects.map((project) => [project.projectKey, project]));

  const capabilityClaims = assertArray(raw.capabilityClaims, '$.candidates.capabilityClaims', { allowEmpty: false })
    .map((claim, index) => normalizeCapabilityClaim(claim, index, documentByKey));
  assertUniqueBy(capabilityClaims, 'claimKey', '$.candidates.capabilityClaims');
  assertUniqueBy(capabilityClaims, 'capabilityClaimId', '$.candidates.capabilityClaims');
  const claimByKey = new Map(capabilityClaims.map((claim) => [claim.claimKey, claim]));

  const requirementCapabilityPairs = assertArray(
    raw.requirementCapabilityPairs,
    '$.candidates.requirementCapabilityPairs',
  ).map((pair, index) => normalizePair(
    pair,
    index,
    projectByKey,
    claimByKey,
    documentByKey,
    supersededDocumentIds,
  ));
  assertUniqueBy(requirementCapabilityPairs, 'pairKey', '$.candidates.requirementCapabilityPairs');
  assertUniqueBy(requirementCapabilityPairs, 'pairId', '$.candidates.requirementCapabilityPairs');

  return {
    schemaVersion: GOLDEN_CANDIDATE_SCHEMA_VERSION,
    boundary: GOLDEN_CANDIDATE_BOUNDARY,
    productionReady: false,
    evaluationAsOf,
    scope,
    documents: documents.sort((left, right) => compareAscii(left.documentKey, right.documentKey)),
    projects: projects.sort((left, right) => compareAscii(left.projectKey, right.projectKey)),
    capabilityClaims: capabilityClaims.sort((left, right) => compareAscii(left.claimKey, right.claimKey)),
    requirementCapabilityPairs: requirementCapabilityPairs
      .sort((left, right) => compareAscii(left.pairKey, right.pairKey)),
  };
}

function normalizeReviewEnvelope(raw, path, asOf) {
  assertObject(raw, path);
  if (raw.reviewAuthority !== 'HUMAN_DOMAIN_REVIEW') fail('HUMAN_DOMAIN_REVIEW_REQUIRED', `${path}.reviewAuthority`);
  const reviewReceipt = text(raw.reviewReceipt, `${path}.reviewReceipt`);
  if (!REVIEW_RECEIPT_PATTERN.test(reviewReceipt)) {
    fail('INVALID_REVIEW_RECEIPT', `${path}.reviewReceipt`);
  }
  const reviewedAt = isoTimestamp(raw.reviewedAt, `${path}.reviewedAt`);
  if (reviewedAt < asOf) {
    fail('REVIEW_PRECEDES_EVALUATION_AS_OF', `${path}.reviewedAt`);
  }
  if (reviewedAt > new Date().toISOString()) {
    fail('FUTURE_REVIEW_TIMESTAMP_REFUSED', `${path}.reviewedAt`);
  }
  return {
    reviewAuthority: 'HUMAN_DOMAIN_REVIEW',
    reviewReceipt,
    reviewedAt,
  };
}

function normalizeProjectAdjudication(raw, index, asOf, candidateIndexes) {
  const path = `$.adjudications.projectAdjudications[${index}]`;
  assertObject(raw, path);
  assertOnlyKeys(raw, new Set([
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
  ]), path);
  const review = normalizeReviewEnvelope(raw, path, asOf);
  const project = candidateIndexes.projectByKey.get(text(raw.projectKey, `${path}.projectKey`));
  if (!project) fail('DANGLING_HUMAN_ADJUDICATION', `${path}.projectKey`);
  if (raw.identityStatus !== 'CONFIRMED') fail('CONFIRMED_IDENTITY_REQUIRED', `${path}.identityStatus`);
  const currentStage = text(raw.currentStage, `${path}.currentStage`);
  if (!GOLDEN_PROJECT_STAGES.includes(currentStage)) fail('INVALID_PROJECT_STAGE', `${path}.currentStage`);
  const appliedDocuments = resolveKeys(
    raw.appliedSpecificationDocumentKeys,
    candidateIndexes.documentByKey,
    `${path}.appliedSpecificationDocumentKeys`,
    { allowEmpty: true },
  );
  if (
    appliedDocuments.some((document) => (
      document.sourceClass !== 'PROJECT'
      || !project.documentIds.includes(document.documentId)
      || !PROJECT_SPECIFICATION_DOCUMENT_KINDS.has(document.documentKind)
    ))
  ) {
    fail(
      'APPLIED_SPECIFICATION_DOCUMENT_MUST_BELONG_TO_PROJECT',
      `${path}.appliedSpecificationDocumentKeys`,
    );
  }
  if (
    appliedDocuments.some((document) => (
      candidateIndexes.supersededDocumentIds.has(document.documentId)
    ))
  ) {
    fail(
      'SUPERSEDED_APPLIED_SPECIFICATION_REFUSED',
      `${path}.appliedSpecificationDocumentKeys`,
    );
  }
  const productFitByFamily = assertArray(
    raw.productFitByFamily,
    `${path}.productFitByFamily`,
    { allowEmpty: false },
  ).map((fit, fitIndex) => {
    const fitPath = `${path}.productFitByFamily[${fitIndex}]`;
    assertObject(fit, fitPath);
    assertOnlyKeys(fit, new Set(['productFamilyId', 'fitResult']), fitPath);
    const productFamilyId = text(fit.productFamilyId, `${fitPath}.productFamilyId`);
    if (!GOLDEN_PRODUCT_FAMILY_IDS.includes(productFamilyId)) {
      fail('INVALID_PRODUCT_FAMILY', `${fitPath}.productFamilyId`);
    }
    const fitResult = text(fit.fitResult, `${fitPath}.fitResult`);
    if (!PROJECT_FIT_RESULTS.has(fitResult)) fail('INVALID_PROJECT_FIT_RESULT', `${fitPath}.fitResult`);
    return { productFamilyId, fitResult };
  }).sort((left, right) => compareAscii(left.productFamilyId, right.productFamilyId));
  if (canonicalStringify(productFitByFamily.map((fit) => fit.productFamilyId)) !== canonicalStringify([...GOLDEN_PRODUCT_FAMILY_IDS].sort(compareAscii))) {
    fail('EXACT_TWO_PRODUCT_FAMILY_FITS_REQUIRED', `${path}.productFitByFamily`);
  }
  assertObject(raw.specificationWindow, `${path}.specificationWindow`);
  assertOnlyKeys(
    raw.specificationWindow,
    new Set(['state', 'rationale']),
    `${path}.specificationWindow`,
  );
  const specificationWindowState = text(raw.specificationWindow.state, `${path}.specificationWindow.state`);
  if (!SPECIFICATION_WINDOW_STATES.has(specificationWindowState)) {
    fail('INVALID_SPECIFICATION_WINDOW_STATE', `${path}.specificationWindow.state`);
  }
  const finalPursuitDecision = text(raw.finalPursuitDecision, `${path}.finalPursuitDecision`);
  if (!FINAL_PURSUIT_DECISIONS.has(finalPursuitDecision)) {
    fail('INVALID_FINAL_PURSUIT_DECISION', `${path}.finalPursuitDecision`);
  }
  const blockingEvidence = uniqueSortedStrings(
    raw.blockingEvidence,
    `${path}.blockingEvidence`,
  );
  if (
    appliedDocuments.length === 0
    && (
      productFitByFamily.some((fit) => fit.fitResult !== 'INSUFFICIENT_EVIDENCE')
      || finalPursuitDecision === 'PURSUE'
      || blockingEvidence.length === 0
    )
  ) {
    fail(
      'NO_SPECIFICATION_REQUIRES_HOLD_AND_INSUFFICIENT_EVIDENCE',
      `${path}.appliedSpecificationDocumentKeys`,
    );
  }
  return {
    projectKey: project.projectKey,
    projectId: project.projectId,
    ...review,
    identityStatus: 'CONFIRMED',
    currentStage,
    appliedSpecificationDocumentIds: appliedDocuments.map((document) => document.documentId).sort(compareAscii),
    productFitByFamily,
    blockingEvidence,
    specificationWindow: {
      state: specificationWindowState,
      rationale: text(raw.specificationWindow.rationale, `${path}.specificationWindow.rationale`),
    },
    finalPursuitDecision,
  };
}

function normalizeCapabilityAdjudication(raw, index, asOf, candidateIndexes) {
  const path = `$.adjudications.capabilityAdjudications[${index}]`;
  assertObject(raw, path);
  assertOnlyKeys(raw, new Set([
    'claimKey',
    'reviewAuthority',
    'reviewReceipt',
    'reviewedAt',
    'label',
    'reasonCodes',
    'sourceSpans',
  ]), path);
  const review = normalizeReviewEnvelope(raw, path, asOf);
  const claim = candidateIndexes.claimByKey.get(text(raw.claimKey, `${path}.claimKey`));
  if (!claim) fail('DANGLING_HUMAN_ADJUDICATION', `${path}.claimKey`);
  const label = text(raw.label, `${path}.label`);
  if (!CAPABILITY_LABELS.has(label)) fail('INVALID_CAPABILITY_LABEL', `${path}.label`);
  if (
    candidateIndexes.supersededDocumentIds.has(claim.documentId)
    && label !== 'REJECTED'
  ) {
    fail('SUPERSEDED_CAPABILITY_SUPPORT_REFUSED', `${path}.label`);
  }
  const expectedSourceSpans = [
    `${claim.documentId}#excerpt:${claim.sourceSpan.excerptIndex}`,
  ];
  const sourceSpans = uniqueSortedStrings(
    raw.sourceSpans,
    `${path}.sourceSpans`,
    { allowEmpty: false },
  );
  if (canonicalStringify(sourceSpans) !== canonicalStringify(expectedSourceSpans)) {
    fail('CAPABILITY_ADJUDICATION_SOURCE_SPANS_MISMATCH', `${path}.sourceSpans`);
  }
  return {
    claimKey: claim.claimKey,
    capabilityClaimId: claim.capabilityClaimId,
    ...review,
    label,
    reasonCodes: uniqueSortedStrings(raw.reasonCodes, `${path}.reasonCodes`, { allowEmpty: false }).map((reasonCode) => {
      if (!REASON_CODE_PATTERN.test(reasonCode)) fail('INVALID_REASON_CODE', `${path}.reasonCodes`);
      return reasonCode;
    }),
    sourceSpans,
  };
}

function normalizePairAdjudication(raw, index, asOf, candidateIndexes) {
  const path = `$.adjudications.pairAdjudications[${index}]`;
  assertObject(raw, path);
  assertOnlyKeys(raw, new Set([
    'pairKey',
    'reviewAuthority',
    'reviewReceipt',
    'reviewedAt',
    'label',
    'reasonCodes',
    'sourceSpans',
  ]), path);
  const review = normalizeReviewEnvelope(raw, path, asOf);
  const pair = candidateIndexes.pairByKey.get(text(raw.pairKey, `${path}.pairKey`));
  if (!pair) fail('DANGLING_HUMAN_ADJUDICATION', `${path}.pairKey`);
  const label = text(raw.label, `${path}.label`);
  if (!PAIR_LABELS.has(label)) fail('INVALID_PAIR_LABEL', `${path}.label`);
  const sourceSpans = uniqueSortedStrings(
    raw.sourceSpans,
    `${path}.sourceSpans`,
    { allowEmpty: false },
  );
  if (canonicalStringify(sourceSpans) !== canonicalStringify(pair.sourceSpanRefs)) {
    fail('PAIR_ADJUDICATION_SOURCE_SPANS_MISMATCH', `${path}.sourceSpans`);
  }
  return {
    pairKey: pair.pairKey,
    pairId: pair.pairId,
    ...review,
    label,
    reasonCodes: uniqueSortedStrings(raw.reasonCodes, `${path}.reasonCodes`, { allowEmpty: false }).map((reasonCode) => {
      if (!REASON_CODE_PATTERN.test(reasonCode)) fail('INVALID_REASON_CODE', `${path}.reasonCodes`);
      return reasonCode;
    }),
    sourceSpans,
  };
}

function normalizeRevisionAdjudication(raw, index, asOf, candidateIndexes) {
  const path = `$.adjudications.revisionAdjudications[${index}]`;
  assertObject(raw, path);
  assertOnlyKeys(raw, new Set([
    'documentKey',
    'supersedesDocumentKey',
    'reviewAuthority',
    'reviewReceipt',
    'reviewedAt',
    'relationshipStatus',
    'reasonCodes',
    'sourceSpans',
  ]), path);
  const review = normalizeReviewEnvelope(raw, path, asOf);
  const document = candidateIndexes.documentByKey.get(text(
    raw.documentKey,
    `${path}.documentKey`,
  ));
  const supersededDocument = candidateIndexes.documentByKey.get(text(
    raw.supersedesDocumentKey,
    `${path}.supersedesDocumentKey`,
  ));
  if (!document || !supersededDocument) {
    fail('DANGLING_HUMAN_ADJUDICATION', path);
  }
  if (
    document.revision.supersedesDocumentKey !== supersededDocument.documentKey
    || document.revision.seriesKey !== supersededDocument.revision.seriesKey
  ) {
    fail('REVISION_ADJUDICATION_EDGE_MISMATCH', path);
  }
  if (raw.relationshipStatus !== 'CONFIRMED_SUPERSESSION') {
    fail('CONFIRMED_SUPERSESSION_REQUIRED', `${path}.relationshipStatus`);
  }
  const expectedSourceSpans = [
    `${document.documentId}#excerpt:0`,
    `${supersededDocument.documentId}#excerpt:0`,
  ].sort(compareAscii);
  const sourceSpans = uniqueSortedStrings(
    raw.sourceSpans,
    `${path}.sourceSpans`,
    { allowEmpty: false },
  );
  if (canonicalStringify(sourceSpans) !== canonicalStringify(expectedSourceSpans)) {
    fail('REVISION_ADJUDICATION_SOURCE_SPANS_MISMATCH', `${path}.sourceSpans`);
  }
  return {
    documentKey: document.documentKey,
    documentId: document.documentId,
    supersedesDocumentKey: supersededDocument.documentKey,
    supersedesDocumentId: supersededDocument.documentId,
    seriesKey: document.revision.seriesKey,
    ...review,
    relationshipStatus: 'CONFIRMED_SUPERSESSION',
    reasonCodes: uniqueSortedStrings(
      raw.reasonCodes,
      `${path}.reasonCodes`,
      { allowEmpty: false },
    ).map((reasonCode) => {
      if (!REASON_CODE_PATTERN.test(reasonCode)) {
        fail('INVALID_REASON_CODE', `${path}.reasonCodes`);
      }
      return reasonCode;
    }),
    sourceSpans,
  };
}

function normalizeAdjudications(raw, candidates) {
  assertObject(raw, '$.adjudications');
  assertSafeArtifact(raw, '$.adjudications');
  assertHumanOriginSeparation(raw);
  assertOnlyKeys(raw, new Set([
    'schemaVersion',
    'boundary',
    'productionReady',
    'evaluationAsOf',
    'projectAdjudications',
    'capabilityAdjudications',
    'pairAdjudications',
    'revisionAdjudications',
  ]), '$.adjudications');
  if (raw.schemaVersion !== GOLDEN_ADJUDICATION_SCHEMA_VERSION) {
    fail('UNSUPPORTED_ADJUDICATION_SCHEMA', '$.adjudications.schemaVersion');
  }
  if (raw.boundary !== GOLDEN_ADJUDICATION_BOUNDARY) {
    fail('INVALID_ADJUDICATION_BOUNDARY', '$.adjudications.boundary');
  }
  if (raw.productionReady !== false) fail('PRODUCTION_READY_MUST_BE_FALSE', '$.adjudications.productionReady');
  const evaluationAsOf = isoTimestamp(raw.evaluationAsOf, '$.adjudications.evaluationAsOf');
  if (evaluationAsOf !== candidates.evaluationAsOf) {
    fail('EVALUATION_AS_OF_MISMATCH', '$.adjudications.evaluationAsOf');
  }
  const candidateIndexes = {
    documentByKey: new Map(candidates.documents.map((document) => [document.documentKey, document])),
    projectByKey: new Map(candidates.projects.map((project) => [project.projectKey, project])),
    claimByKey: new Map(candidates.capabilityClaims.map((claim) => [claim.claimKey, claim])),
    pairByKey: new Map(candidates.requirementCapabilityPairs.map((pair) => [pair.pairKey, pair])),
    supersededDocumentIds: new Set(
      candidates.documents
        .map((document) => document.revision.supersedesDocumentKey)
        .filter(Boolean)
        .map((documentKey) => (
          candidates.documents.find((document) => document.documentKey === documentKey).documentId
        )),
    ),
  };
  const projectAdjudications = assertArray(
    raw.projectAdjudications,
    '$.adjudications.projectAdjudications',
  ).map((record, index) => normalizeProjectAdjudication(record, index, evaluationAsOf, candidateIndexes));
  const capabilityAdjudications = assertArray(
    raw.capabilityAdjudications,
    '$.adjudications.capabilityAdjudications',
  ).map((record, index) => normalizeCapabilityAdjudication(record, index, evaluationAsOf, candidateIndexes));
  const pairAdjudications = assertArray(
    raw.pairAdjudications,
    '$.adjudications.pairAdjudications',
  ).map((record, index) => normalizePairAdjudication(record, index, evaluationAsOf, candidateIndexes));
  const revisionAdjudications = assertArray(
    raw.revisionAdjudications,
    '$.adjudications.revisionAdjudications',
  ).map((record, index) => normalizeRevisionAdjudication(
    record,
    index,
    evaluationAsOf,
    candidateIndexes,
  ));
  assertUniqueBy(projectAdjudications, 'projectKey', '$.adjudications.projectAdjudications');
  assertUniqueBy(capabilityAdjudications, 'claimKey', '$.adjudications.capabilityAdjudications');
  assertUniqueBy(pairAdjudications, 'pairKey', '$.adjudications.pairAdjudications');
  assertUniqueBy(
    revisionAdjudications,
    'documentKey',
    '$.adjudications.revisionAdjudications',
  );
  return {
    schemaVersion: GOLDEN_ADJUDICATION_SCHEMA_VERSION,
    boundary: GOLDEN_ADJUDICATION_BOUNDARY,
    productionReady: false,
    evaluationAsOf,
    projectAdjudications: projectAdjudications.sort((left, right) => compareAscii(left.projectKey, right.projectKey)),
    capabilityAdjudications: capabilityAdjudications.sort((left, right) => compareAscii(left.claimKey, right.claimKey)),
    pairAdjudications: pairAdjudications.sort((left, right) => compareAscii(left.pairKey, right.pairKey)),
    revisionAdjudications: revisionAdjudications
      .sort((left, right) => compareAscii(left.documentKey, right.documentKey)),
  };
}

function gap(id, actual, required, unit = 'count') {
  return { id, actual, required, missing: Math.max(0, required - actual), unit };
}

function buildReadiness(candidates, adjudications) {
  const revisionLinkCandidateCount = candidates.documents.filter((document) => (
    document.revision.supersedesDocumentKey !== null
  )).length;
  const humanConfirmedStages = new Set(adjudications.projectAdjudications.map((record) => record.currentStage));
  const counts = {
    projectCandidateCount: candidates.projects.length,
    publicSourceDocumentCandidateCount: candidates.documents.length,
    capabilityClaimCandidateCount: candidates.capabilityClaims.length,
    requirementCapabilityPairCandidateCount: candidates.requirementCapabilityPairs.length,
    productFamilyCount: candidates.scope.productFamilyIds.length,
    candidateStageCount: new Set(candidates.projects.map((project) => project.stageObservation.stage)).size,
    revisionLinkCandidateCount,
    humanConfirmedProjectCount: adjudications.projectAdjudications.length,
    humanConfirmedCapabilityClaimCount: adjudications.capabilityAdjudications.length,
    humanConfirmedPairCount: adjudications.pairAdjudications.length,
    humanConfirmedRevisionLinkCount: adjudications.revisionAdjudications.length,
    humanConfirmedStageCount: humanConfirmedStages.size,
    pendingProjectCount: candidates.projects.length - adjudications.projectAdjudications.length,
    pendingCapabilityClaimCount: candidates.capabilityClaims.length - adjudications.capabilityAdjudications.length,
    pendingPairCount: candidates.requirementCapabilityPairs.length - adjudications.pairAdjudications.length,
    pendingRevisionLinkCount: revisionLinkCandidateCount - adjudications.revisionAdjudications.length,
    provisionalLabelLeakage: 0,
  };
  const thresholdGaps = [
    gap('human_confirmed_projects', counts.humanConfirmedProjectCount, GOLDEN_READINESS_THRESHOLDS.humanConfirmedProjects),
    gap('public_source_documents', counts.publicSourceDocumentCandidateCount, GOLDEN_READINESS_THRESHOLDS.publicSourceDocuments),
    gap('capability_claim_candidates', counts.capabilityClaimCandidateCount, GOLDEN_READINESS_THRESHOLDS.capabilityClaims),
    gap('human_confirmed_capability_claims', counts.humanConfirmedCapabilityClaimCount, GOLDEN_READINESS_THRESHOLDS.humanConfirmedCapabilityClaims),
    gap('requirement_capability_pairs', counts.requirementCapabilityPairCandidateCount, GOLDEN_READINESS_THRESHOLDS.requirementCapabilityPairs),
    gap('product_families', counts.productFamilyCount, GOLDEN_READINESS_THRESHOLDS.productFamilies),
    gap('human_confirmed_stages', counts.humanConfirmedStageCount, GOLDEN_READINESS_THRESHOLDS.humanConfirmedStages),
    gap('human_confirmed_revision_links', counts.humanConfirmedRevisionLinkCount, GOLDEN_READINESS_THRESHOLDS.revisionLinks),
    gap('project_adjudication_coverage', counts.humanConfirmedProjectCount, counts.projectCandidateCount),
    gap('capability_adjudication_coverage', counts.humanConfirmedCapabilityClaimCount, counts.capabilityClaimCandidateCount),
    gap('pair_adjudication_coverage', counts.humanConfirmedPairCount, Math.max(
      counts.requirementCapabilityPairCandidateCount,
      GOLDEN_READINESS_THRESHOLDS.requirementCapabilityPairs,
    )),
    gap(
      'revision_adjudication_coverage',
      counts.humanConfirmedRevisionLinkCount,
      Math.max(counts.revisionLinkCandidateCount, GOLDEN_READINESS_THRESHOLDS.revisionLinks),
    ),
  ].filter((item) => item.missing > 0);
  return { counts, thresholdGaps, goldenReady: thresholdGaps.length === 0 };
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

export function createValidatedGoldenDataset(rawCandidates, rawAdjudications) {
  const candidates = normalizeCandidates(rawCandidates);
  const adjudications = normalizeAdjudications(rawAdjudications, candidates);
  const readiness = buildReadiness(candidates, adjudications);
  const datasetState = adjudications.projectAdjudications.length === 0
    && adjudications.capabilityAdjudications.length === 0
    && adjudications.pairAdjudications.length === 0
    && adjudications.revisionAdjudications.length === 0
    ? 'CANDIDATE_INTAKE'
    : readiness.goldenReady
      ? 'HUMAN_CONFIRMED'
      : 'PARTIALLY_ADJUDICATED';
  const canonicalPayload = { candidates, adjudications };
  const dataset = deepFreeze({
    candidates,
    adjudications,
    datasetState,
    goldenReady: readiness.goldenReady,
    summary: {
      ...readiness.counts,
      thresholdGaps: readiness.thresholdGaps,
    },
    canonicalSha256: sha256(canonicalStringify(canonicalPayload)),
  });
  VALIDATED_GOLDEN_DATASETS.add(dataset);
  return dataset;
}

export function buildGoldenDatasetAuditReport(dataset) {
  if (!VALIDATED_GOLDEN_DATASETS.has(dataset)) {
    fail('UNVALIDATED_GOLDEN_DATASET_REFUSED', '$.dataset');
  }
  const reportWithoutHash = {
    documentStatus: 'PURSUIT_GOLDEN_DATASET_AUDIT_PASS',
    schemaVersion: GOLDEN_AUDIT_SCHEMA_VERSION,
    boundary: GOLDEN_AUDIT_BOUNDARY,
    productionReady: false,
    goldenReady: dataset.goldenReady,
    datasetState: dataset.datasetState,
    evaluationAsOf: dataset.candidates.evaluationAsOf,
    summary: dataset.summary,
    violations: [],
    nonClaims: [
      'Officiality, reachability, and currentness of remote source URLs are candidates for human confirmation; this offline audit does not verify them.',
      'AI-assisted project stages and capability extractions are not human labels, product fit, procurement status, or final pursuit decisions.',
      'Review receipts are repository assertions; this audit does not authenticate reviewer identity or prove human participation.',
      'This audit does not access production, customer data, private documents, endpoints, D1, logs, secrets, CRM, outreach, or LLM services.',
    ],
    datasetCanonicalSha256: dataset.canonicalSha256,
  };
  return deepFreeze({
    ...reportWithoutHash,
    canonicalSha256: sha256(canonicalStringify(reportWithoutHash)),
  });
}
