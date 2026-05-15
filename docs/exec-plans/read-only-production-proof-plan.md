# Read-Only Production Proof Plan

## 1. Document status

Status: `PLANNING_ONLY_NOT_APPROVED_FOR_EXECUTION`

Current repo baseline SHA: `b8eb28a93bb3cd96470261af5e11c94121ce3c1f`

Related records:

- Production readiness PR: https://github.com/dooosp/b2b-lead-agent/pull/104
- Issue #34 human decision comment: https://github.com/dooosp/b2b-lead-agent/issues/34#issuecomment-4460325767
- Production readiness packet: `docs/exec-plans/production-proof-readiness-packet.md`
- Production boundary doc: `docs/roadmap/production-proof-boundaries.md`

This plan does not authorize production action. This plan does not authorize
deploy, Wrangler commands, production D1 access, production D1 migration,
production D1 writes, production Worker endpoint calls, production logs or
secret access, live smoke tests, or production observation claims.

Production proof execution status for this run: not executed.

Production gates status for this run: closed.

## 2. Purpose

This document defines a future read-only production proof path that a human can
review before deciding whether any real production action should be approved.
It is planning only.

The sequence below must not be run until a later explicit approval record fills
all required gates, owners, policies, commands or paths, evidence rules, stop
conditions, rollback path, and communication channel. Missing, stale, unsafe, or
ambiguous approval data defaults to `HOLD`.

## 3. Scope of read-only proof planning

Allowed planning scope:

- Production deploy metadata proof planning.
- Read-only Worker route or health proof planning.
- Read-only production D1 schema proof planning.
- Read-only row serialization proof planning, only if no row mutation occurs.
- Evidence storage and redaction planning.
- Rollback and stop-condition planning.

Out of scope for this plan and this run:

- Production deploy execution.
- Production D1 access execution.
- Production row writes.
- Production migrations.
- Production endpoint calls.
- Production logs or secrets.
- Production observation claims.
- Row roundtrip.
- CRM or outreach automation.
- Persistence, schema, API, or runtime implementation.

## 4. Required approvals before execution

Every item in this section is required before any future production execution
and defaults to `HOLD`.

Execution gates:

| Gate | Current state | Required before action |
| --- | --- | --- |
| `ALLOW_DEPLOY` | `HOLD` | Explicit `yes`, approver, UTC timestamp, approval record, approved SHA, deploy owner, deploy path, rollback path |
| `ALLOW_PRODUCTION_ENDPOINT_CALL` | `HOLD` | Explicit `yes`, exact method/path/call count, auth and credential policy, redaction policy |
| `ALLOW_PRODUCTION_DB_ACCESS` | `HOLD` | Explicit `yes`, production DB owner, exact read/schema method, evidence policy |
| `ALLOW_PRODUCTION_DB_MIGRATION` | `HOLD` | Explicit `yes`, migration or lazy-DDL owner, backup/export posture, stop criteria |
| `ALLOW_PRODUCTION_DB_WRITE` | `HOLD` | Explicit `yes`, safe real row/action, no-overwrite check, rollback/restoration path |
| `ALLOW_PRODUCTION_OBSERVATION_CLAIM` | `HOLD` | Explicit `yes`, complete evidence packet review, observation owner approval |

Owners, policies, and run records:

| Required item | Current state | Required content |
| --- | --- | --- |
| Deploy owner | `HOLD` | Named owner with authority to approve and stop deploy |
| Production DB owner | `HOLD` | Named owner with authority over production D1 access, migration, backup/export, and writes |
| Rollback owner | `HOLD` | Named owner and approved rollback process |
| Observation owner | `HOLD` | Named owner for evidence review and observation claim gating |
| Evidence owner | `HOLD` | Named owner for evidence storage, access control, redaction, and retention |
| Approved SHA | `HOLD` | Exact commit SHA approved for the future production action |
| CI proof for approved SHA | `HOLD` | Current checks for the approved SHA; useful metadata only, not production evidence |
| Deploy path | `HOLD` | Exact approved command or platform path |
| Rollback path | `HOLD` | Exact approved rollback command or platform process |
| Evidence storage/redaction policy | `HOLD` | Location, access controls, redaction rules, forbidden content list |
| Backup/export policy | `HOLD` | Production D1 backup/export policy or explicit owner decision to hold |
| Schema proof method | `HOLD` | Exact query or tool path and transcript format |
| Safe no-row / row selection decision | `HOLD` | Explicit no-row posture or owner-approved safe row/profile/lead selection |
| Human-review overwrite risk check | `HOLD` | Confirmation no human decision is overwritten or toggled only to manufacture evidence |
| Observation window | `HOLD` | Approved UTC start/end and stop criteria |
| Communication channel | `HOLD` | Approved release/incident channel for status and stop decisions |

GitHub ownership, PR authorship, merge rights, CI success, and repository admin
status do not fill any production owner, deploy, DB, rollback, evidence, or
observation gate.

## 5. Proposed future stages

These stages are documentation only. Do not execute them from this plan.

### Stage 0 - Current planning packet

Scope:

- Create this docs-only plan.
- Perform no production action.
- Record the current baseline and approval boundary.

Required approvals before this stage: Issue #34 comment
`APPROVE_READ_ONLY_PROOF_PLANNING`.

Execution status in this run: not executed; planning only.

### Stage 1 - Approval validation

Future operator action:

- Review the completed approval YAML, issue comment, or equivalent approval
  record.
- Verify all required gates, owners, policies, exact paths, evidence rules,
  rollback path, backup/export posture, communication channel, observation
  window, approved SHA, CI metadata, and safe no-row/row decision.

Stop with `HOLD` if any required item is missing, stale, ambiguous, unsafe, or
contradicts the production boundary.

### Stage 2 - Approved SHA and CI proof check

Future operator action:

- Confirm the exact approved SHA.
- Confirm default branch and remote default branch state.
- Confirm GitHub checks for the exact approved SHA are current and passing.
- Record check names, conclusions, timestamps, and links.

Evidence needed:

- Machine-readable GitHub check metadata for the approved SHA.
- The approved SHA and approval record that names it.

Boundary:

- CI metadata is not production evidence.
- No production access is required or allowed in this stage unless separately
  approved for a later stage.

### Stage 3 - Deploy metadata proof, if approved

Future operator action only after `ALLOW_DEPLOY=yes`:

- Capture deploy owner, approved SHA, deploy path, deploy timestamp, deployment
  id or version, deployed artifact SHA, and rollback path.
- Store only redacted, policy-compliant metadata.

Redaction:

- Do not include secrets, tokens, auth headers, cookies, private URLs, customer
  payloads, PII, or unredacted platform diagnostics.

Stop conditions:

- Missing deploy owner, approved SHA, rollback path, evidence policy, or
  communication channel.
- Any mismatch between approved SHA and deployed artifact.
- Any need to run an unapproved command or use an unapproved platform path.

Execution in this run: none.

### Stage 4 - Read-only Worker route proof, if approved

Future operator action only after `ALLOW_PRODUCTION_ENDPOINT_CALL=yes`:

- Define exact route, method, call count, headers, auth posture, and expected
  no-write behavior in the approval record before the call.
- Prefer a non-sensitive health or metadata route.
- Capture status, content type, byte length, timing, and safe response shape
  only if the evidence policy allows it.

Evidence restrictions:

- Do not place private URLs in evidence.
- Do not place auth headers, cookies, tokens, or credentials in evidence.
- Do not include unredacted request or response payloads.
- Do not treat screenshots or browser captures alone as sufficient proof.

Stop conditions:

- Route can access D1 without `ALLOW_PRODUCTION_DB_ACCESS=yes`.
- Route can write, cache, enqueue, mutate rows, trigger jobs, or invoke lazy DDL
  without the matching approval.
- Evidence cannot be redacted safely.

Execution in this run: none.

### Stage 5 - Read-only D1 schema proof, if approved

Future operator action only after all required DB and lazy-DDL decisions are
approved:

- Define the exact schema proof method before access. Candidate query:
  `PRAGMA table_info(leads)`.
- Capture a machine-readable schema transcript showing column names and safe
  type/default metadata, subject to the evidence policy.
- Record production DB owner, schema proof method, approved SHA, timestamp, and
  evidence location.

Lazy-DDL risk:

- `ensureD1Schema()` can perform lazy `ALTER TABLE` work on paths that appear
  read-oriented.
- Any path that could trigger `ensureD1Schema()` requires an explicit
  `ALLOW_PRODUCTION_DB_MIGRATION=yes` decision or an explicit no-lazy-DDL path
  selected by the production DB owner.
- If the method might trigger DDL and migration/lazy-DDL approval is missing,
  stop with `HOLD`.

Execution in this run: none.

### Stage 6 - Read-only row serialization proof, if approved

Future operator action only after `ALLOW_PRODUCTION_DB_ACCESS=yes` and a safe
no-row/row decision are approved:

- Prefer a no-write, no-mutation path.
- Prefer an explicit no-row posture if row access is not necessary.
- If row inspection is approved, use only owner-approved safe profile/lead
  selection and capture the smallest possible redacted field-shape evidence.

Evidence restrictions:

- Do not expose customer data, private company payloads, PII, secrets, auth
  data, cookies, or unredacted production response payloads.
- Do not mutate rows.
- Do not use a read-looking path that can cache, persist, or call
  `saveLeadsBatch()` unless write approval is separately granted. If write
  approval is needed, this stage is no longer read-only and must stop.

Proof boundary:

- Read-only row serialization proof can support a claim that approved fields
  are readable in the approved production scope.
- It does not prove row roundtrip, write behavior, or product observation.

Execution in this run: none.

### Stage 7 - Observation claim review

Future operator action only after `ALLOW_PRODUCTION_OBSERVATION_CLAIM=yes`:

- Review the complete evidence packet against approved scope, redaction,
  stop-condition, and storage requirements.
- Confirm whether the exact approved production proof was completed.
- Record any claim narrowly, with exclusions for unproven surfaces.

Boundary:

- No automatic claim is allowed.
- Local tests, CI, docs, source/config, screenshots, and issue comments are not
  production evidence by themselves.
- Any claim outside the approved evidence scope must stop with `HOLD`.

Execution in this run: none.

### What can count as proof only after approval

Nothing in this plan counts as production proof. A future record may count as
proof only after the matching approval exists and the evidence is captured
inside that approved scope.

| Future proof type | Minimum approval and evidence before it can count |
| --- | --- |
| Deploy metadata proof | `ALLOW_DEPLOY=yes`, approved SHA, deploy owner, rollback owner, exact deploy path, exact rollback path, machine-readable deploy metadata |
| Worker route proof | `ALLOW_PRODUCTION_ENDPOINT_CALL=yes`, exact route/method/call count, auth policy, redacted machine-readable response metadata |
| D1 schema proof | `ALLOW_PRODUCTION_DB_ACCESS=yes`, DB owner, schema proof method, evidence policy, and migration/lazy-DDL decision for any path that can trigger DDL |
| Row serialization proof | DB access approval, safe no-row/row decision, no-mutation path, redacted field-shape evidence, and no customer/PII exposure |
| Production observation claim | `ALLOW_PRODUCTION_OBSERVATION_CLAIM=yes` after evidence packet review; no automatic claim |

## 6. Evidence policy

Allowed evidence types, only after the matching future approvals:

- Approval records with approver, UTC timestamp, approved gates, exact scope,
  owners, and policy links.
- Machine-readable GitHub check metadata for the approved SHA.
- Machine-readable deploy metadata, if deploy is approved.
- Machine-readable Worker route response metadata and redacted shape, if an
  endpoint call is approved.
- Machine-readable D1 schema transcript, if production DB access and any
  required lazy-DDL decision are approved.
- Machine-readable redacted row serialization field-shape evidence, if row
  access is approved and no mutation occurs.
- Evidence-review record that states exactly what is and is not proven.

Forbidden evidence content:

- Secrets.
- Tokens.
- Auth headers.
- Cookies.
- Private URLs.
- Customer payloads.
- PII.
- Unredacted production request payloads.
- Unredacted production response payloads.
- Production logs unless separately approved; this plan does not request that.
- Screenshots or image-only artifacts as sole proof.

Redaction requirements:

- Redact before storing or sharing evidence.
- Store only the minimum metadata needed to prove the approved fact.
- Keep raw production payloads out of repo docs, PR bodies, issue comments, and
  public artifacts.
- Include hashes, field names, status codes, byte counts, timestamps, and safe
  structural summaries when those prove the approved fact without exposing data.

Storage and access requirements:

- Evidence must be stored only in the approved evidence location.
- The evidence location must define access controls and retention expectations.
- Public GitHub records may contain only redacted summaries and links to
  approved records when safe.
- Machine-readable evidence is preferred.
- Screenshot-only proof is not sufficient.

Non-evidence:

- Local tests are not production evidence.
- CI is not production evidence.
- Docs and PR descriptions are not production evidence.
- Source/config inspection is not production evidence.
- Local, staging, fake-D1, and test database observations are not production
  evidence.

## 7. Stop conditions

Stop with `HOLD` if any of these conditions occur:

- Any missing approval.
- Any unclear owner.
- Any command uncertainty.
- Any secret, log, customer-data, private URL, or PII exposure risk.
- Any lazy-DDL risk that is not approved.
- Any row mutation risk.
- Any mismatch between approved SHA and deployed artifact.
- Any CI failure, missing CI, or stale CI for the approved SHA.
- Any evidence policy gap.
- Any rollback or backup/export gap.
- Any unredacted sensitive data risk.
- Any attempt to turn planning into execution.
- Any request to run Wrangler, deploy, access production D1, call production
  Worker endpoints, read production logs/secrets, write rows, run smoke tests,
  or claim production observation from this plan.
- Any path that appears read-only but can write, cache, persist, enqueue, or
  trigger `ensureD1Schema()` without explicit matching approval.
- Any row action that could overwrite a human review decision or toggle
  `review_status` only to manufacture evidence.
- Any attempt to treat GitHub ownership, PR authorship, merge rights, CI, docs,
  source/config, local tests, or screenshots as production proof.

## 8. Non-production validation for this plan

The docs-only PR for this plan should use this non-production validation set:

- `git status --short`
- `git diff --check`
- `npm run check:naming`
- `npm run check:schema`
- `npm run eval:lead-quality`
- `npm test`

These commands are local/repo validation only. They do not produce production
evidence and must not be described as production proof.

## 9. Next human action

Choose one of:

| Decision | Meaning |
| --- | --- |
| `HOLD` | Do not proceed beyond planning. |
| `APPROVE_READ_ONLY_PROOF_PLAN_REVIEW_ONLY` | Review and refine this plan only; do not execute. |
| `APPROVE_READ_ONLY_PROOF_EXECUTION_PRECHECK_ONLY` | Permit a future no-production precheck of approvals, owners, policies, and exact paths only. |
| `APPROVE_READ_ONLY_PROOF_EXECUTION` | Permit a future execution prompt only if it includes exact approved gates, owners, policy records, commands, evidence path, stop conditions, and rollback path. |

This plan does not allow execution.

A later execution prompt must include exact approved gates, owners, policy
records, commands, evidence path, stop conditions, and rollback path. Without
those records, the correct result is `HOLD`.
