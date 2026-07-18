# PR #207 Real Evidence Pilot Decision

## Decision

`INCOMPLETE`

Architecture signal: `PIVOT_REQUIRED_FOR_VARIANT_AWARE_TABLE_EVIDENCE_BEFORE_REPEAT`.

PR #207 was evaluated from `1206b8979b1ee1d1b2e0089de20fdcac2a005799` and received two bounded-pilot-backed P1 fixes at `cfa753591f06584c7091bbc122844766b33cbb01` and `9ef1f94fed500a0fed3d478eb2bb0710baecb861`. Head `0b0aff64aad36743c2cd1ccb7b5c9b2ee57c7718` adds the matching source-provenance documentation. It remains Draft and unmerged.

This report is a separate cross-PR evaluation artifact on `codex/evidence-to-decision-pilot-20260718`; it is intentionally not stored in the evaluated PR #207 head. `updatedHeadSha` identifies the target code state that was executed, not a claim that the target commit contains this report.

## Actual inputs

Eleven files associated with publisher-domain URLs were evaluated. Eight passed PR #207's manifest, hash, scope, size, normalized-page, and safety checks. The association comes from bounded pilot metadata and is not a verified acquisition-provenance claim. This is machine intake acceptance only; it is not human approval of authenticity, revision currentness, technical applicability, or redistribution/use rights.

The `11 / 8 / 3` count is reproduced by the bounded ledger and `tmp/codex/pr207-real-evidence-pilot-run-non-production.json`. The committed builder and the ignored `evidence-inbox/` intentionally reconstruct only the eight accepted normalized bundles; refused source binaries are not copied into the inbox or Git. The machine run checks the two oversized files by no-follow file metadata without reading their bodies, and it checks the bounded language-mismatch file from an immutable private snapshot.

| Measure | Result |
| --- | ---: |
| Documents evaluated / machine-accepted / refused | 11 / 8 / 3 |
| Accepted switchgear documents | 4 / 4 required |
| Accepted transformer documents | 4 / 4 required |
| Accepted Korean / English documents | 4 / 4 |
| Manifest-bound document validation | 8 passed / 0 failed |
| Refused for 25 MB source cap | 2 |
| Refused for metadata/body language mismatch | 1 |
| Human authenticity/currentness/use decisions | 0 |

The complete bounded document ledger is `docs/product/validation/pr207-real-evidence-input-ledger.json`. Source binaries and full documents remain outside Git.

## Candidate result

The pre-fix extractor emitted two candidates, both from the English Trihal catalog:

- `50 Hz or 60 Hz` became only `50 Hz`;
- phase-to-phase and phase-to-neutral secondary voltages became only the first scalar without its dimensional condition.

These are real P1 precision failures. Commit `cfa753591f06584c7091bbc122844766b33cbb01` now refuses a scalar numeric candidate unless the quote contains exactly one compatible quantity. It preserves extraction of distinct quantities with different unit kinds.

| Measure | Before fix | After fix | Gate |
| --- | ---: | ---: | ---: |
| Suggested candidates | 2 | 0 | n/a |
| Approved for repository review | 0 | 0 | at least 25 |
| Approved switchgear / transformer | 0 / 0 | 0 / 0 | at least 10 / 10 |
| Automatic `VERIFIED` | 0 | 0 | 0 |
| Automatic customer-use `ALLOWED` | 0 | 0 | 0 |

The two suppressed suggestions were not reviewed by a human and are not counted as human rejections or precision observations. Quote/page accuracy, reviewed-suggestion precision, review time, conflict/supersession recall, patch determinism, and patch suitability remain unavailable.

The two historical suppressed candidate/document IDs belong to the pre-neutral-source-class run at `cfa753591f06584c7091bbc122844766b33cbb01`. The current ledger and zero-candidate machine run use the neutral source-class document-ID namespace at `9ef1f94fed500a0fed3d478eb2bb0710baecb861`.

## Why this is not MERGE or REVISE

The document-count, family, and language thresholds are satisfied at the machine-intake layer. The decision is still `INCOMPLETE` because there are no human candidate decisions, every document-level authenticity/currentness/use judgment remains `UNREVIEWED`, and there is no safe post-fix candidate population.

Separately, the Codex pilot observed at least six accepted catalogs using multi-column tables whose model, row, header, footnote, and condition associations are not represented as structured variant-aware evidence. Two transformer tap-voltage rows also collide with the private-data safety pattern. This observation is outside PR #207's human review protocol and supplies the pilot's table-architecture `PIVOT` signal; loosening the safety guard or taking the first number would be unsafe.

## Fix and validation

PR #207 has the evidence-backed P1 fix for partial multi-quantity scalar candidates and now uses a neutral `PUBLISHER_DOMAIN_ASSOCIATED_UNREVIEWED` source class for this pilot instead of asserting official acquisition provenance. Candidate-focused tests pass 8 / 8, the changed bundle/candidate/patch group passes 26 / 26, and the complete Workbench suite passes 105 / 105 when the intentional ignored real inbox is temporarily isolated from the synthetic `BLOCKED_INPUT_MISSING` assertion. The same real inbox loads 8 / 8 documents and emits 0 post-fix candidates with zero authority leakage.

## Next gate

Do not merge PR #207 and do not begin a 25-candidate human review from this extractor. A human owner must first decide whether to pursue a bounded variant-aware table evidence architecture. Human per-document authenticity, currentness, and redistribution/use decisions are still required before any later MERGE claim.

This result is `NOT_PRODUCTION_EVIDENCE`; `productionReady:false`; Issue #165 remains `HOLD`.
