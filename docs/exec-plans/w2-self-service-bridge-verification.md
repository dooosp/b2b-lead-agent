# Wave 2B Self-Service Source Bridge Verification Plan

## Required Checks
- `node --test worker/tests/self-service-lead-utils.test.mjs worker/tests/self-service-model.test.mjs`
- `node --test worker/tests/*.test.mjs`

## Manual Smoke Focus
- Inspect a title-only self-service article path and confirm the emitted source contract preserves discovery/query context without claiming a resolved canonical article URL.
- Inspect prompt/schema compatibility for existing self-service payload generation.

## Verification Rules
- Record only commands and manual checks that actually ran.
- Treat any overclaimed summary as a verification bug and correct it before declaring merge readiness.

## Executed Checks
- `node --test worker/tests/self-service-lead-utils.test.mjs worker/tests/self-service-model.test.mjs`
- `node --test worker/tests/*.test.mjs`
- manual smoke via regression assertions covering:
  - unresolved Google News-style discovery URLs
  - resolved direct article URLs with preserved `originUrl`
  - prompt/repair contract guidance for non-fabricated canonical provenance

## Observed Results
- All targeted self-service tests passed (16 tests).
- All worker tests passed (50 tests).
- Title-only/discovery-style source normalization now preserves `query` and marks unresolved discovery URLs explicitly.
- Resolved direct article URLs now keep discovery lineage in `originUrl` so downstream consumers can distinguish direct vs unresolved provenance.
- Legacy payloads with only `title` + `url` still validate.

## Validation Gaps
- Manual smoke was exercised through deterministic regression cases rather than a live external fetch, because this task only hardened the self-service contract layer.
