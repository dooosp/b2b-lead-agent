// Public-field projection, source/trust validation and history merging; no I/O.
const { computeStableLeadId } = require('../../lead-identity');
const {
  PUBLICATION_LEAD_ID_MAX_BYTES, normalizeSnapshotText, isValidIsoTimestamp, stableJsonValue,
} = require('./contract');
const DEFAULT_SOURCE_FRESHNESS_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;
const UNBOUND_EVIDENCE_GAP = 'Evidence is not bound to a published source';
const SOURCE_FRESHNESS_GAP = 'Published source freshness missing, invalid, future-dated, or stale';
const FRESH_BOUND_EVIDENCE_GAP = 'Verified evidence is not bound to a fresh published source';
const SALES_PIPELINE_STATUSES = new Set(['NEW', 'CONTACTED', 'MEETING', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST']);
const REVIEW_STATUSES = new Set(['NEW', 'NEEDS_REVIEW', 'APPROVED', 'REJECTED', 'DEFERRED']);
const VERIFICATION_STATUSES = new Set(['verified', 'needs_review', 'draft', 'unverified']);

function isWellFormedUnicode(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function assertPublishedLeadId(value, createError = createPublicationValidationError) {
  const normalized = normalizeSnapshotText(value);
  if (
    typeof value !== 'string'
    || !normalized
    || normalized === '.'
    || normalized === '..'
    || !isWellFormedUnicode(value)
    || /[\\/?#%]/u.test(normalized)
    || /[\u0000-\u001f\u007f]/u.test(value)
    || Buffer.byteLength(normalized, 'utf8') > PUBLICATION_LEAD_ID_MAX_BYTES
  ) {
    throw createError();
  }
  return normalized;
}

function isPrivatePublicationHostname(hostname) {
  const normalized = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (!normalized) return true;
  if (normalized === 'localhost' || normalized.endsWith('.localhost') || normalized.endsWith('.local') || normalized.endsWith('.internal')) {
    return true;
  }
  const isIpv6Literal = normalized.includes(':');
  if (
    normalized === '::1'
    || (isIpv6Literal && (
      normalized.startsWith('fe80:')
      || normalized.startsWith('fc')
      || normalized.startsWith('fd')
    ))
  ) {
    return true;
  }
  const octets = normalized.split('.').map(Number);
  if (octets.length === 4 && octets.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)) {
    return octets[0] === 10
      || octets[0] === 127
      || (octets[0] === 169 && octets[1] === 254)
      || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
      || (octets[0] === 192 && octets[1] === 168)
      || octets[0] === 0;
  }
  return false;
}

function hasSecretQueryParameter(parsedUrl) {
  for (const key of parsedUrl.searchParams.keys()) {
    if (/^(?:access[_-]?token|api[_-]?key|auth|authorization|credential|password|secret|session|signature|token|x-amz-)/i.test(key)) {
      return true;
    }
  }
  return false;
}

function normalizeSnapshotUrl(value) {
  const url = normalizeSnapshotText(value);
  if (!url) return '';

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    if (parsed.username || parsed.password) return '';
    if (isPrivatePublicationHostname(parsed.hostname) || hasSecretQueryParameter(parsed)) return '';
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return '';
  }
}

function normalizePublicationSource(source = {}) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return null;
  const title = normalizeSnapshotText(source.title);
  const url = normalizeSnapshotUrl(source.url);
  if (!title || !url) return null;

  return {
    sourceId: normalizeSnapshotText(source.sourceId),
    title,
    url,
    source: normalizeSnapshotText(source.source),
    query: normalizeSnapshotText(source.query),
    publishedAt: normalizeSnapshotText(source.publishedAt),
    originUrl: normalizeSnapshotUrl(source.originUrl),
    resolution: normalizeSnapshotText(source.resolution),
    contentAvailable: Boolean(source.contentAvailable),
  };
}

function normalizePublicationSources(sources) {
  return (Array.isArray(sources) ? sources : [])
    .map((source) => normalizePublicationSource(source))
    .filter(Boolean);
}

function normalizePublicationEvidence(evidence, sources) {
  const boundUrls = new Set();
  for (const source of Array.isArray(sources) ? sources : []) {
    const url = normalizeSnapshotUrl(source && source.url);
    const originUrl = normalizeSnapshotUrl(source && source.originUrl);
    if (url) boundUrls.add(url);
    if (originUrl) boundUrls.add(originUrl);
  }

  const seen = new Set();
  const normalized = [];
  for (const item of Array.isArray(evidence) ? evidence : []) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const field = normalizeSnapshotText(item.field);
    const quote = normalizeSnapshotText(item.quote);
    const sourceUrl = normalizeSnapshotUrl(item.sourceUrl || item.source_url);
    if (!field || !quote || !sourceUrl || !boundUrls.has(sourceUrl)) continue;
    const key = `${field}|${quote}|${sourceUrl}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push({ field, quote, sourceUrl });
  }
  return normalized;
}

function normalizeSnapshotStringList(values) {
  return (Array.isArray(values) ? values : [])
    .map((value) => normalizeSnapshotText(value))
    .filter(Boolean);
}

function addUniqueSnapshotGap(gaps, value) {
  if (value && !gaps.includes(value)) gaps.push(value);
}

function normalizePublicationConfidence(value) {
  const confidence = normalizeSnapshotText(value).toUpperCase();
  return confidence === 'HIGH' || confidence === 'MEDIUM' || confidence === 'LOW' ? confidence : 'LOW';
}

function normalizeFreshnessOptions({ now = new Date().toISOString(), staleAfterDays } = {}) {
  const normalizedNow = now instanceof Date ? now.toISOString() : normalizeSnapshotText(now);
  return {
    now: normalizedNow || new Date().toISOString(),
    staleAfterDays: Number.isFinite(staleAfterDays) && staleAfterDays >= 0
      ? staleAfterDays
      : DEFAULT_SOURCE_FRESHNESS_DAYS,
  };
}

function isFreshPublicationSource(source, { now, staleAfterDays } = normalizeFreshnessOptions()) {
  const nowTime = Date.parse(now);
  const publishedTime = Date.parse(normalizeSnapshotText(source && source.publishedAt));
  if (!Number.isFinite(nowTime) || !Number.isFinite(publishedTime)) return false;
  const ageMs = nowTime - publishedTime;
  return ageMs >= 0 && ageMs <= staleAfterDays * DAY_MS;
}

function isTraceBoundPublicationSource(source) {
  const sourceId = normalizeSnapshotText(source && source.sourceId);
  const resolution = normalizeSnapshotText(source && source.resolution).toLowerCase();
  return /^A\d+$/.test(sourceId) && resolution !== 'unverified';
}

function hasFreshBoundPublicationEvidence(sources, evidence, freshnessOptions) {
  const freshUrls = new Set();
  for (const source of Array.isArray(sources) ? sources : []) {
    if (!isTraceBoundPublicationSource(source) || !isFreshPublicationSource(source, freshnessOptions)) continue;
    const url = normalizeSnapshotUrl(source && source.url);
    const originUrl = normalizeSnapshotUrl(source && source.originUrl);
    if (url) freshUrls.add(url);
    if (originUrl) freshUrls.add(originUrl);
  }
  return Array.isArray(evidence) && evidence.some((item) => (
    normalizeSnapshotText(item && item.field)
    && normalizeSnapshotText(item && item.quote)
    && freshUrls.has(normalizeSnapshotUrl(item && item.sourceUrl))
  ));
}

function buildPublicationLeadBriefFields(lead = {}, {
  profileId = '',
  sources = [],
  evidence = [],
  dataGaps = [],
} = {}) {
  const confidence = normalizePublicationConfidence(lead.confidence);
  const signal = normalizeSnapshotText(lead.signal || lead.summary || lead.project_title || lead.projectTitle);
  const whyNow = normalizeSnapshotText(lead.whyNow || lead.why_now || lead.urgencyReason || lead.urgency_reason || lead.globalContext || lead.global_context || lead.trend);
  const recommendedMessage = normalizeSnapshotText(lead.recommendedMessage || lead.recommended_message || lead.salesPitch || lead.sales_pitch || lead.pitch);
  const assumptions = normalizeSnapshotStringList(lead.assumptions);
  const gaps = normalizeSnapshotStringList(dataGaps.length > 0 ? dataGaps : lead.dataGaps);

  if (!normalizeSnapshotText(lead.confidence)) addUniqueSnapshotGap(gaps, 'Confidence was not provided by the lead generator');
  if (confidence === 'LOW') addUniqueSnapshotGap(gaps, 'Low-confidence public signal');
  if (!Array.isArray(sources) || sources.length === 0) addUniqueSnapshotGap(gaps, 'Published source evidence missing');
  if (!evidence.some((item) => normalizeSnapshotText(item && item.quote))) addUniqueSnapshotGap(gaps, 'Direct evidence quote missing');
  if (!whyNow) addUniqueSnapshotGap(gaps, 'Why-now rationale missing');
  if (!recommendedMessage) addUniqueSnapshotGap(gaps, 'Recommended first message missing');

  return {
    profileId: normalizeSnapshotText(profileId),
    signal,
    whyNow,
    recommendedMessage,
    reviewStatus: 'NEEDS_REVIEW',
    confidence,
    assumptions,
    dataGaps: gaps,
  };
}

function normalizeGenerationMode(value, fallback = 'llm') {
  const mode = normalizeSnapshotText(value).toLowerCase();
  if (mode === 'llm' || mode === 'heuristic' || mode === 'demo') return mode;
  return fallback;
}

function normalizeVerificationStatus(value, {
  generationMode,
  confidence,
  sources,
  evidence,
  freshnessOptions,
} = {}) {
  const status = normalizeSnapshotText(value).toLowerCase();
  if (generationMode === 'demo') return 'draft';
  if (generationMode === 'heuristic') return 'needs_review';
  const normalizedConfidence = normalizeSnapshotText(confidence).toUpperCase();
  if (status === 'verified') {
    return hasFreshBoundPublicationEvidence(sources, evidence, freshnessOptions)
      && (normalizedConfidence === 'HIGH' || normalizedConfidence === 'MEDIUM')
      ? 'verified'
      : 'needs_review';
  }
  if (status === 'draft' || status === 'unverified') return status;
  return 'needs_review';
}

function normalizePublicationTrust(lead = {}, {
  sources = [],
  evidence = [],
  now = new Date().toISOString(),
  staleAfterDays,
  evidenceInputCount = 0,
} = {}) {
  const generationMode = normalizeGenerationMode(lead.generationMode);
  const suppliedConfidence = normalizeSnapshotText(lead.confidence).toUpperCase();
  const confidence = normalizePublicationConfidence(lead.confidence);
  const assumptions = normalizeSnapshotStringList(lead.assumptions);
  const dataGaps = normalizeSnapshotStringList(lead.dataGaps);
  const freshnessOptions = normalizeFreshnessOptions({ now, staleAfterDays });
  const addGap = (value) => {
    if (value && !dataGaps.includes(value)) dataGaps.push(value);
  };

  if (generationMode === 'demo') {
    throw new Error('Refusing to publish demo leads as canonical latest leads.');
  }
  if (generationMode === 'heuristic') {
    addGap('LLM lead qualification not completed');
  }
  if (!suppliedConfidence || !['HIGH', 'MEDIUM', 'LOW'].includes(suppliedConfidence)) {
    addGap('Confidence was not provided by the lead generator');
  }
  if (sources.length === 0) addGap('Published source evidence missing');
  if (evidence.length === 0) {
    addGap('Direct evidence quote missing');
  }
  if (confidence === 'LOW') addGap('Low-confidence public signal');
  if (evidenceInputCount > evidence.length) addGap(UNBOUND_EVIDENCE_GAP);
  const hasFreshTraceSource = sources.some((source) => (
    isTraceBoundPublicationSource(source) && isFreshPublicationSource(source, freshnessOptions)
  ));
  if (!hasFreshTraceSource) addGap(SOURCE_FRESHNESS_GAP);
  if (evidence.length > 0 && !hasFreshBoundPublicationEvidence(sources, evidence, freshnessOptions)) {
    addGap(FRESH_BOUND_EVIDENCE_GAP);
  }

  return {
    generationMode,
    verificationStatus: normalizeVerificationStatus(lead.verificationStatus, {
      generationMode,
      confidence,
      sources,
      evidence,
      freshnessOptions,
    }),
    confidence,
    confidenceReason: normalizeSnapshotText(lead.confidenceReason),
    assumptions,
    dataGaps,
  };
}

function generateLeadId(lead, { profileId = '' } = {}) {
  return computeStableLeadId(lead, { profileId });
}

const OPTIONAL_PUBLICATION_TEXT_FIELDS = Object.freeze([
  'company',
  'summary',
  'product',
  'grade',
  'roi',
  'salesPitch',
  'globalContext',
  'eventType',
]);

function createInvalidScoreError() {
  const error = new Error('Lead score must be a finite number between 0 and 100.');
  error.code = 'ERR_LEAD_SCORE_INVALID';
  return error;
}

function projectPublicationBusinessFields(lead = {}, { rejectInvalidScore = true } = {}) {
  const record = {};
  for (const field of OPTIONAL_PUBLICATION_TEXT_FIELDS) {
    if (Object.hasOwn(lead, field)) record[field] = normalizeSnapshotText(lead[field]);
  }
  if (Object.hasOwn(lead, 'score')) {
    if (!Number.isFinite(lead.score) || lead.score < 0 || lead.score > 100) {
      if (rejectInvalidScore) throw createInvalidScoreError();
    } else {
      record.score = lead.score;
    }
  }
  return record;
}

function projectLegacyHistoryRecord(lead) {
  if (!lead || typeof lead !== 'object' || Array.isArray(lead)) return null;
  const record = projectPublicationBusinessFields(lead, { rejectInvalidScore: false });

  for (const field of ['signal', 'whyNow', 'recommendedMessage', 'confidenceReason']) {
    if (Object.hasOwn(lead, field)) record[field] = normalizeSnapshotText(lead[field]);
  }
  if (Object.hasOwn(lead, 'sources')) record.sources = normalizePublicationSources(lead.sources);
  if (Object.hasOwn(lead, 'evidence')) {
    record.evidence = normalizePublicationEvidence(lead.evidence, record.sources || []);
  }
  if (Object.hasOwn(lead, 'confidence')) {
    const confidence = normalizeSnapshotText(lead.confidence).toUpperCase();
    if (confidence === 'HIGH' || confidence === 'MEDIUM' || confidence === 'LOW') record.confidence = confidence;
  }
  if (Object.hasOwn(lead, 'assumptions')) record.assumptions = normalizeSnapshotStringList(lead.assumptions);
  if (Object.hasOwn(lead, 'dataGaps')) record.dataGaps = normalizeSnapshotStringList(lead.dataGaps);

  const generationMode = normalizeSnapshotText(lead.generationMode).toLowerCase();
  if (generationMode === 'llm' || generationMode === 'heuristic') record.generationMode = generationMode;
  const verificationStatus = normalizeSnapshotText(lead.verificationStatus).toLowerCase();
  if (VERIFICATION_STATUSES.has(verificationStatus)) record.verificationStatus = verificationStatus;
  const reviewStatus = normalizeSnapshotText(lead.reviewStatus).toUpperCase();
  if (REVIEW_STATUSES.has(reviewStatus)) record.reviewStatus = reviewStatus;

  const id = normalizeSnapshotText(lead.id);
  if (id) record.id = id;
  const legacyProfileId = normalizeSnapshotText(lead.profileId);
  if (legacyProfileId) record.profileId = legacyProfileId;
  const status = normalizeSnapshotText(lead.status).toUpperCase();
  if (SALES_PIPELINE_STATUSES.has(status)) record.status = status;
  const createdAt = isValidIsoTimestamp(lead.createdAt);
  if (createdAt) record.createdAt = createdAt;
  const updatedAt = isValidIsoTimestamp(lead.updatedAt);
  if (updatedAt) record.updatedAt = updatedAt;
  return record;
}

function prepareLeadSnapshotRecords(leads, {
  now = new Date().toISOString(),
  idFactory = generateLeadId,
  profileId = '',
  staleAfterDays,
} = {}) {
  return (Array.isArray(leads) ? leads : []).map(lead => {
    const callerLead = lead && typeof lead === 'object' && !Array.isArray(lead) ? lead : {};
    const publishableLead = projectPublicationBusinessFields(callerLead);
    const sources = normalizePublicationSources(callerLead.sources);
    const evidenceInputCount = Array.isArray(callerLead.evidence) ? callerLead.evidence.length : 0;
    const evidence = normalizePublicationEvidence(callerLead.evidence, sources);
    const trust = normalizePublicationTrust(callerLead, {
      sources,
      evidence,
      now,
      staleAfterDays,
      evidenceInputCount,
    });
    const brief = buildPublicationLeadBriefFields({
      ...callerLead,
      generationMode: trust.generationMode,
      verificationStatus: trust.verificationStatus,
      confidence: trust.confidence,
      assumptions: trust.assumptions,
      dataGaps: trust.dataGaps,
    }, {
      profileId,
      sources,
      evidence,
      dataGaps: trust.dataGaps,
    });
    const systemId = assertPublishedLeadId(idFactory(callerLead, { profileId }));
    return {
      ...publishableLead,
      signal: brief.signal,
      whyNow: brief.whyNow,
      recommendedMessage: brief.recommendedMessage,
      sources,
      ...(Object.hasOwn(callerLead, 'evidence') ? { evidence } : {}),
      confidence: brief.confidence,
      confidenceReason: trust.confidenceReason,
      assumptions: brief.assumptions,
      dataGaps: brief.dataGaps,
      generationMode: trust.generationMode,
      verificationStatus: trust.verificationStatus,
      reviewStatus: brief.reviewStatus,
      id: systemId,
      profileId: brief.profileId,
      status: 'NEW',
      createdAt: now,
      updatedAt: now,
    };
  });
}

function findExistingLeadIndex(history, newLead) {
  let existingIdx = history.findIndex(h => h && h.id === newLead.id);
  if (existingIdx >= 0) return existingIdx;
  return history.findIndex(h =>
    h
    && h.company === newLead.company
    && h.summary === newLead.summary
  );
}

function mergeLeadHistory(history, newLeads, {
  now = new Date().toISOString(),
  profileId = '',
  staleAfterDays,
} = {}) {
  const nextHistory = Array.isArray(history)
    ? history.map(assertLegacyHistoryRecord)
    : [];
  const preparedLeads = prepareLeadSnapshotRecords(newLeads, { now, profileId, staleAfterDays });

  for (const newLead of preparedLeads) {
    const existingIdx = findExistingLeadIndex(nextHistory, newLead);
    if (existingIdx >= 0) {
      nextHistory[existingIdx] = {
        ...nextHistory[existingIdx],
        ...newLead,
        id: newLead.id,
        status: nextHistory[existingIdx].status || newLead.status,
        createdAt: nextHistory[existingIdx].createdAt || newLead.createdAt,
        updatedAt: now
      };
    } else {
      nextHistory.push(newLead);
    }
  }

  return nextHistory;
}

function createInvalidHistoryError() {
  const error = new Error('Lead history is invalid; publication was aborted.');
  error.code = 'ERR_LEAD_HISTORY_INVALID';
  return error;
}

function assertLegacyHistoryRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw createInvalidHistoryError();
  }
  try {
    assertCandidatePublicValuesSafe(record);
    if (Object.hasOwn(record, 'id')) {
      assertPublishedLeadId(record.id, createInvalidHistoryError);
    }
  } catch {
    throw createInvalidHistoryError();
  }
  for (const field of [
    ...OPTIONAL_PUBLICATION_TEXT_FIELDS,
    'signal', 'whyNow', 'recommendedMessage', 'confidenceReason',
    'id', 'profileId', 'status', 'createdAt', 'updatedAt',
    'generationMode', 'verificationStatus', 'reviewStatus', 'confidence',
  ]) {
    if (Object.hasOwn(record, field) && typeof record[field] !== 'string') {
      throw createInvalidHistoryError();
    }
  }
  if (
    Object.hasOwn(record, 'score')
    && (!Number.isFinite(record.score) || record.score < 0 || record.score > 100)
  ) {
    throw createInvalidHistoryError();
  }
  for (const field of ['sources', 'evidence', 'assumptions', 'dataGaps']) {
    if (Object.hasOwn(record, field) && !Array.isArray(record[field])) {
      throw createInvalidHistoryError();
    }
  }
  for (const field of ['assumptions', 'dataGaps']) {
    if (
      Object.hasOwn(record, field)
      && record[field].some((value) => typeof value !== 'string' || !value.trim())
    ) {
      throw createInvalidHistoryError();
    }
  }
  if (
    (Object.hasOwn(record, 'generationMode') && !['llm', 'heuristic'].includes(record.generationMode))
    || (Object.hasOwn(record, 'verificationStatus')
      && !VERIFICATION_STATUSES.has(record.verificationStatus))
    || (Object.hasOwn(record, 'reviewStatus') && !REVIEW_STATUSES.has(record.reviewStatus))
    || (Object.hasOwn(record, 'status') && !SALES_PIPELINE_STATUSES.has(record.status))
    || (Object.hasOwn(record, 'confidence')
      && !['HIGH', 'MEDIUM', 'LOW'].includes(record.confidence.toUpperCase()))
    || (Object.hasOwn(record, 'grade') && !['A', 'B'].includes(record.grade.toUpperCase()))
  ) {
    throw createInvalidHistoryError();
  }
  for (const field of ['createdAt', 'updatedAt']) {
    if (Object.hasOwn(record, field) && record[field] && !isValidIsoTimestamp(record[field])) {
      throw createInvalidHistoryError();
    }
  }
  const projected = projectLegacyHistoryRecord(record);
  if (!projected || !normalizeSnapshotText(projected.id) || !normalizeSnapshotText(projected.company)) {
    throw createInvalidHistoryError();
  }
  if (
    (Object.hasOwn(record, 'sources')
      && normalizePublicationSources(record.sources).length !== record.sources.length)
    || (Object.hasOwn(record, 'evidence')
      && normalizePublicationEvidence(record.evidence, projected.sources || []).length
        !== record.evidence.length)
  ) {
    throw createInvalidHistoryError();
  }
  return projected;
}

function createPublicationValidationError() {
  return Object.assign(new Error('Lead candidate did not satisfy the public publication contract.'), {
    code: 'ERR_LEAD_PUBLICATION_INVALID',
  });
}

function containsSecretShapedPublicationText(value) {
  const text = typeof value === 'string' ? value : '';
  return /(?:Authorization|Proxy-Authorization|Cookie|Set-Cookie)\s*:/i.test(text)
    || /\bBearer\s+[A-Za-z0-9._~+/-]{8,}/i.test(text)
    || /\b(?:access[_-]?token|api[_-]?key|password|secret|session|token)\s*[=:]\s*[^\s&,;]{4,}/i.test(text)
    || /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i.test(text);
}

function candidatePublicTextValues(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return [];
  const values = [];
  for (const field of [
    ...OPTIONAL_PUBLICATION_TEXT_FIELDS,
    'signal',
    'whyNow',
    'why_now',
    'recommendedMessage',
    'recommended_message',
    'confidenceReason',
    'confidence_reason',
  ]) {
    if (typeof candidate[field] === 'string') values.push(candidate[field]);
  }
  for (const field of ['assumptions', 'dataGaps']) {
    for (const value of Array.isArray(candidate[field]) ? candidate[field] : []) {
      if (typeof value === 'string') values.push(value);
    }
  }
  for (const source of Array.isArray(candidate.sources) ? candidate.sources : []) {
    if (!source || typeof source !== 'object') continue;
    for (const field of [
      'sourceId', 'title', 'url', 'source', 'query', 'publishedAt', 'originUrl', 'resolution',
    ]) {
      if (typeof source[field] === 'string') values.push(source[field]);
    }
  }
  for (const evidence of Array.isArray(candidate.evidence) ? candidate.evidence : []) {
    if (!evidence || typeof evidence !== 'object') continue;
    for (const field of ['field', 'quote', 'sourceUrl', 'source_url']) {
      if (typeof evidence[field] === 'string') values.push(evidence[field]);
    }
  }
  return values;
}

function assertCandidatePublicValuesSafe(candidate) {
  const values = candidatePublicTextValues(candidate);
  if (values.some((value) => value.length > 10_000 || containsSecretShapedPublicationText(value))) {
    throw createPublicationValidationError();
  }
  return candidate;
}

function assertPreparedPublicationLead(lead) {
  if (
    !lead
    || !normalizeSnapshotText(lead.company)
    || !normalizeSnapshotText(lead.summary)
    || !normalizeSnapshotText(lead.product)
    || !Number.isFinite(lead.score)
    || !['A', 'B'].includes(normalizeSnapshotText(lead.grade).toUpperCase())
    || !['llm', 'heuristic'].includes(normalizeSnapshotText(lead.generationMode).toLowerCase())
  ) {
    throw createPublicationValidationError();
  }
  return lead;
}

function prepareValidatedLeadRecords(leads, options = {}) {
  const validLeads = [];
  let rejectedCount = 0;
  for (const candidate of Array.isArray(leads) ? leads : []) {
    try {
      assertCandidatePublicValuesSafe(candidate);
      const [prepared] = prepareLeadSnapshotRecords([candidate], options);
      validLeads.push(assertPreparedPublicationLead(prepared));
    } catch (error) {
      if (['ERR_LEAD_SCORE_INVALID', 'ERR_LEAD_PUBLICATION_INVALID'].includes(error && error.code) || /demo/i.test(error && error.message)) {
        rejectedCount += 1;
        continue;
      }
      throw error;
    }
  }
  return { validLeads, rejectedCount };
}

function mergePreparedLeadHistory(history, preparedLeads, { now = new Date().toISOString() } = {}) {
  const nextHistory = Array.isArray(history)
    ? history.map(assertLegacyHistoryRecord)
    : [];
  for (const lead of preparedLeads) {
    const existingIdx = findExistingLeadIndex(nextHistory, lead);
    if (existingIdx >= 0) {
      nextHistory[existingIdx] = {
        ...nextHistory[existingIdx],
        ...lead,
        id: lead.id,
        status: nextHistory[existingIdx].status || lead.status,
        createdAt: nextHistory[existingIdx].createdAt || lead.createdAt,
        updatedAt: now,
      };
    } else {
      nextHistory.push(lead);
    }
  }
  return nextHistory;
}

function semanticPublicationLead(lead) {
  const semantic = { ...lead };
  delete semantic.createdAt;
  delete semantic.updatedAt;
  return stableJsonValue(semantic);
}

module.exports = {
  generateLeadId,
  normalizePublicationSources,
  prepareLeadSnapshotRecords,
  mergeLeadHistory,
  createInvalidHistoryError,
  assertLegacyHistoryRecord,
  prepareValidatedLeadRecords,
  mergePreparedLeadHistory,
  semanticPublicationLead,
};
