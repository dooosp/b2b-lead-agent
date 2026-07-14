import { jsonResponse } from '../lib/utils.js';
import { callGemini } from '../lib/gemini.js';
import { resolveProfileId } from '../lib/profile.js';
import { ensureD1Schema } from '../db/schema.js';
import { rowToLead } from '../db/transform.js';
import { getLeadById, updateLeadEnrichment } from '../db/leads.js';
import {
  filterManualReviewNotesProtectedFields,
  resolveManualReviewNotesAccess,
} from '../lib/manual-review-notes-access.js';
import {
  createWorkerOutboundHttpContext,
  DEFAULT_WORKER_OUTBOUND_POLICY,
  fetchWorkerOutboundText,
} from '../lib/outbound-http.js';

const NUMBER_SIGNAL_RE = /(\d|억원|조원|만|%|MW|GW|kW|㎡|m²)/i;
const NO_BODY_DATA_GAP = '기사 본문 미확보';
const NO_BODY_ROI_FALLBACK = '근거 없음(추정 불가) - 기사 본문 미확보로 정량 ROI 산정 불가';

function pickBestSourceUrl(sources) {
  if (!Array.isArray(sources) || sources.length === 0) return null;
  const direct = sources.find(s => s.url && !/news\.google\.com/i.test(s.url));
  return (direct || sources[0])?.url || null;
}

function pickSourceTitle(lead) {
  const sources = Array.isArray(lead && lead.sources) ? lead.sources : [];
  const titled = sources.find((source) => source && typeof source.title === 'string' && source.title.trim());
  return titled ? titled.title.trim().slice(0, 200) : '';
}

export function hasArticleBody(articleBody) {
  return typeof articleBody === 'string' && articleBody.trim().length > 50;
}

export async function fetchArticleBodyWorker(url, dependencies = {}) {
  if (!url) return '';
  if (url.includes('news.google.com/')) return '';
  try {
    const { response, text } = await fetchWorkerOutboundText(url, {
      policy: DEFAULT_WORKER_OUTBOUND_POLICY,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; B2BLeadBot/1.0)' },
      fetchImpl: dependencies.fetchImpl,
      resolveHostname: dependencies.resolveHostname,
    });
    if (!response.ok) return '';
    return extractBodyFromHTML(text);
  } catch {
    return '';
  }
}

export function extractBodyFromHTML(html) {
  if (!html) return '';
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<nav[\s\S]*?<\/nav>/gi, '').replace(/<footer[\s\S]*?<\/footer>/gi, '').replace(/<header[\s\S]*?<\/header>/gi, '');

  const ogMatch = text.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)
    || text.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i);
  const ogDesc = ogMatch ? ogMatch[1] : '';

  const articleMatch = text.match(/<article[\s\S]*?<\/article>/i);
  const zone = articleMatch ? articleMatch[0] : text;
  const paragraphs = [];
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = pRegex.exec(zone)) !== null) {
    const clean = m[1].replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
    if (clean.length > 30) paragraphs.push(clean);
  }

  const body = paragraphs.join('\n');
  const combined = ogDesc ? ogDesc + '\n\n' + body : body;
  return combined.slice(0, 3000);
}

export function buildEnrichmentPrompt(lead, articleBody) {
  const hasBody = hasArticleBody(articleBody);
  const sourceTitle = pickSourceTitle(lead);
  const articleSection = hasBody
    ? `[기사 본문]\n${articleBody}`
    : [
        '[기사 본문 없음]',
        sourceTitle ? `기사 제목: ${sourceTitle}` : '',
        '기사 본문을 읽은 것처럼 단정하거나 직접 인용을 만들지 말 것.',
        `dataGaps에는 "${NO_BODY_DATA_GAP}"를 반드시 포함할 것.`
      ].filter(Boolean).join('\n');
  const roiInstruction = hasBody
    ? `3. ROI 분석:
   a) keyFigures에서 발견한 숫자가 있으면: 산업 평균 절감률(%) + 발견 숫자로 ROI 범위를 계산.
      형식: "투자 추정 X~Y억 → 절감 추정 A~B억/년 (Payback N~M년)"
   b) 숫자가 없으면: "정량 데이터 부족 — 유사 사례 기준 절감률 N~M% 예상" 형태로만 작성.
      절대로 구체 금액을 창작하지 말 것.
   c) assumptions에 ROI 산출에 사용한 모든 가정을 나열.`
    : `3. ROI 분석:
   a) 기사 본문이 없으면 구체 금액, 절감률, payback 숫자를 쓰지 말 것.
   b) ROI는 "${NO_BODY_ROI_FALLBACK}"처럼 보수적으로 작성.
   c) assumptions에는 제목/요약 기반 판단이라는 한계와 추가로 필요한 근거를 적고, 숫자 계산을 꾸며내지 말 것.`;
  const evidenceInstruction = hasBody
    ? '8. evidence: 분석의 주요 근거를 기사 원문에서 직접 인용. 각 항목에 대상 필드(summary/roi/meddic 등), 인용 문장, 출처 URL 포함.'
    : '8. evidence: 기사 본문이 없으므로 직접 인용을 만들지 말고 evidence는 빈 배열([])로 반환. 제목/요약에서 확인 가능한 사실은 summary, assumptions, dataGaps에만 반영.';
  const evidenceSchema = hasBody
    ? '[{"field":"근거 대상 필드","quote":"기사 원문 인용","sourceUrl":"URL"}]'
    : '[]';

  return `B2B 영업 인텔리전스 분석가로서 MEDDIC 기반 심층 분석을 수행하라.

[리드]
회사: ${lead.company} | 요약: ${lead.summary || 'N/A'} | 제품: ${lead.product || 'N/A'} | ROI: ${lead.roi || 'N/A'}

${articleSection}

[분석 지시]
1. 수치 추출: 기사에서 발견한 숫자(금액·용량·면적·전력·일정·인원)를 keyFigures에 나열. 발견 못하면 빈 배열.
2. 페인포인트: 가능하면 금액/시간으로 정량화. 정량 불가능하면 정성적으로 작성.
${roiInstruction}
4. SPIN 영업제안(현황→문제→영향→가치)
5. 1주/1개월/3개월 후속조치(부서·직급 명시)
6. MEDDIC(예산·의사결정·니즈·타임라인·프로세스·챔피언)
7. 경쟁환경(현재벤더·경쟁사·차별점·전환장벽)
${evidenceInstruction}
9. dataGaps: 분석에 필요하지만 확인 불가능한 정보 목록 (예: "예산 규모 미확인", "의사결정자 미파악")

[출력] 아래 JSON만 반환. 한국어. 마크다운 펜스 없이.
{"summary":"프로젝트명·규모·일정 포함 2문장","roi":"위 정책대로 작성","salesPitch":"[현황]→[문제]→[영향]→[가치] 3문장","globalContext":"글로벌 트렌드","actionItems":["[1주] 구체적 조치","[1개월] 조치","[3개월] 조치"],"keyFigures":["발견 숫자: 설명"],"painPoints":["과제: 가능하면 정량 수치 포함"],"meddic":{"budget":"예산규모+근거","authority":"의사결정 구조","need":"핵심니즈","timeline":"구매타임라인","decisionProcess":"구매프로세스","champion":"챔피언후보"},"competitive":{"currentVendor":"현재벤더","competitors":"경쟁사","ourAdvantage":"차별점","switchBarrier":"전환장벽+극복방안"},"buyingSignals":["구매신호1"],"evidence":${evidenceSchema},"assumptions":["ROI 가정1","가정2"],"dataGaps":["미확인 정보1"]}`;
}

export async function callGeminiEnrich(lead, articleBody, env) {
  const prompt = buildEnrichmentPrompt(lead, articleBody);

  const raw = await callGemini(prompt, env);
  const jsonStr = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  try {
    return JSON.parse(jsonStr);
  } catch {
    const match = jsonStr.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Enrichment JSON 파싱 실패');
  }
}

function normalizeStringArray(value, maxLen = 10) {
  if (!Array.isArray(value)) return [];
  return value
    .map(v => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean)
    .slice(0, maxLen);
}

function clampText(value, fallback = '', maxLen = 800) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (raw) return raw.slice(0, maxLen);
  const fb = typeof fallback === 'string' ? fallback.trim() : '';
  return fb.slice(0, maxLen);
}

function normalizeObjectField(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  return {};
}

function appendUniqueString(items, value, maxLen = 10) {
  const list = Array.isArray(items) ? [...items] : [];
  const next = typeof value === 'string' ? value.trim() : '';
  if (!next) return list.slice(0, maxLen);
  if (!list.some((item) => String(item || '').trim() === next)) {
    list.push(next);
  }
  return list.slice(0, maxLen);
}

function normalizeEvidenceArray(value, { allowEvidence = true } = {}) {
  if (!allowEvidence) return [];
  if (!Array.isArray(value)) return [];
  return value
    .filter(e => e && typeof e === 'object' && typeof e.field === 'string')
    .map(e => ({
      field: (e.field || '').slice(0, 50),
      quote: (typeof e.quote === 'string' ? e.quote : '').slice(0, 500),
      sourceUrl: (typeof e.sourceUrl === 'string' ? e.sourceUrl : '').slice(0, 500)
    }))
    .slice(0, 10);
}

function normalizeNoBodyRoiText(value) {
  const cleaned = clampText(value, '', 800);
  if (!cleaned) return NO_BODY_ROI_FALLBACK;
  if (NUMBER_SIGNAL_RE.test(cleaned)) return NO_BODY_ROI_FALLBACK;
  if (/^근거 없음\(추정 불가\)/u.test(cleaned)) return cleaned;
  return `근거 없음(추정 불가) - ${cleaned}`;
}

export function normalizeEnrichData(enrichData, lead, options = {}) {
  const data = enrichData && typeof enrichData === 'object' ? enrichData : {};
  const hasBody = typeof options.hasArticleBody === 'boolean'
    ? options.hasArticleBody
    : hasArticleBody(options.articleBody);
  const normalized = {
    summary: clampText(data.summary, lead.summary, 500),
    roi: clampText(data.roi, lead.roi, 800),
    salesPitch: clampText(data.salesPitch, lead.salesPitch, 1000),
    globalContext: clampText(data.globalContext, lead.globalContext, 700),
    actionItems: normalizeStringArray(data.actionItems, 10),
    keyFigures: normalizeStringArray(data.keyFigures, 10),
    painPoints: normalizeStringArray(data.painPoints, 10),
    meddic: normalizeObjectField(data.meddic),
    competitive: normalizeObjectField(data.competitive),
    buyingSignals: normalizeStringArray(data.buyingSignals, 10),
    evidence: normalizeEvidenceArray(data.evidence, { allowEvidence: hasBody }),
    assumptions: normalizeStringArray(data.assumptions, 10),
    dataGaps: normalizeStringArray(data.dataGaps, 10)
  };
  if (!hasBody) {
    normalized.roi = normalizeNoBodyRoiText(normalized.roi);
    normalized.dataGaps = appendUniqueString(normalized.dataGaps, NO_BODY_DATA_GAP, 10);
  }
  if (normalized.roi && /\d/.test(normalized.roi) && normalized.assumptions.length === 0) {
    normalized.assumptions.push('(시스템 경고: ROI에 숫자가 포함되었으나 가정이 명시되지 않음)');
  }
  return normalized;
}

export async function handleEnrichLead(request, env, leadId) {
  if (!env.DB) return jsonResponse({ success: false, message: '시스템 설정이 필요합니다. 관리자에게 문의하세요.' }, 503);
  if (!env.GEMINI_API_KEY) return jsonResponse({ success: false, message: '서버 설정 오류: GEMINI_API_KEY가 설정되지 않았습니다.' }, 503);
  const lead = await getLeadById(env.DB, leadId);
  if (!lead) return jsonResponse({ success: false, message: '리드를 찾을 수 없습니다.' }, 404);
  const manualReviewNotesAccess = await resolveManualReviewNotesAccess(request, env);

  const url = new URL(request.url);
  if (lead.enriched && !url.searchParams.get('force')) {
    return jsonResponse({
      success: false,
      message: '이미 분석된 리드입니다. 재분석 버튼을 이용하세요.',
      lead: filterManualReviewNotesProtectedFields(lead, manualReviewNotesAccess),
    }, 409);
  }

  try {
    const sourceUrl = pickBestSourceUrl(lead.sources);
    const articleBody = await fetchArticleBodyWorker(sourceUrl, createWorkerOutboundHttpContext());
    const enrichData = normalizeEnrichData(await callGeminiEnrich(lead, articleBody, env), lead, { articleBody });
    await updateLeadEnrichment(env.DB, leadId, enrichData, articleBody);

    const updated = await getLeadById(env.DB, leadId);
    return jsonResponse({
      success: true,
      lead: filterManualReviewNotesProtectedFields(updated, manualReviewNotesAccess),
      hadArticle: hasArticleBody(articleBody),
    });
  } catch {
    return jsonResponse({ success: false, message: '심층 분석 중 오류가 발생했습니다.' }, 502);
  }
}

export async function handleBatchEnrich(request, env) {
  if (!env.DB) return jsonResponse({ success: false, message: '시스템 설정이 필요합니다. 관리자에게 문의하세요.' }, 503);
  if (!env.GEMINI_API_KEY) return jsonResponse({ success: false, message: '서버 설정 오류: GEMINI_API_KEY가 설정되지 않았습니다.' }, 503);
  const body = await request.json().catch(() => ({}));
  const requestedProfile = typeof body.profile === 'string' ? body.profile.trim() : '';
  const profileId = resolveProfileId(requestedProfile, env);
  if (requestedProfile && requestedProfile !== profileId) {
    return jsonResponse({ success: false, message: `유효하지 않은 프로필입니다: ${requestedProfile}` }, 400);
  }

  await ensureD1Schema(env.DB);
  const { results } = await env.DB.prepare(
    'SELECT * FROM leads WHERE profile_id = ? AND (enriched IS NULL OR enriched = 0) ORDER BY score DESC LIMIT 3'
  ).bind(profileId).all();

  if (!results || results.length === 0) {
    const { results: remaining } = await env.DB.prepare(
      'SELECT COUNT(*) as cnt FROM leads WHERE profile_id = ? AND (enriched IS NULL OR enriched = 0)'
    ).bind(profileId).all();
    return jsonResponse({ success: true, enriched: 0, remaining: remaining?.[0]?.cnt || 0, message: '분석할 리드가 없습니다.' });
  }

  const outboundHttp = createWorkerOutboundHttpContext();
  const settled = await Promise.allSettled(
    results.map(async (row) => {
      const lead = rowToLead(row);
      const sourceUrl = pickBestSourceUrl(lead.sources);
      const articleBody = await fetchArticleBodyWorker(sourceUrl, outboundHttp);
      const enrichData = normalizeEnrichData(await callGeminiEnrich(lead, articleBody, env), lead, { articleBody });
      await updateLeadEnrichment(env.DB, lead.id, enrichData, articleBody);
      return { id: lead.id, company: lead.company, success: true };
    })
  );
  const enrichedResults = settled.map((result, i) => {
    if (result.status === 'fulfilled') return result.value;
    const lead = rowToLead(results[i]);
    return { id: lead.id, company: lead.company, success: false, error: '심층 분석 중 오류가 발생했습니다.' };
  });

  const { results: remainingRows } = await env.DB.prepare(
    'SELECT COUNT(*) as cnt FROM leads WHERE profile_id = ? AND (enriched IS NULL OR enriched = 0)'
  ).bind(profileId).all();
  const remaining = remainingRows?.[0]?.cnt || 0;

  return jsonResponse({
    success: true,
    enriched: enrichedResults.filter(r => r.success).length,
    failed: enrichedResults.filter(r => !r.success).length,
    remaining,
    results: enrichedResults
  });
}
