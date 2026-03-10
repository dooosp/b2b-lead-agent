const { buildLegacyProductKnowledge } = require('./product-knowledge');

const productKnowledgeGraph = {
  'Desigo CC': {
    aliases: ['Desigo CC 통합 빌딩관리', 'APOGEE', 'Climatix'],
    targetIndustries: ['빌딩 운영', '오피스', '공공시설'],
    targetPersonas: ['시설관리 책임자', '빌딩 운영팀', '에너지 매니저'],
    useCases: ['통합 BMS 구축', 'HVAC/조명/전력 통합 관제', '노후 빌딩 운영 현대화'],
    painsSolved: ['설비 시스템 분절', '운영 인력 과다 투입', '에너지 사용 가시성 부족'],
    businessOutcomes: ['운영 효율 개선', '에너지 절감', '통합 관제 기반 확보'],
    technicalRequirements: ['기존 BAS/BMS 인터페이스 파악', '설비 포인트 맵 정리'],
    integrationConstraints: ['서드파티 설비 연동 범위 조정', '현장 운영 중 무중단 전환 설계'],
    deploymentComplexity: 'medium',
    roiDrivers: ['에너지 비용 25~40% 절감', '운영 인력 30% 절감'],
    proofPoints: ['Changi Airport 터미널 4', 'Deutsche Bank HQ BMS 현대화'],
    differentiators: ['HVAC/조명/방재 통합', '대형 빌딩 운영 레퍼런스'],
    commonObjections: ['기존 BAS 교체 부담', '포인트 통합 비용 우려']
  },
  'Building X': {
    aliases: ['Building Performance', 'Energy Analytics'],
    targetIndustries: ['스마트빌딩', 'ESCO', '데이터센터'],
    targetPersonas: ['디지털전환 책임자', '에너지 전략팀', '자산 운영 총괄'],
    useCases: ['클라우드 에너지 최적화', '디지털 트윈 기반 운영 분석', '멀티사이트 성과 비교'],
    painsSolved: ['자산별 운영 데이터 단절', '탄소/ESG 보고 부담', '현장별 최적화 속도 저하'],
    businessOutcomes: ['탄소배출 감축', '운영비 절감', '멀티사이트 표준화'],
    technicalRequirements: ['클라우드 연결', '센서/BMS 데이터 수집 체계'],
    integrationConstraints: ['기존 관제 데이터 품질 확인', '보안/클라우드 정책 검토'],
    deploymentComplexity: 'medium',
    roiDrivers: ['운영비 15% 절감', '탄소배출 20% 감축'],
    proofPoints: ['Mercedes-Benz Factory 56', 'Siemens HQ 넷제로 리노베이션'],
    differentiators: ['클라우드 기반 확장성', '에너지/탄소 분석 결합'],
    commonObjections: ['클라우드 보안 우려', '현장 데이터 정합성 부족']
  },
  'Cerberus PRO': {
    aliases: ['Cerberus PRO 화재감지', 'Sinteso', 'FC726 화재감지기'],
    targetIndustries: ['초고층', '공항', '반도체/클린룸'],
    targetPersonas: ['안전관리 책임자', '소방 설계팀', '시설 운영팀'],
    useCases: ['초고층 화재 감지', '클린룸 특수 감지', '공항/복합시설 안전 고도화'],
    painsSolved: ['오보 과다', '대형 시설 피난 리스크', '규제 대응 부담'],
    businessOutcomes: ['인명 안전 강화', '오보율 감소', '보험/규제 대응 개선'],
    technicalRequirements: ['기존 소방 루프 구성 파악', '감지 포인트별 위험 시나리오 정의'],
    integrationConstraints: ['기존 소방 시스템 교체 범위 검토', '법규 인증 일정 반영'],
    deploymentComplexity: 'high',
    roiDrivers: ['오보율 90% 감소', '보험료 15% 절감'],
    proofPoints: ['Lotte World Tower', 'Heathrow Airport'],
    differentiators: ['EN54/UL 인증', '초고층/공항 레퍼런스'],
    commonObjections: ['법규 승인 일정 우려', '기존 소방 인프라 교체 비용 부담']
  }
};

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

  productKnowledgeGraph,
  productKnowledge: buildLegacyProductKnowledge(productKnowledgeGraph),

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
