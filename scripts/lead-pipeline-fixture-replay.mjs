#!/usr/bin/env node

import { createRequire } from 'node:module';
import { isDirectCliRun, optionValue, writeJsonArtifact } from './lib/cli-utils.mjs';

const require = createRequire(import.meta.url);

const {
  buildLeadPipelineFixtureReplayArtifact,
} = require('../lead-pipeline-fixture-replay');

export const LEAD_PIPELINE_FIXTURE_REPLAY_OUTPUT_PATH =
  'tmp/codex/lead-pipeline-fixture-replay-artifact-contract-non-production.json';

export async function evaluateLeadPipelineFixtureReplay(input = {}) {
  return buildLeadPipelineFixtureReplayArtifact(input);
}

async function runCli() {
  const artifact = await evaluateLeadPipelineFixtureReplay();
  const output = process.argv.includes('--json')
    ? JSON.stringify(artifact, null, 2)
    : [
      `${artifact.documentStatus}: PASS_LOCAL_ONLY`,
      `boundary: ${artifact.boundary}`,
      `productionReady: ${artifact.productionReady}`,
      `notProductionEvidence: ${artifact.notProductionEvidence}`,
      `replayCases: ${artifact.summary.replayCases}`,
      `syntheticLeads: ${artifact.summary.syntheticLeads}`,
      `liveNetworkCalls: ${artifact.summary.liveNetworkCalls}`,
      `llmCalls: ${artifact.summary.llmCalls}`,
      `crmCalls: ${artifact.summary.crmCalls}`,
      `d1Calls: ${artifact.summary.d1Calls}`,
    ].join('\n');
  const outputPath = optionValue('--output') || '';

  writeJsonArtifact(outputPath, artifact);

  console.log(output);
}

if (isDirectCliRun(import.meta.url)) {
  await runCli();
}
