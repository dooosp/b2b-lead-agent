# Production Proof Boundaries

This document records the production-proof boundary after Issue #34 and the
Manual Review Notes v1 PR train through PR #142, the Level 1 non-production
gate train through PR #185, the post-PR186 refactor/dependency cleanup, and
the post-PR191 source-of-truth/reviewer-workflow-intelligence sync. It
is a planning and safety document only; it is not production evidence.

Audited repo baseline for this snapshot:

- Previous audited production-proof planning baseline: `f157b4c51af37d840f36d3680120e7d74b526c03` (PR #103)
- Previous Manual Review Notes v1 privacy-warning baseline:
  `f2ddf35e828017eec9332dc80876e50bbee2f54a` (PR #130)
- Current source-of-truth `origin/master`:
  `72def61e89b3c2137b13e2a3ce0bbbc58407d8ce` (PR #191)
- Issue #34 current state: closed as completed after GitHub-only closeout, [Production D1 observation approval request](https://github.com/dooosp/b2b-lead-agent/issues/34)
- Issue #34 final useful closeout SHA: `12d44374a24a9958de179fae5f9311621606ad24`
- Production action performed for this roadmap synthesis: none
- Current non-production readiness refresh packet: `docs/exec-plans/production-proof-readiness-packet.md`
- Current Manual Review Notes v1 production readiness gap packet:
  `docs/roadmap/manual-review-notes-v1-production-readiness-gap-packet.md`
- Current Manual Review Notes v1 production proof plan:
  `docs/roadmap/manual-review-notes-v1-production-proof-plan.md`
- Current Manual Review Notes v1 production D1 migration plan:
  `docs/roadmap/manual-review-notes-v1-production-d1-migration-plan.md`
- Current Manual Review Notes v1 production rollback/backout plan:
  `docs/roadmap/manual-review-notes-v1-production-rollback-backout-plan.md`
- Current Manual Review Notes v1 local/staging dry-run plan:
  `docs/roadmap/manual-review-notes-v1-staging-dry-run-plan.md`
- Current Manual Review Notes v1 local/fake-D1 dry-run evidence:
  `docs/roadmap/manual-review-notes-v1-local-fake-d1-dry-run-evidence.md`
- Current Manual Review Notes v1 staging target decision packet:
  `docs/roadmap/manual-review-notes-v1-staging-target-decision-packet.md`
- Current Manual Review Notes v1 non-production cycle closeout packet:
  `docs/roadmap/manual-review-notes-v1-non-production-cycle-closeout.md`
- Current Level 1 change-control manifest packet:
  `docs/roadmap/b2b-lead-agent-level-1-production-proof-change-control-manifest-non-production.md`
- Current Level 1 operator rehearsal packet:
  `docs/roadmap/b2b-lead-agent-level-1-operator-rehearsal-gate-non-production.md`

Post-PR191 operating update:

- Current source-of-truth `origin/master` for this boundary update:
  `72def61e89b3c2137b13e2a3ce0bbbc58407d8ce` (PR #191).
- PR #187 only synced source-of-truth docs after PR #186. PR #188 only tracked
  historical PR #12 root-cycle merge and Wave 2 bootstrap records as archival
  execution artifacts. PR #189 only synced source-of-truth and
  production-boundary docs after PR #188. PR #190 only synced source-of-truth
  docs after PR #189. PR #191 added local/test-safe Reviewer Workflow
  Intelligence v1 on existing reviewer workflow surfaces. None of these PRs
  approves production or staging action.
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
- PR #130's Manual Review Notes privacy warning is static local/test guidance
  only. It does not create production compliance evidence, detection,
  redaction, retention enforcement, purge/delete behavior, export or manager
  visibility approval, authenticated reviewer identity, or production proof.
- The Manual Review Notes v1 production readiness gap packet is docs-only
  planning. It keeps production proof execution, production deploy, production
  D1 migration/access/write, production endpoints, production logs/secrets,
  customer-data access, retention/privacy enforcement, and production readiness
  claims blocked until separate explicit approval.
- The Manual Review Notes v1 production proof plan is docs-only planning. It
  prepares prerequisites, dry-run checks, D1 migration readiness checks,
  rollback/backout planning, access-control checks, retention/privacy checks,
  generated-suggestion exclusion checks, observability/logging requirements,
  evidence boundaries, and future approval blocks. It does not authorize or
  execute production proof, production deploy, production D1 access/migration,
  production endpoint calls, production logs/secrets access, production smoke
  tests, customer data access, production access-control implementation,
  retention/privacy enforcement, manager visibility, export expansion, or any
  production readiness claim beyond "production proof plan prepared."
- The Manual Review Notes v1 production D1 migration plan is docs-only
  planning. It documents current local/test schema inventory, plan-only
  migration ordering, nullable/backfill behavior, metadata-only history
  migration requirements, compatibility checks, local/staging rehearsal,
  rollback/backout requirements, generated-suggestion exclusion requirements,
  evidence boundaries, and explicit future approval blocks. It does not
  authorize migration file creation, production D1 schema observation,
  production D1 migration/access/write, production proof execution, production
  deploy, Wrangler production commands, production endpoints, production
  logs/secrets, production smoke tests, customer data access/mutation,
  production access-control implementation, retention/privacy enforcement,
  manager visibility, export expansion, or any production readiness claim
  beyond "production D1 migration plan prepared."
- The Manual Review Notes v1 production rollback/backout plan is docs-only
  planning. It documents rollback scenarios, partial migration handling,
  nullable field behavior, metadata-only history backout, no-destructive-data
  rules, local/staging rehearsal, generated-suggestion rollback exclusion,
  access/privacy/retention gates, evidence boundaries, and explicit production
  execution approval blocks. It does not authorize executable rollback or
  migration files, rollback execution, production D1 schema observation,
  production D1 migration/access/write/delete, production proof execution,
  production deploy, Wrangler production commands, production endpoints,
  production logs/secrets, production smoke tests, customer data
  access/mutation, production access-control implementation,
  retention/privacy enforcement, destructive data action, purge/delete jobs,
  manager visibility, export expansion, or any production readiness claim
  beyond "production rollback/backout plan prepared."
- The Manual Review Notes v1 local/staging dry-run plan is docs-only planning.
  It documents dry-run scenarios, preflight checks, local fake-D1 rehearsal,
  migration-readiness rehearsal, rollback/backout rehearsal, C2 role-stub
  rehearsal, generated-suggestion exclusion checks, privacy/retention checks,
  staging-like target requirements, evidence/anti-overclaim rules, and explicit
  execution approval blocks. It does not authorize staging execution,
  local/fake-D1 dry-run execution beyond ordinary docs-only PR validation,
  production D1 schema observation/access/write/delete, Wrangler production
  commands, production proof execution, production deploy, production endpoints,
  production logs/secrets, production smoke tests, customer data
  access/mutation, runtime/UI/schema/API behavior changes, executable migration
  or rollback files, production access-control implementation, retention/privacy
  enforcement, destructive data action, purge/delete jobs, manager visibility,
  export expansion, or any production readiness claim beyond "local/staging
  dry-run plan prepared."
- The Manual Review Notes v1 local/fake-D1 dry-run evidence packet records one
  approved local-only execution from the post-PR140 baseline. It ran local
  schema, manual-note, worker, full test, loopback/fake-D1 E2E, naming, install,
  and synthetic fixture evaluator commands. It verifies local save/edit/clear,
  timestamp, fixed generic author label, metadata-only history, warning-only
  privacy behavior, C2 local/test role-stub behavior, generated-suggestion
  exclusion, and export visibility boundaries. It does not authorize staging,
  production D1 access, production D1 schema observation, production migration,
  production rollback, production endpoint calls, production logs/secrets,
  production smoke tests, production proof execution, production deploy,
  customer data access/mutation, retention/privacy enforcement, real auth or
  identity, manager visibility expansion, export/API expansion, destructive
  data action, or generated suggestion persistence/history/export/attribution.
- The Manual Review Notes v1 staging target decision packet is docs-only
  planning. It defines safe non-production staging target requirements, invalid
  staging target conditions, S0-S5 target options, credential and secret
  boundaries, D1 binding rules, fixture-only data policy, command and endpoint
  boundaries, evidence distinctions, generated-suggestion exclusion checks,
  privacy/retention/access gates, and future approval blocks. It makes staging
  target selection decision-ready, but it does not select a target or authorize
  staging execution, staging D1 access, staging endpoint calls, staging
  logs/secrets, production proof, production deploy, production D1
  access/schema observation/migration/write/delete, production endpoints,
  production logs/secrets, production smoke tests, customer data, runtime/UI/
  schema/API changes, executable migration or rollback files, or generated
  suggestion persistence/history/export/attribution.
- The Manual Review Notes v1 non-production cycle closeout packet is docs-only.
  It marks the local/test cycle complete, records local/fake-D1 evidence as
  complete, leaves staging target selection decision-ready/HOLD, keeps staging
  execution and production proof/deploy on HOLD, and records no mandatory next
  action.
- The Level 1 non-production gate train through PR #184 plus the current
  post-approval decision simulator is local/test evidence
  only. `npm run check:level1` runs auth adapter/scaffold, route/UI privacy,
  generated-suggestion/manual-note, proof-preflight, approval dry-run,
  change-control manifest dry-run, operator rehearsal, closure dashboard,
  approval intake, post-approval simulator, and local artifact checks in CI
  without secrets, deploy, Wrangler, D1 bindings, endpoint calls, or production
  inputs.
- The Level 1 change-control manifest packet is local-only and
  non-executable. It writes only a redacted `NOT_PRODUCTION_EVIDENCE` dry-run
  plan, refuses unexpected manifest fields, production/staging URLs, D1 private
  identifiers or binding/id aliases, secrets/raw auth material, broad
  endpoints, destructive SQL, missing rollback ownership, stale or missing
  approval records, evidence writes, and
  `productionReady:true`, and keeps Issue #165 on HOLD.
- The Level 1 operator rehearsal gate is local-only and non-executable. It
  writes only a redacted `NOT_PRODUCTION_EVIDENCE` runbook, consumes the
  approval packet and change-control manifest, maps preflight / approval /
  manifest / rollback / privacy / evidence gates into one sequence, refuses
  accidental proof-start inputs, keeps `proofStartBlocked:true`, and keeps
  Issue #165 on HOLD.
- The Level 1 approval-intake gate is local-only and non-executable. It writes
  only redacted `NOT_PRODUCTION_EVIDENCE` JSON/Markdown artifacts and a
  machine-checkable Issue #165 request template for target, command allowlist,
  endpoint boundary, D1 boundary, fixture/non-customer data policy, evidence
  redaction, rollback owner, stop conditions, approver, and expiry. It fails
  closed for missing, vague, stale, contradictory, production-ready,
  secret-like, broad endpoint, destructive SQL, and customer-data inputs, but
  it still does not approve proof execution or production readiness.
- The Level 1 post-approval decision simulator is local-only and
  non-executable. It consumes checked-in synthetic Issue #165 packets only and
  writes only redacted `NOT_PRODUCTION_EVIDENCE` JSON/Markdown artifacts. It
  returns `HOLD`, `BLOCKED`, or `READY_FOR_SEPARATE_HUMAN_EXECUTION`; that
  final status is still not proof execution approval, not production evidence,
  and not production readiness. Production/staging deploy, D1, endpoints,
  logs/secrets, smoke tests, customer/private data, live scraping,
  CRM/outreach/LLM/automation, real auth/session/provider parsing, destructive
  SQL, and production-readiness claims remain blocked.
- PR #186's reviewer-note renderer / CLI helper refactor and audit dependency
  patch is repo-local maintenance only. It extracted shared renderer and CLI
  helper modules and patched `nodemailer`, `form-data`, `undici`, and `hasown`
  after a clean audit. It does not approve production proof, deploy, production
  D1 access/write/migration, endpoint calls, logs/secrets access, customer-data
  access/mutation, staging execution, CRM/outreach, LLM, automation, or
  production-readiness claims.
- PR #190 only synced source-of-truth docs after PR #189. PR #191 added
  local/test-safe Reviewer Workflow Intelligence v1: explicit human-entered
  `reviewerFeedback`, fixed local/test `manual_reviewer` attribution,
  metadata-only `reviewer_feedback_events`, additive
  `reviewerWorkflowSummary`, deterministic `dataGapPrioritization`, and route
  privacy coverage. It is `NOT_PRODUCTION_EVIDENCE`, keeps
  `productionReady:false`, and does not approve production/staging endpoints,
  D1 access/observation/migration/write/delete, logs/secrets, real
  auth/session/provider parsing, real reviewer identity, CRM/outreach/LLM/
  automation, retention/privacy enforcement, generated suggestion persistence/
  export/history/attribution, or production readiness.
- The current fail-closed matrix refuses malformed synthetic auth claims, mixed
  roles, auth-header / Cloudflare Access / D1 / API-key alias env poison,
  poisoned future evidence fields, bare `notes` / validation-note evidence
  body redaction, value-aware raw-input redaction, missing local D1
  metadata/index drift, stop-write-disabled rollback requests, and mutating or
  destructive rollback/SQL requests. It still does not approve production
  proof, deploy, D1 access, endpoint calls, logs/secrets, customer/private data,
  real auth/session/provider parsing, Cloudflare Access calls, rollback
  execution, destructive data action, or production readiness.

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
- CI, docs, source/config inspection, `npm run check:level1`, local fake-D1 tests, and generated evidence packets are not production evidence.
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
source-of-truth `master` baseline is `5a3c7c9cfe3068b38d8196d60aaf378adc64da14`
after PR #189 synced source-of-truth and production-boundary docs, and
`72def61e89b3c2137b13e2a3ce0bbbc58407d8ce` after PR #191 added local/test
Reviewer Workflow Intelligence v1. Any new
production action must refresh the actual current
`origin/master` SHA, CI metadata, owners, and approval records before
execution. Issue #34 closeout does not authorize further production proof work.

## Current Proof Status

| Surface | Status | Notes |
| --- | --- | --- |
| Local schema consistency | Proved locally by repo files and `npm run check:schema` | Local evidence only. Does not inspect production D1. |
| Production D1 schema remediation and schema metadata proof | Accepted in Issue #34 for prior approved SHAs only | Do not extend these approvals to current `master` without a new explicit production approval. |
| Static Worker runtime route | One raw `/manifest.json` proof accepted | Proves only the public manifest route response in that approved scope. |
| D1-backed Worker routes | Unproven in production after current train | Requires separate approval for any endpoint or D1 access. |
| Manual Review Notes v1 saved-note production use | Unproven and not approved after PR #142; docs-only production proof plan, production D1 migration plan, production rollback/backout plan, local/staging dry-run plan, local/fake-D1 dry-run evidence packet, staging target decision packet, and non-production closeout packet prepared | Requires separate approval for staging execution, staging D1 access, staging endpoint calls, staging logs/secrets, any further local/fake-D1 dry-run beyond this approved packet and ordinary docs-only PR validation, migration execution, rollback execution, destructive data action, retention/privacy, access/visibility, observability/evidence, generated suggestion exclusion, customer-data handling, legal/privacy, and production proof execution gates. |
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
- Production readiness gap packets.
- Level 1 CI/package gate results and `NOT_PRODUCTION_EVIDENCE` artifacts.
- Level 1 change-control manifest dry-run plans.
- Level 1 approval-intake request templates or validator artifacts.
- Level 1 post-approval decision simulator artifacts.
- Reviewer Workflow Intelligence v1 local/test reviewer feedback, summary, and
  data-gap prioritization artifacts.
- Source/config files.
- D1 binding names, database names, or database IDs.
- Local fake-D1 or staging observations.
- Screenshots without production deploy metadata.
- Screenshots or image-only artifacts as sole proof.
- Synthetic fixtures.
- Release evidence packets generated from local inputs.

The exact remaining Level 1 human blocker is Issue #165: a separate explicit
human production proof execution goal with exact command, endpoint, D1, fixture,
redaction, evidence, rollback, and stop-condition boundaries. The current
machine-checkable intake fields are target, command allowlist, endpoint
boundary, D1 boundary, fixture/non-customer data policy, evidence redaction,
rollback owner, stop conditions, approver, and expiry.

## Minimum Future Approval Packet

Before any next production proof, production D1 migration, or production
rollback/backout run, use
`docs/roadmap/manual-review-notes-v1-production-proof-plan.md`,
`docs/roadmap/manual-review-notes-v1-production-d1-migration-plan.md`, and
`docs/roadmap/manual-review-notes-v1-production-rollback-backout-plan.md` as
non-authorizing starting gates and prepare a new Issue #34-style execution
packet with:

- Actual current `master` SHA and CI status.
- Exact production action requested.
- Exact method/path or command.
- Deploy owner, production DB owner, rollback owner, and observation owner.
- Evidence storage location, access control, and redaction policy.
- Rollback path and stop criteria.
- No-destructive-data decision and any separately approved destructive-data
  action, if requested.
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
- The request would treat local/test `reviewerFeedback`,
  `reviewerWorkflowSummary`, `dataGapPrioritization`, or metadata-only
  `reviewer_feedback_events` as production proof.
