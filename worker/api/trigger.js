import { jsonResponse } from '../lib/utils.js';
import { verifyAuth, timingSafeCompare } from '../lib/auth.js';
import { resolveProfileId } from '../lib/profile.js';
import { dispatchReportJob } from '../lib/job-trigger.js';

export async function handleTrigger(request, env) {
  const body = await request.json().catch(() => ({}));
  const bearerAuth = await verifyAuth(request, env);
  const passwordOk = body.password && env.TRIGGER_PASSWORD && await timingSafeCompare(body.password, env.TRIGGER_PASSWORD);
  if (bearerAuth && !passwordOk) {
    return bearerAuth;
  }
  const requestedProfile = typeof body.profile === 'string' ? body.profile.trim() : '';
  const profile = resolveProfileId(requestedProfile, env);
  if (requestedProfile && requestedProfile !== profile) {
    return jsonResponse({ success: false, message: `유효하지 않은 프로필입니다: ${requestedProfile}` }, 400);
  }

  try {
    const result = await dispatchReportJob(env, profile);
    return jsonResponse({
      success: true,
      target: result.target,
      execution: result.execution || null,
      message: result.message,
    });
  } catch (error) {
    return jsonResponse({
      success: false,
      message: error.message || '보고서 실행 요청에 실패했습니다.',
    }, 500);
  }
}
