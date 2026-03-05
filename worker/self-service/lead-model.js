import { callGemini } from '../lib/gemini.js';
import { callOpenAI } from '../lib/openai.js';
import { isValidLeadPayloadSchema, parseLeadPayload } from './lead-utils.js';

async function callSalesModel(prompt, env) {
  const options = { temperature: 0, topP: 0.1 };
  let lastErr = null;

  if (env && env.OPENAI_API_KEY) {
    try {
      return await callOpenAI(prompt, env, {
        ...options,
        model: env.OPENAI_MODEL || 'gpt-5.3-codex',
        reasoningEffort: 'medium'
      });
    } catch (error) {
      lastErr = error;
    }
  }

  if (env && env.GEMINI_API_KEY) {
    try {
      return await callGemini(prompt, env, { ...options, maxOutputTokens: 4096 });
    } catch (error) {
      lastErr = error;
    }
  }

  if (lastErr) throw lastErr;
  throw new Error('OPENAI_API_KEY 또는 GEMINI_API_KEY가 설정되지 않았습니다.');
}

export async function requestLeadPayload(prompt, env) {
  const raw = await callSalesModel(prompt, env);
  let payload = parseLeadPayload(raw);
  if (isValidLeadPayloadSchema(payload)) return payload;

  const repairPrompt = `Return JSON only. Validate schema.

아래 원문을 지정 스키마의 JSON 객체로 변환하세요. 설명/마크다운 금지.

스키마:
{
  "summary": "string",
  "leads": [
    {
      "company": "string",
      "score": 0,
      "project_title": "string",
      "recommended_product": "string",
      "expected_roi": "string",
      "sales_pitch": "string",
      "trend": "string",
      "sources": [{"title":"string","url":"string"}]
    }
  ]
}

규칙:
- {company}, {product} 같은 placeholder 금지
- company는 40자 이하의 회사명만
- sources는 반드시 배열

원문:
${String(raw || '').slice(0, 12000)}`;

  const repaired = await callSalesModel(repairPrompt, env);
  payload = parseLeadPayload(repaired);
  return payload;
}
