# 다음 세션 프롬프트

## 현재 기준 상태

- 기준 브랜치: `master`
- 마지막 검증된 post-PR #109 `origin/master` HEAD: `e4c6c409e3274f5d09d3b7f2e8a8c5ac3fc0370e` (`Merge pull request #109 from dooosp/feat/manager-reviewer-summary-v0`)
- 다음 세션도 반드시 `git fetch origin master`와 `git rev-parse origin/master`로 실제 최신 HEAD를 다시 기록한다.
- hardening source of truth: `AGENTS.md`, `HARDENING_PLAN.md`, `docs/architecture/*.md`, `NEXT_SESSION_PROMPT.md`
- LeadBrief v1 merge baseline: `5776d4a` (`[Product] Freeze LeadBrief v1 review contract (#27)`)
- P0 trust-boundary baseline: `95c9d54` (`[P0] Harden trust boundary and fallback lead publication (#25)`)

## 최근 landed PR train

- PR #36 landed Worker route dispatch refactor:
  - `worker/index.js` is now a thin delegate to `worker/routes/dispatcher.js`.
  - Route matching, route inventory, static/page/API dispatch, and response helpers live under `worker/routes/*`.
  - Unknown `/api/*` paths return JSON `404`; known routes with unsupported methods return JSON `405` with `Allow` where route metadata knows allowed methods.
- PR #37 landed LeadBrief data-path hardening:
  - Missing LeadBrief `verificationStatus` now normalizes to conservative mode-based defaults.
  - Trust fields are covered across transforms, D1 row serialization, API serialization, CSV, and PATCH response contracts.
- PR #38 landed test architecture refactor:
  - Shared root fixtures, Worker HTTP helpers, and fake D1 helpers are the preferred test utilities.
  - Route-boundary and schema/default/error tests were consolidated around those helpers.
- PR #39 landed D1 schema drift hardening:
  - `npm run check:schema` verifies consistency between `worker/schema.sql` and `worker/db/schema.js`.
  - CI runs the schema check and synthetic lead-quality evaluation before `npm test`.
- PR #40 landed lead review UX metadata improvements:
  - Lead list/detail pages show review, verification, generation, confidence, evidence, and data-gap metadata more explicitly.
- PR #41 landed local release evidence toolkit:
  - `npm run evidence:packet` and `npm run test:evidence` are local-only tooling.
  - Evidence packet generation does not prove production observation.
- PR #42 landed architecture docs:
  - `docs/architecture/repo-map.md`, `docs/architecture/worker-routes.md`, and `docs/architecture/data-path.md` map the current route/data/release boundaries.
- PR #43 landed dead-code/dependency/naming cleanup:
  - News-fetcher alias wrappers are removed or routed through canonical modules.
  - `scripts/check-naming.js` guards removed alias wrapper names.
  - No package upgrades, production deploys, production DB writes, production DB access, Worker endpoint calls, or production observation claims are part of the train.
- PR #51 integrated post-train PRs #44-#49:
  - #44 Opportunity Workbench v1 is now on `master`, with deterministic review-gate guidance from current LeadBrief fields.
  - #45 local-only Worker E2E harness is now on `master` and runs in CI as a fake-D1/loopback smoke gate.
  - #46 Worker auth/error hardening is now on `master`.
  - #47 synthetic lead-quality evaluation harness is now on `master`.
  - #48 current-master replacement for old dashboard unauthorized UX PR #23 is now on `master`.
  - #49 roadmap synthesis is now on `master`.
- Post-PR51 follow-ups landed:
  - #52 refreshed post-merge repo and roadmap state.
  - #53 added advisory next-review-action reasons and checklist items to Opportunity Workbench.
  - #54 added `/leads` review queue filters for review status, verification status, generation mode, confidence, and data-gap presence.
  - #55 added "why this solution" and "why now" Solution Translation Summary guidance inside Opportunity Workbench without schema, API, CRM ownership, proposal source-of-truth, or production behavior changes.
  - #56 synced source-of-truth docs after PR #55.
  - #57 added Product Context / Signal Fusion guidance inside Opportunity Workbench using only existing product, event, buyer, buying-signal, pain-point, key-figure, evidence, and review fields.
  - #58 synced source-of-truth docs after PR #57.
  - #59 added Workbench Stakeholder Prep, recutting old PR #6 as deterministic, advisory role-specific prep using existing LeadBrief/enrichment fields only.
  - #60 synced source-of-truth docs after PR #59.
  - #61 added evidence/data-gap review slices, recutting old PR #3's remaining dashboard-intelligence idea as local `/leads` review helper guidance without API, schema, storage, production, or CRM expansion.
  - #62 synced source-of-truth docs after PR #61.
  - #63 added advisory roleplay stakeholder context, recutting old PR #6's remaining roleplay idea as selected-LeadBrief prompt context without outreach approval, CRM ownership, schema, storage, production, or source-of-truth expansion.
  - #64 synced source-of-truth docs after PR #63.
  - #65 updated Validate Naming to Node 24-compatible GitHub Actions versions and extended workflow contract coverage for that workflow.
  - #66 synced source-of-truth docs after PR #65.
  - #67 switched non-production check workflows to lockfile-backed `npm ci` installs and extended workflow contract coverage for that policy.
  - #68 synced source-of-truth docs after PR #67.
  - #69 refreshed production-boundary source-of-truth docs after PR #68.
  - #70 added the synthetic lead-quality evaluator to CI as a local-only quality gate.
  - #71 added fake-D1, loopback-only local Worker E2E smoke coverage to CI with deterministic Playwright Chromium setup.
  - #72 added a deterministic Opportunity Workbench review gate from existing LeadBrief review, verification, confidence, evidence, source, and data-gap fields.
  - #73 synced source-of-truth docs after PR #72.
  - #74 added deterministic list-level review-gate summaries to `/leads` cards from existing LeadBrief review, verification, confidence, evidence, source, and data-gap fields.
  - #75 synced source-of-truth docs after PR #74.
  - #76 added deterministic list-level review-gate state filtering to `/leads` without API, schema, storage, CRM ownership, production query, or outreach-approval changes.
  - #77 synced source-of-truth docs after PR #76.
  - #78 refreshed remaining hardening/source-of-truth docs after PR #76 without approving production action.
  - #79 added deterministic gate-state count summaries to `/leads` for the current filtered queue.
  - #80 showed deterministic list-gate labels on Kanban cards.
  - #81 rendered those Kanban gate labels as state-specific chips without API, schema, storage, CRM ownership, production query, or outreach-approval changes.
  - #82 synced source-of-truth docs after PR #81.
  - #83 added a visible Kanban zero-result filter empty state without changing filter semantics.
  - #84 added an in-place reset action to list and Kanban filter empty states.
  - #87 added deterministic Lead Action Intelligence v1 from existing LeadBrief fields only.
  - #88 added deterministic Reviewer Action Queue v1.1, additive `/api/leads` queue metadata, queue lanes, filters, sorting, compact summaries, and local fake-D1 E2E coverage.
  - #89 added Lead Review Session v1 with current-filter progress, lane counts, next-lead focus, quick `APPROVED` / `NEEDS_REVIEW` actions, bounded failure UI, queue refresh after mutation, and local fake-D1 E2E coverage.
  - #90 added deterministic Reviewer Notes Template v1 to Lead Action Intelligence, Reviewer Action Queue, Lead Review Session, and Opportunity Workbench without persistence, schema, production, LLM, external-call, CRM ownership, or auto-send behavior.
  - #91 added `/leads` reviewer productivity copy/manual-copy controls, non-mutating shortcuts, shortcut help, and browser-memory session activity without localStorage, analytics, schema, production, external call, or keyboard-triggered review mutation.
  - #92 added lead-detail Workbench productivity parity with deterministic note copy controls, manual-copy fallback, non-mutating `c`/`w`/`n`/`j`/`?` shortcuts, shortcut help, and browser-memory current-page activity feedback.
  - #93 hardened reviewer workflow QA/accessibility with accessible tab semantics, clearer copy/status-control labels, bounded live-region feedback, interactive-control shortcut guards, focus-visible/mobile wrapping improvements, zero-result reset preservation, reviewStatus/status separation coverage, and local E2E mobile overflow smoke.
  - #94 added reviewer workflow roving tablist keyboard behavior and semantic accessibility snapshots without production, schema, persistence, external-call, analytics, or keyboard-triggered review mutation scope.
  - #95 added the Reviewer Workflow Final Audit & Demo Packet at `docs/reviewer-workflow-final-audit.md`.
  - #96 synced roadmap/current-train and production-proof boundary docs after the final audit packet.
  - #97 synced source-of-truth docs after PR #96.
  - #98 clarified how to rehearse the final audit/demo packet on newer `master` heads while preserving the original audit baseline.
  - #99 added the Human UX Review Checklist and Feedback Intake Packet at `docs/reviewer-workflow-human-ux-review.md`.
  - #101 addressed Issue #100 UX-100-002 and UX-100-003: `/leads` heading `리드 리뷰 큐` and non-duplicated `사람 검토: ...` labels.
  - #102 addressed Issue #100 UX-100-001 and UX-100-004: a compact top `다음 리뷰` strip above filters and short reviewer-note summaries above full deterministic copy payloads.
  - #103 synced source-of-truth docs after Issue #100 closeout.
  - #104 refreshed the production-proof readiness baseline as non-production planning only.
  - #105 added the read-only production proof plan as planning only.
  - #106 added the read-only production proof execution precheck and supported GitHub-only Issue #34 closeout records.
  - #107 added `docs/standing-approval-policy.md` as the standing approval boundary for routine repo/GitHub/docs/local-only work.
  - #109 shipped Manager / Reviewer Summary v0 as a compact `/leads` `리뷰 요약` panel from existing filtered leads, Reviewer Action Queue / Lead Review Session metadata, and LeadBrief fields only.
- Reviewer Workflow Final Audit & Demo Packet lives at `docs/reviewer-workflow-final-audit.md` and is the canonical local/test-safe handoff baseline for completed reviewer workflow demo, validation, allowed/forbidden claims, note-persistence wording, and production evidence boundaries.
- Issue #100 is closed as completed for the recorded local/test-safe Human UX Review findings. Future UX feedback should open a new issue or separately scoped record.
- Issue #34 is closed as completed after GitHub-only closeout. Future production proof requires a new explicit human-approved production prompt.
- Next Product Track Decision Packet lives at `docs/roadmap/next-product-track-decision-packet.md`. It records the post-PR107 track comparison that selected manager/reviewer summary v0 as the safest local/test-safe slice; after PR #109, saved review notes, outcome learning, production observation, and any summary v1 dashboard expansion still require separate scoped decisions.
- Manager / Reviewer Summary v0 feedback should go through a dedicated UX findings intake record before implementation of v1 changes.
- Stale PRs #1-#9 received disposition comments and are closed without merge or branch deletion. Treat their ideas as concept inventory only.

## Production boundary

- Standing approval policy: `docs/standing-approval-policy.md`. Routine repo,
  GitHub, documentation, local validation, fake-D1, loopback-only, and
  non-production work may proceed after repo preflight when the policy's default
  approved conditions are met.
- Issue #34 production proof work is closed out. Do not continue production proof work unless a new human-approved production prompt explicitly opens it.
- `docs/roadmap/next-product-track-decision-packet.md` is the post-PR107 planning packet that supported the PR #109 Manager / Reviewer Summary v0 slice; it does not authorize persistence, schema, manager-dashboard expansion, outcome learning, or production observation by itself.
- CI, docs, source inspection, local fake-D1 tests, and release evidence packets are not production D1 evidence.
- Production deploy, Wrangler deploy, Wrangler D1 execute, production Worker endpoint calls, production DB access, and production writes remain separate human-approved operations.
- The auto-filled production D1 observation confirmation draft remains `DRAFT_NOT_APPROVED` unless a human owner explicitly changes it.

## 검증 기준선

- `npm run check:naming` = canonical path/naming guard
- `npm run check:schema` = local D1 schema drift guard
- `npm run eval:lead-quality` = synthetic-only LeadBrief quality and review-readiness evaluator
- `npm run test:evidence` = release evidence toolkit tests
- `npm run test:unit` = Worker unit coverage
- `npm run test:contract` = Worker contract and trigger coverage
- `npm run test:worker` = combined Worker gate
- `npm run test:e2e:local` = fake-D1, loopback-only Worker route/page smoke harness
- `npm test` = root coverage + combined Worker gate

## 다음 세션 시작 규칙

1. `origin/master` 기준으로 sync하고 repo fingerprint를 다시 확인한다.
2. 먼저 `AGENTS.md`, `HARDENING_PLAN.md`, `NEXT_SESSION_PROMPT.md`, and `docs/architecture/*.md`를 읽는다.
3. 이미 shipped 된 finding을 다시 열지 말고, 현재 `master`에서 재현되는 새 증거나 회귀가 있을 때만 follow-up으로 다룬다.
4. raw branch나 오래된 closed PR은 current `master` 기준 merge-safe artifact로 간주하지 않는다.
5. production deploy/observe/D1 work는 별도 human approval 없이는 시작하지 않는다.

## 바로 붙여 넣을 프롬프트

```text
You are working on dooosp/b2b-lead-agent after the May 11, 2026 PR train, PR #51 integration, post-PR51 review-quality follow-ups through PR #102, source-of-truth and production-proof planning docs through PR #106, the standing approval policy through PR #107, and Manager / Reviewer Summary v0 through PR #109 at `e4c6c409e3274f5d09d3b7f2e8a8c5ac3fc0370e`. Start from a fresh `origin/master` sync and prove the repo root, branch, HEAD SHA, default branch, dirty state, open PR/issue state, and available validation commands before changing code.

Read `AGENTS.md`, `HARDENING_PLAN.md`, `NEXT_SESSION_PROMPT.md`, `docs/reviewer-workflow-final-audit.md`, `docs/reviewer-workflow-human-ux-review.md`, `docs/roadmap/next-product-track-decision-packet.md`, `docs/roadmap/product-roadmap-v1.md`, `docs/roadmap/current-pr-train.md`, `docs/roadmap/production-proof-boundaries.md`, and `docs/architecture/*.md` first.

Treat current `master` as the source of truth: Worker routing is split into `worker/routes/*`, LeadBrief data-path defaults are hardened, D1 schema drift has `npm run check:schema`, release evidence packet tooling is local-only, architecture docs were refreshed, cleanup/naming guards landed, Opportunity Workbench v1 is shipped with deterministic review-gate guidance, review queue filters and list-level review-gate summaries/filtering/counts are shipped, Lead Action Intelligence v1, Reviewer Action Queue v1.1, Lead Review Session v1, Reviewer Notes Template v1, Reviewer Productivity Toolkit v1, lead-detail Workbench productivity parity, reviewer workflow QA/accessibility hardening, roving tablist behavior, semantic accessibility snapshots, `리드 리뷰 큐` heading copy, non-duplicated `사람 검토: ...` labels, compact top `다음 리뷰` strip, short reviewer-note summaries above full deterministic copy payloads, and Manager / Reviewer Summary v0 `/leads` `리뷰 요약` panel are shipped from existing LeadBrief, filtered-lead, queue, and session metadata only.

PR #109 did not add schema, persistence, production queries, CRM ownership, outreach, analytics, LLM calls, or endpoint behavior. Next feedback for the shipped summary surface should go through the Manager / Reviewer Summary v0 UX findings intake before v1 expansion. The final audit/demo packet and Human UX Review Packet are docs-only, Issue #100 is closed as completed for its recorded local/test-safe findings, and Issue #34 is closed as completed after GitHub-only closeout with no further production execution approved. `docs/standing-approval-policy.md` permits routine repo/GitHub/docs/local-only work after preflight, and production-boundary docs retain the no-production-action boundary.

Use `docs/roadmap/next-product-track-decision-packet.md` as the historical post-PR107 decision packet that selected summary v0; do not treat it as approval for saved review notes, persistence, manager-dashboard expansion, outcome learning, or production observation. Old PRs #1-#9 and #23 are closed concept inventory; do not reopen or merge them as-is. Do not reopen shipped findings unless you can show a current-master regression or a newly verified UX issue. Do not deploy, call production Worker endpoints, access or write production D1, run Wrangler deploy/D1 commands, read production logs/secrets, run production smoke tests, or claim production observation without a separate human-approved production prompt.
```
