# Next Product Track Decision Packet

This packet compares the safest next product tracks after the reviewer workflow
and standing approval policy landed. It is a planning and source-of-truth
document only; it does not implement product behavior, change schema, access
production, or make a human business decision.

## Current Baseline

- Repository: `dooosp/b2b-lead-agent`
- Default branch: `master`
- Current source-of-truth `origin/master`: `db2a69a7b92502bec3183b94bf0d728e1312a121` (PR #107)
- Standing approval policy: `docs/standing-approval-policy.md`
- Reviewer workflow baseline: `docs/reviewer-workflow-final-audit.md`
- Human UX intake baseline: `docs/reviewer-workflow-human-ux-review.md`
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
| Manager/reviewer summary | High. Turns the shipped reviewer workflow into a quick queue-health and handoff view. | Yes, if scoped to existing local/test-safe data only. | Could drift into manager dashboard, assignments, forecasting, or new API/storage if scope is not bounded. | Add a local/test-safe summary surface from current `/api/leads` payload and existing queue/action metadata only; no schema, persistence, production query, CRM ownership, or outreach. |
| Saved review notes | High, but changes the product contract around what is saved and by whom. | Not yet for persistence. | Requires data model, retention, privacy, edit history, conflict, and UX decisions. Generated note suggestions must remain distinct from manual operator notes. | Create a persistence design packet first, or add only clearer docs/copy around existing manual notes and non-persisted suggestions. |
| Outcome learning | Medium to high long term. Could improve prioritization after real review outcomes exist. | Not yet. | Needs outcome definitions, labels, ownership, data source, and guardrails against CRM-like lifecycle expansion. | Document outcome taxonomy candidates using local fixtures only; do not implement learning or feedback loops. |
| Production observation | Operational confidence, not a product feature. | No, unless separately approved. | Requires production owners, exact commands, evidence policy, redaction, rollback, and explicit approval. | Keep Issue #34 closed; prepare only a new approval packet if a human requests production proof. |

## Recommended Next Track

The best next implementation candidate is a local/test-safe
manager/reviewer summary v0, but only after it is selected as its own scoped
goal. It has the highest product value with the lowest implementation risk
because it can reuse existing LeadBrief, Reviewer Action Queue, Lead Review
Session, gate-state, risk, missing-info, and review-status data.

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

This packet does not choose the track on behalf of a human product owner. It
records a safe engineering recommendation that can be accepted, replaced, or
rejected in a later scoped goal.

## Tracks Not Ready Without Separate Decision

Saved generated reviewer-note persistence is not ready without a product/data
decision. A future packet should answer:

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

