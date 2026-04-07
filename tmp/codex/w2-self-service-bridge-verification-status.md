# Wave 2B Self-Service Source Bridge Verification Status

## Phase: Baseline
- Ran `node --test worker/tests/self-service-lead-utils.test.mjs worker/tests/self-service-model.test.mjs`
- Result: pass (16 tests)
- Coverage now includes unresolved discovery lineage, resolved direct lineage bridging, prompt contract guidance, and richer schema acceptance.

## Phase: Regression
- Ran `node --test worker/tests/*.test.mjs`
- Result: pass (50 tests)
- No broader worker regressions were detected from the self-service source contract changes.

## Phase: Manual Smoke
- Verified via deterministic regression cases that:
  - unresolved discovery URLs remain explicit and keep discovery/query context
  - direct article URLs preserve discovery lineage in `originUrl`
  - legacy payloads with only `title` + `url` still parse safely
