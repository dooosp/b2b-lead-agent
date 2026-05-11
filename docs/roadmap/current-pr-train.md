# Current PR Train And Open PR Synthesis

This document summarizes the May 2026 PR train, old open PR disposition, and the next merge queue for `dooosp/b2b-lead-agent`.

Evidence baseline:

- Repo default branch: `master`
- Current pinned `origin/master`: `22672f8d0bb363e5d02f085a5d98e3b463113e68`
- Evidence collected from GitHub PR/issue metadata, PR bodies, current `AGENTS.md`, `HARDENING_PLAN.md`, `NEXT_SESSION_PROMPT.md`, and `docs/architecture/*.md`
- Scope: documentation synthesis only
- Production actions performed for this synthesis: none

## May 11 PR Train

PRs #36 through #43 are already merged into `master`. The train established the current post-LeadBrief baseline: Worker routes are split into `worker/routes/*`, LeadBrief trust data is preserved across the data path, schema drift has a local/CI guard, release evidence tooling is local-only, architecture docs are refreshed, and stale module alias wrappers are removed.

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

## Immediate Merge Queue

The named PR train is complete. Current open draft PRs discovered after the train affect the next queue:

| Priority | PR | Decision | Rationale |
| --- | --- | --- | --- |
| 1 | [#46](https://github.com/dooosp/b2b-lead-agent/pull/46) Worker auth and error boundaries | Review first, then merge if validations still pass | Security/auth boundaries should land before more user-facing expansion. It hardens protected route method handling, internal token preference, and 5xx response sanitization. |
| 2 | [#48](https://github.com/dooosp/b2b-lead-agent/pull/48) Supersede dashboard unauthorized UX | Merge after #46 or after conflict check | Small current-`master` replacement for old PR #23. Retires a stale PR without carrying old preflight artifacts. |
| 3 | [#45](https://github.com/dooosp/b2b-lead-agent/pull/45) Local Worker E2E harness | Merge before larger UX work | Gives a local-only `worker.fetch()` E2E smoke harness and non-loopback fetch guard for future product/UI changes. |
| 4 | [#47](https://github.com/dooosp/b2b-lead-agent/pull/47) Lead quality evaluation harness | Merge before old concept salvage | Adds synthetic-only scoring for evidence completeness, assumptions, data gaps, review readiness, and stale/conflicting signals. |
| 5 | [#44](https://github.com/dooosp/b2b-lead-agent/pull/44) Opportunity Workbench lead review UI | Merge after verification harness and product review | First real product UX step on top of LeadBrief v1. It should remain a review aid using existing fields only, with no schema/API/CRM expansion. |

## Old Open PR Disposition

These PRs should not be merged as-is. Treat them as concept inventory unless explicitly recut from current `master`.

| PR | Current status | Disposition |
| --- | --- | --- |
| [#2](https://github.com/dooosp/b2b-lead-agent/pull/2) Solution translation outputs | Open, stacked on `codex/pr1-3-foundation` | Salvage the idea later as a LeadBrief/Workbench field or helper. Do not merge the old branch because it predates the current LeadBrief, route, and trust baseline. |
| [#5](https://github.com/dooosp/b2b-lead-agent/pull/5) Next-best-action and deal risk signals | Open, stacked on #6 | Salvage as deterministic review guidance after the evaluation harness exists. Do not merge the old stacked branch. |
| [#6](https://github.com/dooosp/b2b-lead-agent/pull/6) Stakeholder persuasion flows | Open, stacked on #2 | Salvage as a roleplay/helper feature only after Workbench v1. Keep it clearly non-approval and human-reviewed. |
| [#7](https://github.com/dooosp/b2b-lead-agent/pull/7) Scout role modules | Open, conflicts/obsolete | Abandon as a merge candidate. #43 already cleaned canonical module paths; revive only with a fresh modularization goal. |
| [#8](https://github.com/dooosp/b2b-lead-agent/pull/8) Staged GCP runtime/storage migration | Open, stale and production-blocked | Hold. Requires explicit platform migration decision, real secret readiness, and fresh non-prod/live validation. Not part of current product roadmap. |
| [#9](https://github.com/dooosp/b2b-lead-agent/pull/9) Local-first storage seam for GCP migration | Open, stale | Hold as architecture archaeology only. Do not add Google Cloud SDK/runtime surface unless platform migration is re-approved. |
| [#23](https://github.com/dooosp/b2b-lead-agent/pull/23) Dashboard unauthorized UX | Open, stale | Superseded by #48. Close after #48 lands. |

Related old stack context: PRs #1, #3, and #4 are also still open in GitHub and belong to the same stale March feature stack. They were outside the requested old-PR review list, but they should follow the same rule: do not merge as-is; recut only if a current product owner re-scopes the idea on top of current `master`.

## Abandoned Or Superseded Ideas

- Directly merging March stacked feature PRs #2, #5, and #6.
- Reviving the old scout alias/refactor branch #7 without a fresh canonical-path design.
- Treating #8 or #9 as the current deployment/storage path.
- Expanding the frozen `crm.published-report.v1` internal contract as part of review UX work.
- Treating docs, CI, local tests, schema source files, or release evidence packets as production observation evidence.
