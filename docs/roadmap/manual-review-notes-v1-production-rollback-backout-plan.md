# Manual Review Notes V1 Production Rollback / Backout Plan

This packet prepares a future Manual Review Notes v1 production rollback or
backout decision. It is documentation only. It does not execute rollback, run a
migration, create an executable rollback or migration file, access production
D1, write production D1, observe production D1 schema, run Wrangler production
commands, call production endpoints, read production logs or secrets, deploy,
mutate customer data, or change runtime/UI/schema/API behavior.

## Document Status

- Document status: `DRAFT_NOT_APPROVED_FOR_EXECUTION`.
- Approval-intent record:
  `https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4497893786`.
- Repository: `dooosp/b2b-lead-agent`.
- Default branch: `master`.
- Post-PR138 baseline inspected:
  `d0fb449f359c57d6a3747da76c455ea20ae13d32`.
- Scope: docs-only production rollback/backout planning for Manual Review Notes
  v1.
- Runtime behavior changed by this packet: none.
- UI behavior changed by this packet: none.
- Schema/API behavior changed by this packet: none.
- Rollback file created by this packet: none.
- Migration file created by this packet: none.
- Rollback performed by this packet: none.
- Production action performed by this packet: none.
- Production readiness claim made by this packet: none beyond "production
  rollback/backout plan prepared."

```yaml
manual_review_notes_v1_production_rollback_backout_plan:
  document_status: DRAFT_NOT_APPROVED_FOR_EXECUTION
  approval_record: "https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4497893786"
  scope: DOCS_ONLY_PRODUCTION_ROLLBACK_BACKOUT_PLAN
  post_pr138_baseline: "d0fb449f359c57d6a3747da76c455ea20ae13d32"
  production_rollback_execution_decision: HOLD
  production_d1_schema_observation_decision: HOLD
  production_d1_access_decision: HOLD
  production_d1_write_or_delete_decision: HOLD
  production_d1_migration_execution_decision: HOLD
  production_migration_backout_decision: HOLD
  destructive_data_action_decision: HOLD
  staging_or_local_rollback_rehearsal_decision: HOLD
  app_level_backout_implementation_decision: HOLD
  generated_suggestion_rollback_boundary: FORBIDDEN_TO_PERSIST_OR_REPOPULATE
  production_access_control_decision: HOLD
  production_retention_privacy_decision: HOLD
  production_proof_execution_decision: HOLD
  allowed_next_action: PLAN_ONLY
```

## 1. Current Local/Test Schema And Behavior State

Completed Manual Review Notes v1 records through the inspected baseline:

- PR #119 added the docs-only Option A implementation plan.
- PR #120 implemented local/test-safe save/read for human-entered manual notes.
- PR #121 implemented local/test-safe edit/update and clear/delete UX.
- PR #122 added saved/empty state clarity plus truthful lead-level timestamp
  labeling.
- PR #123 added the docs-only Manual Review Notes v1 data semantics decision
  packet.
- PR #124 implemented T1 local/test-safe note-specific timestamp support.
- PR #125 added the docs-only reviewer identity / author attribution decision
  packet.
- PR #126 implemented local/test-only generic non-PII manual reviewer label
  support.
- PR #127 added the docs-only note history/versioning decision packet.
- PR #128 implemented local/test-only H2 metadata-only manual note history.
- PR #129 added the docs-only retention/privacy policy decision packet.
- PR #130 implemented static local/test privacy warning copy.
- PR #131 added the docs-only production readiness gap packet.
- PR #132 added the docs-only access/visibility/export decision packet.
- PR #133 added the docs-only access-control plan.
- PR #134 synced source-of-truth docs after the access-control plan.
- PR #135 implemented only the C2 opt-in local/test role stub.
- PR #136 synced source-of-truth docs after the C2 role stub.
- PR #137 added the docs-only production proof plan.
- PR #138 added the docs-only production D1 migration plan.

Current local/test schema and behavior:

- `manualReviewNotes` maps to the current manual note value backed by the
  existing `leads.notes` row value.
- `manualReviewNotesProvenance` is `human_entered` only for non-empty saved
  manual notes.
- `manualReviewNotesUpdatedAt` maps to
  `manual_review_notes_updated_at`.
- `manualReviewNotesAuthorLabel` maps to
  `manual_review_notes_author_label`.
- `manual_review_note_events` stores metadata-only create/edit/clear events.
- Metadata-only history has no old manual note text and no new manual note
  text.
- Metadata-only history stores lead relationship, event type, timestamp, and
  the fixed generic `manual_reviewer` author label only.
- Generated reviewer note suggestions are excluded from saved notes and
  history.
- Direct generated-suggestion persistence payloads are rejected locally before
  manual note mutation.
- Batch generated/cache refresh paths clear generated note-like text before
  persistence.
- C2 role stub behavior is opt-in local/test only through
  `MANUAL_REVIEW_NOTES_LOCAL_TEST_ROLE_STUB=enabled` and
  `X-Manual-Review-Notes-Local-Test-Role`.
- C2 access metadata explicitly reports `realAuthImplemented: false` and
  `productionReady: false`.
- The privacy warning is warning-only reviewer guidance and not enforcement.
- Production D1 migration remains unexecuted and blocked.
- Production proof remains unexecuted and blocked.
- Production rollback/backout is prepared by this packet only and remains
  blocked.

## 2. Non-Authorizing Statement

This plan does not authorize production rollback.
This plan does not authorize production D1 access.
This plan does not authorize production D1 write.
This plan does not authorize production D1 delete.
This plan does not authorize production D1 schema observation.
This plan does not authorize production D1 migration.
This plan does not authorize production proof execution.
This plan does not authorize production deploy.
This plan does not authorize Wrangler production commands.
This plan does not authorize production endpoint calls.
This plan does not authorize production logs/secrets access.
This plan does not authorize production smoke tests.
This plan does not authorize customer data access or mutation.
This plan does not authorize runtime/UI/schema/API behavior changes.
This plan does not authorize executable rollback or migration files.
This plan is docs-only planning evidence.

No production D1 state, production schema, production migration status,
production rollback status, production endpoint behavior, production log
content, production secret value, customer-data state, or production
observation may be claimed from this packet.

## 3. Rollback Scenario Matrix

| Scenario | Current applicability | Risk | Safe response | Forbidden response | Evidence needed | Approval required | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S0: no production migration executed; no rollback needed | Current expected state. PR #138 is docs-only and this packet performs no production action. | Overreacting to a docs-only state could create unnecessary production risk. | Keep production execution on HOLD; document that no rollback is needed unless a future approved action occurs. | Running D1 rollback commands, deleting data, or claiming production state without approved observation. | Current repo SHA, PR/issue records, local docs validation, and explicit no-production-action record. | None for docs-only status; production observation still needs separate approval. | Keep as current baseline. |
| S1: migration planned but not run | Current state after PR #138 and this packet. | A plan may be mistaken for authorization to run or back out production commands. | Treat as planning-only. Require a future execution packet with exact target, commands, operators, stop conditions, and evidence rules. | Creating executable rollback files or running Wrangler/D1 commands from this plan. | Approval record for planning, PR diff showing docs-only scope, validation output. | Separate product/ops/DB approval before any execution. | Maintain HOLD. |
| S2: nullable columns added but write path not enabled | Future only; not observed in production. | Nullable columns may exist with nulls; deleting them could be destructive or more risky than leaving inert schema. | Prefer application-level stop-write or ignore-field backout. Leave nullable columns inert unless explicit schema rollback approval exists. | Dropping `manual_review_notes_updated_at` or `manual_review_notes_author_label` without separate approval, or fabricating backfills. | Approved production schema observation and exact migration record. | DB/product/ops approval for schema action; destructive approval if removal is requested. | Keep columns if inert; disable writes first. |
| S3: metadata-only event table created but no writes performed | Future only; not observed in production. | Inert table can be harmless, but table removal is still schema action. | Leave `manual_review_note_events` inert unless separately approved; block event writes at application level if needed. | Dropping the table merely to create a clean narrative or claiming it has no rows without observation. | Approved schema/table observation, write-path status, and evidence that no event writes were enabled. | DB/ops approval for table removal; production observation approval for row count claims. | Prefer inert retention over destructive rollback. |
| S4: writes performed in proof after explicit approval | Future only; no such proof is approved now. | Manual note current values and metadata events may be customer data or sensitive operational data. | Stop writes first, preserve data, collect only approved evidence, and decide separately whether to hide, ignore, retain, or delete. | Purging manual notes or metadata events to make tests pass, replaying generated suggestions, or fabricating proof success. | Approved proof scope, exact rows/actions, before/after evidence, access/privacy approvals, and rollback owner record. | Product/privacy/ops/DB approval; destructive data approval for any delete. | Preserve first; delete only with explicit privacy/product/ops decision. |
| S5: partial migration failure | Future only; possible if columns apply but table/index creation fails, or lazy DDL partly succeeds. | Mixed schema state can break writes or create inconsistent evidence. | Stop all dependent writes, document the last known successful step, keep successful nullable additions inert, and repair only through a separately approved plan. | Retrying broad production commands, dropping successful schema elements by default, or using unapproved customer rows for diagnosis. | Approved command log, exact failing step, target identity, schema observation approval, and non-secret error evidence. | DB/ops approval for repair/backout; production schema observation approval before claims. | Stop-write first; repair/backout decision second. |
| S6: generated-suggestion boundary failure detected | Future only; local tests currently reject/exclude generated suggestions. | Generated helper text could be wrongly treated as human-authored notes, history, attribution, retention, or export data. | Stop writes/export paths involving manual notes, preserve evidence without expanding exposure, and investigate locally/staging before any production repair. | Persisting generated suggestions as rollback artifacts, using generated suggestions to repopulate cleared notes, or deleting evidence without approval. | Exact field/path, local/staging reproduction, approved production evidence if production is involved, and generated-text redaction policy. | Product/privacy/ops approval before production repair; destructive approval before deletion. | Boundary violation blocks production proof/rollout. |
| S7: access-control/privacy gate failure detected | Future only; production access control and retention/privacy enforcement remain unimplemented. | Notes or metadata could be exposed to manager/API/export surfaces or retained without approved policy. | Stop or hide affected application surfaces only after explicit implementation approval; keep production claims conservative. | Treating C2 local/test stub as real auth, using deletion as unapproved privacy enforcement, or expanding export/API visibility. | Access matrix, role/auth decision, privacy/retention decision, local/staging tests, and approved evidence boundaries. | Product/privacy/auth/ops approval before implementation or production action. | Production rollout stays blocked until gates pass. |
| S8: rollback would require destructive data deletion | Future only; not authorized. | Data deletion can violate retention, audit, privacy, or customer obligations and can hide evidence. | Escalate to separate destructive-data decision; prefer stop-write, hide, ignore, or preserve data while deciding. | Dropping columns/table, deleting current notes/events, purging rows, or rewriting history without explicit approval. | Data inventory from approved observation, deletion rationale, impacted fields/rows, retention/privacy signoff, and recovery plan. | Separate privacy/product/ops/DB destructive-data approval. | Do not destructively rollback by default. |

Partial migration handling rule: any partial production migration state requires
an approved stop-write decision before repair or removal. The first response is
to prevent additional manual note writes/events and preserve evidence inside
the approved evidence boundary, not to delete schema or data.

## 4. No-Destructive-Data Rules

- Do not drop production columns without explicit approval.
- Do not drop `manual_review_note_events` without explicit approval.
- Do not delete manual note current values without explicit approval.
- Do not delete metadata-only history without explicit approval.
- Do not delete generated-suggestion boundary evidence without explicit
  approval.
- Do not purge production data to make tests pass.
- Do not fabricate rollback success.
- Do not fabricate "no data existed" claims without approved observation.
- Prefer disable, stop-write, hide, ignore, or app-level backout before
  destructive schema/data removal.
- Treat `leads.notes` as current-value data that may contain human-entered
  manual notes or older note values; do not rewrite it without approval.
- Treat `manual_review_notes_updated_at` and
  `manual_review_notes_author_label` as nullable metadata; do not force values
  into old rows.
- Treat `manual_review_note_events` as metadata-only history; do not delete or
  backfill rows without approval.
- Any destructive production rollback requires separate privacy, product, ops,
  and DB approval.

## 5. Nullable Column Backout Semantics

Plan-only nullable behavior:

- `manual_review_notes_updated_at` may be nullable.
- `manual_review_notes_author_label` may be nullable.
- Existing nulls must not be treated as errors.
- Existing nulls must not be used as a reason to fabricate timestamps or author
  labels.
- Rollback should not fabricate null-to-value backfills.
- Rollback should not fabricate timestamps from lead-level `updated_at`.
- Rollback should not fabricate author labels from old note text.
- Rollback should not infer provenance for existing note values.
- Disabling writes may be safer than dropping columns.
- Leaving nullable columns inert may be safer than destructive schema removal.
- Production behavior cannot be claimed without approved production D1
  observation.

Backout interpretation:

- A null `manual_review_notes_updated_at` means no note-specific timestamp is
  recorded in the row; it does not prove that no manual note exists.
- A null `manual_review_notes_author_label` means no fixed author label is
  recorded in the row; it does not prove who entered or did not enter a note.
- A non-empty `notes` value may be current manual note text locally, but
  production provenance remains unclaimed until separately approved and
  observed.

## 6. Metadata-Only History Backout Plan

Plan-only metadata history behavior:

- `manual_review_note_events` stores metadata only.
- Event rows contain lead relationship, event type, timestamp, and the fixed
  generic `manual_reviewer` label only.
- No old manual note text exists in history by design.
- No new manual note text exists in history by design.
- No generated suggestion text exists in history by design.
- No real reviewer identity exists in history by design.
- No legal/audit retention claim is created by this metadata-only table.

Backout handling:

- If table creation succeeds but writes are not enabled, keep the table inert
  unless explicit rollback approval says otherwise.
- If metadata events exist, do not delete them without explicit approval.
- If event write behavior fails, stop writes first.
- If event summary reads fail, hide or ignore summaries only after explicit
  app-level implementation approval.
- Do not add old/new note text columns during rollback.
- Do not add generated suggestion content during rollback.
- Do not write generated suggestion content as a rollback artifact.
- Do not mutate `author_label` into a real name, email, or authenticated
  identity during rollback.
- Do not claim audit/legal completeness from metadata-only event rows.

## 7. Application-Level Backout Plan

This packet makes no runtime changes. The options below are future
implementation candidates only and require separate approval:

| App-level option | What it could do | Data preservation stance | Required approval |
| --- | --- | --- | --- |
| Disable manual note writes | Reject or hide write affordances for `manualReviewNotes` while preserving existing data. | Preserve `notes`, nullable metadata columns, and metadata event rows. | Runtime/API/UI implementation approval plus local/staging tests. |
| Hide manual note UI affordance | Remove or hide save/clear controls while keeping reads or current data untouched. | Preserve all existing values and metadata. | UI/runtime implementation approval. |
| Read-only manual notes | Show existing current notes to approved roles but block edits/clears/events. | Preserve current values and metadata history. | Product/access/privacy approval and tests. |
| Ignore metadata summaries | Stop showing event counts/last event metadata while preserving table rows. | Preserve metadata-only history. | Runtime/API/UI implementation approval. |
| Revert to local/test-only path | Keep production surfaces disabled while retaining local/test evidence. | Preserve production data; do not claim production behavior. | Product/ops approval before deploy. |

Future app-level backout implementation must preserve:

- Generated-suggestion copy-only boundary.
- Privacy/evidence boundaries.
- No-destructive-data rules.
- Access-control gates.
- Retention/privacy gates.
- Separation between local/staging evidence and production evidence.

## 8. Production D1 / Wrangler Boundary

- No production D1 commands are run now.
- No Wrangler production command is run now.
- No production D1 schema observation is run now.
- No production D1 migration is run now.
- No production D1 write or delete is run now.
- No production endpoint call is run now.
- No production logs or secrets are read now.

Any future production D1 or Wrangler action needs:

- Exact command.
- Exact target account/environment/database.
- Exact operator.
- Exact execution window if relevant.
- Separate approval record for schema observation, migration, write, delete, or
  rollback.
- Rollback/backout owner.
- Stop criteria.
- Evidence plan.
- Redaction policy.
- Confirmation that generated suggestions remain excluded.
- Confirmation that destructive data action is HOLD unless explicitly approved.

Production D1 schema observation itself requires explicit approval. A schema
read is not a harmless local validation step in this repository's production
boundary.

## 9. Local / Staging Rehearsal Plan

The steps below are safe only when pointed at local/fake-D1 or separately
approved staging targets. They must not use production D1, production secrets,
production endpoints, production logs, customer data, or Wrangler production
commands.

| Rehearsal step | Command or action | Purpose |
| --- | --- | --- |
| Fresh worktree | `git fetch origin master`; create a fresh worktree from pinned `origin/master`. | Avoid dirty checkout or stale branch contamination. |
| Install dependencies | `npm ci`. | Reproduce local validation with lockfile-backed dependencies. |
| Schema consistency | `npm run check:schema`. | Verify local schema sources agree on nullable columns and metadata-only event table. |
| Naming guard | `npm run check:naming`. | Confirm canonical path and workflow naming rules still pass. |
| Focused schema tests | `node --test tests/d1-schema-consistency.test.js worker/tests/d1-schema-contract.test.mjs`. | Cover schema parser and D1 schema contract expectations. |
| Manual notes API tests | `node --test worker/tests/manual-review-notes.test.mjs`. | Cover save/edit/clear, nullable metadata, metadata-only history, role stub, export omission, and generated-suggestion rejection. |
| Worker tests | `npm run test:worker`. | Cover combined Worker unit and contract gates. |
| Full local gate | `npm test`. | Cover root plus Worker gates. |
| Fake-D1 local E2E | `npm run test:e2e:local`. | Rehearse local loopback reviewer flows without production targets. |
| Fake-D1 migration rehearsal | Use fake-D1/local test helpers or staging-only D1 after separate staging approval. | Rehearse adding nullable columns, creating event table/index, and stopping writes after partial failure. |
| Fake-D1 rollback/backout rehearsal | Disable writes or ignore fields in a local branch only after separate implementation approval. | Prove app-level backout behavior without deleting production data. |
| Generated suggestion boundary tests | Existing generated-suggestion rejection/exclusion tests in manual notes and E2E suites. | Verify generated suggestions cannot persist, repopulate notes, update metadata, create events, export, or gain attribution. |
| Local role-stub tests | C2 role-stub tests with `MANUAL_REVIEW_NOTES_LOCAL_TEST_ROLE_STUB=enabled`. | Confirm `reviewer` access and `manager`/`api`/missing/unknown denials remain local/test-only. |
| Evidence review | Inspect diff, PR body, and docs for no-production-action claims. | Prevent local/staging results from being overclaimed as production rollback. |

Local/staging rehearsal is not production rollback. Staging behavior is not
production D1 behavior unless a later approved packet explicitly defines the
target and evidence boundary.

## 10. Generated Suggestion Rollback Boundary

Generated reviewer note suggestions must not be persisted during rollback.
Generated reviewer note suggestions must not be used as replacement manual note
values.
Generated reviewer note suggestions must not be used to repopulate cleared
notes.
Generated reviewer note suggestions must not create metadata events.
Generated reviewer note suggestions must not be exported.
Generated reviewer note suggestions must not be attributed to a reviewer.
Generated reviewer note suggestions must not update
`manual_review_notes_updated_at`.
Generated reviewer note suggestions must not set
`manual_review_notes_author_label`.
Generated reviewer note suggestions must not be copied into
`manual_review_note_events`.
Generated reviewer note suggestions must not be used to prove rollback success.

If a future rollback proof is approved, it must verify:

- Generated-suggestion patch aliases still fail atomically.
- Existing human-entered notes are not overwritten by generated suggestions.
- Clearing a human note cannot be done through generated-suggestion payloads.
- Batch generated/cache refresh paths do not persist generated note-like text.
- Event history contains no generated suggestion text.
- Export/API surfaces do not add generated suggestion persistence/history fields.

## 11. Access / Privacy / Retention Backout Gates

- C2 local/test role stub is not production auth.
- C2 local/test role stub is not production access control.
- C2 local/test metadata reports `realAuthImplemented: false` and
  `productionReady: false`.
- Production access-control remains unimplemented.
- Real auth/session/identity remains unimplemented.
- Manager visibility expansion remains unapproved.
- Export/API expansion remains unapproved.
- Privacy warning is not enforcement.
- Retention/privacy enforcement remains unimplemented.
- Purge/delete jobs remain unimplemented and unapproved.
- Redaction and automated PII detection remain unimplemented and unapproved.
- Rollback cannot claim privacy compliance.
- Rollback cannot use unapproved data deletion as privacy enforcement.
- Production backout cannot expose notes to manager/export/API without
  approval.
- Production backout cannot create old/new note value history.
- Production backout cannot create full note text history.
- Production backout cannot introduce real reviewer names or emails.

Before production rollback/backout execution, require explicit approvals for:

- Reviewer/manager/API/export visibility matrix.
- Auth/role/session source.
- Retention policy for current note values.
- Retention policy for metadata-only history.
- Clear/delete semantics.
- Evidence redaction/storage.
- Incident owner and escalation path.
- Destructive-data decision if deletion is requested.

## 12. Evidence and Anti-Overclaim Rules

- Local/fake-D1 rollback rehearsal is not production rollback.
- Staging rollback rehearsal is not production rollback unless a future packet
  explicitly approves and defines that target.
- Docs are not production evidence.
- CI is not production rollback proof.
- PR merge is not production observation.
- GitHub issue comments are approval/evidence records only for the exact scope
  they name.
- Source files are not production D1 state.
- `npm run check:schema` proves local source consistency only.
- Local tests prove local behavior only.
- Generated reports are not external/runtime evidence.
- Production rollback cannot be claimed without approved execution evidence.
- Production D1 state cannot be claimed without approved production D1
  observation.
- A successful production migration, if later approved, would not automatically
  prove rollback readiness.
- A successful rollback rehearsal would not automatically approve destructive
  production rollback.
- A null field cannot be overclaimed as absence of human-entered notes.
- Metadata-only history cannot be overclaimed as audit/legal history.
- Warning copy cannot be overclaimed as privacy enforcement.
- C2 local/test role stub cannot be overclaimed as production access control.

## 13. Future Approval Blocks

Any future production rollback/backout packet must replace the `HOLD` values
below with explicit approvals, exact targets, owners, commands or implementation
scope, evidence rules, and stop criteria. This packet does not satisfy those
execution approvals.

```yaml
manual_review_notes_v1_production_rollback_execution:
  document_status: NOT_APPROVED
  based_on_plan: "docs/roadmap/manual-review-notes-v1-production-rollback-backout-plan.md"
  required_current_master_sha: null
  production_target: null
  operator: null
  rollback_owner: null
  evidence_owner: null
  privacy_owner: null
  production_rollback_execution_decision: HOLD
  production_d1_schema_observation_decision: HOLD
  production_d1_access_decision: HOLD
  production_d1_write_or_delete_decision: HOLD
  production_migration_backout_decision: HOLD
  destructive_data_action_decision: HOLD
  app_level_backout_implementation_decision: HOLD
  generated_suggestion_rollback_boundary: FORBIDDEN_TO_PERSIST_OR_REPOPULATE
  access_control_production_decision: HOLD
  retention_privacy_production_decision: HOLD
  customer_data_handling_decision: HOLD
  logs_secrets_access_decision: HOLD
  production_endpoint_call_decision: HOLD
  production_smoke_test_decision: HOLD
  production_observation_claim_decision: HOLD
  no_destructive_data_default: REQUIRED
  allowed_next_action: HOLD_UNTIL_EXPLICIT_APPROVAL
```

Template for a future non-production rehearsal approval:

```yaml
manual_review_notes_v1_local_or_staging_rollback_rehearsal:
  document_status: NOT_APPROVED
  target_type: LOCAL_OR_STAGING_ONLY
  production_target_allowed: false
  exact_target: null
  rehearsal_commands_or_steps: null
  destructive_data_action_decision: HOLD
  generated_suggestion_rollback_boundary: FORBIDDEN_TO_PERSIST_OR_REPOPULATE
  evidence_boundary: LOCAL_OR_STAGING_ONLY
  production_observation_claim_decision: HOLD
  allowed_next_action: HOLD_UNTIL_EXPLICIT_APPROVAL
```

## Recommended Next State

After this packet lands, the safest state is:

- Manual Review Notes v1 production rollback/backout is plan-ready.
- Manual Review Notes v1 production rollback/backout execution remains blocked.
- Manual Review Notes v1 production D1 migration remains plan-ready and
  blocked.
- Manual Review Notes v1 production proof remains plan-ready and blocked.
- The next safe work is local/docs-only approval packet preparation or local
  rehearsal planning, not production execution.
