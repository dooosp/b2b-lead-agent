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

  const newsList = articles.map((a, i) =>
    `${i + 1}. [${a.source}] ${a.title} (검색어: ${a.query})`
  ).join('\n');

  const prompt = `당신은 댄포스(Danfoss)의 B2B 영업 분석가입니다.
아래 뉴스 목록을 분석하여 댄포스의 제품(인버터, 드라이브, HVAC, 냉각 솔루션)이
필요한 영업 기회를 찾아주세요.

[댄포스 제품군]
- Drives: ${config.products.drives.join(', ')}
- Marine: ${config.products.marine.join(', ')}
- HVAC: ${config.products.hvac.join(', ')}
- Cooling: ${config.products.cooling.join(', ')}

[분석 기준]
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
    "product": "추천 댄포스 제품",
    "score": 85,
    "grade": "A",
    "salesPitch": "영업 멘트 초안 (2-3줄)"
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
      salesPitch: `${article.title} 관련하여 댄포스 ${product} 솔루션 제안 가능합니다.`
    });
  }

  return demoLeads;
}

module.exports = { analyzeLeads };
