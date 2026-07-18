import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeNormalizedContentSha256,
  computeSourceDocumentId,
  createSourceDocumentCatalog,
  inspectSourceDocumentValidationStages,
  normalizePageText,
  normalizeSourceDocumentBundle,
  sha256
} from '../evidence-claim-workbench/domain/document-bundle.mjs';
import { EvidenceWorkbenchValidationError } from '../evidence-claim-workbench/domain/errors.mjs';

const AS_OF = '2026-07-17T00:00:00.000Z';

function makePages(text = '정격 전압은 24 kV입니다.\nRated voltage is 24 kV.') {
  return [{
    pageNumber: 1,
    locator: { type: 'PRINTED_PAGE', value: '12' },
    text
  }];
}

function makeBundle(overrides = {}) {
  const pages = overrides.pages || makePages();
  const base = {
    schemaVersion: 'source-document-bundle-v0',
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    productionReady: false,
    synthetic: true,
    source: {
      sourceClass: 'SYNTHETIC_FIXTURE',
      publisher: 'Synthetic Electrical Publisher',
      title: 'Synthetic Medium-Voltage Switchgear Data Sheet',
      documentNumber: 'SYN-MVS-001',
      sourceUrl: 'https://synthetic.example/electrical/mvs-001?b=2&a=1',
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
      seriesId: 'syn-mvs-001',
      revisionId: 'R1',
      sequence: 1,
      publishedAt: '2026-01-01T00:00:00.000Z',
      effectiveAt: '2026-01-02T00:00:00.000Z',
      retrievedAt: '2026-07-01T00:00:00.000Z',
      validUntil: '2027-12-31T00:00:00.000Z'
    },
    file: {
      sha256: sha256('synthetic source bytes mvs-001'),
      byteLength: 4096,
      contentSha256: computeNormalizedContentSha256(pages)
    },
    extraction: {
      method: 'PREEXTRACTED_PAGE_TEXT',
      extractorName: 'synthetic-fixture-writer',
      extractorVersion: '1.0.0',
      extractedAt: '2026-07-02T00:00:00.000Z',
      normalizationVersion: 'page-text-nfc-lf-codepoint-v1'
    },
    pages
  };
  for (const [key, value] of Object.entries(overrides)) {
    if (key !== 'pages') base[key] = value;
  }
  return base;
}

function expectCode(code, action) {
  assert.throws(action, (error) => {
    assert.ok(error instanceof EvidenceWorkbenchValidationError);
    assert.equal(error.code, code);
    assert.ok(!error.message.includes('synthetic source bytes'));
    return true;
  });
}

test('normalizes and freezes a deterministic exact-scope source-document bundle', () => {
  const pages = makePages('Cafe\u0301\r\n정격 전압 24 kV');
  const raw = makeBundle({ pages });
  const first = normalizeSourceDocumentBundle(raw, { asOf: AS_OF });
  const second = normalizeSourceDocumentBundle(structuredClone(raw), { asOf: AS_OF });

  assert.equal(first.documentId, second.documentId);
  assert.equal(first.documentId, computeSourceDocumentId(first));
  assert.match(first.documentId, /^doc_[a-f0-9]{64}$/);
  assert.equal(first.source.sourceUrl, 'https://synthetic.example/electrical/mvs-001?a=1&b=2');
  assert.equal(first.source.vertical, 'datacenter');
  assert.equal(first.source.documentNumber, 'SYN-MVS-001');
  assert.equal(first.source.authenticityStatus, 'UNREVIEWED');
  assert.equal(first.productionReady, false);
  assert.equal(first.pages[0].text, 'Café\n정격 전압 24 kV');
  assert.equal(first.pages[0].textSha256, sha256(first.pages[0].text));
  assert.equal(first.file.contentSha256, computeNormalizedContentSha256(first.pages));
  assert.equal(first.revision.validUntil, '2027-12-31T00:00:00.000Z');
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(first.pages[0].locator));
});

test('document identity binds source metadata, document number, revision, source hash, and normalized content hash', () => {
  const baseline = normalizeSourceDocumentBundle(makeBundle(), { asOf: AS_OF });
  for (const mutate of [
    (raw) => { raw.source.title = 'Changed title'; },
    (raw) => { raw.source.documentNumber = 'SYN-MVS-002'; },
    (raw) => { raw.revision.revisionId = 'R1a'; },
    (raw) => { raw.file.sha256 = sha256('different source bytes'); },
    (raw) => {
      raw.pages[0].text += ' Changed.';
      raw.file.contentSha256 = computeNormalizedContentSha256(raw.pages);
    }
  ]) {
    const changed = makeBundle();
    mutate(changed);
    assert.notEqual(normalizeSourceDocumentBundle(changed, { asOf: AS_OF }).documentId, baseline.documentId);
  }

  const forgedId = makeBundle();
  forgedId.documentId = `doc_${'0'.repeat(64)}`;
  expectCode('DOCUMENT_ID_MISMATCH', () => normalizeSourceDocumentBundle(forgedId, { asOf: AS_OF }));

  const forgedContent = makeBundle();
  forgedContent.pages[0].text += ' tampered';
  expectCode('CONTENT_SHA256_MISMATCH', () => normalizeSourceDocumentBundle(forgedContent, { asOf: AS_OF }));

  const forgedPage = makeBundle();
  forgedPage.pages[0].textSha256 = '0'.repeat(64);
  expectCode('PAGE_TEXT_SHA256_MISMATCH', () => normalizeSourceDocumentBundle(forgedPage, { asOf: AS_OF }));
});

test('source-file identity requires a canonical SHA-256 digest shape', () => {
  const invalid = makeBundle();
  invalid.file.sha256 = 'not-a-sha256-digest';
  expectCode('INVALID_FILE_SHA256', () => normalizeSourceDocumentBundle(invalid, { asOf: AS_OF }));
});

test('scope, source authenticity, redistribution, document type, and locator are fail-closed', () => {
  const cases = [
    ['OUT_OF_SCOPE_VERTICAL', (raw) => { raw.source.vertical = 'datacenter_infrastructure'; }],
    ['OUT_OF_SCOPE_JURISDICTION', (raw) => { raw.source.jurisdiction = 'US'; }],
    ['OUT_OF_SCOPE_DOMAIN', (raw) => { raw.source.domain = 'cooling'; }],
    ['OUT_OF_SCOPE_PRODUCT_FAMILY', (raw) => { raw.source.productFamilies = ['generator']; }],
    ['UNSUPPORTED_DOCUMENT_LANGUAGE', (raw) => { raw.source.language = 'ja'; }],
    ['SOURCE_AUTHENTICITY_MUST_BE_UNREVIEWED', (raw) => { raw.source.authenticityStatus = 'VERIFIED'; }],
    ['REDISTRIBUTION_STATUS_MODE_MISMATCH', (raw) => { raw.source.redistributionStatus = 'METADATA_AND_BOUNDED_EXCERPTS_ONLY'; }],
    ['RAW_PDF_PARSER_UNAVAILABLE', (raw) => { raw.source.documentType = 'PDF'; raw.source.mimeType = 'application/pdf'; }],
    ['UNSUPPORTED_DOCUMENT_TYPE', (raw) => { raw.source.documentType = 'OCR_TEXT'; }],
    ['UNSUPPORTED_DOCUMENT_MIME_TYPE', (raw) => { raw.source.mimeType = 'text/plain'; }],
    ['PAGE_LOCATOR_REQUIRED', (raw) => { delete raw.pages[0].locator; }]
  ];
  for (const [code, mutate] of cases) {
    const raw = makeBundle();
    mutate(raw);
    expectCode(code, () => normalizeSourceDocumentBundle(raw, { asOf: AS_OF }));
  }
  const missingDocumentNumber = makeBundle();
  delete missingDocumentNumber.source.documentNumber;
  expectCode('DOCUMENT_NUMBER_REQUIRED', () => normalizeSourceDocumentBundle(missingDocumentNumber, { asOf: AS_OF }));
});

test('URLs, revisions, fixed clock, and date chronology reject unsafe or future source evidence', () => {
  for (const [code, mutate] of [
    ['MALFORMED_SOURCE_URL', (raw) => { raw.source.sourceUrl = 'not a url'; }],
    ['SOURCE_CREDENTIALS_REFUSED', (raw) => { raw.source.sourceUrl = 'https://user:pass@synthetic.example/doc'; }],
    ['PRIVATE_SOURCE_URL_REFUSED', (raw) => { raw.source.sourceUrl = 'http://127.0.0.1/doc'; }],
    ['SOURCE_FRAGMENT_REFUSED', (raw) => { raw.source.sourceUrl += '#page=1'; }],
    ['PRIVATE_DATA_SHAPED_VALUE', (raw) => { raw.source.sourceUrl = 'https://synthetic.example/reviewer%40example.com'; }],
    ['PRIVATE_DATA_SHAPED_VALUE', (raw) => { raw.source.sourceUrl = 'https://synthetic.example/reviewer%2540example.com'; }],
    ['PRIVATE_DATA_SHAPED_VALUE', (raw) => { raw.source.publisher = 'reviewer@example.com'; }],
    ['PRIVATE_DATA_SHAPED_VALUE', (raw) => { raw.source.publisher = 'reviewer＠example.com'; }],
    ['PRIVATE_DATA_SHAPED_VALUE', (raw) => { raw.source.title = '담당자 010-0000-0000'; }],
    ['LOCAL_ABSOLUTE_PATH_REFUSED', (raw) => { raw.source.title = '%252Froot%252Fprivate.json'; }],
    ['LOCAL_ABSOLUTE_PATH_REFUSED', (raw) => { raw.source.title = 'file:///root/private.json'; }],
    ['LOCAL_ABSOLUTE_PATH_REFUSED', (raw) => { raw.source.title = 'see:/Users/example/private.json'; }],
    ['LOCAL_ABSOLUTE_PATH_REFUSED', (raw) => { raw.source.title = String.raw`[\\server\share\private.json`; }],
    ['REVISION_REQUIRED', (raw) => { delete raw.revision; }],
    ['FUTURE_DOCUMENT_DATE', (raw) => { raw.revision.publishedAt = '2026-08-01T00:00:00.000Z'; }],
    ['FUTURE_DOCUMENT_DATE', (raw) => { raw.extraction.extractedAt = '2026-08-01T00:00:00.000Z'; }],
    ['INVALID_ISO_TIMESTAMP', (raw) => { raw.revision.publishedAt = '2026-01-01'; }],
    ['INVALID_REVISION_CHRONOLOGY', (raw) => { raw.revision.effectiveAt = '2025-12-31T00:00:00.000Z'; }],
    ['INVALID_EXTRACTION_CHRONOLOGY', (raw) => { raw.extraction.extractedAt = '2026-06-01T00:00:00.000Z'; }]
  ]) {
    const raw = makeBundle();
    mutate(raw);
    expectCode(code, () => normalizeSourceDocumentBundle(raw, { asOf: AS_OF }));
  }
  expectCode('FIXED_AS_OF_REQUIRED', () => normalizeSourceDocumentBundle(makeBundle()));
});

test('page text uses NFC/LF (never NFKC) and rejects secret, private-data, control, size, and prototype abuse', () => {
  assert.equal(normalizePageText('Ａ\r\ne\u0301'), 'Ａ\né');
  assert.notEqual(normalizePageText('Ａ'), 'A');
  for (const [code, text] of [
    ['SECRET_SHAPED_VALUE', 'api_key=abcdefghijklmnop1234567890'],
    ['PRIVATE_DATA_SHAPED_VALUE', 'reviewer.person@example.com'],
    ['PRIVATE_DATA_SHAPED_VALUE', 'reviewer.person＠example.com'],
    ['PRIVATE_DATA_SHAPED_VALUE', 'reviewer.person%2540example.com'],
    ['PRIVATE_DATA_SHAPED_VALUE', '담당자 010-0000-0000'],
    ['LOCAL_ABSOLUTE_PATH_REFUSED', 'see:/Users/example/private.json'],
    ['CONTROL_CHARACTER_REFUSED', 'safe\u202Eunsafe'],
    ['INVALID_UNICODE_SCALAR', '\ud800'],
    ['PAGE_TEXT_TOO_LONG', 'x'.repeat(20_001)]
  ]) {
    expectCode(code, () => normalizePageText(text));
  }

  const noPages = makeBundle();
  noPages.pages = [];
  noPages.file.contentSha256 = '0'.repeat(64);
  expectCode('PAGE_COUNT_OUT_OF_BOUNDS', () => normalizeSourceDocumentBundle(noPages, { asOf: AS_OF }));

  const polluted = makeBundle();
  polluted.source = JSON.parse(`${JSON.stringify(polluted.source).slice(0, -1)},"__proto__":{"polluted":true}}`);
  expectCode('PROTOTYPE_KEY_REFUSED', () => normalizeSourceDocumentBundle(polluted, { asOf: AS_OF }));
});

test('audit-stage inspection uses the real source URL and revision validators without residual-count guesses', () => {
  const valid = inspectSourceDocumentValidationStages(makeBundle(), { asOf: AS_OF });
  assert.deepEqual(valid, { sourceUrl: 'PASSED', revision: 'PASSED', terminalErrorCode: '' });

  const missingRevision = makeBundle();
  delete missingRevision.revision;
  assert.deepEqual(inspectSourceDocumentValidationStages(missingRevision, { asOf: AS_OF }), {
    sourceUrl: 'PASSED',
    revision: 'FAILED',
    terminalErrorCode: 'REVISION_REQUIRED'
  });

  const malformedUrl = makeBundle();
  malformedUrl.source.sourceUrl = 'not a URL';
  assert.deepEqual(inspectSourceDocumentValidationStages(malformedUrl, { asOf: AS_OF }), {
    sourceUrl: 'FAILED',
    revision: 'NOT_EVALUATED',
    terminalErrorCode: 'MALFORMED_SOURCE_URL'
  });

  const unsupportedType = makeBundle();
  unsupportedType.source.documentType = 'TEXT';
  assert.deepEqual(inspectSourceDocumentValidationStages(unsupportedType, { asOf: AS_OF }), {
    sourceUrl: 'NOT_EVALUATED',
    revision: 'NOT_EVALUATED',
    terminalErrorCode: 'UNSUPPORTED_DOCUMENT_TYPE'
  });
});

test('catalog detects duplicates, conflicting file metadata, and enforces an explicit revision chain', () => {
  const firstRaw = makeBundle();
  const first = normalizeSourceDocumentBundle(firstRaw, { asOf: AS_OF });
  const secondPages = makePages('Revision 2: 정격 전압은 36 kV입니다.');
  const secondRaw = makeBundle({ pages: secondPages });
  secondRaw.revision = {
    ...secondRaw.revision,
    revisionId: 'R2',
    sequence: 2,
    publishedAt: '2026-05-01T00:00:00.000Z',
    effectiveAt: '2026-05-02T00:00:00.000Z',
    supersedesDocumentId: first.documentId
  };
  secondRaw.file = {
    sha256: sha256('synthetic source bytes mvs-001 revision 2'),
    byteLength: 5000,
    contentSha256: computeNormalizedContentSha256(secondPages)
  };
  const catalog = createSourceDocumentCatalog([secondRaw, firstRaw], { asOf: AS_OF });
  assert.equal(catalog.documents.length, 2);
  assert.deepEqual(catalog.supersessionEdges, [{
    supersededDocumentId: first.documentId,
    successorDocumentId: normalizeSourceDocumentBundle(secondRaw, { asOf: AS_OF }).documentId
  }]);
  assert.equal(catalog.productionReady, false);

  expectCode('DUPLICATE_DOCUMENT_ID', () => createSourceDocumentCatalog([firstRaw, structuredClone(firstRaw)], { asOf: AS_OF }));

  const conflictingFileMetadata = makeBundle();
  conflictingFileMetadata.source.title = 'Contradictory title for identical source bytes';
  expectCode('SOURCE_FILE_METADATA_CONFLICT', () => createSourceDocumentCatalog([firstRaw, conflictingFileMetadata], { asOf: AS_OF }));

  const missingLink = structuredClone(secondRaw);
  delete missingLink.revision.supersedesDocumentId;
  expectCode('SUPERSESSION_LINK_REQUIRED', () => createSourceDocumentCatalog([firstRaw, missingLink], { asOf: AS_OF }));
});
