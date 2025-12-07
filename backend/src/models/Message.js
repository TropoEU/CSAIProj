import { db } from '../db.js';

export class Message {
    /**
     * Create a new message
     */
    static async create(conversationId, role, content, tokensUsed = 0) {
        const result = await db.query(
            `INSERT INTO messages (conversation_id, role, content, tokens_used)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [conversationId, role, content, tokensUsed]
        );
        return result.rows[0];
    }

    /**
     * Get recent messages for a conversation (for context loading)
     */
    static async getRecent(conversationId, limit = 20) {
        const result = await db.query(
            `SELECT * FROM messages
             WHERE conversation_id = $1
             ORDER BY timestamp DESC
             LIMIT $2`,
            [conversationId, limit]
        );
        return result.rows.reverse(); // Return in chronological order
    }

    /**
     * Get all messages for a conversation
     */
    static async getAll(conversationId) {
        const result = await db.query(
            `SELECT * FROM messages
             WHERE conversation_id = $1
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
        return parseInt(result.rows[0].total_tokens) || 0;
    }

    /**
     * Delete messages older than N days (for retention policy)
     */
    static async deleteOlderThan(days) {
        const result = await db.query(
            `DELETE FROM messages
             WHERE timestamp < NOW() - INTERVAL '${days} days'
             RETURNING id`,
        );
        return result.rowCount;
    }

    /**
     * Get messages older than N days (for aggregation before deletion)
     */
    static async getOlderThan(days) {
        const result = await db.query(
            `SELECT conversation_id, SUM(tokens_used) as total_tokens, COUNT(*) as message_count
             FROM messages
             WHERE timestamp < NOW() - INTERVAL '${days} days'
             GROUP BY conversation_id`,
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
        return parseInt(result.rows[0].count);
    }
}
