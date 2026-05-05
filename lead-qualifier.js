const { classifyArticleBody, getArticleContextText, getTrustedArticleBody } = require('./article-trust');

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeSourceUrl(value) {
  const url = normalizeText(value);
  if (!url) return '';

  try {
    const parsed = new URL(url);
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return url;
  }
}

function detectSourceResolution(article = {}) {
  const explicit = normalizeText(article.resolution || article.resolutionStatus);
  if (explicit) return explicit;
  if (article.resolvedUrl === true) return 'resolved';
  if (article.resolvedUrl === false) return 'unresolved';
  return 'direct';
}

function buildTraceableSource(article = {}, index = 0) {
  const url = normalizeSourceUrl(article.link);
  const originUrl = normalizeSourceUrl(article.originalLink || article.originalUrl || '');
  const resolution = detectSourceResolution(article);
  return {
    sourceId: `A${index + 1}`,
    title: normalizeText(article.title),
    url,
    source: normalizeText(article.source),
    query: normalizeText(article.query),
    publishedAt: normalizeText(article.pubDate || article.publishedAt),
    originUrl: originUrl && (originUrl !== url || resolution !== 'direct') ? originUrl : '',
    resolution,
    contentAvailable: Boolean(normalizeText(article.content)),
  };
}

function buildArticleTraceIndex(articles = []) {
  const byId = new Map();
  const byUrl = new Map();
  const byTitle = new Map();

  articles.forEach((article, index) => {
    const trace = buildTraceableSource(article, index);
    if (!trace.title && !trace.url) return;

    byId.set(trace.sourceId, trace);
    if (trace.title) byTitle.set(trace.title, trace);
    if (trace.url) byUrl.set(trace.url, trace);
    if (trace.originUrl) byUrl.set(trace.originUrl, trace);
  });

  return { byId, byUrl, byTitle };
}

function normalizeLeadSourceIds(sourceIds) {
  return (Array.isArray(sourceIds) ? sourceIds : [])
    .map(value => normalizeText(value).toUpperCase())
    .filter(value => /^A\d+$/.test(value));
}

function dedupeSourceTraces(traces = []) {
  const seen = new Set();
  const unique = [];

  for (const trace of traces) {
    if (!trace || !trace.title || !trace.url) continue;
    const key = [trace.sourceId || '', trace.url, trace.title].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(trace);
  }

  return unique;
}

function normalizeLeadSources(lead = {}, traceIndex = buildArticleTraceIndex()) {
  const sourceIds = normalizeLeadSourceIds(lead.sourceIds);
  const normalizedFromIds = [];

  for (const sourceId of sourceIds) {
    const matchedById = traceIndex.byId.get(sourceId);
    if (matchedById) normalizedFromIds.push(matchedById);
  }

  if (normalizedFromIds.length > 0) {
    return dedupeSourceTraces(normalizedFromIds);
  }

  const normalized = [];
  for (const source of Array.isArray(lead.sources) ? lead.sources : []) {
    const title = normalizeText(source && source.title);
    const url = normalizeSourceUrl(source && source.url);
    if (!title && !url) continue;

    const matched =
      (url && traceIndex.byUrl.get(url)) ||
      (title && traceIndex.byTitle.get(title));

    if (matched) {
      normalized.push(matched);
      continue;
    }

    if (title && url) {
      normalized.push({
        sourceId: '',
        title,
        url,
        source: normalizeText(source && source.source),
        query: normalizeText(source && source.query),
        publishedAt: normalizeText(source && source.publishedAt),
        originUrl: normalizeSourceUrl(source && source.originUrl),
        resolution: normalizeText(source && source.resolution) || 'unverified',
        contentAvailable: Boolean(source && source.contentAvailable),
      });
    }
  }

  return dedupeSourceTraces(normalized);
}

function normalizeQualifiedLead(lead, traceIndex) {
  const sourceIds = normalizeLeadSourceIds(lead && lead.sourceIds);
  return {
    ...lead,
    sourceIds,
    sources: normalizeLeadSources(lead, traceIndex),
  };
}

function normalizeQualifiedLeads(leads, articles) {
  const traceIndex = buildArticleTraceIndex(articles);
  return (Array.isArray(leads) ? leads : [])
    .filter(lead => lead && typeof lead.company === 'string' && typeof lead.score === 'number')
    .map((lead) => normalizeQualifiedLead(lead, traceIndex));
}

function normalizeStringList(values) {
  return (Array.isArray(values) ? values : [])
    .map((value) => normalizeText(value))
    .filter(Boolean);
}

function normalizeGenerationMode(value, fallback = 'llm') {
  const mode = normalizeText(value).toLowerCase();
  if (mode === 'llm' || mode === 'heuristic' || mode === 'demo') return mode;
  return fallback;
}

function normalizeConfidenceValue(value) {
  const confidence = normalizeText(value).toUpperCase();
  return confidence === 'HIGH' || confidence === 'MEDIUM' || confidence === 'LOW' ? confidence : '';
}

function normalizeReviewStatusValue() {
  return 'NEEDS_REVIEW';
}

function hasUsableSourceEvidence(lead = {}) {
  return Array.isArray(lead.sources) && lead.sources.some((source) => normalizeText(source && source.title) && normalizeText(source && source.url));
}

function hasEvidenceQuotes(lead = {}) {
  return Array.isArray(lead.evidence) && lead.evidence.some((item) => normalizeText(item && item.quote));
}

function deriveVerificationStatus(lead = {}, generationMode = 'llm') {
  const explicit = normalizeText(lead.verificationStatus).toLowerCase();
  if (['verified', 'needs_review', 'draft', 'unverified'].includes(explicit)) return explicit;
  if (generationMode === 'demo') return 'draft';
  if (generationMode === 'heuristic') return 'needs_review';

  const confidence = normalizeConfidenceValue(lead.confidence);
  if (hasUsableSourceEvidence(lead) && hasEvidenceQuotes(lead) && (confidence === 'HIGH' || confidence === 'MEDIUM')) {
    return 'verified';
  }
  return 'needs_review';
}

function deriveDataGaps(lead = {}, generationMode = 'llm') {
  const gaps = normalizeStringList(lead.dataGaps);
  const add = (value) => {
    if (value && !gaps.includes(value)) gaps.push(value);
  };

  if (generationMode === 'demo') {
    add('Synthetic demo lead, not generated from current market evidence');
    add('Customer-specific budget, timing, and stakeholder validation missing');
    return gaps;
  }

  if (generationMode === 'heuristic') {
    add('LLM lead qualification not completed');
    add('Customer-specific budget, timing, and stakeholder validation missing');
  }

  if (!hasUsableSourceEvidence(lead)) add('Published source evidence missing');
  const confidence = normalizeConfidenceValue(lead.confidence);
  if (!confidence) add('Confidence was not provided by the lead generator');
  if (confidence === 'LOW') add('Low-confidence public signal');
  if (!hasEvidenceQuotes(lead)) add('Direct evidence quote missing');

  return gaps;
}

function withGenerationMetadata(lead = {}, generationMode = 'llm') {
  const mode = normalizeGenerationMode(lead.generationMode, generationMode);
  const confidence = normalizeConfidenceValue(lead.confidence) || (mode === 'llm' ? '' : 'LOW');
  const assumptions = normalizeStringList(lead.assumptions);
  if (mode === 'demo' && assumptions.length === 0) {
    assumptions.push('Demo lead generated from templates and public article titles only.');
  }
  if (mode === 'heuristic' && assumptions.length === 0) {
    assumptions.push('Rule-based fallback lead that requires human review before use.');
  }

  return {
    ...lead,
    signal: normalizeText(lead.signal || lead.summary || lead.project_title),
    whyNow: normalizeText(lead.whyNow || lead.urgencyReason || lead.globalContext || lead.trend),
    recommendedMessage: normalizeText(lead.recommendedMessage || lead.salesPitch || lead.sales_pitch),
    reviewStatus: normalizeReviewStatusValue(lead.reviewStatus),
    generationMode: mode,
    verificationStatus: deriveVerificationStatus({ ...lead, confidence }, mode),
    confidence,
    confidenceReason: normalizeText(lead.confidenceReason) || (mode === 'llm'
      ? 'LLM analysis completed, but confidence rationale was not supplied.'
      : 'Fallback output requires human review.'),
    assumptions,
    dataGaps: deriveDataGaps({ ...lead, confidence }, mode),
  };
}

function withGenerationMetadataForAll(leads, generationMode) {
  return (Array.isArray(leads) ? leads : []).map((lead) => withGenerationMetadata(lead, generationMode));
}

function isDemoFallbackAllowed(options = {}) {
  return options.allowDemoFallback === true
    || options.allowDemoLeads === true
    || process.env.ALLOW_DEMO_LEADS === 'true'
    || process.env.B2B_LEAD_AGENT_MODE === 'demo';
}

function createQualificationUnavailableError(message, cause) {
  const error = new Error(message);
  error.code = 'LEAD_QUALIFICATION_UNAVAILABLE';
  if (cause) error.cause = cause;
  return error;
}

const COMPANY_MAX_LEN = 40;
const COMPANY_ALLOWED_RE = /^[\p{L}0-9 .,&()\-]+$/u;
const PROJECT_SIGNAL_RE = /(착공|증설|신축|준공|오픈|투자|수주|입찰|채용|확장|가속|도입|구축|양산|공급|개발|계약|선정|진출|발주|협약|MOU)/u;
const TREND_OR_INTERVIEW_RE = /(인터뷰|전망|종류|기회|동향|분석|리포트|보고서|포럼|세미나)/u;
const PERSON_CONTEXT_RE = /^(?:\[[^\]]+\]\s*)*([가-힣]{2,4})\s+.+\s+(대표이사|대표|회장|부회장|사장|부사장|본부장|원장|교수|기자|위원|총괄|상무|전무)\b/u;
const EXECUTIVE_ROLE_RE = /^[가-힣]{2,4}\s+([A-Za-z0-9가-힣&().-]+(?:\s+[A-Za-z0-9가-힣&().-]+){0,1})\s+(대표이사|대표|회장|부회장|사장|부사장|CEO|CFO|CTO|상무|전무|총괄)\b/u;
const CORPORATE_SIGNAL_RE = /(?:[A-Z]{2,}[A-Za-z0-9&().-]*|(?:HD|SK|LG|CJ|GS|LS|KT|KB|NH|DL|HY|DB)[가-힣A-Za-z0-9&().-]+|[가-힣A-Za-z0-9&().-]+(?:BMS|CNS|SDS|SDI|DX|ENC|E&C|전자|전기|일렉트릭|중공업|조선해양|건설|이앤씨|에너지솔루션|물산|상사|제철|화학|반도체|바이오|제약|통운|로지스틱스|엔지니어링|홀딩스|모터스|테크|텍))$/u;
const KNOWN_INVALID_COMPANIES = new Set([
  '인터뷰',
  '건물에너지',
  '선박까지',
  '조선사도',
  '부평 청천동',
  '국내 조선업계',
  'DC 시장',
  '미상',
  'K-조선',
]);
const LOCATION_TOKENS = new Set([
  '서울',
  '인천',
  '부산',
  '대구',
  '광주',
  '대전',
  '세종',
  '판교',
  '송도',
  '마곡',
  '부평',
  '청천동',
]);

// 키워드 기반 카테고리 분류 → 관련 레퍼런스만 선별
function categorizeArticles(articles, profile) {
  const rules = profile.categoryRules;
  const matched = new Set();
  for (const a of articles) {
    const text = getArticleContextText(a).toLowerCase();
    for (const [cat, kws] of Object.entries(rules)) {
      if (kws.some(kw => text.includes(kw))) matched.add(cat);
    }
  }
  return matched.size > 0 ? [...matched] : Object.keys(rules); // 폴백: 전체
}

function buildArticlePromptList(articles) {
  return articles.map((article, index) => {
    const safeTitle = JSON.stringify(article.title || '');
    const trustedBody = getTrustedArticleBody(article);
    const trust = classifyArticleBody(article);
    let entry = `${index + 1}. [기사ID: A${index + 1}] [${article.source}] ${safeTitle} (URL: ${article.link}) (검색키워드: ${article.query})`;
    if (trustedBody) {
      entry += `\n   [검증 본문] ${JSON.stringify(trustedBody.substring(0, 500))}`;
    } else if (trust.bodyTrust === 'low') {
      entry += `\n   [본문 저신뢰 - ${trust.bodyTrustReason}]`;
    } else {
      entry += `\n   [본문 없음 - 제목과 키워드 기반 추론 필요]`;
    }
    return entry;
  }).join('\n\n');
}

function buildLeadAnalysisPrompt(profile, articles) {
  const articleList = buildArticlePromptList(articles);

  const knowledgeBase = Object.entries(profile.productKnowledge)
    .map(([name, info]) => `- ${name}: 핵심가치="${info.value}", ROI="${info.roi}"`)
    .join('\n');

  const productLineup = Object.entries(profile.products)
    .map(([cat, items]) => `- ${cat.charAt(0).toUpperCase() + cat.slice(1)}: ${items.join(', ')}`)
    .join('\n');

  const relevantCategories = categorizeArticles(articles, profile);
  const globalRefStr = Object.entries(profile.globalReferences)
    .filter(([category]) => relevantCategories.includes(category))
    .map(([category, cases]) => {
      const caseList = cases.slice(0, 3).map(c => `  • ${c.client}: ${c.project} → ${c.result}`).join('\n');
      return `[${category.toUpperCase()}]\n${caseList}`;
    }).join('\n\n');
  console.log(`  카테고리 매칭: ${relevantCategories.join(', ')} (${relevantCategories.length * 3} 레퍼런스)`);

  return `[Context]
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
7. sourceIds: 위 뉴스 목록의 [기사ID]를 배열로 포함하세요. 최소 1개 이상이며, sources와 같은 기사만 가리켜야 합니다.

[Body Trust Guard]
- [검증 본문]으로 표시된 텍스트만 기사 본문 근거로 사용할 수 있습니다.
- [본문 저신뢰] 또는 [본문 없음] 항목의 본문은 사실 근거로 취급하지 말고 제목, URL, 검색키워드만 사용하세요.
- [본문 저신뢰] 항목에서는 body evidence 인용 금지. 제목 인용만 허용합니다.

[Confidence 판정 - 본문 없는 기사]
일부 뉴스는 [본문 없음] 또는 [본문 저신뢰]로 표시됩니다. 이 경우:
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
${articleList}

[Verification - 출력 전 자체 점검]
□ company가 실제 기업명인가? (산업 키워드가 아닌 법인명)
□ product가 제품 라인업에 존재하는 실제 제품인가?
□ ROI 수치가 비현실적이지 않은가? (절감률 50% 이상이면 재검토)
□ sources의 URL이 위 뉴스 목록에 실제 존재하는가?
□ sourceIds가 실제 기사ID와 일치하는가?
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
    "sourceIds": ["A1"],
    "sources": [{"title": "참고한 기사 제목", "url": "기사 원본 URL"}],
    "evidence": [{"field": "근거 대상 필드(summary/roi 등)", "quote": "기사 본문에서 직접 인용", "sourceUrl": "기사 URL"}],
    "confidence": "HIGH 또는 MEDIUM 또는 LOW",
    "confidenceReason": "신뢰도 판정 근거",
    "assumptions": ["ROI 산출 가정1", "가정2"],
    "eventType": "착공|증설|수주|규제|입찰|투자|채용|기타"
  }
]`;
}

function cleanArticleTitle(title = '') {
  return String(title || '')
    .replace(/^(?:\[[^\]]+\]\s*)+/gu, '')
    .replace(/["“”'‘’]/g, '')
    .replace(/\s*-\s*[A-Za-z가-힣.]+(?:뉴스|일보|투데이|경제|타임스|사이트|신문|닷컴|kr|KR)?$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeCompanyCandidate(value = '') {
  return String(value || '')
    .replace(/\[([^\]]+)\]/g, '$1')
    .replace(/^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮0-9]+(?:[.)-]\s*|\s+)/u, '')
    .replace(/^["“”'‘’]+|["“”'‘’]+$/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasCorporateSignal(candidate = '') {
  return CORPORATE_SIGNAL_RE.test(candidate);
}

function isLocationToken(token = '') {
  return LOCATION_TOKENS.has(token) || /(?:시|도|군|구|동|읍|면|리|가)$/u.test(token);
}

function isLocationPhrase(candidate = '') {
  const tokens = String(candidate || '').split(/\s+/).filter(Boolean);
  return tokens.length >= 2 && tokens.every(isLocationToken);
}

function isTrendOrInterviewContext(title = '') {
  const cleaned = cleanArticleTitle(title);
  return TREND_OR_INTERVIEW_RE.test(cleaned) && !PROJECT_SIGNAL_RE.test(cleaned);
}

function candidateAppearsAsProjectSubject(candidate = '', title = '') {
  const cleaned = cleanArticleTitle(title);
  if (!candidate || !cleaned || !PROJECT_SIGNAL_RE.test(cleaned)) return false;
  return new RegExp(`^${escapeRegExp(candidate)}(?:,|\\s)`, 'u').test(cleaned);
}

function isExplicitInvalidCompanyCandidate(candidate = '', title = '') {
  if (!candidate) return true;
  if (candidate.length > COMPANY_MAX_LEN) return true;
  if (!COMPANY_ALLOWED_RE.test(candidate)) return true;
  if (KNOWN_INVALID_COMPANIES.has(candidate)) return true;
  if (/^(?:속보|단독|종합|영상|기획|특별기획)$/u.test(candidate)) return true;
  if (/^(?:K-)?(?:조선|선박|해운|데이터센터|건물에너지|스마트빌딩|친환경)$/u.test(candidate)) return true;
  if (/(?:까지|처럼|만|도|는|가|을|를|과|와)$/u.test(candidate) && !hasCorporateSignal(candidate)) return true;
  if (isLocationPhrase(candidate) && !hasCorporateSignal(candidate)) return true;
  if (/(?:업계|시장|산업|시스템|프로젝트)$/u.test(candidate) && !hasCorporateSignal(candidate)) return true;
  if (/(?:건물|에너지|선박|조선|해운|데이터센터|스마트빌딩)/u.test(candidate) && !hasCorporateSignal(candidate)) return true;

  const personContextMatch = cleanArticleTitle(title).match(PERSON_CONTEXT_RE);
  if (personContextMatch && candidate === personContextMatch[1]) return true;
  return false;
}

function isTrustedCompanyCandidate(candidate = '', contextTitle = '', reason = 'raw') {
  if (isExplicitInvalidCompanyCandidate(candidate, contextTitle)) return false;
  if (isTrendOrInterviewContext(contextTitle) && reason !== 'executive-role' && !candidateAppearsAsProjectSubject(candidate, contextTitle)) {
    return false;
  }
  if (hasCorporateSignal(candidate)) return true;
  return candidateAppearsAsProjectSubject(candidate, contextTitle);
}

function extractFallbackCompanyCandidates(title = '') {
  const cleaned = cleanArticleTitle(title);
  const candidates = [];
  const seen = new Set();
  const pushCandidate = (value, reason) => {
    const candidate = normalizeCompanyCandidate(value);
    if (!candidate || seen.has(candidate)) return;
    seen.add(candidate);
    candidates.push({ candidate, reason });
  };

  const executiveRoleMatch = cleaned.match(EXECUTIVE_ROLE_RE);
  if (executiveRoleMatch) {
    pushCandidate(executiveRoleMatch[1], 'executive-role');
  }

  const leadingSubjectMatch = cleaned.match(/^([A-Za-z0-9가-힣&().-]{2,40})\s*,/u);
  if (leadingSubjectMatch) {
    pushCandidate(leadingSubjectMatch[1], 'leading-subject');
  }

  const corpPatterns = [
    /((?:HD|SK|LG|CJ|GS|LS|KT|KB|NH|DL|HY|DB)[가-힣A-Za-z0-9&().-]{1,20})/u,
    /([가-힣A-Za-z0-9&().-]{2,30}(?:BMS|CNS|SDS|SDI|DX|ENC|E&C|전자|전기|일렉트릭|중공업|조선해양|건설|이앤씨|에너지솔루션|물산|상사|제철|화학|반도체|바이오|제약|통운|로지스틱스|엔지니어링|홀딩스|모터스|테크|텍))/u,
  ];

  for (const pattern of corpPatterns) {
    const match = cleaned.match(pattern);
    if (match) pushCandidate(match[1], 'corp-pattern');
  }

  return candidates;
}

function getLeadContextTitle(lead = {}) {
  if (Array.isArray(lead.sources)) {
    const sourceWithTitle = lead.sources.find(source => source && source.title);
    if (sourceWithTitle) return sourceWithTitle.title;
  }
  if (typeof lead.summary === 'string' && lead.summary.trim()) return lead.summary;
  return '';
}

function normalizeLeadCompanyName(lead = {}) {
  const contextTitle = getLeadContextTitle(lead);
  const rawCandidate = normalizeCompanyCandidate(lead.company || '');
  if (isTrustedCompanyCandidate(rawCandidate, contextTitle, 'raw')) {
    return rawCandidate;
  }

  for (const { candidate, reason } of extractFallbackCompanyCandidates(contextTitle)) {
    if (candidate !== rawCandidate && isTrustedCompanyCandidate(candidate, contextTitle, reason)) {
      return candidate;
    }
  }

  return '';
}

function replaceCompanyMentions(value, previousCompany, nextCompany) {
  if (typeof value !== 'string' || !value) return value;
  if (!previousCompany || previousCompany === nextCompany) return value;
  return value.replace(new RegExp(escapeRegExp(String(previousCompany)), 'g'), nextCompany);
}

function postProcessQualifiedLead(lead) {
  if (!lead || typeof lead !== 'object') return null;
  const normalizedCompany = normalizeLeadCompanyName(lead);
  if (!normalizedCompany) return null;
  if (normalizedCompany === lead.company) {
    return { ...lead, company: normalizedCompany };
  }
  return {
    ...lead,
    company: normalizedCompany,
    salesPitch: replaceCompanyMentions(lead.salesPitch, lead.company, normalizedCompany),
  };
}

function postProcessQualifiedLeads(leads) {
  return (Array.isArray(leads) ? leads : [])
    .map(postProcessQualifiedLead)
    .filter(Boolean);
}

async function qualifyLeads(articles, profile, options = {}) {
  console.log('[Step 2] Gemini API로 리드 분석 시작...');

  const llm = options.llm || null;

  if (!llm && (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE')) {
    console.error('  [오류] GEMINI_API_KEY가 설정되지 않았습니다. .env 파일을 확인하세요.');
    if (isDemoFallbackAllowed(options)) {
      console.log('  → 명시적 데모 모드로 실행합니다.\n');
      return withGenerationMetadataForAll(generateDemoLeads(articles, profile), 'demo');
    }
    throw createQualificationUnavailableError('Lead qualification unavailable: GEMINI_API_KEY is required for managed production runs.');
  }

  let activeLlm = llm;
  if (!activeLlm) {
    const { createLLMClient } = require('./lib/llm-client');
    activeLlm = createLLMClient({
      provider: 'gemini',
      apiKey: process.env.GEMINI_API_KEY,
      model: 'gemini-3-flash-preview',
      timeout: 30000,
      maxRetries: 1,
    });
  }
  const prompt = buildLeadAnalysisPrompt(profile, articles);

  try {
    const qualifiedLeads = await activeLlm.chatJSON(prompt, { label: 'Gemini-qualify' });
    const validLeads = normalizeQualifiedLeads(qualifiedLeads, articles);

    const hardenedLeads = postProcessQualifiedLeads(validLeads);
    const rejectedCount = validLeads.length - hardenedLeads.length;
    if (rejectedCount > 0) {
      console.log(`  회사명 신뢰 필터로 ${rejectedCount}개 리드 제외`);
    }
    console.log(`  분석 완료: ${hardenedLeads.length}개 리드 발견\n`);
    return withGenerationMetadataForAll(hardenedLeads, 'llm');
  } catch (error) {
    console.error('  [오류] Gemini API 분석 실패:', error.message);
    if (isDemoFallbackAllowed(options)) {
      console.log('  → 명시적 데모 모드로 실행합니다.\n');
      return withGenerationMetadataForAll(generateDemoLeads(articles, profile), 'demo');
    }
    throw createQualificationUnavailableError(`Lead qualification unavailable: ${error.message}`, error);
  }
}

// 회사명 추출 (NER 개선)
function extractCompanyName(title) {
  const cleaned = cleanArticleTitle(title);

  // 패턴 1: 한글 기업명 + 기업형태 (삼성전자, HD한국조선해양, LG에너지솔루션)
  const corpPatterns = [
    /((?:HD|SK|LG|CJ|GS|LS|KT|KB|NH|DL|HY|DB|S&P)[가-힣A-Za-z]*)/,
    /([가-힣A-Z]+(?:전자|중공업|조선|해양|건설|이앤씨|에너지솔루션|물산|상사|제철|화학|반도체|바이오|제약|통운|로지스틱스|하이텍|콜마|판토스|텍))/,
    /([가-힣]+(?:그룹|홀딩스|지주|마사회)(?![가-힣]))/,
    /(포스코[A-Z가-힣]*)/
  ];

  for (const pattern of corpPatterns) {
    const match = cleaned.match(pattern);
    if (match) {
      const candidate = normalizeCompanyCandidate(match[1]);
      if (isTrustedCompanyCandidate(candidate, cleaned, 'title-pattern')) {
        return candidate;
      }
    }
  }

  // 패턴 2: 쉼표 전 첫 토큰 (명확한 구분자)
  const commaMatch = cleaned.match(/^([^,]+),/);
  if (commaMatch) {
    const candidate = normalizeCompanyCandidate(commaMatch[1]);
    // 무의미한 토큰 필터링
    const stopwords = ['영상', '속보', '단독', '종합', '긴급', '특징주', '오늘의', '내일의', '친환경', '국내', '올해', '내년'];
    if (
      candidate.length >= 2
      && candidate.length <= 20
      && !stopwords.some(sw => candidate.startsWith(sw))
      && isTrustedCompanyCandidate(candidate, cleaned, 'leading-subject')
    ) {
      return candidate;
    }
  }

  // 패턴 3: 일반 분석 - 첫 번째 유의미 토큰
  const tokens = cleaned.split(/[,·…\s]+/).filter(t => {
    const stopwords = ['영상', '속보', '단독', '종합', '긴급', '특징주', '오늘의', '내일의', '친환경', '국내', '해외', '올해', '내년', '선박', '방산', '수주', '증가', '호황', '확대', '성장', '투자', '조선업', '이어질', '몇십', '듯'];
    return t.length >= 2 && t.length <= 15 && !stopwords.includes(t) && !/^[0-9]+$/.test(t);
  });

  if (tokens[0] && isTrustedCompanyCandidate(tokens[0], cleaned, 'title-pattern')) {
    return tokens[0];
  }

  for (const { candidate, reason } of extractFallbackCompanyCandidates(cleaned)) {
    if (isTrustedCompanyCandidate(candidate, cleaned, reason)) {
      return candidate;
    }
  }

  return '';
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

  return postProcessQualifiedLeads(demoLeads);
}

const analyzeLeads = qualifyLeads;

module.exports = {
  analyzeLeads,
  qualifyLeads,
  buildArticlePromptList,
  buildLeadAnalysisPrompt,
  buildArticleTraceIndex,
  buildTraceableSource,
  normalizeLeadSources,
  normalizeQualifiedLeads,
  extractCompanyName,
  normalizeLeadCompanyName,
  postProcessQualifiedLeads,
};
