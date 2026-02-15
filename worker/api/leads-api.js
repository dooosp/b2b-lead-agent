import { jsonResponse } from '../lib/utils.js';
import { resolveProfileId } from '../lib/profile.js';
import { VALID_TRANSITIONS } from '../db/transform.js';
import { getLeadsByProfile, getAllLeads, getLeadById, saveLeadsBatch, updateLeadStatus, updateLeadNotes } from '../db/leads.js';

export async function fetchLeads(env, profile) {
  try {
    const isSelfServiceProfile = profile.startsWith('self-service:');
    if (env.DB) {
      const dbLeads = await getLeadsByProfile(env.DB, profile);
      if (dbLeads.length > 0) return jsonResponse({ leads: dbLeads, profile, source: 'd1' });
    }

    if (isSelfServiceProfile) {
      return jsonResponse({ leads: [], profile, source: 'd1', message: '해당 셀프서비스 리드가 없습니다.' });
    }

    const response = await fetch(
      `https://raw.githubusercontent.com/${env.GITHUB_REPO}/master/reports/${profile}/latest_leads.json?t=${Date.now()}`,
      { headers: { 'User-Agent': 'B2B-Lead-Worker', 'Cache-Control': 'no-cache' } }
    );
    if (!response.ok) return jsonResponse({ leads: [], message: '아직 생성된 리드가 없습니다.' });
    const leads = await response.json();

    if (env.DB && leads.length > 0) {
      try { await saveLeadsBatch(env.DB, leads, profile, 'managed'); } catch { /* ignore migration errors */ }
    }

    return jsonResponse({ leads, profile, source: 'github' });
  } catch (e) {
    return jsonResponse({ leads: [], message: e.message }, 500);
  }
}

export async function fetchHistory(env, profile) {
  try {
    const isSelfServiceProfile = profile.startsWith('self-service:');
    if (env.DB) {
      const dbHistory = await getLeadsByProfile(env.DB, profile, { limit: 500 });
      if (dbHistory.length > 0) return jsonResponse({ history: dbHistory, profile, source: 'd1' });
    }

    if (isSelfServiceProfile) {
      return jsonResponse({ history: [], profile, source: 'd1', message: '해당 셀프서비스 히스토리가 없습니다.' });
    }

    const response = await fetch(
      `https://raw.githubusercontent.com/${env.GITHUB_REPO}/master/reports/${profile}/lead_history.json?t=${Date.now()}`,
      { headers: { 'User-Agent': 'B2B-Lead-Worker', 'Cache-Control': 'no-cache' } }
    );
    if (!response.ok) return jsonResponse({ history: [], message: '아직 히스토리가 없습니다.' });
    const history = await response.json();

    if (env.DB && history.length > 0) {
      try { await saveLeadsBatch(env.DB, history, profile, 'managed'); } catch { /* ignore */ }
    }

    return jsonResponse({ history, profile, source: 'github' });
  } catch (e) {
    return jsonResponse({ history: [], message: e.message }, 500);
  }
}

export async function handleUpdateLead(request, env, leadId) {
  if (!env.DB) return jsonResponse({ success: false, message: '시스템 설정이 필요합니다. 관리자에게 문의하세요.' }, 503);
  const body = await request.json().catch(() => ({}));
  const lead = await getLeadById(env.DB, leadId);
  if (!lead) return jsonResponse({ success: false, message: '리드를 찾을 수 없습니다.' }, 404);

  if (body.status && body.status !== lead.status) {
    const allowed = VALID_TRANSITIONS[lead.status] || [];
    if (!allowed.includes(body.status)) {
      return jsonResponse({
        success: false,
        message: `상태 전환 불가: ${lead.status} → ${body.status}. 허용: ${allowed.join(', ') || '없음'}`
      }, 400);
    }
    await updateLeadStatus(env.DB, leadId, body.status, lead.status);
  }

  if (typeof body.notes === 'string') {
    await updateLeadNotes(env.DB, leadId, body.notes.slice(0, 2000));
  }

  if (typeof body.follow_up_date === 'string') {
    const dateVal = body.follow_up_date.trim();
    if (dateVal && !/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
      return jsonResponse({ success: false, message: '날짜 형식이 올바르지 않습니다 (YYYY-MM-DD)' }, 400);
    }
    if (dateVal) {
      const parsed = new Date(`${dateVal}T00:00:00.000Z`);
      if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dateVal) {
        return jsonResponse({ success: false, message: '유효하지 않은 날짜입니다.' }, 400);
      }
    }
    const now = new Date().toISOString();
    await env.DB.prepare('UPDATE leads SET follow_up_date = ?, updated_at = ? WHERE id = ?').bind(dateVal, now, leadId).run();
  }

  if (body.estimated_value !== undefined) {
    const parsed = Number(body.estimated_value);
    const val = Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
    const now = new Date().toISOString();
    await env.DB.prepare('UPDATE leads SET estimated_value = ?, updated_at = ? WHERE id = ?').bind(val, now, leadId).run();
  }

  const updated = await getLeadById(env.DB, leadId);
  return jsonResponse({ success: true, lead: updated });
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

  const BOM = '\uFEFF';
  const header = '회사명,프로젝트,추천제품,점수,등급,ROI,상태,메모,생성일';
  const rows = leads.map(l => {
    const esc = (s) => `"${String(s || '').replace(/"/g, '""')}"`;
    return [esc(l.company), esc(l.summary), esc(l.product), l.score, l.grade, esc(l.roi), l.status, esc(l.notes), l.createdAt?.split('T')[0] || ''].join(',');
  });
  const csv = BOM + header + '\n' + rows.join('\n');
  const filename = `leads_${profileId}_${new Date().toISOString().split('T')[0]}.csv`;
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  });
}
