# PR #206 Human Validation Pilot Decision

## Decision

`INCOMPLETE` — `NO_MERGE_INPUT_INCOMPLETE`

PR #206 was evaluated at `b5570e182c8ab6515c0f09272d22d7121518f134` against base `9d144fbe6309ce363f9dad8d50ffa713d24af683`. It remains Open, Draft, mergeable, unmerged, and green at evaluation time.

Five private, ignored, mode-`0600` session files exist, but all five are exact `NOT_STARTED` skeletons. They contain no completed reviewer identity band, task result, scenario judgment, timing result, usefulness decision, or finding. A prepared file is not a supplied human session.

## Actual input and result

| Measure | Result |
| --- | ---: |
| Session files present | 5 |
| Completed sessions supplied | 0 |
| Eligible sessions accepted | 0 / 5 required |
| Task results / scenario judgments | 0 / 0 |
| Human findings | 0 because none were observed |
| Human rates and median duration | unavailable (`null`) |
| Aggregate threshold | `INCOMPLETE` |
| Synthetic regression | 12 / 12, two repeat runs |

The synthetic result is deterministic regression evidence only. It contributes nothing to the human gate.

## Intake safety and method limits

The earlier tracked-free-text storage risk is resolved at the evaluated head: the local input directory is ignored and mode `0700`; each R1-R5 file is a regular, single-link mode-`0600` file; and the validator fails closed. No raw session content is copied into this artifact.

Independent read-only review found that the automated merge summary is not currently decision-capable:

- an ephemeral, non-human counterexample with one core task failed by all five records still returned `MERGE_THRESHOLDS_MET` because all 30 tasks are pooled;
- required specification-window, technical-question, packet-boundary, and recurring-confusion evidence does not reliably gate the summary;
- impossible timing input can validate because task totals are not reconciled to session totals or a matched baseline;
- the formal intake covers only three of twelve scenarios and most answer-key conformance is facilitator-coded.

These are method risks, not human-observed product defects. The Goal permits PR #206 fixes only after Track A is `REVISE`; with zero sessions, Track A must remain `INCOMPLETE`, so this refresh changes no PR #206 product code.

## Change-authority hold

The evaluated head includes `b5570e182c8ab6515c0f09272d22d7121518f134`, which added the validation intake after the cross-PR decision record had already classified Track A `INCOMPLETE`. This 2026-07-19 refresh did not create or modify that implementation, but the tracked Goal says fixes are allowed only for `REVISE`, and no explicit retention-authority record was found in the audited artifacts. Do not silently count this as an authorized fix: a change owner must either authorize retaining the commit under an exact documented exception or explicitly instruct a revert/restack. No history rewrite was performed.

## Exact next input

First, disposition the existing post-`INCOMPLETE` intake commit. Then a human validation-method owner must explicitly accept these limitations or authorize a separate protocol correction; the present Goal does not permit that PR #206 fix while Track A is `INCOMPLETE`. Obtain five de-identified, completed R1-R5 records from the required roles against the frozen runtime and hashes. Preserve task-level evidence and manually audit per-task failure, comprehension, and timing consistency. The command below remains a fail-closed input validator, but its `MERGE_THRESHOLDS_*` output is advisory:

```text
npm run validate:pursuit-workbench-human-validation
```

Until that happens, do not merge PR #206 and do not claim usability, trust, usefulness, time saving, accessibility success, or production readiness.

This artifact is `NOT_PRODUCTION_EVIDENCE`; `productionReady:false`; `productionReviewerWorkflowReady:false`; Issue #165 remains `HOLD`.
