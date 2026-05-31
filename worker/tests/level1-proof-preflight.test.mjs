import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildLevel1RedactedFixtureEvidence,
  evaluateLevel1ProofPreflight,
  findLevel1ProofPreflightBlockers,
} from '../../scripts/level1-proof-preflight.mjs';

test('Level 1 proof preflight emits redacted fixture evidence and stays non-production', () => {
  const result = evaluateLevel1ProofPreflight({
    env: {
      LEVEL1_PROOF_PREFLIGHT_ENV: 'local_test',
      WORKER_ENV: 'local',
      WORKER_ORIGIN: 'localhost:8787',
    },
    urls: ['http://localhost:8787/leads', 'localhost:8787/leads', 'https://synthetic.example/fixture'],
  });
  const serialized = JSON.stringify(result.evidence);

  assert.equal(result.ok, true);
  assert.equal(result.evidence.status, 'PASS');
  assert.equal(result.evidence.boundary, 'NOT_PRODUCTION_EVIDENCE');
  assert.equal(result.evidence.notProductionEvidence, true);
  assert.equal(result.evidence.productionReady, false);
  assert.equal(result.evidence.productionReviewerWorkflowReady, false);
  assert.deepEqual(result.evidence.gates.map((gate) => [gate.id, gate.status]), [
    ['local_environment', 'PASS'],
    ['no_secrets_or_real_provider_inputs', 'PASS'],
    ['no_d1_binding_or_private_identifier', 'PASS'],
    ['no_production_or_staging_urls', 'PASS'],
    ['production_proof_approval', 'HOLD'],
  ]);
  assert.equal(result.evidence.readinessScorecard.overallStatus, 'BLOCKED');
  assert.equal(result.evidence.readinessScorecard.productionReviewerWorkflowReady, false);
  assert.equal(serialized.includes('Synthetic manual note body must never appear'), false);
  assert.equal(serialized.includes('Synthetic generated suggestion must never appear'), false);
  assert.equal(serialized.includes('synthetic-token-must-redact'), false);
  assert.equal(serialized.includes('Bearer synthetic-secret'), false);
});

test('Level 1 proof preflight refuses non-local envs URLs D1 bindings secrets and real provider inputs', () => {
  const blockers = findLevel1ProofPreflightBlockers({
    env: {
      LEVEL1_PROOF_PREFLIGHT_ENV: 'staging',
      WORKER_ENV: 'production',
      NODE_ENV: 'production',
      WRANGLER_ENV: 'preview',
      WORKER_ORIGIN: 'https://b2b-lead-trigger.example.com',
      BASE_URL: 'b2b-lead-trigger.example.com',
      PREVIEW_URL: 'https://preview.b2b-lead-trigger.example.com',
      WORKER_HOSTNAME: 'b2b-lead-trigger.example.com',
      API_TOKEN: 'real-token-must-not-be-read',
      GH_TOKEN: 'github-token-must-not-be-read',
      AUTH_PROVIDER_SESSION_SCAFFOLD_PROVIDER: 'real-provider-input',
      DB: { prepare() {} },
      DATABASE_ID: 'private-db-id',
    },
    urls: ['https://b2b-lead-trigger.example.com/leads', 'b2b-lead-trigger.example.com/leads', 'https://%'],
  });

  assert.deepEqual(blockers.map((blocker) => blocker.reason), [
    'non_local_environment_refused',
    'non_local_environment_refused',
    'non_local_environment_refused',
    'non_local_environment_refused',
    'secret_or_real_provider_input_refused',
    'secret_or_real_provider_input_refused',
    'secret_or_real_provider_input_refused',
    'd1_binding_or_private_identifier_refused',
    'd1_binding_or_private_identifier_refused',
    'production_or_non_local_url_refused',
    'production_or_non_local_url_refused',
    'production_or_non_local_url_refused',
    'production_or_non_local_url_refused',
    'production_or_non_local_url_refused',
    'production_or_non_local_url_refused',
    'production_or_non_local_url_refused',
  ]);
  assert.ok(blockers.every((blocker) => blocker.status === 'HOLD'));
  assert.equal(JSON.stringify(blockers).includes('real-token-must-not-be-read'), false);
  assert.equal(JSON.stringify(blockers).includes('github-token-must-not-be-read'), false);
  assert.equal(JSON.stringify(blockers).includes('private-db-id'), false);
  assert.equal(JSON.stringify(blockers).includes('b2b-lead-trigger.example.com'), false);
});

test('Level 1 proof preflight refuses auth header and access credential-shaped env poison', () => {
  const blockers = findLevel1ProofPreflightBlockers({
    env: {
      LEVEL1_PROOF_PREFLIGHT_ENV: 'local_test',
      WORKER_ENV: 'local',
      AUTHORIZATION: 'Bearer synthetic-auth-header',
      AUTHORIZATION_HEADER: 'Bearer synthetic-auth-header-alias',
      HTTP_AUTHORIZATION: 'Bearer synthetic-http-auth-header',
      CLOUDFLARE_API_KEY: 'synthetic-cloudflare-api-key',
      CF_ACCESS_CLIENT_ID: 'synthetic-access-client-id',
      CF_ACCESS_CLIENT_SECRET: 'synthetic-access-client-secret',
      CF_ACCESS_AUD: 'synthetic-access-audience',
      CLOUDFLARE_ACCESS_CLIENT_ID: 'synthetic-cloudflare-access-client-id',
      CLOUDFLARE_ACCESS_CLIENT_SECRET: 'synthetic-cloudflare-access-client-secret',
      D1_DATABASE_ID: 'synthetic-d1-database-id',
    },
  });

  assert.deepEqual(blockers.map((blocker) => blocker.key).sort(), [
    'AUTHORIZATION',
    'AUTHORIZATION_HEADER',
    'CF_ACCESS_AUD',
    'CF_ACCESS_CLIENT_ID',
    'CF_ACCESS_CLIENT_SECRET',
    'CLOUDFLARE_ACCESS_CLIENT_ID',
    'CLOUDFLARE_ACCESS_CLIENT_SECRET',
    'CLOUDFLARE_API_KEY',
    'D1_DATABASE_ID',
    'HTTP_AUTHORIZATION',
  ]);
  assert.ok(blockers.some((blocker) => blocker.key === 'D1_DATABASE_ID' && blocker.reason === 'd1_binding_or_private_identifier_refused'));
  assert.ok(blockers.filter((blocker) => blocker.key !== 'D1_DATABASE_ID').every((blocker) => blocker.reason === 'secret_or_real_provider_input_refused'));
  assert.ok(blockers.every((blocker) => blocker.status === 'HOLD'));
  assert.equal(JSON.stringify(blockers).includes('synthetic-auth-header'), false);
  assert.equal(JSON.stringify(blockers).includes('synthetic-access-client-secret'), false);
  assert.equal(JSON.stringify(blockers).includes('synthetic-d1-database-id'), false);
});

test('Level 1 proof preflight allows ambient GitHub Actions metadata env', () => {
  const blockers = findLevel1ProofPreflightBlockers({
    env: {
      LEVEL1_PROOF_PREFLIGHT_ENV: 'local_test',
      WORKER_ENV: 'local',
      GITHUB_ENV: '/home/runner/work/_temp/_runner_file_commands/set_env',
      GITHUB_API_URL: 'https://api.github.com',
      GITHUB_SERVER_URL: 'https://github.com',
      GITHUB_GRAPHQL_URL: 'https://api.github.com/graphql',
      RUNNER_ENVIRONMENT: 'github-hosted',
    },
  });

  assert.deepEqual(blockers, []);
});

test('Level 1 proof preflight redacted fixture helper has no raw note provider or generated suggestion material', () => {
  const evidence = buildLevel1RedactedFixtureEvidence();

  assert.equal(evidence.manualNoteBodyText, '[REDACTED]');
  assert.equal(evidence.generatedSuggestionText, '[REDACTED]');
  assert.equal(evidence.token, '[REDACTED]');
  assert.equal(evidence.providerInput, '[REDACTED]');
  assert.equal(evidence.adapterSecret, '[REDACTED]');
  assert.equal(evidence.noteBody, '[REDACTED]');
  assert.equal(evidence.rawSessionClaims, '[REDACTED]');
  assert.equal(evidence.nested.authHeader, '[REDACTED]');
  assert.equal(evidence.nested.generatedHelperText, '[REDACTED]');
  assert.equal(evidence.nested.safeCheck, 'protected fields omitted');
});

test('Level 1 proof preflight CLI writes the reviewer evidence artifact', () => {
  const dir = mkdtempSync(join(tmpdir(), 'level1-proof-preflight-'));
  const outputPath = join(dir, 'evidence.json');
  const scriptPath = fileURLToPath(new URL('../../scripts/level1-proof-preflight.mjs', import.meta.url));

  try {
    const result = spawnSync(process.execPath, [
      scriptPath,
      '--json',
      '--output',
      outputPath,
    ], {
      encoding: 'utf8',
      env: {
        PATH: process.env.PATH || '',
        LEVEL1_PROOF_PREFLIGHT_ENV: 'local_test',
        WORKER_ENV: 'local',
      },
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const artifact = JSON.parse(readFileSync(outputPath, 'utf8'));
    assert.equal(artifact.documentStatus, 'LEVEL1_PROOF_PREFLIGHT_AUTOMATION_NON_PRODUCTION');
    assert.equal(artifact.status, 'PASS');
    assert.equal(artifact.boundary, 'NOT_PRODUCTION_EVIDENCE');
    assert.equal(artifact.productionReady, false);
    assert.equal(artifact.notProductionEvidence, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
