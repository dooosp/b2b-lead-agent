export const LOCAL_TEST_AUTH_ADAPTER_CONTRACT_VERSION = 'level1.local_test_auth_adapter.v1';

export const LOCAL_TEST_AUTH_ADAPTER_CONTRACT = Object.freeze({
  version: LOCAL_TEST_AUTH_ADAPTER_CONTRACT_VERSION,
  boundary: 'local_test_only',
  sessionSource: 'injected_adapter_only',
  realProviderParsing: false,
  realTokenParsing: false,
  realCookieParsing: false,
  realJwtParsing: false,
  productionReady: false,
});

const DEFAULT_EXPECTED_AUDIENCE = 'b2b-lead-agent-level1-local-proof';
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
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function normalizeLocalTestAuthAdapterRole(value) {
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

function resolveClaimStatus(session, { expectedAudience = DEFAULT_EXPECTED_AUDIENCE, now = new Date() } = {}) {
  if (!session || typeof session !== 'object') return 'missing_session';
  if (session.expired === true || session.claimStatus === 'expired') return 'expired';

  if (session.expiresAt) {
    const expiresAt = new Date(session.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) return 'expired';
    if (expiresAt.getTime() <= now.getTime()) return 'expired';
  }

  if (!session.audience) return 'missing_audience';
  if (typeof session.audience !== 'string') return 'wrong_audience';
  if (String(session.audience) !== expectedAudience) return 'wrong_audience';

  return 'valid';
}

function claimsFor({
  adapterStatus = 'missing_adapter',
  session = null,
  expectedAudience = DEFAULT_EXPECTED_AUDIENCE,
  now = new Date(),
} = {}) {
  if (adapterStatus !== 'resolved' || !session || typeof session !== 'object') {
    return {
      contractVersion: LOCAL_TEST_AUTH_ADAPTER_CONTRACT_VERSION,
      adapterStatus,
      role: 'none',
      roleStatus: 'missing',
      authenticated: false,
      claimStatus: adapterStatus === 'provider_error' ? 'provider_error' : 'missing_session',
      expectedAudience,
      realAuthImplemented: false,
      productionReady: false,
    };
  }

  const claimStatus = resolveClaimStatus(session, { expectedAudience, now });
  const { role, roleStatus } = normalizeLocalTestAuthAdapterRole(session.role);
  return {
    contractVersion: LOCAL_TEST_AUTH_ADAPTER_CONTRACT_VERSION,
    adapterStatus,
    role,
    roleStatus,
    authenticated: session.authenticated === true && claimStatus === 'valid',
    claimStatus,
    expectedAudience,
    realAuthImplemented: false,
    productionReady: false,
  };
}

async function resolveAdapterSession(adapter, context) {
  if (!adapter) {
    return { adapterStatus: 'missing_adapter', session: null };
  }
  try {
    if (typeof adapter === 'function') {
      return { adapterStatus: 'resolved', session: await adapter(context) };
    }
    if (typeof adapter.resolveSession === 'function') {
      return { adapterStatus: 'resolved', session: await adapter.resolveSession(context) };
    }
    if (Object.prototype.hasOwnProperty.call(adapter, 'session')) {
      return { adapterStatus: 'resolved', session: adapter.session };
    }
    return { adapterStatus: 'missing_adapter', session: null };
  } catch {
    return { adapterStatus: 'provider_error', session: null };
  }
}

export async function resolveLocalTestAuthAdapter({
  adapter,
  request,
  env = {},
  expectedAudience = DEFAULT_EXPECTED_AUDIENCE,
  now = new Date(),
} = {}) {
  const { adapterStatus, session } = await resolveAdapterSession(adapter, {
    request,
    env,
    contract: LOCAL_TEST_AUTH_ADAPTER_CONTRACT,
  });
  return {
    adapterStatus,
    claims: claimsFor({ adapterStatus, session, expectedAudience, now }),
  };
}

export function createStaticLocalTestAuthAdapter({
  role,
  authenticated = true,
  audience = DEFAULT_EXPECTED_AUDIENCE,
  expiresAt,
  expired,
  claimStatus,
} = {}) {
  return {
    async resolveSession() {
      return {
        role,
        authenticated,
        audience,
        expiresAt,
        expired,
        claimStatus,
      };
    },
  };
}
