# HARDENING_PLAN

> Status: current hardening source of truth for `master` as of 2026-07-17.
> Audited against first-parent `master` history through `19ca3d31c771bd59ae89699f930737a43311b93f` (PR #203, atomic publication recovery and consumer hardening) and current GitHub PR/issue state after stale PR #1-#9 closure, post-PR51 follow-ups #69-#84, PRs #87-#99, PRs #101-#107, PR #109, PR #110, PR #112, PR #114, PR #119-#145, Level 1 owner-input and non-production gates through PR #185, refactor/source-of-truth work through PR #190, Reviewer Workflow Intelligence and boundary audit through PR #193, the post-PR193 source-of-truth sync in PR #194, test-only P0 characterization in PR #195, LeadBrief publication hardening in PR #196, D1 snapshot/migration hardening in PR #197, the post-PR197 sync in PR #198, Worker outbound and protected-cache remediation in PRs #199-#200, concurrency/callback hardening in PR #201, and atomic publication/notification hardening in PRs #202-#203. Level 1 production reviewer workflow remains blocked; `productionReady` must remain false until a separate explicit human production proof execution goal.
> Earlier files under `docs/exec-plans/` and `tmp/codex/` are retained as archival execution records, not current `master` truth, unless explicitly refreshed.

## Shipped Merge Order

| Order | Date | PR | Commit | Shipped Artifact | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | 2026-04-07 | #11 | `f4884ef` | `codex/hardening-integration-review` | Wave 1 integration artifact for trust and persistence fixes |
| 2 | 2026-04-07 | #12 | `91e4890` | `hardening/root-identity-trust` | Wave 1 root-only follow-up that closed the remaining root blockers |
| 3 | 2026-04-07 | #16 | `419941c` | `codex/w2-integration-review` | Wave 2 worker contract integration artifact |
| 4 | 2026-04-07 | #18 | `1e2d4e6` | `codex/w3-queue-semantics-review` | Wave 3 safe shipping artifact on top of updated `master` |
| 5 | 2026-05-05 | #25 | `95c9d54` | `p0/trust-boundary-and-fallback-publish-guard` | P0 trust-boundary and fallback-publication guard baseline |
| 6 | 2026-05-05 | #27 | `5776d4a` | `feat/leadbrief-v1-review-contract` | LeadBrief v1 contract and minimum human-review baseline |
| 7 | 2026-05-11 | #36-#43 | `22672f8` | May 11 hardening/doc train | Worker routes, LeadBrief data path, test helpers, schema guard, review UX, evidence tooling, architecture docs, and naming cleanup |
| 8 | 2026-05-11 | #51 | `a3f44df` | `codex/post-train-integration-v1` | Integration of PRs #44-#49: Workbench, local E2E, auth/error hardening, lead-quality evaluation, old PR #23 replacement, and roadmap synthesis |
| 9 | 2026-05-12 | #52-#84 | `2d0bf68` | Post-PR51 review-quality, CI, and docs follow-ups | Workbench review helpers, review queue filters, advisory roleplay context, deterministic CI installs, lead-quality and local E2E CI gates, Workbench/list review gates and filtering, source-of-truth docs, list gate counts, Kanban gate labels/chips, and filter empty-state recovery |
| 10 | 2026-05-12 | #87-#89 | `6433116` | Lead Action Intelligence, Reviewer Action Queue, and Lead Review Session | Deterministic action guidance, queue metadata/lanes/filters/sorting, current-filter session progress, next-lead focus, quick `APPROVED` / `NEEDS_REVIEW` actions, bounded failure UI, queue refresh after mutation, and local fake-D1 E2E coverage |
| 11 | 2026-05-13 | #90-#92 | `0d67eeb` | Reviewer Notes Template and Productivity Parity | Deterministic reviewer note templates, `/leads` copy/manual-copy controls, non-mutating shortcuts, browser-memory session activity, and lead-detail Opportunity Workbench productivity parity without persistence, schema, production, external calls, analytics, or keyboard-triggered review mutation |
| 12 | 2026-05-14 | #93 | `63d80fd` | Reviewer Workflow QA & Accessibility Hardening | Accessible tab semantics, clearer copy/status labels, bounded live-region feedback, interactive-control shortcut guards, focus-visible/mobile wrapping improvements, zero-result reset preservation, reviewStatus/status separation coverage, and local E2E mobile overflow smoke |
| 13 | 2026-05-14 | #94 | `2028898` | Reviewer Workflow Roving Keyboard & Accessibility Snapshot Gate | Roving list/Kanban tab focus, tabpanel semantics, and local semantic snapshots for reviewer regions without production, schema, persistence, external-call, analytics, or keyboard-triggered review mutation scope |
| 14 | 2026-05-14 | #95 | `0d98845` | Reviewer Workflow Final Audit & Demo Packet | Canonical local/test-safe reviewer workflow audit packet, demo flow, validation commands, allowed/forbidden claims, note-persistence wording, and production evidence boundary |
| 15 | 2026-05-14 | #96 | `115a440` | Roadmap/current-train source-of-truth sync | Synced roadmap/current-train and production-proof boundary docs after the final audit packet without production action |
| 16 | 2026-05-15 | #97-#99 | `0360f7c` | Source-of-truth sync, demo rehearsal clarification, and Human UX Review Packet | Synced post-PR96 docs, clarified final audit/demo rehearsal on newer heads, and added the local/test-safe Human UX Review Checklist and Feedback Intake Packet |
| 17 | 2026-05-15 | #101-#102 | `747b77a` | Issue #100 reviewer workflow UX closeout | Addressed all four recorded local/test-safe UX findings: `/leads` heading, human review labels, compact top `다음 리뷰` strip, and short reviewer-note summaries while preserving full deterministic copy payloads |
| 18 | 2026-05-15 to 2026-05-17 | #103-#107 | `db2a69a` | Source-of-truth, production-proof planning, Issue #34 closeout, and standing approval policy | Synced docs after Issue #100 closeout, added non-production production-proof readiness/planning/precheck records, closed Issue #34 through GitHub-only closeout, and added `docs/standing-approval-policy.md` for routine repo/GitHub/docs/local-only work without authorizing production action |
| 19 | 2026-05-17 | #109 | `e4c6c40` | Manager / Reviewer Summary v0 | Added the `/leads` `리뷰 요약` panel from existing filtered leads, Reviewer Action Queue / Lead Review Session metadata, and LeadBrief fields only; no schema, persistence, production access/query, CRM ownership, outreach, analytics, LLM, or endpoint expansion |
| 20 | 2026-05-17 | #110 | `dfde1b0` | Post-PR109 source-of-truth sync | Synced source-of-truth docs after Manager / Reviewer Summary v0 without production action |
| 21 | 2026-05-17 | #112 | `f1ac45c` | Saved Review Notes Decision Packet | Added a docs-only product/data decision packet before any saved-notes implementation, schema/API/runtime change, D1 persistence, production action, CRM/outreach, analytics, LLM, or outcome-learning scope |
| 22 | 2026-05-17 | #114 | `c928f91` | Copy-only reviewer note suggestion clarification | Implemented the Issue #113 Option E wording boundary for generated reviewer note suggestions as helper text that is copy-only, not saved, not sent, and not human-authored saved notes; no saved-notes persistence, schema, API, D1, production, CRM, outreach, analytics, or LLM behavior was added |
| 23 | 2026-05-18 | #119-#120 | `bbc01b4` | Manual Review Notes Option A | Added the plan-only Option A packet, then implemented local/test-safe human-entered manual review notes as `manualReviewNotes` backed by existing `leads.notes`, with generated reviewer note suggestions kept copy-only and rejected from persistence payloads |
| 24 | 2026-05-18 | #121 | `f9d96d0` | Manual Review Notes v0 edit/clear UX | Added local/test-safe edit-by-resave and confirmed clear-by-empty-value controls for human-entered manual notes on `/leads` and lead detail, preserving generated reviewer note suggestions as copy-only helper text |
| 25 | 2026-05-18 | #122 | `876d11d` | Manual Review Notes v0 state/timestamp clarity | Added saved/empty manual note state copy and labeled `updatedAt` / `updated_at` only as lead-level update state, not manual-note-specific saved time |
| 26 | 2026-05-19 | #123 | `dc4f03b` | Manual Review Notes v1 data semantics packet | Added the docs-only decision packet for note-specific timestamp, reviewer identity, note history/versioning, retention/privacy, and production-readiness gates without approving implementation or production action |
| 27 | 2026-05-19 | #124 | `9404001` | Manual Review Notes v1 T1 timestamp | Implemented local/test-safe `manualReviewNotesUpdatedAt` / `manual_review_notes_updated_at` for the last accepted human-entered manual note change/save/clear event only, without reviewer identity, note history, retention/privacy enforcement, generated suggestion persistence, or production proof |
| 28 | 2026-05-19 | #125 | `aa4f989` | Manual Review Notes v1 reviewer identity packet | Added the docs-only reviewer identity / author attribution decision packet without approving real reviewer identity, authenticated identity, display-name fields, author audit trails, note history, retention/privacy enforcement, generated suggestion attribution, or production action |
| 29 | 2026-05-19 | #126 | `b4b6fb3` | Manual Review Notes v1 generic reviewer label | Implemented local/test-only `manualReviewNotesAuthorLabel` / `manual_review_notes_author_label` with only the fixed non-PII `manual_reviewer` value for accepted manual note create/edit/clear events, without real reviewer identity, note history, generated suggestion attribution, retention/privacy enforcement, or production proof |
| 30 | 2026-05-19 | #127 | `4f236c0` | Manual Review Notes v1 note history/versioning packet | Added the docs-only note history/versioning decision packet and kept old note value retention, generated suggestion history, full/audit-grade history, retention/privacy enforcement, and production action unapproved |
| 31 | 2026-05-19 | #128 | `4d74341` | Manual Review Notes v1 H2 metadata-only history | Implemented local/test-only `manual_review_note_events` metadata for accepted manual note create/edit/clear events with lead id, event type, timestamp, and fixed generic author label only, without old/new note text, generated suggestion history, retention/privacy enforcement, or production proof |
| 32 | 2026-05-19 | #129 | `7a8a117` | Manual Review Notes v1 retention/privacy policy packet | Added the docs-only retention/privacy policy decision packet and kept enforcement, purge/delete jobs, redaction, automated PII detection, export/manager visibility expansion, generated suggestion retention/history, and production action unapproved |
| 33 | 2026-05-19 | #130 | `f2ddf35` | Manual Review Notes v1 static privacy warning | Implemented static local/test reviewer-facing warning copy only, without detection, blocking, redaction, retention enforcement, purge/delete jobs, export/manager visibility, real identity, production proof, or production compliance evidence |
| 34 | 2026-05-20 | #131 | `6619419` | Manual Review Notes v1 production readiness gap packet | Added the docs-only production readiness gap packet and kept production proof/deploy, production D1 migration/access/write, production endpoints, logs/secrets, retention/privacy enforcement, automated PII detection/redaction, export/manager visibility expansion, real/authenticated reviewer identity, and runtime/UI/schema/API changes unapproved |
| 35 | 2026-05-20 | #132 | `8c5c100` | Manual Review Notes v1 access/visibility/export decision packet | Added the docs-only access/visibility/export decision packet and kept access-control implementation, manager visibility expansion, export expansion, API exposure expansion, full metadata-history visibility, production action, retention/privacy enforcement, automated PII detection/redaction, and real/authenticated reviewer identity unapproved |
| 36 | 2026-05-20 | #133 | `d348b01` | Manual Review Notes v1 access-control plan | Added the docs-only access-control plan and kept access-control implementation, auth/session implementation, role implementation, manager visibility, export/API expansion, production action, retention/privacy enforcement, automated PII detection/redaction, real/authenticated reviewer identity, and generated suggestion persistence/export/history/attribution unapproved |
| 37 | 2026-05-20 | #134 | `9191373` | Post-PR133 source-of-truth sync | Synced source-of-truth docs after the access-control plan without production action |
| 38 | 2026-05-20 | #135 | `0c1bf0c` | Manual Review Notes v1 C2 local/test role stub | Implemented only the opt-in local/test role stub for manual note access tests; `reviewer` can use manual notes locally, while `manager`, `api`, missing, or unknown roles omit protected manual note fields and cannot write manual notes under the stub |
| 39 | 2026-05-20 | #136 | `08f21df` | Post-PR135 source-of-truth sync | Synced source-of-truth docs after the C2 local/test role stub without production action |
| 40 | 2026-05-20 | #137 | `f1bfd57` | Manual Review Notes v1 production proof plan | Added the docs-only production proof plan for future proof prerequisites, production D1 migration-readiness, rollback/backout gates, access/privacy/retention gates, generated-suggestion exclusion, observability boundaries, evidence rules, and approval blocks without authorizing production execution |
| 41 | 2026-05-20 | #138 | `d0fb449` | Manual Review Notes v1 production D1 migration plan | Added the docs-only production D1 migration plan for schema inventory, migration ordering, nullable/backfill behavior, metadata-only history migration requirements, compatibility checks, local/staging rehearsal, rollback/backout planning, generated-suggestion exclusion, access/privacy/retention gates, evidence boundaries, and approval blocks without authorizing migration execution |
| 42 | 2026-05-20 | #139 | `e9dc9f4` | Manual Review Notes v1 production rollback/backout plan | Added the docs-only production rollback/backout plan for rollback scenarios, partial migration handling, nullable field behavior, metadata-only history backout, no-destructive-data rules, local/staging rehearsal, generated-suggestion rollback exclusions, access/privacy/retention gates, evidence boundaries, and approval blocks without authorizing rollback execution |
| 43 | 2026-05-20 | #140 | `8103375` | Manual Review Notes v1 local/staging dry-run plan | Added the docs-only local/staging dry-run plan for dry-run scenarios, preflight, local fake-D1 rehearsal, staging-like target requirements, generated-suggestion exclusion, evidence boundaries, and approval blocks without executing staging, local/fake-D1 dry run, production, migration, rollback, deploy, or schema/API/runtime changes |
| 44 | 2026-05-21 | #141 | `0ae7dcf` | Manual Review Notes v1 local fake-D1 dry-run evidence | Recorded approved local/fake-D1 evidence only for schema/manual-note/worker/full/local E2E/eval validation, generated-suggestion exclusion, warning-only privacy behavior, and C2 local/test role-stub boundaries without staging or production evidence claims |
| 45 | 2026-05-21 | #142 | `d18260a` | Manual Review Notes v1 staging target decision packet | Added the docs-only staging target packet that makes target selection decision-ready while keeping staging execution, staging D1 access, staging endpoints, staging logs/secrets, production proof/deploy, production D1, customer data, runtime/UI/schema/API changes, executable migration/rollback files, and generated suggestion persistence/history/export/attribution blocked |
| 46 | 2026-05-21 | #143 | `a9a6c17` | Manual Review Notes v1 non-production cycle closeout | Closed the local/test cycle as docs-only closeout with local implementation complete, local/fake-D1 evidence complete, staging target decision-ready/HOLD, staging execution HOLD, production proof/deploy HOLD, and no mandatory next action |
| 47 | 2026-05-21 | #145 | `c0505cf` | Manual Review Notes v1 reviewer feedback intake | Added docs-only feedback intake structure and Issue #144 as the optional feedback container; first actual feedback is now dispositioned separately as P3/docs/no-follow-up. It did not approve staging, production, implementation, manager/export/API expansion, access control, retention/privacy enforcement, or generated suggestion persistence |
| 48 | 2026-05-31 | #171-#177 | `c613171` | Level 1 non-production proof, auth/route, approval, CI, fail-closed, and change-control gate train | Added local/test auth-provider/session scaffold, local proof-preflight automation, route/privacy audit, non-production approval dry-run, `npm run check:level1` CI gate, fail-closed fault injection, and change-control manifest gate while preserving production proof HOLD |
| 49 | 2026-06-02 | #178-#179 | `bf78c2b` | Operator rehearsal and axios audit triage | Added the local-only Level 1 operator rehearsal gate, then patched axios to `1.16.0` with scoped audit triage while preserving production proof HOLD |
| 50 | 2026-06-02 | #180 | `6950e2c` | Outbound HTTP enrichment boundary guards | Centralized root enrichment axios usage behind an injectable local/test transport boundary, request policy, redaction/failure coverage, local-only CI gate, and non-production evidence packet without production/staging calls |
| 51 | 2026-06-03 | #181 | `ae14cd9` | Enrichment fixture replay output contract | Added deterministic fixture-only replay for URL resolution, scraping, normalized outputs/failures, redaction, and stable non-production artifacts without live scraping or production/staging calls |
| 52 | 2026-06-03 | #182 | `7bc11e3` | Lead pipeline fixture replay artifact contract | Added a deterministic local-only contract from enrichment replay outputs into synthetic lead-quality, report, publication, and release-evidence artifact summaries without live network, LLM, CRM, D1, customer data, or production/staging calls |
| 53 | 2026-06-03 | #183 | `808dde2` | Level 1 readiness closure dashboard | Added a single local-only JSON/Markdown dashboard for PR #171-#183 gate inventory, commands, artifacts, issue map, risks, and future production-proof prerequisites while keeping Issue #165 on HOLD |
| 54 | 2026-06-03 | #184 | `bf5a627` | Level 1 production proof approval intake gate | Added a non-executable Issue #165 approval request template, validator, redacted JSON/Markdown artifacts, reviewer checklist, and dashboard/source-of-truth sync for exact future approval fields while keeping production proof blocked |
| 55 | 2026-06-04 | #185 | `134034d` | Level 1 post-approval decision simulator | Added a local-only simulator over checked-in synthetic Issue #165 packets that returns `HOLD`, `BLOCKED`, or `READY_FOR_SEPARATE_HUMAN_EXECUTION` while keeping `productionReady:false`, `productionReviewerWorkflowReady:false`, `proofExecutionApproved:false`, and Issue #165 execution blocked |
| 56 | 2026-06-29 | #186 | `4d419f3` | Reviewer-note renderer / CLI helper refactor and audit dependency patch | Extracted shared Opportunity Workbench reviewer-note rendering, extracted shared replay/boundary CLI helpers, and patched `nodemailer`, `form-data`, `undici`, and `hasown` with clean npm audit evidence; no production/staging action or runtime boundary expansion |
| 57 | 2026-06-30 | #187 | `c7da118` | Post-PR186 source-of-truth sync | Synced source-of-truth docs after PR #186 without production/staging action or runtime boundary expansion |
| 58 | 2026-06-30 | #188 | `5595359` | Root-cycle bootstrap archival records | Tracked historical PR #12 root-cycle merge and Wave 2 bootstrap execution/status records as archival docs only, with explicit archive notes pointing back to current source-of-truth docs |
| 59 | 2026-06-30 | #189 | `5a3c7c9` | Post-PR188 source-of-truth sync | Synced source-of-truth and production-boundary docs after PR #188 without production/staging action or runtime boundary expansion |
| 60 | 2026-06-30 | #190 | `c90eede` | Post-PR189 source-of-truth sync | Synced source-of-truth docs after PR #189 without production/staging action or runtime boundary expansion |
| 61 | 2026-07-06 | #191 | `72def61` | Local/test-safe Reviewer Workflow Intelligence v1 | Added human-entered reviewer feedback, fixed local/test `manual_reviewer` attribution, metadata-only feedback history, deterministic reviewer workflow summaries/data-gap prioritization, schema/fake-D1 contracts, UI controls, and route privacy coverage without production/staging action |
| 62 | 2026-07-06 | #192 | `a1ad439` | Post-PR191 source-of-truth sync | Synced source-of-truth docs after Reviewer Workflow Intelligence v1 without production/staging action or runtime boundary expansion |
| 63 | 2026-07-06 | #193 | `1c47843` | Reviewer Workflow Boundary Audit v1 | Added the local/test-safe `npm run check:reviewer-workflow-boundary` gate, deterministic non-production audit artifact, and reviewer feedback release-evidence redaction coverage without production/staging action |
| 64 | 2026-07-06 | #194 | `8065581` | Post-PR193 source-of-truth sync | Synced source-of-truth and production-boundary docs after Reviewer Workflow Boundary Audit v1 without production/staging action |
| 65 | 2026-07-11 | #195 | `5a4f0ee` | P0 trust and security boundary characterization | Added deterministic local-only characterization tests for publishing, legacy D1 migration, current/history ordering, outbound network, protected PWA cache, and concurrent mutation behavior without changing runtime behavior or claiming remediation |
| 66 | 2026-07-11 | #196 | `09aa3d7` | LeadBrief publishing contract hardening | Projected untrusted LeadCandidate data through the public LeadBrief allowlist, bound verification to canonical fresh evidence, rejected invalid scores and source schemes, made identity/status/timestamps system-owned, and failed closed on malformed lead history without production action |
| 67 | 2026-07-14 | #197 | `1b53aab` | D1 snapshot and migration contracts | Replaced request-path DDL with an exact versioned manifest and read-only D1 readiness checks, added a marked local/test-only migration simulator, atomically replaced typed snapshot heads/entries while joining reviewer-owned fields through bounded overlays, and added structure/memory-bounded remote artifact reads while keeping staging/production HOLD |
| 68 | 2026-07-14 | #198 | `4ec9e58` | Post-PR197 source-of-truth sync | Synced source-of-truth and production-boundary docs after PR #197 without production/staging action |
| 69 | 2026-07-14 | #199 | `4a9054b` | Worker outbound HTTP/SSRF hardening | Centralized Worker enrichment fetches behind a bounded redirect-aware outbound policy with public A/AAAA validation, content-type and body limits, and one request deadline, closing all eight scoped characterization TODOs |
| 70 | 2026-07-15 | #200 | `5d92082` | Protected reviewer PWA cache hardening | Made protected reviewer HTML private/no-store and network-only, limited Service Worker caching to the public manifest, removed legacy caches, and closed all five scoped cache TODOs |
| 71 | 2026-07-15 | #201 | `88fa3ba` | Lead PATCH CAS and monotonic callbacks | Added `version` / `expectedVersion` compare-and-swap writes, atomic side effects, callback payload idempotency, provider-attempt ordering, and terminal absorption, closing the five remaining concurrency TODOs |
| 72 | 2026-07-15 | #202 | `a180e75` | Atomic publication and notification-safe baseline | Added typed pipeline state/outcomes, immutable manifest-selected publication, exact Git staging and verified push, post-publication notification, retry semantics, workflow serialization, and failure-injection coverage |
| 73 | 2026-07-17 | #203 | `19ca3d3` | Atomic publication recovery and consumer hardening | Hardened transaction recovery, manifest-primary Worker consumers, commit/path/byte ownership, repository-wide notification identity locking, producer/consumer budgets, callback credential scope, and exact validated-commit push behavior |

Post-PR177 update: PR #171 merged at
`a4f8a080ebe426d79bb85dba8298372ef6d14cfc` with non-production
auth-provider/session scaffold guards, local/fake-D1 proof simulation, D1 /
rollback / privacy guards, and Level 1 scorecard/evidence docs. PR #172 merged
at `6f5f764e2a4404157d4eb6120b44db6d173d41aa` with local-only
proof-preflight automation, stricter synthetic claim cases including missing
audience, detail-page protected-field filtering, D1 index and metadata fixture
checks, recursive evidence redaction, bare non-local hostname refusal, and
local stop-write rollback guards. PR #173 merged at
`cc7944c7d851a57642e933435d482932eaabf921` with
`LEVEL1_AUTH_ADAPTER_ROUTE_AUDIT_NON_PRODUCTION`: provider-agnostic injected
local/test auth adapter contracts, route-audit coverage, deny-by-default
route/privacy gates, and redacted reviewer docs. PR #174 merged at
`766447f95635b9a57c66d97c1b49ef670f57a687` with the final non-production
approval packet, future evidence schema, and local approval dry-run operator.
PR #175 merged at `43a6a382139858b2c373f26d2e00ba62400303cf` with the
durable local-only Level 1 package/CI regression gate. PR #176 merged at
`27bf1a57af3826427eecf2810e2d6642e05dcc0b` with local-only fail-closed fault
injection coverage. PR #177 merged at
`c61317144f5adb77516412af30e26925f1a97146` with the local-only
change-control manifest gate.
The Level 1 regression gate is now `npm run check:level1`: it runs the local
auth adapter/scaffold, route/UI privacy, generated-suggestion/manual-note,
proof-preflight, approval dry-run, change-control manifest dry-run,
operator rehearsal, release-evidence redaction, and redacted local artifact
checks without secrets, deploy, Wrangler, D1 bindings,
endpoints, or production inputs. The current fail-closed matrix also covers
malformed synthetic claim arrays, mixed roles, auth-header / Cloudflare Access /
D1 / API-key alias env poison, denied-role route/API leak checks, poisoned
future evidence artifacts, bare `notes` / validation-note evidence body
redaction, value-aware raw-input redaction, missing local D1 metadata/index
drift, stop-write disabled rollback requests, and mutating or destructive
rollback/SQL requests. These artifacts are **not production evidence** and do
not authorize production proof,
deploy, D1 access, endpoint calls, logs/secrets, customer/private data, real
auth/session/provider parsing, Cloudflare Access calls, CRM/outreach, LLM,
automation, rollback execution, destructive data action, or generated
suggestion persistence/export/history/attribution.

Post-PR203 source-of-truth update: PR #187 merged the post-PR186
source-of-truth sync at `c7da118376df889edf5c47ba508fc4f817535ed0`.
PR #188 then merged archival PR #12 root-cycle merge and Wave 2 bootstrap
execution/status records at `55953593088e292f9561e6c3570eae2e29a90ca3`.
PR #189 then synced source-of-truth and production-boundary docs at
`5a3c7c9cfe3068b38d8196d60aaf378adc64da14`. PR #190 synced source-of-truth
docs after PR #189 at `c90eeded7c6d6718482993d5d233ed343aee0771`. PR #191
merged local/test-safe Reviewer Workflow Intelligence v1 at
`72def61e89b3c2137b13e2a3ce0bbbc58407d8ce`. PR #192 synced source-of-truth
docs after PR #191 at `a1ad439348730f834ae7ce5448750b8a5535f502`. PR #193
merged local/test-safe Reviewer Workflow Boundary Audit v1 at
`1c4784338853615225d26e6c263e33389cb507fd`. PR #194 synced the resulting
source-of-truth docs at `8065581cb3756b90783b64115d4b09945d2f9c23`. PR #195
added test-only P0 trust/security characterization at
`5a4f0eec95f8d4e87ee663987d264caea96666b4`. PR #196 hardened the public
LeadBrief publication contract at `09aa3d7b991d4eb20bce822ce69e74044d66dfab`.
PR #197 hardened D1 snapshot, migration, and published-artifact read contracts
at `1b53aabf917e790d6c05db311c0810b4b3807d95`. PR #198 synced that source of
truth at `4ec9e58d8da760653ffb50148c4f59cfbc58e5fa`. PRs #199-#201 closed the
remaining outbound-network, protected-cache, and concurrency/callback
characterization lanes at `4a9054badf329023950747394e96f7aa7634d23b`,
`5d9208234bd07d57044a433a558aa0e12bf62f8b`, and
`88fa3ba7bbcd12b95e97ef45c7bb9ccb73e50eb1`. PR #202 established typed atomic
publication and notification-safe workflow behavior at
`a180e751ecd7ee98cedcbd146beaf99d90c88904`; PR #203 hardened recovery,
manifest-aware consumers, notification identity, and the exact Git commit push
boundary at `19ca3d31c771bd59ae89699f930737a43311b93f`. The PR #188 records remain
historical execution artifacts only; they do not replace this file,
`docs/roadmap/current-pr-train.md`, or production-proof boundary docs as current
source of truth. Production actions performed: none.
PR #196 LeadBrief publication update: untrusted model output is projected
through the public LeadBrief allowlist; score and HTTP(S) source constraints are
validated; verification is derived only from canonical, fresh, bound evidence;
identity, status, and timestamps remain system-owned; malformed or non-array
history fails closed before canonical artifacts change. This closes the scoped
publishing-contract gap but does not claim cross-artifact atomic publication.
PR #197 D1 snapshot/migration update: all Worker request paths remain DDL-free;
D1-backed access paths perform exact, read-only cold-binding schema readiness
checks and cache only success. The checked-in versioned
migration manifest may be applied only by the explicitly marked local/test
simulator, which requires the explicit marker and refuses unmarked/ordinary
bindings; policy forbids using it with remote D1. Each profile/kind snapshot
head and its entries are atomically replaced; reviewer-owned mutable fields stay
outside `payload_json` and are joined through a bounded allowlisted overlay.
Latest refresh also updates the managed `leads` projection in the same atomic
batch while preserving reviewer fields; history refresh does not upsert working
lead rows. The shared published-artifact JSON reader enforces strict UTF-8,
byte, cardinality, depth, structure, and bounded-storage limits but has no
application-level read deadline. A real remote D1
migration still requires separately approved target inventory, versioned
Wrangler migration files/commands, rollback ownership, stop conditions, and
redacted evidence. The local simulator is `NOT_PRODUCTION_EVIDENCE` and must
not be reused as a request-path or remote migration mechanism.
Local/Test Reviewer Workflow Intelligence v1 shipped update:
`docs/roadmap/reviewer-workflow-intelligence-v1-local-test.md` records the
local/test-only reviewer feedback, summary, and data-gap prioritization scope.
It adds explicit human-entered `reviewerFeedback`, fixed non-PII
`manual_reviewer` attribution, metadata-only `reviewer_feedback_events`,
additive `reviewerWorkflowSummary`, and deterministic
`dataGapPrioritization` on existing `/api/leads` and `/api/leads/:id`
surfaces. This is `NOT_PRODUCTION_EVIDENCE`, keeps `productionReady:false`,
uses the same C2 local/test role-stub boundary as manual notes, and does not
approve staging/production endpoint calls, D1 access/observation/migration/
write/delete, logs/secrets access, real auth/session/provider parsing, real
reviewer identity, CRM/outreach/LLM/automation, retention/privacy enforcement,
generated suggestion persistence/export/history/attribution, or closure of
Issues #165/#162/#163/#164/#154.
Reviewer Workflow Boundary Audit v1 local/test update:
`docs/roadmap/reviewer-workflow-boundary-audit-non-production.md` records the
non-production boundary audit gate merged by PR #193 for Reviewer Workflow
Intelligence v1.
`npm run check:reviewer-workflow-boundary` writes
`tmp/codex/reviewer-workflow-boundary-audit-non-production.json`, extends
release evidence redaction for `reviewerFeedback` freeform text and
`nextReviewerAction`, and checks CSV, publication, denied-role summary, and
prioritization boundaries. It remains `NOT_PRODUCTION_EVIDENCE`, keeps
`productionReady:false`, and does not approve staging/production execution,
production D1, real auth/session, retention/privacy enforcement, or generated
suggestion persistence/export/history/attribution.
The Level 1 change-control manifest packet adds only a checked-in
non-production manifest, schema, local linter/planner, redacted dry-run
artifact, and `npm run proof:level1:change-control-manifest` gate. It labels
the plan `NOT_PRODUCTION_EVIDENCE`, keeps `productionReady:false`, refuses
unexpected manifest fields, production/staging URL-shaped values, private D1
identifiers, secrets/raw auth material, broad endpoint scopes, destructive SQL,
missing rollback ownership, stale or missing approval records, evidence writes, and
`productionReady:true`, and leaves the production proof approval gate on
`HOLD`.
The Level 1 operator rehearsal gate adds only a local-only
`npm run proof:level1:operator-rehearsal` command, redacted non-executable
runbook artifact, and tests. It consumes the approval packet and change-control
manifest, maps proof preflight / approval / manifest / rollback / privacy /
evidence gates into one rehearsal sequence, refuses accidental proof-start
inputs, keeps `proofStartBlocked:true`, keeps `productionReady:false`, and
does not execute production proof or touch production/staging.
Issue #165 remains the exact human approval blocker for any future production
proof execution.

Post-PR181 enrichment replay update: PR #178 merged at
`b4d407171fefa5e6a6c2bb86b3e52aaa63bde9da` with the local-only Level 1
operator rehearsal gate. PR #179 merged at
`bf78c2bc5f6779723eea44300978e40ca8d41574` with the scoped axios `1.16.0`
audit triage and clean npm audit baseline. PR #180 merged at
`6950e2c91bee564c1d2c17917cfe06d5d45241f8` with
`OUTBOUND_HTTP_ENRICHMENT_BOUNDARY_GUARDS_NON_PRODUCTION`, which keeps that
dependency reachable only through `enricher/outbound-http-boundary.js`, adds
injectable local/test transport contracts for `fetchArticleContent` and
`resolveOriginalUrl`, refuses unsafe schemes/hosts/headers/redirect targets,
normalizes timeout/network/HTTP/redirect/oversized/malformed fixture failures,
redacts boundary artifacts, and adds `npm run check:enrichment-boundary` to CI.
PR #181 merged at `ae14cd907b65c008e09098689e2c22fce784863d` with
`ENRICHMENT_FIXTURE_REPLAY_OUTPUT_CONTRACT_NON_PRODUCTION`, `npm run
check:enrichment-replay`, deterministic fixture-only URL resolution, scraping,
normalized output/failure, redaction, and stable artifacts. PR #182 merged at
`7bc11e398415acdf480641f597eee6e3f4def228` with
`LEAD_PIPELINE_FIXTURE_REPLAY_ARTIFACT_CONTRACT_NON_PRODUCTION`, building on
PR #181 through `npm run check:lead-pipeline-replay` and deterministic synthetic
lead-quality, report, publication, and release-evidence artifact summaries.
PR #183 merged at `808dde2b19a450207499672d05a9ed5d4215ad66` with
`LEVEL1_READINESS_CLOSURE_DASHBOARD_NON_PRODUCTION`,
`npm run proof:level1:closure-dashboard`,
`docs/roadmap/b2b-lead-agent-level-1-readiness-closure-dashboard-non-production.md`,
and `tmp/codex/level1-readiness-closure-dashboard-non-production.json` as the
single reviewer-readable and machine-checkable closure dashboard for the PR
#171-#184 local gate train. PR #184's
`LEVEL1_PRODUCTION_PROOF_APPROVAL_INTAKE_GATE_NON_PRODUCTION` adds
`npm run proof:level1:approval-intake`,
`docs/roadmap/b2b-lead-agent-level-1-production-proof-approval-intake-gate-non-production.md`,
`docs/roadmap/b2b-lead-agent-level-1-production-proof-approval-intake-template-non-production.json`,
and `tmp/codex/level1-production-proof-approval-intake-gate-non-production.json`.
It makes Issue #165's remaining approval input machine-checkable for target,
command allowlist, endpoint boundary, D1 boundary, fixture/non-customer data
policy, evidence redaction, rollback owner, stop conditions, approver, and
expiry. These are not production evidence and do not call production/staging
endpoints, perform live scraping, access D1, read logs/secrets, use
customer/private data, execute proof, approve production action, or change
Worker runtime behavior.
PR #185 merged at `134034dcb1744e5bdc2582a1c116575c668b4c0b` with
`LEVEL1_POST_APPROVAL_DECISION_SIMULATOR_NON_PRODUCTION`,
`npm run proof:level1:post-approval-simulator`,
`docs/roadmap/b2b-lead-agent-level-1-post-approval-decision-simulator-synthetic-packets-non-production.json`,
`docs/roadmap/b2b-lead-agent-level-1-post-approval-decision-simulator-non-production.md`,
and `tmp/codex/level1-post-approval-decision-simulator-non-production.json`.
It consumes checked-in synthetic Issue #165 packets only and classifies them
as `HOLD`, `BLOCKED`, or `READY_FOR_SEPARATE_HUMAN_EXECUTION`. That final
status is still not proof execution approval, production evidence, or a
production-readiness claim; the remaining action is a separate explicit human
production proof execution goal.
PR #186 merged at `4d419f3bf771bb0e6ac656eeb2560445edcee4dd` with a
repo-local refactor and audit dependency patch. It extracted shared
Opportunity Workbench reviewer-note rendering into
`worker/pages/reviewer-note-renderer.js`, extracted shared local CLI utilities
for replay/boundary artifact scripts into `scripts/lib/cli-utils.mjs`, and
patched `nodemailer@9.0.1`, `form-data@4.0.6`, `undici@7.28.0`, and
`hasown@2.0.4`. PR #186 does not approve production proof, deploy, production
D1 access/write/migration, endpoint calls, logs/secrets access, customer-data
access/mutation, staging execution, CRM/outreach, LLM, automation, or
production-readiness claims.

## Wave Summary

### Wave 1

- Wave 1 shipped in two merge commits, not one.
- PR #11 shipped:
  - source traceability hardening
  - company-name accuracy hardening
  - no-body enrichment hardening
  - lead PATCH atomicity
- PR #12 then closed the remaining root blockers:
  - stable root lead identity
  - low-trust article body leakage into qualifier prompting

### Wave 2

- Wave 2 shipped via PR #16 in the required order:
  1. `hardening/w2-data-contract`
  2. `hardening/w2-self-service-bridge`
  3. `hardening/w2-api-canonicalization`
- Current `master` therefore includes:
  - deterministic worker lead identity and canonical source serialization
  - preserved self-service source lineage through `originUrl`, `query`, and `resolution`
  - managed-profile product canonicalization at the worker API boundary

### Wave 3

- Wave 3 shipped via PR #18, not via the raw branch PR #17.
- Current `master` therefore keeps queue acceptance intake-only:
  - accepted trigger responses return HTTP `202`
  - accepted responses use `status: "accepted"`
  - runtime completion is emitted only after real execution and `summary()`-style completion evidence

### PR #25 P0 Trust Baseline

- PR #25 shipped the P0 trust-boundary and fallback-publication guard baseline.
- Current `master` therefore includes:
  - `/api/internal/*` authenticates with `INTERNAL_API_TOKEN` when configured, with `API_TOKEN` compatibility fallback when unset
  - `TRIGGER_PASSWORD` does not grant access to internal APIs
  - latest-published readiness lookup failures return HTTP `503` with `error.code = "readiness_unavailable"`
  - managed/root qualification fails closed when the LLM is missing or fails, unless explicit demo mode is enabled
  - demo leads are refused as canonical published latest leads
  - heuristic/self-service fallback leads are machine-readable and browser-visible as non-verified / needs review
  - self-service UI copy and JSON downloads preserve trust metadata
  - at PR #25 landing, D1 trust metadata columns were compatible with the
    then-current lazy `ensureD1Schema()` migration path
- That historical lazy-migration statement is superseded by the current
  explicit migration-before-runtime contract: request-path
  `ensureD1Schema()` is read-only and fails closed until the exact versioned
  schema is already present.
- Production deploy, schema inventory, migration, and production writes were
  not performed as part of PR #25 landing or this local/test hardening work.

### PR #27 LeadBrief v1 Baseline

- PR #27 shipped LeadBrief v1 as the central human-review unit.
- Required LeadBrief v1 fields are:
  - `company`
  - `signal`
  - `sources`
  - `whyNow`
  - `recommendedMessage`
  - `confidence`
  - `assumptions`
  - `dataGaps`
  - `reviewStatus`
- Compatibility fields remain preserved when present: `id`, `profileId`, `product`, `score`, `grade`, `generationMode`, `verificationStatus`, `evidence`, `createdAt`, and `updatedAt`.
- ReviewStatus frozen states are `NEW`, `NEEDS_REVIEW`, `APPROVED`, `REJECTED`, and `DEFERRED`.
- LLM leads default to `NEEDS_REVIEW`, even when `verificationStatus` is `verified`.
- Heuristic and fallback leads remain `NEEDS_REVIEW`.
- Demo leads remain blocked from canonical publication.
- Human PATCH actions can update `reviewStatus` with frozen-state validation.
- `status` remains the sales pipeline state and is separate from `reviewStatus`.
- Managed/self-service upserts preserve existing `review_status` on conflict so refreshed generation does not erase human review decisions.
- `/api/leads`, CSV export, browser UI, self-service copy, and downloads preserve review/trust metadata.
- The internal latest-published CRM contract remains backward-compatible and does not expose LeadBrief fields unless later scoped.
- At PR #27 landing, D1 `review_status` used the then-current lazy migration
  compatibility path. That historical behavior is superseded by explicit
  migration-before-runtime readiness; no production D1 migration or
  observation is claimed here.
- Production deploy was not performed as part of PR #27 landing.
- Production DB writes were not performed as part of PR #27 landing.

### May 11 Post-LeadBrief Train

- PRs #36-#43 shipped the route/data/schema/test/docs cleanup baseline:
  - `worker/index.js` delegates to `worker/routes/*`.
  - `npm run check:schema` guards D1 schema drift in CI and locally.
  - shared Worker/root test helpers are the preferred testing surface.
  - local release evidence packet tooling remains local-only and does not prove production observation.
  - canonical module paths and artifact names are guarded by `npm run check:naming`.
- PR #51 then integrated PRs #44-#49:
  - Opportunity Workbench v1 for LeadBrief review.
  - local-only Worker E2E harness with loopback and non-loopback fetch guards.
  - Worker auth and error-boundary hardening, including `INTERNAL_API_TOKEN` preference for internal APIs.
  - synthetic lead-quality evaluation harness.
  - current-master replacement for old dashboard unauthorized UX PR #23.
  - roadmap synthesis for old PR disposition and product boundaries.
- PRs #52-#84 then refreshed repo state and shipped bounded review-quality follow-ups:
  - advisory next-review-action reasons and checklist items.
  - deterministic Workbench review gate from current LeadBrief fields.
  - cached `/leads` review queue filters.
  - Workbench Solution Translation Summary guidance.
  - source-of-truth doc sync after the Solution Translation Summary landed.
  - Workbench Product Context / Signal Fusion guidance.
  - Workbench Stakeholder Prep guidance for economic buyer, technical evaluator, operator, procurement, and sponsor/champion contexts.
  - evidence/data-gap review slices on cached `/leads` rows.
  - advisory selected-LeadBrief stakeholder context for roleplay practice.
  - Validate Naming workflow action maintenance.
  - lockfile-backed `npm ci` installs in non-production check workflows.
  - production-boundary source-of-truth doc refresh after PR #68.
  - synthetic lead-quality evaluator coverage in CI.
  - local-only Worker E2E smoke coverage in CI.
  - deterministic list-level review-gate summaries on `/leads` cards.
  - deterministic list-level review-gate state filtering on `/leads`.
  - deterministic gate-state counts for the current filtered `/leads` queue.
  - Kanban gate labels and state-specific chips derived from the same list-level review gate.
  - visible zero-result filter empty states and in-place reset recovery for list/Kanban review queues.
  - source-of-truth doc sync through PR #82.
- PRs #87-#89 then shipped the Lead Action Intelligence and review-session layer:
  - deterministic next-review action, risk flags, missing-info prompts, stakeholder angle, suggested follow-up draft, review priority, and action confidence.
  - deterministic Reviewer Action Queue metadata, lanes, filters, sorting, compact action summaries, and local fake-D1 E2E coverage.
  - deterministic Lead Review Session current-filter progress, remaining lane counts, next-lead focus, quick review-status actions, bounded failure UI, queue refresh after mutation, and sales-status preservation.
- PRs #90-#94 then shipped the reviewer productivity and accessibility layer:
  - deterministic read-only reviewer note templates surfaced in Lead Action Intelligence, Reviewer Action Queue, Lead Review Session, and Opportunity Workbench.
  - `/leads` copy/manual-copy controls, optional non-mutating shortcuts, shortcut help, and browser-memory session activity.
  - lead-detail Opportunity Workbench parity for copy/manual-copy, non-mutating detail shortcuts, shortcut help, and current-page activity feedback.
  - reviewer workflow QA/accessibility hardening for accessible list view tab semantics, clearer copy/status labels, bounded live-region feedback, interactive-control shortcut guards, focus-visible/mobile wrapping, zero-result reset preservation, reviewStatus/status separation, and local E2E mobile overflow smoke.
  - roving list/Kanban tab keyboard behavior and local semantic snapshots for reviewer regions, copy controls, shortcut help, live status feedback, zero-result reset controls, and lead-detail Opportunity Workbench markers.
- PR #95 then added `docs/reviewer-workflow-final-audit.md` as the canonical local/test-safe reviewer workflow audit/demo packet.
- PR #96 then synced roadmap/current-train and production-proof boundary docs after the final audit packet.
- PR #97 then synced source-of-truth docs after PR #96.
- PR #98 clarified how later local rehearsals should report current branch, HEAD, open-PR state, and validation while preserving the original PR #95 audit baseline.
- PR #99 then added `docs/reviewer-workflow-human-ux-review.md` as the local/test-safe Human UX Review Checklist and Feedback Intake Packet.
- Issue #100 collected four real local/test-safe human UX findings for the reviewer workflow.
- PR #101 addressed UX-100-002 and UX-100-003 by changing the `/leads` heading to `리드 리뷰 큐` and replacing duplicated human review wording with non-duplicated `사람 검토: ...` labels.
- PR #102 addressed UX-100-001 and UX-100-004 by adding the compact top `다음 리뷰` strip above filters and short reviewer-note summaries above the full deterministic copy payload in Lead Review Session and Opportunity Workbench.
- Issue #100 was closed as completed after final closeout confirmed all four recorded findings were addressed and no new open UX finding remained.
- PR #59 recut the useful old PR #6 idea as deterministic role-specific review prep using existing LeadBrief/enrichment fields only. It does not approve outreach, change schema/API/storage, or expand CRM ownership.
- Stale PRs #1-#9 were audited after PR #51, received disposition comments, and were closed without merge or branch deletion. Their useful ideas remain concept inventory to recut from current `master`.
- PR #112 added the Saved Review Notes Decision Packet. Issue #113 selected `OPTION_E` and is closed as completed.
- PR #114 implemented only local/test-safe copy/docs/test clarification for Option E: generated reviewer note suggestions are generated helper text, copy-only, not saved, not sent, and not human-authored saved notes.
- PR #120 implemented local/test-safe Option A manual review notes for human-entered notes only: `manualReviewNotes` reads/writes the existing `leads.notes` value with derived `human_entered` provenance while text exists. Generated reviewer note suggestions remain copy-only and are rejected from persistence payloads.
- PR #121 implemented local/test-safe Manual Review Notes v0 edit/clear UX: editing saves a changed human-entered value, and clearing sends `manualReviewNotes: ""` after confirmation.
- PR #122 implemented reviewer-facing saved/empty state labels and may show only lead-level update copy such as "리드 마지막 업데이트" when `updatedAt` / `updated_at` exists. It must not call that value a manual-note-specific save timestamp.
- PR #123 added the docs-only Manual Review Notes v1 data semantics packet for note-specific timestamp, reviewer identity, note history/versioning, retention/privacy, and production-readiness gates.
- PR #124 implemented local/test-safe T1 note-specific timestamp semantics: `manualReviewNotesUpdatedAt` / `manual_review_notes_updated_at` records the last accepted human-entered manual note change/save/clear event only.
- PR #125 added the docs-only Manual Review Notes v1 reviewer identity / author attribution decision packet.
- PR #126 implemented local/test-only generic author-label semantics: `manualReviewNotesAuthorLabel` / `manual_review_notes_author_label` uses only the fixed non-PII `manual_reviewer` value for accepted human-entered manual note create/edit/clear events.
- PR #127 added the docs-only Manual Review Notes v1 note history/versioning
  decision packet.
- PR #128 implemented local/test-only H2 metadata-only history in
  `manual_review_note_events`. Current history is limited to lead id, event
  type, timestamp, and fixed generic author label only; no old/new note text or
  generated suggestion text is retained.
- `docs/roadmap/manual-review-notes-v1-retention-privacy-policy-decision-packet.md`
  records the docs-only retention/privacy policy decision packet. It keeps
  production HOLD, recommends local/test current-value retention until explicit
  clear/delete, preserves metadata-only local/test events without audit/legal
  claims, and does not approve retention/privacy enforcement, purge/delete jobs,
  redaction, automated PII detection, export/manager visibility expansion, old
  note value retention, generated suggestion retention/history, or production
  proof.
- PR #130 implemented only static local/test Manual Review Notes privacy
  warning copy. The warning does not detect, block, redact, enforce retention,
  purge data, create production compliance evidence, expand exports/manager
  visibility, implement real/authenticated reviewer identity, or approve any
  production action.
- `docs/roadmap/manual-review-notes-v1-production-readiness-gap-packet.md`
  records the docs-only production readiness gap packet after PR #130. It
  separates completed local/test evidence from missing production gates and
  keeps production proof, production deploy, production D1 migration/access/write,
  production endpoints, logs/secrets, retention/privacy enforcement, automated
  PII detection/redaction, export/manager visibility expansion, real reviewer
  identity, generated suggestion persistence/retention/history/attribution, and
  production readiness claims blocked.
- `docs/roadmap/manual-review-notes-v1-access-visibility-export-decision-packet.md`
  records the docs-only access, visibility, API, metadata-history visibility,
  export, generated-suggestion boundary, and access-control prerequisite packet
  after PR #131. It keeps access-control implementation, manager visibility
  expansion, export expansion, API exposure expansion, runtime/UI/schema/API
  behavior, production proof/deploy, production D1 migration/access/write,
  production endpoints, logs/secrets, retention/privacy enforcement, automated
  PII detection/redaction, and real/authenticated reviewer identity blocked.
- `docs/roadmap/manual-review-notes-v1-access-control-plan.md` records the
  docs-only access-control plan merged by PR #133. It maps protected surfaces,
  protected fields, reviewer-only access, manager access, API/export boundaries,
  metadata-history access, generated-suggestion exclusion, auth/role
  prerequisites, future tests, production gates, and blocked actions without
  approving implementation.
- The C2 local/test role-stub approval record is
  `https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4495568414`.
  It authorizes only opt-in local/test checks through
  `MANUAL_REVIEW_NOTES_LOCAL_TEST_ROLE_STUB=enabled` and
  `X-Manual-Review-Notes-Local-Test-Role`; it does not authorize real auth,
  sessions, production roles, manager visibility expansion, export/API
  expansion, retention/privacy enforcement, production proof/deploy, production
  D1 access/write/migration, production endpoints, logs/secrets, or generated
  suggestion persistence/export/history/attribution.
- `docs/roadmap/manual-review-notes-v1-production-proof-plan.md` records the
  docs-only production proof plan. It defines prerequisites, local/staging
  dry-run checks, production D1 migration-readiness checks, rollback/backout
  gates, access-control gates, retention/privacy gates, generated-suggestion
  exclusion proof requirements, observability/logging boundaries, evidence
  anti-overclaim rules, and explicit future approval blocks. It does not
  authorize production proof execution, production deploy, production D1
  migration/access/write, production endpoint calls, production logs/secrets,
  production smoke tests, customer data access/mutation, production
  access-control implementation, real auth/session/identity, manager visibility,
  export expansion, retention/privacy enforcement, automated PII
  detection/redaction, or generated suggestion persistence/export/history/
  attribution.
- `docs/roadmap/manual-review-notes-v1-production-d1-migration-plan.md`
  records the docs-only production D1 migration plan. It documents current
  local/test schema inventory, future migration ordering, nullable/backfill
  behavior, metadata-only history migration requirements, compatibility checks,
  local/staging rehearsal, rollback/backout planning, generated-suggestion
  exclusion, access/privacy/retention gates, evidence boundaries, and explicit
  future approval blocks. It does not authorize migration file creation,
  production D1 schema observation, production D1 migration/access/write,
  Wrangler production commands, production proof execution, production deploy,
  production endpoints, production logs/secrets, production smoke tests,
  customer data access/mutation, production access-control implementation, real
  auth/session/identity, manager visibility, export expansion, retention/privacy
  enforcement, automated PII detection/redaction, or generated suggestion
  persistence/export/history/attribution.
- `docs/roadmap/manual-review-notes-v1-production-rollback-backout-plan.md`
  records the docs-only production rollback/backout plan. It documents rollback
  scenarios, partial migration handling, nullable field semantics,
  metadata-only history backout, no-destructive-data rules, local/staging
  rehearsal, generated-suggestion rollback exclusions, access/privacy/retention
  gates, evidence boundaries, and production execution approval blocks. It does
  not authorize rollback execution, destructive data action, production D1
  schema observation/access/write/delete, Wrangler production commands,
  production proof execution, deploy, production endpoints, logs/secrets,
  production smoke tests, customer data access/mutation, runtime/UI/schema/API
  behavior changes, retention/privacy enforcement, or generated suggestion
  persistence/export/history/attribution.
- `docs/roadmap/manual-review-notes-v1-staging-dry-run-plan.md` records the
  docs-only local/staging dry-run plan. It documents dry-run scenarios,
  preflight checks, local fake-D1 rehearsal, migration-readiness rehearsal,
  rollback/backout rehearsal, C2 role-stub rehearsal, generated-suggestion
  exclusion checks, privacy/retention checks, staging-like target requirements,
  evidence/anti-overclaim rules, and execution approval blocks. It does not
  authorize staging execution, production execution, production D1
  access/schema observation/migration/write/delete, Wrangler production
  commands, production endpoints, production logs/secrets, production smoke
  tests, production proof, deploy, executable migration/rollback files,
  runtime/UI/schema/API changes, or any production action.
- `docs/roadmap/manual-review-notes-v1-staging-target-decision-packet.md`
  records the docs-only staging target decision packet. It defines safe
  non-production staging target requirements, invalid target conditions,
  S0-S5 options, credential/data/D1/fixture/command/evidence boundaries,
  generated-suggestion exclusion checks, privacy/retention/access gates, and
  future approval blocks. It makes target selection decision-ready while
  keeping staging execution, staging D1 access, staging endpoint calls,
  staging logs/secrets access, and all production action blocked.
- Production deploy, production D1 access, production D1 writes/deletes, production Worker endpoint calls, Wrangler commands, and production observation claims were not part of PRs #36-#84, PRs #87-#99, PRs #101-#107, PR #109, PR #110, PR #112, PR #114, PR #119-#142, the local/test H2 metadata-history implementation, the docs-only retention/privacy packet, the docs-only production readiness gap packet, the docs-only access/visibility/export packet, the docs-only access-control plan, the docs-only production proof plan, the docs-only production D1 migration plan, the docs-only production rollback/backout plan, the docs-only local/staging dry-run plan, the local/fake-D1 evidence packet, the staging target decision packet, the non-production closeout packet, Issue #100 closeout, Issue #111 closeout, Issue #113 completion, Issue #34 GitHub-only closeout, or the stale PR cleanup.

## Findings Closed On `master`

- `source canonical URL laundering / traceability drift`
  - shipped by PR #11
  - current evidence: `enricher/article-enricher.js`, `lead-report-publisher.js`, `tests/source-traceability.test.js`
- `invalid lead company strings accepted`
  - shipped by PR #11
  - current evidence: `lead-qualifier.js`, `tests/company-name-accuracy.test.js`
- `no-body enrichment fabricated evidence / overconfident ROI wording`
  - shipped by PR #11
  - current evidence: `worker/api/enrichment.js`, `worker/tests/enrichment.test.mjs`
- `lead PATCH partial-write bug`
  - shipped by PR #11
  - current evidence: `worker/db/leads.js`, `worker/tests/lead-patch-atomicity.test.mjs`
- `stable root lead identity 부재`
  - shipped by PR #12
  - current evidence: `lead-identity.js`, `tests/root-identity-trust.test.js`
- `low-trust article body leak into qualifier prompt`
  - shipped by PR #12
  - current evidence: `article-trust.js`, `lead-qualifier.js`
- `stable worker lead identity 부재 / normalize-before-persist 누락`
  - shipped by PR #16
  - current evidence: `worker/db/transform.js`, `worker/db/schema.js`, `worker/schema.sql`
- `query-token bridge 누락`
  - shipped by PR #16
  - current evidence: `worker/self-service/lead-utils.js`, `worker/self-service/lead-prompt.js`, `worker/self-service/lead-model.js`
- `product canonicalization mismatch / orphan product`
  - shipped by PR #16
  - current evidence: `worker/lib/profile.js`, `worker/api/leads.js`
- `queued run premature completion`
  - shipped by PR #18
  - current evidence: `worker/lib/job-trigger.js`, `worker/api/trigger.js`, `tests/main.runtime.test.js`
- `internal API fallback auth boundary`
  - shipped by PR #25
  - current evidence: `worker/lib/auth.js`, `worker/index.js`, `tests/internal-published-report-api.test.js`
- `latest-published unsafe readiness fallback`
  - shipped by PR #25
  - current evidence: `worker/api/internal-reports.js`, `tests/internal-published-report-api.test.js`
- `root/demo fallback canonical publication risk`
  - shipped by PR #25
  - current evidence: `lead-qualifier.js`, `lead-report-publisher.js`, `tests/fallback-publication-guard.test.js`
- `self-service fallback trust opacity`
  - shipped by PR #25
  - current evidence: `worker/self-service/*`, `worker/pages/home-page.js`, `worker/tests/self-service-fallback-contract.test.mjs`, `worker/tests/home-page-self-service-trust.test.mjs`
- `D1 trust metadata persistence gap`
  - shipped by PR #25
  - current evidence: `worker/db/schema.js`, `worker/db/transform.js`, `worker/schema.sql`, `worker/tests/data-contract.test.mjs`
- `route dispatch and route-boundary drift`
  - shipped by PR #36
  - current evidence: `worker/index.js`, `worker/routes/*`, `worker/tests/route-dispatch.test.mjs`, `worker/tests/route-boundaries.test.mjs`
- `D1 schema source drift`
  - shipped by PR #39
  - current evidence: `scripts/check-d1-schema-consistency.js`, `tests/d1-schema-consistency.test.js`, `.github/workflows/ci.yml`
- `Worker auth/error disclosure follow-up`
  - shipped by PR #46 through PR #51
  - current evidence: `worker/lib/auth.js`, `worker/routes/api.js`, `worker/tests/security-hardening.test.mjs`

## Issue #100 Human UX Findings Closed On `master`

- UX-100-001 first-viewport density:
  - shipped by PR #102
  - current evidence: compact top `다음 리뷰` strip above filters on `/leads`
- UX-100-002 `/leads` header clarity:
  - shipped by PR #101
  - current evidence: `/leads` heading `리드 리뷰 큐`
- UX-100-003 duplicate human review wording:
  - shipped by PR #101
  - current evidence: non-duplicated `사람 검토: ...` labels
- UX-100-004 reviewer-note preview density:
  - shipped by PR #102
  - current evidence: short note summaries above the full deterministic copy payload in Lead Review Session and Opportunity Workbench
- Issue #100 is closed as completed for the recorded local/test-safe UX findings. Future UX feedback should use a new issue or a separately scoped record.

## Post-PR102 Source-Of-Truth And Approval Boundary

- PR #103 refreshed source-of-truth docs after Issue #100 closeout.
- PR #104 added `docs/exec-plans/production-proof-readiness-packet.md` as
  non-production readiness/planning evidence only.
- PR #105 added `docs/exec-plans/read-only-production-proof-plan.md` as
  planning only, not production execution approval.
- PR #106 added
  `docs/exec-plans/read-only-production-proof-execution-precheck.md` and
  supported Issue #34 GitHub-only closeout records.
- Issue #34 is closed as completed. Future production proof requires a new,
  separate human-approved production prompt; the closeout does not authorize
  additional production execution.
- PR #107 added `docs/standing-approval-policy.md` as the standing boundary for
  routine repo/GitHub/docs/local-only work. It reduces unnecessary `HOLD`
  states only for verified non-production work and does not authorize
  production deploy, Wrangler, production D1, production endpoints, production
  logs/secrets, production smoke tests, row roundtrips, or production
  observation claims.
- PR #109 shipped Manager / Reviewer Summary v0 as a local/test-safe `/leads`
  `리뷰 요약` panel. It uses existing `/api/leads` response data, current
  filtered leads, Reviewer Action Queue / Lead Review Session metadata, and
  LeadBrief fields only.
- PR #109 did not add schema, persistence, production access, production
  queries, CRM ownership, outreach, analytics, LLM calls, or endpoint
  expansion.
- PR #110 synced source-of-truth docs after PR #109 without production action.
- PR #112 added `docs/roadmap/saved-review-notes-decision-packet.md` before
  any saved-notes implementation.
- Issue #113 selected `OPTION_E` and is closed as completed.
- PR #114 shipped the Option E copy-only generated reviewer note suggestion
  clarification for `/leads`, Opportunity Workbench, tests, and related docs.
  Generated suggestions remain helper text only: copy-only, not saved, not sent,
  and not human-authored saved notes.
- Generated suggestion persistence remains unimplemented. Manual Review Notes
  persistence is limited to human-entered `manualReviewNotes` backed by the
  existing `leads.notes` value; edit means saving a changed value, and
  clear/delete means confirmed clearing of that value. PR #122 clarified saved
  vs empty state and displayed lead-level last-update timing only with honest
  lead-level copy. The T1 local/test-safe timestamp implementation adds
  `manualReviewNotesUpdatedAt` / `manual_review_notes_updated_at` only for the
  last accepted human-entered manual note change/save/clear event. H2
  local/test metadata history adds only create/edit/clear event type,
  timestamp, lead id, and the fixed generic author label in
  `manual_review_note_events`; production, CRM, outreach, analytics, LLM,
  outcome learning, old note value retention, full note history, reviewer
  identity, retention/privacy enforcement, and manager dashboard expansion
  remain separately scoped.
- `docs/roadmap/manual-review-notes-v1-reviewer-identity-decision-packet.md`
  is the current docs-only reviewer identity / author attribution decision
  packet. Its approval-intent record is Issue #118 comment
  `https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4486274314`.
  The follow-up PR #126 generic author-label implementation is limited to the
  fixed non-PII `manual_reviewer` value in `manualReviewNotesAuthorLabel` /
  `manual_review_notes_author_label`. It does not approve real reviewer
  identity, authenticated identity, display-name fields, author audit trails,
  note history/versioning, retention/privacy enforcement, generated suggestion
  attribution, production proof, production deploy, production D1, production
  endpoints, production logs/secrets, or customer data access.
- `docs/roadmap/manual-review-notes-v1-note-history-versioning-decision-packet.md`
  is the current H2 metadata-only note history/versioning record. Its local/test
  implementation approval record is Issue #118 comment
  `https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4487764655`.
  It approves only metadata-only create/edit/clear events and does not approve
  old note value retention, generated suggestion history, full/audit-grade
  history, retention/privacy enforcement, production
  proof, production deploy, production D1, production endpoints, production
  logs/secrets, or customer data access.
- `docs/roadmap/manual-review-notes-v1-retention-privacy-policy-decision-packet.md`
  is the current retention/privacy policy decision record. It approved only the
  later local/test static privacy warning shipped by PR #130, and it does not
  approve retention/privacy enforcement, purge/delete jobs, redaction,
  automated PII detection, export/manager visibility expansion, production
  proof, production deploy, production D1, production endpoints, production
  logs/secrets, or customer data access.
- `docs/roadmap/manual-review-notes-v1-production-readiness-gap-packet.md`
  is the current docs-only production readiness gap packet. It does not approve
  runtime/UI/schema/API changes, production proof execution, production deploy,
  production D1 migration/access/write, production endpoints, production
  logs/secrets, retention/privacy enforcement, automated PII
  detection/redaction, export/manager visibility expansion, real/authenticated
  reviewer identity, generated suggestion persistence/retention/history/
  attribution, or production readiness claims beyond "gap packet prepared."
- `docs/roadmap/manual-review-notes-v1-access-visibility-export-decision-packet.md`
  is the current docs-only access/visibility/export decision packet. It does
  not approve runtime/UI/schema/API changes, access-control implementation,
  manager visibility expansion, export expansion, API exposure expansion,
  production proof/deploy, production D1 migration/access/write, production
  endpoints, production logs/secrets, retention/privacy enforcement, automated
  PII detection/redaction, real/authenticated reviewer identity, generated
  suggestion export/persistence/history/retention/attribution, or production
  readiness claims beyond "access/visibility/export packet prepared."
- Issue #111 is closed as completed for the Manager / Reviewer Summary v0 UX
  Findings Intake.
- `docs/roadmap/next-product-track-decision-packet.md` remains the
  post-PR107 decision packet that explains why manager/reviewer summary v0 was
  selected before PR #109. After PR #114 and Issue #113, use
  `docs/roadmap/saved-review-notes-decision-packet.md` for the next saved-notes
  product/data boundary before any persistence or v1 expansion.
- PR #149 through PR #160 reframed the closed Manual Review Notes lane into the
  Level 1 productization path. Current productization level remains
  `LEVEL_0_COMPLETE`; target remains
  `LEVEL_1_PRODUCTION_REVIEWER_WORKFLOW`; PR #160 added non-production guard
  tests for the existing C2 local/test role stub only. The current Level 1
  blocker burn-down packet is
  `docs/roadmap/b2b-lead-agent-level-1-blocker-burndown-packet.md`.
  Production reviewer workflow remains blocked by auth provider/session
  decisions, production D1 facts/proof, rollback/backout ownership, final
  production proof approval, and privacy residual values. Conservative privacy
  policy remains planning-only. No production/staging/D1/endpoint/log/secret,
  CRM, outreach, LLM, automation, or customer/private data action is approved.

## Remaining Open Items

- No new unresolved Wave 1 to Wave 3 runtime or worker blocker was verified during this docs refresh.
- PR #196 remediated the scoped LeadCandidate publication characterization and
  PR #197 remediated the scoped legacy D1 migration/current-history snapshot
  characterizations from PR #195. PRs #199-#201 remediated the remaining
  Worker outbound network/SSRF, protected reviewer PWA cache, and concurrent
  PATCH/callback lanes; all 18 desired-contract TODOs from those three lanes are
  now executable passing coverage. PRs #202-#203 additionally close the scoped
  cross-artifact atomic publication and notification-ordering gap. These remain
  local/test contracts, not production evidence.
- No new unresolved PR #27 LeadBrief v1 blocker was verified during this docs refresh.
- No new unresolved PR #36-#51 route/data/schema/auth/evidence blocker was verified during this docs refresh.
- Operator cleanup status:
  - PRs #1-#9 are closed without merge after current-`master` disposition comments. Do not merge or reopen those old branches as-is.
  - PR #10 is closed without merge and superseded by PR #11.
  - PR #22 is closed without merge and superseded by PR #25.
  - PR #23 is closed without merge and superseded by PR #48 through PR #51.
  - PRs #13, #14, #15, and #17 are already closed without merge because their changes shipped through PRs #16 and #18.
  - Remote raw/historical branches may remain as concept inventory. Do not prune/delete branches without an explicit cleanup instruction.
- Product next step: no mandatory staging or production action follows this
  source-of-truth sync. The stable operational default is truthful `HOLD`/no-op.
- The current docs-only follow-up is
  `docs/roadmap/pr207-candidate-review-v2-bounded-retention-method-decision-packet.md`.
  It records a packet-local method selection pending human docs review for the
  future Candidate Review v2 reviewer, candidate/page/anchor, decision,
  precision, patch-suitability, bounded-retention, privacy, merge-train,
  canonical-claim, and Tender Matrix method on the evaluated PR #205 baseline.
  It creates no candidates, no human fidelity decisions, and no Candidate
  Review v2 human candidate decisions, and approves no implementation, restack,
  merge, canonical `VERIFIED` claim, Tender Matrix, or production action. PRs
  #206/#207 remain Draft and frozen; Issue #165 remains `HOLD`.
- No mandatory local hardening action follows PR #203. If a new bounded goal is
  selected, the remaining application-level remote-read deadline identified in
  PR #197 is a candidate; real auth/RBAC/privacy implementation and production
  proof remain separately approval-gated goals.
- Issues #162, #154, #163, and #164 are complete for docs planning only; those
  records may be reconfirmed in parallel for an exact future SHA/target and do
  not authorize execution. Before any D1 inventory, Issue #163 must receive a
  fresh exact target plus command/table/output-field allowlist covering exact
  `d1_schema_migrations` `version`/`name` ledger rows, column metadata for every
  canonical table, and `sqlite_schema` table/index/trigger SQL metadata or
  approved redacted fingerprints; application/customer rows remain forbidden.
  Its older allowlist covers only `PRAGMA table_info` / `PRAGMA index_list` for
  `leads` and `manual_review_note_events`, so it cannot authorize those PR #197
  readiness outputs. Before any migration, Issue #164 must bind the rollback
  owner, stop-write policy, and abort/recovery criteria. Before final proof,
  Issue #162 and all applicable privacy/retention inputs from Issue #154 must be
  reconfirmed. Only then may Issue #165 receive a fresh final approval packet
  for the exact current SHA, target, command allowlist, endpoint and D1
  boundaries, fixture/non-customer data policy, redaction, rollback owner, stop
  conditions, approver, and expiry. Staging execution,
  staging D1 access, staging endpoint calls, staging logs/secrets,
  local/fake-D1 dry-run execution beyond ordinary docs-only PR validation,
  C3-C5, real access control, auth/session, production roles, manager
  visibility, export expansion, API exposure expansion, production rollback
  execution, destructive data action, production proof execution, production
  deploy, production D1 schema observation/migration/access/write/delete,
  production endpoint calls, production logs/secrets access,
  retention/privacy enforcement, purge/delete jobs, redaction, automated PII
  detection, old note value retention, full history, generated suggestion
  history/export/persistence, production history, and customer-data access
  remain HOLD until a later approval selects those boundaries.
- Rationale: Workbench, deterministic review gate, local E2E, synthetic lead-quality evaluation, advisory next-action guidance, review filters, solution translation, product context, stakeholder prep, evidence/data-gap review slices, advisory roleplay stakeholder context, list-level review-gate summaries/filtering/counts, Kanban gate labels/chips, filter empty-state recovery, reviewer productivity controls, lead-detail productivity parity, reviewer workflow QA/accessibility hardening, roving tablist behavior, semantic snapshot coverage, the final audit/demo packet, the Human UX Review Packet, Issue #100 closeout, the compact `다음 리뷰` strip, reviewer-note summaries, roadmap/current-train source-of-truth sync, production-proof planning records, Issue #34 closeout, standing approval policy, Manager / Reviewer Summary v0, PR #110 source-of-truth sync, Issue #111 UX intake closeout, the Saved Review Notes Decision Packet, Issue #113 Option E completion, PR #114 copy-only clarification, PR #119-#142 Manual Review Notes local/test-safe and docs-only work, docs-only access-control planning, the C2 opt-in role stub, the production proof plan, the production D1 migration plan, the production rollback/backout plan, the local/staging dry-run plan, the local/fake-D1 evidence packet, the staging target decision packet, and the non-production closeout packet are documented without production action. The stable state is HOLD/no-op until a separate human-approved staging or production prompt opens operational work.
  - Keep production proof execution, platform migration, storage migration, and production observation work behind separate approval gates.

## Current Operating Sequence

1. Sync with `origin/master` and confirm the repo fingerprint before planning work.
2. Read `AGENTS.md`, this file, and `NEXT_SESSION_PROMPT.md`.
3. Keep one integration and control thread on updated `master` for planning, merge ordering, docs alignment, and final ship decisions.
4. Run implementation in owned worktrees or branches with one narrow scope each.
5. Validate inside the owned worktree with the smallest relevant commands, then use a single integration artifact branch or PR if multiple lanes must ship together.
6. Mark old plans and status files as archival context instead of deleting them.
7. Refresh these root source-of-truth docs whenever merged reality changes.
8. Keep request paths DDL-free. Do not claim production D1 migration or schema
   readiness until a separately approved versioned Wrangler migration workflow
   and read-only postcheck have been executed and their redacted evidence has
   been reviewed for the exact target and SHA.
9. Use `docs/standing-approval-policy.md` to avoid unnecessary `HOLD` states
   for routine repo/GitHub/local-only work; keep production deploy, Wrangler,
   production D1, production endpoints, production logs/secrets, smoke tests,
   row roundtrips, and production observation claims behind separate explicit
   human approval.

## Archival Guidance

- `docs/exec-plans/*.md` and `tmp/codex/*.md` capture branch-local execution and verification history.
- Use them as evidence for what shipped or what was audited in a worktree.
- Do not treat them as current `master` truth unless the active task explicitly refreshes them.
