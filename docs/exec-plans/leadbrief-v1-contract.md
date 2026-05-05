# LeadBrief v1 Contract

## Purpose

LeadBrief v1 is the review unit before any sales action.

PR #27 shipped this contract to `master` on 2026-05-05 in merge commit `5776d4a`.

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

The `review_status` column is lazy-migration-compatible through `ensureD1Schema()` and `worker/schema.sql`, but production deploy and production DB writes were not performed during PR #27 landing. Do not claim production D1 review-column migration until a post-deploy production write is observed.

## Publication

Canonical published `latest-leads.json` records include LeadBrief v1 fields while preserving legacy aliases. Published leads are not automatically approved. Heuristic leads stay non-verified and review-needed, and demo leads are rejected before canonical publication.

## API And UX

`/api/leads` returns LeadBrief v1 fields alongside existing fields.

CSV export, self-service browser cards, copy output, and JSON downloads preserve review/trust metadata.

The internal latest-published CRM contract remains backward-compatible as `crm.published-report.v1` and does not expose LeadBrief fields unless a later scoped contract update explicitly expands it.

The human review UX is intentionally minimal:

- show `reviewStatus` on list and detail views
- show confidence, assumptions, data gaps, and sources near the review decision
- allow authenticated PATCH updates to `reviewStatus`
- keep `status` and `reviewStatus` controls separate

## Non-Goals

- No production deploy in PR #27 landing
- No production DB write in PR #27 landing
- No claim that production D1 lazy migration was observed
- No CRM replacement or external CRM sync
- No Review Inbox v1 workflow expansion
- No assignment, comments, notifications, RBAC, PPT, proposal, CPA, or dashboard redesign
