import conversationService from '../services/conversationService.js';
import { Client } from '../models/Client.js';
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

    // Get client from API key (set by auth middleware)
    const client = req.client;

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
 * Get conversation history for a session
 */
export async function getHistory(req, res) {
  try {
    const { sessionId } = req.params;
    const client = req.client;

    if (!client) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    // Get conversation
    const conversation = await conversationService.getConversationContext(
      sessionId,
      client
    );

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    return res.json({
      sessionId,
      messages: conversation
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
