const test = require('node:test');
const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const path = require('node:path');

const rawRegistry = require('../knowledge/claim-registry/synthetic/datacenter-claims-v1.json');
const verticalPack = require('../verticals/datacenter/vertical-pack-v0.json');
const clone = (value) => structuredClone(value);

async function setup() {
  const core = await import(path.resolve(__dirname, '../knowledge/claim-registry/index.mjs'));
  const evaluator = await import(path.resolve(__dirname, '../eval/spec-fit-evaluator.mjs'));
  const domain = await import(path.resolve(__dirname, '../verticals/datacenter/index.mjs'));
  const registry = core.createValidatedClaimRegistry(rawRegistry, { asOf: rawRegistry.evaluationAsOf });
  return { core, evaluator, domain, registry };
}

test('JSON and Markdown dossiers are byte-stable, scoped, and provenance-complete', async () => {
  const { evaluator, domain, registry } = await setup();
  const opportunity = evaluator.createStrongCoolingOpportunity();
  const evaluation = domain.evaluateSpecificationFit(opportunity, registry, verticalPack);
  const one = domain.buildPursuitDossier(opportunity, evaluation, registry, verticalPack);
  const two = domain.buildPursuitDossier(clone(opportunity), domain.evaluateSpecificationFit(clone(opportunity), registry, verticalPack), registry, verticalPack);
  const jsonOne = domain.renderPursuitDossierJson(one);
  const jsonTwo = domain.renderPursuitDossierJson(two);
  const markdownOne = domain.renderPursuitDossierMarkdown(one);
  const markdownTwo = domain.renderPursuitDossierMarkdown(two);
  assert.equal(jsonOne, jsonTwo);
  assert.equal(markdownOne, markdownTwo);
  assert.equal(jsonOne, await readFile(path.resolve(__dirname, '../eval/fixtures/spec-fit/expected/pursuit-dossier-v0.json'), 'utf8'));
  assert.equal(markdownOne, await readFile(path.resolve(__dirname, '../eval/fixtures/spec-fit/expected/pursuit-dossier-v0.md'), 'utf8'));
  assert.deepEqual(domain.dossierHashes(one), domain.dossierHashes(two));
  assert.equal(one.boundary, 'NOT_PRODUCTION_EVIDENCE');
  assert.equal(one.productionReady, false);
  assert.equal(one.issue165Status, 'HOLD');
  assert.equal(one.decision.decisionScope, 'TECHNICAL_FIT_AND_SPEC_WINDOW_ONLY');
  assert.equal(one.decision.finalHumanPursuitDecision, 'NOT_MADE');
  assert.ok(one.customerUsableClaims.length > 0);
  assert.ok(one.customerUsableClaims.every((claim) => claim.claimId && claim.sourceTitle && claim.sourceUrl && claim.directQuote && claim.verifiedAt && claim.applicability));
  assert.doesNotMatch(jsonOne, /send email now|contact name|recipient address/i);
  assert.doesNotMatch(markdownOne, /send email now/i);
});

test('dossier ordering is stable under registry and input permutation', async () => {
  const { evaluator, domain } = await setup();
  const core = await import(path.resolve(__dirname, '../knowledge/claim-registry/index.mjs'));
  const normalRegistry = core.createValidatedClaimRegistry(rawRegistry, { asOf: rawRegistry.evaluationAsOf });
  const reversedRegistry = core.createValidatedClaimRegistry({ claims: clone(rawRegistry.claims).reverse() }, { asOf: rawRegistry.evaluationAsOf });
  const normalOpportunity = evaluator.createStrongCoolingOpportunity();
  const reversedOpportunity = clone(normalOpportunity);
  reversedOpportunity.candidateProductFamilyIds.reverse();
  reversedOpportunity.requirements.reverse();
  const normal = domain.buildPursuitDossier(normalOpportunity, domain.evaluateSpecificationFit(normalOpportunity, normalRegistry, verticalPack), normalRegistry, verticalPack);
  const reversed = domain.buildPursuitDossier(reversedOpportunity, domain.evaluateSpecificationFit(reversedOpportunity, reversedRegistry, verticalPack), reversedRegistry, verticalPack);
  assert.equal(domain.renderPursuitDossierJson(normal), domain.renderPursuitDossierJson(reversed));
  assert.equal(domain.renderPursuitDossierMarkdown(normal), domain.renderPursuitDossierMarkdown(reversed));

  const conflictOpportunity = evaluator.createStrongCoolingOpportunity();
  conflictOpportunity.candidateProductFamilyIds = ['fire_detection'];
  conflictOpportunity.requirements = [{
    requirementId: 'req_required_protocols',
    category: 'fire_detection',
    key: 'required_protocols',
    productFamilyIds: ['fire_detection'],
    priority: 'HARD',
    valueState: 'KNOWN',
    operator: 'CONTAINS_ALL',
    value: { type: 'STRING_SET', key: 'required_protocols', value: ['BACNET_IP'] },
    evidenceClaimRefs: ['req_bacnet']
  }];
  const normalConflictEvaluation = domain.evaluateSpecificationFit(conflictOpportunity, normalRegistry, verticalPack);
  const reversedConflictEvaluation = domain.evaluateSpecificationFit(conflictOpportunity, reversedRegistry, verticalPack);
  assert.deepEqual(normalConflictEvaluation, reversedConflictEvaluation);
  const normalConflict = domain.buildPursuitDossier(conflictOpportunity, normalConflictEvaluation, normalRegistry, verticalPack);
  const reversedConflict = domain.buildPursuitDossier(conflictOpportunity, reversedConflictEvaluation, reversedRegistry, verticalPack);
  assert.equal(domain.renderPursuitDossierJson(normalConflict), domain.renderPursuitDossierJson(reversedConflict));
});

test('facts, assumptions, conflicts, gaps, allowed claims, and blocked claims stay separate', async () => {
  const { evaluator, domain, registry } = await setup();
  const assumptionOpportunity = evaluator.createStrongCoolingOpportunity();
  assumptionOpportunity.requirements[0] = {
    requirementId: 'req_thermal_capacity',
    category: 'cooling',
    key: 'thermal_capacity_min',
    productFamilyIds: ['oil_free_compressor'],
    priority: 'HARD',
    valueState: 'KNOWN',
    operator: 'GTE',
    value: { type: 'QUANTITY', key: 'thermal_capacity_min', value: 1, unit: 'MW_th', quantityKind: 'thermal_power' },
    evidenceClaimRefs: ['assumption_cooling_load']
  };
  const assumptionEvaluation = domain.evaluateSpecificationFit(assumptionOpportunity, registry, verticalPack);
  const assumptionDossier = domain.buildPursuitDossier(assumptionOpportunity, assumptionEvaluation, registry, verticalPack);
  assert.equal(assumptionDossier.assumptions.length, 1);
  assert.equal(assumptionDossier.assumptions[0].usedForFit, false);
  assert.ok(assumptionDossier.blockedClaims.some((claim) => claim.claimId === registry.byKey.get('assumption_cooling_load').claimId));
  assert.ok(!assumptionDossier.customerUsableClaims.some((claim) => claim.claimId === registry.byKey.get('assumption_cooling_load').claimId));

  const conflictOpportunity = evaluator.createStrongCoolingOpportunity();
  conflictOpportunity.candidateProductFamilyIds = ['fire_detection'];
  conflictOpportunity.requirements[0] = {
    requirementId: 'req_required_protocols',
    category: 'fire_detection',
    key: 'required_protocols',
    productFamilyIds: ['fire_detection'],
    priority: 'HARD',
    valueState: 'KNOWN',
    operator: 'CONTAINS_ALL',
    value: { type: 'STRING_SET', key: 'required_protocols', value: ['BACNET_IP'] },
    evidenceClaimRefs: ['req_bacnet']
  };
  const conflictEvaluation = domain.evaluateSpecificationFit(conflictOpportunity, registry, verticalPack);
  const conflictDossier = domain.buildPursuitDossier(conflictOpportunity, conflictEvaluation, registry, verticalPack);
  assert.equal(conflictEvaluation.results[0].result, 'INSUFFICIENT_EVIDENCE');
  assert.equal(conflictDossier.conflictingClaims.length, 2);
  assert.ok(conflictDossier.blockedClaims.length >= 2);
});

test('missing requirements create bounded technical questions rather than outreach copy', async () => {
  const { evaluator, domain, registry } = await setup();
  const opportunity = evaluator.createStrongCoolingOpportunity();
  opportunity.requirements[0].valueState = 'UNKNOWN';
  opportunity.requirements[0].evidenceClaimRefs = [];
  const evaluation = domain.evaluateSpecificationFit(opportunity, registry, verticalPack);
  const dossier = domain.buildPursuitDossier(opportunity, evaluation, registry, verticalPack);
  assert.equal(dossier.missingTechnicalRequirements[0].requirementId, 'req_cooling_architecture');
  assert.equal(dossier.recommendedTechnicalQuestions[0].actionCode, 'REQUEST_COOLING_BASIS_OF_DESIGN');
  assert.match(dossier.recommendedTechnicalQuestions[0].requestedArtifact, /cooling_basis_of_design/);
  assert.doesNotMatch(JSON.stringify(dossier.recommendedTechnicalQuestions), /email|outreach|contact/i);
});

test('dossier rendering refuses nested secrets before emitting JSON or Markdown', async () => {
  const { evaluator, domain, registry } = await setup();
  const opportunity = evaluator.createStrongCoolingOpportunity();
  const dossier = domain.buildPursuitDossier(opportunity, domain.evaluateSpecificationFit(opportunity, registry, verticalPack), registry, verticalPack);
  dossier.reviewerNextAction.nested = { note: 'Bearer abcdefghijklmnopqrstuvwxyz123456' };
  assert.throws(() => domain.renderPursuitDossierJson(dossier), (error) => error.code === 'SECRET_SHAPED_VALUE');
  assert.throws(() => domain.renderPursuitDossierMarkdown(dossier), (error) => error.code === 'SECRET_SHAPED_VALUE');
});

test('dossier Markdown escapes evidence fields instead of interpreting injected links or HTML', async () => {
  const { evaluator, domain, registry } = await setup();
  const opportunity = evaluator.createStrongCoolingOpportunity();
  const dossier = domain.buildPursuitDossier(opportunity, domain.evaluateSpecificationFit(opportunity, registry, verticalPack), registry, verticalPack);
  dossier.customerUsableClaims[0].statement = '**claim** [follow](javascript:alert(1))';
  dossier.customerUsableClaims[0].sourceTitle = '<img src=x> [source]';
  dossier.customerUsableClaims[0].sourceUrl = 'https://synthetic.example/[unsafe](javascript:alert(1))';
  dossier.customerUsableClaims[0].directQuote = '`instruction` ![pixel](javascript:alert(1))';
  const markdown = domain.renderPursuitDossierMarkdown(dossier);
  assert.match(markdown, /\\\*\\\*claim\\\*\\\*/);
  assert.match(markdown, /&lt;img src=x&gt; \\\[source\\\]/);
  assert.ok(markdown.includes('\\[follow\\]\\(javascript:alert\\(1\\)\\)'));
  assert.ok(markdown.includes('\\!\\[pixel\\]\\(javascript:alert\\(1\\)\\)'));
  assert.doesNotMatch(markdown, /\]\(javascript:/);
  assert.doesNotMatch(markdown, /<img/i);
});
