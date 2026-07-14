const DNS_JSON_ENDPOINT = 'https://cloudflare-dns.com/dns-query';
const DNS_RESPONSE_MAX_BYTES = 64 * 1024;

export const DEFAULT_WORKER_OUTBOUND_POLICY = Object.freeze({
  timeoutMs: 5000,
  maxRedirects: 3,
  maxResponseBytes: 512 * 1024,
  allowedContentTypes: Object.freeze(['text/html', 'application/xhtml+xml']),
});

export const WORKER_NEWS_OUTBOUND_POLICY = Object.freeze({
  ...DEFAULT_WORKER_OUTBOUND_POLICY,
  allowedContentTypes: Object.freeze([
    'application/rss+xml',
    'application/xml',
    'text/xml',
  ]),
});

export class WorkerOutboundHttpError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'WorkerOutboundHttpError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new WorkerOutboundHttpError(code, message);
}

function parseIpv4(value) {
  const parts = String(value || '').split('.');
  if (parts.length !== 4) return null;
  const octets = parts.map((part) => {
    if (!/^\d{1,3}$/.test(part)) return null;
    const parsed = Number(part);
    return Number.isInteger(parsed) && parsed >= 0 && parsed <= 255 ? parsed : null;
  });
  return octets.some((part) => part === null) ? null : octets;
}

function isPublicIpv4(octets) {
  const [a, b, c] = octets;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 0 && c === 0) return false;
  if (a === 192 && b === 0 && c === 2) return false;
  if (a === 192 && b === 31 && c === 196) return false;
  if (a === 192 && b === 52 && c === 193) return false;
  if (a === 192 && b === 88 && c === 99) return false;
  if (a === 192 && b === 168) return false;
  if (a === 192 && b === 175 && c === 48) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}

function ipv6ToBigInt(value) {
  let raw = String(value || '').trim().toLowerCase();
  if (raw.startsWith('[') && raw.endsWith(']')) raw = raw.slice(1, -1);
  if (!raw || raw.includes('%')) return null;

  if (raw.includes('.')) {
    const separator = raw.lastIndexOf(':');
    if (separator < 0) return null;
    const ipv4 = parseIpv4(raw.slice(separator + 1));
    if (!ipv4) return null;
    const high = ((ipv4[0] << 8) | ipv4[1]).toString(16);
    const low = ((ipv4[2] << 8) | ipv4[3]).toString(16);
    raw = `${raw.slice(0, separator)}:${high}:${low}`;
  }

  const compressed = raw.split('::');
  if (compressed.length > 2) return null;
  const left = compressed[0] ? compressed[0].split(':') : [];
  const right = compressed.length === 2 && compressed[1] ? compressed[1].split(':') : [];
  const hasCompression = compressed.length === 2;
  const missing = 8 - left.length - right.length;
  if ((!hasCompression && missing !== 0) || (hasCompression && missing < 1)) return null;

  const groups = hasCompression
    ? [...left, ...Array(missing).fill('0'), ...right]
    : left;
  if (groups.length !== 8 || groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) {
    return null;
  }
  return groups.reduce((result, group) => (result << 16n) + BigInt(`0x${group}`), 0n);
}

function matchesIpv6Prefix(address, prefix, bits) {
  const shift = 128n - BigInt(bits);
  return (address >> shift) === (prefix >> shift);
}

const BLOCKED_IPV6_PREFIXES = Object.freeze([
  ['::', 96],
  ['64:ff9b::', 96],
  ['64:ff9b:1::', 48],
  ['100::', 64],
  ['2001::', 23],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['3fff::', 20],
  ['5f00::', 16],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
].map(([prefix, bits]) => [ipv6ToBigInt(prefix), bits]));
const IPV6_GLOBAL_UNICAST_PREFIX = ipv6ToBigInt('2000::');

function isPublicIpv6(address) {
  return matchesIpv6Prefix(address, IPV6_GLOBAL_UNICAST_PREFIX, 3)
    && !BLOCKED_IPV6_PREFIXES.some(([prefix, bits]) => (
      matchesIpv6Prefix(address, prefix, bits)
    ));
}

function normalizeHostname(value) {
  let hostname = String(value || '').trim().toLowerCase();
  if (hostname.startsWith('[') && hostname.endsWith(']')) hostname = hostname.slice(1, -1);
  return hostname.endsWith('.') ? hostname.slice(0, -1) : hostname;
}

function isBlockedHostname(hostname) {
  if (!hostname.includes('.')) return true;
  return [
    'localhost',
    'localhost.localdomain',
    '.localhost',
    '.local',
    '.internal',
    '.home',
    '.home.arpa',
    '.lan',
  ].some((suffix) => hostname === suffix.replace(/^\./, '') || hostname.endsWith(suffix));
}

export function assertPublicIpAddress(value) {
  const normalized = normalizeHostname(value);
  const ipv4 = parseIpv4(normalized);
  if (ipv4) {
    if (!isPublicIpv4(ipv4)) fail('unsafe_ip_address', 'Outbound address is not public.');
    return normalized;
  }

  const ipv6 = ipv6ToBigInt(normalized);
  if (ipv6 !== null) {
    if (!isPublicIpv6(ipv6)) fail('unsafe_ip_address', 'Outbound address is not public.');
    return normalized;
  }
  fail('invalid_ip_address', 'DNS returned an invalid IP address.');
}

function parseOutboundUrl(value) {
  let url;
  try {
    url = value instanceof URL ? new URL(value.href) : new URL(String(value || ''));
  } catch {
    fail('invalid_url', 'Outbound URL is invalid.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    fail('unsafe_url_scheme', 'Outbound URL scheme is not allowed.');
  }
  if (url.username || url.password) {
    fail('url_credentials_not_allowed', 'Outbound URL credentials are not allowed.');
  }
  url.hash = '';
  return url;
}

function validateHostname(hostname) {
  const normalized = normalizeHostname(hostname);
  const ipv4 = parseIpv4(normalized);
  const ipv6 = ipv6ToBigInt(normalized);
  if (ipv4 || ipv6 !== null) {
    assertPublicIpAddress(normalized);
    return { hostname: normalized, isIpLiteral: true };
  }
  if (isBlockedHostname(normalized)) {
    fail('unsafe_hostname', 'Outbound hostname is not publicly routable.');
  }
  return { hostname: normalized, isIpLiteral: false };
}

function normalizeContentType(value) {
  return String(value || '').split(';', 1)[0].trim().toLowerCase();
}

async function readBoundedResponseText(response, maxBytes) {
  const contentLength = response.headers?.get?.('Content-Length');
  if (contentLength !== null && contentLength !== undefined && contentLength !== '') {
    if (!/^\d+$/.test(contentLength)) {
      await cancelResponseBody(response);
      fail('invalid_content_length', 'Outbound response Content-Length is invalid.');
    }
    if (Number(contentLength) > maxBytes) {
      await cancelResponseBody(response);
      fail('response_too_large', 'Outbound response exceeds the byte limit.');
    }
  }

  if (!response.body || typeof response.body.getReader !== 'function') {
    await cancelResponseBody(response);
    fail('unbounded_response_body', 'Outbound response body is not stream-readable.');
  }

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
    total += chunk.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      fail('response_too_large', 'Outbound response exceeds the byte limit.');
    }
    chunks.push(chunk);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

async function queryDnsJson(hostname, type, { fetchImpl, signal }) {
  const url = new URL(DNS_JSON_ENDPOINT);
  url.searchParams.set('name', hostname);
  url.searchParams.set('type', type);
  const response = await fetchImpl(url.href, {
    headers: { Accept: 'application/dns-json' },
    redirect: 'error',
    signal,
  });
  if (!response.ok) fail('dns_resolution_failed', 'Public DNS lookup failed.');
  const contentType = normalizeContentType(response.headers?.get?.('Content-Type'));
  if (contentType !== 'application/dns-json' && contentType !== 'application/json') {
    fail('dns_resolution_failed', 'Public DNS lookup returned an unexpected content type.');
  }
  const text = await readBoundedResponseText(response, DNS_RESPONSE_MAX_BYTES);
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    fail('dns_resolution_failed', 'Public DNS lookup returned malformed JSON.');
  }
  if (payload.Status === 3) return [];
  if (payload.Status !== 0) fail('dns_resolution_failed', 'Public DNS lookup failed.');
  const expectedType = type === 'A' ? 1 : 28;
  return (Array.isArray(payload.Answer) ? payload.Answer : [])
    .filter((answer) => Number(answer?.type) === expectedType)
    .map((answer) => String(answer?.data || '').trim())
    .filter(Boolean);
}

export async function resolvePublicDnsAddresses(hostname, { fetchImpl = globalThis.fetch, signal } = {}) {
  const [ipv4, ipv6] = await Promise.all([
    queryDnsJson(hostname, 'A', { fetchImpl, signal }),
    queryDnsJson(hostname, 'AAAA', { fetchImpl, signal }),
  ]);
  return [...new Set([...ipv4, ...ipv6])];
}

export function createWorkerOutboundHttpContext({ fetchImpl = globalThis.fetch } = {}) {
  const dnsCache = new Map();
  return {
    fetchImpl,
    resolveHostname(hostname, { signal } = {}) {
      const normalized = normalizeHostname(hostname);
      if (!dnsCache.has(normalized)) {
        dnsCache.set(normalized, resolvePublicDnsAddresses(normalized, { fetchImpl, signal }));
      }
      return dnsCache.get(normalized);
    },
  };
}

async function validateOutboundUrl(value, { fetchImpl, resolveHostname, signal }) {
  const url = parseOutboundUrl(value);
  const host = validateHostname(url.hostname);
  if (!host.isIpLiteral) {
    const addresses = await resolveHostname(host.hostname, { fetchImpl, signal });
    if (!Array.isArray(addresses) || addresses.length === 0) {
      fail('dns_resolution_failed', 'Outbound hostname did not resolve to a public address.');
    }
    for (const address of addresses) assertPublicIpAddress(address);
  }
  return url;
}

function isRedirectResponse(response) {
  return [301, 302, 303, 307, 308].includes(response.status);
}

async function cancelResponseBody(response) {
  if (response.body && typeof response.body.cancel === 'function') {
    await response.body.cancel().catch(() => {});
  }
}

export async function fetchWorkerOutboundText(value, {
  policy = DEFAULT_WORKER_OUTBOUND_POLICY,
  headers = {},
  fetchImpl = globalThis.fetch,
  resolveHostname = resolvePublicDnsAddresses,
} = {}) {
  const timeoutMs = Number(policy.timeoutMs);
  const maxRedirects = Number(policy.maxRedirects);
  const maxResponseBytes = Number(policy.maxResponseBytes);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) fail('invalid_policy', 'Outbound timeout policy is invalid.');
  if (!Number.isInteger(maxRedirects) || maxRedirects < 0) fail('invalid_policy', 'Outbound redirect policy is invalid.');
  if (!Number.isInteger(maxResponseBytes) || maxResponseBytes <= 0) fail('invalid_policy', 'Outbound response-size policy is invalid.');

  const allowedContentTypes = new Set(
    (Array.isArray(policy.allowedContentTypes) ? policy.allowedContentTypes : [])
      .map(normalizeContentType)
      .filter(Boolean)
  );
  if (allowedContentTypes.size === 0) fail('invalid_policy', 'Outbound content-type policy is invalid.');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let current = value;
  try {
    for (let redirectCount = 0; ; redirectCount += 1) {
      const url = await validateOutboundUrl(current, {
        fetchImpl,
        resolveHostname,
        signal: controller.signal,
      });
      const response = await fetchImpl(url.href, {
        method: 'GET',
        headers,
        redirect: 'manual',
        signal: controller.signal,
      });

      if (response.redirected) {
        await cancelResponseBody(response);
        fail('automatic_redirect_not_allowed', 'Outbound fetch followed a redirect automatically.');
      }
      if (response.url) {
        let responseUrl;
        try {
          responseUrl = new URL(response.url);
          responseUrl.hash = '';
        } catch {
          await cancelResponseBody(response);
          fail('unexpected_response_url', 'Outbound fetch returned an invalid response URL.');
        }
        if (responseUrl.href !== url.href) {
          await cancelResponseBody(response);
          fail('automatic_redirect_not_allowed', 'Outbound fetch returned an unexpected response URL.');
        }
      }

      if (isRedirectResponse(response)) {
        const location = response.headers?.get?.('Location');
        await cancelResponseBody(response);
        if (!location) fail('redirect_location_missing', 'Outbound redirect is missing Location.');
        if (redirectCount >= maxRedirects) {
          fail('too_many_redirects', 'Outbound redirect limit exceeded.');
        }
        try {
          current = new URL(location, url).href;
        } catch {
          fail('invalid_redirect_url', 'Outbound redirect target is invalid.');
        }
        continue;
      }

      if (!response.ok) {
        await cancelResponseBody(response);
        return { response, text: '', url: url.href, redirectCount };
      }

      const contentType = normalizeContentType(response.headers?.get?.('Content-Type'));
      if (!allowedContentTypes.has(contentType)) {
        await cancelResponseBody(response);
        fail('content_type_not_allowed', 'Outbound response content type is not allowed.');
      }
      const text = await readBoundedResponseText(response, maxResponseBytes);
      return { response, text, url: url.href, redirectCount, contentType };
    }
  } catch (error) {
    if (error instanceof WorkerOutboundHttpError) throw error;
    if (controller.signal.aborted) {
      throw new WorkerOutboundHttpError('outbound_timeout', 'Outbound request deadline exceeded.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
