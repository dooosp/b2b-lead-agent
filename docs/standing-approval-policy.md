# Standing Approval Policy

This document records the standing human approval policy for routine future
work in `dooosp/b2b-lead-agent`. Its purpose is to reduce unnecessary `HOLD`
states for normal repository, GitHub, documentation, local validation, and
non-production work.

This policy does not authorize production execution. Anything not explicitly
allowed here remains prohibited unless a later task-specific human approval
record says otherwise.

## Authority And Scope

This policy applies when all of these are true:

- The active task targets `dooosp/b2b-lead-agent`.
- The repo basename is verified as `b2b-lead-agent`.
- Repo preflight has proved the repo root, branch, `HEAD`, default branch,
  remote default-branch `HEAD`, working tree state, and available validation
  commands.
- The task can be completed without production resources, secrets, destructive
  git, or unrelated dirty-file cleanup.
- No newer user instruction, repo-local instruction, issue approval record, or
  explicit stop condition narrows this policy.

If instructions conflict, the safer or more specific instruction wins. A
production approval packet can grant production scope only for the exact action
it names; it does not broaden this standing policy.

## Default Approved Work

Codex may proceed without an additional approval prompt for routine
repo/GitHub/local-only work, including:

- repo preflight and identity checks
- branch, `HEAD`, remote, default-branch, and working-tree verification
- reading repository files
- editing repository files within the requested task scope
- running local tests, lint, typecheck, schema checks, and validation commands
- running fake-D1, fixture-backed, loopback-only, or local-only test harnesses
- documentation updates
- local evidence summaries that do not claim production observation
- reading GitHub issues, PRs, comments, checks, and metadata
- posting GitHub comments when requested or required by the task
- opening GitHub issues or PRs when requested or required by the task
- closing GitHub issues when the issue has an explicit closeout approval or a
  clearly verified non-production completion condition
- creating commits or PRs when explicitly requested by the user

## Default HOLD Exit Rule

Codex does not need to stop with `HOLD` for routine repo/GitHub/local-only work
when all of these are true:

- repo identity is verified as `dooosp/b2b-lead-agent`
- expected repo basename is `b2b-lead-agent`
- default branch is discoverable
- working-tree changes are limited to the requested task
- unrelated dirty files are preserved and not touched
- no production resource is accessed
- no secret, token, credential, customer payload, lead row payload, production
  log, or private data is exposed
- no destructive git operation is required
- the task result can be validated with repo, diff, local command, or GitHub
  metadata evidence

If any item is false or ambiguous, stop with `HOLD` or `FOLLOW_UP` instead of
guessing.

## Actions Requiring Separate Explicit Approval

The following always require a separate, task-specific human approval prompt,
issue comment, or equivalent approval record:

- production deploy
- Wrangler production command, including deploy, tail, and D1 commands
- production D1 schema read
- production D1 row read
- production D1 row write
- production D1 migration or lazy-DDL execution
- production Worker endpoint call
- production smoke test
- production logs access
- secrets access
- customer payload access
- lead row payload access
- row roundtrip in production
- new production observation claim
- CRM mutation
- outreach, email sending, or auto-send behavior
- paid external API execution beyond normal development validation
- destructive git cleanup
- branch deletion
- closing issues that represent unresolved production risk

## Production Approval Requirements

Any future production approval must include:

- exact repository
- exact branch
- exact `HEAD` SHA
- exact command list or platform operation
- gate matrix with every production-adjacent action set to `YES` or `NO`
- owner or approver
- evidence path
- rollback path or explicit no-rollback rationale
- stop conditions
- redaction rules
- execution window
- whether Codex may automatically continue after verification

Missing, stale, or ambiguous production approval data defaults to `HOLD`.

## Evidence And Reporting

For completed work, Codex must report the evidence that proves the result:

- repo root
- branch
- `HEAD`
- default branch
- working tree status
- commands or checks run
- results
- files changed
- GitHub actions performed
- production boundary confirmation

Evidence must not include secrets, auth headers, cookies, tokens, private URLs,
customer payloads, lead row contents, raw production payloads, or production
logs unless a separate approval record explicitly permits that exact evidence.

## Standing Boundary

This standing policy authorizes smoother routine operation. It does not
authorize production proof execution, production deploy, Wrangler, production D1
access, production Worker endpoint calls, production logs/secrets access,
production smoke tests, row reads/writes, row roundtrip, production observation
claims, CRM mutation, or outreach automation.
