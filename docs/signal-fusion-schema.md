# Signal Fusion Schema Foundation

## Goal

`company_signals` 테이블은 기존 `leads.sources`의 단순 출처 목록을, 이후 PR에서 재사용 가능한 정규화 신호 레코드로 분리하기 위한 기반이다.

현재 레포는 뉴스 기사 기반 리드를 `leads` 단위로 저장하고, `sources`/`evidence`를 JSON 문자열로 붙이는 구조다. 이 PR은 그 흐름을 깨지 않고 다음 단계들을 준비한다.

- 뉴스 외 보도자료, 채용, IR, 공시, 웹사이트 변경 신호 저장
- 한 리드에 여러 개의 강도/신뢰도/시급도 신호 연결
- 이후 enrichment worker가 근거를 소스 단위로 누적 저장
- 대시보드에서 회사/산업별 신호 집계

## New Table

`company_signals`

- `id`: deterministic signal id
- `lead_id`: 기존 `leads.id` 연결
- `profile_id`: 프로필 단위 조회용
- `company`: lead join 없이 회사명 바로 조회
- `signal_type`: `news`, `press_release`, `hiring`, `filing` 등
- `signal_source`: `google-news`, `company-ir`, `crm-note` 등
- `source_url`, `source_title`, `source_published_at`
- `signal_strength`, `recency_score`, `trust_score`: 0-100 정수
- `pain_hint`, `urgency_hint`, `business_impact_hint`
- `raw_excerpt`: 원문 일부 저장
- `structured_evidence_json`: 추출 facts/json blob
- `created_at`

## Why This Comes First

- 기존 `leads` 테이블을 또 비대하게 만들지 않고 소스별 신호를 누적할 저장소가 먼저 필요하다.
- 이후 PR 2의 pain enrichment는 이 테이블에 강도/근거를 저장하면서도 기존 `lead` 응답 계약을 유지할 수 있다.
- 이후 PR 7의 대시보드는 `company_signals` 집계만으로도 최근 강한 buying signal을 바로 보여줄 수 있다.

## Sample Insert

```sql
INSERT INTO company_signals (
  id, lead_id, profile_id, company, signal_type, signal_source,
  source_url, source_title, source_published_at, signal_strength,
  recency_score, trust_score, pain_hint, urgency_hint,
  business_impact_hint, raw_excerpt, structured_evidence_json, created_at
) VALUES (
  'sig_2w4v3v',
  'dlenc_dc_20260310',
  'danfoss',
  'DL E&C',
  'news',
  'google-news',
  'https://example.com/article',
  'DL E&C expands data center pipeline',
  '2026-03-09T10:00:00.000Z',
  82,
  74,
  61,
  'Cooling demand will rise as capacity expands.',
  'Design-stage vendor choices are likely happening now.',
  'Energy cost and uptime exposure increase with each new phase.',
  'The developer plans an additional hyperscale data center phase.',
  '{"sourceType":"article","capacities":["hyperscale phase","new capacity"]}',
  '2026-03-10T09:00:00.000Z'
);
```

## Sample Record JSON

```json
{
  "leadId": "dlenc_dc_20260310",
  "profileId": "danfoss",
  "company": "DL E&C",
  "signalType": "news",
  "signalSource": "google-news",
  "sourceUrl": "https://example.com/article",
  "sourceTitle": "DL E&C expands data center pipeline",
  "sourcePublishedAt": "2026-03-09T10:00:00.000Z",
  "signalStrength": 82,
  "recencyScore": 74,
  "trustScore": 61,
  "painHint": "Cooling demand will rise as capacity expands.",
  "urgencyHint": "Design-stage vendor choices are likely happening now.",
  "businessImpactHint": "Energy cost and uptime exposure increase with each new phase.",
  "rawExcerpt": "The developer plans an additional hyperscale data center phase.",
  "structuredEvidence": {
    "sourceType": "article",
    "capacities": ["hyperscale phase", "new capacity"]
  }
}
```
