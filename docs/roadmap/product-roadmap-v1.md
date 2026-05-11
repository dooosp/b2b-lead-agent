# Product Roadmap V1

This roadmap turns the current PR train, old branch archaeology, Issue #34 proof learnings, and product boundaries into a prioritized backlog.

Current baseline:

- `master` includes PRs #36-#43 at `22672f8d0bb363e5d02f085a5d98e3b463113e68`.
- The canonical product unit is a LeadBrief-style lead with source, trust, confidence, assumptions, data gaps, and human `reviewStatus`.
- The product is a B2B lead discovery, briefing, and human-review aid.
- It is not a CRM replacement, automatic salesperson, proposal generator source of truth, or PPT-first product.
- Production deploy, production D1 access, production D1 writes, Worker endpoint calls, and production observation claims remain separate human-approved operations.

## Product Direction

The strongest next product path is a review-quality workbench around LeadBrief v1, not a broad CRM or platform migration. The system should help an operator decide whether a lead is credible, what evidence supports it, what is missing, and what the next reviewed action should be.

The near-term product spine:

1. Preserve trust boundaries and auth safety.
2. Improve local verification and lead-quality scoring.
3. Make LeadBrief review faster and more explicit in the UI.
4. Reintroduce useful old concepts only as reviewed LeadBrief/Workbench guidance.
5. Hold production proof and platform migration behind explicit approval gates.

## Immediate Merge Queue

1. [#46](https://github.com/dooosp/b2b-lead-agent/pull/46) Worker auth and error boundaries.
2. [#48](https://github.com/dooosp/b2b-lead-agent/pull/48) Current-master dashboard unauthorized UX replacement for #23.
3. [#45](https://github.com/dooosp/b2b-lead-agent/pull/45) Local Worker E2E harness.
4. [#47](https://github.com/dooosp/b2b-lead-agent/pull/47) Synthetic lead quality evaluation harness.
5. [#44](https://github.com/dooosp/b2b-lead-agent/pull/44) Opportunity Workbench v1.

Each PR should rerun `npm run check:naming`, `git diff --check`, and `npm test` before it exits draft or merges. If package scripts or route/auth behavior changed earlier in the queue, rebase and rerun the full gate.

## Next Product Features

| Priority | Feature | Source | Scope |
| --- | --- | --- | --- |
| P0 | Opportunity Workbench v1 | #44 plus #40 | Review-focused lead detail surface using existing LeadBrief fields only. No schema, CRM, or production contract expansion. |
| P0 | Local E2E smoke for review flows | #45 | Local-only route/page smoke coverage for `/leads`, `/leads/:id`, dashboard auth recovery, and Workbench render paths. |
| P1 | Lead quality score and hold reasons | #47 | Synthetic-only evaluator first; later use as PR/release quality gate without production input ingestion. |
| P1 | Deterministic next review action | Old #5 concept, recut | Suggest human-reviewed actions from evidence gaps, confidence, status, and review state. Keep it advisory. |
| P1 | Solution translation summary | Old #2 concept, recut | Explain "why this solution" and "why now" inside LeadBrief/Workbench, sourced from existing profile/product context and evidence. |
| P2 | Stakeholder-specific prep | Old #6 concept, recut | Roleplay/helper guidance for economic buyer, technical evaluator, operator, procurement, sponsor, and champion. Not approval automation. |
| P2 | Review queue filters | Current LeadBrief baseline | Filter by `reviewStatus`, `verificationStatus`, generation mode, data gaps, and confidence. Avoid full CRM ownership concepts. |

## Hardening Backlog

| Priority | Item | Why |
| --- | --- | --- |
| P0 | Land #46 after careful review | Auth and error disclosure boundaries must lead product expansion. |
| P0 | Keep `npm run check:schema` in CI and local release gates | It guards drift between `worker/schema.sql`, `worker/db/schema.js`, and expected D1 lead columns. |
| P0 | Use route inventory for every route change | PR #36 made route metadata the source for route boundary reasoning. |
| P1 | Land #45 local E2E harness | It gives future UX changes a local route/page safety net without production endpoint calls. |
| P1 | Use #47 synthetic quality evaluator in product PRs | Quality checks should catch evidence gaps before UX makes weak leads look authoritative. |
| P1 | Close or supersede old open PRs | #23 should close after #48. #2/#5/#6/#7/#8/#9 should be closed or relabeled as concept inventory after owner review. |
| P2 | Refresh root source-of-truth docs after major merges | `AGENTS.md`, `HARDENING_PLAN.md`, `NEXT_SESSION_PROMPT.md`, and `docs/architecture/*.md` should track shipped reality. |

## Production Approval Backlog

None of these are implementation tasks. They are approval-gated operational tasks.

| Priority | Item | Required before action |
| --- | --- | --- |
| P0 | Refresh Issue #34 approval baseline for current `master` | Current `master` moved from Issue #34's approved SHA `12d44374a24a9958de179fae5f9311621606ad24` to `22672f8d0bb363e5d02f085a5d98e3b463113e68`. |
| P0 | Confirm deploy owner, DB owner, rollback owner, observation owner | GitHub repo ownership is not production ownership. |
| P0 | Confirm evidence storage and redaction policy | Production evidence must not include secrets, auth headers, cookies, private URLs, customer payloads, PII, or unredacted production payloads. |
| P1 | Approve one D1-backed read/schema proof | Requires explicit production DB access/lazy-DDL approval if the path may invoke `ensureD1Schema()`. |
| P1 | Approve one safe row/action for row serialization proof | Requires real owner-approved row/action and production write approval; do not toggle state only to manufacture evidence. |
| P1 | Approve production observation claim separately | Even successful deploy, schema proof, or row roundtrip does not automatically authorize an observation claim. |

## Drop Or Deprioritize

- Directly merging old stacked March PRs #2, #5, and #6.
- Reopening #7 as a merge candidate; #43 already established canonical module cleanup.
- Treating #8/#9 GCP migration as near-term roadmap work. Reopen only with explicit platform migration approval and validation resources.
- Building CRM ownership, assignments, comments, notifications, forecasting, or account hierarchy before review quality is proven.
- Expanding proposal/PPT/CPA/roleplay helpers into the product source of truth.
- Treating Issue #34 schema remediation or `/manifest.json` proof as proof of D1-backed product behavior.

## Definition Of Ready

A roadmap item is ready for implementation when it has:

- A current-`master` branch or draft PR.
- A bounded product surface.
- Explicit product non-goals.
- A local validation plan.
- A production boundary statement.
- No dependency on old stacked PR state.

## Definition Of Done

A roadmap item is done when:

- `npm run check:naming` passes.
- `git diff --check` passes.
- `npm test` passes.
- Any relevant focused test or local E2E command passes.
- Docs are updated when route/data/product boundaries change.
- The final report states whether production action was performed. For this roadmap, it should be "none."
