import { db } from '../db.js';

export class Conversation {
    /**
     * Create a new conversation
     */
    static async create(clientId, sessionId, userIdentifier = null, llmProvider = null, modelName = null) {
        const result = await db.query(
            `INSERT INTO conversations (client_id, session_id, user_identifier, llm_provider, model_name)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [clientId, sessionId, userIdentifier, llmProvider, modelName]
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
        const result = await db.query(
            'DELETE FROM conversations WHERE id = $1 RETURNING *',
            [id]
        );
        return result.rows[0];
    }
}
