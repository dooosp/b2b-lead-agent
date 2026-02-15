// ===== Imports =====
import { jsonResponse } from './lib/utils.js';
import { addCorsHeaders, handleOptions } from './lib/cors.js';
import { verifyAuth, checkRateLimit } from './lib/auth.js';
import { resolveLeadProfileForQuery } from './lib/profile.js';

import { getLeadById, getStatusLogByLead } from './db/leads.js';
import { handleTrigger } from './api/trigger.js';
import { fetchLeads, fetchHistory, handleUpdateLead, handleExportCSV } from './api/leads-api.js';
import { handleGetReferences, handleAddReference, handleDeleteReference } from './api/references-api.js';
import { generatePPT } from './api/ppt.js';
import { handleRoleplay } from './api/roleplay.js';
import { handleEnrichLead, handleBatchEnrich } from './api/enrichment.js';
import { handleDashboard } from './api/dashboard.js';

import { checkSelfServiceRateLimit } from './self-service/rate-limit.js';
import { handleSelfServiceAnalyze } from './self-service/orchestrator.js';

import { getPWAManifest, getServiceWorkerJS } from './pages/pwa.js';
import { getMainPage } from './pages/main.js';
import { getLeadsPage } from './pages/leads.js';
import { getLeadDetailPage } from './pages/lead-detail.js';
import { getPPTPage } from './pages/ppt.js';
import { getRoleplayPage } from './pages/roleplay.js';
import { getHistoryPage } from './pages/history.js';
import { getDashboardPage } from './pages/dashboard.js';

// ===== Router =====
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');

    // CORS Preflight
    if (request.method === 'OPTIONS') {
      return handleOptions(request, env);
    }

    // API 라우팅 — 인증 필요 경로
    const apiPaths = ['/api/leads', '/api/leads/batch-enrich', '/api/ppt', '/api/roleplay', '/api/history', '/api/dashboard', '/api/export/csv'];
    if (apiPaths.includes(url.pathname) || url.pathname.startsWith('/api/leads/')) {
      const authErr = await verifyAuth(request, env);
      if (authErr) return addCorsHeaders(authErr, origin, env);
    }

    // 셀프서비스 API — 인증 불필요, rate limit만 적용
    if (url.pathname === '/api/analyze' && request.method === 'POST') {
      const rlErr = await checkSelfServiceRateLimit(request, env);
      if (rlErr) return addCorsHeaders(rlErr, origin, env);
      return addCorsHeaders(await handleSelfServiceAnalyze(request, env, ctx), origin, env);
    }

    // /trigger는 Bearer token 또는 body password 허용 (하위 호환)
    if (url.pathname === '/trigger' && request.method === 'POST') {
      const rlErr = await checkRateLimit(request, env);
      if (rlErr) return rlErr;
      return await handleTrigger(request, env);
    }
    if (url.pathname === '/api/leads' && request.method === 'GET') {
      const profileRes = resolveLeadProfileForQuery(url.searchParams.get('profile'), env);
      if (!profileRes.ok) {
        return addCorsHeaders(jsonResponse({ success: false, message: profileRes.message }, 400), origin, env);
      }
      return addCorsHeaders(await fetchLeads(env, profileRes.profileId), origin, env);
    }
    if (url.pathname === '/api/ppt' && request.method === 'POST') {
      return addCorsHeaders(await generatePPT(request, env), origin, env);
    }
    if (url.pathname === '/api/roleplay' && request.method === 'POST') {
      return addCorsHeaders(await handleRoleplay(request, env), origin, env);
    }
    if (url.pathname === '/api/history' && request.method === 'GET') {
      const profileRes = resolveLeadProfileForQuery(url.searchParams.get('profile'), env);
      if (!profileRes.ok) {
        return addCorsHeaders(jsonResponse({ success: false, message: profileRes.message }, 400), origin, env);
      }
      return addCorsHeaders(await fetchHistory(env, profileRes.profileId), origin, env);
    }
    // POST /api/leads/batch-enrich — 일괄 심층 분석
    if (url.pathname === '/api/leads/batch-enrich' && request.method === 'POST') {
      return addCorsHeaders(await handleBatchEnrich(request, env), origin, env);
    }
    // POST /api/leads/:id/enrich — 단일 리드 심층 분석
    const enrichMatch = url.pathname.match(/^\/api\/leads\/([^/]+)\/enrich$/);
    if (enrichMatch && request.method === 'POST') {
      const leadId = decodeURIComponent(enrichMatch[1]);
      return addCorsHeaders(await handleEnrichLead(request, env, leadId), origin, env);
    }
    // PATCH /api/leads/:id — 리드 상태/메모 업데이트
    const leadPatchMatch = url.pathname.match(/^\/api\/leads\/([^/]+)$/);
    if (leadPatchMatch && request.method === 'PATCH') {
      const leadId = decodeURIComponent(leadPatchMatch[1]);
      return addCorsHeaders(await handleUpdateLead(request, env, leadId), origin, env);
    }
    if (url.pathname === '/api/dashboard' && request.method === 'GET') {
      return addCorsHeaders(await handleDashboard(request, env), origin, env);
    }
    if (url.pathname === '/api/export/csv' && request.method === 'GET') {
      return addCorsHeaders(await handleExportCSV(request, env), origin, env);
    }
    // Reference Library API
    if (url.pathname === '/api/references' && request.method === 'GET') {
      const authErr = await verifyAuth(request, env);
      if (authErr) return addCorsHeaders(authErr, origin, env);
      return addCorsHeaders(await handleGetReferences(env, url), origin, env);
    }
    if (url.pathname === '/api/references' && request.method === 'POST') {
      const authErr = await verifyAuth(request, env);
      if (authErr) return addCorsHeaders(authErr, origin, env);
      return addCorsHeaders(await handleAddReference(request, env), origin, env);
    }
    const refDeleteMatch = url.pathname.match(/^\/api\/references\/(\d+)$/);
    if (refDeleteMatch && request.method === 'DELETE') {
      const authErr = await verifyAuth(request, env);
      if (authErr) return addCorsHeaders(authErr, origin, env);
      return addCorsHeaders(await handleDeleteReference(env, Number(refDeleteMatch[1])), origin, env);
    }
    // PWA
    if (url.pathname === '/manifest.json') {
      return new Response(JSON.stringify(getPWAManifest(env)), {
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    }
    if (url.pathname === '/sw.js') {
      return new Response(getServiceWorkerJS(), {
        headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-cache' }
      });
    }

    // 페이지 라우팅
    // /leads/:id 상세 페이지 (API가 아닌 HTML 페이지)
    const leadDetailMatch = url.pathname.match(/^\/leads\/([^/]+)$/);
    if (leadDetailMatch && !url.pathname.startsWith('/api/')) {
      const leadId = decodeURIComponent(leadDetailMatch[1]);
      const authErr = await verifyAuth(request, env);
      if (authErr) return addCorsHeaders(authErr, origin, env);
      if (!env.DB) {
        return new Response('시스템 설정이 필요합니다. 관리자에게 문의하세요.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
      const lead = await getLeadById(env.DB, leadId);
      if (!lead) return new Response('리드를 찾을 수 없습니다.', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      const statusLogs = await getStatusLogByLead(env.DB, leadId);
      return new Response(getLeadDetailPage(lead, statusLogs), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    if (url.pathname === '/leads') {
      return new Response(getLeadsPage(), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    if (url.pathname === '/ppt') {
      return new Response(getPPTPage(), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    if (url.pathname === '/roleplay') {
      return new Response(getRoleplayPage(), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    if (url.pathname === '/history') {
      return new Response(getHistoryPage(), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    if (url.pathname === '/dashboard') {
      return new Response(getDashboardPage(env), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    return new Response(getMainPage(env), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
};
