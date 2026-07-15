export const ROUTE_CLASS = Object.freeze({
  STATIC_NO_DB: 'static/no-DB route',
  PAGE: 'page route',
  API: 'API route',
  D1_READ: 'D1-backed read route',
  D1_WRITE: 'D1 write route',
  JOB_TRIGGER: 'job/trigger route',
  UNSAFE_AMBIGUOUS: 'unsafe/ambiguous route'
});

export const ROUTE_INVENTORY = Object.freeze([
  {
    id: 'cors.options',
    pattern: 'OPTIONS *',
    methods: ['OPTIONS'],
    classifications: [ROUTE_CLASS.STATIC_NO_DB],
    auth: 'origin allow-list',
    dbAccess: 'none',
    writes: false,
    notes: 'CORS preflight only; handled before route dispatch.'
  },
  {
    id: 'static.manifest',
    pattern: '/manifest.json',
    methods: ['GET'],
    classifications: [ROUTE_CLASS.STATIC_NO_DB],
    auth: 'none',
    dbAccess: 'none',
    writes: false,
    notes: 'PWA manifest; must not touch D1 or trigger writes.'
  },
  {
    id: 'static.serviceWorker',
    pattern: '/sw.js',
    methods: ['GET'],
    classifications: [ROUTE_CLASS.STATIC_NO_DB],
    auth: 'none',
    dbAccess: 'none',
    writes: false,
    notes: 'PWA service worker script; must not touch D1 or trigger writes.'
  },
  {
    id: 'page.leadDetail',
    pattern: '/leads/:id',
    methods: ['GET'],
    classifications: [ROUTE_CLASS.PAGE, ROUTE_CLASS.D1_READ],
    auth: 'bearer API token',
    dbAccess: 'read',
    writes: false,
    notes: 'HTML detail page. Auth errors render the existing auth-required HTML page.'
  },
  {
    id: 'page.leads',
    pattern: '/leads',
    methods: ['GET'],
    classifications: [ROUTE_CLASS.PAGE],
    auth: 'none',
    dbAccess: 'none',
    writes: false,
    notes: 'Lead list shell; data loads through authenticated API calls.'
  },
  {
    id: 'page.ppt',
    pattern: '/ppt',
    methods: ['GET'],
    classifications: [ROUTE_CLASS.PAGE],
    auth: 'none',
    dbAccess: 'none',
    writes: false,
    notes: 'PPT generator shell.'
  },
  {
    id: 'page.roleplay',
    pattern: '/roleplay',
    methods: ['GET'],
    classifications: [ROUTE_CLASS.PAGE],
    auth: 'none',
    dbAccess: 'none',
    writes: false,
    notes: 'Roleplay shell.'
  },
  {
    id: 'page.history',
    pattern: '/history',
    methods: ['GET'],
    classifications: [ROUTE_CLASS.PAGE],
    auth: 'none',
    dbAccess: 'none',
    writes: false,
    notes: 'History shell.'
  },
  {
    id: 'page.dashboard',
    pattern: '/dashboard',
    methods: ['GET'],
    classifications: [ROUTE_CLASS.PAGE],
    auth: 'none',
    dbAccess: 'none',
    writes: false,
    notes: 'Dashboard shell; embeds profile configuration from env only.'
  },
  {
    id: 'page.proposal',
    pattern: '/proposal',
    methods: ['GET'],
    classifications: [ROUTE_CLASS.PAGE],
    auth: 'none',
    dbAccess: 'none',
    writes: false,
    notes: 'Proposal shell.'
  },
  {
    id: 'page.cpa',
    pattern: '/cpa',
    methods: ['GET'],
    classifications: [ROUTE_CLASS.PAGE],
    auth: 'none',
    dbAccess: 'none',
    writes: false,
    notes: 'CPA calculator shell.'
  },
  {
    id: 'page.homeFallback',
    pattern: '/* non-API fallback',
    methods: ['GET'],
    classifications: [ROUTE_CLASS.PAGE, ROUTE_CLASS.UNSAFE_AMBIGUOUS],
    auth: 'none',
    dbAccess: 'none',
    writes: false,
    notes: 'Catch-all HTML fallback for non-API paths. Kept explicit because it can mask unknown page paths.'
  },
  {
    id: 'api.selfServiceAnalyze',
    pattern: '/api/analyze',
    methods: ['POST'],
    classifications: [ROUTE_CLASS.API, ROUTE_CLASS.D1_WRITE],
    auth: 'bearer API token by default; env can disable',
    dbAccess: 'optional write',
    writes: true,
    notes: 'Self-service lead generation; rate-limited before expensive work and persists generated leads when D1 is bound.'
  },
  {
    id: 'job.trigger',
    pattern: '/trigger',
    methods: ['POST'],
    classifications: [ROUTE_CLASS.API, ROUTE_CLASS.JOB_TRIGGER, ROUTE_CLASS.D1_WRITE],
    auth: 'bearer API token or deprecated body password fallback',
    dbAccess: 'write',
    writes: true,
    notes: 'Accepted-contract job intake; creates/coalesces job_runs and dispatches the configured executor.'
  },
  {
    id: 'api.jobStatus',
    pattern: '/api/jobs/:requestId',
    methods: ['GET'],
    classifications: [ROUTE_CLASS.API, ROUTE_CLASS.D1_READ],
    auth: 'bearer API token',
    dbAccess: 'read',
    writes: false,
    notes: 'Reads job run status from D1.'
  },
  {
    id: 'job.event',
    pattern: '/api/jobs/:requestId/events',
    methods: ['POST'],
    classifications: [ROUTE_CLASS.API, ROUTE_CLASS.JOB_TRIGGER, ROUTE_CLASS.D1_WRITE],
    auth: 'job callback token',
    dbAccess: 'write',
    writes: true,
    notes: 'Executor callback endpoint; requires callback token plus callback Idempotency-Key and applies provider-attempt-aware monotonic transitions.'
  },
  {
    id: 'api.leads.list',
    pattern: '/api/leads',
    methods: ['GET'],
    classifications: [ROUTE_CLASS.API, ROUTE_CLASS.D1_READ, ROUTE_CLASS.D1_WRITE],
    auth: 'bearer API token',
    dbAccess: 'read with optional cache write',
    writes: true,
    notes: 'Reads D1 first, falls back to GitHub snapshot for managed profiles, and may cache canonical rows to D1.'
  },
  {
    id: 'api.ppt',
    pattern: '/api/ppt',
    methods: ['POST'],
    classifications: [ROUTE_CLASS.API],
    auth: 'bearer API token',
    dbAccess: 'none',
    writes: false,
    notes: 'No D1 access; calls configured model provider.'
  },
  {
    id: 'api.proposal',
    pattern: '/api/proposal',
    methods: ['POST'],
    classifications: [ROUTE_CLASS.API, ROUTE_CLASS.D1_READ, ROUTE_CLASS.D1_WRITE],
    auth: 'bearer API token',
    dbAccess: 'optional read/write',
    writes: true,
    notes: 'No D1 required, but when D1 is bound it seeds/reads reference examples before model generation.'
  },
  {
    id: 'api.cpa',
    pattern: '/api/cpa',
    methods: ['POST'],
    classifications: [ROUTE_CLASS.API],
    auth: 'bearer API token',
    dbAccess: 'none',
    writes: false,
    notes: 'Deterministic calculator; no D1 or external fetch.'
  },
  {
    id: 'api.roleplay',
    pattern: '/api/roleplay',
    methods: ['POST'],
    classifications: [ROUTE_CLASS.API],
    auth: 'bearer API token',
    dbAccess: 'none',
    writes: false,
    notes: 'No D1 access; calls configured model provider.'
  },
  {
    id: 'api.history',
    pattern: '/api/history',
    methods: ['GET'],
    classifications: [ROUTE_CLASS.API, ROUTE_CLASS.D1_READ, ROUTE_CLASS.D1_WRITE],
    auth: 'bearer API token',
    dbAccess: 'read with optional cache write',
    writes: true,
    notes: 'Reads D1 first, falls back to GitHub history for managed profiles, and may cache canonical rows to D1.'
  },
  {
    id: 'api.internalLatestPublished',
    pattern: '/api/internal/profiles/:profileId/latest-published',
    methods: ['GET'],
    classifications: [ROUTE_CLASS.API, ROUTE_CLASS.D1_READ],
    auth: 'INTERNAL_API_TOKEN bearer; API_TOKEN compatibility fallback when unset',
    dbAccess: 'conditional read',
    writes: false,
    notes: 'Reads canonical GitHub published artifact first; checks D1 active-job readiness only when the artifact is absent.'
  },
  {
    id: 'api.leads.batchEnrich',
    pattern: '/api/leads/batch-enrich',
    methods: ['POST'],
    classifications: [ROUTE_CLASS.API, ROUTE_CLASS.D1_READ, ROUTE_CLASS.D1_WRITE],
    auth: 'bearer API token',
    dbAccess: 'read/write',
    writes: true,
    notes: 'Reads pending leads, fetches article bodies, calls Gemini, and writes enrichment data.'
  },
  {
    id: 'api.leads.enrich',
    pattern: '/api/leads/:id/enrich',
    methods: ['POST'],
    classifications: [ROUTE_CLASS.API, ROUTE_CLASS.D1_READ, ROUTE_CLASS.D1_WRITE],
    auth: 'bearer API token',
    dbAccess: 'read/write',
    writes: true,
    notes: 'Reads one lead, fetches article body, calls Gemini, and writes enrichment data.'
  },
  {
    id: 'api.leads.patch',
    pattern: '/api/leads/:id',
    methods: ['PATCH'],
    classifications: [ROUTE_CLASS.API, ROUTE_CLASS.D1_WRITE],
    auth: 'bearer API token',
    dbAccess: 'read/write',
    writes: true,
    notes: 'Atomic CAS lead status/manual review notes/reviewer feedback/review patch; requires expectedVersion and rejects generated reviewer note suggestion persistence attempts.'
  },
  {
    id: 'api.dashboard',
    pattern: '/api/dashboard',
    methods: ['GET'],
    classifications: [ROUTE_CLASS.API, ROUTE_CLASS.D1_READ],
    auth: 'bearer API token',
    dbAccess: 'read',
    writes: false,
    notes: 'Reads dashboard metrics from D1.'
  },
  {
    id: 'api.exportCsv',
    pattern: '/api/export/csv',
    methods: ['GET'],
    classifications: [ROUTE_CLASS.API, ROUTE_CLASS.D1_READ],
    auth: 'bearer API token',
    dbAccess: 'read',
    writes: false,
    notes: 'Reads D1 leads and serializes CSV.'
  },
  {
    id: 'api.references.list',
    pattern: '/api/references',
    methods: ['GET'],
    classifications: [ROUTE_CLASS.API, ROUTE_CLASS.D1_READ],
    auth: 'bearer API token',
    dbAccess: 'read',
    writes: false,
    notes: 'Reads reference library rows from D1; returns empty when D1 is not bound.'
  },
  {
    id: 'api.references.create',
    pattern: '/api/references',
    methods: ['POST'],
    classifications: [ROUTE_CLASS.API, ROUTE_CLASS.D1_WRITE],
    auth: 'bearer API token',
    dbAccess: 'write',
    writes: true,
    notes: 'Adds one reference library row when D1 is bound.'
  },
  {
    id: 'api.references.delete',
    pattern: '/api/references/:id',
    methods: ['DELETE'],
    classifications: [ROUTE_CLASS.API, ROUTE_CLASS.D1_WRITE],
    auth: 'bearer API token',
    dbAccess: 'write',
    writes: true,
    notes: 'Deletes one reference library row when D1 is bound.'
  }
]);
