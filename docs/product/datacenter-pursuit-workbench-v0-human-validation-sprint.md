# Data Center Pursuit Workbench v0 Human Validation Sprint

## Status and boundary

This packet prepares a five-person local technical-sales validation sprint for
PR #206. It does not claim that a human review occurred.

- Frozen Workbench runtime: `8098f66c6fb7e64464297c0ee70d25f49756135d`
- Evidence boundary: `NOT_PRODUCTION_EVIDENCE`
- Data boundary: checked-in synthetic scenarios only
- Production, staging, D1, customer/private data, credentials, network calls,
  outreach, CRM, LLM, and automation: `HOLD`

The intake tooling is intentionally a later commit. Every session JSON record
still binds to the frozen `8098f66` Workbench runtime and to these artifact
hashes:

| Artifact | SHA-256 |
| --- | --- |
| `package-lock.json` | `a14f41c200c480e20b1f3e3ef1ccedf48155e274888b4716aeb2e1b1ba4d97cc` |
| `pursuit-workbench/fixtures/datacenter-workbench-v0.json` | `08ec7591cfd89d8af33a2ca613df8762c2a852d8946f36379dc0aaabfc365d41` |
| `docs/product/datacenter-pursuit-workbench-v0-review-guide.md` | `3000973dab91408d6e360363872e43398228d39a88d010d21d6c5803d28b366a` |

All tracked human-validation Markdown files are coordination scratch/templates
only and are never machine input. Do not store completed session content in
Git. The only accepted machine input is the exact five-file set in the ignored
fixed directory `tmp/pursuit-workbench-human-validation/`.

## Sprint question

Can a Korean industrial technical-sales reviewer use the bounded Workbench to
understand project stage, evidence-backed product fit, the specification
window, customer-use claim boundaries, a useful next technical question, and a
structured review packet without unsafe inference or facilitator coaching?

This sprint tests usability and product value only. It does not test
production readiness or real project/product accuracy.

## Safe setup

Use the frozen runtime for the local loopback-only product demonstration and
the tooling checkout only for ignored intake files. Run no production,
staging, Wrangler, D1, customer-data, secret, external-provider, or outbound
action.

In the tooling checkout:

```text
npm run prepare:pursuit-workbench-human-validation
npm run validate:pursuit-workbench-human-validation
```

Preparation verifies all frozen artifact hashes, creates exactly
`session-r1.json` through `session-r5.json` with mode `0600`, and refuses any
argument, alternate path, existing file, or non-empty intake directory. The
validator reads only that fixed directory and exact file set. It refuses extra
files, unsafe permissions, hard links, symlinks, non-regular files, duplicate
JSON keys or reviewer IDs, wrong roles/coverage, build/hash drift, protected
content, and cross-record inconsistencies. It never echoes human text.

## Reviewer roster and eligibility

Identify reviewers only as `R1` through `R5`:

| Reviewer ID | Target role |
| --- | --- |
| `R1`, `R2` | Industrial technical sales |
| `R3`, `R4` | Application engineer |
| `R5` | Tender, specification, or design-support specialist |

Do not record names, employers, customer/project names, contact details, or
confidential facts. If fewer than five eligible sessions are complete, status
remains `INCOMPLETE`.

An eligible completed session must confirm the frozen runtime and hashes, a
clean worktree, the synthetic-only boundary, no real-data or production action,
the target role, all six task attempts, all three scenario judgments, and the
mandatory post-session values. Task success is not eligibility: failures and
misunderstandings must remain truthful evidence.

## Fixed scenarios and tasks

| Task | Scenario | Prompt |
| --- | --- | --- |
| `T1` | `strong_verified_electrical_fit` | Find the current project stage and its supporting evidence. |
| `T2` | `strong_verified_electrical_fit` | Find the most promising product family, fit result, and specification-window state. |
| `T3` | `hard_voltage_mismatch` | Find and explain the hard technical mismatch. |
| `T4` | `strong_verified_electrical_fit`, then `conflicting_capability_claims` | Find one allowed and one blocked customer-use claim and explain each state. |
| `T5` | `conflicting_capability_claims` | Select the next useful technical question, or truthfully conclude none is useful. |
| `T6` | `conflicting_capability_claims` | Create the supported structured review packet and explain its local, unsaved, unsent, non-approval boundary. |

Start timing after reading each prompt. Offer substantive help only after the
reviewer is blocked or abandons the task; then record
`COMPLETED_WITH_HELP`. After the tasks, collect uncoached outcomes for all
three scenarios.

## Hidden facilitator answer key

- `T1`: `BASIC_DESIGN` with visible synthetic stage evidence.
- `T2`: `medium_voltage_switchgear`; verified `22.9 kV` requirement within
  verified `24 kV` capability; `FIT`, `OPEN`, and not commercial approval.
- `T3`: verified `33 kV` requirement exceeds verified `24 kV` capability;
  `NOT_FIT` with `HARD_REQUIREMENT_MISMATCH`.
- `T4`: the verified S1 capability claim is allowed; both S3 conflicted claims
  remain blocked with `CLAIM_CONFLICTED`; never select the favorable value.
- `T5`: `q_control_protocol`, requesting the controls-points list.
- `T6`: `ESCALATE_DOMAIN_EXPERT` with supported claim-conflict/domain-expert
  reasoning; the packet is local, unsaved, unsent, and not approval.

## Metrics and human decision gate

Calculate only from eligible completed sessions on the same frozen runtime:

- independent completion: `COMPLETED_WITHOUT_HELP / 30`;
- assisted completion: completed with or without help `/ 30`;
- fit agreement: exact reviewer/system outcome matches `/ 15`;
- claim boundary: correct allowed/blocked checks `/ 10`;
- serious misunderstandings: unique `P0/P1` findings that produced an unsafe
  or materially false interpretation, represented by the fixed reason codes;
- usefulness: internal-pursuit `YES` answers `/ 5`;
- duration: median of five session durations; and
- paired reduction: median `(baseline - session) / baseline`, requiring at
  least three credible baselines.

The timing threshold is median duration at most `900` seconds **or** paired
median reduction at least `0.30` from at least three baselines. The other
thresholds are independent completion `>= 0.80`, fit agreement `>= 0.80`,
claim boundary `>= 0.90`, serious misunderstandings `0`, usefulness at least
`3`, and unresolved `P0/P1` counts `0`.

The validator reports whether thresholds are met but never manufactures
`PASS`, `MERGE`, `REVISE`, or `PIVOT`. After five eligible sessions, its status
is `COMPLETE_FOR_HUMAN_DECISION`; a human owner makes any product decision.
Every outcome remains non-production and does not authorize a Draft-state
change, merge, deployment, or production proof.
