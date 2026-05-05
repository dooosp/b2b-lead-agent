const test = require('node:test');
const assert = require('node:assert/strict');

const { prepareLeadSnapshotRecords } = require('../lead-report-publisher');

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
