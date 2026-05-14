# Local E2E Harness

This harness validates the Worker UI and API routes without production access.

Run:

```bash
npm run test:e2e:local
```

The legacy Playwright smoke script is also local by default now:

```bash
E2E_BASE_URL=http://127.0.0.1:8787 API_TOKEN=local-token npm run e2e
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

The legacy `npm run e2e` script defaults to `http://127.0.0.1:8787` through `e2e-config.mjs`. Set `E2E_BASE_URL` for a different local or staging target. URLs under `*.workers.dev` are refused unless `ALLOW_PRODUCTION_E2E=yes` is set for a separately approved production-smoke workflow. The default local validation path for PRs is `npm run test:e2e:local`.

## Covered Smoke Surface

- `GET /manifest.json`
- `GET /api/leads?profile=danfoss`
- lead list browser rendering
- lead detail server rendering and browser navigation
- review metadata display
- Lead Action Intelligence display in Opportunity Workbench, list cards, Kanban cards, and Reviewer Action Queue lanes
- Reviewer Notes Template display in Opportunity Workbench and the Lead Review Session panel, including read-only approved, needs-review, and risk/data-gap note variants
- Lead Review Session display on `/leads`, including current filtered queue size, lane progress, active filter context, deterministic next-lead candidate, and next-lead focus
- Reviewer Action Queue action, risk-flag, missing-info, lane, and reset filter behavior
- queue-aware quick review actions update only `reviewStatus`, preserve sales `status`, refresh visible local queue membership, guidance, and reviewer note text, and keep filters usable
- Reviewer Productivity Toolkit v1 behavior on `/leads`: copy-current-note success via a stubbed Clipboard API, manual-copy fallback when Clipboard API is unavailable, optional shortcut help, non-mutating `j`/`q`/`c` shortcuts, ignored shortcuts while typing in a textarea, browser-memory activity counts, activity reset after reload, and confirmation that shortcuts do not mutate `reviewStatus`
- Lead Detail Workbench Productivity Parity v1 behavior: Workbench note copy success copies only the visible deterministic note, unavailable Clipboard API triggers bounded manual-copy fallback, `w` focuses Opportunity Workbench, `j`/`n` focuses the next meaningful detail section, `c` copies the visible Workbench note, `?` toggles shortcut help, shortcuts are ignored while typing in detail notes, browser-memory activity resets after reload, and detail shortcuts do not mutate `reviewStatus`
- Reviewer Workflow QA & Accessibility Hardening v1 behavior: list view tabs use keyboard-reachable tab semantics, copy targets and status controls expose accessible names, shortcut help/status messages use bounded regions/live regions, shortcuts are ignored while focus is on interactive controls, and mobile viewports smoke `/leads` reviewer blocks plus lead-detail Workbench blocks for horizontal overflow
- Reviewer Workflow Roving Keyboard & Accessibility Snapshot Gate v1 behavior: list/Kanban tabs expose a vertical tablist with Up/Down roving focus, Left/Right focus aliases, Home/End movement, and Enter/Space activation; tab panels expose stable tab semantics, `/leads` and lead-detail Workbench semantic snapshots assert reviewer regions, copy controls, shortcut help, live status feedback, zero-result reset controls, and detail review/status controls, and the local non-loopback fetch guard remains the network boundary
- bounded review-update failure UI that does not expose fake-D1/internal failure details
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
