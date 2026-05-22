# B2B Lead Agent Privacy / Retention Implementation Plan

This plan converts the Issue #154 conservative privacy/retention owner decision
into a future implementation roadmap for privacy guardrails.

It is documentation only. It does not implement privacy enforcement, PII
detection, redaction, retention enforcement, purge/delete behavior, export
controls, auth, runtime behavior, UI behavior, API behavior, schema behavior,
database behavior, CRM integration, outreach, LLM calls, automation, staging
execution, production proof, production deploy, production D1 access, endpoint
calls, logs/secrets access, or customer/private data access.

## Document Status

- Document status: `PRIVACY_RETENTION_IMPLEMENTATION_PLAN_CREATED_DOCS_ONLY`.
- Human decision:
  `PREPARE_PRIVACY_RETENTION_IMPLEMENTATION_PLAN_DOCS_ONLY`.
- Repository: `dooosp/b2b-lead-agent`.
- Default branch: `master`.
- Baseline inspected: `origin/master` at
  `1285e1680428da7e0e121c2b09154dfca467f4d7`.
- Latest related merged PR: PR #157,
  `docs: process Issue 154 conservative policy approval`.
- Plan path:
  `docs/roadmap/b2b-lead-agent-privacy-retention-implementation-plan.md`.
- Controlling privacy owner input request:
  `docs/roadmap/b2b-lead-agent-privacy-owner-input-request.md`.
- Controlling conservative policy disposition:
  `docs/roadmap/b2b-lead-agent-privacy-owner-input-disposition.md`.
- Conservative policy status: `COMPLETE_FOR_CONSERVATIVE_POLICY`.
- Approved values scope: conservative policy values only.
- Production reviewer workflow:
  `STILL_BLOCKED_PENDING_AUTH_D1_ROLLBACK_PROOF`.
- Implementation performed by this plan: no.
- Privacy/retention tests or guards implemented by this plan: no.
- Production privacy proof performed by this plan: no.
- Production, staging, CRM, outreach, LLM, automation, or customer/private data
  action performed by this plan: no.

```yaml
b2b_lead_agent_privacy_retention_implementation_plan:
  document_status: PRIVACY_RETENTION_IMPLEMENTATION_PLAN_CREATED_DOCS_ONLY
  human_decision: PREPARE_PRIVACY_RETENTION_IMPLEMENTATION_PLAN_DOCS_ONLY
  repository: dooosp/b2b-lead-agent
  default_branch: master
  inspected_origin_master: "1285e1680428da7e0e121c2b09154dfca467f4d7"
  latest_related_merged_pr: 157
  issue_154_status: COMPLETE_FOR_CONSERVATIVE_POLICY
  approved_values_scope: CONSERVATIVE_POLICY_VALUES_ONLY
  implementation_authorized: false
  privacy_retention_tests_or_guards_implemented: false
  production_privacy_proof_authorized: false
  production_reviewer_workflow: STILL_BLOCKED_PENDING_AUTH_D1_ROLLBACK_PROOF
  staging_execution: HOLD
  production_proof: HOLD
  production_deploy: HOLD
  production_d1_access: HOLD
  endpoint_calls: HOLD
  crm_outreach_llm_automation: FORBIDDEN
  customer_private_data_access: FORBIDDEN
  next_recommended_cycle: AUTH_ACCESS_CONTROL_IMPLEMENTATION_PLAN_DOCS_ONLY
  privacy_lane_alternate_cycle: PRIVACY_RETENTION_TEST_GUARD_IMPLEMENTATION_DOCS_ONLY
  next_decision: HOLD_PENDING_NEW_EXPLICIT_GOAL
```

## 1. Approved Conservative Policy Summary

Issue #154 is processed as `COMPLETE_FOR_CONSERVATIVE_POLICY` through PR #157.
The approval applies only to conservative policy values for planning. It does
not approve implementation, production proof, deployment, D1 access, endpoint
calls, CRM, outreach, LLM, automation, or customer/private data access.

| Policy area | Approved conservative value |
| --- | --- |
| Manual note body history | `NO` |
| Manager manual note visibility | `NO` |
| Export manual note visibility | `NO` |
| API manual note visibility | `NO` |
| CRM data use | `NO` |
| Outreach data use | `NO` |
| Outcome-learning data use | `NO` |
| Real reviewer identity | `NO_UNTIL_AUTH_PRIVACY_APPROVAL` |
| PII detection | `FUTURE_DECISION_REQUIRED` |
| Redaction | `FUTURE_DECISION_REQUIRED` |
| Purge/delete | `FUTURE_DECISION_REQUIRED` |
| Production privacy proof | `NO` |

Planning translation:

- Current manual note body history must remain absent.
- Manager, export, and broad API manual note visibility must remain blocked.
- CRM, outreach, and outcome-learning use of manual notes, metadata, generated
  suggestions, reviewer identity, or private lead/person fields must remain
  blocked.
- Real reviewer identity must not be stored or displayed until future auth and
  privacy approval exists.
- PII detection, redaction, and purge/delete implementation must not begin
  until explicit owner/legal decisions select semantics.
- Production privacy proof must not be planned as executable work until a
  separate future approval changes `PRODUCTION_PRIVACY_PROOF_APPROVED` from
  `NO`.

## 2. Current Behavior To Preserve

Repo-visible current behavior from the roadmap packets and tests:

- `manualReviewNotes` is human-entered current note text backed by the existing
  `leads.notes` value.
- Manual note save/edit/clear is local/test ready, but not production proof.
- `manualReviewNotesUpdatedAt` is note-specific metadata for accepted
  human-entered save/edit/clear events only.
- `manualReviewNotesAuthorLabel` is the fixed generic label
  `manual_reviewer`; it is not real reviewer identity.
- `manual_review_note_events` is metadata-only. It stores event type,
  timestamp, lead relationship, and fixed generic author label.
- Metadata-only history must not store old note text, new note text, generated
  suggestion text, redacted text, summaries, screenshots, or real reviewer
  identity.
- Generated reviewer note suggestions are copy-only helper text. They are not
  saved manual notes, not human-authored notes, not history rows, not exports,
  not attribution, and not retention data.
- Static privacy warning behavior is warning-only. It is not detection,
  blocking, redaction, retention enforcement, purge/delete behavior, or
  compliance proof.
- The C2 local/test role stub is not real auth and is not production proof.
- Existing CSV/API compatibility is not production export approval.

## 3. Implementation Principles

Future implementation work must follow these principles:

- Make tests and guards prove the conservative defaults before any broader
  feature expansion.
- Prefer no-op preservation over speculative enforcement.
- Keep generated suggestion text outside saved note, history, export,
  attribution, analytics, CRM, outreach, and outcome-learning paths.
- Keep manual note body history forbidden unless a future explicit decision
  changes the policy.
- Keep manager/export/API note visibility blocked unless a future explicit
  access/privacy/export decision changes the policy.
- Treat metadata as sensitive enough to require retention and visibility
  decisions even when no note body is stored.
- Treat clear as current-value clearing only until purge/delete semantics are
  explicitly approved.
- Treat production proof as not approved.
- Use synthetic/local fixtures only for future non-production tests.
- Stop before any production/staging/D1/endpoint/log/secret/customer-data
  boundary is crossed.

## 4. Phase 0: Preserve Current Behavior

### Purpose

Preserve the current local/test behavior while planning future guard work. This
phase is a no-op behavior phase: generated suggestions remain non-persistent,
manual note body history remains absent, and no new visibility or retention
surface is introduced.

### Files Likely Affected

- `docs/roadmap/b2b-lead-agent-privacy-retention-implementation-plan.md`
- `docs/roadmap/current-pr-train.md` if source-of-truth state changes
- No runtime, UI, API, schema, database, worker, or test file needs to change
  for the no-op preservation phase.

### Allowed Future Changes

- Documentation clarification that current behavior is preserved.
- Read-only source inspection and diff review.
- Validation commands against a clean docs-only branch.

### Forbidden Changes

- Any product/runtime/UI/API/schema/database change.
- Any new retention, detection, redaction, purge/delete, export, visibility, or
  access-control behavior.
- Any change that causes generated suggestions to be saved, exported,
  attributed, retained, or included in history.
- Any staging, production, D1, endpoint, log, secret, CRM, outreach, LLM,
  automation, customer, or private-data action.

### Required Tests

- For docs-only Phase 0 updates: `git diff --check`, `git diff --cached --check`,
  `npm run check:naming`, `npm run check:schema`, and `npm test`.
- No new test file is required for the preservation-only phase.

### Rollback / Backout Notes

- Revert only the docs-only planning change if needed.
- Do not revert unrelated local worktree changes.
- No data rollback is applicable because this phase changes no behavior.

### Stop Conditions

- Any required edit touches runtime, UI, API, schema, database, staging,
  production, CRM, outreach, LLM, automation, or customer/private data.
- A validation failure points to behavior outside the docs-only scope and cannot
  be resolved by correcting the docs.
- The plan would need production evidence to be truthful.

### Separate Future Implementation Goal Required

- No for preserving behavior by doing nothing.
- Yes for any test, guard, code, schema, API, UI, or runtime change.

## 5. Phase 1: Prove Manual Note Body History Is Not Stored

### Purpose

Add future tests/guards proving manual note body history remains absent. The
approved conservative policy is `MANUAL_NOTES_BODY_HISTORY_ALLOWED: NO`, so
future implementation must prove old note text and new note text do not enter
history rows, metadata summaries, exports, logs, evidence packets, or generated
artifacts.

### Files Likely Affected

- `worker/db/leads.js`
- `worker/db/schema.js`
- `worker/db/transform.js`
- `worker/schema.sql`
- `worker/tests/manual-review-notes.test.mjs`
- `worker/tests/d1-schema-contract.test.mjs`
- `tests/d1-schema-consistency.test.js`
- `tests/release-evidence-redaction.test.js` only if evidence redaction guard
  scope is explicitly selected later

### Allowed Future Changes

- Add or strengthen local/test assertions that `manual_review_note_events`
  contains metadata-only fields.
- Add schema-contract assertions that no old/new manual note text columns are
  introduced.
- Add targeted fixture tests for create/edit/clear sequences that inspect event
  rows and serialized payloads.
- Add docs-only test-plan updates.

### Forbidden Changes

- Adding old note body columns, new note body columns, body snapshots, redacted
  body columns, note summaries, append-only text logs, or event payload blobs.
- Backfilling old manual note values into metadata history.
- Treating release evidence, screenshots, logs, or test artifacts as allowed
  note body history.
- Changing production D1 schema or observing production rows.

### Required Tests

- `npm run check:schema`
- Targeted future test command for manual notes, such as
  `node --test worker/tests/manual-review-notes.test.mjs`
- Targeted future schema tests:
  `node --test worker/tests/d1-schema-contract.test.mjs tests/d1-schema-consistency.test.js`
- Full gate before merge: `npm run check:naming` and `npm test`
- Assertions must cover create, edit, clear, unchanged save, unrelated patch,
  and legacy `notes` compatibility paths.

### Rollback / Backout Notes

- Back out test-only changes if assertions are wrong.
- If any implementation accidentally introduces body history, remove the new
  body-history behavior and preserve existing current-value note data.
- Do not delete current manual note text or metadata rows without explicit
  retention/purge approval.

### Stop Conditions

- A future guard requires storing old/new note text to pass.
- Schema inspection finds body-history columns or payload blobs that were not
  explicitly approved.
- Any future test needs production D1 output, production logs, customer data, or
  real manual note bodies.

### Separate Future Implementation Goal Required

- Yes. Phase 1 requires a future explicit test/guard implementation goal.

## 6. Phase 2: Prove Manager / Export / API Visibility Remains Blocked

### Purpose

Add future tests/guards proving manager, export, and broad API manual note
visibility remains blocked under the conservative policy. Approved values are
`MANAGER_MANUAL_NOTE_VISIBILITY_ALLOWED: NO`,
`EXPORT_MANUAL_NOTE_VISIBILITY_ALLOWED: NO`, and
`API_MANUAL_NOTE_VISIBILITY_ALLOWED: NO`.

### Files Likely Affected

- `worker/lib/manual-review-notes-access.js`
- `worker/api/leads.js`
- `worker/api/serializers/lead-csv.js`
- `worker/pages/leads.js`
- `worker/pages/lead-detail.js`
- `worker/routes/metadata.js`
- `worker/tests/manual-review-notes.test.mjs`
- `worker/tests/lead-review-status.test.mjs`
- `worker/tests/route-dispatch.test.mjs`
- `worker/tests/route-boundaries.test.mjs`

### Allowed Future Changes

- Add or strengthen local/test role-stub assertions that manager, API, missing,
  and unknown roles cannot read/write protected manual note fields.
- Add export tests proving manual note fields and metadata stay omitted for
  non-reviewer roles under the local/test stub.
- Add route metadata or API contract tests only if they document the blocked
  boundary without expanding behavior.
- Add docs-only matrices for future reviewer-only, manager, export, and API
  approvals.

### Forbidden Changes

- Manager visibility expansion.
- Export/CSV manual note expansion.
- API exposure expansion for manual note text, timestamps, author labels, or
  metadata-history summaries.
- Full metadata event-list APIs or exports.
- Treating the C2 local/test role stub as real production auth.
- Adding production roles, sessions, identity, tokens, or access-control
  enforcement under this privacy phase.

### Required Tests

- `node --test worker/tests/manual-review-notes.test.mjs`
- Route/API targeted tests if changed:
  `node --test worker/tests/route-dispatch.test.mjs worker/tests/route-boundaries.test.mjs`
- `npm run check:naming`
- `npm run check:schema`
- `npm test`
- Assertions must cover read omission, write denial, CSV/export omission,
  protected metadata omission, and no generated-suggestion export.

### Rollback / Backout Notes

- Back out visibility changes by removing only the new tests or guards that
  caused regression.
- If future code accidentally exposes protected fields, restore omission/deny
  behavior and do not alter stored data.
- Do not change production access policy as part of rollback.

### Stop Conditions

- A future requirement asks managers, exports, or broad API clients to see
  manual notes without a new explicit owner decision.
- A future test depends on real production auth, real reviewer identity,
  production endpoint calls, or production exports.
- Existing compatibility is ambiguous enough that a broader access decision is
  needed before a safe guard can be written.

### Separate Future Implementation Goal Required

- Yes. Phase 2 requires a future explicit test/guard implementation goal.

## 7. Phase 3: Prove Generated Suggestions Cannot Enter Storage / History / Export / Attribution

### Purpose

Add future tests/guards proving generated reviewer note suggestions cannot enter
manual note storage, metadata history, exports, API payloads treated as saved
notes, timestamps, author labels, attribution, CRM, outreach, or
outcome-learning data paths.

### Files Likely Affected

- `worker/lib/lead-action-intelligence.js`
- `worker/db/leads.js`
- `worker/db/transform.js`
- `worker/api/leads.js`
- `worker/api/serializers/lead-csv.js`
- `worker/pages/leads.js`
- `worker/pages/lead-detail.js`
- `worker/tests/manual-review-notes.test.mjs`
- `worker/tests/lead-action-intelligence.test.mjs`
- `worker/tests/lead-review-status.test.mjs`
- `worker/tests/data-contract.test.mjs`

### Allowed Future Changes

- Add fixture coverage for all known generated-suggestion persistence aliases:
  `reviewNoteSuggestion`, `reviewerNoteSuggestion`,
  `reviewerNoteTemplates`, `generatedReviewerNoteSuggestion`,
  `generatedReviewNoteSuggestion`, `generatedSuggestionSnapshot`, and matching
  snake_case variants.
- Add assertions that mixed manual-note/generated-suggestion PATCH payloads are
  rejected atomically or otherwise preserve the existing safe semantics.
- Add tests proving generated suggestions do not update
  `manualReviewNotesUpdatedAt`, `manualReviewNotesAuthorLabel`, or
  `manual_review_note_events`.
- Add export/API absence tests for generated-suggestion fields.

### Forbidden Changes

- Generated suggestion persistence.
- Generated suggestion retention, history, export, attribution, analytics,
  CRM, outreach, LLM automation, or outcome-learning use.
- Generated suggestion backfill into `notes`, `manualReviewNotes`, metadata
  columns, event rows, CSV exports, evidence packets, or screenshots.
- Treating copied generated text as human-authored unless a human separately
  enters/saves final text under approved manual-note semantics.

### Required Tests

- `node --test worker/tests/manual-review-notes.test.mjs`
- `node --test worker/tests/lead-action-intelligence.test.mjs`
- API/data-contract targeted tests if changed:
  `node --test worker/tests/data-contract.test.mjs`
- `npm run check:naming`
- `npm run check:schema`
- `npm test`
- Assertions must cover patch rejection, batch refresh paths, export absence,
  no timestamp update, no author attribution, no history event, and no clearing
  of human notes by generated payloads.

### Rollback / Backout Notes

- Back out any test or guard that incorrectly treats helper text as saved data.
- If future code accidentally persists generated suggestion text, remove that
  persistence path and preserve human-entered manual note data.
- Do not run cleanup against production or customer data.

### Stop Conditions

- A future requirement asks for generated suggestion retention, export, history,
  attribution, CRM use, outreach use, outcome learning, LLM automation, or
  analytics without explicit new approval.
- A future test needs generated suggestions from production, customer data, or
  private reviewer notes.
- The implementation cannot prove separation between helper text and saved
  manual note text.

### Separate Future Implementation Goal Required

- Yes. Phase 3 requires a future explicit test/guard implementation goal.

## 8. Phase 4: Plan Future Retention Duration And Metadata Retention

### Purpose

Plan future retention duration and metadata retention after owner values are
supplied. Current unresolved values are
`MANUAL_NOTES_RETENTION_DURATION`,
`METADATA_EVENT_RETENTION_DURATION`, and
`EXPIRATION_OR_REVIEW_DATE`.

### Files Likely Affected

- `docs/roadmap/b2b-lead-agent-privacy-retention-implementation-plan.md`
- `docs/roadmap/b2b-lead-agent-privacy-owner-input-request.md`
- `docs/roadmap/b2b-lead-agent-privacy-owner-input-disposition.md`
- `docs/roadmap/current-pr-train.md`
- Future implementation files are intentionally not selected until owner
  values exist.

If a later explicit implementation goal is approved after owner values are
supplied, likely code/test surfaces may include:

- `worker/db/leads.js`
- `worker/db/schema.js`
- `worker/db/transform.js`
- `worker/schema.sql`
- `worker/api/leads.js`
- `worker/pages/leads.js`
- `worker/pages/lead-detail.js`
- `worker/tests/manual-review-notes.test.mjs`
- `worker/tests/d1-schema-contract.test.mjs`
- `tests/d1-schema-consistency.test.js`

### Allowed Future Changes

- Docs-only owner-value intake.
- Docs-only retention matrix updates after explicit owner input.
- Future test planning for selected current-note retention and metadata
  retention options.
- Future implementation only after exact durations, clear/delete survival
  rules, evidence rules, and owners are explicitly approved.

### Forbidden Changes

- Guessing retention duration.
- Guessing metadata retention duration.
- Adding retention clocks, jobs, purge schedules, tombstones, deletion
  workflows, migration files, API behavior, UI claims, or schema changes before
  owner values exist.
- Claiming that current clear behavior is retention purge or legal deletion.
- Using production data to infer retention policy.

### Required Tests

- Docs-only update tests: `git diff --check`, `git diff --cached --check`,
  `npm run check:naming`, `npm run check:schema`, and `npm test`.
- Future implementation tests, only after approval, must cover create/edit,
  clear, expiry, metadata survival or removal, clock/idempotency behavior,
  export/log/evidence boundaries, and generated-suggestion exclusion.

### Rollback / Backout Notes

- For docs-only changes, revert the owner-value planning update.
- For future implementation, prefer disabling/hiding new retention behavior
  over deleting stored data.
- Data deletion, purge, or metadata removal requires separate approval and must
  not be used as an automatic rollback.

### Stop Conditions

- Owner values are missing, ambiguous, expired, or scoped only to planning.
- The selected retention behavior would require production D1, destructive
  data action, or customer/private data access without explicit approval.
- Legal/privacy review is required and not complete.

### Separate Future Implementation Goal Required

- Yes. Phase 4 requires a future explicit goal after owner values are supplied.

## 9. Phase 5: Plan Future PII / Redaction / Purge Only After Owner Or Legal Decision

### Purpose

Plan future PII detection, redaction, and purge/delete only after explicit
owner/legal decisions. Current values are
`PII_DETECTION_REQUIRED: FUTURE_DECISION_REQUIRED`,
`REDACTION_REQUIRED: FUTURE_DECISION_REQUIRED`, and
`PURGE_DELETE_REQUIRED: FUTURE_DECISION_REQUIRED`.

### Files Likely Affected

- `docs/roadmap/b2b-lead-agent-privacy-retention-implementation-plan.md`
- `docs/roadmap/b2b-lead-agent-privacy-owner-input-request.md`
- `docs/roadmap/b2b-lead-agent-privacy-owner-input-disposition.md`
- `docs/roadmap/current-pr-train.md`
- No implementation file is selected until owner/legal decisions exist.

If a later explicit implementation goal is approved, likely surfaces may
include:

- `worker/api/leads.js`
- `worker/db/leads.js`
- `worker/db/transform.js`
- `worker/pages/leads.js`
- `worker/pages/lead-detail.js`
- `worker/api/serializers/lead-csv.js`
- `tests/release-evidence-redaction.test.js`
- `worker/tests/manual-review-notes.test.mjs`
- New local/test-only fixtures with synthetic data only, if approved

### Allowed Future Changes

- Docs-only decision intake for detection, redaction, purge/delete semantics,
  owners, false-positive/false-negative policy, fixture policy, evidence rules,
  and stop conditions.
- Future synthetic fixture tests after explicit approval.
- Future local/test-only proof of selected semantics after explicit approval.

### Forbidden Changes

- Implementing PII detection before owner/legal decision.
- Implementing redaction before owner/legal decision.
- Implementing purge/delete behavior before owner/legal decision.
- Running scanners on customer/private data.
- Reading production/staging logs, secrets, endpoint responses, D1 rows, CRM
  records, outreach messages, or LLM traces.
- Claiming compliance proof from warning copy, regex checks, local tests, or
  generated summaries.

### Required Tests

- Docs-only update tests: `git diff --check`, `git diff --cached --check`,
  `npm run check:naming`, `npm run check:schema`, and `npm test`.
- Future implementation tests, only after approval, must cover synthetic PII
  fixtures, non-sensitive fixtures, false-positive policy, false-negative risk
  notes, save/edit/clear, export/API/log/evidence redaction, generated
  suggestion exclusion, rollback/backout, and no customer/private data usage.

### Rollback / Backout Notes

- For docs-only changes, revert the planning update.
- For future implementation, prefer disabling new detection/redaction/purge
  behavior while preserving current note data unless a separate purge decision
  requires deletion.
- Do not delete data, run production cleanup, or mutate D1 as rollback without
  explicit DB/privacy/ops approval.

### Stop Conditions

- Owner/legal decision is missing or ambiguous.
- Fixture policy would require real PII, customer data, private note bodies, or
  production records.
- Implementation would require production proof, production endpoint calls,
  logs/secrets access, D1 access, CRM, outreach, LLM, automation, or private
  data.

### Separate Future Implementation Goal Required

- Yes. Phase 5 requires a future explicit owner/legal decision and a separate
  future implementation goal.

## 10. Approval Gates

Before any future implementation or test-guard work begins, require:

- Explicit future goal naming the selected phase.
- Clean repo preflight and pinned base branch SHA.
- Scope limited to docs/local/test/CI unless a later approval says otherwise.
- No production/staging/D1/endpoint/log/secret/customer-data access.
- No CRM, outreach, LLM, automation, or private data.
- Tests named before implementation starts.
- Rollback/backout notes for the exact files touched.
- Stop conditions copied into the future goal.

Additional gates before broader privacy/retention behavior:

- Retention duration supplied by owner.
- Metadata retention duration supplied by owner.
- Expiration or review date supplied by owner.
- Legal/privacy review completed if required.
- Auth/access-control decision and implementation plan completed if note
  visibility depends on roles.
- DB/API owner approval for schema, D1, migration, export, or API changes.
- Production privacy proof approval changed from `NO` by explicit owner action.

## 11. Unresolved Values Kept Open

The following remain unresolved and must stay unresolved in this plan:

- Retention duration.
- Metadata retention duration.
- Expiration or review date.
- PII detection implementation.
- Redaction implementation.
- Purge/delete implementation.
- Production privacy proof.

These unresolved values block implementation, production proof, production
deploy, production D1 access, endpoint calls, CRM, outreach, LLM, automation,
customer/private data access, and any compliance claim.

## 12. Blockers

Current blockers:

- Production reviewer workflow remains
  `STILL_BLOCKED_PENDING_AUTH_D1_ROLLBACK_PROOF`.
- Conservative privacy values are approved only for planning.
- Full retention duration is unresolved.
- Metadata retention duration is unresolved.
- Expiration/review date is unresolved.
- PII detection, redaction, and purge/delete implementation details are
  unresolved.
- Production privacy proof is not approved.
- Real auth/access-control implementation is not approved.
- Production D1, rollback/backout, observability/evidence, and production proof
  gates remain unresolved.

## 13. Next Recommended Cycle

Recommended next cycle for Level 1 production reviewer workflow:

```text
AUTH_ACCESS_CONTROL_IMPLEMENTATION_PLAN_DOCS_ONLY
```

Reason: production reviewer workflow remains blocked by real auth/access-control
alongside D1, rollback/backout, and proof gates. The conservative privacy plan
does not unlock production and does not authorize implementation.

Acceptable privacy-lane alternate if the owner wants privacy guard tests
planned before auth:

```text
PRIVACY_RETENTION_TEST_GUARD_IMPLEMENTATION_DOCS_ONLY
```

That alternate must still be docs/local/test only, must not begin production
proof, and must preserve all forbidden boundaries in this plan.

Final next decision remains:

```text
HOLD_PENDING_NEW_EXPLICIT_GOAL
```

## 14. Boundary Confirmation

This plan authorizes none of the following:

- implementation;
- privacy enforcement;
- PII detection;
- redaction;
- retention enforcement;
- purge/delete behavior;
- export-control behavior;
- auth, runtime, UI, API, schema, or database changes;
- staging or production access;
- production proof;
- production deploy;
- production D1 access;
- endpoint calls;
- logs/secrets access;
- CRM, outreach, LLM, or automation;
- customer/private data access.

Future implementation, proof, production access, D1 access, endpoint calls,
CRM, outreach, LLM, automation, customer/private data access, or compliance
claims require a separate explicit goal and approval boundary.
