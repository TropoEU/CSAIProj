/**
 * Safe JSON parsing utilities
 */

/**
 * Safely parse JSON with a fallback value
 * @param {string|object} value - The value to parse (string or already parsed object)
 * @param {*} fallback - The fallback value if parsing fails (default: null)
 * @returns {*} Parsed object or fallback
 */
export function safeJsonParse(value, fallback = null) {
    if (value === null || value === undefined) {
        return fallback;
    }

    // If already an object, return it
    if (typeof value === 'object') {
        return value;
    }

    // If not a string, return fallback
    if (typeof value !== 'string') {
        return fallback;
    }

    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

/**
 * Safely parse JSON and extract a specific key
 * @param {string|object} value - The value to parse
 * @param {string} key - The key to extract
 * @param {*} fallback - The fallback value if parsing fails or key doesn't exist
 * @returns {*} The value at the key or fallback
 */
export function safeJsonGet(value, key, fallback = null) {
    const parsed = safeJsonParse(value, null);
    if (parsed === null || typeof parsed !== 'object') {
        return fallback;
    }
    return parsed[key] !== undefined ? parsed[key] : fallback;
}
