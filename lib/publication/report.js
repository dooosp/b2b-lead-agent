// Deterministic Markdown formatting shared by legacy and atomic publication.
const { normalizeSnapshotText } = require('./contract');
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

module.exports = {
  escapeMarkdownText,
  composeLeadReport,
};
