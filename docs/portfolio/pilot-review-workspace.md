# 파일럿 검토 작업 공간

산업재 요구사항 검토 도구의 사용 흐름을 반복해서 평가하는 **합성·로컬 작업 공간**이다.
실제 고객 문서 업로드, 제품/SKU 선정, 원격 저장, 인증, 과금 기능이 아니다.
가격과 제공 범위는 [판매 가격·파일럿 제안](commercial-pricing-and-pilot.md)을 참고한다.

## 실행

Node.js는 `.nvmrc`의 24.22.1을 사용한다. 저장소 루트에서 실행한다.

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run demo:pilot:serve
```

출력된 `http://127.0.0.1:...` 주소를 연다. 서버는 합성 HTML과 `workspace.json`만 제공하며
업로드·API·저장소 파일 접근을 받지 않는다. 종료는 `Ctrl+C`다.

서버 없이 사용하려면 `npm run demo:pilot`로 생성한
`tmp/codex/pilot-review/index.html`을 브라우저에서 연다. 외부 리소스 없이 동작하는 단일 파일이다.
같은 폴더의 `workspace.json`은 고정 입력·엔진 결과·출처·지문을 담은 검사 가능한 패킷이다.
출력 위치나 외부 레지스트리를 명령줄로 지정하는 기능은 제공하지 않는다.

## 검토 흐름

1. 기록 구분을 본인 재현·다른 사용자 체험·에이전트 시뮬레이션 중 직접 선택한다.
2. 사례를 골라 요구 값/상태, 근거와 적용 범위, 기술 판정, 검토 시점, 부족한 자료 또는
   자료 수집만으로 해결되지 않는 차단 조건을 확인한다.
3. 자신의 처분을 선택하고 이유와 다음 확인 사항을 직접 입력한다. 사례를 바꿔도 입력은
   페이지 메모리에 유지된다. 도구가 검토자의 결론을 대신 입력하지 않는다.
4. 필요할 때 직접 측정한 기준 작업 시간과 도구 사용 시간을 입력한다. 양쪽이 모두 있는
   사례만 비교하며 더 오래 걸린 경우도 음수 절감시간으로 남긴다. 입력은 검증된 ROI가 아니다.
5. JSON으로 초안을 보관하거나 Markdown 검토 패킷을 내보낸다. JSON을 다시 열어 이어갈 수 있다.
   아직 작성하지 않은 항목은 완료로 처리하지 않는다.

다시 열기는 같은 작업 공간의 지문과 사례 지문이 일치하는 기록만 허용한다.
알 수 없는 필드, 위조된 검증 상태·경계, 중복 사례, 잘못된 숫자·구분, 128KiB를 넘는 파일은
거부한다. 새 버전에서 지문이 달라졌다면 이전 기록을 자동 이월하지 않고 별도 재검토가 필요하다.
이 파일 검사는 진짜 사람의 신원이나 입력 내용의 사실성을 인증하지 않는다.

## 7개 사례의 의미

| 사례 | 확인할 차이 |
| --- | --- |
| ELECTRICAL | 확인된 22.9kV 요구와 합성 24kV 사양의 기술 조건 충족 |
| MISSING_VOLTAGE | 현재 요구 근거가 없어 보류. 남은 숫자를 확정 요구로 사용하지 않음 |
| HARD_MISMATCH | 확인된 33kV 요구와 24kV 후보 불일치. 단순 근거 보강 문제가 아님 |
| UNVERIFIED_CAPABILITY | 검증되지 않은 기능 주장을 사용 가능한 근거로 승격하지 않음 |
| EXPIRED_CAPABILITY | 평가 시점에 만료된 기능 근거를 현재 검증으로 사용하지 않음 |
| WRONG_JURISDICTION | 근거가 검증됐더라도 다른 국가의 적용 범위에 그대로 사용하지 않음 |
| WINDOW_CLOSED | 기술 조건이 맞더라도 사양 검토 시점이 끝난 경우를 구분 |

각 사례는 독립적인 합성 상황이다. 한 고객의 연속 개정 이력이나 실제 제품 성능을 뜻하지 않는다.
전압 비교는 스칼라 조건의 예시다. 실제 선정에는 정격·절연·차단성능·규격 등 추가 판단이 필요하다.
현재 후보는 제품군 단위이며 같은 제품군의 여러 SKU를 비교하는 기능은 없다.

기존 평가 엔진과 고정 registry/vertical pack을 사용한다. 파일럿 전용 합성 맥락은
`eval/fixtures/pilot-review/project-context-v1.json`에 명시하며, 참조한 프로젝트·단계 근거가
해당 사례의 프로젝트와 일치하도록 검사한다. 사용자 입력을 registry나 VERIFIED 주장으로 가져오지 않는다.

## 기록과 검증 경계

초안은 브라우저 메모리에만 있으며 JSON 내려받기 외에는 저장하지 않는다. 이탈 경고를 무시하거나
브라우저가 종료되면 내려받지 않은 입력은 사라질 수 있다. 개인정보·실제 고객자료는 입력하지 않는다.
AI 기록에는 `AI_AGENT_SIMULATION`, `humanParticipant:false`를 붙인다. 다른 기록도
`SELF_REPORTED_NOT_VERIFIED`이며, 기존 정식 실험이나 사람의 성과 기록으로 자동 집계하지 않는다.

```sh
npm run test:pilot
node --test worker/e2e/pilot-review.test.mjs
npm test
npm run test:e2e:local
```

`productionReady:false`, `NOT_PRODUCTION_EVIDENCE`, Issue #165 `HOLD`를 유지한다.
실제 고객의 구매 의향·효과, 운영 배포·데이터 보호·인증은 이 로컬 검증과 별도의 조건이다.

## 2026-10-29 구현 검증

Node 24.22.1에서 루트 269 + Worker 단위 443 + 계약 30 + 브라우저 56 + 로컬 workerd 11 =
**809개 통과**, 실패·skip·TODO 0개다. 집중 테스트는 이 합계에 중복 포함하지 않았다.
이름·schema 검사와 claims 감사, spec-fit 평가/집중 테스트, Level 1 gate도 통과했다.
새 임시 작업 폴더에서 `npm ci --ignore-scripts --no-audit --no-fund` 후 `npm run demo:pilot`로
단독 HTML/JSON 생성에 성공했다.

독립 리뷰는 **PASS**다. 리뷰에서 발견한 JSON 용량 한계의 왕복 불일치는 같은 serializer로
검증과 다운로드를 맞춰 수정했고, 실제 브라우저 다운로드 파일의 크기와 재가져오기를 재검증했다.
데스크톱과 320px 화면, 오프라인/외부 요청 없음, 초안 이동, 입력 경고, 위조·오류 파일 거부,
AI 표시와 짝지은 자기보고 시간, 전체 코드/근거 추적을 검사했다.

실행 수치·소스 지문·경계는 [검증 JSON](commercial-pilot-verification.json)에 기록한다.
로컬 상세 로그와 독립 리뷰는 `tmp/codex/commercial-pilot/`, 화면은
`output/playwright/commercial-pilot/`에 있다. 이 자료는 Git에 포함하지 않은 로컬 실행 자료다.
이전 787-test UX 개선 기록은 그 시점의 이력으로 보존한다.
이 검증 기록 작성 시점에는 같은 `codex/portfolio-review-ux` 작업 공간에 미커밋 상태였으며,
PR·병합·배포·실제 고객 실험을 수행하지 않았다. 이후 저장소 통합 상태는 GitHub 기록을 따른다.
