# Reviewer Workflow Human UX Review Checklist And Feedback Intake Packet

This packet helps a human reviewer evaluate the completed local/test-safe reviewer workflow. It is a UX review guide and feedback intake template only.

This packet is not production proof, not production observation evidence, and not a request to implement a new feature. Use `docs/reviewer-workflow-final-audit.md` as the demo source of truth for the completed reviewer workflow, local validation flow, allowed claims, forbidden claims, note-persistence wording, and production evidence boundary.

## Required Setup

Before starting the review, record this run context in the review notes or PR comment that will hold the feedback:

- Repository: `dooosp/b2b-lead-agent`
- Base branch: current `master`
- Current checkout branch
- Current HEAD SHA
- Current open PR state
- Validation commands run and results
- Whether review used the local fake-D1 harness, a manual loopback viewport, or both
- Confirmation that no production deploy, production D1 access, Wrangler command, production Worker endpoint call, production log read, or secret read was performed

Recommended local/test-safe baseline:

1. Start from current `master`.
2. Read `docs/reviewer-workflow-final-audit.md`.
3. Use `npm run test:e2e:local` as the canonical automated local demo.
4. For manual UX review, use only local loopback or test-safe surfaces. Do not substitute a production Worker URL.
5. Keep UX feedback separate from production evidence. Local tests, fake-D1 E2E, screenshots, docs, PR summaries, and CI are engineering evidence only.

## Review Scenarios

Use these scenarios as the main human walkthrough. Record friction, confusion, missing context, and positive signals as feedback items.

1. Open `/leads` and understand the page purpose.
   - Can a new reviewer tell that the page is for evidence-backed lead review and prioritization?
   - Is it clear that the app is guidance for a human reviewer, not an automatic salesperson or CRM replacement?

2. Switch list and Kanban tabs and test roving keyboard behavior.
   - Use Tab to reach the list/Kanban tablist.
   - Use Up/Down, Left/Right, Home/End, Enter, and Space.
   - Confirm focus movement and activation feel predictable.

3. Inspect Reviewer Action Queue lanes.
   - Review approval candidates, needs evidence, risk review, and low priority.
   - Check whether lane names, counts, and lead placement are understandable without reading code.

4. Use Lead Review Session to identify the next lead.
   - Confirm the current-filter progress, lane counts, next-lead focus, and active filter context are easy to scan.
   - Check whether the "next lead" and "next action" guidance gives enough information to start a review pass.

5. Change `reviewStatus` only through explicit controls.
   - Use only visible `APPROVED` or `NEEDS_REVIEW` review-status actions.
   - Confirm keyboard shortcuts do not mutate `reviewStatus`.
   - Record any wording that makes mutation feel accidental or ambiguous.

6. Verify sales `status` remains conceptually separate from human `reviewStatus`.
   - Confirm reviewer copy and controls do not imply that approval changes pipeline stage, ownership, forecast, outreach, or CRM state.
   - Record any place where `status` and `reviewStatus` feel conflated.

7. Read reviewer note suggestions.
   - Inspect notes in Lead Action Intelligence, Reviewer Action Queue, Lead Review Session, and Opportunity Workbench.
   - Confirm they are useful, deterministic helper text and do not appear auto-saved, auto-sent, or LLM-generated during review.

8. Copy current note and test manual-copy fallback wording when applicable.
   - Use the visible copy controls.
   - If Clipboard API is unavailable or blocked, confirm the manual-copy fallback selects visible note text and gives clear instructions.
   - Check that fallback wording is bounded and does not look like an error that requires engineering support.

9. Use non-mutating shortcuts and shortcut help.
   - On `/leads`, test `n` or `j` for next lead focus, `q` for Reviewer Action Queue focus, `c` for visible session note copy, and `?` for shortcut help.
   - On lead detail, test `w`, `j` or `n`, `c`, and `?`.
   - Confirm shortcuts are helpful, discoverable, and ignored while focus is inside form controls or interactive controls.

10. Apply filters until the zero-result state appears, then reset filters.
    - Use action, risk, missing-info, lane, and `reviewStatus` filters.
    - Confirm the zero-result state explains what happened and the reset control is easy to find.
    - Confirm reset returns the reviewer to a usable queue.

11. Open lead-detail Opportunity Workbench and compare parity.
    - Confirm detail pages provide the same safe productivity affordances: deterministic note copy, manual-copy fallback, non-mutating shortcuts, shortcut help, and current-page activity feedback.
    - Check whether list and detail wording feel like one workflow.

12. Check mobile and wrapping behavior through local test or manual viewport.
    - Use a narrow viewport.
    - Confirm reviewer blocks, controls, chips, notes, and reset actions wrap without horizontal overflow or overlapping text.
    - Record any dense areas that become hard to scan on mobile.

## UX Questions

Answer these after the walkthrough. Short answers are fine, but include examples when the issue is subtle.

- Is the queue understandable without reading code?
- Are lane names intuitive?
- Is "next action" wording clear?
- Are note templates useful and not too verbose?
- Are `reviewStatus` and sales `status` clearly separate?
- Are copy success and manual fallback states understandable?
- Are shortcuts helpful, discoverable, and not distracting?
- Does the page feel too dense for a first-time reviewer?
- Can a new reviewer complete a review pass without help?
- Does the workflow encourage evidence-backed review instead of automatic outreach or CRM-like ownership?

## Accessibility, Keyboard, And Mobile Checks

Run these checks as human UX observations. They can complement automated local E2E, but they do not replace it.

- Keyboard-only tab switching works for list and Kanban.
- Focus visibility is clear on tabs, buttons, filters, copy controls, reset controls, and detail Workbench controls.
- Shortcut help is discoverable and dismissible.
- Live status feedback is clear, bounded, and not noisy.
- Shortcut guards prevent shortcuts from firing inside form controls, textareas, inputs, selects, buttons, links, and other interactive controls.
- Zero-result reset controls are keyboard reachable and understandable.
- Copy/manual-copy status text is understandable without reading code.
- Mobile and narrow viewport layouts avoid horizontal overflow, overlapping controls, clipped labels, and unreadable chips.
- Review-status controls expose clear accessible names and do not look like sales pipeline controls.
- The detail Opportunity Workbench has comparable keyboard and copy affordances to `/leads`.

## Feedback Intake Format

Use one feedback item per issue or question. Prefer concrete reproduction steps over broad impressions.

```text
Severity: P0 | P1 | P2 | P3
Surface: list | Kanban | Review Session | Action Queue | notes | shortcuts | filters | detail Workbench | mobile | docs
Issue type: clarity | layout | accessibility | workflow | copy | trust boundary | performance | test coverage
Reproduction steps:
Expected behavior:
Actual behavior:
Suggested fix:
Production action required: yes | no
Human-only product decision required: yes | no
Safe immediate fix candidate: yes | no
Separate follow-up required: yes | no
Evidence attached:
```

Severity guidance:

- P0: Blocks safe review, creates a trust-boundary problem, implies production proof, risks accidental mutation, or could expose private data.
- P1: Prevents a normal reviewer from completing a review pass or creates serious accessibility failure.
- P2: Causes confusion, avoidable friction, unclear copy, or layout problems with a workable bypass.
- P3: Minor polish, typo, small docs clarification, or non-blocking preference.

## Safe Immediate Fixes

These may be fixed immediately if the change is small, local/test-safe, reviewable, and does not expand scope:

- Typo or docs correction.
- Label or copy clarification.
- Local-only test assertion.
- Accessibility attribute correction.
- Small focus or keyboard guard fix.

Even safe immediate fixes must stay within normal review gates. Record the branch, diff, validation results, and whether the fix is docs-only or runtime-facing.

## Must Become Separate Follow-Up Goals

Do not fold these into the UX review packet or a tiny feedback fix:

- Saved reviewer note suggestion persistence.
- Session history or current-page activity persistence.
- Manager dashboard.
- Outcome learning.
- Schema change.
- API contract change.
- Production proof.
- Real production row proof or row roundtrip.
- CRM ownership, assignment, forecasting, or outreach automation.
- Large visual redesign.
- LLM or external provider behavior changes.
- Production evidence storage or redaction workflow.

If feedback points to one of these, write a separate scoped follow-up with explicit non-production or production-approval boundaries.

## Forbidden Claims

Do not make these claims from this UX review:

- Production deployment happened.
- Production D1 was accessed, read, written, migrated, or observed.
- Production Worker endpoints were called.
- Production logs or secrets were read.
- Production runtime behavior, row serialization, lazy migration, or reviewer workflow behavior was observed.
- Local tests, fake-D1 E2E, docs, screenshots, PR summaries, generated reports, or CI are production observation evidence.
- Reviewer note suggestions are saved, auto-sent, or persisted.
- All notes are non-persistent.
- The manual notes textarea is non-persistent.
- The app owns CRM assignment, forecasting, automatic outreach, automatic send, or manager-dashboard workflows.
- UX feedback proves production readiness.

Use this wording instead:

- "This feedback came from a local/test-safe human UX review."
- "The reviewer workflow remains local/test-safe unless a separate approved production proof flow is completed."
- "Reviewer note suggestions are not persisted or sent."
- "Manual operator notes can persist through the existing notes field."

## Review Completion Record

When the review is done, attach a short completion record:

```text
Reviewer:
Date:
Repository:
Branch:
HEAD SHA:
Open PR state:
Validation run:
Review surfaces covered:
Number of feedback items:
P0 count:
P1 count:
P2 count:
P3 count:
Production action performed: no
Production evidence claimed: no
Recommended next scoped follow-up:
```

If there are no P0/P1 items and validation is green, the reviewer workflow can remain the local/test-safe baseline for the next small review-quality, docs, or CI-maintenance slice. Do not continue from this packet into production proof, persistence, schema/API work, manager dashboards, outcome learning, or CRM/outreach automation without a separately scoped and approved goal.
