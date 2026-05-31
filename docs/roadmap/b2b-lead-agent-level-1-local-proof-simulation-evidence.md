# B2B Lead Agent Level 1 Local Proof Simulation Evidence

This packet records local/test-only evidence for the
`LEVEL_1_PRODUCTION_REVIEWER_WORKFLOW` readiness track.

It is not production proof. It does not access production or staging D1, does
not call production or staging endpoints, does not deploy, does not read logs
or secrets, does not use customer/private data, does not touch CRM/outreach,
does not call LLMs, does not run automation, and does not claim production
reviewer workflow readiness.

Exact evidence wording for reviewers: this packet and its generated artifacts
are **not production evidence**.

## Status

- Document status:
  `LEVEL1_AUTH_ADAPTER_ROUTE_AUDIT_NON_PRODUCTION_EVIDENCE_LOCAL_ONLY`.
- Repository: `dooosp/b2b-lead-agent`.
- Branch: `codex/level1-auth-adapter-route-audit`.
- Base: `origin/master` at
  `6f5f764e2a4404157d4eb6120b44db6d173d41aa` (PR #172 merge).
- Evidence type: local fake-D1 and synthetic fixtures only.
- Production evidence captured: no.
- Production reviewer workflow ready: no, still blocked.

## Fresh Local Validation

Targeted command:

```bash
node --test worker/tests/auth-provider-session-scaffold.test.mjs worker/tests/level1-local-proof-simulation.test.mjs worker/tests/level1-readiness-guards.test.mjs worker/tests/level1-proof-preflight.test.mjs worker/tests/manual-review-notes.test.mjs worker/tests/level1-auth-route-audit.test.mjs worker/tests/d1-schema-contract.test.mjs tests/d1-schema-consistency.test.js tests/release-evidence-redaction.test.js tests/leadbrief-publication-contract.test.js
```

Result:

```text
tests 99
pass 99
fail 0
```

Additional local validation:

| Command | Result |
| --- | --- |
| `npm run proof:level1:preflight` | `PASS_LOCAL`; emitted redacted synthetic fixture evidence to stdout and `tmp/codex/level1-proof-preflight-automation-non-production-evidence.json` with `productionReady: false`, `notProductionEvidence: true`, and production proof approval `HOLD`. |
| `git diff --check` | `PASS` |
| `npm run check:naming` | `PASS` |
| `npm run check:schema` | `PASS`; local schema sources remain consistent. |
| `npm run eval:lead-quality` | `PASS`; 6 synthetic fixtures evaluated. |
| `npm test` | `PASS`; root 60, worker unit 221, contract 20. |
| `npm run test:e2e:local` | `PASS` after lockfile install with `npm ci`; 1 local-only fake-D1 Worker smoke passed. |

The first `npm run test:e2e:local` attempt in this fresh worktree failed
before test execution because the local `playwright` package was not installed.
After `npm ci`, the same local-only E2E command passed. This is environment
setup evidence only, not a production proof.

## Covered Local Behaviors

| Area | Local result | Evidence boundary |
| --- | --- | --- |
| Auth provider/session scaffold | `PASS` | Opt-in `AUTH_PROVIDER_SESSION_SCAFFOLD_NON_PRODUCTION`; injected synthetic provider only; no real provider, token, cookie, secret, session store, or identity. |
| Provider-agnostic auth adapter contract | `PASS` | `level1.local_test_auth_adapter.v1`; injected local/test adapter only; no header/token/cookie/JWT/session/provider parsing. |
| Role/claim resolver | `PASS` | `reviewer`, `manager`, `admin`, `api_client`, `api-client`, `api`, missing, unknown, unauthenticated, expired, missing-audience, wrong-audience, missing provider, invalid provider, provider-error, and non-local env cases tested locally. |
| Local proof preflight runner | `PASS_LOCAL` | Refuses production/staging URLs, non-local hostnames, D1 bindings/private IDs, secrets, real provider inputs, and non-local/prod/staging/preview envs; emits only redacted synthetic fixture evidence. |
| C2 role stub preservation | `PASS` | Existing `MANUAL_REVIEW_NOTES_LOCAL_TEST_ROLE_STUB` behavior remains covered; metadata still reports `realAuthImplemented: false` and `productionReady: false`. |
| `/leads` | `PASS` | Page route returns local reviewer workflow shell using synthetic/fake-D1 test context only; denied synthetic roles receive the shell without generated review guidance code/labels. |
| `/api/leads` queue | `PASS` | Reviewer Action Queue metadata is present from fake-D1 fixture data; generated note suggestion remains helper output, not saved lead data. |
| Route audit matrix | `PASS` | `/api/leads`, `/api/history`, `/api/export/csv`, `/api/leads/:id/enrich`, `/api/leads/:id` PATCH, `/leads`, and `/leads/:id` fail closed for denied synthetic roles and provider-error cases. |
| Lead detail | `PASS` | Authenticated local reviewer request renders the synthetic lead detail, manual note fixture, and generated review guidance; denied manager/admin/API/missing/unknown/expired/missing-audience/wrong-audience/provider-error cases omit protected note bodies and generated review guidance locally. No production route call. |
| Manual note write boundary | `PASS` | Reviewer scaffold may save human-entered local notes; manager/admin/API/missing/unknown roles fail closed. |
| Generated suggestion exclusion | `PASS` | Generated suggestion persistence attempts are rejected atomically and do not write note text, timestamp, author label, history, or export fields. |
| D1 schema guard | `PASS` | Local schema sources and fake-D1 DDL cover manual note columns, metadata-only event table/index, index drift checks, and event constraint checks. |
| D1 observation metadata guard | `PASS` | Future observation metadata is limited to table/column/index metadata fields; row data, row counts, IDs, auth material, note text, and generated suggestion text are forbidden. |
| Rollback guard | `PASS` | Local stop-write guard blocks manual note create/edit/clear and generated-suggestion-bundled manual writes while preserving existing data. It remains non-destructive-first, redacted-evidence-only, and requires owner approval for rollback execution. |
| Privacy guard | `PASS` | Recursive redaction guard removes forbidden evidence fields; no note body history, generated suggestion history/export/attribution, denied-role route payload leak, publication snapshot/history leak, purge, retention enforcement, or PII detection is implemented. |

## Explicit Non-Claims

- This is not production proof.
- This is not production evidence.
- This is not production D1 schema observation.
- This is not production auth/session/provider validation.
- This is not production access-control proof.
- This is not privacy/legal compliance proof.
- This is not rollback execution proof.
- This is not final proof approval.
- This does not approve production deploy, D1 access, endpoint calls, logs,
  secrets, customer/private data, CRM, outreach, LLM calls, automation,
  destructive data action, generated suggestion persistence, generated
  suggestion export, generated suggestion history, or generated suggestion
  attribution.

## Next Boundary

`LEVEL_1_PRODUCTION_REVIEWER_WORKFLOW` remains blocked until a separate
explicit future goal approves any production proof, production D1 observation,
production endpoint call, deploy, logs/secrets access, customer/private data
access, or production evidence capture.
