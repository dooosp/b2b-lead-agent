import test from 'node:test';
import assert from 'node:assert/strict';

import { buildLeadActionIntelligence } from '../lib/lead-action-intelligence.js';

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
