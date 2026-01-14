/**
 * Adaptive Reasoning Service
 *
 * Orchestrates the two-tier AI processing system:
 * - Self-assessment on every response
 * - Conditional critique when risky actions are detected
 * - Server-side policy enforcement
 * - Confirmation matching via pending intent cache
 *
 * Tool execution and confirmation handling are delegated to specialized services:
 * - toolExecutionService.js - Tool execution via n8n
 * - confirmationService.js - Pending intent management
 */

import llmService from './llmService.js';
import toolManager from './toolManager.js';
import escalationService from './escalationService.js';
import toolExecutionService from './toolExecutionService.js';
import confirmationService from './confirmationService.js';
import { Message } from '../models/Message.js';
import { getToolPolicy, applyConfidenceFloor, isDestructiveTool, isConfirmation } from '../config/toolPolicies.js';
import { ADAPTIVE_REASONING } from '../config/constants.js';
import { REASON_CODES } from '../constants/reasonCodes.js';
import { getCritiquePrompt } from '../prompts/critiquePrompt.js';
import { getAdaptiveModePromptAsync } from '../prompts/systemPrompt.js';
import { fetchContext, fetchFullContext, formatContextForPrompt } from '../utils/contextFetcher.js';
import {
    formatConversationHistory,
    formatCritiqueDisplay,
    generateErrorMessageViaLLM
} from '../utils/messageHelpers.js';

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
                const confirmationResult = await confirmationService.handleConfirmation(
                    conversationId,
                    userMessage,
                    client,
                    conversation
                );
                if (confirmationResult) {
                    // Add reasoning metrics to confirmation result
                    confirmationResult.reasoningMetrics = {
                        isAdaptive: true,
                        critiqueTriggered: false,
                        contextFetchCount: 0
                    };
                    return confirmationResult;
                }
                // If no pending intent, continue with normal flow
            }

            // Step 2: Load available tools with full schemas
            const tools = await toolManager.getClientTools(clientId);
            console.log('[AdaptiveReasoning] Loaded tools:', tools.map(t => t.tool_name).join(', '));

            const toolSchemas = tools.map(t => ({
                tool_name: t.tool_name,
                description: t.description,
                parameters_schema: t.parameters_schema
            }));

            // Step 3: Build adaptive mode system prompt
            const systemPrompt = await getAdaptiveModePromptAsync(client, toolSchemas);

            // Step 4: Get recent conversation history
            const recentMessages = await Message.getRecent(conversationId, ADAPTIVE_REASONING.CONTEXT_MESSAGE_COUNT);
            const formattedHistory = formatConversationHistory(recentMessages);

            // Store system prompt on first message
            if (recentMessages.length <= 1) {
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

            // Step 5: Call LLM with self-assessment instructions
            const messages = [
                { role: 'system', content: systemPrompt },
                ...formattedHistory
            ];

            let totalInputTokens = 0;
            let totalOutputTokens = 0;

            const llmResponse = await llmService.chat(messages, {
                maxTokens: ADAPTIVE_REASONING.DEFAULT_MAX_TOKENS,
                temperature: ADAPTIVE_REASONING.DEFAULT_TEMPERATURE,
                provider: client.llm_provider,
                model: client.model_name
            });

            if (llmResponse.tokens) {
                totalInputTokens += llmResponse.tokens.input || 0;
                totalOutputTokens += llmResponse.tokens.output || 0;
            }

            // Step 6: Parse assessment and reasoning
            const { visible_response, assessment, reasoning } = llmService.parseAssessment(llmResponse.content);

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

            // Step 7: Handle context fetching if needed
            const contextResult = await this._handleContextFetching(
                assessment,
                visible_response,
                systemPrompt,
                formattedHistory,
                client,
                conversationId,
                contextFetchCount,
                { totalInputTokens, totalOutputTokens }
            );

            contextFetchCount = contextResult.contextFetchCount;
            totalInputTokens = contextResult.totalInputTokens;
            totalOutputTokens = contextResult.totalOutputTokens;
            const finalAssessment = contextResult.assessment;
            const finalVisibleResponse = contextResult.visibleResponse;

            // Step 8: Enforce server-side policies
            if (finalAssessment && finalAssessment.tool_call) {
                const policyResult = this.enforceServerPolicies(finalAssessment, tools);

                if (!policyResult.allowed) {
                    return await this._handlePolicyFailure(
                        policyResult,
                        finalAssessment,
                        finalVisibleResponse,
                        formattedHistory,
                        client,
                        conversationId,
                        contextFetchCount,
                        { totalInputTokens, totalOutputTokens }
                    );
                }

                Object.assign(finalAssessment, policyResult.updated_assessment);
            }

            // Step 9: Check if critique is needed
            const needsCritique = finalAssessment && finalAssessment.tool_call && this.shouldTriggerCritique(finalAssessment, tools);

            if (!needsCritique) {
                return await this._handleNoCritique(
                    finalAssessment,
                    finalVisibleResponse,
                    conversationId,
                    clientId,
                    tools,
                    client,
                    formattedHistory,
                    contextFetchCount,
                    { totalInputTokens, totalOutputTokens }
                );
            }

            // Step 10: Run critique
            console.log('[AdaptiveReasoning] Critique triggered');
            const critiqueResult = await this.runCritique(userMessage, finalAssessment, tools, formattedHistory, client);

            if (critiqueResult.tokens) {
                totalInputTokens += critiqueResult.tokens.input || 0;
                totalOutputTokens += critiqueResult.tokens.output || 0;
            }

            // Format critique debug content to match REASONING style
            const critiqueDisplay = formatCritiqueDisplay(finalAssessment, critiqueResult);

            const critiqueDebugMetadata = {
                input: {
                    tool: finalAssessment.tool_call,
                    params: finalAssessment.tool_params,
                    confidence: finalAssessment.confidence
                },
                understanding: critiqueResult.understanding,
                tool_choice: critiqueResult.tool_choice,
                execution: critiqueResult.execution,
                decision: critiqueResult.decision,
                reasoning: critiqueResult.reasoning
            };

            await Message.createDebug(
                conversationId,
                'assistant',
                critiqueDisplay,
                'critique',
                { metadata: critiqueDebugMetadata, reasonCode: REASON_CODES.CRITIQUE_TRIGGERED }
            );

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
            await Message.createDebug(
                conversationId,
                'assistant',
                `Error in adaptive reasoning: ${error.message}`,
                'internal',
                { reasonCode: REASON_CODES.CRITIQUE_FAILED }
            );
            throw error;
        }
    }

    /**
     * Handle context fetching loop
     * @private
     */
    async _handleContextFetching(assessment, visibleResponse, systemPrompt, formattedHistory, client, conversationId, contextFetchCount, tokens) {
        let currentAssessment = assessment;
        let currentResponse = visibleResponse;
        let totalInputTokens = tokens.totalInputTokens;
        let totalOutputTokens = tokens.totalOutputTokens;

        while (
            currentAssessment &&
            currentAssessment.needs_more_context &&
            currentAssessment.needs_more_context.length > 0 &&
            contextFetchCount < ADAPTIVE_REASONING.MAX_CONTEXT_FETCHES
        ) {
            contextFetchCount++;
            console.log(`[AdaptiveReasoning] Context fetch attempt ${contextFetchCount}/${ADAPTIVE_REASONING.MAX_CONTEXT_FETCHES}:`, currentAssessment.needs_more_context);

            const { success, context, missing } = fetchContext(client, currentAssessment.needs_more_context);

            if (!success && missing.length > 0) {
                console.warn('[AdaptiveReasoning] Some context keys not found:', missing);
            }

            let additionalContext = formatContextForPrompt(context, client.name);

            if (missing.length > 0) {
                additionalContext += `\n\n## Note: The following information was requested but is not configured for this business: ${missing.join(', ')}. Please inform the customer that this information is not available and suggest they contact the business directly.`;
            }

            if (Object.keys(context).length === 0 && missing.length > 0) {
                additionalContext = `\n\n## Context Not Available\nThe following information was requested but is not configured: ${missing.join(', ')}. Please inform the customer that this information is not available and suggest they contact the business directly.`;
            }

            const updatedSystemPrompt = systemPrompt + additionalContext;
            const contextMessages = [
                { role: 'system', content: updatedSystemPrompt },
                ...formattedHistory
            ];

            const contextResponse = await llmService.chat(contextMessages, {
                maxTokens: ADAPTIVE_REASONING.DEFAULT_MAX_TOKENS,
                temperature: ADAPTIVE_REASONING.DEFAULT_TEMPERATURE,
                provider: client.llm_provider,
                model: client.model_name
            });

            if (contextResponse.tokens) {
                totalInputTokens += contextResponse.tokens.input || 0;
                totalOutputTokens += contextResponse.tokens.output || 0;
            }

            const { visible_response: newResponse, assessment: newAssessment } = llmService.parseAssessment(contextResponse.content);

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

            currentAssessment = newAssessment;
            currentResponse = newResponse;

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

            if (missing.length > 0 && Object.keys(context).length === 0) {
                console.log('[AdaptiveReasoning] Context unavailable, model informed, breaking loop');
                break;
            }
        }

        // Handle context fetch limit
        if (contextFetchCount >= ADAPTIVE_REASONING.MAX_CONTEXT_FETCHES && currentAssessment?.needs_more_context?.length > 0) {
            console.warn('[AdaptiveReasoning] Context fetch limit reached, fetching full context');

            const fullContext = fetchFullContext(client);
            const fullContextFormatted = formatContextForPrompt({ all: fullContext }, client.name);

            const finalSystemPrompt = systemPrompt + fullContextFormatted;
            const finalMessages = [
                { role: 'system', content: finalSystemPrompt },
                ...formattedHistory
            ];

            const finalResponse = await llmService.chat(finalMessages, {
                maxTokens: ADAPTIVE_REASONING.DEFAULT_MAX_TOKENS,
                temperature: ADAPTIVE_REASONING.DEFAULT_TEMPERATURE,
                provider: client.llm_provider,
                model: client.model_name
            });

            if (finalResponse.tokens) {
                totalInputTokens += finalResponse.tokens.input || 0;
                totalOutputTokens += finalResponse.tokens.output || 0;
            }

            const { visible_response: finalVisibleResponse, assessment: finalAssessment } = llmService.parseAssessment(finalResponse.content);

            await Message.createDebug(
                conversationId,
                'assistant',
                'Context fetch limit reached - loaded full context',
                'internal',
                { reasonCode: REASON_CODES.CONTEXT_LOOP_DETECTED }
            );

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

        return {
            assessment: currentAssessment,
            visibleResponse: currentResponse,
            contextFetchCount,
            totalInputTokens,
            totalOutputTokens
        };
    }

    /**
     * Handle policy failure (missing params, tool not found, etc.)
     * @private
     */
    async _handlePolicyFailure(policyResult, assessment, visibleResponse, formattedHistory, client, conversationId, contextFetchCount, tokens) {
        let { totalInputTokens, totalOutputTokens } = tokens;

        console.log(`[Policy] Check failed: ${policyResult.reason_code}`);

        if (policyResult.reason_code === REASON_CODES.MISSING_PARAM && !policyResult.message) {
            const missingParamsPrompt = `The tool "${assessment.tool_call}" requires additional information that the customer hasn't provided yet. The following parameters are missing: ${policyResult.missing_params.join(', ')}. Please ask the customer for this information in a natural, friendly way in their language. Do not mention technical parameter names - ask naturally (e.g., instead of "customerName", ask "What is your name?").`;

            const repromptMessages = [
                { role: 'system', content: missingParamsPrompt },
                ...formattedHistory
            ];

            const repromptResponse = await llmService.chat(repromptMessages, {
                maxTokens: ADAPTIVE_REASONING.REPROMPT_MAX_TOKENS,
                temperature: ADAPTIVE_REASONING.DEFAULT_TEMPERATURE,
                provider: client.llm_provider,
                model: client.model_name
            });

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

        // Generate error message via LLM if no message provided
        let responseMessage = policyResult.message || visibleResponse;
        if (!responseMessage) {
            responseMessage = await this.generateErrorMessage(
                policyResult.reason_code || 'action_blocked',
                'Unable to complete the requested action',
                client,
                formattedHistory
            );
        }
        await Message.create(conversationId, 'assistant', responseMessage, 0);

        return {
            response: responseMessage,
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

    /**
     * Handle case when no critique is needed
     * @private
     */
    async _handleNoCritique(assessment, visibleResponse, conversationId, clientId, tools, client, formattedHistory, contextFetchCount, tokens) {
        const { totalInputTokens, totalOutputTokens } = tokens;

        console.log('[AdaptiveReasoning] Critique skipped - simple query or read-only tool');

        await Message.createDebug(
            conversationId,
            'assistant',
            'Critique skipped - no risky action detected',
            'internal',
            { reasonCode: REASON_CODES.CRITIQUE_SKIPPED }
        );

        if (assessment && assessment.tool_call) {
            const toolResult = await toolExecutionService.executeTool(
                assessment,
                conversationId,
                clientId,
                tools,
                { client, formattedHistory }
            );

            if (toolResult.executed) {
                const responseMessage = toolResult.final_response || visibleResponse;
                await Message.create(conversationId, 'assistant', responseMessage, totalOutputTokens);

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
            }
        }

        await Message.create(conversationId, 'assistant', visibleResponse, totalOutputTokens);

        return {
            response: visibleResponse,
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
                // Message will be generated by LLM in calling code
                message: null,
                updated_assessment: assessment
            };
        }

        console.log('[Policy] Tool found, checking schema. Has parameters_schema:', !!tool.parameters_schema);

        // HARD STOP 2: Missing required parameters
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
                message: null,
                missing_params: actuallyMissing,
                updated_assessment: { ...assessment, missing_params: actuallyMissing }
            };
        }

        // Apply confidence floor
        const policy = getToolPolicy(toolName, tool);
        const original_confidence = assessment.confidence;
        const effective_confidence = applyConfidenceFloor(toolName, assessment.confidence, tool);

        if (effective_confidence < original_confidence) {
            console.log(`[Policy] Confidence floor applied: ${original_confidence} -> ${effective_confidence} for tool ${toolName} (max: ${policy.maxConfidence})`);
        }

        const updated_assessment = {
            ...assessment,
            confidence: effective_confidence,
            is_destructive: isDestructiveTool(toolName, tool) || assessment.is_destructive,
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

        if (!toolName) return false;

        const tool = tools.find(t => t.tool_name === toolName);
        if (!tool) return true;

        if (assessment.is_destructive || isDestructiveTool(toolName, tool)) {
            console.log('[Critique Trigger] Destructive tool detected');
            return true;
        }

        if (assessment.confidence < ADAPTIVE_REASONING.MIN_CONFIDENCE_FOR_ACTION) {
            console.log(`[Critique Trigger] Low confidence: ${assessment.confidence}`);
            return true;
        }

        if (assessment.missing_params && assessment.missing_params.length > 0) {
            console.log('[Critique Trigger] Missing parameters');
            return true;
        }

        if (assessment.needs_confirmation) {
            console.log('[Critique Trigger] Needs confirmation flag set');
            return true;
        }

        return false;
    }

    /**
     * Run critique step
     * @param {string} userMessage - User's message
     * @param {Object} assessment - AI's self-assessment
     * @param {Array} tools - Available tools
     * @param {Array} conversationHistory - Recent messages
     * @param {Object} client - Client object
     * @param {number} retryCount - Current retry attempt
     * @returns {Promise<Object>} Critique result
     */
    async runCritique(userMessage, assessment, tools, conversationHistory = [], client, retryCount = 0) {
        let inputTokens = 0;
        let outputTokens = 0;

        try {
            const critiquePrompt = getCritiquePrompt(userMessage, assessment, tools, conversationHistory);

            const critiqueResponse = await llmService.chat([
                { role: 'user', content: critiquePrompt }
            ], {
                maxTokens: ADAPTIVE_REASONING.CRITIQUE_MAX_TOKENS,
                temperature: ADAPTIVE_REASONING.CRITIQUE_TEMPERATURE,
                provider: client.llm_provider,
                model: client.model_name
            });

            if (critiqueResponse.tokens) {
                inputTokens = critiqueResponse.tokens.input || 0;
                outputTokens = critiqueResponse.tokens.output || 0;
            }

            // Strip markdown code blocks if present (LLM sometimes wraps JSON in ```json ... ```)
            let jsonContent = critiqueResponse.content.trim();
            if (jsonContent.startsWith('```')) {
                jsonContent = jsonContent.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
            }
            const critiqueResult = JSON.parse(jsonContent);

            const validDecisions = ['PROCEED', 'RETRY', 'ASK_USER', 'ESCALATE'];
            if (!validDecisions.includes(critiqueResult.decision)) {
                console.warn('[Critique] Invalid decision:', critiqueResult.decision);
                critiqueResult.decision = 'ASK_USER';
            }

            critiqueResult.tokens = { input: inputTokens, output: outputTokens };
            return critiqueResult;

        } catch (error) {
            console.error(`[Critique] Failed (attempt ${retryCount + 1}/${ADAPTIVE_REASONING.CRITIQUE_MAX_RETRIES + 1}):`, error.message);

            if (retryCount < ADAPTIVE_REASONING.CRITIQUE_MAX_RETRIES) {
                console.log('[Critique] Retrying...');
                await new Promise(resolve => setTimeout(resolve, ADAPTIVE_REASONING.CRITIQUE_RETRY_DELAY));
                return await this.runCritique(userMessage, assessment, tools, conversationHistory, client, retryCount + 1);
            }

            console.error('[Critique] All retry attempts exhausted, escalating');
            return {
                decision: 'ESCALATE',
                reasoning: `Critique step failed after ${ADAPTIVE_REASONING.CRITIQUE_MAX_RETRIES + 1} attempts: ${error.message}`,
                message: 'Unable to validate this request safely',
                tokens: { input: inputTokens, output: outputTokens }
            };
        }
    }

    /**
     * Act on critique decision
     * @param {number} retryCount - Number of times we've retried (max 1 to prevent loops)
     */
    async actOnCritiqueDecision(critiqueResult, assessment, visible_response, conversationId, clientId, client, conversation, tools, outputTokens = 0, formattedHistory = [], retryCount = 0) {
        const { decision } = critiqueResult;

        switch (decision) {
            case 'RETRY': {
                console.log('[Critique] Decision: RETRY - retryCount:', retryCount);

                // Prevent infinite loops - max 1 retry then escalate
                if (retryCount >= 1) {
                    console.log('[Critique] Max retries reached, escalating');
                    return await this.actOnCritiqueDecision(
                        { ...critiqueResult, decision: 'ESCALATE', reasoning: 'AI could not correct its understanding after retry' },
                        assessment,
                        visible_response,
                        conversationId,
                        clientId,
                        client,
                        conversation,
                        tools,
                        outputTokens,
                        formattedHistory,
                        retryCount
                    );
                }

                // Re-run reasoning with critique feedback
                const retryResult = await this.retryReasoning(
                    critiqueResult,
                    assessment,
                    client,
                    formattedHistory,
                    tools,
                    conversationId,
                    clientId,
                    conversation,
                    retryCount + 1
                );

                return retryResult;
            }

            case 'PROCEED': {
                console.log('[Critique] Decision: PROCEED');

                const toolResult = await toolExecutionService.executeTool(
                    assessment,
                    conversationId,
                    clientId,
                    tools,
                    { client, formattedHistory }
                );

                if (toolResult.executed) {
                    const responseMessage = toolResult.final_response || visible_response;
                    await Message.create(conversationId, 'assistant', responseMessage, outputTokens);

                    return {
                        response: responseMessage,
                        tool_executed: true,
                        tool_result: toolResult.result,
                        reason_code: REASON_CODES.EXECUTED_SUCCESSFULLY
                    };
                }

                await Message.create(conversationId, 'assistant', visible_response, outputTokens);

                return {
                    response: visible_response,
                    tool_executed: false,
                    reason_code: REASON_CODES.RESPONDED_SUCCESSFULLY
                };
            }

            case 'ASK_USER': {
                const execution = critiqueResult.execution || {};
                console.log('[Critique] Decision: ASK_USER - issues:', execution.issues);

                if (assessment.is_destructive && assessment.tool_call) {
                    await confirmationService.storePendingIntent(
                        conversationId,
                        assessment.tool_call,
                        assessment.tool_params
                    );
                }

                // Re-run main LLM with critique feedback to generate appropriate response
                const userMessage = await this.regenerateResponseWithCritiqueFeedback(
                    critiqueResult,
                    assessment,
                    client,
                    formattedHistory
                );

                await Message.create(conversationId, 'assistant', userMessage.content, userMessage.tokens || 0);

                return {
                    response: userMessage.content,
                    tool_executed: false,
                    reason_code: assessment.is_destructive ? REASON_CODES.AWAITING_CONFIRMATION : REASON_CODES.ASK_USER
                };
            }

            case 'ESCALATE': {
                console.log('[Critique] Decision: ESCALATE - reason:', critiqueResult.reasoning);

                await escalationService.escalate(
                    conversationId,
                    'ai_stuck'
                );

                // Re-run main LLM with critique feedback to generate escalation message
                const escalationMessage = await this.regenerateResponseWithCritiqueFeedback(
                    critiqueResult,
                    assessment,
                    client,
                    formattedHistory
                );

                await Message.create(conversationId, 'assistant', escalationMessage.content, escalationMessage.tokens || 0);

                return {
                    response: escalationMessage.content,
                    tool_executed: false,
                    escalated: true,
                    reason_code: REASON_CODES.ESCALATED_TO_HUMAN
                };
            }

            default:
                return await this.actOnCritiqueDecision(
                    { decision: 'ESCALATE', reasoning: 'Unknown critique decision', ask_reason: 'error', missing_info: [] },
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
     * Generate a friendly error message via LLM
     * Delegates to shared utility in messageHelpers.js
     */
    async generateErrorMessage(errorType, errorDetails, client, formattedHistory = []) {
        return generateErrorMessageViaLLM(errorType, errorDetails, client, formattedHistory);
    }

    /**
     * Re-run the main LLM with critique feedback to generate appropriate response
     * Appends critique context to system prompt, LLM generates natural response
     */
    async regenerateResponseWithCritiqueFeedback(critiqueResult, assessment, client, formattedHistory) {
        // Get the original system prompt (first message if it's a system message)
        const hasSystemPrompt = formattedHistory[0]?.role === 'system';
        const originalSystemPrompt = hasSystemPrompt ? formattedHistory[0].content : '';
        const conversationMessages = hasSystemPrompt ? formattedHistory.slice(1) : formattedHistory;

        // Build context from new critique format
        const execution = critiqueResult.execution || {};
        const issues = execution.issues || [];

        // Append critique context to system prompt
        let critiqueContext;
        if (critiqueResult.decision === 'ASK_USER') {
            critiqueContext = `\n\n---\nBEFORE RESPONDING: Ask user for ${issues.length > 0 ? issues.join(', ') : 'confirmation'}`;
        } else {
            critiqueContext = `\n\n---\nBEFORE RESPONDING: ${critiqueResult.reasoning || 'Unable to proceed with this request'}`;
        }
        critiqueContext += `. Planned action was: ${assessment.tool_call} with ${JSON.stringify(assessment.tool_params)}`;

        const modifiedSystemPrompt = originalSystemPrompt + critiqueContext;

        // Build messages array for chat
        const messages = [
            { role: 'system', content: modifiedSystemPrompt },
            ...conversationMessages
        ];

        const response = await llmService.chat(messages, {
            maxTokens: 200,
            temperature: 0.7,
            provider: client.llm_provider,
            model: client.model_name
        });

        return {
            content: response.content,
            tokens: response.tokens?.output || 0
        };
    }

    /**
     * Retry reasoning with critique feedback
     * Called when critique says RETRY (AI misunderstood or picked wrong tool)
     */
    async retryReasoning(critiqueResult, originalAssessment, client, formattedHistory, tools, conversationId, clientId, conversation, retryCount) {
        console.log('[Retry] Re-running reasoning with critique feedback');

        const understanding = critiqueResult.understanding || {};
        const toolChoice = critiqueResult.tool_choice || {};

        // Build correction context
        let correctionPrompt = '\n\n---\nCORRECTION NEEDED:\n';

        if (understanding.ai_understood_correctly === false) {
            correctionPrompt += `Your understanding was WRONG. ${understanding.misunderstanding}\n`;
            correctionPrompt += `What the user actually wants: ${understanding.what_user_wants}\n`;
        }

        if (toolChoice.correct_tool === false) {
            correctionPrompt += `Wrong tool choice. ${toolChoice.reason}\n`;
            if (toolChoice.suggested_tool && toolChoice.suggested_tool !== 'none') {
                correctionPrompt += `Use this tool instead: ${toolChoice.suggested_tool}\n`;
            } else if (toolChoice.suggested_tool === 'none') {
                correctionPrompt += 'Do NOT use any tool - just respond with text.\n';
            }
        }

        correctionPrompt += '\nPlease re-analyze and provide a corrected response.';

        // Get system prompt and append correction
        const hasSystemPrompt = formattedHistory[0]?.role === 'system';
        const originalSystemPrompt = hasSystemPrompt ? formattedHistory[0].content : '';
        const conversationMessages = hasSystemPrompt ? formattedHistory.slice(1) : formattedHistory;

        const modifiedSystemPrompt = originalSystemPrompt + correctionPrompt;

        // Re-run LLM with correction context
        const messages = [
            { role: 'system', content: modifiedSystemPrompt },
            ...conversationMessages
        ];

        const llmResponse = await llmService.chat(messages, {
            maxTokens: ADAPTIVE_REASONING.DEFAULT_MAX_TOKENS,
            temperature: ADAPTIVE_REASONING.DEFAULT_TEMPERATURE,
            provider: client.llm_provider,
            model: client.model_name
        });

        // Parse new assessment
        const { visible_response, assessment, reasoning } = llmService.parseAssessment(llmResponse.content);

        // Log retry reasoning
        await Message.createDebug(
            conversationId,
            'assistant',
            `RETRY: ${reasoning || 'Re-analyzed request'}`,
            'assessment',
            { metadata: assessment || {}, reasonCode: 'RETRY_REASONING' }
        );

        // If no tool call in new assessment, just respond
        if (!assessment || !assessment.tool_call) {
            await Message.create(conversationId, 'assistant', visible_response, llmResponse.tokens?.output || 0);
            return {
                response: visible_response,
                tool_executed: false,
                reason_code: REASON_CODES.RESPONDED_SUCCESSFULLY,
                retried: true
            };
        }

        // Run critique again on new assessment
        const newCritiqueResult = await this.runCritique(
            conversationMessages[conversationMessages.length - 1]?.content || '',
            assessment,
            tools,
            conversationMessages,
            client
        );

        // Format and log new critique using shared helper
        const critiqueDisplay = formatCritiqueDisplay(assessment, newCritiqueResult);

        await Message.createDebug(
            conversationId,
            'assistant',
            critiqueDisplay,
            'critique',
            { metadata: newCritiqueResult, reasonCode: 'RETRY_CRITIQUE' }
        );

        // Act on new critique decision (with incremented retryCount)
        return await this.actOnCritiqueDecision(
            newCritiqueResult,
            assessment,
            visible_response,
            conversationId,
            clientId,
            client,
            conversation,
            tools,
            llmResponse.tokens?.output || 0,
            formattedHistory,
            retryCount
        );
    }
}

// Export singleton
const adaptiveReasoningService = new AdaptiveReasoningService();
export default adaptiveReasoningService;
