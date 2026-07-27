# Pursuit Twin v0 — Spec Delta and Minimum Evidence to Advance

## Status

- Contract boundary: `LOCAL_TEST_SYNTHETIC_ONLY` / `NOT_PRODUCTION_EVIDENCE`
- Production readiness: `false`
- Issue #165 production-proof status: `HOLD`
- Technical decision scope: `TECHNICAL_FIT_AND_SPEC_WINDOW_ONLY`
- Final human pursuit decision: `NOT_MADE`

This slice implements the next product contract after Golden Dataset human
confirmation. It does not ingest Golden adjudications into the executable Claim
Registry and does not create a production Project Pursuit route, API, database,
outreach action, or automatic bid decision.

## Implemented Contract

`project-opportunity-snapshot-v0` binds a validated synthetic Project
Opportunity and recomputed Specification Fit result to a source document
revision, observation time, complete materialized Claim Registry hash, and data
center vertical-pack hash. A successor must point to the exact preceding
revision and move forward in time.

`spec-delta-v0` validates and recomputes both snapshots. It reports:

- source revision, stage, candidate-family, requirement, value, and evidence
  reference changes;
- product-family fit, window, reason, matched, and missing-requirement
  transitions;
- whether evaluation was invalidated and whether the technical outcome changed;
- a two-revision timeline; and
- `REVIEW_REQUIRED` when changed input makes a supplied prior human decision
  unsafe to carry forward.

The engine never converts, replaces, or approves a prior human decision.

`minimum-evidence-to-advance-v0` analyzes current requirement and window reason
codes rather than only Dossier missing IDs. It distinguishes evidence gaps from
terminal/time/configuration/scope gates, ranks side-aware evidence requests, and
selects a deterministic minimum set that can enable at least one product-family
re-evaluation.

Completing the set has only `RE_EVALUATE_ONLY` effect. It never guarantees
`FIT`, a favorable window, or `PURSUE`.

## Product Surface

The Worker home page Project Pursuit tab contains one explicit synthetic,
read-only example. It shows revision/fit/window transitions, prior-decision
review state, and ordered minimum evidence. It is not backed by D1 or a live
official project and carries the synthetic/non-production/final-decision labels
in the visible surface.

## Machine Gates

```bash
npm run eval:pursuit-twin
npm run test:claim-spec-fit
npm test
npm run test:e2e:local
```

The evaluator runs twice and requires byte-stable canonical output. Tests cover
lineage and hash tampering, recomputation, ordering, decision invalidation,
evidence versus non-evidence gates, escaping, and prohibited production/final
decision inputs.

## Explicit Non-Claims

- Golden Dataset human confirmation is not executable verified project or
  capability evidence.
- Minimum Evidence is not a counterfactual promise and does not guarantee fit.
- A repository assertion about a prior decision is not authenticated reviewer
  identity.
- The read-only synthetic UI is not a live Project Pursuit workflow.
- No production endpoint, D1 access, customer/private data, CRM/outreach, LLM,
  deployment, or production-readiness claim is authorized.

## Next Action

The separately scoped Pursuit Value Pilot method and private local tooling are
now implemented. The next action is human execution: five qualified,
de-identified reviewers and one team must complete the fixed synthetic packet
round before review time, traceability, accepted technical state, detected
gaps, or repeat-use intent can be claimed. Current human evidence remains
`INCOMPLETE`.

Counterfactual Fit remains future work and requires a separate assumption
namespace that cannot enter verified claims or final decisions.
