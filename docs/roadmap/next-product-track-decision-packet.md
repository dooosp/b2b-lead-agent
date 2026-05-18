# Next Product Track Decision Packet

This packet compared the safest next product tracks after the reviewer workflow
and standing approval policy landed. It is a planning and source-of-truth
document only; it does not implement product behavior, change schema, access
production, or make a human business decision.

## Current Baseline

- Repository: `dooosp/b2b-lead-agent`
- Default branch: `master`
- Current source-of-truth `origin/master`: `c928f910f307a783f934842d777df666b9267a86` (PR #114)
- Standing approval policy: `docs/standing-approval-policy.md`
- Reviewer workflow baseline: `docs/reviewer-workflow-final-audit.md`
- Human UX intake baseline: `docs/reviewer-workflow-human-ux-review.md`
- Manager / Reviewer Summary v0: shipped by PR #109 as the `/leads`
  `리뷰 요약` panel from existing filtered leads, Reviewer Action Queue / Lead
  Review Session metadata, and LeadBrief fields only.
- PR #110: synced source-of-truth docs after PR #109.
- PR #112: added the Saved Review Notes Decision Packet.
- Issue #113: selected `OPTION_E` and is closed as completed.
- PR #114: shipped copy-only generated reviewer note suggestion clarification
  for `/leads`, Opportunity Workbench, tests, and related docs. Generated
  suggestions are helper text only: copy-only, not saved, not sent, and not
  human-authored saved notes.
- Issue #111: Manager / Reviewer Summary v0 UX Findings Intake is closed as
  completed.
- Issue #100: closed as completed for the recorded local/test-safe reviewer
  workflow UX findings.
- Issue #34: closed as completed after GitHub-only closeout; future production
  action still requires a separate explicit production approval record.

Production action performed for this packet: none.

## Decision Criteria

Use these criteria before selecting the next product track:

- Product value for a human reviewer or manager.
- Engineering value and confidence.
- Ability to use existing LeadBrief, reviewer workflow, and queue data.
- Local-only validation path with fake-D1 or fixture-backed tests.
- Reviewability as a small PR.
- No dependency on production D1, production endpoints, logs, secrets, or
  production observation claims.
- No schema, API, or persistence expansion unless that expansion is the
  explicitly selected scope.
- Clear separation from CRM ownership, assignments, forecasting, outreach, and
  automatic send behavior.

## Candidate Tracks

| Track | Product value | Ready for implementation? | Primary risks | Safe first slice |
| --- | --- | --- | --- | --- |
| Manager/reviewer summary | High. Turns the shipped reviewer workflow into a quick queue-health and handoff view. | Shipped through PR #109 for v0; Issue #111 completed the v0 UX intake. | Could drift into manager dashboard, assignments, forecasting, or new API/storage if v1 scope is not bounded. | Do not expand to summary v1 until a new scoped UX finding or product decision is recorded. |
| Saved review notes | High, but changes the product contract around what is saved and by whom. | Not yet for persistence. Issue #113 selected Option E only for copy-only generated suggestions. | Requires data model, retention, privacy, edit history, conflict, and UX decisions before any persistence. Generated note suggestions must remain distinct from manual operator notes. | Use `docs/roadmap/saved-review-notes-decision-packet.md` as the Option E record; collect UX findings in Issue #115 before any further saved-notes work. |
| Outcome learning | Medium to high long term. Could improve prioritization after real review outcomes exist. | Not yet. | Needs outcome definitions, labels, ownership, data source, and guardrails against CRM-like lifecycle expansion. | Document outcome taxonomy candidates using local fixtures only; do not implement learning or feedback loops. |
| Production observation | Operational confidence, not a product feature. | No, unless separately approved. | Requires production owners, exact commands, evidence policy, redaction, rollback, and explicit approval. | Keep Issue #34 closed; prepare only a new approval packet if a human requests production proof. |

## Recommended Next Track

The recommended local/test-safe manager/reviewer summary v0 track was selected
and shipped through PR #109. It reused existing LeadBrief, Reviewer Action
Queue, Lead Review Session, gate-state, risk, missing-info, and review-status
data.

Recommended v0 boundaries:

- Use existing `/api/leads` response data and current deterministic queue/action
  metadata only.
- Summarize queue health, review readiness, top blockers, priority lanes, and
  next local review focus.
- Keep it advisory and reviewer-facing; do not create assignments, ownership,
  forecasts, notifications, comments, or CRM state.
- Do not add schema, D1 columns, persistence, new production queries, external
  calls, analytics, LLM calls, or outreach.
- Validate with local unit tests and fake-D1 E2E if UI behavior changes.

PR #109 satisfied this v0 recommendation as a compact `/leads` `리뷰 요약`
panel showing current filtered view count, review-status distribution,
Reviewer Action Queue lane counts, top blockers, next review focus, readiness
summary, and advisory boundary text.

Issue #111 completed the Manager / Reviewer Summary v0 UX findings intake. PR
#112 added the Saved Review Notes Decision Packet, Issue #113 selected Option E,
PR #114 shipped copy-only wording clarification only, Issue #115 closed its UX
intake, PR #119 added the Option A manual note plan, and PR #120 implemented
local/test-safe human-entered manual notes. Do not implement generated
suggestion persistence, new note schema/storage, manager-dashboard expansion,
outcome learning, production observation, or summary v1 behavior from this
packet alone.

## Tracks Not Ready Without Separate Decision

Saved generated reviewer-note persistence is not ready. The selected Option E
boundary keeps generated suggestions copy-only; it does not authorize saved
notes. The Saved Review Notes Decision Packet still records the questions that
must be answered before any persistence implementation:

- What exactly is persisted: generated suggestion, edited reviewer note,
  manual note, or review decision rationale?
- Who can edit or delete it?
- How is generated suggestion text distinguished from human-entered text?
- What retention and privacy expectations apply?
- How does it avoid overwriting existing manual notes?
- Which local tests prove the behavior without production D1 access?

Outcome learning is not ready without an outcome taxonomy and source-of-truth
decision. A future packet should answer:

- Which outcomes are tracked.
- Whether outcomes come from reviewer labels, sales status, external systems,
  or manual import.
- How false feedback loops are avoided.
- Whether it remains advisory or changes prioritization behavior.

Production observation is not ready without a new production approval prompt.
Issue #34 closeout does not authorize additional production execution.

## Validation Expectations For Future Work

For docs-only follow-ups:

- `git diff --check`
- `npm run check:naming`

For product UI or reviewer-flow follow-ups:

- `git diff --check`
- `npm run check:naming`
- `npm run eval:lead-quality`
- `npm test`
- `npm run test:e2e:local`

For schema or data-contract follow-ups, also run:

- `npm run check:schema`

Do not run production E2E, deploy commands, Wrangler commands, production D1
commands, production endpoint calls, production logs/secrets reads, or
production smoke tests from this packet.
