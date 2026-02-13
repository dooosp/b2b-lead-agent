const fs = require('fs');
const path = require('path');

function generateReport(leads, profile) {
  console.log('[Step 3] 영업용 리포트 생성...');

  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  const dateKor = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;

  const gradeA = leads.filter(l => l.grade === 'A').sort((a, b) => b.score - a.score);
  const gradeB = leads.filter(l => l.grade === 'B').sort((a, b) => b.score - a.score);

  let report = `# [${profile.name}] B2B 리드 리포트 - ${dateKor}\n\n`;
  report += `> 생성 시각: ${today.toLocaleString('ko-KR')}\n`;
  report += `> 분석 대상: ${leads.length}개 리드\n\n`;

  // Grade A
  report += `## Grade A - 즉시 영업 가능 (${gradeA.length}건)\n\n`;
  if (gradeA.length > 0) {
    for (const lead of gradeA) {
      report += `### ${lead.company} (${lead.score}점)\n`;
      report += `- **프로젝트:** ${lead.summary}\n`;
      report += `- **추천 제품:** ${lead.product}\n`;
      report += `- **예상 ROI:** ${lead.roi || '-'}\n`;
      report += `- **영업 Pitch:** ${lead.salesPitch}\n`;
      report += `- **글로벌 트렌드:** ${lead.globalContext || '-'}\n\n`;
    }
  } else {
    report += '_해당 없음_\n\n';
  }

  // Grade B
  report += `## Grade B - 파이프라인 관리 (${gradeB.length}건)\n\n`;
  if (gradeB.length > 0) {
    for (const lead of gradeB) {
      report += `### ${lead.company} (${lead.score}점)\n`;
      report += `- **프로젝트:** ${lead.summary}\n`;
      report += `- **추천 제품:** ${lead.product}\n`;
      report += `- **예상 ROI:** ${lead.roi || '-'}\n`;
      report += `- **영업 Pitch:** ${lead.salesPitch}\n`;
      report += `- **글로벌 트렌드:** ${lead.globalContext || '-'}\n\n`;
    }
  } else {
    report += '_해당 없음_\n\n';
  }

  // 요약
  report += '---\n\n';
  report += '## 요약\n\n';
  report += `- **Grade A (즉시 영업):** ${gradeA.length}건\n`;
  report += `- **Grade B (파이프라인):** ${gradeB.length}건\n`;
  report += `- **총 리드:** ${leads.length}건\n`;

  console.log(`  리포트 생성 완료: Grade A ${gradeA.length}건, Grade B ${gradeB.length}건\n`);

  return { content: report, dateStr };
}

function getProfileReportsDir(profile) {
  const dir = path.join(__dirname, 'reports', profile.id);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function saveReport(report, profile) {
  const reportsDir = getProfileReportsDir(profile);
  const filePath = path.join(reportsDir, `lead_report_${report.dateStr}.md`);
  fs.writeFileSync(filePath, report.content, 'utf-8');
  console.log(`  리포트 저장: ${filePath}\n`);
  return filePath;
}

// 리드 ID 생성 (기업명 + 날짜 기반)
function generateLeadId(company) {
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const slug = company.replace(/[^a-zA-Z가-힣0-9]/g, '').substring(0, 10);
  return `${slug}_${date}_${Math.random().toString(36).substring(2, 6)}`;
}

function saveLeadsJson(leads, profile) {
  const reportsDir = getProfileReportsDir(profile);
  const now = new Date().toISOString();

  // 각 리드에 ID, 상태, 생성일 추가
  const enrichedLeads = leads.map(lead => ({
    id: generateLeadId(lead.company),
    status: 'NEW',  // 신규 발굴
    createdAt: now,
    updatedAt: now,
    ...lead
  }));

  // 최신 리드 저장
  const latestPath = path.join(reportsDir, 'latest_leads.json');
  fs.writeFileSync(latestPath, JSON.stringify(enrichedLeads, null, 2), 'utf-8');
  console.log(`  리드 JSON 저장: ${latestPath}`);

  // 히스토리에 추가 (기존 데이터 유지)
  const historyPath = path.join(reportsDir, 'lead_history.json');
  let history = [];
  if (fs.existsSync(historyPath)) {
    try {
      history = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
    } catch (e) {
      history = [];
    }
  }

  // 중복 체크 (같은 기업+프로젝트는 업데이트)
  for (const newLead of enrichedLeads) {
    const existingIdx = history.findIndex(h =>
      h.company === newLead.company && h.summary === newLead.summary
    );
    if (existingIdx >= 0) {
      // 기존 리드의 상태는 유지하고 정보만 업데이트
      history[existingIdx] = {
        ...history[existingIdx],
        ...newLead,
        id: history[existingIdx].id,  // 기존 ID 유지
        status: history[existingIdx].status,  // 기존 상태 유지
        createdAt: history[existingIdx].createdAt,  // 기존 생성일 유지
        updatedAt: now
      };
    } else {
      history.push(newLead);
    }
  }

  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf-8');
  console.log(`  히스토리 저장: ${historyPath} (총 ${history.length}개 리드)\n`);

  return latestPath;
}

module.exports = { generateReport, saveReport, saveLeadsJson };
