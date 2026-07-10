import test from 'node:test';
import assert from 'node:assert/strict';

import { fetchArticleBodyWorker } from '../api/enrichment.js';
import { withMockedFetch } from './helpers/http.mjs';

function articleHtml(marker, padding = '') {
  return `<article><p>${marker} synthetic article body that is deliberately longer than thirty characters. ${padding}</p></article>`;
}

async function captureArticleFetch(url, responseFactory) {
  const calls = [];
  const body = await withMockedFetch(async (input, init) => {
    calls.push({ input: String(input), init });
    return responseFactory();
  }, () => fetchArticleBodyWorker(url));
  return { body, calls };
}

test('characterization: current behavior attempts private, loopback, localhost, and link-local article URLs', async (t) => {
  const cases = [
    ['private IPv4', 'http://10.23.45.67/internal', 'PRIVATE IPV4 MARKER'],
    ['IPv4 loopback', 'http://127.0.0.1:8787/admin', 'IPV4 LOOPBACK MARKER'],
    ['localhost', 'http://localhost:8787/admin', 'LOCALHOST MARKER'],
    ['link-local metadata style', 'http://169.254.169.254/latest/meta-data/', 'LINK LOCAL MARKER'],
  ];

  for (const [name, url, marker] of cases) {
    await t.test(name, async () => {
      const result = await captureArticleFetch(url, () => new Response(articleHtml(marker), {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }));

      assert.equal(result.calls.length, 1);
      assert.equal(result.calls[0].input, url);
      assert.equal(result.calls[0].init.redirect, 'follow');
      assert.ok(result.calls[0].init.signal instanceof AbortSignal);
      // This assertion records the current audited behavior. It is not the
      // desired security contract and is expected to change in remediation.
      assert.match(result.body, new RegExp(marker));
    });
  }
});

test('characterization: automatic redirect mode accepts a mocked final response from a private address', async () => {
  const publicUrl = 'https://public-fixture.example/redirect-entry';
  const finalPrivateUrl = 'http://127.0.0.1/private-after-redirect';
  const result = await captureArticleFetch(publicUrl, () => ({
    ok: true,
    redirected: true,
    url: finalPrivateUrl,
    headers: new Headers({ 'Content-Type': 'text/html; charset=utf-8' }),
    async text() {
      return articleHtml('PRIVATE REDIRECT TARGET MARKER');
    },
  }));

  assert.equal(result.calls.length, 1);
  assert.equal(result.calls[0].input, publicUrl);
  assert.equal(result.calls[0].init.redirect, 'follow');
  // This assertion records the current audited behavior. It is not the desired
  // security contract and is expected to change in the remediation PR.
  assert.match(result.body, /PRIVATE REDIRECT TARGET MARKER/);
});

test('characterization: unsupported content type is consumed as HTML', async () => {
  const result = await captureArticleFetch(
    'https://public-fixture.example/octet-stream',
    () => new Response(articleHtml('OCTET STREAM MARKER'), {
      status: 200,
      headers: { 'Content-Type': 'application/octet-stream' },
    }),
  );

  assert.equal(result.calls.length, 1);
  // This assertion records the current audited behavior. It is not the desired
  // security contract and is expected to change in the remediation PR.
  assert.match(result.body, /OCTET STREAM MARKER/);
});

test('characterization: oversized response is fully materialized before extracted text is truncated', async () => {
  const oversizedHtml = articleHtml('OVERSIZED BODY MARKER', 'x'.repeat(1024 * 1024));
  let textCalls = 0;
  const result = await captureArticleFetch(
    'https://public-fixture.example/oversized',
    () => ({
      ok: true,
      headers: new Headers({ 'Content-Type': 'text/html; charset=utf-8' }),
      async text() {
        textCalls += 1;
        return oversizedHtml;
      },
    }),
  );

  assert.ok(Buffer.byteLength(oversizedHtml) > 1024 * 1024);
  assert.equal(textCalls, 1);
  // This assertion records the current audited behavior. It is not the desired
  // response-size contract and is expected to change in the remediation PR.
  assert.equal(result.body.length, 3000);
  assert.match(result.body, /^OVERSIZED BODY MARKER/);
});

test.todo('desired contract: a shared outbound URL policy protects every worker enrichment request');
test.todo('desired contract: outbound enrichment accepts only http and https URL schemes');
test.todo('desired contract: outbound policy validates both hostnames and resolved addresses');
test.todo('desired contract: private, loopback, link-local, multicast, and reserved addresses are rejected');
test.todo('desired contract: every redirect hop is validated before it is followed');
test.todo('desired contract: redirect following has a strict maximum hop count');
test.todo('desired contract: enrichment responses use a strict content-type allowlist');
test.todo('desired contract: enrichment enforces response-size and timeout limits before consuming the body');
