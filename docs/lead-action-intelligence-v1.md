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
- `/leads` list cards render a compact action summary beside the existing list review gate.
- Kanban cards render the compact next action below the gate chip.

The list/Kanban UI computes its compact summary in the browser from the already-loaded lead payload, so no API field is added.

## Boundaries

- No production deploy.
- No production D1 access, reads, writes, or migration.
- No Wrangler command.
- No production Worker endpoint call.
- No secrets or production logs.
- No LLM or external API call.
- No D1 schema change.
- No CRM assignment, notification, forecasting, or ownership workflow.
- No automatic sales sending.
- No production observation claim.

## Validation

Coverage is local/test-only:

- `worker/tests/lead-action-intelligence.test.mjs` covers strong, review-ready, missing-evidence, data-gap, low-confidence, stale, conflicting, and snake_case fallback leads.
- `worker/tests/opportunity-workbench.test.mjs` covers Workbench rendering of the new guidance.
- `worker/e2e/local-e2e.test.mjs` covers local fake-D1 rendering, list/Kanban summaries, review-status mutation updating guidance, zero-result reset flows, and the non-loopback fetch guard.
