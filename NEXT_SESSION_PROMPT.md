# 다음 세션 프롬프트

## 현재 기준 상태

- 기준 브랜치: `master`
- 이번 refresh 기준 현재 `master` HEAD: `5776d4a` (`Merge pull request #27 from dooosp/feat/leadbrief-v1-review-contract`)
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
You are working on the B2B Lead Agent repository after the May 5, 2026 PR #27 landing refresh and the follow-up D1 lazy migration observation planning PR. Start from updated `origin/master`. Before changing code, read `AGENTS.md`, `HARDENING_PLAN.md`, `NEXT_SESSION_PROMPT.md`, `docs/exec-plans/internal-api-contract-freeze.md`, `docs/exec-plans/leadbrief-v1-contract.md`, and `docs/exec-plans/d1-lazy-migration-observation-plan.md`. Treat current `master` history as the source of truth: the latest LeadBrief merge baseline is `5776d4a`, the merge commit for `[Product] Freeze LeadBrief v1 review contract (#27)`. Wave 1 shipped via PRs #11 and #12, Wave 2 via PR #16, Wave 3 via PR #18, PR #25 shipped the P0 trust-boundary/fallback-publication baseline, and PR #27 shipped LeadBrief v1 as the central human-review unit. Preserve PR #27 facts: required LeadBrief v1 fields are `company`, `signal`, `sources`, `whyNow`, `recommendedMessage`, `confidence`, `assumptions`, `dataGaps`, and `reviewStatus`; ReviewStatus states are `NEW`, `NEEDS_REVIEW`, `APPROVED`, `REJECTED`, and `DEFERRED`; LLM leads default to `NEEDS_REVIEW` even when `verificationStatus` is `verified`; heuristic/fallback leads remain `NEEDS_REVIEW`; demo leads remain blocked from canonical publication; `status` remains the sales pipeline state and is separate from `reviewStatus`; human PATCH actions can update `reviewStatus` with validation; managed/self-service upserts preserve existing `review_status`; CSV/export/UI/self-service surfaces preserve review/trust metadata; the internal latest-published CRM contract remains backward-compatible and does not expose LeadBrief fields unless later scoped. D1 trust/review columns are lazy-migration-compatible but not production-observed until a post-deploy production write is confirmed. Production deploy, production DB writes, and production DB migration were not performed during PR #27 landing or the D1 observation planning PR. Do not claim production D1 lazy migration has been observed unless the observation plan evidence requirements are actually satisfied. Treat PR #22 as superseded by PR #25 unless it is re-scoped from current `master`. Recommended next action: use `docs/exec-plans/d1-lazy-migration-observation-plan.md` for a separately approved deploy/observe run. Do not reopen shipped findings unless you can show a current-`master` regression or a newly verified gap.
```

## 추천 다음 작업

- 운영 정리: PR #22 superseded disposition 확인 및 필요 시 current `master` 기준 re-scope/close follow-up
- 운영 준비: use `docs/exec-plans/d1-lazy-migration-observation-plan.md` for a separately approved production deploy/observe run
