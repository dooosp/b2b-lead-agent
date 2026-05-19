# Manual Review Notes V1 Reviewer Identity Decision Packet

This packet prepares Manual Review Notes v1 reviewer identity and author
attribution decisions after the local/test-safe T1 note-specific timestamp
implementation. It is documentation only.

## 1. Document Status

- Document status: `DRAFT_NOT_APPROVED`.
- Approval-intent record:
  `https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4486274314`.
- Repository: `dooosp/b2b-lead-agent`.
- Default branch: `master`.
- Post-PR124 baseline inspected:
  `940400148da52739d08b16620068536ec3f3482f`.
- Scope: reviewer identity and author attribution decision packet for Manual
  Review Notes v1.
- Runtime behavior changed by this packet: none.
- Schema/API behavior changed by this packet: none.
- Production action performed by this packet: none.

This packet does not approve reviewer identity implementation. It makes the
identity, display, author-update, privacy, and production-readiness decisions
ready for a future human/product/privacy decision.

```yaml
manual_review_notes_v1_reviewer_identity_packet:
  document_status: DRAFT_NOT_APPROVED
  approval_record: "https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4486274314"
  scope: DOCS_ONLY_DECISION_PACKET
  post_pr124_baseline: "940400148da52739d08b16620068536ec3f3482f"
  implementation_approved: false
  production_approved: false
  reviewer_identity_implemented: false
  generated_suggestion_attribution: FORBIDDEN
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
- Current manual note field: `manualReviewNotes`.
- Current provenance: `manualReviewNotesProvenance: "human_entered"` only when
  non-empty saved manual note text exists.
- Current timestamp: `manualReviewNotesUpdatedAt`, backed by
  `manual_review_notes_updated_at`, means the note-specific last accepted
  human-entered manual note change/save/clear event.
- Current clear behavior: `manualReviewNotes: ""`; clear/delete conservatively
  clears the saved current note value and updates the note-specific timestamp.
- Generated suggestions are copy-only, unsaved, unsnapshotted, not attributed
  to a reviewer, and not human-authored notes.
- Current reviewer identity: not implemented.
- Current production status: production proof, production deploy, production D1
  access, production endpoint calls, production logs/secrets, CRM, outreach,
  analytics, LLM behavior, manager dashboard v1, outcome learning, note
  history, reviewer identity, and retention/privacy enforcement remain out of
  scope unless explicitly approved later.

## 3. Problem Statement

Manual Review Notes v1 now has a truthful note-specific timestamp, but it still
does not answer:

- Who wrote or last changed the manual note?
- Is reviewer identity local/test-only or authenticated?
- Should the UI show a label, display name, email, role, or anonymous/manual
  reviewer marker?
- Is identity required for production saved-note use?
- How do privacy and PII concerns affect identity storage?
- How should clear/delete interact with author attribution?
- How should generated suggestions avoid human attribution?

Without explicit identity semantics, a future implementation could overstate
local labels as authenticated users, store PII without an approval boundary,
make weak audit claims, or accidentally attribute generated helper text to a
human reviewer.

## 4. Option Matrix: Reviewer Identity Source

| Option | Value | Risks | Auth dependency | Privacy/PII impact | Schema/API impact | UI impact | Tests needed | Production implications | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| I0: no reviewer identity | Lowest risk; matches the current shipped state. | Cannot answer who wrote, edited, or cleared a note. Weak accountability in shared review sessions. | None. | Avoids collecting reviewer personal data. | None. | UI must not imply a named author. | Regression tests that no author fields or labels are emitted. | Not enough for production audit or multi-reviewer accountability. | Keep as current default until identity is explicitly approved. |
| I1: local/test-only static reviewer label | Gives demos and local tests a simple non-authenticated label, for example `manual_reviewer`. | Spoofable and not proof of a real person. Can be mistaken for auth if copy is careless. | None. | Low if generic; no real PII should be stored. | Requires explicit field approval if persisted or returned. Could also be display-only local copy. | Can show a generic local/test author marker. Must disclose non-authenticated meaning. | Unit/UI tests for generic label copy and no auth claim. | Production remains HOLD. Must not be represented as authenticated identity. | Acceptable only for local/test implementation if no real PII or auth claim is made. |
| I2: operator-provided local reviewer label | Lets a local reviewer type a label for handoff or test notes. | User-entered label may include names/emails and may be inaccurate. Label changes can confuse authorship. | None, unless later bound to auth. | Medium. Operator may enter PII, team names, or sensitive internal labels. | Requires field, validation, clear behavior, and likely API response semantics if persisted. | UI can show the entered local label with careful non-auth copy. | Validation tests, clear/reset tests, no-generated-suggestion attribution tests, and label display tests. | Production remains HOLD without privacy review. | Possible local/test option if copy says it is operator-provided and not verified identity. |
| I3: authenticated reviewer ID from auth/session | Provides a stable actor for create/edit/clear when auth semantics exist. | Requires auth/session model, user lifecycle rules, and access-control behavior. | Required. Needs approved auth/session source. | Medium to high. Reviewer IDs, display names, or emails can be personal data. | Requires schema/API approval, serializer behavior, migration/null behavior, and compatibility rules. | UI may show an approved display value or generic authenticated marker. | Auth-bound unit/contract tests, unauthorized/forbidden tests, privacy redaction tests, and no-generated-suggestion attribution tests. | Candidate production path only after auth, privacy, access-control, and production-readiness approval. | Do not implement until auth/session semantics are confirmed. |
| I4: audit-grade reviewer identity with role/source | Supports audit claims with actor, role, source, system/manual distinction, and possibly reason. | Highest complexity. Creates stronger legal/privacy obligations and audit expectations. | Required. Needs robust auth, roles, source classification, and operational ownership. | High. Actor metadata and role/source records may require retention and legal review. | Requires schema/API/event model approval and likely note history or audit table decisions. | UI must avoid exposing sensitive identity fields broadly. | End-to-end auth/audit tests, role/source tests, retention/delete tests, export/redaction tests, and tamper-resistance expectations. | Only appropriate with explicit production, audit, privacy/legal, and operational owner approval. | Do not choose for v1 default unless audit-grade identity is a hard requirement. |

## 5. Option Matrix: Author Display Semantics

| Option | Value | Misleading-risk | Privacy risk | UX value | Localization/copy impact | Tests needed | Production implications | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| D0: do not display author | Avoids false identity and PII exposure. | Low, as long as UI does not imply hidden authorship exists. | Lowest. | Low. Reviewers see note text and timestamp but not author. | Minimal copy. Timestamp copy can stay note-specific. | Regression tests that no author label appears. | Production still needs an identity decision if accountability is required. | Current safest default. |
| D1: display `수동 리뷰어` / generic manual reviewer label | Signals that the note is human-entered without naming a person. | Medium if users assume a specific person. Copy must stay generic. | Low if no PII is stored. | Moderate. Helps distinguish manual notes from generated suggestions. | Requires Korean/English generic copy and clear distinction from generated helper text. | UI/copy tests for generic label and generated suggestion separation. | Production may still need real identity before saved-note use. | Preferred local/test display if an author marker is needed before auth. |
| D2: display local reviewer label | Gives local demos and handoffs a visible operator-provided author label. | Medium to high if the label is treated as verified identity. | Medium because the label may contain PII. | Moderate to high for local multi-operator testing. | Requires copy like `local label` or `operator-provided label`; may need validation/error text. | Input validation, rendering, clearing, and persistence-boundary tests. | Production HOLD until privacy and identity source are approved. | Use only for local/test if the human selects operator-provided labels. |
| D3: display authenticated reviewer display name | Human-friendly display for accountable multi-reviewer notes. | Medium. Display names can change or collide; not audit-grade by themselves. | Medium to high, depending on names and directory source. | High for authenticated workflows. | Requires approved display-name copy, null fallback, and localization. | Auth/session tests, display fallback tests, privacy redaction tests, and access-control tests. | Possible production path only with auth/privacy approval. | Do not implement before auth/session and display-name semantics are confirmed. |
| D4: display role plus reviewer ID/email with privacy controls | Highest explicitness for audits and operations. | Medium if shown to unauthorized users, or if role/email implies more authority than intended. | High. Email and identifiers are PII and may be sensitive. | High for admin/audit views, often too much for normal reviewer UI. | Requires privacy-aware copy, role labels, access-controlled rendering, and redaction language. | Role/access tests, redaction/export tests, retention tests, and unauthorized visibility tests. | Requires explicit privacy/legal and production approval. | Not a v1 default. Reserve for approved audit/admin scope. |

## 6. Option Matrix: Author Update Rules

| Option | Value | Relation to `manualReviewNotesUpdatedAt` | Note history dependency | Retention/privacy impact | Tests needed | Production implications | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| U0: no author updates | Matches current state and avoids false identity. | Timestamp changes without author metadata. | None. | Lowest; no identity retained. | Regression tests that no author fields change on create/edit/clear. | Insufficient if production requires accountability. | Current default. |
| U1: set last author only on create/edit/clear | Pairs the current-value note timestamp with the actor of the last accepted manual note event. | `manualReviewNotesUpdatedAt` and last-author update together only when note text actually changes or is cleared. | No prior note body history required. | Stores only current last actor; lower than full history but still identity data. | Create/edit/clear tests, unchanged-save tests, unrelated-patch tests, generated-suggestion rejection tests, and clear semantics tests. | Plausible minimal production path after auth/privacy/schema approval. | Recommended future implementation shape if identity is approved without history. |
| U2: set created-by and updated-by | Separates original note author from last changer. | `createdBy` set only on first accepted non-empty save; `updatedBy` follows later accepted edit/clear events with `manualReviewNotesUpdatedAt`. | No prior note body history required, but first-save semantics must be defined. | Retains more identity metadata after edits and possibly after clear. | First-save/edit/clear/null-backfill tests, clear behavior tests, and privacy redaction tests. | Needs more schema/API and retention decisions than U1. | Consider only if original author matters to product decisions. |
| U3: append author changes into history/audit log | Provides full actor trail for create/edit/clear events. | Each note event has its own timestamp and author. `manualReviewNotesUpdatedAt` may become a derived latest-event field. | Required. Needs history or audit event model. | Highest. Retains actor metadata and likely note body/event details. | Audit append tests, access-control tests, retention/delete tests, export/redaction tests, and migration tests. | Requires explicit audit, retention, privacy/legal, and production approval. | Do not choose for v1 default. |

## 7. Option Matrix: Privacy / PII

| Option | Value | Risk | PII exposure | Deletion/clear semantics | Docs and UI copy impact | Production implications | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P0: no identity stored | Lowest privacy risk; current behavior. | No accountability by person. | None for reviewer identity. Note text itself may still contain sensitive business data. | Clear/delete affects only current note text and note timestamp, not identity. | Docs must say reviewer identity is not implemented. | Production accountability remains unresolved. | Current safest default. |
| P1: generic local label only | Distinguishes manual human input from generated suggestions without naming a person. | Generic label can still imply more certainty if copy is sloppy. | Low if value is fixed and non-personal. | Clear/delete may retain the generic event marker only if an approved field exists. | UI can use generic copy such as `수동 리뷰어`; docs must say non-authenticated. | Production still HOLD unless generic attribution is explicitly accepted. | Preferred local/test display default if an author marker is needed. |
| P2: pseudonymous reviewer ID | Supports accountability without display name/email. | Re-identification is still possible; mapping owner and access must be defined. | Medium. Pseudonymous IDs can still be personal data. | Clear/delete policy must decide whether last pseudonymous actor remains after note text is cleared. | Docs must define pseudonym source, owner, and display fallback. | Needs auth/session and privacy approval before production. | Possible future production option if privacy favors minimal display data. |
| P3: display name/email with explicit privacy approval | Human-readable author info for collaborative review. | Higher exposure in UI, exports, logs, screenshots, and support workflows. | High. Names and emails are personal data. | Clear/delete must define whether author data is retained, hidden, redacted, or deleted. | UI copy, access controls, docs, export policy, and redaction language required. | Requires explicit privacy and production approval. | Do not implement without approval. Prefer display name over email if approved. |
| P4: audit-grade identity with retention/legal approval | Supports compliance-style audit and operational accountability. | Highest governance burden; deletion requests and retention exceptions may conflict. | Highest. Actor, role, source, timestamps, and event history may all be sensitive. | Clear/delete likely creates a tombstone or audit event rather than removing all identity records. | Extensive documentation, admin-only UI, retention copy, and access-control language required. | Requires legal/privacy, auth, operations, schema/API, and production approvals. | Not a v1 default. |

## 8. Recommended V1 Default

Recommended default, unless later repo evidence or a human decision changes it:

- For the next local/test-only implementation, prefer I1 or I2 only if no real
  PII or authenticated identity claims are made.
- Prefer a generic label or clearly operator-provided local label over email or
  authenticated identity.
- Prefer D0 by default, or D1 if reviewers need a visible author marker that
  only means "human manual note."
- If identity is later approved without note history, prefer U1: last author
  only on accepted manual note create/edit/clear events, synchronized with
  `manualReviewNotesUpdatedAt`.
- Do not implement authenticated reviewer identity until auth/session semantics
  are confirmed.
- Do not implement audit-grade identity without retention/privacy approval.
- Do not connect reviewer identity to generated suggestions.
- Production remains HOLD.
- Generated suggestions remain copy-only, unsaved, unsnapshotted, unattributed
  to a reviewer, and not human-authored notes.

## 9. Implementation Prerequisites

Before any reviewer identity or author attribution implementation, record all
of the following:

- Selected reviewer identity source option: I0, I1, I2, I3, or I4.
- Selected author display option: D0, D1, D2, D3, or D4.
- Selected author update rule: U0, U1, U2, or U3.
- Selected privacy/PII option: P0, P1, P2, P3, or P4.
- Whether the scope is local/test-only or production-capable.
- Whether identity is display-only, persisted current-value metadata, or
  audit/history metadata.
- Whether identity remains after `manualReviewNotes: ""` clear/delete.
- Whether author metadata appears in API responses, UI, exports, reports,
  logs, evidence packets, or future dashboards.
- Auth/session source, if any, plus null/backfill behavior for existing notes.
- Privacy owner approval if any real reviewer identifier, display name, or
  email can be stored or shown.
- Test plan covering create/edit/clear, unchanged save, unrelated patch,
  generated suggestion rejection, visibility/access controls, localization
  copy, and redaction/export boundaries.
- Production proof approval if production is ever included, with exact allowed
  commands, owners, redaction policy, rollback path, and stop conditions.

## 10. Explicit Non-Decisions

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
- reviewer identity implementation,
- authenticated reviewer identity implementation,
- reviewer display-name implementation,
- author audit trail implementation,
- note history/versioning implementation,
- retention/privacy enforcement,
- retention or deletion jobs,
- generated suggestion persistence,
- generated suggestion snapshot persistence,
- generated suggestion attribution to humans,
- treating generated reviewer note suggestions as human-authored saved notes.

## 11. Blocked Areas Until Later Approval

- Authenticated reviewer identity source.
- Display names, emails, role labels, or admin/audit identity views.
- Author metadata in exports, reports, evidence packets, logs, or future
  dashboards.
- Original-author or last-author schema/API fields.
- Append-only note history or audit event tables.
- Retention jobs, hard-delete policy, or privacy enforcement.
- Production saved-note use, production proof, production D1 migration, or
  production observation claims.

## 12. Future Approval Blocks

```yaml
manual_review_notes_v1_reviewer_identity:
  document_status: DRAFT_NOT_APPROVED
  approval_record: null
  reviewer_identity_decision: HOLD
  author_display_decision: HOLD
  author_update_rule_decision: HOLD
  privacy_pii_decision: HOLD
  production_proof_decision: HOLD
  generated_suggestion_attribution: FORBIDDEN
  allowed_next_action: DECISION_ONLY
```

```yaml
manual_review_notes_v1_reviewer_identity_candidate:
  document_status: HUMAN_TO_FILL
  approval_record: null
  reviewer_identity_decision:
    selected_option: null # I0 | I1 | I2 | I3 | I4
    identity_source: null
    local_test_only: true
    authenticated_identity: false
  author_display_decision:
    selected_option: null # D0 | D1 | D2 | D3 | D4
    display_copy: null
    localization_owner: null
  author_update_rule_decision:
    selected_option: null # U0 | U1 | U2 | U3
    update_on_create: null
    update_on_edit: null
    update_on_clear: null
    relation_to_manualReviewNotesUpdatedAt: null
  privacy_pii_decision:
    selected_option: null # P0 | P1 | P2 | P3 | P4
    pii_allowed: null
    identity_retained_after_clear: null
    export_policy: null
    privacy_owner: null
  production_proof_decision:
    decision: HOLD
    allowed_commands: []
    forbidden_commands:
      - wrangler production deploy
      - production D1 read/write/migration
      - production endpoint smoke
      - production logs/secrets access
  generated_suggestion_attribution: FORBIDDEN
  allowed_next_action: DECISION_ONLY
```

## 13. Future Implementation Prompt Stub

Use only after a human fills an approval block with non-HOLD decisions:

```text
Implement the selected Manual Review Notes v1 reviewer identity and author
attribution semantics from
docs/roadmap/manual-review-notes-v1-reviewer-identity-decision-packet.md.
Use approval_record: <URL>. Stay local/test-safe unless production proof is
explicitly approved. Do not attribute generated reviewer note suggestions to a
human reviewer. Do not persist generated suggestions. Implement only the
selected reviewer identity source, author display, author update rule, and
privacy/PII options. Add focused tests and run the repo validation commands
before opening a PR.
```

## 14. Validation Expectations

For this docs-only packet:

- `git diff --check`
- `npm run check:naming`

For a future local/test-safe reviewer identity implementation:

- `git diff --check`
- `npm run check:naming`
- `npm run check:schema` if schema changes are included
- focused unit/contract tests for selected create/edit/clear identity semantics
- UI/copy tests for selected display behavior
- generated-suggestion non-attribution regressions
- `npm test`
- `npm run test:e2e:local` for reviewer UI or fake-D1 behavior changes

For any future production proof:

- Do not infer approval from this packet.
- Require a separate approval record with exact production commands, owners,
  evidence handling, redaction policy, rollback path, and stop conditions.
