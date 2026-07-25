#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { redactLevel1EvidenceRecord } from '../worker/lib/level1-readiness-guards.js';
import { writeJsonArtifactIfMateriallyChanged } from './lib/cli-utils.mjs';

export const LEVEL1_CHANGE_CONTROL_MANIFEST_PATH =
  'docs/roadmap/b2b-lead-agent-level-1-production-proof-change-control-manifest-non-production.json';

export const LEVEL1_CHANGE_CONTROL_SCHEMA_PATH =
  'docs/roadmap/b2b-lead-agent-level-1-production-proof-change-control-manifest.schema.json';

const REQUIRED_VALUE_PATHS = Object.freeze([
  'schemaVersion',
  'documentStatus',
  'repo',
  'baseline.branch',
  'baseline.headSha',
  'boundary',
  'approvalStatus',
  'issueRefs.privacy',
  'issueRefs.authProviderSession',
  'issueRefs.productionD1Observation',
  'issueRefs.rollbackStopWrite',
  'issueRefs.finalProofApproval',
  'issueRefs.reviewerFeedback',
  'changeControl.owner',
  'changeControl.reviewer',
  'changeControl.operator',
  'changeControl.executionWindow.startsAt',
  'changeControl.executionWindow.expiresAt',
  'changeControl.executionWindow.timezone',
  'approvalRecord.sourceIssue',
  'approvalRecord.sourceUrl',
  'approvalRecord.status',
  'approvalRecord.approvedAt',
  'approvalRecord.expiresAt',
  'command.executionMode',
  'endpoint.boundary',
  'd1.bindingLabelNonSecret',
  'd1.databaseId',
  'fixture.policy',
  'fixture.fixtureId',
  'rollback.owner',
  'rollback.stopWriteTrigger',
  'evidence.destination',
]);

const REQUIRED_ARRAY_PATHS = Object.freeze([
  'baseline.mergedPrs',
  'command.allowlist',
  'command.denylist',
  'endpoint.allowedEndpoints',
  'redaction.rules',
  'abortConditions',
]);

const REQUIRED_TRUE_PATHS = Object.freeze([
  'notProductionEvidence',
  'redaction.required',
  'rollback.nonDestructiveBackoutFirst',
  'evidence.redactedOnly',
]);

const REQUIRED_FALSE_PATHS = Object.freeze([
  'productionReady',
  'productionReviewerWorkflowReady',
  'endpoint.broadEndpointsAllowed',
  'd1.schemaObservationApprovedNow',
  'd1.writeOrMigrationApprovedNow',
  'fixture.customerDataAllowed',
  'rollback.rollbackExecutionApproved',
  'rollback.destructiveDataActionApproved',
  'evidence.writeApprovedNow',
]);

const ALLOWED_OBJECT_KEYS = Object.freeze({
  '': [
    'schemaVersion',
    'documentStatus',
    'repo',
    'baseline',
    'boundary',
    'notProductionEvidence',
    'productionReady',
    'productionReviewerWorkflowReady',
    'approvalStatus',
    'issueRefs',
    'changeControl',
    'approvalRecord',
    'command',
    'endpoint',
    'd1',
    'fixture',
    'rollback',
    'redaction',
    'abortConditions',
    'evidence',
  ],
  baseline: ['branch', 'headSha', 'mergedPrs'],
  issueRefs: [
    'privacy',
    'authProviderSession',
    'productionD1Observation',
    'rollbackStopWrite',
    'finalProofApproval',
    'reviewerFeedback',
  ],
  changeControl: ['owner', 'reviewer', 'operator', 'executionWindow'],
  'changeControl.executionWindow': ['startsAt', 'expiresAt', 'timezone'],
  approvalRecord: ['sourceIssue', 'sourceUrl', 'status', 'approvedAt', 'expiresAt'],
  command: ['executionMode', 'allowlist', 'denylist'],
  endpoint: ['boundary', 'allowedEndpoints', 'broadEndpointsAllowed'],
  d1: [
    'bindingLabelNonSecret',
    'databaseId',
    'schemaObservationApprovedNow',
    'writeOrMigrationApprovedNow',
  ],
  fixture: ['policy', 'fixtureId', 'customerDataAllowed'],
  rollback: [
    'owner',
    'stopWriteTrigger',
    'nonDestructiveBackoutFirst',
    'rollbackExecutionApproved',
    'destructiveDataActionApproved',
  ],
  redaction: ['required', 'rules'],
  evidence: ['destination', 'redactedOnly', 'writeApprovedNow'],
});

const AMBIGUOUS_VALUE_PATTERN =
  /^(?:\*|any|all|unknown|todo|tbd|n\/a|na|none|yes|no|maybe|fill[_ -]?me|fill[_ -]?in)$/i;

const SECRET_OR_RAW_AUTH_FIELD_PATTERNS = Object.freeze([
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
]);

const PRIVATE_D1_FIELD_PATTERNS = Object.freeze([
  /^account[_-]?id$/i,
  /^database[_-]?id$/i,
  /^d1[_-]?(?:binding|database|database[_-]?id)$/i,
  /^private[_-]?database[_-]?id$/i,
]);

const SECRET_OR_RAW_AUTH_TEXT_PATTERNS = Object.freeze([
  /\b(?:authorization|proxy-authorization)\s*[:=]\s*[^\s,;]+/i,
  /\bbearer\s+[a-z0-9._~+/-]+=*/i,
  /\b(?:cookie|set-cookie)\s*[:=]\s*[^\r\n;]+/i,
  /\b(?:token|secret|api[_-]?key|password|jwt|session)\s*[:=]\s*[^\s,;]+/i,
]);

const PRODUCTION_URL_PATTERN =
  /https?:\/\/(?:[^/\s]+\.workers\.dev|[^/\s]+\.cloudflareworkers\.com|[^\s]*(?:prod|production|staging|preview)[^\s]*)(?:[/?#][^\s]*)?/i;

const PRODUCTION_COMMAND_PATTERN =
  /\b(?:wrangler|curl|--remote|deploy|smoke|production|staging|preview)\b/i;

const PRIVATE_D1_IDENTIFIER_PATTERN =
  /(?:database[_-]?id|account[_-]?id|[a-f0-9]{16,}|private[-_ ]?database[-_ ]?id)/i;

const BROAD_ENDPOINT_PATTERN = /^(?:\*|\/\*|\/|all|any|\/api\/\*)$/i;

const DESTRUCTIVE_SQL_PATTERN =
  /\b(?:drop\s+table|drop\s+index|delete\s+from|truncate\s+table|update\s+[\w".]+\s+set|insert\s+into|replace\s+into|merge\s+into|alter\s+table|create\s+(?:table|index|trigger))\b/i;

function optionValue(flag, argv = process.argv) {
  const index = argv.indexOf(flag);
  if (index < 0) return '';
  return argv[index + 1] || '';
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function pathParts(path) {
  return String(path || '').split('.').filter(Boolean);
}

function getPath(object, path) {
  return pathParts(path).reduce((current, part) => {
    if (current === undefined || current === null) return undefined;
    return current[part];
  }, object);
}

function formatPath(path) {
  return Array.isArray(path) ? path.map(String).join('.') : String(path || '');
}

function addBlocker(blockers, reason, path, detail = '') {
  const safeDetail = detail && SECRET_OR_RAW_AUTH_TEXT_PATTERNS.some((pattern) => pattern.test(String(detail)))
    ? '[REDACTED]'
    : detail;
  if (blockers.some((blocker) => blocker.reason === reason && blocker.path === path)) return;
  blockers.push({
    reason,
    path,
    detail: safeDetail,
    status: 'HOLD',
  });
}

function isMissing(value) {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function isAmbiguous(value) {
  return typeof value === 'string' && AMBIGUOUS_VALUE_PATTERN.test(value.trim());
}

function isIsoTimestamp(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
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

function pathStartsWith(path, prefix) {
  return formatPath(path).startsWith(prefix);
}

function validateRequiredShape(manifest, blockers) {
  for (const path of REQUIRED_VALUE_PATHS) {
    const value = getPath(manifest, path);
    if (isMissing(value) || isAmbiguous(value)) {
      addBlocker(blockers, 'missing_or_ambiguous_required_value', path, '[REDACTED]');
    }
  }

  for (const path of REQUIRED_ARRAY_PATHS) {
    const value = getPath(manifest, path);
    if (!Array.isArray(value) || value.length === 0) {
      addBlocker(blockers, 'missing_or_ambiguous_required_value', path, '[REDACTED]');
    }
  }

  for (const path of REQUIRED_TRUE_PATHS) {
    if (getPath(manifest, path) !== true) {
      addBlocker(blockers, 'missing_or_ambiguous_required_value', path, 'expected true');
    }
  }

  for (const path of REQUIRED_FALSE_PATHS) {
    if (getPath(manifest, path) !== false) {
      const reason = path === 'productionReady'
        ? 'production_ready_true_refused'
        : 'missing_or_ambiguous_required_value';
      addBlocker(blockers, reason, path, 'expected false');
    }
  }

  if (manifest.boundary !== 'NOT_PRODUCTION_EVIDENCE') {
    addBlocker(blockers, 'missing_or_ambiguous_required_value', 'boundary', 'expected NOT_PRODUCTION_EVIDENCE');
  }
  if (manifest.repo !== 'dooosp/b2b-lead-agent') {
    addBlocker(blockers, 'missing_or_ambiguous_required_value', 'repo', 'expected dooosp/b2b-lead-agent');
  }
}

function validateAllowedKeys(value, blockers, path = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const currentPath = formatPath(path);
  const allowedKeys = ALLOWED_OBJECT_KEYS[currentPath];
  if (!allowedKeys) {
    addBlocker(blockers, 'unexpected_manifest_field_refused', currentPath, '[REDACTED]');
    return;
  }

  for (const key of Object.keys(value)) {
    const childPath = path.concat(key);
    if (!allowedKeys.includes(key)) {
      addBlocker(blockers, 'unexpected_manifest_field_refused', formatPath(childPath), '[REDACTED]');
      continue;
    }
    validateAllowedKeys(value[key], blockers, childPath);
  }
}

function validateUnsafeValues(manifest, blockers) {
  walkValues(manifest, (value, path) => {
    const currentPath = formatPath(path);
    const field = String(path[path.length - 1] || '');

    if (SECRET_OR_RAW_AUTH_FIELD_PATTERNS.some((pattern) => pattern.test(field))) {
      addBlocker(blockers, 'secret_or_raw_auth_refused', currentPath, '[REDACTED]');
      return;
    }

    if (
      PRIVATE_D1_FIELD_PATTERNS.some((pattern) => pattern.test(field))
      && currentPath !== 'd1.databaseId'
    ) {
      addBlocker(blockers, 'd1_private_identifier_refused', currentPath, '[REDACTED]');
    }

    if (typeof value !== 'string') return;

    if (SECRET_OR_RAW_AUTH_TEXT_PATTERNS.some((pattern) => pattern.test(value))) {
      addBlocker(blockers, 'secret_or_raw_auth_refused', currentPath, '[REDACTED]');
    }

    if (DESTRUCTIVE_SQL_PATTERN.test(value)) {
      addBlocker(blockers, 'destructive_sql_refused', currentPath, '[REDACTED]');
    }

    if (
      pathStartsWith(path, 'command.allowlist')
      && PRODUCTION_COMMAND_PATTERN.test(value)
    ) {
      addBlocker(blockers, 'production_like_value_refused', currentPath, '[REDACTED]');
    }

    if (
      pathStartsWith(path, 'endpoint')
      && PRODUCTION_URL_PATTERN.test(value)
    ) {
      addBlocker(blockers, 'production_like_value_refused', currentPath, '[REDACTED]');
    }

    if (
      pathStartsWith(path, 'endpoint.allowedEndpoints')
      && BROAD_ENDPOINT_PATTERN.test(value.trim())
    ) {
      addBlocker(blockers, 'broad_endpoint_refused', currentPath, '[REDACTED]');
    }

    if (
      currentPath === 'd1.databaseId'
      && value !== 'NOT_RECORDED_NO_DATABASE_ID_ALLOWED'
    ) {
      addBlocker(blockers, 'd1_private_identifier_refused', currentPath, '[REDACTED]');
    }

    if (
      pathStartsWith(path, 'd1')
      && PRIVATE_D1_IDENTIFIER_PATTERN.test(value)
      && value !== 'NOT_RECORDED_NO_DATABASE_ID_ALLOWED'
    ) {
      addBlocker(blockers, 'd1_private_identifier_refused', currentPath, '[REDACTED]');
    }
  });
}

function validateRollback(manifest, blockers) {
  const rollback = manifest.rollback || {};
  if (
    isMissing(rollback.owner)
    || isMissing(rollback.stopWriteTrigger)
    || rollback.nonDestructiveBackoutFirst !== true
    || rollback.rollbackExecutionApproved !== false
    || rollback.destructiveDataActionApproved !== false
  ) {
    addBlocker(blockers, 'rollback_missing_or_unsafe', 'rollback', '[REDACTED]');
  }
}

function validateApprovalRecord(manifest, blockers, now = new Date()) {
  const record = manifest.approvalRecord || {};
  const status = String(record.status || '');
  const looksApproved = /APPROVED/i.test(status)
    && !/NO_NOT_UNTIL|NOT_APPROVED|NO_APPROVAL/i.test(status);

  if (looksApproved) {
    if (!isIsoTimestamp(record.approvedAt) || !isIsoTimestamp(record.expiresAt)) {
      addBlocker(blockers, 'stale_approval_refused', 'approvalRecord', 'approved manifests require ISO approvedAt and expiresAt');
      return;
    }
    if (new Date(record.expiresAt).getTime() <= now.getTime()) {
      addBlocker(blockers, 'stale_approval_refused', 'approvalRecord.expiresAt', '[REDACTED]');
    }
    if (!String(record.sourceUrl || '').includes('/issues/165')) {
      addBlocker(blockers, 'missing_or_ambiguous_required_value', 'approvalRecord.sourceUrl', 'Issue #165 source required');
    }
  }
}

function statusFromOk(ok) {
  return ok ? 'PASS' : 'HOLD';
}

export function validateLevel1ChangeControlManifest(manifest = {}, options = {}) {
  const blockers = [];
  const now = options.now instanceof Date
    ? options.now
    : new Date(options.now || process.env.LEVEL1_CHANGE_CONTROL_NOW || Date.now());

  validateRequiredShape(manifest, blockers);
  validateAllowedKeys(manifest, blockers);
  validateUnsafeValues(manifest, blockers);
  validateRollback(manifest, blockers);
  validateApprovalRecord(manifest, blockers, now);

  return {
    ok: blockers.length === 0,
    status: blockers.length === 0 ? 'PASS' : 'HOLD',
    schemaPath: LEVEL1_CHANGE_CONTROL_SCHEMA_PATH,
    blockers,
  };
}

export function buildLevel1ChangeControlDryRunPlan({
  manifest = {},
  validation = validateLevel1ChangeControlManifest(manifest),
  manifestPath = LEVEL1_CHANGE_CONTROL_MANIFEST_PATH,
  generatedAt = new Date().toISOString(),
} = {}) {
  const approvalOk = !validation.blockers.some((blocker) => (
    blocker.reason === 'stale_approval_refused'
    || blocker.path.startsWith('approvalRecord')
  ));

  return {
    documentStatus: 'LEVEL1_PRODUCTION_PROOF_CHANGE_CONTROL_DRY_RUN_PLAN_NON_PRODUCTION',
    status: validation.ok ? 'PASS' : 'HOLD',
    evidenceType: 'REDACTED_NON_EXECUTABLE_CHANGE_CONTROL_PLAN_ONLY',
    generatedAt,
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    notProductionEvidence: true,
    productionReady: false,
    productionReviewerWorkflowReady: false,
    approvalStatus: 'HOLD_PENDING_SEPARATE_EXPLICIT_FUTURE_PROOF_GOAL',
    sourceManifestPath: manifestPath,
    repo: manifest.repo || 'dooosp/b2b-lead-agent',
    manifestValidation: validation,
    manifestSummary: redactLevel1EvidenceRecord({
      schemaVersion: manifest.schemaVersion,
      documentStatus: manifest.documentStatus,
      owner: manifest.changeControl?.owner,
      reviewer: manifest.changeControl?.reviewer,
      operator: manifest.changeControl?.operator,
      commandExecutionMode: manifest.command?.executionMode,
      endpointBoundary: manifest.endpoint?.boundary,
      d1BindingLabelNonSecret: manifest.d1?.bindingLabelNonSecret,
      fixturePolicy: manifest.fixture?.policy,
      rollbackOwner: manifest.rollback?.owner,
      evidenceDestination: manifest.evidence?.destination,
      approvalRecord: manifest.approvalRecord,
    }),
    gates: [
      { id: 'manifest_schema', status: statusFromOk(validation.ok) },
      { id: 'local_non_executable_boundary', status: statusFromOk(validation.ok) },
      { id: 'approval_record', status: statusFromOk(approvalOk) },
      { id: 'production_proof_approval', status: 'HOLD' },
    ],
    nonExecutableSteps: [
      {
        id: 'review_manifest',
        action: 'REVIEW_ONLY_DO_NOT_EXECUTE',
        nonExecutable: true,
        purpose: 'Confirm manifest fields are complete, non-secret, and local gate compatible.',
      },
      {
        id: 'verify_issue_165',
        action: 'REVIEW_ONLY_DO_NOT_EXECUTE',
        nonExecutable: true,
        purpose: 'Verify Issue #165 still supplies the separate explicit proof approval blocker or a future explicit approval record.',
      },
      {
        id: 'verify_command_boundary',
        action: 'REVIEW_ONLY_DO_NOT_EXECUTE',
        nonExecutable: true,
        purpose: 'Review exact command labels without executing shell, Wrangler, D1, curl, deploy, or smoke commands.',
      },
      {
        id: 'verify_endpoint_and_d1_boundaries',
        action: 'REVIEW_ONLY_DO_NOT_EXECUTE',
        nonExecutable: true,
        purpose: 'Review endpoint and D1 labels only; do not call endpoints or inspect D1.',
      },
      {
        id: 'preserve_rollback_stop_write',
        action: 'REVIEW_ONLY_DO_NOT_EXECUTE',
        nonExecutable: true,
        purpose: 'Confirm rollback owner, stop-write trigger, non-destructive-first policy, and abort conditions are present.',
      },
      {
        id: 'prepare_redacted_evidence_destination',
        action: 'REVIEW_ONLY_DO_NOT_EXECUTE',
        nonExecutable: true,
        purpose: 'Confirm only a future separately approved proof may write redacted evidence to the named destination.',
      },
    ],
    nonClaims: [
      'This dry-run plan is not production proof.',
      'This dry-run plan does not execute commands, deploy, call endpoints, inspect D1, read logs/secrets, parse real auth material, use customer/private data, or touch CRM/outreach/LLM/automation.',
      'productionReady remains false.',
    ],
  };
}

export function evaluateLevel1ChangeControlManifest(input = {}) {
  const manifestPath = input.manifestPath || LEVEL1_CHANGE_CONTROL_MANIFEST_PATH;
  const manifest = input.manifest || JSON.parse(readFileSync(manifestPath, 'utf8'));
  const now = input.now instanceof Date
    ? input.now
    : new Date(input.now || process.env.LEVEL1_CHANGE_CONTROL_NOW || Date.now());
  const validation = validateLevel1ChangeControlManifest(manifest, { now });
  const generatedAt = Number.isFinite(now.getTime()) ? now.toISOString() : new Date().toISOString();
  const plan = buildLevel1ChangeControlDryRunPlan({
    manifest,
    validation,
    manifestPath,
    generatedAt,
  });

  return {
    ok: validation.ok,
    manifestPath,
    validation,
    plan,
  };
}

function runCli() {
  const manifestPath = optionValue('--manifest') || LEVEL1_CHANGE_CONTROL_MANIFEST_PATH;
  const result = evaluateLevel1ChangeControlManifest({ manifestPath });
  const outputPath = optionValue('--output');
  const { artifact: plan } = writeJsonArtifactIfMateriallyChanged(
    outputPath,
    result.plan
  );
  const output = process.argv.includes('--json')
    ? JSON.stringify(plan, null, 2)
    : [
      `LEVEL1_PRODUCTION_PROOF_CHANGE_CONTROL_MANIFEST_NON_PRODUCTION: ${plan.status}`,
      `productionReady: ${plan.productionReady}`,
      `notProductionEvidence: ${plan.notProductionEvidence}`,
      `nonExecutableSteps: ${plan.nonExecutableSteps.length}`,
      `blockers: ${result.validation.blockers.length}`,
    ].join('\n');
  console.log(output);
  if (!result.ok) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli();
}
