#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  buildGoldenHumanReviewBatch02,
  validateGoldenHumanReviewBatch02,
} from './lib/golden-human-review-batch-02.mjs';
import { REPO_ROOT } from './lib/repository-claim-registry.mjs';
import {
  loadRepositoryCurrentGoldenDataset,
} from './lib/repository-golden-dataset.mjs';

function option(name) {
  const index = process.argv.indexOf(name);
  return index < 0 ? '' : process.argv[index + 1] || '';
}

const loaded = await loadRepositoryCurrentGoldenDataset();
const preparationDataset = loaded.preAdjudicationDataset || loaded.dataset;
const packet = buildGoldenHumanReviewBatch02(preparationDataset);
validateGoldenHumanReviewBatch02(packet, preparationDataset);
const serialized = `${JSON.stringify(packet, null, 2)}\n`;
const output = option('--output');
if (output) {
  const outputPath = resolve(REPO_ROOT, output);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, serialized, 'utf8');
}
if (!process.argv.includes('--quiet')) {
  process.stdout.write(serialized);
}
