import { callGemini } from '../lib/gemini.js';
import { callOpenAI } from '../lib/openai.js';

const COMPANY_NAME_MAX_LEN = 40;
const COMPANY_NAME_RE = /^[\p{L}0-9 .,&()\-]+$/u;
const PLACEHOLDER_RE = /\{[^}]{1,40}\}/g;
const NUMBER_SIGNAL_RE = /(\d|억원|조원|만|%|MW|GW|kW|㎡|m²)/i;
const EVENT_TYPES = new Set(['착공', '증설', '수주', '규제', '입찰', '투자', '채용', '기타']);
const SELF_SERVICE_SCHEMA_KEYS = Object.freeze([
  'company',
  'score',
  'project_title',
  'recommended_product',
  'expected_roi',
  'sales_pitch',
  'trend',
  'sources'
]);

function sanitizeLeadText(value, fallback = '') {
  const input = typeof value === 'string' ? value : '';
  const cleaned = input
    .replace(/<[^>]*>/g, ' ')
    .replace(PLACEHOLDER_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned) return cleaned;
  return typeof fallback === 'string' ? fallback.trim() : '';
}

function replaceKnownPlaceholders(value, company, product = '') {
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

function normalizeConfidence(value, article) {
  const c = String(value || '').toUpperCase();
  if (c === 'HIGH' || c === 'MEDIUM' || c === 'LOW') return c;
  if (article && article._hasBody) return 'HIGH';
  if (NUMBER_SIGNAL_RE.test(String((article && article.title) || ''))) return 'MEDIUM';
  return 'LOW';
}

function clampScoreByConfidence(score, confidence) {
  let capped = Math.max(0, Math.min(100, Math.round(score)));
  if (confidence === 'LOW' && capped > 65) capped = 65;
  if (confidence === 'MEDIUM' && capped > 80) capped = 80;
  return capped;
}

function parseArticleTimestamp(article) {
  const candidates = [article && article.publishedAt, article && article.pubDate, article && article.date];
  for (const c of candidates) {
    const ts = Date.parse(c || '');
    if (!Number.isNaN(ts)) return ts;
  }
  return null;
}

function collectScoreKeywords(profile, article) {
  const set = new Set();
  const query = String((article && article.query) || '');
  query.split(/\s+/g).forEach(t => {
    const token = t.trim().toLowerCase();
    if (token.length >= 2) set.add(token);
  });
  const searches = Array.isArray(profile && profile.searchQueries) ? profile.searchQueries : [];
  searches.forEach(s => {
    String(s || '').split(/\s+/g).forEach(t => {
      const token = t.trim().toLowerCase();
      if (token.length >= 2) set.add(token);
    });
  });
  return [...set].slice(0, 20);
}

function computeScoreWorker(article, profile, confidence = 'MEDIUM', baseline = 70) {
  const titleText = `${(article && article.title) || ''} ${(article && article.query) || ''}`.toLowerCase();
  const ts = parseArticleTimestamp(article);
  const days = ts ? (Date.now() - ts) / (1000 * 60 * 60 * 24) : 90;
  const recencyScore = Math.max(0, 1 - Math.min(days / 365, 1));
  const keywords = collectScoreKeywords(profile, article);
  const hits = keywords.filter(k => titleText.includes(k)).length;
  const keywordScore = keywords.length > 0 ? Math.min(hits / Math.min(keywords.length, 8), 1) : 0.35;
  const numberSignal = NUMBER_SIGNAL_RE.test(titleText) ? 0.15 : 0;

  let score = Math.round(100 * (0.4 * recencyScore + 0.45 * keywordScore + numberSignal));
  const base = Number(baseline) || 70;
  score = Math.round(score * 0.75 + base * 0.25);
  score = Math.max(45, Math.min(95, score));
  return clampScoreByConfidence(score, confidence);
}

function gradeFromScore(score) {
  if (score >= 80) return 'A';
  if (score >= 50) return 'B';
  return 'C';
}

function normalizeSourceList(sources, fallbackArticle) {
  const cleaned = (Array.isArray(sources) ? sources : [])
    .map(s => {
      const title = sanitizeLeadText(s && s.title, '');
      const url = sanitizeLeadText(s && s.url, '');
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

function normalizeEvidenceList(evidence) {
  return (Array.isArray(evidence) ? evidence : [])
    .map(e => {
      const field = sanitizeLeadText(e && e.field, '');
      const quote = sanitizeLeadText(e && e.quote, '');
      const sourceUrl = sanitizeLeadText(e && e.sourceUrl, '');
      if (!field || !quote) return null;
      return { field, quote: quote.slice(0, 300), sourceUrl };
    })
    .filter(Boolean)
    .slice(0, 4);
}

function normalizeAssumptionsList(assumptions, roiText) {
  const cleaned = (Array.isArray(assumptions) ? assumptions : [])
    .map(a => sanitizeLeadText(a, ''))
    .filter(Boolean)
    .slice(0, 6);
  if (cleaned.length > 0) return cleaned;
  if (NUMBER_SIGNAL_RE.test(String(roiText || ''))) {
    return ['정량 데이터는 공개 기사 기준 추정치이며 실제 현장 데이터로 재산정이 필요합니다.'];
  }
  return [];
}

function normalizeEventType(value, contextText = '') {
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

function chooseFallbackProduct(profile) {
  if (profile && profile.products && typeof profile.products === 'object') {
    for (const v of Object.values(profile.products)) {
      if (Array.isArray(v) && v.length > 0) return sanitizeLeadText(v[0], '맞춤 솔루션');
      if (typeof v === 'string' && v.trim()) return sanitizeLeadText(v, '맞춤 솔루션');
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
  for (const c of candidates) {
    if (!c || seen.has(c)) continue;
    seen.add(c);
    try {
      return JSON.parse(c);
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

function parseLeadPayload(rawText) {
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

function isValidLeadSchemaShape(lead) {
  if (!lead || typeof lead !== 'object') return false;
  for (const key of SELF_SERVICE_SCHEMA_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(lead, key)) return false;
  }
  if (!isValidCompanyNameWorker(lead.company)) return false;
  if (typeof lead.score !== 'number' || Number.isNaN(lead.score) || lead.score < 0 || lead.score > 100) return false;
  if (!sanitizeLeadText(lead.project_title, '')) return false;
  if (!sanitizeLeadText(lead.recommended_product, '')) return false;
  if (!sanitizeLeadText(lead.expected_roi, '')) return false;
  if (!sanitizeLeadText(lead.sales_pitch, '')) return false;
  if (!sanitizeLeadText(lead.trend, '')) return false;
  if (hasPlaceholders(lead.project_title) || hasPlaceholders(lead.expected_roi) || hasPlaceholders(lead.sales_pitch)) return false;
  if (!Array.isArray(lead.sources) || lead.sources.length === 0) return false;
  return lead.sources.every(isValidSchemaSource);
}

function isValidLeadPayloadSchema(payload) {
  if (!payload || typeof payload !== 'object') return false;
  if (!Array.isArray(payload.leads)) return false;
  if (typeof payload.summary !== 'string') return false;
  if (payload.leads.length === 0) return true;
  return payload.leads.every(isValidLeadSchemaShape);
}

function getLeadField(lead, keys) {
  if (!lead || typeof lead !== 'object') return undefined;
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(lead, k)) {
      return lead[k];
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
  const expectedRoi = sanitizeLeadText(getLeadField(lead, ['expected_roi', 'roi']) || '', '');
  const salesPitch = sanitizeLeadText(getLeadField(lead, ['sales_pitch', 'salesPitch']) || '', '');
  const trend = sanitizeLeadText(getLeadField(lead, ['trend', 'globalContext']) || '', '');
  const sources = normalizeSourceList(getLeadField(lead, ['sources']) || [], null);
  const schemaLead = {
    company,
    score,
    project_title: projectTitle,
    recommended_product: recommendedProduct,
    expected_roi: expectedRoi,
    sales_pitch: salesPitch,
    trend,
    sources
  };
  return isValidLeadSchemaShape(schemaLead) ? schemaLead : null;
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

function findArticleForLead(lead, normalizedSources, articles, articleByUrl, fallbackIndex, company) {
  if (normalizedSources.length > 0 && articleByUrl.has(normalizedSources[0].url)) {
    return articleByUrl.get(normalizedSources[0].url);
  }

  const sourceTitle = normalizeSourcesTitle(lead);
  if (sourceTitle) {
    const byTitle = articles.find(a => a && a.title === sourceTitle);
    if (byTitle) return byTitle;
  }

  const companyLower = String(company || '').toLowerCase();
  if (companyLower) {
    const byCompany = articles.find(a => String((a && a.title) || '').toLowerCase().includes(companyLower));
    if (byCompany) return byCompany;
  }

  return articles[fallbackIndex] || articles[0] || null;
}

function normalizeSourcesTitle(lead) {
  const sourceArray = Array.isArray(lead && lead.sources) ? lead.sources : [];
  const first = sourceArray[0];
  return sanitizeLeadText(first && first.title, '');
}

async function callSalesModel(prompt, env) {
  const options = { temperature: 0, topP: 0.1 };
  let lastErr = null;

  if (env && env.OPENAI_API_KEY) {
    try {
      return await callOpenAI(prompt, env, {
        ...options,
        model: env.OPENAI_MODEL || 'gpt-5.3-codex',
        reasoningEffort: 'medium'
      });
    } catch (e) {
      lastErr = e;
    }
  }

  if (env && env.GEMINI_API_KEY) {
    try {
      return await callGemini(prompt, env, { ...options, maxOutputTokens: 4096 });
    } catch (e) {
      lastErr = e;
    }
  }

  if (lastErr) throw lastErr;
  throw new Error('OPENAI_API_KEY 또는 GEMINI_API_KEY가 설정되지 않았습니다.');
}

async function requestLeadPayload(prompt, env) {
  const raw = await callSalesModel(prompt, env);
  let payload = parseLeadPayload(raw);
  if (isValidLeadPayloadSchema(payload)) return payload;

  const repairPrompt = `Return JSON only. Validate schema.

아래 원문을 지정 스키마의 JSON 객체로 변환하세요. 설명/마크다운 금지.

스키마:
{
  "summary": "string",
  "leads": [
    {
      "company": "string",
      "score": 0,
      "project_title": "string",
      "recommended_product": "string",
      "expected_roi": "string",
      "sales_pitch": "string",
      "trend": "string",
      "sources": [{"title":"string","url":"string"}]
    }
  ]
}

규칙:
- {company}, {product} 같은 placeholder 금지
- company는 40자 이하의 회사명만
- sources는 반드시 배열

원문:
${String(raw || '').slice(0, 12000)}`;

  const repaired = await callSalesModel(repairPrompt, env);
  payload = parseLeadPayload(repaired);
  return payload;
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

    const rawCompany = extractCompanyNameWorker(article.title);
    const company = normalizeCompanyNameWorker(rawCompany, article.title);
    const companyKey = company.toLowerCase();
    if (companySeen.has(companyKey)) continue;
    companySeen.add(companyKey);

    const product = sanitizeLeadText(cfg.product, chooseFallbackProduct(profile));
    const confidence = normalizeConfidence('', article);
    const score = computeScoreWorker(article, profile, confidence, Number(cfg.score) || 70);
    const grade = gradeFromScore(score);
    if (grade === 'C') continue;

    const pitchTemplate = typeof cfg.pitch === 'string' && cfg.pitch.trim()
      ? cfg.pitch
      : '{company}에 {product}를 제안합니다.';
    const summary = sanitizeLeadText(
      String(article.title || '').replace(/^\[.*?\]\s*/g, '').slice(0, 140),
      '프로젝트 관련 신규 동향 포착'
    );
    const roi = sanitizeLeadText(replaceKnownPlaceholders(cfg.roi || '', company, product), '운영 효율 개선 예상');
    const salesPitch = sanitizeLeadText(
      replaceKnownPlaceholders(pitchTemplate, company, product),
      `${company}의 고객 과제를 중심으로 ${product} 도입을 제안합니다.`
    );
    const trend = sanitizeLeadText(cfg.policy || '', '산업 규제 및 효율화 트렌드 대응');
    const sources = article.title && article.link ? [{ title: article.title, url: article.link }] : [];

    leads.push({
      company,
      score,
      grade,
      scoreReason: `기사 최신성/키워드 적합도 기반 ${confidence} 신뢰도 점수`,
      project_title: summary,
      recommended_product: product,
      expected_roi: roi,
      sales_pitch: salesPitch,
      trend,
      sources,
      summary,
      product,
      roi,
      salesPitch,
      globalContext: trend,
      confidence,
      confidenceReason: confidence === 'MEDIUM'
        ? '본문 미확보이나 기사 제목에 정량 신호가 포함되어 신뢰도 보통으로 판정'
        : '본문 미확보 및 제목 정보가 제한적이어서 신뢰도 낮음으로 판정',
      assumptions: [],
      eventType: normalizeEventType('', summary)
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
      entry += `\n   [본문 확보] ${a._body.slice(0, 900)}`;
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
        .map(([cat, items]) => `- ${cat}: ${Array.isArray(items) ? items.join(', ') : items}`)
        .join('\n')
    : '(자동 생성 프로필)';

 const prompt = `[Role]
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
      "score": "number 0~100",
      "project_title": "프로젝트명/규모/일정을 담은 1~2문장",
      "recommended_product": "추천 제품 1개",
      "expected_roi": "ROI 요약",
      "sales_pitch": "고객 과제→정량 해결→레퍼런스 포함 2~3문장",
      "trend": "시장/규제 트렌드",
      "sources": [{"title":"기사 제목","url":"기사 URL"}],
      "confidence": "HIGH|MEDIUM|LOW",
      "confidenceReason": "신뢰도 근거",
      "evidence": [{"field":"title|summary|roi","quote":"원문 문장","sourceUrl":"URL"}],
      "assumptions": ["ROI 가정1", "ROI 가정2"],
      "eventType": "착공|증설|수주|규제|입찰|투자|채용|기타"
    }
  ]
}
3) {company}, {product} 같은 플레이스홀더 절대 금지.
4) 회사명이 "A | ..." 같이 접두 라벨을 포함하지 않도록 하세요.
5) sources는 반드시 배열로 포함하세요.
6) Grade C는 출력하지 마세요.

[신뢰도 정책]
- 본문 확보 기사: confidence=HIGH
- 본문 미확보 + 제목에 숫자/규모/금액 존재: confidence=MEDIUM
- 본문 미확보 + 제목 모호: confidence=LOW

[뉴스 목록]
${newsList}`;

  const payload = await requestLeadPayload(prompt, env);
  if (!isValidLeadPayloadSchema(payload)) {
    throw new Error('SELF_SERVICE_SCHEMA_VALIDATION_FAILED');
  }
  const rawLeads = Array.isArray(payload.leads) ? payload.leads : [];
  const articleByUrl = new Map(articles.filter(a => a && a.link).map(a => [a.link, a]));
  const companySeen = new Set();
  const normalizedLeads = [];
  const fallbackProduct = chooseFallbackProduct(profile);

  rawLeads.forEach((lead, index) => {
    if (!lead || typeof lead !== 'object') return;

    const preSources = normalizeSourceList(lead.sources, articles[index]);
    const fallbackTitle = sanitizeLeadText(
      getLeadField(lead, ['project_title', 'summary', 'company']) || '',
      (articles[index] && articles[index].title) || ''
    );
    const company = normalizeCompanyNameWorker(getLeadField(lead, ['company']) || '', fallbackTitle);
    if (!isValidCompanyNameWorker(company)) return;
    const companyKey = company.toLowerCase();
    if (companySeen.has(companyKey)) return;

    const article = findArticleForLead(lead, preSources, articles, articleByUrl, index, company);
    const confidence = normalizeConfidence(getLeadField(lead, ['confidence']), article);

    const product = sanitizeLeadText(
      replaceKnownPlaceholders(getLeadField(lead, ['recommended_product', 'product']) || '', company, fallbackProduct),
      fallbackProduct
    );
    const summary = sanitizeLeadText(
      replaceKnownPlaceholders(getLeadField(lead, ['project_title', 'summary']) || '', company, product),
      sanitizeLeadText((article && article.title) || '', '프로젝트 관련 신규 동향 포착')
    );
    const roi = sanitizeLeadText(
      replaceKnownPlaceholders(getLeadField(lead, ['expected_roi', 'roi']) || '', company, product),
      '정량 데이터 부족 — 유사 사례 기준 절감률 8~15% 예상'
    );
    const salesPitch = sanitizeLeadText(
      replaceKnownPlaceholders(getLeadField(lead, ['sales_pitch', 'salesPitch']) || '', company, product),
      `${company}의 고객 과제를 중심으로 ${product}의 정량적 효과를 제안합니다.`
    );
    const globalContext = sanitizeLeadText(
      getLeadField(lead, ['trend', 'globalContext', 'global_context']) || '',
      '산업 규제 및 효율화 트렌드 대응'
    );

    const baselineScore = Number(getLeadField(lead, ['score'])) || 70;
    const score = computeScoreWorker(article, profile, confidence, baselineScore);
    const grade = gradeFromScore(score);
    if (grade === 'C') return;

    const sources = normalizeSourceList(lead.sources, article);
    const evidence = normalizeEvidenceList(lead.evidence);
    if (evidence.length === 0 && article && article.title) {
      evidence.push({
        field: 'title',
        quote: sanitizeLeadText(article.title, '').slice(0, 200),
        sourceUrl: article.link || ''
      });
    }
    const assumptions = normalizeAssumptionsList(lead.assumptions, roi);
    const scoreReason = sanitizeLeadText(
      getLeadField(lead, ['scoreReason', 'score_reason']) || '',
      `기사 최신성/키워드 적합도 기반 ${confidence} 신뢰도 점수`
    );
    const confidenceReason = sanitizeLeadText(
      getLeadField(lead, ['confidenceReason', 'confidence_reason']) || '',
      confidence === 'HIGH'
        ? '기사 본문을 확보하여 신뢰도 높음으로 판정'
        : confidence === 'MEDIUM'
          ? '본문은 없지만 제목에 정량 신호가 있어 신뢰도 보통으로 판정'
          : '본문 미확보 및 제목 정보 제한으로 신뢰도 낮음으로 판정'
    );

    companySeen.add(companyKey);
    normalizedLeads.push({
      ...lead,
      company,
      score,
      grade,
      project_title: summary,
      recommended_product: product,
      expected_roi: roi,
      sales_pitch: salesPitch,
      trend: globalContext,
      summary,
      product,
      scoreReason,
      roi,
      salesPitch,
      globalContext,
      urgency: getLeadField(lead, ['urgency']) === 'HIGH' || score >= 85 ? 'HIGH' : 'MEDIUM',
      urgencyReason: sanitizeLeadText(
        getLeadField(lead, ['urgencyReason', 'urgency_reason']) || '',
        score >= 85 ? '단기 의사결정 가능성이 높은 신호가 확인되었습니다.' : '추가 확인이 필요한 중간 단계 기회입니다.'
      ),
      buyerRole: sanitizeLeadText(getLeadField(lead, ['buyerRole', 'buyer_role']) || '', '운영/설비 담당 부서'),
      sources,
      evidence,
      confidence,
      confidenceReason,
      assumptions,
      eventType: normalizeEventType(getLeadField(lead, ['eventType', 'event_type']), `${summary} ${(article && article.title) || ''}`)
    });
  });

  return normalizedLeads.slice(0, 5);
}
