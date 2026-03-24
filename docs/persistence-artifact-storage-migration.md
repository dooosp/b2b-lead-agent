# Persistence Artifact Storage Migration

## Purpose
- Fact: Local artifact publishing under `reports/<profile>/` remains the canonical write path.
- Fact: GCS archive and Firestore mirror behavior are additive side effects only.
- Fact: The first migration step does not rename local artifacts and does not change local JSON shape.

## Local Canonical Artifacts
- Fact: Role 5 still writes:
  - `reports/<profile>/lead_report_YYYY-MM-DD[_HHMMSS].md`
  - `reports/<profile>/latest_leads.json`
  - `reports/<profile>/lead_history.json`
- Fact: `latest_leads.json` remains the normalized publish snapshot for the current run.
- Fact: `lead_history.json` remains the merged history keyed by `dedupeKey || fingerprint || id`, sorted by `updatedAt` descending.
- Fact: Corrupted `lead_history.json` parse failures still back up the bad file and fail the publish.
- Fact: Non-array parsed history still resets to empty history with a warning, as before.

## Storage Seam
- Fact: [`lead-report-publisher.js`](/Users/jangtaeho/Documents/New/b2b-lead-agent/lead-report-publisher.js) now performs local writes first, then hands the final artifact paths and normalized lead payloads to optional storage adapters.
- Fact: Storage adapters live under [`lib/storage/`](/Users/jangtaeho/Documents/New/b2b-lead-agent/lib/storage).
- Fact: Adapter failures are warning-only by default so local publish behavior stays stable during migration.
- Fact: `options.storage.strict === true` promotes adapter failures to hard failures for controlled cutovers.

## GCS Archive Contract
- Fact: GCS is enabled only when `LEAD_STORAGE_GCS_BUCKET` is set.
- Fact: `LEAD_STORAGE_GCS_PREFIX` is optional and prefixes object keys when present.
- Fact: The GCS adapter uploads the exact local artifact bytes after local write completion.
- Fact: Default object keys mirror repo-relative paths such as `reports/<profile>/latest_leads.json`.
- Hypothesis: Bucket object versioning is the safest way to retain previous `latest_leads.json` / `lead_history.json` generations without inventing a second mutable naming scheme in Role 5.

## Firestore Mirror Contract
- Fact: Firestore is enabled only when `LEAD_STORAGE_FIRESTORE_COLLECTION` is set.
- Fact: The Firestore adapter mirrors normalized lead records after local publish completes.
- Fact: Profile root path is `<collection>/<profileId>`.
- Fact: The profile root contains:
  - `publish_state/current` document with publish timestamps, counts, and local artifact paths
  - `latest_leads/<leadId>` documents mirroring the current latest snapshot
  - `lead_history/<leadId>` documents mirroring merged history
- Fact: Firestore lead document IDs are the publisher-side `lead.id`.
- Fact: The Firestore mirror deletes stale `latest_leads/<leadId>` documents when a lead leaves the latest snapshot.
- Fact: The Firestore mirror does not delete historical lead documents from `lead_history`.

## Runtime Expectations
- Fact: Role 6 should continue to treat local/GitHub artifacts as the read contract unless a later lane explicitly switches the source of truth.
- Fact: Firestore mirror-on-write is not a read-path change by itself.
- Fact: GCS archive is not a worker contract change by itself.

## Required Runtime Packages
- Fact: The adapters lazily require:
  - `@google-cloud/storage`
  - `@google-cloud/firestore`
- Fact: Leaving the env vars unset keeps the publisher on the current local-only path without requiring either package.
