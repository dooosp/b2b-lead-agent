import { jsonResponse } from './utils.js';

export function getBearerToken(request) {
  const auth = request.headers.get('Authorization') || '';
  return auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
}

async function verifyExpectedToken(request, token) {
  if (!token) {
    return jsonResponse({ success: false, message: '서버 인증 설정이 필요합니다.' }, 503);
  }
  const bearer = getBearerToken(request);
  if (!bearer) return jsonResponse({ success: false, message: '인증이 필요합니다.' }, 401);
  const match = await timingSafeCompare(bearer, token);
  if (!match) return jsonResponse({ success: false, message: '인증 실패' }, 401);
  return null;
}

export async function verifyAuth(request, env) {
  return verifyExpectedToken(request, env.API_TOKEN || env.TRIGGER_PASSWORD);
}

export async function verifyInternalApiAuth(request, env) {
  return verifyExpectedToken(request, env.API_TOKEN || '');
}

export async function timingSafeCompare(a, b) {
  const enc = new TextEncoder();
  const bufA = enc.encode(String(a));
  const bufB = enc.encode(String(b));
  let mismatch = bufA.byteLength ^ bufB.byteLength;
  const len = Math.max(bufA.byteLength, bufB.byteLength);
  for (let i = 0; i < len; i++) {
    mismatch |= (bufA[i] || 0) ^ (bufB[i] || 0);
  }
  return mismatch === 0;
}

export async function checkRateLimit(request, env) {
  if (!env.RATE_LIMIT) return null;
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || 'unknown';
  const key = `rl:${ip}`;
  const now = Math.floor(Date.now() / 1000);
  const windowSec = 60;
  const maxReqs = ip === 'unknown' ? 3 : 10;
  const stored = await env.RATE_LIMIT.get(key, 'json').catch(() => null);
  const record = stored && stored.ts > (now - windowSec) ? stored : { ts: now, c: 0 };
  record.c++;
  await env.RATE_LIMIT.put(key, JSON.stringify(record), { expirationTtl: windowSec });
  if (record.c > maxReqs) {
    return new Response(JSON.stringify({ success: false, message: '요청 한도 초과. 잠시 후 다시 시도하세요.' }), {
      status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(windowSec) }
    });
  }
  return null;
}
