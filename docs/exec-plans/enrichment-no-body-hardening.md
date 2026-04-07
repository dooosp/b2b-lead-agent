# Enrichment No-Body Hardening Plan

## Goal
- Make worker enrichment conservative when article body is missing.
- Prevent fabricated body quotes and unsupported ROI certainty.

## Scope
- `worker/api/enrichment.js`
- new worker regression tests only

## Constraints
- Do not broaden into trigger/runtime work.
- Do not edit `AGENTS.md`.
- Prefer the smallest schema-neutral fix.

## Context Notes
- The requested worktree is `/Users/jangtaeho/Documents/New/wt-enrichment-no-body`.
- Repo preflight matched branch and package identity.
- Root `AGENTS.md` and `HARDENING_PLAN.md` are missing in this worktree clone.
- Equivalent files were found in `/Users/jangtaeho/Documents/New/b2b-lead-agent` at the same `origin` remote and same `HEAD` commit, and used as read-only reference context.

## Plan
1. Extract no-body-specific enrichment prompt guidance so the model is never asked for body quotes when the body is missing.
2. Harden normalization so no-body outputs drop evidence quotes, inject an explicit missing-body gap, and downgrade ROI text to conservative wording when needed.
3. Add regression coverage for no-body prompt guidance, evidence sanitization, ROI conservatism, and gap preservation.
4. Run targeted worker tests plus a small no-body smoke simulation.
