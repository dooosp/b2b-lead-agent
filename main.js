const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { loadProfile, listProfiles } = require('./config');
const scout = require('./scout');
const qualifier = require('./qualifier');
const briefing = require('./briefing');
const emailSender = require('./email-sender');
const { createRun } = require('./lib/obs');

async function run() {
  const args = process.argv.slice(2);

  // --profile 플래그 파싱
  const profileIdx = args.indexOf('--profile');
  const profileId = profileIdx >= 0 ? args[profileIdx + 1] : null;

  if (!profileId) {
    console.log('사용법: node main.js --profile <profileId> [--email]\n');
    console.log('사용 가능한 프로필:');
    for (const p of listProfiles()) {
      console.log(`  ${p.id} — ${p.name} (${p.industry})`);
    }
    process.exit(0);
  }

  const profile = loadProfile(profileId);
  const obs = createRun();

  obs.log('pipeline', 'info', `B2B 리드 발굴 에이전트 시작 [${profile.name}]`);

  try {
    // Step 1: Scout - 산업 뉴스 수집
    const tScout = obs.time('scout');
    const rawNews = await scout.fetchIndustryNews(profile);
    tScout.end();
    obs.count('articles_raw', rawNews.length);

    if (rawNews.length === 0) {
      obs.log('scout', 'warn', '수집된 뉴스 없음');
      return;
    }

    // Step 2: Qualify - Gemini API로 리드 분석
    const tQualify = obs.time('qualify');
    const leads = await qualifier.analyzeLeads(rawNews, profile);
    tQualify.end();
    obs.count('leads', leads.length);

    if (leads.length === 0) {
      obs.log('qualify', 'warn', '분석된 리드 없음');
      return;
    }

    // Step 3: Briefing - 영업용 리포트 생성
    const tBriefing = obs.time('briefing');
    const report = briefing.generateReport(leads, profile);
    briefing.saveReport(report, profile);
    briefing.saveLeadsJson(leads, profile);
    tBriefing.end();

    // 콘솔에 리포트 출력
    console.log('--- 리포트 미리보기 ---\n');
    console.log(report.content);

    // --email 옵션 시 이메일 발송
    if (args.includes('--email')) {
      const tEmail = obs.time('email');
      await emailSender.send(report, profile);
      tEmail.end();
    }

    obs.summary();
  } catch (error) {
    obs.logError('pipeline', error);
    process.exit(1);
  }
}

run();
