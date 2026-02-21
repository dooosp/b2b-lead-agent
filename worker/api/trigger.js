import { jsonResponse } from '../lib/utils.js';
import { verifyAuth, timingSafeCompare } from '../lib/auth.js';
import { resolveProfileId } from '../lib/profile.js';

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

  const response = await fetch(
    `https://api.github.com/repos/${env.GITHUB_REPO}/dispatches`,
    {
      method: 'POST',
      headers: {
        'Authorization': `token ${env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'B2B-Lead-Worker'
      },
      body: JSON.stringify({
        event_type: 'generate-report',
        client_payload: { profile }
      })
    }
  );

  if (response.status === 204) {
    return jsonResponse({ success: true, message: `[${profile}] 보고서 생성이 시작되었습니다. 1~2분 후 이메일을 확인하세요.` });
  }
  return jsonResponse({ success: false, message: `오류: ${response.status}` }, 500);
}
