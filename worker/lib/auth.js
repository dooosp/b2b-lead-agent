import { jsonResponse } from './utils.js';

export async function verifyAuth(request, env) {
  const token = env.API_TOKEN || env.TRIGGER_PASSWORD;
  if (!token) {
    return jsonResponse({ success: false, message: '서버 인증 설정이 필요합니다.' }, 503);
  }
  const auth = request.headers.get('Authorization') || '';
  let bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!bearer) {
    const url = new URL(request.url);
    bearer = url.searchParams.get('token') || '';
  }
  if (!bearer) return jsonResponse({ success: false, message: '인증이 필요합니다.' }, 401);
  const enc = new TextEncoder();
  const a = enc.encode(bearer);
  const b = enc.encode(token);
  if (a.byteLength !== b.byteLength) return jsonResponse({ success: false, message: '인증 실패' }, 401);
  const match = await crypto.subtle.timingSafeEqual(a, b);
  if (!match) return jsonResponse({ success: false, message: '인증 실패' }, 401);
  return null;
}

export async function timingSafeCompare(a, b) {
  const enc = new TextEncoder();
  const bufA = enc.encode(String(a));
  const bufB = enc.encode(String(b));
  if (bufA.byteLength !== bufB.byteLength) return false;
  return crypto.subtle.timingSafeEqual(bufA, bufB);
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
