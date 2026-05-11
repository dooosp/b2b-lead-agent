import { getPWAManifest, getServiceWorkerJS } from '../pages/pwa.js';
import { isAllowedMethod, methodNotAllowedResponse } from './responses.js';

export const staticRoutes = Object.freeze([
  {
    id: 'static.manifest',
    path: '/manifest.json',
    methods: ['GET'],
    handle: (_request, env) => new Response(JSON.stringify(getPWAManifest(env)), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    })
  },
  {
    id: 'static.serviceWorker',
    path: '/sw.js',
    methods: ['GET'],
    handle: () => new Response(getServiceWorkerJS(), {
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'no-cache'
      }
    })
  }
]);

export function matchStaticRoute(pathname) {
  const route = staticRoutes.find((candidate) => candidate.path === pathname);
  return route ? { route, params: {} } : null;
}

export function handleStaticRoute(request, env) {
  const url = new URL(request.url);
  const matched = matchStaticRoute(url.pathname);
  if (!matched) return null;

  if (!isAllowedMethod(request.method, matched.route.methods)) {
    return methodNotAllowedResponse(matched.route.methods);
  }

  return matched.route.handle(request, env);
}
