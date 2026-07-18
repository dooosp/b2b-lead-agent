import {
  SYNTHETIC_BENCHMARK_AS_OF,
  createSyntheticBenchmarkFixture
} from './synthetic-benchmark-v0.mjs';
import { normalizeSourceDocumentBundle } from '../domain/document-bundle.mjs';
import { createPageEvidenceAnchor } from '../domain/evidence-anchor.mjs';
import { extractDeterministicCandidates } from '../domain/candidates.mjs';
import { createReviewDecision } from '../domain/review-decisions.mjs';
import { analyzeCandidateRelationships } from '../domain/relationships.mjs';
import { createReviewPatch } from '../domain/review-patch.mjs';

function codePointOffset(text, quote) {
  const prefix = text.slice(0, text.indexOf(quote));
  return [...prefix].length;
}

export function createSyntheticApprovedReviewPatchFixture() {
  const fixture = createSyntheticBenchmarkFixture({ includeOversizedInputs: false });
  const rawDocument = fixture.scenarios
    .find(({ id }) => id === '01_valid_switchgear_datasheet')
    .documents[0];
  const document = normalizeSourceDocumentBundle(rawDocument, { asOf: SYNTHETIC_BENCHMARK_AS_OF });
  const quote = 'Rated voltage: 24 kV.';
  const startCodePoint = codePointOffset(document.pages[0].text, quote);
  const anchor = createPageEvidenceAnchor(document, {
    pageNumber: 1,
    startCodePoint,
    endCodePoint: startCodePoint + [...quote].length,
    quote
  });
  const candidate = extractDeterministicCandidates({ document, anchors: [anchor] })[0];
  const decision = createReviewDecision({
    candidate,
    decision: 'APPROVE_FOR_REPOSITORY_REVIEW',
    reasonCodes: ['EVIDENCE_QUOTE_CONFIRMED', 'STRUCTURED_MEANING_CONFIRMED']
  });
  const relationshipReport = analyzeCandidateRelationships([candidate], { documents: [document] });
  return createReviewPatch({
    baseCommitSha: 'a'.repeat(40),
    registryPath: 'knowledge/claim-registry/repository-reviewed/evidence-claim-review-import-v0.json',
    generatedAt: '2026-05-15T00:00:00.000Z',
    documents: [document],
    anchors: [anchor],
    candidates: [candidate],
    decisions: [decision],
    relationshipReport
  });
}
