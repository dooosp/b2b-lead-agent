const REDACTION_LABELS = Object.freeze({
  authHeader: '[REDACTED:AUTH_HEADER]',
  cookie: '[REDACTED:COOKIE]',
  databaseId: '[REDACTED:DATABASE_ID]',
  pii: '[REDACTED:PII]',
  privateUrl: '[REDACTED:PRIVATE_URL]',
  protectedText: '[REDACTED:PROTECTED_TEXT]',
  token: '[REDACTED:TOKEN]'
});

const DATABASE_ID_KEY_RE = /(^|[_-])(d1|db|database)([_-]?[a-z]*)?[_-]?id$|databaseid|d1databaseid|dbid/i;
const TOKEN_KEY_RE = /token|secret|password|api[_-]?key|apikey|access[_-]?key|callback[_-]?token/i;
const AUTH_HEADER_KEY_RE = /^authorization$|proxy-authorization|auth[_-]?header/i;
const COOKIE_KEY_RE = /^cookie$|^set-cookie$|cookie/i;
const PRIVATE_URL_KEY_RE = /private[_-]?url|internal[_-]?url|callback[_-]?url|endpoint|webhook/i;
const PII_KEY_RE = /email|phone|contact|customer|person|user[_-]?name|full[_-]?name|owner|approver|observer|actor|author/i;
const PROTECTED_TEXT_KEY_RE = /^notes$|manual[_-]?review[_-]?notes|manual[_-]?note(?:[_-]?body)?|note[_-]?body|generated[_-]?suggestion|generated[_-]?helper|review[_-]?note[_-]?suggestion|review[_-]?note[_-]?templates/i;

const AUTH_HEADER_RE = /\b(?:Authorization|Proxy-Authorization)\s*:\s*[^\r\n]+/gi;
const TOKEN_HEADER_RE = /\b(?:X-API-Key|X-Auth-Token|X-Job-Callback-Token|Callback-Token)\s*:\s*[^\r\n]+/gi;
const COOKIE_HEADER_RE = /\b(?:Cookie|Set-Cookie)\s*:\s*[^\r\n]+/gi;
const DATABASE_ID_TEXT_RE = /\b(D1_DATABASE_ID|DATABASE_ID|DB_ID|databaseId|database_id|d1DatabaseId|dbId)\s*[:=]\s*[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const URL_RE = /https?:\/\/[^\s\])"'<>]+/gi;
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_RE = /\b(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)|\d{2,4})[\s.-]\d{3,4}[\s.-]\d{4}\b/g;
const INLINE_SECRET_RE = /\b(?:sk-[A-Za-z0-9_-]+|gh[pousr]_[A-Za-z0-9_]+|xox[abprs]-[A-Za-z0-9-]+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\b/g;
const KEY_VALUE_SECRET_RE = /\b(token|api[_-]?key|secret|password|session|auth)\s*=\s*[^&\s]+/gi;

function normalizeKeyPath(keyPath) {
  return keyPath.map((key) => String(key)).join('.');
}

function isDatabaseIdKey(keyPath) {
  return DATABASE_ID_KEY_RE.test(String(keyPath[keyPath.length - 1] || ''));
}

function isAuthHeaderKey(keyPath) {
  return AUTH_HEADER_KEY_RE.test(String(keyPath[keyPath.length - 1] || ''));
}

function isCookieKey(keyPath) {
  return COOKIE_KEY_RE.test(String(keyPath[keyPath.length - 1] || ''));
}

function isTokenKey(keyPath) {
  return TOKEN_KEY_RE.test(normalizeKeyPath(keyPath));
}

function isPrivateUrlKey(keyPath) {
  return PRIVATE_URL_KEY_RE.test(normalizeKeyPath(keyPath));
}

function isPiiKey(keyPath) {
  return PII_KEY_RE.test(normalizeKeyPath(keyPath));
}

function isProtectedTextKey(keyPath) {
  return PROTECTED_TEXT_KEY_RE.test(normalizeKeyPath(keyPath));
}

function isPrivateHostname(hostname) {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true;
  if (host.includes('internal') || host.includes('private')) return true;
  if (host === '127.0.0.1' || host.startsWith('127.')) return true;
  if (host.startsWith('10.')) return true;
  if (host.startsWith('192.168.')) return true;

  const parts = host.split('.').map((part) => Number(part));
  if (parts.length === 4 && parts.every((part) => Number.isInteger(part))) {
    return parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31;
  }

  return false;
}

function hasSensitiveQuery(url) {
  for (const key of url.searchParams.keys()) {
    if (/token|secret|password|api[_-]?key|auth|cookie|session/i.test(key)) return true;
  }
  return false;
}

function isSensitiveUrl(value) {
  try {
    const url = new URL(value);
    return Boolean(url.username || url.password || isPrivateHostname(url.hostname) || hasSensitiveQuery(url));
  } catch {
    return false;
  }
}

function redactUrl(value) {
  return isSensitiveUrl(value) ? REDACTION_LABELS.privateUrl : value;
}

function redactText(value) {
  if (typeof value !== 'string') return value;

  return value
    .replace(AUTH_HEADER_RE, REDACTION_LABELS.authHeader)
    .replace(TOKEN_HEADER_RE, REDACTION_LABELS.token)
    .replace(COOKIE_HEADER_RE, REDACTION_LABELS.cookie)
    .replace(DATABASE_ID_TEXT_RE, `$1=${REDACTION_LABELS.databaseId}`)
    .replace(URL_RE, redactUrl)
    .replace(EMAIL_RE, REDACTION_LABELS.pii)
    .replace(KEY_VALUE_SECRET_RE, `$1=${REDACTION_LABELS.token}`)
    .replace(INLINE_SECRET_RE, REDACTION_LABELS.token)
    .replace(PHONE_RE, REDACTION_LABELS.pii);
}

function redactStringForKey(value, keyPath) {
  if (isAuthHeaderKey(keyPath)) return REDACTION_LABELS.authHeader;
  if (isCookieKey(keyPath)) return REDACTION_LABELS.cookie;
  if (isDatabaseIdKey(keyPath)) return REDACTION_LABELS.databaseId;
  if (isTokenKey(keyPath)) return REDACTION_LABELS.token;
  if (isPrivateUrlKey(keyPath) && isSensitiveUrl(value)) return REDACTION_LABELS.privateUrl;
  if (isPiiKey(keyPath) && (EMAIL_RE.test(value) || PHONE_RE.test(value) || value.trim())) {
    EMAIL_RE.lastIndex = 0;
    PHONE_RE.lastIndex = 0;
    return REDACTION_LABELS.pii;
  }
  EMAIL_RE.lastIndex = 0;
  PHONE_RE.lastIndex = 0;
  return redactText(value);
}

function redactEvidence(value, keyPath = []) {
  if (value === null || value === undefined) return value;
  if (isProtectedTextKey(keyPath)) return REDACTION_LABELS.protectedText;
  if (Array.isArray(value)) {
    return value.map((item, index) => redactEvidence(item, keyPath.concat(index)));
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return redactStringForKey(value, keyPath);
  if (typeof value !== 'object') {
    if (isDatabaseIdKey(keyPath)) return REDACTION_LABELS.databaseId;
    if (isTokenKey(keyPath)) return REDACTION_LABELS.token;
    return value;
  }

  const redacted = {};
  for (const [key, item] of Object.entries(value)) {
    redacted[key] = redactEvidence(item, keyPath.concat(key));
  }
  return redacted;
}

module.exports = {
  REDACTION_LABELS,
  redactEvidence,
  redactText,
  isSensitiveUrl
};
