#!/usr/bin/env node

import {
  buildGoldenHumanReviewBatch,
  validateGoldenHumanReviewBatch,
} from './lib/golden-human-review-batch.mjs';
import { REPO_ROOT } from './lib/repository-claim-registry.mjs';
import {
  loadRepositoryGoldenCandidateIntakeDataset,
} from './lib/repository-golden-dataset.mjs';
import {
  resolveApprovedArtifactOutput,
  writeApprovedArtifactOutput,
} from './lib/repository-artifact-output.mjs';

export const GOLDEN_HUMAN_REVIEW_BATCH_OUTPUT_PATH =
  'tmp/codex/pursuit-golden-human-review-batch-01.json';

function option(name) {
  const index = process.argv.indexOf(name);
  return index < 0 ? '' : process.argv[index + 1] || '';
}

const artifactOptions = { repositoryRoot: REPO_ROOT };
const outputPath = resolveApprovedArtifactOutput(
  option('--output'),
  GOLDEN_HUMAN_REVIEW_BATCH_OUTPUT_PATH,
  artifactOptions,
);

const { dataset } = await loadRepositoryGoldenCandidateIntakeDataset();
const packet = buildGoldenHumanReviewBatch(dataset);
validateGoldenHumanReviewBatch(packet);
const serialized = `${JSON.stringify(packet, null, 2)}\n`;
await writeApprovedArtifactOutput(outputPath, serialized, artifactOptions);
if (!process.argv.includes('--quiet')) {
  process.stdout.write(serialized);
}
