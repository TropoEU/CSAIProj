import { HTTP_STATUS } from '../config/constants.js';
import conversationService from '../services/conversationService.js';
import { logger } from '../utils/logger.js';
import { Conversation } from '../models/Conversation.js';
import { RedisCache } from '../services/redisCache.js';

/**
 * Chat Controller
 *
 * Handles incoming chat messages from widget and returns AI responses
 */

/**
 * POST /chat/message
 * Process a user message and return AI response
 */
export async function sendMessage(req, res) {
  try {
    const {
      message,
      sessionId,
      userIdentifier
    } = req.body;

    // Get client from API key (set by auth middleware)
    const client = req.client;
    
    logger.log('[ChatController] Received message request', { 
      message: message?.substring(0, 50), 
      sessionId,
      clientId: client?.id,
      llmProvider: client?.llm_provider || 'ollama',
      modelName: client?.model_name || null
    });

    // Input length limits (prevent DoS)
    const MAX_MESSAGE_LENGTH = 10000; // 10KB max message
    const MAX_SESSION_ID_LENGTH = 100;
    const MAX_USER_IDENTIFIER_LENGTH = 255;

    // Validation
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Message is required and must be a non-empty string'
      });
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: `Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters allowed.`
      });
    }

    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Session ID is required'
      });
    }

    if (sessionId.length > MAX_SESSION_ID_LENGTH) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: `Session ID too long. Maximum ${MAX_SESSION_ID_LENGTH} characters allowed.`
      });
    }

    // Validate userIdentifier if provided
    if (userIdentifier !== undefined && userIdentifier !== null) {
      if (typeof userIdentifier !== 'string' || userIdentifier.length > MAX_USER_IDENTIFIER_LENGTH) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          error: `User identifier must be a string with maximum ${MAX_USER_IDENTIFIER_LENGTH} characters.`
        });
      }
    }

    logger.log('[ChatController] Processing message for client', { 
      clientId: client?.id, 
      clientName: client?.name,
      llmProvider: client?.llm_provider || 'ollama',
      modelName: client?.model_name || null
    });

    if (!client) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: 'Invalid API key'
      });
    }

    // Rate limiting
    const rateLimit = await RedisCache.checkRateLimit(client.id, 60); // 60 requests per minute
    if (!rateLimit.allowed) {
      return res.status(HTTP_STATUS.RATE_LIMIT_EXCEEDED).json({
        error: 'Rate limit exceeded',
        retryAfter: rateLimit.resetIn
      });
    }

    // Process message
    const result = await conversationService.processMessage(
      client,
      sessionId,
      message.trim(),
      { userIdentifier }
    );

    return res.json({
      response: result.response,
      conversationId: result.conversationId,
      conversationEnded: result.conversationEnded || false,
      metadata: {
        toolsUsed: result.toolsUsed,
        tokensUsed: result.tokensUsed,
        iterations: result.iterations
      }
    });

  } catch (error) {
    console.error('[ChatController] Error processing message:', error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Failed to process message',
      message: error.message
    });
  }
}

/**
 * GET /chat/history/:sessionId
 * Get conversation history for a session (for display in widget)
 */
export async function getHistory(req, res) {
  try {
    const { sessionId } = req.params;
    const client = req.client;

    if (!client) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({ error: 'Invalid API key' });
    }

    // Get conversation by session
    const conversation = await Conversation.findBySession(sessionId);

    if (!conversation) {
      // No conversation yet - return empty array (widget will show empty state with greeting)
      return res.json({
        sessionId,
        messages: [],
        conversationEnded: false
      });
    }

    // Check if conversation has ended
    const conversationEnded = !!conversation.ended_at;

    // Get messages directly from database (not from getConversationContext)
    // This excludes system messages which are only for LLM context
    const messages = await conversationService.getConversationHistory(conversation.id);
    
    // Filter out system and tool messages for display
    const displayMessages = messages
      .filter(msg => {
        const isAllowed = msg.role === 'user' || msg.role === 'assistant';
        if (!isAllowed) {
          console.log('[getHistory] Filtered out message:', { role: msg.role, id: msg.id });
        }
        return isAllowed;
      })
      .map(msg => ({
        role: msg.role,
        content: msg.content,
        created_at: msg.timestamp || msg.created_at
      }));

    return res.json({
      sessionId,
      messages: displayMessages,
      conversationEnded
    });

  } catch (error) {
    console.error('[ChatController] Error getting history:', error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Failed to get conversation history',
      message: error.message
    });
  }
}

/**
 * GET /chat/config
 * Get widget configuration for the authenticated client
 * Returns language preference and widget customization settings
 */
export async function getWidgetConfig(req, res) {
  try {
    const client = req.client;

    if (!client) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({ error: 'Invalid API key' });
    }

    // Return widget configuration including language
    return res.json({
      language: client.language || 'en',
      widgetConfig: client.widget_config || {},
      clientName: client.name
    });

  } catch (error) {
    console.error('[ChatController] Error getting widget config:', error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Failed to get widget configuration',
      message: error.message
    });
  }
}

/**
 * POST /chat/end
 * End a conversation session
 */
export async function endSession(req, res) {
  try {
    const { sessionId } = req.body;
    const client = req.client;

    if (!client) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({ error: 'Invalid API key' });
    }

    if (!sessionId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Session ID is required' });
    }

    await conversationService.endConversation(sessionId);

    return res.json({
      success: true,
      message: 'Conversation ended'
    });

  } catch (error) {
    console.error('[ChatController] Error ending session:', error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Failed to end conversation',
      message: error.message
    });
  }
}
