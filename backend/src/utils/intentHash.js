import crypto from 'crypto';

/**
 * Generate a deterministic hash for a pending intent
 * Used to match user confirmations with pending actions
 *
 * @param {string} tool - Tool name
 * @param {Object} params - Tool parameters
 * @returns {string} SHA-256 hash of the intent
 */
export function generateIntentHash(tool, params) {
  // Sort params keys for deterministic stringification
  const sortedParams = sortObjectKeys(params);

  // Create string representation
  const intentString = JSON.stringify({ tool, params: sortedParams });

  // Generate SHA-256 hash
  return crypto.createHash('sha256').update(intentString).digest('hex');
}

/**
 * Recursively sort object keys for deterministic JSON stringification
 * @param {any} obj - Object to sort
 * @returns {any} Object with sorted keys
 */
function sortObjectKeys(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }

  return Object.keys(obj)
    .sort()
    .reduce((result, key) => {
      result[key] = sortObjectKeys(obj[key]);
      return result;
    }, {});
}

/**
 * Verify if two intents match by comparing their hashes
 * @param {string} tool1 - First tool name
 * @param {Object} params1 - First tool parameters
 * @param {string} tool2 - Second tool name
 * @param {Object} params2 - Second tool parameters
 * @returns {boolean} True if intents match
 */
export function verifyIntentMatch(tool1, params1, tool2, params2) {
  const hash1 = generateIntentHash(tool1, params1);
  const hash2 = generateIntentHash(tool2, params2);
  return hash1 === hash2;
}
