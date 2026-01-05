/**
 * Tool Policies Configuration
 *
 * Defines safety policies for tools including:
 * - Confidence floors (maximum allowed confidence per tool)
 * - Destructive action flags
 * - Implied destructive intent detection
 */

/**
 * Tool-specific policies
 *
 * maxConfidence: The maximum confidence level the AI can claim for this tool (1-10)
 *                Server will cap the model's confidence at this level
 * isDestructive: Whether this tool performs destructive actions (requires confirmation)
 * requiresConfirmation: Whether this tool always requires user confirmation
 */
export const TOOL_POLICIES = {
    // High-risk destructive tools
    cancel_order: {
        maxConfidence: 6,
        isDestructive: true,
        requiresConfirmation: true
    },
    refund: {
        maxConfidence: 5,
        isDestructive: true,
        requiresConfirmation: true
    },
    delete_account: {
        maxConfidence: 4,
        isDestructive: true,
        requiresConfirmation: true
    },
    delete_booking: {
        maxConfidence: 5,
        isDestructive: true,
        requiresConfirmation: true
    },

    // Medium-risk action tools
    book_appointment: {
        maxConfidence: 7,
        isDestructive: false,
        requiresConfirmation: false
    },
    update_profile: {
        maxConfidence: 7,
        isDestructive: false,
        requiresConfirmation: false
    },
    place_order: {
        maxConfidence: 7,
        isDestructive: false,
        requiresConfirmation: false
    },

    // Low-risk read-only tools
    get_order_status: {
        maxConfidence: 9,
        isDestructive: false,
        requiresConfirmation: false
    },
    check_inventory: {
        maxConfidence: 9,
        isDestructive: false,
        requiresConfirmation: false
    },
    search_products: {
        maxConfidence: 9,
        isDestructive: false,
        requiresConfirmation: false
    },
    get_account_info: {
        maxConfidence: 9,
        isDestructive: false,
        requiresConfirmation: false
    }
};

/**
 * Default policy for tools not explicitly listed above
 */
export const DEFAULT_POLICY = {
    maxConfidence: 7,
    isDestructive: false,
    requiresConfirmation: false
};

/**
 * Implied destructive intent phrases
 * These phrases suggest destructive intent even if not explicitly stated
 */
export const IMPLIED_DESTRUCTIVE_PHRASES = {
    en: [
        "don't want",
        "get rid of",
        "remove",
        "undo",
        "delete",
        "cancel",
        "throw away",
        "discard",
        "eliminate",
        "refund"
    ],
    he: [
        "לא רוצה",
        "תבטל",
        "בטל",
        "תסיר",
        "תמחק",
        "מחק",
        "להיפטר",
        "לזרוק",
        "לבטל",
        "החזר"
    ]
};

/**
 * Confirmation phrases
 * Used to detect when user is confirming a pending action
 */
export const CONFIRMATION_PHRASES = {
    en: [
        "yes",
        "yeah",
        "yep",
        "sure",
        "ok",
        "okay",
        "confirm",
        "confirmed",
        "go ahead",
        "do it",
        "proceed",
        "correct",
        "right",
        "affirmative"
    ],
    he: [
        "כן",
        "בסדר",
        "אוקיי",
        "נכון",
        "תאשר",
        "אישור",
        "תמשיך",
        "קדימה",
        "בצע",
        "המשך"
    ]
};

/**
 * Get policy for a specific tool
 * @param {string} toolName - Name of the tool
 * @returns {Object} Policy object with maxConfidence, isDestructive, requiresConfirmation
 */
export function getToolPolicy(toolName) {
    return TOOL_POLICIES[toolName] || DEFAULT_POLICY;
}

/**
 * Check if a tool is destructive
 * @param {string} toolName - Name of the tool
 * @returns {boolean} True if the tool is destructive
 */
export function isDestructiveTool(toolName) {
    const policy = getToolPolicy(toolName);
    return policy.isDestructive;
}

/**
 * Apply confidence floor to model's confidence score
 * @param {string} toolName - Name of the tool
 * @param {number} modelConfidence - Confidence reported by the model (1-10)
 * @returns {number} Effective confidence after applying floor
 */
export function applyConfidenceFloor(toolName, modelConfidence) {
    const policy = getToolPolicy(toolName);
    return Math.min(modelConfidence, policy.maxConfidence);
}

/**
 * Check if a message contains implied destructive intent
 * @param {string} message - User message
 * @param {string} language - Language code (en, he, etc.)
 * @returns {boolean} True if message implies destructive intent
 */
export function detectImpliedDestructiveIntent(message, language = 'en') {
    const messageLower = message.toLowerCase();
    const phrases = IMPLIED_DESTRUCTIVE_PHRASES[language] || IMPLIED_DESTRUCTIVE_PHRASES.en;

    return phrases.some(phrase => messageLower.includes(phrase.toLowerCase()));
}

/**
 * Check if a message is a confirmation
 * @param {string} message - User message
 * @param {string} language - Language code (en, he, etc.)
 * @returns {boolean} True if message is a confirmation
 */
export function isConfirmation(message, language = 'en') {
    const messageLower = message.toLowerCase().trim();
    const phrases = CONFIRMATION_PHRASES[language] || CONFIRMATION_PHRASES.en;

    // Exact match or starts with confirmation phrase
    return phrases.some(phrase =>
        messageLower === phrase.toLowerCase() ||
        messageLower.startsWith(phrase.toLowerCase() + ' ')
    );
}

/**
 * Get all destructive tool names
 * @returns {string[]} Array of destructive tool names
 */
export function getDestructiveTools() {
    return Object.entries(TOOL_POLICIES)
        .filter(([_, policy]) => policy.isDestructive)
        .map(([toolName, _]) => toolName);
}
