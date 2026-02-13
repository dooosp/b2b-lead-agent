/**
 * Google News RSS 검색
 */
const Parser = require('rss-parser');
const { withRetry } = require('../utils/retry');

const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  },
  timeout: 10000,
  customFields: { item: ['source'] }
});

const GOOGLE_NEWS_RSS = 'https://news.google.com/rss/search';

async function fetchGoogleNews(query, { maxItems = 5 } = {}) {
  const url = `${GOOGLE_NEWS_RSS}?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`;
  try {
    const feed = await withRetry(() => parser.parseURL(url), { label: `GoogleNews:${query}` });
    return feed.items.slice(0, maxItems).map(item => ({
      title: item.title || '',
      link: item.link || '',
      source: item.source?._ || item.creator || extractSource(item.title),
      pubDate: item.pubDate || '',
      content: item.contentSnippet || '',
      query
    }));
  } catch (error) {
    console.error(`[GoogleNews] "${query}" 검색 실패: ${error.message}`);
    return [];
  }
}

function extractSource(title) {
  const match = title?.match(/ - ([^-]+)$/);
  return match ? match[1].trim() : 'Unknown';
}

async function fetchGoogleNewsBatch(queries, { maxItems = 5, batchSize = 2, delayMs = 300 } = {}) {
  const results = [];
  for (let i = 0; i < queries.length; i += batchSize) {
    const batch = queries.slice(i, i + batchSize);
    const settled = await Promise.allSettled(batch.map(q => fetchGoogleNews(q, { maxItems })));
    for (const r of settled) {
      if (r.status === 'fulfilled') results.push(...r.value);
    }
    if (i + batchSize < queries.length) await new Promise(r => setTimeout(r, delayMs));
  }
  return results;
}

module.exports = { fetchGoogleNews, fetchGoogleNewsBatch };
