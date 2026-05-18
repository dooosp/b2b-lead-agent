# Manual Review Notes Option A Implementation Plan

> **For agentic workers:** This is a plan-only decision artifact. Do not
> implement it from this document alone. Future execution requires a separate
> human approval that names the exact implementation scope, branch, files, and
> validation commands.

**Goal:** Define the safe local/test-only implementation path for Option A:
save only human-entered manual notes while generated reviewer note suggestions
remain copy-only helper text.

**Architecture:** Treat existing manual notes and generated reviewer note
suggestions as separate product concepts. The existing manual notes path can be
audited as a candidate implementation surface, but any schema, API, storage,
retention, edit/delete, or production data decision remains separately scoped.

**Tech Stack:** Cloudflare Worker pages and APIs, D1-backed lead rows, fake-D1
local tests, Node test runner, local-only route/page smoke tests.

---

## Recorded Human Decision

- `NEXT_PRODUCT_TRACK_DECISION`: `SAVED_NOTES_OPTION_A_PLAN_ONLY`
- `SAVED_NOTES_PERSISTENCE_DECISION`: `OPTION_A_PLAN_ONLY`
- `MANAGER_DASHBOARD_DECISION`: `HOLD`
- `OUTCOME_LEARNING_DECISION`: `HOLD`
- `PRODUCTION_PROOF_DECISION`: `HOLD`

Decision meaning:

- Continue only with a docs-only local/test-only plan for Option A.
- Option A means save only human-entered manual notes.
- Generated reviewer note suggestions remain copy-only.
- Generated suggestions must not be saved.
- Generated suggestions must not be sent.
- Generated suggestions must not be treated as human-authored saved notes.
- No saved-notes implementation is approved by this plan.

## Verified Baseline

- Repository: `dooosp/b2b-lead-agent`
- Default branch: `master`
- Current baseline: `c337310c56b89892b9be3092db635581175a99d3`
- PR #117: merged as `fix: reduce duplicate reviewer note suggestion display`
- Issue #115: closed as completed
- Decision packet present: `docs/roadmap/saved-review-notes-decision-packet.md`
- Standing approval policy present: `docs/standing-approval-policy.md`

This plan stays inside the standing non-production boundary. It does not
approve production deploy, Wrangler, production D1, production endpoint calls,
production logs or secrets, production smoke tests, or production observation
claims.

## Existing Manual Notes Path

Current repository inspection shows an existing operator note path:

- `worker/pages/lead-detail.js` renders a `textarea` named `notesArea` with
  `aria-label="메모를 입력하세요"` and sends entered text through
  `scheduleNoteSave()`.
- `scheduleNoteSave()` reads only the current `notesArea` value and calls
  `updateField('notes', val)` after a short debounce.
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

Option A should build on this audited path only if a future implementation
approval confirms that the existing `notes` field is the intended saved manual
note contract. This plan does not make that approval.

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

Do not introduce new provenance fields in this plan. If a future product
decision wants edited generated suggestions, generated snapshots, note history,
or reviewer identity, that is no longer plain Option A and must be separately
approved.

Minimum provenance question for future Option A implementation:

- Is the existing `notes` field sufficient because the only saved content is
  manual text?
- If multiple humans may edit the same lead, is a single mutable `notes` field
  still acceptable?
- Does the product need reviewer identity before saved notes can be considered
  audit-ready?
- Is a timestamp already provided by `updated_at`, or does note-specific timing
  need a separate contract?

## Edit And Delete Questions

Open product questions before implementation:

- Is editing a manual note allowed after the first save?
- Does editing replace the prior note, or does it need version history?
- Is clearing the manual note field a delete action?
- If clearing is delete, is it hard delete or soft delete?
- Who is allowed to delete a manual note?
- Does delete require a confirmation state?
- Does changing `reviewStatus` affect existing manual notes?
- Should the UI show that a note may be stale after the lead state changes?

No edit, delete, versioning, stale-note labeling, or confirmation behavior is
implemented or approved here.

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

## Local/Test-Only Implementation Candidates

These are candidate future slices only. They are not approved for execution by
this document.

### Candidate 1: Existing Manual Note Contract Audit

Purpose: prove the current manual note path is the only save path.

Files to inspect in a future implementation:

- `worker/pages/lead-detail.js`
- `worker/api/leads.js`
- `worker/db/leads.js`
- `worker/db/transform.js`
- `worker/tests/lead-patch-atomicity.test.mjs`
- `worker/tests/lead-review-status.test.mjs`
- `worker/e2e/local-e2e.test.mjs`

Expected local evidence:

- Manual `notesArea` entry produces a `PATCH` body with `notes`.
- Generated note copy controls do not produce a `PATCH` body with `notes`.
- Invalid mixed payloads do not partially update notes.
- Managed lead refresh does not overwrite existing manual notes.

### Candidate 2: Manual-Only Label And Copy Boundary Tests

Purpose: clarify UI wording without changing persistence behavior.

Files to inspect in a future implementation:

- `worker/pages/lead-detail.js`
- `worker/pages/leads.js`
- `worker/pages/opportunity-workbench.js`
- `worker/tests/lead-review-status.test.mjs`
- `worker/tests/opportunity-workbench.test.mjs`

Expected local evidence:

- Manual note input is labeled as human-entered manual notes.
- Generated suggestions are labeled as generated copy-only suggestions.
- Copy buttons copy text only.
- Copy fallback selects visible generated text only.
- No generated suggestion has save, send, CRM, analytics, or persistence copy.

### Candidate 3: Fake-D1 Manual Note Persistence Tests

Purpose: prove Option A behavior with local fake-D1 only.

Files to inspect in a future implementation:

- `worker/tests/helpers/fake-d1.mjs`
- `worker/tests/helpers/fixtures.mjs`
- `worker/tests/lead-patch-atomicity.test.mjs`
- `worker/tests/lead-review-status.test.mjs`

Expected local evidence:

- A human-entered `notes` patch persists to fake-D1.
- A generated suggestion copy action does not persist to fake-D1.
- Notes remain unchanged when an invalid `reviewStatus` is submitted in the same
  payload.
- Notes remain unchanged when an invalid sales `status` transition is submitted.

### Candidate 4: Local Route Smoke For No Generated Auto-Save

Purpose: prove visible reviewer note suggestions remain copy-only in the local
loopback harness.

Files to inspect in a future implementation:

- `worker/e2e/local-e2e.test.mjs`
- `docs/local-e2e-harness.md`

Expected local evidence:

- Local fake-D1 route/page smoke renders generated suggestions.
- Copying generated suggestions does not call note persistence.
- Manual note entry remains the only save candidate.
- Browser-memory activity reset remains browser-memory only.

## Required Tests For A Future Implementation

Any future Option A implementation should run at minimum:

- `git diff --check`
- `npm run check:naming`
- `npm run check:schema`
- `npm run eval:lead-quality`
- `npm test`

Future UI behavior changes should also consider:

- `npm run test:e2e:local`

Do not run production E2E, deploy commands, Wrangler, production DB commands,
production endpoint smoke tests, secret or log reads, or production observation
steps for Option A local/test-only work.

## Separate Schema, API, And Persistence Questions

These questions remain separate from this plan-only record:

- Is the existing `leads.notes` field the complete Option A persistence model?
- Should Option A create a new note record model instead of reusing
  `leads.notes`?
- Is the current `PATCH /api/leads/:id` body shape enough, or does a future API
  contract need explicit note-only operations?
- Should note saves require concurrency tokens or updated-at checks?
- Should notes have author identity, created-at, updated-at, or source fields?
- Should note history exist?
- Should notes be exportable?
- Should production rollout require a migration or lazy DDL change?
- What production approval record is required before production saved-note use?

No schema, API, D1 persistence expansion, migration, production rollout, or
production proof is approved here.

## Explicit Non-Goals

- No saved notes implementation.
- No schema changes.
- No D1 persistence changes.
- No migrations.
- No API contract changes.
- No runtime UI behavior changes.
- No generated note auto-save.
- No generated suggestion persistence.
- No generated suggestion send behavior.
- No generated suggestion treatment as human-authored saved notes.
- No edit/delete implementation.
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

Before any implementation begins, record a new human approval that includes:

- exact selected Option A scope
- exact branch and base SHA
- exact files allowed to change
- whether existing `leads.notes` is approved as the persistence contract
- whether UI copy changes are allowed
- whether tests only, docs only, or local runtime changes are allowed
- validation commands
- explicit confirmation that production actions remain prohibited

Absent that approval, stop at this plan.
