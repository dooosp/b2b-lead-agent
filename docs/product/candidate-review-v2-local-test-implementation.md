# Candidate Review v2 local/test implementation

Status: stacked Draft implementation; `NOT_PRODUCTION_EVIDENCE`.

This implementation adds deterministic synthetic evaluation and blank local
file workflows for the Candidate Review v2 method. It does not contain real
fidelity decisions, real candidates, human review results, reviewer identities,
source pages, production evidence, or merge approval.

## Authority and exact stack

The controlling method was merged as docs-only PR #208:

- reviewed method commit (`A_packet`):
  `3ea7a8020ce1bae8e5de2956c65af9a6f0ca2dd8`;
- receipt-only method head (`B_packet`, the PR #208 head):
  `8d53f1df0eae69dd62399d1437abafce839953f3`;
- squashed `master` merge for PR #208:
  `4dad779efc30ca87d61bb113b4892cee6fafc1b9`.

The exact-head owner record is
[`5077119914`](https://github.com/dooosp/b2b-lead-agent/pull/208#issuecomment-5077119914).
It authorizes only a new stacked local/test implementation branch from frozen
PR #207 head
`c6a5469338999097acd5de7c5a12c827d27d4540`, with synthetic or blank
fixtures, independent review, and a Draft PR. This branch is that stack.

The record does not authorize:

- real fidelity or candidate inputs;
- Candidate Review v2 human execution or human-result recording;
- mutating or merging PR #206 or PR #207;
- accepting, marking Ready, or merging this implementation;
- canonical Claim Registry promotion or derived `VERIFIED` status;
- customer-use `ALLOWED`, Tender Matrix work, or production action.

Issue #165 remains `HOLD`. `productionReady` and
`productionReviewerWorkflowReady` remain `false`.

## PR #209 dependency inheritance

PR #209 merged Gate 0 security and reproducibility remediation at
`d7a45257b9aa48d2975db9852a993d79f70972bf` before PR #208. The authorized
implementation stack nevertheless starts from the frozen PR #207 head above,
which predates that remediation and therefore does not itself contain PR #209's
dependency, lockfile, live-audit separation, or timestamp-only rewrite changes.

To avoid carrying PR #207's now-known high-severity axios advisory while this
stack is reviewed, this implementation narrowly inherits PR #209's
`axios >=1.18.0` production dependency floor, regenerated lockfile, and
separate scheduled/manual `security:audit-current` workflow. The scoped
non-production triage remains in ordinary CI and the live registry audit
remains separate, so nondeterministic advisory changes cannot rewrite the
normal PR gate.

This narrow inheritance is not a PR #207 restack and does not claim to
backport, replace, or reproduce the rest of PR #209. A future proposed PR #207
restack must inherit PR #209 from the exact then-current `master` and satisfy
the method packet's full replay, path/tree equivalence, conflict allowlist,
owner rebind, and revalidation procedure before any live PR head moves. A
passing synthetic gate or current dependency audit on this stacked branch is
not restack evidence and does not make the branch merge-ready.

## Implemented local/test surface

The deterministic gate uses a checked-in synthetic fixture containing 30–35
candidate rows across the exact families
`medium_voltage_switchgear` and `transformer`. It includes whole relationship
components for duplicate, material-conflict, supersession, and
condition-resolved cases. Selection is deterministic and never splits a
relationship component.

The synthetic evaluator repeats the same run and refuses nondeterministic
output. It checks population bounds, family coverage, four-outcome
reconciliation, bounded metrics, relationship closure, patch-set validation,
value-aware leakage boundaries, and the non-production boundary. Its
threshold-pass simulation deterministically produces 29 approved, 2 rejected,
1 held, and 0 conflicted candidates; a separate role-disagreement simulation
exercises all four final outcome types. A boundary simulation proves that
exactly 8,000 basis points passes the inclusive precision threshold, while a
zero-resolution simulation keeps precision and patch-suitability rates `null`
rather than silently reporting zero.

Every completed row and patch excerpt in those scenarios is synthetic.
Synthetic approvals are evaluator scenarios only: they are not human
decisions, canonical claims, customer-use permission, or production evidence.
The synthetic patch containers validate their hashes, bindings, limits, and
relationship-component packing, but explicitly report
`realReviewPatchValidation: NOT_APPLICABLE_SYNTHETIC_FIXTURE` with zero
validated real-review patches or bindings. Synthetic quality finding counts
are likewise scoped as `synthetic: true`.
Even when the synthetic numeric thresholds pass,
`candidateReviewMethodGatePassed` remains `false`, and the evaluator reports
the Candidate Review v2 human gate as `INCOMPLETE`.

The core contract also has a generated, repository-local round-trip test for
the structurally non-synthetic-shaped branch. It exercises
`createReviewPatch -> createCandidateReviewPatchSet -> reconcile`. That path is
named `STRUCTURALLY_BOUND_EXTERNAL_EVIDENCE_REQUIRED`: it proves only that
canonical patch objects and the Candidate Review v2 structural bindings can be
validated together. The test inputs are generated and are not human evidence.
The path does not authenticate the supplied commit-shaped values, prove that a
human reviewed a source, or prove custody separation.
Every such result therefore fixes `externalHumanProvenanceVerified` and
`externalCustodyVerified` to `false`, retains an explicit external-evidence
blocker, and keeps `candidateReviewMethodGatePassed:false`. A future,
separately approved execution wrapper would have to verify the external source,
human provenance, role separation, access isolation, and Git receipts before
any human method gate could be promoted; this implementation has no such
promotion path.

The local prepare command creates only fixed-path blank role envelopes from the
synthetic round. The local validator may validate those bounded files but must
continue to report `INCOMPLETE` until separately authorized, complete, sealed
role inputs exist. Preparing a blank file is never evidence that a qualified
person reviewed anything.

The fixed-path reader, creator, and sealer snapshot the repository/root
directory chain and revalidate directory ownership and inode identity around
file open, read, and rename operations. Intermediate-directory replacement or
symlink swaps fail closed. This is application-level race detection, not an OS
security boundary against a malicious process running as the same account;
actual cross-principal custody still requires separately verified filesystem
isolation and access-probe evidence.

The aggregate-receipt verifier is read-only. It checks only the fixed aggregate
and receipt paths and the local Git commit graph. It cannot create either
receipt commit, accept arbitrary paths, contact GitHub, inspect a remote
service, or infer human review.

## Commands and CI boundary

The deterministic CI gate is:

```text
npm run check:candidate-review-v2
```

It runs the focused test suite and the repeated synthetic evaluator. CI runs it
after the existing Workbench evaluator and before the broad Workbench and full
repository tests.

The inherited current production-dependency audit is intentionally separate:

```text
npm run security:audit-current
```

It runs only from its scheduled/manual workflow. The ordinary deterministic CI
continues to run the scoped local triage instead.

The following fixed commands are operator-only local workflows and are
intentionally excluded from CI:

```text
npm run prepare:candidate-review-v2:local
npm run validate:candidate-review-v2:local
npm run verify:candidate-review-v2:aggregate-receipt
```

They accept no arbitrary path, workspace, URL, real-data, or network argument.
The prepare and validate commands operate only under the fixed ignored
Candidate Review v2 roots. The receipt verifier reads only the fixed tracked
aggregate/receipt paths and local Git objects.

## Explicit non-claims and residual gates

A passing local gate establishes only deterministic behavior over synthetic or
blank inputs. It does not prove:

- role isolation, filesystem ACL enforcement, or two different qualified
  humans;
- external human provenance or custody merely because objects shaped for the
  structural branch were supplied;
- actual human fidelity or Candidate Review v2 execution;
- real-document fidelity, officiality, currency, technical truth, rights, or
  suitability;
- successful aggregate commit creation or receipt-chain existence;
- PR #207 restack equivalence, owner rebind, acceptance, or merge;
- canonical claim review, `VERIFIED`, customer use, Tender Matrix readiness, or
  production readiness.

Human execution remains separately approval-gated and unperformed. Until such
authority and complete valid inputs exist, the truthful review result is
`INCOMPLETE`, both Draft PRs remain `HOLD`, and production remains `HOLD`.
