import { db } from '../db.js';
import crypto from 'crypto';

export class Client {
    /**
     * Generate a unique API key for a client
     */
    static generateApiKey() {
        return crypto.randomBytes(32).toString('hex');
    }

    /**
     * Create a new client
     * @param {string} name - Client business name
     * @param {string} domain - Client website domain
     * @param {string} planType - Plan type (free, starter, pro)
     */
    static async create(name, domain, planType = 'free') {
        const apiKey = this.generateApiKey();
        const result = await db.query(
            `INSERT INTO clients (name, domain, api_key, plan_type, status)
             VALUES ($1, $2, $3, $4, 'active')
             RETURNING *`,
            [name, domain, apiKey, planType]
        );
        return result.rows[0];
    }

    /**
     * Find client by ID
     */
    static async findById(id) {
        const result = await db.query(
            'SELECT * FROM clients WHERE id = $1',
            [id]
        );
        return result.rows[0] || null;
    }

    /**
     * Find client by API key (for authentication)
     */
    static async findByApiKey(apiKey) {
        const result = await db.query(
            'SELECT * FROM clients WHERE api_key = $1 AND status = $2',
            [apiKey, 'active']
        );
        return result.rows[0] || null;
    }

    /**
     * Get all clients
     */
    static async findAll(limit = 100, offset = 0) {
        const result = await db.query(
            'SELECT * FROM clients ORDER BY created_at DESC LIMIT $1 OFFSET $2',
            [limit, offset]
        );
        return result.rows;
    }

    /**
     * Update client
     */
    static async update(id, updates) {
        const allowedFields = ['name', 'domain', 'plan_type', 'status'];
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

        fields.push(`updated_at = NOW()`);
        values.push(id);

        const query = `
            UPDATE clients
            SET ${fields.join(', ')}
            WHERE id = $${paramIndex}
            RETURNING *
        `;

        const result = await db.query(query, values);
        return result.rows[0];
    }

    /**
     * Delete client (soft delete by setting status to inactive)
     */
    static async deactivate(id) {
        const result = await db.query(
            `UPDATE clients SET status = 'inactive', updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [id]
        );
        return result.rows[0];
    }

    /**
     * Hard delete client (cascades to all related data)
     */
    static async delete(id) {
        const result = await db.query(
            'DELETE FROM clients WHERE id = $1 RETURNING *',
            [id]
        );
        return result.rows[0];
    }

    /**
     * Regenerate API key for a client
     */
    static async regenerateApiKey(id) {
        const newApiKey = this.generateApiKey();
        const result = await db.query(
            `UPDATE clients SET api_key = $1, updated_at = NOW()
             WHERE id = $2
             RETURNING *`,
            [newApiKey, id]
        );
        return result.rows[0];
    }

    /**
     * Get client count by plan type
     */
    static async getCountByPlan() {
        const result = await db.query(
            `SELECT plan_type, COUNT(*) as count
             FROM clients
             WHERE status = 'active'
             GROUP BY plan_type`
        );
        return result.rows;
    }
}
