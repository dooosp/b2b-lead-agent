# Manual Review Notes V1 Local / Staging Dry-Run Plan

This packet prepares a future Manual Review Notes v1 local/staging dry-run
rehearsal. It is documentation only. It does not execute a local/staging
dry-run beyond ordinary validation commands for this docs-only PR, does not
access production D1, does not observe production D1 schema, does not run
production migrations or rollback, does not call production endpoints, does not
read production logs or secrets, does not deploy, does not create executable
migration or rollback files, and does not change runtime/UI/schema/API behavior.

## Document Status

- Document status: `DRAFT_NOT_APPROVED_FOR_EXECUTION`.
- Approval-intent record:
  `https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4498372572`.
- Repository: `dooosp/b2b-lead-agent`.
- Default branch: `master`.
- Post-PR139 baseline inspected:
  `e9dc9f402124714b5d004e310b266b7ebdf5d1bf`.
- Scope: docs-only local/staging dry-run planning for Manual Review Notes v1.
- Runtime behavior changed by this packet: none.
- UI behavior changed by this packet: none.
- Schema/API behavior changed by this packet: none.
- Migration file created by this packet: none.
- Rollback file created by this packet: none.
- Local/staging dry-run performed by this packet: none beyond ordinary
  docs-only PR validation commands.
- Production action performed by this packet: none.
- Production readiness claim made by this packet: none beyond
  "local/staging dry-run plan prepared."

```yaml
manual_review_notes_v1_staging_dry_run_plan:
  document_status: DRAFT_NOT_APPROVED_FOR_EXECUTION
  approval_record: "https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4498372572"
  scope: DOCS_ONLY_LOCAL_STAGING_DRY_RUN_PLAN
  post_pr139_baseline: "e9dc9f402124714b5d004e310b266b7ebdf5d1bf"
  local_fake_d1_dry_run_execution_decision: HOLD
  staging_target_decision: HOLD
  staging_credentials_boundary_decision: HOLD
  staging_data_fixture_decision: HOLD
  migration_readiness_rehearsal_decision: HOLD
  rollback_rehearsal_decision: HOLD
  access_control_role_stub_rehearsal_decision: HOLD
  generated_suggestion_boundary_rehearsal_decision: HOLD
  privacy_retention_rehearsal_decision: HOLD
  production_d1_access_decision: HOLD
  production_d1_schema_observation_decision: HOLD
  production_d1_migration_decision: HOLD
  production_rollback_execution_decision: HOLD
  production_proof_execution_decision: HOLD
  production_deploy_decision: HOLD
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
- PR #124 implemented local/test-safe T1 note-specific timestamp support.
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
- PR #139 added the docs-only production rollback/backout plan.

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
- Metadata-only history stores lead relationship, event type, timestamp, and
  the fixed generic `manual_reviewer` author label only.
- Metadata-only history has no old manual note text and no new manual note
  text.
- Metadata-only history does not store generated suggestion text and does not
  store real reviewer identity.
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
- Production rollback/backout remains unexecuted and blocked.
- Production proof remains unexecuted and blocked.

## 2. Non-Authorizing Statement

This plan does not authorize staging execution.
This plan does not authorize production execution.
This plan does not authorize production D1 access.
This plan does not authorize production D1 schema observation.
This plan does not authorize production D1 write.
This plan does not authorize production D1 migration.
This plan does not authorize production rollback.
This plan does not authorize production proof.
This plan does not authorize production deploy.
This plan does not authorize Wrangler production commands.
This plan does not authorize production endpoint calls.
This plan does not authorize production logs/secrets access.
This plan is docs-only planning evidence.

No local/staging dry-run result is claimed by this packet. No production D1
state, production schema, production migration status, production rollback
status, production endpoint behavior, production log content, production secret
value, customer-data state, staging result, or production observation may be
claimed from this packet.

## 3. Dry-Run Scenario Matrix

| Scenario | Current applicability | Risk | Safe response | Forbidden response | Evidence needed | Approval required | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| D0: docs-only plan; no dry-run executed | Current state. This packet is a plan and may run only ordinary docs-only PR validation commands. | Planning can be mistaken for rehearsal evidence. | Record approval, update docs, validate docs locally, and keep execution decisions on HOLD. | Claiming fake-D1, staging, or production dry-run results from this packet. | Repo preflight, PR diff showing docs-only scope, validation output, approval record. | No execution approval; docs-only approval record is enough for this artifact. | Current recommended state. |
| D1: local fake-D1 dry-run using existing repo harness | Future only. Existing fake-D1 tests and local E2E can rehearse behavior after separate dry-run approval. | Local evidence can be overclaimed as staging or production. | Use synthetic fixtures only, run existing local commands, capture command transcript, and label output local/fake-D1 only. | Using production D1, production endpoints, real customer data, or production secrets. | Target worktree, commands, synthetic fixture policy, test output, no-production boundary note. | Separate local dry-run execution approval naming commands and evidence scope. | Safest future execution target if rehearsal is approved. |
| D2: fresh worktree validation dry-run | Future only; also partly overlaps normal docs PR validation when no runtime action is taken. | Stale or dirty branches can contaminate evidence. | Fetch and pin `origin/master`, create a clean worktree, run approved local commands, and record branch/HEAD/status. | Reusing dirty worktrees or old branches as current-state evidence. | Repo root, branch, HEAD SHA, default branch, clean status, command output. | Separate approval if it goes beyond ordinary PR validation. | Require before any D1, migration, rollback, or role-stub rehearsal. |
| D3: local schema/migration-readiness rehearsal without executable migration changes | Future only. Current docs inspect schema sources but do not rehearse migration execution. | Schema checks may be mistaken for production D1 compatibility. | Use `npm run check:schema`, schema contract tests, fake-D1 helpers, and no executable migration file changes. | Creating migration files, running Wrangler production D1 commands, or observing production D1 schema. | Schema source inventory, lazy ALTER review, command transcript, no-new-migration diff. | Separate migration-readiness rehearsal approval. | Do locally before any staging-like target is considered. |
| D4: local rollback/backout rehearsal using fake-D1 only | Future only. PR #139 prepared rollback/backout planning but did not execute rehearsal. | Rollback rehearsal can drift into destructive data behavior. | Simulate no-op and partial states with fake-D1/synthetic fixtures, preserve data by default, and verify generated suggestions do not repopulate notes. | Dropping production columns/tables, deleting data, or using generated suggestions as rollback artifacts. | Fake-D1 fixture, before/after state, no-destructive-data checklist, generated-suggestion boundary evidence. | Separate rollback rehearsal approval. | Use fake-D1 only unless a staging target is separately approved. |
| D5: staging-like rehearsal if an approved non-production target exists | Not currently applicable unless a target is separately named and approved. | A staging label may hide production bindings, production secrets, or customer data. | Require explicit non-production target identity, D1 binding proof, credential boundary, fixture policy, rollback policy, and allowed commands before execution. | Pointing at production D1, production Worker endpoints, production secrets, or real customer data. | Target name, non-production proof, credential boundary, data fixture policy, command list, evidence/redaction plan. | Separate staging target and staging dry-run execution approval. | HOLD until target identity and boundaries are concrete. |
| D6: production dry-run | Forbidden by this packet. | Production dry-run may still reveal schema/data or cause writes/lazy DDL. | Keep HOLD and require a separate production approval packet with exact target, owners, commands, evidence policy, and rollback path. | Running production D1 reads/writes/migrations, production endpoint calls, production smoke tests, production logs/secrets access, or Wrangler production commands. | None from this packet. Future production approval would need exact command and evidence records. | Separate production approval only. | Forbidden now. |

## 4. Preflight Checklist For Any Future Dry-Run

Before any future dry-run execution beyond ordinary docs-only PR validation,
record:

- repo identity check:
  - `git rev-parse --show-toplevel`;
  - package name from `package.json`;
  - required identity files such as `main.js`, `worker/index.js`,
    `tests/main.runtime.test.js`, and `.github/workflows/validate-naming.yml`.
- current branch and exact `HEAD` SHA.
- default branch and pinned `origin/master` SHA.
- expected post-PR139 baseline:
  `e9dc9f402124714b5d004e310b266b7ebdf5d1bf`, unless a later `master` has
  legitimately advanced.
- clean worktree status from `git status --short --branch`.
- open PR inventory and whether any PR touches manual notes, schema, tests,
  workflow gates, or source-of-truth docs.
- docs/plan state:
  - this plan status,
  - production proof plan status,
  - production D1 migration plan status,
  - production rollback/backout plan status,
  - approval records used.
- local dependency setup and lockfile state.
- available package scripts:
  - `check:naming`,
  - `check:schema`,
  - `test`,
  - `test:worker`,
  - `test:e2e:local`,
  - `eval:lead-quality`.
- fake-D1/local harness availability:
  - `worker/tests/helpers/fake-d1.mjs`;
  - `worker/e2e/local-e2e.test.mjs`;
  - manual notes tests;
  - D1 schema tests.
- production boundary check:
  - no production D1 target,
  - no production Worker endpoint,
  - no Wrangler production command,
  - no production smoke test,
  - no customer data.
- secrets/logs boundary check:
  - no production secrets,
  - no production logs,
  - no auth header/cookie capture,
  - no private production URLs in evidence.
- generated suggestion boundary reminder:
  - generated reviewer note suggestions remain copy-only,
  - generated suggestions are not saved notes,
  - generated suggestions cannot be used as rehearsal success evidence.

Stop before dry-run execution if any target identity, command list, data
fixture, credential boundary, or evidence boundary is ambiguous.

## 5. Local Fake-D1 Rehearsal Plan

This section is plan-only. Do not claim these commands ran unless a future
approved dry-run actually runs them.

Candidate local/fake-D1 rehearsal commands:

```bash
npm ci
npm run check:schema
node --test tests/d1-schema-consistency.test.js worker/tests/d1-schema-contract.test.mjs
node --test worker/tests/manual-review-notes.test.mjs
npm run test:worker
npm test
npm run test:e2e:local
npm run eval:lead-quality
```

Rehearsal intent:

- prove local schema source consistency;
- exercise targeted manual notes save/edit/clear tests;
- verify generated suggestion boundary tests;
- verify C2 local/test role-stub tests;
- run local fake-D1 E2E only against loopback/fake-D1 fixtures;
- capture evidence boundaries and command outputs;
- confirm no production target, no production D1, no production endpoint, no
  production secret, no production log, and no customer data are used.

Ordinary docs-only PR validation may run a subset of local validation commands.
That validation is not a dry-run execution result and must not be described as
staging or production rehearsal evidence.

## 6. Migration-Readiness Rehearsal Plan

This section is plan-only and creates no executable migration file.

Future migration-readiness rehearsal should:

- inspect schema inventory in `worker/schema.sql`, `worker/db/schema.js`, and
  `scripts/check-d1-schema-consistency.js`;
- compare schema files and lazy `ensureD1Schema()` ALTER logic;
- verify that `manual_review_notes_updated_at` is nullable;
- verify that `manual_review_notes_author_label` is nullable;
- verify that `manual_review_note_events` contains only metadata columns:
  `id`, `lead_id`, `event_type`, `changed_at`, and `author_label`;
- verify that `manual_review_note_events.event_type` remains limited to
  `create`, `edit`, and `clear`;
- verify that history has no old manual note text columns;
- verify that history has no new manual note text columns;
- verify that history has no generated suggestion text columns;
- verify that generated suggestion fields are not persistence fields;
- verify compatibility with null metadata on existing rows;
- verify unchanged manual note saves do not fabricate timestamps, author
  labels, or history events;
- verify generated-suggestion patch aliases are rejected atomically;
- verify batch generated/cache refresh paths do not create saved manual notes;
- verify no export expansion and no metadata-history export expansion;
- verify local role-stub metadata still reports `realAuthImplemented: false`
  and `productionReady: false`;
- verify no executable migration is introduced during docs-only planning.

Production schema compatibility cannot be claimed from this rehearsal. Any
production D1 schema observation, migration dry-run, or migration execution
requires a separate production approval record.

## 7. Rollback / Backout Rehearsal Plan

This section is plan-only. Any future rehearsal must be local/fake-D1 only
unless a separate non-production staging target is approved.

Future rollback/backout rehearsal should:

- simulate no-op state: no migration executed, no rollback needed;
- simulate partial schema state using fake-D1/synthetic fixtures, such as
  nullable lead metadata fields present while event table/index is absent;
- simulate event table present but no writes performed;
- simulate write-stop behavior without deleting current manual note values;
- rehearse no-destructive-data rules:
  - do not drop columns by default,
  - do not drop `manual_review_note_events` by default,
  - do not delete current manual note text by default,
  - do not delete metadata-only history by default,
  - preserve first, decide deletion separately;
- verify rollback does not repopulate manual notes from generated suggestions;
- verify rollback does not use generated suggestions as replacement note text;
- verify rollback does not create generated suggestion history, attribution,
  retention, export, or evidence;
- verify rollback does not delete manual note data without explicit approval;
- verify rollback evidence records only local/fake-D1 state unless a staging
  target is separately approved;
- verify failure handling stops rather than improvising destructive repair.

Production rollback execution, destructive data action, production D1
schema/data deletion, and production backout commands remain HOLD.

## 8. C2 Role-Stub Rehearsal Plan

This section is plan-only. The C2 role stub is local/test-only and not
production access control.

Future local/test role-stub rehearsal should:

- enable `MANUAL_REVIEW_NOTES_LOCAL_TEST_ROLE_STUB=enabled` only in local/test;
- send `X-Manual-Review-Notes-Local-Test-Role: reviewer` for reviewer cases;
- verify the `reviewer` role can read current manual note fields locally;
- verify the `reviewer` role can write `manualReviewNotes` locally;
- verify the `reviewer` role can read metadata-history summary fields only;
- verify `manager` cannot write manual notes;
- verify `manager` receives protected manual note fields omitted from local
  list/history/export reads under the stub;
- verify `api`, missing, and unknown roles are treated as non-reviewers for
  protected manual note fields;
- verify generated suggestion helper fields do not become saved note fields
  for any role;
- verify access metadata reports:

```json
{
  "mode": "local_test_role_stub",
  "realAuthImplemented": false,
  "productionReady": false
}
```

- verify no production auth, session, reviewer identity, manager visibility,
  export expansion, API exposure expansion, or production readiness claim is
  made from the stub.

C2 role-stub rehearsal cannot satisfy production access-control proof.

## 9. Generated Suggestion Exclusion Rehearsal

Generated reviewer note suggestions are not manual notes. Any future rehearsal
must verify that generated suggestions are:

- not saved;
- not persisted;
- not snapshotted;
- not history events;
- not exported;
- not attributed to a reviewer;
- not retained;
- not shown as saved notes;
- not treated as human-authored notes;
- not stored in `leads.notes`;
- not stored in `manual_review_notes_updated_at`;
- not stored in `manual_review_notes_author_label`;
- not stored in `manual_review_note_events`;
- not allowed to update `manualReviewNotesUpdatedAt`;
- not allowed to update `manualReviewNotesAuthorLabel`;
- not allowed to clear existing human-entered manual notes;
- rejected for generated suggestion patch aliases;
- absent from CSV/export fields;
- absent from migration schema additions;
- unable to repopulate manual notes during rollback;
- unable to become production proof evidence.

If a future rehearsal detects generated suggestion persistence, attribution,
history, export, or rollback repopulation, stop and investigate locally. Do not
perform production repair or data deletion without separate approval.

## 10. Privacy / Retention Rehearsal

This section is plan-only and does not implement enforcement.

Future privacy/retention rehearsal should verify:

- privacy warning is warning-only;
- no automated PII detection is rehearsed unless separately approved;
- no automated redaction is rehearsed unless separately approved;
- no purge/delete job is rehearsed unless separately approved;
- no retention enforcement is present;
- metadata-only history is not audit/legal retention proof;
- `manual_review_note_events` does not store old note text;
- `manual_review_note_events` does not store new note text;
- current manual note text may contain sensitive sales context or PII;
- dry-run fixtures use synthetic data only;
- dry-run does not use real customer data;
- dry-run evidence does not include secrets, auth material, production URLs,
  customer payloads, generated suggestion text, or sensitive manual note text
  beyond synthetic examples;
- clear/delete rehearsal distinguishes clearing current saved note text from
  deleting metadata-only history or satisfying a retention policy.

Privacy warning copy is not privacy compliance. Metadata-only history is not a
legal/audit record. Production privacy/retention enforcement remains HOLD.

## 11. Staging-Like Target Requirements

If a future non-production staging target exists, document all of the following
before any staging-like execution:

- explicit target name;
- explicit non-production status;
- exact branch/commit/artifact under test;
- exact D1 binding name and proof that it is not production D1;
- exact Worker endpoint and proof that it is not a production endpoint;
- no production secrets;
- no production logs;
- approved credentials boundary;
- approved synthetic data fixture policy;
- approved rule that no real customer data is used;
- approved rollback/backout policy for the staging target;
- allowed validation commands and forbidden commands;
- evidence capture plan;
- evidence redaction policy;
- owner/operator for the staging target;
- stop criteria for target ambiguity, schema mismatch, generated suggestion
  boundary failure, access-control ambiguity, fixture contamination, or
  evidence leakage.

If no staging target exists, staging-like rehearsal remains plan-only and
local/fake-D1 remains the only safe default.

## 12. Evidence And Anti-Overclaim Rules

- Docs-only plan is not execution.
- Ordinary docs-only PR validation is not a dry-run execution claim.
- Local fake-D1 is not staging unless explicitly defined.
- Staging is not production.
- CI is not production proof.
- Local E2E is not production proof.
- PR merge is not production observation.
- Generated reports are not runtime evidence.
- Schema source consistency is not production D1 schema compatibility.
- Lazy DDL code presence is not production migration evidence.
- C2 local/test role stub is not real auth.
- `manual_reviewer` is not a real reviewer identity.
- `manual_review_note_events` is not audit/legal retention proof.
- Static privacy warning copy is not detection, redaction, retention, purge, or
  compliance enforcement.
- Generated suggestions cannot be saved-note, rollback, staging, local dry-run,
  or production-proof evidence.
- No production D1 state can be claimed without approved production D1
  observation.
- No staging result can be claimed unless a future approved staging dry-run
  actually runs.
- No customer-data state can be claimed without separately approved data access
  and evidence boundaries.

## 13. Future Approval Blocks

The current plan approval block remains non-executing:

```yaml
manual_review_notes_v1_staging_dry_run_plan:
  document_status: DRAFT_NOT_APPROVED_FOR_EXECUTION
  approval_record: "https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4498372572"
  local_fake_d1_dry_run_execution_decision: HOLD
  staging_target_decision: HOLD
  staging_credentials_boundary_decision: HOLD
  staging_data_fixture_decision: HOLD
  migration_readiness_rehearsal_decision: HOLD
  rollback_rehearsal_decision: HOLD
  generated_suggestion_boundary_rehearsal_decision: HOLD
  privacy_retention_rehearsal_decision: HOLD
  production_d1_access_decision: HOLD
  production_proof_execution_decision: HOLD
  allowed_next_action: PLAN_ONLY
```

A future local/fake-D1 dry-run execution request must include:

```yaml
manual_review_notes_v1_local_fake_d1_dry_run_execution_request:
  requested_status: NOT_APPROVED_BY_THIS_PLAN
  target_type: LOCAL_FAKE_D1_ONLY
  target_repo_root: null
  target_branch: null
  target_head_sha: null
  approval_record: null
  allowed_commands: []
  forbidden_commands:
    - wrangler production commands
    - production D1 commands
    - production endpoint calls
    - production logs/secrets reads
    - production smoke tests
  data_fixture_policy: SYNTHETIC_ONLY
  evidence_redaction_policy: REQUIRED
  generated_suggestion_boundary_required: true
  privacy_retention_boundary_required: true
  execution_decision: HOLD
```

A future staging-like dry-run execution request must include:

```yaml
manual_review_notes_v1_staging_like_dry_run_execution_request:
  requested_status: NOT_APPROVED_BY_THIS_PLAN
  explicit_target_name: null
  explicit_non_production_status: null
  d1_binding: null
  d1_binding_is_production: UNKNOWN
  endpoint: null
  endpoint_is_production: UNKNOWN
  credentials_boundary: null
  data_fixture_policy: null
  rollback_backout_policy: null
  approval_record: null
  allowed_commands: []
  forbidden_commands:
    - production D1 access
    - production D1 schema observation
    - production D1 migration
    - production D1 write/delete
    - production endpoint calls
    - production logs/secrets reads
    - production smoke tests
    - customer data access
  evidence_redaction_policy: REQUIRED
  generated_suggestion_boundary_required: true
  privacy_retention_boundary_required: true
  execution_decision: HOLD
```

A future production dry-run, production proof, production D1 observation,
production migration, production rollback, production deploy, production smoke
test, production endpoint call, production logs/secrets read, production
access-control implementation, real auth/session/identity implementation,
manager visibility expansion, export expansion, API exposure expansion,
retention/privacy enforcement, purge/delete job, redaction workflow, automated
PII detection, destructive data action, old/new note value history, or
generated suggestion persistence/history/export/attribution requires a separate
approval record. This document cannot be used as that approval.
