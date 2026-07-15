import test from 'node:test';
import assert from 'node:assert/strict';

import { fetchLeads, handleExportCSV } from '../api/leads.js';
import { leadToRow, rowToLead } from '../db/transform.js';
import { normalizeReviewStatus, toLeadBriefV1 } from '../lib/leadbrief-v1.js';
import { FakeD1Database } from './helpers/fake-d1.mjs';
import { createLeadRow, createWorkerEnv } from './helpers/fixtures.mjs';
import { createWorkerRequest } from './helpers/http.mjs';

function createGithubResponse(body) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function createStoredRow(overrides = {}) {
  return createLeadRow({
    status: 'CONTACTED',
    review_status: 'APPROVED',
    company: 'DL이앤씨',
    summary: '데이터센터 냉각 설비 증설 착공',
    product: 'Turbocor 컴프레서',
    score: 84,
    grade: 'A',
    roi: '냉각 전력 20% 절감 가능성',
    sales_pitch: 'DL이앤씨 데이터센터 운영팀에 냉각 효율 검증 파일럿을 제안합니다.',
    global_context: '전력 단가 상승으로 데이터센터 냉각 효율 검증이 중요해졌습니다.',
    sources: JSON.stringify([{ title: 'DL이앤씨 데이터센터 증설', url: 'https://example.com/dl' }]),
    notes: '',
    score_reason: '착공 신호와 제품 적합도 기준',
    urgency: 'HIGH',
    urgency_reason: '착공 직후 설비 기준선 확정 전 검토가 필요합니다.',
    buyer_role: '설비 운영팀',
    evidence: JSON.stringify([{ field: 'summary', quote: '데이터센터 증설 착공', sourceUrl: 'https://example.com/dl' }]),
    confidence: 'MEDIUM',
    confidence_reason: '공개 기사 출처와 제목 근거가 확인되었습니다.',
    assumptions: JSON.stringify(['현장 냉각 부하 데이터는 미확인입니다.']),
    generation_mode: 'llm',
    verification_status: 'verified',
    data_gaps: JSON.stringify(['상세 발주 일정 미확인']),
    event_type: '착공',
    enriched_at: null,
    follow_up_date: '',
    estimated_value: 0,
    created_at: '2026-05-05T00:00:00.000Z',
    updated_at: '2026-05-05T00:00:00.000Z',
    ...overrides,
  });
}

test('LeadBrief v1 normalization maps legacy lead fields without conflating pipeline status', () => {
  const brief = toLeadBriefV1({
    id: 'lead-1',
    profileId: 'danfoss',
    status: 'CONTACTED',
    company: 'DL이앤씨',
    summary: '데이터센터 냉각 설비 증설 착공',
    salesPitch: 'DL이앤씨 데이터센터 운영팀에 냉각 효율 검증 파일럿을 제안합니다.',
    urgencyReason: '착공 직후 설비 기준선 확정 전 검토가 필요합니다.',
    sources: [{ title: 'DL이앤씨 데이터센터 증설', url: 'https://example.com/dl' }],
    evidence: [{ field: 'summary', quote: '데이터센터 증설 착공', sourceUrl: 'https://example.com/dl' }],
    confidence: 'MEDIUM',
    assumptions: ['현장 냉각 부하 데이터는 미확인입니다.'],
    dataGaps: ['상세 발주 일정 미확인'],
    verificationStatus: 'verified',
    generationMode: 'llm'
  });

  assert.equal(brief.signal, '데이터센터 냉각 설비 증설 착공');
  assert.equal(brief.recommendedMessage, 'DL이앤씨 데이터센터 운영팀에 냉각 효율 검증 파일럿을 제안합니다.');
  assert.equal(brief.whyNow, '착공 직후 설비 기준선 확정 전 검토가 필요합니다.');
  assert.equal(brief.confidence, 'MEDIUM');
  assert.equal(brief.reviewStatus, 'NEEDS_REVIEW');
  assert.equal(brief.status, 'CONTACTED');
  assert.equal(brief.verificationStatus, 'verified');
});

test('LeadBrief v1 normalization defaults conservatively when evidence or sources are missing', () => {
  const brief = toLeadBriefV1({
    company: 'LG전자',
    summary: '스마트팩토리 투자 확대',
    salesPitch: '운영 데이터 기준선 진단을 제안합니다.',
    generationMode: 'heuristic',
    verificationStatus: 'needs_review',
    confidence: ''
  });

  assert.equal(brief.confidence, 'LOW');
  assert.equal(brief.reviewStatus, 'NEEDS_REVIEW');
  assert.ok(brief.dataGaps.includes('Published source evidence missing'));
  assert.ok(brief.dataGaps.includes('Direct evidence quote missing'));
  assert.ok(brief.dataGaps.includes('Why-now rationale missing'));
});

test('LeadBrief v1 normalization defaults complete LLM leads to review-needed trust metadata', () => {
  const brief = toLeadBriefV1({
    company: 'LG전자',
    summary: '스마트팩토리 증설 프로젝트',
    salesPitch: '현장 자동화 기준선 정립을 제안합니다.',
    urgencyReason: '증설 직후 제어 표준 확정 전 검토가 필요합니다.',
    sources: [{ title: 'LG전자 증설 계획 발표', url: 'https://example.com/lg' }],
    evidence: [{ field: 'summary', quote: '스마트팩토리 증설', sourceUrl: 'https://example.com/lg' }],
    confidence: 'MEDIUM'
  });

  assert.equal(brief.reviewStatus, 'NEEDS_REVIEW');
  assert.equal(brief.generationMode, 'llm');
  assert.equal(brief.verificationStatus, 'needs_review');
  assert.deepEqual(brief.assumptions, []);
  assert.deepEqual(brief.dataGaps, []);
});

test('D1 row roundtrip preserves reviewStatus separately from sales pipeline status', () => {
  const row = createStoredRow();
  const lead = rowToLead(row);

  assert.equal(lead.status, 'CONTACTED');
  assert.equal(lead.reviewStatus, 'APPROVED');
  assert.equal(lead.signal, '데이터센터 냉각 설비 증설 착공');
  assert.equal(lead.recommendedMessage, 'DL이앤씨 데이터센터 운영팀에 냉각 효율 검증 파일럿을 제안합니다.');
  assert.equal(lead.generationMode, 'llm');
  assert.equal(lead.verificationStatus, 'verified');
  assert.deepEqual(lead.dataGaps, ['상세 발주 일정 미확인']);
  assert.deepEqual(lead.evidence, [{ field: 'summary', quote: '데이터센터 증설 착공', sourceUrl: 'https://example.com/dl' }]);

  const nextRow = leadToRow({ ...lead, status: 'MEETING', reviewStatus: 'DEFERRED' }, 'danfoss', 'managed');
  assert.equal(nextRow.status, 'MEETING');
  assert.equal(nextRow.review_status, 'DEFERRED');
  assert.equal(nextRow.generation_mode, 'llm');
  assert.equal(nextRow.verification_status, 'verified');
  assert.equal(nextRow.data_gaps, JSON.stringify(['상세 발주 일정 미확인']));
  assert.equal(nextRow.evidence, JSON.stringify([{ field: 'summary', quote: '데이터센터 증설 착공', sourceUrl: 'https://example.com/dl' }]));
});

test('/api/leads exposes LeadBrief v1 canonical fields from D1 rows', async () => {
  const row = createStoredRow();
  const env = createWorkerEnv({
    DB: new FakeD1Database({
      leads: [row],
      publishedSnapshots: [{ profileId: 'danfoss', artifactKind: 'latest', leads: [row] }],
    }),
  });

  const response = await fetchLeads(env, 'danfoss');
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.leads[0].profileId, 'danfoss');
  assert.equal(payload.leads[0].signal, '데이터센터 냉각 설비 증설 착공');
  assert.equal(payload.leads[0].whyNow, '착공 직후 설비 기준선 확정 전 검토가 필요합니다.');
  assert.equal(payload.leads[0].recommendedMessage, 'DL이앤씨 데이터센터 운영팀에 냉각 효율 검증 파일럿을 제안합니다.');
  assert.equal(payload.leads[0].reviewStatus, 'APPROVED');
  assert.equal(payload.leads[0].status, 'CONTACTED');
  assert.equal(payload.leads[0].generationMode, 'llm');
  assert.equal(payload.leads[0].verificationStatus, 'verified');
  assert.deepEqual(payload.leads[0].evidence, [
    { field: 'summary', quote: '데이터센터 증설 착공', sourceUrl: 'https://example.com/dl' }
  ]);
  assert.equal(payload.leads[0].confidence, 'MEDIUM');
  assert.equal(payload.leads[0].confidenceReason, '공개 기사 출처와 제목 근거가 확인되었습니다.');
  assert.deepEqual(payload.leads[0].assumptions, ['현장 냉각 부하 데이터는 미확인입니다.']);
  assert.deepEqual(payload.leads[0].dataGaps, ['상세 발주 일정 미확인']);
  assert.equal(payload.leads[0].eventType, '착공');
  assert.equal(payload.reviewerActionQueue.totalCount, 1);
  assert.equal(payload.reviewerActionQueue.items[0].leadId, payload.leads[0].id);
  assert.equal(payload.reviewerActionQueue.items[0].nextReviewAction, 'reconcile_review_conflict');
  assert.equal(payload.reviewerActionQueue.items[0].queueLane, 'risk_review');
  assert.equal(payload.reviewerActionQueue.summary.riskReview, 1);
});

test('/api/leads applies LeadBrief defaults to GitHub published records before serialization', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (new URL(String(url)).pathname.endsWith('/publication-manifest.json')) {
      return new Response('not found', { status: 404 });
    }
    return createGithubResponse([{
      id: 'github-lead-1',
      company: 'LG전자',
      summary: '스마트팩토리 증설 프로젝트',
      product: 'VLT AutomationDrive',
      score: 82,
      grade: 'A',
      salesPitch: '현장 자동화 기준선 정립을 제안합니다.',
      urgencyReason: '증설 직후 제어 표준 확정 전 검토가 필요합니다.',
      sources: [{ title: 'LG전자 증설 계획 발표', url: 'https://example.com/lg' }],
      evidence: [{ field: 'summary', quote: '스마트팩토리 증설', sourceUrl: 'https://example.com/lg' }],
      confidence: 'MEDIUM',
      confidenceReason: '공개 기사 출처가 확인되었습니다.',
      eventType: '증설'
    }]);
  };

  try {
    const response = await fetchLeads({
      GITHUB_REPO: 'dooosp/b2b-lead-agent',
      PROFILES: JSON.stringify([{ id: 'danfoss', name: 'Danfoss' }])
    }, 'danfoss');
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.source, 'github');
    assert.equal(payload.leads[0].reviewStatus, 'NEEDS_REVIEW');
    assert.equal(payload.leads[0].generationMode, 'llm');
    assert.equal(payload.leads[0].verificationStatus, 'needs_review');
    assert.deepEqual(payload.leads[0].assumptions, []);
    assert.deepEqual(payload.leads[0].dataGaps, []);
    assert.deepEqual(payload.leads[0].evidence, [
      { field: 'summary', quote: '스마트팩토리 증설', sourceUrl: 'https://example.com/lg' }
    ]);
    assert.equal(payload.leads[0].confidence, 'MEDIUM');
    assert.equal(payload.leads[0].confidenceReason, '공개 기사 출처가 확인되었습니다.');
    assert.equal(payload.leads[0].eventType, '증설');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('CSV export includes reviewStatus and trust metadata without dropping pipeline status', async () => {
  const env = createWorkerEnv({ DB: new FakeD1Database({ leads: [createStoredRow()] }) });
  const request = createWorkerRequest('/api/export/csv?profile=danfoss');

  const response = await handleExportCSV(request, env);
  const csv = await response.text();

  assert.equal(response.status, 200);
  assert.match(csv.split('\n')[0], /상태,메모,생성일,검토상태,신뢰도,검증상태,생성모드,데이터공백/);
  assert.match(csv, /CONTACTED/);
  assert.match(csv, /APPROVED/);
  assert.match(csv, /MEDIUM/);
  assert.match(csv, /verified/);
  assert.match(csv, /llm/);
  assert.match(csv, /상세 발주 일정 미확인/);
});

test('review status normalization accepts only the frozen state machine', () => {
  assert.equal(normalizeReviewStatus('approved'), 'APPROVED');
  assert.equal(normalizeReviewStatus('needs_review'), 'NEEDS_REVIEW');
  assert.equal(normalizeReviewStatus('CONTACTED'), 'NEEDS_REVIEW');
  assert.equal(normalizeReviewStatus(''), 'NEEDS_REVIEW');
});
