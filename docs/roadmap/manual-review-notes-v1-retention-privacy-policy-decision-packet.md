# Manual Review Notes V1 Retention / Privacy Policy Decision Packet

This packet prepares Manual Review Notes v1 retention and privacy policy
decisions after the local/test-safe current-value note, note-specific timestamp,
generic author label, and H2 metadata-only history work. It is documentation
only.

## 1. Document Status

- Document status: `DRAFT_NOT_APPROVED`.
- Approval-intent record:
  `https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4492814282`.
- Repository: `dooosp/b2b-lead-agent`.
- Default branch: `master`.
- Post-PR128 baseline inspected:
  `4d743414a8f1ee8037beb166c769ed2bfb8c176c`.
- Scope: retention/privacy policy decision packet for Manual Review Notes v1.
- Runtime behavior changed by this packet: none.
- UI behavior changed by this packet: none.
- Schema/API behavior changed by this packet: none.
- D1 migration performed by this packet: none.
- Retention/privacy enforcement performed by this packet: none.
- Production action performed by this packet: none.

This packet does not approve implementation. It makes current-value note
retention, metadata-only history retention, clear/delete semantics,
PII/sensitive-content handling, export/visibility, and production-readiness
decisions ready for a future human/product/privacy decision.

```yaml
manual_review_notes_v1_retention_privacy_packet:
  document_status: DRAFT_NOT_APPROVED
  approval_record: "https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4492814282"
  scope: DOCS_ONLY_DECISION_PACKET
  post_pr128_baseline: "4d743414a8f1ee8037beb166c769ed2bfb8c176c"
  implementation_approved: false
  production_approved: false
  retention_enforcement_approved: false
  generated_suggestion_retention: FORBIDDEN
  old_new_note_text_history: FORBIDDEN
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
- PR #127 added the docs-only Manual Review Notes v1 note history/versioning
  decision packet.
- PR #128 implemented local/test-only H2 metadata-only manual note history.
- Current manual note field: `manualReviewNotes`.
- Current provenance: `manualReviewNotesProvenance: "human_entered"` only when
  non-empty saved manual note text exists.
- Current timestamp: `manualReviewNotesUpdatedAt`, backed by
  `manual_review_notes_updated_at`, means the note-specific last accepted
  human-entered manual note change/save/clear event.
- Current author label: `manualReviewNotesAuthorLabel`, backed by
  `manual_review_notes_author_label`, uses only the fixed non-PII value
  `manual_reviewer`.
- Current metadata history: `manual_review_note_events` stores metadata-only
  create/edit/clear events.
- Current clear behavior: `manualReviewNotes: ""` clears the current saved
  manual note value, updates the note-specific timestamp, keeps the generic
  author label for the accepted manual-note change, and appends a metadata-only
  clear event.
- Current history behavior: metadata-only; no old manual note text and no new
  manual note text are stored in history.
- Generated suggestions: copy-only, unsaved, unattributed, not history entries,
  and not human-authored notes.
- Current production status: no production proof and no production deploy.

## 3. Problem Statement

Manual Notes v1 now has current-value notes and metadata-only history locally,
but production or broader use still needs explicit retention/privacy semantics:

- How long can current manual note text be retained?
- What exactly does clear/delete mean?
- Should metadata-only history survive clear/delete?
- Should note-specific timestamps survive clear/delete?
- Should generic author labels survive clear/delete?
- What happens if manual note text contains sensitive sales context or PII?
- Are manual notes exportable?
- Are manual notes searchable or visible to managers later?
- What must be decided before production saved-note use?

Without these decisions, a future implementation could keep sensitive
operator-entered sales context longer than expected, overstate metadata-only
events as audit/legal proof, confuse current-value clearing with hard deletion,
or accidentally expand copy-only generated suggestions into retained product
data.

## 4. Option Matrix: Current Manual Note Text Retention

| Option | Value | Risks | PII exposure | Clear/delete impact | Schema/API impact | UI impact | Tests needed | Production implications | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R0: local/test-only current value, no production retention policy | Keeps the current implementation bounded and truthful. | Does not answer production obligations; local test data can still contain sensitive examples if users type them. | Low for production because production is not approved; local artifacts must still avoid real PII. | Clear removes only the local current value through `manualReviewNotes: ""`. | None. | Existing local copy can remain focused on current value and clear state. | Existing save/edit/clear regressions and generated-suggestion exclusion tests. | Production saved-note use remains HOLD. | Current state; keep until a policy option is selected. |
| R1: retain current value until explicit clear/delete | Simple product model: the saved note is the latest human-entered value until a reviewer clears it. | Sensitive note text may remain indefinitely if reviewers forget to clear it. | Medium. Manual notes can contain buyer names, internal deal context, or other personal/business-sensitive data. | Clear/delete removes the current saved value, but metadata survival needs a separate decision. | No new field required for local/test; production would still need policy, copy, and evidence gates. | UI must state clear removes the saved current note value, not all metadata or audit records. | Clear behavior, empty-state, export/log exclusion, and generated-suggestion exclusion tests. | Plausible minimal production policy only after explicit privacy/product approval. | Recommended local/test default for current value; not production approval. |
| R2: retain current value for a time-bounded period | Limits long-term exposure of sensitive user-entered text. | Requires clocks, jobs, idempotency, user expectations, and deletion evidence. | Lower long-term exposure if enforced correctly; still sensitive while retained. | Explicit clear removes current value before the retention period; expiry removes it later if not cleared. | Requires retention policy fields or job behavior if enforced. | UI must explain expiry or avoid making expiry claims until implemented. | Retention clock tests, purge idempotency, clear-vs-expiry tests, and no-generated-suggestion retention tests. | Requires explicit retention enforcement, operations, and production approval. | Good future option if a policy owner can define a period; not a v1 default. |
| R3: retain current value with role-gated access and explicit privacy approval | Supports broader reviewer/manager use while limiting who can see note text. | Access control mistakes can expose sensitive text; still lacks expiry unless paired with R2/R4. | Medium to high depending on roles, exports, screenshots, and support workflows. | Clear removes the current value for authorized viewers; metadata and access logs need policy. | Requires auth/roles/API visibility decisions before production. | UI must show notes only to approved roles and avoid manager visibility expansion by default. | Auth/role visibility tests, unauthorized tests, redaction/export tests, and clear tests. | Candidate only after auth, privacy, and production-readiness gates. | Do not choose by default; use only if manager/reviewer collaboration requires it. |
| R4: production retention with legal/compliance policy | Formal production policy for retention schedule, deletion exceptions, owner, evidence, and controls. | Highest governance and implementation burden; legal holds can conflict with reviewer expectations. | Governed but potentially highest because production data is retained under formal policy. | Clear/delete may remove current value, create a tombstone, or defer deletion under policy. | Requires policy metadata, retention jobs, access controls, audit/evidence design, and migrations if needed. | UI and docs must explain deletion, retention exceptions, and user-visible outcomes. | Full retention, access, deletion request, legal hold, export, redaction, migration, and production proof tests. | Requires explicit legal/privacy/ops/product approval before production use. | Block for v1 unless formal retention is mandatory. |

## 5. Option Matrix: Metadata-Only History Retention

| Option | Value | Risks | PII exposure | Clear/delete impact | Old/new note text boundary | Tests needed | Production implications | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M0: no metadata history retention beyond local/test | Avoids production history claims and minimizes retained event metadata. | Loses event sequence outside local/test; cannot support production accountability. | Low if production is not used. | Clear behavior remains local/test only. | No old/new note text is retained. | Local metadata tests only; no production-history tests. | Production history remains HOLD. | Current production boundary. |
| M1: preserve metadata-only history across clear/delete | Keeps create/edit/clear facts without retaining note bodies. | Event timing and activity metadata can be mistaken for audit proof. | Low to medium. The fixed `manual_reviewer` label is non-PII, but event timing and lead relation are still retained metadata. | Clear appends/preserves a metadata-only clear event while current value becomes empty. | Old/new note text remains forbidden in history. | Event append, clear-event, no-text-retention, and generated-suggestion exclusion tests. | Possible local/test default; production requires retention/privacy approval. | Recommended local/test default for H2 metadata-only history, with no audit/legal claim. |
| M2: purge metadata-only history when current note is cleared | Aligns clear/delete with a stronger privacy expectation. | Removes useful event facts and may obscure whether a clear happened. | Lowest retained metadata after clear. | Clear removes current value and deletes prior metadata events. | Old/new note text remains forbidden. | Purge idempotency, clear/delete, no-stale-summary, and fixture hygiene tests. | Requires explicit purge behavior and deletion evidence before production. | Consider only if privacy policy says clear must remove event metadata too. |
| M3: time-bound metadata-only history | Balances operational context with limited retention. | Requires retention clocks/jobs and clear user expectations. | Lower long-term event metadata exposure if enforced correctly. | Clear may preserve a clear event until the metadata retention period expires. | Old/new note text remains forbidden. | Retention job, clock, expiry, clear-event, and no-content tests. | Requires retention enforcement approval. | Good later option if metadata is useful but should expire. |
| M4: audit-grade metadata retention with privacy/legal approval | Supports formal event evidence without note body retention. | Can still create audit/legal obligations and deletion-request conflicts. | Medium. Actor/source/lead/timestamp metadata can be sensitive even without note text. | Clear likely preserves an audit event or tombstone under policy. | Old/new note text remains forbidden unless a separate content-retention decision approves it. | Audit metadata, access-control, export/redaction, retention, deletion exception, and production proof tests. | Requires explicit privacy/legal/ops/product approval. | Not a v1 default. |

## 6. Option Matrix: Clear/Delete Semantics

| Option | Value | User trust impact | Privacy risk | Retention impact | Implementation complexity | Tests needed | Production implications | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| D0: clear current value only; metadata may remain | Simple current-value semantics. | Good if copy says clear removes the saved note text only. | Low for note text, medium for retained metadata. | Current note text is gone; metadata retention remains separately governed. | Low; matches current local/test value-clearing behavior. | Clear current value, empty state, metadata summary, and no old-text tests. | Production requires policy wording before use. | Acceptable local/test semantics if clearly documented. |
| D1: clear current value and preserve metadata-only clear event | Preserves truthful fact of a clear without retaining note bodies. | Good if UI/docs avoid saying all evidence was deleted. | Low for text; low to medium for event metadata. | Current value cleared; create/edit/clear metadata survives. | Low to moderate; current H2 local/test behavior already does this. | Clear-event append, event count, last-event type, timestamp/author label, and no-text tests. | Recommended production candidate only after policy approval. | Recommended v1 local/test default. |
| D2: clear current value and purge metadata history | Stronger privacy semantics for users expecting deletion. | High trust if accurately implemented; confusing if users expect audit trail. | Lowest retained note-related data after clear. | Removes current value and metadata events. | Moderate; needs purge behavior and stale-summary handling. | Purge idempotency, summary reset, no stale event, and generated-suggestion exclusion tests. | Requires explicit deletion enforcement approval. | Hold unless privacy decision selects purge. |
| D3: clear current value, preserve minimal tombstone only | Proves that a clear happened without preserving the full event stream. | Good if tombstone is explained as metadata, not note content. | Low; still retains lead relation and clear timestamp. | Current value removed; prior events may be collapsed into a minimal clear marker. | Moderate; requires tombstone model and migration/backfill semantics. | Tombstone creation, prior event removal/collapse, visibility, and no-text tests. | Possible production compromise after approval. | Consider later if M1 is too much and M2 is too little. |
| D4: production deletion workflow with retention/legal controls | Formal deletion semantics with owners, evidence, exceptions, and stop conditions. | Trust depends on clear policy and no hidden behavior. | Governed but complex; legal holds can preserve data despite clear. | Controlled by retention schedule, deletion rights, and exceptions. | High; requires workflow, controls, evidence, and access policy. | Deletion workflow, authorization, legal hold, retention job, evidence, export/redaction, and rollback tests. | Requires explicit legal/privacy/ops/product approval. | Not a v1 default. |

## 7. Option Matrix: PII / Sensitive Content Handling

| Option | Value | False-positive/false-negative risk | User friction | Privacy value | Implementation complexity | Tests needed | Production implications | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P0: no automated detection; docs-only warning | Keeps current behavior unchanged while documenting risk. | No automated detection means all sensitive content can pass through. | None in UI. | Low to moderate; depends on operator discipline and docs. | None. | Docs validation only plus existing save/edit/clear tests. | Production remains HOLD. | Current docs-only default. |
| P1: local UI warning that manual notes may contain sensitive content | Reminds reviewers before entering note text. | Does not detect anything; users can ignore the warning. | Low. | Moderate; improves expectation setting. | Low UI/copy change if later approved. | UI copy tests and no-behavior-regression tests. | Could be local/test-safe later, but still not production enforcement. | Preferred future lightweight local UI step if human approves it. |
| P2: local/test-only lightweight validation or warning for obvious sensitive patterns | Catches some obvious emails, phone-like strings, or identifiers in test flows. | High false positives and false negatives; pattern checks can create false confidence. | Medium. | Moderate for obvious cases only. | Moderate; needs careful non-blocking or blocking semantics. | Pattern fixtures, false-positive cases, override/clear behavior, and no-generated-suggestion tests. | Not production-grade. Requires explicit approval. | Use only as local/test experiment, not compliance. |
| P3: policy-gated production detection/redaction workflow | Adds production-capable detection, redaction, review, and storage rules. | Detection/redaction can miss sensitive data or redact useful context. | Medium to high. | High if governed and measured. | High; requires policy, owners, tooling, access controls, logs/evidence boundaries. | Detection/redaction fixtures, access/export tests, retention tests, monitoring, and production proof gates. | Requires privacy/legal/ops/product approval. | Block for v1 unless production policy requires it. |
| P4: external privacy/legal review before production use | Creates explicit owner signoff before production saved-note use. | Does not itself detect content; review can still miss edge cases without implementation. | None for local/test; process friction before production. | High governance value. | Low implementation now, high coordination later. | Approval-record checks and blocked-action documentation. | Required before production saved-note retention if real users/data are involved. | Recommended gate before any production saved-note use. |

## 8. Option Matrix: Export / Visibility

| Option | Value | Risk | Privacy impact | Product value | Tests needed | Production implications | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E0: no new export/manager visibility | Keeps manual notes and metadata on existing local/test reviewer surfaces only. | Limits downstream review workflows. | Lowest. | Low to moderate for current reviewer workflow. | Regression tests that no new export fields are added. | Production/export remains HOLD. | Current recommended default. |
| E1: current compatibility only, no metadata history export | Preserves any existing behavior while excluding event history. | Current note visibility must be audited if exports already include notes. | Low to medium depending on existing current-note exposure. | Moderate compatibility value. | Export/CSV/API compatibility tests and no-history-export tests. | Needs explicit production export policy before production. | Acceptable if current compatibility is required. |
| E2: export current manual note only | Supports handoff of the latest reviewer-entered text. | Exports can spread sensitive note text beyond the reviewer UI. | Medium to high. | Higher for team handoff. | Export inclusion, redaction, clear behavior, and access tests. | Requires privacy/export approval before production. | Do not add now. |
| E3: export metadata-only history summary | Provides event count/last-event facts without note bodies. | Metadata can be overread as audit proof or expose reviewer activity timing. | Low to medium. | Moderate for operations and debugging. | Export summary, no-text, clear-event, and generated-suggestion exclusion tests. | Requires retention/privacy and export approval. | Hold until policy selects metadata export. |
| E4: role-gated manager visibility or export with privacy controls | Supports manager review and operations with access controls. | Role bugs or broad exports can expose sensitive note text/metadata. | High if note text or identity is visible. | High for manager workflows if needed. | Auth/role, unauthorized, redaction/export, audit, and retention tests. | Requires auth/privacy/product/production approval. | Not a v1 default. |

## 9. Option Matrix: Production Readiness

| Option | Value | Prerequisites | Risks | Evidence needed | Blocked actions | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| G0: production remains HOLD | Keeps current no-production-action boundary intact. | None beyond current docs. | Does not prove production saved-note behavior. | Repo preflight, docs validation, and PR evidence only. | Production deploy, production D1, production endpoints, logs/secrets, production proof. | Current required state. |
| G1: local/test only with no production claims | Allows local/docs/test iteration while staying honest. | Clean repo, scoped approval, local validation. | Local behavior may be mistaken for production if docs are sloppy. | Local tests, fake-D1 evidence if behavior changes, no-production boundary statements. | Production access, production D1 migrations, production smoke tests. | Recommended for this packet and current implementation. |
| G2: production proof planning only | Prepares owners, commands, stop conditions, and evidence policy without execution. | Product/privacy/DB/API/evidence owner placeholders. | Planning can be mistaken for approval. | Approval packet, exact command candidates, evidence redaction/storage policy, rollback plan. | Executing commands, touching production data, deploys. | Safe future planning step only. |
| G3: production proof with explicit separate approval | Allows narrowly scoped proof after all owners and commands are approved. | Explicit approval record, production owner, DB owner, evidence owner, retention/privacy policy, exact commands. | Writes, lazy migrations, sensitive data exposure, or evidence leakage if scope is wrong. | CI green, local validation, exact command transcript, redacted evidence, stop conditions, rollback path. | Anything not named by the approval record. | Do not infer from this packet; require a separate prompt. |
| G4: production rollout after retention/privacy/auth gates | Enables production saved-note use under approved policy. | Retention/privacy decision, auth/access decision if needed, DB/API migration approval, export policy, monitoring, rollback. | Highest operational/privacy exposure. | Full validation, CI, migration proof, access-control proof, retention/deletion evidence, production owner signoff. | Generated suggestion retention, old/new note text history, unmanaged exports unless separately approved. | Block until all gates are explicitly approved. |

## 10. Recommended V1 Default

Recommended default, unless later repo evidence or a human decision changes it:

- Keep production HOLD.
- Keep current implementation local/test-only.
- Retain current manual note value locally until explicit clear/delete.
- Preserve metadata-only event history locally for create/edit/clear, but do
  not treat it as audit/legal retention proof.
- Do not store old/new note text in history.
- Do not retain generated suggestion content.
- Do not add real reviewer identity.
- Do not add exports or manager visibility expansion yet.
- Do not enforce retention/privacy automatically until a later explicit
  implementation decision.
- Prefer a future lightweight local UI privacy warning only if human approves
  it.
- Any production proof must wait for explicit production boundary approval.

The conservative product/data stance is: current manual note text is useful
local/test reviewer context, but it may contain sensitive sales context or PII.
Keep text retention minimal, keep history metadata-only, keep generated
suggestions outside retention/history entirely, and require separate
privacy/product/production approval before broader use.

## 11. Implementation Prerequisites

Before any retention/privacy implementation, record all of the following:

- Selected current-note retention option: R0, R1, R2, R3, or R4.
- Selected metadata-only history retention option: M0, M1, M2, M3, or M4.
- Selected clear/delete semantics: D0, D1, D2, D3, or D4.
- Selected PII/sensitive-content handling option: P0, P1, P2, P3, or P4.
- Selected export/visibility option: E0, E1, E2, E3, or E4.
- Selected production-readiness option: G0, G1, G2, G3, or G4.
- Whether current manual note text can contain PII or sensitive sales context.
- Whether metadata-only events survive clear/delete.
- Whether note-specific timestamps and generic author labels survive
  clear/delete.
- Whether notes or metadata appear in API responses, UI, exports, reports,
  evidence packets, logs, future dashboards, manager views, or admin/audit
  views.
- Privacy/product owner approval for any production saved-note use, export,
  manager visibility, detection/redaction, purge/delete job, or retention job.
- DB/API approval for any new field, table, migration, payload, retention
  worker, purge path, or compatibility behavior.
- Test plan covering create/edit/clear, metadata survival/purge, generated
  suggestion exclusion, no old/new note text history, export/log boundaries,
  PII warning/detection behavior if selected, access controls if selected, and
  production-proof gates if selected.

## 12. Explicit Non-Decisions

This packet does not approve:

- implementation,
- schema/API changes,
- runtime/UI changes,
- D1 migrations,
- production migration,
- production deploy,
- production proof,
- production D1 access,
- production endpoint calls,
- retention enforcement,
- purge/delete jobs,
- redaction,
- automated PII detection,
- export expansion,
- manager visibility expansion,
- real reviewer identity,
- old note value retention,
- generated suggestion persistence,
- generated suggestion history,
- generated suggestion attribution to humans.

## 13. Blocked Areas Until Later Approval

- Production saved-note use.
- Production retention or deletion policy enforcement.
- Production D1 migration for retention, deletion, redaction, export, or
  visibility behavior.
- Any retention job, purge job, delete workflow, redaction workflow, or
  automated PII detection.
- Any old/new manual note text history.
- Any generated suggestion retention, snapshotting, versioning, history, export,
  or attribution.
- Any real/authenticated reviewer identity, display name, email, or audit actor.
- Any manager visibility expansion, export expansion, report inclusion, or
  evidence-packet inclusion for manual note text or metadata.
- Any production endpoint, production D1, production logs/secrets, Wrangler
  production command, or production smoke test.

## 14. Future Approval Blocks

```yaml
manual_review_notes_v1_retention_privacy:
  document_status: DRAFT_NOT_APPROVED
  approval_record: null
  current_note_retention_decision: HOLD
  metadata_history_retention_decision: HOLD
  clear_delete_semantics_decision: HOLD
  pii_sensitive_content_decision: HOLD
  export_visibility_decision: HOLD
  production_readiness_decision: HOLD
  generated_suggestion_retention: FORBIDDEN
  old_new_note_text_history: FORBIDDEN
  allowed_next_action: DECISION_ONLY
```

```yaml
manual_review_notes_v1_retention_privacy_candidate:
  document_status: HUMAN_TO_FILL
  approval_record: null
  current_note_retention_decision:
    selected_option: null # R0 | R1 | R2 | R3 | R4
    local_test_only: true
    retention_period: null
    clear_removes_current_value: true
  metadata_history_retention_decision:
    selected_option: null # M0 | M1 | M2 | M3 | M4
    preserve_metadata_after_clear: null
    retention_period: null
    audit_claim_allowed: false
  clear_delete_semantics_decision:
    selected_option: null # D0 | D1 | D2 | D3 | D4
    purge_current_value: true
    purge_metadata_history: null
    tombstone_allowed: null
    legal_hold_or_exception_policy: null
  pii_sensitive_content_decision:
    selected_option: null # P0 | P1 | P2 | P3 | P4
    pii_allowed_in_manual_notes: null
    warning_required: null
    automated_detection: false
    redaction_required: false
    privacy_owner: null
  export_visibility_decision:
    selected_option: null # E0 | E1 | E2 | E3 | E4
    current_note_export_allowed: false
    metadata_history_export_allowed: false
    manager_visibility_allowed: false
    access_control_owner: null
  production_readiness_decision:
    selected_option: null # G0 | G1 | G2 | G3 | G4
    production_proof_allowed: false
    allowed_commands: []
    forbidden_commands:
      - wrangler production deploy
      - production D1 read/write/migration
      - production endpoint smoke
      - production logs/secrets access
  generated_suggestion_retention: FORBIDDEN
  old_new_note_text_history: FORBIDDEN
  allowed_next_action: DECISION_ONLY
```

After PR #129, a non-production implementation comment selected only the
lightweight P1 local/test reviewer-facing warning. This selection does not
approve production saved-note use, retention enforcement, automated detection,
redaction, purge/delete jobs, exports, manager visibility, old/new note text
history, or generated suggestion retention.

```yaml
manual_review_notes_v1_retention_privacy:
  document_status: APPROVED_LOCAL_TEST_ONLY
  approval_record: "https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4493106549"
  current_note_retention_decision: KEEP_LOCAL_TEST_CURRENT_VALUE_UNTIL_EXPLICIT_CLEAR
  metadata_history_retention_decision: KEEP_LOCAL_TEST_METADATA_ONLY_HISTORY
  clear_delete_semantics_decision: CLEAR_CURRENT_VALUE_PRESERVE_METADATA_ONLY_CLEAR_EVENT
  pii_sensitive_content_decision: IMPLEMENT_LOCAL_MANUAL_NOTES_PRIVACY_WARNING_ONLY
  export_visibility_decision: NO_NEW_EXPORT_OR_MANAGER_VISIBILITY
  production_readiness_decision: HOLD
  generated_suggestion_retention: FORBIDDEN
  old_new_note_text_history: FORBIDDEN
  allowed_next_action: IMPLEMENT_LOCAL_PRIVACY_WARNING_ONLY
```

## 15. Future Implementation Prompt Stub

Use only after a human fills an approval block with non-HOLD decisions beyond
the local/test P1 warning selected above:

```text
Implement the selected Manual Review Notes v1 retention/privacy policy
semantics from
docs/roadmap/manual-review-notes-v1-retention-privacy-policy-decision-packet.md.
Use approval_record: <URL>. Stay local/test-safe unless production proof is
explicitly approved. Do not retain, snapshot, version, attribute, export, or
store generated reviewer note suggestions. Do not store old or new manual note
text in history unless the selected retention/privacy and history decisions
explicitly approve it. Implement only the selected current-note retention,
metadata-history retention, clear/delete, PII/sensitive-content,
export/visibility, and production-readiness options. Add focused tests and run
the repo validation commands before opening a PR.
```

## 16. Validation Expectations

For this docs-only packet:

- `git diff --check`
- `npm run check:naming`

For a future local/test-safe retention/privacy implementation:

- `git diff --check`
- `npm run check:naming`
- `npm run check:schema` if schema changes are included
- focused unit/contract tests for selected retention, clear/delete, metadata
  survival/purge, and generated-suggestion exclusion semantics
- UI/copy tests if warnings, visibility, or manager views are selected
- export/redaction tests if exports or redaction are selected
- `npm test`
- `npm run test:e2e:local` for reviewer UI or fake-D1 behavior changes

For any future production proof:

- Do not infer approval from this packet.
- Require a separate approval record with exact production commands, owners,
  evidence handling, retention/privacy policy, redaction policy, rollback path,
  and stop conditions.
