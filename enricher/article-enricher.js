const { fetchArticleContent } = require('./article-content-scraper');
const { resolveOriginalUrl } = require('./article-url-resolver');

/**
 * 기사 본문 배치 크롤링
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

    if (i + batchSize < articles.length) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  return articles;
}

module.exports = {
  enrichArticles,
  fetchArticleContent,
  resolveOriginalUrl,
};
