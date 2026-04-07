# HARDENING_PLAN

> Status: current hardening source of truth for `master` as of 2026-04-07.
> Audited against first-parent `master` history through `1e2d4e6` and current GitHub PR state through PR #18.
> Earlier files under `docs/exec-plans/` and `tmp/codex/` are retained as archival execution records, not current `master` truth, unless explicitly refreshed.

## Shipped Merge Order

| Order | Date | PR | Commit | Shipped Artifact | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | 2026-04-07 | #11 | `f4884ef` | `codex/hardening-integration-review` | Wave 1 integration artifact for trust and persistence fixes |
| 2 | 2026-04-07 | #12 | `91e4890` | `hardening/root-identity-trust` | Wave 1 root-only follow-up that closed the remaining root blockers |
| 3 | 2026-04-07 | #16 | `419941c` | `codex/w2-integration-review` | Wave 2 worker contract integration artifact |
| 4 | 2026-04-07 | #18 | `1e2d4e6` | `codex/w3-queue-semantics-review` | Wave 3 safe shipping artifact on top of updated `master` |

## Wave Summary

### Wave 1

- Wave 1 shipped in two merge commits, not one.
- PR #11 shipped:
  - source traceability hardening
  - company-name accuracy hardening
  - no-body enrichment hardening
  - lead PATCH atomicity
- PR #12 then closed the remaining root blockers:
  - stable root lead identity
  - low-trust article body leakage into qualifier prompting

### Wave 2

- Wave 2 shipped via PR #16 in the required order:
  1. `hardening/w2-data-contract`
  2. `hardening/w2-self-service-bridge`
  3. `hardening/w2-api-canonicalization`
- Current `master` therefore includes:
  - deterministic worker lead identity and canonical source serialization
  - preserved self-service source lineage through `originUrl`, `query`, and `resolution`
  - managed-profile product canonicalization at the worker API boundary

### Wave 3

- Wave 3 shipped via PR #18, not via the raw branch PR #17.
- Current `master` therefore keeps queue acceptance intake-only:
  - accepted trigger responses return HTTP `202`
  - accepted responses use `status: "accepted"`
  - runtime completion is emitted only after real execution and `summary()`-style completion evidence

## Findings Closed On `master`

- `source canonical URL laundering / traceability drift`
  - shipped by PR #11
  - current evidence: `enricher/article-enricher.js`, `lead-report-publisher.js`, `tests/source-traceability.test.js`
- `invalid lead company strings accepted`
  - shipped by PR #11
  - current evidence: `lead-qualifier.js`, `tests/company-name-accuracy.test.js`
- `no-body enrichment fabricated evidence / overconfident ROI wording`
  - shipped by PR #11
  - current evidence: `worker/api/enrichment.js`, `worker/tests/enrichment.test.mjs`
- `lead PATCH partial-write bug`
  - shipped by PR #11
  - current evidence: `worker/db/leads.js`, `worker/tests/lead-patch-atomicity.test.mjs`
- `stable root lead identity 부재`
  - shipped by PR #12
  - current evidence: `lead-identity.js`, `tests/root-identity-trust.test.js`
- `low-trust article body leak into qualifier prompt`
  - shipped by PR #12
  - current evidence: `article-trust.js`, `lead-qualifier.js`
- `stable worker lead identity 부재 / normalize-before-persist 누락`
  - shipped by PR #16
  - current evidence: `worker/db/transform.js`, `worker/db/schema.js`, `worker/schema.sql`
- `query-token bridge 누락`
  - shipped by PR #16
  - current evidence: `worker/self-service/lead-utils.js`, `worker/self-service/lead-prompt.js`, `worker/self-service/lead-model.js`
- `product canonicalization mismatch / orphan product`
  - shipped by PR #16
  - current evidence: `worker/lib/profile.js`, `worker/api/leads.js`
- `queued run premature completion`
  - shipped by PR #18
  - current evidence: `worker/lib/job-trigger.js`, `worker/api/trigger.js`, `tests/main.runtime.test.js`

## Remaining Open Items

- No new unresolved Wave 1 to Wave 3 runtime or worker blocker was verified during this docs refresh.
- Operator cleanup only:
  - PR #10 (`Harden source traceability for qualified leads`) is still open and is superseded by merged PR #11. Do not merge PR #10 directly.
  - PRs #13, #14, #15, and #17 are already closed without merge because their changes shipped through PRs #16 and #18.
  - Remote `origin/hardening/*` branches remain as historical raw lanes. Because shipping used cherry-picked integration artifacts, those raw branch heads are not direct ancestors of `master`; prune them only after confirming no active work depends on them.

## Current Operating Sequence

1. Sync with `origin/master` and confirm the repo fingerprint before planning work.
2. Read `AGENTS.md`, this file, and `NEXT_SESSION_PROMPT.md`.
3. Keep one integration and control thread on updated `master` for planning, merge ordering, docs alignment, and final ship decisions.
4. Run implementation in owned worktrees or branches with one narrow scope each.
5. Validate inside the owned worktree with the smallest relevant commands, then use a single integration artifact branch or PR if multiple lanes must ship together.
6. Mark old plans and status files as archival context instead of deleting them.
7. Refresh these root source-of-truth docs whenever merged reality changes.

## Archival Guidance

- `docs/exec-plans/*.md` and `tmp/codex/*.md` capture branch-local execution and verification history.
- Use them as evidence for what shipped or what was audited in a worktree.
- Do not treat them as current `master` truth unless the active task explicitly refreshes them.
