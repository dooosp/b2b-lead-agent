import { callGemini } from '../lib/gemini.js';

export function extractCompanyNameWorker(title = '') {
  const cleaned = String(title)
    .replace(/^\[.*?\]\s*/g, '')
    .replace(/["'""'']/g, '')
    .trim();
  const m = cleaned.match(/^([A-Za-z0-9가-힣&(). -]{2,30}?)(?:,|\s|-|…)/);
  return m ? m[1].trim() : '잠재 고객사';
}

export function detectCategoryWorker(article, profile) {
  const rules = profile.categoryRules && typeof profile.categoryRules === 'object' ? profile.categoryRules : {};
  const categories = Object.keys(rules);
  if (categories.length === 0) return '';

  const text = `${article.title || ''} ${article.query || ''}`.toLowerCase();
  for (const category of categories) {
    const keywords = Array.isArray(rules[category]) ? rules[category] : [];
    if (keywords.some(k => String(k).toLowerCase() && text.includes(String(k).toLowerCase()))) {
      return category;
    }
  }
  return categories[0];
}

export function generateQuickLeadsWorker(articles, profile) {
  const configs = profile.categoryConfig && typeof profile.categoryConfig === 'object' ? profile.categoryConfig : {};
  const fallbackCategory = Object.keys(configs)[0];
  const companySeen = new Set();
  const leads = [];

  for (const article of articles) {
    const category = detectCategoryWorker(article, profile) || fallbackCategory;
    const cfg = configs[category] || configs[fallbackCategory];
    if (!cfg) continue;

    const company = extractCompanyNameWorker(article.title);
    if (companySeen.has(company)) continue;
    companySeen.add(company);

    const pitchTemplate = typeof cfg.pitch === 'string' && cfg.pitch.trim()
      ? cfg.pitch
      : '{company}에 {product}를 제안합니다.';
    const summary = String(article.title || '')
      .replace(/<[^>]*>/g, '')
      .replace(/^\[.*?\]\s*/g, '')
      .trim()
      .slice(0, 140);

    leads.push({
      company,
      summary: summary || '프로젝트 관련 신규 동향 포착',
      product: cfg.product || '맞춤 솔루션',
      score: Number(cfg.score) || 70,
      grade: cfg.grade || 'B',
      roi: cfg.roi || '운영 효율 개선 예상',
      salesPitch: pitchTemplate
        .replace(/\{company\}/g, company)
        .replace(/\{product\}/g, cfg.product || '맞춤 솔루션'),
      globalContext: cfg.policy || '산업 규제 및 효율화 트렌드 대응',
      sources: article.title && article.link ? [{ title: article.title, url: article.link }] : []
    });

    if (leads.length >= 5) break;
  }

  return leads;
}

export async function analyzeLeadsWorker(articles, profile, env) {
  if (articles.length === 0) return [];

  const newsList = articles.map((a, i) => {
    let entry = `${i + 1}. [${a.source}] ${a.title} (URL: ${a.link}) (검색키워드: ${a.query})`;
    if (a._hasBody && a._body) {
      entry += `\n   [본문 확보] ${a._body.slice(0, 800)}`;
    } else {
      entry += `\n   [본문 미확보 — 제목 기반만 분석 가능]`;
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
        .map(([cat, items]) => `- ${cat}: ${Array.isArray(items) ? items.join(', ') : items}`)
        .join('\n')
    : '(자동 생성 프로필)';

  const prompt = `[Role]
당신은 ${profile.name}의 'AI 기술 영업 전략가'입니다.
아래 뉴스에서 영업 기회를 포착하고 분석하세요.

[제품 지식]
${knowledgeBase}

[제품 라인업]
${productLineup}

[경쟁사]
${(profile.competitors || []).join(', ')}

[스코어링 기준 — BANT 기반]
- Grade A (80-100점): 구체적 착공/수주/예산 확정, 발주 타임라인 명시, 의사결정자 언급
- Grade B (50-79점): 산업 트렌드/계획 단계, 예산 미확정이나 수요 예상
- Grade C (0-49점): 제외
각 등급 판정 시 근거를 반드시 포함할 것.

[Confidence 판정 정책]
- [본문 확보] 기사 기반 리드: confidence="HIGH". evidence에 본문 원문을 직접 인용.
- [본문 미확보] + 제목에 구체 숫자/규모/일정/금액 포함: confidence="MEDIUM". score는 최대 80점.
- [본문 미확보] + 제목이 모호(트렌드/일반 뉴스): confidence="LOW". score는 최대 65점.
- confidenceReason에 판정 근거를 명시하세요 (예: "기사 제목에 3,532억원 수주 금액 명시").

[Evidence 규칙]
- [본문 확보] 기사: evidence에 본문 원문 문장을 1개 이상 직접 복사 (요약/변형 금지).
- [본문 미확보] 기사: evidence에 기사 제목에서 핵심 팩트를 인용 가능 (field에 "title" 명시).
  예: {"field": "title", "quote": "SK하이닉스, LG디스플레이 공장 인수 3조원 규모 논의", "sourceUrl": "URL"}
- 숫자(금액/면적/용량)가 포함된 문장은 우선 인용 대상입니다.

[ROI 작성 정책]
- 기사 본문에서 발견한 구체 숫자(금액/면적/용량 등)가 있으면: 산업 평균 절감률 + 발견 숫자로 ROI 범위를 산출하세요.
- 숫자가 없으면: "정량 데이터 부족 — 유사 사례 기준 절감률 N~M% 예상" 형태로만 작성하세요. 구체 금액을 창작하지 마세요.
- assumptions에 ROI 산출에 사용한 모든 가정을 반드시 나열하세요.

[뉴스 목록]
${newsList}

[Format]
Grade C 제외, A와 B만 JSON 배열로 응답. 다른 텍스트 없이 JSON만.
[
  {
    "company": "타겟 기업명",
    "summary": "프로젝트명·규모·일정을 포함한 1~2문장",
    "product": "추천 ${profile.name} 제품 1개",
    "score": 75,
    "grade": "B",
    "scoreReason": "등급 판정 근거 1문장",
    "roi": "ROI 요약 (숫자 있으면 범위 계산, 없으면 절감률%만)",
    "salesPitch": "SPIN 구조: 현황→과제→리스크→가치. 2~3문장.",
    "globalContext": "관련 글로벌 정책/트렌드",
    "urgency": "HIGH or MEDIUM",
    "urgencyReason": "긴급도 근거",
    "buyerRole": "예상 키맨 직급/부서",
    "sources": [{"title": "기사 제목", "url": "기사 URL"}],
    "evidence": [
      {"field": "summary", "quote": "기사 본문에서 복사한 원문 문장", "sourceUrl": "해당 기사 URL"},
      {"field": "roi", "quote": "숫자가 포함된 원문 문장 (있는 경우)", "sourceUrl": "URL"}
    ],
    "confidence": "HIGH 또는 MEDIUM 또는 LOW",
    "confidenceReason": "신뢰도 판정 근거 (본문 확보 여부, 수치 존재 여부 등)",
    "assumptions": ["ROI 산출 가정1", "가정2"],
    "eventType": "착공|증설|수주|규제|입찰|투자|채용|기타"
  }
]`;

  const result = await callGemini(prompt, env);
  let cleaned = result.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const leads = JSON.parse(cleaned);
  return (Array.isArray(leads) ? leads : []).filter(
    lead => lead && typeof lead.company === 'string' && typeof lead.score === 'number'
  ).map(lead => {
    const confidence = ['HIGH', 'MEDIUM', 'LOW'].includes(lead.confidence) ? lead.confidence : 'MEDIUM';
    let score = Number(lead.score) || 0;
    if (confidence === 'LOW' && score > 65) score = 65;
    if (confidence === 'MEDIUM' && score > 80) score = 80;
    const grade = score >= 80 ? 'A' : score >= 50 ? 'B' : 'C';
    return {
      ...lead,
      score,
      grade,
      sources: Array.isArray(lead.sources) ? lead.sources.filter(s => s && s.title && s.url) : [],
      evidence: Array.isArray(lead.evidence) ? lead.evidence.filter(e => e && e.field) : [],
      confidence,
      confidenceReason: typeof lead.confidenceReason === 'string' ? lead.confidenceReason : '',
      assumptions: Array.isArray(lead.assumptions) ? lead.assumptions.filter(a => typeof a === 'string') : [],
      eventType: typeof lead.eventType === 'string' ? lead.eventType : ''
    };
  });
}
