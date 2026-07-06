# Reviewer Workflow Intelligence v1 Local/Test Packet

Status: local/test-safe implementation packet

Evidence kind: `NOT_PRODUCTION_EVIDENCE`

Production readiness: `productionReady:false`

## Scope

Reviewer Workflow Intelligence v1 improves local human review quality without
crossing staging or production boundaries. It adds human-entered reviewer
feedback signals, deterministic reviewer summary metadata, and deterministic
data-gap prioritization to the existing lead review workflow.

The feature uses existing safe surfaces:

- `PATCH /api/leads/:id` for explicit human-entered reviewer feedback updates.
- `GET /api/leads` for additive `reviewerWorkflowSummary` and
  `dataGapPrioritization` metadata.
- `/leads` and `/leads/:id` for reviewer-facing local/test controls.

## Reviewer Feedback Data

Current feedback is stored in local/test D1 table `reviewer_feedback` by lead:

- `action_usefulness`: `useful`, `partially_useful`, `not_useful`, `unclear`
- `outcome_label`: `interested`, `not_fit`, `no_response`,
  `needs_more_research`, `duplicate`, `deferred`, `unknown`
- `data_gap_priority`: `none`, `low`, `medium`, `high`, `blocking`
- `evidence_confidence_adjustment`: `increase`, `decrease`, `unchanged`,
  `unknown`
- `feedback_text`
- `next_reviewer_action`
- fixed `author_label = manual_reviewer`
- `updated_at`

Metadata-only history is stored in `reviewer_feedback_events`:

- lead id
- event type: `create`, `edit`, `clear`
- timestamp
- fixed `manual_reviewer` author label
- changed field names

The history table does not store old feedback text, new feedback text, generated
suggestion text, emails, display names, real reviewer identity, or production
identity claims.

## Access Boundary

Reviewer feedback follows the existing C2 local/test role-stub protection used
for manual notes. When
`MANUAL_REVIEW_NOTES_LOCAL_TEST_ROLE_STUB=enabled`, only
`X-Manual-Review-Notes-Local-Test-Role: reviewer` can read or write protected
feedback fields. `manager`, `api`, missing, and unknown roles omit feedback
fields and cannot write feedback.

This remains a local/test stub only. It is not real auth, session identity,
production access control, manager visibility expansion, export expansion, or
API exposure expansion.

## Generated Suggestion Boundary

Generated reviewer note suggestions remain helper text only:

- copy-only
- not saved
- not sent
- not attributed to a reviewer
- not history-stored
- not exported
- not human-authored saved notes

Patch attempts that include generated suggestion fields are rejected. Attempts
to smuggle generated suggestion fields inside `reviewerFeedback` are also
rejected.

## Summary And Prioritization

`reviewerWorkflowSummary` counts:

- total leads
- review-status distribution
- confidence-band distribution
- reviewer feedback outcome labels
- reviewer feedback data-gap priority
- leads needing human review
- leads blocked by missing evidence/source
- leads with manual notes
- leads with reviewer feedback
- top deterministic review risks
- suggested queue buckets

`dataGapPrioritization` deterministically buckets leads by reviewer feedback,
LeadBrief trust metadata, evidence/source completeness, confidence, generation
mode, verification state, manual-note presence, and review outcome signals.

This is advisory review metadata only. It does not approve CRM actions,
outreach, production proof, production readiness, or generated suggestion
persistence.

## Privacy And Retention Boundary

Reviewer feedback freeform text can contain sensitive sales context. The UI
keeps static local/test privacy warning copy. There is still no automated PII
detection, blocking, redaction, retention enforcement, purge/delete job, export
expansion, manager visibility expansion, or production compliance evidence.

Issue #154 remains open/blocked for privacy residual values and enforcement
work.

## Production And Staging Boundary

This packet does not approve:

- staging execution
- staging D1 access
- staging endpoint calls
- staging logs/secrets access
- production proof execution
- production deploy
- production rollback execution
- production D1 schema observation, migration, access, write, or delete
- Wrangler production commands
- production endpoint calls
- production logs/secrets access
- production smoke tests
- customer/private data access or mutation
- real auth/session/provider parsing
- real reviewer identity
- retention/privacy enforcement
- automated PII detection/redaction
- purge/delete jobs
- CRM/outreach/LLM/automation
- production-readiness claims

Open blockers #165, #162, #163, #164, and #154 remain open unless a separate
explicit human-approved goal closes them with evidence.

## Validation

Local/test coverage includes:

- `worker/tests/reviewer-feedback.test.mjs`
- `worker/tests/lead-action-intelligence.test.mjs`
- `worker/tests/lead-review-status.test.mjs`
- `worker/tests/d1-schema-contract.test.mjs`
- `tests/d1-schema-consistency.test.js`
- `npm run check:schema`
- `npm test`
