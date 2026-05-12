import { jsonResponse } from '../lib/utils.js';
import { canonicalizeLeadCollectionForProfile, resolveProfileId } from '../lib/profile.js';
import { buildReviewerActionQueue } from '../lib/lead-action-intelligence.js';
import { getLeadsByProfile, getAllLeads, getLeadById, saveLeadsBatch, updateLeadPatchAtomic } from '../db/leads.js';
import { createLeadsCsvFilename, serializeLeadsCsv } from './serializers/lead-csv.js';

function canonicalizeLeadPayload(profile, leads) {
  return canonicalizeLeadCollectionForProfile(profile, Array.isArray(leads) ? leads : []);
}

function buildLeadListPayload(canonicalized, source, extra = {}) {
  return {
    leads: canonicalized.leads,
    profile: canonicalized.profileId,
    source,
    reviewerActionQueue: buildReviewerActionQueue(canonicalized.leads),
    ...extra,
  };
}

export async function fetchLeads(env, profile) {
  try {
    const isSelfServiceProfile = profile.startsWith('self-service:');
    if (env.DB) {
      const dbLeads = await getLeadsByProfile(env.DB, profile);
      if (dbLeads.length > 0) {
        const canonicalized = canonicalizeLeadPayload(profile, dbLeads);
        return jsonResponse(buildLeadListPayload(canonicalized, 'd1'));
      }
    }

    if (isSelfServiceProfile) {
      const canonicalized = canonicalizeLeadPayload(profile, []);
      return jsonResponse(buildLeadListPayload(canonicalized, 'd1', { message: '해당 셀프서비스 리드가 없습니다.' }));
    }

    const response = await fetch(
      `https://raw.githubusercontent.com/${env.GITHUB_REPO}/master/reports/${profile}/latest-leads.json?t=${Date.now()}`,
      { headers: { 'User-Agent': 'B2B-Lead-Worker', 'Cache-Control': 'no-cache' } }
    );
    if (!response.ok) return jsonResponse({ leads: [], message: '아직 생성된 리드가 없습니다.' });
    const leads = await response.json();
    const canonicalized = canonicalizeLeadPayload(profile, leads);

    if (env.DB && canonicalized.leads.length > 0) {
      try { await saveLeadsBatch(env.DB, canonicalized.leads, canonicalized.profileId, 'managed'); } catch { /* ignore migration errors */ }
    }

    return jsonResponse(buildLeadListPayload(canonicalized, 'github'));
  } catch {
    return jsonResponse({ success: false, leads: [], message: '리드 데이터를 불러오는 중 오류가 발생했습니다.' }, 500);
  }
}

export async function fetchHistory(env, profile) {
  try {
    const isSelfServiceProfile = profile.startsWith('self-service:');
    if (env.DB) {
      const dbHistory = await getLeadsByProfile(env.DB, profile, { limit: 500 });
      if (dbHistory.length > 0) {
        const canonicalized = canonicalizeLeadPayload(profile, dbHistory);
        return jsonResponse({ history: canonicalized.leads, profile: canonicalized.profileId, source: 'd1' });
      }
    }

    if (isSelfServiceProfile) {
      return jsonResponse({ history: [], profile, source: 'd1', message: '해당 셀프서비스 히스토리가 없습니다.' });
    }

    const response = await fetch(
      `https://raw.githubusercontent.com/${env.GITHUB_REPO}/master/reports/${profile}/lead-history.json?t=${Date.now()}`,
      { headers: { 'User-Agent': 'B2B-Lead-Worker', 'Cache-Control': 'no-cache' } }
    );
    if (!response.ok) return jsonResponse({ history: [], message: '아직 히스토리가 없습니다.' });
    const history = await response.json();
    const canonicalized = canonicalizeLeadPayload(profile, history);

    if (env.DB && canonicalized.leads.length > 0) {
      try { await saveLeadsBatch(env.DB, canonicalized.leads, canonicalized.profileId, 'managed'); } catch { /* ignore */ }
    }

    return jsonResponse({ history: canonicalized.leads, profile: canonicalized.profileId, source: 'github' });
  } catch {
    return jsonResponse({ success: false, history: [], message: '리드 히스토리를 불러오는 중 오류가 발생했습니다.' }, 500);
  }
}

export async function handleUpdateLead(request, env, leadId) {
  if (!env.DB) return jsonResponse({ success: false, message: '시스템 설정이 필요합니다. 관리자에게 문의하세요.' }, 503);
  const body = await request.json().catch(() => ({}));
  const lead = await getLeadById(env.DB, leadId);
  if (!lead) return jsonResponse({ success: false, message: '리드를 찾을 수 없습니다.' }, 404);

  try {
    const result = await updateLeadPatchAtomic(env.DB, lead, body);
    return jsonResponse({ success: true, lead: result.lead, changedFields: result.changedFields });
  } catch (error) {
    if (error?.status) {
      return jsonResponse({ success: false, message: error.message }, error.status);
    }
    throw error;
  }
}

export async function handleExportCSV(request, env) {
  if (!env.DB) return jsonResponse({ success: false, message: '시스템 설정이 필요합니다. 관리자에게 문의하세요.' }, 503);
  const url = new URL(request.url);
  const requestedProfile = (url.searchParams.get('profile') || 'all').trim();
  if (requestedProfile !== 'all' && requestedProfile !== resolveProfileId(requestedProfile, env)) {
    return jsonResponse({ success: false, message: `유효하지 않은 프로필입니다: ${requestedProfile}` }, 400);
  }
  const profileId = requestedProfile;
  const leads = profileId === 'all'
    ? await getAllLeads(env.DB, { limit: 1000 })
    : await getLeadsByProfile(env.DB, profileId, { limit: 1000 });

  const csv = serializeLeadsCsv(leads);
  const filename = createLeadsCsvFilename(profileId);
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  });
}
