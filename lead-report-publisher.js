const fs = require('fs');
const path = require('path');
const { formatDateStamp, formatKoreanDate, formatKoreanDateTime } = require('./lib/date-utils');
const { buildLeadFingerprint, mergeLeadRecord, normalizeLeadRecord } = require('./lib/lead-records');
const { publishStorageMirrors } = require('./lib/storage/publisher-storage');
const LEAD_REPORT_PUBLISHER_DEBUG = process.env.LEAD_REPORT_PUBLISHER_DEBUG === '1';
const VALID_CONFIDENCE = new Set(['HIGH', 'MEDIUM', 'LOW']);

function createPublisherLogger(logger = console) {
  return {
    info(message) {
      (logger.log || logger.info || console.log)(message);
    },
    warn(message) {
      (logger.warn || console.warn)(message);
    },
    debug(message) {
      if (LEAD_REPORT_PUBLISHER_DEBUG) {
        (logger.log || logger.info || console.log)(message);
      }
    },
  };
}

function sortLeadsByScore(leads, grade) {
  return leads
    .filter((lead) => lead.grade === grade)
    .sort((left, right) => right.score - left.score);
}

function formatReportTimeSlug(date = new Date()) {
  return [
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
    String(date.getSeconds()).padStart(2, '0'),
  ].join('');
}

function splitLeadsByGrade(leads) {
  const gradeALeads = sortLeadsByScore(leads, 'A');
  const gradeBLeads = sortLeadsByScore(leads, 'B');
  const otherLeads = leads
    .filter((lead) => lead.grade !== 'A' && lead.grade !== 'B')
    .sort((left, right) => right.score - left.score);

  return {
    gradeALeads,
    gradeBLeads,
    otherLeads,
  };
}

function countLeadsByGrade(leads) {
  return leads.reduce((counts, lead) => {
    counts.total += 1;
    if (lead.grade === 'A') {
      counts.gradeA += 1;
    } else if (lead.grade === 'B') {
      counts.gradeB += 1;
    } else {
      counts.other += 1;
    }

    return counts;
  }, {
    total: 0,
    gradeA: 0,
    gradeB: 0,
    other: 0,
  });
}

function normalizeVisibleText(value, fallback = '-') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function normalizeFirstSource(sources) {
  if (!Array.isArray(sources)) {
    return null;
  }

  for (const source of sources) {
    if (!source || typeof source !== 'object') {
      continue;
    }

    const title = typeof source.title === 'string' ? source.title.trim() : '';
    const url = typeof source.url === 'string' ? source.url.trim() : '';
    if (!title && !url) {
      continue;
    }

    return {
      title: title || url,
      url,
    };
  }

  return null;
}

function formatFirstSourceForMarkdown(source) {
  if (!source) {
    return '-';
  }

  return source.url ? `${source.title} (${source.url})` : source.title;
}

function normalizeLeadForReport(lead = {}) {
  const snapshotLead = normalizeLeadRecord(lead);
  const normalizedCompany = typeof snapshotLead.company === 'string' && snapshotLead.company.trim()
    ? snapshotLead.company.trim()
    : '미상';
  const confidenceReasonFromCamel = typeof lead.confidenceReason === 'string' && lead.confidenceReason.trim()
    ? lead.confidenceReason.trim()
    : '';
  const confidenceReasonFromSnake = typeof lead.confidence_reason === 'string' && lead.confidence_reason.trim()
    ? lead.confidence_reason.trim()
    : '';
  const normalizedScore = Number(lead.score);
  const firstSource = normalizeFirstSource(snapshotLead.sources);

  return {
    ...snapshotLead,
    company: normalizedCompany,
    summary: normalizeVisibleText(lead.summary),
    product: normalizeVisibleText(lead.product),
    score: Number.isFinite(normalizedScore) ? Math.max(0, Math.min(normalizedScore, 100)) : 0,
    grade: lead.grade === 'A' ? 'A' : lead.grade === 'B' ? 'B' : lead.grade,
    roi: normalizeVisibleText(lead.roi),
    salesPitch: normalizeVisibleText(lead.salesPitch),
    globalContext: normalizeVisibleText(lead.globalContext),
    confidence: VALID_CONFIDENCE.has(lead.confidence) ? lead.confidence : '',
    confidenceReason: confidenceReasonFromCamel || confidenceReasonFromSnake,
    firstSource,
    _reportDiagnostics: {
      companyFallback: normalizedCompany === '미상' && (!lead.company || typeof lead.company !== 'string' || !lead.company.trim()),
      summaryFallback: normalizeVisibleText(lead.summary) === '-',
      productFallback: normalizeVisibleText(lead.product) === '-',
      salesPitchFallback: normalizeVisibleText(lead.salesPitch) === '-',
      scoreFallback: !Number.isFinite(normalizedScore),
      confidenceReasonSnakeCase: !confidenceReasonFromCamel && Boolean(confidenceReasonFromSnake),
    },
  };
}

function normalizeLeadsForReport(leads) {
  const diagnostics = {
    companyFallbacks: 0,
    summaryFallbacks: 0,
    productFallbacks: 0,
    salesPitchFallbacks: 0,
    scoreFallbacks: 0,
    confidenceReasonSnakeCase: 0,
  };

  const normalizedLeads = (Array.isArray(leads) ? leads : []).map((lead) => {
    const normalizedLead = normalizeLeadForReport(lead);
    const reportDiagnostics = normalizedLead._reportDiagnostics || {};

    if (reportDiagnostics.companyFallback) diagnostics.companyFallbacks += 1;
    if (reportDiagnostics.summaryFallback) diagnostics.summaryFallbacks += 1;
    if (reportDiagnostics.productFallback) diagnostics.productFallbacks += 1;
    if (reportDiagnostics.salesPitchFallback) diagnostics.salesPitchFallbacks += 1;
    if (reportDiagnostics.scoreFallback) diagnostics.scoreFallbacks += 1;
    if (reportDiagnostics.confidenceReasonSnakeCase) diagnostics.confidenceReasonSnakeCase += 1;

    delete normalizedLead._reportDiagnostics;
    return normalizedLead;
  });

  return {
    normalizedLeads,
    diagnostics,
  };
}

function warnOnVisibleFieldDrift(diagnostics, logger) {
  if (!diagnostics) {
    return;
  }

  const fallbackParts = [];
  if (diagnostics.companyFallbacks > 0) fallbackParts.push(`company=${diagnostics.companyFallbacks}`);
  if (diagnostics.summaryFallbacks > 0) fallbackParts.push(`summary=${diagnostics.summaryFallbacks}`);
  if (diagnostics.productFallbacks > 0) fallbackParts.push(`product=${diagnostics.productFallbacks}`);
  if (diagnostics.salesPitchFallbacks > 0) fallbackParts.push(`salesPitch=${diagnostics.salesPitchFallbacks}`);
  if (diagnostics.scoreFallbacks > 0) fallbackParts.push(`score=${diagnostics.scoreFallbacks}`);

  if (fallbackParts.length > 0) {
    logger.warn(`  [Role 5] visible publish fallbacks applied: ${fallbackParts.join(', ')}`);
  }

  if (diagnostics.confidenceReasonSnakeCase > 0) {
    logger.warn(
      `  [Role 5] confidence_reason detected on ${diagnostics.confidenceReasonSnakeCase} lead(s); mapped to confidenceReason for report compatibility.`
    );
  }
}

function renderLeadSection(title, leads) {
  let markdown = `## ${title} (${leads.length}건)\n\n`;

  if (leads.length === 0) {
    return `${markdown}_해당 없음_\n\n`;
  }

  for (const lead of leads) {
    markdown += `### ${lead.company} (${lead.score}점)\n`;
    markdown += `- **프로젝트:** ${lead.summary}\n`;
    markdown += `- **추천 제품:** ${lead.product}\n`;
    markdown += `- **예상 ROI:** ${lead.roi || '-'}\n`;
    markdown += `- **영업 Pitch:** ${lead.salesPitch}\n`;
    markdown += `- **글로벌 트렌드:** ${lead.globalContext || '-'}\n`;
    markdown += `- **신뢰도:** ${lead.confidence || '-'}\n`;
    markdown += `- **신뢰도 근거:** ${lead.confidenceReason || '-'}\n`;
    markdown += `- **대표 출처:** ${formatFirstSourceForMarkdown(lead.firstSource)}\n\n`;
  }

  return markdown;
}

function composeLeadReport(leads, profile, options = {}) {
  const logger = createPublisherLogger(options.logger);
  logger.info('[Report Publishing] 리드 리포트 생성...');

  const now = options.now || new Date();
  const dateStr = formatDateStamp(now);
  const dateKor = formatKoreanDate(now);
  const createdAt = formatKoreanDateTime(now);
  const generatedAtIso = now.toISOString();
  const timeSlug = formatReportTimeSlug(now);
  const { normalizedLeads, diagnostics } = normalizeLeadsForReport(leads);
  warnOnVisibleFieldDrift(diagnostics, logger);
  const { gradeALeads, gradeBLeads, otherLeads } = splitLeadsByGrade(normalizedLeads);

  let reportMarkdown = `# [${profile.name}] B2B 리드 리포트 - ${dateKor}\n\n`;
  reportMarkdown += `> 생성 시각: ${createdAt}\n`;
  reportMarkdown += `> 분석 대상: ${normalizedLeads.length}개 리드\n\n`;
  reportMarkdown += renderLeadSection('Grade A - 즉시 영업 가능', gradeALeads);
  reportMarkdown += renderLeadSection('Grade B - 파이프라인 관리', gradeBLeads);
  reportMarkdown += renderLeadSection('기타 - 검토 필요', otherLeads);
  reportMarkdown += '---\n\n';
  reportMarkdown += '## 요약\n\n';
  reportMarkdown += `- **Grade A (즉시 영업):** ${gradeALeads.length}건\n`;
  reportMarkdown += `- **Grade B (파이프라인):** ${gradeBLeads.length}건\n`;
  reportMarkdown += `- **기타 리드:** ${otherLeads.length}건\n`;
  reportMarkdown += `- **총 리드:** ${normalizedLeads.length}건\n`;

  logger.info(`  리포트 생성 완료: Grade A ${gradeALeads.length}건, Grade B ${gradeBLeads.length}건, 기타 ${otherLeads.length}건\n`);
  logger.debug(`  [leadReportPublisher:debug] composeCounts=${JSON.stringify({
    total: normalizedLeads.length,
    gradeA: gradeALeads.length,
    gradeB: gradeBLeads.length,
    other: otherLeads.length,
    companies: normalizedLeads.map((lead) => lead.company),
  })}`);

  return {
    content: reportMarkdown,
    createdAt,
    dateStr,
    generatedAtIso,
    timeSlug,
    counts: {
      total: normalizedLeads.length,
      gradeA: gradeALeads.length,
      gradeB: gradeBLeads.length,
      other: otherLeads.length,
    },
  };
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function readJsonFile(filePath, fallbackValue) {
  if (!fs.existsSync(filePath)) {
    return fallbackValue;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (error) {
    const parseError = new Error(`JSON 파싱 실패: ${filePath} (${error.message})`);
    parseError.cause = error;
    throw parseError;
  }
}

function writeJsonFile(filePath, value) {
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tempPath, JSON.stringify(value, null, 2), 'utf-8');
  fs.renameSync(tempPath, filePath);
}

function getProfileReportsDir(profile) {
  const dir = path.join(__dirname, 'reports', profile.id);
  ensureDir(dir);
  return dir;
}

function resolveReportFilePath(report, profile) {
  const reportsDir = getProfileReportsDir(profile);
  const baseFileName = `lead_report_${report.dateStr}.md`;
  const baseFilePath = path.join(reportsDir, baseFileName);

  if (!fs.existsSync(baseFilePath)) {
    return baseFilePath;
  }

  const existingContent = fs.readFileSync(baseFilePath, 'utf-8');
  if (existingContent === report.content) {
    return baseFilePath;
  }

  const generatedAt = report.generatedAtIso ? new Date(report.generatedAtIso) : new Date();
  const suffix = report.timeSlug || formatReportTimeSlug(generatedAt);
  return path.join(reportsDir, `lead_report_${report.dateStr}_${suffix}.md`);
}

function saveLeadReport(report, profile, options = {}) {
  const logger = createPublisherLogger(options.logger);
  const filePath = resolveReportFilePath(report, profile);
  fs.writeFileSync(filePath, report.content, 'utf-8');
  logger.info(`  리포트 저장: ${filePath}\n`);
  logger.debug(`  [leadReportPublisher:debug] reportMeta=${JSON.stringify({
    dateStr: report.dateStr,
    generatedAtIso: report.generatedAtIso,
    timeSlug: report.timeSlug,
    counts: report.counts,
  })}`);
  return filePath;
}

function buildLeadSnapshot(leads, nowIso) {
  return leads.map((lead) => normalizeLeadRecord(lead, nowIso));
}

function getLeadHistoryKey(lead) {
  return lead.dedupeKey || buildLeadFingerprint(lead) || lead.id;
}

function mergeLeadHistory(history, incomingLeads, nowIso) {
  const historyByKey = new Map(
    history.map((lead) => [getLeadHistoryKey(lead), lead])
  );

  for (const lead of incomingLeads) {
    const key = getLeadHistoryKey(lead);
    const existingLead = historyByKey.get(key);
    historyByKey.set(key, mergeLeadRecord(existingLead, lead, nowIso));
  }

  return [...historyByKey.values()].sort((left, right) => {
    return String(right.updatedAt || '').localeCompare(String(left.updatedAt || ''));
  });
}

function backupCorruptedFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const backupPath = `${filePath}.corrupt-${Date.now()}`;
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

function persistLeadSnapshot(leads, profile, options = {}) {
  const logger = createPublisherLogger(options.logger);
  const reportsDir = getProfileReportsDir(profile);
  const now = options.now || new Date();
  const nowIso = now.toISOString();
  const normalizedLeads = buildLeadSnapshot(leads, nowIso);

  const historyPath = path.join(reportsDir, 'lead_history.json');
  let history = [];
  try {
    history = readJsonFile(historyPath, []);
    if (!Array.isArray(history)) {
      const backupPath = backupCorruptedFile(historyPath);
      logger.warn(
        backupPath
          ? `  히스토리 형식 오류: ${historyPath} 배열이 아니어서 빈 이력으로 재시작합니다. 손상 파일 백업: ${backupPath}`
          : `  히스토리 형식 오류: ${historyPath} 배열이 아니어서 빈 이력으로 재시작합니다.`
      );
      history = [];
    }
  } catch (error) {
    const backupPath = backupCorruptedFile(historyPath);
    const message = backupPath
      ? `${error.message}. 손상 파일 백업: ${backupPath}`
      : error.message;
    throw new Error(message);
  }

  const mergedHistory = mergeLeadHistory(history, normalizedLeads, nowIso);

  const latestPath = path.join(reportsDir, 'latest_leads.json');
  writeJsonFile(latestPath, normalizedLeads);
  logger.info(`  리드 JSON 저장: ${latestPath}`);

  writeJsonFile(historyPath, mergedHistory);
  logger.info(`  히스토리 저장: ${historyPath} (총 ${mergedHistory.length}개 리드)\n`);
  logger.debug(`  [leadReportPublisher:debug] snapshot=${JSON.stringify({
    latestPath,
    historyPath,
    latestCount: normalizedLeads.length,
    historyCount: mergedHistory.length,
    leadKeys: normalizedLeads.map((lead) => ({ company: lead.company, key: getLeadHistoryKey(lead) })),
  })}`);

  return {
    reportsDir,
    latestPath,
    historyPath,
    normalizedLeads,
    mergedHistory,
    nowIso,
  };
}

function saveLeadSnapshot(leads, profile, options = {}) {
  return persistLeadSnapshot(leads, profile, options).latestPath;
}

function toArtifactRemotePath(filePath) {
  return path.relative(__dirname, filePath).split(path.sep).join('/');
}

function buildPublishedArtifacts({ reportPath, latestLeadsPath, historyPath }) {
  return [
    {
      kind: 'report',
      localPath: reportPath,
      remotePath: toArtifactRemotePath(reportPath),
      contentType: 'text/markdown; charset=utf-8',
    },
    {
      kind: 'latest_leads',
      localPath: latestLeadsPath,
      remotePath: toArtifactRemotePath(latestLeadsPath),
      contentType: 'application/json; charset=utf-8',
    },
    {
      kind: 'lead_history',
      localPath: historyPath,
      remotePath: toArtifactRemotePath(historyPath),
      contentType: 'application/json; charset=utf-8',
    },
  ];
}

function assertPublishConsistency(leadReport, qualifiedLeads) {
  if (!leadReport || typeof leadReport.content !== 'string') {
    throw new Error('리드 리포트 형식이 올바르지 않아 발행을 중단합니다.');
  }

  if (!leadReport.counts || typeof leadReport.counts !== 'object') {
    return;
  }

  const actualCounts = countLeadsByGrade(Array.isArray(qualifiedLeads) ? qualifiedLeads : []);
  const expectedCounts = leadReport.counts;
  const mismatches = ['total', 'gradeA', 'gradeB', 'other']
    .filter((key) => Number(expectedCounts[key]) !== actualCounts[key])
    .map((key) => `${key}: report=${expectedCounts[key]} actual=${actualCounts[key]}`);

  if (mismatches.length > 0) {
    throw new Error(`리드 리포트/발행 대상 불일치로 발행을 중단합니다. ${mismatches.join(', ')}`);
  }
}

async function publishLeadReport(leadReport, qualifiedLeads, profile, options = {}) {
  const logger = createPublisherLogger(options.logger);
  assertPublishConsistency(leadReport, qualifiedLeads);

  const snapshotArtifacts = persistLeadSnapshot(qualifiedLeads, profile, options);
  const reportPath = saveLeadReport(leadReport, profile, options);
  const { reportsDir, latestPath: latestLeadsPath, historyPath } = snapshotArtifacts;
  await publishStorageMirrors({
    profile,
    artifacts: buildPublishedArtifacts({ reportPath, latestLeadsPath, historyPath }),
    latestLeads: snapshotArtifacts.normalizedLeads,
    leadHistory: snapshotArtifacts.mergedHistory,
    nowIso: snapshotArtifacts.nowIso,
    artifactPaths: {
      reportPath,
      latestLeadsPath,
      historyPath,
    },
  }, options);

  logger.debug(`  [leadReportPublisher:debug] publishPaths=${JSON.stringify({
    reportsDir,
    reportPath,
    latestLeadsPath,
    historyPath,
  })}`);

  return {
    reportsDir,
    reportPath,
    latestLeadsPath,
    historyPath,
  };
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
};
