# PR #207 Real Evidence Pilot Decision

## Decision

`INCOMPLETE` — `NO_MERGE_INPUT_INCOMPLETE`

Architecture signal: `BOUNDED_NON_CANONICAL_REVIEW_PATH_APPROVED_SAFE_CANDIDATE_POPULATION_STILL_EMPTY`.

PR #207 was evaluated at `c6a5469338999097acd5de7c5a12c827d27d4540` against base `9d144fbe6309ce363f9dad8d50ffa713d24af683`. It remains Open, Draft, mergeable, unmerged, and green at evaluation time.

## Actual bounded inputs

The existing source ledger records 11 publisher-domain-associated files evaluated, eight admitted by bounded machine intake, and three refused before intake. The current ignored inbox contains the eight normalized bundles: four switchgear and four transformer, with four Korean and four English records.

“Machine admitted” means the manifest, hash, schema, size, scope, normalized-page, and safety checks passed. The historical machine classification remains `PUBLISHER_DOMAIN_ASSOCIATED_UNREVIEWED`; it is not rewritten by a later human decision.

The owner then posted the canonical SHA-bound [`PR207_DOCUMENT_PILOT_APPROVAL_V1`](https://github.com/dooosp/b2b-lead-agent/pull/207#issuecomment-5014019753). It binds the exact PR head, eight-document tuple fingerprint, manifest, and ignored decision-file SHA. For all eight rows it records owner-attested official source, current revision, technical scope, bounded excerpts approved for internal repository review, and no binary commit. It also selects `APPROVE_BOUNDED_NON_CANONICAL_REVIEW_PATH`. The approval does **not** separately decide original-source fidelity, full-page redistribution, customer use, automatic `VERIFIED`/`ALLOWED`, production, or merge. The ignored file is treated only as the SHA-bound transcription; the GitHub comment is the approval source.

| Measure | Result |
| --- | ---: |
| Source files evaluated / machine-admitted / refused | 11 / 8 / 3 |
| Current normalized bundles | 8 |
| Switchgear / transformer bundles | 4 / 4 |
| Korean / English bundles | 4 / 4 |
| Owner-bounded document decision rows | 8 / 8 |
| Original-source fidelity decisions | 0 / 8 |
| Full-page redistribution decisions | 0 / 8 |
| Human candidate decisions | 0 |
| Approved for repository review | 0 / 25 required |
| Approved switchgear / transformer candidates | 0 / 10 required each |

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
| Historical machine source classification | `UNREVIEWED` |
| Owner-bounded document decisions | 8 / 8 |

This is correct fail-closed behavior and an actionable evidence-architecture signal. It is not a usability result, a human rejection count, a precision measurement, or evidence that the remaining normalized content has been exhaustively represented.

The default document audit also passes 35 synthetic scenarios, but its fixed audit clock is `2026-07-17T23:59:59.999Z`, before the real normalized extraction time `2026-07-18T13:00:48.000Z`. It therefore reports the optional real population as `PRESENT_REJECTED` with `FUTURE_DOCUMENT_DATE`. That is a deliberate fail-closed diagnostic and must not be cited as the current real-input count.

Read-only security and method review found two additional blockers. The real-intake server/UI transports and renders complete normalized page text even though the human approval is limited to bounded excerpts for internal repository review. The UI was not launched in this refresh and must remain blocked until that path is removed or separately rights-approved. Also, the current review request and patch output cannot reconstruct all rejected/deferred decisions, duration, usefulness, precision, or patch-suitability denominators.

## Why this remains incomplete

There are no safe candidates to present for human decisions. The owner-bounded document and architecture decisions are recorded, but original-source fidelity, full-page UI rights, review-evidence retention, and the safe candidate population remain unresolved. The MERGE gate requires at least 25 candidates actually approved for repository review and at least 10 approved per product family; rejected or deferred reviews do not satisfy those thresholds. No repository-reviewed canonical claim, `VERIFIED` state, or customer-use permission was created.

The owner selected a bounded non-canonical review path without weakening fail-closed behavior. Under the current head, the two mapped rows still abstain for compound-variant and maximum-operator semantics, so there is no safe candidate population. This proves current insufficiency but not universal prevalence.

The Goal permits PR #207 fixes only when Track B is `REVISE`. Missing human decisions make the track `INCOMPLETE`; therefore this refresh records the evidence and changes no PR #207 code or safety boundary.

## Change-authority disposition

The evaluated PR head contains two product-code fixes (`cfa753591f06584c7091bbc122844766b33cbb01`, `9ef1f94fed500a0fed3d478eb2bb0710baecb861`) and the variant-table experimental implementation (`c6a5469338999097acd5de7c5a12c827d27d4540`) committed after the cross-PR decision record had classified Track B `INCOMPLETE`. On 2026-07-19 the user explicitly instructed `네 커밋 모두 유지 승인`, authorizing all three commits' retention as a documented exception. The exception resolves retention authority only: it does not change Track B from `INCOMPLETE`, approve another fix, establish document validity or rights, mark the PR Ready, or authorize merge, Tender Matrix work, or production action. No PR history was rewritten.

## Exact next inputs

1. A qualified human must separately decide original-source fidelity for each of the eight normalized bundles.
2. A rights/security owner must keep the real-intake UI blocked until complete page-text transport is removed or explicitly rights-approved.
3. A validation-method owner must authorize a review-evidence retention correction before the required human metrics can be reconstructed.
4. A safe candidate population must be supplied under the approved bounded non-canonical path without weakening the current abstentions.
5. Qualified reviewers must then review enough candidates to approve at least 25 for repository review, including at least 10 approved candidates per product family, before any MERGE claim.

Until then, do not merge PR #207, weaken private-data guards or abstentions, expand the bounded owner decisions into missing fidelity/full-page/customer-use claims, export a canonical patch, or start the Tender Matrix.

This artifact is `NOT_PRODUCTION_EVIDENCE`; `productionReady:false`; `productionReviewerWorkflowReady:false`; Issue #165 remains `HOLD`.
