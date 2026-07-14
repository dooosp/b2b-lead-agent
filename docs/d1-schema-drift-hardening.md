# D1 Schema Drift Hardening

This repository keeps D1 schema changes explicit and fail-closed. Request
handlers only verify an already-applied schema version; they never create a
table, add a column, or create an index.

This is local/test evidence only. It does not connect to Cloudflare, run
Wrangler, inspect or mutate a remote D1 database, or approve staging or
production migration work. Production remains `HOLD` and requires a separate,
explicitly approved operator workflow.

## Schema Sources

- `worker/schema.sql` is the canonical fresh local/test schema. It includes the
  version ledger and records versions 1 and 2 only after their fresh-schema DDL.
- `worker/db/migration-manifest.js` defines the same canonical table/index
  contracts and the ordered migration manifest.
- `worker/db/migrations.js` exports the local/test-only
  `applyLocalTestD1Migrations` simulator. It refuses any database adapter that
  does not carry the explicit `LOCAL_TEST_ONLY_NOT_REMOTE_D1` marker before
  issuing DDL. Worker runtime and API sources do not import it. Before local
  adoption it reads each migration's existing table shapes with one bounded
  `UNION ALL` query over `pragma_table_info(...)`. Existing non-lead tables
  must match every canonical column's type, nullability, primary-key position,
  and default. A legacy
  `leads` table may be a canonical subset, but every shared column must retain
  its expected type, nullability, primary-key position, and default. The
  simulator also reads canonical table definitions, every SQL-backed index on
  those tables, and every trigger on those tables from `sqlite_schema`.
  Existing canonical indexes must preserve their table, uniqueness, `DESC`,
  and normalized SQL, including both `job_runs` partial `WHERE` predicates;
  an unlisted index or any trigger fails closed. Every non-`leads` table must
  preserve its full normalized canonical `CREATE TABLE` definition, including
  all `CHECK`/`UNIQUE` constraints. `leads` permits only the documented legacy
  column subset during adoption and requires each present column to use its
  exact canonical clause in actual `cid` order, with no extra table constraint
  or option. The simulator then adds only missing lead
  columns, creates dependent indexes afterward, and records the migration
  version as the final statement in the same local batch.
- `worker/db/schema.js` is a read-only request-path readiness check. Its ledger
  read returns the two expected migration rows plus at most one excess
  sentinel and requires the exact contiguous manifest version/name pairs. The
  column query returns the canonical column count plus at most one sentinel,
  includes `cid`, and validates every name, type, nullability, primary-key
  position, and default. The third read returns the expected table/index set
  plus at most one sentinel from canonical-table-scoped `sqlite_schema` rows;
  missing, altered, or unlisted indexes, unexpected triggers, and
  non-canonical table definitions fail closed. A successful result is cached
  per D1 binding; other results throw `ERR_D1_SCHEMA_NOT_READY`. A forged
  latest-version row without the matching tables and indexes is not ready.
- `scripts/check-d1-schema-consistency.js` compares the canonical SQL and
  migration manifest without contacting D1. It compares full table
  constraints/options, rejects unexpected fresh-schema/migration DDL objects,
  and pins deployed version fingerprints even if both sources drift together.
- `worker/tests/d1-schema-contract.test.mjs` hashes the imported runtime
  migration payload per version, including the ledger and legacy-lead column
  definitions owned by version 1. Existing version hashes remain immutable
  when a future version is added.

## Explicit Migration Versions

Version 1, `adopt_canonical_lead_schema`, creates or adopts the current lead,
analytics, status, review metadata, job-run, and reference-library schema. For
an existing `leads` table, migration planning reads its columns first. Missing
columns are added before any index that references them.

Version 2, `separate_published_snapshot_artifacts`, creates:

- `published_snapshot_heads`, with one current head per profile and artifact
  kind (`latest` or `history`);
- `published_snapshot_entries`, with ordered, immutable snapshot payload rows;
- `idx_published_snapshot_entries_lookup`, for profile/kind/snapshot ordering.

The explicit runner retries at most once and only when a batch reports the
narrow SQLite `duplicate column name: <planned-column>` shape and a second
introspection proves that the concurrently added column now exists. Every
unrelated error, lookalike error, or second failure is surfaced. A failed batch
does not record the migration version.

An existing partial job, review, reference, or snapshot table is never silently
adopted. An incompatible shared lead definition—such as a wrong `id` type or
primary key, a changed default, an unexpected column, or a legacy table with no
`id`—also fails with `ERR_D1_SCHEMA_INCOMPATIBLE` before the corresponding
version can be recorded.

Successful request readiness uses exactly three bounded reads on a cold
binding: one ledger-chain query, one canonical column query, and one
canonical-table-scoped `sqlite_schema` table/index/trigger query. Each uses an
expected-count-plus-one sentinel so excess state is detected without returning
an unbounded result. Subsequent
checks on the same binding use the successful in-memory readiness cache. The
request path remains DDL-free.

`applyLocalTestD1Migrations(db)` is not a production operator or Worker-binding
migration path. The legacy-v1 fixture requires 61 statement/query operations,
which exceeds the Workers Free 50-query invocation limit. The helper therefore
remains a marked local SQLite simulator and must not be reused for remote D1.
A real staging/production migration requires separate human approval and a
versioned Wrangler migration-files/command workflow. That workflow is not
implemented or approved here; `productionReady:false` and production `HOLD`
remain unchanged.

## Commands

Run the file-only schema consistency check:

```sh
npm run check:schema
```

Run the explicit legacy-to-current migration contracts locally:

```sh
node --test worker/tests/p0-legacy-d1-migration-characterization.test.mjs
```

Run all regression tests:

```sh
npm test
```

These commands provide local/test evidence only. Do not treat a passing result
as authorization to execute a remote D1 migration.

## Adding or Changing Persisted Schema

When a persisted column, table, constraint, or index changes:

1. Add a new ordered version to `worker/db/migration-manifest.js`; never edit a
   deployed version's meaning.
2. Update the canonical fresh schema in `worker/schema.sql`.
3. Update the expected schema contract in
   `scripts/check-d1-schema-consistency.js`.
4. Add a local SQLite upgrade test from the oldest supported shape and a fresh
   schema contract test. Add the new version's semantic fingerprint without
   changing any earlier version fingerprint.
5. Keep all column additions before dependent indexes and the version-ledger
   insert last in the migration batch.
6. Run `npm run check:schema`, `npm run check:naming`, `git diff --check`, and
   `npm test`.

The current review metadata boundaries remain unchanged:

- `manual_review_note_events` stores metadata-only manual note events, never
  old/new note body text.
- `reviewer_feedback` stores the current human-entered feedback signals.
- `reviewer_feedback_events` stores metadata-only feedback events, never old or
  new feedback body text.

Snapshot `payload_json` is a published-artifact copy. Reviewer-owned mutable
fields remain in `leads` and must not be written into historical snapshot
payloads. Runtime snapshot reads use one joined statement for head, entries,
matching mutable lead state, current reviewer feedback, and metadata-only event
summaries. The read CTE returns at most the artifact maximum plus one row and
suppresses every payload when any stored count, payload, complete persisted-row,
or aggregate limit is invalid. It does not select `l.*`: mutable fields use an
exact JSON allowlist with 64,000-byte per-entry/1,000,000-byte raw aggregate
gates and 512,000-byte per-object/4,000,000-byte JSON aggregate gates. History
does not materialize current enrichment. JavaScript then verifies contiguous
ordinals, normalized unique route-safe string ids, profile/source ownership,
cross-profile collision absence, exact UTF-8 byte metadata, mutable JSON
bounds, and the content-derived SHA-256 head id before returning a cache. A
corrupt cache is never a stale fallback; managed reads make one bounded
upstream repair attempt, and a failed repair including 404 remains an error.
Remote artifact bodies are streamed into one bounded growable buffer and
capped at 10,000,000 bytes before strict UTF-8 decode. Before `JSON.parse`, an
escape-aware linear scan requires one root array, applies the 90 `latest` or
500 `history` entry bound, and rejects more than 100,000 JSON punctuation
tokens or 32 nesting levels. The internal latest-published GitHub reader shares
the same guard with the 90-entry bound and proves the same projected payload
byte and unique route-safe lead-id invariants before reporting readiness.
Refresh writes are bounded to 90 `latest` or 500 `history` entries,
chunked to at most 100 bound parameters per statement, and remain below the
Workers Free 50-query invocation limit including the three cold readiness
reads. Projected payloads are measured as UTF-8 before writing: each payload is
capped at 1,900,000 bytes, each complete persisted entry row is conservatively
capped at 1,950,000 bytes beneath D1's 2,000,000-byte ceiling, and each artifact
is capped at 8,000,000 bytes in total. Normalized ids are at most 256 bytes;
99-id/100-bind guards make cross-profile collisions fail the atomic batch.
Managed profile ids must already be exact, non-dot ASCII-safe report segments
and are URL-encoded for the upstream read. History refresh does not upsert
working lead rows. These are local/test contracts, not production D1 evidence.
See the official
[D1 limits](https://developers.cloudflare.com/d1/platform/limits/).
