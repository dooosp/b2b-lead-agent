# B2B Lead Agent — 프로젝트 종합 보고서

> **작성일:** 2026-02-14
> **저장소:** https://github.com/dooosp/b2b-lead-agent
> **배포 URL:** https://b2b-lead-trigger.jangho1383.workers.dev
> **기술 스택:** Cloudflare Worker + D1 + KV + GitHub Actions + Gemini 2.0-flash

---

## 1. 프로젝트 개요

### 한 줄 요약
> **뉴스 기반 B2B 리드를 자동 발굴하고, AI로 심층 분석(MEDDIC/SPIN)하여, 영업 파이프라인까지 관리하는 올인원 세일즈 인텔리전스 플랫폼**

### 해결하는 문제
| 기존 문제 | B2B Lead Agent의 해결 |
|-----------|----------------------|
| 영업사원이 수동으로 뉴스/공시를 검색 | Google News RSS 자동 수집 + AI 분류 |
| 리드 분석에 수 시간 소요 | Gemini CoT 분석으로 30초 내 MEDDIC 리포트 생성 |
| 리드 등급 기준이 주관적 | BANT 스코어링(0-100점) + 자동 등급(A/B/C) |
| 파이프라인 현황 파악 어려움 | 칸반 보드 + 대시보드(전환율, 체류시간, 파이프라인 가치) |
| 고객사별 전략 부재 | 프로필 시스템(댄포스, LS일렉트릭) + 경쟁 인텔리전스 |

### 아키텍처 전체도
```
┌─────────────────────────────────────────────────────────┐
│                    사용자 접점                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │ 셀프서비스 │  │ 리드 관리 │  │ 대시보드  │  │ PPT/RP  │ │
│  │ (공개)    │  │ (인증)   │  │ (인증)   │  │ (인증)  │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬────┘ │
│       │              │              │              │      │
├───────┴──────────────┴──────────────┴──────────────┴──────┤
│              Cloudflare Worker (3,262줄)                   │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐ │
│  │ Router  │  │ Auth/CORS│  │ Rate Lmt │  │ Enrichment│ │
│  │ 18 routes│ │ Bearer   │  │ KV-based │  │ MEDDIC/   │ │
│  │         │  │ timing-  │  │ IP 기반  │  │ SPIN/CoT  │ │
│  │         │  │ safe     │  │          │  │           │ │
│  └────┬────┘  └──────────┘  └──────────┘  └─────┬─────┘ │
│       │                                          │       │
│  ┌────┴────────────────────────────────────┐     │       │
│  │              D1 Database                │     │       │
│  │  leads (24col) │ analytics │ status_log │     │       │
│  └─────────────────────────────────────────┘     │       │
│                                                  │       │
│  ┌──────────────────┐    ┌───────────────────┐   │       │
│  │ Google News RSS  │───▶│ Gemini 2.0-flash  │◀──┘       │
│  │ (3일 윈도우)      │    │ (25s timeout)     │           │
│  └──────────────────┘    │ Smart Placement   │           │
│                          │ hint=wnam         │           │
│                          └───────────────────┘           │
├──────────────────────────────────────────────────────────┤
│              GitHub Actions (CI/CD)                       │
│  repository_dispatch → main.js → reports/ → git push     │
└──────────────────────────────────────────────────────────┘
```

---

## 2. 핵심 기능 상세

### 2-1. 프로필 시스템

프로필은 **고객사별 영업 전략을 코드로 정의**한 것입니다.

```
profiles/
├── danfoss.js      ← 댄포스 코리아 (110줄)
├── ls-electric.js  ← LS일렉트릭 (170줄)
└── _template.js    ← 새 프로필 생성용 템플릿
```

**댄포스 프로필 예시:**

| 카테고리 | 타겟 키워드 | 추천 제품 | 기본 점수 |
|---------|-----------|----------|----------|
| Marine | 친환경 선박, EEXI/CII, 하이브리드 추진 | iC7 Marine Drive | 85 (A등급) |
| DataCenter | 데이터센터 신축, PUE 최적화, 쿨링 | Turbocor Compressor | 80 (A등급) |
| Factory | 스마트 팩토리, EV 배터리, IE4 모터 | VLT AutomationDrive | 70 (B등급) |
| ColdChain | 콜드체인 물류, 백신 저장, 식품 보존 | Turbocor Oil-free | 75 (B등급) |

**글로벌 레퍼런스 (실제 고객 사례):**
- Maersk: 300척 하이브리드 추진 → 연료 18% 절감
- Equinix: 글로벌 DC PUE 1.58→1.25 달성
- Volkswagen: EV 공장 에너지 35% 절감
- Pfizer: 백신 콜드체인 -70°C 유지
- Samsung SDI: 헝가리 배터리 공장 자동화

---

### 2-2. 리드 발굴 파이프라인

```
[1단계] 뉴스 수집 (Google News RSS)
    │  7개 검색 쿼리 × 3일 윈도우
    │  한국어 뉴스 자동 수집
    ▼
[2단계] AI 분류 (Gemini 2.0-flash)
    │  카테고리 자동 분류
    │  BANT 스코어링 (0-100점)
    │  등급 자동 부여 (A/B/C)
    ▼
[3단계] D1 저장
    │  24개 필드 구조화 저장
    │  중복 방지 (ON CONFLICT)
    ▼
[4단계] Enrichment (선택)
    │  기사 본문 스크래핑
    │  MEDDIC + SPIN + 경쟁 분석
    │  3년 TCO ROI 산출
    ▼
[5단계] 파이프라인 관리
       칸반 보드 → 상태 추적 → 대시보드
```

---

### 2-3. MEDDIC 기반 심층 분석 (Enrichment)

단일 리드에 대해 **기사 본문을 스크래핑**하고 **Gemini CoT(Chain-of-Thought)**로 분석합니다.

| MEDDIC 요소 | 분석 내용 | 출력 예시 |
|-------------|----------|----------|
| **M**oney (예산) | 투자 규모, 예산 승인 여부 | "2026년 500억 CAPEX 승인" |
| **E**conomic Buyer | 의사결정 구조, 키맨 | "CTO 직할, 구매팀 협조" |
| **D**ecision Criteria | 핵심 요구사항 | "에너지 효율 30% 이상" |
| **D**ecision Process | 구매 일정, 프로세스 | "2Q 입찰, 3Q 낙찰 예정" |
| **I**dentify Pain | 정량화된 Pain Point | "연간 전력비 120억, 15% 과다" |
| **C**hampion | 내부 지지자, 영향력자 | "공장장 김OO, 스마트팩토리 추진" |

**추가 분석 항목:**
- **경쟁 인텔리전스**: 현재 벤더, 경쟁사, 우위 포인트, 전환 장벽
- **구매 신호**: 투자 공시, 규제 대응, 경쟁사 움직임
- **SPIN 영업 제안**: 상황→문제→영향→가치 4단계 제안서
- **3년 TCO ROI**: 투자금→절감액→Payback Period 산출
- **팔로업 액션**: 1주/1개월/3개월 단위 후속 조치

---

### 2-4. 파이프라인 관리

**상태 머신 (Strict FSM):**
```
NEW → CONTACTED → MEETING → PROPOSAL → NEGOTIATION → WON
                                                    ↘ LOST → NEW (재오픈)
```

**칸반 보드:**
- 6개 컬럼 (NEW ~ WON/LOST)
- 드래그 앤 드롭 상태 전환
- 각 카드에 회사명, 점수, 등급, 메모 표시

**리드 상세 페이지:**
- 전체 리드 정보 + 상태 타임라인
- 메모 자동저장 (800ms 디바운스)
- 팔로업 날짜 + 예상 딜 금액 관리
- PPT 생성 링크

---

### 2-5. 대시보드 메트릭

| 메트릭 | 설명 |
|--------|------|
| 전체 리드 수 | 프로필별 총 리드 카운트 |
| A등급 비율 | 80점 이상 리드 비율 |
| 전환율 | WON / (WON + LOST) × 100 |
| 단계별 전환율 | NEW→CONTACTED, CONTACTED→MEETING 등 각 단계 % |
| 평균 체류시간 | 각 단계에서 머무는 평균 일수 |
| 파이프라인 가치 | 상태별 예상 딜 금액 합계 (LOST 제외) |
| 팔로업 알림 | 오늘 마감 + 지난 팔로업 카운트 |
| 최근 활동 | 상태 변경 타임라인 |

---

### 2-6. 셀프서비스 모드 (공개)

인증 없이 누구나 사용할 수 있는 즉석 분석 기능입니다.

```
[사용자 입력]  회사명 + 업종 (50자 제한)
      │
      ▼
[AI 프로필 생성]  Gemini로 검색 쿼리 + 카테고리 자동 생성 (9초 타임아웃)
      │            ↘ 타임아웃 시 휴리스틱 폴백
      ▼
[뉴스 수집]  Google News RSS (3일 윈도우)
      │
      ▼
[AI 분석]  리드 분석 + 스코어링
      │     ↘ 타임아웃 시 Quick 폴백 (키워드 매칭)
      ▼
[결과 반환]  즉시 응답 + 백그라운드 D1 저장 (ctx.waitUntil)
```

**Rate Limit:** IP 기반 3회/시간 (설정 가능)

---

### 2-7. 부가 기능

| 기능 | 설명 |
|------|------|
| **PPT 생성** | 리드 기반 5슬라이드 기술 제안서 (도입부→솔루션→ROI→규제→Next Step) |
| **롤플레이** | AI가 까다로운 바이어 역할, 멀티턴 대화 + 코칭 피드백 |
| **CSV 내보내기** | UTF-8 BOM + 9컬럼 (회사명, 프로젝트, 제품, 점수, 등급, ROI, 상태, 메모, 생성일) |
| **PWA** | 오프라인 캐시 (Service Worker), 홈 화면 설치 가능 |
| **이력 관리** | 전체 리드 히스토리 500건 조회 + 상태 변경 타임라인 |

---

## 3. 기술 구현 상세

### 3-1. 인프라 & 배포

| 항목 | 상세 |
|------|------|
| **런타임** | Cloudflare Worker (Edge) |
| **DB** | Cloudflare D1 (SQLite 기반, 3 테이블, 40+ 컬럼) |
| **KV** | Rate Limit 저장소 (IP 기반) |
| **CI/CD** | GitHub Actions (repository_dispatch → 파이프라인 → git push) |
| **AI** | Gemini 2.0-flash (Smart Placement hint=wnam) |
| **도메인** | b2b-lead-trigger.jangho1383.workers.dev |

### 3-2. 보안

| 보안 요소 | 구현 |
|-----------|------|
| 인증 | Timing-safe Bearer 토큰 비교 |
| XSS 방지 | `escapeHtml()` + `sanitizeUrl()` (javascript:/data:/blob: 차단) |
| Rate Limit | KV 기반 IP별 10req/min, 셀프서비스 3req/hr |
| CORS | 화이트리스트 (Worker Origin + localhost:8787) |
| 상태 검증 | FSM 기반 상태 전환 (잘못된 전환 거부) |
| 시크릿 | 환경변수로만 관리 (코드 내 하드코딩 없음) |

### 3-3. 성능 최적화

| 최적화 | 상세 |
|--------|------|
| Smart Placement | `hint=wnam` — Gemini API 지역 제한 우회 (서부 북미 엣지) |
| 타임아웃 계층 | Gemini 25s, 기사 스크래핑 5s, 프로필 생성 9s |
| 폴백 전략 | AI 타임아웃 시 휴리스틱(키워드 매칭) 폴백 |
| 배치 처리 | `db.batch()` 병렬 쿼리 |
| Lazy Migration | D1 우선 → GitHub CDN 폴백 (점진적 이관) |
| Service Worker | HTML/CSS/JS 캐시 (API 요청은 네트워크 우선) |
| 비동기 저장 | `ctx.waitUntil()` — 응답 먼저 반환, 저장은 백그라운드 |

### 3-4. API 엔드포인트 전체 목록 (18개)

| Method | Route | 인증 | 기능 |
|--------|-------|------|------|
| GET | `/` | - | 메인 페이지 (셀프서비스 + 관리 탭) |
| GET | `/leads` | Bearer | 리드 관리 (칸반/리스트) |
| GET | `/leads/:id` | Bearer | 리드 상세 페이지 |
| GET | `/dashboard` | Bearer | 대시보드 |
| GET | `/ppt` | Bearer | PPT 생성 UI |
| GET | `/roleplay` | Bearer | 롤플레이 UI |
| GET | `/history` | Bearer | 이력 조회 |
| GET | `/manifest.json` | - | PWA 매니페스트 |
| GET | `/sw.js` | - | Service Worker |
| GET | `/api/leads` | Bearer | 리드 목록 API |
| GET | `/api/dashboard` | Bearer | 대시보드 메트릭 API |
| GET | `/api/export/csv` | Bearer | CSV 내보내기 |
| GET | `/api/history` | Bearer | 이력 API |
| POST | `/api/leads/:id/enrich` | Bearer | 단일 리드 Enrichment |
| POST | `/api/leads/batch-enrich` | Bearer | 일괄 Enrichment (최대 3건) |
| PATCH | `/api/leads/:id` | Bearer | 리드 수정 (상태/메모/팔로업/딜금액) |
| POST | `/api/analyze` | Rate Limit | 셀프서비스 분석 |
| POST | `/api/ppt` | Bearer | PPT 생성 API |
| POST | `/api/roleplay` | Bearer | 롤플레이 API |
| POST | `/trigger` | Bearer/Password | GitHub Actions 트리거 |

### 3-5. D1 데이터베이스 스키마

**leads 테이블 (24 컬럼):**
```
id, profile_id, source, status, company, summary, product, score, grade,
roi, sales_pitch, global_context, sources, notes, enriched, article_body,
action_items, key_figures, pain_points, enriched_at, follow_up_date,
estimated_value, meddic, competitive, buying_signals, score_reason,
urgency, urgency_reason, buyer_role, created_at, updated_at
```

**analytics 테이블:** 셀프서비스/관리 모드 사용 통계
**status_log 테이블:** 리드 상태 변경 이력 추적

---

## 4. 코드 접근 방법

### 소스코드 위치

| 파일 | 위치 | 설명 |
|------|------|------|
| **핵심 Worker** | `worker/index.js` (3,262줄) | 전체 백엔드 + 프론트엔드 |
| **프로필 정의** | `profiles/danfoss.js`, `profiles/ls-electric.js` | 고객사별 전략 |
| **로컬 파이프라인** | `main.js` → `scout.js` → `qualifier.js` → `briefing.js` | CLI 실행용 |
| **E2E 테스트** | `e2e-test.mjs` | Playwright 17개 시나리오 |
| **CI/CD** | `.github/workflows/generate-report.yml` | GitHub Actions |
| **인프라 설정** | `worker/wrangler.toml` | Cloudflare 배포 설정 |
| **산출물** | `reports/danfoss/`, `reports/ls-electric/` | 생성된 리포트 |

### GitHub 저장소
```
https://github.com/dooosp/b2b-lead-agent
```

### 로컬 실행
```bash
# 1. 로컬 개발 서버
cd worker && npx wrangler dev --port 8787

# 2. CLI 파이프라인 (GitHub Actions와 동일)
node main.js --profile danfoss --email

# 3. E2E 테스트
node e2e-test.mjs
```

---

## 5. 한계점 및 리뷰

### 5-1. 아키텍처 한계

| 한계 | 영향도 | 상세 |
|------|--------|------|
| **단일 파일 3,262줄** | 높음 | 모든 로직(라우팅, DB, UI, AI)이 `index.js` 하나에 집중. 유지보수·코드 리뷰·테스트가 어려움 |
| **HTML 인라인** | 중간 | 6개 페이지의 HTML/CSS/JS가 모두 Worker 코드 안에 문자열로 존재. UI 수정 시 Worker 전체 재배포 필요 |
| **프로필 하드코딩** | 중간 | 프로필 추가 시 JS 파일 작성 + wrangler.toml PROFILES 수정 + 재배포 필요. 동적 프로필 관리 불가 |
| **Gemini 단일 의존** | 높음 | AI 분석이 Gemini 2.0-flash에 100% 의존. API 장애·쿼터 초과 시 전체 분석 기능 마비 |
| **D1 제약** | 중간 | Cloudflare D1은 아직 GA 초기. 트랜잭션 지원 제한, 복잡한 JOIN 성능 미보장 |

### 5-2. 기능 한계

| 한계 | 상세 |
|------|------|
| **뉴스 소스 단일** | Google News RSS만 사용. 공시(DART), 특허, 채용공고, SNS 등 다른 신호를 놓침 |
| **기사 스크래핑 품질** | Regex 기반 HTML 파싱. 동적 렌더링(SPA) 사이트나 페이월 기사는 추출 실패 |
| **분석 정확도 미검증** | MEDDIC/SPIN 분석 결과의 정확도를 정량적으로 측정하는 체계 없음 |
| **알림 부재** | 새 A등급 리드 발굴, 팔로업 마감 등의 실시간 알림(이메일/슬랙/텔레그램) 없음 |
| **다국어 미지원** | 한국어 뉴스만 수집. 글로벌 뉴스(영어, 일본어) 미지원 |
| **협업 기능 없음** | 단일 사용자 시스템. 영업팀 내 리드 할당, 댓글, 활동 로그 없음 |
| **모바일 UX 미최적화** | PWA 지원하나 칸반 보드·대시보드의 모바일 반응형이 충분하지 않음 |
| **오프라인 분석 불가** | Service Worker가 HTML만 캐시. 오프라인에서 리드 조회·수정 불가 |

### 5-3. 보안 한계

| 한계 | 상세 |
|------|------|
| **단일 토큰 인증** | 사용자 구분 없는 단일 Bearer 토큰. 팀 사용 시 감사 추적 불가 |
| **Rate Limit 우회 가능** | IP 기반이므로 프록시/VPN으로 우회 가능 |
| **API 키 노출 위험** | GitHub Actions secrets에 의존하나, Worker 환경변수 접근 권한 관리가 단순 |

### 5-4. 테스트 한계

| 한계 | 상세 |
|------|------|
| **유닛 테스트 없음** | 3,262줄에 대한 유닛 테스트가 전무. 핵심 함수(스코어링, FSM, 파싱) 검증 부재 |
| **E2E만 존재** | 17개 시나리오가 있으나 실제 Gemini API 호출 포함 시 비결정적 |
| **부하 테스트 없음** | 동시 접속, 대량 리드 처리 시 D1·KV 성능 미검증 |

---

## 6. 확장 방향 제안

### Phase 1 — 즉시 개선 (1-2주)

| 항목 | 내용 | 기대 효과 |
|------|------|----------|
| **코드 모듈화** | `index.js`를 `routes/`, `services/`, `db/`, `views/` 분리. Wrangler의 모듈 Worker 형식 활용 | 유지보수성 3배 향상, PR 리뷰 용이 |
| **알림 시스템** | 텔레그램 봇 연동 — A등급 리드 발굴 시 즉시 알림, 팔로업 마감 리마인더 | 리드 대응 시간 단축 |
| **유닛 테스트** | Vitest + Miniflare로 핵심 함수(스코어링, FSM, 파싱) 테스트 | 회귀 버그 방지 |
| **모바일 UI 개선** | 칸반 보드 → 모바일에서 스와이프 기반 상태 전환, 대시보드 반응형 | 모바일 사용성 |

### Phase 2 — 기능 확장 (2-4주)

| 항목 | 내용 | 기대 효과 |
|------|------|----------|
| **다중 뉴스 소스** | DART 공시, 특허(KIPRIS), 채용공고(원티드), LinkedIn 연동 | 리드 발굴 폭 2-3배 확대 |
| **LLM 폴백** | Gemini 장애 시 Claude/GPT 자동 전환 (shared-libs의 llm-client 활용) | 가용성 99.9% |
| **분석 품질 대시보드** | Enrichment 정확도 피드백 루프 — 영업사원이 "유용/비유용" 평가 → 프롬프트 개선 | 분석 정확도 지속 향상 |
| **새 보고서 유형** | Executive Summary (경영진용 1페이지), 비즈니스 케이스, 경쟁 인텔 별도 뷰 | 활용도 확대 |
| **파이프라인 메트릭 고도화** | Pipeline Velocity, 병목 단계 자동 감지, Win-Loss 분석, 예측 매출 | 데이터 기반 영업 전략 |
| **동적 프로필 관리** | D1에 프로필 저장 → UI에서 CRUD → 재배포 없이 프로필 추가/수정 | 운영 편의성 |

### Phase 3 — 플랫폼화 (1-2개월)

| 항목 | 내용 | 기대 효과 |
|------|------|----------|
| **멀티 유저 / RBAC** | JWT 인증 + 역할(Admin/Sales/Viewer) + 리드 할당 + 활동 로그 | 팀 단위 사용 |
| **CRM 연동** | Notion DB / HubSpot / Salesforce 양방향 싱크 | 기존 워크플로 통합 |
| **자동화 파이프라인** | Cron 기반 자동 수집 → 자동 Enrichment → 알림 → 보고서 발송 | 완전 자동화 |
| **A/B 테스트 프롬프트** | 다중 프롬프트 버전으로 분석 → 전환율 비교 → 최적 프롬프트 선택 | AI 품질 극대화 |
| **Playwright CI** | GitHub Actions에서 E2E 자동 실행 + 스크린샷 아카이브 | 배포 품질 보장 |
| **다국어 지원** | 영어/일본어 뉴스 수집 + 다국어 UI + 분석 결과 번역 | 글로벌 확장 |

### 확장 우선순위 매트릭스

```
              높은 영향
                │
    ┌───────────┼───────────┐
    │ 코드 모듈화│ 다중 뉴스 소스 │
    │ 유닛 테스트│ LLM 폴백    │
    │ 알림 시스템│ CRM 연동    │
    ├───────────┼───────────┤
    │ 모바일 UI │ 다국어 지원  │
    │ 동적 프로필│ A/B 프롬프트 │
    │           │ 멀티유저    │
    └───────────┼───────────┘
                │
              낮은 영향
    낮은 노력 ──────── 높은 노력
```

---

## 7. 요약 수치

| 지표 | 값 |
|------|-----|
| Worker 코드 | 3,262줄 (단일 파일) |
| API 엔드포인트 | 18개 |
| DB 테이블 | 3개 (leads 24컬럼, analytics 9컬럼, status_log 5컬럼) |
| 프로필 | 2개 (댄포스, LS일렉트릭) |
| HTML 페이지 | 6개 (메인, 리드, 상세, 대시보드, PPT, 롤플레이) |
| E2E 테스트 | 17개 시나리오 |
| AI 모델 | Gemini 2.0-flash (25초 타임아웃) |
| Enrichment 필드 | MEDDIC 6항목 + 경쟁 4항목 + 구매신호 + SPIN |
| 파이프라인 상태 | 7단계 (NEW→WON/LOST) |
| 배포 | Cloudflare Edge (Smart Placement wnam) |

---

> **이 보고서는 B2B Lead Agent의 현재 구현 상태를 완전히 반영합니다.**
> **소스코드:** https://github.com/dooosp/b2b-lead-agent
> **라이브 데모:** https://b2b-lead-trigger.jangho1383.workers.dev
