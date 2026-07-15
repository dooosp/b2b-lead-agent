import { FakeD1Database } from './fake-d1.mjs';
import { WORKER_ORIGIN } from './http.mjs';

export function createWorkerEnv(overrides = {}) {
  return {
    API_TOKEN: 'api-secret',
    TRIGGER_PASSWORD: 'legacy-secret',
    GITHUB_TOKEN: 'github-secret',
    GITHUB_REPO: 'dooosp/b2b-lead-agent',
    DB: new FakeD1Database(),
    PROFILES: JSON.stringify([
      { id: 'danfoss', name: 'Danfoss' },
      { id: 'ls-electric', name: 'LS Electric' },
    ]),
    WORKER_ORIGIN,
    ...overrides,
  };
}

export function createRateLimitStore() {
  const values = new Map();
  return {
    async get(key, type) {
      const value = values.get(key);
      return type === 'json' && value ? JSON.parse(value) : value || null;
    },
    async put(key, value) {
      values.set(key, value);
    },
  };
}

export function createLeadRow(overrides = {}) {
  const timestamp = '2026-04-07T00:00:00.000Z';
  return {
    id: 'lead-1',
    identity_key: 'identity-1',
    profile_id: 'danfoss',
    source: 'managed',
    status: 'NEW',
    review_status: 'NEEDS_REVIEW',
    company: 'Acme Corp',
    summary: 'Existing lead signal',
    product: 'Desigo CC',
    score: 75,
    grade: 'B',
    roi: '',
    sales_pitch: '',
    global_context: '',
    sources: '[]',
    notes: '',
    enriched: 0,
    article_body: '',
    action_items: '[]',
    key_figures: '[]',
    pain_points: '[]',
    meddic: '{}',
    competitive: '{}',
    buying_signals: '[]',
    score_reason: '',
    urgency: '',
    urgency_reason: '',
    buyer_role: '',
    evidence: '[]',
    confidence: '',
    confidence_reason: '',
    assumptions: '[]',
    generation_mode: 'llm',
    verification_status: 'needs_review',
    data_gaps: '[]',
    event_type: '',
    enriched_at: null,
    follow_up_date: '',
    estimated_value: 0,
    version: 1,
    last_patch_mutation_id: '',
    created_at: timestamp,
    updated_at: timestamp,
    ...overrides,
  };
}

export function createLead(overrides = {}) {
  return {
    company: 'LG Electronics',
    summary: 'Smart factory expansion project',
    product: 'A-Controller',
    score: 82,
    grade: 'A',
    roi: 'Quantitative data unavailable',
    salesPitch: 'Use plant automation baseline data for the first outreach.',
    globalContext: 'Smart factory investment is expanding.',
    sources: [
      {
        title: 'LG Electronics expands smart factory program',
        url: 'https://example.com/news/lg-smart-factory?id=100&utm_source=rss',
      },
      {
        title: 'LG Electronics announces expansion plan',
        url: 'https://news.google.com/rss/articles/abc123',
      },
    ],
    eventType: 'expansion',
    ...overrides,
  };
}
