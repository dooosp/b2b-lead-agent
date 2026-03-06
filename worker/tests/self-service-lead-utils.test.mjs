import test from 'node:test';
import assert from 'node:assert/strict';
import { articleMentionsTargetCompany, filterArticlesForTargetCompany, generateQuickLeadsWorker } from '../self-service/analyze.js';
import {
  chooseProductForArticle,
  createSelfServiceSchemaPayloadWorker,
  isValidLeadPayloadSchema,
  isKnownProfileProduct,
  normalizeSalesPitchText,
  normalizeTrendText,
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
        expected_roi: '근거 없음(추정 불가) - 공개 기사 기준 정량 데이터 부족',
        sales_pitch: '운영 데이터 통합과 설비 최적화를 함께 제안합니다.',
        trend: '제조업 에너지 효율 투자 확대',
        sources: []
      }
    ]
  };

  assert.equal(isValidLeadPayloadSchema(payload), true);
});

test('response schema normalizes ROI into allowed formats', () => {
  const payload = createSelfServiceSchemaPayloadWorker([
    {
      company: 'LG전자',
      score: 82,
      project_title: '스마트팩토리 운영 효율화 검토',
      recommended_product: 'Desigo CC',
      expected_roi: '정량 데이터 부족',
      sales_pitch: '운영 데이터 통합과 설비 최적화를 함께 제안합니다.',
      trend: '제조업 에너지 효율 투자 확대',
      sources: []
    }
  ], '요약');

  assert.match(payload.leads[0].expected_roi, /^근거 없음\(추정 불가\)/);
});

test('target company filter removes unrelated articles', () => {
  const articles = [
    { title: 'LG전자, 공장 에너지 효율 투자 확대', query: 'LG전자 제조 투자', link: 'https://example.com/1' },
    { title: '현대차, 신사업 투자 발표', query: '자동차 투자', link: 'https://example.com/2' }
  ];
  const filtered = filterArticlesForTargetCompany(articles, 'LG전자');

  assert.equal(filtered.length, 1);
  assert.equal(articleMentionsTargetCompany(filtered[0], 'LG전자'), true);
});

test('quick leads use target company when article matches target', () => {
  const leads = generateQuickLeadsWorker([
    {
      title: 'LG전자, 스마트팩토리 에너지 효율 개선 투자',
      query: 'LG전자 제조 투자',
      link: 'https://example.com/1'
    }
  ], {
    name: 'LG전자',
    categoryConfig: {
      core: {
        product: 'Desigo CC',
        score: 72,
        roi: '정량 데이터 부족',
        policy: '제조업 에너지 효율 투자 확대',
        pitch: '{company}에 {product} 도입을 제안합니다.'
      }
    },
    categoryRules: { core: ['LG전자', '투자'] }
  }, 'LG전자');

  assert.equal(leads.length, 1);
  assert.equal(leads[0].company, 'LG전자');
});

test('chooseProductForArticle prefers category-matched product', () => {
  const profile = {
    products: {
      automation: ['공장 자동화 플랫폼'],
      energy: ['에너지 관리 시스템']
    },
    productKnowledge: {
      '공장 자동화 플랫폼': { value: '라인 제어와 품질 안정화', roi: '생산성 개선' },
      '에너지 관리 시스템': { value: '에너지 비용 최적화와 피크 저감', roi: '전력비 절감' }
    },
    categoryRules: {
      automation: ['스마트팩토리', '생산라인'],
      energy: ['전력', '에너지', '효율']
    },
    categoryConfig: {
      automation: { product: '공장 자동화 플랫폼' },
      energy: { product: '에너지 관리 시스템' }
    }
  };

  const product = chooseProductForArticle(profile, {
    title: 'LG전자, 스마트팩토리 생산라인 고도화 투자',
    query: 'LG전자 스마트팩토리 생산라인'
  }, 'automation');

  assert.equal(product, '공장 자동화 플랫폼');
  assert.equal(isKnownProfileProduct(profile, product), true);
});

test('normalizeSalesPitchText replaces marketing copy with project-facing pitch', () => {
  const normalized = normalizeSalesPitchText(
    '경쟁사 대비 압도적인 화질과 몰입감을 제공하는 OLED TV로 고객에게 최고의 시청 경험을 선사합니다.',
    {
      company: 'LG전자',
      product: '에너지 관리 시스템',
      projectTitle: '스마트팩토리 에너지 효율 개선 투자',
      industry: '제조',
      article: { title: 'LG전자, 스마트팩토리 에너지 효율 개선 투자' },
      eventType: '투자'
    }
  );

  assert.match(normalized, /스마트팩토리 에너지 효율 개선 투자/);
  assert.match(normalized, /에너지 관리 시스템/);
  assert.doesNotMatch(normalized, /최고의 시청 경험|압도적인 화질/);
});

test('normalizeTrendText replaces generic trend with industry-specific context', () => {
  const normalized = normalizeTrendText('프리미엄 TV 시장 성장, OLED TV 수요 증가', {
    industry: '제조',
    eventType: '투자',
    article: { title: 'LG전자, 스마트팩토리 투자 확대' }
  });

  assert.match(normalized, /제조/);
  assert.match(normalized, /신규 투자와 설비 확장/);
  assert.doesNotMatch(normalized, /프리미엄 TV 시장 성장/);
});
