# Pursuit Golden Dataset Human Review Batch 01

> Batch 01 is the immutable approved baseline. The pending-only follow-up is
> documented in `docs/roadmap/pursuit-golden-human-review-batch-02.md`.

## Status And Boundary

This is the first domain-review work packet for the Korea data-center Golden
Dataset. The proposal itself remains
`AI_ASSISTED_PROPOSED_DECISIONS_NOT_HUMAN_ADJUDICATION`, with its approval
fields intentionally blank so its canonical hash remains the exact object that
was reviewed. The user's explicit `APPROVE_AS_WRITTEN` assertion has now been
materialized separately.

- Reviewer assertion: `Jang tae ho`
- Review receipt: `golden-batch01-jang-tae-ho-20260726t034810z-101802f83365`
- First system record after explicit approval: `2026-07-26T03:48:10.000Z`
- Materialized scope: 10 projects / 30 capabilities / 10 pairs / 1 revision
- Dataset state: `PARTIALLY_ADJUDICATED`
- Golden readiness: `false`

The timestamp is not represented as the chat server's exact message-receipt
time. Reviewer identity is an unauthenticated repository assertion, not an
identity-verification result.

## Generate And Pin The Packet

Run:

```bash
npm run prepare:golden-review-batch
```

Review this generated artifact:

```text
tmp/codex/pursuit-golden-human-review-batch-01.json
```

Generate and review the fully written AI-assisted proposal separately:

```bash
npm run prepare:golden-review-proposal
```

```text
docs/roadmap/pursuit-golden-human-review-batch-01-proposal.md
tmp/codex/pursuit-golden-human-review-batch-01-proposal.json
```

The proposal is deliberately not modified or treated as the human adjudication
file. The approved `suggestedAdjudication` records were exact-matched against
the pinned proposal and copied through a fail-closed approval materializer.

Before reviewing, confirm that `datasetCanonicalSha256` matches the current
Golden Dataset audit. If source candidates change during review, regenerate
the packet and restart from the new hash instead of carrying decisions across
unreviewed source changes.

Batch 01 contains:

- 10 project review items;
- all 30 capability review items;
- all 10 requirement/capability pair review items; and
- the IEC 62271-200:2021 → IEC 62271-200:2011 supersession edge.

The deterministic project selection is:

1. `stt_seoul1`
2. `digitaledge_sel2`
3. `skaws_ulsan_aidc`
4. `lguplus_paju_aidc`
5. `digitaledge_sel5`
6. `equinix_sl2x`
7. `naver_gak_chuncheon`
8. `naver_gak_sejong`
9. `digitalrealty_icn10`
10. `ktcloud_gasan_aidc`

## Human Review Procedure

For each project, a domain reviewer must inspect the included source URL,
locator, excerpt, date, limitations, and any eligible specification document.
The reviewer then supplies all of the following from their own judgment:

1. `reviewAuthority: HUMAN_DOMAIN_REVIEW`, a traceable receipt, and review
   timestamp at or after the packet's `evaluationAsOf`;
2. confirmed identity and current lifecycle stage;
3. applicable project specification documents, if any;
4. fit for both `medium_voltage_switchgear` and `transformer`;
5. explicit blocker evidence;
6. specification influence-window state and rationale; and
7. final `PURSUE`, `HOLD`, or `NO_BID` decision.

If no applicable public project specification exists, both product families
must remain `INSUFFICIENT_EVIDENCE`, blockers must be non-empty, and the final
decision cannot be `PURSUE`.

For every capability, pair, and revision item, the reviewer must bind the
provided exact source spans, choose an allowed label or relationship state,
and record bounded reason codes. A facility utility-feed voltage is not by
itself a product procurement requirement. The STT Seoul 1 and SEL2 pair items
must therefore be checked against the missing single-line diagram,
transformation boundary, and equipment package before any `MATCH` decision.

## Recorded Human Work

The generated packet is not authoritative and must not be treated as an
adjudication file. The approved records are now in:

```text
knowledge/golden-dataset/datacenter-kr-v0/human-adjudications.json
```

The separate approval receipt is in:

```text
tmp/codex/pursuit-golden-human-review-batch-01-approval-receipt-non-production.json
```

Validate both the adjudications and current readiness with:

```bash
npm run check:golden-dataset
```

The gate validates exact candidate references, source spans, proposal binding,
and receipt hashes. It does not authenticate reviewer identity; receipts are
repository traceability assertions.

## Known Readiness Constraint

Completing this 10-project batch did not produce `goldenReady:true`. Capability,
pair, and revision coverage is complete for the current candidates, but five
of 15 projects remain unadjudicated and the candidate set contains only three
lifecycle stage values while readiness requires five. Additional real project
evidence is required to close stage diversity; stages must not be invented.
