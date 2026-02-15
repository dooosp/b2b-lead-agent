import { jsonResponse } from '../lib/utils.js';

export async function checkSelfServiceRateLimit(request, env) {
  const enabled = String(env.ENABLE_SELF_SERVICE_RATE_LIMIT || '').toLowerCase() === 'true';
  if (!enabled || !env.RATE_LIMIT) return null;
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || 'unknown';
  const key = `ss:${ip}`;
  const now = Math.floor(Date.now() / 1000);
  const windowSec = Number(env.SELF_SERVICE_RATE_LIMIT_WINDOW_SEC) || 3600;
  const maxReqs = Number(env.SELF_SERVICE_RATE_LIMIT_MAX) || 3;
  const stored = await env.RATE_LIMIT.get(key, 'json').catch(() => null);
  const record = stored && stored.ts > (now - windowSec) ? stored : { ts: now, c: 0 };
  record.c++;
  await env.RATE_LIMIT.put(key, JSON.stringify(record), { expirationTtl: windowSec });
  if (record.c > maxReqs) {
    return jsonResponse({
      success: false,
      message: `셀프서비스는 시간당 ${maxReqs}회까지 사용 가능합니다. 잠시 후 다시 시도하세요.`
    }, 429);
  }
  return null;
}
