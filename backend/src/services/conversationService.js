import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { ToolExecution } from '../models/ToolExecution.js';
import { RedisCache } from './redisCache.js';
import { getEnhancedSystemPrompt } from '../prompts/systemPrompt.js';
import llmService from './llmService.js';
import toolManager from './toolManager.js';
import n8nService from './n8nService.js';
import integrationService from './integrationService.js';
import { logger } from '../utils/logger.js';

/**
 * Conversation Service
 *
 * Manages conversation state, context windows, and message history
 */

class ConversationService {
  constructor() {
    this.maxContextMessages = 10; // Keep last 10 messages in context (reduced from 20 to save tokens)
    this.contextTokenLimit = 100000; // Approximate token limit for context
  }

  /**
   * Normalize tool arguments (e.g., convert "today" to actual date)
   * @param {Object} args - Tool arguments
   * @param {Object} tool - Tool definition
   * @returns {Object} Normalized arguments
   */
  normalizeToolArguments(args, tool) {
    const normalized = { ...args };
    const schema = tool?.parameters_schema;
    
    if (!schema || !schema.properties) {
      return normalized;
    }

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // Check for date parameters that need normalization
    for (const [paramName, paramValue] of Object.entries(args)) {
      const paramSchema = schema.properties[paramName];
      
      // If this is a date parameter and value is a string
      if (paramSchema && paramSchema.type === 'string' && typeof paramValue === 'string') {
        const lowerValue = paramValue.toLowerCase().trim();
        
        // Handle relative date strings
        if (lowerValue === 'today') {
          normalized[paramName] = todayStr;
        } else if (lowerValue === 'tomorrow') {
          normalized[paramName] = tomorrowStr;
        } else if (lowerValue === 'yesterday') {
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          normalized[paramName] = yesterday.toISOString().split('T')[0];
        }
        // If it's a date field, validate and correct if needed
        else if (paramName.toLowerCase().includes('date')) {
          // If it's already in YYYY-MM-DD format, validate it
          if (/^\d{4}-\d{2}-\d{2}$/.test(paramValue)) {
            const parsed = new Date(paramValue + 'T12:00:00');
            // If the date is more than 1 year in the past, it's likely wrong (AI hallucinated)
            // Replace with today's date
            const oneYearAgo = new Date(today);
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            if (parsed < oneYearAgo) {
              console.warn(`[Conversation] Date ${paramValue} is too far in the past, correcting to today: ${todayStr}`);
              normalized[paramName] = todayStr;
            }
          } else {
            // Try to parse other date formats
            const parsed = new Date(paramValue);
            if (!isNaN(parsed.getTime())) {
              normalized[paramName] = parsed.toISOString().split('T')[0];
            }
          }
        }
      }
    }

    // Fix phone number/email mix-ups
    // If customerEmail looks like a phone number (only digits, no @), move it to customerPhone
    if (normalized.customerEmail && /^\d+$/.test(normalized.customerEmail) && !normalized.customerPhone) {
      console.warn(`[Conversation] Phone number found in customerEmail field, moving to customerPhone`);
      normalized.customerPhone = normalized.customerEmail;
      normalized.customerEmail = '';
    }
    // If customerPhone looks like an email (contains @), move it to customerEmail
    if (normalized.customerPhone && normalized.customerPhone.includes('@') && !normalized.customerEmail) {
      console.warn(`[Conversation] Email found in customerPhone field, moving to customerEmail`);
      normalized.customerEmail = normalized.customerPhone;
      normalized.customerPhone = '';
    }


    return normalized;
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
  async getConversationContext(sessionId, client, tools = [], includeSystemPrompt = true) {
    // Try to get from Redis cache first
    const cached = await RedisCache.getConversationContext(sessionId);
    if (cached) {
      // If we don't need system prompt and it's cached, remove it
      if (!includeSystemPrompt && cached.messages?.[0]?.role === 'system') {
        return cached.messages.slice(1);
      }
      return cached.messages;
    }

    // Get from database
    const conversation = await Conversation.findBySession(sessionId);
    if (!conversation) {
      // New conversation - return just system message
      if (!includeSystemPrompt) {
        return [];
      }
      const systemMessage = getEnhancedSystemPrompt(client, tools);
      return [{ role: 'system', content: systemMessage }];
    }

    // Get message history
    const messages = await this.getConversationHistory(conversation.id);

    // Format messages for LLM
    const formattedMessages = [];
    
    // Only include system prompt if requested (for first message or if system prompt changed)
    if (includeSystemPrompt) {
      formattedMessages.push({ role: 'system', content: getEnhancedSystemPrompt(client, tools) });
    }
    
    formattedMessages.push(...messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      ...(msg.metadata && { metadata: JSON.parse(msg.metadata) })
    })));

    // Cache in Redis (always cache with system prompt for consistency)
    const messagesWithSystem = [
      { role: 'system', content: getEnhancedSystemPrompt(client, tools) },
      ...messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        ...(msg.metadata && { metadata: JSON.parse(msg.metadata) })
      }))
    ];
    
    await RedisCache.setConversationContext(sessionId, {
      conversationId: conversation.id,
      messages: messagesWithSystem
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
      // Get or create conversation (track if it's new)
      let conversation = await Conversation.findBySession(sessionId);
      const isNewConversation = !conversation; // Track if this is a new conversation
      
      if (!conversation) {
        conversation = await this.createConversation(client.id, sessionId, userIdentifier);
      }

      // Save user message
      await this.addMessage(conversation.id, 'user', userMessage);

      // Get enabled tools for this client
      const clientTools = await toolManager.getClientTools(client.id);

      // Get conversation context
      // For Ollama, we can skip system prompt on subsequent requests (it's cached)
      // But we need it for the first request to establish the cache
      const isFirstMessage = !conversation || conversation.message_count === 0;
      let messages = await this.getConversationContext(sessionId, client, clientTools, isFirstMessage);

      // Add the new user message to context
      messages.push({ role: 'user', content: userMessage });

      // Track tool usage and tokens
      const toolsUsed = [];
      let totalTokens = 0;
      let totalTokensInput = 0;
      let totalTokensOutput = 0;
      let iterationCount = 0;
      let finalResponse = null;
      let lastLLMResponse = null; // Track last LLM response for token counting

      // Format tools for LLM (once, before the loop)
      const formattedTools = toolManager.formatToolsForLLM(clientTools);

      // Determine effective provider (client override or default)
      const effectiveProvider = client.llm_provider || llmService.provider;
      
      // For Ollama, we use prompt-engineering tool instructions.
      // IMPORTANT: do NOT permanently mutate/cache the system prompt with tool instructions,
      // otherwise it will grow every request (and token usage will explode).
      // Also, for Ollama, we can rely on caching - if system prompt is missing, add it only for this request
      let baseSystemPrompt = messages?.[0]?.role === 'system' ? messages[0].content : null;
      
      if (effectiveProvider === 'ollama') {
        // If no system prompt in messages (because we skipped it for caching), add it for this request
        // Ollama will cache it, so subsequent requests won't need it
        if (!baseSystemPrompt) {
          baseSystemPrompt = getEnhancedSystemPrompt(client, clientTools);
          messages.unshift({ role: 'system', content: baseSystemPrompt });
        }
        
        // Append tool instructions to system prompt for this request only
        if (formattedTools && baseSystemPrompt) {
          messages[0].content = `${baseSystemPrompt}${formattedTools}`;
        }
      }

      // Tool execution loop (handle multi-turn tool calls)
      while (iterationCount < maxToolIterations) {
        iterationCount++;

        // Call LLM (with per-client model/provider if specified)
        const llmResponse = await llmService.chat(messages, {
          tools: llmService.supportsNativeFunctionCalling() ? formattedTools : null,
          maxTokens: 2048,
          temperature: 0.3,
          model: client.model_name || null,      // Per-client model override
          provider: client.llm_provider || null  // Per-client provider override
        });

        lastLLMResponse = llmResponse; // Track last response
        totalTokens += llmResponse.tokens.total;
        // Track input/output tokens separately if available, otherwise estimate
        if (llmResponse.tokens.input !== undefined && llmResponse.tokens.output !== undefined) {
          totalTokensInput += llmResponse.tokens.input;
          totalTokensOutput += llmResponse.tokens.output;
        } else {
          // Estimate: input is typically 70% of total, output is 30%
          totalTokensInput += Math.floor(llmResponse.tokens.total * 0.7);
          totalTokensOutput += Math.floor(llmResponse.tokens.total * 0.3);
        }

        // Check for tool calls (native or parsed from content)
        let toolCalls = llmResponse.toolCalls;

        // For Ollama, parse tool calls from content
        if (!toolCalls && effectiveProvider === 'ollama') {
          toolCalls = toolManager.parseToolCallsFromContent(llmResponse.content);
        }

        // No tool calls - we have the final response
        if (!toolCalls || toolCalls.length === 0) {
          // Check if AI claimed to have done something without calling a tool (hallucination detection)
          const responseLower = llmResponse.content.toLowerCase();
          const actionWords = ['booked', 'reserved', 'confirmed', 'scheduled', 'completed', 'done', 'finished'];
          const hasActionClaim = actionWords.some(word => responseLower.includes(word));
          
          // If AI claimed an action but no tool was called, and user requested an action, force tool call
          if (hasActionClaim && userMessage.toLowerCase().match(/(book|reserve|schedule|check|get.*status)/i)) {
            console.warn(`[Conversation] AI claimed action "${responseLower}" but no tool was called. This is a hallucination.`);
            // Don't accept this response - the AI needs to actually call the tool
            // We'll let it continue in the loop, but this is logged for debugging
          }
          
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

          // Normalize dates in tool arguments (convert "today", "tomorrow" to actual dates)
          const normalizedArgs = this.normalizeToolArguments(toolArgs, tool);

          // Use normalized arguments for execution
          const finalArgs = normalizedArgs || toolArgs;

          // Fetch integration credentials if tool requires one
          let integration = null;
          console.log(`\n========== TOOL EXECUTION DEBUG ==========`);
          console.log(`[Conversation] Processing tool: ${name}`);
          console.log(`[Conversation] Tool integration_type:`, tool.integration_type || 'NULL');
          console.log(`[Conversation] Client ID:`, client.id);
          console.log(`[Conversation] Tool object keys:`, Object.keys(tool));
          console.log(`[Conversation] Tool has integration_type property:`, 'integration_type' in tool);
          console.log(`[Conversation] Tool integration_type value:`, tool.integration_type);
          
          if (tool.integration_type) {
            console.log(`[Conversation] Fetching integration for type: ${tool.integration_type}`);
            integration = await integrationService.getIntegrationForClient(
              client.id, 
              tool.integration_type
            );
            
            if (!integration) {
              console.error(`[Conversation] ❌ Tool ${name} requires '${tool.integration_type}' integration but client ${client.id} doesn't have one configured`);
            } else {
              console.log(`[Conversation] ✅ Found integration:`, {
                type: integration.type,
                apiUrl: integration.apiUrl,
                hasApiKey: !!integration.apiKey,
                authMethod: integration.authMethod
              });
            }
          } else {
            console.log(`[Conversation] ⚠️ Tool ${name} has NO integration_type property!`);
            console.log(`[Conversation] Full tool object:`, JSON.stringify(tool, null, 2));
          }

          // Execute via n8n (with integration credentials if available)
          const startTime = Date.now();
          console.log(`[Conversation] Calling n8n with integration:`, integration ? 'YES' : 'NO');
          if (integration) {
            console.log(`[Conversation] Integration being sent:`, {
              type: integration.type,
              apiUrl: integration.apiUrl,
              apiKey: integration.apiKey ? 'SET' : 'MISSING',
              authMethod: integration.authMethod
            });
          } else {
            console.error(`[Conversation] ❌ NO INTEGRATION TO SEND!`);
          }
          console.log(`==========================================\n`);
          
          const result = await n8nService.executeTool(
            tool.n8n_webhook_url,
            finalArgs,
            { integration }
          );

          const executionTime = Date.now() - startTime;

            // Log execution
            await ToolExecution.create(
              conversation.id,
              name,
              finalArgs,
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

      // Restore base system prompt before caching, to prevent tool-prompt duplication across turns
      if (baseSystemPrompt && messages?.[0]?.role === 'system') {
        messages[0].content = baseSystemPrompt;
      }

      // Save assistant response
      // Store ACCUMULATED tokens from ALL LLM calls in this message processing (including tool call iterations)
      await this.addMessage(conversation.id, 'assistant', finalResponse, totalTokens);

      // Update context in cache
      messages.push({ role: 'assistant', content: finalResponse });
      await this.updateConversationContext(sessionId, conversation.id, messages);

      // Record usage for billing/analytics
      try {
        const { ApiUsage } = await import('../models/ApiUsage.js');
        const tokensInput = totalTokensInput || Math.floor(totalTokens * 0.7); // Fallback to estimate if not available
        const tokensOutput = totalTokensOutput || Math.floor(totalTokens * 0.3); // Fallback to estimate if not available
        const toolCallsCount = toolsUsed.length;
        const actualTotalTokens = tokensInput + tokensOutput; // This is what gets billed
        
        console.log(`[Conversation] Recording usage: client=${client.id}, tokens=${actualTotalTokens} (input: ${tokensInput}, output: ${tokensOutput}), tools=${toolCallsCount}, newConversation=${isNewConversation}`);
        await ApiUsage.recordUsage(client.id, tokensInput, tokensOutput, toolCallsCount, isNewConversation);
        // Note: conversation.tokens_total is calculated from message tokens at display time
        console.log(`[Conversation] Usage recorded successfully`);
      } catch (usageError) {
        console.error('[Conversation] Failed to record usage:', usageError);
        // Don't throw - usage tracking failure shouldn't break the conversation
      }

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
