import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ClaimValidationError } from '../knowledge/claim-registry/index.mjs';
import { REPO_ROOT, loadEvidenceDomainInputs } from '../scripts/lib/repository-claim-registry.mjs';
import {
  listPursuitWorkbenchScenarios,
  loadWorkbenchScenarioCatalog,
  materializePursuitWorkbenchScenario
} from './domain/scenarios.mjs';
import {
  renderPursuitWorkbenchErrorPage,
  renderPursuitWorkbenchPage
} from './renderer.mjs';

export const WORKBENCH_CSP = "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'none'; font-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'; worker-src 'none'; manifest-src 'none'";
export const WORKBENCH_DEFAULT_PORT = 4173;
export const WORKBENCH_MAX_RESPONSE_BYTES = 768 * 1024;

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
const STATIC_ASSETS = Object.freeze({
  '/assets/pursuit-workbench.css': { path: 'pursuit-workbench/assets/pursuit-workbench.css', type: 'text/css; charset=utf-8' },
  '/assets/pursuit-workbench.js': { path: 'pursuit-workbench/assets/pursuit-workbench.js', type: 'text/javascript; charset=utf-8' },
  '/assets/review-packet.mjs': { path: 'pursuit-workbench/domain/review-packet.mjs', type: 'text/javascript; charset=utf-8' }
});

export function parsePursuitWorkbenchHost(value) {
  if (typeof value !== 'string' || !LOOPBACK_HOSTS.has(value)) throw new ClaimValidationError('WORKBENCH_NON_LOOPBACK_HOST_REFUSED', '$.host');
  return value === 'localhost' ? '127.0.0.1' : value;
}

export function parsePursuitWorkbenchPort(value, { allowZero = true } = {}) {
  const text = typeof value === 'number' ? String(value) : value;
  if (typeof text !== 'string' || !/^(0|[1-9][0-9]{0,4})$/.test(text)) throw new ClaimValidationError('WORKBENCH_PORT_INVALID', '$.port');
  const port = Number(text);
  if (!Number.isSafeInteger(port) || port > 65535 || (!allowZero && port < 1024) || (port !== 0 && port < 1024)) {
    throw new ClaimValidationError('WORKBENCH_PORT_INVALID', '$.port');
  }
  return port;
}

function hostHeaderAllowed(value, port) {
  return typeof value === 'string' && new Set([
    `127.0.0.1:${port}`,
    `localhost:${port}`,
    `[::1]:${port}`
  ]).has(value);
}

function originAllowed(value, port) {
  if (value === undefined) return true;
  return typeof value === 'string' && new Set([
    `http://127.0.0.1:${port}`,
    `http://localhost:${port}`,
    `http://[::1]:${port}`
  ]).has(value);
}

function securityHeaders(contentType) {
  return {
    'Cache-Control': 'no-store',
    'Content-Type': contentType,
    'Content-Security-Policy': WORKBENCH_CSP,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), microphone=(), payment=(), usb=(), clipboard-write=(self)'
  };
}

function send(response, status, contentType, body, { head = false, headers = {} } = {}) {
  const payload = Buffer.from(body, 'utf8');
  if (payload.byteLength > WORKBENCH_MAX_RESPONSE_BYTES) throw new ClaimValidationError('WORKBENCH_RESPONSE_TOO_LARGE', '$.response');
  response.writeHead(status, { ...securityHeaders(contentType), ...headers, 'Content-Length': String(payload.byteLength) });
  response.end(head ? undefined : payload);
}

function safeJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function pathKind(rawUrl) {
  if (typeof rawUrl !== 'string'
    || !rawUrl.startsWith('/')
    || rawUrl.startsWith('//')
    || rawUrl.includes('%')
    || rawUrl.includes('\\')
    || rawUrl.includes('?')
    || rawUrl.includes('#')
    || rawUrl.includes('..')
    || rawUrl.includes('\0')) return { kind: 'INVALID' };
  if (rawUrl === '/') return { kind: 'PAGE_DEFAULT' };
  if (rawUrl === '/api/scenarios') return { kind: 'API_LIST' };
  if (Object.hasOwn(STATIC_ASSETS, rawUrl)) return { kind: 'ASSET', path: rawUrl };
  const page = rawUrl.match(/^\/scenario\/([a-z0-9_]{1,64})$/);
  if (page) return { kind: 'PAGE_SCENARIO', scenarioId: page[1] };
  const api = rawUrl.match(/^\/api\/scenarios\/([a-z0-9_]{1,64})$/);
  if (api) return { kind: 'API_SCENARIO', scenarioId: api[1] };
  return { kind: 'UNKNOWN' };
}

async function loadStaticAssets() {
  const entries = await Promise.all(Object.entries(STATIC_ASSETS).map(async ([route, definition]) => {
    const content = await readFile(resolve(REPO_ROOT, definition.path), 'utf8');
    if (Buffer.byteLength(content, 'utf8') > WORKBENCH_MAX_RESPONSE_BYTES) throw new ClaimValidationError('WORKBENCH_ASSET_TOO_LARGE', '$.assets');
    return [route, { content, type: definition.type }];
  }));
  return new Map(entries);
}

export async function createPursuitWorkbenchRequestHandler({ inputs, catalog, scenarios, assets, materialize = materializePursuitWorkbenchScenario } = {}) {
  const resolvedInputs = inputs || await loadEvidenceDomainInputs();
  const resolvedCatalog = catalog || await loadWorkbenchScenarioCatalog();
  const resolvedScenarios = scenarios || await listPursuitWorkbenchScenarios({ inputs: resolvedInputs, catalog: resolvedCatalog });
  const resolvedAssets = assets || await loadStaticAssets();
  const scenarioIds = new Set(resolvedScenarios.map((scenario) => scenario.id));
  return async function handle(request, response, port) {
    const isHead = request.method === 'HEAD';
    if (!hostHeaderAllowed(request.headers.host, port)) {
      send(response, 421, 'text/plain; charset=utf-8', 'Misdirected request\n', { head: isHead });
      return;
    }
    if (!originAllowed(request.headers.origin, port)) {
      send(response, 403, 'text/plain; charset=utf-8', 'Forbidden\n', { head: isHead });
      return;
    }
    const contentLength = request.headers['content-length'];
    if (request.headers['transfer-encoding'] || (contentLength !== undefined && (!/^\d+$/.test(contentLength) || Number(contentLength) > 0))) {
      send(response, 413, 'text/plain; charset=utf-8', 'Request body refused\n', { head: isHead, headers: { Connection: 'close' } });
      return;
    }
    if (!['GET', 'HEAD'].includes(request.method || '')) {
      send(response, 405, 'text/plain; charset=utf-8', 'Method not allowed\n', { headers: { Allow: 'GET, HEAD', Connection: 'close' } });
      return;
    }
    const route = pathKind(request.url);
    if (route.kind === 'INVALID') {
      send(response, 400, 'text/plain; charset=utf-8', 'Bad request\n', { head: isHead });
      return;
    }
    if (route.kind === 'ASSET') {
      const asset = resolvedAssets.get(route.path);
      send(response, 200, asset.type, asset.content, { head: isHead });
      return;
    }
    if (route.kind === 'API_LIST') {
      send(response, 200, 'application/json; charset=utf-8', safeJson({
        schemaVersion: 'datacenter-pursuit-workbench-scenario-list-v0',
        boundary: 'NOT_PRODUCTION_EVIDENCE',
        productionReady: false,
        productionReviewerWorkflowReady: false,
        issue165Status: 'HOLD',
        synthetic: true,
        scenarios: resolvedScenarios
      }), { head: isHead });
      return;
    }
    const scenarioId = route.kind === 'PAGE_DEFAULT' ? resolvedScenarios[0]?.id : route.scenarioId;
    if ((route.kind === 'PAGE_SCENARIO' || route.kind === 'API_SCENARIO') && !scenarioIds.has(scenarioId)) {
      if (route.kind === 'API_SCENARIO') send(response, 404, 'application/json; charset=utf-8', safeJson({ error: 'scenario_not_found' }), { head: isHead });
      else send(response, 404, 'text/html; charset=utf-8', renderPursuitWorkbenchErrorPage(resolvedScenarios, 404), { head: isHead });
      return;
    }
    if (['PAGE_DEFAULT', 'PAGE_SCENARIO', 'API_SCENARIO'].includes(route.kind)) {
      try {
        const viewModel = await materialize(scenarioId, { inputs: resolvedInputs, catalog: resolvedCatalog });
        if (route.kind === 'API_SCENARIO') send(response, 200, 'application/json; charset=utf-8', safeJson(viewModel), { head: isHead });
        else send(response, 200, 'text/html; charset=utf-8', renderPursuitWorkbenchPage(viewModel, resolvedScenarios), { head: isHead });
      } catch {
        if (route.kind === 'API_SCENARIO') send(response, 503, 'application/json; charset=utf-8', safeJson({ error: 'scenario_recomputation_unavailable' }), { head: isHead });
        else send(response, 503, 'text/html; charset=utf-8', renderPursuitWorkbenchErrorPage(resolvedScenarios, 503), { head: isHead });
      }
      return;
    }
    send(response, 404, 'text/plain; charset=utf-8', 'Not found\n', { head: isHead });
  };
}

export async function startPursuitWorkbenchServer({ host = '127.0.0.1', port = 0, handlerOptions } = {}) {
  const parsedHost = parsePursuitWorkbenchHost(host);
  const parsedPort = parsePursuitWorkbenchPort(port);
  const handler = await createPursuitWorkbenchRequestHandler(handlerOptions);
  let activePort = parsedPort;
  const server = createServer({ maxHeaderSize: 16 * 1024, requestTimeout: 5_000, headersTimeout: 5_000, keepAliveTimeout: 1_000 }, (request, response) => {
    handler(request, response, activePort).catch(() => {
      if (!response.headersSent) send(response, 500, 'text/plain; charset=utf-8', 'Internal error\n', { head: request.method === 'HEAD' });
      else response.destroy();
    });
  });
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(parsedPort, parsedHost, () => {
      server.off('error', rejectListen);
      resolveListen();
    });
  });
  const address = server.address();
  if (!address || typeof address === 'string' || !['127.0.0.1', '::1'].includes(address.address)) {
    await new Promise((resolveClose) => server.close(resolveClose));
    throw new ClaimValidationError('WORKBENCH_BOUND_ADDRESS_INVALID', '$.server.address');
  }
  activePort = address.port;
  const originHost = address.address === '::1' ? '[::1]' : address.address;
  let closed = false;
  return {
    server,
    host: address.address,
    port: address.port,
    origin: `http://${originHost}:${address.port}`,
    async close() {
      if (closed) return;
      closed = true;
      await new Promise((resolveClose, rejectClose) => server.close((error) => error ? rejectClose(error) : resolveClose()));
    }
  };
}

function parseCliArguments(argv) {
  let host = '127.0.0.1';
  let port = WORKBENCH_DEFAULT_PORT;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--host' && argv[index + 1]) host = argv[++index];
    else if (argument === '--port' && argv[index + 1]) port = argv[++index];
    else throw new ClaimValidationError('WORKBENCH_CLI_ARGUMENT_INVALID', '$.argv');
  }
  return { host: parsePursuitWorkbenchHost(host), port: parsePursuitWorkbenchPort(port, { allowZero: false }) };
}

async function runCli() {
  const configuration = parseCliArguments(process.argv.slice(2));
  const started = await startPursuitWorkbenchServer(configuration);
  process.stdout.write(`Data Center Pursuit Workbench v0: ${started.origin}\n`);
  process.stdout.write('Boundary: NOT_PRODUCTION_EVIDENCE / synthetic / Issue #165 HOLD\n');
  process.stdout.write('Persistence: NONE / reviewer identity: NOT_COLLECTED / no browser auto-open\n');
  const stop = async () => {
    await started.close();
    process.exitCode = 0;
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  runCli().catch(() => {
    process.stderr.write('Pursuit Workbench failed to start safely.\n');
    process.exitCode = 1;
  });
}
