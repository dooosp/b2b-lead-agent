import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureD1Schema } from '../db/schema.js';
import { FakeD1Database } from './helpers/fake-d1.mjs';

test('D1 schema defaults preserve conservative lead and job-run contracts', async () => {
  const db = new FakeD1Database();

  await ensureD1Schema(db);

  const ddl = db.schemaStatements.join('\n');
  assert.match(ddl, /identity_key TEXT DEFAULT ''/);
  assert.match(ddl, /status TEXT NOT NULL DEFAULT 'NEW'/);
  assert.match(ddl, /review_status TEXT NOT NULL DEFAULT 'NEEDS_REVIEW'/);
  assert.match(ddl, /sources TEXT DEFAULT '\[\]'/);
  assert.match(ddl, /generation_mode TEXT DEFAULT 'llm'/);
  assert.match(ddl, /verification_status TEXT DEFAULT 'needs_review'/);
  assert.match(ddl, /data_gaps TEXT DEFAULT '\[\]'/);
  assert.match(ddl, /target TEXT NOT NULL DEFAULT 'github-actions'/);
  assert.match(ddl, /last_error TEXT DEFAULT ''/);
});
