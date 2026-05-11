import { jsonResponse } from '../lib/utils.js';

export function isAllowedMethod(method, allowedMethods) {
  return allowedMethods.includes(method);
}

export function jsonNotFoundResponse(message = 'Not Found') {
  return jsonResponse({ success: false, message }, 404);
}

export function methodNotAllowedResponse(allowedMethods, { json = true } = {}) {
  const response = json
    ? jsonResponse({ success: false, message: 'Method Not Allowed' }, 405)
    : new Response('Method Not Allowed', {
        status: 405,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
  response.headers.set('Allow', allowedMethods.join(', '));
  return response;
}

export function htmlResponse(html, status = 200) {
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

export function textResponse(text, status = 200) {
  return new Response(text, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}
