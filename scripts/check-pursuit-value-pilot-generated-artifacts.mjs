#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  hashPursuitValuePilotCanonical,
  serializePursuitValuePilotCanonical,
  validatePursuitValuePilotProtocol,
} from '../verticals/datacenter/pursuit-value-pilot-v0.mjs';
import {
  buildRepositoryPursuitValuePilotContext,
} from './lib/pursuit-value-pilot-files.mjs';
import { REPO_ROOT } from './lib/repository-claim-registry.mjs';

export const PURSUIT_VALUE_PILOT_GENERATED_ARTIFACT_PATHS = Object.freeze([
  'tmp/codex/pursuit-value-pilot-v0-protocol.json',
  'tmp/codex/pursuit-value-pilot-v0-readiness-non-production.json',
]);

const [PROTOCOL_PATH, READINESS_PATH] =
  PURSUIT_VALUE_PILOT_GENERATED_ARTIFACT_PATHS;
const EVALUATOR_PATH = resolve(
  REPO_ROOT,
  'scripts/evaluate-pursuit-value-pilot-v0.mjs',
);
const MAX_EVALUATOR_OUTPUT_BYTES = 1024 * 1024;

export class PursuitValuePilotGeneratedArtifactError extends Error {
  constructor(code, relativePath, cause) {
    super(`${code}:${relativePath}`, cause ? { cause } : undefined);
    this.name = 'PursuitValuePilotGeneratedArtifactError';
    this.code = code;
    this.relativePath = relativePath;
    this.path = relativePath;
  }
}

function fail(code, relativePath, cause) {
  throw new PursuitValuePilotGeneratedArtifactError(
    code,
    relativePath,
    cause,
  );
}

async function buildAtPath(relativePath, operation) {
  try {
    return await operation();
  } catch (cause) {
    if (cause instanceof PursuitValuePilotGeneratedArtifactError) throw cause;
    fail(
      'PURSUIT_VALUE_PILOT_GENERATED_ARTIFACT_EXPECTED_INVALID',
      relativePath,
      cause,
    );
  }
}

function serializeArtifact(value) {
  const serialized = serializePursuitValuePilotCanonical(value);
  return serialized.endsWith('\n') ? serialized : `${serialized}\n`;
}

function runLiveReadinessEvaluation() {
  const result = spawnSync(process.execPath, [EVALUATOR_PATH], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: { PATH: process.env.PATH || '' },
    maxBuffer: MAX_EVALUATOR_OUTPUT_BYTES,
  });
  if (result.error) throw result.error;
  if (result.status !== 0 || result.signal || result.stderr !== '') {
    const error = new Error('PURSUIT_VALUE_PILOT_LIVE_EVALUATION_FAILED');
    error.code = 'PURSUIT_VALUE_PILOT_LIVE_EVALUATION_FAILED';
    throw error;
  }
  try {
    return JSON.parse(result.stdout);
  } catch (cause) {
    const error = new Error('PURSUIT_VALUE_PILOT_LIVE_EVALUATION_JSON_INVALID', {
      cause,
    });
    error.code = 'PURSUIT_VALUE_PILOT_LIVE_EVALUATION_JSON_INVALID';
    throw error;
  }
}

function validateReadinessReport(readiness, protocol) {
  if (
    readiness?.schemaVersion !== 'pursuit-value-pilot-v0-readiness-report-v0'
    || readiness.documentStatus !== 'READY_FOR_HUMAN_SESSIONS'
    || readiness.boundary !== 'NOT_PRODUCTION_EVIDENCE'
    || readiness.executionBoundary !== 'LOCAL_TEST_SYNTHETIC_ONLY'
    || readiness.productionReady !== false
    || readiness.productionReviewerWorkflowReady !== false
    || readiness.issue165Status !== 'HOLD'
    || readiness.humanEvidenceStatus !== 'INCOMPLETE'
    || readiness.automaticPilotDecision !== false
    || readiness.pilotDisposition !== 'NOT_MADE'
    || readiness.hashes?.protocolCanonicalSha256 !== protocol.canonicalSha256
  ) {
    const error = new Error('PURSUIT_VALUE_PILOT_READINESS_CONTRACT_INVALID');
    error.code = 'PURSUIT_VALUE_PILOT_READINESS_CONTRACT_INVALID';
    throw error;
  }
  const { canonicalSha256, ...withoutHash } = readiness;
  if (
    typeof canonicalSha256 !== 'string'
    || !/^[a-f0-9]{64}$/.test(canonicalSha256)
    || hashPursuitValuePilotCanonical(withoutHash) !== canonicalSha256
  ) {
    const error = new Error('PURSUIT_VALUE_PILOT_READINESS_HASH_INVALID');
    error.code = 'PURSUIT_VALUE_PILOT_READINESS_HASH_INVALID';
    throw error;
  }
  return readiness;
}

function expectedEntry(relativePath, value, validateActual) {
  return Object.freeze({
    relativePath,
    expectedContent: serializeArtifact(value),
    validateActual,
  });
}

export async function buildExpectedPursuitValuePilotGeneratedArtifacts() {
  const context = await buildAtPath(
    PROTOCOL_PATH,
    () => buildRepositoryPursuitValuePilotContext(),
  );
  const protocol = await buildAtPath(PROTOCOL_PATH, () => {
    validatePursuitValuePilotProtocol(
      context.protocol,
      context.registry,
      context.verticalPack,
    );
    return context.protocol;
  });
  const readiness = await buildAtPath(READINESS_PATH, () => {
    const report = runLiveReadinessEvaluation();
    return validateReadinessReport(report, protocol);
  });

  return Object.freeze([
    expectedEntry(PROTOCOL_PATH, protocol, (actual) => (
      validatePursuitValuePilotProtocol(
        actual,
        context.registry,
        context.verticalPack,
      )
    )),
    expectedEntry(READINESS_PATH, readiness, (actual) => (
      validateReadinessReport(actual, protocol)
    )),
  ]);
}

async function readStoredArtifact(entry, { repoRoot, readArtifact }) {
  const absolutePath = resolve(repoRoot, entry.relativePath);
  let content;
  try {
    content = await readArtifact({
      relativePath: entry.relativePath,
      absolutePath,
      encoding: 'utf8',
    });
  } catch (cause) {
    fail(
      cause?.code === 'ENOENT'
        ? 'PURSUIT_VALUE_PILOT_GENERATED_ARTIFACT_MISSING'
        : 'PURSUIT_VALUE_PILOT_GENERATED_ARTIFACT_READ_FAILED',
      entry.relativePath,
      cause,
    );
  }
  if (typeof content !== 'string') {
    fail('PURSUIT_VALUE_PILOT_GENERATED_ARTIFACT_INVALID', entry.relativePath);
  }
  return content;
}

function parseAndValidateStoredArtifact(entry, content) {
  try {
    entry.validateActual(JSON.parse(content));
  } catch (cause) {
    fail(
      'PURSUIT_VALUE_PILOT_GENERATED_ARTIFACT_INVALID',
      entry.relativePath,
      cause,
    );
  }
}

export async function checkPursuitValuePilotGeneratedArtifacts({
  repoRoot = REPO_ROOT,
  readArtifact = ({ absolutePath, encoding }) => readFile(absolutePath, encoding),
} = {}) {
  const expectedArtifacts =
    await buildExpectedPursuitValuePilotGeneratedArtifacts();

  for (const entry of expectedArtifacts) {
    const actualContent = await readStoredArtifact(entry, {
      repoRoot,
      readArtifact,
    });
    parseAndValidateStoredArtifact(entry, actualContent);
    if (actualContent !== entry.expectedContent) {
      fail(
        'PURSUIT_VALUE_PILOT_GENERATED_ARTIFACT_DRIFT',
        entry.relativePath,
      );
    }
  }

  return Object.freeze({
    documentStatus: 'PURSUIT_VALUE_PILOT_GENERATED_ARTIFACT_DRIFT_CHECK_PASS',
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    productionReady: false,
    checkedArtifactCount:
      PURSUIT_VALUE_PILOT_GENERATED_ARTIFACT_PATHS.length,
    checkedPaths: [...PURSUIT_VALUE_PILOT_GENERATED_ARTIFACT_PATHS],
  });
}

function isMainModule() {
  return Boolean(process.argv[1])
    && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isMainModule()) {
  try {
    const result = await checkPursuitValuePilotGeneratedArtifacts();
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    const failure = {
      documentStatus: 'PURSUIT_VALUE_PILOT_GENERATED_ARTIFACT_DRIFT_CHECK_FAIL',
      boundary: 'NOT_PRODUCTION_EVIDENCE',
      productionReady: false,
      reasonCode:
        error?.code || 'PURSUIT_VALUE_PILOT_GENERATED_ARTIFACT_CHECK_FAILED',
      path: error?.relativePath || '$',
    };
    process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
    process.exitCode = 1;
  }
}
