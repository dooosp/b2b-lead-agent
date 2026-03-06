import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSelfServiceSchemaPayloadWorker,
  isValidLeadPayloadSchema,
  normalizeCompanyNameWorker,
  toSchemaLeadWorker
} from '../self-service/lead-utils.js';

test('normalizeCompanyNameWorker strips noisy prefixes', () => {
  assert.equal(normalizeCompanyNameWorker('A | LG전자', ''), 'LG전자');
  assert.equal(normalizeCompanyNameWorker('B. 현대건설', ''), '현대건설');
});

test('toSchemaLeadWorker keeps only contract fields', () => {
  const lead = toSchemaLeadWorker({
    company: '한국동서발전',
    score: 78,
    project_title: '캠퍼스 에너지효율화 운영 협약 체결',
    recommended_product: '보일러',
    expected_roi: '연간 연료비 10% 절감 가능',
    sales_pitch: '고효율 설비 개선안을 제안합니다.',
    trend: '공공기관 에너지 효율 정책 강화',
    sources: [{ title: '기사', url: 'https://example.com/news' }],
    summary: 'ignored'
  });

  assert.deepEqual(Object.keys(lead), [
    'company',
    'score',
    'grade',
    'project_title',
    'recommended_product',
    'expected_roi',
    'sales_pitch',
    'trend',
    'sources'
  ]);
});

test('createSelfServiceSchemaPayloadWorker filters invalid leads and preserves summary', () => {
  const payload = createSelfServiceSchemaPayloadWorker([
    {
      company: '한국동서발전',
      score: 78,
      project_title: '캠퍼스 에너지효율화 운영 협약 체결',
      recommended_product: '보일러',
      expected_roi: '연간 연료비 10% 절감 가능',
      sales_pitch: '고효율 설비 개선안을 제안합니다.',
      trend: '공공기관 에너지 효율 정책 강화',
      sources: [{ title: '기사', url: 'https://example.com/news' }]
    },
    {
      company: 'A | 잘못된 회사명',
      score: 'bad',
      project_title: '',
      recommended_product: '',
      expected_roi: '',
      sales_pitch: '',
      trend: '',
      sources: []
    }
  ], '요약');

  assert.equal(payload.summary, '요약');
  assert.equal(payload.leads.length, 1);
  assert.equal(payload.leads[0].company, '한국동서발전');
  assert.equal(payload.leads[0].grade, 'B');
});

test('model payload validation allows empty sources and omits score', () => {
  const payload = {
    summary: '요약',
    leads: [
      {
        company: 'LG전자',
        project_title: '스마트팩토리 운영 효율화 검토',
        recommended_product: 'Desigo CC',
        expected_roi: '근거 없음 - 공개 기사 기준 정량 데이터 부족',
        sales_pitch: '운영 데이터 통합과 설비 최적화를 함께 제안합니다.',
        trend: '제조업 에너지 효율 투자 확대',
        sources: []
      }
    ]
  };

  assert.equal(isValidLeadPayloadSchema(payload), true);
});
