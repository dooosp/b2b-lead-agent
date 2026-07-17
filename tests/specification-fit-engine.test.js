const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const rawRegistry = require('../knowledge/claim-registry/synthetic/datacenter-claims-v1.json');
const verticalPack = require('../verticals/datacenter/vertical-pack-v0.json');
const aliases = require('../verticals/datacenter/technical-aliases-v0.json');
const fixture = require('../eval/fixtures/spec-fit/datacenter-v0-scenarios.json');
const inventory = require('../knowledge/claim-registry/managed-profile-legacy-inventory.json');
const clone = (value) => structuredClone(value);

async function inputs() {
  const core = await import(path.resolve(__dirname, '../knowledge/claim-registry/index.mjs'));
  const evaluator = await import(path.resolve(__dirname, '../eval/spec-fit-evaluator.mjs'));
  const domain = await import(path.resolve(__dirname, '../verticals/datacenter/index.mjs'));
  return { core, evaluator, domain };
}

test('the exact 30-scenario matrix passes all strict metrics', async () => {
  const { evaluator } = await inputs();
  const report = evaluator.evaluateSpecFitSuite({ fixture, rawRegistry, verticalPack, aliases, inventory });
  assert.equal(report.documentStatus, 'SPECIFICATION_FIT_EVALUATION_PASS');
  assert.deepEqual(report.summary, {
    scenarioCount: 30,
    passed: 30,
    failed: 0,
    expectedResultAccuracyBasisPoints: 10_000,
    reasonCodeCoverageBasisPoints: 10_000,
    fitTraceabilityBasisPoints: 10_000,
    unverifiedCustomerClaimLeakage: 0,
    secretLeakage: 0,
    hardMismatchAccuracyBasisPoints: 10_000,
    missingRequirementRecallBasisPoints: 10_000,
    conflictDetectionBasisPoints: 10_000,
    stageWindowAccuracyBasisPoints: 10_000,
    repeatHashEqualityBasisPoints: 10_000,
    legacyClaimCandidates: 160
  });
  assert.deepEqual(report.scenarioResults.map((scenario) => scenario.id), fixture.scenarioOrder);
  assert.ok(report.scenarioResults.every((scenario) => scenario.pass));
});

test('FIT contains exact project and capability claim traces in deterministic order', async () => {
  const { core, evaluator, domain } = await inputs();
  const registry = core.createValidatedClaimRegistry(rawRegistry, { asOf: rawRegistry.evaluationAsOf });
  const opportunity = evaluator.createStrongCoolingOpportunity();
  const evaluation = domain.evaluateSpecificationFit(opportunity, registry, verticalPack);
  assert.equal(evaluation.results.length, 1);
  const result = evaluation.results[0];
  assert.equal(result.result, 'FIT');
  assert.deepEqual(result.reasons.map((reason) => reason.code), ['HARD_REQUIREMENT_MATCH']);
  assert.deepEqual(result.matchedRequirementIds, ['req_cooling_architecture']);
  assert.deepEqual(result.missingRequirementIds, []);
  assert.deepEqual(result.projectClaimIds, [registry.byKey.get('req_cooling_water').claimId]);
  assert.deepEqual(result.capabilityClaimIds, [registry.byKey.get('cap_compressor_water').claimId]);
  assert.equal(result.window.state, 'OPEN');
  assert.deepEqual(evaluation, domain.evaluateSpecificationFit(clone(opportunity), registry, verticalPack));
});

test('project evidence must bind the exact semantic requirement and applicable jurisdiction', async () => {
  const { core, evaluator, domain } = await inputs();
  const registry = core.createValidatedClaimRegistry(rawRegistry, { asOf: rawRegistry.evaluationAsOf });
  const mismatch = evaluator.createStrongCoolingOpportunity();
  mismatch.requirements[0].value.value = 'AIR_COOLED';
  const mismatchResult = domain.evaluateSpecificationFit(mismatch, registry, verticalPack).results[0];
  assert.equal(mismatchResult.result, 'INSUFFICIENT_EVIDENCE');
  assert.deepEqual(mismatchResult.reasons.map((reason) => reason.code), ['PROJECT_FACT_UNVERIFIED']);

  const wrongJurisdiction = evaluator.createStrongCoolingOpportunity();
  wrongJurisdiction.jurisdiction = 'US';
  wrongJurisdiction.identity.jurisdiction = 'US';
  const jurisdictionResult = domain.evaluateSpecificationFit(wrongJurisdiction, registry, verticalPack).results[0];
  assert.equal(jurisdictionResult.result, 'INSUFFICIENT_EVIDENCE');
  assert.ok(jurisdictionResult.reasons.some((reason) => reason.code === 'JURISDICTION_MISMATCH'));
  assert.equal(jurisdictionResult.window.state, 'UNKNOWN');
});

test('project evidence uses requirement threshold semantics instead of forced equality', async () => {
  const { core, evaluator, domain } = await inputs();
  const registry = core.createValidatedClaimRegistry(rawRegistry, { asOf: rawRegistry.evaluationAsOf });
  const opportunity = evaluator.createStrongCoolingOpportunity();
  opportunity.candidateProductFamilyIds = ['medium_voltage_switchgear'];
  opportunity.requirements = [{
    requirementId: 'req_incoming_voltage_threshold',
    category: 'electrical_power',
    key: 'incoming_voltage',
    productFamilyIds: ['medium_voltage_switchgear'],
    priority: 'HARD',
    valueState: 'KNOWN',
    operator: 'GTE',
    value: { type: 'QUANTITY', key: 'incoming_voltage', value: 22.5, unit: 'kV', quantityKind: 'voltage' },
    evidenceClaimRefs: ['req_voltage_22_9kv']
  }];
  const result = domain.evaluateSpecificationFit(opportunity, registry, verticalPack).results[0];
  assert.equal(result.result, 'FIT');
  assert.ok(result.reasons.some((item) => item.code === 'HARD_REQUIREMENT_MATCH'));
});

test('stage-scoped capability evidence cannot be reused at another project stage', async () => {
  const { core, evaluator, domain } = await inputs();
  const scopedRaw = clone(rawRegistry);
  scopedRaw.claims.find((claim) => claim.claimKey === 'cap_bms_bacnet').applicability.projectStages = ['BASIC_DESIGN'];
  const registry = core.createValidatedClaimRegistry(scopedRaw, { asOf: rawRegistry.evaluationAsOf });
  const opportunity = evaluator.createStrongCoolingOpportunity();
  opportunity.stage = { value: 'TENDER', evidenceClaimRefs: ['stage_tender'] };
  opportunity.candidateProductFamilyIds = ['building_management'];
  opportunity.requirements = [{
    requirementId: 'req_bacnet_at_tender',
    category: 'controls_bms',
    key: 'required_protocols',
    productFamilyIds: ['building_management'],
    priority: 'HARD',
    valueState: 'KNOWN',
    operator: 'CONTAINS_ALL',
    value: { type: 'STRING_SET', key: 'required_protocols', value: ['BACNET_IP'] },
    evidenceClaimRefs: ['req_bacnet']
  }];
  const result = domain.evaluateSpecificationFit(opportunity, registry, verticalPack).results[0];
  assert.equal(result.result, 'INSUFFICIENT_EVIDENCE');
  assert.ok(result.reasons.some((item) => item.code === 'CONDITION_MISMATCH'));
  assert.equal(result.window.state, 'CLOSING');
});

test('hard mismatch, unverified capability, conflict, units, and empty input keep exact precedence', async () => {
  const { evaluator } = await inputs();
  const report = evaluator.evaluateSpecFitSuite({ fixture, rawRegistry, verticalPack, aliases, inventory });
  const observed = Object.fromEntries(report.scenarioResults.map((scenario) => [scenario.id, scenario.observed]));
  assert.deepEqual(observed.hard_voltage_mismatch, { outcome: 'NOT_FIT', reasonCodes: ['HARD_REQUIREMENT_MISMATCH'], window: 'OPEN' });
  assert.deepEqual(observed.unverified_product_capability, { outcome: 'CONDITIONAL_FIT', reasonCodes: ['CAPABILITY_CLAIM_UNVERIFIED'], window: 'OPEN' });
  assert.deepEqual(observed.conflicting_capability_claims, { outcome: 'INSUFFICIENT_EVIDENCE', reasonCodes: ['CLAIM_CONFLICT'], window: 'OPEN' });
  assert.deepEqual(observed.convertible_unit_boundary, { outcome: 'FIT', reasonCodes: ['HARD_REQUIREMENT_MATCH', 'UNIT_CONVERTED'], window: 'OPEN' });
  assert.deepEqual(observed.incompatible_unit, { outcome: 'INSUFFICIENT_EVIDENCE', reasonCodes: ['UNIT_INCOMPATIBLE'], window: 'OPEN' });
  assert.deepEqual(observed.empty_project_no_evaluable_requirements, { outcome: 'NOT_EVALUATED', reasonCodes: ['NO_EVALUABLE_REQUIREMENTS'], window: 'UNKNOWN' });
});

test('unknown stage never opens a window and model-owned decisions are refused', async () => {
  const { core, evaluator, domain } = await inputs();
  const registry = core.createValidatedClaimRegistry(rawRegistry, { asOf: rawRegistry.evaluationAsOf });
  const opportunity = evaluator.createStrongCoolingOpportunity();
  opportunity.stage = { value: 'UNKNOWN', evidenceClaimRefs: [] };
  assert.equal(domain.evaluateSpecificationFit(opportunity, registry, verticalPack).results[0].window.state, 'UNKNOWN');
  opportunity.fitResult = 'FIT';
  assert.throws(() => domain.evaluateSpecificationFit(opportunity, registry, verticalPack), (error) => error.code === 'MODEL_AUTHORITY_FIELD_REFUSED');
});

test('bilingual aliases resolve exactly while ambiguity and alias overflow fail closed', async () => {
  const { domain } = await inputs();
  assert.deepEqual(domain.resolveTechnicalAlias('가스절연개폐장치', aliases), {
    state: 'RESOLVED', conceptId: 'medium_voltage_switchgear', reason: 'EXACT_BILINGUAL_ALIAS'
  });
  assert.equal(domain.resolveTechnicalAlias('GIS', aliases).state, 'AMBIGUOUS');
  assert.equal(domain.resolveTechnicalAlias('inverter', aliases).state, 'AMBIGUOUS');
  const overflow = clone(aliases);
  overflow.aliases[0].terms = Array.from({ length: 41 }, (_, index) => `alias-${index}`);
  assert.throws(() => domain.resolveTechnicalAlias('alias-1', overflow), (error) => error.code === 'TOO_MANY_ALIASES');
});
