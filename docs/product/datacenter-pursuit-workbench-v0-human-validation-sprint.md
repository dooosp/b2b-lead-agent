# Data Center Pursuit Workbench v0 Human Validation Sprint

## Status and boundary

This packet prepares a five-person technical-sales validation sprint for PR
#206. It does not claim that a human review has occurred.

- Repository: `dooosp/b2b-lead-agent`
- Pull request: `#206` (`feat: add local Data Center Pursuit Workbench v0`)
- Frozen review commit: `8098f66c6fb7e64464297c0ee70d25f49756135d`
- Frozen base commit: `9d144fbe6309ce363f9dad8d50ffa713d24af683`
- PR state verified on 2026-07-17: `OPEN`, `DRAFT`, mergeable, reported checks passing
- Evidence boundary: `NOT_PRODUCTION_EVIDENCE`
- Data boundary: checked-in synthetic scenarios only
- Production, staging, D1, customer data, outreach, CRM, LLM, and automation:
  `HOLD`

Do not change the review build during the sprint. Before every session, confirm
that `git rev-parse HEAD` returns the frozen review commit. If PR #206 moves to
a different commit, stop the sprint and explicitly decide whether to finish on
the frozen build or restart all sessions on one new frozen build. Never combine
results from different builds in one scorecard.

The following hashes provide an additional drift check:

| Artifact | SHA-256 |
| --- | --- |
| `package-lock.json` | `a14f41c200c480e20b1f3e3ef1ccedf48155e274888b4716aeb2e1b1ba4d97cc` |
| `pursuit-workbench/fixtures/datacenter-workbench-v0.json` | `08ec7591cfd89d8af33a2ca613df8762c2a852d8946f36379dc0aaabfc365d41` |
| `docs/product/datacenter-pursuit-workbench-v0-review-guide.md` | `3000973dab91408d6e360363872e43398228d39a88d010d21d6c5803d28b366a` |

## Sprint question

Can a Korean industrial technical-sales reviewer use the bounded Workbench to
understand project stage, evidence-backed product fit, the specification
window, customer-use claim boundaries, a useful next technical question, and a
structured review packet without unsafe inference or facilitator coaching?

This sprint tests usability and product value. It does not test production
readiness or the accuracy of real project or product data.

## Reviewer roster

Recruit five reviewers and identify them only as `R1` through `R5`.

| Reviewer ID | Target role |
| --- | --- |
| `R1`, `R2` | Industrial technical sales |
| `R3`, `R4` | Application engineer |
| `R5` | Tender, specification, or design-support specialist |

Do not record names, employers, customer names, project names, contact details,
or confidential product facts. Record only the role bucket, years-of-experience
band, and anonymous reviewer ID. If fewer than five eligible sessions are
complete, the decision remains `INCOMPLETE`; do not extrapolate a merge result.

## Facilitator setup

Keep this coordination packet outside the review runtime. Create one clean,
detached review worktree for all sessions when practical:

```text
git worktree add --detach <review-worktree> 8098f66c6fb7e64464297c0ee70d25f49756135d
cd <review-worktree>
git status --short
npm ci
npm run test:pursuit-workbench
npm run demo:pursuit-workbench
```

The status command must be empty. Open only the loopback URL printed by the
demo command. Run no production, staging, Wrangler, D1, customer-data, secret,
external-provider, or outbound-contact action.

At the start of each session:

1. Confirm the frozen commit and clean worktree.
2. In the coordination checkout, create a copy of
   `datacenter-pursuit-workbench-v0-human-validation-session-template.md`.
3. Assign the next anonymous reviewer ID.
4. Explain that the data is synthetic and the product is not connected to a
   CRM, production database, or outbound communication system.
5. Ask the reviewer to think aloud. Do not explain the interface before the
   timed tasks.

Start a task timer after reading its prompt. Record time to the first correct
interpretation and total task time. Offer help only after the reviewer says
they are blocked or abandons the task. Any task that receives substantive help
is `COMPLETED_WITH_HELP`, not independently completed.

## Fixed scenario set

Show only these three scenarios. Do not add the other nine PR #206 scenarios
during the scored session.

| Scenario | Catalog ID | Expected state | Why it is included |
| --- | --- | --- | --- |
| `S1` | `strong_verified_electrical_fit` | `FIT` + `OPEN` | Verified electrical fit and an open specification window |
| `S2` | `hard_voltage_mismatch` | `NOT_FIT` + `OPEN` | Verified hard technical mismatch |
| `S3` | `conflicting_capability_claims` | `INSUFFICIENT_EVIDENCE` + `OPEN` | Conflicting evidence that must remain blocked and unresolved |

`S3` uses the current synthetic fire-detection conflict fixture only to test
conflict and claim-boundary comprehension. It does not expand the proposed
post-review claim pilot beyond `medium_voltage_switchgear` and `transformer`.

## Six scored tasks

Use the prompts verbatim. The facilitator may ask the reviewer to clarify an
answer but must not point at a control, label, or expected result.

| Task | Scenario | Prompt | Independent success evidence |
| --- | --- | --- | --- |
| `T1` | `S1` | Find the current project stage and the evidence that supports it. | Reviewer states the visible stage and points to its supporting evidence without help. |
| `T2` | `S1` | Find the most promising product family. Explain the fit result and whether the specification window is still open. | Reviewer identifies the family, `FIT`, and `OPEN`, and does not treat fit as commercial approval. |
| `T3` | `S2` | Find the hard mismatch or blocking technical gap and explain why the product cannot pass this requirement. | Reviewer identifies the voltage requirement/capability mismatch and the `NOT_FIT` result without help. |
| `T4` | `S1`, then `S3` | Find one customer-use claim that is allowed and one that is blocked. Explain why each has that state. | Reviewer distinguishes the verified allowed claim from the conflicted blocked claim and does not select a favorable conflicted value. Score the allowed and blocked checks separately. |
| `T5` | `S3` | Select the next technical question you would use in a real meeting and explain whether it would reduce the current uncertainty. | Reviewer selects a supported question and gives a domain-relevant reason it is useful, or truthfully explains why none is useful. |
| `T6` | `S3` | Create the supported structured review packet and explain what happened to it. | Reviewer selects the supported escalation, acknowledges the boundary, creates the packet, and understands it is local, not saved, not sent, and not approval. |

After the six tasks, ask the reviewer to state their own expert outcome for all
three scenarios based on the visible evidence and whether they agree with the
system outcome. Do not coach agreement. Record the three answers as the
scenario-level expert-fit agreement observations.

## Facilitator answer key

Keep this section hidden from the reviewer during the timed tasks.

- `T1`: `BASIC_DESIGN`, supported by the visible synthetic project-stage
  evidence.
- `T2`: `medium_voltage_switchgear`; the verified 22.9 kV requirement is within
  the verified 24 kV capability, so the result is `FIT` and the window is
  `OPEN`. This is not commercial approval.
- `T3`: the verified 33 kV requirement exceeds the verified 24 kV capability,
  so the result is `NOT_FIT` with `HARD_REQUIREMENT_MISMATCH`.
- `T4`: a verified capability claim in `S1` is customer-use allowed. Both
  capability claims in `S3` remain blocked with `CLAIM_CONFLICTED`; neither
  favorable value may be selected.
- `T5`: `q_control_protocol` asks which control protocols and integration
  boundaries are mandatory and requests the controls points list.
- `T6`: `ESCALATE_DOMAIN_EXPERT` with its supported claim-conflict/domain-expert
  reason is valid. The packet is local, non-persistent, not sent, and not an
  approval.
- Scenario outcomes: `S1 = FIT`, `S2 = NOT_FIT`, and
  `S3 = INSUFFICIENT_EVIDENCE`.

## Post-session questions

Ask these questions after timing ends:

1. Did the Specification Window mean something different from technical fit?
2. Could you reliably distinguish an allowed customer-use claim from a blocked
   claim?
3. Was the selected technical question useful for preparing a real meeting?
4. Would you use this packet in an internal pursuit review meeting?
5. What was the single most confusing term, screen area, or ordering choice?
6. What important information was missing?
7. How long would the same six decisions take with your current method?

The final question supplies a paired baseline only when the reviewer can give a
credible comparison. Leave it blank rather than inventing a number.

## Metric definitions

Calculate metrics only after five eligible sessions on the same frozen build.

| Metric | Calculation |
| --- | --- |
| Independent task completion | `COMPLETED_WITHOUT_HELP` task results / 30 total tasks |
| Assisted completion | (`COMPLETED_WITHOUT_HELP` + `COMPLETED_WITH_HELP`) / 30 |
| Fit agreement | Exact reviewer/system outcome matches / 15 scenario judgments |
| Claim-boundary success | Correct allowed/blocked checks / 10 checks |
| Serious misunderstanding count | Unique P0/P1 findings that produce an unsafe or materially false interpretation |
| Internal pursuit usefulness | Reviewers answering `YES` to internal-meeting use / 5 |
| Review duration | Median of five total session durations |
| Time reduction | Median of paired `(baseline - session) / baseline` values; require at least three credible baselines |

A serious misunderstanding includes treating a blocked claim as customer-use
allowed, resolving a conflict by choosing the favorable value, treating
technical fit as commercial approval, treating the packet as persisted or
sent, or confusing a closed specification window with technical mismatch.

## Results handoff

Keep one completed Markdown session form per reviewer. For machine-readable
handoff, copy `sessionRecordTemplate` once per reviewer into `sessionRecords` in
`datacenter-pursuit-workbench-v0-human-validation-results-template.json`,
replace the placeholder values, and append each finding to `findings`. Leave
`aggregate.decision` as `INCOMPLETE` until all five eligible records are
present. The user may supply either the five completed forms or the completed
JSON for analysis.

## Findings taxonomy

Record one finding per observation. Preserve the reviewer's words as a short
paraphrase; do not record identity or confidential data.

### Severity

- `P0`: Unsafe trust-boundary interpretation, private-data risk, accidental
  mutation/send implication, or a screen that makes unsupported customer use
  appear approved.
- `P1`: Prevents a normal reviewer from completing a core task, causes a
  serious fit/timing/claim misunderstanding, or creates a critical
  accessibility barrier.
- `P2`: Material friction or confusion with a workable bypass.
- `P3`: Minor copy, visual polish, or preference.

### Category

- `INFORMATION_ARCHITECTURE`
- `TERMINOLOGY`
- `FIT_EXPLANATION`
- `SPECIFICATION_WINDOW`
- `CLAIM_BOUNDARY`
- `TECHNICAL_QUESTION`
- `REVIEW_DISPOSITION`
- `REVIEW_PACKET`
- `TRACEABILITY`
- `ACCESSIBILITY_INTERACTION`
- `DATA_GAP`
- `PRODUCT_HYPOTHESIS`

### Observation type

- `MISUNDERSTANDING`
- `TASK_FAILURE`
- `FRICTION`
- `MISSING_INFORMATION`
- `POSITIVE_SIGNAL`
- `FEATURE_REQUEST`

### Reason code

- `STAGE_NOT_FOUND`
- `PRODUCT_FAMILY_NOT_FOUND`
- `FIT_RESULT_NOT_UNDERSTOOD`
- `HARD_MISMATCH_NOT_FOUND`
- `BLOCKED_CLAIM_TREATED_AS_ALLOWED`
- `CONFLICT_RESOLVED_WITHOUT_EVIDENCE`
- `FIT_CONFUSED_WITH_COMMERCIAL_APPROVAL`
- `SPEC_WINDOW_CONFUSED_WITH_FIT`
- `TECHNICAL_QUESTION_NOT_USEFUL`
- `REVIEW_DISPOSITION_NOT_UNDERSTOOD`
- `REVIEW_PACKET_ASSUMED_PERSISTED_OR_SENT`
- `TRACEABILITY_NOT_UNDERSTOOD`
- `PURSUIT_MEETING_NOT_USEFUL`
- `ACCESSIBILITY_BLOCKER`
- `OTHER`

## MERGE / REVISE / PIVOT decision gate

Select exactly one product decision. Production remains `HOLD` under every
outcome.

### `MERGE`

Recommend that the human owner mark PR #206 ready only when all conditions are
true:

- five eligible reviewers completed the sprint on the same frozen build;
- independent task completion is at least 80%;
- fit agreement is at least 80%;
- claim-boundary success is at least 90%;
- serious misunderstanding count is zero;
- at least three of five reviewers would use the output in an internal pursuit
  review;
- median review duration is at most 15 minutes, or paired median time reduction
  is at least 30% from at least three credible baselines;
- no unresolved P0 or P1 finding remains; and
- PR checks are green for the exact commit proposed for readiness.

`MERGE` is a recommendation, not authority to change Draft state or merge.

### `REVISE`

Choose `REVISE` when the five-session evidence shows that a bounded change to
information structure, terminology, fit explanation, timeline, technical
questions, review disposition, claim boundary, or packet wording can plausibly
clear a failed threshold or P0/P1 finding.

Implement only evidence-backed P0/P1 usability fixes. Freeze the new commit and
repeat all affected tasks with fresh reviewers or a clearly labeled validation
round. Do not mix the revised-build results into the original scorecard.

### `PIVOT`

Choose `PIVOT` only when five complete sessions show a core product-hypothesis
failure that a bounded usability correction cannot address, or when one
evidence-backed revision round still fails the core value gate. Examples are
fewer than three reviewers finding the internal pursuit output useful, experts
rejecting the fit model rather than its explanation, or the required evidence
being unavailable in the target workflow.

Do not choose `PIVOT` from a single reviewer, a feature request, or an
incomplete sample.

### `INCOMPLETE`

Use `INCOMPLETE` as a collection status, not a product decision, until the
required five eligible sessions and mandatory fields are present.

## Change freeze and next action

Before human findings exist:

- do not add product functionality;
- do not redesign the Workbench speculatively;
- do not collect real customer/project/product data;
- do not mark PR #206 ready; and
- do not claim production or pilot validation.

After the user supplies the five anonymized session records, calculate the
scorecard, preserve dissenting observations, choose the decision gate, and
implement only evidence-backed P0/P1 usability fixes when the decision is
`REVISE`.
