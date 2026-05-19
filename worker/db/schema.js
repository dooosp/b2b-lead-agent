let d1SchemaReadyPromise = null;

export async function ensureD1Schema(db) {
  if (!db) return;
  if (!d1SchemaReadyPromise) {
    d1SchemaReadyPromise = db.batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS leads (
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
      )`),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_leads_identity_key ON leads(identity_key)'),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_leads_profile ON leads(profile_id)'),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status)'),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_leads_review_status ON leads(review_status)'),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at DESC)'),
      db.prepare(`CREATE TABLE IF NOT EXISTS analytics (
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
      )`),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics(created_at DESC)'),
      db.prepare(`CREATE TABLE IF NOT EXISTS status_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lead_id TEXT NOT NULL,
        from_status TEXT NOT NULL,
        to_status TEXT NOT NULL,
        changed_at TEXT NOT NULL
      )`),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_status_log_lead ON status_log(lead_id)'),
      db.prepare(`CREATE TABLE IF NOT EXISTS job_runs (
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
      )`),
      db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_job_runs_idempotency ON job_runs(idempotency_key) WHERE idempotency_key IS NOT NULL AND idempotency_key != ''"),
      db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_job_runs_active_profile ON job_runs(profile_id) WHERE state IN ('accepted', 'running')"),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_job_runs_updated ON job_runs(updated_at DESC)')
    ]).then(async () => {
      const alterCols = [
        "ALTER TABLE leads ADD COLUMN identity_key TEXT DEFAULT ''",
        "ALTER TABLE leads ADD COLUMN review_status TEXT NOT NULL DEFAULT 'NEEDS_REVIEW'",
        "ALTER TABLE leads ADD COLUMN manual_review_notes_author_label TEXT",
        "ALTER TABLE leads ADD COLUMN manual_review_notes_updated_at TEXT",
        "ALTER TABLE leads ADD COLUMN enriched INTEGER DEFAULT 0",
        "ALTER TABLE leads ADD COLUMN article_body TEXT DEFAULT ''",
        "ALTER TABLE leads ADD COLUMN action_items TEXT DEFAULT '[]'",
        "ALTER TABLE leads ADD COLUMN key_figures TEXT DEFAULT '[]'",
        "ALTER TABLE leads ADD COLUMN pain_points TEXT DEFAULT '[]'",
        "ALTER TABLE leads ADD COLUMN enriched_at TEXT",
        "ALTER TABLE leads ADD COLUMN follow_up_date TEXT DEFAULT ''",
        "ALTER TABLE leads ADD COLUMN estimated_value INTEGER DEFAULT 0",
        "ALTER TABLE leads ADD COLUMN meddic TEXT DEFAULT '{}'",
        "ALTER TABLE leads ADD COLUMN competitive TEXT DEFAULT '{}'",
        "ALTER TABLE leads ADD COLUMN buying_signals TEXT DEFAULT '[]'",
        "ALTER TABLE leads ADD COLUMN score_reason TEXT DEFAULT ''",
        "ALTER TABLE leads ADD COLUMN urgency TEXT DEFAULT ''",
        "ALTER TABLE leads ADD COLUMN urgency_reason TEXT DEFAULT ''",
        "ALTER TABLE leads ADD COLUMN buyer_role TEXT DEFAULT ''",
        "ALTER TABLE leads ADD COLUMN evidence TEXT DEFAULT '[]'",
        "ALTER TABLE leads ADD COLUMN confidence TEXT DEFAULT ''",
        "ALTER TABLE leads ADD COLUMN confidence_reason TEXT DEFAULT ''",
        "ALTER TABLE leads ADD COLUMN assumptions TEXT DEFAULT '[]'",
        "ALTER TABLE leads ADD COLUMN generation_mode TEXT DEFAULT 'llm'",
        "ALTER TABLE leads ADD COLUMN verification_status TEXT DEFAULT 'needs_review'",
        "ALTER TABLE leads ADD COLUMN data_gaps TEXT DEFAULT '[]'",
        "ALTER TABLE leads ADD COLUMN event_type TEXT DEFAULT ''"
      ];
      for (const sql of alterCols) {
        try { await db.prepare(sql).run(); } catch { /* column already exists */ }
      }
      try { await db.prepare('CREATE INDEX IF NOT EXISTS idx_leads_identity_key ON leads(identity_key)').run(); } catch { /* index exists */ }
      try { await db.prepare('CREATE INDEX IF NOT EXISTS idx_leads_review_status ON leads(review_status)').run(); } catch { /* index exists */ }
      await db.prepare(`CREATE TABLE IF NOT EXISTS job_runs (
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
      )`).run();
      try { await db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_job_runs_idempotency ON job_runs(idempotency_key) WHERE idempotency_key IS NOT NULL AND idempotency_key != ''").run(); } catch { /* index exists */ }
      try { await db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_job_runs_active_profile ON job_runs(profile_id) WHERE state IN ('accepted', 'running')").run(); } catch { /* index exists */ }
      try { await db.prepare('CREATE INDEX IF NOT EXISTS idx_job_runs_updated ON job_runs(updated_at DESC)').run(); } catch { /* index exists */ }
      await db.prepare(`CREATE TABLE IF NOT EXISTS reference_library (
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
      )`).run();
      try { await db.prepare('CREATE INDEX IF NOT EXISTS idx_ref_profile_cat ON reference_library(profile_id, category)').run(); } catch { /* index exists */ }
    }).catch((err) => {
      d1SchemaReadyPromise = null;
      throw err;
    });
  }
  await d1SchemaReadyPromise;
}
