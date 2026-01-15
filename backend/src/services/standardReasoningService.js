/**
 * Standard Reasoning Service
 *
 * Handles standard mode conversation processing with tool execution.
 * Extracted from conversationService for modularity.
 */

import llmService from './llmService.js';
import toolManager from './toolManager.js';
import toolExecutionService from './toolExecutionService.js';
import escalationService from './escalationService.js';
import { Message } from '../models/Message.js';
import { ApiUsage } from '../models/ApiUsage.js';
import { getContextualSystemPrompt } from '../prompts/systemPrompt.js';
import { createLogger } from '../utils/logger.js';
import { LIMITS } from '../config/constants.js';
import {
  ACTION_CLAIM_WORDS,
  TOOL_SIMULATION_PHRASES,
  USER_ACTION_REQUEST_PATTERN,
} from '../config/phrases.js';

const log = createLogger('StandardReasoning');

class StandardReasoningService {
  /**
   * Process a message using standard reasoning mode
   * @param {Object} conversation - Conversation object
   * @param {Object} client - Client object
   * @param {string} userMessage - User's message
   * @param {Array} messages - Prepared messages array with context
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Processing result
   */
  async processStandardMessage(conversation, client, userMessage, messages, options = {}) {
    const { maxToolIterations = 3, isNewConversation = false } = options;
    const effectiveProvider = client.llm_provider || 'ollama';
    const effectiveModel = client.model_name || null;

    // Get enabled tools
    const clientTools = await toolManager.getClientTools(client.id);

    // Track tool usage and tokens
    const toolsUsed = [];
    let totalTokens = 0;
    let totalTokensInput = 0;
    let totalTokensOutput = 0;
    let iterationCount = 0;
    let finalResponse = null;
    let lastLLMResponse = null;
    let lastExecutedToolKeys = null;

    // Format tools for LLM
    const formattedTools = toolManager.formatToolsForLLM(clientTools, effectiveProvider);

    // Handle Ollama's prompt-engineering approach for tools
    let baseSystemPrompt = messages?.[0]?.role === 'system' ? messages[0].content : null;

    if (effectiveProvider === 'ollama') {
      if (!baseSystemPrompt) {
        baseSystemPrompt = getContextualSystemPrompt(client, clientTools);
        messages.unshift({ role: 'system', content: baseSystemPrompt });
      }
      if (formattedTools && baseSystemPrompt) {
        messages[0].content = `${baseSystemPrompt}${formattedTools}`;
      }
    }

    // Store system prompt as debug message (only for new conversations)
    if (isNewConversation && messages[0]?.role === 'system') {
      await Message.createDebug(conversation.id, 'system', messages[0].content, 'system', {
        metadata: { provider: effectiveProvider, model: effectiveModel },
      });
    }

    // Tool execution loop
    while (iterationCount < maxToolIterations) {
      iterationCount++;

      // Call LLM
      let llmResponse;
      try {
        llmResponse = await llmService.chat(messages, {
          tools: llmService.supportsNativeFunctionCalling(effectiveProvider)
            ? formattedTools
            : null,
          maxTokens: 2048,
          temperature: 0.3,
          model: effectiveModel,
          provider: effectiveProvider,
        });
      } catch (llmError) {
        log.error(`LLM call failed on iteration ${iterationCount}`, llmError);
        if (lastExecutedToolKeys && lastLLMResponse?.content) {
          log.info('Using previous LLM response as fallback after error');
          finalResponse = lastLLMResponse.content;
          break;
        }
        throw llmError;
      }

      lastLLMResponse = llmResponse;
      totalTokens += llmResponse.tokens.total;

      if (llmResponse.tokens.input !== undefined && llmResponse.tokens.output !== undefined) {
        totalTokensInput += llmResponse.tokens.input;
        totalTokensOutput += llmResponse.tokens.output;
      } else {
        totalTokensInput += Math.floor(llmResponse.tokens.total * 0.7);
        totalTokensOutput += Math.floor(llmResponse.tokens.total * 0.3);
      }

      // Check for tool calls
      let toolCalls = llmResponse.toolCalls;

      if (!toolCalls && effectiveProvider === 'ollama') {
        toolCalls = toolManager.parseToolCallsFromContent(llmResponse.content);
      }

      // Prevent infinite loop if LLM tries to call same tools again
      if (toolCalls?.length > 0 && lastExecutedToolKeys) {
        const currentToolKeys = toolCalls.map((tc) => `${tc.name}:${JSON.stringify(tc.arguments)}`);
        const isSameAsLastExecution =
          currentToolKeys.every((key) => lastExecutedToolKeys.includes(key)) &&
          currentToolKeys.length === lastExecutedToolKeys.length;

        if (isSameAsLastExecution) {
          log.warn('LLM tried to call same tools again. Breaking loop.');
          finalResponse =
            llmResponse.content?.trim()?.length > 0
              ? llmResponse.content
              : await this._extractFallbackResponse(messages, client);
          break;
        }
      }

      // Handle finish_reason='stop' with content
      if (llmResponse.stopReason === 'stop' && llmResponse.content?.trim()?.length > 0) {
        if (effectiveProvider === 'ollama') {
          const parsedToolCalls = toolManager.parseToolCallsFromContent(llmResponse.content);
          if (parsedToolCalls?.length > 0) {
            toolCalls = parsedToolCalls;
            log.debug(
              `Ollama returned stopReason='stop' but found ${toolCalls.length} tool call(s) in content`
            );
          }
        } else if (toolCalls?.length > 0) {
          log.debug(
            "LLM returned both content and tool_calls with finish_reason='stop'. Using content."
          );
          toolCalls = null;
        }
      }

      // No tool calls - we have the final response
      if (!toolCalls || toolCalls.length === 0) {
        if (llmResponse.content?.trim()?.length > 0) {
          // Check for hallucination
          if (this._isHallucinatingToolUsage(llmResponse.content, userMessage)) {
            log.warn('AI is simulating tool usage without actually calling tools');

            if (iterationCount < maxToolIterations) {
              log.debug(`Retrying (iteration ${iterationCount + 1}/${maxToolIterations})`);
              messages.push({
                role: 'system',
                content:
                  'You described checking the order but did not use the USE_TOOL format. Please call the tool using: USE_TOOL: get_order_status PARAMETERS: {"orderNumber": "12345"}',
              });
              continue;
            }
            log.warn('Max iterations reached. Using AI response despite tool simulation.');
          }
          finalResponse = llmResponse.content;
          break;
        } else if (lastExecutedToolKeys) {
          log.warn(`LLM returned empty content after tool execution (iteration ${iterationCount})`);
          finalResponse = await this._extractFallbackResponse(messages, client);
          if (finalResponse) break;
        }
        continue;
      }

      // Execute tool calls
      log.info(`Executing ${toolCalls.length} tool(s)`);

      // Add assistant message with tool calls to context
      const assistantMessage = {
        role: 'assistant',
        content: llmResponse.content || '',
      };

      if (llmService.supportsNativeFunctionCalling(effectiveProvider) && toolCalls.length > 0) {
        assistantMessage.tool_calls = toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.name,
            arguments:
              typeof tc.arguments === 'string' ? tc.arguments : JSON.stringify(tc.arguments),
          },
        }));
      }

      messages.push(assistantMessage);

      // Execute each tool using the unified toolExecutionService
      for (const toolCall of toolCalls) {
        const result = await toolExecutionService.executeStandardToolCall(
          toolCall,
          client,
          conversation,
          messages
        );
        if (result.success !== false) {
          toolsUsed.push({
            name: result.name,
            success: result.success,
            executionTime: result.executionTime,
          });
        }
      }

      // Track what we just executed
      lastExecutedToolKeys = toolCalls.map((tc) => `${tc.name}:${JSON.stringify(tc.arguments)}`);
    }

    // If we hit max iterations without a final response
    if (!finalResponse) {
      finalResponse = await this._extractFallbackResponse(messages, client);
    }

    // Restore base system prompt before returning
    if (baseSystemPrompt && messages?.[0]?.role === 'system') {
      messages[0].content = baseSystemPrompt;
    }

    return {
      response: finalResponse,
      toolsUsed,
      totalTokens,
      totalTokensInput,
      totalTokensOutput,
      iterationCount,
      messages,
      baseSystemPrompt,
    };
  }

  /**
   * Record usage and finalize the conversation response
   * @param {Object} client - Client object
   * @param {Object} conversation - Conversation object
   * @param {string} sessionId - Session ID
   * @param {Object} result - Processing result from processStandardMessage
   * @param {string} userMessage - Original user message
   * @param {boolean} isNewConversation - Whether this is a new conversation
   * @param {Function} addMessage - Function to add message to conversation
   * @param {Function} updateContext - Function to update context in cache
   * @returns {Promise<Object>} Final result
   */
  async recordUsageAndFinalize(
    client,
    conversation,
    sessionId,
    result,
    userMessage,
    isNewConversation,
    addMessage,
    updateContext
  ) {
    const {
      response,
      toolsUsed,
      totalTokens,
      totalTokensInput,
      totalTokensOutput,
      iterationCount,
      messages,
      baseSystemPrompt,
    } = result;

    // Restore base system prompt before caching
    if (baseSystemPrompt && messages?.[0]?.role === 'system') {
      messages[0].content = baseSystemPrompt;
    }

    // Save assistant response
    await addMessage(conversation.id, 'assistant', response, totalTokens);

    // Update context in cache
    messages.push({ role: 'assistant', content: response });
    await updateContext(sessionId, conversation.id, messages);

    // Record usage for billing/analytics
    try {
      const tokensInput = totalTokensInput || Math.floor(totalTokens * 0.7);
      const tokensOutput = totalTokensOutput || Math.floor(totalTokens * 0.3);
      const toolCallsCount = toolsUsed.length;

      log.debug(
        `Recording usage: client=${client.id}, tokens=${tokensInput + tokensOutput}, tools=${toolCallsCount}`
      );
      await ApiUsage.recordUsage(
        client.id,
        tokensInput,
        tokensOutput,
        toolCallsCount,
        isNewConversation,
        { isAdaptive: false, critiqueTriggered: false, contextFetchCount: 0 }
      );
    } catch (usageError) {
      log.error('Failed to record usage', usageError);
    }

    // Auto-detect escalation needs
    try {
      const language = client.language || 'en';
      await escalationService.autoDetect(conversation.id, userMessage, language);
    } catch (escalationError) {
      log.error('Failed to auto-detect escalation', escalationError);
    }

    return {
      response,
      toolsUsed,
      tokensUsed: totalTokens,
      conversationId: conversation.id,
      iterations: iterationCount,
      conversationEnded: false,
    };
  }

  /**
   * Check if LLM is hallucinating tool usage
   * @private
   */
  _isHallucinatingToolUsage(responseContent, userMessage) {
    const responseLower = responseContent.toLowerCase();
    const hasActionClaim = ACTION_CLAIM_WORDS.some((word) => responseLower.includes(word));
    const hasToolSimulation = TOOL_SIMULATION_PHRASES.some((phrase) =>
      responseLower.includes(phrase)
    );
    const userRequestedAction = userMessage.toLowerCase().match(USER_ACTION_REQUEST_PATTERN);

    return (hasActionClaim || hasToolSimulation) && userRequestedAction;
  }

  /**
   * Extract fallback response from tool results when LLM fails
   * @private
   */
  async _extractFallbackResponse(messages, client = null) {
    const lastToolMessage = messages.filter((m) => m.role === 'tool').pop();

    const generateErrorFallback = async () => {
      if (!client) return null;
      try {
        const response = await llmService.generateResponse(
          'Generate a brief, friendly error message. The system encountered an issue. One sentence, apologetic but helpful.',
          [],
          {
            maxTokens: 50,
            temperature: 0.7,
            provider: client.llm_provider,
            model: client.model_name,
          }
        );
        return response.content;
      } catch {
        return null;
      }
    };

    if (!lastToolMessage?.content) {
      return (await generateErrorFallback()) || 'Something went wrong. Please try again.';
    }

    try {
      const toolContent = lastToolMessage.content;

      if (toolContent.includes('message') || toolContent.includes('Message')) {
        const jsonMatch = toolContent.match(/"message"\s*:\s*"([^"]+)"/);
        if (jsonMatch) {
          return jsonMatch[1];
        }
        return toolContent.length < LIMITS.MAX_LOG_LENGTH
          ? toolContent
          : toolContent.substring(0, LIMITS.MAX_LOG_EXCERPT) + '...';
      }

      return toolContent.length < LIMITS.MAX_LOG_LENGTH
        ? toolContent
        : `Based on the results: ${toolContent.substring(0, LIMITS.MAX_LOG_EXCERPT)}...`;
    } catch {
      return (await generateErrorFallback()) || 'Something went wrong. Please try again.';
    }
  }
}

// Export singleton
const standardReasoningService = new StandardReasoningService();
export default standardReasoningService;
