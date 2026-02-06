const Parser = require('rss-parser');
const axios = require('axios');
const cheerio = require('cheerio');
const config = require('./config');
const { withRetry } = require('./lib/http');

const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  },
  timeout: 10000
});

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// 텍스트 유사도 계산 (중복 제거용)
function calculateSimilarity(str1, str2) {
  const words1 = str1.toLowerCase().split(/\s+/);
  const words2 = str2.toLowerCase().split(/\s+/);
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  const intersection = [...set1].filter(x => set2.has(x));
  const union = new Set([...set1, ...set2]);
  return intersection.length / union.size;
}

// 중복 뉴스 제거
function removeDuplicates(articles) {
  const unique = [];
  for (const article of articles) {
    const isDuplicate = unique.some(
      existing => calculateSimilarity(existing.title, article.title) > 0.6
    );
    if (!isDuplicate) {
      unique.push(article);
    }
  }
  return unique;
}

// Google News 기사의 원본 URL 추출 (다중 검색 엔진)
async function resolveOriginalUrl(title) {
  // 제목에서 " - 출처명" 제거
  const cleanTitle = title.replace(/\s*-\s*[^-]+$/, '').trim();

  // 1차: DuckDuckGo 검색
  try {
    const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanTitle)}`;
    const res = await withRetry(() => axios.get(ddgUrl, {
      headers: { 'User-Agent': UA },
      timeout: 8000
    }), { label: 'DDG-resolve' });
    const $ = cheerio.load(res.data);
    const firstResult = $('.result__a').first().attr('href') || '';
    const match = firstResult.match(/uddg=([^&]+)/);
    if (match) {
      const url = decodeURIComponent(match[1]);
      if (!url.includes('google.com')) return url;
    }
  } catch (e) {}

  // 2차: 제목 앞부분만으로 재검색
  try {
    const shortTitle = cleanTitle.split(' ').slice(0, 8).join(' ');
    const ddgUrl2 = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(shortTitle + ' 뉴스')}`;
    const res = await axios.get(ddgUrl2, {
      headers: { 'User-Agent': UA },
      timeout: 8000
    });
    const $ = cheerio.load(res.data);

    // 상위 3개 결과 중 뉴스 사이트 URL 찾기
    let foundUrl = null;
    $('.result__a').slice(0, 3).each((i, el) => {
      const href = $(el).attr('href') || '';
      const match = href.match(/uddg=([^&]+)/);
      if (match && !foundUrl) {
        const url = decodeURIComponent(match[1]);
        // 뉴스 사이트 도메인 확인
        if (!url.includes('google.com') && !url.includes('youtube.com') && !url.includes('wikipedia')) {
          foundUrl = url;
        }
      }
    });
    if (foundUrl) return foundUrl;
  } catch (e) {}

  return null;
}

// 기사 본문 크롤링
async function fetchArticleContent(url) {
  if (!url || url.includes('news.google.com')) return '';
  try {
    const res = await withRetry(() => axios.get(url, {
      headers: { 'User-Agent': UA },
      timeout: 8000
    }), { label: 'article-fetch' });
    const $ = cheerio.load(res.data);

    // 1. 본문 셀렉터들 시도 (가장 긴 텍스트 선택)
    let content = '';
    const selectors = [
      '.article_body', '#articleBody', '#newsEndContents', '.article-body',
      '.article_content', '.view_cont', '.newsct_article', '#articeBody',
      '.news_body', '#news_body_area', '.article_txt', '#article-view-content-div',
      '.story_area', '.news_view', '.article_view'
    ];
    for (const sel of selectors) {
      const text = $(sel).text().trim().replace(/\s+/g, ' ');
      if (text.length > content.length) {
        content = text;
      }
    }

    // 2. og:description (본문이 짧으면 보완)
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

    return content.substring(0, 1500);
  } catch (e) {
    return '';
  }
}

// Google News RSS 검색
async function fetchGoogleNews(query) {
  const encodedQuery = encodeURIComponent(query);
  const url = `https://news.google.com/rss/search?q=${encodedQuery}&hl=ko&gl=KR&ceid=KR:ko`;

  try {
    const feed = await withRetry(() => parser.parseURL(url), { label: `GoogleNews:${query}` });
    return feed.items.slice(0, 3).map(item => ({
      title: item.title || '',
      link: item.link || '',
      source: item.creator || item.source?.name || 'Google News',
      pubDate: item.pubDate || '',
      query: query
    }));
  } catch (error) {
    console.error(`  [오류] "${query}" 검색 실패: ${error.message}`);
    return [];
  }
}

// 한국경제 산업 RSS
async function fetchHankyung() {
  const url = 'https://www.hankyung.com/feed/economy';
  try {
    const feed = await withRetry(() => parser.parseURL(url), { label: 'Hankyung' });
    return feed.items.slice(0, 5).map(item => ({
      title: item.title || '',
      link: item.link || '',
      source: '한국경제',
      pubDate: item.pubDate || '',
      query: '산업뉴스'
    }));
  } catch (error) {
    console.error('  [오류] 한국경제 RSS 실패:', error.message);
    return [];
  }
}

// 연합뉴스 경제 RSS
async function fetchYonhapEconomy() {
  const url = 'https://www.yna.co.kr/rss/economy.xml';
  try {
    const feed = await withRetry(() => parser.parseURL(url), { label: 'Yonhap' });
    return feed.items.slice(0, 5).map(item => ({
      title: item.title || '',
      link: item.link || '',
      source: '연합뉴스',
      pubDate: item.pubDate || '',
      query: '경제뉴스'
    }));
  } catch (error) {
    console.error('  [오류] 연합뉴스 RSS 실패:', error.message);
    return [];
  }
}

// Google News 배치 병렬 fetch (2개씩)
async function fetchAllGoogleNews(queries) {
  const results = [];
  for (let i = 0; i < queries.length; i += 2) {
    const batch = queries.slice(i, i + 2);
    console.log(`  검색 배치 ${Math.floor(i / 2) + 1}: ${batch.map(q => `"${q}"`).join(', ')}`);
    const settled = await Promise.allSettled(batch.map(q => fetchGoogleNews(q)));
    for (const r of settled) {
      if (r.status === 'fulfilled') results.push(...r.value);
      else console.warn('  [경고] Google News fetch 실패:', r.reason?.message);
    }
    if (i + 2 < queries.length) await new Promise(r => setTimeout(r, 300));
  }
  return results;
}

// 기사 본문 배치 병렬 크롤링 (3개씩)
async function fetchArticlesBatch(articles) {
  for (let i = 0; i < articles.length; i += 3) {
    const batch = articles.slice(i, i + 3);
    await Promise.allSettled(batch.map(async (article) => {
      // Google News URL인 경우 원본 URL 추출
      if (article.link.includes('news.google.com')) {
        const originalUrl = await resolveOriginalUrl(article.title);
        if (originalUrl) {
          article.link = originalUrl;
          article.resolvedUrl = true;
        } else {
          const searchQuery = article.title.replace(/\s*-\s*[^-]+$/, '').trim();
          article.link = `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(searchQuery)}`;
          article.resolvedUrl = false;
          article.originalGoogleUrl = true;
        }
      }
      // 본문 크롤링
      article.content = await fetchArticleContent(article.link);
      const status = article.content ? `✓ ${article.content.length}자` : '✗ 제목만';
      console.log(`    ${article.title.substring(0, 40)}... ${status}`);
    }));
    if (i + 3 < articles.length) await new Promise(r => setTimeout(r, 300));
  }
}

// 메인 수집 함수
async function fetchIndustryNews() {
  console.log('\n[Step 1] 산업 뉴스 수집 시작...');

  // Phase 1: RSS 소스 3종 병렬
  console.log('  RSS 소스 병렬 수집...');
  const settled = await Promise.allSettled([
    fetchAllGoogleNews(config.searchQueries),
    fetchHankyung(),
    fetchYonhapEconomy()
  ]);

  let allArticles = [];
  const labels = ['Google News', '한국경제', '연합뉴스'];
  for (let i = 0; i < settled.length; i++) {
    if (settled[i].status === 'fulfilled') {
      allArticles = allArticles.concat(settled[i].value);
      console.log(`  ${labels[i]}: ${settled[i].value.length}건`);
    } else {
      console.warn(`  [경고] ${labels[i]} 실패: ${settled[i].reason?.message}`);
    }
  }

  // 중복 제거
  const uniqueArticles = removeDuplicates(allArticles);
  console.log(`  수집 완료: 총 ${allArticles.length}개 → 중복 제거 후 ${uniqueArticles.length}개`);

  // Phase 2: 본문 크롤링 (3개씩 배치 병렬)
  console.log('  기사 본문 수집 중...');
  await fetchArticlesBatch(uniqueArticles);

  console.log('  본문 수집 완료\n');
  return uniqueArticles;
}

module.exports = { fetchIndustryNews };
