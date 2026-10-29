# Review experience improvements

## Scope and design

The owner asked for autonomous design/refactoring improvements through verified
completion. Work from remote `master` at
`aef67fbea174a5db0b01d480a30f923a6b35d075` (PR #216), not the older control
checkout. Keep its landed refactoring intact.

Improve two current user journeys: the standalone synthetic portfolio walkthrough
and preservation of human-entered drafts in the existing reviewer UI. Use the
existing JavaScript renderers and browser tests, with no framework or dependency
changes. A broader redesign would obscure the focused three-revision demo;
cosmetic-only changes would leave verified input-loss paths. The chosen scope
combines clear presentation with bounded fixes to those paths.

Constraints: offline single-file portfolio HTML, unchanged frozen fixtures/engine
and demo fingerprint, unchanged API/schema/auth/storage contracts, no new browser
persistence. Keep `productionReady:false`, `NOT_PRODUCTION_EVIDENCE`, Issue #165
`HOLD`, explicit AI simulation attribution, and no formal-pilot contribution.
No production/staging access, customer data, provider calls, deployment, outreach,
or messages to third parties. This task ends with a locally reviewed change;
commit, push and merge are separate actions.

## Task 1 — Portfolio presentation and record usability

Ownership: `scripts/lib/portfolio-v1-page.mjs`, new adjacent portfolio view/style/
browser fragments if useful, `tests/portfolio-v1.test.js`, and
`worker/e2e/portfolio-v1.test.mjs`.

- [x] Add failing browser regressions for incomplete-record guidance and print
  disclosure expansion/restoration, then implement and rerun.
- [x] Clarify the R1/R2/R3 comparison with a restrained responsive hierarchy and
  a compact overview; preserve existing button labels and all fixture meaning.
- [x] Show claim applicability from the actual claim (country, product family,
  project stage, conditions), and distinguish VERIFIED, ALLOWED and FIT.
- [x] Label all four record fields required; show completed/missing fields and
  preserve the explicit record-kind choice, draft guard and download contract.
- [x] Expand disclosures for printing, then restore exactly the prior state,
  without changing the selected revision or draft; handle browser-menu print.
- [x] Separate CSS/browser behavior into readable dependency-free fragments as
  needed while keeping the generated HTML standalone and CSP unchanged.

## Task 2 — Reviewer draft resilience

Ownership: Worker detail/list note and feedback controllers, their focused
unit tests and `worker/e2e/feedback-detail.test.mjs`, plus a separate note E2E
file if needed. Do not edit portfolio files.

- [x] Reproduce detail feedback loss through internal status/409 refresh and
  manual note failure before implementing fixes.
- [x] Preserve same-lead unsaved feedback during internal refresh, with an
  explicit conflict/retry notice. Never automatically retry a mutation on 409.
- [x] Retain manual note text on ordinary server/network failure; visibly report
  the failure in list/detail, and keep deliberate retry available.
- [x] Preserve edits made while saves are pending; do not label a newer unsaved
  draft as saved. Keep denied-role protected fields omitted and do not restore
  drafts into a denied or unrelated lead page.
- [x] Warn on navigation when genuinely unsaved input would be lost; do not add
  local/session storage, window.name, generated-note persistence or identity.

## Review focus and final checks

Review whitespace-only required inputs, cancelled/repeated print, 320px layout,
offline file downloads, AI versus human record attribution, save/clear reversal
while pending, ordinary write errors, 409 conflicts, access loss and retry.

- [x] Focused suites pass and code review has no unresolved actionable defects.
- [x] `npm test`, `npm run test:e2e:local`, `npm run test:worker:runtime`,
  `npm run check:naming`, `npm run check:schema` pass under Node 24.22.1.
- [x] Inspect desktop/mobile rendered portfolio and save local screenshots.
- [x] Record actual commands, counts, source hashes and limits in a fresh
  evidence file; preserve historical verification records unchanged.

## Execution notes

The original checkout's Git reads stalled. The native worktree attempt failed;
its replacement source path is outside the app tool's permitted workspace list.
A clean clone of the pinned remote commit and a normal Git worktree are used on
`codex/portfolio-review-ux`. The original checkout is not edited. App attachment
of the fallback checkout is unsupported because it is not a managed worktree.

## Final result

STATUS: SHIP for the local implementation. Final Node 24.22.1 runs report
725 unit/contract + 51 browser + 11 runtime = 787 tests passed, no failures,
skips or TODOs. Naming, schema, Level 1 and eight other existing CI gates pass.
Independent review PASS after two reproduced list/cache races were fixed.
Source hashes and exact scope are in
`docs/portfolio/review-experience-2026-10-29-verification.json`.
At this local verification checkpoint, no commit, push, PR, merge or deployment
had been performed. Subsequent integration is recorded separately in GitHub.
