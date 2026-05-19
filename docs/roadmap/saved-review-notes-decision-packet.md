# Saved Review Notes Decision Packet

This packet defines product and data boundaries for saved review notes before
any persistence, schema, API, storage, or production implementation work.

## 1. Document Status

- Status: planning packet plus the recorded Option E selection.
- Saved notes implementation performed: none.
- Local/test-safe copy clarification under Option E: labels, docs, and tests
  only.
- Schema or persistence change performed: none.
- API or runtime behavior change beyond wording/helper text performed: none.
- Production action performed: none.

This packet is not approval to implement saved notes. Issue #113 selected
Option E, so generated suggestions remain copy-only helper text unless a
separate future decision and implementation says otherwise.

## 2. Current Baseline

- Repository: `dooosp/b2b-lead-agent`
- Default branch: `master`
- Current source-of-truth `origin/master` after Option E copy clarification:
  `c928f910f307a783f934842d777df666b9267a86` (PR #114)
- PR #109 shipped Manager / Reviewer Summary v0 as a local/test-safe `/leads`
  `리뷰 요약` panel from existing filtered leads, Reviewer Action Queue / Lead
  Review Session metadata, and LeadBrief fields only.
- PR #110 synced source-of-truth docs after PR #109.
- Issue #111, Manager / Reviewer Summary v0 UX Findings Intake, is closed as
  completed.
- PR #112 added this decision packet, and Issue #113 recorded
  `HUMAN_SAVED_NOTES_DECISION: OPTION_E`.
- PR #114 implemented only the Option E wording clarification for generated
  reviewer note suggestions on `/leads`, Opportunity Workbench, tests, and
  related docs.
- Reviewer note suggestions currently exist as deterministic, copy-friendly
  helper text. They are copy-only, not saved, not auto-sent, not persisted, and
  not human-authored saved notes.
- Existing manual note surfaces are separate from generated suggestions. The
  normal lead PATCH path accepts `notes`, truncates operator-entered text to the
  allowed size, and can persist it to the existing D1 `notes` column in normal
  lead updates.
- Saved review notes are not defined as a new product contract yet.

## 3. Problem Statement

Saved review notes need a decision before implementation because generated
helper text is not the same thing as a human-authored note. Persisting generated
text can create authorship, retention, privacy, and audit concerns that do not
exist when the text is copy-only.

Human notes also need ownership, retention, and conflict rules. A later
local/test-safe Option A approval narrowed v0 edit/delete semantics to saving a
changed human-entered value and confirmed clearing of that saved value.
The existing manual notes path must not be confused with deterministic
reviewer-note suggestions. Persistence implies schema, API, storage, and
production data questions, so it must remain separate from local/test-safe
display helpers.

## 4. What Could Be Saved

| Option | Product value | Risk | Data ownership implication | Retention/privacy implication | Schema/API implication | Testing needs | Human decision required |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A. Save only human-entered manual notes | Preserves explicit operator intent and builds on the existing manual notes concept. | May not capture why a generated suggestion was useful unless the reviewer writes it. | Human reviewer owns the note content. | Treat as operator-entered business text that may include sensitive customer/company context. | Implemented locally through the existing `notes` field as `manualReviewNotes`; production use still needs separate approval. | Existing PATCH behavior plus focused tests for labels, edit/clear, and no generated auto-save. | Selected later in Issue #118 for local/test-safe human-entered manual notes only. |
| B. Save an edited note derived from a generated suggestion, marked human-edited | Gives reviewers a fast starting point while requiring human adoption. | Authorship may be ambiguous if the edit is small. | Human owns the final text, but provenance must record generated origin. | Retain edited text with generated-source provenance and privacy warnings. | Likely needs provenance fields or a separate note record before implementation. | Tests for human-edited labeling, provenance rendering, and no unchanged auto-save. | Yes. Define when generated text becomes human-authored. |
| C. Save a generated suggestion snapshot, clearly marked generated and not human-authored | Preserves exact helper text visible at decision time. | Highest authorship and audit risk; generated text may look like a human rationale. | System owns the generated snapshot; reviewer ownership is not implied. | Decide whether generated text should be retained at all and whether it needs redaction. | Likely needs new schema/API fields for generated provenance and template version. | Tests for generated labels, read-only display, retention boundary, and no human-authored claims. | Yes. This should not be default without explicit approval. |
| D. Save review decision rationale separately from note text | Captures why a review status changed without making helper copy canonical. | May duplicate or conflict with manual notes if boundaries are unclear. | Reviewer owns rationale if entered by a human. | Rationale may include sensitive or PII-like details and needs policy. | Likely requires a separate data contract from generic note text. | Tests for status/rationale separation and stale-status behavior. | Yes. Define whether rationale is required, optional, or forbidden. |
| E. Do not persist notes yet; keep copy-only suggestions | Lowest data risk and preserves current shipped behavior. | Reviewers may lose context between sessions. | No new saved data owner. | No new retention burden for generated suggestions. | No schema/API changes. | Copy-label/docs tests only if UI copy changes later. | Selected in Issue #113. |

The possible saved objects are:

- generated suggestion
- edited generated suggestion
- human-entered manual note
- review decision rationale
- reviewer status transition reason

Any selected option must distinguish generated helper text from human-entered
or human-adopted note text.

## 4A. Selected Option E Boundary

Issue #113 selected Option E. Under this selection:

- Generated reviewer note suggestions are deterministic helper text.
- Generated suggestions are copy-only.
- Generated suggestions are not persisted as saved notes.
- Generated suggestions are not sent automatically.
- Generated suggestions are not human-authored notes unless a human copies,
  edits, and uses them elsewhere.
- Generated suggestion and broader saved-note persistence remain unimplemented
  and require a separate future decision and implementation track.
- Subsequent Issue #118 records a separate local/test-safe Option A path for
  human-entered manual notes only. That path does not change the Option E
  generated-suggestion boundary.

## 5. Authorship And Provenance Model

The following are design concepts only, not schema changes:

- `author_type`: `human`, `generated`, or `human_edited_generated`
- `source_template_version`
- `reviewer_id` or `reviewer_label`, if applicable
- `created_at` and `updated_at`
- `review_status_at_time`
- `lead_id`
- `note_body`
- `provenance` or `generated_from` fields
- redaction and privacy expectations for note text

Conceptually, generated helper text should never be displayed as human-authored
unless a human explicitly edits or adopts it under a selected product rule.
Human-edited generated notes need visible provenance so later readers know the
starting point was generated.

## 6. Edit/Delete Rules

Decision questions:

- Can human notes be edited after creation?
- Can generated snapshots be edited, or must edits create a human-edited copy?
- Are edits versioned?
- Can notes be deleted?
- Who can delete notes?
- Is delete a hard-delete or a soft-delete?
- What happens if `reviewStatus` changes after note creation?
- How are stale notes displayed when the current lead state differs from the
  state captured at note creation?
- Does a new note replace an older one, append to history, or require a manual
  archive action?

No edit, delete, versioning, or retention behavior was implemented by this
packet. The later Manual Review Notes v0 local/test path implements only
edit-by-resave and clear-by-empty-value for human-entered manual notes.
The later state/timestamp clarity hardening only labels whether a human-entered
manual note is saved or empty and may show lead-level `updatedAt` / `updated_at`
as lead last-update state. It does not create note history, reviewer identity,
retention semantics, or a note-specific saved timestamp.

## 7. Retention And Privacy

Decision questions:

- How long are saved notes kept?
- May notes include customer, company, procurement, or deal-sensitive content?
- Is PII allowed in note text?
- Can notes be exported to CSV, reports, evidence packets, or future admin
  views?
- Should generated suggestions be retained at all?
- Must note text be redacted in logs, evidence packets, PR summaries, or test
  artifacts?
- Are production data policies required before any persistence rollout?
- Should retention differ by `author_type`?

Until these decisions are made, generated reviewer-note suggestions should
remain copy-only helper text.

## 8. Conflict And Overwrite Behavior

Decision questions:

- If a manual note already exists, can a generated suggestion ever overwrite
  it?
- If a reviewer edits a note while another process changes `reviewStatus`, what
  wins?
- If two reviewers create notes for the same lead, are they merged, versioned,
  or shown as separate notes?
- How are duplicate notes detected?
- Is copy-only suggestion state always separate from saved note state?
- Does changing `reviewStatus` invalidate, archive, or merely label existing
  notes as stale?

Safe default: generated suggestions must not overwrite existing manual notes.
Copy-only suggestions must remain separate from saved notes until a selected
product rule says otherwise.

## 9. Local/Test-Only Implementation Candidates

Safe first slices after a human selection:

- Docs or copy clarification that distinguishes generated suggestions from
  human notes.
- Local-only UI affordance that labels generated suggestions clearly.
- Fixture-backed design tests for note provenance rendering.
- Mock or local fake-D1 design prototype only if explicitly selected later.
- Manual Review Notes v0 saved/empty state copy and truthful lead-level
  update-state labeling. This is allowed only when it does not imply
  generated-suggestion persistence or a note-specific timestamp.

These candidates must not use production D1 and must not imply persistence is
shipped unless the selected scope implements and validates it.

## 10. Implementation Tracks Not Ready Yet

Separate future scopes:

- schema or D1 persistence
- new API endpoints
- edit/delete semantics beyond the v0 human-entered note clear control
- retention or deletion jobs
- production migration
- production write proof
- manager dashboard note history
- outcome learning from notes
- CRM or outreach workflows
- LLM summarization or external provider calls

These tracks remain out of scope until the product/data decision is recorded.

## 11. Recommended Next Step

Issue #113 selected Option E, PR #114 shipped the copy-only wording
clarification, Issue #115 closed its UX intake, and Issue #118 later selected
local/test-safe Option A for human-entered manual notes only. PR #120 shipped
the initial save/read path, PR #121 shipped edit-by-resave and confirmed
clear-by-empty-value behavior, and PR #122 shipped saved/empty state clarity
while keeping timestamp display constrained to lead-level last-update
semantics. `docs/roadmap/manual-review-notes-v1-data-semantics-decision-packet.md`
is the next decision-only packet for note-specific timestamp, reviewer
identity, history/versioning, retention/privacy, and production-readiness
gates.

Do not implement generated note auto-save, generated suggestion persistence,
new note schema/storage, retention jobs, reviewer identity, production rollout,
or production data access from this packet. Do not label lead-level
`updated_at` as manual-note-specific saved time. Options B, C, and D remain
unselected and require a separate future product/data decision before any
generated or rationale persistence work.

## 12. Validation Expectations

For future docs-only work:

- `git diff --check`
- `npm run check:naming`

For future local UI/copy work:

- `git diff --check`
- `npm run check:naming`
- `npm run eval:lead-quality`
- `npm test`
- `npm run test:e2e:local`

For future schema/data-contract work:

- `npm run check:schema`
- targeted DB/schema tests
- no production D1 unless separately approved

## 13. Production Boundary

- No production deploy.
- No Wrangler.
- No production D1 access.
- No production D1 write or migration.
- No production endpoint call.
- No production logs or secrets.
- No production smoke test.
- No production observation claim.
- Local tests, fake-D1 E2E, docs, PR summaries, and CI are non-production
  evidence only.

This packet does not authorize production proof, production observation, schema
change, API change, runtime change, persistence, CRM/outreach automation,
analytics, LLM calls, or outcome learning.
