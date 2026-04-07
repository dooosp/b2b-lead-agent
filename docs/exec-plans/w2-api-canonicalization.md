# Wave 2C API Canonicalization Execution Plan

## Scope
- worker profile helpers in `worker/lib/profile.js`
- worker leads API boundary in `worker/api/leads.js`
- targeted worker API contract coverage in `worker/tests/`

## Constraints
- keep the diff worker-only and scoped to API/profile canonicalization hardening
- do not edit `worker/db/*` or self-service runtime files
- preserve compatibility with the current DB transform contract
- managed profile resolution must stay explicit and deterministic
- product canonicalization must not invent unsupported products for a profile
- orphan or mismatched products must be rejected or downgraded to a safe documented fallback

## Planned Phases
1. Preflight and context gathering
2. Create explicit worker-side profile/product canonicalization helpers
3. Apply canonicalization at the leads/history API boundary
4. Add regression coverage for valid, orphan, and mismatched profile/product cases
5. Run targeted and broad worker verification
6. Run the read-only final review guard
7. Commit, push, and create the PR if all gates stay green

## Environment Note
- `AGENTS.md` and `HARDENING_PLAN.md` are absent from this clean worktree, so task guidance is driven by the prompt plus the existing worker code in this repo root.
