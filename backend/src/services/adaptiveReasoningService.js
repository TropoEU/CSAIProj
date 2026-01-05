/**
 * Adaptive Reasoning Service
 *
 * Orchestrates the two-tier AI processing system:
 * - Self-assessment on every response
 * - Conditional critique when risky actions are detected
 * - Server-side policy enforcement
 * - Confirmation matching via pending intent cache
 */

import llmService from './llmService.js';
import toolManager from './toolManager.js';
import { RedisCache } from './redisCache.js';
import escalationService from './escalationService.js';
import { Message } from '../models/Message.js';
import { getToolPolicy, applyConfidenceFloor, isDestructiveTool, detectImpliedDestructiveIntent, isConfirmation } from '../config/toolPolicies.js';
import { REASON_CODES } from '../constants/reasonCodes.js';
import { generateIntentHash } from '../utils/intentHash.js';
import { getCritiquePrompt } from '../prompts/critiquePrompt.js';
import { getAdaptiveModePrompt } from '../prompts/systemPrompt.js';
import { fetchContext, fetchFullContext, formatContextForPrompt } from '../utils/contextFetcher.js';

class AdaptiveReasoningService {
    /**
     * Process a message using Adaptive mode
     * @param {number} conversationId - Conversation ID
     * @param {number} clientId - Client ID
     * @param {string} userMessage - User's message
     * @param {Object} client - Client configuration
     * @param {Object} conversation - Conversation object
     * @returns {Promise<Object>} Final response with tool results if any
     */
    async processAdaptiveMessage(conversationId, clientId, userMessage, client, conversation) {
        console.log(`[AdaptiveReasoning] Processing message in Adaptive mode for client ${clientId}`);

        // Initialize reasoning metrics tracking
        let critiqueTriggered = false;
        let contextFetchCount = 0;

        try {
            // Step 1: Check for confirmation first
            const language = client.language || 'en';
            if (isConfirmation(userMessage, language)) {
                const confirmationResult = await this.handleConfirmation(conversationId, userMessage, client, conversation);
                if (confirmationResult) {
                    // Add reasoning metrics to confirmation result
                    confirmationResult.reasoningMetrics = {
                        isAdaptive: true,
                        critiqueTriggered: false,
                        contextFetchCount: 0
                    };
                    return confirmationResult; // Confirmation was matched and processed
                }
                // If no pending intent, continue with normal flow
            }

            // Step 2: Load available tools with full schemas for parameter validation
            const tools = await toolManager.getClientTools(clientId);
            console.log('[AdaptiveReasoning] Loaded tools:', tools.map(t => t.tool_name).join(', '));

            // Format tools with schemas for the AI
            const toolSchemas = tools.map(t => ({
                tool_name: t.tool_name,
                description: t.description,
                parameters_schema: t.parameters_schema
            }));

            // Step 3: Build adaptive mode system prompt
            const systemPrompt = getAdaptiveModePrompt(client, toolSchemas);

            // Store system prompt for debugging
            await Message.createDebug(
                conversationId,
                'system',
                systemPrompt,
                'system',
                {
                    reasonCode: 'SYSTEM_PROMPT',
                    metadata: { toolCount: toolSchemas.length, tools: toolSchemas.map(t => t.tool_name) }
                }
            );

            // Step 4: Get recent conversation history (last 5 messages for context)
            // Note: Recent messages already includes the current user message (saved before this service is called)
            const recentMessages = await Message.getRecent(conversationId, 5);
            const formattedHistory = recentMessages.map(m => ({
                role: m.role,
                content: m.content
            }));

            // Step 4: Call LLM with self-assessment instructions
            // Don't add userMessage again - it's already in formattedHistory
            const messages = [
                { role: 'system', content: systemPrompt },
                ...formattedHistory
            ];

            const llmResponse = await llmService.chat(messages, {
                maxTokens: 2048,
                temperature: 0.3,
                provider: client.llm_provider,
                model: client.model_name
            });

            // Step 6: Parse assessment and reasoning from response
            const { visible_response, assessment, reasoning } = llmService.parseAssessment(llmResponse.content);

            // Store reasoning process
            if (reasoning) {
                await Message.createDebug(
                    conversationId,
                    'assistant',
                    reasoning,
                    'internal',
                    { reasonCode: 'REASONING' }
                );
            }

            // Store assessment
            if (assessment) {
                await Message.createDebug(
                    conversationId,
                    'assistant',
                    JSON.stringify(assessment, null, 2),
                    'internal',
                    {
                        metadata: assessment,
                        reasonCode: REASON_CODES.ASSESSMENT_COMPLETED
                    }
                );
            }

            // Step 7: Check if more context is needed (context fetch feature)
            let currentAssessment = assessment;
            let currentResponse = visible_response;
            const MAX_CONTEXT_FETCHES = 2;

            while (
                currentAssessment &&
                currentAssessment.needs_more_context &&
                currentAssessment.needs_more_context.length > 0 &&
                contextFetchCount < MAX_CONTEXT_FETCHES
            ) {
                contextFetchCount++;
                console.log(`[AdaptiveReasoning] Context fetch attempt ${contextFetchCount}/${MAX_CONTEXT_FETCHES}:`, currentAssessment.needs_more_context);

                // Fetch requested context
                const { success, context, missing } = fetchContext(client, currentAssessment.needs_more_context);

                if (!success && missing.length > 0) {
                    console.warn('[AdaptiveReasoning] Some context keys not found:', missing);
                }

                if (Object.keys(context).length === 0) {
                    console.log('[AdaptiveReasoning] No valid context found, breaking loop');
                    break;
                }

                // Format context for prompt
                const additionalContext = formatContextForPrompt(context, client.name);

                // Re-prompt with additional context
                const updatedSystemPrompt = systemPrompt + additionalContext;

                const contextMessages = [
                    { role: 'system', content: updatedSystemPrompt },
                    ...formattedHistory,
                    { role: 'user', content: userMessage }
                ];

                const contextResponse = await llmService.chat(contextMessages, {
                    maxTokens: 2048,
                    temperature: 0.3,
                    provider: client.llm_provider,
                    model: client.model_name
                });

                // Parse new assessment
                const { visible_response: newResponse, assessment: newAssessment } = llmService.parseAssessment(contextResponse.content);

                // Store context fetch log
                await Message.createDebug(
                    conversationId,
                    'assistant',
                    `Context fetched (attempt ${contextFetchCount}): ${currentAssessment.needs_more_context.join(', ')}`,
                    'internal',
                    {
                        metadata: { context_keys: currentAssessment.needs_more_context, fetched: Object.keys(context) },
                        reasonCode: REASON_CODES.CONTEXT_FETCHED
                    }
                );

                // Update current state
                currentAssessment = newAssessment;
                currentResponse = newResponse;

                // Store new assessment
                if (newAssessment) {
                    await Message.createDebug(
                        conversationId,
                        'assistant',
                        JSON.stringify(newAssessment, null, 2),
                        'assessment',
                        {
                            metadata: newAssessment,
                            reasonCode: REASON_CODES.ASSESSMENT_COMPLETED
                        }
                    );
                }
            }

            // Check if we hit the context fetch limit
            if (contextFetchCount >= MAX_CONTEXT_FETCHES && currentAssessment?.needs_more_context?.length > 0) {
                console.warn('[AdaptiveReasoning] Context fetch limit reached, fetching full context');

                // Fetch full context and make one final attempt
                const fullContext = fetchFullContext(client);
                const fullContextFormatted = formatContextForPrompt({ all: fullContext }, client.name);

                const finalSystemPrompt = systemPrompt + fullContextFormatted;
                const finalMessages = [
                    { role: 'system', content: finalSystemPrompt },
                    ...formattedHistory,
                    { role: 'user', content: userMessage }
                ];

                const finalResponse = await llmService.chat(finalMessages, {
                    maxTokens: 2048,
                    temperature: 0.3,
                    provider: client.llm_provider,
                    model: client.model_name
                });

                const { visible_response: finalVisibleResponse, assessment: finalAssessment } = llmService.parseAssessment(finalResponse.content);

                // Store context loop detection
                await Message.createDebug(
                    conversationId,
                    'assistant',
                    'Context fetch limit reached - loaded full context',
                    'internal',
                    {
                        reasonCode: REASON_CODES.CONTEXT_LOOP_DETECTED
                    }
                );

                // Update with final results
                currentAssessment = finalAssessment;
                currentResponse = finalVisibleResponse;

                if (finalAssessment) {
                    await Message.createDebug(
                        conversationId,
                        'assistant',
                        JSON.stringify(finalAssessment, null, 2),
                        'assessment',
                        {
                            metadata: finalAssessment,
                            reasonCode: REASON_CODES.ASSESSMENT_COMPLETED
                        }
                    );
                }
            }

            // Continue with current assessment and response
            const finalAssessment = currentAssessment;
            const finalVisibleResponse = currentResponse;

            // Enforce server-side policies
            if (finalAssessment && finalAssessment.tool_call) {
                const policyResult = this.enforceServerPolicies(finalAssessment, tools);

                if (!policyResult.allowed) {
                    await Message.createDebug(
                        conversationId,
                        'system',
                        `Policy check failed: ${policyResult.reason_code}\nMessage: ${policyResult.message}`,
                        'internal',
                        { reasonCode: policyResult.reason_code }
                    );

                    await Message.create(
                        conversationId,
                        'assistant',
                        policyResult.message,
                        0
                    );

                    return {
                        response: policyResult.message,
                        tool_executed: false,
                        reason_code: policyResult.reason_code,
                        reasoningMetrics: {
                            isAdaptive: true,
                            critiqueTriggered: false,
                            contextFetchCount
                        }
                    };
                }

                // Update assessment with policy-enforced values
                Object.assign(finalAssessment, policyResult.updated_assessment);
            }

            // Step 9: Check if critique is needed
            const needsCritique = finalAssessment && finalAssessment.tool_call && this.shouldTriggerCritique(finalAssessment, tools);

            if (!needsCritique) {
                // No critique needed - proceed directly
                console.log('[AdaptiveReasoning] Critique skipped - simple query or read-only tool');
                critiqueTriggered = false;

                // Store skipped critique log
                await Message.createDebug(
                    conversationId,
                    'assistant',
                    'Critique skipped - no risky action detected',
                    'internal',
                    {
                        reasonCode: REASON_CODES.CRITIQUE_SKIPPED
                    }
                );

                // Execute tool if present
                if (finalAssessment && finalAssessment.tool_call) {
                    await Message.createDebug(
                        conversationId,
                        'tool',
                        `${finalAssessment.tool_call}\n${JSON.stringify(finalAssessment.tool_params, null, 2)}`,
                        'tool_call',
                        { reasonCode: 'TOOL_CALL', metadata: { tool: finalAssessment.tool_call, params: finalAssessment.tool_params } }
                    );

                    const toolResult = await this.executeTool(finalAssessment, conversationId, clientId, tools);

                    if (toolResult.executed) {
                        await Message.createDebug(
                            conversationId,
                            'tool',
                            JSON.stringify(toolResult.result, null, 2),
                            'tool_result',
                            {
                                reasonCode: REASON_CODES.EXECUTED_SUCCESSFULLY,
                                metadata: { tool: finalAssessment.tool_call }
                            }
                        );

                        return {
                            response: toolResult.final_response || finalVisibleResponse,
                            tool_executed: true,
                            tool_result: toolResult.result,
                            reason_code: REASON_CODES.EXECUTED_SUCCESSFULLY,
                            reasoningMetrics: {
                                isAdaptive: true,
                                critiqueTriggered: false,
                                contextFetchCount
                            }
                        };
                    } else {
                        await Message.createDebug(
                            conversationId,
                            'tool',
                            `Tool execution failed: ${toolResult.error}`,
                            'tool_result',
                            { reasonCode: 'TOOL_FAILED' }
                        );
                    }
                }

                // No tool or tool failed - return visible response
                await Message.create(
                    conversationId,
                    'assistant',
                    finalVisibleResponse,
                    0
                );

                return {
                    response: finalVisibleResponse,
                    tool_executed: false,
                    reason_code: REASON_CODES.RESPONDED_SUCCESSFULLY,
                    reasoningMetrics: {
                        isAdaptive: true,
                        critiqueTriggered: false,
                        contextFetchCount
                    }
                };
            }

            // Step 10: Run critique
            console.log('[AdaptiveReasoning] Critique triggered');
            critiqueTriggered = true;
            const critiqueResult = await this.runCritique(userMessage, finalAssessment, tools, formattedHistory, client);

            // Store critique as internal message
            await Message.createDebug(conversationId, 'assistant', JSON.stringify(critiqueResult, null, 2), 'critique', { metadata: critiqueResult, reasonCode: REASON_CODES.CRITIQUE_TRIGGERED });

            // Step 11: Act on critique decision
            const critiqueDecisionResult = await this.actOnCritiqueDecision(
                critiqueResult,
                finalAssessment,
                finalVisibleResponse,
                conversationId,
                clientId,
                client,
                conversation,
                tools
            );

            // Add reasoning metrics to result
            critiqueDecisionResult.reasoningMetrics = {
                isAdaptive: true,
                critiqueTriggered: true,
                contextFetchCount
            };

            return critiqueDecisionResult;

        } catch (error) {
            console.error('[AdaptiveReasoning] Error:', error);

            // Log error and escalate
            await Message.createDebug(conversationId, 'assistant', `Error in adaptive reasoning: ${error.message}`, 'internal', { reasonCode: REASON_CODES.CRITIQUE_FAILED });

            throw error;
        }
    }

    /**
     * Enforce server-side policies (hard stops and confidence floors)
     * @param {Object} assessment - AI's self-assessment
     * @param {Array} tools - Available tools
     * @returns {Object} { allowed, reason_code, message, updated_assessment }
     */
    enforceServerPolicies(assessment, tools) {
        const toolName = assessment.tool_call;
        console.log('[Policy] enforceServerPolicies called for tool:', toolName, 'params:', Object.keys(assessment.tool_params || {}));

        // HARD STOP 1: Tool doesn't exist (hallucinated)
        const tool = tools.find(t => t.tool_name === toolName);
        if (!tool) {
            return {
                allowed: false,
                reason_code: REASON_CODES.TOOL_NOT_FOUND,
                message: `I apologize, but I don't have access to that capability. Let me help you another way.`,
                updated_assessment: assessment
            };
        }

        console.log('[Policy] Tool found, checking schema. Has parameters_schema:', !!tool.parameters_schema);

        // HARD STOP 2: Missing required parameters
        // Check both AI's missing_params AND validate against actual schema
        const schema = tool.parameters_schema || {};
        const required = schema.required || [];
        const provided = Object.keys(assessment.tool_params || {});
        const actuallyMissing = required.filter(param => !provided.includes(param));

        console.log('[Policy] Validation check - Required:', required, 'Provided:', provided, 'Missing:', actuallyMissing);

        if (actuallyMissing.length > 0) {
            console.log('[Policy] Server-side validation found missing params:', actuallyMissing);
            return {
                allowed: false,
                reason_code: REASON_CODES.MISSING_PARAM,
                message: `I need some more information to proceed. Could you provide: ${actuallyMissing.join(', ')}?`,
                updated_assessment: { ...assessment, missing_params: actuallyMissing }
            };
        }

        // Apply confidence floor
        const policy = getToolPolicy(toolName);
        const original_confidence = assessment.confidence;
        const effective_confidence = applyConfidenceFloor(toolName, assessment.confidence);

        if (effective_confidence < original_confidence) {
            console.log(`[Policy] Confidence floor applied: ${original_confidence} -> ${effective_confidence} for tool ${toolName}`);
        }

        // Override needs_confirmation for destructive tools
        const updated_assessment = {
            ...assessment,
            confidence: effective_confidence,
            is_destructive: isDestructiveTool(toolName) || assessment.is_destructive,
            needs_confirmation: policy.requiresConfirmation || assessment.needs_confirmation
        };

        return {
            allowed: true,
            reason_code: effective_confidence < original_confidence ? REASON_CODES.CONFIDENCE_FLOOR_APPLIED : null,
            updated_assessment
        };
    }

    /**
     * Determine if critique should be triggered
     * @param {Object} assessment - AI's self-assessment
     * @param {Array} tools - Available tools
     * @returns {boolean} True if critique is needed
     */
    shouldTriggerCritique(assessment, tools) {
        const toolName = assessment.tool_call;

        // No tool call = no critique needed
        if (!toolName) return false;

        // Check if tool exists
        const tool = tools.find(t => t.tool_name === toolName);
        if (!tool) return true; // Hallucinated tool - needs critique to catch

        // Trigger if destructive
        if (assessment.is_destructive) {
            console.log('[Critique Trigger] Destructive tool detected');
            return true;
        }

        // Trigger if low confidence after floor
        if (assessment.confidence < 7) {
            console.log(`[Critique Trigger] Low confidence: ${assessment.confidence}`);
            return true;
        }

        // Trigger if missing params (should be caught earlier but double-check)
        if (assessment.missing_params && assessment.missing_params.length > 0) {
            console.log('[Critique Trigger] Missing parameters');
            return true;
        }

        // Trigger if AI explicitly says needs confirmation
        if (assessment.needs_confirmation) {
            console.log('[Critique Trigger] Needs confirmation flag set');
            return true;
        }

        // No critique needed - safe to proceed
        return false;
    }

    /**
     * Run critique step
     * @param {string} userMessage - User's message
     * @param {Object} assessment - AI's self-assessment
     * @param {Array} tools - Available tools
     * @param {Array} conversationHistory - Recent messages
     * @param {Object} client - Client object with provider and model info
     * @returns {Promise<Object>} Critique result {decision, reasoning, message}
     */
    async runCritique(userMessage, assessment, tools, conversationHistory = [], client) {
        try {
            const critiquePrompt = getCritiquePrompt(userMessage, assessment, tools, conversationHistory);

            const critiqueResponse = await llmService.chat([
                { role: 'user', content: critiquePrompt }
            ], {
                maxTokens: 1024,
                temperature: 0.2, // Lower temperature for more consistent critique
                provider: client.llm_provider,
                model: client.model_name
            });

            // Parse critique response (should be JSON)
            const critiqueResult = JSON.parse(critiqueResponse.content);

            // Validate decision
            const validDecisions = ['PROCEED', 'ASK_USER', 'ESCALATE'];
            if (!validDecisions.includes(critiqueResult.decision)) {
                console.warn('[Critique] Invalid decision:', critiqueResult.decision);
                critiqueResult.decision = 'ASK_USER'; // Safe default
            }

            return critiqueResult;

        } catch (error) {
            console.error('[Critique] Failed:', error);

            // Retry once
            try {
                console.log('[Critique] Retrying...');
                return await this.runCritique(userMessage, assessment, tools, conversationHistory, client);
            } catch (retryError) {
                // Both attempts failed - escalate
                return {
                    decision: 'ESCALATE',
                    reasoning: 'Critique step failed after retry',
                    message: 'Unable to validate this request safely'
                };
            }
        }
    }

    /**
     * Act on critique decision
     */
    async actOnCritiqueDecision(critiqueResult, assessment, visible_response, conversationId, clientId, client, conversation, tools) {
        const { decision, reasoning, message } = critiqueResult;

        switch (decision) {
            case 'PROCEED':
                // Execute tool
                console.log('[Critique] Decision: PROCEED');
                const toolResult = await this.executeTool(assessment, conversationId, clientId, tools);

                if (toolResult.executed) {
                    return {
                        response: toolResult.final_response || visible_response,
                        tool_executed: true,
                        tool_result: toolResult.result,
                        reason_code: REASON_CODES.EXECUTED_SUCCESSFULLY
                    };
                }

                return {
                    response: visible_response,
                    tool_executed: false,
                    reason_code: REASON_CODES.RESPONDED_SUCCESSFULLY
                };

            case 'ASK_USER':
                console.log('[Critique] Decision: ASK_USER -', message);

                // If this is a destructive action, store pending intent
                if (assessment.is_destructive && assessment.tool_call) {
                    const intentHash = generateIntentHash(assessment.tool_call, assessment.tool_params);
                    await RedisCache.setPendingIntent(conversationId, {
                        tool: assessment.tool_call,
                        params: assessment.tool_params,
                        hash: intentHash,
                        timestamp: Date.now()
                    });

                    console.log('[PendingIntent] Stored for confirmation');
                }

                // Store message for user
                await Message.create(
                    conversationId,
                    'assistant',
                    message,
                    0
                );

                return {
                    response: message,
                    tool_executed: false,
                    reason_code: assessment.is_destructive ? REASON_CODES.AWAITING_CONFIRMATION : REASON_CODES.ASK_USER
                };

            case 'ESCALATE':
                console.log('[Critique] Decision: ESCALATE -', message);

                // Trigger escalation
                await escalationService.createEscalation({
                    client_id: clientId,
                    conversation_id: conversationId,
                    reason: 'ai_stuck',
                    context: {
                        user_message: conversation.last_message,
                        assessment,
                        critique: critiqueResult
                    }
                });

                const escalationMessage = `I apologize, but I need to connect you with a team member who can better assist with this request. Someone will be with you shortly.`;

                await Message.create(
                    conversationId,
                    'assistant',
                    escalationMessage,
                    0
                );

                return {
                    response: escalationMessage,
                    tool_executed: false,
                    escalated: true,
                    reason_code: REASON_CODES.ESCALATED_TO_HUMAN
                };

            default:
                // Unknown decision - escalate as safety measure
                return await this.actOnCritiqueDecision(
                    { decision: 'ESCALATE', reasoning: 'Unknown critique decision', message: 'Unable to process request' },
                    assessment,
                    visible_response,
                    conversationId,
                    clientId,
                    client,
                    conversation,
                    tools
                );
        }
    }

    /**
     * Execute a tool
     */
    async executeTool(assessment, conversationId, clientId, tools) {
        try {
            const toolResult = await toolManager.executeTool(
                assessment.tool_call,
                assessment.tool_params,
                clientId,
                conversationId
            );

            return {
                executed: true,
                result: toolResult,
                final_response: toolResult.message || toolResult.data
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
     * Handle confirmation (matches with pending intent)
     */
    async handleConfirmation(conversationId, userMessage, client, conversation) {
        const pending = await RedisCache.getPendingIntent(conversationId);

        if (!pending) {
            console.log('[Confirmation] No pending intent found');
            return null; // No pending intent - not a confirmation
        }

        console.log('[Confirmation] Matched pending intent:', pending.tool);

        // Execute the pending tool
        const toolResult = await this.executeTool(
            { tool_call: pending.tool, tool_params: pending.params },
            conversationId,
            client.id,
            await toolManager.getClientTools(client.id)
        );

        // Clear pending intent
        await RedisCache.clearPendingIntent(conversationId);

        // Store confirmation message
        await Message.create(
            conversationId,
            'assistant',
            toolResult.executed ? `Confirmed! ${toolResult.final_response}` : `I encountered an error: ${toolResult.error}`,
            0
        );

        return {
            response: toolResult.executed ? toolResult.final_response : `I encountered an error: ${toolResult.error}`,
            tool_executed: toolResult.executed,
            tool_result: toolResult.result,
            reason_code: REASON_CODES.CONFIRMATION_RECEIVED
        };
    }
}

// Export singleton
const adaptiveReasoningService = new AdaptiveReasoningService();
export default adaptiveReasoningService;
