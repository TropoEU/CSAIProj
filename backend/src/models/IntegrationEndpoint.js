import { db } from '../db.js';

export class IntegrationEndpoint {
  /**
   * Create a new endpoint for an integration
   */
  static async create(
    integrationId,
    endpointName,
    endpointUrl,
    method = 'GET',
    description = null
  ) {
    const result = await db.query(
      `INSERT INTO integration_endpoints (integration_id, endpoint_name, endpoint_url, method, description)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
      [integrationId, endpointName, endpointUrl, method, description]
    );
    return result.rows[0];
  }

  /**
   * Get all endpoints for an integration
   */
  static async getByIntegration(integrationId) {
    const result = await db.query(
      `SELECT * FROM integration_endpoints
             WHERE integration_id = $1
             ORDER BY endpoint_name`,
      [integrationId]
    );
    return result.rows;
  }

  /**
   * Find endpoint by name within an integration
   */
  static async findByName(integrationId, endpointName) {
    const result = await db.query(
      `SELECT * FROM integration_endpoints
             WHERE integration_id = $1 AND endpoint_name = $2`,
      [integrationId, endpointName]
    );
    return result.rows[0] || null;
  }

  /**
   * Find endpoint by ID
   */
  static async findById(id) {
    const result = await db.query('SELECT * FROM integration_endpoints WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  /**
   * Update endpoint
   */
  static async update(id, updates) {
    const allowedFields = ['endpoint_url', 'method', 'description'];
    const fields = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(id);
    const query = `
            UPDATE integration_endpoints
            SET ${fields.join(', ')}
            WHERE id = $${paramIndex}
            RETURNING *
        `;

    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Delete endpoint
   */
  static async delete(id) {
    const result = await db.query('DELETE FROM integration_endpoints WHERE id = $1 RETURNING *', [
      id,
    ]);
    return result.rows[0];
  }
}
