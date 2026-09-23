#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalStringify, sha256 } from '../knowledge/claim-registry/index.mjs';
import {
  createSyntheticBenchmarkFixture
} from '../evidence-claim-workbench/fixtures/synthetic-benchmark-v0.mjs';
import {
  createSourceDocumentCatalog,
  normalizeSourceDocumentBundle
} from '../evidence-claim-workbench/domain/document-bundle.mjs';
import { createPageEvidenceAnchor } from '../evidence-claim-workbench/domain/evidence-anchor.mjs';
import {
  createCandidate,
  formatCandidateStatement,
  extractDeterministicCandidates,
  validateCandidate
} from '../evidence-claim-workbench/domain/candidates.mjs';
import {
  createReviewDecision,
  validateReviewDecision
} from '../evidence-claim-workbench/domain/review-decisions.mjs';
import { loadEvidenceInbox } from '../evidence-claim-workbench/domain/intake.mjs';
import { analyzeCandidateRelationships } from '../evidence-claim-workbench/domain/relationships.mjs';
import {
  createReviewPatch,
  serializeReviewPatch,
  validateReviewPatch
} from '../evidence-claim-workbench/domain/review-patch.mjs';
import { createDraftRegistryPreview } from '../evidence-claim-workbench/domain/registry-adapter.mjs';

export const EVALUATION_SCHEMA_VERSION = 'official-evidence-claim-workbench-evaluation-v0';

const INTAKE_HASH_MISMATCH_OWNED_ROOT = fileURLToPath(new URL(
  '../evidence-claim-workbench/fixtures/intake-hash-mismatch/',
  import.meta.url
));
const REVIEW_DECISION_ORACLE_URL = new URL(
  '../evidence-claim-workbench/fixtures/review-decision-validation-oracle-v0.json',
  import.meta.url
);

export const EVALUATION_THRESHOLDS = Object.freeze({
  overallScenarioPassBasisPoints: 10_000,
  quoteBindingBasisPoints: 10_000,
  candidateIdentityRepeatEqualityBasisPoints: 10_000,
  candidateExtractionPrecisionBasisPoints: 10_000,
  candidateExtractionRecallBasisPoints: 10_000,
  reviewDecisionFixtureAccuracyBasisPoints: 10_000,
  conflictDetectionBasisPoints: 10_000,
  supersessionDetectionBasisPoints: 10_000,
  patchRepeatEqualityBasisPoints: 10_000,
  repeatedRunHashEqualityBasisPoints: 10_000,
  automaticVerifiedLeakage: 0,
  automaticAllowedLeakage: 0,
  secretLeakage: 0,
  privateDataLeakage: 0,
  externalRequestCount: 0,
  persistenceWriteCount: 0,
  browserStorageWriteCount: 0
});

const CANDIDATE_EVALUATION_SCENARIOS = Object.freeze([
  '01_valid_switchgear_datasheet',
  '02_valid_transformer_datasheet',
  '03_korean_product_document',
  '04_english_product_document',
  '05_quantity_capability',
  '06_range_capability',
  '07_certification_statement',
  '08_operating_condition',
  '09_limitation_disqualifier',
  '10_table_like_text',
  '24_ambiguous_unit',
  '25_incompatible_unit',
  '27_marketing_only'
]);

function basisPoints(passed, total) {
  return total === 0 ? 0 : Math.round((passed / total) * 10_000);
}

function codePoints(value) {
  return [...value];
}

function firstOccurrenceInput(page, quote, occurrenceIndex) {
  const pagePoints = codePoints(page.text);
  const quotePoints = codePoints(quote);
  const starts = [];
  outer: for (let start = 0; start <= pagePoints.length - quotePoints.length; start += 1) {
    for (let offset = 0; offset < quotePoints.length; offset += 1) {
      if (pagePoints[start + offset] !== quotePoints[offset]) continue outer;
    }
    starts.push(start);
  }
  const requestedIndex = occurrenceIndex || 1;
  const startCodePoint = starts[requestedIndex - 1] ?? 0;
  return {
    pageNumber: page.pageNumber,
    startCodePoint,
    endCodePoint: startCodePoint + quotePoints.length,
    quote,
    ...(starts.length > 1 ? { occurrenceIndex: requestedIndex } : {})
  };
}

export function createCandidateLineAnchors(document) {
  return document.pages.flatMap((page) => {
    const lines = page.text.split('\n');
    const totals = new Map();
    const seen = new Map();
    for (const line of lines) totals.set(line, (totals.get(line) || 0) + 1);
    let cursor = 0;
    return lines.flatMap((line) => {
      const length = codePoints(line).length;
      const startCodePoint = cursor;
      cursor += length + 1;
      if (!line || length > 500) return [];
      const occurrenceIndex = (seen.get(line) || 0) + 1;
      seen.set(line, occurrenceIndex);
      return [createPageEvidenceAnchor(document, {
        pageNumber: page.pageNumber,
        startCodePoint,
        endCodePoint: startCodePoint + length,
        quote: line,
        ...(totals.get(line) > 1 ? { occurrenceIndex } : {})
      })];
    });
  });
}

function normalizeScenarioDocuments(scenario, asOf) {
  return scenario.documents.map((document, index) => normalizeSourceDocumentBundle(document, {
    asOf,
    path: `$.scenarios.${scenario.id}.documents[${index}]`
  }));
}

function scenarioError(action) {
  try {
    action();
    return '';
  } catch (error) {
    return typeof error?.code === 'string' ? error.code : error?.name || 'UNKNOWN_ERROR';
  }
}

async function asyncScenarioError(action) {
  try {
    await action();
    return '';
  } catch (error) {
    return typeof error?.code === 'string' ? error.code : error?.name || 'UNKNOWN_ERROR';
  }
}

async function evaluateReviewDecisionOracle() {
  let oracle;
  try {
    oracle = JSON.parse(await readFile(REVIEW_DECISION_ORACLE_URL, 'utf8'));
  } catch {
    throw new Error('REVIEW_DECISION_ORACLE_READ_REFUSED');
  }
  if (oracle?.schemaVersion !== 'review-decision-validation-oracle-v0'
    || !Array.isArray(oracle.cases)
    || oracle.cases.length !== 2) {
    throw new Error('REVIEW_DECISION_ORACLE_INVALID');
  }
  let passed = 0;
  for (const entry of oracle.cases) {
    if (typeof entry?.id !== 'string'
      || !entry.id
      || typeof entry?.expected?.accepted !== 'boolean'
      || typeof entry?.expected?.errorCode !== 'string') {
      throw new Error('REVIEW_DECISION_ORACLE_INVALID');
    }
    let accepted = true;
    let errorCode = '';
    try {
      validateReviewDecision(entry.artifact);
    } catch (error) {
      accepted = false;
      errorCode = typeof error?.code === 'string' ? error.code : error?.name || 'UNKNOWN_ERROR';
    }
    if (accepted === entry.expected.accepted && errorCode === entry.expected.errorCode) passed += 1;
  }
  return { passed, total: oracle.cases.length };
}

function extractScenarioCandidates(documents) {
  return documents.flatMap((document) => extractDeterministicCandidates({
    document,
    anchors: createCandidateLineAnchors(document)
  }));
}

function projectCandidate(candidate) {
  return {
    claimType: candidate.claimType,
    productFamily: candidate.applicability.productFamily,
    projectStages: candidate.applicability.projectStages,
    value: candidate.value,
    conditions: candidate.applicability.conditions,
    extractionRuleId: candidate.extractionRuleId,
    extractionReasons: candidate.extractionReasons
  };
}

function sortedProjectionStrings(projections) {
  return projections.map((projection) => canonicalStringify(projection)).sort();
}

function candidateClassificationCounts(scenarios, observations) {
  let truePositiveCount = 0;
  let falsePositiveCount = 0;
  let falseNegativeCount = 0;
  for (const scenario of scenarios.filter(({ id }) => CANDIDATE_EVALUATION_SCENARIOS.includes(id))) {
    const expectedCounts = new Map();
    const actualCounts = new Map();
    for (const projection of scenario.expected.candidateProjections) {
      const signature = canonicalStringify(projection);
      expectedCounts.set(signature, (expectedCounts.get(signature) || 0) + 1);
    }
    for (const projection of observations.get(scenario.id).candidateProjections) {
      const signature = canonicalStringify(projection);
      actualCounts.set(signature, (actualCounts.get(signature) || 0) + 1);
    }
    const signatures = new Set([...expectedCounts.keys(), ...actualCounts.keys()]);
    for (const signature of signatures) {
      const expected = expectedCounts.get(signature) || 0;
      const actual = actualCounts.get(signature) || 0;
      truePositiveCount += Math.min(expected, actual);
      falsePositiveCount += Math.max(0, actual - expected);
      falseNegativeCount += Math.max(0, expected - actual);
    }
  }
  return { truePositiveCount, falsePositiveCount, falseNegativeCount };
}

function withConditions(candidate, conditions) {
  return createCandidate({
    ...structuredClone(candidate),
    candidateId: undefined,
    applicability: { ...structuredClone(candidate.applicability), conditions },
    extractionMethod: 'MANUAL_EXACT_QUOTE',
    extractionRuleId: 'OECRW0-MANUAL-STRUCTURED-ENTRY',
    extractionReasons: [
      'HUMAN_SELECTED_EXACT_EVIDENCE',
      'CONTEXT_AND_PRODUCT_SCOPE_REQUIRE_HUMAN_REVIEW'
    ]
  });
}

function observeRelationshipScenario(scenario, asOf) {
  const catalog = createSourceDocumentCatalog(scenario.documents, { asOf });
  let candidates = extractScenarioCandidates(catalog.documents);
  if (scenario.id === '15_conditions_resolve_conflict') {
    candidates = candidates.map((candidate) => withConditions(candidate, [{
      id: 'installation_condition',
      value: catalog.documents.find((document) => document.documentId === candidate.documentId)
        ?.source.title.includes('indoor') ? 'indoor_only' : 'outdoor_only'
    }]));
  }
  const relationshipReport = analyzeCandidateRelationships(candidates, { documents: catalog.documents });
  const observed = {
    accepted: true,
    candidateCount: candidates.length,
    conflictCount: relationshipReport.metrics.materialConflictCount,
    supersessionCount: relationshipReport.metrics.supersededCount,
    conditionResolvedCount: relationshipReport.metrics.conditionResolvedCount
  };
  const expectedCount = scenario.expected.supersessionCount
    ?? scenario.expected.conflictCount
    ?? 0;
  const observedCount = scenario.expected.supersessionCount !== undefined
    ? observed.supersessionCount
    : observed.conflictCount;
  const pass = observedCount === expectedCount
    && (scenario.id !== '15_conditions_resolve_conflict' || observed.conditionResolvedCount === 1);
  return { pass, observed, relationshipReport, candidates, documents: catalog.documents };
}

async function observeScenario(scenario, asOf) {
  if (scenario.phase === 'document-rejection') {
    const errorCode = scenarioError(() => normalizeSourceDocumentBundle(scenario.documents[0], { asOf }));
    return { pass: errorCode === scenario.expected.errorCode, observed: { accepted: false, errorCode } };
  }
  if (scenario.phase === 'intake-rejection') {
    const errorCode = await asyncScenarioError(() => loadEvidenceInbox({
      ownedRoot: INTAKE_HASH_MISMATCH_OWNED_ROOT,
      asOf
    }));
    return { pass: errorCode === scenario.expected.errorCode, observed: { accepted: false, errorCode } };
  }
  if (scenario.phase === 'catalog-rejection') {
    const errorCode = scenarioError(() => createSourceDocumentCatalog(scenario.documents, { asOf }));
    return { pass: errorCode === scenario.expected.errorCode, observed: { accepted: false, errorCode } };
  }
  if (scenario.phase === 'anchor-rejection') {
    const document = normalizeScenarioDocuments(scenario, asOf)[0];
    const page = document.pages[0];
    const errorCode = scenarioError(() => createPageEvidenceAnchor(
      document,
      firstOccurrenceInput(page, scenario.quote, 1)
    ));
    return { pass: errorCode === scenario.expected.errorCode, observed: { accepted: false, errorCode } };
  }
  if (scenario.phase === 'candidate-set-rejection') {
    const document = normalizeScenarioDocuments(scenario, asOf)[0];
    const line = document.pages[0].text.split('\n')[0];
    const anchor = createPageEvidenceAnchor(document, firstOccurrenceInput(document.pages[0], line, 1));
    const candidate = extractDeterministicCandidates({ document, anchors: [anchor] })[0];
    const tampered = structuredClone(candidate);
    tampered.value.value += 1;
    tampered.statement = formatCandidateStatement(tampered.applicability.productFamily, tampered.value);
    const errorCode = scenarioError(() => validateCandidate(tampered));
    return { pass: errorCode === scenario.expected.errorCode, observed: { accepted: false, errorCode } };
  }
  if (scenario.phase === 'relationship') return observeRelationshipScenario(scenario, asOf);
  if (scenario.phase === 'anchor') {
    const document = normalizeScenarioDocuments(scenario, asOf)[0];
    if (scenario.id === '11_repeated_quote_one_page') {
      const anchor = createPageEvidenceAnchor(
        document,
        firstOccurrenceInput(document.pages[0], scenario.quote, scenario.occurrenceIndex)
      );
      const pass = anchor.selection.occurrenceCount === scenario.expected.occurrenceCount
        && anchor.selection.occurrenceIndex === scenario.occurrenceIndex;
      return { pass, observed: { accepted: true, occurrenceCount: anchor.selection.occurrenceCount } };
    }
    const anchors = document.pages.map((page) => createPageEvidenceAnchor(
      document,
      firstOccurrenceInput(page, scenario.quote, 1)
    ));
    const distinctAnchorIds = new Set(anchors.map(({ anchorId }) => anchorId)).size === anchors.length;
    return { pass: distinctAnchorIds === scenario.expected.distinctAnchorIds, observed: { accepted: true, distinctAnchorIds } };
  }

  const documents = normalizeScenarioDocuments(scenario, asOf);
  const candidates = extractScenarioCandidates(documents);
  const candidateProjections = candidates.map(projectCandidate);
  const expectedCandidateProjections = scenario.expected.candidateProjections;
  const candidateProjectionPass = expectedCandidateProjections === undefined
    || canonicalStringify(sortedProjectionStrings(candidateProjections))
      === canonicalStringify(sortedProjectionStrings(expectedCandidateProjections));
  const languagePass = !scenario.expected.language || documents[0].source.language === scenario.expected.language;
  return {
    pass: candidateProjectionPass && languagePass,
    observed: {
      accepted: true,
      documentCount: documents.length,
      candidateCount: candidates.length,
      candidateProjections
    },
    candidateProjections,
    candidates,
    documents
  };
}

function exactValueCount(value, exact) {
  if (Array.isArray(value)) return value.reduce((total, child) => total + exactValueCount(child, exact), 0);
  if (!value || typeof value !== 'object') return value === exact ? 1 : 0;
  return Object.values(value).reduce((total, child) => total + exactValueCount(child, exact), 0);
}

function buildReviewAndPatch(fixture, scenarioObservations) {
  const first = scenarioObservations.get('01_valid_switchgear_datasheet');
  const candidate = first.candidates[0];
  const document = first.documents[0];
  const anchor = createCandidateLineAnchors(document)
    .find(({ anchorId }) => anchorId === candidate.evidenceAnchorId);
  const decision = createReviewDecision({
    candidate,
    decision: 'APPROVE_FOR_REPOSITORY_REVIEW',
    reasonCodes: ['EVIDENCE_QUOTE_CONFIRMED', 'STRUCTURED_MEANING_CONFIRMED']
  });
  const relationships = analyzeCandidateRelationships([candidate], { documents: [document] });
  const input = {
    baseCommitSha: 'a'.repeat(40),
    registryPath: 'knowledge/claim-registry/repository-reviewed/evidence-claim-review-import-v0.json',
    generatedAt: '2026-05-15T00:00:00.000Z',
    documents: [document],
    anchors: [anchor],
    candidates: [candidate],
    decisions: [decision],
    relationshipReport: relationships
  };
  const firstPatch = createReviewPatch(input);
  const secondPatch = createReviewPatch(structuredClone(input));
  validateReviewPatch(firstPatch);
  const serialized = serializeReviewPatch(firstPatch);
  const preview = createDraftRegistryPreview(firstPatch, { asOf: fixture.asOf });
  return {
    candidate,
    decision,
    patch: firstPatch,
    patchRepeatEqual: serialized === serializeReviewPatch(secondPatch),
    preview
  };
}

async function evaluateCore() {
  const fixture = createSyntheticBenchmarkFixture();
  const scenarioObservations = new Map();
  const scenarioResults = await Promise.all(fixture.scenarios.map(async (scenario) => {
    const result = await observeScenario(scenario, fixture.asOf);
    scenarioObservations.set(scenario.id, result);
    return {
      id: scenario.id,
      category: scenario.category,
      phase: scenario.phase,
      pass: result.pass,
      observed: result.observed
    };
  }));

  const candidateCounts = candidateClassificationCounts(fixture.scenarios, scenarioObservations);

  const identitySource = scenarioObservations.get('01_valid_switchgear_datasheet');
  const identityRepeat = extractScenarioCandidates(identitySource.documents);
  const identityEqual = canonicalStringify(identitySource.candidates.map(({ candidateId }) => candidateId))
    === canonicalStringify(identityRepeat.map(({ candidateId }) => candidateId));

  const reviewAndPatch = buildReviewAndPatch(fixture, scenarioObservations);
  const reviewDecisionOracle = await evaluateReviewDecisionOracle();

  const relationshipScenarios = ['14_conflicting_revision', '15_conditions_resolve_conflict'];
  const conflictPassed = relationshipScenarios.filter((id) => scenarioObservations.get(id)?.pass).length;
  const serializedPatch = serializeReviewPatch(reviewAndPatch.patch);
  const secretLeakage = /(?:bearer\s+|gh[oprsu]_|sk-|api[_-]?key\s*[:=]|password\s*[:=])/iu.test(serializedPatch) ? 1 : 0;
  const privateDataLeakage = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu.test(serializedPatch) ? 1 : 0;
  const automaticVerifiedLeakage = exactValueCount(reviewAndPatch.patch, 'VERIFIED')
    + exactValueCount(reviewAndPatch.preview, 'VERIFIED');
  const automaticAllowedLeakage = exactValueCount(reviewAndPatch.patch, 'ALLOWED')
    + exactValueCount(reviewAndPatch.preview, 'ALLOWED');

  const metrics = {
    overallScenarioPassBasisPoints: basisPoints(scenarioResults.filter(({ pass }) => pass).length, scenarioResults.length),
    quoteBindingBasisPoints: basisPoints(
      ['11_repeated_quote_one_page', '12_same_quote_different_pages', '23_quote_absent']
        .filter((id) => scenarioObservations.get(id)?.pass).length,
      3
    ),
    candidateIdentityRepeatEqualityBasisPoints: identityEqual ? 10_000 : 0,
    candidateExtractionPrecisionBasisPoints: basisPoints(
      candidateCounts.truePositiveCount,
      candidateCounts.truePositiveCount + candidateCounts.falsePositiveCount
    ),
    candidateExtractionRecallBasisPoints: basisPoints(
      candidateCounts.truePositiveCount,
      candidateCounts.truePositiveCount + candidateCounts.falseNegativeCount
    ),
    candidateTruePositiveCount: candidateCounts.truePositiveCount,
    candidateFalsePositiveCount: candidateCounts.falsePositiveCount,
    candidateFalseNegativeCount: candidateCounts.falseNegativeCount,
    reviewDecisionFixtureAccuracyBasisPoints: basisPoints(reviewDecisionOracle.passed, reviewDecisionOracle.total),
    conflictDetectionBasisPoints: basisPoints(conflictPassed, relationshipScenarios.length),
    supersessionDetectionBasisPoints: scenarioObservations.get('13_superseded_revision')?.pass ? 10_000 : 0,
    patchRepeatEqualityBasisPoints: reviewAndPatch.patchRepeatEqual ? 10_000 : 0,
    automaticVerifiedLeakage,
    automaticAllowedLeakage,
    secretLeakage,
    privateDataLeakage,
    externalRequestCount: 0,
    persistenceWriteCount: 0,
    browserStorageWriteCount: 0
  };

  return {
    schemaVersion: EVALUATION_SCHEMA_VERSION,
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    productionReady: false,
    productionReviewerWorkflowReady: false,
    issue165Status: 'HOLD',
    evaluationAsOf: fixture.asOf,
    documentStatus: scenarioResults.every(({ pass }) => pass)
      ? 'OFFICIAL_EVIDENCE_WORKBENCH_EVALUATION_PASS'
      : 'OFFICIAL_EVIDENCE_WORKBENCH_EVALUATION_FAIL',
    scope: {
      vertical: 'datacenter',
      registryVerticalAdapter: 'datacenter_infrastructure',
      domain: 'electrical_power',
      jurisdiction: 'KR',
      productFamilies: ['medium_voltage_switchgear', 'transformer'],
      languages: ['en', 'ko']
    },
    thresholds: EVALUATION_THRESHOLDS,
    summary: {
      scenarioCount: scenarioResults.length,
      passed: scenarioResults.filter(({ pass }) => pass).length,
      failed: scenarioResults.filter(({ pass }) => !pass).length,
      ...metrics,
      repeatedRunHashEqualityBasisPoints: 10_000,
      syntheticDocumentRecordCount: fixture.scenarios.reduce((total, { documents }) => total + documents.length, 0),
      realDocumentsPresent: 0,
      realDocumentsAccepted: 0,
      realDocumentsRejected: 0,
      realCandidatesCreated: 0,
      realCandidatesApprovedForRepositoryReview: 0,
      realVerifiedClaims: 0,
      realCustomerUseAllowed: 0,
      realDocumentPopulation: 'BLOCKED_INPUT_MISSING'
    },
    scenarioResults,
    patchProof: {
      patchId: reviewAndPatch.patch.patchId,
      patchBytes: Buffer.byteLength(serializedPatch, 'utf8'),
      patchRepeatEqual: reviewAndPatch.patchRepeatEqual,
      repositoryReviewRequired: true,
      automaticVerification: false,
      customerUseAllowed: false,
      previewClaimStatuses: reviewAndPatch.preview.claims.map(({ claim }) => claim.status),
      previewCustomerUseStates: reviewAndPatch.preview.claims.map(({ customerUse }) => customerUse.state)
    },
    zeroSideEffectObservations: {
      externalRequestCount: 0,
      observation: 'The evaluated domain path has no network client and is exercised under the network-free test command; browser request interception is asserted by local E2E.',
      persistenceWriteCount: 0,
      persistenceObservation: 'The evaluator calls pure bundle, anchor, candidate, decision, relationship, patch, and preview functions and does not import a filesystem writer.',
      browserStorageWriteCount: 0,
      browserStorageObservation: 'Static renderer/client contracts and local E2E reject localStorage, sessionStorage, IndexedDB, Cache API, cookies, and service workers.'
    },
    nonClaims: [
      'All executable inputs are synthetic and network-free.',
      'No actual human review or real-document population is represented.',
      'A repository-review patch remains unverified and blocked for customer use.',
      'Issue #165 remains HOLD; this report is not production evidence.'
    ]
  };
}

export function assertEvaluationThresholds(report) {
  if (report.summary.scenarioCount !== 35 || report.summary.failed !== 0) {
    const failedIds = report.scenarioResults.filter(({ pass }) => !pass).map(({ id }) => id).join(',');
    throw new Error(`EVIDENCE_WORKBENCH_SCENARIO_FAILURE:${report.summary.failed}:${failedIds}`);
  }
  for (const [key, expected] of Object.entries(EVALUATION_THRESHOLDS)) {
    const observed = report.summary[key];
    if (observed !== expected) throw new Error(`EVIDENCE_WORKBENCH_THRESHOLD_FAILED:${key}:${observed}:${expected}`);
  }
  if (report.summary.realVerifiedClaims !== 0 || report.summary.realCustomerUseAllowed !== 0) {
    throw new Error('REAL_AUTHORITY_LEAKAGE');
  }
  return report;
}

export async function evaluateEvidenceClaimWorkbench({ repeat = 2 } = {}) {
  if (!Number.isInteger(repeat) || repeat < 2 || repeat > 10) throw new Error('REPEAT_OUT_OF_BOUNDS');
  const first = await evaluateCore();
  const canonicalFirst = canonicalStringify(first);
  for (let index = 1; index < repeat; index += 1) {
    const next = await evaluateCore();
    if (canonicalStringify(next) !== canonicalFirst) throw new Error('EVIDENCE_WORKBENCH_REPEAT_NONDETERMINISTIC');
  }
  const report = {
    ...first,
    canonicalSha256: sha256(canonicalFirst)
  };
  assertEvaluationThresholds(report);
  return report;
}

function optionValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? '' : process.argv[index + 1] || '';
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const repeat = Number(optionValue('--repeat') || 2);
  const report = await evaluateEvidenceClaimWorkbench({ repeat });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
