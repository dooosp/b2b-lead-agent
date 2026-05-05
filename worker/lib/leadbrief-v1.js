export const REVIEW_STATUSES = Object.freeze(['NEW', 'NEEDS_REVIEW', 'APPROVED', 'REJECTED', 'DEFERRED']);

const REVIEW_STATUS_ALIASES = Object.freeze({
  new: 'NEW',
  needs_review: 'NEEDS_REVIEW',
  needsreview: 'NEEDS_REVIEW',
  review_needed: 'NEEDS_REVIEW',
  reviewneeded: 'NEEDS_REVIEW',
  approved: 'APPROVED',
  rejected: 'REJECTED',
  deferred: 'DEFERRED'
});

function cleanText(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function pickText(record, keys) {
  for (const key of keys) {
    const value = cleanText(record && record[key]);
    if (value) return value;
  }
  return '';
}

function addUnique(items, value) {
  if (value && !items.includes(value)) items.push(value);
}

function normalizeStringArray(value) {
  return (Array.isArray(value) ? value : [])
    .map((item) => cleanText(item))
    .filter(Boolean);
}

function normalizeConfidence(value) {
  const confidence = cleanText(value).toUpperCase();
  return confidence === 'HIGH' || confidence === 'MEDIUM' || confidence === 'LOW'
    ? confidence
    : 'LOW';
}

function normalizeGenerationMode(value) {
  const mode = cleanText(value).toLowerCase();
  return mode === 'llm' || mode === 'heuristic' || mode === 'demo' || mode === 'unavailable'
    ? mode
    : 'llm';
}

function normalizeSources(sources) {
  return (Array.isArray(sources) ? sources : [])
    .map((source) => {
      if (!source || typeof source !== 'object') return null;
      const title = cleanText(source.title);
      const url = cleanText(source.url);
      if (!title || !url) return null;
      return { ...source, title, url };
    })
    .filter(Boolean);
}

function normalizeEvidence(evidence) {
  return (Array.isArray(evidence) ? evidence : [])
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const field = cleanText(item.field);
      const quote = cleanText(item.quote);
      const sourceUrl = cleanText(item.sourceUrl || item.source_url);
      if (!quote) return null;
      return {
        ...item,
        ...(field ? { field } : {}),
        quote,
        ...(sourceUrl ? { sourceUrl } : {})
      };
    })
    .filter(Boolean);
}

export function normalizeReviewStatus(value, { fallback = 'NEEDS_REVIEW', allowApproved = true } = {}) {
  const raw = cleanText(value);
  if (!raw) return fallback;

  const upper = raw.toUpperCase();
  const normalized = REVIEW_STATUSES.includes(upper)
    ? upper
    : REVIEW_STATUS_ALIASES[raw.toLowerCase().replace(/[\s-]+/g, '_')];

  if (!normalized) return fallback;
  if (!allowApproved && normalized === 'APPROVED') return fallback;
  return normalized;
}

export function isValidReviewStatus(value) {
  return REVIEW_STATUSES.includes(normalizeReviewStatus(value, { fallback: '' }));
}

export function toLeadBriefV1(lead = {}) {
  const record = lead && typeof lead === 'object' ? { ...lead } : {};
  const sources = normalizeSources(record.sources);
  const evidence = normalizeEvidence(record.evidence);
  const confidence = normalizeConfidence(record.confidence);
  const generationMode = normalizeGenerationMode(record.generationMode ?? record.generation_mode);
  const assumptions = normalizeStringArray(record.assumptions);
  const dataGaps = normalizeStringArray(record.dataGaps ?? record.data_gaps);
  const signal = pickText(record, ['signal', 'summary', 'project_title', 'projectTitle', 'project']);
  const whyNow = pickText(record, ['whyNow', 'why_now', 'urgencyReason', 'urgency_reason', 'globalContext', 'global_context', 'trend']);
  const recommendedMessage = pickText(record, ['recommendedMessage', 'recommended_message', 'salesPitch', 'sales_pitch', 'pitch']);

  if (!cleanText(record.confidence)) addUnique(dataGaps, 'Confidence was not provided by the lead generator');
  if (generationMode === 'heuristic') addUnique(dataGaps, 'LLM lead qualification not completed');
  if (generationMode === 'demo') addUnique(dataGaps, 'Synthetic demo lead, not generated from current market evidence');
  if (confidence === 'LOW') addUnique(dataGaps, 'Low-confidence public signal');
  if (sources.length === 0) addUnique(dataGaps, 'Published source evidence missing');
  if (evidence.length === 0) addUnique(dataGaps, 'Direct evidence quote missing');
  if (!whyNow) addUnique(dataGaps, 'Why-now rationale missing');
  if (!recommendedMessage) addUnique(dataGaps, 'Recommended first message missing');

  return {
    ...record,
    company: cleanText(record.company),
    signal,
    sources,
    whyNow,
    recommendedMessage,
    confidence,
    assumptions,
    dataGaps,
    reviewStatus: normalizeReviewStatus(record.reviewStatus ?? record.review_status),
    generationMode,
    verificationStatus: cleanText(record.verificationStatus ?? record.verification_status),
    evidence
  };
}
