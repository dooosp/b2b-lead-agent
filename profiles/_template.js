/**
 * 고객사 프로필 템플릿
 * 새 고객사 추가 시 이 파일을 복사하여 {고객사id}.js로 저장
 */
module.exports = {
  id: 'my-company',           // 파일명과 일치 (영문 소문자, 하이픈)
  name: '회사명 한글',         // 리포트/이메일에 표시
  industry: '산업 분야',       // 예: '반도체 제조', '물류/유통'
  competitors: [],             // 경쟁사 목록

  // 사업부별 제품 라인업
  products: {
    // category1: ['제품A', '제품B'],
  },

  // 프롬프트용 제품 지식 (핵심 3~5개)
  productKnowledge: {
    // '제품명': { value: '핵심 가치', roi: 'ROI 산출 근거' },
  },

  // 뉴스 검색 키워드 (Google News 쿼리)
  searchQueries: [],

  // 리드 스코어링 기준
  scoring: {
    gradeA: '구체적 착공 시기, 예산 규모, 발주처가 명확한 경우 (80-100점)',
    gradeB: '산업 트렌드 변화로 향후 수요 예상 (50-79점)',
    gradeC: '단순 기업 동정, 일반 뉴스 (0-49점)'
  },

  // 글로벌 성공 사례 (Cross-border Selling Reference)
  globalReferences: {
    // category1: [
    //   { client: '고객사 (국가)', project: '프로젝트 설명', result: '성과 수치' },
    // ],
  },

  // 카테고리 분류 키워드
  categoryRules: {
    // category1: ['키워드1', '키워드2'],
  },

  // 카테고리별 데모/폴백 설정
  categoryConfig: {
    // category1: {
    //   product: '기본 추천 제품',
    //   score: 70,
    //   grade: 'B',
    //   roi: '예상 ROI 설명',
    //   policy: '관련 정책/규제',
    //   pitch: (company, product) => `${company}에 ${product}를 제안합니다.`
    // },
  }
};
