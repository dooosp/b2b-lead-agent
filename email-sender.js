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
  body { font-family: 'Malgun Gothic', sans-serif; padding: 20px; color: #333; max-width: 800px; margin: 0 auto; }
  h1 { color: #c0392b; border-bottom: 2px solid #c0392b; padding-bottom: 10px; }
  h2 { margin-top: 30px; }
  h3 { margin-top: 20px; margin-bottom: 8px; }
  .grade-a { border-left: 4px solid #e74c3c; padding-left: 16px; margin: 20px 0; }
  .grade-a h2 { color: #e74c3c; }
  .grade-b { border-left: 4px solid #f39c12; padding-left: 16px; margin: 20px 0; }
  .grade-b h2 { color: #f39c12; }
  .lead-card {
    background: #f8f9fa;
    border-radius: 8px;
    padding: 16px;
    margin: 12px 0;
    border: 1px solid #e0e0e0;
  }
  .lead-card h3 { color: #2c3e50; margin-top: 0; font-size: 16px; }
  .lead-card p { margin: 6px 0; font-size: 14px; line-height: 1.6; }
  .lead-card strong { color: #555; }
  .label-roi { color: #27ae60; font-weight: bold; }
  .label-pitch { color: #2980b9; font-weight: bold; }
  .label-global { color: #8e44ad; font-weight: bold; }
  .summary { background: #f8f9fa; padding: 15px; border-radius: 5px; margin-top: 20px; }
  blockquote { color: #666; border-left: 3px solid #ccc; padding-left: 10px; margin: 8px 0; }
  hr { border: none; border-top: 1px solid #ddd; margin: 30px 0; }
</style>
</head>
<body>`;

  const lines = markdown.split('\n');
  let currentSection = '';
  let inCard = false;

  for (const line of lines) {
    if (line.startsWith('# ')) {
      html += `<h1>${line.slice(2)}</h1>`;
    } else if (line.startsWith('## Grade A')) {
      if (inCard) { html += '</div>'; inCard = false; }
      if (currentSection) html += '</div>';
      currentSection = 'grade-a';
      html += `<div class="grade-a"><h2>${line.slice(3)}</h2>`;
    } else if (line.startsWith('## Grade B')) {
      if (inCard) { html += '</div>'; inCard = false; }
      if (currentSection) html += '</div>';
      currentSection = 'grade-b';
      html += `<div class="grade-b"><h2>${line.slice(3)}</h2>`;
    } else if (line.startsWith('## ')) {
      if (inCard) { html += '</div>'; inCard = false; }
      if (currentSection) html += '</div>';
      currentSection = 'summary';
      html += `<div class="summary"><h2>${line.slice(3)}</h2>`;
    } else if (line.startsWith('### ')) {
      if (inCard) html += '</div>';
      inCard = true;
      html += `<div class="lead-card"><h3>${line.slice(4)}</h3>`;
    } else if (line.startsWith('> ')) {
      html += `<blockquote>${line.slice(2)}</blockquote>`;
    } else if (line.startsWith('- **예상 ROI:**')) {
      html += `<p><span class="label-roi">예상 ROI:</span> ${line.replace('- **예상 ROI:** ', '')}</p>`;
    } else if (line.startsWith('- **영업 Pitch:**')) {
      html += `<p><span class="label-pitch">영업 Pitch:</span> ${line.replace('- **영업 Pitch:** ', '')}</p>`;
    } else if (line.startsWith('- **글로벌 트렌드:**')) {
      html += `<p><span class="label-global">글로벌 트렌드:</span> ${line.replace('- **글로벌 트렌드:** ', '')}</p>`;
    } else if (line.startsWith('- **')) {
      html += `<p>${line.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</p>`;
    } else if (line.startsWith('- ')) {
      html += `<p>${line.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</p>`;
    } else if (line.startsWith('_') && line.endsWith('_')) {
      html += `<p><em>${line.slice(1, -1)}</em></p>`;
    } else if (line === '---') {
      if (inCard) { html += '</div>'; inCard = false; }
      html += '<hr>';
    }
  }

  if (inCard) html += '</div>';
  if (currentSection) html += '</div>';
  html += '</body></html>';
  return html;
}

module.exports = { send };
