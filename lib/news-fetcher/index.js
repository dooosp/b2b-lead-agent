/**
 * news-fetcher — 공용 뉴스 수집 모듈
 *
 * Sources: Google News RSS, Korean RSS (한국경제/연합뉴스), Custom RSS
 * Utils: Jaccard 중복제거, Cheerio 본문 스크래핑, Google News URL 해석
 */

const { fetchGoogleNews, fetchGoogleNewsBatch } = require('./sources/google-news');
const { fetchRSSFeed, fetchCustomRSS, fetchAllKoreanRSS, FEEDS } = require('./sources/korean-rss');
const { removeDuplicates, calculateSimilarity } = require('./utils/deduplication');
const { fetchArticleContent } = require('./utils/content-scraper');
const { resolveOriginalUrl } = require('./utils/url-resolver');
const { withRetry } = require('./utils/retry');

/**
 * 기사 본문 배치 크롤링 (batchSize개씩 병렬)
 * Google News URL은 자동으로 원본 URL 해석 후 크롤링
 */
async function enrichArticles(articles, { batchSize = 3, delayMs = 300, resolveUrls = true } = {}) {
  for (let i = 0; i < articles.length; i += batchSize) {
    const batch = articles.slice(i, i + batchSize);
    await Promise.allSettled(batch.map(async (article) => {
      if (resolveUrls && article.link.includes('news.google.com')) {
        const originalUrl = await resolveOriginalUrl(article.title);
        if (originalUrl) {
          article.link = originalUrl;
          article.resolvedUrl = true;
        } else {
          const q = article.title.replace(/\s*-\s*[^-]+$/, '').trim();
          article.link = `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(q)}`;
          article.resolvedUrl = false;
        }
      }
      if (!article.content || article.content.length < 50) {
        article.content = await fetchArticleContent(article.link);
      }
    }));
    if (i + batchSize < articles.length) await new Promise(r => setTimeout(r, delayMs));
  }
  return articles;
}

/**
 * 통합 뉴스 수집 — queries로 Google News + 한국 RSS 병렬 수집 → 중복 제거 → 본문 보강
 */
async function fetchNews(queries, { maxItems = 5, enrichContent = true, koreanRSS = false } = {}) {
  const tasks = [fetchGoogleNewsBatch(queries, { maxItems })];
  if (koreanRSS) tasks.push(fetchAllKoreanRSS({ maxItems }));

  const settled = await Promise.allSettled(tasks);
  let allArticles = settled
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value);

  allArticles = removeDuplicates(allArticles);

  if (enrichContent) {
    await enrichArticles(allArticles);
  }

  return allArticles;
}

module.exports = {
  // 통합
  fetchNews,
  enrichArticles,
  // Sources
  fetchGoogleNews,
  fetchGoogleNewsBatch,
  fetchRSSFeed,
  fetchCustomRSS,
  fetchAllKoreanRSS,
  FEEDS,
  // Utils
  removeDuplicates,
  calculateSimilarity,
  fetchArticleContent,
  resolveOriginalUrl,
  withRetry
};
