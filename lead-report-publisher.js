const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { computeStableLeadId } = require('./lead-identity');

const ARTIFACT_NAMES = {
  markdownCanonical: (dateStr) => `lead-report-${dateStr}.md`,
  latestCanonical: 'latest-leads.json',
  historyCanonical: 'lead-history.json',
  manifestCanonical: 'publication-manifest.json',
};

const LEGACY_PUBLICATION_SCHEMA_VERSION = 1;
const PUBLICATION_SCHEMA_VERSION = 2;
const PUBLICATION_RENDER_VERSION = 1;
const PUBLICATION_ARTIFACT_KINDS = Object.freeze(['report', 'latest', 'history']);
const PUBLICATION_LATEST_MAX_RECORDS = 90;
const PUBLICATION_HISTORY_MAX_RECORDS = 500;
const PUBLICATION_JSON_MAX_BYTES = 8_000_000;
const PUBLICATION_ENTRY_MAX_BYTES = 1_900_000;
const PUBLICATION_LEAD_ID_MAX_BYTES = 256;
const PUBLICATION_LOCK_NAME = '.publication-lock';
const PUBLICATION_LOCK_STALE_MS = 15 * 60 * 1000;

const DEFAULT_SOURCE_FRESHNESS_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;
const UNBOUND_EVIDENCE_GAP = 'Evidence is not bound to a published source';
const SOURCE_FRESHNESS_GAP = 'Published source freshness missing, invalid, future-dated, or stale';
const FRESH_BOUND_EVIDENCE_GAP = 'Verified evidence is not bound to a fresh published source';
const SALES_PIPELINE_STATUSES = new Set(['NEW', 'CONTACTED', 'MEETING', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST']);
const REVIEW_STATUSES = new Set(['NEW', 'NEEDS_REVIEW', 'APPROVED', 'REJECTED', 'DEFERRED']);
const VERIFICATION_STATUSES = new Set(['verified', 'needs_review', 'draft', 'unverified']);

function normalizeSnapshotText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

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

function escapeMarkdownText(value) {
  return normalizeSnapshotText(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/\r?\n/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/([*_`[\]])/g, '\\$1');
}

function composeLeadReport(leads, profile, options = {}) {
  console.log('[Step 3] 영업용 리포트 생성...');

  const today = options.now ? new Date(options.now) : new Date();
  const dateStr = today.toISOString().split('T')[0];
  const dateKor = `${today.getUTCFullYear()}년 ${today.getUTCMonth() + 1}월 ${today.getUTCDate()}일`;

  const gradeALeads = leads.filter(l => l.grade === 'A').sort((a, b) => b.score - a.score);
  const gradeBLeads = leads.filter(l => l.grade === 'B').sort((a, b) => b.score - a.score);

  let reportMarkdown = `# [${escapeMarkdownText(profile.name)}] B2B 리드 리포트 - ${dateKor}\n\n`;
  reportMarkdown += `> 생성 시각 (UTC): ${today.toISOString()}\n`;
  reportMarkdown += `> 분석 대상: ${leads.length}개 리드\n\n`;

  // Grade A
  reportMarkdown += `## Grade A - 우선 검토 후보 (${gradeALeads.length}건)\n\n`;
  if (gradeALeads.length > 0) {
    for (const lead of gradeALeads) {
      reportMarkdown += `### ${escapeMarkdownText(lead.company)} (${lead.score}점)\n`;
      reportMarkdown += `- **프로젝트:** ${escapeMarkdownText(lead.summary)}\n`;
      reportMarkdown += `- **추천 제품:** ${escapeMarkdownText(lead.product)}\n`;
      reportMarkdown += `- **예상 ROI:** ${escapeMarkdownText(lead.roi || '-')}\n`;
      reportMarkdown += `- **영업 Pitch:** ${escapeMarkdownText(lead.salesPitch)}\n`;
      reportMarkdown += `- **글로벌 트렌드:** ${escapeMarkdownText(lead.globalContext || '-')}\n`;
      if (lead.verificationStatus && lead.verificationStatus !== 'verified') {
        reportMarkdown += `- **검증 상태:** ${escapeMarkdownText(lead.verificationStatus)} (${escapeMarkdownText(lead.generationMode || 'llm')})\n`;
      }
      reportMarkdown += '\n';
    }
  } else {
    reportMarkdown += '_해당 없음_\n\n';
  }

  // Grade B
  reportMarkdown += `## Grade B - 파이프라인 관리 (${gradeBLeads.length}건)\n\n`;
  if (gradeBLeads.length > 0) {
    for (const lead of gradeBLeads) {
      reportMarkdown += `### ${escapeMarkdownText(lead.company)} (${lead.score}점)\n`;
      reportMarkdown += `- **프로젝트:** ${escapeMarkdownText(lead.summary)}\n`;
      reportMarkdown += `- **추천 제품:** ${escapeMarkdownText(lead.product)}\n`;
      reportMarkdown += `- **예상 ROI:** ${escapeMarkdownText(lead.roi || '-')}\n`;
      reportMarkdown += `- **영업 Pitch:** ${escapeMarkdownText(lead.salesPitch)}\n`;
      reportMarkdown += `- **글로벌 트렌드:** ${escapeMarkdownText(lead.globalContext || '-')}\n`;
      if (lead.verificationStatus && lead.verificationStatus !== 'verified') {
        reportMarkdown += `- **검증 상태:** ${escapeMarkdownText(lead.verificationStatus)} (${escapeMarkdownText(lead.generationMode || 'llm')})\n`;
      }
      reportMarkdown += '\n';
    }
  } else {
    reportMarkdown += '_해당 없음_\n\n';
  }

  // 요약
  reportMarkdown += '---\n\n';
  reportMarkdown += '## 요약\n\n';
  reportMarkdown += `- **Grade A (우선 검토):** ${gradeALeads.length}건\n`;
  reportMarkdown += `- **Grade B (파이프라인):** ${gradeBLeads.length}건\n`;
  reportMarkdown += `- **총 리드:** ${leads.length}건\n`;

  console.log(`  리포트 생성 완료: Grade A ${gradeALeads.length}건, Grade B ${gradeBLeads.length}건\n`);

  return { content: reportMarkdown, dateStr };
}

function normalizeProfileId(profile) {
  const profileId = normalizeSnapshotText(profile && profile.id);
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(profileId)) {
    throw Object.assign(new Error('Publication profile id is invalid.'), {
      code: 'ERR_PUBLICATION_PROFILE_INVALID',
    });
  }
  return profileId;
}

function getProfileReportsDir(profile, { reportsRoot = path.join(__dirname, 'reports') } = {}) {
  const dir = path.join(reportsRoot, normalizeProfileId(profile));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function saveLeadReport(report, profile, options = {}) {
  const reportsDir = getProfileReportsDir(profile, options);
  assertLegacyPublicationWriterAllowed(reportsDir);
  const canonicalPath = path.join(reportsDir, ARTIFACT_NAMES.markdownCanonical(report.dateStr));

  fs.writeFileSync(canonicalPath, report.content, 'utf-8');

  console.log(`  리포트 저장: ${canonicalPath}`);
  console.log('');

  return canonicalPath;
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

function isValidIsoTimestamp(value) {
  const normalized = normalizeSnapshotText(value);
  return normalized && Number.isFinite(Date.parse(normalized)) ? normalized : '';
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

function readLeadHistoryOrThrow(historyPath) {
  let serializedHistory;
  try {
    serializedHistory = fs.readFileSync(historyPath, 'utf-8');
  } catch (error) {
    if (error && error.code === 'ENOENT') return [];
    throw error;
  }

  let history;
  try {
    history = JSON.parse(serializedHistory);
  } catch {
    throw createInvalidHistoryError();
  }
  if (!Array.isArray(history)) throw createInvalidHistoryError();
  return history.map(assertLegacyHistoryRecord);
}

function saveLeadSnapshot(leads, profile, options = {}) {
  const reportsDir = getProfileReportsDir(profile, options);
  assertLegacyPublicationWriterAllowed(reportsDir);
  const now = options.now || new Date().toISOString();
  const historyCanonicalPath = path.join(reportsDir, ARTIFACT_NAMES.historyCanonical);
  const history = Object.hasOwn(options, 'history')
    ? options.history
    : readLeadHistoryOrThrow(historyCanonicalPath);
  if (!Array.isArray(history)) throw createInvalidHistoryError();

  // 각 리드에 ID, 상태, 생성일 추가
  const enrichedLeads = prepareLeadSnapshotRecords(leads, {
    now,
    profileId: profile && profile.id,
    staleAfterDays: options.staleAfterDays,
  });

  const mergedHistory = mergeLeadHistory(history, leads, {
    now,
    profileId: profile && profile.id,
    staleAfterDays: options.staleAfterDays,
  });

  // 최신 리드 저장
  const latestCanonicalPath = path.join(reportsDir, ARTIFACT_NAMES.latestCanonical);
  const latestPayload = JSON.stringify(enrichedLeads, null, 2);
  const historyPayload = JSON.stringify(mergedHistory, null, 2);
  fs.writeFileSync(latestCanonicalPath, latestPayload, 'utf-8');
  console.log(`  리드 JSON 저장: ${latestCanonicalPath}`);

  // 히스토리에 추가 (기존 데이터 유지)
  fs.writeFileSync(historyCanonicalPath, historyPayload, 'utf-8');
  console.log(`  히스토리 저장: ${historyCanonicalPath} (총 ${mergedHistory.length}개 리드)`);
  console.log('');

  return latestCanonicalPath;
}

function stableJsonValue(value) {
  if (Array.isArray(value)) return value.map(stableJsonValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, stableJsonValue(value[key])])
  );
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function assertLegacyPublicationWriterAllowed(reportsDir) {
  if (fs.existsSync(path.join(reportsDir, ARTIFACT_NAMES.manifestCanonical))) {
    throw Object.assign(new Error('Manifest-backed publications require the atomic publication transaction.'), {
      code: 'ERR_PUBLICATION_MANAGED_WRITER_REQUIRED',
    });
  }
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

function artifactDescriptor(kind, relativePath, canonicalPath, payload, records = null) {
  const buffer = Buffer.isBuffer(payload) ? payload : Buffer.from(payload, 'utf8');
  return {
    kind,
    path: relativePath,
    canonicalPath,
    sha256: sha256(buffer),
    bytes: buffer.byteLength,
    ...(Number.isSafeInteger(records) ? { records } : {}),
  };
}

function manifestRepositoryArtifactPaths(profileId, manifest) {
  const repositoryPrefix = `reports/${profileId}`;
  return [
    `${repositoryPrefix}/${ARTIFACT_NAMES.manifestCanonical}`,
    ...(manifest.schemaVersion === PUBLICATION_SCHEMA_VERSION
      ? [`${repositoryPrefix}/publications/${manifest.publicationId}/${ARTIFACT_NAMES.manifestCanonical}`]
      : []),
    ...PUBLICATION_ARTIFACT_KINDS.map((kind) => `${repositoryPrefix}/${manifest.artifacts[kind].path}`),
    ...PUBLICATION_ARTIFACT_KINDS.map((kind) => `${repositoryPrefix}/${manifest.artifacts[kind].canonicalPath}`),
  ];
}

function assertSafePublicationRelativePath(relativePath, publicationId) {
  if (
    typeof relativePath !== 'string'
    || relativePath.includes('\\')
    || path.posix.isAbsolute(relativePath)
    || path.posix.normalize(relativePath) !== relativePath
    || relativePath.includes('..')
    || !relativePath.startsWith(`publications/${publicationId}/`)
  ) {
    throw Object.assign(new Error('Publication manifest path is invalid.'), {
      code: 'ERR_PUBLICATION_MANIFEST_INVALID',
    });
  }
  return relativePath;
}

function assertPublicationManifest(manifest, profile) {
  const profileId = normalizeProfileId(profile);
  const schemaVersion = manifest && manifest.schemaVersion;
  const expectedTopLevelKeys = schemaVersion === LEGACY_PUBLICATION_SCHEMA_VERSION
    ? [
        'artifacts',
        'counts',
        'generatedAt',
        'inputDigest',
        'previousPublicationId',
        'profileId',
        'publicationId',
        'renderVersion',
        'reportDate',
        'schemaVersion',
      ]
    : [
        'artifacts',
        'counts',
        'generatedAt',
        'inputDigest',
        'previousManifestSchemaVersion',
        'previousPublicationId',
        'profileId',
        'publicationId',
        'renderVersion',
        'reportDate',
        'runId',
        'schemaVersion',
      ];
  const topLevelKeys = manifest && typeof manifest === 'object'
    ? Object.keys(manifest).sort()
    : [];
  if (
    !manifest
    || ![LEGACY_PUBLICATION_SCHEMA_VERSION, PUBLICATION_SCHEMA_VERSION].includes(schemaVersion)
    || JSON.stringify(topLevelKeys) !== JSON.stringify(expectedTopLevelKeys)
    || manifest.renderVersion !== PUBLICATION_RENDER_VERSION
    || manifest.profileId !== profileId
    || !/^pub-[a-f0-9]{32}$/.test(manifest.publicationId || '')
    || !(manifest.previousPublicationId === null || /^pub-[a-f0-9]{32}$/.test(manifest.previousPublicationId || ''))
    || (
      schemaVersion === PUBLICATION_SCHEMA_VERSION
      && !(
        (manifest.previousPublicationId === null && manifest.previousManifestSchemaVersion === null)
        || (
          manifest.previousPublicationId !== null
          && [LEGACY_PUBLICATION_SCHEMA_VERSION, PUBLICATION_SCHEMA_VERSION]
            .includes(manifest.previousManifestSchemaVersion)
        )
      )
    )
    || (schemaVersion === PUBLICATION_SCHEMA_VERSION && !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(manifest.runId || ''))
    || !/^[a-f0-9]{64}$/.test(manifest.inputDigest || '')
    || !isValidIsoTimestamp(manifest.generatedAt)
    || !/^\d{4}-\d{2}-\d{2}$/.test(manifest.reportDate || '')
    || !manifest.counts
    || JSON.stringify(Object.keys(manifest.counts).sort()) !== JSON.stringify(['artifacts', 'history', 'leads'])
    || !Number.isSafeInteger(manifest.counts.leads)
    || !Number.isSafeInteger(manifest.counts.history)
    || manifest.counts.leads < 0
    || manifest.counts.history < 0
    || manifest.counts.artifacts !== PUBLICATION_ARTIFACT_KINDS.length
    || !manifest.artifacts
    || typeof manifest.artifacts !== 'object'
    || JSON.stringify(Object.keys(manifest.artifacts).sort()) !== JSON.stringify([...PUBLICATION_ARTIFACT_KINDS].sort())
  ) {
    throw Object.assign(new Error('Publication manifest is invalid.'), {
      code: 'ERR_PUBLICATION_MANIFEST_INVALID',
    });
  }
  for (const kind of PUBLICATION_ARTIFACT_KINDS) {
    const artifact = manifest.artifacts[kind];
    const expectedArtifactKeys = kind === 'report'
      ? ['bytes', 'canonicalPath', 'kind', 'path', 'sha256']
      : ['bytes', 'canonicalPath', 'kind', 'path', 'records', 'sha256'];
    if (
      !artifact
      || JSON.stringify(Object.keys(artifact).sort()) !== JSON.stringify(expectedArtifactKeys)
      || artifact.kind !== kind
      || !/^[a-f0-9]{64}$/.test(artifact.sha256 || '')
      || !Number.isSafeInteger(artifact.bytes)
      || artifact.bytes < 0
      || artifact.bytes > 20 * 1024 * 1024
      || (kind !== 'report' && (!Number.isSafeInteger(artifact.records) || artifact.records < 0))
    ) {
      throw Object.assign(new Error('Publication manifest artifact is invalid.'), {
        code: 'ERR_PUBLICATION_MANIFEST_INVALID',
      });
    }
    assertSafePublicationRelativePath(artifact.path, manifest.publicationId);
  }
  if (
    manifest.artifacts.latest.canonicalPath !== ARTIFACT_NAMES.latestCanonical
    || manifest.artifacts.history.canonicalPath !== ARTIFACT_NAMES.historyCanonical
    || manifest.artifacts.report.canonicalPath !== ARTIFACT_NAMES.markdownCanonical(manifest.reportDate)
    || manifest.artifacts.latest.records !== manifest.counts.leads
    || manifest.artifacts.history.records !== manifest.counts.history
    || PUBLICATION_ARTIFACT_KINDS.some((kind) => (
      manifest.artifacts[kind].path
      !== `publications/${manifest.publicationId}/${manifest.artifacts[kind].canonicalPath}`
    ))
  ) {
    throw Object.assign(new Error('Publication manifest canonical paths are invalid.'), {
      code: 'ERR_PUBLICATION_MANIFEST_INVALID',
    });
  }
  const artifactPaths = PUBLICATION_ARTIFACT_KINDS.map((kind) => manifest.artifacts[kind].path);
  if (new Set(artifactPaths).size !== artifactPaths.length) {
    throw Object.assign(new Error('Publication manifest artifact paths are duplicated.'), {
      code: 'ERR_PUBLICATION_MANIFEST_INVALID',
    });
  }
  return manifest;
}

function readManifestOrNull(manifestPath, profile) {
  let serialized;
  try {
    serialized = fs.readFileSync(manifestPath, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') return null;
    throw error;
  }
  if (Buffer.byteLength(serialized, 'utf8') > 64 * 1024) {
    throw Object.assign(new Error('Publication manifest exceeds its size limit.'), {
      code: 'ERR_PUBLICATION_MANIFEST_INVALID',
    });
  }
  try {
    return assertPublicationManifest(JSON.parse(serialized), profile);
  } catch (error) {
    if (error && error.code === 'ERR_PUBLICATION_MANIFEST_INVALID') throw error;
    throw Object.assign(new Error('Publication manifest is invalid.'), {
      code: 'ERR_PUBLICATION_MANIFEST_INVALID',
    });
  }
}

function readCommittedPublication(profile, options = {}) {
  const reportsRoot = options.reportsRoot || path.join(__dirname, 'reports');
  const reportsDir = path.join(reportsRoot, normalizeProfileId(profile));
  const manifestPath = path.join(reportsDir, ARTIFACT_NAMES.manifestCanonical);
  const manifest = readManifestOrNull(manifestPath, profile);
  if (!manifest) return null;
  if (manifest.schemaVersion === PUBLICATION_SCHEMA_VERSION) {
    try {
      const pointerPayload = fs.readFileSync(manifestPath);
      const generationManifestPayload = fs.readFileSync(path.join(
        reportsDir,
        'publications',
        manifest.publicationId,
        ARTIFACT_NAMES.manifestCanonical,
      ));
      if (!pointerPayload.equals(generationManifestPayload)) throw new Error('manifest copies differ');
    } catch {
      throw Object.assign(new Error('Publication generation manifest is unavailable or inconsistent.'), {
        code: 'ERR_PUBLICATION_MANIFEST_INVALID',
      });
    }
  }

  const buffers = {};
  for (const kind of PUBLICATION_ARTIFACT_KINDS) {
    const descriptor = manifest.artifacts[kind];
    const artifactPath = path.join(reportsDir, ...descriptor.path.split('/'));
    let buffer;
    try {
      const stat = fs.lstatSync(artifactPath);
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('not a regular file');
      buffer = fs.readFileSync(artifactPath);
    } catch {
      throw Object.assign(new Error('Committed publication artifact is unavailable.'), {
        code: 'ERR_PUBLICATION_ARTIFACT_INVALID',
      });
    }
    if (buffer.byteLength !== descriptor.bytes || sha256(buffer) !== descriptor.sha256) {
      throw Object.assign(new Error('Committed publication artifact checksum failed.'), {
        code: 'ERR_PUBLICATION_ARTIFACT_INVALID',
      });
    }
    buffers[kind] = buffer;
  }

  let latest;
  let history;
  try {
    latest = JSON.parse(buffers.latest.toString('utf8'));
    history = JSON.parse(buffers.history.toString('utf8'));
  } catch {
    throw Object.assign(new Error('Committed publication JSON is invalid.'), {
      code: 'ERR_PUBLICATION_ARTIFACT_INVALID',
    });
  }
  if (!Array.isArray(latest) || !Array.isArray(history)) {
    throw Object.assign(new Error('Committed publication JSON shape is invalid.'), {
      code: 'ERR_PUBLICATION_ARTIFACT_INVALID',
    });
  }

  const compatibilityIntact = PUBLICATION_ARTIFACT_KINDS.every((kind) => {
    const descriptor = manifest.artifacts[kind];
    try {
      const canonical = fs.readFileSync(path.join(reportsDir, descriptor.canonicalPath));
      return canonical.byteLength === descriptor.bytes && sha256(canonical) === descriptor.sha256;
    } catch {
      return false;
    }
  });

  return {
    manifest,
    manifestPath,
    reportsDir,
    buffers,
    latest,
    history,
    report: buffers.report.toString('utf8'),
    compatibilityIntact,
  };
}

function findHistoricalRunManifest(committed, runId) {
  if (!committed) return null;
  const seen = new Set();
  let manifest = committed.manifest;
  for (let depth = 0; manifest && depth < 10000; depth += 1) {
    if (seen.has(manifest.publicationId)) {
      throw Object.assign(new Error('Publication manifest history contains a cycle.'), {
        code: 'ERR_PUBLICATION_MANIFEST_INVALID',
      });
    }
    seen.add(manifest.publicationId);
    if (manifest.schemaVersion === PUBLICATION_SCHEMA_VERSION) {
      if (manifest.runId === runId) return manifest;
      if (manifest.previousPublicationId === null) return null;
      if (manifest.previousManifestSchemaVersion === LEGACY_PUBLICATION_SCHEMA_VERSION) return null;
      const previousPath = path.join(
        committed.reportsDir,
        'publications',
        manifest.previousPublicationId,
        ARTIFACT_NAMES.manifestCanonical,
      );
      const previous = readManifestOrNull(previousPath, { id: manifest.profileId });
      if (!previous || previous.publicationId !== manifest.previousPublicationId) {
        throw Object.assign(new Error('Publication manifest history is incomplete.'), {
          code: 'ERR_PUBLICATION_MANIFEST_INVALID',
        });
      }
      manifest = previous;
      continue;
    }
    return null;
  }
  if (manifest) {
    throw Object.assign(new Error('Publication manifest history exceeds its traversal limit.'), {
      code: 'ERR_PUBLICATION_MANIFEST_INVALID',
    });
  }
  return null;
}

function prepareLeadPublication(qualifiedLeads, profile, options = {}) {
  const profileId = normalizeProfileId(profile);
  const reportsRoot = options.reportsRoot || path.join(__dirname, 'reports');
  const reportsDir = path.join(reportsRoot, profileId);
  const now = options.now || new Date().toISOString();
  const { validLeads, rejectedCount } = prepareValidatedLeadRecords(qualifiedLeads, {
    now,
    profileId,
    staleAfterDays: options.staleAfterDays,
    idFactory: options.idFactory || generateLeadId,
  });

  if (new Set(validLeads.map((lead) => lead.id)).size !== validLeads.length) {
    throw Object.assign(new Error('Published lead identities must be unique.'), {
      code: 'ERR_LEAD_PUBLICATION_DUPLICATE_ID',
    });
  }
  if (validLeads.length > PUBLICATION_LATEST_MAX_RECORDS) {
    throw Object.assign(new Error('Published latest-lead cardinality exceeds the consumer contract.'), {
      code: 'ERR_LEAD_PUBLICATION_LIMIT',
    });
  }

  if (validLeads.length === 0) {
    return {
      profileId,
      reportsDir,
      validLeads,
      rejectedCount,
      noChange: false,
      artifactCount: 0,
    };
  }

  const committed = readCommittedPublication(profile, { reportsRoot });
  const historyPath = path.join(reportsDir, ARTIFACT_NAMES.historyCanonical);
  const history = committed ? committed.history : readLeadHistoryOrThrow(historyPath);
  const orderedSemanticLeads = validLeads
    .map(semanticPublicationLead)
    .sort((left, right) => String(left.id).localeCompare(String(right.id)));
  const inputDigest = sha256(Buffer.from(JSON.stringify(stableJsonValue({
    schemaVersion: PUBLICATION_SCHEMA_VERSION,
    renderVersion: PUBLICATION_RENDER_VERSION,
    profileId,
    leads: orderedSemanticLeads,
  })), 'utf8'));
  const runId = typeof options.runId === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(options.runId)
    ? options.runId
    : `local-${inputDigest.slice(0, 32)}`;
  const historicalRunManifest = findHistoricalRunManifest(committed, runId);

  if (historicalRunManifest && historicalRunManifest.inputDigest !== inputDigest) {
    throw Object.assign(new Error('One run id cannot publish two different artifact sets.'), {
      code: 'ERR_RUN_ID_CONFLICT',
      stage: 'replay',
      retryable: false,
      safeMessage: 'Run identity conflicts with an existing publication.',
    });
  }

  if (
    historicalRunManifest
    && historicalRunManifest.publicationId !== committed.manifest.publicationId
  ) {
    return {
      profileId,
      reportsDir,
      validLeads,
      rejectedCount,
      noChange: true,
      sameRunReplay: true,
      historicalRunReplay: true,
      compatibilityIntact: true,
      publicationId: historicalRunManifest.publicationId,
      previousPublicationId: historicalRunManifest.previousPublicationId || null,
      inputDigest,
      manifest: historicalRunManifest,
      manifestPath: committed.manifestPath,
      artifactCount: PUBLICATION_ARTIFACT_KINDS.length,
      artifactPaths: [],
      repairArtifactPaths: [],
    };
  }

  if (committed && committed.manifest.inputDigest === inputDigest) {
    return {
      profileId,
      reportsDir,
      validLeads,
      rejectedCount,
      noChange: true,
      sameRunReplay: Boolean(historicalRunManifest),
      compatibilityIntact: committed.compatibilityIntact,
      publicationId: committed.manifest.publicationId,
      previousPublicationId: committed.manifest.previousPublicationId || null,
      inputDigest,
      manifest: committed.manifest,
      manifestPath: committed.manifestPath,
      artifactCount: PUBLICATION_ARTIFACT_KINDS.length,
      artifactPaths: [],
      repairArtifactPaths: manifestRepositoryArtifactPaths(profileId, committed.manifest),
    };
  }

  const previousPublicationId = committed ? committed.manifest.publicationId : null;
  const previousManifestSchemaVersion = committed ? committed.manifest.schemaVersion : null;
  const mergedHistory = mergePreparedLeadHistory(history, validLeads, { now });
  if (new Set(mergedHistory.map((lead) => lead.id)).size !== mergedHistory.length) {
    throw Object.assign(new Error('Published history lead identities must be unique.'), {
      code: 'ERR_LEAD_PUBLICATION_DUPLICATE_ID',
    });
  }
  if (mergedHistory.length > PUBLICATION_HISTORY_MAX_RECORDS) {
    throw Object.assign(new Error('Published lead history exceeds the consumer contract.'), {
      code: 'ERR_LEAD_PUBLICATION_LIMIT',
    });
  }
  if (
    [...validLeads, ...mergedHistory]
      .some((lead) => Buffer.byteLength(JSON.stringify(lead), 'utf8') > PUBLICATION_ENTRY_MAX_BYTES)
  ) {
    throw Object.assign(new Error('Published lead bytes exceed the consumer entry contract.'), {
      code: 'ERR_LEAD_PUBLICATION_LIMIT',
    });
  }
  const report = composeLeadReport(validLeads, profile, { now });
  const payloads = {
    report: Buffer.from(report.content, 'utf8'),
    latest: Buffer.from(JSON.stringify(validLeads, null, 2), 'utf8'),
    history: Buffer.from(JSON.stringify(mergedHistory, null, 2), 'utf8'),
  };
  if (['latest', 'history'].some((kind) => payloads[kind].byteLength > PUBLICATION_JSON_MAX_BYTES)) {
    throw Object.assign(new Error('Published JSON bytes exceed the consumer contract.'), {
      code: 'ERR_LEAD_PUBLICATION_LIMIT',
    });
  }
  // Bind the immutable generation name to the exact bytes and manifest inputs.
  // A hard exit after the generation rename but before the pointer commit can
  // otherwise leave an orphan with the same logical-input id but different
  // timestamp-derived bytes, permanently blocking a later retry.
  const publicationId = `pub-${sha256(Buffer.from(JSON.stringify({
    profileId,
    inputDigest,
    previousPublicationId,
    previousManifestSchemaVersion,
    renderVersion: PUBLICATION_RENDER_VERSION,
    runId,
    generatedAt: now,
    reportDate: report.dateStr,
    artifacts: Object.fromEntries(PUBLICATION_ARTIFACT_KINDS.map((kind) => [kind, {
      bytes: payloads[kind].byteLength,
      sha256: sha256(payloads[kind]),
    }])),
  }), 'utf8')).slice(0, 32)}`;
  const generationPrefix = `publications/${publicationId}`;
  const artifacts = {
    report: artifactDescriptor(
      'report',
      `${generationPrefix}/${ARTIFACT_NAMES.markdownCanonical(report.dateStr)}`,
      ARTIFACT_NAMES.markdownCanonical(report.dateStr),
      payloads.report,
    ),
    latest: artifactDescriptor(
      'latest',
      `${generationPrefix}/${ARTIFACT_NAMES.latestCanonical}`,
      ARTIFACT_NAMES.latestCanonical,
      payloads.latest,
      validLeads.length,
    ),
    history: artifactDescriptor(
      'history',
      `${generationPrefix}/${ARTIFACT_NAMES.historyCanonical}`,
      ARTIFACT_NAMES.historyCanonical,
      payloads.history,
      mergedHistory.length,
    ),
  };
  const manifest = {
    schemaVersion: PUBLICATION_SCHEMA_VERSION,
    renderVersion: PUBLICATION_RENDER_VERSION,
    profileId,
    runId,
    publicationId,
    previousPublicationId,
    previousManifestSchemaVersion,
    inputDigest,
    generatedAt: now,
    reportDate: report.dateStr,
    counts: {
      leads: validLeads.length,
      history: mergedHistory.length,
      artifacts: PUBLICATION_ARTIFACT_KINDS.length,
    },
    artifacts,
  };
  assertPublicationManifest(manifest, profile);
  const manifestPayload = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  const artifactPaths = manifestRepositoryArtifactPaths(profileId, manifest);

  return {
    profileId,
    reportsDir,
    validLeads,
    rejectedCount,
    noChange: false,
    compatibilityIntact: committed ? committed.compatibilityIntact : true,
    publicationId,
    previousPublicationId,
    inputDigest,
    manifest,
    manifestPayload,
    manifestPath: path.join(reportsDir, ARTIFACT_NAMES.manifestCanonical),
    payloads,
    artifactCount: PUBLICATION_ARTIFACT_KINDS.length,
    artifactPaths,
    report,
  };
}

function callPublicationFault(faultInjector, operation) {
  if (typeof faultInjector === 'function') faultInjector(operation);
}

function syncFile(filePath) {
  const fd = fs.openSync(filePath, 'r');
  try {
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

function syncDirectory(dirPath) {
  let fd;
  try {
    fd = fs.openSync(dirPath, 'r');
    fs.fsyncSync(fd);
  } catch (error) {
    if (!['EINVAL', 'ENOTSUP', 'EISDIR'].includes(error && error.code)) throw error;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

function writeStagedFile(filePath, payload, operation, faultInjector) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, payload, { mode: 0o600 });
  callPublicationFault(faultInjector, `${operation}:write`);
  syncFile(filePath);
  callPublicationFault(faultInjector, `${operation}:sync`);
}

function atomicReplaceFile(filePath, payload, operation, faultInjector, { onRename = null } = {}) {
  const temporaryPath = `${filePath}.tmp-${process.pid}-${crypto.randomBytes(6).toString('hex')}`;
  try {
    fs.writeFileSync(temporaryPath, payload, { mode: 0o600 });
    callPublicationFault(faultInjector, `${operation}:write`);
    syncFile(temporaryPath);
    callPublicationFault(faultInjector, `${operation}:sync`);
    callPublicationFault(faultInjector, `${operation}:before-rename`);
    fs.renameSync(temporaryPath, filePath);
    if (typeof onRename === 'function') onRename();
    callPublicationFault(faultInjector, `${operation}:rename`);
    syncDirectory(path.dirname(filePath));
    callPublicationFault(faultInjector, `${operation}:sync-directory`);
  } catch (error) {
    try {
      fs.rmSync(temporaryPath, { force: true });
    } catch {
      // Preserve the original atomic-replacement error.
    }
    throw error;
  }
}

function snapshotFiles(paths) {
  return new Map(paths.map((filePath) => {
    try {
      return [filePath, { exists: true, payload: fs.readFileSync(filePath) }];
    } catch (error) {
      if (error && error.code === 'ENOENT') return [filePath, { exists: false, payload: null }];
      throw error;
    }
  }));
}

function restoreFileSnapshots(snapshots) {
  for (const [filePath, snapshot] of snapshots) {
    if (snapshot.exists) {
      atomicReplaceFile(filePath, snapshot.payload, 'rollback', null);
    } else {
      fs.rmSync(filePath, { force: true });
    }
  }
}

function authoritativeCompatibilitySnapshots(reportsDir, targetManifest, committed) {
  return new Map(PUBLICATION_ARTIFACT_KINDS.map((kind) => {
    const targetPath = path.join(reportsDir, targetManifest.artifacts[kind].canonicalPath);
    if (
      committed
      && committed.manifest.artifacts[kind].canonicalPath === targetManifest.artifacts[kind].canonicalPath
    ) {
      return [targetPath, { exists: true, payload: committed.buffers[kind] }];
    }
    try {
      return [targetPath, { exists: true, payload: fs.readFileSync(targetPath) }];
    } catch (error) {
      if (error && error.code === 'ENOENT') return [targetPath, { exists: false, payload: null }];
      throw error;
    }
  }));
}

function publicationLockCanRecover(lockPath) {
  try {
    const owner = JSON.parse(fs.readFileSync(path.join(lockPath, 'owner.json'), 'utf8'));
    if (Number.isSafeInteger(owner.pid) && owner.pid > 0) {
      try {
        process.kill(owner.pid, 0);
        return false;
      } catch (error) {
        if (error && error.code === 'ESRCH') return true;
        return false;
      }
    }
  } catch {
    // A malformed owner file is recoverable only after the stale-time bound.
  }
  try {
    return Date.now() - fs.statSync(lockPath).mtimeMs >= PUBLICATION_LOCK_STALE_MS;
  } catch {
    return false;
  }
}

function createPublicationLockedError() {
  return Object.assign(new Error('Another local publication holds the profile lock.'), {
    code: 'ERR_PUBLICATION_LOCKED',
    retryable: true,
  });
}

function recoveryClaimCanRecover(claimPath) {
  try {
    const claim = JSON.parse(fs.readFileSync(claimPath, 'utf8'));
    if (Number.isSafeInteger(claim.pid) && claim.pid > 0) {
      try {
        process.kill(claim.pid, 0);
        return false;
      } catch (error) {
        return Boolean(error && error.code === 'ESRCH');
      }
    }
  } catch {
    // A malformed claim is recoverable only after the stale-time bound.
  }
  try {
    return Date.now() - fs.statSync(claimPath).mtimeMs >= PUBLICATION_LOCK_STALE_MS;
  } catch {
    return false;
  }
}

function createPublicationRecoveryClaim(recoveryClaimPath, ownerId) {
  const payload = JSON.stringify({
    pid: process.pid,
    ownerId,
    createdAt: new Date().toISOString(),
  });
  try {
    fs.writeFileSync(recoveryClaimPath, payload, { flag: 'wx', mode: 0o600 });
    return;
  } catch (error) {
    if (!error || error.code !== 'EEXIST' || !recoveryClaimCanRecover(recoveryClaimPath)) {
      throw createPublicationLockedError();
    }
  }
  try {
    fs.rmSync(recoveryClaimPath);
    fs.writeFileSync(recoveryClaimPath, payload, { flag: 'wx', mode: 0o600 });
  } catch {
    throw createPublicationLockedError();
  }
}

function acquirePublicationLock(reportsDir, { recoveryAttempted = false, faultInjector } = {}) {
  const lockPath = path.join(reportsDir, PUBLICATION_LOCK_NAME);
  const ownerId = crypto.randomBytes(16).toString('hex');
  let created = false;
  try {
    fs.mkdirSync(lockPath);
    created = true;
    fs.writeFileSync(path.join(lockPath, 'owner.json'), JSON.stringify({
      pid: process.pid,
      ownerId,
      createdAt: new Date().toISOString(),
    }), { mode: 0o600 });
  } catch (error) {
    if (error && error.code === 'EEXIST') {
      if (recoveryAttempted || !publicationLockCanRecover(lockPath)) {
        throw createPublicationLockedError();
      }
      const recoveryClaimPath = path.join(lockPath, '.recovery-claim');
      try {
        createPublicationRecoveryClaim(recoveryClaimPath, ownerId);
      } catch {
        throw createPublicationLockedError();
      }
      try {
        callPublicationFault(faultInjector, 'lock:recovery-claimed');
        if (!publicationLockCanRecover(lockPath)) throw createPublicationLockedError();
        const quarantinePath = `${lockPath}.stale-${process.pid}-${ownerId}`;
        fs.renameSync(lockPath, quarantinePath);
        fs.rmSync(quarantinePath, { recursive: true, force: true });
      } catch (recoveryError) {
        try {
          fs.rmSync(recoveryClaimPath, { force: true });
        } catch {
          // Preserve the lock recovery result.
        }
        throw recoveryError;
      }
      return acquirePublicationLock(reportsDir, {
        recoveryAttempted: true,
        faultInjector,
      });
    }
    if (created) {
      try {
        fs.rmSync(lockPath, { recursive: true, force: true });
      } catch {
        // Preserve the lock-owner persistence error.
      }
    }
    throw error;
  }
  return { lockPath, ownerId };
}

function generationMatchesPrepared(generationDir, prepared) {
  try {
    const artifactsMatch = PUBLICATION_ARTIFACT_KINDS.every((kind) => {
      const descriptor = prepared.manifest.artifacts[kind];
      const artifactPath = path.join(generationDir, path.basename(descriptor.path));
      const stat = fs.lstatSync(artifactPath);
      if (!stat.isFile() || stat.isSymbolicLink()) return false;
      const buffer = fs.readFileSync(artifactPath);
      return buffer.byteLength === descriptor.bytes && sha256(buffer) === descriptor.sha256;
    });
    if (!artifactsMatch) return false;
    const generationManifest = fs.readFileSync(
      path.join(generationDir, ARTIFACT_NAMES.manifestCanonical),
    );
    return generationManifest.equals(prepared.manifestPayload);
  } catch {
    return false;
  }
}

function releasePublicationLock(lockHandle) {
  if (!lockHandle || !lockHandle.lockPath || !lockHandle.ownerId) return;
  try {
    const owner = JSON.parse(fs.readFileSync(path.join(lockHandle.lockPath, 'owner.json'), 'utf8'));
    if (owner.ownerId !== lockHandle.ownerId) return;
    fs.rmSync(lockHandle.lockPath, { recursive: true, force: true });
  } catch {
    // The publication result must not be reversed by best-effort lock cleanup.
  }
}

function cleanupAbandonedPublicationTransactions(reportsDir) {
  for (const entry of fs.readdirSync(reportsDir, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name.startsWith('.publication-txn-')) {
      fs.rmSync(path.join(reportsDir, entry.name), { recursive: true, force: true });
    }
  }
}

function repairPublicationCompatibilityMirrors(profile, options = {}) {
  const reportsRoot = options.reportsRoot || path.join(__dirname, 'reports');
  const reportsDir = path.join(reportsRoot, normalizeProfileId(profile));
  const lockHandle = acquirePublicationLock(reportsDir, { faultInjector: options.faultInjector });
  try {
    const committed = readCommittedPublication(profile, options);
    if (!committed || committed.compatibilityIntact) return false;
    for (const kind of PUBLICATION_ARTIFACT_KINDS) {
      atomicReplaceFile(
        path.join(committed.reportsDir, committed.manifest.artifacts[kind].canonicalPath),
        committed.buffers[kind],
        `repair:${kind}`,
        options.faultInjector,
      );
    }
    const repaired = readCommittedPublication(profile, options);
    if (!repaired || !repaired.compatibilityIntact) {
      throw Object.assign(new Error('Compatibility mirror repair could not be verified.'), {
        code: 'ERR_PUBLICATION_REPAIR_FAILED',
      });
    }
    return true;
  } finally {
    releasePublicationLock(lockHandle);
  }
}

function localPublicationCommitResult(prepared, reportsDir) {
  return {
    reportsDir,
    reportPath: path.join(reportsDir, prepared.manifest.artifacts.report.canonicalPath),
    latestLeadsPath: path.join(reportsDir, ARTIFACT_NAMES.latestCanonical),
    historyPath: path.join(reportsDir, ARTIFACT_NAMES.historyCanonical),
    manifestPath: path.join(reportsDir, ARTIFACT_NAMES.manifestCanonical),
    publicationId: prepared.publicationId,
    inputDigest: prepared.inputDigest,
    artifactCount: prepared.artifactCount,
    artifactPaths: prepared.artifactPaths,
    localCommitted: true,
  };
}

function commitLeadPublication(prepared, profile, options = {}) {
  if (!prepared || prepared.noChange || !prepared.manifest || !prepared.payloads) {
    throw Object.assign(new Error('Prepared publication is not commit-ready.'), {
      code: 'ERR_PUBLICATION_NOT_PREPARED',
    });
  }
  const reportsDir = prepared.reportsDir;
  fs.mkdirSync(reportsDir, { recursive: true });
  fs.mkdirSync(path.join(reportsDir, 'publications'), { recursive: true });
  const lockHandle = acquirePublicationLock(reportsDir, { faultInjector: options.faultInjector });
  let transactionDir = null;
  let generationStageDir = null;
  const generationFinalDir = path.join(reportsDir, 'publications', prepared.publicationId);
  let generationCreated = false;
  let pointerCommitted = false;
  let snapshots = null;

  try {
    cleanupAbandonedPublicationTransactions(reportsDir);
    transactionDir = fs.mkdtempSync(path.join(reportsDir, '.publication-txn-'));
    generationStageDir = path.join(transactionDir, prepared.publicationId);
    callPublicationFault(options.faultInjector, 'lock:acquired');
    const currentManifest = readManifestOrNull(
      path.join(reportsDir, ARTIFACT_NAMES.manifestCanonical),
      profile,
    );
    if ((currentManifest && currentManifest.publicationId) !== prepared.previousPublicationId) {
      throw Object.assign(new Error('Publication base changed before local commit.'), {
        code: 'ERR_PUBLICATION_BASE_CHANGED',
        retryable: true,
      });
    }
    const currentCommitted = currentManifest
      ? readCommittedPublication(profile, { reportsRoot: path.dirname(reportsDir) })
      : null;
    snapshots = authoritativeCompatibilitySnapshots(reportsDir, prepared.manifest, currentCommitted);

    fs.mkdirSync(generationStageDir, { recursive: true });
    callPublicationFault(options.faultInjector, 'generation:mkdir');
    for (const kind of PUBLICATION_ARTIFACT_KINDS) {
      const descriptor = prepared.manifest.artifacts[kind];
      writeStagedFile(
        path.join(generationStageDir, path.basename(descriptor.path)),
        prepared.payloads[kind],
        `generation:${kind}`,
        options.faultInjector,
      );
    }
    writeStagedFile(
      path.join(generationStageDir, ARTIFACT_NAMES.manifestCanonical),
      prepared.manifestPayload,
      'generation:manifest',
      options.faultInjector,
    );
    syncDirectory(generationStageDir);
    callPublicationFault(options.faultInjector, 'generation:sync-directory');
    if (fs.existsSync(generationFinalDir)) {
      if (!generationMatchesPrepared(generationFinalDir, prepared)) {
        throw Object.assign(new Error('Publication id collision detected.'), {
          code: 'ERR_PUBLICATION_ID_COLLISION',
        });
      }
      fs.rmSync(generationStageDir, { recursive: true, force: true });
    } else {
      fs.renameSync(generationStageDir, generationFinalDir);
      generationCreated = true;
      callPublicationFault(options.faultInjector, 'generation:rename');
      syncDirectory(path.dirname(generationFinalDir));
    }

    for (const kind of PUBLICATION_ARTIFACT_KINDS) {
      atomicReplaceFile(
        path.join(reportsDir, prepared.manifest.artifacts[kind].canonicalPath),
        prepared.payloads[kind],
        `compatibility:${kind}`,
        options.faultInjector,
      );
    }

    atomicReplaceFile(
      path.join(reportsDir, ARTIFACT_NAMES.manifestCanonical),
      prepared.manifestPayload,
      'pointer',
      options.faultInjector,
      { onRename() { pointerCommitted = true; } },
    );

    const verified = readCommittedPublication(profile, {
      reportsRoot: path.dirname(reportsDir),
    });
    if (!verified || verified.manifest.publicationId !== prepared.publicationId || !verified.compatibilityIntact) {
      throw Object.assign(new Error('Publication commit could not be verified.'), {
        code: 'ERR_PUBLICATION_COMMIT_UNKNOWN',
      });
    }

    return localPublicationCommitResult(prepared, reportsDir);
  } catch (error) {
    if (pointerCommitted) {
      try {
        const reconciled = readCommittedPublication(profile, {
          reportsRoot: path.dirname(reportsDir),
        });
        if (
          reconciled
          && reconciled.manifest.publicationId === prepared.publicationId
          && reconciled.compatibilityIntact
        ) {
          return localPublicationCommitResult(prepared, reportsDir);
        }
      } catch {
        // The pointer remains authoritative; surface an unknown local commit.
      }
      throw Object.assign(new Error('Publication commit point was reached but could not be reconciled.'), {
        code: 'ERR_PUBLICATION_COMMIT_UNKNOWN',
        cause: error,
      });
    }
    if (!pointerCommitted && snapshots) {
      try {
        restoreFileSnapshots(snapshots);
        if (generationCreated) fs.rmSync(generationFinalDir, { recursive: true, force: true });
      } catch {
        throw Object.assign(new Error('Publication rollback failed; manifest remains authoritative.'), {
          code: 'ERR_PUBLICATION_ROLLBACK_FAILED',
          cause: error,
        });
      }
    }
    throw error;
  } finally {
    if (transactionDir) {
      try {
        fs.rmSync(transactionDir, { recursive: true, force: true });
      } catch {
        // Transaction directories are non-authoritative cleanup state.
      }
    }
    releasePublicationLock(lockHandle);
  }
}

function publishLeadReport(leadReport, qualifiedLeads, profile, options = {}) {
  const prepared = prepareLeadPublication(qualifiedLeads, profile, {
    ...options,
    now: options.now || (leadReport && leadReport.now) || new Date().toISOString(),
  });
  if (prepared.validLeads.length === 0) {
    throw Object.assign(new Error('No valid leads were available for publication.'), {
      code: 'ERR_NO_VALID_LEADS',
    });
  }
  if (prepared.noChange) {
    if (!prepared.compatibilityIntact) repairPublicationCompatibilityMirrors(profile, options);
    return {
      reportsDir: prepared.reportsDir,
      manifestPath: prepared.manifestPath,
      publicationId: prepared.publicationId,
      inputDigest: prepared.inputDigest,
      artifactCount: prepared.artifactCount,
      artifactPaths: [],
      localCommitted: true,
      noChange: true,
    };
  }
  return { ...commitLeadPublication(prepared, profile, options), noChange: false };
}

const generateReport = composeLeadReport;
const saveReport = saveLeadReport;
const saveLeadsJson = saveLeadSnapshot;

module.exports = {
  generateReport,
  saveReport,
  saveLeadsJson,
  composeLeadReport,
  saveLeadReport,
  saveLeadSnapshot,
  publishLeadReport,
  prepareLeadPublication,
  commitLeadPublication,
  readCommittedPublication,
  repairPublicationCompatibilityMirrors,
  prepareValidatedLeadRecords,
  mergePreparedLeadHistory,
  assertPublicationManifest,
  ARTIFACT_NAMES,
  PUBLICATION_SCHEMA_VERSION,
  PUBLICATION_RENDER_VERSION,
  PUBLICATION_LATEST_MAX_RECORDS,
  PUBLICATION_HISTORY_MAX_RECORDS,
  PUBLICATION_JSON_MAX_BYTES,
  PUBLICATION_ENTRY_MAX_BYTES,
  mergeLeadHistory,
  prepareLeadSnapshotRecords,
  normalizePublicationSources,
  escapeMarkdownText,
};
