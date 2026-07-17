const test = require('node:test');
const assert = require('node:assert/strict');
const { loadWorkbenchDomain, loadWorkbenchViewModel } = require('./helpers/pursuit-workbench');

function clone(value) {
  return structuredClone(value);
}

function expectCode(code) {
  return (error) => error?.code === code;
}

test('curated view models preserve every fit and specification-window state', async () => {
  const expectations = {
    strong_verified_cooling_fit: ['FIT', 'OPEN'],
    strong_verified_electrical_fit: ['FIT', 'OPEN'],
    multi_family_datacenter_opportunity: ['FIT,FIT', 'OPEN'],
    hard_voltage_mismatch: ['NOT_FIT', 'OPEN'],
    missing_incoming_voltage: ['INSUFFICIENT_EVIDENCE', 'OPEN'],
    unverified_product_capability: ['CONDITIONAL_FIT', 'OPEN'],
    conflicting_capability_claims: ['INSUFFICIENT_EVIDENCE', 'OPEN'],
    specification_window_closing: ['FIT', 'CLOSING'],
    specification_window_closed: ['FIT', 'CLOSED'],
    retrofit_path_available: ['FIT', 'RETROFIT_OPEN'],
    incompatible_unit: ['INSUFFICIENT_EVIDENCE', 'OPEN']
  };
  for (const [scenarioId, [results, window]] of Object.entries(expectations)) {
    const viewModel = await loadWorkbenchViewModel(scenarioId);
    assert.equal(viewModel.fitMatrix.map((row) => row.result).sort().join(','), results, scenarioId);
    assert.equal(viewModel.technicalPursuitSummary.overallSpecificationWindow, window, scenarioId);
    assert.equal(viewModel.boundary, 'NOT_PRODUCTION_EVIDENCE');
    assert.equal(viewModel.productionReady, false);
    assert.equal(viewModel.productionReviewerWorkflowReady, false);
    assert.equal(viewModel.issue165Status, 'HOLD');
  }
  const empty = await loadWorkbenchViewModel('empty_project_no_evaluable_requirements');
  assert.equal(empty.fitMatrix.length, 0);
  assert.equal(empty.technicalPursuitSummary.overallEvaluationState, 'NOT_EVALUATED');
  assert.equal(empty.technicalPursuitSummary.overallSpecificationWindow, 'UNKNOWN');
});

test('next supported disposition reflects the dominant dossier-backed blocker', async () => {
  const cases = [
    ['strong_verified_cooling_fit', 'READY_FOR_TECHNICAL_REVIEW'],
    ['hard_voltage_mismatch', 'REJECT_TECHNICAL_MISMATCH'],
    ['specification_window_closed', 'DEFER_FOR_PROJECT_STAGE'],
    ['missing_incoming_voltage', 'HOLD_FOR_PROJECT_EVIDENCE'],
    ['conflicting_capability_claims', 'ESCALATE_DOMAIN_EXPERT'],
    ['empty_project_no_evaluable_requirements', 'NO_SUPPORTED_TECHNICAL_DISPOSITION']
  ];
  for (const [scenarioId, expected] of cases) {
    const viewModel = await loadWorkbenchViewModel(scenarioId);
    assert.equal(viewModel.technicalPursuitSummary.nextTechnicalAction, expected, scenarioId);
  }
});

test('hard matches, hard mismatches, and missing inputs stay semantically distinct', async () => {
  const fit = await loadWorkbenchViewModel('strong_verified_cooling_fit');
  assert.equal(fit.hardMatches.length, 1);
  assert.equal(fit.hardMismatches.length, 0);
  assert.equal(fit.missingRequirements.length, 0);
  assert.equal(fit.hardMatches[0].state, 'VERIFIED_MATCH');
  const mismatch = await loadWorkbenchViewModel('hard_voltage_mismatch');
  assert.equal(mismatch.hardMismatches.length, 1);
  assert.equal(mismatch.hardMismatches[0].state, 'VERIFIED_MISMATCH');
  assert.equal(mismatch.hardMismatches[0].reasonCodes.includes('HARD_REQUIREMENT_MISMATCH'), true);
  const missing = await loadWorkbenchViewModel('missing_incoming_voltage');
  assert.equal(missing.hardMismatches.length, 0);
  assert.equal(missing.missingRequirements.length, 1);
  assert.equal(missing.missingRequirements[0].criticality, 'BLOCKING');
});

test('allowed claim content is explicit while blocked claim content remains metadata-only', async () => {
  const allowed = await loadWorkbenchViewModel('strong_verified_cooling_fit');
  assert.ok(allowed.allowedClaims.length >= 3);
  assert.ok(allowed.allowedClaims.every((claim) => claim.statement && claim.sourceTitle && claim.sourceUrl && claim.directQuote));
  const blocked = await loadWorkbenchViewModel('unverified_product_capability');
  assert.ok(blocked.blockedClaims.length >= 1);
  assert.ok(blocked.blockedClaims.every((claim) => Object.keys(claim).sort().join(',') === 'claimId,reasonCodes,remediation,sourceLocation'));
  const rawStatement = (await loadWorkbenchDomain('unverified_product_capability')).materialized.registry.byKey.get('cap_bms_unverified').statement;
  assert.equal(JSON.stringify(blocked).includes(rawStatement), false);
});

test('conflicting evidence shows both ids and remains blocked', async () => {
  const viewModel = await loadWorkbenchViewModel('conflicting_capability_claims');
  assert.equal(viewModel.conflicts.length, 2);
  assert.ok(viewModel.conflicts.every((item) => item.conflictClaimIds.length === 1));
  assert.ok(viewModel.blockedClaims.every((item) => item.reasonCodes.includes('CLAIM_CONFLICTED')));
  assert.equal(viewModel.reviewPolicy.families[0].dispositions.find((item) => item.value === 'ESCALATE_DOMAIN_EXPERT').supported, true);
});

test('view model supports no questions and multiple bounded technical questions', async () => {
  assert.equal((await loadWorkbenchViewModel('strong_verified_cooling_fit')).technicalQuestions.length, 0);
  const { inputs, catalog, materialized, timeline } = await loadWorkbenchDomain();
  const opportunity = clone(materialized.opportunity);
  opportunity.requirements.push(
    {
      requirementId: 'req_redundancy_topology', category: 'cooling', key: 'redundancy_topology', productFamilyIds: ['oil_free_compressor'], priority: 'HARD', valueState: 'UNKNOWN', operator: 'EQ', value: { type: 'STRING', key: 'redundancy_topology', value: 'N_PLUS_1' }, evidenceClaimRefs: []
    },
    {
      requirementId: 'req_design_it_load', category: 'electrical_power', key: 'design_it_load', productFamilyIds: ['oil_free_compressor'], priority: 'HARD', valueState: 'UNKNOWN', operator: 'GTE', value: { type: 'QUANTITY', key: 'design_it_load', value: 10, unit: 'MW', quantityKind: 'active_power' }, evidenceClaimRefs: []
    }
  );
  const domain = await import('../verticals/datacenter/index.mjs');
  const view = await import('../pursuit-workbench/domain/view-model.mjs');
  const evaluation = domain.evaluateSpecificationFit(opportunity, materialized.registry, inputs.verticalPack);
  const dossier = domain.buildPursuitDossier(opportunity, evaluation, materialized.registry, inputs.verticalPack);
  const builtTimeline = timeline.buildProjectSignalTimeline(opportunity, evaluation, materialized.registry, inputs.verticalPack);
  const scenario = catalog.scenarios.find((item) => item.id === 'strong_verified_cooling_fit');
  const viewModel = view.buildPursuitWorkbenchViewModel({
    scenario, opportunity, evaluation, dossier, suppliedDossierHashes: domain.dossierHashes(dossier),
    timeline: builtTimeline.timeline, timelineSha256: builtTimeline.timelineSha256,
    registry: materialized.registry, verticalPack: inputs.verticalPack, productFamilyMap: inputs.productFamilyMap
  });
  assert.equal(viewModel.technicalQuestions.length, 2);
  assert.deepEqual(viewModel.technicalQuestions.map((item) => item.questionId).sort(), ['q_design_it_load', 'q_redundancy']);
});

test('view model rejects forged dossier hashes and a forged dossier', async () => {
  const { inputs, catalog, materialized, timelineResult, timeline: timelineDomain } = await loadWorkbenchDomain();
  const view = await import('../pursuit-workbench/domain/view-model.mjs');
  const dossierDomain = await import('../verticals/datacenter/index.mjs');
  const claimDomain = await import('../knowledge/claim-registry/index.mjs');
  const scenario = catalog.scenarios.find((item) => item.id === 'strong_verified_cooling_fit');
  const base = {
    scenario, opportunity: materialized.opportunity, evaluation: materialized.evaluation, dossier: materialized.dossier,
    suppliedDossierHashes: materialized.dossierHashes, timeline: timelineResult.timeline, timelineSha256: timelineResult.timelineSha256,
    registry: materialized.registry, verticalPack: inputs.verticalPack, productFamilyMap: inputs.productFamilyMap
  };
  assert.throws(() => view.buildPursuitWorkbenchViewModel({ ...base, suppliedDossierHashes: { ...base.suppliedDossierHashes, jsonSha256: '0'.repeat(64) } }), expectCode('WORKBENCH_DOSSIER_HASH_MISMATCH'));
  assert.throws(() => view.buildPursuitWorkbenchViewModel({ ...base, dossier: { ...clone(base.dossier), productionReady: true } }), expectCode('WORKBENCH_DOSSIER_FORGED'));
  const forgedDossier = { ...clone(base.dossier), productionReady: true };
  const forgedHashes = dossierDomain.dossierHashes(forgedDossier);
  const forgedTimelineInput = clone(base.timeline);
  forgedTimelineInput.sourceHashes.dossierJsonSha256 = forgedHashes.jsonSha256;
  const forgedTimeline = timelineDomain.createValidatedProjectSignalTimeline(forgedTimelineInput, {
    registry: materialized.registry, opportunity: materialized.opportunity, verticalPack: inputs.verticalPack
  });
  assert.throws(() => view.buildPursuitWorkbenchViewModel({
    ...base,
    dossier: forgedDossier,
    suppliedDossierHashes: forgedHashes,
    timeline: forgedTimeline,
    timelineSha256: claimDomain.sha256(forgedTimeline)
  }), expectCode('WORKBENCH_DOSSIER_FORGED'));
});

test('view model rejects raw registry objects and non-synthetic opportunities', async () => {
  const { inputs, catalog, materialized, timelineResult } = await loadWorkbenchDomain();
  const view = await import('../pursuit-workbench/domain/view-model.mjs');
  const scenario = catalog.scenarios.find((item) => item.id === 'strong_verified_cooling_fit');
  const base = {
    scenario, opportunity: materialized.opportunity, evaluation: materialized.evaluation, dossier: materialized.dossier,
    suppliedDossierHashes: materialized.dossierHashes, timeline: timelineResult.timeline, timelineSha256: timelineResult.timelineSha256,
    registry: materialized.registry, verticalPack: inputs.verticalPack, productFamilyMap: inputs.productFamilyMap
  };
  assert.throws(() => view.buildPursuitWorkbenchViewModel({ ...base, registry: { schemaVersion: materialized.registry.schemaVersion } }), expectCode('UNVALIDATED_REGISTRY'));
  assert.throws(() => view.buildPursuitWorkbenchViewModel({ ...base, opportunity: { ...clone(materialized.opportunity), synthetic: false } }), expectCode('SYNTHETIC_OPPORTUNITY_REQUIRED'));
});

test('secret-shaped and oversized display values are refused before rendering', async () => {
  const { inputs, catalog, materialized, timelineResult } = await loadWorkbenchDomain();
  const view = await import('../pursuit-workbench/domain/view-model.mjs');
  const scenario = catalog.scenarios.find((item) => item.id === 'strong_verified_cooling_fit');
  const base = {
    scenario, opportunity: materialized.opportunity, evaluation: materialized.evaluation, dossier: materialized.dossier,
    suppliedDossierHashes: materialized.dossierHashes, timeline: timelineResult.timeline, timelineSha256: timelineResult.timelineSha256,
    registry: materialized.registry, verticalPack: inputs.verticalPack
  };
  const secretMap = clone(inputs.productFamilyMap);
  secretMap.families.find((item) => item.id === 'oil_free_compressor').displayNameEn = 'Bearer abcdefghijklmnopqrstuvwxyz123456';
  assert.throws(() => view.buildPursuitWorkbenchViewModel({ ...base, productFamilyMap: secretMap }), expectCode('SECRET_SHAPED_VALUE'));
  const oversizedMap = clone(inputs.productFamilyMap);
  oversizedMap.families.find((item) => item.id === 'oil_free_compressor').displayNameEn = 'X'.repeat(161);
  assert.throws(() => view.buildPursuitWorkbenchViewModel({ ...base, productFamilyMap: oversizedMap }), expectCode('WORKBENCH_PRODUCT_MAP_INVALID'));
});

test('validated view models are immutable and expose no reviewer notes, feedback, or protected inputs', async () => {
  const viewModel = await loadWorkbenchViewModel('missing_incoming_voltage');
  const view = await import('../pursuit-workbench/domain/view-model.mjs');
  assert.equal(view.assertValidatedPursuitWorkbenchViewModel(viewModel), true);
  assert.equal(Object.isFrozen(viewModel), true);
  assert.equal(Object.isFrozen(viewModel.reviewPolicy), true);
  assert.doesNotMatch(JSON.stringify(viewModel), /manualReviewNotes|reviewerFeedback|generatedSuggestion|email|recipient|cookie/i);
});
