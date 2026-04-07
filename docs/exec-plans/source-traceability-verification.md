# Source Traceability Verification Plan

## Required Checks
- `node --test tests/*.test.js`
- targeted regression test covering root source traceability behavior

## Manual Smoke Focus
- Serialized lead `sources[].url` must be either:
  - a resolved direct article URL, or
  - the original discovery URL
- `search.naver.com` may appear only in non-canonical lookup metadata, never as the canonical source URL.

## Verification Rules
- Record only checks that actually ran.
- Call out any gap between requested validation and available repo structure.

## Executed Checks
- `node --test tests/source-traceability.test.js`
- `node --test tests/*.test.js`
- manual serialization smoke via `prepareLeadSnapshotRecords(...)`

## Observed Results
- All root tests passed.
- Resolved source example serialized with a direct article `url` plus Google News `originUrl`.
- Unresolved source example serialized with the original Google News discovery `url` and `originUrl`.
- No serialized canonical source `url` was replaced with `search.naver.com`.

## Validation Gaps
- `tests/main.runtime.test.js` is not present in this worktree, so that exact command could not be run here.
