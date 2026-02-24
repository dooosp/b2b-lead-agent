module.exports = {
  id: 'siemens',
  name: '지멘스 Smart Infra',
  industry: '빌딩 자동화/에너지 관리',
  emailRecipients: '',
  competitors: ['Honeywell', 'Johnson Controls', 'Schneider Electric', 'ABB'],

  products: {
    bms: ['Desigo CC', 'Building X', 'APOGEE', 'Climatix'],
    esco: ['ESCO 에너지절감 모델', 'Building Performance', 'Energy Analytics'],
    fire: ['Cerberus PRO', 'Sinteso', 'FC726 화재감지기'],
    security: ['Siveillance', 'Access Control', 'Video Surveillance']
  },

  productKnowledge: {
    'Desigo CC': {
      value: '통합 빌딩관리 플랫폼, HVAC/조명/전력/방재 원스톱 제어',
      roi: '에너지 비용 25~40% 절감, 운영인력 30% 절감'
    },
    'Building X': {
      value: '클라우드 기반 디지털 트윈, AI 에너지 최적화',
      roi: '탄소배출 20% 감축, 운영비 15% 절감'
    },
    'ESCO 모델': {
      value: '초기 투자 없이 에너지 절감분으로 비용 상환',
      roi: '5~10년 계약, 절감 보장 20~35%, 리스크 제로'
    },
    'Cerberus PRO': {
      value: 'EN54/UL 인증 화재감지, 오보율 90% 감소',
      roi: '인명안전 + 보험료 15% 절감'
    }
  },

  searchQueries: [
    '빌딩 자동화 BMS 구축',
    '스마트 빌딩 에너지 관리',
    'BEMS 에너지관리시스템',
    'ESCO 에너지절감 사업',
    '데이터센터 냉각 관리',
    '화재감지 소방설비 교체',
    '제로에너지 건축물 인증'
  ],

  scoring: {
    gradeA: '구체적 착공 시기, BMS 교체/신축, 예산 규모가 명확한 경우 (80-100점)',
    gradeB: '스마트빌딩 전환 검토, 에너지 효율 개선 필요 (50-79점)',
    gradeC: '단순 기업 동정, 일반 건설/부동산 뉴스 (0-49점)'
  },

  globalReferences: {
    bms: [
      { client: 'Changi Airport (싱가포르)', project: '터미널 4 Desigo CC 통합 BMS 구축', result: '에너지 35% 절감, 500개 포인트 통합 관제' },
      { client: 'Mercedes-Benz Factory 56 (독일)', project: 'Digital Energy Twin 적용', result: '운영비 28% 절감, 탄소중립 달성' },
      { client: 'Deutsche Bank HQ (독일)', project: '본사 빌딩 BMS 현대화', result: '에너지 효율 40% 개선, LEED Platinum 인증' }
    ],
    esco: [
      { client: '서울특별시 (한국)', project: '공공건물 200동 ESCO 에너지 절감', result: '연간 ₩150억 에너지비 절감, 10년 계약' },
      { client: 'Siemens HQ (독일)', project: '뮌헨 본사 넷제로 리노베이션', result: '탄소배출 90% 감축, 에너지 자립률 75%' },
      { client: 'Dubai Mall (UAE)', project: '세계 최대 쇼핑몰 에너지 최적화', result: '냉방 에너지 32% 절감, ROI 4.2년' }
    ],
    fire: [
      { client: 'Lotte World Tower (한국)', project: 'Cerberus PRO 초고층 화재감지', result: '555m 123층 완벽 커버, 오보율 95% 감소' },
      { client: 'Heathrow Airport (영국)', project: '터미널 전체 Sinteso 화재시스템', result: 'EN54 인증, 대피 시간 40% 단축' },
      { client: 'Samsung 평택 반도체 (한국)', project: '클린룸 특수 화재감지', result: '초미세 연기 감지, 생산라인 보호' }
    ],
    security: [
      { client: 'Incheon Airport (한국)', project: 'Siveillance 통합 보안 시스템', result: '출입 통제 + 영상감시 + BMS 통합, 보안 인력 25% 절감' },
      { client: 'FIFA World Cup Qatar (카타르)', project: '스타디움 8개 통합 보안', result: '40만명 동시 출입통제, 무사고 운영' },
      { client: 'Hyundai Motor 울산공장 (한국)', project: '스마트 팩토리 보안 시스템', result: '300개 구역 차등 출입통제, 안전사고 60% 감소' }
    ]
  },

  categoryRules: {
    bms: ['빌딩', 'BMS', 'BEMS', '빌딩관리', '공조', 'HVAC', '스마트빌딩', '디지털트윈', '건물관리', '자동제어'],
    esco: ['ESCO', '에너지절감', '에너지효율', '제로에너지', 'ZEB', '탄소중립', '넷제로', '에너지관리', '리노베이션'],
    fire: ['화재', '소방', '감지기', '방재', '스프링클러', 'R형', '화재경보', '소방설비'],
    security: ['보안', 'CCTV', '출입통제', '영상감시', '통합보안', '시큐리티', 'Access Control']
  },

  categoryConfig: {
    bms: {
      product: 'Desigo CC 통합 빌딩관리',
      score: 85,
      grade: 'A',
      roi: '에너지 25~40% 절감, 운영인력 30% 절감, LEED/G-SEED 인증 지원',
      policy: '제로에너지건축물 인증 의무화 (2025~ 공공 1,000㎡↑), EU EPBD 개정',
      pitch: '{company}의 빌딩 프로젝트에 Changi Airport가 검증한 {product}로 에너지 35% 절감과 통합 관제를 제안합니다.'
    },
    esco: {
      product: 'ESCO 에너지절감 + Building X',
      score: 80,
      grade: 'A',
      roi: '초기투자 제로, 절감분 보장 20~35%, 계약기간 5~10년',
      policy: '공공기관 ESCO 의무 도입, 탄소중립 기본법 시행',
      pitch: '{company}에 초기 투자 없이 에너지 30% 절감을 보장하는 {product}를 제안합니다. 서울시 200동 실적이 검증합니다.'
    },
    fire: {
      product: 'Cerberus PRO 화재감지',
      score: 75,
      grade: 'B',
      roi: '오보율 90% 감소, 보험료 15% 절감, EN54/UL 글로벌 인증',
      policy: '소방시설법 강화 (2025), 초고층 빌딩 특별법, ESG 안전 경영',
      pitch: '{company}에 Lotte World Tower가 적용한 {product}로 오보율 95% 감소와 인명 안전을 확보하세요.'
    },
    security: {
      product: 'Siveillance 통합보안',
      score: 70,
      grade: 'B',
      roi: '보안 인력 25% 절감, 통합 관제로 대응시간 50% 단축',
      policy: '개인정보보호법 강화, 스마트시티 보안 표준화, AI 영상분석 규제',
      pitch: '{company}에 인천공항이 채택한 {product}로 통합 보안 관제와 인력 25% 절감을 제안합니다.'
    }
  }
};
