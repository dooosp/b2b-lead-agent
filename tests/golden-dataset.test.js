const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');

const CANDIDATES_PATH = join(
  process.cwd(),
  'knowledge/golden-dataset/datacenter-kr-v0/public-source-candidates.json',
);
const ADJUDICATIONS_PATH = join(
  process.cwd(),
  'knowledge/golden-dataset/datacenter-kr-v0/human-adjudications.json',
);

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function emptyAdjudications(candidates) {
  return {
    schemaVersion: 'pursuit-golden-human-adjudications-v0',
    boundary: 'HUMAN_ADJUDICATIONS_NOT_PRODUCTION_EVIDENCE',
    productionReady: false,
    evaluationAsOf: candidates.evaluationAsOf,
    projectAdjudications: [],
    capabilityAdjudications: [],
    pairAdjudications: [],
    revisionAdjudications: [],
  };
}

async function loadModule() {
  return import(pathToFileURL(join(process.cwd(), 'knowledge/golden-dataset/index.mjs')));
}

test('real Batch 01 adjudications are structurally valid but only partially Golden-ready', async () => {
  const {
    buildGoldenDatasetAuditReport,
    createValidatedGoldenDataset,
  } = await loadModule();
  const dataset = createValidatedGoldenDataset(readJson(CANDIDATES_PATH), readJson(ADJUDICATIONS_PATH));
  const report = buildGoldenDatasetAuditReport(dataset);

  assert.equal(dataset.datasetState, 'PARTIALLY_ADJUDICATED');
  assert.equal(dataset.goldenReady, false);
  assert.equal(dataset.summary.projectCandidateCount, 15);
  assert.equal(dataset.summary.publicSourceDocumentCandidateCount, 37);
  assert.equal(dataset.summary.capabilityClaimCandidateCount, 30);
  assert.equal(dataset.summary.requirementCapabilityPairCandidateCount, 10);
  assert.equal(dataset.summary.productFamilyCount, 2);
  assert.equal(dataset.summary.humanConfirmedProjectCount, 10);
  assert.equal(dataset.summary.humanConfirmedCapabilityClaimCount, 30);
  assert.equal(dataset.summary.humanConfirmedPairCount, 10);
  assert.equal(dataset.summary.revisionLinkCandidateCount, 1);
  assert.equal(dataset.summary.humanConfirmedRevisionLinkCount, 1);
  assert.equal(dataset.summary.humanConfirmedStageCount, 3);
  assert.equal(dataset.summary.pendingProjectCount, 5);
  assert.equal(dataset.summary.pendingCapabilityClaimCount, 0);
  assert.equal(dataset.summary.pendingPairCount, 0);
  assert.equal(dataset.summary.pendingRevisionLinkCount, 0);
  assert.equal(dataset.summary.provisionalLabelLeakage, 0);
  assert.deepEqual(
    dataset.candidates.capabilityClaims
      .filter((claim) => [
        'mv_si_009_power_frequency_withstand_voltage',
        'mv_si_010_lightning_impulse_withstand_voltage',
        'mv_si_011_rated_peak_withstand_current',
        'tr_si_007_climatic_class',
        'tr_si_008_fire_classification',
      ].includes(claim.claimKey))
      .map((claim) => claim.claimKey)
      .sort(),
    [
      'mv_si_009_power_frequency_withstand_voltage',
      'mv_si_010_lightning_impulse_withstand_voltage',
      'mv_si_011_rated_peak_withstand_current',
      'tr_si_007_climatic_class',
      'tr_si_008_fire_classification',
    ],
  );
  assert.ok(dataset.candidates.requirementCapabilityPairs.every((pair) => (
    pair.limitations.some((limitation) => limitation.includes('not a procurement specification'))
  )));
  const revisionDocument = dataset.candidates.documents.find((document) => (
    document.documentKey === 'reference_iec_62271_200_2021'
  ));
  assert.equal(revisionDocument.sourceClass, 'REFERENCE');
  assert.equal(
    revisionDocument.revision.supersedesDocumentKey,
    'reference_iec_62271_200_2011',
  );
  assert.deepEqual(dataset.summary.thresholdGaps, [
    {
      id: 'human_confirmed_stages',
      actual: 3,
      required: 5,
      missing: 2,
      unit: 'count',
    },
    {
      id: 'project_adjudication_coverage',
      actual: 10,
      required: 15,
      missing: 5,
      unit: 'count',
    },
  ]);
  assert.equal(report.documentStatus, 'PURSUIT_GOLDEN_DATASET_AUDIT_PASS');
  assert.equal(report.productionReady, false);
  assert.equal(report.goldenReady, false);
  assert.deepEqual(report.violations, []);
  assert.ok(Object.isFrozen(dataset));
  assert.ok(Object.isFrozen(dataset.candidates.documents[0]));
});

test('candidate normalization derives stable IDs and a stable hash regardless of source ordering', async () => {
  const {
    GoldenDatasetValidationError,
    buildGoldenDatasetAuditReport,
    createValidatedGoldenDataset,
  } = await loadModule();
  const candidates = readJson(CANDIDATES_PATH);
  const adjudications = emptyAdjudications(candidates);
  const first = createValidatedGoldenDataset(candidates, adjudications);
  const reordered = clone(candidates);
  reordered.documents.reverse();
  reordered.projects.reverse();
  reordered.capabilityClaims.reverse();
  reordered.scope.productFamilyIds.reverse();
  const second = createValidatedGoldenDataset(reordered, adjudications);

  assert.equal(second.canonicalSha256, first.canonicalSha256);
  assert.deepEqual(
    second.candidates.documents.map((document) => document.documentId),
    first.candidates.documents.map((document) => document.documentId),
  );
  assert.match(first.candidates.documents[0].documentId, /^doc_[a-f0-9]{64}$/);
  assert.match(first.candidates.projects[0].projectId, /^prj_[a-f0-9]{64}$/);
  assert.match(first.candidates.capabilityClaims[0].capabilityClaimId, /^cap_[a-f0-9]{64}$/);
  assert.throws(
    () => buildGoldenDatasetAuditReport({ ...first }),
    (error) => error instanceof GoldenDatasetValidationError
      && error.code === 'UNVALIDATED_GOLDEN_DATASET_REFUSED',
  );
});

test('candidate namespace rejects human authority and forged canonical IDs', async () => {
  const {
    GoldenDatasetValidationError,
    createValidatedGoldenDataset,
  } = await loadModule();
  const candidates = readJson(CANDIDATES_PATH);
  const adjudications = emptyAdjudications(candidates);

  const authorityLeak = clone(candidates);
  authorityLeak.projects[0].finalPursuitDecision = 'PURSUE';
  assert.throws(
    () => createValidatedGoldenDataset(authorityLeak, adjudications),
    (error) => error instanceof GoldenDatasetValidationError
      && error.code === 'HUMAN_AUTHORITY_FIELD_REFUSED_IN_CANDIDATE_INPUT',
  );

  const forgedId = clone(candidates);
  forgedId.documents[0].documentId = `doc_${'0'.repeat(64)}`;
  assert.throws(
    () => createValidatedGoldenDataset(forgedId, adjudications),
    (error) => error instanceof GoldenDatasetValidationError
      && error.code === 'CANONICAL_ID_MISMATCH',
  );
});

test('source, chronology, revision, and source-span boundaries fail closed', async () => {
  const {
    GoldenDatasetValidationError,
    createValidatedGoldenDataset,
  } = await loadModule();
  const candidates = readJson(CANDIDATES_PATH);
  const adjudications = emptyAdjudications(candidates);

  const credentialUrl = clone(candidates);
  credentialUrl.documents[0].sourceUrl = 'https://user:credential@navercorp.com/source';
  assert.throws(
    () => createValidatedGoldenDataset(credentialUrl, adjudications),
    (error) => error instanceof GoldenDatasetValidationError
      && error.code === 'SOURCE_CREDENTIALS_REFUSED',
  );

  const futureRetrieved = clone(candidates);
  futureRetrieved.documents[0].retrievedAt = '2026-07-27T00:00:00.000Z';
  assert.throws(
    () => createValidatedGoldenDataset(futureRetrieved, adjudications),
    (error) => error instanceof GoldenDatasetValidationError
      && error.code === 'FUTURE_DATE_REFUSED',
  );

  const signedQuery = clone(candidates);
  signedQuery.documents[0].sourceUrl =
    'https://navercorp.com/media/pressReleasesDetail?sig=abcdef123456';
  assert.throws(
    () => createValidatedGoldenDataset(signedQuery, adjudications),
    (error) => error instanceof GoldenDatasetValidationError
      && error.code === 'SIGNED_OR_SECRET_SOURCE_QUERY_REFUSED',
  );

  const danglingRevision = clone(candidates);
  danglingRevision.documents[0].revision.supersedesDocumentKey = 'missing-document';
  assert.throws(
    () => createValidatedGoldenDataset(danglingRevision, adjudications),
    (error) => error instanceof GoldenDatasetValidationError
      && error.code === 'DANGLING_SUPERSESSION_REFERENCE',
  );

  const wrongLocator = clone(candidates);
  wrongLocator.capabilityClaims[0].sourceSpan.locator = 'not the source locator';
  assert.throws(
    () => createValidatedGoldenDataset(wrongLocator, adjudications),
    (error) => error instanceof GoldenDatasetValidationError
      && error.code === 'SOURCE_SPAN_LOCATOR_MISMATCH',
  );

  const referenceAsCapability = clone(candidates);
  referenceAsCapability.capabilityClaims[0].documentKey = 'reference_iec_62271_200_2021';
  assert.throws(
    () => createValidatedGoldenDataset(referenceAsCapability, adjudications),
    (error) => error instanceof GoldenDatasetValidationError
      && error.code === 'CAPABILITY_SOURCE_REQUIRED',
  );
});

test('only explicit HUMAN_DOMAIN_REVIEW records advance dataset state', async () => {
  const {
    GoldenDatasetValidationError,
    createValidatedGoldenDataset,
  } = await loadModule();
  const candidates = readJson(CANDIDATES_PATH);
  const baseAdjudications = emptyAdjudications(candidates);
  const firstProject = candidates.projects[0];

  const aiAdjudication = clone(baseAdjudications);
  aiAdjudication.projectAdjudications.push({
    projectKey: firstProject.projectKey,
    reviewAuthority: 'AI_ASSISTED',
    reviewReceipt: 'review-receipt-001',
    reviewedAt: '2026-07-26T00:30:00.000Z',
  });
  assert.throws(
    () => createValidatedGoldenDataset(candidates, aiAdjudication),
    (error) => error instanceof GoldenDatasetValidationError
      && error.code === 'HUMAN_DOMAIN_REVIEW_REQUIRED',
  );

  const humanAdjudication = clone(baseAdjudications);
  humanAdjudication.projectAdjudications.push({
    projectKey: firstProject.projectKey,
    reviewAuthority: 'HUMAN_DOMAIN_REVIEW',
    reviewReceipt: 'review-receipt-001',
    reviewedAt: '2026-07-26T00:30:00.000Z',
    identityStatus: 'CONFIRMED',
    currentStage: firstProject.stageObservation.stage,
    appliedSpecificationDocumentKeys: [],
    productFitByFamily: [
      {
        productFamilyId: 'medium_voltage_switchgear',
        fitResult: 'INSUFFICIENT_EVIDENCE',
      },
      {
        productFamilyId: 'transformer',
        fitResult: 'INSUFFICIENT_EVIDENCE',
      },
    ],
    blockingEvidence: ['No public project specification has been human-confirmed.'],
    specificationWindow: {
      state: 'UNKNOWN',
      rationale: 'The public project source does not confirm a live procurement window.',
    },
    finalPursuitDecision: 'HOLD',
  });
  const dataset = createValidatedGoldenDataset(candidates, humanAdjudication);
  assert.equal(dataset.datasetState, 'PARTIALLY_ADJUDICATED');
  assert.equal(dataset.goldenReady, false);
  assert.equal(dataset.summary.humanConfirmedProjectCount, 1);
  assert.equal(dataset.summary.pendingProjectCount, 14);
  assert.equal(
    dataset.adjudications.projectAdjudications[0].reviewedAt,
    '2026-07-26T00:30:00.000Z',
  );

  const reviewBeforeEvidenceSnapshot = clone(humanAdjudication);
  reviewBeforeEvidenceSnapshot.projectAdjudications[0].reviewedAt =
    '2026-07-25T23:59:59.999Z';
  assert.throws(
    () => createValidatedGoldenDataset(candidates, reviewBeforeEvidenceSnapshot),
    (error) => error instanceof GoldenDatasetValidationError
      && error.code === 'REVIEW_PRECEDES_EVALUATION_AS_OF',
  );

  const futureDatedReview = clone(humanAdjudication);
  futureDatedReview.projectAdjudications[0].reviewedAt =
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  assert.throws(
    () => createValidatedGoldenDataset(candidates, futureDatedReview),
    (error) => error instanceof GoldenDatasetValidationError
      && error.code === 'FUTURE_REVIEW_TIMESTAMP_REFUSED',
  );
});

test('capability adjudication must bind the exact candidate source span', async () => {
  const {
    GoldenDatasetValidationError,
    createValidatedGoldenDataset,
  } = await loadModule();
  const candidates = readJson(CANDIDATES_PATH);
  const baseAdjudications = emptyAdjudications(candidates);
  const candidateDataset = createValidatedGoldenDataset(candidates, baseAdjudications);
  const claim = candidateDataset.candidates.capabilityClaims[0];
  const adjudications = clone(baseAdjudications);
  adjudications.capabilityAdjudications.push({
    claimKey: claim.claimKey,
    reviewAuthority: 'HUMAN_DOMAIN_REVIEW',
    reviewReceipt: 'review-receipt-capability-001',
    reviewedAt: '2026-07-26T00:00:00.000Z',
    label: 'INSUFFICIENT_EVIDENCE',
    reasonCodes: ['KR_PROJECT_APPLICABILITY_UNCONFIRMED'],
  });
  assert.throws(
    () => createValidatedGoldenDataset(candidates, adjudications),
    (error) => error instanceof GoldenDatasetValidationError
      && error.code === 'ARRAY_REQUIRED',
  );

  adjudications.capabilityAdjudications[0].sourceSpans = [
    `${claim.documentId}#excerpt:${claim.sourceSpan.excerptIndex}`,
  ];
  const partiallyAdjudicated = createValidatedGoldenDataset(candidates, adjudications);
  assert.equal(partiallyAdjudicated.datasetState, 'PARTIALLY_ADJUDICATED');
  assert.equal(partiallyAdjudicated.summary.humanConfirmedCapabilityClaimCount, 1);
});

test('revision candidates count toward readiness only after exact human edge confirmation', async () => {
  const {
    GoldenDatasetValidationError,
    createValidatedGoldenDataset,
  } = await loadModule();
  const candidates = readJson(CANDIDATES_PATH);
  const adjudications = emptyAdjudications(candidates);
  const previousDocument = candidates.documents.find((document) => (
    document.documentKey === 'reference_iec_62271_200_2011'
  ));
  const nextDocument = candidates.documents.find((document) => (
    document.documentKey === 'reference_iec_62271_200_2021'
  ));

  const candidateOnly = createValidatedGoldenDataset(candidates, adjudications);
  assert.equal(candidateOnly.summary.revisionLinkCandidateCount, 1);
  assert.equal(candidateOnly.summary.humanConfirmedRevisionLinkCount, 0);
  assert.ok(candidateOnly.summary.thresholdGaps.some((gap) => (
    gap.id === 'human_confirmed_revision_links'
  )));
  const normalizedNext = candidateOnly.candidates.documents.find((document) => (
    document.documentKey === nextDocument.documentKey
  ));
  const normalizedPrevious = candidateOnly.candidates.documents.find((document) => (
    document.documentKey === previousDocument.documentKey
  ));

  const humanRevision = clone(adjudications);
  humanRevision.revisionAdjudications.push({
    documentKey: normalizedNext.documentKey,
    supersedesDocumentKey: normalizedPrevious.documentKey,
    reviewAuthority: 'HUMAN_DOMAIN_REVIEW',
    reviewReceipt: 'review-receipt-revision-001',
    reviewedAt: '2026-07-26T00:00:00.000Z',
    relationshipStatus: 'CONFIRMED_SUPERSESSION',
    reasonCodes: ['REVISION_EDGE_HUMAN_CONFIRMED'],
    sourceSpans: [
      `${normalizedNext.documentId}#excerpt:0`,
      `${normalizedPrevious.documentId}#excerpt:0`,
    ],
  });
  const confirmed = createValidatedGoldenDataset(candidates, humanRevision);
  assert.equal(confirmed.summary.humanConfirmedRevisionLinkCount, 1);
  assert.equal(confirmed.summary.pendingRevisionLinkCount, 0);
  assert.equal(confirmed.summary.thresholdGaps.some((gap) => (
    gap.id === 'human_confirmed_revision_links'
  )), false);

  const forgedEdge = clone(humanRevision);
  forgedEdge.revisionAdjudications[0].sourceSpans = ['forged-source-span'];
  assert.throws(
    () => createValidatedGoldenDataset(candidates, forgedEdge),
    (error) => error instanceof GoldenDatasetValidationError
      && error.code === 'REVISION_ADJUDICATION_SOURCE_SPANS_MISMATCH',
  );
});

test('superseded project evidence cannot remain a stage or applied-specification source', async () => {
  const {
    GoldenDatasetValidationError,
    createValidatedGoldenDataset,
  } = await loadModule();
  const candidates = readJson(CANDIDATES_PATH);
  const adjudications = emptyAdjudications(candidates);
  const project = candidates.projects.find((item) => item.projectKey === 'equinix_sl2x');
  const previousDocument = candidates.documents.find((document) => (
    document.documentKey === 'project_equinix_sl2x_specs'
  ));
  const nextDocument = clone(previousDocument);
  nextDocument.documentKey = 'project_equinix_sl2x_specs_review_fixture_r2';
  nextDocument.title = 'Equinix SL2x review fixture specification revision';
  nextDocument.revision.revisionKey = 'review-fixture-r2';
  nextDocument.revision.supersedesDocumentKey = previousDocument.documentKey;
  candidates.documents.push(nextDocument);
  project.documentKeys.push(nextDocument.documentKey);

  const staleStage = clone(candidates);
  staleStage.projects.find((item) => item.projectKey === project.projectKey)
    .stageObservation.documentKey = previousDocument.documentKey;
  assert.throws(
    () => createValidatedGoldenDataset(staleStage, adjudications),
    (error) => error instanceof GoldenDatasetValidationError
      && error.code === 'SUPERSEDED_STAGE_DOCUMENT_REFUSED',
  );

  project.stageObservation.documentKey = nextDocument.documentKey;
  const humanProject = clone(adjudications);
  humanProject.projectAdjudications.push({
    projectKey: project.projectKey,
    reviewAuthority: 'HUMAN_DOMAIN_REVIEW',
    reviewReceipt: 'review-receipt-stale-spec-001',
    reviewedAt: '2026-07-26T00:00:00.000Z',
    identityStatus: 'CONFIRMED',
    currentStage: project.stageObservation.stage,
    appliedSpecificationDocumentKeys: [previousDocument.documentKey],
    productFitByFamily: [
      {
        productFamilyId: 'medium_voltage_switchgear',
        fitResult: 'INSUFFICIENT_EVIDENCE',
      },
      {
        productFamilyId: 'transformer',
        fitResult: 'INSUFFICIENT_EVIDENCE',
      },
    ],
    blockingEvidence: ['The selected specification revision is superseded.'],
    specificationWindow: {
      state: 'UNKNOWN',
      rationale: 'No current public procurement window has been confirmed.',
    },
    finalPursuitDecision: 'HOLD',
  });
  assert.throws(
    () => createValidatedGoldenDataset(candidates, humanProject),
    (error) => error instanceof GoldenDatasetValidationError
      && error.code === 'SUPERSEDED_APPLIED_SPECIFICATION_REFUSED',
  );
});

test('requirement-capability pairs bind both source spans before a human label can count', async () => {
  const {
    GoldenDatasetValidationError,
    createValidatedGoldenDataset,
  } = await loadModule();
  const candidates = readJson(CANDIDATES_PATH);
  const adjudications = emptyAdjudications(candidates);
  const project = candidates.projects.find((candidate) => candidate.projectKey === 'equinix_sl2x');
  const projectDocument = candidates.documents.find((document) => (
    document.documentKey === 'project_equinix_sl2x_specs'
  ));
  const capability = candidates.capabilityClaims[0];
  candidates.requirementCapabilityPairs.push({
    pairKey: 'pair_candidate_001',
    projectKey: project.projectKey,
    capabilityClaimKey: capability.claimKey,
    productFamilyId: capability.productFamilyId,
    requirementEvidence: {
      documentKey: projectDocument.documentKey,
      excerptIndex: 0,
      locator: projectDocument.excerpts[0].locator,
      field: 'public_project_requirement_candidate',
      operator: 'EQ',
      value: 'Human confirmation required',
      unit: null,
      conditions: {},
    },
    annotationOrigin: 'AI_ASSISTED',
    limitations: ['No project requirement or product fit has been human-confirmed.'],
  });

  const candidateDataset = createValidatedGoldenDataset(candidates, adjudications);
  assert.equal(candidateDataset.summary.requirementCapabilityPairCandidateCount, 11);
  assert.equal(candidateDataset.summary.humanConfirmedPairCount, 0);
  const normalizedPair = candidateDataset.candidates.requirementCapabilityPairs.find((pair) => (
    pair.pairKey === 'pair_candidate_001'
  ));
  assert.equal(normalizedPair.sourceSpanRefs.length, 2);

  const supersededPairEvidence = clone(candidates);
  const previousRequirementDocument = supersededPairEvidence.documents.find((document) => (
    document.documentKey === projectDocument.documentKey
  ));
  const replacementRequirementDocument = clone(previousRequirementDocument);
  replacementRequirementDocument.documentKey =
    'project_equinix_sl2x_specs_review_fixture_r2';
  replacementRequirementDocument.title =
    'Equinix SL2x review fixture specification revision';
  replacementRequirementDocument.revision.revisionKey = 'review-fixture-r2';
  replacementRequirementDocument.revision.supersedesDocumentKey =
    previousRequirementDocument.documentKey;
  supersededPairEvidence.documents.push(replacementRequirementDocument);
  const supersededPairProject = supersededPairEvidence.projects.find((item) => (
    item.projectKey === project.projectKey
  ));
  supersededPairProject.documentKeys.push(replacementRequirementDocument.documentKey);
  supersededPairProject.stageObservation.documentKey =
    replacementRequirementDocument.documentKey;
  assert.throws(
    () => createValidatedGoldenDataset(supersededPairEvidence, adjudications),
    (error) => error instanceof GoldenDatasetValidationError
      && error.code === 'SUPERSEDED_PAIR_EVIDENCE_REFUSED',
  );

  const wrongDocument = clone(candidates);
  wrongDocument.requirementCapabilityPairs[0].requirementEvidence.documentKey =
    capability.documentKey;
  assert.throws(
    () => createValidatedGoldenDataset(wrongDocument, adjudications),
    (error) => error instanceof GoldenDatasetValidationError
      && error.code === 'PAIR_REQUIREMENT_DOCUMENT_MUST_BELONG_TO_PROJECT',
  );

  const mismatchedHumanSpans = clone(adjudications);
  mismatchedHumanSpans.pairAdjudications.push({
    pairKey: 'pair_candidate_001',
    reviewAuthority: 'HUMAN_DOMAIN_REVIEW',
    reviewReceipt: 'review-receipt-pair-001',
    reviewedAt: '2026-07-26T00:00:00.000Z',
    label: 'INSUFFICIENT_EVIDENCE',
    reasonCodes: ['PROJECT_REQUIREMENT_UNCONFIRMED'],
    sourceSpans: ['forged-source-span'],
  });
  assert.throws(
    () => createValidatedGoldenDataset(candidates, mismatchedHumanSpans),
    (error) => error instanceof GoldenDatasetValidationError
      && error.code === 'PAIR_ADJUDICATION_SOURCE_SPANS_MISMATCH',
  );

  const confirmedHumanPair = clone(mismatchedHumanSpans);
  confirmedHumanPair.pairAdjudications[0].sourceSpans = normalizedPair.sourceSpanRefs;
  const partiallyAdjudicated = createValidatedGoldenDataset(candidates, confirmedHumanPair);
  assert.equal(partiallyAdjudicated.datasetState, 'PARTIALLY_ADJUDICATED');
  assert.equal(partiallyAdjudicated.goldenReady, false);
  assert.equal(partiallyAdjudicated.summary.humanConfirmedPairCount, 1);
});
