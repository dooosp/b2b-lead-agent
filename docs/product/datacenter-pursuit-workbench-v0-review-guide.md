# Data Center Pursuit Workbench v0 Human Review Guide

## Review status

This packet prepares a human review; it does not claim that one has occurred. Use only the checked-in synthetic scenarios through the local loopback demo. Do not substitute real customer, project, product, or confidential data. Findings from this review are product feedback, not production evidence or authority to deploy, persist, contact, approve, or execute Issue #165 proof work.

Start from a clean checkout with:

```text
npm ci
npm run demo:pursuit-workbench
```

Open only the loopback URL printed by the command. A reviewer should be able to complete the ten tasks below in 25–40 minutes without reading source code.

## Review tasks

1. **Understand a verified fit.** Open “Verified cooling fit — open window.” State which product family is being considered, the verified technical match, the specification-window state, and one thing the screen explicitly does not claim.
2. **Verify the electrical path independently.** Open “Verified electrical fit — open window.” Identify the incoming-voltage requirement, its verified capability trace, and the product family under review without treating the taxonomy label as capability evidence.
3. **Explain a hard stop.** Open “Verified hard technical mismatch.” Identify the mismatched project requirement/capability and choose the supported technical rejection disposition and reason.
4. **Hold rather than infer.** Open “Missing project requirement,” then “Unverified product capability.” For each, identify which side lacks evidence and choose the corresponding supported hold disposition.
5. **Preserve uncertainty.** Open “Conflicting capability evidence.” Confirm both sides remain visible, no favorable value is selected, and the supported escalation records uncertainty rather than resolving it.
6. **Separate fit from timing.** Compare “Verified fit — closing window,” “Verified fit — closed window,” and “Retrofit opportunity.” Explain why technical fit and specification timing are distinct decisions.
7. **Compare product families without collapsing them.** Open “Multi-family project comparison.” Confirm each product family keeps its own fit row, disposition choices, reason choices, and technical-question scope.
8. **Escalate an unsupported interpretation.** Open “Incompatible technical unit.” Confirm the screen does not infer a conversion, offers the expert-escalation path, and shows only dossier-supported choices and reasons.
9. **Refuse to packetize an empty evaluation.** Open “No evaluable technical requirements.” Confirm there is no product-family disposition control and the packet action is disabled rather than inventing a decision.
10. **Create a local packet.** For one scenario, select a supported disposition/reason, optionally select a technical question, accept the non-claims acknowledgement, create the packet, copy it, download it, refresh the page, and confirm the selection is gone. Inspect the JSON for boundary, all three artifact hashes, `persistence:NONE`, `reviewerIdentity:NOT_COLLECTED`, and absence of free text or real data.

## Feedback record

For each task, record:

- completion: completed / completed with help / not completed;
- time to first correct interpretation and total task time;
- the first wrong interpretation, if any, using the reviewer's own words;
- the exact label, section, or ordering that caused or corrected it;
- trust: what made the evidence feel traceable or untrustworthy;
- usefulness: what decision became easier, and what information was still missing;
- accessibility or interaction friction, including keyboard, focus, zoom/mobile, contrast, copy, or download behavior;
- severity: blocks review / materially slows review / minor friction / preference.

Do not paste customer data, secrets, source contents, or reviewer identity into feedback. Refer to the synthetic scenario id and visible safe labels only.

## Pass criteria

The review supports a next-step decision only if the reviewer can reliably distinguish verified fit, mismatch, missing project evidence, missing product evidence, conflict, and specification timing; can explain that technical fit is not commercial approval; can produce a valid local packet without assuming it was saved or sent; and finds no blocking keyboard, focus, mobile, or trust/traceability defect.

Failure is useful evidence. If a reviewer cannot complete a task, preserve the task, scenario, observed misunderstanding, and severity. Do not quietly redesign semantics or widen scope during the session.

## Closeout decision

At closeout, choose exactly one:

- `HOLD_FOR_PRODUCT_CLARIFICATION` — a blocking interpretation or trust problem remains;
- `READY_FOR_ANOTHER_LOCAL_REVIEW` — fixes are local/test-safe but require another human pass;
- `LOCAL_V0_REVIEWED` — the bounded local screen is understandable enough for its stated purpose.

None of these outcomes means production ready, reviewer-workflow ready, deploy approved, persistence approved, or Issue #165 proof approved. Any follow-up implementation remains a separately scoped change.
