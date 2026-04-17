# Internal API Contract Freeze

## Purpose

Freeze the CRM-facing read-only contract for the exact latest published report that the repository can prove safely today.

- This document is the downstream CRM reference for the published-report response body.
- It freezes only semantics supported by repo-local code, artifacts, and tests.
- It does not freeze report identifiers, route naming variants, or storage-specific implementation details.

## Repo Evidence Used

- `lead-report-publisher.js` writes the canonical published artifacts to `reports/<profile>/latest-leads.json` and `reports/<profile>/lead-history.json`.
- `prepareLeadSnapshotRecords()` proves the published snapshot lead shape includes `id`, `status`, `createdAt`, `updatedAt`, and normalized `sources`.
- `normalizePublicationSources()` and `tests/source-traceability.test.js` prove optional source provenance fields are preserved when present in the published snapshot.
- `worker/api/leads.js` proves profile/product canonicalization happens at read time, but its D1-first path is a mutable cache and therefore is not authoritative published-snapshot evidence for this CRM contract.
- `worker/db/job-runs.js`, `worker/lib/job-trigger.js`, and `worker/tests/trigger-handler.test.mjs` prove `accepted` and `running` are explicit active states that can justify `queued` readiness when no finalized published snapshot is available.

## Scope Boundary

This freeze is for one exact managed `profileId` and its latest canonical published snapshot only.

- The contract is profile-scoped, not report-id scoped.
- The contract is latest-only, not history-scoped.
- The contract must not expose D1 vs GitHub source-selection details.
- The contract must not guess route-type, report-id, acceptance-state, or artifact-version semantics that the repository does not encode authoritatively.

## Frozen Contract

### Resource Meaning

A "canonical published report" is the latest finalized `reports/<profile>/latest-leads.json` snapshot for one exact managed profile, mapped into a CRM-safe read-only body.

- The payload represents the latest published snapshot only.
- The payload must be derived from the immutable published artifact, not from mutable D1 lead-cache rows.
- If the latest artifact exists but the finalized CRM-safe shape cannot be proved from that artifact, return `409 not_finalized` instead of guessing.

### Success Body: `HTTP 200`

Return `200` only when the latest published snapshot exists and satisfies the frozen body shape below without inferred fields.

Required top-level fields:

| Field | Type | Meaning |
| --- | --- | --- |
| `schemaVersion` | string | Exact contract version. Freeze as `"crm.published-report.v1"`. |
| `profileId` | string | Exact requested managed profile id. No default-profile fallback. |
| `syncReady` | boolean | Must be `true` for `200`. |
| `publishedAt` | string | Finalized snapshot timestamp proved from one uniform latest-snapshot lead timestamp (`createdAt` or `updatedAt`). |
| `leadCount` | integer | Count of canonical leads in `leads`. Must equal `leads.length`. |
| `leads` | array | Canonical published leads for CRM consumption. |

Required lead fields:

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string | Stable published lead id from the canonical snapshot. |
| `status` | string | Published lead lifecycle status. |
| `createdAt` | string | Published lead creation timestamp from the canonical snapshot. |
| `updatedAt` | string | Published lead update timestamp from the canonical snapshot. |
| `company` | string | Canonical company name from the published lead record. |
| `summary` | string | Canonical opportunity summary from the published lead record. |
| `product` | string | Canonical product after the existing managed-profile read-time canonicalization. |
| `score` | number | Published lead score. |
| `grade` | string | Published lead grade. |
| `roi` | string | Published ROI summary. |
| `salesPitch` | string | Published sales pitch text. |
| `globalContext` | string | Published external context text. |
| `sources` | array | Published source list for the lead. |

Required source fields:

| Field | Type | Meaning |
| --- | --- | --- |
| `title` | string | Published source title. |
| `url` | string | Published source URL. |

Optional source provenance fields when present in the published snapshot:

- `sourceId`
- `source`
- `query`
- `publishedAt`
- `originUrl`
- `resolution`
- `contentAvailable`

Notes:

- `leads` order is snapshot order only. CRM must not infer rank or workflow semantics from array position.
- The external contract must not include mutable-cache or storage hints such as `source: "d1"` or `source: "github"`.

### Not Found: `HTTP 404`

Return `404` only when the exact managed profile does not resolve to a canonical latest published snapshot and there is no explicit queued run to report instead.

- Unknown managed profile id: `404`
- Known managed profile id with no latest published snapshot and no active queued/running job: `404`
- Do not silently resolve an unknown profile to the default profile.

Required error body fields:

| Field | Type | Meaning |
| --- | --- | --- |
| `schemaVersion` | string | Exact contract version: `"crm.published-report.v1"` |
| `profileId` | string | Requested profile id verbatim |
| `syncReady` | boolean | Must be `false` |
| `error.code` | string | Freeze as `"report_not_found"` |
| `error.message` | string | Human-readable not-found message |

### Not Ready: `HTTP 409`

Return `409` only when the repository can prove that the CRM contract should not surface `200` yet.

Frozen machine-readable readiness reasons:

- `queued` — an explicit `accepted` or `running` job exists for the exact profile, and no finalized latest published snapshot is available yet
- `not_finalized` — the latest published artifact exists, but the finalized CRM-safe shape cannot be proved without guessing

Required error body fields:

| Field | Type | Meaning |
| --- | --- | --- |
| `schemaVersion` | string | Exact contract version: `"crm.published-report.v1"` |
| `profileId` | string | Requested profile id |
| `syncReady` | boolean | Must be `false` |
| `readiness.reason` | string | One of the frozen not-ready reasons above |
| `error.code` | string | Freeze as `"report_not_ready"` |
| `error.message` | string | Human-readable not-ready message |

### Operational Error: `HTTP 503`

Return `503` when the repository cannot verify readiness safely because a required internal dependency or auth configuration is unavailable.

- Missing `API_TOKEN` for `/api/internal/*`: `503`
- Job-run readiness lookup failure while no finalized published snapshot exists: `503`

Required error body fields:

| Field | Type | Meaning |
| --- | --- | --- |
| `schemaVersion` | string | Exact contract version: `"crm.published-report.v1"` |
| `profileId` | string | Requested profile id |
| `syncReady` | boolean | Must be `false` |
| `error.code` | string | `readiness_unavailable` for operational readiness lookup failures, or the existing auth error body from the worker auth boundary |
| `error.message` | string | Human-readable operational failure message |

## Acceptance And Readiness Semantics

1. Internal trigger acceptance is not CRM sync readiness.
2. Internal `accepted` and `running` job states collapse into external `409` with `readiness.reason = "queued"` only when no finalized latest snapshot is available.
3. If a finalized latest published snapshot already exists, a newer queued run does not invalidate that existing published snapshot.
4. `publishedAt` is the latest published snapshot timestamp proved from the snapshot itself, not the trigger acceptance time.
5. If the latest published artifact exists but required lead or source fields cannot be proved safely, return `409` with `readiness.reason = "not_finalized"`.
6. If readiness cannot be verified safely because the job ledger cannot be consulted, return `503` instead of asserting `404`.
7. No separate `unpublished`, `not_accepted`, `routeType`, `reportId`, or `artifactVersion` semantics are frozen in this contract.

## Non-Goals

- No report-id-scoped contract in this thread
- No route-name freeze in this thread
- No implicit fallback semantics
- No D1-vs-GitHub storage exposure in the external body
- No change to publish, completion, acceptance, qualification, or external `/api/leads` semantics beyond this internal CRM-facing read contract
- No history contract freeze in this thread

## Fixture

The canonical success fixture for downstream CRM threads lives at:

- `docs/exec-plans/internal-api-contract-freeze.fixture.json`

It is the source example for the frozen `200` body shape above.
