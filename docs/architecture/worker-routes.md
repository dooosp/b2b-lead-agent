# Worker Route Map

`worker/index.js` delegates requests to `worker/routes/dispatcher.js`. Route matching, static/page/API boundaries, response helpers, and route inventory live under `worker/routes/*`. The tables below map route ownership, auth boundaries, and major side effects. This is not an endpoint test record; it is a source map for maintainers.

## Auth Boundaries

| Boundary | Source | Rule |
| --- | --- | --- |
| CORS preflight | `worker/routes/static.js`, `worker/lib/cors.js` | Any `OPTIONS` request returns from `handleOptions()` before API routing |
| General API auth | `worker/lib/auth.js` via `verifyAuth()` | Bearer token must match `API_TOKEN`; if `API_TOKEN` is absent, `TRIGGER_PASSWORD` is the fallback token |
| Internal API auth | `worker/lib/auth.js` via `verifyInternalApiAuth()` | Bearer token must match `API_TOKEN`; `TRIGGER_PASSWORD` is not accepted |
| Trigger auth | `worker/lib/job-trigger.js` | Bearer-first; legacy body password is allowed only by `ALLOW_TRIGGER_BODY_PASSWORD` or when no `API_TOKEN` is configured |
| Job event callback auth | `worker/lib/job-trigger.js` | `X-Job-Callback-Token` derived from callback secret and request id |
| Self-service auth | `worker/routes/api.js`, `worker/self-service/rate-limit.js` | `POST /api/analyze` requires general API auth unless `REQUIRE_SELF_SERVICE_AUTH=false`, then applies self-service rate limiting |

## API Routes

| Method | Path | Handler | Auth | Reads | Writes or side effects |
| --- | --- | --- | --- | --- | --- |
| `POST` | `/api/analyze` | `worker/self-service/orchestrator.js` | General API auth by default; self-service rate limit | News sources, article bodies, LLM provider | Persists self-service leads and analytics to D1 via `ctx.waitUntil()` when `DB` exists |
| `POST` | `/trigger` | `worker/api/trigger.js` | Trigger auth plus rate limit | D1 `job_runs` active/idempotency state | Inserts or reuses accepted job run; dispatches GitHub `repository_dispatch`; returns `202` intake response |
| `GET` | `/api/jobs/:requestId` | `worker/api/jobs.js` | General API auth | D1 `job_runs` | None |
| `POST` | `/api/jobs/:requestId/events` | `worker/api/jobs.js` | Callback token | D1 `job_runs` | Updates job state and target-specific metadata |
| `GET` | `/api/leads` | `worker/api/leads.js` | General API auth | D1 first; GitHub raw report fallback for managed profiles | May cache managed GitHub latest leads into D1 when `DB` exists and rows are missing |
| `GET` | `/api/history` | `worker/api/leads.js` | General API auth | D1 first; GitHub raw history fallback for managed profiles | May cache managed GitHub history into D1 when `DB` exists and rows are missing |
| `PATCH` | `/api/leads/:id` | `worker/api/leads.js` | General API auth | D1 lead row | Atomically updates pipeline status, review status, notes, follow-up date, estimated value, and status log as applicable |
| `POST` | `/api/leads/:id/enrich` | `worker/api/enrichment.js` | General API auth | D1 lead row, article body, LLM provider | Updates enrichment fields on the D1 lead row |
| `POST` | `/api/leads/batch-enrich` | `worker/api/enrichment.js` | General API auth | D1 lead rows | Updates enrichment fields for selected leads |
| `GET` | `/api/dashboard` | `worker/api/dashboard.js` | General API auth | D1 dashboard metrics | None |
| `GET` | `/api/export/csv` | `worker/api/leads.js` | General API auth | D1 leads | Returns CSV including review/trust metadata |
| `GET` | `/api/internal/profiles/:profileId/latest-published` | `worker/api/internal-reports.js` | Internal API auth only | GitHub published latest snapshot, D1 active job ledger for readiness | None; frozen `crm.published-report.v1` response contract |
| `GET` | `/api/references` | `worker/api/references.js` | General API auth checked inside route block | D1 `reference_library` | None beyond schema readiness |
| `POST` | `/api/references` | `worker/api/references.js` | General API auth checked inside route block | None | Inserts reference row into D1 |
| `DELETE` | `/api/references/:id` | `worker/api/references.js` | General API auth checked inside route block | None | Deletes reference row from D1 |
| `POST` | `/api/ppt` | `worker/api/ppt.js` | General API auth | Request body | Returns generated PPT payload/content |
| `POST` | `/api/proposal` | `worker/api/proposal.js` | General API auth | Request body, optional D1 reference helpers | Returns proposal content |
| `POST` | `/api/cpa` | `worker/api/cpa.js` | General API auth | Request body | Returns deterministic CPA/ESCO estimate |
| `POST` | `/api/roleplay` | `worker/api/roleplay.js` | General API auth | Request body, LLM provider | Returns roleplay guidance |

## Asset And Page Routes

| Path | Renderer | Auth at route level | Notes |
| --- | --- | --- | --- |
| `/manifest.json` | `worker/pages/pwa.js` | Public | PWA manifest |
| `/sw.js` | `worker/pages/pwa.js` | Public | Service worker JavaScript; skips API fetches in cache logic |
| `/leads/:id` | `worker/pages/lead-detail.js` | General API auth; D1 required | Server-rendered detail page reads the D1 lead and status log |
| `/leads` | `worker/pages/leads.js` | Public page shell | Browser JavaScript calls protected APIs with auth headers |
| `/dashboard` | `worker/pages/dashboard.js` | Public page shell | Browser JavaScript calls protected dashboard/leads APIs |
| `/history` | `worker/pages/history.js` | Public page shell | Browser JavaScript calls protected history API |
| `/ppt` | `worker/pages/ppt.js` | Public page shell | Helper page for PPT generation |
| `/proposal` | `worker/pages/proposal.js` | Public page shell | Helper page for proposal generation |
| `/cpa` | `worker/pages/cpa.js` | Public page shell | Helper page for CPA estimate |
| `/roleplay` | `worker/pages/roleplay.js` | Public page shell | Helper page for roleplay guidance |
| fallback `/` and unmatched paths | `worker/pages/home-page.js` | Public page shell | Home/self-service UI; self-service API still has its own auth and rate limit |

## Route Ordering Notes

- `worker/routes/dispatcher.js` dispatches CORS/static routes, then API/job routes, then page routes.
- `/api/internal/*` is matched inside API routing before the general API handlers and uses `API_TOKEN` only.
- The general protected API list is represented by route metadata and API matchers for `/api/leads`, `/api/leads/batch-enrich`, `/api/ppt`, `/api/proposal`, `/api/cpa`, `/api/roleplay`, `/api/history`, `/api/dashboard`, `/api/export/csv`, `/api/leads/*`, and `GET /api/jobs/:requestId`.
- `POST /api/jobs/:requestId/events` is not protected by general Bearer auth; it is protected by the callback token inside `handleJobEvent()`.
- `/api/references` performs its own `verifyAuth()` checks in each route handler.
- Unknown `/api/*` paths return JSON `404`; unsupported methods on known static/API routes return JSON `405` with `Allow` when route metadata knows the allowed methods.
- HTML page shells are mostly public at the router level. Sensitive data requests are expected to go through protected APIs, except `/leads/:id`, which authenticates before server-side D1 reads.
- `GET /api/leads` and `GET /api/history` can have a D1 write side effect for managed profiles because they cache GitHub report artifacts when D1 is empty.

## External Network Boundaries

| Boundary | Files | Purpose |
| --- | --- | --- |
| GitHub raw content | `worker/api/leads.js`, `worker/lib/published-reports.js` | Read canonical managed report artifacts |
| GitHub repository dispatch | `worker/lib/job-trigger.js` | Trigger the root report-generation workflow |
| OpenAI/Gemini providers | `worker/lib/openai.js`, `worker/lib/gemini.js`, `worker/self-service/*`, `worker/api/roleplay.js`, `worker/api/enrichment.js` | Analyze leads, enrichment, roleplay, self-service profile/lead generation |
| Public news/article sources | `worker/self-service/news.js`, `worker/self-service/rss.js`, `worker/api/enrichment.js` | Gather self-service public context |

## Maintenance Checklist

When adding or changing a route:

- Add or update the route row above.
- State the auth boundary explicitly.
- State whether the route reads D1, writes D1, calls external services, or mutates GitHub artifacts.
- Update `worker/routes/metadata.js` when adding or changing route boundaries.
- Add or update the smallest matching test in `worker/tests/` or `tests/`.
- Re-run at least `npm run test:worker` for Worker route changes; run `npm test` when the route changes cross root/Worker contracts.
