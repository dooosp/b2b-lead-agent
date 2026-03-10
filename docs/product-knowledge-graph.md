# Product Knowledge Graph Foundation

## Goal

기존 `productKnowledge`는 `{ value, roi }` 정도의 얕은 정보만 담고 있어 추천 제품을 설명하거나 반론 대응을 준비하기에 부족했다. 이 PR에서는 기존 계약을 깨지 않고, richer 구조인 `productKnowledgeGraph`를 추가했다.

## Storage Choice

가장 덜 파괴적인 방식으로, 기존 프로필 JS 설정 파일 안에 `productKnowledgeGraph`를 추가했다.

- 기존 코드 호환: `productKnowledge`는 계속 유지
- 신규 확장: `productKnowledgeGraph`는 PR 4 이후 설명/설득 로직이 직접 참조 가능
- 셀프서비스도 동일한 구조를 deterministic blueprint에서 사용

## Supported Fields

각 제품/솔루션 엔트리는 아래 필드를 지원한다.

- `aliases`
- `targetIndustries`
- `targetPersonas`
- `useCases`
- `painsSolved`
- `businessOutcomes`
- `technicalRequirements`
- `integrationConstraints`
- `deploymentComplexity`
- `roiDrivers`
- `proofPoints`
- `differentiators`
- `commonObjections`

## Example Entry

```json
{
  "Turbocor 컴프레서": {
    "aliases": ["Turbocor 오일리스 칠러", "냉각 솔루션"],
    "targetIndustries": ["데이터센터", "콜드체인", "대형 HVAC"],
    "targetPersonas": ["설비 엔지니어", "냉동/냉각 운영 책임자", "에너지 매니저"],
    "useCases": ["데이터센터 냉각 고도화", "콜드체인 오일리스 전환", "고효율 칠러 교체"],
    "painsSolved": ["냉각 전력비 증가", "오일 관리/유지보수 부담", "PUE 개선 압박"],
    "businessOutcomes": ["냉각 전력 절감", "유지보수 비용 감소", "가동률 향상"],
    "technicalRequirements": ["냉동 사이클 설계 검토", "기존 냉각 인프라 용량 분석"],
    "integrationConstraints": ["기존 칠러 룸 배치 확인", "제어 시스템 연동 범위 협의"],
    "deploymentComplexity": "medium",
    "roiDrivers": ["냉각 전력 35~40% 절감", "유지보수비 60% 감소"],
    "proofPoints": ["Equinix PUE 1.58→1.25", "Lineage Logistics 냉각 효율 개선"],
    "differentiators": ["오일리스 압축 기술", "데이터센터/콜드체인 공용 레퍼런스"],
    "commonObjections": ["초기 교체 비용 부담", "기존 냉각 설비와의 호환성 우려"]
  }
}
```

## How Current Logic Can Use It

- `productKnowledge`는 `productKnowledgeGraph`에서 자동 파생되어 기존 qualifier / self-service prompt와 호환된다.
- `chooseProductForArticle`는 이제 `useCases`, `painsSolved`, `businessOutcomes` 같은 필드도 매칭 힌트로 사용한다.
- PR 4에서는 이 graph를 그대로 value proposition / why us / ROI narrative 생성에 직접 연결하면 된다.
