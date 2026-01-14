import { db } from '../db.js';

export class ClientTool {
    /**
     * Enable a tool for a client with integration mapping
     * @param {number} clientId - Client ID
     * @param {number} toolId - Tool ID
     * @param {string} n8nWebhookUrl - n8n webhook URL
     * @param {Object} integrationMapping - Maps integration keys to client_integration IDs
     *   Example: {"order_api": 5, "email_api": 8}
     * @param {Object} customConfig - Additional custom configuration (optional)
     */
    static async enable(clientId, toolId, n8nWebhookUrl, integrationMapping = null, customConfig = null) {
        const formattedMapping = integrationMapping
            ? (typeof integrationMapping === 'string' ? integrationMapping : JSON.stringify(integrationMapping))
            : '{}';

        const result = await db.query(
            `INSERT INTO client_tools (client_id, tool_id, enabled, n8n_webhook_url, integration_mapping, custom_config)
             VALUES ($1, $2, true, $3, $4::jsonb, $5)
             ON CONFLICT (client_id, tool_id)
             DO UPDATE SET enabled = true, n8n_webhook_url = $3, integration_mapping = $4::jsonb, custom_config = $5, updated_at = NOW()
             RETURNING *`,
            [clientId, toolId, n8nWebhookUrl, formattedMapping, customConfig]
        );
        return result.rows[0];
    }

    /**
     * Disable a tool for a client
     */
    static async disable(clientId, toolId) {
        const result = await db.query(
            `UPDATE client_tools
             SET enabled = false, updated_at = NOW()
             WHERE client_id = $1 AND tool_id = $2
             RETURNING *`,
            [clientId, toolId]
        );
        return result.rows[0];
    }

    /**
     * Get all enabled tools for a client (with tool details)
     */
    static async getEnabledTools(clientId) {
        const result = await db.query(
            `SELECT ct.*, t.tool_name, t.description, t.parameters_schema, t.category, t.required_integrations, t.capabilities,
                    t.is_destructive, t.requires_confirmation, t.max_confidence
             FROM client_tools ct
             JOIN tools t ON ct.tool_id = t.id
             WHERE ct.client_id = $1 AND ct.enabled = true
             ORDER BY t.category, t.tool_name`,
            [clientId]
        );
        return result.rows;
    }

    /**
     * Get all tools for a client (enabled and disabled)
     */
    static async getAllTools(clientId) {
        const result = await db.query(
            `SELECT ct.*, t.tool_name, t.description, t.parameters_schema, t.category, t.required_integrations, t.capabilities,
                    t.is_destructive, t.requires_confirmation, t.max_confidence
             FROM client_tools ct
             JOIN tools t ON ct.tool_id = t.id
             WHERE ct.client_id = $1
             ORDER BY t.category, t.tool_name`,
            [clientId]
        );
        return result.rows;
    }

    /**
     * Find specific client-tool relationship
     */
    static async find(clientId, toolId) {
        const result = await db.query(
            `SELECT ct.*, t.tool_name, t.description, t.parameters_schema, t.category, t.required_integrations, t.capabilities,
                    t.is_destructive, t.requires_confirmation, t.max_confidence
             FROM client_tools ct
             JOIN tools t ON ct.tool_id = t.id
             WHERE ct.client_id = $1 AND ct.tool_id = $2`,
            [clientId, toolId]
        );
        return result.rows[0] || null;
    }

    /**
     * Update webhook URL, integration mapping, or custom config
     */
    static async update(clientId, toolId, updates) {
        const allowedFields = ['n8n_webhook_url', 'integration_mapping', 'custom_config', 'enabled'];
        const fields = [];
        const values = [];
        let paramIndex = 1;

        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
                // For JSONB fields, ensure proper formatting
                if (key === 'integration_mapping' && value !== null) {
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

        fields.push('updated_at = NOW()');
        values.push(clientId, toolId);

        const query = `
            UPDATE client_tools
            SET ${fields.join(', ')}
            WHERE client_id = $${paramIndex} AND tool_id = $${paramIndex + 1}
            RETURNING *
        `;

        const result = await db.query(query, values);
        return result.rows[0];
    }

    /**
     * Remove tool from client by tool_id
     */
    static async delete(clientId, toolId) {
        const result = await db.query(
            'DELETE FROM client_tools WHERE client_id = $1 AND tool_id = $2 RETURNING *',
            [clientId, toolId]
        );
        return result.rows[0];
    }

    /**
     * Remove tool from client by client_tools junction table ID
     */
    static async deleteById(id) {
        const result = await db.query(
            'DELETE FROM client_tools WHERE id = $1 RETURNING *',
            [id]
        );
        return result.rows[0];
    }

    /**
     * Get all clients using a specific tool
     */
    static async getClientsUsingTool(toolId) {
        const result = await db.query(
            `SELECT ct.*, c.name as client_name, c.domain
             FROM client_tools ct
             JOIN clients c ON ct.client_id = c.id
             WHERE ct.tool_id = $1 AND ct.enabled = true`,
            [toolId]
        );
        return result.rows;
    }
}
