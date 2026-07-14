# Data Path And D1 Map

This document maps how lead data moves through the root batch pipeline, Worker APIs, D1, and published report artifacts. It is intentionally conservative about production claims: local source and tests do not prove production D1 state.

## Managed Lead Path

```text
profiles/*.js
  -> main.js
  -> orchestrator/news-orchestrator.js
  -> lead-qualifier.js
  -> lead-report-publisher.js
  -> reports/<profile>/{latest-leads.json,lead-history.json,lead-report-YYYY-MM-DD.md}
  -> Worker /api/leads or /api/history managed artifact loader
  -> typed D1 cache through savePublishedSnapshot()
```

Key details:

- `main.js` owns the CLI contract: `node main.js --profile <profileId> [--email]`.
- `orchestrator/news-orchestrator.js` gathers and enriches articles before qualification.
- `lead-qualifier.js` normalizes sources and generation trust metadata; demo fallback is not allowed unless explicitly configured.
- `lead-report-publisher.js` writes canonical report artifacts and refuses demo leads as canonical latest leads.
- `.github/workflows/generate-report.yml` is the automated managed-run workflow. It receives `repository_dispatch`, runs the root CLI, commits report artifacts, and pushes them.
- Worker managed reads use separate `latest` and `history` snapshot heads. A
  fresh typed head is served from D1; a missing, expired, or future-dated head
  triggers GitHub revalidation. The remote response body is streamed into one
  bounded growable buffer with a 10,000,000-byte cap and strict UTF-8 decoding.
  Before `JSON.parse`, a string/escape-aware linear scan requires one array,
  enforces the 90/500 kind-specific top-level count, and caps structure at
  100,000 JSON punctuation tokens and 32 nesting levels. The managed profile
  id must already be an exact, non-dot ASCII-safe report segment and is then
  URL-encoded. Network,
  malformed-artifact, and upstream 5xx
  failures can fall back only to the same artifact kind's snapshot when it is
  no more than 24 hours old. A 404, a future timestamp, or an older snapshot
  never falls back. `PUBLISHED_SNAPSHOT_MAX_STALE_SECONDS` may tighten this
  window but cannot expand it beyond 24 hours. Responses expose `snapshotId`,
  `snapshotFetchedAt`, and `snapshotStale`. Arbitrary legacy `leads` rows are
  never inferred to be a published snapshot.
- Snapshot entries hold an ordered, recursively projected public payload.
  Mutable pipeline, review, manual-note, reviewer-feedback, follow-up, and
  current enrichment state remains in `leads` and is overlaid through an
  explicit allowlist. The head, entries, mutable row, current reviewer
  feedback, and metadata-only event summaries are read in one joined D1
  statement, so a concurrent refresh cannot mix one head with another
  snapshot's entries and the read does not issue per-lead queries. The read
  CTE returns at most the artifact maximum plus one row and suppresses every
  payload when any persisted count, per-entry, full-row, or aggregate byte
  limit is exceeded. It selects no `l.*`: mutable values are projected into a
  JSON allowlist only after a 64,000-byte per-entry and 1,000,000-byte raw
  aggregate gate, then remain below 512,000 bytes per JSON object and
  4,000,000 bytes per response aggregate. History does not load current
  enrichment fields. JavaScript then verifies contiguous ordinals, canonical
  unique string ids, profile ownership, exact UTF-8 byte totals, mutable JSON
  bounds, and the content-derived SHA-256 head id. A corrupt cache is never
  returned as stale; it receives one upstream repair attempt, and any failed
  repair, including 404, remains a bounded error.
- Refresh accepts at most 90 `latest` leads and 500 `history` leads. Latest
  lead upserts use three-row/90-bind statements; entry inserts use up to
  16-row/96-bind statements. Lead ids must be strings, are
  whitespace-normalized, are unique after normalization, and are limited to
  256 UTF-8 bytes. Each projected payload is capped at 1,900,000 UTF-8 bytes;
  its complete persisted entry row—including duplicated ownership/id fields
  and conservative record overhead—is capped at 1,950,000 bytes; and the full
  artifact is capped at 8,000,000 projected UTF-8 bytes. Cross-profile id
  collisions fail the same atomic batch before a snapshot is replaced, and
  the read path independently rejects legacy collision state. History refresh
  never upserts `leads`. The three
  cold readiness reads (ledger, column shape, and index/constraint shape),
  cache reads, and worst supported refresh therefore remain below D1's Workers
  Free limit of 50 queries per invocation and each statement remains within
  D1's 100-bound-parameter limit. See the official
  [D1 limits](https://developers.cloudflare.com/d1/platform/limits/).

## Self-Service Lead Path

```text
POST /api/analyze
  -> auth and rate limit in worker/routes/api.js
  -> worker/self-service/orchestrator.js
  -> profile generation, news fetch, article body fetch, lead analysis
  -> response schema normalization
  -> D1 saveLeadsBatch() and logAnalyticsRun() via ctx.waitUntil()
```

Key details:

- The request body must include `company` and `industry`.
- `REQUIRE_SELF_SERVICE_AUTH` defaults to auth required.
- Missing LLM keys produce an explicit unavailable response rather than silent fake leads.
- Timeout or model failure can return heuristic leads, but the response and persisted rows remain `needs_review` with trust/data-gap metadata.
- Self-service profile ids use `self-service:<company>`.

## Human Review And Lead Update Path

```text
PATCH /api/leads/:id
  -> worker/api/leads.js
  -> getLeadById()
  -> updateLeadPatchAtomic()
  -> leads row update
  -> optional status_log insert
```

Patchable concepts:

| Concept | Field(s) | Notes |
| --- | --- | --- |
| Sales pipeline state | `status` | Uses `VALID_TRANSITIONS` from `worker/db/transform.js` |
| Human review state | `review_status` / `reviewStatus` | Frozen states from `worker/lib/leadbrief-v1.js`; separate from `status` |
| Operator notes | `notes`, `manual_review_notes_updated_at` | Human-entered manual notes are truncated to the allowed payload size in code; the timestamp records the last accepted manual note change/save/clear event only |
| Follow-up | `follow_up_date` | Validated as `YYYY-MM-DD` |
| Value estimate | `estimated_value` | Stored as non-negative integer |

`updateLeadPatchAtomic()` builds one D1 batch for the lead update and any status log entry, so invalid mixed payloads should not partially update the row.

## Enrichment Path

```text
POST /api/leads/:id/enrich or POST /api/leads/batch-enrich
  -> worker/api/enrichment.js
  -> article body fetch and LLM enrichment
  -> updateLeadEnrichment()
  -> leads enrichment fields
```

Enrichment can update summary, ROI, sales pitch, global context, article body, action items, key figures, pain points, MEDDIC, competitive context, buying signals, evidence, assumptions, and enrichment timestamps. Tests keep no-body enrichment conservative when article text is unavailable.

## Trigger And Job Ledger Path

```text
POST /trigger
  -> authenticateTriggerRequest()
  -> createOrReuseAcceptedTriggerRun()
  -> dispatchGitHubTrigger()
  -> 202 accepted body with statusUrl
  -> GitHub Actions generate-report workflow
  -> POST /api/jobs/:requestId/events callbacks
  -> D1 job_runs state transitions
```

The trigger path is intake-only. A `202 accepted` response means the job was accepted or deduplicated, not completed. Completion is recorded later through callback events from the GitHub workflow.

## Internal Published Report Path

```text
GET /api/internal/profiles/:profileId/latest-published
  -> INTERNAL_API_TOKEN auth when configured, with API_TOKEN compatibility fallback
  -> loadPublishedLatestSnapshot()
  -> map frozen crm.published-report.v1 response
  -> if no snapshot, inspect D1 active job ledger for queued readiness
```

This internal API is a frozen CRM-style published-report contract. It
intentionally reads the canonical GitHub latest artifact and job ledger
readiness; it does not expose the full LeadBrief/D1 review surface unless a
separate contract expansion is scoped. Its GitHub read uses the same bounded
buffer, strict UTF-8, 90-entry, structure, nesting, profile-segment, and
pre-parse guard as the managed latest path, then proves the same projected
payload-byte and unique route-safe lead-id invariants before `syncReady:true`.

## D1 Runtime Schema

`worker/schema.sql` is the canonical fresh local/test schema.
`worker/db/migration-manifest.js` and `worker/db/migrations.js` define the
explicit versioned upgrade path. Runtime `ensureD1Schema(db)` is read-only: it
requires the exact supported version in `d1_schema_migrations` and fails
closed with `ERR_D1_SCHEMA_NOT_READY`; request handlers do not execute DDL.

### Tables

| Table | Owner files | Purpose |
| --- | --- | --- |
| `d1_schema_migrations` | `worker/db/migration-manifest.js`, `worker/db/migrations.js` | Applied application schema versions |
| `leads` | `worker/db/migration-manifest.js`, `worker/db/leads.js`, `worker/db/transform.js` | Managed and self-service working records, trust metadata, enrichment data, pipeline/review state |
| `published_snapshot_heads` | `worker/db/migration-manifest.js`, `worker/db/published-snapshots.js` | Current typed `latest`/`history` snapshot identity and fetch time per profile |
| `published_snapshot_entries` | `worker/db/migration-manifest.js`, `worker/db/published-snapshots.js` | Ordered, sanitized payload entries for each typed snapshot |
| `analytics` | `worker/db/migration-manifest.js`, `worker/db/leads.js` | Self-service and run analytics summaries |
| `status_log` | `worker/db/migration-manifest.js`, `worker/db/leads.js` | Pipeline status transition history |
| `manual_review_note_events` | `worker/db/migration-manifest.js`, `worker/db/leads.js` | Local/test metadata-only manual note create/edit/clear history without note body text |
| `reviewer_feedback` | `worker/db/migration-manifest.js`, `worker/db/leads.js` | Local/test current human-entered reviewer feedback signals by lead |
| `reviewer_feedback_events` | `worker/db/migration-manifest.js`, `worker/db/leads.js` | Local/test metadata-only reviewer feedback create/edit/clear history without feedback body text |
| `job_runs` | `worker/db/migration-manifest.js`, `worker/db/job-runs.js` | Trigger acceptance, idempotency, active-run lock, GitHub/Cloud Run correlation metadata |
| `reference_library` | `worker/db/migration-manifest.js`, `worker/db/references.js` | Reference cases used by prompt/proposal helpers and reference APIs |

### Leads Column Groups

| Group | Columns |
| --- | --- |
| Identity and ownership | `id`, `identity_key`, `profile_id`, `source`, `created_at`, `updated_at` |
| Pipeline and review | `status`, `review_status`, `notes`, `manual_review_notes_author_label`, `manual_review_notes_updated_at`, `follow_up_date`, `estimated_value` |
| Core brief | `company`, `summary`, `product`, `score`, `grade`, `roi`, `sales_pitch`, `global_context`, `sources` |
| LeadBrief and trust | `score_reason`, `urgency`, `urgency_reason`, `buyer_role`, `evidence`, `confidence`, `confidence_reason`, `assumptions`, `generation_mode`, `verification_status`, `data_gaps`, `event_type` |
| Enrichment | `enriched`, `article_body`, `action_items`, `key_figures`, `pain_points`, `enriched_at`, `meddic`, `competitive`, `buying_signals` |

### Explicit migrations and runtime readiness

- Version 1 introspects legacy `leads` columns, adds only missing columns,
  creates dependent indexes after the column additions, and records its
  version last in the same D1 batch.
- Version 2 creates the typed snapshot head/entry tables and lookup index.
- Only the exact duplicate-column race shape is eligible for one
  re-introspection/retry; unrelated failures propagate and do not record a
  successful version.
- `ensureD1Schema()` performs three bounded read-only checks per cold D1
  binding. Each query returns the expected canonical row set plus at most one
  excess sentinel: the exact migration chain, every canonical column
  definition in `cid` order, and canonical table/index/trigger objects.
  Non-`leads` tables require exact normalized `CREATE TABLE` SQL; `leads`
  requires exact canonical per-column clauses in its actual `cid` order;
  all SQL-backed indexes on canonical tables must be the named exact
  allowlist, and any trigger on a canonical table is rejected. It caches only
  successful readiness.
- Deployed version 1 and 2 DDL/index meaning is pinned by full source
  fingerprints and imported runtime semantic SHA-256 tests. A future schema
  change must add a new version; editing both existing sources in place still
  fails the guard.
- `applyLocalTestD1Migrations(db)` is a marked local SQLite simulator, is not
  imported by Worker routes, and refuses ordinary D1 bindings. The legacy-v1
  simulation needs 61 statement/query operations, so it must not be reused as
  a Worker migration path. Staging or production requires a separately
  approved versioned Wrangler migration-files/command workflow and remains
  `HOLD`.

## Read And Write Surfaces

| Surface | D1 read | D1 write | Notes |
| --- | --- | --- | --- |
| `GET /api/leads` | Yes | Possible typed `latest` cache refresh | Self-service profiles keep direct working-row reads; managed responses include `snapshotId`, `snapshotFetchedAt`, and `snapshotStale` |
| `GET /api/history` | Yes | Possible typed `history` cache refresh | Uses a separate head/payload collection, never upserts working leads, and cannot consume `latest` membership |
| `PATCH /api/leads/:id` | Yes | Yes | Atomic review/pipeline/manual-note/reviewer-feedback update path |
| `GET /api/export/csv` | Yes | No | CSV includes review/trust metadata |
| `GET /api/dashboard` | Yes | No | Aggregates D1 leads, status logs, analytics |
| `GET /leads/:id` | Yes | No | Authenticated server-rendered detail page |
| Enrichment APIs | Yes | Yes | Update enrichment columns |
| Self-service analyze | No existing rows required | Yes, async | Writes leads and analytics when `DB` exists |
| Trigger/job APIs | Yes | Yes | Use `job_runs` for accepted/running/terminal state |
| Reference APIs | Yes | Yes | Use `reference_library` |

## Contract Boundaries

- LeadBrief human review state is `reviewStatus` in API/domain objects and `review_status` in D1. It is distinct from sales pipeline `status`.
- `verificationStatus` is machine/trust metadata, not human approval.
- Managed profile product canonicalization happens in `worker/lib/profile.js` when Worker APIs return lead collections.
- Published report artifacts remain canonical for managed latest/history
  payloads. D1 stores their typed cache identity separately from mutable
  review, enrichment, notes, and dashboard working state.
- `reviewerFeedback` is local/test human-entered feedback only. Current values
  live in `reviewer_feedback`; history lives in metadata-only
  `reviewer_feedback_events`; generated reviewer suggestions must not be
  stored in either table.
- The frozen internal CRM report contract is not the same as the full LeadBrief Worker API contract.

## Product Non-Goals In Data Terms

- Not a CRM replacement: D1 stores enough pipeline/review metadata for this product, not a full account/opportunity system.
- Not an automatic salesperson: lead generation and helper outputs are review inputs, and default/fallback states require human review.
- Not a proposal generator source of truth: proposal/PPT/CPA/roleplay routes consume lead context but do not define canonical lead records.
- Not PPT-first: PPT is an export/helper route; the durable path is lead evidence, D1 review state, and report artifacts.

## Production Evidence Boundary

The following do not prove production D1 migration or production correctness:

- `worker/db/migration-manifest.js`, `worker/db/migrations.js`, or
  `worker/db/schema.js` source inspection.
- Local tests and fake D1 helpers.
- CI passing.
- These architecture docs.
- PR descriptions or generated summaries.

Production D1 readiness still requires separate approval, an actual schema
inventory/adoption decision, an explicit migration-before-runtime rollout,
rollback ownership, and redacted evidence. This PR does not execute or approve
that operation.
