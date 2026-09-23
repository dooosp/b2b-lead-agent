import { constants as fsConstants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import path from 'node:path';

import { canonicalStringify, sha256 } from '../../knowledge/claim-registry/index.mjs';
import {
  CANDIDATE_SCHEMA_VERSION,
  CAPABILITY_TAXONOMY,
  CONDITION_IDS,
  PRODUCT_FAMILIES,
  WORKBENCH_DOMAIN,
  WORKBENCH_JURISDICTION,
  WORKBENCH_VERTICAL,
  createCandidate,
  formatCandidateStatement
} from '../domain/candidates.mjs';
import { NON_PRODUCTION_BOUNDARY } from '../domain/constants.mjs';
import {
  assertValidatedSourceDocument,
  countCodePoints
} from '../domain/document-bundle.mjs';
import {
  EvidenceWorkbenchValidationError,
  assertExactKeys,
  assertPlainObject,
  assertSafeMetadata,
  compareAscii,
  deepFreeze,
  fail
} from '../domain/errors.mjs';
import { createPageEvidenceAnchor } from '../domain/evidence-anchor.mjs';

export const VARIANT_TABLE_SPEC_SCHEMA_VERSION = 'variant-table-evidence-spec-v0';
export const VARIANT_TABLE_PROPOSITION_SCHEMA_VERSION = 'variant-table-evidence-proposition-v0';
export const VARIANT_TABLE_RESULT_SCHEMA_VERSION = 'variant-table-evidence-spike-result-v0';
export const VARIANT_TABLE_SPEC_FILE = 'variant-table-evidence-spec-v0.json';
export const VARIANT_TABLE_SPEC_MAX_BYTES = 128 * 1024;

const MAX_TABLES = 20;
const MAX_ROWS_PER_TABLE = 100;
const MAX_FOOTNOTES_PER_TABLE = 20;
const MAX_CONDITIONS_PER_TABLE = 8;
const SAFE_ID = /^[a-z0-9][a-z0-9._-]{1,119}$/;
const PRODUCT_VARIANT = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const SUPPORTED_OPERATORS = Object.freeze([
  'EXACT',
  'MAXIMUM',
  'MINIMUM',
  'RANGE',
  'ALTERNATIVES',
  'UNRESOLVED'
]);
const PRODUCT_VARIANT_RESERVED = new Set(['all', 'any', 'default', 'not_stated', 'unknown', 'unscoped', 'unspecified']);
const FAMILY_DISPLAY_NAMES = Object.freeze({
  medium_voltage_switchgear: 'Medium-voltage Switchgear',
  transformer: 'Transformer'
});
const LABEL_RULES = Object.freeze({
  medium_voltage_switchgear: Object.freeze({
    rated_voltage: /(?:rated\s+voltage|정격\s*전압)/iu,
    rated_current: /(?:rated\s+current|정격\s*전류)/iu,
    short_circuit_rating: /(?:short[-\s]+circuit|단락\s*전류)/iu,
    frequency: /(?:rated\s+frequency|frequency|정격\s*주파수|주파수)/iu,
    altitude: /(?:altitude|고도)/iu
  }),
  transformer: Object.freeze({
    transformer_capacity: /(?:rated\s+power|rated\s+capacity|capacity|정격\s*용량|용량)/iu,
    primary_voltage: /(?:primary\s+voltage|input\s+voltage|1차\s*전압|입력\s*전압)/iu,
    secondary_voltage: /(?:secondary\s+voltage|output\s+voltage|2차\s*전압|출력\s*전압)/iu,
    frequency: /(?:rated\s+frequency|frequency|정격\s*주파수|주파수)/iu,
    altitude: /(?:altitude|고도)/iu
  })
});
const QUANTITY_CELL = /^([+-]?\d+(?:\.\d+)?)\s*(V|kV|A|kA|Hz|VA|kVA|MVA|m)?$/u;

function normalizeId(value, pathLabel) {
  if (typeof value !== 'string' || !SAFE_ID.test(value)) fail('INVALID_VARIANT_TABLE_ID', pathLabel);
  return value;
}

function normalizeProductVariant(value, pathLabel) {
  if (typeof value !== 'string'
    || value.length > 80
    || !PRODUCT_VARIANT.test(value)
    || PRODUCT_VARIANT_RESERVED.has(value)) {
    fail('INVALID_PRODUCT_VARIANT', pathLabel);
  }
  return value;
}

function normalizePositiveIndex(value, pathLabel) {
  if (!Number.isInteger(value) || value < 1 || value > 10_000) fail('INVALID_TABLE_INDEX', pathLabel);
  return value;
}

function normalizeAnchorInput(raw, pathLabel) {
  assertPlainObject(raw, pathLabel, 'ANCHOR_INPUT_REQUIRED');
  assertExactKeys(raw, {
    required: ['pageNumber', 'startCodePoint', 'endCodePoint', 'quote'],
    optional: ['occurrenceIndex']
  }, pathLabel);
  return raw;
}

function anchorProjection(anchor) {
  return {
    anchorId: anchor.anchorId,
    quoteSha256: anchor.selection.quoteSha256
  };
}

function createBoundAnchor(document, raw, expectedPageNumber, pathLabel) {
  const input = normalizeAnchorInput(raw, pathLabel);
  if (input.pageNumber !== expectedPageNumber) fail('TABLE_ANCHOR_PAGE_MISMATCH', `${pathLabel}.pageNumber`);
  return createPageEvidenceAnchor(document, input, { path: pathLabel });
}

function normalizeConditions(document, raw, pageNumber, pathLabel) {
  if (!Array.isArray(raw) || raw.length > MAX_CONDITIONS_PER_TABLE) fail('INVALID_TABLE_CONDITION_COUNT', pathLabel);
  const seen = new Set();
  return raw.map((condition, index) => {
    const itemPath = `${pathLabel}[${index}]`;
    assertExactKeys(condition, { required: ['id', 'value', 'anchor'] }, itemPath);
    if (!CONDITION_IDS.includes(condition.id) || condition.id === 'product_variant') {
      fail('UNSUPPORTED_TABLE_CONDITION', `${itemPath}.id`);
    }
    if (seen.has(condition.id)) fail('DUPLICATE_TABLE_CONDITION', `${itemPath}.id`);
    seen.add(condition.id);
    if (typeof condition.value !== 'string' || !SAFE_ID.test(condition.value)) {
      fail('INVALID_TABLE_CONDITION_VALUE', `${itemPath}.value`);
    }
    const anchor = createBoundAnchor(document, condition.anchor, pageNumber, `${itemPath}.anchor`);
    const quote = anchor.selection.quote.normalize('NFKC');
    const frequency = condition.id === 'frequency' && condition.value.match(/^(\d+(?:_\d+)?)_hz$/u);
    const frequencySupported = frequency
      && new RegExp(`(?:^|\\D)${frequency[1].replace('_', '\\.')}\\s*Hz(?:$|\\D)`, 'iu').test(quote);
    const installationSupported = condition.id === 'installation_condition'
      && ((condition.value === 'indoor_only' && /(?:indoor(?:\s+use)?|옥내|실내)/iu.test(quote))
        || (condition.value === 'outdoor_only' && /(?:outdoor(?:\s+use)?|옥외|실외)/iu.test(quote)));
    if (!frequencySupported && !installationSupported) {
      fail('TABLE_CONDITION_ANCHOR_MISMATCH', `${itemPath}.anchor`);
    }
    return {
      id: condition.id,
      value: condition.value,
      anchor
    };
  }).sort((left, right) => compareAscii(left.id, right.id));
}

function normalizeFootnotes(document, raw, pageNumber, pathLabel) {
  if (!Array.isArray(raw) || raw.length > MAX_FOOTNOTES_PER_TABLE) fail('INVALID_TABLE_FOOTNOTE_COUNT', pathLabel);
  return raw.map((anchor, index) => createBoundAnchor(document, anchor, pageNumber, `${pathLabel}[${index}]`));
}

function normalizeFootnoteIndexes(raw, footnoteCount, pathLabel) {
  if (!Array.isArray(raw) || raw.length > footnoteCount) fail('INVALID_ROW_FOOTNOTE_INDEXES', pathLabel);
  const unique = [...new Set(raw)];
  if (unique.length !== raw.length) fail('DUPLICATE_ROW_FOOTNOTE_INDEX', pathLabel);
  for (const [index, value] of raw.entries()) {
    if (!Number.isInteger(value) || value < 1 || value > footnoteCount) {
      fail('ROW_FOOTNOTE_INDEX_OUT_OF_RANGE', `${pathLabel}[${index}]`);
    }
  }
  return [...raw].sort((left, right) => left - right);
}

function normalizeRow(raw, { document, pageNumber, columnIndex, footnoteCount, pathLabel }) {
  assertExactKeys(raw, {
    required: [
      'rowId',
      'rowIndex',
      'columnIndex',
      'capabilityKey',
      'claimType',
      'semanticOperator',
      'numericValue',
      'unit',
      'quantityKind',
      'labelAnchor',
      'valueAnchor',
      'footnoteIndexes'
    ]
  }, pathLabel);
  const rowIndex = normalizePositiveIndex(raw.rowIndex, `${pathLabel}.rowIndex`);
  if (raw.columnIndex !== columnIndex) fail('ROW_COLUMN_HEADER_MISMATCH', `${pathLabel}.columnIndex`);
  if (!SUPPORTED_OPERATORS.includes(raw.semanticOperator)) fail('UNSUPPORTED_OPERATOR_TOKEN', `${pathLabel}.semanticOperator`);
  if (!Number.isFinite(raw.numericValue)) fail('FINITE_TABLE_VALUE_REQUIRED', `${pathLabel}.numericValue`);
  if (typeof raw.unit !== 'string' || raw.unit.length < 1 || raw.unit.length > 8) fail('INVALID_TABLE_UNIT', `${pathLabel}.unit`);
  if (typeof raw.quantityKind !== 'string' || !SAFE_ID.test(raw.quantityKind)) fail('INVALID_QUANTITY_KIND', `${pathLabel}.quantityKind`);
  if (raw.claimType !== 'PRODUCT_CAPABILITY') {
    fail('UNSUPPORTED_TABLE_CLAIM_TYPE', `${pathLabel}.claimType`);
  }
  return {
    rowId: normalizeId(raw.rowId, `${pathLabel}.rowId`),
    rowIndex,
    columnIndex,
    capabilityKey: normalizeId(raw.capabilityKey, `${pathLabel}.capabilityKey`),
    claimType: raw.claimType,
    semanticOperator: raw.semanticOperator,
    numericValue: raw.numericValue,
    unit: raw.unit,
    quantityKind: raw.quantityKind,
    labelAnchor: createBoundAnchor(document, raw.labelAnchor, pageNumber, `${pathLabel}.labelAnchor`),
    valueAnchor: createBoundAnchor(document, raw.valueAnchor, pageNumber, `${pathLabel}.valueAnchor`),
    footnoteIndexes: normalizeFootnoteIndexes(raw.footnoteIndexes, footnoteCount, `${pathLabel}.footnoteIndexes`)
  };
}

function abstention(table, row, reasonCode) {
  return deepFreeze({
    documentId: table.document.documentId,
    tableId: table.tableId,
    rowId: row.rowId,
    reasonCode
  });
}

function labelContainsUnit(label, unit) {
  const compactLabel = label.normalize('NFKC').replace(/\s+/gu, '');
  const compactUnit = unit.normalize('NFKC').replace(/\s+/gu, '');
  return compactLabel.toLowerCase().includes(compactUnit.toLowerCase());
}

function evaluateRow(table, row) {
  if (row.semanticOperator !== 'EXACT') return { abstention: abstention(table, row, 'UNSUPPORTED_SEMANTIC_OPERATOR') };
  const headerQuote = table.columnHeaderAnchor.selection.quote;
  const canonicalHeaderVariant = headerQuote
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '');
  if (canonicalHeaderVariant !== table.productVariant) {
    return { abstention: abstention(table, row, 'PRODUCT_VARIANT_HEADER_MISMATCH') };
  }
  if (/(?:[/,;&]|\b(?:and|or)\b)/iu.test(headerQuote)) {
    return { abstention: abstention(table, row, 'COMPOUND_PRODUCT_VARIANT_HEADER') };
  }
  if (row.footnoteIndexes.length > 0) {
    return { abstention: abstention(table, row, 'FOOTNOTE_SEMANTICS_UNRESOLVED') };
  }
  const labelEnd = row.labelAnchor.selection.endCodePoint;
  const valueStart = row.valueAnchor.selection.startCodePoint;
  const pageText = [...table.document.pages[table.pageNumber - 1].text];
  const headerToRow = pageText.slice(
    table.columnHeaderAnchor.selection.endCodePoint,
    row.labelAnchor.selection.startCodePoint
  ).join('');
  const intervening = valueStart >= labelEnd
    ? pageText.slice(labelEnd, valueStart).join('')
    : '';
  if (table.titleAnchor.selection.endCodePoint > table.columnHeaderAnchor.selection.startCodePoint
    || table.columnHeaderAnchor.selection.endCodePoint > row.labelAnchor.selection.startCodePoint
    || countCodePoints(headerToRow) > 1_000) {
    return { abstention: abstention(table, row, 'TABLE_STRUCTURE_BINDING_AMBIGUOUS') };
  }
  if (valueStart < labelEnd
    || countCodePoints(intervening) > 500
    || /\n/u.test(intervening)) {
    return { abstention: abstention(table, row, 'ROW_CELL_BINDING_AMBIGUOUS') };
  }
  if (/(?:\bup\s+to\b|\bat\s+least\b|\bmaximum\b|\bminimum\b|\bmax\.?\b|\bmin\.?\b|이상|이하|최대|최소|[~–—]|\bor\b|\/)/iu.test(intervening)) {
    return { abstention: abstention(table, row, 'EXACT_SEMANTIC_CUE_CONFLICT') };
  }
  const lineEnd = pageText.indexOf('\n', labelEnd);
  const rowTail = pageText.slice(labelEnd, lineEnd === -1 ? pageText.length : lineEnd).join('');
  const numericCells = rowTail.match(/[+-]?\d+(?:\.\d+)?/gu) || [];
  if (numericCells.length !== 1) {
    return { abstention: abstention(table, row, 'MULTI_VALUE_ROW_AMBIGUOUS') };
  }
  const taxonomy = CAPABILITY_TAXONOMY[table.productFamily]?.[row.capabilityKey];
  if (!taxonomy || !taxonomy.types.includes('QUANTITY')) {
    return { abstention: abstention(table, row, 'UNSUPPORTED_QUANTITY_CAPABILITY') };
  }
  const labelRule = LABEL_RULES[table.productFamily]?.[row.capabilityKey];
  if (!labelRule || !labelRule.test(row.labelAnchor.selection.quote)) {
    return { abstention: abstention(table, row, 'UNSUPPORTED_LABEL_BINDING') };
  }
  const parsed = row.valueAnchor.selection.quote.trim().match(QUANTITY_CELL);
  if (!parsed) return { abstention: abstention(table, row, 'AMBIGUOUS_VALUE_CELL') };
  const parsedNumber = Number(parsed[1]);
  const parsedUnit = parsed[2] || '';
  if (parsedNumber !== row.numericValue
    || (parsedUnit && parsedUnit !== row.unit)
    || (!parsedUnit && !labelContainsUnit(row.labelAnchor.selection.quote, row.unit))) {
    return { abstention: abstention(table, row, 'VALUE_OR_UNIT_BINDING_MISMATCH') };
  }

  let candidate;
  try {
    const value = {
      type: 'QUANTITY',
      key: row.capabilityKey,
      value: row.numericValue,
      unit: row.unit,
      quantityKind: row.quantityKind
    };
    candidate = createCandidate({
      schemaVersion: CANDIDATE_SCHEMA_VERSION,
      synthetic: table.document.synthetic,
      documentId: table.document.documentId,
      evidenceAnchorId: row.valueAnchor.anchorId,
      claimType: row.claimType,
      subject: {
        type: 'PRODUCT_FAMILY',
        id: table.productFamily,
        displayName: FAMILY_DISPLAY_NAMES[table.productFamily]
      },
      statement: formatCandidateStatement(table.productFamily, value),
      value,
      applicability: {
        vertical: WORKBENCH_VERTICAL,
        domain: WORKBENCH_DOMAIN,
        productFamily: table.productFamily,
        jurisdiction: WORKBENCH_JURISDICTION,
        projectStages: ['SPECIFICATION', 'TENDER'],
        conditions: [
          { id: 'product_variant', value: table.productVariant },
          ...table.conditions.map(({ id, value: conditionValue }) => ({ id, value: conditionValue }))
        ]
      },
      validity: { type: 'NOT_STATED', validUntil: null },
      extractionMethod: 'DETERMINISTIC_RULE',
      extractionRuleId: 'OECRW0-EXPERIMENT-VARIANT-TABLE-SCALAR',
      extractionReasons: [
        'EXACT_LABEL_VALUE_MATCH',
        'CONTEXT_AND_PRODUCT_SCOPE_REQUIRE_HUMAN_REVIEW'
      ],
      reviewState: 'REVIEW_REQUIRED'
    });
  } catch (error) {
    if (typeof error?.code === 'string') {
      return { abstention: abstention(table, row, `CANDIDATE_${error.code}`) };
    }
    throw error;
  }

  const footnotes = row.footnoteIndexes.map((index) => table.footnotes[index - 1]);
  const tableContext = {
    sourcePage: {
      extractedPageOrdinal: row.valueAnchor.page.extractedPageOrdinal,
      locator: row.valueAnchor.page.locator,
      textSha256: row.valueAnchor.page.textSha256
    },
    rowIndex: row.rowIndex,
    columnIndex: row.columnIndex,
    productVariant: table.productVariant,
    conditions: table.conditions.map(({ id, value, anchor }) => ({
      id,
      value,
      ...anchorProjection(anchor)
    })),
    anchors: {
      tableTitle: anchorProjection(table.titleAnchor),
      columnHeader: anchorProjection(table.columnHeaderAnchor),
      rowLabel: anchorProjection(row.labelAnchor),
      value: anchorProjection(row.valueAnchor),
      footnotes: footnotes.map(anchorProjection)
    }
  };
  const identity = {
    schemaVersion: VARIANT_TABLE_PROPOSITION_SCHEMA_VERSION,
    documentId: table.document.documentId,
    tableId: table.tableId,
    rowId: row.rowId,
    candidateId: candidate.candidateId,
    tableContext
  };
  const proposition = {
    schemaVersion: VARIANT_TABLE_PROPOSITION_SCHEMA_VERSION,
    boundary: NON_PRODUCTION_BOUNDARY,
    productionReady: false,
    canonicalPatchExportAllowed: false,
    proposalId: `vtp_${sha256(identity)}`,
    documentId: table.document.documentId,
    tableId: table.tableId,
    rowId: row.rowId,
    candidate,
    tableContext
  };
  assertSafeMetadata(proposition, '$.proposition');
  return { proposition: deepFreeze(proposition) };
}

function normalizeTable(raw, documentsById, pathLabel) {
  assertExactKeys(raw, {
    required: [
      'tableId',
      'documentId',
      'productFamily',
      'pageNumber',
      'titleAnchor',
      'columnHeader',
      'conditions',
      'footnoteAnchors',
      'rows'
    ]
  }, pathLabel);
  const document = documentsById.get(raw.documentId);
  if (!document) fail('VARIANT_TABLE_DOCUMENT_NOT_FOUND', `${pathLabel}.documentId`);
  if (!PRODUCT_FAMILIES.includes(raw.productFamily)
    || document.source.productFamilies.length !== 1
    || document.source.productFamilies[0] !== raw.productFamily) {
    fail('VARIANT_TABLE_PRODUCT_FAMILY_MISMATCH', `${pathLabel}.productFamily`);
  }
  const pageNumber = normalizePositiveIndex(raw.pageNumber, `${pathLabel}.pageNumber`);
  assertExactKeys(raw.columnHeader, {
    required: ['columnIndex', 'productVariant', 'anchor']
  }, `${pathLabel}.columnHeader`);
  const columnIndex = normalizePositiveIndex(raw.columnHeader.columnIndex, `${pathLabel}.columnHeader.columnIndex`);
  const productVariant = normalizeProductVariant(raw.columnHeader.productVariant, `${pathLabel}.columnHeader.productVariant`);
  const footnotes = normalizeFootnotes(document, raw.footnoteAnchors, pageNumber, `${pathLabel}.footnoteAnchors`);
  const rows = Array.isArray(raw.rows) && raw.rows.length > 0 && raw.rows.length <= MAX_ROWS_PER_TABLE
    ? raw.rows.map((row, index) => normalizeRow(row, {
      document,
      pageNumber,
      columnIndex,
      footnoteCount: footnotes.length,
      pathLabel: `${pathLabel}.rows[${index}]`
    }))
    : fail('INVALID_VARIANT_TABLE_ROW_COUNT', `${pathLabel}.rows`);
  const seenRowIds = new Set();
  const seenCoordinates = new Set();
  for (const row of rows) {
    const coordinate = `${row.rowIndex}\0${row.columnIndex}`;
    if (seenRowIds.has(row.rowId) || seenCoordinates.has(coordinate)) {
      fail('DUPLICATE_VARIANT_TABLE_ROW', `${pathLabel}.rows`);
    }
    seenRowIds.add(row.rowId);
    seenCoordinates.add(coordinate);
  }
  return {
    tableId: normalizeId(raw.tableId, `${pathLabel}.tableId`),
    document,
    productFamily: raw.productFamily,
    pageNumber,
    productVariant,
    titleAnchor: createBoundAnchor(document, raw.titleAnchor, pageNumber, `${pathLabel}.titleAnchor`),
    columnHeaderAnchor: createBoundAnchor(document, raw.columnHeader.anchor, pageNumber, `${pathLabel}.columnHeader.anchor`),
    conditions: normalizeConditions(document, raw.conditions, pageNumber, `${pathLabel}.conditions`),
    footnotes,
    rows
  };
}

export function evaluateVariantTableEvidence({ documents, spec }) {
  if (!Array.isArray(documents) || documents.length < 1) fail('VARIANT_TABLE_DOCUMENTS_REQUIRED', '$.documents');
  documents.forEach((document, index) => assertValidatedSourceDocument(document, `$.documents[${index}]`));
  assertPlainObject(spec, '$.spec', 'VARIANT_TABLE_SPEC_REQUIRED');
  assertExactKeys(spec, {
    required: ['schemaVersion', 'boundary', 'productionReady', 'tables']
  }, '$.spec');
  assertSafeMetadata(spec, '$.spec');
  if (spec.schemaVersion !== VARIANT_TABLE_SPEC_SCHEMA_VERSION) fail('UNSUPPORTED_VARIANT_TABLE_SPEC_SCHEMA', '$.spec.schemaVersion');
  if (spec.boundary !== NON_PRODUCTION_BOUNDARY) fail('NON_PRODUCTION_BOUNDARY_REQUIRED', '$.spec.boundary');
  if (spec.productionReady !== false) fail('PRODUCTION_READY_MUST_BE_FALSE', '$.spec.productionReady');
  if (!Array.isArray(spec.tables) || spec.tables.length < 1 || spec.tables.length > MAX_TABLES) {
    fail('INVALID_VARIANT_TABLE_COUNT', '$.spec.tables');
  }
  const documentsById = new Map(documents.map((document) => [document.documentId, document]));
  if (documentsById.size !== documents.length) fail('DUPLICATE_VARIANT_TABLE_DOCUMENT', '$.documents');
  const tables = spec.tables.map((table, index) => normalizeTable(table, documentsById, `$.spec.tables[${index}]`));
  const seenTables = new Set();
  for (const table of tables) {
    if (seenTables.has(table.tableId)) fail('DUPLICATE_VARIANT_TABLE_ID', '$.spec.tables');
    seenTables.add(table.tableId);
  }
  const propositions = [];
  const abstentions = [];
  for (const table of tables) {
    for (const row of table.rows) {
      const result = evaluateRow(table, row);
      if (result.proposition) propositions.push(result.proposition);
      else abstentions.push(result.abstention);
    }
  }
  const candidateIds = new Set();
  for (const proposition of propositions) {
    if (candidateIds.has(proposition.candidate.candidateId)) {
      fail('DUPLICATE_VARIANT_TABLE_CANDIDATE', '$.spec.tables');
    }
    candidateIds.add(proposition.candidate.candidateId);
  }
  propositions.sort((left, right) => compareAscii(left.proposalId, right.proposalId));
  abstentions.sort((left, right) => compareAscii(canonicalStringify(left), canonicalStringify(right)));
  const result = {
    schemaVersion: VARIANT_TABLE_RESULT_SCHEMA_VERSION,
    boundary: NON_PRODUCTION_BOUNDARY,
    productionReady: false,
    canonicalPatchExportAllowed: false,
    documentCount: documents.length,
    structuredTableCount: tables.length,
    structuredRowCount: tables.reduce((total, table) => total + table.rows.length, 0),
    propositions,
    abstentions
  };
  return deepFreeze({ ...result, canonicalSha256: sha256(result) });
}

function isContained(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

export async function readFixedVariantTableEvidenceSpec({ ownedRoot, inject = {} } = {}) {
  if (typeof ownedRoot !== 'string' || !path.isAbsolute(ownedRoot)) fail('ABSOLUTE_OWNED_ROOT_REQUIRED', '$.ownedRoot');
  const root = path.resolve(ownedRoot);
  const inbox = path.join(root, 'evidence-inbox');
  const candidate = path.join(inbox, VARIANT_TABLE_SPEC_FILE);
  let rootStats;
  let inboxStats;
  let before;
  let canonicalRoot;
  let canonicalInbox;
  let canonicalCandidate;
  try {
    [rootStats, inboxStats, before, canonicalRoot, canonicalInbox, canonicalCandidate] = await Promise.all([
      lstat(root),
      lstat(inbox),
      lstat(candidate),
      realpath(root),
      realpath(inbox),
      realpath(candidate)
    ]);
  } catch {
    fail('VARIANT_TABLE_SPEC_NOT_FOUND', '$.specFile');
  }
  if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) fail('OWNED_ROOT_DIRECTORY_REQUIRED', '$.ownedRoot');
  if (inboxStats.isSymbolicLink() || !inboxStats.isDirectory()) fail('INBOX_DIRECTORY_REQUIRED', '$.specFile');
  if (before.isSymbolicLink()) fail('VARIANT_TABLE_SPEC_SYMLINK_REFUSED', '$.specFile');
  if (!before.isFile()) fail('VARIANT_TABLE_SPEC_REGULAR_FILE_REQUIRED', '$.specFile');
  if (before.nlink !== 1) fail('VARIANT_TABLE_SPEC_HARDLINK_REFUSED', '$.specFile');
  if (canonicalInbox !== path.join(canonicalRoot, 'evidence-inbox')
    || !isContained(canonicalInbox, canonicalCandidate)
    || path.dirname(canonicalCandidate) !== canonicalInbox) {
    fail('VARIANT_TABLE_SPEC_PATH_ESCAPE_REFUSED', '$.specFile');
  }
  if (before.size < 2 || before.size > VARIANT_TABLE_SPEC_MAX_BYTES) fail('VARIANT_TABLE_SPEC_SIZE_OUT_OF_BOUNDS', '$.specFile');

  let handle;
  try {
    await inject.afterPathInspection?.({ candidate });
    handle = await open(candidate, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW || 0));
    const opened = await handle.stat();
    if (!opened.isFile()
      || opened.nlink !== 1
      || opened.dev !== before.dev
      || opened.ino !== before.ino
      || opened.size !== before.size
      || opened.mtimeMs !== before.mtimeMs
      || opened.ctimeMs !== before.ctimeMs) {
      fail('VARIANT_TABLE_SPEC_CHANGED_DURING_READ', '$.specFile');
    }
    const buffer = Buffer.allocUnsafe(before.size + 1);
    let bytesRead = 0;
    while (bytesRead <= before.size) {
      const requestedBytes = inject.maximumReadBytes === undefined
        ? buffer.length - bytesRead
        : Math.min(buffer.length - bytesRead, inject.maximumReadBytes);
      if (!Number.isInteger(requestedBytes) || requestedBytes < 1) {
        fail('INVALID_READ_INJECTION', '$.inject.maximumReadBytes');
      }
      const read = await handle.read(buffer, bytesRead, requestedBytes, bytesRead);
      if (read.bytesRead === 0) break;
      bytesRead += read.bytesRead;
    }
    if (bytesRead !== before.size) fail('VARIANT_TABLE_SPEC_CHANGED_DURING_READ', '$.specFile');
    await inject.afterRead?.({ candidate });
    const after = await handle.stat();
    if (!after.isFile()
      || after.nlink !== 1
      || after.dev !== before.dev
      || after.ino !== before.ino
      || after.size !== before.size
      || after.mtimeMs !== before.mtimeMs
      || after.ctimeMs !== before.ctimeMs) {
      fail('VARIANT_TABLE_SPEC_CHANGED_DURING_READ', '$.specFile');
    }
    let text;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, bytesRead));
    } catch {
      fail('INVALID_UTF8', '$.specFile');
    }
    try {
      return JSON.parse(text);
    } catch {
      fail('INVALID_VARIANT_TABLE_SPEC_JSON', '$.specFile');
    }
  } catch (error) {
    if (error instanceof EvidenceWorkbenchValidationError) throw error;
    fail('VARIANT_TABLE_SPEC_READ_REFUSED', '$.specFile');
  } finally {
    await handle?.close().catch(() => {});
  }
}

export function summarizeVariantTableEvidence(result) {
  const byProductFamily = {};
  const abstentionReasons = {};
  for (const proposition of result.propositions) {
    const family = proposition.candidate.applicability.productFamily;
    byProductFamily[family] = (byProductFamily[family] || 0) + 1;
  }
  for (const entry of result.abstentions) {
    abstentionReasons[entry.reasonCode] = (abstentionReasons[entry.reasonCode] || 0) + 1;
  }
  const summary = {
    schemaVersion: 'variant-table-evidence-spike-summary-v0',
    boundary: NON_PRODUCTION_BOUNDARY,
    productionReady: false,
    sourceAuthenticityStatus: 'UNREVIEWED',
    canonicalPatchExportAllowed: false,
    reviewState: 'REVIEW_REQUIRED',
    inputDocumentCount: result.documentCount,
    structuredTableCount: result.structuredTableCount,
    structuredRowCount: result.structuredRowCount,
    proposalCount: result.propositions.length,
    abstentionCount: result.abstentions.length,
    byProductFamily: Object.fromEntries(Object.entries(byProductFamily).sort(([left], [right]) => compareAscii(left, right))),
    abstentionReasons: Object.fromEntries(Object.entries(abstentionReasons).sort(([left], [right]) => compareAscii(left, right))),
    proposals: result.propositions.map((proposition) => ({
      proposalId: proposition.proposalId,
      candidateId: proposition.candidate.candidateId,
      documentId: proposition.documentId,
      tableId: proposition.tableId,
      rowId: proposition.rowId,
      productFamily: proposition.candidate.applicability.productFamily,
      productVariant: proposition.tableContext.productVariant,
      capabilityKey: proposition.candidate.value.key
    })),
    abstentions: result.abstentions,
    evaluationSha256: result.canonicalSha256,
    gateStatus: result.propositions.length > 0 ? 'EXPERIMENTAL_PROPOSITIONS_REQUIRE_HUMAN_REVIEW' : 'NO_SAFE_PROPOSITION',
    nonClaims: [
      'No source authenticity, latest-revision, engineering-fit, customer-use, or production claim is made.',
      'Experimental propositions are not connected to canonical review-patch export.',
      'Ambiguous or unsupported table semantics produce no candidate.'
    ]
  };
  assertSafeMetadata(summary, '$.summary');
  return deepFreeze({ ...summary, canonicalSha256: sha256(summary) });
}
