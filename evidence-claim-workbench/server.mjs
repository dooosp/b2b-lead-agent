import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  assertSafeArtifact,
  canonicalStringify
} from '../knowledge/claim-registry/index.mjs';
import {
  CAPABILITY_TAXONOMY,
  CONDITION_IDS,
  PROJECT_STAGES,
  PRODUCT_FAMILIES,
  SUPPORTED_CLAIM_TYPES,
  SUPPORTED_VALUE_TYPES,
  createCandidate,
  formatCandidateStatement
} from './domain/candidates.mjs';
import { createSourceDocumentCatalog } from './domain/document-bundle.mjs';
import { createPageEvidenceAnchor } from './domain/evidence-anchor.mjs';
import { loadEvidenceInbox } from './domain/intake.mjs';
import { analyzeCandidateRelationships } from './domain/relationships.mjs';
import {
  COMPATIBLE_REASON_CODES,
  REVIEW_DECISIONS,
  createReviewDecision
} from './domain/review-decisions.mjs';
import {
  createReviewPatch,
  validateReviewPatch
} from './domain/review-patch.mjs';
import {
  SYNTHETIC_BENCHMARK_AS_OF,
  createSyntheticDemoDocuments
} from './fixtures/synthetic-benchmark-v0.mjs';
import {
  renderOfficialEvidenceWorkbenchErrorPage,
  renderOfficialEvidenceWorkbenchPage
} from './renderer.mjs';

export const WORKBENCH_DEFAULT_PORT = 4183;
export const WORKBENCH_MAX_REQUEST_BYTES = 64 * 1024;
export const WORKBENCH_MAX_RESPONSE_BYTES = 1024 * 1024;
export const WORKBENCH_CSP = "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'none'; font-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; worker-src 'none'; manifest-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
export const WORKBENCH_BASE_COMMIT_SHA = '9d144fbe6309ce363f9dad8d50ffa713d24af683';
export const WORKBENCH_REGISTRY_PATH = 'knowledge/claim-registry/synthetic/datacenter-claims-v1.json';
export const WORKBENCH_REPOSITORY_ROOT = fileURLToPath(new URL('../', import.meta.url));

const STATIC_ASSETS = Object.freeze({
  '/assets/app.js': Object.freeze({ url: new URL('./assets/app.js', import.meta.url), type: 'text/javascript; charset=utf-8' }),
  '/assets/browser-effects.mjs': Object.freeze({ url: new URL('./assets/browser-effects.mjs', import.meta.url), type: 'text/javascript; charset=utf-8' }),
  '/assets/styles.css': Object.freeze({ url: new URL('./assets/styles.css', import.meta.url), type: 'text/css; charset=utf-8' })
});
const SAFE_CAPABILITY_TOKEN = /^[a-f0-9]{64}$/;
const SAFE_IDENTIFIER = /^[a-z0-9][a-z0-9._:-]{0,127}$/;
const SAFE_ROUTE = /^\/[a-z0-9/._-]*$/;
const ALLOWED_UNITS = new Set(['', 'V', 'kV', 'A', 'kA', 'VA', 'kVA', 'MVA', 'Hz', 'degC', 'm', 'mm', '%']);
const UI_REQUEST_KEYS = new Set(['schemaVersion', 'reviews']);
const UI_REVIEW_KEYS = new Set(['candidateId', 'decision', 'reasonCode', 'fields', 'acknowledged']);
const UI_FIELD_KEYS = new Set([
  'claimType', 'productFamily', 'capabilityKey', 'valueType', 'value', 'minimum', 'maximum',
  'unit', 'conditionKey', 'conditionValue', 'jurisdiction', 'projectStage', 'validUntil'
]);

class WorkbenchServerError extends Error {
  constructor(code, path = '$') {
    super(`${code} at ${path}`);
    this.name = 'WorkbenchServerError';
    this.code = code;
    this.path = path;
  }
}

function fail(code, path) {
  throw new WorkbenchServerError(code, path);
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertExactKeys(value, allowed, path) {
  if (!isPlainObject(value)) fail('OBJECT_REQUIRED', path);
  for (const key of Object.keys(value)) if (!allowed.has(key)) fail('UNKNOWN_FIELD_REFUSED', `${path}.${key}`);
}

function compareAscii(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function parseWorkbenchHost(value) {
  if (value !== '127.0.0.1' && value !== '::1') fail('WORKBENCH_NON_LOOPBACK_HOST_REFUSED', '$.host');
  return value;
}

export function parseWorkbenchPort(value, { allowZero = true } = {}) {
  const text = typeof value === 'number' ? String(value) : value;
  if (typeof text !== 'string' || !/^(?:0|[1-9][0-9]{0,4})$/.test(text)) fail('WORKBENCH_PORT_INVALID', '$.port');
  const port = Number(text);
  if (!Number.isSafeInteger(port) || port > 65535 || (port === 0 ? !allowZero : port < 1024)) fail('WORKBENCH_PORT_INVALID', '$.port');
  return port;
}

export function parseWorkbenchAsOf(value) {
  if (typeof value !== 'string') fail('WORKBENCH_REAL_INTAKE_AS_OF_REQUIRED', '$.asOf');
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) fail('WORKBENCH_REAL_INTAKE_AS_OF_INVALID', '$.asOf');
  return value;
}

function originFor(host, port) {
  return `http://${host === '::1' ? '[::1]' : host}:${port}`;
}

function hostHeaderAllowed(value, host, port) {
  const expected = host === '::1' ? `[::1]:${port}` : `${host}:${port}`;
  return value === expected;
}

function originHeaderAllowed(value, host, port, { required = false } = {}) {
  if (value === undefined) return !required;
  return value === originFor(host, port);
}

function fetchMetadataAllowed(request, { api = false } = {}) {
  const site = request.headers['sec-fetch-site'];
  if (site !== undefined && !['same-origin', 'none'].includes(site)) return false;
  if (api && site === 'none') return false;
  return true;
}

function securityHeaders(contentType) {
  return {
    'Cache-Control': 'private, no-store, max-age=0',
    Pragma: 'no-cache',
    'Content-Type': contentType,
    'Content-Security-Policy': WORKBENCH_CSP,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), microphone=(), payment=(), usb=(), browsing-topics=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin'
  };
}

function send(response, status, contentType, body, { head = false, headers = {} } = {}) {
  const payload = Buffer.from(body, 'utf8');
  if (payload.byteLength > WORKBENCH_MAX_RESPONSE_BYTES) fail('WORKBENCH_RESPONSE_TOO_LARGE', '$.response');
  response.writeHead(status, {
    ...securityHeaders(contentType),
    ...headers,
    'Content-Length': String(payload.byteLength)
  });
  response.end(head ? undefined : payload);
}

function sendJson(response, status, value, options) {
  send(response, status, 'application/json; charset=utf-8', `${canonicalStringify(value)}\n`, options);
}

function parseRoute(rawUrl) {
  if (typeof rawUrl !== 'string'
    || rawUrl.length > 128
    || !rawUrl.startsWith('/')
    || rawUrl.startsWith('//')
    || rawUrl.includes('%')
    || rawUrl.includes('\\')
    || rawUrl.includes('?')
    || rawUrl.includes('#')
    || rawUrl.includes('..')
    || rawUrl.includes('\0')
    || !SAFE_ROUTE.test(rawUrl)) return { kind: 'INVALID' };
  if (rawUrl === '/') return { kind: 'PAGE' };
  if (rawUrl === '/api/catalog') return { kind: 'API_CATALOG' };
  if (rawUrl === '/api/patch') return { kind: 'API_PATCH' };
  if (Object.hasOwn(STATIC_ASSETS, rawUrl)) return { kind: 'ASSET', path: rawUrl };
  return { kind: 'UNKNOWN' };
}

async function loadStaticAssets() {
  const entries = await Promise.all(Object.entries(STATIC_ASSETS).map(async ([route, definition]) => {
    const content = await readFile(fileURLToPath(definition.url), 'utf8');
    if (Buffer.byteLength(content, 'utf8') > WORKBENCH_MAX_RESPONSE_BYTES) fail('WORKBENCH_ASSET_TOO_LARGE', '$.assets');
    return [route, Object.freeze({ content, type: definition.type })];
  }));
  return new Map(entries);
}

function createLineAnchors(document) {
  const anchors = [];
  for (const page of document.pages) {
    const pageCodePoints = [...page.text];
    let start = 0;
    while (start < pageCodePoints.length) {
      let end = pageCodePoints.indexOf('\n', start);
      if (end < 0) end = pageCodePoints.length;
      const quote = pageCodePoints.slice(start, end).join('').trim();
      if (quote && [...quote].length <= 500) {
        const leading = pageCodePoints.slice(start, end).join('').indexOf(quote);
        const quoteStart = start + [...pageCodePoints.slice(start, start + Math.max(0, leading)).join('')].length;
        const occurrences = page.text.split(quote).length - 1;
        const priorText = pageCodePoints.slice(0, quoteStart).join('');
        const occurrenceIndex = priorText.split(quote).length;
        anchors.push(createPageEvidenceAnchor(document, {
          pageNumber: page.pageNumber,
          startCodePoint: quoteStart,
          endCodePoint: quoteStart + [...quote].length,
          quote,
          ...(occurrences > 1 ? { occurrenceIndex } : {})
        }));
      }
      start = end + 1;
    }
  }
  return anchors;
}

function documentMetadata(document) {
  return {
    documentId: document.documentId,
    synthetic: document.synthetic,
    title: document.source.title,
    publisher: document.source.publisher,
    documentNumber: document.source.documentNumber,
    documentType: document.source.documentType,
    sourceUrl: document.source.sourceUrl,
    language: document.source.language,
    vertical: document.source.vertical,
    jurisdiction: document.source.jurisdiction,
    domain: document.source.domain,
    productFamilies: document.source.productFamilies,
    authenticityStatus: document.source.authenticityStatus,
    redistributionStatus: document.source.redistributionStatus,
    revision: document.revision.revisionId,
    revisionSequence: document.revision.sequence,
    revisionSeriesId: document.revision.seriesId,
    publishedAt: document.revision.publishedAt,
    effectiveAt: document.revision.effectiveAt,
    retrievedAt: document.revision.retrievedAt,
    validUntil: document.revision.validUntil ?? null,
    supersedesDocumentId: document.revision.supersedesDocumentId ?? null,
    fileSha256: document.file.sha256,
    contentSha256: document.file.contentSha256,
    fileByteLength: document.file.byteLength,
    pageCount: document.pages.length,
    reviewState: 'REVIEW_REQUIRED'
  };
}

function candidateTransport(candidate, anchor, relationships) {
  return {
    candidateId: candidate.candidateId,
    documentId: candidate.documentId,
    evidenceAnchorId: candidate.evidenceAnchorId,
    pageNumber: anchor.page.extractedPageOrdinal,
    pageLocator: anchor.page.locator,
    exactQuote: anchor.selection.quote,
    quoteSha256: anchor.selection.quoteSha256,
    contextBefore: anchor.selection.prefixContext,
    contextAfter: anchor.selection.suffixContext,
    startCodePoint: anchor.selection.startCodePoint,
    endCodePoint: anchor.selection.endCodePoint,
    occurrenceIndex: anchor.selection.occurrenceIndex,
    occurrenceCount: anchor.selection.occurrenceCount,
    claimType: candidate.claimType,
    statement: candidate.statement,
    productFamily: candidate.subject.id,
    capabilityKey: candidate.value.key,
    value: candidate.value,
    applicability: candidate.applicability,
    validity: candidate.validity,
    extractionMethod: candidate.extractionMethod,
    extractionRuleId: candidate.extractionRuleId,
    extractionReasons: candidate.extractionReasons,
    reviewState: 'REVIEW_REQUIRED',
    relationships: relationships
      .filter((relationship) => relationship.candidateIds.includes(candidate.candidateId))
      .map((relationship) => ({
        relationshipId: relationship.relationshipId,
        type: relationship.type,
        blocking: relationship.blocking,
        reasonCodes: relationship.reasonCodes,
        relatedCandidateIds: relationship.candidateIds.filter((id) => id !== candidate.candidateId),
        supersededCandidateId: relationship.supersededCandidateId ?? null,
        successorCandidateId: relationship.successorCandidateId ?? null
      }))
  };
}

async function createWorkbenchCatalog(sourceCatalog, {
  synthetic,
  generatedAt,
  intakeManifest = null
} = {}) {
  if (typeof synthetic !== 'boolean') fail('WORKBENCH_CATALOG_MODE_INVALID', '$.synthetic');
  const fixedGeneratedAt = parseWorkbenchAsOf(generatedAt);
  if (!sourceCatalog || !Array.isArray(sourceCatalog.documents) || sourceCatalog.documents.length < 1) {
    fail('WORKBENCH_SOURCE_CATALOG_INVALID', '$.sourceCatalog');
  }
  if (sourceCatalog.documents.some((document) => document.synthetic !== synthetic)) {
    fail('WORKBENCH_CATALOG_MODE_MISMATCH', '$.sourceCatalog.documents');
  }
  const anchorsById = new Map();
  const candidates = [];
  const { extractDeterministicCandidates } = await import('./domain/candidates.mjs');
  for (const document of sourceCatalog.documents) {
    const anchors = createLineAnchors(document);
    anchors.forEach((anchor) => anchorsById.set(anchor.anchorId, anchor));
    if (anchors.length) candidates.push(...extractDeterministicCandidates({ document, anchors }));
  }
  const relationshipReport = analyzeCandidateRelationships(candidates, { documents: sourceCatalog.documents });
  const candidatesByDocument = new Map(sourceCatalog.documents.map((document) => [document.documentId, []]));
  for (const candidate of candidates) {
    const anchor = anchorsById.get(candidate.evidenceAnchorId);
    if (!anchor) continue;
    candidatesByDocument.get(candidate.documentId)?.push(candidateTransport(candidate, anchor, relationshipReport.relationships));
  }
  const documents = sourceCatalog.documents.map((document) => {
    const documentCandidates = candidatesByDocument.get(document.documentId) || [];
    const pages = document.pages.map((page) => ({
      pageNumber: page.pageNumber,
      locator: page.locator,
      text: page.text,
      textSha256: page.textSha256,
      codePointLength: page.codePointLength,
      candidates: documentCandidates.filter((candidate) => candidate.pageNumber === page.pageNumber)
    }));
    const relationshipMarkers = [...new Set(documentCandidates.flatMap((candidate) => candidate.relationships.map(({ type }) => type)))].sort(compareAscii);
    return { ...documentMetadata(document), relationshipMarkers, pages };
  });
  const catalog = {
    schemaVersion: 'official-evidence-workbench-catalog-v0',
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    productionReady: false,
    productionReviewerWorkflowReady: false,
    issue165Status: 'HOLD',
    automaticVerification: false,
    customerUseAllowed: false,
    reviewerIdentity: 'NOT_COLLECTED',
    synthetic,
    asOf: sourceCatalog.asOf,
    patchBase: {
      commitSha: WORKBENCH_BASE_COMMIT_SHA,
      registryPath: WORKBENCH_REGISTRY_PATH,
      generatedAt: fixedGeneratedAt
    },
    documents,
    relationshipSummary: relationshipReport.metrics
  };
  if (!synthetic) {
    if (!intakeManifest
      || typeof intakeManifest.fileSha256 !== 'string'
      || !Number.isInteger(intakeManifest.documentCount)
      || intakeManifest.documentCount !== documents.length) {
      fail('WORKBENCH_REAL_INTAKE_MANIFEST_INVALID', '$.intakeManifest');
    }
    catalog.intake = {
      mode: 'REAL_MANIFEST_BOUND',
      population: 'LOADED_UNVERIFIED',
      manifestSha256: intakeManifest.fileSha256,
      documentCount: intakeManifest.documentCount,
      verifiedClaimCount: 0,
      customerUseAllowedCount: 0
    };
  }
  assertSafeArtifact(catalog);
  Object.defineProperty(catalog, 'domainState', {
    enumerable: false,
    configurable: false,
    writable: false,
    value: Object.freeze({
      documents: sourceCatalog.documents,
      anchorsById,
      candidatesById: new Map(candidates.map((candidate) => [candidate.candidateId, candidate])),
      relationshipReport
    })
  });
  return catalog;
}

export async function loadDefaultWorkbenchCatalog() {
  const rawDocuments = createSyntheticDemoDocuments();
  const sourceCatalog = createSourceDocumentCatalog(rawDocuments, { asOf: SYNTHETIC_BENCHMARK_AS_OF });
  return createWorkbenchCatalog(sourceCatalog, {
    synthetic: true,
    generatedAt: SYNTHETIC_BENCHMARK_AS_OF
  });
}

export async function loadEvidenceInboxWorkbenchCatalog({
  ownedRoot = WORKBENCH_REPOSITORY_ROOT,
  asOf
} = {}) {
  const fixedAsOf = parseWorkbenchAsOf(asOf);
  const intake = await loadEvidenceInbox({ ownedRoot, asOf: fixedAsOf });
  return createWorkbenchCatalog(intake.catalog, {
    synthetic: false,
    generatedAt: fixedAsOf,
    intakeManifest: intake.manifest
  });
}

function capabilityTokenMatches(provided, expected) {
  if (typeof provided !== 'string' || !SAFE_CAPABILITY_TOKEN.test(provided)) return false;
  return timingSafeEqual(Buffer.from(provided, 'hex'), Buffer.from(expected, 'hex'));
}

async function readRequestBody(request) {
  const length = request.headers['content-length'];
  if (request.headers['transfer-encoding']) fail('TRANSFER_ENCODING_REFUSED', '$.headers');
  if (length !== undefined && (!/^\d+$/.test(length) || Number(length) > WORKBENCH_MAX_REQUEST_BYTES)) fail('REQUEST_BODY_TOO_LARGE', '$.body');
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.byteLength;
    if (total > WORKBENCH_MAX_REQUEST_BYTES) fail('REQUEST_BODY_TOO_LARGE', '$.body');
    chunks.push(chunk);
  }
  if (total === 0) fail('REQUEST_BODY_REQUIRED', '$.body');
  let source;
  try {
    source = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
  } catch {
    fail('INVALID_UTF8', '$.body');
  }
  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch {
    fail('INVALID_JSON', '$.body');
  }
  assertSafeArtifact(parsed);
  return parsed;
}

function normalizeUiValue(fields, taxonomy) {
  if (!SUPPORTED_VALUE_TYPES.includes(fields.valueType) || !taxonomy.types.includes(fields.valueType)) fail('VALUE_TYPE_MISMATCH', '$.fields.valueType');
  if (!ALLOWED_UNITS.has(fields.unit)) fail('UNIT_NOT_ALLOWED', '$.fields.unit');
  if (fields.valueType === 'QUANTITY') {
    const value = Number(fields.value);
    if (!Number.isFinite(value) || !taxonomy.units.includes(fields.unit)) fail('QUANTITY_INVALID', '$.fields.value');
    return { type: 'QUANTITY', key: fields.capabilityKey, value, unit: fields.unit, quantityKind: taxonomy.quantityKind };
  }
  if (fields.valueType === 'RANGE') {
    const minimum = Number(fields.minimum);
    const maximum = Number(fields.maximum);
    if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum > maximum || !taxonomy.units.includes(fields.unit)) fail('RANGE_INVALID', '$.fields');
    return { type: 'RANGE', key: fields.capabilityKey, minimum, maximum, unit: fields.unit, quantityKind: taxonomy.quantityKind };
  }
  if (fields.unit !== '') fail('UNIT_NOT_APPLICABLE', '$.fields.unit');
  const raw = typeof fields.value === 'string' ? fields.value.trim() : '';
  if (!raw || raw.length > 160) fail('VALUE_INVALID', '$.fields.value');
  if (fields.valueType === 'STRING_SET') {
    const values = [...new Set(raw.split(',').map((value) => value.trim()).filter(Boolean))].sort(compareAscii);
    if (!values.length || values.length > 10) fail('VALUE_INVALID', '$.fields.value');
    return { type: 'STRING_SET', key: fields.capabilityKey, value: values };
  }
  return { type: 'ENUM', key: fields.capabilityKey, value: raw };
}

function createEditedCandidate(base, fields) {
  assertExactKeys(fields, UI_FIELD_KEYS, '$.fields');
  if (!SUPPORTED_CLAIM_TYPES.includes(fields.claimType)) fail('CLAIM_TYPE_INVALID', '$.fields.claimType');
  if (!PRODUCT_FAMILIES.includes(fields.productFamily)) fail('PRODUCT_FAMILY_INVALID', '$.fields.productFamily');
  if (fields.jurisdiction !== 'KR') fail('JURISDICTION_INVALID', '$.fields.jurisdiction');
  if (!PROJECT_STAGES.includes(fields.projectStage)) fail('PROJECT_STAGE_INVALID', '$.fields.projectStage');
  const taxonomy = CAPABILITY_TAXONOMY[fields.productFamily]?.[fields.capabilityKey];
  if (!taxonomy) fail('CAPABILITY_KEY_INVALID', '$.fields.capabilityKey');
  if ((fields.conditionKey === '') !== (fields.conditionValue === '')) fail('CONDITION_PAIR_REQUIRED', '$.fields');
  if (fields.conditionKey && !CONDITION_IDS.includes(fields.conditionKey)) fail('CONDITION_KEY_INVALID', '$.fields.conditionKey');
  const value = normalizeUiValue(fields, taxonomy);
  let validity = { type: 'NOT_STATED', validUntil: null };
  if (fields.validUntil !== '') {
    if (typeof fields.validUntil !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fields.validUntil)) fail('VALID_UNTIL_INVALID', '$.fields.validUntil');
    validity = { type: 'VALID_UNTIL', validUntil: `${fields.validUntil}T00:00:00.000Z` };
  }
  return createCandidate({
    schemaVersion: 'evidence-claim-candidate-v0',
    synthetic: base.synthetic === true,
    documentId: base.documentId,
    evidenceAnchorId: base.evidenceAnchorId,
    claimType: fields.claimType,
    subject: { type: 'PRODUCT_FAMILY', id: fields.productFamily, displayName: fields.productFamily === 'transformer' ? 'Transformer' : 'Medium-voltage Switchgear' },
    statement: formatCandidateStatement(fields.productFamily, value),
    value,
    applicability: {
      vertical: 'datacenter',
      domain: 'electrical_power',
      productFamily: fields.productFamily,
      jurisdiction: 'KR',
      projectStages: [fields.projectStage],
      conditions: fields.conditionKey ? [{ id: fields.conditionKey, value: fields.conditionValue }] : []
    },
    validity,
    extractionMethod: 'MANUAL_EXACT_QUOTE',
    extractionRuleId: 'OECRW0-MANUAL-STRUCTURED-ENTRY',
    extractionReasons: ['HUMAN_SELECTED_EXACT_EVIDENCE', 'CONTEXT_AND_PRODUCT_SCOPE_REQUIRE_HUMAN_REVIEW'],
    reviewState: 'REVIEW_REQUIRED'
  });
}

function catalogCandidateIndex(catalog) {
  return new Map(catalog.documents.flatMap((document) => document.pages.flatMap((page) => page.candidates.map((candidate) => [candidate.candidateId, { document, page, candidate }]))));
}

function createDomainReviewPatch(requestBody, catalog) {
  assertExactKeys(requestBody, UI_REQUEST_KEYS, '$');
  if (requestBody.schemaVersion !== 'official-evidence-workbench-review-request-v0') fail('REQUEST_SCHEMA_INVALID', '$.schemaVersion');
  if (!Array.isArray(requestBody.reviews) || requestBody.reviews.length < 1 || requestBody.reviews.length > 100) fail('REVIEW_COUNT_INVALID', '$.reviews');
  const state = catalog.domainState;
  if (!state) fail('WORKBENCH_DOMAIN_STATE_REQUIRED', '$.catalog');
  const candidates = catalogCandidateIndex(catalog);
  const seen = new Set();
  const reviewedRecords = requestBody.reviews.map((rawReview, index) => {
    const path = `$.reviews[${index}]`;
    assertExactKeys(rawReview, UI_REVIEW_KEYS, path);
    if (typeof rawReview.candidateId !== 'string' || !SAFE_IDENTIFIER.test(rawReview.candidateId)) fail('CANDIDATE_ID_INVALID', `${path}.candidateId`);
    if (seen.has(rawReview.candidateId)) fail('DUPLICATE_REVIEW', `${path}.candidateId`);
    seen.add(rawReview.candidateId);
    const indexed = candidates.get(rawReview.candidateId);
    if (!indexed) fail('CANDIDATE_NOT_ALLOWLISTED', `${path}.candidateId`);
    if (indexed.candidate.exactQuote === indexed.page.text) fail('FULL_PAGE_QUOTE_REFUSED', `${path}.candidateId`);
    if (!REVIEW_DECISIONS.includes(rawReview.decision)) fail('DECISION_INVALID', `${path}.decision`);
    const compatible = COMPATIBLE_REASON_CODES[rawReview.decision] || [];
    if (!compatible.includes(rawReview.reasonCode)) fail('REASON_DECISION_INCOMPATIBLE', `${path}.reasonCode`);
    if (rawReview.acknowledged !== true) fail('ACKNOWLEDGEMENT_REQUIRED', `${path}.acknowledged`);
    const candidate = createEditedCandidate({ ...indexed.candidate, synthetic: catalog.synthetic }, rawReview.fields);
    return { rawReview, originalCandidateId: rawReview.candidateId, candidate };
  });

  const replacementByOriginalId = new Map(reviewedRecords.map((record) => [record.originalCandidateId, record.candidate]));
  const fullCandidateUniverse = [...state.candidatesById.values()].map((candidate) => replacementByOriginalId.get(candidate.candidateId) || candidate);
  const fullRelationshipReport = analyzeCandidateRelationships(fullCandidateUniverse, { documents: state.documents });
  const closureIds = new Set(reviewedRecords.map(({ candidate }) => candidate.candidateId));
  let changed = true;
  while (changed) {
    changed = false;
    for (const relationship of fullRelationshipReport.relationships) {
      if (!relationship.candidateIds.some((candidateId) => closureIds.has(candidateId))) continue;
      for (const candidateId of relationship.candidateIds) {
        if (!closureIds.has(candidateId)) {
          closureIds.add(candidateId);
          changed = true;
        }
      }
    }
  }
  const reviewedByEditedId = new Map(reviewedRecords.map((record) => [record.candidate.candidateId, record]));
  const missingRelationshipReviews = [...closureIds].filter((candidateId) => !reviewedByEditedId.has(candidateId));
  if (missingRelationshipReviews.length) fail('RELATIONSHIP_REVIEW_REQUIRED', '$.reviews');

  const closureCandidates = fullCandidateUniverse.filter((candidate) => closureIds.has(candidate.candidateId));
  const documentIds = new Set(closureCandidates.map((candidate) => candidate.documentId));
  const anchorIds = new Set(closureCandidates.map((candidate) => candidate.evidenceAnchorId));
  const documents = state.documents.filter((document) => documentIds.has(document.documentId));
  const anchors = [...anchorIds].map((anchorId) => state.anchorsById.get(anchorId));
  if (anchors.some((anchor) => !anchor)) fail('CANDIDATE_ANCHOR_UNKNOWN', '$.reviews');
  const closureRelationshipReport = analyzeCandidateRelationships(closureCandidates, { documents });
  const decisions = reviewedRecords.map(({ rawReview, candidate }) => {
    let relatedCandidateIds = [];
    if (rawReview.decision === 'FLAG_CONFLICT') {
      relatedCandidateIds = closureRelationshipReport.relationships
        .filter((relationship) => relationship.type === 'MATERIAL_CONFLICT' && relationship.candidateIds.includes(candidate.candidateId))
        .flatMap((relationship) => relationship.candidateIds.filter((candidateId) => candidateId !== candidate.candidateId));
      if (!relatedCandidateIds.length) fail('CONFLICT_RELATIONSHIP_REQUIRED', '$.reviews');
    }
    if (rawReview.decision === 'FLAG_SUPERSEDED') {
      relatedCandidateIds = closureRelationshipReport.relationships
        .filter((relationship) => relationship.type === 'SUPERSEDES' && relationship.supersededCandidateId === candidate.candidateId)
        .map((relationship) => relationship.successorCandidateId);
      if (!relatedCandidateIds.length) fail('SUPERSESSION_RELATIONSHIP_REQUIRED', '$.reviews');
    }
    relatedCandidateIds = [...new Set(relatedCandidateIds)].sort(compareAscii);
    const reasonCodes = rawReview.decision === 'APPROVE_FOR_REPOSITORY_REVIEW'
      ? ['EVIDENCE_QUOTE_CONFIRMED', 'STRUCTURED_MEANING_CONFIRMED', ...(candidate.applicability.conditions.length ? ['CONDITIONS_CONFIRMED'] : [])]
      : [rawReview.reasonCode];
    return createReviewDecision({ candidate, decision: rawReview.decision, reasonCodes, relatedCandidateIds });
  }).sort((left, right) => compareAscii(left.decisionId, right.decisionId));
  const patch = createReviewPatch({
    baseCommitSha: catalog.patchBase.commitSha,
    registryPath: catalog.patchBase.registryPath,
    generatedAt: catalog.patchBase.generatedAt,
    documents,
    anchors,
    candidates: closureCandidates,
    decisions,
    relationshipReport: closureRelationshipReport
  });
  return validateReviewPatch(patch);
}

export async function createWorkbenchRequestHandler({
  catalog,
  loadCatalog = loadDefaultWorkbenchCatalog,
  buildPatch = createDomainReviewPatch,
  assets,
  capabilityToken = randomBytes(32).toString('hex')
} = {}) {
  if (!SAFE_CAPABILITY_TOKEN.test(capabilityToken)) fail('WORKBENCH_CAPABILITY_TOKEN_INVALID', '$.capabilityToken');
  const resolvedCatalog = catalog ?? await loadCatalog();
  assertSafeArtifact(resolvedCatalog);
  if (!Array.isArray(resolvedCatalog.documents) || resolvedCatalog.documents.length > 100) fail('WORKBENCH_CATALOG_INVALID', '$.catalog');
  const resolvedAssets = assets ?? await loadStaticAssets();
  const summaries = resolvedCatalog.documents.map(({ pages, ...document }) => ({ ...document, pages: undefined }));
  const pageHtml = renderOfficialEvidenceWorkbenchPage({ capabilityToken, documents: summaries });
  return async function handle(request, response, { host, port }) {
    const isHead = request.method === 'HEAD';
    if (!hostHeaderAllowed(request.headers.host, host, port)) {
      send(response, 421, 'text/plain; charset=utf-8', 'Misdirected request\n', { head: isHead, headers: { Connection: 'close' } });
      return;
    }
    const route = parseRoute(request.url);
    if (route.kind === 'INVALID') {
      send(response, 400, 'text/plain; charset=utf-8', 'Bad request\n', { head: isHead });
      return;
    }
    const api = route.kind.startsWith('API_');
    const mutating = route.kind === 'API_PATCH';
    if (!originHeaderAllowed(request.headers.origin, host, port, { required: mutating }) || !fetchMetadataAllowed(request, { api })) {
      send(response, 403, 'text/plain; charset=utf-8', 'Forbidden\n', { head: isHead, headers: { Connection: 'close' } });
      return;
    }
    const contentLength = request.headers['content-length'];
    if (!mutating && (request.headers['transfer-encoding'] || (contentLength !== undefined && (!/^\d+$/.test(contentLength) || Number(contentLength) > 0)))) {
      send(response, 413, 'text/plain; charset=utf-8', 'Request body refused\n', { head: isHead, headers: { Connection: 'close' } });
      return;
    }
    const allowedMethods = mutating ? ['POST'] : ['GET', 'HEAD'];
    if (!allowedMethods.includes(request.method || '')) {
      send(response, 405, 'text/plain; charset=utf-8', 'Method not allowed\n', { head: isHead, headers: { Allow: allowedMethods.join(', '), Connection: 'close' } });
      return;
    }
    if (api && !capabilityTokenMatches(request.headers['x-workbench-capability'], capabilityToken)) {
      sendJson(response, 403, { error: 'capability_required' }, { head: isHead, headers: { Connection: 'close' } });
      return;
    }
    if (route.kind === 'PAGE') {
      send(response, 200, 'text/html; charset=utf-8', pageHtml, { head: isHead });
      return;
    }
    if (route.kind === 'ASSET') {
      const asset = resolvedAssets.get(route.path);
      if (!asset) {
        send(response, 503, 'text/plain; charset=utf-8', 'Asset unavailable\n', { head: isHead });
        return;
      }
      send(response, 200, asset.type, asset.content, { head: isHead });
      return;
    }
    if (route.kind === 'API_CATALOG') {
      sendJson(response, 200, resolvedCatalog, { head: isHead });
      return;
    }
    if (route.kind === 'API_PATCH') {
      const contentType = String(request.headers['content-type'] || '').toLowerCase();
      if (!['application/json', 'application/json; charset=utf-8'].includes(contentType)) {
        sendJson(response, 415, { error: 'json_content_type_required' }, { headers: { Connection: 'close' } });
        return;
      }
      try {
        const body = await readRequestBody(request);
        const patch = await buildPatch(body, resolvedCatalog);
        assertSafeArtifact(patch);
        sendJson(response, 200, patch);
      } catch (error) {
        const status = error?.code === 'REQUEST_BODY_TOO_LARGE' ? 413 : 422;
        sendJson(response, status, { error: 'review_patch_refused', code: typeof error?.code === 'string' ? error.code : 'INVALID_REVIEW_PATCH' }, { headers: { Connection: 'close' } });
      }
      return;
    }
    send(response, 404, 'text/plain; charset=utf-8', 'Not found\n', { head: isHead });
  };
}

export async function createWorkbenchServer({
  host = '127.0.0.1',
  port = 0,
  handlerOptions = {}
} = {}) {
  const parsedHost = parseWorkbenchHost(host);
  const parsedPort = parseWorkbenchPort(port);
  const handler = await createWorkbenchRequestHandler(handlerOptions);
  let activePort = parsedPort;
  const server = createServer({ maxHeaderSize: 16 * 1024, requestTimeout: 5_000, headersTimeout: 5_000, keepAliveTimeout: 1_000 }, (request, response) => {
    handler(request, response, { host: parsedHost, port: activePort }).catch(() => {
      if (!response.headersSent) send(response, 500, 'text/plain; charset=utf-8', 'Internal error\n', { head: request.method === 'HEAD' });
      else response.destroy();
    });
  });
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(parsedPort, parsedHost, () => {
      server.off('error', rejectListen);
      resolveListen();
    });
  });
  const address = server.address();
  if (!address || typeof address === 'string' || !['127.0.0.1', '::1'].includes(address.address)) {
    await new Promise((resolveClose) => server.close(resolveClose));
    fail('WORKBENCH_BOUND_ADDRESS_INVALID', '$.server.address');
  }
  activePort = address.port;
  let closed = false;
  return {
    server,
    host: address.address,
    port: address.port,
    origin: originFor(address.address, address.port),
    async close() {
      if (closed) return;
      closed = true;
      await new Promise((resolveClose, rejectClose) => server.close((error) => error ? rejectClose(error) : resolveClose()));
    }
  };
}

export const startOfficialEvidenceWorkbenchServer = createWorkbenchServer;

export function parseWorkbenchCliArguments(argv) {
  if (!Array.isArray(argv)) fail('WORKBENCH_CLI_ARGUMENT_INVALID', '$.argv');
  let host = '127.0.0.1';
  let port = WORKBENCH_DEFAULT_PORT;
  let realIntake = false;
  let asOf;
  const seen = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (seen.has(argument)) fail('WORKBENCH_CLI_ARGUMENT_DUPLICATE', '$.argv');
    seen.add(argument);
    if (argument === '--host' && argv[index + 1]) host = argv[++index];
    else if (argument === '--port' && argv[index + 1]) port = argv[++index];
    else if (argument === '--real-intake') realIntake = true;
    else if (argument === '--as-of' && argv[index + 1]) asOf = argv[++index];
    else fail('WORKBENCH_CLI_ARGUMENT_INVALID', '$.argv');
  }
  if (realIntake && asOf === undefined) fail('WORKBENCH_REAL_INTAKE_AS_OF_REQUIRED', '$.asOf');
  if (!realIntake && asOf !== undefined) fail('WORKBENCH_REAL_INTAKE_FLAG_REQUIRED', '$.realIntake');
  return {
    host: parseWorkbenchHost(host),
    port: parseWorkbenchPort(port, { allowZero: false }),
    realIntake,
    asOf: realIntake ? parseWorkbenchAsOf(asOf) : null
  };
}

async function runCli() {
  const cli = parseWorkbenchCliArguments(process.argv.slice(2));
  const catalog = cli.realIntake
    ? await loadEvidenceInboxWorkbenchCatalog({ asOf: cli.asOf })
    : undefined;
  const server = await createWorkbenchServer({
    host: cli.host,
    port: cli.port,
    ...(catalog ? { handlerOptions: { catalog } } : {})
  });
  process.stdout.write(`Official Evidence Claim Review Workbench v0: ${server.origin}\n`);
  process.stdout.write('Boundary: LOCAL / NOT_PRODUCTION_EVIDENCE / Issue #165 HOLD\n');
  process.stdout.write('Trust: expected UNVERIFIED / customer use BLOCKED / persistence NONE\n');
  process.stdout.write(`Intake: ${cli.realIntake ? `REAL_MANIFEST_BOUND (${catalog.documents.length} document(s), as of ${cli.asOf})` : 'SYNTHETIC_DEMO'}\n`);
  process.stdout.write('Browser auto-open: disabled\n');
  const stop = async () => {
    await server.close();
    process.exitCode = 0;
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  runCli().catch(() => {
    process.stderr.write('Official Evidence Claim Review Workbench failed to start safely.\n');
    process.exitCode = 1;
  });
}
