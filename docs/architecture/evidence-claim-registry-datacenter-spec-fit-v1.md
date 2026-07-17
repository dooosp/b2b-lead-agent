# Evidence Claim Registry and Data Center Specification Fit v1

Status: local/test-only foundation. `productionReady: false`. Issue #165 remains `HOLD`.

## Product thesis

This foundation is an evidence-first industrial specification opportunity copilot. Its unit is:

`Project Opportunity × Product Family × Specification Window × Evidence Set`

It is not a news summarizer, contact database, CRM, email sequencer, or generic AI SDR. It helps an internal technical-sales reviewer determine whether a project fact is supported, whether a product family has verified applicable capability evidence, what is missing or conflicting, and whether a policy-defined specification influence window may still be open.

LeadBrief remains unchanged. The new objects are a separate review layer and do not authorize outreach, approval, deployment, or a final commercial pursuit decision.

## Claim trust model

`knowledge/claim-registry/index.mjs` is the single authority for normalization, identity, status, applicability, and customer use. A model, profile object, imported status, or legacy D1 row cannot set `VERIFIED` or `ALLOWED`. Trusted projection accepts only the exact immutable registry instance materialized by `createValidatedClaimRegistry(...)`; a raw or forged registry-shaped object is rejected.

Claim types are frozen to project facts, product capabilities, technical requirements, performance, ROI, regulation, certification, reference cases, competitors, installed base, project stage, and specification window. Status is derived with this precedence:

1. `RETRACTED`
2. `CONFLICTED`
3. `EXPIRED` at `asOf >= validUntil`
4. `ASSUMPTION` for assumption provenance
5. `UNVERIFIED` for untrusted provenance, missing review, missing verification date, or incomplete evidence
6. `VERIFIED` only for repository-reviewed evidence that passes every guard

Verification requires a bound source title, normalized HTTP(S) URL, direct quote, publication date, retrieval date, verification date, valid chronology, and controlled-clock validation. URLs with credentials, fragments, private hosts, malformed schemes, or secret-shaped query keys are rejected. Future evidence, asymmetric conflict relationships, forged IDs, duplicate IDs, prototype keys, protected fields, nested secret-shaped values, and oversized inputs are rejected.

Claim IDs are SHA-256 digests of the schema version, claim type, normalized subject, statement, value, applicability, and evidence IDs. Evidence IDs separately bind normalized source metadata and the direct quote. Reviewer identity, recipients, absolute paths, secrets, and current wall-clock time are excluded.

### Verification versus customer use

Customer use is separately derived. `ALLOWED` requires:

- `VERIFIED` status;
- complete evidence;
- matching synthetic/real boundary;
- matching vertical, jurisdiction, product family, project stage, and declared conditions;
- no conflict, expiry, or retraction.

Everything else is `BLOCKED` with a stable reason code. `ALLOWED` is never stored as an editable flag.

## Legacy profile treatment

The checked-in migration inventory was generated before behavior changes from the exact post-PR204 master. It covers all managed profile `productKnowledge`, `globalReferences`, `categoryConfig` claim fields, competitor labels, discovery queries, and the 36 mirrored `reference_library` seeds.

- 160 candidates: Danfoss 52, LS Electric 53, Siemens 55
- 0 verified, 139 unverified, 21 assumptions
- 160 missing sources, quotes, and verification dates
- 160 customer-use blocked
- 36 source-empty/verification-date-empty reference seed objects

The audit regenerates the inventory from current profile files, checks the reference-seed object count, and fails if the checked-in inventory is stale. Existing profile and reference CRUD data are not deleted or rewritten.

The bounded compatibility integration is Candidate A: root qualification and Worker proposal reference paths receive only `projectTrustedReferences(...)`. With no validated registry and exact applicability context, they receive no reference evidence. Legacy D1 rows remain available through existing CRUD APIs but are not a trust authority. Explicit demo fallbacks use bounded “technical validation required” language and do not read legacy ROI, policy, pitch, or reference assertions. Product lineup names remain candidate taxonomy only; they do not establish capability, fit, ROI, certification, availability, or compliance.

This PR does not rewrite historical LeadBrief/report/email/PPT artifacts or every downstream legacy consumer. Older stored text and unintegrated downstream paths can still contain legacy fields, so downstream claim-aware artifact migration remains a residual risk; it must not be described as registry-verified or customer-use `ALLOWED`.

## Data Center Infrastructure vertical v0

The vertical is explicitly policy guidance and synthetic evaluation, not verified market truth. It covers:

- cooling and heat rejection;
- electrical distribution, resilience, storage, and power quality;
- BMS/BEMS, protocol integration, monitoring, and commissioning interfaces;
- fire detection, access control, and physical-security integration.

Stable generic product families are:

- `hvac_drive`
- `oil_free_compressor`
- `medium_voltage_switchgear`
- `transformer`
- `energy_storage`
- `power_quality`
- `building_management`
- `energy_analytics`
- `fire_detection`
- `physical_security`

Mappings from current profile product names are explicitly unverified taxonomy mappings, never capability evidence.

The bilingual alias pack uses exact normalized matches. Materially ambiguous terms such as `GIS`, `inverter`, and `인버터` fail as `AMBIGUOUS`; they are not auto-resolved.

Project stages are `UNKNOWN`, `SIGNAL`, `ANNOUNCED`, `FEASIBILITY`, `BASIC_DESIGN`, `DETAILED_DESIGN`, `SPECIFICATION`, `TENDER`, `AWARD`, `CONSTRUCTION`, `COMMISSIONING`, `OPERATION`, `RETROFIT`, and `CANCELLED`.

Specification windows are policy guidance per product family. A window can be `NOT_OPEN_YET`, `OPEN`, `CLOSING`, `CLOSED`, `RETROFIT_OPEN`, `BLOCKED_CANCELLED`, or `UNKNOWN`. A known stage must be backed by a verified, applicable, value-matching stage claim. Unknown, conflicted, retracted, mismatched, or out-of-jurisdiction stage evidence cannot produce an open window.

## Project Opportunity contract

`project-opportunity-v0` represents one project, not one account. It binds display identity, vertical, jurisdiction, stage evidence, conditions, candidate generic product families, and typed technical requirements. Requirements support boolean, enum, string, string-set, scalar quantity, and range values; `HARD`/`SOFT` priority; and `KNOWN`, `UNKNOWN`, `CONFLICTED`, or `NOT_APPLICABLE` state.

Known requirement input is not enough: its project claim must be verified, applicable, and semantically value-equivalent, including safe unit conversion. Model-owned `fitResult`, verification, customer-use, or final-decision fields are refused.

## Specification Fit Engine v0

The engine is deterministic constraint evaluation with advisory ranking. Ranking never overrides a constraint. Result precedence is:

1. verified hard mismatch → `NOT_FIT`;
2. material conflict or unknown required fact → `INSUFFICIENT_EVIDENCE`;
3. structurally matching but unverified or expired required capability → `CONDITIONAL_FIT`;
4. all hard requirements matched by verified applicable project and capability claims → `FIT`;
5. no evaluable hard requirements → `NOT_EVALUATED`.

Multiple applicable verified capability claims that disagree produce `CLAIM_CONFLICT`; the engine does not select the favorable claim. Supported unit conversions are deliberately small and explicit. Incompatible dimensions produce `UNIT_INCOMPATIBLE`.

Every result contains stable reason codes, matched/missing requirement IDs, project claim IDs, capability claim IDs, and a separate specification-window result. Output arrays are explicitly sorted and no current time enters the result.

## Pursuit Dossier v0

The deterministic JSON and Markdown dossier contains opportunity identity, stage, evidence-backed facts, assumptions, conflicts, candidate product families, the fit matrix, specification-window status, missing requirements, bounded technical questions, customer-usable claims, blocked claim metadata, reviewer next action, and explicit non-claims.

Allowed claims include claim ID, source title, source URL, direct quote, verification date, and applicability. Blocked claims expose only ID, reason, source location, and remediation. The renderer rejects protected or secret-shaped nested content and enforces a one-megabyte output ceiling.

The dossier decision scope is `TECHNICAL_FIT_AND_SPEC_WINDOW_ONLY`; `finalHumanPursuitDecision` is always `NOT_MADE`. It never recommends sending email or outreach.

## Synthetic evidence boundary and commands

All executable claim and fit fixtures use synthetic organizations, projects, sources under `https://synthetic.example/`, and a fixed `2026-06-01T00:00:00.000Z` clock. Synthetic `FIT` is not a claim about a real product, customer, regulation, or project.

```text
npm run audit:claims
npm run eval:spec-fit
npm run test:claim-spec-fit
```

The audit and evaluation are local, deterministic, network-free CI gates. They retain `productionReady: false` and Issue #165 `HOLD` in their machine-readable output.

## Non-goals and follow-up

Not included: real datasheet ingestion, real regulation/reference verification, live research, customer/private data, D1 registry persistence, claim editing UI, auth/RBAC, CRM, contact enrichment, email, outreach, automatic approval, production proof, account timeline persistence, or a Workbench redesign.

The next bounded PR is Data Center Pursuit Workbench v0: display a synthetic/local dossier, collect structured reviewer fit reasons, and connect synthetic/local signals into a project timeline. That work must remain separately scoped and approved.
