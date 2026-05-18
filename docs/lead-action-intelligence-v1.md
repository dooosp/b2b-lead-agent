# Lead Action Intelligence V1

Lead Action Intelligence v1 is a deterministic reviewer-guidance layer for existing LeadBrief records. It helps a human reviewer decide what to do next without changing the lead schema, calling an LLM, sending outreach, or expanding CRM ownership.

## Inputs

The helper uses existing fields only:

- `reviewStatus` / `review_status`
- `verificationStatus` / `verification_status`
- `generationMode` / `generation_mode`
- `confidence` and `confidenceReason` / `confidence_reason`
- `sources` and source freshness dates when present
- `evidence`
- `dataGaps` / `data_gaps`
- `assumptions`, `signal`, `whyNow`, `recommendedMessage`
- product, buyer, buying-signal, pain-point, event, and conflict fields when present

The canonical implementation is `worker/lib/lead-action-intelligence.js`, which first normalizes through LeadBrief v1.

## Outputs

The helper returns:

- `nextReviewAction`
- `nextReviewActionLabel`
- `nextReviewActionReason`
- `riskFlags`
- `missingInfoPrompts`
- `stakeholderAngle`
- `suggestedFollowUp`
- `reviewerNoteTemplates`
- `reviewNoteSuggestion`
- `reviewPriority`
- `actionConfidence`

These are advisory review outputs. `suggestedFollowUp` is a human-review draft only; it does not approve or send outreach.

`reviewerNoteTemplates` is Reviewer Notes Template v1. It returns deterministic, copy-friendly note variants for `APPROVED` / `승인 노트`, `NEEDS_REVIEW` / `검토 필요 노트`, and a `RISK_CHECK` or `DATA_GAP` follow-up note. `reviewNoteSuggestion` is the currently selected note for the lead's present review/action state. It changes when existing review metadata changes, but it is not stored, sent, or written back to D1. Option A manual review notes are separate: only text a human enters into the manual note control is saved through `manualReviewNotes`, with derived `human_entered` provenance while saved text exists. Manual Review Notes v0 edit means saving a changed human-entered value; clear/delete means confirmed clearing of that saved value.

## Reviewer Action Queue V1.1

Reviewer Action Queue v1.1 turns the same deterministic v1 outputs into queue-level review metadata. The queue helper is `buildReviewerActionQueue(leads, options)` in `worker/lib/lead-action-intelligence.js`.

Queue items include:

- lead id and company
- next action code and label
- review priority
- action confidence
- queue lane id and label
- compact reason snippet
- risk-flag count
- missing-info count
- current reviewer note suggestion and note variants
- normalized review, verification, generation, and confidence state

The queue groups items into four reviewer lanes:

1. `approval_candidates` / `승인 후보`: reviewed follow-up or final review-status decision candidates.
2. `needs_evidence` / `보강 필요`: evidence, data-gap, enrichment, or freshness work.
3. `risk_review` / `리스크 확인`: conflicts or review-state risk that must be reconciled.
4. `low_priority` / `낮은 우선순위`: rejected, deferred, or inactive leads.

Sorting is deterministic:

1. highest `reviewPriority`
2. highest `actionConfidence`
3. highest normalized lead confidence
4. newest available `updatedAt` / `updated_at` / `createdAt` / `created_at`
5. stable company/id fallback

Queue filters are deterministic and local:

- `nextReviewAction`
- `reviewPriority`
- `actionConfidence`
- `queueLane`
- risk flags: all, has, none, or a specific risk code
- missing info: all, has, or none

## Deterministic Rules

The first matching blocker decides the next action:

1. Rejected leads stay out of the active queue.
2. Approved leads with unresolved verification, evidence, data-gap, confidence, stale-source, or conflict risk must be reconciled.
3. Stale source evidence should be refreshed before review.
4. Low-confidence, heuristic, or unavailable-generation leads should be enriched before review.
5. Missing source or direct evidence must be verified first.
6. Open data gaps must be resolved before approval or follow-up.
7. Deferred leads need a recheck condition.
8. Approved, verified, high-quality leads can prepare a human-reviewed follow-up.
9. Verified leads without final human review should get a review-status decision.

## Product Surfaces

- Opportunity Workbench renders the full Lead Action Intelligence panel with action, reason, risk flags, missing-info prompts, stakeholder angle, follow-up draft, and generated copy-only reviewer note suggestions. Under Issue #113 Option E and PR #114, generated suggestions are helper text only: copy-only, not saved, not sent, and not treated as human-authored saved notes. The lead-detail Workbench also exposes copy-friendly note controls, manual-copy fallback, non-mutating shortcuts, shortcut help, browser-memory activity feedback for the current page session, and a separate human-entered manual review note control.
- `/api/leads` includes additive `reviewerActionQueue` and `leadReviewSession` metadata built from the canonical helper after normal LeadBrief canonicalization, including current reviewer note suggestions for queue/session items. It also exposes saved human-entered manual notes as `manualReviewNotes` with `manualReviewNotesProvenance`, supports editing by saving a changed human-entered value, and supports clearing by saving an empty `manualReviewNotes` value. Generated reviewer note suggestions remain response helper text and are rejected as patch persistence fields.
- `/leads` renders Reviewer Action Queue lanes, action/priority/risk/missing-info filters, compact card summaries, and a Lead Review Session panel from the queue metadata. The session panel shows a copy-friendly reviewer note suggestion near quick `APPROVED` / `NEEDS_REVIEW` actions.
- Kanban cards render the compact next action below the gate chip.
- Reviewer Productivity Toolkit v1 layers local-only productivity controls onto `/leads`: visible copy buttons for deterministic session note templates, safe manual-copy fallback when the Clipboard API is unavailable, optional non-mutating keyboard shortcuts, shortcut help, and an in-memory session activity summary. The activity summary resets on page reload and is not written to D1, localStorage, analytics, APIs, or logs.
- Lead Detail Workbench Productivity Parity v1 mirrors the same safe reviewer affordances into lead detail: visible Workbench note copy controls copy only deterministic note text, manual fallback selects the visible note when the Clipboard API is unavailable, `c`/`w`/`n`/`j`/`?` shortcuts are ignored in form controls and never mutate `reviewStatus`, and current-page activity counts live only in browser memory.
- Reviewer Workflow QA & Accessibility Hardening v1 tightens those shipped affordances without expanding product scope: list/detail copy targets and status controls have clearer accessible names, shortcut help/status feedback is bounded and live-region friendly, list view switching is keyboard-reachable, shortcuts are ignored on interactive controls as well as text-entry fields, and local E2E includes mobile viewport overflow smoke for reviewer blocks.
- Reviewer Workflow Roving Keyboard & Accessibility Snapshot Gate v1 adds a local/test-safe keyboard and regression layer: `/leads` list/Kanban tabs expose a vertical tablist with Up/Down roving focus, Left/Right focus aliases, Home/End movement, and Enter/Space activation; the list/Kanban panels expose stable tabpanel semantics; and local E2E captures semantic snapshots for `/leads` reviewer regions plus lead-detail Opportunity Workbench markers. It remains deterministic browser behavior only; it does not store generated suggestions, send activity, mutate `reviewStatus` from shortcuts, or add production/external calls.

The list/Kanban UI keeps a conservative browser fallback for older payloads, but the canonical queue model is the Worker helper and the additive `/api/leads` queue metadata.

## Lead Review Session V1

Lead Review Session v1 is a local/test-safe review workflow layered on top of Reviewer Action Queue v1.1.

It derives:

- current queue size for the active browser filter context
- remaining counts by queue lane
- approved and needs-review review-status counts
- active filter chips
- the deterministic next lead candidate from the current queue order

The `/leads` panel exposes a `다음 검토 리드` action that scrolls and focuses the next card. Quick actions are intentionally narrow: they use the existing PATCH flow and existing frozen review statuses (`APPROVED` and `NEEDS_REVIEW`) and send only `reviewStatus`. The sales pipeline `status` remains a separate control and is not changed by session quick actions.

After a review-status mutation, `/leads` reloads the local queue metadata so lane counts, card guidance, and Workbench/detail guidance remain consistent with the updated row. If the update fails, the UI shows a bounded Korean failure message, does not expose SQL/provider/internal details, and keeps the current filter context usable.

## Reviewer Notes Template V1

Reviewer Notes Template v1 turns the current LeadBrief plus Lead Action Intelligence outputs into deterministic review-note suggestions. It is intentionally narrow:

- It reuses `toLeadBriefV1()`, normalized evidence/source/data-gap fields, next-review action, risk flags, and missing-info prompts.
- It generates a current note plus three variants: approved, needs-review, and risk/data-gap follow-up.
- It supports camelCase and snake_case input through the existing LeadBrief normalization path.
- It keeps sales `status` separate from human `reviewStatus`; notes explain the review state but never mutate either state.
- It includes bounded fallback text when a copy-friendly note cannot be generated from available fields.
- It does not persist generated notes, call an LLM, call an external service, send outreach, create CRM records, or change D1 schema.

## Reviewer Productivity Toolkit V1

Reviewer Productivity Toolkit v1 is a browser-only helper for the existing `/leads` review session and the lead-detail Opportunity Workbench:

- Copy buttons copy only the visible deterministic reviewer note text from the active session note or Workbench note.
- If `navigator.clipboard.writeText()` is unavailable or fails, the UI selects the note text and shows a bounded manual-copy message.
- Keyboard shortcuts are discoverable and non-mutating: `n`/`j` focuses the next review lead, `q` focuses Reviewer Action Queue, `c` copies the visible session note, and `?` toggles shortcut help.
- Detail shortcuts are also discoverable and non-mutating: `c` copies the visible Workbench note, `w` focuses Opportunity Workbench, `n`/`j` focuses the next meaningful detail section, and `?` toggles shortcut help.
- Shortcuts are ignored while the reviewer is typing in `input`, `select`, `textarea`, or `contenteditable` controls, and while focus is on interactive controls such as buttons, links, summaries, tabs, or menu-like roles.
- Session activity tracks note-copy count, explicit review-status update count, focus count, filter reset count, and last action in browser memory only.
- Detail activity tracks Workbench note-copy count, manual-copy fallback count, Workbench focus count, section focus count, explicit status/review-status update success/failure count, and last action in browser memory only. It resets on reload and is not stored in `localStorage` or `sessionStorage`.
- `reviewStatus` changes remain explicit button/select actions. Shortcuts never send PATCH requests or mutate review state.

The detail implementation keeps a scoped browser helper because the `/leads` helper is coupled to queue/session filters, quick actions, and list-card navigation. The shared product contract is the deterministic Workbench note markup and safe copy/fallback behavior; no API, schema, or storage contract is expanded.

## Boundaries

- No production deploy.
- No production D1 access, reads, writes, or migration.
- No Wrangler command.
- No production Worker endpoint call.
- No secrets or production logs.
- No LLM or external API call.
- No D1 schema change.
- No production row roundtrip or production observation claim.
- No CRM assignment, notification, forecasting, or ownership workflow.
- No automatic sales sending.
- No note/session activity persistence, browser localStorage, analytics, or network call beyond existing explicit review-status PATCH actions.
- No keyboard-triggered reviewStatus mutation.

## Validation

Coverage is local/test-only:

- `worker/tests/lead-action-intelligence.test.mjs` covers strong, review-ready, missing-evidence, data-gap, low-confidence, stale, conflicting, snake_case fallback leads, and approved/needs-review/risk-check/data-gap reviewer note templates.
- `worker/tests/lead-action-intelligence.test.mjs` also covers Reviewer Action Queue grouping, sorting, filters, compact counts, Lead Review Session summary counts, next-lead candidate selection, snake_case fallback, note suggestions, and mutation-style reclassification.
- `worker/tests/opportunity-workbench.test.mjs` covers Workbench rendering of the new guidance, Option E copy-only reviewer note suggestion labels, and deterministic note copy-control markup.
- `worker/tests/lead-review-status.test.mjs` covers the `/leads` session panel, next-lead control, quick review actions, bounded failure messaging, status-separation copy, copy-friendly note suggestion rendering near quick actions, copy/manual-copy hooks, shortcut guards, in-memory activity state, roving tablist/tabpanel markup and handlers, and lead-detail Workbench productivity controls that do not introduce shortcut review mutations.
- `worker/e2e/local-e2e.test.mjs` covers local fake-D1 rendering, Reviewer Action Queue lanes, Lead Review Session summary/next-lead navigation, reviewer note suggestions, copy success, manual-copy fallback, non-mutating shortcuts, ignored shortcuts while typing, list/Kanban roving keyboard focus and Enter/Space activation, semantic snapshots for `/leads` and lead-detail Workbench regions/controls, in-memory activity reset on reload, detail Workbench copy/manual fallback/focus/help behavior, quick review action success and failure paths, action/risk/missing-info filters, list/Kanban summaries, review-status mutation updating queue guidance and note text, zero-result reset flows, sales-status preservation, and the non-loopback fetch guard.
