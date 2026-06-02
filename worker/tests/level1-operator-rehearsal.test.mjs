import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  LEVEL1_CHANGE_CONTROL_MANIFEST_PATH,
} from '../../scripts/level1-production-proof-change-control-manifest.mjs';
import {
  evaluateLevel1OperatorRehearsal,
} from '../../scripts/level1-operator-rehearsal.mjs';

const FIXED_NOW = '2026-06-02T00:00:00.000Z';

function safeEnv(overrides = {}) {
  return {
    LEVEL1_PROOF_PREFLIGHT_ENV: 'local_test',
    WORKER_ENV: 'local',
    WORKER_ORIGIN: 'localhost:8787',
    ...overrides,
  };
}

function loadManifest(overrides = {}) {
  const manifest = JSON.parse(readFileSync(LEVEL1_CHANGE_CONTROL_MANIFEST_PATH, 'utf8'));
  return {
    ...manifest,
    ...overrides,
  };
}

function evaluate(overrides = {}) {
  return evaluateLevel1OperatorRehearsal({
    now: new Date(FIXED_NOW),
    env: safeEnv(),
    urls: ['http://localhost:8787/leads', 'https://synthetic.example/level1/operator-rehearsal'],
    ...overrides,
  });
}

test('Level 1 operator rehearsal consumes local approval and manifest gates into a blocked non-executable runbook', () => {
  const result = evaluate();
  const runbook = result.runbook;
  const serialized = JSON.stringify(runbook);

  assert.equal(result.ok, true);
  assert.equal(runbook.documentStatus, 'LEVEL1_OPERATOR_REHEARSAL_GATE_NON_PRODUCTION');
  assert.equal(runbook.status, 'PASS_LOCAL');
  assert.equal(runbook.boundary, 'NOT_PRODUCTION_EVIDENCE');
  assert.equal(runbook.notProductionEvidence, true);
  assert.equal(runbook.productionReady, false);
  assert.equal(runbook.productionReviewerWorkflowReady, false);
  assert.equal(runbook.proofStartBlocked, true);
  assert.deepEqual(runbook.gates.map((gate) => [gate.id, gate.status]), [
    ['proof_preflight', 'PASS'],
    ['approval_packet', 'PASS'],
    ['change_control_manifest', 'PASS'],
    ['rollback_stop_write', 'PASS'],
    ['privacy_redaction', 'PASS'],
    ['evidence_artifact', 'PASS'],
    ['production_proof_approval', 'HOLD'],
  ]);
  assert.equal(runbook.orderedSteps.length >= 7, true);
  assert.ok(runbook.orderedSteps.every((step) => step.action === 'REVIEW_ONLY_DO_NOT_EXECUTE'));
  assert.ok(runbook.orderedSteps.every((step) => step.nonExecutable === true));
  assert.equal(runbook.owners.rollbackOwner, '@dooosp / Taeho Jang');
  assert.ok(runbook.abortTriggers.some((trigger) => /production\/staging/i.test(trigger)));
  assert.ok(runbook.rollbackStopWriteChecklist.some((item) => /stop writes/i.test(item)));
  assert.ok(runbook.evidenceSlots.every((slot) => slot.status === 'EMPTY_PENDING_FUTURE_APPROVAL'));
  assert.equal(runbook.sourceArtifacts.approvalPacket.includes('approval-packet-non-production.md'), true);
  assert.equal(runbook.sourceArtifacts.changeControlManifest.includes('change-control-manifest-non-production.json'), true);
  assert.equal(serialized.includes('Synthetic manual note body'), false);
  assert.equal(serialized.includes('Synthetic generated suggestion'), false);
  assert.equal(serialized.includes('Bearer'), false);
  assert.equal(serialized.includes('token-must-not-appear'), false);
});

test('Level 1 operator rehearsal refuses unsafe proof-start inputs and keeps details redacted', () => {
  const baseManifest = loadManifest();
  const cases = [
    {
      name: 'missing approval',
      input: {
        manifest: {
          ...baseManifest,
          approvalRecord: {
            ...baseManifest.approvalRecord,
            sourceUrl: '',
          },
        },
      },
      reason: 'missing_or_ambiguous_required_value',
    },
    {
      name: 'stale approval',
      input: {
        manifest: {
          ...baseManifest,
          approvalRecord: {
            ...baseManifest.approvalRecord,
            status: 'APPROVED_FOR_FUTURE_PROOF_BY_SEPARATE_GOAL',
            approvedAt: '2026-05-01T00:00:00.000Z',
            expiresAt: '2026-05-02T00:00:00.000Z',
          },
        },
      },
      reason: 'stale_approval_refused',
    },
    {
      name: 'production or staging URL',
      input: {
        urls: ['https://staging.b2b-lead-trigger.example.com/api/leads'],
      },
      reason: 'production_or_non_local_url_refused',
    },
    {
      name: 'D1 binding or private id',
      input: {
        env: safeEnv({ D1_DATABASE_ID: 'd1-private-id-must-not-appear' }),
      },
      reason: 'd1_binding_or_private_identifier_refused',
      forbiddenText: 'd1-private-id-must-not-appear',
    },
    {
      name: 'secret token or raw auth',
      input: {
        env: safeEnv({ AUTHORIZATION: 'Bearer raw-auth-token-must-not-appear' }),
      },
      reason: 'secret_or_real_provider_input_refused',
      forbiddenText: 'raw-auth-token-must-not-appear',
    },
    {
      name: 'destructive SQL',
      input: {
        manifest: {
          ...baseManifest,
          command: {
            ...baseManifest.command,
            allowlist: ['DROP TABLE leads;'],
          },
        },
      },
      reason: 'destructive_sql_refused',
    },
    {
      name: 'broad endpoint',
      input: {
        manifest: {
          ...baseManifest,
          endpoint: {
            ...baseManifest.endpoint,
            allowedEndpoints: ['*'],
          },
        },
      },
      reason: 'broad_endpoint_refused',
    },
    {
      name: 'productionReady true',
      input: {
        manifest: {
          ...baseManifest,
          productionReady: true,
        },
      },
      reason: 'production_ready_true_refused',
    },
    {
      name: 'missing rollback owner',
      input: {
        manifest: {
          ...baseManifest,
          rollback: {
            ...baseManifest.rollback,
            owner: '',
          },
        },
      },
      reason: 'rollback_missing_or_unsafe',
    },
  ];

  for (const { name, input, reason, forbiddenText = '' } of cases) {
    const result = evaluate(input);
    const reasons = result.blockers.map((blocker) => blocker.reason);
    const serialized = JSON.stringify(result);

    assert.equal(result.ok, false, name);
    assert.equal(result.runbook.status, 'HOLD', name);
    assert.equal(result.runbook.proofStartBlocked, true, name);
    assert.ok(reasons.includes(reason), `${name}: ${reasons.join(', ')}`);
    assert.equal(result.runbook.productionReady, false, name);
    assert.equal(result.runbook.productionReviewerWorkflowReady, false, name);
    if (forbiddenText) {
      assert.equal(serialized.includes(forbiddenText), false, name);
    }
  }
});

test('Level 1 operator rehearsal CLI writes only a redacted NOT_PRODUCTION_EVIDENCE runbook', () => {
  const dir = mkdtempSync(join(tmpdir(), 'level1-operator-rehearsal-'));
  const outputPath = join(dir, 'runbook.json');
  const scriptPath = fileURLToPath(new URL('../../scripts/level1-operator-rehearsal.mjs', import.meta.url));

  try {
    const result = spawnSync(process.execPath, [
      scriptPath,
      '--json',
      '--output',
      outputPath,
    ], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        PATH: process.env.PATH || '',
        LEVEL1_OPERATOR_REHEARSAL_NOW: FIXED_NOW,
        LEVEL1_PROOF_PREFLIGHT_ENV: 'local_test',
        WORKER_ENV: 'local',
        WORKER_ORIGIN: 'localhost:8787',
      },
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const runbook = JSON.parse(readFileSync(outputPath, 'utf8'));
    const serialized = JSON.stringify(runbook);

    assert.equal(runbook.documentStatus, 'LEVEL1_OPERATOR_REHEARSAL_GATE_NON_PRODUCTION');
    assert.equal(runbook.boundary, 'NOT_PRODUCTION_EVIDENCE');
    assert.equal(runbook.notProductionEvidence, true);
    assert.equal(runbook.productionReady, false);
    assert.equal(runbook.productionReviewerWorkflowReady, false);
    assert.equal(runbook.proofStartBlocked, true);
    assert.equal(runbook.orderedSteps.every((step) => step.nonExecutable === true), true);
    assert.equal(serialized.includes('token-must-not-appear'), false);
    assert.equal(serialized.includes('Synthetic manual note body'), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
