# Project refactor execution plan

**Goal:** Improve module ownership and remove repeated infrastructure code while
preserving the shipped behavior at `cc2d1484779922e8fb5c8e54bc810958da854794`.

**Authority:** The owner's request to refactor the project. Repository-local,
behavior-preserving implementation and local validation only.

**Architecture:** Keep existing entrypoints and public exports. Extract cohesive
services below their callers; consolidate only identical mechanics. Avoid broad
formatting changes or changes to dependencies, schemas, UI, or policy.

## Constraints

- Preserve API responses, error codes, SQL, trust decisions, and artifact formats.
- Keep `productionReady:false`, `NOT_PRODUCTION_EVIDENCE`, and Issue #165 HOLD.
- No live providers, remote D1, deploy, secrets, customer data, or notifications.
- Preserve existing dirty files in the original control checkout.
- The implementation checkpoint kept changes uncommitted for owner review.
  The owner subsequently authorized commits, a PR, CI verification and merge
  after successful checks; deployment remains outside this task.

## Tasks and ownership

- [x] Root publication/notification lane: extract shared owned-directory locking
  to `lib/owned-directory-lock.js`; retain caller-specific paths, errors, and
  publication fault hooks in `lead-report-publisher.js` and
  `notification-runner.js`. Update isolated-copy test fixtures as needed.
- [x] Worker lane: move article retrieval, prompt/model helpers, and enrichment
  normalization from `worker/api/enrichment.js` into
  `worker/lib/lead-enrichment.js`. Preserve API helper re-exports and change
  `worker/self-service/orchestrator.js` to depend on the service.
- [x] Tooling lane: reuse `scripts/lib/cli-utils.mjs` for option parsing,
  optional JSON input, and text output across the seven Level 1 scripts.
  Preserve caller-specific empty-path failures and direct-run guards.
- [x] Qualification lane: move company-name normalization and extraction into
  `normalizer/lead-company-normalizer.js`; retain existing qualifier exports
  and the exact matching/rejection order.

## Validation and review

Run existing behavior tests before and after extraction. Add tests only where
consolidation introduces a shared contract not already exercised.

- Root: atomic publication, Git publication, pipeline run-state, company-name
  accuracy, identity/trust, fallback publication, and source traceability.
- Worker: enrichment, outbound-boundary characterization, and route dispatch.
- Tooling: CLI helpers and all seven Level 1 script suites, including poisoned
  inputs and missing/empty paths.
- Integration: `npm test`, `npm run check:naming`,
  `npm run check:schema`, affected CI/local gates, and local browser E2E.
- Independent read-only review of the complete diff, including new files.

Review focus: lock ownership/recovery races; module dependency cycles;
unchanged outbound guards; company matching precedence; exact CLI output,
newline, and error behavior. Existing tests are the behavioral authority.

## Workspace evidence

- Repository identity was verified in the control checkout before creating the
  isolated implementation worktree.
- Remote: `https://github.com/dooosp/b2b-lead-agent.git`; default: `master`.
- Remote tip and initial HEAD: `cc2d1484779922e8fb5c8e54bc810958da854794`.
- Working branch: `codex/project-refactor-20261026`.
- Native worktree creation stalled on cloud-backed Git metadata. A fresh remote
  clone at the same pinned SHA was used to create an isolated linked worktree.
- Separate build/lint/typecheck scripts are not defined; use the repository's
  test, naming, schema, and local evidence gates.

## Results

At the initial local checkpoint: STATUS: SHIP; independent REVIEW: PASS.
The changes were uncommitted and had not been pushed, merged, or deployed.

Validation ran on Node v25.8.0 / npm 11.11.0. The CI workflow still selects Node
20; this task did not run hosted CI or claim a deployment result.

| Validation | Result |
| --- | --- |
| Clean baseline `npm test` | 239 root + 419 Worker unit + 28 contract = 686 passed |
| Final `npm test` | 249 root + 420 Worker unit + 28 contract = 697 passed; exit 0 |
| `npm run test:e2e:local` | 18 passed; exit 0 |
| `npm run check:naming` | exit 0 |
| `npm run check:schema` | exit 0 |
| `npm run security:audit-triage` | exit 0; deterministic offline check |
| `npm run check:enrichment-boundary` | exit 0 |
| `npm run check:enrichment-replay` | exit 0 |
| `npm run audit:claims` | exit 0 |
| `npm run eval:spec-fit` | exit 0 |
| `npm run test:claim-spec-fit` | exit 0 |
| `npm run check:lead-pipeline-replay` | exit 0 |
| `npm run eval:lead-quality` | exit 0 |
| `npm run check:level1` | exit 0 |
| `git diff --check` | exit 0 |
| Independent full-diff review | PASS; no actionable findings |

The full suite plus browser suite comprise 715 passing tests, with no failures,
skips, or TODOs. Focused tests are subsets and are not added to that total.
Eleven tests were added: five lock ownership/recovery cases and six CLI/output
edge contracts. Company normalization and Worker domain code were independently
compared against the baseline; moved logic is unchanged, with public exports
preserved. Lock ownership/error/recovery behavior and CLI output/path handling
were independently reviewed.

Module sizes after extraction: qualifier 921 -> 679 lines; Worker enrichment API
307 -> 112 lines. Publication and notification now use one 123-line lock module.
The existing architecture map and data-path documentation describe these owners.

Final remote/default-branch recheck still returned
`cc2d1484779922e8fb5c8e54bc810958da854794`. Implementation HEAD remains that same
commit on `codex/project-refactor-20261026`, with 19 modified tracked files and
four new files (this plan and three modules).

No package/dependency, schema, workflow, UI, or trust-policy changes were made.
No production/staging resources or live providers were accessed. Existing
production limitations remain: `productionReady:false`, Issue #165 HOLD.

The owner subsequently authorized integration. See the follow-up execution
record for the current landing scope; the counts above remain evidence for
the initial refactor checkpoint.
