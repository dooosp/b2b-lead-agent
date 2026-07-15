# Lead PATCH CAS and job callback concurrency contract

Status: local/test implementation contract. This is not production evidence and
does not change Issue #165, staging, deployment, production D1, endpoint,
logs/secrets, customer-data, CRM, outreach, or external-callback approval.

## Lead concurrency token

The selected public token is `version`, backed by
`leads.version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)`.

Alternatives considered:

- `updated_at` was rejected because wall-clock values can collide within one
  millisecond, move backwards, or change for unrelated enrichment work.
- An integer version is monotonic, serialization-safe, and independent of
  timestamp formatting.
- A content hash was rejected because PATCH mutates several protected and
  separately stored fields; exposing or recomputing that hash would couple the
  API token to private data and canonicalization details.

`version` is system-owned. It is exposed on mutable lead representations, is
never accepted as a writable field, starts at `1` for existing and new rows,
and increments exactly once for each accepted update to an existing lead row.
That includes non-no-op Lead PATCH, enrichment, and generated/cache refresh
writes, so a browser token becomes stale after any intervening row mutation.
Rejected, invalid, unauthorized, conflicting, and matching no-op PATCH
requests do not change it.

## HTTP precondition

The canonical precondition is JSON `expectedVersion`. `If-Match` was considered
but not selected: every current caller already sends JSON, the Worker does not
otherwise emit ETags, and a new request header would expand the CORS contract.
There is intentionally no optional compatibility mode that permits an omitted
precondition.

- Missing: `428`, `LEAD_VERSION_REQUIRED`.
- Malformed, non-positive, non-integer, or an attempted writable `version`:
  `400`, `LEAD_VERSION_INVALID`.
- Stale: `409`, `LEAD_VERSION_CONFLICT`, with only the current numeric version.
- Accepted mutation: `200` with the incremented version.
- Matching no-op: `200` without incrementing.
- Stale no-op: `409`.

Protected note and reviewer-feedback fields are never returned in a conflict
body. Protected-field authorization runs before precondition errors so a caller
cannot use version validation to bypass existing role boundaries.

## Lead mutation atomicity

The selected implementation is a transactional D1 batch with a bounded winner
marker on the lead row:

1. A conditional update matches `(id, expectedVersion)`, increments `version`,
   and writes a unique internal `last_patch_mutation_id`.
2. Every status-log, manual-note event, reviewer-feedback write/delete, and
   reviewer-feedback event uses conditional SQL that can run only when the row
   still carries that mutation id.
3. D1 executes the statements sequentially in one transaction; any side-effect
   failure rolls back the lead update as well.
4. The first statement's affected-row count distinguishes acceptance from a
   typed conflict.

Alternatives rejected:

- Conditional update followed by application-side inserts has crash and
  interleaving windows.
- Gating effects only on `version = expectedVersion + 1` lets a stale loser
  claim the winner's version and duplicate its effects.
- A permanent mutation-record table is correct but grows without bound even
  though PATCH has no client mutation id to reuse.
- Triggers provide useful OLD/NEW values for lead fields but do not cleanly
  cover the separate reviewer-feedback table, and the canonical schema
  deliberately rejects undeclared triggers.

The matching no-op uses a conditional no-op update as its linearization point.
It verifies the version without changing the version or writing side effects.

## Callback event identity and ordering

Trigger-request idempotency remains `job_runs.idempotency_key`. Callback-event
idempotency is separate and mandatory through callback `Idempotency-Key`.
Normalized callback fields are serialized in a fixed key order and SHA-256
hashed; raw callback bodies are not stored.

`job_callback_events` stores an internal event id, logical request id, callback
key, payload hash, target, provider attempt, state, applied/rejected outcome,
and receipt timestamp. A unique `(request_id, idempotency_key)` constraint
provides event-level replay protection for both accepted and rejected events.

- Same key and same normalized payload: the original applied/rejected decision
  is replayed without another job mutation; applied events return `200`,
  `replayed`, while rejected events remain the same typed `409` rejection.
- Same key and different normalized payload: `409`,
  `JOB_CALLBACK_IDEMPOTENCY_MISMATCH`.
- Missing/invalid callback key: typed `428`/`400` without mutation.

Each active job stores `provider_attempt` and `last_callback_event_id`. A
transactional callback batch conditionally updates the job and then inserts one
payload-identity event. The stored outcome is `applied` only when the job carries
that event id; stale or non-monotonic callbacks store `rejected` without changing
the job. The update also refuses any key already present, closing concurrent
same-key/different-payload races. An event insert failure rolls back an applied
job update.

Ordering is terminal-absorbing for one logical `request_id`:

- While active, a higher provider attempt supersedes a lower active attempt.
- Within one attempt: `accepted -> running|terminal` and
  `running -> terminal` are allowed.
- Same-state callbacks with a new key are rejected; exact repeats use the
  idempotency record.
- Any terminal state rejects later mutations, including callbacks from a
  higher attempt. A rerun that should become independently observable needs a
  new logical trigger request rather than silently reopening a terminal row.

GitHub identity requires a positive safe `githubRunId` and
`githubRunAttempt`; the latter is the provider attempt. Cloud Run identity
requires `cloudRunExecution` and an explicit positive safe `providerAttempt`.
Provider identity is immutable within one provider attempt. A higher active
attempt may replace the prior run/execution correlation metadata; the same
attempt cannot silently switch to another GitHub run id or Cloud Run execution.
This preserves target compatibility without treating unrelated identities as
the same ordered attempt.

Non-callback state changes such as dispatch failure and stale-active retirement
remain separate from the callback event ledger but use a conditional state
update so they cannot overwrite a concurrently committed state.

## Migration and proof boundary

Schema v3 is additive and ledger-last. It adds lead version/winner columns,
job provider-attempt/event-marker columns, and the callback-event table. The
deployed v1/v2 statement arrays and fingerprints remain immutable; current
canonical definitions are distinct from those historical migration payloads.

Fresh schema, exact v2 upgrade, legacy upgrade, exact partial-v3 adoption,
malformed partial rejection, transaction rollback, fake-D1 behavior, and real
local SQLite behavior are all executable test targets. Request handlers remain
read-only with respect to DDL.

Rolling code back from a database whose ledger records v3 to code that knows
only v2 fails closed by design. No destructive down-migration is included or
approved; code rollback requires retaining v3-aware schema readiness.
