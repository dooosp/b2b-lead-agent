#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import {
  evaluateLevel1ProofPreflight,
} from './level1-proof-preflight.mjs';
import {
  LEVEL1_APPROVAL_PACKET_PATH,
  evaluateLevel1ApprovalPacketDryRun,
} from './level1-production-proof-approval-dry-run.mjs';
import {
  LEVEL1_CHANGE_CONTROL_MANIFEST_PATH,
  evaluateLevel1ChangeControlManifest,
} from './level1-production-proof-change-control-manifest.mjs';
import {
  buildLevel1FutureProductionProofEvidenceArtifact,
  evaluateLevel1RollbackGate,
  redactLevel1EvidenceRecord,
  validateLevel1FutureProductionProofEvidenceArtifact,
} from '../worker/lib/level1-readiness-guards.js';
import { writeJsonArtifactIfMateriallyChanged } from './lib/cli-utils.mjs';

export const LEVEL1_OPERATOR_REHEARSAL_OUTPUT_PATH =
  'tmp/codex/level1-operator-rehearsal-non-production-runbook.json';

const DEFAULT_REHEARSAL_URLS = Object.freeze([
  'http://localhost:8787/leads',
  'https://synthetic.example/level1/operator-rehearsal',
]);

const DEFAULT_RAW_PROOF_INPUT = Object.freeze({
  rehearsalFixtureId: 'synthetic-level1-operator-rehearsal',
  manualNoteBodyText: 'Synthetic manual note body must never appear in operator rehearsal evidence.',
  generatedSuggestionText: 'Synthetic generated suggestion must never appear in operator rehearsal evidence.',
  authHeader: 'Bearer token-must-not-appear',
  providerInput: 'Synthetic provider input must never appear in operator rehearsal evidence.',
  nested: {
    token: 'nested-token-must-not-appear',
    safeLabel: 'redacted local fixture placeholder',
  },
});

function optionValue(flag, argv = process.argv) {
  const index = argv.indexOf(flag);
  if (index < 0) return '';
  return argv[index + 1] || '';
}

function optionValues(flag, argv = process.argv) {
  const values = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === flag) values.push(argv[index + 1] || '');
  }
  return values.filter((value) => String(value).trim());
}

function statusFromOk(ok) {
  return ok ? 'PASS' : 'HOLD';
}

function redactedBlocker(blocker = {}, gate = 'unknown') {
  return redactLevel1EvidenceRecord({
    gate,
    reason: blocker.reason || 'unknown_blocker',
    path: blocker.path,
    key: blocker.key,
    detail: blocker.detail,
    status: blocker.status || 'HOLD',
  });
}

function collectRehearsalBlockers({
  preflightResult,
  approvalResult,
  manifestResult,
  rollbackResult,
  futureEvidenceValidation,
  privacyRedaction,
} = {}) {
  const blockers = [];

  for (const blocker of preflightResult.blockers || []) {
    blockers.push(redactedBlocker(blocker, 'proof_preflight'));
  }
  for (const marker of approvalResult.packetValidation?.missingMarkers || []) {
    blockers.push(redactedBlocker({
      reason: 'approval_packet_missing_marker',
      path: marker,
      status: 'HOLD',
    }, 'approval_packet'));
  }
  for (const field of approvalResult.packetValidation?.forbiddenMatches || []) {
    blockers.push(redactedBlocker({
      reason: 'approval_packet_forbidden_field_refused',
      path: field,
      status: 'HOLD',
    }, 'approval_packet'));
  }
  for (const field of approvalResult.evidenceValidation?.missingFields || []) {
    blockers.push(redactedBlocker({
      reason: 'future_evidence_missing_field',
      path: field,
      status: 'HOLD',
    }, 'approval_packet'));
  }
  for (const field of approvalResult.evidenceValidation?.invalidFields || []) {
    blockers.push(redactedBlocker({
      reason: 'future_evidence_invalid_field',
      path: field,
      status: 'HOLD',
    }, 'approval_packet'));
  }
  for (const field of approvalResult.evidenceValidation?.forbiddenFieldPaths || []) {
    blockers.push(redactedBlocker({
      reason: 'future_evidence_forbidden_field_refused',
      path: field,
      status: 'HOLD',
    }, 'approval_packet'));
  }
  for (const blocker of manifestResult.validation?.blockers || []) {
    blockers.push(redactedBlocker(blocker, 'change_control_manifest'));
  }
  for (const blocker of rollbackResult.blockers || []) {
    blockers.push(redactedBlocker(blocker, 'rollback_stop_write'));
  }
  for (const field of futureEvidenceValidation.missingFields || []) {
    blockers.push(redactedBlocker({
      reason: 'operator_rehearsal_evidence_missing_field',
      path: field,
      status: 'HOLD',
    }, 'evidence_artifact'));
  }
  for (const field of futureEvidenceValidation.invalidFields || []) {
    blockers.push(redactedBlocker({
      reason: 'operator_rehearsal_evidence_invalid_field',
      path: field,
      status: 'HOLD',
    }, 'evidence_artifact'));
  }
  for (const field of futureEvidenceValidation.forbiddenFieldPaths || []) {
    blockers.push(redactedBlocker({
      reason: 'operator_rehearsal_evidence_forbidden_field_refused',
      path: field,
      status: 'HOLD',
    }, 'evidence_artifact'));
  }
  if (!privacyRedaction.ok) {
    blockers.push(redactedBlocker({
      reason: 'privacy_redaction_failed',
      path: 'redactedValues',
      status: 'HOLD',
    }, 'privacy_redaction'));
  }

  return blockers;
}

function evaluatePrivacyRedaction(rawProofInput = DEFAULT_RAW_PROOF_INPUT) {
  const redactedValues = redactLevel1EvidenceRecord(rawProofInput);
  const serialized = JSON.stringify(redactedValues);
  const forbiddenNeedles = [
    'Synthetic manual note body',
    'Synthetic generated suggestion',
    'token-must-not-appear',
    'Bearer ',
    'Synthetic provider input',
  ];

  return {
    ok: forbiddenNeedles.every((needle) => !serialized.includes(needle)),
    redactedValues,
  };
}

export function buildLevel1OperatorRehearsalRunbook({
  status = 'HOLD',
  generatedAt = new Date().toISOString(),
  packetPath = LEVEL1_APPROVAL_PACKET_PATH,
  manifestPath = LEVEL1_CHANGE_CONTROL_MANIFEST_PATH,
  manifest = {},
  gates = [],
  blockers = [],
  redactedValues = {},
} = {}) {
  const issueRefs = manifest.issueRefs || {};
  const rollbackOwner = manifest.rollback?.owner || manifest.changeControl?.owner || 'MISSING_ROLLBACK_OWNER';
  const stopWriteTrigger = manifest.rollback?.stopWriteTrigger || 'MISSING_STOP_WRITE_TRIGGER';
  const stopWriteTriggerText = String(stopWriteTrigger).replace(/\.+$/, '');

  return {
    documentStatus: 'LEVEL1_OPERATOR_REHEARSAL_GATE_NON_PRODUCTION',
    status,
    evidenceType: 'REDACTED_NON_EXECUTABLE_OPERATOR_REHEARSAL_ONLY',
    generatedAt,
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    notProductionEvidence: true,
    productionReady: false,
    productionReviewerWorkflowReady: false,
    proofStartBlocked: true,
    approvalStatus: 'HOLD_PENDING_SEPARATE_EXPLICIT_FUTURE_PROOF_GOAL',
    sourceArtifacts: {
      approvalPacket: packetPath,
      changeControlManifest: manifestPath,
      proofPreflightScript: 'scripts/level1-proof-preflight.mjs',
      approvalDryRunScript: 'scripts/level1-production-proof-approval-dry-run.mjs',
      changeControlScript: 'scripts/level1-production-proof-change-control-manifest.mjs',
    },
    issueRefs,
    owners: redactLevel1EvidenceRecord({
      productOwner: manifest.changeControl?.owner,
      reviewer: manifest.changeControl?.reviewer,
      operator: manifest.changeControl?.operator,
      rollbackOwner,
    }),
    gates,
    blockers,
    orderedSteps: [
      {
        id: 'confirm_source_artifacts',
        owner: manifest.changeControl?.reviewer || 'UNASSIGNED_REVIEWER',
        action: 'REVIEW_ONLY_DO_NOT_EXECUTE',
        nonExecutable: true,
        purpose: 'Confirm the approval packet, change-control manifest, merged PR train, issue references, and non-production boundary are present.',
      },
      {
        id: 'review_proof_preflight',
        owner: manifest.changeControl?.operator || 'NO_OPERATOR_APPROVED_FOR_EXECUTION_NOW',
        action: 'REVIEW_ONLY_DO_NOT_EXECUTE',
        nonExecutable: true,
        commandLabel: 'npm run proof:level1:preflight',
        purpose: 'Review local-only preflight output; do not provide production/staging URL, D1, secret, token, raw auth, or provider input.',
      },
      {
        id: 'review_approval_packet_dry_run',
        owner: manifest.changeControl?.reviewer || 'UNASSIGNED_REVIEWER',
        action: 'REVIEW_ONLY_DO_NOT_EXECUTE',
        nonExecutable: true,
        commandLabel: 'npm run proof:level1:approval-dry-run',
        purpose: 'Review packet completeness and future evidence schema while Issue #165 keeps proof approval on HOLD.',
      },
      {
        id: 'review_change_control_manifest',
        owner: manifest.changeControl?.owner || 'UNASSIGNED_OWNER',
        action: 'REVIEW_ONLY_DO_NOT_EXECUTE',
        nonExecutable: true,
        commandLabel: 'npm run proof:level1:change-control-manifest',
        purpose: 'Review exact command, endpoint, D1, fixture, evidence, approval-record, and execution-window labels without executing them.',
      },
      {
        id: 'confirm_rollback_stop_write',
        owner: rollbackOwner,
        action: 'REVIEW_ONLY_DO_NOT_EXECUTE',
        nonExecutable: true,
        purpose: 'Confirm rollback owner, stop-write trigger, non-destructive-first policy, and owner approval requirement before any future repair or rollback.',
      },
      {
        id: 'confirm_privacy_redaction',
        owner: manifest.changeControl?.reviewer || 'UNASSIGNED_REVIEWER',
        action: 'REVIEW_ONLY_DO_NOT_EXECUTE',
        nonExecutable: true,
        purpose: 'Confirm evidence slots accept only redacted pass/fail metadata and never manual note body, generated suggestion, token, cookie, raw auth, D1 id, log, or customer/private fields.',
      },
      {
        id: 'prepare_empty_evidence_slots',
        owner: manifest.changeControl?.operator || 'NO_OPERATOR_APPROVED_FOR_EXECUTION_NOW',
        action: 'REVIEW_ONLY_DO_NOT_EXECUTE',
        nonExecutable: true,
        purpose: 'Prepare empty future evidence slots only; do not write production evidence or claim readiness.',
      },
      {
        id: 'stop_before_proof_start',
        owner: manifest.changeControl?.owner || 'UNASSIGNED_OWNER',
        action: 'REVIEW_ONLY_DO_NOT_EXECUTE',
        nonExecutable: true,
        purpose: 'Stop because production proof start requires a separate explicit future proof goal with exact approved boundaries.',
      },
    ],
    abortTriggers: [
      'Abort on production/staging endpoint, smoke, deploy, Wrangler, D1 access, D1 id, D1 binding, logs, secrets, real auth material, Cloudflare Access, or customer/private data.',
      'Abort on missing, stale, ambiguous, or non-Issue-165 future proof approval.',
      'Abort on broad endpoints, destructive or mutating SQL, rollback execution approval, destructive data action approval, or evidence write approval.',
      'Abort on manual note body, generated suggestion/helper text, provider input, raw session claims, token, cookie, auth header, private URL, account id, database id, CRM, outreach, LLM, or automation evidence.',
      'Abort on any attempt to flip productionReady or productionReviewerWorkflowReady to true.',
    ],
    rollbackStopWriteChecklist: [
      'Stop writes before repair, rollback, proof continuation, evidence capture, D1 command, endpoint call, cleanup, or deploy.',
      `Use rollback owner only after separate approval: ${rollbackOwner}.`,
      `Stop-write trigger: ${stopWriteTriggerText}.`,
      'Prefer non-destructive backout first and preserve existing data.',
      'Preserve redacted non-secret evidence only and require owner approval before any future action.',
    ],
    evidenceSlots: [
      {
        id: 'approval_packet_result',
        destination: 'tmp/codex/level1-production-proof-approval-dry-run-non-production-evidence.json',
        status: 'EMPTY_PENDING_FUTURE_APPROVAL',
        redactedOnly: true,
      },
      {
        id: 'change_control_plan',
        destination: 'tmp/codex/level1-production-proof-change-control-manifest-non-production-plan.json',
        status: 'EMPTY_PENDING_FUTURE_APPROVAL',
        redactedOnly: true,
      },
      {
        id: 'future_proof_evidence',
        destination: manifest.evidence?.destination || 'NO_DESTINATION_APPROVED_NOW',
        status: 'EMPTY_PENDING_FUTURE_APPROVAL',
        redactedOnly: true,
      },
    ],
    redactedValues,
    nonClaims: [
      'This operator rehearsal is not production proof.',
      'This operator rehearsal does not execute commands, deploy, call endpoints, inspect D1, read logs/secrets, parse real auth material, use customer/private data, or touch CRM/outreach/LLM/automation.',
      'This operator rehearsal does not approve proof start; Issue #165 remains HOLD until a separate explicit future production proof goal.',
      'productionReady remains false and productionReviewerWorkflowReady remains false.',
    ],
  };
}

export function evaluateLevel1OperatorRehearsal(input = {}) {
  const packetPath = input.packetPath || LEVEL1_APPROVAL_PACKET_PATH;
  const manifestPath = input.manifestPath || LEVEL1_CHANGE_CONTROL_MANIFEST_PATH;
  const packetText = input.packetText ?? readFileSync(packetPath, 'utf8');
  const manifest = input.manifest || JSON.parse(readFileSync(manifestPath, 'utf8'));
  const now = input.now instanceof Date
    ? input.now
    : new Date(input.now || process.env.LEVEL1_OPERATOR_REHEARSAL_NOW || Date.now());
  const generatedAt = Number.isFinite(now.getTime()) ? now.toISOString() : new Date().toISOString();
  const env = {
    LEVEL1_PROOF_PREFLIGHT_ENV: 'local_test',
    ...(input.env || {}),
  };
  const urls = input.urls || [...DEFAULT_REHEARSAL_URLS];
  const futureEvidenceArtifact = input.evidenceArtifact || buildLevel1FutureProductionProofEvidenceArtifact({
    generatedAt,
    sourcePacketPath: packetPath,
  });

  const preflightResult = evaluateLevel1ProofPreflight({ env, urls });
  const approvalResult = evaluateLevel1ApprovalPacketDryRun({
    packetPath,
    packetText,
    evidenceArtifact: futureEvidenceArtifact,
    env,
    urls,
    rawInputs: input.rawInputs || DEFAULT_RAW_PROOF_INPUT,
  });
  const manifestResult = evaluateLevel1ChangeControlManifest({
    manifestPath,
    manifest,
    now,
  });
  const rollbackResult = evaluateLevel1RollbackGate({
    trigger: 'level1_operator_rehearsal_gate',
    stopWrites: true,
    requestedAction: 'preserve existing data and capture redacted evidence only',
  });
  const futureEvidenceValidation = validateLevel1FutureProductionProofEvidenceArtifact(futureEvidenceArtifact);
  const privacyRedaction = evaluatePrivacyRedaction(input.rawInputs || DEFAULT_RAW_PROOF_INPUT);

  const blockers = collectRehearsalBlockers({
    preflightResult,
    approvalResult,
    manifestResult,
    rollbackResult,
    futureEvidenceValidation,
    privacyRedaction,
  });
  const ok = preflightResult.ok
    && approvalResult.ok
    && manifestResult.ok
    && rollbackResult.status === 'PASS_LOCAL'
    && futureEvidenceValidation.ok
    && privacyRedaction.ok
    && blockers.length === 0;
  const gates = [
    { id: 'proof_preflight', status: statusFromOk(preflightResult.ok) },
    { id: 'approval_packet', status: statusFromOk(approvalResult.ok) },
    { id: 'change_control_manifest', status: statusFromOk(manifestResult.ok) },
    { id: 'rollback_stop_write', status: statusFromOk(rollbackResult.status === 'PASS_LOCAL') },
    { id: 'privacy_redaction', status: statusFromOk(privacyRedaction.ok) },
    { id: 'evidence_artifact', status: statusFromOk(futureEvidenceValidation.ok) },
    { id: 'production_proof_approval', status: 'HOLD' },
  ];
  const runbook = buildLevel1OperatorRehearsalRunbook({
    status: ok ? 'PASS_LOCAL' : 'HOLD',
    generatedAt,
    packetPath,
    manifestPath,
    manifest,
    gates,
    blockers,
    redactedValues: privacyRedaction.redactedValues,
  });

  return {
    ok,
    packetPath,
    manifestPath,
    blockers,
    preflight: preflightResult.evidence,
    approvalDryRun: approvalResult.evidence,
    changeControlPlan: manifestResult.plan,
    futureEvidenceValidation,
    runbook,
  };
}

function runCli() {
  const packetPath = optionValue('--packet') || LEVEL1_APPROVAL_PACKET_PATH;
  const manifestPath = optionValue('--manifest') || LEVEL1_CHANGE_CONTROL_MANIFEST_PATH;
  const urls = optionValues('--url');
  const result = evaluateLevel1OperatorRehearsal({
    packetPath,
    manifestPath,
    env: process.env,
    urls: urls.length > 0 ? urls : undefined,
  });
  const outputPath = optionValue('--output') || '';
  const { artifact: runbook } = writeJsonArtifactIfMateriallyChanged(
    outputPath,
    result.runbook
  );
  const output = process.argv.includes('--json')
    ? JSON.stringify(runbook, null, 2)
    : [
      `LEVEL1_OPERATOR_REHEARSAL_GATE_NON_PRODUCTION: ${runbook.status}`,
      `productionReady: ${runbook.productionReady}`,
      `productionReviewerWorkflowReady: ${runbook.productionReviewerWorkflowReady}`,
      `notProductionEvidence: ${runbook.notProductionEvidence}`,
      `proofStartBlocked: ${runbook.proofStartBlocked}`,
      `blockers: ${result.blockers.length}`,
    ].join('\n');
  console.log(output);
  if (!result.ok) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli();
}
