import { jsonResponse } from '../lib/utils.js';
import { resolveProfileId } from '../lib/profile.js';
import {
  authenticateTriggerRequest,
  buildJobStatusUrl,
  buildTriggerAcceptedBody,
  createOrReuseAcceptedTriggerRun,
  dispatchGitHubTrigger
} from '../lib/job-trigger.js';

export async function handleTrigger(request, env) {
  const body = await request.json().catch(() => ({}));
  const auth = await authenticateTriggerRequest(request, env, body);
  if (!auth.ok) {
    return auth.response;
  }
  if (!env.DB) {
    return jsonResponse({ success: false, message: '시스템 설정이 필요합니다. 관리자에게 문의하세요.' }, 503);
  }
  const requestedProfile = typeof body.profile === 'string' ? body.profile.trim() : '';
  const profile = resolveProfileId(requestedProfile, env);
  if (requestedProfile && requestedProfile !== profile) {
    return jsonResponse({ success: false, message: `유효하지 않은 프로필입니다: ${requestedProfile}` }, 400);
  }

  const ledgerResult = await createOrReuseAcceptedTriggerRun(request, env, { profile });
  const statusUrl = buildJobStatusUrl(request, ledgerResult.job.requestId);
  const deduplicated = ledgerResult.outcome !== 'created';

  if (!deduplicated) {
    const dispatch = await dispatchGitHubTrigger(request, env, ledgerResult.job);
    if (!dispatch.ok) {
      return jsonResponse({
        success: false,
        requestId: ledgerResult.job.requestId,
        statusUrl,
        message: dispatch.error
      }, 502);
    }
  }

  const response = jsonResponse(
    buildTriggerAcceptedBody(ledgerResult.job, {
      deduplicated,
      authMode: auth.authMode,
      warning: auth.warning,
      statusUrl
    }),
    202
  );
  response.headers.set('Location', statusUrl);
  if (auth.warning) {
    response.headers.set('Warning', `299 - "${auth.warning}"`);
  }
  return response;
}
