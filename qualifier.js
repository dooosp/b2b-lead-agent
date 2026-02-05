const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('./config');
const { withRetry } = require('./lib/http');

// 키워드 기반 카테고리 분류 → 관련 레퍼런스만 선별
function categorizeArticles(articles) {
  const rules = {
    marine: ['선박', '해운', '조선', '해양', 'LNG', 'IMO', 'EEXI', 'CII', '벙커'],
    datacenter: ['데이터센터', 'DC', 'IDC', '클라우드', 'PUE', '냉각', '서버'],
    factory: ['팩토리', '공장', '자동화', '증설', '생산', '배터리', '반도체', 'EV'],
    coldchain: ['냉동', '냉장', '냉각', '콜드체인', '물류센터', '식품', '백신']
  };
  const matched = new Set();
  for (const a of articles) {
    const text = `${a.title} ${a.query} ${a.content || ''}`.toLowerCase();
    for (const [cat, kws] of Object.entries(rules)) {
      if (kws.some(kw => text.includes(kw))) matched.add(cat);
    }
  }
  return matched.size > 0 ? [...matched] : Object.keys(rules); // 폴백: 전체
}

async function analyzeLeads(articles) {
  console.log('[Step 2] Gemini API로 리드 분석 시작...');

  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
    console.error('  [오류] GEMINI_API_KEY가 설정되지 않았습니다. .env 파일을 확인하세요.');
    console.log('  → 데모 모드로 실행합니다.\n');
    return generateDemoLeads(articles);
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

  // 본문 유무 표시 + 예외 처리 안내
  const newsList = articles.map((a, i) => {
    let entry = `${i + 1}. [${a.source}] ${a.title} (URL: ${a.link}) (검색키워드: ${a.query})`;
    if (a.content) {
      entry += `\n   [본문 있음] ${a.content}`;
    } else {
      entry += `\n   [본문 없음 - 제목과 키워드 기반 추론 필요]`;
    }
    return entry;
  }).join('\n\n');

  // 제품 지식 베이스 문자열 생성
  const knowledgeBase = Object.entries(config.productKnowledge)
    .map(([name, info]) => `- ${name}: 핵심가치="${info.value}", ROI="${info.roi}"`)
    .join('\n');

  // 관련 카테고리만 선별하여 글로벌 성공 사례 생성
  const relevantCategories = categorizeArticles(articles);
  const globalRefStr = Object.entries(config.globalReferences)
    .filter(([category]) => relevantCategories.includes(category))
    .map(([category, cases]) => {
      const caseList = cases.map(c => `  • ${c.client}: ${c.project} → ${c.result}`).join('\n');
      return `[${category.toUpperCase()}]\n${caseList}`;
    }).join('\n\n');
  console.log(`  카테고리 매칭: ${relevantCategories.join(', ')} (${relevantCategories.length * 3} 레퍼런스)`);

  const prompt = `[System]
당신은 댄포스 코리아의 'AI 기술 영업 전략가'입니다.
아래 뉴스를 읽고 단순 요약이 아닌, **'영업 기회 분석 보고서'**를 작성하세요.

[댄포스 제품 지식 베이스]
${knowledgeBase}

[제품 라인업]
- Drives: ${config.products.drives.join(', ')}
- Marine: ${config.products.marine.join(', ')}
- HVAC: ${config.products.hvac.join(', ')}
- Cooling: ${config.products.cooling.join(', ')}

[댄포스 글로벌 성공 사례 - Cross-border Selling Reference]
아래 본사 및 해외 성공 사례를 한국 고객에게 레퍼런스로 제시하세요:
${globalRefStr}

[분석 필수 포함 항목]
1. Target Opportunity: 어떤 기업의 어떤 프로젝트인가?
2. Danfoss Solution: 위 지식 베이스를 참고하여 최적의 제품 1개를 선정.
3. Estimated ROI: 제품 도입 시 예상되는 에너지 절감률 또는 비용 편익을 수치(%)로 제시.
4. Key Pitch (Value Selling): 고객사 담당자에게 보낼 메일의 '첫 문장' (핵심 가치 중심).
5. Global Context: 해당 산업과 관련된 글로벌 탄소 중립 정책 + **위 글로벌 성공 사례 중 유사 프로젝트 1개 언급**.
6. Sources: 이 리드 분석에 참고한 뉴스 기사의 제목과 URL을 배열로 포함. 반드시 위 뉴스 목록에 있는 실제 URL만 사용하세요.

[예외 처리 - 본문 없는 기사]
일부 뉴스는 [본문 없음]으로 표시됩니다. 이 경우:
- 기사 제목과 검색 키워드를 기반으로 프로젝트 내용을 추론하세요.
- 추론 시에는 보수적으로 점수를 매기되, 영업 기회가 있다면 Grade B로 분류하세요.
- "추론 기반 분석"임을 summary에 명시하지 마세요. 자연스럽게 작성하세요.

[스코어링 기준]
- Grade A (80-100점): 구체적 착공/수주/예산이 언급된 프로젝트
- Grade B (50-79점): 산업 트렌드로 향후 수요 예상
- Grade C (0-49점): 단순 동정 뉴스 (제외)

[뉴스 목록]
${newsList}

[출력 형식]
반드시 아래 JSON 배열 형식으로만 응답하세요. 다른 텍스트 없이 JSON만 출력하세요.
Grade C(49점 이하)인 뉴스는 제외하고, Grade A와 B만 포함하세요.

[
  {
    "company": "타겟 기업명",
    "summary": "프로젝트 내용 요약 (1줄)",
    "product": "추천 댄포스 제품 1개",
    "score": 85,
    "grade": "A",
    "roi": "예상 ROI (예: 에너지 30% 절감, 연간 유지보수비 40% 감소 등)",
    "salesPitch": "고객사 담당자에게 보낼 메일 첫 문장 (Value Selling)",
    "globalContext": "관련 글로벌 정책/트렌드 (예: EU ETS, IMO 규제, RE100 등)",
    "sources": [{"title": "참고한 기사 제목", "url": "기사 원본 URL"}]
  }
]`;

  try {
    const result = await withRetry(() => model.generateContent(prompt), { label: 'Gemini-qualify' });
    const response = result.response.text();

    // JSON 파싱 (코드 블록 제거)
    const jsonStr = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const leads = JSON.parse(jsonStr);

    console.log(`  분석 완료: ${leads.length}개 리드 발견\n`);
    return leads;
  } catch (error) {
    console.error('  [오류] Gemini API 분석 실패:', error.message);
    console.log('  → 데모 모드로 실행합니다.\n');
    return generateDemoLeads(articles);
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
function detectCategory(article) {
  const text = `${article.title} ${article.query} ${article.content || ''}`.toLowerCase();

  if (['선박', '해운', '조선', 'lng', 'imo', 'eexi', 'cii'].some(k => text.includes(k))) return 'marine';
  if (['데이터센터', 'dc ', 'idc', '클라우드', 'pue', '서버'].some(k => text.includes(k))) return 'datacenter';
  if (['냉동', '냉장', '콜드체인', '물류센터', '식품'].some(k => text.includes(k))) return 'coldchain';
  if (['공장', '팩토리', '자동화', '배터리', '반도체'].some(k => text.includes(k))) return 'factory';
  return 'factory'; // 기본값
}

// 카테고리별 제품/ROI/레퍼런스 매핑
const categoryConfig = {
  marine: {
    product: 'iC7 Marine 드라이브',
    score: 85,
    grade: 'A',
    roi: '연료 소비 15~18% 절감 + IMO EEXI/CII 규제 벌금 회피',
    policy: 'IMO 2030 탄소중립 규제 (EEXI/CII 등급제)',
    pitch: (company, product) => `${company}의 친환경 선박 프로젝트에 Maersk 300척이 검증한 ${product}로 연료비 18% 절감을 제안합니다.`
  },
  datacenter: {
    product: 'Turbocor 컴프레서',
    score: 80,
    grade: 'A',
    roi: '냉각 전력 35~40% 절감, PUE 1.25 달성',
    policy: 'EU 데이터센터 에너지효율 지침 (2027 시행)',
    pitch: (company, product) => `${company} 데이터센터에 Equinix가 글로벌 표준으로 채택한 ${product}로 PUE 1.25를 달성하세요.`
  },
  coldchain: {
    product: 'Turbocor 오일리스 칠러',
    score: 75,
    grade: 'B',
    roi: '에너지 비용 30~32% 절감, 유지보수비 60% 감소',
    policy: 'RE100 이행 + 글로벌 식품/의약 콜드체인 인증 강화',
    pitch: (company, product) => `${company} 냉동/냉장 설비에 Lineage Logistics가 검증한 ${product}로 에너지 32% 절감을 실현하세요.`
  },
  factory: {
    product: 'VLT AutomationDrive',
    score: 70,
    grade: 'B',
    roi: '생산라인 에너지 25~35% 절감',
    policy: 'EU CBAM 탄소국경세 (2026 본격 시행) + 산업용 모터 IE4 의무화',
    pitch: (company, product) => `${company} 스마트 팩토리에 Volkswagen EV공장이 적용한 ${product}로 에너지 35% 절감을 제안합니다.`
  }
};

// API 키 없을 때 데모 데이터
function generateDemoLeads(articles) {
  const demoLeads = [];
  const refs = config.globalReferences;

  for (const article of articles.slice(0, 5)) {
    const category = detectCategory(article);
    const cfg = categoryConfig[category];
    const company = extractCompanyName(article.title);

    // 해당 카테고리 글로벌 레퍼런스 중 랜덤 선택
    const catRefs = refs[category] || refs.factory;
    const refCase = catRefs[Math.floor(Math.random() * catRefs.length)];

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
      salesPitch: cfg.pitch(company, cfg.product),
      globalContext: `${cfg.policy}. 레퍼런스: ${refCase.client} - ${refCase.result}`,
      sources: [{ title: article.title, url: article.link }]
    });
  }

  return demoLeads;
}

module.exports = { analyzeLeads };
