import { canonicalStringify, sha256 } from '../../knowledge/claim-registry/index.mjs';

export const SYNTHETIC_BENCHMARK_AS_OF = '2026-06-01T00:00:00.000Z';
export const SYNTHETIC_BENCHMARK_SCHEMA_VERSION = 'official-evidence-synthetic-benchmark-v0';

const BASE_REVISION = Object.freeze({
  seriesId: 'synthetic-series-switchgear',
  revisionId: 'rev-1',
  sequence: 1,
  publishedAt: '2026-01-15T00:00:00.000Z',
  effectiveAt: '2026-01-15T00:00:00.000Z',
  retrievedAt: '2026-02-01T00:00:00.000Z'
});

const clone = (value) => structuredClone(value);

function sourceDigest(key, pages) {
  return sha256(canonicalStringify({ key, pages: pages.map(({ pageNumber, text }) => ({ pageNumber, text })) }));
}

function contentDigest(pages) {
  return sha256(canonicalStringify({
    normalizationVersion: 'page-text-nfc-lf-codepoint-v1',
    pages: pages.map(({ pageNumber, locator, text }) => ({ pageNumber, locator, text }))
  }));
}

function fixtureDocumentId(document) {
  return `doc_${sha256({
    schemaVersion: document.schemaVersion,
    synthetic: document.synthetic,
    source: document.source,
    revision: document.revision,
    file: document.file
  })}`;
}

export function createSyntheticDocument({
  key,
  title,
  language = 'en',
  productFamilies = ['medium_voltage_switchgear'],
  pages = ['Rated voltage: 24 kV.'],
  revision = {},
  source = {},
  file = {},
  extraction = {},
  documentId
}) {
  const normalizedPages = pages.map((page, index) => typeof page === 'string'
    ? { pageNumber: index + 1, locator: { type: 'DOCUMENT_PAGE', value: String(index + 1) }, text: page }
    : {
        locator: { type: 'DOCUMENT_PAGE', value: String(index + 1) },
        ...clone(page)
      });
  const digest = sourceDigest(key, normalizedPages);
  const raw = {
    schemaVersion: 'source-document-bundle-v0',
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    productionReady: false,
    synthetic: true,
    source: {
      sourceClass: 'SYNTHETIC_FIXTURE',
      publisher: 'Synthetic Electrical Evidence Laboratory',
      title: title || `Synthetic evidence document ${key}`,
      documentNumber: `SYNTH-${key.toUpperCase()}`,
      sourceUrl: `https://synthetic.example/evidence/${encodeURIComponent(key)}`,
      documentType: 'NORMALIZED_PAGE_TEXT_JSON',
      mimeType: 'application/json',
      language,
      vertical: 'datacenter',
      jurisdiction: 'KR',
      domain: 'electrical_power',
      productFamilies,
      authenticityStatus: 'UNREVIEWED',
      redistributionStatus: 'SYNTHETIC_FIXTURE_REDISTRIBUTION_PERMITTED',
      ...source
    },
    revision: {
      ...BASE_REVISION,
      seriesId: `synthetic-series-${key}`,
      ...revision
    },
    file: {
      sha256: digest,
      byteLength: Buffer.byteLength(canonicalStringify(normalizedPages), 'utf8'),
      contentSha256: contentDigest(normalizedPages),
      ...file
    },
    extraction: {
      method: 'PREEXTRACTED_PAGE_TEXT',
      extractorName: 'synthetic-page-text-fixture',
      extractorVersion: '1.0.0',
      extractedAt: '2026-05-01T00:00:00.000Z',
      normalizationVersion: 'page-text-nfc-lf-codepoint-v1',
      ...extraction
    },
    pages: normalizedPages
  };
  if (documentId) raw.documentId = documentId;
  return raw;
}

function scenario(id, category, phase, expected, documents, extra = {}) {
  return Object.freeze({ id, category, phase, expected: Object.freeze(expected), documents, ...extra });
}

function candidateProjection({
  value,
  extractionRuleId,
  productFamily = 'medium_voltage_switchgear',
  claimType = 'PRODUCT_CAPABILITY',
  conditions = [],
  extractionReasons = ['CONTEXT_AND_PRODUCT_SCOPE_REQUIRE_HUMAN_REVIEW', 'EXACT_LABEL_VALUE_MATCH']
}) {
  return Object.freeze({
    claimType,
    productFamily,
    projectStages: Object.freeze(['SPECIFICATION', 'TENDER']),
    value: Object.freeze(value),
    conditions: Object.freeze(conditions.map((condition) => Object.freeze(condition))),
    extractionRuleId,
    extractionReasons: Object.freeze(extractionReasons)
  });
}

export function createSyntheticBenchmarkFixture({ includeOversizedInputs = true } = {}) {
  const validSwitchgear = createSyntheticDocument({
    key: 'valid-switchgear',
    title: 'Synthetic MV switchgear technical schedule',
    pages: ['Product family: medium-voltage switchgear.\nRated voltage: 24 kV.']
  });
  const validTransformer = createSyntheticDocument({
    key: 'valid-transformer',
    title: 'Synthetic transformer technical schedule',
    productFamilies: ['transformer'],
    pages: ['Product family: transformer.\nRated power: 2500 kVA.\nPrimary voltage: 22.9 kV.']
  });
  const korean = createSyntheticDocument({
    key: 'korean-switchgear',
    title: '합성 중전압 배전반 기술자료',
    language: 'ko',
    pages: ['제품군: 중전압 배전반\n정격 전압: 24 kV.']
  });
  const english = createSyntheticDocument({
    key: 'english-transformer',
    title: 'Synthetic English transformer schedule',
    productFamilies: ['transformer'],
    pages: ['Rated power: 2000 kVA.']
  });
  const quantity = createSyntheticDocument({
    key: 'quantity-capability',
    pages: ['Rated voltage: 22.9 kV.']
  });
  const range = createSyntheticDocument({
    key: 'range-capability',
    productFamilies: ['transformer'],
    pages: ['Ambient temperature: -25 to 40 degC.']
  });
  const certification = createSyntheticDocument({
    key: 'certification',
    pages: ['Synthetic certification evidence.\nCertification: IEC 62271-200.\nEnd of synthetic evidence.']
  });
  const condition = createSyntheticDocument({
    key: 'operating-condition',
    pages: ['Rated voltage: 24 kV when installed indoors at altitude up to 1000 m.']
  });
  const limitation = createSyntheticDocument({
    key: 'limitation',
    pages: ['Limitation: indoor installation only. Rated voltage: 24 kV.']
  });
  const table = createSyntheticDocument({
    key: 'table-text',
    productFamilies: ['transformer'],
    pages: ['Specification | Value\nRated power: 3000 kVA\nPrimary voltage: 22.9 kV']
  });
  const repeated = createSyntheticDocument({
    key: 'repeated-quote',
    pages: ['Rated voltage: 24 kV.\nIntervening synthetic context.\nRated voltage: 24 kV.']
  });
  const repeatedAcrossPages = createSyntheticDocument({
    key: 'same-quote-different-pages',
    pages: ['Rated voltage: 24 kV.', 'Rated voltage: 24 kV.']
  });
  const oldRevision = createSyntheticDocument({
    key: 'supersession-old',
    pages: ['Synthetic prior revision evidence.\nRated voltage: 22.9 kV.\nEnd of synthetic evidence.'],
    revision: { seriesId: 'synthetic-series-supersession', revisionId: 'rev-1', sequence: 1 }
  });
  const newRevision = createSyntheticDocument({
    key: 'supersession-new',
    pages: ['Synthetic current revision evidence.\nRated voltage: 24 kV.\nEnd of synthetic evidence.'],
    revision: {
      seriesId: 'synthetic-series-supersession',
      revisionId: 'rev-2',
      sequence: 2,
      publishedAt: '2026-02-15T00:00:00.000Z',
      effectiveAt: '2026-03-01T00:00:00.000Z',
      retrievedAt: '2026-03-02T00:00:00.000Z'
    }
  });
  newRevision.revision.supersedesDocumentId = fixtureDocumentId(oldRevision);
  const conflictA = createSyntheticDocument({
    key: 'conflict-a',
    pages: ['Synthetic source A evidence.\nRated voltage: 22.9 kV.\nEnd of synthetic evidence.'],
    revision: { seriesId: 'synthetic-series-conflict-a' }
  });
  const conflictB = createSyntheticDocument({
    key: 'conflict-b',
    pages: ['Synthetic source B evidence.\nRated voltage: 24 kV.\nEnd of synthetic evidence.'],
    revision: { seriesId: 'synthetic-series-conflict-b' }
  });
  const conditionedA = createSyntheticDocument({
    key: 'condition-resolved-indoor',
    pages: ['Synthetic indoor configuration.\nRated voltage: 24 kV for indoor installation.\nEnd of synthetic evidence.']
  });
  const conditionedB = createSyntheticDocument({
    key: 'condition-resolved-outdoor',
    pages: ['Synthetic outdoor configuration.\nRated voltage: 22.9 kV for outdoor installation.\nEnd of synthetic evidence.']
  });

  const missingRevision = createSyntheticDocument({ key: 'missing-revision' });
  missingRevision.revision = null;
  const future = createSyntheticDocument({
    key: 'future-document',
    revision: {
      publishedAt: '2027-01-01T00:00:00.000Z',
      effectiveAt: '2027-01-01T00:00:00.000Z',
      retrievedAt: '2027-01-02T00:00:00.000Z'
    }
  });
  const malformedUrl = createSyntheticDocument({
    key: 'malformed-url', source: { sourceUrl: 'not a source URL' }
  });
  const credentialUrl = createSyntheticDocument({
    key: 'credential-url', source: { sourceUrl: 'https://fixture-user:fixture-pass@synthetic.example/evidence' }
  });
  const privateUrl = createSyntheticDocument({
    key: 'private-url', source: { sourceUrl: 'http://127.0.0.1/evidence' }
  });
  const fileHashMismatch = createSyntheticDocument({
    key: 'file-hash-mismatch', file: { sha256: '0'.repeat(64) }
  });
  const pageHashMismatch = createSyntheticDocument({ key: 'page-hash-mismatch' });
  pageHashMismatch.pages[0].textSha256 = '0'.repeat(64);
  const quoteAbsent = createSyntheticDocument({
    key: 'quote-absent', pages: ['Rated voltage: 24 kV.']
  });
  const ambiguousUnit = createSyntheticDocument({
    key: 'ambiguous-unit', pages: ['Rated voltage: 24.']
  });
  const incompatibleUnit = createSyntheticDocument({
    key: 'incompatible-unit', pages: ['Rated voltage: 24 kg.']
  });
  const unsupportedFamily = createSyntheticDocument({
    key: 'unsupported-family', productFamilies: ['energy_storage']
  });
  const marketing = createSyntheticDocument({
    key: 'marketing-only', pages: ['A revolutionary world-class synthetic power solution.']
  });
  const secretShaped = createSyntheticDocument({
    key: 'secret-shaped', pages: ['Synthetic credential test: api_key=fixture_value_1234567890.']
  });
  const piiShaped = createSyntheticDocument({
    key: 'pii-shaped', pages: ['Synthetic contact test: reviewer.fixture@example.test.']
  });
  const oversized = createSyntheticDocument({
    key: 'oversized-page', pages: [includeOversizedInputs ? 'X'.repeat(20_001) : 'OVERSIZED_INPUT_GENERATED_AT_RUNTIME']
  });
  const excessivePages = createSyntheticDocument({
    key: 'excessive-page-count',
    pages: Array.from({ length: includeOversizedInputs ? 101 : 1 }, (_, index) => `Synthetic page ${index + 1}.`)
  });
  const duplicateDocumentA = createSyntheticDocument({ key: 'duplicate-document-a' });
  const duplicateDocumentB = clone(duplicateDocumentA);
  const duplicateCandidateDocument = createSyntheticDocument({
    key: 'duplicate-candidate-changed-content',
    pages: ['Rated voltage: 24 kV.\nRated voltage: 22.9 kV.']
  });
  const rawPdf = createSyntheticDocument({
    key: 'raw-pdf-no-parser',
    source: { documentType: 'RAW_PDF', mimeType: 'application/pdf' },
    extraction: { method: 'RAW_PDF' }
  });
  const unsupportedType = createSyntheticDocument({
    key: 'unsupported-file-type',
    source: { documentType: 'WORD_DOCUMENT', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
  });

  const ratedVoltage24 = candidateProjection({
    value: { type: 'QUANTITY', key: 'rated_voltage', value: 24, unit: 'kV', quantityKind: 'voltage' },
    extractionRuleId: 'OECRW0-PC-MVS-RATED-VOLTAGE'
  });
  const primaryVoltage229 = candidateProjection({
    productFamily: 'transformer',
    value: { type: 'QUANTITY', key: 'primary_voltage', value: 22.9, unit: 'kV', quantityKind: 'voltage' },
    extractionRuleId: 'OECRW0-PC-TR-INPUT-VOLTAGE'
  });

  const scenarios = [
    scenario('01_valid_switchgear_datasheet', 'valid switchgear datasheet', 'document-candidate', { accepted: true, candidateProjections: [ratedVoltage24] }, [validSwitchgear]),
    scenario('02_valid_transformer_datasheet', 'valid transformer datasheet', 'document-candidate', { accepted: true, candidateProjections: [
      primaryVoltage229,
      candidateProjection({
        productFamily: 'transformer',
        value: { type: 'QUANTITY', key: 'transformer_capacity', value: 2500, unit: 'kVA', quantityKind: 'apparent_power' },
        extractionRuleId: 'OECRW0-PC-TR-RATED-POWER'
      })
    ] }, [validTransformer]),
    scenario('03_korean_product_document', 'Korean product document', 'document-candidate', { accepted: true, language: 'ko', candidateProjections: [ratedVoltage24] }, [korean]),
    scenario('04_english_product_document', 'English product document', 'document-candidate', { accepted: true, language: 'en', candidateProjections: [candidateProjection({
      productFamily: 'transformer',
      value: { type: 'QUANTITY', key: 'transformer_capacity', value: 2000, unit: 'kVA', quantityKind: 'apparent_power' },
      extractionRuleId: 'OECRW0-PC-TR-RATED-POWER'
    })] }, [english]),
    scenario('05_quantity_capability', 'quantity capability', 'document-candidate', { accepted: true, candidateProjections: [candidateProjection({
      value: { type: 'QUANTITY', key: 'rated_voltage', value: 22.9, unit: 'kV', quantityKind: 'voltage' },
      extractionRuleId: 'OECRW0-PC-MVS-RATED-VOLTAGE'
    })] }, [quantity]),
    scenario('06_range_capability', 'range capability', 'document-candidate', { accepted: true, candidateProjections: [candidateProjection({
      productFamily: 'transformer',
      value: { type: 'RANGE', key: 'ambient_temperature', minimum: -25, maximum: 40, unit: 'degC', quantityKind: 'temperature' },
      conditions: [{ id: 'operating_condition', value: 'document_stated_range' }],
      extractionRuleId: 'OECRW0-PC-COMMON-AMBIENT-TEMPERATURE'
    })] }, [range]),
    scenario('07_certification_statement', 'certification statement', 'document-candidate', { accepted: true, candidateProjections: [candidateProjection({
      claimType: 'CERTIFICATION',
      value: { type: 'STRING_SET', key: 'certification', value: ['IEC 62271-200'] },
      extractionRuleId: 'OECRW0-CERT-EXPLICIT-STANDARD',
      extractionReasons: ['CONTEXT_AND_PRODUCT_SCOPE_REQUIRE_HUMAN_REVIEW', 'EXPLICIT_CERTIFICATION_TOKEN']
    })] }, [certification]),
    scenario('08_operating_condition', 'operating-condition statement', 'document-candidate', { accepted: true, candidateProjections: [candidateProjection({
      value: { type: 'QUANTITY', key: 'rated_voltage', value: 24, unit: 'kV', quantityKind: 'voltage' },
      conditions: [{ id: 'altitude', value: 'maximum_1000_m' }],
      extractionRuleId: 'OECRW0-PC-MVS-RATED-VOLTAGE',
      extractionReasons: ['CONTEXT_AND_PRODUCT_SCOPE_REQUIRE_HUMAN_REVIEW', 'EXACT_LABEL_VALUE_MATCH', 'EXPLICIT_LIMITATION_OR_EXCLUSION']
    })] }, [condition]),
    scenario('09_limitation_disqualifier', 'limitation or disqualifier', 'document-candidate', { accepted: true, candidateProjections: [candidateProjection({
      value: { type: 'QUANTITY', key: 'rated_voltage', value: 24, unit: 'kV', quantityKind: 'voltage' },
      conditions: [{ id: 'installation_condition', value: 'indoor_only' }],
      extractionRuleId: 'OECRW0-PC-MVS-RATED-VOLTAGE',
      extractionReasons: ['CONTEXT_AND_PRODUCT_SCOPE_REQUIRE_HUMAN_REVIEW', 'EXACT_LABEL_VALUE_MATCH', 'EXPLICIT_LIMITATION_OR_EXCLUSION']
    })] }, [limitation]),
    scenario('10_table_like_text', 'table-like extracted text', 'document-candidate', { accepted: true, candidateProjections: [
      primaryVoltage229,
      candidateProjection({
        productFamily: 'transformer',
        value: { type: 'QUANTITY', key: 'transformer_capacity', value: 3000, unit: 'kVA', quantityKind: 'apparent_power' },
        extractionRuleId: 'OECRW0-PC-TR-RATED-POWER'
      })
    ] }, [table]),
    scenario('11_repeated_quote_one_page', 'repeated quote on one page', 'anchor', { accepted: true, occurrenceCount: 2 }, [repeated], { quote: 'Rated voltage: 24 kV.', occurrenceIndex: 1 }),
    scenario('12_same_quote_different_pages', 'same quote on different pages', 'anchor', { accepted: true, distinctAnchorIds: true }, [repeatedAcrossPages], { quote: 'Rated voltage: 24 kV.' }),
    scenario('13_superseded_revision', 'superseded revision', 'relationship', { accepted: true, supersessionCount: 1 }, [oldRevision, newRevision]),
    scenario('14_conflicting_revision', 'conflicting revision', 'relationship', { accepted: true, conflictCount: 1 }, [conflictA, conflictB]),
    scenario('15_conditions_resolve_conflict', 'conditions resolving apparent conflict', 'relationship', { accepted: true, conflictCount: 0 }, [conditionedA, conditionedB]),
    scenario('16_missing_revision', 'missing revision', 'document-rejection', { accepted: false, errorCode: 'REVISION_REQUIRED' }, [missingRevision]),
    scenario('17_future_dated_document', 'future-dated document', 'document-rejection', { accepted: false, errorCode: 'FUTURE_DOCUMENT_DATE' }, [future]),
    scenario('18_malformed_source_url', 'malformed source URL', 'document-rejection', { accepted: false, errorCode: 'MALFORMED_SOURCE_URL' }, [malformedUrl]),
    scenario('19_url_with_credentials', 'URL with credentials', 'document-rejection', { accepted: false, errorCode: 'SOURCE_CREDENTIALS_REFUSED' }, [credentialUrl]),
    scenario('20_private_url', 'private URL', 'document-rejection', { accepted: false, errorCode: 'PRIVATE_SOURCE_URL_REFUSED' }, [privateUrl]),
    scenario('21_file_hash_mismatch', 'source-file hash mismatch', 'intake-rejection', { accepted: false, errorCode: 'INTAKE_FILE_SHA256_MISMATCH' }, [fileHashMismatch]),
    scenario('22_page_hash_mismatch', 'page-text hash mismatch', 'document-rejection', { accepted: false, errorCode: 'PAGE_TEXT_SHA256_MISMATCH' }, [pageHashMismatch]),
    scenario('23_quote_absent', 'quote absent from page', 'anchor-rejection', { accepted: false, errorCode: 'PAGE_QUOTE_MISMATCH' }, [quoteAbsent], { quote: 'Rated voltage: 36 kV.' }),
    scenario('24_ambiguous_unit', 'ambiguous unit', 'candidate-rejection', { accepted: true, candidateProjections: [] }, [ambiguousUnit]),
    scenario('25_incompatible_unit', 'incompatible unit', 'candidate-rejection', { accepted: true, candidateProjections: [] }, [incompatibleUnit]),
    scenario('26_unsupported_product_family', 'unsupported product family', 'document-rejection', { accepted: false, errorCode: 'OUT_OF_SCOPE_PRODUCT_FAMILY' }, [unsupportedFamily]),
    scenario('27_marketing_only', 'marketing-only statement', 'candidate-rejection', { accepted: true, candidateProjections: [] }, [marketing]),
    scenario('28_secret_shaped_text', 'secret-shaped text', 'document-rejection', { accepted: false, errorCode: 'SECRET_SHAPED_VALUE' }, [secretShaped]),
    scenario('29_personal_information_shaped_text', 'personal-information-shaped text', 'document-rejection', { accepted: false, errorCode: 'PRIVATE_DATA_SHAPED_VALUE' }, [piiShaped]),
    scenario('30_oversized_page', 'oversized page', 'document-rejection', { accepted: false, errorCode: 'PAGE_TEXT_TOO_LONG' }, [oversized]),
    scenario('31_excessive_page_count', 'excessive page count', 'document-rejection', { accepted: false, errorCode: 'PAGE_COUNT_OUT_OF_BOUNDS' }, [excessivePages]),
    scenario('32_duplicate_document_id', 'duplicate document ID', 'catalog-rejection', { accepted: false, errorCode: 'DUPLICATE_DOCUMENT_ID' }, [duplicateDocumentA, duplicateDocumentB]),
    scenario('33_duplicate_candidate_changed_content', 'duplicate candidate ID with changed content', 'candidate-set-rejection', { accepted: false, errorCode: 'CANDIDATE_ID_MISMATCH' }, [duplicateCandidateDocument]),
    scenario('34_raw_pdf_without_parser', 'encrypted or malformed PDF when parser exists', 'document-rejection', { accepted: false, errorCode: 'RAW_PDF_PARSER_UNAVAILABLE' }, [rawPdf]),
    scenario('35_unsupported_file_type', 'unsupported file type', 'document-rejection', { accepted: false, errorCode: 'UNSUPPORTED_DOCUMENT_TYPE' }, [unsupportedType])
  ];

  return Object.freeze({
    schemaVersion: SYNTHETIC_BENCHMARK_SCHEMA_VERSION,
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    productionReady: false,
    issue165Status: 'HOLD',
    synthetic: true,
    asOf: SYNTHETIC_BENCHMARK_AS_OF,
    scenarioOrder: Object.freeze(scenarios.map(({ id }) => id)),
    scenarios: Object.freeze(scenarios)
  });
}

export function createSyntheticDemoDocuments() {
  const fixture = createSyntheticBenchmarkFixture({ includeOversizedInputs: false });
  const allowed = new Set([
    '01_valid_switchgear_datasheet',
    '02_valid_transformer_datasheet',
    '03_korean_product_document',
    '07_certification_statement',
    '10_table_like_text',
    '11_repeated_quote_one_page',
    '12_same_quote_different_pages',
    '13_superseded_revision',
    '14_conflicting_revision',
    '15_conditions_resolve_conflict'
  ]);
  return fixture.scenarios
    .filter(({ id }) => allowed.has(id))
    .flatMap(({ documents }) => documents.map(clone));
}
