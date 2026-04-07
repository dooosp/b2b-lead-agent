# Root Identity Trust Execution Plan

## Scope
- Root-only hardening in the current repository layout.
- Equivalent root surfaces in this repo are `main.js`, `scout.js`, `qualifier.js`, `briefing.js`, and `lib/news-fetcher/**`.
- The prompt's referenced files `lead-qualifier.js`, `lead-report-publisher.js`, `profile-registry.js`, `orchestrator/news-orchestrator.js`, and `tests/main.runtime.test.js` do not exist in this checkout.

## Goals
- Stabilize root lead identity for the same logical lead.
- Prevent low-trust or missing article body content from being injected into qualifier prompting as trusted article text.
- Preserve company-name hardening semantics by validating normalized lead companies before accepting model output.

## Planned Changes
1. Add explicit root article body trust classification at fetch/enrichment time.
2. Gate qualifier prompt/body-aware category matching on trusted body only.
3. Add deterministic lead identity helper based on normalized company plus canonical source/event fallback.
4. Replace random lead IDs in root persistence with deterministic IDs and identity-based history updates.
5. Add root regression tests for identity stability, trust gating, and company-name validation.

## Verification
- `node --test tests/*.test.js`
- Manual fixture-style checks via targeted tests for reordered sources and low-trust body exclusion.
