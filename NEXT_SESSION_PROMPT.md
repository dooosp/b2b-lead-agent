# 다음 세션 프롬프트

## 현재 기준 상태

- 기준 브랜치: `master`
- 이번 refresh 기준 현재 `master` HEAD: `95c9d54` (`Merge pull request #25 from dooosp/p0/trust-boundary-and-fallback-publish-guard`)
- hardening merge baseline: `95c9d54` (`[P0] Harden trust boundary and fallback lead publication (#25)`)
- 현재 hardening source of truth: `AGENTS.md`, `HARDENING_PLAN.md`
- 2026-05-05 PR #25 landing refresh 기준 shipped hardening 상태:
  - Wave 1: PR #11 + PR #12
  - Wave 2: PR #16
  - Wave 3: PR #18
  - P0 trust boundary and fallback publication guard: PR #25
- PR #25 shipped facts:
  - `/api/internal/*` uses `API_TOKEN` only; `TRIGGER_PASSWORD` cannot access internal APIs
  - latest-published readiness failures return `503 readiness_unavailable`
  - managed/root LLM missing/failure fails closed unless explicit demo mode is enabled
  - demo leads cannot be canonical-published
  - heuristic/self-service fallback output is non-verified / needs review in payloads, UI cards, copy output, downloads, and D1 rows
  - D1 trust metadata columns are lazy-migration-compatible, not yet production-observed
- Production deploy was not performed during PR #25 landing.
- First production write after deploy should be observed to confirm D1 lazy migration.
- PR #22 is superseded by merged PR #25 unless re-scoped from current `master`.
- 현재 `master` truth 기준으로, shipped finding을 다시 여는 새 증거나 회귀는 이번 refresh에서 확인되지 않음
- 현재 운영 정리 source of truth:
  - stale open PR disposition은 `tmp/codex/ops-baseline-cleanup-2026-04/pr-cleanup-plan.md`
  - raw branch나 오래된 open PR은 current `master` 기준 merge-safe artifact로 간주하지 말 것
- 다음 product mega goal: LeadBrief v1 Contract + Human Review UX Freeze

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
You are working on the B2B Lead Agent repository after the May 5, 2026 PR #25 landing refresh. Start from updated `origin/master`. Before changing code, read `AGENTS.md`, `HARDENING_PLAN.md`, and `NEXT_SESSION_PROMPT.md`. Treat current `master` history as the source of truth: the latest `master` head at this refresh is `95c9d54`, the merge commit for `[P0] Harden trust boundary and fallback lead publication (#25)`. Wave 1 shipped via PRs #11 and #12, Wave 2 via PR #16, Wave 3 via PR #18, and the P0 trust-boundary/fallback-publication baseline via PR #25. Preserve the shipped PR #25 facts: `/api/internal/*` is API_TOKEN-only, `TRIGGER_PASSWORD` cannot access internal APIs, latest-published readiness lookup failures return `503 readiness_unavailable`, managed/root LLM missing/failure fails closed unless explicit demo mode is enabled, demo leads cannot be canonical-published, heuristic/self-service fallback output is non-verified / needs review across payloads/UI/copy/download/D1, and D1 trust columns are lazy-migration-compatible but not production-observed until the first post-deploy production write is confirmed. Production deploy was not performed during PR #25 landing. Treat PR #22 as superseded by PR #25 unless it is re-scoped from current `master`. The next product mega goal is LeadBrief v1 Contract + Human Review UX Freeze. Do not reopen shipped findings unless you can show a current-`master` regression or a newly verified gap.
```

## 추천 다음 작업

- 운영 정리: PR #22 superseded disposition 확인 및 필요 시 current `master` 기준 re-scope/close follow-up
- 신규 개발: LeadBrief v1 Contract + Human Review UX Freeze
