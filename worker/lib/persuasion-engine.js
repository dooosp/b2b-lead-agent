import { buildSolutionTranslation } from './solution-translation.js';
import { resolveLeadProductEntry } from './product-catalog.js';

function unique(values) {
  return [...new Set((values || []).filter(Boolean).map((value) => String(value).trim()).filter(Boolean))];
}

const STAKEHOLDER_DEFINITIONS = Object.freeze([
  {
    stakeholderType: 'economic_buyer',
    keyPriority: '투자 회수와 운영비 절감 근거',
    objectionFallback: 'ROI와 예산 우선순위가 아직 불명확함',
    assetLabel: 'ROI one-pager'
  },
  {
    stakeholderType: 'technical_evaluator',
    keyPriority: '기술 적합성, 연동 범위, 배포 리스크',
    objectionFallback: '기존 시스템 연동 복잡도 우려',
    assetLabel: 'integration checklist'
  },
  {
    stakeholderType: 'end_user_operator',
    keyPriority: '운영 편의성, 장애 대응, 현장 적용성',
    objectionFallback: '현장 운영 변화 부담',
    assetLabel: 'operator workflow note'
  },
  {
    stakeholderType: 'procurement',
    keyPriority: '비용 비교, 납기, 계약 리스크',
    objectionFallback: '총비용과 공급 조건 비교 요구',
    assetLabel: 'commercial comparison sheet'
  },
  {
    stakeholderType: 'executive_sponsor',
    keyPriority: '전사 KPI, 전략 적합성, 실행 책임',
    objectionFallback: '전략 우선순위와 연결이 약함',
    assetLabel: 'executive summary'
  },
  {
    stakeholderType: 'champion',
    keyPriority: '내부 설득 자료와 빠른 파일럿 범위',
    objectionFallback: '내부 설득용 자료 부족',
    assetLabel: 'pilot proposal'
  }
]);

export function buildStakeholderPersuasion(lead) {
  const translation = buildSolutionTranslation(lead);
  const entry = resolveLeadProductEntry(lead);
  const proofPool = unique([
    ...(translation.proofPoints || []),
    ...(entry?.differentiators || [])
  ]);
  const nextQuestionBase = unique([
    ...(lead.missingInformation || []),
    lead.urgencyReason ? `긴급도를 뒷받침하는 내부 일정은 무엇인가요?` : '',
    !lead.meddic?.budget ? '예산 승인 시점은 언제인가요?' : '',
    !lead.meddic?.decisionProcess ? '평가 및 의사결정 단계는 어떻게 진행되나요?' : ''
  ]);

  return STAKEHOLDER_DEFINITIONS.map((definition, index) => {
    const likelyObjection = translation.commonObjections[index % Math.max(translation.commonObjections.length, 1)]
      || definition.objectionFallback;
    const proofNeeded = proofPool[index % Math.max(proofPool.length, 1)] || '근거 자료 추가 확인 필요';
    return {
      stakeholderType: definition.stakeholderType,
      keyPriority: definition.keyPriority,
      likelyObjection,
      recommendedMessage: `${lead.product || '현재 제안'}를 통해 ${translation.whyThisSolution} ${definition.keyPriority} 관점에서는 ${translation.expectedBusinessOutcome}에 집중해 설명해야 합니다.`,
      proofNeeded,
      riskIfUnaddressed: `${definition.keyPriority} 근거가 부족하면 ${lead.status || '현재'} 단계에서 검토가 정체될 가능성이 큽니다.`,
      nextQuestion: nextQuestionBase[index % Math.max(nextQuestionBase.length, 1)] || 'unknown',
      nextAssetToSend: definition.assetLabel
    };
  });
}

export function getPrimaryStakeholderMessage(lead, stakeholderType = 'economic_buyer') {
  const messages = buildStakeholderPersuasion(lead);
  return messages.find((item) => item.stakeholderType === stakeholderType) || messages[0] || null;
}
