# PR #207 Candidate Review v2 / Bounded Retention Method Decision Packet

This packet fixes the method for a future local-only Candidate Review v2 round
after the eight-document human fidelity review is complete. It is documentation
only. It does not create candidates, record human decisions, change either
Draft PR, authorize a merge, promote a canonical claim, start a Tender Matrix,
or authorize production proof.

## 1. Document Status

- Document status: `DECISION_READY_DOCS_ONLY`.
- Repository: `dooosp/b2b-lead-agent`.
- Evaluated default-branch baseline:
  `d7a45257b9aa48d2975db9852a993d79f70972bf`.
- Evaluated control artifact commit:
  `016be9efb9d194859c691d5fd9245ce3dae844a0`.
- Evaluated on: `2026-07-22`.
- Revision baseline observed on: `2026-07-25`.
- Controlling revision request:
  [`PR208_METHOD_REVIEW_V1`](https://github.com/dooosp/b2b-lead-agent/pull/208#issuecomment-5077027554),
  decision `REQUEST_CHANGES`, reviewed PR #208 head
  `dd38805e96d33a82803e6a6926c74ea2450ef41b`.
- Non-authoritative pre-revision input observation:
  `docs/roadmap/pr207-candidate-review-v2-packet-revalidation-20260725.json`.
  It records inputs observed before this revision. It is not a receipt, not an
  independent review, not a final `PASS`, and does not bind the revised packet
  commit.
- Required post-commit review receipt:
  `docs/roadmap/pr207-candidate-review-v2-packet-post-commit-review-receipt-20260725.json`.
  Commit A references this path but must not contain it. The file may be added
  only by Commit B after Commit A exists and the independent reviews described
  in Section 16 are complete.
- Selected method:
  `IGNORE_VERIFIED_LOCAL_LEDGER_PLUS_POLICY_BOUNDED_HASH_AGGREGATE`.
- Runtime, schema, API, UI, evaluator, and validator changes: none.
- Candidate Review v2 execution: `HOLD_PENDING_FIDELITY_AND_IMPLEMENTATION`.
- PR #206 merge: `HOLD`.
- PR #207 merge: `HOLD`.
- Production readiness: `false`.
- Production reviewer workflow readiness: `false`.
- Issue #165: `HOLD`.

```yaml
pr207_candidate_review_v2_method:
  document_status: DECISION_READY_DOCS_ONLY
  scope: DOCS_ONLY_METHOD_AND_RETENTION_CONTRACT
  selected_retention_method: IGNORE_VERIFIED_LOCAL_LEDGER_PLUS_POLICY_BOUNDED_HASH_AGGREGATE
  current_master_baseline: d7a45257b9aa48d2975db9852a993d79f70972bf
  pre_revision_observation_authoritative: false
  post_commit_review_receipt: PENDING_COMMIT_B
  implementation_approved: false
  human_review_executed: false
  candidate_population_created: false
  candidate_review_execution: HOLD_PENDING_FIDELITY_AND_IMPLEMENTATION
  repository_review_required: true
  automatic_verification: false
  customer_use_allowed: false
  production_ready: false
  production_reviewer_workflow_ready: false
  issue_165: HOLD
```

## 2. Controlling Evidence and Frozen Inputs

The packet is bound to the following observed state. A later implementation
must re-read live GitHub state and fail closed on any unexplained drift.

| Surface | Frozen value | Meaning |
| --- | --- | --- |
| Current `master` baseline | `d7a45257b9aa48d2975db9852a993d79f70972bf` | Post-PR #209 baseline for this packet revision. It is not the historical base of either Draft PR. |
| PR #206 intake/tooling head | `b5570e182c8ab6515c0f09272d22d7121518f134` | Open, Draft, unmerged. This later commit supplies only the ignored R1-R5 intake preparation/validation tooling; it is not the human-session runtime root. |
| PR #206 frozen runtime root | `8098f66c6fb7e64464297c0ee70d25f49756135d` | The only permitted Workbench code/runtime root for R1-R5 human validation sessions. |
| Frozen runtime `package-lock.json` | `a14f41c200c480e20b1f3e3ef1ccedf48155e274888b4716aeb2e1b1ba4d97cc` | SHA-256 verified from the tree at `8098f66...`; equality at `b5570e...` does not move runtime authority. |
| Frozen runtime Workbench fixture | `08ec7591cfd89d8af33a2ca613df8762c2a852d8946f36379dc0aaabfc365d41` | SHA-256 verified from the tree at `8098f66...`; equality at `b5570e...` does not move runtime authority. |
| Frozen runtime review guide | `3000973dab91408d6e360363872e43398228d39a88d010d21d6c5803d28b366a` | SHA-256 verified from the tree at `8098f66...`; equality at `b5570e...` does not move runtime authority. |
| PR #207 head | `c6a5469338999097acd5de7c5a12c827d27d4540` | Open, Draft, unmerged at packet preparation. Candidate Review v2 must not mutate this head. |
| PR #207 historical Draft base | `9d144fbe6309ce363f9dad8d50ffa713d24af683` | Frozen base of the still-unmerged Draft; it is not current `master`. |
| Real-intake manifest | `evidence-inbox/manifest.json`, `0e62b5b258a90395b4f7a95bf2e5288e0781d768aa0990b07c0916a67c16c953` | Eight manifest-bound normalized inputs. It does not prove fidelity or truth. |
| Completed document-decision file | `tmp/evidence-claim-workbench/human-approval/pr207-document-decisions.json`, `2748e31856100d2f00259f32b1e351d6b7fe4386884e593ba1dc7997c6cab8fb` | Eight owner decisions for officiality, currentness, technical scope, bounded internal excerpt use, and binary non-commit handling. |
| Blank fidelity template | `tmp/evidence-claim-workbench/human-approval/pr207-document-fidelity-decisions.json`, `e5e6aa1d7c73ab939d88e8c907107c8eed93ff698524efa5aefc4bdd6e14ae1e` | Eight blank rows and zero human fidelity decisions. It is a starting template, not evidence. |
| Fidelity operator checklist | `tmp/evidence-claim-workbench/human-approval/pr207-document-fidelity-operator-checklist.md`, `89a8cf7f3923c85ba78418e8e3fe3337da610173c8d5d5c989d8413004de6813` | Local metadata-only checklist; no completed human decision is inferred. |
| Blank candidate template | `tmp/evidence-claim-workbench/human-approval/pr207-candidate-decisions.json`, `10460a8fb0202af984ea98e3ca5b34fea3822a4531ed2ed1221e35d5acaa3051` | Local PR #207 worktree file. Empty-only v1 candidate intake; it cannot accept a real candidate population. |
| Variant evaluation digest | `a73449493dc3cb07b2c28a41446d1bea36eba1f09acf16a6eb092cda5495dfdb` | Canonical digest recorded in the current control run: zero propositions and two safe abstentions. |
| Variant redacted-summary digest | `8c3ceefd6e74b82f87d5e488ecb31a3c3496c6ade16518451c6151f894f6971e` | Canonical digest recorded in the current control run; redacted observation only, not a candidate review. |

The PR #207 owner document decision is recorded in
[`PR207_DOCUMENT_PILOT_APPROVAL_V1`](https://github.com/dooosp/b2b-lead-agent/pull/207#issuecomment-5014019753).
The controlling rights and retention decision is
[`PR207_PAGE_REVIEW_RIGHTS_RETENTION_POLICY_V1`](https://github.com/dooosp/b2b-lead-agent/pull/207#issuecomment-5031954760).
The latter is bound to the PR #207 head and completed document-decision hash,
and expires or requires review at `2026-08-21T23:59:59Z`.

The current cross-PR state is recorded at control commit `016be9e` in the
[`next-gate`](https://github.com/dooosp/b2b-lead-agent/blob/016be9efb9d194859c691d5fd9245ce3dae844a0/docs/product/validation/evidence-to-decision-next-gate.json),
[`PR #207 decision`](https://github.com/dooosp/b2b-lead-agent/blob/016be9efb9d194859c691d5fd9245ce3dae844a0/docs/product/validation/pr207-real-evidence-pilot-decision.json),
and
[`PR #207 summary`](https://github.com/dooosp/b2b-lead-agent/blob/016be9efb9d194859c691d5fd9245ce3dae844a0/docs/product/validation/pr207-real-evidence-pilot-summary.md).
Those artifacts remain separate from both PR heads.

Completing an ignored fidelity or candidate-review input will intentionally
produce a new completed-file SHA-256. That expected human-input hash change does
not permit any change to the frozen PR heads, source manifest, normalized source
files, document decisions, or PR #206 runtime artifacts. The future completed
hash must be separately recorded and bound by the Candidate Review v2 round.

PR #206 has two distinct roots and they must never be collapsed. Before and
immediately after each R1-R5 session, the custodian records the output of `git
rev-parse --show-toplevel`, proves the command ran from that canonical root,
proves `git rev-parse HEAD` is exactly
`8098f66c6fb7e64464297c0ee70d25f49756135d`, proves `git status
--porcelain=v1 --untracked-files=all` is empty, and proves the three runtime
SHA-256 values above match files read from that same root. Dependencies are
installed there with exact command `npm ci`; the only launch command is exact
command `npm run demo:pursuit-workbench`, run from that root with no additional
arguments, and only its printed loopback URL may be opened. A branch name,
ancestry from `8098f66...`, or equal hashes at another head is insufficient.

The ignored R1-R5 intake files are prepared and validated only in a separate
canonical worktree whose `git rev-parse HEAD` is exactly
`b5570e182c8ab6515c0f09272d22d7121518f134`, whose `git rev-parse
--show-toplevel` equals the recorded tooling root and whose same porcelain
status check is empty before preparation and after validation. Its tracked
prepare/validate scripts and package lock are read from that head, and every
ignored intake path must pass `git check-ignore`. Only `npm run
prepare:pursuit-workbench-human-validation` and `npm run
validate:pursuit-workbench-human-validation` may run there. The tooling root
must not launch the Workbench, and the runtime root must not prepare, validate,
or retain intake. Any head, root, status, artifact-hash, command, or loopback
binding mismatch keeps PR #206 human evidence `INCOMPLETE`.

## 3. Proven Gap and Method Decision

The current Workbench keeps browser review state in memory and clears it on
reload. Its review patch intentionally retains approved candidates and the
relationship closure needed for those approvals; it does not retain every
standalone rejection, deferral, authenticity flag, duration, usefulness score,
or patch-suitability decision. Therefore it cannot reconstruct the real-review
precision denominator or the required human metrics.

The current `pr207-candidate-decisions-v1` intake also deliberately accepts only
`candidateCount: 0` and `candidates: []`. A non-empty Candidate Review v2 schema
and validator are future implementation work.

This packet selects a separate bounded review ledger because neither page
memory nor the approval-focused patch is a truthful retention record.

| Option | Description | Decision |
| --- | --- | --- |
| R0 | Page-memory review only; reload clears all state. | Rejected. Metrics and decisions cannot be reconstructed. |
| R1 | Use only the canonical review patch as the retained record. | Rejected. Standalone non-approval decisions and human metrics are omitted. |
| R2 | Fixed local structured ledger, proven ignored in its operating worktree, plus tracked policy-bounded hash aggregate. | Selected. It preserves bounded reconstructability without identities, full pages, or source binaries in Git. |
| R3 | Full audit log with identities, free text, complete pages, or source binaries. | Rejected and prohibited for this pilot. |

## 4. Fidelity and Candidate-Population Preconditions

Candidate generation may begin only when all of the following are true:

1. PR #207 remains at the frozen evaluated head, or a later separately approved
   rebind record names the exact new head and proves the relevant artifacts are
   unchanged.
2. The rights/retention policy is active and unexpired.
3. All eight `pr207-document-fidelity-decisions-v2` rows are complete and pass
   the fail-closed validator.
4. Document identity, document number, and revision checks are `MATCH` for every
   document that contributes a candidate.
5. Every candidate anchor is on a page explicitly listed in that document's
   `eligiblePageNumbers`, which the v2 fidelity validator already constrains to
   the document's `candidateBearingPagesChecked`.
6. An `UNSAFE_FOR_CANDIDATE_REVIEW` fidelity row contributes no eligible page.
   For `ACCEPTABLE_WITH_LIMITATIONS`, or whenever a document-level semantic field
   is `NOT_PRESERVED`, `eligiblePageNumbers` remains only a page-level admission;
   it does not prove candidate-specific safety. Both v2 role rows must therefore
   carry the fixed outer-contract acknowledgement
   `LIMITATION_DOES_NOT_AFFECT_CANDIDATE` after checking value, unit, operator,
   variant, condition, footnote, and locator. If that acknowledgement cannot be
   made before population freeze, the proposition remains an abstention. Once
   the candidate is in a frozen population, a missing acknowledgement cannot
   produce approval: it yields `HELD` unless both reviewers independently reach
   a more specific `REJECTED` or `CONFLICTED` outcome.
7. The candidate is losslessly representable by the implemented bounded schema.
   Compound variants, maximum/minimum/range/alternative operators, shared or
   conditional footnotes, and visually ambiguous tables continue to abstain
   until an implementation contract represents them without loss.

Before population selection, the future generator must build the complete
undirected graph over every safely representable candidate using all declared
relationship edges. Each connected component is one indivisible selection
unit, including components that span product families. A candidate with a
missing related candidate, dangling relationship ID, or relationship endpoint
outside the safely representable universe makes that whole component
inadmissible; it must not be selected partially.

The generator must then produce one immutable review population containing
whole relationship components totaling between 30 and 35 unique candidate IDs,
inclusive, with at least 10 candidates from each exact product family:

- `medium_voltage_switchgear`
- `transformer`

This is a safety gate, not a quota license. If the complete safe universe itself
fits the total and family bounds, every component is selected. Otherwise,
before any human review, enumerate component subsets with a deterministic
dynamic-programming search. A subset is feasible only when its whole-component
union has `30 <= N <= 35` and at least 10 candidates from each family. Select
the feasible subset with the greatest `N`; break ties by the lexicographically
smallest ASCII-sorted candidate-ID vector. The component key is its smallest
ASCII candidate ID, and component/member ordering is fixed before the search.

If no whole-component subset satisfies every bound, the round is `INCOMPLETE`
even when an individual-candidate selection could have met the quotas. The
generator must not split a relationship component, drop an inconvenient edge,
weaken abstentions, use an ineligible page, invent evidence, split a compound
value, or relabel a machine abstention as a human rejection. Human outcome,
perceived usefulness, or commercial preference must not influence component
selection.

The population is frozen before the first human decision. Any later addition,
removal, reorder that changes canonical content, or candidate mutation creates
a new population hash and invalidates the entire round. A candidate is counted
once by unique candidate ID, not once per reviewer, document, anchor, or patch.

## 5. Candidate, Page, and Anchor Binding

Candidate Review v2 preserves the existing one-way authority flow:

```text
completed human fidelity decision
  -> eligible normalized page
  -> page-evidence-anchor-v0
  -> evidence-claim-candidate-v0 or separately approved lossless v2 proposition
  -> two independent structured human reviews
  -> bounded review-ledger outcome
  -> repository-review patch suitability decision
  -> separate Claim Registry PR review
```

The population, two role rows, final reconciliation, metrics, and patch-set
manifest belong to a separately versioned outer contract,
`pr207-candidate-review-round-v2`. The current candidate, anchor, decision, and
patch schemas remain unchanged inside that envelope.

Each retained candidate row must bind all of the following:

- evaluated PR number and exact head SHA;
- manifest SHA-256, completed document-decision SHA-256, and completed fidelity-
  decision SHA-256;
- candidate-population SHA-256 and round ID;
- `candidateId`, candidate schema version, the complete canonical
  `evidence-claim-candidate-v0`, and its exact bounded inner
  `candidateSnapshot` used by the review decision;
- exact canonical product-family ID and claim type;
- `documentId`, source-file SHA-256, normalized-content SHA-256, document number,
  revision series, revision ID, and sequence;
- page namespace `NORMALIZED_BUNDLE_PAGE_NUMBER`, extracted page ordinal,
  human-facing page/section locator, page-text SHA-256, and page length;
- `evidenceAnchorId`, normalization version, code-point start/end offsets,
  quote SHA-256, occurrence index/count, and bounded context hashes;
- relationship IDs and related candidate IDs, when present.

The candidate ID continues to hash the normalized semantic payload and anchor.
Each v2 review-row ID additionally hashes the frozen PR head, controlling input
hashes, population hash, candidate ID, reviewer role, structured decision,
duration, and usefulness. A separate final-outcome ID hashes both review-row IDs,
the reconciled outcome, relationship-closure report, and patch-suitability
result. Neither ID may hash a human name, email, employer, account ID, or free-
form note.

A document, source hash, revision, page, locator, page digest, quote, offset,
occurrence, context, candidate semantic, applicability, validity, relationship,
decision, or controlling-input change invalidates the entire frozen round and
every derived patch. The sole head-only exception is the pre-mutation exact
restack-rebind procedure in Section 13: it must prove equivalence and obtain the
owner record against the exact proposed new SHA before the live PR head moves.
Silent re-anchoring or any other decision reuse is forbidden.

## 6. Reviewer Qualifications, Roles, and Access

Candidate Review v2 uses two different qualified humans for every candidate.
Identity remains `NOT_COLLECTED`; fixed role labels are not identities.

### Primary technical reviewer

The primary reviewer must:

- have application-engineering, specification, tender/design-support, or
  technical-sales review competence for the assigned product family;
- be able to read the source language used on the assigned page, without
  unrecorded machine translation standing in for source review;
- verify value, unit, operator, product variant, conditions, limitations,
  footnotes, applicability, and engineering meaning against the authorized
  local source;
- understand that approval means only `APPROVE_FOR_REPOSITORY_REVIEW`.

### Secondary evidence reviewer

The secondary reviewer must:

- be independent from the primary reviewer for that candidate;
- be competent in source identity/revision checks, exact evidence anchoring,
  bounded claim semantics, conflict/supersession closure, and repository review;
- reopen the authorized local source and repeat the review without seeing the
  primary disposition until the secondary disposition is submitted;
- assess the final patch-suitability record after the two decisions are
  reconciled.

### Local review custodian

A local custodian prepares the fixed-path blank files, confirms role separation
and eligibility without retaining identity, freezes hashes, controls the
custodian-only central ledger, seals the two isolated role submissions, produces
the aggregate, and clears expired local review records. The custodian does not
gain authority to decide a candidate merely by operating the files.

The local method records only:

- `PRIMARY_TECHNICAL_REVIEWER` or `SECONDARY_EVIDENCE_REVIEWER`;
- `roleQualificationAttested: true` for each assigned role;
- `roleSeparationAttested: true` at the round level; and
- `limitationSafetyAcknowledgement`, exactly one of
  `NOT_APPLICABLE`, `LIMITATION_DOES_NOT_AFFECT_CANDIDATE`, or
  `NOT_ATTESTED`, with no free text; and
- the existing inner decision values
  `reviewerIdentity: "NOT_COLLECTED"` and
  `reviewerLabel: "repository_reviewer_pending"`.

`NOT_APPLICABLE` is valid only when the controlling fidelity row is not
`ACCEPTABLE_WITH_LIMITATIONS` and every applicable document-level semantic
field is preserved. Otherwise each role row must independently record
`LIMITATION_DOES_NOT_AFFECT_CANDIDATE` before that role can contribute to a
provisional or final approval. `NOT_ATTESTED` is retained when the reviewer
cannot make that acknowledgement; it never supports approval.

The custodian verifies qualifications and that the two people differ during the
local session, but retains only the fixed attestations above. No identity or real
auth/RBAC is claimed. Missing, unknown, duplicated, or ineligible roles; one
human filling both roles; or a missing attestation keeps the candidate and round
at `HOLD`.

Blinding is enforced by filesystem separation, not by reviewer promise. The
custodian freezes one identical candidate/source assignment hash for both roles,
then provisions the three fixed roots in Section 11. The central ledger is
custodian-only. The primary role can read/write only the primary submission
root; the secondary role can read/write only the secondary submission root;
neither role can list, read, infer the status of, or write the other role's root
or the central ledger. The operating environment must prove these access
denials before the first row is shown. A shared account, shared writable
directory, browser memory shared between roles, common submission file, or
visibility of the other disposition is a stop condition.

Each role writes only its own fixed submission file. Submission is an atomic
close-and-rename followed by canonical validation, byte length, SHA-256, and a
read-only seal. The custodian records only the role label, assignment hash,
sealed-file hash, size, and fixed attestations; no OS principal or human
identity enters the ledger. Both role files must be sealed before the custodian
may copy their validated bytes into the central ledger or run reconciliation.
Any post-seal mutation invalidates the round. Only after both seals exist may
the secondary reviewer receive the bounded provisional patch-suitability view;
that view contains neither primary raw decisions nor primary metrics. Only the
custodian may clear finalized local records at the retention close event. No
detailed ledger or role submission may be exported or committed.

## 7. Structured Decisions and Final Outcomes

The inner Workbench vocabulary remains unchanged:

- `APPROVE_FOR_REPOSITORY_REVIEW`
- `REJECT`
- `DEFER_MISSING_CONTEXT`
- `FLAG_CONFLICT`
- `FLAG_SUPERSEDED`
- `FLAG_SOURCE_AUTHENTICITY`

The v2 outer role row first retains the bounded
`limitationSafetyAcknowledgement` envelope field above, then has exactly one of
these mutually exclusive decision forms:

- `INNER_DECISION`, containing one validated existing
  `evidence-claim-review-decision-v0`; or
- `OUTER_HOLD_TERMINOLOGY_GAP`, containing only the fixed outer reason
  `OUTER_V2_TERMINOLOGY_GAP`, with no free text and no fabricated inner decision.

After both role rows are complete, the v2 ledger applies this ordered outcome
function exactly once per unique candidate. The first matching rule wins:

1. A missing, partial, or invalid role row makes the entire round `INCOMPLETE`;
   no candidate final outcome is emitted.
2. An unresolved relationship component yields `CONFLICTED`. When both rows are
   `INNER_DECISION`, any `FLAG_CONFLICT`, incompatible decision classes, an empty
   required reason intersection, or mismatched required relationship IDs also
   yields `CONFLICTED`.
3. Any `OUTER_HOLD_TERMINOLOGY_GAP` row yields `HELD` with the fixed outer reason;
   no canonical inner patch decision is emitted for that candidate.
4. Two `REJECT` decisions yield `REJECTED`.
5. Two matching `DEFER_MISSING_CONTEXT`, `FLAG_SOURCE_AUTHENTICITY`, or closed
   `FLAG_SUPERSEDED` decisions yield `HELD`.
6. Two valid approvals yield a provisional approval. Patch suitability then
   yields final `APPROVED` only when both role rows also carry the exact
   applicable limitation-safety acknowledgement and the patch result is
   `SUITABLE_FOR_REPOSITORY_REVIEW`. A missing applicable acknowledgement or
   either other applicable patch result yields `HELD`.

The resulting four final outcomes are:

| Final outcome | Exact rule | Counted as approved |
| --- | --- | --- |
| `APPROVED` | Both reviewers independently select `APPROVE_FOR_REPOSITORY_REVIEW`; the required evidence/meaning/condition reason codes and exact applicable `limitationSafetyAcknowledgement` are present; every relationship is closed; and the later patch-suitability result is `SUITABLE_FOR_REPOSITORY_REVIEW`. | Yes, once. |
| `REJECTED` | Both reviewers select `REJECT` and share at least one compatible fixed reason code. Their reason sets may otherwise differ. | No. |
| `HELD` | The ordered function reaches a terminology gap; both inner decisions select the same non-approval class (missing context, source authenticity, or closed supersession); or a provisional approval's patch result is incomplete/non-suitable. | No. |
| `CONFLICTED` | Either inner decision selects `FLAG_CONFLICT`, two inner decisions cannot reconcile class/common reasons/required relationships, or relationship closure is unresolved. | No. |

Reconcile the two immutable inner decisions first. For non-approval decisions, the
derived canonical reason set is the ASCII-sorted intersection of the two reason
sets, and relationship IDs must match exactly when required. An empty reason
intersection or relationship mismatch is `CONFLICTED`. For approval, derive only
the fixed required acknowledgement reasons: evidence and structured meaning,
plus conditions exactly when conditions exist. Independently validate the
role-envelope limitation acknowledgement: both rows must be `NOT_APPLICABLE`
when that value is permitted, or both must be
`LIMITATION_DOES_NOT_AFFECT_CANDIDATE` when the source has a limitation or
non-preserved semantic field. Any other pair blocks provisional approval and
yields `HELD` with fixed reason `LIMITATION_SAFETY_NOT_ATTESTED`. Patch
suitability is evaluated only for a provisional approval; it never rewrites a
resolved rejection, hold, or conflict. There is no automatic tiebreaker and no
third-reviewer override in v2. New evidence or corrected structure requires a
new frozen round. A disagreement is not rewritten as a rejection, approval, or
machine false positive.

The final ledger derives exactly one canonical
`evidence-claim-review-decision-v0` per candidate that is needed by a patch. It
uses the fixed `NOT_COLLECTED` / `repository_reviewer_pending` fields and the
canonical reason/relationship result above. Only this one-per-candidate set may
be passed to `createReviewPatch(...)`; the two raw role decisions must never be
passed to it because the current patch contract refuses multiple decisions for
one candidate.

Decision reason handling stays bounded:

- approval requires `EVIDENCE_QUOTE_CONFIRMED` and
  `STRUCTURED_MEANING_CONFIRMED`, plus `CONDITIONS_CONFIRMED` when conditions
  exist;
- conclusively unsupported, marketing-only, duplicate, or internally prohibited
  excerpt use may use `REJECT` with a compatible fixed reason;
- incomplete context or unresolved internal-use rights uses
  `DEFER_MISSING_CONTEXT`;
- unresolved revision/currentness uses `DEFER_MISSING_CONTEXT` with
  `REVISION_UNCLEAR`;
- unresolved source identity or authenticity uses `FLAG_SOURCE_AUTHENTICITY`
  with `SOURCE_AUTHENTICITY_UNCLEAR`;
- materially incompatible overlapping evidence uses `FLAG_CONFLICT` until an
  explicit relationship disposition safely selects or rejects each participant;
- the older member of a proven supersession pair uses `FLAG_SUPERSEDED` and
  links the successor.

No free-form rationale is retained. If the inner vocabulary cannot express the
reason truthfully, the reviewer uses `OUTER_HOLD_TERMINOLOGY_GAP`; the fixed
outer reason is retained and the terminology gap is reported without source text
in a separate docs-only issue.

## 8. Relationship Closure Rules

A candidate cannot be patch-suitable until its entire connected relationship
component has a complete disposition.

The frozen population must contain either every member of a relationship
component or none of them. Reconciliation and patch suitability operate on the
same complete component atomically: no member can be emitted, counted as
approved, or sharded while another member lacks its two sealed role rows and
final disposition. A split, dangling endpoint, omitted member, or component
whose complete dispositions cannot satisfy the rules below makes the round
`INCOMPLETE`; it is not repaired by deleting the relationship.

| Relationship | Promotable closure |
| --- | --- |
| `EXACT_DUPLICATE_EVIDENCE` | At most one candidate is approved; every other member is `REJECT` with `DUPLICATE_CANDIDATE`. |
| `MATERIAL_CONFLICT` | At most one candidate is approved and all other members are explicitly rejected. If evidence cannot justify that selection, the component remains `CONFLICTED`. Two conflict flags do not resolve it. |
| `SUPERSEDES` | The older candidate is `FLAG_SUPERSEDED` with `SUPERSEDED_DOCUMENT` and a link to the successor; the successor is explicitly approved or rejected. |
| `CONDITION_RESOLVED` | Every member is approved or rejected after the differentiating conditions are confirmed. Conditions must remain visible; the favorable value is never selected by default. |

Machine abstentions are outside the candidate population. They are not
relationships, human decisions, false positives, rejections, or approvals.

## 9. Reconstructable Metrics and Thresholds

Candidate Review v2 distinguishes its real human-review metric from the
synthetic evaluator's fixture precision. Synthetic precision remains a separate
machine metric and must not be relabeled as real-review evidence.

For one frozen real-review round:

```text
N = unique candidates in the frozen population (30 <= N <= 35)
A = final APPROVED candidates with suitable patch output
T = provisional technical approvals after two-role and relationship
    reconciliation, before patch-suitability assessment
R = final REJECTED candidates
H = final HELD candidates
C = final CONFLICTED candidates
G = final HELD candidates with OUTER_V2_TERMINOLOGY_GAP
FP = final REJECTED candidates whose canonical reason set contains
     NOT_A_CAPABILITY, MARKETING_LANGUAGE_ONLY, or DUPLICATE_CANDIDATE
PR = final REJECTED candidates whose canonical reason set is policy-only
     COPYRIGHT_OR_USE_RESTRICTED

N = A + R + H + C
R = FP + PR
precisionResolvedCount = T + FP
reviewedSuggestionPrecisionBasisPoints =
  precisionResolvedCount > 0
    ? floor(10_000 * T / precisionResolvedCount)
    : null
populationApprovalRateBasisPoints = floor(10_000 * A / N)
humanRejectedFalsePositiveCount = FP
policyRestrictedRejectCount = PR
unresolvedOrHeldCount = H + C
```

Precision uses only resolved technical/candidate-generation judgments. Its
target is a unique, technically applicable candidate before rights policy and
patch packaging: a provisional technical approval is a true positive, while
rejection for a non-capability, marketing-only suggestion, or duplicate is a
false positive against that target. A policy-only copyright/use rejection is
still a rejection and never a final approval, but it does not decide technical
correctness. A mixed rejection containing any false-positive reason is classified
once as `FP`, not `PR`. Patch-unsuitable or patch-incomplete provisional
approvals remain in `T` for technical precision but cannot enter final `A`.
`HELD` and `CONFLICTED` rows without provisional approval are not asserted to be
ground-truth false positives, so they stay outside the precision denominator and
remain visible in `populationApprovalRateBasisPoints` and
`unresolvedOrHeldCount`. Precision is `null` at a zero denominator. The round is
still `INCOMPLETE` unless all candidates have two complete role decisions and
one final outcome; reporting precision must never hide held or conflicted rows.

The future Candidate Review v2 gate requires all of the following:

- `30 <= N <= 35`;
- `A >= 25`;
- at least 10 approved `medium_voltage_switchgear` candidates;
- at least 10 approved `transformer` candidates;
- `reviewedSuggestionPrecisionBasisPoints >= 8000`;
- final `CONFLICTED` candidates: zero;
- outer terminology-gap candidates: zero;
- every counted approval has patch suitability
  `SUITABLE_FOR_REPOSITORY_REVIEW`;
- automatic `VERIFIED` leakage: zero;
- automatic customer-use `ALLOWED` leakage: zero;
- source-binary/full-page/private/secret leakage: zero; and
- unresolved P0/P1 method or safety findings: zero.

Twenty-five approvals are necessary but not independently sufficient: fixed
false-positive rejections can still take technical precision below 80%, and any
final conflict keeps the round incomplete.

Per-family precision and population approval rate use the same respective
formulas and must be reported, but the frozen hard family gate is the approval
count of at least 10 per family. Candidate IDs, not reviewer rows or patch
appearances, are the counting unit.

Each reviewer-candidate row additionally records:

- `reviewDurationSeconds`: integer `1` through `7200`, measured by a local
  monotonic timer from candidate/source display to submitted disposition; an
  explicit pause/resume control excludes pauses, only the accumulated integer is
  retained, and a timer anomaly or out-of-range value invalidates the row;
- `evidenceTraceabilityUsefulness`: integer `1` through `5`;
- `structuredDecisionUsefulness`: integer `1` through `5`; and
- for the secondary role only, `patchAssessmentUsefulness`: integer `1` through
  `5` after reconciliation.

Each usefulness item uses the same fixed anchors for its named dimension:
`1` blocked a justified result; `2` required major unrepresented recovery;
`3` was sufficient with bounded manual cross-checking; `4` was clear with only
minor friction; and `5` supported direct justification without additional
reconstruction. No combined overall score and no free-text explanation is
retained.

After both submitted rows are reconciled, the secondary reviewer records the
separate final patch-suitability outcome defined below. It is not duplicated in
the primary review row.

For every median, sort numeric observations ascending; use the middle value for
an odd count and the exact arithmetic mean of the two middle values for an even
count. `decisionAgreementCount` counts either two matching terminology-gap outer
rows, or candidates whose two inner decision classes match, whose reason sets can
be reconciled under Section 7, and whose required related-candidate IDs match
exactly. Its denominator is `N` only after all `2N` role rows are complete;
otherwise its rate is `null`. Every non-null rate is
`floor(10_000 * numerator / denominator)` basis points; a zero or incomplete
denominator yields `null`.

The aggregate reports median duration and each usefulness dimension by role,
decision agreement count/rate, approval/rejection/hold/conflict counts, technical
precision, family counts, and the patch-suitability count/rate defined below. It
also reports population approval rate so held/conflicted volume stays visible.
No review-time target or service-level claim is approved by this packet.

## 10. Patch Suitability

Patch suitability has exactly four values:

- `SUITABLE_FOR_REPOSITORY_REVIEW`
- `NOT_SUITABLE_FOR_REPOSITORY_REVIEW`
- `HOLD_PATCH_REVIEW_INCOMPLETE`
- `NOT_APPLICABLE_NO_APPROVED_PATCH`

Only a provisional approval receives one of the first three values. Every
rejected or conflicted disposition, and every hold reached before provisional
approval, receives `NOT_APPLICABLE_NO_APPROVED_PATCH`, which is excluded from the
suitability-rate denominator. A provisional approval that later becomes `HELD`
retains `NOT_SUITABLE_FOR_REPOSITORY_REVIEW` or
`HOLD_PATCH_REVIEW_INCOMPLETE`. For provisional approvals:

```text
P = T = provisional technical approvals after decision and relationship
        reconciliation
PS = SUITABLE_FOR_REPOSITORY_REVIEW
PN = NOT_SUITABLE_FOR_REPOSITORY_REVIEW
PI = HOLD_PATCH_REVIEW_INCOMPLETE

P = PS + PN + PI
patchSuitabilityRateBasisPoints = P > 0 ? floor(10_000 * PS / P) : null
final APPROVED count A = PS
```

`SUITABLE_FOR_REPOSITORY_REVIEW` means only that the approved candidate belongs
to an approved set that can be split across one or more locally validated
`claim-registry-review-patch-v0` shards for a later, separate repository review.
It requires:

- the exact frozen population and final-decision-set hashes;
- a deterministic patch ID, exact base commit, and bounded registry destination;
- full candidate/document/page/anchor and relationship closure validation;
- source re-open capability for the repository reviewer; the thin patch alone is
  not sufficient evidence;
- at most 500 Unicode code points per excerpt, at most 1,500 aggregate excerpt
  code points per patch shard, at most 256,000 UTF-8 serialized bytes, and at
  most 100 approved candidates per shard;
- every retained shard also fits the stricter 128 KiB detailed-ledger file cap
  and the 1 MiB complete-package cap in Section 11;
- no complete page, source binary, screenshot, OCR asset, local path, reviewer
  identity, customer/private datum, secret, or free-form note;
- `NOT_PRODUCTION_EVIDENCE`, `productionReady:false`,
  `productionReviewerWorkflowReady:false`, Issue #165 `HOLD`,
  `repositoryReviewRequired:true`, `automaticVerification:false`,
  `customerUseAllowed:false`, and `proofExecutionApproved:false`; and
- every approved candidate appears exactly once across the suitable shard set.

The outer v2 contract must produce a local versioned patch-set manifest binding
the frozen round, final-decision-set hash, global relationship-report hash,
ASCII-ordered shard IDs and hashes, and exact one-shard membership for every
approved candidate. Relationship components must remain atomic within a shard.
Independent components may be deterministically sharded to satisfy quote and
byte limits. Validation must prove that every global relationship is present in
the one owning shard and that no cross-shard relationship disappears.
Patch suitability does not authorize writing, committing, pushing, or merging a
Claim Registry change. Under the active rights policy, public-repository
excerpts remain prohibited during the pilot; a future Claim Registry PR needs a
separate explicit rights decision before committing any real excerpt.

## 11. Selected Bounded Retention Contract

### Detailed local ledger

Detailed data is split across exactly three local roots:

```text
tmp/evidence-claim-workbench/human-approval/pr207-candidate-review-v2-custodian/
tmp/evidence-claim-workbench/human-approval/pr207-candidate-review-v2-primary-submission/
tmp/evidence-claim-workbench/human-approval/pr207-candidate-review-v2-secondary-submission/
```

The first root is the only central ledger and is custodian-only. The other two
are isolated role-specific submission roots; neither is a shared ledger. The
frozen PR #207 head already ignores `tmp/evidence-claim-workbench/` in its
`.gitignore`; the evaluated default-branch baseline does not. Therefore the
future operator must run `git check-ignore` against every exact Candidate
Review v2 path in the actual operating worktree before any directory or file is
created or populated. A no-match result is a stop condition; a global excludes
file or status configuration is not sufficient evidence.

Each root must be mode `0700`. The central root must be readable and writable
only by the custodian. Each submission root must be readable and writable only
by the assigned role and custodian, with explicit read/list/write denial proven
for the other role and central-ledger denial proven for both roles. Draft and
central files are mode `0600`; a submitted role file is atomically renamed,
validated, hashed, and sealed mode `0400` before reconciliation. Every file is
regular, single-link, and non-symlink. Alternate paths, arguments, traversal,
hardlinks, races, invalid UTF-8, duplicate JSON keys, partial rows, unknown
fields, and over-limit data fail closed.

The custodian-root file allowlist is exactly:

```text
pr207-candidate-review-v2-round.json
pr207-candidate-review-v2-candidates-01.json
pr207-candidate-review-v2-candidates-02.json
pr207-candidate-review-v2-candidates-03.json
pr207-candidate-review-v2-candidates-04.json
pr207-candidate-review-v2-primary-decisions.json
pr207-candidate-review-v2-secondary-decisions.json
pr207-candidate-review-v2-secondary-patch-assessments.json
pr207-candidate-review-v2-final-decisions.json
pr207-candidate-review-v2-patch-set.json
pr207-candidate-review-v2-patch-NN.json
```

The primary-root allowlist is exactly
`pr207-candidate-review-v2-primary-submission.json`. The secondary-root
allowlist is exactly
`pr207-candidate-review-v2-secondary-submission.json` before reconciliation and
`pr207-candidate-review-v2-secondary-patch-assessments.json` after both initial
role submissions are sealed. The post-reconciliation assessment file receives
only the bounded provisional patch view and cannot contain either role's raw
decision or metrics. No other role-root file may exist.

Candidate IDs are ASCII-sorted and placed in sequential chunks of at most 10;
only the first three or four candidate files may exist as required by `N`. The
only allowed `NN` values are the closed zero-padded integer range `01` through
`35`. The patch-set manifest permits only a contiguous prefix of that range and
binds every present shard. The round manifest binds the exact root label,
relative path, seal state, and SHA-256 of every other present allowlisted file,
including the two sealed initial role submissions and the later secondary patch
assessment; it omits its own path/hash and has no self-hash field. Its entire
canonical serialized file is then hashed externally as `roundManifestSha256`,
which the tracked aggregate binds. No timestamped, backup, history, alternate,
or user-named detailed file is allowed.

The detailed ledger may retain only:

- the frozen reference/hash fields in Sections 2 and 5;
- the 30-35 complete canonical candidates, their bounded inner decision
  snapshots, and exact anchor commitments;
- at most one 500-code-point direct excerpt per candidate and no full page;
- exactly two role decisions per candidate;
- fixed reason codes and relationship IDs;
- bounded integer duration and usefulness values;
- final outcomes and patch-suitability results; and
- canonical file/population/decision/patch hashes.

It must retain all standalone rejection, deferral, conflict, supersession, and
authenticity decisions needed to reconstruct denominators. It must not use the
approval-only patch as a substitute.

The detailed review package is capped at 35 candidates, 70 role-decision rows,
17,500 aggregate excerpt code points, 128 KiB per JSON file, and 1 MiB for the
complete Candidate Review v2 package. The 128 KiB limit preserves the existing
safe ignored-input reader ceiling; widening that frozen reader is not approved.
Limits fail rather than truncate.

Draft rows may be replaced before submission. Submitted rows are immutable.
After the first submitted row, any planned controlling-hash or candidate
correction requires the custodian to verify the invalidation aggregate while the
old round and policy are still valid, then clear the old detail before mutation.
The correction creates a new round, retaining only the old round hash and fixed
invalidation reason. Unexplained drift uses exceptional close without reading
the ledger. No unbounded decision history or old excerpt history is kept.

### Tracked policy-bounded hash aggregate

A future round record must freeze the separate control branch name, control-base
SHA, and aggregate path. That control branch is never PR #206 or PR #207. The
selected aggregate path is
`docs/product/validation/pr207-candidate-review-v2-aggregate.json`; it may retain
only an aggregate containing:

- schema/boundary markers, control branch/base, aggregate path, and UTC
  evaluation date, without a precise human-activity timestamp;
- evaluated PR/base/head SHAs and policy marker/expiry;
- source manifest, document-decision, fidelity-decision, population, role-ledger,
  final-ledger, patch-set, and external `roundManifestSha256` values;
- proposed-restack, equivalence-verifier, and owner-rebind commitments when the
  exact Section 13 exception is used;
- total and per-family population/outcome counts;
- technical precision and population-approval-rate basis points or `null`;
- median role durations and usefulness scores;
- agreement and patch-suitability counts/rates;
- leakage/finding counts and gate result; and
- explicit non-claims.

It must not contain a candidate ID list, per-candidate decision, exact page
locator, source URL, publisher excerpt, structured value, full page, local path,
reviewer identity, precise review timestamp, free text, customer/private data,
or secret. Git history is not a deletion mechanism; this is why only aggregate
counts and SHA-256 commitments over the already bounded files/sets may enter the
tracked record. A hash is a consistency commitment, not proof of anonymity or
non-reversibility; low-entropy or detailed per-candidate input must not be placed
in the tracked aggregate merely because it was hashed.

The resulting aggregate uses a non-circular two-commit receipt. To distinguish
it from the packet-review commits in Section 16, call these commits
`A_aggregate` and `B_aggregate`:

1. Freeze one exact control base `C`. `A_aggregate` must have exactly one parent
   and `parent(A_aggregate) == C`. The complete `C..A_aggregate` name-status
   diff contains exactly one added or modified path,
   `docs/product/validation/pr207-candidate-review-v2-aggregate.json`; no
   rename, mode change, deletion, or second path is allowed. The aggregate does
   not contain `A_aggregate`'s SHA or any receipt field.
2. After `A_aggregate` exists, compute its commit SHA, the aggregate Git blob
   object ID, and the SHA-256 of the exact aggregate bytes.
   `B_aggregate` must have exactly one parent equal to `A_aggregate`.
   `A_aggregate..B_aggregate` must add exactly
   `docs/product/validation/pr207-candidate-review-v2-aggregate-receipt.json`
   and make no other path, mode, or byte change.
3. The receipt contains only its schema/boundary, control branch and `C`,
   aggregate path, `A_aggregate` SHA, aggregate Git blob object ID, and aggregate
   byte SHA-256. It does not contain `B_aggregate`'s own SHA,
   candidate/source detail, or human data.
4. At every evaluated branch tip `T`, `B_aggregate` must be an ancestor of `T`.
   The aggregate and receipt blob object IDs and byte SHA-256 values at `T` must
   equal those at `B_aggregate`; reachability alone is insufficient. Verification
   also rechecks the exact parent counts, both parent equalities, and the two
   closed path diffs above. Any extra parent, changed/deleted blob, rename,
   mode-only change, unexpected path, or tip drift invalidates the aggregate.

This packet does not authorize creating either commit; it selects the future
receipt method so no file is required to hash the commit that contains itself.

### Retention lifecycle

- The detailed local ledger may exist only while the active owner policy remains
  unexpired and the round is open.
- Ordinary close occurs only after the aggregate and its two-commit receipt are
  verified, PR #207 restack/revalidation plus its human merge-decision handoff no
  longer needs the detailed ledger, and either a separately authorized Claim
  Registry review has consumed the approved local patch-set handoff or a human
  records that no such promotion will proceed. Aggregate creation alone does not
  trigger deletion.
- Owner revocation, round invalidation, or `2026-08-21T23:59:59Z` forces an
  immediate exceptional close. Content access stops first; the custodian clears
  the detailed files using only an already-verified aggregate and the fixed file
  allowlist. If no aggregate was verified before forced close, the custodian
  records only `AGGREGATE_UNAVAILABLE_AT_FORCED_CLOSE` plus the round hash and
  fixed close reason, then clears the allowlisted paths without reading their
  content. Cleanup failure keeps the round at `HOLD` and does not authorize
  reopening the content.
- On either close path, the custodian clears Candidate Review v2 detailed files
  and bounded excerpts. The source originals remain outside this ledger under
  local operator control and their separate rights policy; this packet does not
  authorize deleting or redistributing them.
- The tracked policy-bounded hash aggregate may remain as the non-content method
  record.
- Expiry stops reading, reviewing, patch generation, or reuse. It does not
  silently renew authority. A new owner policy and a fresh round are required.
- No automated purge implementation is approved by this docs-only packet; the
  future implementation must make the close/clear operation explicit,
  fail-closed, and locally verifiable.

## 12. Privacy, Copyright, and Use Boundaries

The controlling policy is `LOCAL_OPERATOR_DISPLAY_ONLY`.

Allowed for the bounded pilot:

- direct local-filesystem display to the qualified reviewers;
- bounded excerpts for internal repository-review preparation;
- fixed structured metadata, hashes, reason codes, and the policy-bounded hash
  aggregate;
- source originals kept only in the operator-controlled local area after the
  operating worktree proves its applicable ignore rule.

Prohibited:

- full-page transmission, including sending complete page text to a server,
  model, browser transport, collaboration tool, or external reviewer system;
- full-page, source-binary, screenshot, OCR, or original-document Git commit,
  export, copy, upload, or public excerpt;
- launching the existing PR #207 real-intake UI while it transports complete
  normalized page text contrary to the active policy;
- names, emails, employer/customer/account identifiers, private project data,
  phone numbers, reviewer identity, precise activity timestamps, free-form
  notes, credentials, tokens, cookies, secrets, private URLs, or absolute local
  paths;
- customer-use, legal, compliance, certification, engineering-fit, or product-
  availability conclusions; and
- inferring rights, officiality, currentness, fidelity, or truth from a URL,
  publisher domain, hash, or prior machine acceptance.

If even bounded internal excerpt use is conclusively prohibited, reject the
candidate with the compatible fixed copyright/use reason. If the permission is
unclear or potentially resolvable, defer it. If source identity or authenticity
is unclear, use the authenticity flag. Discovery of private/secret data, a full-
page leak, or an unsupported rights condition stops the entire round; the
content must not be copied into a decision record.

This packet is a product/data boundary, not legal advice. A public Claim Registry
excerpt, external distribution, or any expanded use requires a separate rights
owner decision.

## 13. Conditional Merge Train and Downstream Gates

The current state is still `NO_MERGE_INPUT_INCOMPLETE`. The following is a
future conditional sequence, not present merge approval:

1. Keep PR #206 and PR #207 Draft and frozen while human evidence is collected.
2. PR #206 may be considered for merge only after five eligible de-identified
   R1-R5 sessions pass the frozen method and a human merge decision is recorded.
3. Merge PR #206 first.
4. Freeze `O_base =
   9d144fbe6309ce363f9dad8d50ffa713d24af683`, old PR #207 head `O =
   c6a5469338999097acd5de7c5a12c827d27d4540`, and the exact post-PR #206
   `master` tip `M`. Prove `O_base` is the merge base and ancestor of `O`, and
   record the complete ordered commit list for `O_base..O`.
5. In a fresh detached worktree, replay that complete ordered commit list onto
   `M` without moving the live PR branch. The proposed tip `R` must be a linear
   chain: its first replayed commit has sole parent `M`, each later replayed
   commit has the preceding replayed commit as its sole parent, `M` is an
   ancestor of `R`, and `git merge-base M R` equals `M`. Merge commits, omitted
   commits, added commits, or a different parent make the rebind ineligible.
6. Run the full equivalence verifier in a second clean read-only worktree. It
   binds and hashes: (a) `git range-diff --no-color O_base..O M..R`, with a
   one-to-one ordered mapping and no unmatched commit; (b) the complete
   name-status/mode path sets for both ranges; (c) per-path base, old-tip,
   merged-base, and proposed-tip blob IDs plus byte SHA-256; and (d) an
   independently replayed expected tree `E`. `tree(R)` must equal `E`, and a
   full-tree diff between `E` and `R` must be empty. No path outside the old
   PR #207 range is permitted.
7. Conflict resolution uses one exact-path allowlist frozen during the detached
   replay and before owner rebind. Each entry contains only the path, conflict
   kind, `O_base`/`O`/`M`/resolved blob IDs and byte SHA-256 values, fixed
   resolution reason, and independent verifier result. Globs, directories,
   unrecorded conflicts, mode-only drift, and prose-only claims of semantic
   equivalence are forbidden. Every non-allowlisted path must have an unchanged
   mapped patch in the range-diff; every allowlisted path must equal its
   independently constructed expected blob. The allowlist is exactly empty
   when no conflict occurred.
8. While the live PR still has head `O` and the current ledger policy is active,
   the same verifier must additionally prove byte and canonical-semantic
   equivalence for the source manifest, document decisions, completed fidelity
   decisions, population and component selection, complete candidates,
   decision snapshots, anchors, relationships, sealed role submissions, final
   decisions, and patch outputs. Record exact command, tool SHA, input hashes,
   result hashes, `O_base`, `O`, `M`, `R`, `E`, range-diff hash, path-manifest
   hash, and conflict-allowlist hash.
9. Before moving the live PR head, obtain a fresh owner rebind record naming all
   of those exact values plus policy/expiry and ledger hashes. It must approve
   only `O -> R`. If ancestry, full range/tree/path equivalence, the conflict
   allowlist, verifier, or owner record is absent or fails, do not reuse old
   human evidence: after restack, obtain a new policy and repeat the affected
   fidelity and Candidate Review v2 work.
10. Move the live PR #207 head only to `R` and confirm the remote head is exact.
    Any other result is unexplained drift, invalidates the round, and triggers
    exceptional close without a ledger read.
11. Rerun complete supported validation and the Candidate Review v2 gates
    against `R`. PR #207 may be considered for merge only when they pass, all
    P0/P1 findings are closed, checks pass, and a human merge decision is
    recorded.
12. Merge PR #207 second.

Candidate approval is not canonical Claim Registry approval. Only a separate
Claim Registry PR may map patch-suitable approvals into `evidence-claim-v1`,
reopen their sources, review provenance/evidence/applicability/conflicts, and
allow `createValidatedClaimRegistry(...)` to derive a status. Only that stage
may evaluate the possibility of `VERIFIED`; no editable status flag is allowed.
Customer-use `ALLOWED` remains a separate derived decision.

Twenty-five approved candidates may produce fewer than 25 canonical claims
because duplicates, relationships, mapping, and registry review can consolidate
or reject candidates. Count canonical claims by unique validated `claimId`.

For this packet, `Tender Matrix` means a future new product artifact/workstream.
It is not the Claim Registry project stage named `TENDER` and is not the PR #207
experimental variant-table spike. Tender Matrix work remains blocked until all
of these are true:

- PR #206 is merged after its human-validation gate;
- PR #207 is restacked, reverified, and merged after Candidate Review v2;
- at least 25 candidates are approved, including at least 10 per product family;
- at least 20 unique canonical Claim Registry claims have passed their separate
  repository review and have derived validated registry status `VERIFIED`; and
- the Tender Matrix itself receives a separate explicit goal and contract.

Issue #165 production proof remains a separate final `HOLD`. Nothing in the
fidelity, candidate, merge, canonical-claim, or Tender Matrix sequence authorizes
production/staging deploy, endpoint calls, D1 access/write/migration, logs,
secrets, customer/private data, CRM, outreach, LLM, or automation.

## 14. Future Implementation Acceptance Criteria

A later explicit Candidate Review v2 implementation goal must add and validate:

- a non-empty exact candidate-row schema and fixed ignored file set;
- fail-closed file safety and all binding/invalidation rules in this packet;
- safe candidate generation only from fidelity-eligible pages;
- deterministic 30-35 population selection and per-family coverage;
- two independent role inputs and four-outcome reconciliation;
- the ordered outcome function and outer terminology-gap representation;
- complete relationship closure;
- bounded duration, usefulness, precision, and patch-suitability fields;
- the selected detailed-ledger/aggregate split and lifecycle;
- no-identity, no-free-text, no-full-page, no-secret/private-data enforcement;
- adversarial tests for hash/head/page/anchor/candidate/decision drift;
- exact count, zero-denominator, duplicate, disagreement, abstention, family,
  precision, quote-budget, shard, manifest self-exclusion, two-commit aggregate
  receipt, pre-restack rebind, expiry, and clear tests;
- proof that the tracked aggregate alone contains no detailed human/source
  content; and
- full supported PR #207 and repository validation against the owning commit.

Implementation must fail closed rather than fabricate candidates or human
evidence. A completed blank template, generated fixture, machine admission,
hash match, zero-denominator metric, or safe abstention is never a human review.

## 15. Explicit Non-Decisions and Stop Conditions

This packet does not approve:

- Candidate Review v2 implementation or execution;
- filling any fidelity, candidate, reviewer, or patch-suitability field;
- changing PR #206 or PR #207 heads, code, tracked artifacts, or Draft status;
- launching the nonconforming real-intake UI;
- committing detailed review records, source text, or real excerpts;
- PR #206 or PR #207 merge/restack execution;
- canonical Claim Registry promotion, `VERIFIED`, or customer-use `ALLOWED`;
- Tender Matrix implementation;
- production proof, deploy, D1, endpoints, logs/secrets, or customer data; or
- CRM, outreach, email, LLM, analytics, telemetry, or automation.

Stop immediately on:

- evaluated-head drift outside the exact preverified/prebound Section 13
  transition, or manifest, document-decision, completed-fidelity, source,
  candidate-population, candidate, page, anchor, decision, or patch hash drift;
- fewer than eight complete valid fidelity rows;
- candidate generation outside eligible pages or safe representability;
- fewer than 30 safe candidates, more than 35 selected candidates, or fewer than
  10 candidates for either product family;
- missing/duplicate/ineligible roles or unconfirmed role separation;
- incomplete, vague, contradictory, partial, or unknown structured decisions;
- unresolved relationship closure in any proposed patch;
- unauthorized full-page transmission, export, or Git commit;
- source-binary, private, identity, secret, free-text, or local-path leakage;
- any no-match result from `git check-ignore` for a detailed review filename;
- retention-policy expiry or owner revocation;
- a failed local/CI gate, unresolved P0/P1 finding, or scope uncertainty; or
- any attempt to infer merge, canonical trust, customer use, Tender Matrix
  readiness, or production authority from this packet.

## 16. Validation Contract and Final Status

The revised packet uses a separate non-circular packet-review receipt. These
commits are `A_packet` and `B_packet`; they are not the future aggregate commits
in Section 11.

1. `A_packet` is the final revision commit based on current `master`
   `d7a45257b9aa48d2975db9852a993d79f70972bf`. That baseline must be its
   ancestor, and the receipt records `A_packet`'s exact parent vector and
   complete changed-path manifest. `A_packet` contains this packet and the
   non-authoritative input-observation JSON, references the required receipt
   path, and must not contain that receipt path.
2. Only after `A_packet` exists, two isolated read-only reviews evaluate that
   exact commit under fixed non-identity role labels
   `METHOD_REPRODUCIBILITY_REVIEW` and `SECURITY_PRIVACY_BOUNDARY_REVIEW`.
   Each result binds `A_packet`, the packet and observation Git blob object IDs
   and byte SHA-256 values, decision `PASS` or `REQUEST_CHANGES`, and fixed
   severity counts. No reviewer identity, prose note, source excerpt, local
   path, or human data is retained. Any non-`PASS` result or unresolved finding
   requires a new `A_packet`; it cannot be papered over in a receipt.
3. Only when both independent results are `PASS`, `B_packet` may be created as
   the sole child step. `parent(B_packet)` must equal `A_packet`, and the
   complete `A_packet..B_packet` diff must add only
   `docs/roadmap/pr207-candidate-review-v2-packet-post-commit-review-receipt-20260725.json`.
   The packet and observation blobs and modes must remain byte-identical.
4. The receipt binds its schema and non-production boundary, the controlling
   `REQUEST_CHANGES` URL/comment ID and reviewed prior head/hashes, current
   `master` baseline, `A_packet` SHA and parents, complete changed-path-manifest
   hash, packet/observation paths, blob object IDs and byte SHA-256 values, and
   both independent structured review results. It must not contain
   `B_packet`'s SHA, its own blob ID/hash, human data, or a claim of merge or
   production authority.
5. At any evaluated PR tip `T`, `B_packet` must be an ancestor of `T`, and the
   packet, observation, and receipt blob object IDs and byte SHA-256 values at
   `T` must equal those at `B_packet`. Verification rechecks both commits'
   parent/diff invariants. A copied receipt, self-described pre-commit `PASS`,
   changed packet after review, extra Commit B path, or evaluated-tip blob drift
   is `REQUEST_CHANGES`.

Docs-only content validation for this packet is:

```text
node -e 'JSON.parse(require("node:fs").readFileSync("docs/roadmap/pr207-candidate-review-v2-packet-revalidation-20260725.json", "utf8"))'
git diff --cached --check
npm run check:naming
```

For `A_packet`, the receipt path must be absent and that absence must be checked
explicitly. For `B_packet`, parse the newly added receipt, prove the exact
parent/diff/blob rules above, and verify both independent results before treating
it as review evidence. The packet and its source-of-truth pointer files must be
staged explicitly before the cached-diff check. An unstaged `git diff --check`
does not inspect an untracked packet and is insufficient.

Packet preparation additionally requires read-only evidence checks for:

- repository root, current branch, exact `HEAD`, and default branch;
- existence of the frozen PR/base/control commits;
- live PR #206/#207 number, Draft state, head/base SHA, merge state, and checks;
- the two cited PR #207 owner comments and their binding fields;
- SHA-256 of every local artifact named in Section 2;
- regular-file, single-link, and `0600` mode for detailed local inputs;
- the PR #207-head `.gitignore` rule plus a successful `git check-ignore` for
  each actual detailed filename; and
- a final repeat of PR heads, artifact hashes, and worktree status after review.

These checks establish only the packet-preparation snapshot. They do not create
a durable drift verifier or authorize future execution. The future Candidate
Review v2 implementation must automate equivalent fail-closed verification and
must re-read live state at its own evaluation instant.

PR #207-specific Candidate Review v2 commands do not exist on the evaluated
`master` baseline and must not be invented in this packet. A future
implementation must add commands and tests before claiming capability.

```yaml
final_status:
  packet: READY_FOR_EXACT_COMMIT_A_POST_COMMIT_REVIEW
  pre_revision_observation: NON_AUTHORITATIVE_INPUT_ONLY
  post_commit_review_receipt: REQUIRED_IN_COMMIT_B
  packet_merge_approved: false
  method_decision: SELECTED_IN_PACKET_PENDING_HUMAN_REVIEW
  bounded_retention: IGNORE_VERIFIED_LOCAL_LEDGER_PLUS_POLICY_BOUNDED_HASH_AGGREGATE
  pr206_head_mutated: false
  pr207_head_mutated: false
  human_fidelity_decisions_created: 0
  candidates_created: 0
  human_candidate_decisions_created: 0
  canonical_verified_claims_created: 0
  customer_use_allowed_claims_created: 0
  candidate_review_v2_implementation: HOLD_PENDING_SEPARATE_GOAL
  pr206_merge: HOLD
  pr207_merge: HOLD
  tender_matrix: BLOCKED
  production_proof_issue_165: HOLD
  production_ready: false
```
