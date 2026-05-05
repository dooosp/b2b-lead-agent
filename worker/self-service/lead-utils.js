import { toLeadBriefV1 } from '../lib/leadbrief-v1.js';

const COMPANY_NAME_MAX_LEN = 40;
const COMPANY_NAME_RE = /^[\p{L}0-9 .,&()\-]+$/u;
const PLACEHOLDER_RE = /\{[^}]{1,40}\}/g;
const NUMBER_SIGNAL_RE = /(\d|억원|조원|만|%|MW|GW|kW|㎡|m²)/i;
const ROI_RANGE_RE = /\d+(?:\.\d+)?\s*[~-]\s*\d+(?:\.\d+)?\s*년/;
const ROI_UNKNOWN_RE = /^근거 없음\(추정 불가\)/;
const EVENT_TYPES = new Set(['착공', '증설', '수주', '규제', '입찰', '투자', '채용', '기타']);
const STOCK_SALES_PITCH_PATTERNS = Object.freeze([
  /최고의 .* 경험/i,
  /압도적인 .* 제공/i,
  /브랜드 가치를 더욱 높/i,
  /고객의 신뢰를 더욱 높/i,
  /시장 입지를 강화/i,
  /경쟁사 대비/i,
  /프리미엄 .* 시장/i,
  /고객 만족도를 극대화/i,
  /매출 증대에 기여/i,
  /랜드마크 단지/i,
  /최고의 품질/i
]);
const STOCK_TREND_PATTERNS = Object.freeze([
  /^프리미엄 .* 수요 증가/i,
  /^프리미엄 .* 시장 성장/i,
  /^시장 성장[, ]/i,
  /^디지털 전환 가속/i,
  /^에너지 효율 투자 확대$/i,
  /선호도 증가/i,
  /시장 경쟁 심화/i
]);
const TREND_FOCUS_RULES = Object.freeze([
  { pattern: /(ai|인공지능|피지컬ai|자동화|스마트팩토리)/i, text: 'AI 기반 자동화와 운영 표준화 요구가 커지고 있습니다.' },
  { pattern: /(에너지|탄소|전력|피크|효율)/i, text: '에너지 검증과 원단위 관리 요구가 커지고 있습니다.' },
  { pattern: /(수주|입찰|재건축|개발|착공|준공)/i, text: '프로젝트 수주 이후 운영 전환 기준과 데이터 인수인계 요구가 커지고 있습니다.' },
  { pattern: /(물류|배송|센터|창고|풀필먼트)/i, text: '운영 가시화와 센터별 성과 관리 요구가 커지고 있습니다.' },
  { pattern: /(설비|예지보전|유지보수|정지시간)/i, text: '설비 상태 모니터링과 예방 정비 요구가 커지고 있습니다.' }
]);
const SELF_SERVICE_MODEL_SCHEMA_KEYS = Object.freeze([
  'company',
  'project_title',
  'recommended_product',
  'expected_roi',
  'sales_pitch',
  'trend',
  'sources'
]);

const SELF_SERVICE_RESPONSE_SCHEMA_KEYS = Object.freeze([
  'company',
  'score',
  'grade',
  'project_title',
  'recommended_product',
  'expected_roi',
  'sales_pitch',
  'trend',
  'sources',
  'signal',
  'whyNow',
  'recommendedMessage',
  'generationMode',
  'verificationStatus',
  'reviewStatus',
  'confidence',
  'confidenceReason',
  'assumptions',
  'dataGaps'
]);
const GENERATION_MODES = new Set(['llm', 'heuristic', 'demo', 'unavailable']);
const VERIFICATION_STATUSES = new Set(['verified', 'needs_review', 'draft', 'unverified']);
const SOURCE_RESOLUTIONS = new Set(['direct', 'unresolved']);
const DISCOVERY_URL_RE = /(news\.google\.com|search\.naver\.com)/i;

export function sanitizeLeadText(value, fallback = '') {
  const input = typeof value === 'string' ? value : '';
  const cleaned = input
    .replace(/<[^>]*>/g, ' ')
    .replace(PLACEHOLDER_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned) return cleaned;
  return typeof fallback === 'string' ? fallback.trim() : '';
}

function isHttpUrl(value = '') {
  return /^https?:\/\//i.test(String(value || ''));
}

function normalizeSourceUrl(value) {
  const cleaned = sanitizeLeadText(value, '');
  return isHttpUrl(cleaned) ? cleaned : '';
}

function normalizeSourceMetaText(value, maxLen = 200) {
  return sanitizeLeadText(value, '').slice(0, maxLen);
}

function isDiscoveryUrl(url = '') {
  return DISCOVERY_URL_RE.test(String(url || ''));
}

function shouldMergeSourceArticle(source, article) {
  if (!source || !article) return false;
  const sourceTitle = sanitizeLeadText(source.title, '');
  const sourceUrl = normalizeSourceUrl(source.url);
  const sourceOriginUrl = normalizeSourceUrl(source.originUrl || source.discoveryUrl);
  const articleTitle = sanitizeLeadText(article.title, '');
  const articleUrl = normalizeSourceUrl(article.link);
  const articleOriginUrl = normalizeSourceUrl(article.originalLink || article.originalUrl);

  return Boolean(
    (sourceTitle && articleTitle && sourceTitle === articleTitle)
    || (sourceUrl && articleUrl && sourceUrl === articleUrl)
    || (sourceUrl && articleOriginUrl && sourceUrl === articleOriginUrl)
    || (sourceOriginUrl && articleUrl && sourceOriginUrl === articleUrl)
    || (sourceOriginUrl && articleOriginUrl && sourceOriginUrl === articleOriginUrl)
  );
}

function normalizeSourceResolution(value, { url = '', originUrl = '' } = {}) {
  const cleaned = normalizeSourceMetaText(value, 40).toLowerCase();
  if (SOURCE_RESOLUTIONS.has(cleaned)) return cleaned;
  if (isDiscoveryUrl(url)) return 'unresolved';
  if (originUrl && originUrl !== url) return 'direct';
  return isHttpUrl(url) ? 'direct' : '';
}

function buildSourceContract(source, article) {
  const articleTitle = sanitizeLeadText(article && article.title, '');
  const articleUrl = normalizeSourceUrl(article && article.link);
  const title = sanitizeLeadText(source && source.title, articleTitle);
  const url = normalizeSourceUrl(source && source.url) || articleUrl;
  if (!title || !url) return null;

  const explicitOriginUrl = normalizeSourceUrl(source && (source.originUrl || source.discoveryUrl));
  const articleOriginUrl = normalizeSourceUrl(article && (article.originalLink || article.originalUrl));
  const rawOriginUrl = explicitOriginUrl || articleOriginUrl || (isDiscoveryUrl(url) ? url : '');
  const resolution = normalizeSourceResolution(source && source.resolution, { url, originUrl: rawOriginUrl });
  const normalized = { title, url };

  if (rawOriginUrl && (resolution === 'unresolved' || rawOriginUrl !== url || explicitOriginUrl)) {
    normalized.originUrl = rawOriginUrl;
  }

  const query = normalizeSourceMetaText(source && (source.query || source.queryToken), 160)
    || normalizeSourceMetaText(article && article.query, 160);
  if (query) normalized.query = query;

  if (resolution) normalized.resolution = resolution;

  const publisher = normalizeSourceMetaText(source && source.publisher, 120)
    || normalizeSourceMetaText(article && article.source, 120);
  if (publisher) normalized.publisher = publisher;

  const publisherUrl = normalizeSourceUrl(source && source.publisherUrl)
    || normalizeSourceUrl(article && article.sourceUrl);
  if (publisherUrl) normalized.publisherUrl = publisherUrl;

  return normalized;
}

export function normalizeExpectedRoiText(value, fallback = '') {
  const cleaned = sanitizeLeadText(value, fallback);
  if (!cleaned) return '';
  if (/근거\s*없음(?:\s*\(추정\s*불가\))?/u.test(cleaned)) {
    return cleaned.replace(/근거\s*없음(?!\s*\(추정\s*불가\))/u, '근거 없음(추정 불가)');
  }
  if (ROI_RANGE_RE.test(cleaned)) return cleaned;
  if (/\d+(?:\.\d+)?\s*년/.test(cleaned)) return cleaned;
  return `근거 없음(추정 불가) - ${cleaned}`;
}

function normalizeSentenceEnding(value) {
  return sanitizeLeadText(value, '')
    .replace(/\.\s*/g, '. ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.$/, '');
}

function articleContextText(article = {}) {
  return sanitizeLeadText([article.title, article.query, article._body].filter(Boolean).join(' '), '');
}

export function normalizeSalesPitchText(value, { company = '', product = '', projectTitle = '', industry = '', article = null, eventType = '' } = {}) {
  const cleaned = normalizeSentenceEnding(value);
  const isStructured = cleaned
    && cleaned.includes(company)
    && cleaned.includes(product)
    && !STOCK_SALES_PITCH_PATTERNS.some((pattern) => pattern.test(cleaned))
    && cleaned.length <= 180;
  if (isStructured) return cleaned;

  const industryLabel = industry || '해당 산업';
  const challengeByEvent = {
    투자: '신규 투자 이후 운영 표준화와 기준선 정리',
    증설: '증설 이후 설비 데이터 통합과 운영 기준 정리',
    수주: '수주 이후 인수인계와 운영 전환 준비',
    착공: '착공 이후 초기 운영 기준선과 관제 범위 설계',
    규제: '규제 대응을 위한 운영 데이터 증빙 체계 정리',
    입찰: '입찰 단계의 운영 성과 근거와 제안 차별화 준비',
    채용: '운영 인력 부담을 줄이기 위한 자동화 범위 정리',
    기타: '운영 개선 과제와 데이터 연계 범위 정리'
  };
  const challenge = challengeByEvent[eventType] || challengeByEvent.기타;
  return `${company}의 ${industryLabel} 사업에서는 ${challenge}를 먼저 확인해야 합니다. ${product} 기준으로 현장 인터뷰, 기준선 데이터 수집, 우선 파일럿 범위를 묶어 제안하는 접근이 적합합니다.`;
}

export function normalizeTrendText(value, { industry = '', eventType = '', article = null } = {}) {
  const context = articleContextText(article);
  const industryLabel = industry || '해당 산업';
  const focus = TREND_FOCUS_RULES.find((rule) => rule.pattern.test(`${context} ${value}`));
  if (eventType === '규제') {
    return `${industryLabel}에서는 규제 대응과 운영 데이터 가시화 요구가 함께 커지고 있습니다.`;
  }
  if (eventType === '투자' || eventType === '증설' || eventType === '착공') {
    return `${industryLabel}에서는 신규 투자와 설비 확장 국면에서 운영 표준화와 에너지 검증 요구가 동시에 커지고 있습니다.`;
  }
  if (context.includes('채용')) {
    return `${industryLabel}에서는 운영 인력 확보 부담 때문에 자동화와 중앙 관제 수요가 함께 커지고 있습니다.`;
  }
  if (focus) {
    return `${industryLabel}에서는 ${focus.text}`;
  }
  return `${industryLabel}에서는 운영 효율, 에너지 검증, 설비 데이터 통합을 동시에 요구하는 프로젝트가 늘고 있습니다.`;
}

function isValidExpectedRoiText(value) {
  const cleaned = sanitizeLeadText(value, '');
  return ROI_RANGE_RE.test(cleaned) || ROI_UNKNOWN_RE.test(cleaned);
}

export function replaceKnownPlaceholders(value, company, product = '') {
  return String(value || '')
    .replace(/\{company\}/gi, company)
    .replace(/\{target_company\}/gi, company)
    .replace(/\{product\}/gi, product);
}

export function isValidCompanyNameWorker(name = '') {
  const trimmed = String(name || '').trim();
  if (!trimmed) return false;
  if (trimmed.length > COMPANY_NAME_MAX_LEN) return false;
  return COMPANY_NAME_RE.test(trimmed);
}

export function extractCompanyNameWorker(title = '') {
  const cleaned = sanitizeLeadText(title, '')
    .replace(/^\[.*?\]\s*/g, '')
    .replace(/^["']+|["']+$/g, '')
    .trim();
  const m = cleaned.match(/^([A-Za-z0-9가-힣&(). -]{2,40}?)(?:,|\s|-|…)/);
  const company = m ? m[1].trim() : cleaned.slice(0, COMPANY_NAME_MAX_LEN).trim();
  return isValidCompanyNameWorker(company) ? company : '잠재 고객사';
}

export function normalizeCompanyNameWorker(raw = '', fallbackTitle = '') {
  const normalized = sanitizeLeadText(raw, '')
    .replace(/^[A-Z]\s*\|\s*/i, '')
    .replace(/^[A-Z]\.\s*/i, '')
    .replace(/[{}]/g, '')
    .replace(/\s*\|\s*/g, '|')
    .trim();
  const firstSegment = normalized.includes('|') ? normalized.split('|')[0].trim() : normalized;
  const collapsed = firstSegment.replace(/\s+/g, ' ').slice(0, COMPANY_NAME_MAX_LEN).trim();
  if (isValidCompanyNameWorker(collapsed)) return collapsed;
  return extractCompanyNameWorker(fallbackTitle);
}

export function normalizeConfidence(value, article) {
  const c = String(value || '').toUpperCase();
  if (c === 'HIGH' || c === 'MEDIUM' || c === 'LOW') return c;
  if (article && article._hasBody) return 'HIGH';
  if (NUMBER_SIGNAL_RE.test(String((article && article.title) || ''))) return 'MEDIUM';
  return 'LOW';
}

export function normalizeGenerationMode(value, fallback = 'llm') {
  const mode = sanitizeLeadText(value, '').toLowerCase();
  if (GENERATION_MODES.has(mode)) return mode;
  return GENERATION_MODES.has(fallback) ? fallback : 'llm';
}

function normalizeStringList(values) {
  return (Array.isArray(values) ? values : [])
    .map(value => sanitizeLeadText(value, ''))
    .filter(Boolean)
    .slice(0, 8);
}

export function normalizeVerificationStatus(value, {
  generationMode = 'llm',
  confidence = '',
  sources = [],
  evidence = []
} = {}) {
  const status = sanitizeLeadText(value, '').toLowerCase();
  if (VERIFICATION_STATUSES.has(status)) return status;
  const mode = normalizeGenerationMode(generationMode);
  if (mode === 'demo') return 'draft';
  if (mode === 'heuristic' || mode === 'unavailable') return mode === 'unavailable' ? 'unverified' : 'needs_review';
  const normalizedConfidence = normalizeConfidence(confidence, null);
  const hasSources = Array.isArray(sources) && sources.length > 0;
  const hasEvidence = Array.isArray(evidence) && evidence.some(item => sanitizeLeadText(item && item.quote, ''));
  return hasSources && hasEvidence && (normalizedConfidence === 'HIGH' || normalizedConfidence === 'MEDIUM')
    ? 'verified'
    : 'needs_review';
}

export function normalizeDataGapsList(values, {
  generationMode = 'llm',
  confidence = '',
  sources = [],
  evidence = []
} = {}) {
  const gaps = normalizeStringList(values);
  const add = (value) => {
    if (value && !gaps.includes(value)) gaps.push(value);
  };

  const mode = normalizeGenerationMode(generationMode);
  if (mode === 'heuristic') add('LLM 정밀 분석 미완료');
  if (mode === 'demo') add('데모 데이터 - 실제 검증 근거 없음');
  if (!Array.isArray(sources) || sources.length === 0) add('공개 출처 미확인');
  if (!Array.isArray(evidence) || !evidence.some(item => sanitizeLeadText(item && item.quote, ''))) add('직접 근거 인용 미확보');
  const normalizedConfidence = normalizeConfidence(confidence, null);
  if (normalizedConfidence === 'LOW') add('낮은 신뢰도 신호');
  return gaps.slice(0, 8);
}

export function clampScoreByConfidence(score, confidence) {
  let capped = Math.max(0, Math.min(100, Math.round(score)));
  if (confidence === 'LOW' && capped > 65) capped = 65;
  if (confidence === 'MEDIUM' && capped > 80) capped = 80;
  return capped;
}

function parseArticleTimestamp(article) {
  const candidates = [article && article.publishedAt, article && article.pubDate, article && article.date];
  for (const candidate of candidates) {
    const ts = Date.parse(candidate || '');
    if (!Number.isNaN(ts)) return ts;
  }
  return null;
}

function collectScoreKeywords(profile, article) {
  const set = new Set();
  const query = String((article && article.query) || '');
  query.split(/\s+/g).forEach(token => {
    const normalized = token.trim().toLowerCase();
    if (normalized.length >= 2) set.add(normalized);
  });
  const searches = Array.isArray(profile && profile.searchQueries) ? profile.searchQueries : [];
  searches.forEach(search => {
    String(search || '').split(/\s+/g).forEach(token => {
      const normalized = token.trim().toLowerCase();
      if (normalized.length >= 2) set.add(normalized);
    });
  });
  return [...set].slice(0, 20);
}

export function computeScoreWorker(article, profile, confidence = 'MEDIUM', baseline = 70) {
  const titleText = `${(article && article.title) || ''} ${(article && article.query) || ''}`.toLowerCase();
  const ts = parseArticleTimestamp(article);
  const days = ts ? (Date.now() - ts) / (1000 * 60 * 60 * 24) : 90;
  const recencyScore = Math.max(0, 1 - Math.min(days / 365, 1));
  const keywords = collectScoreKeywords(profile, article);
  const hits = keywords.filter(keyword => titleText.includes(keyword)).length;
  const keywordScore = keywords.length > 0 ? Math.min(hits / Math.min(keywords.length, 8), 1) : 0.35;
  const numberSignal = NUMBER_SIGNAL_RE.test(titleText) ? 0.15 : 0;

  let score = Math.round(100 * (0.4 * recencyScore + 0.45 * keywordScore + numberSignal));
  const base = Number(baseline) || 70;
  score = Math.round(score * 0.75 + base * 0.25);
  score = Math.max(45, Math.min(95, score));
  return clampScoreByConfidence(score, confidence);
}

export function gradeFromScore(score) {
  if (score >= 80) return 'A';
  if (score >= 50) return 'B';
  return 'C';
}

export function normalizeSourceList(sources, fallbackArticle) {
  const cleaned = (Array.isArray(sources) ? sources : [])
    .map(source => {
      const article = shouldMergeSourceArticle(source, fallbackArticle) ? fallbackArticle : null;
      return buildSourceContract(source, article);
    })
    .filter(Boolean)
    .slice(0, 3);

  if (cleaned.length > 0) return cleaned;
  const fallbackSource = buildSourceContract(null, fallbackArticle);
  if (fallbackSource) {
    return [fallbackSource];
  }
  return [];
}

export function normalizeEvidenceList(evidence) {
  return (Array.isArray(evidence) ? evidence : [])
    .map(item => {
      const field = sanitizeLeadText(item && item.field, '');
      const quote = sanitizeLeadText(item && item.quote, '');
      const sourceUrl = sanitizeLeadText(item && item.sourceUrl, '');
      if (!field || !quote) return null;
      return { field, quote: quote.slice(0, 300), sourceUrl };
    })
    .filter(Boolean)
    .slice(0, 4);
}

export function normalizeAssumptionsList(assumptions, roiText) {
  const cleaned = (Array.isArray(assumptions) ? assumptions : [])
    .map(item => sanitizeLeadText(item, ''))
    .filter(Boolean)
    .slice(0, 6);
  if (cleaned.length > 0) return cleaned;
  if (NUMBER_SIGNAL_RE.test(String(roiText || ''))) {
    return ['정량 데이터는 공개 기사 기준 추정치이며 실제 현장 데이터로 재산정이 필요합니다.'];
  }
  return [];
}

export function normalizeEventType(value, contextText = '') {
  const normalized = sanitizeLeadText(value, '');
  if (EVENT_TYPES.has(normalized)) return normalized;
  const hay = `${normalized} ${contextText}`.toLowerCase();
  if (hay.includes('수주') || hay.includes('계약')) return '수주';
  if (hay.includes('입찰')) return '입찰';
  if (hay.includes('투자') || hay.includes('증권신고')) return '투자';
  if (hay.includes('규제') || hay.includes('법안') || hay.includes('의무화')) return '규제';
  if (hay.includes('증설') || hay.includes('확장')) return '증설';
  if (hay.includes('착공') || hay.includes('준공')) return '착공';
  if (hay.includes('채용')) return '채용';
  return '기타';
}

export function chooseFallbackProduct(profile) {
  if (profile && profile.products && typeof profile.products === 'object') {
    for (const value of Object.values(profile.products)) {
      if (Array.isArray(value) && value.length > 0) return sanitizeLeadText(value[0], '맞춤 솔루션');
      if (typeof value === 'string' && value.trim()) return sanitizeLeadText(value, '맞춤 솔루션');
    }
  }
  return '맞춤 솔루션';
}

function normalizeMatchToken(value) {
  return sanitizeLeadText(value, '').toLowerCase();
}

function getKnownProfileProducts(profile) {
  if (!profile || !profile.products || typeof profile.products !== 'object') return [];
  const seen = new Set();
  const items = [];
  for (const [category, value] of Object.entries(profile.products)) {
    const names = Array.isArray(value) ? value : [value];
    for (const rawName of names) {
      const name = sanitizeLeadText(rawName, '');
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ category, name });
    }
  }
  return items;
}

function getHintTerms(value) {
  return sanitizeLeadText(value, '')
    .toLowerCase()
    .split(/[\s,/]+/g)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2)
    .slice(0, 12);
}

export function isKnownProfileProduct(profile, product) {
  const normalized = normalizeMatchToken(product);
  if (!normalized) return false;
  return getKnownProfileProducts(profile).some((item) => item.name.toLowerCase() === normalized);
}

export function chooseProductForArticle(profile, article, category = '') {
  const candidates = getKnownProfileProducts(profile);
  if (candidates.length === 0) return chooseFallbackProduct(profile);

  const text = normalizeMatchToken([
    article && article.title,
    article && article.query,
    article && article._body
  ].filter(Boolean).join(' '));
  const categoryConfigProduct = sanitizeLeadText(profile && profile.categoryConfig && profile.categoryConfig[category] && profile.categoryConfig[category].product, '');
  let best = { score: -1, name: categoryConfigProduct || chooseFallbackProduct(profile) };

  for (const candidate of candidates) {
    let score = 0;
    const candidateName = normalizeMatchToken(candidate.name);
    if (!candidateName) continue;
    if (text.includes(candidateName)) score += 8;
    if (category && candidate.category === category) score += 4;
    if (categoryConfigProduct && candidate.name === categoryConfigProduct) score += 3;

    const categoryRules = Array.isArray(profile && profile.categoryRules && profile.categoryRules[candidate.category])
      ? profile.categoryRules[candidate.category]
      : [];
    for (const keyword of categoryRules) {
      const normalizedKeyword = normalizeMatchToken(keyword);
      if (normalizedKeyword && text.includes(normalizedKeyword)) score += 1;
    }

    const knowledge = profile && profile.productKnowledge && profile.productKnowledge[candidate.name];
    if (knowledge && typeof knowledge === 'object') {
      for (const term of [...getHintTerms(knowledge.value), ...getHintTerms(knowledge.roi)]) {
        if (term && text.includes(term)) score += 1;
      }
    }

    if (score > best.score) best = { score, name: candidate.name };
  }

  if (best.score <= 0 && categoryConfigProduct) return categoryConfigProduct;
  return best.name || chooseFallbackProduct(profile);
}

function parseJsonLenient(rawText) {
  const text = String(rawText || '')
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();
  if (!text) return null;

  const candidates = [text];
  const arrayStart = text.indexOf('[');
  const arrayEnd = text.lastIndexOf(']');
  if (arrayStart !== -1 && arrayEnd > arrayStart) {
    candidates.push(text.slice(arrayStart, arrayEnd + 1));
  }
  const objectStart = text.indexOf('{');
  const objectEnd = text.lastIndexOf('}');
  if (objectStart !== -1 && objectEnd > objectStart) {
    candidates.push(text.slice(objectStart, objectEnd + 1));
  }

  const seen = new Set();
  for (const candidate of candidates) {
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    try {
      return JSON.parse(candidate);
    } catch {
      // continue
    }
  }
  return null;
}

function normalizeLeadPayload(parsed) {
  if (Array.isArray(parsed)) return { leads: parsed, summary: '' };
  if (!parsed || typeof parsed !== 'object') return { leads: [], summary: '' };
  if (Array.isArray(parsed.leads)) {
    return { leads: parsed.leads, summary: sanitizeLeadText(parsed.summary, '') };
  }
  if (parsed.output && Array.isArray(parsed.output.leads)) {
    return { leads: parsed.output.leads, summary: sanitizeLeadText(parsed.output.summary, '') };
  }
  return { leads: [], summary: '' };
}

export function parseLeadPayload(rawText) {
  const parsed = parseJsonLenient(rawText);
  return normalizeLeadPayload(parsed);
}

function hasPlaceholders(value) {
  return /\{[^}]{1,40}\}/.test(String(value || ''));
}

function isValidSchemaSource(source) {
  if (!source || typeof source !== 'object') return false;
  const title = sanitizeLeadText(source.title, '');
  const url = normalizeSourceUrl(source.url);
  const originUrl = normalizeSourceUrl(source.originUrl || source.discoveryUrl);
  const publisherUrl = normalizeSourceUrl(source.publisherUrl);
  const resolution = normalizeSourceMetaText(source.resolution, 40).toLowerCase();

  if (!title || !url) return false;
  if ((source.originUrl || source.discoveryUrl) && !originUrl) return false;
  if (source.publisherUrl && !publisherUrl) return false;
  if (resolution && !SOURCE_RESOLUTIONS.has(resolution)) return false;
  return true;
}

function isValidModelSchemaShape(lead) {
  if (!lead || typeof lead !== 'object') return false;
  for (const key of SELF_SERVICE_MODEL_SCHEMA_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(lead, key)) return false;
  }
  if (!isValidCompanyNameWorker(lead.company)) return false;
  if (!sanitizeLeadText(lead.project_title, '')) return false;
  if (!sanitizeLeadText(lead.recommended_product, '')) return false;
  if (!isValidExpectedRoiText(lead.expected_roi)) return false;
  if (!sanitizeLeadText(lead.sales_pitch, '')) return false;
  if (!sanitizeLeadText(lead.trend, '')) return false;
  if (hasPlaceholders(lead.project_title) || hasPlaceholders(lead.expected_roi) || hasPlaceholders(lead.sales_pitch)) return false;
  if (!Array.isArray(lead.sources)) return false;
  return lead.sources.every(isValidSchemaSource);
}

function isValidResponseLeadShape(lead) {
  if (!lead || typeof lead !== 'object') return false;
  const keys = Object.keys(lead).sort();
  if (keys.length !== SELF_SERVICE_RESPONSE_SCHEMA_KEYS.length) return false;
  for (const key of SELF_SERVICE_RESPONSE_SCHEMA_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(lead, key)) return false;
  }
  if (!isValidCompanyNameWorker(lead.company)) return false;
  if (typeof lead.score !== 'number' || Number.isNaN(lead.score) || lead.score < 0 || lead.score > 100) return false;
  if (!['A', 'B', 'C', 'D'].includes(String(lead.grade || ''))) return false;
  if (!sanitizeLeadText(lead.project_title, '')) return false;
  if (!sanitizeLeadText(lead.recommended_product, '')) return false;
  if (!isValidExpectedRoiText(lead.expected_roi)) return false;
  if (!sanitizeLeadText(lead.sales_pitch, '')) return false;
  if (!sanitizeLeadText(lead.trend, '')) return false;
  if (!Array.isArray(lead.sources)) return false;
  if (!GENERATION_MODES.has(String(lead.generationMode || ''))) return false;
  if (!VERIFICATION_STATUSES.has(String(lead.verificationStatus || ''))) return false;
  if (!['HIGH', 'MEDIUM', 'LOW'].includes(String(lead.confidence || ''))) return false;
  if (!sanitizeLeadText(lead.confidenceReason, '')) return false;
  if (!Array.isArray(lead.assumptions)) return false;
  if (!Array.isArray(lead.dataGaps)) return false;
  return lead.sources.every(isValidSchemaSource);
}

export function isValidLeadPayloadSchema(payload) {
  if (!payload || typeof payload !== 'object') return false;
  if (!Array.isArray(payload.leads)) return false;
  if (typeof payload.summary !== 'string') return false;
  if (payload.leads.length === 0) return true;
  return payload.leads.every(isValidModelSchemaShape);
}

export function isValidSelfServiceResponseSchema(payload) {
  if (!payload || typeof payload !== 'object') return false;
  const keys = Object.keys(payload).sort();
  if (keys.length !== 2 || keys[0] !== 'leads' || keys[1] !== 'summary') return false;
  if (!Array.isArray(payload.leads)) return false;
  if (typeof payload.summary !== 'string') return false;
  if (payload.leads.length === 0) return true;
  return payload.leads.every(isValidResponseLeadShape);
}

export function getLeadField(lead, keys) {
  if (!lead || typeof lead !== 'object') return undefined;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(lead, key)) {
      return lead[key];
    }
  }
  return undefined;
}

export function toSchemaLeadWorker(lead) {
  if (!lead || typeof lead !== 'object') return null;
  const company = normalizeCompanyNameWorker(getLeadField(lead, ['company']) || '', '');
  const score = Math.max(0, Math.min(100, Math.round(Number(getLeadField(lead, ['score'])) || 0)));
  const projectTitle = sanitizeLeadText(getLeadField(lead, ['project_title', 'summary']) || '', '');
  const recommendedProduct = sanitizeLeadText(getLeadField(lead, ['recommended_product', 'product']) || '', '');
  const expectedRoi = normalizeExpectedRoiText(getLeadField(lead, ['expected_roi', 'roi']) || '', '');
  const salesPitch = sanitizeLeadText(getLeadField(lead, ['sales_pitch', 'salesPitch']) || '', '');
  const trend = sanitizeLeadText(getLeadField(lead, ['trend', 'globalContext']) || '', '');
  const sources = normalizeSourceList(getLeadField(lead, ['sources']) || [], null);
  const evidence = normalizeEvidenceList(getLeadField(lead, ['evidence']) || []);
  const generationMode = normalizeGenerationMode(getLeadField(lead, ['generationMode', 'generation_mode']), 'llm');
  const confidence = normalizeConfidence(getLeadField(lead, ['confidence']), null);
  const assumptions = normalizeStringList(getLeadField(lead, ['assumptions']) || []);
  if (generationMode === 'heuristic' && assumptions.length === 0) {
    assumptions.push('규칙 기반 빠른 분석이며 LLM 정밀 검토 전 초안입니다.');
  }
  if (generationMode === 'demo' && assumptions.length === 0) {
    assumptions.push('데모 데이터이며 실제 고객 검증 전 초안입니다.');
  }
  const dataGaps = normalizeDataGapsList(getLeadField(lead, ['dataGaps', 'data_gaps']) || [], {
    generationMode,
    confidence,
    sources,
    evidence
  });
  const brief = toLeadBriefV1({
    company,
    signal: projectTitle,
    summary: projectTitle,
    whyNow: trend,
    recommendedMessage: salesPitch,
    sources,
    evidence,
    confidence,
    assumptions,
    dataGaps,
    generationMode,
    verificationStatus: normalizeVerificationStatus(getLeadField(lead, ['verificationStatus', 'verification_status']), {
      generationMode,
      confidence,
      sources,
      evidence
    })
  });
  const schemaLead = {
    company,
    score,
    grade: gradeFromScore(score),
    project_title: projectTitle,
    recommended_product: recommendedProduct,
    expected_roi: expectedRoi,
    sales_pitch: salesPitch,
    trend,
    sources,
    signal: brief.signal,
    whyNow: brief.whyNow,
    recommendedMessage: brief.recommendedMessage,
    generationMode,
    verificationStatus: brief.verificationStatus,
    reviewStatus: brief.reviewStatus,
    confidence,
    confidenceReason: sanitizeLeadText(
      getLeadField(lead, ['confidenceReason', 'confidence_reason']) || '',
      generationMode === 'llm' ? 'LLM 분석 결과입니다.' : '규칙 기반 fallback 결과로 사람 검토가 필요합니다.'
    ),
    assumptions,
    dataGaps: brief.dataGaps
  };
  return isValidResponseLeadShape(schemaLead) ? schemaLead : null;
}

export function createSelfServiceSchemaPayloadWorker(leads, summary = '') {
  const schemaLeads = (Array.isArray(leads) ? leads : [])
    .map(toSchemaLeadWorker)
    .filter(Boolean);
  const normalizedSummary = sanitizeLeadText(summary, '');
  const fallbackSummary = schemaLeads.length > 0
    ? `${schemaLeads.length}개 영업 기회를 즉시 분석했습니다.`
    : '유효한 리드를 찾지 못했습니다.';
  return {
    leads: schemaLeads,
    summary: normalizedSummary || fallbackSummary
  };
}

function normalizeSourcesTitle(lead) {
  const sourceArray = Array.isArray(lead && lead.sources) ? lead.sources : [];
  const first = sourceArray[0];
  return sanitizeLeadText(first && first.title, '');
}

export function findArticleForLead(lead, normalizedSources, articles, articleByUrl, fallbackIndex, company) {
  if (normalizedSources.length > 0 && articleByUrl.has(normalizedSources[0].url)) {
    return articleByUrl.get(normalizedSources[0].url);
  }
  if (normalizedSources.length > 0 && normalizedSources[0].originUrl && articleByUrl.has(normalizedSources[0].originUrl)) {
    return articleByUrl.get(normalizedSources[0].originUrl);
  }

  const sourceTitle = normalizeSourcesTitle(lead);
  if (sourceTitle) {
    const byTitle = articles.find(article => article && article.title === sourceTitle);
    if (byTitle) return byTitle;
  }

  const companyLower = String(company || '').toLowerCase();
  if (companyLower) {
    const byCompany = articles.find(article => String((article && article.title) || '').toLowerCase().includes(companyLower));
    if (byCompany) return byCompany;
  }

  return articles[fallbackIndex] || articles[0] || null;
}

export function detectCategoryWorker(article, profile) {
  const rules = profile.categoryRules && typeof profile.categoryRules === 'object' ? profile.categoryRules : {};
  const categories = Object.keys(rules);
  if (categories.length === 0) return '';

  const text = `${article.title || ''} ${article.query || ''}`.toLowerCase();
  for (const category of categories) {
    const keywords = Array.isArray(rules[category]) ? rules[category] : [];
    if (keywords.some(keyword => String(keyword).toLowerCase() && text.includes(String(keyword).toLowerCase()))) {
      return category;
    }
  }
  return categories[0];
}
