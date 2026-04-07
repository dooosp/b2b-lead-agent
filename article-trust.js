const SEARCH_HOST_PATTERNS = Object.freeze([
  /^news\.google\.com$/i,
  /^search\.naver\.com$/i,
  /^search\.daum\.net$/i,
  /^www\.google\.com$/i,
  /^google\.com$/i,
  /^www\.bing\.com$/i
]);

const SEARCH_PATH_PATTERNS = Object.freeze([
  /^\/search$/i,
  /^\/search\//i
]);

function normalizeBodyText(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isSearchOrAggregatorUrl(url) {
  try {
    const parsed = new URL(String(url || ''));
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname || '/';
    if (SEARCH_HOST_PATTERNS.some((pattern) => pattern.test(host)) && SEARCH_PATH_PATTERNS.some((pattern) => pattern.test(path))) {
      return true;
    }
    return /^news\.google\.com$/i.test(host);
  } catch {
    return false;
  }
}

function classifyArticleBody(article = {}) {
  const body = normalizeBodyText(article.content || article.body || article._body || '');
  const source = String(article.bodySource || article.contentSource || '').trim();
  const link = String(article.link || '');

  if (!body) {
    return {
      body: '',
      bodyTrust: 'missing',
      bodyTrustReason: '본문 미확보',
      bodySource: source || 'missing'
    };
  }

  if (isSearchOrAggregatorUrl(link)) {
    return {
      body,
      bodyTrust: 'low',
      bodyTrustReason: '원문 URL을 확정하지 못해 검색/집계 페이지 본문은 신뢰하지 않음',
      bodySource: source || 'search-result'
    };
  }

  if (source === 'article-body' && body.length >= 120) {
    return {
      body,
      bodyTrust: 'trusted',
      bodyTrustReason: '원문 기사 본문 확보',
      bodySource: source
    };
  }

  if (source === 'article-body') {
    return {
      body,
      bodyTrust: 'low',
      bodyTrustReason: '원문 본문 길이가 짧아 신뢰 본문으로 승격하지 않음',
      bodySource: source
    };
  }

  if (source === 'feed-snippet') {
    return {
      body,
      bodyTrust: 'low',
      bodyTrustReason: 'RSS snippet 또는 요약문만 확보',
      bodySource: source
    };
  }

  return {
    body,
    bodyTrust: 'low',
    bodyTrustReason: '본문 출처를 검증할 수 없어 신뢰 본문으로 사용하지 않음',
    bodySource: source || 'unknown'
  };
}

function applyArticleBodyTrust(article = {}) {
  const classified = classifyArticleBody(article);
  article.content = classified.body;
  article.bodySource = classified.bodySource;
  article.bodyTrust = classified.bodyTrust;
  article.bodyTrustReason = classified.bodyTrustReason;
  article._trustedBody = classified.bodyTrust === 'trusted' ? classified.body : '';
  article._hasBody = classified.bodyTrust === 'trusted';
  return article;
}

function getTrustedArticleBody(article = {}) {
  return classifyArticleBody(article).bodyTrust === 'trusted'
    ? classifyArticleBody(article).body
    : '';
}

function getArticleContextText(article = {}) {
  return [article.title, article.query, getTrustedArticleBody(article)]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = {
  applyArticleBodyTrust,
  classifyArticleBody,
  getArticleContextText,
  getTrustedArticleBody,
  isSearchOrAggregatorUrl,
  normalizeBodyText
};
