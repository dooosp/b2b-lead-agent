# D1 Schema Drift Hardening

This repo guards the local D1 `leads` schema with a file-only consistency check. It does not connect to Cloudflare, run Wrangler, or inspect production D1.

## Checked Sources

- `worker/schema.sql`: canonical fresh-table SQL for local/test D1 setup.
- `worker/db/schema.js`: Worker lazy `CREATE TABLE IF NOT EXISTS leads` path.
- `worker/db/schema.js`: Worker lazy `ALTER TABLE leads ADD COLUMN ...` path for older local/test databases.
- `scripts/check-d1-schema-consistency.js`: expected target column list and drift-critical columns.

The drift-critical columns from Issue #34 are:

- `review_status`
- `generation_mode`
- `verification_status`
- `data_gaps`

## Commands

Run the schema-only check:

```sh
npm run check:schema
```

Run the regression tests:

```sh
npm test
```

`npm test` includes `tests/d1-schema-consistency.test.js`, which validates the current repo files and verifies that the checker fails when a critical column is removed from a schema source.

The main CI workflow also runs `npm run check:schema` explicitly before the full test suite so schema drift failures are labeled directly.

## Adding Or Changing Lead Columns

When a persisted `leads` column changes, update all local schema sources in the same change:

1. Add the column to `worker/schema.sql` inside `CREATE TABLE IF NOT EXISTS leads`.
2. Add the same column definition to the `CREATE TABLE IF NOT EXISTS leads` SQL in `worker/db/schema.js`.
3. Add a lazy `ALTER TABLE leads ADD COLUMN ...` entry in `worker/db/schema.js` when older D1 databases may not have the column.
4. Update `EXPECTED_LEADS_COLUMNS` in `scripts/check-d1-schema-consistency.js`.
5. Update `EXPECTED_LEADS_LAZY_ALTER_COLUMNS` when the lazy path must carry the column.
6. Run `npm run check:schema`, `npm run check:naming`, `git diff --check`, and `npm test`.

Do not use this checker as approval to access or mutate production D1. Production schema observation or repair remains a separate human-approved operational workflow.
