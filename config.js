module.exports = {
  // 댄포스 핵심 사업부별 제품
  products: {
    drives: ['VLT AutomationDrive', 'VLT HVAC Drive', 'VACON NXP', 'VACON 100'],
    marine: ['Marine용 드라이브', 'iC7 Marine'],
    hvac: ['HVAC 인버터', 'DrivePro'],
    cooling: ['Turbocor 컴프레서', '냉각 솔루션']
  },

  // 제품 지식 베이스 (Gemini 프롬프트용)
  productKnowledge: {
    'iC7 / VLT Drives': {
      value: '모터 속도 제어로 에너지 20~50% 절감',
      roi: '기존 정속 모터 대비 전력 소비 30% 감소 가정'
    },
    'Turbocor 컴프레서': {
      value: '오일리스 기술로 효율 40% 향상, 유지보수비 급감',
      roi: '데이터센터/냉동창고 전력비 35% 절감 가정'
    },
    '선박용 하이브리드': {
      value: '탄소 배출 규제(EEXI/CII) 완벽 대응',
      roi: '연료 소비 15% 절감 및 규제 벌금 회피 비용 산출'
    }
  },

  // 산업별 검색 키워드
  searchQueries: [
    '친환경 선박 수주',
    '데이터센터 신축 착공',
    '스마트 팩토리 증설',
    '공장 자동화 투자',
    'HVAC 시스템 교체',
    '냉동냉장 설비 투자',
    'ESG 탄소중립 설비'
  ],

  // 리드 스코어링 기준
  scoring: {
    gradeA: '구체적 착공 시기, 예산 규모, 발주처가 명확한 경우 (80-100점)',
    gradeB: '산업 트렌드 변화로 향후 수요 예상 (50-79점)',
    gradeC: '단순 기업 동정, 일반 뉴스 (0-49점)'
  },

  // 댄포스 글로벌 성공 사례 (Cross-border Selling Reference)
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

  // 리드 상태 관리 (CRM)
  leadStatus: {
    NEW: '신규 발굴',
    CONTACTED: '컨택 완료',
    MEETING: '미팅 진행',
    PROPOSAL: '제안서 제출',
    NEGOTIATION: '협상 중',
    WON: '수주 성공',
    LOST: '실패/보류'
  }
};
