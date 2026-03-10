const { buildLegacyProductKnowledge } = require('./product-knowledge');

const productKnowledgeGraph = {
  'GSIS 가스절연개폐장치': {
    aliases: ['Green GIS', 'MV 변압기', '배전반'],
    targetIndustries: ['전력 인프라', '변전소', '대형 산업 설비'],
    targetPersonas: ['전력 설계팀', '변전소 운영 책임자', 'CAPEX 의사결정자'],
    useCases: ['노후 변전소 교체', '신규 배전 인프라 구축', '도심형 전력 설비 집약화'],
    painsSolved: ['설치 공간 부족', '유지보수 비용 증가', '노후 설비 교체 압박'],
    businessOutcomes: ['설치 면적 축소', '유지보수비 절감', '설비 수명 연장'],
    technicalRequirements: ['전압 등급/설치 환경 검토', '기존 배전 설비 인터페이스 확인'],
    integrationConstraints: ['정전 일정 조율', '도심형 공간 제약 반영'],
    deploymentComplexity: 'high',
    roiDrivers: ['설치면적 60% 축소', '유지보수비 40% 절감'],
    proofPoints: ['Saudi Aramco GIS 공급', 'KEPCO 345kV 변전소 현대화'],
    differentiators: ['대형 전력 인프라 납품 레퍼런스', '공간 효율성'],
    commonObjections: ['초기 CAPEX 부담', '설치 중 정전 리스크']
  },
  'XGT PLC + XDL 서보': {
    aliases: ['XGT PLC', 'XDL 서보드라이브', 'SMART I/O'],
    targetIndustries: ['스마트팩토리', '배터리', '자동차 조립'],
    targetPersonas: ['생산기술팀', '자동화 엔지니어', '공장장'],
    useCases: ['생산라인 자동화', '고속 정밀 제어', '라인 표준 PLC/서보 교체'],
    painsSolved: ['생산성 병목', '불량률 증가', '라인 제어 표준 부재'],
    businessOutcomes: ['생산성 향상', '불량률 감소', '유연 생산 체계 확보'],
    technicalRequirements: ['PLC/서보 네트워크 설계', '라인별 사이클타임 분석'],
    integrationConstraints: ['기존 MES/SCADA 연동 범위 확인', '라인 다운타임 최소화 필요'],
    deploymentComplexity: 'medium',
    roiDrivers: ['생산성 20% 향상', '불량률 30% 감소'],
    proofPoints: ['LG에너지솔루션 배터리 공장', 'Hyundai Motors EV 조립 라인'],
    differentiators: ['고속 EtherCAT 기반 제어', '배터리/자동차 라인 레퍼런스'],
    commonObjections: ['기존 PLC 표준 변경 부담', '서보 튜닝 복잡도 우려']
  },
  'ESS + 태양광 인버터': {
    aliases: ['태양광 인버터', 'ESS(에너지저장장치)', 'EV 충전기'],
    targetIndustries: ['신재생', 'RE100', '대형 산업단지'],
    targetPersonas: ['에너지 전략팀', '전력 운영 책임자', 'ESG 담당'],
    useCases: ['피크 저감', '신재생 연계 저장', 'RE100 전력 운영 최적화'],
    painsSolved: ['전력 피크 요금 부담', '신재생 출력 변동성', 'RE100 이행 압박'],
    businessOutcomes: ['전기요금 절감', '계통 안정성 확보', '재생에너지 활용도 향상'],
    technicalRequirements: ['부하 패턴 분석', '계통 연계 조건 확인'],
    integrationConstraints: ['부지/배전 설비 제약 검토', '계통 연결 인허가 일정 반영'],
    deploymentComplexity: 'medium',
    roiDrivers: ['전력 피크 저감 25%', '전기요금 15~20% 절감'],
    proofPoints: ['한국전력 제주 ESS 실증', 'Hanwha Q Cells 태양광 발전소'],
    differentiators: ['ESS-인버터 패키지 제안', 'RE100/계통 안정성 동시 대응'],
    commonObjections: ['배터리 수명 우려', '계통 연계 승인 일정 불확실성']
  }
};

module.exports = {
  id: 'ls-electric',
  name: 'LS일렉트릭',
  industry: '전력인프라/산업자동화',
  emailRecipients: '',
  competitors: ['Siemens', 'ABB', 'Schneider Electric', '현대일렉트릭'],

  products: {
    power: ['GSIS 가스절연개폐장치', 'MV 변압기', '배전반', 'ACB/MCCB 차단기'],
    automation: ['XGT PLC', 'XDL 서보드라이브', 'iXP HMI', 'SMART I/O'],
    green: ['태양광 인버터', 'ESS(에너지저장장치)', 'EV 충전기', 'DC 마이크로그리드'],
    grid: ['STATCOM', 'SVC', 'HVDC 시스템', '전력품질 솔루션']
  },

  productKnowledgeGraph,
  productKnowledge: buildLegacyProductKnowledge(productKnowledgeGraph),

  searchQueries: [
    '전력 인프라 투자',
    '변전소 신축 착공',
    '태양광 발전소 수주',
    'ESS 에너지저장장치 설치',
    '스마트 그리드 사업',
    'EV 충전 인프라 구축',
    '산업 자동화 PLC'
  ],

  scoring: {
    gradeA: '구체적 착공 시기, 예산 규모, 발주처가 명확한 경우 (80-100점)',
    gradeB: '산업 트렌드 변화로 향후 수요 예상 (50-79점)',
    gradeC: '단순 기업 동정, 일반 뉴스 (0-49점)'
  },

  globalReferences: {
    power: [
      { client: 'Saudi Aramco (사우디)', project: '자나인 변전소 GIS 공급', result: '중동 최대 154kV GIS 납품, 3년 무장애 운영' },
      { client: 'KEPCO (한국)', project: '345kV 변전소 현대화', result: '설치면적 60% 축소, 연간 유지비 40% 절감' },
      { client: 'PLN (인도네시아)', project: '자카르타 배전망 현대화', result: '정전율 35% 감소, 전력손실 8% 개선' }
    ],
    automation: [
      { client: 'LG에너지솔루션 (한국)', project: '배터리 공장 XGT PLC 표준화', result: '생산 사이클 15% 단축, 불량률 절반' },
      { client: '포스코 (한국)', project: '제철소 서보 드라이브 교체', result: '정밀도 향상, 에너지 22% 절감' },
      { client: 'Hyundai Motors (한국)', project: 'EV 조립 라인 자동화', result: 'UPH 20% 향상, 다품종 유연 생산' }
    ],
    green: [
      { client: 'Hanwha Q Cells (한국)', project: '100MW 태양광 발전소 인버터 공급', result: '변환효율 98.6%, 10년 무상 보증' },
      { client: '한국전력 (한국)', project: '제주 ESS 실증 프로젝트', result: '신재생 출력 변동 80% 안정화' },
      { client: 'SK E&S (한국)', project: 'EV 충전 인프라 350kW 급속충전', result: '충전 시간 18분, 가동률 99.5%' }
    ],
    grid: [
      { client: 'State Grid (중국)', project: 'HVDC 송전 프로젝트', result: '전력 손실 3% 미만, 500km 장거리 송전' },
      { client: 'KEPCO (한국)', project: 'STATCOM 전력품질 개선', result: '전압 변동 90% 감소, 플리커 해소' },
      { client: 'EGAT (태국)', project: '방콕 전력망 SVC 설치', result: '역률 0.99 달성, 계통 안정성 확보' }
    ]
  },

  categoryRules: {
    power: ['변전소', '변압기', 'GIS', '개폐장치', '차단기', '배전', '송전', '전력망', '한전'],
    automation: ['PLC', '자동화', '서보', 'HMI', '로봇', '스마트팩토리', '생산라인', 'MES'],
    green: ['태양광', 'ESS', '에너지저장', '충전기', 'EV충전', '신재생', 'RE100', '마이크로그리드'],
    grid: ['스마트그리드', 'HVDC', 'STATCOM', '전력품질', '계통', '주파수', '전압안정']
  },

  categoryConfig: {
    power: {
      product: 'GSIS 가스절연개폐장치',
      score: 85,
      grade: 'A',
      roi: '설치면적 60% 축소, 유지보수비 40% 절감, 수명 30년+',
      policy: 'SF6 가스 규제 강화 (EU F-Gas 규정), 노후 변전소 교체 수요',
      pitch: '{company}의 전력 인프라 프로젝트에 Saudi Aramco가 검증한 {product}로 설치면적 60% 축소와 유지비 40% 절감을 제안합니다.'
    },
    automation: {
      product: 'XGT PLC + XDL 서보',
      score: 75,
      grade: 'B',
      roi: '생산성 20% 향상, 불량률 30% 감소',
      policy: 'Industry 4.0 전환 가속, 스마트 제조 혁신법 시행',
      pitch: '{company} 스마트 팩토리에 LG에너지솔루션이 표준으로 채택한 {product}로 생산성 20% 향상을 제안합니다.'
    },
    green: {
      product: 'ESS + 태양광 인버터',
      score: 80,
      grade: 'A',
      roi: '전력 피크 저감 25%, 전기요금 15~20% 절감',
      policy: 'RE100 의무화 확대, 2030 NDC 온실가스 40% 감축 목표',
      pitch: '{company}의 RE100 이행에 한국전력 실증 프로젝트가 검증한 {product}로 전기요금 20% 절감을 실현하세요.'
    },
    grid: {
      product: 'STATCOM 전력품질 솔루션',
      score: 70,
      grade: 'B',
      roi: '전압 변동 90% 감소, 역률 0.99 달성',
      policy: '신재생 확대에 따른 계통 안정성 문제, 전력품질 기준 강화',
      pitch: '{company} 전력계통에 KEPCO가 적용한 {product}로 전압 안정성과 역률을 획기적으로 개선하세요.'
    }
  }
};
