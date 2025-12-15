import { db } from '../db.js';

export class Tool {
    /**
     * Create a new tool in the master catalog
     * @param {string} toolName - Tool name (e.g., 'check_inventory')
     * @param {string} description - Tool description
     * @param {Object} parametersSchema - JSON schema for parameters
     * @param {string} category - Tool category (optional)
     * @param {Array} requiredIntegrations - Array of integration requirements (optional)
     *   Format: [{"key": "order_api", "name": "Order API", "required": true, "description": "..."}]
     * @param {Array} capabilities - Array of capability descriptions (optional)
     */
    static async create(toolName, description, parametersSchema = null, category = null, requiredIntegrations = null, capabilities = null) {
        // Format JSONB fields properly - ensure arrays/objects are JSON strings
        const formattedParams = parametersSchema
            ? (typeof parametersSchema === 'string' ? parametersSchema : JSON.stringify(parametersSchema))
            : null;
        const formattedCapabilities = capabilities
            ? (Array.isArray(capabilities) ? JSON.stringify(capabilities) : (typeof capabilities === 'string' ? capabilities : JSON.stringify(capabilities)))
            : null;
        const formattedIntegrations = requiredIntegrations
            ? (Array.isArray(requiredIntegrations) ? JSON.stringify(requiredIntegrations) : (typeof requiredIntegrations === 'string' ? requiredIntegrations : JSON.stringify(requiredIntegrations)))
            : '[]';

        const result = await db.query(
            `INSERT INTO tools (tool_name, description, parameters_schema, category, required_integrations, capabilities)
             VALUES ($1, $2, $3::jsonb, $4, $5::jsonb, $6::jsonb)
             RETURNING *`,
            [toolName, description, formattedParams, category, formattedIntegrations, formattedCapabilities]
        );
        return result.rows[0];
    }

    /**
     * Get all tools
     */
    static async getAll() {
        const result = await db.query(
            'SELECT * FROM tools ORDER BY category, tool_name'
        );
        return result.rows;
    }

    /**
     * Find tool by ID
     */
    static async findById(id) {
        const result = await db.query(
            'SELECT * FROM tools WHERE id = $1',
            [id]
        );
        return result.rows[0] || null;
    }

    /**
     * Find tool by name
     */
    static async findByName(toolName) {
        const result = await db.query(
            'SELECT * FROM tools WHERE tool_name = $1',
            [toolName]
        );
        return result.rows[0] || null;
    }

    /**
     * Get tools by category
     */
    static async findByCategory(category) {
        const result = await db.query(
            'SELECT * FROM tools WHERE category = $1 ORDER BY tool_name',
            [category]
        );
        return result.rows;
    }

    /**
     * Update tool
     */
    static async update(id, updates) {
        const allowedFields = ['tool_name', 'description', 'parameters_schema', 'category', 'required_integrations', 'capabilities'];
        const fields = [];
        const values = [];
        let paramIndex = 1;

        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
                // For JSONB fields, ensure proper JSON formatting
                if (key === 'capabilities' || key === 'required_integrations') {
                    // If it's an array, stringify it; if null, keep as null
                    fields.push(`${key} = $${paramIndex}::jsonb`);
                    values.push(value === null ? null : (typeof value === 'string' ? value : JSON.stringify(value)));
                } else if (key === 'parameters_schema' && value !== null) {
                    // Ensure parameters_schema is also properly formatted
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

        values.push(id);
        const query = `
            UPDATE tools
            SET ${fields.join(', ')}
            WHERE id = $${paramIndex}
            RETURNING *
        `;

        const result = await db.query(query, values);
        return result.rows[0];
    }

    /**
     * Delete tool (will fail if any clients are using it due to foreign key)
     */
    static async delete(id) {
        const result = await db.query(
            'DELETE FROM tools WHERE id = $1 RETURNING *',
            [id]
        );
        return result.rows[0];
    }

    /**
     * Get tools that require a specific integration key
     */
    static async findByIntegrationKey(integrationKey) {
        const result = await db.query(
            `SELECT * FROM tools
             WHERE required_integrations @> $1::jsonb
             ORDER BY tool_name`,
            [JSON.stringify([{ key: integrationKey }])]
        );
        return result.rows;
    }

    /**
     * Get all unique integration keys used across all tools
     */
    static async getUsedIntegrationKeys() {
        const result = await db.query(
            `SELECT DISTINCT jsonb_array_elements(required_integrations)->>'key' as integration_key
             FROM tools
             WHERE required_integrations IS NOT NULL
             AND jsonb_array_length(required_integrations) > 0
             ORDER BY integration_key`
        );
        return result.rows.map(r => r.integration_key);
    }
}
