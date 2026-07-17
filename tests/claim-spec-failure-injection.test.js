const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const rawRegistry = require('../knowledge/claim-registry/synthetic/datacenter-claims-v1.json');
const verticalPack = require('../verticals/datacenter/vertical-pack-v0.json');
const aliases = require('../verticals/datacenter/technical-aliases-v0.json');
const fixture = require('../eval/fixtures/spec-fit/datacenter-v0-scenarios.json');
const inventory = require('../knowledge/claim-registry/managed-profile-legacy-inventory.json');
const clone = (value) => structuredClone(value);

test('typed failures cover loading, normalization, identity, extraction, duplicate, fit, rendering, replay, audit, and evaluation output', async () => {
  const core = await import(path.resolve(__dirname, '../knowledge/claim-registry/index.mjs'));
  const domain = await import(path.resolve(__dirname, '../verticals/datacenter/index.mjs'));
  const evaluator = await import(path.resolve(__dirname, '../eval/spec-fit-evaluator.mjs'));
  const repository = await import(path.resolve(__dirname, '../scripts/lib/repository-claim-registry.mjs'));
  const reports = await import(path.resolve(__dirname, '../scripts/lib/claim-spec-report-validation.mjs'));

  await assert.rejects(repository.readRepositoryJson('does-not-exist.json'), (error) => error.code === 'REPOSITORY_JSON_LOAD_FAILED');
  assert.throws(() => core.createValidatedClaimRegistry({ claims: [{}] }, { asOf: rawRegistry.evaluationAsOf }), (error) => error.code === 'INVALID_CLAIM_TYPE');

  const invalidStatement = clone(rawRegistry.claims[0]);
  invalidStatement.statement = '';
  assert.throws(() => core.createValidatedClaimRegistry({ claims: [invalidStatement] }, { asOf: rawRegistry.evaluationAsOf }), (error) => error.code === 'STATEMENT_REQUIRED');
  const forgedIdentity = clone(rawRegistry.claims[0]);
  forgedIdentity.claimId = 'clm_forged';
  assert.throws(() => core.createValidatedClaimRegistry({ claims: [forgedIdentity] }, { asOf: rawRegistry.evaluationAsOf }), (error) => error.code === 'CLAIM_ID_MISMATCH');
  assert.throws(() => core.auditLegacyInventory({}), (error) => error.code === 'INVALID_LEGACY_INVENTORY');
  assert.throws(() => core.createValidatedClaimRegistry({ claims: [rawRegistry.claims[0], clone(rawRegistry.claims[0])] }, { asOf: rawRegistry.evaluationAsOf }), (error) => error.code === 'DUPLICATE_CLAIM_ID');

  const registry = core.createValidatedClaimRegistry(rawRegistry, { asOf: rawRegistry.evaluationAsOf });
  assert.throws(() => domain.evaluateSpecificationFit({ synthetic: true }, registry, verticalPack), (error) => error instanceof core.ClaimValidationError);

  const suite = evaluator.evaluateSpecFitSuite({ fixture, rawRegistry, verticalPack, aliases, inventory });
  assert.deepEqual(suite.scenarioResults.find((scenario) => scenario.id === 'incompatible_unit').observed.reasonCodes, ['UNIT_INCOMPATIBLE']);
  const unsafeDossier = JSON.parse(suite.fixtureDossier.json);
  unsafeDossier.nested = { value: 'Bearer abcdefghijklmnopqrstuvwxyz123456' };
  assert.throws(() => domain.renderPursuitDossierJson(unsafeDossier), (error) => error.code === 'SECRET_SHAPED_VALUE');

  const brokenFixture = clone(fixture);
  brokenFixture.scenarios.pop();
  assert.throws(() => evaluator.evaluateSpecFitSuite({ fixture: brokenFixture, rawRegistry, verticalPack, aliases, inventory }), (error) => error.code === 'SPEC_FIT_FIXTURE_INVENTORY_INVALID');
  assert.throws(() => reports.validateClaimAuditReport({ documentStatus: 'PASS', productionReady: false }), (error) => error.code === 'CLAIM_AUDIT_REPORT_INVALID');
  assert.throws(() => reports.validateSpecFitEvaluationReport({ documentStatus: 'PASS', productionReady: false }), (error) => error.code === 'SPEC_FIT_EVALUATION_REPORT_INVALID');
});
