# Current PR Train And Open PR Synthesis

This document summarizes the May 2026 PR train, stale PR disposition, and next work queue for `dooosp/b2b-lead-agent`.

Evidence baseline:

- Repo default branch: `master`
- Latest audited source-of-truth `origin/master`: `747b77a657a1af626e0a50d2804baf4ce566e1e5` (PR #102)
- Evidence collected from GitHub PR/issue metadata, PR bodies, current `AGENTS.md`, `HARDENING_PLAN.md`, `NEXT_SESSION_PROMPT.md`, and `docs/architecture/*.md`
- Scope: documentation synthesis only
- Production actions performed for this synthesis: none

## May 11 PR Train

PRs #36 through #43 are already merged into `master`. PR #51 then integrated PRs #44 through #49. PRs #52 through #84 refreshed repo state and shipped the first review-quality follow-ups. PR #87 added Lead Action Intelligence v1, PR #88 added Reviewer Action Queue v1.1, PR #89 added Lead Review Session v1, PR #90 added Reviewer Notes Template v1, PR #91 added Reviewer Productivity Toolkit v1 for `/leads`, PR #92 added Lead Detail Workbench Productivity Parity v1, PR #93 hardened reviewer workflow QA/accessibility, PR #94 shipped reviewer workflow roving keyboard behavior and semantic accessibility snapshot coverage, PR #95 added the Reviewer Workflow Final Audit & Demo Packet, PR #96 and PR #97 synced source-of-truth docs, PR #98 clarified final audit/demo rehearsal on newer heads, PR #99 added the Human UX Review Packet, PR #101 fixed Issue #100 copy/label findings, and PR #102 shipped the selected Issue #100 summary affordances. Together they established the current post-LeadBrief baseline: Worker routes are split into `worker/routes/*`, LeadBrief trust data is preserved across the data path, schema drift has a local/CI guard, release evidence tooling is local-only, architecture docs are refreshed, stale module alias wrappers are removed, Opportunity Workbench v1 is shipped with deterministic review-gate guidance, advisory next-review guidance is available, `/leads` review queue filters, evidence/data-gap slices, gate-state counts, Kanban gate chips, Reviewer Action Queue lanes, queue filters, compact action summaries, Lead Review Session progress/next-lead/quick-action flow, deterministic reviewer note templates, reviewer productivity copy/manual-copy controls on list and detail, non-mutating shortcuts, browser-memory session/current-page activity, accessible labels/live regions/mobile overflow smoke, roving tablist focus behavior, local semantic reviewer workflow snapshots, `리드 리뷰 큐` heading copy, non-duplicated `사람 검토: ...` review labels, compact top `다음 리뷰` strip above filters, short reviewer-note summaries above full deterministic copy payloads, and filter empty-state recovery are shipped, Solution Translation Summary is shipped, Product Context / Signal Fusion is shipped, Stakeholder Prep is available as Workbench-only advisory guidance, roleplay can consume advisory stakeholder context, Validate Naming uses Node 24-compatible GitHub Actions versions, non-production check workflows use lockfile-backed `npm ci`, local-only Worker E2E is available as a local and CI smoke gate, Worker auth/error boundaries are hardened, synthetic lead-quality evaluation is available as a local and CI quality gate, and Workbench plus list-level review gates summarize/filter readiness and blockers from existing LeadBrief fields only. `docs/reviewer-workflow-final-audit.md` is the canonical local/test-safe reviewer workflow audit and demo packet; `docs/reviewer-workflow-human-ux-review.md` is the local/test-safe UX intake packet; neither is production observation evidence.

| Actual merge order | PR | Merged at UTC | Role | Roadmap implication |
| --- | --- | --- | --- | --- |
| 1 | [#39](https://github.com/dooosp/b2b-lead-agent/pull/39) Add D1 schema drift consistency checks | 2026-05-11T07:04:58Z | Schema hardening | Keep `npm run check:schema` in CI and future schema work. Use it as local drift evidence only, not production D1 proof. |
| 2 | [#37](https://github.com/dooosp/b2b-lead-agent/pull/37) Harden LeadBrief data path contracts | 2026-05-11T07:06:58Z | Data-path hardening | Treat LeadBrief trust/review fields as the canonical review data path for product work. |
| 3 | [#41](https://github.com/dooosp/b2b-lead-agent/pull/41) Add release evidence packet toolkit | 2026-05-11T07:07:43Z | Release tooling | Use local redacted evidence packets for release reviews, with production observation claims held outside the tool. |
| 4 | [#36](https://github.com/dooosp/b2b-lead-agent/pull/36) Refactor Worker route dispatch and route inventory | 2026-05-11T07:07:57Z | Route architecture | Route ownership now lives in `worker/routes/*`; route, auth, D1, and external side effects should be maintained through the route inventory. |
| 5 | [#38](https://github.com/dooosp/b2b-lead-agent/pull/38) Refactor test helpers and route contracts | 2026-05-11T07:11:20Z | Test architecture | Prefer shared root fixtures, Worker HTTP helpers, and fake D1 helpers for future tests. |
| 6 | [#40](https://github.com/dooosp/b2b-lead-agent/pull/40) Improve lead review UX metadata | 2026-05-11T07:14:10Z | Product UX | Lead list/detail pages now show review/trust metadata more clearly; future UX should build on those fields. |
| 7 | [#42](https://github.com/dooosp/b2b-lead-agent/pull/42) Add architecture map docs | 2026-05-11T07:14:51Z | Architecture docs | Keep route and data-path docs updated with runtime changes. |
| 8 | [#43](https://github.com/dooosp/b2b-lead-agent/pull/43) Clean up unused module aliases | 2026-05-11T07:17:02Z | Cleanup/naming | Canonical module paths are the shipped baseline; do not revive alias-wrapper surfaces. |
| 9 | [#51](https://github.com/dooosp/b2b-lead-agent/pull/51) Integrate post-train PRs #44-#49 | 2026-05-11T13:08:16Z | Integration | Treat #44-#49 as shipped through current `master`; do not manage them as separate queue items. |

## Post-PR51 Follow-Ups

| PR | Role | Roadmap implication |
| --- | --- | --- |
| [#52](https://github.com/dooosp/b2b-lead-agent/pull/52) | Post-merge repo audit | Current source-of-truth docs and roadmap were refreshed after PR #51 and stale PR cleanup. |
| [#53](https://github.com/dooosp/b2b-lead-agent/pull/53) | Advisory next-review guidance | Old PR #5's useful next-action idea was recut as deterministic Workbench guidance without CRM ownership. |
| [#54](https://github.com/dooosp/b2b-lead-agent/pull/54) | Review queue filters | Old PR #3's useful review filtering idea was recut into cached `/leads` filters without API/query/schema changes. |
| [#55](https://github.com/dooosp/b2b-lead-agent/pull/55) | Solution Translation Summary | Old PR #2's useful solution-translation idea was recut into Workbench "why this solution" and "why now" guidance. |
| [#56](https://github.com/dooosp/b2b-lead-agent/pull/56) | Post-PR55 doc sync | Source-of-truth docs were synced to the merged PR #55 state. |
| [#57](https://github.com/dooosp/b2b-lead-agent/pull/57) | Product Context / Signal Fusion | Old PR #1's useful context-fusion idea was recut into Workbench guidance without schema, API, storage, or CRM expansion. |
| [#58](https://github.com/dooosp/b2b-lead-agent/pull/58) | Post-PR57 doc sync | Source-of-truth docs were synced after Product Context / Signal Fusion landed. |
| [#59](https://github.com/dooosp/b2b-lead-agent/pull/59) | Stakeholder Prep | Old PR #6's useful stakeholder-prep idea was recut into Workbench guidance without roleplay API, schema, storage, production, or CRM expansion. |
| [#60](https://github.com/dooosp/b2b-lead-agent/pull/60) | Post-PR59 doc sync | Source-of-truth docs were synced after Stakeholder Prep landed. |
| [#61](https://github.com/dooosp/b2b-lead-agent/pull/61) | Evidence/data-gap review slices | Old PR #3's remaining dashboard-intelligence idea was recut into cached `/leads` review helper guidance without API, schema, storage, production, or CRM expansion. |
| [#62](https://github.com/dooosp/b2b-lead-agent/pull/62) | Post-PR61 doc sync | Source-of-truth docs were synced after evidence/data-gap review slices landed. |
| [#63](https://github.com/dooosp/b2b-lead-agent/pull/63) | Advisory roleplay stakeholder context | Old PR #6's remaining roleplay idea was recut into advisory prompt context from the selected LeadBrief without outreach approval, CRM ownership, schema, storage, or production expansion. |
| [#64](https://github.com/dooosp/b2b-lead-agent/pull/64) | Post-PR63 doc sync | Source-of-truth docs were synced after advisory roleplay stakeholder context landed. |
| [#65](https://github.com/dooosp/b2b-lead-agent/pull/65) | Validate Naming workflow maintenance | Validate Naming now uses Node 24-compatible GitHub Actions versions, and workflow contract tests cover that workflow. |
| [#66](https://github.com/dooosp/b2b-lead-agent/pull/66) | Post-PR65 doc sync | Source-of-truth docs were synced after Validate Naming workflow maintenance landed. |
| [#67](https://github.com/dooosp/b2b-lead-agent/pull/67) | Check workflow deterministic installs | CI and Validate Naming now use lockfile-backed `npm ci`, with workflow contract tests covering the check-workflow install policy. |
| [#68](https://github.com/dooosp/b2b-lead-agent/pull/68) | Post-PR67 doc sync | Source-of-truth docs were synced after deterministic check-workflow installs landed. |
| [#69](https://github.com/dooosp/b2b-lead-agent/pull/69) | Production-boundary doc refresh | Source-of-truth docs were refreshed after PR #68 while retaining the no-production-action boundary. |
| [#70](https://github.com/dooosp/b2b-lead-agent/pull/70) | Lead-quality CI gate | The synthetic lead-quality evaluator now runs in CI as local-only quality evidence. |
| [#71](https://github.com/dooosp/b2b-lead-agent/pull/71) | Local E2E CI gate | The fake-D1, loopback-only Worker E2E smoke now runs in CI with deterministic Playwright Chromium setup. |
| [#72](https://github.com/dooosp/b2b-lead-agent/pull/72) | Workbench review gate | Opportunity Workbench now renders deterministic review-gate readiness from existing LeadBrief review, verification, confidence, evidence, source, and data-gap fields. |
| [#73](https://github.com/dooosp/b2b-lead-agent/pull/73) | Post-PR72 doc sync | Source-of-truth docs were synced after the Workbench review gate landed. |
| [#74](https://github.com/dooosp/b2b-lead-agent/pull/74) | Lead-list review gate | `/leads` cards now render deterministic review-gate readiness from existing LeadBrief review, verification, confidence, evidence, source, and data-gap fields. |
| [#75](https://github.com/dooosp/b2b-lead-agent/pull/75) | Post-PR74 doc sync | Source-of-truth docs were synced after the lead-list review gate landed. |
| [#76](https://github.com/dooosp/b2b-lead-agent/pull/76) | Lead-list gate filter | `/leads` review queue filters now include deterministic list-level review-gate state without API, schema, storage, CRM, production query, or outreach-approval expansion. |
| [#77](https://github.com/dooosp/b2b-lead-agent/pull/77) | Post-PR76 doc sync | Source-of-truth docs were synced after the lead-list gate filter landed. |
| [#78](https://github.com/dooosp/b2b-lead-agent/pull/78) | Post-PR76 hardening doc refresh | Remaining hardening/source-of-truth docs were refreshed without approving production action. |
| [#79](https://github.com/dooosp/b2b-lead-agent/pull/79) | Lead-list gate summary | `/leads` now summarizes ready/review/blocked/hold gate-state counts for the current filtered queue. |
| [#80](https://github.com/dooosp/b2b-lead-agent/pull/80) | Kanban gate labels | `/leads` Kanban cards now show deterministic list-gate labels from existing LeadBrief fields. |
| [#81](https://github.com/dooosp/b2b-lead-agent/pull/81) | Kanban gate-state chips | Kanban gate labels now render as state-specific chips without API, schema, storage, CRM, production query, or outreach-approval expansion. |
| [#82](https://github.com/dooosp/b2b-lead-agent/pull/82) | Post-PR81 doc sync | Source-of-truth docs were synced after the Kanban gate-state chip landed. |
| [#83](https://github.com/dooosp/b2b-lead-agent/pull/83) | Kanban filter empty state | Kanban now shows a visible zero-result filter empty state instead of only empty columns. |
| [#84](https://github.com/dooosp/b2b-lead-agent/pull/84) | Filter empty-state reset | List and Kanban filter empty states now include an in-place reset action. |
| [#87](https://github.com/dooosp/b2b-lead-agent/pull/87) | Lead Action Intelligence v1 | Deterministic next-review guidance, risk flags, missing-info prompts, stakeholder angle, suggested follow-up draft, review priority, and action confidence are derived from existing LeadBrief fields only. |
| [#88](https://github.com/dooosp/b2b-lead-agent/pull/88) | Reviewer Action Queue v1.1 | `/api/leads` includes additive queue metadata; `/leads` renders deterministic action lanes, filters, sorting, compact summaries, Kanban action labels, and local fake-D1 E2E coverage. |
| [#89](https://github.com/dooosp/b2b-lead-agent/pull/89) | Lead Review Session v1 | `/leads` renders current-filter review progress, remaining lane counts, next-lead focus, quick `APPROVED` / `NEEDS_REVIEW` actions, bounded failure UI, queue refresh after mutation, and local fake-D1 E2E coverage while preserving sales `status` separately from human `reviewStatus`. |
| [#90](https://github.com/dooosp/b2b-lead-agent/pull/90) | Reviewer Notes Template v1 | Lead Action Intelligence, Reviewer Action Queue, Lead Review Session, and Opportunity Workbench expose deterministic read-only reviewer note templates without persistence, schema, production, LLM, external-call, CRM ownership, or auto-send behavior. |
| [#91](https://github.com/dooosp/b2b-lead-agent/pull/91) | Reviewer Productivity Toolkit v1 | `/leads` adds visible copy/manual-copy note controls, optional non-mutating keyboard shortcuts, shortcut help, and browser-memory session activity using existing note/session outputs only; no persistence, localStorage, analytics, schema, production, external call, or keyboard-triggered review mutation is introduced. |
| [#92](https://github.com/dooosp/b2b-lead-agent/pull/92) | Lead Detail Workbench Productivity Parity v1 | Lead detail mirrors the safe `/leads` productivity affordances into Opportunity Workbench with deterministic note copy controls, manual-copy fallback, non-mutating `c`/`w`/`n`/`j`/`?` shortcuts, shortcut help, and browser-memory current-page activity feedback; no persistence, schema, production endpoint, D1, external call, or keyboard-triggered review mutation is introduced. |
| [#93](https://github.com/dooosp/b2b-lead-agent/pull/93) | Reviewer Workflow QA & Accessibility Hardening v1 | Hardens the shipped list/detail reviewer workflow with accessible tab semantics, clearer copy/status-control labels, bounded live-region feedback, interactive-control shortcut guards, focus-visible/mobile wrapping improvements, and local E2E mobile overflow coverage without schema, persistence, production, external calls, analytics, or keyboard-triggered review mutation. |
| [#94](https://github.com/dooosp/b2b-lead-agent/pull/94) | Reviewer Workflow Roving Keyboard & Accessibility Snapshot Gate v1 | Shipped vertical tablist roving focus with Up/Down, Left/Right focus aliases, Home/End, and Enter/Space activation for the `/leads` list/Kanban tablist plus local semantic snapshots for `/leads` reviewer regions, zero-result reset controls, and lead-detail Opportunity Workbench markers. It keeps review shortcuts non-mutating, preserves explicit-only `reviewStatus` mutation and sales `status` separation, and avoids schema, persistence, production, external calls, analytics, and screenshot-only proof. |
| [#95](https://github.com/dooosp/b2b-lead-agent/pull/95) | Reviewer Workflow Final Audit & Demo Packet | Added `docs/reviewer-workflow-final-audit.md` as the canonical local/test-safe reviewer workflow audit/demo packet, including demo flow, validation commands, allowed/forbidden claims, note-persistence wording, and production evidence boundaries. |
| [#96](https://github.com/dooosp/b2b-lead-agent/pull/96) | Roadmap/current-train source-of-truth sync | Synced roadmap/current-train and production-proof boundary docs after the final audit packet without production action. |
| [#97](https://github.com/dooosp/b2b-lead-agent/pull/97) | Post-PR96 source-of-truth sync | Synced root and roadmap source-of-truth docs to the post-PR96 baseline without production action. |
| [#98](https://github.com/dooosp/b2b-lead-agent/pull/98) | Reviewer workflow demo rehearsal clarification | Clarified that the final audit/demo packet preserves the original audit baseline while later rehearsals report current branch, HEAD, open PR state, and validation separately. |
| [#99](https://github.com/dooosp/b2b-lead-agent/pull/99) | Human UX Review Packet | Added `docs/reviewer-workflow-human-ux-review.md` as a local/test-safe checklist and feedback intake packet for real human UX findings. |
| [#101](https://github.com/dooosp/b2b-lead-agent/pull/101) | Issue #100 copy/label fixes | Addressed UX-100-002 and UX-100-003 by changing the `/leads` heading to `리드 리뷰 큐` and rendering non-duplicated `사람 검토: ...` labels while preserving sales `status` vs human `reviewStatus` separation. |
| [#102](https://github.com/dooosp/b2b-lead-agent/pull/102) | Issue #100 summary affordances | Addressed UX-100-001 and UX-100-004 with a compact top `다음 리뷰` strip above filters and short reviewer-note summaries above full deterministic copy payloads. Issue #100 is closed as completed for the recorded local/test-safe findings. |

## Immediate Merge Queue

No open PRs were present at preflight after PR #102 and Issue #100 closeout. PRs #44-#49 are merged through #51, PRs #52-#84, PRs #87-#99, and PRs #101-#102 are merged into `master`, Issue #100 is closed as completed for the recorded local/test-safe UX findings, and old PRs #1-#9 are closed without merge after disposition comments. There is no current branch candidate in the merge queue. New work should start from current `master`; production proof, saved notes persistence, manager dashboards, outcome learning, schema migration, and persistence work require a separate selected scope and approval boundary.

## Old PR Disposition

These PRs are closed without merge. Treat them as concept inventory unless explicitly recut from current `master`.

| PR | Current status | Disposition |
| --- | --- | --- |
| [#1](https://github.com/dooosp/b2b-lead-agent/pull/1) Signal fusion and product knowledge foundation | Closed, conflicted | Useful product-context and signal-fusion concept was recut by PR #57. Do not merge the old branch. |
| [#2](https://github.com/dooosp/b2b-lead-agent/pull/2) Solution translation outputs | Closed, stacked on #1 | Useful "why this solution" / "why now" concept was recut by PR #55. Do not merge the old branch because it predates the current LeadBrief, route, and trust baseline. |
| [#3](https://github.com/dooosp/b2b-lead-agent/pull/3) Dashboard intelligence views | Closed, stacked | Useful review queue filtering concept was recut by PR #54, and the remaining evidence/data-gap review-slice concept was recut by PR #61 from current `master`. |
| [#4](https://github.com/dooosp/b2b-lead-agent/pull/4) Win-loss learning foundation | Closed, stacked | Deprioritize until review quality is proven; avoid CRM-like lifecycle expansion for now. |
| [#5](https://github.com/dooosp/b2b-lead-agent/pull/5) Next-best-action and deal risk signals | Closed, stacked | Useful next-review guidance concept was recut by PR #53. Do not merge the old stacked branch. |
| [#6](https://github.com/dooosp/b2b-lead-agent/pull/6) Stakeholder persuasion flows | Closed, stacked | Useful stakeholder-prep concept was recut as Workbench advisory guidance, and the roleplay context extension was recut by PR #63 from current `master` as advisory practice only. |
| [#7](https://github.com/dooosp/b2b-lead-agent/pull/7) Scout role modules | Closed, conflicted/obsolete | Abandon as a merge candidate. #43 already cleaned canonical module paths; revive only with a fresh modularization goal. |
| [#8](https://github.com/dooosp/b2b-lead-agent/pull/8) Staged GCP runtime/storage migration | Closed, conflicted and approval-blocked | Hold as platform-migration concept inventory only. Requires explicit migration decision, secret readiness, and fresh validation. |
| [#9](https://github.com/dooosp/b2b-lead-agent/pull/9) Local-first storage seam for GCP migration | Closed, conflicted | Hold as architecture archaeology only. Recut local-first/env-gated storage only with current artifact names and dependency justification. |
| [#23](https://github.com/dooosp/b2b-lead-agent/pull/23) Dashboard unauthorized UX | Closed, superseded | Superseded by #48 through #51. |

## Abandoned Or Superseded Ideas

- Directly merging March stacked feature PRs #1-#6.
- Reviving the old scout alias/refactor branch #7 without a fresh canonical-path design.
- Treating #8 or #9 as the current deployment/storage path.
- Expanding the frozen `crm.published-report.v1` internal contract as part of review UX work.
- Treating docs, CI, local tests, schema source files, or release evidence packets as production observation evidence.
