const { createLLMClient } = require('./lib/llm-client');

// 키워드 기반 카테고리 분류 → 관련 레퍼런스만 선별
function categorizeArticles(articles, profile) {
  const rules = profile.categoryRules;
  const matched = new Set();
  for (const a of articles) {
    const text = `${a.title} ${a.query} ${a.content || ''}`.toLowerCase();
    for (const [cat, kws] of Object.entries(rules)) {
      if (kws.some(kw => text.includes(kw))) matched.add(cat);
    }
  }
  return matched.size > 0 ? [...matched] : Object.keys(rules); // 폴백: 전체
}

async function analyzeLeads(articles, profile) {
  console.log('[Step 2] Gemini API로 리드 분석 시작...');

  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
    console.error('  [오류] GEMINI_API_KEY가 설정되지 않았습니다. .env 파일을 확인하세요.');
    console.log('  → 데모 모드로 실행합니다.\n');
    return generateDemoLeads(articles, profile);
  }

  const llm = createLLMClient({
    provider: 'gemini',
    apiKey: process.env.GEMINI_API_KEY,
    model: 'gemini-3-flash-preview',
    timeout: 30000,
    maxRetries: 1,
  });

  // 본문 유무 표시 + 예외 처리 안내
  const newsList = articles.map((a, i) => {
    const safeTitle = JSON.stringify(a.title || '');
    const safeContent = a.content ? JSON.stringify(a.content.substring(0, 500)) : null;
    let entry = `${i + 1}. [${a.source}] ${safeTitle} (URL: ${a.link}) (검색키워드: ${a.query})`;
    if (safeContent) {
      entry += `\n   [본문 있음] ${safeContent}`;
    } else {
      entry += `\n   [본문 없음 - 제목과 키워드 기반 추론 필요]`;
    }
    return entry;
  }).join('\n\n');

  // 제품 지식 베이스 문자열 생성
  const knowledgeBase = Object.entries(profile.productKnowledge)
    .map(([name, info]) => `- ${name}: 핵심가치="${info.value}", ROI="${info.roi}"`)
    .join('\n');

  // 제품 라인업 문자열 생성
  const productLineup = Object.entries(profile.products)
    .map(([cat, items]) => `- ${cat.charAt(0).toUpperCase() + cat.slice(1)}: ${items.join(', ')}`)
    .join('\n');

  // 관련 카테고리만 선별하여 글로벌 성공 사례 생성
  const relevantCategories = categorizeArticles(articles, profile);
  const globalRefStr = Object.entries(profile.globalReferences)
    .filter(([category]) => relevantCategories.includes(category))
    .map(([category, cases]) => {
      const caseList = cases.slice(0, 3).map(c => `  • ${c.client}: ${c.project} → ${c.result}`).join('\n');
      return `[${category.toUpperCase()}]\n${caseList}`;
    }).join('\n\n');
  console.log(`  카테고리 매칭: ${relevantCategories.join(', ')} (${relevantCategories.length * 3} 레퍼런스)`);

  const prompt = `[Context]
- 분석 시점: ${new Date().toISOString().split('T')[0]}
- 데이터 소스: 한국 산업 뉴스 (최근 24시간 크롤링)
- 경쟁사: ${profile.competitors.join(', ')}

[Role]
당신은 ${profile.name}의 'AI 기술 영업 전략가'입니다.
10년 이상 B2B 산업장비 영업 경험으로, 뉴스에서 영업 기회를 포착하고 Value Selling 전략을 수립합니다.
아래 뉴스를 읽고 단순 요약이 아닌, **'영업 기회 분석 보고서'**를 작성하세요.

[${profile.name} 제품 지식 베이스]
${knowledgeBase}

[제품 라인업]
${productLineup}

[${profile.name} 글로벌 성공 사례 - Cross-border Selling Reference]
아래 본사 및 해외 성공 사례를 한국 고객에게 레퍼런스로 제시하세요:
${globalRefStr}

[Action]
1. Target Opportunity: 어떤 기업의 어떤 프로젝트인가?
2. ${profile.name} Solution: 위 지식 베이스를 참고하여 최적의 제품 1개를 선정.
3. Estimated ROI: 제품 도입 시 예상되는 에너지 절감률 또는 비용 편익을 수치(%)로 제시.
4. Key Pitch (Value Selling): 고객사 담당자에게 보낼 메일의 '첫 문장' (핵심 가치 중심).
5. Global Context: 해당 산업과 관련된 글로벌 탄소 중립 정책 + **위 글로벌 성공 사례 중 유사 프로젝트 1개 언급**.
6. Sources: 이 리드 분석에 참고한 뉴스 기사의 제목과 URL을 배열로 포함. 반드시 위 뉴스 목록에 있는 실제 URL만 사용하세요.

[Confidence 판정 - 본문 없는 기사]
일부 뉴스는 [본문 미확보]로 표시됩니다. 이 경우:
- 제목에 구체 숫자/규모/일정/금액이 포함: confidence="MEDIUM", score 최대 80점.
- 제목이 모호(트렌드/일반): confidence="LOW", score 최대 65점.
- confidenceReason에 판정 근거를 명시하세요.
- evidence에 기사 제목의 핵심 팩트를 인용 가능 (field: "title").

[스코어링 기준]
- Grade A (80-100점): 구체적 착공/수주/예산이 언급된 프로젝트
- Grade B (50-79점): 산업 트렌드로 향후 수요 예상
- Grade C (0-49점): 단순 동정 뉴스 (제외)

[ROI 작성 정책]
- 기사 본문에서 발견한 구체 숫자(금액/면적/용량 등)가 있으면: 산업 평균 절감률 + 발견 숫자로 ROI 범위를 산출하세요.
- 숫자가 없으면: "정량 데이터 부족 — 유사 사례 기준 절감률 N~M% 예상" 형태로만 작성하세요. 구체 금액을 창작하지 마세요.
- assumptions에 ROI 산출에 사용한 모든 가정을 반드시 나열하세요.

[Tone]
- 객관적이고 데이터 중심적으로 분석. 과장 금지.
- ROI는 보수적 추정 (업계 평균 기반).
- salesPitch는 고객 관점(pain point 해결) 중심, ${profile.name} 자랑 X.

[뉴스 목록]
${newsList}

[Verification - 출력 전 자체 점검]
□ company가 실제 기업명인가? (산업 키워드가 아닌 법인명)
□ product가 제품 라인업에 존재하는 실제 제품인가?
□ ROI 수치가 비현실적이지 않은가? (절감률 50% 이상이면 재검토)
□ sources의 URL이 위 뉴스 목록에 실제 존재하는가?
□ Grade A와 B만 포함했는가?

[Format]
반드시 아래 JSON 배열 형식으로만 응답하세요. 다른 텍스트 없이 JSON만 출력하세요.
Grade C(49점 이하)인 뉴스는 제외하고, Grade A와 B만 포함하세요.

[
  {
    "company": "타겟 기업명",
    "summary": "프로젝트 내용 요약 (1줄)",
    "product": "추천 ${profile.name} 제품 1개",
    "score": 85,
    "grade": "A",
    "roi": "ROI 요약 (숫자 있으면 범위 계산, 없으면 절감률%만)",
    "salesPitch": "고객사 담당자에게 보낼 메일 첫 문장 (Value Selling)",
    "globalContext": "관련 글로벌 정책/트렌드",
    "sources": [{"title": "참고한 기사 제목", "url": "기사 원본 URL"}],
    "evidence": [{"field": "근거 대상 필드(summary/roi 등)", "quote": "기사 본문에서 직접 인용", "sourceUrl": "기사 URL"}],
    "confidence": "HIGH 또는 MEDIUM 또는 LOW",
    "confidenceReason": "신뢰도 판정 근거",
    "assumptions": ["ROI 산출 가정1", "가정2"],
    "eventType": "착공|증설|수주|규제|입찰|투자|채용|기타"
  }
]`;

  try {
    const leads = await llm.chatJSON(prompt, { label: 'Gemini-qualify' });

    // 스키마 검증: 배열 + 필수 필드 확인
    const validLeads = (Array.isArray(leads) ? leads : []).filter(lead =>
      lead && typeof lead.company === 'string' && typeof lead.score === 'number'
    ).map(lead => ({
      ...lead,
      sources: Array.isArray(lead.sources) ? lead.sources.filter(s => s && s.title && s.url) : []
    }));

    console.log(`  분석 완료: ${validLeads.length}개 리드 발견\n`);
    return validLeads;
  } catch (error) {
    console.error('  [오류] Gemini API 분석 실패:', error.message);
    console.log('  → 데모 모드로 실행합니다.\n');
    return generateDemoLeads(articles, profile);
  }
}

// 회사명 추출 (NER 개선)
function extractCompanyName(title) {
  // 전처리: 태그/따옴표/접두사 제거
  let cleaned = title
    .replace(/^\[.*?\]\s*/g, '')          // [영상], [속보] 제거
    .replace(/["'""'']/g, '')             // 모든 따옴표 제거
    .replace(/\s*-\s*[가-힣A-Za-z]+(?:뉴스|일보|투데이|경제|타임스|사이트|신문)?$/g, '') // 언론사명 제거
    .trim();

  // 패턴 1: 한글 기업명 + 기업형태 (삼성전자, HD한국조선해양, LG에너지솔루션)
  const corpPatterns = [
    /((?:HD|SK|LG|CJ|GS|LS|KT|KB|NH|DL|HY|DB|S&P)[가-힣A-Za-z]*)/,
    /([가-힣A-Z]+(?:전자|중공업|조선|해양|건설|이앤씨|에너지솔루션|물산|상사|제철|화학|반도체|바이오|제약|통운|로지스틱스|하이텍|콜마|판토스|텍))/,
    /([가-힣]+(?:그룹|홀딩스|지주|시|도|마사회)(?![가-힣]))/,
    /([가-힣]{2,}(?:조선|해운|건설|전자|화학|시멘트|제분|제당))/,
    /(포스코[A-Z가-힣]*)/
  ];

  for (const pattern of corpPatterns) {
    const match = cleaned.match(pattern);
    if (match) return match[1];
  }

  // 패턴 2: 쉼표 전 첫 토큰 (명확한 구분자)
  const commaMatch = cleaned.match(/^([^,]+),/);
  if (commaMatch) {
    const candidate = commaMatch[1].trim();
    // 무의미한 토큰 필터링
    const stopwords = ['영상', '속보', '단독', '종합', '긴급', '특징주', '오늘의', '내일의', '친환경', '국내', '올해', '내년'];
    if (candidate.length >= 2 && candidate.length <= 20 && !stopwords.some(sw => candidate.startsWith(sw))) {
      return candidate;
    }
  }

  // 패턴 3: 지역명 → 프로젝트명으로 변환 (부평 → 부평 데이터센터)
  const locationMatch = cleaned.match(/^(부평|인천|서울|대구|부산|광주|세종|판교|송도|마곡)\s+(.+?)(?:착공|증설|신축|준공|오픈)/);
  if (locationMatch) {
    return `${locationMatch[1]} ${locationMatch[2].split(/\s+/)[0]}`;
  }

  // 패턴 4: 일반 분석 - 첫 번째 유의미 토큰
  const tokens = cleaned.split(/[,·…\s]+/).filter(t => {
    const stopwords = ['영상', '속보', '단독', '종합', '긴급', '특징주', '오늘의', '내일의', '친환경', '국내', '해외', '올해', '내년', '선박', '방산', '수주', '증가', '호황', '확대', '성장', '투자', '조선업', '이어질', '몇십', '듯'];
    return t.length >= 2 && t.length <= 15 && !stopwords.includes(t) && !/^[0-9]+$/.test(t);
  });

  if (tokens[0]) return tokens[0];

  // 패턴 5: 산업 트렌드 기사 → 업계 전체로 표기 (최후 폴백)
  const industryKeywords = {
    '조선': '국내 조선업계',
    '선박': '국내 조선업계',
    '해운': '국내 해운업계',
    '데이터센터': 'DC 시장',
    '반도체': '국내 반도체업계',
    '배터리': '국내 배터리업계',
    '냉동': '국내 냉동냉장업계',
    '공장': '국내 제조업계',
    '팩토리': '국내 제조업계'
  };

  for (const [keyword, industry] of Object.entries(industryKeywords)) {
    if (cleaned.includes(keyword)) return industry;
  }

  return '미상';
}

// 카테고리 판별
function detectCategory(article, profile) {
  const text = `${article.title} ${article.query} ${article.content || ''}`.toLowerCase();
  const categories = Object.keys(profile.categoryRules);

  for (const cat of categories) {
    if (profile.categoryRules[cat].some(k => text.includes(k.toLowerCase()))) return cat;
  }
  return categories[categories.length - 1]; // 마지막 카테고리를 기본값으로
}

// API 키 없을 때 데모 데이터
function generateDemoLeads(articles, profile) {
  const demoLeads = [];
  const refs = profile.globalReferences;

  for (const article of articles.slice(0, 5)) {
    const category = detectCategory(article, profile);
    const cfg = profile.categoryConfig[category];
    if (!cfg) continue;
    const company = extractCompanyName(article.title);

    // 해당 카테고리 글로벌 레퍼런스 중 랜덤 선택
    const catRefs = refs[category] || Object.values(refs)[0] || [];
    const refCase = catRefs[Math.floor(Math.random() * catRefs.length)];
    const pitchTemplate = (typeof cfg.pitch === 'string' && cfg.pitch.trim())
      ? cfg.pitch
      : '{company}에 {product}를 제안합니다.';
    const salesPitch = typeof cfg.pitch === 'function'
      ? cfg.pitch(company, cfg.product)
      : pitchTemplate
          .replace(/\{company\}/g, company)
          .replace(/\{product\}/g, cfg.product);

    // 프로젝트 요약 (제목에서 태그/따옴표/언론사명 제거)
    const summary = article.title
      .replace(/\s*-\s*[가-힣A-Za-z]+(?:뉴스|일보|투데이|경제|타임스)?$/g, '')
      .replace(/^\[.*?\]\s*/, '')
      .replace(/["'""'']/g, '')
      .trim();

    demoLeads.push({
      company,
      summary,
      product: cfg.product,
      score: cfg.score,
      grade: cfg.grade,
      roi: cfg.roi,
      salesPitch,
      globalContext: refCase
        ? `${cfg.policy}. 레퍼런스: ${refCase.client} - ${refCase.result}`
        : cfg.policy,
      sources: [{ title: article.title, url: article.link }]
    });
  }

  return demoLeads;
}

module.exports = { analyzeLeads };
