/**
 * 한국 뉴스 RSS 피드 (한국경제, 연합뉴스 등)
 */
const Parser = require('rss-parser');
const { withRetry } = require('../utils/retry');

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

async function fetchRSSFeed(feedKey, { maxItems = 5 } = {}) {
  const feed = FEEDS[feedKey];
  if (!feed) throw new Error(`Unknown feed: ${feedKey}. Available: ${Object.keys(FEEDS).join(', ')}`);

  try {
    const parsed = await withRetry(() => parser.parseURL(feed.url), { label: feed.source });
    return parsed.items.slice(0, maxItems).map(item => ({
      title: item.title || '',
      link: item.link || '',
      source: feed.source,
      pubDate: item.pubDate || '',
      content: item.contentSnippet || '',
      query: feed.source
    }));
  } catch (error) {
    console.error(`[RSS] ${feed.source} 실패: ${error.message}`);
    return [];
  }
}

async function fetchCustomRSS(url, sourceName, { maxItems = 5 } = {}) {
  try {
    const parsed = await withRetry(() => parser.parseURL(url), { label: sourceName });
    return parsed.items.slice(0, maxItems).map(item => ({
      title: item.title || '',
      link: item.link || '',
      source: sourceName,
      pubDate: item.pubDate || '',
      content: item.contentSnippet || '',
      query: sourceName
    }));
  } catch (error) {
    console.error(`[RSS] ${sourceName} 실패: ${error.message}`);
    return [];
  }
}

async function fetchAllKoreanRSS({ maxItems = 5 } = {}) {
  const settled = await Promise.allSettled(
    Object.keys(FEEDS).map(key => fetchRSSFeed(key, { maxItems }))
  );
  return settled
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value);
}

module.exports = { fetchRSSFeed, fetchCustomRSS, fetchAllKoreanRSS, FEEDS };
