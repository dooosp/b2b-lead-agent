import { jsonResponse } from '../lib/utils.js';
import { calculateCpaEstimate, validateCpaOutput } from '../lib/cpa-estimator.js';

export async function calculateCPA(request) {
  const body = await request.json().catch(() => ({}));
  const areaNum = Number(body.area);
  const floorsNum = Number(body.floors);

  if (!areaNum || areaNum <= 0 || !floorsNum || floorsNum <= 0) {
    return jsonResponse({ success: false, message: '면적과 층수는 필수입니다.' }, 400);
  }

  const estimate = calculateCpaEstimate(body);
  if (!validateCpaOutput(estimate)) {
    return jsonResponse({ success: false, message: 'CPA 계산 결과 검증에 실패했습니다.' }, 500);
  }

  return jsonResponse({ success: true, ...estimate });
}
