import { verifyAuth } from '../lib/auth.js';
import { getLeadById, getStatusLogByLead } from '../db/leads.js';
import { getAuthRequiredPage } from '../pages/auth-required.js';
import { getCPAPage } from '../pages/cpa.js';
import { getDashboardPage } from '../pages/dashboard.js';
import { getHistoryPage } from '../pages/history.js';
import { getHomePage } from '../pages/home-page.js';
import { getLeadDetailPage } from '../pages/lead-detail.js';
import { getLeadsPage } from '../pages/leads.js';
import { getPPTPage } from '../pages/ppt.js';
import { getProposalPage } from '../pages/proposal.js';
import { getRoleplayPage } from '../pages/roleplay.js';
import { htmlResponse, isAllowedMethod, methodNotAllowedResponse, textResponse } from './responses.js';

function decodeParam(value) {
  return decodeURIComponent(value);
}

function exact(path) {
  return (pathname) => (pathname === path ? {} : null);
}

function pattern(regex, paramNames) {
  return (pathname) => {
    const match = pathname.match(regex);
    if (!match) return null;
    return Object.fromEntries(paramNames.map((name, index) => [name, decodeParam(match[index + 1])]));
  };
}

export const pageRoutes = Object.freeze([
  {
    id: 'page.leadDetail',
    methods: ['GET'],
    match: pattern(/^\/leads\/([^/]+)$/, ['leadId']),
    handle: async ({ request, env, params }) => {
      const authErr = await verifyAuth(request, env);
      if (authErr) {
        const code = authErr.status || 401;
        return htmlResponse(getAuthRequiredPage(code), code);
      }
      if (!env.DB) {
        return textResponse('시스템 설정이 필요합니다. 관리자에게 문의하세요.', 503);
      }
      const lead = await getLeadById(env.DB, params.leadId);
      if (!lead) return textResponse('리드를 찾을 수 없습니다.', 404);
      const statusLogs = await getStatusLogByLead(env.DB, params.leadId);
      return htmlResponse(getLeadDetailPage(lead, statusLogs));
    }
  },
  {
    id: 'page.leads',
    methods: ['GET'],
    match: exact('/leads'),
    handle: () => htmlResponse(getLeadsPage())
  },
  {
    id: 'page.ppt',
    methods: ['GET'],
    match: exact('/ppt'),
    handle: () => htmlResponse(getPPTPage())
  },
  {
    id: 'page.roleplay',
    methods: ['GET'],
    match: exact('/roleplay'),
    handle: () => htmlResponse(getRoleplayPage())
  },
  {
    id: 'page.history',
    methods: ['GET'],
    match: exact('/history'),
    handle: () => htmlResponse(getHistoryPage())
  },
  {
    id: 'page.dashboard',
    methods: ['GET'],
    match: exact('/dashboard'),
    handle: ({ env }) => htmlResponse(getDashboardPage(env))
  },
  {
    id: 'page.proposal',
    methods: ['GET'],
    match: exact('/proposal'),
    handle: () => htmlResponse(getProposalPage())
  },
  {
    id: 'page.cpa',
    methods: ['GET'],
    match: exact('/cpa'),
    handle: () => htmlResponse(getCPAPage())
  },
  {
    id: 'page.homeFallback',
    methods: ['GET'],
    match: (pathname) => (pathname === '/api' || pathname.startsWith('/api/') || pathname === '/trigger' ? null : {}),
    handle: ({ env }) => htmlResponse(getHomePage(env))
  }
]);

export function matchPageRoute(pathname) {
  for (const route of pageRoutes) {
    const params = route.match(pathname);
    if (params) return { route, params };
  }
  return null;
}

export async function handlePageRoute(request, env) {
  const url = new URL(request.url);
  const matched = matchPageRoute(url.pathname);
  if (!matched) return null;

  if (!isAllowedMethod(request.method, matched.route.methods)) {
    return methodNotAllowedResponse(matched.route.methods, { json: false });
  }

  return matched.route.handle({ request, env, url, params: matched.params });
}
