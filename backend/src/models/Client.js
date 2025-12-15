import { db } from '../db.js';
import crypto from 'crypto';

export class Client {
    /**
     * Generate a unique API key for a client with csai_ prefix
     */
    static generateApiKey() {
        const randomHex = crypto.randomBytes(32).toString('hex');
        return `csai_${randomHex}`;
    }

    /**
     * Create a new client
     * @param {string} name - Client business name
     * @param {string} domain - Client website domain
     * @param {string} planType - Plan type (free, starter, pro)
     * @param {string} email - Client email
     * @param {string} llmProvider - LLM provider (ollama, claude, openai)
     * @param {string} modelName - Model name
     * @param {string} systemPrompt - Custom system prompt
     * @param {string} status - Client status (active, inactive)
     * @param {object} widgetConfig - Widget customization settings
     */
    static async create(name, domain, planType = 'free', email = null, llmProvider = 'ollama', modelName = null, systemPrompt = null, status = 'active', widgetConfig = null) {
        const apiKey = this.generateApiKey();
        const query = widgetConfig
            ? `INSERT INTO clients (name, domain, api_key, plan_type, email, llm_provider, model_name, system_prompt, status, widget_config)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
               RETURNING *`
            : `INSERT INTO clients (name, domain, api_key, plan_type, email, llm_provider, model_name, system_prompt, status)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
               RETURNING *`;
        const params = widgetConfig
            ? [name, domain, apiKey, planType, email, llmProvider, modelName, systemPrompt, status, JSON.stringify(widgetConfig)]
            : [name, domain, apiKey, planType, email, llmProvider, modelName, systemPrompt, status];

        const result = await db.query(query, params);
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
     * Find client by access code (for customer portal authentication)
     */
    static async findByAccessCode(accessCode) {
        const result = await db.query(
            'SELECT * FROM clients WHERE access_code = $1',
            [accessCode]
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
        const allowedFields = ['name', 'domain', 'plan_type', 'status', 'email', 'llm_provider', 'model_name', 'system_prompt', 'widget_config'];
        const fields = [];
        const values = [];
        let paramIndex = 1;

        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
                // Handle widget_config as JSONB
                if (key === 'widget_config' && value !== null && typeof value === 'object') {
                    fields.push(`${key} = $${paramIndex}::jsonb`);
                    values.push(JSON.stringify(value));
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

    /**
     * Generate a unique access code for customer dashboard (format: ABC123)
     */
    static generateAccessCode() {
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const digits = '0123456789';

        let code = '';
        // 3 random uppercase letters
        for (let i = 0; i < 3; i++) {
            code += letters.charAt(Math.floor(Math.random() * letters.length));
        }
        // 3 random digits
        for (let i = 0; i < 3; i++) {
            code += digits.charAt(Math.floor(Math.random() * digits.length));
        }

        return code;
    }

    /**
     * Regenerate access code for a client
     */
    static async regenerateAccessCode(id) {
        let attempts = 0;
        const maxAttempts = 10;

        while (attempts < maxAttempts) {
            try {
                const newAccessCode = this.generateAccessCode();
                const result = await db.query(
                    `UPDATE clients SET access_code = $1, updated_at = NOW()
                     WHERE id = $2
                     RETURNING *`,
                    [newAccessCode, id]
                );
                return result.rows[0];
            } catch (error) {
                // If unique constraint violation, try again with new code
                if (error.code === '23505') { // Unique violation
                    attempts++;
                    continue;
                }
                throw error;
            }
        }

        throw new Error('Failed to generate unique access code after multiple attempts');
    }

    /**
     * Find client by access code (for customer dashboard login)
     */
    static async findByAccessCode(accessCode) {
        const result = await db.query(
            'SELECT * FROM clients WHERE access_code = $1 AND status = $2',
            [accessCode, 'active']
        );
        return result.rows[0] || null;
    }
}
