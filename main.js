const { loadRuntimeEnv } = require('./runtime/env');
loadRuntimeEnv({ appRoot: __dirname });

const { loadProfile, listProfiles } = require('./profile-registry');
const articleCollector = require('./orchestrator/news-orchestrator');
const leadQualifier = require('./lead-qualifier');
const leadReportPublisher = require('./lead-report-publisher');
const emailSender = require('./email-sender');
const { createRun } = require('./lib/obs');

function parseCliArgs(argv = []) {
  const options = {
    email: false,
    help: false,
    profileId: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--profile') {
      options.profileId = argv[index + 1] || null;
      index += 1;
      continue;
    }

    if (arg === '--email') {
      options.email = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    throw new Error(`알 수 없는 옵션입니다: ${arg}`);
  }

  if (!options.help && !options.profileId) {
    options.help = true;
  }

  return options;
}

function printUsage() {
  console.log('사용법: node main.js --profile <profileId> [--email]\n');
  console.log('사용 가능한 프로필:');
  for (const profile of listProfiles()) {
    console.log(`  ${profile.id} — ${profile.name} (${profile.industry})`);
  }
}

function assertCollectorService(collector) {
  if (!collector || typeof collector.fetchIndustryNews !== 'function') {
    throw new Error('Role 3 collector must implement fetchIndustryNews(profile).');
  }
}

function assertCollectedArticles(rawArticles) {
  if (!Array.isArray(rawArticles)) {
    throw new Error('Role 3 collector must return an array of raw article objects.');
  }

  return rawArticles;
}

async function runPipeline({ profileId, sendEmail = false, services = {} }) {
  const obs = createRun();
  // Step 1: Profile Load
  const tProfileLoad = obs.time('profile_load');
  const profile = loadProfile(profileId);
  tProfileLoad.end();
  const collector = services.articleCollector || articleCollector;
  const qualifier = services.leadQualifier || leadQualifier;
  const reportPublisher = services.leadReportPublisher || leadReportPublisher;
  const mailer = services.emailSender || emailSender;
  assertCollectorService(collector);

  obs.log('pipeline', 'info', `B2B 리드 발굴 에이전트 시작 [${profile.name}]`);

  // Step 2: Article Collection
  const tArticleCollection = obs.time('article_collection');
  const rawArticles = assertCollectedArticles(await collector.fetchIndustryNews(profile));
  tArticleCollection.end();
  obs.count('articles_raw', rawArticles.length);

  if (rawArticles.length === 0) {
    obs.log('article_collection', 'warn', '수집된 뉴스 없음');
    return { profile, rawArticles, qualifiedLeads: [], leadReport: null, reportArtifacts: null };
  }

  // Step 3: Lead Qualification
  const tLeadQualification = obs.time('lead_qualification');
  const qualifiedLeads = await qualifier.qualifyLeads(rawArticles, profile);
  tLeadQualification.end();
  obs.count('leads', qualifiedLeads.length);

  if (qualifiedLeads.length === 0) {
    obs.log('lead_qualification', 'warn', '분석된 리드 없음');
    return { profile, rawArticles, qualifiedLeads, leadReport: null, reportArtifacts: null };
  }

  // Step 4: Report Publishing
  const tReportPublishing = obs.time('report_publishing');
  const leadReport = reportPublisher.composeLeadReport(qualifiedLeads, profile);
  const reportArtifacts = await reportPublisher.publishLeadReport(leadReport, qualifiedLeads, profile);
  tReportPublishing.end();
  obs.count('report_artifacts', Object.keys(reportArtifacts).length);

  // 콘솔에 리포트 출력
  console.log('--- 리포트 미리보기 ---\n');
  console.log(leadReport.content);

  // --email 옵션 시 이메일 발송
  if (sendEmail) {
    const tEmail = obs.time('email');
    await mailer.send(leadReport, profile);
    tEmail.end();
  }

  obs.summary();
  return { profile, rawArticles, qualifiedLeads, leadReport, reportArtifacts };
}

async function main(argv = process.argv.slice(2)) {
  try {
    const options = parseCliArgs(argv);

    if (options.help) {
      printUsage();
      return 0;
    }

    await runPipeline({
      profileId: options.profileId,
      sendEmail: options.email,
    });
    return 0;
  } catch (error) {
    const obs = createRun();
    obs.logError('pipeline', error);
    return 1;
  }
}

if (require.main === module) {
  main().then((exitCode) => {
    process.exitCode = exitCode;
  });
}

module.exports = {
  assertCollectedArticles,
  assertCollectorService,
  main,
  parseCliArgs,
  printUsage,
  runPipeline,
};
