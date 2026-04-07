const crypto = require('crypto');

const COMPANY_NAME_MAX_LEN = 40;
const COMPANY_NAME_RE = /^[\p{L}0-9 .,&()\-]+$/u;
const PLACEHOLDER_RE = /\{[^}]{1,40}\}/g;
const TRACKING_PARAM_RE = /^(utm_|fbclid$|gclid$|mc_|ocid$|cmp$|cmpid$|ref$|ref_src$|guccounter$|igshid$|yclid$)/i;
const GENERIC_COMPANY_PATTERNS = Object.freeze([
  /^미상$/u,
  /^잠재 고객사$/u,
  /^잘못된\s*회사명$/u,
  /^국내 .*업계$/u,
  /^.*업계$/u,
  /^시장$/u,
  /^.* 시장$/u,
  /^dc 시장$/iu
]);

function sanitizeText(value, fallback = '') {
  const cleaned = String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(PLACEHOLDER_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned) return cleaned;
  return String(fallback || '').trim();
}

function slugify(value, fallback = 'lead') {
  const slug = sanitizeText(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
  return slug || fallback;
}

function isValidCompanyName(name = '') {
  const trimmed = sanitizeText(name, '')
    .replace(/[{}]/g, '')
    .trim();
  if (!trimmed || trimmed.length < 2 || trimmed.length > COMPANY_NAME_MAX_LEN) return false;
  if (trimmed.includes('|')) return false;
  if (!COMPANY_NAME_RE.test(trimmed)) return false;
  if (GENERIC_COMPANY_PATTERNS.some((pattern) => pattern.test(trimmed))) return false;
  return true;
}

function normalizeCompanyName(raw = '') {
  const normalized = sanitizeText(raw, '')
    .replace(/^[A-Z]\s*\|\s*/i, '')
    .replace(/^[A-Z]\.\s*/i, '')
    .replace(/[{}]/g, '')
    .replace(/\s*\|\s*/g, '|')
    .trim();
  const firstSegment = normalized.includes('|') ? normalized.split('|')[0].trim() : normalized;
  const collapsed = firstSegment.replace(/\s+/g, ' ').slice(0, COMPANY_NAME_MAX_LEN).trim();
  return isValidCompanyName(collapsed) ? collapsed : '';
}

function normalizeSourceTitle(title = '') {
  return sanitizeText(title, '')
    .toLowerCase()
    .replace(/^["']+|["']+$/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 180);
}

function isSearchOrAggregatorUrl(url) {
  try {
    const parsed = new URL(String(url || ''));
    const host = parsed.hostname.toLowerCase();
    return host === 'news.google.com'
      || host === 'search.naver.com'
      || host === 'search.daum.net'
      || ((host === 'www.google.com' || host === 'google.com' || host === 'www.bing.com') && parsed.pathname === '/search');
  } catch {
    return false;
  }
}

function canonicalizeSourceUrl(url = '') {
  try {
    const parsed = new URL(String(url || ''));
    if (!/^https?:$/i.test(parsed.protocol)) return '';
    if (isSearchOrAggregatorUrl(url)) return '';

    parsed.hash = '';
    const keptParams = [...parsed.searchParams.entries()]
      .filter(([key]) => !TRACKING_PARAM_RE.test(key))
      .sort(([aKey, aValue], [bKey, bValue]) => {
        if (aKey === bKey) return aValue.localeCompare(bValue);
        return aKey.localeCompare(bKey);
      });

    parsed.search = '';
    for (const [key, value] of keptParams) {
      parsed.searchParams.append(key, value);
    }

    const pathname = (parsed.pathname || '/').replace(/\/+$/g, '') || '/';
    const search = parsed.searchParams.toString();
    return `${parsed.protocol.toLowerCase()}//${parsed.hostname.toLowerCase()}${pathname}${search ? `?${search}` : ''}`;
  } catch {
    return '';
  }
}

function normalizeSources(sources = []) {
  const seen = new Set();
  return (Array.isArray(sources) ? sources : [])
    .map((source) => {
      const title = sanitizeText(source && source.title, '');
      const url = sanitizeText(source && source.url, '');
      const canonicalUrl = canonicalizeSourceUrl(url);
      const titleKey = normalizeSourceTitle(title);
      const key = canonicalUrl ? `url:${canonicalUrl}` : (titleKey ? `title:${titleKey}` : '');
      if (!key || seen.has(key)) return null;
      seen.add(key);
      return { title, url, canonicalUrl, key };
    })
    .filter(Boolean);
}

function selectIdentityAnchor(lead = {}) {
  const sources = normalizeSources(lead.sources);
  if (sources.length > 0) {
    return sources
      .slice()
      .sort((a, b) => {
        const aRank = a.canonicalUrl ? 0 : 1;
        const bRank = b.canonicalUrl ? 0 : 1;
        if (aRank !== bRank) return aRank - bRank;
        return a.key.localeCompare(b.key);
      })[0].key;
  }

  const summary = sanitizeText(lead.summary || lead.projectTitle || '', '')
    .toLowerCase()
    .replace(/["'`]/g, '')
    .slice(0, 180);
  if (summary) return `summary:${summary}`;

  const eventType = sanitizeText(lead.eventType || '', '').toLowerCase();
  if (eventType) return `event:${eventType}`;

  return 'fallback:lead';
}

function buildLeadIdentityFingerprint(lead = {}, { profileId = '' } = {}) {
  const normalizedCompany = normalizeCompanyName(lead.company || '');
  const companyToken = normalizedCompany || sanitizeText(lead.company || '', 'lead').toLowerCase();
  const anchor = selectIdentityAnchor(lead);
  const eventType = sanitizeText(lead.eventType || '', '').toLowerCase();
  const profileToken = sanitizeText(profileId, '').toLowerCase();
  const payload = JSON.stringify({
    profile: profileToken,
    company: companyToken,
    anchor,
    eventType
  });
  return crypto.createHash('sha1').update(payload).digest('hex');
}

function computeStableLeadId(lead = {}, { profileId = '' } = {}) {
  const normalizedCompany = normalizeCompanyName(lead.company || '');
  const companySlug = slugify(normalizedCompany || lead.company || 'lead');
  const fingerprint = buildLeadIdentityFingerprint(lead, { profileId });
  return `${companySlug}_${fingerprint.slice(0, 14)}`;
}

module.exports = {
  buildLeadIdentityFingerprint,
  canonicalizeSourceUrl,
  computeStableLeadId,
  isSearchOrAggregatorUrl,
  isValidCompanyName,
  normalizeCompanyName,
  normalizeSources,
  sanitizeText,
  selectIdentityAnchor,
  slugify
};
