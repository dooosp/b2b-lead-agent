import { requestLeadPayload } from './lead-model.js';
import { buildLeadAnalysisPrompt } from './lead-prompt.js';
import {
  chooseProductForArticle,
  chooseFallbackProduct,
  computeScoreWorker,
  createSelfServiceSchemaPayloadWorker,
  detectCategoryWorker,
  extractCompanyNameWorker,
  findArticleForLead,
  getLeadField,
  gradeFromScore,
  isKnownProfileProduct,
  isValidCompanyNameWorker,
  isValidLeadPayloadSchema,
  normalizeAssumptionsList,
  normalizeCompanyNameWorker,
  normalizeConfidence,
  normalizeDataGapsList,
  normalizeEvidenceList,
  normalizeExpectedRoiText,
  normalizeVerificationStatus,
  normalizeSalesPitchText,
  normalizeTrendText,
  normalizeEventType,
  normalizeSourceList,
  replaceKnownPlaceholders,
  sanitizeLeadText
} from './lead-utils.js';

export {
  createSelfServiceSchemaPayloadWorker,
  detectCategoryWorker,
  extractCompanyNameWorker
} from './lead-utils.js';

function normalizeCompanyToken(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[\s"'`·.,()[\]{}\-_/]/g, '');
}

export function articleMentionsTargetCompany(article, targetCompany) {
  const token = normalizeCompanyToken(targetCompany);
  if (!token) return false;
  const haystack = normalizeCompanyToken([
    article && article.title,
    article && article.query,
    article && article._body
  ].filter(Boolean).join(' '));
  return haystack.includes(token);
}

export function filterArticlesForTargetCompany(articles, targetCompany) {
  const filtered = (Array.isArray(articles) ? articles : []).filter((article) => articleMentionsTargetCompany(article, targetCompany));
  return filtered.length > 0 ? filtered : (Array.isArray(articles) ? articles : []);
}

export function generateQuickLeadsWorker(articles, profile, targetCompany = '') {
  const configs = profile.categoryConfig && typeof profile.categoryConfig === 'object' ? profile.categoryConfig : {};
  const fallbackCategory = Object.keys(configs)[0];
  const companySeen = new Set();
  const leads = [];
  const normalizedTargetCompany = normalizeCompanyNameWorker(targetCompany || profile.name || '', profile.name || '');

  for (const article of articles) {
    if (normalizedTargetCompany && !articleMentionsTargetCompany(article, normalizedTargetCompany)) continue;
    const category = detectCategoryWorker(article, profile) || fallbackCategory;
    const cfg = configs[category] || configs[fallbackCategory];
    if (!cfg) continue;

    const rawCompany = extractCompanyNameWorker(article.title);
    const company = normalizedTargetCompany || normalizeCompanyNameWorker(rawCompany, article.title);
    const companyKey = company.toLowerCase();
    if (companySeen.has(companyKey)) continue;
    companySeen.add(companyKey);

    const product = chooseProductForArticle(profile, article, category) || sanitizeLeadText(cfg.product, chooseFallbackProduct(profile));
    const confidence = normalizeConfidence('', article);
    const score = computeScoreWorker(article, profile, confidence, Number(cfg.score) || 70);
    const grade = gradeFromScore(score);
    if (grade === 'C') continue;

    const pitchTemplate = typeof cfg.pitch === 'string' && cfg.pitch.trim()
      ? cfg.pitch
      : '{company}에 {product}를 제안합니다.';
    const projectTitle = sanitizeLeadText(
      String(article.title || '').replace(/^\[.*?\]\s*/g, '').slice(0, 140),
      '프로젝트 관련 신규 동향 포착'
    );
    const eventType = normalizeEventType('', projectTitle);
    const expectedRoi = normalizeExpectedRoiText(
      replaceKnownPlaceholders(cfg.roi || '', company, product),
      '근거 없음 - 공개 기사 기준 정량 데이터가 부족해 투자회수 기간을 산정할 수 없습니다.'
    );
    const salesPitch = normalizeSalesPitchText(
      replaceKnownPlaceholders(pitchTemplate, company, product),
      { company, product, projectTitle, industry: profile.industry, article, eventType }
    );
    const trend = normalizeTrendText(cfg.policy || '', { industry: profile.industry, eventType, article });
    const sources = normalizeSourceList([], article);
    const generationMode = 'heuristic';
    const assumptions = ['규칙 기반 빠른 분석이며 LLM 정밀 검토 전 초안입니다.'];
    const dataGaps = normalizeDataGapsList([
      'LLM 정밀 분석 미완료',
      article && article._hasBody ? '' : '기사 본문 미확보',
      '고객 내부 예산/일정 미확인'
    ], {
      generationMode,
      confidence,
      sources,
      evidence: []
    });

    leads.push({
      company,
      score,
      grade,
      scoreReason: `기사 최신성/키워드 적합도 기반 ${confidence} 신뢰도 점수`,
      project_title: projectTitle,
      recommended_product: product,
      expected_roi: expectedRoi,
      sales_pitch: salesPitch,
      trend,
      sources,
      summary: projectTitle,
      product,
      roi: expectedRoi,
      salesPitch,
      globalContext: trend,
      generationMode,
      verificationStatus: 'needs_review',
      confidence,
      confidenceReason: confidence === 'MEDIUM'
        ? '규칙 기반 fallback: 본문 미확보이나 기사 제목에 정량 신호가 포함되어 신뢰도 보통으로 판정'
        : '규칙 기반 fallback: 본문 미확보 및 제목 정보가 제한적이어서 신뢰도 낮음으로 판정',
      assumptions,
      dataGaps,
      eventType
    });

    if (leads.length >= 5) break;
  }

  return leads;
}

export async function analyzeLeadsWorker(articles, profile, env, targetCompany = '') {
  if (articles.length === 0) return [];

  const payload = await requestLeadPayload(buildLeadAnalysisPrompt(profile, articles), env);
  if (!isValidLeadPayloadSchema(payload)) {
    throw new Error('SELF_SERVICE_SCHEMA_VALIDATION_FAILED');
  }

  const rawLeads = Array.isArray(payload.leads) ? payload.leads : [];
  const articleByUrl = new Map(articles.filter(article => article && article.link).map(article => [article.link, article]));
  const companySeen = new Set();
  const normalizedLeads = [];
  const normalizedTargetCompany = normalizeCompanyNameWorker(targetCompany || profile.name || '', profile.name || '');

  rawLeads.forEach((lead, index) => {
    if (!lead || typeof lead !== 'object') return;

    const preSources = normalizeSourceList(lead.sources, articles[index]);
    const fallbackTitle = sanitizeLeadText(
      getLeadField(lead, ['project_title', 'summary', 'company']) || '',
      (articles[index] && articles[index].title) || ''
    );
    const inferredCompany = normalizeCompanyNameWorker(getLeadField(lead, ['company']) || '', fallbackTitle);
    const company = normalizedTargetCompany || inferredCompany;
    if (!isValidCompanyNameWorker(company)) return;
    const companyKey = company.toLowerCase();
    if (companySeen.has(companyKey)) return;

    const article = findArticleForLead(lead, preSources, articles, articleByUrl, index, company);
    if (normalizedTargetCompany && !articleMentionsTargetCompany(article, normalizedTargetCompany) && inferredCompany !== normalizedTargetCompany) {
      return;
    }
    const confidence = normalizeConfidence(getLeadField(lead, ['confidence']), article);
    const detectedCategory = detectCategoryWorker(article || articles[index] || {}, profile);
    const fallbackProduct = chooseProductForArticle(profile, article || articles[index] || {}, detectedCategory);
    const modelProduct = sanitizeLeadText(
      replaceKnownPlaceholders(getLeadField(lead, ['recommended_product', 'product']) || '', company, fallbackProduct),
      fallbackProduct
    );
    const product = isKnownProfileProduct(profile, modelProduct) ? modelProduct : fallbackProduct;
    const summary = sanitizeLeadText(
      replaceKnownPlaceholders(getLeadField(lead, ['project_title', 'summary']) || '', company, product),
      sanitizeLeadText((article && article.title) || '', '프로젝트 관련 신규 동향 포착')
    );
    const roi = normalizeExpectedRoiText(
      replaceKnownPlaceholders(getLeadField(lead, ['expected_roi', 'roi']) || '', company, product),
      '근거 없음 - 공개 기사 기준 정량 데이터가 부족해 투자회수 기간을 산정할 수 없습니다.'
    );
    const eventType = normalizeEventType(getLeadField(lead, ['eventType', 'event_type']), `${summary} ${(article && article.title) || ''}`);
    const salesPitch = normalizeSalesPitchText(
      replaceKnownPlaceholders(getLeadField(lead, ['sales_pitch', 'salesPitch']) || '', company, product),
      { company, product, projectTitle: summary, industry: profile.industry, article, eventType }
    );
    const globalContext = normalizeTrendText(
      getLeadField(lead, ['trend', 'globalContext', 'global_context']) || '',
      { industry: profile.industry, eventType, article }
    );

    const score = computeScoreWorker(article, profile, confidence, Number(getLeadField(lead, ['score'])) || 70);
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
    const generationMode = 'llm';
    const assumptions = normalizeAssumptionsList(lead.assumptions, roi);
    const verificationStatus = normalizeVerificationStatus(getLeadField(lead, ['verificationStatus', 'verification_status']), {
      generationMode,
      confidence,
      sources,
      evidence
    });
    const dataGaps = normalizeDataGapsList(getLeadField(lead, ['dataGaps', 'data_gaps']) || [], {
      generationMode,
      confidence,
      sources,
      evidence
    });

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
      scoreReason: sanitizeLeadText(
        getLeadField(lead, ['scoreReason', 'score_reason']) || '',
        `기사 최신성/키워드 적합도 기반 ${confidence} 신뢰도 점수`
      ),
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
      generationMode,
      verificationStatus,
      confidence,
      confidenceReason: sanitizeLeadText(
        getLeadField(lead, ['confidenceReason', 'confidence_reason']) || '',
        confidence === 'HIGH'
          ? '기사 본문을 확보하여 신뢰도 높음으로 판정'
          : confidence === 'MEDIUM'
            ? '본문은 없지만 제목에 정량 신호가 있어 신뢰도 보통으로 판정'
            : '본문 미확보 및 제목 정보 제한으로 신뢰도 낮음으로 판정'
      ),
      assumptions,
      dataGaps,
      eventType
    });
  });

  return normalizedLeads.slice(0, 5);
}
