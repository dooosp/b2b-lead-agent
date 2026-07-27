# Pursuit Golden Dataset v0

> Historical compatibility baseline: Batch 01 inputs and approval hashes are
> intentionally immutable. The current additive candidate view is documented
> in `docs/roadmap/pursuit-golden-dataset-v1.md`.

## Status

- Dataset state: `PARTIALLY_ADJUDICATED`
- Boundary: `NOT_PRODUCTION_EVIDENCE`
- Evaluation date: `2026-07-26T00:00:00.000Z`
- Production readiness: `false`
- Golden readiness: `false`

This slice now contains the first explicitly approved human-review batch, but
it is not a completed Golden Dataset. Five projects and two required lifecycle
stage values remain missing. Public URLs and AI-assisted extractions outside
the approved batch remain candidates for review. The offline validator does
not prove that a remote document is official, reachable, current, applicable
to a Korean project, or sufficient for a product-fit decision.

## Seed Inventory

| Candidate class | Count | Human-adjudicated count |
| --- | ---: | ---: |
| Korean data-center projects | 15 | 10 |
| Public source documents | 37 | 0 |
| Product capability claims | 30 | 30 |
| Requirement/capability pairs | 10 | 10 |
| Product families | 2 | 0 |
| Revision/supersession links | 1 | 1 |

The two intentionally narrow product families are
`medium_voltage_switchgear` and `transformer`. The source candidates include
project/operator sources, manufacturer sources, and the official IEC catalog
pages for the 2011 and 2021 editions of IEC 62271-200. Documents are not copied
into the repository; only source metadata, URLs, locators, short excerpt
candidates, and a candidate remote hash where available are retained.

The 10 pair candidates deliberately compare published facility utility-feed
voltages against selected product-family voltage claims. They are review
questions, not fit results: the public sources do not provide a single-line
diagram, transformation boundary, equipment package, or procurement
specification, so a reviewer may conclude `NOT_APPLICABLE`, `MISMATCH`, or
`INSUFFICIENT_EVIDENCE` rather than `MATCH`.

## Trust Separation

The source candidate and human adjudication namespaces are separate files:

- `knowledge/golden-dataset/datacenter-kr-v0/public-source-candidates.json`
- `knowledge/golden-dataset/datacenter-kr-v0/human-adjudications.json`

The generated review input is a third, non-authoritative artifact:

- `tmp/codex/pursuit-golden-human-review-batch-01.json`

The completed decision draft is a fourth, still non-authoritative artifact:

- `tmp/codex/pursuit-golden-human-review-batch-01-proposal.json`
- `docs/roadmap/pursuit-golden-human-review-batch-01-proposal.md`

Its boundary is
`AI_ASSISTED_PROPOSED_DECISIONS_NOT_HUMAN_ADJUDICATION`. It pins both the
dataset and blank-batch hashes, contains suggestions for every Batch 01 item,
and keeps reviewer, receipt, timestamp, disposition, attestation, and changes
blank. It is never loaded as the authoritative adjudication file.

The explicit approval is recorded separately so the approved proposal remains
an immutable pre-approval object:

- `tmp/codex/pursuit-golden-human-review-batch-01-approval-receipt-non-production.json`

The receipt pins the candidate dataset, blank review batch, proposal,
materialized adjudications, and post-adjudication dataset hashes. Its reviewer
field is an unauthenticated repository assertion; it does not prove who
operated the repository. The authoritative adjudication file contains only
schema-allowed decision records and their common `HUMAN_DOMAIN_REVIEW`
envelope.

The candidate file permits only `AI_ASSISTED`, `RULE_ASSISTED`, or
`MANUAL_UNREVIEWED` annotations. It rejects human authority, verified fit,
customer-use, final-decision, and Golden-ready fields. Human decisions exist
only in the separate adjudication namespace.

The existing Evidence Claim Registry and Specification Fit Engine remain
synthetic-only. These public candidates are not injected into that registry and
cannot become `VERIFIED` through this audit.

## Machine Gate

Run:

```bash
npm run check:golden-dataset
```

The command validates canonical IDs, HTTPS/public URL shape, source-domain
candidates, date chronology, short excerpts, references, revision graphs,
product-family scope, source spans, human-authority receipts, and readiness
thresholds. Signed/auth/session query parameters are refused. Press releases
and portfolio pages can support candidate identity or stage observations, but
cannot be selected as project requirement/specification evidence. It writes:

```text
tmp/codex/pursuit-golden-dataset-audit-non-production.json
tmp/codex/pursuit-golden-human-review-batch-01.json
tmp/codex/pursuit-golden-human-review-batch-01-proposal.json
```

A structurally valid partial-adjudication packet exits successfully with
`goldenReady:false`. The stricter
`node scripts/audit-pursuit-golden-dataset.mjs --require-golden-ready` mode
intentionally exits with code 2 until human review and minimum coverage are
complete.

`npm run prepare:golden-review-batch` may be run independently. It reproduces
the approved pre-adjudication candidate snapshot, selects ten projects using a
deterministic evidence-priority policy, and includes all 30 capability claims,
all 10 pairs, and the IEC revision edge. Its boundary is
`DRAFT_HUMAN_REVIEW_INPUT_NOT_ADJUDICATION`; authority, receipt, timestamp,
identity, stage, product fit, blocker, influence-window, label, relationship,
and final-decision fields are all intentionally blank. The validator refuses a
prefilled human decision even when the packet hash is recomputed.

`npm run prepare:golden-review-proposal` may also be run independently after
the blank batch is generated. It deterministically reproduces the immutable
approved proposal preimage with all 10 project recommendations, all 30
capability recommendations, all 10 pair recommendations, and the revision
recommendation. Its validator rejects a prefilled human-approval envelope even
if the proposal hash is recomputed. Human-confirmed counts come only from the
separate materialized adjudications, never from this proposal.

## Human Review Required

For each project, a domain reviewer must explicitly confirm:

1. project identity;
2. current lifecycle stage;
3. applicable specification documents;
4. fit state for both product families;
5. blocking evidence;
6. specification influence window; and
7. final `PURSUE`, `HOLD`, or `NO_BID` decision.

When no public specification is available, the applied-document list may be
empty only with both product families labeled `INSUFFICIENT_EVIDENCE`, a
non-empty blocker list, and a final `HOLD` or `NO_BID`. Missing evidence cannot
be converted into a favorable fit.

The reviewer may approve the proposal as one batch only after inspecting the
linked sources and accepting the recommendations as their own domain judgment.
The recorded `reviewedAt` must be an actual ISO-8601 UTC timestamp at or after
the pinned evidence `evaluationAsOf` and not in the future. A review timestamp
before the evidence snapshot or after the current validation time is refused.

Capability and requirement/capability pair labels must also carry
`HUMAN_DOMAIN_REVIEW`, a review receipt, a review timestamp, evidence
references, and bounded reason codes. A revision/supersession candidate
contributes to readiness only after an exact human adjudication binds the newer
and older document spans. Superseded documents cannot remain selected as
project-stage, applied-specification, or pair evidence. Absence means pending;
AI annotations never fill a human field. Review receipts are repository
assertions for traceability; the offline validator does not authenticate
reviewer identity or prove that a human participated.

## Readiness Gaps

Golden readiness remains blocked until all machine thresholds pass, including:

- at least 10 human-confirmed projects;
- at least 30 public source documents;
- at least 30 human-confirmed capability claims;
- at least 10 requirement/capability pairs with complete human coverage;
- exactly two product families;
- at least five human-confirmed project stages;
- at least one human-confirmed revision/supersession link with full revision
  edge coverage; and
- full human coverage with zero provisional-label leakage.

Batch 01 satisfies the capability, pair, revision, and minimum ten-project
counts. Exactly two gaps remain: project adjudication coverage is 10/15 and
human-confirmed lifecycle-stage diversity is 3/5. The current candidate
projects expose only three candidate stage values, so the stage threshold
cannot be satisfied by labeling the current evidence differently. Additional
real project evidence is required; a reviewer must not invent stages to close
that gap.

## Non-Claims

- Candidate project stages are not live procurement status.
- Operating facilities are not automatically new-build opportunities.
- Published electrical values are not a bill of materials or supplier
  qualification.
- Manufacturer family-page maxima do not prove a simultaneously orderable
  Korean configuration.
- This packet does not approve network ingestion, production access, customer
  data, D1, CRM mutation, outreach, LLM execution, or automated pursuit
  decisions.
