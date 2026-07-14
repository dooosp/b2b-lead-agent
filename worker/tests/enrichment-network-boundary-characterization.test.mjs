import test from 'node:test';
import assert from 'node:assert/strict';

import { fetchArticleBodyWorker } from '../api/enrichment.js';
import {
  createWorkerOutboundHttpContext,
  DEFAULT_WORKER_OUTBOUND_POLICY,
  fetchWorkerOutboundText,
  resolvePublicDnsAddresses,
  WorkerOutboundHttpError,
} from '../lib/outbound-http.js';
import { fetchGoogleNewsWorker } from '../self-service/news.js';

const PUBLIC_IPV4 = '93.184.216.34';
const PUBLIC_IPV6 = '2606:4700:4700::1111';

function articleHtml(marker, padding = '') {
  return `<article><p>${marker} synthetic article body that is deliberately longer than thirty characters. ${padding}</p></article>`;
}

function rssXml(marker = 'RSS MARKER') {
  return `<?xml version="1.0"?><rss><channel><item><title>${marker}</title><link>https://news.example/item</link><description>fixture</description><pubDate>Tue, 14 Jul 2026 00:00:00 GMT</pubDate></item></channel></rss>`;
}

function publicResolver(addresses = [PUBLIC_IPV4, PUBLIC_IPV6]) {
  return async () => addresses;
}

function htmlResponse(body, init = {}) {
  return new Response(body, {
    status: init.status || 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...init.headers },
  });
}

async function expectOutboundError(fn, code) {
  await assert.rejects(fn, (error) => {
    assert.ok(error instanceof WorkerOutboundHttpError);
    assert.equal(error.code, code);
    return true;
  });
}

test('desired contract: a shared outbound URL policy protects every worker enrichment request', async () => {
  const calls = [];
  const fetchImpl = async (input, init) => {
    calls.push({ input: String(input), init });
    if (String(input).includes('news.google.com/')) {
      return new Response(rssXml(), {
        status: 200,
        headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
      });
    }
    return htmlResponse(articleHtml('SHARED POLICY MARKER'));
  };
  const dependencies = { fetchImpl, resolveHostname: publicResolver() };

  const article = await fetchArticleBodyWorker('https://public-fixture.example/article', dependencies);
  const news = await fetchGoogleNewsWorker('synthetic query', dependencies);

  assert.match(article, /SHARED POLICY MARKER/);
  assert.equal(news.length, 1);
  assert.equal(calls.length, 2);
  assert.ok(calls.every((call) => call.init.redirect === 'manual'));
  assert.ok(calls.every((call) => call.init.signal instanceof AbortSignal));
});

test('request-scoped outbound context reuses public DNS answers without cross-request caching', async () => {
  let dnsFetchCalls = 0;
  const context = createWorkerOutboundHttpContext({
    fetchImpl: async (input) => {
      dnsFetchCalls += 1;
      const type = new URL(input).searchParams.get('type');
      return new Response(JSON.stringify({
        Status: 0,
        Answer: type === 'A'
          ? [{ type: 1, data: PUBLIC_IPV4 }]
          : [{ type: 28, data: PUBLIC_IPV6 }],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/dns-json' },
      });
    },
  });

  const firstRequestResults = await Promise.all([
    context.resolveHostname('public-fixture.example'),
    context.resolveHostname('public-fixture.example'),
    context.resolveHostname('public-fixture.example'),
  ]);
  assert.equal(dnsFetchCalls, 2);
  assert.deepEqual(firstRequestResults[0], [PUBLIC_IPV4, PUBLIC_IPV6]);

  const nextRequestContext = createWorkerOutboundHttpContext({ fetchImpl: context.fetchImpl });
  await nextRequestContext.resolveHostname('public-fixture.example');
  assert.equal(dnsFetchCalls, 4);
});

test('desired contract: outbound enrichment accepts only http and https URL schemes', async () => {
  let fetchCalls = 0;
  await expectOutboundError(() => fetchWorkerOutboundText('file:///etc/passwd', {
    fetchImpl: async () => {
      fetchCalls += 1;
      return htmlResponse(articleHtml('UNREACHABLE'));
    },
    resolveHostname: publicResolver(),
  }), 'unsafe_url_scheme');
  assert.equal(fetchCalls, 0);
});

test('desired contract: outbound policy validates both hostnames and resolved addresses', async (t) => {
  await t.test('blocks internal hostnames before DNS or fetch', async () => {
    let resolverCalls = 0;
    let fetchCalls = 0;
    await expectOutboundError(() => fetchWorkerOutboundText('https://metadata.google.internal/latest', {
      fetchImpl: async () => {
        fetchCalls += 1;
        return htmlResponse(articleHtml('UNREACHABLE'));
      },
      resolveHostname: async () => {
        resolverCalls += 1;
        return [PUBLIC_IPV4];
      },
    }), 'unsafe_hostname');
    assert.equal(resolverCalls, 0);
    assert.equal(fetchCalls, 0);
  });

  await t.test('queries A and AAAA records and rejects a mixed private DNS answer', async () => {
    const dnsQueries = [];
    const dnsFetch = async (input, init) => {
      const url = new URL(input);
      dnsQueries.push({ type: url.searchParams.get('type'), init });
      const answer = url.searchParams.get('type') === 'A'
        ? [{ type: 1, data: PUBLIC_IPV4 }]
        : [{ type: 28, data: PUBLIC_IPV6 }];
      return new Response(JSON.stringify({ Status: 0, Answer: answer }), {
        status: 200,
        headers: { 'Content-Type': 'application/dns-json' },
      });
    };
    const addresses = await resolvePublicDnsAddresses('public-fixture.example', {
      fetchImpl: dnsFetch,
      signal: new AbortController().signal,
    });
    assert.deepEqual(new Set(addresses), new Set([PUBLIC_IPV4, PUBLIC_IPV6]));
    assert.deepEqual(new Set(dnsQueries.map(({ type }) => type)), new Set(['A', 'AAAA']));
    assert.ok(dnsQueries.every(({ init }) => init.redirect === 'error'));

    let fetchCalls = 0;
    await expectOutboundError(() => fetchWorkerOutboundText('https://public-fixture.example/article', {
      fetchImpl: async () => {
        fetchCalls += 1;
        return htmlResponse(articleHtml('UNREACHABLE'));
      },
      resolveHostname: publicResolver([PUBLIC_IPV4, '10.0.0.8']),
    }), 'unsafe_ip_address');
    assert.equal(fetchCalls, 0);
  });
});

test('desired contract: private, loopback, link-local, multicast, and reserved addresses are rejected', async (t) => {
  const blocked = [
    ['private IPv4', '10.23.45.67'],
    ['IPv4 loopback', '127.0.0.1'],
    ['IPv4 link-local', '169.254.169.254'],
    ['IPv4 multicast', '224.0.0.1'],
    ['IPv4 reserved documentation', '203.0.113.10'],
    ['IPv6 loopback', '::1'],
    ['IPv6 link-local', 'fe80::1'],
    ['IPv6 private', 'fd00::1'],
    ['IPv6 multicast', 'ff02::1'],
    ['IPv6 reserved documentation', '2001:db8::1'],
    ['IPv6 current documentation', '3fff::1'],
    ['IPv6 non-global SRv6 SID', '5f00::1'],
  ];

  for (const [name, address] of blocked) {
    await t.test(name, async () => {
      const literal = address.includes(':') ? `[${address}]` : address;
      let fetchCalls = 0;
      await expectOutboundError(() => fetchWorkerOutboundText(`http://${literal}/internal`, {
        fetchImpl: async () => {
          fetchCalls += 1;
          return htmlResponse(articleHtml('UNREACHABLE'));
        },
        resolveHostname: publicResolver(),
      }), 'unsafe_ip_address');
      assert.equal(fetchCalls, 0);
    });
  }

  const nonCanonicalLoopbackUrls = [
    'http://2130706433/internal',
    'http://0x7f000001/internal',
    'http://0177.0.0.1/internal',
    'http://127.1/internal',
  ];
  for (const url of nonCanonicalLoopbackUrls) {
    await t.test(`non-canonical loopback ${url}`, async () => {
      await expectOutboundError(() => fetchWorkerOutboundText(url, {
        fetchImpl: async () => htmlResponse(articleHtml('UNREACHABLE')),
        resolveHostname: publicResolver(),
      }), 'unsafe_ip_address');
    });
  }
});

test('desired contract: every redirect hop is validated before it is followed', async (t) => {
  await t.test('blocks a private Location before issuing the next fetch', async () => {
    const calls = [];
    const fetchImpl = async (input, init) => {
      calls.push({ input: String(input), init });
      return new Response(null, {
        status: 302,
        headers: { Location: 'http://127.0.0.1/private-after-redirect' },
      });
    };

    await expectOutboundError(() => fetchWorkerOutboundText('https://public-fixture.example/start', {
      fetchImpl,
      resolveHostname: publicResolver(),
    }), 'unsafe_ip_address');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].init.redirect, 'manual');
  });

  await t.test('refuses a transport that followed redirects automatically', async () => {
    let bodyReads = 0;
    await expectOutboundError(() => fetchWorkerOutboundText('https://public-fixture.example/start', {
      fetchImpl: async () => ({
        ok: true,
        redirected: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'text/html' }),
        body: {
          getReader() {
            bodyReads += 1;
            throw new Error('body must not be consumed');
          },
          async cancel() {},
        },
      }),
      resolveHostname: publicResolver(),
    }), 'automatic_redirect_not_allowed');
    assert.equal(bodyReads, 0);
  });

  await t.test('refuses an unexpected final response URL even if redirected is false', async () => {
    await expectOutboundError(() => fetchWorkerOutboundText('https://public-fixture.example/start', {
      fetchImpl: async () => ({
        ok: true,
        redirected: false,
        status: 200,
        url: 'http://127.0.0.1/private-after-redirect',
        headers: new Headers({ 'Content-Type': 'text/html' }),
        body: { async cancel() {} },
      }),
      resolveHostname: publicResolver(),
    }), 'automatic_redirect_not_allowed');
  });
});

test('desired contract: redirect following has a strict maximum hop count', async () => {
  const calls = [];
  const fetchImpl = async (input, init) => {
    calls.push({ input: String(input), init });
    return new Response(null, {
      status: 302,
      headers: { Location: `/hop-${calls.length}` },
    });
  };

  await expectOutboundError(() => fetchWorkerOutboundText('https://public-fixture.example/start', {
    policy: { ...DEFAULT_WORKER_OUTBOUND_POLICY, maxRedirects: 2 },
    fetchImpl,
    resolveHostname: publicResolver(),
  }), 'too_many_redirects');
  assert.equal(calls.length, 3);
});

test('desired contract: enrichment responses use a strict content-type allowlist', async () => {
  await expectOutboundError(() => fetchWorkerOutboundText('https://public-fixture.example/binary', {
    fetchImpl: async () => new Response(articleHtml('BINARY MARKER'), {
      status: 200,
      headers: { 'Content-Type': 'application/octet-stream' },
    }),
    resolveHostname: publicResolver(),
  }), 'content_type_not_allowed');
});

test('desired contract: enrichment enforces response-size and timeout limits before consuming the body', async (t) => {
  await t.test('rejects declared oversized bodies without pulling the stream', async () => {
    let readerCalls = 0;
    let cancelCalls = 0;
    await expectOutboundError(() => fetchWorkerOutboundText('https://public-fixture.example/oversized', {
      policy: { ...DEFAULT_WORKER_OUTBOUND_POLICY, maxResponseBytes: 32 },
      fetchImpl: async () => ({
        ok: true,
        redirected: false,
        status: 200,
        headers: new Headers({
          'Content-Type': 'text/html',
          'Content-Length': '1024',
        }),
        body: {
          getReader() {
            readerCalls += 1;
            throw new Error('body must not be consumed');
          },
          async cancel() {
            cancelCalls += 1;
          },
        },
      }),
      resolveHostname: publicResolver(),
    }), 'response_too_large');
    assert.equal(readerCalls, 0);
    assert.equal(cancelCalls, 1);
  });

  await t.test('stops streamed bodies at the byte limit', async () => {
    await expectOutboundError(() => fetchWorkerOutboundText('https://public-fixture.example/streamed-oversized', {
      policy: { ...DEFAULT_WORKER_OUTBOUND_POLICY, maxResponseBytes: 64 },
      fetchImpl: async () => htmlResponse(articleHtml('STREAMED OVERSIZED', 'x'.repeat(256))),
      resolveHostname: publicResolver(),
    }), 'response_too_large');
  });

  await t.test('aborts the complete DNS/fetch/body operation at one deadline', async () => {
    await expectOutboundError(() => fetchWorkerOutboundText('https://public-fixture.example/slow', {
      policy: { ...DEFAULT_WORKER_OUTBOUND_POLICY, timeoutMs: 10 },
      fetchImpl: async (_input, init) => new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
      }),
      resolveHostname: publicResolver(),
    }), 'outbound_timeout');
  });
});
