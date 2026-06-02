/**
 * 뉴스 기사 본문 크롤링 (cheerio 기반)
 */
const cheerio = require('cheerio');
const { readEnrichmentHttpText } = require('./outbound-http-boundary');

const BODY_SELECTORS = [
  '.article_body', '#articleBody', '#newsEndContents', '.article-body',
  '.article_content', '.view_cont', '.newsct_article', '#articeBody',
  '.news_body', '#news_body_area', '.article_txt', '#article-view-content-div',
  '.story_area', '.news_view', '.article_view'
];

async function fetchArticleContent(
  url,
  { timeout = 8000, maxLength = 1500, maxBytes, maxRedirects, transport } = {}
) {
  if (!url || url.includes('news.google.com')) return '';
  try {
    const res = await readEnrichmentHttpText(url, {
      timeout,
      maxBytes,
      maxRedirects,
      transport,
    });
    if (!res.ok) return '';

    const $ = cheerio.load(res.body);

    let content = '';
    for (const sel of BODY_SELECTORS) {
      const text = $(sel).text().trim().replace(/\s+/g, ' ');
      if (text.length > content.length) content = text;
    }

    if (content.length < 100) {
      const ogDesc = $('meta[property="og:description"]').attr('content') || '';
      if (ogDesc.length > content.length) content = ogDesc;
    }

    if (content.length < 100) {
      const ps = [];
      $('article p, .article p, .content p, .view_cont p').each((i, el) => {
        const t = $(el).text().trim();
        if (t.length > 20) ps.push(t);
      });
      const joined = ps.join(' ');
      if (joined.length > content.length) content = joined;
    }

    return content.substring(0, maxLength);
  } catch {
    return '';
  }
}

module.exports = { fetchArticleContent };
