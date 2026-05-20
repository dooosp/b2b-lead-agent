# Manual Review Notes V1 Production Proof Plan

This packet prepares a future Manual Review Notes v1 production proof. It is
documentation only. It does not execute production proof, deploy, access
production D1, run migrations, call production endpoints, read production logs
or secrets, mutate customer data, or change runtime/UI/schema/API behavior.

## Document Status

- Document status: `DRAFT_NOT_APPROVED_FOR_EXECUTION`.
- Approval-intent record:
  `https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4496285404`.
- Related rollback/backout plan approval-intent record:
  `https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4497893786`.
- Repository: `dooosp/b2b-lead-agent`.
- Default branch: `master`.
- Post-PR136 baseline inspected:
  `08f21dfcc8eec1ada4286af8af8cac7b94f0dfdd`.
- Scope: docs-only production proof planning for Manual Review Notes v1.
- Runtime behavior changed by this packet: none.
- UI behavior changed by this packet: none.
- Schema/API behavior changed by this packet: none.
- D1 migration performed by this packet: none.
- Production action performed by this packet: none.
- Production readiness claim made by this packet: none beyond "production proof
  plan prepared."

```yaml
manual_review_notes_v1_production_proof_plan:
  document_status: DRAFT_NOT_APPROVED_FOR_EXECUTION
  approval_record: "https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4496285404"
  scope: DOCS_ONLY_PRODUCTION_PROOF_PLAN
  post_pr136_baseline: "08f21dfcc8eec1ada4286af8af8cac7b94f0dfdd"
  production_proof_execution_decision: HOLD
  production_d1_access_decision: HOLD
  production_d1_migration_decision: HOLD
  production_deploy_decision: HOLD
  production_endpoint_call_decision: HOLD
  production_logs_secrets_decision: HOLD
  rollback_backout_plan_status: PREPARED_DOCS_ONLY
  rollback_execution_decision: HOLD
  access_control_production_decision: HOLD
  retention_privacy_production_decision: HOLD
  generated_suggestion_boundary_proof_decision: HOLD
  customer_data_handling_decision: HOLD
  allowed_next_action: PLAN_ONLY
```

## 1. Current Local/Test State

Completed local/test implementation and decision records:

- PR #120 implemented local/test-safe save/read for human-entered manual notes.
- PR #121 implemented local/test-safe edit/update and clear/delete hardening.
- PR #122 added saved/empty state clarity plus truthful lead-level timestamp
  labeling.
- PR #123 added the docs-only Manual Review Notes v1 data semantics decision
  packet.
- PR #124 implemented T1 local/test-safe note-specific timestamp support.
- PR #125 added the docs-only reviewer identity / author attribution decision
  packet.
- PR #126 implemented local/test-only generic non-PII manual reviewer author
  label support.
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

Current implementation semantics:

- Current manual note API field: `manualReviewNotes`.
- Current storage mapping: `manualReviewNotes` is backed by the existing
  `leads.notes` row value. There is no separate production-approved
  `manual_review_notes` storage column.
- Current provenance:
  `manualReviewNotesProvenance: "human_entered"` only when non-empty saved
  manual note text exists.
- Current timestamp: `manualReviewNotesUpdatedAt`, backed by
  `manual_review_notes_updated_at`.
- Timestamp meaning: the last accepted human-entered manual note
  change/save/clear event.
- Current author label: `manualReviewNotesAuthorLabel`, backed by
  `manual_review_notes_author_label`.
- Author label value: fixed non-PII `manual_reviewer` only.
- Current metadata history table: `manual_review_note_events`.
- Current metadata history content: lead relationship, event type, timestamp,
  and fixed generic author label for accepted create/edit/clear events only.
- Current metadata history does not store old manual note text.
- Current metadata history does not store new manual note text.
- Current metadata history does not store generated reviewer suggestion text.
- Current metadata history does not store real reviewer identity.
- Current privacy warning: static local/test reviewer guidance only. It does
  not detect, block, redact, enforce retention, purge data, or create
  production compliance evidence.
- Current C2 role stub: opt-in local/test only through
  `MANUAL_REVIEW_NOTES_LOCAL_TEST_ROLE_STUB=enabled` and
  `X-Manual-Review-Notes-Local-Test-Role`. It explicitly reports
  `realAuthImplemented: false` and `productionReady: false`.
- Current generated suggestion boundary: generated reviewer note suggestions
  are copy-only, unsaved, unattributed, unretained, unexported, excluded from
  metadata history, and not human-authored saved notes.
- Current production status: no production proof and no production deploy.

## 2. Problem Statement

Manual Review Notes v1 is local/test-complete enough for planning, but
production proof is not approved or executed. This plan answers:

- What must be true before production proof can be approved?
- What production actions would be required if proof were later approved?
- What must be verified only locally or in staging first?
- What migration and backout planning must be reviewed before execution?
- What access-control, privacy, retention, and observability gates are missing?
- How should generated suggestion exclusion be proven without storing generated
  content?
- What evidence may be claimed, and what evidence remains absent?
- What exact approval block is required before any production action?

Without this plan, future work could confuse local/fake-D1 evidence with
production observation, use warning-only copy as privacy compliance, trigger
production D1 writes without using the separately prepared rollback/backout
plan, expose manual note text through roles/exports/logs before access and
privacy policy exist, or treat generated helper text as saved human-authored
note data.

## 3. Non-Authorizing Statement

This plan does not authorize production proof execution. This plan does not
authorize production D1 access. This plan does not authorize production D1
migration. This plan does not authorize production endpoint calls. This plan
does not authorize production logs/secrets access. This plan does not authorize
production deploy. This plan does not authorize customer data mutation. This
plan creates only docs/readiness planning evidence.

## 4. Pre-Proof Local / CI Evidence Inventory

| Evidence category | What it proves | What it does not prove | Production evidence? |
| --- | --- | --- | --- |
| Unit tests | Deterministic module behavior for transforms, helper logic, manual note PATCH semantics, and generated-suggestion rejection. | Production D1 state, production auth, production data, production endpoint health, or privacy compliance. | No. |
| Worker tests | Local Worker/API behavior for lead reads, writes, manual note metadata, access-stub filtering, and CSV compatibility. | Production routes, production latency, production roles, production data compatibility, or real auth. | No. |
| Contract tests | Local payload and schema contract expectations, including manual note fields and D1 source definitions. | Production endpoint compatibility, production migration success, or external client readiness. | No. |
| Schema checks | Local agreement among `worker/schema.sql`, `worker/db/schema.js`, and schema consistency expectations for columns/tables. | Actual production D1 schema, lazy DDL behavior, production migration application, or rollback safety. | No. |
| Naming checks | Canonical repo path and naming guardrails still pass. | Manual notes production readiness, D1 compatibility, or privacy/access-control safety. | No. |
| Eval gate | Synthetic LeadBrief quality and review-readiness checks stay deterministic. | Manual note production behavior, production customer data, or privacy compliance. | No. |
| Local fake-D1 E2E | Loopback/fake-D1 reviewer flows for save/edit/clear/timestamp/author/history and generated-suggestion boundaries. | Production D1, production Worker, real browsers against production, real auth, real traffic, or production data. | No. |
| Local role-stub tests | Opt-in C2 stub behavior for reviewer-like access and manager/api/missing/unknown protected-field omission. | Real auth/session/identity, production roles, production access control, manager visibility approval, or export approval. | No. |
| Generated-suggestion boundary tests | Generated suggestion fields are rejected or excluded from saved manual notes, timestamps, authors, history, and exports locally. | Production proof that no generated suggestion is persisted or logged. | No. |
| Docs/decision packets | Product/data/privacy/access decisions and non-decisions are recorded. | Runtime behavior, production owner signoff, production observation, or compliance proof. | No. |
| GitHub checks | CI can run repository local validation on a PR commit. | Production deploy, production D1, production endpoints, logs/secrets, or customer-data handling. | No. |

Local/fake-D1 evidence, CI, docs, PR bodies, generated reports, and GitHub
checks support planning and regression confidence only. They are not production
observation.

## 5. Production Proof Prerequisite Matrix

| ID | Current state | Risk | Evidence needed | Owner / decision type | Likely next artifact | Blocked actions | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P1: explicit production proof execution approval missing | Only the docs-only planning step is authorized. | A plan can be mistaken for permission to run production steps. | Approval record naming exact target, commands/surfaces, owners, data boundaries, stop conditions, and evidence policy. | Product/ops approval. | Production proof execution approval packet. | Production smoke tests, endpoint calls, D1 access, logs/secrets access. | Keep execution HOLD. |
| P2: production D1 migration/access approval missing | Local schema supports current fields/table; production D1 is not accessed. | Migration or schema reads could expose or mutate production state. | DB owner approval, exact D1 target, command allowlist, read/write boundary, and redaction policy. | DB/ops/product approval. | Production D1 migration/access packet. | D1 reads, writes, migrations, lazy-DDL claims. | Keep production D1 HOLD. |
| P3: production rollback/backout execution approval missing | Docs-only rollback/backout plan prepared in `docs/roadmap/manual-review-notes-v1-production-rollback-backout-plan.md`; execution remains unapproved. | Partial migration/deploy could leave broken schema or retained note data if the plan is skipped or overclaimed. | Approved backout sequence, owner, stop points, data preservation rules, no-destructive-action policy, exact commands, and evidence boundary. | Ops/DB/product/privacy approval. | Executable rollback/backout approval packet or runbook. | Rollback execution, destructive data action, deploy, migration, production proof execution. | Review the docs-only rollback/backout plan before any proof; keep execution HOLD. |
| P4: production access-control/auth decision missing | C2 is local/test stub only; no real auth/session/identity. | Production proof could overclaim access control or expose notes to broad API-token users. | Role/auth source, reviewer/manager/API/export matrix, unauthorized tests, null behavior. | Product/auth/privacy decision. | Production access-control decision packet. | Production saved-note visibility, access-control claims. | Decide before proof. |
| P5: retention/privacy enforcement decision missing | Static warning only; no enforcement, purge, redaction, or detection. | Sensitive manual note text could be retained without policy. | Retention period, clear/delete semantics, enforcement plan, privacy/legal signoff if needed. | Privacy/legal/product/ops decision. | Retention/privacy implementation or approval packet. | Production saved-note use, compliance claims. | Warning-only is not enough. |
| P6: generated-suggestion exclusion proof design missing | Local tests enforce copy-only boundary; no production re-test design exists. | Proof could accidentally persist, attribute, export, log, or history-store generated text. | Boundary checklist proving no save, persistence, attribution, retention, export, history, timestamp, or author update. | Product/privacy/QA decision. | Generated-suggestion production-boundary proof design. | Production saved-note claims, generated-suggestion persistence. | Make explicit gate. |
| P7: production observability/logging policy missing | No production logs/secrets are read now. | Logs/evidence could expose note text, generated suggestion text, auth material, secrets, or customer payloads. | Log access policy, fields/events allowed, redaction owner, evidence storage, secret-handling rules. | Ops/privacy/evidence owner. | Observability/evidence boundary packet. | Production log access and observation claims. | Define before proof. |
| P8: customer-data handling approval missing | No customer rows are read or mutated. | Proof could expose or change real customer data. | Safe-row/no-row decision, allowed data, screenshots policy, redaction, data minimization. | Customer/data/product/ops decision. | Customer-data handling packet. | Production D1 row reads/writes and screenshots. | Keep no customer data access. |
| P9: production smoke/proof checklist missing | No executable production checklist is approved. | Future smoke could be too broad or not reproducible. | Exact step list, target, owners, expected outputs, stop criteria, and forbidden actions. | QA/ops/product decision. | Production proof runbook. | Production smoke tests. | Draft only after P1-P8. |
| P10: legal/privacy review missing if needed | Privacy risks are documented; no legal/privacy production signoff exists. | Saved notes may contain PII or sensitive sales context. | Legal/privacy scope decision, policy acceptance, and evidence handling rules. | Legal/privacy decision. | Legal/privacy approval record. | Production saved-note use and compliance claims. | Required before production saved-note use. |
| P11: production performance/scaling evidence missing | Tests use small local/fake-D1 fixtures. | Event inserts/summaries may affect latency or D1 limits. | Query/load assumptions, staging-like measurement, indexing review, limit/timeout policy. | Engineering/ops decision. | Performance/readiness note. | Production rollout or scale claims. | Keep as explicit gap. |
| P12: incident ownership/escalation missing | No manual notes production incident owner is named. | Privacy or data incident could lack response path. | Incident owner, escalation path, customer/user communication owner, rollback/deletion owner. | Ops/privacy/product decision. | Incident ownership packet. | Production rollout. | Require before proof/rollout. |
| P13: production schema compatibility evidence missing | Local schema and code are consistent; production D1 state is unknown. | Production may lack fields/table or differ from local schema. | Approved production schema inventory or staging-equivalent proof, migration ordering, null/backfill rules. | DB/ops decision. | Schema compatibility proof plan. | Production schema claims and migration. | Do not infer from local schema. |
| P14: export/manager visibility production stance missing | Current docs preserve no new export/manager expansion; CSV compatibility needs explicit audit before production claims. | Note text/metadata could leak through managers, APIs, CSV, reports, or evidence packets. | Visibility/export matrix, redaction rules, tests, and explicit inclusion/exclusion. | Product/privacy/data decision. | Export/manager visibility packet. | Manager visibility, export/API expansion. | Default deny/omit. |
| P15: no-go/rollback criteria missing | Stop conditions exist only as planning concepts. | Proof may continue after stale SHA, failed CI, unclear owners, unsafe evidence, or migration mismatch. | Concrete no-go list and mandatory stop behavior. | Ops/QA/product decision. | Proof go/no-go checklist. | Production proof execution. | Require before execution. |

## 6. Local / Staging Dry-Run Plan

These checks remain local/staging-only and do not call production endpoints or
production D1:

| Check | Safe command or action | Purpose |
| --- | --- | --- |
| Fresh worktree validation | `git fetch origin master`, `git rev-parse origin/master`, fresh worktree from pinned `origin/master` | Prove current base and avoid dirty checkout contamination. |
| Repo/doc diff hygiene | `git status --short`, `git diff --check` | Confirm docs-only scope and whitespace safety. |
| Naming guard | `npm run check:naming` | Confirm canonical repo paths remain intact. |
| Schema consistency | `npm run check:schema` | Confirm local schema definitions agree for manual-note fields/table. |
| Full local test suite | `npm test` | Run root plus Worker gates. |
| Worker-focused gate | `npm run test:worker` | Cover Worker unit and contract behavior, including manual-note tests. |
| Local fake-D1 E2E | `npm run test:e2e:local` | Rehearse local/fake-D1 reviewer flows. |
| Eval gate | `npm run eval:lead-quality` | Keep synthetic review-quality gate green. |
| Local role-stub verification | Worker tests with C2 fixtures | Confirm reviewer can use manual notes and non-reviewer roles omit/deny protected fields locally. |
| Generated-suggestion rejection tests | Existing manual-note/generated-suggestion tests | Confirm generated fields cannot save, timestamp, attribute, history-store, clear, or export notes locally. |
| Manual note semantics tests | Existing save/edit/clear/timestamp/author/history tests | Confirm local semantics before any future proof. |
| Fake-D1 migration rehearsal | Local/fake-D1 schema check or staging-only D1, if separately approved | Rehearse ordering without production D1. |
| Dry-run rollback checklist | Checklist-only unless a staging target is approved | Prove backout questions are answered before production. |
| Evidence boundary review | Inspect PR body/docs for no-production claims | Prevent local evidence from being overclaimed. |

No local/staging dry-run step may use production secrets, production D1,
production Worker endpoints, production logs, production smoke tests, customer
data, or Wrangler production commands.

## 7. Production D1 Migration Planning

This section is plan-only and performs no production D1 action.

Current local schema and storage mapping:

- `manualReviewNotes` maps to `leads.notes`.
- `manualReviewNotesUpdatedAt` maps to nullable
  `leads.manual_review_notes_updated_at`.
- `manualReviewNotesAuthorLabel` maps to nullable
  `leads.manual_review_notes_author_label`.
- `manual_review_note_events` stores metadata-only event rows with:
  - `id`,
  - `lead_id`,
  - `event_type` limited to `create`, `edit`, or `clear`,
  - `changed_at`,
  - `author_label` fixed to `manual_reviewer`.
- `idx_manual_review_note_events_lead` indexes event lookup by lead and
  descending change time.

Migration ordering concerns:

- Confirm the target environment and D1 database identity before any command is
  approved.
- Confirm whether production already has `notes`,
  `manual_review_notes_updated_at`, `manual_review_notes_author_label`, and
  `manual_review_note_events`.
- Add nullable metadata columns before any code path depends on them.
- Create the metadata-only events table and index before event inserts are
  allowed.
- Do not add old/new manual note text columns.
- Do not add generated suggestion columns.
- Do not run lazy DDL against production without explicit approval because the
  current code can call `ensureD1Schema`.

Nullable/backfill behavior:

- Existing production rows must not receive fabricated note-specific timestamps
  from lead-level `updated_at`.
- Existing saved note text, if any, needs an explicit policy before any
  production backfill or provenance claim.
- Existing rows may keep `manual_review_notes_updated_at` and
  `manual_review_notes_author_label` null until a future accepted
  human-entered manual note change/save/clear event.
- No historical `manual_review_note_events` may be fabricated without explicit
  approval.

Backout/rollback questions before production:

- If nullable columns are added, is the approved backout "code ignores fields"
  or a destructive schema rollback?
- If metadata events are written, can they be deleted, retained, or ignored?
- What happens if a migration applies columns but event-table creation fails?
- What is the stop condition for schema drift or unexpected production rows?
- Who owns rollback, evidence, and customer communication?

Validation needed before production:

- Local schema consistency must pass.
- Fake-D1 or staging-only rehearsal must show ordering and idempotency.
- Production schema inventory requires separate approval.
- Production migration command(s) require separate approval.
- Production postcheck command(s) require separate approval.

No production D1 command is approved by this plan.

## 8. Production Proof Execution Sketch

Every item below is `NOT APPROVED BY THIS PACKET` and
`REQUIRES SEPARATE HUMAN APPROVAL`.

| Future step | Required separate approval before action |
| --- | --- |
| Confirm approved target environment | Approval must name environment, database, Worker, branch, commit SHA, owners, and stop conditions. |
| Confirm migration plan | Approval must include exact migration command class, dry-run/rehearsal evidence, nullable/backfill policy, and rollback owner. |
| Confirm rollback plan | Approval must name rollback/backout steps, non-destructive default, incident owner, and stop criteria. |
| Run approved migration/proof commands | Approval must list exact commands and forbid anything not listed. |
| Perform minimal approved smoke checks | Approval must name endpoints/actions/data and prohibit unapproved customer-data access. |
| Verify manual note create/edit/clear behavior | Approval must define safe data and whether writes are allowed. |
| Verify generated-suggestion exclusion | Approval must prove no save, persistence, attribution, retention, export, history, timestamp, author update, or log exposure of generated suggestions. |
| Verify access-control stance | Approval must define whether proof is no-auth/no-visibility, reviewer-only, or another approved role stance. C2 local/test stub cannot satisfy production auth. |
| Verify logs do not expose sensitive note content | Approval must define allowed log access and redaction. Secrets must remain hidden. |
| Document evidence | Approval must define evidence storage, redaction, screenshots, allowed claims, and closeout format. |

This sketch is not a runbook. A future executable runbook must be separately
approved and must not inherit permission from this packet.

## 9. Rollback / Backout Planning Requirements

The docs-only rollback/backout plan now lives at
`docs/roadmap/manual-review-notes-v1-production-rollback-backout-plan.md`. It
is planning evidence only and does not authorize rollback execution,
production D1 access/write/delete/schema observation, Wrangler production
commands, production proof, deploy, or destructive data action.

A future production proof cannot proceed until a separate execution approval
uses that plan to answer:

- which code artifact can be redeployed or disabled,
- whether manual note UI/API paths can be hidden without data deletion,
- whether nullable D1 columns are ignored, retained, or rolled back,
- whether `manual_review_note_events` rows are retained, purged, or ignored,
- whether current manual note text can be safely removed,
- which data cannot be rolled back without privacy/legal/product policy,
- what clear/delete means if production writes occur,
- who owns incident response and rollback execution,
- what evidence proves rollback without fabricating success.

No destructive production action, schema rollback, row deletion, purge, or
history deletion is allowed without separate explicit approval.

## 10. Access-Control Proof Requirements

- C2 local/test role stub is not production auth.
- Production proof cannot claim real access control from C2.
- Production role/auth must be approved separately.
- Reviewer, manager, API, export, and missing/unknown access must be explicitly
  scoped.
- Broad API-token access is not reviewer identity.
- `manual_reviewer` is not a real person, authenticated actor, display name,
  email, or audit identity.
- Manager visibility remains unapproved.
- Export expansion remains unapproved.
- Generated suggestions must remain excluded from saved-note access surfaces.
- Production proof must include unauthorized/omitted-field expectations if any
  access-control claim is planned.

## 11. Retention / Privacy Proof Requirements

- Privacy warning copy is not enforcement.
- Metadata-only history is not audit/legal retention proof.
- Old/new note text history remains forbidden.
- Current manual note text may contain sensitive sales context, customer
  context, or PII.
- Retention/privacy enforcement is absent unless later implemented and
  validated.
- Production proof cannot claim privacy compliance from current local warning
  copy.
- Any production saved-note use needs a retention policy, clear/delete
  semantics, export/log/evidence policy, and privacy/legal review if required.
- Automated PII detection, redaction, purge/delete jobs, and retention jobs
  remain unimplemented and unapproved.

## 12. Generated Suggestion Production Boundary

Future proof must verify, without storing generated content as proof, that
generated reviewer note suggestions are:

- [ ] not saved,
- [ ] not persisted,
- [ ] not snapshotted,
- [ ] not attributed to a reviewer,
- [ ] not retained,
- [ ] not exported,
- [ ] not entered into metadata history,
- [ ] not treated as human-authored saved notes,
- [ ] unable to update `manualReviewNotesUpdatedAt`,
- [ ] unable to update `manualReviewNotesAuthorLabel`,
- [ ] unable to create `manual_review_note_events`,
- [ ] unable to clear human-entered manual notes through generated payloads,
- [ ] still rejected for forbidden patch fields,
- [ ] absent from production evidence except as minimized boundary language.

If a human later copies helper text and separately saves final edited text as
`manualReviewNotes`, that path still needs product/data/privacy approval before
it can be called production human-authored note content.

## 13. Observability / Logs / Secrets Boundary

This packet reads no production logs and no production secrets.

Future proof must:

- avoid logging manual note text,
- avoid logging generated suggestion text as saved-note evidence,
- avoid logging auth headers, cookies, tokens, customer payloads, or secrets,
- define allowed event names and fields before execution,
- define evidence storage and redaction owner before execution,
- require separate approval for any production log access,
- never expose secrets in comments, PR bodies, docs, screenshots, or artifacts.

## 14. Evidence and Anti-Overclaim Rules

- Local/fake-D1 is not production.
- CI is not production.
- Docs are not production observation.
- PR body is not production proof.
- Generated reports are not production observation.
- C2 role stub is not real auth.
- `manual_reviewer` is not real reviewer identity.
- Privacy warning copy is not compliance.
- Metadata-only history is not full audit.
- Local schema consistency is not production D1 schema compatibility.
- GitHub merge permission is not production owner approval.
- No production claim may be made without allowed production observation.

## 15. Future Approval Blocks

Current docs-only plan block:

```yaml
manual_review_notes_v1_production_proof_plan:
  document_status: DRAFT_NOT_APPROVED_FOR_EXECUTION
  approval_record: "https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4496285404"
  production_proof_execution_decision: HOLD
  production_d1_access_decision: HOLD
  production_d1_migration_decision: HOLD
  production_deploy_decision: HOLD
  production_endpoint_call_decision: HOLD
  production_logs_secrets_decision: HOLD
  rollback_plan_decision: HOLD
  access_control_production_decision: HOLD
  retention_privacy_production_decision: HOLD
  generated_suggestion_boundary_proof_decision: HOLD
  customer_data_handling_decision: HOLD
  allowed_next_action: PLAN_ONLY
```

Use this candidate only after a human fills non-HOLD values:

```yaml
manual_review_notes_v1_production_proof_candidate:
  document_status: HUMAN_TO_FILL
  approval_record: null
  target_environment:
    name: null
    worker: null
    d1_database: null
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
    production_proof_execution_allowed: false
    production_deploy_allowed: false
    production_d1_read_allowed: false
    production_d1_write_allowed: false
    production_d1_migration_allowed: false
    production_endpoint_calls_allowed: false
    production_logs_allowed: false
    production_secrets_allowed: false
    customer_data_read_allowed: false
    customer_data_mutation_allowed: false
  migration_policy:
    nullable_columns_confirmed: false
    event_table_confirmed: false
    backfill_allowed: false
    fabricate_note_timestamps_from_updated_at: false
    old_new_note_text_history_allowed: false
    rollback_plan: null
  access_control_policy:
    c2_stub_counts_as_production_auth: false
    real_auth_session_approved: false
    reviewer_role_approved: false
    manager_visibility_approved: false
    export_expansion_approved: false
    api_expansion_approved: false
  retention_privacy_policy:
    warning_only_counts_as_enforcement: false
    retention_enforcement_approved: false
    purge_delete_jobs_approved: false
    pii_detection_approved: false
    redaction_approved: false
    legal_privacy_review_required: null
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
  allowed_commands: []
  forbidden_commands:
    - production deploy
    - production D1 read
    - production D1 write
    - production D1 migration
    - production Worker endpoint call
    - production logs/secrets access
    - production smoke test
    - customer data read/write
  stop_conditions:
    - stale base SHA
    - failing local/CI validation
    - missing owner
    - missing approved rollback execution plan
    - missing privacy/access approval
    - unclear D1 target
    - unsafe evidence boundary
    - unapproved customer data access
  allowed_next_action: EXECUTE_ONLY_IF_SEPARATELY_APPROVED
```

## 16. Future Non-Authorizing Prompt Stub

Use only after a human fills approval blocks with non-HOLD values. This stub is
not approval by itself:

```text
Prepare or execute the separately approved Manual Review Notes v1 production
proof for dooosp/b2b-lead-agent. Use approval_record: <URL>. Start from current
origin/master and prove repo root, branch, HEAD SHA, default branch, dirty
state, PR/CI state, and validation commands. Run only the exact commands and
surfaces listed in the approval record. Stop on stale SHA, failing validation,
missing owner, missing approved rollback execution plan, unclear production D1
target, missing privacy/access approval, unsafe evidence, or unapproved
customer-data access. Generated reviewer suggestions remain copy-only,
unsaved, unretained, unattributed, unexported, excluded from history, and not
human-authored saved notes unless a separate future decision changes that
boundary.
```

## 17. Validation Expectations For This Packet

For this docs-only packet:

- `git diff --check`
- `npm run check:naming`
- `npm run check:schema`
- `npm test`

If source-of-truth docs are updated in the same PR, the PR body must state that
validation is local/non-production evidence only and that production proof
execution remains HOLD.
