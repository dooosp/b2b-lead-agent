# AGENTS

## Purpose

Repo-specific operating guidance for agent work in `b2b-lead-agent`.

## Repo Identity

- Repository and package name: `b2b-lead-agent`
- Batch entrypoint: `main.js`
- Worker entrypoint: `worker/index.js`
- Current hardening source of truth: `HARDENING_PLAN.md`
- Current session handoff prompt: `NEXT_SESSION_PROMPT.md`

## Current Shipped Baseline

- `master` includes the April 7, 2026 hardening cycle, the PR #25 P0 trust-boundary baseline, the PR #27 LeadBrief v1 review contract baseline, the May 11 route/data/schema/evidence/docs cleanup train, PR #51's post-train integration, PR #52/#53 review-roadmap follow-ups, PR #54 review queue filters, PR #55 Solution Translation Summary, PR #56 source-of-truth doc sync, PR #57 Product Context / Signal Fusion, PR #58 post-PR57 doc sync, PR #59 Workbench Stakeholder Prep, PR #60 source-of-truth doc sync, PR #61 evidence/data-gap review slices, PR #62 source-of-truth doc sync, PR #63 advisory roleplay stakeholder context, PR #64 source-of-truth doc sync, PR #65 Validate Naming workflow maintenance, PR #66 source-of-truth doc sync, PR #67 deterministic check-workflow installs, PR #68 source-of-truth doc sync, PR #69 production-boundary doc refresh, PR #70 lead-quality evaluator CI gate, PR #71 local-only Worker E2E CI gate, PR #72 Opportunity Workbench review gate, PR #73 source-of-truth doc sync, PR #74 lead-list review gate, PR #75 source-of-truth doc sync, PR #76 lead-list gate-state filtering, PR #77 source-of-truth sync, PR #78 hardening doc refresh, PR #79 lead-list gate-state counts, PR #80 Kanban gate labels, PR #81 Kanban gate-state chips, PR #82 source-of-truth doc sync, PR #83 Kanban filter empty state, PR #84 filter empty-state reset, PR #87 Lead Action Intelligence v1, PR #88 Reviewer Action Queue v1.1, PR #89 Lead Review Session v1, PR #90 Reviewer Notes Template v1, PR #91 Reviewer Productivity Toolkit v1, PR #92 Lead Detail Workbench Productivity Parity v1, PR #93 Reviewer Workflow QA & Accessibility Hardening v1, PR #94 Reviewer Workflow Roving Keyboard & Accessibility Snapshot Gate v1, PR #95 Reviewer Workflow Final Audit & Demo Packet, PR #96 roadmap/current-train source-of-truth sync, PR #97 post-PR96 source-of-truth sync, PR #98 reviewer workflow demo rehearsal clarification, PR #99 Human UX Review Packet, PR #101 reviewer workflow copy/label fixes, PR #102 reviewer workflow summary affordances, PR #103 source-of-truth sync after Issue #100 closeout, PR #104 production-proof readiness refresh, PR #105 read-only production proof plan, PR #106 read-only production proof execution precheck, PR #107 standing approval policy, PR #109 Manager / Reviewer Summary v0, PR #110 post-PR109 source-of-truth sync, PR #112 Saved Review Notes Decision Packet, PR #114 copy-only reviewer note suggestion clarification, PR #119's docs-only Option A implementation plan, PR #120's local/test-safe Option A implementation, PR #121's Manual Review Notes v0 edit/clear UX hardening, PR #122's Manual Review Notes v0 saved/empty state plus lead-level timestamp clarity, PR #123's Manual Review Notes v1 data semantics decision packet, PR #124's T1 note-specific timestamp implementation, PR #125's Manual Review Notes v1 reviewer identity decision packet, PR #126's local/test-only generic manual reviewer label implementation, PR #127's Manual Review Notes v1 note history/versioning decision packet, PR #128's local/test-only H2 metadata-only manual note history implementation, PR #129's Manual Review Notes v1 retention/privacy policy decision packet, PR #130's static local/test privacy warning, PR #131's Manual Review Notes v1 production readiness gap packet, PR #132's Manual Review Notes v1 access/visibility/export decision packet, PR #133's Manual Review Notes v1 access-control plan, PR #134's post-plan source-of-truth sync, and PR #135's Manual Review Notes v1 C2 local/test role stub through audited baseline `0c1bf0c839127d757664c21b9dc7aa1c64b1f8f3`.
- Wave 1 shipped across PRs #11 and #12.
- Wave 2 shipped via PR #16.
- Wave 3 shipped via PR #18.
- PR #25 shipped `/api/internal/*` API-token-only auth, latest-published `503 readiness_unavailable` fail-closed behavior, managed/root fallback publication guards, self-service trust metadata, and D1 trust metadata persistence.
- PR #27 shipped LeadBrief v1 as the central human-review unit across root qualification, published snapshots, D1 persistence, `/api/leads`, self-service responses, CSV/export trust metadata, and the minimum review UI.
- PRs #36-#43 shipped Worker route dispatch, LeadBrief data-path hardening, schema drift checks, test helper refactors, review UX metadata, release evidence tooling, architecture docs, and canonical naming cleanup.
- PR #51 integrated PRs #44-#49: Opportunity Workbench v1, local-only Worker E2E harness, Worker auth/error hardening, synthetic lead-quality evaluation, old PR #23 replacement, and roadmap synthesis.
- PR #59 recut old PR #6 as advisory role-specific Workbench helper guidance on top of existing LeadBrief/Opportunity Workbench data.
- PR #61 recut old PR #3's remaining dashboard-intelligence idea as cached `/leads` evidence/data-gap review slices without API, schema, storage, production, or CRM expansion.
- PR #63 recut old PR #6's remaining roleplay idea as advisory selected-LeadBrief stakeholder context without outreach approval, CRM ownership, schema, storage, production, or source-of-truth expansion.
- PR #65 aligned the Validate Naming workflow with Node 24-compatible GitHub Actions versions and extended workflow contract coverage for that workflow.
- PR #67 switched non-production check workflows to lockfile-backed `npm ci` installs and added workflow contract coverage for that install policy.
- PR #68 synced source-of-truth docs after PR #67 and confirmed the no-open-PR post-PR67 state.
- PR #69 refreshed source-of-truth production-boundary docs after PR #68 without approving any production action.
- PR #70 added the synthetic lead-quality evaluator to CI as a local-only quality gate.
- PR #71 added the fake-D1, loopback-only Worker E2E smoke to CI with deterministic Playwright Chromium setup.
- PR #72 added a deterministic Opportunity Workbench review gate that summarizes readiness/blockers from current LeadBrief fields only.
- PR #73 synced source-of-truth docs after PR #72.
- PR #74 added deterministic list-level review-gate summaries to `/leads` cards from current LeadBrief fields only.
- PR #75 synced source-of-truth docs after PR #74.
- PR #76 added deterministic list-level review-gate state filtering to `/leads` without API, schema, storage, CRM ownership, production query, or outreach-approval changes.
- PR #77 synced source-of-truth docs after PR #76.
- PR #78 refreshed remaining hardening/source-of-truth docs after PR #76 without approving production action.
- PR #79 added deterministic gate-state count summaries to `/leads` for the current filtered queue.
- PR #80 showed deterministic list-gate labels on Kanban cards.
- PR #81 rendered those Kanban gate labels as state-specific chips without API, schema, storage, CRM ownership, production query, or outreach-approval changes.
- PR #82 synced source-of-truth docs after PR #81.
- PR #83 added a visible Kanban zero-result filter empty state without changing filter semantics.
- PR #84 added an in-place reset action to list and Kanban filter empty states.
- PR #87 added deterministic Lead Action Intelligence v1 from existing LeadBrief fields only.
- PR #88 added deterministic Reviewer Action Queue v1.1, additive `/api/leads` queue metadata, queue lanes, filters, sorting, compact summaries, and local E2E coverage.
- PR #89 added deterministic Lead Review Session v1 with current-filter progress, lane counts, next-lead focus, quick `APPROVED` / `NEEDS_REVIEW` actions, bounded failure UI, queue refresh after mutation, and local fake-D1 E2E coverage.
- PR #90 added deterministic Reviewer Notes Template v1 to Lead Action Intelligence, Reviewer Action Queue, Lead Review Session, and Opportunity Workbench without persistence, schema, production, LLM, external-call, CRM ownership, or auto-send behavior.
- PR #91 added `/leads` reviewer productivity copy/manual-copy controls, non-mutating shortcuts, shortcut help, and browser-memory session activity without localStorage, analytics, schema, production, external call, or keyboard-triggered review mutation.
- PR #92 mirrored the same safe productivity affordances into lead-detail Opportunity Workbench with deterministic note copy controls, manual-copy fallback, non-mutating detail shortcuts, shortcut help, and browser-memory current-page activity feedback.
- PR #93 hardened the list/detail reviewer workflow with accessible tab semantics, clearer copy/status-control labels, bounded live-region feedback, interactive-control shortcut guards, focus-visible/mobile wrapping improvements, zero-result reset preservation, reviewStatus/status separation coverage, and local E2E mobile overflow smoke.
- PR #94 added arrow-key roving focus and semantic snapshot coverage for the reviewer workflow without production, schema, persistence, external-call, analytics, or keyboard-triggered review mutation scope.
- PR #95 added the Reviewer Workflow Final Audit & Demo Packet.
- PR #96 synced roadmap/current-train source-of-truth docs after the final audit packet.
- PR #97 synced source-of-truth docs after PR #96.
- PR #98 clarified how to rehearse the final audit/demo packet on newer `master` heads while preserving the original audit baseline.
- PR #99 added `docs/reviewer-workflow-human-ux-review.md` as the local/test-safe Human UX Review Checklist and Feedback Intake Packet.
- PR #101 addressed Issue #100 UX-100-002 and UX-100-003: `/leads` now uses the `리드 리뷰 큐` heading and non-duplicated `사람 검토: ...` human review labels.
- PR #102 addressed Issue #100 UX-100-001 and UX-100-004: `/leads` now has a compact top `다음 리뷰` strip above filters, and Lead Review Session / Opportunity Workbench reviewer-note areas show short summaries above the full deterministic copy payload.
- PR #103 synced source-of-truth docs after Issue #100 closeout.
- PR #104 added the production-proof readiness refresh packet as non-production planning only.
- PR #105 added the read-only production proof plan as planning only.
- PR #106 added the read-only production proof execution precheck and supported GitHub-only Issue #34 closeout records.
- PR #107 added `docs/standing-approval-policy.md` as the standing approval boundary for routine repo/GitHub/docs/local-only work while preserving separate approval gates for all production action.
- PR #109 shipped Manager / Reviewer Summary v0 as a compact `/leads` `리뷰 요약` panel from existing filtered leads, Reviewer Action Queue / Lead Review Session metadata, and LeadBrief fields only. It did not add schema, persistence, production access, production queries, CRM ownership, outreach, analytics, LLM calls, or endpoint expansion.
- PR #110 synced source-of-truth docs after PR #109 without production action.
- PR #112 added the Saved Review Notes Decision Packet. Issue #113 then selected `OPTION_E` and is closed as completed.
- PR #114 implemented only the Option E copy/docs/test clarification for generated reviewer note suggestions. Generated suggestions are generated helper text, copy-only, not saved, not sent, and not human-authored saved notes. At that point, saved notes persistence remained unimplemented.
- PR #119 added the plan-only Option A manual review notes implementation packet. Issue #118 is closed as completed for that plan-only state.
- Current implementation approval record: Issue #118 comment `https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4477073009` records `IMPLEMENT_OPTION_A_MANUAL_NOTES_LOCAL_TEST_ONLY`. It supersedes the older plan-only HOLD only for local/test-safe Option A implementation: human-entered manual notes may be saved through the explicit manual note control/API alias, generated suggestions remain copy-only and unsaved, and production proof/deploy remains HOLD.
- Current state/timestamp clarity approval record: Issue #118 comment `https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4483103871` records `IMPLEMENT_MANUAL_REVIEW_NOTES_V0_STATE_TIMESTAMP_CLARITY_LOCAL_TEST_ONLY`. It authorizes only saved/empty manual note state clarity and truthful timestamp/update-state labeling. Existing `updated_at` is lead-level unless a future schema/API decision adds a note-specific timestamp, so UI copy must not claim "manual note saved at" from `updated_at`.
- PR #122 shipped that state/timestamp clarity scope: saved human-entered notes show saved state, empty notes show empty state, and `updatedAt` / `updated_at` is labeled only as lead-level update state, not manual-note-specific saved time.
- Current Manual Review Notes v1 data semantics approval-intent record: Issue #118 comment `https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4483259825` records `PREPARE_MANUAL_REVIEW_NOTES_V1_DATA_SEMANTICS_DECISION_PACKET_DOCS_ONLY`. It authorizes only a docs-only decision packet for note-specific timestamp, reviewer identity, note history/versioning, retention/privacy, and production-readiness gates.
- Current Manual Review Notes v1 T1 timestamp approval record: Issue #118 comment `https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4483448642` records `IMPLEMENT_MANUAL_REVIEW_NOTES_V1_NOTE_SPECIFIC_TIMESTAMP_T1_LOCAL_TEST_ONLY`. It authorizes only local/test-safe note-specific timestamp semantics for human-entered manual note create/edit/clear events using `manualReviewNotesUpdatedAt` / `manual_review_notes_updated_at`; reviewer identity, note history/versioning, retention/privacy enforcement, generated suggestion persistence, production proof/deploy, production D1, production endpoints, logs, and secrets remain out of scope.
- Current Manual Review Notes v1 reviewer identity decision-packet approval-intent record: Issue #118 comment `https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4486274314` records `PREPARE_MANUAL_REVIEW_NOTES_V1_REVIEWER_IDENTITY_DECISION_PACKET_DOCS_ONLY`. It authorizes only a docs-only reviewer identity / author attribution decision packet; no schema/API/runtime/UI behavior, reviewer identity implementation, authenticated identity, display-name implementation, author audit trail, note history/versioning, retention/privacy enforcement, generated suggestion attribution, or production action is approved.
- Current Manual Review Notes v1 generic author label approval record: Issue #118 comment `https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4487335178` records the local/test-only fixed `manual_reviewer` label implementation. It authorizes only `manualReviewNotesAuthorLabel` / `manual_review_notes_author_label` for accepted human-entered manual note create/edit/clear events; no real reviewer identity, authenticated identity, display names, email, author audit trail, note history/versioning, retention/privacy enforcement, generated suggestion attribution, or production action is approved.
- Current Manual Review Notes v1 note history/versioning decision-packet approval-intent record: Issue #118 comment `https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4487570553` records `PREPARE_MANUAL_REVIEW_NOTES_V1_NOTE_HISTORY_VERSIONING_DECISION_PACKET_DOCS_ONLY`. It authorizes only a docs-only note history/versioning decision packet; no schema/API/runtime/UI behavior, D1 migration, note history implementation, append-only log, old note value retention, retention/privacy enforcement, generated suggestion history, or production action is approved.
- Current Manual Review Notes v1 H2 metadata-only history approval record: Issue #118 comment `https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4487764655` records `IMPLEMENT_MANUAL_REVIEW_NOTES_V1_H2_METADATA_ONLY_HISTORY_LOCAL_TEST_ONLY`. It authorizes only local/test-safe `manual_review_note_events` metadata for accepted human-entered manual note create/edit/clear events. History events may contain only lead id, event type, timestamp, and the fixed non-PII `manual_reviewer` label; old/new note text, generated suggestion text, full note history, audit-grade history, retention/privacy enforcement, generated suggestion history, production proof/deploy, production D1, production endpoints, logs, and secrets remain out of scope.
- Current Manual Review Notes v1 retention/privacy policy decision-packet approval-intent record: Issue #118 comment `https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4492814282` records `PREPARE_MANUAL_REVIEW_NOTES_V1_RETENTION_PRIVACY_POLICY_PACKET_DOCS_ONLY`. It authorizes only a docs-only retention/privacy policy decision packet; no schema/API/runtime/UI behavior, D1 migration, retention/privacy enforcement, purge/delete job, redaction, automated PII detection, export/manager visibility expansion, production proof, production deploy, production D1, production endpoints, logs, or secrets are approved.
- Current Manual Review Notes v1 privacy warning implementation approval record: Issue #118 comment `https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4493106549` authorizes only static local/test reviewer-facing warning copy. PR #130 shipped that warning; it does not detect, block, redact, enforce retention, purge data, create production compliance evidence, expand exports/manager visibility, implement real/authenticated reviewer identity, or approve production action.
- Current Manual Review Notes v1 production readiness gap-packet approval-intent record: Issue #118 comment `https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4493189325` authorizes only a docs-only production readiness gap packet. It does not approve production proof, deploy, D1 migration/access/write, endpoint calls, logs/secrets access, retention/privacy enforcement, automated PII detection/redaction, export/manager visibility expansion, real/authenticated reviewer identity, or runtime/UI/schema/API changes.
- Current Manual Review Notes v1 access/visibility/export decision-packet approval-intent record: Issue #118 comment `https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4493367361` authorizes only a docs-only access, visibility, API, metadata-history visibility, export, generated-suggestion boundary, and access-control prerequisite decision packet. It does not approve runtime/UI/schema/API changes, access-control implementation, manager visibility expansion, export expansion, production proof/deploy, production D1 migration/access/write, production endpoint calls, logs/secrets access, retention/privacy enforcement, automated PII detection/redaction, or real/authenticated reviewer identity.
- Current Manual Review Notes v1 access-control plan approval-intent record: Issue #118 comment `https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4493804215` authorizes only a docs-only access-control plan. It does not approve runtime/UI/schema/API changes, access-control implementation, auth/session implementation, role implementation, manager visibility implementation, export implementation, API exposure expansion, production proof/deploy, production D1 migration/access/write, production endpoint calls, logs/secrets access, retention/privacy enforcement, automated PII detection/redaction, or real/authenticated reviewer identity.
- Current Manual Review Notes v1 access-control plan closeout record: Issue #118 comment `https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4493868640` records PR #133 merge evidence and validation for the docs-only plan. It does not approve any implementation or production action.
- Current Manual Review Notes v1 C2 local/test role-stub approval record: Issue #118 comment `https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4495568414` authorizes only the opt-in local/test role stub shipped by PR #135. `MANUAL_REVIEW_NOTES_LOCAL_TEST_ROLE_STUB=enabled` plus `X-Manual-Review-Notes-Local-Test-Role: reviewer` can use manual notes locally; `manager`, `api`, missing, or unknown roles omit protected manual note fields from local/test role-stub list/history/export reads and cannot write manual notes. This is not real auth, session, identity, production role control, manager visibility expansion, export/API expansion, retention/privacy enforcement, production proof/deploy, production D1 access/write/migration, production endpoint/log/secret access, or generated suggestion persistence/export/history/attribution.
- Issue #100 is closed as completed for the recorded local/test-safe UX findings. Future UX feedback should open a new issue or separately scoped record.
- Issue #111 is closed as completed for the Manager / Reviewer Summary v0 UX Findings Intake.
- Future UX feedback on the copy-only generated reviewer note suggestion wording should go to Issue #115, Copy-only Reviewer Note Suggestions UX Findings Intake.
- Issue #34 is closed as completed after GitHub-only closeout. Do not continue production proof work unless a new human-approved production prompt explicitly opens it.
- Reviewer Workflow Final Audit & Demo Packet: `docs/reviewer-workflow-final-audit.md` is the canonical local/test-safe reviewer workflow handoff. It records the completed local demo flow, validation commands, allowed/forbidden claims, note-persistence wording, and production evidence boundary.
- Next Product Track Decision Packet: `docs/roadmap/next-product-track-decision-packet.md` records the post-PR107 comparison that selected manager/reviewer summary v0 as the safest local/test-safe product slice; after PR #114 and Issue #113, keep saved review notes persistence, outcome learning, production observation, and any v1 dashboard expansion separately scoped.
- Saved Review Notes Decision Packet: `docs/roadmap/saved-review-notes-decision-packet.md` records the product/data questions for generated suggestions, edited generated suggestions, manual notes, review rationales, and status-transition reasons, plus the selected Option E boundary. PR #119 added the Option A plan-only implementation packet; the current local/test-only implementation approval record is scoped to human-entered manual notes only.
- Manual Review Notes v1 Data Semantics Decision Packet: `docs/roadmap/manual-review-notes-v1-data-semantics-decision-packet.md` records decision-only options for note-specific timestamp, reviewer identity, note history/versioning, retention/privacy, and production-readiness gates. It does not approve implementation, schema/API/runtime changes, D1 migrations, production proof/deploy, production data access, retention enforcement, or generated suggestion persistence.
- Manual Review Notes v1 Reviewer Identity Decision Packet: `docs/roadmap/manual-review-notes-v1-reviewer-identity-decision-packet.md` records decision-only options for reviewer identity source, author display semantics, author update rules, and privacy/PII handling. It does not approve reviewer identity implementation, authenticated identity, display-name fields, author audit trails, note history, retention/privacy enforcement, schema/API/runtime/UI changes, production action, or generated suggestion attribution.
- Manual Review Notes v1 Note History / Versioning Decision Packet: `docs/roadmap/manual-review-notes-v1-note-history-versioning-decision-packet.md` records the H2 metadata-only local/test approval and the remaining future gates for full history, audit-grade history, old note value retention, generated suggestion history, retention/privacy enforcement, and production action.
- Manual Review Notes v1 Retention / Privacy Policy Decision Packet: `docs/roadmap/manual-review-notes-v1-retention-privacy-policy-decision-packet.md` records decision-only options for current manual note value retention, metadata-only history retention, clear/delete semantics, PII/sensitive-content handling, export/visibility, and production-readiness gates. It does not approve implementation, schema/API/runtime/UI changes, retention/privacy enforcement, purge/delete jobs, redaction, automated PII detection, export expansion, manager visibility expansion, production proof/deploy, production data access, old note value retention, or generated suggestion retention/history.
- Manual Review Notes v1 Production Readiness Gap Packet: `docs/roadmap/manual-review-notes-v1-production-readiness-gap-packet.md` records docs-only production readiness gaps after PR #131. It does not approve production proof, deploy, production D1 migration/access/write, production endpoints, logs/secrets, retention/privacy enforcement, automated PII detection/redaction, export/manager visibility expansion, real/authenticated reviewer identity, generated suggestion persistence/retention/history/attribution, runtime/UI/schema/API changes, or production readiness claims beyond "gap packet prepared."
- Manual Review Notes v1 Access / Visibility / Export Decision Packet: `docs/roadmap/manual-review-notes-v1-access-visibility-export-decision-packet.md` records decision-only options for reviewer visibility, manager visibility, export/CSV visibility, API exposure, metadata-history visibility, generated suggestion exclusion, and access-control prerequisites. It does not approve implementation, access control, manager visibility, export expansion, API exposure expansion, runtime/UI/schema changes, production action, retention/privacy enforcement, automated PII detection/redaction, or real/authenticated reviewer identity.
- Manual Review Notes v1 Access Control Plan: `docs/roadmap/manual-review-notes-v1-access-control-plan.md` maps protected manual note surfaces, protected fields, reviewer-only access, manager access, API/export boundaries, metadata-history access, generated-suggestion exclusion, auth/role prerequisites, future tests, and production gates. It records the PR #135 C2 local/test role-stub boundary, but does not approve real auth/session, production roles, production access control, manager visibility, export/API expansion, production action, retention/privacy enforcement, automated PII detection/redaction, or real/authenticated reviewer identity.
- Do not reopen those findings unless you can point to a current-`master` regression or a newly verified gap.
- Treat closed PRs #1-#9, #10, #22, and #23 as stale/superseded concept inventory unless explicitly re-scoped on top of current `master`.
- Current non-production documentation goal: Manual Review Notes v1 access-control implementation has C1 docs-only planning complete and C2 opt-in local/test role-stub work shipped by PR #135 only for tests/local fixtures. Manual Review Notes edit means saving a changed human-entered value, clear/delete means confirmed clearing of that saved value, `manualReviewNotesUpdatedAt` means the last accepted human-entered manual note change/save/clear event, and `manualReviewNotesAuthorLabel` remains the fixed non-PII `manual_reviewer` label only. Metadata history stores create/edit/clear event metadata only in `manual_review_note_events`; old manual note values are not retained in history. Lead-level `updatedAt` / `updated_at` remains lead-level only and must not be labeled as a manual-note timestamp. The static privacy warning is local/test guidance only and does not create production compliance evidence. C3 reviewer-only controls, C4 reviewer plus manager roles, and C5 authenticated production role controls require future approval. Keep real access-control implementation, auth/session implementation, production role implementation, manager visibility expansion, export expansion, API exposure expansion, production proof, production deploy, production D1 migration/access/write, production endpoints, logs/secrets, retention/privacy enforcement, purge/delete jobs, redaction, automated PII detection, full note history, old note value retention, outcome learning, CRM/outreach/analytics/LLM, and manager dashboard v1 separately scoped unless a future approval selects them.

## Repo Layout

- Root pipeline surfaces:
  - `orchestrator/news-orchestrator.js`
  - `normalizer/article-normalizer.js`
  - `enricher/article-enricher.js`
  - `lead-qualifier.js`
  - `lead-report-publisher.js`
  - `profile-registry.js`
- Worker surfaces:
  - `worker/api/*`
  - `worker/db/*`
  - `worker/lib/*`
  - `worker/self-service/*`
  - `worker/pages/*`
- Regression suites:
  - `tests/*.test.js`
  - `worker/tests/*.test.mjs`

## Trust Boundary Rules

- Routine repo, GitHub, documentation, local validation, and non-production
  work follows `docs/standing-approval-policy.md`. That policy reduces
  unnecessary `HOLD` states only for verified local/non-production work and does
  not authorize production execution.
- `/api/internal/*` must use `INTERNAL_API_TOKEN` when configured, with `API_TOKEN` compatibility fallback only; `TRIGGER_PASSWORD` is not internal API auth.
- Latest-published readiness lookup failures must fail closed with HTTP `503` and `error.code = "readiness_unavailable"`.
- Managed/root runs must fail closed when the LLM is missing or fails unless explicit demo mode is enabled.
- Demo leads must not be canonical-published.
- Heuristic/self-service fallback leads must remain non-verified / review-needed in machine-readable payloads, browser cards, copy output, downloads, and D1 rows.
- LeadBrief v1 required fields are `company`, `signal`, `sources`, `whyNow`, `recommendedMessage`, `confidence`, `assumptions`, `dataGaps`, and `reviewStatus`.
- `reviewStatus` frozen states are `NEW`, `NEEDS_REVIEW`, `APPROVED`, `REJECTED`, and `DEFERRED`.
- LLM, heuristic, and fallback leads default to `NEEDS_REVIEW`; LLM `verificationStatus: "verified"` does not imply human approval.
- `status` remains the sales pipeline state and must not be conflated with `reviewStatus`.
- Human PATCH actions may update `reviewStatus` only with frozen-state validation.
- Reviewer note suggestions are deterministic, read-only helper output. Under Issue #113 Option E and PR #114, generated suggestions are copy-only, not saved, not sent, and not human-authored saved notes; v1 must not persist generated notes, auto-send notes, call LLM/external providers, or change D1 schema.
- Option A manual review notes are human-entered text only. The explicit local/test-safe API/UI contract is `manualReviewNotes` with derived provenance `human_entered`, backed by the existing `notes` column. T1 local/test-safe timestamp semantics use `manualReviewNotesUpdatedAt` backed by `manual_review_notes_updated_at` for the last accepted human-entered manual note change/save/clear event only. Current generic author-label semantics use `manualReviewNotesAuthorLabel` backed by `manual_review_notes_author_label` with only the fixed non-PII value `manual_reviewer` for accepted manual note create/edit/clear events. H2 metadata-only local/test history uses `manual_review_note_events` and exposes only metadata summary fields: `manualReviewNotesHistoryEventCount`, `manualReviewNotesHistoryLastEventType`, `manualReviewNotesHistoryLastEventAt`, and `manualReviewNotesHistoryLastAuthorLabel`. Old manual note values are not retained in history. Generated suggestion payload fields must be rejected or ignored by persistence paths and must not be stored as manual notes, update the note-specific timestamp, receive reviewer attribution, or become history entries. Lead-level `updatedAt` / `updated_at` may be displayed only as a lead-level "last updated" signal when no note-specific timestamp exists; do not present it as a note-specific save timestamp.
- Managed/self-service upserts preserve existing `review_status` on conflict so refreshes do not erase human review decisions.
- CSV, browser UI, self-service copy, and downloads must preserve review/trust metadata.
- D1 trust and review columns are lazy-migration-compatible but not production-observed until the first post-deploy production write is confirmed.
- Production deploy and production DB writes were not performed during PR #25, PR #26, PR #27, or the shipped PR #36-#133 local/test/docs/reviewer-UX/product-planning train.

## Canonical Repo Rules

- Preserve the role-oriented naming baseline in `docs/agent-naming-convention.md`.
- Keep `scout.js` as a compatibility wrapper only.
- Keep canonical published artifact names:
  - `reports/<profile>/lead-report-YYYY-MM-DD.md`
  - `reports/<profile>/latest-leads.json`
  - `reports/<profile>/lead-history.json`
- Prefer current canonical paths over inventing new legacy wrappers or alternate `*-api.js` surfaces.

## Working Model

- Treat `master` plus merged PR history as the only shipped source of truth.
- Use `docs/standing-approval-policy.md` as the default approval boundary for
  routine repo/GitHub/local-only work. Production deploy, Wrangler, production
  D1, production endpoint, production logs/secrets, production smoke tests, and
  production observation claims still require separate explicit human approval.
- Keep integration and control in one thread rooted on updated `master`.
- Do implementation in owned worktrees with narrow scope and explicit ownership.
- When multiple lanes exist, ship through one integration artifact branch or PR on top of current `master`; raw task branches are not automatically merge-safe once `master` has moved.
- Preserve historical task docs under `docs/exec-plans/` and `tmp/codex/`; refresh them when needed, but do not silently erase shipped context.

## Validation

- `npm run check:naming` for naming and repo contract checks
- `npm run test:root` for root pipeline coverage only
- `npm run test:unit` for worker unit coverage only
- `npm run test:contract` for worker trigger and contract coverage only
- `npm run test:worker` for the combined worker gate (`test:unit` + `test:contract`)
- `npm run eval:lead-quality` for synthetic-only LeadBrief quality and review-readiness checks
- `npm run test:e2e:local` for fake-D1, loopback-only Worker route/page smoke coverage
- `npm test` for the root gate plus the combined worker gate
