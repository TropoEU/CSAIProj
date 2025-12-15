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
   * @param {String} llmProvider - LLM provider used for this conversation
   * @param {String} modelName - Model name used for this conversation
   * @returns {Object} Conversation record
   */
  async createConversation(clientId, sessionId, userIdentifier = null, llmProvider = null, modelName = null) {
    return await Conversation.create(clientId, sessionId, userIdentifier, llmProvider, modelName);
  }

  /**
   * Get or create conversation by session ID
   * @param {String} clientId - Client ID
   * @param {String} sessionId - Session ID
   * @param {String} userIdentifier - Optional user identifier
   * @param {String} llmProvider - LLM provider used for this conversation
   * @param {String} modelName - Model name used for this conversation
   * @returns {Object} Conversation record
   */
  async getOrCreateConversation(clientId, sessionId, userIdentifier = null, llmProvider = null, modelName = null) {
    // Try to find existing conversation
    let conversation = await Conversation.findBySession(sessionId);

    // If conversation exists but has ended, create a new one
    if (conversation && conversation.ended_at) {
      console.log(`[Conversation] Session ${sessionId} has ended, creating new conversation`);
      conversation = await this.createConversation(clientId, sessionId, userIdentifier, llmProvider, modelName);
    } else if (!conversation) {
      // Create new if not found
      conversation = await this.createConversation(clientId, sessionId, userIdentifier, llmProvider, modelName);
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

    const updated = await Conversation.end(conversation.id);

    // Clear cache
    await RedisCache.deleteConversationContext(sessionId);

    return updated;
  }

  /**
   * Auto-end inactive conversations
   * Ends conversations that have been inactive for more than the specified minutes
   * @param {Number} inactivityMinutes - Minutes of inactivity before auto-ending (default: 15)
   * @returns {Object} Summary of ended conversations
   */
  async autoEndInactiveConversations(inactivityMinutes = 15) {
    try {
      const inactiveConversations = await Conversation.findInactive(inactivityMinutes);
      
      if (inactiveConversations.length === 0) {
        return {
          ended: 0,
          conversations: []
        };
      }

      const endedConversations = [];
      
      for (const conv of inactiveConversations) {
        try {
          // End the conversation
          await Conversation.end(conv.id);
          
          // Clear Redis cache if session_id exists
          if (conv.session_id) {
            await RedisCache.deleteConversationContext(conv.session_id);
          }
          
          endedConversations.push({
            id: conv.id,
            session_id: conv.session_id,
            client_id: conv.client_id,
            last_activity: conv.last_activity
          });
        } catch (error) {
          console.error(`[Conversation] Failed to auto-end conversation ${conv.id}:`, error);
          // Continue with other conversations even if one fails
        }
      }

      console.log(`[Conversation] Auto-ended ${endedConversations.length} inactive conversation(s)`);
      
      return {
        ended: endedConversations.length,
        conversations: endedConversations
      };
    } catch (error) {
      console.error('[Conversation] Error auto-ending inactive conversations:', error);
      throw error;
    }
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
   * Detect if user message indicates conversation should end
   * @param {String} message - User's message
   * @returns {Boolean} True if message indicates conversation should end
   */
  detectConversationEnd(message) {
    if (!message || typeof message !== 'string') {
      return false;
    }

    const normalizedMessage = message.toLowerCase().trim();
    
    // Common ending phrases
    const endingPhrases = [
      'thank you',
      'thanks',
      'thank you very much',
      'thanks a lot',
      'thank you so much',
      'goodbye',
      'bye',
      'bye bye',
      'see you',
      'see ya',
      'that\'s all',
      'thats all',
      'that is all',
      'i\'m done',
      'im done',
      'i am done',
      'we\'re done',
      'were done',
      'we are done',
      'i\'m finished',
      'im finished',
      'i am finished',
      'we\'re finished',
      'were finished',
      'we are finished',
      'end conversation',
      'end the conversation',
      'close conversation',
      'close the conversation',
      'that\'s it',
      'thats it',
      'that is it',
      'all done',
      'all set',
      'no more questions',
      'no further questions',
      'nothing else',
      'nothing more',
      'have a good day',
      'have a nice day',
      'have a great day',
      'take care',
      'talk to you later',
      'catch you later',
      'until next time'
    ];

    // Check for exact matches or phrases that end with these
    for (const phrase of endingPhrases) {
      // Exact match
      if (normalizedMessage === phrase) {
        return true;
      }
      
      // Ends with the phrase (with optional punctuation)
      const regex = new RegExp(`^.*${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[.!?,;]*$`, 'i');
      if (regex.test(normalizedMessage)) {
        return true;
      }
      
      // Contains the phrase as a complete word/phrase
      const wordBoundaryRegex = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (wordBoundaryRegex.test(normalizedMessage) && normalizedMessage.length < 100) {
        // Only if message is short (to avoid false positives in long messages)
        return true;
      }
    }

    return false;
  }

  /**
   * Process a user message with full tool execution flow
   * @param {Object} client - Client configuration
   * @param {String} sessionId - Session ID
   * @param {String} userMessage - User's message
   * @param {Object} options - Optional parameters
   * @returns {Object} { response, toolsUsed, tokensUsed, conversationId, conversationEnded }
   */
  async processMessage(client, sessionId, userMessage, options = {}) {
    const { userIdentifier = null, maxToolIterations = 3 } = options;

    try {
      // Get or create conversation (track if it's new)
      let conversation = await Conversation.findBySession(sessionId);
      const isNewConversation = !conversation; // Track if this is a new conversation
      
      // Get effective provider/model (use client's settings or defaults)
      const effectiveProvider = client.llm_provider || 'ollama';
      const effectiveModel = client.model_name || null;
      
      if (!conversation) {
        conversation = await this.createConversation(client.id, sessionId, userIdentifier, effectiveProvider, effectiveModel);
      }

      // Check if user wants to end the conversation
      const shouldEndConversation = this.detectConversationEnd(userMessage);
      
      if (shouldEndConversation) {
        console.log(`[Conversation] Detected conversation end signal: "${userMessage}"`);
        
        // Save user message
        await this.addMessage(conversation.id, 'user', userMessage);
        
        // End the conversation
        await Conversation.end(conversation.id);
        
        // Clear Redis cache
        await RedisCache.deleteConversationContext(sessionId);
        
        // Generate a friendly goodbye response
        const goodbyeMessages = [
          'Thank you for chatting with us! Have a great day!',
          'Thanks for reaching out! We\'re here if you need anything else.',
          'Thank you! Feel free to come back anytime if you have more questions.',
          'Thanks for the conversation! Have a wonderful day!',
          'Thank you! We appreciate your time. Take care!'
        ];
        const goodbyeResponse = goodbyeMessages[Math.floor(Math.random() * goodbyeMessages.length)];
        
        // Save assistant response
        await this.addMessage(conversation.id, 'assistant', goodbyeResponse, 0);
        
        return {
          response: goodbyeResponse,
          toolsUsed: [],
          tokensUsed: 0,
          conversationId: conversation.id,
          iterations: 0,
          conversationEnded: true
        };
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

      // effectiveProvider was already determined above when creating the conversation

      // Format tools for LLM (once, before the loop) - pass provider to get correct format
      const formattedTools = toolManager.formatToolsForLLM(clientTools, effectiveProvider);
      
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

      // Track last executed tool calls to detect if LLM tries to call them again
      let lastExecutedToolKeys = null;

      // Tool execution loop (handle multi-turn tool calls)
      while (iterationCount < maxToolIterations) {
        iterationCount++;

        // Call LLM (with per-client model/provider if specified)
        let llmResponse;
        try {
          llmResponse = await llmService.chat(messages, {
            tools: llmService.supportsNativeFunctionCalling(effectiveProvider) ? formattedTools : null,
            maxTokens: 2048,
            temperature: 0.3,
            model: client.model_name || null,      // Per-client model override
            provider: client.llm_provider || null  // Per-client provider override
          });
        } catch (llmError) {
          console.error(`[Conversation] LLM call failed on iteration ${iterationCount}:`, llmError);
          // If we have tool results from previous iteration, try to use them to generate a response
          if (lastExecutedToolKeys && lastLLMResponse && lastLLMResponse.content) {
            console.log(`[Conversation] Using previous LLM response as fallback after error`);
            finalResponse = lastLLMResponse.content;
            break;
          }
          throw llmError; // Re-throw if we can't recover
        }

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

        // If LLM is trying to call the same tools we just executed, break to prevent infinite loop
        if (toolCalls && toolCalls.length > 0 && lastExecutedToolKeys) {
          const currentToolKeys = toolCalls.map(tc => `${tc.name}:${JSON.stringify(tc.arguments)}`);
          const isSameAsLastExecution = currentToolKeys.every(key => lastExecutedToolKeys.includes(key)) &&
                                        currentToolKeys.length === lastExecutedToolKeys.length;
          
          if (isSameAsLastExecution) {
            console.log(`[Conversation] LLM tried to call same tools again after execution. Breaking loop to prevent infinite recursion.`);
            // Use any content as final response, or generate a fallback
            if (llmResponse.content && llmResponse.content.trim().length > 0) {
              finalResponse = llmResponse.content;
            } else {
              finalResponse = 'I apologize, but I encountered an issue processing your request. Please try again.';
            }
            break;
          }
        }

        // Check finish_reason/stopReason - if it's 'stop' and we have content, use it as final response
        // This prevents infinite loops when LLM returns content but also has tool_calls
        if (llmResponse.stopReason === 'stop' && llmResponse.content && llmResponse.content.trim().length > 0) {
          // If we have both content and tool calls, prefer content if finish_reason is 'stop'
          // This means the LLM is done and the content is the final response
          if (toolCalls && toolCalls.length > 0) {
            console.log(`[Conversation] LLM returned both content and tool_calls with finish_reason='stop'. Using content as final response.`);
            toolCalls = null; // Ignore tool calls, use content instead
          }
        }

        // No tool calls - we have the final response
        if (!toolCalls || toolCalls.length === 0) {
          // If we have content, use it as final response
          if (llmResponse.content && llmResponse.content.trim().length > 0) {
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
          } else {
            // No content and no tool calls - this is unusual
            // If we just executed tools, the LLM should respond with the results
            if (lastExecutedToolKeys) {
              console.warn(`[Conversation] LLM returned empty content after tool execution (iteration ${iterationCount}). Using tool result as fallback.`);
              // Try to extract a message from the last tool result if available
              const lastToolMessage = messages.filter(m => m.role === 'tool').pop();
              if (lastToolMessage && lastToolMessage.content) {
                // Try to extract a user-friendly message from the tool result
                const toolContent = lastToolMessage.content;
                // The tool result should already be formatted by n8nService.formatResponseForLLM
                // which extracts the "message" field if available
                // So we can use it directly
                finalResponse = toolContent;
                console.log(`[Conversation] Using tool result message as fallback response`);
                break;
              }
            }
            // If no tool results to fall back on, continue loop (might help on next iteration)
            // But if we're at max iterations, we'll use the fallback error message
          }
        }

        // Execute tool calls
        console.log(`[Conversation] Executing ${toolCalls.length} tool(s)`);
        
        // For native function calling (Groq/OpenAI), if finish_reason was 'tool_calls',
        // the LLM explicitly requested these tools. After execution, the next call should return final response.
        // If it returns tool_calls again, that's unexpected - break to prevent infinite loop.
        const wasToolCallRequest = llmResponse.stopReason === 'tool_calls';

        // Add assistant message with tool calls to context
        // For Groq/OpenAI, we need to include tool_calls in the assistant message
        const assistantMessage = {
          role: 'assistant',
          content: llmResponse.content || ''
        };
        
        // Include tool_calls for providers that support native function calling
        if (llmService.supportsNativeFunctionCalling(effectiveProvider) && toolCalls && toolCalls.length > 0) {
          assistantMessage.tool_calls = toolCalls.map(tc => ({
            id: tc.id,
            type: 'function',
            function: {
              name: tc.name,
              arguments: typeof tc.arguments === 'string' 
                ? tc.arguments 
                : JSON.stringify(tc.arguments)
            }
          }));
        }
        
        messages.push(assistantMessage);

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

          // Fetch integration credentials if tool requires any
          let integrations = {};
          console.log(`\n========== TOOL EXECUTION DEBUG ==========`);
          console.log(`[Conversation] Processing tool: ${name}`);
          console.log(`[Conversation] Tool required_integrations:`, tool.required_integrations || '[]');
          console.log(`[Conversation] Integration mapping:`, tool.integration_mapping || '{}');
          console.log(`[Conversation] Client ID:`, client.id);

          // Check if tool has required integrations (new architecture)
          const requiredIntegrations = tool.required_integrations || [];
          const integrationMapping = tool.integration_mapping || {};

          if (requiredIntegrations.length > 0) {
            try {
              console.log(`[Conversation] Fetching ${requiredIntegrations.length} integrations for tool`);
              integrations = await integrationService.getIntegrationsForTool(
                client.id,
                integrationMapping,
                requiredIntegrations
              );

              const integrationCount = Object.keys(integrations).length;
              console.log(`[Conversation] ✅ Loaded ${integrationCount} integrations:`, Object.keys(integrations).join(', '));
              Object.entries(integrations).forEach(([key, int]) => {
                console.log(`[Conversation] - ${key}:`, {
                  type: int.type,
                  apiUrl: int.apiUrl,
                  hasApiKey: !!int.apiKey
                });
              });
            } catch (error) {
              console.error(`[Conversation] ❌ Failed to load integrations:`, error.message);
              // If required integrations are missing, skip this tool
              messages.push({
                role: 'tool',
                content: `Error: ${error.message}. Please configure the required integrations in the admin panel.`,
                tool_call_id: id
              });
              continue;
            }
          } else {
            console.log(`[Conversation] ⚠️  Tool ${name} has no required integrations`);
          }

          // Execute via n8n (with integration credentials if available)
          const startTime = Date.now();
          const integrationCount = Object.keys(integrations).length;
          console.log(`[Conversation] Calling n8n with ${integrationCount} integrations`);
          console.log(`==========================================\n`);

          const result = await n8nService.executeTool(
            tool.n8n_webhook_url,
            finalArgs,
            { integrations }
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
          let formattedResult = n8nService.formatResponseForLLM(result.data);

          // REMOVED: Tool result simplification was causing Groq to retry the same tool
          // The LLM needs to see structured data to understand the tool actually returned useful info
          // The formatResponseForLLM already handles truncation appropriately

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

        // Track what we just executed to detect if LLM tries to call them again in next iteration
        lastExecutedToolKeys = toolCalls.map(tc => `${tc.name}:${JSON.stringify(tc.arguments)}`);
        
        // Continue loop to get final response with tool results
      }

      // If we hit max iterations without a final response
      if (!finalResponse) {
        // Before using generic error, try to extract a message from the last successful tool execution
        const lastToolMessage = messages.filter(m => m.role === 'tool').pop();
        if (lastToolMessage && lastToolMessage.content) {
          // Try to extract a user-friendly message from the tool result
          try {
            const toolContent = lastToolMessage.content;
            // If the tool result contains a "message" field (common in our API responses)
            if (toolContent.includes('message') || toolContent.includes('Message')) {
              // Try to parse JSON if possible, or extract message text
              const jsonMatch = toolContent.match(/"message"\s*:\s*"([^"]+)"/);
              if (jsonMatch) {
                finalResponse = jsonMatch[1];
                console.log(`[Conversation] Using tool result message as fallback: ${finalResponse.substring(0, 50)}...`);
              } else {
                // Use the tool content directly if it looks like a message
                finalResponse = toolContent.length < 500 ? toolContent : toolContent.substring(0, 200) + '...';
              }
            } else {
              // Use tool content as fallback
              finalResponse = toolContent.length < 500 ? toolContent : `Based on the results: ${toolContent.substring(0, 200)}...`;
            }
          } catch (e) {
            // If parsing fails, use generic error
            finalResponse = 'I apologize, but I encountered an issue processing your request. Please try again or rephrase your question.';
          }
        } else {
          // No tool results available, use generic error
          finalResponse = 'I apologize, but I encountered an issue processing your request. Please try again or rephrase your question.';
        }
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
        iterations: iterationCount,
        conversationEnded: false
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
