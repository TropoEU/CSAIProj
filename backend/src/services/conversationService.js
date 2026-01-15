/**
 * Conversation Service
 *
 * Manages conversation state, context windows, and message history.
 * Delegates message processing to appropriate reasoning services.
 */

import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { Plan } from '../models/Plan.js';
import { RedisCache } from './redisCache.js';
import { getContextualSystemPrompt } from '../prompts/systemPrompt.js';
import toolManager from './toolManager.js';
import adaptiveReasoningService from './adaptiveReasoningService.js';
import standardReasoningService from './standardReasoningService.js';
import { safeJsonParse } from '../utils/jsonUtils.js';
import { createLogger } from '../utils/logger.js';
import { ApiUsage } from '../models/ApiUsage.js';
import { STRONG_ENDING_PHRASES, WEAK_ENDING_PHRASES, THRESHOLDS } from '../config/phrases.js';

const log = createLogger('Conversation');

class ConversationService {
  constructor() {
    this.maxContextMessages = 10;
    this.contextTokenLimit = 100000;
  }

  // ============================================================
  // CONVERSATION CRUD OPERATIONS
  // ============================================================

  /**
   * Create a new conversation
   */
  async createConversation(
    clientId,
    sessionId,
    userIdentifier = null,
    llmProvider = null,
    modelName = null
  ) {
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

    if (conversation?.ended_at) {
      log.info(`Session ${sessionId} has ended, creating new conversation`);
      conversation = await this.createConversation(
        clientId,
        sessionId,
        userIdentifier,
        llmProvider,
        modelName
      );
    } else if (!conversation) {
      conversation = await this.createConversation(
        clientId,
        sessionId,
        userIdentifier,
        llmProvider,
        modelName
      );
    }

    return conversation;
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

  // ============================================================
  // MESSAGE OPERATIONS
  // ============================================================

  /**
   * Add a message to the conversation
   */
  async addMessage(conversationId, role, content, tokensUsed = 0, _metadata = null) {
    const message = await Message.create(conversationId, role, content, tokensUsed);
    await this.updateConversationStats(conversationId);
    return message;
  }

  /**
   * Add a debug/internal message
   */
  async addDebugMessage(conversationId, role, content, messageType, options = {}) {
    try {
      return await Message.createDebug(conversationId, role, content, messageType, options);
    } catch (error) {
      log.error('Failed to store debug message', error);
      return null;
    }
  }

  /**
   * Get conversation history
   */
  async getConversationHistory(conversationId, limit = null) {
    if (limit) {
      return await Message.getRecent(conversationId, limit);
    }
    return await Message.getAll(conversationId);
  }

  /**
   * Update conversation statistics
   */
  async updateConversationStats(conversationId) {
    const messageCount = await Message.count(conversationId);
    const tokensTotal = await Message.getTotalTokens(conversationId);
    await Conversation.updateStats(conversationId, messageCount, tokensTotal);
  }

  // ============================================================
  // CONTEXT MANAGEMENT
  // ============================================================

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

    const mappedMessages = messages.map((msg) => {
      const parsedMeta = msg.metadata ? safeJsonParse(msg.metadata, null) : null;
      return {
        role: msg.role,
        content: msg.content,
        ...(parsedMeta && { metadata: parsedMeta }),
      };
    });

    const systemPrompt = { role: 'system', content: getContextualSystemPrompt(client, tools) };
    const formattedMessages = includeSystemPrompt
      ? [systemPrompt, ...mappedMessages]
      : [...mappedMessages];

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

  // ============================================================
  // CONVERSATION END DETECTION
  // ============================================================

  /**
   * Detect if user message indicates conversation should end
   */
  detectConversationEnd(message) {
    if (!message || typeof message !== 'string') {
      return false;
    }

    const normalizedMessage = message.toLowerCase().trim();

    // Strong endings: Match if at end of message or standalone
    for (const phrase of STRONG_ENDING_PHRASES) {
      if (normalizedMessage === phrase) {
        return true;
      }
      const endsWithPhrase = new RegExp(
        `${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[.!?,;]*$`,
        'i'
      );
      if (
        endsWithPhrase.test(normalizedMessage) &&
        normalizedMessage.length < THRESHOLDS.MAX_MESSAGE_LENGTH_FOR_ENDING
      ) {
        return true;
      }
    }

    // Weak endings: Only exact match
    for (const phrase of WEAK_ENDING_PHRASES) {
      if (
        normalizedMessage === phrase ||
        normalizedMessage === phrase + '!' ||
        normalizedMessage === phrase + '.'
      ) {
        return true;
      }
    }

    return false;
  }

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

  // ============================================================
  // MAIN MESSAGE PROCESSING (Delegates to reasoning services)
  // ============================================================

  /**
   * Process a user message - routes to appropriate reasoning service
   */
  async processMessage(client, sessionId, userMessage, options = {}) {
    const { userIdentifier = null } = options;

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

      // Check if client's plan uses Adaptive mode
      const plan = await Plan.findByName(client.plan_type || 'unlimited');
      const aiMode = plan?.ai_mode || 'standard';

      if (aiMode === 'adaptive') {
        log.info(`[Conversation] Using Adaptive mode for client ${client.id}`);
        return await this._processAdaptiveMode(conversation, client, userMessage);
      }

      // Standard mode
      log.info(`[Conversation] Using Standard mode for client ${client.id}`);
      return await this._processStandardMode(
        conversation,
        client,
        sessionId,
        userMessage,
        isNewConversation,
        options
      );
    } catch (error) {
      log.error('Error processing message', error);
      throw error;
    }
  }

  /**
   * Process message in Adaptive mode
   * @private
   */
  async _processAdaptiveMode(conversation, client, userMessage) {
    const result = await adaptiveReasoningService.processAdaptiveMessage(
      conversation.id,
      client.id,
      userMessage,
      client,
      conversation
    );

    // Record usage
    try {
      const toolCallsCount = result.tool_executed ? 1 : 0;
      const reasoningMetrics = result.reasoningMetrics || {
        isAdaptive: true,
        critiqueTriggered: false,
        contextFetchCount: 0,
      };

      const tokensInput = reasoningMetrics.totalInputTokens || 0;
      const tokensOutput = reasoningMetrics.totalOutputTokens || 0;

      await ApiUsage.recordUsage(
        client.id,
        tokensInput,
        tokensOutput,
        toolCallsCount,
        false,
        reasoningMetrics
      );
    } catch (usageError) {
      log.error('Failed to record usage', usageError);
    }

    return {
      response: result.response,
      conversationId: conversation.id,
      toolExecuted: result.tool_executed,
      toolResult: result.tool_result,
      mode: 'adaptive',
      reasonCode: result.reason_code,
    };
  }

  /**
   * Process message in Standard mode
   * @private
   */
  async _processStandardMode(
    conversation,
    client,
    sessionId,
    userMessage,
    isNewConversation,
    options
  ) {
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

    // Process using standard reasoning service
    const result = await standardReasoningService.processStandardMessage(
      conversation,
      client,
      userMessage,
      messages,
      { maxToolIterations: options.maxToolIterations || 3, isNewConversation }
    );

    // Record usage and finalize
    return await standardReasoningService.recordUsageAndFinalize(
      client,
      conversation,
      sessionId,
      result,
      userMessage,
      isNewConversation,
      this.addMessage.bind(this),
      this.updateConversationContext.bind(this)
    );
  }

  /**
   * Prepare messages array for LLM call
   * @private
   */
  async _prepareMessagesForLLM(sessionId, client, clientTools, conversation, userMessage, options) {
    const isFirstMessage = !conversation || conversation.message_count === 0;
    const messages = await this.getConversationContext(
      sessionId,
      client,
      clientTools,
      isFirstMessage
    );

    let userMessageContent = userMessage;

    // Include email subject for context if applicable
    if (options.channel === 'email' && options.channelMetadata?.subject) {
      const subject = options.channelMetadata.subject;
      if (!subject.toLowerCase().startsWith('re:')) {
        userMessageContent = `Subject: ${subject}\n\n${userMessage}`;
      } else {
        const subjectWithoutRe = subject.replace(/^Re:\s*/i, '').trim();
        if (subjectWithoutRe?.length > 0) {
          userMessageContent = `Subject: ${subjectWithoutRe}\n\n${userMessage}`;
        }
      }
    }

    messages.push({ role: 'user', content: userMessageContent });
    return messages;
  }
}

// Export singleton instance
const conversationService = new ConversationService();
export default conversationService;
