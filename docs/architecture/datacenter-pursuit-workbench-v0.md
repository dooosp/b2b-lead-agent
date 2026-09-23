# Data Center Pursuit Workbench v0

## Purpose and boundary

Data Center Pursuit Workbench v0 turns the synthetic Evidence Claim Registry and Specification Fit Engine foundation into a screen that a human can inspect. It answers a narrow question: for one synthetic project opportunity and one or more product families, what verified technical matches, mismatches, missing inputs, conflicts, specification-window state, and follow-up questions are visible now?

It is local/test-only and `NOT_PRODUCTION_EVIDENCE`. It does not use Worker routes, D1, a production or staging endpoint, live research, customer/private data, CRM, outreach, an LLM, reviewer identity, or persistent storage. `productionReady` and `productionReviewerWorkflowReady` remain `false`; Issue #165 remains `HOLD`.

## Deterministic source chain

```text
synthetic evidence-domain inputs + fixed scenario catalog
  -> materializeSpecFitScenario()
  -> validated claim registry + opportunity + fit evaluation + dossier hashes
  -> buildProjectSignalTimeline()
  -> buildPursuitWorkbenchViewModel()
  -> escaped server-rendered HTML and same-origin browser behavior
```

`pursuit-workbench/domain/scenarios.mjs` is the selection boundary. It never trusts a precomputed dossier: it calls the canonical scenario materializer exported by `eval/spec-fit-evaluator.mjs`, verifies the checked-in golden strong-fit JSON/Markdown and required timeline event types, then constructs the view model. Registry, dossier, timeline, and view-model validators use immutable validated objects and independently check hashes and size/cardinality bounds.

The catalog contains twelve checked-in scenarios covering strong cooling and electrical fits, multi-family comparison, hard mismatch, missing project evidence, unverified or conflicting capability evidence, closing/closed specification windows, retrofit, incompatible units, and an empty project. The fixed evaluation clock is `2026-06-01T00:00:00.000Z`.

## Timeline contract

`project-signal-timeline-v0` contains bounded, deterministically ordered evidence and derived events. Evidence events reference claim or requirement ids; derived events record fit, specification-window, conflict, and dossier-recomputation decisions. A snapshot is not treated as a historical change: generated evaluation events use `before: null` unless a real earlier state exists. Event ids and the timeline hash are content-derived. Future times, duplicate ids, invalid chronology, stage regressions, unknown or excessive references, retracted claims, conflicts, forged dossiers, and oversized artifacts fail closed.

The timeline limit is 100 events and 256 KiB; individual text and reference lists have lower explicit bounds. Blocked claim contents are never serialized into the timeline or view model—only safe ids, states, reason codes, and counts are exposed.

## Decision model and packet

The screen is decision-first: project/boundary, overall state, product-family fit matrix, verified matches, hard mismatches, missing evidence, conflicts, timeline, technical questions, and structured disposition controls. Technical fit is not a commercial decision. Pricing, availability, delivery, budget, procurement access, competition, and win probability are explicit non-claims.

Each family exposes only dispositions supported by its validated state:

- `READY_FOR_TECHNICAL_REVIEW`
- `HOLD_FOR_PROJECT_EVIDENCE`
- `HOLD_FOR_PRODUCT_EVIDENCE`
- `HOLD_FOR_TECHNICAL_REQUIREMENTS`
- `DEFER_FOR_PROJECT_STAGE`
- `REJECT_TECHNICAL_MISMATCH`
- `ESCALATE_DOMAIN_EXPERT`

The reviewer must choose one supported disposition, at least one allowed reason code, optional allowed question ids, and accept the fixed non-claims acknowledgement. The browser then creates `pursuit-review-packet-v0`: a canonical JSON object bounded to 32 KiB, linked to dossier/timeline hashes, marked `UNSIGNED_LOCAL_PACKET`, `persistence:NONE`, and `reviewerIdentity:NOT_COLLECTED`. Free text and extra fields are refused. Copy/download does not send or save the packet.

The v0 taxonomy contains only dispositions exercised by the curated canonical fixture subset. Although the underlying specification-window domain can represent a cancelled project, the checked-in 30-scenario PR #205 fixture has no cancelled FIT scenario. v0 does not fabricate cancellation-disposition coverage; adding that state requires a canonical fixture and a separately reviewed taxonomy extension.

## Server and browser safety

`npm run demo:pursuit-workbench` starts a Node HTTP server on `127.0.0.1:4173` by default. Only `127.0.0.1`, `localhost`, or `::1`, exact Host/Origin values, fixed GET/HEAD routes, and zero-length bodies are accepted. It rejects foreign hosts/origins, request bodies, mutation methods, encoded/traversal-shaped paths, and unknown routes. All content is read from fixed repository paths.

Responses use `no-store`, `nosniff`, no referrer, same-origin isolation, frame denial, a restrictive Permissions Policy, and a CSP limited to same-origin scripts/styles/connects with images, fonts, objects, workers, manifests, forms, and all default sources disabled. Rendering escapes untrusted text and does not embed raw fixture JSON. The page does not use cookies, local/session storage, IndexedDB, Cache Storage, a service worker, telemetry, external assets, or external requests.

## Accessibility and compatibility

The page has one `h1`, named navigation/main regions, an ordered timeline, a captioned table with scoped headers, grouped choices with legends, a focusable error summary, visible focus styling, high-contrast state tokens, a 390-pixel responsive layout, and reduced-motion behavior. Scenario changes work from the keyboard, validation returns focus to the first invalid group, status messages use an accessible live region, and packet copy has a select-all fallback.

The modules use Node 20-compatible ESM and browser WebCrypto. The server resolves repository assets independently of the caller's working directory and supports programmatic ephemeral ports for tests.

## Verification

Primary commands are:

```text
npm run test:pursuit-workbench
npm run eval:pursuit-workbench
npm run test:pursuit-workbench:e2e
```

CI also runs the existing claim/spec-fit gates, full root/Worker tests, naming/schema checks, and local-only Worker E2E. The Workbench evaluator runs all twelve scenarios twice and requires exact agreement, trace/policy validity, invalid-choice refusal, repeatability, accessibility contracts, zero blocked/secret/hostile exposure, zero external request/persistence, and bounded artifact sizes. These checks establish deterministic local behavior only; human usefulness still requires the separate review guide.

## Explicit non-goals and future gates

There is no save API, shared review queue, authenticated reviewer, production dataset, editable claim registry, commercial scoring, auto-approval, deployment, or proof execution. A later step may proceed only after human feedback identifies a concrete product need and the applicable data, auth, privacy/retention, migration, production-proof, and operational approvals are separately defined. This draft does not pre-authorize any of them.
