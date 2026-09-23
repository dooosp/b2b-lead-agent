import test from 'node:test';
import assert from 'node:assert/strict';

import { createCandidate, extractDeterministicCandidates } from '../evidence-claim-workbench/domain/candidates.mjs';
import { createSourceDocumentCatalog } from '../evidence-claim-workbench/domain/document-bundle.mjs';
import { createPageEvidenceAnchor } from '../evidence-claim-workbench/domain/evidence-anchor.mjs';
import {
  RELATIONSHIP_LIMITS,
  analyzeCandidateRelationships,
  analyzeRelationships
} from '../evidence-claim-workbench/domain/relationships.mjs';
import {
  SYNTHETIC_BENCHMARK_AS_OF,
  createSyntheticBenchmarkFixture
} from '../evidence-claim-workbench/fixtures/synthetic-benchmark-v0.mjs';

function candidate({
  documentId = `doc_${'a'.repeat(64)}`,
  anchorId = `anc_${'b'.repeat(64)}`,
  value = 24,
  unit = 'kV',
  key = 'rated_voltage',
  quantityKind = 'voltage',
  productFamily = 'medium_voltage_switchgear',
  claimType = 'PRODUCT_CAPABILITY',
  conditions = [],
  stages = ['SPECIFICATION']
} = {}) {
  return createCandidate({
    schemaVersion: 'evidence-claim-candidate-v0',
    synthetic: true,
    documentId,
    evidenceAnchorId: anchorId,
    claimType,
    subject: {
      type: 'PRODUCT_FAMILY',
      id: productFamily,
      displayName: productFamily === 'transformer' ? 'Transformer' : 'Medium-voltage Switchgear'
    },
    statement: `${productFamily === 'transformer' ? 'Transformer' : 'Medium-voltage Switchgear'} 공식 문서 검토 후보: ${key} = ${value} ${unit}.`,
    value: { type: 'QUANTITY', key, value, unit, quantityKind },
    applicability: {
      vertical: 'datacenter', domain: 'electrical_power', productFamily,
      jurisdiction: 'KR', projectStages: stages, conditions
    },
    validity: { type: 'NOT_STATED', validUntil: null },
    extractionMethod: 'MANUAL_EXACT_QUOTE',
    extractionRuleId: 'OECRW0-MANUAL-STRUCTURED-ENTRY',
    extractionReasons: ['HUMAN_SELECTED_EXACT_EVIDENCE'],
    reviewState: 'REVIEW_REQUIRED'
  });
}

function anchorFor(document, quote) {
  const page = [...document.pages[0].text];
  const selected = [...quote];
  const startCodePoint = page.join('').indexOf(quote);
  assert.ok(startCodePoint >= 0);
  return createPageEvidenceAnchor(document, {
    pageNumber: 1,
    startCodePoint,
    endCodePoint: startCodePoint + selected.length,
    quote
  });
}

test('exact duplicate evidence is surfaced and requires explicit disposition', () => {
  const left = candidate({ anchorId: `anc_${'1'.repeat(64)}` });
  const right = candidate({ documentId: `doc_${'c'.repeat(64)}`, anchorId: `anc_${'2'.repeat(64)}` });
  const report = analyzeCandidateRelationships([left, right]);
  assert.equal(report.relationships.length, 1);
  assert.equal(report.relationships[0].type, 'EXACT_DUPLICATE_EVIDENCE');
  assert.equal(report.relationships[0].blocking, true);
  assert.equal(report.relationships[0].requiresHumanDisposition, true);
  assert.deepEqual(report.blockingCandidateIds, [left.candidateId, right.candidateId].sort());
  assert.deepEqual(analyzeRelationships([left, right]), report);
});

test('incompatible values become material conflict and no favorable value is selected', () => {
  const left = candidate({ anchorId: `anc_${'1'.repeat(64)}`, value: 22.9 });
  const right = candidate({ documentId: `doc_${'c'.repeat(64)}`, anchorId: `anc_${'2'.repeat(64)}`, value: 24 });
  const report = analyzeCandidateRelationships([left, right]);
  assert.equal(report.relationships[0].type, 'MATERIAL_CONFLICT');
  assert.equal(report.relationships[0].blocking, true);
  assert.equal(report.favorableClaimAutomaticallySelected, false);
  assert.equal(report.automaticResolution, false);
  assert.doesNotMatch(JSON.stringify(report), /selectedCandidate|preferredCandidate|winner/i);
});

test('mutually exclusive explicit conditions resolve apparent conflict without merging conditions', () => {
  const indoor = candidate({
    anchorId: `anc_${'1'.repeat(64)}`,
    value: 24,
    conditions: [{ id: 'installation_condition', value: 'indoor_only' }]
  });
  const outdoor = candidate({
    documentId: `doc_${'c'.repeat(64)}`,
    anchorId: `anc_${'2'.repeat(64)}`,
    value: 22.9,
    conditions: [{ id: 'installation_condition', value: 'outdoor_only' }]
  });
  const report = analyzeCandidateRelationships([indoor, outdoor]);
  assert.equal(report.relationships[0].type, 'CONDITION_RESOLVED');
  assert.equal(report.relationships[0].blocking, false);
  assert.deepEqual(indoor.applicability.conditions, [{ id: 'installation_condition', value: 'indoor_only' }]);
  assert.deepEqual(outdoor.applicability.conditions, [{ id: 'installation_condition', value: 'outdoor_only' }]);
});

test('explicit different product variants distinguish claims without weakening threshold overlap', () => {
  const left = candidate({
    anchorId: `anc_${'1'.repeat(64)}`,
    value: 24,
    conditions: [{ id: 'product_variant', value: 'model_a' }]
  });
  const right = candidate({
    documentId: `doc_${'c'.repeat(64)}`,
    anchorId: `anc_${'2'.repeat(64)}`,
    value: 36,
    conditions: [{ id: 'product_variant', value: 'model_b' }]
  });
  const report = analyzeCandidateRelationships([left, right]);
  assert.equal(report.relationships[0].type, 'CONDITION_RESOLVED');
  assert.equal(report.relationships[0].blocking, false);
  for (const alias of ['MODEL_A', 'model-a', 'Model A', 'model_a_', 'model__a', 'unknown', 'any', 'not_stated']) {
    assert.throws(
      () => candidate({ conditions: [{ id: 'product_variant', value: alias }] }),
      (error) => error.code === 'NONCANONICAL_PRODUCT_VARIANT',
      alias
    );
  }
});

test('overlapping threshold-like conditions and UNKNOWN stages remain conservatively blocking', () => {
  const lowAltitude = candidate({
    anchorId: `anc_${'1'.repeat(64)}`,
    value: 24,
    conditions: [{ id: 'altitude', value: 'maximum_1000_m' }]
  });
  const highAltitude = candidate({
    documentId: `doc_${'c'.repeat(64)}`,
    anchorId: `anc_${'2'.repeat(64)}`,
    value: 36,
    conditions: [{ id: 'altitude', value: 'maximum_2000_m' }]
  });
  assert.equal(analyzeCandidateRelationships([lowAltitude, highAltitude]).relationships[0].type, 'MATERIAL_CONFLICT');

  const unknownStage = candidate({ anchorId: `anc_${'3'.repeat(64)}`, value: 24, stages: ['UNKNOWN'] });
  const specification = candidate({
    documentId: `doc_${'d'.repeat(64)}`,
    anchorId: `anc_${'4'.repeat(64)}`,
    value: 36,
    stages: ['SPECIFICATION']
  });
  assert.equal(analyzeCandidateRelationships([unknownStage, specification]).relationships[0].type, 'MATERIAL_CONFLICT');
});

test('equal values under mutually exclusive conditions remain condition-distinguished rather than duplicate', () => {
  const indoor = candidate({
    anchorId: `anc_${'1'.repeat(64)}`,
    value: 24,
    conditions: [{ id: 'installation_condition', value: 'indoor_only' }]
  });
  const outdoor = candidate({
    documentId: `doc_${'c'.repeat(64)}`,
    anchorId: `anc_${'2'.repeat(64)}`,
    value: 24,
    conditions: [{ id: 'installation_condition', value: 'outdoor_only' }]
  });
  const report = analyzeCandidateRelationships([indoor, outdoor]);
  assert.equal(report.relationships[0].type, 'CONDITION_RESOLVED');
  assert.equal(report.relationships[0].blocking, false);
});

test('disjoint project stages are not silently treated as conflicting', () => {
  const specification = candidate({ anchorId: `anc_${'1'.repeat(64)}`, stages: ['SPECIFICATION'] });
  const operation = candidate({ documentId: `doc_${'c'.repeat(64)}`, anchorId: `anc_${'2'.repeat(64)}`, value: 22.9, stages: ['OPERATION'] });
  assert.equal(analyzeCandidateRelationships([specification, operation]).relationships.length, 0);
});

test('explicit validated document revision chain yields supersession and blocks both sides pending disposition', () => {
  const fixture = createSyntheticBenchmarkFixture({ includeOversizedInputs: false });
  const scenario = fixture.scenarios.find(({ id }) => id === '13_superseded_revision');
  const catalog = createSourceDocumentCatalog(scenario.documents, { asOf: SYNTHETIC_BENCHMARK_AS_OF });
  const candidates = catalog.documents.flatMap((document) => {
    const quote = document.pages[0].text.match(/Rated voltage: [0-9.]+ kV\./u)[0];
    return extractDeterministicCandidates({ document, anchors: [anchorFor(document, quote)] });
  });
  const report = analyzeCandidateRelationships(candidates, { documents: catalog.documents });
  assert.equal(report.relationships.length, 1);
  assert.equal(report.relationships[0].type, 'SUPERSEDES');
  assert.equal(report.metrics.supersededCount, 1);
  assert.equal(report.blockingCandidateIds.length, 2);
  assert.notEqual(report.relationships[0].supersededCandidateId, report.relationships[0].successorCandidateId);

  const successorId = report.relationships[0].successorCandidateId;
  const successor = candidates.find(({ candidateId }) => candidateId === successorId);
  const changedScopeInput = structuredClone(successor);
  delete changedScopeInput.candidateId;
  changedScopeInput.claimType = 'TECHNICAL_REQUIREMENT';
  changedScopeInput.applicability.projectStages = ['OPERATION'];
  const changedScopeSuccessor = createCandidate(changedScopeInput);
  const superseded = candidates.find(({ candidateId }) => candidateId !== successorId);
  const changedScopeReport = analyzeCandidateRelationships([superseded, changedScopeSuccessor], { documents: catalog.documents });
  assert.equal(changedScopeReport.relationships.length, 1);
  assert.equal(changedScopeReport.relationships[0].type, 'SUPERSEDES');

  const forgedDocuments = structuredClone(catalog.documents);
  forgedDocuments[1].revision.supersedesDocumentId = `doc_${'0'.repeat(64)}`;
  assert.throws(
    () => analyzeCandidateRelationships(candidates, { documents: forgedDocuments }),
    (error) => error.code === 'VALIDATED_SOURCE_DOCUMENT_REQUIRED'
  );
});

test('equivalent electrical quantities normalize before duplicate/conflict classification', () => {
  const pairs = [
    [
      candidate({ anchorId: `anc_${'1'.repeat(64)}`, value: 24, unit: 'kV' }),
      candidate({ documentId: `doc_${'c'.repeat(64)}`, anchorId: `anc_${'2'.repeat(64)}`, value: 24_000, unit: 'V' })
    ],
    [
      candidate({ anchorId: `anc_${'3'.repeat(64)}`, value: 1, unit: 'kA', key: 'rated_current', quantityKind: 'current' }),
      candidate({ documentId: `doc_${'d'.repeat(64)}`, anchorId: `anc_${'4'.repeat(64)}`, value: 1_000, unit: 'A', key: 'rated_current', quantityKind: 'current' })
    ],
    [
      candidate({ anchorId: `anc_${'5'.repeat(64)}`, value: 2, unit: 'MVA', key: 'transformer_capacity', quantityKind: 'apparent_power', productFamily: 'transformer' }),
      candidate({ documentId: `doc_${'e'.repeat(64)}`, anchorId: `anc_${'6'.repeat(64)}`, value: 2_000, unit: 'kVA', key: 'transformer_capacity', quantityKind: 'apparent_power', productFamily: 'transformer' })
    ]
  ];
  for (const pair of pairs) {
    assert.equal(analyzeCandidateRelationships(pair).relationships[0].type, 'EXACT_DUPLICATE_EVIDENCE');
  }
});

test('candidate ID/content changes and injected detector failures fail closed', () => {
  const valid = candidate();
  const forged = structuredClone(valid);
  forged.value.value = 36;
  forged.statement = 'Medium-voltage Switchgear 공식 문서 검토 후보: rated_voltage = 36 kV.';
  assert.throws(
    () => analyzeCandidateRelationships([valid, forged]),
    (error) => error.code === 'CANDIDATE_ID_MISMATCH'
  );
  assert.throws(
    () => analyzeCandidateRelationships([valid], {
      inject: { beforeRelationshipDetection() { throw Object.assign(new Error('injected'), { code: 'INJECTED_RELATIONSHIP_FAILURE' }); } }
    }),
    (error) => error.code === 'INJECTED_RELATIONSHIP_FAILURE'
  );
});

test('candidate and relationship materialization caps fail before unbounded growth', () => {
  const dense = Array.from({ length: 101 }, (_, index) => candidate({
    documentId: `doc_${index.toString(16).padStart(64, '0')}`,
    anchorId: `anc_${(index + 1_000).toString(16).padStart(64, '0')}`
  }));
  assert.equal(RELATIONSHIP_LIMITS.maxCandidates, 1_000);
  assert.equal(RELATIONSHIP_LIMITS.maxRelationships, 5_000);
  assert.throws(
    () => analyzeCandidateRelationships(dense),
    (error) => error.code === 'TOO_MANY_RELATIONSHIPS'
  );
  assert.throws(
    () => analyzeCandidateRelationships(Array.from({ length: 1_001 }, () => dense[0])),
    (error) => error.code === 'RELATIONSHIP_CANDIDATE_LIMIT_EXCEEDED'
  );
});
