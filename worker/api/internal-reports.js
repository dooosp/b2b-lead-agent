import { getActiveJobRunByProfile } from '../db/job-runs.js';
import { loadPublishedLatestSnapshot } from '../lib/published-reports.js';
import { getProfilesFromEnv } from '../lib/profile.js';
import { jsonResponse } from '../lib/utils.js';

const SCHEMA_VERSION = 'crm.published-report.v1';

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeIsoTimestamp(value) {
  const timestamp = normalizeString(value);
  if (!timestamp) return '';
  return Number.isNaN(Date.parse(timestamp)) ? '' : timestamp;
}

function isExactManagedProfileId(profileId, env) {
  return getProfilesFromEnv(env).some((profile) => profile.id === profileId);
}

function createNotFoundResponse(profileId) {
  return jsonResponse({
    schemaVersion: SCHEMA_VERSION,
    profileId,
    syncReady: false,
    error: {
      code: 'report_not_found',
      message: 'Canonical published report was not found.'
    }
  }, 404);
}

function createNotReadyResponse(profileId, reason, message) {
  return jsonResponse({
    schemaVersion: SCHEMA_VERSION,
    profileId,
    syncReady: false,
    readiness: {
      reason
    },
    error: {
      code: 'report_not_ready',
      message
    }
  }, 409);
}

function createReadinessUnavailableResponse(profileId) {
  return jsonResponse({
    schemaVersion: SCHEMA_VERSION,
    profileId,
    syncReady: false,
    error: {
      code: 'readiness_unavailable',
      message: 'Canonical report readiness could not be verified safely.'
    }
  }, 503);
}

function pickUniformSnapshotTimestamp(leads, fieldName) {
  const values = [...new Set(
    (Array.isArray(leads) ? leads : [])
      .map((lead) => normalizeIsoTimestamp(lead && lead[fieldName]))
      .filter(Boolean)
  )];
  return values.length === 1 ? values[0] : null;
}

function resolvePublishedAt(leads) {
  if (!Array.isArray(leads) || leads.length === 0) return null;
  return pickUniformSnapshotTimestamp(leads, 'createdAt') || pickUniformSnapshotTimestamp(leads, 'updatedAt');
}

function mapPublishedSource(source = {}) {
  const title = normalizeString(source.title);
  const url = normalizeString(source.url);
  if (!title || !url) return null;

  const mapped = { title, url };
  const sourceId = normalizeString(source.sourceId);
  const sourceName = normalizeString(source.source);
  const query = normalizeString(source.query);
  const publishedAt = normalizeString(source.publishedAt);
  const originUrl = normalizeString(source.originUrl);
  const resolution = normalizeString(source.resolution);

  if (sourceId) mapped.sourceId = sourceId;
  if (sourceName) mapped.source = sourceName;
  if (query) mapped.query = query;
  if (publishedAt) mapped.publishedAt = publishedAt;
  if (originUrl) mapped.originUrl = originUrl;
  if (resolution) mapped.resolution = resolution;
  if (typeof source.contentAvailable === 'boolean') mapped.contentAvailable = source.contentAvailable;

  return mapped;
}

function mapPublishedLead(lead = {}) {
  const id = normalizeString(lead.id);
  const status = normalizeString(lead.status);
  const createdAt = normalizeIsoTimestamp(lead.createdAt);
  const updatedAt = normalizeIsoTimestamp(lead.updatedAt);
  const company = normalizeString(lead.company);
  const summary = normalizeString(lead.summary);
  const product = normalizeString(lead.product || lead.recommended_product);
  const score = normalizeFiniteNumber(lead.score);
  const grade = normalizeString(lead.grade);
  const roi = normalizeString(lead.roi);
  const salesPitch = normalizeString(lead.salesPitch || lead.sales_pitch);
  const globalContext = normalizeString(lead.globalContext || lead.global_context);
  const sourceEntries = Array.isArray(lead.sources) ? lead.sources : null;

  if (!id || !status || !createdAt || !updatedAt || !company || !summary || !product || score === null || !grade || !roi || !salesPitch || !globalContext || !sourceEntries) {
    return null;
  }

  const sources = sourceEntries.map((source) => mapPublishedSource(source));
  if (sources.some((source) => !source)) return null;

  return {
    id,
    status,
    createdAt,
    updatedAt,
    company,
    summary,
    product,
    score,
    grade,
    roi,
    salesPitch,
    globalContext,
    sources
  };
}

function mapPublishedLeads(leads) {
  const mapped = (Array.isArray(leads) ? leads : []).map((lead) => mapPublishedLead(lead));
  return mapped.some((lead) => !lead) ? null : mapped;
}

function createSuccessResponse(profileId, publishedAt, leads) {
  return jsonResponse({
    schemaVersion: SCHEMA_VERSION,
    profileId,
    syncReady: true,
    publishedAt,
    leadCount: leads.length,
    leads
  });
}

export async function handleGetLatestPublishedReport(env, profileId) {
  const requestedProfileId = normalizeString(profileId);
  if (!requestedProfileId || !isExactManagedProfileId(requestedProfileId, env)) {
    return createNotFoundResponse(requestedProfileId);
  }

  const latest = await loadPublishedLatestSnapshot(env, requestedProfileId);
  if (latest.found) {
    const publishedAt = resolvePublishedAt(latest.leads);
    const leads = mapPublishedLeads(latest.leads);
    if (!publishedAt || !leads) {
      return createNotReadyResponse(
        requestedProfileId,
        'not_finalized',
        'Canonical snapshot exists, but finalization could not be proven safely.'
      );
    }
    return createSuccessResponse(requestedProfileId, publishedAt, leads);
  }

  if (!env.DB) {
    return createReadinessUnavailableResponse(requestedProfileId);
  }

  let activeJob = null;
  try {
    activeJob = await getActiveJobRunByProfile(env.DB, requestedProfileId);
  } catch {
    return createReadinessUnavailableResponse(requestedProfileId);
  }
  if (activeJob) {
    return createNotReadyResponse(
      requestedProfileId,
      'queued',
      'Canonical published report is not ready while a report run is still queued or running.'
    );
  }

  return createNotFoundResponse(requestedProfileId);
}
