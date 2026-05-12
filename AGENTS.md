# AGENTS

## Purpose

Repo-specific operating guidance for agent work in `b2b-lead-agent`.

## Repo Identity

- Repository and package name: `b2b-lead-agent`
- Batch entrypoint: `main.js`
- Worker entrypoint: `worker/index.js`
- Current hardening source of truth: `HARDENING_PLAN.md`
- Current session handoff prompt: `NEXT_SESSION_PROMPT.md`

## Current Shipped Baseline

- `master` includes the April 7, 2026 hardening cycle, the PR #25 P0 trust-boundary baseline, the PR #27 LeadBrief v1 review contract baseline, the May 11 route/data/schema/evidence/docs cleanup train, PR #51's post-train integration, PR #52/#53 review-roadmap follow-ups, PR #54 review queue filters, PR #55 Solution Translation Summary, PR #56 source-of-truth doc sync, PR #57 Product Context / Signal Fusion, PR #58 post-PR57 doc sync, PR #59 Workbench Stakeholder Prep, PR #60 source-of-truth doc sync, and PR #61 evidence/data-gap review slices through `5a13e2c`.
- Wave 1 shipped across PRs #11 and #12.
- Wave 2 shipped via PR #16.
- Wave 3 shipped via PR #18.
- PR #25 shipped `/api/internal/*` API-token-only auth, latest-published `503 readiness_unavailable` fail-closed behavior, managed/root fallback publication guards, self-service trust metadata, and D1 trust metadata persistence.
- PR #27 shipped LeadBrief v1 as the central human-review unit across root qualification, published snapshots, D1 persistence, `/api/leads`, self-service responses, CSV/export trust metadata, and the minimum review UI.
- PRs #36-#43 shipped Worker route dispatch, LeadBrief data-path hardening, schema drift checks, test helper refactors, review UX metadata, release evidence tooling, architecture docs, and canonical naming cleanup.
- PR #51 integrated PRs #44-#49: Opportunity Workbench v1, local-only Worker E2E harness, Worker auth/error hardening, synthetic lead-quality evaluation, old PR #23 replacement, and roadmap synthesis.
- PR #59 recut old PR #6 as advisory role-specific Workbench helper guidance on top of existing LeadBrief/Opportunity Workbench data.
- PR #61 recut old PR #3's remaining dashboard-intelligence idea as cached `/leads` evidence/data-gap review slices without API, schema, storage, production, or CRM expansion.
- Do not reopen those findings unless you can point to a current-`master` regression or a newly verified gap.
- Treat closed PRs #1-#9, #10, #22, and #23 as stale/superseded concept inventory unless explicitly re-scoped on top of current `master`.
- Recommended next non-production product goal: extend roleplay with explicitly advisory stakeholder context from shipped Workbench prep, keeping it human-reviewed and outside CRM ownership.

## Repo Layout

- Root pipeline surfaces:
  - `orchestrator/news-orchestrator.js`
  - `normalizer/article-normalizer.js`
  - `enricher/article-enricher.js`
  - `lead-qualifier.js`
  - `lead-report-publisher.js`
  - `profile-registry.js`
- Worker surfaces:
  - `worker/api/*`
  - `worker/db/*`
  - `worker/lib/*`
  - `worker/self-service/*`
  - `worker/pages/*`
- Regression suites:
  - `tests/*.test.js`
  - `worker/tests/*.test.mjs`

## Trust Boundary Rules

- `/api/internal/*` must use `INTERNAL_API_TOKEN` when configured, with `API_TOKEN` compatibility fallback only; `TRIGGER_PASSWORD` is not internal API auth.
- Latest-published readiness lookup failures must fail closed with HTTP `503` and `error.code = "readiness_unavailable"`.
- Managed/root runs must fail closed when the LLM is missing or fails unless explicit demo mode is enabled.
- Demo leads must not be canonical-published.
- Heuristic/self-service fallback leads must remain non-verified / review-needed in machine-readable payloads, browser cards, copy output, downloads, and D1 rows.
- LeadBrief v1 required fields are `company`, `signal`, `sources`, `whyNow`, `recommendedMessage`, `confidence`, `assumptions`, `dataGaps`, and `reviewStatus`.
- `reviewStatus` frozen states are `NEW`, `NEEDS_REVIEW`, `APPROVED`, `REJECTED`, and `DEFERRED`.
- LLM, heuristic, and fallback leads default to `NEEDS_REVIEW`; LLM `verificationStatus: "verified"` does not imply human approval.
- `status` remains the sales pipeline state and must not be conflated with `reviewStatus`.
- Human PATCH actions may update `reviewStatus` only with frozen-state validation.
- Managed/self-service upserts preserve existing `review_status` on conflict so refreshes do not erase human review decisions.
- CSV, browser UI, self-service copy, and downloads must preserve review/trust metadata.
- D1 trust and review columns are lazy-migration-compatible but not production-observed until the first post-deploy production write is confirmed.
- Production deploy and production DB writes were not performed during PR #25, PR #26, PR #27, or the PR #36-#51 train.

## Canonical Repo Rules

- Preserve the role-oriented naming baseline in `docs/agent-naming-convention.md`.
- Keep `scout.js` as a compatibility wrapper only.
- Keep canonical published artifact names:
  - `reports/<profile>/lead-report-YYYY-MM-DD.md`
  - `reports/<profile>/latest-leads.json`
  - `reports/<profile>/lead-history.json`
- Prefer current canonical paths over inventing new legacy wrappers or alternate `*-api.js` surfaces.

## Working Model

- Treat `master` plus merged PR history as the only shipped source of truth.
- Keep integration and control in one thread rooted on updated `master`.
- Do implementation in owned worktrees with narrow scope and explicit ownership.
- When multiple lanes exist, ship through one integration artifact branch or PR on top of current `master`; raw task branches are not automatically merge-safe once `master` has moved.
- Preserve historical task docs under `docs/exec-plans/` and `tmp/codex/`; refresh them when needed, but do not silently erase shipped context.

## Validation

- `npm run check:naming` for naming and repo contract checks
- `npm run test:root` for root pipeline coverage only
- `npm run test:unit` for worker unit coverage only
- `npm run test:contract` for worker trigger and contract coverage only
- `npm run test:worker` for the combined worker gate (`test:unit` + `test:contract`)
- `npm test` for the root gate plus the combined worker gate
