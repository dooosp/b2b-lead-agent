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

- `master` already includes the April 7, 2026 hardening cycle.
- Wave 1 shipped across PRs #11 and #12.
- Wave 2 shipped via PR #16.
- Wave 3 shipped via PR #18.
- Do not reopen those findings unless you can point to a current-`master` regression or a newly verified gap.

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

- `npm run check:naming`
- `npm run test:root`
- `npm run test:unit`
- `npm run test:contract`
- `npm test`
