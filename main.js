const path = require('path');
const crypto = require('crypto');

const { loadAgentProfile, listAgentProfiles } = require('./profile-registry');
const articleCollector = require('./orchestrator/news-orchestrator');
const leadQualifier = require('./lead-qualifier');
const leadReportPublisher = require('./lead-report-publisher');
const { createRun } = require('./lib/obs');
const {
  completePipelineRun,
  createPipelineRun,
  exitCodeForPipelineRun,
  failPipelineRun,
  transitionPipelineRun,
  writePipelineRunResult,
} = require('./pipeline-run-state');

function parseCliArgs(args = []) {
  const parsed = {
    profileId: null,
    resultFile: null,
    notificationRequested: false,
    legacyEmailRequested: false,
    attempt: null,
  };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--profile') parsed.profileId = args[++index] || null;
    else if (argument === '--result-file') parsed.resultFile = args[++index] || null;
    else if (argument === '--notification-requested') parsed.notificationRequested = true;
    else if (argument === '--email') parsed.legacyEmailRequested = true;
    else if (argument === '--attempt') parsed.attempt = Number(args[++index]);
    else {
      throw Object.assign(new Error(`Unknown argument: ${argument}`), { code: 'ERR_CLI_USAGE' });
    }
  }
  if (parsed.profileId && !/^[a-z0-9][a-z0-9-]{0,63}$/.test(parsed.profileId)) {
    throw Object.assign(new Error('Profile id is invalid.'), { code: 'ERR_CLI_USAGE' });
  }
  if (parsed.resultFile && typeof parsed.resultFile !== 'string') {
    throw Object.assign(new Error('Result file is invalid.'), { code: 'ERR_CLI_USAGE' });
  }
  return parsed;
}

function safePipelineFailure(error) {
  const code = typeof (error && error.code) === 'string' && /^ERR_[A-Z0-9_]+$/.test(error.code)
    ? error.code
    : 'ERR_PIPELINE_FAILED';
  const retryableCodes = new Set([
    'ERR_PUBLICATION_LOCKED',
    'ERR_PUBLICATION_BASE_CHANGED',
  ]);
  return {
    code,
    stage: code.startsWith('ERR_PUBLICATION_') ? 'publication' : 'pipeline',
    retryable: error && typeof error.retryable === 'boolean'
      ? error.retryable
      : retryableCodes.has(code),
    safeMessage: code.startsWith('ERR_PUBLICATION_')
      ? 'Local publication did not commit.'
      : 'Pipeline execution failed.',
  };
}

function publicationResultPath(profileId) {
  return `reports/${profileId}/${leadReportPublisher.ARTIFACT_NAMES.manifestCanonical}`;
}

async function runLeadPipeline({
  profile,
  requestId = process.env.REQUEST_ID,
  attempt = null,
  notificationRequested = false,
  resultFile = null,
  reportsRoot,
  deps = {},
} = {}) {
  if (!profile || !profile.id) {
    throw Object.assign(new Error('Pipeline profile is required.'), { code: 'ERR_PIPELINE_PROFILE_REQUIRED' });
  }
  const collector = deps.articleCollector || articleCollector;
  const qualifier = deps.leadQualifier || leadQualifier;
  const publisher = deps.publisher || leadReportPublisher;
  const clock = deps.clock || (() => new Date());
  const stateClock = () => clock();
  const runIdFactory = deps.runIdFactory || (() => crypto.randomUUID());
  const obs = deps.obs || createRun({ runId: requestId || undefined });
  const result = createPipelineRun({
    profileId: profile.id,
    requestId,
    attempt,
    notificationRequested,
    clock: stateClock,
    runIdFactory,
  });
  const persist = () => writePipelineRunResult(resultFile, result);

  obs.log('pipeline', 'info', `B2B 리드 발굴 에이전트 시작 [${profile.name}]`);
  persist();

  try {
    const tScout = obs.time('scout');
    const rawArticles = await collector.fetchIndustryNews(profile);
    tScout.end();
    result.counts.articlesCollected = Array.isArray(rawArticles) ? rawArticles.length : 0;
    obs.count('articles_raw', result.counts.articlesCollected);

    if (result.counts.articlesCollected === 0) {
      obs.log('scout', 'warn', '수집된 뉴스 없음');
      completePipelineRun(result, 'NO_ARTICLES', { clock: stateClock });
      persist();
      obs.summary();
      return result;
    }

    const tQualify = obs.time('qualify');
    const qualifiedLeads = await qualifier.qualifyLeads(rawArticles, profile);
    tQualify.end();
    result.counts.candidatesGenerated = Array.isArray(qualifiedLeads) ? qualifiedLeads.length : 0;
    obs.count('leads', result.counts.candidatesGenerated);
    transitionPipelineRun(result, 'GENERATED', { clock: stateClock });
    persist();

    if (result.counts.candidatesGenerated === 0) {
      obs.log('qualify', 'warn', '분석된 리드 없음');
      completePipelineRun(result, 'NO_CANDIDATES', { clock: stateClock });
      persist();
      obs.summary();
      return result;
    }

    const clockValue = stateClock();
    const now = clockValue instanceof Date ? clockValue.toISOString() : new Date(clockValue).toISOString();
    const prepared = publisher.prepareLeadPublication(qualifiedLeads, profile, {
      now,
      reportsRoot,
      idFactory: deps.idFactory,
    });
    result.counts.leadsValidated = prepared.validLeads.length;
    result.counts.leadsRejected = prepared.rejectedCount;
    result.counts.artifactsPrepared = prepared.artifactCount;
    transitionPipelineRun(result, 'VALIDATED', { clock: stateClock });
    persist();

    if (prepared.validLeads.length === 0) {
      result.publication.disposition = 'FAILED';
      failPipelineRun(result, {
        code: 'ERR_NO_VALID_LEADS',
        stage: 'validation',
        retryable: false,
        safeMessage: 'Generated candidates did not satisfy the public publication contract.',
        outcome: 'NO_VALID_LEADS',
      }, { clock: stateClock });
      persist();
      obs.log('validation', 'error', 'No valid public leads remained after validation.', {
        code: 'ERR_NO_VALID_LEADS',
      });
      obs.summary();
      return result;
    }

    result.publication.publicationId = prepared.publicationId;
    result.publication.inputDigest = prepared.inputDigest;
    result.publication.previousPublicationId = prepared.previousPublicationId;
    result.publication.manifestPath = publicationResultPath(profile.id);
    result.publication.artifactCount = prepared.artifactCount;

    if (prepared.noChange) {
      if (!prepared.compatibilityIntact && publisher.repairPublicationCompatibilityMirrors) {
        publisher.repairPublicationCompatibilityMirrors(profile, { reportsRoot });
      }
      result.publication.disposition = 'REUSED';
      result.publication.localCommitted = true;
      result.notification.state = notificationRequested ? 'BLOCKED' : 'NOT_REQUESTED';
      completePipelineRun(result, 'NO_CHANGE', { clock: stateClock });
      persist();
      obs.summary();
      return result;
    }

    const tBriefing = obs.time('briefing');
    const committed = publisher.commitLeadPublication(prepared, profile, {
      reportsRoot,
      faultInjector: deps.publicationFaultInjector,
    });
    tBriefing.end();
    result.publication.disposition = 'LOCAL_COMMITTED';
    result.publication.localCommitted = true;
    result.publication.artifactPaths = committed.artifactPaths;
    obs.count('report_artifacts', committed.artifactCount);

    console.log('--- 리포트 미리보기 ---\n');
    console.log(prepared.report.content);

    completePipelineRun(result, 'READY_FOR_REMOTE_PUBLICATION', { clock: stateClock });
    persist();
    obs.summary();
    return result;
  } catch (error) {
    const failure = safePipelineFailure(error);
    result.publication.disposition = result.publication.localCommitted ? 'LOCAL_COMMITTED' : 'FAILED';
    if (result.notification.requested) result.notification.state = 'BLOCKED';
    failPipelineRun(result, failure, { clock: stateClock });
    persist();
    obs.log('pipeline', 'error', failure.safeMessage, { code: failure.code });
    obs.summary();
    return result;
  }
}

function printUsage() {
  console.log('사용법: node main.js --profile <profileId> [--notification-requested] [--result-file <path>]\n');
  console.log('사용 가능한 프로필:');
  for (const profile of listAgentProfiles()) {
    console.log(`  ${profile.id} — ${profile.name} (${profile.industry})`);
  }
}

function loadCliEnvironment() {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
}

async function runCli(args = process.argv.slice(2), deps = {}) {
  let parsed;
  try {
    parsed = parseCliArgs(args);
  } catch (error) {
    console.error(error.message);
    printUsage();
    return 2;
  }
  if (!parsed.profileId) {
    printUsage();
    return 0;
  }
  if (parsed.legacyEmailRequested) {
    console.error('--email is disabled because notification requires a verified remote publication.');
    return 2;
  }

  let profile;
  try {
    profile = (deps.loadProfile || loadAgentProfile)(parsed.profileId);
  } catch {
    console.error('Requested profile could not be loaded.');
    return 2;
  }
  const result = await runLeadPipeline({
    profile,
    requestId: deps.requestId === undefined ? process.env.REQUEST_ID : deps.requestId,
    attempt: parsed.attempt,
    notificationRequested: parsed.notificationRequested,
    resultFile: parsed.resultFile,
    reportsRoot: deps.reportsRoot,
    deps,
  });
  console.log(`PIPELINE_RESULT=${JSON.stringify(result)}`);
  return exitCodeForPipelineRun(result);
}

if (require.main === module) {
  loadCliEnvironment();
  runCli().then((exitCode) => {
    process.exitCode = exitCode;
  }).catch(() => {
    process.exitCode = 1;
  });
}

module.exports = {
  parseCliArgs,
  loadCliEnvironment,
  runCli,
  runLeadPipeline,
  safePipelineFailure,
};
