import { jsonResponse } from '../lib/utils.js';
import { canonicalizeLeadCollectionForProfile, resolveProfileId } from '../lib/profile.js';
import {
  buildDataGapPrioritization,
  buildLeadReviewSession,
  buildReviewerActionQueue,
  buildReviewerWorkflowSummary
} from '../lib/lead-action-intelligence.js';
import {
  assertManualReviewNotesWriteAllowed,
  assertReviewerFeedbackWriteAllowed,
  filterManualReviewNotesForExport,
  filterManualReviewNotesLeadCollection,
  filterManualReviewNotesProtectedFields,
  filterManualReviewNotesLeadReviewSession,
  filterManualReviewNotesReviewerQueue,
  patchTouchesManualReviewNotes,
  patchTouchesReviewerFeedback,
  resolveManualReviewNotesAccess,
  withManualReviewNotesAccessMetadata
} from '../lib/manual-review-notes-access.js';
import { getLeadsByProfile, getAllLeads, getLeadById, updateLeadPatchAtomic } from '../db/leads.js';
import {
  DEFAULT_PUBLISHED_SNAPSHOT_MAX_STALE_MS,
  DEFAULT_PUBLISHED_SNAPSHOT_TTL_MS,
  PUBLISHED_ARTIFACT_KINDS,
  PUBLISHED_SNAPSHOT_CORRUPT_CODE,
  PUBLISHED_SNAPSHOT_MAX_LEADS,
  assertPublishedSnapshotSize,
  computePublishedSnapshotId,
  getPublishedSnapshot,
  normalizePublishedProfileId,
  savePublishedSnapshot,
  toPublishedSnapshotResponseLead,
} from '../db/published-snapshots.js';
import { createLeadsCsvFilename, serializeLeadsCsv } from './serializers/lead-csv.js';
import { readBoundedPublishedArtifactJson } from '../lib/published-artifact-json.js';

const LEAD_VERSION_REQUIRED_CODE = 'LEAD_VERSION_REQUIRED';
const LEAD_VERSION_INVALID_CODE = 'LEAD_VERSION_INVALID';

function assertLeadPatchObject(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw Object.assign(new Error('PATCH 본문은 JSON 객체여야 합니다.'), {
      status: 400,
      code: LEAD_VERSION_INVALID_CODE,
    });
  }
}

function parseExpectedLeadVersion(body) {
  assertLeadPatchObject(body);
  if (
    Object.prototype.hasOwnProperty.call(body, 'version')
    || Object.prototype.hasOwnProperty.call(body, 'expected_version')
    || Object.prototype.hasOwnProperty.call(body, 'rowVersion')
    || Object.prototype.hasOwnProperty.call(body, 'row_version')
  ) {
    throw Object.assign(new Error('version은 읽기 전용이며 precondition 필드는 expectedVersion만 지원합니다.'), {
      status: 400,
      code: LEAD_VERSION_INVALID_CODE,
    });
  }
  if (!Object.prototype.hasOwnProperty.call(body, 'expectedVersion')) {
    throw Object.assign(new Error('리드 변경에는 expectedVersion이 필요합니다.'), {
      status: 428,
      code: LEAD_VERSION_REQUIRED_CODE,
    });
  }
  if (!Number.isSafeInteger(body.expectedVersion) || body.expectedVersion < 1) {
    throw Object.assign(new Error('expectedVersion은 1 이상의 안전한 정수여야 합니다.'), {
      status: 400,
      code: LEAD_VERSION_INVALID_CODE,
    });
  }
  return body.expectedVersion;
}

export {
  PUBLISHED_ARTIFACT_REMOTE_BYTES_CODE,
  PUBLISHED_ARTIFACT_REMOTE_CARDINALITY_CODE,
  PUBLISHED_ARTIFACT_REMOTE_MAX_BYTES,
  PUBLISHED_ARTIFACT_REMOTE_MAX_NESTING_DEPTH,
  PUBLISHED_ARTIFACT_REMOTE_MAX_STRUCTURAL_TOKENS,
  PUBLISHED_ARTIFACT_REMOTE_STRUCTURE_CODE,
  assertPublishedArtifactJsonComplexity,
} from '../lib/published-artifact-json.js';

function canonicalizeLeadPayload(profile, leads) {
  return canonicalizeLeadCollectionForProfile(profile, Array.isArray(leads) ? leads : []);
}

function buildLeadListPayload(canonicalized, source, extra = {}, manualReviewNotesAccess = {}) {
  const leads = filterManualReviewNotesLeadCollection(canonicalized.leads, manualReviewNotesAccess);
  const reviewerActionQueue = filterManualReviewNotesReviewerQueue(
    buildReviewerActionQueue(leads),
    manualReviewNotesAccess
  );
  return withManualReviewNotesAccessMetadata({
    leads,
    profile: canonicalized.profileId,
    source,
    reviewerActionQueue,
    leadReviewSession: filterManualReviewNotesLeadReviewSession(
      buildLeadReviewSession(leads, { queue: reviewerActionQueue }),
      manualReviewNotesAccess
    ),
    reviewerWorkflowSummary: buildReviewerWorkflowSummary(leads),
    dataGapPrioritization: buildDataGapPrioritization(leads),
    ...extra,
  }, manualReviewNotesAccess);
}

function publishedSnapshotTtlMs(env = {}) {
  const configuredSeconds = Number(env.PUBLISHED_SNAPSHOT_TTL_SECONDS);
  return Number.isFinite(configuredSeconds) && configuredSeconds >= 0
    ? configuredSeconds * 1000
    : DEFAULT_PUBLISHED_SNAPSHOT_TTL_MS;
}

function publishedSnapshotMaxStaleMs(env = {}) {
  const configuredSeconds = Number(env.PUBLISHED_SNAPSHOT_MAX_STALE_SECONDS);
  return Number.isFinite(configuredSeconds) && configuredSeconds >= 0
    ? Math.min(configuredSeconds * 1000, DEFAULT_PUBLISHED_SNAPSHOT_MAX_STALE_MS)
    : DEFAULT_PUBLISHED_SNAPSHOT_MAX_STALE_MS;
}

function snapshotReadOptions(env, profileId, artifactKind) {
  return {
    profileId,
    artifactKind,
    ttlMs: publishedSnapshotTtlMs(env),
    maxStaleMs: publishedSnapshotMaxStaleMs(env),
  };
}

function staleSnapshotFallback(cached) {
  return cached?.staleUsable
    ? { ...cached, source: 'd1', snapshotStale: true }
    : null;
}

async function loadManagedPublishedArtifact(env, profile, artifactKind, filename) {
  const normalizedProfile = normalizePublishedProfileId(profile);
  let cached = null;
  let cacheWasCorrupt = false;
  if (env.DB) {
    try {
      cached = await getPublishedSnapshot(
        env.DB,
        snapshotReadOptions(env, normalizedProfile, artifactKind)
      );
    } catch (error) {
      if (error?.code !== PUBLISHED_SNAPSHOT_CORRUPT_CODE) throw error;
      cacheWasCorrupt = true;
    }
  }

  if (cached?.fresh) {
    return { ...cached, source: 'd1', snapshotStale: false };
  }

  let response;
  let publishedLeads;
  try {
    response = await fetch(
      `https://raw.githubusercontent.com/${env.GITHUB_REPO}/master/reports/`
      + `${encodeURIComponent(normalizedProfile)}/${filename}?t=${Date.now()}`,
      { headers: { 'User-Agent': 'B2B-Lead-Worker', 'Cache-Control': 'no-cache' } }
    );
    if (response.ok) {
      publishedLeads = await readBoundedPublishedArtifactJson(response, {
        maxTopLevelEntries: PUBLISHED_SNAPSHOT_MAX_LEADS[artifactKind],
      });
    }
  } catch (error) {
    const fallback = staleSnapshotFallback(cached);
    if (fallback) return fallback;
    throw error;
  }

  if (!response.ok) {
    if (cacheWasCorrupt) {
      throw new Error(`Published artifact repair returned HTTP ${response.status}`);
    }
    if (response.status >= 500 && response.status <= 599) {
      const fallback = staleSnapshotFallback(cached);
      if (fallback) return fallback;
      throw new Error(`Published artifact upstream returned HTTP ${response.status}`);
    }
    return null;
  }

  let canonicalized;
  let snapshotId;
  try {
    assertPublishedSnapshotSize(artifactKind, publishedLeads);
    canonicalized = canonicalizeLeadPayload(normalizedProfile, publishedLeads);
    assertPublishedSnapshotSize(artifactKind, canonicalized.leads);
    // Snapshot-id construction also validates exact projected UTF-8 entry and
    // aggregate payload bytes before any D1 write is attempted.
    snapshotId = computePublishedSnapshotId(
      canonicalized.profileId,
      artifactKind,
      canonicalized.leads
    );
  } catch (error) {
    const fallback = staleSnapshotFallback(cached);
    if (fallback) return fallback;
    throw error;
  }

  const fetchedAt = new Date().toISOString();
  if (env.DB) {
    await savePublishedSnapshot(env.DB, {
      profileId: canonicalized.profileId,
      artifactKind,
      leads: canonicalized.leads,
      fetchedAt,
    });
    const persisted = await getPublishedSnapshot(
      env.DB,
      snapshotReadOptions(env, canonicalized.profileId, artifactKind)
    );
    if (!persisted) throw new Error('Published snapshot head was not readable after save');
    return { ...persisted, source: 'github', snapshotStale: false };
  }

  return {
    source: 'github',
    snapshotId,
    fetchedAt,
    snapshotStale: false,
    leads: canonicalized.leads.map((lead) => toPublishedSnapshotResponseLead(lead, {
      profileId: canonicalized.profileId,
      artifactKind,
    })),
  };
}

export async function fetchLeads(env, profile, request) {
  const manualReviewNotesAccess = await resolveManualReviewNotesAccess(request, env);
  try {
    const isSelfServiceProfile = profile.startsWith('self-service:');
    if (isSelfServiceProfile && env.DB) {
      const dbLeads = await getLeadsByProfile(env.DB, profile);
      if (dbLeads.length > 0) {
        const canonicalized = canonicalizeLeadPayload(profile, dbLeads);
        return jsonResponse(buildLeadListPayload(canonicalized, 'd1', {}, manualReviewNotesAccess));
      }
    }

    if (isSelfServiceProfile) {
      const canonicalized = canonicalizeLeadPayload(profile, []);
      return jsonResponse(buildLeadListPayload(
        canonicalized,
        'd1',
        { message: '해당 셀프서비스 리드가 없습니다.' },
        manualReviewNotesAccess
      ));
    }

    const artifact = await loadManagedPublishedArtifact(
      env,
      profile,
      PUBLISHED_ARTIFACT_KINDS.latest,
      'latest-leads.json'
    );
    if (!artifact) return jsonResponse({ leads: [], message: '아직 생성된 리드가 없습니다.' });

    const canonicalized = canonicalizeLeadPayload(profile, artifact.leads);
    return jsonResponse(buildLeadListPayload(
      canonicalized,
      artifact.source,
      {
        snapshotId: artifact.snapshotId,
        snapshotFetchedAt: artifact.fetchedAt,
        snapshotStale: artifact.snapshotStale === true,
      },
      manualReviewNotesAccess
    ));
  } catch {
    return jsonResponse({ success: false, leads: [], message: '리드 데이터를 불러오는 중 오류가 발생했습니다.' }, 500);
  }
}

export async function fetchHistory(env, profile, request) {
  const manualReviewNotesAccess = await resolveManualReviewNotesAccess(request, env);
  try {
    const isSelfServiceProfile = profile.startsWith('self-service:');
    if (isSelfServiceProfile && env.DB) {
      const dbHistory = await getLeadsByProfile(env.DB, profile, { limit: 500 });
      if (dbHistory.length > 0) {
        const canonicalized = canonicalizeLeadPayload(profile, dbHistory);
        return jsonResponse(withManualReviewNotesAccessMetadata({
          history: filterManualReviewNotesLeadCollection(canonicalized.leads, manualReviewNotesAccess),
          profile: canonicalized.profileId,
          source: 'd1',
        }, manualReviewNotesAccess));
      }
    }

    if (isSelfServiceProfile) {
      return jsonResponse(withManualReviewNotesAccessMetadata({
        history: [],
        profile,
        source: 'd1',
        message: '해당 셀프서비스 히스토리가 없습니다.',
      }, manualReviewNotesAccess));
    }

    const artifact = await loadManagedPublishedArtifact(
      env,
      profile,
      PUBLISHED_ARTIFACT_KINDS.history,
      'lead-history.json'
    );
    if (!artifact) return jsonResponse({ history: [], message: '아직 히스토리가 없습니다.' });
    const canonicalized = canonicalizeLeadPayload(profile, artifact.leads);

    return jsonResponse(withManualReviewNotesAccessMetadata({
      history: filterManualReviewNotesLeadCollection(canonicalized.leads, manualReviewNotesAccess),
      profile: canonicalized.profileId,
      source: artifact.source,
      snapshotId: artifact.snapshotId,
      snapshotFetchedAt: artifact.fetchedAt,
      snapshotStale: artifact.snapshotStale === true,
    }, manualReviewNotesAccess));
  } catch {
    return jsonResponse({ success: false, history: [], message: '리드 히스토리를 불러오는 중 오류가 발생했습니다.' }, 500);
  }
}

export async function handleUpdateLead(request, env, leadId) {
  if (!env.DB) return jsonResponse({ success: false, message: '시스템 설정이 필요합니다. 관리자에게 문의하세요.' }, 503);
  const manualReviewNotesAccess = await resolveManualReviewNotesAccess(request, env);
  let body;
  let bodyParseFailed = false;
  try {
    body = await request.json();
  } catch {
    bodyParseFailed = true;
  }

  try {
    if (bodyParseFailed) {
      throw Object.assign(new Error('PATCH 본문은 올바른 JSON 객체여야 합니다.'), {
        status: 400,
        code: LEAD_VERSION_INVALID_CODE,
      });
    }
    assertLeadPatchObject(body);
    if (patchTouchesManualReviewNotes(body)) {
      assertManualReviewNotesWriteAllowed(manualReviewNotesAccess);
    }
    if (patchTouchesReviewerFeedback(body)) {
      assertReviewerFeedbackWriteAllowed(manualReviewNotesAccess);
    }
    const expectedVersion = parseExpectedLeadVersion(body);
    const lead = await getLeadById(env.DB, leadId);
    if (!lead) return jsonResponse({ success: false, message: '리드를 찾을 수 없습니다.' }, 404);
    const result = await updateLeadPatchAtomic(env.DB, lead, body, { expectedVersion });
    return jsonResponse(withManualReviewNotesAccessMetadata({
      success: true,
      lead: filterManualReviewNotesProtectedFields(result.lead, manualReviewNotesAccess),
      changedFields: result.changedFields,
    }, manualReviewNotesAccess));
  } catch (error) {
    if (error?.status) {
      return jsonResponse({
        success: false,
        ...(error.code ? { code: error.code } : {}),
        ...(Number.isSafeInteger(error.currentVersion) ? { currentVersion: error.currentVersion } : {}),
        message: error.message,
      }, error.status);
    }
    throw error;
  }
}

export async function handleExportCSV(request, env) {
  if (!env.DB) return jsonResponse({ success: false, message: '시스템 설정이 필요합니다. 관리자에게 문의하세요.' }, 503);
  const manualReviewNotesAccess = await resolveManualReviewNotesAccess(request, env);
  const url = new URL(request.url);
  const requestedProfile = (url.searchParams.get('profile') || 'all').trim();
  if (requestedProfile !== 'all' && requestedProfile !== resolveProfileId(requestedProfile, env)) {
    return jsonResponse({ success: false, message: `유효하지 않은 프로필입니다: ${requestedProfile}` }, 400);
  }
  const profileId = requestedProfile;
  const leads = profileId === 'all'
    ? await getAllLeads(env.DB, { limit: 1000 })
    : await getLeadsByProfile(env.DB, profileId, { limit: 1000 });

  const csv = serializeLeadsCsv(filterManualReviewNotesForExport(leads, manualReviewNotesAccess));
  const filename = createLeadsCsvFilename(profileId);
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  });
}
