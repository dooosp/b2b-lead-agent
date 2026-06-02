#!/usr/bin/env node

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

import { findLevel1ProofPreflightBlockers } from './level1-proof-preflight.mjs';
import {
  buildLevel1FutureProductionProofEvidenceArtifact,
  redactLevel1EvidenceRecord,
  validateLevel1FutureProductionProofEvidenceArtifact,
} from '../worker/lib/level1-readiness-guards.js';

export const LEVEL1_APPROVAL_PACKET_PATH =
  'docs/roadmap/b2b-lead-agent-level-1-production-proof-approval-packet-non-production.md';

const REQUIRED_PACKET_MARKERS = Object.freeze([
  ['LEVEL1_PRODUCTION_PROOF_APPROVAL_PACKET_NON_PRODUCTION', /LEVEL1_PRODUCTION_PROOF_APPROVAL_PACKET_NON_PRODUCTION/],
  ['not production evidence', /not production evidence/i],
  ['productionReady: false', /productionReady:\s*false/],
  ['notProductionEvidence: true', /notProductionEvidence:\s*true/],
  [
    'PRODUCTION_PROOF_APPROVED: NO_NOT_UNTIL_SEPARATE_EXPLICIT_FUTURE_PROOF_GOAL',
    /PRODUCTION_PROOF_APPROVED:\s*NO_NOT_UNTIL_SEPARATE_EXPLICIT_FUTURE_PROOF_GOAL/,
  ],
  ['PRODUCTION_REVIEWER_WORKFLOW_READY: false', /PRODUCTION_REVIEWER_WORKFLOW_READY:\s*false/],
  ['Issue #154', /Issue #154:/],
  ['Issue #162', /Issue #162:/],
  ['Issue #163', /Issue #163:/],
  ['Issue #164', /Issue #164:/],
  ['Issue #165', /Issue #165:/],
  ['Issue #144', /Issue #144:/],
  ['PR #171', /PR #171/],
  ['PR #172', /PR #172/],
  ['PR #173', /PR #173/],
  ['PR #174', /PR #174/],
  ['PR #175', /PR #175/],
  ['PR #176', /PR #176/],
  ['PR #177', /PR #177/],
  ['## Prerequisites', /## Prerequisites/],
  ['## Owner Checklist', /## Owner Checklist/],
  ['## Future Approval Fields', /## Future Approval Fields/],
  ['## Evidence Requirements', /## Evidence Requirements/],
  ['## Rollback And Stop-Write', /## Rollback And Stop-Write/],
  ['## Abort Conditions', /## Abort Conditions/],
  ['ROLLBACK_OWNER', /ROLLBACK_OWNER/],
  ['STOP_CONDITIONS', /STOP_CONDITIONS/],
  ['EVIDENCE_STORAGE_PATH', /EVIDENCE_STORAGE_PATH/],
  ['NOT_PRODUCTION_EVIDENCE', /NOT_PRODUCTION_EVIDENCE/],
]);

const FORBIDDEN_PACKET_FIELD_PATTERNS = Object.freeze([
  ['manualReviewNotes', /\bmanualReviewNotes\s*:/i],
  ['manual_review_notes', /\bmanual_review_notes\s*:/i],
  ['notes', /\bnotes\s*:/i],
  ['manualNote', /\bmanualNote\s*:/i],
  ['noteBody', /\bnoteBody\s*:/i],
  ['manualNoteBodyText', /\bmanualNoteBodyText\s*:/i],
  ['generatedSuggestionText', /\bgeneratedSuggestionText\s*:/i],
  ['reviewNoteSuggestion', /\breviewNoteSuggestion\s*:/i],
  ['reviewNoteTemplates', /\breviewNoteTemplates\s*:/i],
  ['providerInput', /\bproviderInput\s*:/i],
  ['rawSessionClaims', /\brawSessionClaims\s*:/i],
  ['authHeader', /\bauthHeader\s*:/i],
  ['cookie', /\bcookie\s*:/i],
  ['token', /\btoken\s*:/i],
  ['databaseId', /\bdatabaseId\s*:/i],
  ['destructiveDataActionApproved', /\bdestructiveDataActionApproved\s*:\s*true\b/i],
  ['rollbackExecutionApproved', /\brollbackExecutionApproved\s*:\s*true\b/i],
  ['destructiveSql', /\b(?:drop\s+table|delete\s+from|truncate\s+table|drop\s+index)\b/i],
]);

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

export function validateLevel1ApprovalPacketText(packetText = '') {
  const text = String(packetText || '');
  const missingMarkers = REQUIRED_PACKET_MARKERS
    .filter(([, pattern]) => !pattern.test(text))
    .map(([label]) => label);
  const forbiddenMatches = FORBIDDEN_PACKET_FIELD_PATTERNS
    .filter(([, pattern]) => pattern.test(text))
    .map(([label]) => label);

  return {
    ok: missingMarkers.length === 0 && forbiddenMatches.length === 0,
    missingMarkers,
    forbiddenMatches,
  };
}

export function buildLevel1ApprovalPacketDryRunEvidence({
  status = 'HOLD',
  packetValidation = { ok: false, missingMarkers: [], forbiddenMatches: [] },
  evidenceValidation = { ok: false, missingFields: [], invalidFields: [], forbiddenFieldPaths: [] },
  blockers = [],
  rawInputs = {},
} = {}) {
  return {
    documentStatus: 'LEVEL1_PRODUCTION_PROOF_APPROVAL_PACKET_DRY_RUN_NON_PRODUCTION',
    status,
    evidenceType: 'LOCAL_DRY_RUN_REDACTED_SYNTHETIC_ONLY',
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    notProductionEvidence: true,
    productionReady: false,
    productionReviewerWorkflowReady: false,
    approvalStatus: 'HOLD_PENDING_SEPARATE_EXPLICIT_FUTURE_PROOF_GOAL',
    gates: [
      { id: 'packet_completeness', status: statusFromOk(packetValidation.ok) },
      { id: 'future_evidence_schema', status: statusFromOk(evidenceValidation.ok) },
      { id: 'local_input_refusal', status: statusFromOk(blockers.length === 0) },
      { id: 'production_proof_approval', status: 'HOLD' },
    ],
    packetValidation,
    evidenceValidation,
    blockers,
    rawInputs: redactLevel1EvidenceRecord(rawInputs),
    nonClaims: [
      'This dry-run is not production proof.',
      'This dry-run does not access production/staging D1, endpoints, logs, secrets, auth material, customer/private data, CRM, outreach, LLM, or automation.',
      'productionReady remains false.',
    ],
  };
}

export function evaluateLevel1ApprovalPacketDryRun(input = {}) {
  const packetPath = input.packetPath || LEVEL1_APPROVAL_PACKET_PATH;
  const packetText = input.packetText ?? readFileSync(packetPath, 'utf8');
  const packetValidation = validateLevel1ApprovalPacketText(packetText);
  const evidenceArtifact = input.evidenceArtifact || buildLevel1FutureProductionProofEvidenceArtifact();
  const evidenceValidation = validateLevel1FutureProductionProofEvidenceArtifact(evidenceArtifact);
  const blockers = findLevel1ProofPreflightBlockers({
    env: input.env || {},
    urls: input.urls || [],
  });
  const ok = packetValidation.ok && evidenceValidation.ok && blockers.length === 0;
  const evidence = buildLevel1ApprovalPacketDryRunEvidence({
    status: ok ? 'PASS' : 'HOLD',
    packetValidation,
    evidenceValidation,
    blockers,
    rawInputs: input.rawInputs || {},
  });

  return {
    ok,
    packetPath,
    packetValidation,
    evidenceValidation,
    blockers,
    evidence,
  };
}

function runCli() {
  const packetPath = optionValue('--packet') || LEVEL1_APPROVAL_PACKET_PATH;
  const urls = optionValues('--url');
  const result = evaluateLevel1ApprovalPacketDryRun({
    env: process.env,
    urls,
    packetPath,
  });
  const output = process.argv.includes('--json')
    ? JSON.stringify(result.evidence, null, 2)
    : [
      `LEVEL1_PRODUCTION_PROOF_APPROVAL_PACKET_DRY_RUN_NON_PRODUCTION: ${result.evidence.status}`,
      `productionReady: ${result.evidence.productionReady}`,
      `notProductionEvidence: ${result.evidence.notProductionEvidence}`,
      `packetMissingMarkers: ${result.packetValidation.missingMarkers.length}`,
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
