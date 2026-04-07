# Wave 2B Self-Service Source Bridge Status

## Phase: Preflight
- Verified current root, branch, package name, worktree mode, and clean git tree.
- Confirmed repo fingerprint files exist at this repo root.
- Confirmed `worker/tests/self-service-model.test.mjs` is currently absent and available for in-scope creation.
- Confirmed `AGENTS.md` and `HARDENING_PLAN.md` are absent from this worktree.

## Phase: Discovery
- Confirmed the current self-service contract exposes article query context to the model prompt but drops it during source normalization.
- Confirmed both model schema validation and repair guidance currently describe `sources` as only `title` + `url`.
- Confirmed quick-lead fallback generation also loses discovery lineage by emitting only the flattened source pair.

## Phase: Implementation
- Added a merge-safe enriched source contract in `worker/self-service/lead-utils.js`.
- Preserved `query`/discovery context on normalized sources and quick leads through optional source metadata.
- Kept `title` + `url` intact for backward compatibility while adding explicit `resolution` and `originUrl` lineage.
- Updated prompt and repair guidance so richer source metadata is allowed without fabricating canonical URLs.
- Added regression coverage for normalization, prompt/repair guidance, richer schema acceptance, and legacy compatibility.
