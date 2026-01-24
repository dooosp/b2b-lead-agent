const nodemailer = require('nodemailer');

async function send(report) {
  console.log('[이메일] 리포트 발송 시작...');

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS
    }
  });

  const today = new Date();
  const dateKor = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;

  const htmlContent = convertToHtml(report.content);

  const mailOptions = {
    from: `B2B Lead Agent <${process.env.GMAIL_USER}>`,
    to: process.env.GMAIL_RECIPIENT,
    subject: `[B2B 리드] Danfoss 영업 기회 리포트 - ${dateKor}`,
    html: htmlContent
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`  이메일 발송 완료: ${info.messageId}\n`);
  } catch (error) {
    console.error('  [오류] 이메일 발송 실패:', error.message);
  }
}

function convertToHtml(markdown) {
  let html = `
<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: 'Malgun Gothic', sans-serif; padding: 20px; color: #333; }
  h1 { color: #c0392b; border-bottom: 2px solid #c0392b; padding-bottom: 10px; }
  h2 { margin-top: 30px; }
  table { border-collapse: collapse; width: 100%; margin: 15px 0; }
  th, td { border: 1px solid #ddd; padding: 10px; text-align: left; font-size: 14px; }
  th { background-color: #f5f5f5; font-weight: bold; }
  .grade-a { border-left: 4px solid #e74c3c; }
  .grade-a h2 { color: #e74c3c; }
  .grade-b { border-left: 4px solid #f39c12; }
  .grade-b h2 { color: #f39c12; }
  .summary { background: #f8f9fa; padding: 15px; border-radius: 5px; margin-top: 20px; }
  blockquote { color: #666; border-left: 3px solid #ccc; padding-left: 10px; }
</style>
</head>
<body>`;

  // 간단한 마크다운 → HTML 변환
  const lines = markdown.split('\n');
  let inTable = false;
  let isGradeA = false;

  for (const line of lines) {
    if (line.startsWith('# ')) {
      html += `<h1>${line.slice(2)}</h1>`;
    } else if (line.startsWith('## Grade A')) {
      isGradeA = true;
      html += `<div class="grade-a"><h2>${line.slice(3)}</h2>`;
    } else if (line.startsWith('## Grade B')) {
      if (isGradeA) html += '</div>';
      isGradeA = false;
      html += `<div class="grade-b"><h2>${line.slice(3)}</h2>`;
    } else if (line.startsWith('## ')) {
      if (!isGradeA) html += '</div>';
      html += `<div class="summary"><h2>${line.slice(3)}</h2>`;
    } else if (line.startsWith('> ')) {
      html += `<blockquote>${line.slice(2)}</blockquote>`;
    } else if (line.startsWith('|') && !line.includes('---')) {
      if (!inTable) {
        html += '<table>';
        inTable = true;
        const cells = line.split('|').filter(c => c.trim());
        html += '<tr>' + cells.map(c => `<th>${c.trim()}</th>`).join('') + '</tr>';
      } else {
        const cells = line.split('|').filter(c => c.trim());
        html += '<tr>' + cells.map(c => `<td>${c.trim()}</td>`).join('') + '</tr>';
      }
    } else if (line.startsWith('- ')) {
      html += `<p>${line.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</p>`;
    } else if (line.startsWith('_') && line.endsWith('_')) {
      html += `<p><em>${line.slice(1, -1)}</em></p>`;
    } else if (line === '---') {
      if (inTable) { html += '</table>'; inTable = false; }
      html += '<hr>';
    } else if (line.trim() === '') {
      if (inTable) { html += '</table>'; inTable = false; }
    }
  }

  if (inTable) html += '</table>';
  html += '</div></body></html>';
  return html;
}

module.exports = { send };
