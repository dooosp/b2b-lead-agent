export const D1_SCHEMA_MIGRATION_TABLE = 'd1_schema_migrations';
export const LATEST_D1_SCHEMA_VERSION = 3;

export const V1_LEADS_COLUMN_DEFINITIONS = Object.freeze([
  Object.freeze({ name: 'id', definition: 'TEXT PRIMARY KEY' }),
  Object.freeze({ name: 'identity_key', definition: "TEXT DEFAULT ''" }),
  Object.freeze({ name: 'profile_id', definition: "TEXT NOT NULL DEFAULT 'self-service'" }),
  Object.freeze({ name: 'source', definition: "TEXT NOT NULL DEFAULT 'managed'" }),
  Object.freeze({ name: 'status', definition: "TEXT NOT NULL DEFAULT 'NEW'" }),
  Object.freeze({ name: 'review_status', definition: "TEXT NOT NULL DEFAULT 'NEEDS_REVIEW'" }),
  Object.freeze({ name: 'company', definition: 'TEXT NOT NULL' }),
  Object.freeze({ name: 'summary', definition: 'TEXT' }),
  Object.freeze({ name: 'product', definition: 'TEXT' }),
  Object.freeze({ name: 'score', definition: 'INTEGER DEFAULT 0' }),
  Object.freeze({ name: 'grade', definition: "TEXT DEFAULT 'B'" }),
  Object.freeze({ name: 'roi', definition: 'TEXT' }),
  Object.freeze({ name: 'sales_pitch', definition: 'TEXT' }),
  Object.freeze({ name: 'global_context', definition: 'TEXT' }),
  Object.freeze({ name: 'sources', definition: "TEXT DEFAULT '[]'" }),
  Object.freeze({ name: 'notes', definition: "TEXT DEFAULT ''" }),
  Object.freeze({ name: 'manual_review_notes_author_label', definition: 'TEXT' }),
  Object.freeze({ name: 'manual_review_notes_updated_at', definition: 'TEXT' }),
  Object.freeze({ name: 'enriched', definition: 'INTEGER DEFAULT 0' }),
  Object.freeze({ name: 'article_body', definition: "TEXT DEFAULT ''" }),
  Object.freeze({ name: 'action_items', definition: "TEXT DEFAULT '[]'" }),
  Object.freeze({ name: 'key_figures', definition: "TEXT DEFAULT '[]'" }),
  Object.freeze({ name: 'pain_points', definition: "TEXT DEFAULT '[]'" }),
  Object.freeze({ name: 'enriched_at', definition: 'TEXT' }),
  Object.freeze({ name: 'follow_up_date', definition: "TEXT DEFAULT ''" }),
  Object.freeze({ name: 'estimated_value', definition: 'INTEGER DEFAULT 0' }),
  Object.freeze({ name: 'meddic', definition: "TEXT DEFAULT '{}'" }),
  Object.freeze({ name: 'competitive', definition: "TEXT DEFAULT '{}'" }),
  Object.freeze({ name: 'buying_signals', definition: "TEXT DEFAULT '[]'" }),
  Object.freeze({ name: 'score_reason', definition: "TEXT DEFAULT ''" }),
  Object.freeze({ name: 'urgency', definition: "TEXT DEFAULT ''" }),
  Object.freeze({ name: 'urgency_reason', definition: "TEXT DEFAULT ''" }),
  Object.freeze({ name: 'buyer_role', definition: "TEXT DEFAULT ''" }),
  Object.freeze({ name: 'evidence', definition: "TEXT DEFAULT '[]'" }),
  Object.freeze({ name: 'confidence', definition: "TEXT DEFAULT ''" }),
  Object.freeze({ name: 'confidence_reason', definition: "TEXT DEFAULT ''" }),
  Object.freeze({ name: 'assumptions', definition: "TEXT DEFAULT '[]'" }),
  Object.freeze({ name: 'generation_mode', definition: "TEXT DEFAULT 'llm'" }),
  Object.freeze({ name: 'verification_status', definition: "TEXT DEFAULT 'needs_review'" }),
  Object.freeze({ name: 'data_gaps', definition: "TEXT DEFAULT '[]'" }),
  Object.freeze({ name: 'event_type', definition: "TEXT DEFAULT ''" }),
  Object.freeze({ name: 'created_at', definition: 'TEXT NOT NULL' }),
  Object.freeze({ name: 'updated_at', definition: 'TEXT NOT NULL' }),
]);

export const LEADS_COLUMN_DEFINITIONS = Object.freeze([
  Object.freeze({ name: 'id', definition: 'TEXT PRIMARY KEY' }),
  Object.freeze({ name: 'identity_key', definition: "TEXT DEFAULT ''" }),
  Object.freeze({ name: 'profile_id', definition: "TEXT NOT NULL DEFAULT 'self-service'" }),
  Object.freeze({ name: 'source', definition: "TEXT NOT NULL DEFAULT 'managed'" }),
  Object.freeze({ name: 'status', definition: "TEXT NOT NULL DEFAULT 'NEW'" }),
  Object.freeze({ name: 'review_status', definition: "TEXT NOT NULL DEFAULT 'NEEDS_REVIEW'" }),
  Object.freeze({ name: 'company', definition: 'TEXT NOT NULL' }),
  Object.freeze({ name: 'summary', definition: 'TEXT' }),
  Object.freeze({ name: 'product', definition: 'TEXT' }),
  Object.freeze({ name: 'score', definition: 'INTEGER DEFAULT 0' }),
  Object.freeze({ name: 'grade', definition: "TEXT DEFAULT 'B'" }),
  Object.freeze({ name: 'roi', definition: 'TEXT' }),
  Object.freeze({ name: 'sales_pitch', definition: 'TEXT' }),
  Object.freeze({ name: 'global_context', definition: 'TEXT' }),
  Object.freeze({ name: 'sources', definition: "TEXT DEFAULT '[]'" }),
  Object.freeze({ name: 'notes', definition: "TEXT DEFAULT ''" }),
  Object.freeze({ name: 'manual_review_notes_author_label', definition: 'TEXT' }),
  Object.freeze({ name: 'manual_review_notes_updated_at', definition: 'TEXT' }),
  Object.freeze({ name: 'enriched', definition: 'INTEGER DEFAULT 0' }),
  Object.freeze({ name: 'article_body', definition: "TEXT DEFAULT ''" }),
  Object.freeze({ name: 'action_items', definition: "TEXT DEFAULT '[]'" }),
  Object.freeze({ name: 'key_figures', definition: "TEXT DEFAULT '[]'" }),
  Object.freeze({ name: 'pain_points', definition: "TEXT DEFAULT '[]'" }),
  Object.freeze({ name: 'enriched_at', definition: 'TEXT' }),
  Object.freeze({ name: 'follow_up_date', definition: "TEXT DEFAULT ''" }),
  Object.freeze({ name: 'estimated_value', definition: 'INTEGER DEFAULT 0' }),
  Object.freeze({ name: 'meddic', definition: "TEXT DEFAULT '{}'" }),
  Object.freeze({ name: 'competitive', definition: "TEXT DEFAULT '{}'" }),
  Object.freeze({ name: 'buying_signals', definition: "TEXT DEFAULT '[]'" }),
  Object.freeze({ name: 'score_reason', definition: "TEXT DEFAULT ''" }),
  Object.freeze({ name: 'urgency', definition: "TEXT DEFAULT ''" }),
  Object.freeze({ name: 'urgency_reason', definition: "TEXT DEFAULT ''" }),
  Object.freeze({ name: 'buyer_role', definition: "TEXT DEFAULT ''" }),
  Object.freeze({ name: 'evidence', definition: "TEXT DEFAULT '[]'" }),
  Object.freeze({ name: 'confidence', definition: "TEXT DEFAULT ''" }),
  Object.freeze({ name: 'confidence_reason', definition: "TEXT DEFAULT ''" }),
  Object.freeze({ name: 'assumptions', definition: "TEXT DEFAULT '[]'" }),
  Object.freeze({ name: 'generation_mode', definition: "TEXT DEFAULT 'llm'" }),
  Object.freeze({ name: 'verification_status', definition: "TEXT DEFAULT 'needs_review'" }),
  Object.freeze({ name: 'data_gaps', definition: "TEXT DEFAULT '[]'" }),
  Object.freeze({ name: 'event_type', definition: "TEXT DEFAULT ''" }),
  Object.freeze({ name: 'created_at', definition: 'TEXT NOT NULL' }),
  Object.freeze({ name: 'updated_at', definition: 'TEXT NOT NULL' }),
  Object.freeze({ name: 'version', definition: 'INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)' }),
  Object.freeze({ name: 'last_patch_mutation_id', definition: "TEXT NOT NULL DEFAULT ''" }),
]);

export const V3_LEADS_COLUMN_DEFINITIONS = Object.freeze(
  LEADS_COLUMN_DEFINITIONS.slice(V1_LEADS_COLUMN_DEFINITIONS.length)
);

export const V3_JOB_RUN_COLUMN_DEFINITIONS = Object.freeze([
  Object.freeze({ name: 'provider_attempt', definition: 'INTEGER NOT NULL DEFAULT 0 CHECK (provider_attempt >= 0)' }),
  Object.freeze({ name: 'last_callback_event_id', definition: "TEXT NOT NULL DEFAULT ''" }),
]);

const JOB_RUN_COLUMN_DEFINITIONS = Object.freeze([
  Object.freeze({ name: 'request_id', definition: 'TEXT PRIMARY KEY' }),
  Object.freeze({ name: 'profile_id', definition: 'TEXT NOT NULL' }),
  Object.freeze({ name: 'target', definition: "TEXT NOT NULL DEFAULT 'github-actions'" }),
  Object.freeze({ name: 'state', definition: 'TEXT NOT NULL' }),
  Object.freeze({ name: 'idempotency_key', definition: 'TEXT' }),
  Object.freeze({ name: 'github_event_type', definition: "TEXT DEFAULT ''" }),
  Object.freeze({ name: 'github_run_id', definition: 'INTEGER' }),
  Object.freeze({ name: 'github_run_attempt', definition: 'INTEGER' }),
  Object.freeze({ name: 'github_run_url', definition: "TEXT DEFAULT ''" }),
  Object.freeze({ name: 'github_workflow', definition: "TEXT DEFAULT ''" }),
  Object.freeze({ name: 'github_sha', definition: "TEXT DEFAULT ''" }),
  Object.freeze({ name: 'cloud_run_operation', definition: "TEXT DEFAULT ''" }),
  Object.freeze({ name: 'cloud_run_execution', definition: "TEXT DEFAULT ''" }),
  Object.freeze({ name: 'accepted_at', definition: 'TEXT NOT NULL' }),
  Object.freeze({ name: 'started_at', definition: 'TEXT' }),
  Object.freeze({ name: 'completed_at', definition: 'TEXT' }),
  Object.freeze({ name: 'last_error', definition: "TEXT DEFAULT ''" }),
  Object.freeze({ name: 'updated_at', definition: 'TEXT NOT NULL' }),
  ...V3_JOB_RUN_COLUMN_DEFINITIONS,
]);

export const CREATE_CANONICAL_LEADS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS leads (
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
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  last_patch_mutation_id TEXT NOT NULL DEFAULT ''
)`;

export const CREATE_CANONICAL_JOB_RUNS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS job_runs (
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
  updated_at TEXT NOT NULL,
  provider_attempt INTEGER NOT NULL DEFAULT 0 CHECK (provider_attempt >= 0),
  last_callback_event_id TEXT NOT NULL DEFAULT ''
)`;

export const CREATE_MIGRATION_LEDGER_SQL = `CREATE TABLE IF NOT EXISTS d1_schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
)`;

export const CREATE_LEADS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS leads (
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
)`;

export const V1_CREATE_TABLE_STATEMENTS = Object.freeze([
  CREATE_LEADS_TABLE_SQL,
  `CREATE TABLE IF NOT EXISTS analytics (
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
  )`,
  `CREATE TABLE IF NOT EXISTS status_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id TEXT NOT NULL,
    from_status TEXT NOT NULL,
    to_status TEXT NOT NULL,
    changed_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS manual_review_note_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('create', 'edit', 'clear')),
    changed_at TEXT NOT NULL,
    author_label TEXT NOT NULL DEFAULT 'manual_reviewer' CHECK (author_label = 'manual_reviewer')
  )`,
  `CREATE TABLE IF NOT EXISTS reviewer_feedback (
    lead_id TEXT PRIMARY KEY,
    action_usefulness TEXT NOT NULL DEFAULT 'unclear' CHECK (action_usefulness IN ('useful', 'partially_useful', 'not_useful', 'unclear')),
    outcome_label TEXT NOT NULL DEFAULT 'unknown' CHECK (outcome_label IN ('interested', 'not_fit', 'no_response', 'needs_more_research', 'duplicate', 'deferred', 'unknown')),
    data_gap_priority TEXT NOT NULL DEFAULT 'none' CHECK (data_gap_priority IN ('none', 'low', 'medium', 'high', 'blocking')),
    evidence_confidence_adjustment TEXT NOT NULL DEFAULT 'unknown' CHECK (evidence_confidence_adjustment IN ('increase', 'decrease', 'unchanged', 'unknown')),
    feedback_text TEXT NOT NULL DEFAULT '',
    next_reviewer_action TEXT NOT NULL DEFAULT '',
    author_label TEXT NOT NULL DEFAULT 'manual_reviewer' CHECK (author_label = 'manual_reviewer'),
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS reviewer_feedback_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('create', 'edit', 'clear')),
    changed_at TEXT NOT NULL,
    author_label TEXT NOT NULL DEFAULT 'manual_reviewer' CHECK (author_label = 'manual_reviewer'),
    changed_fields TEXT NOT NULL DEFAULT '[]'
  )`,
  `CREATE TABLE IF NOT EXISTS job_runs (
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
  )`,
  `CREATE TABLE IF NOT EXISTS reference_library (
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
  )`,
]);

export const V1_INDEX_STATEMENTS = Object.freeze([
  'CREATE INDEX IF NOT EXISTS idx_leads_identity_key ON leads(identity_key)',
  'CREATE INDEX IF NOT EXISTS idx_leads_profile ON leads(profile_id)',
  'CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status)',
  'CREATE INDEX IF NOT EXISTS idx_leads_review_status ON leads(review_status)',
  'CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics(created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_status_log_lead ON status_log(lead_id)',
  'CREATE INDEX IF NOT EXISTS idx_manual_review_note_events_lead ON manual_review_note_events(lead_id, changed_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_reviewer_feedback_updated ON reviewer_feedback(updated_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_reviewer_feedback_events_lead ON reviewer_feedback_events(lead_id, changed_at DESC)',
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_job_runs_idempotency ON job_runs(idempotency_key) WHERE idempotency_key IS NOT NULL AND idempotency_key != ''",
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_job_runs_active_profile ON job_runs(profile_id) WHERE state IN ('accepted', 'running')",
  'CREATE INDEX IF NOT EXISTS idx_job_runs_updated ON job_runs(updated_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_ref_profile_cat ON reference_library(profile_id, category)',
]);

export const V2_CREATE_TABLE_STATEMENTS = Object.freeze([
  `CREATE TABLE IF NOT EXISTS published_snapshot_heads (
    profile_id TEXT NOT NULL,
    artifact_kind TEXT NOT NULL CHECK (artifact_kind IN ('latest', 'history')),
    snapshot_id TEXT NOT NULL,
    fetched_at TEXT NOT NULL,
    PRIMARY KEY (profile_id, artifact_kind)
  )`,
  `CREATE TABLE IF NOT EXISTS published_snapshot_entries (
    profile_id TEXT NOT NULL,
    artifact_kind TEXT NOT NULL CHECK (artifact_kind IN ('latest', 'history')),
    snapshot_id TEXT NOT NULL,
    ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
    lead_id TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    PRIMARY KEY (profile_id, artifact_kind, snapshot_id, ordinal),
    UNIQUE (profile_id, artifact_kind, snapshot_id, lead_id)
  )`,
]);

export const V2_INDEX_STATEMENTS = Object.freeze([
  'CREATE INDEX IF NOT EXISTS idx_published_snapshot_entries_lookup ON published_snapshot_entries(profile_id, artifact_kind, snapshot_id, ordinal)',
]);

export const V3_CREATE_TABLE_STATEMENTS = Object.freeze([
  `CREATE TABLE IF NOT EXISTS job_callback_events (
    event_id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    payload_hash TEXT NOT NULL,
    target TEXT NOT NULL,
    provider_attempt INTEGER NOT NULL CHECK (provider_attempt >= 1),
    state TEXT NOT NULL CHECK (state IN ('running', 'succeeded', 'failed', 'cancelled')),
    outcome TEXT NOT NULL CHECK (outcome IN ('applied', 'rejected')),
    received_at TEXT NOT NULL,
    UNIQUE (request_id, idempotency_key)
  )`,
]);

export const V3_INDEX_STATEMENTS = Object.freeze([]);

export function normalizeD1SchemaSql(sql) {
  return String(sql || '')
    .replace(/\bIF\s+NOT\s+EXISTS\b/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([(),])\s*/g, '$1')
    .trim();
}

function indexSpec(sql) {
  const match = /^CREATE\s+(UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS\s+([A-Za-z_][A-Za-z0-9_]*)\s+ON\s+([A-Za-z_][A-Za-z0-9_]*)/i.exec(sql);
  if (!match) throw new Error(`Invalid canonical D1 index SQL: ${sql}`);
  return Object.freeze({
    name: match[2],
    tableName: match[3],
    unique: Boolean(match[1]),
    normalizedSql: normalizeD1SchemaSql(sql),
  });
}

export const V1_INDEX_SPECS = Object.freeze(V1_INDEX_STATEMENTS.map(indexSpec));
export const V2_INDEX_SPECS = Object.freeze(V2_INDEX_STATEMENTS.map(indexSpec));
export const V3_INDEX_SPECS = Object.freeze(V3_INDEX_STATEMENTS.map(indexSpec));
export const CANONICAL_D1_INDEX_SPECS = Object.freeze([
  ...V1_INDEX_SPECS,
  ...V2_INDEX_SPECS,
  ...V3_INDEX_SPECS,
]);

export const CANONICAL_D1_TABLE_SQL_FRAGMENTS = Object.freeze({
  leads: Object.freeze([
    'CHECK (version >= 1)',
  ]),
  manual_review_note_events: Object.freeze([
    "CHECK (event_type IN ('create', 'edit', 'clear'))",
    "CHECK (author_label = 'manual_reviewer')",
  ]),
  reviewer_feedback: Object.freeze([
    "CHECK (action_usefulness IN ('useful', 'partially_useful', 'not_useful', 'unclear'))",
    "CHECK (outcome_label IN ('interested', 'not_fit', 'no_response', 'needs_more_research', 'duplicate', 'deferred', 'unknown'))",
    "CHECK (data_gap_priority IN ('none', 'low', 'medium', 'high', 'blocking'))",
    "CHECK (evidence_confidence_adjustment IN ('increase', 'decrease', 'unchanged', 'unknown'))",
    "CHECK (author_label = 'manual_reviewer')",
  ]),
  reviewer_feedback_events: Object.freeze([
    "CHECK (event_type IN ('create', 'edit', 'clear'))",
    "CHECK (author_label = 'manual_reviewer')",
  ]),
  job_runs: Object.freeze([
    'CHECK (provider_attempt >= 0)',
  ]),
  job_callback_events: Object.freeze([
    'CHECK (provider_attempt >= 1)',
    "CHECK (state IN ('running', 'succeeded', 'failed', 'cancelled'))",
    "CHECK (outcome IN ('applied', 'rejected'))",
    'UNIQUE (request_id, idempotency_key)',
  ]),
  published_snapshot_heads: Object.freeze([
    "CHECK (artifact_kind IN ('latest', 'history'))",
  ]),
  published_snapshot_entries: Object.freeze([
    "CHECK (artifact_kind IN ('latest', 'history'))",
    'CHECK (ordinal >= 0)',
    'UNIQUE (profile_id, artifact_kind, snapshot_id, lead_id)',
  ]),
});

function createTableSpec(sql) {
  const match = /^CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+([A-Za-z_][A-Za-z0-9_]*)/i.exec(sql);
  if (!match) throw new Error(`Invalid canonical D1 table SQL: ${sql}`);
  return Object.freeze({
    name: match[1],
    normalizedSql: normalizeD1SchemaSql(sql),
  });
}

export const CANONICAL_D1_TABLE_SPECS = Object.freeze(
  [
    CREATE_MIGRATION_LEDGER_SQL,
    CREATE_CANONICAL_LEADS_TABLE_SQL,
    CREATE_CANONICAL_JOB_RUNS_TABLE_SQL,
    ...V1_CREATE_TABLE_STATEMENTS.filter((sql) => !/CREATE TABLE IF NOT EXISTS (?:leads|job_runs)\b/i.test(sql)),
    ...V2_CREATE_TABLE_STATEMENTS,
    ...V3_CREATE_TABLE_STATEMENTS,
  ]
    .map(createTableSpec)
);

function columnSpec(type, notNull = 0, pk = 0, defaultValue = null) {
  return Object.freeze({ type, notNull, pk, defaultValue });
}

function leadColumnSpec(definition) {
  const type = definition.trim().split(/\s+/, 1)[0].toUpperCase();
  const defaultMatch = /\bDEFAULT\s+((?:'[^']*')|(?:"[^"]*")|[^\s]+)/i.exec(definition);
  return columnSpec(
    type,
    /\bNOT\s+NULL\b/i.test(definition) ? 1 : 0,
    /\bPRIMARY\s+KEY\b/i.test(definition) ? 1 : 0,
    defaultMatch ? defaultMatch[1].trim() : null
  );
}

export const CANONICAL_D1_TABLE_COLUMN_NAMES = Object.freeze({
  d1_schema_migrations: Object.freeze(['version', 'name', 'applied_at']),
  leads: Object.freeze(LEADS_COLUMN_DEFINITIONS.map(({ name }) => name)),
  analytics: Object.freeze([
    'id', 'type', 'profile_id', 'company', 'industry', 'leads_count',
    'articles_count', 'elapsed_sec', 'ip_hash', 'created_at',
  ]),
  status_log: Object.freeze(['id', 'lead_id', 'from_status', 'to_status', 'changed_at']),
  manual_review_note_events: Object.freeze([
    'id', 'lead_id', 'event_type', 'changed_at', 'author_label',
  ]),
  reviewer_feedback: Object.freeze([
    'lead_id', 'action_usefulness', 'outcome_label', 'data_gap_priority',
    'evidence_confidence_adjustment', 'feedback_text', 'next_reviewer_action',
    'author_label', 'updated_at',
  ]),
  reviewer_feedback_events: Object.freeze([
    'id', 'lead_id', 'event_type', 'changed_at', 'author_label', 'changed_fields',
  ]),
  job_runs: Object.freeze([
    'request_id', 'profile_id', 'target', 'state', 'idempotency_key',
    'github_event_type', 'github_run_id', 'github_run_attempt', 'github_run_url',
    'github_workflow', 'github_sha', 'cloud_run_operation',
    'cloud_run_execution', 'accepted_at', 'started_at', 'completed_at',
    'last_error', 'updated_at', 'provider_attempt', 'last_callback_event_id',
  ]),
  job_callback_events: Object.freeze([
    'event_id', 'request_id', 'idempotency_key', 'payload_hash', 'target',
    'provider_attempt', 'state', 'outcome', 'received_at',
  ]),
  reference_library: Object.freeze([
    'id', 'profile_id', 'category', 'client', 'project', 'result', 'source_url',
    'region', 'verified_at', 'created_at',
  ]),
  published_snapshot_heads: Object.freeze([
    'profile_id', 'artifact_kind', 'snapshot_id', 'fetched_at',
  ]),
  published_snapshot_entries: Object.freeze([
    'profile_id', 'artifact_kind', 'snapshot_id', 'ordinal', 'lead_id', 'payload_json',
  ]),
});

export const CANONICAL_D1_CRITICAL_COLUMN_SPECS = Object.freeze({
  d1_schema_migrations: Object.freeze({
    version: columnSpec('INTEGER', 0, 1),
    name: columnSpec('TEXT', 1),
    applied_at: columnSpec('TEXT', 1),
  }),
  leads: Object.freeze(Object.fromEntries(
    LEADS_COLUMN_DEFINITIONS.map(({ name, definition }) => [name, leadColumnSpec(definition)])
  )),
  analytics: Object.freeze({
    id: columnSpec('INTEGER', 0, 1),
    type: columnSpec('TEXT', 1),
    profile_id: columnSpec('TEXT'),
    company: columnSpec('TEXT'),
    industry: columnSpec('TEXT'),
    leads_count: columnSpec('INTEGER', 0, 0, '0'),
    articles_count: columnSpec('INTEGER', 0, 0, '0'),
    elapsed_sec: columnSpec('INTEGER', 0, 0, '0'),
    ip_hash: columnSpec('TEXT'),
    created_at: columnSpec('TEXT', 1),
  }),
  status_log: Object.freeze({
    id: columnSpec('INTEGER', 0, 1),
    lead_id: columnSpec('TEXT', 1),
    from_status: columnSpec('TEXT', 1),
    to_status: columnSpec('TEXT', 1),
    changed_at: columnSpec('TEXT', 1),
  }),
  manual_review_note_events: Object.freeze({
    id: columnSpec('INTEGER', 0, 1),
    lead_id: columnSpec('TEXT', 1),
    event_type: columnSpec('TEXT', 1),
    changed_at: columnSpec('TEXT', 1),
    author_label: columnSpec('TEXT', 1, 0, "'manual_reviewer'"),
  }),
  reviewer_feedback: Object.freeze({
    lead_id: columnSpec('TEXT', 0, 1),
    action_usefulness: columnSpec('TEXT', 1, 0, "'unclear'"),
    outcome_label: columnSpec('TEXT', 1, 0, "'unknown'"),
    data_gap_priority: columnSpec('TEXT', 1, 0, "'none'"),
    evidence_confidence_adjustment: columnSpec('TEXT', 1, 0, "'unknown'"),
    feedback_text: columnSpec('TEXT', 1, 0, "''"),
    next_reviewer_action: columnSpec('TEXT', 1, 0, "''"),
    author_label: columnSpec('TEXT', 1, 0, "'manual_reviewer'"),
    updated_at: columnSpec('TEXT', 1),
  }),
  reviewer_feedback_events: Object.freeze({
    id: columnSpec('INTEGER', 0, 1),
    lead_id: columnSpec('TEXT', 1),
    event_type: columnSpec('TEXT', 1),
    changed_at: columnSpec('TEXT', 1),
    author_label: columnSpec('TEXT', 1, 0, "'manual_reviewer'"),
    changed_fields: columnSpec('TEXT', 1, 0, "'[]'"),
  }),
  job_runs: Object.freeze({
    request_id: columnSpec('TEXT', 0, 1),
    profile_id: columnSpec('TEXT', 1),
    target: columnSpec('TEXT', 1, 0, "'github-actions'"),
    state: columnSpec('TEXT', 1),
    idempotency_key: columnSpec('TEXT'),
    github_event_type: columnSpec('TEXT', 0, 0, "''"),
    github_run_id: columnSpec('INTEGER'),
    github_run_attempt: columnSpec('INTEGER'),
    github_run_url: columnSpec('TEXT', 0, 0, "''"),
    github_workflow: columnSpec('TEXT', 0, 0, "''"),
    github_sha: columnSpec('TEXT', 0, 0, "''"),
    cloud_run_operation: columnSpec('TEXT', 0, 0, "''"),
    cloud_run_execution: columnSpec('TEXT', 0, 0, "''"),
    accepted_at: columnSpec('TEXT', 1),
    started_at: columnSpec('TEXT'),
    completed_at: columnSpec('TEXT'),
    last_error: columnSpec('TEXT', 0, 0, "''"),
    updated_at: columnSpec('TEXT', 1),
    provider_attempt: columnSpec('INTEGER', 1, 0, '0'),
    last_callback_event_id: columnSpec('TEXT', 1, 0, "''"),
  }),
  job_callback_events: Object.freeze({
    event_id: columnSpec('TEXT', 0, 1),
    request_id: columnSpec('TEXT', 1),
    idempotency_key: columnSpec('TEXT', 1),
    payload_hash: columnSpec('TEXT', 1),
    target: columnSpec('TEXT', 1),
    provider_attempt: columnSpec('INTEGER', 1),
    state: columnSpec('TEXT', 1),
    outcome: columnSpec('TEXT', 1),
    received_at: columnSpec('TEXT', 1),
  }),
  reference_library: Object.freeze({
    id: columnSpec('INTEGER', 0, 1),
    profile_id: columnSpec('TEXT', 1),
    category: columnSpec('TEXT', 1),
    client: columnSpec('TEXT', 1),
    project: columnSpec('TEXT', 1),
    result: columnSpec('TEXT', 1),
    source_url: columnSpec('TEXT', 0, 0, "''"),
    region: columnSpec('TEXT', 0, 0, "''"),
    verified_at: columnSpec('TEXT', 0, 0, "''"),
    created_at: columnSpec('TEXT', 1),
  }),
  published_snapshot_heads: Object.freeze({
    profile_id: columnSpec('TEXT', 1, 1),
    artifact_kind: columnSpec('TEXT', 1, 2),
    snapshot_id: columnSpec('TEXT', 1),
    fetched_at: columnSpec('TEXT', 1),
  }),
  published_snapshot_entries: Object.freeze({
    profile_id: columnSpec('TEXT', 1, 1),
    artifact_kind: columnSpec('TEXT', 1, 2),
    snapshot_id: columnSpec('TEXT', 1, 3),
    ordinal: columnSpec('INTEGER', 1, 4),
    lead_id: columnSpec('TEXT', 1),
    payload_json: columnSpec('TEXT', 1),
  }),
});

export function buildD1SchemaIntrospectionQuery(tableNames = Object.keys(CANONICAL_D1_TABLE_COLUMN_NAMES)) {
  const rowLimit = tableNames.reduce(
    (total, tableName) => total + (CANONICAL_D1_TABLE_COLUMN_NAMES[tableName]?.length || 0),
    0
  ) + 1;
  const query = tableNames.map((tableName) => {
    if (!Object.hasOwn(CANONICAL_D1_TABLE_COLUMN_NAMES, tableName)) {
      throw new Error(`Unknown canonical D1 table: ${tableName}`);
    }
    return `SELECT '${tableName}' AS table_name, cid, name, type, "notnull" AS not_null, `
      + `dflt_value, pk FROM pragma_table_info('${tableName}')`;
  }).join(' UNION ALL ');
  return `${query} LIMIT ${rowLimit}`;
}

function normalizedDefault(value) {
  return value === null || value === undefined ? null : String(value).trim();
}

export function validateD1SchemaIntrospection(rows, {
  tableNames = Object.keys(CANONICAL_D1_TABLE_COLUMN_NAMES),
  allowMissingTables = false,
  allowLegacyLeadSubset = false,
  expectedColumnNamesByTable = CANONICAL_D1_TABLE_COLUMN_NAMES,
  allowedExtraColumnNamesByTable = {},
  allowedMissingColumnNamesByTable = {},
} = {}) {
  const errors = [];
  for (const tableName of tableNames) {
    const expectedNames = expectedColumnNamesByTable[tableName]
      || CANONICAL_D1_TABLE_COLUMN_NAMES[tableName];
    if (!expectedNames) {
      errors.push(`unknown canonical table ${tableName}`);
      continue;
    }
    const tableRows = rows.filter((row) => row.table_name === tableName);
    if (tableRows.length === 0) {
      if (!allowMissingTables) errors.push(`${tableName} table is missing`);
      continue;
    }

    const actualNames = tableRows.map((row) => String(row.name || ''));
    const allowedExtra = new Set(allowedExtraColumnNamesByTable[tableName] || []);
    const allowedMissing = new Set(allowedMissingColumnNamesByTable[tableName] || []);
    const unexpected = actualNames.filter((name) => !expectedNames.includes(name) && !allowedExtra.has(name));
    const missing = expectedNames.filter((name) => !actualNames.includes(name) && !allowedMissing.has(name));
    if (unexpected.length > 0) {
      errors.push(`${tableName} has unexpected columns: ${unexpected.join(', ')}`);
    }
    if (missing.length > 0 && !(allowLegacyLeadSubset && tableName === 'leads')) {
      errors.push(`${tableName} is missing columns: ${missing.join(', ')}`);
    }
    if (allowLegacyLeadSubset && tableName === 'leads' && !actualNames.includes('id')) {
      errors.push('leads legacy subset is missing required id primary key column');
    }

    const criticalSpecs = CANONICAL_D1_CRITICAL_COLUMN_SPECS[tableName] || {};
    for (const [columnName, expected] of Object.entries(criticalSpecs)) {
      if (!expectedNames.includes(columnName) && !allowedExtra.has(columnName)) continue;
      const actual = tableRows.find((row) => row.name === columnName);
      if (!actual) continue;
      const actualShape = {
        type: String(actual.type || '').toUpperCase(),
        notNull: Number(actual.not_null ?? actual.notnull ?? 0),
        pk: Number(actual.pk || 0),
        defaultValue: normalizedDefault(actual.dflt_value),
      };
      for (const property of ['type', 'notNull', 'pk', 'defaultValue']) {
        if (actualShape[property] !== expected[property]) {
          errors.push(
            `${tableName}.${columnName} ${property} mismatch: `
            + `${String(actualShape[property])} !== ${String(expected[property])}`
          );
        }
      }
    }
  }
  return errors;
}

export function buildD1SchemaObjectIntrospectionQuery(
  tableNames = Object.keys(CANONICAL_D1_TABLE_COLUMN_NAMES),
  indexSpecs = CANONICAL_D1_INDEX_SPECS
) {
  for (const tableName of tableNames) {
    if (!Object.hasOwn(CANONICAL_D1_TABLE_COLUMN_NAMES, tableName)) {
      throw new Error(`Unknown canonical D1 table: ${tableName}`);
    }
  }
  const tableList = tableNames.map((tableName) => `'${tableName}'`).join(', ');
  const indexList = indexSpecs.map(({ name }) => `'${name}'`).join(', ');
  const indexPredicate = indexList ? `(type = 'index' AND name IN (${indexList}))` : '0';
  const rowLimit = tableNames.length + indexSpecs.length + 1;
  return 'SELECT type, name, tbl_name AS table_name, sql FROM sqlite_schema '
    + `WHERE sql IS NOT NULL AND (${indexPredicate} OR `
    + `(type = 'index' AND tbl_name IN (${tableList})) OR `
    + `(type = 'trigger' AND tbl_name IN (${tableList})) OR `
    + `(type = 'table' AND name IN (${tableList}))) ORDER BY type ASC, name ASC `
    + `LIMIT ${rowLimit}`;
}

const LEADS_COLUMN_DEFINITION_BY_NAME = new Map(
  LEADS_COLUMN_DEFINITIONS.map(({ name, definition }) => [name, definition])
);
const JOB_RUN_COLUMN_DEFINITION_BY_NAME = new Map(
  JOB_RUN_COLUMN_DEFINITIONS.map(({ name, definition }) => [name, definition])
);

function canonicalLeadsCreateSql(schemaColumnRows = []) {
  const orderedNames = schemaColumnRows
    .filter((row) => row.table_name === 'leads')
    .map((row, index) => ({
      name: String(row.name || ''),
      cid: Number.isInteger(Number(row.cid)) ? Number(row.cid) : index,
    }))
    .sort((left, right) => left.cid - right.cid)
    .map(({ name }) => name);
  const names = orderedNames.length > 0
    ? orderedNames
    : CANONICAL_D1_TABLE_COLUMN_NAMES.leads;
  const definitions = names.map((name) => {
    const definition = LEADS_COLUMN_DEFINITION_BY_NAME.get(name);
    return definition ? `${name} ${definition}` : null;
  });
  if (definitions.some((definition) => !definition)) return null;
  return normalizeD1SchemaSql(`CREATE TABLE leads (${definitions.join(', ')})`);
}

function canonicalJobRunsCreateSql(schemaColumnRows = []) {
  const orderedNames = schemaColumnRows
    .filter((row) => row.table_name === 'job_runs')
    .map((row, index) => ({
      name: String(row.name || ''),
      cid: Number.isInteger(Number(row.cid)) ? Number(row.cid) : index,
    }))
    .sort((left, right) => left.cid - right.cid)
    .map(({ name }) => name);
  const names = orderedNames.length > 0
    ? orderedNames
    : CANONICAL_D1_TABLE_COLUMN_NAMES.job_runs;
  const definitions = names.map((name) => {
    const definition = JOB_RUN_COLUMN_DEFINITION_BY_NAME.get(name);
    return definition ? `${name} ${definition}` : null;
  });
  if (definitions.some((definition) => !definition)) return null;
  return normalizeD1SchemaSql(`CREATE TABLE job_runs (${definitions.join(', ')})`);
}

export function validateD1SchemaObjects(rows, {
  tableNames = Object.keys(CANONICAL_D1_TABLE_COLUMN_NAMES),
  indexSpecs = CANONICAL_D1_INDEX_SPECS,
  schemaColumnRows = [],
  allowMissingTables = false,
  allowMissingIndexes = false,
} = {}) {
  const errors = [];
  for (const tableName of tableNames) {
    const fragments = CANONICAL_D1_TABLE_SQL_FRAGMENTS[tableName] || [];
    const tableRow = rows.find((row) => row.type === 'table' && row.name === tableName);
    if (!tableRow) {
      if (!allowMissingTables) errors.push(`${tableName} sqlite_schema definition is missing`);
      continue;
    }
    const normalizedTableSql = normalizeD1SchemaSql(tableRow.sql);
    for (const fragment of fragments) {
      if (
        tableName === 'leads'
        && fragment === 'CHECK (version >= 1)'
        && !schemaColumnRows.some((row) => row.table_name === 'leads' && row.name === 'version')
      ) continue;
      if (
        tableName === 'job_runs'
        && fragment === 'CHECK (provider_attempt >= 0)'
        && !schemaColumnRows.some((row) => row.table_name === 'job_runs' && row.name === 'provider_attempt')
      ) continue;
      const normalizedFragment = normalizeD1SchemaSql(fragment);
      if (!normalizedTableSql.includes(normalizedFragment)) {
        errors.push(`${tableName} is missing canonical constraint: ${fragment}`);
      }
    }
    const expectedTable = CANONICAL_D1_TABLE_SPECS.find(
      ({ name }) => name === tableName
    );
    if (tableName === 'leads') {
      const expectedLeadsSql = canonicalLeadsCreateSql(schemaColumnRows);
      if (!expectedLeadsSql || normalizedTableSql !== expectedLeadsSql) {
        errors.push('leads canonical per-column CREATE TABLE SQL mismatch');
      }
    } else if (tableName === 'job_runs') {
      const expectedJobRunsSql = canonicalJobRunsCreateSql(schemaColumnRows);
      if (!expectedJobRunsSql || normalizedTableSql !== expectedJobRunsSql) {
        errors.push('job_runs canonical per-version CREATE TABLE SQL mismatch');
      }
    } else if (expectedTable && normalizedTableSql !== expectedTable.normalizedSql) {
      errors.push(`${tableName} canonical CREATE TABLE SQL mismatch`);
    }
  }

  for (const expected of indexSpecs) {
    const actual = rows.find((row) => row.type === 'index' && row.name === expected.name);
    if (!actual) {
      if (!allowMissingIndexes) errors.push(`canonical index ${expected.name} is missing`);
      continue;
    }
    const actualSql = normalizeD1SchemaSql(actual.sql);
    const actualUnique = /^CREATE UNIQUE INDEX\b/i.test(actualSql);
    if (String(actual.table_name || '') !== expected.tableName) {
      errors.push(
        `canonical index ${expected.name} table mismatch: `
        + `${String(actual.table_name || '')} !== ${expected.tableName}`
      );
    }
    if (actualUnique !== expected.unique) {
      errors.push(
        `canonical index ${expected.name} unique mismatch: ${actualUnique} !== ${expected.unique}`
      );
    }
    if (actualSql !== expected.normalizedSql) {
      errors.push(`canonical index ${expected.name} SQL mismatch`);
    }
  }
  const expectedIndexNames = new Set(indexSpecs.map(({ name }) => name));
  for (const row of rows) {
    if (row.type === 'trigger') {
      errors.push(`unexpected trigger ${String(row.name || '')} on ${String(row.table_name || '')}`);
      continue;
    }
    if (row.type !== 'index' || expectedIndexNames.has(row.name)) continue;
    errors.push(`unexpected index ${String(row.name || '')} on ${String(row.table_name || '')}`);
  }
  return errors;
}

export const DEPLOYED_D1_MIGRATION_MANIFEST = Object.freeze([
  Object.freeze({
    version: 1,
    name: 'adopt_canonical_lead_schema',
    createTables: V1_CREATE_TABLE_STATEMENTS,
    indexes: V1_INDEX_STATEMENTS,
    indexSpecs: V1_INDEX_SPECS,
    introspectLeads: true,
    tables: Object.freeze([
      'd1_schema_migrations', 'leads', 'analytics', 'status_log', 'manual_review_note_events',
      'reviewer_feedback', 'reviewer_feedback_events', 'job_runs', 'reference_library',
    ]),
  }),
  Object.freeze({
    version: 2,
    name: 'separate_published_snapshot_artifacts',
    createTables: V2_CREATE_TABLE_STATEMENTS,
    indexes: V2_INDEX_STATEMENTS,
    indexSpecs: V2_INDEX_SPECS,
    introspectLeads: false,
    tables: Object.freeze(['published_snapshot_heads', 'published_snapshot_entries']),
  }),
]);

export const D1_MIGRATION_MANIFEST = Object.freeze([
  ...DEPLOYED_D1_MIGRATION_MANIFEST,
  Object.freeze({
    version: 3,
    name: 'lead_cas_and_job_callback_idempotency',
    createTables: V3_CREATE_TABLE_STATEMENTS,
    indexes: V3_INDEX_STATEMENTS,
    indexSpecs: V3_INDEX_SPECS,
    introspectLeads: true,
    addLeadColumns: V3_LEADS_COLUMN_DEFINITIONS,
    addJobRunColumns: V3_JOB_RUN_COLUMN_DEFINITIONS,
    tables: Object.freeze(['leads', 'job_runs', 'job_callback_events']),
  }),
]);

export function validateD1MigrationChain(rows, { requireComplete = false } = {}) {
  const errors = [];
  if (rows.length > D1_MIGRATION_MANIFEST.length) {
    errors.push(`migration ledger has ${rows.length} entries; expected at most ${D1_MIGRATION_MANIFEST.length}`);
  }
  for (let index = 0; index < rows.length; index += 1) {
    const expected = D1_MIGRATION_MANIFEST[index];
    const actual = rows[index];
    if (!expected) {
      errors.push(`migration ledger contains unsupported version ${String(actual?.version)}`);
      continue;
    }
    if (Number(actual?.version) !== expected.version) {
      errors.push(
        `migration ledger entry ${index + 1} version mismatch: `
        + `${String(actual?.version)} !== ${expected.version}`
      );
    }
    if (String(actual?.name || '') !== expected.name) {
      errors.push(
        `migration ledger version ${expected.version} name mismatch: `
        + `${String(actual?.name || '')} !== ${expected.name}`
      );
    }
  }
  if (requireComplete && rows.length !== D1_MIGRATION_MANIFEST.length) {
    errors.push(
      `migration ledger is incomplete: ${rows.length}/${D1_MIGRATION_MANIFEST.length} entries`
    );
  }
  return errors;
}
