import { jsonResponse } from '../lib/utils.js';
import { callGemini } from '../lib/gemini.js';

function cleanText(value, fallback = '') {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text || fallback;
}

function normalizeList(value) {
  return (Array.isArray(value) ? value : [])
    .map((item) => cleanText(item))
    .filter(Boolean);
}

function normalizeEvidenceQuotes(value) {
  return (Array.isArray(value) ? value : [])
    .map((item) => {
      if (!item || typeof item !== 'object') return '';
      return cleanText(item.quote || item.text || item.summary);
    })
    .filter(Boolean);
}

function firstAvailable(values, fallback) {
  for (const value of values.flat()) {
    const text = cleanText(value);
    if (text) return text;
  }
  return fallback;
}

export function buildRoleplayStakeholderContext(lead = {}) {
  const primaryRole = cleanText(lead.buyerRole || lead.buyer_role, 'Stakeholder role confirmation needed');
  const keyFigures = normalizeList(lead.keyFigures || lead.key_figures);
  const painPoints = normalizeList(lead.painPoints || lead.pain_points);
  const buyingSignals = normalizeList(lead.buyingSignals || lead.buying_signals);
  const dataGaps = normalizeList(lead.dataGaps || lead.data_gaps);
  const evidenceQuotes = normalizeEvidenceQuotes(lead.evidence);
  const recommendedMessage = cleanText(lead.recommendedMessage || lead.recommended_message);
  const whyNow = cleanText(lead.whyNow || lead.why_now);
  const confidence = cleanText(lead.confidence).toUpperCase();
  const verificationStatus = cleanText(lead.verificationStatus || lead.verification_status).toLowerCase();
  const isReviewReady = primaryRole !== 'Stakeholder role confirmation needed'
    && confidence === 'HIGH'
    && verificationStatus === 'verified'
    && evidenceQuotes.length > 0
    && dataGaps.length === 0;

  const valueFocus = firstAvailable([
    keyFigures,
    buyingSignals,
    cleanText(lead.roi),
  ], 'Value case confirmation needed');
  const operatingConcern = firstAvailable([
    painPoints,
    cleanText(lead.summary),
  ], 'Operating concern confirmation needed');
  const messageAngle = firstAvailable([
    recommendedMessage,
    whyNow,
  ], 'Reviewed message angle confirmation needed');
  const gapLine = dataGaps.length > 0
    ? dataGaps.join(' / ')
    : 'No open data gaps in selected LeadBrief';
  const guidance = isReviewReady
    ? 'Use this only to practice a human-reviewed conversation path.'
    : 'Use open gaps as practice questions, not as verified claims.';

  return `[이해관계자 연습 컨텍스트]
- Primary stakeholder: ${primaryRole}
- Value focus: ${valueFocus}
- Operating concern: ${operatingConcern}
- Evidence to practice: ${firstAvailable([evidenceQuotes], 'Direct evidence confirmation needed')}
- Data gaps to ask about: ${gapLine}
- Reviewed message angle: ${messageAngle}
- Boundary: Advisory practice context only; human review is required, this does not approve outreach, and do not present this as outreach approval, CRM ownership, assignment, or automatic decision.
- Guidance: ${guidance}`;
}

export function buildRoleplayPrompt({ lead, history = [], userMessage } = {}) {
  const conversationHistory = (Array.isArray(history) ? history : []).map(h =>
    `${h.role === 'user' ? '영업사원' : '고객'}: ${h.content}`
  ).join('\n');
  const stakeholderContext = buildRoleplayStakeholderContext(lead);

  return `당신은 ${lead.company}의 구매 담당 임원입니다. 까다롭고 가격에 민감하며, 경쟁사 제품과 항상 비교합니다.

[상황 설정]
- 귀사 프로젝트: ${lead.summary}
- 제안받은 제품: ${lead.product}
- 제안된 ROI: ${lead.roi}

${stakeholderContext}

[당신의 성격]
- 구체적인 수치와 레퍼런스를 요구함
- "왜 경쟁사보다 비싼가?" 류의 압박 질문을 자주 함
- 납기, A/S, 로컬 지원 체계에 관심이 많음
- 쉽게 설득되지 않지만, 논리적이고 구체적인 답변에는 긍정적으로 반응

${conversationHistory ? `[이전 대화]\n${conversationHistory}\n` : ''}
[영업사원의 최신 발언]
${userMessage || '안녕하세요. 귀사의 프로젝트에 대해 제안드리고 싶습니다.'}

위 발언에 대해 까다로운 구매 담당자로서 응답하세요. 응답 후 줄바꿈하고 "---" 아래에 [코칭 피드백]을 작성하세요:
- 영업사원의 답변에서 잘한 점
- 부족한 점 (Value Selling 관점)
- 더 나은 대응 제안
- 이해관계자 맥락은 연습용 질문과 코칭 참고로만 사용하고, 확인되지 않은 데이터 공백은 사실처럼 말하지 말 것

형식:
[고객 응답]
(까다로운 구매 담당자의 응답)

---
[코칭 피드백]
- 잘한 점: ...
- 개선점: ...
- 제안: ...`;
}

export async function handleRoleplay(request, env) {
  const body = await request.json().catch(() => ({}));
  const { lead, history, userMessage } = body;
  if (!lead) return jsonResponse({ success: false, message: '리드 데이터가 없습니다.' }, 400);

  const prompt = buildRoleplayPrompt({ lead, history, userMessage });

  try {
    const result = await callGemini(prompt, env);
    return jsonResponse({ success: true, content: result });
  } catch {
    return jsonResponse({ success: false, message: 'AI 분석 중 오류가 발생했습니다.' }, 500);
  }
}
