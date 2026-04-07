import test from 'node:test';
import assert from 'node:assert/strict';

import { buildLeadPayloadRepairPrompt } from '../self-service/lead-model.js';
import { buildLeadAnalysisPrompt } from '../self-service/lead-prompt.js';
import { isValidLeadPayloadSchema } from '../self-service/lead-utils.js';

function createProfile() {
  return {
    name: 'LG전자',
    competitors: ['삼성전자'],
    productKnowledge: {
      '에너지 관리 시스템': {
        value: '에너지 비용 최적화와 피크 저감',
        roi: '전력비 절감'
      }
    },
    products: {
      energy: ['에너지 관리 시스템']
    }
  };
}

test('analysis prompt teaches optional discovery lineage without requiring fabricated canonical URLs', () => {
  const prompt = buildLeadAnalysisPrompt(createProfile(), [
    {
      source: 'Google News',
      title: 'LG전자, 공장 에너지 효율 투자 확대',
      link: 'https://news.google.com/rss/articles/CBMiT2h0dHBzOi8vZXhhbXBsZS5jb20vZ29vZ2xlLW5ld3PSAQA',
      query: 'LG전자 제조 투자'
    }
  ]);

  assert.match(prompt, /originUrl/);
  assert.match(prompt, /resolution":"direct\|unresolved/);
  assert.match(prompt, /canonical URL을 추정해 쓰지 마세요/);
});

test('repair prompt preserves richer source contract guidance', () => {
  const prompt = buildLeadPayloadRepairPrompt('{"summary":"bad"}');

  assert.match(prompt, /originUrl/);
  assert.match(prompt, /sources\[\]\.query/);
  assert.match(prompt, /sources\[\]\.resolution/);
  assert.match(prompt, /canonical URL을 꾸며내지 말 것/);
});

test('model schema accepts richer sources and legacy simple sources', () => {
  const richPayload = {
    summary: '요약',
    leads: [
      {
        company: 'LG전자',
        project_title: '스마트팩토리 에너지 효율 투자 검토',
        recommended_product: '에너지 관리 시스템',
        expected_roi: '근거 없음(추정 불가) - 공개 기사 기준 정량 데이터 부족',
        sales_pitch: '운영 데이터 통합과 에너지 기준선 정리를 제안합니다.',
        trend: '제조업 에너지 효율 투자 확대',
        sources: [
          {
            title: 'LG전자, 공장 에너지 효율 투자 확대',
            url: 'https://example.com/news/lg-energy',
            originUrl: 'https://news.google.com/rss/articles/CBMiT2h0dHBzOi8vZXhhbXBsZS5jb20vZ29vZ2xlLW5ld3PSAQA',
            query: 'LG전자 제조 투자',
            resolution: 'direct'
          }
        ]
      }
    ]
  };

  const legacyPayload = {
    summary: '요약',
    leads: [
      {
        company: 'LG전자',
        project_title: '스마트팩토리 에너지 효율 투자 검토',
        recommended_product: '에너지 관리 시스템',
        expected_roi: '근거 없음(추정 불가) - 공개 기사 기준 정량 데이터 부족',
        sales_pitch: '운영 데이터 통합과 에너지 기준선 정리를 제안합니다.',
        trend: '제조업 에너지 효율 투자 확대',
        sources: [
          {
            title: 'LG전자, 공장 에너지 효율 투자 확대',
            url: 'https://example.com/news/lg-energy'
          }
        ]
      }
    ]
  };

  assert.equal(isValidLeadPayloadSchema(richPayload), true);
  assert.equal(isValidLeadPayloadSchema(legacyPayload), true);
});
