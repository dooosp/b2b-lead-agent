#!/usr/bin/env node

import { createRequire } from 'node:module';
import { isDirectCliRun, optionValue, writeJsonArtifact } from './lib/cli-utils.mjs';

const require = createRequire(import.meta.url);

const {
  buildEnrichmentFixtureReplayArtifact,
} = require('../enricher/enrichment-fixture-replay');

export const ENRICHMENT_FIXTURE_REPLAY_OUTPUT_PATH =
  'tmp/codex/enrichment-fixture-replay-output-contract-non-production.json';

export async function evaluateEnrichmentFixtureReplay(input = {}) {
  return buildEnrichmentFixtureReplayArtifact(input);
}

async function runCli() {
  const artifact = await evaluateEnrichmentFixtureReplay();
  const output = process.argv.includes('--json')
    ? JSON.stringify(artifact, null, 2)
    : [
      `${artifact.documentStatus}: PASS_LOCAL_ONLY`,
      `boundary: ${artifact.boundary}`,
      `productionReady: ${artifact.productionReady}`,
      `notProductionEvidence: ${artifact.notProductionEvidence}`,
      `cases: ${artifact.summary.totalCases}`,
      `liveNetworkCalls: ${artifact.summary.liveNetworkCalls}`,
    ].join('\n');
  const outputPath = optionValue('--output') || '';

  writeJsonArtifact(outputPath, artifact);

  console.log(output);
}

if (isDirectCliRun(import.meta.url)) {
  await runCli();
}
