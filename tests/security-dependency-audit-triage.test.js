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
  const { compareVersions, evaluateSecurityDependencyAuditTriage } = await loadModule();
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
  assert.equal(result.finding.manifestMinimum, '1.18.0');
  assert.equal(result.finding.patchedMinimum, '1.18.0');
  assert.ok(compareVersions(result.finding.lockedVersion, result.finding.patchedMinimum) >= 0);
  assert.ok(result.finding.advisories.some((advisory) =>
    advisory.url === 'https://github.com/advisories/GHSA-gcfj-64vw-6mp9'
      && advisory.severity === 'high'
      && advisory.range === '>=1.15.2 <1.18.0'));
  assert.equal(result.decision.status, 'PASS_LOCAL_PATCHED');
  assert.equal(result.decision.action, 'PATCHED_WITH_SCOPED_AXIOS_1_18_0_UPDATE');
  assert.match(result.decision.followUp, /check:enrichment-boundary/);
  assert.deepEqual(result.blockers, []);
  assert.ok(result.reachability.affectedFiles.includes('enricher/outbound-http-boundary.js'));
  assert.ok(result.reachability.affectedFiles.includes('enricher/article-content-scraper.js'));
  assert.ok(result.reachability.affectedFiles.includes('enricher/article-url-resolver.js'));
});

test('security dependency audit triage accepts the patched axios 1.18 floor', async () => {
  const { evaluateSecurityDependencyAuditTriage } = await loadModule();
  const result = evaluateSecurityDependencyAuditTriage({
    generatedAt: '2026-06-02T00:00:00.000Z',
    packageJson: {
      dependencies: {
        axios: '^1.18.0',
      },
    },
    packageLock: {
      packages: {
        '': {
          dependencies: {
            axios: '^1.18.0',
          },
        },
        'node_modules/axios': {
          version: '1.18.0',
          dependencies: {
            'follow-redirects': '^1.16.0',
            'form-data': '^4.0.5',
            'https-proxy-agent': '^5.0.1',
            'proxy-from-env': '^2.1.0',
          },
        },
      },
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.finding.manifestMinimum, '1.18.0');
  assert.equal(result.finding.lockedVersion, '1.18.0');
  assert.equal(result.finding.patchedMinimum, '1.18.0');
  assert.deepEqual(result.blockers, []);
});

test('security dependency audit triage blocks the previously accepted vulnerable axios 1.16 floor', async () => {
  const { evaluateSecurityDependencyAuditTriage } = await loadModule();
  const result = evaluateSecurityDependencyAuditTriage({
    generatedAt: '2026-06-02T00:00:00.000Z',
    packageJson: {
      dependencies: {
        axios: '^1.16.0',
      },
    },
    packageLock: {
      packages: {
        '': {
          dependencies: {
            axios: '^1.16.0',
          },
        },
        'node_modules/axios': {
          version: '1.16.0',
          dependencies: {
            'follow-redirects': '^1.16.0',
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
  assert.equal(result.finding.manifestMinimum, '1.16.0');
  assert.equal(result.finding.lockedVersion, '1.16.0');
  assert.equal(result.finding.patchedMinimum, '1.18.0');
  assert.ok(reasons.includes('axios_manifest_floor_below_patched_minimum'));
  assert.ok(reasons.includes('axios_lock_below_patched_minimum'));
});

test('security dependency audit triage rejects prerelease or build-qualified axios versions', async () => {
  const { compareVersions, evaluateSecurityDependencyAuditTriage } = await loadModule();
  const prerelease = evaluateSecurityDependencyAuditTriage({
    generatedAt: '2026-06-02T00:00:00.000Z',
    packageJson: {
      dependencies: {
        axios: '^1.18.0-rc.1',
      },
    },
    packageLock: {
      packages: {
        '': {
          dependencies: {
            axios: '^1.18.0-rc.1',
          },
        },
        'node_modules/axios': {
          version: '1.18.0-rc.1',
        },
      },
    },
  });
  const buildQualified = evaluateSecurityDependencyAuditTriage({
    generatedAt: '2026-06-02T00:00:00.000Z',
    packageJson: {
      dependencies: {
        axios: '^1.18.0',
      },
    },
    packageLock: {
      packages: {
        '': {
          dependencies: {
            axios: '^1.18.0',
          },
        },
        'node_modules/axios': {
          version: '1.18.0+local',
        },
      },
    },
  });

  assert.equal(prerelease.ok, false);
  assert.equal(prerelease.finding.manifestMinimum, '');
  assert.ok(prerelease.blockers.some((blocker) =>
    blocker.reason === 'axios_manifest_floor_below_patched_minimum'));
  assert.ok(prerelease.blockers.some((blocker) =>
    blocker.reason === 'axios_lock_below_patched_minimum'));
  assert.equal(buildQualified.ok, false);
  assert.ok(buildQualified.blockers.some((blocker) =>
    blocker.reason === 'axios_lock_below_patched_minimum'));
  assert.equal(Number.isNaN(compareVersions('1.18.0-rc.1', '1.18.0')), true);
  assert.equal(Number.isNaN(compareVersions('1.18.0+local', '1.18.0')), true);
});

test('security dependency audit triage CLI writes the scoped JSON artifact', async () => {
  const { compareVersions } = await loadModule();
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
    assert.equal(artifact.finding.manifestSpec, '^1.18.0');
    assert.equal(artifact.finding.patchedMinimum, '1.18.0');
    assert.ok(compareVersions(
      artifact.finding.lockedVersion,
      artifact.finding.patchedMinimum,
    ) >= 0);
    assert.equal(artifact.decision.status, 'PASS_LOCAL_PATCHED');

    const firstWrite = readFileSync(outputPath, 'utf8');
    const secondResult = spawnSync(process.execPath, [
      'scripts/security-dependency-audit-triage.mjs',
      '--json',
      '--output',
      outputPath,
    ], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });

    assert.equal(secondResult.status, 0, secondResult.stderr);
    assert.equal(readFileSync(outputPath, 'utf8'), firstWrite);
    assert.deepEqual(JSON.parse(secondResult.stdout), JSON.parse(firstWrite));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
