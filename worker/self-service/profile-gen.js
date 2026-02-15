import { callGemini } from '../lib/gemini.js';

export async function generateProfileFromGemini(company, industry, env) {
  const prompt = `당신은 B2B 영업 전략 전문가입니다.
아래 회사 정보를 바탕으로 B2B 리드 발굴용 프로필 JSON을 생성하세요.

회사명: ${company}
산업: ${industry}

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 JSON만 출력하세요.

{
  "name": "회사 한글명",
  "industry": "산업 분야",
  "competitors": ["경쟁사1", "경쟁사2", "경쟁사3"],
  "products": {
    "category1": ["제품A", "제품B"],
    "category2": ["제품C", "제품D"]
  },
  "productKnowledge": {
    "대표 제품1": { "value": "핵심 가치", "roi": "ROI 근거" },
    "대표 제품2": { "value": "핵심 가치", "roi": "ROI 근거" }
  },
  "searchQueries": ["뉴스 검색 키워드1", "키워드2", "키워드3", "키워드4", "키워드5", "키워드6", "키워드7"],
  "categoryRules": {
    "category1": ["분류키워드1", "분류키워드2"],
    "category2": ["분류키워드3", "분류키워드4"]
  },
  "categoryConfig": {
    "category1": {
      "product": "기본 추천 제품",
      "score": 75,
      "grade": "B",
      "roi": "예상 ROI 설명",
      "policy": "관련 정책/규제",
      "pitch": "{company}에 {product}를 통한 효율 개선을 제안합니다."
    }
  }
}

주의사항:
- searchQueries는 한국어로 7개, 해당 산업의 실제 뉴스 키워드
- categoryConfig의 pitch는 반드시 {company}와 {product} 플레이스홀더 사용
- 실제 산업 지식 기반으로 현실적인 ROI 수치 제시
- competitors는 실제 경쟁사 3개`;

  const result = await callGemini(prompt, env);
  let cleaned = result.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const parsed = JSON.parse(cleaned);
  const searchQueries = (Array.isArray(parsed.searchQueries) ? parsed.searchQueries : [])
    .map(q => (typeof q === 'string' ? q.trim() : ''))
    .filter(Boolean)
    .slice(0, 7);
  const categoryConfig = parsed.categoryConfig && typeof parsed.categoryConfig === 'object'
    ? parsed.categoryConfig
    : {};

  if (searchQueries.length === 0) {
    throw new Error('프로필 생성 실패: searchQueries 누락');
  }
  if (Object.keys(categoryConfig).length === 0) {
    throw new Error('프로필 생성 실패: categoryConfig 누락');
  }

  return {
    ...parsed,
    name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim() : company,
    industry: typeof parsed.industry === 'string' && parsed.industry.trim() ? parsed.industry.trim() : industry,
    competitors: Array.isArray(parsed.competitors)
      ? parsed.competitors
          .map(c => (typeof c === 'string' ? c.trim() : ''))
          .filter(Boolean)
          .slice(0, 5)
      : [],
    searchQueries,
    categoryConfig
  };
}

export function generateHeuristicProfile(company, industry) {
  const coreProduct = `${industry} 최적화 솔루션`;
  return {
    name: company,
    industry,
    competitors: [],
    products: {
      core: [coreProduct]
    },
    productKnowledge: {
      [coreProduct]: {
        value: '운영 안정성 강화 및 에너지 효율 개선',
        roi: '운영비 10~20% 절감 가능'
      }
    },
    searchQueries: [
      `${company} ${industry} 투자`,
      `${company} ${industry} 증설`,
      `${industry} 신사업 수주`,
      `${industry} 설비 도입`,
      `${industry} 공장 착공`,
      `${industry} 자동화`,
      `${industry} 탄소중립`
    ],
    categoryRules: {
      core: [company, industry, '투자', '수주', '착공', '증설', '계약']
    },
    categoryConfig: {
      core: {
        product: coreProduct,
        score: 72,
        grade: 'B',
        roi: '운영비 10~20% 절감 예상',
        policy: '산업 전반의 에너지 효율화 및 탄소중립 정책 대응',
        pitch: '{company}의 신규 프로젝트에 {product} 기반 효율 개선을 제안합니다.'
      }
    }
  };
}
