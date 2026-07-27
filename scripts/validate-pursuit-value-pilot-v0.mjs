#!/usr/bin/env node

import { loadAndAggregatePursuitValuePilotPrivateFiles } from './lib/pursuit-value-pilot-files.mjs';

const BASE_STATUS = Object.freeze({
  schemaVersion: 'pursuit-value-pilot-aggregate-v0',
  boundary: 'NOT_PRODUCTION_EVIDENCE',
  executionBoundary: 'LOCAL_TEST_SYNTHETIC_ONLY',
  productionReady: false,
  productionReviewerWorkflowReady: false,
  issue165Status: 'HOLD',
  humanEvidenceStatus: 'INCOMPLETE',
  systemFinalDecisionAcceptance: 'NOT_MEASURABLE_NO_SYSTEM_FINAL_DECISION',
  automaticPilotDecision: false,
  pilotDisposition: 'NOT_MADE',
});

function failureCode(error) {
  return typeof error?.code === 'string' && /^[A-Z0-9_]+$/.test(error.code)
    ? error.code
    : 'PILOT_VALIDATION_FAILED';
}

try {
  if (process.argv.length !== 2) {
    const error = new Error('PILOT_CLI_ARGUMENT_REFUSED');
    error.code = 'PILOT_CLI_ARGUMENT_REFUSED';
    throw error;
  }
  const aggregate = await loadAndAggregatePursuitValuePilotPrivateFiles();
  process.stdout.write(`${JSON.stringify(aggregate, null, 2)}\n`);
} catch (error) {
  process.stdout.write(`${JSON.stringify({
    ...BASE_STATUS,
    documentStatus: 'INVALID',
    counts: {
      eligibleCompletedReviewers: 0,
      completedTeamWeeks: 0,
    },
    failureCodes: [failureCode(error)],
  }, null, 2)}\n`);
  process.exitCode = 1;
}
