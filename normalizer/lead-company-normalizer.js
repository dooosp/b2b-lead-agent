// Company-name rules are shared by model-output normalization and demo qualification.
// Keep candidate matching and rejection order stable.

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

module.exports = {
  extractCompanyName,
  normalizeLeadCompanyName,
  postProcessQualifiedLeads,
};
