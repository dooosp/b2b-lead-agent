# Official Evidence Claim Review Workbench v0 — reviewer guide

Status: local/test-only guide. It records no completed human session and grants
no production, customer-use, commercial, legal, or technical approval.

## Before reviewing

Use only an authorized local source. Confirm that the document shown is the
intended publisher, title, document type, revision, publication/retrieval date,
language, jurisdiction, and product family. A matching hash proves only that the
normalized bytes/text did not change; it does not prove officiality or truth.

The supported slice is South Korea data-center electrical power for
`medium_voltage_switchgear` and `transformer`, in Korean or English. Stop if the
source or proposed claim is outside that slice. Do not enter names, email
addresses, customer information, secrets, legal advice, or free-form notes.

For optional real intake, copy
`docs/product/official-evidence-intake-manifest-template-v0.json` to the ignored
`evidence-inbox/manifest.json`, replace every placeholder, and set
`byteLength` to the exact byte length of the referenced normalized JSON bundle.
Add optional `expectedSha256` only when the exact normalized-bundle file digest
is already known. The source URL, publisher, document number, revision, scope,
and redistribution status must exactly match the bundle; mismatch fails the
whole intake. Do not place a PDF, customer/private document, or source binary in
the inbox. The checked-in template is not a real source or authenticity claim.

The default demo remains synthetic and never auto-loads the inbox. After the
manifest and normalized JSON bundle are ready, launch the opt-in real-intake
path with an explicit UTC evaluation instant:

```text
npm run demo:evidence-claim-workbench:real -- --as-of 2026-07-18T00:00:00.000Z
```

That command first runs the complete focused synthetic Workbench suite. Only if
it passes does the server load the fixed repository-root `evidence-inbox/`
manifest. There is no CLI option for an arbitrary intake directory. The browser
must label the catalog and every document `REAL_MANIFEST_BOUND`; any invalid,
missing, changed, or out-of-scope input fails before the loopback server starts.
Use the actual review date/time instead of copying the example timestamp.

## Ten review tasks

1. Confirm document identity, acquisition provenance, publisher-domain location,
   revision, and digest. `PUBLISHER_DOMAIN_ASSOCIATED_UNREVIEWED` is a neutral
   intake class, not an officiality or authenticity decision.
2. Locate the exact supporting page; do not rely on a search-result snippet.
3. Confirm that the direct quote exactly matches the selected page offsets and
   that the correct occurrence is selected when text repeats. Use the bounded
   before/after context, code-point range, and occurrence index/count shown in
   the source rail; compare the normalized source bundle, not the patch alone.
4. Classify the candidate as product capability, performance, certification, or
   technical requirement. Reject marketing language presented as a fact.
5. Check the typed value, quantity kind, unit, range endpoints, and operator.
   Reject ambiguous, multiple, or incompatible units.
6. Confirm the exact product family, `KR` jurisdiction, effective dates, and all
   installation/operating conditions or limitations stated by the source.
7. Inspect other revisions and candidates for conflicts or supersession. Do not
   select the favorable value; flag unresolved disagreement.
8. Choose a structured disposition and reason. Use defer or authenticity flag
   when context or source authority is missing. Approve only for a later
   repository review, never for customer use.
9. Inspect the complete canonical patch preview. Confirm it contains only the
   bounded excerpt, source metadata, anchor, semantics, relationships, and
   structured decision—no source page, local path, identity, secret, or private
   data.
10. Confirm the trust preview still says `UNVERIFIED`, customer use `BLOCKED`,
    repository review required, `productionReady: false`, and Issue #165 `HOLD`.

Changing a candidate field, relationship, or decision invalidates its recorded
review and patch. Switching away does not silently mutate a recorded decision;
returning to that candidate must rehydrate the exact saved fields, reason, and
acknowledgement. The reset button restores that recorded state when one exists.
Reload clears the entire browser review. There is no silent approval shortcut;
activate the decision control and explicit acknowledgement yourself.

## Disposition rubric

| Disposition | Use when |
| --- | --- |
| `APPROVE_FOR_REPOSITORY_REVIEW` | The exact source/anchor and every structured field are complete; no unresolved authenticity, conflict, or supersession issue remains. |
| `REJECT` | The source does not support the candidate, the claim is marketing-only, the type/value/unit is wrong, or it is outside v0 scope. |
| `DEFER_MISSING_CONTEXT` | A footnote, condition, table header, revision, applicability detail, or other required context is missing. |
| `FLAG_CONFLICT` | Applicable sources/revisions make materially incompatible assertions under overlapping conditions. |
| `FLAG_SUPERSEDED` | A later identified revision replaces this evidence; retain the relationship but do not promote the older candidate. |
| `FLAG_SOURCE_AUTHENTICITY` | The publisher, source URL, revision, hash, redistribution permission, or document provenance cannot be confirmed. |

Choose the most specific fixed reason shown by the Workbench. Do not put a
justification into another field. If none applies, defer and report terminology
or rubric feedback outside the data artifact without copying source text.

## Reviewer feedback rubric

This rubric is for a future, separately scheduled human session. Do not mark it
complete unless an actual participant performed the tasks.

Score each item from 1 (blocked/confusing) to 5 (clear/reliable), then record a
short non-sensitive observation outside exported evidence artifacts:

- source understanding: could the reviewer identify source, revision, and hash?
- quote selection accuracy: could the reviewer bind the intended exact text and
  disambiguate repetitions?
- structured-field clarity: were claim type, key, value, unit, family, and
  conditions understandable without editing JSON?
- conflict visibility: were competing and superseding revisions obvious?
- review time: elapsed time to reach a justified disposition (do not infer a
  target from one synthetic run);
- trust in the exported patch: could the reviewer explain every exported field
  and the later repository-review boundary?
- missing product evidence fields: what required electrical specification could
  not be represented?
- terminology confusion: which Korean/English term, acronym, quantity, or unit
  was ambiguous?

Suggested session outcome values are `INCOMPLETE`, `USABLE_WITH_FINDINGS`, and
`BLOCKED_BY_FINDINGS`. They are usability outcomes only. They cannot set a claim
to VERIFIED or ALLOWED, approve production, close Issue #165, or mark a Draft PR
ready.

## Export check

Before copying or downloading, verify:

- the patch ID is visible and stable after a no-op preview refresh;
- CLI import reads one bounded regular JSON file and prints only to standard
  output; redirecting or otherwise persisting that output is an explicit
  operator action outside the Workbench;
- there is at most one bounded excerpt per promoted candidate;
- no full page, binary, screenshot, OCR asset, local path, reviewer identity,
  customer/private datum, secret, or arbitrary note is present;
- conflicts and supersession relationships are not hidden;
- approved entries say only repository review is requested;
- automatic verification and customer use remain false.

If any check fails, do not export. Select a non-approval disposition, clear the
review by reloading, and report the failure against the local/test Draft PR.

## Known limitations

The Workbench cannot establish publisher authenticity, legal redistribution
rights, visual-table fidelity, latest revision, engineering suitability, or
compliance. It has no raw-PDF parser, OCR, live research, outbound network,
persistence, identity, production database, CRM, outreach, email, or LLM. Exact
rules trade recall for traceability; manual structured review is still required.
