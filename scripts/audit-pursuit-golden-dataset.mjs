#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  GOLDEN_AUDIT_BOUNDARY,
  GOLDEN_AUDIT_SCHEMA_VERSION,
  buildGoldenDatasetAuditReport,
} from '../knowledge/golden-dataset/index.mjs';
import { canonicalStringify, sha256 } from '../knowledge/claim-registry/index.mjs';
import {
  REPO_ROOT,
} from './lib/repository-claim-registry.mjs';
import {
  GOLDEN_ADJUDICATIONS_PATH,
  GOLDEN_CANDIDATES_PATH,
  loadRepositoryCurrentGoldenDataset,
  loadRepositoryGoldenDataset,
} from './lib/repository-golden-dataset.mjs';
import { validateGoldenDatasetAuditReport } from './lib/golden-dataset-report-validation.mjs';

function option(name) {
  const index = process.argv.indexOf(name);
  return index < 0 ? '' : process.argv[index + 1] || '';
}

function emptySummary() {
  return {
    projectCandidateCount: 0,
    publicSourceDocumentCandidateCount: 0,
    capabilityClaimCandidateCount: 0,
    requirementCapabilityPairCandidateCount: 0,
    productFamilyCount: 0,
    candidateStageCount: 0,
    revisionLinkCandidateCount: 0,
    humanConfirmedProjectCount: 0,
    humanConfirmedCapabilityClaimCount: 0,
    humanConfirmedPairCount: 0,
    humanConfirmedRevisionLinkCount: 0,
    humanConfirmedStageCount: 0,
    pendingProjectCount: 0,
    pendingCapabilityClaimCount: 0,
    pendingPairCount: 0,
    pendingRevisionLinkCount: 0,
    provisionalLabelLeakage: 0,
    thresholdGaps: [],
  };
}

function failureReport(error) {
  const violation = {
    reasonCode: typeof error?.code === 'string' ? error.code : 'GOLDEN_DATASET_LOAD_FAILED',
    path: typeof error?.path === 'string' ? error.path : '$',
  };
  const reportWithoutHash = {
    documentStatus: 'PURSUIT_GOLDEN_DATASET_AUDIT_FAIL',
    schemaVersion: GOLDEN_AUDIT_SCHEMA_VERSION,
    boundary: GOLDEN_AUDIT_BOUNDARY,
    productionReady: false,
    goldenReady: false,
    datasetState: 'INVALID',
    evaluationAsOf: null,
    summary: emptySummary(),
    violations: [violation],
    nonClaims: [
      'The source candidate or human adjudication packet is invalid; no Golden Dataset readiness claim is made.',
      'The audit failure does not authorize production, customer-data, endpoint, D1, CRM, outreach, or automated decision activity.',
    ],
    datasetCanonicalSha256: null,
  };
  return {
    ...reportWithoutHash,
    canonicalSha256: sha256(canonicalStringify(reportWithoutHash)),
  };
}

let report;
try {
  const candidatesPath = option('--candidates');
  const adjudicationsPath = option('--adjudications');
  const { dataset } = candidatesPath || adjudicationsPath
    ? await loadRepositoryGoldenDataset({
      candidatesPath: candidatesPath || GOLDEN_CANDIDATES_PATH,
      adjudicationsPath: adjudicationsPath || GOLDEN_ADJUDICATIONS_PATH,
    })
    : await loadRepositoryCurrentGoldenDataset();
  report = buildGoldenDatasetAuditReport(dataset);
} catch (error) {
  report = failureReport(error);
}

validateGoldenDatasetAuditReport(report);
const serialized = `${JSON.stringify(report, null, 2)}\n`;
const output = option('--output');
if (output) {
  const outputPath = resolve(REPO_ROOT, output);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, serialized, 'utf8');
}
process.stdout.write(serialized);

if (report.violations.length > 0 && process.argv.includes('--fail-on-violations')) {
  process.exitCode = 1;
} else if (!report.goldenReady && process.argv.includes('--require-golden-ready')) {
  process.exitCode = 2;
}
