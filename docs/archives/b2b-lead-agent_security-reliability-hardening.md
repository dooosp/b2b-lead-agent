---
date: 2026-01-30
tags: [#security, #xss, #auth, #cors, #rate-limit, #retry, #observability, #token-optimization]
project: b2b-lead-agent
---

## 해결 문제 (Context)
- Worker API 전면 미인증, XSS 취약점, CORS 무제한, 외부 호출 무재시도, 로깅 부재 → 보안/신뢰성/비용 7개 Task 일괄 강화

## 변경 파일 및 핵심 로직 (Solution)

### 1. XSS 방어 (Task 4) — `worker/index.js`
- 서버: `escapeHtml()` + `sanitizeUrl()` (제어문자/탭/개행 제거, `javascript:` `data:` `vbscript:` `blob:` `//evil.com` 차단)
- 클라: 각 페이지 `esc()` + `safeUrl()` — 모든 `innerHTML` 삽입 지점에 적용
- `formatMarkdown()` — `esc()` 먼저 호출 후 regex 마크다운 변환 (raw HTML 불가)
- 에러 메시지 렌더링(`catch` 블록)도 `esc(e.message)` 적용

### 2. API 인증 일원화 (Task 1) — `worker/index.js`
- `verifyAuth()` — `Authorization: Bearer <token>`, `crypto.subtle.timingSafeEqual`
- **토큰 미설정 시 503 차단** (기존: `return null`로 전면 오픈 → 최대 리스크)
- 모든 `/api/*` 라우트에 인증 게이트 적용
- `/trigger`는 Bearer + body password 하위 호환
- 클라: `sessionStorage` 기반 토큰 저장, `authHeaders()` 공통 함수

### 3. Rate Limiting (Task 2) — `worker/index.js`, `wrangler.toml`
- KV namespace `RATE_LIMIT` (id: `a5a01a0961b34b888ef050ed03b1f4f7`)
- IP 기반 60초/10회, unknown IP → 3회 보수적 제한
- `X-Forwarded-For` fallback 추가
- `/trigger`에 적용, 초과 시 429 + `Retry-After`

### 4. CORS (Task 3) — `worker/index.js`, `wrangler.toml`
- `isAllowedOrigin()` — Worker 도메인 + `localhost:8787`만 허용
- `addCorsHeaders()` — `Vary: Origin` 포함 (캐시 혼합 방지)
- `handleOptions()` → 204, 비허용 Origin → 403

### 5. 외부 호출 Retry + Timeout (Task 5) — `lib/http.js`
```javascript
async function withRetry(fn, { retries=1, baseDelay=1000, timeout=30000, label='' })
// exponential backoff + jitter + Promise.race timeout 강제
```
- `scout.js` — RSS 파싱, DuckDuckGo 검색, 본문 크롤링에 적용
- `qualifier.js` — `model.generateContent()` 호출에 적용

### 6. 관측성 (Task 6) — `lib/obs.js`, `main.js`
```javascript
const obs = createRun(); // runId (8자리 hex) — 전 파이프라인 공유
obs.time('scout').end()  // → { runId, stage, duration_ms }
obs.count('leads', n)    // 카운터
obs.logError(stage, err) // err.name 포함
obs.summary()            // 완료 시 counters 출력
```

### 7. Gemini 토큰 최적화 (Task 7) — `qualifier.js`
- `categorizeArticles()` — 키워드 기반 4개 카테고리 (marine/datacenter/factory/coldchain)
- 매칭 카테고리의 글로벌 레퍼런스만 프롬프트에 포함 (24→6~9개)
- 폴백: 매칭 없으면 전체 포함

## 핵심 통찰 (Learning & Decision)

- **Problem 1:** `verifyAuth`에서 토큰 미설정 시 `return null`이면 인증이 완전 생략됨 → 배포 직후 API 전면 노출
- **Decision:** 미설정 시 503 차단으로 변경. "기본값은 닫힘(fail-closed)"이 보안의 제1원칙
- **Problem 2:** 클라이언트 `sanitizeUrl`이 `JaVaScRiPt:`, `\t javascript:`, `//evil.com` 같은 변형을 못 막음
- **Decision:** 제어문자/공백 전부 제거 후 lowercase 비교 + scheme-relative/backslash prefix 차단
- **Problem 3:** `withRetry`에 timeout이 없으면 외부 서버 hang 시 파이프라인 무한 대기
- **Decision:** `Promise.race`로 30초 timeout 강제

## 배포 정보

- Worker URL: `https://b2b-lead-trigger.jangho1383.workers.dev`
- Version ID: `3d00ee90-f755-4764-bb9d-6dbb8cb89b60`
- KV namespace: `RATE_LIMIT` (`a5a01a0961b34b888ef050ed03b1f4f7`)
- Secrets: `GEMINI_API_KEY`, `GITHUB_TOKEN`, `TRIGGER_PASSWORD` (API_TOKEN 미등록 — TRIGGER_PASSWORD로 폴백)

## 스모크 테스트 결과

| 테스트 | 기대 | 결과 |
|--------|------|------|
| `GET /api/leads` (인증 없음) | 401 | 401 |
| `GET /api/history` (인증 없음) | 401 | 401 |
| `Origin: https://evil.com` | CORS 헤더 없음 | 없음 |
| `GET /` (메인 페이지) | 200 | 200 |
| Roleplay 시뮬레이션 | 정상 응답 | 정상 (GEMINI_API_KEY 갱신 후) |

## Next Step
- `API_TOKEN` 별도 시크릿 등록 후 `TRIGGER_PASSWORD` body 인증 deprecate 계획 수립
- 실 데이터 QA로 과다 이스케이프 → UI 텍스트 깨짐 여부 확인
- `categorizeArticles` 키워드 누락 모니터링 (폴백 빈도 추적)
