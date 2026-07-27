#!/usr/bin/env node

import { evaluatePursuitTwinV0Suite } from '../eval/pursuit-twin-v0-evaluator.mjs';
import {
  assertSafeArtifact,
  canonicalStringify,
  sha256
} from '../knowledge/claim-registry/index.mjs';
import { loadEvidenceDomainInputs, REPO_ROOT } from './lib/repository-claim-registry.mjs';
import {
  resolveApprovedArtifactOutput,
  writeApprovedArtifactOutput,
} from './lib/repository-artifact-output.mjs';

export const PURSUIT_TWIN_EVALUATION_OUTPUT_PATH =
  'tmp/codex/pursuit-twin-v0-evaluation-non-production.json';
export const PURSUIT_TWIN_PACKET_JSON_OUTPUT_PATH =
  'tmp/codex/pursuit-twin-v0-review-packet-non-production.json';
export const PURSUIT_TWIN_PACKET_MARKDOWN_OUTPUT_PATH =
  'tmp/codex/pursuit-twin-v0-review-packet-non-production.md';

function parseOption(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? '' : process.argv[index + 1] || '';
}

const artifactOptions = { repositoryRoot: REPO_ROOT };
const reportOutput = resolveApprovedArtifactOutput(
  parseOption('--output'),
  PURSUIT_TWIN_EVALUATION_OUTPUT_PATH,
  artifactOptions,
);
const packetJsonOutput = resolveApprovedArtifactOutput(
  parseOption('--packet-json'),
  PURSUIT_TWIN_PACKET_JSON_OUTPUT_PATH,
  artifactOptions,
);
const packetMarkdownOutput = resolveApprovedArtifactOutput(
  parseOption('--packet-markdown'),
  PURSUIT_TWIN_PACKET_MARKDOWN_OUTPUT_PATH,
  artifactOptions,
);

const repeat = Number(parseOption('--repeat') || 1);
if (!Number.isInteger(repeat) || repeat < 1 || repeat > 20) {
  throw new Error('PURSUIT_TWIN_REPEAT_MUST_BE_INTEGER_1_TO_20');
}

const inputs = await loadEvidenceDomainInputs();
const first = evaluatePursuitTwinV0Suite(inputs);
for (let index = 1; index < repeat; index += 1) {
  const next = evaluatePursuitTwinV0Suite(inputs);
  if (canonicalStringify(first) !== canonicalStringify(next)) {
    throw new Error('PURSUIT_TWIN_REPEAT_NONDETERMINISTIC');
  }
}

const { fixtureReviewPacket, ...canonicalReport } = first;
assertSafeArtifact(canonicalReport, '$.pursuitTwinEvaluationReport');
const report = {
  ...canonicalReport,
  canonicalSha256: sha256(canonicalReport)
};
const serialized = `${JSON.stringify(report, null, 2)}\n`;

await Promise.all([
  writeApprovedArtifactOutput(reportOutput, serialized, artifactOptions),
  writeApprovedArtifactOutput(packetJsonOutput, fixtureReviewPacket.json, artifactOptions),
  writeApprovedArtifactOutput(
    packetMarkdownOutput,
    fixtureReviewPacket.markdown,
    artifactOptions,
  ),
]);

process.stdout.write(serialized);

const summary = report.summary;
if (
  report.documentStatus !== 'PURSUIT_TWIN_V0_EVALUATION_PASS'
  || report.productionReady !== false
  || report.issue165Status !== 'HOLD'
  || summary.strictScenarioAccuracyBasisPoints !== 10_000
  || summary.specDeltaAccuracyBasisPoints !== 10_000
  || summary.decisionInvalidationAccuracyBasisPoints !== 10_000
  || summary.minimumEvidenceAccuracyBasisPoints !== 10_000
  || summary.repeatHashEqualityBasisPoints !== 10_000
  || summary.automaticDecisionChanges !== 0
  || summary.fitGuaranteeClaims !== 0
  || summary.productionReadyClaims !== 0
  || summary.counterfactualExecutions !== 0
  || summary.secretLeakage !== 0
  || summary.externalCalls !== 0
) process.exitCode = 1;
