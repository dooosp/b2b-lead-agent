const test = require('node:test');
const assert = require('node:assert/strict');
const { createRun } = require('../lib/obs');
const { withRetry: sharedWithRetry } = require('../lib/http');
const { withRetry: newsFetcherWithRetry } = require('../lib/news-fetcher/utils/retry');

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
