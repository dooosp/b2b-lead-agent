import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildLeadActionIntelligence,
  buildReviewerActionQueue,
} from '../lib/lead-action-intelligence.js';

const evaluationNow = new Date('2026-05-12T00:00:00.000Z');

function strongLead(overrides = {}) {
  return {
    id: 'strong-lead',
    company: 'Ready Co',
    reviewStatus: 'APPROVED',
    verificationStatus: 'verified',
    generationMode: 'llm',
    signal: 'Chiller retrofit program entered vendor shortlist',
    whyNow: 'Shortlist closes this quarter.',
    recommendedMessage: 'Follow up with the operations director about a compressor retrofit pilot.',
    product: 'Turbocor compressor',
    buyerRole: 'Operations Director',
    eventType: 'vendor_shortlist',
    confidence: 'HIGH',
    confidenceReason: 'Two current public sources agree with the direct quote.',
    evidence: [
      { field: 'summary', quote: 'vendor shortlist', sourceUrl: 'https://synthetic.example/ready' },
    ],
    sources: [
      { title: 'Ready source', url: 'https://synthetic.example/ready', publishedAt: '2026-05-01' },
    ],
    assumptions: ['Engineering load profile still needs confirmation.'],
    dataGaps: [],
    buyingSignals: ['Vendor shortlist'],
    painPoints: ['Cooling energy cost'],
    ...overrides,
  };
}

test('lead action intelligence prepares reviewed follow-up for complete high-quality leads', () => {
  const intelligence = buildLeadActionIntelligence(strongLead(), { now: evaluationNow });

  assert.equal(intelligence.nextReviewAction, 'prepare_human_follow_up');
  assert.equal(intelligence.reviewPriority, 'high');
  assert.equal(intelligence.actionConfidence, 'high');
  assert.equal(intelligence.riskFlags.length, 0);
  assert.equal(intelligence.missingInfoPrompts.length, 0);
  assert.match(intelligence.nextReviewActionReason, /approved/i);
  assert.match(intelligence.stakeholderAngle, /Operations Director/);
  assert.match(intelligence.suggestedFollowUp, /Human-review draft/);
  assert.match(intelligence.suggestedFollowUp, /Turbocor compressor/);
});

test('lead action intelligence asks reviewers to decide status for review-ready leads', () => {
  const intelligence = buildLeadActionIntelligence(strongLead({ reviewStatus: 'NEEDS_REVIEW' }), { now: evaluationNow });

  assert.equal(intelligence.nextReviewAction, 'decide_review_status');
  assert.equal(intelligence.reviewPriority, 'high');
  assert.equal(intelligence.actionConfidence, 'medium');
  assert.deepEqual(intelligence.riskFlags.map((flag) => flag.code), ['human_review_pending']);
  assert.match(intelligence.nextReviewActionReason, /verified evidence is present/i);
});

test('lead action intelligence blocks missing evidence even when confidence is overstated', () => {
  const intelligence = buildLeadActionIntelligence(strongLead({
    id: 'missing-evidence',
    reviewStatus: 'NEEDS_REVIEW',
    verificationStatus: 'verified',
    confidence: 'HIGH',
    evidence: [],
    sources: [],
    dataGaps: [],
  }), { now: evaluationNow });

  assert.equal(intelligence.nextReviewAction, 'verify_evidence');
  assert.equal(intelligence.reviewPriority, 'medium');
  assert.equal(intelligence.actionConfidence, 'low');
  assert.ok(intelligence.riskFlags.some((flag) => flag.code === 'missing_evidence'));
  assert.ok(intelligence.riskFlags.some((flag) => flag.code === 'verified_without_evidence'));
  assert.ok(intelligence.missingInfoPrompts.includes('Add at least one published source URL.'));
  assert.ok(intelligence.missingInfoPrompts.includes('Add a direct evidence quote tied to a source URL.'));
});

test('lead action intelligence resolves explicit data gaps before outreach', () => {
  const intelligence = buildLeadActionIntelligence(strongLead({
    reviewStatus: 'NEEDS_REVIEW',
    confidence: 'MEDIUM',
    dataGaps: ['Decision owner unknown', 'Budget not published'],
  }), { now: evaluationNow });

  assert.equal(intelligence.nextReviewAction, 'resolve_data_gaps');
  assert.equal(intelligence.reviewPriority, 'medium');
  assert.ok(intelligence.riskFlags.some((flag) => flag.code === 'data_gaps'));
  assert.deepEqual(intelligence.missingInfoPrompts.slice(0, 2), [
    'Resolve data gap: Decision owner unknown',
    'Resolve data gap: Budget not published',
  ]);
});

test('lead action intelligence sends low-confidence heuristic leads to enrichment', () => {
  const intelligence = buildLeadActionIntelligence(strongLead({
    reviewStatus: 'NEEDS_REVIEW',
    verificationStatus: 'needs_review',
    generationMode: 'heuristic',
    confidence: 'LOW',
    evidence: [],
    sources: [{ title: 'Thin source', url: 'https://synthetic.example/thin', publishedAt: '2026-05-02' }],
    dataGaps: ['Buyer not confirmed'],
  }), { now: evaluationNow });

  assert.equal(intelligence.nextReviewAction, 'enrich_before_review');
  assert.equal(intelligence.reviewPriority, 'medium');
  assert.equal(intelligence.actionConfidence, 'low');
  assert.ok(intelligence.riskFlags.some((flag) => flag.code === 'low_confidence'));
  assert.ok(intelligence.riskFlags.some((flag) => flag.code === 'non_llm_generation'));
});

test('lead action intelligence refreshes stale signals before review', () => {
  const intelligence = buildLeadActionIntelligence(strongLead({
    sources: [
      { title: 'Old source', url: 'https://synthetic.example/old', published_at: '2025-12-01' },
    ],
  }), { now: evaluationNow, staleAfterDays: 90 });

  assert.equal(intelligence.nextReviewAction, 'refresh_signal');
  assert.equal(intelligence.reviewPriority, 'medium');
  assert.ok(intelligence.riskFlags.some((flag) => flag.code === 'stale_signal'));
  assert.ok(intelligence.missingInfoPrompts.includes('Refresh stale public sources or revalidate the signal date.'));
});

test('lead action intelligence reconciles conflicting verification and review states', () => {
  const intelligence = buildLeadActionIntelligence(strongLead({
    reviewStatus: 'APPROVED',
    verificationStatus: 'needs_review',
    confidence: 'MEDIUM',
    conflicts: [{ field: 'timeline' }],
  }), { now: evaluationNow });

  assert.equal(intelligence.nextReviewAction, 'reconcile_review_conflict');
  assert.equal(intelligence.reviewPriority, 'high');
  assert.equal(intelligence.actionConfidence, 'low');
  assert.ok(intelligence.riskFlags.some((flag) => flag.code === 'approved_but_unverified'));
  assert.ok(intelligence.riskFlags.some((flag) => flag.code === 'conflicting_evidence'));
  assert.match(intelligence.nextReviewActionReason, /approved review state conflicts/i);
});

test('lead action intelligence accepts snake_case fallback payloads', () => {
  const intelligence = buildLeadActionIntelligence({
    id: 'snake-case',
    company: 'Legacy Co',
    review_status: 'deferred',
    verification_status: 'needs_review',
    generation_mode: 'llm',
    summary: 'Factory expansion timing is uncertain',
    urgency_reason: 'A future tender window is possible.',
    sales_pitch: 'Confirm timing before any message.',
    recommended_product: 'Drive retrofit',
    buyer_role: 'Plant Manager',
    event_type: 'expansion',
    confidence: 'medium',
    confidence_reason: 'One source mentions expansion but timing is unclear.',
    evidence: [{ field: 'summary', quote: 'expansion timing', source_url: 'https://synthetic.example/legacy' }],
    sources: [{ title: 'Legacy source', url: 'https://synthetic.example/legacy', publishedAt: '2026-05-04' }],
    data_gaps: ['Tender date unknown'],
  }, { now: evaluationNow });

  assert.equal(intelligence.nextReviewAction, 'resolve_data_gaps');
  assert.equal(intelligence.reviewPriority, 'medium');
  assert.match(intelligence.stakeholderAngle, /Plant Manager/);
  assert.match(intelligence.suggestedFollowUp, /Drive retrofit/);
  assert.ok(intelligence.missingInfoPrompts.includes('Resolve data gap: Tender date unknown'));
});

test('reviewer action queue groups compact action summaries and sorts highest priority first', () => {
  const leads = [
    strongLead({
      id: 'data-gap',
      company: 'Data Gap Co',
      reviewStatus: 'NEEDS_REVIEW',
      confidence: 'MEDIUM',
      dataGaps: ['Budget not published'],
      updatedAt: '2026-05-04T00:00:00.000Z',
    }),
    strongLead({
      id: 'approved-ready',
      company: 'Approved Ready Co',
      reviewStatus: 'APPROVED',
      confidence: 'HIGH',
      updatedAt: '2026-05-01T00:00:00.000Z',
    }),
    strongLead({
      id: 'review-ready',
      company: 'Review Ready Co',
      reviewStatus: 'NEEDS_REVIEW',
      confidence: 'HIGH',
      updatedAt: '2026-05-09T00:00:00.000Z',
    }),
    strongLead({
      id: 'risk-conflict',
      company: 'Risk Conflict Co',
      reviewStatus: 'APPROVED',
      verificationStatus: 'needs_review',
      confidence: 'MEDIUM',
      conflicts: [{ field: 'timeline' }],
      updatedAt: '2026-05-08T00:00:00.000Z',
    }),
    strongLead({
      id: 'rejected',
      company: 'Rejected Co',
      reviewStatus: 'REJECTED',
      updatedAt: '2026-05-10T00:00:00.000Z',
    }),
  ];

  const queue = buildReviewerActionQueue(leads, { now: evaluationNow });

  assert.deepEqual(queue.items.map((item) => item.leadId), [
    'approved-ready',
    'review-ready',
    'risk-conflict',
    'data-gap',
    'rejected',
  ]);
  assert.deepEqual(queue.lanes.map((lane) => [lane.id, lane.label, lane.count]), [
    ['approval_candidates', '승인 후보', 2],
    ['needs_evidence', '보강 필요', 1],
    ['risk_review', '리스크 확인', 1],
    ['low_priority', '낮은 우선순위', 1],
  ]);

  const ready = queue.items[0];
  assert.equal(ready.nextReviewAction, 'prepare_human_follow_up');
  assert.equal(ready.reviewPriority, 'high');
  assert.equal(ready.actionConfidence, 'high');
  assert.equal(ready.queueLane, 'approval_candidates');
  assert.equal(ready.riskCount, 0);
  assert.equal(ready.missingInfoCount, 0);
  assert.match(ready.reasonSnippet, /approved/i);
  assert.ok(ready.reasonSnippet.length <= 160);
});

test('reviewer action queue filters by action, priority, risk, missing info, and lane', () => {
  const leads = [
    strongLead({
      id: 'missing-evidence',
      reviewStatus: 'NEEDS_REVIEW',
      verificationStatus: 'verified',
      evidence: [],
      sources: [],
      dataGaps: [],
    }),
    strongLead({
      id: 'data-gap',
      reviewStatus: 'NEEDS_REVIEW',
      confidence: 'MEDIUM',
      dataGaps: ['Budget not published'],
    }),
    strongLead({
      id: 'review-ready',
      reviewStatus: 'NEEDS_REVIEW',
      confidence: 'HIGH',
    }),
    strongLead({
      id: 'approved-ready',
      reviewStatus: 'APPROVED',
      confidence: 'HIGH',
    }),
    strongLead({
      id: 'risk-conflict',
      reviewStatus: 'APPROVED',
      verificationStatus: 'needs_review',
      conflicts: [{ field: 'timeline' }],
    }),
  ];

  assert.deepEqual(
    buildReviewerActionQueue(leads, {
      now: evaluationNow,
      filters: { nextReviewAction: 'verify_evidence' },
    }).items.map((item) => item.leadId),
    ['missing-evidence']
  );
  assert.deepEqual(
    buildReviewerActionQueue(leads, {
      now: evaluationNow,
      filters: { reviewPriority: 'high' },
    }).items.map((item) => item.leadId),
    ['approved-ready', 'review-ready', 'risk-conflict']
  );
  assert.deepEqual(
    buildReviewerActionQueue(leads, {
      now: evaluationNow,
      filters: { riskFlag: 'missing_evidence' },
    }).items.map((item) => item.leadId),
    ['missing-evidence']
  );
  assert.deepEqual(
    buildReviewerActionQueue(leads, {
      now: evaluationNow,
      filters: { missingInfo: 'has' },
    }).items.map((item) => item.leadId),
    ['risk-conflict', 'missing-evidence', 'data-gap']
  );
  assert.deepEqual(
    buildReviewerActionQueue(leads, {
      now: evaluationNow,
      filters: { queueLane: 'needs_evidence' },
    }).items.map((item) => item.leadId),
    ['missing-evidence', 'data-gap']
  );
});

test('reviewer action queue accepts snake_case payloads and updates guidance after review mutation', () => {
  const legacyLead = {
    id: 'legacy-review-ready',
    company: 'Legacy Ready Co',
    review_status: 'needs_review',
    verification_status: 'verified',
    generation_mode: 'llm',
    summary: 'Expansion shortlist is active',
    why_now: 'Shortlist closes this quarter.',
    sales_pitch: 'Confirm retrofit timing.',
    recommended_product: 'Drive retrofit',
    buyer_role: 'Plant Manager',
    confidence: 'medium',
    evidence: [{ field: 'summary', quote: 'shortlist is active', source_url: 'https://synthetic.example/legacy' }],
    sources: [{ title: 'Legacy source', url: 'https://synthetic.example/legacy', published_at: '2026-05-04' }],
    data_gaps: [],
    updated_at: '2026-05-04T00:00:00.000Z',
  };

  const before = buildReviewerActionQueue([legacyLead], { now: evaluationNow }).items[0];
  const after = buildReviewerActionQueue([
    {
      ...legacyLead,
      review_status: 'approved',
      verification_status: 'needs_review',
    },
  ], { now: evaluationNow }).items[0];

  assert.equal(before.nextReviewAction, 'decide_review_status');
  assert.equal(before.queueLane, 'approval_candidates');
  assert.equal(before.reviewStatus, 'NEEDS_REVIEW');
  assert.equal(after.nextReviewAction, 'reconcile_review_conflict');
  assert.equal(after.queueLane, 'risk_review');
  assert.equal(after.reviewStatus, 'APPROVED');
});
