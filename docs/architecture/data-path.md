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
  -> Worker /api/leads or /api/history managed fallback
  -> optional D1 cache through saveLeadsBatch()
```

Key details:

- `main.js` owns the CLI contract: `node main.js --profile <profileId> [--email]`.
- `orchestrator/news-orchestrator.js` gathers and enriches articles before qualification.
- `lead-qualifier.js` normalizes sources and generation trust metadata; demo fallback is not allowed unless explicitly configured.
- `lead-report-publisher.js` writes canonical report artifacts and refuses demo leads as canonical latest leads.
- `.github/workflows/generate-report.yml` is the automated managed-run workflow. It receives `repository_dispatch`, runs the root CLI, commits report artifacts, and pushes them.
- Worker managed reads prefer D1 rows. When no D1 rows exist, `worker/api/leads.js` reads GitHub report artifacts and may persist them into D1.

## Self-Service Lead Path

```text
POST /api/analyze
  -> auth and rate limit in worker/index.js
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
| Operator notes | `notes` | Truncated to the allowed payload size in code |
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
  -> API_TOKEN-only auth
  -> loadPublishedLatestSnapshot()
  -> map frozen crm.published-report.v1 response
  -> if no snapshot, inspect D1 active job ledger for queued readiness
```

This internal API is a frozen CRM-style published-report contract. It intentionally reads the canonical GitHub latest artifact and job ledger readiness; it does not expose the full LeadBrief/D1 review surface unless a separate contract expansion is scoped.

## D1 Runtime Schema

Runtime D1 setup is owned by `ensureD1Schema(db)` in `worker/db/schema.js`. The SQL file `worker/schema.sql` is a baseline schema file, but `ensureD1Schema()` is the complete runtime source because it also performs lazy `ALTER TABLE` additions and creates `reference_library`.

### Tables

| Table | Owner files | Purpose |
| --- | --- | --- |
| `leads` | `worker/db/schema.js`, `worker/db/leads.js`, `worker/db/transform.js` | Managed and self-service lead records, LeadBrief/trust metadata, enrichment data, pipeline/review state |
| `analytics` | `worker/db/schema.js`, `worker/db/leads.js` | Self-service and run analytics summaries |
| `status_log` | `worker/db/schema.js`, `worker/db/leads.js` | Pipeline status transition history |
| `job_runs` | `worker/db/schema.js`, `worker/db/job-runs.js` | Trigger acceptance, idempotency, active-run lock, GitHub/Cloud Run correlation metadata |
| `reference_library` | `worker/db/schema.js`, `worker/db/references.js` | Reference cases used by prompt/proposal helpers and reference APIs |

### Leads Column Groups

| Group | Columns |
| --- | --- |
| Identity and ownership | `id`, `identity_key`, `profile_id`, `source`, `created_at`, `updated_at` |
| Pipeline and review | `status`, `review_status`, `notes`, `follow_up_date`, `estimated_value` |
| Core brief | `company`, `summary`, `product`, `score`, `grade`, `roi`, `sales_pitch`, `global_context`, `sources` |
| LeadBrief and trust | `score_reason`, `urgency`, `urgency_reason`, `buyer_role`, `evidence`, `confidence`, `confidence_reason`, `assumptions`, `generation_mode`, `verification_status`, `data_gaps`, `event_type` |
| Enrichment | `enriched`, `article_body`, `action_items`, `key_figures`, `pain_points`, `enriched_at`, `meddic`, `competitive`, `buying_signals` |

### Lazy DDL

`ensureD1Schema()`:

- Creates baseline `leads`, `analytics`, `status_log`, and `job_runs` tables and their indexes.
- Attempts `ALTER TABLE leads ADD COLUMN ...` for columns needed by newer trust, LeadBrief, enrichment, and signal metadata.
- Ignores "column already exists" failures in those lazy column additions.
- Creates `job_runs` and its indexes again after the lead-column lazy section to support existing databases.
- Creates `reference_library` and `idx_ref_profile_cat`, which are not present in the baseline `worker/schema.sql`.
- Uses a module-level promise so concurrent requests share one schema setup operation; the promise resets on setup failure.

Primary lazy lead columns beyond the baseline SQL file include `meddic`, `competitive`, `buying_signals`, `score_reason`, `urgency`, `urgency_reason`, `buyer_role`, `evidence`, `confidence`, `confidence_reason`, `assumptions`, and `event_type`. Trust/review columns such as `review_status`, `generation_mode`, `verification_status`, and `data_gaps` exist in both the baseline table definition and lazy-add list for compatibility with older D1 databases.

## Read And Write Surfaces

| Surface | D1 read | D1 write | Notes |
| --- | --- | --- | --- |
| `GET /api/leads` | Yes | Possible managed cache write | Self-service profiles do not fall back to GitHub artifacts |
| `GET /api/history` | Yes | Possible managed cache write | Similar fallback behavior to leads |
| `PATCH /api/leads/:id` | Yes | Yes | Atomic review/pipeline update path |
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
- Published report artifacts are canonical for managed latest/history fallback, but D1 can hold mutable review, enrichment, notes, and dashboard state.
- The frozen internal CRM report contract is not the same as the full LeadBrief Worker API contract.

## Product Non-Goals In Data Terms

- Not a CRM replacement: D1 stores enough pipeline/review metadata for this product, not a full account/opportunity system.
- Not an automatic salesperson: lead generation and helper outputs are review inputs, and default/fallback states require human review.
- Not a proposal generator source of truth: proposal/PPT/CPA/roleplay routes consume lead context but do not define canonical lead records.
- Not PPT-first: PPT is an export/helper route; the durable path is lead evidence, D1 review state, and report artifacts.

## Production Evidence Boundary

The following do not prove production D1 migration or production correctness:

- `worker/db/schema.js` source inspection.
- Local tests and fake D1 helpers.
- CI passing.
- These architecture docs.
- PR descriptions or generated summaries.

Production D1 readiness requires the approval and observation steps in `docs/exec-plans/d1-lazy-migration-observation-plan.md`, including explicit deploy approval, lazy DDL/migration approval, production write approval when a write is used, and production observation-claim approval.
