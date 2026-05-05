# Production D1 Observation Human Confirmation Intake

## Purpose

This packet converts candidate readiness values from `docs/exec-plans/production-d1-observation-approval-packet.md` into explicit human decisions.

It is a human-fillable intake form only.

- This is not a deploy prompt.
- This is not production DB access approval.
- This is not production DB migration approval.
- This is not production DB write approval.
- This is not production observation evidence.
- This does not claim production D1 lazy migration has been observed.

The source approval packet includes auto-extracted values from repo files and timestamped GitHub metadata. Those values are candidates only. A candidate value is not approval, a GitHub owner or admin is not automatically a production DB owner, CI is not production evidence, D1 config is not production evidence or production observation, and docs are not production evidence.

## Source Context

Read this intake with these source-of-truth files:

- `AGENTS.md`
- `HARDENING_PLAN.md`
- `NEXT_SESSION_PROMPT.md`
- `docs/exec-plans/production-d1-observation-approval-packet.md`
- `docs/exec-plans/d1-lazy-migration-observation-plan.md`
- `docs/exec-plans/leadbrief-v1-contract.md`
- `docs/exec-plans/internal-api-contract-freeze.md`
- `worker/wrangler.toml`
- `.github/workflows/ci.yml`
- `.github/workflows/validate-naming.yml`
- `.github/workflows/generate-report.yml`

The approval packet's auto-extraction run was recorded as `2026-05-05T13:09:50Z`. Its `EXPECTED_MASTER_SHA` candidate was `e1967e27b87e14b73bbf90fd1cb40d828d7a2f52`. This intake was created after PR #31 landed on `origin/master` at `c9e55a81e2b27a06228d54b24a48937c66410ccd`. Both values remain candidate or repo-state facts only; neither is an approved deploy SHA.

## Decision Status Legend

Use exactly one status for every fillable field.

| Status | Meaning |
| --- | --- |
| `CONFIRM` | Human confirms the candidate value as approved for the later scoped run. |
| `REPLACE` | Human rejects the candidate value and provides an approved replacement. |
| `REJECT` | Human rejects the candidate value and does not provide a replacement. |
| `HOLD` | Human cannot decide yet, the field is ambiguous, or the value requires a separate owner/policy record. |

If any field is ambiguous, return `HOLD`.

## Dangerous Gates

These dangerous gates default to `no`. Do not change any gate to `yes` unless the human approval record below explicitly does so.

```text
ALLOW_DEPLOY = no
ALLOW_PRODUCTION_DB_ACCESS = no
ALLOW_PRODUCTION_DB_MIGRATION = no
ALLOW_PRODUCTION_DB_WRITE = no
ALLOW_PRODUCTION_OBSERVATION_CLAIM = no
```

Special gate rule: for dangerous gates, `CONFIRM` means the human confirms the current gate value remains `no`. It does not approve deploy, production DB access, migration, write, or observation claim. To set any dangerous gate to `yes`, the human must choose `REPLACE`, set the approved gate value to exactly `yes`, and provide approver, UTC timestamp, and approval record.

| Gate | Default | Human decision | Approved gate value | Approver | Approved at UTC | Approval record | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `ALLOW_DEPLOY` | `no` | `[CONFIRM/REPLACE/REJECT/HOLD]` | `[no unless REPLACE_TO_YES_WITH_RECORD]` | `[UNFILLED]` | `[UNFILLED]` | `[UNFILLED]` | Blocks any production deploy. |
| `ALLOW_PRODUCTION_DB_ACCESS` | `no` | `[CONFIRM/REPLACE/REJECT/HOLD]` | `[no unless REPLACE_TO_YES_WITH_RECORD]` | `[UNFILLED]` | `[UNFILLED]` | `[UNFILLED]` | Blocks any production D1 command, query, Worker endpoint, or path that accesses production DB. |
| `ALLOW_PRODUCTION_DB_MIGRATION` | `no` | `[CONFIRM/REPLACE/REJECT/HOLD]` | `[no unless REPLACE_TO_YES_WITH_RECORD]` | `[UNFILLED]` | `[UNFILLED]` | `[UNFILLED]` | Blocks any path expected to run lazy DDL through `ensureD1Schema()`. |
| `ALLOW_PRODUCTION_DB_WRITE` | `no` | `[CONFIRM/REPLACE/REJECT/HOLD]` | `[no unless REPLACE_TO_YES_WITH_RECORD]` | `[UNFILLED]` | `[UNFILLED]` | `[UNFILLED]` | Blocks any PATCH, self-service persistence, cache write, or row write. |
| `ALLOW_PRODUCTION_OBSERVATION_CLAIM` | `no` | `[CONFIRM/REPLACE/REJECT/HOLD]` | `[no unless REPLACE_TO_YES_WITH_RECORD]` | `[UNFILLED]` | `[UNFILLED]` | `[UNFILLED]` | Blocks any statement that production D1 lazy migration was observed. |

Five `yes` gate values are not enough by themselves. A future run must also have every owner, policy, coordination field, approved SHA, current CI proof, deploy path, production DB binding confirmation, schema proof method, evidence policy, safe row/action decision, CRM freeze confirmation, and human-review overwrite-risk check.

## Owner Confirmation

The human release owner must confirm, replace, reject, or hold every owner assignment.

| Owner key | Candidate from approval packet | Human decision | Approved owner | Approval record | HOLD rule |
| --- | --- | --- | --- | --- | --- |
| `DEPLOY_OWNER` | Candidate only: GitHub repo owner, PR author, or merger `dooosp` / Taeho Jang from PR #25, #27, #29, and #30 metadata. | `[CONFIRM/REPLACE/REJECT/HOLD]` | `[UNFILLED]` | `[UNFILLED]` | HOLD if deploy authority is inferred only from GitHub metadata. |
| `PRODUCTION_DB_OWNER` | No confirmed production D1 owner found; unsafe to infer Cloudflare/D1 ownership from GitHub admin or repo owner. | `[CONFIRM/REPLACE/REJECT/HOLD]` | `[UNFILLED]` | `[UNFILLED]` | HOLD until the production DB owner is explicitly documented. |
| `ROLLBACK_OWNER` | Candidate only: GitHub repo owner, PR author, or merger `dooosp` / Taeho Jang from PR history. | `[CONFIRM/REPLACE/REJECT/HOLD]` | `[UNFILLED]` | `[UNFILLED]` | HOLD until rollback owner and rollback process are approved. |
| `OBSERVATION_OWNER` | Candidate only: GitHub repo owner, PR author, or merger `dooosp` / Taeho Jang from PR history. | `[CONFIRM/REPLACE/REJECT/HOLD]` | `[UNFILLED]` | `[UNFILLED]` | HOLD until evidence owner and claim-gating owner are approved. |

Do not auto-confirm any owner. Do not treat GitHub ownership, PR authorship, repository admin status, or merge rights as production deploy, rollback, DB, or observation ownership.

## Config Candidate Confirmation

These values are inventory from repo/config/history. They are not approved deploy, DB access, migration, write, or observation values until a human records `CONFIRM` or `REPLACE` with an approval record.

| Field | Candidate value | Source | Human decision | Approved value | Approval record | HOLD rule |
| --- | --- | --- | --- | --- | --- | --- |
| `WORKER_NAME` | `b2b-lead-trigger` | `worker/wrangler.toml` | `[CONFIRM/REPLACE/REJECT/HOLD]` | `[UNFILLED]` | `[UNFILLED]` | HOLD if worker target is ambiguous. |
| `D1_BINDING` | `DB` | `worker/wrangler.toml` | `[CONFIRM/REPLACE/REJECT/HOLD]` | `[UNFILLED]` | `[UNFILLED]` | HOLD if binding is treated as DB access approval. |
| `D1_DATABASE_NAME` | `b2b-leads-db` | `worker/wrangler.toml` | `[CONFIRM/REPLACE/REJECT/HOLD]` | `[UNFILLED]` | `[UNFILLED]` | HOLD if database name is not confirmed by the production DB owner. |
| `D1_DATABASE_ID` | `8effbfab-bf05-4726-bb74-8d9b6c1cccfe` | `worker/wrangler.toml` | `[CONFIRM/REPLACE/REJECT/HOLD]` | `[UNFILLED]` | `[UNFILLED]` | HOLD if database id is not confirmed by the production DB owner. |
| `DEPLOY_PATH` | Candidate target only: Cloudflare Worker config in `worker/wrangler.toml`, Worker entrypoint `worker/index.js`, Worker origin variable `https://b2b-lead-trigger.jangho1383.workers.dev`; no exact deploy command is approved. | approval packet | `[CONFIRM/REPLACE/REJECT/HOLD]` | `[UNFILLED_EXACT_COMMAND_OR_PATH]` | `[UNFILLED]` | HOLD until exact deploy command/path and deploy owner approval are recorded. |
| `ROLLBACK_PATH` | No exact rollback command found; source docs require rollback through approved Worker rollback owner/process. | approval packet and observation plan | `[CONFIRM/REPLACE/REJECT/HOLD]` | `[UNFILLED_EXACT_COMMAND_OR_PROCESS]` | `[UNFILLED]` | HOLD until rollback owner, process, command if any, and stop criteria are recorded. |
| `SCHEMA_PROOF_METHOD` | Candidate query: `PRAGMA table_info(leads);` through an approved Cloudflare/D1 read path with a machine-readable transcript. | observation plan | `[CONFIRM/REPLACE/REJECT/HOLD]` | `[UNFILLED]` | `[UNFILLED]` | HOLD until production DB owner, DB access, lazy-DDL/migration approval, and evidence transcript plan are filled. |

Config values prove inventory only. D1 config is not production observation, and a deploy path candidate is not an approved deploy path.

## Auto-Extraction Candidate Coverage

This section ensures every relevant value from the approval packet's auto-extracted readiness table has an intake decision.

| Extracted field | Candidate or current state | Required human action |
| --- | --- | --- |
| `EXPECTED_MASTER_SHA` | Candidate from approval packet: `e1967e27b87e14b73bbf90fd1cb40d828d7a2f52`; current PR #31 baseline observed for this intake: `c9e55a81e2b27a06228d54b24a48937c66410ccd`. | Confirm or replace the exact approved deploy SHA in a future run; re-check current `origin/master` and CI before action. |
| `CURRENT_CI_PROOF_FOR_EXPECTED_SHA` | Candidate GitHub Actions proof for the old expected SHA: `CI / test` success and `Validate Naming / validate` success completed `2026-05-05T12:51Z`. | Re-check CI for the human-approved SHA. CI is not production evidence. |
| `APPROVED_DEPLOY_PATH` | `[UNAPPROVED_DEPLOY_PATH_COMMAND]`. | Fill only with explicit human approval, otherwise HOLD. |
| `APPROVED_ROLLBACK_PATH` | `[UNAPPROVED_ROLLBACK_PLAN]`. | Fill only with explicit rollback owner/process approval, otherwise HOLD. |
| `APPROVED_SCHEMA_PROOF_METHOD` | `[UNFILLED]`. | Fill only with explicit method and transcript plan approval, otherwise HOLD. |
| `SCHEMA_PROOF_ONLY_OBSERVATION_PATH` | Candidate only; schema proof can show target production columns exist but cannot prove row serialization or human-review write behavior. | Choose schema-only only if separately approved; keep row roundtrip unclaimed. |
| `ROW_ROUNDTRIP_PATH_CANDIDATE` | Candidate paths: real `PATCH /api/leads/<lead-id>`, real approved `POST /api/analyze`, or `GET /api/leads` / `GET /api/history` only if cache-write risk is approved. | Choose only with write approval and a real owner-approved row/action; otherwise HOLD or no-write. |
| `SAFE_PRODUCTION_PROFILE_OR_LEAD_SELECTION` | Profile candidates in config: `danfoss`, `ls-electric`, `siemens`; no safe production profile, lead id, or no-row decision is approved. | Product/release owner must confirm safe profile, lead id, or no-row decision. |
| `SAFE_REAL_ROW_OR_ACTION_PATH_BEFORE_WRITE` | `[UNFILLED_OR_NO_WRITE]`. | Fill only with a real business/review action or explicit no-write decision. |
| `TARGET_COLUMNS` | Primary: `generation_mode`, `verification_status`, `data_gaps`, `review_status`; adjacent row-proof: `evidence`, `confidence`, `confidence_reason`, `assumptions`, `event_type`. | Confirm observation scope; target columns are not production schema proof. |
| `ENSURE_D1_SCHEMA_PATH` | `ensureD1Schema(db)` in `worker/db/schema.js`; invoked by D1 helpers in `worker/db/leads.js`. | Confirm before invoking in production; any production path expected to run it requires migration/lazy-DDL approval. |
| `UNSAFE_PATHS_TO_AVOID` | Deploy, production DB access, lazy DDL, production write, read-looking cache writes, PATCH review toggles, synthetic evidence, unredacted evidence, CI/docs as production evidence, and production-observed claim without approved row proof. | Keep blocked unless all required approvals and evidence policies are filled; otherwise HOLD. |

## Policy Confirmation

Human must provide a policy record or choose `HOLD`. Repo facts can support the decision, but repo facts do not approve policy.

| Policy key | Required human content | Decision | Owner or approver | Approved at UTC | Policy record | HOLD rule |
| --- | --- | --- | --- | --- | --- | --- |
| `BACKUP_OR_EXPORT_POLICY` | Production D1 backup/export policy, or explicit owner decision to hold. | `[CONFIRM/REPLACE/REJECT/HOLD]` | `[UNFILLED]` | `[UNFILLED]` | `[UNFILLED]` | HOLD_NEEDS_PROD_DB_BACKUP_POLICY until policy or explicit hold decision is recorded. |
| `ROLLBACK_PLAN` | Approved Worker rollback owner, command/process, and stop criteria. | `[CONFIRM/REPLACE/REJECT/HOLD]` | `[UNFILLED]` | `[UNFILLED]` | `[UNFILLED]` | HOLD_NEEDS_ROLLBACK_OWNER until rollback plan is explicit. |
| `EVIDENCE_STORAGE_REDACTION_POLICY` | Release-record location, access controls, redaction rules, and forbidden evidence content. | `[CONFIRM/REPLACE/REJECT/HOLD]` | `[UNFILLED]` | `[UNFILLED]` | `[UNFILLED]` | HOLD if evidence could expose secrets, tokens, auth headers, cookies, private URLs, customer payloads, or PII. |
| `CRM_CONTRACT_FREEZE_CONFIRMATION` | Confirmation that `crm.published-report.v1` remains backward-compatible and does not expose LeadBrief fields unless separately scoped. | `[CONFIRM/REPLACE/REJECT/HOLD]` | `[UNFILLED]` | `[UNFILLED]` | `[UNFILLED]` | HOLD if CRM contract expansion is implied. |
| `SAFE_PRODUCTION_PROFILE_OR_LEAD_SELECTION` | Safe production profile, lead id, or explicit no-row decision selected by product/release owner. | `[CONFIRM/REPLACE/REJECT/HOLD]` | `[UNFILLED]` | `[UNFILLED]` | `[UNFILLED]` | HOLD until target or no-row decision is explicit. |
| `SAFE_REAL_ROW_OR_ACTION_POLICY` | Owner-approved real lead/action needing a real review decision, or explicit `NO_WRITE`; no synthetic action, overwrite, or evidence-only toggle. | `[CONFIRM/REPLACE/REJECT/HOLD]` | `[UNFILLED]` | `[UNFILLED]` | `[UNFILLED]` | HOLD_NEEDS_SAFE_WRITE_PATH before any write if this is missing or unsafe. |
| `HUMAN_REVIEW_OVERWRITE_RISK_CHECK` | Confirmation that no selected row/action overwrites a human decision or toggles `review_status` solely to manufacture evidence. | `[CONFIRM/REPLACE/REJECT/HOLD]` | `[UNFILLED]` | `[UNFILLED]` | `[UNFILLED]` | HOLD_NEEDS_SAFE_WRITE_PATH if overwrite or evidence-toggle risk exists. |

## Run Coordination Confirmation

Human must provide or hold the observation schedule and communication channel. These fields do not authorize deploy, DB access, migration, write, or observation claim.

| Coordination key | Required human content | Decision | Owner or approver | Approved at UTC | Record |
| --- | --- | --- | --- | --- | --- |
| `OBSERVATION_WINDOW_START_UTC` | Approved production observation window start. | `[CONFIRM/REPLACE/REJECT/HOLD]` | `[UNFILLED]` | `[UNFILLED]` | `[UNFILLED]` |
| `OBSERVATION_WINDOW_END_UTC` | Approved production observation window end. | `[CONFIRM/REPLACE/REJECT/HOLD]` | `[UNFILLED]` | `[UNFILLED]` | `[UNFILLED]` |
| `OBSERVATION_COMMUNICATION_CHANNEL` | Approved release/incident channel for deploy, observe, rollback, and HOLD updates. | `[CONFIRM/REPLACE/REJECT/HOLD]` | `[UNFILLED]` | `[UNFILLED]` | `[UNFILLED]` |

If any run coordination key is missing or ambiguous, return `HOLD` before any future deploy/observe run.

## Optional Write Or Row Roundtrip Choice

Human must choose exactly one row/action posture.

| Choice | Meaning | Fillable decision |
| --- | --- | --- |
| `NO_WRITE_SCHEMA_PROOF_ONLY` | No production DB write is allowed. A future run may only consider schema-proof-only evidence if all separate deploy, DB access, lazy-DDL, owner, policy, and evidence gates are approved. | `[SELECTED/NOT_SELECTED]` |
| `WRITE_ALLOWED_WITH_REAL_ROW` | A production write may be considered only if `ALLOW_PRODUCTION_DB_WRITE=yes` has a traceable approval record and the row/action is a real business or review action. | `[SELECTED/NOT_SELECTED]` |
| `HOLD_NO_SAFE_ROW` | No safe real row/action is available. Stop before row roundtrip and do not claim production observation. | `[SELECTED/NOT_SELECTED]` |

If `WRITE_ALLOWED_WITH_REAL_ROW` is selected, the human must fill all of these fields before any write:

| Required write field | Human-filled value |
| --- | --- |
| Exact real row/action | `[UNFILLED]` |
| Owner or approver | `[UNFILLED]` |
| Approved at UTC | `[UNFILLED]` |
| Policy or approval record | `[UNFILLED]` |
| Rollback/restoration plan | `[UNFILLED]` |
| Reason this is a real business/review action, not fake evidence | `[UNFILLED]` |
| Evidence redaction policy | `[UNFILLED]` |
| Review-status before value if known | `[UNFILLED]` |
| Review-status after value | `[UNFILLED]` |
| Pipeline `status` preservation check | `[UNFILLED]` |

Do not create synthetic evidence. Do not toggle `review_status` only to manufacture evidence. Do not overwrite existing human review decisions.

## Evidence Policy Choice

Human must choose one evidence storage path before any future production evidence capture.

| Evidence storage choice | Human decision | Location or policy record | Notes |
| --- | --- | --- | --- |
| `KEEP_LOCAL_ONLY` | `[SELECTED/NOT_SELECTED]` | `[UNFILLED]` | Local evidence must still be redacted and access-controlled. |
| `SECURE_RELEASE_RECORD` | `[SELECTED/NOT_SELECTED]` | `[UNFILLED]` | Preferred for restricted production evidence. |
| `REDACTED_REPO_ARTIFACT` | `[SELECTED/NOT_SELECTED]` | `[UNFILLED]` | Repo artifacts may contain sanitized excerpts only, never secrets or sensitive payloads. |
| `OTHER_APPROVED_PATH` | `[SELECTED/NOT_SELECTED]` | `[UNFILLED]` | Must include owner, access controls, redaction rules, and approval record. |

Machine-readable transcripts are required for future production evidence. Screenshots are supplemental only and are never sufficient as the sole proof.

## Machine-Readable Confirmation Block

The human owner can fill this YAML block. Default values intentionally block deploy, production DB access, production migration, production write, and production observation claim.

```yaml
confirmationPacket:
  packetType: "production_d1_observation_human_confirmation_intake"
  packetVersion: "1"
  repo: "dooosp/b2b-lead-agent"
  intakeDoc: "docs/exec-plans/production-d1-observation-human-confirmation-intake.md"
  sourceApprovalPacket: "docs/exec-plans/production-d1-observation-approval-packet.md"
  approver:
    name: "[UNFILLED]"
    role: "[UNFILLED]"
    approvedAtUtc: "[UNFILLED]"
    approvalRecord: "[UNFILLED]"
  approvalRecord:
    recordIdOrUrl: "[UNFILLED]"
    summary: "[UNFILLED]"
  candidateValuesAreApprovals: false
  githubOwnerIsProductionDbOwner: false
  docsAreProductionEvidence: false
  ciIsProductionEvidence: false
  d1ConfigIsProductionEvidence: false
  d1ConfigIsProductionObservation: false
  productionObservationClaimedByThisPacket: false
  dangerousGates:
    ALLOW_DEPLOY:
      value: "no"
      decision: "HOLD"
      approver: "[UNFILLED]"
      approvedAtUtc: "[UNFILLED]"
      approvalRecord: "[UNFILLED]"
    ALLOW_PRODUCTION_DB_ACCESS:
      value: "no"
      decision: "HOLD"
      approver: "[UNFILLED]"
      approvedAtUtc: "[UNFILLED]"
      approvalRecord: "[UNFILLED]"
    ALLOW_PRODUCTION_DB_MIGRATION:
      value: "no"
      decision: "HOLD"
      approver: "[UNFILLED]"
      approvedAtUtc: "[UNFILLED]"
      approvalRecord: "[UNFILLED]"
    ALLOW_PRODUCTION_DB_WRITE:
      value: "no"
      decision: "HOLD"
      approver: "[UNFILLED]"
      approvedAtUtc: "[UNFILLED]"
      approvalRecord: "[UNFILLED]"
    ALLOW_PRODUCTION_OBSERVATION_CLAIM:
      value: "no"
      decision: "HOLD"
      approver: "[UNFILLED]"
      approvedAtUtc: "[UNFILLED]"
      approvalRecord: "[UNFILLED]"
  owners:
    DEPLOY_OWNER:
      candidate: "dooosp / Taeho Jang from GitHub PR history only"
      decision: "HOLD"
      approvedOwner: "[UNFILLED]"
      approvalRecord: "[UNFILLED]"
    PRODUCTION_DB_OWNER:
      candidate: "UNSAFE_TO_INFER"
      decision: "HOLD"
      approvedOwner: "[UNFILLED]"
      approvalRecord: "[UNFILLED]"
    ROLLBACK_OWNER:
      candidate: "dooosp / Taeho Jang from GitHub PR history only"
      decision: "HOLD"
      approvedOwner: "[UNFILLED]"
      approvalRecord: "[UNFILLED]"
    OBSERVATION_OWNER:
      candidate: "dooosp / Taeho Jang from GitHub PR history only"
      decision: "HOLD"
      approvedOwner: "[UNFILLED]"
      approvalRecord: "[UNFILLED]"
  configValues:
    EXPECTED_MASTER_SHA:
      candidateFromApprovalPacket: "e1967e27b87e14b73bbf90fd1cb40d828d7a2f52"
      currentOriginMasterAtIntakeCreation: "c9e55a81e2b27a06228d54b24a48937c66410ccd"
      decision: "HOLD"
      approvedDeploySha: "[UNFILLED]"
      ciProofForApprovedSha: "[UNFILLED]"
      approvalRecord: "[UNFILLED]"
    WORKER_NAME:
      candidate: "b2b-lead-trigger"
      decision: "HOLD"
      approvedValue: "[UNFILLED]"
      approvalRecord: "[UNFILLED]"
    D1_BINDING:
      candidate: "DB"
      decision: "HOLD"
      approvedValue: "[UNFILLED]"
      approvalRecord: "[UNFILLED]"
    D1_DATABASE_NAME:
      candidate: "b2b-leads-db"
      decision: "HOLD"
      approvedValue: "[UNFILLED]"
      approvalRecord: "[UNFILLED]"
    D1_DATABASE_ID:
      candidate: "8effbfab-bf05-4726-bb74-8d9b6c1cccfe"
      decision: "HOLD"
      approvedValue: "[UNFILLED]"
      approvalRecord: "[UNFILLED]"
    DEPLOY_PATH:
      candidate: "Cloudflare Worker config/entrypoint/origin from worker/wrangler.toml and worker/index.js; no exact deploy command approved"
      decision: "HOLD"
      approvedExactCommandOrPath: "[UNFILLED]"
      approvalRecord: "[UNFILLED]"
    ROLLBACK_PATH:
      candidate: "No exact rollback command found; requires approved rollback owner/process"
      decision: "HOLD"
      approvedExactCommandOrProcess: "[UNFILLED]"
      approvalRecord: "[UNFILLED]"
    SCHEMA_PROOF_METHOD:
      candidate: "PRAGMA table_info(leads); through approved Cloudflare/D1 read path with machine-readable transcript"
      decision: "HOLD"
      approvedMethod: "[UNFILLED]"
      transcriptPlan: "[UNFILLED]"
      approvalRecord: "[UNFILLED]"
  policyConfirmations:
    BACKUP_OR_EXPORT_POLICY:
      decision: "HOLD"
      value: "[UNFILLED]"
      ownerOrApprover: "[UNFILLED]"
      approvedAtUtc: "[UNFILLED]"
      policyRecord: "[UNFILLED]"
    ROLLBACK_PLAN:
      decision: "HOLD"
      value: "[UNFILLED]"
      ownerOrApprover: "[UNFILLED]"
      approvedAtUtc: "[UNFILLED]"
      policyRecord: "[UNFILLED]"
    EVIDENCE_STORAGE_REDACTION_POLICY:
      decision: "HOLD"
      value: "[UNFILLED]"
      ownerOrApprover: "[UNFILLED]"
      approvedAtUtc: "[UNFILLED]"
      policyRecord: "[UNFILLED]"
      forbiddenInRepoOrEvidenceArtifacts:
        - "secrets"
        - "tokens"
        - "auth headers"
        - "cookies"
        - "private URLs"
        - "customer payloads"
        - "PII"
    CRM_CONTRACT_FREEZE_CONFIRMATION:
      decision: "HOLD"
      value: "[UNFILLED]"
      ownerOrApprover: "[UNFILLED]"
      approvedAtUtc: "[UNFILLED]"
      policyRecord: "[UNFILLED]"
      crmPublishedReportV1RemainsFrozen: false
    SAFE_PRODUCTION_PROFILE_OR_LEAD_SELECTION:
      decision: "HOLD"
      value: "[UNFILLED_OR_NO_ROW]"
      ownerOrApprover: "[UNFILLED]"
      approvedAtUtc: "[UNFILLED]"
      policyRecord: "[UNFILLED]"
    SAFE_REAL_ROW_OR_ACTION_POLICY:
      decision: "HOLD"
      value: "[UNFILLED_OR_NO_WRITE]"
      ownerOrApprover: "[UNFILLED]"
      approvedAtUtc: "[UNFILLED]"
      policyRecord: "[UNFILLED]"
      exactRealRowOrAction: "[UNFILLED]"
      realBusinessOrReviewReason: "[UNFILLED]"
      rollbackOrRestorationPlan: "[UNFILLED]"
      reviewStatusBeforeIfKnown: "[UNFILLED]"
      reviewStatusAfter: "[UNFILLED]"
      pipelineStatusPreservationCheck: "[UNFILLED]"
    HUMAN_REVIEW_OVERWRITE_RISK_CHECK:
      decision: "HOLD"
      value: "[UNFILLED]"
      ownerOrApprover: "[UNFILLED]"
      approvedAtUtc: "[UNFILLED]"
      policyRecord: "[UNFILLED]"
      noOverwriteConfirmed: false
      noEvidenceToggleConfirmed: false
  runCoordination:
    OBSERVATION_WINDOW_START_UTC:
      decision: "HOLD"
      value: "[UNFILLED]"
      ownerOrApprover: "[UNFILLED]"
      approvedAtUtc: "[UNFILLED]"
      record: "[UNFILLED]"
    OBSERVATION_WINDOW_END_UTC:
      decision: "HOLD"
      value: "[UNFILLED]"
      ownerOrApprover: "[UNFILLED]"
      approvedAtUtc: "[UNFILLED]"
      record: "[UNFILLED]"
    OBSERVATION_COMMUNICATION_CHANNEL:
      decision: "HOLD"
      value: "[UNFILLED]"
      ownerOrApprover: "[UNFILLED]"
      approvedAtUtc: "[UNFILLED]"
      record: "[UNFILLED]"
  safeRowActionChoice:
    selected: "HOLD_NO_SAFE_ROW"
    allowedChoices:
      - "NO_WRITE_SCHEMA_PROOF_ONLY"
      - "WRITE_ALLOWED_WITH_REAL_ROW"
      - "HOLD_NO_SAFE_ROW"
    exactRealRowOrAction: "[UNFILLED]"
    ownerOrApprover: "[UNFILLED]"
    approvedAtUtc: "[UNFILLED]"
    policyOrApprovalRecord: "[UNFILLED]"
    rollbackOrRestorationPlan: "[UNFILLED]"
    realBusinessOrReviewReason: "[UNFILLED]"
    evidenceRedactionPolicy: "[UNFILLED]"
    reviewStatusBeforeIfKnown: "[UNFILLED]"
    reviewStatusAfter: "[UNFILLED]"
    pipelineStatusPreservationCheck: "[UNFILLED]"
  evidenceStorageChoice:
    selected: "[UNFILLED]"
    allowedChoices:
      - "KEEP_LOCAL_ONLY"
      - "SECURE_RELEASE_RECORD"
      - "REDACTED_REPO_ARTIFACT"
      - "OTHER_APPROVED_PATH"
    locationOrRecord: "[UNFILLED]"
    redactionConfirmed: false
  observationScope:
    targetColumns:
      - "generation_mode"
      - "verification_status"
      - "data_gaps"
      - "review_status"
      - "evidence"
      - "confidence"
      - "confidence_reason"
      - "assumptions"
      - "event_type"
    schemaProofOnlyAllowedToClaimProductionObservation: false
    rowRoundtripRequiredForProductionObservationClaim: true
  explicitHoldFields:
    - "ALLOW_DEPLOY"
    - "ALLOW_PRODUCTION_DB_ACCESS"
    - "ALLOW_PRODUCTION_DB_MIGRATION"
    - "ALLOW_PRODUCTION_DB_WRITE"
    - "ALLOW_PRODUCTION_OBSERVATION_CLAIM"
    - "DEPLOY_OWNER"
    - "PRODUCTION_DB_OWNER"
    - "ROLLBACK_OWNER"
    - "OBSERVATION_OWNER"
    - "BACKUP_OR_EXPORT_POLICY"
    - "ROLLBACK_PLAN"
    - "EVIDENCE_STORAGE_REDACTION_POLICY"
    - "CRM_CONTRACT_FREEZE_CONFIRMATION"
    - "SAFE_PRODUCTION_PROFILE_OR_LEAD_SELECTION"
    - "SAFE_REAL_ROW_OR_ACTION_POLICY"
    - "HUMAN_REVIEW_OVERWRITE_RISK_CHECK"
    - "OBSERVATION_WINDOW_START_UTC"
    - "OBSERVATION_WINDOW_END_UTC"
    - "OBSERVATION_COMMUNICATION_CHANNEL"
    - "APPROVED_DEPLOY_SHA"
    - "CI_PROOF_FOR_APPROVED_SHA"
    - "DEPLOY_PATH"
    - "ROLLBACK_PATH"
    - "SCHEMA_PROOF_METHOD"
    - "SAFE_REAL_ROW_OR_ACTION_PATH_BEFORE_WRITE"
```

## HOLD Rules

- If any field is ambiguous, return `HOLD`.
- Candidate value is not approval.
- GitHub CI is not production evidence.
- D1 config is not production evidence and not production observation.
- Docs are not production evidence.
- GitHub owner, admin, PR author, or merger is not automatically the production DB owner.
- Deploy path candidate is not an approved deploy path.
- Schema proof only cannot claim row serialization or human-review write behavior.
- Production observation cannot be claimed from this packet alone.
- If `safeRowActionChoice` is not `WRITE_ALLOWED_WITH_REAL_ROW` with complete approved real row/action proof, do not state that production D1 lazy migration was observed.
- If a write would overwrite a human review decision or toggle `review_status` only to manufacture evidence, return `HOLD_NEEDS_SAFE_WRITE_PATH`.
- If the CRM contract freeze is uncertain or expanded, return `HOLD` with `CRM_CONTRACT_EXPANSION_RISK`.

## Ready-To-Paste Future Deploy/Observe Prompt

Paste this only after a human fills the machine-readable confirmation block above. Dangerous gates still default to `no` unless the filled block explicitly changes them to `yes` with approver, UTC timestamp, and approval record.

```text
You are Codex acting as a supervised production observation agent for dooosp/b2b-lead-agent.

Goal: consume the filled Human Confirmation Intake Packet block and perform no production action unless every required field is explicit, approved, current, and unambiguous.

Required input:
- Filled confirmation block from docs/exec-plans/production-d1-observation-human-confirmation-intake.md.
- Treat all dangerous gates as no unless the filled block explicitly sets them to yes with approver, approvedAtUtc, and approvalRecord.
- Treat candidate values as unapproved unless the filled block marks CONFIRM or REPLACE and includes the required owner/policy/approval record.

Start with repo preflight:
- Prove repo root, repo identity, branch, default branch, HEAD SHA, origin/master SHA, HEAD equals approved SHA yes/no, dirty status, and checkout safety.
- Fetch the approved SHA from the filled block and stop with HOLD if HEAD is not exactly that SHA before any deploy command.
- Confirm CI is current and green for the approved SHA. CI is not production evidence.
- Read AGENTS.md, HARDENING_PLAN.md, NEXT_SESSION_PROMPT.md, docs/exec-plans/internal-api-contract-freeze.md, docs/exec-plans/leadbrief-v1-contract.md, docs/exec-plans/d1-lazy-migration-observation-plan.md, docs/exec-plans/production-d1-observation-approval-packet.md, docs/exec-plans/production-d1-observation-human-confirmation-intake.md, worker/wrangler.toml, .github/workflows/ci.yml, .github/workflows/validate-naming.yml, .github/workflows/generate-report.yml, worker/db/schema.js, worker/schema.sql, worker/db/leads.js, worker/db/transform.js, worker/api/leads.js, and worker/lib/leadbrief-v1.js.

Before any action, enforce all gates:
- If ALLOW_DEPLOY is not exactly yes with approver, approvedAtUtc, and approvalRecord, do not deploy; stop with HOLD missing ALLOW_DEPLOY.
- If ALLOW_PRODUCTION_DB_ACCESS is not exactly yes with approver, approvedAtUtc, and approvalRecord, do not run any production D1 command, query, Worker endpoint, or path that accesses production DB; stop with HOLD missing ALLOW_PRODUCTION_DB_ACCESS.
- If ALLOW_PRODUCTION_DB_MIGRATION is not exactly yes with approver, approvedAtUtc, and approvalRecord, do not invoke any path expected to run ensureD1Schema(); stop with HOLD missing ALLOW_PRODUCTION_DB_MIGRATION.
- If ALLOW_PRODUCTION_DB_WRITE is not exactly yes with approver, approvedAtUtc, and approvalRecord, do not perform PATCH, self-service analyze persistence, GET /api/leads cache-write observation, GET /api/history cache-write observation, or any production row write.
- If ALLOW_PRODUCTION_OBSERVATION_CLAIM is not exactly yes with approver, approvedAtUtc, and approvalRecord, do not state that production D1 lazy migration was observed.
- If DEPLOY_OWNER, PRODUCTION_DB_OWNER, ROLLBACK_OWNER, or OBSERVATION_OWNER is missing or inferred only from GitHub metadata, stop with HOLD and state the exact missing owner.
- If BACKUP_OR_EXPORT_POLICY, ROLLBACK_PLAN, EVIDENCE_STORAGE_REDACTION_POLICY, CRM_CONTRACT_FREEZE_CONFIRMATION, SAFE_PRODUCTION_PROFILE_OR_LEAD_SELECTION, or HUMAN_REVIEW_OVERWRITE_RISK_CHECK is missing, ambiguous, or lacks a policy record, stop with HOLD and state the exact missing policy.
- If OBSERVATION_WINDOW_START_UTC, OBSERVATION_WINDOW_END_UTC, or OBSERVATION_COMMUNICATION_CHANNEL is missing, ambiguous, or lacks a record, stop with HOLD and state the exact missing coordination key.
- If WORKER_NAME, D1_BINDING, D1_DATABASE_NAME, D1_DATABASE_ID, DEPLOY_PATH, ROLLBACK_PATH, or SCHEMA_PROOF_METHOD is missing, ambiguous, or lacks an approval record, stop with HOLD and state the exact missing config key.
- If CRM_CONTRACT_FREEZE_CONFIRMATION does not keep crm.published-report.v1 frozen, stop with HOLD and state CRM_CONTRACT_EXPANSION_RISK.
- If evidence storage would place secrets, tokens, auth headers, cookies, private URLs, customer payloads, or PII in repo/PR artifacts or unrestricted records, stop with HOLD and state EVIDENCE_STORAGE_POLICY.
- If SCHEMA_PROOF_METHOD or its machine-readable transcript plan is missing, stop with HOLD missing SCHEMA_PROOF_METHOD.
- If safeRowActionChoice is HOLD_NO_SAFE_ROW, stop before any write and do not claim production observation.
- If safeRowActionChoice is NO_WRITE_SCHEMA_PROOF_ONLY, do not write and do not claim row roundtrip or production-observed lazy migration.
- If safeRowActionChoice is WRITE_ALLOWED_WITH_REAL_ROW, proceed only if SAFE_REAL_ROW_OR_ACTION_POLICY and the row/action fields include exact real row/action, ownerOrApprover, approvedAtUtc, policyOrApprovalRecord, rollback/restoration plan, real business/review reason, evidence redaction policy, reviewStatusBeforeIfKnown or an explicit unavailable reason, reviewStatusAfter, pipelineStatusPreservationCheck, and human-review overwrite-risk check.
- If a PATCH would overwrite an existing human review decision, toggle review_status only to manufacture evidence, or lacks a real new human review decision, stop with HOLD_NEEDS_SAFE_WRITE_PATH.

Scope:
- Observe only these D1 leads columns: generation_mode, verification_status, data_gaps, review_status, evidence, confidence, confidence_reason, assumptions, event_type.
- Do not expand CRM, Review Inbox, dashboard, PPT, proposal, CPA, roleplay, RBAC, comments, assignment, or notifications.
- Do not use fake customer data unless separately approved and labeled.
- Treat GET /api/leads?profile=<managed-profile> and GET /api/history?profile=<managed-profile> as possible production writes because they can cache GitHub artifacts into D1 when D1 has no rows.

If every all-gates item is present and unambiguous, perform only the minimal approved action from the filled block, capture machine-readable evidence using the approved evidence policy, preserve status vs review_status separation, keep crm.published-report.v1 frozen, and report READY_TO_DEPLOY_OBSERVE, a source-of-truth HOLD_* value, or HOLD with the exact missing key. Do not claim production D1 lazy migration was observed unless approved row roundtrip proof exists and ALLOW_PRODUCTION_OBSERVATION_CLAIM is exactly yes with a complete approval record.
```
