let d1SchemaReadyPromise = null;

export async function ensureD1Schema(db) {
  if (!db) return;
  if (!d1SchemaReadyPromise) {
    d1SchemaReadyPromise = db.batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS leads (
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
        enriched INTEGER DEFAULT 0,
        article_body TEXT DEFAULT '',
        action_items TEXT DEFAULT '[]',
        key_figures TEXT DEFAULT '[]',
        pain_points TEXT DEFAULT '[]',
        pain_summary TEXT DEFAULT '',
        business_impact TEXT DEFAULT '',
        likely_initiative TEXT DEFAULT '',
        stakeholder_hint TEXT DEFAULT '',
        signal_strength INTEGER DEFAULT 0,
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
        missing_information TEXT DEFAULT '[]',
        event_type TEXT DEFAULT '',
        enriched_at TEXT,
        follow_up_date TEXT DEFAULT '',
        estimated_value INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_leads_profile ON leads(profile_id)'),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status)'),
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
      db.prepare(`CREATE TABLE IF NOT EXISTS company_signals (
        id TEXT PRIMARY KEY,
        lead_id TEXT NOT NULL,
        profile_id TEXT NOT NULL DEFAULT 'self-service',
        company TEXT NOT NULL,
        signal_type TEXT NOT NULL,
        signal_source TEXT NOT NULL,
        source_url TEXT DEFAULT '',
        source_title TEXT DEFAULT '',
        source_published_at TEXT DEFAULT '',
        signal_strength INTEGER DEFAULT 0,
        recency_score INTEGER DEFAULT 0,
        trust_score INTEGER DEFAULT 0,
        pain_hint TEXT DEFAULT '',
        urgency_hint TEXT DEFAULT '',
        business_impact_hint TEXT DEFAULT '',
        raw_excerpt TEXT DEFAULT '',
        structured_evidence_json TEXT DEFAULT '{}',
        created_at TEXT NOT NULL
      )`),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_company_signals_lead ON company_signals(lead_id, created_at DESC)'),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_company_signals_company ON company_signals(profile_id, company, created_at DESC)'),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_company_signals_source_published ON company_signals(source_published_at DESC)')
    ]).then(async () => {
      const alterCols = [
        "ALTER TABLE leads ADD COLUMN enriched INTEGER DEFAULT 0",
        "ALTER TABLE leads ADD COLUMN article_body TEXT DEFAULT ''",
        "ALTER TABLE leads ADD COLUMN action_items TEXT DEFAULT '[]'",
        "ALTER TABLE leads ADD COLUMN key_figures TEXT DEFAULT '[]'",
        "ALTER TABLE leads ADD COLUMN pain_points TEXT DEFAULT '[]'",
        "ALTER TABLE leads ADD COLUMN pain_summary TEXT DEFAULT ''",
        "ALTER TABLE leads ADD COLUMN business_impact TEXT DEFAULT ''",
        "ALTER TABLE leads ADD COLUMN likely_initiative TEXT DEFAULT ''",
        "ALTER TABLE leads ADD COLUMN stakeholder_hint TEXT DEFAULT ''",
        "ALTER TABLE leads ADD COLUMN signal_strength INTEGER DEFAULT 0",
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
        "ALTER TABLE leads ADD COLUMN missing_information TEXT DEFAULT '[]'",
        "ALTER TABLE leads ADD COLUMN event_type TEXT DEFAULT ''"
      ];
      for (const sql of alterCols) {
        try { await db.prepare(sql).run(); } catch { /* column already exists */ }
      }
      try { await db.prepare(`CREATE TABLE IF NOT EXISTS company_signals (
        id TEXT PRIMARY KEY,
        lead_id TEXT NOT NULL,
        profile_id TEXT NOT NULL DEFAULT 'self-service',
        company TEXT NOT NULL,
        signal_type TEXT NOT NULL,
        signal_source TEXT NOT NULL,
        source_url TEXT DEFAULT '',
        source_title TEXT DEFAULT '',
        source_published_at TEXT DEFAULT '',
        signal_strength INTEGER DEFAULT 0,
        recency_score INTEGER DEFAULT 0,
        trust_score INTEGER DEFAULT 0,
        pain_hint TEXT DEFAULT '',
        urgency_hint TEXT DEFAULT '',
        business_impact_hint TEXT DEFAULT '',
        raw_excerpt TEXT DEFAULT '',
        structured_evidence_json TEXT DEFAULT '{}',
        created_at TEXT NOT NULL
      )`).run(); } catch { /* table already exists */ }
      try { await db.prepare('CREATE INDEX IF NOT EXISTS idx_company_signals_lead ON company_signals(lead_id, created_at DESC)').run(); } catch { /* index exists */ }
      try { await db.prepare('CREATE INDEX IF NOT EXISTS idx_company_signals_company ON company_signals(profile_id, company, created_at DESC)').run(); } catch { /* index exists */ }
      try { await db.prepare('CREATE INDEX IF NOT EXISTS idx_company_signals_source_published ON company_signals(source_published_at DESC)').run(); } catch { /* index exists */ }
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
