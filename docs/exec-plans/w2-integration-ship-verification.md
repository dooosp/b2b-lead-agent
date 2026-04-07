# Wave 2 Integration Ship Verification Plan

## Required Checks
- `npm test`
- fallback if needed:
  - `node --test tests/*.test.js`
  - `node --test worker/tests/*.test.mjs`

## Validation Rules
- Run `npm ci` only if dependencies are missing in this checkout.
- Re-run validation after the final integrated state is reached.
- If semantic expectations must change during conflict resolution, keep the smallest compatible update and record it.

## PR and Merge Gates
- Create or update one integration PR only after validation is green.
- Merge only if repo policy and permissions allow a safe automated merge.
