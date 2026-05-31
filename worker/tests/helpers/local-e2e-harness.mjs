import { createServer } from 'node:http';

import worker from '../../index.js';
import { FakeD1Database } from './fake-d1.mjs';
import {
  LOCAL_E2E_TOKEN,
  createLocalE2EAnalyticsRows,
  createLocalE2ELeadRows,
  createLocalE2EManualReviewNoteEventRows,
  createLocalE2EStatusLogRows,
} from './local-e2e-fixtures.mjs';

export { LOCAL_E2E_TOKEN };

export function createLocalSmokeEnv(overrides = {}) {
  return {
    API_TOKEN: LOCAL_E2E_TOKEN,
    TRIGGER_PASSWORD: 'local-e2e-legacy-token',
    GITHUB_TOKEN: 'local-e2e-github-token-not-used',
    GITHUB_REPO: 'local-only/no-remote',
    PROFILES: JSON.stringify([
      { id: 'danfoss', name: 'Danfoss Local' },
      { id: 'ls-electric', name: 'LS Electric Local' },
    ]),
    REQUIRE_SELF_SERVICE_AUTH: 'true',
    WORKER_ORIGIN: 'http://127.0.0.1',
    DB: new FakeD1Database({
      leads: createLocalE2ELeadRows(),
      manualReviewNoteEvents: createLocalE2EManualReviewNoteEventRows(),
      statusLog: createLocalE2EStatusLogRows(),
      analytics: createLocalE2EAnalyticsRows(),
    }),
    ...overrides,
  };
}

export async function createLocalE2EHarness({ env = createLocalSmokeEnv() } = {}) {
  let origin = '';
  const server = createServer(async (nodeRequest, nodeResponse) => {
    try {
      const request = await toWorkerRequest(nodeRequest, origin);
      const waitUntilTasks = [];
      const response = await worker.fetch(request, env, {
        waitUntil(task) {
          waitUntilTasks.push(Promise.resolve(task));
        },
      });
      await writeNodeResponse(nodeResponse, response);
      await Promise.allSettled(waitUntilTasks);
    } catch (error) {
      nodeResponse.statusCode = 500;
      nodeResponse.setHeader('Content-Type', 'text/plain; charset=utf-8');
      nodeResponse.end(error?.stack || String(error));
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });

  const address = server.address();
  origin = `http://127.0.0.1:${address.port}`;
  env.WORKER_ORIGIN = origin;

  return {
    origin,
    env,
    async close() {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}

export function installLocalOnlyFetchGuard() {
  const originalFetch = globalThis.fetch;
  const blockedUrls = [];

  globalThis.fetch = async (input, init) => {
    const url = toUrl(input);
    if (url && (url.protocol === 'http:' || url.protocol === 'https:') && !isLoopbackHost(url.hostname)) {
      blockedUrls.push(url.href);
      throw new Error(`Local E2E blocked external fetch: ${url.href}`);
    }
    return originalFetch(input, init);
  };

  return {
    blockedUrls,
    restore() {
      globalThis.fetch = originalFetch;
    },
  };
}

function isLoopbackHost(hostname) {
  return hostname === '127.0.0.1'
    || hostname === 'localhost'
    || hostname === '::1'
    || hostname === '[::1]'
    || hostname.endsWith('.localhost');
}

function toUrl(input) {
  try {
    if (input instanceof Request) return new URL(input.url);
    if (input instanceof URL) return input;
    if (typeof input === 'string') return new URL(input);
  } catch {
    return null;
  }
  return null;
}

async function toWorkerRequest(nodeRequest, origin) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(nodeRequest.headers)) {
    if (Array.isArray(value)) {
      value.forEach((item) => headers.append(name, item));
    } else if (value !== undefined) {
      headers.set(name, value);
    }
  }

  const method = nodeRequest.method || 'GET';
  const init = { method, headers };
  if (method !== 'GET' && method !== 'HEAD') {
    init.body = await readRequestBody(nodeRequest);
  }

  return new Request(`${origin}${nodeRequest.url || '/'}`, init);
}

async function readRequestBody(nodeRequest) {
  const chunks = [];
  for await (const chunk of nodeRequest) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

async function writeNodeResponse(nodeResponse, response) {
  nodeResponse.statusCode = response.status;
  response.headers.forEach((value, name) => {
    nodeResponse.setHeader(name, value);
  });
  const body = Buffer.from(await response.arrayBuffer());
  nodeResponse.end(body);
}
