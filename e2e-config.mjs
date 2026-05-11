const DEFAULT_LOCAL_BASE_URL = 'http://127.0.0.1:8787';
const PRODUCTION_E2E_APPROVAL_VALUES = new Set(['1', 'true', 'yes']);

export function normalizeBaseUrl(value) {
  const rawValue = String(value || '').trim();
  if (!rawValue) {
    throw new Error('E2E_BASE_URL must be a non-empty URL.');
  }

  let parsed;
  try {
    parsed = new URL(rawValue);
  } catch {
    throw new Error(`E2E_BASE_URL must be a valid URL: ${rawValue}`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('E2E_BASE_URL must use http or https.');
  }

  parsed.hash = '';
  parsed.search = '';
  return parsed.toString().replace(/\/$/, '');
}

export function isProductionWorkerUrl(value) {
  const parsed = new URL(normalizeBaseUrl(value));
  return parsed.hostname.toLowerCase().endsWith('.workers.dev');
}

export function hasProductionE2EApproval(env = process.env) {
  const value = String(env.ALLOW_PRODUCTION_E2E || '').trim().toLowerCase();
  return PRODUCTION_E2E_APPROVAL_VALUES.has(value);
}

export function resolveE2EConfig(env = process.env) {
  const baseUrl = normalizeBaseUrl(env.E2E_BASE_URL || DEFAULT_LOCAL_BASE_URL);
  const token = env.B2B_TOKEN || env.API_TOKEN || env.TRIGGER_PASSWORD || '';
  const allowProduction = hasProductionE2EApproval(env);

  if (isProductionWorkerUrl(baseUrl) && !allowProduction) {
    throw new Error(
      'Refusing to run E2E against a workers.dev URL without explicit ALLOW_PRODUCTION_E2E approval. ' +
      'Set E2E_BASE_URL to a local or staging URL for normal validation.'
    );
  }

  return { baseUrl, token, allowProduction };
}
