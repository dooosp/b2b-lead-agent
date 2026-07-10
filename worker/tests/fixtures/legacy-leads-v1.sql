-- Historical leads shape from the initial D1-backed CRM implementation.
-- It intentionally predates identity_key, review_status, and later trust fields.
CREATE TABLE leads (
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
CREATE INDEX idx_leads_profile ON leads(profile_id);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_created ON leads(created_at DESC);
