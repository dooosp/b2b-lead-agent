-- B2B Lead Agent D1 Schema
-- Run: npx wrangler d1 execute b2b-leads-db --file=./schema.sql

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL DEFAULT 'self-service',
  source TEXT NOT NULL DEFAULT 'managed',
  status TEXT NOT NULL DEFAULT 'NEW',
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
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_leads_profile ON leads(profile_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
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
