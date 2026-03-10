import { jsonResponse } from '../lib/utils.js';
import { callGemini } from '../lib/gemini.js';
import { resolveProfileId } from '../lib/profile.js';
import { ensureD1Schema } from '../db/schema.js';
import { rowToLead } from '../db/transform.js';
import { getLeadById, updateLeadEnrichment } from '../db/leads.js';
import { saveSignalsBatch } from '../db/signals.js';

function pickBestSource(sources) {
  if (!Array.isArray(sources) || sources.length === 0) return null;
  const direct = sources.find((s) => s && s.url && !/news\.google\.com/i.test(s.url));
  return direct || sources[0] || null;
}

function pickBestSourceUrl(sources) {
  return pickBestSource(sources)?.url || null;
}

export async function fetchArticleBodyWorker(url) {
  if (!url) return '';
  if (url.includes('news.google.com/')) return '';
  let timer = null;
  try {
    const controller = new AbortController();
    timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; B2BLeadBot/1.0)' }
    });
    if (!res.ok) return '';
    const html = await res.text();
    return extractBodyFromHTML(html);
  } catch {
    return '';
  } finally {
    if (timer) clearTimeout(timer);
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

export async function callGeminiEnrich(lead, articleBody, env) {
  const hasBody = articleBody && articleBody.length > 50;
  const prompt = `B2B 영업 인텔리전스 분석가로서 MEDDIC 기반 심층 분석을 수행하라.

[리드]
회사: ${lead.company} | 요약: ${lead.summary || 'N/A'} | 제품: ${lead.product || 'N/A'} | ROI: ${lead.roi || 'N/A'}

${hasBody ? `[기사 본문]\n${articleBody}` : '[기사 본문 없음 — 리드 요약만으로 분석하되 dataGaps에 "기사 본문 미확보"를 명시]'}

[분석 지시]
1. 수치 추출: 기사에서 발견한 숫자(금액·용량·면적·전력·일정·인원)를 keyFigures에 나열. 발견 못하면 빈 배열.
2. painPoint, businessImpact, likelyInitiative, stakeholderHint는 근거 부족 시 반드시 "unknown"으로 써라. 추측 금지.
3. painPoints는 세부 고객 과제를 배열로 작성한다. 가능하면 금액/시간으로 정량화하고, 근거가 약하면 빈 배열로 둔다.
4. urgency는 HIGH|MEDIUM|LOW 중 하나만 반환한다. 근거가 약하면 LOW로 두고 urgencyReason에 "unknown" 또는 부족한 이유를 적어라.
5. signalStrength는 0~100 정수다. 기사 본문과 명시적 증거가 강하면 높이고, 제목 수준 추정이면 낮춰라.
6. confidence는 HIGH|MEDIUM|LOW 중 하나만 반환한다. confidenceReason에는 왜 그 수준인지 적고, 근거 부족이면 "unknown"을 포함해라.
7. ROI 분석:
   a) keyFigures에서 발견한 숫자가 있으면: 산업 평균 절감률(%) + 발견 숫자로 ROI 범위를 계산.
      형식: "투자 추정 X~Y억 → 절감 추정 A~B억/년 (Payback N~M년)"
   b) 숫자가 없으면: "정량 데이터 부족 — 유사 사례 기준 절감률 N~M% 예상" 형태로만 작성.
      절대로 구체 금액을 창작하지 말 것.
   c) assumptions에 ROI 산출에 사용한 모든 가정을 나열.
8. SPIN 영업제안(현황→문제→영향→가치)
9. 1주/1개월/3개월 후속조치(부서·직급 명시)
10. MEDDIC(예산·의사결정·니즈·타임라인·프로세스·챔피언)
11. 경쟁환경(현재벤더·경쟁사·차별점·전환장벽)
12. evidence: 분석의 주요 근거를 기사 원문에서 직접 인용. 각 항목에 대상 필드(summary/roi/painPoint/businessImpact/meddic 등), 인용 문장, 출처 URL 포함.
13. missingInformation: 분석에 필요하지만 확인 불가능한 정보 목록 (예: "예산 규모 미확인", "의사결정자 미파악")

[출력] 아래 JSON만 반환. 한국어. 마크다운 펜스 없이.
{"summary":"프로젝트명·규모·일정 포함 2문장","roi":"위 정책대로 작성","salesPitch":"[현황]→[문제]→[영향]→[가치] 3문장","globalContext":"글로벌 트렌드","painPoint":"핵심 pain 또는 unknown","urgency":"HIGH|MEDIUM|LOW","urgencyReason":"긴급도 근거 또는 unknown","businessImpact":"사업 영향 또는 unknown","likelyInitiative":"도입/투자 이니셔티브 또는 unknown","stakeholderHint":"관련 부서/의사결정자 힌트 또는 unknown","signalStrength":78,"confidence":"HIGH|MEDIUM|LOW","confidenceReason":"신뢰도 근거 또는 unknown","actionItems":["[1주] 구체적 조치","[1개월] 조치","[3개월] 조치"],"keyFigures":["발견 숫자: 설명"],"painPoints":["과제: 가능하면 정량 수치 포함"],"meddic":{"budget":"예산규모+근거","authority":"의사결정 구조","need":"핵심니즈","timeline":"구매타임라인","decisionProcess":"구매프로세스","champion":"챔피언후보"},"competitive":{"currentVendor":"현재벤더","competitors":"경쟁사","ourAdvantage":"차별점","switchBarrier":"전환장벽+극복방안"},"buyingSignals":["구매신호1"],"evidence":[{"field":"근거 대상 필드","quote":"기사 원문 인용","sourceUrl":"URL"}],"assumptions":["ROI 가정1","가정2"],"missingInformation":["미확인 정보1"]}`;

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

function normalizeLevel(value, allowed, fallback = '') {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return allowed.includes(normalized) ? normalized : fallback;
}

function clampText(value, fallback = '', maxLen = 800) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (raw) return raw.slice(0, maxLen);
  const fb = typeof fallback === 'string' ? fallback.trim() : '';
  return fb.slice(0, maxLen);
}

function clampUnknownText(value, fallback = 'unknown', maxLen = 800) {
  const text = clampText(value, '', maxLen);
  return text || fallback;
}

function normalizeSignalStrength(value, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.min(100, Math.round(value)));
  }
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (normalized === 'HIGH') return 85;
  if (normalized === 'MEDIUM') return 60;
  if (normalized === 'LOW') return 35;
  return Math.max(0, Math.min(100, Math.round(Number(fallback) || 0)));
}

function normalizeObjectField(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  return {};
}

function normalizeEvidenceArray(value) {
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

function computeRecencyScore(timestamp) {
  const parsed = timestamp ? new Date(timestamp) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return 40;
  const days = Math.max(0, (Date.now() - parsed.getTime()) / 86400000);
  if (days <= 7) return 90;
  if (days <= 30) return 75;
  if (days <= 90) return 55;
  return 35;
}

function computeTrustScore(url) {
  if (!url) return 35;
  if (/news\.google\.com/i.test(url)) return 45;
  if (/(investor|ir|careers|recruit|newsroom|press)/i.test(url)) return 80;
  return 70;
}

function deriveSignalSource(sourceUrl, lead) {
  if (!sourceUrl) return lead.source || 'lead-enrichment';
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, '');
  } catch {
    return lead.source || 'lead-enrichment';
  }
}

export function normalizeEnrichData(enrichData, lead) {
  const data = enrichData && typeof enrichData === 'object' ? enrichData : {};
  const evidence = normalizeEvidenceArray(data.evidence);
  const painPoints = normalizeStringArray(data.painPoints, 10);
  const missingInformation = normalizeStringArray(data.missingInformation || data.dataGaps, 10);
  const painPoint = clampUnknownText(data.painPoint || painPoints[0], 'unknown', 300);
  const stakeholderHint = clampUnknownText(data.stakeholderHint || data.buyerRole, 'unknown', 300);
  const urgency = normalizeLevel(data.urgency, ['HIGH', 'MEDIUM', 'LOW'], (Number(lead.score) || 0) >= 85 ? 'HIGH' : 'MEDIUM');
  const confidence = normalizeLevel(data.confidence, ['HIGH', 'MEDIUM', 'LOW'], evidence.length > 0 ? 'MEDIUM' : 'LOW');
  const normalized = {
    summary: clampText(data.summary, lead.summary, 500),
    roi: clampText(data.roi, lead.roi, 800),
    salesPitch: clampText(data.salesPitch, lead.salesPitch, 1000),
    globalContext: clampText(data.globalContext, lead.globalContext, 700),
    painPoint,
    urgency,
    urgencyReason: clampUnknownText(data.urgencyReason, 'unknown', 300),
    businessImpact: clampUnknownText(data.businessImpact, 'unknown', 400),
    likelyInitiative: clampUnknownText(data.likelyInitiative, 'unknown', 300),
    stakeholderHint,
    signalStrength: normalizeSignalStrength(data.signalStrength, evidence.length > 0 ? 65 : 40),
    confidence,
    confidenceReason: clampUnknownText(data.confidenceReason, 'unknown', 300),
    actionItems: normalizeStringArray(data.actionItems, 10),
    keyFigures: normalizeStringArray(data.keyFigures, 10),
    painPoints,
    meddic: normalizeObjectField(data.meddic),
    competitive: normalizeObjectField(data.competitive),
    buyingSignals: normalizeStringArray(data.buyingSignals, 10),
    evidence,
    assumptions: normalizeStringArray(data.assumptions, 10),
    missingInformation,
    dataGaps: missingInformation,
    buyerRole: stakeholderHint
  };
  if (normalized.roi && /\d/.test(normalized.roi) && normalized.assumptions.length === 0) {
    normalized.assumptions.push('(시스템 경고: ROI에 숫자가 포함되었으나 가정이 명시되지 않음)');
  }
  return normalized;
}

export function buildPainSignalsFromEnrichment(lead, enrichData) {
  if (!lead?.id || !lead?.company || !enrichData) return [];
  const primarySource = pickBestSource(lead.sources);
  const sourceUrl = primarySource?.url || enrichData.evidence?.[0]?.sourceUrl || '';
  const sourceTitle = primarySource?.title || lead.summary || '';
  const rawExcerpt = enrichData.evidence?.[0]?.quote
    || enrichData.painPoint
    || enrichData.businessImpact
    || '';

  return [{
    leadId: lead.id,
    profileId: lead.profileId,
    company: lead.company,
    signalType: lead.eventType || 'pain_enrichment',
    signalSource: deriveSignalSource(sourceUrl, lead),
    sourceUrl,
    sourceTitle,
    sourcePublishedAt: lead.createdAt || '',
    signalStrength: enrichData.signalStrength,
    recencyScore: computeRecencyScore(lead.createdAt),
    trustScore: computeTrustScore(sourceUrl),
    painHint: enrichData.painPoint,
    urgencyHint: `${enrichData.urgency}: ${enrichData.urgencyReason}`,
    businessImpactHint: enrichData.businessImpact,
    rawExcerpt,
    structuredEvidence: {
      likelyInitiative: enrichData.likelyInitiative,
      stakeholderHint: enrichData.stakeholderHint,
      confidence: enrichData.confidence,
      confidenceReason: enrichData.confidenceReason,
      missingInformation: enrichData.missingInformation,
      keyFigures: enrichData.keyFigures,
      buyingSignals: enrichData.buyingSignals,
      evidence: enrichData.evidence.map((item) => `${item.field}: ${item.quote}`)
    }
  }];
}

export async function handleEnrichLead(request, env, leadId) {
  if (!env.DB) return jsonResponse({ success: false, message: '시스템 설정이 필요합니다. 관리자에게 문의하세요.' }, 503);
  if (!env.GEMINI_API_KEY) return jsonResponse({ success: false, message: '서버 설정 오류: GEMINI_API_KEY가 설정되지 않았습니다.' }, 503);
  const lead = await getLeadById(env.DB, leadId);
  if (!lead) return jsonResponse({ success: false, message: '리드를 찾을 수 없습니다.' }, 404);

  const url = new URL(request.url);
  if (lead.enriched && !url.searchParams.get('force')) {
    return jsonResponse({ success: false, message: '이미 분석된 리드입니다. 재분석 버튼을 이용하세요.', lead }, 409);
  }

  try {
    const sourceUrl = pickBestSourceUrl(lead.sources);
    const articleBody = await fetchArticleBodyWorker(sourceUrl);
    const enrichData = normalizeEnrichData(await callGeminiEnrich(lead, articleBody, env), lead);
    await updateLeadEnrichment(env.DB, leadId, enrichData, articleBody);
    await saveSignalsBatch(env.DB, buildPainSignalsFromEnrichment(lead, enrichData));

    const updated = await getLeadById(env.DB, leadId);
    return jsonResponse({ success: true, lead: updated, hadArticle: articleBody.length > 50 });
  } catch (e) {
    return jsonResponse({ success: false, message: '심층 분석 실패: ' + (e?.message || 'unknown error') }, 502);
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

  const settled = await Promise.allSettled(
    results.map(async (row) => {
      const lead = rowToLead(row);
      const sourceUrl = pickBestSourceUrl(lead.sources);
      const articleBody = await fetchArticleBodyWorker(sourceUrl);
      const enrichData = normalizeEnrichData(await callGeminiEnrich(lead, articleBody, env), lead);
      await updateLeadEnrichment(env.DB, lead.id, enrichData, articleBody);
      await saveSignalsBatch(env.DB, buildPainSignalsFromEnrichment(lead, enrichData));
      return { id: lead.id, company: lead.company, success: true };
    })
  );
  const enrichedResults = settled.map((result, i) => {
    if (result.status === 'fulfilled') return result.value;
    const lead = rowToLead(results[i]);
    return { id: lead.id, company: lead.company, success: false, error: result.reason?.message || 'unknown' };
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
