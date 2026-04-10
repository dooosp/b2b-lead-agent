# 다음 세션 프롬프트

## 현재 기준 상태

- 기준 브랜치: `master`
- 이번 refresh 기준 현재 `master` HEAD: `6725809` (`Update danfoss leads data`)
- hardening merge baseline: `1e2d4e6` (`hardening: separate queue acceptance from completion semantics (#18)`)
- 현재 hardening source of truth: `AGENTS.md`, `HARDENING_PLAN.md`
- 2026-04-10 운영 기준선 refresh 기준 shipped hardening 상태:
  - Wave 1: PR #11 + PR #12
  - Wave 2: PR #16
  - Wave 3: PR #18
- 현재 `master` truth 기준으로, Wave 1-3 shipped finding을 다시 여는 새 증거나 회귀는 이번 refresh에서 확인되지 않음
- 현재 운영 정리 source of truth:
  - stale open PR disposition은 `tmp/codex/ops-baseline-cleanup-2026-04/pr-cleanup-plan.md`
  - raw branch나 오래된 open PR은 current `master` 기준 merge-safe artifact로 간주하지 말 것

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
You are working on the B2B Lead Agent repository after the April 10, 2026 operational baseline refresh. Start from updated `origin/master`. Before changing code, read `AGENTS.md`, `HARDENING_PLAN.md`, and `NEXT_SESSION_PROMPT.md`. Treat current `master` history as the source of truth: the latest `master` head at this refresh is `6725809`, while the latest hardening merge baseline remains `1e2d4e6` from PR #18. Wave 1 shipped via PRs #11 and #12, Wave 2 via PR #16, and Wave 3 via PR #18. Do not reopen those findings unless you can show a current-`master` regression or a newly verified gap. Keep integration/control in one thread, do implementation in owned worktrees, and use a fresh integration artifact branch/PR when multiple lanes need to ship together. Treat stale open PRs and raw branches as historical lanes until they are re-landed from updated `master`, and preserve `docs/exec-plans/*` and `tmp/codex/*` as archival evidence unless the active task is explicitly refreshing them.
```

## 추천 다음 작업

- 운영 정리: `tmp/codex/ops-baseline-cleanup-2026-04/pr-cleanup-plan.md` 기준으로 stale open PR follow-up 실행
- 신규 개발: current `master` 기준 새 blocker audit 후 별도 task로 진행
