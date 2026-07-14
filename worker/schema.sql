-- B2B Lead Agent canonical fresh local/test D1 schema.
-- Production remains HOLD. Use the separately approved explicit migration
-- workflow for an existing database; request handlers never execute this DDL.

CREATE TABLE IF NOT EXISTS d1_schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  identity_key TEXT DEFAULT '',
  profile_id TEXT NOT NULL DEFAULT 'self-service',
  source TEXT NOT NULL DEFAULT 'managed',
  status TEXT NOT NULL DEFAULT 'NEW',
  review_status TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
  company TEXT NOT NULL,
  summary TEXT,
  product TEXT,
  score INTEGER DEFAULT 0,
  grade TEXT DEFAULT 'B',
  roi TEXT,
  sales_pitch TEXT,
  global_context TEXT,
  sources TEXT DEFAULT '[]',
  notes TEXT DEFAULT '',
  manual_review_notes_author_label TEXT,
  manual_review_notes_updated_at TEXT,
  enriched INTEGER DEFAULT 0,
  article_body TEXT DEFAULT '',
  action_items TEXT DEFAULT '[]',
  key_figures TEXT DEFAULT '[]',
  pain_points TEXT DEFAULT '[]',
  enriched_at TEXT,
  follow_up_date TEXT DEFAULT '',
  estimated_value INTEGER DEFAULT 0,
  meddic TEXT DEFAULT '{}',
  competitive TEXT DEFAULT '{}',
  buying_signals TEXT DEFAULT '[]',
  score_reason TEXT DEFAULT '',
  urgency TEXT DEFAULT '',
  urgency_reason TEXT DEFAULT '',
  buyer_role TEXT DEFAULT '',
  evidence TEXT DEFAULT '[]',
  confidence TEXT DEFAULT '',
  confidence_reason TEXT DEFAULT '',
  assumptions TEXT DEFAULT '[]',
  generation_mode TEXT DEFAULT 'llm',
  verification_status TEXT DEFAULT 'needs_review',
  data_gaps TEXT DEFAULT '[]',
  event_type TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_leads_identity_key ON leads(identity_key);
CREATE INDEX IF NOT EXISTS idx_leads_profile ON leads(profile_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_review_status ON leads(review_status);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at DESC);

CREATE TABLE IF NOT EXISTS analytics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  profile_id TEXT,
  company TEXT,
  industry TEXT,
  leads_count INTEGER DEFAULT 0,
  articles_count INTEGER DEFAULT 0,
  elapsed_sec INTEGER DEFAULT 0,
  ip_hash TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics(created_at DESC);

CREATE TABLE IF NOT EXISTS status_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id TEXT NOT NULL,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  changed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_status_log_lead ON status_log(lead_id);

CREATE TABLE IF NOT EXISTS manual_review_note_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('create', 'edit', 'clear')),
  changed_at TEXT NOT NULL,
  author_label TEXT NOT NULL DEFAULT 'manual_reviewer' CHECK (author_label = 'manual_reviewer')
);
CREATE INDEX IF NOT EXISTS idx_manual_review_note_events_lead
  ON manual_review_note_events(lead_id, changed_at DESC);

CREATE TABLE IF NOT EXISTS reviewer_feedback (
  lead_id TEXT PRIMARY KEY,
  action_usefulness TEXT NOT NULL DEFAULT 'unclear' CHECK (action_usefulness IN ('useful', 'partially_useful', 'not_useful', 'unclear')),
  outcome_label TEXT NOT NULL DEFAULT 'unknown' CHECK (outcome_label IN ('interested', 'not_fit', 'no_response', 'needs_more_research', 'duplicate', 'deferred', 'unknown')),
  data_gap_priority TEXT NOT NULL DEFAULT 'none' CHECK (data_gap_priority IN ('none', 'low', 'medium', 'high', 'blocking')),
  evidence_confidence_adjustment TEXT NOT NULL DEFAULT 'unknown' CHECK (evidence_confidence_adjustment IN ('increase', 'decrease', 'unchanged', 'unknown')),
  feedback_text TEXT NOT NULL DEFAULT '',
  next_reviewer_action TEXT NOT NULL DEFAULT '',
  author_label TEXT NOT NULL DEFAULT 'manual_reviewer' CHECK (author_label = 'manual_reviewer'),
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reviewer_feedback_updated
  ON reviewer_feedback(updated_at DESC);

CREATE TABLE IF NOT EXISTS reviewer_feedback_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('create', 'edit', 'clear')),
  changed_at TEXT NOT NULL,
  author_label TEXT NOT NULL DEFAULT 'manual_reviewer' CHECK (author_label = 'manual_reviewer'),
  changed_fields TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_reviewer_feedback_events_lead
  ON reviewer_feedback_events(lead_id, changed_at DESC);

CREATE TABLE IF NOT EXISTS job_runs (
  request_id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT 'github-actions',
  state TEXT NOT NULL,
  idempotency_key TEXT,
  github_event_type TEXT DEFAULT '',
  github_run_id INTEGER,
  github_run_attempt INTEGER,
  github_run_url TEXT DEFAULT '',
  github_workflow TEXT DEFAULT '',
  github_sha TEXT DEFAULT '',
  cloud_run_operation TEXT DEFAULT '',
  cloud_run_execution TEXT DEFAULT '',
  accepted_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  last_error TEXT DEFAULT '',
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_job_runs_idempotency ON job_runs(idempotency_key)
  WHERE idempotency_key IS NOT NULL AND idempotency_key != '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_job_runs_active_profile ON job_runs(profile_id)
  WHERE state IN ('accepted', 'running');
CREATE INDEX IF NOT EXISTS idx_job_runs_updated ON job_runs(updated_at DESC);

CREATE TABLE IF NOT EXISTS reference_library (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id TEXT NOT NULL,
  category TEXT NOT NULL,
  client TEXT NOT NULL,
  project TEXT NOT NULL,
  result TEXT NOT NULL,
  source_url TEXT DEFAULT '',
  region TEXT DEFAULT '',
  verified_at TEXT DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ref_profile_cat
  ON reference_library(profile_id, category);

CREATE TABLE IF NOT EXISTS published_snapshot_heads (
  profile_id TEXT NOT NULL,
  artifact_kind TEXT NOT NULL CHECK (artifact_kind IN ('latest', 'history')),
  snapshot_id TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  PRIMARY KEY (profile_id, artifact_kind)
);

CREATE TABLE IF NOT EXISTS published_snapshot_entries (
  profile_id TEXT NOT NULL,
  artifact_kind TEXT NOT NULL CHECK (artifact_kind IN ('latest', 'history')),
  snapshot_id TEXT NOT NULL,
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  lead_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  PRIMARY KEY (profile_id, artifact_kind, snapshot_id, ordinal),
  UNIQUE (profile_id, artifact_kind, snapshot_id, lead_id)
);
CREATE INDEX IF NOT EXISTS idx_published_snapshot_entries_lookup
  ON published_snapshot_entries(profile_id, artifact_kind, snapshot_id, ordinal);

INSERT OR IGNORE INTO d1_schema_migrations (version, name, applied_at)
  VALUES (1, 'adopt_canonical_lead_schema', CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO d1_schema_migrations (version, name, applied_at)
  VALUES (2, 'separate_published_snapshot_artifacts', CURRENT_TIMESTAMP);
