# Production Proof Boundaries

This document records the production-proof boundary after Issue #34 and the May 11 PR train. It is a planning and safety document only; it is not production evidence.

Audited repo baseline for this snapshot:

- Previous audited production-proof planning baseline: `f157b4c51af37d840f36d3680120e7d74b526c03` (PR #103)
- Current source-of-truth `origin/master`: `db2a69a7b92502bec3183b94bf0d728e1312a121` (PR #107)
- Issue #34 current state: closed as completed after GitHub-only closeout, [Production D1 observation approval request](https://github.com/dooosp/b2b-lead-agent/issues/34)
- Issue #34 final useful closeout SHA: `12d44374a24a9958de179fae5f9311621606ad24`
- Production action performed for this roadmap synthesis: none
- Current non-production readiness refresh packet: `docs/exec-plans/production-proof-readiness-packet.md`

Post-PR107 operating update:

- Current source-of-truth `origin/master` for the standing-approval-policy
  update: `db2a69a7b92502bec3183b94bf0d728e1312a121` (PR #107).
- Issue #34 is closed as completed after a GitHub-only closeout approval and
  closeout record.
- Standing approval policy: `docs/standing-approval-policy.md`.
- The standing policy reduces unnecessary `HOLD` states for routine repo,
  GitHub, documentation, local validation, fake-D1, loopback-only, and
  non-production work.
- The standing policy does not authorize production deploy, Wrangler,
  production D1 access, production Worker endpoint calls, production
  logs/secrets, production smoke tests, row reads/writes, row roundtrip, or new
  production observation claims.

## Standing Approval Policy

`docs/standing-approval-policy.md` is the default approval boundary for routine
future work. Use it to continue local/non-production work after preflight when
the task does not require production resources, secrets, destructive git,
unrelated dirty-file cleanup, or unresolved production-risk closure.

Production-proof work remains separate. Any production approval must still name
the exact repo, branch, SHA, command list, gate matrix, owners, evidence path,
rollback path, stop conditions, redaction rules, execution window, and automatic
continuation decision.

## Issue #34 Learnings

Issue #34 established the approval pattern for production proof work:

- Approval comments are not deploy approval unless they explicitly say so.
- GitHub ownership, PR authorship, and merge rights are not production ownership.
- CI, docs, source/config inspection, local fake-D1 tests, and generated evidence packets are not production evidence.
- Schema proof, runtime proof, row read, row write, row roundtrip, deploy, rollback, and observation claim are separate gates.
- Evidence must be minimized and redacted.

Accepted Issue #34 records:

| Record | Result | Boundary retained |
| --- | --- | --- |
| Schema remediation result | DDL-only remediation accepted; full target `leads` schema was reported present after postcheck for the approved SHA | Did not prove row serialization, Worker runtime behavior, or product observation. |
| Schema remediation closeout | Schema remediation complete only | Did not run new production commands or make observation claims. |
| Runtime manifest proof | One approved raw `GET /manifest.json` returned HTTP 200 JSON redacted evidence | Did not access D1, read rows, write rows, call API routes, load browser pages, call service worker path, or prove D1-backed runtime behavior. |
| Schema-proof-only read-only result | Existing Issue #34 record reports an approved schema metadata read for the PR #106 baseline | Does not prove production behavior, endpoint health, row persistence, row roundtrip, smoke-test success, or current `master` runtime behavior. |
| Final no-op closeout | Schema remediation and manifest proof complete within narrow scope | Production observation claim remains forbidden; future proof needs separate approval. |

Important freshness rule: Issue #34's accepted execution/proof scopes were tied
to earlier approved SHAs, including the final read-only schema-proof baseline at
`512b537797fc67d974acf1f1e690bd638de4919b` (PR #106). The latest audited
source-of-truth `master` baseline is `db2a69a7b92502bec3183b94bf0d728e1312a121`
after PR #107 added the standing approval policy. Any new production action
must refresh the actual current `origin/master` SHA, CI metadata, owners, and
approval records before execution. Issue #34 closeout does not authorize further
production proof work.

## Current Proof Status

| Surface | Status | Notes |
| --- | --- | --- |
| Local schema consistency | Proved locally by repo files and `npm run check:schema` | Local evidence only. Does not inspect production D1. |
| Production D1 schema remediation and schema metadata proof | Accepted in Issue #34 for prior approved SHAs only | Do not extend these approvals to current `master` without a new explicit production approval. |
| Static Worker runtime route | One raw `/manifest.json` proof accepted | Proves only the public manifest route response in that approved scope. |
| D1-backed Worker routes | Unproven in production after current train | Requires separate approval for any endpoint or D1 access. |
| Row serialization and roundtrip | Unproven in production | Requires safe real row/action and explicit production write approval. |
| Product production observation | Unproven | Requires explicit production observation-claim approval after valid evidence exists. |

## Actions That Require Separate Approval

| Action | Approval needed |
| --- | --- |
| Deploy Worker or trigger deploy workflow | `ALLOW_DEPLOY=yes`, deploy owner, approved SHA, rollback plan |
| Run Wrangler deploy or D1 command | Deploy or DB access approval, exact command, owner, evidence policy |
| Access production D1 | `ALLOW_PRODUCTION_DB_ACCESS=yes`, DB owner, exact read/schema path |
| Invoke lazy DDL or migration | `ALLOW_PRODUCTION_DB_MIGRATION=yes`, migration owner, rollback/stop criteria |
| Read a production row | Row-read approval, safe lead/profile selection, evidence policy |
| Write or patch a production row | `ALLOW_PRODUCTION_DB_WRITE=yes`, real owner-approved row/action, no-overwrite check |
| Call production Worker endpoint | Endpoint-call approval, exact method/path, call count, auth/credential policy |
| Claim production observation | `ALLOW_PRODUCTION_OBSERVATION_CLAIM=yes`, complete evidence review and approval record |

## Non-Evidence

The following support engineering confidence but are not production proof:

- Local tests.
- CI results.
- GitHub check status.
- PR descriptions.
- Documentation.
- Source/config files.
- D1 binding names, database names, or database IDs.
- Local fake-D1 or staging observations.
- Screenshots without production deploy metadata.
- Screenshots or image-only artifacts as sole proof.
- Synthetic fixtures.
- Release evidence packets generated from local inputs.

## Minimum Future Approval Packet

Before any next production proof run, prepare a new Issue #34-style packet with:

- Actual current `master` SHA and CI status.
- Exact production action requested.
- Exact method/path or command.
- Deploy owner, production DB owner, rollback owner, and observation owner.
- Evidence storage location, access control, and redaction policy.
- Rollback path and stop criteria.
- Safe profile, lead, or explicit no-row decision.
- Confirmation that `status` and `reviewStatus` remain separate.
- Confirmation that the frozen `crm.published-report.v1` contract is not being expanded.
- Explicit denial of any action not in scope.

## Recommended Next Production-Proof Sequence

1. Refresh approval baseline to current `master` with `docs/exec-plans/production-proof-readiness-packet.md`.
2. Review whether production proof is needed before more product UX work. If not, hold.
3. If needed, request a no-write D1 schema/read proof first.
4. Only after that, request a row serialization proof with a real safe row/action.
5. Only after evidence review, request permission to make a production observation claim.

## Stop Conditions

Stop with `HOLD` if any of these are true:

- The approved SHA is stale.
- CI is missing, stale, or failing for the approved SHA.
- Owner, policy, rollback, evidence, or safe-row fields are missing.
- The requested path may write but write approval is absent.
- The requested path may run lazy DDL but migration approval is absent.
- The evidence would include secrets, auth headers, cookies, private URLs, customer payloads, PII, or unredacted production payloads.
- The action would overwrite human review decisions or toggle review state only to manufacture evidence.
- The request would expand the frozen CRM published-report contract.
