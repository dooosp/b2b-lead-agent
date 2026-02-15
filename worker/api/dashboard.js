import { jsonResponse } from '../lib/utils.js';
import { resolveProfileId } from '../lib/profile.js';
import { getDashboardMetrics } from '../db/leads.js';

export async function handleDashboard(request, env) {
  if (!env.DB) return jsonResponse({ success: false, message: '시스템 설정이 필요합니다. 관리자에게 문의하세요.' }, 503);
  const url = new URL(request.url);
  const requestedProfile = (url.searchParams.get('profile') || 'all').trim();
  if (requestedProfile !== 'all' && requestedProfile !== resolveProfileId(requestedProfile, env)) {
    return jsonResponse({ success: false, message: `유효하지 않은 프로필입니다: ${requestedProfile}` }, 400);
  }
  const profileId = requestedProfile;
  const metrics = await getDashboardMetrics(env.DB, profileId);
  return jsonResponse({ success: true, metrics, profile: profileId });
}
