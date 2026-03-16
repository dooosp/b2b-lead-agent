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

const allowedLegacyApiWrappers = new Set([
  'worker/api/leads-api.js',
  'worker/api/references-api.js',
]);

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

const workerApiDir = path.join(repoRoot, 'worker', 'api');
if (fs.existsSync(workerApiDir)) {
  for (const entry of fs.readdirSync(workerApiDir)) {
    if (!entry.endsWith('.js')) continue;
    if (!entry.endsWith('-api.js')) continue;

    const relativePath = path.posix.join('worker/api', entry);
    if (!allowedLegacyApiWrappers.has(relativePath)) {
      fail(`unexpected legacy API filename ${relativePath}`);
    }
  }
}

const artifactPublisherPath = path.join(repoRoot, 'lead-report-publisher.js');
if (fs.existsSync(artifactPublisherPath)) {
  const publisherSource = fs.readFileSync(artifactPublisherPath, 'utf8');
  const expectedMarkers = [
    'latest-leads.json',
    'latest_leads.json',
    'lead-history.json',
    'lead_history.json',
    'lead-report-',
    'lead_report_',
  ];

  for (const marker of expectedMarkers) {
    if (!publisherSource.includes(marker)) {
      fail(`lead-report-publisher.js is missing compatibility marker ${marker}`);
    }
  }
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log('Naming checks passed.');
