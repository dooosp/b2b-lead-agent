const { buildLegacyProductKnowledge } = require('./product-knowledge');

const productKnowledgeGraph = {
  'iC7 Marine 드라이브': {
    aliases: ['Marine용 드라이브', 'iC7 Marine'],
    targetIndustries: ['조선', '해운', '친환경 선박'],
    targetPersonas: ['선박 설계팀', '전장/추진 시스템 책임자', '연료 효율 담당'],
    useCases: ['하이브리드 추진', 'EEXI/CII 대응 선박 개조', '전기 추진 보조 시스템'],
    painsSolved: ['연료비 상승', '탄소 규제 대응 부담', '선박 전력 계통 효율 저하'],
    businessOutcomes: ['연료 사용량 절감', '규제 대응 가속', '선박 운영 효율 개선'],
    technicalRequirements: ['선박 전력 계통 연동', '추진/보조 모터 제어 범위 정의'],
    integrationConstraints: ['기존 선박 제어 시스템 인터페이스 확인', '도크 일정과 개조 범위 조율'],
    deploymentComplexity: 'medium',
    roiDrivers: ['연료 소비 15~18% 절감', '규제 벌금/운항 제한 회피'],
    proofPoints: ['Maersk 300척 하이브리드 추진', 'MSC LNG 운반선 적용'],
    differentiators: ['선박 추진 특화 제어', '친환경 선박 규제 대응 레퍼런스'],
    commonObjections: ['개조 일정 부담', '기존 추진 시스템과의 통합 리스크']
  },
  'Turbocor 컴프레서': {
    aliases: ['Turbocor 오일리스 칠러', '냉각 솔루션'],
    targetIndustries: ['데이터센터', '콜드체인', '대형 HVAC'],
    targetPersonas: ['설비 엔지니어', '냉동/냉각 운영 책임자', '에너지 매니저'],
    useCases: ['데이터센터 냉각 고도화', '콜드체인 오일리스 전환', '고효율 칠러 교체'],
    painsSolved: ['냉각 전력비 증가', '오일 관리/유지보수 부담', 'PUE 개선 압박'],
    businessOutcomes: ['냉각 전력 절감', '유지보수 비용 감소', '가동률 향상'],
    technicalRequirements: ['냉동 사이클 설계 검토', '기존 냉각 인프라 용량 분석'],
    integrationConstraints: ['기존 칠러 룸 배치 확인', '제어 시스템 연동 범위 협의'],
    deploymentComplexity: 'medium',
    roiDrivers: ['냉각 전력 35~40% 절감', '유지보수비 60% 감소'],
    proofPoints: ['Equinix PUE 1.58→1.25', 'Lineage Logistics 냉각 효율 개선'],
    differentiators: ['오일리스 압축 기술', '데이터센터/콜드체인 공용 레퍼런스'],
    commonObjections: ['초기 교체 비용 부담', '기존 냉각 설비와의 호환성 우려']
  },
  'VLT AutomationDrive': {
    aliases: ['VLT HVAC Drive', 'VACON NXP', 'VACON 100'],
    targetIndustries: ['제조', '스마트팩토리', '배터리/반도체'],
    targetPersonas: ['공장장', '생산기술팀', '설비 자동화 엔지니어'],
    useCases: ['모터 제어 최적화', '라인 에너지 절감', '설비 표준 드라이브 교체'],
    painsSolved: ['모터 전력비 과다', '라인별 제어 표준 부재', '탄소 대응 압박'],
    businessOutcomes: ['생산라인 에너지 절감', '설비 제어 안정화', '운영 표준화'],
    technicalRequirements: ['기존 PLC/모터 사양 확인', '라인별 부하 패턴 분석'],
    integrationConstraints: ['기존 제어반 교체 범위 산정', '정지시간 최소화 계획 필요'],
    deploymentComplexity: 'medium',
    roiDrivers: ['전력 소비 20~35% 절감', '라인 효율 개선'],
    proofPoints: ['Volkswagen EV 공장 적용', 'Samsung SDI 배터리 공장 자동화'],
    differentiators: ['산업 모터 구동 특화', '제조/에너지 절감 동시 레퍼런스'],
    commonObjections: ['라인 다운타임 우려', '기존 자동화 표준과 충돌 가능성']
  }
};

module.exports = {
  id: 'danfoss',
  name: '댄포스 코리아',
  industry: '산업 자동화/에너지 효율',
  emailRecipients: '',  // 기본 GMAIL_RECIPIENT 사용
  competitors: ['ABB', 'Siemens', 'Schneider Electric'],

  products: {
    drives: ['VLT AutomationDrive', 'VLT HVAC Drive', 'VACON NXP', 'VACON 100'],
    marine: ['Marine용 드라이브', 'iC7 Marine'],
    hvac: ['HVAC 인버터', 'DrivePro'],
    cooling: ['Turbocor 컴프레서', '냉각 솔루션']
  },

  productKnowledgeGraph,
  productKnowledge: buildLegacyProductKnowledge(productKnowledgeGraph),

  searchQueries: [
    '친환경 선박 수주',
    '데이터센터 신축 착공',
    '스마트 팩토리 증설',
    '공장 자동화 투자',
    'HVAC 시스템 교체',
    '냉동냉장 설비 투자',
    'ESG 탄소중립 설비'
  ],

  scoring: {
    gradeA: '구체적 착공 시기, 예산 규모, 발주처가 명확한 경우 (80-100점)',
    gradeB: '산업 트렌드 변화로 향후 수요 예상 (50-79점)',
    gradeC: '단순 기업 동정, 일반 뉴스 (0-49점)'
  },

  globalReferences: {
    marine: [
      { client: 'Maersk (덴마크)', project: '컨테이너선 300척 하이브리드 추진 시스템 도입', result: '연료비 18% 절감, IMO 2030 규제 선제 대응' },
      { client: 'MSC (스위스)', project: 'LNG 운반선 iC7 드라이브 적용', result: '탄소 배출 25% 감소, CII 등급 A 달성' },
      { client: 'NYK Line (일본)', project: '친환경 선박 플릿 현대화', result: 'EEXI 규제 100% 충족, 연간 $2M 연료비 절감' }
    ],
    datacenter: [
      { client: 'Equinix (미국)', project: '글로벌 데이터센터 Turbocor 표준화', result: 'PUE 1.58→1.25 개선, 냉각 전력 40% 절감' },
      { client: 'Digital Realty (미국)', project: '아시아 데이터센터 냉각 시스템 교체', result: '연간 운영비 $1.5M 절감' },
      { client: 'NTT (일본)', project: '도쿄 DC 오일리스 칠러 도입', result: '유지보수 비용 60% 감소, 가동률 99.99%' }
    ],
    factory: [
      { client: 'Volkswagen (독일)', project: 'EV 배터리 공장 VLT 드라이브 적용', result: '생산 라인 에너지 35% 절감' },
      { client: 'TSMC (대만)', project: '반도체 클린룸 HVAC 최적화', result: '공조 전력 28% 절감, 정밀 온습도 제어' },
      { client: 'Samsung SDI (한국)', project: '헝가리 배터리 공장 자동화', result: '모터 효율 25% 향상, RE100 달성 기여' }
    ],
    coldchain: [
      { client: 'Lineage Logistics (미국)', project: '세계 최대 냉동창고 Turbocor 도입', result: '에너지 비용 32% 절감' },
      { client: 'Pfizer (미국)', project: '백신 콜드체인 정밀 온도 제어', result: '-70°C 유지 안정성 99.9%, FDA 승인' },
      { client: 'CJ대한통운 (한국)', project: '신선식품 물류센터 현대화', result: '냉각 효율 30% 개선, 식품 손실률 50% 감소' }
    ]
  },

  categoryRules: {
    marine: ['선박', '해운', '조선', '해양', 'LNG', 'IMO', 'EEXI', 'CII', '벙커'],
    datacenter: ['데이터센터', 'DC', 'IDC', '클라우드', 'PUE', '냉각', '서버'],
    factory: ['팩토리', '공장', '자동화', '증설', '생산', '배터리', '반도체', 'EV'],
    coldchain: ['냉동', '냉장', '냉각', '콜드체인', '물류센터', '식품', '백신']
  },

  categoryConfig: {
    marine: {
      product: 'iC7 Marine 드라이브',
      score: 85,
      grade: 'A',
      roi: '연료 소비 15~18% 절감 + IMO EEXI/CII 규제 벌금 회피',
      policy: 'IMO 2030 탄소중립 규제 (EEXI/CII 등급제)',
      pitch: '{company}의 친환경 선박 프로젝트에 Maersk 300척이 검증한 {product}로 연료비 18% 절감을 제안합니다.'
    },
    datacenter: {
      product: 'Turbocor 컴프레서',
      score: 80,
      grade: 'A',
      roi: '냉각 전력 35~40% 절감, PUE 1.25 달성',
      policy: 'EU 데이터센터 에너지효율 지침 (2027 시행)',
      pitch: '{company} 데이터센터에 Equinix가 글로벌 표준으로 채택한 {product}로 PUE 1.25를 달성하세요.'
    },
    coldchain: {
      product: 'Turbocor 오일리스 칠러',
      score: 75,
      grade: 'B',
      roi: '에너지 비용 30~32% 절감, 유지보수비 60% 감소',
      policy: 'RE100 이행 + 글로벌 식품/의약 콜드체인 인증 강화',
      pitch: '{company} 냉동/냉장 설비에 Lineage Logistics가 검증한 {product}로 에너지 32% 절감을 실현하세요.'
    },
    factory: {
      product: 'VLT AutomationDrive',
      score: 70,
      grade: 'B',
      roi: '생산라인 에너지 25~35% 절감',
      policy: 'EU CBAM 탄소국경세 (2026 본격 시행) + 산업용 모터 IE4 의무화',
      pitch: '{company} 스마트 팩토리에 Volkswagen EV공장이 적용한 {product}로 에너지 35% 절감을 제안합니다.'
    }
  }
};
