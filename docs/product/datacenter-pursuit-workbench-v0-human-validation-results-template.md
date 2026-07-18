# Data Center Pursuit Workbench v0 Human Validation Results Scratchpad

> Tracked Markdown scratchpad only. This file is never machine input and must
> never contain completed reviewer records, names, contact details, private
> facts, secrets, URLs, or copied JSON. The validator reads only the five
> ignored files in `tmp/pursuit-workbench-human-validation/`.

## Frozen product runtime

Sessions remain bound to Workbench runtime
`8098f66c6fb7e64464297c0ee70d25f49756135d`, even though the later tooling
commit that adds this scratchpad and the intake CLIs moves the PR head.

| Artifact | Required SHA-256 |
| --- | --- |
| `package-lock.json` | `a14f41c200c480e20b1f3e3ef1ccedf48155e274888b4716aeb2e1b1ba4d97cc` |
| `pursuit-workbench/fixtures/datacenter-workbench-v0.json` | `08ec7591cfd89d8af33a2ca613df8762c2a852d8946f36379dc0aaabfc365d41` |
| `docs/product/datacenter-pursuit-workbench-v0-review-guide.md` | `3000973dab91408d6e360363872e43398228d39a88d010d21d6c5803d28b366a` |

## Safe aggregate transcription

After running `npm run validate:pursuit-workbench-human-validation`, a human
may transcribe only non-sensitive aggregate values here. Do not paste stdout,
session JSON, descriptors, paraphrases, or finding text.

| Field | Aggregate value |
| --- | --- |
| Collection status | `INCOMPLETE` / `COMPLETE_FOR_HUMAN_DECISION` |
| Eligible reviewer count |  |
| Independent task completion count / total |  |
| Exact scenario agreement count / total |  |
| Claim-boundary success count / total |  |
| Serious misunderstanding count |  |
| Internal-pursuit useful reviewer count |  |
| Median review duration, seconds |  |
| Credible paired-baseline count |  |
| Median paired time-reduction rate |  |
| Unresolved `P0` / `P1` counts |  |
| Threshold summary | `INCOMPLETE` / `MERGE_THRESHOLDS_MET` / `MERGE_THRESHOLDS_NOT_MET` |

The machine aggregate never selects `MERGE`, `REVISE`, or `PIVOT`. Those remain
human product decisions. Five eligible completed sessions are required before
the collection status can leave `INCOMPLETE`; no blank or synthetic record is
treated as a pass.

## Threshold reminder

- independent task completion: at least `24 / 30`;
- exact fit agreement: at least `12 / 15`;
- claim-boundary success: at least `9 / 10`;
- serious misunderstandings: `0`;
- internal-pursuit usefulness: at least `3 / 5`;
- unresolved `P0` and `P1`: `0`; and
- timing: median duration at most `900` seconds **or** at least three credible
  paired baselines with median time reduction at least `0.30`.

This is `NOT_PRODUCTION_EVIDENCE`. It does not authorize a Draft-state change,
merge, production or staging action, D1 access, customer data, outreach, CRM,
LLM use, automation, or deployment.
