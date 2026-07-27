#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
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
  writeOutput(option('--output'), serialized),
  writeOutput(option('--markdown-output'), markdown),
]);

if (!process.argv.includes('--quiet')) {
  process.stdout.write(serialized);
}
