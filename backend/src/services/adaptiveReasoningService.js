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
import n8nService from './n8nService.js';
import integrationService from './integrationService.js';
import { RedisCache } from './redisCache.js';
import escalationService from './escalationService.js';
import { Message } from '../models/Message.js';
import { ToolExecution } from '../models/ToolExecution.js';
import { getToolPolicy, applyConfidenceFloor, isDestructiveTool, isConfirmation } from '../config/toolPolicies.js';
import { REASON_CODES } from '../constants/reasonCodes.js';
import { generateIntentHash } from '../utils/intentHash.js';
import { getCritiquePrompt } from '../prompts/critiquePrompt.js';
import { getAdaptiveModePromptAsync } from '../prompts/systemPrompt.js';
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

            // Step 3: Build adaptive mode system prompt (async to use database config)
            const systemPrompt = await getAdaptiveModePromptAsync(client, toolSchemas);

            // Step 4: Get recent conversation history (last 5 messages for context)
            // Note: Recent messages already includes the current user message (saved before this service is called)
            const recentMessages = await Message.getRecent(conversationId, 5);
            const formattedHistory = recentMessages.map(m => ({
                role: m.role,
                content: m.content
            }));

            // Store system prompt only on first message of conversation (when there's only 1 recent message)
            const isFirstMessage = recentMessages.length <= 1;
            if (isFirstMessage) {
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
            }

            // Step 4: Call LLM with self-assessment instructions
            // Don't add userMessage again - it's already in formattedHistory
            const messages = [
                { role: 'system', content: systemPrompt },
                ...formattedHistory
            ];

            // Track total tokens across all LLM calls
            let totalInputTokens = 0;
            let totalOutputTokens = 0;

            const llmResponse = await llmService.chat(messages, {
                maxTokens: 2048,
                temperature: 0.3,
                provider: client.llm_provider,
                model: client.model_name
            });

            // Track tokens from first call
            if (llmResponse.tokens) {
                totalInputTokens += llmResponse.tokens.input || 0;
                totalOutputTokens += llmResponse.tokens.output || 0;
            }

            // Step 6: Parse assessment and reasoning from response
            const { visible_response, assessment, reasoning } = llmService.parseAssessment(llmResponse.content);

            // Store combined reasoning + assessment as single debug entry
            // Assessment is stored as metadata (collapsible in UI)
            if (reasoning || assessment) {
                await Message.createDebug(
                    conversationId,
                    'assistant',
                    reasoning || 'Assessment completed',
                    'assessment',
                    {
                        metadata: assessment || {},
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

                // Format context for prompt (even if some keys are missing)
                let additionalContext = formatContextForPrompt(context, client.name);

                // If some context was requested but not available, tell the model
                if (missing.length > 0) {
                    additionalContext += `\n\n## Note: The following information was requested but is not configured for this business: ${missing.join(', ')}. Please inform the customer that this information is not available and suggest they contact the business directly.`;
                }

                // If NO context at all was found, still inform the model
                if (Object.keys(context).length === 0 && missing.length > 0) {
                    additionalContext = `\n\n## Context Not Available\nThe following information was requested but is not configured: ${missing.join(', ')}. Please inform the customer that this information is not available and suggest they contact the business directly.`;
                }

                // Re-prompt with additional context (even if just telling model what's unavailable)
                const updatedSystemPrompt = systemPrompt + additionalContext;

                const contextMessages = [
                    { role: 'system', content: updatedSystemPrompt },
                    ...formattedHistory
                ];

                const contextResponse = await llmService.chat(contextMessages, {
                    maxTokens: 2048,
                    temperature: 0.3,
                    provider: client.llm_provider,
                    model: client.model_name
                });

                // Track tokens
                if (contextResponse.tokens) {
                    totalInputTokens += contextResponse.tokens.input || 0;
                    totalOutputTokens += contextResponse.tokens.output || 0;
                }

                // Parse new assessment
                const { visible_response: newResponse, assessment: newAssessment } = llmService.parseAssessment(contextResponse.content);

                // Store context fetch log
                await Message.createDebug(
                    conversationId,
                    'assistant',
                    `Context fetched (attempt ${contextFetchCount}): requested=${currentAssessment.needs_more_context.join(', ')}, found=${Object.keys(context).join(', ') || 'none'}, missing=${missing.join(', ') || 'none'}`,
                    'internal',
                    {
                        metadata: { context_keys: currentAssessment.needs_more_context, fetched: Object.keys(context), missing },
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

                // If context was unavailable and model now knows, don't keep looping
                if (missing.length > 0 && Object.keys(context).length === 0) {
                    console.log('[AdaptiveReasoning] Context unavailable, model informed, breaking loop');
                    break;
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
                    ...formattedHistory
                ];

                const finalResponse = await llmService.chat(finalMessages, {
                    maxTokens: 2048,
                    temperature: 0.3,
                    provider: client.llm_provider,
                    model: client.model_name
                });

                // Track tokens
                if (finalResponse.tokens) {
                    totalInputTokens += finalResponse.tokens.input || 0;
                    totalOutputTokens += finalResponse.tokens.output || 0;
                }

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
                    // Policy check info is already in the assessment metadata - no need for separate debug message
                    console.log(`[Policy] Check failed: ${policyResult.reason_code}`);

                    // If missing params and no model-generated message, re-prompt the model
                    // to generate a natural response asking for the missing info
                    if (policyResult.reason_code === REASON_CODES.MISSING_PARAM && !policyResult.message) {
                        const missingParamsPrompt = `The tool "${finalAssessment.tool_call}" requires additional information that the customer hasn't provided yet. The following parameters are missing: ${policyResult.missing_params.join(', ')}. Please ask the customer for this information in a natural, friendly way in their language. Do not mention technical parameter names - ask naturally (e.g., instead of "customerName", ask "What is your name?").`;

                        const repromptMessages = [
                            { role: 'system', content: missingParamsPrompt },
                            ...formattedHistory
                        ];

                        const repromptResponse = await llmService.chat(repromptMessages, {
                            maxTokens: 512,
                            temperature: 0.3,
                            provider: client.llm_provider,
                            model: client.model_name
                        });

                        // Track tokens
                        if (repromptResponse.tokens) {
                            totalInputTokens += repromptResponse.tokens.input || 0;
                            totalOutputTokens += repromptResponse.tokens.output || 0;
                        }

                        const modelMessage = repromptResponse.content || 'I need some more information to help you. Could you please provide a few more details?';

                        await Message.create(conversationId, 'assistant', modelMessage, totalOutputTokens);

                        return {
                            response: modelMessage,
                            tool_executed: false,
                            reason_code: policyResult.reason_code,
                            reasoningMetrics: {
                                isAdaptive: true,
                                critiqueTriggered: false,
                                contextFetchCount,
                                totalInputTokens,
                                totalOutputTokens
                            }
                        };
                    }

                    // For other policy failures (e.g., tool not found), use the visible response if available
                    const responseMessage = policyResult.message || finalVisibleResponse || 'I apologize, but I cannot complete that action.';
                    await Message.create(conversationId, 'assistant', responseMessage, 0);

                    return {
                        response: responseMessage,
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
                        'assistant', // Use 'assistant' role - DB constraint only allows user/assistant/system
                        `Tool Call: ${finalAssessment.tool_call}\n${JSON.stringify(finalAssessment.tool_params, null, 2)}`,
                        'tool_call',
                        { reasonCode: 'TOOL_CALL', metadata: { tool: finalAssessment.tool_call, params: finalAssessment.tool_params } }
                    );

                    const toolResult = await this.executeTool(finalAssessment, conversationId, clientId, tools, { client, formattedHistory });

                    if (toolResult.executed) {
                        await Message.createDebug(
                            conversationId,
                            'assistant', // Use 'assistant' role - DB constraint only allows user/assistant/system
                            JSON.stringify(toolResult.result, null, 2),
                            'tool_result',
                            {
                                reasonCode: REASON_CODES.EXECUTED_SUCCESSFULLY,
                                metadata: { tool: finalAssessment.tool_call }
                            }
                        );

                        // Store the formatted response as a visible message
                        const responseMessage = toolResult.final_response || finalVisibleResponse;
                        await Message.create(
                            conversationId,
                            'assistant',
                            responseMessage,
                            totalOutputTokens
                        );

                        return {
                            response: responseMessage,
                            tool_executed: true,
                            tool_result: toolResult.result,
                            reason_code: REASON_CODES.EXECUTED_SUCCESSFULLY,
                            reasoningMetrics: {
                                isAdaptive: true,
                                critiqueTriggered: false,
                                contextFetchCount,
                                totalInputTokens,
                                totalOutputTokens
                            }
                        };
                    } else {
                        await Message.createDebug(
                            conversationId,
                            'assistant', // Use 'assistant' role - DB constraint only allows user/assistant/system
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
                    totalOutputTokens
                );

                return {
                    response: finalVisibleResponse,
                    tool_executed: false,
                    reason_code: REASON_CODES.RESPONDED_SUCCESSFULLY,
                    reasoningMetrics: {
                        isAdaptive: true,
                        critiqueTriggered: false,
                        contextFetchCount,
                        totalInputTokens,
                        totalOutputTokens
                    }
                };
            }

            // Step 10: Run critique
            console.log('[AdaptiveReasoning] Critique triggered');
            const critiqueResult = await this.runCritique(userMessage, finalAssessment, tools, formattedHistory, client, 0, { totalInputTokens, totalOutputTokens });

            // Track tokens from critique
            if (critiqueResult.tokens) {
                totalInputTokens += critiqueResult.tokens.input || 0;
                totalOutputTokens += critiqueResult.tokens.output || 0;
            }

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
                tools,
                totalOutputTokens,
                formattedHistory
            );

            // Add reasoning metrics to result
            critiqueDecisionResult.reasoningMetrics = {
                isAdaptive: true,
                critiqueTriggered: true,
                contextFetchCount,
                totalInputTokens,
                totalOutputTokens
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
            // Don't generate hardcoded message - mark as missing and let the model handle it
            // The model will be re-prompted with missing_params info and can generate a natural response
            return {
                allowed: false,
                reason_code: REASON_CODES.MISSING_PARAM,
                message: null, // Let the model generate the response
                missing_params: actuallyMissing,
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
     * @param {number} retryCount - Current retry attempt (internal)
     * @param {Object} tokenTracking - Token tracking object (internal)
     * @returns {Promise<Object>} Critique result {decision, reasoning, message, tokens}
     */
    async runCritique(userMessage, assessment, tools, conversationHistory = [], client, retryCount = 0, tokenTracking = {}) {
        const MAX_RETRIES = 1; // Only retry once
        let inputTokens = 0;
        let outputTokens = 0;

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

            // Track tokens
            if (critiqueResponse.tokens) {
                inputTokens = critiqueResponse.tokens.input || 0;
                outputTokens = critiqueResponse.tokens.output || 0;
            }

            // Parse critique response (should be JSON)
            const critiqueResult = JSON.parse(critiqueResponse.content);

            // Validate decision
            const validDecisions = ['PROCEED', 'ASK_USER', 'ESCALATE'];
            if (!validDecisions.includes(critiqueResult.decision)) {
                console.warn('[Critique] Invalid decision:', critiqueResult.decision);
                critiqueResult.decision = 'ASK_USER'; // Safe default
            }

            // Include token tracking
            critiqueResult.tokens = { input: inputTokens, output: outputTokens };

            return critiqueResult;

        } catch (error) {
            console.error(`[Critique] Failed (attempt ${retryCount + 1}/${MAX_RETRIES + 1}):`, error.message);

            // Retry only if we haven't exceeded max retries
            if (retryCount < MAX_RETRIES) {
                console.log('[Critique] Retrying...');
                // Add a small delay before retry to avoid rate limits
                await new Promise(resolve => setTimeout(resolve, 1000));
                return await this.runCritique(userMessage, assessment, tools, conversationHistory, client, retryCount + 1, tokenTracking);
            }

            // All attempts failed - escalate
            console.error('[Critique] All retry attempts exhausted, escalating');
            return {
                decision: 'ESCALATE',
                reasoning: `Critique step failed after ${MAX_RETRIES + 1} attempts: ${error.message}`,
                message: 'Unable to validate this request safely',
                tokens: { input: inputTokens, output: outputTokens }
            };
        }
    }

    /**
     * Act on critique decision
     */
    async actOnCritiqueDecision(critiqueResult, assessment, visible_response, conversationId, clientId, client, conversation, tools, outputTokens = 0, formattedHistory = []) {
        const { decision, message } = critiqueResult;

        switch (decision) {
            case 'PROCEED': {
                // Execute tool
                console.log('[Critique] Decision: PROCEED');
                const toolResult = await this.executeTool(assessment, conversationId, clientId, tools, { client, formattedHistory });

                if (toolResult.executed) {
                    // Store the formatted response as a visible message
                    const responseMessage = toolResult.final_response || visible_response;
                    await Message.create(
                        conversationId,
                        'assistant',
                        responseMessage,
                        outputTokens
                    );

                    return {
                        response: responseMessage,
                        tool_executed: true,
                        tool_result: toolResult.result,
                        reason_code: REASON_CODES.EXECUTED_SUCCESSFULLY
                    };
                }

                // Tool failed - return visible response
                await Message.create(
                    conversationId,
                    'assistant',
                    visible_response,
                    outputTokens
                );

                return {
                    response: visible_response,
                    tool_executed: false,
                    reason_code: REASON_CODES.RESPONDED_SUCCESSFULLY
                };
            }

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
                    outputTokens
                );

                return {
                    response: message,
                    tool_executed: false,
                    reason_code: assessment.is_destructive ? REASON_CODES.AWAITING_CONFIRMATION : REASON_CODES.ASK_USER
                };

            case 'ESCALATE': {
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

                const escalationMsg = 'I apologize, but I need to connect you with a team member who can better assist with this request. Someone will be with you shortly.';

                await Message.create(
                    conversationId,
                    'assistant',
                    escalationMsg,
                    outputTokens
                );

                return {
                    response: escalationMsg,
                    tool_executed: false,
                    escalated: true,
                    reason_code: REASON_CODES.ESCALATED_TO_HUMAN
                };
            }

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
                    tools,
                    outputTokens,
                    formattedHistory
                );
        }
    }

    /**
     * Execute a tool via n8n
     * @param {Object} assessment - Assessment with tool_call and tool_params
     * @param {number} conversationId - Conversation ID
     * @param {number} clientId - Client ID
     * @param {Array} tools - Available tools array
     * @param {Object} options - Additional options (client, formattedHistory for response generation)
     */
    async executeTool(assessment, conversationId, clientId, tools, options = {}) {
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

            // Check for duplicate tool calls
            const isDuplicate = await ToolExecution.isDuplicateExecution(conversationId, toolName, toolParams);
            if (isDuplicate) {
                console.log(`[Tool Execution] Duplicate call blocked: ${toolName}`);
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

            if (requiredIntegrations.length > 0) {
                try {
                    integrations = await integrationService.getIntegrationsForTool(
                        clientId,
                        integrationMapping,
                        requiredIntegrations
                    );
                    console.log(`[Tool Execution] Loaded ${Object.keys(integrations).length} integrations`);
                } catch (error) {
                    console.error('[Tool Execution] Failed to load integrations:', error.message);
                    return {
                        executed: false,
                        error: `Integration error: ${error.message}`
                    };
                }
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
                return {
                    executed: false,
                    error: result.error
                };
            }

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
                maxTokens: 512,
                temperature: 0.3,
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

    /**
     * Handle confirmation (matches with pending intent)
     */
    async handleConfirmation(conversationId, _userMessage, client, _conversation) {
        const pending = await RedisCache.getPendingIntent(conversationId);

        if (!pending) {
            console.log('[Confirmation] No pending intent found');
            return null; // No pending intent - not a confirmation
        }

        console.log('[Confirmation] Matched pending intent:', pending.tool);

        // Load tools and conversation history for response generation
        const tools = await toolManager.getClientTools(client.id);
        const recentMessages = await Message.getRecent(conversationId, 5);
        const formattedHistory = recentMessages.map(m => ({
            role: m.role,
            content: m.content
        }));

        // Execute the pending tool
        const toolResult = await this.executeTool(
            { tool_call: pending.tool, tool_params: pending.params },
            conversationId,
            client.id,
            tools,
            { client, formattedHistory }
        );

        // Clear pending intent
        await RedisCache.clearPendingIntent(conversationId);

        // Store confirmation message
        const responseMessage = toolResult.executed
            ? toolResult.final_response
            : `I encountered an error: ${toolResult.error}`;

        await Message.create(
            conversationId,
            'assistant',
            responseMessage,
            0
        );

        return {
            response: responseMessage,
            tool_executed: toolResult.executed,
            tool_result: toolResult.result,
            reason_code: REASON_CODES.CONFIRMATION_RECEIVED
        };
    }

}

// Export singleton
const adaptiveReasoningService = new AdaptiveReasoningService();
export default adaptiveReasoningService;
