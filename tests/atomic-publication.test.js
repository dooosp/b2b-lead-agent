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
  fs.appendFileSync(generationLatest, '\nTAMPER', 'utf8');
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

test('failure harness detects the mixed state produced by a naive sequential writer', (t) => {
  const root = makeRoot(t, 'naive-writer-sensitivity-');
  const files = ['report.md', 'latest.json', 'history.json'].map((name) => path.join(root, name));
  for (const file of files) fs.writeFileSync(file, 'A', 'utf8');
  fs.writeFileSync(files[0], 'B', 'utf8');
  assert.deepEqual(files.map((file) => fs.readFileSync(file, 'utf8')), ['B', 'A', 'A']);
});
