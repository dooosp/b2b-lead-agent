const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

const {
  OUTBOUND_HTTP_ENRICHMENT_BOUNDARY_STATUS,
  DEFAULT_ENRICHMENT_HTTP_POLICY,
  buildOutboundHttpEnrichmentBoundaryAudit,
  readEnrichmentHttpText,
  redactEnrichmentHttpEvidence,
} = require('../enricher/outbound-http-boundary');
const { fetchArticleContent } = require('../enricher/article-content-scraper');
const { resolveOriginalUrl } = require('../enricher/article-url-resolver');

test('enrichment HTTP boundary uses injected transport with safe axios-style policy config', async () => {
  const calls = [];
  const result = await readEnrichmentHttpText('https://public-news.example.com/articles/42', {
    timeout: 1234,
    maxBytes: 4096,
    maxRedirects: 2,
    transport: async (url, config) => {
      calls.push({ url, config });
      return {
        status: 200,
        data: '<html><body>public fixture body</body></html>',
        request: { res: { responseUrl: url } },
      };
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.body, '<html><body>public fixture body</body></html>');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://public-news.example.com/articles/42');
  assert.equal(calls[0].config.timeout, 1234);
  assert.equal(calls[0].config.maxRedirects, 2);
  assert.equal(calls[0].config.maxContentLength, 4096);
  assert.equal(calls[0].config.maxBodyLength, 4096);
  assert.equal(calls[0].config.responseType, 'text');
  assert.equal(typeof calls[0].config.beforeRedirect, 'function');
  assert.doesNotThrow(() =>
    calls[0].config.beforeRedirect({
      protocol: 'https:',
      hostname: 'public-news.example.com',
      path: '/articles/43',
    })
  );
  assert.throws(
    () =>
      calls[0].config.beforeRedirect({
        protocol: 'http:',
        hostname: '127.0.0.1',
        path: '/private',
      }),
    /unsafe enrichment redirect target/
  );
  assert.equal(calls[0].config.headers.Authorization, undefined);
  assert.match(calls[0].config.headers['User-Agent'], /Mozilla\/5\.0/);
});

test('enrichment HTTP boundary refuses unsafe schemes localhost private and production-like URLs', async () => {
  const refusedUrls = [
    'file:///etc/passwd',
    'ftp://public-news.example.com/article',
    'http://localhost:8787/api/leads',
    'http://127.0.0.1:8787/api/leads',
    'http://10.0.0.4/admin',
    'http://172.20.1.10/admin',
    'http://192.168.1.8/admin',
    'http://[::1]/admin',
    'https://metadata.google.internal/computeMetadata/v1',
    'https://api.internal.example.com/leads',
    'https://b2b-lead-trigger.example.com/api/leads',
    'https://reviewer-proof.workers.dev/api/leads',
  ];
  let transportCalls = 0;

  for (const url of refusedUrls) {
    const result = await readEnrichmentHttpText(url, {
      transport: async () => {
        transportCalls += 1;
        return { status: 200, data: 'must not be called' };
      },
    });

    assert.equal(result.ok, false, `${url} should be refused`);
    assert.equal(result.error.code, 'request_policy_refused');
  }

  assert.equal(transportCalls, 0);
});

test('enrichment HTTP boundary refuses auth or secret headers before transport', async () => {
  const result = await readEnrichmentHttpText('https://public-news.example.com/article', {
    headers: {
      Authorization: 'Bearer outbound-secret-token',
      'X-API-Key': 'outbound-api-key',
    },
    transport: async () => {
      throw new Error('transport must not be called');
    },
  });
  const serialized = JSON.stringify(result);

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'request_policy_refused');
  assert.equal(serialized.includes('outbound-secret-token'), false);
  assert.equal(serialized.includes('outbound-api-key'), false);
});

test('enrichment HTTP boundary blocks unsafe redirect targets and oversized bodies', async () => {
  const redirectResult = await readEnrichmentHttpText('https://public-news.example.com/article', {
    transport: async () => ({
      status: 200,
      data: 'safe body',
      request: { res: { responseUrl: 'http://127.0.0.1:8787/private' } },
    }),
  });

  const oversizedResult = await readEnrichmentHttpText('https://public-news.example.com/article', {
    maxBytes: 12,
    transport: async (url) => ({
      status: 200,
      data: 'fixture body that is larger than the configured limit',
      request: { res: { responseUrl: url } },
    }),
  });

  assert.equal(redirectResult.ok, false);
  assert.equal(redirectResult.error.code, 'unsafe_redirect_target');
  assert.equal(oversizedResult.ok, false);
  assert.equal(oversizedResult.error.code, 'response_too_large');
});

test('enrichment HTTP boundary normalizes axios failure shapes without leaking raw inputs', async () => {
  const error = new Error(
    'timeout while fetching https://public-news.example.com/article?token=raw-token-value for ACME_PRIVATE_CUSTOMER'
  );
  error.code = 'ECONNABORTED';
  error.config = {
    url: 'https://public-news.example.com/article?api_key=raw-api-key-value',
    headers: {
      Authorization: 'Bearer raw-bearer-value',
      Cookie: 'sid=raw-cookie-value',
    },
  };
  error.response = {
    status: 503,
    data: '<html>ACME_PRIVATE_CUSTOMER raw payload must not leak</html>',
    headers: {
      'set-cookie': 'session=raw-set-cookie-value',
    },
  };

  const result = await readEnrichmentHttpText('https://public-news.example.com/article', {
    transport: async () => {
      throw error;
    },
  });
  const serialized = JSON.stringify(result);

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'timeout');
  assert.equal(result.error.status, 503);
  assert.equal(serialized.includes('raw-token-value'), false);
  assert.equal(serialized.includes('raw-api-key-value'), false);
  assert.equal(serialized.includes('raw-bearer-value'), false);
  assert.equal(serialized.includes('raw-cookie-value'), false);
  assert.equal(serialized.includes('raw-set-cookie-value'), false);
  assert.equal(serialized.includes('ACME_PRIVATE_CUSTOMER'), false);
});

test('enrichment HTTP boundary normalizes DNS and network errors without leaking raw inputs', async () => {
  const error = new Error('getaddrinfo ENOTFOUND raw-token-value ACME_PRIVATE_CUSTOMER');
  error.code = 'ENOTFOUND';
  error.config = {
    url: 'https://public-news.example.com/article?token=raw-token-value',
    headers: {
      Authorization: 'Bearer raw-bearer-value',
    },
  };

  const result = await readEnrichmentHttpText('https://public-news.example.com/article', {
    transport: async () => {
      throw error;
    },
  });
  const serialized = JSON.stringify(result);

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'network_error');
  assert.equal(serialized.includes('raw-token-value'), false);
  assert.equal(serialized.includes('raw-bearer-value'), false);
  assert.equal(serialized.includes('ACME_PRIVATE_CUSTOMER'), false);
});

test('enrichment scraper and URL resolver use local transport fixtures only', async () => {
  const contentCalls = [];
  const articleBody = await fetchArticleContent('https://public-news.example.com/articles/42', {
    transport: async (url) => {
      contentCalls.push(url);
      return {
        status: 200,
        data: '<article><p>Fixture paragraph with enough detail for the local-only enrichment scraper contract.</p></article>',
        request: { res: { responseUrl: url } },
      };
    },
  });

  const resolverCalls = [];
  const resolvedUrl = await resolveOriginalUrl('Fixture Company expansion - Fixture News', {
    transport: async (url) => {
      resolverCalls.push(url);
      return {
        status: 200,
        data: '<a class="result__a" href="/l/?uddg=https%3A%2F%2Fpublic-news.example.com%2Fresolved%2F42">result</a>',
        request: { res: { responseUrl: url } },
      };
    },
  });

  assert.equal(
    articleBody,
    'Fixture paragraph with enough detail for the local-only enrichment scraper contract.'
  );
  assert.deepEqual(contentCalls, ['https://public-news.example.com/articles/42']);
  assert.equal(resolvedUrl, 'https://public-news.example.com/resolved/42');
  assert.equal(resolverCalls.length, 1);
  assert.match(resolverCalls[0], /^https:\/\/html\.duckduckgo\.com\/html\/\?q=/);
});

test('enrichment scraper and URL resolver fail closed on deterministic failure modes', async () => {
  const timeoutBody = await fetchArticleContent('https://public-news.example.com/timeout', {
    transport: async () => {
      const error = new Error('timeout raw-token-value');
      error.code = 'ECONNABORTED';
      throw error;
    },
  });
  const redirectLoopUrl = await resolveOriginalUrl('Fixture redirect loop - Fixture News', {
    transport: async () => {
      const error = new Error('Maximum number of redirects exceeded raw-token-value');
      error.code = 'ERR_FR_TOO_MANY_REDIRECTS';
      throw error;
    },
  });
  const malformedUrl = await resolveOriginalUrl('Malformed fixture - Fixture News', {
    transport: async (url) => ({
      status: 200,
      data: '<html><a class="result__a" href="/l/?uddg=%E0%A4%A">broken</a></html>',
      request: { res: { responseUrl: url } },
    }),
  });
  const serverErrorBody = await fetchArticleContent('https://public-news.example.com/500', {
    transport: async (url) => ({
      status: 500,
      statusText: 'Internal Server Error',
      data: 'ACME_PRIVATE_CUSTOMER payload',
      request: { res: { responseUrl: url } },
    }),
  });
  const hugeBody = await fetchArticleContent('https://public-news.example.com/huge', {
    maxBytes: 20,
    transport: async (url) => ({
      status: 200,
      data: '<article><p>Body that exceeds limit.</p></article>',
      request: { res: { responseUrl: url } },
    }),
  });

  assert.equal(timeoutBody, '');
  assert.equal(redirectLoopUrl, null);
  assert.equal(malformedUrl, null);
  assert.equal(serverErrorBody, '');
  assert.equal(hugeBody, '');
});

test('enrichment outbound boundary audit artifact is non-production and redacted', () => {
  const artifact = buildOutboundHttpEnrichmentBoundaryAudit({
    generatedAt: '2026-06-02T00:00:00.000Z',
    sampleEvidence: {
      url: 'https://b2b-lead-trigger.example.com/api/leads?token=raw-token-value',
      headers: {
        Authorization: 'Bearer raw-bearer-value',
        Cookie: 'sid=raw-cookie-value',
      },
      error: 'ACME_PRIVATE_CUSTOMER raw payload should not leak',
    },
  });
  const redacted = redactEnrichmentHttpEvidence({
    publicUrl: 'https://public-news.example.com/article?utm_source=fixture',
    privateUrl: 'http://10.0.0.4/admin?api_key=raw-api-key-value',
    snippet: 'ACME_PRIVATE_CUSTOMER payload body',
    headers: { Authorization: 'Bearer raw-bearer-value' },
  });
  const serialized = JSON.stringify({ artifact, redacted });

  assert.equal(artifact.documentStatus, OUTBOUND_HTTP_ENRICHMENT_BOUNDARY_STATUS);
  assert.equal(artifact.boundary, 'NOT_PRODUCTION_EVIDENCE');
  assert.equal(artifact.productionReady, false);
  assert.equal(artifact.notProductionEvidence, true);
  assert.equal(artifact.policy.maxRedirects, DEFAULT_ENRICHMENT_HTTP_POLICY.maxRedirects);
  assert.ok(artifact.transportContract.injectable);
  assert.ok(artifact.failureModeCoverage.includes('redirect_loop'));
  assert.equal(serialized.includes('raw-token-value'), false);
  assert.equal(serialized.includes('raw-bearer-value'), false);
  assert.equal(serialized.includes('raw-cookie-value'), false);
  assert.equal(serialized.includes('raw-api-key-value'), false);
  assert.equal(serialized.includes('ACME_PRIVATE_CUSTOMER'), false);
});

test('enrichment outbound boundary audit CLI writes local non-production artifact only', () => {
  const dir = mkdtempSync(join(tmpdir(), 'enrichment-outbound-boundary-'));
  const outputPath = join(dir, 'audit.json');

  try {
    const result = spawnSync(process.execPath, [
      'scripts/outbound-http-enrichment-boundary-audit.mjs',
      '--json',
      '--output',
      outputPath,
    ], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, new RegExp(OUTBOUND_HTTP_ENRICHMENT_BOUNDARY_STATUS));

    const artifact = JSON.parse(readFileSync(outputPath, 'utf8'));
    const serialized = JSON.stringify(artifact);
    assert.equal(artifact.documentStatus, OUTBOUND_HTTP_ENRICHMENT_BOUNDARY_STATUS);
    assert.equal(artifact.boundary, 'NOT_PRODUCTION_EVIDENCE');
    assert.equal(artifact.productionReady, false);
    assert.equal(artifact.notProductionEvidence, true);
    assert.equal(serialized.includes('raw-token-value'), false);
    assert.equal(serialized.includes('raw-bearer-value'), false);
    assert.equal(serialized.includes('ACME_PRIVATE_CUSTOMER'), false);

    const firstWrite = readFileSync(outputPath, 'utf8');
    const secondResult = spawnSync(process.execPath, [
      'scripts/outbound-http-enrichment-boundary-audit.mjs',
      '--json',
      '--output',
      outputPath,
    ], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });

    assert.equal(secondResult.status, 0, secondResult.stderr);
    assert.equal(readFileSync(outputPath, 'utf8'), firstWrite);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
