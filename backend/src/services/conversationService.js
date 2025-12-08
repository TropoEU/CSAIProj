import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { ToolExecution } from '../models/ToolExecution.js';
import { RedisCache } from './redisCache.js';
import { getEnhancedSystemPrompt } from '../prompts/systemPrompt.js';
import llmService from './llmService.js';
import toolManager from './toolManager.js';
import n8nService from './n8nService.js';

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
    let conversation = await Conversation.findBySession(sessionId);

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
    const conversation = await Conversation.findBySession(sessionId);
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
    const conversation = await Conversation.findBySession(sessionId);
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

  /**
   * Process a user message with full tool execution flow
   * @param {Object} client - Client configuration
   * @param {String} sessionId - Session ID
   * @param {String} userMessage - User's message
   * @param {Object} options - Optional parameters
   * @returns {Object} { response, toolsUsed, tokensUsed, conversationId }
   */
  async processMessage(client, sessionId, userMessage, options = {}) {
    const { userIdentifier = null, maxToolIterations = 3 } = options;

    try {
      // Get or create conversation
      const conversation = await this.getOrCreateConversation(
        client.id,
        sessionId,
        userIdentifier
      );

      // Save user message
      await this.addMessage(conversation.id, 'user', userMessage);

      // Get enabled tools for this client
      const clientTools = await toolManager.getClientTools(client.id);

      // Get conversation context
      let messages = await this.getConversationContext(sessionId, client, clientTools);

      // Add the new user message to context
      messages.push({ role: 'user', content: userMessage });

      // Track tool usage
      const toolsUsed = [];
      let totalTokens = 0;
      let iterationCount = 0;
      let finalResponse = null;

      // Format tools for LLM (once, before the loop)
      const formattedTools = toolManager.formatToolsForLLM(clientTools);

      // For Ollama, add tool descriptions to system prompt (only once!)
      if (llmService.provider === 'ollama' && formattedTools && iterationCount === 0) {
        messages[0].content += formattedTools;
      }

      // Tool execution loop (handle multi-turn tool calls)
      while (iterationCount < maxToolIterations) {
        iterationCount++;

        // Call LLM
        const llmResponse = await llmService.chat(messages, {
          tools: llmService.supportsNativeFunctionCalling() ? formattedTools : null,
          maxTokens: 2048,
          temperature: 0.3
        });

        totalTokens += llmResponse.tokens.total;

        // Check for tool calls (native or parsed from content)
        let toolCalls = llmResponse.toolCalls;

        // For Ollama, parse tool calls from content
        if (!toolCalls && llmService.provider === 'ollama') {
          toolCalls = toolManager.parseToolCallsFromContent(llmResponse.content);
        }

        // No tool calls - we have the final response
        if (!toolCalls || toolCalls.length === 0) {
          finalResponse = llmResponse.content;
          break;
        }

        // Execute tool calls
        console.log(`[Conversation] Executing ${toolCalls.length} tool(s)`);

        // Add assistant message with tool calls to context
        messages.push({
          role: 'assistant',
          content: llmResponse.content || ''
        });

        for (const toolCall of toolCalls) {
          const { id, name, arguments: toolArgs } = toolCall;

          console.log(`[Conversation] Executing tool: ${name}`);

          // Find tool definition
          const tool = await toolManager.getToolByName(client.id, name);

          if (!tool) {
            console.error(`[Conversation] Tool not found: ${name}`);
            const errorMessage = `Error: Tool "${name}" is not available`;

            // Add error as tool result
            messages.push({
              role: 'tool',
              content: errorMessage,
              tool_call_id: id
            });

            // Log failed execution
            await ToolExecution.create(
              conversation.id,
              name,
              toolArgs,
              { error: 'Tool not found' },
              false,
              0
            );

            continue;
          }

          // Validate tool arguments
          const validation = toolManager.validateToolArguments(tool, toolArgs);
          if (!validation.valid) {
            console.error(`[Conversation] Invalid arguments for ${name}:`, validation.errors);
            const errorMessage = `Error: Invalid arguments - ${validation.errors.join(', ')}`;

            messages.push({
              role: 'tool',
              content: errorMessage,
              tool_call_id: id
            });

            await ToolExecution.create(
              conversation.id,
              name,
              toolArgs,
              { error: validation.errors },
              false,
              0
            );

            continue;
          }

          // Execute via n8n
          const startTime = Date.now();
          const result = await n8nService.executeTool(
            tool.n8n_webhook_url,
            toolArgs
          );

          const executionTime = Date.now() - startTime;

          // Log execution
          await ToolExecution.create(
            conversation.id,
            name,
            toolArgs,
            result.data,
            result.success,
            result.executionTimeMs
          );

          // Format result for LLM
          const formattedResult = n8nService.formatResponseForLLM(result.data);

          // Add tool result to messages
          messages.push({
            role: 'tool',
            content: result.success ? formattedResult : result.error,
            tool_call_id: id
          });

          // Track tool usage
          toolsUsed.push({
            name,
            success: result.success,
            executionTime: result.executionTimeMs
          });

          console.log(`[Conversation] Tool ${name} ${result.success ? 'succeeded' : 'failed'} (${result.executionTimeMs}ms)`);
        }

        // Continue loop to get final response with tool results
      }

      // If we hit max iterations without a final response
      if (!finalResponse) {
        finalResponse = 'I apologize, but I encountered an issue processing your request. Please try again or rephrase your question.';
      }

      // Save assistant response
      await this.addMessage(conversation.id, 'assistant', finalResponse, totalTokens);

      // Update context in cache
      messages.push({ role: 'assistant', content: finalResponse });
      await this.updateConversationContext(sessionId, conversation.id, messages);

      return {
        response: finalResponse,
        toolsUsed,
        tokensUsed: totalTokens,
        conversationId: conversation.id,
        iterations: iterationCount
      };

    } catch (error) {
      console.error('[Conversation] Error processing message:', error);
      throw error;
    }
  }
}

// Export singleton instance
const conversationService = new ConversationService();
export default conversationService;
