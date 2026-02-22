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

// 규모 할인 계수 (economies of scale)
function getScaleDiscount(area) {
  if (area <= 10000) return 1.0;
  if (area <= 30000) return 0.92;
  if (area <= 50000) return 0.85;
  if (area <= 80000) return 0.78;
  if (area <= 100000) return 0.73;
  if (area <= 150000) return 0.68;
  return 0.65;
}

// 에너지 절감률 (범위 × 등급)
const SAVINGS_RATE = {
  bms:  { basic: 0.15, standard: 0.22, premium: 0.30 },
  bems: { basic: 0.20, standard: 0.28, premium: 0.35 },
  full: { basic: 0.25, standard: 0.33, premium: 0.40 }
};

// 연간 유지보수비율 (업계 기준 1.5~2.0%)
const MAINTENANCE_RATE = { basic: 0.015, standard: 0.018, premium: 0.02 };

// 연간 에너지 비용 계산 (면적 기반)
function calcAnnualEnergy(monthlyCost, area, baseArea) {
  if (monthlyCost > 0) {
    // 사용자 입력값을 면적 비례로 스케일링
    return monthlyCost * 12 * 10000 * (area / baseArea);
  }
  return area * 18000; // 미입력 시 ㎡당 18,000원/년 가정
}

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
  const scaleFactor = getScaleDiscount(areaNum);

  // 3가지 옵션 계산
  const scopes = ['bms', 'bems', 'full'];
  const tiers = ['basic', 'standard', 'premium'];
  const options = scopes.map((scope, i) => {
    const tier = tiers[i];
    const basePrice = BASE_PRICES[scope][tier];
    const unitCost = Math.round(basePrice * buildingFactor * regionFactor * floorFactor * scaleFactor);
    const totalCost = unitCost * areaNum;
    const savingsRate = SAVINGS_RATE[scope][tier];
    const annualEnergy = calcAnnualEnergy(monthlyCost, areaNum, areaNum);
    const annualSavings = Math.round(annualEnergy * savingsRate);
    const maintenanceCost = Math.round(totalCost * MAINTENANCE_RATE[tier]);
    const netAnnualSavings = annualSavings - maintenanceCost;
    const paybackYears = netAnnualSavings > 0 ? +(totalCost / netAnnualSavings).toFixed(1) : -1;

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

  // 민감도 분석 — 면적 ±20%, 에너지비도 면적 비례로 재계산
  const bemsRate = SAVINGS_RATE.bems.standard;
  const bemsMaint = MAINTENANCE_RATE.standard;
  const sensitivity = [-20, -10, 0, 10, 20].map(pct => {
    const adjArea = Math.round(areaNum * (1 + pct / 100));
    const adjScale = getScaleDiscount(adjArea);
    const adjUnitCost = Math.round(BASE_PRICES.bems.standard * buildingFactor * regionFactor * floorFactor * adjScale);
    const adjTotal = adjUnitCost * adjArea;
    const adjAnnualEnergy = calcAnnualEnergy(monthlyCost, adjArea, areaNum);
    const adjSavings = Math.round(adjAnnualEnergy * bemsRate);
    const adjMaint = Math.round(adjTotal * bemsMaint);
    const adjNet = adjSavings - adjMaint;
    const adjPayback = adjNet > 0 ? +(adjTotal / adjNet).toFixed(1) : -1;
    return { pct, area: adjArea, totalCost: adjTotal, annualSavings: adjSavings, netAnnualSavings: adjNet, paybackYears: adjPayback };
  });

  return jsonResponse({
    success: true,
    input: { area: areaNum, floors: floorsNum, buildingType: bType, region: reg, monthlyEnergyCost: monthlyCost },
    options,
    sensitivity,
    escoNote: '* ESCO 모델 적용 시 초기 투자 0원, 절감 보장 20~35%. 별도 상담 필요.'
  });
}
