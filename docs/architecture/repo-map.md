# Repository Architecture Map

This map describes the source tree on `master` as inspected for the architecture docs refresh. It is documentation only: it does not prove production deployment, D1 migration, endpoint behavior, or release readiness by itself.

## Source Of Truth

- Repo root: `b2b-lead-agent`
- Root package: CommonJS batch pipeline, declared in `package.json`
- Worker package: ESM Cloudflare Worker, declared by `worker/package.json`
- Worker config: `worker/wrangler.toml`
- Current hardening source: `HARDENING_PLAN.md`
- Repo-local operating rules: `AGENTS.md`
- Product overview: `README.md`

When runtime behavior changes, update this map from source files, tests, and workflow definitions, not from old task notes.

## Top-Level Product Shape

| Area | Primary files | Responsibility |
| --- | --- | --- |
| Root pipeline | `main.js`, `orchestrator/news-orchestrator.js`, `lead-qualifier.js`, `lead-report-publisher.js`, `pipeline-run-state.js`, `git-publication.js`, `notification-runner.js`, `profile-registry.js` | Batch news collection, lead qualification, typed local publication, verified Git publication, and post-publication notification |
| Profiles | `profiles/*.js`, `profile-registry.js` | Managed seller profiles and search/product context |
| Evidence Claim Registry | `knowledge/claim-registry/index.mjs`, `knowledge/claim-registry/synthetic/*.json` | Typed claim validation, provenance, status, applicability, conflict, expiry, and customer-use boundaries |
| Golden Dataset candidate intake | `knowledge/golden-dataset/index.mjs`, `knowledge/golden-dataset/datacenter-kr-v{0,1}/*.json`, `scripts/lib/golden-human-review-{batch,proposal}*.mjs` | Immutable Batch 01 input plus hash-pinned additive v1 public-source candidates, separate append-only human adjudication, canonical IDs, immutable blank review inputs, and non-authoritative AI-assisted proposals; current offline state is human-confirmed but not executable production evidence |
| Data center pursuit domain | `verticals/datacenter/index.mjs`, `verticals/datacenter/pursuit-twin-v0.mjs`, `verticals/datacenter/pursuit-value-pilot-v0.mjs`, `verticals/datacenter/*.json` | Project Opportunity validation, deterministic Specification Fit and Window evaluation, Pursuit Dossier generation, hash-linked Spec Delta, Minimum Evidence to Advance, and the separate local/synthetic five-reviewer value-pilot contract |
| Claim/spec-fit evaluation | `eval/spec-fit-evaluator.mjs`, `eval/pursuit-twin-v0-evaluator.mjs`, `eval/fixtures/spec-fit/*`, `scripts/audit-evidence-claims.mjs`, `scripts/evaluate-{spec-fit,pursuit-twin-v0}.mjs` | Network-free synthetic claim audit, scenario evaluation, revision/minimum-evidence evaluation, and stable local artifacts |
| Published artifacts | `reports/<profile>/publication-manifest.json`, `reports/<profile>/publications/<publicationId>/*`, and the established fixed report/latest/history paths | Immutable manifest-selected publication plus fixed-path Git compatibility artifacts used only when a legacy publication has no manifest |
| Worker API | `worker/index.js`, `worker/routes/*.js`, `worker/api/*.js` | Route dispatch, route metadata, authenticated APIs, trigger/job ledger, internal report contract |
| Worker D1 layer | `worker/db/*.js`, `worker/schema.sql` | Explicit schema migrations and readiness, typed published snapshots, lead/job/reference persistence, row transforms |
| Worker self-service | `worker/self-service/*.js` | Authenticated ad hoc company/industry analysis and self-service D1 persistence |
| Worker UI pages | `worker/pages/*.js` | Browser page shells for leads, dashboard, Opportunity Workbench, Lead Action Intelligence review guidance, proposal/PPT helpers, roleplay, CPA |
| Tests | `tests/*.test.js`, `worker/tests/*.test.mjs`, `worker/e2e/*.test.mjs` | Root, Worker, local E2E, and contract coverage |
| Release workflows | `.github/workflows/*.yml`, `docs/d1-schema-drift-hardening.md` | CI gates, report-generation dispatch, explicit local/test D1 migration and readiness boundaries |

## Root Scripts

| Script | Command | What it covers |
| --- | --- | --- |
| `start` | `node main.js --profile danfoss` | Local/default managed batch run for the Danfoss profile |
| `email` | `node scripts/notify-lead-publication.mjs` | Notification-only runner; requires `-- --profile <id> --result-file <verified-result>` and never generates or publishes |
| `check:naming` | `node scripts/check-naming.js` | Canonical path and artifact naming guard |
| `check:schema` | `node scripts/check-d1-schema-consistency.js` | Local D1 drift guard for `worker/schema.sql` and `worker/db/migration-manifest.js` |
| `evidence:packet` | `node scripts/generate-release-evidence-packet.js` | Local-only release evidence packet generator |
| `audit:claims` | `node scripts/audit-evidence-claims.mjs --json --fail-on-violations` | Strict local audit of repository claim sources and trust boundaries |
| `check:golden-dataset` | `npm run check:golden-dataset` | Runs v0 compatibility, v1 lineage, both approval gates, the current human-confirmed offline audit, and a read-only byte comparison of every checked-in Batch 01/02 generated artifact; Golden readiness is not production readiness |
| `check:golden-artifacts` | `node scripts/check-pursuit-golden-generated-artifacts.mjs` | Builds all Golden audit, JSON, and Markdown outputs in memory and fails on missing or byte-drifted repository artifacts without rewriting them |
| `prepare:golden-review-batch` | `node scripts/prepare-pursuit-golden-human-review.mjs ...` | Writes the ten-project Batch 01 review input with all capability, pair, and revision candidates; no human decision is prefilled |
| `prepare:golden-review-proposal` | `node scripts/prepare-pursuit-golden-human-review-proposal.mjs ...` | Writes the hash-pinned AI-assisted Batch 01 proposal and Korean worksheet; approval identity, receipt, time, and attestation remain blank |
| Golden Batch 01 approval materializer | `node scripts/apply-pursuit-golden-human-review-approval.mjs ...` | One-shot exact-hash materializer restricted to the canonical adjudication and receipt paths; replay is refused after records exist |
| `prepare:golden-review-batch-02` | `node scripts/prepare-pursuit-golden-human-review-batch-02.mjs ...` | Writes only the seven projects not covered by Batch 01; capability, pair, and revision scopes remain empty |
| `prepare:golden-review-proposal-02` | `node scripts/prepare-pursuit-golden-human-review-proposal-02.mjs ...` | Writes the hash-pinned, source-linked Batch 02 recommendations and Korean approval worksheet without recording human approval |
| Golden Batch 02 approval materializer | `node scripts/apply-pursuit-golden-human-review-approval-02.mjs ...` | Executed append-only exact-hash gate for the seven-project v1 adjudication additions and separate Batch 02 receipt; replay is refused and the receipt remains an unauthenticated repository assertion |
| `eval:spec-fit` | `node scripts/evaluate-spec-fit.mjs --fixtures --json --repeat 2` | Deterministic synthetic Specification Fit scenario evaluation |
| `eval:pursuit-twin` | `node scripts/evaluate-pursuit-twin-v0.mjs --json --repeat 2` | Deterministic local/synthetic Spec Delta and Minimum Evidence to Advance evaluation; no external calls or final decision authority |
| `eval:pursuit-value-pilot` | `node scripts/evaluate-pursuit-value-pilot-v0.mjs` | Builds the five synthetic case protocol and proves deterministic pilot readiness while human evidence remains `INCOMPLETE` |
| `prepare:pursuit-value-pilot` | `node scripts/prepare-pursuit-value-pilot-v0.mjs` | Creates the fixed ignored 0700/0600 private intake with five blank sessions, five offline reviewer pages, and one hash-bound blank team-week response envelope; refuses overwrite and never prefills human observations |
| `validate:pursuit-value-pilot` | `node scripts/validate-pursuit-value-pilot-v0.mjs` | Validates only the exact private file set and prints a bounded redacted aggregate without choosing a product or pursuit decision |
| `check:pursuit-value-pilot` | focused pilot tests plus `eval:pursuit-value-pilot` | Hash, blank-human-input, offline/no-network, private-file, fixed-denominator, threshold, and non-production contract gate |
| `test:claim-spec-fit` | `node --test tests/evidence-claim-registry.test.js ...` | Claim Registry, fit, dossier, Spec Delta, Minimum Evidence, prompt projection, failure injection, CLI, and performance coverage |
| `eval:lead-quality` | `node scripts/evaluate-lead-quality.js --fixtures` | Synthetic-only lead quality evaluator for evidence, confidence, assumptions, gaps, verification, and review readiness |
| `e2e` | `node e2e-test.mjs` | Browser/end-to-end smoke surface when explicitly needed |
| `test:e2e:local` | `node --test worker/e2e/local-e2e.test.mjs` | Local-only Worker smoke harness using fake D1 and loopback browser rendering |
| `test:evidence` | `node --test tests/release-evidence-redaction.test.js tests/release-evidence-packet.test.js` | Release evidence packet and redaction coverage |
| `test:root` | `node --test tests/*.test.js` | Root pipeline and root/Worker contract fixtures |
| `test:runtime` | `npm run test:root` | Alias for root runtime tests |
| `test:unit` | `find worker/tests -maxdepth 1 -name '*.test.mjs' ! -name 'job-trigger.test.mjs' ! -name 'trigger-handler.test.mjs' ! -name 'workflow-contract.test.mjs' -print0 | xargs -0 node --test` | Worker unit tests excluding trigger/workflow contract suites |
| `test:contract` | `node --test worker/tests/job-trigger.test.mjs worker/tests/trigger-handler.test.mjs worker/tests/workflow-contract.test.mjs` | Trigger/job/workflow contract tests |
| `test:worker` | `npm run test:unit && npm run test:contract` | Combined Worker gate |
| `test` | `npm run test:root && npm run test:worker` | Full local test gate used by CI before the local-only Worker E2E smoke |

## Root Pipeline Flow

1. `main.js` parses `--profile <profileId>`, optional stable `--run-id`, typed-result, and notification-intent flags, loads a managed profile from `profile-registry.js`, and creates an observation run with `lib/obs.js`. Legacy `--email` is rejected.
2. `orchestrator/news-orchestrator.js` fetches Google News plus Korean RSS sources, deduplicates articles, and enriches article bodies.
3. `lead-qualifier.js` builds traceable source evidence, calls the LLM qualification path, normalizes lead trust metadata, and fails closed when configured LLM execution is unavailable unless explicit demo mode is enabled.
4. `lead-report-publisher.js` validates public fields before rendering, writes an immutable generation, and atomically selects it with `publication-manifest.json`; established fixed names remain Git compatibility artifacts.
5. `git-publication.js` stages the exact manifest-derived path set, normally pushes without force, and verifies the publication commit at the selected remote ref.
6. `notification-runner.js` loads checksum-verified public artifacts directly
   from the retained result's exact Git commit and serializes result-specific
   attempts before it may invoke `email-sender.js`. Retry is explicit,
   recipient-set drift is refused, and provider acceptance is not delivery or
   exactly-once proof.

## Worker Shape

`worker/index.js` is a small fetch delegate. Route matching and boundary behavior live in `worker/routes/dispatcher.js`, `worker/routes/api.js`, `worker/routes/static.js`, `worker/routes/pages.js`, `worker/routes/responses.js`, and `worker/routes/metadata.js`. Those route modules import handlers from `worker/api/*`, D1 helpers from `worker/db/*`, self-service orchestration from `worker/self-service/*`, and HTML page renderers from `worker/pages/*`. Shared managed/internal GitHub artifact stream, UTF-8, cardinality, and pre-parse complexity bounds live in `worker/lib/published-artifact-json.js`; pointer selection and checksum enforcement live in `worker/lib/manifest-published-artifact.js`.

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
| Internal report contract | `tests/internal-published-report-api.test.js` | `/api/internal/profiles/:profileId/latest-published` auth/readiness/frozen contract behavior and shared pre-parse artifact bound |
| Lead quality evaluator | `tests/lead-quality-evaluator.test.js`, `eval/fixtures/synthetic-leads.js` | Synthetic fixture quality scoring, local-only input guards, and review-readiness outcomes |
| Worker data contracts | `worker/tests/data-contract.test.mjs`, `worker/tests/leadbrief-v1-contract.test.mjs`, `worker/tests/lead-review-status.test.mjs`, `worker/tests/lead-patch-atomicity.test.mjs` | D1 row roundtrip, LeadBrief v1, review status, pipeline status, atomic PATCH behavior |
| Worker trigger/job contracts | `worker/tests/job-trigger.test.mjs`, `worker/tests/trigger-handler.test.mjs`, `worker/tests/workflow-contract.test.mjs` | Intake-only trigger acceptance, job ledger transitions, workflow callback contract |
| Worker security | `worker/tests/security-hardening.test.mjs` | Bearer-only surfaces, query-token rejection, self-service auth/rate limit defaults |
| Worker local E2E and review UI | `tests/e2e-config.test.js`, `worker/e2e/local-e2e.test.mjs`, `worker/tests/lead-action-intelligence.test.mjs`, `worker/tests/opportunity-workbench.test.mjs`, `worker/tests/dashboard-401-ux.test.mjs` | Local-only target guard, fake-D1 route/page smoke, deterministic Lead Action Intelligence coverage, Opportunity Workbench render coverage, and dashboard auth recovery UX |
| Worker self-service | `worker/tests/self-service-*.test.mjs`, `worker/tests/home-page-self-service-trust.test.mjs` | Self-service model schema, fallback trust metadata, profile generation, UI/download preservation |
| Worker helpers | `worker/tests/enrichment.test.mjs`, `worker/tests/w2-api-canonicalization.test.mjs`, `worker/tests/cpa-estimator.test.mjs`, `worker/tests/proposal-*.test.mjs` | Enrichment trust, product canonicalization, CPA/proposal helpers |

## Release And Proof Workflows

| Workflow or doc | Trigger | What it proves |
| --- | --- | --- |
| `.github/workflows/ci.yml` | Pull request and push to `master` or `main` | Claim, Golden Dataset boundary, synthetic spec-fit, Pursuit Twin revision/evidence, Value Pilot method readiness, schema, lead-quality, unit, contract, and local E2E gates pass after dependency install |
| `.github/workflows/validate-naming.yml` | Pull request and push | `npm run check:naming` and `npm run test:worker` pass |
| `.github/workflows/generate-report.yml` | `repository_dispatch` event type `generate-report` | Validates the managed profile, records callbacks, emits a typed result, commits and verifies the exact Git publication, recovers interrupted publication evidence, and only then runs notification |
| `docs/exec-plans/d1-lazy-migration-observation-plan.md` | Historical planning record | Pre-explicit-migration lazy-DDL checklist; it is not execution authority and must be superseded by an approved schema-inventory and explicit-migration rollout plan |

Local tests and docs are not production evidence. Production schema inventory,
explicit migration, deploy, D1 writes, and production-observed claims each
require separate human approval.

## Product Boundary

The product-facing identity is `Pursuit Twin KR`: an evidence-first,
human-gated industrial pursuit review system. Its differentiated local/test
unit is `Project Opportunity × Product Family × Specification Window × Evidence
Set`. The current Claim Registry, fit engine, and dossier execute only against
repository-reviewed synthetic evidence.

LeadBrief remains the canonical unit of the existing signal-discovery,
publication, Worker D1, and reviewer workflow. It is upstream candidate context,
not a verified Project Opportunity or technical fit decision. See
`docs/architecture/pursuit-twin-v0.md` for the authority flow.

Known non-goals:

- Not a CRM replacement. The Worker has a limited sales pipeline state and review metadata, but does not own assignments, comments, notifications, account hierarchy, forecasting, or full CRM lifecycle management.
- Not an automatic salesperson. Generated leads, pitches, proposal/PPT helpers, and roleplay tools require human review; LLM or heuristic output is not human approval.
- Not a proposal generator as the source of truth. `/api/proposal`, `/api/ppt`, `/api/cpa`, and `/api/roleplay` are helper surfaces around lead context, not the canonical lead database or report contract.
- Not a PPT-first product. PPT generation exists as an auxiliary action; the primary data path remains lead discovery, review, D1 persistence, and published report artifacts.
- Not a live official-project monitor yet. Spec Delta and Minimum Evidence to Advance execute only against hash-bound local/synthetic inputs; official-data ingestion and a Project Pursuit runtime route remain future contracts.
- Not completed customer validation. The Value Pilot tooling prepares a private five-person synthetic review round, but generated cases, blank records, tests, and hashes are not human sessions or weekly team-use evidence.
- Not an automated bid decision. The dossier decision scope is technical fit and specification window only; the final human Pursue/Hold/No-Bid decision remains `NOT_MADE`.
- Not production proof by documentation. Architecture docs, local tests, and CI are supporting evidence only; production D1 readiness requires the approved observation workflow.

## Maintenance Notes

- Update `docs/architecture/worker-routes.md` whenever `worker/routes/*` or `worker/index.js` changes route matching, auth boundaries, or handler ownership.
- Update `docs/architecture/data-path.md` whenever `worker/db/schema.js`, `worker/schema.sql`, `lead-report-publisher.js`, or self-service persistence changes.
- Treat `worker/schema.sql` as the fresh-schema source and
  `worker/db/migration-manifest.js` as the ordered upgrade source;
  `worker/db/schema.js` is readiness-only and must remain free of DDL.
- Keep product boundary language aligned with `AGENTS.md`, `HARDENING_PLAN.md`, and the D1 observation plan.
