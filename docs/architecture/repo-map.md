# Repository Architecture Map

This map describes the source tree on `master` as inspected for the architecture docs refresh. It is documentation only: it does not prove production deployment, D1 migration, endpoint behavior, or release readiness by itself.

## Source Of Truth

- Repo root: `b2b-lead-agent`
- Root package: CommonJS batch pipeline, declared in `package.json`
- Worker package: ESM Cloudflare Worker, declared by `worker/package.json`
- Worker config: `worker/wrangler.toml`
- Current hardening source: `HARDENING_PLAN.md`
- Repo-local operating rules: `AGENTS.md`

When runtime behavior changes, update this map from source files, tests, and workflow definitions, not from old task notes.

## Top-Level Product Shape

| Area | Primary files | Responsibility |
| --- | --- | --- |
| Root pipeline | `main.js`, `orchestrator/news-orchestrator.js`, `lead-qualifier.js`, `lead-report-publisher.js`, `profile-registry.js` | Batch news collection, lead qualification, canonical report artifact publishing, optional email |
| Profiles | `profiles/*.js`, `profile-registry.js` | Managed seller profiles and search/product context |
| Published artifacts | `reports/<profile>/latest-leads.json`, `reports/<profile>/lead-history.json`, `reports/<profile>/lead-report-YYYY-MM-DD.md` | Canonical managed lead snapshots consumed by the Worker fallback paths |
| Worker API | `worker/index.js`, `worker/routes/*.js`, `worker/api/*.js` | Route dispatch, route metadata, authenticated APIs, trigger/job ledger, internal report contract |
| Worker D1 layer | `worker/db/*.js`, `worker/schema.sql` | Lazy D1 schema creation, lead/job/reference persistence, row transforms |
| Worker self-service | `worker/self-service/*.js` | Authenticated ad hoc company/industry analysis and self-service D1 persistence |
| Worker UI pages | `worker/pages/*.js` | Browser page shells for leads, dashboard, Opportunity Workbench, proposal/PPT helpers, roleplay, CPA |
| Tests | `tests/*.test.js`, `worker/tests/*.test.mjs`, `worker/e2e/*.test.mjs` | Root, Worker, local E2E, and contract coverage |
| Release workflows | `.github/workflows/*.yml`, `docs/exec-plans/d1-lazy-migration-observation-plan.md` | CI gates, report-generation dispatch, production observation planning |

## Root Scripts

| Script | Command | What it covers |
| --- | --- | --- |
| `start` | `node main.js --profile danfoss` | Local/default managed batch run for the Danfoss profile |
| `email` | `node main.js --profile danfoss --email` | Managed batch run plus email send path |
| `check:naming` | `node scripts/check-naming.js` | Canonical path and artifact naming guard |
| `check:schema` | `node scripts/check-d1-schema-consistency.js` | Local D1 schema drift guard for `worker/schema.sql` and `worker/db/schema.js` |
| `evidence:packet` | `node scripts/generate-release-evidence-packet.js` | Local-only release evidence packet generator |
| `eval:lead-quality` | `node scripts/evaluate-lead-quality.js --fixtures` | Synthetic-only lead quality evaluator for evidence, confidence, assumptions, gaps, verification, and review readiness |
| `e2e` | `node e2e-test.mjs` | Browser/end-to-end smoke surface when explicitly needed |
| `test:e2e:local` | `node --test worker/e2e/local-e2e.test.mjs` | Local-only Worker smoke harness using fake D1 and loopback browser rendering |
| `test:evidence` | `node --test tests/release-evidence-redaction.test.js tests/release-evidence-packet.test.js` | Release evidence packet and redaction coverage |
| `test:root` | `node --test tests/*.test.js` | Root pipeline and root/Worker contract fixtures |
| `test:runtime` | `npm run test:root` | Alias for root runtime tests |
| `test:unit` | `find worker/tests -maxdepth 1 -name '*.test.mjs' ! -name 'job-trigger.test.mjs' ! -name 'trigger-handler.test.mjs' ! -name 'workflow-contract.test.mjs' -print0 | xargs -0 node --test` | Worker unit tests excluding trigger/workflow contract suites |
| `test:contract` | `node --test worker/tests/job-trigger.test.mjs worker/tests/trigger-handler.test.mjs worker/tests/workflow-contract.test.mjs` | Trigger/job/workflow contract tests |
| `test:worker` | `npm run test:unit && npm run test:contract` | Combined Worker gate |
| `test` | `npm run test:root && npm run test:worker` | Full local gate used by CI |

## Root Pipeline Flow

1. `main.js` parses `--profile <profileId>` and optional `--email`, loads a managed profile from `profile-registry.js`, and creates an observation run with `lib/obs.js`.
2. `orchestrator/news-orchestrator.js` fetches Google News plus Korean RSS sources, deduplicates articles, and enriches article bodies.
3. `lead-qualifier.js` builds traceable source evidence, calls the LLM qualification path, normalizes lead trust metadata, and fails closed when configured LLM execution is unavailable unless explicit demo mode is enabled.
4. `lead-report-publisher.js` composes the Markdown report, prepares stable lead snapshots, refuses demo leads in canonical latest artifacts, and writes the canonical `reports/<profile>/...` files.
5. `email-sender.js` runs only when `--email` is provided.

## Worker Shape

`worker/index.js` is a small fetch delegate. Route matching and boundary behavior live in `worker/routes/dispatcher.js`, `worker/routes/api.js`, `worker/routes/static.js`, `worker/routes/pages.js`, `worker/routes/responses.js`, and `worker/routes/metadata.js`. Those route modules import handlers from `worker/api/*`, D1 helpers from `worker/db/*`, self-service orchestration from `worker/self-service/*`, and HTML page renderers from `worker/pages/*`.

Key bindings in `worker/wrangler.toml`:

| Binding or var | Purpose |
| --- | --- |
| `DB` | D1 database `b2b-leads-db` |
| `RATE_LIMIT` | KV namespace for trigger and self-service throttling |
| `GITHUB_REPO` | Repository used for GitHub report artifacts and dispatch |
| `WORKER_ORIGIN` | Configured Worker origin |
| `PROFILES` | Managed profile list exposed to Worker profile resolution |
| `REQUIRE_SELF_SERVICE_AUTH` | Defaults self-service analyze to Bearer-token auth |
| `ENABLE_SELF_SERVICE_RATE_LIMIT`, `SELF_SERVICE_RATE_LIMIT_MAX`, `SELF_SERVICE_RATE_LIMIT_WINDOW_SEC` | Self-service throttling controls |

## Test Suite Map

| Suite | Files | Main intent |
| --- | --- | --- |
| Root runtime | `tests/main.runtime.test.js` | Runtime completion is emitted only after real summary evidence |
| Root trust and publishing | `tests/source-traceability.test.js`, `tests/company-name-accuracy.test.js`, `tests/root-identity-trust.test.js`, `tests/fallback-publication-guard.test.js`, `tests/leadbrief-publication-contract.test.js` | Source traceability, company-name hardening, stable identity, fallback/demo publication guards, LeadBrief artifact fields |
| Internal report contract | `tests/internal-published-report-api.test.js` | `/api/internal/profiles/:profileId/latest-published` auth/readiness/frozen contract behavior |
| Lead quality evaluator | `tests/lead-quality-evaluator.test.js`, `eval/fixtures/synthetic-leads.js` | Synthetic fixture quality scoring, local-only input guards, and review-readiness outcomes |
| Worker data contracts | `worker/tests/data-contract.test.mjs`, `worker/tests/leadbrief-v1-contract.test.mjs`, `worker/tests/lead-review-status.test.mjs`, `worker/tests/lead-patch-atomicity.test.mjs` | D1 row roundtrip, LeadBrief v1, review status, pipeline status, atomic PATCH behavior |
| Worker trigger/job contracts | `worker/tests/job-trigger.test.mjs`, `worker/tests/trigger-handler.test.mjs`, `worker/tests/workflow-contract.test.mjs` | Intake-only trigger acceptance, job ledger transitions, workflow callback contract |
| Worker security | `worker/tests/security-hardening.test.mjs` | Bearer-only surfaces, query-token rejection, self-service auth/rate limit defaults |
| Worker local E2E and review UI | `tests/e2e-config.test.js`, `worker/e2e/local-e2e.test.mjs`, `worker/tests/opportunity-workbench.test.mjs`, `worker/tests/dashboard-401-ux.test.mjs` | Local-only target guard, fake-D1 route/page smoke, Opportunity Workbench render coverage, and dashboard auth recovery UX |
| Worker self-service | `worker/tests/self-service-*.test.mjs`, `worker/tests/home-page-self-service-trust.test.mjs` | Self-service model schema, fallback trust metadata, profile generation, UI/download preservation |
| Worker helpers | `worker/tests/enrichment.test.mjs`, `worker/tests/w2-api-canonicalization.test.mjs`, `worker/tests/cpa-estimator.test.mjs`, `worker/tests/proposal-*.test.mjs` | Enrichment trust, product canonicalization, CPA/proposal helpers |

## Release And Proof Workflows

| Workflow or doc | Trigger | What it proves |
| --- | --- | --- |
| `.github/workflows/ci.yml` | Pull request and push to `master` or `main` | `npm run check:schema` and `npm test` pass after dependency install |
| `.github/workflows/validate-naming.yml` | Pull request and push | `npm run check:naming` and `npm run test:worker` pass |
| `.github/workflows/generate-report.yml` | `repository_dispatch` event type `generate-report` | Validates managed profile, marks job ledger callbacks, runs `node main.js --profile "$PROFILE" --email`, commits report artifacts, and pushes them |
| `docs/exec-plans/d1-lazy-migration-observation-plan.md` | Human-approved future operation | Planning checklist for production deploy, lazy D1 DDL observation, safe write approval, rollback owner, and evidence template |

Local tests and docs are not production evidence. The D1 observation plan explicitly says production deploy, lazy DDL, production DB writes, and production-observed claims each require separate human approval.

## Product Boundary

The product is a B2B lead discovery, briefing, and human-review aid. The canonical unit is a LeadBrief-style lead with source/trust metadata and a separate human `reviewStatus`.

Known non-goals:

- Not a CRM replacement. The Worker has a limited sales pipeline state and review metadata, but does not own assignments, comments, notifications, account hierarchy, forecasting, or full CRM lifecycle management.
- Not an automatic salesperson. Generated leads, pitches, proposal/PPT helpers, and roleplay tools require human review; LLM or heuristic output is not human approval.
- Not a proposal generator as the source of truth. `/api/proposal`, `/api/ppt`, `/api/cpa`, and `/api/roleplay` are helper surfaces around lead context, not the canonical lead database or report contract.
- Not a PPT-first product. PPT generation exists as an auxiliary action; the primary data path remains lead discovery, review, D1 persistence, and published report artifacts.
- Not production proof by documentation. Architecture docs, local tests, and CI are supporting evidence only; production D1 readiness requires the approved observation workflow.

## Maintenance Notes

- Update `docs/architecture/worker-routes.md` whenever `worker/routes/*` or `worker/index.js` changes route matching, auth boundaries, or handler ownership.
- Update `docs/architecture/data-path.md` whenever `worker/db/schema.js`, `worker/schema.sql`, `lead-report-publisher.js`, or self-service persistence changes.
- Treat `worker/db/schema.js` as the runtime D1 schema source because it contains lazy DDL beyond the baseline `worker/schema.sql`.
- Keep product boundary language aligned with `AGENTS.md`, `HARDENING_PLAN.md`, and the D1 observation plan.
