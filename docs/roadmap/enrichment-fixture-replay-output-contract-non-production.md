# Enrichment Fixture Replay Output Contract - Non-Production

## Status

```text
DOCUMENT_STATUS: ENRICHMENT_FIXTURE_REPLAY_OUTPUT_CONTRACT_NON_PRODUCTION
DATE: 2026-06-03
REPO: dooosp/b2b-lead-agent
BASELINE_BRANCH: master
BASELINE_HEAD: 6950e2c91bee564c1d2c17917cfe06d5d45241f8
BOUNDARY: NOT_PRODUCTION_EVIDENCE
PRODUCTION_READY: false
ISSUE_165_LEVEL_1_PROOF: HOLD
DECISION: ADD_ROOT_ENRICHMENT_FIXTURE_REPLAY_OUTPUT_CONTRACT_LOCAL_ONLY
```

This packet records a deterministic local-only replay harness for the root
enrichment pipeline after PR #180 centralized outbound axios usage behind
`enricher/outbound-http-boundary.js`.

It is not production proof and does not approve production/staging deploy, D1
access, endpoint calls, logs/secrets access, smoke tests, live scraping,
customer/private data, CRM/outreach, LLM, automation, or production readiness.

## Fixture Replay Scope

The replay harness lives in:

- `enricher/enrichment-fixture-replay.js`
- `scripts/enrichment-fixture-replay.mjs`
- `tests/enrichment-fixture-replay.test.js`

The CI-visible command is:

```bash
npm run check:enrichment-replay
```

It runs the focused replay contract test and writes:

```text
tmp/codex/enrichment-fixture-replay-output-contract-non-production.json
```

The artifact is stable by design:

- fixed `generatedAt` fixture timestamp;
- deterministic case ordering;
- bounded text snippets;
- source labels instead of raw URLs;
- no raw HTML, headers, cookies, tokens, auth-like values, private URLs,
  unsafe payloads, or customer/private fixture markers.

## Covered Cases

| Case | Expected outcome |
| --- | --- |
| `success_resolved_article` | Google News-like discovery resolves through fixture search HTML, scraper extracts article body, body trust is `trusted`. |
| `success_safe_redirect` | Direct article fetch follows a safe fixture redirect and records source labels only. |
| `failure_timeout` | Timeout-shaped transport error normalizes to `timeout`. |
| `failure_malformed_search_html` | Malformed search result URL fails closed as `malformed_html`. |
| `failure_empty_content` | Short/empty article HTML fails closed as `empty_content`. |
| `failure_blocked_private_url` | Private URL is refused before fixture transport is called. |
| `failure_http_404` | 4xx response normalizes to `http_status`. |
| `failure_http_500` | 5xx response normalizes to `http_status`. |
| `failure_oversized_body` | Oversized fixture body normalizes to `response_too_large`. |

## Output Contract

Each replay entry uses the same normalized shape:

```text
caseId
sourceLabel
outcome
resolution
requestedUrlLabel
finalUrlLabel
redirected
status
failureCode
failureReason
body
transport
```

Failure taxonomy is intentionally small and stable:

```text
empty_content
http_status
malformed_html
request_policy_refused
response_too_large
timeout
```

The replay artifact intentionally stores labels and redacted snippets rather
than raw request URLs, raw response bodies, raw headers, axios config, stacks,
customer/private payloads, cookies, tokens, or auth-like values.

## Validation

Required validation for this packet:

```bash
node --test tests/enrichment-fixture-replay.test.js
npm run check:enrichment-boundary
npm run check:enrichment-replay
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

`npm run test:e2e:local` remains optional for this root-only replay change
unless final PR validation needs the full repo gate; if run, it must remain
fake-D1 and loopback-only.

## Non-Claims

- Not production proof.
- Not staging or production execution.
- Not live scraping.
- Not D1 observation, migration, read, write, delete, or schema proof.
- Not production/staging endpoint smoke testing.
- Not logs/secrets access.
- Not customer/private data evidence.
- Not CRM/outreach/LLM/automation action.
- Not a claim that all future outbound HTTP or dependency risk is eliminated.
