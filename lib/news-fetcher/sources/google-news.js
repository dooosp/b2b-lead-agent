/**
 * Google News RSS 검색
 */
const Parser = require('rss-parser');
const { normalizeGoogleNewsItem, extractGoogleNewsSource } = require('../../../normalizer/article-normalizer');
const { withRetry } = require('../utils/retry');
const { applyArticleBodyTrust } = require('../../../article-trust');

const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  },
  timeout: 10000,
  customFields: { item: ['source'] }
});

const GOOGLE_NEWS_RSS = 'https://news.google.com/rss/search';

async function fetchGoogleNews(query, {
  maxItems = 5,
  parserImpl = parser,
  retryImpl = withRetry,
} = {}) {
  const url = `${GOOGLE_NEWS_RSS}?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`;
  try {
    const feed = await retryImpl(() => parserImpl.parseURL(url), { label: `GoogleNews:${query}` });
    return feed.items
      .slice(0, maxItems)
      .map(item => applyArticleBodyTrust(normalizeGoogleNewsItem(item, query)));
  } catch (error) {
    console.error(`[GoogleNews] "${query}" 검색 실패: source unavailable`);
    throw Object.assign(new Error('Google News source unavailable.'), {
      code: 'ERR_NEWS_SOURCE_UNAVAILABLE',
      cause: error,
    });
  }
}

function extractSource(title) {
  return extractGoogleNewsSource(title);
}

async function fetchGoogleNewsBatch(queries, {
  maxItems = 5,
  batchSize = 2,
  delayMs = 300,
  fetchImpl = fetchGoogleNews,
} = {}) {
  const results = [];
  let fulfilledQueries = 0;
  for (let i = 0; i < queries.length; i += batchSize) {
    const batch = queries.slice(i, i + batchSize);
    const settled = await Promise.allSettled(batch.map(q => fetchImpl(q, { maxItems })));
    for (const r of settled) {
      if (r.status === 'fulfilled') {
        fulfilledQueries += 1;
        results.push(...r.value);
      }
    }
    if (i + batchSize < queries.length) await new Promise(r => setTimeout(r, delayMs));
  }
  if (queries.length > 0 && fulfilledQueries === 0) {
    throw Object.assign(new Error('Every Google News query failed.'), {
      code: 'ERR_NEWS_SOURCE_UNAVAILABLE',
    });
  }
  return results;
}

module.exports = { fetchGoogleNews, fetchGoogleNewsBatch, extractSource };
