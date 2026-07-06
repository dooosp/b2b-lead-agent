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
  assert.match(ddl, /CREATE TABLE IF NOT EXISTS reviewer_feedback/);
  assert.match(ddl, /action_usefulness TEXT NOT NULL DEFAULT 'unclear'/);
  assert.match(ddl, /outcome_label TEXT NOT NULL DEFAULT 'unknown'/);
  assert.match(ddl, /data_gap_priority TEXT NOT NULL DEFAULT 'none'/);
  assert.match(ddl, /evidence_confidence_adjustment TEXT NOT NULL DEFAULT 'unknown'/);
  assert.match(ddl, /feedback_text TEXT NOT NULL DEFAULT ''/);
  assert.match(ddl, /next_reviewer_action TEXT NOT NULL DEFAULT ''/);
  assert.match(ddl, /updated_at TEXT NOT NULL/);
  assert.match(ddl, /CREATE TABLE IF NOT EXISTS reviewer_feedback_events/);
  assert.match(ddl, /changed_fields TEXT NOT NULL DEFAULT '\[\]'/);
  assert.match(ddl, /idx_reviewer_feedback_events_lead/);
  assert.match(ddl, /idx_reviewer_feedback_updated/);
  assert.doesNotMatch(ddl, /old_feedback|new_feedback|feedback_body|previous_feedback|next_feedback/i);
  assert.doesNotMatch(ddl, /old_note|new_note|note_text|note_body|previous_value|next_value/i);
  assert.match(ddl, /generation_mode TEXT DEFAULT 'llm'/);
  assert.match(ddl, /verification_status TEXT DEFAULT 'needs_review'/);
  assert.match(ddl, /data_gaps TEXT DEFAULT '\[\]'/);
  assert.match(ddl, /target TEXT NOT NULL DEFAULT 'github-actions'/);
  assert.match(ddl, /last_error TEXT DEFAULT ''/);
});

test('fake D1 enforces manual note event metadata-only constraints', async () => {
  const db = new FakeD1Database();

  await db.prepare(
    'INSERT INTO manual_review_note_events (lead_id, event_type, changed_at, author_label) VALUES (?, ?, ?, ?)'
  ).bind('lead-1', 'create', '2026-05-31T00:00:00.000Z', 'manual_reviewer').run();

  assert.throws(
    () => new FakeD1Database({
      manualReviewNoteEvents: [
        {
          lead_id: 'lead-1',
          event_type: 'restore',
          changed_at: '2026-05-31T00:00:00.000Z',
          author_label: 'manual_reviewer',
        },
      ],
    }),
    /manual_review_note_events\.event_type/
  );
  await assert.rejects(
    db.prepare(
      'INSERT INTO manual_review_note_events (lead_id, event_type, changed_at, author_label) VALUES (?, ?, ?, ?)'
    ).bind('lead-1', 'edit', '2026-05-31T00:00:01.000Z', 'named_reviewer').run(),
    /manual_review_note_events\.author_label/
  );
});

test('fake D1 enforces reviewer feedback event metadata-only constraints', async () => {
  const db = new FakeD1Database();

  await db.prepare(
    'INSERT INTO reviewer_feedback_events (lead_id, event_type, changed_at, author_label, changed_fields) VALUES (?, ?, ?, ?, ?)'
  ).bind('lead-1', 'create', '2026-05-31T00:00:00.000Z', 'manual_reviewer', JSON.stringify(['feedbackText'])).run();

  assert.throws(
    () => new FakeD1Database({
      reviewerFeedbackEvents: [
        {
          lead_id: 'lead-1',
          event_type: 'restore',
          changed_at: '2026-05-31T00:00:00.000Z',
          author_label: 'manual_reviewer',
          changed_fields: '["feedbackText"]',
        },
      ],
    }),
    /reviewer_feedback_events\.event_type/
  );
  await assert.rejects(
    db.prepare(
      'INSERT INTO reviewer_feedback_events (lead_id, event_type, changed_at, author_label, changed_fields) VALUES (?, ?, ?, ?, ?)'
    ).bind('lead-1', 'edit', '2026-05-31T00:00:01.000Z', 'named_reviewer', JSON.stringify(['outcomeLabel'])).run(),
    /reviewer_feedback_events\.author_label/
  );
});
