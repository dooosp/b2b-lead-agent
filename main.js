const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const scout = require('./scout');
const qualifier = require('./qualifier');
const briefing = require('./briefing');
const emailSender = require('./email-sender');

async function run() {
  const args = process.argv.slice(2);

  console.log('===========================================');
  console.log('  B2B 리드 발굴 에이전트 (Danfoss 맞춤형)');
  console.log('===========================================');

  try {
    // Step 1: Scout - 산업 뉴스 수집
    const rawNews = await scout.fetchIndustryNews();

    if (rawNews.length === 0) {
      console.log('[완료] 수집된 뉴스가 없습니다. 네트워크 연결을 확인하세요.');
      return;
    }

    // Step 2: Qualify - Gemini API로 리드 분석
    const leads = await qualifier.analyzeLeads(rawNews);

    if (leads.length === 0) {
      console.log('[완료] 분석된 리드가 없습니다.');
      return;
    }

    // Step 3: Briefing - 영업용 리포트 생성
    const report = briefing.generateReport(leads);

    // 리포트 저장
    briefing.saveReport(report);

    // 콘솔에 리포트 출력
    console.log('--- 리포트 미리보기 ---\n');
    console.log(report.content);

    // --email 옵션 시 이메일 발송
    if (args.includes('--email')) {
      await emailSender.send(report);
    }

    console.log('[완료] 파이프라인 실행 완료!');
  } catch (error) {
    console.error('[치명적 오류]', error.message);
    process.exit(1);
  }
}

run();
