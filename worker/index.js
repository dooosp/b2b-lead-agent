import { handleWorkerRequest } from './routes/dispatcher.js';

export default {
  async fetch(request, env, ctx) {
    return handleWorkerRequest(request, env, ctx);
  }
};
