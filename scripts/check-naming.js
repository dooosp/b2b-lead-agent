const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

const requiredCanonicalPaths = [
  'lead-qualifier.js',
  'lead-report-publisher.js',
  'profile-registry.js',
  'worker/pages/home-page.js',
  'worker/api/leads.js',
  'worker/api/references.js',
];

const forbiddenLegacyPaths = [
  'qualifier.js',
  'briefing.js',
  'config.js',
  'worker/pages/main.js',
  'worker/api/leads-api.js',
  'worker/api/references-api.js',
  'sources/google-news-source.js',
  'sources/korean-rss-source.js',
  'lib/news-fetcher/utils/content-scraper.js',
  'lib/news-fetcher/utils/deduplication.js',
  'lib/news-fetcher/utils/url-resolver.js',
];

const forbiddenArtifactPatterns = [
  /^latest_leads\.json$/,
  /^lead_history\.json$/,
  /^lead_report_.*\.md$/,
];

function fail(message) {
  console.error(`Naming check failed: ${message}`);
  process.exitCode = 1;
}

for (const relativePath of requiredCanonicalPaths) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    fail(`missing canonical path ${relativePath}`);
  }
}

for (const relativePath of forbiddenLegacyPaths) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (fs.existsSync(absolutePath)) {
    fail(`legacy path must be removed: ${relativePath}`);
  }
}

const workerApiDir = path.join(repoRoot, 'worker', 'api');
if (fs.existsSync(workerApiDir)) {
  for (const entry of fs.readdirSync(workerApiDir)) {
    if (!entry.endsWith('.js')) continue;
    if (!entry.endsWith('-api.js')) continue;

    const relativePath = path.posix.join('worker/api', entry);
    fail(`legacy API filename is no longer allowed: ${relativePath}`);
  }
}

const artifactPublisherPath = path.join(repoRoot, 'lead-report-publisher.js');
if (fs.existsSync(artifactPublisherPath)) {
  const publisherSource = fs.readFileSync(artifactPublisherPath, 'utf8');
  const requiredMarkers = [
    'latest-leads.json',
    'lead-history.json',
    'lead-report-',
  ];
  const forbiddenMarkers = [
    'latest_leads.json',
    'lead_history.json',
    'lead_report_',
  ];

  for (const marker of requiredMarkers) {
    if (!publisherSource.includes(marker)) {
      fail(`lead-report-publisher.js is missing canonical marker ${marker}`);
    }
  }

  for (const marker of forbiddenMarkers) {
    if (publisherSource.includes(marker)) {
      fail(`lead-report-publisher.js still includes legacy marker ${marker}`);
    }
  }
}

const reportsDir = path.join(repoRoot, 'reports');
if (fs.existsSync(reportsDir)) {
  for (const profileEntry of fs.readdirSync(reportsDir, { withFileTypes: true })) {
    if (!profileEntry.isDirectory()) continue;

    const profileDir = path.join(reportsDir, profileEntry.name);
    for (const artifactEntry of fs.readdirSync(profileDir, { withFileTypes: true })) {
      if (!artifactEntry.isFile()) continue;

      for (const pattern of forbiddenArtifactPatterns) {
        if (pattern.test(artifactEntry.name)) {
          fail(`legacy artifact must be removed: reports/${profileEntry.name}/${artifactEntry.name}`);
        }
      }
    }
  }
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log('Naming checks passed.');
