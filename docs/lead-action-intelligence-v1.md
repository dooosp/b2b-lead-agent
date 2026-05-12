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
- `reviewPriority`
- `actionConfidence`

These are advisory review outputs. `suggestedFollowUp` is a human-review draft only; it does not approve or send outreach.

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

- Opportunity Workbench renders the full Lead Action Intelligence panel with action, reason, risk flags, missing-info prompts, stakeholder angle, and follow-up draft.
- `/api/leads` includes additive `reviewerActionQueue` and `leadReviewSession` metadata built from the canonical helper after normal LeadBrief canonicalization. This does not change stored lead rows or require schema migration.
- `/leads` renders Reviewer Action Queue lanes, action/priority/risk/missing-info filters, compact card summaries, and a Lead Review Session panel from the queue metadata.
- Kanban cards render the compact next action below the gate chip.

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

## Validation

Coverage is local/test-only:

- `worker/tests/lead-action-intelligence.test.mjs` covers strong, review-ready, missing-evidence, data-gap, low-confidence, stale, conflicting, and snake_case fallback leads.
- `worker/tests/lead-action-intelligence.test.mjs` also covers Reviewer Action Queue grouping, sorting, filters, compact counts, Lead Review Session summary counts, next-lead candidate selection, snake_case fallback, and mutation-style reclassification.
- `worker/tests/opportunity-workbench.test.mjs` covers Workbench rendering of the new guidance.
- `worker/tests/lead-review-status.test.mjs` covers the `/leads` session panel, next-lead control, quick review actions, bounded failure messaging, and status-separation copy.
- `worker/e2e/local-e2e.test.mjs` covers local fake-D1 rendering, Reviewer Action Queue lanes, Lead Review Session summary/next-lead navigation, quick review action success and failure paths, action/risk/missing-info filters, list/Kanban summaries, review-status mutation updating queue guidance, zero-result reset flows, sales-status preservation, and the non-loopback fetch guard.
