/**
 * Structured Reason Codes
 *
 * These codes are stored in the reason_code column of messages and tool_executions tables.
 * They enable analytics, debugging, and compliance reporting.
 */

/**
 * Success codes
 */
export const SUCCESS_CODES = {
    EXECUTED_SUCCESSFULLY: 'EXECUTED_SUCCESSFULLY',
    RESPONDED_SUCCESSFULLY: 'RESPONDED_SUCCESSFULLY'
};

/**
 * Blocked/Prevented codes
 * When the system prevents an action from proceeding
 */
export const BLOCKED_CODES = {
    MISSING_PARAM: 'MISSING_PARAM',
    DESTRUCTIVE_NO_CONFIRM: 'DESTRUCTIVE_NO_CONFIRM',
    LOW_CONFIDENCE: 'LOW_CONFIDENCE',
    TOOL_NOT_FOUND: 'TOOL_NOT_FOUND',
    CONFIDENCE_FLOOR_APPLIED: 'CONFIDENCE_FLOOR_APPLIED',
    TOOL_NOT_ENABLED: 'TOOL_NOT_ENABLED',
    INTEGRATION_NOT_CONFIGURED: 'INTEGRATION_NOT_CONFIGURED'
};

/**
 * Edge case codes
 * Special situations that need tracking
 */
export const EDGE_CASE_CODES = {
    CONTEXT_LOOP_DETECTED: 'CONTEXT_LOOP_DETECTED',
    PENDING_INTENT_MISMATCH: 'PENDING_INTENT_MISMATCH',
    IMPLIED_DESTRUCTIVE_INTENT: 'IMPLIED_DESTRUCTIVE_INTENT',
    CONFIRMATION_RECEIVED: 'CONFIRMATION_RECEIVED',
    AWAITING_CONFIRMATION: 'AWAITING_CONFIRMATION'
};

/**
 * System/Process codes
 * System-level events and processes
 */
export const SYSTEM_CODES = {
    CRITIQUE_FAILED: 'CRITIQUE_FAILED',
    CRITIQUE_TRIGGERED: 'CRITIQUE_TRIGGERED',
    CRITIQUE_SKIPPED: 'CRITIQUE_SKIPPED',
    ASSESSMENT_COMPLETED: 'ASSESSMENT_COMPLETED',
    ESCALATED_TO_HUMAN: 'ESCALATED_TO_HUMAN',
    CONTEXT_FETCHED: 'CONTEXT_FETCHED',
    ASK_USER: 'ASK_USER',
    PROCEED: 'PROCEED'
};

/**
 * All reason codes combined
 */
export const REASON_CODES = {
    ...SUCCESS_CODES,
    ...BLOCKED_CODES,
    ...EDGE_CASE_CODES,
    ...SYSTEM_CODES
};

/**
 * Helper function to check if a reason code is valid
 * @param {string} code - The reason code to validate
 * @returns {boolean} True if valid reason code
 */
export function isValidReasonCode(code) {
    return Object.values(REASON_CODES).includes(code);
}

/**
 * Get human-readable description for a reason code
 * @param {string} code - The reason code
 * @returns {string} Human-readable description
 */
export function getReasonCodeDescription(code) {
    const descriptions = {
        // Success
        EXECUTED_SUCCESSFULLY: 'Tool executed successfully',
        RESPONDED_SUCCESSFULLY: 'Response generated successfully',

        // Blocked
        MISSING_PARAM: 'Required parameter(s) missing',
        DESTRUCTIVE_NO_CONFIRM: 'Destructive action attempted without confirmation',
        LOW_CONFIDENCE: 'Confidence level too low to proceed',
        TOOL_NOT_FOUND: 'Tool does not exist or was hallucinated',
        CONFIDENCE_FLOOR_APPLIED: 'Confidence capped by tool policy',
        TOOL_NOT_ENABLED: 'Tool not enabled for this client',
        INTEGRATION_NOT_CONFIGURED: 'Required integration not configured',

        // Edge cases
        CONTEXT_LOOP_DETECTED: 'AI repeatedly requesting more context',
        PENDING_INTENT_MISMATCH: 'Confirmation does not match pending action',
        IMPLIED_DESTRUCTIVE_INTENT: 'Message implies destructive intent',
        CONFIRMATION_RECEIVED: 'User confirmed pending action',
        AWAITING_CONFIRMATION: 'Waiting for user confirmation',

        // System
        CRITIQUE_FAILED: 'Critique step failed',
        CRITIQUE_TRIGGERED: 'Critique step triggered',
        CRITIQUE_SKIPPED: 'Critique step skipped (not needed)',
        ASSESSMENT_COMPLETED: 'Self-assessment completed',
        ESCALATED_TO_HUMAN: 'Escalated to human agent',
        CONTEXT_FETCHED: 'Additional context fetched',
        ASK_USER: 'Asking user for clarification',
        PROCEED: 'Proceeding with action'
    };

    return descriptions[code] || 'Unknown reason code';
}

/**
 * Get category for a reason code
 * @param {string} code - The reason code
 * @returns {string} Category (success, blocked, edge_case, system)
 */
export function getReasonCodeCategory(code) {
    if (Object.values(SUCCESS_CODES).includes(code)) return 'success';
    if (Object.values(BLOCKED_CODES).includes(code)) return 'blocked';
    if (Object.values(EDGE_CASE_CODES).includes(code)) return 'edge_case';
    if (Object.values(SYSTEM_CODES).includes(code)) return 'system';
    return 'unknown';
}

export default REASON_CODES;
