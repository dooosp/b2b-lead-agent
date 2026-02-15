import { jsonResponse } from '../lib/utils.js';
import { callGemini } from '../lib/gemini.js';

export async function generatePPT(request, env) {
  const body = await request.json().catch(() => ({}));
  const { lead } = body;
  if (!lead) return jsonResponse({ success: false, message: '리드 데이터가 없습니다.' }, 400);

  const prompt = `당신은 B2B 기술 영업 전문가입니다.
아래 리드 정보를 바탕으로 고객사에 전달할 **5슬라이드 기술 영업 제안서** 구성안을 작성하세요.

[리드 정보]
- 기업: ${lead.company}
- 프로젝트: ${lead.summary}
- 추천 제품: ${lead.product}
- 예상 ROI: ${lead.roi}
- 글로벌 트렌드: ${lead.globalContext}

[슬라이드 구성 지시]
슬라이드 1 - 도입부: 고객사의 최근 성과(수주/착공 등)를 축하하며, 당면한 과제(에너지 효율, 규제 대응 등)를 언급
슬라이드 2 - 솔루션: ${lead.product}의 기술적 강점과 차별점을 구체적으로 설명
슬라이드 3 - 경제적 가치: ROI 수치를 시각화 제안 (Before/After 비교표, 절감액 그래프 등)
슬라이드 4 - 규제 대응: 관련 글로벌 규제(${lead.globalContext}) 준수 로드맵 제시
슬라이드 5 - Next Step: 파일럿 테스트 제안, 기술 미팅 일정 등 구체적 후속 조치

각 슬라이드에 대해 [제목], [핵심 메시지 2~3줄], [추천 시각자료]를 포함해서 작성하세요.
마크다운 형식으로 출력하세요.`;

  try {
    const result = await callGemini(prompt, env);
    return jsonResponse({ success: true, content: result });
  } catch (e) {
    return jsonResponse({ success: false, message: 'AI 분석 중 오류가 발생했습니다:' + e.message }, 500);
  }
}
