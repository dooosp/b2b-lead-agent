# Official Evidence Variant-Table Spike v0

Status: local/test-only experiment. `NOT_PRODUCTION_EVIDENCE`.

This spike tests whether a reviewer-supplied table map can preserve the context
that flat page-text rules lose: table title, row and column positions, column
header, product variant, conditions, and applicable footnotes. It does not
change the canonical candidate schema, review UI, review decision, registry
adapter, or review-patch exporter.

Every emitted proposition remains `REVIEW_REQUIRED`,
`productionReady: false`, and `canonicalPatchExportAllowed: false`. The source
class remains `PUBLISHER_DOMAIN_ASSOCIATED_UNREVIEWED`; file and page hashes do
not prove authenticity, currency, redistribution rights, or engineering fit.

## Fixed ignored input

The optional structured map must be the single fixed ignored file:

```text
evidence-inbox/variant-table-evidence-spec-v0.json
```

There is no arbitrary input-path option. The reader refuses a missing,
oversized, linked, escaped, changed-during-read, non-UTF-8, or malformed file.
The map is never checked in because its exact anchors contain bounded source
quotes. It may refer only to documents already accepted by the manifest-bound
`evidence-inbox/` loader.

Each table record binds one explicit product-variant column and one or more
rows. Each row declares a typed capability and semantic operator, and supplies
exact page/code-point anchors for its label and cell. Conditions require their
own anchors. Footnotes are table anchors selected by 1-based row references.
Unknown fields, product-family drift, page drift, forged offsets, invalid
variants, duplicate bindings, and missing footnotes fail closed.

The v0 experiment emits only exact scalar quantities when:

- the capability, quantity kind, and unit agree with the existing taxonomy;
- the label is a supported bounded label;
- the cell is one unambiguous scalar, with the unit in the cell or label;
- the cell follows the label on the same extracted line within 500 code points;
- the product variant is the exact canonical form of one explicit, non-generic
  header with no compound separator;
- the row has no footnote reference, because v0 does not interpret footnote
  meaning safely.

`MAXIMUM`, `MINIMUM`, `RANGE`, `ALTERNATIVES`, and `UNRESOLVED` are preserved as
operators but abstain in v0 because the current canonical value contract cannot
represent their table semantics without loss. An abstention produces no
candidate.

## Run

Use an explicit UTC instant at or after all manifest-bound retrieval/extraction
times:

```text
npm run spike:evidence-variant-table -- --as-of 2026-07-18T13:01:00.000Z
```

Standard output is a redacted count/identity summary. It excludes source
quotes, offsets, surrounding text, and the candidate payload. There is no
output-file option.

## July 18 real-input observation

The fixed ignored inbox contained eight normalized real-document records. A
two-table, two-row structured map exercised both supported product families:

- one medium-voltage switchgear exact scalar row abstained because the `S7/V7`
  header represents a compound product-variant binding;
- one transformer maximum-capacity row abstained with
  `UNSUPPORTED_SEMANTIC_OPERATOR` and produced no candidate.

Observed summary:

| Field | Value |
| --- | --- |
| evaluation instant | `2026-07-18T13:01:00.000Z` |
| input documents | 8 |
| structured tables / rows | 2 / 2 |
| experimental propositions | 0 |
| abstentions | 2 |
| evaluation SHA-256 | `a73449493dc3cb07b2c28a41446d1bea36eba1f09acf16a6eb092cda5495dfdb` |
| redacted summary SHA-256 | `8c3ceefd6e74b82f87d5e488ecb31a3c3496c6ade16518451c6151f894f6971e` |

This is not a recall target and does not turn “25 candidates” into a quota. Six
documents had no structured table map in this bounded run. The two mapped rows
also produced no safe proposition. No source was called official or current,
no proposition was approved, and no canonical patch was created.

## Promotion gate

Do not connect this experiment to canonical patch export until a separately
reviewed contract can represent non-exact operators, multi-level headers,
row/column spans, shared and conditional footnotes, and visually verified table
fidelity. That future decision also needs regression cases for OCR/layout loss
and an actual human review of each proposition. Until then, the safe outcome is
the redacted experimental summary plus abstention.
