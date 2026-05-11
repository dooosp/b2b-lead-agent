# Product Roadmap V1

This roadmap turns the current PR train, old branch archaeology, Issue #34 proof learnings, and product boundaries into a prioritized backlog.

Current baseline:

- `master` includes PRs #36-#43, PR #51's integration of #44-#49, the post-merge roadmap audit in PR #52, advisory next-review-action guidance in PR #53, and review queue filters in PR #54 at `b6607a82126db04597875b555d9249c4f9787853`.
- The canonical product unit is a LeadBrief-style lead with source, trust, confidence, assumptions, data gaps, and human `reviewStatus`.
- Opportunity Workbench includes deterministic, advisory next-review-action reasons, a human review checklist, and a Solution Translation Summary derived from evidence gaps, confidence, verification, generation mode, review state, product, signal, and why-now rationale.
- The `/leads` review queue can filter cached LeadBriefs by review status, verification status, generation mode, confidence, and data-gap presence without adding CRM ownership or production query behavior.
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

No open PRs remain after PR #51 and stale PR #1-#9 disposition. New work should start from current `master`, not from old stacked branches.

Each new PR should rerun `npm run check:naming`, `git diff --check`, and `npm test` before it exits draft or merges. If package scripts or route/auth behavior change, also run the focused command for that surface.

## Next Product Features

| Priority | Feature | Source | Scope |
| --- | --- | --- | --- |
| Shipped | Review queue filters | Current LeadBrief baseline plus Workbench | Filter cached `/leads` rows by `reviewStatus`, `verificationStatus`, generation mode, data gaps, and confidence. Avoid full CRM ownership concepts. |
| Shipped | Solution translation summary | Old #2 concept, recut | Explain "why this solution" and "why now" inside LeadBrief/Workbench, sourced from existing product, signal, why-now, evidence, and review state. |
| P2 | Product context and signal fusion | Old #1 concept, recut | Add bounded product/signal context only where it improves LeadBrief review quality. Avoid broad schema expansion until scoped. |
| P2 | Stakeholder-specific prep | Old #6 concept, recut | Roleplay/helper guidance for economic buyer, technical evaluator, operator, procurement, sponsor, and champion. Not approval automation. |

## Hardening Backlog

| Priority | Item | Why |
| --- | --- | --- |
| P0 | Preserve PR #46 auth/error boundaries | Auth and error disclosure boundaries must continue to lead product expansion. |
| P0 | Keep `npm run check:schema` in CI and local release gates | It guards drift between `worker/schema.sql`, `worker/db/schema.js`, and expected D1 lead columns. |
| P0 | Use route inventory for every route change | PR #36 made route metadata the source for route boundary reasoning. |
| P1 | Use #45 local E2E harness in review-flow PRs | It gives future UX changes a local route/page safety net without production endpoint calls. |
| P1 | Use #47 synthetic quality evaluator in product PRs | Quality checks should catch evidence gaps before UX makes weak leads look authoritative. |
| P1 | Keep old closed PRs as concept inventory only | #1-#9 and #23 are closed; recut useful ideas from current `master` instead of reopening old branches. |
| P2 | Refresh root source-of-truth docs after major merges | `AGENTS.md`, `HARDENING_PLAN.md`, `NEXT_SESSION_PROMPT.md`, and `docs/architecture/*.md` should track shipped reality. |

## Production Approval Backlog

None of these are implementation tasks. They are approval-gated operational tasks.

| Priority | Item | Required before action |
| --- | --- | --- |
| P0 | Refresh Issue #34 approval baseline for current `master` | Current `master` moved from Issue #34's approved SHA `12d44374a24a9958de179fae5f9311621606ad24` to `a3f44df58bb231b060ff42fa13b17ad573b1cc1a`. |
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
