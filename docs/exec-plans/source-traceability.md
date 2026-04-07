# Source Traceability Execution Plan

## Scope
- root article enrichment
- root article normalization
- publication-ready source normalization
- root regression tests

## Preflight
- worktree root: `/Users/jangtaeho/Documents/New/wt-source-traceability`
- branch: `hardening/source-traceability`
- package name: `b2b-lead-agent`
- worktree mode: yes

## Prompt Mismatch Note
- This worktree does not contain `AGENTS.md`, `HARDENING_PLAN.md`, or `tests/main.runtime.test.js`.
- Read-only reference copies were inspected from `/Users/jangtaeho/Documents/New/b2b-lead-agent/AGENTS.md` and `/Users/jangtaeho/Documents/New/b2b-lead-agent/HARDENING_PLAN.md`.
- Implementation remains scoped to this worktree only.

## Goal
- Prefer direct article URLs when resolution succeeds.
- Preserve the original discovery URL as the canonical source when direct resolution fails.
- Never replace the canonical source URL with `search.naver.com`.
- Keep enough provenance metadata to audit how the canonical source URL was obtained.

## Planned Changes
- Update Google News enrichment fallback behavior.
- Normalize traceable source metadata for unresolved discovery URLs.
- Preserve publication-ready provenance metadata in snapshot records.
- Add root regression coverage for source traceability.

## Implemented Changes
- `enricher/article-enricher.js`
  - Google News resolution success still upgrades `article.link` to the direct article URL.
  - Resolution failure now preserves the original Google News discovery URL as `article.link`.
  - Resolver and content fetcher are injectable for root regression tests.
  - External scraper dependencies are lazy-loaded so root tests can run without installed modules.
- `lead-qualifier.js`
  - Traceable sources now mark failed resolution as `unresolved`.
  - `originUrl` is preserved even when it matches the canonical discovery URL, so unresolved Google News provenance remains auditable.
- `lead-report-publisher.js`
  - Snapshot preparation now clones and normalizes source provenance fields explicitly instead of relying on shared object references.
- `tests/source-traceability.test.js`
  - Added regression coverage for Google News resolution success and failure.
  - Added normalization coverage proving unresolved published sources preserve discovery provenance and do not canonicalize `search.naver.com`.
