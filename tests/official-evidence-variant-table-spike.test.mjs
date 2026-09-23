import test from 'node:test';
import assert from 'node:assert/strict';
import { link, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { normalizeSourceDocumentBundle } from '../evidence-claim-workbench/domain/document-bundle.mjs';
import {
  VARIANT_TABLE_SPEC_FILE,
  VARIANT_TABLE_SPEC_MAX_BYTES,
  evaluateVariantTableEvidence,
  readFixedVariantTableEvidenceSpec,
  summarizeVariantTableEvidence
} from '../evidence-claim-workbench/experiments/variant-table-evidence.mjs';
import {
  SYNTHETIC_BENCHMARK_AS_OF,
  createSyntheticDocument
} from '../evidence-claim-workbench/fixtures/synthetic-benchmark-v0.mjs';
import { parseVariantTableSpikeArguments } from '../scripts/evaluate-variant-table-evidence-spike.mjs';

function normalizedDocument(key, text, productFamilies = ['medium_voltage_switchgear']) {
  return normalizeSourceDocumentBundle(createSyntheticDocument({
    key,
    pages: [text],
    productFamilies
  }), { asOf: SYNTHETIC_BENCHMARK_AS_OF });
}

function anchorInput(document, quote, desiredOccurrence = 1) {
  const page = [...document.pages[0].text];
  const selection = [...quote];
  const starts = [];
  for (let index = 0; index <= page.length - selection.length; index += 1) {
    if (page.slice(index, index + selection.length).join('') === quote) starts.push(index);
  }
  assert.ok(starts.length >= desiredOccurrence, quote);
  const startCodePoint = starts[desiredOccurrence - 1];
  return {
    pageNumber: 1,
    startCodePoint,
    endCodePoint: startCodePoint + selection.length,
    quote,
    ...(starts.length > 1 ? { occurrenceIndex: desiredOccurrence } : {})
  };
}

function exactSwitchgearFixture({
  header = 'Model Alpha 24',
  productVariant = 'model_alpha_24',
  includeFootnote = false
} = {}) {
  const document = normalizedDocument(
    'variant-table-exact',
    [
      '24 kV Switchgear Ratings',
      header,
      'Rated voltage (kV)    24 kV',
      'Frequency condition: 60 Hz',
      'Note 1. Alpha 24 uses the listed electrical ratings.'
    ].join('\n')
  );
  const spec = {
    schemaVersion: 'variant-table-evidence-spec-v0',
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    productionReady: false,
    tables: [{
      tableId: 'alpha-24-ratings',
      documentId: document.documentId,
      productFamily: 'medium_voltage_switchgear',
      pageNumber: 1,
      titleAnchor: anchorInput(document, '24 kV Switchgear Ratings'),
      columnHeader: {
        columnIndex: 1,
        productVariant,
        anchor: anchorInput(document, header)
      },
      conditions: [{
        id: 'frequency',
        value: '60_hz',
        anchor: anchorInput(document, 'Frequency condition: 60 Hz')
      }],
      footnoteAnchors: includeFootnote
        ? [anchorInput(document, 'Note 1. Alpha 24 uses the listed electrical ratings.')]
        : [],
      rows: [{
        rowId: 'rated-voltage',
        rowIndex: 1,
        columnIndex: 1,
        capabilityKey: 'rated_voltage',
        claimType: 'PRODUCT_CAPABILITY',
        semanticOperator: 'EXACT',
        numericValue: 24,
        unit: 'kV',
        quantityKind: 'voltage',
        labelAnchor: anchorInput(document, 'Rated voltage (kV)'),
        valueAnchor: anchorInput(document, '24 kV', 2),
        footnoteIndexes: includeFootnote ? [1] : []
      }]
    }]
  };
  return { document, spec };
}

test('exact table cell produces only a review-required experimental proposition with full structural bindings', () => {
  const { document, spec } = exactSwitchgearFixture();
  const result = evaluateVariantTableEvidence({ documents: [document], spec });
  assert.equal(result.propositions.length, 1);
  assert.equal(result.abstentions.length, 0);
  const [proposition] = result.propositions;
  assert.equal(proposition.productionReady, false);
  assert.equal(proposition.canonicalPatchExportAllowed, false);
  assert.equal(proposition.candidate.reviewState, 'REVIEW_REQUIRED');
  assert.equal(proposition.candidate.value.key, 'rated_voltage');
  assert.deepEqual(proposition.candidate.applicability.conditions, [
    { id: 'frequency', value: '60_hz' },
    { id: 'product_variant', value: 'model_alpha_24' }
  ]);
  assert.equal(proposition.tableContext.rowIndex, 1);
  assert.equal(proposition.tableContext.columnIndex, 1);
  assert.equal(proposition.tableContext.productVariant, 'model_alpha_24');
  assert.equal(proposition.tableContext.anchors.footnotes.length, 0);
  assert.equal(proposition.tableContext.conditions.length, 1);
  assert.match(proposition.tableContext.anchors.tableTitle.anchorId, /^anc_[a-f0-9]{64}$/);
  assert.match(proposition.proposalId, /^vtp_[a-f0-9]{64}$/);
});

test('maximum, alternatives, and mismatched cells abstain without forcing a candidate', () => {
  const cases = [
    ['MAXIMUM', 'Up to 3150 kVA', 3150, 'kVA', 'transformer_capacity', 'apparent_power', 'Rated power', 'UNSUPPORTED_SEMANTIC_OPERATOR'],
    ['EXACT', '50/60', 50, 'Hz', 'frequency', 'frequency', 'Rated frequency (Hz)', 'MULTI_VALUE_ROW_AMBIGUOUS'],
    ['EXACT', '7.2', 12, 'kV', 'rated_voltage', 'voltage', 'Rated voltage (kV)', 'VALUE_OR_UNIT_BINDING_MISMATCH']
  ];
  for (const [operator, cell, numericValue, unit, capabilityKey, quantityKind, label, reasonCode] of cases) {
    const family = capabilityKey === 'transformer_capacity' ? ['transformer'] : ['medium_voltage_switchgear'];
    const document = normalizedDocument(
      `variant-table-abstain-${reasonCode.toLowerCase()}`,
      `Ratings table\nModel B\n${label}    ${cell}`,
      family
    );
    const spec = {
      schemaVersion: 'variant-table-evidence-spec-v0',
      boundary: 'NOT_PRODUCTION_EVIDENCE',
      productionReady: false,
      tables: [{
        tableId: `table-${reasonCode.toLowerCase()}`,
        documentId: document.documentId,
        productFamily: family[0],
        pageNumber: 1,
        titleAnchor: anchorInput(document, 'Ratings table'),
        columnHeader: { columnIndex: 1, productVariant: 'model_b', anchor: anchorInput(document, 'Model B') },
        conditions: [],
        footnoteAnchors: [],
        rows: [{
          rowId: 'row-one',
          rowIndex: 1,
          columnIndex: 1,
          capabilityKey,
          claimType: 'PRODUCT_CAPABILITY',
          semanticOperator: operator,
          numericValue,
          unit,
          quantityKind,
          labelAnchor: anchorInput(document, label),
          valueAnchor: anchorInput(document, cell),
          footnoteIndexes: []
        }]
      }]
    };
    const result = evaluateVariantTableEvidence({ documents: [document], spec });
    assert.equal(result.propositions.length, 0, reasonCode);
    assert.deepEqual(result.abstentions.map(({ reasonCode: code }) => code), [reasonCode]);
  }
});

test('compound or relabeled variants and every footnoted row abstain before candidate creation', () => {
  const compound = exactSwitchgearFixture({
    header: 'Model Alpha/Beta',
    productVariant: 'model_alpha_beta'
  });
  assert.deepEqual(
    evaluateVariantTableEvidence({ documents: [compound.document], spec: compound.spec }).abstentions
      .map(({ reasonCode }) => reasonCode),
    ['COMPOUND_PRODUCT_VARIANT_HEADER']
  );

  const relabeled = exactSwitchgearFixture();
  relabeled.spec.tables[0].columnHeader.productVariant = 'model_beta';
  assert.deepEqual(
    evaluateVariantTableEvidence({ documents: [relabeled.document], spec: relabeled.spec }).abstentions
      .map(({ reasonCode }) => reasonCode),
    ['PRODUCT_VARIANT_HEADER_MISMATCH']
  );

  const footnoted = exactSwitchgearFixture({ includeFootnote: true });
  assert.deepEqual(
    evaluateVariantTableEvidence({ documents: [footnoted.document], spec: footnoted.spec }).abstentions
      .map(({ reasonCode }) => reasonCode),
    ['FOOTNOTE_SEMANTICS_UNRESOLVED']
  );
});

test('strict table contract refuses forged binding, unknown fields, invalid variants, and footnote drift', () => {
  const { document, spec } = exactSwitchgearFixture({ includeFootnote: true });
  const cases = [
    [
      (copy) => { copy.tables[0].documentId = `doc_${'0'.repeat(64)}`; },
      'VARIANT_TABLE_DOCUMENT_NOT_FOUND'
    ],
    [
      (copy) => { copy.tables[0].columnHeader.productVariant = 'unknown'; },
      'INVALID_PRODUCT_VARIANT'
    ],
    [
      (copy) => { copy.tables[0].rows[0].footnoteIndexes = [2]; },
      'ROW_FOOTNOTE_INDEX_OUT_OF_RANGE'
    ],
    [
      (copy) => { copy.tables[0].rows[0].notes = 'free text'; },
      'UNEXPECTED_FIELD'
    ],
    [
      (copy) => { copy.tables[0].rows[0].valueAnchor.startCodePoint += 1; },
      'QUOTE_OFFSET_LENGTH_MISMATCH'
    ]
  ];
  for (const [mutate, code] of cases) {
    const copy = structuredClone(spec);
    mutate(copy);
    assert.throws(
      () => evaluateVariantTableEvidence({ documents: [document], spec: copy }),
      (error) => error.code === code,
      code
    );
  }
});

test('redacted summary contains identities and counts but no source excerpts or canonical patch authority', () => {
  const { document, spec } = exactSwitchgearFixture();
  const summary = summarizeVariantTableEvidence(evaluateVariantTableEvidence({ documents: [document], spec }));
  const serialized = JSON.stringify(summary);
  assert.equal(summary.proposalCount, 1);
  assert.equal(summary.canonicalPatchExportAllowed, false);
  assert.equal(summary.sourceAuthenticityStatus, 'UNREVIEWED');
  assert.doesNotMatch(serialized, /Alpha 24 uses the listed electrical ratings/);
  assert.doesNotMatch(serialized, /Rated voltage \(kV\)/);
  assert.doesNotMatch(serialized, /selection|quoteSha256|startCodePoint/);
});

test('fixed spec reader accepts one bounded regular file and refuses symlink input', async (t) => {
  const ownedRoot = await mkdtemp(path.join(tmpdir(), 'variant-table-spec-'));
  t.after(() => rm(ownedRoot, { recursive: true, force: true }));
  const inbox = path.join(ownedRoot, 'evidence-inbox');
  await mkdir(inbox);
  const payload = {
    schemaVersion: 'variant-table-evidence-spec-v0',
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    productionReady: false,
    tables: []
  };
  const fixedPath = path.join(inbox, VARIANT_TABLE_SPEC_FILE);
  await writeFile(fixedPath, `${JSON.stringify(payload)}\n`, { mode: 0o600 });
  assert.deepEqual(await readFixedVariantTableEvidenceSpec({ ownedRoot }), payload);
  assert.deepEqual(await readFixedVariantTableEvidenceSpec({
    ownedRoot,
    inject: { maximumReadBytes: 3 }
  }), payload);

  const racedHardlink = path.join(ownedRoot, 'raced-hardlink.json');
  await assert.rejects(
    readFixedVariantTableEvidenceSpec({
      ownedRoot,
      inject: {
        afterRead: () => link(fixedPath, racedHardlink)
      }
    }),
    (error) => error.code === 'VARIANT_TABLE_SPEC_CHANGED_DURING_READ'
  );
  await rm(racedHardlink);
  await rm(fixedPath);
  const outside = path.join(ownedRoot, 'outside.json');
  await writeFile(outside, `${JSON.stringify(payload)}\n`, { mode: 0o600 });
  await symlink(outside, fixedPath);
  await assert.rejects(
    readFixedVariantTableEvidenceSpec({ ownedRoot }),
    (error) => error.code === 'VARIANT_TABLE_SPEC_SYMLINK_REFUSED'
  );
});

test('fixed spec reader refuses oversized, malformed UTF-8, and malformed JSON input', async (t) => {
  const ownedRoot = await mkdtemp(path.join(tmpdir(), 'variant-table-spec-invalid-'));
  t.after(() => rm(ownedRoot, { recursive: true, force: true }));
  const inbox = path.join(ownedRoot, 'evidence-inbox');
  await mkdir(inbox);
  const fixedPath = path.join(inbox, VARIANT_TABLE_SPEC_FILE);

  await writeFile(fixedPath, Buffer.alloc(VARIANT_TABLE_SPEC_MAX_BYTES + 1, 0x61), { mode: 0o600 });
  await assert.rejects(
    readFixedVariantTableEvidenceSpec({ ownedRoot }),
    (error) => error.code === 'VARIANT_TABLE_SPEC_SIZE_OUT_OF_BOUNDS'
  );
  await writeFile(fixedPath, Buffer.from([0xc3, 0x28]), { mode: 0o600 });
  await assert.rejects(
    readFixedVariantTableEvidenceSpec({ ownedRoot }),
    (error) => error.code === 'INVALID_UTF8'
  );
  await writeFile(fixedPath, '{"schemaVersion":', { mode: 0o600 });
  await assert.rejects(
    readFixedVariantTableEvidenceSpec({ ownedRoot }),
    (error) => error.code === 'INVALID_VARIANT_TABLE_SPEC_JSON'
  );
});

test('CLI requires redacted JSON output, an explicit instant, and has no arbitrary input path', () => {
  assert.deepEqual(
    parseVariantTableSpikeArguments(['--json', '--as-of', '2026-07-18T00:00:00.000Z']),
    { json: true, asOf: '2026-07-18T00:00:00.000Z' }
  );
  for (const argv of [
    [],
    ['--json'],
    ['--as-of', '2026-07-18T00:00:00.000Z'],
    ['--json', '--as-of', '2026-07-18'],
    ['--json', '--as-of', '2026-07-18T00:00:00.000Z', '--input', '/tmp/other.json']
  ]) {
    assert.throws(() => parseVariantTableSpikeArguments(argv));
  }
});
