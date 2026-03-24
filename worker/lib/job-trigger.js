const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CLOUD_PLATFORM_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';

function base64UrlEncodeText(value) {
  return btoa(unescape(encodeURIComponent(value)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlEncodeBytes(bytes) {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function pemToArrayBuffer(pem) {
  const normalized = String(pem || '')
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');

  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

function readServiceAccount(env) {
  const jsonValue = env.GCP_SERVICE_ACCOUNT_JSON || env.GOOGLE_SERVICE_ACCOUNT_JSON || '';

  if (jsonValue) {
    const parsed = JSON.parse(jsonValue);
    return {
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key,
      tokenUri: parsed.token_uri || GOOGLE_OAUTH_TOKEN_URL,
    };
  }

  if (env.GCP_CLIENT_EMAIL && env.GCP_PRIVATE_KEY) {
    return {
      clientEmail: env.GCP_CLIENT_EMAIL,
      privateKey: env.GCP_PRIVATE_KEY,
      tokenUri: GOOGLE_OAUTH_TOKEN_URL,
    };
  }

  throw new Error('Cloud Run Job trigger requires GCP_SERVICE_ACCOUNT_JSON or GCP_CLIENT_EMAIL/GCP_PRIVATE_KEY.');
}

async function createJwtAssertion(serviceAccount) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccount.clientEmail,
    scope: GOOGLE_CLOUD_PLATFORM_SCOPE,
    aud: serviceAccount.tokenUri,
    exp: issuedAt + 3600,
    iat: issuedAt,
  };

  const encodedHeader = base64UrlEncodeText(JSON.stringify(header));
  const encodedPayload = base64UrlEncodeText(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(serviceAccount.privateKey),
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new TextEncoder().encode(unsignedToken)
  );

  return `${unsignedToken}.${base64UrlEncodeBytes(new Uint8Array(signature))}`;
}

async function getGoogleAccessToken(env) {
  if (env.GCP_ACCESS_TOKEN) {
    return env.GCP_ACCESS_TOKEN;
  }

  const serviceAccount = readServiceAccount(env);
  const assertion = await createJwtAssertion(serviceAccount);
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });
  const response = await fetch(serviceAccount.tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || `Google OAuth token request failed (${response.status}).`);
  }

  return payload.access_token;
}

function resolveTriggerTarget(env) {
  const raw = String(env.REPORT_TRIGGER_TARGET || env.JOB_TRIGGER_TARGET || 'github-actions').trim().toLowerCase();
  if (['cloud-run', 'cloud-run-job', 'gcp-cloud-run-job'].includes(raw)) {
    return 'cloud-run-job';
  }
  return 'github-actions';
}

function shouldSendEmail(env) {
  return !['0', 'false', 'no'].includes(String(env.CLOUD_RUN_JOB_SEND_EMAIL || '').trim().toLowerCase());
}

function buildCloudRunArgs(env, profile) {
  const args = ['--profile', profile];
  if (shouldSendEmail(env)) {
    args.push('--email');
  }
  return args;
}

function buildCloudRunRequest(env, profile) {
  const projectId = String(env.GCP_PROJECT_ID || '').trim();
  const region = String(env.GCP_REGION || '').trim();
  const jobName = String(env.CLOUD_RUN_JOB_NAME || '').trim();

  if (!projectId || !region || !jobName) {
    throw new Error('Cloud Run Job trigger requires GCP_PROJECT_ID, GCP_REGION, and CLOUD_RUN_JOB_NAME.');
  }

  return {
    url: `https://run.googleapis.com/v2/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(region)}/jobs/${encodeURIComponent(jobName)}:run`,
    body: {
      overrides: {
        containerOverrides: [{
          args: buildCloudRunArgs(env, profile),
          env: [
            { name: 'B2B_LOAD_DOTENV', value: '0' },
          ],
        }],
      },
    },
  };
}

async function dispatchGithubWorkflow(env, profile) {
  if (!env.GITHUB_REPO || !env.GITHUB_TOKEN) {
    throw new Error('GitHub trigger requires GITHUB_REPO and GITHUB_TOKEN.');
  }

  const response = await fetch(
    `https://api.github.com/repos/${env.GITHUB_REPO}/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `token ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'B2B-Lead-Worker',
      },
      body: JSON.stringify({
        event_type: 'generate-report',
        client_payload: { profile },
      }),
    }
  );

  if (response.status !== 204) {
    throw new Error(`GitHub dispatch failed (${response.status}).`);
  }

  return {
    ok: true,
    target: 'github-actions',
    message: `[${profile}] 보고서 생성이 시작되었습니다. 1~2분 후 이메일을 확인하세요.`,
  };
}

async function dispatchCloudRunJob(env, profile) {
  const token = await getGoogleAccessToken(env);
  const request = buildCloudRunRequest(env, profile);
  const response = await fetch(request.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request.body),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error?.message || payload.message || `Cloud Run Job execution failed (${response.status}).`);
  }

  return {
    ok: true,
    target: 'cloud-run-job',
    execution: payload.name || '',
    message: `[${profile}] Cloud Run Job 실행이 요청되었습니다.${payload.name ? ` 실행 추적: ${payload.name}` : ''}`,
  };
}

export async function dispatchReportJob(env, profile) {
  const target = resolveTriggerTarget(env);
  if (target === 'cloud-run-job') {
    return dispatchCloudRunJob(env, profile);
  }
  return dispatchGithubWorkflow(env, profile);
}

export {
  buildCloudRunArgs,
  buildCloudRunRequest,
  dispatchCloudRunJob,
  dispatchGithubWorkflow,
  getGoogleAccessToken,
  readServiceAccount,
  resolveTriggerTarget,
};
