#!/usr/bin/env node

import {
  PURSUIT_VALUE_PILOT_REVIEWER_IDS,
  preparePursuitValuePilotPrivateFiles,
} from './lib/pursuit-value-pilot-files.mjs';

const BASE_STATUS = Object.freeze({
  schemaVersion: 'pursuit-value-pilot-private-intake-status-v0',
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
    : 'PILOT_PREPARE_FAILED';
}

try {
  if (process.argv.length !== 2) {
    const error = new Error('PILOT_CLI_ARGUMENT_REFUSED');
    error.code = 'PILOT_CLI_ARGUMENT_REFUSED';
    throw error;
  }
  const prepared = await preparePursuitValuePilotPrivateFiles();
  process.stdout.write(`${JSON.stringify({
    ...BASE_STATUS,
    documentStatus: 'PREPARED_FOR_HUMAN_SESSIONS',
    reviewerIds: [...PURSUIT_VALUE_PILOT_REVIEWER_IDS],
    counts: {
      reviewerSessionFiles: 5,
      offlineHtmlFiles: 5,
      teamWeekFiles: 1,
      totalFiles: prepared.files.length,
      completedHumanSessions: 0,
      completedTeamWeeks: 0,
    },
    failureCodes: [],
  }, null, 2)}\n`);
} catch (error) {
  process.stdout.write(`${JSON.stringify({
    ...BASE_STATUS,
    documentStatus: 'INVALID',
    reviewerIds: [],
    counts: {
      reviewerSessionFiles: 0,
      offlineHtmlFiles: 0,
      teamWeekFiles: 0,
      totalFiles: 0,
      completedHumanSessions: 0,
      completedTeamWeeks: 0,
    },
    failureCodes: [failureCode(error)],
  }, null, 2)}\n`);
  process.exitCode = 1;
}
