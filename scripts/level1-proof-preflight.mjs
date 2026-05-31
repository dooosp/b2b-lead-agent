#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  buildLevel1LocalD1ObservationMetadata,
  buildLevel1ReadinessScorecard,
  buildLevel1RollbackStopWriteGuard,
  redactLevel1EvidenceRecord,
} from '../worker/lib/level1-readiness-guards.js';
import { AUTH_PROVIDER_SESSION_SCAFFOLD_PROVIDER_ENV } from '../worker/lib/auth-provider-session-scaffold.js';

const LOCAL_ENV_VALUES = new Set(['local', 'test', 'local_test', 'local-test', 'non_production', 'non-production']);
const ENVIRONMENT_KEYS = Object.freeze([
  'LEVEL1_PROOF_PREFLIGHT_ENV',
  'WORKER_ENV',
  'DEPLOYMENT_ENV',
  'APP_ENV',
  'ENVIRONMENT',
  'CF_ENV',
  'NODE_ENV',
  'WRANGLER_ENV',
  'CLOUDFLARE_ENV',
]);
const SECRET_KEYS = Object.freeze([
  'API_TOKEN',
  'INTERNAL_API_TOKEN',
  'TRIGGER_PASSWORD',
  'AUTHORIZATION',
  'AUTHORIZATION_HEADER',
  'HTTP_AUTHORIZATION',
  'AUTH_TOKEN',
  'SESSION_TOKEN',
  'JWT',
  'JWT_SECRET',
  'COOKIE',
  'GITHUB_TOKEN',
  'GH_TOKEN',
  'GITHUB_PAT',
  'CLOUDFLARE_API_KEY',
  'CLOUDFLARE_API_TOKEN',
  'CF_API_KEY',
  'CF_API_TOKEN',
  'CF_ACCESS_AUD',
  'CF_ACCESS_CLIENT_ID',
  'CF_ACCESS_CLIENT_SECRET',
  'CLOUDFLARE_ACCESS_AUD',
  'CLOUDFLARE_ACCESS_CLIENT_ID',
  'CLOUDFLARE_ACCESS_CLIENT_SECRET',
  'WRANGLER_API_TOKEN',
  'GEMINI_API_KEY',
  'GMAIL_PASS',
  'CALLBACK_TOKEN',
  AUTH_PROVIDER_SESSION_SCAFFOLD_PROVIDER_ENV,
]);
const SECRET_KEY_PATTERNS = Object.freeze([
  /^authorization(?:_header)?$/i,
  /^http_authorization$/i,
  /^cf_access_/i,
  /^cloudflare_access_/i,
  /^cf_api_/i,
  /^cloudflare_api_(?:key|token)$/i,
  /^(?:auth|session|callback)_(?:token|secret)$/i,
  /^jwt(?:_secret)?$/i,
]);
const D1_KEYS = Object.freeze([
  'DB',
  'D1',
  'D1_BINDING',
  'D1_DATABASE',
  'D1_DATABASE_ID',
  'DATABASE_ID',
  'CLOUDFLARE_ACCOUNT_ID',
  'CLOUDFLARE_D1_DATABASE_ID',
]);
const D1_KEY_PATTERNS = Object.freeze([
  /^d1(?:_|$)/i,
  /(?:^|_)d1(?:_|$)/i,
  /database[_-]?id/i,
  /account[_-]?id/i,
  /d1.*binding/i,
]);
const URL_KEYS = Object.freeze([
  'LEVEL1_PROOF_PREFLIGHT_URL',
  'WORKER_ORIGIN',
  'WORKER_HOSTNAME',
  'CF_WORKER_HOSTNAME',
  'HOSTNAME',
  'PUBLIC_HOSTNAME',
  'BASE_URL',
  'API_URL',
  'ENDPOINT_URL',
  'PREVIEW_URL',
  'STAGING_URL',
  'PRODUCTION_URL',
]);
const ENVIRONMENT_KEY_PATTERNS = Object.freeze([
  /^(?:LEVEL1|WORKER|DEPLOYMENT|APP|CF|NODE|WRANGLER|CLOUDFLARE)_(?:ENV|ENVIRONMENT)$/i,
]);
const URL_KEY_PATTERNS = Object.freeze([
  /^(?:LEVEL1|WORKER|CF_WORKER|PUBLIC|BASE|API|ENDPOINT|PREVIEW|STAGING|PRODUCTION|APP)(?:_[A-Z0-9]+)*(?:_URL|_URI|_ORIGIN|_HOSTNAME|_HOST|_ENDPOINT)$/i,
]);

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function isLocalEnvironmentValue(value) {
  if (!hasValue(value)) return true;
  return LOCAL_ENV_VALUES.has(normalize(value));
}

function isLocalOrSyntheticUrl(value) {
  if (!hasValue(value)) return true;
  const raw = String(value).trim();
  const hasHttpScheme = /^https?:\/\//i.test(raw);
  const localBareHostname = /^(localhost|127\.0\.0\.1|\[?::1\]?|synthetic\.example)(?::\d+)?(?:\/.*)?$/i.test(raw)
    || /^[a-z0-9.-]+\.test(?::\d+)?(?:\/.*)?$/i.test(raw);
  if (!hasHttpScheme && !localBareHostname) return false;

  const candidate = hasHttpScheme ? raw : `http://${raw}`;
  let url;
  try {
    url = new URL(candidate);
  } catch {
    return false;
  }
  const hostname = url.hostname.toLowerCase();
  return hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname === '[::1]'
    || hostname === '::1'
    || hostname.endsWith('.test')
    || hostname === 'synthetic.example';
}

function collectRefusal(blockers, reason, key, detail) {
  if (blockers.some((blocker) => blocker.reason === reason && blocker.key === key)) return;
  blockers.push({
    reason,
    key,
    detail,
    status: 'HOLD',
  });
}

function matchesAnyPattern(key, patterns) {
  return patterns.some((pattern) => pattern.test(String(key || '')));
}

export function findLevel1ProofPreflightBlockers({ env = {}, urls = [] } = {}) {
  const blockers = [];

  for (const key of ENVIRONMENT_KEYS) {
    if (!isLocalEnvironmentValue(env[key])) {
      collectRefusal(blockers, 'non_local_environment_refused', key, String(env[key]));
    }
  }

  for (const key of SECRET_KEYS) {
    if (hasValue(env[key])) {
      collectRefusal(blockers, 'secret_or_real_provider_input_refused', key, '[REDACTED]');
    }
  }

  for (const key of D1_KEYS) {
    if (hasValue(env[key])) {
      collectRefusal(blockers, 'd1_binding_or_private_identifier_refused', key, '[REDACTED]');
    }
  }

  for (const key of URL_KEYS) {
    if (hasValue(env[key]) && !isLocalOrSyntheticUrl(env[key])) {
      collectRefusal(blockers, 'production_or_non_local_url_refused', key, '[REDACTED]');
    }
  }

  for (const key of Object.keys(env || {})) {
    if (!hasValue(env[key])) continue;
    if (matchesAnyPattern(key, ENVIRONMENT_KEY_PATTERNS) && !isLocalEnvironmentValue(env[key])) {
      collectRefusal(blockers, 'non_local_environment_refused', key, String(env[key]));
    }
    if (matchesAnyPattern(key, SECRET_KEY_PATTERNS)) {
      collectRefusal(blockers, 'secret_or_real_provider_input_refused', key, '[REDACTED]');
    }
    if (matchesAnyPattern(key, D1_KEY_PATTERNS)) {
      collectRefusal(blockers, 'd1_binding_or_private_identifier_refused', key, '[REDACTED]');
    }
    if (matchesAnyPattern(key, URL_KEY_PATTERNS) && !isLocalOrSyntheticUrl(env[key])) {
      collectRefusal(blockers, 'production_or_non_local_url_refused', key, '[REDACTED]');
    }
  }

  for (const [index, url] of urls.entries()) {
    if (!isLocalOrSyntheticUrl(url)) {
      collectRefusal(blockers, 'production_or_non_local_url_refused', `urls[${index}]`, '[REDACTED]');
    }
  }

  return blockers;
}

function optionValue(flag, argv = process.argv) {
  const index = argv.indexOf(flag);
  if (index < 0) return '';
  return argv[index + 1] || '';
}

export function buildLevel1RedactedFixtureEvidence() {
  return redactLevel1EvidenceRecord({
    fixtureId: 'synthetic-level1-local-proof-preflight',
    source: 'local_fixture_only',
    route: '/api/leads',
    url: 'https://synthetic.example/level1/local-proof-preflight',
    status: 'PASS',
    manualNoteBodyText: 'Synthetic manual note body must never appear in emitted evidence.',
    generatedSuggestionText: 'Synthetic generated suggestion must never appear in emitted evidence.',
    providerInput: 'Synthetic provider input must never appear in emitted evidence.',
    adapterSecret: 'Synthetic adapter secret must never appear in emitted evidence.',
    noteBody: 'Synthetic note body alias must never appear in emitted evidence.',
    rawSessionClaims: {
      role: 'reviewer',
      token: 'nested-session-token',
    },
    token: 'synthetic-token-must-redact',
    nested: {
      authHeader: 'Bearer synthetic-secret',
      generatedHelperText: 'Nested generated helper text must redact.',
      safeCheck: 'protected fields omitted',
    },
  });
}

export function evaluateLevel1ProofPreflight(input = {}) {
  const env = {
    LEVEL1_PROOF_PREFLIGHT_ENV: 'local_test',
    ...(input.env || {}),
  };
  const blockers = findLevel1ProofPreflightBlockers({ env, urls: input.urls || [] });
  const ok = blockers.length === 0;
  const localStatus = ok ? 'PASS' : 'HOLD';

  return {
    ok,
    blockers,
    evidence: {
      documentStatus: 'LEVEL1_PROOF_PREFLIGHT_AUTOMATION_NON_PRODUCTION',
      status: localStatus,
      evidenceType: 'REDACTED_SYNTHETIC_FIXTURE_ONLY',
      boundary: 'NOT_PRODUCTION_EVIDENCE',
      notProductionEvidence: true,
      productionReady: false,
      productionReviewerWorkflowReady: false,
      refusedProductionInputs: blockers,
      gates: [
        { id: 'local_environment', status: localStatus },
        { id: 'no_secrets_or_real_provider_inputs', status: localStatus },
        { id: 'no_d1_binding_or_private_identifier', status: localStatus },
        { id: 'no_production_or_staging_urls', status: localStatus },
        { id: 'production_proof_approval', status: 'HOLD' },
      ],
      redactedFixtureEvidence: buildLevel1RedactedFixtureEvidence(),
      localD1ObservationMetadata: buildLevel1LocalD1ObservationMetadata(),
      rollbackGuard: buildLevel1RollbackStopWriteGuard('level1_local_preflight_blocker'),
      readinessScorecard: buildLevel1ReadinessScorecard({
        authProviderSessionScaffold: localStatus,
        localProofSimulation: localStatus,
        d1SchemaGuard: localStatus,
        rollbackGuard: localStatus,
        privacyGuard: localStatus,
        productionProofApproval: 'HOLD',
      }),
      nonClaims: [
        'This is not production proof.',
        'This does not access production/staging D1, endpoints, logs, secrets, auth material, customer/private data, CRM, outreach, LLM, or automation.',
        'productionReady remains false.',
      ],
    },
  };
}

function runCli() {
  const result = evaluateLevel1ProofPreflight({ env: process.env });
  const output = process.argv.includes('--json')
    ? JSON.stringify(result.evidence, null, 2)
    : [
      `LEVEL1_PROOF_PREFLIGHT_AUTOMATION_NON_PRODUCTION: ${result.evidence.status}`,
      `productionReady: ${result.evidence.productionReady}`,
      `notProductionEvidence: ${result.evidence.notProductionEvidence}`,
      `refusals: ${result.blockers.length}`,
    ].join('\n');
  const outputPath = optionValue('--output');
  if (outputPath) {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(result.evidence, null, 2)}\n`);
  }
  console.log(output);
  if (!result.ok) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli();
}
