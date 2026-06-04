# Level 1 Post-Approval Decision Simulator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `LEVEL1_POST_APPROVAL_DECISION_SIMULATOR_NON_PRODUCTION`, a local-only simulator that evaluates synthetic Issue #165 approval-intake packets and returns `HOLD`, `BLOCKED`, or `READY_FOR_SEPARATE_HUMAN_EXECUTION`.

**Architecture:** Add one Node.js ESM simulator that consumes checked-in synthetic packet JSON only, validates the existing Issue #165 approval-intake fields, rejects unsafe or overclaiming evidence, and emits redacted `NOT_PRODUCTION_EVIDENCE`. Add focused tests and wire the simulator into the existing Level 1 local gate and closure dashboard without adding executable production commands.

**Tech Stack:** Node.js ESM scripts under `scripts/`, Node test runner under `worker/tests/`, existing npm scripts, JSON fixtures under `docs/roadmap/`, generated local artifacts under `tmp/codex/`, and source-of-truth Markdown under `docs/roadmap/`, `HARDENING_PLAN.md`, `NEXT_SESSION_PROMPT.md`, and `AGENTS.md`.

---

## Design

GOAL: add the final local-only pre-execution decision gate after PRs #171-#184.

WHY: the approval-intake gate makes Issue #165 input machine-checkable, but the repo still needs a conservative decision layer that separates unsafe or incomplete inputs from a complete synthetic packet that would still require separate human execution.

SUCCESS CRITERIA: tests cover complete synthetic approval, missing, vague, stale, contradictory, broad endpoints, private D1 IDs/bindings, secrets/raw auth, destructive SQL, customer-data policy gaps, rollback gaps, and `productionReady:true`; artifacts remain redacted `NOT_PRODUCTION_EVIDENCE`; closure dashboard records the new final decision gate and exact remaining human-only action.

NON-GOALS: no proof execution, production/staging endpoint calls, D1 access, deploy, logs/secrets, live scraping, customer/private data, CRM/outreach/automation/LLM, real auth/session/provider parsing, destructive SQL, fabricated evidence, or production-readiness claim.

SAFETY: fail closed; reject any executable production command; redact suspicious auth, secret, D1, private identifier, customer-data, and raw-provider material; allow `READY_FOR_SEPARATE_HUMAN_EXECUTION` only as a non-production planning decision.

VALIDATION: run simulator tests, dashboard/intake tests, simulator command, approval-intake command, closure dashboard command, `npm run check:level1`, naming/schema checks, security audit triage, and `npm test`.

STOP CONDITIONS: repo mismatch, unsafe dirty overlap, production/staging/D1/endpoint/log/secret/customer-data requirement, broad endpoint accepted, private D1 identifier accepted, destructive SQL accepted, unredacted secret output, stale approval accepted, or any `productionReady:true` accepted.

Checkpoints:

1. Add failing simulator acceptance tests.
2. Implement local-only simulator and synthetic packet fixtures.
3. Wire npm script and `check:level1`.
4. Sync closure dashboard and source-of-truth docs.
5. Run validation ladder and safety critics.
6. Commit, push, open PR, and merge only if CI is green and no production gate is weakened.

### Task 1: Preflight And Baseline

**Files:**
- Read: `AGENTS.md`, `package.json`, `.github/workflows/ci.yml`, `.github/workflows/validate-naming.yml`
- Read: `scripts/level1-production-proof-approval-intake-gate.mjs`, `scripts/level1-readiness-closure-dashboard.mjs`
- Read: Issues #154, #162, #163, #164, #165, #144 and PRs #171-#184 with `gh`

- [x] **Step 1: Prove repo identity**

Run: `git status --short --branch && git rev-parse --show-toplevel && git rev-parse HEAD && git branch --show-current && git remote -v`

Expected: branch `codex/level1-post-approval-decision-simulator-non-production`, repo `dooosp/b2b-lead-agent`, HEAD `bf5a627d2790828fa87ba6ee775e066a15359f20`, clean tracked status before edits.

- [x] **Step 2: Prove baseline dashboard/intake tests**

Run: `node --test worker/tests/level1-readiness-closure-dashboard.test.mjs worker/tests/level1-production-proof-approval-intake-gate.test.mjs`

Expected: current dashboard and approval-intake tests pass before simulator work.

### Task 2: Simulator Tests

**Files:**
- Create: `worker/tests/level1-post-approval-decision-simulator.test.mjs`

- [ ] **Step 1: Add acceptance tests**

Create tests that import future exports from `scripts/level1-post-approval-decision-simulator.mjs`:
- `LEVEL1_POST_APPROVAL_DECISION_SIMULATOR_STATUS`
- `buildLevel1PostApprovalDecisionSimulatorArtifact`
- `evaluateLevel1PostApprovalDecision`
- `renderLevel1PostApprovalDecisionMarkdown`

Assert:
- complete synthetic approval returns `READY_FOR_SEPARATE_HUMAN_EXECUTION`
- missing, vague, stale, contradictory, rollback-gap, and customer-policy-gap packets fail closed
- broad endpoint, D1 private identifier/binding, secret/raw auth, destructive SQL, and `productionReady:true` packets fail closed
- CLI writes redacted JSON and Markdown artifacts under `tmp/codex/`

- [ ] **Step 2: Verify RED**

Run: `node --test worker/tests/level1-post-approval-decision-simulator.test.mjs`

Expected: fail because the simulator module does not exist yet.

### Task 3: Simulator Implementation

**Files:**
- Create: `scripts/level1-post-approval-decision-simulator.mjs`
- Create: `docs/roadmap/b2b-lead-agent-level-1-post-approval-decision-simulator-synthetic-packets-non-production.json`
- Create: `tmp/codex/level1-post-approval-decision-simulator-non-production.json`
- Create: `docs/roadmap/b2b-lead-agent-level-1-post-approval-decision-simulator-non-production.md`
- Modify: `package.json`

- [ ] **Step 1: Implement simulator exports and CLI**

The CLI must support `--scenario`, `--json`, `--output`, `--markdown-output`, and `--now`. It must read only JSON from the checked-in synthetic fixture path, never execute commands, and always emit `notProductionEvidence:true`, `productionReady:false`, `productionReviewerWorkflowReady:false`, and `proofExecutionApproved:false`.

- [ ] **Step 2: Verify GREEN**

Run: `node --test worker/tests/level1-post-approval-decision-simulator.test.mjs`

Expected: simulator tests pass.

### Task 4: Dashboard And Gate Sync

**Files:**
- Modify: `scripts/level1-readiness-closure-dashboard.mjs`
- Modify: `worker/tests/level1-readiness-closure-dashboard.test.mjs`
- Modify: `package.json`
- Modify: `docs/roadmap/b2b-lead-agent-level-1-readiness-closure-dashboard-non-production.md`
- Modify: `HARDENING_PLAN.md`
- Modify: `NEXT_SESSION_PROMPT.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Add simulator to Level 1 gate inventory**

Add the simulator command and artifact to `check:level1` and the closure dashboard. Keep Issue #165 as the exact remaining blocker and make the remaining action "separate human production proof approval/execution only."

- [ ] **Step 2: Regenerate local artifacts**

Run:
- `npm run proof:level1:post-approval-simulator`
- `npm run proof:level1:approval-intake`
- `npm run proof:level1:closure-dashboard`

Expected: generated JSON/Markdown artifacts remain `NOT_PRODUCTION_EVIDENCE`.

### Task 5: Validation And Critics

**Files:**
- Read changed files and generated artifacts.

- [ ] **Step 1: Run validation**

Run:
- `git status --short`
- `git diff --check`
- `node --test worker/tests/level1-post-approval-decision-simulator.test.mjs worker/tests/level1-production-proof-approval-intake-gate.test.mjs worker/tests/level1-readiness-closure-dashboard.test.mjs worker/tests/workflow-contract.test.mjs`
- `npm run proof:level1:post-approval-simulator`
- `npm run proof:level1:approval-intake`
- `npm run proof:level1:closure-dashboard`
- `npm run check:level1`
- `npm run check:naming`
- `npm run check:schema`
- `npm run security:audit-triage`
- `npm test`

- [ ] **Step 2: Critics**

Review approval clarity, no-production boundary, privacy/PII redaction, evidence truth, CI safety, and git/PR/merge safety. Do not run local E2E unless the diff touches Worker runtime or UI behavior.

### Task 6: Publish

**Files:**
- Stage scoped simulator, test, docs, package, and generated artifact files only.

- [ ] **Step 1: Commit**

Run explicit `git add` paths and commit with message `Add Level 1 post-approval decision simulator`.

- [ ] **Step 2: Push and open PR**

Push `codex/level1-post-approval-decision-simulator-non-production` and open a PR with summary, files, validation, risks, non-production boundary, and Issue #165 status.

- [ ] **Step 3: Merge only if safe**

Merge only if the PR is scoped non-production, checks pass, CI is green, and no production gate is weakened.
