# Commercial pilot preparation

The owner requested competitor-based pricing and autonomous improvements through
completion. Continue in the existing isolated `codex/portfolio-review-ux`
worktree at `aef67fbea174a5db0b01d480a30f923a6b35d075`, preserving the earlier
787-test UX checkpoint. The original implementation scope excluded branch
changes, commits, pushes, merges and deployment. This file records that local
checkpoint; the owner's subsequent continuation request starts integration.

## Decision and product design

Working buyer assumption: a small industrial technical-sales/application team
reviewing requirements, source applicability and next evidence requests.
Current synthetic demo cannot support a production SaaS sale or proven ROI.
Recommended price experiment: a scoped two-week assisted pilot at KRW1,500,000;
after human value and operational prerequisites, test KRW290,000/team/month.
These are proposed prices, not observed willingness to pay or available billing.
Official competitor price observations and transparent cost assumptions belong
in a separate repository pricing decision document and the final answer.

Build a repeatable synthetic review workspace beside the existing portfolio.
Reuse the current trusted engine; do not build a SKU selector, counterfactual
fit engine, data importer that promotes claims, or a payment/auth system.
The workspace turns seven frozen scenarios into inspectable review work, retains
human-entered drafts per case, reopens its own bounded JSON records, and exports
JSON plus a readable Markdown decision package. This supports pilot preparation
and measurement; it does not complete human validation or authorize real data.

## Shared constraints

- Preserve `NOT_PRODUCTION_EVIDENCE`, `productionReady:false`, Issue #165 `HOLD`,
  synthetic fixtures, explicit AI versus self-reported authorship, and
  `formalPilotContribution:false`.
- No actual customer/private data, external providers, live research in the
  evaluation engine, account setup, real auth, remote D1, endpoints, deployment,
  messaging/outreach, billing, telemetry or browser persistence.
- Existing `buildPortfolioDemo()` and its frozen hash stay unchanged.
- One-file offline HTML; loopback-only read-only preview; no arbitrary output
  path or remotely loaded script/font. Use existing Node24.22.1 dependencies.

## Task A — Curated model (model worker)

Own `scripts/lib/pilot-review-workspace.mjs` and
`tests/pilot-review-workspace.test.js`; if a shared evaluator builder extraction
is needed, own its small helper and relevant evaluator tests too.

- [x] Expose `buildPilotReviewWorkspace()` and `buildPilotReviewCase(id)`.
- [x] Curated IDs: `ELECTRICAL`, `MISSING_VOLTAGE`, `HARD_MISMATCH`,
  `UNVERIFIED_CAPABILITY`, `EXPIRED_CAPABILITY`, `WRONG_JURISDICTION`,
  `WINDOW_CLOSED`. Reject unknown IDs. Use current checked-in fixture registries
  and actual engine evaluation at fixed `evaluationAsOf`, never arbitrary input.
- [x] Workspace shape: `{schemaVersion:'b2b-pilot-review-workspace-v1',
  evidenceBoundary:'NOT_PRODUCTION_EVIDENCE',synthetic:true,productionReady:false,
  issue165Status:'HOLD',evaluationAsOf,workspaceSha256,cases:[...]}`.
- [x] Each case: `{id,title,description,opportunity,evaluation,minimumEvidence,
  dossier,claims,inputSha256,caseSha256}`. Preserve actual nested engine shapes.
  `claims` are relevant normalized claim records from that case's registry;
  include required/project/stage/family references even when not eligible.
  Hash canonical materialized inputs and outputs, excluding the hash itself.
- [x] Meaningful tests cover deterministic exact inputs/results, missing evidence
  versus hard mismatch, unverified/expiry/scope/window distinctions and refusal.

## Task B — Offline workspace and review contract (UI worker)

Own new `scripts/lib/pilot-review-page.mjs`, browser/style/record modules,
`tests/pilot-review-record.test.js` and `worker/e2e/pilot-review.test.mjs`.
Do not edit existing portfolio/Worker reviewer modules.

- [x] Export `renderPilotReviewPage(workspace)` returning standalone HTML. Show
  case queue, actual requirements/fit/window, evidence scope/quotes, concrete
  evidence requests and non-evidence blockers. Explain FIT is not approval.
- [x] Store per-case human review in page memory only: disposition
  `UNDECIDED|CONTINUE_TECHNICAL_REVIEW|HOLD|EXCLUDE_CURRENT_CANDIDATE`, reason,
  nextAction, optional baselineMinutes/assistedMinutes. No inferred decision,
  identity, reason or measured timing. Completion requires explicit disposition,
  nonblank reason and nextAction; allow draft export with truthful completeness.
- [x] Explicit record kind `OWNER_REPRODUCTION|OTHER_USER_TRIAL|AGENT_SIMULATION`;
  never default to a human kind. AI exports carry `AI_AGENT_SIMULATION` and
  `humanParticipant:false`; other kinds remain `SELF_REPORTED_NOT_VERIFIED`.
  All timing is self-reported and does not become formal-pilot/ROI evidence.
- [x] JSON record schema `b2b-pilot-review-record-v1` binds workspace and case
  hashes and contains only allowlisted review fields plus fixed boundary data.
  Import accepts only this workspace's records; strict types/enum/unique IDs,
  max128KiB UTF-8 file, max1600 chars per free-text field, finite optional
  durations 0..1440. Reject forged authority, unknown keys and mismatched hashes.
  Never import engine/registry assertions or execute HTML from records.
- [x] Export JSON and escaped readable Markdown including immutable engine
  results/traces plus separate self-reported reviewer decisions. Summarize only
  paired self-reported timings, include count and negative savings; no invented
  baseline/default or claimed effectiveness. Warn before unsaved page exit and
  confirm before replacing nonempty drafts with a file/reset.
- [x] Responsive keyboard-accessible UI and explicit validation errors. Test
  draft switching, export/import roundtrip, forged/malformed/oversize records,
  AI attribution, hostile text, incomplete/negative timings, 320px/offline flow.

## Task C — Delivery, price evidence and integration (root)

- [x] Add `scripts/pilot-review-workspace.mjs`, safe fixed outputs and loopback
  preview using the existing patterns; package scripts `demo:pilot`,
  `demo:pilot:serve`, `test:pilot`. CLI refuses arbitrary paths/options.
- [x] Document official competitor currencies/units/commitments and limitations,
  price assumptions, explicit pilot scope/acceptance criteria and a future
  subscription gate. No unsupported enterprise quote or measured savings claim.
- [x] Link workspace from README, preserve portfolio entry and history. Generate
  sample artifacts and inspect live desktop/mobile/offline behavior.
- [x] Focused tests, whole npm test, local E2E, local workerd, naming/schema and
  applicable deterministic CI gates. Independent review, fix verified defects,
  then record actual counts, source hashes and remaining human/operational gates.

Review focus: fake imported verification; XSS/Markdown injection; engine/UI result
drift; stale/mismatched draft hashes; falsely complete human/AI measurements;
negative or unpaired time deltas; unsafe file output or symlinks; preserved
previous UX work. More tests are not proof of buyer value or production readiness.

## Final local result

809 distinct tests passed (269 root +443 Worker unit +30 contract +56 browser
+11 local workerd), zero failures/skips/TODOs. Naming/schema/claims/spec-fit/Level1
gates and clean ignore-scripts installation passed. Independent code review PASS
after exact JSON export/import byte-bound repair. Pricing recommendation reviewed
as an explicit assumption, not willingness-to-pay or commercial-readiness evidence.
Previous UX source fingerprints preserved except additive package scripts.
At this local verification checkpoint, no human trial, paid pilot, payment,
customer outreach/data, commit, PR, merge or deployment had been performed.
Subsequent repository integration is recorded separately in GitHub; it does not
change human or production evidence. Remaining sales/production prerequisites are explicit in
`docs/portfolio/commercial-pricing-and-pilot.md`.
