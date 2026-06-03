import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  LEVEL1_APPROVAL_INTAKE_GATE_STATUS,
  REQUIRED_APPROVAL_INTAKE_FIELD_IDS,
  buildLevel1ApprovalIntakeGateArtifact,
  buildLevel1ApprovalIntakeRequestTemplate,
  renderLevel1ApprovalIntakeMarkdown,
  validateLevel1ApprovalIntakeRequest,
} from '../../scripts/level1-production-proof-approval-intake-gate.mjs';

const COMPLETE_REQUEST = Object.freeze({
  schemaVersion: 'level1.production_proof_approval_intake_request.v1',
  repo: 'dooosp/b2b-lead-agent',
  issue: 165,
  boundary: 'NOT_PRODUCTION_EVIDENCE',
  notProductionEvidence: true,
  productionReady: false,
  productionReviewerWorkflowReady: false,
  proofExecutionApproved: false,
  target: 'Cloudflare Worker production target b2b-lead-trigger planning label only',
  commandAllowlist: [
    'node scripts/level1-proof-preflight.mjs --json',
    'node scripts/level1-production-proof-approval-intake-gate.mjs --json',
  ],
  endpointBoundary: [
    '/leads reviewer page only if separately approved later',
    '/api/leads metadata only if separately approved later',
  ],
  d1Boundary: 'No D1 access is approved by this intake request; future request must restate exact schema-observation boundary separately.',
  fixtureNonCustomerDataPolicy: 'Synthetic fixtures or approved non-customer metadata only; no customer rows, payloads, real manual note text, private lead/person fields, logs, secrets, CRM, outreach, or LLM data.',
  evidenceRedaction: 'Redact secrets, tokens, cookies, auth headers, JWT/session claims, account IDs, database IDs, private URLs, names, emails, user IDs, customer payloads, manual note body text, generated suggestion text, CRM/outreach data, logs, and private lead/person fields.',
  rollbackOwner: '@dooosp / Taeho Jang',
  stopConditions: [
    'Stop if any request would deploy, access staging or production, call endpoints, access D1, read logs or secrets, use customer/private data, run destructive SQL, persist generated suggestions, call CRM/outreach/LLM/automation, or exceed the approved future scope.',
  ],
  approver: '@dooosp / Taeho Jang',
  expiresAt: '2026-06-10T00:00:00.000Z',
});

const NOW = new Date('2026-06-03T00:00:00.000Z');

function reasons(validation) {
  return validation.blockers.map((blocker) => blocker.reason);
}

test('Level 1 approval intake template names every required Issue #165 field and stays non-executable', () => {
  const template = buildLevel1ApprovalIntakeRequestTemplate({
    generatedAt: '2026-06-03T00:00:00.000Z',
  });
  const artifact = buildLevel1ApprovalIntakeGateArtifact({
    generatedAt: '2026-06-03T00:00:00.000Z',
    request: COMPLETE_REQUEST,
    now: NOW,
  });
  const markdown = renderLevel1ApprovalIntakeMarkdown(artifact);

  assert.equal(template.documentStatus, LEVEL1_APPROVAL_INTAKE_GATE_STATUS);
  assert.equal(template.boundary, 'NOT_PRODUCTION_EVIDENCE');
  assert.equal(template.notProductionEvidence, true);
  assert.equal(template.productionReady, false);
  assert.equal(template.productionReviewerWorkflowReady, false);
  assert.equal(template.nonExecutable, true);
  assert.deepEqual(template.baseline.mergedPrs, [171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183]);
  assert.deepEqual(template.requiredApprovalFields.map((field) => field.id), REQUIRED_APPROVAL_INTAKE_FIELD_IDS);
  assert.equal(artifact.requestValidation.ok, true);
  assert.equal(artifact.proofExecutionApproved, false);
  assert.equal(artifact.issue165.status, 'OPEN_HOLD_PENDING_MACHINE_CHECKABLE_HUMAN_INPUT');
  assert.match(markdown, /LEVEL1_PRODUCTION_PROOF_APPROVAL_INTAKE_GATE_NON_PRODUCTION/);
  assert.match(markdown, /target/);
  assert.match(markdown, /command_allowlist/);
  assert.match(markdown, /endpoint_boundary/);
  assert.match(markdown, /d1_boundary/);
  assert.match(markdown, /fixture_non_customer_data_policy/);
  assert.match(markdown, /evidence_redaction/);
  assert.match(markdown, /rollback_owner/);
  assert.match(markdown, /stop_conditions/);
  assert.match(markdown, /approver/);
  assert.match(markdown, /expires_at/);
  assert.doesNotMatch(markdown, /productionReady: `true`/);
  assert.doesNotMatch(markdown, /production proof executed/i);
});

test('Level 1 approval intake validator accepts complete non-executing requests while keeping proof blocked', () => {
  const validation = validateLevel1ApprovalIntakeRequest(COMPLETE_REQUEST, { now: NOW });

  assert.equal(validation.ok, true);
  assert.equal(validation.status, 'PASS_LOCAL_INTAKE_REQUEST_MACHINE_CHECKABLE_HOLD_PRODUCTION');
  assert.equal(validation.productionReady, false);
  assert.equal(validation.productionReviewerWorkflowReady, false);
  assert.equal(validation.proofExecutionApproved, false);
  assert.deepEqual(validation.blockers, []);
  assert.equal(JSON.stringify(validation).includes('Authorization: Bearer'), false);
});

test('Level 1 approval intake validator fails closed for missing vague stale and contradictory inputs', () => {
  const missing = { ...COMPLETE_REQUEST };
  delete missing.target;
  const vague = {
    ...COMPLETE_REQUEST,
    target: 'TBD',
    commandAllowlist: ['any'],
  };
  const stale = {
    ...COMPLETE_REQUEST,
    expiresAt: '2026-06-01T00:00:00.000Z',
  };
  const contradictory = {
    ...COMPLETE_REQUEST,
    productionReady: true,
    productionReviewerWorkflowReady: true,
    proofExecutionApproved: true,
    logsSecretsAllowed: true,
    customerDataAllowed: true,
  };

  assert.ok(reasons(validateLevel1ApprovalIntakeRequest(missing, { now: NOW })).includes('missing_required_approval_field'));
  assert.ok(reasons(validateLevel1ApprovalIntakeRequest(vague, { now: NOW })).includes('vague_approval_field_refused'));
  assert.ok(reasons(validateLevel1ApprovalIntakeRequest(stale, { now: NOW })).includes('stale_or_expired_approval_refused'));
  assert.ok(reasons(validateLevel1ApprovalIntakeRequest(contradictory, { now: NOW })).includes('production_ready_claim_refused'));
  assert.ok(reasons(validateLevel1ApprovalIntakeRequest(contradictory, { now: NOW })).includes('contradictory_approval_refused'));
});

test('Level 1 approval intake validator refuses secrets broad endpoints destructive SQL and customer data', () => {
  const unsafe = {
    ...COMPLETE_REQUEST,
    commandAllowlist: [
      'cd worker && npx wrangler d1 execute b2b-leads-db --remote --command "DROP TABLE leads;"',
    ],
    endpointBoundary: ['*', '/api/*'],
    d1Boundary: 'database_id=abc123privatevalue',
    fixtureNonCustomerDataPolicy: 'Use customer rows and customer payloads for proof.',
    evidenceRedaction: 'Authorization: Bearer token-must-not-leak',
    rawAuth: {
      token: 'token-must-not-leak',
    },
  };
  const validation = validateLevel1ApprovalIntakeRequest(unsafe, { now: NOW });
  const serialized = JSON.stringify(validation);

  assert.equal(validation.ok, false);
  assert.ok(reasons(validation).includes('production_like_command_refused'));
  assert.ok(reasons(validation).includes('destructive_sql_refused'));
  assert.ok(reasons(validation).includes('broad_endpoint_refused'));
  assert.ok(reasons(validation).includes('d1_private_identifier_refused'));
  assert.ok(reasons(validation).includes('secret_like_input_refused'));
  assert.ok(reasons(validation).includes('customer_data_input_refused'));
  assert.equal(serialized.includes('token-must-not-leak'), false);
  assert.equal(serialized.includes('abc123privatevalue'), false);
});

test('Level 1 approval intake CLI writes redacted NOT_PRODUCTION_EVIDENCE JSON and Markdown artifacts', () => {
  const dir = mkdtempSync(join(tmpdir(), 'level1-approval-intake-'));
  const requestPath = join(dir, 'request.json');
  const outputPath = join(dir, 'intake.json');
  const markdownPath = join(dir, 'intake.md');

  try {
    writeFileSync(requestPath, `${JSON.stringify(COMPLETE_REQUEST, null, 2)}\n`);
    const result = spawnSync(process.execPath, [
      'scripts/level1-production-proof-approval-intake-gate.mjs',
      '--request',
      requestPath,
      '--json',
      '--output',
      outputPath,
      '--markdown-output',
      markdownPath,
      '--now',
      '2026-06-03T00:00:00.000Z',
    ], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, new RegExp(LEVEL1_APPROVAL_INTAKE_GATE_STATUS));

    const artifact = JSON.parse(readFileSync(outputPath, 'utf8'));
    const markdown = readFileSync(markdownPath, 'utf8');

    assert.equal(artifact.documentStatus, LEVEL1_APPROVAL_INTAKE_GATE_STATUS);
    assert.equal(artifact.boundary, 'NOT_PRODUCTION_EVIDENCE');
    assert.equal(artifact.productionReady, false);
    assert.equal(artifact.proofExecutionApproved, false);
    assert.equal(artifact.requestValidation.ok, true);
    assert.match(markdown, /Issue #165/);
    assert.match(markdown, /Reviewer Checklist/);
    assert.doesNotMatch(markdown, /productionReady: `true`/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
