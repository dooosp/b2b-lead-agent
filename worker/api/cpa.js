import { jsonResponse } from '../lib/utils.js';

// 기본 단가 DB (원/㎡) — BMS 범위 × 등급
const BASE_PRICES = {
  bms:  { basic: 45000,  standard: 72000,  premium: 110000 },
  bems: { basic: 62000,  standard: 95000,  premium: 145000 },
  full: { basic: 85000,  standard: 130000, premium: 195000 }
};

// 지역 계수
const REGION_FACTORS = {
  seoul: 1.15, metropolitan: 1.05, local: 0.95, jeju: 1.10
};

// 빌딩 유형 계수
const BUILDING_FACTORS = {
  office: 1.0, datacenter: 1.35, hospital: 1.25, hotel: 1.10,
  factory: 0.90, school: 0.85, apartment: 0.80, commercial: 1.05
};

// 층수 계수 (고층일수록 복잡도 증가)
function getFloorFactor(floors) {
  if (floors <= 5) return 0.90;
  if (floors <= 15) return 1.00;
  if (floors <= 30) return 1.10;
  if (floors <= 50) return 1.20;
  return 1.30;
}

// 에너지 절감률 (범위 × 등급)
const SAVINGS_RATE = {
  bms:  { basic: 0.15, standard: 0.22, premium: 0.30 },
  bems: { basic: 0.20, standard: 0.28, premium: 0.35 },
  full: { basic: 0.25, standard: 0.33, premium: 0.40 }
};

// 연간 유지보수비율
const MAINTENANCE_RATE = { basic: 0.03, standard: 0.04, premium: 0.05 };

export async function calculateCPA(request) {
  const body = await request.json().catch(() => ({}));
  const { area, floors, buildingType, region, monthlyEnergyCost } = body;

  const areaNum = Number(area);
  const floorsNum = Number(floors);
  const monthlyCost = Number(monthlyEnergyCost) || 0;

  if (!areaNum || areaNum <= 0 || !floorsNum || floorsNum <= 0) {
    return jsonResponse({ success: false, message: '면적과 층수는 필수입니다.' }, 400);
  }

  const bType = BUILDING_FACTORS[buildingType] ? buildingType : 'office';
  const reg = REGION_FACTORS[region] ? region : 'seoul';
  const buildingFactor = BUILDING_FACTORS[bType];
  const regionFactor = REGION_FACTORS[reg];
  const floorFactor = getFloorFactor(floorsNum);

  // 3가지 옵션 계산
  const scopes = ['bms', 'bems', 'full'];
  const tiers = ['basic', 'standard', 'premium'];
  const options = scopes.map((scope, i) => {
    const tier = tiers[i];
    const basePrice = BASE_PRICES[scope][tier];
    const unitCost = Math.round(basePrice * buildingFactor * regionFactor * floorFactor);
    const totalCost = unitCost * areaNum;
    const savingsRate = SAVINGS_RATE[scope][tier];
    const annualEnergy = monthlyCost > 0 ? monthlyCost * 12 * 10000 : areaNum * 18000; // 미입력 시 ㎡당 18,000원/년 가정
    const annualSavings = Math.round(annualEnergy * savingsRate);
    const maintenanceCost = Math.round(totalCost * MAINTENANCE_RATE[tier]);
    const netAnnualSavings = annualSavings - maintenanceCost;
    const paybackYears = netAnnualSavings > 0 ? +(totalCost / netAnnualSavings).toFixed(1) : 0;

    // 5년 TCO/ROI
    const tco5y = totalCost + (maintenanceCost * 5);
    const savings5y = annualSavings * 5;
    const roi5y = tco5y > 0 ? +((savings5y - tco5y) / tco5y * 100).toFixed(1) : 0;

    return {
      scope: scope.toUpperCase(),
      tier,
      label: scope === 'bms' ? 'BMS 기본' : scope === 'bems' ? 'BEMS 통합' : 'Full Smart Building',
      unitCost,
      totalCost,
      savingsRate: +(savingsRate * 100).toFixed(1),
      annualSavings,
      maintenanceCost,
      netAnnualSavings,
      paybackYears,
      tco5y,
      savings5y,
      roi5y
    };
  });

  // 민감도 분석 — 면적 ±20%
  const sensitivity = [-20, -10, 0, 10, 20].map(pct => {
    const adjArea = Math.round(areaNum * (1 + pct / 100));
    const rec = options[1]; // BEMS standard 기준
    const adjTotal = rec.unitCost * adjArea;
    const adjAnnualEnergy = monthlyCost > 0 ? monthlyCost * 12 * 10000 : adjArea * 18000;
    const adjSavings = Math.round(adjAnnualEnergy * SAVINGS_RATE.bems.standard);
    const adjMaint = Math.round(adjTotal * MAINTENANCE_RATE.standard);
    const adjNet = adjSavings - adjMaint;
    const adjPayback = adjNet > 0 ? +(adjTotal / adjNet).toFixed(1) : 0;
    return { pct, area: adjArea, totalCost: adjTotal, annualSavings: adjSavings, paybackYears: adjPayback };
  });

  return jsonResponse({
    success: true,
    input: { area: areaNum, floors: floorsNum, buildingType: bType, region: reg, monthlyEnergyCost: monthlyCost },
    options,
    sensitivity,
    escoNote: '* ESCO 모델 적용 시 초기 투자 0원, 절감 보장 20~35%. 별도 상담 필요.'
  });
}
