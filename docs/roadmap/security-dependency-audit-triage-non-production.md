# Security Dependency Audit Triage - Non-Production

## Status

```text
DOCUMENT_STATUS: SECURITY_DEPENDENCY_AUDIT_TRIAGE_NON_PRODUCTION
DATE: 2026-06-02
REPO: dooosp/b2b-lead-agent
BASELINE_BRANCH: master
BASELINE_HEAD: bf78c2bc5f6779723eea44300978e40ca8d41574
BOUNDARY: NOT_PRODUCTION_EVIDENCE
PRODUCTION_READY: false
ISSUE_165_LEVEL_1_PROOF: HOLD
DECISION: PATCHED_WITH_SCOPED_AXIOS_1_16_0_UPDATE
```

This packet records triage for the recurring high-severity npm audit finding
seen after the Level 1 non-production work. It is local/CI dependency evidence
only. It is not production proof and does not approve production/staging
deploy, D1 access, endpoint calls, logs/secrets access, real auth/session
provider parsing, customer/private data, CRM/outreach, LLM, automation, or
production readiness.

## Audit Finding

Baseline commands run before remediation:

```bash
npm audit --json
npm audit --omit=dev --json
```

Both commands reported one vulnerable package:

| Field | Value |
| --- | --- |
| Package | `axios` |
| Dependency path | direct root dependency, `node_modules/axios` |
| Scope | production dependency, not dev-only |
| Baseline locked version | `1.15.2` |
| Baseline manifest range | `^1.15.2` |
| Baseline npm audit severity count | one high package finding |
| Fix availability | scoped 1.x update available |

Advisories reported by npm audit:

| Source | Severity | Range | URL |
| --- | --- | --- | --- |
| `1119667` | high | `>=1.0.0 <1.16.0` | https://github.com/advisories/GHSA-pjwm-pj3p-43mv |
| `1119669` | moderate | `>=1.0.0 <1.16.0` | https://github.com/advisories/GHSA-898c-q2cr-xwhg |
| `1119670` | low | `=1.15.2` | https://github.com/advisories/GHSA-654m-c8p4-x5fp |
| `1119675` | high | `>=1.0.0 <1.16.0` | https://github.com/advisories/GHSA-35jp-ww65-95wh |

## Reachability

`axios` is reachable from the root lead-generation pipeline through the
central outbound enrichment boundary:

- `enricher/outbound-http-boundary.js`
- `enricher/article-content-scraper.js`
- `enricher/article-url-resolver.js`
- `orchestrator/news-orchestrator.js`
- `lib/news-fetcher/index.js`
- `main.js`

Affected local/runtime commands and workflows:

- `npm start`
- `.github/workflows/generate-report.yml`, which runs
  `node main.js --profile "$PROFILE" --notification-requested`

`npm run email` is now notification-only and does not traverse the axios-backed
generation/enrichment path.

Worker runtime entrypoint `worker/index.js` does not import `axios`; Worker
enrichment uses Worker-native `fetch` paths instead. This triage still treats
the finding as production-scope for the root batch/report pipeline because the
dependency is declared in root `dependencies`, not `devDependencies`.

## Remediation

Applied only the scoped direct dependency update:

```text
package.json: axios ^1.15.2 -> ^1.16.0
package-lock.json: node_modules/axios 1.15.2 -> 1.16.0
```

No `npm audit fix --force`, major dependency upgrade, production/staging
command, D1 command, endpoint call, log/secret access, or broad dependency
rewrite was used.

## Post-Remediation Audit

Commands run after remediation:

```bash
npm audit --json
npm audit --omit=dev --json
```

Both commands returned zero vulnerabilities:

```text
info: 0
low: 0
moderate: 0
high: 0
critical: 0
total: 0
```

Dependency tree after remediation:

```text
b2b-lead-agent@1.0.0
└─┬ axios@1.16.0
  ├── follow-redirects@1.16.0
  ├── form-data@4.0.5
  └── proxy-from-env@2.1.0
```

## CI-Visible Triage Artifact

`npm run security:audit-triage` writes:

```text
tmp/codex/security-dependency-audit-triage-non-production.json
```

The script is intentionally offline and scoped to this known direct dependency
floor. It fails if the manifest or lockfile drops `axios` below `1.16.0`, but it
does not fail CI on unrelated future npm advisory noise. Live ecosystem audit
checks remain explicit validation commands, not production evidence.

## Risk Owner And Follow-Up

| Item | Value |
| --- | --- |
| Risk owner | `@dooosp / Taeho Jang` |
| Follow-up | Keep `npm audit --json`, `npm audit --omit=dev --json`, `npm run security:audit-triage`, and `npm run check:enrichment-boundary` in local/PR validation when dependency or outbound HTTP surfaces change. |
| Residual risk | Future axios advisories or root pipeline outbound HTTP behavior changes require a new scoped triage. The current local/test boundary packet is `docs/roadmap/outbound-http-enrichment-boundary-guards-non-production.md`. |
| Production boundary | Issue #165 remains HOLD; this packet does not change Level 1 proof status. |

## Non-Claims

- Not production proof.
- Not production readiness.
- Not staging or production execution.
- Not D1 observation, migration, read, write, delete, or schema proof.
- Not endpoint smoke testing.
- Not logs/secrets access.
- Not customer/private data evidence.
- Not real auth/session/provider parsing.
- Not CRM/outreach/LLM/automation action.
- Not a claim that all future dependency risk is eliminated.
