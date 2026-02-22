import { jsonResponse } from '../lib/utils.js';
import { callGemini } from '../lib/gemini.js';
import { getReferencesForPrompt } from '../db/references.js';

export async function generateProposal(request, env) {
  const body = await request.json().catch(() => ({}));
  const { buildingType, area, floors, currentBMS, monthlyEnergyCost } = body;

  if (!buildingType || !area || !floors) {
    return jsonResponse({ success: false, message: '빌딩유형, 면적, 층수는 필수입니다.' }, 400);
  }

  const areaNum = Number(area);
  const floorsNum = Number(floors);
  const costNum = Number(monthlyEnergyCost) || 0;

  if (areaNum <= 0 || floorsNum <= 0) {
    return jsonResponse({ success: false, message: '면적과 층수는 양수여야 합니다.' }, 400);
  }

  // 유사 사례 가져오기
  let referencesText = '';
  try {
    referencesText = await getReferencesForPrompt(env.DB, 'siemens', ['bms', 'esco']);
  } catch { /* ignore */ }

  const prompt = `당신은 지멘스 Smart Infrastructure 기술영업 전문가입니다.
아래 빌딩 정보를 바탕으로 **Desigo CC 기반 기술제안서 초안**을 7개 섹션으로 작성하세요.

[빌딩 정보]
- 유형: ${buildingType}
- 연면적: ${areaNum.toLocaleString()}㎡
- 층수: ${floorsNum}층
- 현재 BMS: ${currentBMS || '없음/미상'}
- 월 에너지 비용: ${costNum > 0 ? costNum.toLocaleString() + '만원' : '미입력'}

[유사 사례 DB]
${referencesText || '(레퍼런스 데이터 없음)'}

[제안서 7섹션 구성]
## 1. 프로젝트 개요
- 빌딩 현황 분석, 핵심 과제 3가지 도출

## 2. Desigo CC 아키텍처
- 시스템 구성도 설명 (HVAC, 조명, 전력, 방재 통합)
- ${floorsNum}층 규모에 맞는 컨트롤러/포인트 수 산정

## 3. 에너지 절감 시뮬레이션
- Before/After 비교 (현재 vs Desigo CC 적용 후)
- 월 에너지 비용 절감 예상액 (${costNum > 0 ? '현재 ' + costNum.toLocaleString() + '만원 기준' : '유사 규모 기준'})
- 연간 절감률 25~40% 범위 내 구체적 수치

## 4. ESCO 모델 제안
- 초기 투자 없는 성과 보장형 계약 구조
- 5년/7년/10년 시나리오별 절감 보장액과 상환 계획
- 리스크 분담 구조

## 5. 유사 사례
- 위 레퍼런스에서 가장 유사한 2~3건 상세 분석
- 규모/유형 유사성 비교

## 6. 구축 타임라인
- Phase별 일정 (설계 → 시공 → 시운전 → 안정화)
- ${areaNum.toLocaleString()}㎡ 규모 기준 예상 기간

## 7. Why Siemens
- 글로벌 No.1 빌딩 자동화 실적
- 국내 A/S 네트워크
- Building X 클라우드 연계 로드맵

마크다운 형식으로 출력하세요. 숫자와 데이터를 구체적으로 제시하세요.`;

  try {
    const result = await callGemini(prompt, env);
    return jsonResponse({ success: true, content: result });
  } catch (e) {
    return jsonResponse({ success: false, message: 'AI 분석 중 오류: ' + e.message }, 500);
  }
}
