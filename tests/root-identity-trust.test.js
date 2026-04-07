const test = require('node:test');
const assert = require('node:assert/strict');

const { applyArticleBodyTrust } = require('../article-trust');
const { mergeLeadHistory } = require('../briefing');
const { computeStableLeadId } = require('../lead-identity');
const { buildLeadAnalysisPrompt, normalizeAnalyzedLeads } = require('../qualifier');

function makeProfile() {
  return {
    id: 'fixture-profile',
    name: 'Fixture Corp',
    competitors: ['Comp A', 'Comp B'],
    products: {
      energy: ['E-Manager'],
      automation: ['A-Controller']
    },
    productKnowledge: {
      'E-Manager': { value: '에너지 원단위 관리', roi: '절감률 기반 ROI 추정' },
      'A-Controller': { value: '설비 자동화', roi: '설비 운영 최적화 기반 ROI 추정' }
    },
    globalReferences: {
      energy: [
        { client: 'Global Plant', project: 'EMS rollout', result: '전력 사용량 12% 절감' }
      ],
      automation: [
        { client: 'Smart Factory', project: 'PLC modernization', result: '라인 가동률 8% 개선' }
      ]
    },
    categoryRules: {
      energy: ['에너지', '전력', '피크'],
      automation: ['자동화', '스마트팩토리', '설비']
    },
    categoryConfig: {
      energy: {
        product: 'E-Manager',
        score: 78,
        grade: 'B',
        roi: '정량 데이터 부족 - 절감률 8~12% 예상',
        policy: '에너지 효율 규제 강화',
        pitch: '{company}에 {product} 도입을 제안합니다.'
      },
      automation: {
        product: 'A-Controller',
        score: 82,
        grade: 'A',
        roi: '정량 데이터 부족 - 절감률 6~10% 예상',
        policy: '스마트팩토리 투자 확대',
        pitch: '{company}에 {product} 도입을 제안합니다.'
      }
    }
  };
}

function makeLead(overrides = {}) {
  return {
    company: 'LG전자',
    summary: '스마트팩토리 증설 프로젝트',
    product: 'A-Controller',
    score: 82,
    grade: 'A',
    roi: '정량 데이터 부족 - 절감률 6~10% 예상',
    salesPitch: 'LG전자 공장의 자동화 기준선 정립이 필요합니다.',
    globalContext: '스마트팩토리 투자 확대',
    sources: [
      {
        title: 'LG전자, 스마트팩토리 증설 추진',
        url: 'https://example.com/news/lg-smart-factory?id=100&utm_source=rss'
      },
      {
        title: 'LG전자 증설 계획 발표',
        url: 'https://news.google.com/rss/articles/abc123'
      }
    ],
    eventType: '증설',
    ...overrides
  };
}

test('same logical lead with reordered sources preserves the same identity in history merge', () => {
  const profile = makeProfile();
  const first = mergeLeadHistory([], [makeLead()], profile, '2026-04-07T01:00:00.000Z');
  const second = mergeLeadHistory(
    first,
    [makeLead({
      sources: [
        {
          title: 'LG전자 증설 계획 발표',
          url: 'https://news.google.com/rss/articles/abc123'
        },
        {
          title: 'LG전자, 스마트팩토리 증설 추진',
          url: 'https://example.com/news/lg-smart-factory?id=100&utm_medium=email&utm_campaign=test'
        }
      ]
    })],
    profile,
    '2026-04-08T01:00:00.000Z'
  );

  assert.equal(first.length, 1);
  assert.equal(second.length, 1);
  assert.equal(second[0].id, first[0].id);
  assert.equal(second[0].status, 'NEW');
  assert.equal(second[0].createdAt, '2026-04-07T01:00:00.000Z');
  assert.equal(second[0].updatedAt, '2026-04-08T01:00:00.000Z');
});

test('same logical lead with equivalent canonical source keeps the same identity despite query-token variation', () => {
  const profile = makeProfile();
  const baseLead = makeLead({
    sources: [
      {
        title: 'LG전자, 스마트팩토리 증설 추진',
        url: 'https://example.com/news/lg-smart-factory?id=100&utm_source=rss&utm_medium=email'
      }
    ]
  });
  const variantLead = makeLead({
    sources: [
      {
        title: 'LG전자, 스마트팩토리 증설 추진',
        url: 'https://example.com/news/lg-smart-factory?utm_campaign=spring&id=100&ref=naver'
      }
    ]
  });

  assert.equal(
    computeStableLeadId(baseLead, { profileId: profile.id }),
    computeStableLeadId(variantLead, { profileId: profile.id })
  );
});

test('missing-body input does not get promoted to trusted prompt context', () => {
  const profile = makeProfile();
  const prompt = buildLeadAnalysisPrompt(profile, [
    applyArticleBodyTrust({
      title: 'LG전자, 에너지 효율 투자 검토',
      source: '연합뉴스',
      link: 'https://example.com/news/energy-missing',
      query: 'LG전자 에너지 투자',
      content: '',
      bodySource: 'missing'
    })
  ]);
  const newsSection = prompt.split('[뉴스 목록]')[1].split('[Verification - 출력 전 자체 점검]')[0];

  assert.match(newsSection, /\[본문 없음 - 제목과 키워드 기반 추론 필요\]/);
  assert.doesNotMatch(newsSection, /\[검증 본문\]/);
});

test('low-trust body input is downgraded before prompt construction', () => {
  const profile = makeProfile();
  const lowTrustSnippet = '이 텍스트는 RSS snippet이므로 신뢰 본문처럼 프롬프트에 들어가면 안 됩니다.';
  const prompt = buildLeadAnalysisPrompt(profile, [
    applyArticleBodyTrust({
      title: 'LG전자, 스마트팩토리 투자 확대',
      source: '한국경제',
      link: 'https://example.com/news/snippet-only',
      query: 'LG전자 스마트팩토리 투자',
      content: lowTrustSnippet,
      bodySource: 'feed-snippet'
    })
  ]);
  const newsSection = prompt.split('[뉴스 목록]')[1].split('[Verification - 출력 전 자체 점검]')[0];

  assert.match(newsSection, /\[본문 저신뢰 - RSS snippet 또는 요약문만 확보\]/);
  assert.doesNotMatch(newsSection, new RegExp(lowTrustSnippet));
  assert.doesNotMatch(newsSection, /\[검증 본문\]/);
});

test('company-name rejection behavior does not regress for invalid generic company labels', () => {
  const normalized = normalizeAnalyzedLeads([
    {
      company: 'A | 잘못된 회사명',
      summary: '무효 케이스',
      product: 'A-Controller',
      score: 70,
      sources: [{ title: '기사 1', url: 'https://example.com/news/1' }]
    },
    {
      company: '국내 조선업계',
      summary: '업계 일반론',
      product: 'A-Controller',
      score: 68,
      sources: [{ title: '기사 2', url: 'https://example.com/news/2' }]
    },
    {
      company: 'LG전자',
      summary: '유효 케이스',
      product: 'A-Controller',
      score: 84,
      sources: [{ title: '기사 3', url: 'https://example.com/news/3' }]
    }
  ]);

  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].company, 'LG전자');
});
