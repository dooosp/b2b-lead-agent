import { jsonResponse } from '../lib/utils.js';
import { calculateCpaEstimate, validateCpaSuccessPayload } from '../lib/cpa-estimator.js';

function buildCpaErrorResponse(error, status = 500, input = {}) {
  return jsonResponse({
    success: false,
    error,
    input,
    options: [],
    sensitivity: [],
    escoNote: ''
  }, status);
}

export async function calculateCPA(request) {
  const body = await request.json().catch(() => ({}));
  const areaNum = Number(body.area);
  const floorsNum = Number(body.floors);
  const input = {
    area: Number(body.area) || 0,
    floors: Number(body.floors) || 0,
    buildingType: body.buildingType || 'office',
    region: body.region || 'seoul',
    monthlyEnergyCost: Number(body.monthlyEnergyCost) || 0
  };

  if (!areaNum || areaNum <= 0 || !floorsNum || floorsNum <= 0) {
    return buildCpaErrorResponse('면적과 층수는 필수입니다.', 400, input);
  }

  const estimate = calculateCpaEstimate(body);
  const payload = { success: true, ...estimate };
  if (!validateCpaSuccessPayload(payload)) {
    return buildCpaErrorResponse('CPA 계산 결과 검증에 실패했습니다.', 500, estimate.input);
  }

  return jsonResponse(payload);
}
