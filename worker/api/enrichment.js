import { jsonResponse } from '../lib/utils.js';
import { resolveProfileId } from '../lib/profile.js';
import { ensureD1Schema } from '../db/schema.js';
import { rowToLead } from '../db/transform.js';
import { getLeadById, updateLeadEnrichment } from '../db/leads.js';
import {
  filterManualReviewNotesProtectedFields,
  resolveManualReviewNotesAccess,
} from '../lib/manual-review-notes-access.js';
import { createWorkerOutboundHttpContext } from '../lib/outbound-http.js';
import {
  callGeminiEnrich,
  fetchArticleBodyWorker,
  hasArticleBody,
  normalizeEnrichData,
  pickBestSourceUrl,
} from '../lib/lead-enrichment.js';

export {
  buildEnrichmentPrompt,
  callGeminiEnrich,
  extractBodyFromHTML,
  fetchArticleBodyWorker,
  hasArticleBody,
  normalizeEnrichData,
} from '../lib/lead-enrichment.js';

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
