import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  buildLevel1FutureProductionProofEvidenceArtifact,
  redactLevel1EvidenceRecord,
  validateLevel1FutureProductionProofEvidenceArtifact,
} from '../lib/level1-readiness-guards.js';
import {
  buildLevel1ApprovalPacketDryRunEvidence,
  evaluateLevel1ApprovalPacketDryRun,
  validateLevel1ApprovalPacketText,
} from '../../scripts/level1-production-proof-approval-dry-run.mjs';

const COMPLETE_PACKET_TEXT = `
# B2B Lead Agent Level 1 Production Proof Approval Packet - Non-Production

LEVEL1_PRODUCTION_PROOF_APPROVAL_PACKET_NON_PRODUCTION

This packet is not production evidence.
productionReady: false
notProductionEvidence: true
PRODUCTION_PROOF_APPROVED: NO_NOT_UNTIL_SEPARATE_EXPLICIT_FUTURE_PROOF_GOAL
PRODUCTION_REVIEWER_WORKFLOW_READY: false

## Prerequisites
- Issue #154: privacy residual values complete for docs planning only.
- Issue #162: auth provider/session/role owner input complete for docs planning only.
- Issue #163: production D1 schema observation path complete for docs planning only.
- Issue #164: rollback owner and stop-write policy complete for docs planning only.
- Issue #165: final proof approval remains blocked pending a separate explicit future proof goal.
- Issue #144: reviewer feedback intake remains non-production only.
- PR #171 merged.
- PR #172 merged.
- PR #173 merged.
- PR #174 merged.

## Owner Checklist
- PRODUCT_OWNER: @dooosp / Taeho Jang
- OPS_OWNER: @dooosp / Taeho Jang
- SECURITY_OWNER: @dooosp / Taeho Jang
- PRIVACY_OWNER: @dooosp / Taeho Jang
- DB_OWNER: @dooosp / Taeho Jang
- ROLLBACK_OWNER: @dooosp / Taeho Jang

## Future Approval Fields
- TARGET_LABEL_NON_SECRET
- EXACT_COMMAND_ALLOWLIST
- ENDPOINT_BOUNDARY
- D1_BOUNDARY
- FIXTURE_OR_NON_CUSTOMER_DATA_POLICY
- EVIDENCE_STORAGE_PATH
- REDACTION_RULES
- STOP_CONDITIONS
- EXPLICIT_NON_CLAIMS

## Evidence Requirements
- Evidence must use redacted non-secret fields only.
- Evidence schema must include boundary label NOT_PRODUCTION_EVIDENCE.
- Evidence must keep productionReady false.
- Evidence must keep notProductionEvidence true.

## Rollback And Stop-Write
- Rollback owner is @dooosp / Taeho Jang.
- Stop-write trigger applies on protected field leakage, generated suggestion persistence, privacy/redaction failure, endpoint exposure, or any unapproved access.

## Abort Conditions
- Abort on production proof execution without a separate explicit future proof goal.
- Abort on production or staging URLs.
- Abort on production D1 bindings, database IDs, row data, or row counts.
- Abort on secrets, tokens, cookies, auth headers, JWTs, raw session claims, or provider inputs.
- Abort on customer/private data, manual note body text, generated suggestion text, CRM, outreach, LLM, or automation.
`;

test('Level 1 approval packet text requires prerequisite, owner, rollback, evidence, and boundary markers', () => {
  const valid = validateLevel1ApprovalPacketText(COMPLETE_PACKET_TEXT);
  const missingIssue = validateLevel1ApprovalPacketText(COMPLETE_PACKET_TEXT.replace('Issue #154', 'Issue #154 omitted'));
  const unsafe = validateLevel1ApprovalPacketText(`${COMPLETE_PACKET_TEXT}\nmanualReviewNotes: Real note body must not enter packet.`);
  const destructive = validateLevel1ApprovalPacketText(`${COMPLETE_PACKET_TEXT}\nNotes: real note body\nmanualNote: alias body\nToken: leaked-token\ndestructiveDataActionApproved: true\nDROP TABLE manual_review_note_events;`);

  assert.equal(valid.ok, true);
  assert.deepEqual(valid.missingMarkers, []);
  assert.deepEqual(valid.forbiddenMatches, []);
  assert.equal(missingIssue.ok, false);
  assert.ok(missingIssue.missingMarkers.includes('Issue #154'));
  assert.equal(unsafe.ok, false);
  assert.ok(unsafe.forbiddenMatches.includes('manualReviewNotes'));
  assert.equal(destructive.ok, false);
  assert.ok(destructive.forbiddenMatches.includes('notes'));
  assert.ok(destructive.forbiddenMatches.includes('manualNote'));
  assert.ok(destructive.forbiddenMatches.includes('token'));
  assert.ok(destructive.forbiddenMatches.includes('destructiveDataActionApproved'));
  assert.ok(destructive.forbiddenMatches.includes('destructiveSql'));
});

test('Level 1 future proof evidence schema requires redacted non-production fields', () => {
  const artifact = buildLevel1FutureProductionProofEvidenceArtifact({
    generatedAt: '2026-05-31T00:00:00.000Z',
    sourcePacketPath: 'docs/roadmap/b2b-lead-agent-level-1-production-proof-approval-packet-non-production.md',
  });
  const valid = validateLevel1FutureProductionProofEvidenceArtifact(artifact);

  assert.equal(valid.ok, true);
  assert.deepEqual(valid.missingFields, []);
  assert.deepEqual(valid.forbiddenFieldPaths, []);
  assert.equal(artifact.boundary, 'NOT_PRODUCTION_EVIDENCE');
  assert.equal(artifact.productionReady, false);
  assert.equal(artifact.productionReviewerWorkflowReady, false);
  assert.equal(artifact.notProductionEvidence, true);
  assert.equal(new Date(artifact.generatedAt).toISOString(), artifact.generatedAt);

  const unsafe = {
    ...artifact,
    generatedAt: 'not-a-timestamp',
    boundary: 'PRODUCTION_EVIDENCE',
    productionReady: true,
    destructiveDataActionApproved: true,
    rollbackExecutionApproved: true,
    notes: 'Notes alias must not enter future evidence.',
    manualNote: 'Manual note alias must not enter future evidence.',
    noteBody: 'Note body alias must not enter future evidence.',
    manualReviewNotes: 'Manual note body must not enter future evidence.',
    nested: {
      generatedSuggestionText: 'Generated helper must not enter future evidence.',
      providerInput: 'Provider input must not enter future evidence.',
    },
  };
  delete unsafe.ownerChecklist;

  const invalid = validateLevel1FutureProductionProofEvidenceArtifact(unsafe);

  assert.equal(invalid.ok, false);
  assert.ok(invalid.missingFields.includes('ownerChecklist'));
  assert.ok(invalid.invalidFields.includes('generatedAt'));
  assert.ok(invalid.invalidFields.includes('boundary'));
  assert.ok(invalid.invalidFields.includes('productionReady'));
  assert.ok(invalid.forbiddenFieldPaths.includes('notes'));
  assert.ok(invalid.forbiddenFieldPaths.includes('manualNote'));
  assert.ok(invalid.forbiddenFieldPaths.includes('noteBody'));
  assert.ok(invalid.forbiddenFieldPaths.includes('manualReviewNotes'));
  assert.ok(invalid.forbiddenFieldPaths.includes('destructiveDataActionApproved'));
  assert.ok(invalid.forbiddenFieldPaths.includes('rollbackExecutionApproved'));
  assert.ok(invalid.forbiddenFieldPaths.includes('nested.generatedSuggestionText'));
  assert.ok(invalid.forbiddenFieldPaths.includes('nested.providerInput'));
});

test('Level 1 approval dry-run passes only with local inputs and blocked production proof approval', () => {
  const result = evaluateLevel1ApprovalPacketDryRun({
    env: {
      LEVEL1_PROOF_PREFLIGHT_ENV: 'local_test',
      WORKER_ENV: 'local',
      WORKER_ORIGIN: 'localhost:8787',
    },
    urls: ['http://localhost:8787/leads', 'https://synthetic.example/fixture'],
    packetText: COMPLETE_PACKET_TEXT,
    evidenceArtifact: buildLevel1FutureProductionProofEvidenceArtifact({
      generatedAt: '2026-05-31T00:00:00.000Z',
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.evidence.status, 'PASS');
  assert.equal(result.evidence.documentStatus, 'LEVEL1_PRODUCTION_PROOF_APPROVAL_PACKET_DRY_RUN_NON_PRODUCTION');
  assert.equal(result.evidence.boundary, 'NOT_PRODUCTION_EVIDENCE');
  assert.equal(result.evidence.notProductionEvidence, true);
  assert.equal(result.evidence.productionReady, false);
  assert.equal(result.evidence.productionReviewerWorkflowReady, false);
  assert.deepEqual(result.evidence.gates.map((gate) => [gate.id, gate.status]), [
    ['packet_completeness', 'PASS'],
    ['future_evidence_schema', 'PASS'],
    ['local_input_refusal', 'PASS'],
    ['production_proof_approval', 'HOLD'],
  ]);
});

test('Level 1 approval dry-run refuses production-like URLs D1 bindings secrets tokens and provider inputs', () => {
  const result = evaluateLevel1ApprovalPacketDryRun({
    env: {
      LEVEL1_PROOF_PREFLIGHT_ENV: 'staging',
      WORKER_ENV: 'production',
      WORKER_ORIGIN: 'https://b2b-lead-trigger.example.com',
      API_TOKEN: 'real-token-must-not-leak',
      AUTH_PROVIDER_SESSION_SCAFFOLD_PROVIDER: 'real-provider-input-must-not-leak',
      DB: { prepare() {} },
      DATABASE_ID: 'private-db-id-must-not-leak',
    },
    urls: ['https://b2b-lead-trigger.example.com/leads'],
    packetText: COMPLETE_PACKET_TEXT,
    evidenceArtifact: buildLevel1FutureProductionProofEvidenceArtifact({
      generatedAt: '2026-05-31T00:00:00.000Z',
    }),
  });
  const serialized = JSON.stringify(result);

  assert.equal(result.ok, false);
  assert.equal(result.evidence.status, 'HOLD');
  assert.ok(result.blockers.some((blocker) => blocker.reason === 'non_local_environment_refused'));
  assert.ok(result.blockers.some((blocker) => blocker.reason === 'secret_or_real_provider_input_refused'));
  assert.ok(result.blockers.some((blocker) => blocker.reason === 'd1_binding_or_private_identifier_refused'));
  assert.ok(result.blockers.some((blocker) => blocker.reason === 'production_or_non_local_url_refused'));
  assert.equal(serialized.includes('real-token-must-not-leak'), false);
  assert.equal(serialized.includes('real-provider-input-must-not-leak'), false);
  assert.equal(serialized.includes('private-db-id-must-not-leak'), false);
  assert.equal(serialized.includes('b2b-lead-trigger.example.com'), false);
});

test('Level 1 approval dry-run refuses auth header env poison and poisoned evidence artifacts', () => {
  const result = evaluateLevel1ApprovalPacketDryRun({
    env: {
      LEVEL1_PROOF_PREFLIGHT_ENV: 'local_test',
      WORKER_ENV: 'local',
      AUTHORIZATION: 'Bearer synthetic-auth-header',
      AUTHORIZATION_HEADER: 'Bearer synthetic-auth-header-alias',
      HTTP_AUTHORIZATION: 'Bearer synthetic-http-auth-header',
      CLOUDFLARE_API_KEY: 'synthetic-cloudflare-api-key',
      CF_ACCESS_AUD: 'synthetic-access-audience',
      D1_DATABASE_ID: 'synthetic-d1-database-id',
    },
    packetText: COMPLETE_PACKET_TEXT,
    evidenceArtifact: buildLevel1FutureProductionProofEvidenceArtifact({
      generatedAt: '2026-05-31T00:00:00.000Z',
      boundary: 'PRODUCTION_EVIDENCE',
      productionReady: true,
      approvalStatus: 'APPROVED',
      manualReviewNotes: 'Manual note body must not enter evidence.',
      rawAuth: { token: 'raw-auth-token-must-not-enter-evidence' },
    }),
    rawInputs: {
      authHeader: 'Bearer raw-input-auth-header',
    },
  });
  const serialized = JSON.stringify(result);

  assert.equal(result.ok, false);
  assert.equal(result.evidence.status, 'HOLD');
  assert.ok(result.evidence.gates.some((gate) => gate.id === 'future_evidence_schema' && gate.status === 'HOLD'));
  assert.ok(result.evidence.gates.some((gate) => gate.id === 'local_input_refusal' && gate.status === 'HOLD'));
  assert.ok(result.blockers.some((blocker) => blocker.key === 'AUTHORIZATION'));
  assert.ok(result.blockers.some((blocker) => blocker.key === 'AUTHORIZATION_HEADER'));
  assert.ok(result.blockers.some((blocker) => blocker.key === 'HTTP_AUTHORIZATION'));
  assert.ok(result.blockers.some((blocker) => blocker.key === 'CLOUDFLARE_API_KEY'));
  assert.ok(result.blockers.some((blocker) => blocker.key === 'CF_ACCESS_AUD'));
  assert.ok(result.blockers.some((blocker) => blocker.key === 'D1_DATABASE_ID'));
  assert.ok(result.evidenceValidation.invalidFields.includes('boundary'));
  assert.ok(result.evidenceValidation.invalidFields.includes('productionReady'));
  assert.ok(result.evidenceValidation.invalidFields.includes('approvalStatus'));
  assert.ok(result.evidenceValidation.forbiddenFieldPaths.includes('manualReviewNotes'));
  assert.ok(result.evidenceValidation.forbiddenFieldPaths.includes('rawAuth'));
  assert.equal(result.evidence.productionReady, false);
  assert.equal(result.evidence.notProductionEvidence, true);
  assert.equal(result.evidence.rawInputs.authHeader, '[REDACTED]');
  assert.equal(serialized.includes('synthetic-auth-header'), false);
  assert.equal(serialized.includes('raw-input-auth-header'), false);
  assert.equal(serialized.includes('Manual note body must not enter evidence'), false);
  assert.equal(serialized.includes('raw-auth-token-must-not-enter-evidence'), false);
});

test('Level 1 approval dry-run evidence builder redacts raw proof inputs recursively', () => {
  const evidence = buildLevel1ApprovalPacketDryRunEvidence({
    status: 'PASS',
    packetValidation: { ok: true, missingMarkers: [], forbiddenMatches: [] },
    evidenceValidation: { ok: true, missingFields: [], invalidFields: [], forbiddenFieldPaths: [] },
    blockers: [],
    rawInputs: {
      manualReviewNotes: 'Manual note body must not appear.',
      generatedSuggestionText: 'Generated helper must not appear.',
      providerInput: 'Provider input must not appear.',
      rawSessionClaims: { token: 'session-token-must-not-appear' },
      operatorComment: 'Authorization: Bearer operator-token-must-not-appear',
      nested: {
        note: 'manual note body: secret human text must not appear',
      },
    },
  });
  const serialized = JSON.stringify(evidence);

  assert.equal(evidence.rawInputs.manualReviewNotes, '[REDACTED]');
  assert.equal(evidence.rawInputs.generatedSuggestionText, '[REDACTED]');
  assert.equal(evidence.rawInputs.providerInput, '[REDACTED]');
  assert.equal(evidence.rawInputs.rawSessionClaims, '[REDACTED]');
  assert.equal(evidence.rawInputs.operatorComment, '[REDACTED]');
  assert.equal(evidence.rawInputs.nested.note, '[REDACTED]');
  assert.equal(serialized.includes('Manual note body must not appear'), false);
  assert.equal(serialized.includes('Generated helper must not appear'), false);
  assert.equal(serialized.includes('Provider input must not appear'), false);
  assert.equal(serialized.includes('session-token-must-not-appear'), false);
  assert.equal(serialized.includes('operator-token-must-not-appear'), false);
  assert.equal(serialized.includes('secret human text must not appear'), false);
});

test('Level 1 evidence redaction removes manual-note generated-guidance provider and raw auth fields', () => {
  const redacted = redactLevel1EvidenceRecord({
    manualReviewNotes: 'Manual note body must redact.',
    manual_review_notes: 'Snake note body must redact.',
    manualReviewNotesAuthorLabel: 'manual_reviewer',
    reviewNoteSuggestion: { text: 'Generated suggestion must redact.' },
    reviewNoteTemplates: [{ text: 'Generated template must redact.' }],
    providerInput: 'Raw provider input must redact.',
    rawSessionClaims: { sub: 'user-1', token: 'nested-token' },
    safeStatus: 'PASS_LOCAL',
  });
  const serialized = JSON.stringify(redacted);

  assert.equal(redacted.manualReviewNotes, '[REDACTED]');
  assert.equal(redacted.manual_review_notes, '[REDACTED]');
  assert.equal(redacted.manualReviewNotesAuthorLabel, '[REDACTED]');
  assert.equal(redacted.reviewNoteSuggestion, '[REDACTED]');
  assert.equal(redacted.reviewNoteTemplates, '[REDACTED]');
  assert.equal(redacted.providerInput, '[REDACTED]');
  assert.equal(redacted.rawSessionClaims, '[REDACTED]');
  assert.equal(redacted.safeStatus, 'PASS_LOCAL');
  assert.equal(serialized.includes('Manual note body must redact'), false);
  assert.equal(serialized.includes('Generated suggestion must redact'), false);
  assert.equal(serialized.includes('manual_reviewer'), false);
  assert.equal(serialized.includes('Raw provider input must redact'), false);
});

test('Level 1 approval dry-run CLI writes local non-production artifact only', () => {
  const dir = mkdtempSync(join(tmpdir(), 'level1-approval-dry-run-'));
  const packetPath = join(dir, 'packet.md');
  const outputPath = join(dir, 'dry-run.json');
  const scriptPath = fileURLToPath(new URL('../../scripts/level1-production-proof-approval-dry-run.mjs', import.meta.url));

  try {
    writeFileSync(packetPath, COMPLETE_PACKET_TEXT);
    const result = spawnSync(process.execPath, [
      scriptPath,
      '--json',
      '--packet',
      packetPath,
      '--output',
      outputPath,
      '--url',
      'http://localhost:8787/leads',
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
    assert.equal(artifact.documentStatus, 'LEVEL1_PRODUCTION_PROOF_APPROVAL_PACKET_DRY_RUN_NON_PRODUCTION');
    assert.equal(artifact.status, 'PASS');
    assert.equal(artifact.boundary, 'NOT_PRODUCTION_EVIDENCE');
    assert.equal(artifact.productionReady, false);
    assert.equal(artifact.notProductionEvidence, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
