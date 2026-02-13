const { GeminiProvider } = require('./providers/gemini');
const { withRetry } = require('./utils/retry');
const { extractJSON } = require('./utils/json-parser');

/**
 * Create a unified LLM client
 *
 * @param {Object} config
 * @param {string} [config.provider='gemini'] - 'gemini' (more providers later)
 * @param {string} config.apiKey - API key
 * @param {string} [config.model] - model name
 * @param {number} [config.timeout=30000] - timeout per call in ms
 * @param {number} [config.maxRetries=2] - max retry attempts
 * @returns {{ chat: Function, chatJSON: Function }}
 */
function createLLMClient(config = {}) {
  const provider = config.provider || 'gemini';

  switch (provider) {
    case 'gemini':
      return new GeminiProvider(config);
    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}

module.exports = { createLLMClient, withRetry, extractJSON };
