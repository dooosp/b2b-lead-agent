export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache'
    }
  });
}

export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

export function sanitizeUrl(url) {
  if (!url) return '#';
  const u = String(url).replace(/[\x00-\x1f\x7f\s]+/g, '').toLowerCase();
  if (/^(javascript|data|vbscript|blob):/i.test(u)) return '#';
  if (/^[/\\]{2}/.test(u)) return '#';
  return escapeHtml(url);
}
