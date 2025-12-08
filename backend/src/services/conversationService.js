import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { RedisCache } from './redisCache.js';
import { getEnhancedSystemPrompt } from '../prompts/systemPrompt.js';

/**
 * Conversation Service
 *
 * Manages conversation state, context windows, and message history
 */

class ConversationService {
  constructor() {
    this.maxContextMessages = 20; // Keep last 20 messages in context
    this.contextTokenLimit = 100000; // Approximate token limit for context
  }

  /**
   * Create a new conversation
   * @param {String} clientId - Client ID
   * @param {String} sessionId - Session ID
   * @param {String} userIdentifier - Optional user identifier (email, phone, etc.)
   * @returns {Object} Conversation record
   */
  async createConversation(clientId, sessionId, userIdentifier = null) {
    return await Conversation.create(clientId, sessionId, userIdentifier);
  }

  /**
   * Get or create conversation by session ID
   * @param {String} clientId - Client ID
   * @param {String} sessionId - Session ID
   * @param {String} userIdentifier - Optional user identifier
   * @returns {Object} Conversation record
   */
  async getOrCreateConversation(clientId, sessionId, userIdentifier = null) {
    // Try to find existing active conversation
    let conversation = await Conversation.findBySessionId(sessionId);

    // Create new if not found
    if (!conversation) {
      conversation = await this.createConversation(clientId, sessionId, userIdentifier);
    }

    return conversation;
  }

  /**
   * Add a message to the conversation
   * @param {String} conversationId - Conversation ID
   * @param {String} role - Message role (user, assistant, system, tool)
   * @param {String} content - Message content
   * @param {Number} tokensUsed - Optional token count
   * @param {Object} metadata - Optional metadata (tool calls, etc.)
   * @returns {Object} Message record
   */
  async addMessage(conversationId, role, content, tokensUsed = 0, metadata = null) {
    const message = await Message.create(conversationId, role, content, tokensUsed);

    // Update conversation stats
    await this.updateConversationStats(conversationId);

    return message;
  }

  /**
   * Get conversation history with context window management
   * @param {String} conversationId - Conversation ID
   * @param {Number} limit - Max messages to retrieve
   * @returns {Array} Array of messages
   */
  async getConversationHistory(conversationId, limit = null) {
    if (limit) {
      return await Message.getRecent(conversationId, limit);
    }
    return await Message.getAll(conversationId);
  }

  /**
   * Get conversation context from cache or DB
   * @param {String} sessionId - Session ID
   * @param {Object} client - Client configuration
   * @param {Array} tools - Available tools
   * @returns {Array} Formatted messages array for LLM
   */
  async getConversationContext(sessionId, client, tools = []) {
    // Try to get from Redis cache first
    const cached = await RedisCache.getConversationContext(sessionId);
    if (cached) {
      return cached.messages;
    }

    // Get from database
    const conversation = await Conversation.findBySessionId(sessionId);
    if (!conversation) {
      // New conversation - return just system message
      const systemMessage = getEnhancedSystemPrompt(client, tools);
      return [{ role: 'system', content: systemMessage }];
    }

    // Get message history
    const messages = await this.getConversationHistory(conversation.id);

    // Format messages for LLM
    const formattedMessages = [
      { role: 'system', content: getEnhancedSystemPrompt(client, tools) },
      ...messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        ...(msg.metadata && { metadata: JSON.parse(msg.metadata) })
      }))
    ];

    // Cache in Redis
    await RedisCache.setConversationContext(sessionId, {
      conversationId: conversation.id,
      messages: formattedMessages
    });

    return formattedMessages;
  }

  /**
   * Update conversation context in cache
   * @param {String} sessionId - Session ID
   * @param {String} conversationId - Conversation ID
   * @param {Array} messages - Updated messages array
   */
  async updateConversationContext(sessionId, conversationId, messages) {
    await RedisCache.updateConversationContext(sessionId, {
      conversationId,
      messages,
      last_activity: new Date().toISOString()
    });
  }

  /**
   * Manage context window - truncate old messages if needed
   * @param {Array} messages - Messages array
   * @returns {Array} Truncated messages array
   */
  manageContextWindow(messages) {
    // Always keep system message (first message)
    if (messages.length <= this.maxContextMessages) {
      return messages;
    }

    const systemMessage = messages[0];
    const recentMessages = messages.slice(-(this.maxContextMessages - 1));

    return [systemMessage, ...recentMessages];
  }

  /**
   * Summarize old conversation context for long conversations
   * (Advanced feature - can implement later)
   * @param {Array} messages - Messages to summarize
   * @returns {String} Summary
   */
  async summarizeContext(messages) {
    // TODO: Use LLM to summarize old messages
    // For now, just keep recent messages
    return null;
  }

  /**
   * Update conversation statistics
   * @param {String} conversationId - Conversation ID
   */
  async updateConversationStats(conversationId) {
    const messageCount = await Message.count(conversationId);
    const tokensTotal = await Message.getTotalTokens(conversationId);

    await Conversation.updateStats(conversationId, messageCount, tokensTotal);
  }

  /**
   * End a conversation
   * @param {String} sessionId - Session ID
   * @returns {Object} Updated conversation
   */
  async endConversation(sessionId) {
    const conversation = await Conversation.findBySessionId(sessionId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    const updated = await Conversation.update(conversation.id, {
      status: 'ended',
      endedAt: new Date()
    });

    // Clear cache
    await RedisCache.clearConversationContext(sessionId);

    return updated;
  }

  /**
   * Get conversation by ID
   * @param {String} conversationId - Conversation ID
   * @returns {Object} Conversation with messages
   */
  async getConversationById(conversationId) {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    const messages = await Message.findByConversationId(conversationId);

    return {
      ...conversation,
      messages
    };
  }

  /**
   * Get all conversations for a client
   * @param {String} clientId - Client ID
   * @param {Number} limit - Max conversations to retrieve
   * @param {Number} offset - Offset for pagination
   * @returns {Array} Array of conversations
   */
  async getClientConversations(clientId, limit = 50, offset = 0) {
    return await Conversation.findByClientId(clientId, limit, offset);
  }

  /**
   * Search conversations by user identifier
   * @param {String} clientId - Client ID
   * @param {String} userIdentifier - User identifier (email, phone, etc.)
   * @returns {Array} Array of conversations
   */
  async searchConversationsByUser(clientId, userIdentifier) {
    return await Conversation.findByUserIdentifier(clientId, userIdentifier);
  }
}

// Export singleton instance
const conversationService = new ConversationService();
export default conversationService;
