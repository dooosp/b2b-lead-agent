import { canonicalStringify, sha256 } from '../../knowledge/claim-registry/index.mjs';
import {
  ANCHOR_ID_PATTERN,
  EVIDENCE_DOCUMENT_LIMITS,
  NON_PRODUCTION_BOUNDARY,
  PAGE_EVIDENCE_ANCHOR_SCHEMA_VERSION,
  PAGE_TEXT_NORMALIZATION_VERSION
} from './constants.mjs';
import {
  assertValidatedSourceDocument,
  countCodePoints,
  normalizePageText
} from './document-bundle.mjs';
import {
  assertExactKeys,
  assertPlainObject,
  assertSafeMetadata,
  deepFreeze,
  fail
} from './errors.mjs';

function getValidatedPage(document, pageNumber, path) {
  assertValidatedSourceDocument(document);
  if (!Number.isInteger(pageNumber) || pageNumber < 1) fail('INVALID_PAGE_NUMBER', path);
  const page = document.pages.find((candidate) => candidate.pageNumber === pageNumber);
  if (!page) fail('PAGE_NOT_FOUND', path);
  if (!page.locator) fail('PAGE_LOCATOR_REQUIRED', `${path}.locator`);
  if (typeof page.text !== 'string' || page.textSha256 !== sha256(page.text)) fail('PAGE_INTEGRITY_MISMATCH', path);
  return page;
}

function findOccurrences(haystack, needle) {
  const starts = [];
  if (needle.length === 0 || needle.length > haystack.length) return starts;
  outer: for (let start = 0; start <= haystack.length - needle.length; start += 1) {
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (haystack[start + offset] !== needle[offset]) continue outer;
    }
    starts.push(start);
  }
  return starts;
}

function anchorIdentityPayload(anchor) {
  return {
    schemaVersion: anchor.schemaVersion,
    documentId: anchor.documentId,
    documentNumber: anchor.documentNumber,
    sourceFileSha256: anchor.sourceFileSha256,
    revision: anchor.revision,
    page: anchor.page,
    selection: {
      normalizationVersion: anchor.selection.normalizationVersion,
      startCodePoint: anchor.selection.startCodePoint,
      endCodePoint: anchor.selection.endCodePoint,
      quote: anchor.selection.quote,
      quoteSha256: anchor.selection.quoteSha256,
      occurrenceIndex: anchor.selection.occurrenceIndex,
      occurrenceCount: anchor.selection.occurrenceCount,
      prefixContextCodePoints: anchor.selection.prefixContextCodePoints,
      prefixContextSha256: anchor.selection.prefixContextSha256,
      suffixContextCodePoints: anchor.selection.suffixContextCodePoints,
      suffixContextSha256: anchor.selection.suffixContextSha256
    }
  };
}

export function computePageEvidenceAnchorId(anchor) {
  return `anc_${sha256(anchorIdentityPayload(anchor))}`;
}

export function createPageEvidenceAnchor(document, input, { path = '$.anchorInput' } = {}) {
  assertPlainObject(input, path, 'ANCHOR_INPUT_REQUIRED');
  assertExactKeys(input, {
    required: ['pageNumber', 'startCodePoint', 'endCodePoint', 'quote'],
    optional: ['occurrenceIndex']
  }, path);
  const page = getValidatedPage(document, input.pageNumber, `${path}.pageNumber`);
  if (!Number.isInteger(input.startCodePoint) || input.startCodePoint < 0) fail('INVALID_QUOTE_OFFSET', `${path}.startCodePoint`);
  if (!Number.isInteger(input.endCodePoint) || input.endCodePoint <= input.startCodePoint) fail('INVALID_QUOTE_OFFSET', `${path}.endCodePoint`);

  const quote = normalizePageText(input.quote, `${path}.quote`);
  const quoteLength = countCodePoints(quote);
  if (quoteLength === 0) fail('EMPTY_QUOTE_REFUSED', `${path}.quote`);
  if (quoteLength > EVIDENCE_DOCUMENT_LIMITS.maxQuoteCodePoints) fail('QUOTE_TOO_LONG', `${path}.quote`);
  if (input.endCodePoint !== input.startCodePoint + quoteLength) fail('QUOTE_OFFSET_LENGTH_MISMATCH', path);

  const pageCodePoints = [...page.text];
  const quoteCodePoints = [...quote];
  if (input.endCodePoint > pageCodePoints.length) fail('QUOTE_OFFSET_OUT_OF_BOUNDS', `${path}.endCodePoint`);
  const selected = pageCodePoints.slice(input.startCodePoint, input.endCodePoint).join('');
  if (selected !== quote) fail('PAGE_QUOTE_MISMATCH', `${path}.quote`);

  const occurrenceStarts = findOccurrences(pageCodePoints, quoteCodePoints);
  if (occurrenceStarts.length === 0) fail('QUOTE_NOT_FOUND', `${path}.quote`);
  const derivedOccurrenceIndex = occurrenceStarts.indexOf(input.startCodePoint) + 1;
  if (derivedOccurrenceIndex === 0) fail('QUOTE_OFFSET_NOT_AT_OCCURRENCE', `${path}.startCodePoint`);
  if (occurrenceStarts.length > 1 && input.occurrenceIndex === undefined) fail('OCCURRENCE_INDEX_REQUIRED', `${path}.occurrenceIndex`);
  if (input.occurrenceIndex !== undefined
    && (!Number.isInteger(input.occurrenceIndex) || input.occurrenceIndex !== derivedOccurrenceIndex)) {
    fail('OCCURRENCE_INDEX_MISMATCH', `${path}.occurrenceIndex`);
  }

  const context = EVIDENCE_DOCUMENT_LIMITS.contextCodePoints;
  const prefix = pageCodePoints.slice(Math.max(0, input.startCodePoint - context), input.startCodePoint).join('');
  const suffix = pageCodePoints.slice(input.endCodePoint, input.endCodePoint + context).join('');
  const normalized = {
    schemaVersion: PAGE_EVIDENCE_ANCHOR_SCHEMA_VERSION,
    boundary: NON_PRODUCTION_BOUNDARY,
    productionReady: false,
    documentId: document.documentId,
    documentNumber: document.source.documentNumber,
    sourceFileSha256: document.file.sha256,
    revision: {
      seriesId: document.revision.seriesId,
      revisionId: document.revision.revisionId,
      sequence: document.revision.sequence,
      publishedAt: document.revision.publishedAt
    },
    page: {
      extractedPageOrdinal: page.pageNumber,
      locator: page.locator,
      textSha256: page.textSha256,
      textCodePoints: page.codePointLength
    },
    selection: {
      normalizationVersion: PAGE_TEXT_NORMALIZATION_VERSION,
      startCodePoint: input.startCodePoint,
      endCodePoint: input.endCodePoint,
      quote,
      quoteSha256: sha256(quote),
      occurrenceIndex: derivedOccurrenceIndex,
      occurrenceCount: occurrenceStarts.length,
      prefixContext: prefix,
      prefixContextCodePoints: countCodePoints(prefix),
      prefixContextSha256: sha256(prefix),
      suffixContext: suffix,
      suffixContextCodePoints: countCodePoints(suffix),
      suffixContextSha256: sha256(suffix)
    }
  };
  assertSafeMetadata(normalized, '$.anchor');
  return deepFreeze({ ...normalized, anchorId: computePageEvidenceAnchorId(normalized) });
}

export function validatePageEvidenceAnchor(document, raw, { path = '$.anchor' } = {}) {
  assertPlainObject(raw, path, 'PAGE_EVIDENCE_ANCHOR_REQUIRED');
  if (!raw.revision) fail('ANCHOR_REVISION_REQUIRED', `${path}.revision`);
  if (!raw.page || !raw.page.locator) fail('PAGE_LOCATOR_REQUIRED', `${path}.page.locator`);
  assertExactKeys(raw, {
    required: [
      'schemaVersion',
      'boundary',
      'productionReady',
      'documentId',
      'documentNumber',
      'sourceFileSha256',
      'revision',
      'page',
      'selection',
      'anchorId'
    ]
  }, path);
  if (raw.schemaVersion !== PAGE_EVIDENCE_ANCHOR_SCHEMA_VERSION) fail('UNSUPPORTED_PAGE_EVIDENCE_ANCHOR_SCHEMA', `${path}.schemaVersion`);
  if (raw.boundary !== NON_PRODUCTION_BOUNDARY) fail('NON_PRODUCTION_BOUNDARY_REQUIRED', `${path}.boundary`);
  if (raw.productionReady !== false) fail('PRODUCTION_READY_MUST_BE_FALSE', `${path}.productionReady`);
  if (!ANCHOR_ID_PATTERN.test(raw.anchorId || '')) fail('INVALID_ANCHOR_ID', `${path}.anchorId`);
  assertSafeMetadata(raw, path);
  assertPlainObject(raw.page, `${path}.page`, 'INVALID_ANCHOR_PAGE');
  assertPlainObject(raw.selection, `${path}.selection`, 'INVALID_ANCHOR_SELECTION');

  const expected = createPageEvidenceAnchor(document, {
    pageNumber: raw.page.extractedPageOrdinal,
    startCodePoint: raw.selection.startCodePoint,
    endCodePoint: raw.selection.endCodePoint,
    quote: raw.selection.quote,
    occurrenceIndex: raw.selection.occurrenceIndex
  }, { path: `${path}.selection` });
  if (raw.anchorId !== expected.anchorId) fail('ANCHOR_ID_MISMATCH', `${path}.anchorId`);
  if (canonicalStringify(raw) !== canonicalStringify(expected)) fail('ANCHOR_INTEGRITY_MISMATCH', path);
  return expected;
}
