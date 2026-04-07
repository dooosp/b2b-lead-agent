# Lead PATCH Atomicity Verification Plan

## Required Checks
- `node --test worker/tests/*.test.mjs`
- targeted regression assertions for:
  - valid `status` + valid `notes` + invalid `follow_up_date` leaves the lead unchanged
  - invalid status transition + valid `notes` leaves the lead unchanged
  - fully valid payload persists all intended fields and reports accurate `changedFields`

## Manual Smoke Intent
- send a mixed PATCH payload with valid `status` and invalid `follow_up_date`
- verify that no requested field persists

## Review Guard
- capture `git diff --name-only` before and after the read-only review
- invalidate merge-readiness conclusions if the diff changes during that review
