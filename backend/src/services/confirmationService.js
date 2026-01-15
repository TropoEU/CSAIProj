/**
 * Confirmation Service
 *
 * Handles pending intent management and confirmation matching.
 * Used for destructive actions that require user confirmation.
 * Extracted from adaptiveReasoningService for modularity.
 */

import toolManager from './toolManager.js';
import { RedisCache } from './redisCache.js';
import { Message } from '../models/Message.js';
import { REASON_CODES } from '../constants/reasonCodes.js';
import { generateIntentHash } from '../utils/intentHash.js';
import toolExecutionService from './toolExecutionService.js';
import { formatConversationHistory, generateErrorMessageViaLLM } from '../utils/messageHelpers.js';

class ConfirmationService {
    /**
     * Handle a confirmation message (matches with pending intent)
     * @param {number} conversationId - Conversation ID
     * @param {string} userMessage - The confirmation message (e.g., "yes", "confirm")
     * @param {Object} client - Client object
     * @param {Object} conversation - Conversation object
     * @returns {Promise<Object|null>} Result if confirmation matched, null otherwise
     */
    async handleConfirmation(conversationId, userMessage, client, _conversation) {
        // Atomically get and clear pending intent to prevent race conditions
        // This ensures only one request can process the same pending intent
        const pending = await RedisCache.getAndClearPendingIntent(conversationId);

        if (!pending) {
            console.log('[Confirmation] No pending intent found');
            return null; // No pending intent - not a confirmation
        }

        console.log('[Confirmation] Matched pending intent:', pending.tool);

        // Load tools and conversation history for response generation
        const tools = await toolManager.getClientTools(client.id);
        const recentMessages = await Message.getRecent(conversationId, 5);
        const formattedHistory = formatConversationHistory(recentMessages);

        // Create debug message for confirmation reasoning
        await Message.createDebug(
            conversationId,
            'assistant',
            `User confirmed pending action: ${pending.tool}`,
            'confirm',
            {
                metadata: {
                    pending_tool: pending.tool,
                    pending_params: pending.params,
                    confirmation_message: userMessage
                }
            }
        );

        // Execute the pending tool (debug messages handled by toolExecutionService)
        const toolResult = await toolExecutionService.executeTool(
            { tool_call: pending.tool, tool_params: pending.params },
            conversationId,
            client.id,
            tools,
            { client, formattedHistory }
        );

        // Note: pending intent already cleared atomically above

        // Generate response message - use LLM for errors to respect language
        let responseMessage;
        if (toolResult.executed) {
            responseMessage = toolResult.final_response;
        } else {
            // Generate friendly error via shared LLM utility
            responseMessage = await generateErrorMessageViaLLM(
                'action_failed',
                toolResult.error || 'The action failed',
                client,
                formattedHistory
            );
        }

        await Message.create(
            conversationId,
            'assistant',
            responseMessage,
            toolResult.tokens || 0
        );

        return {
            response: responseMessage,
            tool_executed: toolResult.executed,
            tool_result: toolResult.result,
            reason_code: REASON_CODES.CONFIRMATION_RECEIVED
        };
    }

    /**
     * Store a pending intent for confirmation
     * @param {number} conversationId - Conversation ID
     * @param {string} toolName - Name of the tool to execute
     * @param {Object} toolParams - Parameters for the tool
     * @returns {Promise<void>}
     */
    async storePendingIntent(conversationId, toolName, toolParams) {
        const intentHash = generateIntentHash(toolName, toolParams);
        await RedisCache.setPendingIntent(conversationId, {
            tool: toolName,
            params: toolParams,
            hash: intentHash,
            timestamp: Date.now()
        });
        console.log('[PendingIntent] Stored for confirmation');
    }

    /**
     * Clear a pending intent
     * @param {number} conversationId - Conversation ID
     * @returns {Promise<void>}
     */
    async clearPendingIntent(conversationId) {
        await RedisCache.clearPendingIntent(conversationId);
    }

    /**
     * Get a pending intent if it exists
     * @param {number} conversationId - Conversation ID
     * @returns {Promise<Object|null>} Pending intent or null
     */
    async getPendingIntent(conversationId) {
        return await RedisCache.getPendingIntent(conversationId);
    }

    /**
     * Verify if a pending intent matches the expected action
     * @param {number} conversationId - Conversation ID
     * @param {string} toolName - Expected tool name
     * @param {Object} toolParams - Expected tool parameters
     * @returns {Promise<boolean>} True if intent matches
     */
    async verifyPendingIntent(conversationId, toolName, toolParams) {
        const pending = await RedisCache.getPendingIntent(conversationId);
        if (!pending) return false;

        const expectedHash = generateIntentHash(toolName, toolParams);
        return pending.hash === expectedHash;
    }
}

// Export singleton
const confirmationService = new ConfirmationService();
export default confirmationService;
