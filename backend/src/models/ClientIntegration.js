import { db } from '../db.js';

export class ClientIntegration {
    /**
     * Create a new integration for a client
     */
    static async create(clientId, integrationType, connectionConfig) {
        const result = await db.query(
            `INSERT INTO client_integrations (client_id, integration_type, connection_config, enabled)
             VALUES ($1, $2, $3, true)
             RETURNING *`,
            [clientId, integrationType, connectionConfig]
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
     * Update integration config
     */
    static async updateConfig(id, connectionConfig) {
        const result = await db.query(
            `UPDATE client_integrations
             SET connection_config = $2, updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [id, connectionConfig]
        );
        return result.rows[0];
    }

    /**
     * Update last sync test timestamp
     */
    static async updateSyncTest(id, success = true) {
        const result = await db.query(
            `UPDATE client_integrations
             SET last_sync_test = NOW(), updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [id]
        );
        return result.rows[0];
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
