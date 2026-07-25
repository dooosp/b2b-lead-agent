import test from 'node:test';
import assert from 'node:assert/strict';

import { createCandidate } from '../evidence-claim-workbench/domain/candidates.mjs';
import {
  computeReviewDecisionId,
  createReviewDecision,
  validateReviewDecision
} from '../evidence-claim-workbench/domain/review-decisions.mjs';

function candidate(overrides = {}) {
  const raw = {
    schemaVersion: 'evidence-claim-candidate-v0',
    synthetic: true,
    documentId: `doc_${'a'.repeat(64)}`,
    evidenceAnchorId: `anc_${'b'.repeat(64)}`,
    claimType: 'PRODUCT_CAPABILITY',
    subject: { type: 'PRODUCT_FAMILY', id: 'medium_voltage_switchgear', displayName: 'Medium-voltage Switchgear' },
    statement: 'Medium-voltage Switchgear 공식 문서 검토 후보: rated_voltage = 24 kV.',
    value: { type: 'QUANTITY', key: 'rated_voltage', value: 24, unit: 'kV', quantityKind: 'voltage' },
    applicability: {
      vertical: 'datacenter', domain: 'electrical_power', productFamily: 'medium_voltage_switchgear',
      jurisdiction: 'KR', projectStages: ['SPECIFICATION'], conditions: []
    },
    validity: { type: 'NOT_STATED', validUntil: null },
    extractionMethod: 'MANUAL_EXACT_QUOTE',
    extractionRuleId: 'OECRW0-MANUAL-STRUCTURED-ENTRY',
    extractionReasons: ['HUMAN_SELECTED_EXACT_EVIDENCE'],
    reviewState: 'REVIEW_REQUIRED',
    ...overrides
  };
  return createCandidate(raw);
}

test('all bounded review decisions are deterministic and carry only non-authoritative acknowledgements', () => {
  const base = candidate();
  const cases = [
    ['APPROVE_FOR_REPOSITORY_REVIEW', ['EVIDENCE_QUOTE_CONFIRMED', 'STRUCTURED_MEANING_CONFIRMED'], []],
    ['REJECT', ['NOT_A_CAPABILITY'], []],
    ['DEFER_MISSING_CONTEXT', ['UNIT_AMBIGUOUS'], []],
    ['FLAG_CONFLICT', ['CONFLICTING_DOCUMENT'], [`cand_${'c'.repeat(64)}`]],
    ['FLAG_SUPERSEDED', ['SUPERSEDED_DOCUMENT'], [`cand_${'d'.repeat(64)}`]],
    ['FLAG_SOURCE_AUTHENTICITY', ['SOURCE_AUTHENTICITY_UNCLEAR'], []]
  ];
  for (const [decision, reasonCodes, relatedCandidateIds] of cases) {
    const first = createReviewDecision({ candidate: base, decision, reasonCodes, relatedCandidateIds });
    const second = createReviewDecision({ candidate: base, decision, reasonCodes: [...reasonCodes].reverse(), relatedCandidateIds: [...relatedCandidateIds].reverse() });
    assert.deepEqual(first, second, decision);
    assert.equal(validateReviewDecision(first).decisionId, first.decisionId);
    assert.equal(first.reviewerIdentity, 'NOT_COLLECTED');
    assert.equal(first.reviewerLabel, 'repository_reviewer_pending');
    assert.deepEqual(first.acknowledgements, {
      notVerified: true,
      repositoryReviewRequired: true,
      customerUseNotAllowed: true
    });
    assert.doesNotMatch(first.decision, /VERIFIED|ALLOWED|PRODUCTION_APPROVED/);
  }
});

test('approval requires complete structured acknowledgement reasons and condition confirmation', () => {
  const conditioned = candidate({
    applicability: {
      vertical: 'datacenter', domain: 'electrical_power', productFamily: 'medium_voltage_switchgear',
      jurisdiction: 'KR', projectStages: ['SPECIFICATION'],
      conditions: [{ id: 'installation_condition', value: 'indoor_only' }]
    }
  });
  assert.throws(
    () => createReviewDecision({
      candidate: conditioned,
      decision: 'APPROVE_FOR_REPOSITORY_REVIEW',
      reasonCodes: ['EVIDENCE_QUOTE_CONFIRMED', 'STRUCTURED_MEANING_CONFIRMED']
    }),
    (error) => error.code === 'CONDITIONS_CONFIRMATION_REQUIRED'
  );
  const approved = createReviewDecision({
    candidate: conditioned,
    decision: 'APPROVE_FOR_REPOSITORY_REVIEW',
    reasonCodes: ['CONDITIONS_CONFIRMED', 'EVIDENCE_QUOTE_CONFIRMED', 'STRUCTURED_MEANING_CONFIRMED']
  });
  assert.equal(approved.decision, 'APPROVE_FOR_REPOSITORY_REVIEW');
});

test('reason codes, conflict links, and supersession links are decision-compatible', () => {
  const base = candidate();
  assert.throws(
    () => createReviewDecision({ candidate: base, decision: 'REJECT', reasonCodes: ['CONFLICTING_DOCUMENT'] }),
    (error) => error.code === 'REASON_DECISION_INCOMPATIBLE'
  );
  assert.throws(
    () => createReviewDecision({ candidate: base, decision: 'FLAG_CONFLICT', reasonCodes: ['CONFLICTING_DOCUMENT'] }),
    (error) => error.code === 'RELATED_CANDIDATE_REQUIRED'
  );
  assert.throws(
    () => createReviewDecision({ candidate: base, decision: 'FLAG_SUPERSEDED', reasonCodes: ['SUPERSEDED_DOCUMENT'] }),
    (error) => error.code === 'RELATED_CANDIDATE_REQUIRED'
  );
  assert.throws(
    () => createReviewDecision({
      candidate: base,
      decision: 'APPROVE_FOR_REPOSITORY_REVIEW',
      reasonCodes: ['EVIDENCE_QUOTE_CONFIRMED', 'STRUCTURED_MEANING_CONFIRMED'],
      relatedCandidateIds: [`cand_${'c'.repeat(64)}`]
    }),
    (error) => error.code === 'APPROVAL_RELATION_LINK_REFUSED'
  );
});

test('review input refuses identity/free text/authority fields and validation rejects self-consistent invalid snapshots', () => {
  const base = candidate();
  for (const extra of [
    { reviewerIdentity: 'named-person' },
    { reviewerEmail: 'person@example.test' },
    { notes: 'unbounded rationale' },
    { status: 'VERIFIED' },
    { customerUse: 'ALLOWED' }
  ]) {
    assert.throws(
      () => createReviewDecision({ candidate: base, decision: 'REJECT', reasonCodes: ['NOT_A_CAPABILITY'], ...extra }),
      (error) => error.code === 'UNKNOWN_FIELD_REFUSED'
    );
  }
  const approved = createReviewDecision({
    candidate: base,
    decision: 'APPROVE_FOR_REPOSITORY_REVIEW',
    reasonCodes: ['EVIDENCE_QUOTE_CONFIRMED', 'STRUCTURED_MEANING_CONFIRMED']
  });
  for (const mutate of [
    (draft) => { draft.candidateSnapshot.claimType = 'ROI'; },
    (draft) => { draft.candidateSnapshot.validity = { type: 'VALID_UNTIL', validUntil: '2027-01-01' }; },
    (draft) => { draft.candidateSnapshot.applicability.conditions = [{ id: 'reviewer_name', value: 'x' }]; }
  ]) {
    const forged = structuredClone(approved);
    mutate(forged);
    forged.decisionId = computeReviewDecisionId(forged);
    assert.throws(() => validateReviewDecision(forged));
  }
  const identity = structuredClone(approved);
  identity.reviewerIdentity = 'real-person';
  identity.decisionId = computeReviewDecisionId(identity);
  assert.throws(() => validateReviewDecision(identity), (error) => error.code === 'REVIEWER_IDENTITY_REFUSED');
});

test('review decision failure injection cannot return a partial approval', () => {
  assert.throws(
    () => createReviewDecision({ candidate: candidate(), decision: 'REJECT', reasonCodes: ['NOT_A_CAPABILITY'] }, {
      inject: { beforeReviewDecision() { throw Object.assign(new Error('injected'), { code: 'INJECTED_REVIEW_FAILURE' }); } }
    }),
    (error) => error.code === 'INJECTED_REVIEW_FAILURE'
  );
});
