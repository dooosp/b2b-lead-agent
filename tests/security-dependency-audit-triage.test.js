const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawnSync } = require('node:child_process');

async function loadModule() {
  return import(pathToFileURL(join(process.cwd(), 'scripts/security-dependency-audit-triage.mjs')));
}

test('security dependency audit triage reports patched axios boundary as non-production evidence', async () => {
  const { evaluateSecurityDependencyAuditTriage } = await loadModule();
  const result = evaluateSecurityDependencyAuditTriage({
    generatedAt: '2026-06-02T00:00:00.000Z',
  });

  assert.equal(result.ok, true);
  assert.equal(result.documentStatus, 'SECURITY_DEPENDENCY_AUDIT_TRIAGE_NON_PRODUCTION');
  assert.equal(result.boundary, 'NOT_PRODUCTION_EVIDENCE');
  assert.equal(result.productionReady, false);
  assert.equal(result.finding.packageName, 'axios');
  assert.equal(result.finding.directDependency, true);
  assert.equal(result.finding.prodScope, true);
  assert.equal(result.finding.devOnly, false);
  assert.equal(result.finding.lockedVersion, '1.16.0');
  assert.equal(result.finding.patchedMinimum, '1.16.0');
  assert.equal(result.decision.status, 'PASS_LOCAL_PATCHED');
  assert.deepEqual(result.blockers, []);
  assert.ok(result.reachability.affectedFiles.includes('enricher/article-content-scraper.js'));
  assert.ok(result.reachability.affectedFiles.includes('enricher/article-url-resolver.js'));
});

test('security dependency audit triage blocks vulnerable axios manifest and lock floors', async () => {
  const { evaluateSecurityDependencyAuditTriage } = await loadModule();
  const result = evaluateSecurityDependencyAuditTriage({
    generatedAt: '2026-06-02T00:00:00.000Z',
    packageJson: {
      dependencies: {
        axios: '^1.15.2',
      },
    },
    packageLock: {
      packages: {
        '': {
          dependencies: {
            axios: '^1.15.2',
          },
        },
        'node_modules/axios': {
          version: '1.15.2',
          dependencies: {
            'follow-redirects': '^1.15.11',
            'form-data': '^4.0.5',
            'proxy-from-env': '^2.1.0',
          },
        },
      },
    },
  });
  const reasons = result.blockers.map((blocker) => blocker.reason);

  assert.equal(result.ok, false);
  assert.equal(result.decision.status, 'HOLD_REQUIRES_TRIAGE');
  assert.ok(reasons.includes('axios_manifest_floor_below_patched_minimum'));
  assert.ok(reasons.includes('axios_lock_below_patched_minimum'));
});

test('security dependency audit triage CLI writes the scoped JSON artifact', () => {
  const dir = mkdtempSync(join(tmpdir(), 'security-audit-triage-'));
  const outputPath = join(dir, 'triage.json');

  try {
    const result = spawnSync(process.execPath, [
      'scripts/security-dependency-audit-triage.mjs',
      '--json',
      '--output',
      outputPath,
    ], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /SECURITY_DEPENDENCY_AUDIT_TRIAGE_NON_PRODUCTION/);

    const artifact = JSON.parse(readFileSync(outputPath, 'utf8'));
    assert.equal(artifact.boundary, 'NOT_PRODUCTION_EVIDENCE');
    assert.equal(artifact.productionReady, false);
    assert.equal(artifact.finding.lockedVersion, '1.16.0');
    assert.equal(artifact.decision.status, 'PASS_LOCAL_PATCHED');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
