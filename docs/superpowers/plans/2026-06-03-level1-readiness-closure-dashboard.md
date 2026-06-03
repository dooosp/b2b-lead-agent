# Level 1 Readiness Closure Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `LEVEL1_READINESS_CLOSURE_DASHBOARD_NON_PRODUCTION`, a single local-only dashboard artifact that closes the PR #171-#182 non-production readiness train without touching production.

**Architecture:** Add one generator script that owns the dashboard inventory and emits JSON plus Markdown. Add focused tests that validate gate coverage, issue mapping, command/doc/artifact consistency, PR lineage, `productionReady:false`, and refusal of production-ready or incomplete gate records. Keep source-of-truth docs as pointers to the dashboard rather than duplicating the full artifact.

**Tech Stack:** Node.js ESM script under `scripts/`, Node test runner under `worker/tests/`, existing npm scripts, existing roadmap docs, and generated local artifacts under `tmp/codex/`.

---

### Task 1: Preflight And Inventory

**Files:**
- Create: `tmp/codex/repo-preflight.json`
- Read: `package.json`, `.github/workflows/ci.yml`, `docs/roadmap/*.md`, `tmp/codex/*.json`, `AGENTS.md`, `HARDENING_PLAN.md`, `NEXT_SESSION_PROMPT.md`

- [x] **Step 1: Prove repo identity**

Run: `pwd && git rev-parse --show-toplevel && git branch --show-current && git rev-parse HEAD && git status --short && git remote -v`

Expected: isolated worktree on `codex/level1-readiness-closure-dashboard`, HEAD `7bc11e398415acdf480641f597eee6e3f4def228`, remote `https://github.com/dooosp/b2b-lead-agent.git`, clean status before edits.

- [x] **Step 2: Prove baseline tests**

Run: `npm ci && npm test`

Expected: dependency install with no vulnerabilities and full local unit/contract gate passing before implementation.

### Task 2: Dashboard Contract Tests

**Files:**
- Create: `worker/tests/level1-readiness-closure-dashboard.test.mjs`
- Modify: `worker/tests/workflow-contract.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write failing dashboard tests**

Add tests that import the future generator and assert:
- dashboard status is `LEVEL1_READINESS_CLOSURE_DASHBOARD_NON_PRODUCTION`
- `boundary` is `NOT_PRODUCTION_EVIDENCE`
- `productionReady` and `productionReviewerWorkflowReady` are false
- merged PRs are exactly #171-#182
- required gates include auth, proof preflight, route audit, approval dry-run, CI, fault injection, change control, operator rehearsal, security audit, enrichment boundary, enrichment replay, and lead pipeline replay
- issues #154/#162/#163/#164/#165/#144 are mapped
- future production proof prerequisites remain blocked on #165
- missing gates or `productionReady:true` are refused

- [ ] **Step 2: Run tests to verify RED**

Run: `node --test worker/tests/level1-readiness-closure-dashboard.test.mjs`

Expected: fail because the generator module does not exist yet.

### Task 3: Generator And Artifacts

**Files:**
- Create: `scripts/level1-readiness-closure-dashboard.mjs`
- Create: `tmp/codex/level1-readiness-closure-dashboard-non-production.json`
- Create: `docs/roadmap/b2b-lead-agent-level-1-readiness-closure-dashboard-non-production.md`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Implement generator**

Create exported functions:
- `buildLevel1ReadinessClosureDashboard`
- `validateLevel1ReadinessClosureDashboard`
- `renderLevel1ReadinessClosureMarkdown`

The CLI should support `--json`, `--markdown`, `--output`, and `--markdown-output`.

- [ ] **Step 2: Run dashboard tests to verify GREEN**

Run: `node --test worker/tests/level1-readiness-closure-dashboard.test.mjs`

Expected: pass.

- [ ] **Step 3: Generate dashboard artifacts**

Run: `npm run proof:level1:closure-dashboard`

Expected: writes JSON and Markdown artifacts marked `NOT_PRODUCTION_EVIDENCE`.

### Task 4: Source-Of-Truth Sync

**Files:**
- Modify: `AGENTS.md`
- Modify: `HARDENING_PLAN.md`
- Modify: `NEXT_SESSION_PROMPT.md`
- Modify: `docs/roadmap/current-pr-train.md`
- Modify: `docs/roadmap/b2b-lead-agent-level-1-non-production-readiness-scorecard.md`

- [ ] **Step 1: Add canonical dashboard pointers**

Update docs to state the dashboard is the canonical Level 1 non-production closure artifact after PR #182 and that production proof remains HOLD on Issue #165.

- [ ] **Step 2: Avoid overclaiming**

Search changed docs for production-ready or execution claims and keep all production/staging/D1/endpoint/log/secret/customer actions forbidden.

### Task 5: Validation And Critics

**Files:**
- Read changed files and generated artifacts only.

- [ ] **Step 1: Run prompt-required local validation**

Run:
`git status --short`
`git diff --check`
`node --test worker/tests/level1-readiness-closure-dashboard.test.mjs worker/tests/workflow-contract.test.mjs`
`npm run proof:level1:closure-dashboard`
`npm run check:lead-pipeline-replay`
`npm run check:enrichment-replay`
`npm run check:enrichment-boundary`
`npm run security:audit-triage`
`npm audit --json`
`npm audit --omit=dev --json`
`npm run check:naming`
`npm run check:schema`
`npm run check:level1`
`npm test`

Run `npm run test:e2e:local` only if the diff touches Worker runtime/UI behavior.

- [ ] **Step 2: Critics**

Review the diff for scope, value, dashboard accuracy, evidence truth, no-production boundary, privacy/PII redaction, CI safety, and git/PR/merge safety.

### Task 6: Publish

**Files:**
- Stage only scoped dashboard, test, docs, package, CI, and generated artifact files.

- [ ] **Step 1: Stage and commit**

Run explicit `git add` paths and commit with message `Add Level 1 readiness closure dashboard`.

- [ ] **Step 2: Push and open PR**

Push branch `codex/level1-readiness-closure-dashboard`, open a draft PR with summary, files, validation, risks, boundary, and follow-ups.

- [ ] **Step 3: Merge only if safe**

Merge only if the PR is scoped non-production, checks pass, CI is green, and no production gate is weakened.
