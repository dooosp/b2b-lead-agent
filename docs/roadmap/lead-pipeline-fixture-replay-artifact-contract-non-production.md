# Lead Pipeline Fixture Replay Artifact Contract - Non-Production

## Status

```text
DOCUMENT_STATUS: LEAD_PIPELINE_FIXTURE_REPLAY_ARTIFACT_CONTRACT_NON_PRODUCTION
DATE: 2026-06-03
REPO: dooosp/b2b-lead-agent
BASELINE_BRANCH: master
BASELINE_HEAD: ae14cd907b65c008e09098689e2c22fce784863d
BOUNDARY: NOT_PRODUCTION_EVIDENCE
PRODUCTION_READY: false
ISSUE_165_LEVEL_1_PROOF: HOLD
DECISION: ADD_ROOT_LEAD_PIPELINE_FIXTURE_REPLAY_ARTIFACT_CONTRACT_LOCAL_ONLY
```

This packet records a deterministic local-only contract from the PR #181
enrichment fixture replay outputs into downstream lead-quality, report,
publication, and release-evidence artifact summaries.

It is not production proof and does not approve production/staging deploy, D1
access, endpoint calls, logs/secrets access, smoke tests, live scraping,
customer/private data, CRM/outreach, LLM, automation, or production readiness.

## Fixture Pipeline Scope

The contract harness lives in:

- `lead-pipeline-fixture-replay.js`
- `scripts/lead-pipeline-fixture-replay.mjs`
- `tests/lead-pipeline-fixture-replay-artifact-contract.test.js`

The CI-visible command is:

```bash
npm run check:lead-pipeline-replay
```

It runs the focused artifact contract test and writes:

```text
tmp/codex/lead-pipeline-fixture-replay-artifact-contract-non-production.json
```

The artifact is stable by design:

- fixed `generatedAt` fixture timestamp;
- deterministic replay case ordering inherited from PR #181;
- synthetic successful replay entries only as lead-quality inputs;
- source URL labels instead of serialized raw URLs;
- bounded article-body snippets;
- publication summaries from existing publisher helpers;
- release-evidence packet summaries from existing evidence tooling;
- `productionReady:false` and `NOT_PRODUCTION_EVIDENCE` throughout.

## Covered Data Path

| Surface | Contract coverage |
| --- | --- |
| Enrichment replay | Consumes `ENRICHMENT_FIXTURE_REPLAY_OUTPUT_CONTRACT_NON_PRODUCTION` output and preserves deterministic case order, failure taxonomy, source labels, and zero live network calls. |
| Lead-quality inputs | Builds synthetic leads from successful replay entries only, evaluates them with the synthetic-only lead-quality evaluator, and serializes only safe labels and result summaries. |
| Report generation | Calls the existing report composer with a fixed local timestamp and records deterministic grade counts plus required field presence. |
| Publication artifacts | Uses existing publisher helpers to prepare latest/history records in memory, then serializes only sanitized summaries and canonical artifact names. |
| Evidence packet | Uses the existing release-evidence packet tool to summarize the local validation boundary without running commands, production proof, deploy, D1, or endpoint calls. |

## Redaction / Privacy

The contract asserts that serialized reports, evidence, publication summaries,
and lead-quality summaries do not contain:

- raw HTML;
- raw URLs or private URLs;
- headers, cookies, tokens, API keys, auth-like values, or bearer material;
- manual note bodies or manual-note metadata labels;
- generated reviewer guidance, suggestions, or templates;
- customer/private fixture markers or email-like values.

Synthetic lead-quality inputs internally use `https://synthetic.example/...`
URLs only to satisfy the existing synthetic evaluator. Those URLs are not
serialized into the emitted artifact; emitted surfaces use labels such as
`fixture-public-success-article` and `fixture-public-redirect-final`.

## Output Contract

The artifact sections are intentionally small and stable:

```text
sourceReplay
syntheticArticles
leadQuality
report
publication
evidence
redaction
```

The top-level summary records zero live network, LLM, CRM, and D1 calls. The
publication section records canonical names only:

```text
lead-report-2026-06-03.md
latest-leads.json
lead-history.json
```

No canonical `reports/<profile>/...` files are written by this harness.

## Validation

Required validation for this packet:

```bash
node --test tests/lead-pipeline-fixture-replay-artifact-contract.test.js
npm run check:lead-pipeline-replay
npm run check:enrichment-replay
npm run check:enrichment-boundary
node --test worker/tests/workflow-contract.test.mjs
git diff --check
npm run security:audit-triage
npm audit --json
npm audit --omit=dev --json
npm run check:naming
npm run check:schema
npm run check:level1
npm test
```

`npm run test:e2e:local` remains optional for this root artifact-contract
change unless final PR validation needs the full repo gate; if run, it must
remain fake-D1 and loopback-only.

## Non-Claims

- Not production proof.
- Not staging or production execution.
- Not live scraping.
- Not D1 observation, migration, read, write, delete, or schema proof.
- Not production/staging endpoint smoke testing.
- Not logs/secrets access.
- Not customer/private data evidence.
- Not CRM/outreach/LLM/automation action.
- Not generated suggestion persistence, export, history, or attribution.
- Not a claim that the production reviewer workflow is ready.
