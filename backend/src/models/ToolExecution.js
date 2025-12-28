import { db } from '../db.js';

export class ToolExecution {
    /**
     * Log a tool execution
     */
    static async create(conversationId, toolName, parameters, n8nResponse, success, executionTimeMs) {
        const result = await db.query(
            `INSERT INTO tool_executions (conversation_id, tool_name, parameters, n8n_response, success, execution_time_ms)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [conversationId, toolName, parameters, n8nResponse, success, executionTimeMs]
        );
        return result.rows[0];
    }

    /**
     * Get all executions for a conversation
     */
    static async getByConversation(conversationId) {
        const result = await db.query(
            `SELECT * FROM tool_executions
             WHERE conversation_id = $1
             ORDER BY timestamp ASC`,
            [conversationId]
        );
        return result.rows;
    }

    /**
     * Get failed executions (for debugging)
     */
    static async getFailedExecutions(limit = 100) {
        const result = await db.query(
            `SELECT * FROM tool_executions
             WHERE success = false
             ORDER BY timestamp DESC
             LIMIT $1`,
            [limit]
        );
        return result.rows;
    }

    /**
     * Get executions by tool name (for analytics)
     */
    static async getByToolName(toolName, limit = 100) {
        const result = await db.query(
            `SELECT * FROM tool_executions
             WHERE tool_name = $1
             ORDER BY timestamp DESC
             LIMIT $2`,
            [toolName, limit]
        );
        return result.rows;
    }

    /**
     * Get tool usage statistics
     */
    static async getToolStats(startDate = null, endDate = null) {
        let query = `
            SELECT
                tool_name,
                COUNT(*) as total_executions,
                SUM(CASE WHEN success = true THEN 1 ELSE 0 END) as successful,
                SUM(CASE WHEN success = false THEN 1 ELSE 0 END) as failed,
                AVG(execution_time_ms) as avg_execution_time
            FROM tool_executions
        `;

        const params = [];
        if (startDate && endDate) {
            query += ' WHERE timestamp BETWEEN $1 AND $2';
            params.push(startDate, endDate);
        }

        query += ' GROUP BY tool_name ORDER BY total_executions DESC';

        const result = await db.query(query, params);
        return result.rows;
    }

    /**
     * Delete executions older than N days (for retention policy)
     */
    static async deleteOlderThan(days) {
        // Validate days is a positive integer to prevent injection
        const safeDays = Math.max(1, Math.floor(Number(days) || 30));
        const result = await db.query(
            `DELETE FROM tool_executions
             WHERE timestamp < NOW() - INTERVAL '1 day' * $1
             RETURNING id`,
            [safeDays]
        );
        return result.rowCount;
    }

    /**
     * Get recent executions (for monitoring)
     */
    static async getRecent(limit = 50) {
        const result = await db.query(
            `SELECT * FROM tool_executions
             ORDER BY timestamp DESC
             LIMIT $1`,
            [limit]
        );
        return result.rows;
    }

    /**
     * Get slowest tool executions (performance monitoring)
     */
    static async getSlowest(limit = 20) {
        const result = await db.query(
            `SELECT * FROM tool_executions
             ORDER BY execution_time_ms DESC
             LIMIT $1`,
            [limit]
        );
        return result.rows;
    }
}
