/**
 * 한국 뉴스 RSS 피드 (한국경제, 연합뉴스 등)
 */
const Parser = require('rss-parser');
const { normalizeRssItem } = require('../../../normalizer/article-normalizer');
const { withRetry } = require('../utils/retry');
const { applyArticleBodyTrust } = require('../../../article-trust');

const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  },
  timeout: 10000
});

const FEEDS = {
  hankyung: { url: 'https://www.hankyung.com/feed/economy', source: '한국경제' },
  yonhap: { url: 'https://www.yna.co.kr/rss/economy.xml', source: '연합뉴스' }
};

async function fetchRSSFeed(feedKey, {
  maxItems = 5,
  parserImpl = parser,
  retryImpl = withRetry,
} = {}) {
  const feed = FEEDS[feedKey];
  if (!feed) throw new Error(`Unknown feed: ${feedKey}. Available: ${Object.keys(FEEDS).join(', ')}`);

  try {
    const parsed = await retryImpl(() => parserImpl.parseURL(feed.url), { label: feed.source });
    return parsed.items
      .slice(0, maxItems)
      .map(item => applyArticleBodyTrust(normalizeRssItem(item, {
        source: feed.source,
        query: feed.source
      })));
  } catch (error) {
    console.error(`[RSS] ${feed.source} 실패: source unavailable`);
    throw Object.assign(new Error('RSS source unavailable.'), {
      code: 'ERR_NEWS_SOURCE_UNAVAILABLE',
      cause: error,
    });
  }
}

async function fetchCustomRSS(url, sourceName, {
  maxItems = 5,
  parserImpl = parser,
  retryImpl = withRetry,
} = {}) {
  try {
    const parsed = await retryImpl(() => parserImpl.parseURL(url), { label: sourceName });
    return parsed.items
      .slice(0, maxItems)
      .map(item => applyArticleBodyTrust(normalizeRssItem(item, {
        source: sourceName,
        query: sourceName
      })));
  } catch (error) {
    console.error(`[RSS] ${sourceName} 실패: source unavailable`);
    throw Object.assign(new Error('Custom RSS source unavailable.'), {
      code: 'ERR_NEWS_SOURCE_UNAVAILABLE',
      cause: error,
    });
  }
}

async function fetchAllKoreanRSS({ maxItems = 5, fetchImpl = fetchRSSFeed } = {}) {
  const settled = await Promise.allSettled(
    Object.keys(FEEDS).map(key => fetchImpl(key, { maxItems }))
  );
  const fulfilled = settled
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value);
  if (settled.length > 0 && settled.every((result) => result.status === 'rejected')) {
    throw Object.assign(new Error('Every Korean RSS source failed.'), {
      code: 'ERR_NEWS_SOURCE_UNAVAILABLE',
    });
  }
  return fulfilled;
}

module.exports = { fetchRSSFeed, fetchCustomRSS, fetchAllKoreanRSS, FEEDS };
