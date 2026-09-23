import test from 'node:test';
import assert from 'node:assert/strict';

import { sha256 } from '../knowledge/claim-registry/index.mjs';
import { createCandidate, extractDeterministicCandidates } from '../evidence-claim-workbench/domain/candidates.mjs';
import { SOURCE_DOCUMENT_BUNDLE_SCHEMA_VERSION } from '../evidence-claim-workbench/domain/constants.mjs';
import {
  computeSourceDocumentId,
  createSourceDocumentCatalog,
  normalizeSourceDocumentBundle
} from '../evidence-claim-workbench/domain/document-bundle.mjs';
import {
  computePageEvidenceAnchorId,
  createPageEvidenceAnchor
} from '../evidence-claim-workbench/domain/evidence-anchor.mjs';
import { createReviewDecision } from '../evidence-claim-workbench/domain/review-decisions.mjs';
import {
  createReviewPatch,
  serializeReviewPatch,
  validateReviewPatch
} from '../evidence-claim-workbench/domain/review-patch.mjs';
import { analyzeCandidateRelationships } from '../evidence-claim-workbench/domain/relationships.mjs';
import {
  SYNTHETIC_BENCHMARK_AS_OF,
  createSyntheticBenchmarkFixture,
  createSyntheticDocument
} from '../evidence-claim-workbench/fixtures/synthetic-benchmark-v0.mjs';

const BASE_SHA = '9d144fbe6309ce363f9dad8d50ffa713d24af683';
const REGISTRY_PATH = 'knowledge/claim-registry/synthetic/datacenter-claims-v1.json';

function documentFor(key, text, productFamilies = ['medium_voltage_switchgear']) {
  return normalizeSourceDocumentBundle(createSyntheticDocument({ key, pages: [text], productFamilies }), {
    asOf: SYNTHETIC_BENCHMARK_AS_OF
  });
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

function approvedFixture(key = 'patch-basic') {
  const document = documentFor(key, 'Synthetic context before. Rated voltage: 24 kV. Synthetic context after.');
  const anchor = anchorFor(document, 'Rated voltage: 24 kV.');
  const candidate = extractDeterministicCandidates({ document, anchors: [anchor] })[0];
  const decision = createReviewDecision({
    candidate,
    decision: 'APPROVE_FOR_REPOSITORY_REVIEW',
    reasonCodes: ['EVIDENCE_QUOTE_CONFIRMED', 'STRUCTURED_MEANING_CONFIRMED']
  });
  return { document, anchor, candidate, decision };
}

function createBasicPatch(fixture = approvedFixture()) {
  return createReviewPatch({
    baseCommitSha: BASE_SHA,
    registryPath: REGISTRY_PATH,
    generatedAt: SYNTHETIC_BENCHMARK_AS_OF,
    documents: [fixture.document],
    anchors: [fixture.anchor],
    candidates: [fixture.candidate],
    decisions: [fixture.decision]
  });
}

function recomputePatchId(patch) {
  const clone = structuredClone(patch);
  delete clone.patchId;
  patch.patchId = `patch_${sha256(clone)}`;
  return patch;
}

function recomputeProjectedSourceDocumentId(document) {
  document.documentId = computeSourceDocumentId({
    schemaVersion: SOURCE_DOCUMENT_BUNDLE_SCHEMA_VERSION,
    synthetic: document.synthetic,
    source: {
      sourceClass: document.sourceClass,
      publisher: document.publisher,
      title: document.title,
      documentNumber: document.documentNumber,
      sourceUrl: document.sourceUrl,
      documentType: document.documentType,
      mimeType: document.mimeType,
      language: document.language,
      vertical: 'datacenter',
      jurisdiction: document.jurisdiction,
      domain: document.domain,
      productFamilies: document.productFamilies,
      authenticityStatus: document.authenticityStatus,
      redistributionStatus: document.redistributionStatus
    },
    revision: document.revision,
    file: {
      sha256: document.documentSha256,
      byteLength: document.documentByteLength,
      contentSha256: document.normalizedContentSha256
    }
  });
  return document;
}

function rechainSingleApprovedAnchor(patch) {
  const anchor = patch.evidenceAnchors[0];
  anchor.evidenceAnchorId = computePageEvidenceAnchorId({
    schemaVersion: 'page-evidence-anchor-v0',
    documentId: anchor.documentId,
    documentNumber: anchor.documentNumber,
    sourceFileSha256: anchor.documentSha256,
    revision: anchor.revision,
    page: {
      extractedPageOrdinal: anchor.extractedPageOrdinal,
      locator: anchor.pageLocator,
      textSha256: anchor.pageTextSha256,
      textCodePoints: anchor.pageCodePointLength
    },
    selection: {
      normalizationVersion: anchor.selection.normalizationVersion,
      startCodePoint: anchor.selection.startCodePoint,
      endCodePoint: anchor.selection.endCodePoint,
      quote: anchor.selection.directQuote,
      quoteSha256: anchor.selection.quoteSha256,
      occurrenceIndex: anchor.selection.occurrenceIndex,
      occurrenceCount: anchor.selection.occurrenceCount,
      prefixContextCodePoints: anchor.selection.prefixContextCodePoints,
      prefixContextSha256: anchor.selection.prefixContextSha256,
      suffixContextCodePoints: anchor.selection.suffixContextCodePoints,
      suffixContextSha256: anchor.selection.suffixContextSha256
    }
  });
  const record = patch.approvedCandidates[0];
  const candidateInput = structuredClone(record.candidate);
  delete candidateInput.candidateId;
  candidateInput.evidenceAnchorId = anchor.evidenceAnchorId;
  const candidate = createCandidate(candidateInput);
  const decision = createReviewDecision({
    candidate,
    decision: record.decision.decision,
    reasonCodes: record.decision.reasonCodes
  });
  record.candidate = candidate;
  record.decision = {
    decisionId: decision.decisionId,
    decision: decision.decision,
    reasonCodes: decision.reasonCodes,
    acknowledgements: decision.acknowledgements
  };
  patch.sourceFileSuggestions[0].candidateId = candidate.candidateId;
  patch.sourceFileSuggestions[0].sourceField = `claims.workbench_${candidate.candidateId.slice(5, 29)}`;
  return recomputePatchId(patch);
}

test('review patch is deterministic, base-pinned, bounded, thin, and non-authoritative', () => {
  const fixture = approvedFixture();
  const first = createBasicPatch(fixture);
  const second = createBasicPatch(fixture);
  assert.deepEqual(first, second);
  assert.equal(validateReviewPatch(first).patchId, first.patchId);
  assert.equal(first.base.commitSha, BASE_SHA);
  assert.equal(first.base.registryPath, REGISTRY_PATH);
  assert.equal(first.boundary, 'NOT_PRODUCTION_EVIDENCE');
  assert.equal(first.productionReady, false);
  assert.equal(first.productionReviewerWorkflowReady, false);
  assert.equal(first.issue165Status, 'HOLD');
  assert.equal(first.repositoryReviewRequired, true);
  assert.equal(first.automaticVerification, false);
  assert.equal(first.customerUseAllowed, false);
  assert.equal(first.proofExecutionApproved, false);
  assert.equal(first.reviewerIdentity, 'NOT_COLLECTED');
  assert.equal(first.sourceDocuments[0].documentNumber, fixture.document.source.documentNumber);
  assert.equal(first.sourceDocuments[0].revision.revisionId, fixture.document.revision.revisionId);
  assert.equal(first.sourceDocuments[0].documentType, 'NORMALIZED_PAGE_TEXT_JSON');
  assert.equal(first.sourceDocuments[0].redistributionStatus, 'SYNTHETIC_FIXTURE_REDISTRIBUTION_PERMITTED');
  assert.equal(first.sourceDocuments[0].normalizedContentSha256, fixture.document.file.contentSha256);
  assert.deepEqual(first.evidenceAnchors[0].pageLocator, fixture.anchor.page.locator);
  const serialized = serializeReviewPatch(first);
  assert.equal(serialized, serializeReviewPatch(second));
  assert.ok(Buffer.byteLength(serialized, 'utf8') < 256_000);
  assert.doesNotMatch(serialized, /Synthetic context before|Synthetic context after/);
  assert.doesNotMatch(serialized, /"pages"|"pageText"|"sourceBinary"|\/Users\//);
  assert.doesNotMatch(serialized, /\b(?:VERIFIED|ALLOWED)\b/);
});

test('full-page quote, future evidence, absolute paths, private identity, page text, and decision forgery fail closed', () => {
  const fullPageDocument = documentFor('patch-full-page', 'Rated voltage: 24 kV.');
  const fullPageAnchor = anchorFor(fullPageDocument, fullPageDocument.pages[0].text);
  const fullPageCandidate = extractDeterministicCandidates({ document: fullPageDocument, anchors: [fullPageAnchor] })[0];
  const fullPageDecision = createReviewDecision({
    candidate: fullPageCandidate,
    decision: 'APPROVE_FOR_REPOSITORY_REVIEW',
    reasonCodes: ['EVIDENCE_QUOTE_CONFIRMED', 'STRUCTURED_MEANING_CONFIRMED']
  });
  assert.throws(
    () => createReviewPatch({
      baseCommitSha: BASE_SHA,
      registryPath: REGISTRY_PATH,
      generatedAt: SYNTHETIC_BENCHMARK_AS_OF,
      documents: [fullPageDocument], anchors: [fullPageAnchor], candidates: [fullPageCandidate], decisions: [fullPageDecision]
    }),
    (error) => error.code === 'FULL_PAGE_EXCERPT_REFUSED' && error.path === '$.anchors[0]'
  );

  const fixture = approvedFixture('patch-future-guard');
  const syntheticMismatchInput = structuredClone(fixture.candidate);
  delete syntheticMismatchInput.candidateId;
  syntheticMismatchInput.synthetic = false;
  const syntheticMismatch = createCandidate(syntheticMismatchInput);
  const syntheticMismatchDecision = createReviewDecision({
    candidate: syntheticMismatch,
    decision: 'APPROVE_FOR_REPOSITORY_REVIEW',
    reasonCodes: ['EVIDENCE_QUOTE_CONFIRMED', 'STRUCTURED_MEANING_CONFIRMED']
  });
  assert.throws(
    () => createReviewPatch({
      baseCommitSha: BASE_SHA, registryPath: REGISTRY_PATH, generatedAt: SYNTHETIC_BENCHMARK_AS_OF,
      documents: [fixture.document], anchors: [fixture.anchor], candidates: [syntheticMismatch], decisions: [syntheticMismatchDecision]
    }),
    (error) => error.code === 'CANDIDATE_SOURCE_SYNTHETIC_MISMATCH'
  );

  const familyMismatchInput = structuredClone(fixture.candidate);
  delete familyMismatchInput.candidateId;
  familyMismatchInput.subject = { type: 'PRODUCT_FAMILY', id: 'transformer', displayName: 'Transformer' };
  familyMismatchInput.statement = 'Transformer 공식 문서 검토 후보: transformer_capacity = 2 MVA.';
  familyMismatchInput.value = { type: 'QUANTITY', key: 'transformer_capacity', value: 2, unit: 'MVA', quantityKind: 'apparent_power' };
  familyMismatchInput.applicability.productFamily = 'transformer';
  const familyMismatch = createCandidate(familyMismatchInput);
  const familyMismatchDecision = createReviewDecision({
    candidate: familyMismatch,
    decision: 'APPROVE_FOR_REPOSITORY_REVIEW',
    reasonCodes: ['EVIDENCE_QUOTE_CONFIRMED', 'STRUCTURED_MEANING_CONFIRMED']
  });
  assert.throws(
    () => createReviewPatch({
      baseCommitSha: BASE_SHA, registryPath: REGISTRY_PATH, generatedAt: SYNTHETIC_BENCHMARK_AS_OF,
      documents: [fixture.document], anchors: [fixture.anchor], candidates: [familyMismatch], decisions: [familyMismatchDecision]
    }),
    (error) => error.code === 'CANDIDATE_SOURCE_PRODUCT_FAMILY_MISMATCH'
  );

  const authorityCandidate = structuredClone(fixture.candidate);
  delete authorityCandidate.candidateId;
  authorityCandidate.statement = 'Medium-voltage Switchgear is VeRiFiEd and customer use ALLOWED.';
  assert.throws(
    () => createReviewPatch({
      baseCommitSha: BASE_SHA,
      registryPath: REGISTRY_PATH,
      generatedAt: SYNTHETIC_BENCHMARK_AS_OF,
      documents: [fixture.document], anchors: [fixture.anchor], candidates: [authorityCandidate], decisions: [fixture.decision]
    }),
    (error) => error.code === 'AUTHORITY_VALUE_REFUSED'
  );
  const expiredCandidateInput = structuredClone(fixture.candidate);
  delete expiredCandidateInput.candidateId;
  expiredCandidateInput.validity = { type: 'VALID_UNTIL', validUntil: '2025-01-01T00:00:00.000Z' };
  const expiredCandidate = createCandidate(expiredCandidateInput);
  const expiredDecision = createReviewDecision({
    candidate: expiredCandidate,
    decision: 'APPROVE_FOR_REPOSITORY_REVIEW',
    reasonCodes: ['EVIDENCE_QUOTE_CONFIRMED', 'STRUCTURED_MEANING_CONFIRMED']
  });
  assert.throws(
    () => createReviewPatch({
      baseCommitSha: BASE_SHA, registryPath: REGISTRY_PATH, generatedAt: SYNTHETIC_BENCHMARK_AS_OF,
      documents: [fixture.document], anchors: [fixture.anchor], candidates: [expiredCandidate], decisions: [expiredDecision]
    }),
    (error) => error.code === 'APPROVED_CANDIDATE_EXPIRED'
  );
  assert.throws(
    () => createReviewPatch({
      baseCommitSha: BASE_SHA,
      registryPath: REGISTRY_PATH,
      generatedAt: '2025-12-01T00:00:00.000Z',
      documents: [fixture.document], anchors: [fixture.anchor], candidates: [fixture.candidate], decisions: [fixture.decision]
    }),
    (error) => error.code === 'FUTURE_DOCUMENT_DATE'
  );

  const patch = createBasicPatch(fixture);
  const mutations = [
    [(draft) => { draft.sourceDocuments[0].title = 'Changed synthetic title'; }, 'DOCUMENT_ID_MISMATCH'],
    [(draft) => {
      draft.evidenceAnchors[0].selection.directQuote = 'Rated voltage: 36 kV.';
      draft.evidenceAnchors[0].selection.quoteSha256 = sha256('Rated voltage: 36 kV.');
    }, 'ANCHOR_ID_MISMATCH'],
    [(draft) => { draft.evidenceAnchors[0].pageTextSha256 = '0'.repeat(64); }, 'ANCHOR_ID_MISMATCH'],
    [(draft) => { draft.evidenceAnchors[0].selection.prefixContextSha256 = '0'.repeat(64); }, 'ANCHOR_ID_MISMATCH'],
    [(draft) => { draft.sourceDocuments[0].title = '/Users/example/private/document.pdf'; }, 'LOCAL_ABSOLUTE_PATH_REFUSED'],
    [(draft) => { draft.sourceDocuments[0].title = '/root/private/document.pdf'; }, 'LOCAL_ABSOLUTE_PATH_REFUSED'],
    [(draft) => { draft.sourceDocuments[0].title = '/opt/private/document.pdf'; }, 'LOCAL_ABSOLUTE_PATH_REFUSED'],
    [(draft) => { draft.sourceDocuments[0].title = '/Volumes/private/document.pdf'; }, 'LOCAL_ABSOLUTE_PATH_REFUSED'],
    [(draft) => { draft.sourceDocuments[0].title = 'C:\\Users\\example\\private\\document.pdf'; }, 'LOCAL_ABSOLUTE_PATH_REFUSED'],
    [(draft) => { draft.sourceDocuments[0].title = '\\\\server\\share\\private\\document.pdf'; }, 'LOCAL_ABSOLUTE_PATH_REFUSED'],
    [(draft) => { draft.sourceDocuments[0].title = '%2FUsers%2Fexample%2Fprivate%2Fdocument.pdf'; }, 'LOCAL_ABSOLUTE_PATH_REFUSED'],
    [(draft) => { draft.sourceDocuments[0].title = '%5C%5Cserver%5Cshare%5Cprivate%5Cdocument.pdf'; }, 'LOCAL_ABSOLUTE_PATH_REFUSED'],
    [(draft) => { draft.sourceDocuments[0].title = '%252Froot%252Fprivate%252Fdocument.pdf'; }, 'LOCAL_ABSOLUTE_PATH_REFUSED'],
    [(draft) => { draft.sourceDocuments[0].title = 'file:///root/private/document.pdf'; }, 'LOCAL_ABSOLUTE_PATH_REFUSED'],
    [(draft) => { draft.sourceDocuments[0].title = 'see:/Users/example/private/document.pdf'; }, 'LOCAL_ABSOLUTE_PATH_REFUSED'],
    [(draft) => { draft.sourceDocuments[0].title = String.raw`[\\server\share\private.pdf`; }, 'LOCAL_ABSOLUTE_PATH_REFUSED'],
    [(draft) => { draft.sourceDocuments[0].sourceUrl = 'https://synthetic.example/reviewer%40example.com'; }, 'IDENTITY_OR_PRIVATE_TEXT_REFUSED'],
    [(draft) => { draft.sourceDocuments[0].sourceUrl = 'https://synthetic.example/reviewer%2540example.com'; }, 'IDENTITY_OR_PRIVATE_TEXT_REFUSED'],
    [(draft) => { draft.sourceDocuments[0].title = 'reviewer＠example.com'; }, 'IDENTITY_OR_PRIVATE_TEXT_REFUSED'],
    [(draft) => { draft.sourceDocuments[0].title = '담당자 010-0000-0000'; }, 'IDENTITY_OR_PRIVATE_TEXT_REFUSED'],
    [(draft) => { draft.evidenceAnchors[0].pageText = 'full source page'; }, 'PROTECTED_PATCH_FIELD_REFUSED'],
    [(draft) => { draft.reviewerIdentity = 'named-reviewer'; }, 'PATCH_BOUNDARY_INVALID'],
    [(draft) => { draft.approvedCandidates[0].decision.decisionId = `dec_${'0'.repeat(64)}`; }, 'NONCANONICAL_APPROVAL_DECISION'],
    [(draft) => { draft.approvedCandidates[0].candidate.documentId = `doc_${'0'.repeat(64)}`; }, 'CANDIDATE_ID_MISMATCH'],
    [(draft) => { draft.sourceFileSuggestions = []; draft.metrics.sourceFileSuggestionCount = 0; }, 'SOURCE_SUGGESTION_SET_MISMATCH'],
    [(draft) => { draft.automaticVerification = true; }, 'PATCH_BOUNDARY_INVALID'],
    [(draft) => { draft.customerUseAllowed = true; }, 'PATCH_BOUNDARY_INVALID']
  ];
  for (const [mutate, code] of mutations) {
    const forged = structuredClone(patch);
    mutate(forged);
    recomputePatchId(forged);
    assert.throws(() => validateReviewPatch(forged), (error) => error.code === code, code);
  }

  const extraPatch = createBasicPatch(approvedFixture('patch-unreferenced-extra'));
  const unreferenced = structuredClone(patch);
  unreferenced.sourceDocuments.push(extraPatch.sourceDocuments[0]);
  unreferenced.sourceDocuments.sort((left, right) => left.documentId.localeCompare(right.documentId));
  unreferenced.evidenceAnchors.push(extraPatch.evidenceAnchors[0]);
  unreferenced.evidenceAnchors.sort((left, right) => left.evidenceAnchorId.localeCompare(right.evidenceAnchorId));
  unreferenced.metrics.sourceDocumentCount += 1;
  unreferenced.metrics.evidenceAnchorCount += 1;
  unreferenced.metrics.aggregateQuoteCodePoints += [...extraPatch.evidenceAnchors[0].selection.directQuote].length;
  recomputePatchId(unreferenced);
  assert.throws(
    () => validateReviewPatch(unreferenced),
    (error) => error.code === 'PATCH_DOCUMENT_CLOSURE_MISMATCH'
  );
});

test('self-consistent but structurally impossible projected anchors fail before candidate import', () => {
  const cases = [
    [(anchor) => {
      anchor.selection.startCodePoint = -1;
      anchor.selection.endCodePoint = 20;
      anchor.selection.prefixContextCodePoints = 0;
    }, 'INVALID_QUOTE_SELECTION'],
    [(anchor) => { anchor.extractedPageOrdinal = 0; }, 'INVALID_PAGE_ORDINAL'],
    [(anchor) => { anchor.pageLocator.value = ''; }, 'INVALID_PAGE_LOCATOR'],
    [(anchor) => {
      anchor.selection.startCodePoint = 0;
      anchor.selection.endCodePoint = 21;
      anchor.selection.prefixContextCodePoints = 64;
    }, 'INVALID_CONTEXT_LENGTH'],
    [(anchor) => { anchor.pageLocator.value = '999'; }, 'PAGE_LOCATOR_ORDINAL_MISMATCH'],
    [(anchor) => {
      anchor.selection.suffixContextCodePoints = 0;
      anchor.selection.suffixContextSha256 = sha256('');
    }, 'INVALID_CONTEXT_LENGTH'],
    [(anchor) => { anchor.pageCodePointLength = anchor.selection.endCodePoint - 1; }, 'INVALID_QUOTE_SELECTION']
  ];
  for (const [mutate, expectedCode] of cases) {
    const forged = structuredClone(createBasicPatch());
    mutate(forged.evidenceAnchors[0]);
    rechainSingleApprovedAnchor(forged);
    assert.throws(() => validateReviewPatch(forged), (error) => error.code === expectedCode, expectedCode);
  }
});

test('imported approved records require an exact canonical approval decision', () => {
  const patch = createBasicPatch();
  const rejected = structuredClone(patch);
  const rejectedDecision = createReviewDecision({
    candidate: rejected.approvedCandidates[0].candidate,
    decision: 'REJECT',
    reasonCodes: ['NOT_A_CAPABILITY']
  });
  rejected.approvedCandidates[0].decision = {
    decisionId: rejectedDecision.decisionId,
    decision: rejectedDecision.decision,
    reasonCodes: rejectedDecision.reasonCodes,
    acknowledgements: rejectedDecision.acknowledgements
  };
  recomputePatchId(rejected);
  assert.throws(
    () => validateReviewPatch(rejected),
    (error) => error.code === 'APPROVED_RECORD_DECISION_INVALID'
  );

  for (const reasonCode of [
    'CONFLICTING_DOCUMENT',
    'SOURCE_AUTHENTICITY_UNCLEAR',
    'COPYRIGHT_OR_USE_RESTRICTED',
    'SUPERSEDED_DOCUMENT'
  ]) {
    const incompatible = structuredClone(patch);
    incompatible.approvedCandidates[0].decision.reasonCodes = [reasonCode];
    recomputePatchId(incompatible);
    assert.throws(
      () => validateReviewPatch(incompatible),
      (error) => error.code === 'REASON_DECISION_INCOMPATIBLE',
      reasonCode
    );
  }

  for (const reasonCodes of [
    ['STRUCTURED_MEANING_CONFIRMED', 'EVIDENCE_QUOTE_CONFIRMED'],
    ['EVIDENCE_QUOTE_CONFIRMED', 'EVIDENCE_QUOTE_CONFIRMED', 'STRUCTURED_MEANING_CONFIRMED']
  ]) {
    const noncanonical = structuredClone(patch);
    noncanonical.approvedCandidates[0].decision.reasonCodes = reasonCodes;
    recomputePatchId(noncanonical);
    assert.throws(
      () => validateReviewPatch(noncanonical),
      (error) => error.code === 'NONCANONICAL_APPROVAL_DECISION'
    );
  }

  const missingCandidateId = structuredClone(patch);
  delete missingCandidateId.approvedCandidates[0].candidate.candidateId;
  recomputePatchId(missingCandidateId);
  assert.throws(
    () => validateReviewPatch(missingCandidateId),
    (error) => error.code === 'SERIALIZED_CANDIDATE_ID_REQUIRED'
  );

  const conditionedFixture = approvedFixture('patch-conditioned-approval');
  const conditionedInput = structuredClone(conditionedFixture.candidate);
  delete conditionedInput.candidateId;
  conditionedInput.applicability.conditions = [{ id: 'installation_condition', value: 'indoor_only' }];
  const conditionedCandidate = createCandidate(conditionedInput);
  const conditionedDecision = createReviewDecision({
    candidate: conditionedCandidate,
    decision: 'APPROVE_FOR_REPOSITORY_REVIEW',
    reasonCodes: ['CONDITIONS_CONFIRMED', 'EVIDENCE_QUOTE_CONFIRMED', 'STRUCTURED_MEANING_CONFIRMED']
  });
  const conditionedPatch = structuredClone(createReviewPatch({
    baseCommitSha: BASE_SHA,
    registryPath: REGISTRY_PATH,
    generatedAt: SYNTHETIC_BENCHMARK_AS_OF,
    documents: [conditionedFixture.document],
    anchors: [conditionedFixture.anchor],
    candidates: [conditionedCandidate],
    decisions: [conditionedDecision]
  }));
  conditionedPatch.approvedCandidates[0].decision.reasonCodes = [
    'EVIDENCE_QUOTE_CONFIRMED',
    'STRUCTURED_MEANING_CONFIRMED'
  ];
  recomputePatchId(conditionedPatch);
  assert.throws(
    () => validateReviewPatch(conditionedPatch),
    (error) => error.code === 'CONDITIONS_CONFIRMATION_REQUIRED'
  );
});

test('projected source catalogs reject impossible or cross-series supersession references', () => {
  const patch = createBasicPatch();
  for (const [configure, label] of [
    [(revision) => {
      revision.seriesId = 'synthetic-impossible-series';
      revision.revisionId = 'rev-1-impossible';
      revision.sequence = 1;
      revision.supersedesDocumentId = `doc_${'f'.repeat(64)}`;
    }, 'sequence-one-unknown-target'],
    [(revision) => {
      revision.seriesId = 'synthetic-cross-series';
      revision.revisionId = 'rev-2-cross-series';
      revision.sequence = 2;
      revision.supersedesDocumentId = patch.sourceDocuments[0].documentId;
    }, 'cross-series-target']
  ]) {
    const forged = structuredClone(patch);
    const extra = structuredClone(forged.sourceDocuments[0]);
    extra.documentSha256 = sha256(`projected-source-${label}`);
    extra.normalizedContentSha256 = sha256(`projected-content-${label}`);
    extra.documentNumber = `SYNTH-${label.toUpperCase()}`;
    extra.title = `Synthetic ${label}`;
    extra.sourceUrl = `https://synthetic.example/evidence/${label}`;
    configure(extra.revision);
    recomputeProjectedSourceDocumentId(extra);
    forged.sourceDocuments.push(extra);
    forged.sourceDocuments.sort((left, right) => left.documentId.localeCompare(right.documentId));
    forged.metrics.sourceDocumentCount += 1;
    recomputePatchId(forged);
    assert.throws(
      () => validateReviewPatch(forged),
      (error) => error.code === 'INVALID_SUPERSESSION_REFERENCE',
      label
    );
  }
});

test('revision-series context retains no-candidate ancestors and blocks stale source approval', () => {
  const seriesId = 'synthetic-series-revision-context';
  const oldRaw = createSyntheticDocument({
    key: 'revision-context-old',
    pages: ['Synthetic prior revision without a capability statement.'],
    revision: { seriesId, revisionId: 'rev-1', sequence: 1 }
  });
  const oldDocument = normalizeSourceDocumentBundle(oldRaw, { asOf: SYNTHETIC_BENCHMARK_AS_OF });
  const newRaw = createSyntheticDocument({
    key: 'revision-context-new',
    pages: ['Synthetic current revision. Rated voltage: 24 kV. End of evidence.'],
    revision: {
      seriesId,
      revisionId: 'rev-2',
      sequence: 2,
      publishedAt: '2026-02-15T00:00:00.000Z',
      effectiveAt: '2026-03-01T00:00:00.000Z',
      retrievedAt: '2026-03-02T00:00:00.000Z',
      supersedesDocumentId: oldDocument.documentId
    }
  });
  const catalog = createSourceDocumentCatalog([oldRaw, newRaw], { asOf: SYNTHETIC_BENCHMARK_AS_OF });
  const currentDocument = catalog.documents.find((document) => document.revision.sequence === 2);
  const currentAnchor = anchorFor(currentDocument, 'Rated voltage: 24 kV.');
  const currentCandidate = extractDeterministicCandidates({ document: currentDocument, anchors: [currentAnchor] })[0];
  const currentDecision = createReviewDecision({
    candidate: currentCandidate,
    decision: 'APPROVE_FOR_REPOSITORY_REVIEW',
    reasonCodes: ['EVIDENCE_QUOTE_CONFIRMED', 'STRUCTURED_MEANING_CONFIRMED']
  });
  const currentPatch = createReviewPatch({
    baseCommitSha: BASE_SHA,
    registryPath: REGISTRY_PATH,
    generatedAt: SYNTHETIC_BENCHMARK_AS_OF,
    documents: catalog.documents,
    anchors: [currentAnchor],
    candidates: [currentCandidate],
    decisions: [currentDecision]
  });
  assert.deepEqual(
    currentPatch.sourceDocuments.map(({ documentId }) => documentId).sort(),
    catalog.documents.map(({ documentId }) => documentId).sort()
  );
  assert.equal(currentPatch.evidenceAnchors.length, 1);

  const staleSeriesId = 'synthetic-series-stale-source';
  const staleRaw = createSyntheticDocument({
    key: 'stale-source-rev-1',
    pages: ['Synthetic stale revision. Rated voltage: 22.9 kV. End of evidence.'],
    revision: { seriesId: staleSeriesId, revisionId: 'rev-1', sequence: 1 }
  });
  const staleDocument = normalizeSourceDocumentBundle(staleRaw, { asOf: SYNTHETIC_BENCHMARK_AS_OF });
  const middleRaw = createSyntheticDocument({
    key: 'stale-source-rev-2',
    pages: ['Synthetic middle revision. Rated voltage: 24 kV. End of evidence.'],
    revision: {
      seriesId: staleSeriesId,
      revisionId: 'rev-2',
      sequence: 2,
      publishedAt: '2026-02-15T00:00:00.000Z',
      effectiveAt: '2026-03-01T00:00:00.000Z',
      retrievedAt: '2026-03-02T00:00:00.000Z',
      supersedesDocumentId: staleDocument.documentId
    }
  });
  const middleDocument = normalizeSourceDocumentBundle(middleRaw, { asOf: SYNTHETIC_BENCHMARK_AS_OF });
  const latestRaw = createSyntheticDocument({
    key: 'stale-source-rev-3',
    pages: ['Synthetic latest revision without a capability statement.'],
    revision: {
      seriesId: staleSeriesId,
      revisionId: 'rev-3',
      sequence: 3,
      publishedAt: '2026-03-15T00:00:00.000Z',
      effectiveAt: '2026-04-01T00:00:00.000Z',
      retrievedAt: '2026-04-02T00:00:00.000Z',
      supersedesDocumentId: middleDocument.documentId
    }
  });
  const staleCatalog = createSourceDocumentCatalog([staleRaw, middleRaw, latestRaw], { asOf: SYNTHETIC_BENCHMARK_AS_OF });
  const middle = staleCatalog.documents.find((document) => document.revision.sequence === 2);
  const middleAnchor = anchorFor(middle, 'Rated voltage: 24 kV.');
  const middleCandidate = extractDeterministicCandidates({ document: middle, anchors: [middleAnchor] })[0];
  const middleDecision = createReviewDecision({
    candidate: middleCandidate,
    decision: 'APPROVE_FOR_REPOSITORY_REVIEW',
    reasonCodes: ['EVIDENCE_QUOTE_CONFIRMED', 'STRUCTURED_MEANING_CONFIRMED']
  });
  assert.throws(
    () => createReviewPatch({
      baseCommitSha: BASE_SHA,
      registryPath: REGISTRY_PATH,
      generatedAt: SYNTHETIC_BENCHMARK_AS_OF,
      documents: staleCatalog.documents,
      anchors: [middleAnchor],
      candidates: [middleCandidate],
      decisions: [middleDecision]
    }),
    (error) => error.code === 'APPROVED_SOURCE_SUPERSEDED'
  );
});

test('unresolved material conflicts and exact duplicates cannot enter a patch', () => {
  const conflictFixtures = [
    ['patch-conflict-a', 'Rated voltage: 22.9 kV.'],
    ['patch-conflict-b', 'Rated voltage: 24 kV.']
  ].map(([key, quote]) => {
    const document = documentFor(key, `Context before. ${quote} Context after.`);
    const anchor = anchorFor(document, quote);
    return { document, anchor, candidate: extractDeterministicCandidates({ document, anchors: [anchor] })[0] };
  });
  const candidates = conflictFixtures.map(({ candidate }) => candidate);
  const documents = conflictFixtures.map(({ document }) => document);
  const anchors = conflictFixtures.map(({ anchor }) => anchor);
  const relationshipReport = analyzeCandidateRelationships(candidates, { documents });
  const approvals = candidates.map((candidate) => createReviewDecision({
    candidate,
    decision: 'APPROVE_FOR_REPOSITORY_REVIEW',
    reasonCodes: ['EVIDENCE_QUOTE_CONFIRMED', 'STRUCTURED_MEANING_CONFIRMED']
  }));
  const standalonePatches = conflictFixtures.map((fixture, index) => createReviewPatch({
    baseCommitSha: BASE_SHA,
    registryPath: REGISTRY_PATH,
    generatedAt: SYNTHETIC_BENCHMARK_AS_OF,
    documents: [fixture.document],
    anchors: [fixture.anchor],
    candidates: [fixture.candidate],
    decisions: [approvals[index]]
  }));
  const mergedStandaloneApprovals = structuredClone(standalonePatches[0]);
  mergedStandaloneApprovals.sourceDocuments = standalonePatches
    .flatMap((patch) => structuredClone(patch.sourceDocuments))
    .sort((left, right) => left.documentId.localeCompare(right.documentId));
  mergedStandaloneApprovals.evidenceAnchors = standalonePatches
    .flatMap((patch) => structuredClone(patch.evidenceAnchors))
    .sort((left, right) => left.evidenceAnchorId.localeCompare(right.evidenceAnchorId));
  mergedStandaloneApprovals.approvedCandidates = standalonePatches
    .flatMap((patch) => structuredClone(patch.approvedCandidates))
    .sort((left, right) => left.candidate.candidateId.localeCompare(right.candidate.candidateId));
  mergedStandaloneApprovals.sourceFileSuggestions = standalonePatches
    .flatMap((patch) => structuredClone(patch.sourceFileSuggestions))
    .sort((left, right) => left.candidateId.localeCompare(right.candidateId));
  mergedStandaloneApprovals.metrics = {
    approvedCandidateCount: 2,
    sourceDocumentCount: 2,
    evidenceAnchorCount: 2,
    relationshipReviewCount: 0,
    relationshipDispositionCount: 0,
    sourceFileSuggestionCount: 2,
    aggregateQuoteCodePoints: mergedStandaloneApprovals.evidenceAnchors
      .reduce((sum, anchor) => sum + [...anchor.selection.directQuote].length, 0)
  };
  recomputePatchId(mergedStandaloneApprovals);
  assert.throws(
    () => validateReviewPatch(mergedStandaloneApprovals),
    (error) => error.code === 'RELATIONSHIP_SET_MISMATCH'
  );
  assert.throws(
    () => createReviewPatch({
      baseCommitSha: BASE_SHA, registryPath: REGISTRY_PATH, generatedAt: SYNTHETIC_BENCHMARK_AS_OF,
      documents, anchors, candidates, decisions: approvals, relationshipReport
    }),
    (error) => error.code === 'MATERIAL_CONFLICT_UNRESOLVED'
  );
  const flagDecisions = candidates.map((candidate, index) => createReviewDecision({
    candidate,
    decision: 'FLAG_CONFLICT',
    reasonCodes: ['CONFLICTING_DOCUMENT'],
    relatedCandidateIds: [candidates[1 - index].candidateId]
  }));
  assert.throws(
    () => createReviewPatch({
      baseCommitSha: BASE_SHA, registryPath: REGISTRY_PATH, generatedAt: SYNTHETIC_BENCHMARK_AS_OF,
      documents, anchors, candidates, decisions: flagDecisions, relationshipReport
    }),
    (error) => error.code === 'MATERIAL_CONFLICT_UNRESOLVED'
  );
  const resolved = [
    approvals[0],
    createReviewDecision({ candidate: candidates[1], decision: 'REJECT', reasonCodes: ['NOT_A_CAPABILITY'] })
  ];
  const patch = createReviewPatch({
    baseCommitSha: BASE_SHA, registryPath: REGISTRY_PATH, generatedAt: SYNTHETIC_BENCHMARK_AS_OF,
    documents, anchors, candidates, decisions: resolved, relationshipReport
  });
  assert.equal(patch.approvedCandidates.length, 1);
  assert.equal(patch.relationshipDispositions[0].disposition, 'EXPLICIT_CONFLICT_DISPOSITION');

  const hiddenConflict = structuredClone(patch);
  hiddenConflict.approvedCandidates[0].relationshipIds = [];
  recomputePatchId(hiddenConflict);
  assert.throws(
    () => validateReviewPatch(hiddenConflict),
    (error) => error.code === 'RELATIONSHIP_LINK_SET_MISMATCH'
  );

  const favorableConflict = structuredClone(patch);
  const rejectedDisposition = favorableConflict.relationshipDispositions[0].candidateDispositions
    .find((item) => item.decision === 'REJECT');
  rejectedDisposition.decision = 'APPROVE_FOR_REPOSITORY_REVIEW';
  recomputePatchId(favorableConflict);
  assert.throws(
    () => validateReviewPatch(favorableConflict),
    (error) => ['RELATIONSHIP_REVIEW_BINDING_INVALID', 'RELATIONSHIP_APPROVAL_BINDING_INVALID', 'MATERIAL_CONFLICT_UNRESOLVED'].includes(error.code)
  );

  const forgedRelationshipIdentity = structuredClone(patch);
  const forgedRelationship = forgedRelationshipIdentity.relationshipDispositions[0];
  const forgedDisposition = forgedRelationship.candidateDispositions.find((item) => item.decision === 'REJECT');
  const forgedCandidateId = `cand_${'f'.repeat(64)}`;
  forgedRelationship.relationshipId = `rel_${'f'.repeat(64)}`;
  forgedRelationship.candidateIds = forgedRelationship.candidateIds
    .map((candidateId) => candidateId === forgedDisposition.candidateId ? forgedCandidateId : candidateId)
    .sort();
  forgedDisposition.candidateId = forgedCandidateId;
  forgedRelationship.candidateDispositions.sort((left, right) => left.candidateId.localeCompare(right.candidateId));
  recomputePatchId(forgedRelationshipIdentity);
  assert.throws(
    () => validateReviewPatch(forgedRelationshipIdentity),
    (error) => error.code === 'RELATIONSHIP_IDENTITY_MISMATCH'
  );

  const duplicateFixture = approvedFixture('patch-duplicate-a');
  const duplicateSecond = approvedFixture('patch-duplicate-b');
  const duplicateCandidates = [duplicateFixture.candidate, duplicateSecond.candidate];
  const duplicateDocuments = [duplicateFixture.document, duplicateSecond.document];
  const duplicateAnchors = [duplicateFixture.anchor, duplicateSecond.anchor];
  const duplicateReport = analyzeCandidateRelationships(duplicateCandidates, { documents: duplicateDocuments });
  assert.throws(
    () => createReviewPatch({
      baseCommitSha: BASE_SHA, registryPath: REGISTRY_PATH, generatedAt: SYNTHETIC_BENCHMARK_AS_OF,
      documents: duplicateDocuments, anchors: duplicateAnchors, candidates: duplicateCandidates,
      decisions: [duplicateFixture.decision, duplicateSecond.decision], relationshipReport: duplicateReport
    }),
    (error) => error.code === 'DUPLICATE_RELATIONSHIP_UNRESOLVED'
  );
});

test('superseded evidence remains linked and requires an explicit old/new disposition', () => {
  const scenario = createSyntheticBenchmarkFixture({ includeOversizedInputs: false }).scenarios
    .find(({ id }) => id === '13_superseded_revision');
  const documents = createSourceDocumentCatalog(scenario.documents, { asOf: SYNTHETIC_BENCHMARK_AS_OF }).documents;
  const fixtures = documents.map((document) => {
    const quote = document.pages[0].text.match(/Rated voltage: [0-9.]+ kV\./u)[0];
    const anchor = anchorFor(document, quote);
    return { document, anchor, candidate: extractDeterministicCandidates({ document, anchors: [anchor] })[0] };
  });
  const candidates = fixtures.map(({ candidate }) => candidate);
  const anchors = fixtures.map(({ anchor }) => anchor);
  const report = analyzeCandidateRelationships(candidates, { documents });
  const relationship = report.relationships[0];
  const oldCandidate = candidates.find(({ candidateId }) => candidateId === relationship.supersededCandidateId);
  const newCandidate = candidates.find(({ candidateId }) => candidateId === relationship.successorCandidateId);
  const newApproval = createReviewDecision({
    candidate: newCandidate,
    decision: 'APPROVE_FOR_REPOSITORY_REVIEW',
    reasonCodes: ['EVIDENCE_QUOTE_CONFIRMED', 'STRUCTURED_MEANING_CONFIRMED']
  });
  assert.throws(
    () => createReviewPatch({
      baseCommitSha: BASE_SHA, registryPath: REGISTRY_PATH, generatedAt: SYNTHETIC_BENCHMARK_AS_OF,
      documents, anchors, candidates, decisions: [newApproval], relationshipReport: report
    }),
    (error) => error.code === 'RELATIONSHIP_DISPOSITION_REQUIRED'
  );
  const oldDisposition = createReviewDecision({
    candidate: oldCandidate,
    decision: 'FLAG_SUPERSEDED',
    reasonCodes: ['SUPERSEDED_DOCUMENT'],
    relatedCandidateIds: [newCandidate.candidateId]
  });
  const patch = createReviewPatch({
    baseCommitSha: BASE_SHA, registryPath: REGISTRY_PATH, generatedAt: SYNTHETIC_BENCHMARK_AS_OF,
    documents, anchors, candidates, decisions: [oldDisposition, newApproval], relationshipReport: report
  });
  assert.equal(patch.sourceDocuments.length, 2);
  assert.equal(patch.evidenceAnchors.length, 2);
  assert.equal(patch.relationshipDispositions[0].disposition, 'EXPLICIT_SUPERSESSION_DISPOSITION');
  const swappedRoles = structuredClone(patch);
  const swappedRelationship = swappedRoles.relationshipDispositions[0];
  [swappedRelationship.supersededCandidateId, swappedRelationship.successorCandidateId] = [
    swappedRelationship.successorCandidateId,
    swappedRelationship.supersededCandidateId
  ];
  recomputePatchId(swappedRoles);
  assert.throws(
    () => validateReviewPatch(swappedRoles),
    (error) => error.code === 'RELATIONSHIP_IDENTITY_MISMATCH'
  );
});

test('patch serialization failure injection and noncanonical ordering fail closed', () => {
  const patch = createBasicPatch();
  assert.throws(
    () => serializeReviewPatch(patch, {
      inject: { beforePatchSerialization() { throw Object.assign(new Error('injected'), { code: 'INJECTED_PATCH_SERIALIZATION_FAILURE' }); } }
    }),
    (error) => error.code === 'INJECTED_PATCH_SERIALIZATION_FAILURE'
  );
  const resolvedFixture = approvedFixture('patch-ordering');
  const second = approvedFixture('patch-ordering-second');
  const candidates = [resolvedFixture.candidate, second.candidate];
  const documents = [resolvedFixture.document, second.document];
  const anchors = [resolvedFixture.anchor, second.anchor];
  const report = analyzeCandidateRelationships(candidates, { documents });
  const duplicateRejection = createReviewDecision({ candidate: second.candidate, decision: 'REJECT', reasonCodes: ['DUPLICATE_CANDIDATE'] });
  const ordered = createReviewPatch({
    baseCommitSha: BASE_SHA, registryPath: REGISTRY_PATH, generatedAt: SYNTHETIC_BENCHMARK_AS_OF,
    documents, anchors, candidates, decisions: [resolvedFixture.decision, duplicateRejection], relationshipReport: report
  });
  const reversed = structuredClone(ordered);
  reversed.sourceDocuments.reverse();
  recomputePatchId(reversed);
  assert.throws(() => validateReviewPatch(reversed), (error) => error.code === 'NONCANONICAL_ORDER');
});
