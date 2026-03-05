import { jsonResponse } from '../lib/utils.js';
import { callGemini } from '../lib/gemini.js';
import { callOpenAI } from '../lib/openai.js';
import { getReferencesForPrompt } from '../db/references.js';
import { estimateDesigoPointAndController, normalizeSystemFlags } from '../lib/proposal-estimator.js';
import { calculateCpaEstimate, validateCpaOutput } from '../lib/cpa-estimator.js';
import {
  composeProposalContent,
  isValidProposalSectionPayload,
  parseProposalSectionPayload,
  PROPOSAL_SECTION_HEADINGS
} from '../lib/proposal-composer.js';

async function callProposalModel(prompt, env) {
  const options = { temperature: 0, topP: 0.1, maxOutputTokens: 6144 };
  let lastError = null;

  if (env && env.OPENAI_API_KEY) {
    try {
      return await callOpenAI(prompt, env, {
        temperature: options.temperature,
        topP: options.topP,
        model: env.OPENAI_MODEL || 'gpt-5.3-codex',
        reasoningEffort: 'medium'
      });
    } catch (error) {
      lastError = error;
    }
  }

  if (env && env.GEMINI_API_KEY) {
    try {
      return await callGemini(prompt, env, options);
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) throw lastError;
  throw new Error('OPENAI_API_KEY 또는 GEMINI_API_KEY가 설정되지 않았습니다.');
}

function summarizeSystems(flags) {
  const labels = {
    hvac: 'HVAC',
    lighting: '조명',
    power: '전력',
    fire: '방재',
    extra: '기타 설비'
  };
  return Object.entries(flags)
    .filter(([, enabled]) => enabled)
    .map(([key]) => labels[key])
    .join(', ') || '미선택';
}

function buildProposalPrompt({ proposalInput, estimation, cpaEstimate, referencesText }) {
  const recommended = cpaEstimate.options.find((option) => option.scope === 'BEMS') || cpaEstimate.options[1] || cpaEstimate.options[0];
  const sectionTitles = Object.entries(PROPOSAL_SECTION_HEADINGS)
    .map(([index, heading]) => `${index}. ${heading}`)
    .join('\n');

  return `당신은 지멘스 Smart Infrastructure 기술영업 전문가입니다.
아래 프로젝트 정보를 바탕으로 기술제안서용 설명 bullet을 작성하세요.

[프로젝트 입력]
- 빌딩 유형: ${proposalInput.buildingType}
- 연면적: ${proposalInput.area.toLocaleString()}㎡
- 층수: ${proposalInput.floors}층
- 현재 BMS: ${proposalInput.currentBMS || '없음/미상'}
- 월 에너지 비용: ${proposalInput.monthlyEnergyCost > 0 ? `${proposalInput.monthlyEnergyCost.toLocaleString()}만원` : '미입력'}
- 시스템 범위: ${summarizeSystems(proposalInput.systemFlags)}

[코드 계산 컨텍스트 - 숫자 변경 금지]
- 총 포인트: ${estimation.totalPoints}
- 포인트 범위: ${estimation.pointRange.min}~${estimation.pointRange.max}
- 컨트롤러: 최소 ${estimation.controllers.min} / 권장 ${estimation.controllers.recommended} / 최대 ${estimation.controllers.max}
- 권장 ESCO 옵션: ${recommended.label}
- 권장 ESCO 총 투자비: ${recommended.totalCost}
- 권장 ESCO 절감률: ${recommended.savingsRate}%
- 권장 ESCO 연간 절감액: ${recommended.annualSavings}
- 권장 ESCO 순연간 절감액: ${recommended.netAnnualSavings}
- 권장 ESCO 5년 ROI: ${recommended.roi5y}%

[레퍼런스]
${referencesText || '(레퍼런스 데이터 없음)'}

[출력 스키마]
{
  "sections": {
    "1": ["bullet string", "bullet string"],
    "2": ["bullet string", "bullet string"],
    "3": ["bullet string", "bullet string"],
    "4": ["bullet string", "bullet string"],
    "5": ["bullet string", "bullet string"],
    "6": ["bullet string", "bullet string"],
    "7": ["bullet string", "bullet string"]
  }
}

[절대 규칙]
1) JSON 객체 1개만 출력하세요. 설명, 마크다운, 코드펜스 금지.
2) sections 키 아래에 1~7만 사용하세요. 새 키 추가 금지.
3) 각 배열은 2~4개 bullet string으로 작성하세요.
4) bullet string 안에 heading, 숫자 번호, 마크다운 heading(##)을 쓰지 마세요.
5) 숫자는 코드 계산 컨텍스트에 있는 값 외에는 추측하지 마세요.
6) 섹션 2, 3, 4, 6은 숫자/퍼센트/금액/기간을 쓰지 말고 설명 문장만 작성하세요.
7) 표 형식 금지. 문장 길이는 bullet당 1~2문장으로 제한하세요.

[섹션 제목]
${sectionTitles}`;
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

  const proposalInput = {
    buildingType,
    area: areaNum,
    floors: floorsNum,
    currentBMS: String(currentBMS || '').trim(),
    monthlyEnergyCost: costNum,
    systemFlags: normalizedFlags
  };

  const estimation = estimateDesigoPointAndController({
    totalArea: areaNum,
    floors: floorsNum,
    systemFlags: normalizedFlags
  });
  const cpaEstimate = calculateCpaEstimate({
    area: areaNum,
    floors: floorsNum,
    buildingType,
    region: 'seoul',
    monthlyEnergyCost: costNum
  });
  if (!validateCpaOutput(cpaEstimate)) {
    return jsonResponse({ success: false, message: 'CPA 기준값 검증에 실패했습니다.' }, 500);
  }

  let referencesText = '';
  try {
    referencesText = await getReferencesForPrompt(env.DB, 'siemens', ['bms', 'esco']);
  } catch {
    referencesText = '';
  }

  const prompt = buildProposalPrompt({ proposalInput, estimation, cpaEstimate, referencesText });

  try {
    const raw = await callProposalModel(prompt, env);
    let payload = parseProposalSectionPayload(raw);

    if (!isValidProposalSectionPayload(payload)) {
      const retryPrompt = `${prompt}\n\n[재요청]\n- 직전 응답은 JSON 스키마 검증에 실패했습니다.\n- JSON 객체 1개만 출력하고 sections 1~7 배열을 모두 채우세요.\n- sections 2, 3, 4, 6에는 숫자를 넣지 마세요.`;
      const repaired = await callProposalModel(retryPrompt, env);
      payload = parseProposalSectionPayload(repaired);
    }

    if (!isValidProposalSectionPayload(payload)) {
      throw new Error('PROPOSAL_SECTION_SCHEMA_VALIDATION_FAILED');
    }

    const content = composeProposalContent({
      proposalInput,
      estimation,
      cpaEstimate,
      sections: payload.sections
    });

    return jsonResponse({
      success: true,
      content,
      estimation,
      completeness: { allSections: true }
    });
  } catch (error) {
    return jsonResponse({ success: false, message: 'AI 분석 중 오류: ' + error.message }, 500);
  }
}
