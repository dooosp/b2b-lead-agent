# Outbound HTTP Enrichment Boundary Guards - Non-Production

## Status

```text
DOCUMENT_STATUS: OUTBOUND_HTTP_ENRICHMENT_BOUNDARY_GUARDS_NON_PRODUCTION
DATE: 2026-06-02
REPO: dooosp/b2b-lead-agent
BASELINE_BRANCH: master
BASELINE_HEAD: bf78c2bc5f6779723eea44300978e40ca8d41574
BOUNDARY: NOT_PRODUCTION_EVIDENCE
PRODUCTION_READY: false
ISSUE_165_LEVEL_1_PROOF: HOLD
DECISION: HARDEN_ROOT_ENRICHMENT_AXIOS_BOUNDARY_LOCAL_TEST_ONLY
```

This packet records local/test-only hardening around root lead-generation
enrichment outbound HTTP usage after PR #179 updated `axios` to `1.16.0`.
It is not production proof and does not approve production/staging deploy, D1
access, endpoint calls, logs/secrets access, customer/private data,
CRM/outreach, LLM, automation, or production readiness.

## Inventory

| Surface | Current state |
| --- | --- |
| Axios import | Centralized in `enricher/outbound-http-boundary.js` |
| Root enrichment callers | `enricher/article-content-scraper.js`, `enricher/article-url-resolver.js`, `enricher/article-enricher.js`, `orchestrator/news-orchestrator.js`, `lib/news-fetcher/index.js`, `main.js` |
| RSS fetchers | `lib/news-fetcher/sources/google-news.js` and `lib/news-fetcher/sources/korean-rss.js` use `rss-parser`, `User-Agent`, `timeout:10000`, and retry wrappers; unchanged by this packet |
| Worker runtime | `worker/index.js` does not import `axios`; Worker fetch/OpenAI/Gemini paths are separate and out of this root-enrichment axios scope |
| Response persistence paths | Article body may populate `article.content` with `bodySource=article-body`; resolver may update `article.link`, `originalLink`, and `resolvedUrl`; LeadBrief publication stores source trace metadata only |

## Transport Contract

- Default transport remains `axios.get`.
- `readEnrichmentHttpText`, `fetchArticleContent`, and `resolveOriginalUrl`
  accept an injected local/test transport.
- Tests use only deterministic injected fixtures; they do not perform live
  external HTTP calls.
- The CI-visible command is:

```bash
npm run check:enrichment-boundary
```

It runs the focused boundary test and writes:

```text
tmp/codex/outbound-http-enrichment-boundary-guards-non-production.json
```

The artifact is labeled `NOT_PRODUCTION_EVIDENCE` and keeps
`productionReady:false`.

## Request Policy

The root enrichment boundary now enforces:

- allowed schemes: `http`, `https`;
- blocked hosts: localhost, private IPv4 ranges, loopback/link-local/private
  IPv6, `.local`, `.lan`, `.corp`, internal host labels,
  `metadata.google.internal`, the repo production-like placeholder host, and
  `*.workers.dev` / `*.pages.dev`;
- timeout range: positive and at most 30000ms;
- redirect limit: default 3, maximum 5;
- response size limit: default 512 KiB, maximum 2 MiB;
- no `Authorization`, `Proxy-Authorization`, cookies, API-key, token, or
  unsupported custom outbound headers;
- unsafe final redirect targets are refused after transport response metadata is
  inspected.

## Failure-Mode Coverage

Focused local fixtures cover:

- DNS/network-shaped errors;
- timeout / `ECONNABORTED`;
- 4xx/5xx responses;
- malformed DuckDuckGo result HTML/URLs;
- oversized body;
- redirect loop / `ERR_FR_TOO_MANY_REDIRECTS`;
- axios error shapes containing config, headers, status, response payload, and
  raw message text.

Scraper/resolver behavior remains fail-closed:

- `fetchArticleContent(...)` returns `""` on refused/failed HTTP;
- `resolveOriginalUrl(...)` returns `null` on refused/failed lookup or unsafe
  result URL.

## Redaction / Privacy

Boundary artifacts and failure summaries redact or omit:

- URLs and private/internal URL-shaped values;
- auth headers, cookies, bearer tokens, API keys, secrets, and query tokens;
- raw axios config/request/response fields;
- error messages, stacks, snippets, payload/body/data fields;
- customer/private data fixture markers and email-like values.

No logs, evidence artifacts, PR body text, or tests should include raw secret
material, auth material, customer/private payloads, or unsafe raw response
snippets.

## Validation Evidence So Far

These local commands were run before this packet was written:

```bash
npm ci
node --test tests/enrichment-outbound-http-boundary.test.js
node --test worker/tests/workflow-contract.test.mjs
node --test tests/security-dependency-audit-triage.test.js
```

Full validation remains the PR merge gate and must include the current
repository-required audit, schema, Level 1, root/worker test, and local-only E2E
commands before any merge claim.

## Non-Claims

- Not production proof.
- Not staging or production execution.
- Not D1 observation, migration, read, write, delete, or schema proof.
- Not production/staging endpoint smoke testing.
- Not logs/secrets access.
- Not customer/private data evidence.
- Not CRM/outreach/LLM/automation action.
- Not a claim that all future outbound HTTP or dependency risk is eliminated.
