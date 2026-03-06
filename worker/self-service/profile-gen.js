import { callGemini } from '../lib/gemini.js';

const SOLUTION_BLUEPRINTS = Object.freeze([
  {
    match: /(제조|공장|반도체|배터리|전자|자동차|화학|철강|식품)/,
    products: {
      automation: ['스마트팩토리 운영 플랫폼', '설비 예지보전 솔루션'],
      energy: ['산업 에너지 관리 시스템']
    },
    productKnowledge: {
      '스마트팩토리 운영 플랫폼': {
        value: '생산라인 운영 표준화와 설비 가동 데이터 통합',
        roi: '정지시간 감소와 생산성 개선 검증에 적합'
      },
      '설비 예지보전 솔루션': {
        value: '설비 이상 징후 조기 탐지와 유지보수 우선순위 정렬',
        roi: '정지시간과 긴급 유지보수 비용 절감에 적합'
      },
      '산업 에너지 관리 시스템': {
        value: '전력 사용량, 피크 부하, 설비별 에너지 원단위 가시화',
        roi: '에너지 비용 절감과 ESG 대응 검증에 적합'
      }
    },
    categoryRules: {
      automation: ['스마트팩토리', '생산라인', '공장', '자동화', '증설', '투자'],
      energy: ['전력', '에너지', '효율', '탄소', '전력비', 'RE100']
    },
    categoryConfig: {
      automation: {
        product: '스마트팩토리 운영 플랫폼',
        score: 76,
        grade: 'B',
        roi: '근거 없음(추정 불가) - 생산성 및 정지시간 데이터 확보 후 투자회수 기간 산정 가능',
        policy: '제조 운영 표준화와 설비 데이터 통합 요구 확대',
        pitch: '{company}의 신규 투자/증설 이슈에 맞춰 {product} 기반 운영 표준화와 설비 데이터 통합을 제안합니다.'
      },
      energy: {
        product: '산업 에너지 관리 시스템',
        score: 74,
        grade: 'B',
        roi: '근거 없음(추정 불가) - 최근 12개월 에너지 사용량 확보 후 투자회수 기간 산정 가능',
        policy: '에너지 원단위 절감과 탄소 대응 요구 확대',
        pitch: '{company}의 에너지 집약 공정에 {product} 기반 에너지 원단위 관리 체계를 제안합니다.'
      }
    }
  },
  {
    match: /(건설|부동산|디벨로퍼|재건축|주택|오피스|빌딩)/,
    products: {
      building: ['빌딩 통합관제 플랫폼', '에너지 최적화 솔루션'],
      project: ['프로젝트 운영 데이터 허브']
    },
    productKnowledge: {
      '빌딩 통합관제 플랫폼': {
        value: '설비, 에너지, 운영 이벤트를 하나의 화면에서 통합 관리',
        roi: '운영 인력 효율화와 장애 대응 시간 단축 검증에 적합'
      },
      '에너지 최적화 솔루션': {
        value: '빌딩 에너지 사용량 가시화와 피크 관리 자동화',
        roi: '운영비 절감과 ESG 대응 검증에 적합'
      },
      '프로젝트 운영 데이터 허브': {
        value: '시공, 인수인계, 운영 전환 데이터를 연결하는 프로젝트 데이터 체계',
        roi: '운영 전환 리스크 감소와 보고 체계 표준화에 적합'
      }
    },
    categoryRules: {
      building: ['빌딩', '재건축', '오피스', '주거', '스마트홈', '관제'],
      project: ['착공', '준공', '수주', '입찰', '개발', '시공']
    },
    categoryConfig: {
      building: {
        product: '빌딩 통합관제 플랫폼',
        score: 75,
        grade: 'B',
        roi: '근거 없음(추정 불가) - 운영비와 유지관리 이력 확보 후 투자회수 기간 산정 가능',
        policy: '빌딩 운영 데이터 통합과 에너지 검증 요구 확대',
        pitch: '{company}의 개발/운영 자산에 {product} 기반 통합 운영 체계를 제안합니다.'
      },
      project: {
        product: '프로젝트 운영 데이터 허브',
        score: 73,
        grade: 'B',
        roi: '근거 없음(추정 불가) - 프로젝트 운영 KPI 확보 후 정량 효과 검증 가능',
        policy: '프로젝트 인수인계와 운영 전환 데이터 표준화 요구 확대',
        pitch: '{company}의 수주/착공 이슈에 맞춰 {product} 기반 운영 전환 데이터 체계를 제안합니다.'
      }
    }
  },
  {
    match: /(물류|유통|리테일|커머스|창고)/,
    products: {
      logistics: ['물류 운영 가시화 플랫폼', '에너지 최적화 솔루션'],
      maintenance: ['설비 예지보전 솔루션']
    },
    productKnowledge: {
      '물류 운영 가시화 플랫폼': {
        value: '창고, 설비, 온도, 운영 이벤트의 실시간 통합 모니터링',
        roi: '운영 병목 해소와 SLA 대응 검증에 적합'
      },
      '에너지 최적화 솔루션': {
        value: '센터별 전력 사용량과 냉난방 부하 가시화',
        roi: '에너지 비용 절감 검증에 적합'
      },
      '설비 예지보전 솔루션': {
        value: '핵심 설비 이상 징후 조기 탐지',
        roi: '장애 예방과 유지보수 비용 절감 검증에 적합'
      }
    },
    categoryRules: {
      logistics: ['물류', '센터', '창고', '풀필먼트', '배송'],
      maintenance: ['설비', '냉동', '냉장', '자동화']
    },
    categoryConfig: {
      logistics: {
        product: '물류 운영 가시화 플랫폼',
        score: 74,
        grade: 'B',
        roi: '근거 없음(추정 불가) - 센터 운영 KPI 확보 후 투자회수 기간 산정 가능',
        policy: '물류 운영 가시화와 에너지 비용 최적화 요구 확대',
        pitch: '{company}의 운영 센터 확장 이슈에 맞춰 {product} 기반 실시간 운영 가시화를 제안합니다.'
      },
      maintenance: {
        product: '설비 예지보전 솔루션',
        score: 72,
        grade: 'B',
        roi: '근거 없음(추정 불가) - 설비 장애 이력 확보 후 투자회수 기간 산정 가능',
        policy: '센터 핵심 설비의 장애 예방과 운영 안정성 요구 확대',
        pitch: '{company}의 핵심 설비 운영 리스크에 대해 {product} 기반 선제 대응 체계를 제안합니다.'
      }
    }
  }
]);

function buildDefaultBlueprint() {
  return {
    products: {
      core: ['운영 데이터 통합 플랫폼', '에너지 최적화 솔루션']
    },
    productKnowledge: {
      '운영 데이터 통합 플랫폼': {
        value: '운영 이벤트와 설비 데이터를 연결해 의사결정 속도를 높임',
        roi: '운영 효율 개선 검증에 적합'
      },
      '에너지 최적화 솔루션': {
        value: '에너지 사용량과 피크 부하를 가시화하고 최적화',
        roi: '에너지 비용 절감 검증에 적합'
      }
    },
    categoryRules: {
      core: ['투자', '수주', '증설', '운영', '효율', '데이터']
    },
    categoryConfig: {
      core: {
        product: '운영 데이터 통합 플랫폼',
        score: 72,
        grade: 'B',
        roi: '근거 없음(추정 불가) - 운영 KPI 확보 후 투자회수 기간 산정 가능',
        policy: '운영 효율화와 데이터 기반 의사결정 요구 확대',
        pitch: '{company}의 주요 프로젝트에 {product} 기반 운영 데이터 체계를 제안합니다.'
      }
    }
  };
}

export function buildDeterministicSolutionProfile(company, industry) {
  const blueprint = SOLUTION_BLUEPRINTS.find((item) => item.match.test(industry)) || buildDefaultBlueprint();
  return {
    name: company,
    industry,
    competitors: [],
    products: blueprint.products,
    productKnowledge: blueprint.productKnowledge,
    searchQueries: [
      `${company} ${industry} 투자`,
      `${company} ${industry} 수주`,
      `${company} ${industry} 증설`,
      `${company} ${industry} 착공`,
      `${company} 운영 효율`,
      `${industry} 데이터 통합`,
      `${industry} 에너지 최적화`
    ],
    categoryRules: blueprint.categoryRules,
    categoryConfig: blueprint.categoryConfig
  };
}

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
    "category1": ["우리가 제안할 솔루션A", "우리가 제안할 솔루션B"],
    "category2": ["우리가 제안할 솔루션C", "우리가 제안할 솔루션D"]
  },
  "productKnowledge": {
    "대표 솔루션1": { "value": "핵심 가치", "roi": "ROI 근거" },
    "대표 솔루션2": { "value": "핵심 가치", "roi": "ROI 근거" }
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
- products/productKnowledge/categoryConfig는 타깃 회사의 소비재/브랜드가 아니라 우리가 제안할 B2B 솔루션 기준으로 작성
- categoryConfig의 pitch는 반드시 {company}와 {product} 플레이스홀더 사용
- 실제 산업 지식 기반으로 현실적인 ROI 수치 제시
- competitors는 실제 경쟁사 3개`;

  const result = await callGemini(prompt, env);
  let cleaned = result.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const parsed = JSON.parse(cleaned);
  const deterministic = buildDeterministicSolutionProfile(company, industry);
  const searchQueries = (Array.isArray(parsed.searchQueries) ? parsed.searchQueries : [])
    .map(q => (typeof q === 'string' ? q.trim() : ''))
    .filter(Boolean)
    .slice(0, 7);

  return {
    ...deterministic,
    name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim() : company,
    industry: typeof parsed.industry === 'string' && parsed.industry.trim() ? parsed.industry.trim() : industry,
    competitors: Array.isArray(parsed.competitors)
      ? parsed.competitors
          .map(c => (typeof c === 'string' ? c.trim() : ''))
          .filter(Boolean)
          .slice(0, 5)
      : [],
    searchQueries: searchQueries.length > 0 ? searchQueries : deterministic.searchQueries
  };
}

export function generateHeuristicProfile(company, industry) {
  return buildDeterministicSolutionProfile(company, industry);
}
