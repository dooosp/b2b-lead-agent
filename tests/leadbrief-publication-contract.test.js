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
    sourceIds: ['A1'],
    sources: [{
      sourceId: 'A1',
      title: 'DL이앤씨 데이터센터 증설',
      url: 'https://example.com/dl',
      source: 'Synthetic News',
      query: '데이터센터 증설',
      publishedAt: '2026-05-04T09:00:00.000Z',
      originUrl: '',
      resolution: 'direct',
      contentAvailable: true,
    }],
    evidence: [{ field: 'summary', quote: '데이터센터 증설 착공', sourceUrl: 'https://example.com/dl' }],
    confidence: 'MEDIUM',
    confidenceReason: 'Fresh source and bound evidence are present.',
    assumptions: ['현장 냉각 부하 데이터는 미확인입니다.'],
    dataGaps: ['상세 발주 일정 미확인'],
    generationMode: 'llm',
    verificationStatus: 'verified',
    eventType: '착공',
    ...overrides
  };
}

test('published snapshot records use the exact public LeadBrief allowlist and system-owned metadata', () => {
  const [record] = prepareLeadSnapshotRecords([createLead({
    id: 'model-id',
    profileId: 'model-profile',
    status: 'CONTACTED',
    reviewStatus: 'APPROVED',
    timestamp: 'MODEL_TIMESTAMP',
    createdAt: '1999-01-01T00:00:00.000Z',
    updatedAt: '2099-01-01T00:00:00.000Z',
    arbitraryModelMetadata: { token: 'FAKE_ARBITRARY_TOKEN' },
  })], {
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
  assert.equal(record.createdAt, '2026-05-05T00:00:00.000Z');
  assert.equal(record.updatedAt, '2026-05-05T00:00:00.000Z');
  assert.equal(record.confidence, 'MEDIUM');
  assert.equal(record.verificationStatus, 'verified');
  assert.deepEqual(record.assumptions, ['현장 냉각 부하 데이터는 미확인입니다.']);
  assert.deepEqual(record.dataGaps, ['상세 발주 일정 미확인']);
  assert.deepEqual(Object.keys(record).sort(), [
    'assumptions',
    'company',
    'confidence',
    'confidenceReason',
    'createdAt',
    'dataGaps',
    'eventType',
    'evidence',
    'generationMode',
    'globalContext',
    'grade',
    'id',
    'product',
    'profileId',
    'recommendedMessage',
    'reviewStatus',
    'roi',
    'salesPitch',
    'score',
    'signal',
    'sources',
    'status',
    'summary',
    'updatedAt',
    'verificationStatus',
    'whyNow',
  ].sort());
  assert.equal(Object.hasOwn(record, 'sourceIds'), false);
  assert.equal(Object.hasOwn(record, 'timestamp'), false);
  assert.equal(Object.hasOwn(record, 'arbitraryModelMetadata'), false);
  assert.doesNotMatch(JSON.stringify(record), /MODEL_|FAKE_ARBITRARY_TOKEN/);
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

test('published snapshots recursively omit private, generated, and unknown fields', () => {
  const [record] = prepareLeadSnapshotRecords([createLead({
    notes: 'Manual note body must not publish.',
    manualReviewNotes: 'Manual review note alias must not publish.',
    manual_review_notes: 'Snake manual note must not publish.',
    manualReviewNotesUpdatedAt: '2026-05-31T00:00:00.000Z',
    manualReviewNotesAuthorLabel: 'manual_reviewer',
    manualReviewNotesHistoryEventCount: 1,
    reviewerFeedback: {
      feedbackText: 'Reviewer feedback must not publish.',
      nextReviewerAction: 'Reviewer next action must not publish.',
    },
    reviewerFeedbackHistoryEventCount: 1,
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
    modelMetadata: { credentials: { token: 'Nested top-level token must not publish.' } },
    sources: [{
      ...createLead().sources[0],
      credentials: { token: 'Nested source token must not publish.' },
    }],
    evidence: [{
      ...createLead().evidence[0],
      credentials: { token: 'Nested evidence token must not publish.' },
    }],
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
    'reviewerFeedback',
    'reviewerFeedbackHistoryEventCount',
    'reviewNoteSuggestion',
    'reviewNoteTemplates',
    'providerInput',
    'rawSessionClaims',
    'authHeader',
    'token',
    'modelMetadata',
  ]) {
    assert.equal(Object.hasOwn(record, field), false, `${field} should not publish`);
  }
  assert.deepEqual(Object.keys(record.sources[0]).sort(), [
    'contentAvailable', 'originUrl', 'publishedAt', 'query', 'resolution', 'source', 'sourceId', 'title', 'url'
  ]);
  assert.deepEqual(Object.keys(record.evidence[0]).sort(), ['field', 'quote', 'sourceUrl']);
  assert.doesNotMatch(serialized, /Manual note body|manual_reviewer|Reviewer feedback|Reviewer next action|Generated suggestion|Generated template|Raw provider input|Raw session token|raw auth header|Raw token|Nested .* token/);
});

test('lead history merge drops stale protected manual-note fields from existing history', () => {
  const history = mergeLeadHistory([
    {
      id: 'lead-history-private-fields',
      company: 'DL이앤씨',
      summary: '데이터센터 냉각 설비 증설 착공',
      notes: 'Existing history note body must not remain.',
      manualReviewNotesAuthorLabel: 'manual_reviewer',
      reviewerFeedback: { feedbackText: 'Existing reviewer feedback must not remain.' },
      reviewNoteSuggestion: { text: 'Existing generated suggestion must not remain.' },
      providerInput: 'Existing provider input must not remain.',
      rawSessionClaims: { token: 'Existing raw session must not remain.' },
      createdAt: '2026-05-01T00:00:00.000Z',
    },
    {
      id: 'legacy-unmatched-record',
      profileId: 'danfoss',
      status: 'NEW',
      company: 'Legacy Corp',
      summary: 'Legacy unmatched lead',
      sources: [{
        title: 'Legacy source',
        url: 'https://example.com/legacy',
        publishedAt: '2026-05-01T00:00:00.000Z',
        credentials: { token: 'Legacy nested source token' },
      }],
      evidence: [{
        field: 'summary',
        quote: 'Legacy evidence',
        sourceUrl: 'https://example.com/legacy',
        credentials: { token: 'Legacy nested evidence token' },
      }],
      arbitraryHistoryMetadata: { token: 'Legacy arbitrary token' },
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
    },
  ], [createLead()], {
    now: '2026-05-05T00:00:00.000Z',
    profileId: 'danfoss',
  });
  const record = history.find((item) => item.company === 'DL이앤씨');
  const legacyRecord = history.find((item) => item.id === 'legacy-unmatched-record');
  const serialized = JSON.stringify(history);

  assert.equal(Object.hasOwn(record, 'notes'), false);
  assert.equal(Object.hasOwn(record, 'manualReviewNotesAuthorLabel'), false);
  assert.equal(Object.hasOwn(record, 'reviewerFeedback'), false);
  assert.equal(Object.hasOwn(record, 'reviewNoteSuggestion'), false);
  assert.equal(Object.hasOwn(record, 'providerInput'), false);
  assert.equal(Object.hasOwn(record, 'rawSessionClaims'), false);
  assert.equal(Object.hasOwn(legacyRecord, 'arbitraryHistoryMetadata'), false);
  assert.deepEqual(Object.keys(legacyRecord.sources[0]).sort(), [
    'contentAvailable', 'originUrl', 'publishedAt', 'query', 'resolution', 'source', 'sourceId', 'title', 'url'
  ]);
  assert.deepEqual(Object.keys(legacyRecord.evidence[0]).sort(), ['field', 'quote', 'sourceUrl']);
  assert.doesNotMatch(serialized, /Existing history note body|manual_reviewer|Existing reviewer feedback|Existing generated suggestion|Existing provider input|Existing raw session|Legacy nested|Legacy arbitrary/);
});
