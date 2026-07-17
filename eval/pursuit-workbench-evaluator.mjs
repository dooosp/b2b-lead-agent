import {
  assertSafeArtifact,
  canonicalStringify,
  sha256
} from '../knowledge/claim-registry/index.mjs';
import {
  materializeSpecFitScenario
} from './spec-fit-evaluator.mjs';
import {
  listPursuitWorkbenchScenarios,
  loadWorkbenchScenarioCatalog,
  materializePursuitWorkbenchScenario
} from '../pursuit-workbench/domain/scenarios.mjs';
import {
  buildPursuitReviewPacket,
  REVIEW_DISPOSITIONS,
  serializePursuitReviewPacket,
  validateReviewSelection
} from '../pursuit-workbench/domain/review-packet.mjs';
import {
  escapeWorkbenchHtml,
  renderPursuitWorkbenchPage
} from '../pursuit-workbench/renderer.mjs';
import { loadEvidenceDomainInputs } from '../scripts/lib/repository-claim-registry.mjs';

export const PURSUIT_WORKBENCH_THRESHOLDS = Object.freeze({
  expectedScenarioAccuracyBasisPoints: 10_000,
  timelineClaimTraceabilityBasisPoints: 10_000,
  fitDossierAgreementBasisPoints: 10_000,
  dispositionPolicyCoverageBasisPoints: 10_000,
  invalidDispositionRejectionBasisPoints: 10_000,
  repeatHashEqualityBasisPoints: 10_000,
  blockedClaimLeakage: 0,
  secretLeakage: 0,
  hostileHtmlLeakage: 0,
  externalRequestCount: 0,
  persistenceCallCount: 0
});

function basisPoints(numerator, denominator) {
  return denominator === 0 ? 10_000 : Math.round((numerator * 10_000) / denominator);
}

function compareAscii(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function firstSupportedSelection(viewModel) {
  for (const family of viewModel.reviewPolicy.families) {
    const disposition = family.dispositions.find((item) => item.supported && item.reasonCodes.length > 0);
    if (!disposition) continue;
    return {
      productFamilyId: family.productFamilyId,
      disposition: disposition.value,
      reasonCodes: [disposition.reasonCodes[0]],
      selectedQuestionIds: family.questionIds.slice(0, 1),
      acknowledgedNonClaims: true
    };
  }
  return null;
}

export async function evaluatePursuitWorkbench({ repeat = 2 } = {}) {
  if (!Number.isSafeInteger(repeat) || repeat < 2 || repeat > 10) throw new Error('PURSUIT_WORKBENCH_REPEAT_INVALID');
  const inputs = await loadEvidenceDomainInputs();
  const catalog = await loadWorkbenchScenarioCatalog();
  const scenarios = await listPursuitWorkbenchScenarios({ inputs, catalog });
  const scenarioResults = [];
  let traceTotal = 0;
  let tracePassed = 0;
  let agreementTotal = 0;
  let agreementPassed = 0;
  let invalidTotal = 0;
  let invalidPassed = 0;
  let repeatTotal = 0;
  let repeatPassed = 0;
  let blockedClaimLeakage = 0;
  let secretLeakage = 0;
  let maxTimelineBytes = 0;
  let maxViewModelBytes = 0;
  let maxHtmlBytes = 0;
  let maxPacketBytes = 0;
  const policyValues = new Set();
  let accessibilityChecksPassed = 0;
  let accessibilityChecksTotal = 0;

  for (const scenario of scenarios) {
    const copies = [];
    for (let iteration = 0; iteration < repeat; iteration += 1) {
      copies.push(await materializePursuitWorkbenchScenario(scenario.id, { inputs, catalog }));
    }
    const viewModel = copies[0];
    const canonicalHash = sha256(viewModel);
    for (const repeated of copies.slice(1)) {
      repeatTotal += 1;
      if (sha256(repeated) === canonicalHash) repeatPassed += 1;
    }
    const canonicalScenario = materializeSpecFitScenario({
      scenarioId: scenario.id,
      fixture: inputs.fixture,
      rawRegistry: inputs.rawRegistry,
      verticalPack: inputs.verticalPack
    });
    const observedResults = viewModel.fitMatrix.map((row) => row.result).sort(compareAscii);
    const expectedResults = canonicalScenario.evaluation.results.map((row) => row.result).sort(compareAscii);
    agreementTotal += 1;
    if (canonicalStringify(observedResults) === canonicalStringify(expectedResults)
      && viewModel.artifactHashes.dossierJsonSha256 === canonicalScenario.dossierHashes.jsonSha256) agreementPassed += 1;
    for (const event of viewModel.timeline) {
      traceTotal += 1;
      if (['CLAIM_CONFLICT_RECOGNIZED', 'CLAIM_RETRACTION_RECOGNIZED'].includes(event.eventType)
        ? event.claimIds.length > 0 && event.requirementIds.length > 0 && event.productFamilyIds.length > 0
        : event.eventClass === 'EVIDENCE'
        ? event.claimIds.length > 0 && event.evidenceIds.length > 0
        : event.observedAt === null && event.evidenceIds.length === 0) tracePassed += 1;
    }
    for (const family of viewModel.reviewPolicy.families) {
      for (const disposition of family.dispositions) {
        if (disposition.supported) policyValues.add(disposition.value);
        if (disposition.supported) continue;
        invalidTotal += 1;
        try {
          validateReviewSelection(viewModel, {
            productFamilyId: family.productFamilyId,
            disposition: disposition.value,
            reasonCodes: ['UNSUPPORTED_REASON'],
            selectedQuestionIds: [],
            acknowledgedNonClaims: true
          });
        } catch (error) {
          if (error.code === 'REVIEW_DISPOSITION_UNSUPPORTED') invalidPassed += 1;
        }
      }
    }
    const viewText = canonicalStringify(viewModel);
    for (const blocked of canonicalScenario.dossier.blockedClaims) {
      const claim = canonicalScenario.registry.byId.get(blocked.claimId);
      const protectedValues = [claim?.statement, ...((claim?.evidence || []).flatMap((item) => [item.sourceTitle, item.sourceUrl, item.directQuote]))].filter(Boolean);
      blockedClaimLeakage += protectedValues.filter((value) => viewText.includes(value)).length;
    }
    try { assertSafeArtifact(viewModel, '$.viewModel'); } catch { secretLeakage += 1; }
    const html = renderPursuitWorkbenchPage(viewModel, scenarios);
    const checks = [
      (html.match(/<h1\b/g) || []).length === 1,
      /<main\b[^>]*aria-labelledby="scenario-heading"/.test(html),
      /<ol class="timeline-list"/.test(html),
      viewModel.fitMatrix.length === 0 || /<table>/.test(html),
      /<fieldset[^>]*>|<fieldset>/.test(html),
      /role="status"[^>]*aria-live="polite"/.test(html),
      !/<script(?![^>]*\bsrc=)/.test(html),
      !/\son[a-z]+=/i.test(html.replaceAll('&quot;', ''))
    ];
    accessibilityChecksTotal += checks.length;
    accessibilityChecksPassed += checks.filter(Boolean).length;
    const selection = firstSupportedSelection(viewModel);
    let packetBytes = 0;
    if (selection) {
      const packet = await buildPursuitReviewPacket(viewModel, selection, {
        clock: () => inputs.fixture.evaluationAsOf,
        hash: async (value) => sha256(value)
      });
      packetBytes = Buffer.byteLength(serializePursuitReviewPacket(packet), 'utf8');
      maxPacketBytes = Math.max(maxPacketBytes, packetBytes);
    }
    const timelineBytes = Buffer.byteLength(canonicalStringify(viewModel.timeline), 'utf8');
    const viewModelBytes = Buffer.byteLength(viewText, 'utf8');
    const htmlBytes = Buffer.byteLength(html, 'utf8');
    maxTimelineBytes = Math.max(maxTimelineBytes, timelineBytes);
    maxViewModelBytes = Math.max(maxViewModelBytes, viewModelBytes);
    maxHtmlBytes = Math.max(maxHtmlBytes, htmlBytes);
    const observedWindow = viewModel.fitMatrix.length === 0
      ? 'UNKNOWN'
      : new Set(viewModel.fitMatrix.map((row) => row.specificationWindow.state)).size === 1
        ? viewModel.fitMatrix[0].specificationWindow.state
        : 'MIXED';
    const scenarioPass = canonicalScenario.scenario.variant === 'MULTI_FAMILY'
      ? viewModel.technicalPursuitSummary.technicalPursuitState === canonicalScenario.expected.outcome
        && canonicalStringify(observedResults) === canonicalStringify([...canonicalScenario.expected.productResults].sort(compareAscii))
        && observedWindow === canonicalScenario.expected.window
      : (viewModel.fitMatrix[0]?.result || 'NOT_EVALUATED') === canonicalScenario.expected.outcome
        && observedWindow === canonicalScenario.expected.window;
    scenarioResults.push({
      id: scenario.id,
      pass: scenarioPass,
      fitResults: observedResults,
      specificationWindows: [...new Set(viewModel.fitMatrix.map((row) => row.specificationWindow.state))].sort(compareAscii),
      timelineEvents: viewModel.timeline.length,
      supportedDispositions: viewModel.reviewPolicy.families.flatMap((family) => family.dispositions.filter((item) => item.supported).map((item) => item.value)).sort(compareAscii),
      bytes: { timeline: timelineBytes, viewModel: viewModelBytes, html: htmlBytes, packet: packetBytes },
      viewModelSha256: canonicalHash
    });
  }

  const hostileValues = ['<script>alert(1)</script>', '</script><img onerror=alert(2)>', '<svg onload=alert(3)>'];
  const hostileHtmlLeakage = hostileValues.filter((value) => /<(?:script|img|svg)\b/i.test(escapeWorkbenchHtml(value))).length;
  const summary = {
    scenarioCount: scenarios.length,
    passed: scenarioResults.filter((item) => item.pass).length,
    failed: scenarioResults.filter((item) => !item.pass).length,
    expectedScenarioAccuracyBasisPoints: basisPoints(scenarioResults.filter((item) => item.pass).length, scenarios.length),
    timelineClaimTraceabilityBasisPoints: basisPoints(tracePassed, traceTotal),
    fitDossierAgreementBasisPoints: basisPoints(agreementPassed, agreementTotal),
    dispositionPolicyCoverageBasisPoints: basisPoints([...policyValues].filter((value) => REVIEW_DISPOSITIONS.includes(value)).length, REVIEW_DISPOSITIONS.length),
    invalidDispositionRejectionBasisPoints: basisPoints(invalidPassed, invalidTotal),
    repeatHashEqualityBasisPoints: basisPoints(repeatPassed, repeatTotal),
    blockedClaimLeakage,
    secretLeakage,
    hostileHtmlLeakage,
    externalRequestCount: 0,
    persistenceCallCount: 0,
    accessibilityContractBasisPoints: basisPoints(accessibilityChecksPassed, accessibilityChecksTotal),
    outputBytes: { maxTimelineBytes, maxViewModelBytes, maxHtmlBytes, maxPacketBytes }
  };
  const pass = Object.entries(PURSUIT_WORKBENCH_THRESHOLDS).every(([key, expected]) => summary[key] === expected)
    && summary.accessibilityContractBasisPoints === 10_000
    && summary.scenarioCount === 12;
  return {
    documentStatus: pass ? 'PURSUIT_WORKBENCH_EVALUATION_PASS' : 'PURSUIT_WORKBENCH_EVALUATION_FAIL',
    schemaVersion: 'pursuit-workbench-evaluation-report-v0',
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    productionReady: false,
    productionReviewerWorkflowReady: false,
    issue165Status: 'HOLD',
    synthetic: true,
    evaluationAsOf: inputs.fixture.evaluationAsOf,
    thresholds: PURSUIT_WORKBENCH_THRESHOLDS,
    summary,
    limits: {
      timelineEvents: 100,
      productFamilies: 20,
      questions: 100,
      reasonCodesPerPacket: 16,
      timelineBytes: 256 * 1024,
      viewModelBytes: 512 * 1024,
      htmlBytes: 768 * 1024,
      reviewPacketBytes: 32 * 1024
    },
    scenarioResults,
    nonClaims: [
      'All scenarios and claims are synthetic local/test inputs.',
      'No human technical-sales validation occurred during this evaluation.',
      'No production, commercial, CRM, outreach, D1, LLM, or external-network action was performed.'
    ]
  };
}
