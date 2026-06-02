# B2B Lead Agent Level 1 Operator Rehearsal Gate - Non-Production

`LEVEL1_OPERATOR_REHEARSAL_GATE_NON_PRODUCTION`

This packet adds a local-only end-to-end operator rehearsal for a future
separately approved Level 1 production reviewer workflow proof.

It is not production evidence. It does not execute proof, deploy, observe or
write D1, call endpoints, read logs or secrets, parse real auth material, call
Cloudflare Access, use customer/private data, touch CRM/outreach/LLM/automation,
or claim production readiness.

```text
productionReady: false
productionReviewerWorkflowReady: false
notProductionEvidence: true
proofStartBlocked: true
BOUNDARY: NOT_PRODUCTION_EVIDENCE
PRODUCTION_PROOF_APPROVED: NO_NOT_UNTIL_SEPARATE_EXPLICIT_FUTURE_PROOF_GOAL
```

## Source Inputs

The rehearsal consumes only checked-in non-production fixtures and documents:

- approval packet:
  `docs/roadmap/b2b-lead-agent-level-1-production-proof-approval-packet-non-production.md`;
- change-control manifest:
  `docs/roadmap/b2b-lead-agent-level-1-production-proof-change-control-manifest-non-production.json`;
- proof preflight script:
  `scripts/level1-proof-preflight.mjs`;
- approval dry-run script:
  `scripts/level1-production-proof-approval-dry-run.mjs`;
- change-control manifest script:
  `scripts/level1-production-proof-change-control-manifest.mjs`;
- local readiness/redaction helpers:
  `worker/lib/level1-readiness-guards.js`.

The consumed baseline records PRs #171, #172, #173, #174, #175, #176, and
#177, with PR #177 as the change-control manifest gate at
`c61317144f5adb77516412af30e26925f1a97146`.

## Local Command

```bash
npm run proof:level1:operator-rehearsal
```

Generated local artifact:

```text
tmp/codex/level1-operator-rehearsal-non-production-runbook.json
```

The artifact is a redacted non-executable runbook. Every ordered step is marked:

```text
action: REVIEW_ONLY_DO_NOT_EXECUTE
nonExecutable: true
```

## Gate Sequence

The rehearsal maps the existing Level 1 gates into one operator sequence:

| Gate | Expected rehearsal status | Source |
| --- | --- | --- |
| Proof preflight | `PASS` | `npm run proof:level1:preflight` logic, local inputs only |
| Approval packet | `PASS` | approval packet completeness plus future evidence schema |
| Change-control manifest | `PASS` | manifest linter and non-executable planner |
| Rollback / stop-write | `PASS` | local rollback guard with stop-write enabled |
| Privacy / redaction | `PASS` | recursive evidence redaction helper |
| Evidence artifact | `PASS` | future evidence schema remains redacted and non-production |
| Production proof approval | `HOLD` | Issue #165 still requires a separate explicit future proof goal |

Successful rehearsal means `PASS_LOCAL` for the local operator rehearsal only.
It does not mean production proof is ready or approved.

## Ordered Operator Steps

1. Confirm source artifacts, issue references, merged PR train, and
   non-production boundary.
2. Review proof preflight output without providing production/staging URL, D1,
   secret, token, raw auth, or provider input.
3. Review approval packet dry-run output while Issue #165 keeps production
   proof approval on `HOLD`.
4. Review change-control manifest labels for command, endpoint, D1, fixture,
   evidence, approval record, and execution window without executing them.
5. Confirm rollback owner, stop-write trigger, non-destructive-first policy,
   and owner approval requirement.
6. Confirm privacy/redaction: evidence may contain only redacted pass/fail
   metadata, never protected bodies or private fields.
7. Prepare empty future evidence slots only.
8. Stop before proof start because a separate explicit future proof goal is
   still missing.

## Refusal Matrix

The rehearsal fails closed and keeps `proofStartBlocked: true` for:

- missing approval record;
- stale approval record;
- production or staging URL value;
- D1 binding, database id, account id, or D1 alias value;
- secret, token, cookie, auth header, raw auth/session, provider input, or
  Cloudflare Access credential-shaped value;
- destructive or mutating SQL/action text;
- broad endpoint scope such as `*`, `/`, `/*`, `ALL`, or `/api/*`;
- `productionReady: true`;
- missing rollback owner or stop-write trigger.

All blocker details are redacted before they enter the runbook.

## Evidence Slots

The runbook includes empty future evidence slots:

- approval dry-run result;
- change-control dry-run plan;
- future proof evidence destination from the manifest.

Each slot remains `EMPTY_PENDING_FUTURE_APPROVAL`, `redactedOnly: true`, and
not production evidence. The rehearsal writes only its own local runbook
artifact.

## Abort Triggers

Abort immediately if any requested step would:

- deploy, smoke test production/staging, or call production/staging endpoints;
- access, observe, read, write, migrate, delete, count, repair, or lazy-DDL D1;
- read logs or secrets;
- parse real JWT, cookie, token, session, provider, or Cloudflare Access
  material;
- use customer/private data, private lead/person fields, customer rows, or real
  manual note body text;
- capture generated suggestion text or persist/export/history-store/attribute
  generated suggestions;
- use CRM, outreach, LLM, automation, or outcome learning;
- approve rollback execution, destructive data action, evidence writes, or
  production readiness without a separate explicit future proof goal.

## Validation

Required local validation:

```bash
node --test worker/tests/level1-operator-rehearsal.test.mjs
node --test worker/tests/workflow-contract.test.mjs
npm run proof:level1:operator-rehearsal
npm run check:level1
```

Broader validation remains:

```bash
git diff --check
npm run check:naming
npm run check:schema
npm run proof:level1:preflight
npm run proof:level1:approval-dry-run
npm run proof:level1:change-control-manifest
npm test
```

## Final Disposition

```text
LEVEL1_OPERATOR_REHEARSAL_GATE_NON_PRODUCTION: PASS_LOCAL_AFTER_COMMAND
PRODUCTION_PROOF_EXECUTION: NOT_APPROVED
PRODUCTION_REVIEWER_WORKFLOW_READY: false
PRODUCTION_READY: false
NEXT_HUMAN_APPROVAL_NEEDED: SEPARATE_EXPLICIT_FUTURE_PRODUCTION_PROOF_GOAL_WITH_EXACT_BOUNDARIES
```
