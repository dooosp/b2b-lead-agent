module.exports = {
  // 댄포스 핵심 사업부별 제품
  products: {
    drives: ['VLT AutomationDrive', 'VLT HVAC Drive', 'VACON NXP', 'VACON 100'],
    marine: ['Marine용 드라이브', 'iC7 Marine'],
    hvac: ['HVAC 인버터', 'DrivePro'],
    cooling: ['Turbocor 컴프레서', '냉각 솔루션']
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
  }
};
