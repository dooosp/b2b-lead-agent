export const AUTH_PROVIDER_SESSION_SCAFFOLD_APPROVAL_RECORD =
  'https://github.com/dooosp/b2b-lead-agent/issues/162#issuecomment-4525315986';

export const AUTH_PROVIDER_SESSION_SCAFFOLD_NON_PRODUCTION_ENV =
  'AUTH_PROVIDER_SESSION_SCAFFOLD_NON_PRODUCTION';

export const AUTH_PROVIDER_SESSION_SCAFFOLD_PROVIDER_ENV =
  'AUTH_PROVIDER_SESSION_SCAFFOLD_PROVIDER';

export const AUTH_PROVIDER_SESSION_SCAFFOLD_MODE =
  'auth_provider_session_scaffold_non_production';

const ENABLED_VALUES = new Set(['1', 'true', 'enabled', 'local_test', 'local-test', 'non_production']);
const PRODUCTION_VALUES = new Set(['production', 'prod']);
const ROLE_REVIEWER = 'reviewer';
const ROLE_MANAGER = 'manager';
const ROLE_ADMIN = 'admin';
const ROLE_API_CLIENT = 'api_client';

const ROLE_ALIASES = new Map([
  [ROLE_REVIEWER, ROLE_REVIEWER],
  [ROLE_MANAGER, ROLE_MANAGER],
  [ROLE_ADMIN, ROLE_ADMIN],
  [ROLE_API_CLIENT, ROLE_API_CLIENT],
  ['api-client', ROLE_API_CLIENT],
  ['api client', ROLE_API_CLIENT],
  ['api', ROLE_API_CLIENT],
]);

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function isEnabledValue(value) {
  return ENABLED_VALUES.has(normalizeText(value));
}

function isProductionLikeEnv(env = {}) {
  return ['WORKER_ENV', 'DEPLOYMENT_ENV', 'APP_ENV', 'ENVIRONMENT', 'CF_ENV']
    .some((key) => PRODUCTION_VALUES.has(normalizeText(env[key])));
}

export function isAuthProviderSessionScaffoldRequested(env = {}) {
  return isEnabledValue(env[AUTH_PROVIDER_SESSION_SCAFFOLD_NON_PRODUCTION_ENV]);
}

export function resolveAuthProviderSessionRole(value) {
  const rawRole = normalizeText(value).replace(/\s+/g, ' ');
  if (!rawRole) {
    return { role: 'none', roleStatus: 'missing' };
  }
  const role = ROLE_ALIASES.get(rawRole);
  if (!role) {
    return { role: 'none', roleStatus: 'unknown' };
  }
  return { role, roleStatus: 'recognized' };
}

function scaffoldAccess({
  role = 'none',
  roleStatus = 'missing',
  authenticated = false,
  providerStatus = 'resolved',
} = {}) {
  const canUseManualNotes = authenticated === true && role === ROLE_REVIEWER;
  return {
    enabled: true,
    mode: AUTH_PROVIDER_SESSION_SCAFFOLD_MODE,
    approvalRecord: AUTH_PROVIDER_SESSION_SCAFFOLD_APPROVAL_RECORD,
    providerModel: 'cloudflare_access_zero_trust_planning_only',
    sessionModel: 'cloudflare_access_managed_session_planning_only',
    roleSource: 'cloudflare_access_groups_policies_planning_only',
    role,
    roleStatus,
    authenticated: authenticated === true,
    providerStatus,
    manualNotesRead: canUseManualNotes,
    manualNotesWrite: canUseManualNotes,
    metadataHistorySummaryRead: canUseManualNotes,
    realAuthImplemented: false,
    productionReady: false,
    denialMessage: 'Manual review notes are restricted by the non-production auth provider/session scaffold. Role "reviewer" is required; no real auth/session/provider is implemented.',
  };
}

async function resolveProviderSession(provider, context) {
  if (!provider) {
    return { session: null, providerStatus: 'missing_provider' };
  }
  try {
    if (typeof provider === 'function') {
      return { session: await provider(context), providerStatus: 'resolved' };
    }
    if (typeof provider.resolveSession === 'function') {
      return { session: await provider.resolveSession(context), providerStatus: 'resolved' };
    }
    if (Object.prototype.hasOwnProperty.call(provider, 'session')) {
      return { session: provider.session, providerStatus: 'resolved' };
    }
    return { session: null, providerStatus: 'missing_provider' };
  } catch {
    return { session: null, providerStatus: 'provider_error' };
  }
}

export function authProviderSessionScaffoldMetadata(access = {}) {
  if (access.mode !== AUTH_PROVIDER_SESSION_SCAFFOLD_MODE) return undefined;
  return {
    mode: AUTH_PROVIDER_SESSION_SCAFFOLD_MODE,
    approvalRecord: AUTH_PROVIDER_SESSION_SCAFFOLD_APPROVAL_RECORD,
    providerModel: access.providerModel,
    sessionModel: access.sessionModel,
    roleSource: access.roleSource,
    role: access.role || 'none',
    roleStatus: access.roleStatus || 'missing',
    authenticated: access.authenticated === true,
    providerStatus: access.providerStatus || 'resolved',
    manualNotesRead: access.manualNotesRead === true,
    manualNotesWrite: access.manualNotesWrite === true,
    metadataHistorySummaryRead: access.metadataHistorySummaryRead === true,
    realAuthImplemented: false,
    productionReady: false,
  };
}

export async function resolveAuthProviderSessionScaffold(request, env = {}) {
  if (!isAuthProviderSessionScaffoldRequested(env)) {
    return { enabled: false };
  }

  if (isProductionLikeEnv(env)) {
    return scaffoldAccess({
      role: 'none',
      roleStatus: 'blocked_production_like_environment',
      authenticated: false,
      providerStatus: 'blocked',
    });
  }

  const provider = env[AUTH_PROVIDER_SESSION_SCAFFOLD_PROVIDER_ENV];
  const { session, providerStatus } = await resolveProviderSession(provider, { request, env });
  if (!session || providerStatus !== 'resolved') {
    return scaffoldAccess({ providerStatus });
  }

  const { role, roleStatus } = resolveAuthProviderSessionRole(session.role);
  return scaffoldAccess({
    role,
    roleStatus,
    authenticated: session.authenticated === true,
    providerStatus,
  });
}

export function createStaticAuthProviderSessionScaffoldProvider({ role, authenticated = true } = {}) {
  return {
    async resolveSession() {
      return { role, authenticated };
    },
  };
}
