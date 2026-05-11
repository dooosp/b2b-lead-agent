# 다음 세션 프롬프트

## 현재 기준 상태

- 기준 브랜치: `master`
- 마지막 검증된 post-PR #59 `origin/master` HEAD: `39f69fac7f9509ed657f504ee1d9a0c694a00852` (`Merge pull request #59 from dooosp/codex/stakeholder-prep-v1`)
- 다음 세션도 반드시 `git fetch origin master`와 `git rev-parse origin/master`로 실제 최신 HEAD를 다시 기록한다.
- hardening source of truth: `AGENTS.md`, `HARDENING_PLAN.md`, `docs/architecture/*.md`, `NEXT_SESSION_PROMPT.md`
- LeadBrief v1 merge baseline: `5776d4a` (`[Product] Freeze LeadBrief v1 review contract (#27)`)
- P0 trust-boundary baseline: `95c9d54` (`[P0] Harden trust boundary and fallback lead publication (#25)`)

## 최근 landed PR train

- PR #36 landed Worker route dispatch refactor:
  - `worker/index.js` is now a thin delegate to `worker/routes/dispatcher.js`.
  - Route matching, route inventory, static/page/API dispatch, and response helpers live under `worker/routes/*`.
  - Unknown `/api/*` paths return JSON `404`; known routes with unsupported methods return JSON `405` with `Allow` where route metadata knows allowed methods.
- PR #37 landed LeadBrief data-path hardening:
  - Missing LeadBrief `verificationStatus` now normalizes to conservative mode-based defaults.
  - Trust fields are covered across transforms, D1 row serialization, API serialization, CSV, and PATCH response contracts.
- PR #38 landed test architecture refactor:
  - Shared root fixtures, Worker HTTP helpers, and fake D1 helpers are the preferred test utilities.
  - Route-boundary and schema/default/error tests were consolidated around those helpers.
- PR #39 landed D1 schema drift hardening:
  - `npm run check:schema` verifies consistency between `worker/schema.sql` and `worker/db/schema.js`.
  - CI runs the schema check before `npm test`.
- PR #40 landed lead review UX metadata improvements:
  - Lead list/detail pages show review, verification, generation, confidence, evidence, and data-gap metadata more explicitly.
- PR #41 landed local release evidence toolkit:
  - `npm run evidence:packet` and `npm run test:evidence` are local-only tooling.
  - Evidence packet generation does not prove production observation.
- PR #42 landed architecture docs:
  - `docs/architecture/repo-map.md`, `docs/architecture/worker-routes.md`, and `docs/architecture/data-path.md` map the current route/data/release boundaries.
- PR #43 landed dead-code/dependency/naming cleanup:
  - News-fetcher alias wrappers are removed or routed through canonical modules.
  - `scripts/check-naming.js` guards removed alias wrapper names.
  - No package upgrades, production deploys, production DB writes, production DB access, Worker endpoint calls, or production observation claims are part of the train.
- PR #51 integrated post-train PRs #44-#49:
  - #44 Opportunity Workbench v1 is now on `master`.
  - #45 local-only Worker E2E harness is now on `master`.
  - #46 Worker auth/error hardening is now on `master`.
  - #47 synthetic lead-quality evaluation harness is now on `master`.
  - #48 current-master replacement for old dashboard unauthorized UX PR #23 is now on `master`.
  - #49 roadmap synthesis is now on `master`.
- Post-PR51 follow-ups landed:
  - #52 refreshed post-merge repo and roadmap state.
  - #53 added advisory next-review-action reasons and checklist items to Opportunity Workbench.
  - #54 added `/leads` review queue filters for review status, verification status, generation mode, confidence, and data-gap presence.
  - #55 added "why this solution" and "why now" Solution Translation Summary guidance inside Opportunity Workbench without schema, API, CRM ownership, proposal source-of-truth, or production behavior changes.
  - #56 synced source-of-truth docs after PR #55.
  - #57 added Product Context / Signal Fusion guidance inside Opportunity Workbench using only existing product, event, buyer, buying-signal, pain-point, key-figure, evidence, and review fields.
  - #58 synced source-of-truth docs after PR #57.
  - #59 added Workbench Stakeholder Prep, recutting old PR #6 as deterministic, advisory role-specific prep using existing LeadBrief/enrichment fields only.
- Stale PRs #1-#9 received disposition comments and are closed without merge or branch deletion. Treat their ideas as concept inventory only.

## Production boundary

- Issue #34 production proof work is closed out. Do not continue production proof work unless a new human-approved production prompt explicitly opens it.
- CI, docs, source inspection, local fake-D1 tests, and release evidence packets are not production D1 evidence.
- Production deploy, Wrangler deploy, Wrangler D1 execute, production Worker endpoint calls, production DB access, and production writes remain separate human-approved operations.
- The auto-filled production D1 observation confirmation draft remains `DRAFT_NOT_APPROVED` unless a human owner explicitly changes it.

## 검증 기준선

- `npm run check:naming` = canonical path/naming guard
- `npm run check:schema` = local D1 schema drift guard
- `npm run test:evidence` = release evidence toolkit tests
- `npm run test:unit` = Worker unit coverage
- `npm run test:contract` = Worker contract and trigger coverage
- `npm run test:worker` = combined Worker gate
- `npm test` = root coverage + combined Worker gate

## 다음 세션 시작 규칙

1. `origin/master` 기준으로 sync하고 repo fingerprint를 다시 확인한다.
2. 먼저 `AGENTS.md`, `HARDENING_PLAN.md`, `NEXT_SESSION_PROMPT.md`, and `docs/architecture/*.md`를 읽는다.
3. 이미 shipped 된 finding을 다시 열지 말고, 현재 `master`에서 재현되는 새 증거나 회귀가 있을 때만 follow-up으로 다룬다.
4. raw branch나 오래된 closed PR은 current `master` 기준 merge-safe artifact로 간주하지 않는다.
5. production deploy/observe/D1 work는 별도 human approval 없이는 시작하지 않는다.

## 바로 붙여 넣을 프롬프트

```text
You are working on dooosp/b2b-lead-agent after the May 11, 2026 PR train, PR #51 integration, and post-PR51 review-quality follow-ups through PR #59. Start from a fresh `origin/master` sync and prove the repo root, branch, HEAD SHA, default branch, dirty state, and available validation commands before changing code. Read `AGENTS.md`, `HARDENING_PLAN.md`, `NEXT_SESSION_PROMPT.md`, and `docs/architecture/*.md` first. Treat current `master` as the source of truth: Worker routing is split into `worker/routes/*`, LeadBrief data-path defaults are hardened, D1 schema drift has `npm run check:schema`, release evidence packet tooling is local-only, architecture docs were refreshed, cleanup/naming guards landed, Opportunity Workbench v1 is shipped, review queue filters are shipped, Solution Translation Summary is shipped, Product Context / Signal Fusion is shipped, Stakeholder Prep is a Workbench-only advisory helper, the local-only Worker E2E harness is shipped, auth/error hardening is shipped, and the synthetic lead-quality evaluator is shipped. Old PRs #1-#9 and #23 are closed concept inventory; do not reopen or merge them as-is. Do not reopen shipped findings unless you can show a current-master regression. Do not deploy, call production Worker endpoints, access or write production D1, run Wrangler deploy/D1 commands, or claim production observation without a separate human-approved production prompt.
```
