import { jsonResponse } from '../lib/utils.js';
import { fetchAllNewsWorker } from './news.js';
import { generateProfileFromGemini, generateHeuristicProfile } from './profile-gen.js';
import { analyzeLeadsWorker, createSelfServiceSchemaPayloadWorker, filterArticlesForTargetCompany, generateQuickLeadsWorker } from './analyze.js';
import { fetchArticleBodyWorker } from '../api/enrichment.js';
import { saveLeadsBatch, logAnalyticsRun } from '../db/leads.js';
import { isValidSelfServiceResponseSchema } from './lead-utils.js';

export async function handleSelfServiceAnalyze(request, env, ctx) {
  const softDeadlineMs = 28500;
  const profileTimeoutMs = 9000;
  const startTime = Date.now();
  const body = await request.json().catch(() => ({}));
  const company = (body.company || '').trim().slice(0, 50);
  const industry = (body.industry || '').trim().slice(0, 50);
  let profile = null;
  let profileGenerationMode = 'llm';
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
  if (!env.GEMINI_API_KEY && !env.OPENAI_API_KEY) {
    return jsonResponse({
      success: false,
      message: '서버 설정 오류: GEMINI_API_KEY 또는 OPENAI_API_KEY가 설정되지 않았습니다.',
      generationMode: 'unavailable',
      verificationStatus: 'unverified',
      confidence: 'LOW',
      confidenceReason: 'LLM API key is not configured, so lead generation did not run.',
      assumptions: [],
      dataGaps: ['LLM API key missing']
    }, 503);
  }

  try {
    try {
      profile = await Promise.race([
        generateProfileFromGemini(company, industry, env),
        new Promise((_, reject) => setTimeout(() => reject(new Error('SELF_SERVICE_PROFILE_TIMEOUT')), profileTimeoutMs))
      ]);
    } catch (e) {
      profile = generateHeuristicProfile(company, industry);
      profileGenerationMode = 'heuristic';
    }

    const elapsed1 = Date.now() - startTime;
    if (elapsed1 > softDeadlineMs) {
      return jsonResponse({ success: false, message: '시간 초과: 프로필 생성에 시간이 오래 걸렸습니다. 다시 시도하세요.' }, 504);
    }

    articles = await fetchAllNewsWorker(profile.searchQueries);
    articles = filterArticlesForTargetCompany(articles, company);
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
        summary: '관련 뉴스가 부족하여 리드를 생성하지 못했습니다.',
        generationMode: 'unavailable',
        verificationStatus: 'unverified',
        profileGenerationMode,
        dataGaps: ['관련 공개 뉴스 부족']
      });
    }

    const buildSuccessResponse = (rawLeads, summaryHint = '') => {
      const schemaPayload = createSelfServiceSchemaPayloadWorker(rawLeads, summaryHint);
      const responsePayload = {
        leads: schemaPayload.leads,
        summary: schemaPayload.summary
      };
      if (!isValidSelfServiceResponseSchema(responsePayload)) {
        throw new Error('SELF_SERVICE_RESPONSE_SCHEMA_VALIDATION_FAILED');
      }
      const generationModes = [...new Set(responsePayload.leads.map((lead) => lead.generationMode).filter(Boolean))];
      const generationMode = generationModes.length === 1
        ? generationModes[0]
        : (generationModes.includes('heuristic') ? 'heuristic' : 'llm');
      const verificationStatus = responsePayload.leads.length > 0 && responsePayload.leads.every((lead) => lead.verificationStatus === 'verified')
        ? 'verified'
        : (generationMode === 'heuristic' ? 'needs_review' : 'needs_review');
      const dataGaps = [...new Set(responsePayload.leads.flatMap((lead) => Array.isArray(lead.dataGaps) ? lead.dataGaps : []))];
      persistSelfServiceRun(rawLeads);
      return jsonResponse({
        success: true,
        leads: responsePayload.leads,
        summary: responsePayload.summary,
        generationMode,
        verificationStatus,
        profileGenerationMode,
        dataGaps
      });
    };

    const remainingMs = softDeadlineMs - elapsed2;
    if (remainingMs < 1500) {
      const quickLeads = generateQuickLeadsWorker(articles, profile);
      const quickTargetedLeads = generateQuickLeadsWorker(articles, profile, company);
      return buildSuccessResponse(
        quickTargetedLeads.length > 0 ? quickTargetedLeads : quickLeads,
        'AI 분석 지연으로 규칙 기반 결과를 우선 제공합니다.'
      );
    }
    const leads = await Promise.race([
      analyzeLeadsWorker(articles, profile, env, company),
      new Promise((_, reject) => setTimeout(() => reject(new Error('SELF_SERVICE_ANALYZE_TIMEOUT')), remainingMs))
    ]);

    return buildSuccessResponse(leads, `${company} 관련 최신 뉴스 기반 즉시 분석 결과입니다.`);
  } catch (e) {
    if (e && e.message === 'SELF_SERVICE_ANALYZE_TIMEOUT') {
      const fallbackLeads = generateQuickLeadsWorker(articles, profile || generateHeuristicProfile(company, industry), company);
      const schemaPayload = createSelfServiceSchemaPayloadWorker(fallbackLeads, 'AI 분석 지연으로 규칙 기반 결과를 우선 제공합니다.');
      const responsePayload = { leads: schemaPayload.leads, summary: schemaPayload.summary };
      if (!isValidSelfServiceResponseSchema(responsePayload)) {
        return jsonResponse({ success: false, error: 'SELF_SERVICE_RESPONSE_SCHEMA_VALIDATION_FAILED', message: '분석 결과 검증에 실패했습니다.' }, 500);
      }
      persistSelfServiceRun(fallbackLeads);
      return jsonResponse({
        success: true,
        leads: responsePayload.leads,
        summary: responsePayload.summary,
        generationMode: 'heuristic',
        verificationStatus: 'needs_review',
        profileGenerationMode,
        dataGaps: [...new Set(responsePayload.leads.flatMap((lead) => Array.isArray(lead.dataGaps) ? lead.dataGaps : []))]
      });
    }

    if (articles.length > 0) {
      const fallbackLeads = generateQuickLeadsWorker(articles, profile || generateHeuristicProfile(company, industry), company);
      const schemaPayload = createSelfServiceSchemaPayloadWorker(fallbackLeads, 'AI 응답 불안정으로 규칙 기반 결과를 제공합니다.');
      const responsePayload = { leads: schemaPayload.leads, summary: schemaPayload.summary };
      if (!isValidSelfServiceResponseSchema(responsePayload)) {
        return jsonResponse({ success: false, error: 'SELF_SERVICE_RESPONSE_SCHEMA_VALIDATION_FAILED', message: '분석 결과 검증에 실패했습니다.' }, 500);
      }
      persistSelfServiceRun(fallbackLeads);
      return jsonResponse({
        success: true,
        leads: responsePayload.leads,
        summary: responsePayload.summary,
        generationMode: 'heuristic',
        verificationStatus: 'needs_review',
        profileGenerationMode,
        dataGaps: [...new Set(responsePayload.leads.flatMap((lead) => Array.isArray(lead.dataGaps) ? lead.dataGaps : []))]
      });
    }
    return jsonResponse({ success: false, message: '분석 중 오류가 발생했습니다.' }, 500);
  }
}
