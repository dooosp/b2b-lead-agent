const test = require('node:test');
const assert = require('node:assert/strict');

const { mergeLeadHistory, prepareLeadSnapshotRecords } = require('../lead-report-publisher');

function createLead(overrides = {}) {
  return {
    company: 'DL이앤씨',
    summary: '데이터센터 냉각 설비 증설 착공',
    product: 'Turbocor 컴프레서',
    score: 84,
    grade: 'A',
    roi: '냉각 전력 20% 절감 가능성',
    salesPitch: 'DL이앤씨 데이터센터 운영팀에 냉각 효율 검증 파일럿을 제안합니다.',
    globalContext: '전력 단가 상승으로 데이터센터 냉각 효율 검증이 중요해졌습니다.',
    urgencyReason: '착공 직후 설비 기준선 확정 전 검토가 필요합니다.',
    sources: [{ title: 'DL이앤씨 데이터센터 증설', url: 'https://example.com/dl' }],
    evidence: [{ field: 'summary', quote: '데이터센터 증설 착공', sourceUrl: 'https://example.com/dl' }],
    confidence: 'MEDIUM',
    assumptions: ['현장 냉각 부하 데이터는 미확인입니다.'],
    dataGaps: ['상세 발주 일정 미확인'],
    generationMode: 'llm',
    verificationStatus: 'verified',
    ...overrides
  };
}

test('published snapshot records include LeadBrief v1 canonical review fields', () => {
  const [record] = prepareLeadSnapshotRecords([createLead()], {
    now: '2026-05-05T00:00:00.000Z',
    profileId: 'danfoss',
    idFactory: () => 'lead-1'
  });

  assert.equal(record.id, 'lead-1');
  assert.equal(record.profileId, 'danfoss');
  assert.equal(record.signal, '데이터센터 냉각 설비 증설 착공');
  assert.equal(record.whyNow, '착공 직후 설비 기준선 확정 전 검토가 필요합니다.');
  assert.equal(record.recommendedMessage, 'DL이앤씨 데이터센터 운영팀에 냉각 효율 검증 파일럿을 제안합니다.');
  assert.equal(record.reviewStatus, 'NEEDS_REVIEW');
  assert.equal(record.status, 'NEW');
  assert.equal(record.confidence, 'MEDIUM');
  assert.deepEqual(record.assumptions, ['현장 냉각 부하 데이터는 미확인입니다.']);
  assert.deepEqual(record.dataGaps, ['상세 발주 일정 미확인']);
});

test('published heuristic snapshot stays non-approved and review-needed', () => {
  const [record] = prepareLeadSnapshotRecords([createLead({
    generationMode: 'heuristic',
    verificationStatus: 'needs_review',
    confidence: 'LOW',
    evidence: [],
    reviewStatus: 'APPROVED'
  })], {
    now: '2026-05-05T00:00:00.000Z',
    profileId: 'danfoss',
    idFactory: () => 'lead-heuristic'
  });

  assert.equal(record.generationMode, 'heuristic');
  assert.equal(record.verificationStatus, 'needs_review');
  assert.equal(record.reviewStatus, 'NEEDS_REVIEW');
  assert.ok(record.dataGaps.includes('LLM lead qualification not completed'));
  assert.ok(record.dataGaps.includes('Direct evidence quote missing'));
});

test('published snapshots omit manual-note and generated-suggestion fields', () => {
  const [record] = prepareLeadSnapshotRecords([createLead({
    notes: 'Manual note body must not publish.',
    manualReviewNotes: 'Manual review note alias must not publish.',
    manual_review_notes: 'Snake manual note must not publish.',
    manualReviewNotesUpdatedAt: '2026-05-31T00:00:00.000Z',
    manualReviewNotesAuthorLabel: 'manual_reviewer',
    manualReviewNotesHistoryEventCount: 1,
    reviewNoteSuggestion: {
      text: 'Generated suggestion must not publish.',
    },
    reviewNoteTemplates: [
      { text: 'Generated template must not publish.' },
    ],
    providerInput: 'Raw provider input must not publish.',
    rawSessionClaims: { token: 'Raw session token must not publish.' },
    authHeader: 'Bearer raw auth header must not publish.',
    token: 'Raw token must not publish.',
  })], {
    now: '2026-05-05T00:00:00.000Z',
    profileId: 'danfoss',
    idFactory: () => 'lead-private-fields'
  });

  const serialized = JSON.stringify(record);

  for (const field of [
    'notes',
    'manualReviewNotes',
    'manual_review_notes',
    'manualReviewNotesUpdatedAt',
    'manualReviewNotesAuthorLabel',
    'manualReviewNotesHistoryEventCount',
    'reviewNoteSuggestion',
    'reviewNoteTemplates',
    'providerInput',
    'rawSessionClaims',
    'authHeader',
    'token',
  ]) {
    assert.equal(Object.hasOwn(record, field), false, `${field} should not publish`);
  }
  assert.doesNotMatch(serialized, /Manual note body|manual_reviewer|Generated suggestion|Generated template|Raw provider input|Raw session token|raw auth header|Raw token/);
});

test('lead history merge drops stale protected manual-note fields from existing history', () => {
  const history = mergeLeadHistory([
    {
      id: 'lead-history-private-fields',
      company: 'DL이앤씨',
      summary: '데이터센터 냉각 설비 증설 착공',
      notes: 'Existing history note body must not remain.',
      manualReviewNotesAuthorLabel: 'manual_reviewer',
      reviewNoteSuggestion: { text: 'Existing generated suggestion must not remain.' },
      providerInput: 'Existing provider input must not remain.',
      rawSessionClaims: { token: 'Existing raw session must not remain.' },
      createdAt: '2026-05-01T00:00:00.000Z',
    },
  ], [createLead()], {
    now: '2026-05-05T00:00:00.000Z',
    profileId: 'danfoss',
  });
  const [record] = history;
  const serialized = JSON.stringify(record);

  assert.equal(Object.hasOwn(record, 'notes'), false);
  assert.equal(Object.hasOwn(record, 'manualReviewNotesAuthorLabel'), false);
  assert.equal(Object.hasOwn(record, 'reviewNoteSuggestion'), false);
  assert.equal(Object.hasOwn(record, 'providerInput'), false);
  assert.equal(Object.hasOwn(record, 'rawSessionClaims'), false);
  assert.doesNotMatch(serialized, /Existing history note body|manual_reviewer|Existing generated suggestion|Existing provider input|Existing raw session/);
});
