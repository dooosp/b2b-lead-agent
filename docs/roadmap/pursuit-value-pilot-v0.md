# Pursuit Value Pilot v0

## Status

- Method: `COUNTERBALANCED_MATCHED_SYNTHETIC_PROJECT_REVIEW`
- Boundary: `LOCAL_TEST_SYNTHETIC_ONLY` / `NOT_PRODUCTION_EVIDENCE`
- Pilot tooling: implemented in this repository slice
- Human pilot evidence: `INCOMPLETE`
- Eligible completed reviewers: `0 / 5` until humans complete the private records
- Weekly participating teams: `0 / 1` until the team-week record is completed
- Human pilot disposition: `NOT_MADE`
- Automatic pilot or pursuit decision: `false`
- Production readiness: `false`
- Issue #165 production proof: `HOLD`

This is a separate product-value experiment for Pursuit Twin v0. It does not
modify, rerun, replace, or combine results with the frozen PR #206 five-person
Workbench validation method. Blank files, generated HTML, canonical hashes,
synthetic fixtures, tests, and machine aggregation are not human evidence.

## Question

Can five qualified, de-identified industrial technical reviewers use a
hash-bound synthetic Pursuit Twin packet to reach a traceable human
`PURSUE`, `HOLD`, or `NO_BID` decision faster, identify a material gap
before that decision, and express intent to use the packet again without
turning a technical state into an automatic commercial decision?

The current product does not produce a final system pursuit decision.
Consequently, “system final-decision acceptance” is
`NOT_MEASURABLE_NO_SYSTEM_FINAL_DECISION`. The pilot separately measures
whether the reviewer accepts the packet's technical state as written and
whether the reviewer would adopt their own assisted human decision in an
internal review.

## Frozen Design

- Five anonymous reviewer slots: `PV-R1` through `PV-R5`.
- Role coverage: two industrial technical-sales reviewers, two application
  engineers, and one tender/specification/design-support reviewer.
- One anonymous team slot: `TEAM-1`.
- Five distinct repository-generated synthetic project cases.
- Each case appears exactly once in the baseline condition and once in the
  Pursuit Twin condition.
- Reviewer assignments form a fixed cyclic matched design with mixed
  `BASELINE_FIRST` and `TWIN_FIRST` order.
- Baseline and Twin cases for one reviewer are different, so the same project
  is not reviewed twice by that reviewer.
- Each baseline artifact and Twin packet is bound to the complete validated
  Claim Registry, data-center vertical pack, snapshots, Spec Delta, Dossier,
  Minimum Evidence, JSON, Markdown, and canonical hashes.

Timing remains a descriptive local browser observation. Reviewer-controlled
offline timing and the small synthetic cohort do not prove causal productivity
improvement or external validity.

## Success Criteria

All five eligible sessions and the one team-week record are required. Four
sessions never shrink a denominator and leave every success conclusion
`INCOMPLETE`.

| Metric | Fixed calculation | Target |
| --- | --- | --- |
| Paired initial-review time reduction | median of five `(baseline - Twin) / baseline` observations | at least 50% |
| Traceable human decisions | Twin decisions with human trace confirmation and packet-resolving support references / 5 | 100% |
| Accepted technical state | `ACCEPTED_AS_WRITTEN` / 5 | at least 70%; with five reviewers this requires 4/5 |
| Key-gap project coverage | distinct Twin projects with at least one packet-bound `KEY` gap surfaced before final decision / 5 | 100%, and mean at least 1 per project |
| Unsupported customer-use claims | structured observations across eligible sessions | 0 |
| Repeat-use intent | reviewers selecting `YES` / 5 | at least 3/5 |
| Weekly repeated-use pilot team | completed anonymous team-week records with `repeatUseObserved:YES` and at least two actual packet uses | at least 1 |

Threshold calculation is deterministic, but it never chooses `CONTINUE`,
`REVISE`, `STOP`, `MERGE`, a final pursuit decision, or a production
decision. After complete human input, the aggregate can only become
`COMPLETE_FOR_HUMAN_DISPOSITION`.

## Human-Only Inputs

The repository may prefill identifiers, assignments, boundaries, allowed
enums, trace references, gap identifiers, and hashes. It must not prefill or
infer:

- actual role/experience and eligibility attestations;
- baseline or Twin review duration;
- either human `PURSUE`, `HOLD`, or `NO_BID` decision;
- `ACCEPTED_AS_WRITTEN`, `MODIFIED`, or `REJECTED`;
- evidence-trace confirmation or selected support references;
- gap materiality, prior awareness, or discovery-before-decision;
- unsupported-claim observations;
- reuse, weekly-packet, decision-impact, or
  willingness-to-pay answers; or
- final pilot disposition.

Negative results are valid evidence. Operators must not change them to make a
threshold pass.

## Local Reviewer Flow

Prepare the private, ignored reviewer package:

```bash
npm run prepare:pursuit-value-pilot
```

The command creates five standalone offline HTML files, five blank private JSON
records, and one blank team-week record under
`tmp/pursuit-value-pilot-v0/`. It refuses overwrite, alternate paths, extra
arguments, unsafe permissions, symlinks, and hard links.

Each reviewer opens only their assigned HTML file. The page:

1. confirms the synthetic/non-production boundary;
2. follows the fixed assigned baseline/Twin order;
3. records browser-monotonic descriptive timing;
4. locks a completed phase before revealing the next one;
5. accepts structured human answers only; and
6. downloads a JSON response without sending it to any server.

After each downloaded reviewer response replaces only its matching prepared
`session-pv-rN.json`, the anonymous team coordinator fills only these six
values in `team-week-team-1.json`:

- `participationConfirmed`: `YES`;
- `syntheticOnlyConfirmed`: `YES`;
- `weekStartedAt` and `weekCompletedAt`: actual ISO-8601 UTC timestamps;
- `packetUseCount`: the actual integer count from 1 through 100; and
- `repeatUseObserved`: `YES` or `NO`.

That team file is a hashless response envelope pinned to the original blank
team-week hash, so the human can fill those six values without forging a
canonical record. All binding fields and every negative answer must remain
unchanged. Then validate and aggregate:

```bash
npm run validate:pursuit-value-pilot
```

The validator reads only the fixed private directory and emits a redacted
aggregate. It does not print case content, human answers, identities, or
protected prose.

Repository-only readiness and deterministic contract checks:

```bash
npm run eval:pursuit-value-pilot
npm run check:pursuit-value-pilot
```

## Privacy and Authority Boundaries

- Reviewer identity is `NOT_COLLECTED`; reviewer and team codes are not
  authenticated identities.
- The intake has no arbitrary free-text field.
- Names, employers, customers, contact details, URLs, private paths,
  credentials, secrets, customer/private data, and real project facts are
  refused.
- Detailed session files stay in the ignored private directory. Only a bounded,
  redacted aggregate may enter repository evidence.
- Offline HTML uses no network, storage, cookies, API, D1, CRM, outreach, LLM,
  telemetry, or production integration.
- Hashes prove content consistency, not human identity, truth, or external
  validity.

## Explicit Non-Claims

- No human session or weekly team use has been completed by implementation.
- Synthetic cases do not prove real project, product, or customer accuracy.
- A human final pursuit decision is not a system recommendation.
- A threshold-met aggregate would remain a small local product signal, not
  production evidence, market validation, or permission to deploy.
- No production/staging endpoint, D1, logs, secrets, customer/private data,
  CRM, outreach, email, LLM, analytics, or automated final decision is
  authorized.

## Next Human Action

Run the prepared packet with five qualified reviewers and one participating
team, preserve every positive and negative structured result, then review the
redacted aggregate and make a separate explicit human pilot disposition.
