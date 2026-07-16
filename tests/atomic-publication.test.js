const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const publisher = require('../lead-report-publisher');
const { createRootLead, createRootProfile } = require('./helpers/root-fixtures');

const NOW_A = '2026-07-15T01:00:00.000Z';
const NOW_B = '2026-07-15T02:00:00.000Z';

function makeRoot(t, label = 'atomic-publication-') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), label));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function lead(label, overrides = {}) {
  return createRootLead({
    company: `Fixture ${label}`,
    summary: `Synthetic publication ${label}`,
    salesPitch: `Review synthetic publication ${label}.`,
    generationMode: 'llm',
    verificationStatus: 'needs_review',
    confidence: 'LOW',
    ...overrides,
  });
}

function prepare(root, profile, value, now) {
  return publisher.prepareLeadPublication([value], profile, {
    reportsRoot: path.join(root, 'reports'),
    now,
  });
}

function seedA(root, profile) {
  const prepared = prepare(root, profile, lead('A'), NOW_A);
  return publisher.commitLeadPublication(prepared, profile, {
    reportsRoot: path.join(root, 'reports'),
  });
}

function canonicalBytes(root, profile, manifest) {
  const reportsDir = path.join(root, 'reports', profile.id);
  return Object.fromEntries(['report', 'latest', 'history'].map((kind) => [
    kind,
    fs.readFileSync(path.join(reportsDir, manifest.artifacts[kind].canonicalPath)),
  ]));
}

test('failure after every traced pre-pointer mutation restores publication A and permits retry B', (t) => {
  const traceRoot = makeRoot(t, 'atomic-publication-trace-');
  const profile = createRootProfile();
  seedA(traceRoot, profile);
  const tracedB = prepare(traceRoot, profile, lead('B'), NOW_B);
  const operations = [];
  publisher.commitLeadPublication(tracedB, profile, {
    reportsRoot: path.join(traceRoot, 'reports'),
    faultInjector(operation) { operations.push(operation); },
  });
  assert.ok(operations.includes('lock:acquired'));
  assert.ok(operations.includes('generation:rename'));
  assert.ok(operations.includes('compatibility:history:rename'));
  assert.ok(operations.includes('pointer:before-rename'));
  assert.ok(operations.includes('pointer:rename'), 'pointer rename is the commit point');
  assert.ok(operations.includes('pointer:sync-directory'));
  const preCommitOperations = operations.slice(0, operations.indexOf('pointer:rename'));

  for (const operation of preCommitOperations) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atomic-publication-fault-'));
    try {
      seedA(root, profile);
      const before = publisher.readCommittedPublication(profile, {
        reportsRoot: path.join(root, 'reports'),
      });
      const beforeCanonical = canonicalBytes(root, profile, before.manifest);
      const preparedB = prepare(root, profile, lead('B'), NOW_B);
      let injected = false;
      assert.throws(
        () => publisher.commitLeadPublication(preparedB, profile, {
          reportsRoot: path.join(root, 'reports'),
          faultInjector(current) {
            if (!injected && current === operation) {
              injected = true;
              throw Object.assign(new Error('synthetic publication fault'), { code: 'ERR_TEST_FAULT' });
            }
          },
        }),
        /synthetic publication fault/,
        operation,
      );
      assert.equal(injected, true, operation);

      const after = publisher.readCommittedPublication(profile, {
        reportsRoot: path.join(root, 'reports'),
      });
      assert.equal(after.manifest.publicationId, before.manifest.publicationId, operation);
      assert.equal(after.compatibilityIntact, true, operation);
      for (const kind of ['report', 'latest', 'history']) {
        assert.deepEqual(
          fs.readFileSync(path.join(after.reportsDir, after.manifest.artifacts[kind].canonicalPath)),
          beforeCanonical[kind],
          `${operation}:${kind}`,
        );
      }
      assert.equal(after.history.some((item) => item.company === 'Fixture B'), false, operation);
      assert.equal(fs.existsSync(path.join(after.reportsDir, '.publication-lock')), false, operation);
      assert.equal(
        fs.readdirSync(after.reportsDir).some((entry) => entry.startsWith('.publication-txn-')),
        false,
        operation,
      );

      publisher.commitLeadPublication(prepare(root, profile, lead('B'), NOW_B), profile, {
        reportsRoot: path.join(root, 'reports'),
      });
      const retried = publisher.readCommittedPublication(profile, {
        reportsRoot: path.join(root, 'reports'),
      });
      assert.equal(retried.latest[0].company, 'Fixture B', operation);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

test('a failure after pointer rename retains a complete publication B instead of deleting its generation', (t) => {
  const profile = createRootProfile();
  for (const operation of ['pointer:rename', 'pointer:sync-directory']) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atomic-publication-pointer-'));
    try {
      seedA(root, profile);
      const reportsRoot = path.join(root, 'reports');
      const preparedB = prepare(root, profile, lead('B'), NOW_B);
      const result = publisher.commitLeadPublication(preparedB, profile, {
          reportsRoot,
          faultInjector(current) {
            if (current === operation) {
              throw Object.assign(new Error('synthetic post-pointer fault'), { code: 'ERR_TEST_FAULT' });
            }
          },
        });

      const committed = publisher.readCommittedPublication(profile, { reportsRoot });
      assert.equal(result.localCommitted, true, operation);
      assert.equal(committed.manifest.publicationId, preparedB.publicationId, operation);
      assert.equal(committed.latest[0].company, 'Fixture B', operation);
      assert.equal(committed.compatibilityIntact, true, operation);
      const retried = prepare(root, profile, lead('B'), NOW_B);
      assert.equal(retried.noChange, true, operation);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

test('manifest-aware read fails closed on tampering and compatibility repair restores pointer-selected bytes', (t) => {
  const root = makeRoot(t);
  const profile = createRootProfile();
  seedA(root, profile);
  const committed = publisher.readCommittedPublication(profile, {
    reportsRoot: path.join(root, 'reports'),
  });
  const latestPath = path.join(committed.reportsDir, committed.manifest.artifacts.latest.canonicalPath);
  fs.writeFileSync(latestPath, '[{"company":"MIXED B"}]', 'utf8');
  const mixed = publisher.readCommittedPublication(profile, {
    reportsRoot: path.join(root, 'reports'),
  });
  assert.equal(mixed.manifest.publicationId, committed.manifest.publicationId);
  assert.equal(mixed.latest[0].company, 'Fixture A');
  assert.equal(mixed.compatibilityIntact, false);
  assert.equal(publisher.repairPublicationCompatibilityMirrors(profile, {
    reportsRoot: path.join(root, 'reports'),
  }), true);
  assert.deepEqual(fs.readFileSync(latestPath), committed.buffers.latest);

  const generationLatest = path.join(
    committed.reportsDir,
    ...committed.manifest.artifacts.latest.path.split('/'),
  );
  const tamperedSameLength = fs.readFileSync(generationLatest);
  const companyOffset = tamperedSameLength.indexOf(Buffer.from('Fixture A'));
  assert.ok(companyOffset >= 0);
  tamperedSameLength[companyOffset] = 0x58;
  fs.writeFileSync(generationLatest, tamperedSameLength);
  assert.throws(
    () => publisher.readCommittedPublication(profile, {
      reportsRoot: path.join(root, 'reports'),
    }),
    (error) => error.code === 'ERR_PUBLICATION_ARTIFACT_INVALID',
  );
});

test('manifest rejects traversal and unknown metadata instead of downgrading to mirrors', (t) => {
  const root = makeRoot(t);
  const profile = createRootProfile();
  seedA(root, profile);
  const committed = publisher.readCommittedPublication(profile, {
    reportsRoot: path.join(root, 'reports'),
  });
  const original = fs.readFileSync(committed.manifestPath, 'utf8');
  const legacy = JSON.parse(original);
  legacy.schemaVersion = 1;
  delete legacy.runId;
  delete legacy.previousManifestSchemaVersion;
  fs.writeFileSync(committed.manifestPath, JSON.stringify(legacy), 'utf8');
  assert.equal(
    publisher.readCommittedPublication(profile, { reportsRoot: path.join(root, 'reports') }).manifest.schemaVersion,
    1,
  );

  const traversal = JSON.parse(original);
  traversal.artifacts.latest.path = '../latest-leads.json';
  fs.writeFileSync(committed.manifestPath, JSON.stringify(traversal), 'utf8');
  assert.throws(
    () => publisher.readCommittedPublication(profile, { reportsRoot: path.join(root, 'reports') }),
    (error) => error.code === 'ERR_PUBLICATION_MANIFEST_INVALID',
  );

  const unknown = JSON.parse(original);
  unknown.rawProviderResponse = 'must not be accepted';
  fs.writeFileSync(committed.manifestPath, JSON.stringify(unknown), 'utf8');
  assert.throws(
    () => publisher.readCommittedPublication(profile, { reportsRoot: path.join(root, 'reports') }),
    (error) => error.code === 'ERR_PUBLICATION_MANIFEST_INVALID',
  );
});

test('lock contention fails retryably without changing the selected publication', (t) => {
  const root = makeRoot(t);
  const profile = createRootProfile();
  seedA(root, profile);
  const before = publisher.readCommittedPublication(profile, {
    reportsRoot: path.join(root, 'reports'),
  });
  const lockPath = path.join(before.reportsDir, '.publication-lock');
  fs.mkdirSync(lockPath);
  const preparedB = prepare(root, profile, lead('B'), NOW_B);
  assert.throws(
    () => publisher.commitLeadPublication(preparedB, profile, {
      reportsRoot: path.join(root, 'reports'),
    }),
    (error) => error.code === 'ERR_PUBLICATION_LOCKED' && error.retryable === true,
  );
  assert.equal(
    publisher.readCommittedPublication(profile, { reportsRoot: path.join(root, 'reports') }).manifest.publicationId,
    before.manifest.publicationId,
  );
});

test('a lock owned by a dead process is recovered before retry publication', (t) => {
  const root = makeRoot(t);
  const profile = createRootProfile();
  seedA(root, profile);
  const committed = publisher.readCommittedPublication(profile, {
    reportsRoot: path.join(root, 'reports'),
  });
  const lockPath = path.join(committed.reportsDir, '.publication-lock');
  fs.mkdirSync(lockPath);
  fs.writeFileSync(path.join(lockPath, 'owner.json'), JSON.stringify({
    pid: 2147483647,
    createdAt: '2026-07-15T00:00:00.000Z',
  }), 'utf8');
  const published = publisher.commitLeadPublication(
    prepare(root, profile, lead('B'), NOW_B),
    profile,
    { reportsRoot: path.join(root, 'reports') },
  );
  assert.equal(published.localCommitted, true);
  assert.equal(fs.existsSync(lockPath), false);
});

test('compatibility repair and publication commit serialize on the same profile lock', (t) => {
  const root = makeRoot(t);
  const profile = createRootProfile();
  seedA(root, profile);
  const reportsRoot = path.join(root, 'reports');
  const committed = publisher.readCommittedPublication(profile, { reportsRoot });
  fs.writeFileSync(
    path.join(committed.reportsDir, committed.manifest.artifacts.latest.canonicalPath),
    '[{"company":"MIXED"}]',
    'utf8',
  );
  const preparedB = prepare(root, profile, lead('B'), NOW_B);
  let contenderError = null;
  publisher.repairPublicationCompatibilityMirrors(profile, {
    reportsRoot,
    faultInjector(operation) {
      if (operation === 'repair:latest:write') {
        try {
          publisher.commitLeadPublication(preparedB, profile, { reportsRoot });
        } catch (error) {
          contenderError = error;
        }
      }
    },
  });
  assert.equal(contenderError && contenderError.code, 'ERR_PUBLICATION_LOCKED');
  const repaired = publisher.readCommittedPublication(profile, { reportsRoot });
  assert.equal(repaired.manifest.publicationId, committed.manifest.publicationId);
  assert.equal(repaired.compatibilityIntact, true);
  assert.equal(repaired.latest[0].company, 'Fixture A');

  publisher.commitLeadPublication(preparedB, profile, { reportsRoot });
  assert.equal(
    publisher.readCommittedPublication(profile, { reportsRoot }).latest[0].company,
    'Fixture B',
  );
});

test('stale-lock recovery rechecks ownership after claiming recovery', (t) => {
  const root = makeRoot(t);
  const profile = createRootProfile();
  seedA(root, profile);
  const reportsRoot = path.join(root, 'reports');
  const committed = publisher.readCommittedPublication(profile, { reportsRoot });
  const lockPath = path.join(committed.reportsDir, '.publication-lock');
  fs.mkdirSync(lockPath);
  fs.writeFileSync(path.join(lockPath, 'owner.json'), JSON.stringify({
    pid: 2147483647,
    ownerId: 'dead-owner',
    createdAt: '2026-07-15T00:00:00.000Z',
  }), 'utf8');

  assert.throws(
    () => publisher.commitLeadPublication(
      prepare(root, profile, lead('B'), NOW_B),
      profile,
      {
        reportsRoot,
        faultInjector(operation) {
          if (operation === 'lock:recovery-claimed') {
            fs.writeFileSync(path.join(lockPath, 'owner.json'), JSON.stringify({
              pid: process.pid,
              ownerId: 'new-live-owner',
              createdAt: new Date().toISOString(),
            }), 'utf8');
          }
        },
      },
    ),
    (error) => error.code === 'ERR_PUBLICATION_LOCKED',
  );
  assert.equal(fs.existsSync(lockPath), true);
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(lockPath, 'owner.json'), 'utf8')).ownerId,
    'new-live-owner',
  );
  fs.rmSync(lockPath, { recursive: true, force: true });
  assert.equal(
    publisher.readCommittedPublication(profile, { reportsRoot }).manifest.publicationId,
    committed.manifest.publicationId,
  );
});

test('report and publication identity are deterministic across host timezones', (t) => {
  const root = makeRoot(t, 'atomic-publication-timezone-');
  const profile = createRootProfile();
  const value = lead('TZ');
  const childScript = `
    const crypto = require('crypto');
    const publisher = require(process.argv[1]);
    console.log = () => {};
    const prepared = publisher.prepareLeadPublication(
      [JSON.parse(process.argv[2])],
      JSON.parse(process.argv[3]),
      { reportsRoot: process.argv[4], now: '2026-07-15T23:30:00.000Z', runId: 'run-timezone' }
    );
    process.stdout.write(JSON.stringify({
      publicationId: prepared.publicationId,
      reportDate: prepared.manifest.reportDate,
      reportSha: crypto.createHash('sha256').update(prepared.payloads.report).digest('hex')
    }));
  `;
  const runInTimezone = (timezone) => {
    const child = spawnSync(process.execPath, [
      '-e',
      childScript,
      require.resolve('../lead-report-publisher'),
      JSON.stringify(value),
      JSON.stringify(profile),
      path.join(root, timezone.replace(/\W/g, '-'), 'reports'),
    ], {
      encoding: 'utf8',
      env: { ...process.env, TZ: timezone },
    });
    assert.equal(child.status, 0, child.stderr);
    return JSON.parse(child.stdout);
  };
  assert.deepEqual(runInTimezone('UTC'), runInTimezone('Asia/Seoul'));
});

test('fresh-process retry recovers pointer-selected A after a hard crash leaves compatibility mirrors mixed', (t) => {
  const root = makeRoot(t, 'atomic-publication-crash-');
  const profile = createRootProfile();
  seedA(root, profile);
  const before = publisher.readCommittedPublication(profile, {
    reportsRoot: path.join(root, 'reports'),
  });
  const reportsRoot = path.join(root, 'reports');
  const childScript = `
    const publisher = require(process.argv[1]);
    const reportsRoot = process.argv[2];
    const profile = JSON.parse(process.argv[3]);
    const lead = JSON.parse(process.argv[4]);
    const prepared = publisher.prepareLeadPublication([lead], profile, {
      reportsRoot,
      now: '${NOW_B}'
    });
    publisher.commitLeadPublication(prepared, profile, {
      reportsRoot,
      faultInjector(operation) {
        if (operation === 'compatibility:latest:rename') process.exit(86);
      }
    });
  `;
  const crashed = spawnSync(process.execPath, [
    '-e',
    childScript,
    require.resolve('../lead-report-publisher'),
    reportsRoot,
    JSON.stringify(profile),
    JSON.stringify(lead('B')),
  ], { encoding: 'utf8' });
  assert.equal(crashed.status, 86, crashed.stderr);

  const afterCrash = publisher.readCommittedPublication(profile, { reportsRoot });
  assert.equal(afterCrash.manifest.publicationId, before.manifest.publicationId);
  assert.equal(afterCrash.latest[0].company, 'Fixture A');
  assert.equal(afterCrash.compatibilityIntact, false);

  publisher.commitLeadPublication(
    publisher.prepareLeadPublication([lead('B')], profile, { reportsRoot, now: NOW_B }),
    profile,
    { reportsRoot },
  );
  const recovered = publisher.readCommittedPublication(profile, { reportsRoot });
  assert.equal(recovered.latest[0].company, 'Fixture B');
  assert.equal(recovered.compatibilityIntact, true);
  assert.equal(fs.existsSync(path.join(recovered.reportsDir, '.publication-lock')), false);
  assert.equal(
    fs.readdirSync(recovered.reportsDir).some((entry) => entry.startsWith('.publication-txn-')),
    false,
  );
});

test('changed-clock retry succeeds after a hard crash leaves an unreferenced immutable generation', (t) => {
  const root = makeRoot(t, 'atomic-publication-orphan-generation-');
  const profile = createRootProfile();
  seedA(root, profile);
  const reportsRoot = path.join(root, 'reports');
  const childScript = `
    const publisher = require(process.argv[1]);
    const reportsRoot = process.argv[2];
    const profile = JSON.parse(process.argv[3]);
    const lead = JSON.parse(process.argv[4]);
    const prepared = publisher.prepareLeadPublication([lead], profile, {
      reportsRoot,
      now: '${NOW_B}',
      runId: 'run-orphan-generation-b'
    });
    publisher.commitLeadPublication(prepared, profile, {
      reportsRoot,
      faultInjector(operation) {
        if (operation === 'generation:rename') process.exit(86);
      }
    });
  `;
  const crashed = spawnSync(process.execPath, [
    '-e',
    childScript,
    require.resolve('../lead-report-publisher'),
    reportsRoot,
    JSON.stringify(profile),
    JSON.stringify(lead('B')),
  ], { encoding: 'utf8' });
  assert.equal(crashed.status, 86, crashed.stderr);

  const afterCrash = publisher.readCommittedPublication(profile, { reportsRoot });
  assert.equal(afterCrash.latest[0].company, 'Fixture A');
  const orphanIds = fs.readdirSync(path.join(afterCrash.reportsDir, 'publications'))
    .filter((publicationId) => publicationId !== afterCrash.manifest.publicationId);
  assert.equal(orphanIds.length, 1);

  const retry = publisher.prepareLeadPublication([lead('B')], profile, {
    reportsRoot,
    now: '2026-07-15T03:00:00.000Z',
    runId: 'run-orphan-generation-b',
  });
  assert.notEqual(retry.publicationId, orphanIds[0]);
  publisher.commitLeadPublication(retry, profile, { reportsRoot });

  const recovered = publisher.readCommittedPublication(profile, { reportsRoot });
  assert.equal(recovered.manifest.publicationId, retry.publicationId);
  assert.equal(recovered.latest[0].company, 'Fixture B');
  assert.equal(recovered.compatibilityIntact, true);
});

test('a failed retry restores pointer-selected immutable bytes instead of a mixed crash snapshot', (t) => {
  const root = makeRoot(t, 'mixed-retry-rollback-');
  const profile = createRootProfile();
  seedA(root, profile);
  const reportsRoot = path.join(root, 'reports');
  const preparedB = publisher.prepareLeadPublication([lead('B')], profile, {
    reportsRoot,
    now: NOW_B,
    runId: 'run-mixed-retry-b',
  });
  const reportsDir = path.join(reportsRoot, profile.id);
  fs.writeFileSync(
    path.join(reportsDir, preparedB.manifest.artifacts.latest.canonicalPath),
    preparedB.payloads.latest,
  );
  assert.equal(publisher.readCommittedPublication(profile, { reportsRoot }).compatibilityIntact, false);

  assert.throws(
    () => publisher.commitLeadPublication(preparedB, profile, {
      reportsRoot,
      faultInjector(operation) {
        if (operation === 'compatibility:history:write') {
          throw Object.assign(new Error('synthetic retry failure'), { code: 'ERR_TEST_FAULT' });
        }
      },
    }),
    (error) => error.code === 'ERR_TEST_FAULT',
  );
  const restored = publisher.readCommittedPublication(profile, { reportsRoot });
  assert.equal(restored.latest[0].company, 'Fixture A');
  assert.equal(restored.compatibilityIntact, true);
});

test('an abandoned stale recovery claim does not permanently wedge publication', (t) => {
  const root = makeRoot(t, 'abandoned-recovery-claim-');
  const profile = createRootProfile();
  seedA(root, profile);
  const reportsRoot = path.join(root, 'reports');
  const reportsDir = path.join(reportsRoot, profile.id);
  const lockPath = path.join(reportsDir, '.publication-lock');
  fs.mkdirSync(lockPath);
  fs.writeFileSync(path.join(lockPath, 'owner.json'), JSON.stringify({ pid: 2147483646, ownerId: 'dead-owner' }));
  fs.writeFileSync(path.join(lockPath, '.recovery-claim'), JSON.stringify({ pid: 2147483645, ownerId: 'dead-claim' }));

  publisher.commitLeadPublication(
    publisher.prepareLeadPublication([lead('B')], profile, {
      reportsRoot,
      now: NOW_B,
      runId: 'run-after-abandoned-claim',
    }),
    profile,
    { reportsRoot },
  );
  const committed = publisher.readCommittedPublication(profile, { reportsRoot });
  assert.equal(committed.latest[0].company, 'Fixture B');
  assert.equal(fs.existsSync(lockPath), false);
});

test('legacy partial writers refuse to mutate a manifest-backed publication', (t) => {
  const root = makeRoot(t, 'managed-writer-guard-');
  const profile = createRootProfile();
  seedA(root, profile);
  const reportsRoot = path.join(root, 'reports');
  const before = publisher.readCommittedPublication(profile, { reportsRoot });

  assert.throws(
    () => publisher.saveLeadSnapshot([lead('B')], profile, { reportsRoot, now: NOW_B }),
    (error) => error.code === 'ERR_PUBLICATION_MANAGED_WRITER_REQUIRED',
  );
  assert.throws(
    () => publisher.saveLeadReport({ dateStr: '2026-07-15', content: '# partial' }, profile, { reportsRoot }),
    (error) => error.code === 'ERR_PUBLICATION_MANAGED_WRITER_REQUIRED',
  );
  const after = publisher.readCommittedPublication(profile, { reportsRoot });
  assert.equal(after.manifest.publicationId, before.manifest.publicationId);
  assert.equal(after.latest[0].company, 'Fixture A');
  assert.equal(after.compatibilityIntact, true);
});

test('duplicate generated lead identities fail before publication mutation', (t) => {
  const root = makeRoot(t, 'duplicate-publication-id-');
  const profile = createRootProfile();
  const duplicate = lead('Duplicate');
  assert.throws(
    () => publisher.prepareLeadPublication([duplicate, { ...duplicate }], profile, {
      reportsRoot: path.join(root, 'reports'),
      now: NOW_B,
    }),
    (error) => error.code === 'ERR_LEAD_PUBLICATION_DUPLICATE_ID',
  );
  assert.equal(
    fs.existsSync(path.join(root, 'reports', profile.id, 'publication-manifest.json')),
    false,
  );
});

test('producer cardinality limits match latest and history consumer contracts', (t) => {
  const root = makeRoot(t, 'publication-cardinality-');
  const profile = createRootProfile();
  const reportsRoot = path.join(root, 'reports');
  const tooManyLatest = Array.from(
    { length: publisher.PUBLICATION_LATEST_MAX_RECORDS + 1 },
    (_, index) => lead(`Latest ${index}`),
  );
  assert.throws(
    () => publisher.prepareLeadPublication(tooManyLatest, profile, { reportsRoot, now: NOW_B }),
    (error) => error.code === 'ERR_LEAD_PUBLICATION_LIMIT',
  );

  const reportsDir = path.join(reportsRoot, profile.id);
  fs.mkdirSync(reportsDir, { recursive: true });
  const historyPath = path.join(reportsDir, 'lead-history.json');
  const history = Array.from({ length: publisher.PUBLICATION_HISTORY_MAX_RECORDS }, (_, index) => ({
    id: `history-${index}`,
    company: `History ${index}`,
    score: 82,
    grade: 'A',
  }));
  fs.writeFileSync(historyPath, JSON.stringify(history), 'utf8');
  const before = fs.readFileSync(historyPath);
  assert.throws(
    () => publisher.prepareLeadPublication([lead('History overflow')], profile, {
      reportsRoot,
      now: NOW_B,
      idFactory: () => 'history-new',
    }),
    (error) => error.code === 'ERR_LEAD_PUBLICATION_LIMIT',
  );
  assert.deepEqual(fs.readFileSync(historyPath), before);
  assert.equal(fs.existsSync(path.join(reportsDir, 'publication-manifest.json')), false);
});

test('oversized history bytes fail closed instead of publishing an unreadable artifact', (t) => {
  const root = makeRoot(t, 'publication-byte-limit-');
  const profile = createRootProfile();
  const reportsRoot = path.join(root, 'reports');
  const reportsDir = path.join(reportsRoot, profile.id);
  fs.mkdirSync(reportsDir, { recursive: true });
  const historyPath = path.join(reportsDir, 'lead-history.json');
  const largeText = 'x'.repeat(10_000);
  const history = Array.from({ length: publisher.PUBLICATION_HISTORY_MAX_RECORDS }, (_, index) => ({
    id: `large-history-${index}`,
    company: `Large History ${index}`,
    summary: largeText,
    product: largeText,
    salesPitch: largeText,
    score: 82,
    grade: 'A',
  }));
  fs.writeFileSync(historyPath, JSON.stringify(history), 'utf8');
  const before = fs.readFileSync(historyPath);
  assert.throws(
    () => publisher.prepareLeadPublication([lead('Large History replacement')], profile, {
      reportsRoot,
      now: NOW_B,
      idFactory: () => 'large-history-0',
    }),
    (error) => error.code === 'ERR_LEAD_PUBLICATION_LIMIT',
  );
  assert.deepEqual(fs.readFileSync(historyPath), before);
  assert.equal(fs.existsSync(path.join(reportsDir, 'publication-manifest.json')), false);
});

test('oversized individual lead bytes fail before Worker-incompatible publication', (t) => {
  const root = makeRoot(t, 'publication-entry-byte-limit-');
  const profile = createRootProfile();
  const reportsRoot = path.join(root, 'reports');
  const oversized = lead('Oversized entry', {
    assumptions: Array.from({ length: 220 }, () => 'x'.repeat(9_000)),
  });
  assert.throws(
    () => publisher.prepareLeadPublication([oversized], profile, { reportsRoot, now: NOW_B }),
    (error) => error.code === 'ERR_LEAD_PUBLICATION_LIMIT',
  );
  assert.equal(
    fs.existsSync(path.join(reportsRoot, profile.id, 'publication-manifest.json')),
    false,
  );
});

test('malformed legacy history entries fail without silent projection or mutation', (t) => {
  const root = makeRoot(t, 'malformed-legacy-history-');
  const profile = createRootProfile();
  const reportsRoot = path.join(root, 'reports');
  const reportsDir = path.join(reportsRoot, profile.id);
  fs.mkdirSync(reportsDir, { recursive: true });
  const historyPath = path.join(reportsDir, 'lead-history.json');
  const malformed = JSON.stringify([
    { id: 'old', company: 'Old', score: 'bad' },
    null,
    'oops',
  ]);
  fs.writeFileSync(historyPath, malformed, 'utf8');
  assert.throws(
    () => publisher.prepareLeadPublication([lead('New')], profile, { reportsRoot, now: NOW_B }),
    (error) => error.code === 'ERR_LEAD_HISTORY_INVALID',
  );
  assert.equal(fs.readFileSync(historyPath, 'utf8'), malformed);
  assert.equal(fs.existsSync(path.join(reportsDir, 'publication-manifest.json')), false);

  const invalidList = JSON.stringify([{
    id: 'old-list',
    company: 'Old list',
    score: 82,
    grade: 'A',
    assumptions: ['valid', 42],
  }]);
  fs.writeFileSync(historyPath, invalidList, 'utf8');
  assert.throws(
    () => publisher.prepareLeadPublication([lead('New list')], profile, { reportsRoot, now: NOW_B }),
    (error) => error.code === 'ERR_LEAD_HISTORY_INVALID',
  );
  assert.equal(fs.readFileSync(historyPath, 'utf8'), invalidList);

  const duplicateHistory = JSON.stringify([
    { id: 'duplicate-history-id', company: 'History A', score: 82, grade: 'A' },
    { id: 'duplicate-history-id', company: 'History B', score: 82, grade: 'A' },
  ]);
  fs.writeFileSync(historyPath, duplicateHistory, 'utf8');
  assert.throws(
    () => publisher.prepareLeadPublication([lead('New duplicate')], profile, {
      reportsRoot,
      now: NOW_B,
      idFactory: () => 'unique-new-id',
    }),
    (error) => error.code === 'ERR_LEAD_PUBLICATION_DUPLICATE_ID',
  );
  assert.equal(fs.readFileSync(historyPath, 'utf8'), duplicateHistory);
  assert.equal(fs.existsSync(path.join(reportsDir, 'publication-manifest.json')), false);
});

test('secret-shaped serialized source fields are rejected before publication mutation', (t) => {
  const root = makeRoot(t, 'publication-nested-source-secret-');
  const profile = createRootProfile();
  const reportsRoot = path.join(root, 'reports');
  const poisoned = lead('Poisoned source', {
    sources: [{
      sourceId: 'api_key=DO_NOT_PUBLISH',
      title: 'Public title',
      url: 'https://example.com/public',
      source: 'Fixture',
      query: 'public query',
      publishedAt: 'token=LEAKVALUE123',
      originUrl: 'https://example.com/origin',
      resolution: 'Bearer SECRETXYZ123',
    }],
  });

  const prepared = publisher.prepareLeadPublication([poisoned], profile, {
    reportsRoot,
    now: NOW_B,
  });
  assert.equal(prepared.validLeads.length, 0);
  assert.equal(prepared.rejectedCount, 1);
  assert.equal(
    fs.existsSync(path.join(reportsRoot, profile.id, 'publication-manifest.json')),
    false,
  );
});

test('secret-shaped retained history is rejected without mutation', (t) => {
  const root = makeRoot(t, 'publication-history-secret-');
  const profile = createRootProfile();
  const reportsRoot = path.join(root, 'reports');
  const reportsDir = path.join(reportsRoot, profile.id);
  fs.mkdirSync(reportsDir, { recursive: true });
  const historyPath = path.join(reportsDir, 'lead-history.json');
  const history = JSON.stringify([{
    id: 'retained-secret',
    company: 'Retained secret',
    score: 82,
    grade: 'A',
    sources: [{
      sourceId: 'A1',
      title: 'Public title',
      url: 'https://example.com/public',
      publishedAt: '2026-07-14T00:00:00.000Z',
      resolution: 'token=RETAINEDSECRET123',
    }],
  }]);
  fs.writeFileSync(historyPath, history, 'utf8');

  assert.throws(
    () => publisher.prepareLeadPublication([lead('New')], profile, { reportsRoot, now: NOW_B }),
    (error) => error.code === 'ERR_LEAD_HISTORY_INVALID',
  );
  assert.equal(fs.readFileSync(historyPath, 'utf8'), history);
  assert.equal(fs.existsSync(path.join(reportsDir, 'publication-manifest.json')), false);
});

test('route-unsafe or oversized retained lead ids are rejected without mutation', (t) => {
  const root = makeRoot(t, 'publication-history-id-');
  const profile = createRootProfile();
  const reportsRoot = path.join(root, 'reports');
  const reportsDir = path.join(reportsRoot, profile.id);
  fs.mkdirSync(reportsDir, { recursive: true });
  const historyPath = path.join(reportsDir, 'lead-history.json');

  for (const id of ['unsafe\nid', 'x'.repeat(300)]) {
    const history = JSON.stringify([{ id, company: 'Invalid id', score: 82, grade: 'A' }]);
    fs.writeFileSync(historyPath, history, 'utf8');
    assert.throws(
      () => publisher.prepareLeadPublication([lead('New')], profile, { reportsRoot, now: NOW_B }),
      (error) => error.code === 'ERR_LEAD_HISTORY_INVALID',
    );
    assert.equal(fs.readFileSync(historyPath, 'utf8'), history);
    assert.equal(fs.existsSync(path.join(reportsDir, 'publication-manifest.json')), false);
  }
});

test('failure harness detects the mixed state produced by a naive sequential writer', (t) => {
  const root = makeRoot(t, 'naive-writer-sensitivity-');
  const files = ['report.md', 'latest.json', 'history.json'].map((name) => path.join(root, name));
  for (const file of files) fs.writeFileSync(file, 'A', 'utf8');
  fs.writeFileSync(files[0], 'B', 'utf8');
  assert.deepEqual(files.map((file) => fs.readFileSync(file, 'utf8')), ['B', 'A', 'A']);
});
