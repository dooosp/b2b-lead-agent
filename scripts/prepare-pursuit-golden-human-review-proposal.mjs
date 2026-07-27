#!/usr/bin/env node

import {
  buildGoldenHumanReviewProposal,
  renderGoldenHumanReviewProposalMarkdown,
  validateGoldenHumanReviewProposal,
} from './lib/golden-human-review-proposal.mjs';
import { buildGoldenHumanReviewBatch } from './lib/golden-human-review-batch.mjs';
import { REPO_ROOT } from './lib/repository-claim-registry.mjs';
import {
  loadRepositoryGoldenCandidateIntakeDataset,
} from './lib/repository-golden-dataset.mjs';
import {
  resolveApprovedArtifactOutput,
  writeApprovedArtifactOutput,
} from './lib/repository-artifact-output.mjs';

export const GOLDEN_HUMAN_REVIEW_PROPOSAL_OUTPUT_PATH =
  'tmp/codex/pursuit-golden-human-review-batch-01-proposal.json';
export const GOLDEN_HUMAN_REVIEW_PROPOSAL_MARKDOWN_OUTPUT_PATH =
  'docs/roadmap/pursuit-golden-human-review-batch-01-proposal.md';

function option(name) {
  const index = process.argv.indexOf(name);
  return index < 0 ? '' : process.argv[index + 1] || '';
}

const artifactOptions = { repositoryRoot: REPO_ROOT };
const outputPath = resolveApprovedArtifactOutput(
  option('--output'),
  GOLDEN_HUMAN_REVIEW_PROPOSAL_OUTPUT_PATH,
  artifactOptions,
);
const markdownOutputPath = resolveApprovedArtifactOutput(
  option('--markdown-output'),
  GOLDEN_HUMAN_REVIEW_PROPOSAL_MARKDOWN_OUTPUT_PATH,
  artifactOptions,
);

const { dataset } = await loadRepositoryGoldenCandidateIntakeDataset();
const reviewBatch = buildGoldenHumanReviewBatch(dataset);
const proposal = buildGoldenHumanReviewProposal(reviewBatch);
validateGoldenHumanReviewProposal(proposal, reviewBatch);

const serialized = `${JSON.stringify(proposal, null, 2)}\n`;
const markdown = renderGoldenHumanReviewProposalMarkdown(proposal, reviewBatch);
await Promise.all([
  writeApprovedArtifactOutput(outputPath, serialized, artifactOptions),
  writeApprovedArtifactOutput(markdownOutputPath, markdown, artifactOptions),
]);

if (!process.argv.includes('--quiet')) {
  process.stdout.write(serialized);
}
