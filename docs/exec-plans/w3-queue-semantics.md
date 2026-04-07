# W3 Queue Semantics Hardening

## Task

- Slug: `w3-queue-semantics`
- Title: Wave 3 queue / trigger submission-vs-completion semantics hardening
- Branch: `hardening/w3-queue-semantics`

## Goal

Ensure accepted job submission is never reported as completed, keep the accepted path intake-only, and only emit runtime completion after real execution/completion evidence exists.

## Scope

- Trigger handler accepted contract
- Trigger submission library/runtime adapter contract
- Trigger/runtime contract tests

## Constraints

- Keep the diff as small as possible
- Do not widen beyond queue/trigger semantics
- Keep `target` meaning the real executor
- Do not synthesize execution/completion fields without confirmed execution resource or equivalent evidence

## Preflight

- `pwd`: `/Users/jangtaeho/wt-w3-queue-semantics`
- Repo root: `/Users/jangtaeho/wt-w3-queue-semantics`
- Branch: `hardening/w3-queue-semantics`
- Mode: `Worktree` (`git-dir` points at `.git/worktrees/wt-w3-queue-semantics`)
- `git status --short`: clean
- `git diff --name-only`: clean
- Repo fingerprint:
  - `package.json` present and `name` is `b2b-lead-agent`
  - `worker/index.js` present
  - `worker/api/trigger.js` present
  - `worker/lib/job-trigger.js` missing at this revision
  - `runtime/cloud-run-job.js` missing at this revision

## Notes

The prompt-listed runtime/trigger paths have drifted in this worktree. Equivalent queue/completion semantics will be mapped from the current code before implementation, while keeping edits scoped to the owned task.

## Current-Code Mapping

- Trigger handler: `worker/api/trigger.js`
- Trigger submission library: `worker/lib/job-trigger.js` (added in this task to isolate submission semantics)
- Runtime executor reference: `.github/workflows/generate-report.yml` dispatches the real execution to `node main.js --profile $PROFILE --email`
- Runtime completion signal covered by test: `lib/obs.js` only emits `run completed` when the runtime explicitly calls `summary()`
