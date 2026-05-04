import { createHash } from 'node:crypto';

export const VALID_TRANSITIONS = {
  NEW: ['CONTACTED'],
  CONTACTED: ['MEETING'],
  MEETING: ['PROPOSAL'],
  PROPOSAL: ['NEGOTIATION'],
  NEGOTIATION: ['WON', 'LOST'],
  LOST: ['NEW'],
  WON: []
};

const TRACKING_PARAM_RE = /^(utm_|fbclid$|gclid$|mc_|ocid$|cmp$|cmpid$|ref$|ref_src$|guccounter$|igshid$|yclid$)/i;

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function toFiniteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stringOrEmpty(value) {
  return typeof value === 'string' ? value : '';
}

function normalizeGenerationMode(value, fallback = 'llm') {
  const mode = sanitizeLeadText(value, '').toLowerCase();
  if (mode === 'llm' || mode === 'heuristic' || mode === 'demo') return mode;
  return fallback;
}

function normalizeVerificationStatus(value, generationMode = 'llm') {
  const status = sanitizeLeadText(value, '').toLowerCase();
  if (status === 'verified' || status === 'needs_review' || status === 'draft' || status === 'unverified') {
    return status;
  }
  if (generationMode === 'demo') return 'draft';
  if (generationMode === 'heuristic') return 'needs_review';
  return 'needs_review';
}

function normalizeStringArray(value) {
  return (Array.isArray(value) ? value : [])
    .map((item) => sanitizeLeadText(item, ''))
    .filter(Boolean);
}

export function sanitizeLeadText(value, fallback = '') {
  const cleaned = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned) return cleaned;
  return String(fallback ?? '').trim();
}

function slugify(value, fallback = 'lead') {
  const slug = sanitizeLeadText(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
  return slug || fallback;
}

function normalizeIdentityText(value = '') {
  return sanitizeLeadText(value, '')
    .toLowerCase()
    .replace(/["'`]/g, '')
    .slice(0, 180);
}

function normalizeSourceTitle(title = '') {
  return normalizeIdentityText(title).replace(/^["']+|["']+$/g, '');
}

export function isSearchOrAggregatorUrl(url = '') {
  try {
    const parsed = new URL(String(url || ''));
    const host = parsed.hostname.toLowerCase();
    return host === 'news.google.com'
      || host === 'search.naver.com'
      || host === 'search.daum.net'
      || ((host === 'google.com' || host === 'www.google.com' || host === 'bing.com' || host === 'www.bing.com') && parsed.pathname === '/search');
  } catch {
    return false;
  }
}

export function canonicalizeSourceUrl(url = '') {
  try {
    const parsed = new URL(String(url || ''));
    if (!/^https?:$/i.test(parsed.protocol)) return '';
    if (isSearchOrAggregatorUrl(url)) return '';

    parsed.hash = '';
    const keptParams = [...parsed.searchParams.entries()]
      .filter(([key]) => !TRACKING_PARAM_RE.test(key))
      .sort(([aKey, aValue], [bKey, bValue]) => {
        if (aKey === bKey) return aValue.localeCompare(bValue);
        return aKey.localeCompare(bKey);
      });

    parsed.search = '';
    for (const [key, value] of keptParams) {
      parsed.searchParams.append(key, value);
    }

    const pathname = (parsed.pathname || '/').replace(/\/+$/g, '') || '/';
    const search = parsed.searchParams.toString();
    return `${parsed.protocol.toLowerCase()}//${parsed.hostname.toLowerCase()}${pathname}${search ? `?${search}` : ''}`;
  } catch {
    return '';
  }
}

function buildSourceIdentityKey(source = {}) {
  const titleKey = normalizeSourceTitle(source.title);
  const canonicalUrl = canonicalizeSourceUrl(source.url);
  if (canonicalUrl) return `url:${canonicalUrl}`;
  if (titleKey) return `title:${titleKey}`;
  return '';
}

function normalizeSourceEntry(source) {
  if (!source || typeof source !== 'object') return null;
  const title = sanitizeLeadText(source.title, '');
  const rawUrl = sanitizeLeadText(source.url, '');
  const canonicalUrl = canonicalizeSourceUrl(rawUrl);
  const key = buildSourceIdentityKey({ title, url: rawUrl });
  if (!key) return null;
  return {
    title,
    url: canonicalUrl || rawUrl,
    key,
  };
}

export function normalizeLeadSources(sources = []) {
  const seen = new Set();
  const normalized = [];

  for (const source of Array.isArray(sources) ? sources : []) {
    const entry = normalizeSourceEntry(source);
    if (!entry || seen.has(entry.key)) continue;
    seen.add(entry.key);
    normalized.push(entry);
  }

  normalized.sort((a, b) => {
    const aRank = a.key.startsWith('url:') ? 0 : 1;
    const bRank = b.key.startsWith('url:') ? 0 : 1;
    if (aRank !== bRank) return aRank - bRank;
    if (a.key !== b.key) return a.key.localeCompare(b.key);
    if (a.title !== b.title) return a.title.localeCompare(b.title);
    return a.url.localeCompare(b.url);
  });

  return normalized.map(({ title, url }) => ({ title, url }));
}

function selectIdentityAnchor(lead = {}) {
  const normalizedSources = normalizeLeadSources(lead.sources);
  if (normalizedSources.length > 0) {
    return buildSourceIdentityKey(normalizedSources[0]);
  }

  const summary = normalizeIdentityText(lead.summary || lead.projectTitle || '');
  if (summary) return `summary:${summary}`;

  const eventType = normalizeIdentityText(lead.eventType || lead.event_type || '');
  if (eventType) return `event:${eventType}`;

  return 'fallback:lead';
}

export function buildLeadIdentityKey(lead = {}, { profileId = '' } = {}) {
  const payload = JSON.stringify({
    profile: normalizeIdentityText(profileId),
    company: normalizeIdentityText(lead.company || 'lead') || 'lead',
    anchor: selectIdentityAnchor(lead),
    eventType: normalizeIdentityText(lead.eventType || lead.event_type || ''),
  });
  return createHash('sha1').update(payload).digest('hex');
}

export function computeStableLeadId(lead = {}, { profileId = '', identityKey = '' } = {}) {
  const stableIdentityKey = sanitizeLeadText(identityKey || lead.identityKey || lead.identity_key, '')
    || buildLeadIdentityKey(lead, { profileId });
  return `${slugify(lead.company || 'lead')}_${stableIdentityKey.slice(0, 14)}`;
}

function normalizePersistedLead(lead = {}, { profileId = '', source = '', rowId = '' } = {}) {
  const normalizedSources = normalizeLeadSources(lead.sources);
  const identityLead = { ...lead, sources: normalizedSources };
  const stableIdentityKey = sanitizeLeadText(lead.identityKey || lead.identity_key, '')
    || buildLeadIdentityKey(identityLead, { profileId });

  return {
    id: sanitizeLeadText(rowId || lead.id, '')
      || computeStableLeadId(identityLead, { profileId, identityKey: stableIdentityKey }),
    identityKey: stableIdentityKey,
    profileId: sanitizeLeadText(profileId || lead.profileId || lead.profile_id, '') || 'self-service',
    source: sanitizeLeadText(source || lead.source, '') || 'managed',
    status: sanitizeLeadText(lead.status, '') || 'NEW',
    company: sanitizeLeadText(lead.company, ''),
    summary: sanitizeLeadText(lead.summary, ''),
    product: sanitizeLeadText(lead.product, ''),
    score: toFiniteNumber(lead.score, 0),
    grade: sanitizeLeadText(lead.grade, '') || 'B',
    roi: stringOrEmpty(lead.roi),
    salesPitch: stringOrEmpty(lead.salesPitch ?? lead.sales_pitch),
    globalContext: stringOrEmpty(lead.globalContext ?? lead.global_context),
    sources: normalizedSources,
    notes: stringOrEmpty(lead.notes),
    enriched: toFiniteNumber(lead.enriched, 0),
    articleBody: stringOrEmpty(lead.articleBody ?? lead.article_body),
    actionItems: Array.isArray(lead.actionItems ?? lead.action_items) ? (lead.actionItems ?? lead.action_items) : [],
    keyFigures: Array.isArray(lead.keyFigures ?? lead.key_figures) ? (lead.keyFigures ?? lead.key_figures) : [],
    painPoints: Array.isArray(lead.painPoints ?? lead.pain_points) ? (lead.painPoints ?? lead.pain_points) : [],
    meddic: lead.meddic && typeof lead.meddic === 'object' && !Array.isArray(lead.meddic) ? lead.meddic : {},
    competitive: lead.competitive && typeof lead.competitive === 'object' && !Array.isArray(lead.competitive) ? lead.competitive : {},
    buyingSignals: Array.isArray(lead.buyingSignals ?? lead.buying_signals) ? (lead.buyingSignals ?? lead.buying_signals) : [],
    scoreReason: stringOrEmpty(lead.scoreReason ?? lead.score_reason),
    urgency: stringOrEmpty(lead.urgency),
    urgencyReason: stringOrEmpty(lead.urgencyReason ?? lead.urgency_reason),
    buyerRole: stringOrEmpty(lead.buyerRole ?? lead.buyer_role),
    evidence: Array.isArray(lead.evidence) ? lead.evidence : [],
    confidence: stringOrEmpty(lead.confidence),
    confidenceReason: stringOrEmpty(lead.confidenceReason ?? lead.confidence_reason),
    assumptions: Array.isArray(lead.assumptions) ? lead.assumptions : [],
    generationMode: normalizeGenerationMode(lead.generationMode ?? lead.generation_mode, 'llm'),
    verificationStatus: normalizeVerificationStatus(
      lead.verificationStatus ?? lead.verification_status,
      normalizeGenerationMode(lead.generationMode ?? lead.generation_mode, 'llm')
    ),
    dataGaps: normalizeStringArray(lead.dataGaps ?? lead.data_gaps),
    eventType: sanitizeLeadText(lead.eventType ?? lead.event_type, ''),
    enrichedAt: lead.enrichedAt ?? lead.enriched_at ?? null,
    followUpDate: stringOrEmpty(lead.followUpDate ?? lead.follow_up_date),
    estimatedValue: Math.max(0, Math.floor(toFiniteNumber(lead.estimatedValue ?? lead.estimated_value, 0))),
    createdAt: lead.createdAt ?? lead.created_at ?? null,
    updatedAt: lead.updatedAt ?? lead.updated_at ?? null,
  };
}

export function rowToLead(row) {
  if (!row) return null;
  const normalized = normalizePersistedLead({
    id: row.id,
    identity_key: row.identity_key,
    profile_id: row.profile_id,
    source: row.source,
    status: row.status,
    company: row.company,
    summary: row.summary,
    product: row.product,
    score: row.score,
    grade: row.grade,
    roi: row.roi,
    sales_pitch: row.sales_pitch,
    global_context: row.global_context,
    sources: parseJson(row.sources || '[]', []),
    notes: row.notes,
    enriched: row.enriched,
    article_body: row.article_body,
    action_items: parseJson(row.action_items || '[]', []),
    key_figures: parseJson(row.key_figures || '[]', []),
    pain_points: parseJson(row.pain_points || '[]', []),
    meddic: parseJson(row.meddic || '{}', {}),
    competitive: parseJson(row.competitive || '{}', {}),
    buying_signals: parseJson(row.buying_signals || '[]', []),
    score_reason: row.score_reason,
    urgency: row.urgency,
    urgency_reason: row.urgency_reason,
    buyer_role: row.buyer_role,
    evidence: parseJson(row.evidence || '[]', []),
    confidence: row.confidence,
    confidence_reason: row.confidence_reason,
    assumptions: parseJson(row.assumptions || '[]', []),
    generation_mode: row.generation_mode,
    verification_status: row.verification_status,
    data_gaps: parseJson(row.data_gaps || '[]', []),
    event_type: row.event_type,
    enriched_at: row.enriched_at,
    follow_up_date: row.follow_up_date,
    estimated_value: row.estimated_value,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }, {
    profileId: row.profile_id,
    source: row.source,
    rowId: row.id,
  });

  return {
    id: normalized.id,
    identityKey: normalized.identityKey,
    profileId: normalized.profileId,
    source: normalized.source,
    status: normalized.status,
    company: normalized.company,
    summary: normalized.summary,
    product: normalized.product,
    score: normalized.score,
    grade: normalized.grade,
    roi: normalized.roi,
    salesPitch: normalized.salesPitch,
    globalContext: normalized.globalContext,
    sources: normalized.sources,
    notes: normalized.notes,
    enriched: normalized.enriched,
    articleBody: normalized.articleBody,
    actionItems: normalized.actionItems,
    keyFigures: normalized.keyFigures,
    painPoints: normalized.painPoints,
    meddic: normalized.meddic,
    competitive: normalized.competitive,
    buyingSignals: normalized.buyingSignals,
    scoreReason: normalized.scoreReason,
    urgency: normalized.urgency,
    urgencyReason: normalized.urgencyReason,
    buyerRole: normalized.buyerRole,
    evidence: normalized.evidence,
    confidence: normalized.confidence,
    confidenceReason: normalized.confidenceReason,
    assumptions: normalized.assumptions,
    generationMode: normalized.generationMode,
    verificationStatus: normalized.verificationStatus,
    dataGaps: normalized.dataGaps,
    eventType: normalized.eventType,
    enrichedAt: normalized.enrichedAt,
    followUpDate: normalized.followUpDate,
    estimatedValue: normalized.estimatedValue,
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt
  };
}

export function leadToRow(lead, profileId, source) {
  const now = new Date().toISOString();
  const normalized = normalizePersistedLead(lead, { profileId, source });
  return {
    id: normalized.id,
    identity_key: normalized.identityKey,
    profile_id: normalized.profileId,
    source: normalized.source,
    status: normalized.status,
    company: normalized.company,
    summary: normalized.summary,
    product: normalized.product,
    score: normalized.score,
    grade: normalized.grade,
    roi: normalized.roi,
    sales_pitch: normalized.salesPitch,
    global_context: normalized.globalContext,
    sources: JSON.stringify(normalized.sources),
    notes: normalized.notes,
    score_reason: normalized.scoreReason,
    urgency: normalized.urgency,
    urgency_reason: normalized.urgencyReason,
    buyer_role: normalized.buyerRole,
    evidence: JSON.stringify(normalized.evidence),
    confidence: normalized.confidence,
    confidence_reason: normalized.confidenceReason,
    assumptions: JSON.stringify(normalized.assumptions),
    generation_mode: normalized.generationMode,
    verification_status: normalized.verificationStatus,
    data_gaps: JSON.stringify(normalized.dataGaps),
    event_type: normalized.eventType,
    created_at: normalized.createdAt || now,
    updated_at: normalized.updatedAt || now
  };
}
