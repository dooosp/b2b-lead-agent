# Lead Quality Evaluation Harness

## Purpose

Use this local harness to judge whether generated leads are evidence-backed, complete, reviewable, and actionable before a PR changes lead generation, LeadBrief shaping, review metadata, or source traceability.

This harness is local-only. It uses synthetic fixtures in `eval/fixtures/synthetic-leads.js`; do not run it on production data, D1 exports, `reports/*`, or endpoint responses.

## Command

```bash
npm run eval:lead-quality
```

The command evaluates the built-in synthetic fixture set and prints `SHIP`, `FOLLOW_UP`, and `HOLD` outcomes. The fixture set intentionally includes weak and broken examples so future changes can prove the evaluator still catches them.

For a future PR-specific synthetic file:

```bash
node scripts/evaluate-lead-quality.js --input path/to/synthetic-leads.json --json
```

Use `--fail-on-hold` when you want a PR-specific synthetic file to act as a gate.

Input JSON must be either an array of leads or an object with a `leads` array. Every lead must set `synthetic: true`; source and evidence URLs must stay under `https://synthetic.example/...`. The script rejects remote URLs and production report artifacts such as `reports/*`, `latest-leads.json`, `lead-history.json`, and `lead-report-YYYY-MM-DD.md`.

## Dimensions

- `evidenceCompleteness`: checks source title/URL coverage, direct evidence quotes, evidence-to-source URL alignment, conflicts, and stale source dates.
- `confidenceClarity`: checks `confidence`, `confidenceReason`, and whether confidence is overstated for low, stale, or conflicting evidence.
- `assumptionsClarity`: checks explicit assumptions for fit, estimates, and timing.
- `dataGaps`: checks whether missing evidence, identity gaps, conflicts, stale signals, and low-confidence follow-ups are visible.
- `verificationStatus`: checks frozen verification states and prevents `verified` when evidence is missing, stale, or conflicting.
- `reviewReadiness`: checks the lead has the fields a human reviewer needs and is not pre-approved.
- `eventTypeClarity`: checks the trigger category is explicit and not generic.

## Synthetic Fixtures

- Strong lead: complete, current, verified evidence and review-ready.
- Weak lead: low confidence with explicit assumptions and follow-up gaps.
- Missing evidence: no sources or quotes despite a verified claim.
- Conflicting evidence: contradictory source claims.
- Missing company/product: identity and fit gaps block review readiness.
- Stale signal: source is older than the freshness threshold and needs revalidation.

## PR Checklist

1. Add or update only synthetic fixtures for new lead-quality behavior.
2. Run `node --test tests/lead-quality-evaluator.test.js` while developing.
3. Run `npm run check:naming`, `git diff --check`, and `npm test` before requesting review.
4. Include the harness result in the PR notes when lead generation, LeadBrief fields, source traces, or review metadata change.
5. Do not use production data, production DB access, deployed endpoints, or copied customer leads for this evaluation.
