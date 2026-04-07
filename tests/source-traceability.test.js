const test = require('node:test');
const assert = require('node:assert/strict');

const danfoss = require('../profiles/danfoss');
const { qualifyLeads } = require('../lead-qualifier');
const { prepareLeadSnapshotRecords } = require('../lead-report-publisher');

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
  const articles = [
    {
      title: '부평 청천동 데이터센터 2단계 착공',
      link: 'https://www.incheontoday.com/news/articleView.html?idxno=100',
      originalLink: 'https://news.google.com/rss/articles/CBMiQ2h0dHBzOi8vbmV3cy5nb29nbGUuY29tL2FydGljbGUvMg',
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
            { title: '부평 청천동 데이터센터 2단계 착공', url: 'https://news.google.com/rss/articles/CBMiQ2h0dHBzOi8vbmV3cy5nb29nbGUuY29tL2FydGljbGUvMg' },
            { title: '부평 청천동 데이터센터 2단계 착공', url: 'https://www.incheontoday.com/news/articleView.html?idxno=100' }
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
    url: 'https://www.incheontoday.com/news/articleView.html?idxno=100',
    source: '인천투데이',
    query: '데이터센터 신축 착공',
    publishedAt: 'Tue, 07 Apr 2026 10:00:00 GMT',
    originUrl: 'https://news.google.com/rss/articles/CBMiQ2h0dHBzOi8vbmV3cy5nb29nbGUuY29tL2FydGljbGUvMg',
    resolution: 'search-fallback',
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
