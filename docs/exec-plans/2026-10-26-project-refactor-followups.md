# Project refactor follow-ups

Owner approved all four improvements after the initial refactor. Continue on
`codex/project-refactor-20261026` at base `cc2d148`, preserving its existing
uncommitted changes. Initial 715-test evidence belongs to the first refactor;
this follow-up requires fresh validation.

## Scope and design

- [x] Bound published-artifact loading with one total request budget covering
  manifest headers/body and selected or legacy artifact headers/body. Default
  budget: 10 seconds. Cancel outstanding I/O on expiry and preserve bounded
  stale-cache fallback and readiness-unavailable behavior. Add synthetic stalled
  headers/body, cumulative-budget, cancellation and route-level regression tests.
- [x] Separate lead page styles, generated guidance, and browser behavior into
  cohesive modules. Compose permitted guidance before HTML assembly, removing
  the regex-based removal of generated JavaScript. Share feedback draft and
  mutation handling between list and detail, preserve UI/API/access contracts,
  and cover edits during requests plus suppressed guidance in browser tests.
- [x] Separate publication validation/data projection, Markdown rendering,
  manifest validation, and filesystem transaction responsibilities. Preserve
  public CommonJS exports, artifact bytes/checksums, ordering, identity/trust
  rules, failure codes, atomicity and crash recovery. Keep a small coordinating
  publisher entrypoint and update isolated-copy fixtures.
- [x] Align local and CI Node on an exact supported Node 24 release, with one
  version file consumed by CI and a matching package engine policy. Add an
  offline local workerd smoke gate using Miniflare against the actual Worker
  entrypoint and local storage. Exercise auth, protected HTML/cache boundaries,
  local D1 readiness and a synthetic route flow. No account or remote bindings.

## Ownership

Deadline lane owns published-artifact reader, manifest loader and their tests.
UI lane owns leads/detail pages, new page modules and relevant browser tests.
Publication lane owns root publisher/new publication modules and their tests.
Coordinator owns runtime configuration, package/lockfile, CI, local workerd
test, architecture/docs, integration and independent review.

## Boundaries and evidence

No production/staging endpoint, deploy, remote D1, customer/private data,
credentials, live provider, email or outreach action. Keep
`productionReady:false`, `NOT_PRODUCTION_EVIDENCE`, and Issue #165 HOLD.
The initial implementation scope excluded commit, push and merge. The owner
subsequently authorized these integration steps after successful checks. Prior
files and diff were preserved in
`/tmp/b2b-refactor-phase2-before` for local comparison; no unrelated changes
may be reverted.

Use existing tests for mechanical moves; write failing regressions before
behavior changes. Run full root/Worker suites, naming/schema and CI evidence
gates, local browser E2E and the new workerd gate under the pinned Node version.
An independent reviewer must inspect the full patch and final evidence.

## Results

At the local implementation checkpoint: STATUS: SHIP for the requested
improvements. Changes were uncommitted; no push, merge, hosted CI run or
deployment had been performed at that checkpoint.

All final commands used Node **24.22.1** / npm **11.19.1**. The exact Node pin is
`.nvmrc`; `package.json` engines and all four CI workflows agree with it.
Miniflare `4.20260730.0` and esbuild `0.27.3` are pinned dev dependencies; existing
production dependency resolutions were retained.

| Final validation | Result |
| --- | --- |
| `npm test` | 251 root + 436 Worker unit + 29 contract = **716 passed**, exit 0 |
| `npm run test:e2e:local` | **28 passed**, exit 0; includes real-bundled Worker browser cases |
| `npm run test:worker:runtime` | **11 passed**, exit 0; actual bundled Worker and real local D1 |
| Naming, schema and nine other pre-existing CI/local gates | All 11 commands exit 0 |
| `git diff --check` | exit 0 |
| Independent UI review | PASS after bundled-browser repair |
| Independent publisher review | PASS after naming-gate integration repair |
| Independent deadline/runtime/config/D1 review | PASS |

**755 tests passed** across the complete test, browser and workerd suites, with
zero failures, skips or TODOs. Focused suites and tests rerun inside the gates
are not added to that total. The 12-command gate set consists of
`check:naming`, `check:schema`, `security:audit-triage`,
`check:enrichment-boundary`, `check:enrichment-replay`, `audit:claims`,
`eval:spec-fit`, `test:claim-spec-fit`, `check:lead-pipeline-replay`,
`eval:lead-quality`, `check:level1`, and `test:worker:runtime`.

## Completed changes and discovered defects

1. A single default 10-second publication read budget covers headers, bodies,
   and checksum work. Stalled I/O is aborted/cancelled without awaiting a hung
   cancellation; late promise failures and reader/timer cleanup are covered.
   `PUBLISHED_ARTIFACT_TIMEOUT_MS` accepts only a positive integer up to 10000;
   it can shorten the budget. Existing stale-D1 rules remain intact.
2. The leads document entrypoint is now 24 lines assembling focused modules;
   existing emitted functions and static UI were compared before/after. Guidance
   is composed explicitly before serialization. Shared feedback handling fixes
   detail buttons whose IIFE-scoped handlers were not exposed to inline events,
   and prevents successful save/clear responses from erasing newer drafts.
3. The publication entrypoint is now 207 lines with six acyclic modules for
   constants, lead records, Markdown, manifest, artifact assembly and storage.
   Frozen pre-refactor hashes and complete preparation-object comparisons prove
   unchanged report/latest/history/manifest payloads, exports and default paths.
4. Node/CI versions are aligned, and the new offline Miniflare gate bundles the
   actual Worker with `keepNames:true`, uses ephemeral D1/KV, and rejects all
   outbound fetches. It covers auth, private/no-store HTML, local-only explicit
   migration, protected fields, persisted PATCH/version conflicts and readiness.

The new runtime check exposed a pre-existing D1 compatibility failure: a schema
inspection query exceeded workerd's compound SELECT limit. A read-only VALUES
CTE replaces the UNION chain while retaining allowed table names, output shape,
explicit table/column order and the global drift bound. Real-D1 regressions
cover missing tables, subsets and excess columns. Migration statements, schema
and manifest fingerprints remain unchanged. Custom test fakes were adapted to
the new equivalent query shape.

Independent review also caught two integration defects before completion:

- The naming gate scanned literals in the old monolithic publisher. It now
  verifies the public artifact-name contract and scans separated modules for
  legacy names. Positive and negative isolated-fixture checks pass.
- Serializing the shared browser controller with `Function.toString()` included
  bundler-only `__name` helpers under Wrangler-style `keepNames:true`. An
  explicit self-contained script fragment fixes this; allowed and denied list
  and detail pages are exercised through the actual bundled Worker in Chromium.

All observed failures and fixes were local and synthetic. Existing reload
behavior on server-side version conflict remains unchanged. A read deadline
cannot preempt synchronous JSON parsing; existing byte/structure limits and
post-parse expiry checks still apply. This is not production-readiness evidence:
`productionReady:false` and Issue #165 HOLD remain unchanged.

The implementation checkpoint remote check returned `master` at
`cc2d1484779922e8fb5c8e54bc810958da854794`; the branch was still based on that commit.
The original control checkout was not used for these implementation edits.
No additional implementation item remained in the approved local scope.

## Integration authorization

On 2026-10-26, after reviewing the proposed commit → PR → GitHub CI → final
review → merge sequence, the owner authorized proceeding. Integration targets
`master` in `dooosp/b2b-lead-agent` from `codex/project-refactor-20261026`.
Commits are grouped as root publication/qualification/CLI, Worker/runtime, and
documentation. A fresh local verification and the exact PR head checks must
pass before merge. This authorization does not permit deployment, remote D1,
live provider calls, customer data or outreach.

The PR/check records provide the subsequent commit SHAs, CI outcome and merge
state. This document does not predict those results.

Runtime references used during setup:
[Node release metadata](https://nodejs.org/dist/index.json) and
[Cloudflare Miniflare documentation](https://developers.cloudflare.com/workers/testing/miniflare/get-started/).
