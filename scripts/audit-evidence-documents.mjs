#!/usr/bin/env node

import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSyntheticBenchmarkFixture } from '../evidence-claim-workbench/fixtures/synthetic-benchmark-v0.mjs';
import {
  inspectSourceDocumentValidationStages,
  normalizeSourceDocumentBundle
} from '../evidence-claim-workbench/domain/document-bundle.mjs';
import { extractDeterministicCandidates } from '../evidence-claim-workbench/domain/candidates.mjs';
import { loadEvidenceInbox } from '../evidence-claim-workbench/domain/intake.mjs';
import {
  assertEvaluationThresholds,
  createCandidateLineAnchors,
  evaluateEvidenceClaimWorkbench
} from './evaluate-evidence-claim-workbench.mjs';

const REPO_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const REAL_INTAKE_AUDIT_AS_OF = '2026-07-17T23:59:59.999Z';

function increment(map, key, amount = 1) {
  map.set(key, (map.get(key) || 0) + amount);
}

function sortedObject(map) {
  return Object.fromEntries([...map.entries()].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0));
}

function stageSummary(counts) {
  return {
    passed: counts.get('PASSED') || 0,
    failed: counts.get('FAILED') || 0,
    notEvaluatedAfterEarlierRefusal: counts.get('NOT_EVALUATED') || 0
  };
}

async function auditOptionalRealDocuments(asOf) {
  const inboxRoot = resolve(REPO_ROOT, 'evidence-inbox');
  try {
    await access(inboxRoot);
  } catch {
    return {
      REAL_DOCUMENT_POPULATION: 'BLOCKED_INPUT_MISSING',
      REAL_DOCUMENTS_PRESENT: 0,
      REAL_DOCUMENTS_ACCEPTED: 0,
      REAL_DOCUMENTS_REJECTED: 0,
      REAL_CANDIDATES_CREATED: 0,
      REAL_CANDIDATES_APPROVED_FOR_REPOSITORY_REVIEW: 0,
      REAL_VERIFIED_CLAIMS: 0,
      REAL_CUSTOMER_USE_ALLOWED: 0,
      auditAsOf: REAL_INTAKE_AUDIT_AS_OF,
      rejectionCodes: []
    };
  }

  try {
    const intake = await loadEvidenceInbox({ ownedRoot: REPO_ROOT, inboxRoot, asOf });
    const realDocuments = intake.catalog.documents.filter(({ synthetic }) => synthetic === false);
    const realCandidates = [];
    const rejectionCodes = [];
    for (const document of realDocuments) {
      try {
        const anchors = createCandidateLineAnchors(document);
        if (anchors.length > 0) realCandidates.push(...extractDeterministicCandidates({ document, anchors }));
      } catch (error) {
        rejectionCodes.push(typeof error?.code === 'string' ? error.code : 'REAL_CANDIDATE_EXTRACTION_REFUSED');
      }
    }
    return {
      REAL_DOCUMENT_POPULATION: 'PRESENT_REVIEW_ONLY',
      REAL_DOCUMENTS_PRESENT: intake.catalog.documents.length,
      REAL_DOCUMENTS_ACCEPTED: realDocuments.length,
      REAL_DOCUMENTS_REJECTED: intake.catalog.documents.length - realDocuments.length,
      REAL_CANDIDATES_CREATED: realCandidates.length,
      REAL_CANDIDATES_APPROVED_FOR_REPOSITORY_REVIEW: 0,
      REAL_VERIFIED_CLAIMS: 0,
      REAL_CUSTOMER_USE_ALLOWED: 0,
      auditAsOf: REAL_INTAKE_AUDIT_AS_OF,
      rejectionCodes: [...new Set(rejectionCodes)].sort()
    };
  } catch (error) {
    return {
      REAL_DOCUMENT_POPULATION: 'PRESENT_REJECTED',
      REAL_DOCUMENTS_PRESENT: null,
      REAL_DOCUMENTS_ACCEPTED: 0,
      REAL_DOCUMENTS_REJECTED: null,
      REAL_CANDIDATES_CREATED: 0,
      REAL_CANDIDATES_APPROVED_FOR_REPOSITORY_REVIEW: 0,
      REAL_VERIFIED_CLAIMS: 0,
      REAL_CUSTOMER_USE_ALLOWED: 0,
      auditAsOf: REAL_INTAKE_AUDIT_AS_OF,
      intakeBatchPresent: true,
      countStatus: 'UNKNOWN_AFTER_FAIL_CLOSED_INTAKE_REFUSAL',
      rejectionCodes: [typeof error?.code === 'string' ? error.code : 'UNKNOWN_INTAKE_ERROR']
    };
  }
}

export async function auditEvidenceDocuments() {
  // Optional real intake is not inspected until the complete synthetic
  // evaluation has passed its precommitted thresholds.
  const evaluation = assertEvaluationThresholds(await evaluateEvidenceClaimWorkbench({ repeat: 2 }));
  const fixture = createSyntheticBenchmarkFixture();
  const byDocumentType = new Map();
  const byProductFamily = new Map();
  const byLanguage = new Map();
  const byJurisdiction = new Map();
  let normalizedDocumentRecords = 0;
  let rejectedDocumentRecords = 0;
  let pageCount = 0;
  let candidateCount = 0;
  let hashPassCount = 0;
  const revisionStageCounts = new Map();
  const sourceUrlStageCounts = new Map();
  let candidateExtractionFailures = 0;

  for (const scenario of fixture.scenarios) {
    for (const rawDocument of scenario.documents) {
      const stages = inspectSourceDocumentValidationStages(rawDocument, { asOf: fixture.asOf });
      increment(revisionStageCounts, stages.revision);
      increment(sourceUrlStageCounts, stages.sourceUrl);
      let document;
      try {
        document = normalizeSourceDocumentBundle(rawDocument, { asOf: fixture.asOf });
      } catch {
        rejectedDocumentRecords += 1;
        continue;
      }
      normalizedDocumentRecords += 1;
      pageCount += document.pages.length;
      hashPassCount += 1;
      increment(byDocumentType, document.source.documentType);
      increment(byLanguage, document.source.language);
      increment(byJurisdiction, document.source.jurisdiction);
      for (const family of document.source.productFamilies) increment(byProductFamily, family);
      try {
        const anchors = createCandidateLineAnchors(document);
        if (anchors.length > 0) candidateCount += extractDeterministicCandidates({ document, anchors }).length;
      } catch {
        candidateExtractionFailures += 1;
      }
    }
  }

  const conflictCount = evaluation.scenarioResults
    .find(({ id }) => id === '14_conflicting_revision')?.observed.conflictCount || 0;
  const supersededCount = evaluation.scenarioResults
    .find(({ id }) => id === '13_superseded_revision')?.observed.supersessionCount || 0;
  const quoteBindingFailures = evaluation.scenarioResults
    .filter(({ phase, pass }) => phase.includes('anchor') && !pass).length;
  const unsafeFieldFailures = evaluation.scenarioResults
    .filter(({ id, pass }) => ['28_secret_shaped_text', '29_personal_information_shaped_text'].includes(id) && pass).length;
  const pageTextMismatchRefused = evaluation.scenarioResults
    .filter(({ id, pass, observed }) => id === '22_page_hash_mismatch'
      && pass
      && observed.errorCode === 'PAGE_TEXT_SHA256_MISMATCH').length;
  const intakeSourceFileMismatchRefused = evaluation.scenarioResults
    .filter(({ id, pass, observed }) => id === '21_file_hash_mismatch'
      && pass
      && observed.errorCode === 'INTAKE_FILE_SHA256_MISMATCH').length;
  const real = await auditOptionalRealDocuments(REAL_INTAKE_AUDIT_AS_OF);
  const violations = [];
  if (evaluation.summary.failed !== 0) violations.push('SYNTHETIC_EVALUATION_FAILED');
  if (real.REAL_VERIFIED_CLAIMS !== 0) violations.push('REAL_VERIFIED_CLAIM_LEAKAGE');
  if (real.REAL_CUSTOMER_USE_ALLOWED !== 0) violations.push('REAL_CUSTOMER_USE_LEAKAGE');

  return {
    schemaVersion: 'official-evidence-document-audit-v0',
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    productionReady: false,
    productionReviewerWorkflowReady: false,
    issue165Status: 'HOLD',
    documentStatus: violations.length === 0
      ? 'OFFICIAL_EVIDENCE_DOCUMENT_AUDIT_PASS'
      : 'OFFICIAL_EVIDENCE_DOCUMENT_AUDIT_FAIL',
    evaluationSha256: evaluation.canonicalSha256,
    summary: {
      scenarioCount: fixture.scenarios.length,
      syntheticDocumentRecords: fixture.scenarios.reduce((total, { documents }) => total + documents.length, 0),
      normalizedDocumentRecords,
      rejectedDocumentRecords,
      pageCount,
      candidateCount,
      reviewState: {
        syntheticFixtureDecisionApprovedForRepositoryReview: 1,
        actualHumanReviewSessions: 0,
        realCandidatesApprovedForRepositoryReview: real.REAL_CANDIDATES_APPROVED_FOR_REPOSITORY_REVIEW,
        automaticVerified: 0,
        automaticAllowed: 0
      },
      conflictCount,
      supersededCount,
      quoteBindingFailures,
      expectedUnsafeFieldRefusals: unsafeFieldFailures,
      unsafeFieldValidationFailures: 0,
      candidateExtractionFailures,
      hashStatus: {
        normalizedContentPassed: hashPassCount,
        pageTextMismatchRefused,
        intakeSourceFileMismatchRefused
      },
      revisionStatus: stageSummary(revisionStageCounts),
      sourceUrlStatus: stageSummary(sourceUrlStageCounts),
      documentTypes: sortedObject(byDocumentType),
      productFamilies: sortedObject(byProductFamily),
      languages: sortedObject(byLanguage),
      jurisdictions: sortedObject(byJurisdiction),
      syntheticDocuments: normalizedDocumentRecords,
      realDocuments: real.REAL_DOCUMENTS_PRESENT
    },
    realDocumentOutcome: real,
    violations,
    nonClaims: [
      'Synthetic acceptance does not establish a real source as official or current.',
      'No human review result is claimed by this audit.',
      'Optional real intake cannot produce VERIFIED or customer-use ALLOWED claims.'
    ]
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await auditEvidenceDocuments();
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.violations.length > 0) process.exitCode = 1;
}
