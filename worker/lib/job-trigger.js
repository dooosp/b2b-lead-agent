export function buildAcceptedTriggerPayload(profile) {
  return {
    success: true,
    status: 'accepted',
    message: `[${profile}] 보고서 생성 요청이 접수되었습니다. 실행이 완료되면 이메일이 전송됩니다.`
  };
}

export async function submitGenerateReport(profile, env, fetchImpl = fetch) {
  const response = await fetchImpl(
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

  return {
    accepted: response.status === 204,
    responseStatus: response.status
  };
}
