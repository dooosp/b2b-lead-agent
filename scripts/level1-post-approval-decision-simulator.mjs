#!/usr/bin/env node

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

import { validateLevel1ApprovalIntakeRequest } from './level1-production-proof-approval-intake-gate.mjs';
import { redactLevel1EvidenceRecord } from '../worker/lib/level1-readiness-guards.js';

export const LEVEL1_POST_APPROVAL_DECISION_SIMULATOR_STATUS =
  'LEVEL1_POST_APPROVAL_DECISION_SIMULATOR_NON_PRODUCTION';

export const LEVEL1_POST_APPROVAL_DECISION_SIMULATOR_TIMESTAMP =
  '2026-06-04T00:00:00.000Z';

export const LEVEL1_POST_APPROVAL_DECISION_SIMULATOR_PACKET_PATH =
  'docs/roadmap/b2b-lead-agent-level-1-post-approval-decision-simulator-synthetic-packets-non-production.json';

export const LEVEL1_POST_APPROVAL_DECISION_SIMULATOR_JSON_PATH =
  'tmp/codex/level1-post-approval-decision-simulator-non-production.json';

export const LEVEL1_POST_APPROVAL_DECISION_SIMULATOR_MD_PATH =
  'docs/roadmap/b2b-lead-agent-level-1-post-approval-decision-simulator-non-production.md';

const REQUIRED_PACKET_FIELDS = Object.freeze([
  'schemaVersion',
  'scenarioId',
  'repo',
  'issue',
  'boundary',
  'notProductionEvidence',
  'productionReady',
  'productionReviewerWorkflowReady',
  'proofExecutionApproved',
  'approvalRequest',
  'source',
  'prerequisiteRecords',
  'evidenceSlots',
  'rollback',
  'futureExecution',
]);

const REQUIRED_PREREQUISITE_KEYS = Object.freeze([
  'authProviderSession',
  'productionD1Observation',
  'rollbackBackout',
  'privacyRetention',
  'localValidation',
]);

const REQUIRED_EMPTY_EVIDENCE_SLOTS = Object.freeze([
  'commandTranscript',
  'endpointEvidence',
  'd1Evidence',
  'rollbackEvidence',
]);

const BLOCKING_REASONS = new Set([
  'broad_endpoint_refused',
  'contradictory_approval_refused',
  'customer_data_input_refused',
  'd1_private_identifier_refused',
  'destructive_data_action_refused',
  'destructive_sql_refused',
  'evidence_slot_not_empty_refused',
  'invalid_evidence_boundary',
  'production_like_command_refused',
  'production_ready_claim_refused',
  'proof_execution_claim_refused',
  'secret_like_input_refused',
]);

const SECRET_KEY_PATTERNS = Object.freeze([
  /^authHeader$/i,
  /^authorization$/i,
  /^cookie$/i,
  /^jwt$/i,
  /^providerInput$/i,
  /^rawAuth$/i,
  /^raw_auth$/i,
  /^rawSessionClaims$/i,
  /^secret$/i,
  /^sessionClaim$/i,
  /^token$/i,
  /api[_-]?key/i,
  /auth[_-]?token/i,
  /cloudflare[_-]?access/i,
  /client[_-]?secret/i,
  /password/i,
]);

const SECRET_VALUE_PATTERNS = Object.freeze([
  /\b(?:authorization|proxy-authorization)\s*[:=]\s*[^\s,;]+/i,
  /\bbearer\s+[a-z0-9._~+/-]+=*/i,
  /\b(?:cookie|set-cookie)\s*[:=]\s*[^\r\n;]+/i,
  /\b(?:token|secret|api[_-]?key|password|jwt|session)\s*[:=]\s*[^\s,;]+/i,
]);

const PRIVATE_D1_PATTERN =
  /(?:database[_-]?id|account[_-]?id|d1[_-]?(?:binding|database)|[a-f0-9]{16,}|private[-_ ]?database[-_ ]?id)\s*[:=]?\s*[a-z0-9_-]*/i;

const DESTRUCTIVE_SQL_PATTERN =
  /\b(?:drop\s+table|drop\s+index|delete\s+from|truncate\s+table|update\s+[\w".]+\s+set|insert\s+into|replace\s+into|merge\s+into|alter\s+table|create\s+(?:table|index|trigger))\b/i;

const PRODUCTION_READY_CLAIM_PATTERN =
  /\b(?:productionReady\s*[:=]\s*true|productionReviewerWorkflowReady\s*[:=]\s*true|proofExecutionApproved\s*[:=]\s*true|production proof executed|production reviewer workflow ready|APPROVED_FOR_PRODUCTION_PROOF_EXECUTION)\b/i;

const CUSTOMER_DATA_PATTERN =
  /\b(?:customer\s+(?:row|rows|payload|payloads|data|private data)|real manual note body|private lead\/person|private lead|private person)\b/i;

const PROHIBITION_CONTEXT_PATTERN =
  /\b(?:no|not|never|forbid|forbidden|refuse|refused|reject|rejected|redact|redacted|stop|abort|disallow|without)\b/i;

function optionValue(flag, argv = process.argv) {
  const index = argv.indexOf(flag);
  if (index < 0) return '';
  return argv[index + 1] || '';
}

function hasFlag(flag, argv = process.argv) {
  return argv.includes(flag);
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function isMissing(value) {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function formatPath(path) {
  return path.map(String).join('.');
}

function isProhibitionText(value) {
  return PROHIBITION_CONTEXT_PATTERN.test(String(value || ''));
}

function walkValues(value, callback, path = []) {
  callback(value, path);
  if (!value || typeof value !== 'object') return;
  const entries = Array.isArray(value)
    ? value.map((item, index) => [index, item])
    : Object.entries(value);
  for (const [field, item] of entries) {
    walkValues(item, callback, path.concat(field));
  }
}

function shouldRedactValue(value, field = '') {
  const text = String(value || '');
  return SECRET_KEY_PATTERNS.some((pattern) => pattern.test(field))
    || SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(text))
    || PRIVATE_D1_PATTERN.test(text);
}

function redactSimulatorValue(value, field = '') {
  if (Array.isArray(value)) return value.map((item) => redactSimulatorValue(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(redactLevel1EvidenceRecord(value)).map(([key, item]) => (
      [key, redactSimulatorValue(item, key)]
    )));
  }
  if (typeof value === 'string' && shouldRedactValue(value, field)) return '[REDACTED]';
  return value;
}

function redactedPacket(packet = {}) {
  return redactSimulatorValue(redactLevel1EvidenceRecord(packet));
}

function addBlocker(blockers, reason, path, detail = '', status = null) {
  const safeDetail = shouldRedactValue(detail, String(path || '')) ? '[REDACTED]' : detail;
  if (blockers.some((blocker) => blocker.reason === reason && blocker.path === path)) return;
  const blockerStatus = BLOCKING_REASONS.has(reason) ? 'BLOCKED' : (status || 'HOLD');
  blockers.push({
    reason,
    path,
    detail: safeDetail,
    status: blockerStatus,
  });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJsonArtifact(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeTextArtifact(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value.endsWith('\n') ? value : `${value}\n`);
}

function loadSyntheticPackets(path = LEVEL1_POST_APPROVAL_DECISION_SIMULATOR_PACKET_PATH) {
  const fixture = readJson(path);
  if (Array.isArray(fixture)) return fixture;
  return fixture.packets || [];
}

function selectedPacket(packets = [], scenarioId = 'complete_synthetic_approval') {
  return packets.find((packet) => packet.scenarioId === scenarioId) || null;
}

function fixturePolicyIsComplete(value) {
  const text = String(value || '').toLowerCase();
  return /synthetic/.test(text)
    && /non[- ]customer/.test(text)
    && /\bno\b[\s\S]*(customer|private|manual note|logs|secrets)/.test(text);
}

function redactionPolicyIsComplete(value) {
  const text = String(value || '').toLowerCase();
  return /redact/.test(text)
    && /secret|token|auth/.test(text)
    && /database|account|private/.test(text)
    && /customer|manual note|generated suggestion|logs/.test(text);
}

function validatePacketShape(packet = {}, blockers) {
  for (const field of REQUIRED_PACKET_FIELDS) {
    if (!hasOwn(packet, field) || isMissing(packet[field])) {
      addBlocker(blockers, 'missing_required_packet_field', field, field);
    }
  }

  if (packet.schemaVersion !== 'level1.post_approval_decision_simulator_packet.v1') {
    addBlocker(blockers, 'invalid_packet_schema', 'schemaVersion', packet.schemaVersion || '');
  }
  if (packet.repo !== 'dooosp/b2b-lead-agent') {
    addBlocker(blockers, 'invalid_repo', 'repo', packet.repo || '');
  }
  if (packet.issue !== 165) {
    addBlocker(blockers, 'invalid_issue', 'issue', String(packet.issue || ''));
  }
  if (packet.boundary !== 'NOT_PRODUCTION_EVIDENCE' || packet.notProductionEvidence !== true) {
    addBlocker(blockers, 'invalid_evidence_boundary', 'boundary', packet.boundary || '');
  }
  if (packet.productionReady === true || packet.productionReviewerWorkflowReady === true) {
    addBlocker(blockers, 'production_ready_claim_refused', 'productionReady', 'simulator input cannot claim production readiness');
  }
  if (packet.proofExecutionApproved === true) {
    addBlocker(blockers, 'proof_execution_claim_refused', 'proofExecutionApproved', 'simulator input cannot approve proof execution');
  }
}

function validatePrerequisites(packet = {}, blockers) {
  for (const key of REQUIRED_PREREQUISITE_KEYS) {
    const value = packet.prerequisiteRecords?.[key];
    if (isMissing(value)) {
      addBlocker(blockers, 'missing_prerequisite_record', `prerequisiteRecords.${key}`, key);
    }
  }
}

function validateEvidenceSlots(packet = {}, blockers) {
  for (const key of REQUIRED_EMPTY_EVIDENCE_SLOTS) {
    const value = packet.evidenceSlots?.[key];
    if (value !== 'EMPTY_NOT_EXECUTED') {
      addBlocker(blockers, 'evidence_slot_not_empty_refused', `evidenceSlots.${key}`, '[REDACTED]');
    }
  }
}

function validateRollback(packet = {}, blockers) {
  const rollback = packet.rollback || {};
  if (
    isMissing(rollback.owner)
    || rollback.nonDestructiveBackoutFirst !== true
    || isMissing(rollback.stopWriteTrigger)
  ) {
    addBlocker(blockers, 'rollback_gap_refused', 'rollback', 'rollback owner, non-destructive-first policy, and stop-write trigger are required');
  }
  if (rollback.destructiveDataActionApproved === true) {
    addBlocker(blockers, 'destructive_data_action_refused', 'rollback.destructiveDataActionApproved', 'destructive data action is not approved');
  }
}

function validateFutureExecution(packet = {}, blockers) {
  if (packet.futureExecution?.status !== 'SEPARATE_HUMAN_APPROVAL_REQUIRED') {
    addBlocker(blockers, 'future_execution_boundary_missing', 'futureExecution.status', packet.futureExecution?.status || '');
  }
  if (isMissing(packet.futureExecution?.exactRemainingAction)) {
    addBlocker(blockers, 'missing_exact_remaining_action', 'futureExecution.exactRemainingAction', 'human-only action is required');
  }
}

function validatePolicyGaps(packet = {}, blockers) {
  const request = packet.approvalRequest || {};
  if (!fixturePolicyIsComplete(request.fixtureNonCustomerDataPolicy)) {
    addBlocker(blockers, 'customer_data_policy_gap_refused', 'approvalRequest.fixtureNonCustomerDataPolicy', 'synthetic/non-customer/no-customer policy is required');
  }
  if (!redactionPolicyIsComplete(request.evidenceRedaction)) {
    addBlocker(blockers, 'evidence_redaction_gap_refused', 'approvalRequest.evidenceRedaction', 'redaction policy must name secrets/auth/private IDs/customer data');
  }
}

function validateUnsafeValues(packet = {}, blockers) {
  walkValues(packet, (value, path) => {
    const joinedPath = formatPath(path);
    const field = String(path[path.length - 1] || '');
    const text = typeof value === 'string' ? value : '';

    if (SECRET_KEY_PATTERNS.some((pattern) => pattern.test(field)) || SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(text))) {
      addBlocker(blockers, 'secret_like_input_refused', joinedPath, '[REDACTED]');
    }
    if (PRIVATE_D1_PATTERN.test(text)) {
      addBlocker(blockers, 'd1_private_identifier_refused', joinedPath, '[REDACTED]');
    }
    if (DESTRUCTIVE_SQL_PATTERN.test(text) && !isProhibitionText(text)) {
      addBlocker(blockers, 'destructive_sql_refused', joinedPath, '[REDACTED]');
    }
    if (PRODUCTION_READY_CLAIM_PATTERN.test(text)) {
      addBlocker(blockers, 'production_ready_claim_refused', joinedPath, '[REDACTED]');
    }
    if (CUSTOMER_DATA_PATTERN.test(text) && !isProhibitionText(text)) {
      addBlocker(blockers, 'customer_data_input_refused', joinedPath, '[REDACTED]');
    }
  });
}

export function evaluateLevel1PostApprovalDecision(packet = {}, {
  now = new Date(),
} = {}) {
  const blockers = [];

  validatePacketShape(packet, blockers);
  validatePrerequisites(packet, blockers);
  validateEvidenceSlots(packet, blockers);
  validateRollback(packet, blockers);
  validateFutureExecution(packet, blockers);
  validatePolicyGaps(packet, blockers);
  validateUnsafeValues(packet, blockers);

  const intakeValidation = validateLevel1ApprovalIntakeRequest(packet.approvalRequest || {}, { now });
  for (const blocker of intakeValidation.blockers) {
    addBlocker(blockers, blocker.reason, `approvalRequest.${blocker.path}`, blocker.detail, blocker.status);
  }

  const decision = blockers.some((blocker) => blocker.status === 'BLOCKED')
    ? 'BLOCKED'
    : blockers.length > 0
      ? 'HOLD'
      : 'READY_FOR_SEPARATE_HUMAN_EXECUTION';

  return {
    ok: decision === 'READY_FOR_SEPARATE_HUMAN_EXECUTION',
    decision,
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    notProductionEvidence: true,
    productionReady: false,
    productionReviewerWorkflowReady: false,
    proofExecutionApproved: false,
    approvalStatus: decision === 'READY_FOR_SEPARATE_HUMAN_EXECUTION'
      ? 'READY_FOR_SEPARATE_HUMAN_EXECUTION_ONLY'
      : 'HOLD_PENDING_SAFE_SYNTHETIC_APPROVAL_PACKET',
    issue165: {
      issue: 165,
      status: 'OPEN_HOLD_PENDING_SEPARATE_EXPLICIT_FUTURE_PROOF_GOAL',
      url: 'https://github.com/dooosp/b2b-lead-agent/issues/165',
    },
    scenarioId: packet.scenarioId || '',
    blockers,
    redactedPacket: redactedPacket(packet),
    nextHumanOnlyAction: decision === 'READY_FOR_SEPARATE_HUMAN_EXECUTION'
      ? 'Open a separate explicit human production proof execution goal; do not execute proof from this simulator.'
      : 'Resolve HOLD/BLOCKED simulator blockers in a future human approval packet; do not execute proof.',
    nonClaims: [
      'This simulator is not production proof.',
      'This simulator does not execute commands, call endpoints, access D1, deploy, read logs/secrets, use customer/private data, call CRM/outreach/LLM/automation, parse real auth/session/provider material, or approve production readiness.',
      'A READY_FOR_SEPARATE_HUMAN_EXECUTION decision is still not proof execution approval.',
      'Issue #165 remains open until a separate explicit human production proof execution goal is approved and performed by a human.',
    ],
  };
}

export function buildLevel1PostApprovalDecisionSimulatorArtifact({
  generatedAt = LEVEL1_POST_APPROVAL_DECISION_SIMULATOR_TIMESTAMP,
  packets = loadSyntheticPackets(),
  scenarioId = 'complete_synthetic_approval',
  now = new Date(generatedAt),
} = {}) {
  const packet = selectedPacket(packets, scenarioId);
  const decision = packet
    ? evaluateLevel1PostApprovalDecision(packet, { now })
    : {
      ok: false,
      decision: 'HOLD',
      boundary: 'NOT_PRODUCTION_EVIDENCE',
      notProductionEvidence: true,
      productionReady: false,
      productionReviewerWorkflowReady: false,
      proofExecutionApproved: false,
      approvalStatus: 'HOLD_PENDING_SAFE_SYNTHETIC_APPROVAL_PACKET',
      issue165: {
        issue: 165,
        status: 'OPEN_HOLD_PENDING_SEPARATE_EXPLICIT_FUTURE_PROOF_GOAL',
        url: 'https://github.com/dooosp/b2b-lead-agent/issues/165',
      },
      scenarioId,
      blockers: [{
        reason: 'synthetic_packet_not_found',
        path: 'scenarioId',
        detail: scenarioId,
        status: 'HOLD',
      }],
      redactedPacket: {},
      nextHumanOnlyAction: 'Provide a checked-in synthetic packet scenario before simulation; do not execute proof.',
      nonClaims: [
        'Missing synthetic packet is not approval.',
        'Issue #165 remains open and production proof remains blocked.',
      ],
    };

  return {
    schemaVersion: 'level1.post_approval_decision_simulator.v1',
    documentStatus: LEVEL1_POST_APPROVAL_DECISION_SIMULATOR_STATUS,
    generatedAt,
    repo: 'dooosp/b2b-lead-agent',
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    notProductionEvidence: true,
    productionReady: false,
    productionReviewerWorkflowReady: false,
    proofExecutionApproved: false,
    scenarioId,
    sourcePacketPath: LEVEL1_POST_APPROVAL_DECISION_SIMULATOR_PACKET_PATH,
    decision,
    decisionOptions: [
      'HOLD',
      'BLOCKED',
      'READY_FOR_SEPARATE_HUMAN_EXECUTION',
    ],
    issue165: decision.issue165,
    exactRemainingHumanOnlyAction: decision.nextHumanOnlyAction,
    evidenceSlots: packet?.evidenceSlots || {},
    validationMatrix: [
      'complete_synthetic_approval',
      'missing_required_approval_field',
      'vague_approval_field',
      'stale_or_expired_approval',
      'contradictory_approval',
      'broad_endpoint',
      'd1_private_identifier_or_binding',
      'secret_token_or_raw_auth',
      'destructive_sql',
      'customer_data_policy_gap',
      'rollback_gap',
      'production_ready_true',
    ],
    nonClaims: decision.nonClaims,
  };
}

export function renderLevel1PostApprovalDecisionMarkdown(
  artifact = buildLevel1PostApprovalDecisionSimulatorArtifact(),
) {
  const lines = [
    '# Level 1 Post-Approval Decision Simulator (Non-Production)',
    '',
    `Document Status: \`${artifact.documentStatus}\``,
    `Boundary: \`${artifact.boundary}\``,
    `Generated At: \`${artifact.generatedAt}\``,
    `Repo: \`${artifact.repo}\``,
    `Scenario: \`${artifact.scenarioId}\``,
    `Decision: \`${artifact.decision.decision}\``,
    `productionReady: \`${String(artifact.productionReady)}\``,
    `productionReviewerWorkflowReady: \`${String(artifact.productionReviewerWorkflowReady)}\``,
    `proofExecutionApproved: \`${String(artifact.proofExecutionApproved)}\``,
    '',
    'This artifact is `NOT_PRODUCTION_EVIDENCE`. It is a local-only simulator over checked-in synthetic Issue #165 approval-intake packets.',
    '',
    '## Decision Meaning',
    '',
    '- `HOLD`: missing, vague, stale, incomplete, or gap-bearing approval input. No proof may run.',
    '- `BLOCKED`: unsafe, contradictory, secret-bearing, broad, destructive, D1-private, or production-ready-claim input. No proof may run.',
    '- `READY_FOR_SEPARATE_HUMAN_EXECUTION`: the synthetic packet is machine-checkable and safe enough for a separate human execution decision. It is still not execution approval.',
    '',
    '## Result',
    '',
    `- Decision: \`${artifact.decision.decision}\``,
    `- Blockers: \`${artifact.decision.blockers.length}\``,
    `- Issue #165: ${artifact.issue165.url}`,
    `- Exact remaining human-only action: ${artifact.exactRemainingHumanOnlyAction}`,
    '',
    '## Blockers',
    '',
    ...(artifact.decision.blockers.length > 0
      ? artifact.decision.blockers.map((blocker) => (
        `- \`${blocker.status}\` \`${blocker.reason}\` at \`${blocker.path}\`: ${blocker.detail}`
      ))
      : ['- None for the selected synthetic packet.']),
    '',
    '## Acceptance Matrix',
    '',
    ...artifact.validationMatrix.map((item) => `- \`${item}\``),
    '',
    '## Non-Claims',
    '',
    ...artifact.nonClaims.map((item) => `- ${item}`),
  ];

  return `${lines.join('\n')}\n`;
}

function runCli() {
  const scenarioId = optionValue('--scenario') || 'complete_synthetic_approval';
  const generatedAt = optionValue('--generated-at') || LEVEL1_POST_APPROVAL_DECISION_SIMULATOR_TIMESTAMP;
  const now = new Date(optionValue('--now') || generatedAt);
  const packets = loadSyntheticPackets();
  const artifact = buildLevel1PostApprovalDecisionSimulatorArtifact({
    generatedAt,
    packets,
    scenarioId,
    now,
  });
  const outputPath = optionValue('--output') || LEVEL1_POST_APPROVAL_DECISION_SIMULATOR_JSON_PATH;
  const markdownOutputPath = optionValue('--markdown-output') || LEVEL1_POST_APPROVAL_DECISION_SIMULATOR_MD_PATH;

  if (hasFlag('--json') || hasFlag('--output')) {
    writeJsonArtifact(outputPath, artifact);
  }
  if (hasFlag('--markdown') || hasFlag('--markdown-output') || !hasFlag('--json')) {
    writeTextArtifact(markdownOutputPath, renderLevel1PostApprovalDecisionMarkdown(artifact));
  }

  console.log(JSON.stringify({
    ok: artifact.decision.ok,
    documentStatus: artifact.documentStatus,
    boundary: artifact.boundary,
    decision: artifact.decision.decision,
    productionReady: artifact.productionReady,
    proofExecutionApproved: artifact.proofExecutionApproved,
    sourcePacketPath: artifact.sourcePacketPath,
    output: hasFlag('--json') || hasFlag('--output') ? outputPath : null,
    markdownOutput: hasFlag('--markdown') || hasFlag('--markdown-output') || !hasFlag('--json') ? markdownOutputPath : null,
  }, null, 2));

  if (!artifact.decision.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli();
}
