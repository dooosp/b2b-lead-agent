export function isAllowedOrigin(origin, env) {
  if (!origin) return false;
  const allowed = [env.WORKER_ORIGIN, 'http://localhost:8787'].filter(Boolean);
  return allowed.includes(origin);
}

export function addCorsHeaders(response, origin, env) {
  if (!isAllowedOrigin(origin, env)) return response;
  const h = new Response(response.body, response);
  h.headers.set('Access-Control-Allow-Origin', origin);
  h.headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  h.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  h.headers.set('Access-Control-Max-Age', '86400');
  h.headers.set('Vary', 'Origin');
  return h;
}

export function handleOptions(request, env) {
  const origin = request.headers.get('Origin');
  if (!isAllowedOrigin(origin, env)) return new Response(null, { status: 403 });
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });
}
