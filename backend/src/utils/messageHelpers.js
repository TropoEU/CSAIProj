/**
 * Message Helpers
 *
 * Shared utilities for formatting messages and conversation history.
 * Extracted to avoid code duplication across services.
 */

import llmService from '../services/llmService.js';
import { ADAPTIVE_REASONING } from '../config/constants.js';

/**
 * Format conversation history for LLM consumption
 * @param {Array} messages - Raw messages from database
 * @returns {Array} Formatted messages with role and content
 */
export function formatConversationHistory(messages) {
    if (!messages || !Array.isArray(messages)) return [];
    return messages.map(m => ({
        role: m.role,
        content: m.content
    }));
}

/**
 * Build message array for LLM chat
 * @param {string} systemPrompt - System prompt content
 * @param {Array} conversationHistory - Formatted conversation history
 * @returns {Array} Messages array ready for LLM
 */
export function buildMessageArray(systemPrompt, conversationHistory = []) {
    const messages = [];
    if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push(...conversationHistory);
    return messages;
}

/**
 * Accumulate tokens from LLM response
 * @param {Object} existing - Existing token counts {input, output}
 * @param {Object} response - LLM response with tokens
 * @returns {Object} Updated token counts
 */
export function accumulateTokens(existing, response) {
    const input = (existing?.input || 0) + (response?.tokens?.input || 0);
    const output = (existing?.output || 0) + (response?.tokens?.output || 0);
    return { input, output };
}

/**
 * Format tool parameters as inline string
 * @param {Object} params - Tool parameters
 * @returns {string} Formatted params string
 */
export function formatParamsInline(params) {
    if (!params || typeof params !== 'object') return 'none';
    const entries = Object.entries(params);
    if (entries.length === 0) return 'none';
    return entries.map(([key, value]) => `${key}="${value}"`).join(', ');
}

/**
 * Generate a friendly error message via LLM
 * @param {string} errorType - Type of error
 * @param {string} errorDetails - Error details
 * @param {Object} client - Client configuration
 * @param {Array} formattedHistory - Conversation history
 * @returns {Promise<string>} Generated error message
 */
export async function generateErrorMessageViaLLM(errorType, errorDetails, client, formattedHistory = []) {
    const errorPrompt = `Generate a brief, friendly error message for the customer.
Error type: ${errorType}
Details: ${errorDetails}
Keep it apologetic but helpful. One sentence max.`;

    try {
        const messages = [
            { role: 'system', content: errorPrompt },
            ...formattedHistory.filter(m => m.role !== 'system').slice(-3)
        ];

        const response = await llmService.chat(messages, {
            maxTokens: ADAPTIVE_REASONING.ERROR_MESSAGE_MAX_TOKENS || 100,
            temperature: ADAPTIVE_REASONING.ERROR_MESSAGE_TEMPERATURE || 0.7,
            provider: client?.llm_provider,
            model: client?.model_name
        });

        return response.content;
    } catch (e) {
        console.error('[MessageHelpers] Error message generation failed:', e.message);
        return errorDetails || 'Something went wrong. Please try again.';
    }
}

/**
 * Format critique display for debug output
 * @param {Object} assessment - AI assessment
 * @param {Object} critiqueResult - Critique result
 * @returns {string} Formatted critique display
 */
export function formatCritiqueDisplay(assessment, critiqueResult) {
    const params = assessment?.tool_params || {};
    const understanding = critiqueResult?.understanding || {};
    const toolChoice = critiqueResult?.tool_choice || {};
    const execution = critiqueResult?.execution || {};

    const paramsInline = formatParamsInline(params);

    // Build understanding line
    let understandLine = understanding.what_user_wants || 'unknown';
    if (understanding.ai_understood_correctly === false && understanding.misunderstanding) {
        understandLine += ` (WRONG: ${understanding.misunderstanding})`;
    }

    // Build tool line
    let toolLine = `${assessment?.tool_call || 'none'} (${paramsInline})`;
    if (toolChoice.correct_tool === false && toolChoice.suggested_tool) {
        toolLine += ` → should be: ${toolChoice.suggested_tool}`;
    }

    // Build decision line
    let decisionLine = critiqueResult?.decision || 'UNKNOWN';
    if (execution.issues?.length) {
        decisionLine += ` (issues: ${execution.issues.join(', ')})`;
    }

    return `UNDERSTAND: ${understandLine}
TOOL: ${toolLine}
DECISION: ${decisionLine}`;
}
