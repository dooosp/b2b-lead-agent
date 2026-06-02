import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  evaluateLevel1ChangeControlManifest,
  validateLevel1ChangeControlManifest,
} from '../../scripts/level1-production-proof-change-control-manifest.mjs';

const COMPLETE_MANIFEST = Object.freeze({
  schemaVersion: 'level1.production_proof_change_control_manifest.v1',
  documentStatus: 'LEVEL1_PRODUCTION_PROOF_CHANGE_CONTROL_MANIFEST_NON_PRODUCTION',
  repo: 'dooosp/b2b-lead-agent',
  baseline: {
    branch: 'master',
    headSha: 'c61317144f5adb77516412af30e26925f1a97146',
    mergedPrs: [171, 172, 173, 174, 175, 176, 177],
  },
  boundary: 'NOT_PRODUCTION_EVIDENCE',
  notProductionEvidence: true,
  productionReady: false,
  productionReviewerWorkflowReady: false,
  approvalStatus: 'HOLD_PENDING_SEPARATE_EXPLICIT_FUTURE_PROOF_GOAL',
  issueRefs: {
    privacy: 'https://github.com/dooosp/b2b-lead-agent/issues/154',
    authProviderSession: 'https://github.com/dooosp/b2b-lead-agent/issues/162',
    productionD1Observation: 'https://github.com/dooosp/b2b-lead-agent/issues/163',
    rollbackStopWrite: 'https://github.com/dooosp/b2b-lead-agent/issues/164',
    finalProofApproval: 'https://github.com/dooosp/b2b-lead-agent/issues/165',
    reviewerFeedback: 'https://github.com/dooosp/b2b-lead-agent/issues/144',
  },
  changeControl: {
    owner: '@dooosp / Taeho Jang',
    reviewer: '@dooosp / Taeho Jang',
    operator: 'NO_OPERATOR_APPROVED_FOR_EXECUTION_NOW',
    executionWindow: {
      startsAt: 'NO_WINDOW_APPROVED_FOR_EXECUTION_NOW',
      expiresAt: 'NO_WINDOW_APPROVED_FOR_EXECUTION_NOW',
      timezone: 'UTC',
    },
  },
  approvalRecord: {
    sourceIssue: 165,
    sourceUrl: 'https://github.com/dooosp/b2b-lead-agent/issues/165#issuecomment-4525359304',
    status: 'NO_NOT_UNTIL_SEPARATE_EXPLICIT_FUTURE_PROOF_GOAL',
    approvedAt: 'NO_APPROVAL_RECORDED',
    expiresAt: 'NO_APPROVAL_RECORDED',
  },
  command: {
    executionMode: 'NON_EXECUTABLE_DRY_RUN_ONLY',
    allowlist: ['NONE_APPROVED_FOR_EXECUTION_NOW'],
    denylist: [
      'deploy',
      'wrangler d1 execute --remote',
      'curl production or staging endpoint',
      'destructive SQL',
    ],
  },
  endpoint: {
    boundary: 'NONE_APPROVED_FOR_EXECUTION_NOW',
    allowedEndpoints: ['NONE_APPROVED_FOR_EXECUTION_NOW'],
    broadEndpointsAllowed: false,
  },
  d1: {
    bindingLabelNonSecret: 'DB / b2b-leads-db planning label only',
    databaseId: 'NOT_RECORDED_NO_DATABASE_ID_ALLOWED',
    schemaObservationApprovedNow: false,
    writeOrMigrationApprovedNow: false,
  },
  fixture: {
    policy: 'SYNTHETIC_OR_APPROVED_NON_CUSTOMER_ONLY',
    fixtureId: 'NO_FIXTURE_APPROVED_FOR_EXECUTION_NOW',
    customerDataAllowed: false,
  },
  rollback: {
    owner: '@dooosp / Taeho Jang',
    stopWriteTrigger: 'Stop writes on protected-field leakage, generated-suggestion persistence, redaction failure, D1 boundary drift, endpoint exposure, or unapproved production access.',
    nonDestructiveBackoutFirst: true,
    rollbackExecutionApproved: false,
    destructiveDataActionApproved: false,
  },
  redaction: {
    required: true,
    rules: [
      'Redact secrets, tokens, cookies, auth headers, JWT/session claims, account ids, database ids, private URLs, names, emails, user ids, customer payloads, manual note body text, generated suggestion text, CRM/outreach data, logs, and private lead/person fields.',
    ],
  },
  abortConditions: [
    'Abort without a separate explicit future production proof goal.',
    'Abort on production/staging endpoint, D1, log, secret, customer/private data, real auth material, generated suggestion persistence, or destructive action requirement.',
  ],
  evidence: {
    destination: 'docs/roadmap/b2b-lead-agent-level-1-production-proof-evidence.md',
    redactedOnly: true,
    writeApprovedNow: false,
  },
});

test('Level 1 change-control manifest validates and produces a redacted non-executable dry-run plan', () => {
  const result = evaluateLevel1ChangeControlManifest({
    manifest: COMPLETE_MANIFEST,
    now: new Date('2026-05-31T12:00:00.000Z'),
  });
  const serialized = JSON.stringify(result);

  assert.equal(result.ok, true);
  assert.equal(result.validation.ok, true);
  assert.deepEqual(result.validation.blockers, []);
  assert.equal(result.plan.documentStatus, 'LEVEL1_PRODUCTION_PROOF_CHANGE_CONTROL_DRY_RUN_PLAN_NON_PRODUCTION');
  assert.equal(result.plan.boundary, 'NOT_PRODUCTION_EVIDENCE');
  assert.equal(result.plan.notProductionEvidence, true);
  assert.equal(result.plan.productionReady, false);
  assert.equal(result.plan.productionReviewerWorkflowReady, false);
  assert.equal(result.plan.approvalStatus, 'HOLD_PENDING_SEPARATE_EXPLICIT_FUTURE_PROOF_GOAL');
  assert.deepEqual(result.plan.gates.map((gate) => [gate.id, gate.status]), [
    ['manifest_schema', 'PASS'],
    ['local_non_executable_boundary', 'PASS'],
    ['approval_record', 'PASS'],
    ['production_proof_approval', 'HOLD'],
  ]);
  assert.ok(result.plan.nonExecutableSteps.every((step) => step.nonExecutable === true));
  assert.ok(result.plan.nonExecutableSteps.every((step) => step.action === 'REVIEW_ONLY_DO_NOT_EXECUTE'));
  assert.equal(serialized.includes('token-must-not-appear'), false);
});

test('Level 1 change-control manifest refuses unsafe approval, endpoint, D1, auth, rollback, and SQL values', () => {
  const unsafe = {
    ...COMPLETE_MANIFEST,
    productionReady: true,
    endpoint: {
      ...COMPLETE_MANIFEST.endpoint,
      allowedEndpoints: ['*', 'https://b2b-lead-trigger.workers.dev/api/leads'],
      broadEndpointsAllowed: true,
    },
    d1: {
      ...COMPLETE_MANIFEST.d1,
      databaseId: 'private-database-id-123',
      d1DatabaseIdAlias: 'd1_database_id=abc123',
      D1_DATABASE_ID: 'redacted-alias-still-forbidden',
    },
    command: {
      ...COMPLETE_MANIFEST.command,
      allowlist: [
        'cd worker && npx wrangler d1 execute b2b-leads-db --remote --command "DROP TABLE leads;"',
      ],
    },
    rollback: {
      ...COMPLETE_MANIFEST.rollback,
      owner: '',
      stopWriteTrigger: '',
      rollbackExecutionApproved: true,
    },
    approvalRecord: {
      ...COMPLETE_MANIFEST.approvalRecord,
      status: 'APPROVED_FOR_FUTURE_PROOF_BY_SEPARATE_GOAL',
      approvedAt: '2026-05-01T00:00:00.000Z',
      expiresAt: '2026-05-02T00:00:00.000Z',
    },
    rawAuth: {
      token: 'token-must-not-appear',
    },
  };

  const validation = validateLevel1ChangeControlManifest(unsafe, {
    now: new Date('2026-05-31T12:00:00.000Z'),
  });
  const reasons = validation.blockers.map((blocker) => blocker.reason);
  const serialized = JSON.stringify(validation);

  assert.equal(validation.ok, false);
  assert.ok(reasons.includes('production_ready_true_refused'));
  assert.ok(reasons.includes('unexpected_manifest_field_refused'));
  assert.ok(reasons.includes('secret_or_raw_auth_refused'));
  assert.ok(reasons.includes('production_like_value_refused'));
  assert.ok(reasons.includes('broad_endpoint_refused'));
  assert.ok(reasons.includes('d1_private_identifier_refused'));
  assert.ok(reasons.includes('destructive_sql_refused'));
  assert.ok(reasons.includes('rollback_missing_or_unsafe'));
  assert.ok(reasons.includes('stale_approval_refused'));
  assert.equal(serialized.includes('token-must-not-appear'), false);
});

test('Level 1 change-control manifest refuses missing future approval records', () => {
  const missingApproval = {
    ...COMPLETE_MANIFEST,
    approvalRecord: {
      sourceIssue: 165,
      sourceUrl: '',
      status: 'APPROVED_FOR_FUTURE_PROOF_BY_SEPARATE_GOAL',
      approvedAt: '2026-05-31T12:00:00.000Z',
      expiresAt: '2026-06-01T12:00:00.000Z',
    },
  };

  const validation = validateLevel1ChangeControlManifest(missingApproval, {
    now: new Date('2026-05-31T12:00:00.000Z'),
  });
  const reasons = validation.blockers.map((blocker) => blocker.reason);

  assert.equal(validation.ok, false);
  assert.ok(reasons.includes('missing_or_ambiguous_required_value'));
});

test('Level 1 change-control manifest CLI writes only a NOT_PRODUCTION_EVIDENCE dry-run plan', () => {
  const dir = mkdtempSync(join(tmpdir(), 'level1-change-control-'));
  const manifestPath = join(dir, 'manifest.json');
  const outputPath = join(dir, 'plan.json');

  try {
    writeFileSync(manifestPath, `${JSON.stringify(COMPLETE_MANIFEST, null, 2)}\n`);

    const result = spawnSync(process.execPath, [
      'scripts/level1-production-proof-change-control-manifest.mjs',
      '--manifest',
      manifestPath,
      '--json',
      '--output',
      outputPath,
    ], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        LEVEL1_CHANGE_CONTROL_NOW: '2026-05-31T12:00:00.000Z',
      },
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);

    const plan = JSON.parse(readFileSync(outputPath, 'utf8'));
    assert.equal(plan.boundary, 'NOT_PRODUCTION_EVIDENCE');
    assert.equal(plan.notProductionEvidence, true);
    assert.equal(plan.productionReady, false);
    assert.equal(plan.gates.some((gate) => gate.id === 'production_proof_approval' && gate.status === 'HOLD'), true);
    assert.equal(JSON.stringify(plan).includes('token-must-not-appear'), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
