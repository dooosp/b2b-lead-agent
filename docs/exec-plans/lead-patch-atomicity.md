# Lead PATCH Atomicity Execution Plan

## Scope
- worker lead PATCH API in `worker/api/leads.js`
- worker lead DB helper in `worker/db/leads.js`
- targeted regression test coverage in `worker/tests/`

## Constraints
- keep the diff scoped to PATCH atomicity
- preserve `AGENTS.md`; do not modify it
- a mixed invalid PATCH must leave the lead unchanged
- add a regression test that reproduces the partial-write bug before the fix

## Planned Phases
1. Preflight and context gathering
2. Reproduce the partial-write bug in a worker regression test
3. Implement validation-first atomic lead PATCH persistence
4. Run targeted worker tests and close verified gaps only
5. Run the read-only final review guard
6. Commit and push if all gates stay green

## Environment Note
- The `hardening/lead-patch-atomicity` worktree shares the same `HEAD` as a sibling clone that contains local-only `AGENTS.md` and `HARDENING_PLAN.md`.
- Those two documents were read from the sibling clone for task guidance because they are absent from this clean worktree at the same commit.
