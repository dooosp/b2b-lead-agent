# B2B Lead Agent Security Hardening Plan

## Scope
- Remove long-lived query token authentication.
- Enable self-service analyze abuse protection by default.
- Sanitize evidence source links.
- Remediate production dependency audit findings.
- Quote and validate repository dispatch workflow inputs.
- Add focused security regressions.

## Plan
1. Use a fresh worktree from pinned `origin/master`.
2. Keep Bearer auth as the only long-lived server authentication path.
3. Reuse existing self-service rate-limit storage and fail closed when enabled but unavailable.
4. Use the existing `safeUrl()` client sanitizer for evidence links.
5. Update only vulnerable production dependency ranges required by `npm audit`.
6. Run naming, root, worker, full test, e2e when practical, and production audit checks.
