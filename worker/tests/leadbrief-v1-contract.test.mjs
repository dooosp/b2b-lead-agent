import test from 'node:test';
import assert from 'node:assert/strict';

import { fetchLeads, handleExportCSV } from '../api/leads.js';
import { leadToRow, rowToLead } from '../db/transform.js';
import { normalizeReviewStatus, toLeadBriefV1 } from '../lib/leadbrief-v1.js';

class FakeStatement {
  constructor(db, sql, params = []) {
    this.db = db;
    this.sql = sql;
    this.params = params;
  }

  bind(...params) {
    return new FakeStatement(this.db, this.sql, params);
  }

  async run() {
    return { meta: { changes: 0 } };
  }

  async all() {
    const normalized = this.sql.replace(/\s+/g, ' ').trim();
    if (normalized === 'SELECT * FROM leads WHERE profile_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?') {
      const [profileId, limit, offset] = this.params;
      return {
        results: this.db.rows
          .filter((row) => row.profile_id === profileId)
          .slice(offset, offset + limit)
          .map((row) => ({ ...row }))
      };
    }
    return { results: [] };
  }
}

class FakeLeadDb {
  constructor(rows = []) {
    this.rows = rows;
  }

  prepare(sql) {
    return new FakeStatement(this, sql);
  }

  async batch(statements) {
    return Promise.all(statements.map((statement) => statement.run()));
  }
}

function createStoredRow(overrides = {}) {
  return {
    id: 'lead-1',
    identity_key: 'identity-1',
    profile_id: 'danfoss',
    source: 'managed',
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
    ...overrides
  };
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
  const env = {
    DB: new FakeLeadDb([createStoredRow()]),
    GITHUB_REPO: 'dooosp/b2b-lead-agent',
    PROFILES: JSON.stringify([{ id: 'danfoss', name: 'Danfoss' }])
  };

  const response = await fetchLeads(env, 'danfoss');
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.leads[0].profileId, 'danfoss');
  assert.equal(payload.leads[0].signal, '데이터센터 냉각 설비 증설 착공');
  assert.equal(payload.leads[0].whyNow, '착공 직후 설비 기준선 확정 전 검토가 필요합니다.');
  assert.equal(payload.leads[0].recommendedMessage, 'DL이앤씨 데이터센터 운영팀에 냉각 효율 검증 파일럿을 제안합니다.');
  assert.equal(payload.leads[0].reviewStatus, 'APPROVED');
  assert.equal(payload.leads[0].status, 'CONTACTED');
});

test('CSV export includes reviewStatus and trust metadata without dropping pipeline status', async () => {
  const env = {
    DB: new FakeLeadDb([createStoredRow()]),
    PROFILES: JSON.stringify([{ id: 'danfoss', name: 'Danfoss' }])
  };
  const request = new Request('https://example.com/api/export/csv?profile=danfoss');

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
