# LeadBrief v1 Contract

## Purpose

LeadBrief v1 is the review unit before any sales action.

The product flow is:

1. signal detection
2. opportunity interpretation
3. reviewable brief

It is not a CRM replacement, automatic salesperson, proposal generator, or PPT-first workflow.

## Canonical Fields

Required LeadBrief v1 fields:

- `company`
- `signal`
- `sources`
- `whyNow`
- `recommendedMessage`
- `confidence`
- `assumptions`
- `dataGaps`
- `reviewStatus`

Compatibility and strongly recommended fields preserved when present:

- `id`
- `profileId`
- `product`
- `score`
- `grade`
- `generationMode`
- `verificationStatus`
- `evidence`
- `createdAt`
- `updatedAt`

## Compatibility Mapping

- `summary` remains available and maps to canonical `signal`.
- `salesPitch` / `sales_pitch` remain available and map to `recommendedMessage`.
- `urgencyReason`, `globalContext`, or self-service `trend` can supply `whyNow` when a dedicated `whyNow` field is absent.
- Existing `status` remains the sales pipeline state.
- New `reviewStatus` is the human review state and must not be used as a pipeline stage.

## Review Status

Frozen states:

- `NEW`
- `NEEDS_REVIEW`
- `APPROVED`
- `REJECTED`
- `DEFERRED`

Default posture:

- LLM leads default to `NEEDS_REVIEW`, even when `verificationStatus` is `verified`.
- Heuristic and fallback leads default to `NEEDS_REVIEW`.
- Demo leads are refused by canonical publication.
- Human review actions may move a D1 lead to `APPROVED`, `REJECTED`, or `DEFERRED`.

## Persistence

D1 stores the review state in `leads.review_status`.

`leads.status` continues to represent the sales pipeline. Upserts from managed/self-service lead generation preserve an existing `review_status` on conflict so a refreshed lead does not erase human review decisions.

## Publication

Canonical published `latest-leads.json` records include LeadBrief v1 fields while preserving legacy aliases. Published leads are not automatically approved. Heuristic leads stay non-verified and review-needed, and demo leads are rejected before canonical publication.

## API And UX

`/api/leads` returns LeadBrief v1 fields alongside existing fields.

The human review UX is intentionally minimal:

- show `reviewStatus` on list and detail views
- show confidence, assumptions, data gaps, and sources near the review decision
- allow authenticated PATCH updates to `reviewStatus`
- keep `status` and `reviewStatus` controls separate
