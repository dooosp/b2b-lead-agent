# Agent Naming Convention

## Purpose

- Define a reusable naming system for agent repositories without forcing every repo to share the same stage verbs.
- Treat names as operational identifiers for runtime entrypoints, automation, observability, and policy.
- Keep stable identities in names, and move mutable details into metadata.
- P2-A moves canonical module paths to role-oriented file names while keeping legacy paths as compatibility wrappers.

## Stable Names

- Keep repository names in kebab-case and prefer `<domain>-agent`.
- Keep `main.js` as the standard CLI or batch entry file.
- Keep `index.js` for worker, router, or bot entrypoints.
- Keep `server.js` only for true HTTP server bootstraps.
- Keep profile files stable as `profiles/<profile-id>.js` unless the profile ID contract intentionally changes.
- Keep externally coupled artifact paths stable until compatibility support exists.

## Mutable Metadata

- Do not encode environment, owner, experiment state, sensitivity, or version into stable names unless there is a hard external requirement.
- Put mutable metadata in:
  - config fields
  - workflow inputs
  - labels or tags
  - environment variables
  - storage metadata

## Naming Rules

- File names: kebab-case
- JavaScript identifiers: camelCase
- Modules: role-revealing nouns
- Functions: verbs
- Produced data: stage-specific nouns

Examples:

- module names: `lead-qualifier.js`, `profile-registry.js`, `lead-report-publisher.js`
- function names: `qualifyLeads()`, `composeLeadReport()`, `publishLeadReport()`
- result names: `rawArticles`, `qualifiedLeads`, `leadReport`, `reportArtifacts`

## Repo-Specific Stage Families

- Different repos may keep domain-appropriate stage verbs.
- Standardize the logic, not the literal words.

Examples:

- `collect -> qualify -> brief`
- `ingest -> normalize -> sync`
- `research -> analyze -> recommend`
- `scan -> detect -> alert`

## B2B Lead Agent Guidance

- Keep `b2b-lead-agent` as the repository name.
- Keep `main.js` as the batch entrypoint.
- Keep `scout.js` only as a compatibility wrapper.
- Treat `config.js` as the current profile registry layer until a file rename is worth the migration cost.
- Standardize internal symbol names before renaming files.
- Defer artifact, route, and profile filename changes until a compatibility plan exists.

## P0 Changes

- Standardize internal symbol names such as `rawArticles`, `qualifiedLeads`, `leadReport`, and `reportArtifacts`.
- Add clearer alias exports for existing modules without breaking current imports.
- Prefer role-oriented import names at call sites even when file names stay unchanged.
- In later phases, flip aliases so role-based names become the internal canonical names and legacy names remain as compatibility exports.

## Deferred To P1+

- File renames like `qualifier.js -> lead-qualifier.js`
- Page and API file renames such as `worker/pages/main.js -> worker/pages/home-page.js`
- Artifact path renames such as `latest_leads.json -> latest-leads.json`
- Any route, storage, or profile ID changes

## P2-A Status

- Canonical file paths now use:
  - `lead-qualifier.js`
  - `lead-report-publisher.js`
  - `profile-registry.js`
  - `worker/pages/home-page.js`
  - `worker/api/leads.js`
  - `worker/api/references.js`
- Legacy paths remain as wrappers during the migration window:
  - `qualifier.js`
  - `briefing.js`
  - `config.js`
  - `worker/pages/main.js`
  - `worker/api/leads-api.js`
  - `worker/api/references-api.js`

## P2-B Status

- Artifact writers now dual-write canonical and legacy names during the migration window.
- Artifact readers should prefer canonical names first and fall back to legacy names.
- Current dual-write pairs:
  - `lead-report-YYYY-MM-DD.md` + `lead_report_YYYY-MM-DD.md`
  - `latest-leads.json` + `latest_leads.json`
  - `lead-history.json` + `lead_history.json`
- Workflow commits should include both canonical and legacy artifact names until downstream consumers are fully migrated.

## P2-C Status

- Add `npm run check:naming` to enforce the current migration baseline.
- Allow only explicit legacy wrapper files in `worker/api/*-api.js`.
- Require canonical role-oriented files to exist before merge.
- Keep naming checks narrow enough that they protect the standard without blocking unrelated work.

## Enforcement Ideas

- PR checklist item: is this a stable identity or mutable metadata?
- Lint/check script to reject new files matching `worker/api/*-api.js`
- Template guidance for entrypoint naming by runtime
- Contract tests for externally fetched artifact paths
