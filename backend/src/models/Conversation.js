import { db } from '../db.js';

export class Conversation {
  /**
   * Create a new conversation
   * @param {number} clientId - The client ID
   * @param {string} sessionId - The session ID
   * @param {string} userIdentifier - Optional user identifier
   * @param {string} llmProvider - Optional LLM provider
   * @param {string} modelName - Optional model name
   * @param {string} channel - Channel type (widget, email, whatsapp)
   * @param {string} channelThreadId - Channel-specific thread ID
   * @param {object} channelMetadata - Channel-specific metadata
   */
  static async create(
    clientId,
    sessionId,
    userIdentifier = null,
    llmProvider = null,
    modelName = null,
    channel = 'widget',
    channelThreadId = null,
    channelMetadata = null
  ) {
    const result = await db.query(
      `INSERT INTO conversations (client_id, session_id, user_identifier, llm_provider, model_name, channel, channel_thread_id, channel_metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
             RETURNING *`,
      [
        clientId,
        sessionId,
        userIdentifier,
        llmProvider,
        modelName,
        channel,
        channelThreadId,
        channelMetadata ? JSON.stringify(channelMetadata) : null,
      ]
    );
    return result.rows[0];
  }

  /**
   * Find conversation by ID
   */
  static async findById(id) {
    const result = await db.query('SELECT * FROM conversations WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  /**
   * Find conversation by session ID
   */
  static async findBySession(sessionId) {
    const result = await db.query('SELECT * FROM conversations WHERE session_id = $1', [sessionId]);
    return result.rows[0] || null;
  }

  /**
   * Find conversation by channel thread ID
   * @param {string} channelThreadId - The channel-specific thread ID (Gmail thread ID, etc.)
   * @param {string} channel - The channel type (email, whatsapp)
   * @param {number} clientId - Optional client ID to filter by
   */
  static async findByChannelThread(channelThreadId, channel, clientId = null) {
    let query = 'SELECT * FROM conversations WHERE channel_thread_id = $1 AND channel = $2';
    const params = [channelThreadId, channel];

    if (clientId) {
      query += ' AND client_id = $3';
      params.push(clientId);
    }

    query += ' ORDER BY started_at DESC LIMIT 1';

    const result = await db.query(query, params);
    return result.rows[0] || null;
  }

  /**
   * Find active conversation by channel thread ID (not ended)
   */
  static async findActiveByChannelThread(channelThreadId, channel, clientId = null) {
    let query =
      'SELECT * FROM conversations WHERE channel_thread_id = $1 AND channel = $2 AND ended_at IS NULL';
    const params = [channelThreadId, channel];

    if (clientId) {
      query += ' AND client_id = $3';
      params.push(clientId);
    }

    query += ' ORDER BY started_at DESC LIMIT 1';

    const result = await db.query(query, params);
    return result.rows[0] || null;
  }

  /**
   * Find all conversations for a client
   */
  static async findByClient(clientId, limit = 100, offset = 0) {
    const result = await db.query(
      `SELECT * FROM conversations
             WHERE client_id = $1
             ORDER BY started_at DESC
             LIMIT $2 OFFSET $3`,
      [clientId, limit, offset]
    );
    return result.rows;
  }

  /**
   * Find active (not ended) conversations
   */
  static async findActive(clientId) {
    const result = await db.query(
      `SELECT * FROM conversations
             WHERE client_id = $1 AND ended_at IS NULL
             ORDER BY started_at DESC`,
      [clientId]
    );
    return result.rows;
  }

  /**
   * Find active conversations that have been inactive for more than X minutes
   * Returns conversations with their last message timestamp
   */
  static async findInactive(inactivityMinutes = 15) {
    // Calculate the cutoff timestamp (now - inactivity minutes)
    const cutoffTime = new Date(Date.now() - inactivityMinutes * 60 * 1000);

    const result = await db.query(
      `SELECT c.*, 
                    COALESCE(MAX(m.timestamp), c.started_at) as last_activity
             FROM conversations c
             LEFT JOIN messages m ON c.id = m.conversation_id
             WHERE c.ended_at IS NULL
             GROUP BY c.id
             HAVING COALESCE(MAX(m.timestamp), c.started_at) < $1
             ORDER BY last_activity ASC`,
      [cutoffTime]
    );
    return result.rows;
  }

  /**
   * End a conversation
   */
  static async end(id) {
    const result = await db.query(
      `UPDATE conversations
             SET ended_at = NOW()
             WHERE id = $1
             RETURNING *`,
      [id]
    );
    return result.rows[0];
  }

  /**
   * Update message count and token total
   */
  static async updateStats(id, messageCount, tokensTotal) {
    const updates = [];
    const params = [id];
    let paramIndex = 2;

    if (messageCount !== null && messageCount !== undefined) {
      updates.push(`message_count = $${paramIndex}`);
      params.push(messageCount);
      paramIndex++;
    }

    if (tokensTotal !== null && tokensTotal !== undefined) {
      updates.push(`tokens_total = $${paramIndex}`);
      params.push(tokensTotal);
      paramIndex++;
    }

    if (updates.length === 0) {
      // No updates to make
      return await this.findById(id);
    }

    const result = await db.query(
      `UPDATE conversations
             SET ${updates.join(', ')}
             WHERE id = $1
             RETURNING *`,
      params
    );
    return result.rows[0];
  }

  /**
   * Increment message count and add tokens
   */
  static async incrementStats(id, tokensToAdd) {
    const result = await db.query(
      `UPDATE conversations
             SET message_count = message_count + 1,
                 tokens_total = tokens_total + $2
             WHERE id = $1
             RETURNING *`,
      [id, tokensToAdd]
    );
    return result.rows[0];
  }

  /**
   * Delete conversation (cascades to messages)
   */
  static async delete(id) {
    const result = await db.query('DELETE FROM conversations WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  }
}
