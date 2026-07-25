import test from 'node:test';
import assert from 'node:assert/strict';

import { sha256 } from '../knowledge/claim-registry/index.mjs';
import {
  createCandidate,
  formatCandidateStatement
} from '../evidence-claim-workbench/domain/candidates.mjs';
import { normalizeSourceDocumentBundle } from '../evidence-claim-workbench/domain/document-bundle.mjs';
import { createPageEvidenceAnchor } from '../evidence-claim-workbench/domain/evidence-anchor.mjs';
import { createReviewDecision } from '../evidence-claim-workbench/domain/review-decisions.mjs';
import { createReviewPatch } from '../evidence-claim-workbench/domain/review-patch.mjs';
import {
  CANDIDATE_REVIEW_FROZEN_HEAD_SHA,
  CANDIDATE_REVIEW_PREREQUISITE_SCHEMA_VERSION,
  CANDIDATE_REVIEW_REAL_STRUCTURAL_MODE,
  CANDIDATE_REVIEW_SUBMISSION_AUTHORITY_STATUSES,
  CANDIDATE_REVIEW_SYNTHETIC_PREREQUISITE_BYPASS,
  computeCandidateReviewAssignmentHash,
  computeCandidateReviewDecisionSetHash,
  computeCandidateReviewMetrics,
  createBlankCandidateReviewRoleSubmission,
  createCandidateReviewPatchSet,
  reconcileCandidateReviewRound,
  selectCandidateReviewPopulation,
  validateCandidateReviewPatchSet,
  validateCandidateReviewReconciliation,
  validateCandidateReviewRoleSubmission
} from '../evidence-claim-workbench/domain/candidate-review-v2.mjs';
import {
  SYNTHETIC_BENCHMARK_AS_OF,
  createSyntheticDocument
} from '../evidence-claim-workbench/fixtures/synthetic-benchmark-v0.mjs';

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
    ['frequency', 'frequency', 'Hz']
  ],
  transformer: [
    ['transformer_capacity', 'apparent_power', 'kVA'],
    ['primary_voltage', 'voltage', 'kV'],
    ['secondary_voltage', 'voltage', 'V'],
    ['frequency', 'frequency', 'Hz']
  ]
};

function syntheticCandidate(index, family, {
  semanticIndex = index,
  synthetic = true,
  documentId,
  evidenceAnchorId
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
    value: 20 + combination.ordinal,
    unit,
    quantityKind
  };
  return createCandidate({
    schemaVersion: 'evidence-claim-candidate-v0',
    synthetic,
    documentId: documentId ?? `doc_${(index + 1).toString(16).padStart(64, '0')}`,
    evidenceAnchorId: evidenceAnchorId ?? `anc_${(index + 20_001).toString(16).padStart(64, '0')}`,
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

function population30({
  duplicatePair = false,
  limitationCandidateId
} = {}) {
  const candidates = [
    ...Array.from({ length: 15 }, (_, index) => syntheticCandidate(index, 'medium_voltage_switchgear', {
      semanticIndex: duplicatePair && index === 1 ? 0 : index
    })),
    ...Array.from({ length: 15 }, (_, index) => syntheticCandidate(100 + index, 'transformer'))
  ];
  return selectCandidateReviewPopulation({
    candidates,
    syntheticPrerequisiteBypass: CANDIDATE_REVIEW_SYNTHETIC_PREREQUISITE_BYPASS,
    ...(limitationCandidateId ? {
      limitationSafetyRequiredCandidateIds: [limitationCandidateId]
    } : {})
  });
}

function decisionForm(candidate, spec) {
  if (spec.form === 'OUTER') {
    return {
      type: 'OUTER_HOLD_TERMINOLOGY_GAP',
      reasonCode: 'OUTER_V2_TERMINOLOGY_GAP'
    };
  }
  return {
    type: 'INNER_DECISION',
    decision: createReviewDecision({
      candidate,
      decision: spec.decision,
      reasonCodes: spec.reasonCodes,
      relatedCandidateIds: spec.relatedCandidateIds ?? []
    })
  };
}

function completedSubmission(population, role, specificationByCandidateId = {}) {
  const assignmentHash = computeCandidateReviewAssignmentHash({
    roundId: population.roundId,
    populationHash: population.populationHash,
    candidateIds: population.candidates.map(({ candidateId }) => candidateId)
  });
  const blank = createBlankCandidateReviewRoleSubmission({
    roundId: population.roundId,
    populationHash: population.populationHash,
    assignmentHash,
    role
  });
  const submission = structuredClone(blank);
  submission.submissionAuthorityStatus = population.prerequisiteMode
    === CANDIDATE_REVIEW_SYNTHETIC_PREREQUISITE_BYPASS
    ? CANDIDATE_REVIEW_SUBMISSION_AUTHORITY_STATUSES.synthetic
    : CANDIDATE_REVIEW_SUBMISSION_AUTHORITY_STATUSES.structural;
  submission.roleQualificationAttested = true;
  submission.sealed = true;
  submission.rows = population.candidates.map((candidate, index) => {
    const spec = specificationByCandidateId[candidate.candidateId] ?? {
      decision: 'APPROVE_FOR_REPOSITORY_REVIEW',
      reasonCodes: ['EVIDENCE_QUOTE_CONFIRMED', 'STRUCTURED_MEANING_CONFIRMED']
    };
    return {
      candidateId: candidate.candidateId,
      limitationSafetyAcknowledgement: spec.limitationSafetyAcknowledgement
        ?? (population.limitationSafetyRequiredCandidateIds.includes(candidate.candidateId)
          ? 'LIMITATION_DOES_NOT_AFFECT_CANDIDATE'
          : 'NOT_APPLICABLE'),
      decisionForm: decisionForm(candidate, spec),
      reviewDurationSeconds: 30 + index,
      evidenceTraceabilityUsefulness: 4,
      structuredDecisionUsefulness: 4,
      patchAssessmentUsefulness: role === 'PRIMARY_TECHNICAL_REVIEWER' ? null : 4
    };
  });
  return validateCandidateReviewRoleSubmission(submission, { population });
}

function patchSetFor(population, primary, secondary, approvedCandidateIds) {
  const decisionSetHash = computeCandidateReviewDecisionSetHash({
    population,
    primarySubmission: primary,
    secondarySubmission: secondary
  });
  return createCandidateReviewPatchSet({
    population,
    decisionSetHash,
    approvedCandidateIds,
    excerptsByCandidateId: Object.fromEntries(approvedCandidateIds.map((candidateId) => [
      candidateId,
      `Synthetic bounded excerpt ${candidateId.slice(-12)}.`
    ])),
    sourceReopenByCandidateId: Object.fromEntries(approvedCandidateIds.map((candidateId) => [
      candidateId,
      true
    ])),
    baseCommitSha: CANDIDATE_REVIEW_FROZEN_HEAD_SHA,
    registryPath: 'knowledge/claim-registry/candidate-review-v2.json'
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

function anchorFor(document, quote) {
  const page = [...document.pages[0].text];
  const selected = [...quote];
  let startCodePoint = -1;
  for (let index = 0; index <= page.length - selected.length; index += 1) {
    if (page.slice(index, index + selected.length).join('') === quote) {
      startCodePoint = index;
      break;
    }
  }
  assert.ok(startCodePoint >= 0);
  return createPageEvidenceAnchor(document, {
    pageNumber: 1,
    startCodePoint,
    endCodePoint: startCodePoint + selected.length,
    quote
  });
}

function generatedStructuralRoundFixture() {
  const records = [];
  const reviewPatches = [];
  const excerptsByCandidateId = {};
  const documents = [];
  let candidateOrdinal = 0;

  for (const [familyOrdinal, family] of [
    'medium_voltage_switchgear',
    'transformer'
  ].entries()) {
    for (let documentOrdinal = 0; documentOrdinal < 4; documentOrdinal += 1) {
      const semanticIndexes = Array.from({ length: 15 }, (_, index) => index)
        .slice(documentOrdinal * 4, Math.min(15, (documentOrdinal + 1) * 4));
      const quotes = semanticIndexes.map((semanticIndex) => (
        `Bounded evidence ${familyOrdinal + 1}-${semanticIndex + 1}.`
      ));
      const rawDocument = createSyntheticDocument({
        key: `candidate-v2-structural-${familyOrdinal + 1}-${documentOrdinal + 1}`,
        productFamilies: [family],
        pages: [`Generated public context. ${quotes.join(' Separate context. ')} End context.`],
        source: {
          sourceClass: 'OFFICIAL_MANUFACTURER',
          publisher: 'Generated Manufacturer Evidence',
          title: `Generated structural evidence ${familyOrdinal + 1}-${documentOrdinal + 1}`,
          documentNumber: `GENERATED-${familyOrdinal + 1}-${documentOrdinal + 1}`,
          sourceUrl: `https://evidence.example.com/generated/${familyOrdinal + 1}/${documentOrdinal + 1}`,
          authenticityStatus: 'UNREVIEWED',
          redistributionStatus: 'METADATA_AND_BOUNDED_EXCERPTS_ONLY'
        }
      });
      rawDocument.synthetic = false;
      const document = normalizeSourceDocumentBundle(rawDocument, {
        asOf: SYNTHETIC_BENCHMARK_AS_OF
      });
      documents.push(document);

      for (const [quoteIndex, semanticIndex] of semanticIndexes.entries()) {
        const quote = quotes[quoteIndex];
        const anchor = anchorFor(document, quote);
        const candidate = syntheticCandidate(1_000 + candidateOrdinal, family, {
          semanticIndex,
          synthetic: false,
          documentId: document.documentId,
          evidenceAnchorId: anchor.anchorId
        });
        const decision = createReviewDecision({
          candidate,
          decision: 'APPROVE_FOR_REPOSITORY_REVIEW',
          reasonCodes: ['EVIDENCE_QUOTE_CONFIRMED', 'STRUCTURED_MEANING_CONFIRMED']
        });
        reviewPatches.push(createReviewPatch({
          baseCommitSha: CANDIDATE_REVIEW_FROZEN_HEAD_SHA,
          registryPath: 'knowledge/claim-registry/candidate-review-v2-structural.json',
          generatedAt: SYNTHETIC_BENCHMARK_AS_OF,
          documents: [document],
          anchors: [anchor],
          candidates: [candidate],
          decisions: [decision]
        }));
        excerptsByCandidateId[candidate.candidateId] = quote;
        records.push({
          evaluatedPrNumber: 207,
          evaluatedPrHeadSha: CANDIDATE_REVIEW_FROZEN_HEAD_SHA,
          manifestSha256: '1'.repeat(64),
          documentDecisionSha256: '2'.repeat(64),
          fidelityDecisionSha256: '3'.repeat(64),
          candidate,
          candidateSnapshot: candidateSnapshot(candidate),
          productFamily: family,
          claimType: candidate.claimType,
          document: {
            documentId: document.documentId,
            sourceFileSha256: document.file.sha256,
            normalizedContentSha256: document.file.contentSha256,
            documentNumber: document.source.documentNumber,
            revisionSeriesId: document.revision.seriesId,
            revisionId: document.revision.revisionId,
            revisionSequence: document.revision.sequence
          },
          page: {
            namespace: 'NORMALIZED_BUNDLE_PAGE_NUMBER',
            extractedPageOrdinal: anchor.page.extractedPageOrdinal,
            locator: `${anchor.page.locator.type}:${anchor.page.locator.value}`,
            pageTextSha256: anchor.page.textSha256,
            pageCodePointLength: anchor.page.textCodePoints
          },
          anchor: {
            evidenceAnchorId: anchor.anchorId,
            normalizationVersion: anchor.selection.normalizationVersion,
            startCodePoint: anchor.selection.startCodePoint,
            endCodePoint: anchor.selection.endCodePoint,
            quoteSha256: anchor.selection.quoteSha256,
            occurrenceIndex: anchor.selection.occurrenceIndex - 1,
            occurrenceCount: anchor.selection.occurrenceCount,
            contextBeforeSha256: anchor.selection.prefixContextSha256,
            contextAfterSha256: anchor.selection.suffixContextSha256
          },
          relationshipIds: [],
          relatedCandidateIds: []
        });
        candidateOrdinal += 1;
      }
    }
  }

  const prerequisites = {
    schemaVersion: CANDIDATE_REVIEW_PREREQUISITE_SCHEMA_VERSION,
    evaluatedPrNumber: 207,
    evaluatedPrHeadSha: CANDIDATE_REVIEW_FROZEN_HEAD_SHA,
    manifestSha256: '1'.repeat(64),
    documentDecisionSha256: '2'.repeat(64),
    fidelityDecisionSha256: '3'.repeat(64),
    policy: {
      marker: 'PR207_PAGE_REVIEW_RIGHTS_RETENTION_POLICY_V1',
      active: true,
      expiresAt: '2026-08-21T23:59:59.000Z',
      retentionMethod: 'IGNORE_VERIFIED_LOCAL_LEDGER_PLUS_POLICY_BOUNDED_HASH_AGGREGATE'
    },
    evaluationDate: '2026-07-25',
    fidelityRows: documents.map((document) => ({
      documentId: document.documentId,
      documentIdentityCheck: 'MATCH',
      documentNumberCheck: 'MATCH',
      revisionCheck: 'MATCH',
      candidateBearingPagesChecked: [1],
      eligiblePageNumbers: [1],
      fidelityDecision: 'ACCEPTABLE_FOR_CANDIDATE_REVIEW',
      semanticPreservation: {
        value: 'PRESERVED',
        unit: 'PRESERVED',
        operator: 'PRESERVED',
        variant: 'PRESERVED',
        condition: 'PRESERVED',
        footnote: 'PRESERVED',
        locator: 'PRESERVED'
      }
    }))
  };
  const population = selectCandidateReviewPopulation({
    candidateRecords: records,
    prerequisites
  });
  return { excerptsByCandidateId, population, reviewPatches };
}

test('two complete role submissions reconcile to immutable approvals only through a validated patch set', () => {
  const population = population30();
  const primary = completedSubmission(population, 'PRIMARY_TECHNICAL_REVIEWER');
  const secondary = completedSubmission(population, 'SECONDARY_EVIDENCE_REVIEWER');
  const approvedCandidateIds = population.candidates.map(({ candidateId }) => candidateId);
  const patchSet = patchSetFor(population, primary, secondary, approvedCandidateIds);
  const suitability = Object.fromEntries(approvedCandidateIds.map((candidateId) => [
    candidateId,
    'SUITABLE_FOR_REPOSITORY_REVIEW'
  ]));
  const reconciliation = reconcileCandidateReviewRound({
    population,
    primarySubmission: primary,
    secondarySubmission: secondary,
    patchSuitabilityByCandidateId: suitability,
    roleSeparationAttested: true,
    patchSet
  });

  assert.equal(reconciliation.finalOutcomes.length, 30);
  assert.ok(reconciliation.finalOutcomes.every(({ outcome }) => outcome === 'APPROVED'));
  assert.ok(reconciliation.finalOutcomes.every(({ provisionalTechnicalApproval }) => provisionalTechnicalApproval));
  assert.equal(reconciliation.patchSetHash, patchSet.patchSetHash);
  assert.deepEqual(validateCandidateReviewPatchSet(patchSet, { population }), patchSet);
  assert.ok(Object.isFrozen(reconciliation));
  assert.ok(Object.isFrozen(reconciliation.finalOutcomes));

  assert.throws(
    () => reconcileCandidateReviewRound({
      population,
      primarySubmission: primary,
      secondarySubmission: secondary,
      patchSuitabilityByCandidateId: suitability,
      roleSeparationAttested: true
    }),
    (error) => error.code === 'VALIDATED_PATCH_SET_REQUIRED_FOR_SUITABLE_OUTCOME'
  );
});

test('generated structurally non-synthetic-shaped review patches remain contract-only and non-authoritative', () => {
  const fixture = generatedStructuralRoundFixture();
  const { population } = fixture;
  // Generated non-synthetic-shaped rows exercise the contract only; they are
  // never external human provenance or custody evidence.
  assert.equal(population.prerequisiteMode, CANDIDATE_REVIEW_REAL_STRUCTURAL_MODE);
  assert.equal(population.realFidelityPrerequisitesSatisfied, false);
  assert.equal(population.humanReviewEvidence, false);
  assert.equal(population.externalHumanProvenanceVerified, false);
  assert.equal(population.externalCustodyVerified, false);

  const primary = completedSubmission(population, 'PRIMARY_TECHNICAL_REVIEWER');
  const secondary = completedSubmission(population, 'SECONDARY_EVIDENCE_REVIEWER');
  assert.equal(
    primary.submissionAuthorityStatus,
    CANDIDATE_REVIEW_SUBMISSION_AUTHORITY_STATUSES.structural
  );
  assert.equal(primary.externalHumanProvenanceVerified, false);
  assert.equal(primary.externalCustodyVerified, false);

  const approvedCandidateIds = population.candidates.map(({ candidateId }) => candidateId);
  const decisionSetHash = computeCandidateReviewDecisionSetHash({
    population,
    primarySubmission: primary,
    secondarySubmission: secondary
  });
  const patchSet = createCandidateReviewPatchSet({
    population,
    decisionSetHash,
    approvedCandidateIds,
    excerptsByCandidateId: fixture.excerptsByCandidateId,
    sourceReopenByCandidateId: Object.fromEntries(approvedCandidateIds.map((candidateId) => [
      candidateId,
      true
    ])),
    baseCommitSha: CANDIDATE_REVIEW_FROZEN_HEAD_SHA,
    registryPath: 'knowledge/claim-registry/candidate-review-v2-structural.json',
    validatedReviewPatches: fixture.reviewPatches
  });
  assert.ok(patchSet.validatedReviewPatches.every((patch) => (
    patch.sourceDocuments[0].sourceUrl.startsWith('https://evidence.example.com/')
  )));
  const privateSourceForgery = structuredClone(patchSet);
  privateSourceForgery.validatedReviewPatches[0].sourceDocuments[0].sourceUrl
    = 'http://127.0.0.1/private';
  assert.throws(
    () => reconcileCandidateReviewRound({
      population,
      primarySubmission: primary,
      secondarySubmission: secondary,
      patchSuitabilityByCandidateId: Object.fromEntries(approvedCandidateIds.map((candidateId) => [
        candidateId,
        'SUITABLE_FOR_REPOSITORY_REVIEW'
      ])),
      roleSeparationAttested: true,
      patchSet: privateSourceForgery
    }),
    (error) => error.code === 'PRIVATE_SOURCE_URL_REFUSED'
  );

  const reconciliation = reconcileCandidateReviewRound({
    population,
    primarySubmission: primary,
    secondarySubmission: secondary,
    patchSuitabilityByCandidateId: Object.fromEntries(approvedCandidateIds.map((candidateId) => [
      candidateId,
      'SUITABLE_FOR_REPOSITORY_REVIEW'
    ])),
    roleSeparationAttested: true,
    patchSet
  });
  assert.ok(reconciliation.finalOutcomes.every(({ outcome }) => outcome === 'APPROVED'));
  assert.equal(reconciliation.externalHumanProvenanceVerified, false);
  assert.equal(reconciliation.externalCustodyVerified, false);
  assert.deepEqual(reconciliation.candidateReviewMethodBlockers, [
    'EXTERNAL_HUMAN_PROVENANCE_AND_CUSTODY_UNVERIFIED'
  ]);
  assert.deepEqual(validateCandidateReviewReconciliation(reconciliation, {
    population,
    primarySubmission: primary,
    secondarySubmission: secondary
  }), reconciliation);

  const metrics = computeCandidateReviewMetrics({
    population,
    finalOutcomes: reconciliation,
    primarySubmission: primary,
    secondarySubmission: secondary,
    qualityFindingCounts: { p0: 0, p1: 0, synthetic: false }
  });
  assert.equal(metrics.gates.candidateReviewThresholdsPassed, true);
  assert.equal(metrics.gates.candidateReviewMethodGatePassed, false);
  assert.equal(metrics.externalHumanProvenanceVerified, false);
  assert.equal(metrics.externalCustodyVerified, false);
  assert.deepEqual(metrics.candidateReviewMethodBlockers, [
    'EXTERNAL_HUMAN_PROVENANCE_AND_CUSTODY_UNVERIFIED'
  ]);
});

test('ordered reconciliation preserves rejection intersections, holds, conflicts, and limitation acknowledgements', () => {
  const baseCandidates = [
    ...Array.from({ length: 15 }, (_, index) => syntheticCandidate(index, 'medium_voltage_switchgear')),
    ...Array.from({ length: 15 }, (_, index) => syntheticCandidate(100 + index, 'transformer'))
  ];
  const sortedIds = baseCandidates.map(({ candidateId }) => candidateId).sort();
  const limitationCandidateId = sortedIds[4];
  const population = selectCandidateReviewPopulation({
    candidates: baseCandidates,
    syntheticPrerequisiteBypass: CANDIDATE_REVIEW_SYNTHETIC_PREREQUISITE_BYPASS,
    limitationSafetyRequiredCandidateIds: [limitationCandidateId]
  });
  const ids = population.candidates.map(({ candidateId }) => candidateId);
  const primarySpecs = {
    [ids[0]]: {
      decision: 'REJECT',
      reasonCodes: ['MARKETING_LANGUAGE_ONLY', 'NOT_A_CAPABILITY']
    },
    [ids[1]]: {
      decision: 'DEFER_MISSING_CONTEXT',
      reasonCodes: ['UNIT_AMBIGUOUS']
    },
    [ids[2]]: { form: 'OUTER' },
    [ids[3]]: {
      decision: 'REJECT',
      reasonCodes: ['NOT_A_CAPABILITY']
    },
    [ids[4]]: {
      decision: 'APPROVE_FOR_REPOSITORY_REVIEW',
      reasonCodes: ['EVIDENCE_QUOTE_CONFIRMED', 'STRUCTURED_MEANING_CONFIRMED'],
      limitationSafetyAcknowledgement: 'NOT_ATTESTED'
    }
  };
  const secondarySpecs = {
    [ids[0]]: {
      decision: 'REJECT',
      reasonCodes: ['NOT_A_CAPABILITY']
    },
    [ids[1]]: {
      decision: 'DEFER_MISSING_CONTEXT',
      reasonCodes: ['UNIT_AMBIGUOUS']
    },
    [ids[2]]: { form: 'OUTER' },
    [ids[3]]: {
      decision: 'DEFER_MISSING_CONTEXT',
      reasonCodes: ['VALUE_MISSING']
    }
  };
  const primary = completedSubmission(population, 'PRIMARY_TECHNICAL_REVIEWER', primarySpecs);
  const secondary = completedSubmission(population, 'SECONDARY_EVIDENCE_REVIEWER', secondarySpecs);
  const approvedCandidateIds = ids.slice(5);
  const patchSet = patchSetFor(population, primary, secondary, approvedCandidateIds);
  const suitability = Object.fromEntries(ids.map((candidateId, index) => [
    candidateId,
    index >= 5
      ? 'SUITABLE_FOR_REPOSITORY_REVIEW'
      : 'NOT_APPLICABLE_NO_APPROVED_PATCH'
  ]));
  const result = reconcileCandidateReviewRound({
    population,
    primarySubmission: primary,
    secondarySubmission: secondary,
    patchSuitabilityByCandidateId: suitability,
    roleSeparationAttested: true,
    patchSet
  });
  assert.deepEqual(
    result.finalOutcomes.reduce((counts, outcome) => {
      counts[outcome.outcome] += 1;
      return counts;
    }, { APPROVED: 0, REJECTED: 0, HELD: 0, CONFLICTED: 0 }),
    { APPROVED: 25, REJECTED: 1, HELD: 3, CONFLICTED: 1 }
  );
  assert.deepEqual(result.finalOutcomes[0].reasonCodes, ['NOT_A_CAPABILITY']);
  assert.deepEqual(result.finalOutcomes[1].reasonCodes, ['UNIT_AMBIGUOUS']);
  assert.deepEqual(result.finalOutcomes[2].reasonCodes, ['OUTER_V2_TERMINOLOGY_GAP']);
  assert.deepEqual(result.finalOutcomes[3].reasonCodes, ['ROLE_DECISIONS_CONFLICT']);
  assert.deepEqual(result.finalOutcomes[4].reasonCodes, ['LIMITATION_SAFETY_NOT_ATTESTED']);
  assert.equal(result.finalOutcomes[4].provisionalTechnicalApproval, false);
});

test('unresolved relationship closure conflicts the whole component and patch sharding keeps components atomic', () => {
  const population = population30({ duplicatePair: true });
  const duplicateRelationship = population.relationshipReport.relationships.find(({ type }) => (
    type === 'EXACT_DUPLICATE_EVIDENCE'
  ));
  assert.ok(duplicateRelationship);
  const primary = completedSubmission(population, 'PRIMARY_TECHNICAL_REVIEWER');
  const secondary = completedSubmission(population, 'SECONDARY_EVIDENCE_REVIEWER');
  const approvedCandidateIds = population.candidates
    .map(({ candidateId }) => candidateId)
    .filter((candidateId) => !duplicateRelationship.candidateIds.includes(candidateId));
  const patchSet = patchSetFor(population, primary, secondary, approvedCandidateIds);
  const suitability = Object.fromEntries(population.candidates.map(({ candidateId }) => [
    candidateId,
    approvedCandidateIds.includes(candidateId)
      ? 'SUITABLE_FOR_REPOSITORY_REVIEW'
      : 'NOT_APPLICABLE_NO_APPROVED_PATCH'
  ]));
  const result = reconcileCandidateReviewRound({
    population,
    primarySubmission: primary,
    secondarySubmission: secondary,
    patchSuitabilityByCandidateId: suitability,
    relationshipReport: population.relationshipReport,
    roleSeparationAttested: true,
    patchSet
  });
  const duplicateOutcomes = result.finalOutcomes.filter(({ candidateId }) => (
    duplicateRelationship.candidateIds.includes(candidateId)
  ));
  assert.equal(duplicateOutcomes.length, 2);
  assert.ok(duplicateOutcomes.every(({ outcome }) => outcome === 'CONFLICTED'));
  assert.ok(duplicateOutcomes.every(({ reasonCodes }) => (
    reasonCodes.includes('RELATIONSHIP_CLOSURE_UNRESOLVED')
  )));
  assert.ok(result.relationshipClosureReport.closures.some(({ status }) => status === 'UNRESOLVED'));

  const atomicComponentPatchSet = patchSetFor(
    population,
    primary,
    secondary,
    [duplicateRelationship.candidateIds[0]]
  );
  const forged = structuredClone(atomicComponentPatchSet);
  const owningShard = forged.shards.find(({ candidateIds }) => (
    candidateIds.includes(duplicateRelationship.candidateIds[0])
  ));
  owningShard.candidateIds = owningShard.candidateIds.filter((candidateId) => (
    candidateId !== duplicateRelationship.candidateIds[1]
  ));
  assert.throws(
    () => validateCandidateReviewPatchSet(forged, { population }),
    (error) => error.code === 'PATCH_SHARD_SPLITS_RELATIONSHIP_COMPONENT'
  );
});

test('all 2N rows, exact roles, fixed schemas, and no identity/free text are required before any outcome', () => {
  const population = population30();
  const primary = completedSubmission(population, 'PRIMARY_TECHNICAL_REVIEWER');
  const secondary = completedSubmission(population, 'SECONDARY_EVIDENCE_REVIEWER');
  const incomplete = structuredClone(primary);
  incomplete.rows.pop();
  incomplete.submissionHash = null;
  assert.throws(
    () => reconcileCandidateReviewRound({
      population,
      primarySubmission: incomplete,
      secondarySubmission: secondary,
      patchSuitabilityByCandidateId: Object.fromEntries(population.candidates.map(({ candidateId }) => [
        candidateId,
        'NOT_APPLICABLE_NO_APPROVED_PATCH'
      ])),
      roleSeparationAttested: true
    }),
    (error) => error.code === 'EXACT_ROLE_ROW_COUNT_REQUIRED'
  );

  const identity = structuredClone(primary);
  identity.reviewerEmail = 'person@example.test';
  assert.throws(
    () => validateCandidateReviewRoleSubmission(identity, { population }),
    (error) => error.code === 'PROTECTED_FIELD_REFUSED'
      || error.code === 'IDENTITY_OR_PRIVATE_TEXT_REFUSED'
  );

  const forgedExternalAuthority = structuredClone(primary);
  forgedExternalAuthority.externalHumanProvenanceVerified = true;
  forgedExternalAuthority.externalCustodyVerified = true;
  forgedExternalAuthority.submissionHash = null;
  assert.throws(
    () => validateCandidateReviewRoleSubmission(forgedExternalAuthority, { population }),
    (error) => error.code === 'EXTERNAL_SUBMISSION_AUTHORITY_CLAIM_REFUSED'
  );

  const completedWithPendingAuthority = structuredClone(primary);
  completedWithPendingAuthority.submissionAuthorityStatus
    = CANDIDATE_REVIEW_SUBMISSION_AUTHORITY_STATUSES.pending;
  completedWithPendingAuthority.submissionHash = null;
  assert.throws(
    () => validateCandidateReviewRoleSubmission(completedWithPendingAuthority, { population }),
    (error) => error.code === 'EXTERNAL_SUBMISSION_AUTHORITY_CLAIM_REFUSED'
  );

  const blank = createBlankCandidateReviewRoleSubmission({
    roundId: population.roundId,
    populationHash: population.populationHash,
    assignmentHash: primary.assignmentHash,
    role: 'PRIMARY_TECHNICAL_REVIEWER'
  });
  assert.equal(
    blank.submissionAuthorityStatus,
    CANDIDATE_REVIEW_SUBMISSION_AUTHORITY_STATUSES.pending
  );
  assert.equal(blank.externalHumanProvenanceVerified, false);
  assert.equal(blank.externalCustodyVerified, false);
  assert.deepEqual(
    validateCandidateReviewRoleSubmission(blank, { population, allowBlank: true }),
    blank
  );
  assert.throws(
    () => validateCandidateReviewRoleSubmission(blank, { population }),
    (error) => error.code === 'INCOMPLETE_ROLE_SUBMISSION'
  );
});

test('encoded local paths, identities, and secret-shaped patch content are refused before hashing', () => {
  const population = population30();
  const primary = completedSubmission(population, 'PRIMARY_TECHNICAL_REVIEWER');
  const secondary = completedSubmission(population, 'SECONDARY_EVIDENCE_REVIEWER');
  const candidateId = population.candidates[0].candidateId;
  const decisionSetHash = computeCandidateReviewDecisionSetHash({
    population,
    primarySubmission: primary,
    secondarySubmission: secondary
  });
  const cases = [
    ['%2FUsers%2Foperator%2Fprivate.txt', 'LOCAL_ABSOLUTE_PATH_REFUSED'],
    ['person%40example.test', 'IDENTITY_OR_PRIVATE_TEXT_REFUSED'],
    [`sk%2D${'a'.repeat(24)}`, 'SECRET_SHAPED_VALUE_REFUSED']
  ];
  for (const [excerpt, expectedCode] of cases) {
    assert.throws(
      () => createCandidateReviewPatchSet({
        population,
        decisionSetHash,
        approvedCandidateIds: [candidateId],
        excerptsByCandidateId: { [candidateId]: excerpt },
        sourceReopenByCandidateId: { [candidateId]: true },
        baseCommitSha: CANDIDATE_REVIEW_FROZEN_HEAD_SHA,
        registryPath: 'knowledge/claim-registry/candidate-review-v2.json'
      }),
      (error) => error.code === expectedCode,
      expectedCode
    );
  }
});
