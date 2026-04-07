# Wave 2 Integration Ship Plan

## Task
- slug: `w2-integration-ship`
- title: `Wave 2 integration, validation, PR, and merge`
- goal: build one validated Wave 2 merge artifact from the three worker-only task branches, then ship it safely
- artifact branch: `codex/w2-integration-review`

## Preflight
- repo root: `/Users/jangtaeho/Documents/New/worktrees/b2b-lead-agent-w2-integration-control`
- mode: `worktree`
- branch at start: detached `HEAD`
- package name: `b2b-lead-agent`
- git tree before work: clean
- `git fetch --all --prune`: completed
- `AGENTS.md`: absent in this worktree
- `HARDENING_PLAN.md`: absent in this worktree

## Required Order
1. `hardening/w2-data-contract`
2. `hardening/w2-self-service-bridge`
3. `hardening/w2-api-canonicalization`

## Integration Approach
1. Audit branch existence, head commits, PR presence, ancestry, and claimed scope.
2. Create or reset `codex/w2-integration-review` from updated `master`.
3. Prefer `git cherry-pick -x` of the verified head commits in required order.
4. Keep conflict resolution minimal and report any semantic test updates explicitly.
5. Validate the integrated result with the strongest safe test set.
6. Create or update one Wave 2 integration PR and merge it only if green.
