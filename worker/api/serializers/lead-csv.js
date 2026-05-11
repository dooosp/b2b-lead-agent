const UTF8_BOM = '\uFEFF';
const LEAD_CSV_HEADER = '회사명,프로젝트,추천제품,점수,등급,ROI,상태,메모,생성일,검토상태,신뢰도,검증상태,생성모드,데이터공백';

function csvCell(value) {
  return `"${String(value || '').replace(/"/g, '""')}"`;
}

function serializeLeadCsvRow(lead) {
  return [
    csvCell(lead.company),
    csvCell(lead.summary),
    csvCell(lead.product),
    lead.score,
    lead.grade,
    csvCell(lead.roi),
    lead.status,
    csvCell(lead.notes),
    lead.createdAt?.split('T')[0] || '',
    lead.reviewStatus || 'NEEDS_REVIEW',
    lead.confidence || 'LOW',
    lead.verificationStatus || 'needs_review',
    lead.generationMode || 'llm',
    csvCell(Array.isArray(lead.dataGaps) ? lead.dataGaps.join('; ') : '')
  ].join(',');
}

export function serializeLeadsCsv(leads) {
  return `${UTF8_BOM}${LEAD_CSV_HEADER}\n${leads.map(serializeLeadCsvRow).join('\n')}`;
}

export function createLeadsCsvFilename(profileId, date = new Date()) {
  return `leads-${profileId}-${date.toISOString().split('T')[0]}.csv`;
}
