# D1 Lazy Migration Observation Plan

## Purpose

Plan a future, human-approved production deploy and observation run for the lazy D1 lead trust and review columns shipped by PR #25 and PR #27.

This document is a readiness plan only. It is not production evidence, not a deployment record, and not a database migration record.

## Scope

The production observation scope is limited to the D1 `leads` table columns that current `master` proves through `worker/db/schema.js`, `worker/schema.sql`, and `worker/db/transform.js`.

Columns to observe:

| Column | Purpose | Current evidence |
| --- | --- | --- |
| `review_status` | LeadBrief v1 human review state, separate from sales pipeline `status` | `worker/db/schema.js`, `worker/schema.sql`, `worker/db/leads.js`, `worker/lib/leadbrief-v1.js` |
| `evidence` | Structured evidence list for LeadBrief/trust metadata | `worker/db/schema.js`, `worker/db/transform.js` |
| `confidence` | LeadBrief confidence level | `worker/db/schema.js`, `worker/db/transform.js` |
| `confidence_reason` | Explanation for confidence/trust posture | `worker/db/schema.js`, `worker/db/transform.js` |
| `assumptions` | Explicit assumptions behind the brief | `worker/db/schema.js`, `worker/db/transform.js` |
| `generation_mode` | Generation path such as `llm`, `heuristic`, `demo`, or `unavailable` | `worker/db/schema.js`, `worker/schema.sql`, `worker/db/transform.js` |
| `verification_status` | Machine verification state such as `verified`, `needs_review`, `draft`, or `unverified` | `worker/db/schema.js`, `worker/schema.sql`, `worker/db/transform.js` |
| `data_gaps` | Known missing data or review gaps | `worker/db/schema.js`, `worker/schema.sql`, `worker/db/transform.js` |
| `event_type` | Optional signal/event classification | `worker/db/schema.js`, `worker/db/transform.js` |

Related non-trust columns such as `identity_key`, `score_reason`, `urgency`, `urgency_reason`, and `buyer_role` may be present from earlier lazy schema evolution, but they are not the primary observation target for this plan.

## Non-Goals

- No deploy in this planning task.
- No production DB write in this planning task.
- No production DB migration in this planning task.
- No claim that production D1 lazy migration has been observed.
- No synthetic evidence treated as production observation.
- No fake customer data unless a future human explicitly approves it.
- No Review Inbox, CRM expansion, dashboard redesign, PPT, CPA, proposal generator, roleplay, RBAC, assignment, comments, or notifications work.
- No runtime code, schema, test, package, or generated report changes in this plan PR.

## Current Code Paths

`ensureD1Schema(db)` in `worker/db/schema.js` performs the lazy D1 schema work. It is called by:

- `saveLeadsBatch()` before managed or self-service lead persistence.
- `getLeadsByProfile()`, `getAllLeads()`, and `getLeadById()` before D1 reads.
- `updateLeadPatchAtomic()` before authenticated PATCH updates.
- dashboard, enrichment, job, and reference helpers that use D1.

Low-risk future paths that can invoke `ensureD1Schema()` after an approved deploy:

- Authenticated `GET /api/leads?profile=<managed-profile>` through `worker/api/leads.js`.
- Authenticated `GET /api/history?profile=<managed-profile>` through `worker/api/leads.js`.
- Authenticated `GET /leads/<lead-id>` if a real lead id already exists and the owner approves using the UI path.

Potential write paths that can prove row roundtrip after explicit production write approval:

- Authenticated `PATCH /api/leads/<lead-id>` with a real human review decision, using one of `NEW`, `NEEDS_REVIEW`, `APPROVED`, `REJECTED`, or `DEFERRED`.
- Authenticated `POST /api/analyze` only for a real, approved self-service target. This persists self-service leads through `saveLeadsBatch()`.
- Authenticated `GET /api/leads?profile=<managed-profile>` may cache GitHub latest leads into D1 when D1 has no rows. Treat that as a production write path, not as a read-only check, and require explicit production write approval before relying on it.

## Future Pre-Deploy Checklist

Before any future deploy/observe run, record:

- `master` HEAD SHA and PR state.
- CI status for `CI / test` and `Validate Naming / validate`.
- Confirmation that the deployed worker will include `worker/db/schema.js`, `worker/db/leads.js`, `worker/db/transform.js`, `worker/api/leads.js`, and `worker/lib/leadbrief-v1.js` from the approved HEAD.
- Confirmation that `ensureD1Schema()` still contains the target columns listed above.
- Confirmation that the deploy owner is explicitly authorized to trigger production deploy.
- Confirmation that production DB migration/lazy DDL is explicitly approved, because `ensureD1Schema()` may run `ALTER TABLE`.
- Confirmation that production DB write approval is explicit for any row roundtrip action.
- Production DB backup/export policy, or a documented owner decision to hold until that policy is known.
- Rollback owner and rollback command/process for the Worker deploy.
- Observation window start/end, owner, and communication channel.
- Safe production profile or lead id selected by the product/release owner.

## Future Observation Checklist

The future observation run should use the least risky path that proves the needed fact.

1. Record timestamp, deploy owner, observer, deployed Worker version, and commit SHA.
2. Confirm the Worker deploy completed from the approved HEAD.
3. Confirm no ad hoc production data write has happened yet.
4. Run a read/schema observation first:
   - Prefer a D1 schema query such as `PRAGMA table_info(leads);` through the approved Cloudflare/D1 read path.
   - Capture proof that each target column exists with its type/default when available.
5. Invoke one approved minimal path that causes `ensureD1Schema()` to run:
   - Prefer authenticated `GET /api/leads?profile=<managed-profile>` if the owner accepts its possible D1 cache write behavior.
   - Otherwise use a D1 schema query plus an explicitly approved UI/API path.
6. If production write approval is granted, perform one real row roundtrip:
   - Use a real lead and a real human review decision through `PATCH /api/leads/<lead-id>`.
   - Do not toggle review state only to manufacture evidence.
   - Capture request timestamp, endpoint, response status, response body fields, and D1 row values.
7. Verify row values:
   - `review_status` stores the intended human review value.
   - `status` remains the sales pipeline value and was not overwritten by `review_status`.
   - Trust fields such as `generation_mode`, `verification_status`, and `data_gaps` are readable from D1 or defaulted as expected.
8. Check read surfaces after the row proof:
   - `/api/leads` includes LeadBrief/trust fields.
   - CSV export includes review/trust metadata if explicitly approved for the same profile.
   - UI shows review status separately from pipeline status.
9. Save evidence in the release record. Do not add it to the repo as if it were generated by this planning task.

## Production-Observed Evidence

Production-observed evidence must include all of:

- Timestamp in UTC.
- Deployed Worker commit SHA.
- Deployed Worker version or deployment id if available.
- Exact endpoint, UI action, or D1 command used.
- Actor/owner who approved deploy, lazy DDL/migration, and production write if a write occurred.
- HTTP response status or D1 command result.
- D1 schema proof showing the target columns in production.
- Row roundtrip proof for trust/review fields if a production write was approved and safely available.
- Confirmation that `status` and `review_status` stayed separate.
- Confirmation that no fake/synthetic customer evidence was used unless separately approved and labeled.

The following do not count as production-observed evidence:

- Local tests.
- CI results.
- Docs.
- Fixtures.
- Generated markdown summaries.
- PR descriptions.
- Screenshots without a production deployment id or timestamp.
- Synthetic claims.
- Any observation from staging, local D1, or a test database.

### Evidence Template

This is a template only.

```json
{
  "evidenceType": "d1_lazy_trust_review_observation",
  "environment": "production",
  "observedAtUtc": "",
  "observer": "",
  "deployApproval": {
    "approved": false,
    "approver": "",
    "approvalRecord": ""
  },
  "productionDbMigrationApproval": {
    "approved": false,
    "approver": "",
    "approvalRecord": ""
  },
  "productionDbWriteApproval": {
    "approved": false,
    "approver": "",
    "approvalRecord": ""
  },
  "worker": {
    "commitSha": "",
    "deploymentId": "",
    "deploymentUrl": ""
  },
  "schemaProof": {
    "commandOrEndpoint": "",
    "columnsObserved": [
      "review_status",
      "evidence",
      "confidence",
      "confidence_reason",
      "assumptions",
      "generation_mode",
      "verification_status",
      "data_gaps",
      "event_type"
    ],
    "rawResultLocation": ""
  },
  "rowRoundtripProof": {
    "performed": false,
    "leadId": "",
    "endpointOrAction": "",
    "responseStatus": "",
    "reviewStatusBefore": "",
    "reviewStatusAfter": "",
    "pipelineStatusBefore": "",
    "pipelineStatusAfter": "",
    "trustFieldsObserved": {},
    "rawResultLocation": ""
  },
  "nonEvidenceExcluded": [
    "local tests",
    "CI",
    "docs",
    "fixtures",
    "synthetic claims"
  ],
  "decision": "",
  "notes": ""
}
```

## Rollback And Failure Plan

If lazy migration fails:

- Stop observation and capture the exact error, endpoint/command, timestamp, and deployed SHA.
- Do not run ad hoc destructive SQL such as `DROP TABLE`, table rebuilds, or column rewrites.
- Roll back the Worker only through the approved rollback owner/process.
- Decide whether to prepare a reviewed explicit D1 migration script or a runtime fix PR.
- Require human approval before any production D1 repair or backfill.

If `PATCH /api/leads/<lead-id>` reviewStatus fails:

- Stop after one verified failure unless the owner approves a single retry.
- Confirm whether the failure is auth, validation, missing lead, schema, or runtime code.
- Do not toggle unrelated fields to force a write.
- Do not overwrite human review decisions.
- Roll back or patch only after a scoped root-cause review.

If CSV, API, or UI surfaces show missing columns/fields:

- Treat it as a release blocker for claiming production readiness.
- Confirm whether the issue is schema, transform, API serialization, or UI rendering.
- Do not expand the frozen CRM latest-published contract as part of the fix.
- Prefer a narrow follow-up PR with tests over manual production changes.

## Risk Register

| Risk | Impact | Mitigation |
| --- | --- | --- |
| D1 lazy migration not observed | Release cannot claim production D1 readiness | Require schema proof from production after approved deploy |
| Production write path unclear | Row roundtrip evidence may be unsafe or unavailable | Hold until owner selects a real lead/action or approves a safe self-service target |
| Old rows missing fields | API/UI may default or omit trust/review metadata unexpectedly | Verify schema defaults and at least one real row read |
| Human review decisions overwritten | Review trust is damaged | Confirm upserts preserve `review_status`; use PATCH proof that leaves `status` separate |
| CRM frozen contract accidentally expanded | Downstream consumers receive unscoped fields | Keep `crm.published-report.v1` unchanged unless a separate contract PR is approved |
| GET path writes to D1 cache | A read-looking action may mutate production DB | Treat `GET /api/leads` as requiring production write approval when D1 cache writes are possible |
| Backup/export policy unknown | Recovery options are unclear | Use `HOLD_NEEDS_PROD_DB_BACKUP_POLICY` until owner confirms policy |

## Readiness Decision Values

- `READY_TO_DEPLOY_OBSERVE`: deploy owner, rollback owner, backup policy, migration approval, write approval, safe path, CI, and evidence template are all ready.
- `HOLD_NEEDS_DEPLOY_OWNER`: no authorized person is named to trigger or own production deploy.
- `HOLD_NEEDS_PROD_DB_BACKUP_POLICY`: production D1 backup/export policy is unknown.
- `HOLD_NEEDS_SAFE_WRITE_PATH`: no real approved row roundtrip path is available.
- `HOLD_NEEDS_ROLLBACK_OWNER`: rollback owner/process is not named.

## Future Deploy/Observe Prompt

```text
You are Codex acting as a supervised production observation agent for dooosp/b2b-lead-agent.

Goal: perform a production deploy and observation run for D1 lazy trust/review columns only if explicit approvals are present.

Required approvals before action:
- ALLOW_DEPLOY must be exactly yes before deploying.
- ALLOW_PRODUCTION_DB_MIGRATION must be exactly yes before invoking any path expected to run D1 lazy DDL through ensureD1Schema().
- ALLOW_PRODUCTION_DB_WRITE must be exactly yes before any row write, including PATCH reviewStatus, self-service analyze persistence, or GET /api/leads cache writes.
- ALLOW_PRODUCTION_OBSERVATION_CLAIM must be exactly yes before stating that production D1 lazy migration was observed.

Start with repo preflight on current master:
- repo root, repo identity, branch, HEAD SHA, default branch, upstream, dirty status, origin/master.
- confirm CI is green for the deploy commit.
- read AGENTS.md, HARDENING_PLAN.md, NEXT_SESSION_PROMPT.md, docs/exec-plans/internal-api-contract-freeze.md, docs/exec-plans/leadbrief-v1-contract.md, and docs/exec-plans/d1-lazy-migration-observation-plan.md.

Scope:
- observe only D1 leads columns review_status, evidence, confidence, confidence_reason, assumptions, generation_mode, verification_status, data_gaps, and event_type.
- do not expand CRM, Review Inbox, dashboard, PPT, proposal, CPA, roleplay, RBAC, comments, assignment, or notifications.
- do not use fake customer data unless separately approved and labeled.

If approvals are missing, stop with HOLD and state exactly which approval is missing.
If approvals are present, deploy only the approved master commit, run the minimal observation checklist from docs/exec-plans/d1-lazy-migration-observation-plan.md, capture evidence using the template, and report whether the readiness decision is READY_TO_DEPLOY_OBSERVE or a HOLD_* value.
```
