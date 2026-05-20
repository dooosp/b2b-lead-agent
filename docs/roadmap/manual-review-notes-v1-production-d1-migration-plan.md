# Manual Review Notes V1 Production D1 Migration Plan

This packet prepares a future Manual Review Notes v1 production D1 migration
decision. It is documentation only. It does not execute a migration, create an
executable migration file, access production D1, write production D1, run
Wrangler production commands, call production endpoints, read production logs or
secrets, deploy, mutate customer data, or change runtime/UI/schema/API
behavior.

## Document Status

- Document status: `DRAFT_NOT_APPROVED_FOR_EXECUTION`.
- Approval record:
  `https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4497697004`.
- Repository: `dooosp/b2b-lead-agent`.
- Default branch: `master`.
- Post-PR137 baseline inspected:
  `f1bfd573cb9a6c15dcc27097668dc99e3b2dca19`.
- Scope: docs-only production D1 migration planning for Manual Review Notes v1.
- Runtime behavior changed by this packet: none.
- UI behavior changed by this packet: none.
- Schema/API behavior changed by this packet: none.
- Migration file created by this packet: none.
- D1 migration performed by this packet: none.
- Production action performed by this packet: none.
- Production readiness claim made by this packet: none beyond "production D1
  migration plan prepared."

```yaml
manual_review_notes_v1_production_d1_migration_plan:
  document_status: DRAFT_NOT_APPROVED_FOR_EXECUTION
  approval_record: "https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4497697004"
  scope: DOCS_ONLY_PRODUCTION_D1_MIGRATION_PLAN
  post_pr137_baseline: "f1bfd573cb9a6c15dcc27097668dc99e3b2dca19"
  production_d1_schema_observation_decision: HOLD
  production_d1_migration_execution_decision: HOLD
  production_d1_write_decision: HOLD
  production_rollback_execution_decision: HOLD
  staging_or_local_rehearsal_decision: HOLD
  migration_order_decision: HOLD
  backfill_decision: HOLD
  generated_suggestion_persistence: FORBIDDEN
  production_proof_execution_decision: HOLD
  allowed_next_action: PLAN_ONLY
```

## 1. Current Local/Test Schema State

Completed local/test implementation and decision records:

- PR #120 implemented local/test-safe save/read for human-entered manual notes.
- PR #121 implemented local/test-safe edit/update and clear/delete hardening.
- PR #122 added saved/empty state clarity plus truthful lead-level timestamp
  labeling.
- PR #123 added the docs-only data semantics decision packet.
- PR #124 implemented local/test-safe note-specific timestamp support.
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

Current local/test schema and data-contract state:

- `manualReviewNotes` maps to the current manual note value backed by the
  existing `leads.notes` column.
- `manualReviewNotesProvenance` is `human_entered` only for non-empty saved
  manual notes.
- `manualReviewNotesUpdatedAt` maps to
  `manual_review_notes_updated_at`.
- `manualReviewNotesAuthorLabel` maps to
  `manual_review_notes_author_label`.
- `manual_review_note_events` stores metadata-only create/edit/clear events.
- Metadata-only history has no old note text and no new note text.
- Generated reviewer note suggestions are excluded from saved notes and
  metadata history.
- The C2 role stub is local/test-only and not production access control.
- The privacy warning is warning-only and not retention/privacy enforcement.

## 2. Non-Authorizing Statement

This plan does not authorize production D1 access.
This plan does not authorize production D1 migration.
This plan does not authorize production D1 write.
This plan does not authorize production proof execution.
This plan does not authorize production deploy.
This plan does not authorize Wrangler production commands.
This plan does not authorize production endpoint calls.
This plan does not authorize production logs/secrets access.
This plan is docs-only planning evidence.

No production D1 state, production migration status, production endpoint
behavior, production log content, production secret value, customer-data state,
or production observation may be claimed from this packet.

## 3. Schema Inventory

The inventory below describes current local/test schema and behavior. Production
state remains unknown because this packet does not inspect production D1.

| Element | Local/test state | Production migration implication | Nullable/backfill behavior | Rollback consideration | Tests needed before execution | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| `leads.notes` | Existing current manual note value backing `manualReviewNotes`; batch generated/cache refresh paths clear incoming generated note-like text before persistence. | Future production migration does not need a new current-value column if the selected policy keeps this mapping. Production compatibility still needs approved schema observation before relying on it. | Existing values remain current values only. Do not infer provenance for generated/cache-origin text. | Avoid destructive deletion. A code backout can ignore manual-note UI/API paths while preserving existing `notes` values. | Manual note save/edit/clear tests, batch refresh preservation tests, generated note-like batch insert tests. | High because free text can contain sensitive sales context or PII. |
| `manual_review_notes_updated_at` | Nullable `TEXT` column in `worker/schema.sql`, `worker/db/schema.js`, and lazy `ALTER TABLE`; backs `manualReviewNotesUpdatedAt`. | Add as nullable before write paths depend on it if production lacks it. Production observation and migration require separate approval. | Existing rows may remain null. Do not fabricate from lead-level `updated_at`. Do not backfill for generated suggestions. | Prefer code ignore/backout over destructive schema rollback. Dropping a column in D1 would require a separate approved migration strategy. | `npm run check:schema`, PATCH save/edit/clear timestamp tests, unchanged-save tests, unrelated-patch tests, generated-payload rejection tests. | Medium. Activity timing can be sensitive and can be overclaimed as audit evidence. |
| `manual_review_notes_author_label` | Nullable `TEXT` column in schema sources and lazy `ALTER TABLE`; only accepted value is fixed `manual_reviewer` through local/test write helpers. | Add as nullable before write paths rely on it if production lacks it. It is not real identity. | Existing rows may remain null. Do not fabricate labels for old values or unchanged saves. | Code can ignore the field if backout is needed. Destructive column removal requires separate approval. | Generic-label tests, unchanged-save no-invented-label tests, generated-payload no-attribution tests. | Medium. The fixed label can be mistaken for authenticated reviewer identity. |
| `ensureD1Schema()` lazy `ALTER TABLE` logic | Adds `manual_review_notes_author_label` and `manual_review_notes_updated_at` if missing; creates `manual_review_note_events` and index. | Future production execution must decide whether lazy DDL is allowed, disabled, or replaced by an explicit migration. Any production path that invokes `ensureD1Schema()` can become a schema action. | Lazy add keeps nullable metadata columns. It does not backfill. | If lazy DDL partially applies, backout must know whether to leave nullable schema in place, block writes, or run a separately approved repair. | Schema consistency check, fake-D1/staging rehearsal, partial-failure rehearsal if available. | High because accidental production route calls could become migration-like actions. |
| `manual_review_note_events` table | Created locally/test with `id`, `lead_id`, `event_type`, `changed_at`, and `author_label`. | Create before any future production event inserts. Do not create old/new text columns. | No history backfill. Existing saved notes must not get fabricated events. | Code can stop writing/reading summary; event rows should not be deleted without retention/privacy/ops approval. | DDL consistency tests, create/edit/clear event tests, summary tests, no-text-retention tests. | Medium to high. Metadata-only activity can still be sensitive and can be mistaken for legal/audit history. |
| `manual_review_note_events.event_type` | `TEXT NOT NULL CHECK (event_type IN ('create', 'edit', 'clear'))`; code conventions match `create`, `edit`, `clear`. | Future migration must preserve the constrained event set unless a later decision expands it. | No synthetic events for old rows. Clear is explicit only when accepted patch changes current value to empty. | If invalid rows appear in rehearsal, stop. Production repair needs separate approval. | Event-type constraint/source consistency tests and create/edit/clear path tests. | Medium. Event semantics can be overclaimed or misread if backfilled. |
| `manual_review_note_events.author_label` | `TEXT NOT NULL DEFAULT 'manual_reviewer' CHECK (author_label = 'manual_reviewer')`; no real identity. | Future production migration must not add real reviewer identity fields unless a separate auth/privacy decision approves them. | No author-label backfill for historical values or generated suggestions. | Do not mutate metadata rows to names/emails without separate approval. | Fixed-label event tests and no-real-identity UI/API tests. | Medium. Actor metadata can create privacy and audit expectations. |
| `idx_manual_review_note_events_lead` | Index on `(lead_id, changed_at DESC)` for local/test history summary lookup. | Add only if event table is approved and query shape remains the same. Additional indexes require approved performance rationale. | No backfill. Index creation is schema action and needs approval in production. | Index removal is a schema action and needs separate approval. | Schema check, fake-D1/staging migration rehearsal, event summary query tests. | Low to medium. Index DDL can fail or lock/consume quota. |
| Transform/API fields | `rowToLead()` exposes `manualReviewNotes`, provenance, fixed author label, note timestamp, and metadata summary fields. `PATCH /api/leads/:id` accepts `manualReviewNotes` and compatible `notes`. | Production compatibility requires schema presence before writes and approved access-control/privacy gates before exposing fields. | Null timestamp/author values remain null/empty in payloads. Empty notes have empty provenance. | Code rollback can omit/hide fields; data remains. | Serializer/transform tests, PATCH save/edit/clear, unchanged-save, unrelated-patch, C2 role-stub tests. | High because API payloads can expose note text or metadata. |
| CSV/export compatibility | Existing CSV `메모` column serializes `lead.manualReviewNotes || lead.notes`; no metadata-history or generated-suggestion export fields are added. | Existing compatibility must be audited before production export claims. Do not add new export fields during migration. | No generated suggestions or metadata fields should be backfilled into exports. | Export behavior can be disabled/filtered by code only after separate approval. | CSV tests for no generated suggestion fields, no history metadata expansion, C2 role-stub export omission for non-reviewers. | High because CSV files are portable and retention-prone. |
| Generated suggestion fields | Forbidden patch aliases include `reviewNoteSuggestion`, `reviewerNoteSuggestion`, `reviewerNoteTemplates`, `generatedReviewerNoteSuggestion`, `generatedReviewNoteSuggestion`, and `generatedSuggestionSnapshot` snake_case variants. | Future migration must not create generated suggestion persistence columns/tables/history. | No generated suggestion backfill into `notes`, metadata columns, events, exports, or history. | If generated suggestion data is found in rehearsal, stop and investigate without production repair unless approved. | Generated-payload rejection, atomic rejection, cannot-clear-human-note, batch-insert exclusion, export absence tests. | High. Violating this boundary changes product/data semantics and privacy posture. |
| C2 local/test role stub | Opt-in only through `MANUAL_REVIEW_NOTES_LOCAL_TEST_ROLE_STUB=enabled` and `X-Manual-Review-Notes-Local-Test-Role`; metadata reports `realAuthImplemented: false` and `productionReady: false`. | Not a production migration prerequisite except as local test evidence. Production access control remains unimplemented. | No data backfill. No production role mapping. | Disable env flag locally; production must not rely on it as auth. | Reviewer/manager/api/missing-role tests, metadata tests. | Medium. Easy to overclaim as production auth. |
| Static privacy warning | Local/test reviewer guidance only; no detection, blocking, redaction, purge, or retention enforcement. | Not a production compliance gate. Future production migration needs privacy/retention decisions before saved-note use. | No data backfill. No PII inference. | Copy can be removed or revised by code/docs; existing text data remains governed by separate policy. | UI/copy tests, no sensitive-content API field tests. | High if mistaken for enforcement or compliance evidence. |

## 4. Migration Ordering Plan

This is a plan-only order for a future separately approved migration. Every
production observation, command, write, migration, postcheck, and rollback step
remains `HOLD`.

1. Verify repo and approval state.
   - Pin current `origin/master` SHA.
   - Confirm production target environment, D1 database identity, operators,
     owners, evidence path, rollback owner, and stop criteria.
   - Confirm the approval record names production schema observation and, if
     relevant, migration execution.
2. Verify production schema state first, if later approved.
   - Observe only the exact approved schema metadata.
   - Stop if target identity, schema observation command, or evidence boundary
     is unclear.
3. Add nullable lead metadata columns before relying on them.
   - `manual_review_notes_updated_at TEXT`
   - `manual_review_notes_author_label TEXT`
   - Avoid `NOT NULL` constraints because existing rows may not have accepted
     human-entered manual note changes.
4. Create metadata-only event table before writing events.
   - Create `manual_review_note_events` with only metadata columns.
   - Do not add old note text, new note text, generated suggestion text, real
     reviewer identity, email, display name, or audit-source fields.
5. Add indexes only if needed and approved.
   - Current candidate index is `idx_manual_review_note_events_lead` on
     `(lead_id, changed_at DESC)`.
   - Additional indexes require separate performance and rollback rationale.
6. Avoid data backfill that fabricates author, timestamp, or history.
   - Do not backfill timestamps from `updated_at`.
   - Do not backfill `manual_reviewer` for older values.
   - Do not backfill metadata-history events for existing rows.
7. Do not backfill generated suggestions.
   - Generated helper text must not become manual note text, metadata, history,
     attribution, retention, export, or evidence.
8. Verify read compatibility before write path activation.
   - Existing rows with null metadata must serialize safely.
   - Manual note field visibility must remain access-gated by the selected
     access model.
9. Verify rollback/backout plan before proof.
   - A future migration cannot proceed until partial migration failure and
     non-destructive backout behavior are approved.
10. Keep production proof execution blocked.
   - Migration planning does not authorize proof execution or production smoke
     tests.

## 5. Nullable / Backfill Semantics

- Existing rows may have null `manual_review_notes_updated_at`.
- Existing rows may have null `manual_review_notes_author_label`.
- Existing rows must not get fabricated timestamp or author label.
- Metadata history must not be backfilled with fake events.
- Generated suggestions must not be backfilled into manual note fields.
- Current-value manual notes should remain current value only.
- Clearing behavior must remain explicit through accepted
  `manualReviewNotes: ""` changes.
- Lead-level `updated_at` must remain lead-level only and must not be relabeled
  as note-specific save/edit/clear time.
- Empty notes have empty provenance, even if note metadata exists for a prior
  clear event.
- Existing current-value note text does not prove who entered it or when it was
  entered unless separately observed and approved.

## 6. Metadata-Only History Migration Plan

Expected table shape:

```sql
CREATE TABLE IF NOT EXISTS manual_review_note_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('create', 'edit', 'clear')),
  changed_at TEXT NOT NULL,
  author_label TEXT NOT NULL DEFAULT 'manual_reviewer' CHECK (author_label = 'manual_reviewer')
);
```

Expected lookup index:

```sql
CREATE INDEX IF NOT EXISTS idx_manual_review_note_events_lead
  ON manual_review_note_events(lead_id, changed_at DESC);
```

Plan-only constraints:

- Allowed event types: `create`, `edit`, and `clear`.
- No old note text fields.
- No new note text fields.
- No generated suggestion content.
- No real reviewer identity.
- No reviewer email or display name.
- Lead relationship is through `lead_id`; any stronger foreign-key policy needs
  a separate schema/rollback decision.
- Event timestamps must be generated only for accepted human-entered manual note
  create/edit/clear changes.
- Event author label must remain the fixed generic `manual_reviewer` unless a
  later real-auth/privacy decision approves a different model.
- Metadata-only history is not audit/legal retention proof.
- Production exposure of event rows or summaries remains gated by access,
  retention/privacy, export/API, and evidence approvals.

## 7. Compatibility Checks

Before any future production execution, the following checks must be completed
locally and, if available and separately approved, on a non-production target:

- `npm run check:schema` result.
- Transform and serializer compatibility for null metadata fields.
- `PATCH /api/leads/:id` save/edit/clear behavior.
- Unchanged-save behavior.
- Unrelated-patch behavior.
- Generated payload rejection.
- Generated payload atomic rejection when mixed with manual-note changes.
- Generated payload cannot clear existing human-entered manual notes.
- Batch generated/cache refreshes do not create saved manual notes.
- Local role-stub behavior remains local-only and reports
  `realAuthImplemented: false` and `productionReady: false`.
- No export expansion.
- No manager visibility expansion.
- No production auth claim.
- Local E2E passes.
- Migration dry-run or rehearsal on non-production target only, if available and
  separately approved.

Compatibility checks are not production proof unless a separate approval record
authorizes the exact production observation and evidence boundary.

## 8. Local / Staging Rehearsal Plan

Safe non-production rehearsal steps:

1. Create a fresh worktree from pinned `origin/master`.
2. Run `npm ci`.
3. Run `npm run check:schema`.
4. Run focused schema consistency tests if needed:
   `node --test tests/d1-schema-consistency.test.js worker/tests/d1-schema-contract.test.mjs`.
5. Run manual notes API tests:
   `node --test worker/tests/manual-review-notes.test.mjs`.
6. Run generated suggestion boundary tests through the same manual notes suite.
7. Run fake-D1 migration rehearsal through local/fake-D1 tests only.
8. Run local role-stub tests through the manual notes suite.
9. Run local E2E:
   `npm run test:e2e:local`.
10. Run rollback rehearsal only on local/staging data.
11. Run broader local gates as required by the change:
    `npm run check:naming`, `npm test`, and `npm run eval:lead-quality`.

Rehearsal restrictions:

- No production target.
- No production secrets.
- No production D1.
- No production Worker endpoints.
- No Wrangler production commands.
- No production logs.
- No production smoke tests.
- No customer data access or mutation.

## 9. Rollback / Backout Planning

This is plan-only. Rollback execution requires separate approval.

Rollback/backout questions:

- For added nullable columns, is the approved backout to leave columns in place
  and deploy code that ignores them, or to run a destructive schema rollback?
- For `manual_review_note_events`, is the approved backout to stop writes,
  ignore rows, hide summaries, or delete rows?
- Is data deletion required, unsafe, or forbidden under the selected retention
  policy?
- How will a partial migration be detected if lead columns are added but event
  table creation fails?
- How will a partial migration be detected if event table exists but index
  creation fails?
- What evidence is allowed to prove backout without exposing note text,
  generated suggestion text, auth material, or customer payloads?
- Who owns rollback execution, evidence review, incident response, and customer
  communication?

Conservative backout stance:

- Prefer non-destructive code backout or feature disablement over dropping
  columns or deleting rows.
- Do not delete current manual note text, metadata columns, event rows, or
  indexes without separate DB/privacy/ops approval.
- Stop on any production schema mismatch, unexpected generated suggestion
  persistence, unclear target, missing owner, or unsafe evidence boundary.

## 10. Generated Suggestion Exclusion Checklist

Generated reviewer note suggestions are not manual notes.

Any future migration or proof must verify that generated suggestions are:

- [ ] not saved,
- [ ] not persisted,
- [ ] not snapshotted,
- [ ] not backfilled,
- [ ] not history events,
- [ ] not exported,
- [ ] not attributed to a reviewer,
- [ ] not retained,
- [ ] not shown as saved notes,
- [ ] not treated as human-authored notes,
- [ ] not stored in `leads.notes`,
- [ ] not stored in `manual_review_notes_updated_at`,
- [ ] not stored in `manual_review_notes_author_label`,
- [ ] not stored in `manual_review_note_events`,
- [ ] not allowed to update `manualReviewNotesUpdatedAt`,
- [ ] not allowed to update `manualReviewNotesAuthorLabel`,
- [ ] not allowed to clear existing human-entered manual notes,
- [ ] still rejected for generated suggestion patch aliases,
- [ ] absent from CSV/export fields,
- [ ] absent from migration schema additions.

Migration must not create generated suggestion persistence. Migration proof must
explicitly verify this if later approved.

## 11. Access / Privacy / Retention Gates

- C2 local/test role stub is not production auth.
- Production access-control remains unimplemented.
- Real auth/session/identity remains unimplemented.
- Production role controls remain unimplemented.
- Manager visibility expansion remains unapproved.
- Export expansion remains unapproved.
- API exposure expansion remains unapproved.
- Privacy warning is not enforcement.
- Retention/privacy enforcement remains unimplemented.
- Automated PII detection remains unimplemented.
- Redaction remains unimplemented.
- Purge/delete jobs remain unimplemented.
- Metadata-only history is not audit/legal retention proof.
- Production migration cannot be used to claim privacy compliance.
- Production migration cannot be used to claim manager/export readiness.
- Production migration cannot be used to claim generated suggestion compliance
  unless the approved proof explicitly verifies that boundary.

## 12. Evidence and Anti-Overclaim Rules

- Local/fake-D1 migration rehearsal is not production migration.
- Schema docs are not production evidence.
- CI is not production proof.
- PR merge is not production observation.
- PR body text is not production proof.
- Source inspection is not production D1 observation.
- Local schema consistency is not production schema compatibility.
- A D1 binding name or database ID in config is not production observation.
- C2 local/test role stub is not real auth.
- `manual_reviewer` is not authenticated reviewer identity.
- Static privacy warning copy is not retention/privacy enforcement.
- Metadata-only history is not full audit history.
- Production migration cannot be claimed without approved execution evidence.
- No production D1 state can be claimed without approved production D1
  observation.
- No customer-data state can be claimed without separately approved customer
  data access and redacted evidence.

## 13. Future Approval Blocks

Current docs-only plan block:

```yaml
manual_review_notes_v1_production_d1_migration_plan:
  document_status: DRAFT_NOT_APPROVED_FOR_EXECUTION
  approval_record: "https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4497697004"
  production_d1_schema_observation_decision: HOLD
  production_d1_migration_execution_decision: HOLD
  production_d1_write_decision: HOLD
  production_rollback_execution_decision: HOLD
  staging_or_local_rehearsal_decision: HOLD
  migration_order_decision: HOLD
  backfill_decision: HOLD
  generated_suggestion_persistence: FORBIDDEN
  production_proof_execution_decision: HOLD
  allowed_next_action: PLAN_ONLY
```

Use this candidate only after a future human fills non-HOLD values. It is not
approval by itself:

```yaml
manual_review_notes_v1_production_d1_migration_candidate:
  document_status: HUMAN_TO_FILL
  approval_record: null
  target_environment:
    name: null
    d1_database: null
    worker: null
    branch: master
    commit_sha: null
  owners:
    product_owner: null
    ops_owner: null
    db_owner: null
    privacy_owner: null
    evidence_owner: null
    rollback_owner: null
    incident_owner: null
  production_actions:
    production_d1_schema_observation_allowed: false
    production_d1_migration_allowed: false
    production_d1_write_allowed: false
    production_rollback_allowed: false
    production_endpoint_calls_allowed: false
    production_logs_allowed: false
    production_secrets_allowed: false
    production_smoke_tests_allowed: false
    customer_data_read_allowed: false
    customer_data_mutation_allowed: false
    production_proof_execution_allowed: false
    production_deploy_allowed: false
  migration_policy:
    exact_commands: []
    exact_target_database: null
    nullable_columns_allowed: false
    create_event_table_allowed: false
    create_event_index_allowed: false
    lazy_ddl_allowed: false
    backfill_allowed: false
    fabricate_note_timestamps_from_updated_at: false
    fabricate_author_labels: false
    fabricate_history_events: false
    old_new_note_text_history_allowed: false
    generated_suggestion_persistence_allowed: false
  rollback_policy:
    rollback_owner: null
    non_destructive_code_backout_preferred: true
    drop_columns_allowed: false
    delete_event_rows_allowed: false
    delete_current_note_text_allowed: false
    partial_migration_stop_conditions: []
  access_privacy_policy:
    c2_stub_counts_as_production_auth: false
    real_auth_session_approved: false
    production_role_controls_approved: false
    manager_visibility_approved: false
    export_expansion_approved: false
    api_expansion_approved: false
    warning_only_counts_as_enforcement: false
    retention_enforcement_approved: false
    purge_delete_jobs_approved: false
    pii_detection_approved: false
    redaction_approved: false
    legal_privacy_review_complete: false
  generated_suggestion_boundary:
    persist_generated_suggestions: false
    retain_generated_suggestions: false
    export_generated_suggestions: false
    attribute_generated_suggestions_to_reviewers: false
    include_generated_suggestions_in_history: false
    treat_generated_suggestions_as_human_notes: false
    proof_must_retest_boundary: true
  observability_evidence_policy:
    manual_note_text_in_logs_allowed: false
    generated_suggestion_text_in_logs_allowed: false
    secrets_or_auth_material_allowed: false
    unredacted_customer_payloads_allowed: false
    evidence_storage: null
    redaction_owner: null
  forbidden_actions:
    - production deploy
    - production D1 read without explicit schema-observation approval
    - production D1 write
    - production D1 migration
    - production rollback
    - production Worker endpoint call
    - production logs/secrets access
    - production smoke test
    - customer data read/write
    - generated suggestion persistence
    - generated suggestion history/export/attribution
  stop_conditions:
    - stale base SHA
    - failing local/CI validation
    - missing owner
    - missing rollback plan
    - missing privacy/access approval
    - unclear D1 target
    - unsafe evidence boundary
    - unexpected generated suggestion persistence
    - unapproved customer data access
  allowed_next_action: EXECUTE_ONLY_IF_SEPARATELY_APPROVED
```

## 14. Future Non-Authorizing Prompt Stub

Use only after a human fills approval blocks with non-HOLD values. This stub is
not approval by itself:

```text
Prepare the separately approved Manual Review Notes v1 production D1 migration
execution or rehearsal for dooosp/b2b-lead-agent. Use approval_record: <URL>.
Start from current origin/master and prove repo root, branch, HEAD SHA, default
branch, dirty state, PR/CI state, and validation commands. Run only the exact
commands and surfaces listed in the approval record. Stop on stale SHA, failing
validation, missing owner, missing rollback, unclear production D1 target,
missing privacy/access approval, unsafe evidence, unapproved customer-data
access, or generated suggestion persistence. Generated reviewer suggestions
remain copy-only, unsaved, unretained, unattributed, unexported, excluded from
history, and not human-authored saved notes unless a separate future decision
changes that boundary.
```

## 15. Validation Expectations For This Packet

For this docs-only packet:

- `git diff --check`
- `npm run check:naming`
- `npm run check:schema`
- `npm test`

If source-of-truth docs are updated in the same PR, the PR body must state that
validation is local/non-production evidence only and that production D1
migration, production proof execution, and production deploy remain HOLD.
