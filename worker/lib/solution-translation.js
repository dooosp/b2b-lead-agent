import { resolveLeadProductEntry } from './product-catalog.js';

function unique(values) {
  return [...new Set((values || []).filter(Boolean).map((value) => String(value).trim()).filter(Boolean))];
}

function joinOrUnknown(values, fallback = 'unknown') {
  const items = unique(values);
  return items.length > 0 ? items.join(', ') : fallback;
}

function buildExpectedOutcome(lead, entry) {
  const outcomes = unique([
    ...(entry?.businessOutcomes || []),
    lead.businessImpact ? `${lead.businessImpact} 완화` : ''
  ]);
  return outcomes.length > 0 ? outcomes.join(', ') : 'unknown';
}

function buildRoiNarrative(lead, entry) {
  if (lead.roi && !/^근거 없음/.test(lead.roi) && lead.roi !== 'unknown') return lead.roi;
  const drivers = unique(entry?.roiDrivers || []);
  if (drivers.length > 0) {
    return `${drivers.join(', ')} 중심으로 ROI를 설계할 수 있으나, 기준선 데이터가 없어 현재는 정량 확정이 어렵습니다.`;
  }
  return 'unknown';
}

function buildWhyThisSolution(lead, entry) {
  if (!entry) {
    return lead.painPoint
      ? `${lead.painPoint}에 대응할 솔루션 적합성은 보이지만, 현재 제품 근거가 부족해 강한 매칭으로 단정하기 어렵습니다.`
      : 'unknown';
  }
  const pain = lead.painPoint || joinOrUnknown(entry.painsSolved);
  const useCases = joinOrUnknown(entry.useCases);
  return `${lead.product}는 ${pain}에 대응하도록 설계된 ${useCases} 중심 솔루션으로, 현재 리드 맥락과 직접 연결됩니다.`;
}

function buildWhyNow(lead, entry) {
  const trigger = unique([
    lead.urgencyReason,
    lead.eventType ? `${lead.eventType} 이벤트 발생` : '',
    ...(lead.buyingSignals || [])
  ]);
  if (trigger.length > 0) return trigger.join(' / ');
  if (entry?.useCases?.length) return `${entry.useCases[0]} 검토 시점으로 보이지만, 구체적 일정 근거는 추가 확인이 필요합니다.`;
  return 'unknown';
}

function buildWhyUs(entry) {
  if (!entry) return 'unknown';
  const differentiators = unique(entry.differentiators || []);
  const proofPoints = unique(entry.proofPoints || []);
  if (differentiators.length === 0 && proofPoints.length === 0) return 'unknown';
  return [differentiators.slice(0, 2).join(', '), proofPoints[0] ? `관련 proof point: ${proofPoints[0]}` : '']
    .filter(Boolean)
    .join(' / ');
}

export function buildSolutionTranslation(lead) {
  const entry = resolveLeadProductEntry(lead);
  return {
    productName: lead.product || 'unknown',
    fitConfidence: entry ? (lead.signalStrength >= 80 ? 'HIGH' : lead.signalStrength >= 60 ? 'MEDIUM' : 'LOW') : 'LOW',
    whyThisSolution: buildWhyThisSolution(lead, entry),
    whyNow: buildWhyNow(lead, entry),
    whyUs: buildWhyUs(entry),
    painsSolved: unique([lead.painPoint, ...(entry?.painsSolved || [])]).slice(0, 5),
    expectedBusinessOutcome: buildExpectedOutcome(lead, entry),
    implementationConsiderations: unique([
      ...(entry?.technicalRequirements || []),
      ...(entry?.integrationConstraints || []),
      entry?.deploymentComplexity ? `배포 복잡도: ${entry.deploymentComplexity}` : ''
    ]).slice(0, 6),
    roiNarrative: buildRoiNarrative(lead, entry),
    proofPoints: unique(entry?.proofPoints || []).slice(0, 4),
    differentiators: unique(entry?.differentiators || []).slice(0, 4),
    commonObjections: unique(entry?.commonObjections || []).slice(0, 4)
  };
}
