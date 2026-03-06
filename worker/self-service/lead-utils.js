const COMPANY_NAME_MAX_LEN = 40;
const COMPANY_NAME_RE = /^[\p{L}0-9 .,&()\-]+$/u;
const PLACEHOLDER_RE = /\{[^}]{1,40}\}/g;
const NUMBER_SIGNAL_RE = /(\d|억원|조원|만|%|MW|GW|kW|㎡|m²)/i;
const ROI_RANGE_RE = /\d+(?:\.\d+)?\s*[~-]\s*\d+(?:\.\d+)?\s*년/;
const ROI_UNKNOWN_RE = /^근거 없음\(추정 불가\)/;
const EVENT_TYPES = new Set(['착공', '증설', '수주', '규제', '입찰', '투자', '채용', '기타']);
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
  'sources'
]);

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
      const title = sanitizeLeadText(source && source.title, '');
      const url = sanitizeLeadText(source && source.url, '');
      if (!title || !/^https?:\/\//i.test(url)) return null;
      return { title, url };
    })
    .filter(Boolean)
    .slice(0, 3);

  if (cleaned.length > 0) return cleaned;
  if (fallbackArticle && fallbackArticle.title && /^https?:\/\//i.test(fallbackArticle.link || '')) {
    return [{ title: sanitizeLeadText(fallbackArticle.title, ''), url: fallbackArticle.link }];
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
  const url = sanitizeLeadText(source.url, '');
  return Boolean(title) && /^https?:\/\//i.test(url);
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
  const schemaLead = {
    company,
    score,
    grade: gradeFromScore(score),
    project_title: projectTitle,
    recommended_product: recommendedProduct,
    expected_roi: expectedRoi,
    sales_pitch: salesPitch,
    trend,
    sources
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
