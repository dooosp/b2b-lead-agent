# Manual Review Notes V1 Note History / Versioning Decision Packet

This packet prepares Manual Review Notes v1 note history and versioning
semantics after the local/test-safe current-value, note-specific timestamp, and
generic author-label work. It is documentation only.

## 1. Document Status

- Document status: `DRAFT_NOT_APPROVED`.
- Approval-intent record:
  `https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4487570553`.
- Pull request:
  `https://github.com/dooosp/b2b-lead-agent/pull/127`.
- Repository: `dooosp/b2b-lead-agent`.
- Default branch: `master`.
- Post-PR126 baseline inspected:
  `b4b6fb37b6725851029109f63295977c782b9a74`.
- Scope: note history/versioning decision packet for Manual Review Notes v1.
- Runtime behavior changed by this packet: none.
- UI behavior changed by this packet: none.
- Schema/API behavior changed by this packet: none.
- D1 migration performed by this packet: none.
- Production action performed by this packet: none.

This packet does not approve note history implementation. It records options,
risks, recommended defaults, retention/privacy implications, clear/delete
semantics, generated-suggestion exclusions, and future approval gates before any
old manual note value is retained.

```yaml
manual_review_notes_v1_note_history_packet:
  document_status: DRAFT_NOT_APPROVED
  approval_record: "https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4487570553"
  scope: DOCS_ONLY_DECISION_PACKET
  post_pr126_baseline: "b4b6fb37b6725851029109f63295977c782b9a74"
  implementation_approved: false
  production_approved: false
  old_note_value_retention_approved: false
  note_history_implemented: false
  generated_suggestion_history: FORBIDDEN
```

## 2. Current State

- PR #120 implemented the local/test-safe save/read path for human-entered
  manual review notes only.
- PR #121 implemented local/test-safe edit/update and clear/delete UX for
  human-entered manual review notes.
- PR #122 added saved/empty state clarity plus truthful lead-level update
  timestamp labeling.
- PR #123 added the docs-only Manual Review Notes v1 data semantics decision
  packet.
- PR #124 implemented local/test-safe T1 note-specific timestamp support.
- PR #125 added the docs-only Manual Review Notes v1 reviewer identity / author
  attribution decision packet.
- PR #126 implemented local/test-only generic non-PII manual reviewer author
  label support.
- Current manual note field: `manualReviewNotes`.
- Current provenance: `manualReviewNotesProvenance: "human_entered"` only when
  non-empty saved manual note text exists.
- Current timestamp: `manualReviewNotesUpdatedAt`, backed by
  `manual_review_notes_updated_at`, means the note-specific last accepted
  human-entered manual note change/save/clear event.
- Current author label: `manualReviewNotesAuthorLabel`, backed by
  `manual_review_notes_author_label`, uses only the fixed non-PII value
  `manual_reviewer`.
- Current clear behavior: `manualReviewNotes: ""`.
- Current clear author/timestamp behavior: clear/delete conservatively clears
  the saved current note value, updates the note-specific timestamp, and sets
  the generic author label only for an accepted manual note change.
- Current history behavior: no note history/versioning is implemented.
- Generated reviewer note suggestions remain copy-only, unsaved,
  unsnapshotted, unattributed to a reviewer, not history entries, and not
  human-authored notes.
- Current production status: production proof, production deploy, production D1
  access, production endpoint calls, production logs/secrets, CRM, outreach,
  analytics, LLM behavior, manager dashboard v1, outcome learning, real or
  authenticated reviewer identity, note history implementation, and
  retention/privacy enforcement remain out of scope unless explicitly approved
  later.

## 3. Problem Statement

Manual Notes v1 now has current-value metadata, but it still does not answer:

- Should prior manual note values be retained?
- Should only last-write metadata be retained?
- Should clear/delete remove old content or leave history behind?
- Should history store full text, metadata only, redacted content, or no
  content?
- What happens if manual notes contain sensitive customer, sales, or PII
  information?
- Is note history required before production saved-note use?
- How should generated suggestions be explicitly excluded from history?

Without an explicit decision, a future implementation could accidentally retain
sensitive manual note text, preserve content after a reviewer expects clear to
remove it, overclaim audit strength from local metadata, or treat generated
helper suggestions as human-authored history.

## 4. Option Matrix: History Storage Model

| Option | Value | Risks | Schema/API impact | UI impact | Retention/privacy impact | Clear/delete semantics | Generated-suggestion boundary | Tests needed | Production implications | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| H0: current-value only, no history | Simplest model. Matches the current mutable `manualReviewNotes` value. | Edits overwrite previous text. Reviewers cannot recover old values or answer who changed earlier content. | None beyond current fields. | No history UI; only current note and current metadata can be shown. | Lowest old-content retention risk because no old note body is retained. | Clear removes the current saved value via `manualReviewNotes: ""`; no prior history exists to preserve. | Generated suggestions remain copy-only and cannot create history because no history exists. | Existing save/edit/clear regressions plus no-history assertions if later history code is considered. | Weak for production audit; production saved-note use remains HOLD. | Keep as the no-history fallback. |
| H1: last-write metadata only | Current effective local/test state: current note value plus `manualReviewNotesUpdatedAt` and generic `manualReviewNotesAuthorLabel`. Gives truthful last-change facts without old note text. | Cannot reconstruct prior note text. Metadata can be mistaken for full audit history if UI copy overclaims. | Already implemented locally/test-only for current timestamp and generic label; future expansion still needs explicit approval. | UI may show last-change metadata only, not a version list. | Lower privacy burden than note body history; still retains event metadata after clear. | Clear removes current value but can preserve last-change timestamp and generic label as "last accepted manual note clear/change" metadata. | Generated suggestions must not update note metadata, create history, or be attributed. Rejected generated payload attempts are not manual note events. | Tests for current metadata, clear metadata, unchanged-save no-op behavior, unrelated patches, and generated-suggestion exclusion. | Better privacy posture than full history, but production remains HOLD until retention/privacy and production proof are approved. | Recommended v1 default already in effect locally/test-only; do not call it history. |
| H2: local/test-only append-only metadata history, no old note text | Allows local/test inspection of create/edit/clear event sequence without retaining note bodies. Useful for validating semantics before content retention. | Can still overclaim audit strength. Event metadata can leak workflow timing or reviewer activity. | Requires a new local/test-only event model or fixture shape if implemented later; no text body fields. | Could expose a local/test event count or collapsed metadata events. | Avoids old note text retention, but still creates retained event data requiring deletion/export decisions. | Clear appends a metadata clear event and removes current value; old note text is not stored. | Generated suggestions remain excluded. If rejected generated payload attempts are logged, they must be security metadata only with no generated or manual note content and not manual note history entries. | Event append tests, no-content-retention tests, clear-event tests, generated-suggestion exclusion tests, and local fixture hygiene checks. | Not production proof. Must stay local/test-only unless production retention/privacy gates are separately approved. | Preferred next implementation only if a future approval wants history-like behavior before full content retention. |
| H3: local/test-only append-only full note history | Gives reviewers a local/test version list and recovery path for old note bodies. | Retains sensitive old note text indefinitely in local artifacts. Clear may look like deletion while old values remain. | Requires new local/test schema/API/event payloads with text fields, migrations/fixtures, and compatibility behavior. | Could support a full local/test history viewer. | High privacy and PII exposure even outside production if real customer data is typed locally. | Must decide whether clear appends a tombstone, keeps old values visible, hides them, or purges them. | Generated suggestions must not be snapshotted into versions, even if copied to clipboard. Only explicit human-entered final text can ever be saved under a future approved rule. | Full version tests, clear/delete tests, fixture redaction, access/copy tests, and generated-suggestion non-participation tests. | Not production proof. Cannot justify production full history. | Do not choose by default; use only for an approved local prototype with strict test-data limits. |
| H4: audit-grade production history with retention/privacy/legal approval | Supports compliance-style audit: immutable events, actor/source, reason, retention, access controls, and deletion exceptions. | Highest storage, privacy, legal, auth, migration, UI, and operational burden. Can conflict with user expectation that clear removes old content. | Requires new schema/API/event model, migrations, retention jobs, access controls, export/redaction policy, and likely admin tooling. | Requires role/privacy-controlled audit UI; normal reviewer UI should not expose unnecessary sensitive history. | Highest. May retain note bodies, actor metadata, timestamps, and event source under formal policy. | Clear likely creates an audit event and may not purge old values unless retention policy allows or requires it. | Generated suggestions remain forbidden from history unless a separate future decision reverses the copy-only boundary; this packet does not do that. | Auth/audit tests, tamper-resistance expectations, retention/delete tests, migration/rollback tests, export/redaction tests, and production proof gates. | Requires explicit production, privacy/legal, auth, retention, DB/API, evidence, and operations approval. | Not a v1 default. Block until audit-grade history is a product/legal requirement. |

## 5. Option Matrix: History Content

| Option | Value | Privacy risk | PII exposure risk | Usefulness | Clear/delete conflict | Schema/API impact | Tests needed | Production implications | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C0: no history content | No old content or event stream is stored. | Lowest. | Lowest. | Low for recovery/audit; adequate for current-value workflow. | None because clear removes the only saved value. | None beyond current fields. | Existing no-history save/edit/clear tests. | Production still needs an explicit retention decision for current notes. | Current safest content default. |
| C1: metadata only, event type + timestamp + generic author label | Captures the fact that a human-entered note create/edit/clear happened without old text. | Low to medium; timing and reviewer-activity metadata are retained. | Low if author label stays generic and no note text is stored. | Useful for last-change evidence and local semantics validation. | Clear can preserve a clear event without preserving old text. | Requires event fields/table if implemented as history; current H1 fields already cover last-write metadata only. | Event-type, timestamp, generic label, clear, and no-content tests. | Production requires privacy/retention approval even without text. | Preferred future history content if history is approved locally/test-only. |
| C2: redacted/summarized note content only | May preserve coarse rationale while reducing sensitive text exposure. | Medium; redaction/summarization can fail or imply false safety. | Medium; summaries can still contain names, deal details, or inferred PII. | Moderate for review continuity, weak for exact audit. | Clear may conflict with retained summaries if reviewers expect removal. | Requires redaction/summarization policy, fields, and possibly human review of redaction quality. | Redaction fixtures, no-PII regression tests, clear semantics, and generated-suggestion exclusion. | Not production-safe without privacy/legal owner and redaction evidence. | Avoid for v1; harder to prove than metadata-only. |
| C3: full previous and new note values | Preserves exact version diffs and recovery. | High. | High because manual notes may include customer names, buyer names, sensitive sales context, or personal data. | Highest for local recovery and debugging. | Strong conflict if clear appears to delete while full prior values remain. | Requires body fields, event model, migrations/fixtures, serializer/API shape, and UI decisions. | Full body retention tests, diff tests, clear/delete tests, export/log redaction, and no-generated-suggestion tests. | Not production-safe without formal retention/privacy/legal approval. | Do not implement by default. |
| C4: audit-grade immutable content with retention/legal controls | Provides formal audit evidence when exact retained content is required. | Highest but governed by policy if approved. | Highest; must be controlled by access, retention, export, redaction, and deletion policies. | Highest for compliance/audit, often too much for reviewer workflow v1. | Clear may create a tombstone while immutable content remains under retention policy. | Requires audit schema/API, auth, access controls, retention jobs, exports, evidence policy, and admin views. | Full audit, auth, access, retention, deletion-request, export/redaction, migration, and production proof tests. | Only after explicit production, legal/privacy, and operational approval. | Block for v1 unless audit-grade content retention is mandatory. |

## 6. Option Matrix: Event Types

| Option | Value | Risks | Generated-suggestion implications | Privacy impact | Implementation complexity | Tests needed | Production implications | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| E0: no events | Matches current no-history behavior. | No event trail beyond last-write metadata. | Generated suggestions cannot become events. | Lowest. | None. | Existing save/edit/clear tests. | Production saved-note use remains HOLD. | Keep unless an event model is explicitly approved. |
| E1: create/edit/clear only | Captures accepted human-entered manual note changes. | Can be mistaken for audit if local/test-only; event names must be precise. | Generated suggestions are excluded. Copying suggestion text is not an event unless a human later saves final text as `manualReviewNotes` under an approved rule. | Low to high depending on whether event content is C1, C2, C3, or C4. | Moderate if metadata-only; high if content is included. | Create/edit/clear append tests, unchanged-save tests, clear tests, and generated-suggestion exclusion. | Production requires retention/privacy and product approval. | Preferred event set if H2 is later approved. |
| E2: create/edit/clear plus failed/rejected generated payload attempts as security metadata only | Can show that forbidden generated-suggestion persistence attempts were blocked in local/test or security instrumentation. | Easy to pollute manual note history with rejection telemetry; could overcollect payload details. | Rejected generated payload attempt content must not be stored. These records must not become manual note history entries, must not include generated suggestion text, and must not be attributed as human-authored notes. | Medium because request metadata can still reveal behavior. | Higher because security telemetry must stay separate from note history. | Rejection telemetry tests with no content, no history entry, no author attribution, and redaction/log boundary tests. | Production telemetry requires separate logging/privacy approval; production remains HOLD. | Do not include in v1 history by default. Consider only as separate security metadata. |
| E3: full audit event stream | Records every accepted, rejected, viewed, exported, or administrative history action. | Highest complexity and privacy burden; can create broad surveillance/audit obligations. | Generated suggestions remain excluded unless separately approved; any rejected generated payload telemetry must store no content and stay outside manual note history. | Highest. | Highest. | Auth/audit/access/retention/export/deletion/migration tests. | Requires explicit audit-grade production approval. | Not a v1 default. |

## 7. Option Matrix: Clear/Delete Semantics

| Option | Value | Risks | User trust impact | Privacy/retention impact | Schema/API impact | Tests needed | Production implications | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| D0: clear only current value; no history exists | Simple and matches current behavior. | No recovery or audit trail. | High trust if UI says clear removes the saved current note value. | Lowest old-content retention. | None. | Existing clear tests and no-history assertions. | Production still needs explicit current-value retention policy. | Current default. |
| D1: clear current value but preserve metadata-only last-change record | Keeps truthful clear timing and generic last author without preserving old text. | Metadata after clear can confuse users if copy implies note content still exists. | Good if copy says "last manual note change/clear" and not "saved note exists." | Low text-retention risk; metadata retention still needs policy. | Current local/test fields already preserve last accepted change semantics. | Clear timestamp/author tests, empty-state copy tests, no old text tests. | Production requires retention/privacy approval. | Recommended if H1 remains the selected default. |
| D2: clear current value but preserve old note text in history | Supports recovery/audit. | Clear can be misleading if old content is still retained and visible elsewhere. | Risky unless UI explicitly says history is retained. | High; old sensitive text remains. | Requires history storage/API/UI decisions. | Clear-with-history tests, visibility tests, redaction/export tests. | Requires explicit retention/privacy/legal approval. | Do not choose silently. |
| D3: clear current value and purge old history values | Aligns clear with a stronger deletion expectation. | Conflicts with audit immutability; harder if history is append-only. | High trust if implemented correctly, but users may assume irreversible deletion. | Lower long-term content exposure; still needs proof and deletion evidence. | Requires delete/purge behavior, tombstone/null semantics, and possibly retention jobs. | Purge idempotency, authorization, migration, and evidence tests. | Production requires operational and privacy approval. | Candidate only if history is approved and privacy favors deletion. |
| D4: retention-policy controlled deletion | Balances audit, legal, and privacy needs through an approved policy. | Complex; policy exceptions can surprise reviewers. | Trust depends on clear UI copy and policy transparency. | Controlled by retention schedule, deletion rights, and legal holds. | Requires retention policy fields/jobs/access controls and evidence. | Retention clock tests, legal-hold tests if applicable, deletion/export/redaction tests. | Requires privacy/legal/ops approval before production. | Production-capable direction only after formal policy approval. |

## 8. Option Matrix: UI Exposure

| Option | Value | UX value | Risk of overclaiming | Privacy impact | Test impact | Production implications | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| U0: no history UI | Keeps current UI focused on the current manual note and metadata. | Low, but simple. | Low. | Lowest. | Existing UI tests plus no-history copy checks if needed. | Production still HOLD. | Current default. |
| U1: show only last-change metadata | Lets reviewers see when the current manual note was last changed/cleared and by generic label. | Moderate. | Medium if copy implies full history or authenticated identity. | Low if generic label and timestamp only. | UI/copy tests for metadata labels and empty/cleared states. | Production requires retention/privacy and copy approval. | Recommended with H1. |
| U2: show local/test history count or collapsed metadata events | Signals that event metadata exists without exposing old text. | Moderate for local validation. | Medium to high if users infer recoverable history. | Low to medium because event metadata is visible. | UI tests for count/collapsed events, generated-suggestion exclusion, and no content exposure. | Not production proof. | Consider only with H2 local/test approval. |
| U3: show full history viewer | Enables review of prior note values and diffs. | High for recovery. | High if local/test history is mistaken for production audit or if clear/delete expectations are unclear. | High because old note text is exposed. | Full UI, access, redaction, empty, mobile, and clear/delete tests. | Requires privacy/access-control approval before production. | Do not implement for v1 default. |
| U4: audit viewer with role/privacy controls | Supports admin/compliance review under policy. | High for audit users, not normal reviewers. | Medium if controls are correct; high if access boundaries fail. | Highest because sensitive content and actor metadata may be shown. | Auth/role/access, redaction, export, retention, and audit-view tests. | Requires audit-grade production approval. | Block until H4/C4/D4 are approved. |

## 9. Recommended V1 Default

Recommended default, unless later repo evidence or a human decision changes it:

- Keep H1 as the current effective local/test state: current value plus
  last-write metadata only.
- Do not retain old note text yet.
- Do not implement append-only history yet.
- If a next implementation is approved, prefer H2 metadata-only local/test
  history before any full note text history.
- Do not implement H3 or H4 without retention/privacy approval.
- Clear/delete should not silently preserve old note text unless explicitly
  approved.
- Clear/delete may preserve only last-change metadata under the current H1
  semantics, but UI copy must not imply that a saved note still exists after
  `manualReviewNotes: ""`.
- Generated suggestions remain copy-only, unsaved, unsnapshotted,
  unattributed, and excluded from history.
- Production remains HOLD.

The conservative product/data stance is: keep a mutable current manual note
with truthful last-write metadata. Treat note history as a separate future
decision because old note values can contain sensitive customer, sales, or PII
content and can conflict with clear/delete expectations.

## 10. Implementation Prerequisites

Before any note history/versioning implementation, record all of the following:

- Selected history storage model: H0, H1, H2, H3, or H4.
- Selected history content option: C0, C1, C2, C3, or C4.
- Selected event type option: E0, E1, E2, or E3.
- Selected clear/delete semantics: D0, D1, D2, D3, or D4.
- Selected UI exposure option: U0, U1, U2, U3, or U4.
- Whether the scope is local/test-only or production-capable.
- Whether old note text is retained, redacted, summarized, purged, or never
  stored.
- Whether retained metadata survives `manualReviewNotes: ""` clear/delete.
- Whether history appears in API responses, UI, exports, reports, evidence
  packets, logs, future dashboards, or admin/audit views.
- Privacy/retention owner approval if old text, actor data, event metadata,
  or audit content can be retained.
- DB/API approval for any new table, field, event model, migration, payload, or
  compatibility behavior.
- Test plan covering create/edit/clear, unchanged save, unrelated patch,
  generated suggestion rejection/exclusion, content retention, redaction/export
  boundaries, and UI copy.
- Production proof approval if production is ever included, with exact allowed
  commands, owners, evidence handling, redaction policy, rollback path, and
  stop conditions.

## 11. Explicit Non-Decisions

This packet does not approve:

- implementation,
- schema changes,
- API contract changes,
- runtime behavior changes,
- UI behavior changes,
- D1 migrations,
- production migration,
- production deploy,
- production proof,
- production D1 access,
- production endpoint calls,
- production logs/secrets access,
- note history implementation,
- append-only log implementation,
- old note value retention,
- full note text history,
- redacted/summarized note history,
- audit-grade history,
- retention/privacy enforcement,
- retention or deletion jobs,
- real/authenticated reviewer identity,
- generated suggestion persistence,
- generated suggestion snapshot persistence,
- generated suggestion history,
- generated suggestion attribution to humans,
- treating generated reviewer note suggestions as human-authored saved notes.

## 12. Blocked Areas Until Later Approval

- Any append-only note history table or event stream.
- Any old manual note text retention.
- Any generated suggestion snapshot/version/history.
- Any history API response fields.
- Any full history viewer.
- Any audit/admin viewer.
- Any production saved-note history.
- Any production D1 migration for note history.
- Any retention job, purge job, or privacy enforcement behavior.
- Any export/report/evidence-packet/log inclusion of note history.
- Any rejected generated payload attempt telemetry that stores request content,
  generated suggestion text, or manual note body text.

## 13. Future Approval Blocks

```yaml
manual_review_notes_v1_note_history:
  document_status: DRAFT_NOT_APPROVED
  approval_record: null
  history_storage_decision: HOLD
  history_content_decision: HOLD
  event_type_decision: HOLD
  clear_delete_semantics_decision: HOLD
  history_ui_decision: HOLD
  retention_privacy_decision: HOLD
  production_proof_decision: HOLD
  generated_suggestion_history: FORBIDDEN
  allowed_next_action: DECISION_ONLY
```

```yaml
manual_review_notes_v1_note_history_candidate:
  document_status: HUMAN_TO_FILL
  approval_record: null
  history_storage_decision:
    selected_option: null # H0 | H1 | H2 | H3 | H4
    local_test_only: true
    production_capable: false
    append_only: false
  history_content_decision:
    selected_option: null # C0 | C1 | C2 | C3 | C4
    old_note_text_retained: false
    redacted_or_summarized_content: false
    immutable_content: false
  event_type_decision:
    selected_option: null # E0 | E1 | E2 | E3
    accepted_manual_note_events: []
    rejected_generated_payload_telemetry: false
    rejected_payload_content_storage: FORBIDDEN
  clear_delete_semantics_decision:
    selected_option: null # D0 | D1 | D2 | D3 | D4
    clear_removes_current_value: true
    old_note_text_after_clear: null
    metadata_after_clear: null
    purge_required: null
  history_ui_decision:
    selected_option: null # U0 | U1 | U2 | U3 | U4
    reviewer_visible: null
    audit_role_required: null
    old_text_visible: null
  retention_privacy_decision:
    selected_option: null
    privacy_owner: null
    retention_period: null
    pii_allowed: null
    export_policy: null
    deletion_policy: null
  production_proof_decision:
    decision: HOLD
    allowed_commands: []
    forbidden_commands:
      - wrangler production deploy
      - production D1 read/write/migration
      - production endpoint smoke
      - production logs/secrets access
  generated_suggestion_history: FORBIDDEN
  allowed_next_action: DECISION_ONLY
```

## 14. Future Implementation Prompt Stub

Use only after a human fills an approval block with non-HOLD decisions:

```text
Implement the selected Manual Review Notes v1 note history/versioning semantics
from docs/roadmap/manual-review-notes-v1-note-history-versioning-decision-packet.md.
Use approval_record: <URL>. Stay local/test-safe unless production proof is
explicitly approved. Do not retain old note text unless the selected content,
clear/delete, and retention/privacy decisions explicitly approve it. Do not
persist, snapshot, version, attribute, or store generated reviewer note
suggestions in history. Implement only the selected history storage, content,
event-type, clear/delete, UI exposure, and retention/privacy options. Add
focused tests and run the repo validation commands before opening a PR.
```

## 15. Validation Expectations

For this docs-only packet:

- `git diff --check`
- `npm run check:naming`

For a future local/test-safe metadata-history implementation:

- `git diff --check`
- `npm run check:naming`
- `npm run check:schema` if schema changes are included
- focused unit/contract tests for create/edit/clear event semantics
- generated-suggestion exclusion regressions
- no-old-note-text-retention regressions if C1 is selected
- UI/copy tests if any history metadata is exposed
- `npm test`
- `npm run test:e2e:local` for reviewer UI or fake-D1 behavior changes

For any future production proof:

- Do not infer approval from this packet.
- Require a separate approval record with exact production commands, owners,
  evidence handling, redaction policy, rollback path, and stop conditions.
