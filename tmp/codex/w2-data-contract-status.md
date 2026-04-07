# W2 Data Contract Status

## Phase: Preflight
- Worktree path: `/Users/jangtaeho/Documents/New/wt-w2-data-contract`
- Repo root: `/Users/jangtaeho/Documents/New/wt-w2-data-contract`
- Branch: `hardening/w2-data-contract`
- Mode: `Worktree`
- `package.json` name: `b2b-lead-agent`
- Required repo fingerprint present: `package.json`, `worker/index.js`, `worker/db/transform.js`, `worker/db/leads.js`, `worker/schema.sql`
- Tree status: clean
- Owned worker files resolved inside the same git repo root.
- `worker/tests/data-contract.test.mjs` is not present yet and will be created or replaced by the contract regression suite in this task.

## Phase: Planning
- `worker/db/transform.js` currently generates random fallback IDs in `leadToRow`, so the same logical lead does not keep a deterministic stored identity.
- Persistence currently serializes raw `sources` input order and URL variants, so source ordering and decorated query strings can drift identity inputs before insert/update.
- `rowToLead` currently deserializes rows without `identity_key` backfill, so legacy rows read safely only by accident and do not expose a deterministic identity contract.

## Phase: Implementation
- Added deterministic worker lead identity helpers in `worker/db/transform.js` so `identity_key` and fallback `id` derive from normalized company plus canonical source/event anchors instead of random suffixes.
- Normalized and deduplicated `sources` before persistence, with canonical URL handling that strips tracking/query decoration while keeping aggregator/search URLs on title fallback.
- Updated `rowToLead` to backfill `identityKey` for legacy rows and return normalized source order so row/lead round-trips are deterministic.
- Added minimal schema support for `identity_key` in `worker/db/schema.js` and `worker/schema.sql`.
- Added worker regression coverage in `worker/tests/data-contract.test.mjs` for source-order stability, decorated URL stability, round-trip safety, and legacy-row compatibility.

## Phase: Verification Ready
- `node --test worker/tests/data-contract.test.mjs` passed.
- `node --test worker/tests/*.test.mjs` passed.
- Fixture-based smoke checks confirmed same-logical-lead identity stability and row/lead canonical round-trip stability.
