const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');

async function serverModule() {
  return import('../pursuit-workbench/server.mjs');
}

function request(origin, pathname, { method = 'GET', headers = {}, body = '' } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathname, origin);
    const req = http.request(url, { method, headers }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function rawRequest(host, port, requestTarget, hostHeader = `127.0.0.1:${port}`) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port });
    const chunks = [];
    socket.setEncoding('utf8');
    socket.on('connect', () => socket.write(`GET ${requestTarget} HTTP/1.1\r\nHost: ${hostHeader}\r\nConnection: close\r\n\r\n`));
    socket.on('data', (chunk) => chunks.push(chunk));
    socket.on('end', () => resolve(chunks.join('')));
    socket.on('error', reject);
  });
}

test('host and port parsing accept only exact bounded loopback inputs', async () => {
  const server = await serverModule();
  assert.equal(server.parsePursuitWorkbenchHost('127.0.0.1'), '127.0.0.1');
  assert.equal(server.parsePursuitWorkbenchHost('localhost'), '127.0.0.1');
  assert.equal(server.parsePursuitWorkbenchHost('::1'), '::1');
  assert.equal(server.parsePursuitWorkbenchPort(0), 0);
  assert.equal(server.parsePursuitWorkbenchPort('4173'), 4173);
  for (const host of ['0.0.0.0', '::', '192.168.1.4', '8.8.8.8', '127.1', '2130706433', '::ffff:127.0.0.1', 'localhost.', 'localhost.evil', '127.0.0.1.evil', ' localhost', 'localhost ']) {
    assert.throws(() => server.parsePursuitWorkbenchHost(host), (error) => error.code === 'WORKBENCH_NON_LOOPBACK_HOST_REFUSED', host);
  }
  for (const port of ['-1', '+4173', '4.173e3', '4173.0', '0x104d', '65536', '80', '4173junk', '']) {
    assert.throws(() => server.parsePursuitWorkbenchPort(port), (error) => error.code === 'WORKBENCH_PORT_INVALID', port);
  }
});

test('server binds numeric 127.0.0.1 with port 0 and serves only bounded local routes', async () => {
  const server = await serverModule();
  const started = await server.startPursuitWorkbenchServer();
  try {
    assert.equal(started.host, '127.0.0.1');
    assert.ok(started.port > 0);
    const page = await request(started.origin, '/');
    assert.equal(page.status, 200);
    assert.match(page.body, /Data Center Pursuit Workbench v0/);
    const list = await request(started.origin, '/api/scenarios');
    assert.equal(list.status, 200);
    assert.equal(JSON.parse(list.body).scenarios.length, 12);
    const scenario = await request(started.origin, '/api/scenarios/strong_verified_cooling_fit');
    assert.equal(scenario.status, 200);
    assert.equal(JSON.parse(scenario.body).scenario.id, 'strong_verified_cooling_fit');
  } finally {
    await started.close();
  }
});

test('server binds ::1 when the platform supports IPv6 loopback', async (t) => {
  const server = await serverModule();
  let started;
  try {
    started = await server.startPursuitWorkbenchServer({ host: '::1', port: 0 });
  } catch (error) {
    if (['EADDRNOTAVAIL', 'EAFNOSUPPORT'].includes(error.code)) return t.skip('IPv6 loopback unavailable');
    throw error;
  }
  try {
    assert.equal(started.host, '::1');
    assert.equal((await request(started.origin, '/api/scenarios')).status, 200);
  } finally {
    await started.close();
  }
});

test('unknown routes, scenarios, directory paths, and source maps stay closed', async () => {
  const server = await serverModule();
  const started = await server.startPursuitWorkbenchServer();
  try {
    for (const pathname of ['/unknown', '/assets/', '/assets/pursuit-workbench.js.map', '/package.json', '/scenario/constructor', '/scenario/__proto__', '/scenario/strong_verified_cooling_fit/extra']) {
      const response = await request(started.origin, pathname);
      assert.equal(response.status, 404, pathname);
      assert.doesNotMatch(response.body, /\/Users\/|node:internal|package-lock|stack/i);
    }
    const api = await request(started.origin, '/api/scenarios/not_allowlisted');
    assert.equal(api.status, 404);
    assert.deepEqual(JSON.parse(api.body), { error: 'scenario_not_found' });
  } finally {
    await started.close();
  }
});

test('raw and encoded traversal, malformed targets, and hostile Host values fail closed', async () => {
  const server = await serverModule();
  const started = await server.startPursuitWorkbenchServer();
  try {
    const hostileTargets = ['/../package.json', '/%2e%2e%2fpackage.json', '/%252e%252e%252fpackage.json', '/%00', '/%2fetc/passwd', '//etc/passwd', '/scenario/strong_verified_cooling_fit?x=1'];
    for (const target of hostileTargets) {
      const raw = await rawRequest(started.host, started.port, target);
      assert.match(raw, /^HTTP\/1\.1 400 /, target);
      assert.doesNotMatch(raw, /\/Users\/|node:internal|stack/i);
    }
    for (const host of ['example.com', `localhost.evil:${started.port}`, `127.0.0.1.evil:${started.port}`, `127.0.0.1:${started.port + 1}`]) {
      const raw = await rawRequest(started.host, started.port, '/', host);
      assert.match(raw, /^HTTP\/1\.1 421 /, host);
    }
  } finally {
    await started.close();
  }
});

test('unsupported methods and every request body are refused', async () => {
  const server = await serverModule();
  const started = await server.startPursuitWorkbenchServer();
  try {
    const post = await request(started.origin, '/', { method: 'POST' });
    assert.equal(post.status, 405);
    assert.equal(post.headers.allow, 'GET, HEAD');
    const body = await request(started.origin, '/', { method: 'POST', headers: { 'Content-Length': '2' }, body: '{}' });
    assert.equal(body.status, 413);
    const getBody = await request(started.origin, '/', { method: 'GET', headers: { 'Content-Length': '1' }, body: 'x' });
    assert.equal(getBody.status, 413);
  } finally {
    await started.close();
  }
});

test('CSP, no-store, nosniff, privacy, and MIME headers apply to pages, JSON, assets, errors, and HEAD', async () => {
  const server = await serverModule();
  const started = await server.startPursuitWorkbenchServer();
  try {
    for (const pathname of ['/', '/api/scenarios', '/assets/pursuit-workbench.css', '/missing']) {
      const response = await request(started.origin, pathname);
      assert.equal(response.headers['cache-control'], 'no-store', pathname);
      assert.equal(response.headers['x-content-type-options'], 'nosniff', pathname);
      assert.equal(response.headers['referrer-policy'], 'no-referrer', pathname);
      assert.equal(response.headers['content-security-policy'], server.WORKBENCH_CSP, pathname);
      assert.equal(response.headers['x-frame-options'], 'DENY', pathname);
      assert.equal(response.headers['set-cookie'], undefined, pathname);
      assert.equal(response.headers['access-control-allow-origin'], undefined, pathname);
    }
    const head = await request(started.origin, '/', { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(head.body, '');
    assert.ok(Number(head.headers['content-length']) > 0);
    const crossOrigin = await request(started.origin, '/api/scenarios', { headers: { Origin: 'https://example.com' } });
    assert.equal(crossOrigin.status, 403);
  } finally {
    await started.close();
  }
});

test('recomputation and asset failures emit generic bounded errors without stale data', async () => {
  const server = await serverModule();
  const started = await server.startPursuitWorkbenchServer({
    handlerOptions: {
      materialize: async () => { throw new Error('Bearer abcdefghijklmnopqrstuvwxyz123456 /Users/private/fixture.json'); }
    }
  });
  try {
    const page = await request(started.origin, '/');
    assert.equal(page.status, 503);
    assert.match(page.body, /scenario unavailable/i);
    assert.doesNotMatch(page.body, /Bearer|\/Users\/|fixture\.json|Campus Alpha|dossierJsonSha256/);
    const api = await request(started.origin, '/api/scenarios/strong_verified_cooling_fit');
    assert.equal(api.status, 503);
    assert.deepEqual(JSON.parse(api.body), { error: 'scenario_recomputation_unavailable' });
  } finally {
    await started.close();
  }
});

test('server startup and scenario rendering require no fetch, D1, LLM, telemetry, or filesystem writes', async () => {
  const sourceFiles = [
    'pursuit-workbench/server.mjs', 'pursuit-workbench/domain/scenarios.mjs',
    'pursuit-workbench/assets/pursuit-workbench.js'
  ].map((file) => fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8')).join('\n');
  assert.doesNotMatch(sourceFiles, /writeFile|appendFile|createWriteStream|D1Database|OPENAI|GEMINI|sendBeacon|WebSocket|EventSource/);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('external fetch refused by test'); };
  const server = await serverModule();
  const started = await server.startPursuitWorkbenchServer();
  try {
    assert.equal((await request(started.origin, '/')).status, 200);
  } finally {
    await started.close();
    globalThis.fetch = originalFetch;
  }
});

test('shutdown is idempotent and repeated startup can reuse the released port', async () => {
  const server = await serverModule();
  const first = await server.startPursuitWorkbenchServer();
  const port = first.port;
  await first.close();
  await first.close();
  const second = await server.startPursuitWorkbenchServer({ port });
  try {
    assert.equal(second.port, port);
    assert.equal((await request(second.origin, '/api/scenarios')).status, 200);
  } finally {
    await second.close();
  }
});
