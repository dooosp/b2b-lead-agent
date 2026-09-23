import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeNormalizedContentSha256,
  normalizeSourceDocumentBundle,
  sha256
} from '../evidence-claim-workbench/domain/document-bundle.mjs';
import {
  createPageEvidenceAnchor,
  validatePageEvidenceAnchor
} from '../evidence-claim-workbench/domain/evidence-anchor.mjs';
import { EvidenceWorkbenchValidationError } from '../evidence-claim-workbench/domain/errors.mjs';

const AS_OF = '2026-07-17T00:00:00.000Z';

function makeDocument(pageTexts = [
  '🔒 머리말. 정격전압 24 kV. 중간 설명. 정격전압 24 kV. 끝.',
  '🔒 머리말. 정격전압 24 kV. 중간 설명. 정격전압 24 kV. 끝.'
]) {
  const pages = pageTexts.map((text, index) => ({
    pageNumber: index + 1,
    locator: index === 0
      ? { type: 'PRINTED_PAGE', value: 'iv' }
      : { type: 'SECTION', value: `Table ${index + 1}` },
    text
  }));
  return normalizeSourceDocumentBundle({
    schemaVersion: 'source-document-bundle-v0',
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    productionReady: false,
    synthetic: true,
    source: {
      sourceClass: 'SYNTHETIC_FIXTURE',
      publisher: 'Synthetic Publisher',
      title: 'Synthetic Anchor Fixture',
      documentNumber: 'SYN-ANCHOR-001',
      sourceUrl: 'https://synthetic.example/anchor-fixture',
      documentType: 'NORMALIZED_PAGE_TEXT_JSON',
      mimeType: 'application/json',
      language: 'ko',
      vertical: 'datacenter',
      jurisdiction: 'KR',
      domain: 'electrical_power',
      productFamilies: ['medium_voltage_switchgear'],
      authenticityStatus: 'UNREVIEWED',
      redistributionStatus: 'SYNTHETIC_FIXTURE_REDISTRIBUTION_PERMITTED'
    },
    revision: {
      seriesId: 'syn-anchor-001',
      revisionId: 'R1',
      sequence: 1,
      publishedAt: '2026-01-01T00:00:00.000Z',
      effectiveAt: '2026-01-01T00:00:00.000Z',
      retrievedAt: '2026-06-01T00:00:00.000Z'
    },
    file: {
      sha256: sha256('anchor source bytes'),
      byteLength: 2048,
      contentSha256: computeNormalizedContentSha256(pages)
    },
    extraction: {
      method: 'PREEXTRACTED_PAGE_TEXT',
      extractorName: 'fixture',
      extractorVersion: '1',
      extractedAt: '2026-06-02T00:00:00.000Z',
      normalizationVersion: 'page-text-nfc-lf-codepoint-v1'
    },
    pages
  }, { asOf: AS_OF });
}

function occurrenceStarts(text, quote) {
  const haystack = [...text];
  const needle = [...quote];
  const starts = [];
  outer: for (let start = 0; start <= haystack.length - needle.length; start += 1) {
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (haystack[start + offset] !== needle[offset]) continue outer;
    }
    starts.push(start);
  }
  return starts;
}

function expectCode(code, action) {
  assert.throws(action, (error) => {
    assert.ok(error instanceof EvidenceWorkbenchValidationError);
    assert.equal(error.code, code);
    return true;
  });
}

test('anchor binds source bytes, document number, revision, page ordinal, typed locator, exact quote, occurrence, and context', () => {
  const document = makeDocument();
  const quote = '정격전압 24 kV';
  const starts = occurrenceStarts(document.pages[0].text, quote);
  const anchor = createPageEvidenceAnchor(document, {
    pageNumber: 1,
    startCodePoint: starts[1],
    endCodePoint: starts[1] + [...quote].length,
    quote,
    occurrenceIndex: 2
  });

  assert.match(anchor.anchorId, /^anc_[a-f0-9]{64}$/);
  assert.equal(anchor.documentId, document.documentId);
  assert.equal(anchor.documentNumber, 'SYN-ANCHOR-001');
  assert.equal(anchor.sourceFileSha256, document.file.sha256);
  assert.deepEqual(anchor.revision, {
    seriesId: 'syn-anchor-001',
    revisionId: 'R1',
    sequence: 1,
    publishedAt: '2026-01-01T00:00:00.000Z'
  });
  assert.equal(anchor.page.extractedPageOrdinal, 1);
  assert.deepEqual(anchor.page.locator, { type: 'PRINTED_PAGE', value: 'iv' });
  assert.equal(anchor.selection.occurrenceCount, 2);
  assert.equal(anchor.selection.occurrenceIndex, 2);
  assert.equal(anchor.selection.quoteSha256, sha256(quote));
  assert.equal(anchor.selection.prefixContextSha256, sha256(anchor.selection.prefixContext));
  assert.equal(anchor.selection.suffixContextSha256, sha256(anchor.selection.suffixContext));
  assert.ok([...anchor.selection.prefixContext].length <= 64);
  assert.ok([...anchor.selection.suffixContext].length <= 64);
  assert.equal(validatePageEvidenceAnchor(document, structuredClone(anchor)).anchorId, anchor.anchorId);
  assert.ok(Object.isFrozen(anchor.selection));
});

test('repeated quote needs an explicit one-based occurrence index and exact Unicode code-point offsets', () => {
  const document = makeDocument();
  const quote = '정격전압 24 kV';
  const starts = occurrenceStarts(document.pages[0].text, quote);
  expectCode('OCCURRENCE_INDEX_REQUIRED', () => createPageEvidenceAnchor(document, {
    pageNumber: 1,
    startCodePoint: starts[0],
    endCodePoint: starts[0] + [...quote].length,
    quote
  }));
  expectCode('OCCURRENCE_INDEX_MISMATCH', () => createPageEvidenceAnchor(document, {
    pageNumber: 1,
    startCodePoint: starts[0],
    endCodePoint: starts[0] + [...quote].length,
    quote,
    occurrenceIndex: 2
  }));
  expectCode('QUOTE_OFFSET_LENGTH_MISMATCH', () => createPageEvidenceAnchor(document, {
    pageNumber: 1,
    startCodePoint: starts[0],
    endCodePoint: starts[0] + [...quote].length + 1,
    quote,
    occurrenceIndex: 1
  }));
  expectCode('PAGE_QUOTE_MISMATCH', () => createPageEvidenceAnchor(document, {
    pageNumber: 1,
    startCodePoint: starts[0] + 1,
    endCodePoint: starts[0] + 1 + [...quote].length,
    quote,
    occurrenceIndex: 1
  }));
});

test('the same quote on another page produces a different anchor bound to that page and locator', () => {
  const document = makeDocument();
  const quote = '정격전압 24 kV';
  const start1 = occurrenceStarts(document.pages[0].text, quote)[0];
  const start2 = occurrenceStarts(document.pages[1].text, quote)[0];
  const first = createPageEvidenceAnchor(document, {
    pageNumber: 1,
    startCodePoint: start1,
    endCodePoint: start1 + [...quote].length,
    quote,
    occurrenceIndex: 1
  });
  const second = createPageEvidenceAnchor(document, {
    pageNumber: 2,
    startCodePoint: start2,
    endCodePoint: start2 + [...quote].length,
    quote,
    occurrenceIndex: 1
  });
  assert.notEqual(first.anchorId, second.anchorId);
  assert.equal(first.page.textSha256, second.page.textSha256, 'same text hash remains page/locator-bound');
});

test('NFC is applied but compatibility characters are never NFKC-folded', () => {
  const document = makeDocument(['Cafe\u0301: rating Ａ']);
  assert.equal(document.pages[0].text, 'Café: rating Ａ');
  const fullWidthOffset = [...document.pages[0].text].indexOf('Ａ');
  const anchor = createPageEvidenceAnchor(document, {
    pageNumber: 1,
    startCodePoint: fullWidthOffset,
    endCodePoint: fullWidthOffset + 1,
    quote: 'Ａ'
  });
  assert.equal(anchor.selection.quote, 'Ａ');
  expectCode('PAGE_QUOTE_MISMATCH', () => createPageEvidenceAnchor(document, {
    pageNumber: 1,
    startCodePoint: fullWidthOffset,
    endCodePoint: fullWidthOffset + 1,
    quote: 'A'
  }));
});

test('anchor creation requires the exact validated immutable document instance', () => {
  const document = makeDocument();
  const forged = structuredClone(document);
  const quote = '정격전압 24 kV';
  const start = occurrenceStarts(document.pages[0].text, quote)[0];
  expectCode('VALIDATED_SOURCE_DOCUMENT_REQUIRED', () => createPageEvidenceAnchor(forged, {
    pageNumber: 1,
    startCodePoint: start,
    endCodePoint: start + [...quote].length,
    quote,
    occurrenceIndex: 1
  }));
});

test('anchor validation rejects forged identity, locator, revision, and missing provenance', () => {
  const document = makeDocument(['Rated voltage is 24 kV.']);
  const quote = '24 kV';
  const start = occurrenceStarts(document.pages[0].text, quote)[0];
  const anchor = createPageEvidenceAnchor(document, {
    pageNumber: 1,
    startCodePoint: start,
    endCodePoint: start + [...quote].length,
    quote
  });

  const forgedId = structuredClone(anchor);
  forgedId.anchorId = `anc_${'0'.repeat(64)}`;
  expectCode('ANCHOR_ID_MISMATCH', () => validatePageEvidenceAnchor(document, forgedId));

  const forgedLocator = structuredClone(anchor);
  forgedLocator.page.locator.value = '99';
  expectCode('ANCHOR_INTEGRITY_MISMATCH', () => validatePageEvidenceAnchor(document, forgedLocator));

  const forgedRevision = structuredClone(anchor);
  forgedRevision.revision.revisionId = 'FORGED';
  expectCode('ANCHOR_INTEGRITY_MISMATCH', () => validatePageEvidenceAnchor(document, forgedRevision));

  const missingLocator = structuredClone(anchor);
  delete missingLocator.page.locator;
  expectCode('PAGE_LOCATOR_REQUIRED', () => validatePageEvidenceAnchor(document, missingLocator));

  const missingRevision = structuredClone(anchor);
  delete missingRevision.revision;
  expectCode('ANCHOR_REVISION_REQUIRED', () => validatePageEvidenceAnchor(document, missingRevision));
});

test('anchors refuse empty, oversized, secret-shaped, and private-data-shaped excerpts', () => {
  const oversized = 'x'.repeat(501);
  const document = makeDocument([oversized]);
  expectCode('QUOTE_TOO_LONG', () => createPageEvidenceAnchor(document, {
    pageNumber: 1,
    startCodePoint: 0,
    endCodePoint: 501,
    quote: oversized
  }));
  expectCode('INVALID_QUOTE_OFFSET', () => createPageEvidenceAnchor(document, {
    pageNumber: 1,
    startCodePoint: 0,
    endCodePoint: 0,
    quote: ''
  }));
  expectCode('SECRET_SHAPED_VALUE', () => makeDocument(['api_key=abcdefghijklmnop1234567890']));
  expectCode('PRIVATE_DATA_SHAPED_VALUE', () => makeDocument(['person@example.com']));
});
