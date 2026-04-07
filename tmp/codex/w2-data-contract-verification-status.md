# W2 Data Contract Verification Status

## Phase: Test Execution
- Command: `node --test worker/tests/data-contract.test.mjs`
- Result: passed
- Command: `node --test worker/tests/*.test.mjs`
- Result: passed
- Manual smoke: same logical lead fixture with reordered and decorated sources kept identical `id` / `identity_key`.
- Manual smoke: `lead -> row -> lead -> row` preserved canonical `id`, `identity_key`, and normalized `sources`.

## Verified Behaviors
- Reordered source arrays keep the same stored worker `id` and `identity_key`.
- Decorated/query-variant source URLs are canonicalized before persistence.
- `leadToRow` and `rowToLead` preserve canonical contract fields across round-trip serialization.
- Legacy rows without `identity_key` still deserialize safely and backfill a deterministic identity key when reserialized.

## Audit Notes
- Verification claims are limited to the targeted worker data-contract regression suite, the broader worker test suite, and one direct fixture-based smoke inspection.
- No claims are made about product/profile canonicalization policy outside the worker persistence contract touched in this task.
