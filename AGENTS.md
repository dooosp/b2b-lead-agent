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

- `master` includes the April 7, 2026 hardening cycle, the PR #25 P0 trust-boundary baseline, the PR #27 LeadBrief v1 review contract baseline, the May 11 route/data/schema/evidence/docs cleanup train, PR #51's post-train integration, PR #52/#53 review-roadmap follow-ups, PR #54 review queue filters, PR #55 Solution Translation Summary, PR #56 source-of-truth doc sync, PR #57 Product Context / Signal Fusion, PR #58 post-PR57 doc sync, PR #59 Workbench Stakeholder Prep, PR #60 source-of-truth doc sync, PR #61 evidence/data-gap review slices, PR #62 source-of-truth doc sync, PR #63 advisory roleplay stakeholder context, PR #64 source-of-truth doc sync, PR #65 Validate Naming workflow maintenance, PR #66 source-of-truth doc sync, PR #67 deterministic check-workflow installs, PR #68 source-of-truth doc sync, PR #69 production-boundary doc refresh, PR #70 lead-quality evaluator CI gate, PR #71 local-only Worker E2E CI gate, PR #72 Opportunity Workbench review gate, PR #73 source-of-truth doc sync, PR #74 lead-list review gate, PR #75 source-of-truth doc sync, PR #76 lead-list gate-state filtering, PR #77 source-of-truth sync, PR #78 hardening doc refresh, PR #79 lead-list gate-state counts, PR #80 Kanban gate labels, PR #81 Kanban gate-state chips, PR #82 source-of-truth doc sync, PR #83 Kanban filter empty state, PR #84 filter empty-state reset, PR #87 Lead Action Intelligence v1, PR #88 Reviewer Action Queue v1.1, PR #89 Lead Review Session v1, PR #90 Reviewer Notes Template v1, PR #91 Reviewer Productivity Toolkit v1, PR #92 Lead Detail Workbench Productivity Parity v1, PR #93 Reviewer Workflow QA & Accessibility Hardening v1, PR #94 Reviewer Workflow Roving Keyboard & Accessibility Snapshot Gate v1, PR #95 Reviewer Workflow Final Audit & Demo Packet, PR #96 roadmap/current-train source-of-truth sync, PR #97 post-PR96 source-of-truth sync, PR #98 reviewer workflow demo rehearsal clarification, PR #99 Human UX Review Packet, PR #101 reviewer workflow copy/label fixes, PR #102 reviewer workflow summary affordances, PR #103 source-of-truth sync after Issue #100 closeout, PR #104 production-proof readiness refresh, PR #105 read-only production proof plan, PR #106 read-only production proof execution precheck, PR #107 standing approval policy, PR #109 Manager / Reviewer Summary v0, PR #110 post-PR109 source-of-truth sync, PR #112 Saved Review Notes Decision Packet, PR #114 copy-only reviewer note suggestion clarification, PR #119's docs-only Option A implementation plan, PR #120's local/test-safe Option A implementation, PR #121's Manual Review Notes v0 edit/clear UX hardening, PR #122's Manual Review Notes v0 saved/empty state plus lead-level timestamp clarity, PR #123's Manual Review Notes v1 data semantics decision packet, PR #124's T1 note-specific timestamp implementation, PR #125's Manual Review Notes v1 reviewer identity decision packet, PR #126's local/test-only generic manual reviewer label implementation, PR #127's Manual Review Notes v1 note history/versioning decision packet, PR #128's local/test-only H2 metadata-only manual note history implementation, PR #129's Manual Review Notes v1 retention/privacy policy decision packet, PR #130's static local/test privacy warning, PR #131's Manual Review Notes v1 production readiness gap packet, PR #132's Manual Review Notes v1 access/visibility/export decision packet, PR #133's Manual Review Notes v1 access-control plan, PR #134's post-plan source-of-truth sync, PR #135's Manual Review Notes v1 C2 local/test role stub, PR #136's post-C2 source-of-truth sync, PR #137's Manual Review Notes v1 production proof plan, PR #138's Manual Review Notes v1 production D1 migration plan, PR #139's Manual Review Notes v1 production rollback/backout plan, PR #140's Manual Review Notes v1 local/staging dry-run plan, PR #141's local/fake-D1 dry-run evidence, PR #142's docs-only staging target decision packet, PR #143's non-production cycle closeout, and PR #145's reviewer feedback intake packet through audited baseline `c0505cf146a371490aa2399e2db182f9800ec48a`.
- Post-PR142 addendum: `master` includes PR #142's docs-only staging target
  decision packet at `d18260a4e27dd228c83553f658f14fff5b90bd78`. The
  Manual Review Notes v1 non-production closeout packet marks the local/test
  cycle complete, keeps staging and production execution blocked, and leaves no
  mandatory next action in the non-production cycle.
- Post-PR145 feedback addendum: `master` includes PR #143's closeout and PR
  #145's feedback intake packet at
  `c0505cf146a371490aa2399e2db182f9800ec48a`. Issue #144 comment
  `https://github.com/dooosp/b2b-lead-agent/issues/144#issuecomment-4503838503`
  is the first human reviewer feedback record. It is P3/docs/no-follow-up,
  confirms the docs are clear enough for the closed non-production cycle, and
  leaves `NEXT_MANDATORY_ACTION: NONE`, staging HOLD, and production HOLD.
- Post-PR177 Level 1 addendum: `master` includes PRs #171-#177 through
  `c61317144f5adb77516412af30e26925f1a97146`. `npm run check:level1`
  is the durable local-only Level 1 regression gate in CI. It is not production
  evidence, keeps `productionReady:false`, and does not approve production
  proof, deploy, D1 access, endpoint calls, logs/secrets, customer/private
  data, real auth/session/provider parsing, Cloudflare Access calls,
  rollback execution, destructive data action, CRM/outreach, LLM, automation,
  or generated suggestion persistence/export/history/attribution. Current
  fail-closed coverage includes malformed synthetic auth claims, mixed roles,
  denied route/API privacy checks, auth-header and Cloudflare Access
  credential-shaped env poison, poisoned evidence artifacts, missing local D1
  metadata/index drift, stop-write-disabled rollback requests, mutating or
  destructive rollback/SQL refusal, and value-aware redaction of poisoned raw
  evidence input under benign keys. The Level 1 change-control manifest packet
  and `npm run proof:level1:change-control-manifest` add only a local,
  machine-checkable `NOT_PRODUCTION_EVIDENCE` manifest/dry-run gate for a
  future separately approved proof goal; they do not execute proof or weaken
  Issue #165. The Level 1 operator rehearsal gate and
  `npm run proof:level1:operator-rehearsal` add only a local,
  redacted, non-executable runbook rehearsal that consumes the approval packet
	  plus manifest, refuses accidental proof-start inputs, keeps
	  `proofStartBlocked:true`, and does not execute proof or touch production.
- Post-PR180 enrichment boundary addendum: `master` includes PR #178's local-only
  Level 1 operator rehearsal gate at
  `b4d407171fefa5e6a6c2bb86b3e52aaa63bde9da` and PR #179's scoped axios
  audit triage at `bf78c2bc5f6779723eea44300978e40ca8d41574`. Axios is
  patched to `1.16.0` and remains reachable only in the root lead-generation
  enrichment pipeline, not Worker runtime. PR #180 merged at
  `6950e2c91bee564c1d2c17917cfe06d5d45241f8` and centralizes axios behind
  `enricher/outbound-http-boundary.js`, adds injected local/test transports,
  request-policy guards, failure-mode and redaction coverage,
  `npm run check:enrichment-boundary`, and
  `docs/roadmap/outbound-http-enrichment-boundary-guards-non-production.md`.
  PR #181 merged at `ae14cd907b65c008e09098689e2c22fce784863d` with
  `ENRICHMENT_FIXTURE_REPLAY_OUTPUT_CONTRACT_NON_PRODUCTION`,
  `npm run check:enrichment-replay`, and
  `docs/roadmap/enrichment-fixture-replay-output-contract-non-production.md`
  to prove fixture-only URL resolution, scraping, normalized failures,
  redaction, and stable artifacts. PR #182 merged at
  `7bc11e398415acdf480641f597eee6e3f4def228` with
  `LEAD_PIPELINE_FIXTURE_REPLAY_ARTIFACT_CONTRACT_NON_PRODUCTION`,
  `npm run check:lead-pipeline-replay`, and
  `docs/roadmap/lead-pipeline-fixture-replay-artifact-contract-non-production.md`
  to prove deterministic fixture replay outputs flow into synthetic
  lead-quality, report, publication, and evidence summaries without serializing
  raw URLs or protected text. This is local/test-only and does not approve
  production/staging deploy, endpoint calls, D1 access, logs/secrets,
  live scraping, customer/private data, CRM/outreach, LLM, automation, or
  production-readiness claims.
- Level 1 closure dashboard addendum: `master` includes PR #183 at
  `808dde2b19a450207499672d05a9ed5d4215ad66`. The current non-production
  source of truth for the PR #171-#184 Level 1 gate train is
  `docs/roadmap/b2b-lead-agent-level-1-readiness-closure-dashboard-non-production.md`
  plus machine-checkable JSON
  `tmp/codex/level1-readiness-closure-dashboard-non-production.json`,
  generated by `npm run proof:level1:closure-dashboard`. The dashboard
  enumerates all local-only Level 1, security, enrichment, and lead-pipeline
  gates; commands; artifacts; issue map; risks; and future production-proof
  prerequisites. It is `NOT_PRODUCTION_EVIDENCE`, keeps
  `productionReady:false`, keeps `productionReviewerWorkflowReady:false`, and
  records Issue #165 as the exact remaining blocker for a separate explicit
  human production proof execution goal.
- PR #184 approval-intake gate addendum: `master` includes PR #184 at
  `bf5a627d2790828fa87ba6ee775e066a15359f20`, which adds
  `LEVEL1_PRODUCTION_PROOF_APPROVAL_INTAKE_GATE_NON_PRODUCTION`,
  `npm run proof:level1:approval-intake`,
  `docs/roadmap/b2b-lead-agent-level-1-production-proof-approval-intake-gate-non-production.md`,
  `docs/roadmap/b2b-lead-agent-level-1-production-proof-approval-intake-template-non-production.json`,
  and
  `tmp/codex/level1-production-proof-approval-intake-gate-non-production.json`.
  It converts Issue #165's remaining human blocker into a machine-checkable,
  non-executable request template and validator. Required future approval
  fields are target, command allowlist, endpoint boundary, D1 boundary,
  fixture/non-customer data policy, evidence redaction, rollback owner, stop
  conditions, approver, and expiry. The gate fails closed for missing, vague,
  stale, contradictory, production-ready, secret-like, broad endpoint,
  destructive SQL, and customer-data inputs; it remains
  `NOT_PRODUCTION_EVIDENCE`, keeps `productionReady:false`, and does not
  approve production proof.
- Post-PR185 Level 1 post-approval simulator addendum: `master` includes PR
  #185 at `134034dcb1744e5bdc2582a1c116575c668b4c0b`, which added
  `LEVEL1_POST_APPROVAL_DECISION_SIMULATOR_NON_PRODUCTION`,
  `npm run proof:level1:post-approval-simulator`,
  `docs/roadmap/b2b-lead-agent-level-1-post-approval-decision-simulator-synthetic-packets-non-production.json`,
  `docs/roadmap/b2b-lead-agent-level-1-post-approval-decision-simulator-non-production.md`,
  and
  `tmp/codex/level1-post-approval-decision-simulator-non-production.json`.
  It consumes checked-in synthetic Issue #165 packets only and returns
  `HOLD`, `BLOCKED`, or `READY_FOR_SEPARATE_HUMAN_EXECUTION`. A
  `READY_FOR_SEPARATE_HUMAN_EXECUTION` simulator decision is still only
  `NOT_PRODUCTION_EVIDENCE`; it keeps `productionReady:false`,
  `productionReviewerWorkflowReady:false`, and `proofExecutionApproved:false`,
  and the exact remaining human-only action is a separate explicit production
  proof execution goal.
- Post-PR186 refactor/dependency addendum: `master` includes PR #186 at
  `4d419f3bf771bb0e6ac656eeb2560445edcee4dd`. PR #186 extracted shared
  Opportunity Workbench reviewer-note rendering into
  `worker/pages/reviewer-note-renderer.js`, extracted replay/boundary CLI
  helpers into `scripts/lib/cli-utils.mjs`, and patched audit dependencies to
  `nodemailer@9.0.1`, `form-data@4.0.6`, `undici@7.28.0`, and
  `hasown@2.0.4`. It was repo-local refactor/tooling/dependency work only and
  did not approve production deploy, production D1 access/write/migration,
  endpoint calls, logs/secrets access, customer-data access/mutation, staging
  execution, CRM/outreach/LLM/automation, or production-readiness claims.
- Post-PR188 source-of-truth/archive addendum: `master` includes PR #187 at
  `c7da118376df889edf5c47ba508fc4f817535ed0` and PR #188 at
  `55953593088e292f9561e6c3570eae2e29a90ca3`. PR #187 synced
  source-of-truth docs after PR #186. PR #188 tracked historical PR #12
  root-cycle merge and Wave 2 bootstrap execution/status records as archival
  docs only. Neither PR approves production deploy, staging execution,
  production D1 access/write/migration, endpoint calls, logs/secrets access,
  customer-data access/mutation, CRM/outreach/LLM/automation, or
  production-readiness claims.
- Post-PR189 source-of-truth addendum: `master` includes PR #189 at
  `5a3c7c9cfe3068b38d8196d60aaf378adc64da14`. PR #189 synced
  source-of-truth and production-boundary docs after PR #188. It did not
  approve production deploy, staging execution, production D1
  access/write/migration, endpoint calls, logs/secrets access, customer-data
  access/mutation, CRM/outreach/LLM/automation, or production-readiness claims.
- Post-PR191 reviewer workflow intelligence addendum: `master` includes PR
  #190 at `c90eeded7c6d6718482993d5d233ed343aee0771` and PR #191 at
  `72def61e89b3c2137b13e2a3ce0bbbc58407d8ce`. PR #190 synced
  source-of-truth docs after PR #189. PR #191 added local/test-safe Reviewer
  Workflow Intelligence v1: explicit human-entered `reviewerFeedback`, fixed
  local/test `manual_reviewer` attribution, metadata-only
  `reviewer_feedback_events`, additive `reviewerWorkflowSummary`,
  deterministic `dataGapPrioritization`, schema/fake-D1 contracts, UI controls,
  and route privacy coverage. It remains `NOT_PRODUCTION_EVIDENCE`, keeps
  `productionReady:false`, follows the C2 local/test role-stub boundary, and
  does not approve production/staging endpoints, D1 access/observation/
  migration/write/delete, logs/secrets, real auth/session/provider parsing,
  real reviewer identity, CRM/outreach/LLM/automation, retention/privacy
  enforcement, generated suggestion persistence/export/history/attribution,
  or production-readiness claims.
- Post-PR193 reviewer workflow boundary-audit addendum: `master` includes PR
  #192 at `a1ad439348730f834ae7ce5448750b8a5535f502` and PR #193 at
  `1c4784338853615225d26e6c263e33389cb507fd`. PR #192 synced
  source-of-truth docs after PR #191. PR #193 added only
  `npm run check:reviewer-workflow-boundary`,
  `tmp/codex/reviewer-workflow-boundary-audit-non-production.json`, and
  release-evidence redaction coverage for reviewer feedback boundaries. These
  records remain `NOT_PRODUCTION_EVIDENCE`, keep `productionReady:false`, and
  do not approve production deploy, staging execution, production/staging D1
  access/write/migration/observation/delete, endpoint calls, logs/secrets
  access, customer-data access/mutation, real auth/session, retention/privacy
  enforcement, generated suggestion persistence/export/history/attribution,
  CRM/outreach/LLM/automation, or production-readiness claims.
- Post-PR197 trust, publication, and D1 contract addendum: `master` includes
  PR #194's post-PR193 source-of-truth sync at
  `8065581cb3756b90783b64115d4b09945d2f9c23`, PR #195's test-only P0
  characterization baseline at `5a4f0eec95f8d4e87ee663987d264caea96666b4`,
  PR #196's LeadCandidate-to-LeadBrief publication hardening at
  `09aa3d7b991d4eb20bce822ce69e74044d66dfab`, and PR #197's D1
  snapshot/migration contract hardening at
  `1b53aabf917e790d6c05db311c0810b4b3807d95`. PR #196 projects untrusted
  model output through the public LeadBrief allowlist, binds verification to
  canonical fresh evidence, rejects invalid scores and non-HTTP(S) sources,
  assigns identity/status/timestamps from system context, and fails closed on
  malformed lead history. PR #197 replaces request-path DDL with an exact
  versioned migration manifest, read-only runtime readiness checks, and an
  explicitly local/test-only migration simulator. Each typed profile/kind
  snapshot head and its entries are atomically replaced; reviewer-owned mutable
  fields remain outside snapshot payloads and are joined through a bounded
  allowlisted overlay. The shared published-artifact JSON reader is byte,
  cardinality, depth, and structure bounded, but still has no application-level
  read deadline. The simulator requires the explicit local/test marker and
  refuses unmarked/ordinary bindings; policy forbids using it with remote D1.
  These changes are local/test and
  repository evidence only: `productionReady:false`; staging and production
  remain `HOLD`; no deploy, remote D1 action, staging/production endpoint call,
  production logs/secrets, customer/private data access, CRM/outreach, LLM, or
  automation was performed.
  PR #196 remediated the scoped publishing characterization and PR #197
  remediated the scoped legacy D1 migration/current-history snapshot
  characterizations. PRs #199-#201 subsequently remediated all 18 remaining
  Worker outbound network/SSRF, protected reviewer PWA cache, and concurrent
  PATCH/callback characterization TODOs; the characterization baseline itself
  remains only local/test evidence.
- Post-PR203 local hardening addendum: `master` includes PR #198's post-PR197
  source-of-truth sync at `4ec9e58d8da760653ffb50148c4f59cfbc58e5fa`,
  PR #199's Worker outbound HTTP/SSRF hardening at
  `4a9054badf329023950747394e96f7aa7634d23b`, PR #200's protected reviewer
  PWA cache hardening at `5d9208234bd07d57044a433a558aa0e12bf62f8b`,
  PR #201's Lead PATCH compare-and-swap and monotonic callback hardening at
  `88fa3ba7bbcd12b95e97ef45c7bb9ccb73e50eb1`, PR #202's typed atomic
  publication and notification-safe baseline at
  `a180e751ecd7ee98cedcbd146beaf99d90c88904`, and PR #203's follow-up at
  `19ca3d31c771bd59ae89699f930737a43311b93f`. The current local/test contract
  validates every outbound hop before bounded reads, keeps protected reviewer
  HTML network-only and `private, no-store`, serializes lead mutations through
  `version` / `expectedVersion`, absorbs stale or duplicate callbacks, publishes
  one manifest-selected immutable artifact generation, pushes the exact
  validated Git commit, and starts notification only after verified remote
  reachability. These PRs are repository/local/test evidence only; they do not
  approve or perform production/staging deploy, remote D1 access or migration,
  production endpoint/log/secret access, customer/private data use, real email
  or callbacks, CRM/outreach/LLM automation, or production-readiness claims.
  Issue #165 remains `HOLD`, and `productionReady:false` remains required.
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
- Current Manual Review Notes v1 production proof plan approval-intent record: Issue #118 comment `https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4496285404` authorizes only a docs-only production proof plan. It does not approve runtime/UI/schema/API changes, production proof execution, production deploy, production D1 migration/access/write, production endpoint calls, production logs/secrets, production smoke tests, customer data access/mutation, production access-control implementation, real auth/session/identity, manager visibility, export expansion, retention/privacy enforcement, automated PII detection/redaction, or generated suggestion persistence/export/history/attribution.
- Current Manual Review Notes v1 production D1 migration plan approval record: Issue #118 comment `https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4497697004` authorizes only a docs-only production D1 migration plan. It does not approve runtime/UI/schema/API changes, migration file creation, production D1 schema observation, production D1 migration/access/write, Wrangler production commands, production proof execution, production deploy, production endpoint calls, production logs/secrets, production smoke tests, customer data access/mutation, production access-control implementation, real auth/session/identity, manager visibility, export expansion, retention/privacy enforcement, automated PII detection/redaction, or generated suggestion persistence/export/history/attribution.
- Current Manual Review Notes v1 production rollback/backout plan approval-intent record: Issue #118 comment `https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4497893786` authorizes only a docs-only production rollback/backout plan. It does not approve runtime/UI/schema/API changes, executable rollback or migration files, rollback execution, production proof execution, production deploy, production D1 schema observation/migration/access/write/delete, Wrangler production commands, production endpoint calls, production logs/secrets, production smoke tests, customer data access/mutation, production access-control implementation, real auth/session/identity, manager visibility, export expansion, retention/privacy enforcement, automated PII detection/redaction, purge/delete jobs, destructive data action, or generated suggestion persistence/history/export/attribution.
- Current Manual Review Notes v1 local/staging dry-run plan approval-intent record: Issue #118 comment `https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4498372572` authorizes only a docs-only local/staging dry-run plan. It does not approve staging execution, production execution, production D1 access/schema observation/migration/write/delete, Wrangler production commands, production endpoint calls, production logs/secrets, production smoke tests, production proof execution, production deploy, runtime/UI/schema/API behavior changes, executable migration or rollback files, real auth/session/identity, production access-control implementation, manager visibility, export/API expansion, retention/privacy enforcement, purge/delete jobs, redaction, automated PII detection, destructive data action, customer data access/mutation, or generated suggestion persistence/history/export/attribution.
- Current Manual Review Notes v1 local/fake-D1 dry-run execution approval record: Issue #118 comment `https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4503369057` authorizes only local/fake-D1 execution and docs-only evidence capture. The evidence packet is `docs/roadmap/manual-review-notes-v1-local-fake-d1-dry-run-evidence.md`. Treat it as local-only evidence, not staging or production proof.
- Current Manual Review Notes v1 staging target decision packet approval record: Issue #118 comment `https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4503509007` authorizes only a docs-only staging target decision packet. It makes staging target selection decision-ready but does not select a target or approve staging execution, staging D1 access, staging endpoint calls, staging logs/secrets, production proof/deploy, production D1 schema observation/migration/access/write/delete, production endpoints, production logs/secrets, production smoke tests, customer data, runtime/UI/schema/API changes, executable migration or rollback files, or generated suggestion persistence/history/export/attribution.
- Current Manual Review Notes v1 non-production cycle closeout approval record: Issue #118 comment `https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4503631245` authorizes only the docs-only cycle closeout packet. It marks local/test Manual Notes v1 complete, separates completed local evidence from blocked staging/production work, and leaves the repo in stable HOLD with no mandatory next action.
- Current Manual Review Notes v1 feedback record 001 disposition approval/comment record: Issue #144 comment `https://github.com/dooosp/b2b-lead-agent/issues/144#issuecomment-4503911395` records only a docs-only disposition of `MRN-V1-FEEDBACK-001`. The feedback source is `https://github.com/dooosp/b2b-lead-agent/issues/144#issuecomment-4503838503`, classification is P3/docs/no-follow-up, feedback collected is YES/RECORDED, and `NEXT_MANDATORY_ACTION: NONE`, staging HOLD, and production HOLD remain.
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
- Manual Review Notes v1 Production Proof Plan: `docs/roadmap/manual-review-notes-v1-production-proof-plan.md` maps production proof prerequisites, local/staging dry-run checks, production D1 migration-readiness checks, rollback/backout gates, access-control gates, retention/privacy gates, generated-suggestion exclusion proof requirements, observability boundaries, evidence/anti-overclaim rules, and explicit future approval blocks. It is docs-only and does not authorize production proof execution or any production action.
- Manual Review Notes v1 Production D1 Migration Plan: `docs/roadmap/manual-review-notes-v1-production-d1-migration-plan.md` maps schema inventory, migration ordering, nullable/backfill behavior, metadata-only history migration requirements, compatibility checks, local/staging rehearsal, rollback/backout planning, generated-suggestion exclusion, access/privacy/retention gates, evidence boundaries, and explicit approval blocks. It is docs-only and does not authorize production D1 schema observation, migration, access, write, proof execution, deploy, or any production action.
- Manual Review Notes v1 Production Rollback / Backout Plan: `docs/roadmap/manual-review-notes-v1-production-rollback-backout-plan.md` maps rollback scenarios, partial migration handling, nullable column backout semantics, metadata-only history backout, no-destructive-data rules, local/staging rehearsal, generated-suggestion rollback exclusions, access/privacy/retention gates, evidence boundaries, and explicit production execution approval blocks. It is docs-only and does not authorize production rollback, production D1 access/write/delete/schema observation, Wrangler production commands, production proof, deploy, or any production action.
- Manual Review Notes v1 Local / Staging Dry-Run Plan: `docs/roadmap/manual-review-notes-v1-staging-dry-run-plan.md` maps dry-run scenarios, preflight checks, local fake-D1 rehearsal, migration-readiness rehearsal, rollback/backout rehearsal, C2 role-stub rehearsal, generated-suggestion exclusion checks, privacy/retention checks, staging-like target requirements, evidence/anti-overclaim rules, and explicit execution approval blocks. It is docs-only and does not authorize staging execution, production execution, production D1 access/schema observation/migration/write/delete, Wrangler production commands, production endpoints, production logs/secrets, production smoke tests, production proof, deploy, executable migration/rollback files, runtime/UI/schema/API changes, or any production action.
- Manual Review Notes v1 Staging Target Decision Packet: `docs/roadmap/manual-review-notes-v1-staging-target-decision-packet.md` defines safe non-production staging target requirements, invalid target conditions, S0-S5 options, credential/data/D1/fixture/command/evidence boundaries, generated-suggestion exclusion checks, privacy/retention/access gates, and future approval blocks. It is docs-only and does not authorize staging execution, staging D1 access, staging endpoint calls, staging logs/secrets access, production action, customer data, runtime/UI/schema/API changes, executable migration/rollback files, or generated suggestion persistence/history/export/attribution.
- Manual Review Notes v1 Non-Production Cycle Closeout: `docs/roadmap/manual-review-notes-v1-non-production-cycle-closeout.md` is the final docs-only local/test cycle closeout. It records `MANUAL_REVIEW_NOTES_V1_NON_PRODUCTION_CYCLE: SHIP`, local/test implementation complete, local fake-D1 evidence complete, staging target decision-ready/HOLD, staging execution HOLD, production proof/deploy HOLD, and `NEXT_MANDATORY_ACTION: NONE`.
- Manual Review Notes v1 Reviewer Feedback Intake: `docs/roadmap/manual-review-notes-v1-reviewer-feedback-intake.md` now records feedback collected as YES for `MRN-V1-FEEDBACK-001`, with disposition RECORDED, severity P3, observation type docs, no separate follow-up, staging HOLD, production HOLD, and `NEXT_MANDATORY_ACTION: NONE`.
- Manual Review Notes v1 Feedback Record 001 Disposition: `docs/roadmap/manual-review-notes-v1-feedback-record-001-disposition.md` records the first human reviewer feedback item and its no-follow-up docs-only disposition. It does not approve runtime/UI/schema/API changes, staging execution, production action, manager visibility/export/API expansion, access-control implementation, retention/privacy enforcement, real reviewer identity, or generated suggestion persistence/history/export/attribution.
- Do not reopen those findings unless you can point to a current-`master` regression or a newly verified gap.
- Treat closed PRs #1-#9, #10, #22, and #23 as stale/superseded concept inventory unless explicitly re-scoped on top of current `master`.
- Current non-production documentation goal: Manual Review Notes v1 local/test cycle is closed and first human feedback record `MRN-V1-FEEDBACK-001` is collected/recorded as P3/docs/no-follow-up. Local/test implementation is complete, local/fake-D1 evidence exists, staging target selection is decision-ready but execution remains HOLD, staging and production work are separate future approval-gated cycles, and there is no mandatory next action. Manual Review Notes edit means saving a changed human-entered value, clear/delete means confirmed clearing of that saved value, `manualReviewNotesUpdatedAt` means the last accepted human-entered manual note change/save/clear event, and `manualReviewNotesAuthorLabel` remains the fixed non-PII `manual_reviewer` label only. Metadata history stores create/edit/clear event metadata only in `manual_review_note_events`; old manual note values are not retained in history. Lead-level `updatedAt` / `updated_at` remains lead-level only and must not be labeled as a manual-note timestamp. The static privacy warning is local/test guidance only and does not create production compliance evidence. Staging execution, staging D1 access, staging endpoint calls, staging logs/secrets access, local/fake-D1 dry-run execution beyond ordinary docs-only PR validation, C3 reviewer-only controls, C4 reviewer plus manager roles, C5 authenticated production role controls, production rollback execution, destructive production data action, production proof execution, production D1 migration/access/write/delete/schema observation, production endpoint calls, production logs/secrets, production deploy, customer data access/mutation, production access-control implementation, auth/session implementation, manager visibility expansion, export expansion, retention/privacy enforcement, purge/delete jobs, redaction, automated PII detection, full note history, old note value retention, outcome learning, CRM/outreach/analytics/LLM, and manager dashboard v1 remain separately scoped unless a future approval selects them.

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
- Reviewer Workflow Intelligence v1 is local/test-safe only. `reviewerFeedback` is explicit human-entered reviewer feedback stored in `reviewer_feedback` with fixed non-PII `manual_reviewer` attribution and metadata-only `reviewer_feedback_events` history. It follows the same C2 local/test role-stub protection as manual notes. `GET /api/leads` may expose additive `reviewerWorkflowSummary` and `dataGapPrioritization` metadata, but all such evidence is `NOT_PRODUCTION_EVIDENCE` and `productionReady:false`. Generated reviewer suggestions remain copy-only and must not be saved, sent, attributed, history-stored, exported, or mixed into reviewer feedback.
- Reviewer Workflow Boundary Audit v1 is local/test-safe only. `npm run check:reviewer-workflow-boundary` emits `tmp/codex/reviewer-workflow-boundary-audit-non-production.json` and checks reviewer feedback freeform redaction plus CSV, publication, denied-role summary, and prioritization boundaries. It is `NOT_PRODUCTION_EVIDENCE`, keeps `productionReady:false`, and does not approve production/staging proof, production D1, real auth/session, retention/privacy enforcement, or generated suggestion persistence/export/history/attribution.
- Managed/self-service upserts preserve existing `review_status` on conflict so refreshes do not erase human review decisions.
- CSV, browser UI, self-service copy, and downloads must preserve review/trust metadata.
- All Worker request paths must remain DDL-free. On D1-backed access paths,
  `ensureD1Schema()` performs a read-only exact-version cold-binding readiness
  check; schema drift or missing migrations fail closed, and only success is
  cached per binding. Only the explicitly marked local/test simulator may apply
  the checked-in manifest. It requires the explicit local/test marker and
  refuses unmarked/ordinary bindings; policy forbids using it with remote D1.
  Any staging or
  production schema change requires a separately approved, versioned Wrangler
  migration-files/command workflow, target inventory, rollback owner, and stop
  conditions. No production migration or schema observation is claimed.
- Production deploy and production DB writes were not performed during PR #25,
  PR #26, PR #27, or the shipped PR #36-#203
  local/test/docs/reviewer-UX/product-planning/proof-gate train.

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
- `npm run check:schema` for canonical D1 schema/DDL plus immutable migration,
  statement, and manifest-binding fingerprints;
  it does not inspect or migrate remote D1
- `npm run test:root` for root pipeline coverage only
- `npm run test:unit` for worker unit coverage only
- `npm run test:contract` for worker trigger and contract coverage only
- `npm run test:worker` for the combined worker gate (`test:unit` + `test:contract`)
- `npm run proof:level1:change-control-manifest` for the local-only Level 1 change-control manifest dry-run gate
- `npm run proof:level1:operator-rehearsal` for the local-only Level 1 operator rehearsal runbook gate
- `npm run proof:level1:closure-dashboard` for the local-only Level 1 closure dashboard JSON/Markdown artifact writer
- `npm run proof:level1:approval-intake` for the local-only Level 1 Issue #165 approval-intake template/validator artifact writer
- `npm run proof:level1:post-approval-simulator` for the local-only Level 1 Issue #165 post-approval HOLD/BLOCKED/READY simulator artifact writer
- `npm run check:enrichment-boundary` for the local-only outbound HTTP enrichment boundary guard
- `npm run check:enrichment-replay` for the local-only root enrichment fixture replay output contract
- `npm run check:lead-pipeline-replay` for the local-only root lead pipeline fixture replay artifact contract
- `npm run check:level1` for the local-only Level 1 auth/route/privacy/proof/preflight/approval/change-control/operator-rehearsal/closure-dashboard/approval-intake/post-approval-simulator regression gate
- `npm run eval:lead-quality` for synthetic-only LeadBrief quality and review-readiness checks
- `npm run test:e2e:local` for fake-D1, loopback-only Worker route/page smoke coverage
- `npm test` for the root gate plus the combined worker gate
