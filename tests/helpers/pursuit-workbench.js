async function loadWorkbenchDomain(scenarioId = 'strong_verified_cooling_fit') {
  const [loader, evaluator, timeline, scenarios] = await Promise.all([
    import('../../scripts/lib/repository-claim-registry.mjs'),
    import('../../eval/spec-fit-evaluator.mjs'),
    import('../../pursuit-workbench/domain/timeline.mjs'),
    import('../../pursuit-workbench/domain/scenarios.mjs')
  ]);
  const inputs = await loader.loadEvidenceDomainInputs();
  const catalog = await scenarios.loadWorkbenchScenarioCatalog();
  const materialized = evaluator.materializeSpecFitScenario({
    scenarioId,
    fixture: inputs.fixture,
    rawRegistry: inputs.rawRegistry,
    verticalPack: inputs.verticalPack
  });
  const timelineResult = timeline.buildProjectSignalTimeline(materialized.opportunity, materialized.evaluation, materialized.registry, inputs.verticalPack);
  return { inputs, catalog, materialized, timelineResult, timeline, scenarios };
}

async function loadWorkbenchViewModel(scenarioId = 'strong_verified_cooling_fit') {
  const scenarios = await import('../../pursuit-workbench/domain/scenarios.mjs');
  return scenarios.materializePursuitWorkbenchScenario(scenarioId);
}

module.exports = { loadWorkbenchDomain, loadWorkbenchViewModel };
