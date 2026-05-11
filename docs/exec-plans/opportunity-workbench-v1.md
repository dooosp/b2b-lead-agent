# Opportunity Workbench v1

## Scope

Opportunity Workbench v1 is a local/test-only product UI improvement for the existing lead detail route:

- Route: `/leads/:id`
- Section anchor: `#opportunity-workbench`
- Write behavior: read-only Workbench panels. Existing review/status controls remain unchanged.

The feature does not add API fields, D1 columns, CRM payload fields, production endpoint calls, deploy steps, or production database actions.

## Data Contract

The Workbench derives from the existing LeadBrief v1 lead payload:

- `reviewStatus` / `review_status`
- `verificationStatus` / `verification_status`
- `generationMode` / `generation_mode`
- `confidence` and `confidenceReason`
- `evidence`
- `sources`
- `dataGaps` / `data_gaps`
- `assumptions`
- `signal`, `whyNow`, and `recommendedMessage`
- existing display context such as `score` and `grade`

Missing evidence, sources, why-now rationale, recommendation text, or low confidence are normalized through the existing LeadBrief v1 conservative defaults.

## Review Surface

The Workbench summarizes:

- review status and verification mode
- confidence and confidence rationale
- direct evidence quotes and source count
- data gaps
- assumptions
- recommended next review action

Next-action labels are deterministic and local to the page renderer.

## Screenshot Smoke

Use fake/local data only:

1. Start a local Worker-compatible harness or test server with a fake D1 binding.
2. Seed a fake lead row with evidence, sources, confidence, `reviewStatus`, and `dataGaps`.
3. Open `/leads/<fake-lead-id>` with a local Bearer token.
4. Capture desktop and narrow viewport screenshots showing `Opportunity Workbench`.
5. Do not call production Worker endpoints, deploy, or run `wrangler d1 execute`.
