import { db } from '../db.js';

export class Escalation {
  /**
   * Create a new escalation
   * @param {number} conversationId - Conversation ID
   * @param {number} clientId - Client ID
   * @param {string} reason - Escalation reason
   * @param {number} triggerMessageId - Optional message that triggered escalation
   * @param {object} additionalData - Additional escalation data
   */
  static async create(conversationId, clientId, reason, triggerMessageId = null, additionalData = {}) {
    const query = `
      INSERT INTO escalations (
        conversation_id,
        client_id,
        reason,
        trigger_message_id,
        assigned_to,
        notes
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const result = await db.query(query, [
      conversationId,
      clientId,
      reason,
      triggerMessageId,
      additionalData.assigned_to || null,
      additionalData.notes || null
    ]);

    return result.rows[0];
  }

  /**
   * Find escalation by ID
   */
  static async findById(id) {
    const result = await db.query(
      'SELECT * FROM escalations WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Find escalation by conversation ID
   */
  static async findByConversation(conversationId) {
    const result = await db.query(
      `SELECT * FROM escalations
       WHERE conversation_id = $1
       ORDER BY escalated_at DESC
       LIMIT 1`,
      [conversationId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get all escalations for a client
   * @param {number} clientId - Client ID
   * @param {object} filters - Optional filters (status, limit, offset)
   */
  static async getByClient(clientId, filters = {}) {
    const { status, limit = 50, offset = 0 } = filters;

    let query = `
      SELECT
        e.*,
        c.session_id,
        CASE WHEN c.ended_at IS NULL THEN 'active' ELSE 'ended' END as conversation_status,
        cl.name as client_name
      FROM escalations e
      JOIN conversations c ON e.conversation_id = c.id
      JOIN clients cl ON e.client_id = cl.id
      WHERE e.client_id = $1
    `;

    const params = [clientId];
    let paramIndex = 2;

    if (status) {
      query += ` AND e.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY e.escalated_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Get all pending escalations (across all clients)
   */
  static async getPending(limit = 50, offset = 0) {
    const query = `
      SELECT
        e.*,
        c.session_id,
        CASE WHEN c.ended_at IS NULL THEN 'active' ELSE 'ended' END as conversation_status,
        cl.name as client_name
      FROM escalations e
      JOIN conversations c ON e.conversation_id = c.id
      JOIN clients cl ON e.client_id = cl.id
      WHERE e.status = 'pending'
      ORDER BY e.escalated_at DESC
      LIMIT $1 OFFSET $2
    `;

    const result = await db.query(query, [parseInt(limit), parseInt(offset)]);
    return result.rows;
  }

  /**
   * Update escalation status
   * @param {number} id - Escalation ID
   * @param {string} status - New status (acknowledged, resolved, cancelled)
   * @param {object} updates - Additional fields to update
   */
  static async updateStatus(id, status, updates = {}) {
    const fields = ['status = $1', 'updated_at = NOW()'];
    const values = [status];
    let paramIndex = 2;

    // Add timestamp based on status
    if (status === 'acknowledged' && !updates.acknowledged_at) {
      fields.push('acknowledged_at = NOW()');
    } else if (status === 'resolved' && !updates.resolved_at) {
      fields.push('resolved_at = NOW()');
    }

    // Add optional fields
    if (updates.assigned_to !== undefined) {
      fields.push(`assigned_to = $${paramIndex}`);
      values.push(updates.assigned_to);
      paramIndex++;
    }

    if (updates.notes !== undefined) {
      fields.push(`notes = $${paramIndex}`);
      values.push(updates.notes);
      paramIndex++;
    }

    if (updates.acknowledged_at !== undefined) {
      fields.push(`acknowledged_at = $${paramIndex}`);
      values.push(updates.acknowledged_at);
      paramIndex++;
    }

    if (updates.resolved_at !== undefined) {
      fields.push(`resolved_at = $${paramIndex}`);
      values.push(updates.resolved_at);
      paramIndex++;
    }

    values.push(id);

    const query = `
      UPDATE escalations
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Get escalation statistics for a client
   */
  static async getStats(clientId) {
    const query = `
      SELECT
        COUNT(*) as total_escalations,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN status = 'acknowledged' THEN 1 END) as acknowledged_count,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_count,
        COUNT(CASE WHEN reason = 'user_requested' THEN 1 END) as user_requested_count,
        COUNT(CASE WHEN reason = 'ai_stuck' THEN 1 END) as ai_stuck_count,
        COUNT(CASE WHEN reason = 'low_confidence' THEN 1 END) as low_confidence_count,
        AVG(EXTRACT(EPOCH FROM (COALESCE(resolved_at, NOW()) - escalated_at))) as avg_resolution_time_seconds
      FROM escalations
      WHERE client_id = $1
    `;

    const result = await db.query(query, [clientId]);
    return result.rows[0];
  }

  /**
   * Delete escalation
   */
  static async delete(id) {
    const result = await db.query(
      'DELETE FROM escalations WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  }

  /**
   * Check if conversation has active escalation
   */
  static async hasActiveEscalation(conversationId) {
    const result = await db.query(
      `SELECT COUNT(*) as count
       FROM escalations
       WHERE conversation_id = $1
       AND status IN ('pending', 'acknowledged')`,
      [conversationId]
    );
    return parseInt(result.rows[0].count) > 0;
  }
}
