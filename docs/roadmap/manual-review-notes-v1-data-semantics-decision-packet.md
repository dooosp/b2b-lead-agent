# Manual Review Notes V1 Data Semantics Decision Packet

This packet prepares Manual Review Notes v1 product/data decisions after the
local/test-safe Manual Review Notes v0 work. It is documentation only.

## 1. Document Status

- Document status: `DRAFT_NOT_APPROVED`.
- Approval intent record:
  `https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4483259825`.
- Repository: `dooosp/b2b-lead-agent`.
- Default branch: `master`.
- Post-PR122 baseline inspected:
  `876d11dd13b65f7d33cc2acf7cde3fde7b8765ea`.
- Scope: decision packet for Manual Review Notes v1 data semantics.
- Runtime behavior changed by this packet: none.
- Schema/API behavior changed by this packet: none.
- Production action performed by this packet: none.
- Post-packet T1 implementation approval record:
  `https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4483448642`.
- Post-packet T1 implementation scope: local/test-safe note-specific timestamp
  semantics only.
- Follow-up reviewer identity decision-packet approval-intent record:
  `https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4486274314`.
- Follow-up reviewer identity packet:
  `docs/roadmap/manual-review-notes-v1-reviewer-identity-decision-packet.md`.
- Follow-up generic label implementation approval record:
  `https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4487335178`.
- Follow-up note history/versioning decision-packet approval-intent record:
  `https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4487570553`.
- Follow-up note history/versioning packet:
  `docs/roadmap/manual-review-notes-v1-note-history-versioning-decision-packet.md`.
- Follow-up retention/privacy policy decision-packet approval-intent record:
  `https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4492814282`.
- Follow-up retention/privacy policy packet:
  `docs/roadmap/manual-review-notes-v1-retention-privacy-policy-decision-packet.md`.

This packet does not approve v1 implementation. It records the remaining
decisions needed before note-specific timestamps, reviewer identity, note
history/versioning, retention/privacy enforcement, or production saved-note use
can be implemented.

```yaml
manual_review_notes_v1_decision_packet:
  document_status: DRAFT_NOT_APPROVED
  approval_record: "https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4483259825"
  scope: DOCS_ONLY_DECISION_PACKET
  post_pr122_baseline: "876d11dd13b65f7d33cc2acf7cde3fde7b8765ea"
  implementation_approved: false
  production_approved: false
  generated_suggestion_persistence: FORBIDDEN
```

Post-packet update: the T1 timestamp option was approved for local/test-safe
implementation only. The approved API field is `manualReviewNotesUpdatedAt`,
backed by `manual_review_notes_updated_at`. It records the last accepted
human-entered manual note change/save/clear event. It does not record reviewer
identity, note history/versioning, retention/privacy proof, generated
suggestion time, production proof, or production D1 evidence.

Follow-up update: reviewer identity and author attribution were prepared as a
decision packet in
`docs/roadmap/manual-review-notes-v1-reviewer-identity-decision-packet.md`.
That packet did not itself approve authenticated identity, display-name fields,
author audit trails, generated suggestion attribution, retention/privacy
enforcement, or production behavior.

Post-reviewer-identity-packet update: the generic label implementation approval
record authorizes only the local/test fixed value `manual_reviewer` in
`manualReviewNotesAuthorLabel` / `manual_review_notes_author_label` on accepted
human-entered manual note create/edit/clear events. It does not approve real
reviewer identity, display names, email, authenticated actors, note history,
retention/privacy enforcement, generated suggestion attribution, production
D1 migration, production endpoint calls, or production proof.

Follow-up update: note history/versioning was prepared as a decision packet in
`docs/roadmap/manual-review-notes-v1-note-history-versioning-decision-packet.md`.
That packet recommends the current effective H1 local/test state: current
manual note value plus last-write metadata only. It does not approve
append-only history, old note value retention, generated suggestion history,
retention/privacy enforcement, schema/API/runtime/UI changes, D1 migrations, or
production behavior.

Follow-up update: retention/privacy policy was prepared as a decision packet in
`docs/roadmap/manual-review-notes-v1-retention-privacy-policy-decision-packet.md`.
That packet keeps production HOLD, recommends local/test current-value retention
until explicit clear/delete, preserves metadata-only local/test events without
audit/legal claims, and does not approve retention/privacy enforcement,
purge/delete jobs, redaction, automated PII detection, export/manager
visibility expansion, old note value retention, generated suggestion
retention/history, schema/API/runtime/UI changes, D1 migrations, or production
behavior.

## 2. Current State

- PR #120 implemented the local/test-safe save/read path for human-entered
  manual review notes only.
- PR #121 implemented local/test-safe edit/update and clear/delete UX for
  human-entered manual review notes.
- PR #122 added saved/empty state clarity plus truthful lead-level update
  timestamp labeling.
- Current manual note field: `manualReviewNotes`.
- Current provenance: `manualReviewNotesProvenance: "human_entered"` only when
  non-empty saved manual note text exists.
- Current clear behavior: `manualReviewNotes: ""`.
- Current timestamp semantics: `manualReviewNotesUpdatedAt` is the local/test-safe
  note-specific last-change timestamp for accepted human-entered manual note
  create/edit/clear events. `updatedAt` / `updated_at` remains lead-level update
  time only, not note-specific saved time.
- Current generated suggestion semantics: generated reviewer note suggestions
  are copy-only helper text, unsaved, unsnapshotted, and not human-authored
  notes.
- Current production status: production proof, production deploy, production D1
  access, production endpoint calls, production logs/secrets, CRM, outreach,
  analytics, LLM behavior, manager dashboard v1, and outcome learning remain
  out of scope unless explicitly approved later.

## 3. Problem Statement

Manual Review Notes v0 is useful locally, but production or v1 use needs
explicit data semantics before implementation:

- What does a timestamp mean: lead update, manual note creation, manual note
  update, or manual note clear/delete?
- Who authored the note: an unnamed local reviewer, a labeled test operator, an
  authenticated reviewer, or an audit-grade actor?
- Are historical note values retained, replaced, or deleted?
- How does clearing/deleting interact with retention, audit, and privacy?
- Can manual notes contain PII, sensitive sales context, procurement context,
  buyer names, or deal-sensitive details?
- What production proof would be allowed later, and what evidence boundaries
  would protect customer data, secrets, logs, and production systems?

Without these decisions, v1 implementation would risk presenting lead-level
metadata as note-specific truth, attributing notes to the wrong actor,
retaining sensitive text without policy, or treating generated suggestions as
human-authored saved notes.

## 4. Option Matrix: Note-Specific Timestamp

| Option | Value | Risks | Schema/API impact | UI impact | Tests needed | Production implications | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T0: keep lead-level timestamp only | Lowest implementation risk; preserves current PR #122 truthful labeling. | Reviewers cannot tell when the manual note itself changed; lead edits may look related to notes if copy regresses. | None. Continue using existing lead-level `updatedAt` / `updated_at` only. | Keep copy like `Lead last updated`; never say `manual note saved at`. | Existing state/timestamp copy tests plus regression coverage that no note-specific label is rendered from lead-level time. | Does not establish production-grade note audit semantics. Production saved-note use remains HOLD. | Acceptable for v0/local-only; not enough for v1 production note semantics. |
| T1: add `manualReviewNotesUpdatedAt` | Gives reviewers a truthful last-change time for current note text while keeping data shape minimal. | Does not distinguish first save from later edit or clear; clearing semantics need a decision. | Requires schema/API approval, serializer updates, patch behavior, fixtures, exports, and migration/backfill design if production is ever included. | Can show `Manual note last updated` only when sourced from the note-specific field. Empty-state copy must define whether a cleared note keeps or hides the value. | Unit/contract tests for save/edit/clear timestamps, serialization, CSV/export boundaries if included, and no generated-suggestion timestamping. | Needs production migration/proof approval before production use; backfill cannot silently fabricate note save times from lead-level updates. | Recommended minimal v1 default after schema/API approval, if the product only needs current-note last-change truth. |
| T2: add `manualReviewNotesCreatedAt`, `manualReviewNotesUpdatedAt`, and `manualReviewNotesClearedAt` | Most expressive current-value timestamp model; separates first save, last edit, and clear event. | More fields and more edge cases; old local notes may have null created/cleared values; clear semantics can look like soft-delete history. | Requires schema/API approval, migration/backfill rules, serializer/patch/export updates, and clear-event semantics. | UI can distinguish first saved, last updated, and cleared states, but must avoid clutter and stale/audit claims. | Unit/contract tests for create/update/clear transitions, null/backfill cases, sorting, export, and generated-suggestion non-participation. | Stronger production readiness than T1, but still needs migration, retention, privacy, and production proof approval. | Use only if humans need separate create/update/clear semantics before production. Otherwise start with T1. |

Conservative timestamp default: keep T0 for current v0/local-only behavior.
For v1, prefer T1 as the smallest truthful note-specific timestamp after a
schema/API decision. Choose T2 only if clear/delete and first-save semantics are
product requirements, not just nice-to-have audit detail.

## 5. Option Matrix: Reviewer Identity

| Option | Value | Risks | Privacy implications | Auth dependency | Tests needed | Production implications | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| I0: no reviewer identity | Lowest privacy and auth dependency; fits current local/test-safe v0. | Cannot answer who wrote or cleared a note; weak accountability for shared environments. | Avoids collecting reviewer personal data. | None. | Regression tests that UI/API do not imply a named author. | Not sufficient for production audit or multi-reviewer accountability. | Keep for current v0/local-only unless reviewer identity is explicitly selected. |
| I1: local/test-only reviewer label | Gives test operators a visible label for demos or local review sessions without full auth. | Labels may be inaccurate, spoofable, or mistaken for authenticated identity. | Labels may contain names/emails; should remain local/test-only and avoid production export by default. | None or local config/session label only; not auth proof. | Tests for label rendering, persistence boundaries, reset behavior, and non-production-only handling. | Must not be represented as authenticated identity in production. Production remains HOLD. | Acceptable for local/test UX experiments if clearly labeled as non-authenticated. |
| I2: authenticated reviewer identifier | Establishes who created/updated/cleared notes under real auth. | Requires auth model clarity, user lifecycle handling, access control, and possible PII handling. | Reviewer IDs/emails may be personal data; retention/export/redaction policy required. | Yes. Requires approved auth semantics and stable reviewer identifier source. | Auth-bound contract tests, unauthorized/forbidden tests, serialization/export tests, and privacy redaction tests. | Candidate production path only after auth, privacy, and access-control approval. | Preferred production-capable direction if saved notes become multi-user or accountable. Not ready now. |
| I3: full audit-grade identity with role/source | Supports compliance-style audit: actor, role, source, impersonation/system actor, and reason. | Highest complexity; can overbuild local reviewer workflow and create legal/privacy obligations. | Strong privacy/legal review required for actor metadata, retention, export, and deletion rights. | Yes. Requires robust auth, role model, audit-source model, and possibly admin tooling. | End-to-end auth/audit tests, role/source tests, deletion/retention tests, export/redaction tests, and tamper-resistance expectations. | Only appropriate with explicit production, audit, privacy/legal, and operational owner approval. | Do not choose for v1 default unless audit-grade history is a hard requirement. |

Conservative reviewer identity default: keep I0 for current v0/local-only.
Use I1 only for local/test labels if helpful and unmistakably non-authenticated.
Do not implement I2/I3 until auth semantics and privacy policy are approved.

## 6. Option Matrix: Note History / Versioning

| Option | Value | Risks | Retention impact | Schema/API impact | Tests needed | Production implications | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| H0: current-value only | Simple, matches current `manualReviewNotes` behavior backed by existing `notes`. | Edits overwrite prior content; clear/delete loses current value; no recovery or audit trail. | Lowest retention burden if clear means remove current value. | None for v0. Future production use still needs explicit retention decision. | Existing save/edit/clear tests and no-history regression tests. | Weak for production audit; acceptable only if current-value semantics are an explicit product choice. | Keep as current local/test default. |
| H1: last-write metadata only | Adds last-change facts without retaining old note bodies. | Still cannot reconstruct prior text; metadata can imply more audit strength than it has. | Retains less sensitive text than history while preserving update/clear facts. | Requires timestamp and possibly reviewer metadata fields; no separate history table. | Tests for last updated/cleared metadata and no prior-body retention. | Better production candidate than H0 if privacy favors minimal retention. Still requires schema/API/privacy approval. | Recommended first v1 step if product needs accountability but not full note bodies. |
| H2: append-only local history | Lets local/test reviewers inspect edits and clears in fake-D1/local flows. | Easy to confuse with production audit; history may retain sensitive text indefinitely in local artifacts. | High local retention burden; requires clear test-data hygiene. | Requires new local-only schema or fixture model if implemented. | Local history append/edit/clear tests, redaction tests, and generated-suggestion exclusion tests. | Not production proof. Must be labeled local/test-only and excluded from production claims. | Avoid unless a local product prototype specifically needs history before production design. |
| H3: audit-grade production history | Complete note event trail for create/edit/clear, actor, source, time, and possibly reason. | Highest privacy, legal, storage, migration, and access-control burden. | Retains sensitive note bodies and actor metadata unless redaction/deletion policy is explicit. | Requires new schema/API/event model, migration, access controls, export rules, and retention jobs. | Audit event tests, auth tests, retention/delete tests, export/redaction tests, migration tests, and production-proof gates. | Requires explicit production, privacy/legal, auth, retention, and operational owner approval. | Do not choose for v1 default unless audit-grade production history is required. |

Conservative history default: keep H0 for v0. For v1, prefer H1 before any
audit-grade history. Do not retain prior note bodies until retention/privacy
and access-control decisions are approved.

## 7. Option Matrix: Retention / Privacy

| Option | Value | Risks | Privacy implications | Delete/clear semantics | Tests needed | Production implications | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R0: local/test-only no production retention policy | Keeps current implementation bounded and honest. | Does not answer production data obligations; local artifacts can still contain sensitive examples if reviewers type them. | Avoids production policy claims; local test data should still avoid real PII/customer secrets. | Current clear/delete only clears the saved current value through `manualReviewNotes: ""`. | Existing local save/edit/clear tests and docs boundary checks. | Production saved-note use remains HOLD. | Current v0 default. |
| R1: current-value retention with clear/delete semantics | Defines saved note as current operator-entered business text; clear removes the current saved value. | May be insufficient if legal/audit expects history; may be too much if sensitive note text should expire quickly. | Requires clear statement that notes may include sensitive sales context and should be handled as user-entered business data. | Clear/delete removes current value; decide whether metadata like `clearedAt` remains. | Tests for clear behavior, serialization/export behavior, redaction/log boundaries, and generated-suggestion exclusion. | A plausible v1 product/data default after explicit approval, but not silent implementation. | Recommended product/data default to decide next, with production still HOLD. |
| R2: time-bounded retention | Reduces long-term exposure by expiring note text or history after an approved period. | Needs jobs, clocks, deletion evidence, edge-case handling, and user expectations. | Stronger privacy posture but requires policy owner and operational enforcement. | Clear/delete still removes current value; retention job removes eligible note data after the period. | Retention job tests, clock tests, deletion idempotency, export/log redaction, and production safety tests. | Requires production operations approval before any real retention job. | Good later option if note text may contain PII or sensitive deal context and policy owners can define a period. |
| R3: audit-retention with explicit privacy/legal approval | Supports compliance and audit needs for retained note bodies/events. | Creates the highest exposure and governance burden; hard delete may be restricted. | Requires privacy/legal review, access controls, evidence handling, retention schedule, and deletion exceptions. | Clear/delete may create a tombstone or visible cleared state while retaining audit records. | Full audit retention, access, export, redaction, deletion-request, and migration tests. | Production use requires explicit privacy/legal and operational approvals. | Do not choose by default. Only select if audit retention is a product/legal requirement. |

Conservative retention default: keep R0 for current v0/local-only. For v1,
make R1 an explicit product/data decision before implementation. Do not silently
implement retention, deletion jobs, or audit retention.

## 8. Recommended V1 Default

Recommended default, unless later repo evidence or a human decision changes it:

- Timestamp: keep T0 for v0; choose T1 for v1 only after schema/API approval.
  Choose T2 only if created/updated/cleared timestamps are required product
  semantics.
- Reviewer identity: keep I0 for v0. Allow I1 only for local/test labels if
  clearly non-authenticated. Do not implement authenticated identity until auth
  semantics are approved.
- History/versioning: keep H0 for v0. Prefer H1 before audit-grade history if
  v1 needs accountability without retaining prior note bodies.
- Retention/privacy: make R1 a product/data decision before implementation.
  Keep R0 until that approval exists.
- Production readiness: production remains HOLD. No production proof, deploy,
  production D1 access, production endpoint calls, production logs/secrets, or
  production saved-note use is approved by this packet.
- Generated suggestions: generated reviewer note suggestions remain copy-only,
  unsaved, unsnapshotted, and not human-authored notes.

The recommended v1 shape is therefore a minimal current-value manual note with
truthful note-specific last-updated metadata, only after approval for schema,
API, retention/privacy, and local validation. Authenticated identity and audit
history should be separate later decisions.

## 9. Implementation Prerequisites

Before any v1 implementation, record all of the following:

- Selected timestamp option and field names.
- Selected reviewer identity option and whether it is local/test-only or
  authenticated.
- Selected history/versioning option and whether old note bodies are retained.
- Selected retention/privacy option and clear/delete semantics.
- Explicit generated-suggestion boundary confirming generated suggestions are
  not saved or snapshotted.
- Schema/API approval if any field or payload changes.
- Export/reporting decision for whether manual notes or metadata appear in CSV,
  reports, evidence packets, future dashboards, or logs.
- Test plan covering unit, contract, fake-D1 local E2E, naming, schema drift if
  schema changes, and no-generated-suggestion-persistence regressions.
- Production proof approval if production is ever included, with owners,
  evidence policy, rollback path, stop conditions, and exact allowed commands.

## 10. Explicit Non-Decisions

This original packet did not itself approve the following. Later post-packet
approvals are listed above and remain limited to T1 note-specific timestamp
metadata plus the fixed generic local/test author label:

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
- real/authenticated reviewer identity implementation beyond the fixed generic
  local/test label,
- note-specific timestamp implementation,
- note history/versioning implementation,
- retention/privacy enforcement,
- retention or deletion jobs,
- generated suggestion persistence,
- generated suggestion snapshot persistence,
- treating generated reviewer note suggestions as human-authored saved notes.

## 11. Production-Readiness Gates

Production saved-note use remains blocked until a later approval packet names
and satisfies all relevant gates:

- Product owner approves selected data semantics.
- Privacy/legal or equivalent data owner approves retention and PII handling.
- Auth owner approves reviewer identity semantics if any identity is stored.
- DB owner approves schema, migration, backfill/null behavior, and rollback.
- API owner approves request/response contracts and compatibility behavior.
- Evidence owner approves production proof scope, redaction, storage, and
  retention.
- Operator approves exact production commands and stop conditions.
- Local validation passes on the implementation branch.
- CI is green on the PR.
- Generated suggestion persistence remains forbidden unless a separate human
  decision explicitly reverses that boundary.

## 12. Future Approval Blocks

```yaml
manual_review_notes_v1_data_semantics:
  document_status: DRAFT_NOT_APPROVED
  approval_record: null
  timestamp_decision: HOLD
  reviewer_identity_decision: HOLD
  note_history_decision: HOLD
  retention_privacy_decision: HOLD
  production_proof_decision: HOLD
  generated_suggestion_persistence: FORBIDDEN
  allowed_next_action: DECISION_ONLY
```

```yaml
manual_review_notes_v1_candidate_decision:
  document_status: HUMAN_TO_FILL
  approval_record: null
  timestamp_decision:
    selected_option: null # T0 | T1 | T2
    approved_fields: []
    backfill_policy: null
  reviewer_identity_decision:
    selected_option: null # I0 | I1 | I2 | I3
    identity_source: null
    privacy_owner: null
  note_history_decision:
    selected_option: null # H0 | H1 | H2 | H3
    retain_prior_note_bodies: null
  retention_privacy_decision:
    selected_option: null # R0 | R1 | R2 | R3
    pii_allowed: null
    clear_delete_semantics: null
    export_policy: null
  production_proof_decision:
    decision: HOLD
    allowed_commands: []
    forbidden_commands:
      - wrangler production deploy
      - production D1 read/write/migration
      - production endpoint smoke
      - production logs/secrets access
  generated_suggestion_persistence: FORBIDDEN
  allowed_next_action: DECISION_ONLY
```

## 13. Future Implementation Prompt Stub

Use only after a human fills an approval block with non-HOLD decisions:

```text
Implement the selected Manual Review Notes v1 data semantics from
docs/roadmap/manual-review-notes-v1-data-semantics-decision-packet.md.
Use approval_record: <URL>. Stay local/test-safe unless production proof is
explicitly approved. Do not persist generated reviewer note suggestions.
Implement only the selected timestamp, reviewer identity, history/versioning,
and retention/privacy options. Add focused tests and run the repo validation
commands before opening a PR.
```

## 14. Validation Expectations

For this docs-only packet:

- `git diff --check`
- `npm run check:naming`

For a future local/test-safe v1 implementation:

- `git diff --check`
- `npm run check:naming`
- `npm run check:schema` if schema changes are included
- focused unit/contract tests for selected semantics
- `npm test`
- `npm run test:e2e:local` for reviewer UI or fake-D1 behavior changes

For any future production proof:

- Do not infer approval from this packet.
- Require a separate approval record with exact production commands, owners,
  evidence handling, redaction policy, rollback path, and stop conditions.
