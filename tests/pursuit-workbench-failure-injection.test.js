const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { loadWorkbenchDomain, loadWorkbenchViewModel } = require('./helpers/pursuit-workbench');

function request(origin, pathname) {
  return new Promise((resolve, reject) => {
    http.get(new URL(pathname, origin), (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    }).on('error', reject);
  });
}

test('fixture load and registry creation failures are typed and contain no partial artifact', async () => {
  const loader = await import('../scripts/lib/repository-claim-registry.mjs');
  await assert.rejects(loader.readRepositoryJson('pursuit-workbench/fixtures/not-present.json'), (error) => error.code === 'REPOSITORY_JSON_LOAD_FAILED');
  const registry = await import('../knowledge/claim-registry/index.mjs');
  const { inputs } = await loadWorkbenchDomain();
  const duplicate = structuredClone(inputs.rawRegistry);
  duplicate.claims.push(structuredClone(duplicate.claims[0]));
  assert.throws(() => registry.createValidatedClaimRegistry(duplicate, { asOf: duplicate.evaluationAsOf }), (error) => error.code === 'DUPLICATE_CLAIM_ID');
});

test('opportunity, fit, and dossier trust failures stop before a Workbench view model exists', async () => {
  const { inputs, materialized } = await loadWorkbenchDomain();
  const domain = await import('../verticals/datacenter/index.mjs');
  assert.throws(() => domain.validateProjectOpportunity({ ...structuredClone(materialized.opportunity), synthetic: false }, inputs.verticalPack), (error) => error.code === 'SYNTHETIC_OPPORTUNITY_REQUIRED');
  assert.throws(() => domain.evaluateSpecificationFit(materialized.opportunity, { claims: [] }, inputs.verticalPack), (error) => error.code === 'UNVALIDATED_REGISTRY');
  assert.throws(() => domain.buildPursuitDossier(materialized.opportunity, structuredClone(materialized.evaluation), materialized.registry, inputs.verticalPack), (error) => error.code === 'UNVALIDATED_FIT_EVALUATION');
});

test('timeline and view-model hash failures refuse stale or forged data', async () => {
  const { inputs, catalog, materialized, timelineResult, timeline } = await loadWorkbenchDomain();
  const raw = structuredClone(timelineResult.timeline);
  raw.events[0].claimIds = ['clm_missing'];
  raw.events[0].eventId = '';
  assert.throws(() => timeline.createValidatedProjectSignalTimeline(raw, { registry: materialized.registry, opportunity: materialized.opportunity, verticalPack: inputs.verticalPack }), (error) => error.code === 'TIMELINE_CLAIM_UNKNOWN');
  const view = await import('../pursuit-workbench/domain/view-model.mjs');
  const scenario = catalog.scenarios.find((item) => item.id === 'strong_verified_cooling_fit');
  assert.throws(() => view.buildPursuitWorkbenchViewModel({
    scenario, opportunity: materialized.opportunity, evaluation: materialized.evaluation, dossier: materialized.dossier,
    suppliedDossierHashes: materialized.dossierHashes, timeline: timelineResult.timeline, timelineSha256: '0'.repeat(64),
    registry: materialized.registry, verticalPack: inputs.verticalPack, productFamilyMap: inputs.productFamilyMap
  }), (error) => error.code === 'WORKBENCH_TIMELINE_HASH_MISMATCH');
});

test('server startup, route, and asset failures return safe bounded errors', async () => {
  const server = await import('../pursuit-workbench/server.mjs');
  await assert.rejects(server.startPursuitWorkbenchServer({ host: '0.0.0.0' }), (error) => error.code === 'WORKBENCH_NON_LOOPBACK_HOST_REFUSED');
  const routeFailure = await server.startPursuitWorkbenchServer({ handlerOptions: { materialize: async () => { throw new Error('secret=abcdefgh /Users/private'); } } });
  try {
    const response = await request(routeFailure.origin, '/');
    assert.equal(response.status, 503);
    assert.doesNotMatch(response.body, /secret=|\/Users\/|private/);
    assert.doesNotMatch(response.body, /packet-preview|Campus Alpha/);
  } finally {
    await routeFailure.close();
  }
  const assetFailure = await server.startPursuitWorkbenchServer({ handlerOptions: { assets: new Map() } });
  try {
    const response = await request(assetFailure.origin, '/assets/pursuit-workbench.css');
    assert.equal(response.status, 500);
    assert.equal(response.body, 'Internal error\n');
  } finally {
    await assetFailure.close();
  }
});

test('packet serialization failure emits no partial protected object', async () => {
  const packet = await import('../pursuit-workbench/domain/review-packet.mjs');
  const viewModel = await loadWorkbenchViewModel();
  const family = viewModel.reviewPolicy.families[0];
  const selection = {
    productFamilyId: family.productFamilyId,
    disposition: 'READY_FOR_TECHNICAL_REVIEW',
    reasonCodes: ['VERIFIED_FIT_TRACE'],
    selectedQuestionIds: [],
    acknowledgedNonClaims: true
  };
  await assert.rejects(packet.buildPursuitReviewPacket(viewModel, selection, {
    clock: () => 'invalid-date', hash: async () => 'a'.repeat(64)
  }), (error) => error.code === 'REVIEW_CLOCK_INVALID');
  await assert.rejects(packet.buildPursuitReviewPacket(viewModel, selection, {
    clock: () => '2026-06-01T00:00:00.000Z', hash: async () => 'forged'
  }), (error) => error.code === 'REVIEW_HASH_INVALID');
});

test('scenario recomputation failure never falls back to a raw expected dossier', async () => {
  const { inputs, catalog, scenarios } = await loadWorkbenchDomain();
  const poisoned = structuredClone(inputs.rawRegistry);
  poisoned.claims.find((item) => item.claimKey === 'cap_compressor_water').evidence[0].sourceUrl = 'file:///etc/passwd';
  await assert.rejects(scenarios.materializePursuitWorkbenchScenario('strong_verified_cooling_fit', {
    inputs: { ...inputs, rawRegistry: poisoned }, catalog
  }), (error) => error.code === 'SOURCE_SCHEME_REFUSED');
});
