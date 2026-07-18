#!/usr/bin/env node

import {
  HUMAN_VALIDATION_AGGREGATE_SCHEMA_VERSION,
  HUMAN_VALIDATION_BOUNDARY
} from '../pursuit-workbench/domain/human-validation.mjs';
import { prepareHumanValidationSessionFiles } from './lib/pursuit-workbench-human-validation-files.mjs';

function safeFailure(error) {
  return {
    schemaVersion: HUMAN_VALIDATION_AGGREGATE_SCHEMA_VERSION,
    boundary: HUMAN_VALIDATION_BOUNDARY,
    productionReady: false,
    productionReviewerWorkflowReady: false,
    issue165Status: 'HOLD',
    status: 'INVALID',
    decision: 'INCOMPLETE',
    recordIds: [],
    failureCodes: [typeof error?.code === 'string' ? error.code : 'SESSION_PREPARE_FAILED']
  };
}

try {
  if (process.argv.length !== 2) {
    const error = new Error('SESSION_CLI_ARGUMENT_REFUSED');
    error.code = 'SESSION_CLI_ARGUMENT_REFUSED';
    throw error;
  }
  const recordIds = prepareHumanValidationSessionFiles();
  process.stdout.write(`${JSON.stringify({
    schemaVersion: HUMAN_VALIDATION_AGGREGATE_SCHEMA_VERSION,
    boundary: HUMAN_VALIDATION_BOUNDARY,
    productionReady: false,
    productionReviewerWorkflowReady: false,
    issue165Status: 'HOLD',
    status: 'PREPARED',
    decision: 'INCOMPLETE',
    recordIds,
    counts: { fileCount: recordIds.length }
  }, null, 2)}\n`);
} catch (error) {
  process.stdout.write(`${JSON.stringify(safeFailure(error), null, 2)}\n`);
  process.exitCode = 1;
}
