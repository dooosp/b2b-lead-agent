#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import {
  LEVEL1_APPROVAL_INTAKE_GATE_JSON_PATH,
  LEVEL1_APPROVAL_INTAKE_GATE_MD_PATH,
  LEVEL1_APPROVAL_INTAKE_TEMPLATE_JSON_PATH,
  REQUIRED_APPROVAL_INTAKE_FIELD_IDS,
} from './level1-production-proof-approval-intake-gate.mjs';

export const LEVEL1_READINESS_CLOSURE_DASHBOARD_STATUS =
  'LEVEL1_READINESS_CLOSURE_DASHBOARD_NON_PRODUCTION';

export const LEVEL1_READINESS_CLOSURE_DASHBOARD_TIMESTAMP = '2026-06-03T00:00:00.000Z';

export const LEVEL1_READINESS_CLOSURE_DASHBOARD_JSON_PATH =
  'tmp/codex/level1-readiness-closure-dashboard-non-production.json';

export const LEVEL1_READINESS_CLOSURE_DASHBOARD_MD_PATH =
  'docs/roadmap/b2b-lead-agent-level-1-readiness-closure-dashboard-non-production.md';

export const REQUIRED_LEVEL1_CLOSURE_GATE_IDS = Object.freeze([
  'auth_provider_session_scaffold',
  'proof_preflight_automation',
  'auth_adapter_route_audit',
  'production_proof_approval_dry_run',
  'level1_ci_regression_gate',
  'fail_closed_fault_injection',
  'production_proof_change_control_manifest',
  'operator_rehearsal_gate',
  'security_dependency_audit_triage',
  'outbound_enrichment_http_boundary',
  'enrichment_fixture_replay_output_contract',
  'lead_pipeline_fixture_replay_artifact_contract',
  'readiness_closure_dashboard',
  'production_proof_approval_intake_gate',
]);

const MERGED_PRS = Object.freeze([171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183]);

const ISSUE_REFS = Object.freeze({
  privacyRetention: {
    issue: 154,
    title: 'Privacy / Retention Owner Input Required for Level 1 Reviewer Workflow',
    status: 'OPEN_DOCS_PLANNING_INPUT_RECORDED',
    url: 'https://github.com/dooosp/b2b-lead-agent/issues/154',
    currentRecord: 'https://github.com/dooosp/b2b-lead-agent/issues/154#issuecomment-4525319355',
    dashboardMeaning: 'Conservative privacy and retention owner values are recorded for docs planning only; no implementation or proof approval.',
  },
  authProviderSession: {
    issue: 162,
    title: 'Level 1 Blocker: Auth Provider / Session / Production Roles Owner Input',
    status: 'OPEN_DOCS_PLANNING_INPUT_RECORDED',
    url: 'https://github.com/dooosp/b2b-lead-agent/issues/162',
    currentRecord: 'https://github.com/dooosp/b2b-lead-agent/issues/162#issuecomment-4525315986',
    dashboardMeaning: 'Future Cloudflare Access / Zero Trust planning values are recorded; real auth/session/provider implementation remains unapproved.',
  },
  productionD1Observation: {
    issue: 163,
    title: 'Level 1 Blocker: Production D1 Schema Observation Owner Input',
    status: 'OPEN_DOCS_PLANNING_INPUT_RECORDED',
    url: 'https://github.com/dooosp/b2b-lead-agent/issues/163',
    currentRecord: 'https://github.com/dooosp/b2b-lead-agent/issues/163#issuecomment-4525316833',
    dashboardMeaning: 'Future exact schema-observation allowlist is documented for planning only; no D1 access is approved now.',
  },
  rollbackStopWrite: {
    issue: 164,
    title: 'Level 1 Blocker: Rollback / Backout Owner And Stop-Write Policy',
    status: 'OPEN_DOCS_PLANNING_INPUT_RECORDED',
    url: 'https://github.com/dooosp/b2b-lead-agent/issues/164',
    currentRecord: 'https://github.com/dooosp/b2b-lead-agent/issues/164#issuecomment-4525317479',
    dashboardMeaning: 'Rollback owners, stop-write triggers, and non-destructive-first policy are documented for planning only; execution remains unapproved.',
  },
  finalProofApproval: {
    issue: 165,
    title: 'Level 1 Blocker: Final Production Reviewer Workflow Proof Approval',
    status: 'OPEN_HOLD_PENDING_SEPARATE_EXPLICIT_FUTURE_PROOF_GOAL',
    url: 'https://github.com/dooosp/b2b-lead-agent/issues/165',
    currentRecord: 'https://github.com/dooosp/b2b-lead-agent/issues/165#issuecomment-4586256037',
    dashboardMeaning: 'Exact remaining blocker: production proof execution is not approved until a separate future proof goal provides exact target, command, endpoint, D1, fixture, redaction, rollback, and stop-condition boundaries.',
  },
  reviewerFeedback: {
    issue: 144,
    title: 'Manual Review Notes v1 reviewer feedback intake',
    status: 'OPEN_OPTIONAL_FEEDBACK_INTAKE_RECORD_001_RECORDED',
    url: 'https://github.com/dooosp/b2b-lead-agent/issues/144',
    currentRecord: 'https://github.com/dooosp/b2b-lead-agent/issues/144#issuecomment-4503911395',
    dashboardMeaning: 'Feedback record 001 is P3/docs/no-follow-up; issue remains an optional future feedback intake container.',
  },
});

const VALIDATION_COMMANDS = Object.freeze([
  'git status --short',
  'git diff --check',
  'node --test worker/tests/level1-readiness-closure-dashboard.test.mjs worker/tests/workflow-contract.test.mjs',
  'npm run proof:level1:closure-dashboard',
  'npm run check:lead-pipeline-replay',
  'npm run check:enrichment-replay',
  'npm run check:enrichment-boundary',
  'npm run security:audit-triage',
  'npm audit --json',
  'npm audit --omit=dev --json',
  'npm run check:naming',
  'npm run check:schema',
  'npm run check:level1',
  'npm test',
]);

function issue(issueKey) {
  return ISSUE_REFS[issueKey];
}

function gate({
  id,
  title,
  status = 'PASS',
  sourcePr,
  command,
  artifacts = [],
  docs = [],
  issueKeys = [],
  blocker = '',
  risk = '',
  notes = '',
}) {
  return {
    id,
    title,
    status,
    sourcePr,
    sourcePrUrl: sourcePr ? `https://github.com/dooosp/b2b-lead-agent/pull/${sourcePr}` : null,
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    notProductionEvidence: true,
    productionReady: false,
    productionReviewerWorkflowReady: false,
    command,
    artifacts,
    docs,
    issues: issueKeys.map((key) => ({
      issue: issue(key).issue,
      url: issue(key).url,
      status: issue(key).status,
    })),
    blocker,
    risk,
    notes,
  };
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function addBlocker(blockers, reason, path, detail = '') {
  if (blockers.some((blocker) => blocker.reason === reason && blocker.path === path)) return;
  blockers.push({ reason, path, detail, status: 'HOLD' });
}

function hasProductionReadyClaim(value) {
  return value === true || String(value || '').toUpperCase() === 'PRODUCTION_READY';
}

function optionValue(flag, argv = process.argv) {
  const index = argv.indexOf(flag);
  if (index < 0) return '';
  return argv[index + 1] || '';
}

function hasFlag(flag, argv = process.argv) {
  return argv.includes(flag);
}

function writeJsonArtifact(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeTextArtifact(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value.endsWith('\n') ? value : `${value}\n`);
}

function buildGateInventory() {
  return [
    gate({
      id: 'auth_provider_session_scaffold',
      title: 'PR #171 local/test auth provider session scaffold',
      sourcePr: 171,
      command: 'npm run check:level1',
      artifacts: [
        'docs/roadmap/b2b-lead-agent-level-1-local-proof-simulation-evidence.md',
        'docs/roadmap/b2b-lead-agent-level-1-non-production-readiness-scorecard.md',
      ],
      docs: [
        'docs/roadmap/b2b-lead-agent-level-1-local-proof-simulation-evidence.md',
        'docs/roadmap/b2b-lead-agent-level-1-non-production-readiness-scorecard.md',
      ],
      issueKeys: ['privacyRetention', 'authProviderSession', 'productionD1Observation', 'rollbackStopWrite', 'finalProofApproval', 'reviewerFeedback'],
      risk: 'Synthetic role scaffold is not real auth and must not parse real JWT/cookie/session/provider material.',
      notes: 'Local fake-D1 route proof simulation covers reviewer, manager, admin, API-client, missing, unknown, and provider-error boundaries.',
    }),
    gate({
      id: 'proof_preflight_automation',
      title: 'PR #172 local proof preflight automation',
      sourcePr: 172,
      command: 'npm run proof:level1:preflight',
      artifacts: [
        'tmp/codex/level1-proof-preflight-automation-non-production-evidence.json',
        'tmp/codex/level1-proof-preflight-automation-non-production-preflight.json',
      ],
      docs: [
        'docs/roadmap/b2b-lead-agent-level-1-production-proof-preflight-packet.md',
        'docs/roadmap/b2b-lead-agent-level-1-non-production-readiness-scorecard.md',
      ],
      issueKeys: ['finalProofApproval'],
      risk: 'Preflight evidence is local synthetic evidence only; production hostnames, D1 labels, secrets, raw auth, and provider inputs are refused.',
      notes: 'Generated evidence must remain `NOT_PRODUCTION_EVIDENCE` and `productionReady:false`.',
    }),
    gate({
      id: 'auth_adapter_route_audit',
      title: 'PR #173 auth adapter route and privacy audit',
      sourcePr: 173,
      command: 'npm run check:level1',
      artifacts: [
        'tmp/codex/level1-auth-adapter-route-audit-non-production-evidence.json',
        'tmp/codex/level1-auth-adapter-route-audit-non-production-preflight.json',
      ],
      docs: [
        'docs/roadmap/b2b-lead-agent-level-1-auth-adapter-route-audit-non-production.md',
        'docs/roadmap/b2b-lead-agent-level-1-non-production-readiness-scorecard.md',
      ],
      issueKeys: ['privacyRetention', 'authProviderSession', 'finalProofApproval'],
      risk: 'Route audit uses synthetic roles only and does not establish production access control.',
      notes: 'Denied-role route/page/API checks omit protected manual notes, generated guidance, raw provider input, and auth material.',
    }),
    gate({
      id: 'production_proof_approval_dry_run',
      title: 'PR #174 production proof approval packet dry-run',
      sourcePr: 174,
      command: 'npm run proof:level1:approval-dry-run',
      artifacts: [
        'tmp/codex/level1-production-proof-approval-dry-run-non-production-evidence.json',
      ],
      docs: [
        'docs/roadmap/b2b-lead-agent-level-1-production-proof-approval-packet-non-production.md',
        'docs/roadmap/production-proof-boundaries.md',
      ],
      issueKeys: ['privacyRetention', 'authProviderSession', 'productionD1Observation', 'rollbackStopWrite', 'finalProofApproval', 'reviewerFeedback'],
      blocker: 'Issue #165 remains HOLD; dry-run is not proof execution.',
      risk: 'Approval packet is a local dry-run only and must refuse executable production scope.',
      notes: 'Future production evidence schema is checked locally while `productionReady:false` remains enforced.',
    }),
    gate({
      id: 'level1_ci_regression_gate',
      title: 'PR #175 CI-backed Level 1 non-production regression gate',
      sourcePr: 175,
      command: 'npm run check:level1',
      artifacts: [
        '.github/workflows/ci.yml',
        'package.json',
      ],
      docs: [
        'docs/roadmap/b2b-lead-agent-level-1-non-production-readiness-scorecard.md',
        'docs/roadmap/production-proof-boundaries.md',
      ],
      issueKeys: ['finalProofApproval'],
      risk: 'CI proves local-only regression coverage, not production readiness.',
      notes: '`check:level1` runs focused Level 1 tests and local dry-run artifact writers before full tests.',
    }),
    gate({
      id: 'fail_closed_fault_injection',
      title: 'PR #176 fail-closed fault injection and privacy redaction coverage',
      sourcePr: 176,
      command: 'npm run check:level1',
      artifacts: [
        'tmp/codex/level1-proof-preflight-automation-non-production-evidence.json',
        'tmp/codex/level1-production-proof-approval-dry-run-non-production-evidence.json',
      ],
      docs: [
        'docs/roadmap/b2b-lead-agent-level-1-non-production-readiness-scorecard.md',
        'docs/roadmap/production-proof-boundaries.md',
      ],
      issueKeys: ['privacyRetention', 'authProviderSession', 'finalProofApproval'],
      risk: 'Fault injection is local synthetic proof only; real provider, D1, and production endpoint behavior remain unobserved.',
      notes: 'Negative tests cover malformed claims, provider errors, poisoned inputs, denied roles, redaction, and rollback guard failures.',
    }),
    gate({
      id: 'production_proof_change_control_manifest',
      title: 'PR #177 production proof change-control manifest dry-run',
      sourcePr: 177,
      command: 'npm run proof:level1:change-control-manifest',
      artifacts: [
        'docs/roadmap/b2b-lead-agent-level-1-production-proof-change-control-manifest-non-production.json',
        'docs/roadmap/b2b-lead-agent-level-1-production-proof-change-control-manifest.schema.json',
        'tmp/codex/level1-production-proof-change-control-manifest-non-production-plan.json',
      ],
      docs: [
        'docs/roadmap/b2b-lead-agent-level-1-production-proof-change-control-manifest-non-production.md',
        'docs/roadmap/production-proof-boundaries.md',
      ],
      issueKeys: ['productionD1Observation', 'rollbackStopWrite', 'finalProofApproval'],
      blocker: 'Manifest is non-executable and has no approved execution window or operator.',
      risk: 'Manifest must not become an implicit command allowlist.',
      notes: 'The gate refuses production/staging URLs, D1 private identifiers, secrets/raw auth, destructive SQL, broad endpoints, stale approvals, and `productionReady:true`.',
    }),
    gate({
      id: 'operator_rehearsal_gate',
      title: 'PR #178 operator rehearsal non-production runbook',
      sourcePr: 178,
      command: 'npm run proof:level1:operator-rehearsal',
      artifacts: [
        'tmp/codex/level1-operator-rehearsal-non-production-runbook.json',
      ],
      docs: [
        'docs/roadmap/b2b-lead-agent-level-1-operator-rehearsal-gate-non-production.md',
        'docs/roadmap/production-proof-boundaries.md',
      ],
      issueKeys: ['rollbackStopWrite', 'finalProofApproval'],
      blocker: 'Runbook has `proofStartBlocked:true`; it is review-only and non-executable.',
      risk: 'Operator rehearsal must preserve empty evidence slots and abort triggers until a future proof goal is approved.',
      notes: 'Ordered steps are labeled `REVIEW_ONLY_DO_NOT_EXECUTE` and keep Issue #165 on HOLD.',
    }),
    gate({
      id: 'security_dependency_audit_triage',
      title: 'PR #179 security dependency audit triage',
      sourcePr: 179,
      command: 'npm run security:audit-triage',
      artifacts: [
        'tmp/codex/security-dependency-audit-triage-non-production.json',
      ],
      docs: [
        'docs/roadmap/security-dependency-audit-triage-non-production.md',
      ],
      issueKeys: ['finalProofApproval'],
      risk: 'The triage tracks the known axios floor only; future advisories require new triage.',
      notes: 'Dependency audit gate keeps axios at or above the patched floor and records non-production triage evidence.',
    }),
    gate({
      id: 'outbound_enrichment_http_boundary',
      title: 'PR #180 outbound enrichment HTTP boundary guard',
      sourcePr: 180,
      command: 'npm run check:enrichment-boundary',
      artifacts: [
        'tmp/codex/outbound-http-enrichment-boundary-guards-non-production.json',
      ],
      docs: [
        'docs/roadmap/outbound-http-enrichment-boundary-guards-non-production.md',
      ],
      issueKeys: ['privacyRetention', 'finalProofApproval'],
      risk: 'Existing root enrichment can still use public outbound HTTP when intentionally run; this gate proves policy behavior with injected local fixtures.',
      notes: 'Boundary tests cover no auth/secret headers, redirect safety, timeouts, oversized bodies, network failures, and redacted audit artifacts.',
    }),
    gate({
      id: 'enrichment_fixture_replay_output_contract',
      title: 'PR #181 enrichment fixture replay output contract',
      sourcePr: 181,
      command: 'npm run check:enrichment-replay',
      artifacts: [
        'tmp/codex/enrichment-fixture-replay-output-contract-non-production.json',
      ],
      docs: [
        'docs/roadmap/enrichment-fixture-replay-output-contract-non-production.md',
      ],
      issueKeys: ['privacyRetention', 'finalProofApproval'],
      risk: 'Fixture replay is deterministic local replay only and does not prove live source behavior.',
      notes: 'Replay proves resolver/scraper output shape, failure taxonomy, stable timestamp, redaction, and zero live network calls.',
    }),
    gate({
      id: 'lead_pipeline_fixture_replay_artifact_contract',
      title: 'PR #182 lead pipeline fixture replay artifact contract',
      sourcePr: 182,
      command: 'npm run check:lead-pipeline-replay',
      artifacts: [
        'tmp/codex/lead-pipeline-fixture-replay-artifact-contract-non-production.json',
      ],
      docs: [
        'docs/roadmap/lead-pipeline-fixture-replay-artifact-contract-non-production.md',
      ],
      issueKeys: ['privacyRetention', 'finalProofApproval'],
      risk: 'Pipeline replay serializes labels and summaries only; it is not a replacement for canonical production lead publication proof.',
      notes: 'Replay links enrichment fixture outputs to lead-quality, report, publication summary, and release-evidence boundaries without raw URLs, live scraping, customer data, D1, CRM, outreach, LLM, or automation.',
    }),
    gate({
      id: 'readiness_closure_dashboard',
      title: 'PR #183 Level 1 readiness closure dashboard',
      sourcePr: 183,
      command: 'npm run proof:level1:closure-dashboard',
      artifacts: [
        LEVEL1_READINESS_CLOSURE_DASHBOARD_JSON_PATH,
        LEVEL1_READINESS_CLOSURE_DASHBOARD_MD_PATH,
      ],
      docs: [
        LEVEL1_READINESS_CLOSURE_DASHBOARD_MD_PATH,
        'docs/roadmap/current-pr-train.md',
      ],
      issueKeys: ['privacyRetention', 'authProviderSession', 'productionD1Observation', 'rollbackStopWrite', 'finalProofApproval', 'reviewerFeedback'],
      blocker: 'Dashboard records Issue #165 as the exact remaining blocker after PR #171-#183 local gates.',
      risk: 'Dashboard evidence is local/non-production only and must not be read as production reviewer workflow readiness.',
      notes: 'The dashboard inventories merged local-only gate artifacts, command list, issue map, risks, and future proof prerequisites.',
    }),
    gate({
      id: 'production_proof_approval_intake_gate',
      title: 'Current branch Issue #165 machine-checkable approval intake gate',
      sourcePr: null,
      command: 'npm run proof:level1:approval-intake',
      artifacts: [
        LEVEL1_APPROVAL_INTAKE_GATE_JSON_PATH,
        LEVEL1_APPROVAL_INTAKE_TEMPLATE_JSON_PATH,
        LEVEL1_APPROVAL_INTAKE_GATE_MD_PATH,
      ],
      docs: [
        LEVEL1_APPROVAL_INTAKE_TEMPLATE_JSON_PATH,
        LEVEL1_APPROVAL_INTAKE_GATE_MD_PATH,
        LEVEL1_READINESS_CLOSURE_DASHBOARD_MD_PATH,
      ],
      issueKeys: ['privacyRetention', 'authProviderSession', 'productionD1Observation', 'rollbackStopWrite', 'finalProofApproval', 'reviewerFeedback'],
      blocker: 'Issue #165 remains HOLD until the future approval request fills every required field and a separate proof goal is approved.',
      risk: 'A complete intake request is machine-checkable planning input only; it does not execute or approve production proof.',
      notes: `Required approval fields: ${REQUIRED_APPROVAL_INTAKE_FIELD_IDS.join(', ')}.`,
    }),
  ];
}

export function buildLevel1ReadinessClosureDashboard({
  generatedAt = LEVEL1_READINESS_CLOSURE_DASHBOARD_TIMESTAMP,
} = {}) {
  const gates = buildGateInventory();
  const commandList = unique([
    ...gates.map((item) => item.command),
    'npm run proof:level1:closure-dashboard',
    'npm run check:naming',
    'npm run check:schema',
    'npm run eval:lead-quality',
    'npm test',
  ]);
  const artifactList = unique(gates.flatMap((item) => item.artifacts));
  const docList = unique([
    ...gates.flatMap((item) => item.docs),
    'AGENTS.md',
    'HARDENING_PLAN.md',
    'NEXT_SESSION_PROMPT.md',
    'docs/roadmap/current-pr-train.md',
    LEVEL1_READINESS_CLOSURE_DASHBOARD_MD_PATH,
  ]);

  return {
    documentStatus: LEVEL1_READINESS_CLOSURE_DASHBOARD_STATUS,
    generatedAt,
    repo: 'dooosp/b2b-lead-agent',
    boundary: 'NOT_PRODUCTION_EVIDENCE',
    notProductionEvidence: true,
    productionReady: false,
    productionReviewerWorkflowReady: false,
    approvalStatus: 'HOLD_PENDING_SEPARATE_EXPLICIT_FUTURE_PROOF_GOAL',
    statusLegend: ['PASS', 'BLOCKED', 'HOLD'],
    productionReviewerWorkflow: {
      status: 'BLOCKED',
      blockedByIssue: 165,
      reason: 'Production reviewer workflow cannot be marked ready until Issue #165 is satisfied by a separate explicit future production proof goal.',
    },
    baseline: {
      branch: 'master',
      headSha: '808dde2b19a450207499672d05a9ed5d4215ad66',
      mergedPrs: MERGED_PRS,
      mergedPrRange: '#171-#183',
    },
    summary: {
      localGatesClosed: gates.filter((item) => item.status === 'PASS').length,
      holdGates: gates.filter((item) => item.status === 'HOLD').length,
      blockerIssuesMapped: Object.keys(ISSUE_REFS).length,
      productionProofStatus: 'HOLD',
      exactRemainingBlocker: 'Issue #165 requires a separate explicit future production proof goal before any production proof execution.',
    },
    gates,
    commandList,
    artifactList,
    docList,
    issueMap: Object.values(ISSUE_REFS),
    riskRegister: [
      {
        id: 'production_proof_not_run',
        status: 'HOLD',
        issue: 165,
        risk: 'All PR #171-#183 evidence plus the approval-intake gate are local/non-production only; production proof execution remains unapproved.',
      },
      {
        id: 'real_auth_not_implemented',
        status: 'HOLD',
        issue: 162,
        risk: 'Synthetic auth scaffold and adapter contracts are not real Cloudflare Access/session/provider parsing.',
      },
      {
        id: 'production_d1_unobserved',
        status: 'HOLD',
        issue: 163,
        risk: 'Production D1 schema, rows, logs, and writes were not accessed or observed.',
      },
      {
        id: 'privacy_enforcement_not_production_proof',
        status: 'HOLD',
        issue: 154,
        risk: 'Static privacy/redaction/local fixture checks are not production privacy enforcement or compliance proof.',
      },
      {
        id: 'operator_execution_not_approved',
        status: 'HOLD',
        issue: 164,
        risk: 'Rollback/backout policy is documented, but rollback execution and destructive data action remain unapproved.',
      },
      {
        id: 'feedback_intake_open',
        status: 'PASS',
        issue: 144,
        risk: 'Feedback record 001 requires no separate follow-up, but Issue #144 remains open for optional future feedback.',
      },
    ],
    futureProductionProofPrerequisites: [
      {
        id: 'separate_explicit_future_proof_goal',
        status: 'HOLD',
        blockedByIssue: 165,
        requirement: 'A new human-approved production proof goal with exact scope must be opened after the Issue #165 intake fields are machine-checkable and approved.',
      },
      {
        id: 'exact_command_allowlist',
        status: 'HOLD',
        blockedByIssue: 165,
        requirement: 'Exact command allowlist, denylist, operator, execution window, and stop conditions must be approved before execution.',
      },
      {
        id: 'endpoint_boundary',
        status: 'HOLD',
        blockedByIssue: 165,
        requirement: 'Any endpoint or route scope must be explicitly approved; none is approved now.',
      },
      {
        id: 'd1_boundary',
        status: 'HOLD',
        blockedByIssue: 165,
        requirement: 'Production D1 observation/write/migration/delete/row access remains unapproved.',
      },
      {
        id: 'fixture_and_redaction_policy',
        status: 'HOLD',
        blockedByIssue: 165,
        requirement: 'Future proof must use approved non-customer fixture or metadata policy and redacted evidence only.',
      },
      {
        id: 'rollback_and_abort_confirmation',
        status: 'HOLD',
        blockedByIssue: 165,
        requirement: 'Rollback owner, non-destructive-first policy, and abort triggers must be confirmed in the future proof scope.',
      },
    ],
    issue165Blocker: {
      issue: 165,
      status: 'HOLD',
      url: ISSUE_REFS.finalProofApproval.url,
      latestRelevantRecord: ISSUE_REFS.finalProofApproval.currentRecord,
      remainingBlocker: 'Issue #165 remains the exact blocker: a separate explicit future production proof goal must approve exact production target, command allowlist, endpoint boundary, D1 boundary, fixture/non-customer data policy, evidence redaction, rollback owner, and stop conditions before any production proof can run.',
      remainingApprovalFields: REQUIRED_APPROVAL_INTAKE_FIELD_IDS,
    },
    validationCommands: VALIDATION_COMMANDS,
    nonGoals: [
      'No production or staging deploy.',
      'No production or staging D1 access, schema observation, row read, row count, write, migration, delete, or repair.',
      'No production or staging endpoint calls, logs, secrets, smoke tests, or customer/private data.',
      'No live scraping during dashboard generation.',
      'No CRM, outreach, automation, LLM, real auth/session/provider parsing, or generated-suggestion persistence/export/history/attribution.',
      'No production-readiness claim.',
    ],
  };
}

export function validateLevel1ReadinessClosureDashboard(dashboard = {}) {
  const blockers = [];
  const gateIds = new Set((dashboard.gates || []).map((item) => item.id));

  if (dashboard.documentStatus !== LEVEL1_READINESS_CLOSURE_DASHBOARD_STATUS) {
    addBlocker(blockers, 'invalid_document_status', 'documentStatus', dashboard.documentStatus);
  }
  if (dashboard.boundary !== 'NOT_PRODUCTION_EVIDENCE') {
    addBlocker(blockers, 'invalid_boundary', 'boundary', dashboard.boundary);
  }
  if (dashboard.notProductionEvidence !== true) {
    addBlocker(blockers, 'not_production_evidence_missing', 'notProductionEvidence', dashboard.notProductionEvidence);
  }
  if (hasProductionReadyClaim(dashboard.productionReady) || hasProductionReadyClaim(dashboard.productionReviewerWorkflowReady)) {
    addBlocker(blockers, 'production_ready_claim_refused', 'productionReady', 'dashboard cannot claim production readiness');
  }
  if (dashboard.approvalStatus !== 'HOLD_PENDING_SEPARATE_EXPLICIT_FUTURE_PROOF_GOAL') {
    addBlocker(blockers, 'approval_status_not_hold', 'approvalStatus', dashboard.approvalStatus);
  }
  if (JSON.stringify(dashboard.statusLegend || []) !== JSON.stringify(['PASS', 'BLOCKED', 'HOLD'])) {
    addBlocker(blockers, 'status_legend_invalid', 'statusLegend', 'expected PASS/BLOCKED/HOLD');
  }
  if (dashboard.productionReviewerWorkflow?.status !== 'BLOCKED' || dashboard.productionReviewerWorkflow?.blockedByIssue !== 165) {
    addBlocker(blockers, 'production_reviewer_workflow_not_blocked', 'productionReviewerWorkflow', 'workflow must remain BLOCKED by Issue #165');
  }
  if (dashboard.issue165Blocker?.status !== 'HOLD' || dashboard.issue165Blocker?.issue !== 165) {
    addBlocker(blockers, 'issue_165_blocker_missing', 'issue165Blocker', 'Issue #165 must remain HOLD');
  }

  for (const id of REQUIRED_LEVEL1_CLOSURE_GATE_IDS) {
    if (!gateIds.has(id)) addBlocker(blockers, 'missing_required_gate', `gates.${id}`, id);
  }

  const prs = dashboard.baseline?.mergedPrs || [];
  const prsMatch = JSON.stringify(prs) === JSON.stringify(MERGED_PRS);
  if (!prsMatch || dashboard.baseline?.headSha !== '808dde2b19a450207499672d05a9ed5d4215ad66') {
    addBlocker(blockers, 'invalid_pr_lineage', 'baseline', 'expected merged PRs #171-#183 at PR #183 merge commit');
  }

  for (const [index, item] of (dashboard.gates || []).entries()) {
    if (item.boundary !== 'NOT_PRODUCTION_EVIDENCE' || item.notProductionEvidence !== true) {
      addBlocker(blockers, 'gate_boundary_invalid', `gates.${index}.boundary`, item.id);
    }
    if (hasProductionReadyClaim(item.productionReady) || hasProductionReadyClaim(item.productionReviewerWorkflowReady)) {
      addBlocker(blockers, 'gate_production_ready_claim_refused', `gates.${index}.productionReady`, item.id);
    }
    if (!['PASS', 'HOLD', 'BLOCKED'].includes(item.status)) {
      addBlocker(blockers, 'gate_status_invalid', `gates.${index}.status`, item.status);
    }
    if (!item.command) {
      addBlocker(blockers, 'gate_command_missing', `gates.${index}.command`, item.id);
    }
  }

  for (const command of [
    'npm run proof:level1:preflight',
    'npm run proof:level1:approval-dry-run',
    'npm run proof:level1:change-control-manifest',
    'npm run proof:level1:operator-rehearsal',
    'npm run proof:level1:closure-dashboard',
    'npm run security:audit-triage',
    'npm run check:enrichment-boundary',
    'npm run check:enrichment-replay',
    'npm run check:lead-pipeline-replay',
    'npm run check:level1',
    'npm run proof:level1:approval-intake',
  ]) {
    if (!(dashboard.commandList || []).includes(command)) {
      addBlocker(blockers, 'missing_required_command', `commandList.${command}`, command);
    }
  }

  for (const issueNumber of [154, 162, 163, 164, 165, 144]) {
    if (!(dashboard.issueMap || []).some((entry) => entry.issue === issueNumber)) {
      addBlocker(blockers, 'missing_required_issue_mapping', `issueMap.${issueNumber}`, String(issueNumber));
    }
  }

  if (!(dashboard.futureProductionProofPrerequisites || []).every((item) => item.status === 'HOLD' && item.blockedByIssue === 165)) {
    addBlocker(blockers, 'future_prerequisites_not_hold', 'futureProductionProofPrerequisites', 'all future proof prerequisites must remain blocked by Issue #165');
  }

  if (JSON.stringify(dashboard.issue165Blocker?.remainingApprovalFields || []) !== JSON.stringify(REQUIRED_APPROVAL_INTAKE_FIELD_IDS)) {
    addBlocker(blockers, 'issue_165_remaining_fields_invalid', 'issue165Blocker.remainingApprovalFields', 'Issue #165 intake field list changed');
  }

  return {
    ok: blockers.length === 0,
    blockers,
  };
}

function markdownTable(rows) {
  return rows.join('\n');
}

export function renderLevel1ReadinessClosureMarkdown(dashboard = buildLevel1ReadinessClosureDashboard()) {
  const validation = validateLevel1ReadinessClosureDashboard(dashboard);
  const lines = [
    '# Level 1 Readiness Closure Dashboard (Non-Production)',
    '',
    `Document Status: \`${dashboard.documentStatus}\``,
    `Boundary: \`${dashboard.boundary}\``,
    `Generated At: \`${dashboard.generatedAt}\``,
    `Repo: \`${dashboard.repo}\``,
    `Baseline: \`${dashboard.baseline?.branch}@${dashboard.baseline?.headSha}\``,
    `Merged PR Range: \`${dashboard.baseline?.mergedPrRange}\``,
    `productionReady: \`${String(dashboard.productionReady)}\``,
    `productionReviewerWorkflowReady: \`${String(dashboard.productionReviewerWorkflowReady)}\``,
    `Production Reviewer Workflow: \`${dashboard.productionReviewerWorkflow?.status}\``,
    `Approval Status: \`${dashboard.approvalStatus}\``,
    '',
    '## Summary',
    '',
    `- Local gates closed: \`${dashboard.summary?.localGatesClosed}\``,
    `- Hold gates: \`${dashboard.summary?.holdGates}\``,
    `- Production proof: \`${dashboard.summary?.productionProofStatus}\``,
    `- Exact remaining blocker: ${dashboard.summary?.exactRemainingBlocker}`,
    `- Validation: \`${validation.ok ? 'PASS' : 'HOLD'}\``,
    '',
    '## Gate Inventory',
    '',
    markdownTable([
      '| Gate | PR | Status | Command | Primary Artifact |',
      '| --- | ---: | --- | --- | --- |',
      ...dashboard.gates.map((item) => (
        `| \`${item.id}\` | ${item.sourcePr ? `#${item.sourcePr}` : '`current branch`'} | \`${item.status}\` | \`${item.command}\` | \`${item.artifacts[0] || 'none'}\` |`
      )),
    ]),
    '',
    '## Command List',
    '',
    ...dashboard.commandList.map((command) => `- \`${command}\``),
    '',
    '## Artifact List',
    '',
    ...dashboard.artifactList.map((artifact) => `- \`${artifact}\``),
    '',
    '## Issue Map',
    '',
    markdownTable([
      '| Issue | Status | Meaning |',
      '| ---: | --- | --- |',
      ...dashboard.issueMap.map((entry) => (
        `| #${entry.issue} | \`${entry.status}\` | ${entry.dashboardMeaning} |`
      )),
    ]),
    '',
    '## Risks',
    '',
    ...dashboard.riskRegister.map((risk) => `- \`${risk.id}\` (#${risk.issue}, ${risk.status}): ${risk.risk}`),
    '',
    '## Future Production-Proof Prerequisites',
    '',
    ...dashboard.futureProductionProofPrerequisites.map((item) => (
      `- \`${item.id}\` (${item.status}, Issue #${item.blockedByIssue}): ${item.requirement}`
    )),
    '',
    '## Issue #165 Blocker',
    '',
    `${dashboard.issue165Blocker.remainingBlocker}`,
    '',
    'Remaining approval fields:',
    '',
    ...dashboard.issue165Blocker.remainingApprovalFields.map((field) => `- \`${field}\``),
    '',
    '## Non-Goals',
    '',
    ...dashboard.nonGoals.map((nonGoal) => `- ${nonGoal}`),
  ];

  return `${lines.join('\n')}\n`;
}

export function writeLevel1ReadinessClosureDashboardArtifacts({
  jsonOutput = LEVEL1_READINESS_CLOSURE_DASHBOARD_JSON_PATH,
  markdownOutput = LEVEL1_READINESS_CLOSURE_DASHBOARD_MD_PATH,
  dashboard = buildLevel1ReadinessClosureDashboard(),
} = {}) {
  const validation = validateLevel1ReadinessClosureDashboard(dashboard);
  if (!validation.ok) {
    const error = new Error('Level 1 readiness closure dashboard validation failed.');
    error.validation = validation;
    throw error;
  }

  writeJsonArtifact(jsonOutput, dashboard);
  writeTextArtifact(markdownOutput, renderLevel1ReadinessClosureMarkdown(dashboard));

  return {
    dashboard,
    validation,
    jsonOutput,
    markdownOutput,
  };
}

async function main() {
  const jsonOutput = optionValue('--output') || LEVEL1_READINESS_CLOSURE_DASHBOARD_JSON_PATH;
  const markdownOutput = optionValue('--markdown-output') || LEVEL1_READINESS_CLOSURE_DASHBOARD_MD_PATH;
  const dashboard = buildLevel1ReadinessClosureDashboard();
  const validation = validateLevel1ReadinessClosureDashboard(dashboard);

  if (!validation.ok) {
    console.error(JSON.stringify({ ok: false, blockers: validation.blockers }, null, 2));
    process.exitCode = 1;
    return;
  }

  if (hasFlag('--json') || hasFlag('--output')) {
    writeJsonArtifact(jsonOutput, dashboard);
  }
  if (hasFlag('--markdown') || hasFlag('--markdown-output') || !hasFlag('--json')) {
    writeTextArtifact(markdownOutput, renderLevel1ReadinessClosureMarkdown(dashboard));
  }

  console.log(JSON.stringify({
    ok: true,
    documentStatus: dashboard.documentStatus,
    boundary: dashboard.boundary,
    productionReady: dashboard.productionReady,
    jsonOutput: hasFlag('--json') || hasFlag('--output') ? jsonOutput : null,
    markdownOutput: hasFlag('--markdown') || hasFlag('--markdown-output') || !hasFlag('--json') ? markdownOutput : null,
  }, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error?.stack || error);
    process.exitCode = 1;
  });
}
