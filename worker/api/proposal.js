import { jsonResponse } from '../lib/utils.js';
import { callGemini } from '../lib/gemini.js';
import { getReferencesForPrompt } from '../db/references.js';
import { estimateDesigoPointAndController, normalizeSystemFlags } from '../lib/proposal-estimator.js';

function buildSizingSection(estimation, floors) {
  const avgPerFloor = Math.round((Number(estimation.totalPoints) || 0) / Math.max(1, Number(floors) || 1));
  return [
    '## 2. Desigo CC 아키텍처',
    '- 시스템 구성도 설명 (HVAC, 조명, 전력, 방재 통합)',
    '- 포인트 산정(고정):',
    `  - HVAC: ${estimation.pointsBySystem.hvac.toLocaleString()} 포인트`,
    `  - 조명: ${estimation.pointsBySystem.lighting.toLocaleString()} 포인트`,
    `  - 전력: ${estimation.pointsBySystem.power.toLocaleString()} 포인트`,
    `  - 방재: ${estimation.pointsBySystem.fire.toLocaleString()} 포인트`,
    `  - 기타: ${estimation.pointsBySystem.extra.toLocaleString()} 포인트`,
    `  - 총 포인트: ${estimation.totalPoints.toLocaleString()} (범위 ${estimation.pointRange.min.toLocaleString()}~${estimation.pointRange.max.toLocaleString()})`,
    `  - 층당 평균: ${avgPerFloor.toLocaleString()} 포인트`,
    `- 컨트롤러 산정(고정): 최소 ${estimation.controllers.min}대 / 권장 ${estimation.controllers.recommended}대 / 최대 ${estimation.controllers.max}대`
  ].join('\n');
}

function enforceDeterministicSizing(content, estimation, floors) {
  const section = buildSizingSection(estimation, floors);
  if (!content || typeof content !== 'string') return section;
  if (/##\s*2\.\s*Desigo CC 아키텍처/i.test(content)) {
    return content.replace(/##\s*2\.\s*Desigo CC 아키텍처[\s\S]*?(?=\n##\s*3\.|\n#\s*3\.|$)/i, section);
  }
  return `${section}\n\n${content}`;
}

export async function generateProposal(request, env) {
  const body = await request.json().catch(() => ({}));
  const { buildingType, area, floors, currentBMS, monthlyEnergyCost, systemFlags } = body;

  if (!buildingType || !area || !floors) {
    return jsonResponse({ success: false, message: '빌딩유형, 면적, 층수는 필수입니다.' }, 400);
  }

  const areaNum = Number(area);
  const floorsNum = Number(floors);
  const costNum = Number(monthlyEnergyCost) || 0;
  const normalizedFlags = normalizeSystemFlags(systemFlags || {});

  if (areaNum <= 0 || floorsNum <= 0) {
    return jsonResponse({ success: false, message: '면적과 층수는 양수여야 합니다.' }, 400);
  }

  const estimation = estimateDesigoPointAndController({
    totalArea: areaNum,
    floors: floorsNum,
    systemFlags: normalizedFlags
  });

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

[고정 산정값 - 숫자 변경 금지]
- HVAC 포인트: ${estimation.pointsBySystem.hvac}
- 조명 포인트: ${estimation.pointsBySystem.lighting}
- 전력 포인트: ${estimation.pointsBySystem.power}
- 방재 포인트: ${estimation.pointsBySystem.fire}
- 기타 포인트: ${estimation.pointsBySystem.extra}
- 총 포인트: ${estimation.totalPoints} (범위 ${estimation.pointRange.min}~${estimation.pointRange.max})
- 컨트롤러 용량 가정: 1대당 ${estimation.controllers.capacityPerController} 포인트
- 권장 컨트롤러: 최소 ${estimation.controllers.min}대 / 권장 ${estimation.controllers.recommended}대 / 최대 ${estimation.controllers.max}대

[중요 규칙]
- 위 숫자는 시스템 계산 결과이므로 그대로 사용하세요.
- 숫자 재계산 또는 임의 변경 금지.
- 당신은 설명 문장과 제안 논리만 작성하세요.

[유사 사례 DB]
${referencesText || '(레퍼런스 데이터 없음)'}

[제안서 7섹션 구성]
## 1. 프로젝트 개요
- 빌딩 현황 분석, 핵심 과제 3가지 도출

## 2. Desigo CC 아키텍처
- 시스템 구성도 설명 (HVAC, 조명, 전력, 방재 통합)
- ${floorsNum}층 규모에 맞는 컨트롤러/포인트 수 산정(위 고정 산정값 그대로 인용)

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
    const result = await callGemini(prompt, env, { temperature: 0, topP: 0.1, maxOutputTokens: 4096 });
    const stabilized = enforceDeterministicSizing(result, estimation, floorsNum);
    return jsonResponse({ success: true, content: stabilized, estimation });
  } catch (e) {
    return jsonResponse({ success: false, message: 'AI 분석 중 오류: ' + e.message }, 500);
  }
}
