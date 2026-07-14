export function getPWAManifest(env) {
  return {
    name: 'B2B Sales Intelligence',
    short_name: 'B2B Leads',
    description: 'AI 기반 영업 인텔리전스 플랫폼',
    start_url: '/',
    display: 'standalone',
    background_color: '#1a1a2e',
    theme_color: '#e94560',
    icons: [
      { src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📊</text></svg>', sizes: '512x512', type: 'image/svg+xml' }
    ]
  };
}

export function getServiceWorkerJS() {
  return `const CACHE = 'b2b-leads-static-v2';
const CACHE_PREFIX = 'b2b-leads-';
const PRECACHE = ['/manifest.json'];
const CACHEABLE_PATHS = new Set(PRECACHE);
const REVIEWER_ROLE_HEADER = 'x-manual-review-notes-local-test-role';

function isProtectedReviewerRequest(request, url) {
  return url.pathname === '/leads'
    || url.pathname.startsWith('/leads/')
    || request.headers.has('Authorization')
    || request.headers.has(REVIEWER_ROLE_HEADER);
}

function canStoreResponse(response) {
  if (!response.ok) return false;
  const cacheControl = (response.headers.get('Cache-Control') || '').toLowerCase();
  const contentType = (response.headers.get('Content-Type') || '').toLowerCase();
  return !cacheControl.includes('no-store')
    && !cacheControl.includes('private')
    && !contentType.includes('text/html');
}

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k !== CACHE && k.startsWith(CACHE_PREFIX)).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  if (isProtectedReviewerRequest(e.request, url)) {
    e.respondWith(fetch(e.request, { cache: 'no-store' }));
    return;
  }
  if (!CACHEABLE_PATHS.has(url.pathname)) return;
  e.respondWith(
    fetch(e.request).then(async res => {
      if (canStoreResponse(res)) {
        const cache = await caches.open(CACHE);
        await cache.put(e.request, res.clone());
      }
      return res;
    }).catch(async error => {
      const cached = await caches.match(e.request);
      if (cached) return cached;
      throw error;
    })
  );
});`;
}
