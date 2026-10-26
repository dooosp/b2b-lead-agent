import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare } from 'miniflare';
import { build } from 'esbuild';
import {
  applyLocalTestD1Migrations,
  LOCAL_TEST_D1_MIGRATION_TARGET,
} from '../db/migrations.js';

const SYNTHETIC_API_TOKEN = 'local-workerd-api-not-a-credential';
const SYNTHETIC_INTERNAL_TOKEN = 'local-workerd-internal-not-a-credential';
const LEAD_ID = 'synthetic-workerd-lead';
const ORIGINAL_NOTE = 'SYNTHETIC_LOCAL_RUNTIME_NOTE';
const ORIGIN = 'http://localhost';

function headers(role = 'reviewer') {
  return {
    Authorization: 'Bearer ' + SYNTHETIC_API_TOKEN,
    'Content-Type': 'application/json',
    'X-Manual-Review-Notes-Local-Test-Role': role,
  };
}

test('actual Worker runs offline in workerd with local D1 and protected review routes', {
  timeout: 45_000,
}, async (t) => {
  const pinnedNode = (await readFile(new URL('../../.nvmrc', import.meta.url), 'utf8')).trim();
  assert.equal(process.versions.node, pinnedNode, 'Run this gate with the Node version in .nvmrc');
  const config = await readFile(new URL('../wrangler.toml', import.meta.url), 'utf8');
  const compatibilityDate = config.match(/^compatibility_date = "([^"]+)"/m)?.[1];
  const compatibilityFlags = JSON.parse(config.match(/^compatibility_flags = (\[.*\])/m)?.[1] || '[]');
  assert.ok(compatibilityDate, 'Use the checked-in Worker compatibility date');

  const bundleDirectory = await mkdtemp(join(tmpdir(), 'b2b-workerd-bundle-'));
  let mf;
  t.after(async () => {
    try { await mf?.dispose(); }
    finally { await rm(bundleDirectory, { recursive: true, force: true }); }
  });
  const scriptPath = join(bundleDirectory, 'worker.mjs');
  await build({
    entryPoints: [fileURLToPath(new URL('../index.js', import.meta.url))],
    outfile: scriptPath,
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    target: 'es2022',
    keepNames: true,
    external: ['node:*'],
    logLevel: 'silent',
  });
  const blockedOutbound = [];
  mf = new Miniflare({
    modules: true,
    modulesRoot: bundleDirectory,
    scriptPath,
    compatibilityDate,
    compatibilityFlags,
    host: '127.0.0.1',
    port: 0,
    cf: false,
    d1Databases: ['DB'],
    d1Persist: false,
    kvNamespaces: ['RATE_LIMIT'],
    kvPersist: false,
    bindings: {
      API_TOKEN: SYNTHETIC_API_TOKEN,
      INTERNAL_API_TOKEN: SYNTHETIC_INTERNAL_TOKEN,
      GITHUB_REPO: 'synthetic/offline-runtime',
      WORKER_ORIGIN: ORIGIN,
      PROFILES: JSON.stringify([{ id: 'danfoss', name: 'Synthetic local profile' }]),
      MANUAL_REVIEW_NOTES_LOCAL_TEST_ROLE_STUB: 'enabled',
      REQUIRE_SELF_SERVICE_AUTH: 'true',
    },
    outboundService(request) {
      blockedOutbound.push(new URL(request.url).pathname);
      return new Response('Synthetic outbound boundary: external calls disabled', { status: 502 });
    },
  });
  const db = await mf.getD1Database('DB');
  const request = (pathname, init) => mf.dispatchFetch(ORIGIN + pathname, init);

  await t.test('API and protected detail require authentication and never cache reviewer HTML', async () => {
    assert.equal((await request('/api/leads')).status, 401);
    const detail = await request('/leads/' + LEAD_ID);
    assert.equal(detail.status, 401);
    assert.equal(detail.headers.get('cache-control'), 'private, no-store');
    assert.match(detail.headers.get('vary'), /Authorization/);
    assert.equal((await request('/api/internal/profiles/danfoss/latest-published', {
      headers: headers(),
    })).status, 401);
    assert.deepEqual(blockedOutbound, []);
  });

  await t.test('unmigrated local D1 fails closed without request-path DDL', async () => {
    const response = await request('/api/leads/' + LEAD_ID, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({ expectedVersion: 1, manualReviewNotes: 'synthetic' }),
    });
    const failure = await response.json();
    assert.equal(response.status, 500, JSON.stringify(failure));
    assert.equal(failure.success, false);
    const tables = await db.prepare("SELECT name FROM sqlite_master WHERE name = 'leads'").all();
    assert.deepEqual(tables.results, []);
  });

  // This adapter is created only from this Miniflare instance's ephemeral DB.
  // It is never constructed from environment bindings or production config.
  const localMigrationTarget = {
    localTestMigrationTarget: LOCAL_TEST_D1_MIGRATION_TARGET,
    prepare: (...args) => db.prepare(...args),
    batch: (...args) => db.batch(...args),
  };
  await t.test('explicit local migrations are repeatable on actual D1 SQLite', async () => {
    const first = await applyLocalTestD1Migrations(localMigrationTarget);
    assert.ok(first.appliedVersions.length > 0);
    const repeated = await applyLocalTestD1Migrations(localMigrationTarget);
    assert.deepEqual(repeated.appliedVersions, []);
    assert.equal(repeated.currentVersion, first.currentVersion);
  });

  await db.prepare(
    'INSERT INTO leads (id, profile_id, source, company, status, review_status, notes, created_at, updated_at) '
    + 'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    LEAD_ID, 'danfoss', 'managed', 'Synthetic workerd company', 'NEW', 'NEEDS_REVIEW',
    ORIGINAL_NOTE, '2026-10-26T00:00:00.000Z', '2026-10-26T00:00:00.000Z'
  ).run();

  await t.test('reviewer and manager receive different protected fields in real Worker HTML', async () => {
    const reviewer = await request('/leads/' + LEAD_ID, { headers: headers() });
    assert.equal(reviewer.status, 200);
    assert.equal(reviewer.headers.get('cache-control'), 'private, no-store');
    assert.match(await reviewer.text(), new RegExp(ORIGINAL_NOTE));
    const manager = await request('/leads/' + LEAD_ID, { headers: headers('manager') });
    assert.equal(manager.status, 200);
    assert.equal(manager.headers.get('cache-control'), 'private, no-store');
    const html = await manager.text();
    assert.doesNotMatch(html, new RegExp(ORIGINAL_NOTE));
    assert.doesNotMatch(html, /reviewNoteSuggestion|Follow-up check:/);
  });

  await t.test('manual review PATCH persists locally and rejects stale and denied writes', async () => {
    const patch = (expectedVersion, manualReviewNotes, role = 'reviewer') => request('/api/leads/' + LEAD_ID, {
      method: 'PATCH',
      headers: headers(role),
      body: JSON.stringify({ expectedVersion, manualReviewNotes }),
    });
    const saved = await patch(1, 'SYNTHETIC_UPDATED_NOTE');
    assert.equal(saved.status, 200);
    const body = await saved.json();
    assert.equal(body.lead.manualReviewNotes, 'SYNTHETIC_UPDATED_NOTE');
    assert.equal(body.lead.version, 2);
    assert.equal((await patch(1, 'STALE_SYNTHETIC_NOTE')).status, 409);
    assert.equal((await patch(2, 'DENIED_SYNTHETIC_NOTE', 'manager')).status, 403);
    const stored = await db.prepare('SELECT notes, version FROM leads WHERE id = ?').bind(LEAD_ID).first();
    assert.deepEqual(stored, { notes: 'SYNTHETIC_UPDATED_NOTE', version: 2 });
    assert.deepEqual(blockedOutbound, []);
  });

  await t.test('blocked outbound requests produce bounded readiness errors without network access', async () => {
    const response = await request('/api/internal/profiles/danfoss/latest-published', {
      headers: { Authorization: 'Bearer ' + SYNTHETIC_INTERNAL_TOKEN },
    });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, 'readiness_unavailable');
    assert.deepEqual(blockedOutbound, [
      '/synthetic/offline-runtime/master/reports/danfoss/publication-manifest.json',
    ]);
  });
});
