const test = require('node:test');
const assert = require('node:assert/strict');
const { createRun } = require('../lib/obs');
const { withRetry: sharedWithRetry } = require('../lib/http');
const { withRetry: newsFetcherWithRetry } = require('../lib/news-fetcher/utils/retry');
const { fetchGoogleNewsBatch } = require('../lib/news-fetcher/sources/google-news');
const { fetchAllKoreanRSS } = require('../lib/news-fetcher/sources/korean-rss');
const { fetchIndustryNews } = require('../orchestrator/news-orchestrator');
const { createRootProfile } = require('./helpers/root-fixtures');

test('runtime completion is emitted only after the runtime calls summary()', () => {
  const originalLog = console.log;
  const originalError = console.error;
  const entries = [];

  console.log = (line) => entries.push(JSON.parse(line));
  console.error = (line) => entries.push(JSON.parse(line));

  try {
    const run = createRun();

    assert.equal(entries.some((entry) => entry.msg === 'run completed'), false);

    run.summary();

    const completionEntry = entries.find((entry) => entry.msg === 'run completed');
    assert.ok(completionEntry);
    assert.equal(completionEntry.stage, 'pipeline');
    assert.deepEqual(completionEntry.counters, {});
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
});

test('news fetcher retry helper reuses the shared runtime retry helper', () => {
  assert.equal(newsFetcherWithRetry, sharedWithRetry);
});

test('source batches fail when every configured source fails but preserve partial success', async () => {
  await assert.rejects(
    () => fetchGoogleNewsBatch(['one', 'two'], {
      delayMs: 0,
      async fetchImpl() { throw new Error('synthetic source failure'); },
    }),
    (error) => error.code === 'ERR_NEWS_SOURCE_UNAVAILABLE',
  );
  assert.deepEqual(await fetchGoogleNewsBatch(['one', 'two'], {
    delayMs: 0,
    async fetchImpl(query) {
      if (query === 'one') throw new Error('synthetic partial failure');
      return [{ title: 'Synthetic article' }];
    },
  }), [{ title: 'Synthetic article' }]);

  await assert.rejects(
    () => fetchAllKoreanRSS({
      async fetchImpl() { throw new Error('synthetic feed failure'); },
    }),
    (error) => error.code === 'ERR_NEWS_SOURCE_UNAVAILABLE',
  );
});

test('orchestrator distinguishes complete empty collection from source outage', async () => {
  const profile = createRootProfile({ searchQueries: ['synthetic'] });
  const options = {
    dedupe: (articles) => articles,
    async enrich() {},
  };
  const empty = await fetchIndustryNews(profile, {
    ...options,
    async googleNewsBatch() { return []; },
    async rssFeed() { return []; },
  });
  assert.deepEqual(empty, []);

  await assert.rejects(
    () => fetchIndustryNews(profile, {
      ...options,
      async googleNewsBatch() { throw new Error('synthetic outage'); },
      async rssFeed() { throw new Error('synthetic outage'); },
    }),
    (error) => error.code === 'ERR_COLLECTION_FAILED' && error.retryable === true,
  );
});
