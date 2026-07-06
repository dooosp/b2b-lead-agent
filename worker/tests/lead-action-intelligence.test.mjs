import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDataGapPrioritization,
  buildLeadActionIntelligence,
  buildLeadReviewSession,
  buildReviewerNoteTemplates,
  buildReviewerActionQueue,
  buildReviewerWorkflowSummary,
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
  assert.equal(intelligence.reviewNoteSuggestion.state, 'APPROVED');
  assert.match(intelligence.reviewNoteSuggestion.text, /Decision: APPROVED/);
});

test('reviewer note templates include approved, needs-review, and follow-up variants for strong leads', () => {
  const notes = buildReviewerNoteTemplates(strongLead(), { now: evaluationNow });

  assert.equal(notes.current.state, 'APPROVED');
  assert.equal(notes.current.label, '승인 노트');
  assert.deepEqual(notes.templates.map((template) => template.state), [
    'APPROVED',
    'NEEDS_REVIEW',
    'RISK_CHECK',
  ]);
  assert.match(notes.current.text, /Decision: APPROVED/);
  assert.match(notes.current.text, /Ready Co/);
  assert.match(notes.current.text, /vendor shortlist/);
  assert.match(notes.current.text, /verification=verified/);
  assert.match(notes.templates.find((template) => template.state === 'NEEDS_REVIEW').text, /Decision: NEEDS_REVIEW/);
  assert.match(notes.templates.find((template) => template.state === 'RISK_CHECK').text, /Follow-up check/);
});

test('lead action intelligence asks reviewers to decide status for review-ready leads', () => {
  const intelligence = buildLeadActionIntelligence(strongLead({ reviewStatus: 'NEEDS_REVIEW' }), { now: evaluationNow });

  assert.equal(intelligence.nextReviewAction, 'decide_review_status');
  assert.equal(intelligence.reviewPriority, 'high');
  assert.equal(intelligence.actionConfidence, 'medium');
  assert.deepEqual(intelligence.riskFlags.map((flag) => flag.code), ['human_review_pending']);
  assert.match(intelligence.nextReviewActionReason, /verified evidence is present/i);
  assert.equal(intelligence.reviewNoteSuggestion.state, 'NEEDS_REVIEW');
  assert.match(intelligence.reviewNoteSuggestion.text, /Decision: NEEDS_REVIEW/);
});

test('reviewer note templates select a data-gap follow-up note for missing review inputs', () => {
  const notes = buildReviewerNoteTemplates(strongLead({
    reviewStatus: 'NEEDS_REVIEW',
    confidence: 'MEDIUM',
    dataGaps: ['Decision owner unknown', 'Budget not published'],
  }), { now: evaluationNow });

  const followUp = notes.templates.find((template) => template.state === 'DATA_GAP');

  assert.equal(notes.current.state, 'DATA_GAP');
  assert.equal(followUp.label, '데이터 공백 확인 노트');
  assert.match(followUp.text, /Follow-up check: DATA_GAP/);
  assert.match(followUp.text, /Decision owner unknown/);
  assert.match(followUp.text, /Budget not published/);
  assert.match(notes.current.text, /Resolve data gaps/);
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
  assert.equal(intelligence.reviewNoteSuggestion.state, 'RISK_CHECK');
  assert.match(intelligence.reviewNoteSuggestion.text, /Follow-up check: RISK_CHECK/);
  assert.match(intelligence.reviewNoteSuggestion.text, /Approved review state conflicts/);
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
  assert.equal(intelligence.reviewNoteSuggestion.state, 'DATA_GAP');
  assert.match(intelligence.reviewNoteSuggestion.text, /Legacy Co/);
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
  assert.equal(ready.reviewNoteSuggestion.state, 'APPROVED');
  assert.equal(ready.reviewNoteTemplates.length, 3);
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

test('lead review session summarizes queue progress and next lead candidate', () => {
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

  const session = buildLeadReviewSession(leads, { now: evaluationNow });

  assert.equal(session.totalLeads, 5);
  assert.equal(session.visibleLeads, 5);
  assert.deepEqual(session.remainingByLane, {
    approval_candidates: 2,
    needs_evidence: 1,
    risk_review: 1,
    low_priority: 1,
  });
  assert.equal(session.approvedCount, 2);
  assert.equal(session.needsReviewCount, 2);
  assert.equal(session.reviewStatusCounts.REJECTED, 1);
  assert.deepEqual(session.filterContext, {});
  assert.equal(session.nextLead.leadId, 'approved-ready');
  assert.equal(session.nextLead.nextReviewAction, 'prepare_human_follow_up');
  assert.equal(session.nextLead.queueLane, 'approval_candidates');
  assert.equal(session.nextLead.reviewNoteSuggestion.state, 'APPROVED');
  assert.match(session.nextLead.reviewNoteSuggestion.text, /Decision: APPROVED/);
});

test('lead review session applies filters and keeps snake_case review statuses in counts', () => {
  const leads = [
    strongLead({
      id: 'legacy-needs-evidence',
      company: 'Legacy Evidence Co',
      reviewStatus: undefined,
      review_status: 'needs_review',
      verificationStatus: 'verified',
      evidence: [],
      sources: [],
      dataGaps: [],
      updated_at: '2026-05-07T00:00:00.000Z',
    }),
    strongLead({
      id: 'legacy-approved',
      company: 'Legacy Approved Co',
      reviewStatus: undefined,
      review_status: 'approved',
      updated_at: '2026-05-06T00:00:00.000Z',
    }),
  ];

  const session = buildLeadReviewSession(leads, {
    now: evaluationNow,
    filters: { queueLane: 'needs_evidence', reviewPriority: 'medium' },
  });

  assert.equal(session.totalLeads, 2);
  assert.equal(session.visibleLeads, 1);
  assert.deepEqual(session.filterContext, {
    queueLane: 'needs_evidence',
    reviewPriority: 'medium',
  });
  assert.equal(session.approvedCount, 0);
  assert.equal(session.needsReviewCount, 1);
  assert.equal(session.remainingByLane.needs_evidence, 1);
  assert.equal(session.remainingByLane.approval_candidates, 0);
  assert.equal(session.nextLead.leadId, 'legacy-needs-evidence');
  assert.equal(session.nextLead.nextReviewAction, 'verify_evidence');
});

test('lead review session reflects queue membership after review status mutation', () => {
  const lead = strongLead({
    id: 'review-ready',
    company: 'Review Ready Co',
    reviewStatus: 'NEEDS_REVIEW',
    verificationStatus: 'verified',
    confidence: 'HIGH',
  });

  const before = buildLeadReviewSession([lead], { now: evaluationNow });
  const after = buildLeadReviewSession([
    {
      ...lead,
      reviewStatus: 'APPROVED',
      verificationStatus: 'needs_review',
    },
  ], { now: evaluationNow });

  assert.equal(before.nextLead.nextReviewAction, 'decide_review_status');
  assert.equal(before.nextLead.queueLane, 'approval_candidates');
  assert.equal(before.nextLead.reviewNoteSuggestion.state, 'NEEDS_REVIEW');
  assert.equal(before.needsReviewCount, 1);
  assert.equal(after.nextLead.nextReviewAction, 'reconcile_review_conflict');
  assert.equal(after.nextLead.queueLane, 'risk_review');
  assert.equal(after.nextLead.reviewNoteSuggestion.state, 'RISK_CHECK');
  assert.equal(after.approvedCount, 1);
  assert.equal(after.needsReviewCount, 0);
});

test('reviewer workflow summary v1 aggregates local feedback without production claims', () => {
  const leads = [
    strongLead({
      id: 'approved-interested',
      company: 'Approved Interested Co',
      reviewStatus: 'APPROVED',
      confidence: 'HIGH',
      manualReviewNotes: 'Human reviewer confirmed buyer context.',
      reviewerFeedback: {
        hasFeedback: true,
        actionUsefulness: 'useful',
        outcomeLabel: 'interested',
        dataGapPriority: 'none',
        evidenceConfidenceAdjustment: 'increase',
        feedbackText: 'Useful next action for a human reviewer.',
        nextReviewerAction: 'Prepare the approved follow-up packet.',
        authorLabel: 'manual_reviewer',
        updatedAt: '2026-05-12T01:00:00.000Z',
      },
    }),
    strongLead({
      id: 'blocking-gap',
      company: 'Blocking Gap Co',
      reviewStatus: 'NEEDS_REVIEW',
      verificationStatus: 'needs_review',
      confidence: 'LOW',
      sources: [],
      evidence: [],
      reviewerFeedback: {
        hasFeedback: true,
        actionUsefulness: 'partially_useful',
        outcomeLabel: 'needs_more_research',
        dataGapPriority: 'blocking',
        evidenceConfidenceAdjustment: 'decrease',
        feedbackText: 'Need a source before this can move.',
        nextReviewerAction: 'Find public evidence for the facility signal.',
        authorLabel: 'manual_reviewer',
        updatedAt: '2026-05-12T02:00:00.000Z',
      },
    }),
    strongLead({
      id: 'duplicate-lead',
      company: 'Duplicate Co',
      reviewStatus: 'REJECTED',
      confidence: 'MEDIUM',
      reviewerFeedback: {
        hasFeedback: true,
        actionUsefulness: 'not_useful',
        outcomeLabel: 'duplicate',
        dataGapPriority: 'low',
        evidenceConfidenceAdjustment: 'unchanged',
        feedbackText: 'Same account already reviewed.',
        nextReviewerAction: 'Keep out of active review queue.',
        authorLabel: 'manual_reviewer',
        updatedAt: '2026-05-12T03:00:00.000Z',
      },
    }),
    strongLead({
      id: 'high-gap-no-feedback',
      company: 'High Gap Co',
      reviewStatus: 'NEEDS_REVIEW',
      confidence: 'LOW',
      dataGaps: ['Decision owner unknown'],
      reviewerFeedback: {
        hasFeedback: true,
        actionUsefulness: 'unclear',
        outcomeLabel: 'unknown',
        dataGapPriority: 'high',
        evidenceConfidenceAdjustment: 'unknown',
        feedbackText: '',
        nextReviewerAction: 'Confirm decision owner.',
        authorLabel: 'manual_reviewer',
        updatedAt: '2026-05-12T04:00:00.000Z',
      },
    }),
  ];

  const summary = buildReviewerWorkflowSummary(leads, { now: evaluationNow });

  assert.equal(summary.contract, 'REVIEWER_WORKFLOW_INTELLIGENCE_V1');
  assert.equal(summary.boundary.evidenceKind, 'NOT_PRODUCTION_EVIDENCE');
  assert.equal(summary.boundary.productionReady, false);
  assert.equal(summary.boundary.generatedSuggestionPersistence, false);
  assert.equal(summary.total, 4);
  assert.deepEqual(summary.reviewStatusCounts, {
    NEW: 0,
    NEEDS_REVIEW: 2,
    APPROVED: 1,
    REJECTED: 1,
    DEFERRED: 0,
  });
  assert.deepEqual(summary.confidenceBandCounts, {
    HIGH: 1,
    MEDIUM: 1,
    LOW: 2,
    UNKNOWN: 0,
  });
  assert.equal(summary.dataGapPriorityCounts.none, 1);
  assert.equal(summary.dataGapPriorityCounts.low, 1);
  assert.equal(summary.dataGapPriorityCounts.high, 1);
  assert.equal(summary.dataGapPriorityCounts.blocking, 1);
  assert.equal(summary.outcomeLabelCounts.interested, 1);
  assert.equal(summary.outcomeLabelCounts.needs_more_research, 1);
  assert.equal(summary.outcomeLabelCounts.duplicate, 1);
  assert.equal(summary.outcomeLabelCounts.unknown, 1);
  assert.equal(summary.needingHumanReview, 2);
  assert.equal(summary.blockedByMissingEvidence, 1);
  assert.equal(summary.withManualNotes, 1);
  assert.equal(summary.withReviewerFeedback, 4);
  assert.ok(summary.topReviewRisks.some((risk) => risk.code === 'missing_evidence' && risk.count >= 1));
  assert.ok(summary.suggestedQueueBuckets.some((bucket) => bucket.id === 'blocking_data_gap' && bucket.count === 2));
});

test('data gap prioritization v1 buckets reviewer feedback deterministically', () => {
  const leads = [
    strongLead({
      id: 'interested-ready',
      company: 'Interested Ready Co',
      reviewStatus: 'APPROVED',
      confidence: 'HIGH',
      manualReviewNotes: 'Reviewed human note.',
      reviewerFeedback: {
        hasFeedback: true,
        outcomeLabel: 'interested',
        dataGapPriority: 'none',
        updatedAt: '2026-05-12T01:00:00.000Z',
      },
    }),
    strongLead({
      id: 'duplicate-low',
      company: 'Duplicate Low Co',
      reviewStatus: 'REJECTED',
      confidence: 'MEDIUM',
      reviewerFeedback: {
        hasFeedback: true,
        outcomeLabel: 'duplicate',
        dataGapPriority: 'low',
        updatedAt: '2026-05-12T02:00:00.000Z',
      },
    }),
    strongLead({
      id: 'missing-evidence',
      company: 'Missing Evidence Co',
      reviewStatus: 'NEEDS_REVIEW',
      confidence: 'MEDIUM',
      sources: [],
      evidence: [],
      reviewerFeedback: {
        hasFeedback: true,
        outcomeLabel: 'unknown',
        dataGapPriority: 'medium',
        updatedAt: '2026-05-12T03:00:00.000Z',
      },
    }),
    strongLead({
      id: 'blocking-gap',
      company: 'Blocking Gap Co',
      reviewStatus: 'NEEDS_REVIEW',
      confidence: 'LOW',
      reviewerFeedback: {
        hasFeedback: true,
        outcomeLabel: 'needs_more_research',
        dataGapPriority: 'blocking',
        nextReviewerAction: 'Find source evidence.',
        updatedAt: '2026-05-12T04:00:00.000Z',
      },
    }),
  ];

  const prioritization = buildDataGapPrioritization(leads, { now: evaluationNow });

  assert.equal(prioritization.contract, 'DATA_GAP_PRIORITIZATION_V1');
  assert.equal(prioritization.boundary.evidenceKind, 'NOT_PRODUCTION_EVIDENCE');
  assert.equal(prioritization.boundary.productionReady, false);
  assert.equal(prioritization.totalLeads, 4);
  assert.equal(prioritization.items[0].leadId, 'blocking-gap');
  assert.equal(prioritization.items[0].bucket, 'blocking_data_gap');
  assert.ok(prioritization.items[0].reasons.includes('reviewer_feedback_data_gap_priority:blocking'));
  assert.equal(prioritization.items.find((item) => item.leadId === 'missing-evidence').bucket, 'missing_evidence');
  assert.equal(prioritization.items.find((item) => item.leadId === 'duplicate-low').bucket, 'closed_by_feedback');
  assert.equal(prioritization.items.find((item) => item.leadId === 'interested-ready').bucket, 'interested_follow_up_candidate');
  assert.equal(prioritization.bucketCounts.blocking_data_gap, 1);
  assert.equal(prioritization.bucketCounts.missing_evidence, 1);
  assert.equal(prioritization.bucketCounts.closed_by_feedback, 1);
  assert.equal(prioritization.bucketCounts.interested_follow_up_candidate, 1);
});
