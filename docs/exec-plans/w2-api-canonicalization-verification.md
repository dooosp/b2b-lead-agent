# Wave 2C API Canonicalization Verification Plan

## Required Checks
- `node --test worker/tests/w2-api-canonicalization.test.mjs`
- `node --test worker/tests/*.test.mjs`
- targeted regression assertions for:
  - canonical product returned for a valid managed profile/product pair
  - orphan product input rejected or safely canonicalized
  - invalid profile/product combinations do not silently pass through

## Manual Smoke Intent
- inspect a managed profile fetch with an unsupported/orphan product and confirm the API boundary does not return it unchanged
- inspect a managed or self-service fetch path and confirm canonical `profile` and `product` fields are returned consistently

## Review Guard
- capture `git diff --name-only` before and after the read-only review
- invalidate merge-readiness conclusions if the diff changes during that review
