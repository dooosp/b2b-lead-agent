/**
 * news-fetcher — 공용 뉴스 수집 모듈
 *
 * Sources: Google News RSS, Korean RSS (한국경제/연합뉴스), Custom RSS
 * Utils: Jaccard 중복제거, Cheerio 본문 스크래핑, Google News URL 해석
 */

const { fetchGoogleNews, fetchGoogleNewsBatch } = require('./sources/google-news');
const { fetchRSSFeed, fetchCustomRSS, fetchAllKoreanRSS, FEEDS } = require('./sources/korean-rss');
const { removeDuplicates, calculateSimilarity } = require('../../deduper/article-deduper');
const { enrichArticles, fetchArticleContent, resolveOriginalUrl } = require('../../enricher/article-enricher');
const { withRetry } = require('./utils/retry');

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
  fetchNews,
  enrichArticles,
  fetchGoogleNews,
  fetchGoogleNewsBatch,
  fetchRSSFeed,
  fetchCustomRSS,
  fetchAllKoreanRSS,
  FEEDS,
  removeDuplicates,
  calculateSimilarity,
  fetchArticleContent,
  resolveOriginalUrl,
  withRetry
};
