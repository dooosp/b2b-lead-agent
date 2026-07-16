const {
  fetchGoogleNewsBatch
} = require('../lib/news-fetcher/sources/google-news');
const {
  fetchRSSFeed
} = require('../lib/news-fetcher/sources/korean-rss');
const { removeDuplicates } = require('../deduper/article-deduper');
const { enrichArticles } = require('../enricher/article-enricher');

// B2B 리드 발굴용 뉴스 오케스트레이터
async function fetchIndustryNews(profile, {
  googleNewsBatch = fetchGoogleNewsBatch,
  rssFeed = fetchRSSFeed,
  dedupe = removeDuplicates,
  enrich = enrichArticles,
} = {}) {
  console.log('\n[Step 1] 산업 뉴스 수집 시작...');

  // Phase 1: RSS 소스 3종 병렬
  console.log('  RSS 소스 병렬 수집...');
  const settled = await Promise.allSettled([
    googleNewsBatch(profile.searchQueries, { maxItems: 3 }),
    rssFeed('hankyung', { maxItems: 5 }),
    rssFeed('yonhap', { maxItems: 5 })
  ]);

  let allArticles = [];
  const labels = ['Google News', '한국경제', '연합뉴스'];
  for (let i = 0; i < settled.length; i++) {
    if (settled[i].status === 'fulfilled') {
      allArticles = allArticles.concat(settled[i].value);
      console.log(`  ${labels[i]}: ${settled[i].value.length}건`);
    } else {
      console.warn(`  [경고] ${labels[i]} 실패: source unavailable`);
    }
  }

  if (allArticles.length === 0 && settled.some((result) => result.status === 'rejected')) {
    throw Object.assign(new Error('Article collection was incomplete and produced no articles.'), {
      code: 'ERR_COLLECTION_FAILED',
      retryable: true,
    });
  }

  // 중복 제거
  const uniqueArticles = dedupe(allArticles);
  console.log(`  수집 완료: 총 ${allArticles.length}개 → 중복 제거 후 ${uniqueArticles.length}개`);

  // Phase 2: 본문 크롤링 (enrichArticles가 URL 해석 + 본문 크롤링 일괄 처리)
  console.log('  기사 본문 수집 중...');
  await enrich(uniqueArticles, { batchSize: 3, delayMs: 300 });

  // 본문 수집 결과 로깅
  for (const article of uniqueArticles) {
    const status = article.content ? `✓ ${article.content.length}자` : '✗ 제목만';
    console.log(`    ${article.title.substring(0, 40)}... ${status}`);
  }

  console.log('  본문 수집 완료\n');
  return uniqueArticles;
}

module.exports = { fetchIndustryNews };
