import { addCorsHeaders } from '../lib/cors.js';
import { checkRateLimit, verifyAuth, verifyInternalApiAuth } from '../lib/auth.js';
import { resolveLeadProfileForQuery } from '../lib/profile.js';
import { jsonResponse } from '../lib/utils.js';
import { calculateCPA } from '../api/cpa.js';
import { handleDashboard } from '../api/dashboard.js';
import { handleBatchEnrich, handleEnrichLead } from '../api/enrichment.js';
import { handleGetLatestPublishedReport } from '../api/internal-reports.js';
import { handleGetJob, handleJobEvent } from '../api/jobs.js';
import {
  fetchLeads as fetchLeadCollection,
  fetchHistory as fetchLeadHistory,
  handleExportCSV as handleLeadCsvExport,
  handleUpdateLead as handleLeadUpdate
} from '../api/leads.js';
import { generatePPT } from '../api/ppt.js';
import { generateProposal } from '../api/proposal.js';
import {
  handleAddReference as createReference,
  handleDeleteReference as removeReference,
  handleGetReferences as listReferences
} from '../api/references.js';
import { handleRoleplay } from '../api/roleplay.js';
import { handleTrigger } from '../api/trigger.js';
import { checkSelfServiceRateLimit } from '../self-service/rate-limit.js';
import { handleSelfServiceAnalyze } from '../self-service/orchestrator.js';
import { isAllowedMethod, jsonNotFoundResponse, methodNotAllowedResponse } from './responses.js';

const AUTH = Object.freeze({
  NONE: 'none',
  API: 'api',
  INTERNAL: 'internal',
  SELF_SERVICE: 'self-service'
});

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

function resolveProfileOrResponse(url, env) {
  const profileRes = resolveLeadProfileForQuery(url.searchParams.get('profile'), env);
  if (!profileRes.ok) {
    return {
      response: jsonResponse({ success: false, message: profileRes.message }, 400)
    };
  }
  return { profileId: profileRes.profileId };
}

export const apiRoutes = Object.freeze([
  {
    id: 'api.selfServiceAnalyze',
    methods: ['POST'],
    auth: AUTH.SELF_SERVICE,
    cors: true,
    match: exact('/api/analyze'),
    handle: async ({ request, env, ctx }) => {
      const rlErr = await checkSelfServiceRateLimit(request, env);
      if (rlErr) return rlErr;
      return handleSelfServiceAnalyze(request, env, ctx);
    }
  },
  {
    id: 'job.trigger',
    methods: ['POST'],
    auth: AUTH.NONE,
    cors: false,
    match: exact('/trigger'),
    handle: async ({ request, env }) => {
      const rlErr = await checkRateLimit(request, env);
      if (rlErr) return rlErr;
      return handleTrigger(request, env);
    }
  },
  {
    id: 'api.jobStatus',
    methods: ['GET'],
    auth: AUTH.API,
    cors: true,
    match: pattern(/^\/api\/jobs\/([^/]+)$/, ['requestId']),
    handle: ({ env, params }) => handleGetJob(params.requestId, env)
  },
  {
    id: 'job.event',
    methods: ['POST'],
    auth: AUTH.NONE,
    cors: true,
    match: pattern(/^\/api\/jobs\/([^/]+)\/events$/, ['requestId']),
    handle: ({ request, env, params }) => handleJobEvent(request, env, params.requestId)
  },
  {
    id: 'api.leads.list',
    methods: ['GET'],
    auth: AUTH.API,
    cors: true,
    match: exact('/api/leads'),
    handle: async ({ env, url }) => {
      const profile = resolveProfileOrResponse(url, env);
      if (profile.response) return profile.response;
      return fetchLeadCollection(env, profile.profileId);
    }
  },
  {
    id: 'api.ppt',
    methods: ['POST'],
    auth: AUTH.API,
    cors: true,
    match: exact('/api/ppt'),
    handle: ({ request, env }) => generatePPT(request, env)
  },
  {
    id: 'api.proposal',
    methods: ['POST'],
    auth: AUTH.API,
    cors: true,
    match: exact('/api/proposal'),
    handle: ({ request, env }) => generateProposal(request, env)
  },
  {
    id: 'api.cpa',
    methods: ['POST'],
    auth: AUTH.API,
    cors: true,
    match: exact('/api/cpa'),
    handle: ({ request }) => calculateCPA(request)
  },
  {
    id: 'api.roleplay',
    methods: ['POST'],
    auth: AUTH.API,
    cors: true,
    match: exact('/api/roleplay'),
    handle: ({ request, env }) => handleRoleplay(request, env)
  },
  {
    id: 'api.history',
    methods: ['GET'],
    auth: AUTH.API,
    cors: true,
    match: exact('/api/history'),
    handle: async ({ env, url }) => {
      const profile = resolveProfileOrResponse(url, env);
      if (profile.response) return profile.response;
      return fetchLeadHistory(env, profile.profileId);
    }
  },
  {
    id: 'api.internalLatestPublished',
    methods: ['GET'],
    auth: AUTH.INTERNAL,
    cors: true,
    match: pattern(/^\/api\/internal\/profiles\/([^/]+)\/latest-published$/, ['profileId']),
    handle: ({ env, params }) => handleGetLatestPublishedReport(env, params.profileId)
  },
  {
    id: 'api.leads.batchEnrich',
    methods: ['POST'],
    auth: AUTH.API,
    cors: true,
    match: exact('/api/leads/batch-enrich'),
    handle: ({ request, env }) => handleBatchEnrich(request, env)
  },
  {
    id: 'api.leads.enrich',
    methods: ['POST'],
    auth: AUTH.API,
    cors: true,
    match: pattern(/^\/api\/leads\/([^/]+)\/enrich$/, ['leadId']),
    handle: ({ request, env, params }) => handleEnrichLead(request, env, params.leadId)
  },
  {
    id: 'api.leads.patch',
    methods: ['PATCH'],
    auth: AUTH.API,
    cors: true,
    match: pattern(/^\/api\/leads\/([^/]+)$/, ['leadId']),
    handle: ({ request, env, params }) => handleLeadUpdate(request, env, params.leadId)
  },
  {
    id: 'api.dashboard',
    methods: ['GET'],
    auth: AUTH.API,
    cors: true,
    match: exact('/api/dashboard'),
    handle: ({ request, env }) => handleDashboard(request, env)
  },
  {
    id: 'api.exportCsv',
    methods: ['GET'],
    auth: AUTH.API,
    cors: true,
    match: exact('/api/export/csv'),
    handle: ({ request, env }) => handleLeadCsvExport(request, env)
  },
  {
    id: 'api.references.list',
    methods: ['GET'],
    auth: AUTH.API,
    cors: true,
    match: exact('/api/references'),
    handle: ({ env, url }) => listReferences(env, url)
  },
  {
    id: 'api.references.create',
    methods: ['POST'],
    auth: AUTH.API,
    cors: true,
    match: exact('/api/references'),
    handle: ({ request, env }) => createReference(request, env)
  },
  {
    id: 'api.references.delete',
    methods: ['DELETE'],
    auth: AUTH.API,
    cors: true,
    match: pattern(/^\/api\/references\/(\d+)$/, ['refId']),
    handle: ({ env, params }) => removeReference(env, Number(params.refId))
  }
]);

function apiRouteMatches(pathname) {
  const matches = [];
  for (const route of apiRoutes) {
    const params = route.match(pathname);
    if (params) matches.push({ route, params });
  }
  return matches;
}

export function matchApiRoute(pathname, method = '') {
  const matches = apiRouteMatches(pathname);
  if (matches.length === 0) return null;
  if (method) {
    return matches.find((match) => isAllowedMethod(method, match.route.methods)) || matches[0];
  }
  return matches[0];
}

function allowedMethodsFor(matches) {
  return [...new Set(matches.flatMap((match) => match.route.methods))];
}

async function authorize(route, request, env) {
  if (route.auth === AUTH.API) return verifyAuth(request, env);
  if (route.auth === AUTH.INTERNAL) return verifyInternalApiAuth(request, env);
  if (route.auth === AUTH.SELF_SERVICE) {
    const requiresSelfServiceAuth = String(env.REQUIRE_SELF_SERVICE_AUTH ?? 'true').toLowerCase() !== 'false';
    return requiresSelfServiceAuth ? verifyAuth(request, env) : null;
  }
  return null;
}

function withRouteCors(response, route, origin, env) {
  return route.cors === false ? response : addCorsHeaders(response, origin, env);
}

function withBoundaryCors(response, matches, origin, env) {
  return matches.some((match) => match.route.cors !== false)
    ? addCorsHeaders(response, origin, env)
    : response;
}

function isKnownProtectedApiBoundary(pathname) {
  return [
    '/api/leads',
    '/api/leads/',
    '/api/references',
    '/api/references/',
    '/api/ppt',
    '/api/proposal',
    '/api/cpa',
    '/api/roleplay',
    '/api/history',
    '/api/dashboard',
    '/api/export/csv'
  ].some((prefix) => pathname === prefix || (prefix.endsWith('/') && pathname.startsWith(prefix)));
}

async function authorizeUnknownApiBoundary(pathname, request, env) {
  if (pathname.startsWith('/api/internal/')) {
    return verifyInternalApiAuth(request, env);
  }
  if (isKnownProtectedApiBoundary(pathname)) {
    return verifyAuth(request, env);
  }
  return null;
}

export async function handleApiRoute(request, env, ctx) {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  const matches = apiRouteMatches(url.pathname);

  if (matches.length > 0) {
    const methodMatch = matches.find((match) => isAllowedMethod(request.method, match.route.methods));
    if (!methodMatch) {
      return withBoundaryCors(methodNotAllowedResponse(allowedMethodsFor(matches)), matches, origin, env);
    }

    const authErr = await authorize(methodMatch.route, request, env);
    if (authErr) return withRouteCors(authErr, methodMatch.route, origin, env);

    const response = await methodMatch.route.handle({
      request,
      env,
      ctx,
      url,
      params: methodMatch.params
    });
    return withRouteCors(response, methodMatch.route, origin, env);
  }

  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
    const authErr = await authorizeUnknownApiBoundary(url.pathname, request, env);
    if (authErr) return addCorsHeaders(authErr, origin, env);
    return addCorsHeaders(jsonNotFoundResponse(), origin, env);
  }

  return null;
}
