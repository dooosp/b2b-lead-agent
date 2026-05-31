# B2B Lead Agent Level 1 Non-Production Readiness Scorecard

This scorecard records safe non-production progress toward
`LEVEL_1_PRODUCTION_REVIEWER_WORKFLOW`.

It is local/test evidence only. It does not approve or claim production
readiness.

## Scorecard

| Gate | Status | Evidence | Boundary |
| --- | --- | --- | --- |
| Auth provider/session scaffold | `PASS` | `worker/lib/auth-provider-session-scaffold.js`; `worker/tests/auth-provider-session-scaffold.test.mjs` | Non-production scaffold only; no real auth/provider/session/token/cookie/secret/identity. |
| Local proof simulation | `PASS` | `worker/tests/level1-local-proof-simulation.test.mjs` | Fake D1 and synthetic fixtures only; no production/staging endpoints. |
| D1/schema guards | `PASS_LOCAL`, `BLOCKED_PRODUCTION` | `worker/tests/d1-schema-contract.test.mjs`; `tests/d1-schema-consistency.test.js`; `worker/lib/level1-readiness-guards.js` | Local schema guard only; production D1 observation remains HOLD. |
| Rollback/privacy guards | `PASS_LOCAL`, `BLOCKED_PRODUCTION` | `worker/tests/level1-readiness-guards.test.mjs` | Stop-write and redaction guard only; rollback execution, destructive actions, retention enforcement, purge, PII detection, and privacy proof remain HOLD. |
| Generated suggestion boundary | `PASS` | `worker/tests/manual-review-notes.test.mjs`; `worker/tests/level1-local-proof-simulation.test.mjs` | Generated suggestions remain copy-only, unsaved, unattributed, unretained, unexported, and excluded from history. |
| Manager/export/API protected-field boundary | `PASS_LOCAL`, `BLOCKED_PRODUCTION` | Scaffold and C2 tests | Managers/admin/API clients/missing/unknown roles fail closed or omit protected fields locally; real production roles remain unimplemented. |
| Local-only Worker E2E smoke | `PASS` | `npm run test:e2e:local` after `npm ci` | Fake D1 and loopback only; not production/staging smoke. |
| Final production proof approval | `HOLD` | Issue #165 records docs-planning only | No production proof execution approved. |

Overall:

```text
LEVEL_1_NON_PRODUCTION_PROGRESS: ADVANCED
PRODUCTION_REVIEWER_WORKFLOW_READY: NO
OVERALL_STATUS: BLOCKED_PENDING_SEPARATE_EXPLICIT_PRODUCTION_PROOF_GOAL
BOUNDARY: NON_PRODUCTION_ONLY
```

## Auth Gate

`AUTH_PROVIDER_SESSION_SCAFFOLD_NON_PRODUCTION` is implemented as an opt-in
local/test scaffold. It supports an injected synthetic provider interface and
normalizes roles for:

- `reviewer`;
- `manager`;
- `admin`;
- `api_client` / `api-client`;
- missing role;
- unknown role.

Only an authenticated synthetic `reviewer` session can read/write protected
manual review notes under the scaffold. All other roles fail closed or receive
payloads with protected manual note fields omitted. Scaffold metadata reports:

```text
realAuthImplemented: false
productionReady: false
```

## D1 Gate

Local schema guard coverage verifies:

- `leads.notes`;
- `manual_review_notes_updated_at`;
- `manual_review_notes_author_label`;
- `manual_review_note_events`;
- `idx_manual_review_note_events_lead`;
- no old/new note body text columns in metadata-only history.

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

No rollback command, executable migration, production D1 action, endpoint call,
deploy, repair, cleanup, or destructive action is approved or implemented.

## Privacy Gate

Local privacy guard status: `PASS_LOCAL`.

Current constraints remain:

- no manual note body history;
- no generated suggestion persistence/history/export/attribution;
- no manager/export/API expansion for protected manual note fields;
- no retention enforcement;
- no purge/delete job;
- no PII detection;
- no redaction implementation beyond local evidence-record redaction helper;
- no production privacy proof.

## Stop Conditions

Stop if any requested follow-up would require production/staging endpoint
calls, production D1 observation/read/write/migration/delete, Wrangler deploy,
logs/secrets access, customer/private data, real auth material, real reviewer
identity storage, CRM, outreach, LLM calls, automation, destructive data
action, generated suggestion persistence/export/history/attribution, or a
production readiness claim without separately approved proof evidence.
