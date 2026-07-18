# Official Evidence Claim Review Workbench v0

Status: local/test-only engineering foundation. `productionReady: false`.
Issue #165 remains `HOLD`. This document records architecture and guardrails; it
is not production proof, legal approval, a publisher-authenticity decision, or a
record of completed human review.

## Product purpose and narrow slice

The Workbench turns a bounded, normalized source-document bundle into exact
page evidence, deterministic claim candidates, structured human decisions, and
a code-reviewable repository-review patch. Its unit of work is:

`Project Opportunity x Product Family x Specification Window x Evidence Set`

The v0 executable scope is deliberately exact:

| Dimension | Allowed values |
| --- | --- |
| Market | South Korea (`KR`) |
| Vertical | data center (`datacenter`) |
| Domain | `electrical_power` |
| Product family | `medium_voltage_switchgear`, `transformer` |
| Source language | `ko`, `en` |
| Runtime | local/test only |

Cooling, BMS, ESS, power quality, fire detection, physical security, other
countries, and generic industrial-catalog intake are refused. The existing
Claim Registry may use its canonical `datacenter_infrastructure` applicability
identifier at the final adapter boundary; that compatibility mapping does not
broaden this Workbench's tested scope.

This is not generic RAG, a PDF chatbot, a CRM, an AI SDR, an email generator,
or an arbitrary JSON editor. No LLM participates in extraction or review.

## Trust and authority boundaries

The authority flow is intentionally one-way:

```text
normalized local bundle
  -> exact page anchor
  -> deterministic candidate
  -> structured human disposition
  -> repository-review patch
  -> separate repository review
  -> existing Claim Registry authority (unchanged)
```

A source URL and digest establish location and byte/text identity, not
publisher authenticity, currentness, applicability, truth, certification, or
legal permission to reuse text. The Workbench never writes Claim Registry
trust fields. In particular, it cannot emit repository-trusted provenance,
`reviewed: true`, `verifiedAt`, `VERIFIED`, or customer-use `ALLOWED`.

The patch boundary is `NOT_PRODUCTION_EVIDENCE`. Every patch sets
`productionReady: false`, `repositoryReviewRequired: true`,
`automaticVerification: false`, and `customerUseAllowed: false`. Import preview
uses untrusted provenance and must remain `UNVERIFIED` and customer-use
`BLOCKED`. A Workbench decision means only "put this draft before a repository
reviewer"; it is not commercial, legal, compliance, engineering, or customer
communication approval.

The patch also fixes `productionReviewerWorkflowReady: false`; neither a
synthetic decision nor a future real-document review may change that field.

Reviewer identity is not collected. The Workbench stores no name, email,
session, account, free-form reviewer note, customer data, or analytics event.

## Document intake boundary

Executable tests use synthetic normalized page-text bundles. Optional real
documents are accepted only through the repository-ignored `evidence-inbox/`
root and an explicit manifest. The loader does not recursively scan arbitrary
directories. It resolves every manifest path below that root, rejects absolute
paths, traversal, symlinks, non-regular files, oversized inputs, unexpected
extensions, invalid UTF-8, and mismatched hashes. Descriptor device, inode,
link-count, size, mtime, and ctime are checked before/open/after the bounded
read; same-inode substitution fails even when size and mtime are restored.

The manifest identifies a local relative file, official source URL, publisher,
title, document type, revision, language, jurisdiction, product family,
redistribution status, and optional expected hash. Real intake is processed
only after the synthetic suite passes. Absence is a normal state reported as:

```text
REAL_DOCUMENT_POPULATION: BLOCKED_INPUT_MISSING
```

Real intake can create validated bundles, candidates, and review-ready packets.
It cannot create verified or customer-allowed claims. Real and synthetic counts
are reported separately and both `REAL_VERIFIED_CLAIMS` and
`REAL_CUSTOMER_USE_ALLOWED` are invariantly zero.

The default demo is synthetic-only. The explicit real-intake browser path is:

```text
npm run demo:evidence-claim-workbench:real -- --as-of <exact-UTC-ISO-timestamp>
```

The package command gates startup on the complete focused synthetic suite, then
loads only the fixed repository-root `evidence-inbox/`; no arbitrary directory
argument exists. The server validates the manifest-bound bundles, builds exact
anchors and deterministic candidates from that validated catalog, and labels
the API/UI mode `REAL_MANIFEST_BOUND`. Missing or unsafe intake fails before a
listener is opened. The explicit `as-of` controls chronology and patch identity.

Synthetic scenario 21 exercises this same intake implementation against a
checked-in, three-byte sentinel and a manifest with an intentionally mismatched
expected digest. The evaluator reads those fixed files without creating or
modifying any repository or temporary file; it does not infer the result from
the fixture metadata.

### Source-document bundle

`source-document-bundle-v0` contains bounded metadata, the declared source-file
byte digest, a separately recomputed normalized page-content digest, revision
and publication/retrieval dates, exact scope, redistribution state,
parser/extractor metadata, and normalized pages. Pages contain an ordinal,
explicit printed/document-page/section locator, NFC/LF-normalized text, and its
SHA-256 digest. Catalog validation detects duplicate IDs, inconsistent content
identity, contradictory metadata for the same source-file digest, invalid
revision relationships, and incompatible scope.

Metadata and page text are inspected through NFKC shadow forms and up to four
bounded percent-decoding layers for hidden identity, secret, or local-path
shapes. Canonical evidence text itself remains NFC; NFKC is used only as a
refusal shadow and is never stored as quoted evidence.

Raw PDF bytes, images, screenshots, OCR output, active content, and whole
third-party documents are not committed. v0 intentionally has no PDF parser.
Supplying PDF input returns `RAW_PDF_PARSER_UNAVAILABLE`; encrypted or malformed
PDF handling remains behind a future optional parser boundary. The supported
transport is UTF-8 normalized page-text JSON. Parser absence is visible and
cannot be disguised as successful extraction.

The extraction alternatives were evaluated explicitly:

| Option | Benefit | Cost/risk | v0 decision |
| --- | --- | --- | --- |
| A — pre-extracted bundle only | deterministic, parser-independent, network-free CI, no binary dependency | a separate authorized extraction step is required | selected |
| B — local PDF extraction command | shorter operator flow | parser/transitive dependency attack surface, malformed/encrypted/active-content handling, platform variability | deferred |
| C — bundle core plus optional PDF adapter | keeps a safe core while enabling a future convenience path | still incurs Option B review/maintenance and could hide parser absence | architecture-compatible but not shipped |

Any future parser adapter requires a separate dependency/security decision,
lockfile pin, file/page/time limits, active-content and remote-resource refusal,
malformed/encrypted test cases, and validation of its output through the exact
same bundle contract. OCR and embedded-script execution remain out of scope.

Limits are enforced before expensive work: 10 inbox documents, 100 documents
per validated catalog, 100 pages per document, 20,000 code points per page,
500,000 page-text code points per document, a one-megabyte intake file, 1,000
relationship-analysis candidates, 5,000 materialized relationships, 100
approved candidates per patch, and a 500-code-point exported direct quote. The
performance harness separately exercises synthetic scaling without weakening
runtime limits.

## Evidence anchor contract

`page-evidence-anchor-v0` binds evidence to all of:

- document ID, source-file SHA-256, revision, and revision sequence;
- page ordinal and page-text SHA-256;
- normalization `page-text-nfc-lf-codepoint-v1`;
- Unicode code-point start/end offsets;
- the exact selected quote and quote SHA-256;
- occurrence index/count for repeated text;
- fixed left/right context lengths and context hashes (not the surrounding
  context text).

Normalization converts CRLF/CR to LF and applies NFC. It preserves case,
punctuation, spacing other than line endings, and meaningfully distinct Korean
or English characters. It never uses NFKC for quoted evidence. Invalid UTF-8,
lone surrogates, bidi controls, and prohibited controls fail closed.

The quote must equal the page slice at the declared offsets. A repeated quote
must carry its exact occurrence index and count. Identical text on different
pages receives different anchor identity because the page digest and ordinal
are bound. Any document, revision, page, offset, quote, or context mutation
invalidates or re-identifies the anchor; the Workbench never silently reanchors.

## Candidate authority and taxonomy

Candidates are suggestions, not claims. Deterministic non-LLM extraction uses
versioned rule IDs, exact same-sentence/table label/value/unit binding, and one
semantic value per anchor. v0 candidate claim types are bounded to product
capability, performance, certification, and technical requirement. Typed values
are exactly quantity, range, enum, and string-set where their units and
semantics are explicit.

The exact families are medium-voltage switchgear and transformer. Candidate
keys include rated/primary/secondary voltage, transformer capacity, efficiency
class, explicit certifications, installation or operating conditions, and
explicit limitations. Standards mentioned without a certification assertion
are not upgraded into certification claims.

Marketing language, ambiguous/multiple numbers, missing or incompatible units,
negated or merely optional assertions, unresolved footnotes, unsupported
families, and unbound values yield no ready candidate. The domain contract has a
manual structured-candidate path, while the browser editor starts from a bound
deterministic suggestion; both use the same validators and never expose
editable trust/status fields. v0 does not offer arbitrary quote typing.

Candidate identity hashes the complete normalized semantic payload and anchor.
A reused candidate ID with changed content fails closed. Display confidence is
not an authority field and v0 does not compute a probabilistic confidence.

Certification and protocol extraction requires bounded affirmative grammar;
a bare standard/protocol token is insufficient. Negative, withdrawn, disabled,
pending, planned, future, application-stage, target, and mixed positive/negative
status text yields no positive candidate. The same conservative rule applies to
tentative numeric facts whose status cannot be represented faithfully in v0.

## Human decision, conflict, and supersession

The allowed dispositions are:

- `APPROVE_FOR_REPOSITORY_REVIEW`
- `REJECT`
- `DEFER_MISSING_CONTEXT`
- `FLAG_CONFLICT`
- `FLAG_SUPERSEDED`
- `FLAG_SOURCE_AUTHENTICITY`

Reasons are selected from fixed reason codes; there is no free-form review
field. Approval requires a valid document and page anchor, complete candidate
scope/value/conditions, explicit acknowledgements, and no unresolved source-
authenticity, conflict, or supersession flag. Editing a document, page, quote,
candidate field, relationship, or disposition invalidates dependent review
state and requires a fresh decision.

Relationship analysis compares family, semantic key, conditions, effective
dates, document series/revision sequence, and typed value. Later revision in the
same series may supersede an earlier candidate. Incompatible overlapping values
produce a material conflict. Explicitly different operating conditions prevent
a false conflict but remain visible. The engine never picks the favorable value.
Every document in an approved candidate's declared revision series is carried
as source context, including revisions with no candidate. Approval from any
document that has a declared successor is refused.

## Deterministic review patch

The patch includes only bounded source metadata, exact anchors and excerpts,
normalized candidate semantics, relationship IDs, structured decisions/reasons,
and the fixed no-authority boundary. It excludes source binaries, complete
pages, page images, OCR assets, local/absolute paths, query credentials,
reviewer identity, customer/private data, free text, and generated suggestions.

Each direct quote is at most 500 Unicode code points; aggregate source excerpts
are at most 1,500 code points; the canonical patch is at most 256 KiB. Limits
fail rather than truncate. Canonical key and array order plus SHA-256 give a
repeatable patch ID. The CLI imports only a bounded regular JSON file and emits
the canonical patch to standard output; it has no destination or overwrite
option. Export refuses unsafe artifact fields, non-JSON input, and any patch
that claims verified/allowed/production authority.

The thin patch binds projected page length, locator, offset, quote, occurrence,
and context-hash commitments. Because it intentionally excludes complete page
text, standalone patch validation cannot independently recount occurrences or
prove publisher authenticity; repository review must re-open the source bundle
and compare those commitments. This limitation is why the patch never grants
verification or customer use.

## Local Workbench and browser security

The server defaults to `127.0.0.1` and accepts only parsed loopback hosts
(`127.0.0.1` or `::1`); `0.0.0.0`, LAN interfaces, and non-loopback hosts are
rejected. It has a fixed route/method/content-type/body-size allowlist,
validates `Host`, `Origin`, and fetch metadata, emits no request/body/token logs,
and makes no outbound request. Data APIs require an in-memory per-process random
capability header that is neither a URL parameter nor a cookie.

Responses use `Cache-Control: private, no-store, max-age=0`, `Pragma: no-cache`,
`X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, restrictive
Permissions Policy, same-origin isolation headers, `X-Frame-Options: DENY`, and
a CSP with `default-src 'none'`; only same-origin script, style, and connection
are admitted. Active document content is never executed. Server rendering
escapes HTML; browser rendering uses `textContent` and explicit DOM properties.

Review state lives only in page memory. There is no cookie, service worker,
IndexedDB, local/session storage, cache API, server-side session, analytics,
telemetry, or implicit filesystem write. Reload clears review state. Copy and
download require explicit user action and show accessible status feedback.

The three-column interface is a document/revision queue, exact page/quote view,
and structured candidate/decision/trust/patch view. Native labels, fieldsets,
legends, error summary, focus restoration, live status, visible focus, non-
color status labels, keyboard traversal, reduced motion, mobile reflow, and
copy/download feedback are required. No keyboard shortcut silently approves a
candidate.

## Synthetic evaluation matrix

The deterministic suite contains exactly 35 categories:

| # | Scenario | Expected safety outcome |
| ---: | --- | --- |
| 1 | valid switchgear datasheet | accept, bound capability candidate |
| 2 | valid transformer datasheet | accept, bound capability candidate |
| 3 | Korean product document | accept Korean exact quote |
| 4 | English product document | accept English exact quote |
| 5 | quantity capability | one typed quantity |
| 6 | range capability | one typed range |
| 7 | certification statement | certification only when explicit |
| 8 | operating-condition statement | preserve condition |
| 9 | limitation/disqualifier | preserve limitation, review required |
| 10 | table-like extracted text | bind label/value on one page |
| 11 | repeated quote on one page | require occurrence index/count |
| 12 | same quote on different pages | page-specific anchors differ |
| 13 | superseded revision | detect supersession |
| 14 | conflicting revision | detect material conflict |
| 15 | conditions resolve apparent conflict | no false material conflict |
| 16 | missing revision | reject document |
| 17 | future-dated document | reject document |
| 18 | malformed source URL | reject document |
| 19 | source URL with credentials | reject document |
| 20 | private source URL | reject document |
| 21 | source-file hash mismatch | reject document |
| 22 | page-text hash mismatch | reject document |
| 23 | quote absent from page | reject anchor |
| 24 | ambiguous unit | no ready candidate |
| 25 | incompatible unit | no ready candidate |
| 26 | unsupported product family | reject document/candidate |
| 27 | marketing-only statement | no candidate |
| 28 | secret-shaped text | reject and never export value |
| 29 | personal-information-shaped text | reject and never export value |
| 30 | oversized page | reject before extraction |
| 31 | excessive page count | reject before extraction |
| 32 | duplicate document ID | reject catalog |
| 33 | duplicate candidate ID with changed content | reject candidate set |
| 34 | encrypted/malformed raw PDF without parser | `RAW_PDF_PARSER_UNAVAILABLE` |
| 35 | unsupported file type | reject intake |

Oversized inputs are generated during the test, not stored as large tracked
fixtures. All organizations, products, URLs, quotations, identifiers, and dates
are synthetic. No third-party document content is checked in.

Precommitted deterministic thresholds are 10,000 basis points for overall
35-scenario pass rate, quote binding, candidate identity repeat equality,
candidate extraction precision, review-decision fixture classification,
candidate extraction recall, conflict detection, supersession detection, patch determinism, and repeated-run
hash equality. Leakage of automatic VERIFIED, automatic ALLOWED, secrets, and
private data must be zero; external requests, persistence writes, and browser
storage writes must be zero. Thresholds are not tuned after observation.

The test suite independently pins the ordered 35-scenario semantic digest, the
complete evaluator digest, and a separate two-case review-decision oracle
digest. The oracle contains one literal valid artifact and one literal invalid
acknowledgement artifact with precommitted decision IDs; the evaluator feeds
them only to the decision validator and never creates or re-identifies them at
runtime. Input, expectation, threshold, or oracle drift therefore requires an
explicit reviewed digest update.

Performance measurements cover 1/10/100 documents, 1/10/100 pages per logical
document (including aggregate 1,000-page measurement input where the batch
harness permits it), 10/100/1,000 candidates, and 1/10/100 repeated quote
occurrences. Each phase has a five-second local upper bound, serialized output
is reported, and heap delta must stay below 256 MiB. Timing and heap observations
are excluded from deterministic report hashes.

Relationship analysis accepts at most 1,000 candidates and materializes at most
5,000 relationships. The dense 1,000-candidate performance case must fail closed
with `TOO_MANY_RELATIONSHIPS`; this is a bounded safety result, not successful
half-million-pair materialization. Patch approval remains separately capped at
100 candidates.

## Commands and verification contract

```text
npm run test:evidence-claim-workbench
npm run test:evidence-claim-workbench:e2e
npm run eval:evidence-claim-workbench
npm run audit:evidence-documents
npm run export:evidence-claim-review -- --input <patch.json>
npm run measure:evidence-claim-workbench
npm run test:evidence-claim-workbench:sensitivity
npm run demo:evidence-claim-workbench
npm run demo:evidence-claim-workbench:real -- --as-of <exact-UTC-ISO-timestamp>
```

The audit reports document type, family, language, jurisdiction, hash/revision/
URL/page status, candidate and decision counts, conflicts, supersessions, quote
binding failures, unsafe-field failures, and real/synthetic separation. The
evaluation prints every required metric and exits nonzero below the fixed
threshold. The focused test command includes server, renderer, domain,
adversarial, benchmark, and performance tests; the separate E2E command runs
local Playwright. CI is deterministic and network-free except for dependency/
browser installation performed by existing workflow infrastructure.

The real-intake demo is deliberately not run in CI because the ignored inbox is
an operator-provided local input. Its command still enforces the synthetic suite
before loading any real bundle, and server/integration tests exercise the same
manifest-to-browser catalog path with generated non-production test data.

Exact command results belong to the generated machine-readable reports and the
Draft PR verification evidence for the commit under review; they must not be
copied forward from a different SHA. A timing observation is not a production
service-level claim.

### Last local synthetic verification before Draft PR review

These results describe this working-tree implementation and must be rerun after
any change:

| Command | Exact deterministic/result summary |
| --- | --- |
| `npm run eval:evidence-claim-workbench` | PASS; 35/35 scenarios; TP 12 / FP 0 / FN 0; all required quality metrics 10,000 bp; all authority/secret/private/network/persistence/storage leakage counts 0; canonical SHA-256 `45b83a7eefe4df63fb29b7f763136c6e48765931a82a92ba77f077ca28ff37d1` |
| `npm run audit:evidence-documents` | PASS; 39 synthetic records; 26 bundle-normalized, 13 expected bundle refusals; source URL stages 33 passed / 3 failed / 3 not evaluated; revision stages 31 passed / 2 failed / 6 not evaluated; 28 deterministic candidate observations; 1 material conflict; 1 supersession; optional real population `BLOCKED_INPUT_MISSING`; 0 violations |
| `npm run export:evidence-claim-review` | PASS; canonical synthetic patch `patch_d03679daf569ff69592b2958d0cffd652f7721691fbaf82bc21374d936ea9f1e`; 5,012 bytes; registry preview remains `UNVERIFIED` / `BLOCKED` |
| `npm run measure:evidence-claim-workbench` | PASS; covers 1/10/100 documents, 100/1,000 pages, 10/100/1,000 candidates, manifest audit, anchors, conflicts, patch, and 100-document HTML render; every phase below 5,000 ms and 256 MiB heap delta in the observed local run |
| `npm run test:evidence-claim-workbench` | PASS; 103 tests, 0 failures, 0 skipped, 0 todo on current Node and Node 20 |
| `npm run test:evidence-claim-workbench:e2e` | PASS; 4 Playwright tests, 0 failures, 0 skipped, 0 todo on current Node and Node 20 |
| `npm run test:evidence-claim-workbench:sensitivity` | PASS; 22/22 isolated mutations detected; 0 escapes; originals unchanged; temporary copies removed |

`npm run test:evidence-claim-workbench`, the separate local Playwright command,
and the repository-wide gates are final-integration checks. Their exact final
counts belong in the Draft PR evidence after the owning commit is fixed.

## Compatibility and non-goals

The existing Claim Registry remains the only verification/customer-use
authority. Specification Fit, trusted-reference projection, LeadBrief, and all
production boundaries are unchanged. PR #206 remains a separate Draft human-
validation packet and is not rewritten or represented as completed validation.

Not included: live scraping or research, outbound network calls, PDF/OCR parser,
third-party binary storage, production or staging deploy, D1 access/migration/
write, logs or secrets, customer/private data, real auth/session/reviewer
identity, retention enforcement, CRM, outreach, email, LLM calls, automatic
workflow, generated-suggestion persistence, or production-readiness claims.

## Residual risks and follow-up

- Hashes do not prove publisher authenticity or that a document is the latest.
- Page-text supplied by a human/tool may not faithfully reproduce the original
  visual table; the reviewer must compare it with an authorized local source.
- Exact deterministic rules intentionally miss facts expressed ambiguously.
- Korean/English terminology and units can remain context-sensitive.
- Conflict/supersession detection is bounded to declared series, revisions,
  conditions, and semantic keys; missing metadata may require deferral.
- A thin patch commits to anchor context/occurrence metadata but cannot
  independently rederive it without the corresponding normalized source bundle.
- Browser capability tokens limit accidental cross-origin use but are not user
  authentication.
- No real-document population or human usability result exists until separately
  authorized inputs and humans are available. That absence must remain visible.

Future work may add a separately reviewed parser adapter, source-authenticity
verification, real reviewer sessions, and repository promotion tooling. Each
requires an explicit goal and must preserve Issue #165 production `HOLD` unless
a separate human approval record changes it.
