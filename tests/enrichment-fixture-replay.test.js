const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

const {
  ENRICHMENT_FIXTURE_REPLAY_STATUS,
  ENRICHMENT_FIXTURE_REPLAY_TIMESTAMP,
  buildEnrichmentFixtureReplayArtifact,
  runEnrichmentFixtureReplay,
} = require('../enricher/enrichment-fixture-replay');

const EXPECTED_CASE_ORDER = Object.freeze([
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

const EXPECTED_FAILURE_CODES = Object.freeze({
  failure_timeout: 'timeout',
  failure_malformed_search_html: 'malformed_html',
  failure_empty_content: 'empty_content',
  failure_blocked_private_url: 'request_policy_refused',
  failure_http_404: 'http_status',
  failure_http_500: 'http_status',
  failure_oversized_body: 'response_too_large',
});

function byCaseId(artifact, caseId) {
  return artifact.replay.find((entry) => entry.caseId === caseId);
}

function assertNoForbiddenReplayEvidence(value) {
  const serialized = JSON.stringify(value);
  const forbidden = [
    '<article',
    '<html',
    '<body',
    'Authorization',
    'Proxy-Authorization',
    'Cookie',
    'Set-Cookie',
    'Bearer raw',
    'raw-token-value',
    'raw-api-key-value',
    'raw-cookie-value',
    'raw-auth-like-value',
    'ACME_PRIVATE_CUSTOMER',
    'PRIVATE_CUSTOMER',
    'private.customer@example.com',
    'http://',
    'https://',
    '127.0.0.1',
    'localhost',
    'b2b-lead-trigger.example.com',
    'workers.dev',
    'pages.dev',
  ];

  for (const marker of forbidden) {
    assert.equal(serialized.includes(marker), false, `artifact leaked ${marker}`);
  }
}

test('enrichment fixture replay artifact has stable local-only output contract', async () => {
  const artifact = await buildEnrichmentFixtureReplayArtifact();

  assert.equal(artifact.documentStatus, ENRICHMENT_FIXTURE_REPLAY_STATUS);
  assert.equal(artifact.generatedAt, ENRICHMENT_FIXTURE_REPLAY_TIMESTAMP);
  assert.equal(artifact.repo, 'dooosp/b2b-lead-agent');
  assert.equal(artifact.boundary, 'NOT_PRODUCTION_EVIDENCE');
  assert.equal(artifact.notProductionEvidence, true);
  assert.equal(artifact.productionReady, false);
  assert.equal(artifact.productionReviewerWorkflowReady, false);
  assert.deepEqual(artifact.replay.map((entry) => entry.caseId), EXPECTED_CASE_ORDER);
  assert.deepEqual(artifact.summary, {
    totalCases: 9,
    successCount: 2,
    failureCount: 7,
    liveNetworkCalls: 0,
    maxSnippetChars: 160,
  });
  assert.deepEqual(artifact.outputContract.normalizedFields, [
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
  assert.deepEqual(artifact.outputContract.failureTaxonomy, [
    'empty_content',
    'http_status',
    'malformed_html',
    'request_policy_refused',
    'response_too_large',
    'timeout',
  ]);
  assert.deepEqual(artifact.transport, {
    localFixtureOnly: true,
    liveNetworkAllowed: false,
    liveNetworkCalls: 0,
    fixtureTransport: 'in-memory',
  });
});

test('enrichment fixture replay proves resolver scraper redirect and failure behavior', async () => {
  const artifact = await buildEnrichmentFixtureReplayArtifact();
  const success = byCaseId(artifact, 'success_resolved_article');
  const redirect = byCaseId(artifact, 'success_safe_redirect');

  assert.equal(success.outcome, 'success');
  assert.equal(success.resolution, 'resolved');
  assert.equal(success.requestedUrlLabel, 'fixture-google-news-discovery');
  assert.equal(success.finalUrlLabel, 'fixture-public-success-article');
  assert.equal(success.redirected, false);
  assert.equal(success.failureCode, null);
  assert.equal(success.body.available, true);
  assert.equal(success.body.source, 'article-body');
  assert.equal(success.body.trust, 'trusted');
  assert.equal(success.body.snippet.length <= artifact.summary.maxSnippetChars, true);
  assert.match(success.body.snippet, /Fixture refrigeration system upgrade/);
  assert.deepEqual(success.transport.requestLabels, [
    'fixture-search-success',
    'fixture-public-success-article',
  ]);

  assert.equal(redirect.outcome, 'success');
  assert.equal(redirect.resolution, 'not_applicable');
  assert.equal(redirect.requestedUrlLabel, 'fixture-public-redirect-entry');
  assert.equal(redirect.finalUrlLabel, 'fixture-public-redirect-final');
  assert.equal(redirect.redirected, true);
  assert.equal(redirect.body.available, true);
  assert.equal(redirect.failureCode, null);

  for (const [caseId, failureCode] of Object.entries(EXPECTED_FAILURE_CODES)) {
    const entry = byCaseId(artifact, caseId);
    assert.equal(entry.outcome, 'failure', caseId);
    assert.equal(entry.failureCode, failureCode, caseId);
    assert.equal(entry.body.available, false, caseId);
    assert.equal(entry.body.snippet, '', caseId);
    assert.equal(entry.transport.liveNetworkCalls, 0, caseId);
  }

  assert.equal(byCaseId(artifact, 'failure_blocked_private_url').transport.requestCount, 0);
  assert.equal(byCaseId(artifact, 'failure_blocked_private_url').failureReason, 'blocked_host');
  assert.equal(byCaseId(artifact, 'failure_http_404').status, 404);
  assert.equal(byCaseId(artifact, 'failure_http_500').status, 500);
  assert.equal(byCaseId(artifact, 'failure_malformed_search_html').resolution, 'unresolved');
});

test('enrichment fixture replay redacts raw HTML headers URLs auth material and private data', async () => {
  const artifact = await buildEnrichmentFixtureReplayArtifact();

  assertNoForbiddenReplayEvidence(artifact);
  assert.equal(JSON.stringify(artifact).includes('[REDACTED'), true);
  assert.deepEqual(artifact.redaction.provesAbsent, [
    'raw_html',
    'headers',
    'cookies',
    'tokens',
    'auth_like_values',
    'private_urls',
    'unsafe_payloads',
    'customer_private_data',
  ]);
});

test('enrichment fixture replay runner can return only replay entries', async () => {
  const replay = await runEnrichmentFixtureReplay();

  assert.deepEqual(replay.map((entry) => entry.caseId), EXPECTED_CASE_ORDER);
  assert.equal(replay.every((entry) => entry.transport.liveNetworkCalls === 0), true);
});

test('enrichment fixture replay CLI writes deterministic non-production artifact', () => {
  const dir = mkdtempSync(join(tmpdir(), 'enrichment-fixture-replay-'));
  const outputPath = join(dir, 'replay.json');

  try {
    const result = spawnSync(process.execPath, [
      'scripts/enrichment-fixture-replay.mjs',
      '--json',
      '--output',
      outputPath,
    ], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, new RegExp(ENRICHMENT_FIXTURE_REPLAY_STATUS));

    const artifact = JSON.parse(readFileSync(outputPath, 'utf8'));
    assert.equal(artifact.documentStatus, ENRICHMENT_FIXTURE_REPLAY_STATUS);
    assert.equal(artifact.generatedAt, ENRICHMENT_FIXTURE_REPLAY_TIMESTAMP);
    assertNoForbiddenReplayEvidence(artifact);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('package and CI expose local-only enrichment replay gate', () => {
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
  const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
  const script = packageJson.scripts['check:enrichment-replay'] || '';

  assert.match(script, /node --test tests\/enrichment-fixture-replay\.test\.js/);
  assert.match(script, /node scripts\/enrichment-fixture-replay\.mjs --json --output tmp\/codex\/enrichment-fixture-replay-output-contract-non-production\.json/);
  assert.doesNotMatch(script, /npm audit|wrangler|curl|deploy|main\.js|D1_DATABASE|DATABASE_ID|CLOUDFLARE|GEMINI|GMAIL|https?:\/\//i);
  assert.match(workflow, /name:\s+Run enrichment fixture replay output contract\s+run:\s+npm run check:enrichment-replay/);
  assert.match(workflow, /run:\s+npm run check:enrichment-boundary[\s\S]*run:\s+npm run check:enrichment-replay[\s\S]*run:\s+npm run check:schema/);
  assert.doesNotMatch(workflow, /secrets\./);
  assert.doesNotMatch(workflow, /wrangler|curl|deploy|D1_DATABASE|DATABASE_ID|CLOUDFLARE|GEMINI|GMAIL/i);
});
