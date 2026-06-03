#!/usr/bin/env node

import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);

const {
  buildEnrichmentFixtureReplayArtifact,
} = require('../enricher/enrichment-fixture-replay');

export const ENRICHMENT_FIXTURE_REPLAY_OUTPUT_PATH =
  'tmp/codex/enrichment-fixture-replay-output-contract-non-production.json';

function optionValue(flag, argv = process.argv) {
  const index = argv.indexOf(flag);
  if (index < 0) return '';
  return argv[index + 1] || '';
}

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

  if (outputPath) {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`);
  }

  console.log(output);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runCli();
}
