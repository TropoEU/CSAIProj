import { db } from '../db.js';

export class Message {
  /**
   * Create a new message
   * @param {number} conversationId - The conversation ID
   * @param {string} role - The role (user, assistant, system, tool)
   * @param {string} content - The message content
   * @param {number} tokensUsed - Number of tokens used
   * @param {string} externalMessageId - External message ID (Gmail message ID, etc.)
   * @param {object} channelMetadata - Channel-specific metadata
   */
  static async create(
    conversationId,
    role,
    content,
    tokensUsed = 0,
    externalMessageId = null,
    channelMetadata = null
  ) {
    const result = await db.query(
      `INSERT INTO messages (conversation_id, role, content, tokens_used, external_message_id, channel_metadata)
             VALUES ($1, $2, $3, $4, $5, $6::jsonb)
             RETURNING *`,
      [
        conversationId,
        role,
        content,
        tokensUsed,
        externalMessageId,
        channelMetadata ? JSON.stringify(channelMetadata) : null,
      ]
    );
    return result.rows[0];
  }

  /**
   * Create a debug/internal message for full conversation tracking
   * @param {number} conversationId - The conversation ID
   * @param {string} role - The role (user, assistant, system, tool)
   * @param {string} content - The message content
   * @param {string} messageType - Type: visible, system, tool_call, tool_result, internal
   * @param {object} options - Additional options
   * @param {number} options.tokensUsed - Tokens used
   * @param {string} options.toolCallId - Tool call ID for matching
   * @param {object} options.metadata - Additional metadata (tool_calls array, etc.)
   * @param {string} options.reasonCode - Structured reason code for analytics
   */
  static async createDebug(conversationId, role, content, messageType = 'visible', options = {}) {
    const { tokensUsed = 0, toolCallId = null, metadata = null, reasonCode = null } = options;
    const result = await db.query(
      `INSERT INTO messages (conversation_id, role, content, tokens_used, message_type, tool_call_id, metadata, reason_code)
             VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
             RETURNING *`,
      [
        conversationId,
        role,
        content,
        tokensUsed,
        messageType,
        toolCallId,
        metadata ? JSON.stringify(metadata) : null,
        reasonCode,
      ]
    );
    return result.rows[0];
  }

  /**
   * Get all messages for a conversation including debug messages
   * @param {number} conversationId - The conversation ID
   * @param {boolean} includeDebug - Include debug/internal messages
   */
  static async getAllWithDebug(conversationId, includeDebug = true) {
    const query = includeDebug
      ? 'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY timestamp ASC'
      : "SELECT * FROM messages WHERE conversation_id = $1 AND (message_type IS NULL OR message_type = 'visible') ORDER BY timestamp ASC";

    const result = await db.query(query, [conversationId]);
    return result.rows;
  }

  /**
   * Find message by external ID
   */
  static async findByExternalId(externalMessageId) {
    const result = await db.query('SELECT * FROM messages WHERE external_message_id = $1', [
      externalMessageId,
    ]);
    return result.rows[0] || null;
  }

  /**
   * Get recent visible messages for a conversation (for context loading)
   * Excludes debug messages to prevent them from being sent to LLM
   */
  static async getRecent(conversationId, limit = 20) {
    const result = await db.query(
      `SELECT * FROM messages
             WHERE conversation_id = $1
               AND (message_type IS NULL OR message_type = 'visible')
             ORDER BY timestamp DESC
             LIMIT $2`,
      [conversationId, limit]
    );
    return result.rows.reverse(); // Return in chronological order
  }

  /**
   * Get all visible messages for a conversation (excludes debug messages)
   */
  static async getAll(conversationId) {
    const result = await db.query(
      `SELECT * FROM messages
             WHERE conversation_id = $1
               AND (message_type IS NULL OR message_type = 'visible')
             ORDER BY timestamp ASC`,
      [conversationId]
    );
    return result.rows;
  }

  /**
   * Get total tokens used in a conversation
   */
  static async getTotalTokens(conversationId) {
    const result = await db.query(
      `SELECT SUM(tokens_used) as total_tokens
             FROM messages
             WHERE conversation_id = $1`,
      [conversationId]
    );
    return parseInt(result.rows[0].total_tokens, 10) || 0;
  }

  /**
   * Delete messages older than N days (for retention policy)
   */
  static async deleteOlderThan(days) {
    // Validate days is a positive integer to prevent injection
    const safeDays = Math.max(1, Math.floor(Number(days) || 30));
    const result = await db.query(
      `DELETE FROM messages
             WHERE timestamp < NOW() - INTERVAL '1 day' * $1
             RETURNING id`,
      [safeDays]
    );
    return result.rowCount;
  }

  /**
   * Get messages older than N days (for aggregation before deletion)
   */
  static async getOlderThan(days) {
    // Validate days is a positive integer to prevent injection
    const safeDays = Math.max(1, Math.floor(Number(days) || 30));
    const result = await db.query(
      `SELECT conversation_id, SUM(tokens_used) as total_tokens, COUNT(*) as message_count
             FROM messages
             WHERE timestamp < NOW() - INTERVAL '1 day' * $1
             GROUP BY conversation_id`,
      [safeDays]
    );
    return result.rows;
  }

  /**
   * Count messages in a conversation
   */
  static async count(conversationId) {
    const result = await db.query(
      'SELECT COUNT(*) as count FROM messages WHERE conversation_id = $1',
      [conversationId]
    );
    return parseInt(result.rows[0].count, 10);
  }
}
