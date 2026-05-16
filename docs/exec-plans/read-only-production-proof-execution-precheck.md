# Read-Only Production Proof Execution Precheck

## 1. Document status

Status: `PRECHECK_ONLY_NOT_APPROVED_FOR_EXECUTION`

Current repo baseline SHA: `0813a968fe78d37fe89e309aa58fefca09899d26`

Related records:

- Read-only proof plan PR: https://github.com/dooosp/b2b-lead-agent/pull/105
- Read-only proof plan file: `docs/exec-plans/read-only-production-proof-plan.md`
- Issue #34 human decision comment:
  https://github.com/dooosp/b2b-lead-agent/issues/34#issuecomment-4464571282
- Issue #34 expanded decision record:
  https://github.com/dooosp/b2b-lead-agent/issues/34#issuecomment-4464575990
- Production readiness packet:
  `docs/exec-plans/production-proof-readiness-packet.md`
- Production boundary doc: `docs/roadmap/production-proof-boundaries.md`

This packet does not authorize production action. This packet does not
authorize deploy, Wrangler commands, production D1 access, production D1 schema
read, production D1 row read, production D1 row write, production D1 migration
or lazy DDL, production Worker endpoint calls, production logs or secrets,
production smoke tests, or production observation claims.

Production proof execution status for this run: not executed.

Production gates status for this run: closed.

## 2. Purpose

This packet converts the PR #105 read-only production proof plan into an
execution precheck checklist. It defines the fields, records, owners, policies,
commands, evidence boundaries, rollback paths, and stop conditions that must be
complete before a later read-only production proof execution prompt can even be
considered.

This packet must not be run as an execution plan. Missing, stale, ambiguous, or
unsafe data defaults to `HOLD`. A later execution request must supply a
separate explicit execution approval record and the completed precheck block.

## 3. Scope of this precheck

Allowed in this precheck:

- Collect owner names and approval record references.
- Define exact future commands without running them.
- Define the future evidence storage path without creating production evidence.
- Define redaction rules.
- Define rollback and stop criteria.
- Define the no-write and no-row-mutation posture.
- Define validation of approval completeness.

Forbidden in this precheck:

- Deploy execution.
- Wrangler execution.
- Production D1 access.
- Production D1 schema read.
- Production row read.
- Production row write.
- Production endpoint call.
- Production logs or secrets.
- Production smoke test.
- Production observation claim.

## 4. Required gate table

Every gate remains `HOLD` unless a later explicit human approval record fills
the required value. GitHub ownership, PR authorship, merge rights, CI success,
docs, source inspection, and this precheck packet do not fill production gates.

| gate | required value before execution | current value | owner/approver | approval record | status | notes |
| --- | --- | --- | --- | --- | --- | --- |
| `ALLOW_DEPLOY` | Explicit `yes` for the exact deploy action, approved SHA, deploy owner, deploy path, rollback path, UTC timestamp | `no` | `null` | `null` | `HOLD` | No deploy is approved by Issue #34 precheck-only decision. |
| `ALLOW_PRODUCTION_ENDPOINT_CALL` | Explicit `yes`, exact method, exact route, call count, auth posture, redaction policy | `no` | `null` | `null` | `HOLD` | No Worker endpoint call is approved. |
| `ALLOW_PRODUCTION_DB_ACCESS` | Explicit `yes`, DB owner, exact read/schema method, evidence policy | `no` | `null` | `null` | `HOLD` | No production D1 access is approved. |
| `ALLOW_PRODUCTION_DB_MIGRATION` | Explicit `yes`, migration or lazy-DDL owner, method, backup/export posture, stop criteria | `no` | `null` | `null` | `HOLD` | No migration or lazy DDL is approved. |
| `ALLOW_PRODUCTION_DB_WRITE` | Explicit `yes`, safe real row/action, no-overwrite check, rollback or restoration plan | `no` | `null` | `null` | `HOLD` | Read-only proof must not write rows unless separately approved, which would no longer be this read-only scope. |
| `ALLOW_PRODUCTION_OBSERVATION_CLAIM` | Explicit `yes` after complete evidence review, observation owner, exact allowed claim wording | `no` | `null` | `null` | `HOLD` | No production observation claim is approved. |
| `DEPLOY_OWNER` | Named owner with authority to approve, pause, or stop deploy | `null` | `null` | `null` | `HOLD` | Do not infer from repository ownership. |
| `PRODUCTION_DB_OWNER` | Named owner with authority over production D1 access, backup/export, migration, and writes | `null` | `null` | `null` | `HOLD` | Required even for schema-only proof. |
| `ROLLBACK_OWNER` | Named owner and approved rollback or restoration process | `null` | `null` | `null` | `HOLD` | Required before any deploy-adjacent or DB-adjacent action. |
| `OBSERVATION_OWNER` | Named owner for evidence review and claim gating | `null` | `null` | `null` | `HOLD` | Required before any observation claim can be considered. |
| `EVIDENCE_OWNER` | Named owner for evidence storage, access controls, redaction, and retention | `null` | `null` | `null` | `HOLD` | Required before evidence capture. |
| `APPROVED_DEPLOY_SHA` | Exact SHA approved for the future production action | `null` | `null` | `null` | `HOLD` | Baseline SHA is known, but it is not an approved deploy SHA. |
| `CI_PROOF_FOR_APPROVED_SHA` | Current check metadata for the exact approved SHA | `null` | `null` | `null` | `HOLD` | CI is useful metadata only, not production evidence. |
| `DEPLOY_PATH` | Exact approved command or platform path | `null` | `null` | `null` | `HOLD` | No command may be run from this packet. |
| `ROLLBACK_PATH` | Exact approved rollback command or platform process | `null` | `null` | `null` | `HOLD` | Must exist before deploy-adjacent execution. |
| `EVIDENCE_STORAGE_POLICY` | Approved location, access controls, retention expectation, and owner | `null` | `null` | `null` | `HOLD` | Evidence path must be approved before execution. |
| `EVIDENCE_REDACTION_POLICY` | Approved forbidden-content list and redaction process | `null` | `null` | `null` | `HOLD` | Raw production payloads must not enter repo docs, PRs, or issue comments. |
| `BACKUP_OR_EXPORT_POLICY` | Approved production D1 backup/export policy or explicit DB-owner hold decision | `null` | `null` | `null` | `HOLD` | Required before any DB-adjacent proof. |
| `SCHEMA_PROOF_METHOD` | Exact read-only schema proof method and transcript format | `null` | `null` | `null` | `HOLD` | Candidate methods remain unapproved until filled by a human. |
| `LAZY_DDL_DECISION` | Explicit decision for any path that could trigger `ensureD1Schema()` or DDL | `null` | `null` | `null` | `HOLD` | Any unresolved lazy-DDL risk stops execution. |
| `SAFE_NO_ROW_OR_ROW_SELECTION` | Explicit no-row posture, or owner-approved safe row/profile/lead selection | `null` | `null` | `null` | `HOLD` | No production row may be read by this precheck. |
| `HUMAN_REVIEW_OVERWRITE_RISK_CHECK` | Confirmation no human decision is overwritten or toggled only to manufacture evidence | `null` | `null` | `null` | `HOLD` | Required before any row-adjacent path. |
| `OBSERVATION_WINDOW` | Approved UTC start/end, timeout, and stop criteria | `null` | `null` | `null` | `HOLD` | Required before any future execution prompt. |
| `COMMUNICATION_CHANNEL` | Approved release, incident, or owner channel for status and stop decisions | `null` | `null` | `null` | `HOLD` | Required before any future execution prompt. |

## 5. Future command inventory

The entries below are placeholders for a future execution prompt. They are not
commands to run from this packet. A later prompt must replace bracketed values
with exact approved values and cite the approval record for each production
action.

| command purpose | exact command placeholder | approval gate required | expected output type | forbidden output content | redaction requirement | stop condition |
| --- | --- | --- | --- | --- | --- | --- |
| Check approved commit and CI status | `gh api repos/dooosp/b2b-lead-agent/commits/[APPROVED_SHA]/check-runs --jq '[REDACTED_APPROVED_QUERY]'` | `APPROVED_DEPLOY_SHA`, `CI_PROOF_FOR_APPROVED_SHA` | Machine-readable GitHub check metadata | Secrets, tokens, private URLs, production payloads | Store check names, conclusions, timestamps, and safe links only | Approved SHA missing, mismatch, stale CI, failing CI, or query not exact |
| Prove deploy metadata, if later approved | `[APPROVED_DEPLOY_METADATA_COMMAND_OR_PLATFORM_EXPORT]` | `ALLOW_DEPLOY`, `DEPLOY_OWNER`, `APPROVED_DEPLOY_SHA`, `DEPLOY_PATH`, `ROLLBACK_PATH`, `EVIDENCE_STORAGE_POLICY` | Machine-readable deploy metadata | Secrets, tokens, auth headers, cookies, private URLs, platform diagnostics with sensitive data | Store only deployment id/version, timestamp, artifact SHA, and owner-approved safe fields | Missing deploy owner, rollback path, evidence policy, approved SHA mismatch, or unapproved command |
| Prove read-only Worker route behavior, if later approved | `[APPROVED_HTTP_METADATA_COMMAND] --method [METHOD] --url [REDACTED_APPROVED_ROUTE] --max-calls [CALL_COUNT]` | `ALLOW_PRODUCTION_ENDPOINT_CALL`, plus `ALLOW_PRODUCTION_DB_ACCESS` if route can touch D1 | Machine-readable HTTP metadata and redacted response shape | Auth headers, cookies, tokens, private URLs, customer payloads, PII, unredacted request or response payloads | Redact URL, headers, payloads; store status, content type, byte length, timing, and safe structural summary only | Route can write, cache, enqueue, mutate rows, trigger lazy DDL, or expose sensitive data |
| Prove read-only D1 schema, if later approved | `[APPROVED_D1_SCHEMA_READ_COMMAND] [APPROVED_SCHEMA_QUERY_OR_METHOD]` | `ALLOW_PRODUCTION_DB_ACCESS`, `PRODUCTION_DB_OWNER`, `SCHEMA_PROOF_METHOD`, `LAZY_DDL_DECISION`, `BACKUP_OR_EXPORT_POLICY` | Machine-readable schema transcript | Row data, customer payloads, PII, secrets, database credentials, private URLs | Store column names and safe type/default metadata only; no rows | Lazy-DDL risk unresolved, migration gate missing for DDL-capable path, backup/export policy missing, or method not exact |
| Prove no-write row serialization posture, if later approved | `[APPROVED_NO_WRITE_ROW_SERIALIZATION_COMMAND_OR_METHOD]` | `ALLOW_PRODUCTION_DB_ACCESS`, `SAFE_NO_ROW_OR_ROW_SELECTION`, `HUMAN_REVIEW_OVERWRITE_RISK_CHECK`, `EVIDENCE_REDACTION_POLICY` | Machine-readable no-row result or redacted field-shape summary | Customer payloads, PII, private company data, row identifiers unless approved, unredacted response payloads | Prefer no-row proof; otherwise store only owner-approved field-shape metadata | Any write risk, row exposure risk, overwrite risk, unsafe row selection, or need for `ALLOW_PRODUCTION_DB_WRITE` |

Important command rules:

- Do not include real secrets, auth headers, cookies, tokens, private URLs, or
  production payloads in a future prompt.
- Do not run or validate these placeholders in this precheck run.
- Do not turn a placeholder into a real command without a separate execution
  approval record.
- Do not use screenshot-only output as proof.

## 6. Evidence packet requirements

Future evidence, if later approved, must use the approved evidence storage
location and should be machine-readable where possible.

Required future evidence format:

- Completed approval metadata with approver, UTC timestamp, approval record,
  approved SHA, exact gates, owners, policies, command paths, and stop
  conditions.
- Redacted transcript for each approved action.
- Machine-readable metadata preferred.
- Evidence storage location approved before execution.
- Evidence owner and access controls approved before execution.
- Redaction policy approved before execution.
- Exact record of what was and was not performed.
- Exact record of what was and was not proven.

Forbidden future evidence content:

- Secrets.
- Tokens.
- Auth headers.
- Cookies.
- Private URLs.
- Customer payloads.
- PII.
- Unredacted production request payloads.
- Unredacted production response payloads.
- Production logs unless separately approved by a later explicit record.

Evidence boundaries:

- Screenshot-only evidence is insufficient.
- Docs are not production evidence.
- Local tests are not production evidence.
- CI is not production evidence.
- Source or config inspection is not production evidence.
- Issue comments are not production evidence unless they record a separately
  approved, actually performed, redacted production action within its exact
  approved scope.

## 7. Stop conditions

Stop with `HOLD` if any of these conditions occur:

- Any gate remains `HOLD`.
- Owner missing.
- Approval record missing.
- Evidence policy missing.
- Rollback path missing.
- Backup/export policy missing.
- Exact command missing.
- Lazy-DDL risk unresolved.
- Production row exposure risk.
- Production mutation risk.
- Sensitive data exposure risk.
- Approved SHA mismatch.
- Stale or failing CI for the approved SHA.
- No observation window.
- No communication channel.
- Any command attempts to exceed read-only scope.
- Any attempt to treat this precheck as execution approval.
- Any request would require deploy, Wrangler, production D1 access, production
  D1 schema read, production row read, production row write, production
  endpoint call, production logs/secrets, production smoke test, or production
  observation claim from this packet.
- Any future route can write, cache, enqueue, persist, call `saveLeadsBatch()`,
  or trigger `ensureD1Schema()` without the matching explicit approval.
- Any row action could overwrite a human review decision or toggle
  `review_status` only to manufacture evidence.
- Evidence cannot be safely redacted before storage or sharing.

## 8. Machine-readable precheck block

A human may fill this block later. This block is not approval while any required
field remains `null`, `no`, `HOLD`, or incomplete.

```yaml
document_status: "PRECHECK_DRAFT_NOT_APPROVED"
repo: "dooosp/b2b-lead-agent"
baseline_sha: "0813a968fe78d37fe89e309aa58fefca09899d26"
source_plan_pr: "https://github.com/dooosp/b2b-lead-agent/pull/105"
source_plan_file: "docs/exec-plans/read-only-production-proof-plan.md"
issue_34: "https://github.com/dooosp/b2b-lead-agent/issues/34"
precheck_approval_record: "https://github.com/dooosp/b2b-lead-agent/issues/34#issuecomment-4464571282"
approver: null
approved_at_utc: null
approval_record: null
requested_future_mode: "READ_ONLY_PROOF_EXECUTION"

gates:
  ALLOW_DEPLOY:
    value: "no"
    status: "HOLD"
    approval_record: null
  ALLOW_PRODUCTION_ENDPOINT_CALL:
    value: "no"
    status: "HOLD"
    approval_record: null
  ALLOW_PRODUCTION_DB_ACCESS:
    value: "no"
    status: "HOLD"
    approval_record: null
  ALLOW_PRODUCTION_DB_MIGRATION:
    value: "no"
    status: "HOLD"
    approval_record: null
  ALLOW_PRODUCTION_DB_WRITE:
    value: "no"
    status: "HOLD"
    approval_record: null
  ALLOW_PRODUCTION_OBSERVATION_CLAIM:
    value: "no"
    status: "HOLD"
    approval_record: null

owners:
  DEPLOY_OWNER:
    name: null
    authority_record: null
    status: "HOLD"
  PRODUCTION_DB_OWNER:
    name: null
    authority_record: null
    status: "HOLD"
  ROLLBACK_OWNER:
    name: null
    authority_record: null
    status: "HOLD"
  OBSERVATION_OWNER:
    name: null
    authority_record: null
    status: "HOLD"
  EVIDENCE_OWNER:
    name: null
    authority_record: null
    status: "HOLD"

policies:
  APPROVED_DEPLOY_SHA:
    value: null
    approval_record: null
    status: "HOLD"
  CI_PROOF_FOR_APPROVED_SHA:
    value: null
    approval_record: null
    status: "HOLD"
  DEPLOY_PATH:
    value: null
    approval_record: null
    status: "HOLD"
  ROLLBACK_PATH:
    value: null
    approval_record: null
    status: "HOLD"
  EVIDENCE_STORAGE_POLICY:
    location: null
    access_controls: null
    retention: null
    approval_record: null
    status: "HOLD"
  EVIDENCE_REDACTION_POLICY:
    approval_record: null
    status: "HOLD"
    forbidden_content:
      - "secrets"
      - "tokens"
      - "auth headers"
      - "cookies"
      - "private URLs"
      - "customer payloads"
      - "PII"
      - "unredacted production request payloads"
      - "unredacted production response payloads"
  BACKUP_OR_EXPORT_POLICY:
    value: null
    approval_record: null
    status: "HOLD"
  SCHEMA_PROOF_METHOD:
    value: null
    transcript_format: null
    approval_record: null
    status: "HOLD"
  LAZY_DDL_DECISION:
    value: "HOLD"
    approval_record: null
    status: "HOLD"
  SAFE_NO_ROW_OR_ROW_SELECTION:
    value: "HOLD"
    approved_profile_or_row: null
    approval_record: null
    status: "HOLD"
  HUMAN_REVIEW_OVERWRITE_RISK_CHECK:
    no_overwrite_confirmed: false
    no_evidence_toggle_confirmed: false
    approval_record: null
    status: "HOLD"
  OBSERVATION_WINDOW:
    starts_at_utc: null
    ends_at_utc: null
    timeout_minutes: null
    approval_record: null
    status: "HOLD"
  COMMUNICATION_CHANNEL:
    channel: null
    approval_record: null
    status: "HOLD"

commands:
  check_approved_commit_and_ci:
    exact_command: null
    approval_gate_required:
      - "APPROVED_DEPLOY_SHA"
      - "CI_PROOF_FOR_APPROVED_SHA"
    expected_output_type: "machine-readable GitHub check metadata"
    status: "HOLD"
  deploy_metadata_proof:
    exact_command_or_platform_path: null
    approval_gate_required:
      - "ALLOW_DEPLOY"
      - "DEPLOY_OWNER"
      - "APPROVED_DEPLOY_SHA"
      - "DEPLOY_PATH"
      - "ROLLBACK_PATH"
    expected_output_type: "machine-readable deploy metadata"
    status: "HOLD"
  read_only_worker_route_proof:
    exact_command: null
    method: null
    redacted_route: null
    call_count: null
    approval_gate_required:
      - "ALLOW_PRODUCTION_ENDPOINT_CALL"
    expected_output_type: "machine-readable HTTP metadata and redacted response shape"
    status: "HOLD"
  read_only_d1_schema_proof:
    exact_command_or_method: null
    approval_gate_required:
      - "ALLOW_PRODUCTION_DB_ACCESS"
      - "SCHEMA_PROOF_METHOD"
      - "LAZY_DDL_DECISION"
    expected_output_type: "machine-readable schema transcript"
    status: "HOLD"
  no_write_row_serialization_proof:
    exact_command_or_method: null
    approval_gate_required:
      - "ALLOW_PRODUCTION_DB_ACCESS"
      - "SAFE_NO_ROW_OR_ROW_SELECTION"
      - "HUMAN_REVIEW_OVERWRITE_RISK_CHECK"
    expected_output_type: "machine-readable no-row result or redacted field-shape summary"
    status: "HOLD"

evidence_storage:
  approved_location: null
  access_controls: null
  retention: null
  evidence_owner: null
  approval_record: null
  status: "HOLD"

redaction:
  redact_before_storage: true
  redact_before_issue_or_pr_comment: true
  raw_payloads_allowed_in_repo: false
  raw_payloads_allowed_in_issue_comments: false
  screenshots_only_sufficient: false
  status: "HOLD"

stop_conditions:
  - "any gate remains HOLD"
  - "owner missing"
  - "approval record missing"
  - "evidence policy missing"
  - "rollback path missing"
  - "backup/export policy missing"
  - "exact command missing"
  - "lazy-DDL risk unresolved"
  - "production row exposure risk"
  - "production mutation risk"
  - "sensitive data exposure risk"
  - "approved SHA mismatch"
  - "stale or failing CI"
  - "no observation window"
  - "no communication channel"
  - "command exceeds read-only scope"
  - "attempt to treat this precheck as execution approval"

ready_for_execution: false
hold_reasons:
  - "Production execution approval is missing."
  - "Production gates default to no or HOLD."
  - "Owners, policies, exact commands, evidence path, rollback path, backup/export policy, observation window, and communication channel are not filled."
```

## 9. Future execution prompt requirements

A later execution prompt must include:

- Completed precheck block.
- Exact approved SHA.
- Exact approved commands.
- Exact owners.
- Exact approval records.
- Evidence path.
- Rollback path.
- Stop conditions.
- Explicit permission for each production action.
- Confirmation that no write, migration, or observation claim is allowed unless
  separately approved.
- Confirmation that any production endpoint, D1 access, deploy, rollback, log,
  secret, row read, row write, or smoke-test action has its own explicit gate.

If any field is incomplete, stale, ambiguous, or unsafe, the later execution
prompt must return `HOLD`.

## 10. Next human decision

After reviewing this precheck, choose one:

| Decision | Meaning |
| --- | --- |
| `HOLD` | Do not proceed beyond this precheck. |
| `FILL_PRECHECK_FIELDS_ONLY` | Fill the YAML block and records only; still no execution. |
| `APPROVE_EXECUTION_PROMPT_DRAFT_ONLY` | Draft a future execution prompt for review only; still no execution. |
| `APPROVE_READ_ONLY_PROOF_EXECUTION` | Requires every approval field to be completed and a separate explicit execution prompt before any production action. |

This packet does not allow execution.
