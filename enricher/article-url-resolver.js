/**
 * Google News 리다이렉트 URL을 원본 기사 URL로 해석
 */
const cheerio = require('cheerio');
const {
  readEnrichmentHttpText,
  validateEnrichmentRequestUrl,
} = require('./outbound-http-boundary');

function decodeDuckDuckGoResultUrl(href) {
  const match = String(href || '').match(/uddg=([^&]+)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

function isSafeResolvedArticleUrl(url) {
  if (!url) return false;
  if (url.includes('google.com') || url.includes('youtube.com') || url.includes('wikipedia')) {
    return false;
  }
  return validateEnrichmentRequestUrl(url).ok;
}

async function fetchSearchHtml(url, { timeout, maxBytes, maxRedirects, transport }) {
  const response = await readEnrichmentHttpText(url, {
    timeout,
    maxBytes,
    maxRedirects,
    transport,
  });
  return response.ok ? response.body : '';
}

async function resolveOriginalUrl(
  title,
  { timeout = 8000, maxBytes, maxRedirects, transport } = {}
) {
  const cleanTitle = title.replace(/\s*-\s*[^-]+$/, '').trim();

  try {
    const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanTitle)}`;
    const html = await fetchSearchHtml(ddgUrl, { timeout, maxBytes, maxRedirects, transport });
    const $ = cheerio.load(html);
    const href = $('.result__a').first().attr('href') || '';
    const url = decodeDuckDuckGoResultUrl(href);
    if (isSafeResolvedArticleUrl(url)) return url;
  } catch {}

  try {
    const shortTitle = cleanTitle.split(' ').slice(0, 8).join(' ');
    const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(shortTitle + ' 뉴스')}`;
    const html = await fetchSearchHtml(ddgUrl, { timeout, maxBytes, maxRedirects, transport });
    const $ = cheerio.load(html);
    let foundUrl = null;
    $('.result__a').slice(0, 3).each((i, el) => {
      const href = $(el).attr('href') || '';
      if (!foundUrl) {
        const url = decodeDuckDuckGoResultUrl(href);
        if (isSafeResolvedArticleUrl(url)) foundUrl = url;
      }
    });
    if (foundUrl) return foundUrl;
  } catch {}

  return null;
}

module.exports = { resolveOriginalUrl };
