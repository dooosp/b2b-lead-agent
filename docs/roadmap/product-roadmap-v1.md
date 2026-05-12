# Product Roadmap V1

This roadmap turns the current PR train, old branch archaeology, Issue #34 proof learnings, and product boundaries into a prioritized backlog.

Current baseline:

- `master` includes PRs #36-#43, PR #51's integration of #44-#49, and review-quality follow-ups plus CI maintenance through PR #72 at audited pre-refresh baseline `dd6ae06f67741c5e59cd6d18afb745f0180914ff`.
- The canonical product unit is a LeadBrief-style lead with source, trust, confidence, assumptions, data gaps, and human `reviewStatus`.
- Opportunity Workbench includes deterministic, advisory next-review-action reasons, a review gate, a human review checklist, a Solution Translation Summary, Product Context / Signal Fusion, and Stakeholder Prep guidance derived from existing product, event, buyer, evidence, enrichment, and review fields.
- `/roleplay` can consume selected LeadBrief stakeholder context as conversation-practice guidance without approving outreach or becoming the canonical source of truth.
- The `/leads` review queue can filter cached LeadBriefs by review status, verification status, generation mode, confidence, and data-gap presence, can summarize evidence/data-gap review slices, and can surface deterministic list-level review-gate states without adding CRM ownership or production query behavior.
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

No open PRs remain after PR #72 and stale PR #1-#9 disposition. New work should start from current `master`, not from old stacked branches.

Each new PR should rerun `npm run check:naming`, `git diff --check`, and `npm test` before it exits draft or merges. Product/review-quality changes should also run `npm run eval:lead-quality`, and review-flow changes should run `npm run test:e2e:local`; CI runs both as local-only gates.

## Next Product Features

| Priority | Feature | Source | Scope |
| --- | --- | --- | --- |
| Shipped | Review gate | Current LeadBrief baseline plus Workbench | Summarize readiness and blockers in Workbench and `/leads` cards from existing review, verification, confidence, evidence, source, and data-gap fields without approving outreach. |
| Shipped | Review queue filters | Current LeadBrief baseline plus Workbench | Filter cached `/leads` rows by `reviewStatus`, `verificationStatus`, generation mode, data gaps, and confidence. Avoid full CRM ownership concepts. |
| Shipped | Solution translation summary | Old #2 concept, recut | Explain "why this solution" and "why now" inside LeadBrief/Workbench, sourced from existing product, signal, why-now, evidence, and review state. |
| Shipped | Product context and signal fusion | Old #1 concept, recut | Fuse existing product, event type, buyer role, buying signals, pain points, and key figures inside LeadBrief/Workbench. Avoid broad schema expansion. |
| Shipped | Stakeholder-specific prep | Old #6 concept, recut | Workbench helper guidance for economic buyer, technical evaluator, operator, procurement, sponsor, and champion. Not approval automation. |
| Shipped | Evidence/data-gap review slices | Old #3 remaining concept, recut | Summarize missing evidence, data-gap density, and review-ready leads on the cached `/leads` queue without creating CRM ownership, assignments, notifications, or production query changes. |
| Shipped | Advisory roleplay stakeholder context | Old #6 remaining concept, recut | Let roleplay consume stakeholder prep context as human-reviewed conversation practice without approving outreach or changing the canonical LeadBrief source of truth. |

## Hardening Backlog

| Priority | Item | Why |
| --- | --- | --- |
| P0 | Preserve PR #46 auth/error boundaries | Auth and error disclosure boundaries must continue to lead product expansion. |
| P0 | Keep `npm run check:schema` in CI and local release gates | It guards drift between `worker/schema.sql`, `worker/db/schema.js`, and expected D1 lead columns. |
| P0 | Use route inventory for every route change | PR #36 made route metadata the source for route boundary reasoning. |
| P1 | Keep #45 local E2E harness in CI and review-flow PRs | It gives future UX changes a local route/page safety net without production endpoint calls. |
| P1 | Keep #47 synthetic quality evaluator in CI and product PRs | Quality checks should catch evidence gaps before UX makes weak leads look authoritative. |
| P1 | Keep old closed PRs as concept inventory only | #1-#9 and #23 are closed; recut useful ideas from current `master` instead of reopening old branches. |
| P2 | Refresh root source-of-truth docs after major merges | `AGENTS.md`, `HARDENING_PLAN.md`, `NEXT_SESSION_PROMPT.md`, and `docs/architecture/*.md` should track shipped reality. |

## Production Approval Backlog

None of these are implementation tasks. They are approval-gated operational tasks.

| Priority | Item | Required before action |
| --- | --- | --- |
| P0 | Refresh Issue #34 approval baseline for current `master` | The audited pre-refresh `master` baseline moved from Issue #34's approved SHA `12d44374a24a9958de179fae5f9311621606ad24` to `dd6ae06f67741c5e59cd6d18afb745f0180914ff`; refresh the actual current SHA before any production request. |
| P0 | Confirm deploy owner, DB owner, rollback owner, observation owner | GitHub repo ownership is not production ownership. |
| P0 | Confirm evidence storage and redaction policy | Production evidence must not include secrets, auth headers, cookies, private URLs, customer payloads, PII, or unredacted production payloads. |
| P1 | Approve one D1-backed read/schema proof | Requires explicit production DB access/lazy-DDL approval if the path may invoke `ensureD1Schema()`. |
| P1 | Approve one safe row/action for row serialization proof | Requires real owner-approved row/action and production write approval; do not toggle state only to manufacture evidence. |
| P1 | Approve production observation claim separately | Even successful deploy, schema proof, or row roundtrip does not automatically authorize an observation claim. |

## Drop Or Deprioritize

- Directly merging old stacked March PRs #1-#6.
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
