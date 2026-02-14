# 콘텐츠 품질 기반 시스템 리팩토링

> 작성: 2026-02-14
> 대상: worker/index.js + qualifier.js + profiles/*.js
> 핵심: "기능 추가" 아님. **근거·정확·신뢰** 구조로 전환

## 문제 진단 (4가지 근본 원인)

| # | 원인 | 현재 코드 위치 | 증상 |
|---|------|---------------|------|
| A | 입력 컨텍스트가 얇다 | worker L1409-1411 (제목/URL만) | 본문 없이 ROI/피치 생성 → 환각 |
| B | 숫자 ROI를 강제한다 | worker L723 "TCO 3년 ROI" | 숫자 없는 기사에서도 구체 수치 창작 |
| C | 불확실성 표기를 금지한다 | qualifier.js L94-98 "추론 기반 명시하지 마세요" | 근거 없는 단정 → 신뢰 하락 |
| D | 레퍼런스가 하드코딩 텍스트 | profiles/danfoss.js L46-67 | 출처 없는 수치 → 사실성 미검증 |

## 변경 계획 (P0: 5개 Step, 효과 순)

---

### Step 1: 셀프서비스 본문 확보 (원인 A 해결)
**파일:** `worker/index.js` — handleSelfServiceAnalyze 함수 (~L1350-1400)

**현재:** 뉴스 제목+URL만 LLM에 투입
**변경:** 상위 8~12개 기사 본문을 수집 후 팩트 추출에 사용

구현:
1. `handleSelfServiceAnalyze`에서 기사 수집 후, `fetchArticleBodyWorker(url)`로 상위 기사 본문 확보
2. 본문 확보 성공/실패를 각 기사에 마킹 (`hasBody: true/false`)
3. `analyzeLeadsWorker`에 기사 본문을 함께 전달
4. 프롬프트의 뉴스 목록 포맷을 변경:
   - 본문 있음: `[source] title (URL)\n본문: {첫 800자}`
   - 본문 없음: `[source] title (URL) [본문 미확보 — 제목 기반만 분석]`

**영향:** 기사 수집 시간 증가 (병렬 fetch로 최소화, 기사당 5s 타임아웃)
**검증:** 본문 확보율 로깅 추가 → analytics 테이블에 `body_hit_rate` 기록

---

### Step 2: 리드 JSON 스키마에 근거/신뢰도/가정 추가 (원인 A+C 해결)
**파일:** `worker/index.js` — analyzeLeadsWorker 프롬프트 (~L1425-1465) + callGeminiEnrich 프롬프트 (~L713-730)

**현재 스키마 (리드 생성):**
```json
{ "company", "summary", "product", "score", "grade", "roi", "salesPitch", ... }
```

**변경 스키마:**
```json
{
  "company": "타겟 기업명",
  "summary": "프로젝트 요약",
  "product": "추천 제품",
  "score": 75,
  "grade": "B",
  "scoreReason": "등급 판정 근거",
  "roi": "ROI 요약",
  "salesPitch": "SPIN 피치",
  "globalContext": "글로벌 트렌드",
  "urgency": "HIGH|MEDIUM|LOW",
  "urgencyReason": "긴급도 근거",
  "buyerRole": "예상 키맨",
  "sources": [{"title": "기사 제목", "url": "URL"}],
  "evidence": [
    {"field": "roi", "quote": "기사 원문 인용", "sourceUrl": "URL"},
    {"field": "summary", "quote": "근거 문장", "sourceUrl": "URL"}
  ],
  "confidence": "HIGH|MEDIUM|LOW",
  "confidenceReason": "신뢰도 근거 (본문 확보 여부, 수치 존재 여부 등)",
  "assumptions": ["ROI 산출에 사용한 가정1", "가정2"],
  "eventType": "착공|증설|수주|규제|입찰|투자|채용|기타"
}
```

**Enrichment 스키마 추가 필드:**
```json
{
  "evidence": [{"field": "...", "quote": "...", "sourceUrl": "..."}],
  "assumptions": ["TCO 산출 가정: ..."],
  "dataGaps": ["예산 규모 미확인", "의사결정자 미파악"]
}
```

**DB 변경:**
```sql
ALTER TABLE leads ADD COLUMN evidence TEXT DEFAULT '[]';
ALTER TABLE leads ADD COLUMN confidence TEXT DEFAULT '';
ALTER TABLE leads ADD COLUMN confidence_reason TEXT DEFAULT '';
ALTER TABLE leads ADD COLUMN assumptions TEXT DEFAULT '[]';
ALTER TABLE leads ADD COLUMN event_type TEXT DEFAULT '';
```

**코드 변경:**
- `rowToLead`: evidence, confidence, confidenceReason, assumptions, eventType 파싱 추가
- `leadToRow`: 동일 필드 직렬화 추가
- `normalizeEnrichData`: evidence 배열 검증, assumptions 배열 검증 추가

---

### Step 3: ROI를 "생성"에서 "계산"으로 전환 (원인 B 해결)
**파일:** `worker/index.js` — callGeminiEnrich 프롬프트 (~L713-730)

**현재 프롬프트:**
```
3. TCO 3년 ROI(투자비→절감액→Payback)
```
→ 숫자 없는 기사에서도 "투자 50억→절감 15억/년" 같은 구체 수치를 창작하게 유도

**변경 프롬프트:**
```
3. ROI 분석:
   a) 기사에서 발견한 숫자(금액/용량/면적/전력/물동량)를 '발견 숫자' 목록으로 추출
   b) 숫자가 있으면: 산업 평균 절감률(%) + 발견 숫자로 ROI 범위를 계산
      - 형식: "투자 추정 X~Y억 → 절감 추정 A~B억/년 (가정: [명시])"
   c) 숫자가 없으면: roi에 "정량 데이터 부족 — 유사 사례 기준 절감률 N~M% 예상" 형태로만 작성
      - 절대로 구체 금액을 창작하지 말 것
   d) assumptions 필드에 사용한 모든 가정을 나열
```

**시스템 측 보완:**
- `normalizeEnrichData`에서 ROI 필드에 숫자가 있는데 assumptions가 비어있으면 경고 플래그

---

### Step 4: 투명성 레이어 — "추론 금지" 지시 제거 (원인 C 해결)
**파일:** `qualifier.js` L94-98 + `worker/index.js` analyzeLeadsWorker 프롬프트

**현재 (qualifier.js L94-98):**
```
일부 뉴스는 [본문 없음]으로 표시됩니다. 이 경우:
- 기사 제목과 검색 키워드를 기반으로 프로젝트 내용을 추론하세요.
- 추론 시에는 보수적으로 점수를 매기되, 영업 기회가 있다면 Grade B로 분류하세요.
- "추론 기반 분석"임을 summary에 명시하지 마세요. 자연스럽게 작성하세요.
```

**변경:**
```
일부 뉴스는 [본문 미확보]로 표시됩니다. 이 경우:
- 기사 제목과 검색 키워드를 기반으로 분석하되, confidence를 "LOW"로 설정하세요.
- 본문 미확보 기사는 score를 최대 65점으로 제한하세요 (Grade B 이하).
- confidenceReason에 "기사 본문 미확보, 제목 기반 분석"을 명시하세요.
- evidence 배열은 비워두세요 (근거 인용 불가).
```

**Worker 프롬프트 동일 적용:**
- analyzeLeadsWorker에도 동일 confidence/evidence 정책 적용
- UI에서 confidence 표시: HIGH=초록, MEDIUM=노랑, LOW=빨강 배지

---

### Step 5: 프로필 레퍼런스 분리 — reference_library 테이블 (원인 D 해결)
**파일:** `worker/index.js` (D1 스키마 + 프롬프트 주입 방식)

**현재:** profiles/danfoss.js에 `globalReferences`로 하드코딩
```javascript
marine: [
  { client: 'Maersk', project: '300척 하이브리드', result: '연료 18% 절감' }
]
```
→ 출처 없음, 검증일 없음, 수정=코드 수정+재배포

**변경: D1 테이블 신설**
```sql
CREATE TABLE IF NOT EXISTS reference_library (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id TEXT NOT NULL,
  category TEXT NOT NULL,
  client TEXT NOT NULL,
  project TEXT NOT NULL,
  result TEXT NOT NULL,
  source_url TEXT DEFAULT '',
  region TEXT DEFAULT '',
  verified_at TEXT DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX idx_ref_profile_cat ON reference_library(profile_id, category);
```

**마이그레이션:** 기존 프로필의 globalReferences를 reference_library로 초기 시딩
**프롬프트 변경:** 프로필에서 직접 레퍼런스를 읽지 않고, D1에서 category 매칭 레퍼런스를 검색 후 주입
- 형식: `[레퍼런스] {client} - {project}: {result} (출처: {source_url}, 검증: {verified_at})`
- source_url이 비어있으면: `(출처 미확인)` 표시

**API 추가 (관리용):**
- `GET /api/references?profile=danfoss&category=marine` — 레퍼런스 조회
- `POST /api/references` — 레퍼런스 추가 (Bearer 인증)
- `DELETE /api/references/:id` — 레퍼런스 삭제

**프로필 파일 변경:**
- `globalReferences` 섹션 제거 (또는 fallback으로만 유지)
- 프로필은 searchQueries, categoryConfig, categoryRules, productKnowledge만 담당

---

## Step 순서 & 의존성

```
Step 1 (본문 확보) ──┐
                     ├──▶ Step 2 (스키마 + 근거/신뢰도) ──▶ Step 3 (ROI 계산화)
Step 4 (투명성)  ────┘
Step 5 (레퍼런스 분리) — 독립, 병렬 가능
```

## 영향 범위

| 파일 | 변경 규모 | 내용 |
|------|----------|------|
| worker/index.js | 대 | 프롬프트 2개 + DB 스키마 + rowToLead/leadToRow + normalize + UI |
| qualifier.js | 소 | 프롬프트 "추론 금지" → "confidence LOW" 전환 |
| profiles/danfoss.js | 중 | globalReferences 제거 (DB 이관 후) |
| profiles/ls-electric.js | 중 | 동일 |

## 하위 호환

- 기존 리드: 신규 필드(evidence, confidence 등) 없으면 빈값/기본값 표시
- 기존 프로필 파이프라인: reference_library 테이블 비어있으면 프로필 fallback 유지
- DB ALTER는 기존 패턴(IF NOT EXISTS + try-catch) 유지

## 검증 기준

| 지표 | 목표 |
|------|------|
| 본문 확보율 | 70%+ (셀프서비스 기사) |
| evidence 포함 리드 비율 | 80%+ |
| ROI에 assumptions 포함 | 100% |
| confidence LOW 리드의 score ≤ 65 | 100% |
| 레퍼런스에 source_url 포함 | 기존 → 0%, 목표 → 점진적 채움 |
