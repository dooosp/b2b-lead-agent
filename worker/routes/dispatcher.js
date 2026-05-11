import { handleOptions } from '../lib/cors.js';
import { handleApiRoute } from './api.js';
import { handlePageRoute } from './pages.js';
import { handleStaticRoute } from './static.js';

export async function handleWorkerRequest(request, env, ctx) {
  if (request.method === 'OPTIONS') {
    return handleOptions(request, env);
  }

  const staticResponse = handleStaticRoute(request, env);
  if (staticResponse) return staticResponse;

  const apiResponse = await handleApiRoute(request, env, ctx);
  if (apiResponse) return apiResponse;

  return handlePageRoute(request, env);
}
