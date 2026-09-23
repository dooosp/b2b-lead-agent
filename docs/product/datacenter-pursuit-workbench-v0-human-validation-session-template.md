# Data Center Pursuit Workbench v0 Human Validation Session Scratchpad

> Tracked Markdown facilitator scratch/template only. It is never machine
> input. Do not complete it with reviewer observations and do not make tracked
> copies. Actual records exist only as `session-r1.json` through
> `session-r5.json` in the ignored fixed directory
> `tmp/pursuit-workbench-human-validation/`.

Prepare blank private records once:

```text
npm run prepare:pursuit-workbench-human-validation
```

The command exclusively creates all five files with mode `0600` and refuses to
overwrite any existing intake content. It accepts no output-path option. The
blank skeletons prefill only fixed contract data: anonymous reviewer ID,
target-role bucket, scenario/task coverage, and frozen runtime hashes. All
human observations, eligibility, dates, confirmations, outcomes, durations,
judgments, descriptors, and findings remain blank.

## Fixed session coverage

| Reviewer | Required role bucket |
| --- | --- |
| `R1`, `R2` | `INDUSTRIAL_TECHNICAL_SALES` |
| `R3`, `R4` | `APPLICATION_ENGINEER` |
| `R5` | `TENDER_SPEC_DESIGN_SUPPORT` |

Every reviewer attempts `T1` through `T6` and judges all three fixed scenarios:

- `strong_verified_electrical_fit`: `T1`, `T2`, and the allowed-claim half of
  `T4`; expected outcome `FIT`;
- `hard_voltage_mismatch`: `T3`; expected outcome `NOT_FIT`; and
- `conflicting_capability_claims`: the blocked-claim half of `T4`, `T5`, and
  `T6`; expected outcome `INSUFFICIENT_EVIDENCE`.

## Structured values

- experience: `0_4_YEARS`, `5_9_YEARS`, `10_PLUS_YEARS`;
- task outcome: `COMPLETED_WITHOUT_HELP`, `COMPLETED_WITH_HELP`,
  `NOT_COMPLETED`;
- help: `NONE`, `CLARIFY_PROMPT_ONLY`, `SUBSTANTIVE_HELP`;
- usefulness: `YES`, `PARTLY`, `NO`;
- internal use: `YES`, `MAYBE`, `NO`;
- severity: `P0`, `P1`, `P2`, `P3`; and
- session status: `NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`, `INELIGIBLE`.

Negative observations are valid evidence, not schema failures. Record task
failure, commercial-approval confusion, a failed claim check, favorable
conflict selection, or packet misunderstanding truthfully and link the
corresponding structured finding. Never change a negative value to make the
aggregate pass.

Descriptor fields are optional, single-line, and bounded. Use only a short
de-identified paraphrase when a reason code is insufficient. Never enter a name,
employer, customer/project identifier, contact detail, email, phone number,
URL, filesystem path, account/database identifier, confidential fact, token,
cookie, credential, authorization value, or secret. The validator detects
common obvious protected shapes but cannot prove that prose is anonymous; the
facilitator remains responsible for sanitization.

Validate at any time with:

```text
npm run validate:pursuit-workbench-human-validation
```

Validation output contains safe aggregate numbers, enums, anonymous record
IDs, severities, and status only. It never prints descriptors or paraphrases.
The product runtime under review remains frozen at
`8098f66c6fb7e64464297c0ee70d25f49756135d`; a later intake-tooling commit does
not change that binding.
