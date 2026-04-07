# Company Name Accuracy Exec Plan

## Scope
- Task slug: `company-name-accuracy`
- Goal: reject low-trust company strings in root lead qualification and only keep corrected company names when the title provides a clear root-only recovery path.
- Surfaces: `lead-qualifier.js`, root regression tests, task status artifacts

## Preflight
- Repo root: `/Users/jangtaeho/Documents/New/wt-company-name-accuracy`
- Package name: `b2b-lead-agent`
- Branch: `hardening/company-name-accuracy`
- Mode: git worktree
- Preflight diff snapshot: clean (`git status --short`, `git diff --name-only`)
- Constraint mismatch: `AGENTS.md` and `HARDENING_PLAN.md` do not exist in this repo root or anywhere in repo history, so those reads cannot be completed literally.

## Plan
1. Inspect root qualifier company extraction and report artifacts for bad company strings.
2. Add a root-only company normalization and rejection pass after qualification output is shaped.
3. Tighten demo/title extraction to avoid publishing industry labels, people, or locations as company names.
4. Add regression tests using current `reports/*/latest-leads.json` artifacts.
5. Verify with `node --test tests/*.test.js`, then run the required read-only review and merge-readiness checks.

## Implementation Notes
- Added a root-only post-processing pass in `lead-qualifier.js` that normalizes the emitted company name, rejects low-trust values, and repairs `salesPitch` when a company name is corrected.
- Tightened title extraction to stop falling back to industry labels or location phrases and to prefer explicit executive-role recovery only when the title clearly names a company.
- Kept worker code untouched and used the worker helper file as reference only.
