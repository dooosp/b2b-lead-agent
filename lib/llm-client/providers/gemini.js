const { GoogleGenerativeAI } = require('@google/generative-ai');
const { withRetry } = require('../utils/retry');
const { extractJSON } = require('../utils/json-parser');

class GeminiProvider {
  constructor(config) {
    this.model = config.model || 'gemini-3-flash-preview';
    this.timeout = config.timeout || 30000;
    this.maxRetries = config.maxRetries ?? 2;

    if (!config.apiKey) {
      throw new Error('GeminiProvider: apiKey is required');
    }

    this._genAI = new GoogleGenerativeAI(config.apiKey);
    this._model = this._genAI.getGenerativeModel({ model: this.model });
  }

  /**
   * Generate text response
   * @param {string} prompt
   * @param {Object} [opts] - override timeout/retries per call
   * @returns {Promise<string>}
   */
  async chat(prompt, opts = {}) {
    const timeout = opts.timeout || this.timeout;
    const retries = opts.retries ?? this.maxRetries;
    const label = opts.label || 'Gemini';

    const result = await withRetry(
      () => this._model.generateContent(prompt),
      { retries, timeout, label }
    );

    return result.response.text();
  }

  /**
   * Generate and parse JSON response
   * @param {string} prompt - should instruct JSON output format
   * @param {Object} [opts] - override timeout/retries per call
   * @returns {Promise<any>} parsed JSON
   */
  async chatJSON(prompt, opts = {}) {
    const text = await this.chat(prompt, opts);
    return extractJSON(text);
  }
}

module.exports = { GeminiProvider };
