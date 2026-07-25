import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WORKBENCH_HTML_MAX_BYTES,
  escapeWorkbenchHtml,
  renderOfficialEvidenceWorkbenchErrorPage,
  renderOfficialEvidenceWorkbenchPage
} from '../evidence-claim-workbench/renderer.mjs';

const TOKEN = 'a'.repeat(64);

function documentSummary(overrides = {}) {
  return {
    documentId: 'doc_synthetic_renderer',
    title: '합성 중전압 배전반 기술자료',
    publisher: 'Synthetic Publisher',
    documentNumber: 'SYNTH-MVS-001',
    revision: 'rev-2',
    language: 'ko',
    jurisdiction: 'KR',
    productFamilies: ['medium_voltage_switchgear'],
    fileSha256: 'b'.repeat(64),
    pageCount: 2,
    reviewState: 'REVIEW_REQUIRED',
    relationshipMarkers: [],
    ...overrides
  };
}

test('renderer emits one Korean-first accessible Workbench shell with external same-origin assets', () => {
  const html = renderOfficialEvidenceWorkbenchPage({ capabilityToken: TOKEN, documents: [documentSummary()] });
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.match(html, /<html lang="ko">/);
  assert.match(html, /<main id="workbench-main" aria-labelledby="workbench-heading">/);
  assert.match(html, /<nav class="panel document-panel" aria-labelledby="document-queue-heading">/);
  assert.match(html, /<script type="module" src="\/assets\/app\.js"><\/script>/);
  assert.match(html, /<link rel="stylesheet" href="\/assets\/styles\.css">/);
  assert.doesNotMatch(html, /<script(?! type="module" src=)[^>]*>/);
  assert.doesNotMatch(html, /\son(?:click|load|error)=/i);
  assert.doesNotMatch(html, /<style\b/i);
  assert.ok(Buffer.byteLength(html, 'utf8') < WORKBENCH_HTML_MAX_BYTES);
});

test('renderer keeps source identity, printed locator, exact quote, typed controls, and trust boundary together', () => {
  const html = renderOfficialEvidenceWorkbenchPage({ capabilityToken: TOKEN, documents: [documentSummary()] });
  for (const id of [
    'rail-publisher', 'rail-document', 'rail-document-number', 'rail-revision', 'rail-page', 'rail-locator',
    'rail-context-before', 'rail-quote', 'rail-context-after', 'rail-offsets', 'rail-occurrence',
    'claim-type', 'product-family', 'capability-key', 'value-type', 'candidate-unit', 'condition-key', 'condition-value',
    'decision-fieldset', 'review-errors', 'workbench-status', 'patch-preview', 'copy-patch', 'download-patch'
  ]) assert.match(html, new RegExp(`id="${id}"`), id);
  assert.match(html, /medium_voltage_switchgear/);
  assert.match(html, /transformer/);
  assert.match(html, /UNVERIFIED/);
  assert.match(html, /<strong>BLOCKED<\/strong>/);
  assert.match(html, /READY_FOR_CODE_REVIEW|\uCF54\uB4DC \uB9AC\uBDF0/);
  assert.match(html, /textarea id="patch-preview"[^>]*readonly/);
  assert.doesNotMatch(html, /type="file"|contenteditable|name="reviewer|name="status|name="hash/i);
});

test('renderer escapes hostile document metadata in text and attribute positions', () => {
  const hostile = `</script><script>globalThis.pwned=1</script><img src=x onerror="globalThis.pwned=2">'&`;
  const html = renderOfficialEvidenceWorkbenchPage({
    capabilityToken: TOKEN,
    documents: [documentSummary({ documentId: hostile, title: hostile, publisher: hostile, revision: hostile })]
  });
  assert.doesNotMatch(html, /<script>globalThis\.pwned|<img src=x|\sonerror="/);
  assert.match(html, /&lt;\/script&gt;&lt;script&gt;globalThis\.pwned=1&lt;\/script&gt;/);
  assert.match(html, /&#39;&amp;/);
  assert.equal(escapeWorkbenchHtml(`&<>"'`), '&amp;&lt;&gt;&quot;&#39;');
});

test('renderer refuses invalid capability tokens and oversized document summary lists', () => {
  assert.throws(() => renderOfficialEvidenceWorkbenchPage({ capabilityToken: 'short', documents: [] }), /WORKBENCH_CAPABILITY_TOKEN_INVALID/);
  assert.throws(() => renderOfficialEvidenceWorkbenchPage({ capabilityToken: TOKEN, documents: Array.from({ length: 101 }, () => documentSummary()) }), /WORKBENCH_DOCUMENT_SUMMARY_INVALID/);
});

test('generic error page leaks no supplied data and preserves the non-production boundary', () => {
  const html = renderOfficialEvidenceWorkbenchErrorPage({ capabilityToken: TOKEN, statusCode: 503 });
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.match(html, /NOT_PRODUCTION_EVIDENCE/);
  assert.match(html, /Status: 503/);
  assert.doesNotMatch(html, /\/Users\/|node:internal|Bearer|stack/i);
});
