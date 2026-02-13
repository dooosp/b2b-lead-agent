/**
 * 뉴스 기사 본문 크롤링 (cheerio 기반)
 */
const axios = require('axios');
const cheerio = require('cheerio');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const BODY_SELECTORS = [
  '.article_body', '#articleBody', '#newsEndContents', '.article-body',
  '.article_content', '.view_cont', '.newsct_article', '#articeBody',
  '.news_body', '#news_body_area', '.article_txt', '#article-view-content-div',
  '.story_area', '.news_view', '.article_view'
];

async function fetchArticleContent(url, { timeout = 8000, maxLength = 1500 } = {}) {
  if (!url || url.includes('news.google.com')) return '';
  try {
    const res = await axios.get(url, {
      headers: { 'User-Agent': UA },
      timeout
    });
    const $ = cheerio.load(res.data);

    // 1. 본문 셀렉터 시도 (가장 긴 텍스트)
    let content = '';
    for (const sel of BODY_SELECTORS) {
      const text = $(sel).text().trim().replace(/\s+/g, ' ');
      if (text.length > content.length) content = text;
    }

    // 2. og:description 보완
    if (content.length < 100) {
      const ogDesc = $('meta[property="og:description"]').attr('content') || '';
      if (ogDesc.length > content.length) content = ogDesc;
    }

    // 3. p 태그 조합 (마지막 수단)
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
