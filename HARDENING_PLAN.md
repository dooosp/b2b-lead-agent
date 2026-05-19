# HARDENING_PLAN

> Status: current hardening source of truth for `master` as of 2026-05-19.
> Audited against first-parent `master` history through `940400148da52739d08b16620068536ec3f3482f` (`Merge pull request #124 from dooosp/feat/manual-notes-note-timestamp`) and current GitHub PR state after stale PR #1-#9 closure, post-PR51 follow-ups #69-#84, PRs #87-#99, PRs #101-#107, PR #109, PR #110, PR #112, PR #114, PR #119-#124, Issue #100 closeout, Issue #111 closeout, Issue #113 completion, Issue #118 completion, Issue #115 completion, and Issue #34 GitHub-only closeout.
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
  - `/api/internal/*` authenticates with `API_TOKEN` only
  - `TRIGGER_PASSWORD` does not grant access to internal APIs
  - latest-published readiness lookup failures return HTTP `503` with `error.code = "readiness_unavailable"`
  - managed/root qualification fails closed when the LLM is missing or fails, unless explicit demo mode is enabled
  - demo leads are refused as canonical published latest leads
  - heuristic/self-service fallback leads are machine-readable and browser-visible as non-verified / needs review
  - self-service UI copy and JSON downloads preserve trust metadata
  - D1 trust metadata columns are lazy-migration-compatible through `ensureD1Schema()`
- Production deploy was not performed as part of PR #25 landing.
- The first production write after deploy should be observed to confirm the lazy D1 trust-column migration in production.

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
- D1 `review_status` is lazy-migration-compatible but not production-observed until a post-deploy production write is confirmed.
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
- Production deploy, production D1 access, production D1 writes, production Worker endpoint calls, Wrangler commands, and production observation claims were not part of PRs #36-#84, PRs #87-#99, PRs #101-#107, PR #109, PR #110, PR #112, PR #114, PR #119-#124, Issue #100 closeout, Issue #111 closeout, Issue #113 completion, Issue #34 GitHub-only closeout, or the stale PR cleanup.

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
  last accepted human-entered manual note change/save/clear event. It remains
  current-value metadata only; production, CRM, outreach, analytics, LLM,
  outcome learning, note history, reviewer identity, retention/privacy
  enforcement, and manager dashboard expansion remain separately scoped.
- `docs/roadmap/manual-review-notes-v1-reviewer-identity-decision-packet.md`
  is the current docs-only reviewer identity / author attribution decision
  packet. Its approval-intent record is Issue #118 comment
  `https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4486274314`.
  It does not approve schema/API/runtime/UI behavior, reviewer identity
  implementation, authenticated identity, display-name fields, author audit
  trails, note history/versioning, retention/privacy enforcement, generated
  suggestion attribution, production proof, production deploy, production D1,
  production endpoints, production logs/secrets, or customer data access.
- Issue #111 is closed as completed for the Manager / Reviewer Summary v0 UX
  Findings Intake.
- `docs/roadmap/next-product-track-decision-packet.md` remains the
  post-PR107 decision packet that explains why manager/reviewer summary v0 was
  selected before PR #109. After PR #114 and Issue #113, use
  `docs/roadmap/saved-review-notes-decision-packet.md` for the next saved-notes
  product/data boundary before any persistence or v1 expansion.

## Remaining Open Items

- No new unresolved Wave 1 to Wave 3 runtime or worker blocker was verified during this docs refresh.
- No new unresolved PR #25 P0 trust-boundary blocker was verified during this docs refresh.
- No new unresolved PR #27 LeadBrief v1 blocker was verified during this docs refresh.
- No new unresolved PR #36-#51 route/data/schema/auth/evidence blocker was verified during this docs refresh.
- Operator cleanup status:
  - PRs #1-#9 are closed without merge after current-`master` disposition comments. Do not merge or reopen those old branches as-is.
  - PR #10 is closed without merge and superseded by PR #11.
  - PR #22 is closed without merge and superseded by PR #25.
  - PR #23 is closed without merge and superseded by PR #48 through PR #51.
  - PRs #13, #14, #15, and #17 are already closed without merge because their changes shipped through PRs #16 and #18.
  - Remote raw/historical branches may remain as concept inventory. Do not prune/delete branches without an explicit cleanup instruction.
- Product next step:
  - Recommended next non-production goal: keep Manual Review Notes reviewer identity / author attribution decision-ready only; do not implement identity until a later approval selects identity source, author display, author update rules, privacy/PII handling, and production boundary.
  - Rationale: Workbench, deterministic review gate, local E2E, synthetic lead-quality evaluation, advisory next-action guidance, review filters, solution translation, product context, stakeholder prep, evidence/data-gap review slices, advisory roleplay stakeholder context, list-level review-gate summaries/filtering/counts, Kanban gate labels/chips, filter empty-state recovery, reviewer productivity controls, lead-detail productivity parity, reviewer workflow QA/accessibility hardening, roving tablist behavior, semantic snapshot coverage, the final audit/demo packet, the Human UX Review Packet, Issue #100 closeout, the compact `다음 리뷰` strip, reviewer-note summaries, roadmap/current-train source-of-truth sync, production-proof planning records, Issue #34 closeout, standing approval policy, Manager / Reviewer Summary v0, PR #110 source-of-truth sync, Issue #111 UX intake closeout, the Saved Review Notes Decision Packet, Issue #113 Option E completion, PR #114 copy-only clarification, PR #119-#124 Manual Review Notes local/test-safe work, Validate Naming workflow action maintenance, deterministic `npm ci` check-workflow installs, and local-only CI smoke coverage are now shipped. The next increment should stay docs/local/test/CI oriented unless a separate human-approved production prompt opens operational work.
  - Keep production proof, platform migration, storage migration, and production observation work behind separate approval gates.

## Current Operating Sequence

1. Sync with `origin/master` and confirm the repo fingerprint before planning work.
2. Read `AGENTS.md`, this file, and `NEXT_SESSION_PROMPT.md`.
3. Keep one integration and control thread on updated `master` for planning, merge ordering, docs alignment, and final ship decisions.
4. Run implementation in owned worktrees or branches with one narrow scope each.
5. Validate inside the owned worktree with the smallest relevant commands, then use a single integration artifact branch or PR if multiple lanes must ship together.
6. Mark old plans and status files as archival context instead of deleting them.
7. Refresh these root source-of-truth docs whenever merged reality changes.
8. Do not claim production D1 trust/review-column migration until a post-deploy production write has been observed.
9. Use `docs/standing-approval-policy.md` to avoid unnecessary `HOLD` states
   for routine repo/GitHub/local-only work; keep production deploy, Wrangler,
   production D1, production endpoints, production logs/secrets, smoke tests,
   row roundtrips, and production observation claims behind separate explicit
   human approval.

## Archival Guidance

- `docs/exec-plans/*.md` and `tmp/codex/*.md` capture branch-local execution and verification history.
- Use them as evidence for what shipped or what was audited in a worktree.
- Do not treat them as current `master` truth unless the active task explicitly refreshes them.
