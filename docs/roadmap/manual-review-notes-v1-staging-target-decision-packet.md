# Manual Review Notes V1 Staging Target Decision Packet

This packet prepares a future decision about whether Manual Review Notes v1 has
a safe non-production staging target. It is documentation only. It does not
execute staging, access staging D1, call staging endpoints, read staging logs or
secrets, access production D1, observe production schema, run migrations or
rollback, deploy, call production endpoints, read production logs or secrets,
mutate customer data, create executable migration or rollback files, or change
runtime/UI/schema/API behavior.

## Document Status

- Document status: `DRAFT_NOT_APPROVED_FOR_EXECUTION`.
- Approval record:
  `https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4503509007`.
- Prior local/staging dry-run plan:
  `docs/roadmap/manual-review-notes-v1-staging-dry-run-plan.md`.
- Prior local fake-D1 dry-run evidence:
  `docs/roadmap/manual-review-notes-v1-local-fake-d1-dry-run-evidence.md`.
- Repository: `dooosp/b2b-lead-agent`.
- Default branch: `master`.
- Post-PR141 baseline inspected:
  `0ae7dcf2b73c07df95388832b443c276a8b20b7a`.
- Scope: docs-only staging target decision packet for Manual Review Notes v1.
- Runtime behavior changed by this packet: none.
- UI behavior changed by this packet: none.
- Schema/API behavior changed by this packet: none.
- Migration file created by this packet: none.
- Rollback file created by this packet: none.
- Staging target accessed by this packet: none.
- Staging action performed by this packet: none.
- Production action performed by this packet: none.
- Production readiness claim made by this packet: none beyond "staging target
  decision packet prepared."

```yaml
manual_review_notes_v1_staging_target:
  document_status: DRAFT_NOT_APPROVED_FOR_EXECUTION
  approval_record: "https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4503509007"
  scope: DOCS_ONLY_STAGING_TARGET_DECISION_PACKET
  post_pr141_baseline: "0ae7dcf2b73c07df95388832b443c276a8b20b7a"
  staging_target_decision: HOLD
  staging_target_name: null
  staging_d1_binding_decision: HOLD
  staging_credentials_decision: HOLD
  staging_data_fixture_decision: HOLD
  staging_endpoint_decision: HOLD
  staging_logs_secrets_decision: HOLD
  staging_execution_decision: HOLD
  production_d1_access_decision: HOLD
  production_d1_schema_observation_decision: HOLD
  production_d1_migration_decision: HOLD
  production_d1_write_delete_decision: HOLD
  production_proof_execution_decision: HOLD
  production_deploy_decision: HOLD
  generated_suggestion_staging_boundary: FORBIDDEN_AS_SAVED_NOTE
  allowed_next_action: DECISION_ONLY
```

## 1. Current Evidence State

Completed Manual Review Notes v1 records through the inspected baseline:

- PR #119 added the docs-only Option A implementation plan.
- PR #120 implemented local/test-safe save/read for human-entered manual notes.
- PR #121 implemented local/test-safe edit/update and clear/delete UX.
- PR #122 added saved/empty state clarity plus truthful lead-level timestamp
  labeling.
- PR #123 added the docs-only data semantics decision packet.
- PR #124 implemented local/test-safe T1 note-specific timestamp support.
- PR #125 added the docs-only reviewer identity / author attribution decision
  packet.
- PR #126 implemented local/test-only generic non-PII manual reviewer label.
- PR #127 added the docs-only note history/versioning decision packet.
- PR #128 implemented local/test-only H2 metadata-only manual note history.
- PR #129 added the docs-only retention/privacy policy decision packet.
- PR #130 implemented static local/test privacy warning copy.
- PR #131 added the docs-only production readiness gap packet.
- PR #132 added the docs-only access/visibility/export decision packet.
- PR #133 added the docs-only access-control plan.
- PR #135 implemented only the C2 opt-in local/test role stub.
- PR #137 added the docs-only production proof plan.
- PR #138 added the docs-only production D1 migration plan.
- PR #139 added the docs-only production rollback/backout plan.
- PR #140 added the docs-only local/staging dry-run plan.
- PR #141 executed and documented local fake-D1 dry-run evidence only.

Current evidence boundary:

- Local fake-D1 dry-run evidence exists from PR #141.
- Local fake-D1 evidence is not staging evidence.
- Local fake-D1 evidence is not production evidence.
- CI, source inspection, docs, and PR bodies are not staging runtime evidence
  unless they actually target an approved staging environment.
- Staging-like execution remains `HOLD`.
- Production D1, production proof, production rollback, production deploy,
  production endpoint calls, production logs/secrets, production smoke tests,
  and production observation remain `HOLD`.

Current local/test data model and behavior:

- Current manual note API field: `manualReviewNotes`.
- Current storage mapping: `manualReviewNotes` is backed by the existing
  `leads.notes` row value.
- Saved non-empty manual notes expose
  `manualReviewNotesProvenance: "human_entered"`.
- Current note-specific timestamp field:
  `manualReviewNotesUpdatedAt`, stored as
  `manual_review_notes_updated_at`.
- Current generic author label field:
  `manualReviewNotesAuthorLabel`, stored as
  `manual_review_notes_author_label`.
- The only generic author label is the fixed non-PII value
  `manual_reviewer`.
- Current metadata-only history table: `manual_review_note_events`.
- Metadata-only history stores lead relationship, event type, timestamp, and
  the fixed generic author label only.
- Metadata-only history does not store old manual note text, new manual note
  text, generated suggestion text, or real reviewer identity.
- The static privacy warning is local/test reviewer guidance only. It does not
  detect, block, redact, purge, or enforce retention.
- The C2 role stub is opt-in local/test only through
  `MANUAL_REVIEW_NOTES_LOCAL_TEST_ROLE_STUB=enabled` and
  `X-Manual-Review-Notes-Local-Test-Role`.
- C2 access metadata explicitly reports `realAuthImplemented: false` and
  `productionReady: false`.
- Generated reviewer note suggestions remain copy-only helper text. They are
  not saved, not attributed, not retained, not exported, not history events,
  not manual note text, and not human-authored notes.

## 2. Non-Authorizing Statement

This packet does not authorize staging execution.
This packet does not authorize staging D1 access.
This packet does not authorize staging endpoint calls.
This packet does not authorize staging logs or secrets access.
This packet does not authorize production action.
This packet does not authorize production D1 access.
This packet does not authorize production D1 schema observation.
This packet does not authorize production D1 migration.
This packet does not authorize production D1 write.
This packet does not authorize production D1 delete.
This packet does not authorize production proof execution.
This packet does not authorize production deploy.
This packet does not authorize production endpoint calls.
This packet does not authorize production logs or secrets access.
This packet does not authorize production smoke tests.
This packet is docs-only planning evidence.

No staging target state, staging D1 state, staging endpoint behavior,
staging log content, staging secret value, production D1 state, production
schema, production migration status, production endpoint behavior, production
log content, production secret value, customer-data state, or runtime proof may
be claimed from this packet.

## 3. Staging Target Definition

A valid future staging target must meet all of these conditions before any
execution is considered:

- It is explicitly named in an approval record.
- It is non-production.
- It is isolated from production D1.
- It is isolated from production Worker endpoints.
- It is isolated from production secrets.
- It is isolated from production logs.
- It uses approved fixture or synthetic data only.
- It has no customer data and cannot mutate customer data.
- It has a documented rollback/backout plan.
- It has an explicit approval record before execution.
- It has an exact command allowlist before execution.
- It has endpoint boundaries before execution.
- It has credential and secret boundaries before execution.
- It has evidence capture and redaction rules before execution.
- It confirms generated reviewer note suggestions remain excluded from saved
  notes, attribution, history, export, retention, and evidence claims.
- It confirms privacy, retention, and access-control limits before execution.

What counts as staging:

- A named non-production Worker or equivalent environment approved for the
  specific Manual Review Notes v1 rehearsal.
- A named non-production D1 binding or database that is not production D1.
- A named fixture-only data source that is synthetic or local/test-safe.
- A named operator, command list, evidence policy, and stop condition set.

What does not count as staging:

- Local fake-D1.
- CI tests unless CI is intentionally targeting the approved staging target.
- Docs, PR bodies, screenshots, issue comments, or source inspection.
- A production Worker endpoint with a staging label.
- A production D1 binding with a staging label.
- Any environment that shares production secrets, logs, D1, endpoints, or
  customer data.
- Any target whose identity or ownership is ambiguous.

## 4. Invalid Staging Target Conditions

Any of these conditions disqualifies a future target:

- Uses or may use production D1 binding.
- Uses or may call a production Worker endpoint.
- Uses production secrets.
- Requires reading production logs.
- Uses customer data.
- Uses copied production data.
- Has an unclear environment name, URL, binding, or owner.
- Shares production D1, secrets, logs, queues, endpoints, or write paths.
- Has no documented rollback/backout plan.
- Has no approval record.
- Has no fixture-only data policy.
- Has no exact command allowlist.
- Has no evidence redaction policy.
- Has no generated-suggestion exclusion checklist.
- Requires production D1 schema observation to decide whether it is safe.
- Requires production endpoint calls to decide whether it is safe.
- Requires production smoke tests to decide whether it is safe.

## 5. Staging Target Option Matrix

| Option | Value | Risk | Credential boundary | Data boundary | D1 binding requirement | Endpoint boundary | Validation/evidence needed | Approval required | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| S0: no staging target; keep HOLD | Lowest operational risk. Preserves current post-PR141 evidence state. | No staging runtime confidence. | No credentials. | No new data. | No D1 binding. | No endpoint. | Docs-only diff, local validation, approval record. | Docs-only decision packet approval only. | Recommended now. |
| S1: local fake-D1 only; no staging target | Reuses the known local/fake-D1 harness and avoids external targets. | Can be overclaimed as staging if labels are sloppy. | Local only; no staging or production secrets. | Synthetic/local fixtures only. | Fake-D1 only; no real D1. | Loopback/local only. | Existing PR #141 evidence plus any separately approved future local commands. | Separate approval for any further local dry-run beyond docs validation. | Acceptable now as evidence context, not staging. |
| S2: ephemeral non-production fixture-backed target | Best candidate for first true staging-like rehearsal if later approved. | Setup can drift or accidentally use real secrets/bindings. | Explicit non-production credentials only; no secrets in docs, PRs, logs, or reports. | Synthetic fixtures only; no customer data or production copy. | Explicit non-production D1 binding or isolated ephemeral database. | Explicit non-production endpoint only. | Target name, binding identity, fixture manifest, command allowlist, redacted evidence, rollback/backout plan. | Future staging target and execution approval. | Candidate after explicit future approval. |
| S3: persistent non-production staging target with isolated D1 | Useful for repeated rehearsal and regression evidence. | Persistent data and credentials increase privacy, retention, and drift risk. | Dedicated non-production secrets with access policy. | Fixture-only seeded data with retention/cleanup policy. | Dedicated non-production D1, never production D1. | Dedicated staging endpoint, never production endpoint. | Target ownership, D1 identity, cleanup/retention policy, access matrix, command allowlist, evidence policy. | Stronger product/ops/privacy approval. | Hold until S2 is insufficient. |
| S4: production-like staging target with strict approvals and fixture-only data | Highest fidelity non-production option. | Easy to confuse with production; may share operational patterns or privileged credentials. | Explicitly non-production credentials with strict handling and no secret exposure. | Fixture-only; no customer data and no production copy. | Production-like but isolated non-production D1. | Production-like but isolated non-production endpoint. | Formal target inventory, ops/privacy review, rollback/backout, redaction, no-production-resource proof, no-generated-suggestion proof. | Strong ops/privacy/product approval before any execution. | Hold for later; not needed now. |
| S5: production target misused as staging | None. | Unacceptable production, customer, privacy, and evidence risk. | Production credentials forbidden. | Customer or production data forbidden. | Production D1 forbidden. | Production endpoint forbidden. | No validation should proceed. | Not approvable through this packet. | Forbidden. |

Recommended default:

- Use S0/S1 now.
- Consider S2 only after explicit future approval.
- Require stronger ops/privacy review for S3/S4.
- Treat S5 as forbidden.

## 6. Credential / Secret Boundary

- No secrets are read now.
- No staging secrets are read now.
- No production secrets are read now.
- Future staging credentials must be explicitly non-production.
- Future staging credentials must not be exposed in PRs, issue comments, docs,
  logs, screenshots, artifacts, reports, or terminal transcripts.
- Future staging credentials must have a documented owner and revocation path.
- Any secret access requires separate approval.
- Any evidence that might include auth headers, cookies, tokens, private URLs,
  D1 IDs, or account identifiers must be redacted or omitted according to the
  approved evidence policy.
- Production secrets remain forbidden.

## 7. D1 Binding Boundary

- Staging D1 must not be production D1.
- Staging D1 binding must be explicitly identified as non-production before
  execution.
- Staging D1 database identity must be documented in an approval record without
  exposing secrets.
- Staging D1 schema observation requires separate approval.
- Staging D1 migration requires separate approval.
- Staging D1 write/delete requires separate approval.
- Staging lazy DDL behavior, including any path that can invoke schema setup,
  must be called out before execution.
- Production D1 remains forbidden.
- Production D1 binding names, database names, or IDs are not sufficient proof
  of staging safety.
- If any binding identity is ambiguous, stop with `HOLD`.

## 8. Data Fixture Policy

- Synthetic/local fixtures are preferred.
- No customer data.
- No production data copy.
- No production export import.
- No secrets or credentials in fixtures.
- Manual note fixture content should avoid PII and sensitive sales context.
- Fixture manual notes should be visibly synthetic.
- Generated suggestion content must not be used as saved manual note fixture
  data.
- Generated suggestion content must not be used to repopulate cleared notes.
- Metadata-only history fixtures must not contain old manual note text.
- Metadata-only history fixtures must not contain new manual note text.
- Metadata-only history fixtures must not contain generated suggestion text.
- Metadata-only history fixtures must not contain real reviewer identity.
- Fixture cleanup and retention must be documented for any persistent
  non-production target.

## 9. Command Boundary

- Allowed future staging commands must be enumerated before execution.
- The approval record must name the target, operator, command list, expected
  outputs, stop conditions, evidence path, and redaction rules.
- No Wrangler production commands.
- No production endpoint commands.
- No commands that reveal secrets.
- No commands that mutate production.
- No commands that observe production D1 schema.
- No commands that read production logs.
- No commands that run production smoke tests.
- No commands that access customer data.
- No command may be added during execution without pausing for a separate
  approval update.
- Local validation commands for a docs-only PR remain separate from staging
  execution and must not be described as staging evidence.

## 10. Evidence Boundary

- Local fake-D1 evidence is local evidence.
- Staging evidence requires approved staging execution.
- Production evidence requires approved production observation.
- CI is not staging evidence unless it actually targets the approved staging
  environment.
- Docs are not runtime evidence.
- PR bodies are not runtime evidence.
- Issue comments are approval/evidence records only for what they explicitly
  say.
- Source inspection is not staging runtime proof.
- Staging target decision readiness is not staging execution readiness.
- No staging claim is allowed without an executed approved staging run.
- No production claim is allowed without an executed approved production
  observation.
- Evidence must omit or redact credentials, auth headers, cookies, private
  URLs, customer payloads, PII, secrets, account IDs if sensitive, and log
  snippets that could expose note text or generated suggestion text.
- Evidence must distinguish local fake-D1, staging, and production in every
  summary.

## 11. Manual Notes Rehearsal Checklist For Future Staging

This checklist is plan-only. It is not evidence that any staging run occurred.

Future staging rehearsal, if separately approved, should verify:

- Save/read for human-entered `manualReviewNotes`.
- Edit/update by saving a changed human-entered note.
- Clear/delete by confirmed `manualReviewNotes: ""`.
- Saved and empty state clarity.
- Note-specific timestamp through `manualReviewNotesUpdatedAt`.
- Fixed generic author label through `manualReviewNotesAuthorLabel`.
- Metadata-only history through `manual_review_note_events`.
- No old manual note text in history.
- No new manual note text in history.
- No generated suggestion text in history.
- Static privacy warning remains warning-only unless a later policy selects
  enforcement.
- C2 role-stub boundary remains local/test-only, or an approved staging role
  boundary is named separately.
- C2 metadata or staging role metadata does not claim real production auth
  unless real auth is separately implemented and approved.
- Generated suggestion exclusion.
- No export expansion unless approved.
- No manager visibility expansion unless approved.
- No API exposure expansion unless approved.

## 12. Generated Suggestion Exclusion Checklist

Generated reviewer note suggestions must remain:

- Not saved.
- Not attributed.
- Not retained.
- Not exported.
- Not history events.
- Not manual note text.
- Not staging evidence as a saved note.
- Not used to repopulate notes.
- Not used as rollback artifacts.
- Not used as fixture saved-note content.
- Not treated as human-authored notes.
- Not used to update `manualReviewNotesUpdatedAt`.
- Not used to update `manualReviewNotesAuthorLabel`.
- Not used to create `manual_review_note_events`.

Patch and persistence boundaries:

- Generated suggestion patch fields must remain rejected or non-persistent.
- Mixed payloads that include generated suggestion persistence attempts must
  not partially save human manual note changes unless the existing atomic
  rejection behavior is preserved.
- Batch/cache/generated refresh paths must not convert generated note-like text
  into saved `manualReviewNotes`, author labels, timestamps, or history events.

## 13. Privacy / Retention / Access Gates

- The current privacy warning is warning-only.
- Retention enforcement is absent.
- Purge/delete jobs are absent.
- Redaction is absent.
- Automated PII detection is absent.
- Real auth is absent.
- Authenticated reviewer identity is absent.
- C2 role stub is local/test-only.
- Staging target evidence cannot claim production auth/access control.
- Manager visibility expansion remains blocked.
- Export expansion remains blocked.
- API exposure expansion remains blocked.
- Full note text history remains blocked.
- Old/new note value history remains blocked.
- Production access-control implementation remains blocked.
- Staging cannot use customer data.
- Staging evidence must not contain real manual note text from customers or
  real reviewers.
- Any persistent non-production staging data requires a retention/cleanup
  policy before execution.

## 14. Future Approval Blocks

Any future approval to move beyond this packet must fill in the relevant block.
Null values mean the decision is not ready for execution.

```yaml
manual_review_notes_v1_staging_target:
  document_status: DRAFT_NOT_APPROVED_FOR_EXECUTION
  approval_record: "https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4503509007"
  staging_target_decision: HOLD
  staging_target_name: null
  staging_target_type: null
  staging_owner: null
  staging_operator: null
  staging_d1_binding_decision: HOLD
  staging_d1_binding_name: null
  staging_credentials_decision: HOLD
  staging_secret_access_decision: HOLD
  staging_data_fixture_decision: HOLD
  staging_fixture_manifest: null
  staging_endpoint_decision: HOLD
  staging_endpoint_name_or_url: null
  staging_logs_secrets_decision: HOLD
  staging_command_allowlist_decision: HOLD
  staging_command_allowlist: []
  staging_evidence_policy_decision: HOLD
  staging_rollback_backout_decision: HOLD
  staging_execution_decision: HOLD
  production_d1_access_decision: HOLD
  production_d1_schema_observation_decision: HOLD
  production_d1_migration_decision: HOLD
  production_d1_write_delete_decision: HOLD
  production_proof_execution_decision: HOLD
  production_deploy_decision: HOLD
  customer_data_decision: FORBIDDEN
  generated_suggestion_staging_boundary: FORBIDDEN_AS_SAVED_NOTE
  allowed_next_action: DECISION_ONLY
```

Future S2 approval skeleton:

```yaml
manual_review_notes_v1_future_ephemeral_staging_rehearsal:
  document_status: TEMPLATE_NOT_APPROVED
  required_prior_packet: "docs/roadmap/manual-review-notes-v1-staging-target-decision-packet.md"
  selected_option: S2_EPHEMERAL_NON_PRODUCTION_FIXTURE_BACKED_TARGET
  staging_target_name: null
  staging_target_owner: null
  staging_operator: null
  non_production_proof: null
  d1_binding_name: null
  d1_binding_is_production: false
  fixture_policy: SYNTHETIC_ONLY
  command_allowlist: []
  endpoint_allowlist: []
  secrets_handling: NO_SECRET_VALUES_IN_EVIDENCE
  rollback_backout_owner: null
  evidence_path: null
  redaction_policy: null
  generated_suggestion_exclusion_check_required: true
  privacy_retention_access_gate_required: true
  production_action_allowed: false
  approval_record: null
  execution_decision: HOLD
```

## 15. Decision Summary

- Staging target decision packet: prepared.
- Staging target selected: no.
- Staging execution approved: no.
- Staging D1 access approved: no.
- Staging endpoint calls approved: no.
- Staging logs/secrets access approved: no.
- Production action approved: no.
- Recommended current posture: S0/S1, keep execution `HOLD`.
- Recommended next possible escalation: S2 only after a separate explicit
  future approval names the target, binding, credentials, fixtures, commands,
  endpoint boundary, evidence policy, rollback/backout owner, privacy/access
  gates, and generated-suggestion exclusion checks.
