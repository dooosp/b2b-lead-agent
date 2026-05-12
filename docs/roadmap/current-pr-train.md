# Current PR Train And Open PR Synthesis

This document summarizes the May 2026 PR train, stale PR disposition, and next work queue for `dooosp/b2b-lead-agent`.

Evidence baseline:

- Repo default branch: `master`
- Latest audited pre-refresh `origin/master`: `dd6ae06f67741c5e59cd6d18afb745f0180914ff` (PR #72)
- Evidence collected from GitHub PR/issue metadata, PR bodies, current `AGENTS.md`, `HARDENING_PLAN.md`, `NEXT_SESSION_PROMPT.md`, and `docs/architecture/*.md`
- Scope: documentation synthesis only
- Production actions performed for this synthesis: none

## May 11 PR Train

PRs #36 through #43 are already merged into `master`. PR #51 then integrated PRs #44 through #49. PRs #52 through #72 refreshed repo state and shipped the first review-quality follow-ups. Together they established the current post-LeadBrief baseline: Worker routes are split into `worker/routes/*`, LeadBrief trust data is preserved across the data path, schema drift has a local/CI guard, release evidence tooling is local-only, architecture docs are refreshed, stale module alias wrappers are removed, Opportunity Workbench v1 is shipped with deterministic review-gate guidance, advisory next-review guidance is available, `/leads` review queue filters and evidence/data-gap slices are shipped, Solution Translation Summary is shipped, Product Context / Signal Fusion is shipped, Stakeholder Prep is available as Workbench-only advisory guidance, roleplay can consume advisory stakeholder context, Validate Naming uses Node 24-compatible GitHub Actions versions, non-production check workflows use lockfile-backed `npm ci`, local-only Worker E2E is available as a local and CI smoke gate, Worker auth/error boundaries are hardened, synthetic lead-quality evaluation is available as a local and CI quality gate, and the Workbench review gate summarizes readiness/blockers from existing LeadBrief fields only.

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

## Immediate Merge Queue

No open PRs remain after PR #72. PRs #44-#49 are merged through #51, PRs #52-#72 are merged into `master`, and old PRs #1-#9 are closed without merge after disposition comments.

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
