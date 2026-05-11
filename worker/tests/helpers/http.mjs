export const WORKER_ORIGIN = 'https://b2b-lead-trigger.example.workers.dev';

export function createWorkerRequest(path, { method = 'GET', headers = {}, body, json } = {}) {
  const nextHeaders = new Headers(headers);
  let nextBody = body;

  if (json !== undefined) {
    if (!nextHeaders.has('Content-Type')) {
      nextHeaders.set('Content-Type', 'application/json');
    }
    nextBody = JSON.stringify(json);
  }

  return new Request(`${WORKER_ORIGIN}${path}`, {
    method,
    headers: nextHeaders,
    body: nextBody,
  });
}

export async function readJson(response) {
  return response.json();
}

export function jsonFixtureResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export async function withMockedFetch(handler, fn) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = handler;
  try {
    return await fn();
  } finally {
    globalThis.fetch = originalFetch;
  }
}
