import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { ToolExecution } from '../models/ToolExecution.js';
import { RedisCache } from './redisCache.js';
import { getContextualSystemPrompt } from '../prompts/systemPrompt.js';
import llmService from './llmService.js';
import toolManager from './toolManager.js';
import n8nService from './n8nService.js';
import integrationService from './integrationService.js';
import escalationService from './escalationService.js';
import { safeJsonParse } from '../utils/jsonUtils.js';
import { createLogger } from '../utils/logger.js';
import { LIMITS, CONVERSATION, HTTP_STATUS } from '../config/constants.js';
import {
  STRONG_ENDING_PHRASES,
  WEAK_ENDING_PHRASES,
  ACTION_CLAIM_WORDS,
  TOOL_SIMULATION_PHRASES,
  USER_ACTION_REQUEST_PATTERN,
  THRESHOLDS,
} from '../config/phrases.js';

const log = createLogger('Conversation');

/**
 * Conversation Service
 *
 * Manages conversation state, context windows, and message history
 */

class ConversationService {
  constructor() {
    this.maxContextMessages = 10;
    this.contextTokenLimit = 100000;
  }

  /**
   * Normalize tool arguments (e.g., convert "today" to actual date, coerce types)
   */
  normalizeToolArguments(args, tool) {
    const normalized = { ...args };
    const schema = tool?.parameters_schema;

    if (!schema || !schema.properties) {
      return normalized;
    }

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    for (const [paramName, paramValue] of Object.entries(args)) {
      const paramSchema = schema.properties[paramName];

      if (!paramSchema) continue;

      // Type coercion: LLMs sometimes output numbers as strings
      if (paramSchema.type === 'number' || paramSchema.type === 'integer') {
        if (typeof paramValue === 'string') {
          const num = paramSchema.type === 'integer' ? parseInt(paramValue, 10) : parseFloat(paramValue);
          if (!isNaN(num)) {
            normalized[paramName] = num;
            log.debug(`Coerced ${paramName} from string "${paramValue}" to number ${num}`);
          }
        }
      }

      // Type coercion: boolean strings
      if (paramSchema.type === 'boolean' && typeof paramValue === 'string') {
        const lower = paramValue.toLowerCase();
        if (lower === 'true' || lower === '1' || lower === 'yes') {
          normalized[paramName] = true;
          log.debug(`Coerced ${paramName} from string "${paramValue}" to boolean true`);
        } else if (lower === 'false' || lower === '0' || lower === 'no') {
          normalized[paramName] = false;
          log.debug(`Coerced ${paramName} from string "${paramValue}" to boolean false`);
        }
      }

      if (paramSchema.type === 'string' && typeof paramValue === 'string') {
        const lowerValue = paramValue.toLowerCase().trim();

        if (lowerValue === 'today') {
          normalized[paramName] = todayStr;
        } else if (lowerValue === 'tomorrow') {
          normalized[paramName] = tomorrowStr;
        } else if (lowerValue === 'yesterday') {
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          normalized[paramName] = yesterday.toISOString().split('T')[0];
        } else if (paramName.toLowerCase().includes('date')) {
          if (/^\d{4}-\d{2}-\d{2}$/.test(paramValue)) {
            const parsed = new Date(paramValue + 'T12:00:00');
            const oneYearAgo = new Date(today);
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            if (parsed < oneYearAgo) {
              log.warn(`Date ${paramValue} is too far in the past, correcting to today: ${todayStr}`);
              normalized[paramName] = todayStr;
            }
          } else {
            const parsed = new Date(paramValue);
            if (!isNaN(parsed.getTime())) {
              normalized[paramName] = parsed.toISOString().split('T')[0];
            }
          }
        }
      }
    }

    // Fix phone number/email mix-ups
    if (normalized.customerEmail && /^\d+$/.test(normalized.customerEmail) && !normalized.customerPhone) {
      log.warn('Phone number found in customerEmail field, moving to customerPhone');
      normalized.customerPhone = normalized.customerEmail;
      normalized.customerEmail = '';
    }
    if (normalized.customerPhone && normalized.customerPhone.includes('@') && !normalized.customerEmail) {
      log.warn('Email found in customerPhone field, moving to customerEmail');
      normalized.customerEmail = normalized.customerPhone;
      normalized.customerPhone = '';
    }

    return normalized;
  }

  /**
   * Create a new conversation
   */
  async createConversation(clientId, sessionId, userIdentifier = null, llmProvider = null, modelName = null) {
    return await Conversation.create(clientId, sessionId, userIdentifier, llmProvider, modelName);
  }

  /**
   * Get or create conversation by session ID
   */
  async getOrCreateConversation(
    clientId,
    sessionId,
    userIdentifier = null,
    llmProvider = null,
    modelName = null
  ) {
    let conversation = await Conversation.findBySession(sessionId);

    if (conversation && conversation.ended_at) {
      log.info(`Session ${sessionId} has ended, creating new conversation`);
      conversation = await this.createConversation(clientId, sessionId, userIdentifier, llmProvider, modelName);
    } else if (!conversation) {
      conversation = await this.createConversation(clientId, sessionId, userIdentifier, llmProvider, modelName);
    }

    return conversation;
  }

  /**
   * Add a message to the conversation
   */
  async addMessage(conversationId, role, content, tokensUsed = 0, _metadata = null) {
    const message = await Message.create(conversationId, role, content, tokensUsed);
    await this.updateConversationStats(conversationId);
    return message;
  }

  /**
   * Add a debug/internal message for full conversation tracking
   * @param {number} conversationId - The conversation ID
   * @param {string} role - The role (user, assistant, system, tool)
   * @param {string} content - The message content
   * @param {string} messageType - Type: visible, system, tool_call, tool_result, internal
   * @param {object} options - Additional options (tokensUsed, toolCallId, metadata)
   */
  async addDebugMessage(conversationId, role, content, messageType, options = {}) {
    try {
      return await Message.createDebug(conversationId, role, content, messageType, options);
    } catch (error) {
      log.error('Failed to store debug message', error);
      // Don't fail the conversation if debug storage fails
      return null;
    }
  }

  /**
   * Get conversation history with context window management
   */
  async getConversationHistory(conversationId, limit = null) {
    if (limit) {
      return await Message.getRecent(conversationId, limit);
    }
    return await Message.getAll(conversationId);
  }

  /**
   * Get conversation context from cache or DB
   */
  async getConversationContext(sessionId, client, tools = [], includeSystemPrompt = true) {
    const cached = await RedisCache.getConversationContext(sessionId);
    if (cached) {
      if (!includeSystemPrompt && cached.messages?.[0]?.role === 'system') {
        return cached.messages.slice(1);
      }
      return cached.messages;
    }

    const conversation = await Conversation.findBySession(sessionId);
    if (!conversation) {
      if (!includeSystemPrompt) {
        return [];
      }
      const systemMessage = getContextualSystemPrompt(client, tools);
      return [{ role: 'system', content: systemMessage }];
    }

    const messages = await this.getConversationHistory(conversation.id);

    // Map messages once to avoid duplication
    const mappedMessages = messages.map((msg) => {
      const parsedMeta = msg.metadata ? safeJsonParse(msg.metadata, null) : null;
      return {
        role: msg.role,
        content: msg.content,
        ...(parsedMeta && { metadata: parsedMeta }),
      };
    });

    const systemPrompt = { role: 'system', content: getContextualSystemPrompt(client, tools) };

    // Build formatted messages (may or may not include system prompt)
    const formattedMessages = includeSystemPrompt
      ? [systemPrompt, ...mappedMessages]
      : [...mappedMessages];

    // Cache always includes system prompt for consistency
    await RedisCache.setConversationContext(sessionId, {
      conversationId: conversation.id,
      messages: [systemPrompt, ...mappedMessages],
    });

    return formattedMessages;
  }

  /**
   * Update conversation context in cache
   */
  async updateConversationContext(sessionId, conversationId, messages) {
    await RedisCache.updateConversationContext(sessionId, {
      conversationId,
      messages,
      last_activity: new Date().toISOString(),
    });
  }

  /**
   * Manage context window - truncate old messages if needed
   */
  manageContextWindow(messages) {
    if (messages.length <= this.maxContextMessages) {
      return messages;
    }

    const systemMessage = messages[0];
    const recentMessages = messages.slice(-(this.maxContextMessages - 1));

    return [systemMessage, ...recentMessages];
  }

  /**
   * Summarize old conversation context (placeholder for future implementation)
   */
  async summarizeContext(_messages) {
    return null;
  }

  /**
   * Update conversation statistics
   */
  async updateConversationStats(conversationId) {
    const messageCount = await Message.count(conversationId);
    const tokensTotal = await Message.getTotalTokens(conversationId);
    await Conversation.updateStats(conversationId, messageCount, tokensTotal);
  }

  /**
   * End a conversation
   */
  async endConversation(sessionId) {
    const conversation = await Conversation.findBySession(sessionId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    const updated = await Conversation.end(conversation.id);
    await RedisCache.deleteConversationContext(sessionId);
    return updated;
  }

  /**
   * Auto-end inactive conversations
   */
  async autoEndInactiveConversations(inactivityMinutes = 15) {
    try {
      const inactiveConversations = await Conversation.findInactive(inactivityMinutes);

      if (inactiveConversations.length === 0) {
        return { ended: 0, conversations: [] };
      }

      const endedConversations = [];

      for (const conv of inactiveConversations) {
        try {
          await Conversation.end(conv.id);
          if (conv.session_id) {
            await RedisCache.deleteConversationContext(conv.session_id);
          }
          endedConversations.push({
            id: conv.id,
            session_id: conv.session_id,
            client_id: conv.client_id,
            last_activity: conv.last_activity,
          });
        } catch (error) {
          log.error(`Failed to auto-end conversation ${conv.id}`, error);
        }
      }

      log.info(`Auto-ended ${endedConversations.length} inactive conversation(s)`);
      return { ended: endedConversations.length, conversations: endedConversations };
    } catch (error) {
      log.error('Error auto-ending inactive conversations', error);
      throw error;
    }
  }

  /**
   * Get conversation by ID
   */
  async getConversationById(conversationId) {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    const messages = await Message.findByConversationId(conversationId);
    return { ...conversation, messages };
  }

  /**
   * Get all conversations for a client
   */
  async getClientConversations(clientId, limit = 50, offset = 0) {
    return await Conversation.findByClientId(clientId, limit, offset);
  }

  /**
   * Search conversations by user identifier
   */
  async searchConversationsByUser(clientId, userIdentifier) {
    return await Conversation.findByUserIdentifier(clientId, userIdentifier);
  }

  /**
   * Detect if user message indicates conversation should end
   */
  detectConversationEnd(message) {
    if (!message || typeof message !== 'string') {
      return false;
    }

    const normalizedMessage = message.toLowerCase().trim();

    // STRONG endings: Match if at end of message or standalone
    for (const phrase of STRONG_ENDING_PHRASES) {
      // Exact match
      if (normalizedMessage === phrase) {
        return true;
      }
      // Phrase at end of short message (e.g., "ok bye", "alright goodbye")
      const endsWithPhrase = new RegExp(`${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[.!?,;]*$`, 'i');
      if (endsWithPhrase.test(normalizedMessage) && normalizedMessage.length < THRESHOLDS.MAX_MESSAGE_LENGTH_FOR_ENDING) {
        return true;
      }
    }

    // WEAK endings (like "thanks"): Only match on EXACT match
    // Users often say "thanks" but want to continue, so be conservative
    for (const phrase of WEAK_ENDING_PHRASES) {
      // Only exact match for weak phrases - no partial matching
      if (normalizedMessage === phrase || normalizedMessage === phrase + '!' || normalizedMessage === phrase + '.') {
        return true;
      }
    }

    return false;
  }

  // ============================================================
  // PRIVATE HELPER METHODS FOR processMessage
  // ============================================================

  /**
   * Handle conversation end gracefully
   * @private
   */
  async _handleConversationEnd(conversation, sessionId, userMessage) {
    log.info(`Detected conversation end signal: "${userMessage}"`);

    await this.addMessage(conversation.id, 'user', userMessage);
    await Conversation.end(conversation.id);
    await RedisCache.deleteConversationContext(sessionId);

    const goodbyeMessages = [
      'Thank you for chatting with us! Have a great day!',
      "Thanks for reaching out! We're here if you need anything else.",
      'Thank you! Feel free to come back anytime if you have more questions.',
      'Thanks for the conversation! Have a wonderful day!',
      'Thank you! We appreciate your time. Take care!',
    ];
    const goodbyeResponse = goodbyeMessages[Math.floor(Math.random() * goodbyeMessages.length)];

    await this.addMessage(conversation.id, 'assistant', goodbyeResponse, 0);

    return {
      response: goodbyeResponse,
      toolsUsed: [],
      tokensUsed: 0,
      conversationId: conversation.id,
      iterations: 0,
      conversationEnded: true,
    };
  }

  /**
   * Prepare messages array for LLM call
   * @private
   */
  async _prepareMessagesForLLM(sessionId, client, clientTools, conversation, userMessage, options) {
    const isFirstMessage = !conversation || conversation.message_count === 0;
    const messages = await this.getConversationContext(sessionId, client, clientTools, isFirstMessage);

    let userMessageContent = userMessage;

    // Include email subject for context if applicable
    if (options.channel === 'email' && options.channelMetadata?.subject) {
      const subject = options.channelMetadata.subject;
      if (!subject.toLowerCase().startsWith('re:')) {
        userMessageContent = `Subject: ${subject}\n\n${userMessage}`;
      } else {
        const subjectWithoutRe = subject.replace(/^Re:\s*/i, '').trim();
        if (subjectWithoutRe && subjectWithoutRe.length > 0) {
          userMessageContent = `Subject: ${subjectWithoutRe}\n\n${userMessage}`;
        }
      }
    }

    messages.push({ role: 'user', content: userMessageContent });
    return messages;
  }

  /**
   * Execute a single tool call
   * @private
   */
  async _executeSingleTool(toolCall, client, conversation, messages) {
    const { id, name, arguments: toolArgs } = toolCall;

    log.info(`Executing tool: ${name}`);

    // Store tool call as debug message
    await this.addDebugMessage(
      conversation.id,
      'assistant',
      `Tool Call: ${name}\nArguments: ${JSON.stringify(toolArgs, null, 2)}`,
      'tool_call',
      { toolCallId: id, metadata: { tool_name: name, arguments: toolArgs } }
    );

    const tool = await toolManager.getToolByName(client.id, name);

    if (!tool) {
      log.error(`Tool not found: ${name}`);
      const errorMessage = `Error: Tool "${name}" is not available`;

      messages.push({ role: 'tool', content: errorMessage, tool_call_id: id });

      await ToolExecution.create(conversation.id, name, toolArgs, { error: 'Tool not found' }, false, 0);

      return { success: false, error: errorMessage };
    }

    // Validate tool arguments
    const validation = toolManager.validateToolArguments(tool, toolArgs);
    if (!validation.valid) {
      log.error(`Invalid arguments for ${name}`, validation.errors);
      const errorDetails = validation.errors.join('; ');
      const errorMessage = `TOOL CALL REJECTED: ${errorDetails}. You MUST ask the user for the missing or invalid information before calling this tool again. Do not use placeholder values.`;

      messages.push({ role: 'tool', content: errorMessage, tool_call_id: id });

      // Log as blocked execution for visibility in admin dashboard
      await ToolExecution.create(
        conversation.id,
        name,
        toolArgs,
        { error: validation.errors },
        false,
        0,
        'blocked',
        errorDetails
      );

      // Store blocked tool result as debug message
      await this.addDebugMessage(
        conversation.id,
        'assistant',
        errorMessage,
        'tool_result',
        {
          toolCallId: id,
          metadata: {
            tool_name: name,
            success: false,
            status: 'blocked',
            error_reason: errorDetails,
            invalid_args: toolArgs,
          }
        }
      );

      return { success: false, error: errorMessage, blocked: true };
    }

    // Normalize and prepare arguments
    const normalizedArgs = this.normalizeToolArguments(toolArgs, tool);
    const finalArgs = normalizedArgs || toolArgs;

    // Create a unique lock key for this specific tool execution
    // Using conversation ID + tool name + stringified args ensures uniqueness
    const lockKey = `tool:${conversation.id}:${name}:${JSON.stringify(finalArgs)}`;

    // Acquire Redis lock to prevent race conditions in duplicate detection
    // This prevents TOCTOU (Time-Of-Check-Time-Of-Use) bugs where two concurrent
    // requests could both pass the duplicate check before either writes to DB
    const lockAcquired = await RedisCache.acquireLock(lockKey, 60); // 60 second TTL for tool execution

    if (!lockAcquired) {
      log.warn(`Tool execution already in progress: ${name}`);
      messages.push({
        role: 'tool',
        content: 'This action is already being processed. Please wait for the current execution to complete.',
        tool_call_id: id,
      });
      return { success: false, error: 'Execution already in progress', locked: true };
    }

    let result;
    try {
      // Check for duplicate tool calls by querying the persisted tool_executions table
      // This works across conversation turns since the data is stored in the database
      const isDuplicate = await ToolExecution.isDuplicateExecution(conversation.id, name, finalArgs);

      if (isDuplicate) {
        log.warn(`DUPLICATE tool call blocked: ${name} (already executed successfully with same parameters)`);
        const duplicateMessage = 'This action was already completed earlier in this conversation. No need to repeat it.';

        // Log duplicate attempt to database for visibility
        await ToolExecution.logDuplicate(conversation.id, name, finalArgs);

        messages.push({
          role: 'tool',
          content: duplicateMessage,
          tool_call_id: id,
        });
        return { success: true, name, duplicate: true };
      }

      // Fetch integration credentials
      let integrations = {};
      const requiredIntegrations = tool.required_integrations || [];
      const integrationMapping = tool.integration_mapping || {};

      log.debug(`Processing tool: ${name}`, { requiredIntegrations, integrationMapping });

      if (requiredIntegrations.length > 0) {
        try {
          log.debug(`Fetching ${requiredIntegrations.length} integrations for tool`);
          integrations = await integrationService.getIntegrationsForTool(
            client.id,
            integrationMapping,
            requiredIntegrations
          );

          const integrationCount = Object.keys(integrations).length;
          log.info(`Loaded ${integrationCount} integrations: ${Object.keys(integrations).join(', ')}`);
        } catch (error) {
          log.error('Failed to load integrations', error.message);
          messages.push({
            role: 'tool',
            content: `Error: ${error.message}. Please configure the required integrations in the admin panel.`,
            tool_call_id: id,
          });
          return { success: false, error: error.message };
        }
      } else {
        log.debug(`Tool ${name} has no required integrations`);
      }

      // Execute via n8n
      log.debug(`Calling n8n with ${Object.keys(integrations).length} integrations`);

      result = await n8nService.executeTool(tool.n8n_webhook_url, finalArgs, { integrations });

      // Handle blocked tools (placeholder values detected)
      if (result.blocked) {
        log.warn(`Tool ${name} BLOCKED - placeholder values detected`);

        // Log blocked attempt to database for visibility
        await ToolExecution.logBlocked(conversation.id, name, finalArgs, result.error);

        messages.push({
          role: 'tool',
          content: `TOOL BLOCKED: ${result.error} Do not use placeholder values - ask the user for the actual information they want to use.`,
          tool_call_id: id,
        });
        return {
          success: false,
          name,
          executionTime: result.executionTimeMs,
          blocked: true,
        };
      }

      // Log execution
      await ToolExecution.create(
        conversation.id,
        name,
        finalArgs,
        result.data,
        result.success,
        result.executionTimeMs
      );
    } finally {
      // Always release the lock, even if execution fails
      await RedisCache.releaseLock(lockKey);
    }

    // Format result for LLM
    const formattedResult = n8nService.formatResponseForLLM(result.data);

    messages.push({
      role: 'tool',
      content: result.success ? formattedResult : result.error,
      tool_call_id: id,
    });

    // Store tool result as debug message (limit raw_result size to prevent DB issues)
    const rawResultStr = JSON.stringify(result.data);
    let truncatedResult = result.data;
    if (rawResultStr.length > LIMITS.TOOL_RESULT_MAX) {
      try {
        truncatedResult = { _truncated: true, preview: rawResultStr.substring(0, LIMITS.TOOL_RESULT_PREVIEW) + '...' };
      } catch {
        truncatedResult = { _truncated: true, error: 'Could not serialize result' };
      }
    }

    await this.addDebugMessage(
      conversation.id,
      'assistant',  // Use 'assistant' role (constraint only allows user/assistant/system)
      result.success ? formattedResult : `Error: ${result.error}`,
      'tool_result',
      {
        toolCallId: id,
        metadata: {
          tool_name: name,
          success: result.success,
          execution_time_ms: result.executionTimeMs,
          raw_result: truncatedResult,
        }
      }
    );

    log.info(`Tool ${name} ${result.success ? 'succeeded' : 'failed'} (${result.executionTimeMs}ms)`);

    return {
      success: result.success,
      name,
      executionTime: result.executionTimeMs,
    };
  }

  /**
   * Check if LLM is hallucinating tool usage
   * @private
   */
  _isHallucinatingToolUsage(responseContent, userMessage) {
    const responseLower = responseContent.toLowerCase();
    const hasActionClaim = ACTION_CLAIM_WORDS.some((word) => responseLower.includes(word));
    const hasToolSimulation = TOOL_SIMULATION_PHRASES.some((phrase) => responseLower.includes(phrase));
    const userRequestedAction = userMessage.toLowerCase().match(USER_ACTION_REQUEST_PATTERN);

    return (hasActionClaim || hasToolSimulation) && userRequestedAction;
  }

  /**
   * Extract fallback response from tool results when LLM fails
   * @private
   */
  _extractFallbackResponse(messages) {
    const lastToolMessage = messages.filter((m) => m.role === 'tool').pop();

    if (!lastToolMessage || !lastToolMessage.content) {
      return 'I apologize, but I encountered an issue processing your request. Please try again or rephrase your question.';
    }

    try {
      const toolContent = lastToolMessage.content;

      if (toolContent.includes('message') || toolContent.includes('Message')) {
        const jsonMatch = toolContent.match(/"message"\s*:\s*"([^"]+)"/);
        if (jsonMatch) {
          return jsonMatch[1];
        }
        return toolContent.length < LIMITS.MAX_LOG_LENGTH ? toolContent : toolContent.substring(0, LIMITS.MAX_LOG_EXCERPT) + '...';
      }

      return toolContent.length < LIMITS.MAX_LOG_LENGTH ? toolContent : `Based on the results: ${toolContent.substring(0, LIMITS.MAX_LOG_EXCERPT)}...`;
    } catch {
      return 'I apologize, but I encountered an issue processing your request. Please try again or rephrase your question.';
    }
  }

  /**
   * Record usage and finalize the conversation response
   * @private
   */
  async _recordUsageAndFinalize(client, conversation, sessionId, messages, finalResponse, stats) {
    const { totalTokens, totalTokensInput, totalTokensOutput, toolsUsed, iterationCount, isNewConversation } = stats;

    // Restore base system prompt before caching
    if (stats.baseSystemPrompt && messages?.[0]?.role === 'system') {
      messages[0].content = stats.baseSystemPrompt;
    }

    // Save assistant response
    await this.addMessage(conversation.id, 'assistant', finalResponse, totalTokens);

    // Update context in cache
    messages.push({ role: 'assistant', content: finalResponse });
    await this.updateConversationContext(sessionId, conversation.id, messages);

    // Record usage for billing/analytics
    try {
      const { ApiUsage } = await import('../models/ApiUsage.js');
      const tokensInput = totalTokensInput || Math.floor(totalTokens * 0.7);
      const tokensOutput = totalTokensOutput || Math.floor(totalTokens * 0.3);
      const toolCallsCount = toolsUsed.length;

      log.debug(`Recording usage: client=${client.id}, tokens=${tokensInput + tokensOutput}, tools=${toolCallsCount}, newConversation=${isNewConversation}`);
      await ApiUsage.recordUsage(client.id, tokensInput, tokensOutput, toolCallsCount, isNewConversation);
      log.debug('Usage recorded successfully');
    } catch (usageError) {
      log.error('Failed to record usage', usageError);
    }

    // Auto-detect escalation needs
    try {
      const language = client.language || 'en';
      await escalationService.autoDetect(conversation.id, stats.userMessage, language);
    } catch (escalationError) {
      log.error('Failed to auto-detect escalation', escalationError);
    }

    return {
      response: finalResponse,
      toolsUsed,
      tokensUsed: totalTokens,
      conversationId: conversation.id,
      iterations: iterationCount,
      conversationEnded: false,
    };
  }

  /**
   * Process a user message with full tool execution flow
   */
  async processMessage(client, sessionId, userMessage, options = {}) {
    const { userIdentifier = null, maxToolIterations = 3 } = options;

    try {
      // Get or create conversation
      let conversation = await Conversation.findBySession(sessionId);
      const isNewConversation = !conversation;

      const effectiveProvider = client.llm_provider || 'ollama';
      const effectiveModel = client.model_name || null;

      if (!conversation) {
        conversation = await this.createConversation(
          client.id,
          sessionId,
          userIdentifier,
          effectiveProvider,
          effectiveModel
        );
      }

      // Check if user wants to end the conversation
      if (this.detectConversationEnd(userMessage)) {
        return await this._handleConversationEnd(conversation, sessionId, userMessage);
      }

      // Save user message
      if (!options.skipUserMessageSave) {
        await this.addMessage(conversation.id, 'user', userMessage);
      }

      // Get enabled tools and prepare context
      const clientTools = await toolManager.getClientTools(client.id);
      const messages = await this._prepareMessagesForLLM(
        sessionId,
        client,
        clientTools,
        conversation,
        userMessage,
        options
      );

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

      // Store system prompt as debug message (only for new conversations or first message)
      if (isNewConversation && messages[0]?.role === 'system') {
        await this.addDebugMessage(
          conversation.id,
          'system',
          messages[0].content,
          'system',
          { metadata: { provider: effectiveProvider, model: effectiveModel } }
        );
      }

      // Tool execution loop
      while (iterationCount < maxToolIterations) {
        iterationCount++;

        // Call LLM
        let llmResponse;
        try {
          llmResponse = await llmService.chat(messages, {
            tools: llmService.supportsNativeFunctionCalling(effectiveProvider) ? formattedTools : null,
            maxTokens: 2048,
            temperature: 0.3,
            model: effectiveModel,
            provider: effectiveProvider,
          });
        } catch (llmError) {
          log.error(`LLM call failed on iteration ${iterationCount}`, llmError);
          if (lastExecutedToolKeys && lastLLMResponse && lastLLMResponse.content) {
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
        if (toolCalls && toolCalls.length > 0 && lastExecutedToolKeys) {
          const currentToolKeys = toolCalls.map((tc) => `${tc.name}:${JSON.stringify(tc.arguments)}`);
          const isSameAsLastExecution =
            currentToolKeys.every((key) => lastExecutedToolKeys.includes(key)) &&
            currentToolKeys.length === lastExecutedToolKeys.length;

          if (isSameAsLastExecution) {
            log.warn('LLM tried to call same tools again. Breaking loop.');
            finalResponse =
              llmResponse.content?.trim()?.length > 0
                ? llmResponse.content
                : 'I apologize, but I encountered an issue processing your request. Please try again.';
            break;
          }
        }

        // Handle finish_reason='stop' with content
        if (llmResponse.stopReason === 'stop' && llmResponse.content?.trim()?.length > 0) {
          if (effectiveProvider === 'ollama') {
            const parsedToolCalls = toolManager.parseToolCallsFromContent(llmResponse.content);
            if (parsedToolCalls && parsedToolCalls.length > 0) {
              toolCalls = parsedToolCalls;
              log.debug(`Ollama returned stopReason='stop' but found ${toolCalls.length} tool call(s) in content`);
            }
          } else if (toolCalls && toolCalls.length > 0) {
            log.debug("LLM returned both content and tool_calls with finish_reason='stop'. Using content.");
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
            finalResponse = this._extractFallbackResponse(messages);
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
              arguments: typeof tc.arguments === 'string' ? tc.arguments : JSON.stringify(tc.arguments),
            },
          }));
        }

        messages.push(assistantMessage);

        // Execute each tool
        for (const toolCall of toolCalls) {
          const result = await this._executeSingleTool(toolCall, client, conversation, messages);
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
        finalResponse = this._extractFallbackResponse(messages);
      }

      // Record usage and finalize
      return await this._recordUsageAndFinalize(client, conversation, sessionId, messages, finalResponse, {
        totalTokens,
        totalTokensInput,
        totalTokensOutput,
        toolsUsed,
        iterationCount,
        isNewConversation,
        baseSystemPrompt,
        userMessage,
      });
    } catch (error) {
      log.error('Error processing message', error);
      throw error;
    }
  }
}

// Export singleton instance
const conversationService = new ConversationService();
export default conversationService;
