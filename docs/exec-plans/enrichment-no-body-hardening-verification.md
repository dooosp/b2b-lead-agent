# Enrichment No-Body Hardening Verification Plan

## Targeted Checks
- `node --test worker/tests/*.test.mjs`

## Manual Smoke
- Simulate a title-only source with no article body.
- Confirm normalized enrichment keeps:
  - empty evidence
  - conservative ROI wording
  - explicit `dataGaps` entry for missing article body

## Review Guardrails
- Re-check changed-file scope before commit.
- Ensure no claim overstates what was actually verified locally.
- Keep final read-only review limited to the requested files and diff snapshots.
