const fs = require('fs');
const path = require('path');

function generateReport(leads) {
  console.log('[Step 3] 영업용 리포트 생성...');

  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  const dateKor = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;

  const gradeA = leads.filter(l => l.grade === 'A').sort((a, b) => b.score - a.score);
  const gradeB = leads.filter(l => l.grade === 'B').sort((a, b) => b.score - a.score);

  let report = `# B2B 리드 리포트 - ${dateKor}\n\n`;
  report += `> 생성 시각: ${today.toLocaleString('ko-KR')}\n`;
  report += `> 분석 대상: ${leads.length}개 리드\n\n`;

  // Grade A
  report += `## Grade A - 즉시 영업 가능 (${gradeA.length}건)\n\n`;
  if (gradeA.length > 0) {
    report += '| 기업명 | 프로젝트 | 추천 제품 | 점수 | 영업 멘트 |\n';
    report += '|--------|----------|-----------|------|----------|\n';
    for (const lead of gradeA) {
      report += `| ${lead.company} | ${lead.summary} | ${lead.product} | ${lead.score} | ${lead.salesPitch} |\n`;
    }
  } else {
    report += '_해당 없음_\n';
  }
  report += '\n';

  // Grade B
  report += `## Grade B - 파이프라인 관리 (${gradeB.length}건)\n\n`;
  if (gradeB.length > 0) {
    report += '| 기업명 | 프로젝트 | 추천 제품 | 점수 | 영업 멘트 |\n';
    report += '|--------|----------|-----------|------|----------|\n';
    for (const lead of gradeB) {
      report += `| ${lead.company} | ${lead.summary} | ${lead.product} | ${lead.score} | ${lead.salesPitch} |\n`;
    }
  } else {
    report += '_해당 없음_\n';
  }
  report += '\n';

  // 요약
  report += '---\n\n';
  report += '## 요약\n\n';
  report += `- **Grade A (즉시 영업):** ${gradeA.length}건\n`;
  report += `- **Grade B (파이프라인):** ${gradeB.length}건\n`;
  report += `- **총 리드:** ${leads.length}건\n`;

  console.log(`  리포트 생성 완료: Grade A ${gradeA.length}건, Grade B ${gradeB.length}건\n`);

  return { content: report, dateStr };
}

function saveReport(report) {
  const reportsDir = path.join(__dirname, 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const filePath = path.join(reportsDir, `lead_report_${report.dateStr}.md`);
  fs.writeFileSync(filePath, report.content, 'utf-8');
  console.log(`  리포트 저장: ${filePath}\n`);
  return filePath;
}

module.exports = { generateReport, saveReport };
