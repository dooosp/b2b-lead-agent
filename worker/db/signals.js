import { ensureD1Schema } from './schema.js';

function clampText(value, maxLen = 500) {
  if (typeof value === 'string') return value.trim().slice(0, maxLen);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).slice(0, maxLen);
  return '';
}

function clampScore(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function normalizeEvidencePayload(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const normalized = {};
  for (const [key, raw] of Object.entries(value)) {
    const safeKey = clampText(key, 60);
    if (!safeKey) continue;
    if (Array.isArray(raw)) {
      const items = raw
        .map((item) => clampText(item, 280))
        .filter(Boolean)
        .slice(0, 10);
      if (items.length > 0) normalized[safeKey] = items;
      continue;
    }
    if (raw && typeof raw === 'object') {
      const nested = {};
      for (const [nestedKey, nestedValue] of Object.entries(raw)) {
        const safeNestedKey = clampText(nestedKey, 60);
        const safeNestedValue = clampText(nestedValue, 280);
        if (safeNestedKey && safeNestedValue) nested[safeNestedKey] = safeNestedValue;
      }
      if (Object.keys(nested).length > 0) normalized[safeKey] = nested;
      continue;
    }
    const safeValue = clampText(raw, 280);
    if (safeValue) normalized[safeKey] = safeValue;
  }
  return normalized;
}

export function normalizeSignal(signal, context = {}) {
  const now = new Date().toISOString();
  const company = clampText(signal?.company || context.company, 160);
  const leadId = clampText(signal?.leadId || signal?.lead_id || context.leadId, 120);
  const profileId = clampText(signal?.profileId || signal?.profile_id || context.profileId, 120) || 'self-service';
  const sourceUrl = clampText(signal?.sourceUrl || signal?.source_url, 1000);
  const sourceTitle = clampText(signal?.sourceTitle || signal?.source_title, 300);
  const sourcePublishedAt = clampText(signal?.sourcePublishedAt || signal?.source_published_at, 40);
  const signalType = clampText(signal?.signalType || signal?.signal_type, 80);
  const signalSource = clampText(signal?.signalSource || signal?.signal_source, 120);
  const createdAt = clampText(signal?.createdAt || signal?.created_at, 40) || now;
  const signalStrength = clampScore(signal?.signalStrength || signal?.signal_strength, 50);
  const recencyScore = clampScore(signal?.recencyScore || signal?.recency_score, sourcePublishedAt ? 50 : 0);
  const trustScore = clampScore(signal?.trustScore || signal?.trust_score, sourceUrl ? 50 : 0);
  const structuredEvidence = normalizeEvidencePayload(
    signal?.structuredEvidence
      || signal?.structuredEvidenceJson
      || signal?.structured_evidence_json
  );

  return {
    id: clampText(signal?.id, 160),
    leadId,
    profileId,
    company,
    signalType,
    signalSource,
    sourceUrl,
    sourceTitle,
    sourcePublishedAt,
    signalStrength,
    recencyScore,
    trustScore,
    painHint: clampText(signal?.painHint || signal?.pain_hint, 500),
    urgencyHint: clampText(signal?.urgencyHint || signal?.urgency_hint, 500),
    businessImpactHint: clampText(signal?.businessImpactHint || signal?.business_impact_hint, 500),
    rawExcerpt: clampText(signal?.rawExcerpt || signal?.raw_excerpt, 2000),
    structuredEvidence,
    createdAt
  };
}

function buildSignalId(signal) {
  const seed = [
    signal.leadId || 'lead',
    signal.signalType || 'signal',
    signal.sourcePublishedAt || signal.createdAt || 'na',
    signal.sourceUrl || signal.sourceTitle || signal.company || 'src'
  ].join('|');
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  return `sig_${Math.abs(hash).toString(36)}`;
}

export function signalToRow(signal, context = {}) {
  const normalized = normalizeSignal(signal, context);
  return {
    id: normalized.id || buildSignalId(normalized),
    lead_id: normalized.leadId,
    profile_id: normalized.profileId,
    company: normalized.company,
    signal_type: normalized.signalType,
    signal_source: normalized.signalSource,
    source_url: normalized.sourceUrl,
    source_title: normalized.sourceTitle,
    source_published_at: normalized.sourcePublishedAt,
    signal_strength: normalized.signalStrength,
    recency_score: normalized.recencyScore,
    trust_score: normalized.trustScore,
    pain_hint: normalized.painHint,
    urgency_hint: normalized.urgencyHint,
    business_impact_hint: normalized.businessImpactHint,
    raw_excerpt: normalized.rawExcerpt,
    structured_evidence_json: JSON.stringify(normalized.structuredEvidence),
    created_at: normalized.createdAt
  };
}

export function rowToSignal(row) {
  if (!row) return null;
  return {
    id: row.id,
    leadId: row.lead_id,
    profileId: row.profile_id,
    company: row.company,
    signalType: row.signal_type,
    signalSource: row.signal_source,
    sourceUrl: row.source_url || '',
    sourceTitle: row.source_title || '',
    sourcePublishedAt: row.source_published_at || '',
    signalStrength: Number(row.signal_strength) || 0,
    recencyScore: Number(row.recency_score) || 0,
    trustScore: Number(row.trust_score) || 0,
    painHint: row.pain_hint || '',
    urgencyHint: row.urgency_hint || '',
    businessImpactHint: row.business_impact_hint || '',
    rawExcerpt: row.raw_excerpt || '',
    structuredEvidence: (() => {
      try { return JSON.parse(row.structured_evidence_json || '{}'); } catch { return {}; }
    })(),
    createdAt: row.created_at
  };
}

export async function saveSignalsBatch(db, signals, context = {}) {
  if (!db || !Array.isArray(signals) || signals.length === 0) return [];
  await ensureD1Schema(db);
  const rows = signals
    .map((signal) => signalToRow(signal, context))
    .filter((row) => row.lead_id && row.company && row.signal_type && row.signal_source);
  if (rows.length === 0) return [];

  const stmt = db.prepare(
    `INSERT INTO company_signals (
      id, lead_id, profile_id, company, signal_type, signal_source,
      source_url, source_title, source_published_at, signal_strength,
      recency_score, trust_score, pain_hint, urgency_hint,
      business_impact_hint, raw_excerpt, structured_evidence_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      company=excluded.company,
      signal_type=excluded.signal_type,
      signal_source=excluded.signal_source,
      source_url=excluded.source_url,
      source_title=excluded.source_title,
      source_published_at=excluded.source_published_at,
      signal_strength=excluded.signal_strength,
      recency_score=excluded.recency_score,
      trust_score=excluded.trust_score,
      pain_hint=excluded.pain_hint,
      urgency_hint=excluded.urgency_hint,
      business_impact_hint=excluded.business_impact_hint,
      raw_excerpt=excluded.raw_excerpt,
      structured_evidence_json=excluded.structured_evidence_json`
  );

  await db.batch(rows.map((row) => stmt.bind(
    row.id, row.lead_id, row.profile_id, row.company, row.signal_type, row.signal_source,
    row.source_url, row.source_title, row.source_published_at, row.signal_strength,
    row.recency_score, row.trust_score, row.pain_hint, row.urgency_hint,
    row.business_impact_hint, row.raw_excerpt, row.structured_evidence_json, row.created_at
  )));

  return rows.map(rowToSignal);
}

export async function getSignalsByLeadId(db, leadId, options = {}) {
  if (!db || !leadId) return [];
  await ensureD1Schema(db);
  const limit = Math.max(1, Math.min(200, Number(options.limit) || 50));
  const { results } = await db.prepare(
    `SELECT * FROM company_signals
     WHERE lead_id = ?
     ORDER BY source_published_at DESC, created_at DESC
     LIMIT ?`
  ).bind(leadId, limit).all();
  return (results || []).map(rowToSignal);
}
