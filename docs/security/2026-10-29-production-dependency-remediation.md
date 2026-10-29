# Production dependency remediation — 2026-10-29

`npm audit --omit=dev --audit-level=moderate --json` reported four high-severity vulnerable production dependency packages at integration baseline `aef67fbea174a5db0b01d480a30f923a6b35d075`. After the scoped updates below, the same audit returned exit 0 with zero vulnerabilities. This is a registry snapshot, not a guarantee against future advisories.

| Dependency | Previous lock | Updated lock | Known patched minimum |
| --- | --- | --- | --- |
| axios | 1.18.1 | 1.20.0 | 1.20.0 |
| follow-redirects (axios) | 1.16.0 | 1.16.2 | 1.16.1 |
| nodemailer | 9.1.1 | 10.3.1 | 10.1.4 |
| undici (cheerio) | 7.29.1 | 7.30.1 | 7.30.1 |

The direct manifest floors are now `axios:^1.20.0` and `nodemailer:^10.3.1`. Only these direct specifications and the four listed lock records changed; no override or forced audit repair was introduced. The existing dev-only Miniflare dependency retains its pinned `undici@7.28.0`; this remediation and the audit result cover production dependencies only.

The required CI triage remains offline: its Axios minimum is 1.20.0, it preserves the historical 1.18 advisory inventory and appends the twelve Axios advisories from the current audit. Regression tests reject vulnerable direct manifest floors and lock versions independently and check all four known production dependency minima. The scheduled/manual `security:audit-current` workflow remains the separate mutable-registry check.

## Compatibility and validation

Nodemailer 10 requires Node 20 or newer and ships CommonJS and ES module builds; its changelog records a later CommonJS compatibility repair. The repository pins Node 24.22.1 and uses the public CommonJS `createTransport` / promise `sendMail` API. Real installed Nodemailer stream transport composes the application's publication MIME content, preserves the publication message ID and intended single/multiple-recipient envelope, and produces no SMTP delivery receipt. The application therefore continues to report unknown provider acceptance for this local transport. Stream output intentionally retains Bcc headers; it is a local composition fixture, not an SMTP wire/privacy proof.

Fresh lockfile installation succeeded. The 38 focused dependency, notification, enrichment-boundary, enrichment-replay and lead-pipeline-replay tests passed. The offline triage passed. `git diff --check` passed. Installation emitted the existing `whatwg-encoding@3.1.1` deprecation notice. Full application/integration verification is recorded separately by the integration owner.

No live provider, SMTP, scraping, production/staging endpoint, D1, deploy, customer-data or outreach action was performed. This record is `NOT_PRODUCTION_EVIDENCE`, preserves `productionReady:false`, and leaves Issue #165 `HOLD`.

## Primary sources

- [Axios 1.20.0 release](https://github.com/axios/axios/releases/tag/v1.20.0) and [redirect-guard advisory, patched in 1.20.0](https://github.com/advisories/GHSA-r4gj-5m52-g5wh).
- [follow-redirects 1.16.2 release](https://github.com/follow-redirects/follow-redirects/releases/tag/v1.16.2) and [credential-stripping advisory, patched in 1.16.1](https://github.com/advisories/GHSA-q3jh-wrc6-jgq8).
- [Nodemailer changelog](https://github.com/nodemailer/nodemailer/blob/v10.3.1/CHANGELOG.md), [recipient-parser advisory, patched in 10.1.4](https://github.com/advisories/GHSA-8c8m-p3m8-cjg8), and [local stream transport documentation](https://nodemailer.com/transports/stream).
- [Undici 7.30.1 security release](https://github.com/nodejs/undici/releases/tag/v7.30.1).
- npm registry metadata verified with `npm view <package>@<version> version engines dependencies --json` for the selected direct/transitive releases; Node engine requirements were compatible with 24.22.1.
