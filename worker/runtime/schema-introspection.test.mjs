import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare } from 'miniflare';
import { buildD1SchemaIntrospectionQuery } from '../db/migration-manifest.js';

test('schema introspection stays ordered and globally bounded in actual offline D1', {
  timeout: 45_000,
}, async (t) => {
  const config = await readFile(new URL('../wrangler.toml', import.meta.url), 'utf8');
  const compatibilityDate = config.match(/^compatibility_date = "([^"]+)"/m)?.[1];
  assert.ok(compatibilityDate);
  const blockedOutbound = [];
  const mf = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response("Local schema test"); } };',
    compatibilityDate,
    host: '127.0.0.1',
    port: 0,
    cf: false,
    d1Databases: ['DB'],
    d1Persist: false,
    outboundService(request) {
      blockedOutbound.push(request.url);
      return new Response('External calls disabled', { status: 502 });
    },
  });
  t.after(() => mf.dispose());
  const db = await mf.getD1Database('DB');
  await db.batch([
    db.prepare('CREATE TABLE d1_schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)'),
    db.prepare('CREATE TABLE published_snapshot_heads (profile_id TEXT NOT NULL, artifact_kind TEXT NOT NULL, snapshot_id TEXT NOT NULL, fetched_at TEXT NOT NULL)'),
  ]);
  const inspect = async (tables) => (
    await db.prepare(buildD1SchemaIntrospectionQuery(tables)).all()
  ).results;
  const ledgerRows = [
    { table_name: 'd1_schema_migrations', cid: 0, name: 'version', type: 'INTEGER', not_null: 0, dflt_value: null, pk: 1 },
    { table_name: 'd1_schema_migrations', cid: 1, name: 'name', type: 'TEXT', not_null: 1, dflt_value: null, pk: 0 },
    { table_name: 'd1_schema_migrations', cid: 2, name: 'applied_at', type: 'TEXT', not_null: 1, dflt_value: null, pk: 0 },
  ];
  const snapshotRows = [
    { table_name: 'published_snapshot_heads', cid: 0, name: 'profile_id', type: 'TEXT', not_null: 1, dflt_value: null, pk: 0 },
    { table_name: 'published_snapshot_heads', cid: 1, name: 'artifact_kind', type: 'TEXT', not_null: 1, dflt_value: null, pk: 0 },
    { table_name: 'published_snapshot_heads', cid: 2, name: 'snapshot_id', type: 'TEXT', not_null: 1, dflt_value: null, pk: 0 },
    { table_name: 'published_snapshot_heads', cid: 3, name: 'fetched_at', type: 'TEXT', not_null: 1, dflt_value: null, pk: 0 },
  ];

  await t.test('all canonical tables fit the workerd query limits and missing tables add no rows', async () => {
    assert.deepEqual(await inspect(), [...ledgerRows, ...snapshotRows]);
  });

  await t.test('a subset follows requested table order and each table column ordinal', async () => {
    assert.deepEqual(
      await inspect(['published_snapshot_heads', 'd1_schema_migrations']),
      [...snapshotRows, ...ledgerRows]
    );
    assert.deepEqual(await inspect(['leads']), []);
  });

  await t.test('one global extra row exposes drift without returning every unexpected column', async () => {
    await db.batch([
      db.prepare('ALTER TABLE published_snapshot_heads ADD COLUMN extra_a TEXT'),
      db.prepare('ALTER TABLE published_snapshot_heads ADD COLUMN extra_b TEXT'),
    ]);
    const extraRow = {
      table_name: 'published_snapshot_heads', cid: 4, name: 'extra_a', type: 'TEXT', not_null: 0, dflt_value: null, pk: 0,
    };
    assert.deepEqual(
      await inspect(['d1_schema_migrations', 'published_snapshot_heads']),
      [...ledgerRows, ...snapshotRows, extraRow]
    );
    assert.deepEqual(await inspect(['published_snapshot_heads']), [...snapshotRows, extraRow]);
  });
  assert.deepEqual(blockedOutbound, []);
});
