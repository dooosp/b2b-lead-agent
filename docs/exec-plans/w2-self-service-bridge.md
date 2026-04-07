# Wave 2B Self-Service Source Bridge Execution Plan

## Scope
- self-service analysis normalization
- self-service lead source utilities
- self-service prompt and model repair contract
- self-service model/schema regression coverage

## Preflight
- worktree root: `/Users/jangtaeho/Documents/New/wt-w2-self-service-bridge`
- branch: `hardening/w2-self-service-bridge`
- package name: `b2b-lead-agent`
- worktree mode: yes

## Prompt Mismatch Note
- `AGENTS.md` is not present in this worktree.
- `HARDENING_PLAN.md` is not present in this worktree.
- `worker/tests/self-service-model.test.mjs` is not present yet and will be created in-scope if needed for regression coverage.

## Goal
- Close the `query-token bridge 누락` gap in the self-service lead contract.
- Preserve enough source lineage for downstream worker identity and source handling.
- Keep legacy `title` + `url` consumers working while allowing richer optional metadata.

## Current Contract Audit
- `worker/self-service/lead-prompt.js` exposes article URL and search query to the model, but the output contract only teaches `sources[].title` and `sources[].url`.
- `worker/self-service/lead-model.js` repair prompt also collapses sources to `title` + `url`.
- `worker/self-service/analyze.js` and `worker/self-service/lead-utils.js` normalize sources down to `title` + `url`, so discovery/query lineage is dropped even when the article context has it.
- Quick leads generated without the model also emit only `title` + `url`.

## Planned Changes
- Extend self-service source normalization so optional lineage fields survive while `title` + `url` remain intact.
- Bridge fallback article discovery context into normalized lead sources when model payloads are sparse.
- Update prompt and repair-contract guidance so richer source metadata is allowed without requiring it.
- Add regression coverage for normalization, schema acceptance, and legacy payload compatibility.

## Implemented Changes
- `worker/self-service/lead-utils.js`
  - Added merge-safe source normalization that preserves optional lineage fields such as `originUrl`, `query`, `resolution`, `publisher`, and `publisherUrl`.
  - Distinguished direct article URLs from unresolved discovery URLs without inventing canonical provenance.
  - Extended lead/article matching so normalized `originUrl` can bridge back to the original article context.
- `worker/self-service/analyze.js`
  - Quick-lead generation now emits the enriched source contract instead of flattening sources to only `title` + `url`.
- `worker/self-service/lead-prompt.js`
  - Prompt contract now explicitly allows optional discovery lineage fields and forbids fabricated canonical URLs.
- `worker/self-service/lead-model.js`
  - Repair prompt now preserves the richer optional source contract for self-service model outputs.
- `worker/tests/self-service-lead-utils.test.mjs`
  - Added regression coverage for unresolved discovery sources, resolved direct sources with preserved lineage, and quick-lead query bridge preservation.
- `worker/tests/self-service-model.test.mjs`
  - Added prompt/repair-contract coverage and schema compatibility coverage for both richer and legacy source payloads.
