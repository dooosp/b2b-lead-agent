import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

import worker from '../index.js';
import { getServiceWorkerJS } from '../pages/pwa.js';
import { FakeD1Database } from './helpers/fake-d1.mjs';
import { createLeadRow, createWorkerEnv } from './helpers/fixtures.mjs';
import { createWorkerRequest } from './helpers/http.mjs';

const SYNTHETIC_API_TOKEN = 'synthetic-reviewer-cache-token';
const REVIEWER_ROLE_HEADER = 'X-Manual-Review-Notes-Local-Test-Role';
const PROTECTED_PATH = '/leads/lead-cache-characterization';
const PROTECTED_URL = `https://b2b-lead-trigger.example.workers.dev${PROTECTED_PATH}`;
const CURRENT_CACHE_NAME = 'b2b-leads-static-v2';
const LEGACY_CACHE_NAME = 'b2b-leads-v1';
const PROTECTED_NOTE = 'Synthetic reviewer-only cache characterization note.';

function cacheKey(request) {
  const normalized = request instanceof Request ? request : new Request(request);
  return `${normalized.method} ${normalized.url}`;
}

function varyMatches(storedRequest, response, incomingRequest) {
  const vary = response.headers.get('Vary');
  if (!vary) return true;
  if (vary.trim() === '*') return false;
  return vary.split(',').every((name) => {
    const header = name.trim();
    return storedRequest.headers.get(header) === incomingRequest.headers.get(header);
  });
}

function createServiceWorkerHarness({ initialCaches = {} } = {}) {
  const listeners = new Map();
  const stores = new Map();
  const deletedCaches = [];
  const fetchCalls = [];
  const putCalls = [];
  let fetchImplementation = async () => {
    throw new Error('No synthetic fetch implementation configured.');
  };

  function putSeed(cacheName, request, response) {
    if (!stores.has(cacheName)) stores.set(cacheName, new Map());
    const normalizedRequest = request instanceof Request ? request : new Request(request);
    stores.get(cacheName).set(cacheKey(normalizedRequest), {
      request: normalizedRequest,
      response: response.clone(),
    });
  }

  for (const [cacheName, entries] of Object.entries(initialCaches)) {
    for (const [request, response] of entries) putSeed(cacheName, request, response);
  }

  function cacheApi(cacheName) {
    if (!stores.has(cacheName)) stores.set(cacheName, new Map());
    const store = stores.get(cacheName);
    return {
      async addAll(requests) {
        for (const request of requests) {
          const normalizedRequest = new Request(new URL(request, PROTECTED_URL), { method: 'GET' });
          const response = await fetchImplementation(normalizedRequest);
          await this.put(normalizedRequest, response);
        }
      },
      async put(request, response) {
        const normalizedRequest = request instanceof Request ? request : new Request(request);
        store.set(cacheKey(normalizedRequest), {
          request: normalizedRequest,
          response: response.clone(),
        });
        putCalls.push({ cacheName, request: normalizedRequest, response });
      },
      async match(request) {
        const normalizedRequest = request instanceof Request ? request : new Request(request);
        const entry = store.get(cacheKey(normalizedRequest));
        if (!entry || !varyMatches(entry.request, entry.response, normalizedRequest)) return undefined;
        return entry.response.clone();
      },
    };
  }

  const caches = {
    async open(cacheName) {
      return cacheApi(cacheName);
    },
    async keys() {
      return [...stores.keys()];
    },
    async delete(cacheName) {
      deletedCaches.push(cacheName);
      return stores.delete(cacheName);
    },
    async match(request) {
      for (const cacheName of stores.keys()) {
        const match = await cacheApi(cacheName).match(request);
        if (match) return match;
      }
      return undefined;
    },
  };

  const self = {
    location: new URL(PROTECTED_URL),
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    async skipWaiting() {},
    clients: { async claim() {} },
  };

  vm.runInNewContext(getServiceWorkerJS(), {
    self,
    caches,
    fetch: (...args) => {
      fetchCalls.push(args);
      return fetchImplementation(...args);
    },
    URL,
    Request,
    Response,
    Headers,
  }, { filename: 'generated-service-worker.js' });

  return {
    deletedCaches,
    fetchCalls,
    putCalls,
    cacheNames: () => [...stores.keys()],
    setFetch(implementation) {
      fetchImplementation = implementation;
    },
    async dispatchFetch(request) {
      const listener = listeners.get('fetch');
      assert.ok(listener, 'generated service worker must register a fetch listener');
      let responsePromise;
      listener({
        request,
        respondWith(value) {
          responsePromise = Promise.resolve(value);
        },
      });
      assert.ok(responsePromise, 'fetch listener must call respondWith for protected GET requests');
      return responsePromise;
    },
    async dispatchActivate() {
      const listener = listeners.get('activate');
      assert.ok(listener, 'generated service worker must register an activate listener');
      let activationPromise;
      listener({
        waitUntil(value) {
          activationPromise = Promise.resolve(value);
        },
      });
      assert.ok(activationPromise, 'activate listener must call waitUntil');
      await activationPromise;
    },
  };
}

async function requestProtectedReviewerPage({
  path = PROTECTED_PATH,
  authenticated = true,
  role = 'reviewer',
} = {}) {
  const db = new FakeD1Database({
    leads: [createLeadRow({
      id: 'lead-cache-characterization',
      notes: PROTECTED_NOTE,
      manual_review_notes_author_label: 'manual_reviewer',
      manual_review_notes_updated_at: '2026-07-10T00:00:00.000Z',
    })],
  });
  const env = createWorkerEnv({
    API_TOKEN: SYNTHETIC_API_TOKEN,
    DB: db,
    MANUAL_REVIEW_NOTES_LOCAL_TEST_ROLE_STUB: 'enabled',
  });
  const headers = {
    ...(authenticated ? { Authorization: `Bearer ${SYNTHETIC_API_TOKEN}` } : {}),
    ...(role ? { [REVIEWER_ROLE_HEADER]: role } : {}),
  };
  return worker.fetch(createWorkerRequest(path, {
    headers,
  }), env, {});
}

test('desired contract: protected reviewer HTML sends Cache-Control private, no-store', async () => {
  const detailResponse = await requestProtectedReviewerPage();
  const listResponse = await requestProtectedReviewerPage({ path: '/leads' });
  const html = await detailResponse.text();

  assert.equal(detailResponse.status, 200);
  assert.match(detailResponse.headers.get('Content-Type') || '', /text\/html/);
  assert.match(html, new RegExp(PROTECTED_NOTE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.equal(detailResponse.headers.get('Cache-Control'), 'private, no-store');
  assert.equal(listResponse.headers.get('Cache-Control'), 'private, no-store');
});

test('desired contract: protected reviewer HTML varies on every authentication and role boundary', async () => {
  const responses = await Promise.all([
    requestProtectedReviewerPage(),
    requestProtectedReviewerPage({ role: 'manager' }),
    requestProtectedReviewerPage({ authenticated: false, role: '' }),
    requestProtectedReviewerPage({ path: '/leads' }),
  ]);

  for (const response of responses) {
    const varyHeaders = new Set((response.headers.get('Vary') || '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean));

    assert.deepEqual(
      [...varyHeaders].sort(),
      ['authorization', REVIEWER_ROLE_HEADER.toLowerCase()].sort()
    );
  }
});

test('desired contract: Service Worker never stores protected HTML responses', async () => {
  const protectedResponse = await requestProtectedReviewerPage();
  const harness = createServiceWorkerHarness();
  harness.setFetch(async () => {
    return protectedResponse.clone();
  });

  const reviewerRequest = new Request(PROTECTED_URL, {
    headers: {
      Authorization: `Bearer ${SYNTHETIC_API_TOKEN}`,
      [REVIEWER_ROLE_HEADER]: 'reviewer',
    },
  });
  const onlineResponse = await harness.dispatchFetch(reviewerRequest);
  assert.equal(onlineResponse.status, 200);
  assert.equal(harness.fetchCalls[0][1].cache, 'no-store');
  assert.equal(harness.putCalls.length, 0);
  assert.deepEqual(harness.cacheNames(), []);
});

test('desired contract: cache policy changes delete or version-invalidate deployed legacy caches', async () => {
  const protectedResponse = await requestProtectedReviewerPage();
  const reviewerRequest = new Request(PROTECTED_URL, {
    headers: {
      Authorization: `Bearer ${SYNTHETIC_API_TOKEN}`,
      [REVIEWER_ROLE_HEADER]: 'reviewer',
    },
  });
  const manifestRequest = new Request('https://b2b-lead-trigger.example.workers.dev/manifest.json');
  const harness = createServiceWorkerHarness({
    initialCaches: {
      [CURRENT_CACHE_NAME]: [[manifestRequest, new Response('{}')]],
      [LEGACY_CACHE_NAME]: [[reviewerRequest, protectedResponse]],
      'b2b-leads-v0': [[new Request('https://b2b-lead-trigger.example.workers.dev/'), new Response('legacy shell')]],
      'unrelated-cache': [[new Request('https://b2b-lead-trigger.example.workers.dev/unrelated'), new Response('unrelated')]],
    },
  });

  await harness.dispatchActivate();

  assert.deepEqual(harness.deletedCaches.sort(), ['b2b-leads-v0', LEGACY_CACHE_NAME].sort());
  assert.deepEqual(harness.cacheNames().sort(), [CURRENT_CACHE_NAME, 'unrelated-cache'].sort());
});

test('desired contract: anonymous or downgraded-role requests never receive cached reviewer content', async () => {
  const protectedResponse = await requestProtectedReviewerPage();
  const reviewerRequest = new Request(PROTECTED_URL, {
    headers: {
      Authorization: `Bearer ${SYNTHETIC_API_TOKEN}`,
      [REVIEWER_ROLE_HEADER]: 'reviewer',
    },
  });
  const harness = createServiceWorkerHarness({
    initialCaches: {
      [CURRENT_CACHE_NAME]: [[reviewerRequest, protectedResponse]],
    },
  });
  harness.setFetch(async () => {
    throw new Error('synthetic offline transition');
  });

  const downgradedRequest = new Request(PROTECTED_URL, {
    headers: { [REVIEWER_ROLE_HEADER]: 'manager' },
  });
  const anonymousRequest = new Request(PROTECTED_URL);

  await assert.rejects(() => harness.dispatchFetch(downgradedRequest), /synthetic offline transition/);
  await assert.rejects(() => harness.dispatchFetch(anonymousRequest), /synthetic offline transition/);
  assert.deepEqual(harness.fetchCalls.map(([, init]) => init.cache), ['no-store', 'no-store']);
  assert.equal(harness.putCalls.length, 0);
});
