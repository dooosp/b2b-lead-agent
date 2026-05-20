# Manual Review Notes V1 Access / Visibility / Export Decision Packet

This packet prepares Manual Review Notes v1 access, visibility, API, and export
decisions after the docs-only production readiness gap packet in PR #131. It is
documentation only. It does not implement access control, manager visibility,
exports, API exposure, runtime/UI/schema behavior, retention/privacy
enforcement, production proof, production deploy, production D1 access, or
production endpoint calls.

## Document Status

- Document status: `DRAFT_NOT_APPROVED`.
- Approval record:
  `https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4493367361`.
- Repository: `dooosp/b2b-lead-agent`.
- Default branch: `master`.
- Post-PR131 baseline inspected:
  `6619419a31558d05e26aa162d65386b3aa0c5672`.
- Scope: docs-only access, visibility, API, metadata-history visibility, export,
  generated-suggestion boundary, and access-control prerequisite decision packet.
- Runtime behavior changed by this packet: none.
- UI behavior changed by this packet: none.
- Schema/API behavior changed by this packet: none.
- D1 migration performed by this packet: none.
- Export behavior changed by this packet: none.
- Production action performed by this packet: none.
- Production readiness claim made by this packet: none beyond "access,
  visibility, and export packet prepared."

```yaml
manual_review_notes_v1_access_visibility_export_packet:
  document_status: DRAFT_NOT_APPROVED
  approval_record: "https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4493367361"
  scope: DOCS_ONLY_DECISION_PACKET
  post_pr131_baseline: "6619419a31558d05e26aa162d65386b3aa0c5672"
  implementation_approved: false
  production_approved: false
  access_control_implemented: false
  manager_visibility_implemented: false
  export_expansion_implemented: false
  api_expansion_implemented: false
  generated_suggestion_export_or_persistence: FORBIDDEN
```

## 1. Current Local/Test State

Completed local/test and decision-record state:

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

Current implementation semantics:

- Current manual note field: `manualReviewNotes`.
- Current provenance:
  `manualReviewNotesProvenance: "human_entered"` only when non-empty saved
  manual note text exists.
- Current timestamp: `manualReviewNotesUpdatedAt`, backed by
  `manual_review_notes_updated_at`.
- Timestamp meaning: last accepted human-entered manual note change/save/clear
  event.
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
- Current clear behavior: `manualReviewNotes: ""` clears the saved current note
  value, updates the note-specific timestamp, keeps generic author attribution
  for accepted manual-note changes, and appends a metadata-only clear event.
- Current privacy warning: static local/test reviewer guidance only. It does
  not detect, block, redact, enforce retention, purge data, or create
  production compliance evidence.
- Current generated suggestion boundary: generated reviewer note suggestions
  are copy-only, unsaved, unattributed, unretained, unexported, excluded from
  history, and not human-authored saved notes.
- Current production status: no production proof and no production deploy.

## 2. Problem Statement

Manual Review Notes v1 is strong locally, but access, visibility, API, and export
semantics are not established. Before production proof, broader product use, or
manager/API/export expansion can be meaningful, the project needs explicit
answers for:

- Who can see current manual note text?
- Who can see the note-specific timestamp?
- Who can see the generic author label?
- Who can see metadata-only history count or events?
- Should managers see manual notes?
- Should exports include manual notes?
- Should exports include metadata history?
- Should APIs expose notes to non-reviewer consumers?
- What role/auth model is required?
- How should generated reviewer suggestions remain excluded?
- What privacy/retention gates apply before production?

Without those decisions, future work could expose sensitive operator-entered
note text through a manager view, CSV export, API consumer, report, evidence
packet, or history view before the repo has approved roles, access controls,
retention policy, privacy ownership, export semantics, or production evidence
handling.

## 3. Option Matrix: Reviewer Visibility

| Option | Value | Risk | Privacy impact | Auth/access prerequisite | UI impact | API impact | Tests needed | Production implication | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| V0: no saved manual notes visible beyond local/test reviewer workflow | Preserves the current no-expansion boundary. | Reviewers outside the existing local/test surfaces cannot use saved note context. | Lowest because visibility stays constrained to current local/test behavior. | None beyond current local/test flow. | No new UI. Existing surfaces stay as-is. | No new API exposure. | Docs/status checks plus regression that no new surfaces are added. | Production saved-note visibility remains HOLD. | Safe default if no access decision is ready. |
| V1: reviewer-only current note visibility | Gives reviewers the saved human-entered current value. | Reviewer role may be ambiguous without auth; note text can contain sensitive sales context. | Medium because current note text is visible to a defined reviewer surface. | Approved reviewer role or local/test-only reviewer surface. | Show only current note text, with empty/cleared state copy. | Limit to reviewer workflow payloads if implemented later. | Authorized reviewer visibility, unauthorized absence, clear-state, and generated-suggestion exclusion tests. | Candidate only after role/access gates for production. | Acceptable local/test concept, production HOLD. |
| V2: reviewer-only current note plus timestamp/author metadata | Adds last accepted manual-note change time and fixed generic author label. | Metadata can be overread as audit or real identity if copy is sloppy. | Medium; text plus event metadata are visible. Generic label remains non-PII. | Reviewer role plus copy that `manual_reviewer` is not real/authenticated identity. | Show current note, `manualReviewNotesUpdatedAt`, and generic author label when present. | Expose only current note metadata to reviewer workflow consumers. | Current-note, timestamp, generic-label, no-real-identity, and clear-state tests. | Possible minimal future reviewer path after access/privacy approval. | Recommended local/test reviewer default if visibility is expanded beyond current surfaces. |
| V3: reviewer-only current note plus metadata-history summary | Adds event count or last event facts without full event list. | Summary can imply stronger history/audit than H2 provides. | Medium; no old/new note text, but event timing and lead relation become visible. | Reviewer role plus explicit metadata-only history copy. | Show count or last event summary only. | Expose only metadata summary fields to reviewer workflow consumers. | Metadata summary, no old/new text, no generated suggestion history, and clear-event tests. | Production HOLD until retention/access gates approve metadata visibility. | Also acceptable local/test default; prefer V2 unless reviewers need history summary. |
| V4: reviewer-only full metadata event list, no note text history | Lets reviewers inspect create/edit/clear event sequence. | Full event list may be mistaken for audit-grade history and can reveal activity timing. | Medium to high for metadata. It still excludes old/new note text. | Reviewer role, metadata retention policy, and no-audit-claim copy. | Add a metadata event list view with no note bodies. | Add gated metadata event list payload only if approved later. | Event-list authorization, no-content-retention, clear-event, generated-suggestion exclusion, and no-audit-copy tests. | Future gated only; not production-ready now. | Hold. Do not expose full metadata history yet. |

Recommended default: V2 or V3 local/test only if visibility must be clarified
for reviewers. Production remains HOLD until access-control, privacy/retention,
and API-surface gates are approved.

## 4. Option Matrix: Manager Visibility

| Option | Value | Risk | Privacy impact | Product value | Auth/role dependency | UI impact | Tests needed | Production implication | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M0: no manager visibility | Keeps manager surfaces from seeing manual note text or metadata. | Managers lack note-level context. | Lowest. | Low for manager workflows, high safety. | None. | No new manager UI. | Regression that manager summary excludes manual note text/metadata. | Production manager note visibility remains HOLD. | Recommended now. |
| M1: manager summary excludes manual notes | Preserves summary value from existing fields while excluding notes. | Managers may ask why note context is absent. | Low. | Moderate because current summary still works from existing review/queue data. | Existing manager/reviewer summary boundary only. | Manager summary continues to omit manual notes. | No-note-in-summary, no-history-in-summary, and export exclusion tests if touched later. | Safe production-planning posture, not production proof. | Recommended now if manager surfaces evolve. |
| M2: manager can see current manual note only | Supports manager review of latest human-entered context. | Sensitive note text reaches a broader role. | Medium to high. | High for coaching/handoff if notes are useful. | Approved manager role and reviewer-vs-manager policy. | Add current note rendering to manager-approved surface only. | Manager authorized, non-manager forbidden, current-note-only, clear-state, and generated-suggestion exclusion tests. | HOLD until privacy/access approval exists. | Do not add yet. |
| M3: manager can see current note plus timestamp/author metadata | Adds operational context for when a note changed. | Generic author label may be mistaken for real identity; metadata can look audit-grade. | Medium to high. | Higher than M2 for review operations. | Approved roles plus identity/metadata copy policy. | Add note text and current metadata. | Role tests, no-real-identity tests, metadata visibility tests, and no old/new text tests. | HOLD until access/privacy and copy approval. | Do not add yet. |
| M4: manager can see metadata-history summary | Gives managers event facts without note bodies. | Metadata can still reveal activity patterns and be overclaimed. | Low to medium. | Moderate for operations. | Approved manager metadata role and retention policy. | Add event count/last event summary, no note body. | Role tests, metadata-only tests, clear-event tests, and no-generated-suggestion-history tests. | Future gated. | Hold until metadata visibility is selected. |
| M5: manager can see full metadata event list, no old/new note text | Supports deeper manager review without old note text. | Full event list can become de facto audit view. | Medium to high for event metadata. | High for operations, potentially too broad for v1. | Strong role/access model, retention policy, and no-audit-claim copy. | Add gated event list UI. | Role/access, no-content, clear-event, retention, and export/log boundary tests. | Future gated only. | Do not choose for v1 default. |

Recommended default: M0 or M1 until access/privacy approval exists. No manager
visibility expansion is approved by this packet.

## 5. Option Matrix: Export / CSV Visibility

| Option | Value | Risk | Privacy impact | Retention implication | Schema/API impact | Tests needed | Production implication | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| E0: no export expansion | Prevents manual notes and metadata from spreading outside reviewer UI. | Exports lack note context. | Lowest. | No new exported retained copies. | None. | Regression that CSV/report/evidence exports do not add note fields. | Production export remains HOLD. | Recommended now. |
| E1: preserve existing export compatibility only | Avoids breaking existing export behavior while adding no new manual-note fields. | Existing exports must be audited if they already include generic notes. | Low to medium depending on current columns. | No new export retention beyond existing behavior. | None unless compatibility tests need docs updates. | CSV compatibility and no-new-note-field tests if export code changes later. | Acceptable as current compatibility posture, not production approval. | Recommended now with E0. |
| E2: export current manual note text only | Supports handoff of latest reviewer-entered text. | CSVs are easy to copy, email, store, and lose control of. | High because note text may include sensitive context or PII. | Creates exported copies outside clear/delete semantics unless policy says otherwise. | Adds export/schema contract if implemented. | Export inclusion, clear-state, redaction/log, unauthorized export, and generated-suggestion exclusion tests. | Requires explicit privacy/export/access approval. | Do not add now. |
| E3: export note-specific timestamp and generic author label | Provides note metadata without note body. | Metadata can be overread as audit or real identity. | Low to medium. | Exported metadata can survive clear/delete unless policy covers it. | Adds export columns/contracts. | Metadata export, no note body, no real identity, clear-event, and generated-suggestion exclusion tests. | Requires export and retention approval. | Hold. |
| E4: export metadata-history summary only | Shares event count or last event facts without note body. | Activity metadata can leak review behavior and be overclaimed. | Medium for event metadata. | Exported event summaries become retained external records. | Adds export columns/contracts. | Metadata-summary export, no old/new text, no generated suggestion text, and clear-event tests. | Future gated. | Hold. |
| E5: role-gated export of current note plus metadata | Supports controlled operations/audit export. | Highest v1 export risk because text and metadata leave the app. | High. | Requires explicit retention, deletion, redaction, and evidence policy for exported files. | Requires access-controlled export contract and likely API changes. | Role-gated export, unauthorized, redaction, retention, clear/delete, and generated-suggestion exclusion tests. | Requires privacy/legal/product/access approval before production. | Not a v1 default. |

Recommended default: E0/E1 now. Do not expand exports without an explicit
privacy/access/export decision.

## 6. Option Matrix: API Exposure

| Option | Value | Risk | Privacy impact | Auth dependency | API contract impact | Tests needed | Production implication | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A0: keep current local/test API behavior only | Preserves the shipped local/test boundary. | API consumers outside the reviewer workflow cannot rely on note fields. | Lowest for new exposure. | None beyond current local/test assumptions. | No new API contract. | Existing API contract tests and docs validation. | Production API exposure remains HOLD. | Recommended now. |
| A1: expose manual notes only to reviewer workflow endpoints | Keeps note fields scoped to reviewer surfaces. | Reviewer endpoint boundaries must be clear and enforced later. | Medium if note text is returned. | Reviewer role/auth required for production. | Reviewer endpoint contract only. | Authorized reviewer, unauthorized, payload shape, clear-state, and generated-suggestion rejection tests. | Local/test only until auth/access gates are approved. | Acceptable local/test concept. |
| A2: expose current note metadata but not history events | Lets reviewer clients show timestamp/author state without event lists. | Metadata can be misused by non-reviewer consumers if endpoint is broad. | Low to medium. | Reviewer role/auth if production. | Adds or preserves current metadata fields only. | Payload tests for timestamp, generic author label, no real identity, and no history event list. | Future gated for production. | Prefer over event-list APIs if metadata visibility is selected. |
| A3: expose metadata-history summary | Allows clients to show event count/last event. | Summary can be treated as audit/history proof. | Medium. | Reviewer role/auth and metadata retention policy. | Adds/keeps summary fields only. | Summary payload, no old/new text, clear-event, no generated suggestion history tests. | Production HOLD until retention/access approval. | Hold beyond current local/test summary. |
| A4: expose full metadata event list, no note content history | Supports detailed metadata review. | Event-list API can become hard to retract and may need pagination/access policy. | Medium to high for event metadata. | Strong reviewer/admin role model. | New event-list contract. | Role-gated event-list, no text, pagination if needed, clear-event, retention, and generated-suggestion exclusion tests. | Future gated only. | Do not add now. |
| A5: role-gated API exposure after auth/access policy | Creates production-capable API visibility under roles. | Access bugs can expose note text/metadata broadly. | High if note text is included. | Approved auth/session/role model required. | Versioned or explicitly documented contract likely required. | Auth/role, unauthorized/forbidden, export/log redaction, retention/clear, and generated-suggestion exclusion tests. | Candidate only after auth/access/privacy approval. | Future gated. |

Recommended default: A0/A1 local/test only. A5 remains future gated.

## 7. Option Matrix: Metadata-History Visibility

| Option | Value | Risk | Privacy impact | Clear/delete implication | Tests needed | Production implication | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| H0: no metadata history visibility outside local/test | Preserves production HOLD and avoids event metadata exposure. | No external accountability view. | Lowest. | Clear behavior remains local/test only. | Docs/status checks and no-new-surface tests. | Production metadata visibility remains HOLD. | Recommended for production boundary. |
| H1: show only event count | Gives lightweight signal that accepted manual-note events exist. | Count can still imply hidden history. | Low to medium. | Count may remain after clear unless policy says purge. | Event-count, clear-event count, no old/new text, and generated-suggestion exclusion tests. | Local/test only unless retention/access gates approve. | Recommended local/test minimal visibility. |
| H2: show last event type/time | Gives useful last-change/clear context without listing all events. | Last event can be overclaimed as audit evidence. | Low to medium. | Clear may show last event as `clear` with timestamp. | Last-event type/time, clear-state copy, no old/new text, and no-generated-suggestion-history tests. | Local/test only unless approved. | Recommended local/test visibility with H1. |
| H3: show compact metadata history list | Shows create/edit/clear sequence without note bodies. | Broader activity metadata exposure and audit overclaim risk. | Medium. | Clear appends or preserves metadata-only clear event. | Compact-list role tests, no text, clear-event, retention, and no generated suggestion tests. | Future gated. | Hold. |
| H4: role-gated metadata history view | Enables production/admin metadata view under controls. | Access-control failure can expose activity metadata. | Medium to high. | Clear/delete behavior must match retention policy. | Role/access, unauthorized, retention, export/log, clear, and no-content tests. | Requires access/privacy/retention approval. | Future gated only. |

Recommended default: H1/H2 local/test only. H3/H4 remain future gated.

## 8. Option Matrix: Generated Suggestion Visibility Boundary

| Option | Value | Risk | UI impact | API impact | Test implications | Production implication | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| G0: generated suggestions remain copy-only and never exported | Preserves the Issue #113 / PR #114 boundary. | Reviewers must intentionally type or save final manual note text. | Existing helper copy can remain read-only/copy-only. | Generated suggestion fields stay out of saved note/export/history contracts. | Regression tests that generated fields are rejected or ignored by persistence and exports. | Required boundary for any future production proof. | Recommended and required. |
| G1: generated suggestions visible only during active reviewer session | Allows helper text during review without retention. | Browser/session behavior can be mistaken for persistence if copy is unclear. | Show helper text only as transient assistance. | No saved/API/export fields. | UI/session tests if implemented later; no persistence/history/export tests. | Production still needs proof that no suggestion is retained. | Acceptable only as helper UI. |
| G2: generated suggestions included only as unsaved helper UI, never in saved note fields | Clarifies that suggestions can help reviewers but not become saved data automatically. | A copied suggestion that a human saves later needs separate semantics for final text ownership. | UI must distinguish helper text from saved human-entered manual notes. | Saved note API must not accept generated-suggestion payload aliases. | Helper-vs-saved copy tests, rejected generated payload tests, no timestamp/author/history update tests. | Required if suggestions remain visible. | Recommended with G0. |
| G3: generated suggestion export/persistence remains forbidden | Makes the prohibition explicit for exports, APIs, history, and attribution. | None for privacy; limits analytics/outcome learning. | UI must not offer generated suggestion export/history controls. | API/export/history contracts must exclude suggestion text. | Export/API/history absence tests and no-attribution tests. | Required HOLD unless a future decision explicitly changes the boundary. | FORBIDDEN. |

Recommended default: G0/G2. Generated suggestion export, persistence, history,
retention, and attribution remain FORBIDDEN.

## 9. Option Matrix: Access-Control Prerequisites

| Option | Value | Risk | Dependency | Privacy impact | Tests needed | Production implication | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| C0: no production access-control implementation | Keeps docs-only scope honest and production untouched. | No production visibility path is enabled. | None beyond current docs/local tests. | Lowest. | Docs validation and no-runtime-change diff review. | Production visibility remains HOLD. | Recommended now. |
| C1: docs-only access-control plan | Makes roles, surfaces, and tests decision-ready. | Plan can be mistaken for implementation approval. | Product/auth/privacy owner input. | Low because no behavior changes. | Docs validation, role matrix completeness review. | Safe non-production next step. | Recommended now or next. |
| C2: local/test role stub only | Allows local tests to prove role-gated UI/API behavior without production auth. | Stub can be mistaken for real auth and drift from production roles. | Approved local/test role semantics. | Low to medium depending on test data. | Reviewer/manager/admin stub tests, unauthorized tests, no-production-auth-claim tests. | Not production proof. | Possible future local/test step after C1. |
| C3: authenticated reviewer identity required | Establishes real actor/role for production note visibility. | Requires auth/session design, identity lifecycle, and PII policy. | Auth/session source and privacy approval. | Medium to high because identities may be personal data. | Auth/session, role, unauthorized, redaction/export, clear/retention tests. | HOLD until auth/privacy decisions are approved. | Future gated. |
| C4: role-gated production access controls | Enables production reviewer/manager/API/export visibility under roles. | Highest risk if role checks fail or surfaces are missed. | C3 or approved role model, privacy/legal, DB/API, ops owners. | High if note text or identity is visible. | Full role/access matrix, API/UI/export/log tests, retention/delete tests, production proof gates. | Required before production visibility expansion. | HOLD. |

Recommended default: C0/C1 now. C3/C4 remain HOLD.

## 10. Access-Control Prerequisite Checklist

Before any future implementation expands visibility, record all of the
following:

- selected reviewer visibility option: V0, V1, V2, V3, or V4;
- selected manager visibility option: M0, M1, M2, M3, M4, or M5;
- selected export visibility option: E0, E1, E2, E3, E4, or E5;
- selected API exposure option: A0, A1, A2, A3, A4, or A5;
- selected metadata-history visibility option: H0, H1, H2, H3, or H4;
- selected access-control prerequisite option: C0, C1, C2, C3, or C4;
- whether current note text, timestamp, generic author label, metadata summary,
  and full metadata events are visible to each role;
- whether generated suggestions remain excluded from every visible/exported
  surface;
- auth/session source, if any;
- role names, role ownership, and null/unauthenticated behavior;
- API endpoints and UI surfaces covered by access controls;
- CSV/report/evidence/export surfaces covered by access controls;
- retention/privacy owner approval for any broader visibility;
- tests for authorized, unauthorized, forbidden, clear/delete, export/log,
  generated-suggestion exclusion, and no old/new note text history;
- production proof approval only if a separate future decision explicitly names
  exact commands, owners, evidence handling, stop conditions, and rollback path.

## 11. Recommended V1 Default

Recommended default, unless later repo evidence or a human decision changes it:

- Keep production HOLD.
- Keep current local/test visibility as-is.
- Do not add manager visibility yet.
- Do not expand exports yet.
- Do not expose generated suggestions through exports, APIs, saved note fields,
  metadata history, or attribution.
- Do not expose full metadata history outside local/test.
- Do not implement access control until auth/role semantics are approved.
- Treat `manual_reviewer` as a fixed generic local/test label, not a real or
  authenticated reviewer identity.
- Treat `manual_review_note_events` as local/test metadata-only history, not
  audit-grade production history.
- If a future implementation is approved, the safest next step is a docs-only
  access-control plan or local/test access visibility tests, not production
  proof execution.

The conservative product/data stance is: current manual notes may contain
sensitive operator-entered business context, so broader visibility must be
role-gated, privacy-reviewed, export-aware, and tested before it can move beyond
the existing local/test reviewer workflow.

## 12. Explicit Non-Decisions

This packet does not approve:

- implementation,
- schema/API changes,
- runtime/UI changes,
- access-control implementation,
- manager visibility expansion,
- export expansion,
- API exposure expansion,
- full metadata history visibility,
- production migration,
- production deploy,
- production proof,
- production D1 access,
- production D1 write,
- production D1 migration,
- production endpoint calls,
- production logs/secrets access,
- retention enforcement,
- purge/delete jobs,
- redaction,
- automated PII detection,
- real/authenticated reviewer identity,
- reviewer display names or emails,
- old manual note text retention,
- new manual note text retention in history rows,
- generated suggestion persistence,
- generated suggestion export,
- generated suggestion history,
- generated suggestion retention,
- generated suggestion attribution to humans,
- CRM, outreach, analytics, LLM, manager dashboard v1, outcome learning, or
  production proof work.

## 13. Future Approval Blocks

```yaml
manual_review_notes_v1_access_visibility_export:
  document_status: DRAFT_NOT_APPROVED
  approval_record: null
  reviewer_visibility_decision: HOLD
  manager_visibility_decision: HOLD
  export_visibility_decision: HOLD
  api_exposure_decision: HOLD
  metadata_history_visibility_decision: HOLD
  access_control_prerequisite_decision: HOLD
  production_readiness_decision: HOLD
  generated_suggestion_export_or_persistence: FORBIDDEN
  allowed_next_action: DECISION_ONLY
```

```yaml
manual_review_notes_v1_access_visibility_export_candidate:
  document_status: HUMAN_TO_FILL
  approval_record: null
  reviewer_visibility_decision:
    selected_option: null # V0 | V1 | V2 | V3 | V4
    current_note_visible: false
    timestamp_visible: false
    generic_author_label_visible: false
    metadata_history_summary_visible: false
    full_metadata_event_list_visible: false
  manager_visibility_decision:
    selected_option: null # M0 | M1 | M2 | M3 | M4 | M5
    manager_current_note_visible: false
    manager_metadata_visible: false
    manager_full_metadata_event_list_visible: false
  export_visibility_decision:
    selected_option: null # E0 | E1 | E2 | E3 | E4 | E5
    current_note_export_allowed: false
    timestamp_author_export_allowed: false
    metadata_history_export_allowed: false
    generated_suggestion_export_allowed: false
  api_exposure_decision:
    selected_option: null # A0 | A1 | A2 | A3 | A4 | A5
    reviewer_endpoint_only: true
    non_reviewer_consumers_allowed: false
    role_gated_api_required: true
  metadata_history_visibility_decision:
    selected_option: null # H0 | H1 | H2 | H3 | H4
    event_count_visible: false
    last_event_visible: false
    compact_event_list_visible: false
    full_event_list_visible: false
    old_new_note_text_visible: false
  access_control_prerequisite_decision:
    selected_option: null # C0 | C1 | C2 | C3 | C4
    authenticated_reviewer_identity_required: null
    manager_role_required: null
    export_role_required: null
    access_control_owner: null
  privacy_retention_policy:
    privacy_owner: null
    retention_owner: null
    clear_delete_metadata_policy: null
    pii_sensitive_content_policy: null
  production_readiness_decision:
    production_proof_allowed: false
    production_deploy_allowed: false
    production_d1_access_allowed: false
    production_endpoint_call_allowed: false
    production_logs_secrets_allowed: false
  generated_suggestion_export_or_persistence: FORBIDDEN
  allowed_next_action: DECISION_ONLY
```

## 14. Future Non-Authorizing Prompt Stub

Use only after a human fills approval blocks with non-HOLD values. This stub is
not approval by itself:

```text
Prepare a Manual Review Notes v1 access-control plan for dooosp/b2b-lead-agent.
Use approval_record: <URL>. Start from current origin/master and prove repo
root, branch, HEAD SHA, default branch, dirty state, PR/issue state, and
validation commands. Do not implement runtime, UI, schema, API, export,
manager visibility, access control, production proof, production deploy,
production D1 access, production endpoint calls, or production logs/secrets
unless the approval record explicitly authorizes the exact action. The plan
must define reviewer, manager, API, export, and metadata-history visibility,
role/auth prerequisites, tests, generated suggestion exclusion, retention/privacy
gates, stop conditions, and future production-proof blockers. Generated reviewer
note suggestions remain copy-only, unsaved, unattributed, unretained,
unexported, excluded from history, and not human-authored notes.
```

## 15. Validation Expectations

For this docs-only packet:

- `git diff --check`
- `npm run check:naming`
- `npm test` if source-of-truth docs or package-validated references change

For any future local/test access implementation:

- all docs-only validations above,
- focused role/access tests,
- API/UI visibility tests,
- unauthorized/forbidden tests,
- export absence or export inclusion tests depending on the selected option,
- generated-suggestion exclusion tests,
- no old/new note text history tests.

For any future production proof or rollout:

- require separate explicit approval,
- run only approved commands,
- stop on stale SHA, missing owner, failing CI, missing rollback, unclear role
  model, missing privacy/legal gate, unsafe evidence, missing export policy, or
  unapproved customer-data access,
- record only minimized, redacted, approved evidence.
