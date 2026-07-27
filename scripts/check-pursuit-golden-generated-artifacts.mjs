#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildGoldenDatasetAuditReport,
} from '../knowledge/golden-dataset/index.mjs';
import {
  buildGoldenHumanReviewBatch02,
  validateGoldenHumanReviewBatch02,
} from './lib/golden-human-review-batch-02.mjs';
import {
  buildGoldenHumanReviewBatch,
  validateGoldenHumanReviewBatch,
} from './lib/golden-human-review-batch.mjs';
import {
  buildGoldenHumanReviewProposal02,
  renderGoldenHumanReviewProposal02Markdown,
  validateGoldenHumanReviewProposal02,
} from './lib/golden-human-review-proposal-02.mjs';
import {
  buildGoldenHumanReviewProposal,
  renderGoldenHumanReviewProposalMarkdown,
  validateGoldenHumanReviewProposal,
} from './lib/golden-human-review-proposal.mjs';
import { validateGoldenDatasetAuditReport } from './lib/golden-dataset-report-validation.mjs';
import { REPO_ROOT } from './lib/repository-claim-registry.mjs';
import {
  loadRepositoryCurrentGoldenDataset,
  loadRepositoryGoldenCandidateIntakeDataset,
} from './lib/repository-golden-dataset.mjs';

export const GOLDEN_GENERATED_ARTIFACT_PATHS = Object.freeze([
  'tmp/codex/pursuit-golden-dataset-audit-non-production.json',
  'tmp/codex/pursuit-golden-human-review-batch-01.json',
  'tmp/codex/pursuit-golden-human-review-batch-01-proposal.json',
  'docs/roadmap/pursuit-golden-human-review-batch-01-proposal.md',
  'tmp/codex/pursuit-golden-human-review-batch-02.json',
  'tmp/codex/pursuit-golden-human-review-batch-02-proposal.json',
  'docs/roadmap/pursuit-golden-human-review-batch-02-proposal.md',
]);

const [
  AUDIT_PATH,
  BATCH_01_PATH,
  PROPOSAL_01_PATH,
  PROPOSAL_01_MARKDOWN_PATH,
  BATCH_02_PATH,
  PROPOSAL_02_PATH,
  PROPOSAL_02_MARKDOWN_PATH,
] = GOLDEN_GENERATED_ARTIFACT_PATHS;

export class GoldenGeneratedArtifactError extends Error {
  constructor(code, relativePath, cause) {
    super(`${code}:${relativePath}`, cause ? { cause } : undefined);
    this.name = 'GoldenGeneratedArtifactError';
    this.code = code;
    this.relativePath = relativePath;
    this.path = relativePath;
  }
}

function fail(code, relativePath, cause) {
  throw new GoldenGeneratedArtifactError(code, relativePath, cause);
}

function serializeJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function buildAtPath(relativePath, operation) {
  try {
    return await operation();
  } catch (cause) {
    if (cause instanceof GoldenGeneratedArtifactError) throw cause;
    fail('GOLDEN_GENERATED_ARTIFACT_EXPECTED_INVALID', relativePath, cause);
  }
}

function expectedEntry(relativePath, format, value, validateActual) {
  return Object.freeze({
    relativePath,
    format,
    expectedContent: format === 'json' ? serializeJson(value) : value,
    validateActual,
  });
}

export async function buildExpectedGoldenGeneratedArtifacts() {
  const current = await buildAtPath(
    AUDIT_PATH,
    () => loadRepositoryCurrentGoldenDataset(),
  );
  const currentDataset = current.dataset;
  const batch02Dataset = current.preAdjudicationDataset || currentDataset;
  const audit = await buildAtPath(AUDIT_PATH, () => {
    const report = buildGoldenDatasetAuditReport(currentDataset);
    validateGoldenDatasetAuditReport(report);
    return report;
  });

  const batch01Intake = await buildAtPath(
    BATCH_01_PATH,
    () => loadRepositoryGoldenCandidateIntakeDataset(),
  );
  const batch01 = await buildAtPath(BATCH_01_PATH, () => {
    const batch = buildGoldenHumanReviewBatch(batch01Intake.dataset);
    validateGoldenHumanReviewBatch(batch);
    return batch;
  });
  const proposal01 = await buildAtPath(PROPOSAL_01_PATH, () => {
    const proposal = buildGoldenHumanReviewProposal(batch01);
    validateGoldenHumanReviewProposal(proposal, batch01);
    return proposal;
  });
  const proposal01Markdown = await buildAtPath(
    PROPOSAL_01_MARKDOWN_PATH,
    () => renderGoldenHumanReviewProposalMarkdown(proposal01, batch01),
  );

  const batch02 = await buildAtPath(BATCH_02_PATH, () => {
    const batch = buildGoldenHumanReviewBatch02(batch02Dataset);
    validateGoldenHumanReviewBatch02(batch, batch02Dataset);
    return batch;
  });
  const proposal02 = await buildAtPath(PROPOSAL_02_PATH, () => {
    const proposal = buildGoldenHumanReviewProposal02(batch02, batch02Dataset);
    validateGoldenHumanReviewProposal02(proposal, batch02, batch02Dataset);
    return proposal;
  });
  const proposal02Markdown = await buildAtPath(
    PROPOSAL_02_MARKDOWN_PATH,
    () => renderGoldenHumanReviewProposal02Markdown(
      proposal02,
      batch02,
      batch02Dataset,
    ),
  );

  return Object.freeze([
    expectedEntry(AUDIT_PATH, 'json', audit, (actual) => {
      validateGoldenDatasetAuditReport(actual);
    }),
    expectedEntry(BATCH_01_PATH, 'json', batch01, (actual) => {
      validateGoldenHumanReviewBatch(actual);
    }),
    expectedEntry(PROPOSAL_01_PATH, 'json', proposal01, (actual, parsed) => {
      validateGoldenHumanReviewProposal(actual, parsed.get(BATCH_01_PATH));
    }),
    expectedEntry(PROPOSAL_01_MARKDOWN_PATH, 'markdown', proposal01Markdown),
    expectedEntry(BATCH_02_PATH, 'json', batch02, (actual) => {
      validateGoldenHumanReviewBatch02(actual, batch02Dataset);
    }),
    expectedEntry(PROPOSAL_02_PATH, 'json', proposal02, (actual, parsed) => {
      validateGoldenHumanReviewProposal02(
        actual,
        parsed.get(BATCH_02_PATH),
        batch02Dataset,
      );
    }),
    expectedEntry(PROPOSAL_02_MARKDOWN_PATH, 'markdown', proposal02Markdown),
  ]);
}

async function readStoredArtifact(entry, { repoRoot, readArtifact }) {
  const absolutePath = resolve(repoRoot, entry.relativePath);
  let content;
  try {
    content = await readArtifact({
      relativePath: entry.relativePath,
      absolutePath,
      encoding: 'utf8',
    });
  } catch (cause) {
    fail(
      cause?.code === 'ENOENT'
        ? 'GOLDEN_GENERATED_ARTIFACT_MISSING'
        : 'GOLDEN_GENERATED_ARTIFACT_READ_FAILED',
      entry.relativePath,
      cause,
    );
  }
  if (typeof content !== 'string') {
    fail('GOLDEN_GENERATED_ARTIFACT_INVALID', entry.relativePath);
  }
  return content;
}

function parseAndValidateStoredJson(entry, content, parsed) {
  let actual;
  try {
    actual = JSON.parse(content);
    entry.validateActual(actual, parsed);
  } catch (cause) {
    fail('GOLDEN_GENERATED_ARTIFACT_INVALID', entry.relativePath, cause);
  }
  parsed.set(entry.relativePath, actual);
}

export async function checkPursuitGoldenGeneratedArtifacts({
  repoRoot = REPO_ROOT,
  readArtifact = ({ absolutePath, encoding }) => readFile(absolutePath, encoding),
} = {}) {
  const expectedArtifacts = await buildExpectedGoldenGeneratedArtifacts();
  const parsed = new Map();

  for (const entry of expectedArtifacts) {
    const actualContent = await readStoredArtifact(entry, { repoRoot, readArtifact });
    if (entry.format === 'json') {
      parseAndValidateStoredJson(entry, actualContent, parsed);
    }
    if (actualContent !== entry.expectedContent) {
      fail('GOLDEN_GENERATED_ARTIFACT_DRIFT', entry.relativePath);
    }
  }

  return Object.freeze({
    documentStatus: 'PURSUIT_GOLDEN_GENERATED_ARTIFACT_DRIFT_CHECK_PASS',
    productionReady: false,
    checkedArtifactCount: GOLDEN_GENERATED_ARTIFACT_PATHS.length,
    checkedPaths: [...GOLDEN_GENERATED_ARTIFACT_PATHS],
  });
}

function isMainModule() {
  return Boolean(process.argv[1])
    && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isMainModule()) {
  try {
    const result = await checkPursuitGoldenGeneratedArtifacts();
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    const failure = {
      documentStatus: 'PURSUIT_GOLDEN_GENERATED_ARTIFACT_DRIFT_CHECK_FAIL',
      productionReady: false,
      reasonCode: error?.code || 'GOLDEN_GENERATED_ARTIFACT_CHECK_FAILED',
      path: error?.relativePath || '$',
    };
    process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
    process.exitCode = 1;
  }
}
