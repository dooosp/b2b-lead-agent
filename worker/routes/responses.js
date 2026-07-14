import { jsonResponse } from '../lib/utils.js';

const PROTECTED_REVIEWER_VARY = 'Authorization, X-Manual-Review-Notes-Local-Test-Role';

export function isAllowedMethod(method, allowedMethods) {
  return allowedMethods.includes(method);
}

export function jsonNotFoundResponse(message = 'Not Found') {
  return jsonResponse({ success: false, message }, 404);
}

export function jsonInternalErrorResponse(message = '요청 처리 중 오류가 발생했습니다.') {
  return jsonResponse({ success: false, message }, 500);
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

export function withProtectedReviewerCachePolicy(response) {
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Vary', PROTECTED_REVIEWER_VARY);
  return response;
}

export function protectedReviewerHtmlResponse(html, status = 200) {
  return withProtectedReviewerCachePolicy(htmlResponse(html, status));
}

export function textResponse(text, status = 200) {
  return new Response(text, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}
