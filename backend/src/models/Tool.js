import { db } from '../db.js';

export class Tool {
    /**
     * Create a new tool in the master catalog
     * @param {string} toolName - Tool name (e.g., 'check_inventory')
     * @param {string} description - Tool description
     * @param {Object} parametersSchema - JSON schema for parameters
     * @param {string} category - Tool category (optional)
     * @param {string} integrationType - Integration type this tool requires (optional, e.g., 'inventory_api')
     */
    static async create(toolName, description, parametersSchema = null, category = null, integrationType = null) {
        const result = await db.query(
            `INSERT INTO tools (tool_name, description, parameters_schema, category, integration_type)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [toolName, description, parametersSchema, category, integrationType]
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
        const allowedFields = ['tool_name', 'description', 'parameters_schema', 'category', 'integration_type'];
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
     * Get tools that require a specific integration type
     */
    static async findByIntegrationType(integrationType) {
        const result = await db.query(
            'SELECT * FROM tools WHERE integration_type = $1 ORDER BY tool_name',
            [integrationType]
        );
        return result.rows;
    }

    /**
     * Get available integration types from existing tools
     */
    static async getUsedIntegrationTypes() {
        const result = await db.query(
            `SELECT DISTINCT integration_type 
             FROM tools 
             WHERE integration_type IS NOT NULL 
             ORDER BY integration_type`
        );
        return result.rows.map(r => r.integration_type);
    }
}
