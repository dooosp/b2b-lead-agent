const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

const {
  LEAD_PIPELINE_FIXTURE_REPLAY_STATUS,
  LEAD_PIPELINE_FIXTURE_REPLAY_TIMESTAMP,
  buildLeadPipelineFixtureReplayArtifact,
  runLeadPipelineFixtureReplay,
} = require('../lead-pipeline-fixture-replay');

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

const FORBIDDEN_ARTIFACT_MARKERS = Object.freeze([
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
  'Manual note body',
  'manual_reviewer',
  'Generated suggestion',
  'Generated guidance',
  'reviewNoteSuggestion',
  'reviewNoteTemplates',
  'manualReviewNotes',
  'manual_review_notes',
  'http://',
  'https://',
  '127.0.0.1',
  'localhost',
  'workers.dev',
  'pages.dev',
  'b2b-lead-trigger.example.com',
]);

function assertNoForbiddenArtifactEvidence(value) {
  const serialized = JSON.stringify(value);
  for (const marker of FORBIDDEN_ARTIFACT_MARKERS) {
    assert.equal(serialized.includes(marker), false, `artifact leaked ${marker}`);
  }
}

test('lead pipeline fixture replay builds a stable local-only artifact contract', async () => {
  const artifact = await buildLeadPipelineFixtureReplayArtifact();

  assert.equal(artifact.documentStatus, LEAD_PIPELINE_FIXTURE_REPLAY_STATUS);
  assert.equal(artifact.generatedAt, LEAD_PIPELINE_FIXTURE_REPLAY_TIMESTAMP);
  assert.equal(artifact.repo, 'dooosp/b2b-lead-agent');
  assert.equal(artifact.boundary, 'NOT_PRODUCTION_EVIDENCE');
  assert.equal(artifact.notProductionEvidence, true);
  assert.equal(artifact.productionReady, false);
  assert.equal(artifact.productionReviewerWorkflowReady, false);
  assert.deepEqual(artifact.sourceReplay.caseOrder, EXPECTED_CASE_ORDER);
  assert.deepEqual(artifact.summary, {
    replayCases: 9,
    successReplayCases: 2,
    failureReplayCases: 7,
    syntheticArticles: 2,
    syntheticLeads: 2,
    leadQualityResults: 2,
    liveNetworkCalls: 0,
    llmCalls: 0,
    crmCalls: 0,
    d1Calls: 0,
  });
  assert.deepEqual(artifact.transport, {
    localFixtureOnly: true,
    liveNetworkAllowed: false,
    liveNetworkCalls: 0,
    fixtureTransport: 'in-memory',
  });
  assert.deepEqual(artifact.outputContract.artifactFields, [
    'sourceReplay',
    'syntheticArticles',
    'leadQuality',
    'report',
    'publication',
    'evidence',
    'redaction',
  ]);
});

test('lead pipeline fixture replay maps enrichment replay outputs into quality report and publication artifacts', async () => {
  const artifact = await buildLeadPipelineFixtureReplayArtifact();

  assert.deepEqual(artifact.syntheticArticles.map((article) => article.caseId), [
    'success_resolved_article',
    'success_safe_redirect',
  ]);
  assert.deepEqual(artifact.syntheticArticles.map((article) => article.sourceUrlLabel), [
    'fixture-public-success-article',
    'fixture-public-redirect-final',
  ]);
  assert.equal(artifact.syntheticArticles.every((article) => article.bodySnippet.length <= 160), true);

  assert.equal(artifact.leadQuality.generatedAt, LEAD_PIPELINE_FIXTURE_REPLAY_TIMESTAMP);
  assert.deepEqual(artifact.leadQuality.inputs.map((input) => input.caseId), [
    'success_resolved_article',
    'success_safe_redirect',
  ]);
  assert.deepEqual(artifact.leadQuality.inputs.map((input) => input.sourceUrlLabel), [
    'fixture-public-success-article',
    'fixture-public-redirect-final',
  ]);
  assert.deepEqual(artifact.leadQuality.results.map((result) => ({
    id: result.id,
    status: result.status,
    reviewReady: result.reviewReady,
  })), [
    { id: 'fixture-lead-success-resolved-article', status: 'SHIP', reviewReady: true },
    { id: 'fixture-lead-success-safe-redirect', status: 'SHIP', reviewReady: true },
  ]);

  assert.deepEqual(artifact.report, {
    profileId: 'danfoss',
    profileName: 'Danfoss',
    dateStr: '2026-06-03',
    gradeCounts: { A: 1, B: 1 },
    totalLeads: 2,
    fieldPresence: {
      company: true,
      summary: true,
      product: true,
      roi: true,
      salesPitch: true,
      globalContext: true,
    },
  });

  assert.deepEqual(artifact.publication.artifactNames, {
    markdownCanonical: 'lead-report-2026-06-03.md',
    latestCanonical: 'latest-leads.json',
    historyCanonical: 'lead-history.json',
    manifestCanonical: 'publication-manifest.json',
  });
  assert.deepEqual(artifact.publication.lifecycle, {
    localState: 'VALIDATED',
    localOutcome: 'READY_FOR_REMOTE_PUBLICATION',
    remotePublished: false,
    notificationState: 'NOT_REQUESTED',
  });
  assert.deepEqual(artifact.publication.latestLeads.map((lead) => ({
    id: lead.id,
    reviewStatus: lead.reviewStatus,
    generationMode: lead.generationMode,
    verificationStatus: lead.verificationStatus,
    confidence: lead.confidence,
    sourceUrlLabels: lead.sourceUrlLabels,
  })), [
    {
      id: 'fixture-published-success-resolved-article',
      reviewStatus: 'NEEDS_REVIEW',
      generationMode: 'heuristic',
      verificationStatus: 'needs_review',
      confidence: 'MEDIUM',
      sourceUrlLabels: ['fixture-public-success-article'],
    },
    {
      id: 'fixture-published-success-safe-redirect',
      reviewStatus: 'NEEDS_REVIEW',
      generationMode: 'heuristic',
      verificationStatus: 'needs_review',
      confidence: 'MEDIUM',
      sourceUrlLabels: ['fixture-public-redirect-final'],
    },
  ]);
  assert.equal(artifact.publication.historyLeadCount, 2);
  assert.equal(artifact.publication.historyProtectedFieldsRemoved, true);
});

test('lead pipeline fixture replay redacts unsafe enrichment and reviewer evidence from artifacts', async () => {
  const artifact = await buildLeadPipelineFixtureReplayArtifact();

  assertNoForbiddenArtifactEvidence(artifact);
  assert.deepEqual(artifact.redaction.provesAbsent, [
    'raw_html',
    'raw_urls',
    'headers',
    'cookies',
    'tokens',
    'auth_like_values',
    'private_urls',
    'manual_notes',
    'generated_guidance',
    'customer_private_data',
  ]);
  assert.deepEqual(artifact.redaction.checkedArtifactSurfaces, [
    'lead_quality_inputs',
    'report_summary',
    'publication_latest',
    'publication_history',
    'release_evidence_packet',
  ]);
  assert.equal(artifact.evidence.packet.status, 'SHIP');
  assert.equal(artifact.evidence.packet.boundaries.toolAccessedProduction, false);
  assert.equal(artifact.evidence.packet.boundaries.productionEndpointCalledByTool, false);
  assert.equal(artifact.evidence.packet.boundaries.productionDbAccessedByTool, false);
  assert.equal(artifact.evidence.packet.boundaries.deployPerformedByTool, false);
});

test('lead pipeline fixture replay runner can return sanitized artifact sections', async () => {
  const replay = await runLeadPipelineFixtureReplay();

  assert.deepEqual(Object.keys(replay), [
    'sourceReplay',
    'syntheticArticles',
    'leadQuality',
    'report',
    'publication',
    'evidence',
    'redaction',
  ]);
  assertNoForbiddenArtifactEvidence(replay);
});

test('lead pipeline fixture replay CLI writes deterministic non-production artifact', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lead-pipeline-fixture-replay-'));
  const outputPath = join(dir, 'pipeline.json');

  try {
    const result = spawnSync(process.execPath, [
      'scripts/lead-pipeline-fixture-replay.mjs',
      '--json',
      '--output',
      outputPath,
    ], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, new RegExp(LEAD_PIPELINE_FIXTURE_REPLAY_STATUS));

    const artifact = JSON.parse(readFileSync(outputPath, 'utf8'));
    assert.equal(artifact.documentStatus, LEAD_PIPELINE_FIXTURE_REPLAY_STATUS);
    assert.equal(artifact.generatedAt, LEAD_PIPELINE_FIXTURE_REPLAY_TIMESTAMP);
    assertNoForbiddenArtifactEvidence(artifact);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('package and CI expose local-only lead pipeline replay gate', () => {
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
  const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
  const script = packageJson.scripts['check:lead-pipeline-replay'] || '';

  assert.match(script, /node --test tests\/lead-pipeline-fixture-replay-artifact-contract\.test\.js/);
  assert.match(script, /node scripts\/lead-pipeline-fixture-replay\.mjs --json --output tmp\/codex\/lead-pipeline-fixture-replay-artifact-contract-non-production\.json/);
  assert.doesNotMatch(script, /npm audit|wrangler|curl|deploy|main\.js|D1_DATABASE|DATABASE_ID|CLOUDFLARE|GEMINI|GMAIL|https?:\/\//i);
  assert.match(workflow, /name:\s+Run lead pipeline fixture replay artifact contract\s+run:\s+npm run check:lead-pipeline-replay/);
  assert.match(workflow, /run:\s+npm run check:enrichment-replay[\s\S]*run:\s+npm run check:lead-pipeline-replay[\s\S]*run:\s+npm run check:schema/);
  assert.doesNotMatch(workflow, /secrets\./);
  assert.doesNotMatch(workflow, /wrangler|curl|deploy|D1_DATABASE|DATABASE_ID|CLOUDFLARE|GEMINI|GMAIL/i);
});
