# Pursuit Golden Dataset Human Review Batch 02

## Status And Scope

Batch 02 was approved as written through the supplied `Jang tae ho` reviewer
assertion and materialized by the guarded approval command. Its exact scope is:

- 7 project decisions;
- 0 capability decisions;
- 0 requirement/capability-pair decisions; and
- 0 revision decisions.

The complete Batch 01 capability, pair, revision, and ten-project records are
hash-pinned prior state. Batch 02 does not reopen or duplicate them.

## Pinned Review Inputs

The immutable pre-approval inputs were generated with:

```bash
npm run prepare:golden-review-batch-02
npm run prepare:golden-review-proposal-02
```

Review:

```text
tmp/codex/pursuit-golden-human-review-batch-02.json
tmp/codex/pursuit-golden-human-review-batch-02-proposal.json
docs/roadmap/pursuit-golden-human-review-batch-02-proposal.md
```

The generated Markdown contains the pre-adjudication dataset,
prior-adjudication, blank-batch, and proposal hashes. Its human authority
fields intentionally remain blank: the proposal is an immutable review input,
not the approval record. Any candidate or decision correction requires a new
proposal and a new human review against regenerated hashes.

Current pinned values:

- dataset: `53939a9ab41c6d85e0b1a9175d2471cf954fc698fb5847ff6d7d2789f3e2d854`
- prior adjudications: `24f872c06f9fd633acc18f799c4ff73a7df047058ea4b78a9a0f02f42bdd672b`
- blank Batch 02: `b682271fc3fdc118911089a4dc9345583d323780f7b8082d45cec74dbf745635`
- Batch 02 proposal: `72500e3c4a753da40da3ddfa4a77ee99fa0db78bdb7b64b33af5beef4e28e7d1`

## Materialized Approval

The guarded materializer wrote only the complete seven-project additions and
the separate approval receipt:

```text
knowledge/golden-dataset/datacenter-kr-v1/human-adjudication-additions.json
tmp/codex/pursuit-golden-human-review-batch-02-approval-receipt-non-production.json
```

Recorded evidence:

- reviewer assertion: `Jang tae ho`;
- disposition: `APPROVE_AS_WRITTEN`;
- system receipt: `golden-batch02-20260726t045706252z-72500e3c4a75-4876e32ee2b14721995a82eb9952f9b7`;
- first materialization time: `2026-07-26T04:57:06.252Z`;
- additions hash: `9fcdb4c0eef8b103b03480dd2787502b6d0f709bc8c138ed0c588592af2f7460`;
- composed-adjudications hash: `3ec5eedb5580e78647b9368a79ba6edbccb5506a2448ab2bcd5d900981bac6f1`;
- post-adjudication dataset hash: `203adea096eb4187fd9f09ce945a49eaf957e9d95a23bbbd84dceb3f3de55301`;
  and
- receipt canonical hash: `fa2ddb19f204441845a017ae2fe12dd79151050ec1c366cfe5ca8e0916d98ce3`.

The audited post-state is `HUMAN_CONFIRMED` and `goldenReady:true`, with all 17
projects, 30 capability claims, 10 requirement/capability pairs, one revision
link, and five lifecycle stages human-confirmed. `productionReady` remains
`false`.

## Project Set

The approved and materialized Batch 02 project set is:

1. `empyrion_kr1_gangnam` — `OPERATION`
2. `kakao_data_center_ansan` — `OPERATION`
3. `lguplus_pyeongchon2` — `OPERATION`
4. `nhn_gwangju_national_ai` — `OPERATION`
5. `samsungsds_dongtan` — `OPERATION`
6. `ulsan_underwater_data_center_model` — `DESIGN`
7. `wanju_ai_data_center` — `FEASIBILITY`

For every project, the AI-assisted proposal recommended confirmed identity,
the evidence-bound candidate stage, no applied specification document,
`INSUFFICIENT_EVIDENCE` for both product families, an `UNKNOWN` specification
window, explicit blockers, and `HOLD`. The supplied reviewer assertion adopted
all seven project decisions as written.

## Review Basis And Result

The supplied attestation states that the reviewer directly assessed the linked
sources, evidence, limitations, identity, lifecycle stage, applied
specifications, both product-family fits, blockers, influence window, and final
decision. The materialized review basis includes:

- Wanju's MOU, site, capacity, and grid review do not prove that detailed
  design or construction began.
- Ulsan's design work concerns an R&D standard model and testbed, not a
  commercial equipment package.
- The five operating-facility releases do not establish a current retrofit,
  replacement, tender, or supplier-qualification window.
- Kakao Ansan and Digital Edge SEL5 share the Ansan locality but are distinct
  facility candidates; that semantic distinction was explicitly presented for
  review.

The user sent the exact hash-bound approval block printed in the generated
proposal. The guarded command then created the unique receipt and bound the
first post-approval system timestamp. Replay is refused now that the additions
and receipt exist. Any correction requires a new, explicitly reviewed proposal
rather than mutation of these approval inputs or Batch 01.

## Non-Claims

- Preparation is not human approval.
- A repository receipt is not authenticated reviewer identity.
- Candidate stages are dated source observations, not live procurement status.
- Press releases are not applied electrical specifications.
- Offline Golden readiness is not production readiness or permission to act.
