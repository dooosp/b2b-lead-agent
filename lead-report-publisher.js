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

const PUBLICATION_SCHEMA_VERSION = 1;
const PUBLICATION_RENDER_VERSION = 1;
const PUBLICATION_ARTIFACT_KINDS = Object.freeze(['report', 'latest', 'history']);
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
  const dateKor = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;

  const gradeALeads = leads.filter(l => l.grade === 'A').sort((a, b) => b.score - a.score);
  const gradeBLeads = leads.filter(l => l.grade === 'B').sort((a, b) => b.score - a.score);

  let reportMarkdown = `# [${escapeMarkdownText(profile.name)}] B2B 리드 리포트 - ${dateKor}\n\n`;
  reportMarkdown += `> 생성 시각: ${today.toLocaleString('ko-KR')}\n`;
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
    const systemId = idFactory(callerLead, { profileId });
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
    ? history.map(projectLegacyHistoryRecord).filter(Boolean)
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
  return history;
}

function saveLeadSnapshot(leads, profile, options = {}) {
  const reportsDir = getProfileReportsDir(profile, options);
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
    for (const field of ['title', 'url', 'source', 'query', 'originUrl']) {
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
    ? history.map(projectLegacyHistoryRecord).filter(Boolean)
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
  const topLevelKeys = manifest && typeof manifest === 'object'
    ? Object.keys(manifest).sort()
    : [];
  if (
    !manifest
    || JSON.stringify(topLevelKeys) !== JSON.stringify([
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
    ])
    || manifest.schemaVersion !== PUBLICATION_SCHEMA_VERSION
    || manifest.renderVersion !== PUBLICATION_RENDER_VERSION
    || manifest.profileId !== profileId
    || !/^pub-[a-f0-9]{32}$/.test(manifest.publicationId || '')
    || !(manifest.previousPublicationId === null || /^pub-[a-f0-9]{32}$/.test(manifest.previousPublicationId || ''))
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

  if (committed && committed.manifest.inputDigest === inputDigest) {
    return {
      profileId,
      reportsDir,
      validLeads,
      rejectedCount,
      noChange: true,
      compatibilityIntact: committed.compatibilityIntact,
      publicationId: committed.manifest.publicationId,
      previousPublicationId: committed.manifest.previousPublicationId || null,
      inputDigest,
      manifest: committed.manifest,
      manifestPath: committed.manifestPath,
      artifactCount: PUBLICATION_ARTIFACT_KINDS.length,
      artifactPaths: [],
    };
  }

  const previousPublicationId = committed ? committed.manifest.publicationId : null;
  const publicationId = `pub-${sha256(Buffer.from(JSON.stringify({
    profileId,
    inputDigest,
    previousPublicationId,
    renderVersion: PUBLICATION_RENDER_VERSION,
  }), 'utf8')).slice(0, 32)}`;
  const mergedHistory = mergePreparedLeadHistory(history, validLeads, { now });
  const report = composeLeadReport(validLeads, profile, { now });
  const payloads = {
    report: Buffer.from(report.content, 'utf8'),
    latest: Buffer.from(JSON.stringify(validLeads, null, 2), 'utf8'),
    history: Buffer.from(JSON.stringify(mergedHistory, null, 2), 'utf8'),
  };
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
    publicationId,
    previousPublicationId,
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

  const repositoryPrefix = `reports/${profileId}`;
  const artifactPaths = [
    `${repositoryPrefix}/${ARTIFACT_NAMES.manifestCanonical}`,
    ...PUBLICATION_ARTIFACT_KINDS.map((kind) => `${repositoryPrefix}/${artifacts[kind].path}`),
    ...PUBLICATION_ARTIFACT_KINDS.map((kind) => `${repositoryPrefix}/${artifacts[kind].canonicalPath}`),
  ];

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

function acquirePublicationLock(reportsDir, { recovered = false } = {}) {
  const lockPath = path.join(reportsDir, PUBLICATION_LOCK_NAME);
  let created = false;
  try {
    fs.mkdirSync(lockPath);
    created = true;
    fs.writeFileSync(path.join(lockPath, 'owner.json'), JSON.stringify({
      pid: process.pid,
      createdAt: new Date().toISOString(),
    }), { mode: 0o600 });
  } catch (error) {
    if (error && error.code === 'EEXIST') {
      if (!recovered && publicationLockCanRecover(lockPath)) {
        fs.rmSync(lockPath, { recursive: true, force: true });
        return acquirePublicationLock(reportsDir, { recovered: true });
      }
      throw Object.assign(new Error('Another local publication holds the profile lock.'), {
        code: 'ERR_PUBLICATION_LOCKED',
        retryable: true,
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
  return lockPath;
}

function generationMatchesPrepared(generationDir, prepared) {
  try {
    return PUBLICATION_ARTIFACT_KINDS.every((kind) => {
      const descriptor = prepared.manifest.artifacts[kind];
      const artifactPath = path.join(generationDir, path.basename(descriptor.path));
      const stat = fs.lstatSync(artifactPath);
      if (!stat.isFile() || stat.isSymbolicLink()) return false;
      const buffer = fs.readFileSync(artifactPath);
      return buffer.byteLength === descriptor.bytes && sha256(buffer) === descriptor.sha256;
    });
  } catch {
    return false;
  }
}

function releasePublicationLock(lockPath) {
  try {
    fs.rmSync(lockPath, { recursive: true, force: true });
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
  return true;
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
  const lockPath = acquirePublicationLock(reportsDir);
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
    const canonicalPaths = PUBLICATION_ARTIFACT_KINDS.map((kind) => (
      path.join(reportsDir, prepared.manifest.artifacts[kind].canonicalPath)
    ));
    snapshots = snapshotFiles(canonicalPaths);
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

    const manifestPayload = Buffer.from(`${JSON.stringify(prepared.manifest, null, 2)}\n`, 'utf8');
    atomicReplaceFile(
      path.join(reportsDir, ARTIFACT_NAMES.manifestCanonical),
      manifestPayload,
      'pointer',
      options.faultInjector,
      { onRename() { pointerCommitted = true; } },
    );

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
    releasePublicationLock(lockPath);
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
  mergeLeadHistory,
  prepareLeadSnapshotRecords,
  normalizePublicationSources,
  escapeMarkdownText,
};
