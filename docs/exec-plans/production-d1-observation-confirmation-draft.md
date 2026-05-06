# Production D1 Observation Confirmation Draft

## Header

- status: `DRAFT_NOT_APPROVED`
- purpose: `human review of auto-filled candidates`
- warning: `not a deploy authorization`
- warning: `not production DB access authorization`
- warning: `not production observation evidence`

This draft was auto-filled from repo, GitHub, config, workflow, and source-of-truth docs evidence only. It does not approve, execute, or claim any production action.

## Source Boundary

Allowed evidence used:

- current `master` after PR #32 merge
- source-of-truth repo docs
- GitHub PR/check metadata
- repo config and workflow files
- D1 schema/transform/API source files

Evidence not used:

- production DB data
- production API calls
- production secrets
- private logs
- synthetic production evidence
- owner guesses not supported by repo/GitHub metadata

## Dangerous Gates

All dangerous gates remain closed. `CONFIRM` in a future human packet must mean "confirm the current value remains no" unless a human explicitly replaces the value with `yes` and provides approver, UTC timestamp, and approval record.

| Gate | Value | Source | Classification | Confidence | Needs human confirmation |
| --- | --- | --- | --- | --- | --- |
| `ALLOW_DEPLOY` | `no` | Goal constraints; `docs/exec-plans/production-d1-observation-human-confirmation-intake.md` | `HUMAN_ONLY_DANGEROUS_GATE_CLOSED` | high | true |
| `ALLOW_PRODUCTION_DB_ACCESS` | `no` | Goal constraints; intake packet | `HUMAN_ONLY_DANGEROUS_GATE_CLOSED` | high | true |
| `ALLOW_PRODUCTION_DB_MIGRATION` | `no` | Goal constraints; intake packet | `HUMAN_ONLY_DANGEROUS_GATE_CLOSED` | high | true |
| `ALLOW_PRODUCTION_DB_WRITE` | `no` | Goal constraints; intake packet | `HUMAN_ONLY_DANGEROUS_GATE_CLOSED` | high | true |
| `ALLOW_PRODUCTION_OBSERVATION_CLAIM` | `no` | Goal constraints; intake packet | `HUMAN_ONLY_DANGEROUS_GATE_CLOSED` | high | true |

## Auto-Filled Repo, GitHub, And Config Values

| Field | Value | Source | Classification | Confidence | Needs human confirmation | HOLD if stale or ambiguous |
| --- | --- | --- | --- | --- | --- | --- |
| `REPO` | `dooosp/b2b-lead-agent` | `gh repo view`; `worker/wrangler.toml` `GITHUB_REPO` | `CONFIRMED_FROM_GITHUB_AND_CONFIG` | high | false | HOLD if repository identity changes. |
| `DEFAULT_BRANCH` | `master` | `gh repo view`; `git ls-remote --symref origin HEAD` | `CONFIRMED_FROM_GITHUB_AND_GIT` | high | false | HOLD if default branch changes. |
| `PR32_URL` | `https://github.com/dooosp/b2b-lead-agent/pull/32` | GitHub PR metadata | `CONFIRMED_FROM_GITHUB` | high | false | HOLD if PR metadata cannot be rechecked. |
| `PR32_HEAD_SHA` | `07d4e927b07efd8797b7cd502c96004265e3068b` | GitHub PR metadata; `origin/pr/32` | `CONFIRMED_FROM_GITHUB_AND_GIT` | high | false | HOLD if expected head differs. |
| `PR32_MERGE_COMMIT_SHA` | `d48af7eff1fe5f2c5591ffc4fc33a823a5d45095` | GitHub PR metadata after merge | `CONFIRMED_FROM_GITHUB` | high | false | HOLD if merge commit cannot be proved. |
| `MASTER_HEAD_AFTER_PR32` | `d48af7eff1fe5f2c5591ffc4fc33a823a5d45095` | `git rev-parse origin/master`; `git rev-parse HEAD` in clean worktree | `CONFIRMED_FROM_GIT` | high | true | HOLD if `origin/master` moves before future approval. |
| `MASTER_PUSH_CI` | `CI` completed success for `d48af7eff1fe5f2c5591ffc4fc33a823a5d45095` | GitHub Actions run `https://github.com/dooosp/b2b-lead-agent/actions/runs/25409965182` | `CONFIRMED_FROM_GITHUB_CI_NOT_PRODUCTION_EVIDENCE` | high | true | HOLD if stale, failing, or not for the approved SHA. |
| `MASTER_PUSH_VALIDATE_NAMING` | `Validate Naming` completed success for `d48af7eff1fe5f2c5591ffc4fc33a823a5d45095` | GitHub Actions run `https://github.com/dooosp/b2b-lead-agent/actions/runs/25409965190` | `CONFIRMED_FROM_GITHUB_CI_NOT_PRODUCTION_EVIDENCE` | high | true | HOLD if stale, failing, or not for the approved SHA. |
| `MASTER_PUSH_DEPLOY_TRIGGERED` | `no observed deploy workflow from repo workflow inventory` | `.github/workflows/ci.yml`; `.github/workflows/validate-naming.yml`; `.github/workflows/generate-report.yml` | `CONFIRMED_FROM_WORKFLOW_INVENTORY_NOT_RUNTIME_PROOF` | medium | true | HOLD if another deploy system exists outside repo workflow evidence. |
| `WORKER_NAME` | `b2b-lead-trigger` | `worker/wrangler.toml` | `CANDIDATE_FROM_CONFIG` | high | true | HOLD until a human approves exact deploy target. |
| `WORKER_ENTRYPOINT` | `worker/index.js` | `worker/wrangler.toml` | `CANDIDATE_FROM_CONFIG` | high | true | HOLD until deploy owner approves target. |
| `WORKER_ORIGIN` | `https://b2b-lead-trigger.jangho1383.workers.dev` | `worker/wrangler.toml` | `CANDIDATE_FROM_CONFIG` | high | true | HOLD if treated as production proof or deploy approval. |
| `D1_BINDING` | `DB` | `worker/wrangler.toml` | `CANDIDATE_FROM_CONFIG` | high | true | HOLD if treated as production DB access approval. |
| `D1_DATABASE_NAME` | `b2b-leads-db` | `worker/wrangler.toml` | `CANDIDATE_FROM_CONFIG` | high | true | HOLD until production DB owner confirms. |
| `D1_DATABASE_ID` | `8effbfab-bf05-4726-bb74-8d9b6c1cccfe` | `worker/wrangler.toml` | `CANDIDATE_FROM_CONFIG` | high | true | HOLD until production DB owner confirms. |
| `CONFIG_PROFILES` | `danfoss`, `ls-electric`, `siemens` | `worker/wrangler.toml` | `CANDIDATE_FROM_CONFIG` | high | true | HOLD until product/release owner selects a safe profile, lead id, or no-row posture. |
| `TARGET_COLUMNS_PRIMARY` | `generation_mode`, `verification_status`, `data_gaps`, `review_status` | approval packet; observation plan; `worker/db/schema.js`; `worker/schema.sql` | `CONFIRMED_FROM_REPO_NOT_PRODUCTION_SCHEMA_PROOF` | high | true | HOLD until production schema transcript proves columns. |
| `TARGET_COLUMNS_ADJACENT_ROW_PROOF` | `evidence`, `confidence`, `confidence_reason`, `assumptions`, `event_type` | approval packet; observation plan; `worker/db/schema.js`; `worker/db/transform.js` | `CONFIRMED_FROM_REPO_NOT_PRODUCTION_SCHEMA_PROOF` | high | true | HOLD until production schema transcript proves columns. |
| `ENSURE_D1_SCHEMA_PATH` | `ensureD1Schema(db)` in `worker/db/schema.js` | `worker/db/schema.js` | `CONFIRMED_FROM_REPO_LAZY_DDL_PATH` | high | true | HOLD before production invocation unless lazy DDL/migration is approved. |
| `ENSURE_D1_SCHEMA_CALLERS` | D1 lead helpers including `saveLeadsBatch`, `getLeadsByProfile`, `getAllLeads`, `getLeadById`, `updateLeadPatchAtomic`, status, notes, enrichment, analytics, dashboard helpers, plus job/reference/enrichment helpers that use D1 | `docs/exec-plans/d1-lazy-migration-observation-plan.md`; `worker/db/leads.js`; `worker/db/job-runs.js`; `worker/db/references.js`; `worker/api/enrichment.js` | `CONFIRMED_FROM_REPO_POSSIBLE_PRODUCTION_DB_ACCESS_PATHS` | high | true | HOLD before production use unless DB access and migration gates are approved. |
| `ROW_ROUNDTRIP_CANDIDATES` | `PATCH /api/leads/<lead-id>`, approved `POST /api/analyze`, or cache-risk `GET /api/leads` / `GET /api/history` | observation plan; `worker/api/leads.js` | `CANDIDATE_FROM_REPO_REQUIRES_WRITE_APPROVAL` | high | true | HOLD until safe real row/action and write approval are documented. |
| `CRM_CONTRACT_REPO_FACT` | `crm.published-report.v1` remains backward-compatible and excludes LeadBrief fields unless separately scoped | `docs/exec-plans/internal-api-contract-freeze.md`; `docs/exec-plans/leadbrief-v1-contract.md` | `CONFIRMED_FROM_REPO_POLICY_STILL_PENDING` | high | true | HOLD until human policy record confirms. |
| `PRODUCT_BOUNDARY_REPO_FACT` | Product flow is signal detection, opportunity interpretation, and reviewable brief; not CRM replacement, automatic salesperson, proposal generator, or PPT-first workflow | `docs/exec-plans/leadbrief-v1-contract.md` | `CONFIRMED_FROM_REPO_DOC` | high | false | HOLD if future work expands product scope. |

## Owner Fields

Owner fields are not approvals. GitHub ownership, PR authorship, merge rights, or repository admin status are not production owner records.

| Owner field | Candidate | Source | Status | Confidence | Needs human confirmation |
| --- | --- | --- | --- | --- | --- |
| `DEPLOY_OWNER` | `dooosp / Taeho Jang` as GitHub repo owner, PR author, and merger metadata only | GitHub repo and PR metadata | `CANDIDATE_REQUIRES_HUMAN_CONFIRMATION` | medium | true |
| `PRODUCTION_DB_OWNER` | null; unsafe to infer | approval packet; intake packet | `CANDIDATE_REQUIRES_HUMAN_CONFIRMATION` | high | true |
| `ROLLBACK_OWNER` | `dooosp / Taeho Jang` as GitHub repo owner, PR author, and merger metadata only | GitHub PR metadata | `CANDIDATE_REQUIRES_HUMAN_CONFIRMATION` | medium | true |
| `OBSERVATION_OWNER` | `dooosp / Taeho Jang` as GitHub repo owner, PR author, and merger metadata only | GitHub PR metadata | `CANDIDATE_REQUIRES_HUMAN_CONFIRMATION` | medium | true |

## Policy Fields

These policy fields remain pending even when a repo fact can help a human decide. Repo facts are not policy approval records.

| Policy field | Value | Source | Classification | Confidence | Needs human confirmation |
| --- | --- | --- | --- | --- | --- |
| `BACKUP_OR_EXPORT_POLICY` | `PENDING_HUMAN_POLICY_RECORD` | approval packet; intake packet | `MISSING_REQUIRES_HUMAN_POLICY_RECORD` | high | true |
| `ROLLBACK_PLAN` | `PENDING_HUMAN_POLICY_RECORD` | approval packet; intake packet | `MISSING_REQUIRES_HUMAN_POLICY_RECORD` | high | true |
| `EVIDENCE_STORAGE_POLICY` | `PENDING_HUMAN_POLICY_RECORD` | approval packet; intake packet | `MISSING_REQUIRES_HUMAN_POLICY_RECORD` | high | true |
| `CRM_CONTRACT_FREEZE_CONFIRMATION` | `PENDING_HUMAN_POLICY_RECORD`; repo fact confirms current freeze only | `docs/exec-plans/internal-api-contract-freeze.md`; `docs/exec-plans/leadbrief-v1-contract.md` | `REPO_FACT_CONFIRMED_POLICY_RECORD_PENDING` | high | true |
| `SAFE_PRODUCTION_PROFILE_OR_LEAD_SELECTION` | `PENDING_HUMAN_POLICY_RECORD` | approval packet; intake packet; `worker/wrangler.toml` profile candidates | `MISSING_REQUIRES_HUMAN_POLICY_RECORD` | high | true |
| `SAFE_REAL_ROW_OR_ACTION_POLICY` | `PENDING_HUMAN_POLICY_RECORD` | approval packet; intake packet | `MISSING_REQUIRES_HUMAN_POLICY_RECORD` | high | true |
| `HUMAN_REVIEW_OVERWRITE_RISK_CHECK` | `PENDING_HUMAN_POLICY_RECORD`; repo fact shows upserts preserve existing `review_status` | `worker/db/leads.js`; LeadBrief contract | `REPO_FACT_CONFIRMED_ROW_SPECIFIC_RECORD_PENDING` | high | true |

## Evidence Authenticity Rules

- No production observation was performed for this draft.
- CI is validation evidence only, not production evidence.
- Repo config is inventory only, not production DB proof.
- D1 config is not production observation.
- Schema files and `ensureD1Schema()` are repo proof only, not production schema transcript proof.
- Target column lists are observation scope only, not proof that production has those columns.
- Row roundtrip proof remains absent.
- Production deployment metadata remains absent.
- Machine-readable production schema transcript remains absent.
- Evidence storage and redaction policy remains absent.
- Secrets, tokens, auth headers, cookies, private URLs, customer payloads, and PII are forbidden in any future evidence artifact.

## Machine-Readable Draft Block

```yaml
productionD1ObservationConfirmationDraft:
  document_status: "DRAFT_NOT_APPROVED"
  purpose: "human review of auto-filled candidates"
  generated_at_utc: "2026-05-06T00:32:59Z"
  generated_from:
    repo: "dooosp/b2b-lead-agent"
    default_branch: "master"
    master_head_after_pr32: "d48af7eff1fe5f2c5591ffc4fc33a823a5d45095"
    pr32:
      url: "https://github.com/dooosp/b2b-lead-agent/pull/32"
      title: "docs: add production D1 observation human confirmation intake"
      head_sha: "07d4e927b07efd8797b7cd502c96004265e3068b"
      merge_commit_sha: "d48af7eff1fe5f2c5591ffc4fc33a823a5d45095"
      merged_at_utc: "2026-05-06T00:31:36Z"
      changed_files:
        - "NEXT_SESSION_PROMPT.md"
        - "docs/exec-plans/production-d1-observation-human-confirmation-intake.md"
  approver: null
  approval_timestamp_utc: null
  approval_record: null
  warning:
    not_a_deploy_authorization: true
    not_production_db_access_authorization: true
    not_production_observation_evidence: true
    no_production_observation_performed: true
    ci_is_not_production_evidence: true
    config_inventory_is_not_production_db_proof: true
    repo_schema_is_not_production_schema_proof: true
    github_owner_is_not_production_db_owner: true
  dangerous_gates:
    ALLOW_DEPLOY: "no"
    ALLOW_PRODUCTION_DB_ACCESS: "no"
    ALLOW_PRODUCTION_DB_MIGRATION: "no"
    ALLOW_PRODUCTION_DB_WRITE: "no"
    ALLOW_PRODUCTION_OBSERVATION_CLAIM: "no"
  owners:
    DEPLOY_OWNER:
      candidate: "dooosp / Taeho Jang"
      source: "GitHub repo owner, PR author, and merger metadata only"
      status: "CANDIDATE_REQUIRES_HUMAN_CONFIRMATION"
      approved_owner: null
      approval_record: null
    PRODUCTION_DB_OWNER:
      candidate: null
      unsafe_to_infer: true
      source: "approval packet and intake packet state no confirmed production D1 owner"
      status: "CANDIDATE_REQUIRES_HUMAN_CONFIRMATION"
      approved_owner: null
      approval_record: null
    ROLLBACK_OWNER:
      candidate: "dooosp / Taeho Jang"
      source: "GitHub repo owner, PR author, and merger metadata only"
      status: "CANDIDATE_REQUIRES_HUMAN_CONFIRMATION"
      approved_owner: null
      approval_record: null
    OBSERVATION_OWNER:
      candidate: "dooosp / Taeho Jang"
      source: "GitHub repo owner, PR author, and merger metadata only"
      status: "CANDIDATE_REQUIRES_HUMAN_CONFIRMATION"
      approved_owner: null
      approval_record: null
  policy_fields:
    BACKUP_OR_EXPORT_POLICY:
      status: "PENDING_HUMAN_POLICY_RECORD"
      value: null
      policy_record: null
    ROLLBACK_PLAN:
      status: "PENDING_HUMAN_POLICY_RECORD"
      value: null
      policy_record: null
    EVIDENCE_STORAGE_POLICY:
      status: "PENDING_HUMAN_POLICY_RECORD"
      value: null
      policy_record: null
      forbidden_in_evidence:
        - "secrets"
        - "tokens"
        - "auth headers"
        - "cookies"
        - "private URLs"
        - "customer payloads"
        - "PII"
    CRM_CONTRACT_FREEZE_CONFIRMATION:
      status: "PENDING_HUMAN_POLICY_RECORD"
      repo_fact:
        value: "crm.published-report.v1 remains backward-compatible and excludes LeadBrief fields unless separately scoped"
        source:
          - "docs/exec-plans/internal-api-contract-freeze.md"
          - "docs/exec-plans/leadbrief-v1-contract.md"
        classification: "CONFIRMED_FROM_REPO_POLICY_RECORD_PENDING"
      policy_record: null
    SAFE_PRODUCTION_PROFILE_OR_LEAD_SELECTION:
      status: "PENDING_HUMAN_POLICY_RECORD"
      candidates_from_config:
        - "danfoss"
        - "ls-electric"
        - "siemens"
      selected_value: null
      policy_record: null
    SAFE_REAL_ROW_OR_ACTION_POLICY:
      status: "PENDING_HUMAN_POLICY_RECORD"
      value: null
      policy_record: null
    HUMAN_REVIEW_OVERWRITE_RISK_CHECK:
      status: "PENDING_HUMAN_POLICY_RECORD"
      repo_fact: "managed/self-service upserts preserve existing review_status on conflict; row-specific overwrite risk remains unapproved"
      no_overwrite_confirmed: false
      no_evidence_toggle_confirmed: false
      policy_record: null
  config_fields:
    REPO:
      value: "dooosp/b2b-lead-agent"
      source:
        - "gh repo view"
        - "worker/wrangler.toml"
      classification: "CONFIRMED_FROM_GITHUB_AND_CONFIG"
      confidence: "high"
      needs_human_confirmation: false
    DEFAULT_BRANCH:
      value: "master"
      source:
        - "gh repo view"
        - "git ls-remote --symref origin HEAD"
      classification: "CONFIRMED_FROM_GITHUB_AND_GIT"
      confidence: "high"
      needs_human_confirmation: false
    MASTER_HEAD_AFTER_PR32:
      value: "d48af7eff1fe5f2c5591ffc4fc33a823a5d45095"
      source:
        - "git rev-parse origin/master"
        - "GitHub PR #32 merge metadata"
      classification: "CONFIRMED_FROM_GIT_AND_GITHUB"
      confidence: "high"
      needs_human_confirmation: true
      hold_if: "origin/master moved before future approval"
    CURRENT_CI_PROOF_FOR_MASTER_HEAD:
      value:
        - workflow: "CI"
          status: "completed"
          conclusion: "success"
          url: "https://github.com/dooosp/b2b-lead-agent/actions/runs/25409965182"
        - workflow: "Validate Naming"
          status: "completed"
          conclusion: "success"
          url: "https://github.com/dooosp/b2b-lead-agent/actions/runs/25409965190"
      source: "GitHub Actions run list for master head d48af7eff1fe5f2c5591ffc4fc33a823a5d45095"
      classification: "CONFIRMED_FROM_GITHUB_CI_NOT_PRODUCTION_EVIDENCE"
      confidence: "high"
      needs_human_confirmation: true
      hold_if: "CI is stale, failing, or not for approved SHA"
    MASTER_PUSH_DEPLOY_TRIGGERED:
      value: false
      source:
        - ".github/workflows/ci.yml"
        - ".github/workflows/validate-naming.yml"
        - ".github/workflows/generate-report.yml"
      classification: "CONFIRMED_FROM_WORKFLOW_INVENTORY_NOT_EXTERNAL_DEPLOY_PROOF"
      confidence: "medium"
      needs_human_confirmation: true
      hold_if: "deploy system exists outside checked repo workflows"
    WORKER_NAME:
      value: "b2b-lead-trigger"
      source: "worker/wrangler.toml"
      classification: "CANDIDATE_FROM_CONFIG"
      confidence: "high"
      needs_human_confirmation: true
    WORKER_ENTRYPOINT:
      value: "worker/index.js"
      source: "worker/wrangler.toml"
      classification: "CANDIDATE_FROM_CONFIG"
      confidence: "high"
      needs_human_confirmation: true
    WORKER_ORIGIN:
      value: "https://b2b-lead-trigger.jangho1383.workers.dev"
      source: "worker/wrangler.toml"
      classification: "CANDIDATE_FROM_CONFIG_NOT_PRODUCTION_PROOF"
      confidence: "high"
      needs_human_confirmation: true
    D1_BINDING:
      value: "DB"
      source: "worker/wrangler.toml"
      classification: "CANDIDATE_FROM_CONFIG_NOT_DB_ACCESS_APPROVAL"
      confidence: "high"
      needs_human_confirmation: true
    D1_DATABASE_NAME:
      value: "b2b-leads-db"
      source: "worker/wrangler.toml"
      classification: "CANDIDATE_FROM_CONFIG_NOT_PRODUCTION_DB_PROOF"
      confidence: "high"
      needs_human_confirmation: true
    D1_DATABASE_ID:
      value: "8effbfab-bf05-4726-bb74-8d9b6c1cccfe"
      source: "worker/wrangler.toml"
      classification: "CANDIDATE_FROM_CONFIG_NOT_PRODUCTION_DB_PROOF"
      confidence: "high"
      needs_human_confirmation: true
    CONFIG_PROFILES:
      value:
        - "danfoss"
        - "ls-electric"
        - "siemens"
      source: "worker/wrangler.toml"
      classification: "CANDIDATE_FROM_CONFIG_NOT_SAFE_TARGET_SELECTION"
      confidence: "high"
      needs_human_confirmation: true
    DEPLOY_PATH:
      value: "Cloudflare Worker config target only; no exact deploy command approved"
      source:
        - "worker/wrangler.toml"
        - "docs/exec-plans/production-d1-observation-approval-packet.md"
      classification: "CANDIDATE_REQUIRES_HUMAN_APPROVAL"
      confidence: "medium"
      needs_human_confirmation: true
      status: "HOLD"
    ROLLBACK_PATH:
      value: null
      source:
        - "docs/exec-plans/d1-lazy-migration-observation-plan.md"
        - "docs/exec-plans/production-d1-observation-approval-packet.md"
      classification: "MISSING_REQUIRES_HUMAN_POLICY_RECORD"
      confidence: "high"
      needs_human_confirmation: true
      status: "HOLD"
    SCHEMA_PROOF_METHOD:
      value: "Candidate query: PRAGMA table_info(leads); through approved Cloudflare/D1 read path with machine-readable transcript"
      source:
        - "docs/exec-plans/d1-lazy-migration-observation-plan.md"
        - "docs/exec-plans/production-d1-observation-approval-packet.md"
      classification: "CANDIDATE_REQUIRES_PRODUCTION_DB_ACCESS_AND_TRANSCRIPT_APPROVAL"
      confidence: "high"
      needs_human_confirmation: true
      status: "HOLD"
    TARGET_COLUMNS:
      primary:
        - "generation_mode"
        - "verification_status"
        - "data_gaps"
        - "review_status"
      adjacent_row_proof:
        - "evidence"
        - "confidence"
        - "confidence_reason"
        - "assumptions"
        - "event_type"
      source:
        - "docs/exec-plans/d1-lazy-migration-observation-plan.md"
        - "worker/db/schema.js"
        - "worker/schema.sql"
        - "worker/db/transform.js"
      classification: "CONFIRMED_FROM_REPO_NOT_PRODUCTION_SCHEMA_PROOF"
      confidence: "high"
      needs_human_confirmation: true
    ENSURE_D1_SCHEMA_PATH:
      value: "ensureD1Schema(db)"
      source: "worker/db/schema.js"
      classification: "CONFIRMED_FROM_REPO_LAZY_DDL_PATH"
      confidence: "high"
      needs_human_confirmation: true
      hold_if: "production invocation lacks ALLOW_PRODUCTION_DB_MIGRATION=yes"
    ROW_ROUNDTRIP_PATH_CANDIDATE:
      value:
        - "PATCH /api/leads/<lead-id> with real human review decision"
        - "POST /api/analyze for real approved self-service target"
        - "GET /api/leads or GET /api/history only if cache-write risk is approved"
      source:
        - "docs/exec-plans/d1-lazy-migration-observation-plan.md"
        - "worker/api/leads.js"
      classification: "CANDIDATE_REQUIRES_PRODUCTION_DB_WRITE_APPROVAL"
      confidence: "high"
      needs_human_confirmation: true
      status: "HOLD_NEEDS_SAFE_WRITE_PATH"
  production_deploy_metadata:
    deployed_worker_sha: null
    deployment_id_or_version: null
    deployed_at_utc: null
    deploy_transcript_or_record: null
    production_service_matches_approved_sha: false
  production_schema_transcript:
    performed: false
    transcript_location: null
    target_columns_proved_in_production: false
  row_roundtrip_proof:
    performed: false
    real_row_or_action: null
    response_status: null
    review_status_before: null
    review_status_after: null
    pipeline_status_before: null
    pipeline_status_after: null
  ready_to_deploy_observe: false
  hold_reasons:
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
    - "EVIDENCE_STORAGE_POLICY"
    - "CRM_CONTRACT_FREEZE_CONFIRMATION"
    - "SAFE_PRODUCTION_PROFILE_OR_LEAD_SELECTION"
    - "SAFE_REAL_ROW_OR_ACTION_POLICY"
    - "SAFE_REAL_ROW_OR_ACTION_PATH_BEFORE_WRITE"
    - "HUMAN_REVIEW_OVERWRITE_RISK_CHECK"
    - "OBSERVATION_WINDOW_START_UTC"
    - "OBSERVATION_WINDOW_END_UTC"
    - "OBSERVATION_COMMUNICATION_CHANNEL"
    - "APPROVED_DEPLOY_SHA"
    - "CI_PROOF_FOR_APPROVED_SHA"
    - "WORKER_NAME_HUMAN_CONFIRMATION"
    - "D1_BINDING_HUMAN_CONFIRMATION"
    - "D1_DATABASE_NAME_HUMAN_CONFIRMATION"
    - "D1_DATABASE_ID_HUMAN_CONFIRMATION"
    - "DEPLOY_PATH"
    - "ROLLBACK_PATH"
    - "SCHEMA_PROOF_METHOD"
    - "SCHEMA_TARGET_COLUMN_PROOF"
    - "PRODUCTION_DEPLOY_METADATA"
    - "DEPLOYED_WORKER_SHA"
    - "DEPLOYMENT_ID_OR_VERSION"
    - "DEPLOYED_AT_UTC"
    - "DEPLOY_TRANSCRIPT_OR_RECORD"
    - "PRODUCTION_SERVICE_MATCHES_APPROVED_SHA"
    - "EVIDENCE_STORAGE_CHOICE"
    - "EVIDENCE_STORAGE_ACCESS_CONTROLS"
    - "EVIDENCE_STORAGE_APPROVAL_RECORD"
    - "EVIDENCE_STORAGE_REDACTION_CONFIRMATION"
    - "MACHINE_READABLE_PRODUCTION_SCHEMA_TRANSCRIPT"
    - "ROW_ROUNDTRIP_PROOF"
    - "NO_OVERWRITE_OR_EVIDENCE_TOGGLE_CONFIRMATION"
  next_human_decisions:
    - "Review each auto-filled candidate and confirm, replace, reject, or hold it."
    - "Leave dangerous gates as no unless a separate human approval record explicitly changes a gate to yes."
    - "Name deploy, production DB, rollback, and observation owners with approval records."
    - "Record backup/export, rollback, evidence storage/redaction, CRM freeze, safe target, safe row/action, and overwrite-risk policies."
    - "Choose a safe production profile, lead id, or explicit no-row posture."
    - "Only after human approval may a separate supervised deploy/observe prompt be considered."
```

## HOLD Reasons

The draft is intentionally blocked by all unresolved keys in the machine-readable `hold_reasons` array. The most important blocker classes are:

- dangerous approval gates remain `no`
- production owners are not confirmed
- production DB owner is explicitly unsafe to infer
- rollback and backup/export policy records are missing
- evidence storage, access-control, and redaction policy is missing
- safe production profile, lead id, row/action, or no-write decision is missing
- exact deploy path and rollback path are missing
- production deploy metadata is missing
- production schema transcript is missing
- row roundtrip proof is missing
- observation claim approval is missing

## Future Prompt

Use this only after a human has reviewed this draft and changed `document_status` from `DRAFT_NOT_APPROVED` to an explicitly approved state with approver, UTC timestamp, and approval record. If the block still says `DRAFT_NOT_APPROVED`, the next agent must stop with `HOLD`.

```text
You are Codex acting as a supervised production D1 observation gatekeeper for dooosp/b2b-lead-agent.

Input:
- The filled machine-readable block from docs/exec-plans/production-d1-observation-confirmation-draft.md.

Default:
- If document_status is DRAFT_NOT_APPROVED, stop with HOLD.
- If approver, approval_timestamp_utc, or approval_record is null, stop with HOLD.
- Treat every candidate as unapproved unless a human changed it to an approved value with a record.

Before any action:
- Run repo preflight and prove repo root, identity, branch, HEAD, default branch, origin/master, dirty status, and checkout safety.
- Confirm HEAD equals the human-approved deploy SHA.
- Confirm GitHub CI is current and successful for the approved SHA. CI is not production evidence.
- Read AGENTS.md, HARDENING_PLAN.md, NEXT_SESSION_PROMPT.md, docs/exec-plans/production-d1-observation-confirmation-draft.md, docs/exec-plans/production-d1-observation-human-confirmation-intake.md, docs/exec-plans/production-d1-observation-approval-packet.md, docs/exec-plans/d1-lazy-migration-observation-plan.md, docs/exec-plans/leadbrief-v1-contract.md, docs/exec-plans/internal-api-contract-freeze.md, worker/wrangler.toml, .github/workflows/ci.yml, .github/workflows/validate-naming.yml, .github/workflows/generate-report.yml, worker/db/schema.js, worker/schema.sql, worker/db/leads.js, worker/db/transform.js, worker/api/leads.js, and worker/lib/leadbrief-v1.js.

Hard gates:
- If ALLOW_DEPLOY is not exactly yes with approver, timestamp, and approval record, do not deploy; stop with HOLD missing ALLOW_DEPLOY.
- If ALLOW_PRODUCTION_DB_ACCESS is not exactly yes with approver, timestamp, and approval record, do not access production DB or invoke any production path that accesses it.
- If ALLOW_PRODUCTION_DB_MIGRATION is not exactly yes with approver, timestamp, and approval record, do not invoke any path expected to run ensureD1Schema().
- If ALLOW_PRODUCTION_DB_WRITE is not exactly yes with approver, timestamp, and approval record, do not perform PATCH, POST /api/analyze persistence, GET cache-write observation, or any production row write.
- If ALLOW_PRODUCTION_OBSERVATION_CLAIM is not exactly yes with approver, timestamp, and approval record, do not state that production D1 lazy migration was observed.

Owner and policy gates:
- Stop with HOLD if DEPLOY_OWNER, PRODUCTION_DB_OWNER, ROLLBACK_OWNER, or OBSERVATION_OWNER is missing or inferred only from GitHub metadata.
- Stop with HOLD if BACKUP_OR_EXPORT_POLICY, ROLLBACK_PLAN, EVIDENCE_STORAGE_POLICY, CRM_CONTRACT_FREEZE_CONFIRMATION, SAFE_PRODUCTION_PROFILE_OR_LEAD_SELECTION, SAFE_REAL_ROW_OR_ACTION_POLICY, or HUMAN_REVIEW_OVERWRITE_RISK_CHECK is missing or lacks a policy record.
- Stop with HOLD if evidence storage would expose secrets, tokens, auth headers, cookies, private URLs, customer payloads, or PII.

Evidence gates:
- Repo config, docs, schema files, PRs, and CI are not production evidence.
- Require production deploy metadata before any production observation statement.
- Require a machine-readable production schema transcript proving every target column before any schema proof statement.
- Require an approved real row/action and row roundtrip proof before any production-observed lazy migration claim.

If any required key is missing, stale, ambiguous, or unapproved, report HOLD with the exact missing key. Do not deploy, do not access production DB, do not write production data, do not run lazy DDL, and do not claim production observation.
```
