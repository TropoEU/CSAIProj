import { db } from '../db.js';

export class Conversation {
    /**
     * Create a new conversation
     */
    static async create(clientId, sessionId, userIdentifier = null) {
        const result = await db.query(
            `INSERT INTO conversations (client_id, session_id, user_identifier)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [clientId, sessionId, userIdentifier]
        );
        return result.rows[0];
    }

    /**
     * Find conversation by ID
     */
    static async findById(id) {
        const result = await db.query(
            'SELECT * FROM conversations WHERE id = $1',
            [id]
        );
        return result.rows[0] || null;
    }

    /**
     * Find conversation by session ID
     */
    static async findBySession(sessionId) {
        const result = await db.query(
            'SELECT * FROM conversations WHERE session_id = $1',
            [sessionId]
        );
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
        const result = await db.query(
            `UPDATE conversations
             SET message_count = $2, tokens_total = $3
             WHERE id = $1
             RETURNING *`,
            [id, messageCount, tokensTotal]
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
        const result = await db.query(
            'DELETE FROM conversations WHERE id = $1 RETURNING *',
            [id]
        );
        return result.rows[0];
    }
}
