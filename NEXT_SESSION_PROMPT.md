# 다음 세션 프롬프트

## 현재 기준 상태

- 기준 브랜치: `master`
- 이번 refresh 기준 현재 `master` HEAD: `d48af7e` (`Merge pull request #32 from dooosp/docs/production-d1-observation-human-confirmation-intake`)
- LeadBrief v1 merge baseline: `5776d4a` (`[Product] Freeze LeadBrief v1 review contract (#27)`)
- hardening merge baseline: `95c9d54` (`[P0] Harden trust boundary and fallback lead publication (#25)`)
- 현재 hardening source of truth: `AGENTS.md`, `HARDENING_PLAN.md`
- 2026-05-05 PR #27 landing refresh 기준 shipped 상태:
  - Wave 1: PR #11 + PR #12
  - Wave 2: PR #16
  - Wave 3: PR #18
  - P0 trust boundary and fallback publication guard: PR #25
  - LeadBrief v1 review contract and minimum human-review baseline: PR #27
- PR #25 shipped facts:
  - `/api/internal/*` uses `API_TOKEN` only; `TRIGGER_PASSWORD` cannot access internal APIs
  - latest-published readiness failures return `503 readiness_unavailable`
  - managed/root LLM missing/failure fails closed unless explicit demo mode is enabled
  - demo leads cannot be canonical-published
  - heuristic/self-service fallback output is non-verified / needs review in payloads, UI cards, copy output, downloads, and D1 rows
  - D1 trust metadata columns are lazy-migration-compatible, not yet production-observed
- PR #27 shipped facts:
  - LeadBrief v1 is the central human-review unit across root qualification, published snapshots, D1 persistence, `/api/leads`, self-service responses, CSV/export trust metadata, and the minimum review UI.
  - Required fields: `company`, `signal`, `sources`, `whyNow`, `recommendedMessage`, `confidence`, `assumptions`, `dataGaps`, `reviewStatus`.
  - ReviewStatus states are frozen as `NEW`, `NEEDS_REVIEW`, `APPROVED`, `REJECTED`, and `DEFERRED`.
  - LLM leads default to `NEEDS_REVIEW`, even when `verificationStatus` is `verified`.
  - Heuristic and fallback leads remain `NEEDS_REVIEW`.
  - Demo leads remain blocked from canonical publication.
  - Human PATCH actions can update `reviewStatus` with frozen-state validation.
  - `status` remains the sales pipeline state and is separate from `reviewStatus`.
  - Managed/self-service upserts preserve existing `review_status` on conflict.
  - CSV/export/UI/self-service surfaces preserve review/trust metadata.
  - Internal latest-published CRM contract remains backward-compatible and does not expose LeadBrief fields unless later scoped.
  - D1 `review_status` is lazy-migration-compatible, not yet production-observed.
- Production deploy was not performed during PR #25, PR #26, or PR #27 landing.
- Production DB writes were not performed during PR #27 landing.
- First production write after deploy should be observed to confirm D1 lazy migration for trust/review columns.
- PR #22 is superseded by merged PR #25 unless re-scoped from current `master`.
- 현재 `master` truth 기준으로, shipped finding을 다시 여는 새 증거나 회귀는 이번 refresh에서 확인되지 않음
- 현재 운영 정리 source of truth:
  - stale open PR disposition은 `tmp/codex/ops-baseline-cleanup-2026-04/pr-cleanup-plan.md`
  - raw branch나 오래된 open PR은 current `master` 기준 merge-safe artifact로 간주하지 말 것
- 추천 다음 mega goal: `Production Readiness: D1 Lazy Migration Observation Plan`
  - Goal: prepare a safe deploy/observation checklist for lazy trust/review columns without performing deploy.
  - Do not implement Review Inbox v1, contract externalization, CRM expansion, PPT, RBAC, assignment, notifications, or dashboard redesign in that run.
- D1 lazy migration observation plan exists at `docs/exec-plans/d1-lazy-migration-observation-plan.md`.
- No production deploy, production DB write, production DB migration, or production-observed D1 migration claim was performed by that planning PR.
- Production D1 observation approval packet exists at `docs/exec-plans/production-d1-observation-approval-packet.md`.
- PR #31 landed the auto-extracted readiness values in the approval packet at `c9e55a81e2b27a06228d54b24a48937c66410ccd`, but those values remain candidate-only and are not approvals.
- Human confirmation intake packet exists at `docs/exec-plans/production-d1-observation-human-confirmation-intake.md`.
- PR #32 landed the human confirmation intake packet at `d48af7eff1fe5f2c5591ffc4fc33a823a5d45095`.
- Auto-filled production D1 observation confirmation draft exists at `docs/exec-plans/production-d1-observation-confirmation-draft.md` as `DRAFT_NOT_APPROVED`; all dangerous gates remain `no`, owner/policy fields remain human-only, and repo/GitHub/config facts are candidates only.
- Recommended next action: a human release owner reviews, confirms/replaces/rejects, or holds the auto-filled confirmation draft before any production deploy/observe run is attempted.

## 검증 기준선

- `npm run test:unit` = worker unit coverage
- `npm run test:contract` = worker contract and trigger coverage
- `npm run test:worker` = combined worker gate
- `npm test` = root coverage + combined worker gate

## 다음 세션 시작 규칙

1. `origin/master` 기준으로 sync하고 repo fingerprint를 다시 확인한다.
2. 먼저 `AGENTS.md`, `HARDENING_PLAN.md`, `NEXT_SESSION_PROMPT.md`를 읽는다.
3. 이미 shipped 된 finding을 다시 열지 말고, 현재 `master`에서 재현되는 새 증거나 회귀가 있을 때만 follow-up으로 다룬다.
4. integration/control은 한 스레드에서 유지하고, 구현은 scope가 좁은 owned worktree로 분리한다.
5. 여러 lane이 동시에 진행되면 raw branch를 바로 merge하지 말고 current `master` 위에서 integration artifact PR로 ship한다.

## 바로 붙여 넣을 프롬프트

```text
You are working on the B2B Lead Agent repository after the May 5, 2026 PR #27 landing refresh, the follow-up D1 lazy migration observation planning PR, the production D1 observation approval packet, PR #31 auto-extracted readiness refresh, and PR #32 human confirmation intake packet. Start from updated `origin/master`. Before changing code, read `AGENTS.md`, `HARDENING_PLAN.md`, `NEXT_SESSION_PROMPT.md`, `docs/exec-plans/internal-api-contract-freeze.md`, `docs/exec-plans/leadbrief-v1-contract.md`, `docs/exec-plans/d1-lazy-migration-observation-plan.md`, `docs/exec-plans/production-d1-observation-approval-packet.md`, `docs/exec-plans/production-d1-observation-human-confirmation-intake.md`, and `docs/exec-plans/production-d1-observation-confirmation-draft.md`. Treat current `master` history as the source of truth: the latest LeadBrief merge baseline is `5776d4a`, the merge commit for `[Product] Freeze LeadBrief v1 review contract (#27)`, PR #31 landed candidate-only auto-extracted D1 observation readiness values at `c9e55a81e2b27a06228d54b24a48937c66410ccd`, and PR #32 landed the human confirmation intake packet at `d48af7eff1fe5f2c5591ffc4fc33a823a5d45095`. Wave 1 shipped via PRs #11 and #12, Wave 2 via PR #16, Wave 3 via PR #18, PR #25 shipped the P0 trust-boundary/fallback-publication baseline, and PR #27 shipped LeadBrief v1 as the central human-review unit. Preserve PR #27 facts: required LeadBrief v1 fields are `company`, `signal`, `sources`, `whyNow`, `recommendedMessage`, `confidence`, `assumptions`, `dataGaps`, and `reviewStatus`; ReviewStatus states are `NEW`, `NEEDS_REVIEW`, `APPROVED`, `REJECTED`, and `DEFERRED`; LLM leads default to `NEEDS_REVIEW` even when `verificationStatus` is `verified`; heuristic/fallback leads remain `NEEDS_REVIEW`; demo leads remain blocked from canonical publication; `status` remains the sales pipeline state and is separate from `reviewStatus`; human PATCH actions can update `reviewStatus` with validation; managed/self-service upserts preserve existing `review_status`; CSV/export/UI/self-service surfaces preserve review/trust metadata; the internal latest-published CRM contract remains backward-compatible and does not expose LeadBrief fields unless later scoped. D1 trust/review columns are lazy-migration-compatible but not production-observed until a post-deploy production write is confirmed. Candidate values are not approvals; GitHub owner/admin is not production DB owner; CI, docs, and D1 config are not production evidence. The auto-filled confirmation draft is `DRAFT_NOT_APPROVED`, all dangerous gates remain `no`, and owner/policy assignments remain human-only. Production deploy, production DB writes, production DB access, production DB migration, and production observation were not performed during PR #27 landing, the D1 observation planning PR, the approval packet PR, the human confirmation intake packet PR, or the auto-fill draft PR. Do not claim production D1 lazy migration has been observed unless the observation plan evidence requirements are actually satisfied. Treat PR #22 as superseded by PR #25 unless it is re-scoped from current `master`. Recommended next action: a human release owner reviews `docs/exec-plans/production-d1-observation-confirmation-draft.md` and confirms/replaces/rejects/holds the candidate values; only after an approved machine-readable block exists should a separate deploy/observe prompt be considered. Do not reopen shipped findings unless you can show a current-`master` regression or a newly verified gap.
```

## 추천 다음 작업

- 운영 정리: PR #22 superseded disposition 확인 및 필요 시 current `master` 기준 re-scope/close follow-up
- 운영 준비: have a human release owner review `docs/exec-plans/production-d1-observation-confirmation-draft.md`; then use only a human-approved filled block to decide whether a separately approved production deploy/observe run is allowed
