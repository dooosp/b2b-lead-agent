#!/usr/bin/env node

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

import { redactLevel1EvidenceRecord } from '../worker/lib/level1-readiness-guards.js';

export const LEVEL1_APPROVAL_INTAKE_GATE_STATUS =
  'LEVEL1_PRODUCTION_PROOF_APPROVAL_INTAKE_GATE_NON_PRODUCTION';

export const LEVEL1_APPROVAL_INTAKE_GATE_TIMESTAMP = '2026-06-03T00:00:00.000Z';

export const LEVEL1_APPROVAL_INTAKE_GATE_JSON_PATH =
  'tmp/codex/level1-production-proof-approval-intake-gate-non-production.json';

export const LEVEL1_APPROVAL_INTAKE_TEMPLATE_JSON_PATH =
  'docs/roadmap/b2b-lead-agent-level-1-production-proof-approval-intake-template-non-production.json';

export const LEVEL1_APPROVAL_INTAKE_GATE_MD_PATH =
  'docs/roadmap/b2b-lead-agent-level-1-production-proof-approval-intake-gate-non-production.md';

export const REQUIRED_APPROVAL_INTAKE_FIELD_IDS = Object.freeze([
  'target',
  'command_allowlist',
  'endpoint_boundary',
  'd1_boundary',
  'fixture_non_customer_data_policy',
  'evidence_redaction',
  'rollback_owner',
  'stop_conditions',
  'approver',
  'expires_at',
]);

const REQUIRED_REQUEST_PATHS = Object.freeze([
  ['target', 'target'],
  ['command_allowlist', 'commandAllowlist'],
  ['endpoint_boundary', 'endpointBoundary'],
  ['d1_boundary', 'd1Boundary'],
  ['fixture_non_customer_data_policy', 'fixtureNonCustomerDataPolicy'],
  ['evidence_redaction', 'evidenceRedaction'],
  ['rollback_owner', 'rollbackOwner'],
  ['stop_conditions', 'stopConditions'],
  ['approver', 'approver'],
  ['expires_at', 'expiresAt'],
]);

const MERGED_PRS = Object.freeze([171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183]);

const AMBIGUOUS_VALUE_PATTERN =
  /^(?:\*|any|all|unknown|todo|tbd|n\/a|na|none|yes|no|maybe|fill[_ -]?me|fill[_ -]?in)$/i;

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

const BROAD_ENDPOINT_PATTERN = /^(?:\*|\/\*|\/|all|any|\/api\/\*)$/i;

const DESTRUCTIVE_SQL_PATTERN =
  /\b(?:drop\s+table|drop\s+index|delete\s+from|truncate\s+table|update\s+[\w".]+\s+set|insert\s+into|replace\s+into|merge\s+into|alter\s+table|create\s+(?:table|index|trigger))\b/i;

const PRODUCTION_LIKE_COMMAND_PATTERN =
  /\b(?:wrangler|curl|--remote|deploy|smoke|production endpoint|staging endpoint|preview endpoint)\b/i;

const PRODUCTION_READY_CLAIM_PATTERN =
  /\b(?:productionReady\s*[:=]\s*true|productionReviewerWorkflowReady\s*[:=]\s*true|production proof executed|production reviewer workflow ready|APPROVED_FOR_PRODUCTION_PROOF_EXECUTION)\b/i;

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

function isAmbiguousValue(value) {
  if (typeof value === 'string') return AMBIGUOUS_VALUE_PATTERN.test(value.trim());
  if (Array.isArray(value)) return value.some((item) => isAmbiguousValue(item));
  return false;
}

function isIsoTimestamp(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

function formatPath(path) {
  return path.map(String).join('.');
}

function addBlocker(blockers, reason, path, detail = '') {
  const safeDetail = SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(String(detail)))
    || PRIVATE_D1_PATTERN.test(String(detail))
    ? '[REDACTED]'
    : detail;
  if (blockers.some((blocker) => blocker.reason === reason && blocker.path === path)) return;
  blockers.push({ reason, path, detail: safeDetail, status: 'HOLD' });
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

function valueList(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return [value];
  return [];
}

function getRequestValue(request, path) {
  return request?.[path];
}

function redactIntakeValue(value) {
  if (Array.isArray(value)) return value.map((item) => redactIntakeValue(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(redactLevel1EvidenceRecord(value)).map(([field, item]) => (
      [field, redactIntakeValue(item)]
    )));
  }
  if (
    typeof value === 'string'
    && (SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value)) || PRIVATE_D1_PATTERN.test(value))
  ) {
    return '[REDACTED]';
  }
  return value;
}

function redactedRequest(request = {}) {
  return redactIntakeValue(redactLevel1EvidenceRecord(request));
}

function isProhibitionText(value) {
  return PROHIBITION_CONTEXT_PATTERN.test(String(value || ''));
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

export function buildLevel1ApprovalIntakeRequestTemplate({
  generatedAt = LEVEL1_APPROVAL_INTAKE_GATE_TIMESTAMP,
} = {}) {
  return {
    schemaVersion: 'level1.production_proof_approval_intake.v1',
    documentStatus: LEVEL1_APPROVAL_INTAKE_GATE_STATUS,
    generatedAt,
    repo: 'dooosp/b2b-lead-agent',
    issue165: {
      issue: 165,
      url: 'https://github.com/dooosp/b2b-lead-agent/issues/165',
      status: 'OPEN_HOLD_PENDING_MACHINE_CHECKABLE_HUMAN_INPUT',
    },
    baseline: {
      branch: 'master',
      headSha: '808dde2b19a450207499672d05a9ed5d4215ad66',
      mergedPrs: MERGED_PRS,
      mergedPrRange: '#171-#183',
    },
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    notProductionEvidence: true,
    productionReady: false,
    productionReviewerWorkflowReady: false,
    approvalStatus: 'HOLD_PENDING_SEPARATE_EXPLICIT_FUTURE_PROOF_GOAL',
    proofExecutionApproved: false,
    nonExecutable: true,
    requiredApprovalFields: [
      {
        id: 'target',
        label: 'Target',
        required: true,
        valueKey: 'target',
        instructions: 'Non-secret target label only. Do not include private URLs, account IDs, database IDs, secrets, tokens, or customer data.',
      },
      {
        id: 'command_allowlist',
        label: 'Command Allowlist',
        required: true,
        valueKey: 'commandAllowlist',
        instructions: 'Exact future commands only. This intake template approves no command execution and rejects production-like or destructive commands.',
      },
      {
        id: 'endpoint_boundary',
        label: 'Endpoint Boundary',
        required: true,
        valueKey: 'endpointBoundary',
        instructions: 'Exact route labels only; broad endpoint patterns such as *, /, /*, all, any, or /api/* are refused.',
      },
      {
        id: 'd1_boundary',
        label: 'D1 Boundary',
        required: true,
        valueKey: 'd1Boundary',
        instructions: 'State the D1 boundary without private database IDs, account IDs, row data, row counts, writes, migrations, deletes, or repair actions.',
      },
      {
        id: 'fixture_non_customer_data_policy',
        label: 'Fixture / Non-Customer Data Policy',
        required: true,
        valueKey: 'fixtureNonCustomerDataPolicy',
        instructions: 'Synthetic fixtures or approved non-customer metadata only. Customer rows, payloads, real manual note text, and private lead/person data are refused.',
      },
      {
        id: 'evidence_redaction',
        label: 'Evidence Redaction',
        required: true,
        valueKey: 'evidenceRedaction',
        instructions: 'Name redaction rules for secrets, auth material, private identifiers, customer/private data, manual note bodies, generated suggestions, logs, CRM/outreach, and private lead/person fields.',
      },
      {
        id: 'rollback_owner',
        label: 'Rollback Owner',
        required: true,
        valueKey: 'rollbackOwner',
        instructions: 'Human rollback/backout owner for the future proof scope; this does not approve rollback execution.',
      },
      {
        id: 'stop_conditions',
        label: 'Stop Conditions',
        required: true,
        valueKey: 'stopConditions',
        instructions: 'Explicit abort triggers for boundary uncertainty, production/staging access, D1 access, endpoint calls, logs/secrets, customer data, destructive SQL, CRM/outreach/LLM/automation, and scope drift.',
      },
      {
        id: 'approver',
        label: 'Approver',
        required: true,
        valueKey: 'approver',
        instructions: 'Authorized human approver. Owner name alone is not approval unless the full scoped request is filled.',
      },
      {
        id: 'expires_at',
        label: 'Expiry',
        required: true,
        valueKey: 'expiresAt',
        instructions: 'ISO timestamp after the request review date. Expired or invalid timestamps are refused.',
      },
    ],
    copyPasteRequestTemplate: [
      'schemaVersion: level1.production_proof_approval_intake_request.v1',
      'repo: dooosp/b2b-lead-agent',
      'issue: 165',
      'boundary: NOT_PRODUCTION_EVIDENCE',
      'notProductionEvidence: true',
      'productionReady: false',
      'productionReviewerWorkflowReady: false',
      'proofExecutionApproved: false',
      'target:',
      'commandAllowlist:',
      'endpointBoundary:',
      'd1Boundary:',
      'fixtureNonCustomerDataPolicy:',
      'evidenceRedaction:',
      'rollbackOwner:',
      'stopConditions:',
      'approver:',
      'expiresAt:',
    ],
    reviewerChecklist: [
      'All required Issue #165 fields are filled with exact non-secret values.',
      'Command allowlist is exact and contains no production-like or destructive commands.',
      'Endpoint boundary is narrow and contains no broad wildcard endpoint.',
      'D1 boundary contains no private identifiers, row data, writes, migrations, deletes, or repair actions.',
      'Fixture policy forbids customer/private data and real manual note body text.',
      'Evidence redaction covers secrets, auth material, private IDs, customer/private data, manual note bodies, generated suggestions, logs, CRM/outreach, and private lead/person fields.',
      'Rollback owner and stop conditions are explicit.',
      'Approver and expiry are present, current, and scoped.',
      'The request remains non-executable and does not approve production proof.',
    ],
    criticChecklist: [
      'approval_clarity',
      'no_production',
      'privacy_pii',
      'evidence_truth',
      'ci_safety',
      'git_pr_merge_safety',
    ],
  };
}

export function validateLevel1ApprovalIntakeRequest(request = {}, {
  now = new Date(),
} = {}) {
  const blockers = [];

  if (request.repo !== 'dooosp/b2b-lead-agent') {
    addBlocker(blockers, 'invalid_repo', 'repo', request.repo || '');
  }
  if (request.issue !== 165) {
    addBlocker(blockers, 'invalid_issue', 'issue', String(request.issue || ''));
  }
  if (request.boundary !== 'NOT_PRODUCTION_EVIDENCE' || request.notProductionEvidence !== true) {
    addBlocker(blockers, 'invalid_evidence_boundary', 'boundary', request.boundary || '');
  }
  if (request.productionReady === true || request.productionReviewerWorkflowReady === true) {
    addBlocker(blockers, 'production_ready_claim_refused', 'productionReady', 'production readiness cannot be claimed by intake');
  }
  if (
    request.proofExecutionApproved === true
    || request.productionProofApproved === true
    || request.productionDeployApproved === true
    || request.productionD1WriteOrMigrationApproved === true
    || request.customerRowReadOrWriteApproved === true
    || request.logsSecretsAllowed === true
    || request.customerDataAllowed === true
  ) {
    addBlocker(blockers, 'contradictory_approval_refused', 'approvalFlags', 'execution/customer/log/secret approval is outside this intake gate');
  }

  for (const [fieldId, path] of REQUIRED_REQUEST_PATHS) {
    const value = getRequestValue(request, path);
    if (isMissing(value)) {
      addBlocker(blockers, 'missing_required_approval_field', path, fieldId);
      continue;
    }
    if (isAmbiguousValue(value)) {
      addBlocker(blockers, 'vague_approval_field_refused', path, fieldId);
    }
  }

  if (!isIsoTimestamp(request.expiresAt)) {
    addBlocker(blockers, 'invalid_expiry_refused', 'expiresAt', 'expiresAt must be an ISO timestamp');
  } else if (new Date(request.expiresAt).getTime() <= now.getTime()) {
    addBlocker(blockers, 'stale_or_expired_approval_refused', 'expiresAt', 'expiry is not after current validation time');
  }

  for (const endpoint of valueList(request.endpointBoundary)) {
    if (BROAD_ENDPOINT_PATTERN.test(String(endpoint).trim())) {
      addBlocker(blockers, 'broad_endpoint_refused', 'endpointBoundary', endpoint);
    }
  }

  for (const command of valueList(request.commandAllowlist)) {
    if (PRODUCTION_LIKE_COMMAND_PATTERN.test(String(command))) {
      addBlocker(blockers, 'production_like_command_refused', 'commandAllowlist', command);
    }
    if (DESTRUCTIVE_SQL_PATTERN.test(String(command))) {
      addBlocker(blockers, 'destructive_sql_refused', 'commandAllowlist', command);
    }
  }

  walkValues(request, (value, path) => {
    const joinedPath = formatPath(path);
    const field = String(path[path.length - 1] || '');
    const text = typeof value === 'string' ? value : '';

    if (SECRET_KEY_PATTERNS.some((pattern) => pattern.test(field)) || SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(text))) {
      addBlocker(blockers, 'secret_like_input_refused', joinedPath, '[REDACTED]');
    }
    if (PRIVATE_D1_PATTERN.test(text)) {
      addBlocker(blockers, 'd1_private_identifier_refused', joinedPath, '[REDACTED]');
    }
    if (DESTRUCTIVE_SQL_PATTERN.test(text) && joinedPath !== 'commandAllowlist' && !isProhibitionText(text)) {
      addBlocker(blockers, 'destructive_sql_refused', joinedPath, '[REDACTED]');
    }
    if (PRODUCTION_READY_CLAIM_PATTERN.test(text)) {
      addBlocker(blockers, 'production_ready_claim_refused', joinedPath, '[REDACTED]');
    }
    if (CUSTOMER_DATA_PATTERN.test(text) && !isProhibitionText(text)) {
      addBlocker(blockers, 'customer_data_input_refused', joinedPath, '[REDACTED]');
    }
  });

  const ok = blockers.length === 0;

  return {
    ok,
    status: ok
      ? 'PASS_LOCAL_INTAKE_REQUEST_MACHINE_CHECKABLE_HOLD_PRODUCTION'
      : 'HOLD',
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    notProductionEvidence: true,
    productionReady: false,
    productionReviewerWorkflowReady: false,
    proofExecutionApproved: false,
    blockers,
    redactedRequest: redactedRequest(request),
    nonClaims: [
      'This validation is not production proof.',
      'This validation does not execute commands, call endpoints, access D1, read logs/secrets, use customer/private data, deploy, or approve production readiness.',
      'Issue #165 remains open until a separate explicit future proof goal is approved.',
    ],
  };
}

export function buildLevel1ApprovalIntakeGateArtifact({
  generatedAt = LEVEL1_APPROVAL_INTAKE_GATE_TIMESTAMP,
  request = null,
  now = new Date(generatedAt),
} = {}) {
  const template = buildLevel1ApprovalIntakeRequestTemplate({ generatedAt });
  const requestValidation = request
    ? validateLevel1ApprovalIntakeRequest(request, { now })
    : {
      ok: false,
      status: 'HOLD_TEMPLATE_ONLY_NO_OWNER_REQUEST',
      boundary: 'NOT_PRODUCTION_EVIDENCE',
      notProductionEvidence: true,
      productionReady: false,
      productionReviewerWorkflowReady: false,
      proofExecutionApproved: false,
      blockers: REQUIRED_APPROVAL_INTAKE_FIELD_IDS.map((field) => ({
        reason: 'owner_input_not_provided',
        path: field,
        detail: 'template requires future human input',
        status: 'HOLD',
      })),
      redactedRequest: {},
      nonClaims: [
        'Template generation is not approval.',
        'Issue #165 remains open and production proof remains blocked.',
      ],
    };

  return {
    schemaVersion: 'level1.production_proof_approval_intake_gate.v1',
    documentStatus: LEVEL1_APPROVAL_INTAKE_GATE_STATUS,
    generatedAt,
    repo: 'dooosp/b2b-lead-agent',
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    notProductionEvidence: true,
    productionReady: false,
    productionReviewerWorkflowReady: false,
    proofExecutionApproved: false,
    approvalStatus: 'HOLD_PENDING_SEPARATE_EXPLICIT_FUTURE_PROOF_GOAL',
    issue165: template.issue165,
    baseline: template.baseline,
    template,
    requestValidation,
    reviewerChecklist: template.reviewerChecklist,
    criticChecklist: template.criticChecklist,
    artifacts: {
      json: LEVEL1_APPROVAL_INTAKE_TEMPLATE_JSON_PATH,
      markdown: LEVEL1_APPROVAL_INTAKE_GATE_MD_PATH,
      gateEvidence: LEVEL1_APPROVAL_INTAKE_GATE_JSON_PATH,
    },
    exactRemainingApprovalFields: REQUIRED_APPROVAL_INTAKE_FIELD_IDS,
    nonExecutable: true,
    nonClaims: [
      'This gate is not production proof.',
      'This gate does not approve or execute production proof.',
      'This gate does not deploy, access production/staging D1, call endpoints, read logs/secrets, use customer/private data, run CRM/outreach/LLM/automation, parse real auth/session/provider material, or claim production readiness.',
      'Issue #165 remains the final explicit future production proof approval blocker.',
    ],
  };
}

export function renderLevel1ApprovalIntakeMarkdown(
  artifact = buildLevel1ApprovalIntakeGateArtifact(),
) {
  const fieldRows = artifact.template.requiredApprovalFields.map((field) => (
    `| \`${field.id}\` | \`${field.valueKey}\` | ${field.instructions} |`
  ));
  const lines = [
    '# Level 1 Production Proof Approval Intake Gate (Non-Production)',
    '',
    `Document Status: \`${artifact.documentStatus}\``,
    `Boundary: \`${artifact.boundary}\``,
    `Generated At: \`${artifact.generatedAt}\``,
    `Repo: \`${artifact.repo}\``,
    `Issue #165: \`${artifact.issue165.status}\``,
    `Baseline: \`${artifact.baseline.branch}@${artifact.baseline.headSha}\``,
    `Merged PR Range: \`${artifact.baseline.mergedPrRange}\``,
    `productionReady: \`${String(artifact.productionReady)}\``,
    `productionReviewerWorkflowReady: \`${String(artifact.productionReviewerWorkflowReady)}\``,
    `proofExecutionApproved: \`${String(artifact.proofExecutionApproved)}\``,
    `Request Validation: \`${artifact.requestValidation.status}\``,
    '',
    'This artifact is `NOT_PRODUCTION_EVIDENCE`. It is a non-executable Issue #165 approval-intake template and validator output only.',
    '',
    '## Required Approval Fields',
    '',
    '| Field | JSON key | Requirement |',
    '| --- | --- | --- |',
    ...fieldRows,
    '',
    '## Copy-Paste JSON Shape',
    '',
    '```text',
    ...artifact.template.copyPasteRequestTemplate,
    '```',
    '',
    '## Reviewer Checklist',
    '',
    ...artifact.reviewerChecklist.map((item) => `- ${item}`),
    '',
    '## Critic Checklist',
    '',
    ...artifact.criticChecklist.map((item) => `- \`${item}\``),
    '',
    '## Validation Result',
    '',
    `- Status: \`${artifact.requestValidation.status}\``,
    `- Blockers: \`${artifact.requestValidation.blockers.length}\``,
    `- Production proof remains blocked by Issue #165: ${artifact.issue165.url}`,
    '',
    '## Non-Claims',
    '',
    ...artifact.nonClaims.map((item) => `- ${item}`),
  ];

  return `${lines.join('\n')}\n`;
}

function runCli() {
  const requestPath = optionValue('--request');
  const generatedAt = optionValue('--generated-at') || LEVEL1_APPROVAL_INTAKE_GATE_TIMESTAMP;
  const nowValue = optionValue('--now') || generatedAt;
  const now = new Date(nowValue);
  const request = requestPath ? readJson(requestPath) : null;
  const artifact = buildLevel1ApprovalIntakeGateArtifact({ generatedAt, request, now });
  const outputPath = optionValue('--output') || LEVEL1_APPROVAL_INTAKE_GATE_JSON_PATH;
  const templateOutputPath = optionValue('--template-output');
  const markdownOutputPath = optionValue('--markdown-output') || LEVEL1_APPROVAL_INTAKE_GATE_MD_PATH;

  if (hasFlag('--json') || hasFlag('--output')) {
    writeJsonArtifact(outputPath, artifact);
  }
  if (templateOutputPath) {
    writeJsonArtifact(templateOutputPath, artifact.template);
  }
  if (hasFlag('--markdown') || hasFlag('--markdown-output') || !hasFlag('--json')) {
    writeTextArtifact(markdownOutputPath, renderLevel1ApprovalIntakeMarkdown(artifact));
  }

  console.log(JSON.stringify({
    ok: request ? artifact.requestValidation.ok : true,
    documentStatus: artifact.documentStatus,
    boundary: artifact.boundary,
    productionReady: artifact.productionReady,
    proofExecutionApproved: artifact.proofExecutionApproved,
    requestValidationStatus: artifact.requestValidation.status,
    output: hasFlag('--json') || hasFlag('--output') ? outputPath : null,
    templateOutput: templateOutputPath || null,
    markdownOutput: hasFlag('--markdown') || hasFlag('--markdown-output') || !hasFlag('--json') ? markdownOutputPath : null,
  }, null, 2));

  if (request && !artifact.requestValidation.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli();
}
