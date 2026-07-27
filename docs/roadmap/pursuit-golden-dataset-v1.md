# Pursuit Golden Dataset v1

## Status

- Dataset state: `HUMAN_CONFIRMED`
- Boundary: `NOT_PRODUCTION_EVIDENCE`
- Evaluation date: `2026-07-26T00:00:00.000Z`
- Production readiness: `false`
- Golden readiness: `true`

Version 1 is an additive, hash-pinned extension of the immutable Batch 01
dataset. It does not rewrite the approved v0 candidates, adjudications, or
approval receipt. The explicit Batch 02 approval materialized the complete
seven-project addition, including the Wanju `FEASIBILITY` and Ulsan `DESIGN`
observations. The resulting offline audit is `HUMAN_CONFIRMED` with no
threshold gaps.

## Inventory And Gaps

| Candidate class | Candidate count | Human-adjudicated count |
| --- | ---: | ---: |
| Korean data-center projects | 17 | 17 |
| Public source documents | 39 | 0 |
| Product capability claims | 30 | 30 |
| Requirement/capability pairs | 10 | 10 |
| Product families | 2 | 0 |
| Revision/supersession links | 1 | 1 |
| Lifecycle stages | 5 | 5 |

Candidate projects and materialized human decisions now span all five
lifecycle values. The validator reports full project coverage (`17/17`),
human-confirmed lifecycle diversity (`5/5`), and an empty `thresholdGaps`
array. Candidate diversity was not counted as human diversity before the
hash-bound Batch 02 approval was materialized.

## Immutable Lineage

The v1 loader composes and verifies:

- the v0 candidate file and Batch 01 adjudications;
- the Batch 01 approval receipt and post-adjudication dataset hash;
- the immutable v1 public-source additions; and
- the append-only Batch 02 adjudication-additions file, now containing the
  complete seven-project batch. The loader permits only the original empty
  state or that exact complete batch.

The lineage record is
`knowledge/golden-dataset/datacenter-kr-v1/lineage.json`. A non-empty Batch 02
addition is refused unless the separate receipt binds the exact additions,
blank review batch, proposal, pre-adjudication dataset, composed
adjudications, and post-adjudication dataset. Batch 01 files are never
overwritten by the Batch 02 path.

## Added Official-Source Candidates

1. **Wanju AI Data Center — `FEASIBILITY`.** The [Wanju County release](https://www.wanju.go.kr/planweb/board/view.9is?boardUid=ff8080818b024d8e018b1c99655f1226&categoryUid1=ff8080818b024d8e018b1c9ab0b61240&contentUid=ff808081898ba9ba0189f1e5b90901a7&dataUid=4028a6029bdaa74e019c99a6704621a1) records
   an MOU, a fixed industrial-complex site, 20 MW capacity, and a passed grid
   impact assessment. This supports advanced feasibility on the publication
   date, but not proof that detailed design, permitting, financing close, or
   construction began.
2. **Ulsan Carbon-Zero Underwater Data Center Standard Model — `DESIGN`.** The
   [Ulsan Metropolitan City release](https://www.ulsan.go.kr/u/rep/bbs/view.do?bbsId=BBS_0000000000000027&dataId=180322&mId=001004003001000000) says the R&D project starts with site
   analysis, basic design, ground analysis, and server-cooling design before a
   future testbed. It is a research standard model, not proof of a commercial
   construction or equipment-procurement package.

Both records retain only source metadata, URLs, locators, and short
paraphrases. Remote documents are not stored and no remote content hash is
claimed. Neither press release is an eligible applied project specification.

## Machine Gate

Run:

```bash
npm run check:golden-dataset
```

The command checks v0 compatibility, v1 lineage, the current dataset audit,
both review packets and proposals, and both guarded approval paths. A final
read-only gate rebuilds every audit, JSON, and Markdown artifact in memory and
byte-compares it with the repository copy, so CI reports drift instead of
silently rewriting it. The default audit targets v1; the explicit v0 paths
remain available for Batch 01 hash reproduction. After approval, use the
separate `prepare:golden-review-*` commands only for verified deterministic
reproduction or as the basis of a separately versioned review workflow; do not
rewrite the immutable approval inputs.

The stricter readiness mode now exits successfully for the checked-in,
human-confirmed dataset:

```bash
node scripts/audit-pursuit-golden-dataset.mjs --require-golden-ready
```

## Approval Boundary

The immutable Batch 02 proposal covers exactly seven projects and no
capability, pair, or revision records. All project proposals use conservative
product-fit and influence-window decisions. Its human-authority fields remain
blank because it is the pre-approval input; approval is recorded separately in
the additions and receipt artifacts.

The supplied `Jang tae ho` reviewer assertion approved the proposal as written
and the guarded materializer recorded:

- receipt: `golden-batch02-20260726t045706252z-72500e3c4a75-4876e32ee2b14721995a82eb9952f9b7`;
- reviewed at: `2026-07-26T04:57:06.252Z`;
- additions hash: `9fcdb4c0eef8b103b03480dd2787502b6d0f709bc8c138ed0c588592af2f7460`;
- composed-adjudications hash: `3ec5eedb5580e78647b9368a79ba6edbccb5506a2448ab2bcd5d900981bac6f1`;
- post-adjudication dataset hash: `203adea096eb4187fd9f09ce945a49eaf957e9d95a23bbbd84dceb3f3de55301`;
  and
- receipt canonical hash: `fa2ddb19f204441845a017ae2fe12dd79151050ec1c366cfe5ca8e0916d98ce3`.

This approval is append-only and makes only the offline coverage rules report
`goldenReady:true`. It is an unauthenticated repository assertion: it does not
prove reviewer identity or production evidence, approve customer use,
authorize production or D1 access, or permit CRM, outreach, or automated final
decisions.
