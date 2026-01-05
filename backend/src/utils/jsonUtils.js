/**
 * Safe JSON parsing utilities
 */

/**
 * List of dangerous property names that could lead to prototype pollution
 */
const DANGEROUS_PROPS = ['__proto__', 'constructor', 'prototype'];

/**
 * Recursively clean an object/array by removing dangerous properties
 * @param {*} obj - The object to clean
 * @returns {*} A new cleaned object
 */
function cleanObject(obj) {
    // Handle primitives and null
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    // Handle arrays
    if (Array.isArray(obj)) {
        return obj.map(item => cleanObject(item));
    }

    // Handle objects - create a new clean object with normal prototype
    const cleaned = {};
    for (const key in obj) {
        // Only copy own properties, not inherited ones
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            // Skip dangerous properties to prevent prototype pollution
            if (!DANGEROUS_PROPS.includes(key)) {
                cleaned[key] = cleanObject(obj[key]);
            }
        }
    }

    return cleaned;
}

/**
 * Safely parse JSON with a fallback value and prototype pollution protection
 * @param {string|object} value - The value to parse (string or already parsed object)
 * @param {*} fallback - The fallback value if parsing fails (default: null)
 * @returns {*} Parsed object or fallback
 */
export function safeJsonParse(value, fallback = null) {
    if (value === null || value === undefined) {
        return fallback;
    }

    // If already an object, clean and return it
    if (typeof value === 'object') {
        return cleanObject(value);
    }

    // If not a string, return fallback
    if (typeof value !== 'string') {
        return fallback;
    }

    try {
        const parsed = JSON.parse(value);
        // Prevent prototype pollution attacks by cleaning the parsed object
        return cleanObject(parsed);
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
    // Don't allow extraction of dangerous properties
    if (DANGEROUS_PROPS.includes(key)) {
        return fallback;
    }

    const parsed = safeJsonParse(value, null);
    if (parsed === null || typeof parsed !== 'object') {
        return fallback;
    }
    return parsed[key] !== undefined ? parsed[key] : fallback;
}
