# Local E2E Harness

This harness validates the Worker UI and API routes without production access.

Run:

```bash
npm run test:e2e:local
```

## What It Uses

- `worker/e2e/local-e2e.test.mjs`: Node test entrypoint with Playwright browser smoke.
- `worker/tests/helpers/local-e2e-harness.mjs`: loopback HTTP server that invokes `worker.fetch()` directly.
- `worker/tests/helpers/local-e2e-fixtures.mjs`: fake D1 seed rows for lead list, lead detail, review metadata, CSV, and dashboard metrics.
- `worker/tests/helpers/fake-d1.mjs`: fake D1 implementation used by Worker tests, including dashboard aggregate SELECT support.

## Local-Only Safety

The local harness starts an ephemeral `http://127.0.0.1:<port>` server and installs a fetch guard around Node's global `fetch`. The guard allows loopback requests and records any attempted non-loopback HTTP(S) URL. The test fails if the Worker path attempts an external fetch.

The harness does not:

- call the deployed Worker
- access production D1
- run Wrangler
- deploy
- use the production Worker URL as its base URL

The legacy `npm run e2e` script is still the production smoke script and should only be used when a separate production-smoke workflow is explicitly approved. The default local validation path for PRs is `npm run test:e2e:local`.

## Covered Smoke Surface

- `GET /manifest.json`
- `GET /api/leads?profile=danfoss`
- lead list browser rendering
- lead detail server rendering and browser navigation
- review metadata display
- `GET /api/export/csv?profile=all`
- `GET /api/dashboard?profile=all`
- dashboard browser rendering
- API JSON 404 boundary
- API JSON 405 boundary
- invalid profile error state
- missing lead detail error state
- fake D1 failure error state

## Fixture Notes

The seed includes three deterministic lead rows:

- `local-lead-approved`: approved, verified, enriched `danfoss` lead with direct evidence and CSV-visible trust metadata.
- `local-lead-review`: `danfoss` lead that needs human review and includes data gaps.
- `local-lead-won`: `ls-electric` won lead used for dashboard win/loss and pipeline metrics.

Status logs and analytics rows are seeded so dashboard aggregates exercise the same route code as the Worker.
