# B2B Lead Agent 범용화 후속 — 구현 계획서

> 작성: 2026-02-13
> 대상: `/Users/jangtaeho/b2b-lead-agent` (브랜치: master, 커밋: e637ddc)

---

## 현황 요약

코어 파이프라인(config → scout → qualifier → briefing)은 프로필 기반으로 잘 범용화됨.
**외부 통합(Worker UI, GitHub Actions, 이메일, .gitignore)**에 댄포스 하드코딩 잔재 8건 발견.

---

## 수정 항목 (8건)

---

### 1. 기존 reports 마이그레이션

**대상 파일:**
- `reports/latest_leads.json` (6KB, 2026-02-08 생성 — 구 데이터)
- `reports/lead_history.json` (18KB, 2026-02-08 생성 — 구 히스토리)
- `reports/danfoss/latest_leads.json` (7KB, 2026-02-13 생성 — 최신)
- `reports/danfoss/lead_history.json` (8KB, 2026-02-13 생성 — 최신)

**문제:**
범용화 전에 생성된 루트 레벨 파일이 그대로 남아 있음. 루트 `lead_history.json`(18KB)이 danfoss/(8KB)보다 크므로 과거 리드 데이터가 유실될 수 있음.

**작업 단계:**

1. **루트 히스토리 → danfoss 히스토리 머지 스크립트 실행**
   ```javascript
   // 1회성 스크립트: merge-history.js
   const rootHistory = JSON.parse(fs.readFileSync('reports/lead_history.json'));
   const danfossHistory = JSON.parse(fs.readFileSync('reports/danfoss/lead_history.json'));

   // danfoss에 이미 있는 리드 식별 (company + summary 기준)
   const existingKeys = new Set(
     danfossHistory.map(h => `${h.company}::${h.summary}`)
   );

   // 루트에만 있는 리드를 danfoss 히스토리 앞에 추가
   const onlyInRoot = rootHistory.filter(
     h => !existingKeys.has(`${h.company}::${h.summary}`)
   );

   const merged = [...onlyInRoot, ...danfossHistory];
   fs.writeFileSync('reports/danfoss/lead_history.json', JSON.stringify(merged, null, 2));
   ```

2. **루트 `latest_leads.json` 삭제** — danfoss/에 최신 버전 있으므로 불필요
   ```bash
   rm reports/latest_leads.json
   ```

3. **루트 `lead_history.json` 삭제** — 머지 완료 후
   ```bash
   rm reports/lead_history.json
   ```

4. **검증:** `reports/danfoss/lead_history.json`의 리드 수가 머지 전 양쪽 합(중복 제외)과 일치하는지 확인

**결과:** `reports/` 디렉토리에는 `danfoss/` 서브디렉토리만 남음

---

### 2. .gitignore 업데이트

**대상 파일:** `.gitignore`

**현재 (L1-5):**
```gitignore
node_modules/
.env
reports/*.md
!reports/latest_leads.json
```

**문제 2건:**
- L4 `reports/*.md` — 1단계 깊이만 매칭. `reports/danfoss/*.md`는 이 규칙에 안 걸려서 **리포트 .md가 git에 추적될 수 있음**
- L5 `!reports/latest_leads.json` — 루트 레벨만 화이트리스트. `reports/danfoss/latest_leads.json`은 **git add 시 무시될 수 있음** (상위 규칙에 따라 다름). `lead_history.json`은 화이트리스트 자체가 없음

**변경 후:**
```gitignore
node_modules/
.env
reports/**/*.md
!reports/*/latest_leads.json
!reports/*/lead_history.json
```

**변경 상세:**
- L3: `reports/*.md` → `reports/**/*.md` (모든 하위 디렉토리의 .md 무시)
- L4: `!reports/latest_leads.json` → `!reports/*/latest_leads.json` (프로필 디렉토리의 JSON 화이트리스트)
- L5 추가: `!reports/*/lead_history.json` (히스토리도 화이트리스트)

---

### 3. GitHub Actions 워크플로우

**대상 파일:** `.github/workflows/generate-report.yml`

**문제 3건:**

**(A) L30 — `--profile` 플래그 누락**
```yaml
# 현재
run: node main.js --email
```
`main.js`는 `--profile` 없으면 사용법 출력 후 `process.exit(0)` → **Actions에서 아무것도 안 함**

**(B) L36 — git add 경로가 루트를 가리킴**
```yaml
# 현재
git add reports/latest_leads.json reports/lead_history.json
```
실제 파일은 `reports/danfoss/`에 생성되므로 **스테이징 실패 → 커밋 안 됨**

**(C) client_payload에서 프로필 수신 불가**
Worker의 /trigger가 `event_type: 'generate-report'`만 보내고 `client_payload`가 없음. 워크플로우가 프로필을 알 방법 없음.

**변경 후 (전체 파일):**
```yaml
name: Generate B2B Lead Report

on:
  repository_dispatch:
    types: [generate-report]

permissions:
  contents: write

jobs:
  generate:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm install

      - name: Run pipeline and send email
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          GMAIL_USER: ${{ secrets.GMAIL_USER }}
          GMAIL_PASS: ${{ secrets.GMAIL_PASS }}
          GMAIL_RECIPIENT: ${{ secrets.GMAIL_RECIPIENT }}
          PROFILE: ${{ github.event.client_payload.profile || 'danfoss' }}
        run: node main.js --profile $PROFILE --email

      - name: Commit leads data
        env:
          PROFILE: ${{ github.event.client_payload.profile || 'danfoss' }}
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add reports/$PROFILE/latest_leads.json reports/$PROFILE/lead_history.json
          git diff --cached --quiet || git commit -m "Update $PROFILE leads data"
          git push
```

**변경 포인트:**
- L25-30: `env`에 `PROFILE` 추가, `run`에 `--profile $PROFILE` 삽입
- L32-33: "Commit leads data" step에도 `PROFILE` env 추가 (별도 step이라 env 공유 안 됨)
- L36: `git add` 경로를 `reports/$PROFILE/` 하위로 변경
- L37: 커밋 메시지에 프로필 ID 포함

---

### 4. Worker — /trigger에 프로필 전달

**대상 파일:** `worker/index.js`

**문제 2건:**

**(A) L134-153 — handleTrigger가 프로필 미전달**

현재:
```javascript
// L152
body: JSON.stringify({ event_type: 'generate-report' })
```

변경:
```javascript
// L141 아래에 profile 추출 추가
const profile = body.profile || 'danfoss';

// L152 변경
body: JSON.stringify({
  event_type: 'generate-report',
  client_payload: { profile }
})
```

정확한 diff:
- L141 (`if (bearerAuth && !passwordOk)` 블록) 뒤, L143 (`const response = await fetch(`) 앞에:
  ```javascript
  const profile = body.profile || 'danfoss';
  ```
- L152 변경:
  - Before: `body: JSON.stringify({ event_type: 'generate-report' })`
  - After: `body: JSON.stringify({ event_type: 'generate-report', client_payload: { profile } })`

**(B) L370-405 — generate() 함수가 프로필 미전송**

현재 (L390-393):
```javascript
const res = await fetch('/trigger', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + password },
  body: JSON.stringify({ password })
});
```

변경:
```javascript
const profile = document.getElementById('profileSelect').value;
const res = await fetch('/trigger', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + password },
  body: JSON.stringify({ password, profile })
});
```

정확한 diff:
- L389 (`try {`) 뒤에 `const profile = ...` 줄 추가
- L393: `body: JSON.stringify({ password })` → `body: JSON.stringify({ password, profile })`

**(C) L157 — 성공 메시지에 프로필명 포함 (선택)**

현재:
```javascript
return jsonResponse({ success: true, message: '보고서 생성이 시작되었습니다. 1~2분 후 이메일을 확인하세요.' });
```

변경:
```javascript
return jsonResponse({ success: true, message: `[${profile}] 보고서 생성이 시작되었습니다. 1~2분 후 이메일을 확인하세요.` });
```

---

### 5. Worker — 프로필 드롭다운 동적화

**대상 파일:** `worker/index.js`, `worker/wrangler.toml`

**문제:**
L349-351의 프로필 셀렉트가 댄포스만 하드코딩:
```html
<select class="profile-select" id="profileSelect">
  <option value="danfoss">댄포스 코리아</option>
</select>
```

**제약:** Cloudflare Worker에서는 서버 파일시스템(profiles/)에 접근 불가 → 환경변수로 프로필 목록 전달

**작업 단계:**

**(A) wrangler.toml에 PROFILES 변수 추가**

현재 (L8-10):
```toml
[vars]
GITHUB_REPO = "dooosp/b2b-lead-agent"
WORKER_ORIGIN = "https://b2b-lead-trigger.dooosp.workers.dev"
```

변경:
```toml
[vars]
GITHUB_REPO = "dooosp/b2b-lead-agent"
WORKER_ORIGIN = "https://b2b-lead-trigger.dooosp.workers.dev"
PROFILES = '[{"id":"danfoss","name":"댄포스 코리아"}]'
```

**(B) getMainPage()에 env 파라미터 추가**

현재 호출부 (L53):
```javascript
return new Response(getMainPage(), { headers: ... });
```
변경:
```javascript
return new Response(getMainPage(env), { headers: ... });
```

현재 함수 시그니처 (L333):
```javascript
function getMainPage() {
```
변경:
```javascript
function getMainPage(env) {
```

**(C) 드롭다운 동적 렌더링**

현재 (L349-351):
```html
<select class="profile-select" id="profileSelect">
  <option value="danfoss">댄포스 코리아</option>
</select>
```

변경:
```html
<select class="profile-select" id="profileSelect">
  ${(JSON.parse(env.PROFILES || '[{"id":"danfoss","name":"댄포스 코리아"}]'))
    .map(p => '<option value="' + p.id + '">' + p.name + '</option>').join('')}
</select>
```

**(D) 서브페이지(leads/ppt/roleplay/history)에도 프로필 셀렉트 연동**

서브페이지들은 이미 `getProfile()` 헬퍼로 URL 쿼리에서 프로필을 읽음:
```javascript
function getProfile() { return new URLSearchParams(window.location.search).get('profile') || 'danfoss'; }
```

메인 페이지의 네비게이션 링크에 선택된 프로필을 쿼리로 전달:
```html
<!-- 현재 (L359) -->
<a href="/leads" class="btn btn-secondary">리드 상세 보기</a>

<!-- 변경 -->
<a href="/leads" class="btn btn-secondary" onclick="this.href='/leads?profile='+document.getElementById('profileSelect').value">리드 상세 보기</a>
```

같은 패턴으로 `/ppt`, `/roleplay` 링크에도 적용 (3개 링크).

또는 더 깔끔하게: 네비게이션 클릭 핸들러를 JS로 통합:
```javascript
document.querySelectorAll('.nav-buttons a').forEach(a => {
  a.addEventListener('click', function(e) {
    const profile = document.getElementById('profileSelect').value;
    if (profile) {
      e.preventDefault();
      window.location.href = this.getAttribute('href') + '?profile=' + profile;
    }
  });
});
```
이 스크립트를 `getMainPage()`의 `</script>` 직전에 추가.

---

### 6. Worker — Roleplay 경쟁사 하드코딩

**대상 파일:** `worker/index.js`

**문제:**
L232에 댄포스 경쟁사가 하드코딩:
```javascript
`당신은 ${lead.company}의 구매 담당 임원입니다. 까다롭고 가격에 민감하며, 경쟁사(ABB, Siemens, Schneider Electric)와 항상 비교합니다.`
```

**방안 비교:**

| 방안 | 장점 | 단점 |
|------|------|------|
| A. 경쟁사 제거 (일반화) | 코드 1줄 변경, 즉시 적용 | 롤플레이 구체성 약간 감소 |
| B. PROFILES 변수에 competitors 포함 | 프로필별 정확한 경쟁사 | wrangler.toml 복잡도 증가 |

**추천: A안 (일반화)** — 롤플레이 프롬프트에서 경쟁사를 일반화

변경:
```javascript
// Before (L232)
`당신은 ${lead.company}의 구매 담당 임원입니다. 까다롭고 가격에 민감하며, 경쟁사(ABB, Siemens, Schneider Electric)와 항상 비교합니다.`

// After
`당신은 ${lead.company}의 구매 담당 임원입니다. 까다롭고 가격에 민감하며, 경쟁사 제품과 항상 비교합니다.`
```

1줄 변경. `(ABB, Siemens, Schneider Electric)` → `제품` 으로 교체.

---

### 7. email-sender — 프로필별 수신자

**대상 파일:** `email-sender.js`, `profiles/_template.js`, `profiles/danfoss.js`

**문제:**
`email-sender.js` L22에서 수신자가 환경변수 고정:
```javascript
to: process.env.GMAIL_RECIPIENT,
```
다른 고객사 프로필 추가 시 동일 수신자에게 모든 리포트가 발송됨.

**작업 3건:**

**(A) email-sender.js L22 수정**

Before:
```javascript
to: process.env.GMAIL_RECIPIENT,
```

After:
```javascript
to: (profile && profile.emailRecipients) || process.env.GMAIL_RECIPIENT,
```

`profile.emailRecipients`가 truthy이면 우선 사용, 없으면 기존 환경변수 폴백.

**(B) profiles/_template.js에 emailRecipients 필드 추가**

L8 (`industry` 다음)에 추가:
```javascript
emailRecipients: '',        // 리포트 수신 이메일 (빈 값이면 GMAIL_RECIPIENT 사용)
```

**(C) profiles/danfoss.js에 emailRecipients 필드 추가**

L4 (`industry` 다음)에 추가:
```javascript
emailRecipients: '',  // 기본 GMAIL_RECIPIENT 사용
```

빈 문자열이므로 기존 동작(GMAIL_RECIPIENT)과 동일. 향후 댄포스 전용 수신자 설정 가능.

---

### 8. package.json 메타데이터

**대상 파일:** `package.json`

**문제 2건:**

**(A) L4 — description이 댄포스 전용 표현**
```json
"description": "B2B 리드 발굴 에이전트 - Danfoss 맞춤형",
```

변경:
```json
"description": "B2B 리드 발굴 에이전트 - 프로필 기반 멀티 고객사",
```

**(B) L7-8 — scripts에 --profile 누락**

현재:
```json
"scripts": {
  "start": "node main.js",
  "email": "node main.js --email"
}
```

`npm start` 실행 시 `--profile`이 없어서 사용법만 출력되고 종료됨.

변경:
```json
"scripts": {
  "start": "node main.js --profile danfoss",
  "email": "node main.js --profile danfoss --email"
}
```

기본 프로필을 danfoss로 설정. 다른 프로필은 `node main.js --profile <id>` 직접 실행.

---

## 작업 순서

| 순서 | 항목 | 파일 수 | 변경 라인 수(추정) |
|------|------|---------|-------------------|
| 1 | reports 마이그레이션 | 파일 이동/삭제 | 스크립트 1회 |
| 2 | .gitignore 수정 | 1 | 3줄 |
| 3 | package.json 정리 | 1 | 3줄 |
| 4 | GitHub Actions 수정 | 1 | 6줄 |
| 5 | email-sender + profiles | 3 | 4줄 |
| 6 | Worker /trigger 프로필 전달 | 1 | 6줄 |
| 7 | Worker 드롭다운 동적화 | 2 | 15줄 |
| 8 | Worker roleplay 일반화 | 1 | 1줄 |
| **합계** | | **10파일** | **~40줄** |

---

## 검증 체크리스트

- [ ] `reports/` 루트에 JSON 파일 없음
- [ ] `reports/danfoss/lead_history.json`에 과거 리드 포함 (머지 확인)
- [ ] `git add reports/danfoss/latest_leads.json` 성공 (.gitignore 화이트리스트)
- [ ] `node main.js` (프로필 없이) → 사용법 + 프로필 목록 출력
- [ ] `node main.js --profile danfoss` → 파이프라인 정상 실행
- [ ] GitHub Actions YAML 문법 오류 없음
- [ ] Worker /trigger body에 profile 포함 확인
- [ ] Worker 드롭다운에 프로필 목록 렌더링 확인
- [ ] Worker roleplay 프롬프트에 특정 경쟁사명 없음
- [ ] email-sender가 profile.emailRecipients 우선 사용

---

## 범위 외 (이번에 안 함)

- Worker 실제 배포 (`wrangler deploy`) — 코드 수정 후 배포 가능 여부 확인만
- 새 프로필 추가 테스트 — 댄포스 수정 완료 후 별도
- Worker PPT 프롬프트 프로필 연동 — leads 데이터에 이미 profile 제품 정보 포함되어 있어 현재도 동작함. 심화 개선은 Phase 2
- telegram-bot-agent 재시작 — 코드 수정 완료 후 별도 진행
