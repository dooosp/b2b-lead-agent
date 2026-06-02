const net = require('node:net');
const axios = require('axios');

const OUTBOUND_HTTP_ENRICHMENT_BOUNDARY_STATUS =
  'OUTBOUND_HTTP_ENRICHMENT_BOUNDARY_GUARDS_NON_PRODUCTION';
const ENRICHMENT_HTTP_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const DEFAULT_ENRICHMENT_HTTP_POLICY = Object.freeze({
  allowedSchemes: Object.freeze(['http', 'https']),
  timeoutMs: 8000,
  maxRedirects: 3,
  maxBytes: 512 * 1024,
});

const REDACTED = '[REDACTED]';
const REDACTED_URL = '[REDACTED:URL]';
const REDACTED_PRIVATE_URL = '[REDACTED:PRIVATE_URL]';

const SAFE_HEADER_NAMES = new Set(['user-agent', 'accept']);
const PROTECTED_HEADER_RE = /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|api-key|x-auth-token)$/i;
const SENSITIVE_KEY_RE =
  /(authorization|proxyauthorization|cookie|setcookie|token|secret|api[_-]?key|password|credential|headers?|url|uri|href|snippet|payload|body|data|error|message|stack|config|request|response|customer|email)/i;
const QUERY_SECRET_RE = /([?&](?:token|api_key|apikey|key|secret|password|auth|session)=)[^&#\s]+/gi;
const AUTH_HEADER_LINE_RE = /\b(?:Authorization|Proxy-Authorization|Cookie|Set-Cookie)\s*:\s*[^\r\n]+/gi;
const BEARER_RE = /\bBearer\s+[A-Za-z0-9._~+/-]+={0,2}/gi;
const API_KEY_TEXT_RE = /\b(?:token|api[_-]?key|secret|password|session)\s*[:=]\s*[^\s"'&<>]+/gi;
const BEARER_VALUE_RE = /\bBearer\s+[A-Za-z0-9._~+/-]+={0,2}/i;
const API_KEY_VALUE_RE = /\b(?:token|api[_-]?key|secret|password|session)\s*[:=]\s*[^\s"'&<>]+/i;
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PRIVATE_CUSTOMER_RE = /\b[A-Z0-9_]*PRIVATE_CUSTOMER[A-Z0-9_]*\b/g;
const URL_RE = /\bhttps?:\/\/[^\s"'<>]+/gi;

function normalizePolicy(options = {}) {
  const timeoutMs = Number.isFinite(options.timeout)
    ? options.timeout
    : Number.isFinite(options.timeoutMs)
      ? options.timeoutMs
      : DEFAULT_ENRICHMENT_HTTP_POLICY.timeoutMs;
  const maxRedirects = Number.isFinite(options.maxRedirects)
    ? options.maxRedirects
    : DEFAULT_ENRICHMENT_HTTP_POLICY.maxRedirects;
  const maxBytes = Number.isFinite(options.maxBytes)
    ? options.maxBytes
    : DEFAULT_ENRICHMENT_HTTP_POLICY.maxBytes;

  return {
    allowedSchemes: DEFAULT_ENRICHMENT_HTTP_POLICY.allowedSchemes,
    timeoutMs,
    maxRedirects,
    maxBytes,
  };
}

function buildFailure(code, detail = {}) {
  return {
    ok: false,
    error: {
      code,
      ...redactEnrichmentHttpEvidence(detail),
    },
  };
}

function normalizeHostname(hostname) {
  return String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .replace(/\.$/, '');
}

function isPrivateIpv4(hostname) {
  const parts = hostname.split('.').map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function isBlockedIpv6(hostname) {
  const host = hostname.toLowerCase();
  return (
    host === '::1' ||
    host.startsWith('fc') ||
    host.startsWith('fd') ||
    host.startsWith('fe80:')
  );
}

function isBlockedHostname(hostname) {
  const host = normalizeHostname(hostname);
  if (!host) return true;
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host === 'metadata.google.internal') return true;
  if (host === 'b2b-lead-trigger.example.com') return true;
  if (host.endsWith('.workers.dev') || host.endsWith('.pages.dev')) return true;
  if (host.endsWith('.local') || host.endsWith('.lan') || host.endsWith('.corp')) return true;
  if (host.split('.').includes('internal')) return true;

  const ipType = net.isIP(host);
  if (ipType === 4) return isPrivateIpv4(host);
  if (ipType === 6) return isBlockedIpv6(host);

  return false;
}

function validateEnrichmentRequestUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(String(rawUrl || ''));
  } catch {
    return { ok: false, reason: 'invalid_url' };
  }

  const scheme = parsed.protocol.replace(/:$/, '').toLowerCase();
  if (!DEFAULT_ENRICHMENT_HTTP_POLICY.allowedSchemes.includes(scheme)) {
    return { ok: false, reason: 'scheme_not_allowed', scheme };
  }

  if (isBlockedHostname(parsed.hostname)) {
    return { ok: false, reason: 'blocked_host' };
  }

  return { ok: true, url: parsed.toString(), hostname: normalizeHostname(parsed.hostname) };
}

function headerValueLooksSensitive(value) {
  return (
    BEARER_VALUE_RE.test(String(value || '')) ||
    API_KEY_VALUE_RE.test(String(value || '')) ||
    /cookie|set-cookie/i.test(String(value || ''))
  );
}

function buildRequestHeaders(headers = {}) {
  return {
    'User-Agent': ENRICHMENT_HTTP_USER_AGENT,
    ...headers,
  };
}

function validateOutboundHeaders(headers = {}) {
  for (const [name, value] of Object.entries(headers)) {
    const normalizedName = String(name || '').toLowerCase();
    if (PROTECTED_HEADER_RE.test(normalizedName)) {
      return { ok: false, reason: 'protected_header_refused', header: name };
    }
    if (!SAFE_HEADER_NAMES.has(normalizedName)) {
      return { ok: false, reason: 'unsupported_header_refused', header: name };
    }
    if (headerValueLooksSensitive(value)) {
      return { ok: false, reason: 'sensitive_header_value_refused', header: name };
    }
  }
  return { ok: true };
}

function createAxiosEnrichmentTransport(axiosClient = axios) {
  return (url, config) => axiosClient.get(url, config);
}

function resolveTransport(transport) {
  if (!transport) return createAxiosEnrichmentTransport();
  if (typeof transport === 'function') return transport;
  if (typeof transport.get === 'function') return (url, config) => transport.get(url, config);
  throw new Error('enrichment transport must be a function or an object with get()');
}

function extractFinalUrl(response) {
  return (
    response?.request?.res?.responseUrl ||
    response?.request?.responseURL ||
    response?.responseUrl ||
    response?.config?.url ||
    ''
  );
}

function buildRedirectUrlFromOptions(redirectOptions = {}) {
  if (redirectOptions.href) return String(redirectOptions.href);
  const protocol = redirectOptions.protocol || 'https:';
  const hostname = redirectOptions.hostname || redirectOptions.host || '';
  if (!hostname) return '';
  const port = redirectOptions.port ? `:${redirectOptions.port}` : '';
  const path = redirectOptions.path || redirectOptions.pathname || '/';
  try {
    return new URL(path, `${protocol}//${hostname}${port}`).toString();
  } catch {
    return '';
  }
}

function assertSafeRedirectTarget(redirectOptions) {
  const redirectUrl = buildRedirectUrlFromOptions(redirectOptions);
  const redirectPolicy = validateEnrichmentRequestUrl(redirectUrl);
  if (redirectPolicy.ok) return;

  const error = new Error('unsafe enrichment redirect target');
  error.code = 'ENRICHMENT_UNSAFE_REDIRECT_TARGET';
  error.enrichmentHttpFailureCode = 'unsafe_redirect_target';
  error.enrichmentHttpFailureReason = redirectPolicy.reason || 'invalid_redirect_target';
  throw error;
}

function responseBodyToText(data) {
  if (data == null) return '';
  if (Buffer.isBuffer(data)) return data.toString('utf8');
  if (typeof data === 'string') return data;
  return String(data);
}

function normalizeTransportError(error) {
  if (error?.enrichmentHttpFailureCode) {
    return buildFailure(error.enrichmentHttpFailureCode, {
      reason: error.enrichmentHttpFailureReason,
    });
  }

  const status = error?.response?.status;
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '');

  if (code === 'ECONNABORTED' || /timeout/i.test(message)) {
    return buildFailure('timeout', { status });
  }
  if (code === 'ERR_FR_TOO_MANY_REDIRECTS' || /too many redirects|maximum number of redirects/i.test(message)) {
    return buildFailure('redirect_loop', { status });
  }
  if (status) {
    return buildFailure('http_status', { status });
  }
  if (/ENOTFOUND|EAI_AGAIN|ECONNRESET|ECONNREFUSED|network/i.test(`${code} ${message}`)) {
    return buildFailure('network_error');
  }
  return buildFailure('transport_error');
}

async function readEnrichmentHttpText(rawUrl, options = {}) {
  const policy = normalizePolicy(options);
  const requestPolicy = validateEnrichmentRequestUrl(rawUrl);
  if (!requestPolicy.ok) {
    return buildFailure('request_policy_refused', { reason: requestPolicy.reason });
  }

  if (policy.timeoutMs <= 0 || policy.timeoutMs > 30000) {
    return buildFailure('request_policy_refused', { reason: 'timeout_out_of_range' });
  }
  if (policy.maxRedirects < 0 || policy.maxRedirects > 5) {
    return buildFailure('request_policy_refused', { reason: 'redirect_limit_out_of_range' });
  }
  if (policy.maxBytes <= 0 || policy.maxBytes > 2 * 1024 * 1024) {
    return buildFailure('request_policy_refused', { reason: 'size_limit_out_of_range' });
  }

  const headers = buildRequestHeaders(options.headers);
  const headerPolicy = validateOutboundHeaders(headers);
  if (!headerPolicy.ok) {
    return buildFailure('request_policy_refused', headerPolicy);
  }

  const config = {
    headers,
    timeout: policy.timeoutMs,
    maxRedirects: policy.maxRedirects,
    maxContentLength: policy.maxBytes,
    maxBodyLength: policy.maxBytes,
    responseType: 'text',
    validateStatus: (status) => status >= 200 && status < 300,
    beforeRedirect: assertSafeRedirectTarget,
  };

  let response;
  try {
    response = await resolveTransport(options.transport)(requestPolicy.url, config);
  } catch (error) {
    return normalizeTransportError(error);
  }

  const status = Number(response?.status || 0);
  if (status && (status < 200 || status >= 300)) {
    return buildFailure('http_status', { status });
  }

  const finalUrl = extractFinalUrl(response);
  if (finalUrl && finalUrl !== requestPolicy.url) {
    const redirectPolicy = validateEnrichmentRequestUrl(finalUrl);
    if (!redirectPolicy.ok) {
      return buildFailure('unsafe_redirect_target', { reason: redirectPolicy.reason });
    }
  }

  const body = responseBodyToText(response?.data);
  if (Buffer.byteLength(body, 'utf8') > policy.maxBytes) {
    return buildFailure('response_too_large', {
      maxBytes: policy.maxBytes,
      byteLength: Buffer.byteLength(body, 'utf8'),
    });
  }

  return {
    ok: true,
    status,
    body,
  };
}

function redactText(value) {
  return String(value || '')
    .replace(AUTH_HEADER_LINE_RE, REDACTED)
    .replace(BEARER_RE, REDACTED)
    .replace(QUERY_SECRET_RE, '$1[REDACTED]')
    .replace(API_KEY_TEXT_RE, REDACTED)
    .replace(EMAIL_RE, '[REDACTED:PII]')
    .replace(PRIVATE_CUSTOMER_RE, REDACTED)
    .replace(URL_RE, (match) => {
      try {
        const parsed = new URL(match);
        return isBlockedHostname(parsed.hostname) ? REDACTED_PRIVATE_URL : REDACTED_URL;
      } catch {
        return REDACTED_URL;
      }
    });
}

function redactEnrichmentHttpEvidence(value, key = '') {
  if (value == null) return value;
  if (SENSITIVE_KEY_RE.test(String(key || ''))) {
    if (/url|uri|href/i.test(key)) return REDACTED_URL;
    return REDACTED;
  }
  if (typeof value === 'string') return redactText(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.map((entry) => redactEnrichmentHttpEvidence(entry));
  }
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        redactEnrichmentHttpEvidence(entryValue, entryKey),
      ])
    );
  }
  return REDACTED;
}

function buildOutboundHttpEnrichmentBoundaryAudit(input = {}) {
  return {
    documentStatus: OUTBOUND_HTTP_ENRICHMENT_BOUNDARY_STATUS,
    generatedAt: input.generatedAt || new Date().toISOString(),
    repo: 'dooosp/b2b-lead-agent',
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    notProductionEvidence: true,
    productionReady: false,
    productionReviewerWorkflowReady: false,
    issueRefs: {
      level1ProofHold: 'https://github.com/dooosp/b2b-lead-agent/issues/165',
    },
    inventory: {
      axiosImportBoundary: 'enricher/outbound-http-boundary.js',
      rootEnrichmentCallers: [
        'enricher/article-content-scraper.js',
        'enricher/article-url-resolver.js',
        'enricher/article-enricher.js',
        'orchestrator/news-orchestrator.js',
        'lib/news-fetcher/index.js',
        'main.js',
      ],
      workerRuntimeEntrypointImportsAxios: false,
      responsePersistencePaths: [
        'article.content bodySource=article-body',
        'article.link resolvedUrl/originalLink source trace fields',
        'lead-report-publisher published LeadBrief source metadata',
      ],
    },
    policy: {
      allowedSchemes: [...DEFAULT_ENRICHMENT_HTTP_POLICY.allowedSchemes],
      blockedHostTypes: [
        'localhost',
        'private_ipv4',
        'loopback_ipv6',
        'link_local_ipv6',
        'internal_host_label',
        'repo_production_like_host',
        'workers_dev_pages_dev',
      ],
      timeoutMs: DEFAULT_ENRICHMENT_HTTP_POLICY.timeoutMs,
      maxRedirects: DEFAULT_ENRICHMENT_HTTP_POLICY.maxRedirects,
      maxBytes: DEFAULT_ENRICHMENT_HTTP_POLICY.maxBytes,
      authOrSecretHeadersAllowed: false,
    },
    transportContract: {
      defaultTransport: 'axios.get',
      injectable: true,
      liveNetworkRequiredForTests: false,
      localFixtureOnly: true,
    },
    failureModeCoverage: [
      'dns_network_error',
      'timeout',
      '4xx_5xx',
      'malformed_html',
      'huge_body',
      'redirect_loop',
      'axios_error_shape',
    ],
    redaction: {
      urls: 'redacted_or_private_url_redacted',
      headers: 'redacted',
      errors: 'normalized_without_raw_message_stack_config_response_payload',
      snippets: 'redacted',
      sampleEvidence: redactEnrichmentHttpEvidence(input.sampleEvidence || {}),
    },
    nonClaims: [
      'This artifact is not production proof.',
      'This artifact does not call production or staging endpoints, deploy, access D1, read logs or secrets, use customer/private data, or touch CRM/outreach/LLM/automation.',
      'This artifact proves local/test contracts only and does not claim future outbound dependency risk is eliminated.',
    ],
  };
}

module.exports = {
  OUTBOUND_HTTP_ENRICHMENT_BOUNDARY_STATUS,
  DEFAULT_ENRICHMENT_HTTP_POLICY,
  ENRICHMENT_HTTP_USER_AGENT,
  buildOutboundHttpEnrichmentBoundaryAudit,
  createAxiosEnrichmentTransport,
  readEnrichmentHttpText,
  redactEnrichmentHttpEvidence,
  validateEnrichmentRequestUrl,
};
