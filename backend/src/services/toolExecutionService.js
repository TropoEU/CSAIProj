/**
 * Tool Execution Service
 *
 * Handles tool execution via n8n webhooks and response generation.
 * Extracted from adaptiveReasoningService for modularity.
 */

import llmService from './llmService.js';
import n8nService from './n8nService.js';
import integrationService from './integrationService.js';
import { ToolExecution } from '../models/ToolExecution.js';
import { Message } from '../models/Message.js';
import { ADAPTIVE_REASONING, ENV } from '../config/constants.js';
import { REASON_CODES } from '../constants/reasonCodes.js';

class ToolExecutionService {
    /**
     * Execute a tool via n8n
     * @param {Object} assessment - Assessment with tool_call and tool_params
     * @param {number} conversationId - Conversation ID
     * @param {number} clientId - Client ID
     * @param {Array} tools - Available tools array
     * @param {Object} options - Additional options (client, formattedHistory for response generation)
     * @returns {Promise<Object>} Execution result
     */
    async executeTool(assessment, conversationId, clientId, tools, options = {}) {
        // Input validation at service boundary
        if (!assessment || typeof assessment !== 'object') {
            console.error('[Tool Execution] Invalid assessment: must be an object');
            return { executed: false, error: 'Invalid assessment parameter' };
        }
        if (!assessment.tool_call || typeof assessment.tool_call !== 'string') {
            console.error('[Tool Execution] Invalid assessment: missing or invalid tool_call');
            return { executed: false, error: 'Missing tool_call in assessment' };
        }
        if (conversationId === undefined || conversationId === null) {
            console.error('[Tool Execution] Invalid conversationId');
            return { executed: false, error: 'Invalid conversationId' };
        }
        if (clientId === undefined || clientId === null) {
            console.error('[Tool Execution] Invalid clientId');
            return { executed: false, error: 'Invalid clientId' };
        }
        if (!Array.isArray(tools)) {
            console.error('[Tool Execution] Invalid tools: must be an array');
            return { executed: false, error: 'Invalid tools parameter' };
        }

        const toolName = assessment.tool_call;
        const toolParams = assessment.tool_params || {};
        const { client, formattedHistory } = options;

        try {
            // Find the tool in the tools array
            const tool = tools.find(t => t.tool_name === toolName);
            if (!tool) {
                console.error(`[Tool Execution] Tool not found: ${toolName}`);
                return {
                    executed: false,
                    error: `Tool "${toolName}" not found`
                };
            }

            // Log tool call debug message
            await Message.createDebug(
                conversationId,
                'assistant',
                `Tool: ${toolName}\nParams: ${JSON.stringify(toolParams, null, 2)}`,
                'tool_call',
                { reasonCode: 'TOOL_CALL', metadata: { tool: toolName, params: toolParams } }
            );

            // Check for duplicate tool calls
            const isDuplicate = await ToolExecution.isDuplicateExecution(conversationId, toolName, toolParams);
            if (isDuplicate) {
                console.log(`[Tool Execution] Duplicate call blocked: ${toolName}`);
                await Message.createDebug(
                    conversationId,
                    'assistant',
                    'Duplicate call - already executed',
                    'tool_result',
                    { reasonCode: 'DUPLICATE_BLOCKED', metadata: { tool: toolName } }
                );
                return {
                    executed: true,
                    result: { message: 'This action was already completed earlier in this conversation.' },
                    final_response: 'This action was already completed earlier in this conversation.',
                    duplicate: true
                };
            }

            // Fetch integration credentials if needed
            let integrations = {};
            const requiredIntegrations = tool.required_integrations || [];
            const integrationMapping = tool.integration_mapping || {};

            if (ENV.isDevelopment) {
                console.log(`[Tool Execution] Tool ${toolName} requires ${requiredIntegrations.length} integrations`);
                console.log('[Tool Execution] Required integrations:', requiredIntegrations.map(i => i.key).join(', ') || 'none');
                console.log('[Tool Execution] Integration mapping:', JSON.stringify(integrationMapping));
            }

            if (requiredIntegrations.length > 0) {
                try {
                    integrations = await integrationService.getIntegrationsForTool(
                        clientId,
                        integrationMapping,
                        requiredIntegrations
                    );
                    if (ENV.isDevelopment) {
                        console.log(`[Tool Execution] Loaded ${Object.keys(integrations).length} integrations:`, Object.keys(integrations).join(', '));
                        // Only log integration status in development (values are already redacted)
                        Object.entries(integrations).forEach(([key, int]) => {
                            console.log(`[Tool Execution] - ${key}: apiUrl=${int.apiUrl ? 'set' : 'MISSING'}, apiKey=${int.apiKey ? 'set' : 'MISSING'}`);
                        });
                    }
                } catch (error) {
                    console.error('[Tool Execution] Failed to load integrations:', error.message);
                    return {
                        executed: false,
                        error: `Integration error: ${error.message}`
                    };
                }
            } else if (ENV.isDevelopment) {
                console.log(`[Tool Execution] Tool ${toolName} has no required integrations`);
            }

            // Execute via n8n
            console.log(`[Tool Execution] Calling n8n webhook for: ${toolName}`);
            const result = await n8nService.executeTool(tool.n8n_webhook_url, toolParams, { integrations });

            // Handle blocked tools (placeholder values detected)
            if (result.blocked) {
                console.warn(`[Tool Execution] Tool BLOCKED - placeholder values: ${toolName}`);
                await ToolExecution.logBlocked(conversationId, toolName, toolParams, result.error);
                return {
                    executed: false,
                    error: result.error,
                    blocked: true
                };
            }

            // Log execution
            await ToolExecution.create(
                conversationId,
                toolName,
                toolParams,
                result.data,
                result.success,
                result.executionTimeMs
            );

            if (!result.success) {
                await Message.createDebug(
                    conversationId,
                    'assistant',
                    `Tool failed: ${result.error}`,
                    'tool_result',
                    { reasonCode: 'TOOL_FAILED', metadata: { tool: toolName, error: result.error } }
                );
                return {
                    executed: false,
                    error: result.error
                };
            }

            // Check for empty results - this usually indicates an n8n workflow issue
            if (!result.data || (typeof result.data === 'object' && Object.keys(result.data).length === 0)) {
                console.error('[Tool Execution] Tool returned empty result - possible n8n workflow issue');
                await Message.createDebug(
                    conversationId,
                    'assistant',
                    'Tool returned empty result - workflow issue',
                    'tool_result',
                    { reasonCode: 'TOOL_EMPTY', metadata: { tool: toolName } }
                );
                return {
                    executed: false,
                    error: 'The tool returned an empty response. This usually indicates a workflow configuration issue. Please check the n8n workflow and integration settings.',
                    emptyResult: true
                };
            }

            // Log successful tool result
            await Message.createDebug(
                conversationId,
                'assistant',
                `Result: ${JSON.stringify(result.data, null, 2)}`,
                'tool_result',
                { reasonCode: REASON_CODES.EXECUTED_SUCCESSFULLY, metadata: { tool: toolName, result: result.data } }
            );

            // Let the model generate a natural response based on the tool result
            let final_response;
            if (client && formattedHistory) {
                final_response = await this.generateToolResultResponse(
                    toolName,
                    toolParams,
                    result.data,
                    client,
                    formattedHistory
                );
            } else {
                // Fallback: basic formatting if context not available
                final_response = this.basicFormatToolResult(result.data);
            }

            return {
                executed: true,
                result: result.data,
                final_response
            };

        } catch (error) {
            console.error('[Tool Execution] Failed:', error);
            return {
                executed: false,
                error: error.message
            };
        }
    }

    /**
     * Generate a natural response for a tool result using the LLM
     * @param {string} toolName - Name of the tool that was executed
     * @param {Object} toolParams - Parameters used in the tool call
     * @param {Object} toolResult - Raw result from the tool
     * @param {Object} client - Client configuration
     * @param {Array} formattedHistory - Conversation history
     * @returns {Promise<string>} Natural response for the customer
     */
    async generateToolResultResponse(toolName, toolParams, toolResult, client, formattedHistory) {
        try {
            const resultJson = JSON.stringify(toolResult, null, 2);
            const paramsJson = JSON.stringify(toolParams, null, 2);

            const systemPrompt = `You are a helpful customer service assistant. A tool was just executed and you need to communicate the result to the customer in a natural, friendly way in their language.

Tool executed: ${toolName}
Parameters used: ${paramsJson}

Tool result:
${resultJson}

Instructions:
1. Summarize the result naturally for the customer
2. Do NOT expose raw data, JSON, or technical details
3. Use the customer's language (match the language from the conversation)
4. Be concise but complete
5. If the result indicates success, confirm it clearly
6. If the result indicates an error or issue, explain it helpfully`;

            const messages = [
                { role: 'system', content: systemPrompt },
                ...formattedHistory.slice(-3) // Include last few messages for context
            ];

            const response = await llmService.chat(messages, {
                maxTokens: ADAPTIVE_REASONING.REPROMPT_MAX_TOKENS,
                temperature: ADAPTIVE_REASONING.DEFAULT_TEMPERATURE,
                provider: client.llm_provider,
                model: client.model_name
            });

            return response.content || this.basicFormatToolResult(toolResult);
        } catch (error) {
            console.error('[Tool Response] Failed to generate response:', error.message);
            return this.basicFormatToolResult(toolResult);
        }
    }

    /**
     * Basic formatting for tool results when LLM generation fails
     * @param {Object} result - Tool result
     * @returns {string} Basic formatted response
     */
    basicFormatToolResult(result) {
        if (!result) return 'The operation completed.';
        if (typeof result === 'string') return result;
        if (result.message) return result.message;
        if (result.error) return `There was an issue: ${result.error}`;
        return 'The operation completed successfully.';
    }
}

// Export singleton
const toolExecutionService = new ToolExecutionService();
export default toolExecutionService;
