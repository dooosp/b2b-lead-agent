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
const CURRENT_CACHE_NAME = 'b2b-leads-v1';
const PROTECTED_NOTE = 'Synthetic reviewer-only cache characterization note.';

function createDeferred() {
  let resolve;
  const promise = new Promise((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

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
  const putCalls = [];
  const putObserved = createDeferred();
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
        putObserved.resolve();
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
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    async skipWaiting() {},
    clients: { async claim() {} },
  };

  vm.runInNewContext(getServiceWorkerJS(), {
    self,
    caches,
    fetch: (...args) => fetchImplementation(...args),
    URL,
    Request,
    Response,
    Headers,
  }, { filename: 'generated-service-worker.js' });

  return {
    deletedCaches,
    putCalls,
    putObserved: putObserved.promise,
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

async function requestProtectedReviewerPage() {
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
  return worker.fetch(createWorkerRequest(PROTECTED_PATH, {
    headers: {
      Authorization: `Bearer ${SYNTHETIC_API_TOKEN}`,
      [REVIEWER_ROLE_HEADER]: 'reviewer',
    },
  }), env, {});
}

test('characterization: protected reviewer HTML lacks private no-store and auth-role Vary headers', async () => {
  const response = await requestProtectedReviewerPage();
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get('Content-Type') || '', /text\/html/);
  assert.match(html, new RegExp(PROTECTED_NOTE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  // These assertions record the current audited behavior. They are not the desired
  // security contract and are expected to change in the remediation PR.
  assert.equal(response.headers.get('Cache-Control'), null);
  assert.equal(response.headers.get('Vary'), null);
});

test('characterization: generated Service Worker caches protected HTML and replays it after reviewer access is removed', async () => {
  const protectedResponse = await requestProtectedReviewerPage();
  const harness = createServiceWorkerHarness();
  let offline = false;
  harness.setFetch(async () => {
    if (offline) throw new Error('synthetic offline transition');
    return protectedResponse.clone();
  });

  const reviewerRequest = new Request(PROTECTED_URL, {
    headers: {
      Authorization: `Bearer ${SYNTHETIC_API_TOKEN}`,
      [REVIEWER_ROLE_HEADER]: 'reviewer',
    },
  });
  const onlineResponse = await harness.dispatchFetch(reviewerRequest);
  // The generated worker starts Cache.put in a detached promise chain. The mock
  // resolves this explicit barrier from Cache.put itself; no sleep is involved.
  await harness.putObserved;
  assert.equal(onlineResponse.status, 200);
  assert.equal(harness.putCalls.length, 1);
  assert.equal(harness.putCalls[0].cacheName, CURRENT_CACHE_NAME);
  assert.equal(harness.putCalls[0].request.url, PROTECTED_URL);

  offline = true;
  const downgradedRequest = new Request(PROTECTED_URL, {
    headers: { [REVIEWER_ROLE_HEADER]: 'manager' },
  });
  const offlineResponse = await harness.dispatchFetch(downgradedRequest);
  const offlineHtml = await offlineResponse.text();

  // This assertion records the current audited behavior. It is not the desired
  // security contract and is expected to change in the remediation PR.
  assert.match(offlineHtml, new RegExp(PROTECTED_NOTE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('characterization: activation keeps an already-deployed v1 cache that can replay protected reviewer HTML', async () => {
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
      'b2b-leads-v0': [[new Request('https://b2b-lead-trigger.example.workers.dev/'), new Response('legacy shell')]],
    },
  });
  harness.setFetch(async () => {
    throw new Error('synthetic offline transition');
  });

  await harness.dispatchActivate();
  assert.deepEqual(harness.deletedCaches, ['b2b-leads-v0']);
  assert.deepEqual(harness.cacheNames(), [CURRENT_CACHE_NAME]);

  const downgradedRequest = new Request(PROTECTED_URL, {
    headers: { [REVIEWER_ROLE_HEADER]: 'manager' },
  });
  const offlineResponse = await harness.dispatchFetch(downgradedRequest);
  const offlineHtml = await offlineResponse.text();

  // This assertion records the current audited behavior. It is not the desired
  // security contract and is expected to change in the remediation PR.
  assert.match(offlineHtml, new RegExp(PROTECTED_NOTE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test.todo('desired contract: protected reviewer HTML sends Cache-Control private, no-store');
test.todo('desired contract: protected reviewer HTML varies on every authentication and role boundary');
test.todo('desired contract: Service Worker never stores protected HTML responses');
test.todo('desired contract: cache policy changes delete or version-invalidate deployed legacy caches');
test.todo('desired contract: anonymous or downgraded-role requests never receive cached reviewer content');
