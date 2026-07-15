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
`NO_ARTIFACT_CHANGE`, and `READY_FOR_REMOTE_PUBLICATION`. The legacy
`NO_CHANGE` spelling remains readable in retained schema-v1 run-result files
but is no longer emitted. `NO_VALID_LEADS` fails closed.
Notification failures retain `PUBLISHED` and distinguish definite failure,
partial acceptance, and unknown acceptance.

Collection is considered an expected `NO_ARTICLES` only when every configured
top-level source completed without an article. If all useful source work fails,
the run emits retryable `ERR_COLLECTION_FAILED`. Generation returns raw model
candidate and rejection counts; malformed output or provider failure emits
retryable `ERR_GENERATION_FAILED` rather than being converted to an empty run.

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
run/request identity and volatile timestamps. The publication ID binds the
previous publication, run identity, generated timestamp, and exact report,
latest, and history bytes. This makes an immutable generation name an identity
for one exact artifact set rather than only its semantic input.

Each publication writes an immutable generation:

```text
reports/<profile>/publications/<publicationId>/lead-report-YYYY-MM-DD.md
reports/<profile>/publications/<publicationId>/latest-leads.json
reports/<profile>/publications/<publicationId>/lead-history.json
reports/<profile>/publications/<publicationId>/publication-manifest.json
```

`reports/<profile>/publication-manifest.json` is the authoritative pointer. It
contains only bounded metadata: versions, profile/publication IDs, timestamps,
run identity, counts, repository-relative artifact paths, byte lengths, and
SHA-256 hashes. Manifest schema v2 requires `runId` and records the prior
manifest schema; schema v1 remains readable for existing publications. The
workflow supplies `github-<github.run_id>` through `--run-id`, which is stable
across rerun attempts; a valid `REQUEST_ID` remains a deterministic
profile-scoped fallback outside that workflow. Each schema-v2 generation keeps
an exact immutable manifest copy, so the pointer-linked history retains old
run claims. Reusing any retained publication's run ID with different content
fails before mutation with `ERR_RUN_ID_CONFLICT`. Reusing it with the same
content fails with
`RUN_REPLAY_REQUIRES_RESUME`, directing the operator to the retained result's
explicit notification-only retry. A different run with identical content is
`NO_ARTIFACT_CHANGE` and does not notify.
All generation files are written and synced before the pointer is atomically
replaced. A manifest-aware reader validates path confinement, regular-file
status, byte length, checksum, and JSON shape before returning data.
The pointer rename is the commit point. A local error after that rename is
reconciled against the manifest and checksums; a complete selected generation
is reported as locally committed, and rollback never deletes a generation that
the pointer already selects. If reconciliation cannot prove the selected set,
the result is commit-unknown rather than a false rollback claim.
If a process stops after renaming a generation but before committing the
pointer, that unreferenced generation cannot block a later changed-clock retry:
the retry's different exact bytes receive a different publication ID.

The original dated Markdown, `latest-leads.json`, and `lead-history.json`
remain the established canonical repository paths and byte-compatible mirrors
for existing consumers. Exceptions before the pointer commit restore all
mirrors from the pointer-selected immutable bytes, even when a prior hard crash
left the fixed paths mixed. Legacy partial-writer exports refuse to mutate a
manifest-backed profile. A local lock prevents two publisher processes from
mutating one profile simultaneously. Repair uses that same lock, rereads the
selected publication after acquisition, verifies the completed repair, and
returns the exact bounded Git path set so a remotely broken fixed-path mirror
is repaired in a new commit rather than hidden as local-only no-change. Locks
carry a random owner identity; release removes only the caller's lock. Dead-
owner recovery uses an exclusive recovery claim, rechecks recoverability, and
quarantines only the claimed stale directory, so it cannot delete a new lock
that wins the subsequent acquisition race. If a process is killed while
replacing mirrors, the pointer-selected immutable generation remains the local
transaction authority and the repair function can reconstruct the fixed paths.
Recovery claims also carry process/owner evidence; a dead or stale abandoned
claim can itself be recovered instead of permanently wedging the profile.

Before staging, the producer rejects duplicate latest or history IDs,
malformed legacy history entries, more than 90 latest records, more than 500
history records, any serialized record over 1,900,000 UTF-8 bytes, and latest
or history JSON over 8,000,000 UTF-8 bytes. These are the same conservative
cardinality and D1 snapshot budgets enforced by Worker consumers; history is
never silently truncated or projected around invalid entries. Latest and
retained IDs must also be route-safe, well-formed, non-dot segments of at most
256 UTF-8 bytes. Secret-shaped text is rejected across every serialized source
field, retained history included, before publication mutation.

Report dates and rendered timestamps use UTC exclusively, so identical input,
clock, and prior publication produce the same report bytes and publication
identity on hosts in different timezones.

POSIX cannot atomically replace three independent fixed filenames as one local
operation. Therefore an arbitrary legacy process that bypasses the manifest is
not a supported transaction reader and can observe mixed local mirrors after
an uncatchable process kill. Supported local publication and notification
readers follow the manifest and checksums. Worker GitHub fallback reads first
load the pointer and then the selected immutable latest/history artifact; only
a 404 manifest uses the legacy fixed-path reader, while a present corrupt
manifest fails closed. The Git publisher refuses to stage
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
normal non-force push. Before push it rereads every immutable, fixed-path, and
manifest blob from the commit, validates checksums, and proves fixed and
immutable bytes agree. The index is also validated byte-for-byte against the
selected manifest before commit. A fresh process may finish an exact owned
subset left by an interrupted `git add`; any unrelated staged path or mismatched
staged byte remains refused. The commit uses only the manifest-owned path set,
then verifies its parent and exact changed-path diff before any result
persistence or push, so concurrent staging or hooks cannot add unrelated files.
Before creating a new commit, the local base must equal the current remote tip.
After a process stop between commit creation and result persistence, recovery
accepts an unrecorded HEAD only if it is already remote-reachable or is one
manifest-owned commit directly atop the current remote tip; an unrelated local
ancestor fails closed. It then verifies reachability from the remote ref. A
non-fast-forward push or verification mismatch fails closed and leaves
notification `BLOCKED`.

The workflow always runs a recovery-only verification step after the publisher.
If the process stops after staging, the exact validated index can be completed
without absorbing unrelated changes. If it stops after persisting the exact
HEAD/commit tree but before push, recovery performs one ordinary non-force push
of that recorded commit and verifies reachability; non-fast-forward remains
fail-closed.
If the publisher process stops after the verified push but before recording
`PUBLISHED`, the persisted local commit identity plus remote reachability and
the committed manifest recover the typed result without a second commit or
history append. This recovery covers a publisher-process interruption while the
runner and workspace continue. A whole-runner loss cannot be made transactional
with Git or the artifact service; the Git commit remains durable, notification
does not start, and later handling must use retained evidence rather than claim
an ordinary successful notification.
The same recovery path accepts a retained retryable push/verification failure:
if the push actually succeeded but the first remote verification was transient,
later reachability proof promotes the retained result to `PUBLISHED`.

The workflow uses one repository-wide report-publication concurrency group.
This serializes report workflows but does not lock out PR merges or other
writers; the ordinary Git push remains the final compare-and-swap boundary.
There is no automatic rebase, force push, or workflow trigger expansion.
Queued runs check out current `master` with full history rather than the stale
dispatch event SHA. The terminal callback uses a result commit SHA only when
the result proves `remotePublished:true`; otherwise it retains the safe event
fallback and never reports an unpublished local commit as remote publication.

Expected empty/no-change outcomes are exit-code zero but remain visibly
distinct in the typed result, GitHub step summary, and retained typed-result
artifact. They do not create a Git commit or send notification. Invalid
candidates, publication failure, and notification failure return nonzero.

## Notification safety and retry

Notification starts only after the remote ref is reverified. It reads the
manifest and artifacts directly from the exact commit recorded in the retained
result rather than trusting the current working-tree pointer. It validates the
schema-derived path set (seven paths for schema v1, eight for schema v2 with
the immutable manifest copy), checks every blob, and proves fixed and immutable
bytes agree. Publication A can therefore be retried after publication B
advances `master` without sending B's content. A result-file-scoped exclusive
lock serializes notification attempts at one canonical path. In addition, a
repository-scoped exclusive lock derived from the validated run, profile,
publication, and commit identity
is held through provider acceptance and receipt persistence. Its root is the
canonical Git common directory, so repository subdirectories and linked
worktrees share the same lock. This identity lock survives an in-flight
result-file rename. A local accepted marker under the same Git metadata
prevents a moved stale result copy from replaying an already accepted identity.
Both locks conservatively recover dead owners. The result path is
canonicalized through `realpath` before path-lock acquisition and all result
reads/writes, so a symlink alias cannot create a second path lock or receipt.
Hardlinked result files are rejected before transport because atomic receipt
replacement would split their identity. A completed `NOTIFIED` receipt
skips later calls. An explicit retry must preserve the original recipient-set
fingerprint; recipient drift fails before transport. Missing provider
acceptance evidence is `NOTIFICATION_UNKNOWN`, never assumed accepted. It
also requires the caller profile and committed manifest profile to match the
retained result before resolving recipients or calling the provider. Persisted
acceptance, retryability, recipient counts, delivery-confirmation semantics,
notification key, and RFC Message-ID are cross-validated before a result can
be treated as already notified. It
builds HTML and plain text independently from the validated public latest-lead
records. Dynamic HTML is escaped for `&`, `<`, `>`, double quotes, and single
quotes; control characters and header newlines are normalized.

A deterministic notification key and RFC Message-ID provide correlation only.
SMTP/Gmail does not provide a transaction shared with Git or a usable
exactly-once idempotency key. Therefore:

- normal `NO_ARTIFACT_CHANGE` reruns never notify;
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

- `tests/pipeline-run-state.test.js` covers legal states, typed collection and
  generation failures, raw rejection counts, typed empty outcomes, validation
  failure, stable request-derived run identity, historical run claims across
  intervening publications, run conflicts, forged notification-state refusal,
  local-only state, and content idempotency.
- `tests/atomic-publication.test.js` discovers every pre-pointer mutation and
  injects failure after each write, sync, and rename; it verifies byte-for-byte
  rollback, post-pointer generation retention, pointer authority, checksum
  failure, repair/commit serialization, stale-lock recovery races, abandoned
  recovery claims, mixed-crash retry rollback, changed-clock orphan-generation
  retry, managed-writer refusal,
  timezone determinism, lock contention, and retry.
- `tests/git-publication.test.js` uses local bare Git repositories for verified
  push, post-push process termination recovery, non-fast-forward rejection,
  exact path enforcement, post-`git add` race refusal, committed-byte
  notification gating, transient verification recovery, retained-old-commit
  notification, checksum gating, path and repository-identity notification
  locking across subdirectories and linked worktrees, in-flight rename refusal
  and accepted-marker replay prevention,
  unrelated-local-ancestor recovery refusal, caller-profile and recipient-drift
  refusal, remote mirror repair,
  provider-acceptance process termination, and explicit retry.
- `tests/email-sender.test.js` uses fake transports and hostile synthetic text
  to verify HTML/text escaping, typed failures, partial/unknown acceptance, and
  the manifest-only boundary.
- `worker/tests/workflow-contract.test.mjs` checks concurrency, generation,
  notification, and callback credential separation (callback values exist only
  on the two callback steps), typed-result ordering, verified publication before
  notification, and callback compatibility.
- `worker/tests/publication-manifest-reader.test.mjs` proves manifest-selected
  immutable reads, schema-v1 compatibility, root-generated schema-v2
  compatibility, selected-artifact 404 refusal with stale D1 data, exact-schema,
  path, count, and manifest-size bounds, checksum fail-closed behavior, and
  no-manifest legacy compatibility.

All fixtures and transports are synthetic/local. These tests do not trigger
GitHub Actions, access a remote repository, or send email.
