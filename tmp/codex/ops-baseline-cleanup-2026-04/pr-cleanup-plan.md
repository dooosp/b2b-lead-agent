# Open PR Cleanup Plan

## Decision Baseline

- Decision date: 2026-04-10
- Current shipped baseline: `origin/master` pinned to `67258096e17e5a56aa34e4ecc04c53fba84a15ab`
- Shipped source of truth: current `master` plus merged PR history through PR #19 and later direct `master` updates
- Current open PR audit source: GitHub open PR state for `dooosp/b2b-lead-agent`
- Important correction: the current open PR set is `#1` through `#9`; PR `#10` is not part of the current open set and should not be treated as the active cleanup anchor

## Action Policy

- `replace via fresh artifact PR` means the old open PR should not be reviewed or merged as-is; if the idea still matters, re-land it from updated `master` with current validations and then close the stale PR
- `keep/rebase later` means the work still appears active, but it is not merge-safe on the current base and should not move until its external blocker clears
- `park` means keep only as historical reference until a human explicitly decides whether to revive or discard it
- No GitHub mutation was applied during this task
- Reason: closing or commenting on long-lived feature PRs is product-sensitive, and this cleanup task can finish truthfully with an exact repo-local action plan

## PR Decisions

### PR #1 - Add signal fusion and product knowledge foundation

- State: open
- Base/head: `master@5d565f7` -> `codex/pr1-3-foundation@3fa4a8f`
- Mergeability: false
- Disposition: replace via fresh artifact PR
- Evidence: opened on 2026-03-10 against an old `master`; current shipped baseline is `6725809`; validation cites `npm run test:worker`, which was a unit-only alias before this cleanup; this is the raw foundation lane for a stale March stack
- Exact GitHub action: close the PR after posting the comment below
- Exact comment text:

```text
Closing this stale raw March stack lane instead of carrying it forward on current master. If this feature is still wanted, re-land it as a fresh artifact PR from updated master with current validation truth (`npm run test:unit`, `npm run test:contract`, `npm run test:worker`, and `npm test` as appropriate).
```

- Applied now: documented only

### PR #2 - Add solution translation outputs for leads

- State: open
- Base/head: `codex/pr1-3-foundation@3fa4a8f` -> `codex/pr4-solution-translation@3b1793a`
- Mergeability: true only relative to its stale parent lane
- Disposition: replace via fresh artifact PR
- Evidence: depends on stale unmerged PR #1 instead of current `master`; validation cites the old `test:worker` meaning; review on this stacked raw lane would not reflect current shipped truth
- Exact GitHub action: close the PR after posting the comment below
- Exact comment text:

```text
Closing this stale stacked PR because its base is another unmerged March lane rather than current master. If this feature still matters, re-slice it from updated master as a fresh artifact PR with current worker gate and root gate validation.
```

- Applied now: documented only

### PR #3 - Expand dashboard intelligence views

- State: open
- Base/head: `codex/pr6-deal-risk-engine@c2bdfca` -> `codex/pr7-dashboard-intelligence@5cf2c12`
- Mergeability: true only relative to its stale parent lane
- Disposition: replace via fresh artifact PR
- Evidence: depends on multiple older unmerged stack parents; current `master` has moved through hardening and later updates; validation cites the old `test:worker` meaning
- Exact GitHub action: close the PR after posting the comment below
- Exact comment text:

```text
Closing this stale stacked dashboard lane because it no longer reflects a merge-safe diff on current master. If the work is still desired, reopen it as a fresh artifact PR rooted on updated master instead of continuing the March stack.
```

- Applied now: documented only

### PR #4 - Add win-loss learning foundation

- State: open
- Base/head: `codex/pr7-dashboard-intelligence@5cf2c12` -> `codex/pr8-win-loss-learning@cdc00d3`
- Mergeability: true only relative to its stale parent lane
- Disposition: replace via fresh artifact PR
- Evidence: top of the stale March stacked feature lane; not reviewable against current `master`; validation cites `npm run test:worker` from the old unit-only meaning
- Exact GitHub action: close the PR after posting the comment below
- Exact comment text:

```text
Closing this stale stack tip instead of trying to land it through an outdated parent chain. If win-loss learning is still in scope, re-land it from updated master as a fresh artifact PR with current validation coverage.
```

- Applied now: documented only

### PR #5 - Add next-best-action and deal risk signals

- State: open
- Base/head: `codex/pr5-stakeholder-persuasion@821acdc` -> `codex/pr6-deal-risk-engine@c2bdfca`
- Mergeability: true only relative to its stale parent lane
- Disposition: replace via fresh artifact PR
- Evidence: stacked on stale PR #6 instead of current `master`; current shipped baseline and worker gate semantics have both moved
- Exact GitHub action: close the PR after posting the comment below
- Exact comment text:

```text
Closing this stale stacked risk-engine lane because it is not a current-master review artifact. If the feature still matters, rebuild it as a fresh PR from updated master and validate it against the current worker and root gates.
```

- Applied now: documented only

### PR #6 - Add stakeholder persuasion flows

- State: open
- Base/head: `codex/pr4-solution-translation@3b1793a` -> `codex/pr5-stakeholder-persuasion@821acdc`
- Mergeability: true only relative to its stale parent lane
- Disposition: replace via fresh artifact PR
- Evidence: stacked on stale PR #2; not merge-safe against current `master`; validation cites the old `test:worker` meaning
- Exact GitHub action: close the PR after posting the comment below
- Exact comment text:

```text
Closing this stale stacked persuasion lane because its base is an old unmerged parent rather than current master. If it is still wanted, re-slice it from updated master as a fresh artifact PR with current validation truth.
```

- Applied now: documented only

### PR #7 - Refactor scout role modules

- State: open
- Base/head: `master@d82a105` -> `codex/scout-role-modules@a70ace4`
- Mergeability: false
- Disposition: park
- Evidence: independent March 15 refactor on an old `master` base; not part of the current shipped hardening or operational-baseline work; no current evidence that this refactor should be revived or discarded immediately
- Exact GitHub action: leave the PR open only as historical reference, or close it after owner confirmation if the refactor is no longer planned
- Exact comment text:

```text
Parking this refactor PR as historical context only. It is not merge-safe on current master, and it should be revived only by re-slicing the intended refactor into a fresh current-master artifact PR.
```

- Applied now: documented only

### PR #8 - Add staged GCP runtime and storage migration seams

- State: open
- Base/head: `master@feea75e` -> `codex/lead-pipeline-debugging@00ca4c4`
- Mergeability: false
- Disposition: replace via fresh artifact PR
- Evidence: broad March 24 integration lane on an old `master` base; current `master` has since moved through later hardening and docs alignment; even though the body records pending non-prod secrets and deferred live validation, this specific open diff is no longer the right landing artifact
- Exact GitHub action: close the PR after posting the comment below
- Exact comment text:

```text
Closing this stale runtime-migration PR. `master` has since shipped hardening and source-of-truth alignment updates, so this is no longer the right landing artifact. Resume this lane only with a fresh current-`master` PR after the external secret and live-validation blockers clear.
```

- Applied now: documented only

### PR #9 - Thread 2: add local-first storage seam for GCP migration

- State: open
- Base/head: `master@feea75e` -> `codex/storage-seam-split@d9a65b4`
- Mergeability: false
- Disposition: keep/rebase later
- Evidence: still the narrowest open migration placeholder; unlike PR #8, this lane is scoped enough to plausibly survive as a future rebase target, but it is behind current `master` and cannot be merged as-is
- Exact GitHub action: do not merge; keep only as the migration placeholder until someone rebases it onto updated `master` and reruns current validations
- Exact comment text:

```text
Keeping this as the storage-migration placeholder, but it is behind current `master`. Next step is a rebase onto updated `master` plus fresh validation before any review continues; do not merge it as-is.
```

- Applied now: documented only

## Safe Actions Already Taken

- Pinned the cleanup task to `origin/master@67258096e17e5a56aa34e4ecc04c53fba84a15ab`
- Captured the full nine-PR disposition plan in this repo-local artifact

## Follow-Up Actions Still Required

- Human owner should confirm whether PRs #1 through #6 should be closed immediately as stale raw stack artifacts
- Human owner should decide whether PR #7 stays parked as reference or is closed
- PR #8 should be closed if the owner agrees that a fresh current-`master` runtime artifact is the safer resume path
- External runtime secrets and live validation prerequisites must be resolved before any GCP migration lane is resumed
- PR #9 needs a real rebase onto current `master` plus fresh validation before it can be reviewed again
