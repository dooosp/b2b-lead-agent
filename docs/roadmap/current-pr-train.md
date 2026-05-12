# Current PR Train And Open PR Synthesis

This document summarizes the May 2026 PR train, stale PR disposition, and next work queue for `dooosp/b2b-lead-agent`.

Evidence baseline:

- Repo default branch: `master`
- Current pinned `origin/master`: `5a13e2c2941853b6f7a799c432d5f03d349191af`
- Evidence collected from GitHub PR/issue metadata, PR bodies, current `AGENTS.md`, `HARDENING_PLAN.md`, `NEXT_SESSION_PROMPT.md`, and `docs/architecture/*.md`
- Scope: documentation synthesis only
- Production actions performed for this synthesis: none

## May 11 PR Train

PRs #36 through #43 are already merged into `master`. PR #51 then integrated PRs #44 through #49. PRs #52 through #61 refreshed repo state and shipped the first review-quality follow-ups. Together they established the current post-LeadBrief baseline: Worker routes are split into `worker/routes/*`, LeadBrief trust data is preserved across the data path, schema drift has a local/CI guard, release evidence tooling is local-only, architecture docs are refreshed, stale module alias wrappers are removed, Opportunity Workbench v1 is shipped, advisory next-review guidance is available, `/leads` review queue filters and evidence/data-gap slices are shipped, Solution Translation Summary is shipped, Product Context / Signal Fusion is shipped, Stakeholder Prep is available as Workbench-only advisory guidance, local-only Worker E2E is available, Worker auth/error boundaries are hardened, and synthetic lead-quality evaluation is available.

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
| Current follow-up | Advisory roleplay stakeholder context | Old PR #6's remaining roleplay idea is recut into advisory prompt context from the selected LeadBrief without outreach approval, CRM ownership, schema, storage, or production expansion. |

## Immediate Merge Queue

No open PRs remain after PR #61. PRs #44-#49 are merged through #51, PRs #52-#61 are merged into `master`, and old PRs #1-#9 are closed without merge after disposition comments.

## Old PR Disposition

These PRs are closed without merge. Treat them as concept inventory unless explicitly recut from current `master`.

| PR | Current status | Disposition |
| --- | --- | --- |
| [#1](https://github.com/dooosp/b2b-lead-agent/pull/1) Signal fusion and product knowledge foundation | Closed, conflicted | Useful product-context and signal-fusion concept was recut by PR #57. Do not merge the old branch. |
| [#2](https://github.com/dooosp/b2b-lead-agent/pull/2) Solution translation outputs | Closed, stacked on #1 | Useful "why this solution" / "why now" concept was recut by PR #55. Do not merge the old branch because it predates the current LeadBrief, route, and trust baseline. |
| [#3](https://github.com/dooosp/b2b-lead-agent/pull/3) Dashboard intelligence views | Closed, stacked | Useful review queue filtering concept was recut by PR #54, and the remaining evidence/data-gap review-slice concept was recut by PR #61 from current `master`. |
| [#4](https://github.com/dooosp/b2b-lead-agent/pull/4) Win-loss learning foundation | Closed, stacked | Deprioritize until review quality is proven; avoid CRM-like lifecycle expansion for now. |
| [#5](https://github.com/dooosp/b2b-lead-agent/pull/5) Next-best-action and deal risk signals | Closed, stacked | Useful next-review guidance concept was recut by PR #53. Do not merge the old stacked branch. |
| [#6](https://github.com/dooosp/b2b-lead-agent/pull/6) Stakeholder persuasion flows | Closed, stacked | Useful stakeholder-prep concept was recut as Workbench advisory guidance, and the roleplay context extension is being recut from current `master` as advisory practice only. |
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
