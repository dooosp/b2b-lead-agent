import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSolutionTranslation } from '../lib/solution-translation.js';
import { hydrateLeadIntelligence } from '../lib/lead-intelligence.js';

function makeLead(overrides = {}) {
  return {
    id: 'lead_1',
    company: 'DL E&C',
    summary: '데이터센터 증설 및 냉각 설계 검토',
    product: '에너지 최적화 솔루션',
    painPoint: '냉각 부하 증가로 운영비 상승 우려',
    businessImpact: '전력비와 uptime 리스크 증가',
    urgency: 'HIGH',
    urgencyReason: '설계 단계에서 설비 표준을 확정해야 함',
    signalStrength: 84,
    roi: '근거 없음(추정 불가) - 기준선 데이터 확보 필요',
    buyingSignals: ['증설 일정 확정', '운영비 절감 과제'],
    meddic: {},
    missingInformation: ['예산 규모 미확인'],
    status: 'MEETING',
    updatedAt: '2026-02-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}

test('buildSolutionTranslation maps product knowledge into customer value language', () => {
  const translation = buildSolutionTranslation(makeLead());

  assert.equal(translation.productName, '에너지 최적화 솔루션');
  assert.match(translation.whyThisSolution, /냉각 부하 증가/);
  assert.match(translation.whyUs, /proof point|관련 proof point|운영 데이터/);
  assert.ok(Array.isArray(translation.implementationConsiderations));
});

test('hydrateLeadIntelligence adds solution translation output', () => {
  const hydrated = hydrateLeadIntelligence(makeLead());

  assert.ok(hydrated.solutionTranslation);
  assert.match(hydrated.solutionTranslation.whyNow, /설계 단계|증설 일정/);
});
