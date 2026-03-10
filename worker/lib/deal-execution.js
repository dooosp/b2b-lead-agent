function diffDays(fromDate, toDate) {
  if (!fromDate || !toDate) return 0;
  const from = new Date(fromDate);
  const to = new Date(toDate);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;
  return Math.max(0, Math.floor((to - from) / 86400000));
}

function normalizeUrgency(lead, riskScore, overdueFollowup, inactivityRisk) {
  if (lead.urgency) return lead.urgency;
  if (overdueFollowup || riskScore >= 75 || inactivityRisk === 'HIGH') return 'HIGH';
  if (riskScore >= 45) return 'MEDIUM';
  return 'LOW';
}

export function buildDealExecution(lead, nowIso = new Date().toISOString()) {
  const stageReference = lead.updatedAt || lead.createdAt || nowIso;
  const daysInStage = diffDays(stageReference, nowIso);
  const today = nowIso.slice(0, 10);
  const overdueFollowup = Boolean(lead.followUpDate && lead.followUpDate < today && !['WON', 'LOST'].includes(lead.status));
  const daysSinceUpdate = diffDays(lead.updatedAt || lead.createdAt || nowIso, nowIso);
  const inactivityRisk = daysSinceUpdate >= 21 ? 'HIGH' : daysSinceUpdate >= 10 ? 'MEDIUM' : 'LOW';
  const championMissing = !(lead.meddic && lead.meddic.champion) && !/champion|스폰서|주도|담당/i.test(lead.stakeholderHint || '');
  const budgetUnknown = !(lead.meddic && lead.meddic.budget);
  const decisionProcessUnknown = !(lead.meddic && lead.meddic.decisionProcess);
  const stalled = !['WON', 'LOST'].includes(lead.status) && (daysInStage >= 21 || overdueFollowup || inactivityRisk === 'HIGH');

  const reasons = [];
  let score = 0;
  if (overdueFollowup) { reasons.push('후속 일정이 지났습니다.'); score += 25; }
  if (inactivityRisk === 'HIGH') { reasons.push('최근 업데이트가 오래됐습니다.'); score += 20; }
  else if (inactivityRisk === 'MEDIUM') { reasons.push('활동 빈도가 낮아지고 있습니다.'); score += 10; }
  if (championMissing) { reasons.push('내부 챔피언이 확인되지 않았습니다.'); score += 15; }
  if (budgetUnknown) { reasons.push('예산 근거가 비어 있습니다.'); score += 12; }
  if (decisionProcessUnknown) { reasons.push('의사결정 프로세스가 불명확합니다.'); score += 12; }
  if (daysInStage >= 30) { reasons.push('현재 단계 체류 기간이 깁니다.'); score += 16; }
  if (!lead.signalStrength) { reasons.push('구매 신호 강도가 아직 약합니다.'); score += 8; }
  if (lead.confidence === 'LOW') { reasons.push('근거 신뢰도가 낮습니다.'); score += 10; }

  const dealRiskScore = Math.min(100, score);
  let recommendedNextAction = '다음 미팅 아젠다와 의사결정자를 확인하세요.';
  if (overdueFollowup) recommendedNextAction = '오늘 안에 후속 연락을 재개하고 미팅/콜 일정을 다시 확정하세요.';
  else if (championMissing) recommendedNextAction = '실무 챔피언 또는 내부 스폰서를 특정하고 1:1 검증 미팅을 잡으세요.';
  else if (budgetUnknown) recommendedNextAction = '예산 범위와 승인 타이밍을 확인할 수 있는 질문지를 보내세요.';
  else if (decisionProcessUnknown) recommendedNextAction = '평가 단계, 승인 라인, 구매 일정이 포함된 의사결정 맵을 확보하세요.';
  else if (lead.missingInformation?.length) recommendedNextAction = `누락 정보 우선 확인: ${lead.missingInformation[0]}.`;

  return {
    leadId: lead.id || '',
    currentStage: lead.status || 'NEW',
    daysInStage,
    overdueFollowup,
    inactivityRisk,
    championMissing,
    budgetUnknown,
    decisionProcessUnknown,
    dealRiskScore,
    dealRiskReason: reasons,
    recommendedNextAction,
    urgency: normalizeUrgency(lead, dealRiskScore, overdueFollowup, inactivityRisk),
    ownerAlert: stalled || dealRiskScore >= 70,
    ownerAlertMessage: stalled || dealRiskScore >= 70
      ? `${lead.company || '리드'}는 즉시 점검이 필요합니다.`
      : `${lead.company || '리드'}는 계획된 다음 액션을 유지하면 됩니다.`,
    stalled
  };
}
