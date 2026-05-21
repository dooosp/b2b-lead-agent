# B2B Lead Agent Privacy / Retention Decision Packet

This packet is the Privacy / Retention Decision Packet after
`docs/roadmap/b2b-lead-agent-productization-roadmap-v1.md`,
`docs/roadmap/b2b-lead-agent-production-reviewer-workflow-readiness-packet.md`,
and `docs/roadmap/b2b-lead-agent-auth-access-control-decision-packet.md`.

It is documentation only. It does not implement privacy enforcement, PII
detection, redaction, retention enforcement, purge/delete jobs, export controls,
auth, access control, runtime behavior, UI behavior, API behavior, schema
behavior, database behavior, CRM integration, outreach, LLM calls, staging
execution, production proof, production deploy, D1 access, endpoint calls, log
access, secret access, customer-data access, outcome learning, or automation.

## Document Status

- Document status: `PRIVACY_RETENTION_DECISION_PACKET_CREATED_DOCS_ONLY`.
- Human decision:
  `PREPARE_PRIVACY_RETENTION_DECISION_PACKET_DOCS_ONLY`.
- Repository: `dooosp/b2b-lead-agent`.
- Expected repo basename: `b2b-lead-agent`.
- Default branch: `master`.
- Baseline inspected: `origin/master` at
  `d209a69114e9641cf4ec3f263d4533cc41ba047e`.
- Latest related merged PR: PR #151,
  `docs: add auth access control decision packet`.
- Controlling roadmap:
  `docs/roadmap/b2b-lead-agent-productization-roadmap-v1.md`.
- Controlling readiness packet:
  `docs/roadmap/b2b-lead-agent-production-reviewer-workflow-readiness-packet.md`.
- Controlling auth/access packet:
  `docs/roadmap/b2b-lead-agent-auth-access-control-decision-packet.md`.
- Current productization level: `LEVEL_0_COMPLETE`.
- Target productization level: `LEVEL_1_PRODUCTION_REVIEWER_WORKFLOW`.
- Runtime/UI/API/schema/database behavior changed by this packet: none.
- Privacy/retention implementation performed by this packet: no.
- PII detection, redaction, purge/delete, or export-control implementation:
  no.
- Staging execution performed by this packet: no.
- Production proof performed by this packet: no.
- Production deploy performed by this packet: no.
- CRM/outreach/LLM/automation action performed by this packet: no.
- Generated suggestion persistence/history/export/attribution: forbidden.

```yaml
b2b_lead_agent_privacy_retention_decision_packet:
  document_status: PRIVACY_RETENTION_DECISION_PACKET_CREATED_DOCS_ONLY
  human_decision: PREPARE_PRIVACY_RETENTION_DECISION_PACKET_DOCS_ONLY
  repository: dooosp/b2b-lead-agent
  default_branch: master
  inspected_origin_master: "d209a69114e9641cf4ec3f263d4533cc41ba047e"
  controlling_roadmap: docs/roadmap/b2b-lead-agent-productization-roadmap-v1.md
  controlling_readiness_packet: docs/roadmap/b2b-lead-agent-production-reviewer-workflow-readiness-packet.md
  controlling_auth_access_packet: docs/roadmap/b2b-lead-agent-auth-access-control-decision-packet.md
  current_productization_level: LEVEL_0_COMPLETE
  target_productization_level: LEVEL_1_PRODUCTION_REVIEWER_WORKFLOW
  privacy_retention_decision: OPTION_C_NEEDS_HUMAN_PRIVACY_OWNER_DECISION
  production_reviewer_workflow_ready: BLOCKED
  privacy_retention_implementation_ready: false
  privacy_retention_implementation_performed: false
  pii_detection_implemented: false
  redaction_implemented: false
  purge_delete_implemented: false
  export_control_implemented: false
  staging_execution: HOLD
  production_proof: HOLD
  production_deploy: HOLD
  crm_outreach_llm_automation: FORBIDDEN
  next_recommended_cycle: PRIVACY_OWNER_INPUT_REQUEST_DOCS_ONLY
  next_decision: HOLD
```

## 1. Purpose

Productization Roadmap v1 moved the repo from the closed Manual Review Notes v1
local/test lane into a B2B Lead Agent productization path. The Production
Reviewer Workflow Readiness Packet concluded that Level 1 production reviewer
workflow remains blocked. The Auth / Access Control Decision Packet then
concluded that the C2 local/test role stub is not real production auth and that
privacy/retention remains a blocker before implementation, production proof,
manager dashboard expansion, export/API expansion, CRM planning, outreach, LLM
use, outcome learning, or automation.

This packet prepares the privacy/retention decision layer only. It defines
current repo-visible privacy state, data classification, retention posture,
redaction/PII options, deletion/purge boundaries, export/API/manager visibility
rules, identity/attribution implications, evidence/log handling, future tests,
and unresolved owner approvals.

This packet is not:

- privacy enforcement implementation;
- PII detection implementation;
- redaction implementation;
- retention or purge job implementation;
- export control implementation;
- auth or access-control implementation;
- production execution;
- production proof;
- staging execution;
- CRM, outreach, LLM, outcome-learning, or automation work;
- permission to access production or staging systems.

Current status remains `HOLD`.

## 2. Repo And Privacy-Surface Inventory

Audited source records:

| Area | Repo-visible finding |
| --- | --- |
| Productization Roadmap v1 | `docs/roadmap/b2b-lead-agent-productization-roadmap-v1.md` sets `CURRENT_PRODUCTIZATION_LEVEL: LEVEL_0_COMPLETE`, `NEXT_TARGET_LEVEL: LEVEL_1_PRODUCTION_REVIEWER_WORKFLOW`, and keeps staging/proof/deploy on `HOLD`. |
| Production Reviewer Workflow Readiness Packet | `docs/roadmap/b2b-lead-agent-production-reviewer-workflow-readiness-packet.md` concludes `PRODUCTION_REVIEWER_WORKFLOW_READY: BLOCKED` due to auth/access-control, production D1, privacy/retention, rollback/backout, observability/evidence, and production proof blockers. |
| Auth / Access Control Decision Packet | `docs/roadmap/b2b-lead-agent-auth-access-control-decision-packet.md` concludes `AUTH_ACCESS_CONTROL_DECISION: OPTION_C_NEEDS_HUMAN_SECURITY_DECISION`, records that C2 local/test role stub is not production auth, and recommends `PRIVACY_RETENTION_DECISION_PACKET_DOCS_ONLY`. |
| Lead Action Intelligence v1 | `docs/lead-action-intelligence-v1.md` defines deterministic reviewer guidance from existing LeadBrief fields only. It is not LLM, outreach, CRM mutation, or automation. |
| Reviewer Action Queue | `docs/lead-action-intelligence-v1.md` and `worker/lib/lead-action-intelligence.js` define deterministic queue lanes, sorting, filters, compact summaries, and generated reviewer note suggestions. |
| Lead Review Session | `/leads` page code and tests cover current-filter progress, lane counts, next-lead focus, and explicit review-status actions. |
| Manual Review Notes v1 | `docs/roadmap/manual-review-notes-v1-non-production-cycle-closeout.md` records local/test `SHIP`: save/read/edit/clear, note timestamp, fixed generic author label, metadata-only history, privacy warning, and C2 local/test role stub. |
| Existing Manual Review Notes retention/privacy packet | `docs/roadmap/manual-review-notes-v1-retention-privacy-policy-decision-packet.md` is Manual Review Notes-specific and keeps production HOLD. It does not approve enforcement, purge/delete jobs, redaction, automated PII detection, export expansion, manager visibility, old/new note text history, generated suggestion retention/history, or production action. |
| Data semantics packet | `docs/roadmap/manual-review-notes-v1-data-semantics-decision-packet.md` defines `manualReviewNotes`, `manualReviewNotesUpdatedAt`, generated suggestion exclusion, and follow-up packets. |
| Reviewer identity / author attribution packet | `docs/roadmap/manual-review-notes-v1-reviewer-identity-decision-packet.md` permits only the local/test fixed `manual_reviewer` label; real identity remains unimplemented and unapproved. |
| Note history / versioning packet | `docs/roadmap/manual-review-notes-v1-note-history-versioning-decision-packet.md` records H2 metadata-only history. Old/new note text, generated suggestion history, full history, audit-grade history, and production action remain unapproved. |
| Access / visibility / export packet | `docs/roadmap/manual-review-notes-v1-access-visibility-export-decision-packet.md` keeps manager visibility, export expansion, API expansion, and full metadata visibility unapproved. |
| Access-control plan and C2 role stub | `docs/roadmap/manual-review-notes-v1-access-control-plan.md` and `worker/lib/manual-review-notes-access.js` record only opt-in local/test role checks. The access metadata reports `realAuthImplemented: false` and `productionReady: false`. |
| Protected fields | `worker/lib/manual-review-notes-access.js` treats `notes`, `manualReviewNotes`, `manualReviewNotesAuthorLabel`, `manualReviewNotesUpdatedAt`, and metadata-history summary fields as protected under the local/test role stub. |
| Export/API surfaces | `worker/api/leads.js` owns `/api/leads`, `/api/leads/:id`, and `/api/export/csv`; `worker/api/serializers/lead-csv.js` has existing CSV compatibility for the `notes` / `manualReviewNotes` value. That compatibility is not a production privacy/export approval. |
| Manual notes storage | `worker/schema.sql`, `worker/db/schema.js`, `worker/db/leads.js`, and `worker/db/transform.js` show current manual note value backed by `leads.notes`, local/test note timestamp/author columns, and `manual_review_note_events` metadata-only events. |
| Privacy warning | `worker/pages/leads.js` and `worker/pages/lead-detail.js` render static local/test warning copy. The API does not detect, block, redact, or add sensitive-content warning fields. |
| Generated suggestion boundary | `worker/db/leads.js` rejects generated reviewer note suggestion persistence fields on PATCH and clears generated note-like text from batch refresh paths. Tests cover non-persistence, non-attribution, non-history, and non-clear behavior. |
| Local fake-D1 evidence | `docs/roadmap/manual-review-notes-v1-local-fake-d1-dry-run-evidence.md` records local/fake-D1 evidence only. It is not staging evidence or production proof. |
| Non-production closeout | `docs/roadmap/manual-review-notes-v1-non-production-cycle-closeout.md` closes local/test as `SHIP`, keeps staging/proof/deploy on `HOLD`, and sets no mandatory next action for that feature lane. |
| Feedback | `docs/roadmap/manual-review-notes-v1-feedback-record-001-disposition.md` records `MRN-V1-FEEDBACK-001` as P3/docs/no-follow-up. No newer human feedback was found in the prior batch inspection. |
| Staging readiness/prerequisites | PR #147 and PR #148 docs keep staging target, D1 identity, endpoint allowlist, command allowlist, fixture manifest, evidence path, rollback owner, and explicit execution approval unresolved. |
| Production readiness gap/proof/rollback | Production readiness, proof, D1 migration, and rollback/backout docs are plan-only and not approved for execution. |
| Package scripts | `package.json` exposes `check:naming`, `check:schema`, `eval:lead-quality`, `test:e2e:local`, `test:root`, `test:unit`, `test:contract`, `test:worker`, and `test`. |
| CI workflows | `.github/workflows/ci.yml` runs schema, synthetic eval, tests, and local-only Worker E2E. `.github/workflows/validate-naming.yml` runs naming and worker tests. `.github/workflows/generate-report.yml` can run the lead report pipeline and email in GitHub Actions, but this packet does not trigger it. |
| GitHub PR state | Pre-edit GitHub inspection found no open PRs. Recent related merged PRs include #147, #148, #149, #150, and #151. |

## 3. Current Privacy State

Current repo-visible privacy state:

- `manualReviewNotes` is reviewer-entered text backed by the existing
  `leads.notes` value.
- Manual notes may contain sensitive information if a reviewer enters it.
- The current privacy warning is static reviewer guidance only.
- The current privacy warning is not detection.
- The current privacy warning is not redaction.
- The current privacy warning is not retention enforcement.
- The current privacy warning is not purge enforcement.
- The current privacy warning is not compliance proof.
- Manual note body history is not stored in metadata-only history.
- `manual_review_note_events` stores metadata-only create/edit/clear events:
  lead relationship, event type, timestamp, and fixed generic author label.
- `manual_review_note_events` does not store old note text, new note text,
  generated suggestion text, redacted content, summaries, or real reviewer
  identity.
- `manualReviewNotesAuthorLabel` is generic and non-PII when present; the only
  accepted current value is `manual_reviewer`.
- Real reviewer identity is not implemented.
- The C2 local/test role stub is not real auth, not a production role model,
  and not production access-control proof.
- Production privacy proof does not exist.
- Legal/privacy approval does not exist in repo-visible evidence.
- Export/API privacy policy is not finalized.
- Manager visibility policy for manual note text and metadata is not finalized.
- CRM, outreach, outcome learning, and automation data use policies are not
  finalized and remain forbidden or future-only.

## 4. Data Classification

Classification values are intentionally conservative. If repo-visible evidence
does not prove a policy, the value is `unknown` or
`future_decision_required`.

| Data field or surface | DATA_CATEGORY | PRIVACY_RISK | CURRENT_STORAGE_STATUS | RETENTION_DECISION | EXPORT_ALLOWED | Repo-visible notes |
| --- | --- | --- | --- | --- | --- | --- |
| Lead public/business fields | business_lead_data | low | stored | keep_current | yes | Existing LeadBrief fields such as company, product, score, status, review status, sources, confidence, assumptions, data gaps, and evidence are stored and already appear in API/UI/CSV surfaces. |
| Lead private/person fields | business_lead_data | high | unknown | needs_policy | future_decision_required | Repo fields can include buyer role, evidence, source quotes, notes, and context that may contain personal or private business data. No privacy owner policy is finalized. |
| `manualReviewNotes` | reviewer_entered_text | high | stored | needs_policy | future_decision_required | Human-entered current note text may contain sensitive information. It is backed by `leads.notes`; production retention/export policy is not approved. |
| `manualReviewNotesUpdatedAt` | metadata | medium | stored | needs_policy | future_decision_required | Note-specific last accepted manual-note change/save/clear timestamp; not proof of production audit. |
| `manualReviewNotesAuthorLabel` | metadata | medium | stored | needs_policy | future_decision_required | Current fixed value `manual_reviewer` is generic and non-PII, but broader visibility and retention still need policy. |
| `manual_review_note_events` | metadata | medium | metadata_only | needs_policy | future_decision_required | Local/test metadata-only event table; no note text or real identity. Retention duration is unresolved. |
| Generated reviewer note suggestion text | generated_helper_text | medium | copy_only | forbidden | no | Deterministic helper text is response/UI helper content only. It must not be persisted as manual note text, history, export, or attribution. |
| Generated suggestion copy action | metadata | low | not_stored | not_applicable | not_applicable | Copy controls are local UI affordances; repo docs state browser-memory/session behavior only where applicable. |
| Reviewer Action Queue fields | metadata | medium | not_stored | keep_current | not_applicable | Deterministic response metadata from current leads. Contains queue lanes, priorities, summaries, risk/missing-info guidance, and note suggestion references. |
| Lead Review Session fields | metadata | medium | not_stored | keep_current | not_applicable | Deterministic response/session metadata for reviewer progress and next-lead focus; no production privacy policy for broader exposure. |
| Lead Action Intelligence v1 guidance fields | generated_helper_text | medium | not_stored | keep_current | not_applicable | Deterministic reviewer guidance from existing fields only; not LLM, CRM, outreach, or automation. |
| Manager dashboard fields | metadata | medium | not_stored | needs_policy | future_decision_required | Current Manager / Reviewer Summary v0 uses aggregate/filter metadata only. Manual note text and metadata expansion remain blocked. |
| Export/API fields | unknown | unknown | unknown | needs_policy | future_decision_required | Existing API/CSV compatibility is not a finalized privacy/export policy for Level 1 production reviewer workflow. |
| CRM-linked fields, future only | CRM_external_data | high | future_only | future_decision_required | future_decision_required | CRM read-only mapping is future-only; CRM mutation is forbidden. |
| Outreach-linked fields, future only | outreach_external_data | high | future_only | future_decision_required | future_decision_required | Outreach draft/send remains forbidden; no email/message send is approved. |
| Outcome learning fields, future only | outcome_data | high | future_only | future_decision_required | future_decision_required | Outcome learning depends on privacy/data governance and source-of-truth decisions. |
| Auth identity fields, future only | identity_data | high | future_only | future_decision_required | future_decision_required | Real reviewer identity, display names, emails, roles, sessions, and API-client scopes are not implemented. |
| Audit fields, future only | audit_data | high | future_only | future_decision_required | future_decision_required | Audit-grade attribution and event retention require auth, privacy, retention, legal, and production proof decisions. |
| Logs and evidence artifacts | log_or_evidence_data | high | stored | needs_policy | not_applicable | Docs, PRs, CI, and local evidence may be retained. Future evidence must redact secrets, tokens, customer payloads, note bodies, and private data. |

## 5. Manual Notes Privacy Policy

Manual Review Notes v1 policy boundaries for current and future work:

- `manualReviewNotes` is reviewer-entered text and may contain sensitive
  information.
- Reviewers should be warned not to enter unnecessary personal, confidential,
  regulated, customer-private, or deal-private data.
- Static warning is not enforcement.
- Manual note body history must remain avoided unless a future
  privacy/retention decision explicitly allows it.
- Metadata-only history must not store old note text.
- Metadata-only history must not store new note text.
- Metadata-only history must not store generated suggestion text.
- Metadata-only history must not store real reviewer identity.
- Generated suggestion text must not be persisted as manual note text.
- Generated suggestion text must not enter manual note history.
- Generated suggestion text must not be exported as human-authored note text.
- Generated suggestion text must not receive human author attribution.
- Real reviewer identity attribution must not be added without auth,
  privacy/retention, access-control, and production proof approval.
- Existing clear behavior must be described truthfully as clearing the current
  saved note value, not as full retention purge or legal deletion.

## 6. Retention Policy Decision

Current retention posture is decision-ready only. Production retention,
deletion, purge, export, and privacy proof are not implemented or approved.

| Item | Current state | Proposed retention posture | Unresolved decision | Required owner | Implementation required later | Production proof required later | Deletion/purge requirement | Export restriction |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `manualReviewNotes` | Stored current value in `leads.notes` when human-entered text is saved. | Keep local/test current value until explicit clear; production needs policy. | Retention duration, allowed content, production storage approval, export policy. | Privacy owner, retention owner, product owner, DB owner. | yes | yes | future decision | yes |
| `manualReviewNotesUpdatedAt` | Stored nullable timestamp for last accepted note create/edit/clear. | Keep local/test metadata; production retention duration needs policy. | Whether metadata survives clear/delete and how long. | Retention owner, product owner. | yes if policy changes | yes | future decision | future decision |
| `manualReviewNotesAuthorLabel` | Stored nullable fixed generic `manual_reviewer` label after accepted changes. | Keep generic local/test label only; no real identity. | Whether generic metadata is retained/exported and whether real identity is allowed later. | Privacy owner, auth owner, retention owner. | yes if policy changes | yes | future decision | future decision |
| `manual_review_note_events` | Metadata-only events: lead id, event type, changed_at, fixed generic label. | Keep local/test metadata-only history without audit/legal claim. | Retention duration, whether events survive clear/delete, whether full event list is exposed. | Privacy owner, retention owner, product owner. | yes if policy changes | yes | future decision | future decision |
| Generated reviewer note suggestion text | Copy-only response/UI helper text; rejected as PATCH persistence and cleared from batch-generated note-like fields. | Retention forbidden as manual note/history/attribution/export. | None for current boundary; future generated content use would need separate approval. | Product owner, privacy owner. | no | no | no | yes |
| Generated suggestion copy event | No durable copy event in repo-visible implementation. | Not retained. | Whether future analytics/audit should track copy events. | Product owner, privacy owner. | future decision | future decision | future decision | not_applicable |
| Lead Review Session data | Computed response/session guidance from current lead collection. | Keep non-persistent deterministic guidance. | Whether any future session analytics are retained. | Product owner, privacy owner. | future decision | future decision | future decision | future decision |
| Reviewer Action Queue data | Computed response metadata from current leads. | Keep non-persistent deterministic queue guidance. | Whether future queue metrics are retained/exported. | Product owner, privacy owner. | future decision | future decision | future decision | future decision |
| Manager dashboard data | Current summary is aggregate/filter metadata only. | Prefer aggregate manager metrics over note text. | Whether managers may see note text, metadata, or aggregates only. | Product owner, privacy owner, auth owner. | yes for expansion | yes | future decision | yes |
| Export/API data | Current API/CSV compatibility exists; no Level 1 production privacy policy. | Do not expand export/API visibility for manual notes until approved. | Field allowlist, role/scope model, redaction, retention of exported copies. | Product owner, privacy owner, auth owner. | yes for expansion | yes | future decision | yes |
| CRM-linked data, future only | Not implemented. | Future decision required; CRM mutation remains forbidden. | CRM field allowlist, credentials, customer-data boundary, note/private-field exposure. | CRM owner, privacy owner, product owner. | yes | yes | future decision | yes |
| Outreach draft/send data, future only | Not implemented; outreach send forbidden. | Future decision required; no draft/send now. | Consent, recipients, suppression, message retention, generated/human boundaries. | Outreach owner, privacy owner, product owner. | yes | yes | future decision | yes |
| Outcome learning data, future only | Not implemented. | Future decision required. | Outcome taxonomy, allowed sources, bias/data quality, retention. | Product owner, privacy owner, data owner. | yes | yes | future decision | yes |
| Logs | No production/staging logs inspected by this packet. | Do not capture note text, private payloads, secrets, or customer data in logs/evidence. | Production observability policy and redaction rules. | Ops owner, privacy owner, security owner. | yes for production | yes | future decision | yes |
| Local/test fixtures | Synthetic/fake-D1 only. | Keep fixture-only and avoid real/customer PII. | Fixture retention and redaction if examples become realistic. | Engineering owner. | no for docs | no | no | not_applicable |
| Evidence artifacts | Docs, PRs, CI, and local evidence only. | Retain only redacted, non-production evidence. | Evidence storage location, review period, redaction approval, owner. | Evidence owner, privacy owner. | yes for production | yes | future decision | not_applicable |

## 7. Redaction / PII Handling Decision

This packet does not implement redaction. It documents decision options only.

| Option | Benefits | Risks | Implementation complexity | False positive / false negative risk | Reviewer UX impact | Production readiness impact | Test requirements | Privacy/legal review needs | Recommended now |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Option A: Static warning only, continue current behavior | Lowest blast radius; truthful to current local/test implementation. | Sensitive content can still be saved if reviewers type it; no enforcement or compliance proof. | None. | Not applicable because no detection exists. | Low friction. | Keeps production blocked. | Existing warning visibility and no-enforcement tests. | Privacy owner must accept risk before production. | No as production decision; yes as current local/test baseline. |
| Option B: Client-side warning plus reviewer self-policing | Adds expectation-setting near note entry. | Reviewers can ignore warning; still no detection or purge. | Low. | Not applicable unless patterns are added. | Low. | Insufficient alone for production proof. | UI copy/regression tests and no-behavior-change tests. | Privacy/product approval needed. | Not enough for production. |
| Option C: Server-side PII detection before save | Can block or warn on risky content before storage. | Detection can miss sensitive data or block useful text; may create false confidence. | Medium to high. | High false positive and false negative risk. | Medium to high depending on blocking/override. | Could support production only with policy and proof. | PII fixtures, false positive/negative cases, override/clear behavior, logs/evidence checks. | Privacy/legal required. | No. Future decision. |
| Option D: Redaction before storage | Limits stored sensitive content if redaction works. | Redaction can damage useful context, miss data, or retain originals in logs/errors. | High. | High false positive and false negative risk. | Medium. Reviewers need visible redaction semantics. | Requires proof, monitoring, rollback, and legal review. | Redaction fixtures, storage assertions, export/log tests, evidence redaction tests. | Privacy/legal required. | No. Future decision. |
| Option E: Retention-limited storage plus purge workflow | Limits long-term exposure and supports deletion expectations. | Requires clocks, jobs, idempotency, user copy, evidence, and failure handling. | High. | Detection risk only if paired with detection; purge risk is missed/stale data. | Medium. Users need clear expectations. | Could support production after owner signoff and proof. | Retention clock, purge idempotency, clear-vs-expiry, stale summary, export/log tests. | Privacy/legal/ops required. | No. Future decision. |
| Option F: No manual note body storage in production until privacy approval | Strongest current blocker; avoids production note-text risk until owners decide. | Production reviewer workflow may lose valuable reviewer context. | Low now; later implementation depends on selected replacement. | Not applicable. | High if production reviewers need saved notes. | Keeps production blocked but safer. | Regression that production docs/claims remain blocked. | Privacy owner approval required to change. | Candidate default blocker if owner input is missing. |

Recommended current decision:

`PRIVACY_RETENTION_DECISION: NEEDS_HUMAN_PRIVACY_OWNER_DECISION`

Repo-visible evidence does not resolve privacy owner, retention duration, PII
handling, deletion/purge policy, export/API visibility, manager visibility,
real identity retention, or production proof requirements.

## 8. Export / API / Manager Visibility Boundary

Manager/export/API expansion remains blocked until explicit privacy,
retention, and access-control decisions are recorded.

Required boundary:

- Manual note text should not be exposed through manager dashboard, exports, or
  APIs unless explicitly approved by privacy/product/access owners.
- Existing CSV compatibility for the `notes` / `manualReviewNotes` value must
  be treated as a current compatibility risk to audit, not as a production
  privacy/export policy.
- Metadata-only fields may still require policy before manager/export/API
  exposure because event timing, lead relationship, and update metadata can be
  sensitive.
- Generated suggestion text must not be exported as human-authored content.
- Generated suggestion text must not be exported as saved manual note text.
- Future CRM/outreach/outcome-learning fields must not be exposed without
  separate decisions.
- Aggregate manager metrics should be preferred over manual note text exposure
  when possible.
- API clients and exports require separate role/scope, field allowlist,
  redaction, evidence, and retention decisions.

## 9. Identity / Attribution Privacy Bridge

Current identity state:

- `manualReviewNotesAuthorLabel` is generic and non-PII.
- The only current accepted stored value is `manual_reviewer`.
- Real authenticated reviewer identity is not implemented.
- The C2 local/test role stub is header-driven local/test behavior only and
  explicitly reports `realAuthImplemented: false` and `productionReady: false`.

Future implications:

- Storing real identity creates privacy and retention obligations.
- Reviewer display names, emails, user IDs, role names, session IDs, API client
  IDs, and audit actor IDs may be identity data or personal data.
- Audit-grade attribution requires explicit auth, privacy, retention,
  access-control, evidence, and production proof decisions.
- API/client/service identity must be separately classified from human reviewer
  identity.
- No real identity storage should be implemented from this packet.

## 10. Evidence And Logs Policy

Acceptable current evidence:

- repo-visible docs;
- PR descriptions and comments that do not contain secrets or private payloads;
- local tests and CI logs from fixture/synthetic data;
- local fake-D1 evidence already recorded in docs;
- source inspection of tracked files;
- GitHub PR/check metadata.

Acceptable future production privacy evidence, only after separate approval:

- exact approved command transcript;
- redacted production proof checklist;
- approved evidence storage path;
- proof that note text, private lead/person fields, secrets, tokens, cookies,
  auth headers, and payload fragments were not captured;
- owner signoff from privacy, product, ops, DB, auth/security, and evidence
  owners as applicable.

Docs, PRs, CI, and local fixtures are not production privacy proof because they
do not observe production identity, production D1, production sessions,
production role enforcement, production note data, production deletion
behavior, production logs, production evidence handling, or legal/privacy
approval.

Future evidence must never capture:

- secrets;
- tokens;
- cookies;
- auth headers;
- customer payloads;
- private lead/person fields;
- manual note body text from real users;
- production logs;
- staging logs;
- unredacted request/response payloads;
- CRM payloads;
- outreach recipient data;
- LLM prompts or responses;
- private URLs or database IDs unless redacted.

Future evidence redaction requirements:

- redact names, emails, phone-like values, account identifiers, CRM IDs,
  opportunity IDs, private URLs, auth/session metadata, note text, generated
  suggestion text, customer context, and payload fragments;
- keep GitHub URLs and repo-local file paths only when they do not expose
  private data;
- never use local/customer data as examples for privacy scanner fixtures.

## 11. Deletion / Purge Decision

Current clear/delete-as-empty-string is not the same as retention purge.

Definitions:

- Current manual note clear/delete-as-empty-string: the reviewer saves
  `manualReviewNotes: ""`, which clears the current saved note text, updates
  note-specific timestamp metadata for accepted changes, and appends a
  metadata-only clear event in local/test behavior.
- True retention purge: an explicit retention system removes data according to
  a policy, schedule, owner approval, and evidence requirements.
- Audit/event deletion: removing, preserving, compacting, or tombstoning event
  metadata according to an approved audit/retention policy.
- Legal deletion: deletion driven by legal/privacy rights, exceptions, legal
  holds, or compliance process.
- Production data deletion: approved production operation with exact commands,
  owners, stop conditions, rollback/backout, evidence handling, and proof.

Current policy statements:

- Current manual note clear behavior is not a full retention/purge system.
- Current clear behavior must not be described as legal deletion.
- Current clear behavior must not be described as production purge.
- True deletion/purge requires future policy and implementation.
- Metadata-only events may still need retention limits.
- Existing exported copies, screenshots, logs, PR artifacts, and evidence
  artifacts may create separate retention obligations if they include note text
  or metadata.
- Production deletion/purge must not be implemented or claimed now.

## 12. Privacy Test Plan

Future tests required before privacy/retention implementation:

- privacy warning is visible near manual note entry;
- generated suggestion cannot be persisted;
- generated suggestion cannot enter history, export, or attribution;
- manual note body history is not stored unless explicitly approved;
- metadata-only history contains no old note text and no new note text;
- metadata-only history contains no generated suggestion text;
- metadata-only history contains no real reviewer identity unless explicitly
  approved;
- manager/API/export surfaces omit protected manual note fields unless
  approved;
- missing/unknown role cannot access protected fields;
- unauthorized write does not leak sensitive data;
- logs/evidence do not include manual note text or private payloads;
- clear/delete copy distinguishes current-value clearing from purge;
- deletion/purge behavior is tested only after explicit implementation
  approval;
- PII detection tests exist only if PII detection is later approved;
- redaction tests exist only if redaction is later approved;
- retention clock/purge job tests exist only if retention enforcement is later
  approved;
- export inclusion tests exist only after export policy approval; until then,
  tests should assert omission or no-expansion for protected fields.

## 13. Privacy Owner / Approval Model

Unresolved owner questions:

- Who owns privacy decisions?
- Who owns retention duration?
- Who owns deletion/purge policy?
- Who owns export/API policy?
- Who owns manager visibility policy?
- Who approves real reviewer identity attribution?
- Who approves production privacy proof?
- Who approves CRM/outreach/outcome-learning data use?
- Who owns evidence retention and redaction?
- Who owns incident response if sensitive note text is accidentally retained or
  exposed?

Owner response template:

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
```

This packet does not fill those values. They require human owner input.

## 14. CRM / Outreach / Outcome Learning Bridge

CRM:

- CRM read-only planning may remain future-only.
- Manual note/private-field exposure must be decided before CRM mapping.
- CRM field allowlists, credentials, external IDs, owner mappings, and customer
  payload boundaries require separate owner approval.
- CRM mutation remains forbidden.

Outreach:

- Outreach draft implementation remains forbidden.
- Outreach send remains forbidden.
- No email or message send is approved.
- Generated suggestions are not outreach drafts and must not become sent
  content without separate policy and product approval.

Outcome learning:

- Outcome learning depends on privacy/data governance decisions.
- Outcome learning must not use manual note text, generated suggestions, CRM
  private data, outreach outcomes, or customer data without explicit approval.
- Outcome taxonomy, bias/data quality, retention, and source-of-truth policy are
  future decisions.

Manager dashboard and automation:

- Manager dashboard depends on privacy/access-control decisions.
- Manager-facing aggregate metrics should be preferred over manual note text
  exposure.
- Automation policy engine depends on privacy, access-control, outcome-data
  governance, monitoring, rollback, and explicit human approval.

## 15. Recommended Decision

Recommended decision:

`PRIVACY_RETENTION_DECISION: OPTION_C_NEEDS_HUMAN_PRIVACY_OWNER_DECISION`

Rationale:

- Repo-visible evidence does not identify a privacy owner.
- Repo-visible evidence does not identify a retention owner.
- Manual note retention duration is not approved for production.
- Metadata event retention duration is not approved for production.
- PII handling is warning-only and not enforcement.
- Redaction is not implemented or approved.
- Purge/delete behavior is not implemented or approved.
- Export/API/manual note visibility policy is not finalized.
- Manager manual note visibility is not finalized.
- Real reviewer identity retention is not approved.
- Production privacy proof does not exist.
- Legal/privacy/compliance approval does not exist.

Decision options:

- `OPTION_A_STATIC_WARNING_ONLY_CONTINUES`: truthful current local/test state,
  but insufficient for production.
- `OPTION_B_DECISION_READY_FOR_IMPLEMENTATION_PLAN`: not supported because
  owner, retention, PII, deletion, export, identity, and production proof
  decisions are missing.
- `OPTION_C_NEEDS_HUMAN_PRIVACY_OWNER_DECISION`: recommended now.
- `OPTION_D_NEEDS_LEGAL_OR_COMPLIANCE_REVIEW`: likely true for production note
  body storage, but legal review owner is not identified yet.
- `OPTION_E_NEEDS_DATA_RETENTION_OWNER_INPUT`: true, but narrower than the full
  missing owner set.
- `OPTION_F_BLOCK_PRODUCTION_MANUAL_NOTES_BODY_STORAGE`: safe fallback if
  privacy owner input remains missing before production reviewer workflow.

## 16. Final Recommendation

```text
PRIVACY_RETENTION_DECISION_PACKET: CREATED
CURRENT_PRODUCTIZATION_LEVEL: LEVEL_0_COMPLETE
TARGET_PRODUCTIZATION_LEVEL: LEVEL_1_PRODUCTION_REVIEWER_WORKFLOW
PRODUCTION_REVIEWER_WORKFLOW_READY: BLOCKED
PRIVACY_RETENTION_IMPLEMENTATION_READY: NO
PRIVACY_RETENTION_IMPLEMENTATION_PERFORMED: NO
PII_DETECTION_IMPLEMENTED: NO
REDACTION_IMPLEMENTED: NO
PURGE_DELETE_IMPLEMENTED: NO
EXPORT_CONTROL_IMPLEMENTED: NO
STAGING_EXECUTION: HOLD
PRODUCTION_PROOF: HOLD
PRODUCTION_DEPLOY: HOLD
CRM_OUTREACH_LLM_AUTOMATION: FORBIDDEN
NEXT_RECOMMENDED_CYCLE: PRIVACY_OWNER_INPUT_REQUEST_DOCS_ONLY
NEXT_DECISION: HOLD
```

This packet should not unlock implementation. The correct next move is human
privacy/retention owner input. Only after owner decisions are recorded should
the repo consider a docs-only implementation plan for privacy/retention,
auth/access-control, production D1 observation request, CRM read-only planning,
manager dashboard expansion, export/API expansion, outreach, LLM, outcome
learning, or automation.
