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
  assert.match(ddl, /manual_review_notes_author_label TEXT/);
  assert.match(ddl, /manual_review_notes_updated_at TEXT/);
  assert.match(ddl, /CREATE TABLE IF NOT EXISTS manual_review_note_events/);
  assert.match(ddl, /lead_id TEXT NOT NULL/);
  assert.match(ddl, /event_type TEXT NOT NULL/);
  assert.match(ddl, /event_type TEXT NOT NULL CHECK \(event_type IN \('create', 'edit', 'clear'\)\)/);
  assert.match(ddl, /changed_at TEXT NOT NULL/);
  assert.match(ddl, /author_label TEXT NOT NULL DEFAULT 'manual_reviewer'/);
  assert.match(ddl, /author_label TEXT NOT NULL DEFAULT 'manual_reviewer' CHECK \(author_label = 'manual_reviewer'\)/);
  assert.match(ddl, /idx_manual_review_note_events_lead/);
  assert.doesNotMatch(ddl, /old_note|new_note|note_text|note_body|previous_value|next_value/i);
  assert.match(ddl, /generation_mode TEXT DEFAULT 'llm'/);
  assert.match(ddl, /verification_status TEXT DEFAULT 'needs_review'/);
  assert.match(ddl, /data_gaps TEXT DEFAULT '\[\]'/);
  assert.match(ddl, /target TEXT NOT NULL DEFAULT 'github-actions'/);
  assert.match(ddl, /last_error TEXT DEFAULT ''/);
});
