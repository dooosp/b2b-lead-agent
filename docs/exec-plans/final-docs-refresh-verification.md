# Final Docs Refresh Verification Plan

## Required Claim Audit

- `git log --first-parent --reverse --oneline 52cd4f1..origin/master`
- `git show --stat --summary f4884ef`
- `git show --stat --summary 91e4890`
- `git show --stat --summary 419941c`
- `git show --stat --summary 1e2d4e6`
- GitHub PR state audit for #10, #11, #12, #13, #14, #15, #16, #17, and #18

## Current-Code Spot Checks

- confirm Wave 1 root trust and identity surfaces exist on current `master`
- confirm Wave 2 worker identity, source-lineage, and product-canonicalization surfaces exist on current `master`
- confirm Wave 3 trigger acceptance-versus-completion separation exists on current `master`

## Optional Lightweight Check

- `npm run check:naming`

## Review Guard

- capture `git diff --name-only` before the read-only review
- read only:
  - `AGENTS.md`
  - `HARDENING_PLAN.md`
  - `NEXT_SESSION_PROMPT.md`
  - `tmp/codex/final-docs-refresh-status.md`
- capture `git diff --name-only` after the read-only review
- invalidate the review if the diff changes during the review

## Rules

- fix only verified documentation drift
- do not claim a branch or PR shipped unless that claim is backed by merged `master` history or current GitHub PR state
- keep archival docs as context instead of deleting them
