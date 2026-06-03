# B2B Lead Agent Level 1 Non-Production Readiness Scorecard

This scorecard records safe non-production progress toward
`LEVEL_1_PRODUCTION_REVIEWER_WORKFLOW`.

It is local/test evidence only. It does not approve or claim production
readiness.

Exact evidence wording for reviewers: all artifacts in this packet are **not
production evidence**. They are local-only, fake-D1/synthetic-fixture,
redacted proof-preflight evidence.

## Scorecard

| Gate | Status | Evidence | Boundary |
| --- | --- | --- | --- |
| Provider-agnostic auth adapter contract | `PASS` | `worker/lib/local-test-auth-adapter.js`; `worker/tests/local-test-auth-adapter.test.mjs` | Injected local/test adapter only; no real provider, header, token, cookie, JWT, session, identity, or Cloudflare Access parsing. Malformed role/audience claim shapes, arrays, mixed roles, missing role, wrong audience, expired claims, and provider errors fail closed. |
| Auth provider/session scaffold | `PASS` | `worker/lib/auth-provider-session-scaffold.js`; `worker/tests/auth-provider-session-scaffold.test.mjs` | Non-production scaffold only; no real auth/provider/session/token/cookie/secret/identity. Fails closed for non-local envs, malformed synthetic claim payloads, malformed role/audience arrays, and mixed roles. |
| Local proof-preflight automation | `PASS_LOCAL`, `HOLD_PRODUCTION` | `scripts/level1-proof-preflight.mjs`; `worker/tests/level1-proof-preflight.test.mjs`; `npm run proof:level1:preflight` | Emits redacted synthetic fixture evidence only and refuses non-local/prod/staging/preview envs, production/staging URLs, non-local hostnames, D1 bindings/private IDs including alias keys, secrets, auth-header env values, API-key aliases, Cloudflare Access credential-shaped values, and real provider inputs. This is not production evidence. |
| Local proof simulation | `PASS` | `worker/tests/level1-local-proof-simulation.test.mjs` | Fake D1 and synthetic fixtures only; no production/staging endpoints. |
| D1/schema guards | `PASS_LOCAL`, `BLOCKED_PRODUCTION` | `worker/tests/d1-schema-contract.test.mjs`; `tests/d1-schema-consistency.test.js`; `worker/lib/level1-readiness-guards.js` | Local schema/index/constraint guard only; missing manual-note columns or index drift return `HOLD` with missing keys. Production D1 observation remains HOLD. |
| Rollback/privacy guards | `PASS_LOCAL`, `BLOCKED_PRODUCTION` | `worker/tests/level1-readiness-guards.test.mjs`; `worker/tests/manual-review-notes.test.mjs` | Stop-write and redaction guard only; stop-write-disabled rollback requests, mutating SQL requests, and destructive rollback SQL/action requests return `HOLD`. Rollback execution, destructive actions, retention enforcement, purge, PII detection, and privacy proof remain HOLD. |
| Generated suggestion boundary | `PASS` | `worker/tests/manual-review-notes.test.mjs`; `worker/tests/level1-local-proof-simulation.test.mjs` | Generated suggestions remain copy-only, unsaved, unattributed, unretained, unexported, and excluded from history. |
| Route audit protected-field boundary | `PASS_LOCAL`, `BLOCKED_PRODUCTION` | `worker/lib/level1-auth-route-audit.js`; `worker/tests/level1-auth-route-audit.test.mjs` | Managers/admin/API clients/API aliases/missing/unknown/expired/wrong-audience/malformed-claim/provider-error cases fail closed or omit protected fields locally across reviewer queue, history, export, batch enrich, enrich success/error, note write, non-manual PATCH response, `/leads`, and detail routes. Real production roles remain unimplemented. |
| Publication and evidence redaction boundary | `PASS_LOCAL`, `BLOCKED_PRODUCTION` | `lead-report-publisher.js`; `tests/leadbrief-publication-contract.test.js`; `scripts/release-evidence-redactor.js`; `tests/release-evidence-redaction.test.js`; `tests/release-evidence-packet.test.js` | Published latest/history snapshots and evidence packets omit or redact manual note bodies, bare `notes` fallback bodies, manual-note aliases, generated suggestions/templates, protected note metadata, provider/raw auth inputs, tokens, cookies, private identifiers, and secret-shaped fields. |
| Final approval packet | `PASS_LOCAL`, `HOLD_PRODUCTION` | `docs/roadmap/b2b-lead-agent-level-1-production-proof-approval-packet-non-production.md` | Final non-production packet is prepared with prerequisites, owner checklist, rollback owner, stop-write trigger, evidence requirements, abort conditions, and exact future approval fields. It is not production evidence and does not approve execution. |
| Future evidence schema | `PASS_LOCAL`, `HOLD_PRODUCTION` | `worker/lib/level1-readiness-guards.js`; `worker/tests/level1-production-proof-approval.test.mjs` | Future evidence schema requires timestamps, boundary labels, required fields, `productionReady:false`, `notProductionEvidence:true`, and forbidden-field rejection for manual-note aliases, generated-guidance, provider, raw auth/session, D1, secret, destructive-approval, rollback-execution, and customer/private fields. Dry-run raw inputs also receive value-aware redaction when secret/manual-note text is hidden under benign keys. |
| Approval packet dry-run operator | `PASS_LOCAL`, `HOLD_PRODUCTION` | `scripts/level1-production-proof-approval-dry-run.mjs`; `worker/tests/level1-production-proof-approval.test.mjs`; `npm run proof:level1:approval-dry-run` | Local-only dry-run validates packet completeness and refuses production/staging URLs, D1 bindings/private IDs including alias keys, secrets, tokens, auth material, auth-header env values, API-key aliases, Cloudflare Access credential-shaped values, provider inputs, case-variant forbidden packet fields, destructive/mutating SQL/action text, real endpoints, and non-local env values. It does not call endpoints. |
| Change-control manifest gate | `PASS_LOCAL`, `HOLD_PRODUCTION` | `docs/roadmap/b2b-lead-agent-level-1-production-proof-change-control-manifest-non-production.json`; `docs/roadmap/b2b-lead-agent-level-1-production-proof-change-control-manifest.schema.json`; `scripts/level1-production-proof-change-control-manifest.mjs`; `worker/tests/level1-production-proof-change-control-manifest.test.mjs`; `npm run proof:level1:change-control-manifest` | Local-only manifest linter/planner refuses unexpected manifest fields, production/staging URLs, D1 private identifiers or binding/id aliases, secrets/tokens/raw auth fields, broad endpoints, destructive SQL, missing rollback owner/stop-write trigger, stale or missing approval records, evidence writes, and `productionReady:true`. It emits only a redacted `NOT_PRODUCTION_EVIDENCE` non-executable dry-run plan and keeps Issue #165 on HOLD. |
| Operator rehearsal gate | `PASS_LOCAL`, `HOLD_PRODUCTION` | `docs/roadmap/b2b-lead-agent-level-1-operator-rehearsal-gate-non-production.md`; `scripts/level1-operator-rehearsal.mjs`; `worker/tests/level1-operator-rehearsal.test.mjs`; `npm run proof:level1:operator-rehearsal` | Local-only end-to-end rehearsal consumes the approval packet and change-control manifest, validates preflight/approval/manifest/rollback/privacy/evidence gates, emits a redacted non-executable runbook, refuses unsafe proof-start inputs, and keeps `proofStartBlocked:true`, `productionReady:false`, and Issue #165 on HOLD. |
| Closure dashboard gate | `PASS_LOCAL`, `HOLD_PRODUCTION` | `scripts/level1-readiness-closure-dashboard.mjs`; `worker/tests/level1-readiness-closure-dashboard.test.mjs`; `tmp/codex/level1-readiness-closure-dashboard-non-production.json`; `docs/roadmap/b2b-lead-agent-level-1-readiness-closure-dashboard-non-production.md`; `npm run proof:level1:closure-dashboard` | Local-only dashboard inventories PR #171-#183 gates, commands, artifacts, issue map, risks, future production-proof prerequisites, and exact Issue #165 intake fields. It validates required gates, refuses missing gates and `productionReady:true`, emits `NOT_PRODUCTION_EVIDENCE`, and keeps Issue #165 on HOLD. |
| Approval intake gate | `PASS_LOCAL`, `HOLD_PRODUCTION` | `scripts/level1-production-proof-approval-intake-gate.mjs`; `worker/tests/level1-production-proof-approval-intake-gate.test.mjs`; `tmp/codex/level1-production-proof-approval-intake-gate-non-production.json`; `docs/roadmap/b2b-lead-agent-level-1-production-proof-approval-intake-template-non-production.json`; `docs/roadmap/b2b-lead-agent-level-1-production-proof-approval-intake-gate-non-production.md`; `npm run proof:level1:approval-intake` | Local-only Issue #165 intake template/validator requires target, command allowlist, endpoint boundary, D1 boundary, fixture/non-customer data policy, evidence redaction, rollback owner, stop conditions, approver, and expiry. It fails closed for missing, vague, stale, contradictory, production-ready, secret-like, broad endpoint, destructive SQL, and customer-data inputs while keeping proof execution unapproved. |
| Level 1 package/CI regression gate | `PASS_LOCAL`, `HOLD_PRODUCTION` | `package.json`; `.github/workflows/ci.yml`; `worker/tests/workflow-contract.test.mjs`; `npm run check:level1` | Durable local-only package gate runs Level 1 auth adapter/scaffold, route/privacy, proof-preflight, approval dry-run, change-control manifest dry-run, operator rehearsal, closure dashboard, approval intake, release-evidence redaction, artifact redaction, and generated-suggestion/manual-note boundary coverage. CI runs it without secrets, deploy, Wrangler, D1 bindings, endpoint calls, or production inputs. |
| Local-only Worker E2E smoke | `PASS` | `npm run test:e2e:local` after `npm ci` | Fake D1 and loopback only; not production/staging smoke. |
| Final production proof approval | `HOLD` | Issue #165 records docs-planning only | No production proof execution approved. |

Overall:

```text
LEVEL_1_NON_PRODUCTION_PROGRESS: ADVANCED
PRODUCTION_REVIEWER_WORKFLOW_READY: NO
OVERALL_STATUS: BLOCKED_PENDING_SEPARATE_EXPLICIT_PRODUCTION_PROOF_GOAL
BOUNDARY: NON_PRODUCTION_ONLY
NEXT_HUMAN_APPROVAL_NEEDED: SEPARATE_EXPLICIT_FUTURE_PRODUCTION_PROOF_GOAL_WITH_EXACT_BOUNDARIES
```

## Auth Gate

`AUTH_PROVIDER_SESSION_SCAFFOLD_NON_PRODUCTION` is implemented as an opt-in
local/test scaffold. It supports an injected synthetic provider interface and
normalizes roles for:

- `reviewer`;
- `manager`;
- `admin`;
- `api_client` / `api-client`;
- `api`;
- missing role;
- unknown role;
- mixed roles and malformed role arrays;
- expired synthetic claim;
- missing synthetic audience;
- wrong synthetic audience;
- malformed synthetic audience arrays;
- provider error;
- missing or invalid synthetic provider.

Only an authenticated synthetic `reviewer` session can read/write protected
manual review notes under the scaffold. All other roles fail closed or receive
payloads with protected manual note fields omitted. Scaffold metadata reports:

```text
realAuthImplemented: false
productionReady: false
```

The scaffold blocks non-local `WORKER_ENV` / deployment environment values
such as `production`, `staging`, and `preview`. It does not parse real
headers, tokens, cookies, JWTs, or provider sessions.

## Auth Adapter Route Audit

`LEVEL1_AUTH_ADAPTER_ROUTE_AUDIT_NON_PRODUCTION` adds a provider-agnostic
local/test adapter contract and route audit manifest. The contract lives at
`worker/lib/local-test-auth-adapter.js`, records
`level1.local_test_auth_adapter.v1`, and is explicitly limited to injected
local/test adapters. It does not parse request auth headers, cookies, tokens,
JWTs, real sessions, provider responses, or Cloudflare Access material.

The route audit covers:

- `/api/leads` reviewer queue payloads;
- `/api/history`;
- `/api/export/csv`;
- `/api/leads/batch-enrich`;
- `/api/leads/:id/enrich`;
- `/api/leads/:id` manual-note writes;
- `/api/leads/:id` non-manual PATCH responses;
- `/leads` reviewer queue page rendering;
- `/leads/:id` detail rendering.

Protected manual note fields and generated suggestion/template text are denied
or omitted for non-reviewer synthetic roles and provider-error cases. CSV
export, publication snapshots/history, and evidence artifacts do not carry
manual note bodies or generated suggestion text.

## Proof-Preflight Automation

Local command:

```bash
npm run proof:level1:preflight
```

Runner and reviewer artifact surfaces:

- `scripts/level1-proof-preflight.mjs`;
- `worker/tests/level1-proof-preflight.test.mjs`;
- `tmp/codex/level1-proof-preflight-automation-non-production-evidence.json`;
- `tmp/codex/level1-proof-preflight-automation-non-production-preflight.json`.

The runner writes the redacted evidence JSON artifact above and returns
`boundary: NOT_PRODUCTION_EVIDENCE`, `productionReady: false`,
`notProductionEvidence: true`, and a
`production_proof_approval` gate of `HOLD`. It redacts synthetic manual note
body text, generated suggestion text, tokens, cookies, auth headers,
customer/private fields, and nested secret-shaped fields before evidence is
emitted.

## Approval Packet Dry-Run

Local command:

```bash
npm run proof:level1:approval-dry-run
```

Runner and reviewer artifact surfaces:

- `scripts/level1-production-proof-approval-dry-run.mjs`;
- `worker/lib/level1-readiness-guards.js`;
- `worker/tests/level1-production-proof-approval.test.mjs`;
- `docs/roadmap/b2b-lead-agent-level-1-production-proof-approval-packet-non-production.md`;
- `tmp/codex/level1-production-proof-approval-dry-run-non-production-evidence.json`.

The dry-run validates the approval packet, future evidence schema, and local
input boundary. It refuses production/staging URLs, non-local hostnames, D1
bindings, private identifiers, secrets, tokens, cookies, auth headers,
provider inputs, and non-local environment values. It does not call endpoints
and it keeps `boundary: NOT_PRODUCTION_EVIDENCE`, `productionReady: false`,
`notProductionEvidence: true`, and production proof approval on `HOLD`.

## Change-Control Manifest Gate

Local command:

```bash
npm run proof:level1:change-control-manifest
```

Runner and reviewer artifact surfaces:

- `docs/roadmap/b2b-lead-agent-level-1-production-proof-change-control-manifest-non-production.md`;
- `docs/roadmap/b2b-lead-agent-level-1-production-proof-change-control-manifest-non-production.json`;
- `docs/roadmap/b2b-lead-agent-level-1-production-proof-change-control-manifest.schema.json`;
- `scripts/level1-production-proof-change-control-manifest.mjs`;
- `worker/tests/level1-production-proof-change-control-manifest.test.mjs`;
- `tmp/codex/level1-production-proof-change-control-manifest-non-production-plan.json`.

The manifest gate is a local-only approval/change-control completeness check
for a future separately approved proof goal. It refuses production/staging
endpoint-shaped values, broad endpoints, D1 private identifiers or D1
binding/id aliases, secrets, tokens, raw auth/session/provider fields,
destructive or mutating SQL/action text, missing rollback owner or stop-write
trigger, stale or missing approval records, evidence writes, and
`productionReady:true`.

The generated plan is labeled `NOT_PRODUCTION_EVIDENCE`, marks every step
`REVIEW_ONLY_DO_NOT_EXECUTE`, keeps `productionReady:false`, and keeps
`production_proof_approval` on `HOLD`. It does not call endpoints, inspect D1,
run shell/Wrangler/curl/deploy/smoke commands, parse real auth, touch
Cloudflare Access, use customer/private data, or claim production readiness.

## Operator Rehearsal Gate

Local command:

```bash
npm run proof:level1:operator-rehearsal
```

Runner and reviewer artifact surfaces:

- `docs/roadmap/b2b-lead-agent-level-1-operator-rehearsal-gate-non-production.md`;
- `scripts/level1-operator-rehearsal.mjs`;
- `worker/tests/level1-operator-rehearsal.test.mjs`;
- `tmp/codex/level1-operator-rehearsal-non-production-runbook.json`.

The rehearsal reads only checked-in non-production source artifacts and local
synthetic inputs. It maps proof preflight, approval dry-run, change-control
manifest, rollback / stop-write, privacy/redaction, future evidence schema, and
the final proof approval HOLD into one ordered runbook. The runbook is labeled
`NOT_PRODUCTION_EVIDENCE`, marks every step `REVIEW_ONLY_DO_NOT_EXECUTE`, keeps
`proofStartBlocked:true`, and keeps `productionReady:false` /
`productionReviewerWorkflowReady:false`.

Safety matrix coverage refuses missing approval, stale approval, production or
staging URL values, D1 binding/id values, secret/token/raw-auth values,
destructive SQL, broad endpoints, `productionReady:true`, and missing rollback
owner. The rehearsal does not execute commands, call endpoints, inspect D1,
read logs/secrets, parse real auth material, touch Cloudflare Access, use
customer/private data, or claim production readiness.

## Package And CI Gate

Local command:

```bash
npm run check:level1
```

This gate runs only local/test and synthetic fixture coverage:

- provider-agnostic local auth adapter and scaffold tests;
- Level 1 readiness/redaction/D1 metadata guards;
- fake-D1 local proof simulation;
- protected route/UI/API privacy audit for `/leads`, `/leads/:id`,
  queue/history/export/batch-enrich/enrich/PATCH responses;
- generated-suggestion/manual-note persistence and export privacy tests;
- release evidence redaction tests for manual-note/generated-guidance aliases
  and bare `notes` fallback bodies;
- proof-preflight tests and local artifact writer;
- approval-packet dry-run tests and local artifact writer;
- change-control manifest tests and local non-executable plan writer;
- operator rehearsal tests and local non-executable runbook writer;
- closure dashboard tests and local JSON/Markdown artifact writer;
- approval-intake template/validator tests and local JSON/Markdown artifact writer.

CI runs the same package gate in `.github/workflows/ci.yml` after schema and
synthetic lead-quality checks and before `npm test`. The gate does not use
secrets, Wrangler, deploy, production/staging endpoints, D1 bindings,
Cloudflare Access, real JWT/cookie/token/session/provider parsing,
customer/private data, CRM, outreach, LLM, or automation.

## D1 Gate

Local schema guard coverage verifies:

- `leads.notes`;
- `manual_review_notes_updated_at`;
- `manual_review_notes_author_label`;
- `manual_review_note_events`;
- `idx_manual_review_note_events_lead`;
- fake-D1 enforcement of metadata-only event type and author-label checks;
- no old/new note body text columns in metadata-only history.
- missing required manual-note metadata columns or
  `idx_manual_review_note_events_lead` index drift returns `HOLD` and records
  `missingRecordKeys`.

Future production D1 observation remains blocked. The only metadata fields
allowed by the local guard for a future separately approved observation are:

```text
tableName
columnName
columnType
notNull
defaultValue
primaryKey
indexName
unique
origin
partial
```

Row data, row counts, customer data, database/account IDs, auth material, logs,
manual note body text, generated suggestion text, private URLs, and secrets are
forbidden.

## Rollback Gate

Local rollback guard status: `PASS_LOCAL`.

Policy encoded by the guard:

- stop writes first;
- prefer non-destructive backout first;
- preserve existing data;
- preserve only redacted non-secret evidence;
- require owner approval before rollback execution;
- require separate approval before any destructive data action.

`LEVEL1_MANUAL_REVIEW_NOTES_STOP_WRITE=enabled` is a local/test stop-write
guard for manual note writes. It blocks create/edit/clear and generated
suggestion-bundled manual writes with existing note/event rows preserved.
It is not rollback execution and does not run cleanup, repair, migration, or
production commands.

`evaluateLevel1RollbackGate()` is a local-only guard evaluator. It returns
`HOLD` when stop-write is not enabled or when a rollback request includes
destructive or mutating action text such as drop/delete/truncate/purge/update.
It does not execute
rollback, cleanup, repair, migration, D1 access, endpoint calls, deploy, or
destructive data action.

No rollback command, executable migration, production D1 action, endpoint call,
deploy, repair, cleanup, or destructive action is approved or implemented.

## Privacy Gate

Local privacy guard status: `PASS_LOCAL`.

Current constraints remain:

- no manual note body history;
- no generated suggestion persistence/history/export/attribution;
- no provider/raw auth input publication, history retention, or evidence
  capture;
- no manager/export/API/detail expansion for protected manual note fields;
- no retention enforcement;
- no purge/delete job;
- no PII detection;
- no redaction implementation beyond local evidence-record redaction helper;
- no production privacy proof.

Additional approval-packet constraints:

- manual note body, generated suggestion/template/guidance, provider input, raw
  session claim, auth material, D1/private identifier, and customer/private
  fields are forbidden in approval-packet evidence;
- packet text rejects field-shaped protected payloads such as
  `manualReviewNotes:`, `generatedSuggestionText:`, `providerInput:`, and
  `rawSessionClaims:`;
- future proof evidence must include `NOT_PRODUCTION_EVIDENCE`,
  `productionReady: false`, and `productionReviewerWorkflowReady: false`.

## Stop Conditions

Stop if any requested follow-up would require production/staging endpoint
calls, production D1 observation/read/write/migration/delete, Wrangler deploy,
logs/secrets access, customer/private data, real auth material, real reviewer
identity storage, CRM, outreach, LLM calls, automation, destructive data
action, generated suggestion persistence/export/history/attribution, or a
production readiness claim without separately approved proof evidence.
