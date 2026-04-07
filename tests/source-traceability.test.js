const test = require('node:test');
const assert = require('node:assert/strict');

const danfoss = require('../profiles/danfoss');
const { enrichArticles } = require('../enricher/article-enricher');
const { qualifyLeads } = require('../lead-qualifier');
const { prepareLeadSnapshotRecords, normalizePublicationSources } = require('../lead-report-publisher');

test('enrichArticles keeps the resolved direct article URL for Google News items', async () => {
  const discoveryUrl = 'https://news.google.com/rss/articles/CBMiQ2h0dHBzOi8vbmV3cy5nb29nbGUuY29tL2FydGljbGUvMDHSAQA';
  const articles = [
    {
      title: 'DL이앤씨, 데이터센터 영토 확장 가속 - 딜사이트',
      link: discoveryUrl,
      source: '딜사이트',
      query: '데이터센터 신축 착공',
      content: '',
    }
  ];
  const fetchedUrls = [];

  await enrichArticles(articles, {
    batchSize: 1,
    delayMs: 0,
    urlResolver: async () => 'https://www.example.com/article/dl-data-center#section',
    contentFetcher: async (url) => {
      fetchedUrls.push(url);
      return 'resolved article body that is definitely longer than fifty characters for regression coverage.';
    }
  });

  assert.equal(articles[0].link, 'https://www.example.com/article/dl-data-center#section');
  assert.equal(articles[0].originalLink, discoveryUrl);
  assert.equal(articles[0].resolvedUrl, true);
  assert.deepEqual(fetchedUrls, ['https://www.example.com/article/dl-data-center#section']);
});

test('enrichArticles keeps the discovery URL when Google News resolution fails', async () => {
  const discoveryUrl = 'https://news.google.com/rss/articles/CBMiQ2h0dHBzOi8vbmV3cy5nb29nbGUuY29tL2FydGljbGUvMDLSAQA';
  const articles = [
    {
      title: '부평 청천동 데이터센터 2단계 착공 - 인천투데이',
      link: discoveryUrl,
      source: '인천투데이',
      query: '데이터센터 신축 착공',
      content: '',
    }
  ];
  const fetchedUrls = [];

  await enrichArticles(articles, {
    batchSize: 1,
    delayMs: 0,
    urlResolver: async () => null,
    contentFetcher: async (url) => {
      fetchedUrls.push(url);
      return '';
    }
  });

  assert.equal(articles[0].link, discoveryUrl);
  assert.equal(articles[0].originalLink, discoveryUrl);
  assert.equal(articles[0].resolvedUrl, false);
  assert.deepEqual(fetchedUrls, [discoveryUrl]);
  assert.ok(!/search\.naver\.com/i.test(articles[0].link));
});

test('qualifyLeads maps sourceIds back to canonical article traces', async () => {
  const articles = [
    {
      title: 'DL이앤씨, 데이터센터 영토 확장 가속',
      link: 'https://www.example.com/article/dl-data-center',
      originalLink: 'https://news.google.com/rss/articles/CBMiQ2h0dHBzOi8vbmV3cy5nb29nbGUuY29tL2FydGljbGUvMQ',
      source: '딜사이트',
      query: '데이터센터 신축 착공',
      pubDate: 'Tue, 07 Apr 2026 09:00:00 GMT',
      content: '데이터센터 냉각 인프라 증설과 관련된 본문 요약입니다.',
      resolvedUrl: true,
    }
  ];

  const llm = {
    async chatJSON() {
      return [
        {
          company: 'DL이앤씨',
          summary: '데이터센터 영토 확장 가속',
          product: 'Turbocor 컴프레서',
          score: 84,
          grade: 'A',
          roi: '냉각 전력 35% 절감',
          salesPitch: 'DL이앤씨 데이터센터에 Turbocor를 제안합니다.',
          globalContext: 'EU 데이터센터 에너지효율 지침',
          sourceIds: ['A1'],
          sources: [{ title: '임의의 잘못된 제목', url: 'https://invalid.example.com/wrong' }]
        }
      ];
    }
  };

  const leads = await qualifyLeads(articles, danfoss, { llm });

  assert.equal(leads.length, 1);
  assert.deepEqual(leads[0].sourceIds, ['A1']);
  assert.deepEqual(leads[0].sources, [
    {
      sourceId: 'A1',
      title: 'DL이앤씨, 데이터센터 영토 확장 가속',
      url: 'https://www.example.com/article/dl-data-center',
      source: '딜사이트',
      query: '데이터센터 신축 착공',
      publishedAt: 'Tue, 07 Apr 2026 09:00:00 GMT',
      originUrl: 'https://news.google.com/rss/articles/CBMiQ2h0dHBzOi8vbmV3cy5nb29nbGUuY29tL2FydGljbGUvMQ',
      resolution: 'resolved',
      contentAvailable: true
    }
  ]);
});

test('qualifyLeads falls back to source title/url matching and dedupes canonical traces', async () => {
  const discoveryUrl = 'https://news.google.com/rss/articles/CBMiQ2h0dHBzOi8vbmV3cy5nb29nbGUuY29tL2FydGljbGUvMg';
  const articles = [
    {
      title: '부평 청천동 데이터센터 2단계 착공',
      link: discoveryUrl,
      originalLink: discoveryUrl,
      source: '인천투데이',
      query: '데이터센터 신축 착공',
      pubDate: 'Tue, 07 Apr 2026 10:00:00 GMT',
      content: '',
      resolvedUrl: false,
    }
  ];

  const llm = {
    async chatJSON() {
      return [
        {
          company: '부평 청천동',
          summary: '데이터센터 2단계 착공',
          product: 'Turbocor 컴프레서',
          score: 80,
          grade: 'A',
          roi: '정량 데이터 부족 — 유사 사례 기준 절감률 30~35% 예상',
          salesPitch: '부평 청천동 데이터센터에 냉각 효율 개선을 제안합니다.',
          globalContext: 'EU 데이터센터 에너지효율 지침',
          sources: [
            { title: '부평 청천동 데이터센터 2단계 착공', url: discoveryUrl },
            { title: '부평 청천동 데이터센터 2단계 착공', url: 'https://search.naver.com/search.naver?where=news&query=%EB%B6%80%ED%8F%89%20%EC%B2%AD%EC%B2%9C%EB%8F%99%20%EB%8D%B0%EC%9D%B4%ED%84%B0%EC%84%BC%ED%84%B0' }
          ]
        }
      ];
    }
  };

  const leads = await qualifyLeads(articles, danfoss, { llm });

  assert.equal(leads.length, 1);
  assert.equal(leads[0].sources.length, 1);
  assert.deepEqual(leads[0].sources[0], {
    sourceId: 'A1',
    title: '부평 청천동 데이터센터 2단계 착공',
    url: discoveryUrl,
    source: '인천투데이',
    query: '데이터센터 신축 착공',
    publishedAt: 'Tue, 07 Apr 2026 10:00:00 GMT',
    originUrl: discoveryUrl,
    resolution: 'unresolved',
    contentAvailable: false
  });
});

test('prepareLeadSnapshotRecords preserves enriched source trace metadata', () => {
  const now = '2026-04-07T12:34:56.000Z';
  const records = prepareLeadSnapshotRecords([
    {
      company: 'DL이앤씨',
      summary: '데이터센터 영토 확장 가속',
      sources: [
        {
          sourceId: 'A1',
          title: 'DL이앤씨, 데이터센터 영토 확장 가속',
          url: 'https://www.example.com/article/dl-data-center',
          source: '딜사이트',
          query: '데이터센터 신축 착공',
          publishedAt: 'Tue, 07 Apr 2026 09:00:00 GMT',
          originUrl: 'https://news.google.com/rss/articles/CBMiQ2h0dHBzOi8vbmV3cy5nb29nbGUuY29tL2FydGljbGUvMQ',
          resolution: 'resolved',
          contentAvailable: true
        }
      ]
    }
  ], {
    now,
    idFactory: () => 'lead_trace_1'
  });

  assert.deepEqual(records, [
    {
      id: 'lead_trace_1',
      status: 'NEW',
      createdAt: now,
      updatedAt: now,
      company: 'DL이앤씨',
      summary: '데이터센터 영토 확장 가속',
      sources: [
        {
          sourceId: 'A1',
          title: 'DL이앤씨, 데이터센터 영토 확장 가속',
          url: 'https://www.example.com/article/dl-data-center',
          source: '딜사이트',
          query: '데이터센터 신축 착공',
          publishedAt: 'Tue, 07 Apr 2026 09:00:00 GMT',
          originUrl: 'https://news.google.com/rss/articles/CBMiQ2h0dHBzOi8vbmV3cy5nb29nbGUuY29tL2FydGljbGUvMQ',
          resolution: 'resolved',
          contentAvailable: true
        }
      ]
    }
  ]);
});

test('normalizePublicationSources preserves unresolved discovery provenance', () => {
  const discoveryUrl = 'https://news.google.com/rss/articles/CBMiQ2h0dHBzOi8vbmV3cy5nb29nbGUuY29tL2FydGljbGUvMw#fragment';
  assert.deepEqual(normalizePublicationSources([
    {
      sourceId: 'A1',
      title: '부평 청천동 데이터센터 2단계 착공',
      url: discoveryUrl,
      source: '인천투데이',
      query: '데이터센터 신축 착공',
      publishedAt: 'Tue, 07 Apr 2026 10:00:00 GMT',
      originUrl: discoveryUrl,
      resolution: 'unresolved',
      contentAvailable: false,
    }
  ]), [
    {
      sourceId: 'A1',
      title: '부평 청천동 데이터센터 2단계 착공',
      url: 'https://news.google.com/rss/articles/CBMiQ2h0dHBzOi8vbmV3cy5nb29nbGUuY29tL2FydGljbGUvMw',
      source: '인천투데이',
      query: '데이터센터 신축 착공',
      publishedAt: 'Tue, 07 Apr 2026 10:00:00 GMT',
      originUrl: 'https://news.google.com/rss/articles/CBMiQ2h0dHBzOi8vbmV3cy5nb29nbGUuY29tL2FydGljbGUvMw',
      resolution: 'unresolved',
      contentAvailable: false,
    }
  ]);
});
