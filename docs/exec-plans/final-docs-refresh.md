# Final Docs Refresh Execution Plan

## Scope

- docs and persistent repo guidance only
- `AGENTS.md`
- `HARDENING_PLAN.md`
- `NEXT_SESSION_PROMPT.md`
- `IMPLEMENTATION_PLAN.md` archival note only
- task control docs and status files

## Preflight

- worktree root: `/Users/jangtaeho/wt-final-docs-refresh`
- branch: `hardening/final-docs-refresh`
- mode: `Worktree`
- package name: `b2b-lead-agent`
- preflight diff snapshot: clean
- repo fingerprint mismatch at start:
  - `AGENTS.md` missing from the repo root
  - `HARDENING_PLAN.md` missing from the repo root

## Audit Inputs

- first-parent `master` merge order after `52cd4f1` is:
  1. `f4884ef` / PR #11
  2. `91e4890` / PR #12
  3. `419941c` / PR #16
  4. `1e2d4e6` / PR #18
- current GitHub PR state confirms:
  - PR #10 is still open and superseded by #11
  - PRs #13, #14, #15, and #17 are closed without merge and superseded by #16 and #18
- remote `origin/hardening/*` branches remain as historical raw lanes, not current merge artifacts

## Plan

1. Recreate repo-level source-of-truth docs (`AGENTS.md`, `HARDENING_PLAN.md`) from actual shipped `master` state.
2. Refresh `NEXT_SESSION_PROMPT.md` so future sessions start from the shipped hardening baseline instead of the pre-hardening prompt.
3. Add a short archival banner to `IMPLEMENTATION_PLAN.md` so older planning context is preserved but not mistaken for current truth.
4. Record the superseded raw PR and branch guidance plus the one-thread control and owned-worktree implementation model.
5. Verify every claim against current `master` history, current code touchpoints, and live GitHub PR state before commit.
