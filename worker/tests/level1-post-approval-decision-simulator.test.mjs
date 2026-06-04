import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  LEVEL1_POST_APPROVAL_DECISION_SIMULATOR_STATUS,
  buildLevel1PostApprovalDecisionSimulatorArtifact,
  evaluateLevel1PostApprovalDecision,
  renderLevel1PostApprovalDecisionMarkdown,
} from '../../scripts/level1-post-approval-decision-simulator.mjs';

const NOW = new Date('2026-06-04T00:00:00.000Z');

const COMPLETE_APPROVAL_REQUEST = Object.freeze({
  schemaVersion: 'level1.production_proof_approval_intake_request.v1',
  repo: 'dooosp/b2b-lead-agent',
  issue: 165,
  boundary: 'NOT_PRODUCTION_EVIDENCE',
  notProductionEvidence: true,
  productionReady: false,
  productionReviewerWorkflowReady: false,
  proofExecutionApproved: false,
  target: 'Level 1 production reviewer workflow target label planning only',
  commandAllowlist: [
    'REVIEW_ONLY_NON_EXECUTABLE_STEP: confirm redacted approval packet boundaries',
    'REVIEW_ONLY_NON_EXECUTABLE_STEP: compare synthetic fixture artifact labels',
  ],
  endpointBoundary: [
    '/leads reviewer workflow route label only if separately approved later',
    '/api/leads reviewer metadata route label only if separately approved later',
  ],
  d1Boundary: 'No D1 access, database id, binding id, row data, row counts, writes, migrations, deletes, or repair action is approved by this packet.',
  fixtureNonCustomerDataPolicy: 'Synthetic fixtures and approved non-customer metadata only; no customer rows, customer payloads, private lead/person fields, real manual note body text, logs, secrets, CRM, outreach, LLM, or automation data.',
  evidenceRedaction: 'Redact secrets, tokens, cookies, auth headers, JWT/session claims, account ids, database ids, private URLs, names, emails, user ids, customer payloads, manual note body text, generated suggestion text, CRM/outreach data, logs, and private lead/person fields.',
  rollbackOwner: '@dooosp / Taeho Jang',
  stopConditions: [
    'Stop if any request would execute proof, deploy, access staging or production, call endpoints, access D1, read logs or secrets, use customer/private data, run destructive SQL, persist generated suggestions, call CRM/outreach/LLM/automation, parse real auth/session/provider material, or exceed the approved future scope.',
  ],
  approver: '@dooosp / Taeho Jang',
  expiresAt: '2026-06-10T00:00:00.000Z',
});

function completePacket(overrides = {}) {
  return {
    schemaVersion: 'level1.post_approval_decision_simulator_packet.v1',
    scenarioId: 'complete_synthetic_approval',
    repo: 'dooosp/b2b-lead-agent',
    issue: 165,
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    notProductionEvidence: true,
    productionReady: false,
    productionReviewerWorkflowReady: false,
    proofExecutionApproved: false,
    approvalRequest: COMPLETE_APPROVAL_REQUEST,
    source: {
      issue: 165,
      url: 'https://github.com/dooosp/b2b-lead-agent/issues/165#synthetic-non-production-packet',
      type: 'CHECKED_IN_SYNTHETIC_PACKET_ONLY',
    },
    prerequisiteRecords: {
      authProviderSession: 'https://github.com/dooosp/b2b-lead-agent/issues/162#synthetic-planning-record',
      productionD1Observation: 'https://github.com/dooosp/b2b-lead-agent/issues/163#synthetic-planning-record',
      rollbackBackout: 'https://github.com/dooosp/b2b-lead-agent/issues/164#synthetic-planning-record',
      privacyRetention: 'https://github.com/dooosp/b2b-lead-agent/issues/154#synthetic-planning-record',
      localValidation: 'tmp/codex/level1-readiness-closure-dashboard-non-production.json',
    },
    evidenceSlots: {
      approvalPacket: 'synthetic approval packet only',
      redactedDecisionArtifact: 'tmp/codex/level1-post-approval-decision-simulator-non-production.json',
      commandTranscript: 'EMPTY_NOT_EXECUTED',
      endpointEvidence: 'EMPTY_NOT_EXECUTED',
      d1Evidence: 'EMPTY_NOT_EXECUTED',
      rollbackEvidence: 'EMPTY_NOT_EXECUTED',
    },
    rollback: {
      owner: '@dooosp / Taeho Jang',
      nonDestructiveBackoutFirst: true,
      stopWriteTrigger: 'Stop on boundary drift, redaction failure, D1 access, endpoint calls, customer/private data, generated suggestion persistence, or proof execution uncertainty.',
      destructiveDataActionApproved: false,
    },
    futureExecution: {
      status: 'SEPARATE_HUMAN_APPROVAL_REQUIRED',
      exactRemainingAction: 'Open a separate explicit human production proof execution goal after Issue #165 packet review.',
    },
    ...overrides,
  };
}

function reasons(result) {
  return result.blockers.map((blocker) => blocker.reason);
}

test('Level 1 post-approval simulator classifies complete synthetic packets as ready only for separate human execution', () => {
  const result = evaluateLevel1PostApprovalDecision(completePacket(), { now: NOW });
  const artifact = buildLevel1PostApprovalDecisionSimulatorArtifact({
    packets: [completePacket()],
    scenarioId: 'complete_synthetic_approval',
    now: NOW,
  });
  const markdown = renderLevel1PostApprovalDecisionMarkdown(artifact);

  assert.equal(result.ok, true);
  assert.equal(result.decision, 'READY_FOR_SEPARATE_HUMAN_EXECUTION');
  assert.equal(result.boundary, 'NOT_PRODUCTION_EVIDENCE');
  assert.equal(result.notProductionEvidence, true);
  assert.equal(result.productionReady, false);
  assert.equal(result.productionReviewerWorkflowReady, false);
  assert.equal(result.proofExecutionApproved, false);
  assert.deepEqual(result.blockers, []);
  assert.match(result.nextHumanOnlyAction, /separate explicit human/i);

  assert.equal(artifact.documentStatus, LEVEL1_POST_APPROVAL_DECISION_SIMULATOR_STATUS);
  assert.equal(artifact.decision.decision, 'READY_FOR_SEPARATE_HUMAN_EXECUTION');
  assert.equal(artifact.productionReady, false);
  assert.equal(artifact.proofExecutionApproved, false);
  assert.match(markdown, /READY_FOR_SEPARATE_HUMAN_EXECUTION/);
  assert.match(markdown, /NOT_PRODUCTION_EVIDENCE/);
  assert.doesNotMatch(markdown, /productionReady: `true`/);
  assert.doesNotMatch(markdown, /production proof executed/i);
});

test('Level 1 post-approval simulator holds missing vague stale customer-policy and rollback-gap packets', () => {
  const missing = completePacket({
    scenarioId: 'missing_target',
    approvalRequest: { ...COMPLETE_APPROVAL_REQUEST, target: '' },
  });
  const vague = completePacket({
    scenarioId: 'vague_command',
    approvalRequest: { ...COMPLETE_APPROVAL_REQUEST, commandAllowlist: ['any'] },
  });
  const stale = completePacket({
    scenarioId: 'stale_approval',
    approvalRequest: { ...COMPLETE_APPROVAL_REQUEST, expiresAt: '2026-06-01T00:00:00.000Z' },
  });
  const customerPolicyGap = completePacket({
    scenarioId: 'customer_policy_gap',
    approvalRequest: {
      ...COMPLETE_APPROVAL_REQUEST,
      fixtureNonCustomerDataPolicy: 'Use appropriate evidence for proof.',
    },
  });
  const rollbackGap = completePacket({
    scenarioId: 'rollback_gap',
    rollback: {
      owner: '',
      nonDestructiveBackoutFirst: false,
      stopWriteTrigger: '',
      destructiveDataActionApproved: false,
    },
  });

  for (const packet of [missing, vague, stale, customerPolicyGap, rollbackGap]) {
    const result = evaluateLevel1PostApprovalDecision(packet, { now: NOW });
    assert.equal(result.ok, false, packet.scenarioId);
    assert.equal(result.decision, 'HOLD', packet.scenarioId);
    assert.equal(result.productionReady, false);
    assert.equal(result.proofExecutionApproved, false);
  }

  assert.ok(reasons(evaluateLevel1PostApprovalDecision(missing, { now: NOW })).includes('missing_required_approval_field'));
  assert.ok(reasons(evaluateLevel1PostApprovalDecision(vague, { now: NOW })).includes('vague_approval_field_refused'));
  assert.ok(reasons(evaluateLevel1PostApprovalDecision(stale, { now: NOW })).includes('stale_or_expired_approval_refused'));
  assert.ok(reasons(evaluateLevel1PostApprovalDecision(customerPolicyGap, { now: NOW })).includes('customer_data_policy_gap_refused'));
  assert.ok(reasons(evaluateLevel1PostApprovalDecision(rollbackGap, { now: NOW })).includes('rollback_gap_refused'));
});

test('Level 1 post-approval simulator blocks unsafe contradictory production D1 auth SQL and endpoint packets', () => {
  const unsafe = completePacket({
    scenarioId: 'unsafe_packet',
    productionReady: true,
    proofExecutionApproved: true,
    approvalRequest: {
      ...COMPLETE_APPROVAL_REQUEST,
      productionReady: true,
      proofExecutionApproved: true,
      commandAllowlist: [
        'REVIEW_ONLY_NON_EXECUTABLE_STEP',
        'DROP TABLE leads;',
      ],
      endpointBoundary: ['*', '/api/*'],
      d1Boundary: 'D1_BINDING=DB database_id=abc123privatevalue',
      fixtureNonCustomerDataPolicy: 'Use customer rows and customer payloads.',
      evidenceRedaction: 'Authorization: Bearer token-must-not-leak',
      rawAuth: {
        token: 'token-must-not-leak',
      },
    },
    rawAuth: {
      token: 'token-must-not-leak',
    },
  });
  const result = evaluateLevel1PostApprovalDecision(unsafe, { now: NOW });
  const serialized = JSON.stringify(result);

  assert.equal(result.ok, false);
  assert.equal(result.decision, 'BLOCKED');
  assert.equal(result.productionReady, false);
  assert.equal(result.proofExecutionApproved, false);
  assert.ok(reasons(result).includes('production_ready_claim_refused'));
  assert.ok(reasons(result).includes('contradictory_approval_refused'));
  assert.ok(reasons(result).includes('broad_endpoint_refused'));
  assert.ok(reasons(result).includes('d1_private_identifier_refused'));
  assert.ok(reasons(result).includes('secret_like_input_refused'));
  assert.ok(reasons(result).includes('destructive_sql_refused'));
  assert.ok(reasons(result).includes('customer_data_input_refused'));
  assert.equal(serialized.includes('token-must-not-leak'), false);
  assert.equal(serialized.includes('abc123privatevalue'), false);
});

test('Level 1 post-approval simulator CLI writes redacted NOT_PRODUCTION_EVIDENCE artifacts from checked-in synthetic packets', () => {
  const dir = mkdtempSync(join(tmpdir(), 'level1-post-approval-simulator-'));
  const outputPath = join(dir, 'simulator.json');
  const markdownPath = join(dir, 'simulator.md');

  try {
    const result = spawnSync(process.execPath, [
      'scripts/level1-post-approval-decision-simulator.mjs',
      '--scenario',
      'complete_synthetic_approval',
      '--json',
      '--output',
      outputPath,
      '--markdown-output',
      markdownPath,
      '--now',
      '2026-06-04T00:00:00.000Z',
    ], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, new RegExp(LEVEL1_POST_APPROVAL_DECISION_SIMULATOR_STATUS));

    const artifact = JSON.parse(readFileSync(outputPath, 'utf8'));
    const markdown = readFileSync(markdownPath, 'utf8');

    assert.equal(artifact.documentStatus, LEVEL1_POST_APPROVAL_DECISION_SIMULATOR_STATUS);
    assert.equal(artifact.boundary, 'NOT_PRODUCTION_EVIDENCE');
    assert.equal(artifact.decision.decision, 'READY_FOR_SEPARATE_HUMAN_EXECUTION');
    assert.equal(artifact.productionReady, false);
    assert.equal(artifact.proofExecutionApproved, false);
    assert.match(markdown, /READY_FOR_SEPARATE_HUMAN_EXECUTION/);
    assert.doesNotMatch(JSON.stringify(artifact), /Authorization: Bearer|token-must-not-leak|database_id/i);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
