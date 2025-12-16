import conversationService from '../services/conversationService.js';
import { logger } from '../utils/logger.js';
import { Client } from '../models/Client.js';
import { Conversation } from '../models/Conversation.js';  // Add this import
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

    // Validation
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        error: 'Message is required and must be a non-empty string'
      });
    }

    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({
        error: 'Session ID is required'
      });
    }

    logger.log('[ChatController] Processing message for client', { 
      clientId: client?.id, 
      clientName: client?.name,
      llmProvider: client?.llm_provider || 'ollama',
      modelName: client?.model_name || null
    });

    if (!client) {
      return res.status(401).json({
        error: 'Invalid API key'
      });
    }

    // Rate limiting
    const rateLimit = await RedisCache.checkRateLimit(client.id, 60); // 60 requests per minute
    if (!rateLimit.allowed) {
      return res.status(429).json({
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
    return res.status(500).json({
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
      return res.status(401).json({ error: 'Invalid API key' });
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
    return res.status(500).json({
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
      return res.status(401).json({ error: 'Invalid API key' });
    }

    // Return widget configuration including language
    return res.json({
      language: client.language || 'en',
      widgetConfig: client.widget_config || {},
      clientName: client.name
    });

  } catch (error) {
    console.error('[ChatController] Error getting widget config:', error);
    return res.status(500).json({
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
      return res.status(401).json({ error: 'Invalid API key' });
    }

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    await conversationService.endConversation(sessionId);

    return res.json({
      success: true,
      message: 'Conversation ended'
    });

  } catch (error) {
    console.error('[ChatController] Error ending session:', error);
    return res.status(500).json({
      error: 'Failed to end conversation',
      message: error.message
    });
  }
}
