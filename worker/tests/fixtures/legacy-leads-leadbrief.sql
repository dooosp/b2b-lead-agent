-- Historical LeadBrief-era leads shape. It has the columns needed by the
-- eager index batch but predates later lazy-migrated reviewer and evidence fields.
CREATE TABLE leads (
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
  enriched INTEGER DEFAULT 0,
  article_body TEXT DEFAULT '',
  action_items TEXT DEFAULT '[]',
  key_figures TEXT DEFAULT '[]',
  pain_points TEXT DEFAULT '[]',
  enriched_at TEXT,
  follow_up_date TEXT DEFAULT '',
  estimated_value INTEGER DEFAULT 0,
  generation_mode TEXT DEFAULT 'llm',
  verification_status TEXT DEFAULT 'needs_review',
  data_gaps TEXT DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_leads_identity_key ON leads(identity_key);
CREATE INDEX idx_leads_profile ON leads(profile_id);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_review_status ON leads(review_status);
CREATE INDEX idx_leads_created ON leads(created_at DESC);
