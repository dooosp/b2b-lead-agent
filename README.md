# B2B Lead Agent

**프로젝트 요구사항과 제품 기술정보를 근거·적용 조건에 맞춰 비교하는 검토 도구입니다.**
근거가 확인되었는지, 그 근거를 이 프로젝트에 적용할 수 있는지, 실제 요구 조건을 충족하는지를 구분합니다.

포트폴리오 v1은 **가상 데이터센터 한 곳의 수전전압 검토**에 집중합니다. 합성 사례의 로컬·오프라인 시연이며, 실제 제품 선정이나 업무시간 절감의 증거는 아직 아닙니다.

## 먼저 볼 것

- [3분 시연 대본과 실행 안내](docs/portfolio/b2b-portfolio-v1.md)
- [실제 화면 조작과 에이전트 판단 기록](docs/portfolio/b2b-portfolio-v1-agent-simulation.md)
- [검증 결과와 근거](docs/portfolio/b2b-portfolio-v1-reproduction.md) · [기계 검증 요약](docs/portfolio/b2b-portfolio-v1-verification.json)

## 직접 실행

저장소를 내려받은 뒤 루트에서 실행합니다.

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run demo:portfolio:serve
```

출력된 `Preview: http://127.0.0.1:...` 주소를 엽니다. 서버 종료는 `Ctrl+C`입니다.
로그인·API 키·외부 서비스 설정 없이 합성 사례를 실행합니다.

서버 없이 사용할 파일만 만들려면 `npm run demo:portfolio`를 실행하고 `tmp/codex/portfolio-v1/index.html`을 브라우저로 엽니다. 이 HTML은 단독으로 복사해서 인터넷 연결 없이도 사용할 수 있습니다.

## 대표 사용 흐름

가상 프로젝트 **Synthetic DC Alpha / 국내 KR / 기본설계 / 중전압 수배전반**을 검토합니다. 후보 사양은 24kV, 평가 범위는 수전전압 한 조건입니다.

| 화면 | 요구와 근거 | 판단 | 다음 확인 |
| --- | --- | --- | --- |
| R1 | 22.9kV 요구를 근거로 확인 | `FIT` · 조건 충족 | 다른 필수 사양 검토 |
| R2 | 현재 요구 근거가 빠짐 | `INSUFFICIENT_EVIDENCE` · 판단 보류 | 승인된 최신 단선결선도 확인 |
| R3 | 변경된 33kV 요구를 근거로 확인 | `NOT_FIT` · 현재 후보 제외 | 조건을 충족하는 다른 후보 검토 |

1. 양쪽 근거를 펼쳐 인용문과 적용 범위를 확인합니다.
2. R1→R2→R3를 비교하고 이전 평가를 그대로 이어갈 수 없는 이유를 설명합니다.
3. 확인한 근거, 자신의 판단과 이유, 남은 확인 사항을 직접 입력해 JSON으로 내려받습니다.

`VERIFIED`는 근거 검증 상태, `ALLOWED`는 해당 범위에서 그 주장을 사용할 수 있는 상태입니다. **둘 다 제품이 요구 조건을 충족한다는 `FIT`와는 다릅니다.**
24kV와 22.9kV의 비교는 합성 스칼라 조건 시연입니다. 실제 제품 선정에는 정격·절연·차단성능·규격 등 추가 검토가 필요합니다.

## 구현에서 보여주는 판단

- **검증 권한 분리:** 모델 출력이나 임의 객체가 검증 상태를 선언하지 못하고, 검증된 Claim Registry 인스턴스에서 상태와 적용 가능성을 도출합니다.
- **필수 조건 우선:** 추천 순위가 높거나 출처가 많아도 확인된 필수 사양 불일치를 덮어쓰지 않습니다.
- **변경 근거 추적:** 개정본·요구 값·근거 참조가 바뀌면 기존 평가를 재검토합니다. 이전 사람의 판단을 자동 승인하거나 대체하지 않습니다.
- **설명 가능한 보류:** 추가 근거가 필요한 경우와 실제 조건에 맞지 않는 경우의 다음 행동을 구분합니다.

관련 코드: [근거 레지스트리](knowledge/claim-registry/index.mjs), [사양 판정](verticals/datacenter/index.mjs), [개정 비교](verticals/datacenter/pursuit-twin-v0.mjs), [고정 시연 구성](scripts/lib/portfolio-v1.mjs).

[구현 구조와 신뢰 경계](docs/architecture/evidence-claim-registry-datacenter-spec-fit-v1.md)에서 상세 설계를 볼 수 있습니다.

## 검증과 한계

고정 입력과 고정 평가 시각으로 재현합니다. 로컬 검증은 루트 239 + Worker 단위 419 + Worker 계약 28 + 브라우저 18 = **704개 통과**이며 [검증 요약](docs/portfolio/b2b-portfolio-v1-verification.json)에 소스 지문과 범위를 기록했습니다.

```sh
npm run test:portfolio
npm run check:naming
npm run check:schema
npm test
npx playwright install chromium
npm run test:e2e:local
```

브라우저 테스트는 합성 데이터·fake D1·루프백 및 오프라인 파일을 사용합니다. 실제 UI에서 작성한 [에이전트 시뮬레이션 JSON](docs/portfolio/b2b-portfolio-v1-agent-simulation.json)은 `AI_AGENT_SIMULATION`, `humanParticipant:false`로 구분합니다.

실제 사람의 사용효과, 실제 제조사 자료와 실제 프로젝트의 적합성은 아직 검증하지 않았습니다. 에이전트 기록은 기존 5인 정식 실험에 집계하지 않습니다.
`productionReady:false`, `NOT_PRODUCTION_EVIDENCE`, Issue #165 `HOLD`를 유지합니다.

## 저장소의 범위

루트 `main.js`에는 리드 생성 파이프라인이, `worker/`에는 기존 검토 화면과 API가 있습니다. 위의 포트폴리오 시연 명령은 외부 호출·실제 리드 생성·DB·인증 설정을 사용하지 않습니다.

[운영 승인 경계](docs/standing-approval-policy.md) · [개발 가이드](AGENTS.md) · [기존 hardening 이력](HARDENING_PLAN.md)
