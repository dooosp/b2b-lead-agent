# B2B Lead Agent Privacy Owner Input Request

This packet is the owner-input request after
`docs/roadmap/b2b-lead-agent-privacy-retention-decision-packet.md`.

It is documentation only. It does not implement privacy enforcement, PII
detection, redaction, retention enforcement, purge/delete jobs, export controls,
auth, access control, runtime behavior, UI behavior, API behavior, schema
behavior, database behavior, CRM integration, outreach, LLM calls, staging
execution, production proof, production deploy, D1 access, endpoint calls, log
access, secret access, customer-data access, outcome learning, or automation.

## Document Status

- Document status: `PRIVACY_OWNER_INPUT_REQUEST_PACKET_CREATED_DOCS_ONLY`.
- Human decision:
  `PREPARE_PRIVACY_OWNER_INPUT_REQUEST_DOCS_ONLY`.
- Repository: `dooosp/b2b-lead-agent`.
- Expected repo basename: `b2b-lead-agent`.
- Default branch: `master`.
- Baseline inspected: `origin/master` at
  `32802c3a89b7b0fbde31736ad8045b8b0a684015`.
- Latest related merged PR: PR #153,
  `docs: add privacy owner input request packet`.
- Privacy owner input tracking issue:
  https://github.com/dooosp/b2b-lead-agent/issues/154.
- Privacy owner input tracking issue status: `OPEN`.
- Owner input status: `MISSING`.
- Privacy implementation status: `NOT_STARTED`.
- Controlling roadmap:
  `docs/roadmap/b2b-lead-agent-productization-roadmap-v1.md`.
- Controlling readiness packet:
  `docs/roadmap/b2b-lead-agent-production-reviewer-workflow-readiness-packet.md`.
- Controlling auth/access packet:
  `docs/roadmap/b2b-lead-agent-auth-access-control-decision-packet.md`.
- Controlling privacy/retention packet:
  `docs/roadmap/b2b-lead-agent-privacy-retention-decision-packet.md`.
- Current productization level: `LEVEL_0_COMPLETE`.
- Target productization level: `LEVEL_1_PRODUCTION_REVIEWER_WORKFLOW`.
- Owner values provided by this packet: no.
- Privacy/retention implementation performed by this packet: no.
- PII detection, redaction, purge/delete, or export-control implementation:
  no.
- Staging execution performed by this packet: no.
- Production proof performed by this packet: no.
- Production deploy performed by this packet: no.
- CRM/outreach/LLM/automation action performed by this packet: no.
- Generated suggestion persistence/history/export/attribution: forbidden.

```yaml
b2b_lead_agent_privacy_owner_input_request:
  document_status: PRIVACY_OWNER_INPUT_REQUEST_PACKET_CREATED_DOCS_ONLY
  human_decision: PREPARE_PRIVACY_OWNER_INPUT_REQUEST_DOCS_ONLY
  repository: dooosp/b2b-lead-agent
  default_branch: master
  inspected_origin_master: "32802c3a89b7b0fbde31736ad8045b8b0a684015"
  latest_related_merged_pr: 153
  privacy_owner_input_tracking_issue_url: "https://github.com/dooosp/b2b-lead-agent/issues/154"
  privacy_owner_input_tracking_issue_status: OPEN
  owner_input_status: MISSING
  current_productization_level: LEVEL_0_COMPLETE
  target_productization_level: LEVEL_1_PRODUCTION_REVIEWER_WORKFLOW
  privacy_owner_input_status: INCOMPLETE
  privacy_implementation_plan_ready: false
  privacy_implementation_status: NOT_STARTED
  production_reviewer_workflow_ready: BLOCKED
  owner_values_provided_by_packet: false
  privacy_retention_implementation_performed: false
  pii_detection_implemented: false
  redaction_implemented: false
  purge_delete_implemented: false
  export_control_implemented: false
  staging_execution: HOLD
  production_proof: HOLD
  production_deploy: HOLD
  crm_outreach_llm_automation: FORBIDDEN
  next_recommended_cycle: HOLD_FOR_PRIVACY_OWNER_INPUT
  next_decision: HOLD
```

## 1. Purpose

This packet asks the privacy and retention owner for the minimum explicit
decisions needed before any future privacy implementation plan, auth
implementation plan, production reviewer workflow proof, CRM read-only planning,
manager dashboard expansion, export/API expansion, outcome learning, or
automation can proceed.

This is an owner-input request only.

This packet is not:

- implementation;
- privacy enforcement;
- legal or compliance proof;
- production proof;
- permission to use staging or production systems;
- permission to access customer data;
- permission to connect CRM, outreach, LLM, or automation systems.

Current status remains `HOLD`.

## 2. Repo-Grounded Audit

Audited source records:

| Area | Repo-visible finding |
| --- | --- |
| B2B Lead Agent Productization Roadmap v1 | `docs/roadmap/b2b-lead-agent-productization-roadmap-v1.md` sets `CURRENT_PRODUCTIZATION_LEVEL: LEVEL_0_COMPLETE`, `NEXT_TARGET_LEVEL: LEVEL_1_PRODUCTION_REVIEWER_WORKFLOW`, and keeps staging execution, production proof, production deploy, CRM mutation, outreach send, customer-data access, and generated suggestion persistence/history/export/attribution blocked. |
| Production Reviewer Workflow Readiness Packet | `docs/roadmap/b2b-lead-agent-production-reviewer-workflow-readiness-packet.md` concludes `PRODUCTION_REVIEWER_WORKFLOW_READY: BLOCKED` due to auth/access-control, production D1, privacy/retention, rollback/backout, observability/evidence, and production proof blockers. |
| Auth / Access Control Decision Packet | `docs/roadmap/b2b-lead-agent-auth-access-control-decision-packet.md` concludes the C2 local/test role stub is not real production auth, selects `AUTH_ACCESS_CONTROL_DECISION: OPTION_C_NEEDS_HUMAN_SECURITY_DECISION`, and recommends the Privacy / Retention Decision Packet while preserving staging, production, CRM, outreach, LLM, outcome-learning, manager/export/API, and automation boundaries. |
| Privacy / Retention Decision Packet | `docs/roadmap/b2b-lead-agent-privacy-retention-decision-packet.md` concludes `PRIVACY_RETENTION_DECISION: OPTION_C_NEEDS_HUMAN_PRIVACY_OWNER_DECISION`, keeps `PRIVACY_RETENTION_IMPLEMENTATION_READY: NO`, and recommends `PRIVACY_OWNER_INPUT_REQUEST_DOCS_ONLY`. |
| Manual Review Notes v1 docs | `docs/roadmap/manual-review-notes-v1-non-production-cycle-closeout.md` records local/test `SHIP` for save/read/edit/clear, note timestamp, fixed generic author label, metadata-only history, warning-only privacy copy, and C2 local/test role stub. It is not staging or production proof. |
| Generated reviewer note suggestion boundary | `docs/roadmap/saved-review-notes-decision-packet.md`, `docs/roadmap/manual-review-notes-option-a-implementation-plan.md`, implementation tests, and current train docs keep generated suggestions copy-only, unsaved, unattributed, unretained, unexported, excluded from history, and never saved as manual notes. |
| Privacy warning docs/tests | `docs/roadmap/manual-review-notes-v1-retention-privacy-policy-decision-packet.md`, PR #130 context, and `worker/tests/lead-review-status.test.mjs` record static warning-only behavior. The warning is not detection, redaction, retention enforcement, purge/delete, or compliance proof. |
| Protected field visibility docs | `docs/roadmap/manual-review-notes-v1-access-control-plan.md` and the C2 local/test role-stub tests treat manual note text, note timestamp, generic author label, and metadata-history summary fields as protected local/test surfaces. |
| Manager visibility/export/API docs | `docs/roadmap/manual-review-notes-v1-access-visibility-export-decision-packet.md` keeps manager visibility, export expansion, API expansion, and full metadata visibility unapproved. |
| Data semantics docs | `docs/roadmap/manual-review-notes-v1-data-semantics-decision-packet.md` defines `manualReviewNotes`, note-specific timestamp semantics, and generated suggestion exclusion from saved manual notes. |
| Reviewer identity / author attribution docs | `docs/roadmap/manual-review-notes-v1-reviewer-identity-decision-packet.md` permits only the fixed local/test generic label `manual_reviewer`; real reviewer identity remains unimplemented and unapproved. |
| Note history / versioning docs | `docs/roadmap/manual-review-notes-v1-note-history-versioning-decision-packet.md` records H2 metadata-only history and keeps old/new note text history, generated suggestion history, full/audit-grade history, retention enforcement, and production action unapproved. |
| Production readiness gap packet | `docs/roadmap/manual-review-notes-v1-production-readiness-gap-packet.md` separates local/test evidence from missing production gates and keeps production proof, deploy, production D1, endpoints, logs/secrets, privacy enforcement, PII detection/redaction, export/manager visibility, and real reviewer identity blocked. |
| Production proof plan | `docs/roadmap/manual-review-notes-v1-production-proof-plan.md` is docs-only and not approval to execute production proof, D1 access, endpoint calls, logs/secrets reads, production smoke tests, customer-data access, auth implementation, manager visibility, export expansion, retention enforcement, PII detection/redaction, or generated suggestion persistence/export/history/attribution. |
| Rollback/backout plan | `docs/roadmap/manual-review-notes-v1-production-rollback-backout-plan.md` is docs-only; production rollback, destructive data action, and production D1 action remain unapproved. |
| Current PR train / roadmap source of truth | `docs/roadmap/current-pr-train.md` tracks the May 2026 train and is updated by this packet to recognize PR #152 and the owner-input request as the next docs-only cycle. |
| Package scripts and validation commands | `package.json` exposes `check:naming`, `check:schema`, `eval:lead-quality`, `test:e2e:local`, `test:root`, `test:unit`, `test:contract`, `test:worker`, and `test`. |
| CI workflows | `.github/workflows/ci.yml` runs schema, synthetic eval, unit/contract tests, and local-only Worker E2E. `.github/workflows/validate-naming.yml` runs naming plus worker tests. `.github/workflows/generate-report.yml` is dispatch-only report generation and is not used by this packet. |

## 3. Current Blocker Summary

Current blockers:

- Production reviewer workflow is blocked.
- Privacy/retention owner decisions are missing.
- Manual notes may contain sensitive reviewer-entered text.
- The static privacy warning is warning-only.
- The static privacy warning is not enforcement, redaction, retention, purge,
  or compliance proof.
- Manager manual note visibility remains blocked.
- Export manual note visibility remains blocked.
- API manual note visibility remains blocked.
- Real reviewer identity retention remains unresolved.
- CRM data use remains unresolved and unapproved.
- Outreach data use remains unresolved and unapproved.
- Outcome learning data use remains unresolved and unapproved.
- Privacy implementation planning remains blocked until owner values are
  explicitly provided.

## 4. Required Owner Decisions

Every row below is required before this packet can be considered complete. The
request asks for decisions only; it does not decide or infer the answers.

| Item | Requested answer | Why it matters | Acceptable answer format | What must not be provided | Blocks production reviewer workflow | Can implementation proceed without it |
| --- | --- | --- | --- | --- | --- | --- |
| `PRIVACY_OWNER` | Name the privacy decision owner with authority for reviewer-entered note text, identity data, evidence, exports, CRM/outreach data use, and future proof boundaries. | Without an accountable owner, privacy decisions cannot be treated as approved. | GitHub handle, human name, or team name plus decision authority and contact path. | Guessed names, aliases without authority, private contact details, secrets, tokens, or customer data. | yes | no |
| `RETENTION_OWNER` | Name the owner for retention duration, deletion/purge policy, metadata event retention, and evidence retention. | Retention choices affect stored manual notes, metadata, exports, screenshots, and future purge/delete behavior. | GitHub handle, human name, or team name plus retention authority and contact path. | Guessed names, unapproved delegates, legal claims, secrets, tokens, or customer data. | yes | no |
| `LEGAL_REVIEW_REQUIRED` | Decide whether legal/compliance review is required before production saved-note use or privacy implementation. | Legal review may be required for note body storage, identity, retention, export, evidence, CRM, outreach, or outcome learning. | `yes` or `no`; if `yes`, name required legal/compliance reviewer or process. | Compliance claims without owner approval, privileged legal text, private legal advice, or screenshots containing private data. | yes | no |
| `MANUAL_NOTES_RETENTION_DURATION` | Decide how long current manual note text may be retained after save, edit, clear, export, or production proof. | `manualReviewNotes` is reviewer-entered text and may contain sensitive content. | Exact duration or policy label, such as `P30D`, `90 days`, `until explicit clear`, or `not allowed in production`, plus clear/export caveats. | Vague terms like `reasonable`, customer examples, real note body text, production DB output, or guessed values. | yes | no |
| `MANUAL_NOTES_BODY_HISTORY_ALLOWED` | Decide whether old/new manual note body history may ever be retained. | Current H2 history is metadata-only; storing body history creates higher privacy and retention obligations. | `yes` or `no`; if `yes`, include scope, duration, access roles, and proof requirements. | Ambiguous approval, body text examples, generated suggestion text, customer data, or hidden exceptions. | yes | no |
| `METADATA_EVENT_RETENTION_DURATION` | Decide how long manual note metadata events may be retained and whether they survive clear/delete. | Metadata can still reveal reviewer activity, timing, lead relationship, and workflow behavior. | Exact duration or policy label plus clear/delete survival rule. | Vague retention language, production row output, real identifiers, tokens, cookies, or auth headers. | yes | no |
| `REAL_REVIEWER_IDENTITY_ALLOWED` | Decide whether real reviewer identity may be stored or shown beyond the fixed `manual_reviewer` label. | Real identity changes privacy, auth, access-control, audit, and retention duties. | `yes` or `no`; if `yes`, list allowed identity classes such as user ID, display name, email, role, or API client ID. | Actual private identities, email dumps, session IDs, auth tokens, cookies, or screenshots with private payloads. | yes | no |
| `MANAGER_MANUAL_NOTE_VISIBILITY_ALLOWED` | Decide whether managers may see manual note text, metadata only, aggregates only, or nothing. | Manager dashboard expansion is blocked until note visibility is policy-approved. | `yes`, `no`, `metadata_only`, or `aggregate_only`, plus role/scope and field allowlist. | Broad `yes` without scope, real note text, customer payloads, private lead/person fields, or screenshots with notes. | yes | no |
| `EXPORT_MANUAL_NOTE_VISIBILITY_ALLOWED` | Decide whether exports may include manual note text or metadata. | Exported copies can create separate retention, sharing, and deletion obligations. | `yes` or `no`; if `yes`, include field allowlist, role/scope, redaction, retention, and evidence rules. | CSVs with real note text, private lead/person fields, customer data, auth headers, or broad export approval without field list. | yes | no |
| `API_MANUAL_NOTE_VISIBILITY_ALLOWED` | Decide whether API clients may receive manual note text or metadata. | API exposure needs role/scope, field allowlist, redaction, and retention policy. | `yes` or `no`; if `yes`, list roles/scopes, fields, and denial behavior. | Tokens, cookies, auth headers, private payloads, real API outputs, or broad API approval without field list. | yes | no |
| `PII_DETECTION_REQUIRED` | Decide whether PII/sensitive-content detection is required before saving, exporting, proofing, or logging manual notes. | Current warning is not detection; detection choice affects UX, API behavior, tests, and false positive/negative risk. | `required` or `not_required`; if required, include warn/block/override scope and fixture policy. | Implementation code, scanner output from customer data, real PII, logs, or compliance claims. | yes | no |
| `REDACTION_REQUIRED` | Decide whether redaction is required before storage, export, evidence capture, logs, or API response. | Redaction can reduce exposure but requires owner-approved semantics and proof. | `required` or `not_required`; if required, list surfaces and approved replacement behavior. | Real payloads, note bodies, customer data, production logs, staging logs, or redaction claims without proof. | yes | no |
| `PURGE_DELETE_REQUIRED` | Decide whether true purge/delete is required beyond current clear-as-empty-string behavior. | Current clear is not retention purge or legal deletion. | `required` or `not_required`; if required, list trigger, duration, scope, metadata survival, legal hold exceptions, and proof needs. | Production commands, D1 output, destructive-action approval hidden in this response, or legal deletion claims without owner process. | yes | no |
| `CRM_DATA_USE_ALLOWED` | Decide whether manual note text, metadata, reviewer identity, or private lead/person fields may be used for future CRM read-only planning. | CRM planning is blocked until data sharing and field boundaries are approved. | `allowed` or `not_allowed`; if allowed, list fields, scope, direction, owner, and whether mutation remains forbidden. | CRM credentials, customer payloads, CRM exports, tokens, private URLs, or approval for CRM mutation. | yes | no |
| `OUTREACH_DATA_USE_ALLOWED` | Decide whether manual note text, metadata, reviewer identity, or private lead/person fields may be used for future outreach drafting or sending. | Outreach is privacy-sensitive and currently forbidden. | `allowed` or `not_allowed`; if allowed, separate draft from send and list fields, consent, retention, and owner. | Recipient lists, email/message content with private data, send approval, provider tokens, or outreach execution evidence. | yes | no |
| `OUTCOME_LEARNING_DATA_USE_ALLOWED` | Decide whether manual notes, metadata, generated suggestions, reviewer identity, CRM data, outreach data, or review outcomes may feed outcome learning. | Outcome learning depends on privacy, data governance, bias/data-quality, and source-of-truth decisions. | `allowed` or `not_allowed`; if allowed, list data classes, taxonomy owner, retention, and exclusion rules. | Customer data, CRM/outreach dumps, generated summaries pretending to be approval, or model/automation execution approval. | yes | no |
| `PRODUCTION_PRIVACY_PROOF_APPROVED` | Decide whether a future production privacy proof may be planned, and under what owner boundaries. | Production reviewer workflow remains blocked without privacy proof approval and separate proof gates. | `approved` or `not_approved`; if approved, name allowed proof category, owners, evidence path, redaction rules, and required future goal. | Production logs, staging logs, production D1 output, endpoint responses, secrets, tokens, customer data, or proof execution authorization. | yes | no |
| `APPROVED_BY` | Identify the person or body approving these owner responses. | The response must be attributable to decision authority, not generated or inferred text. | GitHub handle, human name, or team name plus authority. | Hearsay, generated approval, unauthenticated names, private contact data, or owner names without authority. | yes | no |
| `DATE` | Provide the date of approval. | Date anchors the response to a repo state and review window. | `YYYY-MM-DD`. | Relative dates such as `today`, missing timezone context, future-dated approval, or guessed dates. | yes | no |
| `EXPIRATION_OR_REVIEW_DATE` | Provide when these decisions expire or must be reviewed. | Privacy and retention decisions should not silently apply forever if the product scope changes. | `YYYY-MM-DD`, `no_expiration`, or policy label plus review trigger. | Blank fields, vague terms, hidden conditions, or renewal claims without owner approval. | yes | no |

## 5. Copy-Paste Owner Response Template

```text
PRIVACY_OWNER:
RETENTION_OWNER:
LEGAL_REVIEW_REQUIRED:
MANUAL_NOTES_RETENTION_DURATION:
MANUAL_NOTES_BODY_HISTORY_ALLOWED:
METADATA_EVENT_RETENTION_DURATION:
REAL_REVIEWER_IDENTITY_ALLOWED:
MANAGER_MANUAL_NOTE_VISIBILITY_ALLOWED:
EXPORT_MANUAL_NOTE_VISIBILITY_ALLOWED:
API_MANUAL_NOTE_VISIBILITY_ALLOWED:
PII_DETECTION_REQUIRED:
REDACTION_REQUIRED:
PURGE_DELETE_REQUIRED:
CRM_DATA_USE_ALLOWED:
OUTREACH_DATA_USE_ALLOWED:
OUTCOME_LEARNING_DATA_USE_ALLOWED:
PRODUCTION_PRIVACY_PROOF_APPROVED:
APPROVED_BY:
DATE:
EXPIRATION_OR_REVIEW_DATE:
NOTES / LIMITATIONS:
```

## 6. Explicit Non-Approval Defaults

Default rules:

- Blank fields are not approval.
- Partial answers are not approval.
- Ambiguous answers are not approval.
- `yes` without scope is not approval.
- Owner names without decision authority are not approval.
- Generated summaries are not owner approval.
- Guessed owner values are not owner approval.
- Production privacy proof remains `HOLD`.
- Production deploy remains `HOLD`.
- Staging execution remains `HOLD`.
- CRM, outreach, LLM, and automation remain `FORBIDDEN`.
- Production reviewer workflow remains `BLOCKED`.

## 7. Acceptable Evidence

Acceptable owner-input evidence:

- GitHub issue comment from privacy/retention owner.
- GitHub PR comment from privacy/retention owner.
- Tracked docs update with explicit owner decision.
- Sanitized owner attestation.
- Redacted screenshot only if it contains no secrets, customer data, manual
  note body text, private payloads, tokens, cookies, or auth headers.

Unacceptable evidence:

- secrets;
- tokens;
- cookies;
- auth headers;
- production logs;
- staging logs;
- customer payloads;
- private lead/person fields;
- real manual note body text;
- production database output;
- staging database output;
- guessed values;
- generated summaries pretending to be owner approval;
- compliance claims without explicit owner/legal approval.

## 8. Future Decision Rule

If all required owner values are provided:

```text
PRIVACY_OWNER_INPUT_STATUS: COMPLETE
PRIVACY_IMPLEMENTATION_PLAN_READY: POSSIBLE
PRODUCTION_REVIEWER_WORKFLOW_READY: STILL_BLOCKED_PENDING_AUTH_D1_ROLLBACK_PROOF
NEXT_RECOMMENDED_CYCLE: AUTH_ACCESS_CONTROL_IMPLEMENTATION_PLAN_DOCS_ONLY or PRIVACY_RETENTION_IMPLEMENTATION_PLAN_DOCS_ONLY
NEXT_DECISION: HOLD_PENDING_NEW_EXPLICIT_GOAL
```

If any required owner value is missing:

```text
PRIVACY_OWNER_INPUT_STATUS: INCOMPLETE
PRIVACY_IMPLEMENTATION_PLAN_READY: NO
PRODUCTION_REVIEWER_WORKFLOW_READY: BLOCKED
NEXT_RECOMMENDED_CYCLE: HOLD_FOR_PRIVACY_OWNER_INPUT
NEXT_DECISION: HOLD
```

Current packet disposition:

```text
PRIVACY_OWNER_INPUT_STATUS: INCOMPLETE
PRIVACY_IMPLEMENTATION_PLAN_READY: NO
PRODUCTION_REVIEWER_WORKFLOW_READY: BLOCKED
NEXT_RECOMMENDED_CYCLE: HOLD_FOR_PRIVACY_OWNER_INPUT
NEXT_DECISION: HOLD
```

## 9. Boundaries For Future Cycles

Owner input does not authorize implementation by itself unless explicitly
stated in a separate future goal.

Owner input does not authorize:

- production access;
- production proof;
- staging execution;
- CRM connection;
- CRM mutation;
- outreach drafting;
- outreach sending;
- LLM calls;
- automation;
- schema changes;
- database changes;
- auth implementation;
- runtime behavior changes;
- UI behavior changes;
- API behavior changes;
- privacy enforcement;
- PII detection;
- redaction;
- retention enforcement;
- purge/delete jobs;
- export control implementation;
- customer-data access;
- compliance proof claims.

Every future implementation or proof cycle requires its own explicit goal,
scope, owner approvals, and validation gates.

## 10. Final Recommendation

```text
PRIVACY_OWNER_INPUT_REQUEST_PACKET: CREATED
PRIVACY_OWNER_INPUT_TRACKING_ISSUE_URL: https://github.com/dooosp/b2b-lead-agent/issues/154
PRIVACY_OWNER_INPUT_TRACKING_ISSUE_STATUS: OPEN
CURRENT_PRODUCTIZATION_LEVEL: LEVEL_0_COMPLETE
TARGET_PRODUCTIZATION_LEVEL: LEVEL_1_PRODUCTION_REVIEWER_WORKFLOW
OWNER_INPUT_STATUS: MISSING
PRIVACY_OWNER_INPUT_STATUS: INCOMPLETE
PRIVACY_IMPLEMENTATION_PLAN_READY: NO
PRIVACY_IMPLEMENTATION_STATUS: NOT_STARTED
PRODUCTION_REVIEWER_WORKFLOW_READY: BLOCKED
STAGING_EXECUTION: HOLD
PRODUCTION_PROOF: HOLD
PRODUCTION_DEPLOY: HOLD
CRM_OUTREACH_LLM_AUTOMATION: FORBIDDEN
NEXT_RECOMMENDED_CYCLE: HOLD_FOR_PRIVACY_OWNER_INPUT
NEXT_DECISION: HOLD
```

The next safe action is not implementation. The next safe action is for the
privacy and retention owner to provide explicit responses to the template above
using acceptable evidence.
