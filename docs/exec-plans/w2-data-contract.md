# W2 Data Contract Execution Plan

## Scope
- Worker-only hardening in the current repository layout.
- Owned worker surfaces are `worker/db/transform.js`, `worker/db/leads.js`, `worker/db/schema.js`, `worker/schema.sql`, and worker contract regression tests.
- Excluded surfaces remain `worker/api/leads.js`, `worker/lib/profile.js`, root runtime files, and self-service flows.

## Goals
- Stabilize stored lead identity for the same logical lead regardless of source ordering.
- Normalize lead identity inputs before worker persistence so insert/update behavior is deterministic.
- Preserve `leadToRow` / `rowToLead` round-trip semantics while keeping legacy rows readable.
- Keep any schema support minimal and migration-safe.

## Planned Changes
1. Audit the current transform and persistence contract to locate where identity and normalization drift enter the worker path.
2. Introduce the smallest deterministic identity/canonicalization layer needed before row persistence.
3. Keep row serialization and deserialization backward compatible for rows missing newer fields.
4. Add targeted worker regression coverage for source reordering, decorated URL normalization, round-trip stability, and legacy-row compatibility.

## Verification
- `node --test worker/tests/data-contract.test.mjs`
- `node --test worker/tests/*.test.mjs`
- Manual fixture checks for same-logical-lead identity stability and lead -> row -> lead canonical field stability.
