# Reviewer UX fixes — local validation

The September 10, 2026 user walkthrough on baseline
`62007116cba3e3425ae6e73a15f8f2dad413160d` found seven issues in the shipped
reviewer workflow. This change addresses them sequentially.

| Finding | Result | Regression coverage |
| --- | --- | --- |
| UX-01: filtered PPT navigation selects another company | PPT and roleplay links carry the lead ID. Missing targets and legacy indexes require explicit reselection. | Filtered navigation to both tools; missing/legacy target cases |
| UX-02: sign-in failures look like empty data | Managed navigation uses the entered credential without generating a report. Lists distinguish authentication, permission, service, and empty states. | Fresh sign-in; 401 recovery; controlled 403/500/503 responses |
| UX-03: detail reload loses authentication | The generic denied page can retry once with the existing browser token and offers a sign-in return link. Server authentication and private/no-store responses remain enforced. | Reload; anonymous detail denial; authenticated recovery; existing auth/cache tests |
| UX-04: feedback drafts disappear during filtering | Per-lead drafts remain in page memory, show an unsaved state, and persist only after explicit save. Successful earlier saves preserve newer edits. Navigation warns before discarding drafts. | Filter roundtrip; explicit save/reload; delayed-save race |
| UX-05: already approved leads remain the next review | Both API session metadata and the page choose NEW/NEEDS_REVIEW first, then approved risks. Completed and deferred work is not offered as a fresh review. | Mixed-status and completed queues; approved risks; UI completion state |
| UX-06: returning resets the review context | Filters and view are restored from the URL. Tool/detail return links retain that context and the lead to focus. Return destinations are limited to same-origin page paths. | Tool/detail/list roundtrip; Kanban reload; rejected external return destinations |
| UX-07: summaries bury the lead cards | Advanced filters, review summaries, and analysis tools are collapsible. Main action copy uses Korean labels. Session shortcuts reveal their controls; action feedback stays outside the collapsed overview. | Mobile card position/overflow; advanced filters; session access; visible shortcut feedback |

## Validation

- Root tests: 226 passed.
- Worker unit tests: 419 passed; Worker contract tests: 28 passed.
- Local browser tests: 13 passed, including the existing comprehensive smoke.
- `npm run check:naming` and `npm run check:schema`: passed.
- New browser coverage lives in `worker/e2e/reviewer-ux.test.mjs` and runs in
  CI through `npm run test:e2e:local`.
- HTTP fault and delayed-response fixtures block service workers in their
  isolated test contexts so browser interception cannot be bypassed. The other
  browser scenarios and existing cache tests exercise the normal PWA behavior.
- Direct in-app browser checks covered fresh credential entry, filtered PPT
  selection, return-filter preservation, and detail reload.

With the same local seed and default collapsed view, the first lead card starts
at approximately 653px on a 1280×720 desktop viewport and 774px on a 390×844
mobile viewport. The original walkthrough measured approximately 2,957px and
5,473px respectively. Mobile document width remains within the viewport.

## Boundary

All validation uses synthetic data, fake D1, and loopback servers. The evidence
is `NOT_PRODUCTION_EVIDENCE` and `productionReady:false`. This work does not
deploy, access remote D1 or customer data, run live generation, or introduce a
new authentication/session provider. Generated suggestions remain copy-only;
feedback drafts use page memory, not browser storage or an additional database.
