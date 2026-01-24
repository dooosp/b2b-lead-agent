const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('./config');

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

  // 글로벌 성공 사례 문자열 생성
  const globalRefStr = Object.entries(config.globalReferences)
    .map(([category, cases]) => {
      const caseList = cases.map(c => `  • ${c.client}: ${c.project} → ${c.result}`).join('\n');
      return `[${category.toUpperCase()}]\n${caseList}`;
    }).join('\n\n');

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
    const result = await model.generateContent(prompt);
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

// API 키 없을 때 데모 데이터
function generateDemoLeads(articles) {
  const demoLeads = [];

  for (const article of articles.slice(0, 5)) {
    let product = 'VLT AutomationDrive';
    let score = 60;
    let grade = 'B';

    if (article.query.includes('선박')) {
      product = 'iC7 Marine 드라이브';
      score = 85;
      grade = 'A';
    } else if (article.query.includes('데이터센터')) {
      product = 'Turbocor 컴프레서';
      score = 80;
      grade = 'A';
    } else if (article.query.includes('HVAC')) {
      product = 'VLT HVAC Drive';
      score = 75;
      grade = 'B';
    } else if (article.query.includes('냉동') || article.query.includes('냉장')) {
      product = '냉각 솔루션';
      score = 70;
      grade = 'B';
    }

    demoLeads.push({
      company: article.title.split(' ')[0] || '미상',
      summary: article.title,
      product: product,
      score: score,
      grade: grade,
      roi: '에너지 비용 약 30% 절감 예상',
      salesPitch: `${article.title} 관련하여 댄포스 ${product} 솔루션으로 에너지 효율 극대화를 제안합니다.`,
      globalContext: '글로벌 탄소중립 정책 강화에 따른 고효율 설비 수요 증가',
      sources: [{ title: article.title, url: article.link }]
    });
  }

  return demoLeads;
}

module.exports = { analyzeLeads };
