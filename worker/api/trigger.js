import { jsonResponse } from '../lib/utils.js';
import { verifyAuth, timingSafeCompare } from '../lib/auth.js';
import { resolveProfileId } from '../lib/profile.js';
import { buildAcceptedTriggerPayload, submitGenerateReport } from '../lib/job-trigger.js';

export async function handleTrigger(request, env) {
  const body = await request.json().catch(() => ({}));
  const bearerAuth = await verifyAuth(request, env);
  const passwordOk = body.password && env.TRIGGER_PASSWORD && await timingSafeCompare(body.password, env.TRIGGER_PASSWORD);
  if (bearerAuth && !passwordOk) {
    return jsonResponse({ success: false, message: '비밀번호가 올바르지 않습니다.' }, 401);
  }
  const requestedProfile = typeof body.profile === 'string' ? body.profile.trim() : '';
  const profile = resolveProfileId(requestedProfile, env);
  if (requestedProfile && requestedProfile !== profile) {
    return jsonResponse({ success: false, message: `유효하지 않은 프로필입니다: ${requestedProfile}` }, 400);
  }

  const result = await submitGenerateReport(profile, env);

  if (result.accepted) {
    return jsonResponse(buildAcceptedTriggerPayload(profile), 202);
  }
  return jsonResponse({ success: false, message: `오류: ${result.responseStatus}` }, 500);
}
