const fs = require('fs');
const path = require('path');
const { computeStableLeadId } = require('./lead-identity');

const ARTIFACT_NAMES = {
  markdownCanonical: (dateStr) => `lead-report-${dateStr}.md`,
  latestCanonical: 'latest-leads.json',
  historyCanonical: 'lead-history.json',
};

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

function normalizeSnapshotUrl(value) {
  const url = normalizeSnapshotText(value);
  if (!url) return '';

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    if (parsed.username || parsed.password) return '';
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

function composeLeadReport(leads, profile, options = {}) {
  console.log('[Step 3] 영업용 리포트 생성...');

  const today = options.now ? new Date(options.now) : new Date();
  const dateStr = today.toISOString().split('T')[0];
  const dateKor = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;

  const gradeALeads = leads.filter(l => l.grade === 'A').sort((a, b) => b.score - a.score);
  const gradeBLeads = leads.filter(l => l.grade === 'B').sort((a, b) => b.score - a.score);

  let reportMarkdown = `# [${profile.name}] B2B 리드 리포트 - ${dateKor}\n\n`;
  reportMarkdown += `> 생성 시각: ${today.toLocaleString('ko-KR')}\n`;
  reportMarkdown += `> 분석 대상: ${leads.length}개 리드\n\n`;

  // Grade A
  reportMarkdown += `## Grade A - 우선 검토 후보 (${gradeALeads.length}건)\n\n`;
  if (gradeALeads.length > 0) {
    for (const lead of gradeALeads) {
      reportMarkdown += `### ${lead.company} (${lead.score}점)\n`;
      reportMarkdown += `- **프로젝트:** ${lead.summary}\n`;
      reportMarkdown += `- **추천 제품:** ${lead.product}\n`;
      reportMarkdown += `- **예상 ROI:** ${lead.roi || '-'}\n`;
      reportMarkdown += `- **영업 Pitch:** ${lead.salesPitch}\n`;
      reportMarkdown += `- **글로벌 트렌드:** ${lead.globalContext || '-'}\n`;
      if (lead.verificationStatus && lead.verificationStatus !== 'verified') {
        reportMarkdown += `- **검증 상태:** ${lead.verificationStatus} (${lead.generationMode || 'llm'})\n`;
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
      reportMarkdown += `### ${lead.company} (${lead.score}점)\n`;
      reportMarkdown += `- **프로젝트:** ${lead.summary}\n`;
      reportMarkdown += `- **추천 제품:** ${lead.product}\n`;
      reportMarkdown += `- **예상 ROI:** ${lead.roi || '-'}\n`;
      reportMarkdown += `- **영업 Pitch:** ${lead.salesPitch}\n`;
      reportMarkdown += `- **글로벌 트렌드:** ${lead.globalContext || '-'}\n`;
      if (lead.verificationStatus && lead.verificationStatus !== 'verified') {
        reportMarkdown += `- **검증 상태:** ${lead.verificationStatus} (${lead.generationMode || 'llm'})\n`;
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

function getProfileReportsDir(profile) {
  const dir = path.join(__dirname, 'reports', profile.id);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function saveLeadReport(report, profile) {
  const reportsDir = getProfileReportsDir(profile);
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
  const reportsDir = getProfileReportsDir(profile);
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

function publishLeadReport(leadReport, qualifiedLeads, profile) {
  const reportsDir = getProfileReportsDir(profile);
  const historyPath = path.join(reportsDir, ARTIFACT_NAMES.historyCanonical);
  const history = readLeadHistoryOrThrow(historyPath);
  const reportPath = saveLeadReport(leadReport, profile);
  const latestLeadsPath = saveLeadSnapshot(qualifiedLeads, profile, { history });
  return { reportsDir, reportPath, latestLeadsPath, historyPath };
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
  ARTIFACT_NAMES,
  mergeLeadHistory,
  prepareLeadSnapshotRecords,
  normalizePublicationSources,
};
