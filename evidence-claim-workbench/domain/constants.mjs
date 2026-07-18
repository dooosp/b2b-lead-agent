export const SOURCE_DOCUMENT_BUNDLE_SCHEMA_VERSION = 'source-document-bundle-v0';
export const SOURCE_DOCUMENT_CATALOG_SCHEMA_VERSION = 'source-document-catalog-v0';
export const PAGE_EVIDENCE_ANCHOR_SCHEMA_VERSION = 'page-evidence-anchor-v0';
export const EVIDENCE_INTAKE_MANIFEST_SCHEMA_VERSION = 'official-evidence-intake-manifest-v0';
export const EVIDENCE_INTAKE_RESULT_SCHEMA_VERSION = 'official-evidence-intake-result-v0';

export const NON_PRODUCTION_BOUNDARY = 'NOT_PRODUCTION_EVIDENCE';
export const PAGE_TEXT_NORMALIZATION_VERSION = 'page-text-nfc-lf-codepoint-v1';

export const OFFICIAL_EVIDENCE_SCOPE = Object.freeze({
  verticalId: 'datacenter',
  jurisdiction: 'KR',
  domain: 'electrical_power',
  productFamilies: Object.freeze(['medium_voltage_switchgear', 'transformer']),
  languages: Object.freeze(['en', 'ko'])
});

// The shipped Claim Registry uses its older canonical identifier. Keep that
// implementation adapter explicit instead of leaking it into Workbench scope.
export const CLAIM_REGISTRY_VERTICAL_ID = 'datacenter_infrastructure';

export const SOURCE_CLASSES = Object.freeze([
  'OFFICIAL_MANUFACTURER',
  'OFFICIAL_REGULATOR',
  'OFFICIAL_STANDARDS_BODY',
  'SYNTHETIC_FIXTURE'
]);

export const SOURCE_DOCUMENT_TYPE = 'NORMALIZED_PAGE_TEXT_JSON';
export const SOURCE_DOCUMENT_MIME_TYPE = 'application/json';
export const SOURCE_AUTHENTICITY_STATUS = 'UNREVIEWED';
export const SOURCE_EXTRACTION_METHOD = 'PREEXTRACTED_PAGE_TEXT';
export const REDISTRIBUTION_STATUSES = Object.freeze([
  'METADATA_AND_BOUNDED_EXCERPTS_ONLY',
  'SYNTHETIC_FIXTURE_REDISTRIBUTION_PERMITTED'
]);

export const EVIDENCE_DOCUMENT_LIMITS = Object.freeze({
  maxCatalogDocuments: 100,
  maxIntakeDocuments: 10,
  maxPagesPerDocument: 100,
  maxPageCodePoints: 20_000,
  maxDocumentCodePoints: 500_000,
  maxDeclaredSourceBytes: 25_000_000,
  maxIntakeFileBytes: 1_000_000,
  maxManifestBytes: 256_000,
  maxPublisherCodePoints: 300,
  maxTitleCodePoints: 500,
  maxIdentifierCodePoints: 120,
  maxExtractorCodePoints: 120,
  maxQuoteCodePoints: 500,
  contextCodePoints: 64,
  maxDepth: 12
});

export const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;
export const SAFE_IDENTIFIER_PATTERN = /^[a-z0-9][a-z0-9._-]{1,119}$/;
export const DOCUMENT_ID_PATTERN = /^doc_[a-f0-9]{64}$/;
export const ANCHOR_ID_PATTERN = /^anc_[a-f0-9]{64}$/;
