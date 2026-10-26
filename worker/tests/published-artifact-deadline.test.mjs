import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import worker from '../index.js';
import { fetchLeads, fetchHistory } from '../api/leads.js';
import { fetchManifestSelectedArtifactJson } from '../lib/manifest-published-artifact.js';
import { readBoundedResponseBytes } from '../lib/published-artifact-json.js';
import { FakeD1Database } from './helpers/fake-d1.mjs';
import { jsonFixtureResponse, withMockedFetch } from './helpers/http.mjs';

const TIMEOUT_CODE = 'ERR_PUBLISHED_ARTIFACT_TIMEOUT';
const ENV = { GITHUB_REPO: 'fixture/repo' };
const PROFILE = 'danfoss';
const PUBLICATION_ID = `pub-${'a'.repeat(32)}`;
const NOW = Date.parse('2026-10-26T01:00:00.000Z');
const LEADS = [{
  id: 'deadline-fixture', profileId: PROFILE, company: 'SYNTHETIC COMPANY',
  summary: 'Synthetic deadline fixture', product: 'Synthetic drive',
  score: 80, grade: 'A', status: 'NEW', reviewStatus: 'NEEDS_REVIEW',
  generationMode: 'llm', verificationStatus: 'needs_review', confidence: 'LOW',
  assumptions: [], dataGaps: [], sources: [],
  createdAt: '2026-10-25T00:00:00.000Z', updatedAt: '2026-10-25T00:00:00.000Z',
}];

function manifestFixture(payload = '[]') {
  const describe = (kind, canonicalPath, content) => ({
    kind, canonicalPath, path: `publications/${PUBLICATION_ID}/${canonicalPath}`,
    sha256: createHash('sha256').update(content).digest('hex'),
    bytes: Buffer.byteLength(content), ...(kind === 'report' ? {} : { records: 0 }),
  });
  return {
    schemaVersion: 2, renderVersion: 1, profileId: PROFILE, runId: 'synthetic-deadline',
    publicationId: PUBLICATION_ID, previousPublicationId: null,
    previousManifestSchemaVersion: null, inputDigest: 'b'.repeat(64),
    generatedAt: '2026-10-25T00:00:00.000Z', reportDate: '2026-10-25',
    counts: { leads: 0, history: 0, artifacts: 3 },
    artifacts: {
      report: describe('report', 'lead-report-2026-10-25.md', '# Report'),
      latest: describe('latest', 'latest-leads.json', payload),
      history: describe('history', 'lead-history.json', payload),
    },
  };
}

function track(promise) {
  const result = { status: 'pending' };
  promise.then(
    (value) => Object.assign(result, { status: 'fulfilled', value }),
    (error) => Object.assign(result, { status: 'rejected', error }),
  );
  return result;
}

// Drain only promise work: the fake clock advances explicitly at each I/O stage.
async function flush() {
  for (let index = 0; index < 80; index += 1) await Promise.resolve();
}

function clock(t) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: NOW });
}

function load(options = {}, env = ENV) {
  return fetchManifestSelectedArtifactJson(env, PROFILE, 'latest', 'latest-leads.json', {
    maxTopLevelEntries: 90, ...options,
  });
}

function assertTimeout(result) {
  assert.equal(result.status, 'rejected', 'stalled I/O must settle at the total deadline');
  assert.equal(result.error.code, TIMEOUT_CODE);
  assert.equal(result.error.staleFallbackEligible, true);
}

test('default deadline aborts stalled manifest headers after ten seconds', async (t) => {
  clock(t);
  let signal;
  const handler = (_input, options) => {
    signal = options.signal;
    return new Promise(() => {});
  };
  handler.publicationManifestAware = true;
  await withMockedFetch(handler, async () => {
    const result = track(load());
    await flush();
    t.mock.timers.tick(9_999);
    await flush();
    assert.equal(result.status, 'pending');
    t.mock.timers.tick(1);
    await flush();
    assertTimeout(result);
    assert.equal(signal.aborted, true);
  });
});

for (const stage of ['manifest', 'selected', 'legacy']) {
  test(`${stage} body timeout cancels the stream even when cancellation never settles`, async (t) => {
    clock(t);
    let cancellations = 0;
    let signal;
    const body = new ReadableStream({ cancel() { cancellations += 1; return new Promise(() => {}); } });
    const handler = (input, options) => {
      signal = options.signal;
      const manifest = String(input).includes('/publication-manifest.json');
      if (manifest && stage === 'legacy') return new Response(null, { status: 404 });
      if (manifest && stage === 'selected') return jsonFixtureResponse(manifestFixture());
      return new Response(body);
    };
    handler.publicationManifestAware = true;
    await withMockedFetch(handler, async () => {
      const result = track(load({ timeoutMs: 100 }));
      await flush();
      t.mock.timers.tick(100);
      await flush();
      assertTimeout(result);
      assert.equal(signal.aborted, true);
      assert.equal(cancellations, 1);
      assert.equal(body.locked, false);
    });
  });
}

for (const legacy of [false, true]) {
  test(`${legacy ? 'legacy' : 'selected'} artifact header stall receives only the remaining budget`, async (t) => {
    clock(t);
    let resolveManifest;
    const signals = [];
    const handler = (input, options) => {
      signals.push(options.signal);
      if (String(input).includes('/publication-manifest.json')) {
        return new Promise((resolve) => { resolveManifest = resolve; });
      }
      return new Promise(() => {});
    };
    handler.publicationManifestAware = true;
    await withMockedFetch(handler, async () => {
      const result = track(load({ timeoutMs: 100 }));
      await flush();
      t.mock.timers.tick(75);
      resolveManifest(legacy ? new Response(null, { status: 404 }) : jsonFixtureResponse(manifestFixture()));
      await flush();
      assert.equal(signals.length, 2);
      t.mock.timers.tick(25);
      await flush();
      assertTimeout(result);
      assert.equal(signals[0], signals[1]);
      assert.equal(signals[1].aborted, true);
    });
  });

  test(`${legacy ? 'legacy' : 'selected'} artifact shares the manifest's elapsed header/body budget`, async (t) => {
    clock(t);
    let resolveManifestHeaders;
    let manifestBody;
    let resolveArtifactHeaders;
    let artifactBody;
    const signals = [];
    const handler = (input, options) => {
      signals.push(options.signal);
      if (String(input).includes('/publication-manifest.json')) {
        return new Promise((resolve) => { resolveManifestHeaders = resolve; });
      }
      return new Promise((resolve) => { resolveArtifactHeaders = resolve; });
    };
    handler.publicationManifestAware = true;
    await withMockedFetch(handler, async () => {
      const result = track(load({ timeoutMs: 100 }));
      await flush();
      t.mock.timers.tick(25);
      resolveManifestHeaders(legacy ? new Response(null, { status: 404 }) : new Response(new ReadableStream({
        start(controller) { manifestBody = controller; },
      })));
      await flush();
      t.mock.timers.tick(25);
      if (!legacy) {
        manifestBody.enqueue(new TextEncoder().encode(JSON.stringify(manifestFixture())));
        manifestBody.close();
      }
      await flush();
      assert.equal(typeof resolveArtifactHeaders, 'function');
      t.mock.timers.tick(25);
      resolveArtifactHeaders(new Response(new ReadableStream({ start(controller) { artifactBody = controller; } })));
      await flush();
      artifactBody.enqueue(new TextEncoder().encode('['));
      t.mock.timers.tick(24);
      await flush();
      assert.equal(result.status, 'pending');
      t.mock.timers.tick(1);
      await flush();
      assertTimeout(result);
      assert.equal(signals.length, 2);
      assert.equal(signals[0], signals[1], 'both fetches must share one cancellation signal');
      assert.equal(signals[0].aborted, true);
    });
  });
}

test('standalone body reader has a deadline and never awaits failed-body cancellation', async (t) => {
  clock(t);
  const stalled = new ReadableStream({ cancel: () => Promise.reject(new Error('synthetic cancel failure')) });
  const result = track(readBoundedResponseBytes(new Response(stalled), { timeoutMs: 10 }));
  await flush();
  t.mock.timers.tick(10);
  await flush();
  assertTimeout(result);
  assert.equal(stalled.locked, false);

  const oversized = new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(2)); },
    cancel() { return new Promise(() => {}); },
  });
  const tooLarge = track(readBoundedResponseBytes(new Response(oversized), { maxBytes: 1 }));
  await flush();
  assert.equal(tooLarge.status, 'rejected');
  assert.equal(tooLarge.error.code, 'ERR_PUBLISHED_ARTIFACT_REMOTE_BYTES');
  assert.equal(oversized.locked, false);
});

test('deadline cancels a late fetch response and consumes late fetch/cancel rejections', async (t) => {
  clock(t);
  for (const outcome of ['resolve', 'reject']) {
    let finish;
    let cancellations = 0;
    const handler = () => new Promise((resolve, reject) => { finish = outcome === 'resolve' ? resolve : reject; });
    handler.publicationManifestAware = true;
    await withMockedFetch(handler, async () => {
      const result = track(load({ timeoutMs: 10 }));
      await flush();
      t.mock.timers.tick(10);
      await flush();
      assertTimeout(result);
      finish(outcome === 'reject' ? new Error('late upstream failure') : new Response(new ReadableStream({
        cancel() { cancellations += 1; return Promise.reject(new Error('late cancel failure')); },
      })));
      await flush();
      assert.equal(cancellations, outcome === 'resolve' ? 1 : 0);
    });
  }
});

test('invalid timeout configuration fails closed before fetch and cannot use stale cache', async () => {
  for (const timeout of [0, -1, 10_001, Infinity, NaN, null, false, '', '0', '1e3', {}, 1.5]) {
    let calls = 0;
    const handler = () => { calls += 1; return jsonFixtureResponse([]); };
    handler.publicationManifestAware = true;
    await withMockedFetch(handler, async () => {
      await assert.rejects(load({ timeoutMs: timeout }), (error) => (
        error.code === 'ERR_PUBLISHED_ARTIFACT_TIMEOUT_CONFIG' && error.staleFallbackEligible === false
      ));
      const db = new FakeD1Database({ publishedSnapshots: [{
        profileId: PROFILE, artifactKind: 'latest', leads: LEADS,
        fetchedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      }] });
      const response = await fetchLeads({ ...ENV, DB: db, PUBLISHED_ARTIFACT_TIMEOUT_MS: timeout }, PROFILE);
      assert.equal(response.status, 500);
      assert.equal(db.batches.length, 0);
      assert.equal(calls, 0);
    });
  }
});

test('timed-out routes use only bounded same-kind stale cache and never write D1', async (t) => {
  clock(t);
  const cases = [
    { kind: 'latest', age: 60 * 60 * 1000, status: 200 },
    { kind: 'history', age: 60 * 60 * 1000, status: 200 },
    { kind: 'latest', age: 25 * 60 * 60 * 1000, status: 500 },
    { kind: 'latest', age: -60 * 60 * 1000, status: 500 },
    { kind: 'latest', storedKind: 'history', age: 60 * 60 * 1000, status: 500 },
    { kind: 'latest', missing: true, status: 500 },
  ];
  for (const fixture of cases) {
    const db = new FakeD1Database({ publishedSnapshots: fixture.missing ? [] : [{
      profileId: PROFILE, artifactKind: fixture.storedKind || fixture.kind, leads: LEADS,
      fetchedAt: new Date(Date.now() - fixture.age).toISOString(),
    }] });
    const handler = () => new Promise(() => {});
    handler.publicationManifestAware = true;
    await withMockedFetch(handler, async () => {
      const env = { ...ENV, DB: db, PUBLISHED_ARTIFACT_TIMEOUT_MS: '20' };
      const result = track((fixture.kind === 'history' ? fetchHistory : fetchLeads)(env, PROFILE));
      await flush();
      t.mock.timers.tick(20);
      await flush();
      assert.equal(result.status, 'fulfilled');
      assert.equal(result.value.status, fixture.status);
      const body = await result.value.json();
      if (fixture.status === 200) {
        assert.equal(body.snapshotStale, true);
        assert.equal(body.source, 'd1');
        assert.equal((fixture.kind === 'history' ? body.history : body.leads)[0].id, 'deadline-fixture');
      }
      assert.equal(db.batches.length, 0);
    });
  }
});

test('internal latest-published route returns readiness_unavailable after default header timeout', async (t) => {
  clock(t);
  const handler = () => new Promise(() => {});
  handler.publicationManifestAware = true;
  await withMockedFetch(handler, async () => {
    const result = track(worker.fetch(new Request(
      `https://worker-fixture.example/api/internal/profiles/${PROFILE}/latest-published`,
      { headers: { Authorization: 'Bearer synthetic-token' } },
    ), {
      ...ENV, INTERNAL_API_TOKEN: 'synthetic-token', PROFILES: JSON.stringify([{ id: PROFILE, name: 'Fixture' }]),
    }, {}));
    await flush();
    t.mock.timers.tick(10_000);
    await flush();
    assert.equal(result.status, 'fulfilled');
    assert.equal(result.value.status, 503);
    const body = await result.value.json();
    assert.equal(body.syncReady, false);
    assert.equal(body.error.code, 'readiness_unavailable');
  });
});

test('present invalid manifest still refuses the legacy mirror without waiting for the deadline', async () => {
  let calls = 0;
  const handler = () => { calls += 1; return jsonFixtureResponse({ invalid: true }); };
  handler.publicationManifestAware = true;
  await withMockedFetch(handler, async () => {
    await assert.rejects(load({ timeoutMs: 100 }), { code: 'ERR_PUBLISHED_MANIFEST_INVALID' });
    assert.equal(calls, 1);
  });
});

test('successful reads clear the deadline and release stream locks', async (t) => {
  clock(t);
  const responses = [];
  const signals = [];
  const handler = (input, options) => {
    signals.push(options.signal);
    const response = String(input).includes('/publication-manifest.json')
      ? jsonFixtureResponse(manifestFixture())
      : jsonFixtureResponse([]);
    responses.push(response);
    return response;
  };
  handler.publicationManifestAware = true;
  await withMockedFetch(handler, async () => {
    const selected = await load();
    assert.deepEqual(selected.payload, []);
    assert.equal(selected.manifest.publicationId, PUBLICATION_ID);
    t.mock.timers.tick(10_000);
    await flush();
    assert.equal(signals.every((signal) => signal.aborted === false), true);
    assert.equal(responses.every((response) => response.body.locked === false), true);
  });
});
