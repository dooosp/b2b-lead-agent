// 업계 평균 기준 추정 단가. 실 견적 연동 시 이 상수를 교체하면 된다.
const BASE_PRICES = Object.freeze({
  bms: { basic: 45000, standard: 72000, premium: 110000 },
  bems: { basic: 62000, standard: 95000, premium: 145000 },
  full: { basic: 85000, standard: 130000, premium: 195000 }
});

const REGION_FACTORS = Object.freeze({
  seoul: 1.15,
  metropolitan: 1.05,
  local: 0.95,
  jeju: 1.1
});

const BUILDING_FACTORS = Object.freeze({
  office: 1.0,
  datacenter: 1.35,
  hospital: 1.25,
  hotel: 1.1,
  factory: 0.9,
  school: 0.85,
  apartment: 0.8,
  commercial: 1.05
});

const SAVINGS_RATE = Object.freeze({
  bms: { basic: 0.15, standard: 0.22, premium: 0.3 },
  bems: { basic: 0.2, standard: 0.28, premium: 0.35 },
  full: { basic: 0.25, standard: 0.33, premium: 0.4 }
});

const MAINTENANCE_RATE = Object.freeze({ basic: 0.015, standard: 0.018, premium: 0.02 });

export const CPA_BUILDING_TYPES = Object.freeze(Object.keys(BUILDING_FACTORS));
export const CPA_REGIONS = Object.freeze(Object.keys(REGION_FACTORS));

function getFloorFactor(floors) {
  if (floors <= 5) return 0.9;
  if (floors <= 15) return 1.0;
  if (floors <= 30) return 1.1;
  if (floors <= 50) return 1.2;
  return 1.3;
}

function getScaleDiscount(area) {
  if (area <= 10000) return 1.0;
  if (area <= 30000) return 0.92;
  if (area <= 50000) return 0.85;
  if (area <= 80000) return 0.78;
  if (area <= 100000) return 0.73;
  if (area <= 150000) return 0.68;
  return 0.65;
}

// 월 에너지 비용이 있으면 연간 비용으로 환산하고, 없으면 면적당 기본 원단위를 사용한다.
export function calcAnnualEnergyCost(monthlyCost, area, baseArea = area) {
  if (Number(monthlyCost) > 0) {
    return Math.round(Number(monthlyCost) * 12 * 10000 * (Number(area) / Math.max(1, Number(baseArea))));
  }
  return Math.round(Number(area) * 18000);
}

export function normalizeCpaInput(body = {}) {
  const areaNum = Number(body.area);
  const floorsNum = Number(body.floors);
  const monthlyEnergyCost = Number(body.monthlyEnergyCost) || 0;
  const buildingType = BUILDING_FACTORS[body.buildingType] ? body.buildingType : 'office';
  const region = REGION_FACTORS[body.region] ? body.region : 'seoul';
  return {
    area: areaNum,
    floors: floorsNum,
    buildingType,
    region,
    monthlyEnergyCost
  };
}

export function calculateCpaEstimate(body = {}) {
  const input = normalizeCpaInput(body);
  const { area, floors, buildingType, region, monthlyEnergyCost } = input;
  const buildingFactor = BUILDING_FACTORS[buildingType];
  const regionFactor = REGION_FACTORS[region];
  const floorFactor = getFloorFactor(floors);
  const scaleFactor = getScaleDiscount(area);
  const annualEnergy = calcAnnualEnergyCost(monthlyEnergyCost, area, area);

  const scopes = ['bms', 'bems', 'full'];
  const tiers = ['basic', 'standard', 'premium'];
  const options = scopes.map((scope, index) => {
    const tier = tiers[index];
    const unitCost = Math.round(BASE_PRICES[scope][tier] * buildingFactor * regionFactor * floorFactor * scaleFactor);
    const totalCost = unitCost * area;
    const savingsRate = SAVINGS_RATE[scope][tier];
    const annualSavings = Math.round(annualEnergy * savingsRate);
    const maintenanceCost = Math.round(totalCost * MAINTENANCE_RATE[tier]);
    const netAnnualSavings = annualSavings - maintenanceCost;
    const paybackYears = netAnnualSavings > 0 ? Number((totalCost / netAnnualSavings).toFixed(1)) : -1;
    const tco5y = totalCost + (maintenanceCost * 5);
    const savings5y = annualSavings * 5;
    const roi5y = tco5y > 0 ? Number((((savings5y - tco5y) / tco5y) * 100).toFixed(1)) : 0;
    return {
      scope: scope.toUpperCase(),
      tier,
      label: scope === 'bms' ? 'BMS 기본' : scope === 'bems' ? 'BEMS 통합' : 'Full Smart Building',
      unitCost,
      totalCost,
      savingsRate: Number((savingsRate * 100).toFixed(1)),
      annualSavings,
      maintenanceCost,
      netAnnualSavings,
      paybackYears,
      tco5y,
      savings5y,
      roi5y
    };
  });

  const bemsRate = SAVINGS_RATE.bems.standard;
  const bemsMaint = MAINTENANCE_RATE.standard;
  const sensitivity = [-20, -10, 0, 10, 20].map((pct) => {
    const adjustedArea = Math.round(area * (1 + pct / 100));
    const adjustedScale = getScaleDiscount(adjustedArea);
    const adjustedUnitCost = Math.round(BASE_PRICES.bems.standard * buildingFactor * regionFactor * floorFactor * adjustedScale);
    const totalCost = adjustedUnitCost * adjustedArea;
    const annualEnergyCost = calcAnnualEnergyCost(monthlyEnergyCost, adjustedArea, area);
    const annualSavings = Math.round(annualEnergyCost * bemsRate);
    const maintenanceCost = Math.round(totalCost * bemsMaint);
    const netAnnualSavings = annualSavings - maintenanceCost;
    const paybackYears = netAnnualSavings > 0 ? Number((totalCost / netAnnualSavings).toFixed(1)) : -1;
    return {
      pct,
      area: adjustedArea,
      totalCost,
      annualSavings,
      netAnnualSavings,
      paybackYears
    };
  });

  const estimate = {
    input,
    options,
    sensitivity,
    escoNote: ''
  };
  estimate.escoNote = buildDeterministicEscoNote(estimate);
  return estimate;
}

export function buildEscoTermScenarios(option, yearsList = [5, 7, 10]) {
  const totalCost = Number(option && option.totalCost) || 0;
  const annualSavings = Number(option && option.annualSavings) || 0;
  const maintenanceCost = Number(option && option.maintenanceCost) || 0;
  const netAnnualSavings = Number(option && option.netAnnualSavings);
  const annualNet = Number.isFinite(netAnnualSavings) ? netAnnualSavings : annualSavings - maintenanceCost;

  return yearsList.map((years) => {
    const grossSavings = annualSavings * years;
    const totalMaintenance = maintenanceCost * years;
    const netSavings = annualNet * years;
    const remainingCapex = Math.max(0, totalCost - netSavings);
    const costCoverageRate = totalCost > 0 ? Number(((netSavings / totalCost) * 100).toFixed(1)) : 0;
    return {
      years,
      grossSavings,
      totalMaintenance,
      netSavings,
      remainingCapex,
      costCoverageRate,
      paybackAchieved: annualNet > 0 && (annualNet * years) >= totalCost
    };
  });
}

export function validateCpaOutput(output) {
  if (!output || typeof output !== 'object') return false;
  if (!output.input || typeof output.input !== 'object') return false;
  if (!Array.isArray(output.options)) return false;
  if (!Array.isArray(output.sensitivity)) return false;
  if (typeof output.escoNote !== 'string') return false;

  const input = output.input;
  if (!(Number(input.area) > 0)) return false;
  if (!(Number(input.floors) > 0)) return false;
  if (!CPA_BUILDING_TYPES.includes(input.buildingType)) return false;
  if (!CPA_REGIONS.includes(input.region)) return false;
  if (!(Number(input.monthlyEnergyCost) >= 0)) return false;

  for (const option of output.options) {
    if (!option || typeof option !== 'object') return false;
    if (typeof option.label !== 'string' || !option.label.trim()) return false;
    if (!(Number(option.unitCost) >= 0)) return false;
    if (!(Number(option.totalCost) >= 0)) return false;
    if (!(Number(option.savingsRate) >= 0)) return false;
    if (!(Number(option.annualSavings) >= 0)) return false;
    if (!(Number(option.maintenanceCost) >= 0)) return false;
    if (!(Number(option.paybackYears) >= 0 || Number(option.paybackYears) === -1)) return false;
    if (!(typeof option.roi5y === 'number')) return false;
  }

  for (const item of output.sensitivity) {
    if (!item || typeof item !== 'object') return false;
    if (typeof item.pct !== 'number') return false;
    if (!(Number(item.area) >= 0)) return false;
    if (!(Number(item.totalCost) >= 0)) return false;
    if (!(Number(item.annualSavings) >= 0)) return false;
    if (!(Number(item.paybackYears) >= 0 || Number(item.paybackYears) === -1)) return false;
  }

  return true;
}

export function validateCpaSuccessPayload(payload) {
  if (!payload || payload.success !== true) return false;
  const keys = Object.keys(payload).sort();
  const expected = ['success', 'input', 'options', 'sensitivity', 'escoNote'].sort();
  if (keys.length !== expected.length) return false;
  if (!expected.every((key, index) => key === keys[index])) return false;
  return validateCpaOutput(payload);
}

export function buildDeterministicEscoNote(estimate) {
  const recommended = (estimate && Array.isArray(estimate.options))
    ? (estimate.options.find((option) => option.scope === 'BEMS') || estimate.options[1] || estimate.options[0])
    : null;
  const baseCase = Array.isArray(estimate && estimate.sensitivity)
    ? estimate.sensitivity.find((item) => item.pct === 0)
    : null;

  if (!recommended) {
    return '샘플 계약 구조: ESCO 모델 적용 시 초기 투자 0원을 전제로 검토할 수 있으나, 기준선 데이터가 부족해 현재는 권장안을 확정할 수 없습니다.';
  }

  const paybackText = recommended.paybackYears >= 0
    ? `${recommended.paybackYears}년 수준의 투자회수 가정`
    : '현재 입력값 기준으로는 투자회수 기간이 N/A';
  const sensitivityText = baseCase
    ? `기준 면적 ${baseCase.area.toLocaleString('ko-KR')}㎡에서 연간 순절감 효과를 우선 검토했습니다.`
    : '민감도 기준선 데이터가 없어 면적 변동 영향은 별도 검토가 필요합니다.';

  return [
    '샘플 계약 구조: ESCO 모델 적용 시 초기 투자 0원 가정을 전제로 합니다.',
    `${recommended.label} 기준 총 투자비 ${recommended.totalCost.toLocaleString('ko-KR')}원, 절감률 ${recommended.savingsRate}%, 순절감 ${recommended.netAnnualSavings.toLocaleString('ko-KR')}원/년을 기준으로 성과보장형 계약을 검토합니다.`,
    `${paybackText}. ${sensitivityText}`,
    '실제 계약 조건은 기준선 에너지 사용량, 검증 방식, 정산식을 확정한 뒤 조정해야 합니다.'
  ].join(' ');
}
