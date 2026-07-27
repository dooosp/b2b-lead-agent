#!/usr/bin/env node

import {
  buildGoldenHumanReviewBatch02,
} from './lib/golden-human-review-batch-02.mjs';
import {
  buildGoldenHumanReviewProposal02,
  renderGoldenHumanReviewProposal02Markdown,
  validateGoldenHumanReviewProposal02,
} from './lib/golden-human-review-proposal-02.mjs';
import { REPO_ROOT } from './lib/repository-claim-registry.mjs';
import {
  loadRepositoryCurrentGoldenDataset,
} from './lib/repository-golden-dataset.mjs';
import {
  resolveApprovedArtifactOutput,
  writeApprovedArtifactOutput,
} from './lib/repository-artifact-output.mjs';

export const GOLDEN_HUMAN_REVIEW_PROPOSAL_02_OUTPUT_PATH =
  'tmp/codex/pursuit-golden-human-review-batch-02-proposal.json';
export const GOLDEN_HUMAN_REVIEW_PROPOSAL_02_MARKDOWN_OUTPUT_PATH =
  'docs/roadmap/pursuit-golden-human-review-batch-02-proposal.md';

function option(name) {
  const index = process.argv.indexOf(name);
  return index < 0 ? '' : process.argv[index + 1] || '';
}

const artifactOptions = { repositoryRoot: REPO_ROOT };
const outputPath = resolveApprovedArtifactOutput(
  option('--output'),
  GOLDEN_HUMAN_REVIEW_PROPOSAL_02_OUTPUT_PATH,
  artifactOptions,
);
const markdownOutputPath = resolveApprovedArtifactOutput(
  option('--markdown-output'),
  GOLDEN_HUMAN_REVIEW_PROPOSAL_02_MARKDOWN_OUTPUT_PATH,
  artifactOptions,
);

const loaded = await loadRepositoryCurrentGoldenDataset();
const preparationDataset = loaded.preAdjudicationDataset || loaded.dataset;
const reviewBatch = buildGoldenHumanReviewBatch02(preparationDataset);
const proposal = buildGoldenHumanReviewProposal02(reviewBatch, preparationDataset);
validateGoldenHumanReviewProposal02(proposal, reviewBatch, preparationDataset);

const serialized = `${JSON.stringify(proposal, null, 2)}\n`;
const markdown = renderGoldenHumanReviewProposal02Markdown(
  proposal,
  reviewBatch,
  preparationDataset,
);
await Promise.all([
  writeApprovedArtifactOutput(outputPath, serialized, artifactOptions),
  writeApprovedArtifactOutput(markdownOutputPath, markdown, artifactOptions),
]);

if (!process.argv.includes('--quiet')) {
  process.stdout.write(serialized);
}
