# Company Name Accuracy Verification Plan

## Required Checks
- Command: `node --test tests/*.test.js`
- Manual smoke: inspect the bad examples in `reports/danfoss/latest-leads.json` and `reports/siemens/latest-leads.json` and confirm each is either corrected to a valid company or rejected by the new root post-processing.

## Review Gate
- Capture `git diff --name-only` before the read-only review.
- Read only:
  - `AGENTS.md` if present
  - `docs/exec-plans/company-name-accuracy.md`
  - `tmp/codex/company-name-accuracy-status.md`
- Capture `git diff --name-only` after the read-only review and invalidate the review if the diff changes.

## Verification Results
- `npm ci` completed successfully to satisfy missing test dependencies.
- `node --test tests/*.test.js` passed with 6/6 tests green.
- Manual smoke against current report fixtures confirmed:
  - `[인터뷰]` -> `동양BMS`
  - `건물에너지` -> rejected
  - `김연재` -> rejected
  - `② K-조선` -> rejected
  - `선박까지` -> rejected
  - `부평 청천동` -> rejected
- Read-only review diff check was valid: `git diff --name-only` matched before and after review.
