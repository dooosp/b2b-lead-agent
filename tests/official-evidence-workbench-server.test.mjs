import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import {
  WORKBENCH_CSP,
  WORKBENCH_MAX_REQUEST_BYTES,
  createWorkbenchServer,
  loadDefaultWorkbenchCatalog,
  loadEvidenceInboxWorkbenchCatalog,
  parseWorkbenchAsOf,
  parseWorkbenchCliArguments,
  parseWorkbenchHost,
  parseWorkbenchPort
} from '../evidence-claim-workbench/server.mjs';
import {
  computeNormalizedContentSha256,
  sha256
} from '../evidence-claim-workbench/domain/document-bundle.mjs';

const TOKEN = 'c'.repeat(64);
const REAL_AS_OF = '2026-07-18T00:00:00.000Z';

function bytesSha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function createRealIntakeBundle() {
  const pages = [{
    pageNumber: 1,
    locator: { type: 'DOCUMENT_PAGE', value: '1' },
    text: 'Rated voltage: 24 kV. Rated current: 1250 A.'
  }];
  return {
    schemaVersion: 'source-document-bundle-v0',
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    productionReady: false,
    synthetic: false,
    source: {
      sourceClass: 'OFFICIAL_MANUFACTURER',
      publisher: 'Example Manufacturer Test Fixture',
      title: 'Non-production intake integration fixture',
      documentNumber: 'EXAMPLE-MV-001',
      sourceUrl: 'https://manufacturer.example/evidence/example-mv-001',
      documentType: 'NORMALIZED_PAGE_TEXT_JSON',
      mimeType: 'application/json',
      language: 'en',
      vertical: 'datacenter',
      jurisdiction: 'KR',
      domain: 'electrical_power',
      productFamilies: ['medium_voltage_switchgear'],
      authenticityStatus: 'UNREVIEWED',
      redistributionStatus: 'METADATA_AND_BOUNDED_EXCERPTS_ONLY'
    },
    revision: {
      seriesId: 'example-mv-series',
      revisionId: 'example-revision-1',
      sequence: 1,
      publishedAt: '2026-01-01T00:00:00.000Z',
      effectiveAt: '2026-01-01T00:00:00.000Z',
      retrievedAt: '2026-07-17T00:00:00.000Z'
    },
    file: {
      sha256: sha256('non-production-real-intake-integration-fixture'),
      byteLength: 4096,
      contentSha256: computeNormalizedContentSha256(pages)
    },
    extraction: {
      method: 'PREEXTRACTED_PAGE_TEXT',
      extractorName: 'integration-fixture',
      extractorVersion: '1',
      extractedAt: '2026-07-17T00:00:00.000Z',
      normalizationVersion: 'page-text-nfc-lf-codepoint-v1'
    },
    pages
  };
}

function createRealIntakeManifest(bundle, bytes) {
  return {
    schemaVersion: 'official-evidence-intake-manifest-v0',
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    productionReady: false,
    documents: [{
      relativePath: 'example-mv.json',
      byteLength: bytes.byteLength,
      mediaType: 'application/json',
      sourceUrl: bundle.source.sourceUrl,
      publisher: bundle.source.publisher,
      title: bundle.source.title,
      documentNumber: bundle.source.documentNumber,
      documentType: bundle.source.documentType,
      revision: {
        seriesId: bundle.revision.seriesId,
        revisionId: bundle.revision.revisionId,
        sequence: bundle.revision.sequence
      },
      language: bundle.source.language,
      vertical: bundle.source.vertical,
      jurisdiction: bundle.source.jurisdiction,
      domain: bundle.source.domain,
      productFamilies: bundle.source.productFamilies,
      redistributionStatus: bundle.source.redistributionStatus,
      expectedSha256: bytesSha256(bytes)
    }]
  };
}

function request(origin, pathname, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathname, origin);
    const requestHeaders = { ...headers };
    if (body !== undefined && requestHeaders['Content-Length'] === undefined && requestHeaders['content-length'] === undefined) {
      requestHeaders['Content-Length'] = String(Buffer.byteLength(body));
    }
    const req = http.request(url, { method, headers: requestHeaders }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({
        status: response.statusCode,
        headers: response.headers,
        body: Buffer.concat(chunks).toString('utf8')
      }));
    });
    req.on('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

function rawRequest(host, port, target, hostHeader = `${host}:${port}`) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port });
    const chunks = [];
    socket.setEncoding('utf8');
    socket.on('connect', () => socket.write(`GET ${target} HTTP/1.1\r\nHost: ${hostHeader}\r\nConnection: close\r\n\r\n`));
    socket.on('data', (chunk) => chunks.push(chunk));
    socket.on('end', () => resolve(chunks.join('')));
    socket.on('error', reject);
  });
}

function candidateFields(candidate) {
  return {
    claimType: candidate.claimType,
    productFamily: candidate.productFamily,
    capabilityKey: candidate.capabilityKey,
    valueType: candidate.value.type,
    value: Array.isArray(candidate.value.value) ? candidate.value.value.join(', ') : String(candidate.value.value ?? ''),
    minimum: String(candidate.value.minimum ?? ''),
    maximum: String(candidate.value.maximum ?? ''),
    unit: candidate.value.unit ?? '',
    conditionKey: candidate.applicability.conditions[0]?.id ?? '',
    conditionValue: candidate.applicability.conditions[0]?.value ?? '',
    jurisdiction: 'KR',
    projectStage: candidate.applicability.projectStages[0],
    validUntil: candidate.validity.type === 'VALID_UNTIL' ? candidate.validity.validUntil.slice(0, 10) : ''
  };
}

function reviewRequest(candidate, decision, reasonCode) {
  return {
    schemaVersion: 'official-evidence-workbench-review-request-v0',
    reviews: [{ candidateId: candidate.candidateId, decision, reasonCode, fields: candidateFields(candidate), acknowledged: true }]
  };
}

test('host and port parsing accept only exact numeric loopback and bounded ports', () => {
  assert.equal(parseWorkbenchHost('127.0.0.1'), '127.0.0.1');
  assert.equal(parseWorkbenchHost('::1'), '::1');
  assert.equal(parseWorkbenchPort(0), 0);
  assert.equal(parseWorkbenchPort('4183'), 4183);
  for (const host of ['0.0.0.0', '::', 'localhost', '127.1', '192.168.0.2', '8.8.8.8', '::ffff:127.0.0.1', '127.0.0.1.evil']) {
    assert.throws(() => parseWorkbenchHost(host), (error) => error.code === 'WORKBENCH_NON_LOOPBACK_HOST_REFUSED', host);
  }
  for (const port of ['80', '-1', '+4183', '4183.0', '4.183e3', '65536', '0x1057', '']) {
    assert.throws(() => parseWorkbenchPort(port), (error) => error.code === 'WORKBENCH_PORT_INVALID', String(port));
  }
});

test('CLI requires an explicit deterministic as-of for opt-in fixed-root real intake', () => {
  assert.equal(parseWorkbenchAsOf(REAL_AS_OF), REAL_AS_OF);
  assert.deepEqual(parseWorkbenchCliArguments([]), {
    host: '127.0.0.1',
    port: 4183,
    realIntake: false,
    asOf: null
  });
  assert.deepEqual(parseWorkbenchCliArguments(['--host', '::1', '--port', '5000', '--real-intake', '--as-of', REAL_AS_OF]), {
    host: '::1',
    port: 5000,
    realIntake: true,
    asOf: REAL_AS_OF
  });
  for (const argv of [
    ['--real-intake'],
    ['--as-of', REAL_AS_OF],
    ['--real-intake', '--as-of', '2026-07-18'],
    ['--real-intake', '--real-intake', '--as-of', REAL_AS_OF],
    ['--intake-dir', 'evidence-inbox', '--as-of', REAL_AS_OF]
  ]) {
    assert.throws(() => parseWorkbenchCliArguments(argv), (error) => error.code?.startsWith('WORKBENCH_'), argv.join(' '));
  }
});

test('manifest-bound real intake reaches the loopback catalog with candidates and zero authority', async (t) => {
  const ownedRoot = await mkdtemp(path.join(tmpdir(), 'official-evidence-server-intake-'));
  const inboxRoot = path.join(ownedRoot, 'evidence-inbox');
  await mkdir(inboxRoot);
  t.after(() => rm(ownedRoot, { recursive: true, force: true }));
  const bundle = createRealIntakeBundle();
  const bytes = Buffer.from(JSON.stringify(bundle));
  await writeFile(path.join(inboxRoot, 'example-mv.json'), bytes);
  await writeFile(path.join(inboxRoot, 'manifest.json'), JSON.stringify(createRealIntakeManifest(bundle, bytes)));

  const catalog = await loadEvidenceInboxWorkbenchCatalog({ ownedRoot, asOf: REAL_AS_OF });
  assert.equal(catalog.synthetic, false);
  assert.equal(catalog.productionReady, false);
  assert.equal(catalog.customerUseAllowed, false);
  assert.deepEqual(catalog.intake, {
    mode: 'REAL_MANIFEST_BOUND',
    population: 'LOADED_UNVERIFIED',
    manifestSha256: catalog.intake.manifestSha256,
    documentCount: 1,
    verifiedClaimCount: 0,
    customerUseAllowedCount: 0
  });
  assert.match(catalog.intake.manifestSha256, /^[a-f0-9]{64}$/);
  assert.equal(catalog.documents[0].synthetic, false);
  assert.ok(catalog.documents[0].pages[0].candidates.length >= 2);
  assert.doesNotMatch(JSON.stringify(catalog), new RegExp(ownedRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  const started = await createWorkbenchServer({ handlerOptions: { capabilityToken: TOKEN, catalog } });
  try {
    const page = await request(started.origin, '/');
    assert.equal(page.status, 200);
    assert.match(page.body, /Non-production intake integration fixture/);
    assert.match(page.body, /REAL_MANIFEST_BOUND/);
    const response = await request(started.origin, '/api/catalog', {
      headers: { 'X-Workbench-Capability': TOKEN }
    });
    assert.equal(response.status, 200);
    const browserCatalog = JSON.parse(response.body);
    assert.equal(browserCatalog.synthetic, false);
    assert.equal(browserCatalog.intake.mode, 'REAL_MANIFEST_BOUND');
    assert.equal(browserCatalog.intake.verifiedClaimCount, 0);
    assert.equal(browserCatalog.intake.customerUseAllowedCount, 0);
    assert.equal(browserCatalog.documents[0].title, bundle.source.title);
    assert.equal(browserCatalog.documents[0].pages[0].candidates.length, catalog.documents[0].pages[0].candidates.length);
  } finally {
    await started.close();
  }
});

test('server binds ephemeral numeric loopback, serves the page/assets, and closes idempotently', async () => {
  const started = await createWorkbenchServer({ host: '127.0.0.1', port: 0, handlerOptions: { capabilityToken: TOKEN } });
  try {
    assert.equal(started.host, '127.0.0.1');
    assert.ok(started.port > 0);
    const page = await request(started.origin, '/');
    assert.equal(page.status, 200);
    assert.match(page.body, /Official Evidence Claim Review Workbench v0/);
    assert.equal((await request(started.origin, '/assets/app.js')).status, 200);
    assert.equal((await request(started.origin, '/assets/browser-effects.mjs')).status, 200);
    assert.equal((await request(started.origin, '/assets/styles.css')).status, 200);
  } finally {
    await started.close();
    await started.close();
  }
});

test('IPv6 loopback binding works when available', async (t) => {
  let started;
  try {
    started = await createWorkbenchServer({ host: '::1', port: 0, handlerOptions: { capabilityToken: TOKEN } });
  } catch (error) {
    if (['EADDRNOTAVAIL', 'EAFNOSUPPORT'].includes(error.code)) return t.skip('IPv6 loopback unavailable');
    throw error;
  }
  try {
    assert.equal(started.host, '::1');
    assert.equal((await request(started.origin, '/')).status, 200);
  } finally {
    await started.close();
  }
});

test('CSP, cache, MIME, privacy, frame, and cross-origin headers apply on every route class', async () => {
  const started = await createWorkbenchServer({ handlerOptions: { capabilityToken: TOKEN } });
  try {
    for (const pathname of ['/', '/assets/app.js', '/missing']) {
      const response = await request(started.origin, pathname);
      assert.equal(response.headers['cache-control'], 'private, no-store, max-age=0', pathname);
      assert.equal(response.headers.pragma, 'no-cache', pathname);
      assert.equal(response.headers['content-security-policy'], WORKBENCH_CSP, pathname);
      assert.equal(response.headers['x-content-type-options'], 'nosniff', pathname);
      assert.equal(response.headers['referrer-policy'], 'no-referrer', pathname);
      assert.equal(response.headers['x-frame-options'], 'DENY', pathname);
      assert.equal(response.headers['cross-origin-opener-policy'], 'same-origin', pathname);
      assert.equal(response.headers['cross-origin-resource-policy'], 'same-origin', pathname);
      assert.equal(response.headers['set-cookie'], undefined, pathname);
      assert.equal(response.headers['access-control-allow-origin'], undefined, pathname);
    }
    const head = await request(started.origin, '/', { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(head.body, '');
    assert.ok(Number(head.headers['content-length']) > 0);
  } finally {
    await started.close();
  }
});

test('Host, Origin, Fetch Metadata, capability, traversal, unknown paths, methods, and bodies fail closed', async () => {
  const started = await createWorkbenchServer({ handlerOptions: { capabilityToken: TOKEN } });
  try {
    const wrongHost = await rawRequest(started.host, started.port, '/', `example.com:${started.port}`);
    assert.match(wrongHost, /^HTTP\/1\.1 421 /);
    for (const target of ['/../package.json', '/%2e%2e%2fpackage.json', '//etc/passwd', '/api/catalog?x=1', '/%00']) {
      assert.match(await rawRequest(started.host, started.port, target), /^HTTP\/1\.1 400 /, target);
    }
    for (const target of ['/unknown', '/assets/', '/package.json', '/api/documents/anything', '/favicon.ico']) {
      const response = await request(started.origin, target);
      assert.equal(response.status, 404, target);
      assert.doesNotMatch(response.body, /\/Users\/|node:internal|stack|package-lock/i);
    }
    assert.equal((await request(started.origin, '/api/catalog')).status, 403);
    assert.equal((await request(started.origin, '/api/catalog', { headers: { 'X-Workbench-Capability': 'd'.repeat(64) } })).status, 403);
    assert.equal((await request(started.origin, '/api/catalog', { headers: { 'X-Workbench-Capability': TOKEN, Origin: 'https://example.com' } })).status, 403);
    assert.equal((await request(started.origin, '/api/catalog', { headers: { 'X-Workbench-Capability': TOKEN, 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
    const postPage = await request(started.origin, '/', { method: 'POST' });
    assert.equal(postPage.status, 405);
    assert.equal(postPage.headers.allow, 'GET, HEAD');
    assert.equal((await request(started.origin, '/', { headers: { 'Content-Length': '1' }, body: 'x' })).status, 413);
  } finally {
    await started.close();
  }
});

test('patch endpoint requires exact origin, JSON MIME, capability, bounded body, and valid UTF-8', async () => {
  const catalog = { boundary: 'NOT_PRODUCTION_EVIDENCE', productionReady: false, documents: [] };
  const started = await createWorkbenchServer({
    handlerOptions: {
      capabilityToken: TOKEN,
      catalog,
      assets: new Map([
        ['/assets/app.js', { content: '', type: 'text/javascript; charset=utf-8' }],
        ['/assets/styles.css', { content: '', type: 'text/css; charset=utf-8' }]
      ]),
      buildPatch: (body) => ({ boundary: 'NOT_PRODUCTION_EVIDENCE', productionReady: false, echoedSchema: body.schemaVersion })
    }
  });
  try {
    const headers = { Origin: started.origin, 'X-Workbench-Capability': TOKEN };
    assert.equal((await request(started.origin, '/api/patch', { method: 'POST', headers, body: '{}' })).status, 415);
    const good = await request(started.origin, '/api/patch', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ schemaVersion: 'test-v0' })
    });
    assert.equal(good.status, 200);
    assert.equal(JSON.parse(good.body).echoedSchema, 'test-v0');
    const oversized = await request(started.origin, '/api/patch', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json', 'Content-Length': String(WORKBENCH_MAX_REQUEST_BYTES + 1) },
      body: ''
    });
    assert.equal(oversized.status, 413);
  } finally {
    await started.close();
  }
});

test('default review path calls the domain patch authority and remains UNVERIFIED/BLOCKED', async () => {
  const catalog = await loadDefaultWorkbenchCatalog();
  const entries = catalog.documents.flatMap((document) => document.pages.flatMap((page) => page.candidates.map((candidate) => ({ document, page, candidate }))));
  const entry = entries.find(({ page, candidate }) => candidate.relationships.length === 0 && candidate.exactQuote !== page.text);
  assert.ok(entry, 'unique bounded candidate fixture');
  const started = await createWorkbenchServer({ handlerOptions: { capabilityToken: TOKEN } });
  try {
    const response = await request(started.origin, '/api/patch', {
      method: 'POST',
      headers: { Origin: started.origin, 'Content-Type': 'application/json', 'X-Workbench-Capability': TOKEN },
      body: JSON.stringify(reviewRequest(entry.candidate, 'APPROVE_FOR_REPOSITORY_REVIEW', 'EVIDENCE_QUOTE_CONFIRMED'))
    });
    assert.equal(response.status, 200, response.body);
    const patch = JSON.parse(response.body);
    assert.equal(patch.schemaVersion, 'claim-registry-review-patch-v0');
    assert.equal(patch.boundary, 'NOT_PRODUCTION_EVIDENCE');
    assert.equal(patch.productionReady, false);
    assert.equal(patch.productionReviewerWorkflowReady, false);
    assert.equal(patch.automaticVerification, false);
    assert.equal(patch.customerUseAllowed, false);
    assert.equal(patch.reviewerIdentity, 'NOT_COLLECTED');
    assert.equal(patch.issue165Status, 'HOLD');
    assert.equal(patch.approvedCandidates.length, 1);
    assert.notEqual(patch.evidenceAnchors[0].selection.directQuote, entry.page.text);
    assert.equal(Object.hasOwn(patch, 'pages'), false);
  } finally {
    await started.close();
  }
});

test('full-page excerpts and omitted relationship closure are refused with bounded codes', async () => {
  const catalog = await loadDefaultWorkbenchCatalog();
  const entries = catalog.documents.flatMap((document) => document.pages.flatMap((page) => page.candidates.map((candidate) => ({ page, candidate }))));
  const full = entries.find(({ page, candidate }) => candidate.exactQuote === page.text);
  const conflicted = entries.find(({ candidate }) => candidate.relationships.some(({ type }) => type === 'MATERIAL_CONFLICT'));
  assert.ok(full);
  assert.ok(conflicted);
  const started = await createWorkbenchServer({ handlerOptions: { capabilityToken: TOKEN } });
  try {
    const headers = { Origin: started.origin, 'Content-Type': 'application/json', 'X-Workbench-Capability': TOKEN };
    const fullResponse = await request(started.origin, '/api/patch', { method: 'POST', headers, body: JSON.stringify(reviewRequest(full.candidate, 'REJECT', 'NOT_A_CAPABILITY')) });
    assert.equal(fullResponse.status, 422);
    assert.equal(JSON.parse(fullResponse.body).code, 'FULL_PAGE_QUOTE_REFUSED');
    const conflictResponse = await request(started.origin, '/api/patch', { method: 'POST', headers, body: JSON.stringify(reviewRequest(conflicted.candidate, 'FLAG_CONFLICT', 'CONFLICTING_DOCUMENT')) });
    assert.equal(conflictResponse.status, 422);
    assert.equal(JSON.parse(conflictResponse.body).code, 'RELATIONSHIP_REVIEW_REQUIRED');
    assert.doesNotMatch(conflictResponse.body, /\/Users\/|node:internal|stack|directQuote/i);
  } finally {
    await started.close();
  }
});

test('runtime sources contain no external call, persistence, telemetry, arbitrary path, or write primitive', async () => {
  const sources = await Promise.all([
    'evidence-claim-workbench/server.mjs',
    'evidence-claim-workbench/renderer.mjs',
    'evidence-claim-workbench/assets/app.js',
    'evidence-claim-workbench/assets/browser-effects.mjs'
  ].map((path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')));
  const joined = sources.join('\n');
  assert.doesNotMatch(joined, /writeFile|appendFile|createWriteStream|sendBeacon|WebSocket|EventSource|serviceWorker|indexedDB|localStorage|sessionStorage|D1Database|OPENAI|GEMINI|window\.open/);
  assert.doesNotMatch(joined, /fetch\(['"]https?:|src=['"]https?:|href=['"]https?:/);
});
