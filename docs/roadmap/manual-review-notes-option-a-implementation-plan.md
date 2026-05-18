# Manual Review Notes Option A Implementation Plan

> **For agentic workers:** This document was originally added as a plan-only
> decision artifact in PR #119. The later approval record
> `https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4477073009`
> supersedes that plan-only HOLD only for the exact local/test-safe Option A
> implementation: human-entered manual review notes only. Production proof,
> production deploy, production D1, generated suggestion persistence, CRM,
> outreach, analytics, LLM, outcome learning, and manager dashboard v1 remain
> out of scope.
> The later approval record
> `https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4477320711`
> authorizes only local/test-safe Manual Review Notes v0 edit/clear UX
> hardening for the same human-entered manual note contract.

**Goal:** Define the safe local/test-only implementation path for Option A:
save only human-entered manual notes while generated reviewer note suggestions
remain copy-only helper text.

**Architecture:** Treat manual notes and generated reviewer note suggestions as
separate product concepts. Manual Review Notes v0 uses the existing note value:
edit/update means saving a changed human-entered value, and clear/delete means
confirmed clearing of that saved value. Schema, note history, reviewer identity,
retention, privacy policy, and production data decisions remain separately
scoped.

**Tech Stack:** Cloudflare Worker pages and APIs, D1-backed lead rows, fake-D1
local tests, Node test runner, local-only route/page smoke tests.

---

## Recorded Human Decision

- `NEXT_PRODUCT_TRACK_DECISION`: `SAVED_NOTES_OPTION_A_PLAN_ONLY`
- `SAVED_NOTES_PERSISTENCE_DECISION`: `OPTION_A_PLAN_ONLY`
- `IMPLEMENTATION_DECISION`: `IMPLEMENT_OPTION_A_MANUAL_NOTES_LOCAL_TEST_ONLY`
- `EDIT_CLEAR_UX_DECISION`: `IMPLEMENT_MANUAL_REVIEW_NOTES_V0_EDIT_CLEAR_UX_HARDENING_LOCAL_TEST_ONLY`
- `MANAGER_DASHBOARD_DECISION`: `HOLD`
- `OUTCOME_LEARNING_DECISION`: `HOLD`
- `PRODUCTION_PROOF_DECISION`: `HOLD`
- Approval record: `https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4477073009`
- Edit/clear approval record: `https://github.com/dooosp/b2b-lead-agent/issues/118#issuecomment-4477320711`

Decision meaning:

- Continue only with a docs-only local/test-only plan for Option A.
- Option A means save only human-entered manual notes.
- Generated reviewer note suggestions remain copy-only.
- Generated suggestions must not be saved.
- Generated suggestions must not be sent.
- Generated suggestions must not be treated as human-authored saved notes.
- The plan-only state is superseded only for local/test-safe Option A
  implementation. Production proof/deploy remains `HOLD`.
- Manual Review Notes v0 edit/clear hardening is approved only for the same
  local/test-safe human-entered note surface. Production proof/deploy remains
  `HOLD`.

## Verified Baseline

- Repository: `dooosp/b2b-lead-agent`
- Default branch: `master`
- Current baseline: `bbc01b4bfc1629ec671b64b8ea0d44b2c1f17e4c`
- PR #117: merged as `fix: reduce duplicate reviewer note suggestion display`
- PR #120: merged as `feat: add manual review notes option a`
- Issue #115: closed as completed
- Decision packet present: `docs/roadmap/saved-review-notes-decision-packet.md`
- Standing approval policy present: `docs/standing-approval-policy.md`

This implementation stays inside the standing non-production boundary. It does
not approve production deploy, Wrangler, production D1, production endpoint
calls, production logs or secrets, production smoke tests, or production
observation claims.

## Implementation Record

Option A is implemented locally by formalizing the existing `notes` column as
the human-entered manual review notes contract:

- API write alias: `manualReviewNotes`
- API read alias: `manualReviewNotes`
- provenance field: `manualReviewNotesProvenance = "human_entered"` when saved
  text is present
- backing storage: existing `leads.notes`
- UI surfaces: `/leads` lead cards and lead-detail manual note textareas
- edit/update UX: reviewers save a changed human-entered value through the same
  explicit `manualReviewNotes` control
- clear/delete UX: reviewers clear the saved human-entered value through an
  explicit clear control with confirmation; this is value clearing, not note
  history, retention, or hard-delete semantics
- generated/cache batch inserts blank note-like fields so only explicit manual
  note PATCH writes create saved notes
- generated suggestion boundary: generated reviewer note suggestion patch fields
  are rejected; queue/session suggestion objects remain response-only helper
  text and are not persisted to lead rows

No new D1 table, generated suggestion snapshot, production migration, Wrangler
command, production endpoint, production DB, CRM/outreach/analytics, or LLM
behavior is introduced by this implementation.

## Current Manual Notes Path

Current repository inspection shows the implemented human-entered note path:

- `worker/pages/lead-detail.js` renders a `textarea` named `notesArea` with
  `aria-label="수동 리뷰 메모 입력"` and sends entered text through
  `scheduleNoteSave()`.
- `scheduleNoteSave()` reads only the current `notesArea` value and calls
  `updateField('manualReviewNotes', val)` after a short debounce.
- `updateField()` sends `PATCH /api/leads/:id` with a JSON body containing the
  named field.
- `worker/api/leads.js` routes `PATCH /api/leads/:id` through
  `handleUpdateLead()` and `updateLeadPatchAtomic()`.
- `worker/db/leads.js` accepts `patch.notes` only when it is a string, truncates
  it to 2000 characters, and writes it through the existing lead row update.
- `worker/schema.sql` already has a `notes TEXT DEFAULT ''` column on `leads`.
- `worker/db/transform.js` maps `notes` between D1 rows and lead domain objects.
- Existing tests cover atomic behavior for valid notes updates and invalid mixed
  payloads that must not partially overwrite notes.
- `/leads` and lead detail expose explicit clear controls that confirm before
  sending `manualReviewNotes: ""`.

The implementation approval confirms that the existing `notes` field is the
local/test-safe saved manual note contract for Option A. The public API/UI alias
is `manualReviewNotes` so generated suggestions remain visibly separate from
human-entered saved notes.

## Human-Entered Manual Notes Only

For Option A, "human-entered manual notes only" means:

- A reviewer intentionally types or pastes note text into a manual note input.
- The saved value is exactly the manually entered value after existing product
  normalization, such as length truncation already enforced by the patch path.
- The saved note is owned by the human reviewer or operator action that entered
  it.
- The saved note is not inferred from generated reviewer note suggestions.
- The saved note is not created by copying a generated suggestion unless the
  human explicitly places text in the manual note input under a future approved
  rule.
- A copy action alone is not a save action.
- A status change alone is not a note save action.
- Browser-memory productivity counters are not saved notes.

Generated helper text can support human writing, but it must not silently become
saved note content.

## Generated Suggestions Boundary

Generated reviewer note suggestions stay outside saved notes:

- They remain deterministic helper text.
- They remain copy-only.
- They are not persisted to D1.
- They are not sent to CRM, outreach, email, analytics, or external systems.
- They are not treated as human-authored note records.
- They must not overwrite existing manual notes.
- They must not be written through `PATCH /api/leads/:id` unless a human has
  explicitly entered the final text into a manual note field under a separately
  approved implementation.

Future implementation work should preserve visible separation between:

- manual saved note content
- generated reviewer note suggestion text
- copied generated text in the clipboard
- browser-memory activity feedback
- review status changes
- sales pipeline status changes

## Authorship And Provenance Boundary

Option A's safest authorship model is simple:

- Manual note author: human reviewer or operator.
- Generated suggestion author: system helper.
- Saved note provenance: manual entry only.
- Generated suggestion provenance: copy-only helper, not saved.

This implementation adds only derived provenance for the saved manual note
value: `manualReviewNotesProvenance = "human_entered"` when note text exists.
If a future product decision wants edited generated suggestions, generated
snapshots, note history, or reviewer identity, that is no longer plain Option A
and must be separately approved.

Minimum provenance question for future Option A implementation:

- Is the existing `notes` field sufficient because the only saved content is
  manual text?
- If multiple humans may edit the same lead, is a single mutable `notes` field
  still acceptable?
- Does the product need reviewer identity before saved notes can be considered
  audit-ready?
- Is a timestamp already provided by `updated_at`, or does note-specific timing
  need a separate contract?

## V0 Edit And Clear Behavior

Implemented local/test-safe behavior:

- Editing a manual note after the first save is allowed.
- Editing replaces the prior single saved note value through
  `manualReviewNotes`.
- Clearing the manual note field is the v0 delete-equivalent action.
- Clearing writes an empty `manualReviewNotes` value and removes derived
  `human_entered` provenance because no saved note text remains.
- Clear controls require confirmation before the empty value is sent.
- Clear/delete does not affect generated reviewer note suggestions.
- Clear/delete does not create generated suggestion persistence.

Remaining separate product questions:

- Does editing need version history?
- If future delete semantics go beyond value clearing, is that hard delete or
  soft delete?
- Who is allowed to delete a manual note?
- Does changing `reviewStatus` affect existing manual notes?
- Should the UI show that a note may be stale after the lead state changes?

No versioning, stale-note labeling, reviewer identity, retention policy, or
production delete semantics are implemented or approved here.

## Retention And Privacy Questions

Open product and data questions before implementation:

- How long should manual notes be retained?
- Can manual notes contain customer, company, procurement, pricing, or deal
  sensitive content?
- Is personal data allowed in manual note text?
- Should manual notes be included in CSV export, report artifacts, evidence
  packets, admin views, or future manager summaries?
- Should note text be redacted from logs and generated evidence?
- Does retention differ for managed leads and self-service leads?
- Is production data policy approval required before any production use of
  saved manual notes?

Until these are answered, local tests may prove behavior only against fake-D1
or fixture data. They do not prove production retention or privacy behavior.

## Conflict And Overwrite Questions

Open conflict questions before implementation:

- If an existing manual note is present, can another reviewer overwrite it?
- Should simultaneous edits be last-write-wins, blocked, merged, or versioned?
- Should generated suggestion text ever be allowed to replace manual notes?
- What happens when lead refresh or managed cache writes run after a manual note
  exists?
- Does `saveLeadsBatch()` continuing not to overwrite `notes` on conflict remain
  the intended protection?
- Should the UI warn when a note has changed since the page loaded?
- Should status and note changes be saved in the same operation or kept
  separate?

Safe default for Option A: generated suggestions never overwrite manual notes,
and lead refreshes should preserve existing manual notes.

## Implemented Local/Test Evidence

The implemented local/test-safe slice covers:

- `worker/db/transform.js`: exposes `manualReviewNotes` and
  `manualReviewNotesProvenance` while keeping `notes` as the storage field.
- `worker/db/leads.js`: accepts `manualReviewNotes`, keeps legacy `notes`
  compatibility, rejects conflicting note payloads, and rejects generated
  reviewer note suggestion persistence attempts.
- `worker/pages/leads.js`: labels the list note control as manual review notes
  and saves/edits/clears through `manualReviewNotes`.
- `worker/pages/lead-detail.js`: labels the detail note control as manual
  review notes and saves/edits/clears through `manualReviewNotes`.
- `worker/api/serializers/lead-csv.js`: exports the same existing note value as
  manual review notes.
- `worker/tests/manual-review-notes.test.mjs`: proves manual save/read,
  edit/update, clear, provenance, generated suggestion rejection, and
  lead-refresh preservation.
- `worker/tests/lead-review-status.test.mjs`: proves the UI save contract uses
  `manualReviewNotes` and exposes clear controls with confirmation.
- `worker/e2e/local-e2e.test.mjs`: proves the fake-D1 loopback route/page smoke
  can save, edit, clear, and read human-entered manual notes while generated
  suggestions remain response helper text.
- `docs/local-e2e-harness.md`: records the local-only coverage.

## Required Tests

Option A local/test implementation should run at minimum:

- `git diff --check`
- `npm run check:naming`
- `npm run check:schema`
- `npm run eval:lead-quality`
- `npm test`

UI behavior changes should also run:

- `npm run test:e2e:local`

Do not run production E2E, deploy commands, Wrangler, production DB commands,
production endpoint smoke tests, secret or log reads, or production observation
steps for Option A local/test-only work.

## Separate Schema, API, And Persistence Questions

These questions remain separate from this local/test implementation:

- Should a future production-ready note model create separate note records
  instead of reusing `leads.notes`?
- Does a future API contract need explicit note-only operations beyond
  `manualReviewNotes` on `PATCH /api/leads/:id`?
- Should note saves require concurrency tokens or updated-at checks?
- Should notes have author identity, created-at, updated-at, or source fields?
- Should note history exist?
- Should notes be exportable?
- Should production rollout require a migration or lazy DDL change?
- What production approval record is required before production saved-note use?

No new schema/table, generated suggestion storage, migration, production
rollout, or production proof is approved here.

## Explicit Non-Goals

- No generated note auto-save.
- No generated suggestion persistence.
- No generated suggestion send behavior.
- No generated suggestion treatment as human-authored saved notes.
- No generated suggestion snapshot table or field.
- No new schema/table changes.
- No migrations.
- No note history/versioning.
- No reviewer identity/auth ownership implementation.
- No delete semantics beyond clearing the saved manual note value.
- No retention implementation.
- No CRM, outreach, analytics, or LLM work.
- No manager dashboard expansion.
- No outcome learning.
- No production deploy.
- No Wrangler.
- No production D1 access.
- No production endpoint calls.
- No production logs or secrets.
- No production smoke test.
- No production observation claim.
- No destructive git.
- No branch deletion.
- No unrelated dirty work.

## Future Approval Gate

Before any follow-up beyond this exact local/test Option A slice begins, record
a new human approval that includes:

- exact selected follow-up scope
- whether note history, reviewer identity, concurrency, delete semantics beyond
  value clearing, or production rollout is included
- whether any schema or production D1 action is required
- validation commands
- explicit confirmation that production actions remain prohibited unless the
  follow-up is a separately approved production operation
