import {
  createStaticLocalTestAuthAdapter,
  normalizeLocalTestAuthAdapterRole,
  resolveLocalTestAuthAdapter,
} from './local-test-auth-adapter.js';

export const AUTH_PROVIDER_SESSION_SCAFFOLD_APPROVAL_RECORD =
  'https://github.com/dooosp/b2b-lead-agent/issues/162#issuecomment-4525315986';

export const AUTH_PROVIDER_SESSION_SCAFFOLD_NON_PRODUCTION_ENV =
  'AUTH_PROVIDER_SESSION_SCAFFOLD_NON_PRODUCTION';

export const AUTH_PROVIDER_SESSION_SCAFFOLD_PROVIDER_ENV =
  'AUTH_PROVIDER_SESSION_SCAFFOLD_PROVIDER';

export const AUTH_PROVIDER_SESSION_SCAFFOLD_MODE =
  'auth_provider_session_scaffold_non_production';

export const AUTH_PROVIDER_SESSION_SCAFFOLD_EXPECTED_AUDIENCE =
  'b2b-lead-agent-level1-local-proof';

const ENABLED_VALUES = new Set(['1', 'true', 'enabled', 'local_test', 'local-test', 'non_production']);
const NON_LOCAL_VALUES = new Set(['production', 'prod', 'staging', 'stage', 'preview', 'live']);
const ROLE_REVIEWER = 'reviewer';
function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function isEnabledValue(value) {
  return ENABLED_VALUES.has(normalizeText(value));
}

function isProductionLikeEnv(env = {}) {
  return [
    'WORKER_ENV',
    'DEPLOYMENT_ENV',
    'APP_ENV',
    'ENVIRONMENT',
    'CF_ENV',
    'NODE_ENV',
    'WRANGLER_ENV',
    'CLOUDFLARE_ENV',
  ]
    .some((key) => NON_LOCAL_VALUES.has(normalizeText(env[key])));
}

export function isAuthProviderSessionScaffoldRequested(env = {}) {
  return isEnabledValue(env[AUTH_PROVIDER_SESSION_SCAFFOLD_NON_PRODUCTION_ENV]);
}

export function resolveAuthProviderSessionRole(value) {
  return normalizeLocalTestAuthAdapterRole(value);
}

function scaffoldAccess({
  role = 'none',
  roleStatus = 'missing',
  authenticated = false,
  providerStatus = 'resolved',
  claimStatus = 'missing_session',
} = {}) {
  const canUseManualNotes = authenticated === true && claimStatus === 'valid' && role === ROLE_REVIEWER;
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
    claimStatus,
    expectedAudience: AUTH_PROVIDER_SESSION_SCAFFOLD_EXPECTED_AUDIENCE,
    manualNotesRead: canUseManualNotes,
    manualNotesWrite: canUseManualNotes,
    metadataHistorySummaryRead: canUseManualNotes,
    realAuthImplemented: false,
    productionReady: false,
    denialMessage: 'Manual review notes are restricted by the non-production auth provider/session scaffold. Role "reviewer" is required; no real auth/session/provider is implemented.',
  };
}

export function authProviderSessionScaffoldMetadata(access = {}) {
  if (access.mode !== AUTH_PROVIDER_SESSION_SCAFFOLD_MODE) return undefined;
  const metadata = {
    mode: AUTH_PROVIDER_SESSION_SCAFFOLD_MODE,
    approvalRecord: AUTH_PROVIDER_SESSION_SCAFFOLD_APPROVAL_RECORD,
    providerModel: access.providerModel,
    sessionModel: access.sessionModel,
    roleSource: access.roleSource,
    role: access.role || 'none',
    roleStatus: access.roleStatus || 'missing',
    authenticated: access.authenticated === true,
    providerStatus: access.providerStatus || 'resolved',
    claimStatus: access.claimStatus || 'missing_session',
    expectedAudience: AUTH_PROVIDER_SESSION_SCAFFOLD_EXPECTED_AUDIENCE,
    manualNotesRead: access.manualNotesRead === true,
    manualNotesWrite: access.manualNotesWrite === true,
    metadataHistorySummaryRead: access.metadataHistorySummaryRead === true,
    realAuthImplemented: false,
    productionReady: false,
  };
  if (access.stopWrites) {
    metadata.stopWrites = true;
    metadata.rollbackGuard = access.rollbackGuard;
  }
  return metadata;
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
      claimStatus: 'blocked_production_like_environment',
    });
  }

  const adapter = env[AUTH_PROVIDER_SESSION_SCAFFOLD_PROVIDER_ENV];
  const { adapterStatus, claims } = await resolveLocalTestAuthAdapter({
    adapter,
    request,
    env,
    expectedAudience: AUTH_PROVIDER_SESSION_SCAFFOLD_EXPECTED_AUDIENCE,
  });
  const providerStatus = adapterStatus === 'missing_adapter' ? 'missing_provider' : adapterStatus;
  if (adapterStatus !== 'resolved' || claims.claimStatus === 'missing_session') {
    return scaffoldAccess({
      providerStatus,
      claimStatus: providerStatus === 'provider_error' ? 'provider_error' : 'missing_session',
    });
  }

  return scaffoldAccess({
    role: claims.role,
    roleStatus: claims.roleStatus,
    authenticated: claims.authenticated,
    providerStatus,
    claimStatus: claims.claimStatus,
  });
}

export function createStaticAuthProviderSessionScaffoldProvider({
  role,
  authenticated = true,
  audience = AUTH_PROVIDER_SESSION_SCAFFOLD_EXPECTED_AUDIENCE,
  expiresAt,
  expired,
  claimStatus,
} = {}) {
  return createStaticLocalTestAuthAdapter({
    role,
    authenticated,
    audience,
    expiresAt,
    expired,
    claimStatus,
  });
}
