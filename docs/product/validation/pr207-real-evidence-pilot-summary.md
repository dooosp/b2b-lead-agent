# PR #207 Real Evidence Pilot Decision

## Decision

`INCOMPLETE` — `NO_MERGE_INPUT_INCOMPLETE`

Architecture signal: `PIVOT_REQUIRED_FOR_VARIANT_AWARE_TABLE_EVIDENCE_BEFORE_REPEAT`.

PR #207 was evaluated at `c6a5469338999097acd5de7c5a12c827d27d4540` against base `9d144fbe6309ce363f9dad8d50ffa713d24af683`. It remains Open, Draft, mergeable, unmerged, and green at evaluation time.

## Actual bounded inputs

The existing source ledger records 11 publisher-domain-associated files evaluated, eight admitted by bounded machine intake, and three refused before intake. The current ignored inbox contains the eight normalized bundles: four switchgear and four transformer, with four Korean and four English records.

“Machine admitted” means the manifest, hash, schema, size, scope, normalized-page, and safety checks passed. Every bundle remains `PUBLISHER_DOMAIN_ASSOCIATED_UNREVIEWED`. No human has approved authenticity, latest revision, original-source fidelity, technical applicability, or redistribution/use rights.

| Measure | Result |
| --- | ---: |
| Source files evaluated / machine-admitted / refused | 11 / 8 / 3 |
| Current normalized bundles | 8 |
| Switchgear / transformer bundles | 4 / 4 |
| Korean / English bundles | 4 / 4 |
| Human validity/use decisions | 0 / 8 |
| Human candidate decisions | 0 / 25 required |

## Current variant-table result

The explicit `2026-07-19` run loaded eight bundles and two structured rows. It produced zero proposals and two safe abstentions:

- one compound product-variant header cannot be collapsed into a single scalar proposition;
- one maximum operator is not represented by the current proposition model.

| Measure | Result |
| --- | ---: |
| Structured tables / rows | 2 / 2 |
| Safe proposals | 0 |
| Abstentions | 2 |
| Gate | `NO_SAFE_PROPOSITION` |
| Canonical patch export | blocked |
| Source authenticity | `UNREVIEWED` |

This is correct fail-closed behavior and an actionable evidence-architecture signal. It is not a usability result, a human rejection count, a precision measurement, or evidence that the remaining normalized content has been exhaustively represented.

The default document audit also passes 35 synthetic scenarios, but its fixed audit clock is `2026-07-17T23:59:59.999Z`, before the real normalized extraction time `2026-07-18T13:00:48.000Z`. It therefore reports the optional real population as `PRESENT_REJECTED` with `FUTURE_DOCUMENT_DATE`. That is a deliberate fail-closed diagnostic and must not be cited as the current real-input count.

Read-only security and method review found two additional blockers. The real-intake server/UI transports and renders complete normalized page text even when the declared redistribution status permits only metadata and bounded excerpts. The UI was not launched in this refresh and must remain blocked until that path is removed or rights-approved. Also, the current review request and patch output cannot reconstruct all rejected/deferred/authenticity decisions, duration, usefulness, precision, or patch-suitability denominators.

## Why this remains incomplete

There are no safe candidates to present for the required 25 human decisions, and all eight document-level authenticity/currentness/fidelity/use judgments remain missing. Machine determinism does not establish officiality. No repository-reviewed canonical claim, `VERIFIED` state, or customer-use permission was created.

The bounded architecture signal is to decide whether to represent variants, semantic operators such as maximum, units, conditions, footnotes, and table row/header relationships before repeating candidate review. Only two rows were mapped, so this result proves current insufficiency but not universal prevalence.

The Goal permits PR #207 fixes only when Track B is `REVISE`. Missing human decisions make the track `INCOMPLETE`; therefore this refresh records the evidence and changes no PR #207 code or safety boundary.

## Exact next inputs

1. A qualified human must record authenticity, revision-currentness, original-source-fidelity, and redistribution/use decisions for each of the eight normalized bundles.
2. An evidence-architecture owner must make a bounded go/no-go decision on variant-aware table semantics.
3. A rights/security owner must keep the real-intake UI blocked until complete page-text transport is removed or explicitly rights-approved.
4. A validation-method owner must authorize a review-evidence retention correction before the required human metrics can be reconstructed.
5. If a safe candidate population is later produced, qualified reviewers must complete at least 25 structured candidate decisions, including at least 10 for each product family, before any MERGE claim.

Until then, do not merge PR #207, weaken private-data guards, call these documents official/current, export a canonical patch, or start the Tender Matrix.

This artifact is `NOT_PRODUCTION_EVIDENCE`; `productionReady:false`; `productionReviewerWorkflowReady:false`; Issue #165 remains `HOLD`.
