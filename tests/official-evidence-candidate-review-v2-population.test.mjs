import test from 'node:test';
import assert from 'node:assert/strict';

import { sha256 } from '../knowledge/claim-registry/index.mjs';
import {
  createCandidate,
  formatCandidateStatement
} from '../evidence-claim-workbench/domain/candidates.mjs';
import {
  CANDIDATE_REVIEW_BOUNDARY,
  CANDIDATE_REVIEW_FROZEN_HEAD_SHA,
  CANDIDATE_REVIEW_PREREQUISITE_SCHEMA_VERSION,
  CANDIDATE_REVIEW_REAL_STRUCTURAL_MODE,
  CANDIDATE_REVIEW_SYNTHETIC_PREREQUISITE_BYPASS,
  buildCandidateReviewComponents,
  computeCandidateReviewRoundId,
  createCandidateReviewPatchSet,
  selectCandidateReviewPopulation,
  validateCandidateReviewPopulation,
  validateCandidateReviewPrerequisites
} from '../evidence-claim-workbench/domain/candidate-review-v2.mjs';

const CLAIM_TYPES = [
  'PRODUCT_CAPABILITY',
  'PERFORMANCE',
  'CERTIFICATION',
  'TECHNICAL_REQUIREMENT'
];

const FAMILY_VALUES = {
  medium_voltage_switchgear: [
    ['rated_voltage', 'voltage', 'kV'],
    ['rated_current', 'current', 'A'],
    ['short_circuit_rating', 'current', 'kA'],
    ['frequency', 'frequency', 'Hz'],
    ['altitude', 'length', 'm']
  ],
  transformer: [
    ['transformer_capacity', 'apparent_power', 'kVA'],
    ['primary_voltage', 'voltage', 'kV'],
    ['secondary_voltage', 'voltage', 'V'],
    ['frequency', 'frequency', 'Hz'],
    ['altitude', 'length', 'm']
  ]
};

function syntheticCandidate(index, family, {
  semanticIndex = index,
  synthetic = true,
  documentOrdinal = index + 1
} = {}) {
  const combinations = FAMILY_VALUES[family].flatMap((value, valueIndex) => (
    CLAIM_TYPES.map((claimType, claimIndex) => ({
      value,
      claimType,
      ordinal: valueIndex * CLAIM_TYPES.length + claimIndex
    }))
  ));
  const combination = combinations[semanticIndex % combinations.length];
  const [key, quantityKind, unit] = combination.value;
  const value = {
    type: 'QUANTITY',
    key,
    value: 10 + combination.ordinal,
    unit,
    quantityKind
  };
  return createCandidate({
    schemaVersion: 'evidence-claim-candidate-v0',
    synthetic,
    documentId: `doc_${documentOrdinal.toString(16).padStart(64, '0')}`,
    evidenceAnchorId: `anc_${(index + 10_001).toString(16).padStart(64, '0')}`,
    claimType: combination.claimType,
    subject: {
      type: 'PRODUCT_FAMILY',
      id: family,
      displayName: family === 'transformer' ? 'Transformer' : 'Medium-voltage Switchgear'
    },
    statement: formatCandidateStatement(family, value),
    value,
    applicability: {
      vertical: 'datacenter',
      domain: 'electrical_power',
      productFamily: family,
      jurisdiction: 'KR',
      projectStages: ['SPECIFICATION'],
      conditions: []
    },
    validity: { type: 'NOT_STATED', validUntil: null },
    extractionMethod: 'MANUAL_EXACT_QUOTE',
    extractionRuleId: 'OECRW0-MANUAL-STRUCTURED-ENTRY',
    extractionReasons: ['HUMAN_SELECTED_EXACT_EVIDENCE'],
    reviewState: 'REVIEW_REQUIRED'
  });
}

function candidateSnapshot(candidate) {
  return {
    claimType: candidate.claimType,
    productFamily: candidate.subject.id,
    capabilityKey: candidate.value.key,
    value: candidate.value,
    applicability: candidate.applicability,
    validity: candidate.validity
  };
}

function independentPopulation(count = 32) {
  const leftCount = Math.ceil(count / 2);
  return [
    ...Array.from({ length: leftCount }, (_, index) => (
      syntheticCandidate(index, 'medium_voltage_switchgear')
    )),
    ...Array.from({ length: count - leftCount }, (_, index) => (
      syntheticCandidate(100 + index, 'transformer')
    ))
  ];
}

function fakePrerequisites({ expiry = '2026-08-21T23:59:59.000Z' } = {}) {
  return {
    schemaVersion: CANDIDATE_REVIEW_PREREQUISITE_SCHEMA_VERSION,
    evaluatedPrNumber: 207,
    evaluatedPrHeadSha: CANDIDATE_REVIEW_FROZEN_HEAD_SHA,
    manifestSha256: '1'.repeat(64),
    documentDecisionSha256: '2'.repeat(64),
    fidelityDecisionSha256: '3'.repeat(64),
    policy: {
      marker: 'PR207_PAGE_REVIEW_RIGHTS_RETENTION_POLICY_V1',
      active: true,
      expiresAt: expiry,
      retentionMethod: 'IGNORE_VERIFIED_LOCAL_LEDGER_PLUS_POLICY_BOUNDED_HASH_AGGREGATE'
    },
    evaluationDate: '2026-07-25',
    fidelityRows: Array.from({ length: 8 }, (_, index) => ({
      documentId: `doc_${(index + 1).toString(16).padStart(64, '0')}`,
      documentIdentityCheck: 'MATCH',
      documentNumberCheck: 'MATCH',
      revisionCheck: 'MATCH',
      candidateBearingPagesChecked: [1],
      eligiblePageNumbers: [1],
      fidelityDecision: index === 7
        ? 'ACCEPTABLE_WITH_LIMITATIONS'
        : 'ACCEPTABLE_FOR_CANDIDATE_REVIEW',
      semanticPreservation: {
        value: 'PRESERVED',
        unit: 'PRESERVED',
        operator: 'PRESERVED',
        variant: 'PRESERVED',
        condition: 'PRESERVED',
        footnote: index === 7 ? 'NOT_PRESERVED' : 'PRESERVED',
        locator: 'PRESERVED'
      }
    }))
  };
}

function generatedBoundFixture({ fullPageFirst = false } = {}) {
  const candidates = [
    ...Array.from({ length: 15 }, (_, index) => syntheticCandidate(
      index,
      'medium_voltage_switchgear',
      {
        semanticIndex: index,
        synthetic: false,
        documentOrdinal: (index % 8) + 1
      }
    )),
    ...Array.from({ length: 15 }, (_, index) => syntheticCandidate(
      100 + index,
      'transformer',
      {
        semanticIndex: index,
        synthetic: false,
        documentOrdinal: (index % 8) + 1
      }
    ))
  ];
  const prerequisites = fakePrerequisites();
  const excerptsByCandidateId = {};
  const candidateRecords = candidates.map((candidate, index) => {
    const quote = `Generated bounded contract excerpt ${index + 1}.`;
    excerptsByCandidateId[candidate.candidateId] = quote;
    const quoteLength = [...quote].length;
    return {
      evaluatedPrNumber: 207,
      evaluatedPrHeadSha: CANDIDATE_REVIEW_FROZEN_HEAD_SHA,
      manifestSha256: prerequisites.manifestSha256,
      documentDecisionSha256: prerequisites.documentDecisionSha256,
      fidelityDecisionSha256: prerequisites.fidelityDecisionSha256,
      candidate,
      candidateSnapshot: candidateSnapshot(candidate),
      productFamily: candidate.subject.id,
      claimType: candidate.claimType,
      document: {
        documentId: candidate.documentId,
        sourceFileSha256: sha256(`generated-source-${index}`),
        normalizedContentSha256: sha256(`generated-normalized-${index}`),
        documentNumber: `GENERATED-DOCUMENT-${(index % 8) + 1}`,
        revisionSeriesId: `generated-series-${(index % 8) + 1}`,
        revisionId: 'generated-revision-a',
        revisionSequence: 1
      },
      page: {
        namespace: 'NORMALIZED_BUNDLE_PAGE_NUMBER',
        extractedPageOrdinal: 1,
        locator: `Generated section ${index + 1}`,
        pageTextSha256: sha256(`generated-page-${index}`),
        pageCodePointLength: fullPageFirst && index === 0 ? quoteLength : quoteLength + 50
      },
      anchor: {
        evidenceAnchorId: candidate.evidenceAnchorId,
        normalizationVersion: 'page-text-nfc-lf-codepoint-v1',
        startCodePoint: 0,
        endCodePoint: quoteLength,
        quoteSha256: sha256(quote),
        occurrenceIndex: 0,
        occurrenceCount: 1,
        contextBeforeSha256: sha256(`generated-prefix-${index}`),
        contextAfterSha256: sha256(`generated-suffix-${index}`)
      },
      relationshipIds: [],
      relatedCandidateIds: []
    };
  });
  return { candidateRecords, prerequisites, excerptsByCandidateId };
}

test('synthetic population selection is explicit, deterministic, bounded, immutable, and non-authoritative', () => {
  const candidates = independentPopulation(40);
  assert.throws(
    () => selectCandidateReviewPopulation({ candidates }),
    (error) => error.code === 'EXPLICIT_SYNTHETIC_PREREQUISITE_BYPASS_REQUIRED'
  );

  const first = selectCandidateReviewPopulation({
    candidates,
    syntheticPrerequisiteBypass: CANDIDATE_REVIEW_SYNTHETIC_PREREQUISITE_BYPASS
  });
  const second = selectCandidateReviewPopulation({
    candidates: [...candidates].reverse(),
    syntheticPrerequisiteBypass: CANDIDATE_REVIEW_SYNTHETIC_PREREQUISITE_BYPASS
  });
  assert.deepEqual(first, second);
  assert.equal(first.candidateCount, 35);
  assert.ok(first.productFamilyCounts.medium_voltage_switchgear >= 10);
  assert.ok(first.productFamilyCounts.transformer >= 10);
  assert.equal(first.boundary, CANDIDATE_REVIEW_BOUNDARY);
  assert.equal(first.productionReady, false);
  assert.equal(first.productionReviewerWorkflowReady, false);
  assert.equal(first.automaticVerification, false);
  assert.equal(first.customerUseAllowed, false);
  assert.equal(first.proofExecutionApproved, false);
  assert.equal(first.syntheticPrerequisiteBypass, 'SYNTHETIC_FIXTURE_ONLY');
  assert.equal(first.realFidelityPrerequisitesSatisfied, false);
  assert.equal(first.section5BindingsComplete, false);
  assert.equal(first.externalHumanProvenanceVerified, false);
  assert.equal(first.externalCustodyVerified, false);
  assert.deepEqual(first.candidateReviewMethodBlockers, [
    'EXTERNAL_HUMAN_PROVENANCE_AND_CUSTODY_UNVERIFIED',
    'SYNTHETIC_FIXTURE_NOT_HUMAN_EVIDENCE'
  ]);
  assert.equal(first.humanReviewEvidence, false);
  assert.equal(first.candidateRecords.length, 0);
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(first.candidates));
  assert.deepEqual(validateCandidateReviewPopulation(first), first);
});

test('complete feasible universes are retained and component splitting or dangling endpoints fail closed', () => {
  const candidates = independentPopulation(32);
  const population = selectCandidateReviewPopulation({
    candidates,
    syntheticPrerequisiteBypass: CANDIDATE_REVIEW_SYNTHETIC_PREREQUISITE_BYPASS
  });
  assert.equal(population.candidateCount, 32);
  assert.deepEqual(
    population.candidates.map(({ candidateId }) => candidateId),
    candidates.map(({ candidateId }) => candidateId).sort()
  );

  const components = buildCandidateReviewComponents({ candidates });
  assert.equal(components.candidateCount, 32);
  assert.equal(components.components.length, 32);
  assert.throws(
    () => buildCandidateReviewComponents({
      candidates,
      relationships: [{
        relationshipId: `rel_${'f'.repeat(64)}`,
        type: 'MATERIAL_CONFLICT',
        candidateIds: [
          candidates[0].candidateId,
          `cand_${'e'.repeat(64)}`
        ].sort()
      }]
    }),
    (error) => error.code === 'DANGLING_RELATIONSHIP_ENDPOINT'
  );

  const forged = structuredClone(population);
  forged.components[0].candidateIds.push(forged.components[1].candidateIds[0]);
  assert.throws(
    () => validateCandidateReviewPopulation(forged),
    (error) => error.code === 'POPULATION_COMPONENT_SET_MISMATCH'
      || error.code === 'POPULATION_HASH_MISMATCH'
  );
});

test('whole-component quotas are not weakened when individual selection would fit', () => {
  const mediumVoltage = Array.from({ length: 20 }, (_, index) => (
    syntheticCandidate(index, 'medium_voltage_switchgear', { semanticIndex: 0 })
  ));
  const transformers = Array.from({ length: 20 }, (_, index) => (
    syntheticCandidate(100 + index, 'transformer', { semanticIndex: 0 })
  ));
  const components = buildCandidateReviewComponents({
    candidates: [...mediumVoltage, ...transformers]
  });
  assert.deepEqual(components.components.map(({ candidateCount }) => candidateCount), [20, 20]);
  assert.throws(
    () => selectCandidateReviewPopulation({
      candidates: [...mediumVoltage, ...transformers],
      syntheticPrerequisiteBypass: CANDIDATE_REVIEW_SYNTHETIC_PREREQUISITE_BYPASS
    }),
    (error) => error.code === 'NO_FEASIBLE_WHOLE_COMPONENT_POPULATION'
  );
});

test('fidelity prerequisites bind the exact head, active policy, eight rows, and eligible page semantics', () => {
  const validated = validateCandidateReviewPrerequisites(fakePrerequisites());
  assert.equal(validated.evaluatedPrHeadSha, CANDIDATE_REVIEW_FROZEN_HEAD_SHA);
  assert.equal(validated.fidelityRows.length, 8);
  assert.match(validated.prerequisiteHash, /^[a-f0-9]{64}$/);
  assert.deepEqual(validateCandidateReviewPrerequisites(validated), validated);

  const wrongHead = fakePrerequisites();
  wrongHead.evaluatedPrHeadSha = '0'.repeat(40);
  assert.throws(
    () => validateCandidateReviewPrerequisites(wrongHead),
    (error) => error.code === 'PR_HEAD_MISMATCH'
  );
  assert.throws(
    () => validateCandidateReviewPrerequisites(fakePrerequisites({
      expiry: '2026-07-24T23:59:59.000Z'
    })),
    (error) => error.code === 'OWNER_POLICY_EXPIRED'
  );
  const unsafe = fakePrerequisites();
  unsafe.fidelityRows[0].fidelityDecision = 'UNSAFE_FOR_CANDIDATE_REVIEW';
  assert.throws(
    () => validateCandidateReviewPrerequisites(unsafe),
    (error) => error.code === 'UNSAFE_FIDELITY_ROW_HAS_ELIGIBLE_PAGE'
  );

  assert.throws(
    () => selectCandidateReviewPopulation({
      candidateRecords: [{
        candidate: syntheticCandidate(999, 'medium_voltage_switchgear'),
        page: { locator: '%2FUsers%2Freviewer%2Fsource.pdf' }
      }],
      prerequisites: fakePrerequisites()
    }),
    (error) => error.code === 'LOCAL_ABSOLUTE_PATH_REFUSED'
  );
});

test('real-mode population validation replays prerequisites and every Section 5 binding instead of trusting hashes or booleans', () => {
  const fixture = generatedBoundFixture();
  const population = selectCandidateReviewPopulation({
    candidateRecords: fixture.candidateRecords,
    prerequisites: fixture.prerequisites
  });
  assert.equal(population.prerequisiteMode, CANDIDATE_REVIEW_REAL_STRUCTURAL_MODE);
  assert.equal(population.realFidelityPrerequisitesSatisfied, false);
  assert.equal(population.section5BindingsComplete, true);
  assert.equal(population.externalHumanProvenanceVerified, false);
  assert.equal(population.externalCustodyVerified, false);
  assert.deepEqual(population.candidateReviewMethodBlockers, [
    'EXTERNAL_HUMAN_PROVENANCE_AND_CUSTODY_UNVERIFIED'
  ]);
  assert.equal(population.candidateRecords.length, 30);
  assert.deepEqual(validateCandidateReviewPopulation(population), population);

  const legacyAuthorityClaim = structuredClone(population);
  legacyAuthorityClaim.prerequisiteMode = 'FULL_FIDELITY_AND_SECTION5_BINDINGS';
  assert.throws(
    () => validateCandidateReviewPopulation(legacyAuthorityClaim),
    (error) => error.code === 'UNSUPPORTED_PREREQUISITE_MODE'
  );

  const forged = structuredClone(population);
  forged.prerequisites.evaluatedPrHeadSha = '0'.repeat(40);
  forged.prerequisites.prerequisiteHash = sha256(Object.fromEntries(
    Object.entries(forged.prerequisites).filter(([key]) => key !== 'prerequisiteHash')
  ));
  forged.prerequisiteHash = forged.prerequisites.prerequisiteHash;
  forged.candidateRecords.forEach((record) => {
    record.evaluatedPrHeadSha = forged.prerequisites.evaluatedPrHeadSha;
  });
  const candidateRecordCores = forged.candidateRecords.map((record) => Object.fromEntries(
    Object.entries(record).filter(([key]) => !['populationHash', 'roundId'].includes(key))
  ));
  const populationCore = {
    schemaVersion: forged.schemaVersion,
    boundary: forged.boundary,
    productionReady: forged.productionReady,
    productionReviewerWorkflowReady: forged.productionReviewerWorkflowReady,
    repositoryReviewRequired: forged.repositoryReviewRequired,
    automaticVerification: forged.automaticVerification,
    customerUseAllowed: forged.customerUseAllowed,
    proofExecutionApproved: forged.proofExecutionApproved,
    prerequisiteMode: forged.prerequisiteMode,
    prerequisiteHash: forged.prerequisiteHash,
    syntheticPrerequisiteBypass: forged.syntheticPrerequisiteBypass,
    realFidelityPrerequisitesSatisfied: forged.realFidelityPrerequisitesSatisfied,
    section5BindingsComplete: forged.section5BindingsComplete,
    externalHumanProvenanceVerified: forged.externalHumanProvenanceVerified,
    externalCustodyVerified: forged.externalCustodyVerified,
    candidateReviewMethodBlockers: forged.candidateReviewMethodBlockers,
    humanReviewEvidence: false,
    prerequisites: forged.prerequisites,
    candidateCount: forged.candidateCount,
    productFamilyCounts: forged.productFamilyCounts,
    candidates: forged.candidates,
    candidateRecordCores,
    relationshipReport: forged.relationshipReport,
    components: forged.components,
    selectedComponentIds: forged.selectedComponentIds,
    limitationSafetyRequiredCandidateIds: forged.limitationSafetyRequiredCandidateIds
  };
  forged.populationHash = sha256(populationCore);
  forged.roundId = computeCandidateReviewRoundId({
    populationHash: forged.populationHash,
    prerequisiteHash: forged.prerequisiteHash
  });
  forged.candidateRecords.forEach((record) => {
    record.populationHash = forged.populationHash;
    record.roundId = forged.roundId;
  });
  assert.throws(
    () => validateCandidateReviewPopulation(forged),
    (error) => error.code === 'PR_HEAD_MISMATCH'
  );
});

test('real-mode patch suitability refuses anchor mismatch, full-page excerpts, and absent or invalid inner review patches', () => {
  const ordinaryFixture = generatedBoundFixture();
  const ordinaryPopulation = selectCandidateReviewPopulation({
    candidateRecords: ordinaryFixture.candidateRecords,
    prerequisites: ordinaryFixture.prerequisites
  });
  const ordinaryCandidateId = ordinaryPopulation.candidates[0].candidateId;
  const common = {
    population: ordinaryPopulation,
    decisionSetHash: 'a'.repeat(64),
    approvedCandidateIds: [ordinaryCandidateId],
    sourceReopenByCandidateId: { [ordinaryCandidateId]: true },
    baseCommitSha: CANDIDATE_REVIEW_FROZEN_HEAD_SHA,
    registryPath: 'knowledge/claim-registry/generated-binding-test.json'
  };
  assert.throws(
    () => createCandidateReviewPatchSet({
      ...common,
      excerptsByCandidateId: { [ordinaryCandidateId]: 'Mismatched generated excerpt.' }
    }),
    (error) => error.code === 'PATCH_EXCERPT_ANCHOR_HASH_MISMATCH'
  );
  assert.throws(
    () => createCandidateReviewPatchSet({
      ...common,
      excerptsByCandidateId: {
        [ordinaryCandidateId]: ordinaryFixture.excerptsByCandidateId[ordinaryCandidateId]
      }
    }),
    (error) => error.code === 'VALIDATED_REVIEW_PATCHES_REQUIRED_FOR_REAL_SUITABILITY'
  );
  assert.throws(
    () => createCandidateReviewPatchSet({
      ...common,
      excerptsByCandidateId: {
        [ordinaryCandidateId]: ordinaryFixture.excerptsByCandidateId[ordinaryCandidateId]
      },
      validatedReviewPatches: [{}]
    }),
    (error) => error.code === 'UNSUPPORTED_PATCH_SCHEMA'
      || error.code === 'INVALID_REVIEW_PATCH'
  );

  const fullPageFixture = generatedBoundFixture({ fullPageFirst: true });
  const fullPagePopulation = selectCandidateReviewPopulation({
    candidateRecords: fullPageFixture.candidateRecords,
    prerequisites: fullPageFixture.prerequisites
  });
  const fullPageCandidateId = fullPagePopulation.candidateRecords
    .find((record) => (
      record.page.pageCodePointLength
      === record.anchor.endCodePoint - record.anchor.startCodePoint
    )).candidate.candidateId;
  assert.throws(
    () => createCandidateReviewPatchSet({
      population: fullPagePopulation,
      decisionSetHash: 'b'.repeat(64),
      approvedCandidateIds: [fullPageCandidateId],
      excerptsByCandidateId: {
        [fullPageCandidateId]: fullPageFixture.excerptsByCandidateId[fullPageCandidateId]
      },
      sourceReopenByCandidateId: { [fullPageCandidateId]: true },
      baseCommitSha: CANDIDATE_REVIEW_FROZEN_HEAD_SHA,
      registryPath: 'knowledge/claim-registry/generated-binding-test.json'
    }),
    (error) => error.code === 'FULL_PAGE_EXCERPT_REFUSED'
  );
});
