#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
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

function option(name) {
  const index = process.argv.indexOf(name);
  return index < 0 ? '' : process.argv[index + 1] || '';
}

async function writeOutput(path, content) {
  if (!path) return;
  const resolved = resolve(REPO_ROOT, path);
  await mkdir(dirname(resolved), { recursive: true });
  await writeFile(resolved, content, 'utf8');
}

const { dataset } = await loadRepositoryGoldenCandidateIntakeDataset();
const reviewBatch = buildGoldenHumanReviewBatch(dataset);
const proposal = buildGoldenHumanReviewProposal(reviewBatch);
validateGoldenHumanReviewProposal(proposal, reviewBatch);

const serialized = `${JSON.stringify(proposal, null, 2)}\n`;
const markdown = renderGoldenHumanReviewProposalMarkdown(proposal, reviewBatch);
await Promise.all([
  writeOutput(option('--output'), serialized),
  writeOutput(option('--markdown-output'), markdown),
]);

if (!process.argv.includes('--quiet')) {
  process.stdout.write(serialized);
}
