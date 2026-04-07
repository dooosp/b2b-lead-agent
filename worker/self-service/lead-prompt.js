export function buildLeadAnalysisPrompt(profile, articles) {
  const newsList = articles.map((article, index) => {
    let entry = `${index + 1}. [${article.source}] ${article.title} (URL: ${article.link}) (검색키워드: ${article.query})`;
    if (article._hasBody && article._body) {
      entry += `\n   [본문 확보] ${article._body.slice(0, 900)}`;
    } else {
      entry += `\n   [본문 미확보 — 제목 기반 분석]`;
    }
    return entry;
  }).join('\n\n');

  const knowledgeBase = profile.productKnowledge
    ? Object.entries(profile.productKnowledge)
        .map(([name, info]) => `- ${name}: 핵심가치="${info.value}", ROI="${info.roi}"`)
        .join('\n')
    : '(자동 생성 프로필)';

  const productLineup = profile.products
    ? Object.entries(profile.products)
        .map(([category, items]) => `- ${category}: ${Array.isArray(items) ? items.join(', ') : items}`)
        .join('\n')
    : '(자동 생성 프로필)';

  return `[Role]
당신은 ${profile.name}의 B2B 영업 인텔리전스 분석가입니다.
아래 뉴스에서 실질 영업 기회를 추출하세요.

[제품 지식]
${knowledgeBase}

[제품 라인업]
${productLineup}

[경쟁사]
${(profile.competitors || []).join(', ')}

[출력 강제 규칙]
1) 반드시 JSON 객체 1개만 출력하세요. 마크다운/설명 문장 금지.
2) 아래 스키마를 정확히 따르세요.
{
  "summary": "이번 분석 한 줄 요약",
  "leads": [
    {
      "company": "회사명(한글/영문, 40자 이하, 회사명만)",
      "project_title": "프로젝트명/규모/일정을 담은 1~2문장",
      "recommended_product": "추천 제품 1개",
      "expected_roi": "투자회수 기간 범위(예: 2.0~3.0년) 또는 '근거 없음(추정 불가)'로 시작하는 문장",
      "sales_pitch": "고객 과제→정량 해결→레퍼런스 포함 2~3문장",
      "trend": "시장/규제 트렌드",
      "sources": [{"title":"기사 제목","url":"실제로 확인된 URL","originUrl":"발견/검색 URL(optional)","query":"검색 키워드(optional)","resolution":"direct|unresolved(optional)"}],
      "confidence": "HIGH|MEDIUM|LOW",
      "confidenceReason": "신뢰도 근거",
      "evidence": [{"field":"title|summary|roi","quote":"원문 문장","sourceUrl":"URL"}],
      "assumptions": ["ROI 가정1", "ROI 가정2"],
      "eventType": "착공|증설|수주|규제|입찰|투자|채용|기타"
    }
  ]
}
3) score와 grade는 백엔드가 계산하므로 출력하지 마세요.
4) {company}, {product} 같은 플레이스홀더 절대 금지.
5) 회사명이 "A | ..." 같이 접두 라벨을 포함하지 않도록 하세요.
6) sources는 반드시 배열로 포함하세요. 없으면 []를 사용하세요.
7) sources[].url에는 실제로 확인된 URL만 쓰세요. 직접 기사 URL이 없으면 discovery URL을 유지하고, 확인되지 않은 canonical URL을 추정해 쓰지 마세요.
8) 검색/발견 맥락이 있으면 sources[].originUrl, sources[].query, sources[].resolution에 보존하세요. resolution은 direct 또는 unresolved만 사용하세요.
9) expected_roi에는 근거 없는 숫자를 쓰지 마세요. 투자회수 기간 범위를 제시할 수 없으면 반드시 "근거 없음(추정 불가)"로 시작하세요.
10) Grade C는 출력하지 마세요.
11) company는 반드시 타깃 회사명("${profile.name}")이어야 합니다. 타깃 회사와 무관한 기사는 제외하세요.
12) 기사 제목/본문에 타깃 회사명이 직접 확인되지 않으면 lead로 채택하지 마세요.
13) sales_pitch는 제품 광고 문구가 아니라 영업 접점 제안이어야 합니다. "최고의 경험", "브랜드 가치 강화", "압도적" 같은 마케팅 문구 금지.
14) trend는 일반론이 아니라 기사 사건과 연결된 업계 변화여야 합니다. 단순 "시장 성장"만 쓰지 마세요.
15) recommended_product는 타깃 회사의 소비자 제품 홍보가 아니라, 기사 이벤트와 연결되는 제안 대상 제품/솔루션 1개만 쓰세요.

[신뢰도 정책]
- 본문 확보 기사: confidence=HIGH
- 본문 미확보 + 제목에 숫자/규모/금액 존재: confidence=MEDIUM
- 본문 미확보 + 제목 모호: confidence=LOW

[뉴스 목록]
${newsList}`;
}
