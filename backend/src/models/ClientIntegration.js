import { db } from '../db.js';

export class ClientIntegration {
    /**
     * Create a new integration for a client
     * @param {number} clientId - Client ID
     * @param {string} integrationType - Integration type key
     * @param {Object} connectionConfig - Connection configuration (API URL, keys, etc.)
     * @param {string} name - Integration name (optional)
     * @param {string} description - Integration description (optional)
     */
    static async create(clientId, integrationType, connectionConfig, name = null, description = null) {
        const integrationName = name || `${integrationType} Integration`;
        const result = await db.query(
            `INSERT INTO client_integrations (client_id, integration_type, name, description, connection_config, enabled, status)
             VALUES ($1, $2, $3, $4, $5, true, 'not_configured')
             RETURNING *`,
            [clientId, integrationType, integrationName, description, connectionConfig]
        );
        return result.rows[0];
    }

    /**
     * Find integration by ID
     */
    static async findById(id) {
        const result = await db.query(
            'SELECT * FROM client_integrations WHERE id = $1',
            [id]
        );
        return result.rows[0] || null;
    }

    /**
     * Get all integrations for a client
     */
    static async getByClient(clientId) {
        const result = await db.query(
            `SELECT * FROM client_integrations
             WHERE client_id = $1
             ORDER BY created_at DESC`,
            [clientId]
        );
        return result.rows;
    }

    /**
     * Get enabled integrations for a client
     */
    static async getEnabledByClient(clientId) {
        const result = await db.query(
            `SELECT * FROM client_integrations
             WHERE client_id = $1 AND enabled = true
             ORDER BY created_at DESC`,
            [clientId]
        );
        return result.rows;
    }

    /**
     * Get integrations by type
     */
    static async getByType(integrationType) {
        const result = await db.query(
            `SELECT * FROM client_integrations
             WHERE integration_type = $1 AND enabled = true`,
            [integrationType]
        );
        return result.rows;
    }

    /**
     * Find integration by client and type
     */
    static async findByClientAndType(clientId, integrationType) {
        const result = await db.query(
            `SELECT * FROM client_integrations
             WHERE client_id = $1 AND LOWER(integration_type) = LOWER($2) AND enabled = true
             LIMIT 1`,
            [clientId, integrationType]
        );
        return result.rows[0] || null;
    }

    /**
     * Update integration
     */
    static async update(id, updates) {
        const allowedFields = ['name', 'description', 'connection_config', 'api_schema', 'test_config', 'status', 'enabled'];
        const fields = [];
        const values = [];
        let paramIndex = 1;

        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
                // For JSONB fields, ensure proper formatting
                if (['api_schema', 'test_config'].includes(key) && value !== null) {
                    fields.push(`${key} = $${paramIndex}::jsonb`);
                    values.push(typeof value === 'string' ? value : JSON.stringify(value));
                } else {
                    fields.push(`${key} = $${paramIndex}`);
                    values.push(value);
                }
                paramIndex++;
            }
        }

        if (fields.length === 0) {
            throw new Error('No valid fields to update');
        }

        fields.push(`updated_at = NOW()`);
        values.push(id);

        const query = `
            UPDATE client_integrations
            SET ${fields.join(', ')}
            WHERE id = $${paramIndex}
            RETURNING *
        `;

        const result = await db.query(query, values);
        return result.rows[0];
    }

    /**
     * Update integration config (legacy method, use update() instead)
     */
    static async updateConfig(id, connectionConfig) {
        return this.update(id, { connection_config: connectionConfig });
    }

    /**
     * Update last sync test timestamp and result
     */
    static async updateTestResult(id, testResult) {
        const formattedResult = typeof testResult === 'string' ? testResult : JSON.stringify(testResult);
        const newStatus = testResult.success ? 'active' : 'error';

        const result = await db.query(
            `UPDATE client_integrations
             SET last_sync_test = NOW(),
                 last_test_result = $2::jsonb,
                 status = $3,
                 updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [id, formattedResult, newStatus]
        );
        return result.rows[0];
    }

    /**
     * Update last sync test timestamp (legacy method)
     */
    static async updateSyncTest(id, success = true) {
        return this.updateTestResult(id, { success, timestamp: new Date().toISOString() });
    }

    /**
     * Enable/disable integration
     */
    static async setEnabled(id, enabled) {
        const result = await db.query(
            `UPDATE client_integrations
             SET enabled = $2, updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [id, enabled]
        );
        return result.rows[0];
    }

    /**
     * Delete integration (cascades to endpoints)
     */
    static async delete(id) {
        const result = await db.query(
            'DELETE FROM client_integrations WHERE id = $1 RETURNING *',
            [id]
        );
        return result.rows[0];
    }
}
