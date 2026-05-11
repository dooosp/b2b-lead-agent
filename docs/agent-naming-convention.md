# Agent Naming Convention

## Purpose

- Define a reusable naming system for agent repositories without forcing every repo to share the same stage verbs.
- Treat names as operational identifiers for runtime entrypoints, automation, observability, and policy.
- Keep stable identities in names, and move mutable details into metadata.
- Canonical module paths, artifact names, and worker surfaces now use role-oriented names only.

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
- Use `profile-registry.js` as the profile registry layer.
- Use canonical role-based file paths directly in runtime code.
- Use canonical news-fetcher, enricher, and deduper module paths directly instead of alias wrappers.
- Use canonical artifact names directly in storage, workflows, and worker fetch logic.

## P0 Changes

- Standardize internal symbol names such as `rawArticles`, `qualifiedLeads`, `leadReport`, and `reportArtifacts`.
- Add clearer alias exports for existing modules without breaking current imports.
- Prefer role-oriented import names at call sites even when file names stay unchanged.
- In later phases, flip aliases so role-based names become the internal canonical names and legacy names remain as compatibility exports.

## Current Canonical Paths

- Canonical file paths now use:
  - `lead-qualifier.js`
  - `lead-report-publisher.js`
  - `profile-registry.js`
  - `worker/pages/home-page.js`
  - `worker/api/leads.js`
  - `worker/api/references.js`

## Current Canonical Artifacts

- Reports:
  - `lead-report-YYYY-MM-DD.md`
- Lead snapshot:
  - `latest-leads.json`
- Lead history:
  - `lead-history.json`

## Validation Status

- `npm run check:naming` enforces the current canonical baseline.
- Legacy wrapper files and `worker/api/*-api.js` filenames are no longer allowed.
- Legacy source wrappers and unused news-fetcher utility alias wrappers are no longer allowed.
- Canonical role-oriented files must exist before merge.
- `lead-report-publisher.js` must write canonical artifact names only.

## Enforcement Ideas

- PR checklist item: is this a stable identity or mutable metadata?
- Lint/check script to reject new files matching `worker/api/*-api.js`
- Template guidance for entrypoint naming by runtime
- Contract tests for externally fetched artifact paths
