import {
  ClaimValidationError,
  canonicalStringify
} from '../../knowledge/claim-registry/index.mjs';
import {
  materializeSpecFitScenario
} from '../../eval/spec-fit-evaluator.mjs';
import {
  renderPursuitDossierJson,
  renderPursuitDossierMarkdown
} from '../../verticals/datacenter/index.mjs';
import {
  loadEvidenceDomainInputs,
  readRepositoryJson
} from '../../scripts/lib/repository-claim-registry.mjs';
import { buildProjectSignalTimeline } from './timeline.mjs';
import { buildPursuitWorkbenchViewModel } from './view-model.mjs';

export const WORKBENCH_SCENARIO_CATALOG_PATH = 'pursuit-workbench/fixtures/datacenter-workbench-v0.json';
const EXPECTED_DOSSIER_JSON_PATH = 'eval/fixtures/spec-fit/expected/pursuit-dossier-v0.json';
const EXPECTED_DOSSIER_MARKDOWN_PATH = 'eval/fixtures/spec-fit/expected/pursuit-dossier-v0.md';

function compareAscii(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function assertWorkbenchScenarioCatalog(catalog, canonicalFixture) {
  if (!catalog
    || catalog.schemaVersion !== 'datacenter-pursuit-workbench-scenarios-v0'
    || catalog.boundary !== 'NOT_PRODUCTION_EVIDENCE'
    || catalog.productionReady !== false
    || catalog.productionReviewerWorkflowReady !== false
    || catalog.issue165Status !== 'HOLD'
    || catalog.synthetic !== true
    || catalog.evaluationAsOf !== canonicalFixture?.evaluationAsOf
    || !Array.isArray(catalog.scenarioOrder)
    || !Array.isArray(catalog.scenarios)
    || catalog.scenarioOrder.length < 8
    || catalog.scenarioOrder.length !== catalog.scenarios.length) {
    throw new ClaimValidationError('WORKBENCH_SCENARIO_CATALOG_INVALID', '$.catalog');
  }
  const canonicalById = new Map(canonicalFixture.scenarios.map((scenario) => [scenario.id, scenario]));
  const ids = catalog.scenarios.map((scenario) => scenario?.id);
  if (new Set(ids).size !== ids.length || new Set(catalog.scenarioOrder).size !== catalog.scenarioOrder.length
    || canonicalStringify([...ids].sort(compareAscii)) !== canonicalStringify([...catalog.scenarioOrder].sort(compareAscii))) {
    throw new ClaimValidationError('WORKBENCH_SCENARIO_CATALOG_DUPLICATE', '$.catalog');
  }
  for (const [index, scenario] of catalog.scenarios.entries()) {
    if (!scenario
      || typeof scenario.id !== 'string'
      || !/^[a-z0-9_]{1,64}$/.test(scenario.id)
      || typeof scenario.title !== 'string'
      || !scenario.title.trim()
      || scenario.title.length > 160
      || typeof scenario.description !== 'string'
      || !scenario.description.trim()
      || scenario.description.length > 500
      || !Array.isArray(scenario.requiredTimelineEventTypes)
      || scenario.requiredTimelineEventTypes.length === 0
      || new Set(scenario.requiredTimelineEventTypes).size !== scenario.requiredTimelineEventTypes.length
      || canonicalById.get(scenario.id)?.kind !== 'FIT') {
      throw new ClaimValidationError('WORKBENCH_SCENARIO_INVALID', `$.catalog.scenarios[${index}]`);
    }
  }
  return true;
}

export async function loadWorkbenchScenarioCatalog() {
  return readRepositoryJson(WORKBENCH_SCENARIO_CATALOG_PATH);
}

export async function listPursuitWorkbenchScenarios({ inputs, catalog } = {}) {
  const resolvedInputs = inputs || await loadEvidenceDomainInputs();
  const resolvedCatalog = catalog || await loadWorkbenchScenarioCatalog();
  assertWorkbenchScenarioCatalog(resolvedCatalog, resolvedInputs.fixture);
  const byId = new Map(resolvedCatalog.scenarios.map((scenario) => [scenario.id, scenario]));
  return resolvedCatalog.scenarioOrder.map((id) => {
    const scenario = byId.get(id);
    return { id: scenario.id, title: scenario.title, description: scenario.description };
  });
}

export async function materializePursuitWorkbenchScenario(scenarioId, { inputs, catalog, expectedDossierJson, expectedDossierMarkdown } = {}) {
  if (typeof scenarioId !== 'string' || !/^[a-z0-9_]{1,64}$/.test(scenarioId)) {
    throw new ClaimValidationError('WORKBENCH_SCENARIO_ID_INVALID', '$.scenarioId');
  }
  const resolvedInputs = inputs || await loadEvidenceDomainInputs();
  const resolvedCatalog = catalog || await loadWorkbenchScenarioCatalog();
  assertWorkbenchScenarioCatalog(resolvedCatalog, resolvedInputs.fixture);
  const scenario = resolvedCatalog.scenarios.find((item) => item.id === scenarioId);
  if (!scenario) throw new ClaimValidationError('WORKBENCH_SCENARIO_NOT_FOUND', '$.scenarioId');
  const materialized = materializeSpecFitScenario({
    scenarioId,
    fixture: resolvedInputs.fixture,
    rawRegistry: resolvedInputs.rawRegistry,
    verticalPack: resolvedInputs.verticalPack
  });
  if (scenarioId === 'strong_verified_cooling_fit') {
    const expectedJson = expectedDossierJson ?? await readRepositoryJson(EXPECTED_DOSSIER_JSON_PATH).catch(async () => {
      const { readFile } = await import('node:fs/promises');
      const { resolve } = await import('node:path');
      const { REPO_ROOT } = await import('../../scripts/lib/repository-claim-registry.mjs');
      return readFile(resolve(REPO_ROOT, EXPECTED_DOSSIER_JSON_PATH), 'utf8');
    });
    const expectedMarkdown = expectedDossierMarkdown ?? await (async () => {
      const { readFile } = await import('node:fs/promises');
      const { resolve } = await import('node:path');
      const { REPO_ROOT } = await import('../../scripts/lib/repository-claim-registry.mjs');
      return readFile(resolve(REPO_ROOT, EXPECTED_DOSSIER_MARKDOWN_PATH), 'utf8');
    })();
    const jsonText = typeof expectedJson === 'string' ? expectedJson : `${JSON.stringify(expectedJson, null, 2)}\n`;
    if (renderPursuitDossierJson(materialized.dossier) !== jsonText
      || renderPursuitDossierMarkdown(materialized.dossier) !== expectedMarkdown) {
      throw new ClaimValidationError('WORKBENCH_EXPECTED_DOSSIER_DRIFT', '$.dossier');
    }
  }
  const timelineResult = buildProjectSignalTimeline(materialized.opportunity, materialized.evaluation, materialized.registry, resolvedInputs.verticalPack);
  const actualTypes = new Set(timelineResult.timeline.events.map((event) => event.eventType));
  if (scenario.requiredTimelineEventTypes.some((type) => !actualTypes.has(type))) {
    throw new ClaimValidationError('WORKBENCH_TIMELINE_EXPECTATION_DRIFT', '$.timeline.events');
  }
  const scopedRecognitionEvents = timelineResult.timeline.events.filter((event) => ['CLAIM_CONFLICT_RECOGNIZED', 'CLAIM_RETRACTION_RECOGNIZED'].includes(event.eventType));
  if (scopedRecognitionEvents.some((event) => event.claimIds.length === 0 || event.requirementIds.length === 0 || event.productFamilyIds.length === 0)) {
    throw new ClaimValidationError('WORKBENCH_TIMELINE_SCOPE_DRIFT', '$.timeline.events');
  }
  return buildPursuitWorkbenchViewModel({
    scenario,
    opportunity: materialized.opportunity,
    evaluation: materialized.evaluation,
    dossier: materialized.dossier,
    suppliedDossierHashes: materialized.dossierHashes,
    timeline: timelineResult.timeline,
    timelineSha256: timelineResult.timelineSha256,
    registry: materialized.registry,
    verticalPack: resolvedInputs.verticalPack,
    productFamilyMap: resolvedInputs.productFamilyMap
  });
}
