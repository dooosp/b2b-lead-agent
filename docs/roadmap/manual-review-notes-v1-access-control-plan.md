# Manual Review Notes V1 Access Control Plan

This plan translates the Manual Review Notes v1 access, visibility, API, export,
metadata-history, and generated-suggestion decisions into a future
access-control implementation map. It is documentation only. It does not
implement access control, auth, roles, manager visibility, export behavior, API
exposure changes, runtime/UI/schema behavior, retention/privacy enforcement,
production proof, production deploy, production D1 access, production endpoint
calls, or production logs/secrets access.

## Document Status

- Document status: `DRAFT_NOT_APPROVED`.
- Approval record:
  `https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4493804215`.
- Repository: `dooosp/b2b-lead-agent`.
- Default branch: `master`.
- Post-PR132 baseline inspected:
  `8c5c100664f63251cf82f72057ab4b31f8ebad27`.
- Scope: docs-only Manual Review Notes v1 access-control plan.
- Runtime behavior changed by this plan: none.
- UI behavior changed by this plan: none.
- Schema/API behavior changed by this plan: none.
- Access-control implementation performed by this plan: none.
- Auth/session/role implementation performed by this plan: none.
- Manager visibility/export/API expansion performed by this plan: none.
- Production action performed by this plan: none.
- Production readiness claim made by this plan: none beyond "access-control
  plan prepared."

```yaml
manual_review_notes_v1_access_control_plan_status:
  document_status: DRAFT_NOT_APPROVED
  approval_record: "https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4493804215"
  scope: DOCS_ONLY_ACCESS_CONTROL_PLAN
  post_pr132_baseline: "8c5c100664f63251cf82f72057ab4b31f8ebad27"
  access_control_implemented: false
  auth_session_implemented: false
  role_model_implemented: false
  manager_visibility_implemented: false
  export_expansion_implemented: false
  api_expansion_implemented: false
  production_approved: false
  generated_suggestion_access: FORBIDDEN_AS_SAVED_NOTE
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
- PR #132 added the docs-only access/visibility/export decision packet.

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
- Current API history summary fields:
  `manualReviewNotesHistoryEventCount`,
  `manualReviewNotesHistoryLastEventType`,
  `manualReviewNotesHistoryLastEventAt`, and
  `manualReviewNotesHistoryLastAuthorLabel`.
- Current clear behavior: `manualReviewNotes: ""` clears the saved current note
  value, updates the note-specific timestamp, keeps generic author attribution
  for accepted manual-note changes, and appends a metadata-only clear event.
- Current privacy warning: static local/test reviewer guidance only. It does
  not detect, block, redact, enforce retention, purge data, or create
  production compliance evidence.
- Current generated suggestion boundary: generated reviewer note suggestions
  are copy-only, unsaved, unattributed, unretained, unexported, excluded from
  history, and not human-authored saved notes.
- Current auth assumption: protected APIs use the general bearer API token, but
  there is no reviewer/manager role model and no real reviewer identity.
- Current CSV compatibility: `GET /api/export/csv` serializes the existing
  `메모` column from `lead.manualReviewNotes || lead.notes`. This is current
  compatibility, not a new export expansion or privacy/access approval.
- Current production status: no production proof and no production deploy.

## 2. Problem Statement

Manual Notes v1 has local/test functionality and access/visibility/export
decisions, but no actual access-control implementation is approved. Before any
future implementation, the repo needs an explicit map for:

- which surfaces need protection,
- which data fields need protection,
- which roles or access modes might exist,
- what reviewer-only views can see,
- what manager views can see later, if approved,
- what API/export surfaces can expose later, if approved,
- how metadata-only history should be protected,
- how generated suggestions remain excluded,
- what auth/session assumptions are missing,
- what tests are required before any implementation,
- what production gates remain blocked.

The core risk is that manual notes may contain sensitive operator-entered sales
context or PII. A future manager view, CSV, API response, history view, evidence
packet, report, or production proof could expose current note text or activity
metadata before roles, privacy policy, retention policy, export semantics, and
production evidence handling are approved.

## 3. Protected Surface Inventory

| Surface | Current local/test behavior | Fields exposed | Risk | Required future protection | Tests needed before implementation | Production implication |
| --- | --- | --- | --- | --- | --- | --- |
| `/leads` manual note textarea/control | Renders a human-entered manual note control, auto-saves `manualReviewNotes`, supports confirmed clear, shows saved/empty state, note timestamp when available, generic label, metadata event count, and static warning. | `manualReviewNotes`, lead-level `notes` fallback, `manualReviewNotesUpdatedAt`, `manualReviewNotesAuthorLabel`, metadata event count, lead-level `updatedAt` fallback. | Note text and metadata are visible in the browser to whoever can use the local/test reviewer UI and token. | Reviewer-only access model; do not show to manager/non-reviewer surfaces without explicit approval; retain warning copy. | Reviewer authorized/unauthorized UI tests, save/edit/clear regression, no generated suggestion saved state, no real identity claim. | Production HOLD until auth/session/role and privacy gates approve reviewer visibility. |
| Lead detail manual note textarea/control | Server-rendered detail page reads D1 lead under current auth, renders current manual note control, save/clear behavior, note state, metadata summary, and warning. | Same as `/leads`, plus server-rendered lead payload includes current note fields. | Server-rendered page can expose note text before client-side filtering exists. | Route-level reviewer role before D1 read if production; field-level visibility rules for manager/detail variants. | Route authorization, forbidden detail read, field omission, save/edit/clear, generated suggestion exclusion. | Production HOLD until reviewer-only route protection is selected. |
| `GET /api/leads` list payload | Protected by general API token; returns canonicalized leads and reviewer queue/session metadata. Manual notes are included in local/test read paths. | Current note text, provenance, timestamp, generic label, metadata history summary fields. | Broad API token is not a role; list payload can expose note text and metadata to non-reviewer consumers. | Role-gated serializer or endpoint scope; reviewer-only fields omitted for managers/non-reviewers unless approved. | API authorized/unauthorized read tests, payload shape by role, generated suggestion kept separate. | Production API exposure remains HOLD. |
| `GET /api/history` history payload | Protected by general API token; returns canonicalized history leads. Manual note fields can appear through the same transform path. | Same current-value and metadata summary fields as lead objects. | Historical lead payload could spread note text outside the active reviewer workflow. | Decide whether history can include current note text; default omit manual notes for non-reviewer consumers. | History serializer role tests, no generated suggestion persistence/history tests. | Production HOLD until API/history visibility is approved. |
| `PATCH /api/leads/:id` | Protected by general API token; accepts `manualReviewNotes` or compatible `notes`, rejects generated-suggestion patch fields, updates timestamp/author/history only on actual manual-note change. | Write access to current note text; response includes updated note and metadata summary. | Unauthorized write could create sensitive note text; mixed generated suggestion payloads must remain atomic rejection. | Reviewer-only write role; reject writes from managers/non-reviewers unless explicitly approved. | Unauthorized write blocked, manager write denied if not approved, generated suggestion patch rejected atomically, clear semantics preserved. | Production writes remain HOLD until auth/session/role, privacy, D1, and proof gates approve them. |
| `GET /api/export/csv` serializer | Protected by general API token. Current CSV compatibility includes the `메모` column from `manualReviewNotes || notes`. No new metadata history or generated suggestion export exists. | Current manual note text through existing `메모` compatibility column; no metadata history columns; no generated suggestion fields. | CSV files are easy to copy, retain, email, and lose outside clear/delete semantics. Existing compatibility needs explicit audit before production claims. | Preserve compatibility now; future role-gated export policy before adding or relying on note exports. Consider explicit omission or approved inclusion decision later. | CSV compatibility tests, no generated suggestion export, no metadata history export, role-gated export denial if roles exist. | Existing compatibility is not production export approval. Export expansion remains HOLD. |
| Route metadata and route docs | Documents `PATCH /api/leads/:id` as atomic lead status/manual notes patch and `GET /api/export/csv` as CSV read route. | Route descriptions and auth classifications, not note text. | Docs can understate data sensitivity or auth gaps. | Keep route docs explicit when access-control implementation is approved. | Docs/contract check plus route inventory tests if route metadata changes. | Docs do not prove production auth readiness. |
| Manager / Reviewer Summary v0 surfaces | Current summary uses existing filtered leads, queue/session metadata, and LeadBrief fields only. No manager manual-note expansion is approved. | No approved manager manual note text or full metadata event list. | Future summary could accidentally add note text or metadata as "helpful context." | Manager summary excludes manual notes by default; require separate manager visibility approval. | Regression that manager summary omits manual note text/metadata unless selected; generated suggestion remains helper-only. | Manager visibility remains HOLD. |
| Local E2E/fake-D1 harness | Seeds fake D1 rows and exercises manual note save/edit/clear and read paths locally. | Test note text, current note metadata, metadata summary. | Local evidence can be overclaimed as production proof. | Keep fixture data synthetic; label local/fake-D1 evidence as non-production. | Existing local E2E plus future role-stub E2E if C2 is approved. | No production evidence. |
| Docs/status/reporting surfaces | Decision packets, roadmap docs, PR bodies, and issue comments track boundaries. | Usually no real note text; may summarize field names and gates. | Docs can become mistaken for implementation or production evidence. | Use explicit non-authorization language and approval blocks. | Docs validation and no-runtime-change diff review. | No production readiness claim beyond plan prepared. |
| Generated suggestion UI | Deterministic helper text is visible for copy-only reviewer assistance; it is separate from saved manual notes. | `reviewNoteSuggestion`, `reviewerNoteTemplates`, queue/session generated helper fields. | Helper text can be mistaken for saved notes or exported content if labels blur. | Keep copy-only UI distinct; never use generated suggestion fields as saved-note source. | Generated suggestion patch rejection, not persisted, not timestamped, not attributed, not history, not export. | Generated suggestion persistence/export/history remains forbidden. |

## 4. Protected Field Inventory

| Field | Sensitivity | Current exposure | Allowed future exposure | Blocked exposure | Generated-suggestion boundary | Test implications |
| --- | --- | --- | --- | --- | --- | --- |
| `manualReviewNotes` | High. Human-entered free text may include sensitive sales context or PII. | `/leads`, lead detail, `GET /api/leads`, `GET /api/history`, `PATCH` response, and current CSV `메모` compatibility. | Reviewer-only read/write after explicit role/access approval; manager/export/API only after separate approval. | Non-reviewer, manager, export, production, or broad API exposure without approval. | Generated suggestions must not populate this field unless a human separately types/saves final text under approved semantics. | Role read/write, serializer omission, clear-state, no generated suggestion patch, no production overclaim tests. |
| `notes` / lead row `notes` | High. Current storage backing for manual notes and legacy compatibility. | D1 row, transforms, CSV serializer, lead page fallbacks. | Compatibility only until migration/alias policy changes. | Treating generated batch `notes` as saved manual note text; unapproved exports or history. | Batch saves clear generated/cache note text before persistence. | Batch save preservation/rejection, legacy conflict, CSV compatibility tests. |
| `manualReviewNotesProvenance` | Medium. Indicates saved human-entered note exists. | API/UI when non-empty saved note text exists. | Reviewer-only or approved metadata visibility. | Claiming provenance for generated suggestions or empty notes. | Always empty for generated suggestions and empty saved notes. | Provenance present only for non-empty human-entered notes. |
| `manualReviewNotesUpdatedAt` | Medium. Reveals note activity timing. | API/UI current-value metadata, backed by `manual_review_notes_updated_at`. | Reviewer-only timestamp; manager/API/export only after metadata approval. | Labeling lead-level `updatedAt` as manual note time; generated suggestion timestamping. | Generated suggestions must not update it. | Save/edit/clear update tests, unchanged save no update, generated patch no update. |
| `manualReviewNotesAuthorLabel` | Medium. Fixed generic label can be misread as identity. | API/UI fixed `manual_reviewer` label when present. | Reviewer-only generic label with copy saying it is not real/auth identity. | Real identity, display name, email, audit actor, generated suggestion attribution. | Generated suggestions never receive attribution. | No real identity strings, unchanged save no invented label, generated patch no label. |
| `manual_review_note_events` event count/summary | Medium. Reveals activity count and last event metadata. | API/UI summary fields only. | Reviewer-only summary if approved; manager summary only after explicit metadata decision. | Treating summary as audit-grade history or exposing to broad exports/APIs without approval. | Generated suggestions never create events. | Summary count/last-event tests, no old/new text, generated exclusion tests. |
| `manual_review_note_events` event rows | Medium to high. Content-free but reveals activity timing and sequence. | Stored locally/test-only; no full event-list API/UI/export exists. | Future gated reviewer/admin event-list view only after retention/access approval. | Full event list to managers/API/export/production without approval. | Generated suggestions never create rows. | Event-list role tests if implemented; no body columns; retention/clear semantics. |
| Generated reviewer note suggestion fields | Medium helper text, but forbidden as saved note data. | UI/API helper outputs in reviewer intelligence/queue/session/workbench. | Copy-only helper UI. | Persistence, snapshots, history, export, saved-note treatment, reviewer attribution, production evidence. | Required boundary: not saved, not retained, not exported, not history, not attributed. | Patch rejection, batch insert ignore, export absence, no timestamp/author/history updates. |
| `updatedAt` / `updated_at` | Low to medium. Lead-level activity timestamp. | API/UI lead last-update state. | Lead-level display only. | Manual-note-specific timestamp claim when no `manualReviewNotesUpdatedAt` exists. | Generated suggestions may affect lead generation metadata elsewhere, but not manual-note timestamp semantics. | Copy/label tests keep "lead last update" separate from manual note time. |
| CSV/export fields | High when `메모` contains manual note text; medium for metadata if added later. | Existing `메모` compatibility column includes current note text. | Existing compatibility can be preserved; any new manual note export requires privacy/access approval. | Generated suggestion export, metadata history export, old/new note text history export. | Generated suggestion fields stay absent. | CSV no generated suggestion, no metadata history expansion unless approved, role-gated export tests later. |

## 5. Access Model Options

| Option | Value | Risk | Dependency | Privacy impact | Implementation complexity | Tests needed | Production implication | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C0: no access-control implementation; local/test only | Keeps current behavior and production HOLD. | No new protection beyond existing API token assumptions. | None beyond current docs/local tests. | Lowest new exposure, but current local/test API token is not role-aware. | None. | Docs validation and no-runtime-change diff review. | Production remains blocked. | Safe baseline. |
| C1: docs-only access-control plan | Maps fields, surfaces, role options, tests, and gates without behavior changes. | Plan can be mistaken for implementation if wording overclaims. | Approval-intent record and current repo inspection. | Low. | Low, docs-only. | Docs validation, no runtime diff, checklist completeness. | Safe non-production next step. | Recommended now. |
| C2: local/test role stub only | Enables local tests for reviewer/manager/API behavior without real production auth. | Stub can be mistaken for real auth or diverge from future production roles. | Explicit local/test implementation approval and role names. | Low to medium depending on fields shown. | Medium. | Reviewer/manager role-stub tests, unauthorized tests, no-production-auth-claim tests. | Not production proof. | Only after explicit local/test approval. |
| C3: reviewer-only access control | Protects note text/write paths for reviewer workflows. | Reviewer role source may be wrong without real auth/session design. | Auth/session or local/test role stub decision. | Medium because note text remains visible to reviewers. | Medium to high. | Reviewer read/write allow, non-reviewer deny, generated suggestion exclusion, export/API omission tests. | Production HOLD until auth/privacy gates pass. | HOLD. |
| C4: reviewer + manager roles | Enables explicit manager denials or approved manager read paths. | Manager visibility can broaden sensitive note exposure. | Product/privacy role policy and manager access decision. | Medium to high. | High. | Manager allow/deny matrix, current-note-only or metadata-only tests, export denial, no full history. | Production HOLD until manager visibility is approved. | HOLD. |
| C5: authenticated production role controls | Real production-capable roles and session semantics. | Highest blast radius if auth, roles, logs, or exports are wrong. | Auth/session source, privacy/legal, ops owner, D1/production proof plan. | High if text or identity enters production. | Highest. | Full UI/API/export/log role matrix, retention/delete, production proof gates, rollback tests. | Required before production saved-note visibility, but not approved. | HOLD. |

Recommended default:

- Choose C1 now.
- Consider C2 only after explicit local/test implementation approval.
- Keep C3, C4, and C5 on HOLD.

## 6. Reviewer Access Plan

Reviewer-only access may include later, after explicit approval:

- current manual note text,
- `manualReviewNotesProvenance`,
- `manualReviewNotesUpdatedAt`,
- `manualReviewNotesAuthorLabel` with copy that `manual_reviewer` is a generic
  local/test label, not real/authenticated identity,
- metadata-only history summary fields,
- static privacy warning,
- generated suggestions only as copy-only unsaved helper text.

Reviewer access must remain blocked from claiming:

- real reviewer identity unless approved,
- authenticated identity unless approved,
- display name or email unless approved,
- full old/new note text history,
- audit-grade history,
- generated suggestion saved-note treatment,
- generated suggestion attribution,
- generated suggestion history/export/retention,
- production proof or production readiness.

Minimum future reviewer tests:

- authorized reviewer can read current note fields selected by the decision,
- authorized reviewer can write only approved manual note fields,
- unauthorized or non-reviewer access is denied or omits protected fields,
- clear/delete keeps current semantics,
- generated suggestion fields cannot write, timestamp, attribute, or create
  history.

## 7. Manager Access Plan

Conservative manager options:

- default: no manager visibility to manual note text or metadata,
- manager summary excludes manual notes and metadata,
- manager sees current note only if a future approval selects that option,
- manager sees metadata summary only if a future approval selects that option,
- full metadata event list remains future gated,
- old/new note text history remains forbidden.

Manager-specific risks:

- broader role visibility can expose sensitive operator-entered context,
- metadata can reveal reviewer activity timing and counts,
- generic `manual_reviewer` label can be misread as identity or audit actor,
- manager-visible notes can affect retention, export, and evidence policies.

Required future approvals before manager visibility:

- selected manager visibility option,
- role owner and auth/session source,
- exact fields visible to managers,
- whether managers can write or only read,
- whether manager exports can include any note data,
- privacy/retention owner signoff,
- tests for manager allow/deny, current-note-only behavior, metadata-only
  behavior, generated suggestion exclusion, and no full note text history.

## 8. API Access Plan

Future API boundaries to decide:

- reviewer workflow read/write endpoints,
- lead list/read serializers,
- history serializers,
- metadata summary fields,
- full metadata event list, if ever approved,
- generated suggestion helper fields,
- patch rejection rules,
- role-gated API behavior if ever implemented.

Conservative API default:

- keep current local/test API behavior only,
- do not add new API endpoints for manual note history,
- do not broaden manual note payloads to non-reviewer consumers,
- do not expose generated suggestions as saved note data,
- do not expose old/new note text history.

Required tests if API roles or serializers change:

- unauthorized read blocked or protected fields omitted,
- unauthorized write blocked,
- manager/API surfaces cannot expose manual note text unless approved,
- generated suggestion patch rejected atomically,
- generated suggestion patch cannot clear manual notes,
- export/API cannot expose generated suggestion as saved note,
- metadata summary is content-free,
- full metadata event list unavailable unless explicitly approved.

## 9. Export / CSV Access Plan

Conservative default:

- no export expansion now,
- preserve existing CSV compatibility unless a future approval changes it,
- current `GET /api/export/csv` compatibility includes the `메모` column from
  `manualReviewNotes || notes`,
- do not add manual-note metadata columns now,
- do not export generated suggestions,
- do not export old/new note history,
- do not export full metadata event rows,
- metadata-history export remains gated,
- future production reliance on current manual note export compatibility
  requires explicit privacy/access/export approval.

Future export decisions must answer:

- whether existing `메모` compatibility should remain, be role-gated, or be
  omitted for some roles,
- whether exports are reviewer-only, manager-visible, admin-only, or forbidden,
- whether cleared note semantics apply to already-downloaded CSVs,
- whether exported metadata can survive clear/delete,
- how exported files are handled in evidence and redaction policy.

Required export tests if export changes:

- no generated suggestion fields,
- no old/new note text history,
- no metadata history export unless selected,
- role-gated export allow/deny,
- current note inclusion or omission follows the selected policy,
- clear/delete behavior is represented truthfully.

## 10. Metadata-History Access Plan

Current metadata history is content-free, but it is still sensitive metadata.
It reveals that a note was created, edited, or cleared for a lead, and when the
last event happened. It can also reveal reviewer activity counts.

Conservative metadata plan:

- treat event count and last event summary as safer than a full event list,
- expose summaries only to approved reviewer surfaces,
- keep full event lists future gated,
- never store old manual note text in history rows,
- never store new manual note text in history rows,
- never store generated suggestion text in history rows,
- never store real reviewer identity in history rows,
- avoid audit-grade copy unless a future audit model is approved.

Required metadata tests if visibility changes:

- event count and last event summary are role-gated,
- full event list unavailable unless approved,
- event rows have no text fields,
- generated suggestion patches do not create events,
- unchanged manual note saves do not create events,
- clear/delete appends only the approved metadata-only clear event,
- production exposure requires access/privacy/retention approval.

## 11. Generated Suggestion Exclusion Checklist

Generated reviewer note suggestions must remain:

- [ ] not persisted,
- [ ] not retained,
- [ ] not exported,
- [ ] not attributed,
- [ ] not a history entry,
- [ ] not manual note text,
- [ ] not manager-visible saved note data,
- [ ] not production evidence,
- [ ] rejected or ignored on patch fields according to the current contract,
- [ ] separate from copy-only helper UI,
- [ ] unable to update `manualReviewNotesUpdatedAt`,
- [ ] unable to update `manualReviewNotesAuthorLabel`,
- [ ] unable to create `manual_review_note_events`,
- [ ] unable to populate CSV/export saved-note fields.

If a human copies helper text, edits it, and separately saves final text as
`manualReviewNotes`, the saved value still needs explicit product/data/privacy
semantics before it can be treated as production human-authored note content.
This plan does not approve that production interpretation.

## 12. Test Plan For Future Implementation

Do not implement these tests now unless docs validation requires it. Future
implementation must select the smallest test set matching the approved scope.

Reviewer-only read/write tests:

- reviewer can read selected current note fields,
- reviewer can save/edit/clear manual notes,
- unchanged saves do not update timestamp/author/history,
- lead-level `updatedAt` remains lead-level copy only.

Manager access tests:

- manager cannot see manual note text by default,
- manager summary excludes manual note text and metadata by default,
- manager can see only selected fields if a future approval allows it,
- manager cannot write manual notes unless separately approved.

API exposure tests:

- unauthorized read blocked or protected fields omitted,
- unauthorized write blocked,
- serializer field matrix matches reviewer/manager/API decisions,
- generated suggestion patch fields are rejected atomically,
- conflicting `manualReviewNotes` and `notes` payloads remain rejected.

Export exclusion tests:

- generated suggestions are not exported,
- metadata history is not exported unless approved,
- old/new note text history is never exported,
- current note CSV compatibility is explicitly asserted or omitted based on
  the selected policy.

Metadata-history access tests:

- summary fields are role-gated if roles exist,
- full event list is unavailable unless approved,
- event rows contain only lead id, event type, timestamp, and fixed generic
  author label,
- generated suggestion actions do not create events.

Generated suggestion boundary tests:

- generated helper fields cannot persist,
- generated helper fields cannot clear a saved manual note,
- generated batch inserts do not create saved manual notes,
- generated suggestions do not update timestamp, author, history, or export.

Privacy warning preservation tests:

- warning copy remains static guidance only,
- API does not claim detection/blocking/redaction,
- UI does not claim retention/privacy enforcement.

Regression tests for existing behavior:

- save/read,
- edit/update,
- clear/delete,
- note-specific timestamp,
- generic author label,
- metadata-only history summary,
- CSV compatibility if untouched,
- local E2E fake-D1 flow.

## 13. Production Gate Checklist

Production remains blocked until all relevant gates are filled by future
approval records:

- [ ] auth/session model selected,
- [ ] reviewer role defined,
- [ ] manager role defined or explicitly denied,
- [ ] API scope approved,
- [ ] export scope approved,
- [ ] metadata-history visibility approved,
- [ ] retention/privacy gate approved,
- [ ] production D1 migration plan approved,
- [ ] rollback/backout plan approved,
- [ ] observability/logging policy approved,
- [ ] production proof plan approved,
- [ ] generated suggestion exclusion proof designed,
- [ ] customer data boundary approved,
- [ ] legal/privacy review completed if needed,
- [ ] exact production commands approved if production proof is ever requested,
- [ ] stop conditions and evidence redaction policy approved,
- [ ] incident owner and rollback owner named.

Blocked production actions:

- production proof,
- production deploy,
- production D1 migration/access/write,
- production endpoint calls,
- production logs/secrets access,
- production smoke tests,
- customer data access or mutation,
- production saved-note use,
- production access-control claims,
- production privacy/retention compliance claims.

## 14. Future Approval Blocks

Use this block to keep the current plan non-authorizing:

```yaml
manual_review_notes_v1_access_control_plan:
  document_status: DRAFT_NOT_APPROVED
  approval_record: null
  access_model_decision: HOLD
  reviewer_access_decision: HOLD
  manager_access_decision: HOLD
  api_access_decision: HOLD
  export_access_decision: HOLD
  metadata_history_access_decision: HOLD
  auth_session_decision: HOLD
  production_readiness_decision: HOLD
  generated_suggestion_access: FORBIDDEN_AS_SAVED_NOTE
  allowed_next_action: DECISION_ONLY
```

Use this candidate block only after a human fills non-HOLD values:

```yaml
manual_review_notes_v1_access_control_candidate:
  document_status: HUMAN_TO_FILL
  approval_record: null
  selected_access_model: null # C0 | C1 | C2 | C3 | C4 | C5
  reviewer_access:
    current_note_text_visible: false
    provenance_visible: false
    note_specific_timestamp_visible: false
    generic_author_label_visible: false
    metadata_history_summary_visible: false
    full_metadata_event_list_visible: false
    write_allowed: false
  manager_access:
    current_note_text_visible: false
    metadata_history_summary_visible: false
    full_metadata_event_list_visible: false
    write_allowed: false
  api_access:
    reviewer_endpoint_only: true
    lead_list_manual_note_fields_allowed: false
    history_manual_note_fields_allowed: false
    metadata_history_summary_allowed: false
    full_metadata_event_list_allowed: false
  export_access:
    preserve_existing_memo_column_compatibility: null
    current_note_export_allowed: false
    timestamp_author_export_allowed: false
    metadata_history_export_allowed: false
    generated_suggestion_export_allowed: false
  auth_session:
    source: null
    unauthenticated_behavior: DENY_OR_OMIT_PROTECTED_FIELDS
    reviewer_role_name: null
    manager_role_name: null
    api_export_role_name: null
  tests_required:
    reviewer_read_write: true
    manager_allow_deny: true
    api_exposure: true
    export_exclusion: true
    metadata_history_access: true
    generated_suggestion_boundary: true
    privacy_warning_boundary: true
  production_readiness:
    production_proof_allowed: false
    production_deploy_allowed: false
    production_d1_access_allowed: false
    production_endpoint_call_allowed: false
    production_logs_secrets_allowed: false
  generated_suggestion_access: FORBIDDEN_AS_SAVED_NOTE
  allowed_next_action: IMPLEMENT_ONLY_IF_SEPARATELY_APPROVED
```

## 15. Explicit Non-Decisions

This plan does not approve:

- runtime behavior change,
- UI behavior change,
- schema change,
- API contract change,
- access-control implementation,
- auth/session implementation,
- role implementation,
- manager visibility implementation,
- export implementation,
- API exposure expansion,
- D1 migration,
- D1 production access,
- production deploy,
- production rollback,
- production endpoint call,
- production smoke test,
- production logs/secrets read,
- Wrangler production command,
- customer data access or mutation,
- retention/privacy enforcement,
- purge/delete jobs,
- redaction,
- automated PII detection,
- real/authenticated reviewer identity implementation,
- old manual note text retention,
- new manual note text in history rows,
- full note history viewer,
- generated suggestion persistence,
- generated suggestion history,
- generated suggestion export,
- generated suggestion attribution to a reviewer,
- CRM, outreach, analytics, LLM, manager dashboard v1, outcome learning, or
  production proof work.

## 16. Future Non-Authorizing Prompt Stub

Use only after a human fills approval blocks with non-HOLD values. This stub is
not approval by itself:

```text
Prepare a local/test-only Manual Review Notes v1 access-control implementation
plan for dooosp/b2b-lead-agent. Use approval_record: <URL>. Start from current
origin/master and prove repo root, branch, HEAD SHA, default branch, dirty
state, PR/issue state, and validation commands. Do not implement production
auth, production roles, production D1 access, production endpoints, production
logs/secrets, export expansion, manager visibility, retention/privacy
enforcement, generated suggestion persistence/export/history/attribution, or
old/new note text history unless the approval record explicitly selects them.
Generated reviewer suggestions remain copy-only, unsaved, unattributed,
unretained, unexported, excluded from history, and not human-authored saved
notes.
```

## 17. Recommended Next Safe Actions

Recommended next safe state after this plan:

- C1 is complete as docs-only planning once this document is merged.
- C2 local/test role stub remains the safest possible implementation follow-up,
  but only after explicit approval.
- C3 reviewer-only controls, C4 reviewer plus manager roles, and C5
  authenticated production role controls remain HOLD.
- Production proof remains blocked until privacy/retention, access-control,
  export/API, D1 migration, rollback, evidence, generated-suggestion exclusion,
  and customer-data gates are approved.
