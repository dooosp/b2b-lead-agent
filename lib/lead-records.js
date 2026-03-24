const crypto = require('crypto');

const DEFAULT_LEAD_STATUS = 'NEW';

function normalizeText(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function normalizeFingerprintValue(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSourceKey(source = {}) {
  if (!source || typeof source !== 'object') {
    return '';
  }

  return normalizeFingerprintValue(source.url || source.title || '');
}

function buildLeadFingerprint(lead = {}) {
  const sourceKeys = (Array.isArray(lead.sources) ? lead.sources : [])
    .map(normalizeSourceKey)
    .filter(Boolean)
    .sort();
  const primarySourceKey = sourceKeys[0] || '';
  const base = [
    normalizeFingerprintValue(lead.company || 'unknown'),
    normalizeFingerprintValue(lead.product),
    normalizeFingerprintValue(lead.eventType),
    primarySourceKey,
  ].join('::');

  return crypto.createHash('sha1').update(base).digest('hex').slice(0, 16);
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeConfidenceReason(lead = {}) {
  const camelCase = normalizeText(lead.confidenceReason);
  if (camelCase) {
    return camelCase;
  }

  return normalizeText(lead.confidence_reason);
}

function normalizeLeadRecord(lead = {}, nowIso = new Date().toISOString()) {
  const fingerprint = buildLeadFingerprint(lead);

  return {
    ...lead,
    id: lead.id || fingerprint,
    dedupeKey: lead.dedupeKey || fingerprint,
    company: normalizeText(lead.company, '미상'),
    summary: normalizeText(lead.summary),
    product: normalizeText(lead.product),
    status: normalizeText(lead.status, DEFAULT_LEAD_STATUS) || DEFAULT_LEAD_STATUS,
    createdAt: lead.createdAt || nowIso,
    updatedAt: nowIso,
    sources: normalizeArray(lead.sources),
    evidence: normalizeArray(lead.evidence),
    assumptions: normalizeArray(lead.assumptions),
    confidenceReason: normalizeConfidenceReason(lead),
  };
}

function mergeLeadRecord(existingLead, nextLead, nowIso = new Date().toISOString()) {
  const normalizedNext = normalizeLeadRecord(nextLead, nowIso);

  if (!existingLead) {
    return normalizedNext;
  }

  return {
    ...existingLead,
    ...normalizedNext,
    id: existingLead.id || normalizedNext.id,
    dedupeKey: existingLead.dedupeKey || normalizedNext.dedupeKey,
    status: existingLead.status || normalizedNext.status,
    createdAt: existingLead.createdAt || normalizedNext.createdAt,
    updatedAt: nowIso,
  };
}

module.exports = {
  DEFAULT_LEAD_STATUS,
  buildLeadFingerprint,
  normalizeLeadRecord,
  mergeLeadRecord,
};
