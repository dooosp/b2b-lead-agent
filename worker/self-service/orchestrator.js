import { jsonResponse } from '../lib/utils.js';
import { fetchAllNewsWorker } from './news.js';
import { generateProfileFromGemini, generateHeuristicProfile } from './profile-gen.js';
import { analyzeLeadsWorker, generateQuickLeadsWorker } from './analyze.js';
import { fetchArticleBodyWorker } from '../api/enrichment.js';
import { saveLeadsBatch, logAnalyticsRun } from '../db/leads.js';

export async function handleSelfServiceAnalyze(request, env, ctx) {
  const softDeadlineMs = 28500;
  const profileTimeoutMs = 9000;
  const startTime = Date.now();
  const body = await request.json().catch(() => ({}));
  const company = (body.company || '').trim().slice(0, 50);
  const industry = (body.industry || '').trim().slice(0, 50);
  let profile = null;
  let profileMode = 'ai';
  let articles = [];
  let bodyHitRate = 0;
  const persistSelfServiceRun = (leads) => {
    if (!env.DB || !Array.isArray(leads) || leads.length === 0) return;
    const ssProfileId = `self-service:${company}`;
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    let ipHash = 'unknown';
    if (ip !== 'unknown') {
      try { ipHash = btoa(ip).slice(0, 12); } catch { ipHash = 'unknown'; }
    }
    const savePromise = Promise.all([
      saveLeadsBatch(env.DB, leads, ssProfileId, 'self-service'),
      logAnalyticsRun(env.DB, {
        type: 'self-service', profileId: ssProfileId, company, industry,
        leadsCount: leads.length, articlesCount: articles.length,
        elapsedSec: Math.round((Date.now() - startTime) / 1000), ipHash,
        bodyHitRate
      })
    ]).catch(() => {});
    if (ctx && ctx.waitUntil) ctx.waitUntil(savePromise);
  };

  if (!company || !industry) {
    return jsonResponse({ success: false, message: '회사명과 산업 분야를 모두 입력하세요.' }, 400);
  }
  if (!env.GEMINI_API_KEY) {
    return jsonResponse({ success: false, message: '서버 설정 오류: GEMINI_API_KEY가 설정되지 않았습니다.' }, 503);
  }

  try {
    try {
      profile = await Promise.race([
        generateProfileFromGemini(company, industry, env),
        new Promise((_, reject) => setTimeout(() => reject(new Error('SELF_SERVICE_PROFILE_TIMEOUT')), profileTimeoutMs))
      ]);
    } catch (e) {
      profile = generateHeuristicProfile(company, industry);
      profileMode = 'heuristic-fallback';
    }

    const elapsed1 = Date.now() - startTime;
    if (elapsed1 > softDeadlineMs) {
      return jsonResponse({ success: false, message: '시간 초과: 프로필 생성에 시간이 오래 걸렸습니다. 다시 시도하세요.' }, 504);
    }

    articles = await fetchAllNewsWorker(profile.searchQueries);
    articles = articles.slice(0, 18);

    const bodyTargets = articles.slice(0, 10);
    const bodyResults = await Promise.allSettled(
      bodyTargets.map(a => fetchArticleBodyWorker(a.link))
    );
    let bodyHitCount = 0;
    bodyResults.forEach((r, i) => {
      if (r.status === 'fulfilled' && r.value && r.value.length > 50) {
        bodyTargets[i]._body = r.value;
        bodyTargets[i]._hasBody = true;
        bodyHitCount++;
      } else {
        bodyTargets[i]._hasBody = false;
      }
    });
    bodyHitRate = bodyTargets.length > 0 ? Math.round((bodyHitCount / bodyTargets.length) * 100) : 0;

    const elapsed2 = Date.now() - startTime;
    if (elapsed2 > softDeadlineMs) {
      return jsonResponse({ success: false, message: '시간 초과: 뉴스 수집에 시간이 오래 걸렸습니다. 다시 시도하세요.' }, 504);
    }

    if (articles.length === 0) {
      return jsonResponse({
        success: true,
        leads: [],
        profile: { name: profile.name, industry: profile.industry },
        message: '최근 3일간 관련 뉴스를 찾지 못했습니다. 다른 키워드로 시도해보세요.',
        stats: { articles: 0, elapsed: Math.round((Date.now() - startTime) / 1000) }
      });
    }

    const buildSuccessResponse = (leads, mode = 'ai', message = '') => {
      persistSelfServiceRun(leads);
      return jsonResponse({
        success: true,
        leads,
        profile: { name: profile.name, industry: profile.industry, competitors: profile.competitors },
        message,
        stats: {
          mode: profileMode === 'ai' ? mode : `${mode}+${profileMode}`,
          articles: articles.length,
          leads: leads.length,
          elapsed: Math.round((Date.now() - startTime) / 1000),
          bodyHitRate
        }
      });
    };

    const remainingMs = softDeadlineMs - elapsed2;
    if (remainingMs < 1500) {
      const quickLeads = generateQuickLeadsWorker(articles, profile);
      return buildSuccessResponse(
        quickLeads,
        'quick-fallback',
        'AI 분석이 지연되어 빠른 분석 결과를 먼저 표시합니다.'
      );
    }
    const leads = await Promise.race([
      analyzeLeadsWorker(articles, profile, env),
      new Promise((_, reject) => setTimeout(() => reject(new Error('SELF_SERVICE_ANALYZE_TIMEOUT')), remainingMs))
    ]);

    return buildSuccessResponse(leads, 'ai');
  } catch (e) {
    if (e && e.message === 'SELF_SERVICE_ANALYZE_TIMEOUT') {
      const fallbackLeads = generateQuickLeadsWorker(articles, profile || generateHeuristicProfile(company, industry));
      persistSelfServiceRun(fallbackLeads);
      return jsonResponse({
        success: true,
        leads: fallbackLeads,
        profile: {
          name: (profile && profile.name) || company,
          industry: (profile && profile.industry) || industry,
          competitors: (profile && profile.competitors) || []
        },
        message: 'AI 분석이 지연되어 빠른 분석 결과를 먼저 표시합니다.',
        stats: {
          mode: profileMode === 'ai' ? 'quick-fallback' : `quick-fallback+${profileMode}`,
          articles: articles.length,
          leads: fallbackLeads.length,
          elapsed: Math.round((Date.now() - startTime) / 1000),
          bodyHitRate
        }
      });
    }

    if (articles.length > 0) {
      const fallbackLeads = generateQuickLeadsWorker(articles, profile || generateHeuristicProfile(company, industry));
      persistSelfServiceRun(fallbackLeads);
      return jsonResponse({
        success: true,
        leads: fallbackLeads,
        profile: {
          name: (profile && profile.name) || company,
          industry: (profile && profile.industry) || industry,
          competitors: (profile && profile.competitors) || []
        },
        message: 'AI 분석 응답이 불안정하여 빠른 분석 결과를 먼저 표시합니다.',
        stats: {
          mode: profileMode === 'ai' ? 'quick-fallback' : `quick-fallback+${profileMode}`,
          articles: articles.length,
          leads: fallbackLeads.length,
          elapsed: Math.round((Date.now() - startTime) / 1000),
          bodyHitRate
        }
      });
    }
    return jsonResponse({ success: false, message: '분석 실패: ' + e.message }, 500);
  }
}
