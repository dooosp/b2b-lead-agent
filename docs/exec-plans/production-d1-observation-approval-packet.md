# Production D1 Observation Approval Packet

## Purpose and scope

This packet is a docs-only approval template for a future human-approved production D1 lazy migration observation run for `dooosp/b2b-lead-agent`.

This packet does not approve, execute, or claim any production action. It exists so a human can fill the required approvals, owners, policies, and evidence fields before any production deploy, production D1 access, lazy DDL, production write, or observation claim.

Source facts in this packet are constrained to the current worktree and these repo files: `AGENTS.md`, `HARDENING_PLAN.md`, `NEXT_SESSION_PROMPT.md`, `docs/exec-plans/d1-lazy-migration-observation-plan.md`, `docs/exec-plans/leadbrief-v1-contract.md`, `docs/exec-plans/internal-api-contract-freeze.md`, `worker/wrangler.toml`, `worker/index.js`, `.github/workflows/*`, `worker/db/schema.js`, `worker/schema.sql`, `worker/db/leads.js`, `worker/db/transform.js`, `worker/api/leads.js`, and `worker/lib/leadbrief-v1.js`.

For the auto-extracted readiness table only, this packet also cites read-only GitHub metadata captured during the extraction run: current default branch, current `master` SHA, current check runs for that SHA, repository metadata, and PR metadata for PR #25, PR #27, PR #29, and PR #30. GitHub metadata is a timestamped external fact and must be rechecked before any future deploy/observe run.

## Non-goals

- No deploy.
- No production DB access.
- No production write.
- No migration execution.
- No observation claim.
- No CRM expansion.
- No runtime code, schema file, test, package, workflow, generated report, or production data change.

## Auto-extracted readiness values

Auto-extraction run: `2026-05-05T13:09:50Z`.

This table separates machine-discovered facts from future human approvals. `CONFIRMED_FROM_REPO` and `CONFIRMED_FROM_GITHUB` mean only that Codex found the fact in repo files or GitHub metadata. They do not approve deploy, production D1 access, lazy DDL, production write, rollback, or production observation. `CANDIDATE_*` values are starting points for a future human operator. They must not be treated as approved values.

| Field | Extracted value | Classification | Source/evidence | Can Codex auto-fill? | Requires human confirmation? | Notes / HOLD rule |
| --- | --- | --- | --- | --- | --- | --- |
| `EXPECTED_MASTER_SHA` | `e1967e27b87e14b73bbf90fd1cb40d828d7a2f52` | `CONFIRMED_FROM_GITHUB` | GitHub `master` branch metadata and PR #30 merge metadata: https://github.com/dooosp/b2b-lead-agent/pull/30 | Yes, as current GitHub fact only | Yes, before using it as an approved deploy SHA | This is not `APPROVED_MASTER_SHA` for deploy. Future operator must re-check if `master` moves. |
| `CURRENT_CI_PROOF_FOR_EXPECTED_SHA` | GitHub Actions `CI / test` success and `Validate Naming / validate` success for `e1967e27b87e14b73bbf90fd1cb40d828d7a2f52`, completed `2026-05-05T12:51Z` | `CONFIRMED_FROM_GITHUB` | Check runs for current master SHA: `CI` run https://github.com/dooosp/b2b-lead-agent/actions/runs/25377408564 job `test`; `Validate Naming` run https://github.com/dooosp/b2b-lead-agent/actions/runs/25377408543 job `validate`; workflow definitions in `.github/workflows/ci.yml` and `.github/workflows/validate-naming.yml` | Yes, as current GitHub fact only | Re-check required before any future deploy/observe run | CI is not production evidence and does not prove production D1 observation. |
| `ALLOW_DEPLOY` | `UNAPPROVED / UNFILLED` | `MISSING_REQUIRES_HUMAN` | Required approvals table below | No | Yes | Must remain unfilled until a human provides approver, UTC timestamp, and approval record. |
| `ALLOW_PRODUCTION_DB_ACCESS` | `UNAPPROVED / UNFILLED` | `MISSING_REQUIRES_HUMAN` | Required approvals table below | No | Yes | Required before any production D1 command/query, Worker endpoint, or path that accesses production DB. |
| `ALLOW_PRODUCTION_DB_MIGRATION` | `UNAPPROVED / UNFILLED` | `MISSING_REQUIRES_HUMAN` | Required approvals table below | No | Yes | Required before any path expected to run lazy DDL through `ensureD1Schema()`. |
| `ALLOW_PRODUCTION_DB_WRITE` | `UNAPPROVED / UNFILLED` | `MISSING_REQUIRES_HUMAN` | Required approvals table below | No | Yes | Required before PATCH, self-service persistence, or read-looking cache-write paths. |
| `ALLOW_PRODUCTION_OBSERVATION_CLAIM` | `UNAPPROVED / UNFILLED` | `MISSING_REQUIRES_HUMAN` | Required approvals table below | No | Yes | Required before saying production D1 lazy migration was observed. |
| `WORKER_NAME` | `b2b-lead-trigger` | `CANDIDATE_FROM_CONFIG` | `worker/wrangler.toml:1` | Yes, as config inventory | Yes, before deploy targeting | Config inventory only; not deploy approval. |
| `PRODUCTION_DB_BINDING` | `DB` | `CANDIDATE_FROM_CONFIG` | `worker/wrangler.toml:22-25` | Yes, as config inventory | Yes, before production DB access | Binding existence is not production DB access approval or production observation. |
| `D1_DATABASE_NAME` | `b2b-leads-db` | `CANDIDATE_FROM_CONFIG` | `worker/wrangler.toml:22-25` | Yes, as config inventory | Yes, before production DB access | Database name is inventory only. |
| `D1_DATABASE_ID` | `8effbfab-bf05-4726-bb74-8d9b6c1cccfe` | `CANDIDATE_FROM_CONFIG` | `worker/wrangler.toml:22-25` | Yes, as config inventory | Yes, before production DB access | Database id is inventory only. |
| `DEPLOY_PATH_CANDIDATE` | Cloudflare Worker target from `worker/wrangler.toml`; Worker entrypoint `worker/index.js`; Worker origin variable `https://b2b-lead-trigger.jangho1383.workers.dev` | `CANDIDATE_FROM_CONFIG` | `worker/wrangler.toml:1-2`, `worker/wrangler.toml:9-11`, `worker/index.js` | Yes, as candidate inventory | Yes | No exact deploy command/path is approved. Candidate target must not be executed in this run. |
| `APPROVED_DEPLOY_PATH` | `[UNAPPROVED_DEPLOY_PATH_COMMAND]` | `MISSING_REQUIRES_HUMAN` | Existing deploy approval state below | No | Yes | HOLD until a human approves exact command/path and deploy owner. |
| `ROLLBACK_PATH_CANDIDATE` | No exact rollback command found; repo docs require rollback only through approved Worker rollback owner/process | `MISSING_REQUIRES_HUMAN` | `docs/exec-plans/d1-lazy-migration-observation-plan.md:214-222` | No | Yes | HOLD until rollback owner, command/process, and stop criteria are recorded. |
| `APPROVED_ROLLBACK_PATH` | `[UNAPPROVED_ROLLBACK_PLAN]` | `MISSING_REQUIRES_HUMAN` | Required policies table below | No | Yes | HOLD until rollback plan has owner/approver, UTC timestamp, and policy record. |
| `SCHEMA_PROOF_METHOD_CANDIDATE` | Production D1 schema proof for exact target columns; candidate query: `PRAGMA table_info(leads);` via approved Cloudflare/D1 read path with machine-readable transcript | `CANDIDATE_FROM_HISTORY` | `docs/exec-plans/d1-lazy-migration-observation-plan.md:89-97` | Yes, as candidate method | Yes | Requires deploy/lazy-DDL approvals, production DB owner, evidence policy, and transcript plan before use. |
| `APPROVED_SCHEMA_PROOF_METHOD` | `[UNFILLED]` | `MISSING_REQUIRES_HUMAN` | HOLD rules below require schema proof method and machine-readable transcript plan | No | Yes | HOLD until approved method and transcript plan are filled. |
| `SCHEMA_PROOF_ONLY_OBSERVATION_PATH` | Schema-only proof can show target production columns exist, but cannot prove row serialization or human-review write behavior | `CANDIDATE_FROM_HISTORY` | `docs/exec-plans/d1-lazy-migration-observation-plan.md:92-97`; schema-only evidence rules below | Yes, as candidate path | Yes | Must keep `observationLevel=schema_only`, `rowRoundtripProof.performed=false`, and no production-observed lazy migration claim. |
| `ROW_ROUNDTRIP_PATH_CANDIDATE` | Candidate paths: real `PATCH /api/leads/<lead-id>`, real approved `POST /api/analyze`, or `GET /api/leads`/`GET /api/history` only if cache-write risk is approved | `CANDIDATE_FROM_HISTORY` | `docs/exec-plans/d1-lazy-migration-observation-plan.md:62-66`; `worker/api/leads.js:9-36`, `worker/api/leads.js:42-69`, `worker/api/leads.js:75-83` | Yes, as candidate path | Yes | Requires explicit write approval and owner-approved real row/action. GET cache-write paths are not read-only proof. |
| `SAFE_PRODUCTION_PROFILE_OR_LEAD_SELECTION` | Config lists profile candidates `danfoss`, `ls-electric`, and `siemens`; no safe production profile, lead id, or no-row decision is approved | `MISSING_REQUIRES_HUMAN` | `worker/wrangler.toml:12`; required run coordination table below | No | Yes | HOLD until product/release owner selects a safe target or explicit no-row decision. |
| `SAFE_REAL_ROW_OR_ACTION_PATH_BEFORE_WRITE` | `[UNFILLED_OR_NO_WRITE]` | `MISSING_REQUIRES_HUMAN` | Required policies and row-roundtrip rules below | No | Yes | HOLD before any write if no real owner-approved row/action needing a real new human review decision exists. |
| `DEPLOY_OWNER` | Candidate only: GitHub repo owner/PR author/merger `dooosp` / Taeho Jang from PR #25, #27, #29, and #30 metadata | `CANDIDATE_FROM_HISTORY` | GitHub repo metadata plus PR URLs: https://github.com/dooosp/b2b-lead-agent/pull/25, https://github.com/dooosp/b2b-lead-agent/pull/27, https://github.com/dooosp/b2b-lead-agent/pull/29, https://github.com/dooosp/b2b-lead-agent/pull/30 | No | Yes | Candidate owner is not deploy approval and not a confirmed owner assignment. |
| `PRODUCTION_DB_OWNER` | No confirmed production D1 owner found; unsafe to infer Cloudflare/D1 ownership from GitHub admin or repo owner | `UNSAFE_TO_INFER` | GitHub metadata shows repo ownership/admin only; packet owner table remains `[UNFILLED]` | No | Yes | HOLD until production DB owner is explicitly documented. |
| `ROLLBACK_OWNER` | Candidate only: GitHub repo owner/PR author/merger `dooosp` / Taeho Jang from PR history | `CANDIDATE_FROM_HISTORY` | GitHub repo metadata plus PR URLs: https://github.com/dooosp/b2b-lead-agent/pull/25, https://github.com/dooosp/b2b-lead-agent/pull/27, https://github.com/dooosp/b2b-lead-agent/pull/29, https://github.com/dooosp/b2b-lead-agent/pull/30 | No | Yes | Candidate owner is not approved rollback owner or rollback plan. |
| `OBSERVATION_OWNER` | Candidate only: GitHub repo owner/PR author/merger `dooosp` / Taeho Jang from PR history | `CANDIDATE_FROM_HISTORY` | GitHub repo metadata plus PR URLs: https://github.com/dooosp/b2b-lead-agent/pull/25, https://github.com/dooosp/b2b-lead-agent/pull/27, https://github.com/dooosp/b2b-lead-agent/pull/29, https://github.com/dooosp/b2b-lead-agent/pull/30 | No | Yes | Candidate owner is not evidence owner or observation-claim approval. |
| `BACKUP_OR_EXPORT_POLICY` | `UNAPPROVED / UNFILLED` | `MISSING_REQUIRES_HUMAN` | Required policies table below; risk register in observation plan | No | Yes | HOLD_NEEDS_PROD_DB_BACKUP_POLICY until policy or explicit hold decision is recorded. |
| `EVIDENCE_STORAGE_REDACTION_POLICY` | Redaction constraints are documented, but approved release-record location, access controls, sanitized/restricted evidence locations, and policy record are unfilled | `MISSING_REQUIRES_HUMAN` | Required policies table below; evidence template below | No | Yes | HOLD until evidence storage policy has owner/approver, timestamp, policy record, and redaction/access controls. |
| `CRM_CONTRACT_FREEZE_CONFIRMATION` | Repo docs confirm `crm.published-report.v1` remains backward-compatible and excludes LeadBrief fields unless separately scoped; policy approval record is still unfilled | `CONFIRMED_FROM_REPO` | `docs/exec-plans/internal-api-contract-freeze.md:42-48`; `docs/exec-plans/leadbrief-v1-contract.md:87` | Yes, as repo fact only | Yes, for policy approval | Repo fact does not satisfy the required human policy confirmation record. |
| `HUMAN_REVIEW_OVERWRITE_RISK_CHECK` | Repo code preserves existing `review_status` on managed/self-service upsert conflict and PATCH updates `review_status` separately from pipeline `status`; row-specific no-overwrite/no-toggle check is still unfilled | `CONFIRMED_FROM_REPO` | `worker/db/leads.js:11-23`, `worker/db/leads.js:100-113`, `worker/db/leads.js:153-185`; `docs/exec-plans/leadbrief-v1-contract.md:71-75` | Yes, as repo behavior evidence | Yes, before any selected row write | Code evidence does not approve a real row/action. HOLD if PATCH would overwrite a human decision or toggle only for evidence. |
| `TARGET_COLUMNS` | Primary: `generation_mode`, `verification_status`, `data_gaps`, `review_status`; adjacent row-proof: `evidence`, `confidence`, `confidence_reason`, `assumptions`, `event_type` | `CONFIRMED_FROM_REPO` | `docs/exec-plans/d1-lazy-migration-observation-plan.md:20-32`; `worker/db/schema.js:88-113`; `worker/db/transform.js:287-294`, `worker/db/transform.js:378-385` | Yes | No for repo fact; yes before production observation scope is approved | Target column list is not production schema proof. |
| `ENSURE_D1_SCHEMA_PATH` | `ensureD1Schema(db)` in `worker/db/schema.js`; invoked by D1 helpers including `saveLeadsBatch()`, `getLeadsByProfile()`, `getAllLeads()`, `getLeadById()`, and `updateLeadPatchAtomic()` | `CONFIRMED_FROM_REPO` | `worker/db/schema.js:3-162`; `worker/db/leads.js:1-7`, `worker/db/leads.js:32-60`, `worker/db/leads.js:153-185` | Yes | No for repo fact; yes before invoking in production | Any production path expected to run this requires `ALLOW_PRODUCTION_DB_MIGRATION=yes`. |
| `UNSAFE_PATHS_TO_AVOID` | Deploy, production DB access, lazy DDL, production write, read-looking GET cache writes, PATCH review toggles, synthetic/fake evidence, unredacted evidence, CI/docs as production evidence, and production-observed claim without approved row proof | `CONFIRMED_FROM_REPO` | Non-goals above; invalid evidence list below; `docs/exec-plans/d1-lazy-migration-observation-plan.md:36-45`, `docs/exec-plans/d1-lazy-migration-observation-plan.md:128-138`, `docs/exec-plans/d1-lazy-migration-observation-plan.md:246-258` | Yes | Yes before any future operation | Any unsafe or ambiguous path remains HOLD. |

Hard rule: the five dangerous gates remain `UNAPPROVED / UNFILLED` here and must not be auto-filled by Codex:

- `ALLOW_DEPLOY`
- `ALLOW_PRODUCTION_DB_ACCESS`
- `ALLOW_PRODUCTION_DB_MIGRATION`
- `ALLOW_PRODUCTION_DB_WRITE`
- `ALLOW_PRODUCTION_OBSERVATION_CLAIM`

## Required approvals

All approval placeholders are intentionally unapproved. A future operator must fill them before action.

| Approval key | Required value before action | Approval record requirement | Current packet state | Blocks |
| --- | --- | --- | --- | --- |
| `ALLOW_DEPLOY` | exactly `yes` | Approver, UTC approval timestamp, and approval record link/id | `UNAPPROVED / UNFILLED` | Any production deploy |
| `ALLOW_PRODUCTION_DB_ACCESS` | exactly `yes` | Approver, UTC approval timestamp, and approval record link/id | `UNAPPROVED / UNFILLED` | Any production D1 command/query, Worker endpoint, or path that accesses production DB |
| `ALLOW_PRODUCTION_DB_MIGRATION` | exactly `yes` | Approver, UTC approval timestamp, and approval record link/id | `UNAPPROVED / UNFILLED` | Any path expected to run lazy DDL through `ensureD1Schema()` |
| `ALLOW_PRODUCTION_DB_WRITE` | exactly `yes` | Approver, UTC approval timestamp, and approval record link/id | `UNAPPROVED / UNFILLED` | Any production row write, cache write, self-service persistence, or PATCH |
| `ALLOW_PRODUCTION_OBSERVATION_CLAIM` | exactly `yes` | Approver, UTC approval timestamp, and approval record link/id | `UNAPPROVED / UNFILLED` | Any statement that production D1 lazy migration was observed |

## Required owners

| Owner key | Named owner | Current packet state | Responsibility |
| --- | --- | --- | --- |
| `DEPLOY_OWNER` | `[UNFILLED]` | `UNAPPROVED / UNFILLED` | Owns deploy decision, deploy execution, and deploy stop/go |
| `PRODUCTION_DB_OWNER` | `[UNFILLED]` | `UNAPPROVED / UNFILLED` | Owns production D1 access, lazy DDL approval, backup/export posture, and write approval |
| `ROLLBACK_OWNER` | `[UNFILLED]` | `UNAPPROVED / UNFILLED` | Owns rollback decision and rollback command/process |
| `OBSERVATION_OWNER` | `[UNFILLED]` | `UNAPPROVED / UNFILLED` | Owns evidence capture, observation window, and claim gating |

## Required policies

| Policy key | Required content | Policy record requirement | Current packet state |
| --- | --- | --- | --- |
| `BACKUP_OR_EXPORT_POLICY` | Production D1 backup/export policy, or explicit owner decision to hold | Owner/approver, UTC timestamp, and policy record link/id | `UNAPPROVED / UNFILLED` |
| `ROLLBACK_PLAN` | Approved Worker rollback owner, command/process, and stop criteria | Owner/approver, UTC timestamp, and policy record link/id | `UNAPPROVED / UNFILLED` |
| `CRM_CONTRACT_FREEZE_CONFIRMATION` | Confirmation that `crm.published-report.v1` remains backward-compatible and does not expose LeadBrief fields unless separately scoped | Owner/approver, UTC timestamp, and policy record link/id | `UNAPPROVED / UNFILLED` |
| `EVIDENCE_STORAGE_POLICY` | Release-record location, access controls, and redaction rules for production evidence; repo docs/PR artifacts and restricted evidence records may contain sanitized excerpts only, never secrets, tokens, auth headers, cookies, private URLs, customer payloads, or PII | Owner/approver, UTC timestamp, and policy record link/id | `UNAPPROVED / UNFILLED` |
| `SAFE_REAL_ROW_OR_ACTION_POLICY` | Owner-approved real lead/action where a real new human review decision is needed, or explicit `NO_WRITE`; no synthetic claim, no overwrite, and no review-state toggle solely to manufacture evidence | Owner/approver, UTC timestamp, and policy record link/id | `UNAPPROVED / UNFILLED` |

## Required run coordination

| Coordination field | Required content | Current packet state |
| --- | --- | --- |
| `OBSERVATION_WINDOW_START_UTC` | Approved production observation window start | `UNAPPROVED / UNFILLED` |
| `OBSERVATION_WINDOW_END_UTC` | Approved production observation window end | `UNAPPROVED / UNFILLED` |
| `OBSERVATION_COMMUNICATION_CHANNEL` | Approved release/incident channel for deploy, observe, rollback, and HOLD updates | `UNAPPROVED / UNFILLED` |
| `SAFE_PRODUCTION_PROFILE_OR_LEAD_SELECTION` | Safe production profile, lead id, or explicit no-row decision selected by the product/release owner | `UNAPPROVED / UNFILLED` |

## Deploy path candidate and approval state

Candidate deployment target from config only:

- Worker config file: `worker/wrangler.toml`
- Worker name: `b2b-lead-trigger`
- Worker entrypoint: `worker/index.js`
- Worker origin variable: `https://b2b-lead-trigger.jangho1383.workers.dev`

Unresolved deploy approval state:

- `ALLOW_DEPLOY`: `UNAPPROVED / UNFILLED`
- `DEPLOY_OWNER`: `[UNFILLED]`
- Exact deploy command/path: `[UNAPPROVED_DEPLOY_PATH_COMMAND]`
- Approved deploy commit SHA: `[UNAPPROVED_MASTER_SHA]`
- CI status for deploy SHA: `[UNVERIFIED / UNFILLED]`
- Rollback command/process: `[UNAPPROVED_ROLLBACK_PLAN]`

The listed workflows contain CI, report generation, and naming validation. They do not themselves approve or execute the production Worker deploy for this packet.

## Production DB binding inventory from config only

From `worker/wrangler.toml` only:

| Binding type | Binding | Name | Id | Current packet state |
| --- | --- | --- | --- | --- |
| D1 database | `DB` | `b2b-leads-db` | `8effbfab-bf05-4726-bb74-8d9b6c1cccfe` | Inventory only; no production access approved |
| KV namespace | `RATE_LIMIT` | `[not named in config]` | `a5a01a0961b34b888ef050ed03b1f4f7` | Inventory only; not part of this observation target |

## Exact target columns

The production observation target is limited to these `leads` columns. The first group is the primary PR #25/#27 lazy-migration target; the second group is adjacent row-serialization proof that may be inspected during a broader row read or row roundtrip.

Primary lazy-migration target columns:

| Column | Observation purpose |
| --- | --- |
| `generation_mode` | Generation path such as `llm`, `heuristic`, or `demo` |
| `verification_status` | Machine verification status such as `verified`, `needs_review`, `draft`, or `unverified` |
| `data_gaps` | Known data gaps or review gaps |
| `review_status` | LeadBrief v1 human review state |

Adjacent row-proof columns:

| Column | Observation purpose |
| --- | --- |
| `evidence` | Structured evidence list |
| `confidence` | LeadBrief confidence |
| `confidence_reason` | Confidence/trust rationale |
| `assumptions` | Explicit assumptions |
| `event_type` | Optional signal/event classification |

## `ensureD1Schema()` path from repo code

`ensureD1Schema(db)` is defined in `worker/db/schema.js`.

Schema behavior proved by the listed files:

- `worker/db/schema.js` creates `leads` if missing and attempts lazy `ALTER TABLE leads ADD COLUMN ...` for the target columns.
- `worker/schema.sql` includes the base `leads` table with `review_status`, `generation_mode`, `verification_status`, and `data_gaps`.
- `worker/db/leads.js` imports `ensureD1Schema()` and calls it before D1 read/write helpers, including `saveLeadsBatch()`, `getLeadsByProfile()`, `getAllLeads()`, `getLeadById()`, `updateLeadPatchAtomic()`, and related D1 helpers.
- `worker/api/leads.js` reaches those helpers through `fetchLeads()`, `fetchHistory()`, `handleUpdateLead()`, and `handleExportCSV()`.
- `worker/db/transform.js` maps the target row fields to and from LeadBrief/trust fields.
- `worker/lib/leadbrief-v1.js` freezes review statuses as `NEW`, `NEEDS_REVIEW`, `APPROVED`, `REJECTED`, and `DEFERRED`.

Important write-path note:

- Authenticated `GET /api/leads?profile=<managed-profile>` and `GET /api/history?profile=<managed-profile>` can read from D1, but if D1 has no rows they can fetch GitHub artifacts and call `saveLeadsBatch()`. Treat any endpoint path that can fall back to GitHub and call `saveLeadsBatch()` as a possible production write, and require `ALLOW_PRODUCTION_DB_WRITE=yes` before relying on it as an observation path.

## Schema-proof-only option

Schema proof only is the lowest-write option. It may prove that the target columns exist in production after an approved deploy and approved lazy-DDL/migration access, but it does not prove a production row roundtrip.

Required before schema proof only:

- `ALLOW_DEPLOY=yes`
- `ALLOW_PRODUCTION_DB_ACCESS=yes`
- `ALLOW_PRODUCTION_DB_MIGRATION=yes`
- `DEPLOY_OWNER` named
- `PRODUCTION_DB_OWNER` named
- `ROLLBACK_OWNER` named
- `OBSERVATION_OWNER` named
- `BACKUP_OR_EXPORT_POLICY` filled or explicit hold decision
- `ROLLBACK_PLAN` filled
- `CRM_CONTRACT_FREEZE_CONFIRMATION` filled
- `EVIDENCE_STORAGE_POLICY` filled
- Observation window start/end filled
- Observation communication channel filled
- Safe production profile/lead-id selection filled, or explicit no-row decision recorded

Allowed evidence shape:

- Production D1 schema proof for the exact target columns.
- Deployed Worker SHA and deployment id/version.
- Evidence storage location outside this planning doc with sanitized excerpts only in repo/PR artifacts and restricted evidence records.
- `observationLevel=schema_only`.
- No claim that row serialization or human review write behavior was production-observed.
- No claim that production D1 lazy migration was observed unless an approved real row roundtrip is also completed and `ALLOW_PRODUCTION_OBSERVATION_CLAIM=yes`.

Current packet state: `UNAPPROVED / UNFILLED`.

## Optional row-roundtrip option

Row roundtrip is optional and higher risk. It may prove that a real production row stores and reads the target trust/review fields after deployment, but only if an owner-approved real row/action exists.

Required before row roundtrip:

- Everything required for schema proof only.
- `ALLOW_PRODUCTION_DB_WRITE=yes`
- `SAFE_REAL_ROW_OR_ACTION_POLICY` filled.
- `SAFE_PRODUCTION_PROFILE_OR_LEAD_SELECTION` filled with a real owner-approved target.
- A real lead id or real approved self-service target selected by the product/release owner.
- A real human review decision if using `PATCH /api/leads/<lead-id>`.
- Proof that the selected row/action needs that real new human review decision, or an explicit `NO_WRITE` decision.
- A stop decision before any PATCH that would overwrite an existing human review decision or toggle `review_status` only to manufacture evidence.

Candidate paths only; not approved for execution until all gates are filled:

- Authenticated `PATCH /api/leads/<lead-id>` with a real review decision using one of `NEW`, `NEEDS_REVIEW`, `APPROVED`, `REJECTED`, or `DEFERRED`; it must not overwrite an existing human review decision or toggle `review_status` solely to manufacture evidence.
- Authenticated `POST /api/analyze` only for a real, approved self-service target.
- Authenticated `GET /api/leads?profile=<managed-profile>` or `GET /api/history?profile=<managed-profile>` only if the owner accepts possible D1 cache write behavior; these cache-write paths are not sufficient by themselves to prove human-review row roundtrip unless followed by approved row readback evidence.

Current packet state: `UNAPPROVED / UNFILLED`.

## Decision table

| Decision path | Required approvals | Required owner/policy state | Allowed result | Current packet state |
| --- | --- | --- | --- | --- |
| Schema proof only | `ALLOW_DEPLOY=yes`, `ALLOW_PRODUCTION_DB_ACCESS=yes`, `ALLOW_PRODUCTION_DB_MIGRATION=yes` | Owners, policies, observation window, communication channel, and safe profile/lead-id decision filled; no write approval required | May record production schema proof only; no row-roundtrip claim | `HOLD` until all required placeholders are filled |
| Row roundtrip | Schema proof approvals plus `ALLOW_PRODUCTION_DB_WRITE=yes` | Safe real row/action selected and evidence policy filled | May record schema proof plus real row proof with `observationLevel=row_roundtrip_confirmed` | `HOLD` until all required placeholders are filled |
| No write allowed | No `ALLOW_PRODUCTION_DB_WRITE` | Explicit no-write decision recorded | May proceed only with schema proof if other approvals exist; must not claim row roundtrip | `HOLD`; no row-roundtrip claim |
| No safe row available | `ALLOW_PRODUCTION_DB_WRITE` may be present, but safe real row/action is missing | `SAFE_REAL_ROW_OR_ACTION_POLICY` missing or says hold | Stop before row write; no row-roundtrip claim | `HOLD_NEEDS_SAFE_WRITE_PATH` |

## Evidence template

This is a template only. Empty placeholders are intentionally unapproved/unfilled.

```json
{
  "evidenceType": "production_d1_lazy_migration_evidence_packet",
  "environment": "production",
  "observationLevel": "[UNFILLED: schema_only | row_roundtrip_confirmed]",
  "timestampUtc": "[UNFILLED]",
  "repoSha": "[UNAPPROVED_MASTER_SHA]",
  "deployedWorkerSha": "[UNFILLED]",
  "deploymentIdOrVersion": "[UNFILLED]",
  "approvals": {
    "ALLOW_DEPLOY": {
      "value": "UNAPPROVED / UNFILLED",
      "approver": "[UNFILLED]",
      "approvedAtUtc": "[UNFILLED]",
      "approvalRecord": "[UNFILLED]"
    },
    "ALLOW_PRODUCTION_DB_ACCESS": {
      "value": "UNAPPROVED / UNFILLED",
      "approver": "[UNFILLED]",
      "approvedAtUtc": "[UNFILLED]",
      "approvalRecord": "[UNFILLED]"
    },
    "ALLOW_PRODUCTION_DB_MIGRATION": {
      "value": "UNAPPROVED / UNFILLED",
      "approver": "[UNFILLED]",
      "approvedAtUtc": "[UNFILLED]",
      "approvalRecord": "[UNFILLED]"
    },
    "ALLOW_PRODUCTION_DB_WRITE": {
      "value": "UNAPPROVED / UNFILLED",
      "approver": "[UNFILLED]",
      "approvedAtUtc": "[UNFILLED]",
      "approvalRecord": "[UNFILLED]"
    },
    "ALLOW_PRODUCTION_OBSERVATION_CLAIM": {
      "value": "UNAPPROVED / UNFILLED",
      "approver": "[UNFILLED]",
      "approvedAtUtc": "[UNFILLED]",
      "approvalRecord": "[UNFILLED]"
    }
  },
  "owners": {
    "DEPLOY_OWNER": "[UNFILLED]",
    "PRODUCTION_DB_OWNER": "[UNFILLED]",
    "ROLLBACK_OWNER": "[UNFILLED]",
    "OBSERVATION_OWNER": "[UNFILLED]"
  },
  "coordination": {
    "OBSERVATION_WINDOW_START_UTC": "[UNFILLED]",
    "OBSERVATION_WINDOW_END_UTC": "[UNFILLED]",
    "OBSERVATION_COMMUNICATION_CHANNEL": "[UNFILLED]",
    "SAFE_PRODUCTION_PROFILE_OR_LEAD_SELECTION": "[UNFILLED]"
  },
  "policies": {
    "BACKUP_OR_EXPORT_POLICY": {
      "value": "[UNFILLED]",
      "ownerOrApprover": "[UNFILLED]",
      "approvedAtUtc": "[UNFILLED]",
      "policyRecord": "[UNFILLED]"
    },
    "ROLLBACK_PLAN": {
      "value": "[UNFILLED]",
      "ownerOrApprover": "[UNFILLED]",
      "approvedAtUtc": "[UNFILLED]",
      "policyRecord": "[UNFILLED]"
    },
    "CRM_CONTRACT_FREEZE_CONFIRMATION": {
      "value": "[UNFILLED]",
      "ownerOrApprover": "[UNFILLED]",
      "approvedAtUtc": "[UNFILLED]",
      "policyRecord": "[UNFILLED]"
    },
    "EVIDENCE_STORAGE_POLICY": {
      "value": "[UNFILLED]",
      "ownerOrApprover": "[UNFILLED]",
      "approvedAtUtc": "[UNFILLED]",
      "policyRecord": "[UNFILLED]"
    },
    "SAFE_REAL_ROW_OR_ACTION_POLICY": {
      "value": "[UNFILLED_OR_NO_WRITE]",
      "ownerOrApprover": "[UNFILLED]",
      "approvedAtUtc": "[UNFILLED]",
      "policyRecord": "[UNFILLED]",
      "noOverwriteOrEvidenceToggleConfirmed": false
    }
  },
  "evidenceStorageAndRedaction": {
    "policy": "[UNFILLED]",
    "sanitizedEvidenceLocation": "[UNFILLED]",
    "restrictedEvidenceLocation": "[UNFILLED]",
    "redactionConfirmed": false,
    "forbiddenInAllEvidenceArtifacts": [
      "secrets",
      "tokens",
      "auth headers",
      "cookies",
      "private URLs",
      "customer payloads",
      "PII"
    ]
  },
  "schemaProof": {
    "performed": false,
    "commandOrEndpoint": "[UNFILLED]",
    "capturedAtUtc": "[UNFILLED]",
    "machineReadableTranscriptLocation": "[UNFILLED]",
    "screenshotSupplementOnly": true,
    "columnsObserved": [
      "generation_mode",
      "verification_status",
      "data_gaps",
      "review_status",
      "evidence",
      "confidence",
      "confidence_reason",
      "assumptions",
      "event_type"
    ],
    "sanitizedEvidenceLocation": "[UNFILLED]",
    "restrictedEvidenceLocation": "[UNFILLED]"
  },
  "rowRoundtripProof": {
    "performed": false,
    "leadIdOrAction": "[UNFILLED]",
    "endpointOrUiAction": "[UNFILLED]",
    "capturedAtUtc": "[UNFILLED]",
    "machineReadableTranscriptLocation": "[UNFILLED]",
    "screenshotSupplementOnly": true,
    "realHumanReviewDecisionNeeded": false,
    "noOverwriteOrEvidenceToggleConfirmed": false,
    "responseStatus": "[UNFILLED]",
    "reviewStatusBefore": "[UNFILLED]",
    "reviewStatusAfter": "[UNFILLED]",
    "pipelineStatusBefore": "[UNFILLED]",
    "pipelineStatusAfter": "[UNFILLED]",
    "trustFieldsObserved": {
      "generation_mode": "[UNFILLED]",
      "verification_status": "[UNFILLED]",
      "data_gaps": "[UNFILLED]",
      "evidence": "[UNFILLED]",
      "confidence": "[UNFILLED]",
      "confidence_reason": "[UNFILLED]",
      "assumptions": "[UNFILLED]",
      "event_type": "[UNFILLED]"
    },
    "sanitizedEvidenceLocation": "[UNFILLED]",
    "restrictedEvidenceLocation": "[UNFILLED]"
  },
  "statusVsReviewStatusSeparation": {
    "confirmed": false,
    "pipelineStatusField": "status",
    "humanReviewField": "review_status",
    "notes": "[UNFILLED]"
  },
  "crmContractCheck": {
    "confirmed": false,
    "contractVersion": "crm.published-report.v1",
    "leadBriefFieldsExcludedUnlessSeparatelyScoped": true,
    "notes": "[UNFILLED]"
  },
  "claimAllowed": false,
  "decision": "[UNFILLED]",
  "evidenceStorageLocation": "[UNFILLED]"
}
```

Schema-only evidence must keep `observationLevel=schema_only`, `rowRoundtripProof.performed=false`, and `claimAllowed=false`. It may support a limited statement that production schema proof was captured, but it must not be described as production-observed D1 lazy migration. A production-observed lazy migration claim requires `observationLevel=row_roundtrip_confirmed`, `rowRoundtripProof.performed=true`, an approved real row/action, all approval records, and `ALLOW_PRODUCTION_OBSERVATION_CLAIM=yes`.

Both schema proof and row roundtrip proof require a machine-readable production command/query/response transcript with UTC capture time and exact command, endpoint, or UI action. Screenshots are supplemental only and never sufficient as the sole proof, even when they include production deployment metadata.

## Invalid evidence list

These do not count as production-observed evidence:

- Local tests.
- CI.
- Docs.
- Fixtures.
- Generated markdown summaries.
- PR descriptions.
- Screenshots without production deployment metadata.
- Screenshots as the only proof, even with production metadata.
- Staging/local D1.
- Test database observations.
- Synthetic claims.
- Unredacted logs, request/response captures, or evidence artifacts containing secrets, tokens, auth headers, cookies, private URLs, customer payloads, or PII.

## HOLD conditions

Stop with HOLD if any required approval, approval record, owner, policy record, coordination field, redaction rule, machine-readable transcript, or evidence precondition is missing. The source-of-truth readiness decision values are:

| Decision value | Condition |
| --- | --- |
| `READY_TO_DEPLOY_OBSERVE` | All dangerous approval gates, approval records, owners, policies, coordination fields, approved SHA/current CI proof, deploy path, production DB binding, schema proof method, safe path, evidence/redaction preconditions, CRM freeze, and human-review overwrite check are present and unambiguous |
| `HOLD_NEEDS_DEPLOY_OWNER` | `DEPLOY_OWNER` is unnamed |
| `HOLD_NEEDS_PROD_DB_BACKUP_POLICY` | `BACKUP_OR_EXPORT_POLICY` is unknown or missing |
| `HOLD_NEEDS_SAFE_WRITE_PATH` | No real owner-approved row/action is available for row roundtrip proof |
| `HOLD_NEEDS_ROLLBACK_OWNER` | `ROLLBACK_OWNER` or rollback process is unnamed |

For missing approvals, missing approval records, missing noncanonical owner/policy/coordination fields, missing policy records, unresolved deploy path, missing schema proof, missing machine-readable transcript, unsafe evidence storage/redaction policy, or evidence containing secrets/tokens/PII, stop with `HOLD` and state the exact missing key or evidence item. Do not report a packet-local blocker label as a readiness decision.

Schema-proof-only or no-write paths may capture limited schema evidence if separately approved, but they must not be reported as `READY_TO_DEPLOY_OBSERVE` while production write approval or a safe write path is missing.

If `rowRoundtripProof.performed=false`, stop before any production-observed lazy migration claim even if schema proof exists.

If a proposed row roundtrip would overwrite an existing human review decision, toggle `review_status` only to manufacture evidence, or lacks a real new human review decision, stop with `HOLD_NEEDS_SAFE_WRITE_PATH`.

## Executable HOLD Rules For Future Prompt

The ready-to-paste future prompt below must be enforced as an all-gates checklist. A future operator must stop with `HOLD` before deploy, production DB access, lazy DDL, production write, row roundtrip, or observation claim if any of these are missing or unsafe:

- any required approval flag or approval record
- `DEPLOY_OWNER`
- `PRODUCTION_DB_OWNER`
- `ROLLBACK_OWNER`
- `OBSERVATION_OWNER`
- `BACKUP_OR_EXPORT_POLICY` and policy record
- `ROLLBACK_PLAN` and policy record
- `CRM_CONTRACT_FREEZE_CONFIRMATION` and policy record
- `EVIDENCE_STORAGE_POLICY` and policy record
- `SAFE_REAL_ROW_OR_ACTION_POLICY` and policy record before any write
- observation window start/end
- observation communication channel
- `SAFE_PRODUCTION_PROFILE_OR_LEAD_SELECTION`
- approved master SHA
- current CI proof for the approved SHA
- exact deploy command/path
- production DB binding confirmation from `worker/wrangler.toml`
- schema proof method and machine-readable transcript plan
- row roundtrip preconditions if write is allowed
- evidence storage/redaction preconditions
- confirmation that `crm.published-report.v1` will not expand
- confirmation that no human review decision can be overwritten or toggled only to manufacture evidence

Five approval flags alone are not enough for `READY_TO_DEPLOY_OBSERVE`.

## All-Gates Authorization Wording

Use this authorization rule for the future prompt:

Only if every approval flag is exactly `yes`, every approval has a traceable approval record, every owner is named, every required policy has a policy record, every coordination field is filled, the approved SHA and current CI proof are verified, deploy path and production DB binding are confirmed, safe row/action and evidence preconditions are satisfied, schema proof and row roundtrip requirements are separated, `crm.published-report.v1` remains frozen, and human review overwrite risk is ruled out may the operator proceed to the minimal approved deploy/observe action.

If any item in that all-gates rule is missing or ambiguous, stop with `HOLD` and state the exact missing key. If the missing item maps to a source-of-truth readiness value, use `HOLD_NEEDS_DEPLOY_OWNER`, `HOLD_NEEDS_PROD_DB_BACKUP_POLICY`, `HOLD_NEEDS_SAFE_WRITE_PATH`, or `HOLD_NEEDS_ROLLBACK_OWNER`; otherwise use `HOLD` with the exact missing key.

## Ready-to-paste future deploy/observe prompt

```text
You are Codex acting as a supervised production observation agent for dooosp/b2b-lead-agent.

Goal: perform a production deploy and observation run for D1 lazy trust/review columns only if every approval, approval record, owner, policy record, coordination field, SHA/CI check, deploy path, DB binding confirmation, safe path, evidence precondition, CRM freeze check, and human-review overwrite check below is explicitly present.

Repository and target:
- Repo: dooosp/b2b-lead-agent
- Approved master SHA: <UNAPPROVED_MASTER_SHA>
- Worker config: worker/wrangler.toml
- Worker name: b2b-lead-trigger
- D1 binding: DB
- D1 database name: b2b-leads-db
- D1 database id: 8effbfab-bf05-4726-bb74-8d9b6c1cccfe
- Evidence storage location: <UNFILLED_EVIDENCE_STORAGE_LOCATION>

Required approvals before action:
- ALLOW_DEPLOY=<UNAPPROVED yes/no>
- ALLOW_PRODUCTION_DB_ACCESS=<UNAPPROVED yes/no>
- ALLOW_PRODUCTION_DB_MIGRATION=<UNAPPROVED yes/no>
- ALLOW_PRODUCTION_DB_WRITE=<UNAPPROVED yes/no>
- ALLOW_PRODUCTION_OBSERVATION_CLAIM=<UNAPPROVED yes/no>
- Each approval must include approver, approvedAtUtc, and approvalRecord; inferred approvals or PR descriptions do not count.

Required owners:
- DEPLOY_OWNER=<UNFILLED>
- PRODUCTION_DB_OWNER=<UNFILLED>
- ROLLBACK_OWNER=<UNFILLED>
- OBSERVATION_OWNER=<UNFILLED>

Required policies:
- BACKUP_OR_EXPORT_POLICY=<UNFILLED>
- ROLLBACK_PLAN=<UNFILLED>
- CRM_CONTRACT_FREEZE_CONFIRMATION=<UNFILLED>
- EVIDENCE_STORAGE_POLICY=<UNFILLED; must include redaction/access controls and must forbid secrets, tokens, auth headers, cookies, private URLs, customer payloads, and PII in repo/PR artifacts and restricted evidence records>
- SAFE_REAL_ROW_OR_ACTION_POLICY=<UNFILLED_OR_NO_WRITE; must identify a real row/action needing a new human review decision, or NO_WRITE; must forbid overwriting human review decisions and review-status toggles solely to create evidence>
- Each policy must include ownerOrApprover, approvedAtUtc, and policyRecord.

Required run coordination:
- OBSERVATION_WINDOW_START_UTC=<UNFILLED>
- OBSERVATION_WINDOW_END_UTC=<UNFILLED>
- OBSERVATION_COMMUNICATION_CHANNEL=<UNFILLED>
- SAFE_PRODUCTION_PROFILE_OR_LEAD_SELECTION=<UNFILLED_OR_NO_ROW>

All-gates authorization:
- Five approval flags alone are not sufficient.
- Before any deploy, production DB access, lazy DDL, production write, row roundtrip, or observation claim, every approval flag, approval record, owner, policy record, coordination field, approved SHA, current CI proof, deploy path, production DB binding confirmation, schema proof method, evidence storage/redaction policy, safe row/action precondition, CRM freeze confirmation, and human-review overwrite check must be present and unambiguous.
- If any all-gates item is missing or ambiguous, stop with HOLD and state the exact missing key.

Start with repo preflight on current master:
- Prove repo root, repo identity, branch, HEAD SHA, default branch, upstream, dirty status, and origin/master.
- Fetch the approved SHA and stop with HOLD if HEAD is not exactly <UNAPPROVED_MASTER_SHA> before any deploy command.
- Confirm CI is green for <UNAPPROVED_MASTER_SHA>.
- Confirm the exact deploy command/path is approved before any deploy command.
- Confirm the production DB binding from worker/wrangler.toml before any production DB access or path expected to run ensureD1Schema().
- Read AGENTS.md, HARDENING_PLAN.md, NEXT_SESSION_PROMPT.md, docs/exec-plans/internal-api-contract-freeze.md, docs/exec-plans/leadbrief-v1-contract.md, docs/exec-plans/d1-lazy-migration-observation-plan.md, docs/exec-plans/production-d1-observation-approval-packet.md, worker/wrangler.toml, .github/workflows/*, worker/db/schema.js, worker/schema.sql, worker/db/leads.js, worker/db/transform.js, worker/api/leads.js, and worker/lib/leadbrief-v1.js.

Scope:
- Observe only these D1 leads columns: generation_mode, verification_status, data_gaps, review_status, evidence, confidence, confidence_reason, assumptions, event_type.
- Do not expand CRM, Review Inbox, dashboard, PPT, proposal, CPA, roleplay, RBAC, comments, assignment, or notifications.
- Do not use fake customer data unless separately approved and labeled.
- Treat GET /api/leads?profile=<managed-profile> and GET /api/history?profile=<managed-profile> as possible production writes because they can cache GitHub artifacts into D1 when D1 has no rows.

Execution rules:
- If HEAD is not exactly <UNAPPROVED_MASTER_SHA>, stop with HOLD and state HEAD_MISMATCH before any deploy command.
- If <UNAPPROVED_MASTER_SHA> is unfilled or ambiguous, stop with HOLD and state missing APPROVED_MASTER_SHA.
- If current CI proof for <UNAPPROVED_MASTER_SHA> is missing, stale, failing, or ambiguous, stop with HOLD and state missing CI_PROOF_FOR_APPROVED_SHA.
- If the exact deploy command/path is missing or unapproved, stop with HOLD and state missing DEPLOY_PATH.
- If production DB binding confirmation from worker/wrangler.toml is missing or ambiguous, stop with HOLD and state missing PRODUCTION_DB_BINDING_CONFIRMATION.
- If ALLOW_DEPLOY is not exactly yes, stop with HOLD and state missing ALLOW_DEPLOY.
- If ALLOW_DEPLOY lacks approver, approvedAtUtc, or approvalRecord, stop with HOLD and state missing ALLOW_DEPLOY approval record.
- If ALLOW_PRODUCTION_DB_ACCESS is not exactly yes, do not run any production D1 command/query, Worker endpoint, or path that accesses production DB; stop with HOLD and state missing ALLOW_PRODUCTION_DB_ACCESS.
- If ALLOW_PRODUCTION_DB_ACCESS lacks approver, approvedAtUtc, or approvalRecord, stop with HOLD and state missing ALLOW_PRODUCTION_DB_ACCESS approval record.
- If ALLOW_PRODUCTION_DB_MIGRATION is not exactly yes, do not invoke a path expected to run ensureD1Schema(); stop with HOLD and state missing ALLOW_PRODUCTION_DB_MIGRATION.
- If ALLOW_PRODUCTION_DB_MIGRATION lacks approver, approvedAtUtc, or approvalRecord, stop with HOLD and state missing ALLOW_PRODUCTION_DB_MIGRATION approval record.
- If ALLOW_PRODUCTION_DB_WRITE is not exactly yes, do not perform PATCH, self-service analyze persistence, GET /api/leads cache-write observation, or GET /api/history cache-write observation; schema proof only may proceed if separately approved.
- If a row write is requested and ALLOW_PRODUCTION_DB_WRITE lacks approver, approvedAtUtc, or approvalRecord, stop with HOLD and state missing ALLOW_PRODUCTION_DB_WRITE approval record.
- If DEPLOY_OWNER is missing, stop with HOLD_NEEDS_DEPLOY_OWNER.
- If PRODUCTION_DB_OWNER is missing, stop with HOLD and state missing PRODUCTION_DB_OWNER.
- If ROLLBACK_OWNER is missing, stop with HOLD_NEEDS_ROLLBACK_OWNER.
- If OBSERVATION_OWNER is missing, stop with HOLD and state missing OBSERVATION_OWNER.
- If BACKUP_OR_EXPORT_POLICY or its ownerOrApprover, approvedAtUtc, or policyRecord is missing, stop with HOLD_NEEDS_PROD_DB_BACKUP_POLICY.
- If ROLLBACK_PLAN or its ownerOrApprover, approvedAtUtc, or policyRecord is missing, stop with HOLD_NEEDS_ROLLBACK_OWNER.
- If CRM_CONTRACT_FREEZE_CONFIRMATION or its ownerOrApprover, approvedAtUtc, or policyRecord is missing, stop with HOLD and state missing CRM_CONTRACT_FREEZE_CONFIRMATION.
- If CRM_CONTRACT_FREEZE_CONFIRMATION indicates crm.published-report.v1 might expand, stop with HOLD and state CRM_CONTRACT_EXPANSION_RISK.
- If EVIDENCE_STORAGE_POLICY or its ownerOrApprover, approvedAtUtc, or policyRecord is missing, stop with HOLD and state missing EVIDENCE_STORAGE_POLICY.
- If evidence storage does not include redaction/access controls, or if evidence would place secrets, tokens, auth headers, cookies, private URLs, customer payloads, or PII in repo/PR artifacts or restricted evidence records, stop with HOLD and state EVIDENCE_STORAGE_POLICY.
- If OBSERVATION_WINDOW_START_UTC, OBSERVATION_WINDOW_END_UTC, or OBSERVATION_COMMUNICATION_CHANNEL is missing, stop with HOLD and state the exact missing coordination key.
- If SAFE_PRODUCTION_PROFILE_OR_LEAD_SELECTION is missing, stop with HOLD and state missing SAFE_PRODUCTION_PROFILE_OR_LEAD_SELECTION.
- If schema proof method or machine-readable transcript plan is missing, stop with HOLD and state missing SCHEMA_PROOF_METHOD.
- If no real owner-approved row/action is available, stop with HOLD_NEEDS_SAFE_WRITE_PATH before row roundtrip.
- If SAFE_REAL_ROW_OR_ACTION_POLICY or its ownerOrApprover, approvedAtUtc, or policyRecord is missing before a write, stop with HOLD_NEEDS_SAFE_WRITE_PATH.
- If a PATCH would overwrite an existing human review decision, toggle review_status only to manufacture evidence, or lacks a real new human review decision, stop with HOLD_NEEDS_SAFE_WRITE_PATH before row roundtrip.
- If machine-readable production command/query/response transcript evidence cannot be captured, stop with HOLD and state missing MACHINE_READABLE_TRANSCRIPT.
- If rowRoundtripProof.performed is false, do not state that production D1 lazy migration was observed; record schema_only at most and stop before any observation claim.
- If ALLOW_PRODUCTION_OBSERVATION_CLAIM is not exactly yes, do not state that production D1 lazy migration was observed; stop with HOLD and state missing ALLOW_PRODUCTION_OBSERVATION_CLAIM before any observation claim.
- If ALLOW_PRODUCTION_OBSERVATION_CLAIM lacks approver, approvedAtUtc, or approvalRecord, stop with HOLD and state missing ALLOW_PRODUCTION_OBSERVATION_CLAIM approval record.

If and only if every all-gates item above is present and unambiguous, deploy only <UNAPPROVED_MASTER_SHA>, run the minimal approved observation path, capture evidence using the packet template, preserve status vs review_status separation, confirm crm.published-report.v1 remains frozen, and report READY_TO_DEPLOY_OBSERVE, a source-of-truth HOLD_* value, or HOLD with the exact missing key.
```
