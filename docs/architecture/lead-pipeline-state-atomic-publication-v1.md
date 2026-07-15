# Lead Pipeline State, Atomic Publication, and Notification v1

## Status and boundary

This contract covers the managed root lead-generation pipeline and its GitHub
Actions publication path. It is repository/local-test evidence only. It does
not approve or execute production or staging access, D1 access or migration,
endpoint calls, logs or secrets access, customer/private data use, real email,
CRM/outreach, deployment, or production-readiness claims. Issue #165 remains
HOLD.

## Lifecycle state versus terminal outcome

`state` is the highest guarantee proven during the current attempt. `outcome`
explains how the attempt ended. State is monotonic:

```text
STARTED -> GENERATED -> VALIDATED -> PUBLISHED -> NOTIFIED
```

- `GENERATED` means candidate generation completed, including zero candidates.
- `VALIDATED` means every candidate was accepted or rejected by the public
  publication boundary. It does not mean any artifact reached Git.
- `PUBLISHED` requires a successful Git push and verification that the exact
  publication commit is reachable from the selected remote ref. The commit is
  normally the ref tip immediately after the push; an authorized later ref
  advance does not make the already-pushed commit unpublished. Local files,
  staging, and a local Git commit are insufficient.
- `NOTIFIED` means the configured SMTP provider accepted every intended
  envelope. It does not mean inbox delivery, reading, or exactly-once delivery.

Expected terminal outcomes include `NO_ARTICLES`, `NO_CANDIDATES`,
`NO_CHANGE`, and `READY_FOR_REMOTE_PUBLICATION`. `NO_VALID_LEADS` fails closed.
Notification failures retain `PUBLISHED` and distinguish definite failure,
partial acceptance, and unknown acceptance.

The typed result separates lifecycle, outcome, counts, publication evidence,
notification evidence, and a bounded safe failure object. It never stores lead
text, recipients, credentials, provider responses, callback tokens, absolute
artifact paths, or raw exception messages.

## Publication transaction

All candidates are projected and validated before report rendering or any file
mutation. Secret-shaped text in a public field is rejected, and source URLs are
limited to public HTTP(S) locations without userinfo or secret-bearing query
keys. Ordinary markup remains untrusted text and is escaped at each renderer.
The content digest includes the profile, normalized sorted public
semantic records, publication schema version, and render version. It excludes
run/request identity and volatile timestamps. The publication ID also binds the
previous publication ID, creating a deterministic publication chain.

Each publication writes an immutable generation:

```text
reports/<profile>/publications/<publicationId>/lead-report-YYYY-MM-DD.md
reports/<profile>/publications/<publicationId>/latest-leads.json
reports/<profile>/publications/<publicationId>/lead-history.json
```

`reports/<profile>/publication-manifest.json` is the authoritative pointer. It
contains only bounded metadata: versions, profile/publication IDs, timestamps,
counts, repository-relative artifact paths, byte lengths, and SHA-256 hashes.
All generation files are written and synced before the pointer is atomically
replaced. A manifest-aware reader validates path confinement, regular-file
status, byte length, checksum, and JSON shape before returning data.
The pointer rename is the commit point. A local error after that rename is
reconciled against the manifest and checksums; a complete selected generation
is reported as locally committed, and rollback never deletes a generation that
the pointer already selects. If reconciliation cannot prove the selected set,
the result is commit-unknown rather than a false rollback claim.

The original dated Markdown, `latest-leads.json`, and `lead-history.json`
remain the established canonical repository paths and byte-compatible mirrors
for existing consumers. Exceptions before the pointer commit restore all
mirrors byte-for-byte. A local lock prevents two publisher processes from
mutating one profile simultaneously. If a process is killed while replacing
mirrors, the pointer-selected immutable generation remains the local
transaction authority and the repair function can reconstruct the fixed paths.

POSIX cannot atomically replace three independent fixed filenames as one local
operation. Therefore an arbitrary legacy process that bypasses the manifest is
not a supported transaction reader and can observe mixed local mirrors after
an uncatchable process kill. Supported local publication and notification
readers follow the manifest and checksums. The Git publisher refuses to stage
or push while any fixed path differs from the selected generation, so existing
remote fixed-path consumers receive the complete mirror set in one Git commit
or no new commit at all. In this contract, “previous canonical publication
remains intact” means the manifest-selected immutable publication; it does not
claim impossible multi-file atomicity for a bypassing local reader. Existing
Worker/D1 latest and history heads also remain intentionally independent.

Referenced immutable generations are retained. Garbage collection is outside
this change because an older pointer or concurrent reader may still reference
them.

## Remote publication and workflow serialization

The generation step has the model credential only. It writes a typed result and
cannot notify. The remote publisher validates the manifest, requires the typed
result paths to equal the manifest-derived immutable, pointer, and compatibility
path set, creates a local commit, and persists that commit identity before a
normal non-force push. It then verifies reachability from the remote ref. A
non-fast-forward push or verification mismatch fails closed and leaves
notification `BLOCKED`.

The workflow always runs a recovery-only verification step after the publisher.
If the publisher process stops after the verified push but before recording
`PUBLISHED`, the persisted local commit identity plus remote reachability and
the committed manifest recover the typed result without a second commit or
history append. This recovery covers a publisher-process interruption while the
runner and workspace continue. A whole-runner loss cannot be made transactional
with Git or the artifact service; the Git commit remains durable, notification
does not start, and later handling must use retained evidence rather than claim
an ordinary successful notification.

The workflow uses one repository-wide report-publication concurrency group.
This serializes report workflows but does not lock out PR merges or other
writers; the ordinary Git push remains the final compare-and-swap boundary.
There is no automatic rebase, force push, or workflow trigger expansion.

Expected empty/no-change outcomes are exit-code zero but remain visibly
distinct in the typed result, GitHub step summary, and retained typed-result
artifact. They do not create a Git commit or send notification. Invalid
candidates, publication failure, and notification failure return nonzero.

## Notification safety and retry

Notification starts only after the remote ref is reverified. It reloads the
exact pointer-selected immutable artifacts and verifies their checksums. It
builds HTML and plain text independently from the validated public latest-lead
records. Dynamic HTML is escaped for `&`, `<`, `>`, double quotes, and single
quotes; control characters and header newlines are normalized.

A deterministic notification key and RFC Message-ID provide correlation only.
SMTP/Gmail does not provide a transaction shared with Git or a usable
exactly-once idempotency key. Therefore:

- normal `NO_CHANGE` reruns never notify;
- notification failure never rolls back publication or appends history;
- retry requires the explicit notification-retry flag and revalidates the
  remote commit and immutable artifacts;
- partial or unknown acceptance is never automatically retried;
- a process stop after provider acceptance leaves the persisted intent as
  `PENDING`; it is treated as acceptance-unknown and also requires the explicit
  retry flag;
- an explicit retry can duplicate a message that the provider accepted before
  a timeout or process crash.

`NOTIFIED` means provider acceptance for all intended recipients, not delivery.

## Executable evidence

- `tests/pipeline-run-state.test.js` covers legal states, typed empty outcomes,
  validation failure, local-only state, and content idempotency.
- `tests/atomic-publication.test.js` discovers every pre-pointer mutation and
  injects failure after each write, sync, and rename; it verifies byte-for-byte
  rollback, post-pointer generation retention, pointer authority, checksum
  failure, repair, lock contention, and retry.
- `tests/git-publication.test.js` uses local bare Git repositories for verified
  push, post-push process termination recovery, non-fast-forward rejection,
  exact path enforcement, notification gating, checksum gating, provider-
  acceptance process termination, and explicit retry.
- `tests/email-sender.test.js` uses fake transports and hostile synthetic text
  to verify HTML/text escaping, typed failures, partial/unknown acceptance, and
  the manifest-only boundary.
- `worker/tests/workflow-contract.test.mjs` checks concurrency, credential
  separation, typed-result ordering, verified publication before notification,
  and callback compatibility.

All fixtures and transports are synthetic/local. These tests do not trigger
GitHub Actions, access a remote repository, or send email.
