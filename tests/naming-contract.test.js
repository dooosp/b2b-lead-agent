const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('naming gate checks modular public contracts and refuses legacy artifact names', (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'b2b-naming-contract-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const write = (filename, text) => {
    const target = path.join(directory, filename);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, text);
  };
  for (const filename of [
    'lead-qualifier.js', 'profile-registry.js', 'worker/pages/home-page.js',
    'worker/api/leads.js', 'worker/api/references.js',
  ]) write(filename, '');
  write('scripts/check-naming.js', '');
  copyFileSync(path.join(__dirname, '../scripts/check-naming.js'), path.join(directory, 'scripts/check-naming.js'));
  write('lead-report-publisher.js', "module.exports = require('./lib/publication/contract');\n");
  const contract = (latest = 'latest-leads.json') => [
    '// latest-leads.json is the documented name, not proof of the exported value.',
    'module.exports.ARTIFACT_NAMES = {',
    'latestCanonical: ' + JSON.stringify(latest) + ',',
    "historyCanonical: 'lead-history.json',",
    "manifestCanonical: 'publication-manifest.json',",
    "markdownCanonical: date => 'lead-report-' + date + '.md'",
    '};',
  ].join('\n');
  const check = () => spawnSync(process.execPath, ['scripts/check-naming.js'], {
    cwd: directory, encoding: 'utf8',
  });

  write('lib/publication/contract.js', contract());
  assert.equal(check().status, 0, 'valid names may live in a separate module');

  write('lib/publication/contract.js', contract('renamed-latest.json'));
  const renamed = check();
  assert.equal(renamed.status, 1);
  assert.match(renamed.stderr, /must use latest-leads\.json/);

  write('lib/publication/contract.js', contract());
  write('lib/publication/store.js', "const forbidden = 'latest_leads.json';\n");
  const legacy = check();
  assert.equal(legacy.status, 1);
  assert.match(legacy.stderr, /legacy marker latest_leads\.json/);
});
