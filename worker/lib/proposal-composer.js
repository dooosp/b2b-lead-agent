import { buildEscoTermScenarios, calcAnnualEnergyCost } from './cpa-estimator.js';

export const PROPOSAL_SECTION_HEADINGS = Object.freeze({
  1: '프로젝트 개요',
  2: 'Desigo CC 아키텍처',
  3: '에너지 절감 시뮬레이션',
  4: 'ESCO 모델 제안',
  5: '유사 사례',
  6: '구축 타임라인',
  7: 'Why Siemens'
});

const NUMERIC_SIGNAL_RE = /(?:\d|%|원|만원|억원|조원|㎡|m²|층|개월|년|point|포인트|controller|컨트롤러|대)/i;
const BUILDING_TYPE_LABELS = Object.freeze({
  office: '오피스 빌딩',
  datacenter: '데이터센터',
  hospital: '병원/의료시설',
  hotel: '호텔/리조트',
  factory: '공장/생산시설',
  school: '학교/교육시설',
  apartment: '아파트/주거',
  commercial: '상업시설/몰'
});
const SYSTEM_LABELS = Object.freeze({
  hvac: 'HVAC',
  lighting: '조명',
  power: '전력',
  fire: '방재',
  extra: '기타 설비'
});

function formatNumber(value) {
  return Number(value || 0).toLocaleString('ko-KR');
}

function formatCurrencyKr(value) {
  return `${Number(value || 0).toLocaleString('ko-KR')}원`;
}

function formatPercent(value) {
  return `${Number(value || 0).toLocaleString('ko-KR')}%`;
}

function formatRange(minValue, maxValue, suffix = '') {
  return `${formatNumber(minValue)}~${formatNumber(maxValue)}${suffix}`;
}

function formatBuildingType(buildingType) {
  return BUILDING_TYPE_LABELS[buildingType] || buildingType || '미확인';
}

function mkDeterministicLine(label, value, source) {
  return `${label}: ${value} (근거: ${source})`;
}

function summarizeSystems(systemFlags = {}) {
  return Object.entries(SYSTEM_LABELS)
    .filter(([key]) => systemFlags[key] !== false)
    .map(([, label]) => label)
    .join(', ') || '미선택';
}

function parseJsonLenient(rawText) {
  const text = String(rawText || '').replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  if (!text) return null;
  const objectStart = text.indexOf('{');
  const objectEnd = text.lastIndexOf('}');
  const candidate = objectStart !== -1 && objectEnd > objectStart ? text.slice(objectStart, objectEnd + 1) : text;
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

function normalizeBullet(text) {
  return String(text || '')
    .replace(/^[-*\d.\s]+/, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function fallbackNarrative(sectionNo) {
  switch (sectionNo) {
    case 1:
      return ['기존 설비와 운영 데이터의 연결 범위를 먼저 정의해야 합니다.', '의사결정자는 운영 안정성과 절감 검증 방식을 동시에 검토해야 합니다.'];
    case 2:
      return ['통합 관제 구조는 기존 설비 연계를 우선 검토하고 단계적으로 확장하는 접근이 적합합니다.'];
    case 3:
      return ['절감 효과는 기준선 데이터와 적용 후 운영 로그를 함께 검증해야 합니다.'];
    case 4:
      return ['성과보장형 계약은 기준선 정의와 정산식 합의가 선행되어야 합니다.'];
    case 5:
      return ['유사 사례: (참고용) - 자료 부족'];
    case 6:
      return ['설계, 시공, 시운전, 안정화 단계를 분리해 승인 절차를 병행해야 합니다.', '운영 전환 시에는 검증 기준과 인수인계 책임을 명확히 해야 합니다.'];
    case 7:
      return ['Siemens는 빌딩 자동화와 운영 데이터를 하나의 운영 체계로 묶는 데 강점이 있습니다.', '국내 유지보수 체계와 글로벌 제품 로드맵을 함께 제시할 수 있습니다.'];
    default:
      return ['추가 검토가 필요합니다.'];
  }
}

function sanitizeNarrativeBullets(bullets, sectionNo, allowNumbers = true) {
  const cleaned = (Array.isArray(bullets) ? bullets : [])
    .map(normalizeBullet)
    .filter(Boolean)
    .filter((text) => allowNumbers || !NUMERIC_SIGNAL_RE.test(text))
    .slice(0, 4);
  return cleaned.length > 0 ? cleaned : fallbackNarrative(sectionNo);
}

function normalizeReferenceItem(item) {
  if (!item || typeof item !== 'object') return null;
  const client = normalizeBullet(item.client);
  const project = normalizeBullet(item.project);
  const result = normalizeBullet(item.result);
  const region = normalizeBullet(item.region);
  const sourceUrl = normalizeBullet(item.sourceUrl || item.source_url || '');
  if (!client || !project || !result) return null;
  return { client, project, result, region, sourceUrl };
}

function normalizeReferences(references) {
  return (Array.isArray(references) ? references : []).map(normalizeReferenceItem).filter(Boolean).slice(0, 3);
}

function buildBulletSection(sectionNo, heading, bullets) {
  return [`## ${sectionNo}. ${heading}`, ...bullets.map((bullet) => `- ${bullet}`)].join('\n');
}

function hasAllProposalHeadings(content) {
  for (let index = 1; index <= 7; index += 1) {
    if (!new RegExp(`(^|\\n)##\\s+${index}\\.`, 'm').test(String(content || ''))) return false;
  }
  return true;
}

function hasMarkdownTable(content) {
  return /^\|.+\|$/m.test(String(content || ''));
}

export function parseProposalSectionPayload(rawText) {
  return parseJsonLenient(rawText);
}

export function isValidProposalSectionPayload(payload) {
  if (!payload || typeof payload !== 'object') return false;
  const keys = Object.keys(payload).sort();
  if (keys.length !== 1 || keys[0] !== 'sections') return false;
  const sections = payload.sections;
  if (!sections || typeof sections !== 'object') return false;
  const sectionKeys = Object.keys(sections).sort();
  const expectedKeys = ['1', '2', '3', '4', '5', '6', '7'];
  if (sectionKeys.length !== expectedKeys.length) return false;
  if (!expectedKeys.every((key, index) => key === sectionKeys[index])) return false;
  for (const key of expectedKeys) {
    if (!Array.isArray(sections[key]) || sections[key].length === 0) return false;
    if (!sections[key].every((item) => typeof item === 'string' && normalizeBullet(item))) return false;
  }
  return true;
}

export function validateProposalSuccessPayload(payload) {
  if (!payload || payload.success !== true) return false;
  const keys = Object.keys(payload).sort();
  const expected = ['completeness', 'content', 'estimation', 'success'].sort();
  if (keys.length !== expected.length) return false;
  if (!expected.every((key, index) => key === keys[index])) return false;
  if (typeof payload.content !== 'string' || !payload.content.trim()) return false;
  if (!payload.completeness || typeof payload.completeness.allSections !== 'boolean') return false;
  if (!payload.estimation || typeof payload.estimation !== 'object') return false;
  if (hasMarkdownTable(payload.content)) return false;
  return hasAllProposalHeadings(payload.content) && payload.completeness.allSections === true;
}

function buildAssumptionBullets(proposalInput) {
  const bullets = [];
  bullets.push(proposalInput.monthlyEnergyCost > 0
    ? '월 에너지 비용 입력값을 기준선으로 사용했으며 전력요금 체계 세부 단가는 별도 검증이 필요합니다.'
    : '월 에너지 비용 미입력 상태이므로 면적 기준 기본 에너지 원단위를 적용했습니다.');
  bullets.push('운영 스케줄, 점유율, 계절 부하 프로파일은 제공되지 않아 표준 상업용 운영 패턴을 기준으로 검토했습니다.');
  bullets.push('기존 BMS 연계 범위, field bus 구성, 포인트 리스트는 미확정 상태로 가정했습니다.');
  return bullets;
}

function buildProjectOverviewSection(proposalInput, estimation, cpaEstimate, narrativeBullets = []) {
  const recommended = cpaEstimate.options.find((option) => option.scope === 'BEMS') || cpaEstimate.options[1] || cpaEstimate.options[0];
  const deterministicBullets = [
    'A(입력 요약)',
    mkDeterministicLine(
      '기본 조건',
      `빌딩 유형 ${formatBuildingType(proposalInput.buildingType)} / 연면적 ${formatNumber(proposalInput.area)}㎡ / 층수 ${formatNumber(proposalInput.floors)}층 / 현재 BMS ${proposalInput.currentBMS || '없음/미상'}`,
      'proposal input'
    ),
    mkDeterministicLine(
      '운영 입력',
      `시스템 범위 ${summarizeSystems(proposalInput.systemFlags)} / 월 에너지 비용 ${proposalInput.monthlyEnergyCost > 0 ? `${formatNumber(proposalInput.monthlyEnergyCost)}만원` : '미입력'}`,
      'proposal input'
    ),
    'B(기술과제)',
    ...sanitizeNarrativeBullets(narrativeBullets, 1, false),
    'C(산정결과 요약)',
    mkDeterministicLine(
      '산정 요약',
      `총 포인트 ${formatNumber(estimation.totalPoints)} / 권장 컨트롤러 ${formatNumber(estimation.controllers.recommended)}대 / 권장 ESCO 옵션 ${recommended.label}`,
      'estimation + CPA 권장안'
    ),
    mkDeterministicLine(
      '성과 요약',
      `권장 ESCO 절감률 ${formatPercent(recommended.savingsRate)} / 순연간 절감 ${formatCurrencyKr(recommended.netAnnualSavings)} / 투자회수 ${recommended.paybackYears >= 0 ? `${recommended.paybackYears}년` : 'N/A'}`,
      'CPA 권장안'
    ),
    'D(가정/리스크)',
    ...buildAssumptionBullets(proposalInput)
  ];
  return buildBulletSection(1, PROPOSAL_SECTION_HEADINGS[1], deterministicBullets);
}

export function buildSizingSection(estimation, floors, narrativeBullets = []) {
  const avgPerFloor = Math.round((Number(estimation.totalPoints) || 0) / Math.max(1, Number(floors) || 1));
  const deterministicBullets = [
    '시스템 구성도 설명 (HVAC, 조명, 전력, 방재 통합)',
    mkDeterministicLine('HVAC', `${formatNumber(estimation.pointsBySystem.hvac)} 포인트`, 'estimation.pointsBySystem.hvac'),
    mkDeterministicLine('조명', `${formatNumber(estimation.pointsBySystem.lighting)} 포인트`, 'estimation.pointsBySystem.lighting'),
    mkDeterministicLine('전력', `${formatNumber(estimation.pointsBySystem.power)} 포인트`, 'estimation.pointsBySystem.power'),
    mkDeterministicLine('방재', `${formatNumber(estimation.pointsBySystem.fire)} 포인트`, 'estimation.pointsBySystem.fire'),
    mkDeterministicLine('기타', `${formatNumber(estimation.pointsBySystem.extra)} 포인트`, 'estimation.pointsBySystem.extra'),
    mkDeterministicLine('총 포인트', `${formatNumber(estimation.totalPoints)} (범위 ${formatRange(estimation.pointRange.min, estimation.pointRange.max)})`, 'estimation.totalPoints + estimation.pointRange'),
    mkDeterministicLine('층당 평균', `${formatNumber(avgPerFloor)} 포인트`, 'estimation.totalPoints / floors'),
    mkDeterministicLine('컨트롤러', `최소 ${estimation.controllers.min}대 / 권장 ${estimation.controllers.recommended}대 / 최대 ${estimation.controllers.max}대`, 'estimation.controllers'),
    ...sanitizeNarrativeBullets(narrativeBullets, 2, false)
  ];
  return buildBulletSection(2, PROPOSAL_SECTION_HEADINGS[2], deterministicBullets);
}

export function buildEnergySection(proposalInput, cpaEstimate, narrativeBullets = []) {
  const recommended = cpaEstimate.options.find((option) => option.scope === 'BEMS') || cpaEstimate.options[1] || cpaEstimate.options[0];
  const annualEnergyCost = calcAnnualEnergyCost(proposalInput.monthlyEnergyCost, proposalInput.area, proposalInput.area);
  const deterministicBullets = [];

  if (Number(proposalInput.monthlyEnergyCost) > 0) {
    deterministicBullets.push(mkDeterministicLine('현재 연간 에너지 비용', formatCurrencyKr(annualEnergyCost), 'monthlyEnergyCost * 12 * 10,000'));
    deterministicBullets.push(mkDeterministicLine(`권장안(${recommended.label}) 절감률`, formatPercent(recommended.savingsRate), 'CPA 권장안'));
    deterministicBullets.push(mkDeterministicLine('예상 연간 절감액', `${formatCurrencyKr(recommended.annualSavings)} / 순절감액 ${formatCurrencyKr(recommended.netAnnualSavings)}`, 'CPA 권장안'));
    deterministicBullets.push(mkDeterministicLine('예상 투자회수 기간', recommended.paybackYears >= 0 ? `${recommended.paybackYears}년` : 'N/A', recommended.paybackYears >= 0 ? 'CPA 권장안' : '입력 데이터 부족 또는 회수기간 산정 불가'));
  } else {
    deterministicBullets.push(mkDeterministicLine('현재 연간 에너지 비용', 'N/A', '월 에너지 비용 미입력'));
    deterministicBullets.push(mkDeterministicLine(`권장안(${recommended.label}) 절감률 가정`, formatPercent(recommended.savingsRate), 'CPA 권장안'));
    deterministicBullets.push('금액 산정이 필요하면 최근 12개월 에너지 비용 데이터를 추가해야 합니다.');
  }

  deterministicBullets.push(...sanitizeNarrativeBullets(narrativeBullets, 3, false));
  deterministicBullets.push('M&V/검증');
  deterministicBullets.push('구축 전 기준선 로그와 구축 후 운영 로그를 동일 관점으로 비교 검증해야 합니다.');
  deterministicBullets.push('전력계 데이터, BMS trend, alarm 이력, 운영 스케줄 변경 기록을 함께 검토해야 합니다.');
  return buildBulletSection(3, PROPOSAL_SECTION_HEADINGS[3], deterministicBullets);
}

export function buildEscoSection(cpaEstimate, narrativeBullets = []) {
  const recommended = cpaEstimate.options.find((option) => option.scope === 'BEMS') || cpaEstimate.options[1] || cpaEstimate.options[0];
  const terms = buildEscoTermScenarios(recommended);
  const deterministicBullets = [
    mkDeterministicLine('추천 계약안', recommended.label, 'CPA 권장안'),
    mkDeterministicLine('총 투자비 / 5년 ROI', `${formatCurrencyKr(recommended.totalCost)} / ${formatPercent(recommended.roi5y)}`, 'CPA 권장안'),
    ...terms.map((term) => mkDeterministicLine(`${term.years}년 누적 순절감액`, `${formatCurrencyKr(term.netSavings)} / 투자비 커버리지 ${formatPercent(term.costCoverageRate)}`, 'CPA term scenario')),
    ...sanitizeNarrativeBullets(narrativeBullets, 4, false)
  ];
  return buildBulletSection(4, PROPOSAL_SECTION_HEADINGS[4], deterministicBullets);
}

function buildReferenceSection(references, narrativeBullets = []) {
  const normalizedRefs = normalizeReferences(references);
  if (normalizedRefs.length === 0) {
    return buildBulletSection(5, PROPOSAL_SECTION_HEADINGS[5], ['유사 사례: (참고용) - 자료 부족']);
  }
  const deterministicBullets = normalizedRefs.map((ref) => {
    const sourceNote = ref.sourceUrl ? ` / 출처 ${ref.sourceUrl}` : '';
    const regionNote = ref.region ? ` / 지역 ${ref.region}` : '';
    return `${ref.client} - ${ref.project} / 결과 ${ref.result}${regionNote}${sourceNote}`;
  });
  return buildBulletSection(5, PROPOSAL_SECTION_HEADINGS[5], [
    ...deterministicBullets,
    ...sanitizeNarrativeBullets(narrativeBullets, 5, false)
  ]);
}

function buildTimelineSection(narrativeBullets = []) {
  const deterministicBullets = [
    ...sanitizeNarrativeBullets(narrativeBullets, 6, false),
    'M&V/검증 placeholder',
    '설계 인수 기준, 시운전 완료 기준, 운영 인수인계 기준을 문서로 분리해 관리해야 합니다.',
    '절감 검증 기준선과 운영 안정화 판단 기준은 발주처와 사전 합의가 필요합니다.'
  ];
  return buildBulletSection(6, PROPOSAL_SECTION_HEADINGS[6], deterministicBullets);
}

export function composeProposalContent({ proposalInput, estimation, cpaEstimate, sections, references = [] }) {
  return [
    buildProjectOverviewSection(proposalInput, estimation, cpaEstimate, sections['1']),
    buildSizingSection(estimation, proposalInput.floors, sections['2']),
    buildEnergySection(proposalInput, cpaEstimate, sections['3']),
    buildEscoSection(cpaEstimate, sections['4']),
    buildReferenceSection(references, sections['5']),
    buildTimelineSection(sections['6']),
    buildBulletSection(7, PROPOSAL_SECTION_HEADINGS[7], sanitizeNarrativeBullets(sections['7'], 7, false))
  ].join('\n\n');
}
