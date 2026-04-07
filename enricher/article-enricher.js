function fetchArticleContent(...args) {
  return require('./article-content-scraper').fetchArticleContent(...args);
}

function resolveOriginalUrl(...args) {
  return require('./article-url-resolver').resolveOriginalUrl(...args);
}

function isGoogleNewsUrl(url) {
  return typeof url === 'string' && url.includes('news.google.com');
}

/**
 * 기사 본문 배치 크롤링
 * Google News URL은 자동으로 원본 URL 해석 후 크롤링
 */
async function enrichArticles(
  articles,
  {
    batchSize = 3,
    delayMs = 300,
    resolveUrls = true,
    urlResolver = resolveOriginalUrl,
    contentFetcher = fetchArticleContent,
  } = {}
) {
  for (let i = 0; i < articles.length; i += batchSize) {
    const batch = articles.slice(i, i + batchSize);
    await Promise.allSettled(batch.map(async (article) => {
      if (resolveUrls && isGoogleNewsUrl(article.link)) {
        const discoveryUrl = article.originalLink || article.originalUrl || article.link;
        article.originalLink = discoveryUrl;
        const originalUrl = await urlResolver(article.title);
        if (originalUrl) {
          article.link = originalUrl;
          article.resolvedUrl = true;
        } else {
          article.link = discoveryUrl;
          article.resolvedUrl = false;
        }
      }

      if (!article.content || article.content.length < 50) {
        article.content = await contentFetcher(article.link);
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
