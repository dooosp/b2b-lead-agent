const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

test('registry, fit, dossier, and serialized-size measurements stay within explicit bounds', async () => {
  const { measureClaimSpecPerformance } = await import(path.resolve(__dirname, '../scripts/measure-claim-spec-fit-performance.mjs'));
  const report = await measureClaimSpecPerformance();
  assert.deepEqual(report.measurements.map((item) => item.claimCount), [1, 10, 100, 1_000]);
  assert.equal(report.limits.maxClaims, 1_000);
  assert.equal(report.limits.maxProductFamiliesPerOpportunity, 20);
  assert.equal(report.limits.maxRequirementsPerOpportunity, 100);
  assert.ok(report.measurements.every((item) => item.serializedBytes < report.limits.maxRegistryBytes));
  assert.ok(report.measurements.every((item) => item.registryLoadMs < 5_000));
  assert.ok(report.measurements.every((item) => item.fitEvaluationMs < 5_000));
  assert.ok(report.measurements.every((item) => Number.isInteger(item.heapDeltaBytes) && item.heapDeltaBytes >= 0));
  assert.ok(report.dossier.dossierGenerationMs < 5_000);
  assert.ok(report.dossier.dossierBytes < report.limits.maxDossierBytes);
  assert.equal(report.productionReady, false);
  assert.equal(report.issue165Status, 'HOLD');
});
