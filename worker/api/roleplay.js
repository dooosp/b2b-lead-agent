import { jsonResponse } from '../lib/utils.js';
import { callGemini } from '../lib/gemini.js';
import { getPrimaryStakeholderMessage } from '../lib/persuasion-engine.js';
import { buildSolutionTranslation } from '../lib/solution-translation.js';

export async function handleRoleplay(request, env) {
  const body = await request.json().catch(() => ({}));
  const { lead, history, userMessage, stakeholderType } = body;
  if (!lead) return jsonResponse({ success: false, message: '리드 데이터가 없습니다.' }, 400);
  const stakeholder = getPrimaryStakeholderMessage(lead, stakeholderType || 'economic_buyer');
  const translation = buildSolutionTranslation(lead);

  const conversationHistory = (history || []).map(h =>
    `${h.role === 'user' ? '영업사원' : '고객'}: ${h.content}`
  ).join('\n');

  const prompt = `당신은 ${lead.company}의 ${stakeholder?.stakeholderType || 'economic_buyer'} 역할 담당자입니다. 까다롭고 구체적인 근거를 요구하며, 막연한 주장에는 회의적입니다.

[상황 설정]
- 귀사 프로젝트: ${lead.summary}
- 제안받은 제품: ${lead.product}
- 제안된 ROI: ${lead.roi}
- 추천 메시지 초점: ${stakeholder?.recommendedMessage || 'unknown'}
- 현재 우선순위: ${stakeholder?.keyPriority || 'unknown'}
- 예상 반론: ${stakeholder?.likelyObjection || 'unknown'}
- 필요한 증빙: ${stakeholder?.proofNeeded || 'unknown'}
- 왜 지금: ${translation.whyNow}

[당신의 성격]
- 구체적인 수치와 레퍼런스를 요구함
- "${stakeholder?.likelyObjection || '왜 지금 검토해야 하는가?'}" 류의 압박 질문을 자주 함
- 납기, A/S, 로컬 지원 체계 또는 내부 실행 리스크에 관심이 많음
- 쉽게 설득되지 않지만, 논리적이고 구체적인 답변에는 긍정적으로 반응

${conversationHistory ? `[이전 대화]\n${conversationHistory}\n` : ''}
[영업사원의 최신 발언]
${userMessage || '안녕하세요. 귀사의 프로젝트에 대해 제안드리고 싶습니다.'}

위 발언에 대해 까다로운 구매 담당자로서 응답하세요. 응답 후 줄바꿈하고 "---" 아래에 [코칭 피드백]을 작성하세요:
- 영업사원의 답변에서 잘한 점
- 부족한 점 (Value Selling 관점)
- 더 나은 대응 제안
- 다음에 반드시 확인할 질문 1개

형식:
[고객 응답]
(까다로운 구매 담당자의 응답)

---
[코칭 피드백]
- 잘한 점: ...
- 개선점: ...
- 제안: ...
- 다음 질문: ...`;

  try {
    const result = await callGemini(prompt, env);
    return jsonResponse({ success: true, content: result });
  } catch (e) {
    return jsonResponse({ success: false, message: 'AI 분석 중 오류가 발생했습니다:' + e.message }, 500);
  }
}
