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

const NUMERIC_SIGNAL_RE = /(?:\d|%|원|만원|억원|조원|㎡|m²|층|개월|point|포인트|controller|컨트롤러|대)/i;

function formatNumber(value) {
  return Number(value || 0).toLocaleString('ko-KR');
}

function formatCurrencyKr(value) {
  const amount = Number(value || 0);
  return `${amount.toLocaleString('ko-KR')}원`;
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
      return ['현장 운영 데이터와 기존 설비 구성을 함께 진단해 우선 과제를 정리해야 합니다.', '의사결정자는 운영 안정성과 에너지 비용 절감을 동시에 검토해야 합니다.'];
    case 2:
      return ['통합 관제 구조는 기존 설비 연계를 우선 검토하고 단계적으로 확장하는 접근이 적합합니다.'];
    case 3:
      return ['절감 효과는 실제 운전 데이터와 제어 포인트 목록으로 검증해야 합니다.'];
    case 4:
      return ['성과보장형 계약은 기준선 데이터와 검증 절차를 먼저 합의해야 합니다.'];
    case 5:
      return ['유사 사례는 업종, 규모, 기존 설비 구성이 비슷한 순서로 비교해야 합니다.', '레퍼런스 검토 시 구축 범위와 운영 지표를 함께 확인해야 합니다.'];
    case 6:
      return ['설계, 시공, 시운전, 안정화 단계로 나누어 승인 절차를 병행해야 합니다.', '운영 중단 리스크를 줄이기 위해 단계별 전환 계획이 필요합니다.'];
    case 7:
      return ['Siemens는 빌딩 자동화와 에너지 운영 데이터를 하나의 운영 체계로 묶는 데 강점이 있습니다.', '국내 유지보수 체계와 글로벌 제품 로드맵을 함께 제시할 수 있습니다.'];
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

export function parseProposalSectionPayload(rawText) {
  return parseJsonLenient(rawText);
}

export function isValidProposalSectionPayload(payload) {
  if (!payload || typeof payload !== 'object') return false;
  const sections = payload.sections;
  if (!sections || typeof sections !== 'object') return false;
  for (let index = 1; index <= 7; index += 1) {
    const key = String(index);
    if (!Array.isArray(sections[key]) || sections[key].length === 0) return false;
    if (!sections[key].every((item) => typeof item === 'string' && normalizeBullet(item))) return false;
  }
  return true;
}

function buildBulletSection(sectionNo, heading, bullets) {
  return [`## ${sectionNo}. ${heading}`, ...bullets.map((bullet) => `- ${bullet}`)].join('\n');
}

export function buildSizingSection(estimation, floors, narrativeBullets = []) {
  const avgPerFloor = Math.round((Number(estimation.totalPoints) || 0) / Math.max(1, Number(floors) || 1));
  const deterministicBullets = [
    '시스템 구성도 설명 (HVAC, 조명, 전력, 방재 통합)',
    `HVAC: ${formatNumber(estimation.pointsBySystem.hvac)} 포인트`,
    `조명: ${formatNumber(estimation.pointsBySystem.lighting)} 포인트`,
    `전력: ${formatNumber(estimation.pointsBySystem.power)} 포인트`,
    `방재: ${formatNumber(estimation.pointsBySystem.fire)} 포인트`,
    `기타: ${formatNumber(estimation.pointsBySystem.extra)} 포인트`,
    `총 포인트: ${formatNumber(estimation.totalPoints)} (범위 ${formatNumber(estimation.pointRange.min)}~${formatNumber(estimation.pointRange.max)})`,
    `층당 평균: ${formatNumber(avgPerFloor)} 포인트`,
    `컨트롤러: 최소 ${estimation.controllers.min}대 / 권장 ${estimation.controllers.recommended}대 / 최대 ${estimation.controllers.max}대`
  ];
  const narrative = sanitizeNarrativeBullets(narrativeBullets, 2, false);
  return buildBulletSection(2, PROPOSAL_SECTION_HEADINGS[2], [...deterministicBullets, ...narrative]);
}

export function buildEnergySection(proposalInput, cpaEstimate, narrativeBullets = []) {
  const recommended = cpaEstimate.options.find((option) => option.scope === 'BEMS') || cpaEstimate.options[1] || cpaEstimate.options[0];
  const annualEnergyCost = calcAnnualEnergyCost(proposalInput.monthlyEnergyCost, proposalInput.area, proposalInput.area);
  const deterministicBullets = [];

  if (Number(proposalInput.monthlyEnergyCost) > 0) {
    deterministicBullets.push(`현재 연간 에너지 비용(코드 산정): ${formatCurrencyKr(annualEnergyCost)}`);
    deterministicBullets.push(`권장안(${recommended.label}) 적용 시 예상 절감률: ${recommended.savingsRate}%`);
    deterministicBullets.push(`예상 연간 절감액: ${formatCurrencyKr(recommended.annualSavings)} / 순절감액: ${formatCurrencyKr(recommended.netAnnualSavings)}`);
    deterministicBullets.push(
      recommended.paybackYears >= 0
        ? `예상 투자회수 기간: ${recommended.paybackYears}년`
        : '예상 투자회수 기간: N/A (현재 입력값 기준 5년 내 회수 어려움)'
    );
  } else {
    deterministicBullets.push('월 에너지 비용이 입력되지 않아 금액 절감액은 계산하지 않았습니다.');
    deterministicBullets.push(`권장안(${recommended.label}) 기준 절감률 가정: ${recommended.savingsRate}%`);
    deterministicBullets.push('금액 산정이 필요하면 최근 12개월 에너지 비용 데이터를 추가해야 합니다.');
  }

  const narrative = sanitizeNarrativeBullets(narrativeBullets, 3, false);
  return buildBulletSection(3, PROPOSAL_SECTION_HEADINGS[3], [...deterministicBullets, ...narrative]);
}

export function buildEscoSection(cpaEstimate, narrativeBullets = []) {
  const recommended = cpaEstimate.options.find((option) => option.scope === 'BEMS') || cpaEstimate.options[1] || cpaEstimate.options[0];
  const terms = buildEscoTermScenarios(recommended);
  const deterministicBullets = [
    `추천 계약안(코드 산정): ${recommended.label}`,
    `총 투자비: ${formatCurrencyKr(recommended.totalCost)} / 5년 ROI: ${recommended.roi5y}%`,
    ...terms.map((term) => `${term.years}년 누적 순절감액: ${formatCurrencyKr(term.netSavings)} / 투자비 커버리지 ${term.costCoverageRate}%`)
  ];
  const narrative = sanitizeNarrativeBullets(narrativeBullets, 4, false);
  return buildBulletSection(4, PROPOSAL_SECTION_HEADINGS[4], [...deterministicBullets, ...narrative]);
}

export function composeProposalContent({ proposalInput, estimation, cpaEstimate, sections }) {
  const orderedSections = [
    buildBulletSection(1, PROPOSAL_SECTION_HEADINGS[1], sanitizeNarrativeBullets(sections['1'], 1, true)),
    buildSizingSection(estimation, proposalInput.floors, sections['2']),
    buildEnergySection(proposalInput, cpaEstimate, sections['3']),
    buildEscoSection(cpaEstimate, sections['4']),
    buildBulletSection(5, PROPOSAL_SECTION_HEADINGS[5], sanitizeNarrativeBullets(sections['5'], 5, true)),
    buildBulletSection(6, PROPOSAL_SECTION_HEADINGS[6], sanitizeNarrativeBullets(sections['6'], 6, false)),
    buildBulletSection(7, PROPOSAL_SECTION_HEADINGS[7], sanitizeNarrativeBullets(sections['7'], 7, true))
  ];
  return orderedSections.join('\n\n');
}
