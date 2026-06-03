const { enrichArticles } = require('./article-enricher');
const { fetchArticleContent } = require('./article-content-scraper');
const { resolveOriginalUrl } = require('./article-url-resolver');
const {
  readEnrichmentHttpText,
  redactEnrichmentHttpEvidence,
} = require('./outbound-http-boundary');

const ENRICHMENT_FIXTURE_REPLAY_STATUS =
  'ENRICHMENT_FIXTURE_REPLAY_OUTPUT_CONTRACT_NON_PRODUCTION';
const ENRICHMENT_FIXTURE_REPLAY_TIMESTAMP = '2026-06-03T00:00:00.000Z';
const MAX_SNIPPET_CHARS = 160;

const URLS = Object.freeze({
  googleDiscovery: 'https://news.google.com/rss/articles/fixture-success',
  successArticle: 'https://public-news.example.com/articles/success',
  redirectEntry: 'https://public-news.example.com/articles/redirect',
  redirectFinal: 'https://public-news.example.com/articles/redirect-final',
  timeout: 'https://public-news.example.com/articles/timeout',
  empty: 'https://public-news.example.com/articles/empty',
  blockedPrivate: 'http://127.0.0.1:8787/private?token=raw-token-value',
  http404: 'https://public-news.example.com/articles/not-found',
  http500: 'https://public-news.example.com/articles/server-error',
  oversized: 'https://public-news.example.com/articles/oversized',
});

const CASE_ORDER = Object.freeze([
  'success_resolved_article',
  'success_safe_redirect',
  'failure_timeout',
  'failure_malformed_search_html',
  'failure_empty_content',
  'failure_blocked_private_url',
  'failure_http_404',
  'failure_http_500',
  'failure_oversized_body',
]);

const NORMALIZED_FIELDS = Object.freeze([
  'caseId',
  'sourceLabel',
  'outcome',
  'resolution',
  'requestedUrlLabel',
  'finalUrlLabel',
  'redirected',
  'status',
  'failureCode',
  'failureReason',
  'body',
  'transport',
]);

const FAILURE_TAXONOMY = Object.freeze([
  'empty_content',
  'http_status',
  'malformed_html',
  'request_policy_refused',
  'response_too_large',
  'timeout',
]);

function duckDuckGoResult(url) {
  return `<a class="result__a" href="/l/?uddg=${encodeURIComponent(url)}">fixture result</a>`;
}

function articleHtml(body) {
  return `<html><body><article><p>${body}</p></article></body></html>`;
}

const SUCCESS_BODY = [
  'Fixture refrigeration system upgrade gives the local replay enough verified article body text',
  'to exercise scraper normalization, source labeling, and trusted body classification without',
  'calling a live publisher endpoint or storing raw HTML in evidence.',
].join(' ');

const REDIRECT_BODY = [
  'Fixture redirected article body confirms safe redirect handling and deterministic replay output',
  'while remaining fully synthetic, public-labeled, and independent of any live external HTTP call.',
].join(' ');

function labelUrl(rawUrl, caseId) {
  let parsed;
  try {
    parsed = new URL(String(rawUrl || ''));
  } catch {
    return 'fixture-invalid-url';
  }

  if (parsed.hostname === 'html.duckduckgo.com') {
    if (caseId === 'success_resolved_article') return 'fixture-search-success';
    if (caseId === 'failure_malformed_search_html') {
      return parsed.searchParams.get('q')?.includes('뉴스')
        ? 'fixture-search-malformed-fallback'
        : 'fixture-search-malformed-primary';
    }
    return 'fixture-search';
  }

  if (parsed.hostname === 'news.google.com') return 'fixture-google-news-discovery';
  if (parsed.hostname === '127.0.0.1') return 'fixture-private-blocked-url';

  const path = parsed.pathname;
  if (path === '/articles/success') return 'fixture-public-success-article';
  if (path === '/articles/redirect') return 'fixture-public-redirect-entry';
  if (path === '/articles/redirect-final') return 'fixture-public-redirect-final';
  if (path === '/articles/timeout') return 'fixture-public-timeout';
  if (path === '/articles/empty') return 'fixture-public-empty';
  if (path === '/articles/not-found') return 'fixture-public-404';
  if (path === '/articles/server-error') return 'fixture-public-500';
  if (path === '/articles/oversized') return 'fixture-public-oversized';
  return 'fixture-public-url';
}

function createFixtureTransport(caseId) {
  const requests = [];

  async function transport(url) {
    const requestLabel = labelUrl(url, caseId);
    const request = {
      label: requestLabel,
      finalUrlLabel: requestLabel,
      redirected: false,
    };
    requests.push(request);

    if (caseId === 'success_resolved_article' && requestLabel === 'fixture-search-success') {
      return {
        status: 200,
        data: duckDuckGoResult(URLS.successArticle),
        request: { res: { responseUrl: url } },
      };
    }

    if (caseId === 'success_resolved_article' && requestLabel === 'fixture-public-success-article') {
      return {
        status: 200,
        data: articleHtml(SUCCESS_BODY),
        headers: {
          Authorization: 'Bearer raw-auth-like-value',
          Cookie: 'sid=raw-cookie-value',
        },
        request: { res: { responseUrl: url } },
      };
    }

    if (caseId === 'success_safe_redirect' && requestLabel === 'fixture-public-redirect-entry') {
      request.finalUrlLabel = 'fixture-public-redirect-final';
      request.redirected = true;
      return {
        status: 200,
        data: articleHtml(REDIRECT_BODY),
        request: { res: { responseUrl: URLS.redirectFinal } },
      };
    }

    if (caseId === 'failure_timeout') {
      const error = new Error(
        'timeout raw-token-value ACME_PRIVATE_CUSTOMER private.customer@example.com'
      );
      error.code = 'ECONNABORTED';
      error.config = {
        url: `${URLS.timeout}?api_key=raw-api-key-value`,
        headers: {
          Authorization: 'Bearer raw-auth-like-value',
          Cookie: 'sid=raw-cookie-value',
        },
      };
      throw error;
    }

    if (caseId === 'failure_malformed_search_html') {
      return {
        status: 200,
        data: '<html><a class="result__a" href="/l/?uddg=%E0%A4%A">broken</a></html>',
        request: { res: { responseUrl: url } },
      };
    }

    if (caseId === 'failure_empty_content') {
      return {
        status: 200,
        data: '<html><body><p>short</p></body></html>',
        request: { res: { responseUrl: url } },
      };
    }

    if (caseId === 'failure_http_404') {
      return {
        status: 404,
        data: '<html>ACME_PRIVATE_CUSTOMER not found raw payload</html>',
        request: { res: { responseUrl: url } },
      };
    }

    if (caseId === 'failure_http_500') {
      return {
        status: 500,
        data: '<html>Authorization: Bearer raw-auth-like-value</html>',
        request: { res: { responseUrl: url } },
      };
    }

    if (caseId === 'failure_oversized_body') {
      return {
        status: 200,
        data: articleHtml('oversized fixture body '.repeat(20)),
        request: { res: { responseUrl: url } },
      };
    }

    const error = new Error('fixture transport route missing');
    error.code = 'ENRICHMENT_FIXTURE_MISSING';
    throw error;
  }

  transport.summary = () => ({
    requestCount: requests.length,
    requestLabels: requests.map((request) => request.label),
    liveNetworkCalls: 0,
    lastFinalUrlLabel: requests.length ? requests[requests.length - 1].finalUrlLabel : '',
    redirected: requests.some((request) => request.redirected),
  });

  return transport;
}

function sanitizeSnippet(value) {
  const withoutTags = String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const redacted = String(redactEnrichmentHttpEvidence(withoutTags, 'contentPreview') || '')
    .replace(/\s+/g, ' ')
    .trim();

  if (redacted.length <= MAX_SNIPPET_CHARS) return redacted;
  return `${redacted.slice(0, MAX_SNIPPET_CHARS - 3).trimEnd()}...`;
}

function bodySummary({ available, text = '', source = 'missing', trust = 'missing' }) {
  const snippet = available ? sanitizeSnippet(text) : '';
  return {
    available: Boolean(available && snippet),
    source,
    trust,
    length: available ? String(text || '').length : 0,
    snippet,
  };
}

function baseEntry(caseId, sourceLabel, transport) {
  const summary = transport.summary();
  return {
    caseId,
    sourceLabel,
    outcome: 'failure',
    resolution: 'not_applicable',
    requestedUrlLabel: summary.requestLabels[0] || '',
    finalUrlLabel: summary.lastFinalUrlLabel || summary.requestLabels[0] || '',
    redirected: summary.redirected,
    status: null,
    failureCode: null,
    failureReason: null,
    body: bodySummary({ available: false }),
    transport: {
      requestCount: summary.requestCount,
      requestLabels: summary.requestLabels,
      liveNetworkCalls: 0,
    },
  };
}

async function runSuccessResolvedArticleCase() {
  const caseId = 'success_resolved_article';
  const transport = createFixtureTransport(caseId);
  const articles = [{
    title: 'Fixture refrigeration system upgrade - Fixture News',
    link: URLS.googleDiscovery,
    source: 'Fixture News',
    query: 'fixture replay success',
    content: '',
  }];

  await enrichArticles(articles, {
    batchSize: 1,
    delayMs: 0,
    urlResolver: (title) => resolveOriginalUrl(title, { transport }),
    contentFetcher: (url) => fetchArticleContent(url, { transport }),
  });

  const article = articles[0];
  const entry = baseEntry(caseId, 'fixture:resolved-article', transport);
  return {
    ...entry,
    outcome: 'success',
    resolution: article.resolvedUrl ? 'resolved' : 'unresolved',
    requestedUrlLabel: 'fixture-google-news-discovery',
    finalUrlLabel: labelUrl(article.link, caseId),
    redirected: false,
    body: bodySummary({
      available: Boolean(article.content),
      text: article.content,
      source: article.bodySource,
      trust: article.bodyTrust,
    }),
  };
}

async function runSafeRedirectCase() {
  const caseId = 'success_safe_redirect';
  const transport = createFixtureTransport(caseId);
  const articles = [{
    title: 'Fixture safe redirect article',
    link: URLS.redirectEntry,
    source: 'Fixture News',
    query: 'fixture replay redirect',
    content: '',
  }];

  await enrichArticles(articles, {
    batchSize: 1,
    delayMs: 0,
    resolveUrls: false,
    contentFetcher: (url) => fetchArticleContent(url, { transport }),
  });

  const article = articles[0];
  const entry = baseEntry(caseId, 'fixture:safe-redirect', transport);
  return {
    ...entry,
    outcome: 'success',
    body: bodySummary({
      available: Boolean(article.content),
      text: article.content,
      source: article.bodySource,
      trust: article.bodyTrust,
    }),
  };
}

async function runBoundaryFailureCase(caseId, sourceLabel, url, options = {}) {
  const transport = createFixtureTransport(caseId);
  const result = await readEnrichmentHttpText(url, {
    transport,
    maxBytes: options.maxBytes,
  });
  const entry = baseEntry(caseId, sourceLabel, transport);

  return {
    ...entry,
    requestedUrlLabel: entry.requestedUrlLabel || labelUrl(url, caseId),
    finalUrlLabel: entry.finalUrlLabel || labelUrl(url, caseId),
    status: result.error?.status || null,
    failureCode: result.error?.code || 'transport_error',
    failureReason: result.error?.reason || null,
  };
}

async function runMalformedSearchHtmlCase() {
  const caseId = 'failure_malformed_search_html';
  const transport = createFixtureTransport(caseId);
  const resolvedUrl = await resolveOriginalUrl('Malformed fixture - Fixture News', { transport });
  const entry = baseEntry(caseId, 'fixture:malformed-search-html', transport);

  return {
    ...entry,
    resolution: resolvedUrl ? 'resolved' : 'unresolved',
    failureCode: resolvedUrl ? null : 'malformed_html',
  };
}

async function runEmptyContentCase() {
  const caseId = 'failure_empty_content';
  const transport = createFixtureTransport(caseId);
  const content = await fetchArticleContent(URLS.empty, { transport });
  const entry = baseEntry(caseId, 'fixture:empty-content', transport);

  return {
    ...entry,
    failureCode: content ? null : 'empty_content',
  };
}

async function runEnrichmentFixtureReplay() {
  const replay = [
    await runSuccessResolvedArticleCase(),
    await runSafeRedirectCase(),
    await runBoundaryFailureCase('failure_timeout', 'fixture:timeout', URLS.timeout),
    await runMalformedSearchHtmlCase(),
    await runEmptyContentCase(),
    await runBoundaryFailureCase('failure_blocked_private_url', 'fixture:blocked-private-url', URLS.blockedPrivate),
    await runBoundaryFailureCase('failure_http_404', 'fixture:http-404', URLS.http404),
    await runBoundaryFailureCase('failure_http_500', 'fixture:http-500', URLS.http500),
    await runBoundaryFailureCase('failure_oversized_body', 'fixture:oversized-body', URLS.oversized, { maxBytes: 80 }),
  ];

  return replay.sort((left, right) => CASE_ORDER.indexOf(left.caseId) - CASE_ORDER.indexOf(right.caseId));
}

function buildRedactionProbe() {
  return sanitizeSnippet([
    'Authorization: Bearer raw-auth-like-value',
    'Cookie: sid=raw-cookie-value',
    'https://b2b-lead-trigger.example.com/api/leads?token=raw-token-value',
    'ACME_PRIVATE_CUSTOMER private.customer@example.com',
  ].join('\n'));
}

async function buildEnrichmentFixtureReplayArtifact(input = {}) {
  const replay = input.replay || await runEnrichmentFixtureReplay();
  const successCount = replay.filter((entry) => entry.outcome === 'success').length;
  const failureCount = replay.filter((entry) => entry.outcome === 'failure').length;

  return {
    documentStatus: ENRICHMENT_FIXTURE_REPLAY_STATUS,
    generatedAt: input.generatedAt || ENRICHMENT_FIXTURE_REPLAY_TIMESTAMP,
    repo: 'dooosp/b2b-lead-agent',
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    notProductionEvidence: true,
    productionReady: false,
    productionReviewerWorkflowReady: false,
    issueRefs: {
      level1ProofHold: 'Issue #165',
    },
    summary: {
      totalCases: replay.length,
      successCount,
      failureCount,
      liveNetworkCalls: replay.reduce((sum, entry) => sum + entry.transport.liveNetworkCalls, 0),
      maxSnippetChars: MAX_SNIPPET_CHARS,
    },
    transport: {
      localFixtureOnly: true,
      liveNetworkAllowed: false,
      liveNetworkCalls: 0,
      fixtureTransport: 'in-memory',
    },
    outputContract: {
      normalizedFields: [...NORMALIZED_FIELDS],
      failureTaxonomy: [...FAILURE_TAXONOMY],
      deterministicOrdering: [...CASE_ORDER],
      stableTimestamp: ENRICHMENT_FIXTURE_REPLAY_TIMESTAMP,
      sourceLabels: replay.map((entry) => entry.sourceLabel),
    },
    redaction: {
      provesAbsent: [
        'raw_html',
        'headers',
        'cookies',
        'tokens',
        'auth_like_values',
        'private_urls',
        'unsafe_payloads',
        'customer_private_data',
      ],
      sample: buildRedactionProbe(),
    },
    replay,
    nonClaims: [
      'This artifact is not production proof.',
      'This artifact uses only synthetic in-memory fixtures.',
      'This artifact does not deploy, access D1, call endpoints, read logs or secrets, use customer or private data, touch CRM, send outreach, call LLMs, run automation, or claim production readiness.',
    ],
  };
}

module.exports = {
  ENRICHMENT_FIXTURE_REPLAY_STATUS,
  ENRICHMENT_FIXTURE_REPLAY_TIMESTAMP,
  buildEnrichmentFixtureReplayArtifact,
  runEnrichmentFixtureReplay,
};
