/**
 * Extract and parse JSON from LLM response text
 * Handles markdown code blocks, surrounding text, etc.
 *
 * @param {string} text - raw LLM response
 * @returns {any} parsed JSON object/array
 * @throws {Error} if no valid JSON found
 */
function extractJSON(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Empty or non-string response');
  }

  // Strip markdown code blocks
  let cleaned = text.replace(/```(?:json)?\n?/g, '').replace(/```\n?/g, '').trim();

  // Try direct parse first
  try {
    return JSON.parse(cleaned);
  } catch (_) {}

  // Try to find JSON array or object
  const jsonMatch = cleaned.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]);
    } catch (_) {}
  }

  throw new Error('No valid JSON found in response');
}

module.exports = { extractJSON };
