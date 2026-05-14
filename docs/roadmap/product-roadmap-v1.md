# Product Roadmap V1

This roadmap turns the current PR train, old branch archaeology, Issue #34 proof learnings, and product boundaries into a prioritized backlog.

Current baseline:

- `master` includes PRs #36-#43, PR #51's integration of #44-#49, review-quality follow-ups plus CI maintenance through PR #84, Lead Action Intelligence v1 through PR #87, Reviewer Action Queue v1.1 through PR #88, Lead Review Session v1 through PR #89, Reviewer Notes Template v1 through PR #90, Reviewer Productivity Toolkit v1 through PR #91, and Lead Detail Workbench Productivity Parity v1 through PR #92 at baseline `0d67eeb8dd093f9412d35ee3a44cbc1a4ea801c1`.
- The canonical product unit is a LeadBrief-style lead with source, trust, confidence, assumptions, data gaps, and human `reviewStatus`.
- Opportunity Workbench includes deterministic, advisory next-review-action reasons, a review gate, a human review checklist, reviewer note suggestions, a Solution Translation Summary, Product Context / Signal Fusion, and Stakeholder Prep guidance derived from existing product, event, buyer, evidence, enrichment, and review fields.
- Lead Action Intelligence v1 adds deterministic reviewer guidance for next action, reason, risk flags, missing-info prompts, stakeholder angle, suggested follow-up draft, reviewer note templates, priority, and confidence from existing LeadBrief fields only. Reviewer Action Queue v1.1 turns those outputs into deterministic queue lanes, filters, sorting, compact review summaries, and note suggestions.
- `/roleplay` can consume selected LeadBrief stakeholder context as conversation-practice guidance without approving outreach or becoming the canonical source of truth.
- The `/leads` review queue can filter cached LeadBriefs by review status, verification status, generation mode, confidence, data-gap presence, list-level review-gate state, next action, review priority, action lane, risk flags, and missing-info presence; can summarize Reviewer Action Queue lanes, evidence/data-gap review slices, and gate-state counts; can surface deterministic list-level review-gate states plus Lead Action Intelligence summaries in list cards and Kanban chips; can run a Lead Review Session with current-filter progress, next-lead focus, queue-aware quick review actions, copy-friendly reviewer note templates, non-mutating keyboard shortcuts, browser-memory session activity, and bounded failure recovery; and can recover from zero-result filters with in-place reset actions without adding CRM ownership, storage, schema, production query behavior, analytics, or outreach approval. Lead detail mirrors the same safe copy/manual-copy, shortcut-help, focus, and browser-memory current-page activity affordances inside Opportunity Workbench.
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

No open PRs were present at preflight after PR #92 and stale PR #1-#9 disposition. New work should start from current `master`, not from old stacked branches. Reviewer Workflow QA & Accessibility Hardening v1 is the current non-production branch candidate.

Each new PR should rerun `npm run check:naming`, `git diff --check`, and `npm test` before it exits draft or merges. Product/review-quality changes should also run `npm run eval:lead-quality`, and review-flow changes should run `npm run test:e2e:local`; CI runs both as local-only gates.

## Next Product Features

| Priority | Feature | Source | Scope |
| --- | --- | --- | --- |
| Shipped | Review gate | Current LeadBrief baseline plus Workbench | Summarize readiness and blockers in Workbench and `/leads` cards from existing review, verification, confidence, evidence, source, and data-gap fields without approving outreach. |
| Shipped | Lead Action Intelligence v1 | Current LeadBrief baseline plus review-gate/list/Kanban surfaces | Compute deterministic next action, reason, risk flags, missing-info prompts, stakeholder angle, suggested follow-up draft, priority, and action confidence from existing fields only; surface it in Workbench and compact list/Kanban review cards without schema, storage, production, CRM, or auto-send expansion. |
| Shipped | Reviewer Action Queue v1.1 | Lead Action Intelligence v1 outputs plus cached `/leads` review queue | Add deterministic action lanes, priority sorting, next-action/review-priority/risk/missing-info filters, compact action summaries, and local fake-D1 E2E coverage. Adds only local/test-safe `/api/leads` queue metadata; no schema, storage, production query, CRM ownership, or outreach-approval expansion. |
| Shipped | Lead Review Session v1 | Reviewer Action Queue v1.1 plus existing reviewStatus PATCH flow | Add current-filter session progress, remaining lane counts, next-lead focus, quick `APPROVED`/`NEEDS_REVIEW` review actions, bounded failure handling, queue refresh after mutation, and local fake-D1 E2E coverage while preserving sales `status` separately from human `reviewStatus`. |
| Shipped | Reviewer Notes Template v1 | Lead Action Intelligence v1, Reviewer Action Queue v1.1, and Lead Review Session v1 outputs | Generate deterministic copy-friendly approved, needs-review, and risk/data-gap follow-up note templates from existing LeadBrief/action/session outputs; surface read-only suggestions in Workbench and the session panel without schema, storage, LLM, external calls, production access, CRM ownership, or auto-send behavior. |
| Shipped | Reviewer Productivity Toolkit v1 | Reviewer Notes Template v1 plus Lead Review Session v1 | Add visible copy/manual-copy controls, optional non-mutating keyboard shortcuts, shortcut help, and browser-memory session activity summary for `/leads`; copy only deterministic note text, ignore shortcuts in form controls, keep `reviewStatus` changes explicit, and avoid persistence, localStorage, analytics, schema, production, external calls, or auto-send behavior. |
| Shipped | Lead Detail Workbench Productivity Parity v1 | Reviewer Productivity Toolkit v1 plus Opportunity Workbench | Mirror copy/manual-copy controls, non-mutating detail shortcuts, shortcut help, and browser-memory current-page activity feedback into lead detail; copy only deterministic Workbench note text, ignore shortcuts in form controls, keep `reviewStatus` changes explicit, and avoid persistence, localStorage, sessionStorage, analytics, schema, production, external calls, or auto-send behavior. |
| Current branch | Reviewer Workflow QA & Accessibility Hardening v1 | PR #87-#92 reviewer workflow baseline | Harden `/leads` and lead-detail reviewer flows with accessible tab semantics, clearer copy/status labels, live-region bounded feedback, interactive-control shortcut guards, focus-visible/mobile wrapping improvements, zero-result reset preservation, and local E2E mobile viewport smoke without persistence, schema, production, analytics, external calls, or keyboard-triggered review mutation. |
| Shipped | Review queue filters | Current LeadBrief baseline plus Workbench | Filter cached `/leads` rows by `reviewStatus`, `verificationStatus`, generation mode, data gaps, confidence, and deterministic list-level review-gate state; summarize gate-state counts for the current filtered queue; show the same gate state as Kanban labels/chips; show and recover from zero-result filter states. Avoid full CRM ownership concepts. |
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
| P0 | Refresh Issue #34 approval baseline for current `master` | The audited pre-refresh `master` baseline moved from Issue #34's approved SHA `12d44374a24a9958de179fae5f9311621606ad24` to `0d67eeb8dd093f9412d35ee3a44cbc1a4ea801c1`; refresh the actual current SHA before any production request. |
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
