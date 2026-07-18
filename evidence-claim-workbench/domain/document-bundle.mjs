import {
  assertSafeArtifact,
  canonicalStringify,
  normalizeEvidenceUrl,
  sha256
} from '../../knowledge/claim-registry/index.mjs';
import {
  DOCUMENT_ID_PATTERN,
  EVIDENCE_DOCUMENT_LIMITS,
  NON_PRODUCTION_BOUNDARY,
  OFFICIAL_EVIDENCE_SCOPE,
  PAGE_TEXT_NORMALIZATION_VERSION,
  REDISTRIBUTION_STATUSES,
  SAFE_IDENTIFIER_PATTERN,
  SHA256_HEX_PATTERN,
  SOURCE_AUTHENTICITY_STATUS,
  SOURCE_CLASSES,
  SOURCE_DOCUMENT_BUNDLE_SCHEMA_VERSION,
  SOURCE_DOCUMENT_CATALOG_SCHEMA_VERSION,
  SOURCE_DOCUMENT_MIME_TYPE,
  SOURCE_DOCUMENT_TYPE,
  SOURCE_EXTRACTION_METHOD
} from './constants.mjs';
import {
  EvidenceWorkbenchValidationError,
  assertExactKeys,
  assertPlainObject,
  assertSafeMetadata,
  compareAscii,
  deepFreeze,
  fail
} from './errors.mjs';

const PAGE_LOCATOR_TYPES = Object.freeze(['DOCUMENT_PAGE', 'PRINTED_PAGE', 'SECTION']);
const FORBIDDEN_PAGE_CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069]/u;
const SECRET_SHAPED_VALUE = /(?:bearer\s+[a-z0-9._~+\/-]{16,}|gh[oprsu]_[a-z0-9]{20,}|sk-[a-z0-9_-]{20,}|AIza[a-z0-9_-]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:password|passwd|token|api[_-]?key|secret)\s*[:=]\s*[^\s]{8,})/i;
const PRIVATE_DATA_SHAPED_VALUE = /(?:\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b|(?:\+?82[- .]?)?0\d{1,2}[- .]\d{3,4}[- .]\d{4})/i;
const ABSOLUTE_LOCAL_PATH = /(?:\bfile:(?:\/{1,3}|\\+)|(?:^|[\s"'(=:\[\{])(?:\/(?!\/)|[A-Za-z]:[\\/]|\\\\)|(?:^|[\s"'(=\[\{])\/\/[^/\s])/iu;
const VALIDATED_SOURCE_DOCUMENTS = new WeakSet();

const VALIDATION_STAGE_STATUS = Object.freeze({
  NOT_EVALUATED: 'NOT_EVALUATED',
  FAILED: 'FAILED',
  PASSED: 'PASSED'
});

function setValidationStage(stageState, stage, status) {
  if (stageState) stageState[stage] = status;
}

function hasLoneSurrogate(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }
  return false;
}

function safetyRepresentations(value, path) {
  const representations = [];
  let representation = value;
  for (let depth = 0; ; depth += 1) {
    for (const form of [representation, representation.normalize('NFKC')]) {
      if (!representations.includes(form)) representations.push(form);
    }
    if (!/%[0-9a-f]{2}/iu.test(representation)) break;
    if (depth === 4) fail('PERCENT_ENCODING_DEPTH_REFUSED', path);
    try {
      representation = decodeURIComponent(representation);
    } catch {
      fail('MALFORMED_PERCENT_ENCODING_REFUSED', path);
    }
  }
  return representations;
}

function assertNoSecretOrPrivateData(value, path) {
  const representations = safetyRepresentations(value, path);
  if (representations.some((representation) => SECRET_SHAPED_VALUE.test(representation))) fail('SECRET_SHAPED_VALUE', path);
  if (representations.some((representation) => PRIVATE_DATA_SHAPED_VALUE.test(representation))) fail('PRIVATE_DATA_SHAPED_VALUE', path);
  if (representations.some((representation) => ABSOLUTE_LOCAL_PATH.test(representation))) fail('LOCAL_ABSOLUTE_PATH_REFUSED', path);
}

export function countCodePoints(value) {
  return [...value].length;
}

export function normalizePageText(value, path = '$.text') {
  if (typeof value !== 'string') fail('PAGE_TEXT_STRING_REQUIRED', path);
  if (hasLoneSurrogate(value)) fail('INVALID_UNICODE_SCALAR', path);
  const normalized = value.replace(/\r\n?/g, '\n').normalize('NFC');
  if (FORBIDDEN_PAGE_CONTROL.test(normalized)) fail('CONTROL_CHARACTER_REFUSED', path);
  assertNoSecretOrPrivateData(normalized, path);
  const length = countCodePoints(normalized);
  if (length > EVIDENCE_DOCUMENT_LIMITS.maxPageCodePoints) fail('PAGE_TEXT_TOO_LONG', path);
  return normalized;
}

function normalizeMetadataText(value, path, maximumCodePoints) {
  if (typeof value !== 'string') fail('NONEMPTY_STRING_REQUIRED', path);
  if (hasLoneSurrogate(value)) fail('INVALID_UNICODE_SCALAR', path);
  const normalized = value.normalize('NFC').replace(/\s+/gu, ' ').trim();
  if (!normalized) fail('NONEMPTY_STRING_REQUIRED', path);
  if (countCodePoints(normalized) > maximumCodePoints) fail('STRING_TOO_LONG', path);
  assertNoSecretOrPrivateData(normalized, path);
  assertSafeMetadata(normalized, path);
  return normalized;
}

function normalizeIdentifier(value, path) {
  const normalized = normalizeMetadataText(value, path, EVIDENCE_DOCUMENT_LIMITS.maxIdentifierCodePoints).toLowerCase();
  if (!SAFE_IDENTIFIER_PATTERN.test(normalized)) fail('INVALID_IDENTIFIER', path);
  return normalized;
}

function normalizeAsOf(value, path = '$.asOf') {
  if (typeof value !== 'string') fail('FIXED_AS_OF_REQUIRED', path);
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) fail('INVALID_AS_OF', path);
  return value;
}

function normalizeTimestamp(value, path, asOf) {
  if (typeof value !== 'string') fail('INVALID_ISO_TIMESTAMP', path);
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) fail('INVALID_ISO_TIMESTAMP', path);
  if (value > asOf) fail('FUTURE_DOCUMENT_DATE', path);
  return value;
}

function normalizeOptionalTimestamp(value, path, asOf) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') fail('INVALID_ISO_TIMESTAMP', path);
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) fail('INVALID_ISO_TIMESTAMP', path);
  return value;
}

function normalizeSource(raw, { synthetic, path, stageState }) {
  assertPlainObject(raw, path, 'SOURCE_METADATA_REQUIRED');
  if (!Object.hasOwn(raw, 'documentNumber')) fail('DOCUMENT_NUMBER_REQUIRED', `${path}.documentNumber`);
  if (!Object.hasOwn(raw, 'redistributionStatus')) fail('REDISTRIBUTION_STATUS_REQUIRED', `${path}.redistributionStatus`);
  assertExactKeys(raw, {
    required: [
      'sourceClass',
      'publisher',
      'title',
      'documentNumber',
      'sourceUrl',
      'documentType',
      'mimeType',
      'language',
      'vertical',
      'jurisdiction',
      'domain',
      'productFamilies',
      'authenticityStatus',
      'redistributionStatus'
    ]
  }, path);

  if (raw.documentType === 'PDF' || raw.mimeType === 'application/pdf') {
    fail('RAW_PDF_PARSER_UNAVAILABLE', `${path}.documentType`);
  }
  if (raw.documentType !== SOURCE_DOCUMENT_TYPE) fail('UNSUPPORTED_DOCUMENT_TYPE', `${path}.documentType`);
  if (raw.mimeType !== SOURCE_DOCUMENT_MIME_TYPE) fail('UNSUPPORTED_DOCUMENT_MIME_TYPE', `${path}.mimeType`);
  if (!SOURCE_CLASSES.includes(raw.sourceClass)) fail('UNSUPPORTED_SOURCE_CLASS', `${path}.sourceClass`);
  if (synthetic !== (raw.sourceClass === 'SYNTHETIC_FIXTURE')) fail('SOURCE_CLASS_MODE_MISMATCH', `${path}.sourceClass`);
  if (raw.authenticityStatus !== SOURCE_AUTHENTICITY_STATUS) fail('SOURCE_AUTHENTICITY_MUST_BE_UNREVIEWED', `${path}.authenticityStatus`);
  if (!REDISTRIBUTION_STATUSES.includes(raw.redistributionStatus)) fail('INVALID_REDISTRIBUTION_STATUS', `${path}.redistributionStatus`);
  const expectedRedistributionStatus = synthetic
    ? 'SYNTHETIC_FIXTURE_REDISTRIBUTION_PERMITTED'
    : 'METADATA_AND_BOUNDED_EXCERPTS_ONLY';
  if (raw.redistributionStatus !== expectedRedistributionStatus) fail('REDISTRIBUTION_STATUS_MODE_MISMATCH', `${path}.redistributionStatus`);
  if (!OFFICIAL_EVIDENCE_SCOPE.languages.includes(raw.language)) fail('UNSUPPORTED_DOCUMENT_LANGUAGE', `${path}.language`);
  if (raw.vertical !== OFFICIAL_EVIDENCE_SCOPE.verticalId) fail('OUT_OF_SCOPE_VERTICAL', `${path}.vertical`);
  if (raw.jurisdiction !== OFFICIAL_EVIDENCE_SCOPE.jurisdiction) fail('OUT_OF_SCOPE_JURISDICTION', `${path}.jurisdiction`);
  if (raw.domain !== OFFICIAL_EVIDENCE_SCOPE.domain) fail('OUT_OF_SCOPE_DOMAIN', `${path}.domain`);
  if (!Array.isArray(raw.productFamilies) || raw.productFamilies.length === 0 || raw.productFamilies.length > OFFICIAL_EVIDENCE_SCOPE.productFamilies.length) {
    fail('INVALID_PRODUCT_FAMILIES', `${path}.productFamilies`);
  }
  const productFamilies = [...new Set(raw.productFamilies.map((family, index) => {
    if (!OFFICIAL_EVIDENCE_SCOPE.productFamilies.includes(family)) fail('OUT_OF_SCOPE_PRODUCT_FAMILY', `${path}.productFamilies[${index}]`);
    return family;
  }))].sort(compareAscii);
  if (productFamilies.length !== raw.productFamilies.length) fail('DUPLICATE_PRODUCT_FAMILY', `${path}.productFamilies`);

  let sourceUrl;
  setValidationStage(stageState, 'sourceUrl', VALIDATION_STAGE_STATUS.FAILED);
  try {
    sourceUrl = normalizeEvidenceUrl(raw.sourceUrl, { synthetic, path: `${path}.sourceUrl` });
  } catch (error) {
    if (error && typeof error.code === 'string') {
      throw new EvidenceWorkbenchValidationError(error.code, error.path || `${path}.sourceUrl`);
    }
    throw error;
  }
  if (synthetic && new URL(sourceUrl).hostname !== 'synthetic.example') fail('SYNTHETIC_SOURCE_HOST_REQUIRED', `${path}.sourceUrl`);
  assertNoSecretOrPrivateData(sourceUrl, `${path}.sourceUrl`);
  setValidationStage(stageState, 'sourceUrl', VALIDATION_STAGE_STATUS.PASSED);

  const normalized = {
    sourceClass: raw.sourceClass,
    publisher: normalizeMetadataText(raw.publisher, `${path}.publisher`, EVIDENCE_DOCUMENT_LIMITS.maxPublisherCodePoints),
    title: normalizeMetadataText(raw.title, `${path}.title`, EVIDENCE_DOCUMENT_LIMITS.maxTitleCodePoints),
    documentNumber: normalizeMetadataText(raw.documentNumber, `${path}.documentNumber`, EVIDENCE_DOCUMENT_LIMITS.maxIdentifierCodePoints),
    sourceUrl,
    documentType: SOURCE_DOCUMENT_TYPE,
    mimeType: SOURCE_DOCUMENT_MIME_TYPE,
    language: raw.language,
    vertical: OFFICIAL_EVIDENCE_SCOPE.verticalId,
    jurisdiction: OFFICIAL_EVIDENCE_SCOPE.jurisdiction,
    domain: OFFICIAL_EVIDENCE_SCOPE.domain,
    productFamilies,
    authenticityStatus: SOURCE_AUTHENTICITY_STATUS,
    redistributionStatus: expectedRedistributionStatus
  };
  assertSafeMetadata(normalized, path);
  return normalized;
}

function normalizeRevision(raw, { asOf, path, stageState }) {
  setValidationStage(stageState, 'revision', VALIDATION_STAGE_STATUS.FAILED);
  if (!raw) fail('REVISION_REQUIRED', path);
  assertPlainObject(raw, path, 'REVISION_REQUIRED');
  assertExactKeys(raw, {
    required: ['seriesId', 'revisionId', 'sequence', 'publishedAt', 'effectiveAt', 'retrievedAt'],
    optional: ['validUntil', 'supersedesDocumentId']
  }, path);
  const publishedAt = normalizeTimestamp(raw.publishedAt, `${path}.publishedAt`, asOf);
  const effectiveAt = normalizeTimestamp(raw.effectiveAt, `${path}.effectiveAt`, asOf);
  const retrievedAt = normalizeTimestamp(raw.retrievedAt, `${path}.retrievedAt`, asOf);
  const validUntil = normalizeOptionalTimestamp(raw.validUntil, `${path}.validUntil`, asOf);
  if (publishedAt > effectiveAt || effectiveAt > retrievedAt || (validUntil && effectiveAt > validUntil)) {
    fail('INVALID_REVISION_CHRONOLOGY', path);
  }
  if (!Number.isInteger(raw.sequence) || raw.sequence < 1 || raw.sequence > 1_000_000) fail('INVALID_REVISION_SEQUENCE', `${path}.sequence`);
  if (raw.supersedesDocumentId !== undefined && !DOCUMENT_ID_PATTERN.test(raw.supersedesDocumentId)) {
    fail('INVALID_SUPERSESSION_REFERENCE', `${path}.supersedesDocumentId`);
  }
  if (raw.sequence === 1 && raw.supersedesDocumentId !== undefined) fail('INVALID_SUPERSESSION_REFERENCE', `${path}.supersedesDocumentId`);
  const normalized = {
    seriesId: normalizeIdentifier(raw.seriesId, `${path}.seriesId`),
    revisionId: normalizeMetadataText(raw.revisionId, `${path}.revisionId`, EVIDENCE_DOCUMENT_LIMITS.maxIdentifierCodePoints),
    sequence: raw.sequence,
    publishedAt,
    effectiveAt,
    retrievedAt
  };
  if (validUntil) normalized.validUntil = validUntil;
  if (raw.supersedesDocumentId) normalized.supersedesDocumentId = raw.supersedesDocumentId;
  assertSafeMetadata(normalized, path);
  setValidationStage(stageState, 'revision', VALIDATION_STAGE_STATUS.PASSED);
  return normalized;
}

function normalizeFile(raw, path) {
  assertPlainObject(raw, path, 'SOURCE_FILE_METADATA_REQUIRED');
  assertExactKeys(raw, { required: ['sha256', 'byteLength', 'contentSha256'] }, path);
  if (typeof raw.sha256 !== 'string' || !SHA256_HEX_PATTERN.test(raw.sha256)) fail('INVALID_FILE_SHA256', `${path}.sha256`);
  if (typeof raw.contentSha256 !== 'string' || !SHA256_HEX_PATTERN.test(raw.contentSha256)) fail('INVALID_CONTENT_SHA256', `${path}.contentSha256`);
  if (!Number.isInteger(raw.byteLength) || raw.byteLength < 1 || raw.byteLength > EVIDENCE_DOCUMENT_LIMITS.maxDeclaredSourceBytes) {
    fail('SOURCE_FILE_SIZE_OUT_OF_BOUNDS', `${path}.byteLength`);
  }
  return { sha256: raw.sha256, byteLength: raw.byteLength, contentSha256: raw.contentSha256 };
}

function normalizeExtraction(raw, { asOf, revision, path }) {
  assertPlainObject(raw, path, 'EXTRACTION_METADATA_REQUIRED');
  assertExactKeys(raw, {
    required: ['method', 'extractorName', 'extractorVersion', 'extractedAt', 'normalizationVersion']
  }, path);
  if (raw.method !== SOURCE_EXTRACTION_METHOD) fail('UNSUPPORTED_EXTRACTION_METHOD', `${path}.method`);
  if (raw.normalizationVersion !== PAGE_TEXT_NORMALIZATION_VERSION) fail('UNSUPPORTED_PAGE_TEXT_NORMALIZATION', `${path}.normalizationVersion`);
  const extractedAt = normalizeTimestamp(raw.extractedAt, `${path}.extractedAt`, asOf);
  if (extractedAt < revision.retrievedAt) fail('INVALID_EXTRACTION_CHRONOLOGY', `${path}.extractedAt`);
  const normalized = {
    method: SOURCE_EXTRACTION_METHOD,
    extractorName: normalizeMetadataText(raw.extractorName, `${path}.extractorName`, EVIDENCE_DOCUMENT_LIMITS.maxExtractorCodePoints),
    extractorVersion: normalizeMetadataText(raw.extractorVersion, `${path}.extractorVersion`, EVIDENCE_DOCUMENT_LIMITS.maxExtractorCodePoints),
    extractedAt,
    normalizationVersion: PAGE_TEXT_NORMALIZATION_VERSION
  };
  assertSafeMetadata(normalized, path);
  return normalized;
}

function normalizeLocator(raw, path) {
  if (!raw) fail('PAGE_LOCATOR_REQUIRED', path);
  assertPlainObject(raw, path, 'PAGE_LOCATOR_REQUIRED');
  assertExactKeys(raw, { required: ['type', 'value'] }, path);
  if (!PAGE_LOCATOR_TYPES.includes(raw.type)) fail('UNSUPPORTED_PAGE_LOCATOR_TYPE', `${path}.type`);
  return {
    type: raw.type,
    value: normalizeMetadataText(raw.value, `${path}.value`, EVIDENCE_DOCUMENT_LIMITS.maxIdentifierCodePoints)
  };
}

function normalizePages(raw, path) {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > EVIDENCE_DOCUMENT_LIMITS.maxPagesPerDocument) {
    fail('PAGE_COUNT_OUT_OF_BOUNDS', path);
  }
  let totalCodePoints = 0;
  const normalized = raw.map((page, index) => {
    const pagePath = `${path}[${index}]`;
    assertPlainObject(page, pagePath, 'INVALID_PAGE');
    if (!Object.hasOwn(page, 'locator')) fail('PAGE_LOCATOR_REQUIRED', `${pagePath}.locator`);
    assertExactKeys(page, { required: ['pageNumber', 'locator', 'text'], optional: ['textSha256'] }, pagePath);
    if (!Number.isInteger(page.pageNumber) || page.pageNumber !== index + 1) fail('INVALID_PAGE_SEQUENCE', `${pagePath}.pageNumber`);
    const locator = normalizeLocator(page.locator, `${pagePath}.locator`);
    const text = normalizePageText(page.text, `${pagePath}.text`);
    const codePointLength = countCodePoints(text);
    totalCodePoints += codePointLength;
    if (totalCodePoints > EVIDENCE_DOCUMENT_LIMITS.maxDocumentCodePoints) fail('DOCUMENT_TEXT_TOO_LONG', path);
    const textSha256 = sha256(text);
    if (page.textSha256 !== undefined && page.textSha256 !== textSha256) fail('PAGE_TEXT_SHA256_MISMATCH', `${pagePath}.textSha256`);
    assertSafeMetadata({ pageNumber: page.pageNumber, locator, textSha256, codePointLength }, pagePath);
    return { pageNumber: page.pageNumber, locator, text, textSha256, codePointLength };
  });
  return normalized;
}

export function computeNormalizedContentSha256(pages, { path = '$.pages' } = {}) {
  if (!Array.isArray(pages) || pages.length < 1 || pages.length > EVIDENCE_DOCUMENT_LIMITS.maxPagesPerDocument) {
    fail('PAGE_COUNT_OUT_OF_BOUNDS', path);
  }
  const payloadPages = pages.map((page, index) => {
    const pagePath = `${path}[${index}]`;
    assertPlainObject(page, pagePath, 'INVALID_PAGE');
    if (!Number.isInteger(page.pageNumber) || page.pageNumber !== index + 1) fail('INVALID_PAGE_SEQUENCE', `${pagePath}.pageNumber`);
    return {
      pageNumber: page.pageNumber,
      locator: normalizeLocator(page.locator, `${pagePath}.locator`),
      text: normalizePageText(page.text, `${pagePath}.text`)
    };
  });
  return sha256({ normalizationVersion: PAGE_TEXT_NORMALIZATION_VERSION, pages: payloadPages });
}

function computeDocumentIdPayload(document) {
  return {
    schemaVersion: document.schemaVersion,
    synthetic: document.synthetic,
    source: document.source,
    revision: document.revision,
    file: document.file
  };
}

export function computeSourceDocumentId(document) {
  return `doc_${sha256(computeDocumentIdPayload(document))}`;
}

export function normalizeSourceDocumentBundle(raw, { asOf, path = '$' } = {}) {
  const fixedAsOf = normalizeAsOf(asOf);
  assertPlainObject(raw, path, 'SOURCE_DOCUMENT_BUNDLE_REQUIRED');
  if (!Object.hasOwn(raw, 'revision')) fail('REVISION_REQUIRED', `${path}.revision`);
  assertExactKeys(raw, {
    required: ['schemaVersion', 'boundary', 'productionReady', 'synthetic', 'source', 'revision', 'file', 'extraction', 'pages'],
    optional: ['documentId']
  }, path);
  if (raw.schemaVersion !== SOURCE_DOCUMENT_BUNDLE_SCHEMA_VERSION) fail('UNSUPPORTED_SOURCE_DOCUMENT_SCHEMA', `${path}.schemaVersion`);
  if (raw.boundary !== NON_PRODUCTION_BOUNDARY) fail('NON_PRODUCTION_BOUNDARY_REQUIRED', `${path}.boundary`);
  if (raw.productionReady !== false) fail('PRODUCTION_READY_MUST_BE_FALSE', `${path}.productionReady`);
  if (typeof raw.synthetic !== 'boolean') fail('SYNTHETIC_FLAG_REQUIRED', `${path}.synthetic`);

  // The page text is checked separately so its domain-specific 20k code-point
  // bound is not accidentally replaced by the claim registry's generic bound.
  assertSafeMetadata({
    ...raw,
    pages: Array.isArray(raw.pages)
      ? raw.pages.map((page) => page && typeof page === 'object' ? { ...page, text: undefined } : page)
      : raw.pages
  }, path);

  const source = normalizeSource(raw.source, { synthetic: raw.synthetic, path: `${path}.source` });
  const revision = normalizeRevision(raw.revision, { asOf: fixedAsOf, path: `${path}.revision` });
  const file = normalizeFile(raw.file, `${path}.file`);
  const extraction = normalizeExtraction(raw.extraction, { asOf: fixedAsOf, revision, path: `${path}.extraction` });
  const pages = normalizePages(raw.pages, `${path}.pages`);
  const contentSha256 = computeNormalizedContentSha256(pages, { path: `${path}.pages` });
  if (file.contentSha256 !== contentSha256) fail('CONTENT_SHA256_MISMATCH', `${path}.file.contentSha256`);
  const normalized = {
    schemaVersion: SOURCE_DOCUMENT_BUNDLE_SCHEMA_VERSION,
    boundary: NON_PRODUCTION_BOUNDARY,
    productionReady: false,
    synthetic: raw.synthetic,
    source,
    revision,
    file,
    extraction,
    pages
  };
  const documentId = computeSourceDocumentId(normalized);
  if (raw.documentId !== undefined && raw.documentId !== documentId) fail('DOCUMENT_ID_MISMATCH', `${path}.documentId`);
  const validated = deepFreeze({ ...normalized, documentId });
  VALIDATED_SOURCE_DOCUMENTS.add(validated);
  return validated;
}

export function inspectSourceDocumentValidationStages(raw, { asOf, path = '$' } = {}) {
  const stages = {
    sourceUrl: VALIDATION_STAGE_STATUS.NOT_EVALUATED,
    revision: VALIDATION_STAGE_STATUS.NOT_EVALUATED
  };
  let terminalErrorCode = '';
  try {
    const fixedAsOf = normalizeAsOf(asOf);
    assertPlainObject(raw, path, 'SOURCE_DOCUMENT_BUNDLE_REQUIRED');
    if (typeof raw.synthetic !== 'boolean') fail('SYNTHETIC_FLAG_REQUIRED', `${path}.synthetic`);
    normalizeSource(raw.source, { synthetic: raw.synthetic, path: `${path}.source`, stageState: stages });
    normalizeRevision(raw.revision, { asOf: fixedAsOf, path: `${path}.revision`, stageState: stages });
  } catch (error) {
    if (!(error instanceof EvidenceWorkbenchValidationError)) throw error;
    terminalErrorCode = error.code;
  }
  return deepFreeze({ ...stages, terminalErrorCode });
}

export function assertValidatedSourceDocument(document, path = '$.document') {
  if (!VALIDATED_SOURCE_DOCUMENTS.has(document)
    || computeSourceDocumentId(document) !== document.documentId
    || computeNormalizedContentSha256(document.pages) !== document.file.contentSha256) {
    fail('VALIDATED_SOURCE_DOCUMENT_REQUIRED', path);
  }
  return document;
}

function validateCatalogSupersession(documents, path) {
  const byId = new Map(documents.map((document) => [document.documentId, document]));
  const groups = new Map();
  const seenRevisionIds = new Set();
  const seenSeriesSequence = new Set();
  const successorByTarget = new Map();
  const metadataBySourceFileSha = new Map();

  for (const document of documents) {
    const sourceFileMetadata = canonicalStringify({
      source: document.source,
      revision: document.revision,
      byteLength: document.file.byteLength,
      contentSha256: document.file.contentSha256
    });
    const existingSourceFileMetadata = metadataBySourceFileSha.get(document.file.sha256);
    if (existingSourceFileMetadata !== undefined && existingSourceFileMetadata !== sourceFileMetadata) {
      fail('SOURCE_FILE_METADATA_CONFLICT', `${path}.${document.documentId}.file.sha256`);
    }
    metadataBySourceFileSha.set(document.file.sha256, sourceFileMetadata);
    const revisionIdentity = `${document.revision.seriesId}\0${document.revision.revisionId}`;
    if (seenRevisionIds.has(revisionIdentity)) fail('DUPLICATE_REVISION_ID', path);
    seenRevisionIds.add(revisionIdentity);
    const sequenceIdentity = `${document.revision.seriesId}\0${document.revision.sequence}`;
    if (seenSeriesSequence.has(sequenceIdentity)) fail('DUPLICATE_REVISION_SEQUENCE', path);
    seenSeriesSequence.add(sequenceIdentity);
    const group = groups.get(document.revision.seriesId) || [];
    group.push(document);
    groups.set(document.revision.seriesId, group);

    const targetId = document.revision.supersedesDocumentId;
    if (!targetId) continue;
    const target = byId.get(targetId);
    if (!target
      || target.revision.seriesId !== document.revision.seriesId
      || target.revision.sequence + 1 !== document.revision.sequence
      || target.revision.publishedAt >= document.revision.publishedAt) {
      fail('INVALID_SUPERSESSION_REFERENCE', `${path}.${document.documentId}.revision.supersedesDocumentId`);
    }
    if (successorByTarget.has(targetId)) fail('SUPERSESSION_FORK_REFUSED', `${path}.${document.documentId}.revision.supersedesDocumentId`);
    successorByTarget.set(targetId, document.documentId);
  }

  for (const group of groups.values()) {
    group.sort((left, right) => left.revision.sequence - right.revision.sequence || compareAscii(left.documentId, right.documentId));
    for (let index = 1; index < group.length; index += 1) {
      if (group[index].revision.supersedesDocumentId !== group[index - 1].documentId) {
        fail('SUPERSESSION_LINK_REQUIRED', `${path}.${group[index].documentId}.revision.supersedesDocumentId`);
      }
    }
  }
  return [...successorByTarget.entries()]
    .map(([supersededDocumentId, successorDocumentId]) => ({ supersededDocumentId, successorDocumentId }))
    .sort((left, right) => compareAscii(left.supersededDocumentId, right.supersededDocumentId));
}

export function createSourceDocumentCatalog(rawDocuments, { asOf, path = '$.documents' } = {}) {
  const fixedAsOf = normalizeAsOf(asOf);
  if (!Array.isArray(rawDocuments) || rawDocuments.length < 1 || rawDocuments.length > EVIDENCE_DOCUMENT_LIMITS.maxCatalogDocuments) {
    fail('DOCUMENT_CATALOG_SIZE_OUT_OF_BOUNDS', path);
  }
  const seen = new Set();
  const documents = rawDocuments.map((raw, index) => {
    let normalized;
    if (VALIDATED_SOURCE_DOCUMENTS.has(raw)) {
      assertValidatedSourceDocument(raw, `${path}[${index}]`);
      for (const [field, value] of [
        ['revision.publishedAt', raw.revision.publishedAt],
        ['revision.effectiveAt', raw.revision.effectiveAt],
        ['revision.retrievedAt', raw.revision.retrievedAt],
        ['extraction.extractedAt', raw.extraction.extractedAt]
      ]) {
        if (value > fixedAsOf) fail('FUTURE_DOCUMENT_DATE', `${path}[${index}].${field}`);
      }
      normalized = raw;
    } else {
      normalized = normalizeSourceDocumentBundle(raw, { asOf: fixedAsOf, path: `${path}[${index}]` });
    }
    if (seen.has(normalized.documentId)) fail('DUPLICATE_DOCUMENT_ID', `${path}[${index}].documentId`);
    seen.add(normalized.documentId);
    return normalized;
  }).sort((left, right) => compareAscii(left.documentId, right.documentId));
  const supersessionEdges = validateCatalogSupersession(documents, path);
  return deepFreeze({
    schemaVersion: SOURCE_DOCUMENT_CATALOG_SCHEMA_VERSION,
    boundary: NON_PRODUCTION_BOUNDARY,
    productionReady: false,
    asOf: fixedAsOf,
    documents,
    supersessionEdges
  });
}

export { canonicalStringify, sha256 };
