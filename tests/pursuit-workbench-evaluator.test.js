const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { loadWorkbenchDomain } = require('./helpers/pursuit-workbench');

const REPO_ROOT = path.resolve(__dirname, '..');

test('evaluation meets every predeclared synthetic accuracy, leakage, and determinism threshold', async () => {
  const evaluator = await import('../eval/pursuit-workbench-evaluator.mjs');
  const report = await evaluator.evaluatePursuitWorkbench({ repeat: 2 });
  assert.equal(report.documentStatus, 'PURSUIT_WORKBENCH_EVALUATION_PASS');
  assert.equal(report.summary.scenarioCount, 12);
  assert.equal(report.summary.passed, 12);
  assert.equal(report.summary.failed, 0);
  for (const [metric, expected] of Object.entries(evaluator.PURSUIT_WORKBENCH_THRESHOLDS)) assert.equal(report.summary[metric], expected, metric);
  assert.equal(report.summary.accessibilityContractBasisPoints, 10_000);
  const supportedDispositions = new Set(report.scenarioResults.flatMap((item) => item.supportedDispositions));
  assert.deepEqual([...supportedDispositions].sort(), [...(await import('../pursuit-workbench/domain/review-packet.mjs')).REVIEW_DISPOSITIONS].sort());
  assert.ok(report.scenarioResults.every((item) => item.pass));
  assert.ok(report.scenarioResults.every((item) => item.bytes.timeline < report.limits.timelineBytes));
  assert.ok(report.scenarioResults.every((item) => item.bytes.viewModel < report.limits.viewModelBytes));
  assert.ok(report.scenarioResults.every((item) => item.bytes.html < report.limits.htmlBytes));
  assert.equal(report.productionReady, false);
  assert.equal(report.productionReviewerWorkflowReady, false);
  assert.equal(report.issue165Status, 'HOLD');
});

test('evaluation report bytes are identical across independent repeat runs', async () => {
  const evaluator = await import('../eval/pursuit-workbench-evaluator.mjs');
  const first = await evaluator.evaluatePursuitWorkbench({ repeat: 2 });
  const second = await evaluator.evaluatePursuitWorkbench({ repeat: 2 });
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});

test('evaluation CLI is deterministic and rejects unknown arguments without diagnostics leakage', () => {
  const command = ['scripts/evaluate-pursuit-workbench.mjs', '--json', '--repeat', '2'];
  const first = spawnSync(process.execPath, command, { cwd: REPO_ROOT, encoding: 'utf8' });
  const second = spawnSync(process.execPath, command, { cwd: REPO_ROOT, encoding: 'utf8' });
  assert.equal(first.status, 0, first.stderr);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(first.stdout, second.stdout);
  assert.equal(JSON.parse(first.stdout).documentStatus, 'PURSUIT_WORKBENCH_EVALUATION_PASS');
  const invalid = spawnSync(process.execPath, ['scripts/evaluate-pursuit-workbench.mjs', '--unknown'], { cwd: REPO_ROOT, encoding: 'utf8' });
  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /failed safely/i);
  assert.doesNotMatch(invalid.stderr, /\/Users\/|node:internal|stack/i);
});

test('catalog duplication and controlled-clock drift are rejected', async () => {
  const { inputs, catalog, scenarios } = await loadWorkbenchDomain();
  const duplicate = structuredClone(catalog);
  duplicate.scenarios[1].id = duplicate.scenarios[0].id;
  assert.throws(() => scenarios.assertWorkbenchScenarioCatalog(duplicate, inputs.fixture), (error) => error.code === 'WORKBENCH_SCENARIO_CATALOG_DUPLICATE');
  const clockDrift = structuredClone(catalog);
  clockDrift.evaluationAsOf = '2026-06-02T00:00:00.000Z';
  assert.throws(() => scenarios.assertWorkbenchScenarioCatalog(clockDrift, inputs.fixture), (error) => error.code === 'WORKBENCH_SCENARIO_CATALOG_INVALID');
});

test('canonical expected-result and golden-dossier drift refuse display', async () => {
  const { inputs, catalog, scenarios } = await loadWorkbenchDomain();
  const evaluator = await import('../eval/spec-fit-evaluator.mjs');
  const fixture = structuredClone(inputs.fixture);
  fixture.scenarios.find((item) => item.id === 'strong_verified_cooling_fit').expected.outcome = 'NOT_FIT';
  assert.throws(() => evaluator.materializeSpecFitScenario({ scenarioId: 'strong_verified_cooling_fit', fixture, rawRegistry: inputs.rawRegistry, verticalPack: inputs.verticalPack }), (error) => error.code === 'SPEC_FIT_SCENARIO_DRIFT');
  await assert.rejects(scenarios.materializePursuitWorkbenchScenario('strong_verified_cooling_fit', {
    inputs, catalog, expectedDossierJson: '{}\n', expectedDossierMarkdown: '# forged\n'
  }), (error) => error.code === 'WORKBENCH_EXPECTED_DOSSIER_DRIFT');
});
