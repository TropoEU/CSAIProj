import { db } from '../db.js';

// Tool execution status constants
export const TOOL_STATUS = {
  SUCCESS: 'success',
  FAILED: 'failed',
  BLOCKED: 'blocked',
  DUPLICATE: 'duplicate',
};

export class ToolExecution {
  /**
   * Log a tool execution with status
   */
  static async create(
    conversationId,
    toolName,
    parameters,
    n8nResponse,
    success,
    executionTimeMs,
    status = null,
    errorReason = null
  ) {
    // Determine status if not provided
    const finalStatus = status || (success ? TOOL_STATUS.SUCCESS : TOOL_STATUS.FAILED);

    const result = await db.query(
      `INSERT INTO tool_executions (conversation_id, tool_name, parameters, n8n_response, success, execution_time_ms, status, error_reason)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
      [
        conversationId,
        toolName,
        parameters,
        n8nResponse,
        success,
        executionTimeMs,
        finalStatus,
        errorReason,
      ]
    );
    return result.rows[0];
  }

  /**
   * Log a blocked tool execution (placeholder values, missing params, etc.)
   */
  static async logBlocked(conversationId, toolName, parameters, reason) {
    return this.create(
      conversationId,
      toolName,
      parameters,
      { blocked: true, reason },
      false,
      0,
      TOOL_STATUS.BLOCKED,
      reason
    );
  }

  /**
   * Log a duplicate tool execution attempt
   */
  static async logDuplicate(conversationId, toolName, parameters) {
    return this.create(
      conversationId,
      toolName,
      parameters,
      { duplicate: true },
      false,
      0,
      TOOL_STATUS.DUPLICATE,
      'Duplicate execution - same tool with same parameters already executed successfully'
    );
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
   * Get tool usage statistics with status breakdown
   */
  static async getToolStats(startDate = null, endDate = null) {
    let query = `
            SELECT
                tool_name,
                COUNT(*) as total_executions,
                SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
                SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) as blocked,
                SUM(CASE WHEN status = 'duplicate' THEN 1 ELSE 0 END) as duplicate,
                AVG(CASE WHEN status = 'success' THEN execution_time_ms END) as avg_execution_time
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
   * Get executions by status (for monitoring blocked/duplicate calls)
   */
  static async getByStatus(status, limit = 100) {
    const result = await db.query(
      `SELECT * FROM tool_executions
             WHERE status = $1
             ORDER BY timestamp DESC
             LIMIT $2`,
      [status, limit]
    );
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

  /**
   * Check if a tool was already executed successfully with the same parameters in this conversation
   * Used to prevent duplicate tool calls across conversation turns
   */
  static async isDuplicateExecution(conversationId, toolName, parameters) {
    // Normalize parameters to JSON string for JSONB comparison
    const normalizedParams =
      typeof parameters === 'string' ? parameters : JSON.stringify(parameters);

    // Use JSONB equality operator (=) which compares semantically, not textually
    // This handles different key orderings correctly
    const result = await db.query(
      `SELECT id FROM tool_executions
             WHERE conversation_id = $1
             AND tool_name = $2
             AND parameters = $3::jsonb
             AND success = true
             LIMIT 1`,
      [conversationId, toolName, normalizedParams]
    );
    return result.rows.length > 0;
  }
}
