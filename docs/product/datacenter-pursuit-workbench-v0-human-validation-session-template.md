# Data Center Pursuit Workbench v0 Human Validation Session

Copy this file once for each reviewer. Use reviewer IDs `R1` through `R5` only.
Do not record a name, employer, customer, project, contact detail, confidential
product fact, or free-form source content.

## Session metadata

| Field | Value |
| --- | --- |
| Reviewer ID | `R_` |
| Role bucket | `INDUSTRIAL_TECHNICAL_SALES` / `APPLICATION_ENGINEER` / `TENDER_SPEC_DESIGN_SUPPORT` |
| Experience band | `0_4_YEARS` / `5_9_YEARS` / `10_PLUS_YEARS` |
| Session date | `YYYY-MM-DD` |
| Facilitator ID | `F1` |
| Frozen build SHA confirmed | `YES` / `NO` |
| Clean worktree confirmed | `YES` / `NO` |
| Synthetic-only boundary explained | `YES` / `NO` |
| Production or real-data action performed | `NO` |

Required frozen build:
`8098f66c6fb7e64464297c0ee70d25f49756135d`

If any confirmation above is `NO`, stop and mark the session ineligible.

## Task results

Allowed outcome values are `COMPLETED_WITHOUT_HELP`, `COMPLETED_WITH_HELP`, and
`NOT_COMPLETED`.

### T1 - Project stage and evidence (`strong_verified_electrical_fit`)

- Outcome:
- Time to first correct interpretation, seconds:
- Total task time, seconds:
- Help given, if any:
- Reviewer's answer, anonymized paraphrase:
- First wrong interpretation, anonymized paraphrase:
- Label, section, or ordering that caused or corrected the issue:
- Finding IDs:

### T2 - Product family, fit, and window (`strong_verified_electrical_fit`)

- Outcome:
- Time to first correct interpretation, seconds:
- Total task time, seconds:
- Help given, if any:
- Reviewer's answer, anonymized paraphrase:
- Fit treated as commercial approval: `YES` / `NO`
- First wrong interpretation, anonymized paraphrase:
- Label, section, or ordering that caused or corrected the issue:
- Finding IDs:

### T3 - Hard mismatch (`hard_voltage_mismatch`)

- Outcome:
- Time to first correct interpretation, seconds:
- Total task time, seconds:
- Help given, if any:
- Reviewer's answer, anonymized paraphrase:
- First wrong interpretation, anonymized paraphrase:
- Label, section, or ordering that caused or corrected the issue:
- Finding IDs:

### T4 - Allowed and blocked customer-use claims

- Outcome:
- Time to first correct interpretation, seconds:
- Total task time, seconds:
- Help given, if any:
- Allowed-claim check on `strong_verified_electrical_fit`: `PASS` / `FAIL`
- Blocked-claim check on `conflicting_capability_claims`: `PASS` / `FAIL`
- Reviewer's explanation, anonymized paraphrase:
- Favorable conflicted value selected: `YES` / `NO`
- First wrong interpretation, anonymized paraphrase:
- Label, section, or ordering that caused or corrected the issue:
- Finding IDs:

### T5 - Next technical question (`conflicting_capability_claims`)

- Outcome:
- Time to first correct interpretation, seconds:
- Total task time, seconds:
- Help given, if any:
- Selected question or truthful no-question conclusion:
- Useful for a real technical meeting: `YES` / `PARTLY` / `NO`
- Why:
- Missing question or information:
- Finding IDs:

### T6 - Structured review packet (`conflicting_capability_claims`)

- Outcome:
- Time to first correct interpretation, seconds:
- Total task time, seconds:
- Help given, if any:
- Supported disposition selected:
- Supported reason selected:
- Packet understood as local and not saved: `YES` / `NO`
- Packet understood as not sent and not approval: `YES` / `NO`
- First wrong interpretation, anonymized paraphrase:
- Label, section, or ordering that caused or corrected the issue:
- Finding IDs:

## Scenario outcome agreement

Record the reviewer's unprompted result after the tasks.

| Scenario | System outcome | Reviewer outcome | Exact agreement |
| --- | --- | --- | --- |
| `strong_verified_electrical_fit` | `FIT` |  | `YES` / `NO` |
| `hard_voltage_mismatch` | `NOT_FIT` |  | `YES` / `NO` |
| `conflicting_capability_claims` | `INSUFFICIENT_EVIDENCE` |  | `YES` / `NO` |

## Post-session answers

- Specification Window distinguished from technical fit: `YES` / `NO`
- Allowed and blocked claims reliably distinguished: `YES` / `NO`
- Technical question useful for real meeting preparation: `YES` / `PARTLY` / `NO`
- Would use in an internal pursuit review meeting: `YES` / `MAYBE` / `NO`
- Most confusing term, screen area, or order:
- Most important missing information:
- Total review duration, seconds:
- Credible current-method baseline duration, seconds or blank:
- Accessibility or interaction friction:
- Additional product-value observation:

## Findings

Create one block per finding.

```text
Finding ID: HV-R_-___
Task: T1 | T2 | T3 | T4 | T5 | T6 | POST_SESSION
Scenario: strong_verified_electrical_fit | hard_voltage_mismatch | conflicting_capability_claims | MULTIPLE
Severity: P0 | P1 | P2 | P3
Category: INFORMATION_ARCHITECTURE | TERMINOLOGY | FIT_EXPLANATION | SPECIFICATION_WINDOW | CLAIM_BOUNDARY | TECHNICAL_QUESTION | REVIEW_DISPOSITION | REVIEW_PACKET | TRACEABILITY | ACCESSIBILITY_INTERACTION | DATA_GAP | PRODUCT_HYPOTHESIS
Observation type: MISUNDERSTANDING | TASK_FAILURE | FRICTION | MISSING_INFORMATION | POSITIVE_SIGNAL | FEATURE_REQUEST
Reason code:
Observed evidence, anonymized paraphrase:
Expected interpretation or behavior:
Candidate correction:
P0/P1 evidence-backed fix candidate: YES | NO
Requires a separate product decision: YES | NO
```

## Session eligibility and closeout

| Field | Value |
| --- | --- |
| All six tasks attempted | `YES` / `NO` |
| Mandatory fields complete | `YES` / `NO` |
| Same frozen build used throughout | `YES` / `NO` |
| No real/customer/confidential data recorded | `YES` / `NO` |
| No production action or evidence claim | `YES` / `NO` |
| Eligible for aggregate scorecard | `YES` / `NO` |
| Ineligibility reason, if any |  |

This form is local/test-safe product feedback only. It does not authorize a
product change, Draft-state change, merge, production proof, or deployment.
