import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLegacyProductKnowledge, getProductKnowledgeEntry, formatProductKnowledgeLines } from '../self-service/product-knowledge.js';
import { chooseProductForArticle } from '../self-service/lead-utils.js';

test('buildLegacyProductKnowledge creates backward-compatible value and roi map', () => {
  const legacy = buildLegacyProductKnowledge({
    '빌딩 통합관제 플랫폼': {
      aliases: ['BMS 운영 플랫폼'],
      useCases: ['설비 통합 관제'],
      businessOutcomes: ['운영 효율 개선'],
      roiDrivers: ['운영 인력 효율화', '장애 대응 시간 단축']
    }
  });

  assert.deepEqual(legacy['빌딩 통합관제 플랫폼'], {
    value: '설비 통합 관제, 운영 효율 개선',
    roi: '운영 인력 효율화, 장애 대응 시간 단축'
  });
  assert.deepEqual(legacy['BMS 운영 플랫폼'], legacy['빌딩 통합관제 플랫폼']);
});

test('getProductKnowledgeEntry resolves aliases from productKnowledgeGraph', () => {
  const entry = getProductKnowledgeEntry({
    productKnowledgeGraph: {
      'ESS + 태양광 인버터': {
        aliases: ['ESS(에너지저장장치)'],
        painsSolved: ['전력 피크 부담']
      }
    }
  }, 'ESS(에너지저장장치)');

  assert.equal(entry.name, 'ESS + 태양광 인버터');
  assert.deepEqual(entry.painsSolved, ['전력 피크 부담']);
});

test('formatProductKnowledgeLines summarizes structured product graph for prompts', () => {
  const lines = formatProductKnowledgeLines({
    productKnowledgeGraph: {
      'Desigo CC': {
        targetIndustries: ['빌딩', '오피스'],
        useCases: ['통합 BMS 구축'],
        painsSolved: ['설비 시스템 분절'],
        businessOutcomes: ['에너지 절감'],
        roiDrivers: ['운영 인력 30% 절감']
      }
    }
  });

  assert.match(lines, /Desigo CC/);
  assert.match(lines, /통합 BMS 구축/);
  assert.match(lines, /운영 인력 30% 절감/);
});

test('chooseProductForArticle scores graph terms beyond legacy value and roi', () => {
  const profile = {
    products: {
      building: ['빌딩 통합관제 플랫폼'],
      energy: ['에너지 최적화 솔루션']
    },
    categoryRules: {
      building: ['빌딩', '관제'],
      energy: ['에너지', '피크']
    },
    categoryConfig: {
      building: { product: '빌딩 통합관제 플랫폼' }
    },
    productKnowledgeGraph: {
      '빌딩 통합관제 플랫폼': {
        targetIndustries: ['빌딩'],
        useCases: ['설비 통합 관제'],
        painsSolved: ['설비 시스템 분절'],
        businessOutcomes: ['운영 효율 개선']
      },
      '에너지 최적화 솔루션': {
        targetIndustries: ['빌딩'],
        useCases: ['피크 관리'],
        painsSolved: ['전력비 증가'],
        businessOutcomes: ['에너지 비용 절감']
      }
    },
    productKnowledge: buildLegacyProductKnowledge({
      '빌딩 통합관제 플랫폼': {
        targetIndustries: ['빌딩'],
        useCases: ['설비 통합 관제'],
        businessOutcomes: ['운영 효율 개선'],
        roiDrivers: ['운영비 절감']
      },
      '에너지 최적화 솔루션': {
        targetIndustries: ['빌딩'],
        useCases: ['피크 관리'],
        businessOutcomes: ['에너지 비용 절감'],
        roiDrivers: ['전기요금 절감']
      }
    })
  };

  const selected = chooseProductForArticle(profile, {
    title: '신규 오피스 빌딩에서 설비 통합 관제 플랫폼 도입 검토',
    query: '빌딩 관제 통합',
    _body: '설비 시스템 분절을 줄이기 위해 통합 관제 검토가 진행된다.'
  }, 'building');

  assert.equal(selected, '빌딩 통합관제 플랫폼');
});
