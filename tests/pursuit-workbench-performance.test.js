const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { performance } = require('node:perf_hooks');
const { loadWorkbenchDomain, loadWorkbenchViewModel } = require('./helpers/pursuit-workbench');

function clone(value) {
  return structuredClone(value);
}

async function buildCustomView({ opportunity, registry, verticalPack, productFamilyMap, scenario }) {
  const domain = await import('../verticals/datacenter/index.mjs');
  const timeline = await import('../pursuit-workbench/domain/timeline.mjs');
  const view = await import('../pursuit-workbench/domain/view-model.mjs');
  const evaluation = domain.evaluateSpecificationFit(opportunity, registry, verticalPack);
  const dossier = domain.buildPursuitDossier(opportunity, evaluation, registry, verticalPack);
  const timelineResult = timeline.buildProjectSignalTimeline(opportunity, evaluation, registry, verticalPack);
  return view.buildPursuitWorkbenchViewModel({
    scenario, opportunity, evaluation, dossier, suppliedDossierHashes: domain.dossierHashes(dossier),
    timeline: timelineResult.timeline, timelineSha256: timelineResult.timelineSha256,
    registry, verticalPack, productFamilyMap
  });
}

function request(origin, pathname) {
  return new Promise((resolve, reject) => {
    http.get(new URL(pathname, origin), (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

test('timeline validates deterministic 1, 10, and 100 event scales within byte limits', async () => {
  const { inputs, materialized, timelineResult, timeline } = await loadWorkbenchDomain('empty_project_no_evaluable_requirements');
  for (const count of [1, 10, 100]) {
    const events = Array.from({ length: count }, (_, index) => ({
      schemaVersion: 'project-signal-event-v0', eventClass: 'DERIVED', eventType: 'DOSSIER_RECOMPUTED',
      opportunityId: materialized.opportunity.opportunityId, occurredAt: timelineResult.timeline.asOf, observedAt: null,
      timeBasis: 'REGISTRY_AS_OF', title: `Scale event ${index}`, summary: `Deterministic scale event ${index}.`,
      claimIds: [], evidenceIds: [], requirementIds: [], productFamilyIds: [], sourceState: null, evidenceUse: null,
      reasonCodes: [], state: null
    }));
    const started = performance.now();
    const built = timeline.createValidatedProjectSignalTimeline({ ...clone(timelineResult.timeline), events }, {
      registry: materialized.registry, opportunity: materialized.opportunity, verticalPack: inputs.verticalPack
    });
    assert.equal(built.events.length, count);
    assert.ok(Buffer.byteLength(JSON.stringify(built), 'utf8') < timeline.TIMELINE_LIMITS.maxBytes);
    assert.ok(performance.now() - started < 5_000);
  }
});

test('view model supports 1, 10, and 20 candidate product families without changing bounds', async () => {
  const { inputs, catalog, materialized } = await loadWorkbenchDomain('empty_project_no_evaluable_requirements');
  const scenario = catalog.scenarios.find((item) => item.id === 'empty_project_no_evaluable_requirements');
  for (const count of [1, 10, 20]) {
    const verticalPack = clone(inputs.verticalPack);
    const productFamilyMap = clone(inputs.productFamilyMap);
    while (productFamilyMap.families.length < count) {
      const index = productFamilyMap.families.length;
      const id = `synthetic_scale_family_${index}`;
      productFamilyMap.families.push({ id, displayNameKo: `합성 제품군 ${index}`, displayNameEn: `Synthetic Scale Family ${index}`, profileMappings: [] });
      verticalPack.specificationWindows[id] = { ...verticalPack.specificationWindows.building_management };
    }
    const opportunity = clone(materialized.opportunity);
    opportunity.candidateProductFamilyIds = productFamilyMap.families.slice(0, count).map((family) => family.id);
    const viewModel = await buildCustomView({ opportunity, registry: materialized.registry, verticalPack, productFamilyMap, scenario });
    assert.equal(viewModel.fitMatrix.length, count);
    assert.ok(viewModel.fitMatrix.every((row) => row.result === 'NOT_EVALUATED'));
    assert.ok(Buffer.byteLength(JSON.stringify(viewModel), 'utf8') < 512 * 1024);
  }
});

test('maximum 100 bounded technical questions remain explicit and renderable', async () => {
  const { inputs, materialized } = await loadWorkbenchDomain('empty_project_no_evaluable_requirements');
  const opportunity = clone(materialized.opportunity);
  opportunity.stage = { value: 'BASIC_DESIGN', evidenceClaimRefs: ['stage_basic_design'] };
  opportunity.candidateProductFamilyIds = ['building_management'];
  opportunity.requirements = Array.from({ length: 100 }, (_, index) => ({
    requirementId: `req_scale_missing_${index}`,
    category: 'controls_bms',
    key: `scale_missing_${index}`,
    productFamilyIds: ['building_management'],
    priority: 'HARD',
    valueState: 'UNKNOWN',
    operator: 'EQ',
    value: { type: 'STRING', key: `scale_missing_${index}`, value: 'REQUIRED' },
    evidenceClaimRefs: []
  }));
  const scenario = { id: 'scale_questions_100', title: '100-question scale', description: 'Synthetic upper-bound technical question scale.' };
  const viewModel = await buildCustomView({ opportunity, registry: materialized.registry, verticalPack: inputs.verticalPack, productFamilyMap: inputs.productFamilyMap, scenario });
  assert.equal(viewModel.technicalQuestions.length, 100);
  assert.equal(new Set(viewModel.technicalQuestions.map((item) => item.questionId)).size, 100);
  const renderer = await import('../pursuit-workbench/renderer.mjs');
  const html = renderer.renderPursuitWorkbenchPage(viewModel, [{ id: scenario.id, title: scenario.title, description: scenario.description }]);
  assert.ok(Buffer.byteLength(html, 'utf8') < renderer.WORKBENCH_HTML_MAX_BYTES);
});

test('maximum 20 claim references per derived family event pass and the 21st fails closed', async () => {
  const { inputs, materialized } = await loadWorkbenchDomain('empty_project_no_evaluable_requirements');
  const registryDomain = await import('../knowledge/claim-registry/index.mjs');
  const buildScale = async (requirementCount) => {
    const rawRegistry = clone(inputs.rawRegistry);
    const projectTemplate = rawRegistry.claims.find((item) => item.claimKey === 'req_bacnet');
    const capabilityTemplate = rawRegistry.claims.find((item) => item.claimKey === 'cap_bms_bacnet');
    const requirements = [];
    for (let index = 0; index < requirementCount; index += 1) {
      const key = `scale_claim_${index}`;
      const project = clone(projectTemplate);
      project.claimKey = `scale_project_${index}`;
      project.statement = `Synthetic project scale requirement ${index}.`;
      project.value = { type: 'STRING', key, value: 'REQUIRED' };
      project.applicability.productFamilyIds = ['building_management'];
      project.evidence[0].sourceTitle = `Synthetic scale project source ${index}`;
      project.evidence[0].sourceUrl = `https://synthetic.example/scale/project-${index}`;
      project.evidence[0].directQuote = `Scale project requirement ${index} is required.`;
      const capability = clone(capabilityTemplate);
      capability.claimKey = `scale_capability_${index}`;
      capability.statement = `Synthetic product scale capability ${index}.`;
      capability.value = { type: 'STRING', key, value: 'REQUIRED' };
      capability.evidence[0].sourceTitle = `Synthetic scale capability source ${index}`;
      capability.evidence[0].sourceUrl = `https://synthetic.example/scale/capability-${index}`;
      capability.evidence[0].directQuote = `Scale capability ${index} is supported.`;
      rawRegistry.claims.push(project, capability);
      requirements.push({
        requirementId: `req_scale_claim_${index}`, category: 'controls_bms', key,
        productFamilyIds: ['building_management'], priority: 'HARD', valueState: 'KNOWN', operator: 'EQ',
        value: { type: 'STRING', key, value: 'REQUIRED' }, evidenceClaimRefs: [project.claimKey]
      });
    }
    const registry = registryDomain.createValidatedClaimRegistry(rawRegistry, { asOf: rawRegistry.evaluationAsOf });
    const opportunity = clone(materialized.opportunity);
    opportunity.stage = { value: 'BASIC_DESIGN', evidenceClaimRefs: ['stage_basic_design'] };
    opportunity.candidateProductFamilyIds = ['building_management'];
    opportunity.requirements = requirements;
    return buildCustomView({
      opportunity, registry, verticalPack: inputs.verticalPack, productFamilyMap: inputs.productFamilyMap,
      scenario: { id: `scale_claims_${requirementCount}`, title: 'Claim reference scale', description: 'Synthetic claim reference upper-bound test.' }
    });
  };
  const maximum = await buildScale(10);
  const fitEvent = maximum.timeline.find((event) => event.eventType === 'SPECIFICATION_FIT_EVALUATED');
  assert.equal(fitEvent.claimIds.length, 20);
  assert.equal(maximum.allowedClaims.length, 21);
  await assert.rejects(buildScale(11), (error) => error.code === 'TIMELINE_REFS_INVALID');
});

test('startup, scenario construction, timeline, view model, HTML, JSON, page load, switch, and packet stay within generous local bounds', async () => {
  const marks = {};
  let at = performance.now();
  const loader = await import('../scripts/lib/repository-claim-registry.mjs');
  const inputs = await loader.loadEvidenceDomainInputs();
  marks.registryAndFixtureLoadMs = performance.now() - at;
  at = performance.now();
  const viewModel = await loadWorkbenchViewModel('multi_family_datacenter_opportunity');
  marks.scenarioTimelineViewModelMs = performance.now() - at;
  const renderer = await import('../pursuit-workbench/renderer.mjs');
  const scenarios = await (await import('../pursuit-workbench/domain/scenarios.mjs')).listPursuitWorkbenchScenarios({ inputs });
  at = performance.now();
  const html = renderer.renderPursuitWorkbenchPage(viewModel, scenarios);
  marks.htmlMs = performance.now() - at;
  at = performance.now();
  JSON.stringify(viewModel);
  marks.jsonMs = performance.now() - at;
  const review = await import('../pursuit-workbench/domain/review-packet.mjs');
  const family = viewModel.reviewPolicy.families[0];
  const disposition = family.dispositions.find((item) => item.supported);
  at = performance.now();
  await review.buildPursuitReviewPacket(viewModel, {
    productFamilyId: family.productFamilyId, disposition: disposition.value, reasonCodes: [disposition.reasonCodes[0]], selectedQuestionIds: [], acknowledgedNonClaims: true
  }, { clock: () => inputs.fixture.evaluationAsOf, hash: async () => 'a'.repeat(64) });
  marks.packetMs = performance.now() - at;
  const server = await import('../pursuit-workbench/server.mjs');
  at = performance.now();
  const started = await server.startPursuitWorkbenchServer();
  marks.serverStartupMs = performance.now() - at;
  try {
    at = performance.now();
    const first = await request(started.origin, '/');
    marks.pageLoadMs = performance.now() - at;
    at = performance.now();
    const switched = await request(started.origin, '/scenario/hard_voltage_mismatch');
    marks.scenarioSwitchMs = performance.now() - at;
    assert.ok(first.byteLength > 0 && switched.byteLength > 0 && Buffer.byteLength(html, 'utf8') > 0);
  } finally {
    await started.close();
  }
  for (const [name, duration] of Object.entries(marks)) {
    assert.ok(duration < 5_000, `${name} exceeded bound: ${duration}ms`);
  }
});
