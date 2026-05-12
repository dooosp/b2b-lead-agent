import test from 'node:test';
import assert from 'node:assert/strict';

import { handleUpdateLead } from '../api/leads.js';
import { getLeadDetailPage } from '../pages/lead-detail.js';
import { getLeadsPage } from '../pages/leads.js';

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
    return this.db.execute(this.sql, this.params, 'run');
  }

  async first() {
    return this.db.execute(this.sql, this.params, 'first');
  }
}

class FakeReviewDb {
  constructor(row) {
    this.row = { ...row };
    this.statusLog = [];
  }

  prepare(sql) {
    return new FakeStatement(this, sql);
  }

  async batch(statements) {
    const snapshot = { ...this.row };
    const logSnapshot = this.statusLog.slice();
    try {
      const results = [];
      for (const statement of statements) {
        results.push(await statement.run());
      }
      return results;
    } catch (error) {
      this.row = snapshot;
      this.statusLog = logSnapshot;
      throw error;
    }
  }

  async execute(sql, params, mode) {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    if (
      normalized.startsWith('CREATE TABLE')
      || normalized.startsWith('CREATE INDEX')
      || normalized.startsWith('CREATE UNIQUE INDEX')
      || normalized.startsWith('ALTER TABLE')
    ) {
      return mode === 'first' ? null : { meta: { changes: 0 } };
    }
    if (normalized === 'SELECT * FROM leads WHERE id = ?') {
      return params[0] === this.row.id ? { ...this.row } : null;
    }
    if (normalized.startsWith('UPDATE leads SET ') && normalized.endsWith(' WHERE id = ?')) {
      const id = params[params.length - 1];
      assert.equal(id, this.row.id);
      const setClause = normalized.slice('UPDATE leads SET '.length, normalized.lastIndexOf(' WHERE id = ?'));
      const fields = setClause.split(', ').map((part) => part.split(' = ')[0]);
      fields.forEach((field, index) => {
        this.row[field] = params[index];
      });
      return { meta: { changes: 1 } };
    }
    if (normalized === 'INSERT INTO status_log (lead_id, from_status, to_status, changed_at) VALUES (?, ?, ?, ?)') {
      this.statusLog.push({
        lead_id: params[0],
        from_status: params[1],
        to_status: params[2],
        changed_at: params[3]
      });
      return { meta: { changes: 1 } };
    }
    throw new Error(`Unsupported SQL: ${normalized}`);
  }
}

function createRow(overrides = {}) {
  return {
    id: 'lead-1',
    identity_key: 'identity-1',
    profile_id: 'danfoss',
    source: 'managed',
    status: 'NEW',
    review_status: 'NEEDS_REVIEW',
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
    score_reason: '',
    urgency: 'HIGH',
    urgency_reason: '착공 직후 설비 기준선 확정 전 검토가 필요합니다.',
    buyer_role: '',
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

function patchLead(db, body) {
  const request = new Request('https://example.com/api/leads/lead-1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return handleUpdateLead(request, { DB: db }, 'lead-1');
}

test('PATCH /api/leads/:id updates reviewStatus without changing pipeline status', async () => {
  const db = new FakeReviewDb(createRow());
  const response = await patchLead(db, { reviewStatus: 'APPROVED' });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.lead.reviewStatus, 'APPROVED');
  assert.equal(payload.lead.status, 'NEW');
  assert.equal(payload.lead.generationMode, 'llm');
  assert.equal(payload.lead.verificationStatus, 'verified');
  assert.deepEqual(payload.lead.evidence, [
    { field: 'summary', quote: '데이터센터 증설 착공', sourceUrl: 'https://example.com/dl' }
  ]);
  assert.equal(payload.lead.confidence, 'MEDIUM');
  assert.equal(payload.lead.confidenceReason, '공개 기사 출처와 제목 근거가 확인되었습니다.');
  assert.deepEqual(payload.lead.assumptions, ['현장 냉각 부하 데이터는 미확인입니다.']);
  assert.deepEqual(payload.lead.dataGaps, ['상세 발주 일정 미확인']);
  assert.equal(payload.lead.eventType, '착공');
  assert.deepEqual(payload.changedFields, ['reviewStatus']);
  assert.equal(db.row.review_status, 'APPROVED');
  assert.equal(db.row.status, 'NEW');
  assert.deepEqual(db.statusLog, []);
});

test('PATCH /api/leads/:id rejects invalid reviewStatus values atomically', async () => {
  const db = new FakeReviewDb(createRow({ notes: 'keep me' }));
  const response = await patchLead(db, { reviewStatus: 'CONTACTED', notes: 'new note' });
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.match(payload.message, /reviewStatus/);
  assert.equal(db.row.review_status, 'NEEDS_REVIEW');
  assert.equal(db.row.notes, 'keep me');
});

test('lead list and detail pages render reviewStatus controls and trust metadata', () => {
  const listHtml = getLeadsPage();
  const detailHtml = getLeadDetailPage({
    id: 'lead-1',
    profileId: 'danfoss',
    status: 'NEW',
    reviewStatus: 'NEEDS_REVIEW',
    company: 'DL이앤씨',
    signal: '데이터센터 냉각 설비 증설 착공',
    summary: '데이터센터 냉각 설비 증설 착공',
    whyNow: '착공 직후 설비 기준선 확정 전 검토가 필요합니다.',
    recommendedMessage: 'DL이앤씨 데이터센터 운영팀에 냉각 효율 검증 파일럿을 제안합니다.',
    confidence: 'MEDIUM',
    assumptions: ['현장 냉각 부하 데이터는 미확인입니다.'],
    dataGaps: ['상세 발주 일정 미확인'],
    sources: [{ title: 'DL이앤씨 데이터센터 증설', url: 'https://example.com/dl' }],
    product: 'Turbocor 컴프레서',
    score: 84,
    grade: 'A'
  }, []);

  assert.match(listHtml, /reviewStatusLabels/);
  assert.match(listHtml, /updateReviewStatus/);
  assert.match(listHtml, /NEEDS_REVIEW/);
  assert.match(detailHtml, /사람 검토/);
  assert.match(detailHtml, /reviewStatus/);
  assert.match(detailHtml, /데이터 공백/);
  assert.match(detailHtml, /가정/);
  assert.match(detailHtml, /출처/);
});

test('lead review pages expose clear trust metadata display helpers', () => {
  const listHtml = getLeadsPage();
  const detailHtml = getLeadDetailPage({
    id: 'lead-1',
    profileId: 'danfoss',
    status: 'NEW',
    review_status: 'DEFERRED',
    generation_mode: 'heuristic',
    verification_status: 'needs_review',
    company: 'LG전자',
    summary: '스마트팩토리 증설 프로젝트',
    confidence: 'LOW',
    data_gaps: ['직접 인용 없음', '발주 일정 미확인'],
    evidence: [],
    sources: [],
    product: 'A-Controller',
    score: 72,
    grade: 'B'
  }, []);

  assert.match(listHtml, /function getReviewStatus\(lead\)/);
  assert.match(listHtml, /lead\.review_status/);
  assert.match(listHtml, /verificationStatusLabels/);
  assert.match(listHtml, /generationModeLabels/);
  assert.match(listHtml, /function renderReviewTrustBadges\(lead\)/);
  assert.match(listHtml, /function renderDataGapSummary\(lead\)/);
  assert.match(listHtml, /function renderEvidenceSummary\(lead\)/);

  assert.match(detailHtml, /function getReviewStatus\(lead\)/);
  assert.match(detailHtml, /lead\.review_status/);
  assert.match(detailHtml, /verificationStatusLabels/);
  assert.match(detailHtml, /generationModeLabels/);
  assert.match(detailHtml, /function renderReviewBadge\(lead\)/);
  assert.match(detailHtml, /function renderReviewTrustBadges\(lead\)/);
  assert.match(detailHtml, /function renderDataGapSummary\(lead\)/);
  assert.match(detailHtml, /function renderEvidenceSummary\(lead\)/);
});

test('lead list page exposes review queue filters for current LeadBrief fields', () => {
  const listHtml = getLeadsPage();

  assert.match(listHtml, /id="reviewQueueFilters"/);
  assert.match(listHtml, /data-filter-key="reviewStatus"/);
  assert.match(listHtml, /data-filter-key="verificationStatus"/);
  assert.match(listHtml, /data-filter-key="generationMode"/);
  assert.match(listHtml, /data-filter-key="confidence"/);
  assert.match(listHtml, /data-filter-key="dataGaps"/);
  assert.match(listHtml, /data-filter-key="gateStatus"/);
  assert.match(listHtml, /게이트 상태/);
  assert.match(listHtml, /게이트 통과/);
  assert.match(listHtml, /보강 필요/);
  assert.match(listHtml, /function applyReviewQueueFilters\(leads\)/);
  assert.match(listHtml, /function getFilteredLeads\(\)/);
  assert.match(listHtml, /function resetReviewQueueFilters\(\)/);
  assert.match(listHtml, /필터 결과가 없습니다/);
});

test('lead list page exposes evidence and data-gap review slices', () => {
  const listHtml = getLeadsPage();

  assert.match(listHtml, /function buildReviewEvidenceSlices\(leads\)/);
  assert.match(listHtml, /function renderReviewEvidenceSlices\(leads\)/);
  assert.match(listHtml, /review-slice-band/);
  assert.match(listHtml, /검토 리스크/);
  assert.match(listHtml, /근거 누락/);
  assert.match(listHtml, /데이터 공백 리드/);
  assert.match(listHtml, /검토 가능/);
  assert.match(listHtml, /does not approve outreach/);
});

test('lead list page exposes deterministic review gate summaries on cards', () => {
  const listHtml = getLeadsPage();

  assert.match(listHtml, /function buildLeadListReviewGate\(lead\)/);
  assert.match(listHtml, /function renderLeadListReviewGate\(lead\)/);
  assert.match(listHtml, /목록 품질 게이트/);
  assert.match(listHtml, /목록 게이트 통과/);
  assert.match(listHtml, /목록 게이트 보강 필요/);
  assert.match(listHtml, /This list gate does not approve outreach/);
});

test('lead list page exposes deterministic review gate summary counts', () => {
  const listHtml = getLeadsPage();

  assert.match(listHtml, /function buildReviewGateSummary\(leads\)/);
  assert.match(listHtml, /function renderReviewGateSummary\(leads\)/);
  assert.match(listHtml, /목록 게이트 요약/);
  assert.match(listHtml, /게이트 통과/);
  assert.match(listHtml, /보강 필요/);
  assert.match(listHtml, /차단/);
  assert.match(listHtml, /보류/);
  assert.match(listHtml, /This summary does not approve outreach/);
});

test('lead list kanban cards expose deterministic review gate labels', () => {
  const listHtml = getLeadsPage();

  assert.match(listHtml, /function renderKanban\(leads\)/);
  assert.match(listHtml, /buildLeadListReviewGate\(l\)\.label/);
});

test('lead detail script is isolated for list-to-detail document replacement', () => {
  const detailHtml = getLeadDetailPage({
    id: 'lead-1',
    profileId: 'danfoss',
    status: 'NEW',
    reviewStatus: 'NEEDS_REVIEW',
    company: 'DL이앤씨',
    summary: '데이터센터 냉각 설비 증설 착공',
    confidence: 'MEDIUM',
    generationMode: 'llm',
    verificationStatus: 'verified',
    dataGaps: [],
    evidence: [],
    sources: [],
    product: 'Turbocor 컴프레서',
    score: 84,
    grade: 'A'
  }, []);

  assert.match(detailHtml, /<script>\s*\(\(\) => \{/);
  assert.match(detailHtml, /window\.updateField = updateField/);
  assert.match(detailHtml, /window\.scheduleNoteSave = scheduleNoteSave/);
});
