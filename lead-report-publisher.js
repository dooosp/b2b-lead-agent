const fs = require('fs');
const path = require('path');
const { computeStableLeadId } = require('./lead-identity');

const ARTIFACT_NAMES = {
  markdownCanonical: (dateStr) => `lead-report-${dateStr}.md`,
  latestCanonical: 'latest-leads.json',
  historyCanonical: 'lead-history.json',
};

function normalizeSnapshotText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeSnapshotUrl(value) {
  const url = normalizeSnapshotText(value);
  if (!url) return '';

  try {
    const parsed = new URL(url);
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return url;
  }
}

function normalizePublicationSource(source = {}) {
  const title = normalizeSnapshotText(source.title);
  const url = normalizeSnapshotUrl(source.url);
  if (!title && !url) return null;

  return {
    ...source,
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

function buildPublicationLeadBriefFields(lead = {}, { profileId = '', sources = [], dataGaps = [] } = {}) {
  const confidence = normalizePublicationConfidence(lead.confidence);
  const evidence = Array.isArray(lead.evidence) ? lead.evidence : [];
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
    profileId: normalizeSnapshotText(profileId || lead.profileId || lead.profile_id),
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

function normalizeVerificationStatus(value, { generationMode, confidence, sources, evidence } = {}) {
  const status = normalizeSnapshotText(value).toLowerCase();
  if (status === 'verified' || status === 'needs_review' || status === 'draft' || status === 'unverified') {
    return status;
  }
  if (generationMode === 'demo') return 'draft';
  if (generationMode === 'heuristic') return 'needs_review';
  const normalizedConfidence = normalizeSnapshotText(confidence).toUpperCase();
  const hasSources = Array.isArray(sources) && sources.length > 0;
  const hasEvidence = Array.isArray(evidence) && evidence.some((item) => normalizeSnapshotText(item && item.quote));
  return hasSources && hasEvidence && (normalizedConfidence === 'HIGH' || normalizedConfidence === 'MEDIUM')
    ? 'verified'
    : 'needs_review';
}

function normalizePublicationTrust(lead = {}) {
  const generationMode = normalizeGenerationMode(lead.generationMode);
  const confidence = normalizeSnapshotText(lead.confidence).toUpperCase();
  const assumptions = normalizeSnapshotStringList(lead.assumptions);
  const dataGaps = normalizeSnapshotStringList(lead.dataGaps);
  const addGap = (value) => {
    if (value && !dataGaps.includes(value)) dataGaps.push(value);
  };

  if (generationMode === 'demo') {
    throw new Error('Refusing to publish demo leads as canonical latest leads.');
  }
  if (generationMode === 'heuristic') {
    addGap('LLM lead qualification not completed');
  }
  if (!confidence) addGap('Confidence was not provided by the lead generator');
  if (confidence === 'LOW') addGap('Low-confidence public signal');
  if (!Array.isArray(lead.sources) || lead.sources.length === 0) addGap('Published source evidence missing');
  if (!Array.isArray(lead.evidence) || !lead.evidence.some((item) => normalizeSnapshotText(item && item.quote))) {
    addGap('Direct evidence quote missing');
  }

  return {
    generationMode,
    verificationStatus: normalizeVerificationStatus(lead.verificationStatus, {
      generationMode,
      confidence,
      sources: lead.sources,
      evidence: lead.evidence,
    }),
    confidence,
    confidenceReason: normalizeSnapshotText(lead.confidenceReason),
    assumptions,
    dataGaps,
  };
}

function composeLeadReport(leads, profile) {
  console.log('[Step 3] 영업용 리포트 생성...');

  const today = new Date();
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

const PROTECTED_PUBLICATION_FIELDS = [
  'notes',
  'manualReviewNotes',
  'manual_review_notes',
  'manualReviewNotesProvenance',
  'manual_review_notes_provenance',
  'manualReviewNotesAuthorLabel',
  'manual_review_notes_author_label',
  'manualReviewNotesUpdatedAt',
  'manual_review_notes_updated_at',
  'manualReviewNotesHistoryEventCount',
  'manual_review_notes_history_event_count',
  'manualReviewNotesHistoryLastEventType',
  'manual_review_notes_history_last_event_type',
  'manualReviewNotesHistoryLastEventAt',
  'manual_review_notes_history_last_event_at',
  'manualReviewNotesHistoryLastAuthorLabel',
  'manual_review_notes_history_last_author_label',
  'reviewNoteSuggestion',
  'reviewNoteTemplates',
];

function omitProtectedPublicationFields(lead) {
  const record = { ...(lead || {}) };
  for (const field of PROTECTED_PUBLICATION_FIELDS) {
    delete record[field];
  }
  return record;
}

function prepareLeadSnapshotRecords(leads, { now = new Date().toISOString(), idFactory = generateLeadId, profileId = '' } = {}) {
  return (Array.isArray(leads) ? leads : []).map(lead => {
    const publishableLead = omitProtectedPublicationFields(lead);
    const trust = normalizePublicationTrust(publishableLead);
    const sources = normalizePublicationSources(publishableLead && publishableLead.sources);
    const brief = buildPublicationLeadBriefFields({
      ...publishableLead,
      generationMode: trust.generationMode,
      verificationStatus: trust.verificationStatus,
      confidence: trust.confidence,
      assumptions: trust.assumptions,
      dataGaps: trust.dataGaps,
    }, { profileId, sources, dataGaps: trust.dataGaps });
    return {
      id: idFactory(publishableLead, { profileId }),
      status: 'NEW',
      createdAt: now,
      updatedAt: now,
      ...publishableLead,
      profileId: brief.profileId,
      signal: brief.signal,
      whyNow: brief.whyNow,
      recommendedMessage: brief.recommendedMessage,
      reviewStatus: brief.reviewStatus,
      generationMode: trust.generationMode,
      verificationStatus: trust.verificationStatus,
      confidence: brief.confidence,
      confidenceReason: trust.confidenceReason,
      assumptions: brief.assumptions,
      dataGaps: brief.dataGaps,
      sources,
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

function mergeLeadHistory(history, newLeads, { now = new Date().toISOString(), profileId = '' } = {}) {
  const nextHistory = Array.isArray(history) ? history.map(omitProtectedPublicationFields) : [];
  const preparedLeads = prepareLeadSnapshotRecords(newLeads, { now, profileId });

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

function saveLeadSnapshot(leads, profile) {
  const reportsDir = getProfileReportsDir(profile);
  const now = new Date().toISOString();

  // 각 리드에 ID, 상태, 생성일 추가
  const enrichedLeads = prepareLeadSnapshotRecords(leads, {
    now,
    profileId: profile && profile.id
  });

  // 최신 리드 저장
  const latestCanonicalPath = path.join(reportsDir, ARTIFACT_NAMES.latestCanonical);
  const latestPayload = JSON.stringify(enrichedLeads, null, 2);
  fs.writeFileSync(latestCanonicalPath, latestPayload, 'utf-8');
  console.log(`  리드 JSON 저장: ${latestCanonicalPath}`);

  // 히스토리에 추가 (기존 데이터 유지)
  const historyCanonicalPath = path.join(reportsDir, ARTIFACT_NAMES.historyCanonical);
  let history = [];
  if (fs.existsSync(historyCanonicalPath)) {
    try {
      history = JSON.parse(fs.readFileSync(historyCanonicalPath, 'utf-8'));
    } catch (e) {
      history = [];
    }
  }

  history = mergeLeadHistory(history, leads, { now, profileId: profile && profile.id });

  const historyPayload = JSON.stringify(history, null, 2);
  fs.writeFileSync(historyCanonicalPath, historyPayload, 'utf-8');
  console.log(`  히스토리 저장: ${historyCanonicalPath} (총 ${history.length}개 리드)`);
  console.log('');

  return latestCanonicalPath;
}

function publishLeadReport(leadReport, qualifiedLeads, profile) {
  const reportsDir = getProfileReportsDir(profile);
  const reportPath = saveLeadReport(leadReport, profile);
  const latestLeadsPath = saveLeadSnapshot(qualifiedLeads, profile);
  const historyPath = path.join(reportsDir, ARTIFACT_NAMES.historyCanonical);
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
