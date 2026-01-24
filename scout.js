const Parser = require('rss-parser');
const axios = require('axios');
const config = require('./config');

const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  },
  timeout: 10000
});

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

// Google News RSS 검색
async function fetchGoogleNews(query) {
  const encodedQuery = encodeURIComponent(query);
  const url = `https://news.google.com/rss/search?q=${encodedQuery}&hl=ko&gl=KR&ceid=KR:ko`;

  try {
    const feed = await parser.parseURL(url);
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
  const url = 'https://www.hankyung.com/feed/industry';
  try {
    const feed = await parser.parseURL(url);
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
    const feed = await parser.parseURL(url);
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

// 메인 수집 함수
async function fetchIndustryNews() {
  console.log('\n[Step 1] 산업 뉴스 수집 시작...');
  let allArticles = [];

  // Google News 키워드별 검색
  for (const query of config.searchQueries) {
    console.log(`  검색: "${query}"`);
    const articles = await fetchGoogleNews(query);
    allArticles = allArticles.concat(articles);
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // 추가 소스
  console.log('  한국경제 산업 RSS 수집...');
  const hankyungArticles = await fetchHankyung();
  allArticles = allArticles.concat(hankyungArticles);

  console.log('  연합뉴스 경제 RSS 수집...');
  const yonhapArticles = await fetchYonhapEconomy();
  allArticles = allArticles.concat(yonhapArticles);

  // 중복 제거
  const uniqueArticles = removeDuplicates(allArticles);
  console.log(`  수집 완료: 총 ${allArticles.length}개 → 중복 제거 후 ${uniqueArticles.length}개\n`);

  return uniqueArticles;
}

module.exports = { fetchIndustryNews };
