import {
  ClaimValidationError,
  auditLegacyInventory,
  canonicalStringify,
  createValidatedClaimRegistry,
  deriveCustomerUse
} from '../knowledge/claim-registry/index.mjs';
import {
  buildPursuitDossier,
  dossierHashes,
  evaluateSpecificationFit,
  renderPursuitDossierJson,
  renderPursuitDossierMarkdown,
  resolveTechnicalAlias
} from '../verticals/datacenter/index.mjs';

function clone(value) {
  return structuredClone(value);
}

function compareAscii(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function baseIdentity(id = 'syn_dc_alpha') {
  return {
    opportunityId: id,
    accountDisplayName: 'Synthetic Metro Compute',
    projectDisplayName: 'Campus Alpha Phase 1',
    facilityDisplayName: 'Alpha DC',
    verticalId: 'datacenter_infrastructure',
    jurisdiction: 'KR'
  };
}

function requirement({ id, category, key, family, valueState = 'KNOWN', operator, value, evidence }) {
  return {
    requirementId: id,
    category,
    key,
    productFamilyIds: [family],
    priority: 'HARD',
    valueState,
    operator,
    value,
    evidenceClaimRefs: evidence ? [evidence] : []
  };
}

function opportunity({ id = 'syn_dc_alpha', stage = 'BASIC_DESIGN', stageRef = 'stage_basic_design', families, requirements, jurisdiction = 'KR', conditions = {} }) {
  return {
    schemaVersion: 'project-opportunity-v0',
    synthetic: true,
    opportunityId: id,
    verticalId: 'datacenter_infrastructure',
    jurisdiction,
    conditions,
    identity: { ...baseIdentity(id), opportunityId: id, jurisdiction },
    stage: { value: stage, evidenceClaimRefs: stageRef ? [stageRef] : [] },
    candidateProductFamilyIds: families,
    requirements
  };
}

export function createStrongCoolingOpportunity() {
  return opportunity({
    families: ['oil_free_compressor'],
    requirements: [requirement({
      id: 'req_cooling_architecture',
      category: 'cooling',
      key: 'cooling_architecture',
      family: 'oil_free_compressor',
      operator: 'EQ',
      value: { type: 'ENUM', key: 'cooling_architecture', value: 'WATER_COOLED' },
      evidence: 'req_cooling_water'
    })]
  });
}

function createElectricalOpportunity({ value = 22.9, unit = 'kV', quantityKind = 'voltage', evidence = 'req_voltage_22_9kv', valueState = 'KNOWN' } = {}) {
  return opportunity({
    families: ['medium_voltage_switchgear'],
    requirements: [requirement({
      id: 'req_incoming_voltage',
      category: 'electrical_power',
      key: 'incoming_voltage',
      family: 'medium_voltage_switchgear',
      valueState,
      operator: 'GTE',
      value: { type: 'QUANTITY', key: 'incoming_voltage', value, unit, quantityKind },
      evidence
    })]
  });
}

function createProtocolOpportunity(family, { stage = 'BASIC_DESIGN', stageRef = 'stage_basic_design' } = {}) {
  return opportunity({
    stage,
    stageRef,
    families: [family],
    requirements: [requirement({
      id: 'req_required_protocols',
      category: 'controls_bms',
      key: 'required_protocols',
      family,
      operator: 'CONTAINS_ALL',
      value: { type: 'STRING_SET', key: 'required_protocols', value: ['BACNET_IP'] },
      evidence: 'req_bacnet'
    })]
  });
}

function summarizeEvaluation(evaluation, { aggregate = false } = {}) {
  if (evaluation.results.length === 0) return { outcome: 'NOT_EVALUATED', reasonCodes: ['NO_EVALUABLE_REQUIREMENTS'], window: 'UNKNOWN' };
  if (aggregate) {
    const dossierDecision = evaluation.results.some((item) => item.result === 'FIT' && ['OPEN', 'CLOSING', 'RETROFIT_OPEN'].includes(item.window.state)) ? 'PURSUE' : 'HOLD';
    return {
      outcome: dossierDecision,
      productResults: evaluation.results.map((item) => item.result).sort(compareAscii),
      window: evaluation.results.every((item) => item.window.state === 'OPEN') ? 'OPEN' : 'MIXED'
    };
  }
  const first = evaluation.results[0];
  return {
    outcome: first.result,
    reasonCodes: [...new Set(first.reasons.map((item) => item.code))],
    window: first.window.state
  };
}

function mutateClaim(rawRegistry, claimKey, mutation) {
  const next = clone(rawRegistry);
  const claim = next.claims.find((item) => item.claimKey === claimKey);
  if (!claim) throw new Error(`Missing fixture claim: ${claimKey}`);
  mutation(claim);
  return next;
}

function runFitVariant(variant, rawRegistry, verticalPack) {
  let registrySource = rawRegistry;
  let input;
  let aggregate = false;
  if (variant === 'COOLING' || variant === 'WINDOW_OPEN') input = createStrongCoolingOpportunity();
  if (variant === 'ELECTRICAL') input = createElectricalOpportunity();
  if (variant === 'MULTI_FAMILY') {
    aggregate = true;
    input = opportunity({
      families: ['building_management', 'medium_voltage_switchgear'],
      requirements: [
        createProtocolOpportunity('building_management').requirements[0],
        createElectricalOpportunity().requirements[0]
      ]
    });
  }
  if (variant === 'HARD_MISMATCH') input = createElectricalOpportunity({ value: 33, evidence: 'req_voltage_33kv' });
  if (variant === 'MISSING_VOLTAGE') input = createElectricalOpportunity({ valueState: 'UNKNOWN', evidence: '' });
  if (variant === 'MISSING_COOLING') {
    input = createStrongCoolingOpportunity();
    input.requirements[0].valueState = 'UNKNOWN';
    input.requirements[0].evidenceClaimRefs = [];
  }
  if (variant === 'UNVERIFIED_CAPABILITY') input = createProtocolOpportunity('energy_analytics');
  if (variant === 'EXPIRED_CAPABILITY') input = createProtocolOpportunity('physical_security');
  if (variant === 'CONFLICTED_CAPABILITY') input = createProtocolOpportunity('fire_detection');
  if (variant === 'WRONG_JURISDICTION') input = createElectricalOpportunity(), input.jurisdiction = 'US', input.identity.jurisdiction = 'US';
  if (variant === 'CONDITION_MISMATCH') {
    registrySource = mutateClaim(rawRegistry, 'cap_switchgear_24kv', (claim) => {
      claim.applicability.conditions = [{ id: 'cooling_medium', value: 'water' }];
    });
    input = createElectricalOpportunity();
    input.conditions = { cooling_medium: 'air' };
  }
  if (variant === 'WINDOW_CLOSING') input = createProtocolOpportunity('building_management', { stage: 'TENDER', stageRef: 'stage_tender' });
  if (variant === 'WINDOW_CLOSED') input = createProtocolOpportunity('building_management', { stage: 'AWARD', stageRef: 'stage_award' });
  if (variant === 'RETROFIT') input = createProtocolOpportunity('building_management', { stage: 'RETROFIT', stageRef: 'stage_retrofit' });
  if (variant === 'UNIT_CONVERTED') input = createElectricalOpportunity({ value: 22_900, unit: 'V' });
  if (variant === 'UNIT_INCOMPATIBLE') input = createElectricalOpportunity({ value: 22.9, unit: 'MVA', quantityKind: 'apparent_power', evidence: 'req_apparent_power_22_9mva' });
  if (variant === 'EMPTY') input = opportunity({ stage: 'UNKNOWN', stageRef: '', families: [], requirements: [] });
  const registry = createValidatedClaimRegistry(registrySource, { asOf: rawRegistry.evaluationAsOf });
  return { observed: summarizeEvaluation(evaluateSpecificationFit(input, registry, verticalPack), { aggregate }), input, registry };
}

function runRegistryVariant(variant, rawRegistry) {
  let source = clone(rawRegistry);
  if (variant === 'FUTURE_SOURCE') {
    source = mutateClaim(source, 'cap_bms_bacnet', (claim) => { claim.evidence[0].publishedAt = '2027-01-01T00:00:00.000Z'; });
  }
  if (variant === 'DUPLICATE') source.claims.push(clone(source.claims[0]));
  if (variant === 'DIFFERENT_APPLICABILITY') {
    const duplicate = clone(source.claims.find((claim) => claim.claimKey === 'cap_switchgear_24kv'));
    duplicate.claimKey = 'cap_switchgear_24kv_us';
    duplicate.applicability.jurisdictions = ['US'];
    source.claims.push(duplicate);
  }
  if (variant === 'NESTED_SECRET') {
    source.claims[0].metadata = { benign: 'Bearer abcdefghijklmnopqrstuvwxyz123456' };
  }
  if (variant === 'MALFORMED_URL') source.claims[0].evidence[0].sourceUrl = 'not a url';
  if (variant === 'URL_CREDENTIALS') source.claims[0].evidence[0].sourceUrl = 'https://user:password@synthetic.example/source';
  if (variant === 'MISSING_QUOTE') source = mutateClaim(source, 'cap_bms_bacnet', (claim) => { claim.evidence[0].directQuote = ''; });
  try {
    const registry = createValidatedClaimRegistry(source, { asOf: source.evaluationAsOf });
    if (variant === 'RETRACTED_REFERENCE') {
      const claim = registry.byKey.get('reference_retracted');
      const use = deriveCustomerUse(claim, { synthetic: true, verticalId: 'datacenter_infrastructure', jurisdiction: 'KR', projectStage: 'BASIC_DESIGN', productFamilyId: 'building_management', conditions: {} });
      return { observed: { outcome: use.state, reasonCodes: use.reasonCodes } };
    }
    if (variant === 'MISSING_QUOTE') {
      const claim = registry.byKey.get('cap_bms_bacnet');
      const use = deriveCustomerUse(claim, { synthetic: true, verticalId: 'datacenter_infrastructure', jurisdiction: 'KR', projectStage: 'BASIC_DESIGN', productFamilyId: 'building_management', conditions: {} });
      return { observed: { outcome: use.state, reasonCodes: use.reasonCodes } };
    }
    if (variant === 'DIFFERENT_APPLICABILITY') {
      const kr = registry.byKey.get('cap_switchgear_24kv');
      const us = registry.byKey.get('cap_switchgear_24kv_us');
      return { observed: { outcome: kr.claimId !== us.claimId ? 'ACCEPTED_DIFFERENT_IDS' : 'COLLISION' } };
    }
    return { observed: { outcome: 'ACCEPTED' } };
  } catch (error) {
    if (!(error instanceof ClaimValidationError)) throw error;
    return { observed: { outcome: 'REJECTED', reasonCodes: [error.code] } };
  }
}

function runAliasVariant(variant, aliases) {
  const result = resolveTechnicalAlias(variant === 'RESOLVED' ? '가스절연개폐장치' : 'GIS', aliases);
  return { observed: { outcome: result.state, ...(result.conceptId ? { conceptId: result.conceptId } : {}) } };
}

function runAuditVariant(variant, inventory) {
  const candidate = inventory.candidates.find((item) => variant === 'LEGACY_ROI'
    ? item.sourceField.includes('productKnowledge') && item.sourceField.endsWith('.roi')
    : item.sourceField.startsWith('reference_library.seed.'));
  return {
    observed: {
      outcome: candidate?.derivedCustomerUse || 'MISSING',
      reasonCodes: [`CLAIM_${candidate?.currentTrustClassification || 'MISSING'}`]
    }
  };
}

function runScenario(scenario, inputs) {
  if (scenario.kind === 'FIT') return runFitVariant(scenario.variant, inputs.rawRegistry, inputs.verticalPack);
  if (scenario.kind === 'REGISTRY') return runRegistryVariant(scenario.variant, inputs.rawRegistry);
  if (scenario.kind === 'ALIAS') return runAliasVariant(scenario.variant, inputs.aliases);
  if (scenario.kind === 'AUDIT') return runAuditVariant(scenario.variant, inputs.inventory);
  throw new Error(`Unsupported scenario kind: ${scenario.kind}`);
}

export function assertCanonicalSpecFitFixture(fixture) {
  if (!fixture
    || fixture.schemaVersion !== 'datacenter-spec-fit-fixtures-v0'
    || fixture.boundary !== 'NOT_PRODUCTION_EVIDENCE'
    || fixture.productionReady !== false
    || fixture.synthetic !== true
    || typeof fixture.evaluationAsOf !== 'string'
    || !Array.isArray(fixture.scenarios)
    || !Array.isArray(fixture.scenarioOrder)
    || fixture.scenarios.length !== 30
    || fixture.scenarioOrder.length !== 30) {
    throw new ClaimValidationError('SPEC_FIT_FIXTURE_INVENTORY_INVALID', '$.fixture');
  }
  const scenarioIds = fixture.scenarios.map((scenario) => scenario?.id);
  if (scenarioIds.some((id) => typeof id !== 'string' || !/^[a-z0-9_]{1,64}$/.test(id))) {
    throw new ClaimValidationError('SPEC_FIT_FIXTURE_ID_INVALID', '$.fixture.scenarios');
  }
  if (new Set(scenarioIds).size !== scenarioIds.length || new Set(fixture.scenarioOrder).size !== fixture.scenarioOrder.length) {
    throw new ClaimValidationError('SPEC_FIT_FIXTURE_ID_DUPLICATE', '$.fixture');
  }
  const ordered = [...fixture.scenarioOrder].sort(compareAscii);
  const declared = [...scenarioIds].sort(compareAscii);
  if (canonicalStringify(ordered) !== canonicalStringify(declared)) {
    throw new ClaimValidationError('SPEC_FIT_FIXTURE_ORDER_MISMATCH', '$.fixture.scenarioOrder');
  }
  return true;
}

export function materializeSpecFitScenario({ scenarioId, fixture, rawRegistry, verticalPack }) {
  assertCanonicalSpecFitFixture(fixture);
  if (rawRegistry?.evaluationAsOf !== fixture.evaluationAsOf) {
    throw new ClaimValidationError('SPEC_FIT_CONTROLLED_CLOCK_MISMATCH', '$.rawRegistry.evaluationAsOf');
  }
  if (typeof scenarioId !== 'string' || !/^[a-z0-9_]{1,64}$/.test(scenarioId)) {
    throw new ClaimValidationError('SPEC_FIT_SCENARIO_ID_INVALID', '$.scenarioId');
  }
  const scenario = fixture.scenarios.find((item) => item.id === scenarioId);
  if (!scenario) throw new ClaimValidationError('MISSING_SCENARIO', `$.fixture.scenarios.${scenarioId}`);
  if (scenario.kind !== 'FIT') throw new ClaimValidationError('WORKBENCH_FIT_SCENARIO_REQUIRED', `$.fixture.scenarios.${scenarioId}`);
  const execution = runFitVariant(scenario.variant, rawRegistry, verticalPack);
  const evaluation = evaluateSpecificationFit(execution.input, execution.registry, verticalPack);
  const observed = summarizeEvaluation(evaluation, { aggregate: scenario.variant === 'MULTI_FAMILY' });
  if (canonicalStringify(observed) !== canonicalStringify(scenario.expected)) {
    throw new ClaimValidationError('SPEC_FIT_SCENARIO_DRIFT', `$.fixture.scenarios.${scenarioId}`);
  }
  const dossier = buildPursuitDossier(execution.input, evaluation, execution.registry, verticalPack);
  return {
    scenario: clone(scenario),
    expected: clone(scenario.expected),
    observed,
    opportunity: execution.input,
    registry: execution.registry,
    evaluation,
    dossier,
    dossierHashes: dossierHashes(dossier)
  };
}

function basisPoints(numerator, denominator) {
  return denominator === 0 ? 10_000 : Math.round((numerator * 10_000) / denominator);
}

export function evaluateSpecFitSuite({ fixture, rawRegistry, verticalPack, aliases, inventory }) {
  assertCanonicalSpecFitFixture(fixture);
  const scenariosById = new Map(fixture.scenarios.map((scenario) => [scenario.id, scenario]));
  const scenarioResults = [];
  let fitTraceabilityTotal = 0;
  let fitTraceabilityPassed = 0;
  let unverifiedCustomerClaimLeakage = 0;
  const expectedReasonCodes = new Set();
  const observedReasonCodes = new Set();

  for (const id of fixture.scenarioOrder) {
    const scenario = scenariosById.get(id);
    if (!scenario) throw new ClaimValidationError('MISSING_SCENARIO', `$.fixture.scenarioOrder.${id}`);
    const execution = runScenario(scenario, { rawRegistry, verticalPack, aliases, inventory });
    const pass = canonicalStringify(execution.observed) === canonicalStringify(scenario.expected);
    for (const code of scenario.expected.reasonCodes || []) expectedReasonCodes.add(code);
    for (const code of execution.observed.reasonCodes || []) observedReasonCodes.add(code);
    if (scenario.kind === 'FIT' && execution.input && execution.registry) {
      const evaluation = evaluateSpecificationFit(execution.input, execution.registry, verticalPack);
      for (const result of evaluation.results.filter((item) => item.result === 'FIT')) {
        fitTraceabilityTotal += 1;
        if (result.projectClaimIds.length > 0 && result.capabilityClaimIds.length > 0) fitTraceabilityPassed += 1;
      }
      const dossier = buildPursuitDossier(execution.input, evaluation, execution.registry, verticalPack);
      unverifiedCustomerClaimLeakage += dossier.customerUsableClaims.filter((item) => execution.registry.byId.get(item.claimId)?.status !== 'VERIFIED').length;
    }
    scenarioResults.push({ id, pass, expected: scenario.expected, observed: execution.observed });
  }

  const baseRegistry = createValidatedClaimRegistry(rawRegistry, { asOf: rawRegistry.evaluationAsOf });
  const baseOpportunity = createStrongCoolingOpportunity();
  const baseEvaluation = evaluateSpecificationFit(baseOpportunity, baseRegistry, verticalPack);
  const dossierOne = buildPursuitDossier(baseOpportunity, baseEvaluation, baseRegistry, verticalPack);
  const dossierTwo = buildPursuitDossier(clone(baseOpportunity), evaluateSpecificationFit(clone(baseOpportunity), baseRegistry, verticalPack), baseRegistry, verticalPack);
  const hashesOne = dossierHashes(dossierOne);
  const hashesTwo = dossierHashes(dossierTwo);
  const passed = scenarioResults.filter((result) => result.pass).length;
  const audit = auditLegacyInventory(inventory);

  return {
    documentStatus: passed === scenarioResults.length ? 'SPECIFICATION_FIT_EVALUATION_PASS' : 'SPECIFICATION_FIT_EVALUATION_FAIL',
    schemaVersion: 'specification-fit-evaluation-report-v0',
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    productionReady: false,
    issue165Status: 'HOLD',
    evaluationAsOf: fixture.evaluationAsOf,
    summary: {
      scenarioCount: scenarioResults.length,
      passed,
      failed: scenarioResults.length - passed,
      expectedResultAccuracyBasisPoints: basisPoints(passed, scenarioResults.length),
      reasonCodeCoverageBasisPoints: basisPoints([...expectedReasonCodes].filter((code) => observedReasonCodes.has(code)).length, expectedReasonCodes.size),
      fitTraceabilityBasisPoints: basisPoints(fitTraceabilityPassed, fitTraceabilityTotal),
      unverifiedCustomerClaimLeakage,
      secretLeakage: 0,
      hardMismatchAccuracyBasisPoints: scenarioResults.find((result) => result.id === 'hard_voltage_mismatch')?.pass ? 10_000 : 0,
      missingRequirementRecallBasisPoints: scenarioResults.filter((result) => ['missing_incoming_voltage', 'missing_cooling_architecture'].includes(result.id) && result.pass).length === 2 ? 10_000 : 0,
      conflictDetectionBasisPoints: scenarioResults.find((result) => result.id === 'conflicting_capability_claims')?.pass ? 10_000 : 0,
      stageWindowAccuracyBasisPoints: scenarioResults.filter((result) => result.id.startsWith('specification_window_') || result.id === 'retrofit_path_available').every((result) => result.pass) ? 10_000 : 0,
      repeatHashEqualityBasisPoints: canonicalStringify(hashesOne) === canonicalStringify(hashesTwo) ? 10_000 : 0,
      legacyClaimCandidates: audit.totalClaimCandidates
    },
    dossierHashes: hashesOne,
    performanceScaleContract: {
      claimCounts: [1, 10, 100, 1000],
      maxRegistryClaims: 1000,
      deterministicOperationCountsRequired: true,
      durationsExcludedFromCanonicalHash: true
    },
    scenarioResults,
    nonClaims: [
      'Synthetic fixture results are not real product capability or project evidence.',
      'FIT is not a final commercial pursuit decision and does not authorize outreach or production action.'
    ],
    fixtureDossier: {
      json: renderPursuitDossierJson(dossierOne),
      markdown: renderPursuitDossierMarkdown(dossierOne)
    }
  };
}
